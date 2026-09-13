import { createHmac, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { collections } from './db';

export const SESSION_COOKIE = 'bmm_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days: it's a sidekick, not a bank
export const DEV_PIN = '1234';

const MAX_FAILS = 5;
const BASE_LOCK_MINUTES = 15;
const MAX_LOCK_MINUTES = 24 * 60;

/** The configured PIN. In `pnpm dev` without APP_PIN it falls back to 1234; production fails closed. */
export function appPin(): { pin: string | null; usingDevDefault: boolean } {
	const raw = env.APP_PIN?.trim();
	if (raw) return { pin: /^\d{4}$/.test(raw) ? raw : null, usingDevDefault: false };
	return dev ? { pin: DEV_PIN, usingDevDefault: true } : { pin: null, usingDevDefault: false };
}

// The PIN is part of the key, so changing APP_PIN signs every device out.
const sign = (payload: string, pin: string) =>
	createHmac('sha256', `${env.AUTH_SECRET || env.MONGODB_URI || 'bookmarkmark'}::${pin}`)
		.update(payload)
		.digest('base64url');

function safeEqual(a: string, b: string) {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSession(): string {
	const { pin } = appPin();
	if (!pin) throw new Error('APP_PIN is not configured');
	const issued = Date.now().toString(36);
	return `${issued}.${sign(issued, pin)}`;
}

export function verifySession(token: string | undefined): boolean {
	const { pin } = appPin();
	if (!token || !pin) return false;
	const [issued, signature] = token.split('.');
	if (!issued || !signature) return false;
	const age = Date.now() - parseInt(issued, 36);
	if (!(age >= 0 && age < SESSION_MAX_AGE * 1000)) return false;
	return safeEqual(signature, sign(issued, pin));
}

type PinCheck = { ok: true } | { ok: false; message: string };

/** Checks a PIN with a per-IP lockout that doubles each time (15 min, 30 min, 1 h … 24 h). */
export async function checkPin(input: string, clientKey: string): Promise<PinCheck> {
	const { pin } = appPin();
	if (!pin) return { ok: false, message: 'APP_PIN n’est pas configuré sur le serveur.' };

	const { attempts } = await collections();
	const now = new Date();
	const doc = await attempts.findOne({ _id: clientKey });

	if (doc?.lockedUntil && doc.lockedUntil > now) {
		const minutes = Math.ceil((doc.lockedUntil.getTime() - now.getTime()) / 60_000);
		return { ok: false, message: `Trop d’essais. Réessayez dans ${minutes} min.` };
	}

	if (safeEqual(input, pin)) {
		if (doc) await attempts.deleteOne({ _id: clientKey });
		return { ok: true };
	}

	const fails = (doc?.fails ?? 0) + 1;
	const locks = doc?.locks ?? 0;
	const locked = fails >= MAX_FAILS;
	const lockMinutes = Math.min(BASE_LOCK_MINUTES * 2 ** locks, MAX_LOCK_MINUTES);
	await attempts.updateOne(
		{ _id: clientKey },
		{
			$set: {
				fails: locked ? 0 : fails,
				locks: locked ? locks + 1 : locks,
				lockedUntil: locked ? new Date(now.getTime() + lockMinutes * 60_000) : null,
				expiresAt: new Date(now.getTime() + 2 * MAX_LOCK_MINUTES * 60_000)
			}
		},
		{ upsert: true }
	);
	await new Promise((resolve) => setTimeout(resolve, 400));

	if (locked)
		return { ok: false, message: `Trop d’essais. Verrouillé pendant ${lockMinutes} min.` };
	const left = MAX_FAILS - fails;
	return {
		ok: false,
		message: `Code incorrect. ${left} essai${left === 1 ? '' : 's'} restant${left === 1 ? '' : 's'}.`
	};
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
		? next
		: '/';
}
