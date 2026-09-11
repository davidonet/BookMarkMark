export function authorsLine(authors: string[]): string {
	if (!authors.length) return 'Unknown author';
	if (authors.length <= 2) return authors.join(' & ');
	return `${authors[0]}, ${authors[1]} +${authors.length - 2}`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000],
	['month', 2_592_000],
	['week', 604_800],
	['day', 86_400],
	['hour', 3_600],
	['minute', 60]
];

/** "3 days ago", "last week"… timezone-independent, so server and browser agree. */
export function ago(date: Date | string | null | undefined): string {
	if (!date) return '';
	const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
	}
	return 'just now';
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** "19,00 €" */
export const formatPrice = (amount: number) => euros.format(amount);

export const plural = (n: number, word: string, many = `${word}s`) =>
	`${n} ${n === 1 ? word : many}`;
