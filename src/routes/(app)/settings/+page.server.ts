import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { field } from '$lib/server/actions';
import { appPin, SESSION_COOKIE } from '$lib/server/auth';
import { EMAIL_RE, getSettings, saveSettings } from '$lib/server/settings';
import { forgetTag, listTags } from '$lib/server/tags';

export const load: PageServerLoad = async () => {
	const [settings, sources, reasons] = await Promise.all([
		getSettings(),
		listTags('source'),
		listTags('reason')
	]);
	return { settings, sources, reasons, devPin: appPin().usingDevDefault };
};

export const actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const bookstoreEmail = field(form, 'bookstoreEmail', 200);
		if (bookstoreEmail && !EMAIL_RE.test(bookstoreEmail)) {
			return fail(400, { message: 'That email address looks off.' });
		}
		await saveSettings({
			bookstoreName: field(form, 'bookstoreName', 100),
			bookstoreEmail,
			myName: field(form, 'myName', 100),
			emailLang: field(form, 'emailLang') === 'fr' ? 'fr' : 'en'
		});
		return { ok: true };
	},

	/** Removes a remembered source or reason from the dropdowns (books keep their text). */
	forget: async ({ request }) => {
		const form = await request.formData();
		const kind = field(form, 'kind');
		if (kind !== 'source' && kind !== 'reason') return fail(400, { message: 'Unknown list.' });
		await forgetTag(kind, field(form, 'name', 100));
		return { ok: true };
	},

	lock: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
} satisfies Actions;
