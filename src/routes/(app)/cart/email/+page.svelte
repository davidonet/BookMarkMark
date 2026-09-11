<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import BookCover from '$lib/components/BookCover.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { buildEmail, mailtoHref } from '$lib/email';
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
			books: chosen,
			lang,
			myName: data.settings.myName,
			bookstoreName: data.settings.bookstoreName
		})
	);
	const subject = $derived(subjectEdit ?? draft.subject);
	const body = $derived(bodyEdit ?? draft.body);
	const href = $derived(mailtoHref(to, subject, body));

	function toggle(id: string) {
		if (excluded.has(id)) excluded.delete(id);
		else excluded.add(id);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(body);
			opened = true;
			toast('Copied: paste it into your mail app');
		} catch {
			toast('Copy failed: select the text instead.', 'error');
		}
	}

	const sent: SubmitFunction = ({ formElement }) => {
		const count = chosen.length;
		const done = markPending(formElement);
		return async ({ result, update }) => {
			done();
			if (result.type === 'error') {
				toast('Something went wrong.', 'error');
				return;
			}
			if (result.type === 'redirect') toast(`${plural(count, 'book')} moved to Bookstore 📨`);
			if (result.type === 'failure')
				toast(String(result.data?.message ?? 'Could not save.'), 'error');
			await update();
		};
	};
</script>

<svelte:head>
	<title>Email · BookMarkMark</title>
</svelte:head>

<a href={resolve('/cart')} class="btn btn-sm btn-ghost mb-4 -ml-2"
	><ArrowLeft class="size-4" /> Cart</a
>
<PageHeader title="Order email" kicker="Step 3 · Ask your bookstore" tone="teal" />

{#if data.books.length === 0}
	<Empty title="Nothing to order" text="Your cart is empty.">
		<a href={resolve('/')} class="btn bg-orange">Find a book</a>
	</Empty>
{:else}
	<form method="POST" action="?/sent" use:enhance={sent} class="grid gap-6">
		<section class="card p-4 sm:p-5" aria-labelledby="books-title">
			<h2 id="books-title" class="label mb-3">
				Books in this email · {chosen.length}/{data.books.length}
			</h2>
			<ul class="grid gap-2">
				{#each data.books as book (book.id)}
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
								<span class="block text-sm text-ink/70">{authorsLine(book.authors)}</span>
							</span>
						</label>
					</li>
				{/each}
			</ul>
		</section>

		<section class="card grid gap-4 p-4 sm:p-5" aria-label="Message">
			<div class="grid gap-4 sm:grid-cols-[1fr_auto]">
				<div>
					<label for="to" class="label mb-1.5 block">To</label>
					<input
						id="to"
						name="to"
						type="email"
						class="input"
						value={to}
						oninput={(e) => (to = e.currentTarget.value)}
						placeholder="bookstore@example.com"
					/>
				</div>
				<fieldset>
					<legend class="label mb-1.5">Language</legend>
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
				<label for="subject" class="label mb-1.5 block">Subject</label>
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
							<RotateCcw class="size-3.5" /> Reset text
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
					Tip: add your name and your bookstore's in
					<a href={resolve('/settings')} class="font-bold underline">Settings</a> to personalise the message.
				</p>
			{/if}
		</section>

		<section class="card grid gap-3 bg-orange-soft p-4 sm:p-5" aria-label="Send">
			<div class="flex flex-wrap gap-2">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- mailto: link -->
				<a {href} class="btn bg-orange" onclick={() => (opened = true)}>
					<Mail class="size-4" /> Open in mail app
				</a>
				<button type="button" class="btn" onclick={copy} disabled={!chosen.length}>
					<Copy class="size-4" /> Copy text
				</button>
			</div>
			<div
				class={[
					'flex flex-col gap-3 rounded-xl border-[3px] border-dashed border-ink p-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
					opened ? 'bg-teal-soft' : 'bg-paper/60'
				]}
			>
				<p class="text-sm">
					<span class="font-bold">Sent it?</span> Move {plural(chosen.length, 'book')} to the Bookstore
					list to log the answer.
				</p>
				<button class="btn shrink-0 bg-teal" disabled={!chosen.length}>
					<Send class="size-4" /> I sent it
				</button>
			</div>
		</section>
	</form>
{/if}
