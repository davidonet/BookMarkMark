<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import type { ActionResult } from '@sveltejs/kit';
	import Barcode from '@lucide/svelte/icons/barcode';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import BookCard from '$lib/components/BookCard.svelte';
	import ConfirmButton from '$lib/components/ConfirmButton.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RefreshWhilePending from '$lib/components/RefreshWhilePending.svelte';
	import { withToast } from '$lib/enhance';
	import { ago, plural } from '$lib/format';
	import { toast } from '$lib/toast.svelte';
	import { OWNED_VIA_LABEL, type OwnedVia, isLookingUp } from '$lib/types';

	let { data } = $props();

	let scanning = $state(false);

	async function handleScan(isbn: string) {
		const body = new FormData();
		body.set('isbn', isbn);
		const res = await fetch('?/scan', { method: 'POST', body });
		const result: ActionResult<{ already: boolean; title: string }, { message: string }> =
			deserialize(await res.text());

		if (result.type === 'success') {
			const { already, title } = result.data ?? { already: false, title: '' };
			toast(already ? `Déjà dans vos livres : ${title}` : `Ajouté à votre étagère : ${title} 📚`);
			await invalidateAll();
		} else if (result.type === 'failure') {
			toast(String(result.data?.message ?? "Ce livre n'a pas pu être ajouté."), 'error');
		} else if (result.type === 'error') {
			toast('Une erreur est survenue.', 'error');
		}
	}

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
	<title>Possédés · BookMarkMark</title>
</svelte:head>

<RefreshWhilePending active={data.books.some(isLookingUp)} />
<PageHeader title="Possédés" kicker="Votre étagère" tone="ink">
	<button type="button" class="btn bg-orange" onclick={() => (scanning = true)}>
		<Barcode class="size-4" /> Scanner un livre
	</button>
</PageHeader>

{#if scanning}
	<BarcodeScanner onscan={handleScan} onclose={() => (scanning = false)} />
{/if}

{#if data.books.length === 0}
	<Empty
		title="Étagère vide"
		text="Les livres que vous obtenez, chez votre libraire, directement ou en ligne, sont listés ici. Ou scannez un livre que vous avez déjà."
	/>
{:else}
	<div class="mb-4 flex flex-wrap gap-2">
		<span class="chip bg-ink text-cream">{plural(data.books.length, 'livre')}</span>
		{#each viaCounts as c (c.via)}
			<span class="chip">{c.label} · {c.n}</span>
		{/each}
	</div>

	<input
		type="search"
		bind:value={filter}
		class="input mb-5"
		placeholder="Filtrer par titre, auteur, source…"
		aria-label="Filtrer les livres possédés"
	/>

	<ul class="grid gap-3">
		{#each shown as book (book.id)}
			<li animate:flip={{ duration: 250 }} out:fly={{ x: 80, duration: 200 }}>
				<BookCard {book}>
					{#snippet aside()}
						<form method="POST" action="?/remove" use:enhance={withToast('Supprimé')}>
							<input type="hidden" name="id" value={book.id} />
							<ConfirmButton label="Supprimer de BookMarkMark" />
						</form>
					{/snippet}
					{#snippet meta()}
						{#if book.owned}
							<span class="chip bg-teal">{OWNED_VIA_LABEL[book.owned.via]}</span>
							<span class="chip border-dashed bg-transparent">obtenu {ago(book.owned.at)}</span>
						{/if}
						{#if book.source}<span class="chip">entendu via {book.source}</span>{/if}
					{/snippet}
					{#if book.owned?.note}
						<p class="mb-2 text-sm text-ink/80 italic">"{book.owned.note}"</p>
					{/if}
					<form
						method="POST"
						action="?/backToCart"
						use:enhance={withToast('De retour dans le panier')}
					>
						<input type="hidden" name="id" value={book.id} />
						<button class="btn btn-sm btn-ghost -ml-2"
							><Undo2 class="size-4" /> Retour au panier</button
						>
					</form>
				</BookCard>
			</li>
		{/each}
	</ul>
	{#if !shown.length}
		<p class="mt-6 text-center text-ink/60">Aucun résultat pour "{filter}".</p>
	{/if}
{/if}
