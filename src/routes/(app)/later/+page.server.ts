import type { Actions, PageServerLoad } from './$types';
import { bookActions } from '$lib/server/actions';
import { listBooks } from '$lib/server/books';
import { lookUpMissing } from '$lib/server/details';

export const load: PageServerLoad = async () => {
	const books = await listBooks('postponed', { 'postponed.at': -1 });
	lookUpMissing(books);
	return { books };
};

export const actions = {
	backToCart: bookActions.backToCart,
	owned: bookActions.owned,
	remove: bookActions.remove
} satisfies Actions;
