import type { PaperEdition, Price } from '$lib/types';

// The BnF catalogue records every edition deposited in France (dépôt légal), with its ISBN,
// publisher, year, format and fixed retail price (loi Lang).
const SRU = 'https://catalogue.bnf.fr/api/SRU';

export interface BnfEdition extends PaperEdition {
	price: Price | null;
	/** "Folio", "Le Livre de poche"… ('' when none). */
	collection: string;
	/** In cm: 18 for a paperback (poche), 20 to 24 for a grand format. */
	height: number | null;
	/** Language of the text (ISO 639-2: "fre"), '' when unknown. */
	language: string;
}

const check10 = (nine: string) => {
	const sum = [...nine].reduce((total, digit, i) => total + (10 - i) * Number(digit), 0);
	const check = (11 - (sum % 11)) % 11;
	return check === 10 ? 'X' : String(check);
};

const check13 = (twelve: string) => {
	const sum = [...twelve].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
	return String((10 - (sum % 10)) % 10);
};

/** 978-prefixed ISBN-13 → ISBN-10, the only form older BnF records know. */
export function toIsbn10(isbn: string): string | null {
	return /^978\d{10}$/.test(isbn) ? isbn.slice(3, 12) + check10(isbn.slice(3, 12)) : null;
}

/** "978-2-07-289509-8" or "2-07-036002-4" → 13 digits. */
function toIsbn13(raw: string): string | null {
	const digits = raw.replace(/[^\dX]/gi, '').toUpperCase();
	if (/^\d{13}$/.test(digits)) return digits;
	if (/^\d{9}[\dX]$/.test(digits))
		return `978${digits.slice(0, 9)}${check13(`978${digits.slice(0, 9)}`)}`;
	return null;
}

/** Same as toIsbn13, but only for well-formed ISBNs (check digit included): for untrusted input. */
export function validIsbn13(raw: string): string | null {
	const digits = raw.replace(/[^\dX]/gi, '').toUpperCase();
	if (/^97[89]\d{10}$/.test(digits) && check13(digits.slice(0, 12)) === digits[12]) return digits;
	if (/^\d{9}[\dX]$/.test(digits) && check10(digits.slice(0, 9)) === digits[9])
		return toIsbn13(digits);
	return null;
}

function subfields(record: string, tag: string, code: string): string[] {
	const values: string[] = [];
	const fields = record.matchAll(
		new RegExp(`<mxc:datafield tag="${tag}"[^>]*>([\\s\\S]*?)</mxc:datafield>`, 'g')
	);
	for (const [, field] of fields) {
		const found = field.matchAll(
			new RegExp(`<mxc:subfield code="${code}">([^<]*)</mxc:subfield>`, 'g')
		);
		for (const [, value] of found) values.push(decode(value).trim());
	}
	return values;
}

const decode = (text: string) =>
	text
		// &#136; and &#137; frame the words ignored when sorting: "&#136;Le &#137;Livre de poche".
		.replace(/&#(\d+);/g, (_, code) =>
			code === '136' || code === '137' ? '' : String.fromCodePoint(Number(code))
		)
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

/** Printers and distributors share the publisher field: "le Tripode", "Impr. Corlet", "[Sodis]". */
const isPublisher = (name: string) => !/impr|imprim|^\[|diffusion|distrib/i.test(name);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function parseRecords(xml: string): BnfEdition[] {
	return [...xml.matchAll(/<srw:record>([\s\S]*?)<\/srw:record>/g)].map(([, record]) => {
		const publisher =
			[...subfields(record, '214', 'c'), ...subfields(record, '210', 'c')].find(isPublisher) ?? '';
		const date = [...subfields(record, '214', 'd'), ...subfields(record, '210', 'd')].join(' ');
		const terms = subfields(record, '010', 'd').join(' ');
		const amount = /(\d+(?:[.,]\d{1,2})?)\s*(?:EUR|€)/i.exec(terms)?.[1];
		const price = amount ? Number(amount.replace(',', '.')) : 0;
		const collection =
			[...subfields(record, '225', 'a'), ...subfields(record, '410', 't')][0] ?? '';
		return {
			isbn: subfields(record, '010', 'a').map(toIsbn13).find(Boolean) ?? null,
			publisher: capitalize(publisher),
			year: Number(/\b(1[5-9]|20)\d{2}\b/.exec(date)?.[0]) || null,
			price:
				price > 0 && price < 1000
					? { amount: price, currency: 'EUR', kind: 'print', source: 'BnF' }
					: null,
			collection: capitalize(collection.replace(/^collection\s+/i, '')),
			height: Number(/(\d+)\s*cm/.exec(subfields(record, '215', 'd')[0] ?? '')?.[1]) || null,
			language: subfields(record, '101', 'a')[0] ?? ''
		};
	});
}

async function query(cql: string, records = 10): Promise<BnfEdition[]> {
	const url = new URL(SRU);
	url.searchParams.set('version', '1.2');
	url.searchParams.set('operation', 'searchRetrieve');
	url.searchParams.set('query', cql);
	url.searchParams.set('recordSchema', 'unimarcxchange');
	url.searchParams.set('maximumRecords', String(records));
	const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
	return res.ok ? parseRecords(await res.text()) : [];
}

const cqlText = (text: string) => text.replace(/["\\]/g, ' ').trim();
const simplify = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/\b(editions?|ed\.|les|la|le)\b/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '');

/** Pocket collections and publishers; a few bigger than 18 cm (10/18 is 19 cm now). */
export const POCKET_NAME =
	/\b(folio|poches?|pocket|j['’]ai lu|points|10[-/ ]?18|babel|double|proche|m[ée]t[ée]ores|libretto|piccolo|totem|librio|titres|motifs|archipoche)\b/i;
/** Book clubs, large print and audio: not what a bookstore orders. */
const SPECIAL =
	/france[- ]loisirs|grand livre du mois|figaro|noyelles|vue d['’]oeil|voir de pr[eè]s|feryane|gabelire|corps 16|libra diffusio|la loupe|audiolib|[ée]coutez lire|lizzie/i;
/** A small format dearer than this is a small grand format (Minuit, Allia…), not a paperback. */
const POCKET_MAX_PRICE = 13;

const isSpecial = (e: BnfEdition) => SPECIAL.test(`${e.publisher} ${e.collection}`);
const pocketName = (e: BnfEdition) => POCKET_NAME.test(`${e.publisher} ${e.collection}`);

export const isPocket = (e: BnfEdition) =>
	!isSpecial(e) &&
	(pocketName(e) ||
		(!!e.height && e.height <= 18 && (!e.price || e.price.amount <= POCKET_MAX_PRICE)));

/** The first item passing the most preferences, earlier ones weighing more; order kept on ties. */
function best<T>(items: T[], ...prefs: ((item: T) => boolean)[]): T | null {
	const score = (item: T) =>
		prefs.reduce((sum, pref, i) => sum + (pref(item) ? 2 ** (prefs.length - i) : 0), 0);
	return items.reduce<T | null>(
		(top, item) => (top === null || score(item) > score(top) ? item : top),
		null
	);
}

/** This very edition, by ISBN. */
export async function bnfEditionByIsbn(isbn: string): Promise<BnfEdition | null> {
	for (const candidate of [isbn, toIsbn10(isbn)].filter((i): i is string => !!i)) {
		const found = (await query(`bib.isbn all "${candidate}"`))[0];
		if (found) return { ...found, isbn: found.isbn ?? toIsbn13(isbn) };
	}
	return null;
}

/** Every edition of the book (by title and author) that has an ISBN, book clubs and large print aside. */
export async function bnfEditionsByTitle(book: {
	title: string;
	authors: string[];
}): Promise<BnfEdition[]> {
	const lastName = book.authors[0]?.split(/\s+/).pop();
	if (!lastName) return [];
	const editions = await query(
		`bib.title all "${cqlText(book.title)}" and bib.author all "${cqlText(lastName)}"`,
		30
	);
	return editions.filter((e) => e.isbn && !isSpecial(e));
}

const LANGUAGES: Record<string, string> = { fr: 'fre', en: 'eng', de: 'ger', es: 'spa', it: 'ita' };

/** Whether an edition is in the book's language (ISO 639-1 code, '' when unknown). */
const inLanguage = (language: string) => (e: BnfEdition) =>
	!LANGUAGES[language] || !e.language || e.language === LANGUAGES[language];

/**
 * The paper edition a bookstore would order, for ebooks and books found without ISBN: in the
 * same language, from the same publisher when known, a grand format rather than a paperback,
 * with a price when possible.
 */
export function pickPaper(
	editions: BnfEdition[],
	book: { publisher: string; language: string }
): BnfEdition | null {
	const wanted = simplify(book.publisher);
	const samePublisher = (e: BnfEdition) => {
		const other = simplify(e.publisher);
		return !!wanted && !!other && (other.includes(wanted) || wanted.includes(other));
	};
	return best(
		editions,
		inLanguage(book.language),
		samePublisher,
		(e) => !isPocket(e),
		(e) => !!e.price
	);
}

/**
 * The paperback (poche) of the same book: a known pocket collection rather than just a small
 * format, with a price, the most recent. Never one of `exclude`, nor dearer than `below`.
 */
export function pickPocket(
	editions: BnfEdition[],
	{ exclude, language, below }: { exclude: string[]; language: string; below?: number }
): BnfEdition | null {
	const candidates = editions
		.filter(
			(e) =>
				e.isbn &&
				!exclude.includes(e.isbn) &&
				isPocket(e) &&
				inLanguage(language)(e) &&
				(!below || !e.price || e.price.amount < below)
		)
		.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
	return best(candidates, pocketName, (e) => !!e.price);
}
