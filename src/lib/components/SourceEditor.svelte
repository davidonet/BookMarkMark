<script lang="ts">
	import { enhance } from '$app/forms';
	import Combobox from './Combobox.svelte';
	import { withToast } from '$lib/enhance';

	interface Props {
		id: string;
		source: string;
		options: string[];
	}

	let { id, source, options }: Props = $props();
	let form: HTMLFormElement;
</script>

<!-- Autosaves as soon as a source is picked or typed. -->
<form
	bind:this={form}
	method="POST"
	action="?/source"
	use:enhance={withToast('Source saved')}
	class="flex items-center gap-2"
>
	<input type="hidden" name="id" value={id} />
	<label class="label shrink-0" for={`source-${id}`}>Heard from</label>
	<div class="min-w-0 flex-1">
		<Combobox
			id={`source-${id}`}
			name="source"
			value={source}
			{options}
			placeholder="Where did you hear about it?"
			newLabel="New source"
			maxlength={80}
			oncommit={() => form.requestSubmit()}
		/>
	</div>
</form>
