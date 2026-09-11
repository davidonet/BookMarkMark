<script lang="ts">
	import './layout.css';
	import '@fontsource-variable/jost';
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>BookMarkMark</title>
</svelte:head>

{@render children()}
