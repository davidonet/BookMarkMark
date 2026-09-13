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

	// What the bookstore order should cost: the paperback when there's one (as in the email),
	// else the paper edition.
	const orderPrice = (b: (typeof data.books)[number]) =>
		b.pocket ? b.pocket.price : b.price?.kind === 'print' ? b.price : null;
	const priced = $derived(data.books.filter((b) => orderPrice(b)));
	const total = $derived(priced.reduce((sum, b) => sum + (orderPrice(b)?.amount ?? 0), 0));
</script>

<svelte:head>
	<title>Panier · BookMarkMark</title>
</svelte:head>

<RefreshWhilePending active={data.books.some(isLookingUp)} />
<PageHeader title="Panier" kicker="Étape 2 · Faites le tri" tone="violet">
	{#if data.books.length}
		<a href={resolve('/cart/email')} class="btn bg-orange"
			><Mail class="size-4" /> Email au libraire</a
		>
	{/if}
</PageHeader>

{#if data.books.length === 0}
	<Empty
		title="Panier vide"
		text="Les livres que vous ajoutez depuis la recherche atterrissent ici, prêts à être commandés à votre libraire."
	>
		<a href={resolve('/')} class="btn bg-orange">Trouver un livre</a>
	</Empty>
{:else}
	<p class="mb-5 text-ink/75">
		{plural(data.books.length, 'livre')} à demander à votre libraire. Déjà obtenu, ou pas maintenant ?
		Signalez-le.
	</p>

	<ul class="grid gap-4">
		{#each data.books as book (book.id)}
			<li animate:flip={{ duration: 250 }} out:fly={{ x: 80, duration: 200 }}>
				<BookCard {book}>
					{#snippet aside()}
						<form method="POST" action="?/remove" use:enhance={withToast('Retiré du panier')}>
							<input type="hidden" name="id" value={book.id} />
							<ConfirmButton label="Retirer du panier" />
						</form>
					{/snippet}
					{#snippet meta()}
						<span class="chip border-dashed bg-transparent">ajouté {ago(book.createdAt)}</span>
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
									<Check class="size-4" /> Possédé
								</button>
								<button
									type="button"
									class="btn btn-sm bg-violet-soft"
									onclick={() => (panel = { id: book.id, kind: 'later' })}
								>
									<Hourglass class="size-4" /> Plus tard
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
			<p class="text-xl font-extrabold uppercase">Prêt à commander ?</p>
			<p class="text-sm text-ink/75">
				Un email à votre libraire avec {data.books.length > 1
					? `ces ${data.books.length} livres`
					: 'ce livre'}.
			</p>
			{#if priced.length}
				<p class="mt-1 text-sm font-bold">
					≈ {formatPrice(total)}
					<span class="font-normal text-ink/70">
						{priced.length < data.books.length
							? `(prix connu pour ${priced.length} sur ${data.books.length})`
							: 'au prix public France'}
					</span>
				</p>
			{/if}
		</div>
		<a href={resolve('/cart/email')} class="btn btn-lg bg-orange"
			><Mail class="size-5" /> Préparer l'email</a
		>
	</div>
{/if}
