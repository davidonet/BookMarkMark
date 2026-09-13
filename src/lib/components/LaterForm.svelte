<script lang="ts">
	import { enhance } from '$app/forms';
	import Combobox from './Combobox.svelte';
	import { withToast } from '$lib/enhance';

	interface Props {
		id: string;
		reasons: string[];
		oncancel: () => void;
	}

	let { id, reasons, oncancel }: Props = $props();
	const uid = $props.id();
</script>

<form
	method="POST"
	action="?/later"
	use:enhance={withToast('Enregistré pour plus tard ⏳')}
	class="grid gap-3 rounded-xl border-[3px] border-dashed border-ink bg-violet-soft/70 p-3"
>
	<input type="hidden" name="id" value={id} />
	<div>
		<label class="label mb-1.5 block" for={`${uid}-reason`}>Pourquoi plus tard ?</label>
		<Combobox
			id={`${uid}-reason`}
			name="reason"
			options={reasons}
			placeholder="En attente du poche…"
			newLabel="Nouvelle raison"
			maxlength={80}
		/>
	</div>
	<textarea
		class="input min-h-16"
		name="note"
		rows="2"
		maxlength="300"
		aria-label="Note (optionnelle)"
		placeholder="Quelque chose à noter ? (optionnel)"></textarea>
	<div class="flex gap-2">
		<button class="btn btn-sm bg-violet">Reporter</button>
		<button type="button" class="btn btn-sm btn-ghost" onclick={oncancel}>Annuler</button>
	</div>
</form>
