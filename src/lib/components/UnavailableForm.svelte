<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/enhance';
	import { UNAVAILABLE_LABEL } from '$lib/types';

	interface Props {
		id: string;
		oncancel: () => void;
	}

	let { id, oncancel }: Props = $props();
	let kind = $state<'out_of_print' | 'not_accessible'>('out_of_print');
</script>

<form
	method="POST"
	action="?/unavailable"
	use:enhance={withToast('Moved to Later, with the reason')}
	class="grid gap-3 rounded-xl border-[3px] border-dashed border-ink bg-orange-soft/70 p-3"
>
	<input type="hidden" name="id" value={id} />
	<fieldset>
		<legend class="label mb-2">Why is it unavailable?</legend>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each Object.entries(UNAVAILABLE_LABEL) as [value, label] (value)}
				<label class="choice has-checked:bg-orange">
					<input class="sr-only" type="radio" name="kind" {value} bind:group={kind} />
					{label}
				</label>
			{/each}
		</div>
	</fieldset>
	<input
		class="input"
		name="note"
		maxlength="300"
		aria-label="Note (optional)"
		placeholder="Note (optional): try second-hand, new edition in spring…"
	/>
	<div class="flex gap-2">
		<button class="btn btn-sm bg-orange">Save</button>
		<button type="button" class="btn btn-sm btn-ghost" onclick={oncancel}>Cancel</button>
	</div>
</form>
