<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { label = 'Remove' }: { label?: string } = $props();

	let armed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** First tap arms the button, the second one submits the surrounding form. */
	function onclick(event: MouseEvent) {
		if (armed) return;
		event.preventDefault();
		armed = true;
		clearTimeout(timer);
		timer = setTimeout(() => (armed = false), 3000);
	}
</script>

<button
	type="submit"
	{onclick}
	title={label}
	aria-label={armed ? `Tap again to confirm: ${label}` : label}
	class={['btn btn-sm', armed ? 'animate-pop bg-orange' : 'btn-ghost']}
>
	{#if armed}Sure?{:else}<Trash2 class="size-4" />{/if}
</button>
