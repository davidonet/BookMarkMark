/** Where a book stands in the "heard about it → own it" flow. */
export type Status = 'cart' | 'requested' | 'confirmed' | 'owned' | 'postponed';
export type OwnedVia = 'bookstore' | 'direct' | 'online';
/** `mine` = I postponed it myself, the others come from the bookstore's answer. */
export type PostponeKind = 'mine' | 'out_of_print' | 'not_accessible';
export type TagKind = 'source' | 'reason';
export type EmailLang = 'en' | 'fr';
export type SearchMode = 'all' | 'title' | 'author';

export interface OwnedInfo {
	via: OwnedVia;
	note: string;
	at: Date;
}

export interface PostponedInfo {
	kind: PostponeKind;
	reason: string;
	note: string;
	at: Date;
}

export interface Book {
	id: string;
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
	requestId: string | null;
	createdAt: Date;
	updatedAt: Date;
	requestedAt: Date | null;
	confirmedAt: Date | null;
}

export interface SearchHit {
	olKey: string;
	title: string;
	subtitle: string;
	authors: string[];
	year: number | null;
	coverId: number | null;
	editions: number;
	status: Status | null;
}

export interface SearchPage {
	hits: SearchHit[];
	total: number;
	page: number;
	hasMore: boolean;
}

export interface Settings {
	bookstoreName: string;
	bookstoreEmail: string;
	myName: string;
	emailLang: EmailLang;
}

export const STATUS_LABEL: Record<Status, string> = {
	cart: 'In cart',
	requested: 'Asked bookstore',
	confirmed: 'Confirmed',
	owned: 'Owned',
	postponed: 'Later'
};

export const OWNED_VIA_LABEL: Record<OwnedVia, string> = {
	bookstore: 'Local bookstore',
	direct: 'Bought directly',
	online: 'Online service'
};

export const UNAVAILABLE_LABEL: Record<Exclude<PostponeKind, 'mine'>, string> = {
	out_of_print: 'Out of print',
	not_accessible: 'Not accessible to this bookstore'
};

export const coverUrl = (coverId: number, size: 'S' | 'M' | 'L' = 'M') =>
	`https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
