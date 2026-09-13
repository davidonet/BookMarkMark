<script lang="ts">
	import { enhance } from '$app/forms';
	import Lock from '@lucide/svelte/icons/lock';
	import X from '@lucide/svelte/icons/x';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { withToast } from '$lib/enhance';
	import type { EditionLang, EmailLang, TagKind } from '$lib/types';

	let { data } = $props();

	const LANGS: { value: EmailLang; label: string }[] = [
		{ value: 'en', label: 'English' },
		{ value: 'fr', label: 'Français' }
	];
	const EDITION_LANGS: { value: EditionLang; label: string }[] = [
		{ value: 'fr', label: 'Français' },
		{ value: 'en', label: 'English' },
		{ value: '', label: "N'importe quelle langue" }
	];

	const lists = $derived<{ kind: TagKind; title: string; hint: string; items: string[] }[]>([
		{
			kind: 'source',
			title: 'Sources',
			hint: 'Proposées quand vous ajoutez un livre. Les nouvelles sont mémorisées automatiquement.',
			items: data.sources
		},
		{
			kind: 'reason',
			title: 'Raisons de report',
			hint: 'Proposées quand vous mettez un livre de côté pour plus tard.',
			items: data.reasons
		}
	]);
</script>

<svelte:head>
	<title>Réglages · BookMarkMark</title>
</svelte:head>

<PageHeader title="Réglages" kicker="Personnalisez" tone="orange" />

<form
	method="POST"
	action="?/save"
	use:enhance={withToast('Enregistré ✓')}
	class="card grid gap-5 p-5"
>
	<h2 class="text-xl font-extrabold uppercase">Votre libraire</h2>
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label for="bookstoreName" class="label mb-1.5 block">Nom de la librairie</label>
			<input
				id="bookstoreName"
				name="bookstoreName"
				class="input"
				maxlength="100"
				value={data.settings.bookstoreName}
				placeholder="La librairie du coin"
			/>
		</div>
		<div>
			<label for="bookstoreEmail" class="label mb-1.5 block">Email de la librairie</label>
			<input
				id="bookstoreEmail"
				name="bookstoreEmail"
				type="email"
				class="input"
				value={data.settings.bookstoreEmail}
				placeholder="bonjour@librairie.fr"
			/>
		</div>
		<div>
			<label for="myName" class="label mb-1.5 block">Votre nom (signature de l'email)</label>
			<input
				id="myName"
				name="myName"
				class="input"
				maxlength="100"
				value={data.settings.myName}
				autocomplete="name"
			/>
		</div>
		<fieldset>
			<legend class="label mb-1.5">Langue de l'email</legend>
			<div class="flex gap-2">
				{#each LANGS as l (l.value)}
					<label class="choice has-checked:bg-ink has-checked:text-cream">
						<input
							class="sr-only"
							type="radio"
							name="emailLang"
							value={l.value}
							checked={data.settings.emailLang === l.value}
						/>
						{l.label}
					</label>
				{/each}
			</div>
		</fieldset>
	</div>

	<h2 class="mt-2 text-xl font-extrabold uppercase">Recherche</h2>
	<fieldset>
		<legend class="label mb-1.5">Éditions en premier en</legend>
		<div class="flex flex-wrap gap-2">
			{#each EDITION_LANGS as l (l.value)}
				<label class="choice has-checked:bg-ink has-checked:text-cream">
					<input
						class="sr-only"
						type="radio"
						name="editionLang"
						value={l.value}
						checked={data.settings.editionLang === l.value}
					/>
					{l.label}
				</label>
			{/each}
		</div>
		<p class="mt-2 text-sm text-ink/70">
			Google Books liste toutes les éditions d'un livre : celles dans cette langue arrivent en
			premier.
		</p>
	</fieldset>
	<div><button class="btn bg-orange">Enregistrer</button></div>
</form>

{#each lists as list (list.kind)}
	<section class="card mt-6 p-5" aria-labelledby={`${list.kind}-title`}>
		<h2 id={`${list.kind}-title`} class="text-xl font-extrabold uppercase">{list.title}</h2>
		<p class="mt-1 text-sm text-ink/70">{list.hint}</p>
		{#if list.items.length}
			<ul class="mt-4 flex flex-wrap gap-2">
				{#each list.items as name (name)}
					<li>
						<form
							method="POST"
							action="?/forget"
							use:enhance={withToast(`"${name}" oublié`)}
							class="chip gap-1 py-1 pr-1 pl-3 text-sm"
						>
							<input type="hidden" name="kind" value={list.kind} />
							<input type="hidden" name="name" value={name} />
							{name}
							<button
								class="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-orange"
								aria-label={`Oublier ${name}`}
							>
								<X class="size-3.5" />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-sm text-ink/60">Rien pour l'instant.</p>
		{/if}
	</section>
{/each}

<section class="card mt-6 grid gap-3 p-5" aria-labelledby="lock-title">
	<h2 id="lock-title" class="text-xl font-extrabold uppercase">Verrouillage</h2>
	<p class="text-sm text-ink/75">
		Le code à 4 chiffres provient de la variable d'environnement <code class="font-mono font-bold"
			>APP_PIN</code
		>. La changer déconnecte tous les appareils.
	</p>
	{#if data.devPin}
		<p class="chip w-fit bg-orange-soft">Mode dev : APP_PIN non défini, le code est 1234</p>
	{/if}
	<form method="POST" action="?/lock" use:enhance>
		<button class="btn bg-ink text-cream"><Lock class="size-4" /> Verrouiller maintenant</button>
	</form>
</section>
