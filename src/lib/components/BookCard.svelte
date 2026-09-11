<script lang="ts">
	import type { Snippet } from 'svelte';
	import BookCover from './BookCover.svelte';
	import { authorsLine } from '$lib/format';
	import { bookLink } from '$lib/types';

	interface Props {
		book: {
			ref: string;
			title: string;
			subtitle?: string;
			authors: string[];
			year: number | null;
			cover: string | null;
			publisher?: string;
		};
		/** Badges under the title. */
		meta?: Snippet;
		/** Top-right corner (e.g. remove button). */
		aside?: Snippet;
		/** Actions and forms. */
		children?: Snippet;
		class?: string;
	}

	let { book, meta, aside, children, class: className = '' }: Props = $props();

	const link = $derived(bookLink(book.ref));
	const details = $derived([book.publisher, book.year].filter(Boolean).join(' · '));
</script>

<article class={['card flex gap-3 p-3 sm:gap-4 sm:p-4', className]}>
	{#if link}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external catalog page -->
		<a
			href={link.href}
			target="_blank"
			rel="noopener noreferrer"
			class="self-start"
			aria-label={`${book.title} on ${link.site}`}
		>
			<BookCover cover={book.cover} title={book.title} class="w-16 sm:w-20" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else}
		<BookCover cover={book.cover} title={book.title} class="w-16 self-start sm:w-20" />
	{/if}
	<div class="min-w-0 flex-1">
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<h3 class="text-lg leading-tight font-bold">{book.title}</h3>
				{#if book.subtitle}
					<p class="mt-0.5 text-sm leading-snug text-ink/65">{book.subtitle}</p>
				{/if}
				<p class="mt-1 text-sm font-medium">
					{authorsLine(book.authors)}{#if details}<span class="text-ink/60">{` · ${details}`}</span
						>{/if}
				</p>
			</div>
			{@render aside?.()}
		</div>
		{#if meta}
			<div class="mt-2 flex flex-wrap gap-1.5">{@render meta()}</div>
		{/if}
		{#if children}
			<div class="mt-3">{@render children()}</div>
		{/if}
	</div>
</article>
