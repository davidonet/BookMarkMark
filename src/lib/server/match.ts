const normalize = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{M}/gu, '') // accents
		.replace(/\(.*?\)|\[.*?\]/g, ' ') // "(Folio)", "[Édition 2020]"
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

/**
 * "le petit prince|antoine de saint exupery": the same book whatever the edition or catalog,
 * so a book heard about twice is not added twice.
 */
export const matchKey = (title: string, authors: string[]) =>
	`${normalize(title)}|${normalize(authors[0] ?? '')}`;
