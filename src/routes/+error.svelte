<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
</script>

<svelte:head>
	<title>Oups · BookMarkMark</title>
</svelte:head>

<main class="grid min-h-dvh place-items-center p-6">
	<div class="card max-w-md rotate-1 bg-paper p-8 text-center">
		<Logo class="mx-auto h-14 w-auto" />
		<p class="label mt-4">Erreur {page.status}</p>
		<h1 class="mt-2 text-3xl leading-tight font-extrabold uppercase">
			{page.status === 404 ? 'Page introuvable' : "Une erreur s'est produite"}
		</h1>
		{#if page.error?.message && page.status !== 404}
			<p class="mt-3 text-ink/70">{page.error.message}</p>
		{/if}
		<a href={resolve('/')} class="btn mt-6 bg-orange">Retour à la recherche</a>
	</div>
</main>
