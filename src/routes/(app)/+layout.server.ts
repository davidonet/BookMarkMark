import type { LayoutServerLoad } from './$types';
import { countByStatus } from '$lib/server/books';

export const load: LayoutServerLoad = async () => ({ counts: await countByStatus() });
