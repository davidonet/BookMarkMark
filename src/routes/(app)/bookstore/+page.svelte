<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import X from '@lucide/svelte/icons/x';
	import BookCard from '$lib/components/BookCard.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RefreshWhilePending from '$lib/components/RefreshWhilePending.svelte';
	import UnavailableForm from '$lib/components/UnavailableForm.svelte';
	import { withToast } from '$lib/enhance';
	import { ago, plural } from '$lib/format';
	import { isLookingUp } from '$lib/types';

	let { data } = $props();

	let unavailableFor = $state<string | null>(null);
	const nothing = $derived(!data.board.waiting.length && !data.board.confirmed.length);
</script>

<svelte:head>
	<title>Libraire · BookMarkMark</title>
</svelte:head>

<RefreshWhilePending
	active={[...data.board.waiting.flatMap((g) => g.books), ...data.board.confirmed].some(
		isLookingUp
	)}
/>
<PageHeader title="Libraire" kicker="Étape 4 · Notez la réponse" tone="teal" />

{#if nothing}
	<Empty
		title="Rien en attente"
		text="Une fois l'email envoyé à votre libraire depuis le panier, les livres attendent ici leur réponse."
	>
		<a href={resolve('/cart')} class="btn bg-violet">Aller au panier</a>
	</Empty>
{/if}

{#each data.board.waiting as group (group.id)}
	<section class="mb-10" aria-label={`Demandé ${ago(group.createdAt)}`}>
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="text-xl leading-tight font-extrabold uppercase">
					Demandé {ago(group.createdAt)}
				</h2>
				<p class="text-sm text-ink/70">
					{plural(group.books.length, 'livre')} en attente d'une réponse{group.to
						? ` · ${group.to}`
						: ''}
				</p>
			</div>
			{#if group.books.length > 1}
				<form method="POST" action="?/confirm" use:enhance={withToast('Tous confirmés 🎉')}>
					{#each group.books as book (book.id)}
						<input type="hidden" name="id" value={book.id} />
					{/each}
					<button class="btn btn-sm bg-teal"><CheckCheck class="size-4" /> Tous confirmés</button>
				</form>
			{/if}
		</div>

		{#if group.body}
			<details
				class="group mb-3 rounded-xl border-[3px] border-dashed border-ink bg-paper/70 p-3 text-sm"
			>
				<summary class="cursor-pointer font-bold">Voir l'email</summary>
				{#if group.subject}<p class="mt-2 font-bold">{group.subject}</p>{/if}
				<pre class="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">{group.body}</pre>
			</details>
		{/if}

		<ul class="grid gap-3">
			{#each group.books as book (book.id)}
				<li animate:flip={{ duration: 250 }} out:fly={{ x: 80, duration: 200 }}>
					<BookCard {book}>
						{#snippet meta()}
							{#if book.source}<span class="chip">via {book.source}</span>{/if}
						{/snippet}
						{#if unavailableFor === book.id}
							<UnavailableForm id={book.id} oncancel={() => (unavailableFor = null)} />
						{:else}
							<div class="flex flex-wrap items-center gap-2">
								<form method="POST" action="?/confirm" use:enhance={withToast('Confirmé ✓')}>
									<input type="hidden" name="id" value={book.id} />
									<button class="btn btn-sm bg-teal"><Check class="size-4" /> Confirmé</button>
								</form>
								<button
									type="button"
									class="btn btn-sm bg-orange-soft"
									onclick={() => (unavailableFor = book.id)}
								>
									<X class="size-4" /> Indisponible
								</button>
								<form
									method="POST"
									action="?/backToCart"
									use:enhance={withToast('De retour dans le panier')}
								>
									<input type="hidden" name="id" value={book.id} />
									<button class="btn btn-sm btn-ghost"
										><Undo2 class="size-4" /> Retour au panier</button
									>
								</form>
							</div>
						{/if}
					</BookCard>
				</li>
			{/each}
		</ul>
	</section>
{/each}

{#if data.board.confirmed.length}
	<section aria-labelledby="pickup-title">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="pickup-title" class="text-xl leading-tight font-extrabold uppercase">
					Confirmés · à récupérer
				</h2>
				<p class="text-sm text-ink/70">
					{plural(data.board.confirmed.length, 'livre')} en route. Récupérés ? Mettez-les sur votre étagère.
				</p>
			</div>
			{#if data.board.confirmed.length > 1}
				<form method="POST" action="?/gotIt" use:enhance={withToast('Tous sur votre étagère 📚')}>
					{#each data.board.confirmed as book (book.id)}
						<input type="hidden" name="id" value={book.id} />
					{/each}
					<button class="btn btn-sm bg-ink text-cream"
						><LibraryBig class="size-4" /> Tous récupérés</button
					>
				</form>
			{/if}
		</div>
		<ul class="grid gap-3">
			{#each data.board.confirmed as book (book.id)}
				<li animate:flip={{ duration: 250 }} out:fly={{ x: 80, duration: 200 }}>
					<BookCard {book} class="bg-teal-soft/50">
						{#snippet meta()}
							<span class="chip bg-teal">Confirmé {ago(book.confirmedAt)}</span>
							{#if book.source}<span class="chip">via {book.source}</span>{/if}
						{/snippet}
						<div class="flex flex-wrap items-center gap-2">
							<form method="POST" action="?/gotIt" use:enhance={withToast('Sur votre étagère 📚')}>
								<input type="hidden" name="id" value={book.id} />
								<button class="btn btn-sm bg-ink text-cream"
									><LibraryBig class="size-4" /> Récupéré !</button
								>
							</form>
							{#if unavailableFor === book.id}
								<div class="w-full">
									<UnavailableForm id={book.id} oncancel={() => (unavailableFor = null)} />
								</div>
							{:else}
								<button
									type="button"
									class="btn btn-sm btn-ghost"
									onclick={() => (unavailableFor = book.id)}
								>
									<X class="size-4" /> Est tombé à l'eau
								</button>
							{/if}
						</div>
					</BookCard>
				</li>
			{/each}
		</ul>
	</section>
{/if}
