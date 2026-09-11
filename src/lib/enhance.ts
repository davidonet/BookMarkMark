import type { SubmitFunction } from '@sveltejs/kit';
import { toast } from './toast.svelte';

type Message = string | ((data: Record<string, unknown> | undefined) => string | undefined);

/** Flags a form as in-flight (styled in layout.css); returns the function that clears it. */
export function markPending(form: HTMLFormElement) {
	form.dataset.pending = '';
	return () => delete form.dataset.pending;
}

/**
 * `use:enhance` callback: submit, refresh the page data, then show a toast.
 * Unexpected errors become a toast too instead of navigating away to the error page.
 */
export function withToast(
	message?: Message,
	options: { reset?: boolean; after?: () => void } = {}
): SubmitFunction {
	return ({ formElement }) => {
		const done = markPending(formElement);
		return async ({ result, update }) => {
			try {
				if (result.type === 'error') {
					toast(result.error?.message ?? 'Something went wrong.', 'error');
					return;
				}
				await update({ reset: options.reset ?? false });
				if (result.type === 'failure') {
					toast(String(result.data?.message ?? 'That did not work.'), 'error');
					return;
				}
				const text =
					typeof message === 'function'
						? message(result.type === 'success' ? result.data : undefined)
						: message;
				if (text) toast(text);
				options.after?.();
			} finally {
				done();
			}
		};
	};
}
