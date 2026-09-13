<script lang="ts">
	import { onMount } from 'svelte';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		/** Called with a raw ISBN (digits, maybe a trailing X) each time one is found. */
		onscan: (isbn: string) => void;
		onclose: () => void;
	}

	let { onscan, onclose }: Props = $props();

	let video: HTMLVideoElement | undefined = $state();
	let error = $state('');
	let manual = $state(false);
	let manualIsbn = $state('');

	/** EAN-13 with the "Bookland" prefix: what a book's back-cover barcode actually encodes. */
	const isBookEan = (code: string) => /^97[89]\d{10}$/.test(code);

	onMount(() => {
		let stream: MediaStream | undefined;
		let raf = 0;
		let stopped = false;
		let paused = false;

		(async () => {
			let detector: InstanceType<Awaited<typeof import('barcode-detector')>['BarcodeDetector']>;
			try {
				const [{ BarcodeDetector }, userStream] = await Promise.all([
					import('barcode-detector'),
					navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
				]);
				stream = userStream;
				detector = new BarcodeDetector({ formats: ['ean_13'] });
			} catch {
				error = "Impossible d'accéder à la caméra. Saisissez l'ISBN à la main.";
				manual = true;
				return;
			}
			if (stopped) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}

			if (video) {
				video.srcObject = stream;
				await video.play().catch(() => {});
			}

			const tick = async () => {
				if (stopped) return;
				if (!paused && video && video.readyState >= 2) {
					try {
						const codes = await detector.detect(video);
						const hit = codes.map((c) => c.rawValue).find(isBookEan);
						if (hit) {
							paused = true;
							onscan(hit);
							setTimeout(() => (paused = false), 1500);
						}
					} catch {
						// A frame failed to decode: just try the next one.
					}
				}
				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		})();

		return () => {
			stopped = true;
			cancelAnimationFrame(raf);
			stream?.getTracks().forEach((t) => t.stop());
		};
	});

	function submitManual() {
		const isbn = manualIsbn.replace(/[^0-9Xx]/g, '');
		if (isbn) onscan(isbn);
		manualIsbn = '';
	}
</script>

<div class="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4">
	<div class="card relative w-full max-w-sm bg-paper p-4">
		<button
			type="button"
			class="btn btn-sm btn-ghost absolute -top-3 -right-3 rounded-full bg-paper"
			aria-label="Fermer le scanner"
			onclick={onclose}
		>
			<X class="size-4" />
		</button>
		<h2 class="mb-3 text-center text-lg font-extrabold uppercase">Scanner un code-barres</h2>

		{#if !manual}
			<div class="relative aspect-[4/3] overflow-hidden rounded-xl border-[3px] border-ink bg-ink">
				<video bind:this={video} class="size-full object-cover" playsinline muted></video>
				<div
					class="pointer-events-none absolute inset-8 rounded-lg border-4 border-orange"
					style="box-shadow: 0 0 0 999px rgba(0,0,0,0.4)"
				></div>
			</div>
			<p class="mt-3 text-center text-sm text-ink/70">Visez le code-barres au dos du livre.</p>
		{/if}

		{#if error}
			<p
				class="mt-3 rounded-xl border-[3px] border-dashed border-ink bg-orange-soft/70 p-3 text-sm"
			>
				{error}
			</p>
		{/if}

		<div class="mt-4">
			{#if manual}
				<label class="label mb-1.5 block" for="manual-isbn">ISBN</label>
				<div class="flex gap-2">
					<input
						id="manual-isbn"
						class="input flex-1"
						inputmode="numeric"
						autocomplete="off"
						placeholder="978…"
						bind:value={manualIsbn}
						onkeydown={(e) => e.key === 'Enter' && submitManual()}
					/>
					<button type="button" class="btn bg-orange" onclick={submitManual}>Ajouter</button>
				</div>
			{:else}
				<button
					type="button"
					class="btn btn-sm btn-ghost mx-auto flex"
					onclick={() => (manual = true)}
				>
					<Keyboard class="size-4" /> Saisir l'ISBN à la main
				</button>
			{/if}
		</div>
	</div>
</div>
