import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { field, fieldList } from '$lib/server/actions';
import { listBooks, markRequested } from '$lib/server/books';
import { EMAIL_RE, getSettings, saveSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const [books, settings] = await Promise.all([listBooks('cart', { createdAt: 1 }), getSettings()]);
	return { books, settings };
};

export const actions = {
	sent: async ({ request }) => {
		const form = await request.formData();
		const ids = fieldList(form, 'id');
		const to = field(form, 'to', 200);
		if (!ids.length) return fail(400, { message: 'Pick at least one book.' });
		if (to && !EMAIL_RE.test(to)) return fail(400, { message: 'That email address looks off.' });

		const moved = await markRequested(ids, {
			to,
			subject: field(form, 'subject', 300),
			body: field(form, 'body', 20_000)
		});
		// Autosave: next email starts with the same address and language.
		await saveSettings({
			emailLang: field(form, 'lang') === 'fr' ? 'fr' : 'en',
			...(to ? { bookstoreEmail: to } : {})
		});
		if (!moved) return fail(409, { message: 'Those books already left the cart.' });
		redirect(303, '/bookstore');
	}
} satisfies Actions;
