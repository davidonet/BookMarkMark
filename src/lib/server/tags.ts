import { collections } from './db';
import type { TagKind } from '$lib/types';

export const cleanText = (raw: string, max = 60) => raw.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Remembers a free-text value so it shows up in the dropdown next time.
 * Returns the canonical spelling (the first one ever typed wins: "podcast" → "Podcast").
 */
export async function rememberTag(kind: TagKind, raw: string): Promise<string> {
	const name = cleanText(raw);
	if (!name) return '';
	const { tags } = await collections();
	const now = new Date();
	const doc = await tags.findOneAndUpdate(
		{ kind, key: name.toLocaleLowerCase() },
		{ $setOnInsert: { name, createdAt: now }, $set: { lastUsedAt: now }, $inc: { uses: 1 } },
		{ upsert: true, returnDocument: 'after' }
	);
	return doc?.name ?? name;
}

/** Most used first. */
export async function listTags(kind: TagKind): Promise<string[]> {
	const { tags } = await collections();
	const docs = await tags
		.find({ kind }, { projection: { name: 1 } })
		.sort({ uses: -1, lastUsedAt: -1 })
		.limit(80)
		.toArray();
	return docs.map((d) => d.name);
}

export async function forgetTag(kind: TagKind, name: string) {
	const { tags } = await collections();
	await tags.deleteOne({ kind, key: cleanText(name).toLocaleLowerCase() });
}
