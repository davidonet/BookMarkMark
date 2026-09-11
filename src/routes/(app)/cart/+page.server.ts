import type { Actions, PageServerLoad } from './$types';
import { bookActions } from '$lib/server/actions';
import { listBooks } from '$lib/server/books';
import { listTags } from '$lib/server/tags';

export const load: PageServerLoad = async () => {
	const [books, sources, reasons] = await Promise.all([
		listBooks('cart', { createdAt: -1 }),
		listTags('source'),
		listTags('reason')
	]);
	return { books, sources, reasons };
};

export const actions = {
	source: bookActions.source,
	owned: bookActions.owned,
	later: bookActions.later,
	remove: bookActions.remove
} satisfies Actions;
