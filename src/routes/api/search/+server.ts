import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseMode, search } from '$lib/server/openlibrary';

/** "More results" on the search page. */
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const mode = parseMode(url.searchParams.get('by'));
	const page = Math.min(Math.max(Number(url.searchParams.get('page')) || 1, 1), 50);
	if (q.length < 2) return json({ hits: [], total: 0, page, hasMore: false });

	try {
		return json(await search(q, mode, page));
	} catch {
		return json({ message: 'Open Library is not answering right now.' }, { status: 502 });
	}
};
