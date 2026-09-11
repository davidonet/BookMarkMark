import { MongoServerError, ObjectId, type Filter, type Sort, type WithId } from 'mongodb';
import { collections } from './db';
import { cleanText, rememberTag } from './tags';
import type { BookDoc } from './models';
import {
	UNAVAILABLE_LABEL,
	type Book,
	type OwnedVia,
	type PostponeKind,
	type Status
} from '$lib/types';

export type NewBook = Pick<
	BookDoc,
	'olKey' | 'title' | 'subtitle' | 'authors' | 'year' | 'coverId'
>;

export function toBook(doc: WithId<BookDoc>): Book {
	return {
		id: doc._id.toHexString(),
		olKey: doc.olKey,
		title: doc.title,
		subtitle: doc.subtitle ?? '',
		authors: doc.authors ?? [],
		year: doc.year ?? null,
		coverId: doc.coverId ?? null,
		source: doc.source ?? '',
		status: doc.status,
		owned: doc.owned ?? null,
		postponed: doc.postponed ?? null,
		requestId: doc.requestId?.toHexString() ?? null,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
		requestedAt: doc.requestedAt ?? null,
		confirmedAt: doc.confirmedAt ?? null
	};
}

const toObjectId = (id: string) => (/^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null);
const toObjectIds = (ids: string[]) => ids.map(toObjectId).filter((id): id is ObjectId => !!id);

export async function listBooks(status: Status | Status[], sort: Sort = { updatedAt: -1 }) {
	const { books } = await collections();
	const filter: Filter<BookDoc> = Array.isArray(status) ? { status: { $in: status } } : { status };
	return (await books.find(filter).sort(sort).limit(1000).toArray()).map(toBook);
}

export async function recentBooks(limit = 8) {
	const { books } = await collections();
	return (await books.find().sort({ createdAt: -1 }).limit(limit).toArray()).map(toBook);
}

export async function countByStatus(): Promise<Record<Status, number>> {
	const { books } = await collections();
	const counts: Record<Status, number> = {
		cart: 0,
		requested: 0,
		confirmed: 0,
		owned: 0,
		postponed: 0
	};
	const rows = await books
		.aggregate<{ _id: Status; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }])
		.toArray();
	for (const row of rows) if (row._id in counts) counts[row._id] = row.n;
	return counts;
}

export async function statusesFor(olKeys: string[]): Promise<Map<string, Status>> {
	if (!olKeys.length) return new Map();
	const { books } = await collections();
	const docs = await books
		.find({ olKey: { $in: olKeys } }, { projection: { olKey: 1, status: 1 } })
		.toArray();
	return new Map(docs.map((d) => [d.olKey, d.status]));
}

/**
 * New books land in the cart. A postponed book comes back to the cart (you heard about it again);
 * anything already in the flow is left alone.
 */
export async function addToCart(items: NewBook[], rawSource: string) {
	const { books } = await collections();
	const source = await rememberTag('source', rawSource);
	const now = new Date();
	const result = { added: 0, revived: 0, skipped: 0 };

	for (const item of items) {
		const existing = await books.findOne({ olKey: item.olKey }, { projection: { status: 1 } });
		if (existing?.status === 'postponed') {
			await books.updateOne(
				{ _id: existing._id },
				{ $set: { status: 'cart', postponed: null, updatedAt: now, ...(source ? { source } : {}) } }
			);
			result.revived++;
		} else if (existing) {
			result.skipped++;
		} else {
			try {
				await books.insertOne({
					...item,
					source,
					status: 'cart',
					owned: null,
					postponed: null,
					requestId: null,
					createdAt: now,
					updatedAt: now,
					requestedAt: null,
					confirmedAt: null
				});
				result.added++;
			} catch (err) {
				if (err instanceof MongoServerError && err.code === 11000) result.skipped++;
				else throw err;
			}
		}
	}
	return result;
}

/** Moves one book, only if it is currently in one of the `from` statuses. */
async function move(id: string, from: Status[], set: Partial<BookDoc>): Promise<boolean> {
	const _id = toObjectId(id);
	if (!_id) return false;
	const { books } = await collections();
	const res = await books.updateOne(
		{ _id, status: { $in: from } },
		{ $set: { ...set, updatedAt: new Date() } }
	);
	return res.matchedCount === 1;
}

export async function setSource(id: string, rawSource: string) {
	const source = await rememberTag('source', rawSource);
	return move(id, ['cart', 'requested', 'confirmed', 'owned', 'postponed'], { source });
}

export function markOwned(id: string, via: OwnedVia, note: string) {
	return move(id, ['cart', 'requested', 'confirmed', 'postponed'], {
		status: 'owned',
		owned: { via, note: cleanText(note, 300), at: new Date() },
		postponed: null
	});
}

export async function postpone(id: string, kind: PostponeKind, rawReason: string, note: string) {
	const reason =
		kind === 'mine' ? (await rememberTag('reason', rawReason)) || 'Later' : UNAVAILABLE_LABEL[kind];
	return move(
		id,
		kind === 'mine' ? ['cart', 'requested', 'confirmed'] : ['requested', 'confirmed'],
		{
			status: 'postponed',
			postponed: { kind, reason, note: cleanText(note, 300), at: new Date() },
			owned: null
		}
	);
}

export function backToCart(id: string) {
	return move(id, ['requested', 'confirmed', 'owned', 'postponed'], {
		status: 'cart',
		owned: null,
		postponed: null,
		requestId: null,
		requestedAt: null,
		confirmedAt: null
	});
}

export async function removeBook(id: string) {
	const _id = toObjectId(id);
	if (!_id) return false;
	const { books } = await collections();
	return (await books.deleteOne({ _id })).deletedCount === 1;
}

/** The bookstore can get these. */
export async function confirmBooks(ids: string[]) {
	const { books } = await collections();
	const now = new Date();
	const res = await books.updateMany(
		{ _id: { $in: toObjectIds(ids) }, status: 'requested' },
		{ $set: { status: 'confirmed', confirmedAt: now, updatedAt: now } }
	);
	return res.modifiedCount;
}

/** Picked up at the bookstore. */
export async function pickUp(ids: string[]) {
	const { books } = await collections();
	const now = new Date();
	const res = await books.updateMany(
		{ _id: { $in: toObjectIds(ids) }, status: 'confirmed' },
		{ $set: { status: 'owned', owned: { via: 'bookstore', note: '', at: now }, updatedAt: now } }
	);
	return res.modifiedCount;
}

/** Records the email and moves the books from the cart to "asked bookstore". */
export async function markRequested(
	ids: string[],
	email: { to: string; subject: string; body: string }
) {
	const { books, requests } = await collections();
	const inCart = await books
		.find({ _id: { $in: toObjectIds(ids) }, status: 'cart' }, { projection: { _id: 1 } })
		.toArray();
	if (!inCart.length) return 0;

	const now = new Date();
	const bookIds = inCart.map((d) => d._id);
	const { insertedId } = await requests.insertOne({ createdAt: now, ...email, bookIds });
	const res = await books.updateMany(
		{ _id: { $in: bookIds }, status: 'cart' },
		{ $set: { status: 'requested', requestId: insertedId, requestedAt: now, updatedAt: now } }
	);
	return res.modifiedCount;
}

export interface RequestGroup {
	id: string;
	createdAt: Date;
	to: string;
	subject: string;
	body: string;
	books: Book[];
}

/** Books waiting for the bookstore's answer (grouped by email), and confirmed ones to pick up. */
export async function bookstoreBoard(): Promise<{ waiting: RequestGroup[]; confirmed: Book[] }> {
	const { books, requests } = await collections();
	const docs = await books
		.find({ status: { $in: ['requested', 'confirmed'] } })
		.sort({ title: 1 })
		.toArray();

	const confirmed = docs
		.filter((d) => d.status === 'confirmed')
		.sort((a, b) => (a.confirmedAt?.getTime() ?? 0) - (b.confirmedAt?.getTime() ?? 0))
		.map(toBook);

	const waitingDocs = docs.filter((d) => d.status === 'requested');
	const requestIds = [...new Set(waitingDocs.map((d) => d.requestId?.toHexString() ?? ''))]
		.filter(Boolean)
		.map((id) => new ObjectId(id));
	const requestDocs = requestIds.length
		? await requests.find({ _id: { $in: requestIds } }).toArray()
		: [];
	const byId = new Map(requestDocs.map((r) => [r._id.toHexString(), r]));

	const groups = new Map<string, RequestGroup>();
	for (const doc of waitingDocs) {
		const key = doc.requestId?.toHexString() ?? 'unknown';
		let group = groups.get(key);
		if (!group) {
			const req = byId.get(key);
			group = {
				id: key,
				createdAt: req?.createdAt ?? doc.requestedAt ?? doc.updatedAt,
				to: req?.to ?? '',
				subject: req?.subject ?? '',
				body: req?.body ?? '',
				books: []
			};
			groups.set(key, group);
		}
		group.books.push(toBook(doc));
	}

	const waiting = [...groups.values()].sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime()
	);
	return { waiting, confirmed };
}
