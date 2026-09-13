<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import { navigating } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { fly } from 'svelte/transition';
	import { SvelteMap } from 'svelte/reactivity';
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import BookCard from '$lib/components/BookCard.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RefreshWhilePending from '$lib/components/RefreshWhilePending.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { markPending } from '$lib/enhance';
	import { ago, authorsLine, plural } from '$lib/format';
	import { toast } from '$lib/toast.svelte';
	import {
		PROVIDER_LABEL,
		type SearchHit,
		type SearchMode,
		type SearchPage,
		type Status,
		isLookingUp
	} from '$lib/types';

	let { data } = $props();

	const MODES: { value: SearchMode; label: string }[] = [
		{ value: 'all', label: 'Tout' },
		{ value: 'title', label: 'Titre' },
		{ value: 'author', label: 'Auteur' }
	];

	/** Shown until the first book is added. */
	const STEPS = [
		{
			n: 1,
			tone: 'bg-orange',
			title: 'Rechercher',
			text: "Vous avez entendu parler d'un livre à la radio ou par un ami ? Cherchez-le ici."
		},
		{
			n: 2,
			tone: 'bg-violet',
			title: 'Ajouter',
			text: 'Sélectionnez les résultats, indiquez où vous en avez entendu parler, ajoutez-les au panier.'
		},
		{
			n: 3,
			tone: 'bg-teal',
			title: 'Commander',
			text: 'Un email à votre libraire, notez les réponses, et regardez votre étagère grandir.'
		}
	];

	// ── Search as you type (a GET form, so results live in the URL) ─────────────
	let searchForm: HTMLFormElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Local edits win over the URL until an outside navigation (link, back button).
	let typed = $state<string | null>(null);
	let pickedMode = $state<SearchMode | null>(null);
	const q = $derived(typed ?? data.q);
	const mode = $derived(pickedMode ?? data.mode);
	const searching = $derived(navigating.to?.url.pathname === '/');

	afterNavigate(({ type }) => {
		if (type === 'link' || type === 'popstate') {
			typed = null;
			pickedMode = null;
		}
	});

	function schedule() {
		clearTimeout(timer);
		if (q.trim().length === 1) return;
		timer = setTimeout(() => searchForm.requestSubmit(), 450);
	}

	// ── Results, with "more results" appended client-side ───────────────────────
	let more = $state.raw<{ key: string; hits: SearchHit[]; page: number; hasMore: boolean } | null>(
		null
	);
	let loadingMore = $state(false);
	const resultsKey = $derived(`${data.mode}|${data.q}`);
	const extra = $derived(more?.key === resultsKey ? more : null);
	const hits = $derived.by(() => {
		// Catalog pages can overlap: keep the first occurrence of each book.
		const seen: Record<string, true> = {};
		return [...(data.search?.hits ?? []), ...(extra?.hits ?? [])].filter((h) =>
			seen[h.ref] ? false : (seen[h.ref] = true)
		);
	});
	const hasMore = $derived(extra ? extra.hasMore : (data.search?.hasMore ?? false));

	async function loadMore() {
		const key = resultsKey;
		const previous = extra?.hits ?? [];
		const page = (extra?.page ?? 1) + 1;
		loadingMore = true;
		try {
			const params = new URLSearchParams({
				q: data.q,
				by: data.mode,
				page: String(page),
				from: data.search?.provider ?? data.provider
			});
			const res = await fetch(`/api/search?${params}`);
			const next = (await res.json()) as SearchPage & { message?: string };
			if (!res.ok) throw new Error(next.message);
			more = { key, hits: [...previous, ...next.hits], page, hasMore: next.hasMore };
		} catch (err) {
			toast(
				(err instanceof Error && err.message) || 'Impossible de charger plus de résultats.',
				'error'
			);
		} finally {
			loadingMore = false;
		}
	}

	// ── Selection → cart ────────────────────────────────────────────────────────
	const selected = new SvelteMap<string, SearchHit>();
	const justAdded = new SvelteMap<string, Status>();
	let source = $state('');

	const statusOf = (hit: SearchHit) => justAdded.get(hit.ref) ?? hit.status;

	function toggle(hit: SearchHit) {
		if (selected.has(hit.ref)) selected.delete(hit.ref);
		else selected.set(hit.ref, hit);
	}

	const selectedJson = $derived(
		JSON.stringify(
			[...selected.values()].map((h) => ({
				ref: h.ref,
				title: h.title,
				subtitle: h.subtitle,
				authors: h.authors,
				year: h.year,
				cover: h.cover,
				isbn: h.isbn,
				publisher: h.publisher,
				language: h.language,
				format: h.format
			}))
		)
	);

	const add: SubmitFunction = ({ formElement }) => {
		const keys = [...selected.keys()];
		const done = markPending(formElement);
		return async ({ result, update }) => {
			done();
			if (result.type === 'error') {
				toast('Une erreur est survenue.', 'error');
				return;
			}
			if (result.type === 'failure') {
				toast(String(result.data?.message ?? 'Impossible de les ajouter.'), 'error');
			} else if (result.type === 'success') {
				const { added = 0, revived = 0 } = (result.data ?? {}) as {
					added?: number;
					revived?: number;
				};
				for (const key of keys) justAdded.set(key, 'cart');
				selected.clear();
				source = '';
				const n = added + revived;
				toast(
					n
						? `${plural(n, 'livre')} ajouté${n > 1 ? 's' : ''} à votre panier 🛒`
						: 'Déjà dans vos listes'
				);
			}
			await update({ reset: false });
		};
	};
</script>

<svelte:head>
	<title>{data.q ? `${data.q} · ` : ''}Recherche · BookMarkMark</title>
</svelte:head>

<RefreshWhilePending active={data.recent.some(isLookingUp)} />
<PageHeader title="Un livre en tête ?" kicker="Étape 1 · Trouvez-le" tone="orange" />

<form
	bind:this={searchForm}
	method="GET"
	action="/"
	role="search"
	data-sveltekit-keepfocus
	data-sveltekit-replacestate
	data-sveltekit-noscroll
	onsubmit={() => clearTimeout(timer)}
>
	<div class="flex gap-2">
		<div class="relative min-w-0 flex-1">
			<SearchIcon class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
			<input
				name="q"
				type="search"
				value={q}
				oninput={(e) => {
					typed = e.currentTarget.value;
					schedule();
				}}
				placeholder="Titre, auteur, ou les deux…"
				aria-label="Rechercher des livres"
				autocomplete="off"
				enterkeyhint="search"
				class="input h-14 pl-12 text-lg shadow-brutal-sm"
			/>
		</div>
		<button class="btn h-14 bg-orange px-5" aria-label="Rechercher">
			{#if searching}
				<LoaderCircle class="size-5 animate-spin" />
			{:else}
				<SearchIcon class="size-5 sm:hidden" /><span class="hidden sm:inline">Rechercher</span>
			{/if}
		</button>
	</div>

	<fieldset class="mt-3 flex flex-wrap items-center gap-2">
		<legend class="sr-only">Rechercher dans</legend>
		{#each MODES as m (m.value)}
			<label class="choice py-1.5 text-xs uppercase has-checked:bg-ink has-checked:text-cream">
				<input
					class="sr-only"
					type="radio"
					name="by"
					value={m.value}
					checked={mode === m.value}
					onchange={() => {
						pickedMode = m.value;
						if (q.trim().length > 1) searchForm.requestSubmit();
					}}
				/>
				{m.label}
			</label>
		{/each}
		<span class="label ml-auto text-ink/55">
			via {PROVIDER_LABEL[data.search?.provider ?? data.provider]}
		</span>
	</fieldset>
</form>

{#if data.search}
	<section class="mt-8" aria-busy={searching} aria-label="Résultats">
		{#if data.search.error}
			<Empty title="Hmm." text={data.search.error} class="bg-orange-soft" />
		{:else if hits.length === 0}
			<Empty
				title="Aucun résultat"
				text="Essayez avec moins de mots, vérifiez l'orthographe, ou cherchez par titre ou par auteur uniquement."
			/>
		{:else}
			{#if data.search.notice}
				<p
					class="mb-4 rounded-xl border-[3px] border-dashed border-ink bg-orange-soft/70 p-3 text-sm"
				>
					{data.search.notice}
				</p>
			{/if}
			<p class="label mb-3 text-ink/70">
				{data.search.total.toLocaleString('fr-FR')} résultats · touchez pour sélectionner
			</p>
			<ul class={['grid gap-3 transition-opacity', searching && 'opacity-60']}>
				{#each hits as hit (hit.ref)}
					{@const status = statusOf(hit)}
					{@const selectable = status === null || status === 'postponed'}
					{@const isSelected = selected.has(hit.ref)}
					{@const details = [hit.publisher, hit.year].filter(Boolean).join(' · ')}
					<li>
						<button
							type="button"
							disabled={!selectable}
							aria-pressed={selectable ? isSelected : undefined}
							onclick={() => toggle(hit)}
							class={[
								'card flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-[transform,box-shadow,background-color] duration-100 disabled:cursor-default sm:gap-4',
								isSelected && 'translate-x-0.5 translate-y-0.5 bg-orange-soft shadow-brutal-sm',
								!isSelected && selectable && 'hover:-translate-y-0.5',
								!selectable && 'bg-cream-deep/40 shadow-brutal-xs'
							]}
						>
							<span
								aria-hidden="true"
								class={[
									'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border-[3px] border-ink',
									isSelected ? 'bg-orange' : selectable ? 'bg-paper' : 'bg-ink text-cream'
								]}
							>
								{#if isSelected || !selectable}<Check class="size-4" strokeWidth={3.5} />{/if}
							</span>
							<BookCover cover={hit.cover} title={hit.title} class="w-14 sm:w-16" />
							<span class="min-w-0 flex-1">
								<span class="block text-lg leading-tight font-bold">{hit.title}</span>
								{#if hit.subtitle}
									<span class="mt-0.5 block text-sm leading-snug text-ink/65">{hit.subtitle}</span>
								{/if}
								<span class="mt-1 block text-sm font-medium">
									{authorsLine(hit.authors)}{#if details}<span class="text-ink/60"
											>{` · ${details}`}</span
										>{/if}
								</span>
								<span class="mt-2 flex flex-wrap gap-1.5">
									{#if status}<StatusBadge {status} />{/if}
									{#if hit.language}
										<span
											class={[
												'chip uppercase',
												hit.language === data.editionLang && 'bg-teal-soft'
											]}
											title="Langue de l'édition">{hit.language}</span
										>
									{/if}
									{#if hit.format === 'ebook'}
										<span
											class="chip bg-orange-soft"
											title="Édition ebook : l'ISBN n'est pas celui du papier">ebook</span
										>
									{/if}
									{#if hit.editions && hit.editions > 1}
										<span class="chip">{hit.editions} éditions</span>
									{/if}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>

			{#if hasMore}
				<div class="mt-6 flex justify-center">
					<button type="button" class="btn" onclick={loadMore} disabled={loadingMore}>
						{#if loadingMore}<LoaderCircle class="size-4 animate-spin" />{/if}
						Plus de résultats
					</button>
				</div>
			{/if}
		{/if}
	</section>
{:else if data.recent.length}
	<section class="mt-10" aria-labelledby="recent-title">
		<h2 id="recent-title" class="label mb-3 text-ink/70">Derniers ajouts</h2>
		<ul class="grid gap-3">
			{#each data.recent as book (book.id)}
				<li>
					<BookCard {book}>
						{#snippet meta()}
							<StatusBadge status={book.status} />
							{#if book.source}<span class="chip">via {book.source}</span>{/if}
							<span class="chip border-dashed bg-transparent">{ago(book.createdAt)}</span>
						{/snippet}
					</BookCard>
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<section class="mt-10 grid gap-4 sm:grid-cols-3" aria-label="Comment ça marche">
		{#each STEPS as step (step.n)}
			<div class="card p-5">
				<span
					class={[
						'grid size-10 place-items-center rounded-full border-[3px] border-ink font-mono text-lg font-bold',
						step.tone
					]}>{step.n}</span
				>
				<p class="mt-3 text-xl font-extrabold uppercase">{step.title}</p>
				<p class="mt-1 text-sm text-ink/75">{step.text}</p>
			</div>
		{/each}
	</section>
{/if}

{#if selected.size}
	<!-- keeps the last results reachable above the floating bar -->
	<div class="h-48" aria-hidden="true"></div>
	<div
		class="fixed inset-x-0 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-5"
		transition:fly={{ y: 48, duration: 200 }}
	>
		<form
			method="POST"
			action="?/add"
			use:enhance={add}
			class="card mx-auto grid max-w-3xl gap-3 bg-orange-soft p-3 shadow-brutal-lg sm:grid-cols-[1fr_auto] sm:items-end"
		>
			<input type="hidden" name="books" value={selectedJson} />
			<div>
				<label for="source" class="label mb-1.5 block">
					{plural(selected.size, 'livre')} sélectionné{selected.size > 1 ? 's' : ''} · entendu parler
					par
				</label>
				<Combobox
					id="source"
					name="source"
					bind:value={source}
					options={data.sources}
					placeholder="Ami, radio, podcast…"
					placement="up"
					newLabel="Nouvelle source"
					maxlength={80}
				/>
			</div>
			<div class="flex gap-2">
				<button type="button" class="btn" onclick={() => selected.clear()}>Effacer</button>
				<button class="btn flex-1 bg-orange"
					><Plus class="size-4" strokeWidth={3} /> Ajouter au panier</button
				>
			</div>
		</form>
	</div>
{/if}
