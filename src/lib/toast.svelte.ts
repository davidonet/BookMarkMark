export type ToastTone = 'ok' | 'error';

export interface ToastItem {
	id: number;
	message: string;
	tone: ToastTone;
}

// Only ever mutated from browser event handlers, so it never leaks between SSR requests.
export const toasts: ToastItem[] = $state([]);
let seq = 0;

export function toast(message: string, tone: ToastTone = 'ok') {
	const id = ++seq;
	toasts.push({ id, message, tone });
	setTimeout(() => dismiss(id), tone === 'error' ? 5000 : 2600);
}

export function dismiss(id: number) {
	const index = toasts.findIndex((t) => t.id === id);
	if (index !== -1) toasts.splice(index, 1);
}
