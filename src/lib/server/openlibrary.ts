import { statusesFor } from './books';
import type { SearchHit, SearchMode, SearchPage } from '$lib/types';

const PAGE_SIZE = 20;
const CACHE_TTL = 10 * 60 * 1000;
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

type Page = Omit<SearchPage, 'hits'> & { hits: Omit<SearchHit, 'status'>[] };

// Open Library is slow (1–4 s): keep recent answers on the warm instance.
const cache = new Map<string, { at: number; page: Page }>();

export const parseMode = (value: string | null): SearchMode =>
	value === 'title' || value === 'author' ? value : 'all';

async function fetchPage(q: string, mode: SearchMode, page: number): Promise<Page> {
	const key = `${mode}|${page}|${q.toLocaleLowerCase()}`;
	const cached = cache.get(key);
	if (cached && Date.now() - cached.at < CACHE_TTL) return cached.page;

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
	if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
	const json = (await res.json()) as { numFound?: number; docs?: OpenLibraryDoc[] };

	const hits = (json.docs ?? [])
		.filter((d): d is OpenLibraryDoc & { key: string; title: string } =>
			Boolean(d.key?.startsWith('/works/') && d.title)
		)
		.map((d) => ({
			olKey: d.key,
			title: d.title,
			subtitle: d.subtitle ?? '',
			authors: [...new Set(d.author_name ?? [])].slice(0, 6),
			year: d.first_publish_year ?? null,
			coverId: d.cover_i ?? null,
			editions: d.edition_count ?? 0
		}));
	const total = json.numFound ?? hits.length;
	const result: Page = { hits, total, page, hasMore: page * PAGE_SIZE < total };

	cache.set(key, { at: Date.now(), page: result });
	if (cache.size > 300) cache.delete(cache.keys().next().value!);
	return result;
}

/** Searches Open Library and tags every hit with its status in my lists. */
export async function search(q: string, mode: SearchMode, page = 1): Promise<SearchPage> {
	const result = await fetchPage(q, mode, page);
	const statuses = await statusesFor(result.hits.map((h) => h.olKey));
	return {
		...result,
		hits: result.hits.map((h) => ({ ...h, status: statuses.get(h.olKey) ?? null }))
	};
}
