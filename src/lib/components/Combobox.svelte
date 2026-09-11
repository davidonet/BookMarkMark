<script lang="ts">
	import { tick } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';

	interface Props {
		/** Free text; remembered server-side, offered again next time. */
		value?: string;
		options: string[];
		name: string;
		id?: string;
		placeholder?: string;
		/** Open the list above the field (for bars stuck to the bottom of the screen). */
		placement?: 'up' | 'down';
		newLabel?: string;
		maxlength?: number;
		/** Called when the value is picked or edited then left: used for autosave. */
		oncommit?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		options,
		name,
		id,
		placeholder = '',
		placement = 'down',
		newLabel = 'New',
		maxlength = 60,
		oncommit
	}: Props = $props();

	const uid = $props.id();
	const inputId = $derived(id ?? `${uid}-input`);
	const listId = `${uid}-list`;

	let input: HTMLInputElement | undefined = $state();
	let open = $state(false);
	let active = $state(-1);
	/** Filter only once the user types: on focus, every option is offered. */
	let typing = $state(false);
	/** Value when the field got focus: only commit real changes. */
	let committed = '';

	const current = $derived(value.trim().toLocaleLowerCase());
	const query = $derived(typing ? current : '');
	const items = $derived.by(() => {
		const list = (query ? options.filter((o) => o.toLocaleLowerCase().includes(query)) : options)
			.slice(0, query ? 8 : 12)
			.map((o) => ({ value: o, isNew: false }));
		if (query && !options.some((o) => o.toLocaleLowerCase() === query)) {
			list.push({ value: value.trim(), isNew: true });
		}
		return list;
	});
	const expanded = $derived(open && items.length > 0);

	async function commit(next: string) {
		value = next;
		open = false;
		typing = false;
		active = -1;
		await tick();
		if (oncommit && next.trim() !== committed.trim()) {
			committed = next;
			oncommit(next.trim());
		}
	}

	function onkeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				open = true;
				active = items.length ? (active + 1) % items.length : -1;
				break;
			case 'ArrowUp':
				event.preventDefault();
				open = true;
				active = items.length ? (active <= 0 ? items.length - 1 : active - 1) : -1;
				break;
			case 'Enter':
				if (expanded && active >= 0) {
					event.preventDefault();
					void commit(items[active].value);
				} else if (oncommit) {
					event.preventDefault();
					void commit(value);
				} else {
					open = false;
				}
				break;
			case 'Escape':
				if (open) {
					event.preventDefault();
					open = false;
					active = -1;
				}
				break;
		}
	}
</script>

<div class="relative">
	<input
		bind:this={input}
		bind:value
		id={inputId}
		{name}
		{placeholder}
		{maxlength}
		type="text"
		class="input pr-11"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={expanded}
		aria-controls={listId}
		aria-activedescendant={expanded && active >= 0 ? `${uid}-opt-${active}` : undefined}
		autocomplete="off"
		autocapitalize="sentences"
		enterkeyhint="done"
		onfocus={() => {
			committed = value;
			typing = false;
			open = true;
		}}
		oninput={() => {
			typing = true;
			open = true;
			active = -1;
		}}
		onblur={() => {
			open = false;
			if (oncommit) void commit(value);
		}}
		{onkeydown}
	/>
	<button
		type="button"
		tabindex="-1"
		aria-label="Show suggestions"
		class="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => {
			open = !open;
			input?.focus();
		}}
	>
		<ChevronDown class={['size-5 transition-transform', expanded && 'rotate-180']} />
	</button>

	<!-- Options are picked with the mouse or with the arrow keys from the input (aria-activedescendant). -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<ul
		id={listId}
		role="listbox"
		hidden={!expanded}
		class={[
			'absolute inset-x-0 z-50 max-h-64 overflow-auto rounded-xl border-[3px] border-ink bg-paper p-1 shadow-brutal',
			placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
		]}
		onmousedown={(e) => e.preventDefault()}
	>
		{#each items as item, i ((item.isNew ? 'new:' : 'opt:') + item.value)}
			<li
				id={`${uid}-opt-${i}`}
				role="option"
				aria-selected={i === active}
				class={[
					'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-medium pointer-coarse:py-3',
					i === active ? 'bg-orange' : 'hover:bg-cream'
				]}
				onclick={() => commit(item.value)}
				onmouseenter={() => (active = i)}
			>
				{#if item.isNew}
					<Plus class="size-4 shrink-0" />
					<span class="label shrink-0">{newLabel}</span>
					<span class="truncate">“{item.value}”</span>
				{:else}
					<span class="truncate">{item.value}</span>
					{#if item.value.toLocaleLowerCase() === current}
						<Check class="ml-auto size-4 shrink-0" strokeWidth={3} />
					{/if}
				{/if}
			</li>
		{/each}
	</ul>
</div>
