import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { bookActions, field, fieldList } from '$lib/server/actions';
import { bookstoreBoard, confirmBooks, pickUp, postpone } from '$lib/server/books';
import { lookUpMissing } from '$lib/server/details';

export const load: PageServerLoad = async () => {
	const board = await bookstoreBoard();
	lookUpMissing([...board.waiting.flatMap((g) => g.books), ...board.confirmed]);
	return { board };
};

export const actions = {
	/** One or several `id`s: the bookstore can get them. */
	confirm: async ({ request }) => {
		const n = await confirmBooks(fieldList(await request.formData(), 'id'));
		return n ? { n } : fail(409, { message: 'Plus rien à confirmer.' });
	},

	/** One or several `id`s: picked up, now on the shelf. */
	gotIt: async ({ request }) => {
		const n = await pickUp(fieldList(await request.formData(), 'id'));
		return n ? { n } : fail(409, { message: 'Plus rien à récupérer.' });
	},

	unavailable: async ({ request }) => {
		const form = await request.formData();
		const kind = field(form, 'kind');
		if (kind !== 'out_of_print' && kind !== 'not_accessible') {
			return fail(400, { message: 'Choisissez une raison.' });
		}
		const ok = await postpone(field(form, 'id'), kind, '', field(form, 'note', 300));
		return ok ? { ok } : fail(409, { message: 'Ce livre a changé de statut entre-temps.' });
	},

	backToCart: bookActions.backToCart
} satisfies Actions;
