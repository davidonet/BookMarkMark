import { env } from '$env/dynamic/private';
import { POCKET_NAME, toIsbn10, validIsbn13 } from './bnf';
import type { Price } from '$lib/types';

/** Writes well in French and says nothing rather than invent; any OpenRouter model id works. */
const DEFAULT_MODEL = 'mistralai/mistral-small-3.2-24b-instruct';

const INSTRUCTIONS = `Tu aides un lecteur à se souvenir des livres qu'on lui a conseillés.
Pour le livre indiqué, écris un petit survol en français : 2 ou 3 phrases (60 mots au plus), sans divulgâcher, qui disent de quoi parle le livre et de quel genre il est. Style simple et vivant.
Appuie-toi sur les résultats web et sur la description fournie. N'invente rien : si tu ne trouves rien de fiable sur CE livre précis, laisse le survol vide.
Donne aussi le prix public en France (prix unique du livre, TTC, en euros) de l'édition papier : celle de l'ISBN indiqué si c'est un livre papier, sinon l'édition papier courante du même éditeur ; null si aucune source fiable ne l'indique.
Réponds uniquement avec ce JSON : {"summary": string, "price_eur": number | null, "price_source": string | null}`;

const POCKET_INSTRUCTIONS = `Tu cherches l'édition de poche française d'un livre (Folio, Le Livre de Poche, Pocket, J'ai lu, Points, 10/18, Babel, etc.).
Appuie-toi uniquement sur les résultats web. N'invente rien : si aucune page ne donne l'ISBN d'une édition de poche de CE livre, réponds null.
Réponds uniquement avec ce JSON : {"isbn": string | null, "collection": string | null, "price_eur": number | null, "source": string | null}`;

export interface Survey {
	summary: string;
	price: Price | null;
	sources: string[];
	model: string;
}

export interface WebPocket {
	isbn: string;
	collection: string;
	price: Price | null;
}

interface BookFacts {
	title: string;
	subtitle: string;
	authors: string[];
	publisher: string;
	year: number | null;
	isbn: string | null;
}

function describe(book: BookFacts, description: string) {
	const edition = [book.publisher, book.year, book.isbn && `ISBN ${book.isbn}`].filter(Boolean);
	return [
		`Livre : « ${book.title}${book.subtitle ? ` : ${book.subtitle}` : ''} » — ${book.authors.join(', ') || 'auteur inconnu'}`,
		edition.length ? `Édition : ${edition.join(' · ')}` : '',
		description ? `Description de l'éditeur : ${description.slice(0, 1500)}` : ''
	]
		.filter(Boolean)
		.join('\n');
}

const hostname = (value: unknown) => {
	try {
		return new URL(
			String(value).includes('://') ? String(value) : `https://${value}`
		).hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
};

/** A French retail price given by the model, when plausible. */
function webPrice(value: unknown, source: unknown): Price | null {
	const amount = Number(value);
	return amount > 0 && amount < 1000
		? {
				amount: Math.round(amount * 100) / 100,
				currency: 'EUR',
				kind: 'print',
				source: hostname(source) ?? 'web'
			}
		: null;
}

/** A page the model read: its URL, and its URL, title and excerpt as one text. */
interface Citation {
	url: string;
	text: string;
}

/** One completion grounded by a web search: the JSON answer, and the pages it was written from. */
async function askWithWeb(
	system: string,
	user: string,
	options: { maxTokens: number; temperature: number }
) {
	const model = env.SUMMARY_MODEL || DEFAULT_MODEL;
	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'X-Title': 'BookMarkMark'
		},
		body: JSON.stringify({
			model,
			plugins: [{ id: 'web', engine: 'exa', max_results: 5 }],
			temperature: options.temperature,
			max_tokens: options.maxTokens,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			]
		}),
		signal: AbortSignal.timeout(60_000)
	});
	if (!res.ok)
		throw new Error(`OpenRouter answered ${res.status}: ${(await res.text()).slice(0, 200)}`);

	const json = await res.json();
	const message = json.choices?.[0]?.message ?? {};
	const answer: Record<string, unknown> = JSON.parse(
		/\{[\s\S]*\}/.exec(String(message.content ?? ''))?.[0] ?? '{}'
	);
	const citations: Citation[] = (message.annotations ?? [])
		.map(
			(a: { url_citation?: { url?: unknown; title?: unknown; content?: unknown } }) =>
				a.url_citation
		)
		.filter(
			(
				c: { url?: unknown } | undefined
			): c is { url: string; title?: unknown; content?: unknown } =>
				typeof c?.url === 'string' && c.url.startsWith('https://')
		)
		.map((c: { url: string; title?: unknown; content?: unknown }) => ({
			url: c.url,
			text: [c.url, c.title, c.content].filter((part) => typeof part === 'string').join('\n')
		}));
	return { answer, citations, model: String(json.model ?? model) };
}

/** A short French overview (and the French price when found), grounded by a web search. */
export async function frenchSurvey(book: BookFacts, description = ''): Promise<Survey | null> {
	if (!env.OPENROUTER_API_KEY) return null;
	const { answer, citations, model } = await askWithWeb(INSTRUCTIONS, describe(book, description), {
		maxTokens: 400,
		temperature: 0.2
	});
	return {
		summary: typeof answer.summary === 'string' ? answer.summary.trim().slice(0, 600) : '',
		price: webPrice(answer.price_eur, answer.price_source),
		sources: citations.map((c) => c.url).slice(0, 5),
		model
	};
}

/** Lower-case letters and digits only: "L'Anomalie" → "lanomalie". */
const squash = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * The ISBN of the book's paperback, as found on bookstore sites. Only trusted when a page the
 * model read shows that very ISBN, next to the title and to "poche" or a pocket collection.
 */
export async function pocketOnWeb(book: {
	title: string;
	authors: string[];
}): Promise<WebPocket | null> {
	if (!env.OPENROUTER_API_KEY) return null;
	const { answer, citations } = await askWithWeb(
		POCKET_INSTRUCTIONS,
		`${book.title} — ${book.authors.join(', ')} : édition de poche, ISBN`,
		{ maxTokens: 200, temperature: 0 }
	);
	const isbn = typeof answer.isbn === 'string' ? validIsbn13(answer.isbn) : null;
	if (!isbn) return null;

	const forms = [isbn, toIsbn10(isbn)].filter((form): form is string => !!form);
	const words = book.title
		.split(/[^\p{L}\p{N}]+/u)
		.map(squash)
		.filter((word) => word.length > 2);
	const shown = citations.find(({ text }) => {
		const digits = text.replace(/(?<=\d)[-\s.](?=\d)/g, '');
		const letters = squash(text);
		return (
			forms.some((form) => digits.includes(form)) &&
			words.every((word) => letters.includes(word)) &&
			POCKET_NAME.test(text)
		);
	});
	if (!shown) return null;
	return {
		isbn,
		collection: typeof answer.collection === 'string' ? answer.collection.trim().slice(0, 80) : '',
		price: webPrice(answer.price_eur, answer.source ?? shown.url)
	};
}
