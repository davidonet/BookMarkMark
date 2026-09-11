<script lang="ts">
	import { fly } from 'svelte/transition';
	import { dismiss, toasts } from '$lib/toast.svelte';
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.75rem)] z-[60] flex flex-col items-center gap-2 px-4"
	role="status"
	aria-live="polite"
>
	{#each toasts as t (t.id)}
		<button
			type="button"
			class={[
				'card pointer-events-auto cursor-pointer px-4 py-2.5 text-sm font-bold',
				t.tone === 'error' ? 'bg-orange' : 'bg-teal'
			]}
			onclick={() => dismiss(t.id)}
			in:fly={{ y: -16, duration: 180 }}
			out:fly={{ y: -16, duration: 150 }}
		>
			{t.message}
		</button>
	{/each}
</div>
