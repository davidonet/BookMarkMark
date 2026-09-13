import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { bookActions, field } from '$lib/server/actions';
import { addOwned, listBooks } from '$lib/server/books';
import { search } from '$lib/server/catalog';
import { lookUpMissing } from '$lib/server/details';

export const load: PageServerLoad = async () => {
	const books = await listBooks('owned', { 'owned.at': -1 });
	lookUpMissing(books);
	return { books };
};

/** ISBN-10 (last digit can be X) or ISBN-13, digits only (dashes stripped by the client). */
const ISBN_RE = /^(\d{9}[\dXx]|\d{13})$/;

export const actions = {
	/** From the barcode scanner: looks the ISBN up, then adds it straight to the shelf. */
	scan: async ({ request }) => {
		const form = await request.formData();
		const isbn = field(form, 'isbn', 30).replace(/[^0-9Xx]/g, '');
		if (!ISBN_RE.test(isbn)) return fail(400, { message: 'ISBN invalide.' });

		let page;
		try {
			page = await search({ q: isbn, mode: 'isbn' });
		} catch {
			return fail(502, { message: 'Le catalogue est indisponible pour le moment.' });
		}
		const hit = page.hits[0];
		if (!hit) return fail(404, { message: 'Aucun livre trouvé pour cet ISBN.' });
		if (hit.status === 'owned') return { already: true, title: hit.title };

		const { already } = await addOwned(hit);
		return { already, title: hit.title };
	},
	backToCart: bookActions.backToCart,
	remove: bookActions.remove
} satisfies Actions;
