<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShoppingBasket from '@lucide/svelte/icons/shopping-basket';
	import Store from '@lucide/svelte/icons/store';
	import Logo from '$lib/components/Logo.svelte';
	import Toasts from '$lib/components/Toasts.svelte';

	let { data, children } = $props();

	const nav = $derived([
		{ href: resolve('/'), label: 'Recherche', icon: SearchIcon, tone: 'bg-orange', count: 0 },
		{
			href: resolve('/cart'),
			label: 'Panier',
			icon: ShoppingBasket,
			tone: 'bg-violet',
			count: data.counts.cart
		},
		{
			href: resolve('/bookstore'),
			label: 'Librairie',
			icon: Store,
			tone: 'bg-teal',
			count: data.counts.requested + data.counts.confirmed
		},
		{
			href: resolve('/owned'),
			label: 'Possédés',
			icon: LibraryBig,
			tone: 'bg-ink text-cream',
			count: data.counts.owned
		},
		{
			href: resolve('/later'),
			label: 'Plus tard',
			icon: Hourglass,
			tone: 'bg-violet-soft',
			count: data.counts.postponed
		}
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<div class="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-16">
	<header class="sticky top-0 z-40 border-b-[3px] border-ink bg-cream/95 backdrop-blur-sm">
		<div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
			<a
				href={resolve('/')}
				class="flex shrink-0 items-center gap-2"
				aria-label="BookMarkMark, recherche"
			>
				<Logo class="h-9 w-auto -rotate-6" />
				<span class="text-lg leading-none font-extrabold tracking-tight uppercase">
					BookMark<span
						class="ml-0.5 inline-block rotate-[-5deg] rounded-md border-2 border-ink bg-teal px-1 py-0.5 shadow-brutal-xs"
						>Mark</span
					>
				</span>
			</a>

			<nav class="ml-auto hidden gap-2 md:flex" aria-label="Principal">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class={['btn btn-sm', isActive(item.href) && item.tone]}
					>
						<item.icon class="size-4" />
						{item.label}
						{#if item.count}
							<span
								class="rounded-full border-2 border-ink bg-paper px-1.5 font-mono text-[0.65rem] text-ink"
							>
								{item.count}
							</span>
						{/if}
					</a>
				{/each}
			</nav>

			<a
				href={resolve('/settings')}
				aria-label="Réglages"
				aria-current={isActive('/settings') ? 'page' : undefined}
				class={['btn btn-sm ml-auto px-2 md:ml-0', isActive('/settings') && 'bg-orange']}
			>
				<SettingsIcon class="size-4" />
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-4 pt-7">
		{@render children()}
	</main>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
		aria-label="Principal"
	>
		<ul class="grid grid-cols-5">
			{#each nav as item (item.href)}
				<li>
					<a
						href={item.href}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class="flex flex-col items-center gap-1 pt-2 pb-2.5 text-[0.68rem] font-bold tracking-wide uppercase"
					>
						<span
							class={[
								'relative grid h-8 w-12 place-items-center rounded-lg border-2',
								isActive(item.href)
									? [item.tone, 'border-ink shadow-brutal-xs']
									: 'border-transparent'
							]}
						>
							<item.icon class="size-5" />
							{#if item.count}
								<span
									class="absolute -top-2 -right-2.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-orange px-1 font-mono text-[0.6rem] text-ink"
								>
									{item.count}
								</span>
							{/if}
						</span>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<Toasts />
</div>
