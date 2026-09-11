import { ObjectId, type Filter, type WithId } from 'mongodb';
import { waitUntil } from '@vercel/functions';
import { env } from '$env/dynamic/private';
import {
	bnfEditionByIsbn,
	bnfEditionsByTitle,
	isPocket,
	pickPaper,
	pickPocket,
	type BnfEdition
} from './bnf';
import { collections } from './db';
import { googleVolumeDetails } from './googlebooks';
import { frenchSurvey, pocketOnWeb } from './survey';
import type { BookDoc } from './models';
import type { Book, PaperEdition, PocketEdition } from '$lib/types';

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

const googleDetails = (book: WithId<BookDoc>) =>
	book.ref.startsWith('gb:') && env.GOOGLEBOOKS_API_KEY
		? googleVolumeDetails(book.ref.slice(3), env.GOOGLEBOOKS_API_KEY).catch(() => null)
		: Promise.resolve(null);

const editionOf = (e: BnfEdition | null): PaperEdition | null =>
	e ? { isbn: e.isbn, publisher: e.publisher, year: e.year } : null;

const pocketOf = (e: BnfEdition | null): PocketEdition | null =>
	e?.isbn
		? {
				isbn: e.isbn,
				publisher: e.publisher,
				collection: e.collection,
				year: e.year,
				price: e.price
			}
		: null;

/**
 * The paperback as found on bookstore sites, when the BnF doesn't list one yet. The BnF record
 * of that ISBN, when there is one, has the last word: it tells a grand format apart.
 */
async function webPocket(book: WithId<BookDoc>, exclude: string[]): Promise<PocketEdition | null> {
	// Pocket collections are French ones: no use for a book in another language.
	if (book.language && book.language !== 'fr') return null;
	const found = await pocketOnWeb(book).catch((err) => {
		console.error(`[details] pocket search failed for "${book.title}":`, err);
		return null;
	});
	if (!found || exclude.includes(found.isbn)) return null;
	const known = await bnfEditionByIsbn(found.isbn).catch(() => null);
	if (!known) return { ...found, publisher: '', year: null };
	if (!isPocket(known) && known.height) return null;
	return {
		isbn: found.isbn,
		publisher: known.publisher,
		collection: known.collection || found.collection,
		year: known.year,
		price: known.price ?? found.price
	};
}

/**
 * The editions to ask the bookstore for. `paper`: this one when the BnF knows its ISBN; for an
 * ebook or a book found without ISBN, the BnF's paper edition with the same title and author.
 * `other`: another paper edition, only useful for its price. `pocket`: the paperback (poche).
 */
async function findEditions(book: WithId<BookDoc>, isEbook: boolean) {
	const [own, editions] = await Promise.all([
		book.isbn && !isEbook ? bnfEditionByIsbn(book.isbn).catch(() => null) : null,
		bnfEditionsByTitle(book).catch(() => [])
	]);
	const byTitle = pickPaper(editions, book);
	const paper = own ?? (isEbook || !book.isbn ? byTitle : null);
	const other = paper ? null : byTitle;
	const exclude = [paper?.isbn, book.isbn].filter((isbn): isbn is string => !!isbn);
	const pocket =
		paper && isPocket(paper)
			? pocketOf(paper)
			: (pocketOf(
					pickPocket(editions, {
						exclude,
						language: book.language,
						below: (paper ?? other)?.price?.amount
					})
				) ?? (await webPocket(book, exclude)));
	return { paper, other, pocket };
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
		const google = await googleDetails(book);
		const isEbook = google?.isEbook ?? book.format === 'ebook';
		const [{ paper, other, pocket }, survey] = await Promise.all([
			findEditions(book, isEbook),
			// null: no OpenRouter key configured; undefined: the call failed (retried later)
			frenchSurvey(book, google?.description).catch((err) => {
				console.error(`[details] survey failed for "${book.title}":`, err);
				return undefined;
			})
		]);

		await books.updateOne(
			{ _id },
			{
				$set: {
					...(google ? { format: isEbook ? 'ebook' : 'print' } : {}),
					details: {
						status: survey === undefined ? 'failed' : 'done',
						summary:
							survey?.summary ||
							(google?.language === 'fr' && google.description ? shorten(google.description) : ''),
						// The BnF price of the edition to order is the official one; then bookstore pages
						// found by the web search, another paper edition's price, and last the ebook price.
						price: paper?.price ?? survey?.price ?? other?.price ?? google?.ebookPrice ?? null,
						edition: editionOf(paper),
						pocket,
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

/** Books looked up before the paper and pocket editions were: only those, no new summary. */
async function lookUpEditions(_id: ObjectId) {
	const { books } = await collections();
	// Claimed too: the list refreshes every few seconds meanwhile (see RefreshWhilePending).
	const book = await books.findOneAndUpdate(
		{
			_id,
			'details.status': 'done',
			$or: [{ 'details.edition': { $exists: false } }, { 'details.pocket': { $exists: false } }],
			'details.editionsAt': { $not: { $gt: new Date(Date.now() - STALE_PENDING_AFTER) } }
		},
		{ $set: { 'details.editionsAt': new Date() } },
		{ returnDocument: 'after' }
	);
	if (!book?.details) return;
	const google = await googleDetails(book);
	const isEbook = google?.isEbook ?? book.format === 'ebook';
	const { paper, pocket } = await findEditions(book, isEbook);
	await books.updateOne(
		{ _id },
		{
			$set: {
				...(google ? { format: isEbook ? 'ebook' : 'print' } : {}),
				'details.edition': editionOf(paper),
				'details.pocket': pocket,
				// Keep the price in line with the edition that will be ordered.
				...(paper?.price ? { 'details.price': paper.price } : {})
			}
		}
	);
}

/** Looks up the French summary, price and editions of these books after the response is sent. */
export function lookUpDetails(ids: ObjectId[]) {
	if (ids.length) waitUntil(Promise.allSettled(ids.map(lookUp)));
}

/** Catches up on books without (complete) details, a few per list view. */
export function lookUpMissing(books: Book[]) {
	const id = (b: Book) => new ObjectId(b.id);
	// Not started first; running ones are only picked up again if stuck (see lookupDue).
	const due = [
		...books.filter((b) => b.details === 'missing' || b.details === 'failed'),
		...books.filter((b) => b.details === 'pending')
	].slice(0, LOOKUPS_PER_PAGE_VIEW);
	const stale = books.filter((b) => b.details === 'stale').slice(0, LOOKUPS_PER_PAGE_VIEW);
	if (due.length || stale.length) {
		waitUntil(
			Promise.allSettled([...due.map(id).map(lookUp), ...stale.map(id).map(lookUpEditions)])
		);
	}
}
