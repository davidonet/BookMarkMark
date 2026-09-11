import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { bookActions, field, fieldList } from '$lib/server/actions';
import { bookstoreBoard, confirmBooks, pickUp, postpone } from '$lib/server/books';

export const load: PageServerLoad = async () => ({ board: await bookstoreBoard() });

export const actions = {
	/** One or several `id`s: the bookstore can get them. */
	confirm: async ({ request }) => {
		const n = await confirmBooks(fieldList(await request.formData(), 'id'));
		return n ? { n } : fail(409, { message: 'Nothing left to confirm.' });
	},

	/** One or several `id`s: picked up, now on the shelf. */
	gotIt: async ({ request }) => {
		const n = await pickUp(fieldList(await request.formData(), 'id'));
		return n ? { n } : fail(409, { message: 'Nothing left to pick up.' });
	},

	unavailable: async ({ request }) => {
		const form = await request.formData();
		const kind = field(form, 'kind');
		if (kind !== 'out_of_print' && kind !== 'not_accessible') {
			return fail(400, { message: 'Pick a reason.' });
		}
		const ok = await postpone(field(form, 'id'), kind, '', field(form, 'note', 300));
		return ok ? { ok } : fail(409, { message: 'That book has moved in the meantime.' });
	},

	backToCart: bookActions.backToCart
} satisfies Actions;
