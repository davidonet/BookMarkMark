<script lang="ts">
	import { STATUS_LABEL, type Status } from '$lib/types';

	let { status }: { status: Status } = $props();

	const TONE: Record<Status, string> = {
		cart: 'bg-violet',
		requested: 'bg-teal-soft',
		confirmed: 'bg-teal',
		owned: 'bg-ink text-cream',
		postponed: 'bg-violet-soft'
	};
</script>

<span class={['chip', TONE[status]]}>{STATUS_LABEL[status]}</span>
