<script lang="ts">
	import { enhance } from '$app/forms';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Check from '@lucide/svelte/icons/check';
	import ShoppingBasket from '@lucide/svelte/icons/shopping-basket';
	import BookCard from '$lib/components/BookCard.svelte';
	import ConfirmButton from '$lib/components/ConfirmButton.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import OwnedForm from '$lib/components/OwnedForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { withToast } from '$lib/enhance';
	import { ago } from '$lib/format';
	import type { PostponeKind } from '$lib/types';

	let { data } = $props();

	type Filter = 'all' | PostponeKind;
	const FILTERS: { value: Filter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'mine', label: 'My reasons' },
		{ value: 'out_of_print', label: 'Out of print' },
		{ value: 'not_accessible', label: 'Not at my bookstore' }
	];
	const KIND_TONE: Record<PostponeKind, string> = {
		mine: 'bg-violet-soft',
		out_of_print: 'bg-orange-soft',
		not_accessible: 'bg-orange-soft'
	};

	let filter = $state<Filter>('all');
	let ownedFor = $state<string | null>(null);

	const countOf = (f: Filter) =>
		f === 'all' ? data.books.length : data.books.filter((b) => b.postponed?.kind === f).length;
	const shown = $derived(
		filter === 'all' ? data.books : data.books.filter((b) => b.postponed?.kind === filter)
	);
</script>

<svelte:head>
	<title>Later · BookMarkMark</title>
</svelte:head>

<PageHeader title="Later" kicker="Not now, not never" tone="lilac" />

{#if data.books.length === 0}
	<Empty
		title="Nothing postponed"
		text="Books you put aside, or that your bookstore could not get, wait here with their reason."
	/>
{:else}
	<div class="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by reason">
		{#each FILTERS as f (f.value)}
			{@const n = countOf(f.value)}
			{#if f.value === 'all' || n > 0}
				<button
					type="button"
					aria-pressed={filter === f.value}
					class={['btn btn-sm', filter === f.value && 'bg-ink text-cream']}
					onclick={() => (filter = f.value)}
				>
					{f.label} · {n}
				</button>
			{/if}
		{/each}
	</div>

	<ul class="grid gap-3">
		{#each shown as book (book.id)}
			<li animate:flip={{ duration: 250 }} out:fly={{ x: 80, duration: 200 }}>
				<BookCard {book}>
					{#snippet aside()}
						<form method="POST" action="?/remove" use:enhance={withToast('Removed')}>
							<input type="hidden" name="id" value={book.id} />
							<ConfirmButton label="Delete from BookMarkMark" />
						</form>
					{/snippet}
					{#snippet meta()}
						{#if book.postponed}
							<span class={['chip', KIND_TONE[book.postponed.kind]]}>{book.postponed.reason}</span>
							<span class="chip border-dashed bg-transparent">since {ago(book.postponed.at)}</span>
						{/if}
						{#if book.source}<span class="chip">heard via {book.source}</span>{/if}
					{/snippet}

					{#if book.postponed?.note}
						<p class="mb-3 text-sm text-ink/80 italic">“{book.postponed.note}”</p>
					{/if}
					{#if ownedFor === book.id}
						<OwnedForm id={book.id} oncancel={() => (ownedFor = null)} />
					{:else}
						<div class="flex flex-wrap gap-2">
							<form
								method="POST"
								action="?/backToCart"
								use:enhance={withToast('Back in the cart 🛒')}
							>
								<input type="hidden" name="id" value={book.id} />
								<button class="btn btn-sm bg-violet"
									><ShoppingBasket class="size-4" /> Back to cart</button
								>
							</form>
							<button type="button" class="btn btn-sm bg-teal" onclick={() => (ownedFor = book.id)}>
								<Check class="size-4" /> Got it elsewhere
							</button>
						</div>
					{/if}
				</BookCard>
			</li>
		{/each}
	</ul>
{/if}
