<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Delete from '@lucide/svelte/icons/delete';
	import Logo from '$lib/components/Logo.svelte';

	let { data, form } = $props();

	let pin = $state('');
	let busy = $state(false);
	let shaking = $state(false);
	let crashed = $state('');
	let formEl: HTMLFormElement | undefined = $state();

	const message = $derived(crashed || form?.message || '');

	async function submitWhenComplete() {
		await tick(); // let the input receive the last digit first
		if (pin.length === 4 && !busy) formEl?.requestSubmit();
	}

	function press(digit: string) {
		if (busy || pin.length >= 4) return;
		pin += digit;
		void submitWhenComplete();
	}

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		pin = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
		void submitWhenComplete();
	}

	/** Type right away on a computer; on phones the keypad below is nicer than the keyboard. */
	function focusOnDesktop(input: HTMLInputElement) {
		if (matchMedia('(pointer: fine)').matches) input.focus();
	}

	const submit: SubmitFunction = () => {
		busy = true;
		crashed = '';
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'redirect') return update();
			pin = '';
			shaking = true;
			setTimeout(() => (shaking = false), 450);
			if (result.type === 'error') crashed = result.error?.message ?? 'Une erreur est survenue.';
			else await update({ reset: false });
		};
	};
</script>

<svelte:head>
	<title>Déverrouiller · BookMarkMark</title>
</svelte:head>

<main class="grid min-h-dvh place-items-center px-5 py-10">
	<div class="w-full max-w-xs">
		<div class="mb-8 flex flex-col items-center gap-3 text-center">
			<Logo class="h-16 w-auto -rotate-6" />
			<h1 class="text-3xl leading-none font-extrabold tracking-tight uppercase">
				BookMark<span
					class="ml-1 inline-block rotate-[-5deg] rounded-md border-[3px] border-ink bg-teal px-1.5 py-0.5 shadow-brutal-xs"
					>Mark</span
				>
			</h1>
			<p class="text-ink/70">Les livres dont vous avez entendu parler, gardés en sécurité.</p>
		</div>

		{#if !data.configured}
			<div class="card bg-orange-soft p-5">
				<p class="font-bold">Aucun code PIN configuré.</p>
				<p class="mt-2 text-sm">
					Définissez une variable d'environnement <code class="font-mono font-bold">APP_PIN</code> à 4
					chiffres sur Vercel, puis redéployez.
				</p>
			</div>
		{:else}
			<form
				bind:this={formEl}
				method="POST"
				use:enhance={submit}
				class={['card p-5', shaking && 'animate-shake']}
			>
				<input
					id="pin"
					name="pin"
					type="password"
					inputmode="numeric"
					autocomplete="current-password"
					pattern={'[0-9]{4}'}
					maxlength="4"
					required
					aria-label="Code PIN"
					aria-describedby="pin-message"
					value={pin}
					{oninput}
					readonly={busy}
					class="peer sr-only"
					{@attach focusOnDesktop}
				/>
				<label
					for="pin"
					class="flex cursor-text justify-center gap-3 rounded-xl p-1 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-violet-deep"
				>
					{#each [0, 1, 2, 3] as i (i)}
						<span
							class={[
								'grid size-13 place-items-center rounded-xl border-[3px] border-ink transition-colors',
								i < pin.length ? 'bg-orange shadow-brutal-xs' : 'bg-cream'
							]}
						>
							{#if i < pin.length}<span class="size-3.5 animate-pop rounded-full bg-ink"
								></span>{/if}
						</span>
					{/each}
				</label>

				<p id="pin-message" class="mt-4 min-h-6 text-center text-sm font-bold" role="alert">
					{message}
				</p>

				<div class="mt-2 grid grid-cols-3 gap-2.5">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as digit (digit)}
						<button
							type="button"
							class="btn btn-lg py-3.5 text-2xl"
							disabled={busy}
							onclick={() => press(digit)}>{digit}</button
						>
					{/each}
					<button
						type="button"
						class="btn btn-lg btn-ghost"
						aria-label="Supprimer le dernier chiffre"
						disabled={busy || !pin}
						onclick={() => (pin = pin.slice(0, -1))}
					>
						<Delete class="size-6" />
					</button>
					<button
						type="button"
						class="btn btn-lg py-3.5 text-2xl"
						disabled={busy}
						onclick={() => press('0')}>0</button
					>
					<button
						type="submit"
						class="btn btn-lg bg-orange"
						aria-label="Déverrouiller"
						disabled={busy || pin.length < 4}
					>
						<ArrowRight class="size-6" />
					</button>
				</div>
			</form>
			{#if data.devPin}
				<p class="label mt-5 text-center text-ink/60">
					Mode dev · APP_PIN non défini · utilisez {data.devPin}
				</p>
			{/if}
		{/if}
	</div>
</main>
