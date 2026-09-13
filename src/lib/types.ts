/** Where a book stands in the "heard about it → own it" flow. */
export type Status = 'cart' | 'requested' | 'confirmed' | 'owned' | 'postponed';
export type OwnedVia = 'bookstore' | 'direct' | 'online';
/** `mine` = I postponed it myself, the others come from the bookstore's answer. */
export type PostponeKind = 'mine' | 'out_of_print' | 'not_accessible';
export type TagKind = 'source' | 'reason';
export type EmailLang = 'en' | 'fr';
/** Language whose editions come first in search results ('' = no preference). */
export type EditionLang = 'fr' | 'en' | '';
export type SearchMode = 'all' | 'title' | 'author' | 'isbn';
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
	/** From Google Books; null when unknown (Open Library). */
	format: 'print' | 'ebook' | null;
}

/** The paper edition to ask the bookstore for (from the BnF when it knows it). */
export interface PaperEdition {
	isbn: string | null;
	publisher: string;
	year: number | null;
}

export interface Price {
	amount: number;
	currency: 'EUR';
	/** `print`: the fixed French retail price of the paper edition; `ebook`: Google Play. */
	kind: 'print' | 'ebook';
	/** Where it comes from: "BnF", a bookstore's domain, "Google Play". */
	source: string;
}

/** The paperback (poche) of the same book, cheaper: from the BnF, or found on bookstore sites. */
export interface PocketEdition extends PaperEdition {
	isbn: string;
	/** "Folio", "Le Livre de poche"…, '' when unknown. */
	collection: string;
	price: Price | null;
}

/**
 * Summary and price are looked up in the background once a book is added. `stale`: looked up
 * before the paper and pocket editions were, which only needs a catalogue lookup.
 */
export type DetailsState = 'missing' | 'pending' | 'done' | 'failed' | 'stale';

export const isLookingUp = (book: { details: DetailsState }) =>
	book.details === 'pending' || book.details === 'missing' || book.details === 'stale';

export interface Book extends CatalogBook {
	id: string;
	/** Short French overview, '' when unknown. */
	summary: string;
	edition: PaperEdition;
	price: Price | null;
	/** A paperback to order instead, null when none is known (or it's the edition itself). */
	pocket: PocketEdition | null;
	details: DetailsState;
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
	cart: 'Dans le panier',
	requested: 'Demandé au libraire',
	confirmed: 'Confirmé',
	owned: 'Possédé',
	postponed: 'Plus tard'
};

export const OWNED_VIA_LABEL: Record<OwnedVia, string> = {
	bookstore: 'Librairie locale',
	direct: 'Acheté directement',
	online: 'Service en ligne'
};

export const UNAVAILABLE_LABEL: Record<Exclude<PostponeKind, 'mine'>, string> = {
	out_of_print: 'Épuisé',
	not_accessible: 'Non accessible à cette librairie'
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
