import type { Actions, PageServerLoad } from './$types';
import { bookActions } from '$lib/server/actions';
import { listBooks } from '$lib/server/books';

export const load: PageServerLoad = async () => ({
	books: await listBooks('owned', { 'owned.at': -1 })
});

export const actions = {
	backToCart: bookActions.backToCart,
	remove: bookActions.remove
} satisfies Actions;
