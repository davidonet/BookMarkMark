<script lang="ts">
	import { enhance } from '$app/forms';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import BookCard from '$lib/components/BookCard.svelte';
	import ConfirmButton from '$lib/components/ConfirmButton.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RefreshWhilePending from '$lib/components/RefreshWhilePending.svelte';
	import { withToast } from '$lib/enhance';
	import { ago, plural } from '$lib/format';
	import { OWNED_VIA_LABEL, type OwnedVia, isLookingUp } from '$lib/types';

	let { data } = $props();

	let filter = $state('');
	const needle = $derived(filter.trim().toLocaleLowerCase());
	const shown = $derived(
		needle
			? data.books.filter((b) =>
					[b.title, b.subtitle, ...b.authors, b.source, b.owned?.note ?? '']
						.join(' ')
						.toLocaleLowerCase()
						.includes(needle)
				)
			: data.books
	);
	const viaCounts = $derived(
		(Object.keys(OWNED_VIA_LABEL) as OwnedVia[])
			.map((via) => ({
				via,
				label: OWNED_VIA_LABEL[via],
				n: data.books.filter((b) => b.owned?.via === via).length
			}))
			.filter((c) => c.n > 0)
	);
</script>

<svelte:head>
	<title>Owned · BookMarkMark</title>
</svelte:head>

<RefreshWhilePending active={data.books.some(isLookingUp)} />
<PageHeader title="Owned" kicker="Your shelf" tone="ink" />

{#if data.books.length === 0}
	<Empty
		title="Shelf is empty"
		text="Books you get, from your bookstore, directly or online, are listed here."
	/>
{:else}
	<div class="mb-4 flex flex-wrap gap-2">
		<span class="chip bg-ink text-cream">{plural(data.books.length, 'book')}</span>
		{#each viaCounts as c (c.via)}
			<span class="chip">{c.label} · {c.n}</span>
		{/each}
	</div>

	<input
		type="search"
		bind:value={filter}
		class="input mb-5"
		placeholder="Filter by title, author, source…"
		aria-label="Filter owned books"
	/>

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
						{#if book.owned}
							<span class="chip bg-teal">{OWNED_VIA_LABEL[book.owned.via]}</span>
							<span class="chip border-dashed bg-transparent">got it {ago(book.owned.at)}</span>
						{/if}
						{#if book.source}<span class="chip">heard via {book.source}</span>{/if}
					{/snippet}
					{#if book.owned?.note}
						<p class="mb-2 text-sm text-ink/80 italic">“{book.owned.note}”</p>
					{/if}
					<form method="POST" action="?/backToCart" use:enhance={withToast('Back in the cart')}>
						<input type="hidden" name="id" value={book.id} />
						<button class="btn btn-sm btn-ghost -ml-2"><Undo2 class="size-4" /> Back to cart</button
						>
					</form>
				</BookCard>
			</li>
		{/each}
	</ul>
	{#if !shown.length}
		<p class="mt-6 text-center text-ink/60">No match for “{filter}”.</p>
	{/if}
{/if}
