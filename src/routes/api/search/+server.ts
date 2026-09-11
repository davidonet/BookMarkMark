import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseMode, parseProvider, search } from '$lib/server/catalog';
import { CatalogError } from '$lib/server/catalog-types';

/** "More results" on the search page, from the same catalog as the first page (`from`). */
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const mode = parseMode(url.searchParams.get('by'));
	const page = Math.min(Math.max(Number(url.searchParams.get('page')) || 1, 1), 50);
	if (q.length < 2) return json({ message: 'Type at least 2 characters.' }, { status: 400 });

	try {
		return json(await search({ q, mode, page }, parseProvider(url.searchParams.get('from'))));
	} catch (err) {
		const reason = err instanceof CatalogError ? err.message : 'it did not answer';
		return json({ message: `The catalog is unavailable: ${reason}.` }, { status: 502 });
	}
};
