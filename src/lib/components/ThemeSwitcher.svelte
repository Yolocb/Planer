<script lang="ts">
	import { settings } from '$lib/stores/settings';
	import type { PaletteSetting } from '$lib/types';

	const PALETTES: { id: PaletteSetting; name: string; swatch: string; hint: string }[] = [
		{
			id: 'modern',
			name: 'Modern',
			swatch: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
			hint: 'Sleek & klar'
		},
		{
			id: 'feminin',
			name: 'Feminin',
			swatch: 'linear-gradient(135deg,#e0699a,#b57edc)',
			hint: 'Sanft & elegant'
		},
		{
			id: 'kind',
			name: 'Kind',
			swatch: 'linear-gradient(135deg,#ff8a3d,#ff6b9d)',
			hint: 'Bunt & verspielt'
		}
	];

	let open = $state(false);

	function choose(id: PaletteSetting) {
		settings.patch({ palette: id });
		open = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="Farbthema wählen"
		class="grid min-h-9 min-w-9 place-items-center rounded-full bg-black/5 text-base hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
	>
		<span aria-hidden="true">🎨</span>
	</button>

	{#if open}
		<!-- Click-away backdrop -->
		<button
			type="button"
			class="fixed inset-0 z-30 cursor-default"
			aria-label="Schließen"
			onclick={() => (open = false)}
		></button>

		<div
			role="menu"
			aria-label="Farbthema"
			class="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-black/5 bg-surface p-1.5 shadow-xl dark:border-white/10"
		>
			{#each PALETTES as p (p.id)}
				{@const active = $settings.palette === p.id}
				<button
					type="button"
					role="menuitemradio"
					aria-checked={active}
					onclick={() => choose(p.id)}
					class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10 {active
						? 'bg-black/5 dark:bg-white/10'
						: ''}"
				>
					<span
						class="size-6 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
						style={`background: ${p.swatch};`}
						aria-hidden="true"
					></span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold">{p.name}</span>
						<span class="block text-xs opacity-60">{p.hint}</span>
					</span>
					{#if active}
						<span class="text-sm font-bold text-accent" aria-hidden="true">✓</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
