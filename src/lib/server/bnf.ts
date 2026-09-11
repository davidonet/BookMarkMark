import type { Price } from '$lib/types';

// The BnF catalogue records the fixed French retail price (loi Lang) of each registered edition.
const SRU = 'https://catalogue.bnf.fr/api/SRU';

/** 978-prefixed ISBN-13 → ISBN-10, the only form older BnF records know. */
function toIsbn10(isbn: string): string | null {
	if (!/^978\d{10}$/.test(isbn)) return null;
	const core = isbn.slice(3, 12);
	const sum = [...core].reduce((total, digit, i) => total + (10 - i) * Number(digit), 0);
	const check = (11 - (sum % 11)) % 11;
	return core + (check === 10 ? 'X' : String(check));
}

/** First euro price of a UNIMARC response (field 010 $d: "19 EUR", "7,50 EUR"…). */
function firstEuroPrice(xml: string): number | null {
	for (const [, field] of xml.matchAll(
		/<mxc:datafield tag="010"[^>]*>([\s\S]*?)<\/mxc:datafield>/g
	)) {
		const terms = /<mxc:subfield code="d">([^<]*)<\/mxc:subfield>/.exec(field)?.[1] ?? '';
		const match = /(\d+(?:[.,]\d{1,2})?)\s*(?:EUR|€)/i.exec(terms);
		if (match) return Number(match[1].replace(',', '.'));
	}
	return null;
}

const cql = (text: string) => text.replace(/["\\]/g, ' ').trim();

/**
 * Price of this very edition (by ISBN), or with `byTitle`, of the most relevant edition with the
 * same title and author: a fallback for ebooks and books found without ISBN.
 */
export async function bnfPrice(
	book: { isbn: string | null; title: string; authors: string[] },
	{ byTitle = false } = {}
): Promise<Price | null> {
	const queries: string[] = [];
	if (byTitle) {
		const lastName = book.authors[0]?.split(/\s+/).pop();
		if (lastName) {
			queries.push(`bib.title all "${cql(book.title)}" and bib.author all "${cql(lastName)}"`);
		}
	} else if (book.isbn) {
		queries.push(`bib.isbn all "${book.isbn}"`);
		const isbn10 = toIsbn10(book.isbn);
		if (isbn10) queries.push(`bib.isbn all "${isbn10}"`);
	}

	for (const query of queries) {
		const url = new URL(SRU);
		url.searchParams.set('version', '1.2');
		url.searchParams.set('operation', 'searchRetrieve');
		url.searchParams.set('query', query);
		url.searchParams.set('recordSchema', 'unimarcxchange');
		url.searchParams.set('maximumRecords', '5');
		const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
		if (!res.ok) continue;
		const amount = firstEuroPrice(await res.text());
		if (amount && amount > 0 && amount < 1000) {
			return { amount, currency: 'EUR', kind: 'print', source: 'BnF' };
		}
	}
	return null;
}
