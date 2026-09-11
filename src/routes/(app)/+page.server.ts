import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { field, parseNewBooks } from '$lib/server/actions';
import { addToCart, recentBooks } from '$lib/server/books';
import { parseMode, search } from '$lib/server/openlibrary';
import { listTags } from '$lib/server/tags';
import type { Book, SearchPage } from '$lib/types';

type Results = SearchPage & { error: string | null };

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const mode = parseMode(url.searchParams.get('by'));

	const results: Promise<Results | null> =
		q.length < 2
			? Promise.resolve(null)
			: search(q, mode).then(
					(page) => ({ ...page, error: null }),
					() => ({
						hits: [],
						total: 0,
						page: 1,
						hasMore: false,
						error: 'Open Library is not answering right now. Try again in a moment.'
					})
				);

	const [sources, recent, found] = await Promise.all([
		listTags('source'),
		q ? ([] as Book[]) : recentBooks(8),
		results
	]);
	return { q, mode, sources, recent, search: found };
};

export const actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const items = parseNewBooks(form.get('books'));
		if (!items.length) return fail(400, { message: 'Select at least one book first.' });
		return addToCart(items, field(form, 'source', 80));
	}
} satisfies Actions;
