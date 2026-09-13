<script lang="ts">
	import { enhance } from '$app/forms';
	import Combobox from './Combobox.svelte';
	import { withToast } from '$lib/enhance';

	interface Props {
		id: string;
		borrowers: string[];
		oncancel: () => void;
	}

	let { id, borrowers, oncancel }: Props = $props();
	const uid = $props.id();
</script>

<form
	method="POST"
	action="?/lend"
	use:enhance={withToast('Prêté 🤝')}
	class="grid gap-3 rounded-xl border-[3px] border-dashed border-ink bg-orange-soft/70 p-3"
>
	<input type="hidden" name="id" value={id} />
	<div>
		<label class="label mb-1.5 block" for={`${uid}-to`}>Prêté à qui ?</label>
		<Combobox
			id={`${uid}-to`}
			name="to"
			options={borrowers}
			placeholder="Nom de la personne…"
			newLabel="Nouvelle personne"
			maxlength={80}
		/>
	</div>
	<input
		class="input"
		name="note"
		maxlength="300"
		aria-label="Note (optionnelle)"
		placeholder="Un rappel ? (optionnel)"
	/>
	<div class="flex gap-2">
		<button class="btn btn-sm bg-orange">Prêter</button>
		<button type="button" class="btn btn-sm btn-ghost" onclick={oncancel}>Annuler</button>
	</div>
</form>
