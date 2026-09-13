<script lang="ts">
	import { enhance } from '$app/forms';
	import Globe from '@lucide/svelte/icons/globe';
	import Store from '@lucide/svelte/icons/store';
	import { withToast } from '$lib/enhance';

	interface Props {
		id: string;
		oncancel: () => void;
	}

	let { id, oncancel }: Props = $props();
	let via = $state<'direct' | 'online'>('direct');
</script>

<form
	method="POST"
	action="?/owned"
	use:enhance={withToast('Sur votre étagère 📚')}
	class="grid gap-3 rounded-xl border-[3px] border-dashed border-ink bg-teal-soft/70 p-3"
>
	<input type="hidden" name="id" value={id} />
	<fieldset>
		<legend class="label mb-2">Comment l'avez-vous obtenu ?</legend>
		<div class="grid grid-cols-2 gap-2">
			<label class="choice has-checked:bg-teal">
				<input class="sr-only" type="radio" name="via" value="direct" bind:group={via} />
				<Store class="size-4 shrink-0" /> Acheté directement
			</label>
			<label class="choice has-checked:bg-teal">
				<input class="sr-only" type="radio" name="via" value="online" bind:group={via} />
				<Globe class="size-4 shrink-0" /> Service en ligne
			</label>
		</div>
	</fieldset>
	<input
		class="input"
		name="note"
		maxlength="300"
		aria-label="Note (optionnelle)"
		placeholder={via === 'online'
			? 'Lequel ? Kindle, Audible, Bookshop.org…'
			: 'Où ? Une autre librairie, d’occasion, un cadeau…'}
	/>
	<div class="flex gap-2">
		<button class="btn btn-sm bg-teal">Marquer comme possédé</button>
		<button type="button" class="btn btn-sm btn-ghost" onclick={oncancel}>Annuler</button>
	</div>
</form>
