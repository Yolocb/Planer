<script lang="ts">
	import { PERSONS } from '$lib/constants/persons';
</script>

<!-- Read-only colour key. There is no per-person filtering: everyone always
     sees all entries; this bar just maps each colour to a family member. -->
<div
	class="flex gap-2 overflow-x-auto border-b border-black/5 bg-surface px-3 py-2 dark:border-white/10"
	role="list"
	aria-label="Familienmitglieder"
>
	{#each PERSONS as person (person.id)}
		<span
			role="listitem"
			class="flex min-h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
			style={`background-color: ${person.color};`}
		>
			<span class="grid size-4 place-items-center rounded-full bg-white/30 text-[9px] font-bold">
				{person.initial}
			</span>
			{person.name}
		</span>
	{/each}
</div>
