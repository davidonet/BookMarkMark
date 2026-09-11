import { fail, type RequestEvent } from '@sveltejs/kit';
import * as books from './books';
import type { NewBook } from './books';

const MOVED = 'That book has moved in the meantime.';

/** Trimmed, length-capped string field. */
export function field(form: FormData, key: string, max = 200): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const fieldList = (form: FormData, key: string) =>
	form.getAll(key).filter((v): v is string => typeof v === 'string');

/** Validates the JSON list of selected search hits sent by the search page. */
export function parseNewBooks(raw: FormDataEntryValue | null): NewBook[] {
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

	return data
		.slice(0, 50)
		.map((item: Record<string, unknown>) => ({
			olKey: str(item?.olKey, 40),
			title: str(item?.title, 300),
			subtitle: str(item?.subtitle, 300),
			authors: Array.isArray(item?.authors)
				? item.authors
						.map((a: unknown) => str(a, 200))
						.filter(Boolean)
						.slice(0, 6)
				: [],
			year: int(item?.year, 0, 3000),
			coverId: int(item?.coverId, 1, Number.MAX_SAFE_INTEGER)
		}))
		.filter((b) => /^\/works\/OL\d+W$/.test(b.olKey) && b.title);
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
		if (via !== 'direct' && via !== 'online') return fail(400, { message: 'Pick how you got it.' });
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
