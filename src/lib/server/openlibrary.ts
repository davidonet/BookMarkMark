import type { SearchMode } from '$lib/types';
import { CatalogError, type CatalogPage } from './catalog-types';

const PAGE_SIZE = 20;
const FIELDS = 'key,title,subtitle,author_name,first_publish_year,cover_i,edition_count';

interface OpenLibraryDoc {
	key?: string;
	title?: string;
	subtitle?: string;
	author_name?: string[];
	first_publish_year?: number;
	cover_i?: number;
	edition_count?: number;
}

/** Open Library groups editions into works, and needs no key. */
export async function searchOpenLibrary(
	q: string,
	mode: SearchMode,
	page: number
): Promise<CatalogPage> {
	const url = new URL('https://openlibrary.org/search.json');
	url.searchParams.set(mode === 'all' ? 'q' : mode, q);
	url.searchParams.set('fields', FIELDS);
	url.searchParams.set('limit', String(PAGE_SIZE));
	url.searchParams.set('page', String(page));

	const res = await fetch(url, {
		headers: {
			'User-Agent': 'BookMarkMark/1.0 (personal reading list)',
			Accept: 'application/json'
		},
		signal: AbortSignal.timeout(15_000)
	});
	if (!res.ok) throw new CatalogError(`it answered ${res.status}`);
	const json = (await res.json()) as { numFound?: number; docs?: OpenLibraryDoc[] };

	const hits = (json.docs ?? [])
		.filter((d): d is OpenLibraryDoc & { key: string; title: string } =>
			Boolean(d.key?.startsWith('/works/') && d.title)
		)
		.map((d) => ({
			ref: `ol:${d.key}`,
			title: d.title,
			subtitle: d.subtitle ?? '',
			authors: [...new Set(d.author_name ?? [])].slice(0, 6),
			year: d.first_publish_year ?? null,
			cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
			isbn: null,
			publisher: '',
			language: '',
			format: null,
			editions: d.edition_count ?? null
		}));
	const total = json.numFound ?? hits.length;
	return { hits, total, page, hasMore: page * PAGE_SIZE < total };
}
