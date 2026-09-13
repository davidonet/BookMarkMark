<script lang="ts">
	import type { Snippet } from 'svelte';
	import BookCover from './BookCover.svelte';
	import { authorsLine, formatPrice } from '$lib/format';
	import {
		bookLink,
		type DetailsState,
		type PaperEdition,
		type PocketEdition,
		type Price
	} from '$lib/types';

	interface Props {
		book: {
			ref: string;
			title: string;
			subtitle?: string;
			authors: string[];
			year: number | null;
			cover: string | null;
			publisher?: string;
			/** The paper edition to order, when known (lists). */
			edition?: PaperEdition;
			/** Its paperback (poche), when there is one. */
			pocket?: PocketEdition | null;
			/** French overview and price, looked up in the background. */
			summary?: string;
			price?: Price | null;
			details?: DetailsState;
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
	const shown = $derived(
		book.edition ?? { publisher: book.publisher ?? '', year: book.year, isbn: null }
	);
	const edition = $derived([shown.publisher, shown.year].filter(Boolean).join(' · '));
	const pocket = $derived(
		book.pocket &&
			[book.pocket.collection || book.pocket.publisher, book.pocket.year]
				.filter(Boolean)
				.join(' · ')
	);
	const looking = $derived(
		!book.summary && (book.details === 'pending' || book.details === 'missing')
	);
	let expanded = $state(false);
	let clamped = $state(false);

	/** Whether the 3-line clamp actually hides text (depends on the screen width). */
	function watchClamp(paragraph: HTMLElement) {
		const observer = new ResizeObserver(() => {
			clamped = paragraph.scrollHeight > paragraph.clientHeight + 1;
		});
		observer.observe(paragraph);
		return () => observer.disconnect();
	}
</script>

<article class={['card p-3 sm:p-4', className]}>
	<div class="flex gap-3 sm:gap-4">
		{#if link}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- external catalog page -->
			<a
				href={link.href}
				target="_blank"
				rel="noopener noreferrer"
				class="self-start"
				aria-label={`${book.title} sur ${link.site}`}
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
						{authorsLine(book.authors)}{#if edition}<span class="text-ink/60"
								>{` · ${edition}`}</span
							>{/if}
					</p>
					{#if shown.isbn}
						<p class="mt-0.5 font-mono text-xs text-ink/60 select-all">ISBN {shown.isbn}</p>
					{/if}
					{#if book.pocket}
						<p class="mt-1 text-xs text-ink/60">
							<span class="font-bold text-ink uppercase">Poche</span>
							{pocket ? `${pocket} · ` : ''}<span class="font-mono whitespace-nowrap select-all"
								>ISBN {book.pocket.isbn}</span
							>
						</p>
					{/if}
				</div>
				{@render aside?.()}
			</div>
			{#if meta || book.price || book.pocket?.price}
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#if book.price}
						<span
							class="chip bg-cream-deep"
							title={`${book.price.kind === 'ebook' ? 'Prix ebook' : 'Prix public France'} · ${book.price.source}`}
						>
							{formatPrice(book.price.amount)}{#if book.price.kind === 'ebook'}<span
									class="font-medium">&nbsp;ebook</span
								>{/if}
						</span>
					{/if}
					{#if book.pocket?.price}
						<span
							class="chip bg-teal-soft"
							title={`Prix public France du poche · ${book.pocket.price.source}`}
						>
							{formatPrice(book.pocket.price.amount)}<span class="font-medium">&nbsp;poche</span>
						</span>
					{/if}
					{@render meta?.()}
				</div>
			{/if}
		</div>
	</div>

	<!-- Full width on phones, aligned with the text column on larger screens. -->
	{#if book.summary}
		<div class="mt-3 sm:pl-24">
			<p
				lang="fr"
				class={['text-sm leading-relaxed text-ink/85', !expanded && 'line-clamp-3']}
				{@attach watchClamp}
			>
				{book.summary}
			</p>
			{#if clamped || expanded}
				<button
					type="button"
					class="mt-0.5 cursor-pointer text-xs font-bold underline decoration-2 underline-offset-2"
					aria-expanded={expanded}
					onclick={() => (expanded = !expanded)}
				>
					{expanded ? 'moins' : 'plus'}
				</button>
			{/if}
		</div>
	{:else if looking}
		<p class="mt-3 animate-pulse text-sm text-ink/45 italic sm:pl-24">Survol en cours…</p>
	{/if}
	{#if children}
		<div class="mt-3 sm:pl-24">{@render children()}</div>
	{/if}
</article>
