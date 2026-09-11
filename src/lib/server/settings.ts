import { collections } from './db';
import type { Settings } from '$lib/types';

const DEFAULTS: Settings = { bookstoreName: '', bookstoreEmail: '', myName: '', emailLang: 'en' };

export async function getSettings(): Promise<Settings> {
	const { settings } = await collections();
	const doc = await settings.findOne({ _id: 'app' });
	return {
		bookstoreName: doc?.bookstoreName ?? DEFAULTS.bookstoreName,
		bookstoreEmail: doc?.bookstoreEmail ?? DEFAULTS.bookstoreEmail,
		myName: doc?.myName ?? DEFAULTS.myName,
		emailLang: doc?.emailLang === 'fr' ? 'fr' : 'en'
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
