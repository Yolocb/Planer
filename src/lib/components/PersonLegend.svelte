<script lang="ts">
	import { PERSONS } from '$lib/constants/persons';
</script>

<!-- Read-only colour key. There is no per-person filtering: everyone always
     sees all entries; this bar just maps each colour to a family member.
     Soft-tint pills + a solid colour badge — mirrors the event-pill styling. -->
<div
	class="flex gap-2 overflow-x-auto px-3 py-2"
	style="border-bottom: 1px solid var(--hairline);"
	role="list"
	aria-label="Familienmitglieder"
>
	{#each PERSONS as person (person.id)}
		<span
			role="listitem"
			class="flex min-h-9 flex-shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium"
			style={`background-color: color-mix(in srgb, ${person.color} 15%, var(--color-surface)); color: var(--color-text);`}
		>
			<span
				class="grid size-6 place-items-center rounded-full text-[10px] font-bold text-white"
				style={`background-color: ${person.color};`}
			>
				{person.initial}
			</span>
			{person.name}
		</span>
	{/each}
</div>
