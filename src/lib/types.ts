/** Where a book stands in the "heard about it → own it" flow. */
export type Status = 'cart' | 'requested' | 'confirmed' | 'owned' | 'postponed';
export type OwnedVia = 'bookstore' | 'direct' | 'online';
/** `mine` = I postponed it myself, the others come from the bookstore's answer. */
export type PostponeKind = 'mine' | 'out_of_print' | 'not_accessible';
export type TagKind = 'source' | 'reason';
export type EmailLang = 'en' | 'fr';
/** Language whose editions come first in search results ('' = no preference). */
export type EditionLang = 'fr' | 'en' | '';
export type SearchMode = 'all' | 'title' | 'author';
export type Provider = 'google' | 'openlibrary';

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

/** A book as described by a catalog (Google Books or Open Library). */
export interface CatalogBook {
	/** `gb:<Google Books volume id>` or `ol:<Open Library work key>`. */
	ref: string;
	title: string;
	subtitle: string;
	authors: string[];
	year: number | null;
	/** Cover thumbnail URL. */
	cover: string | null;
	isbn: string | null;
	publisher: string;
	/** ISO 639-1 code, '' when unknown. */
	language: string;
}

export interface Book extends CatalogBook {
	id: string;
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

export interface SearchHit extends CatalogBook {
	/** Open Library groups editions into works; Google Books lists editions. */
	editions: number | null;
	status: Status | null;
}

export interface SearchPage {
	hits: SearchHit[];
	total: number;
	page: number;
	hasMore: boolean;
	provider: Provider;
	/** Set when the preferred catalog failed and the other one answered. */
	notice: string | null;
}

export interface Settings {
	bookstoreName: string;
	bookstoreEmail: string;
	myName: string;
	emailLang: EmailLang;
	editionLang: EditionLang;
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

export const PROVIDER_LABEL: Record<Provider, string> = {
	google: 'Google Books',
	openlibrary: 'Open Library'
};

/** The book's page on its catalog. */
export function bookLink(ref: string): { href: string; site: string } | null {
	if (ref.startsWith('gb:')) {
		return {
			href: `https://books.google.com/books?id=${encodeURIComponent(ref.slice(3))}`,
			site: PROVIDER_LABEL.google
		};
	}
	if (ref.startsWith('ol:')) {
		return { href: `https://openlibrary.org${ref.slice(3)}`, site: PROVIDER_LABEL.openlibrary };
	}
	return null;
}
