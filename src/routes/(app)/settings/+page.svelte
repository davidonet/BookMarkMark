<script lang="ts">
	import { enhance } from '$app/forms';
	import Lock from '@lucide/svelte/icons/lock';
	import X from '@lucide/svelte/icons/x';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { withToast } from '$lib/enhance';
	import type { EmailLang, TagKind } from '$lib/types';

	let { data } = $props();

	const LANGS: { value: EmailLang; label: string }[] = [
		{ value: 'en', label: 'English' },
		{ value: 'fr', label: 'Français' }
	];

	const lists = $derived<{ kind: TagKind; title: string; hint: string; items: string[] }[]>([
		{
			kind: 'source',
			title: 'Sources',
			hint: 'Offered when you add a book. New ones are remembered automatically.',
			items: data.sources
		},
		{
			kind: 'reason',
			title: 'Postpone reasons',
			hint: 'Offered when you put a book aside for later.',
			items: data.reasons
		}
	]);
</script>

<svelte:head>
	<title>Settings · BookMarkMark</title>
</svelte:head>

<PageHeader title="Settings" kicker="Make it yours" tone="orange" />

<form method="POST" action="?/save" use:enhance={withToast('Saved ✓')} class="card grid gap-5 p-5">
	<h2 class="text-xl font-extrabold uppercase">Your bookstore</h2>
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label for="bookstoreName" class="label mb-1.5 block">Bookstore name</label>
			<input
				id="bookstoreName"
				name="bookstoreName"
				class="input"
				maxlength="100"
				value={data.settings.bookstoreName}
				placeholder="The corner bookshop"
			/>
		</div>
		<div>
			<label for="bookstoreEmail" class="label mb-1.5 block">Bookstore email</label>
			<input
				id="bookstoreEmail"
				name="bookstoreEmail"
				type="email"
				class="input"
				value={data.settings.bookstoreEmail}
				placeholder="hello@bookshop.com"
			/>
		</div>
		<div>
			<label for="myName" class="label mb-1.5 block">Your name (email signature)</label>
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
			<legend class="label mb-1.5">Email language</legend>
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
	<div><button class="btn bg-orange">Save</button></div>
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
							use:enhance={withToast(`Forgot “${name}”`)}
							class="chip gap-1 py-1 pr-1 pl-3 text-sm"
						>
							<input type="hidden" name="kind" value={list.kind} />
							<input type="hidden" name="name" value={name} />
							{name}
							<button
								class="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-orange"
								aria-label={`Forget ${name}`}
							>
								<X class="size-3.5" />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-sm text-ink/60">Nothing yet.</p>
		{/if}
	</section>
{/each}

<section class="card mt-6 grid gap-3 p-5" aria-labelledby="lock-title">
	<h2 id="lock-title" class="text-xl font-extrabold uppercase">Lock</h2>
	<p class="text-sm text-ink/75">
		The 4-digit PIN comes from the <code class="font-mono font-bold">APP_PIN</code> environment variable.
		Changing it signs every device out.
	</p>
	{#if data.devPin}
		<p class="chip w-fit bg-orange-soft">Dev mode: APP_PIN is not set, the PIN is 1234</p>
	{/if}
	<form method="POST" action="?/lock" use:enhance>
		<button class="btn bg-ink text-cream"><Lock class="size-4" /> Lock now</button>
	</form>
</section>
