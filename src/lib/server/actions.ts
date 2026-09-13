import { fail, type RequestEvent } from '@sveltejs/kit';
import * as books from './books';
import type { CatalogBook } from '$lib/types';

const MOVED = 'Ce livre a changé de statut entre-temps.';
const COVER_HOSTS = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org'];

/** Trimmed, length-capped string field. */
export function field(form: FormData, key: string, max = 200): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const fieldList = (form: FormData, key: string) =>
	form.getAll(key).filter((v): v is string => typeof v === 'string');

/** Validates the JSON list of selected search hits sent by the search page. */
export function parseNewBooks(raw: FormDataEntryValue | null): CatalogBook[] {
	if (typeof raw !== 'string') return [];
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];

	const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
	const int = (v: unknown, min: number, max: number) =>
		Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null;
	const cover = (v: unknown) => {
		try {
			const url = new URL(str(v, 500));
			return url.protocol === 'https:' && COVER_HOSTS.includes(url.hostname) ? url.href : null;
		} catch {
			return null;
		}
	};

	return data
		.slice(0, 50)
		.map((item: Record<string, unknown>) => ({
			ref: str(item?.ref, 60),
			title: str(item?.title, 300),
			subtitle: str(item?.subtitle, 300),
			authors: Array.isArray(item?.authors)
				? item.authors
						.map((a: unknown) => str(a, 200))
						.filter(Boolean)
						.slice(0, 6)
				: [],
			year: int(item?.year, 0, 3000),
			cover: cover(item?.cover),
			isbn: /^(\d{13}|\d{9}[\dX])$/.test(str(item?.isbn, 13)) ? str(item?.isbn, 13) : null,
			publisher: str(item?.publisher, 120),
			language: /^[a-z]{2,3}$/.test(str(item?.language, 3)) ? str(item?.language, 3) : '',
			format:
				item?.format === 'ebook'
					? ('ebook' as const)
					: item?.format === 'print'
						? ('print' as const)
						: null
		}))
		.filter((b) => /^(gb:[\w-]{4,40}|ol:\/works\/OL\d+W)$/.test(b.ref) && b.title);
}

/** Actions shared by several pages. Each form posts the book `id`. */
export const bookActions = {
	async source({ request }: RequestEvent) {
		const form = await request.formData();
		const ok = await books.setSource(field(form, 'id'), field(form, 'source', 80));
		return ok ? { ok } : fail(404, { message: MOVED });
	},

	async owned({ request }: RequestEvent) {
		const form = await request.formData();
		const via = field(form, 'via');
		if (via !== 'direct' && via !== 'online')
			return fail(400, { message: 'Indiquez comment vous l’avez obtenu.' });
		const ok = await books.markOwned(field(form, 'id'), via, field(form, 'note', 300));
		return ok ? { ok } : fail(409, { message: MOVED });
	},

	async later({ request }: RequestEvent) {
		const form = await request.formData();
		const ok = await books.postpone(
			field(form, 'id'),
			'mine',
			field(form, 'reason', 80),
			field(form, 'note', 300)
		);
		return ok ? { ok } : fail(409, { message: MOVED });
	},

	async backToCart({ request }: RequestEvent) {
		const form = await request.formData();
		const ok = await books.backToCart(field(form, 'id'));
		return ok ? { ok } : fail(409, { message: MOVED });
	},

	async remove({ request }: RequestEvent) {
		const form = await request.formData();
		const ok = await books.removeBook(field(form, 'id'));
		return ok ? { ok } : fail(404, { message: MOVED });
	}
};
