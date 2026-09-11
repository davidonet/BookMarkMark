import { env } from '$env/dynamic/private';
import type { Price } from '$lib/types';

/** Writes well in French and says nothing rather than invent; any OpenRouter model id works. */
const DEFAULT_MODEL = 'mistralai/mistral-small-3.2-24b-instruct';

const INSTRUCTIONS = `Tu aides un lecteur à se souvenir des livres qu'on lui a conseillés.
Pour le livre indiqué, écris un petit survol en français : 2 ou 3 phrases (60 mots au plus), sans divulgâcher, qui disent de quoi parle le livre et de quel genre il est. Style simple et vivant.
Appuie-toi sur les résultats web et sur la description fournie. N'invente rien : si tu ne trouves rien de fiable sur CE livre précis, laisse le survol vide.
Donne aussi le prix public en France (prix unique du livre, TTC, en euros) de l'édition papier : celle de l'ISBN indiqué si c'est un livre papier, sinon l'édition papier courante du même éditeur ; null si aucune source fiable ne l'indique.
Réponds uniquement avec ce JSON : {"summary": string, "price_eur": number | null, "price_source": string | null}`;

export interface Survey {
	summary: string;
	price: Price | null;
	sources: string[];
	model: string;
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

/** A short French overview (and the French price when found), grounded by a web search. */
export async function frenchSurvey(book: BookFacts, description = ''): Promise<Survey | null> {
	if (!env.OPENROUTER_API_KEY) return null;
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
			temperature: 0.2,
			max_tokens: 400,
			messages: [
				{ role: 'system', content: INSTRUCTIONS },
				{ role: 'user', content: describe(book, description) }
			]
		}),
		signal: AbortSignal.timeout(60_000)
	});
	if (!res.ok)
		throw new Error(`OpenRouter answered ${res.status}: ${(await res.text()).slice(0, 200)}`);

	const json = await res.json();
	const message = json.choices?.[0]?.message ?? {};
	const answer = JSON.parse(/\{[\s\S]*\}/.exec(String(message.content ?? ''))?.[0] ?? '{}');
	const sources: string[] = (message.annotations ?? [])
		.map((a: { url_citation?: { url?: string } }) => a.url_citation?.url)
		.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('https://'))
		.slice(0, 5);

	const amount = Number(answer.price_eur);
	return {
		summary: typeof answer.summary === 'string' ? answer.summary.trim().slice(0, 600) : '',
		price:
			amount > 0 && amount < 1000
				? {
						amount: Math.round(amount * 100) / 100,
						currency: 'EUR',
						kind: 'print',
						source: hostname(answer.price_source) ?? 'web'
					}
				: null,
		sources,
		model: json.model ?? model
	};
}
