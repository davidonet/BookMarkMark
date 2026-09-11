<script lang="ts">
	import type { Snippet } from 'svelte';
	import BookCover from './BookCover.svelte';
	import { authorsLine } from '$lib/format';

	interface Props {
		book: {
			olKey: string;
			title: string;
			subtitle?: string;
			authors: string[];
			year: number | null;
			coverId: number | null;
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
</script>

<article class={['card flex gap-3 p-3 sm:gap-4 sm:p-4', className]}>
	<a
		href={`https://openlibrary.org${book.olKey}`}
		target="_blank"
		rel="noopener noreferrer"
		class="self-start"
		aria-label={`${book.title} on Open Library`}
	>
		<BookCover coverId={book.coverId} title={book.title} class="w-16 sm:w-20" />
	</a>
	<div class="min-w-0 flex-1">
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<h3 class="text-lg leading-tight font-bold">{book.title}</h3>
				{#if book.subtitle}
					<p class="mt-0.5 text-sm leading-snug text-ink/65">{book.subtitle}</p>
				{/if}
				<p class="mt-1 text-sm font-medium">
					{authorsLine(book.authors)}{#if book.year}<span class="text-ink/60"
							>{` · ${book.year}`}</span
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
