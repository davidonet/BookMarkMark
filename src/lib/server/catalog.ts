import { env } from '$env/dynamic/private';
import { statusesFor } from './books';
import { CatalogError, type CatalogPage } from './catalog-types';
import { searchGoogleBooks } from './googlebooks';
import { searchOpenLibrary } from './openlibrary';
import {
	PROVIDER_LABEL,
	type EditionLang,
	type Provider,
	type SearchMode,
	type SearchPage
} from '$lib/types';

const CACHE_TTL = 10 * 60 * 1000;
// Catalogs are slow and Google's quota is daily: keep recent answers on the warm instance.
const cache = new Map<string, { at: number; page: CatalogPage }>();

export const parseMode = (value: string | null): SearchMode =>
	value === 'title' || value === 'author' || value === 'isbn' ? value : 'all';

export const parseProvider = (value: string | null): Provider | undefined =>
	value === 'google' || value === 'openlibrary' ? value : undefined;

/** Google Books as soon as a key is configured. */
export const preferredProvider = (): Provider =>
	env.GOOGLEBOOKS_API_KEY ? 'google' : 'openlibrary';

interface Query {
	q: string;
	mode: SearchMode;
	page: number;
	/** Editions in this language first (Google Books only). */
	lang: EditionLang;
}

async function fetchPage(provider: Provider, { q, mode, page, lang }: Query) {
	const key = `${provider}|${mode}|${page}|${lang}|${q.toLocaleLowerCase()}`;
	const cached = cache.get(key);
	if (cached && Date.now() - cached.at < CACHE_TTL) return cached.page;

	let result: CatalogPage;
	if (provider === 'google') {
		if (!env.GOOGLEBOOKS_API_KEY) throw new CatalogError('aucune clé API configurée');
		result = await searchGoogleBooks(q, mode, page, env.GOOGLEBOOKS_API_KEY, lang);
	} else {
		result = await searchOpenLibrary(q, mode, page);
	}
	cache.set(key, { at: Date.now(), page: result });
	if (cache.size > 300) cache.delete(cache.keys().next().value!);
	return result;
}

const reason = (err: unknown) => (err instanceof CatalogError ? err.message : 'il n’a pas répondu');

/**
 * Searches the preferred catalog and falls back to the other one for a first page, so a
 * Google outage or an exhausted quota never blocks the app. "More results" names the catalog
 * of the first page (`only`), so pages never mix.
 */
export async function search(
	{ q, mode, page = 1, lang = '' }: Omit<Query, 'page' | 'lang'> & Partial<Query>,
	only?: Provider
): Promise<SearchPage> {
	const query = { q, mode, page, lang };
	const preferred = only ?? preferredProvider();
	let provider = preferred;
	let notice: string | null = null;
	let result: CatalogPage;

	try {
		result = await fetchPage(preferred, query);
	} catch (err) {
		if (only || page > 1) throw err;
		provider = preferred === 'google' ? 'openlibrary' : 'google';
		if (provider === 'google' && !env.GOOGLEBOOKS_API_KEY) throw err;
		result = await fetchPage(provider, query);
		notice = `${PROVIDER_LABEL[preferred]} est indisponible (${reason(err)}), les résultats viennent de ${PROVIDER_LABEL[provider]}.`;
	}

	const statuses = await statusesFor(result.hits);
	return {
		...result,
		provider,
		notice,
		hits: result.hits.map((h) => ({ ...h, status: statuses.get(h.ref) ?? null }))
	};
}
