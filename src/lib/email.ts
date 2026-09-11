import type { EmailLang } from './types';

interface EmailInput {
	books: { title: string; authors: string[] }[];
	lang: EmailLang;
	myName: string;
	bookstoreName: string;
}

const NBSP = ' ';

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
		thanks: 'Many thanks!'
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
		thanks: `Merci beaucoup${NBSP}!`
	}
} satisfies Record<EmailLang, unknown>;

/** Numbered list so the bookstore can answer "1 ok, 2 out of print…". */
export function buildEmail({ books, lang, myName, bookstoreName }: EmailInput) {
	const copy = COPY[lang];
	const n = books.length;
	const lines = books.map(
		(b, i) => `${i + 1}. ${b.title}${b.authors.length ? ` — ${b.authors.join(', ')}` : ''}`
	);
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
