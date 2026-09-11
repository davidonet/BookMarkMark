import { ObjectId, type Filter } from 'mongodb';
import { waitUntil } from '@vercel/functions';
import { env } from '$env/dynamic/private';
import { bnfPrice } from './bnf';
import { collections } from './db';
import { googleVolumeDetails } from './googlebooks';
import { frenchSurvey } from './survey';
import type { BookDoc } from './models';
import type { Book } from '$lib/types';

const RETRY_FAILED_AFTER = 60 * 60 * 1000;
const STALE_PENDING_AFTER = 3 * 60 * 1000; // the instance was recycled mid-lookup
const LOOKUPS_PER_PAGE_VIEW = 3;

/** A book whose details are missing, failed a while ago, or stuck. */
function lookupDue(): Filter<BookDoc> {
	const now = Date.now();
	return {
		$or: [
			{ details: { $exists: false } },
			{ 'details.status': 'failed', 'details.at': { $lt: new Date(now - RETRY_FAILED_AFTER) } },
			{ 'details.status': 'pending', 'details.at': { $lt: new Date(now - STALE_PENDING_AFTER) } }
		]
	};
}

/** First sentences of a description, as a fallback summary. */
function shorten(text: string, max = 320) {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const end = cut.lastIndexOf('. ');
	return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

async function lookUp(_id: ObjectId) {
	const { books } = await collections();
	// Claim the book, so concurrent page views don't look it up twice.
	const book = await books.findOneAndUpdate(
		{ _id, ...lookupDue() },
		{ $set: { 'details.status': 'pending', 'details.at': new Date() } },
		{ returnDocument: 'after' }
	);
	if (!book) return;

	try {
		const google =
			book.ref.startsWith('gb:') && env.GOOGLEBOOKS_API_KEY
				? await googleVolumeDetails(book.ref.slice(3), env.GOOGLEBOOKS_API_KEY).catch(() => null)
				: null;
		const [bnf, survey] = await Promise.all([
			bnfPrice(book).catch(() => null),
			// null: no OpenRouter key configured; undefined: the call failed (retried later)
			frenchSurvey(book, google?.description).catch((err) => {
				console.error(`[details] survey failed for "${book.title}":`, err);
				return undefined;
			})
		]);

		// The BnF price of this edition is the official one; then bookstore pages found by the web
		// search, another edition's BnF price, and last the ebook price.
		const price =
			bnf ??
			survey?.price ??
			(await bnfPrice(book, { byTitle: true }).catch(() => null)) ??
			google?.ebookPrice ??
			null;

		await books.updateOne(
			{ _id },
			{
				$set: {
					details: {
						status: survey === undefined ? 'failed' : 'done',
						summary:
							survey?.summary ||
							(google?.language === 'fr' && google.description ? shorten(google.description) : ''),
						price,
						sources: survey?.sources ?? [],
						model: survey?.model ?? null,
						at: new Date()
					}
				}
			}
		);
	} catch (err) {
		console.error(`[details] lookup failed for "${book.title}":`, err);
		await books.updateOne(
			{ _id },
			{ $set: { 'details.status': 'failed', 'details.at': new Date() } }
		);
	}
}

/** Looks up the French summary and price of these books after the response is sent. */
export function lookUpDetails(ids: ObjectId[]) {
	if (ids.length) waitUntil(Promise.allSettled(ids.map(lookUp)));
}

/** Catches up on books without details (added before this feature, or failed), a few per view. */
export function lookUpMissing(books: Book[]) {
	// Not started first; running ones are only picked up again if stuck (see lookupDue).
	const due = [
		...books.filter((b) => b.details === 'missing' || b.details === 'failed'),
		...books.filter((b) => b.details === 'pending')
	];
	lookUpDetails(due.slice(0, LOOKUPS_PER_PAGE_VIEW).map((b) => new ObjectId(b.id)));
}
