import type { CatalogBook, SearchMode } from '$lib/types';
import { CatalogError, type CatalogPage } from './catalog-types';
import { matchKey } from './match';

const PAGE_SIZE = 20;
const MAX_PAGES = 10; // Google Books rarely returns anything useful past ~200 results
const FIELDS =
	'totalItems,items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,industryIdentifiers,imageLinks/thumbnail,imageLinks/smallThumbnail,language),saleInfo/isEbook)';

interface Volume {
	id?: string;
	volumeInfo?: {
		title?: string;
		subtitle?: string;
		authors?: string[];
		publisher?: string;
		publishedDate?: string;
		industryIdentifiers?: { type: string; identifier: string }[];
		imageLinks?: { thumbnail?: string; smallThumbnail?: string };
		language?: string;
	};
	/** `isEbook`: sold on Google Play, so the ISBN is the ebook's. */
	saleInfo?: { isEbook?: boolean };
}

/** `intitle:` and `inauthor:` only apply to the next word, so every word gets one. */
export function googleQuery(q: string, mode: SearchMode) {
	const words = q.trim().split(/\s+/).filter(Boolean);
	if (mode === 'all') return words.join(' ');
	const operator = mode === 'title' ? 'intitle:' : 'inauthor:';
	return words.map((word) => operator + word).join(' ');
}

export function toCatalogBook(volume: Volume): CatalogBook | null {
	const info = volume.volumeInfo;
	if (!volume.id || !info?.title) return null;
	const ids = info.industryIdentifiers ?? [];
	const image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
	return {
		ref: `gb:${volume.id}`,
		title: info.title,
		subtitle: info.subtitle ?? '',
		authors: [...new Set(info.authors ?? [])].slice(0, 6),
		year: /^\d{4}/.test(info.publishedDate ?? '') ? Number(info.publishedDate!.slice(0, 4)) : null,
		// Served over http with a page-curl effect by default.
		cover: image ? image.replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
		isbn:
			ids.find((i) => i.type === 'ISBN_13')?.identifier ??
			ids.find((i) => i.type === 'ISBN_10')?.identifier ??
			null,
		publisher: info.publisher ?? '',
		language: info.language ?? '',
		format: volume.saleInfo?.isEbook ? 'ebook' : 'print'
	};
}

/** Google lists every edition, often with identical twins: keep one of each. */
function dropTwins(books: CatalogBook[]) {
	const seen = new Set<string>();
	return books.filter((b) => {
		const key = [b.title, b.authors.join(), b.publisher, b.year, b.language, b.format]
			.join('|')
			.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function errorMessage(status: number, body: string) {
	if (status === 429) return 'son quota journalier est épuisé';
	if (/API_KEY_INVALID|API key not valid/i.test(body)) return "la clé API n'est pas valide";
	if (status === 403) return "la clé a été refusée (l'API Books est-elle activée pour elle ?)";
	return `il a répondu ${status}`;
}

async function fetchVolumes(
	q: string,
	mode: SearchMode,
	page: number,
	apiKey: string,
	langRestrict?: string,
	size = PAGE_SIZE
) {
	const url = new URL('https://www.googleapis.com/books/v1/volumes');
	url.searchParams.set('q', googleQuery(q, mode));
	url.searchParams.set('printType', 'books');
	url.searchParams.set('maxResults', String(size));
	url.searchParams.set('startIndex', String((page - 1) * PAGE_SIZE));
	url.searchParams.set('fields', FIELDS);
	if (langRestrict) url.searchParams.set('langRestrict', langRestrict);
	url.searchParams.set('key', apiKey);

	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
		if (res.ok) {
			const json = (await res.json()) as { totalItems?: number; items?: Volume[] };
			return { items: json.items ?? [], total: json.totalItems ?? 0 };
		}
		const body = await res.text();
		// Google Books answers a random 503 now and then: the same request usually works again.
		if (res.status >= 500 && attempt < 3) {
			await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
			continue;
		}
		throw new CatalogError(errorMessage(res.status, body));
	}
}

/** Publisher description and Google Play (ebook) price of one edition, for the details lookup. */
export async function googleVolumeDetails(id: string, apiKey: string) {
	const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`);
	url.searchParams.set('country', 'FR');
	url.searchParams.set('fields', 'volumeInfo(description,language),saleInfo(isEbook,retailPrice)');
	url.searchParams.set('key', apiKey);
	const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
	if (!res.ok) throw new CatalogError(errorMessage(res.status, await res.text()));
	const json = (await res.json()) as {
		volumeInfo?: { description?: string; language?: string };
		saleInfo?: { isEbook?: boolean; retailPrice?: { amount?: number; currencyCode?: string } };
	};
	const retail = json.saleInfo?.retailPrice;
	return {
		// Descriptions come with some HTML.
		description: (json.volumeInfo?.description ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim(),
		language: json.volumeInfo?.language ?? '',
		isEbook: json.saleInfo?.isEbook ?? false,
		ebookPrice:
			retail?.currencyCode === 'EUR' && retail.amount
				? {
						amount: retail.amount,
						currency: 'EUR' as const,
						kind: 'ebook' as const,
						source: 'Google Play'
					}
				: null
	};
}

/**
 * With a preferred language, the first page also asks for (up to 40) editions in that language,
 * and lists the preferred-language editions first. Later pages continue the "all" list.
 */
export async function searchGoogleBooks(
	q: string,
	mode: SearchMode,
	page: number,
	apiKey: string,
	preferLang = ''
): Promise<CatalogPage> {
	const [preferred, all] = await Promise.all([
		preferLang && page === 1
			? fetchVolumes(q, mode, page, apiKey, preferLang, 40).catch(() => null)
			: null,
		fetchVolumes(q, mode, page, apiKey)
	]);

	const seen = new Set<string>();
	const books = [...(preferred?.items ?? []), ...all.items]
		.map(toCatalogBook)
		.filter((b): b is CatalogBook => b !== null && !seen.has(b.ref) && !!seen.add(b.ref));
	// `langRestrict` is only a hint for Google (often ignored): sort, keeping relevance order.
	const byLanguage = dropTwins(books).sort(
		(a, b) =>
			Number(!!preferLang && a.language !== preferLang) -
			Number(!!preferLang && b.language !== preferLang)
	);
	// Editions of the same book stay together at their best position, the paper one first:
	// that's what a bookstore sells.
	const group = new Map<string, number>();
	const ranked = byLanguage.map((book, index) => {
		const key = matchKey(book.title, book.authors);
		if (!group.has(key)) group.set(key, index);
		return { book, index, group: group.get(key)! };
	});
	const hits = ranked
		.sort(
			(x, y) =>
				x.group - y.group ||
				Number(x.book.format === 'ebook') - Number(y.book.format === 'ebook') ||
				x.index - y.index
		)
		.map(({ book }) => ({ ...book, editions: null }));
	return {
		hits,
		total: Math.max(all.total, hits.length),
		page,
		hasMore: all.items.length === PAGE_SIZE && page < MAX_PAGES
	};
}
