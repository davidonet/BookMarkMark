import type { ObjectId } from 'mongodb';
import type {
	CatalogBook,
	DetailsState,
	EditionLang,
	EmailLang,
	OwnedInfo,
	PaperEdition,
	PocketEdition,
	PostponedInfo,
	Price,
	Status,
	TagKind
} from '$lib/types';

// Collections with generated ids leave `_id` out: the driver adds it (WithId<…>) on reads.

export interface BookDetails {
	status: Exclude<DetailsState, 'missing' | 'stale'>;
	summary: string;
	price: Price | null;
	/** The paper edition found at the BnF; null when none, absent on lookups older than this. */
	edition?: PaperEdition | null;
	/** Its paperback (poche); null when none, absent on lookups older than this. */
	pocket?: PocketEdition | null;
	/** When the catch-up of those two started (see details.ts). */
	editionsAt?: Date;
	/** Web pages the summary was written from. */
	sources: string[];
	model: string | null;
	at: Date;
}

/** A tracked book; `ref` is unique. `format` is missing on books added before it existed. */
export interface BookDoc extends Omit<CatalogBook, 'format'> {
	format?: CatalogBook['format'];
	/** Normalized "title|first author": spots the same book across editions and catalogs. */
	match: string;
	/** Absent until the background lookup ran (see details.ts). */
	details?: BookDetails;
	source: string;
	status: Status;
	owned: OwnedInfo | null;
	postponed: PostponedInfo | null;
	requestId: ObjectId | null;
	createdAt: Date;
	updatedAt: Date;
	requestedAt: Date | null;
	confirmedAt: Date | null;
}

/** Fields of books saved before the switch to Google Books, migrated on startup (see db.ts). */
export interface LegacyBookFields {
	olKey?: string;
	coverId?: number | null;
}

/** Remembered free-text values offered in dropdowns (sources, postpone reasons). */
export interface TagDoc {
	kind: TagKind;
	/** Lower-cased name, unique per kind. */
	key: string;
	name: string;
	uses: number;
	lastUsedAt: Date;
	createdAt: Date;
}

/** One email sent to the bookstore. */
export interface RequestDoc {
	createdAt: Date;
	to: string;
	subject: string;
	body: string;
	bookIds: ObjectId[];
}

export interface SettingsDoc {
	_id: string;
	bookstoreName: string;
	bookstoreEmail: string;
	myName: string;
	emailLang: EmailLang;
	/** Missing on documents created before the setting existed. */
	editionLang?: EditionLang;
	createdAt: Date;
	updatedAt?: Date;
}

/** Failed PIN attempts, keyed by client IP. */
export interface AttemptDoc {
	_id: string;
	fails: number;
	locks: number;
	lockedUntil: Date | null;
	expiresAt: Date;
}
