import type { ObjectId } from 'mongodb';
import type { EmailLang, OwnedInfo, PostponedInfo, Status, TagKind } from '$lib/types';

// Collections with generated ids leave `_id` out: the driver adds it (WithId<…>) on reads.

export interface BookDoc {
	/** Open Library work key, e.g. `/works/OL59863W` (unique). */
	olKey: string;
	title: string;
	subtitle: string;
	authors: string[];
	year: number | null;
	coverId: number | null;
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
