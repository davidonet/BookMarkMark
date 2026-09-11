<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 36 44" class={className} aria-hidden="true">
	<path
		d="M5 3.5h26v36.5l-13-8.5-13 8.5z"
		fill="var(--color-orange)"
		stroke="var(--color-ink)"
		stroke-width="3.5"
		stroke-linejoin="round"
	/>
	<path
		d="M11.5 16.5l5 5 8.5-9"
		fill="none"
		stroke="var(--color-ink)"
		stroke-width="3.8"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
