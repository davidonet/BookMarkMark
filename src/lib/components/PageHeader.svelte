<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'orange' | 'violet' | 'teal' | 'ink' | 'lilac';

	interface Props {
		title: string;
		kicker?: string;
		tone?: Tone;
		children?: Snippet;
	}

	let { title, kicker, tone = 'orange', children }: Props = $props();

	const TONES: Record<Tone, string> = {
		orange: 'bg-orange',
		violet: 'bg-violet',
		teal: 'bg-teal',
		ink: 'bg-ink text-cream',
		lilac: 'bg-violet-soft'
	};
</script>

<header class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		{#if kicker}
			<p class="label mb-2 text-ink/70">{kicker}</p>
		{/if}
		<h1
			class={[
				'inline-block -rotate-1 rounded-xl border-[3px] border-ink px-4 py-2 text-3xl leading-none font-extrabold tracking-tight uppercase shadow-brutal sm:text-4xl',
				TONES[tone]
			]}
		>
			{title}
		</h1>
	</div>
	{@render children?.()}
</header>
