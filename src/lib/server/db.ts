import { MongoClient, type Collection } from 'mongodb';
import { attachDatabasePool } from '@vercel/functions';
import { env } from '$env/dynamic/private';
import { matchKey } from './match';
import type {
	AttemptDoc,
	BookDoc,
	LegacyBookFields,
	RequestDoc,
	SettingsDoc,
	TagDoc
} from './models';

export interface Collections {
	books: Collection<BookDoc>;
	tags: Collection<TagDoc>;
	requests: Collection<RequestDoc>;
	settings: Collection<SettingsDoc>;
	attempts: Collection<AttemptDoc>;
}

const DEFAULT_SOURCES = ['Ami', 'Radio', 'Newsletter', 'Podcast'];
const DEFAULT_REASONS = [
	'En attente du poche',
	'Trop cher pour le moment',
	'Essayer la bibliothèque d’abord',
	'Pas le bon moment'
];

// Survives dev-server module reloads and is reused across requests on a warm instance.
const g = globalThis as typeof globalThis & { __bookmarkmark?: Promise<Collections> };

async function connect(): Promise<Collections> {
	if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

	const client = new MongoClient(env.MONGODB_URI, { appName: 'bookmarkmark', maxPoolSize: 10 });
	// Lets Vercel Fluid compute release idle connections before an instance is suspended.
	attachDatabasePool(client);
	await client.connect();

	const db = client.db(env.MONGO_DB || 'bookmarkmark');
	const c: Collections = {
		books: db.collection<BookDoc>('books'),
		tags: db.collection<TagDoc>('tags'),
		requests: db.collection<RequestDoc>('requests'),
		settings: db.collection<SettingsDoc>('settings'),
		attempts: db.collection<AttemptDoc>('login_attempts')
	};

	await migrateOpenLibraryBooks(c);
	await Promise.all([
		c.books.createIndexes([
			{ key: { ref: 1 }, name: 'ref_unique', unique: true },
			{ key: { match: 1 }, name: 'match' },
			{ key: { status: 1, updatedAt: -1 }, name: 'status_updatedAt' }
		]),
		c.tags.createIndex({ kind: 1, key: 1 }, { name: 'kind_key_unique', unique: true }),
		c.requests.createIndex({ createdAt: -1 }, { name: 'createdAt' }),
		c.attempts.createIndex({ expiresAt: 1 }, { name: 'ttl', expireAfterSeconds: 0 })
	]);
	await seedOnce(c);
	return c;
}

/**
 * Books saved when Open Library was the only catalog had `olKey`/`coverId`: move them to the
 * catalog-neutral `ref`/`cover`/`match`. Idempotent, and a no-op once done.
 */
async function migrateOpenLibraryBooks(c: Collections) {
	const books = c.books as unknown as Collection<BookDoc & LegacyBookFields>;
	// The old unique index would reject every book once `olKey` is gone.
	const indexes = await books.indexes().catch(() => []);
	if (indexes.some((i) => i.name === 'olKey_unique')) await books.dropIndex('olKey_unique');

	const legacy = await books.find({ ref: { $exists: false } }).toArray();
	if (!legacy.length) return;
	await books.bulkWrite(
		legacy.map((doc) => ({
			updateOne: {
				filter: { _id: doc._id },
				update: {
					$set: {
						ref: doc.olKey ? `ol:${doc.olKey}` : `legacy:${doc._id.toHexString()}`,
						cover: doc.coverId ? `https://covers.openlibrary.org/b/id/${doc.coverId}-M.jpg` : null,
						isbn: null,
						publisher: '',
						language: '',
						match: matchKey(doc.title, doc.authors ?? [])
					},
					$unset: { olKey: '', coverId: '' }
				}
			}
		}))
	);
}

/** First run only: create the settings document and pre-fill the dropdowns. */
async function seedOnce(c: Collections) {
	const now = new Date();
	const res = await c.settings.updateOne(
		{ _id: 'app' },
		{
			$setOnInsert: {
				bookstoreName: '',
				bookstoreEmail: '',
				myName: '',
				emailLang: 'en',
				editionLang: 'fr',
				createdAt: now
			}
		},
		{ upsert: true }
	);
	if (!res.upsertedCount) return;

	const defaults = [
		...DEFAULT_SOURCES.map((name) => ({ kind: 'source' as const, name })),
		...DEFAULT_REASONS.map((name) => ({ kind: 'reason' as const, name }))
	];
	await c.tags.bulkWrite(
		defaults.map(({ kind, name }) => ({
			updateOne: {
				filter: { kind, key: name.toLocaleLowerCase() },
				update: { $setOnInsert: { name, uses: 0, lastUsedAt: now, createdAt: now } },
				upsert: true
			}
		}))
	);
}

export function collections(): Promise<Collections> {
	g.__bookmarkmark ??= connect().catch((err) => {
		g.__bookmarkmark = undefined;
		throw err;
	});
	return g.__bookmarkmark;
}
