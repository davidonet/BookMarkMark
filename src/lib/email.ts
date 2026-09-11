import type { EmailLang, PaperEdition } from './types';

interface EmailInput {
	books: {
		title: string;
		authors: string[];
		edition: PaperEdition;
		/** Set to order the paperback instead. */
		pocket?: { isbn: string; publisher: string; collection: string; year: number | null } | null;
	}[];
	lang: EmailLang;
	myName: string;
	bookstoreName: string;
}

const NBSP = '\u00a0';

const COPY = {
	en: {
		subject: (n: number) => `Book order: ${n} title${n > 1 ? 's' : ''}`,
		hello: (shop: string) => (shop ? `Hello ${shop},` : 'Hello,'),
		intro: (n: number) =>
			n > 1 ? "I'd like to order the following books:" : "I'd like to order the following book:",
		ask: (n: number) =>
			n > 1
				? 'Could you let me know which ones you can get, and roughly when?'
				: 'Could you let me know if you can get it, and roughly when?',
		thanks: 'Many thanks!',
		pocket: (name: string) => (/poche|pocket/i.test(name) ? name : `${name} paperback`.trim())
	},
	fr: {
		subject: (n: number) => `Commande de livres : ${n} titre${n > 1 ? 's' : ''}`,
		hello: (shop: string) => (shop ? `Bonjour ${shop},` : 'Bonjour,'),
		intro: (n: number) =>
			n > 1
				? `Je souhaiterais commander les livres suivants${NBSP}:`
				: `Je souhaiterais commander le livre suivant${NBSP}:`,
		ask: (n: number) =>
			n > 1
				? `Pourriez-vous me dire lesquels vous pouvez obtenir, et dans quels délais${NBSP}?`
				: `Pourriez-vous me dire si vous pouvez l’obtenir, et dans quel délai${NBSP}?`,
		thanks: `Merci beaucoup${NBSP}!`,
		pocket: (name: string) => (/poche|pocket/i.test(name) ? name : `poche ${name}`.trim())
	}
} satisfies Record<EmailLang, unknown>;

/** Numbered list so the bookstore can answer "1 ok, 2 out of print…". */
export function buildEmail({ books, lang, myName, bookstoreName }: EmailInput) {
	const copy = COPY[lang];
	const n = books.length;
	// Publisher (or pocket collection), year and ISBN pin the paper edition to order.
	const lines = books.map((b, i) => {
		const { year, isbn } = b.pocket ?? b.edition;
		const publisher = b.pocket
			? copy.pocket(b.pocket.collection || b.pocket.publisher)
			: b.edition.publisher;
		const edition = [publisher, year, isbn && `ISBN ${isbn}`].filter(Boolean).join(', ');
		const authors = b.authors.length ? ` — ${b.authors.join(', ')}` : '';
		return `${i + 1}. ${b.title}${authors}${edition ? ` (${edition})` : ''}`;
	});
	const body = [
		copy.hello(bookstoreName.trim()),
		'',
		copy.intro(n),
		'',
		...lines,
		'',
		copy.ask(n),
		'',
		copy.thanks,
		myName.trim()
	]
		.join('\n')
		.trimEnd();
	return { subject: copy.subject(n), body };
}

export function mailtoHref(to: string, subject: string, body: string) {
	const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
	return `mailto:${to.trim()}?subject=${enc(subject)}&body=${enc(body)}`;
}
