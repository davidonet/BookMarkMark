import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseMode, parseProvider, search } from '$lib/server/catalog';
import { CatalogError } from '$lib/server/catalog-types';

/** "More results" on the search page, from the same catalog as the first page (`from`). */
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const mode = parseMode(url.searchParams.get('by'));
	const page = Math.min(Math.max(Number(url.searchParams.get('page')) || 1, 1), 50);
	if (q.length < 2) return json({ message: 'Saisissez au moins 2 caractères.' }, { status: 400 });

	try {
		return json(await search({ q, mode, page }, parseProvider(url.searchParams.get('from'))));
	} catch (err) {
		const reason = err instanceof CatalogError ? err.message : 'il n’a pas répondu';
		return json({ message: `Le catalogue est indisponible : ${reason}.` }, { status: 502 });
	}
};
