<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		/** A lucide icon component. */
		icon: Component;
		title: string;
		subtitle?: string;
	}

	let { icon: Icon, title, subtitle }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
	<span class="grid size-14 place-items-center rounded-2xl bg-black/5 text-accent dark:bg-white/10">
		<Icon size={28} aria-hidden="true" />
	</span>
	<p class="text-sm font-semibold">{title}</p>
	{#if subtitle}
		<p class="max-w-[16rem] text-xs opacity-60">{subtitle}</p>
	{/if}
</div>
