<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import BookCover from '$lib/components/BookCover.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { buildEmail, gmailComposeHref, mailtoHref } from '$lib/email';
	import { markPending } from '$lib/enhance';
	import { authorsLine, plural } from '$lib/format';
	import { toast } from '$lib/toast.svelte';
	import type { EmailLang } from '$lib/types';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import Mail from '@lucide/svelte/icons/mail';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { SvelteSet } from 'svelte/reactivity';

	let { data } = $props();

	const LANGS: { value: EmailLang; label: string }[] = [
		{ value: 'en', label: 'English' },
		{ value: 'fr', label: 'Français' }
	];

	const excluded = new SvelteSet<string>();
	// Start from the saved settings; local changes stick until those change.
	let lang = $derived(data.settings.emailLang);
	let to = $derived(data.settings.bookstoreEmail);
	let subjectEdit = $state<string | null>(null);
	let bodyEdit = $state<string | null>(null);
	let opened = $state(false);

	const chosen = $derived(data.books.filter((b) => !excluded.has(b.id)));
	const draft = $derived(
		buildEmail({
			// The paperback when there's one: cheaper.
			books: chosen,
			lang,
			myName: data.settings.myName,
			bookstoreName: data.settings.bookstoreName
		})
	);
	const subject = $derived(subjectEdit ?? draft.subject);
	const body = $derived(bodyEdit ?? draft.body);
	const href = $derived(mailtoHref(to, subject, body));
	const gmailHref = $derived(gmailComposeHref(to, subject, body));

	function toggle(id: string) {
		if (excluded.has(id)) excluded.delete(id);
		else excluded.add(id);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(body);
			opened = true;
			toast('Copié : collez-le dans votre application mail');
		} catch {
			toast('Échec de la copie : sélectionnez le texte à la place.', 'error');
		}
	}

	const sent: SubmitFunction = ({ formElement }) => {
		const count = chosen.length;
		const done = markPending(formElement);
		return async ({ result, update }) => {
			done();
			if (result.type === 'error') {
				toast('Une erreur est survenue.', 'error');
				return;
			}
			if (result.type === 'redirect')
				toast(`${plural(count, 'livre')} déplacé${count > 1 ? 's' : ''} vers Libraire 📨`);
			if (result.type === 'failure')
				toast(String(result.data?.message ?? 'Impossible d’enregistrer.'), 'error');
			await update();
		};
	};
</script>

<svelte:head>
	<title>Email · BookMarkMark</title>
</svelte:head>

<a href={resolve('/cart')} class="btn btn-sm btn-ghost mb-4 -ml-2"
	><ArrowLeft class="size-4" /> Panier</a
>
<PageHeader title="Email de commande" kicker="Étape 3 · Demandez à votre libraire" tone="teal" />

{#if data.books.length === 0}
	<Empty title="Rien à commander" text="Votre panier est vide.">
		<a href={resolve('/')} class="btn bg-orange">Trouver un livre</a>
	</Empty>
{:else}
	<form method="POST" action="?/sent" use:enhance={sent} class="grid gap-6">
		<section class="card p-4 sm:p-5" aria-labelledby="books-title">
			<h2 id="books-title" class="label mb-3">
				Livres dans cet email · {chosen.length}/{data.books.length}
			</h2>
			<ul class="grid gap-2">
				{#each data.books as book (book.id)}
					{@const pocket = book.pocket}
					{@const edition = pocket ?? book.edition}
					{@const name = pocket ? pocket.collection || pocket.publisher : edition.publisher}
					<li>
						<label class="choice items-center gap-3 font-normal has-checked:bg-teal-soft">
							<input
								type="checkbox"
								name="id"
								value={book.id}
								checked={!excluded.has(book.id)}
								onchange={() => toggle(book.id)}
								class="size-5 shrink-0 accent-ink"
							/>
							<BookCover cover={book.cover} title={book.title} class="w-9" />
							<span class="min-w-0">
								<span class="block leading-tight font-bold">{book.title}</span>
								<span class="block text-sm text-ink/70"
									>{[
										authorsLine(book.authors),
										pocket && !/poche/i.test(name) ? `poche ${name}`.trim() : name,
										edition.year
									]
										.filter(Boolean)
										.join(' · ')}</span
								>
								{#if edition.isbn}
									<span class="block font-mono text-xs text-ink/60">ISBN {edition.isbn}</span>
								{/if}
							</span>
						</label>
					</li>
				{/each}
			</ul>
		</section>

		<section class="card grid gap-4 p-4 sm:p-5" aria-label="Message">
			<div class="grid gap-4 sm:grid-cols-[1fr_auto]">
				<div>
					<label for="to" class="label mb-1.5 block">À</label>
					<input
						id="to"
						name="to"
						type="email"
						class="input"
						value={to}
						oninput={(e) => (to = e.currentTarget.value)}
						placeholder="libraire@exemple.com"
					/>
				</div>
				<fieldset>
					<legend class="label mb-1.5">Langue</legend>
					<div class="flex gap-2">
						{#each LANGS as l (l.value)}
							<label class="choice has-checked:bg-ink has-checked:text-cream">
								<input
									class="sr-only"
									type="radio"
									name="lang"
									value={l.value}
									checked={lang === l.value}
									onchange={() => (lang = l.value)}
								/>
								{l.label}
							</label>
						{/each}
					</div>
				</fieldset>
			</div>

			<div>
				<label for="subject" class="label mb-1.5 block">Objet</label>
				<input
					id="subject"
					name="subject"
					class="input"
					value={subject}
					oninput={(e) => (subjectEdit = e.currentTarget.value)}
				/>
			</div>

			<div>
				<div class="mb-1.5 flex min-h-8 items-center justify-between gap-2">
					<label for="body" class="label">Message</label>
					{#if subjectEdit !== null || bodyEdit !== null}
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							onclick={() => {
								subjectEdit = null;
								bodyEdit = null;
							}}
						>
							<RotateCcw class="size-3.5" /> Réinitialiser le texte
						</button>
					{/if}
				</div>
				<textarea
					id="body"
					name="body"
					rows={Math.min(24, body.split('\n').length + 2)}
					class="input font-mono text-sm leading-relaxed"
					value={body}
					oninput={(e) => (bodyEdit = e.currentTarget.value)}></textarea>
			</div>

			{#if !data.settings.myName || !data.settings.bookstoreName}
				<p class="text-sm text-ink/70">
					Astuce : ajoutez votre nom et celui de votre libraire dans les
					<a href={resolve('/settings')} class="font-bold underline">Réglages</a> pour personnaliser le
					message.
				</p>
			{/if}
		</section>

		<section class="card grid gap-3 bg-orange-soft p-4 sm:p-5" aria-label="Envoyer">
			<div class="flex flex-wrap gap-2">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- mailto: link -->
				<a {href} class="btn bg-orange" onclick={() => (opened = true)}>
					<Mail class="size-4" /> Ouvrir dans l'app mail
				</a>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external Gmail link -->
				<a
					href={gmailHref}
					target="_blank"
					rel="noopener noreferrer"
					class="btn"
					onclick={() => (opened = true)}
				>
					<Mail class="size-4" /> Ouvrir dans Gmail
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<button type="button" class="btn" onclick={copy} disabled={!chosen.length}>
					<Copy class="size-4" /> Copier le texte
				</button>
			</div>
			<div
				class={[
					'flex flex-col gap-3 rounded-xl border-[3px] border-dashed border-ink p-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
					opened ? 'bg-teal-soft' : 'bg-paper/60'
				]}
			>
				<p class="text-sm">
					<span class="font-bold">Envoyé ?</span> Déplacez {plural(chosen.length, 'livre')} vers la liste
					Libraire pour noter la réponse.
				</p>
				<button class="btn shrink-0 bg-teal" disabled={!chosen.length}>
					<Send class="size-4" /> Je l'ai envoyé
				</button>
			</div>
		</section>
	</form>
{/if}
