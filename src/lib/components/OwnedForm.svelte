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
	use:enhance={withToast('On your shelf 📚')}
	class="grid gap-3 rounded-xl border-[3px] border-dashed border-ink bg-teal-soft/70 p-3"
>
	<input type="hidden" name="id" value={id} />
	<fieldset>
		<legend class="label mb-2">How did you get it?</legend>
		<div class="grid grid-cols-2 gap-2">
			<label class="choice has-checked:bg-teal">
				<input class="sr-only" type="radio" name="via" value="direct" bind:group={via} />
				<Store class="size-4 shrink-0" /> Bought directly
			</label>
			<label class="choice has-checked:bg-teal">
				<input class="sr-only" type="radio" name="via" value="online" bind:group={via} />
				<Globe class="size-4 shrink-0" /> Online service
			</label>
		</div>
	</fieldset>
	<input
		class="input"
		name="note"
		maxlength="300"
		aria-label="Note (optional)"
		placeholder={via === 'online'
			? 'Which one? Kindle, Audible, Bookshop.org…'
			: 'Where? Another shop, second-hand, a gift…'}
	/>
	<div class="flex gap-2">
		<button class="btn btn-sm bg-teal">Mark as owned</button>
		<button type="button" class="btn btn-sm btn-ghost" onclick={oncancel}>Cancel</button>
	</div>
</form>
