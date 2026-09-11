<script lang="ts">
	interface Props {
		/** Thumbnail URL from the catalog. */
		cover: string | null;
		title: string;
		class?: string;
	}

	let { cover, title, class: className = '' }: Props = $props();

	const TONES = [
		'bg-orange',
		'bg-violet',
		'bg-teal',
		'bg-orange-soft',
		'bg-violet-soft',
		'bg-teal-soft'
	];
	// Stable colour per title, also shown behind the image while it loads.
	const tone = $derived(
		TONES[[...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length]
	);
	let failed = $state(false);
</script>

<!-- A span so it can sit inside buttons. -->
<span
	class={[
		'relative block aspect-[2/3] shrink-0 overflow-hidden rounded-lg border-[3px] border-ink shadow-brutal-xs',
		tone,
		className
	]}
>
	{#if cover && !failed}
		<img
			src={cover}
			alt=""
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			class="size-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span
			class="flex size-full items-center justify-center p-1.5 text-center text-[0.6rem] leading-tight font-extrabold break-words uppercase"
		>
			{title}
		</span>
	{/if}
</span>
