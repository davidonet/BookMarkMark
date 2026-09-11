<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Check from '@lucide/svelte/icons/check';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Mail from '@lucide/svelte/icons/mail';
	import BookCard from '$lib/components/BookCard.svelte';
	import ConfirmButton from '$lib/components/ConfirmButton.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import LaterForm from '$lib/components/LaterForm.svelte';
	import OwnedForm from '$lib/components/OwnedForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RefreshWhilePending from '$lib/components/RefreshWhilePending.svelte';
	import SourceEditor from '$lib/components/SourceEditor.svelte';
	import { withToast } from '$lib/enhance';
	import { ago, formatPrice, plural } from '$lib/format';
	import { isLookingUp } from '$lib/types';

	let { data } = $props();

	/** The one card whose "owned" or "later" form is open. */
	let panel = $state<{ id: string; kind: 'owned' | 'later' } | null>(null);

	// What the bookstore order should cost: paper editions with a known price.
	const priced = $derived(data.books.filter((b) => b.price?.kind === 'print'));
	const total = $derived(priced.reduce((sum, b) => sum + (b.price?.amount ?? 0), 0));
</script>

<svelte:head>
	<title>Cart · BookMarkMark</title>
</svelte:head>

<RefreshWhilePending active={data.books.some(isLookingUp)} />
<PageHeader title="Cart" kicker="Step 2 · Sort it out" tone="violet">
	{#if data.books.length}
		<a href={resolve('/cart/email')} class="btn bg-orange"
			><Mail class="size-4" /> Email bookstore</a
		>
	{/if}
</PageHeader>

{#if data.books.length === 0}
	<Empty
		title="Cart is empty"
		text="Books you add from the search land here, ready to be ordered from your bookstore."
	>
		<a href={resolve('/')} class="btn bg-orange">Find a book</a>
	</Empty>
{:else}
	<p class="mb-5 text-ink/75">
		{plural(data.books.length, 'book')} to ask your bookstore about. Already got one, or not now? Flag
		it.
	</p>

	<ul class="grid gap-4">
		{#each data.books as book (book.id)}
			<li animate:flip={{ duration: 250 }} out:fly={{ x: 80, duration: 200 }}>
				<BookCard {book}>
					{#snippet aside()}
						<form method="POST" action="?/remove" use:enhance={withToast('Removed from the cart')}>
							<input type="hidden" name="id" value={book.id} />
							<ConfirmButton label="Remove from cart" />
						</form>
					{/snippet}
					{#snippet meta()}
						<span class="chip border-dashed bg-transparent">added {ago(book.createdAt)}</span>
					{/snippet}

					<div class="grid gap-3">
						<SourceEditor id={book.id} source={book.source} options={data.sources} />
						{#if panel?.id === book.id && panel.kind === 'owned'}
							<OwnedForm id={book.id} oncancel={() => (panel = null)} />
						{:else if panel?.id === book.id && panel.kind === 'later'}
							<LaterForm id={book.id} reasons={data.reasons} oncancel={() => (panel = null)} />
						{:else}
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="btn btn-sm bg-teal"
									onclick={() => (panel = { id: book.id, kind: 'owned' })}
								>
									<Check class="size-4" /> Owned
								</button>
								<button
									type="button"
									class="btn btn-sm bg-violet-soft"
									onclick={() => (panel = { id: book.id, kind: 'later' })}
								>
									<Hourglass class="size-4" /> Later
								</button>
							</div>
						{/if}
					</div>
				</BookCard>
			</li>
		{/each}
	</ul>

	<div
		class="card mt-8 flex flex-col items-start justify-between gap-4 bg-orange-soft p-5 sm:flex-row sm:items-center"
	>
		<div>
			<p class="text-xl font-extrabold uppercase">Ready to order?</p>
			<p class="text-sm text-ink/75">
				One email to your bookstore with {data.books.length > 1
					? `these ${data.books.length} books`
					: 'this book'}.
			</p>
			{#if priced.length}
				<p class="mt-1 text-sm font-bold">
					≈ {formatPrice(total)}
					<span class="font-normal text-ink/70">
						{priced.length < data.books.length
							? `(price known for ${priced.length} of ${data.books.length})`
							: 'at the French retail price'}
					</span>
				</p>
			{/if}
		</div>
		<a href={resolve('/cart/email')} class="btn btn-lg bg-orange"
			><Mail class="size-5" /> Prepare email</a
		>
	</div>
{/if}
