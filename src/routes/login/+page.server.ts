import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	appPin,
	checkPin,
	createSession,
	safeNext,
	SESSION_COOKIE,
	SESSION_MAX_AGE
} from '$lib/server/auth';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.authed) redirect(303, safeNext(url.searchParams.get('next')));
	const { pin, usingDevDefault } = appPin();
	return { configured: pin !== null, devPin: usingDevDefault ? pin : null };
};

export const actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const pin = String(form.get('pin') ?? '').trim();
		if (!/^\d{4}$/.test(pin)) return fail(400, { message: 'Enter your 4 digits.' });

		const check = await checkPin(pin, getClientAddress());
		if (!check.ok) return fail(401, { message: check.message });

		cookies.set(SESSION_COOKIE, createSession(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE
		});
		redirect(303, safeNext(url.searchParams.get('next')));
	}
} satisfies Actions;
