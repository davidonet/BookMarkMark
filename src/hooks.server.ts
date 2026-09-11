import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, verifySession } from '$lib/server/auth';

/** Everything except the PIN screen requires a valid session cookie. */
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;
	event.locals.authed = verifySession(event.cookies.get(SESSION_COOKIE));

	const isLogin = pathname === '/login' || pathname.startsWith('/login/');
	if (!event.locals.authed && !isLogin) {
		if (pathname.startsWith('/api/')) {
			return Response.json({ message: 'Locked' }, { status: 401 });
		}
		const next =
			pathname === '/' && !search ? '' : `?next=${encodeURIComponent(pathname + search)}`;
		redirect(303, `/login${next}`);
	}

	const response = await resolve(event);
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
};
