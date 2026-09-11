import type { SearchHit, SearchPage } from '$lib/types';

/** One page of results from a catalog, before they are matched against my lists. */
export type CatalogPage = Omit<SearchPage, 'hits' | 'provider' | 'notice'> & {
	hits: Omit<SearchHit, 'status'>[];
};

/** A catalog failure with a message fit for the UI. */
export class CatalogError extends Error {}
