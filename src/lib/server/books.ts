import { MongoServerError, ObjectId, type Filter, type Sort, type WithId } from 'mongodb';
import { collections } from './db';
import { lookUpDetails } from './details';
import { matchKey } from './match';
import { cleanText, rememberTag } from './tags';
import type { BookDoc } from './models';
import {
	UNAVAILABLE_LABEL,
	type Book,
	type CatalogBook,
	type OwnedVia,
	type PostponeKind,
	type Status
} from '$lib/types';

export function toBook(doc: WithId<BookDoc>): Book {
	return {
		id: doc._id.toHexString(),
		ref: doc.ref,
		title: doc.title,
		subtitle: doc.subtitle ?? '',
		authors: doc.authors ?? [],
		year: doc.year ?? null,
		cover: doc.cover ?? null,
		isbn: doc.isbn ?? null,
		publisher: doc.publisher ?? '',
		language: doc.language ?? '',
		summary: doc.details?.summary ?? '',
		price: doc.details?.price ?? null,
		details: doc.details?.status ?? 'missing',
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

/** Status of each search hit (by `ref`), also when I track another edition of the same book. */
export async function statusesFor(
	hits: Pick<CatalogBook, 'ref' | 'title' | 'authors'>[]
): Promise<Map<string, Status>> {
	if (!hits.length) return new Map();
	const { books } = await collections();
	const matches = hits.map((h) => matchKey(h.title, h.authors));
	const docs = await books
		.find(
			{ $or: [{ ref: { $in: hits.map((h) => h.ref) } }, { match: { $in: matches } }] },
			{ projection: { ref: 1, match: 1, status: 1 } }
		)
		.toArray();
	const byRef = new Map(docs.map((d) => [d.ref, d.status]));
	const byMatch = new Map(docs.map((d) => [d.match, d.status]));
	const statuses = new Map<string, Status>();
	hits.forEach((h, i) => {
		const status = byRef.get(h.ref) ?? byMatch.get(matches[i]);
		if (status) statuses.set(h.ref, status);
	});
	return statuses;
}

/**
 * New books land in the cart. A postponed book comes back to the cart (you heard about it again);
 * anything already in the flow is left alone.
 */
export async function addToCart(items: CatalogBook[], rawSource: string) {
	const { books } = await collections();
	const source = await rememberTag('source', rawSource);
	const now = new Date();
	const result = { added: 0, revived: 0, skipped: 0 };
	const inserted: ObjectId[] = [];

	for (const item of items) {
		const match = matchKey(item.title, item.authors);
		const existing = await books.findOne(
			{ $or: [{ ref: item.ref }, { match }] },
			{ projection: { status: 1 } }
		);
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
				const { insertedId } = await books.insertOne({
					...item,
					match,
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
				inserted.push(insertedId);
				result.added++;
			} catch (err) {
				if (err instanceof MongoServerError && err.code === 11000) result.skipped++;
				else throw err;
			}
		}
	}
	lookUpDetails(inserted);
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
