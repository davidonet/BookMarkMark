import { collections } from './db';
import type { EditionLang, Settings } from '$lib/types';

export const parseEditionLang = (value: unknown): EditionLang =>
	value === 'fr' || value === 'en' || value === '' ? value : 'fr';

export async function getSettings(): Promise<Settings> {
	const { settings } = await collections();
	const doc = await settings.findOne({ _id: 'app' });
	return {
		bookstoreName: doc?.bookstoreName ?? '',
		bookstoreEmail: doc?.bookstoreEmail ?? '',
		myName: doc?.myName ?? '',
		emailLang: doc?.emailLang === 'fr' ? 'fr' : 'en',
		editionLang: parseEditionLang(doc?.editionLang)
	};
}

export async function saveSettings(patch: Partial<Settings>) {
	const { settings } = await collections();
	await settings.updateOne(
		{ _id: 'app' },
		{ $set: { ...patch, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
		{ upsert: true }
	);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
