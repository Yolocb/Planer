<script lang="ts">
	import { PERSONS } from '$lib/constants/persons';
	import { settings } from '$lib/stores/settings';
	import type { EventOwnerId } from '$lib/types';

	function isActive(id: EventOwnerId, active: EventOwnerId[]): boolean {
		return active.includes(id);
	}

	function toggle(id: EventOwnerId) {
		settings.update((s) => {
			const activeFilters = s.activeFilters.includes(id)
				? s.activeFilters.filter((x) => x !== id)
				: [...s.activeFilters, id];
			return { ...s, activeFilters };
		});
	}
</script>

<div
	class="flex gap-2 overflow-x-auto border-b border-black/5 bg-surface px-3 py-2 dark:border-white/10"
	role="group"
	aria-label="Nach Person filtern"
>
	{#each PERSONS as person (person.id)}
		{@const active = isActive(person.id, $settings.activeFilters)}
		<button
			type="button"
			onclick={() => toggle(person.id)}
			aria-pressed={active}
			class="flex min-h-9 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-opacity"
			class:opacity-40={!active}
			style={active
				? `background-color: ${person.color}; border-color: ${person.color}; color: white;`
				: `border-color: ${person.color}; color: ${person.color};`}
		>
			<span
				class="grid size-4 place-items-center rounded-full text-[9px] font-bold"
				style={active
					? 'background-color: rgba(255,255,255,0.3); color: white;'
					: `background-color: ${person.color}; color: white;`}
			>
				{person.initial}
			</span>
			{person.name}
		</button>
	{/each}
</div>
