<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		text?: string;
		class?: string;
		children?: Snippet;
	}

	let { title, text, class: className = 'bg-paper', children }: Props = $props();
</script>

<div class={['card flex flex-col items-center gap-3 px-6 py-10 text-center', className]}>
	<p class="text-2xl leading-tight font-extrabold uppercase">{title}</p>
	{#if text}
		<p class="max-w-sm text-ink/75">{text}</p>
	{/if}
	{@render children?.()}
</div>
