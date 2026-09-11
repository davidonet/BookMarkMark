<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	/** True while some summaries and prices are still being looked up on the server. */
	let { active }: { active: boolean } = $props();

	$effect(() => {
		if (!active) return;
		const started = Date.now();
		const timer = setInterval(() => {
			// Give up after a while: a failed lookup is retried on a later visit.
			if (Date.now() - started > 3 * 60_000) clearInterval(timer);
			else void invalidateAll();
		}, 5_000);
		return () => clearInterval(timer);
	});
</script>
