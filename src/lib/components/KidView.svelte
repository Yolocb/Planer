<script lang="ts">
	import { get } from 'svelte/store';
	import { flip } from 'svelte/animate';
	import { CalendarDays, ListChecks, PartyPopper } from '@lucide/svelte';
	import { chores, toggleChore, dueChores, todayIso } from '$lib/stores/chores';
	import { events } from '$lib/stores/events';
	import { settings } from '$lib/stores/settings';
	import { expandRecurrences } from '$lib/utils/recurrence';
	import {
		getContrastText,
		getEventDisplayColor,
		getPersonColor,
		isGradient
	} from '$lib/utils/colors';
	import { weekdayName } from '$lib/utils/datetime';
	import { celebrate } from '$lib/utils/confetti';
	import { getCategoryMeta } from '$lib/constants/categories';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { CalendarEvent } from '$lib/types';

	const KID = 'feli' as const;

	const today = new Date();
	const todayLabel = `${weekdayName(today)}, ${today.toLocaleDateString('de-DE', {
		day: '2-digit',
		month: 'long'
	})}`;

	// Today's chores for Feli (due today + overdue), reactive to the store.
	const todaysChores = $derived(dueChores($chores, KID, todayIso()));
	const doneCount = $derived(todaysChores.filter((c) => c.completed).length);
	const total = $derived(todaysChores.length);
	const allDone = $derived(total > 0 && doneCount === total);

	// Today's events that involve Feli (or the whole family).
	const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
	const todaysEvents = $derived(
		expandRecurrences($events, dayStart, dayEnd)
			.filter((e) => e.personIds.includes(KID) || e.personIds.includes('family'))
			.sort((a, b) => a.start.localeCompare(b.start))
	);

	function eventTime(e: CalendarEvent): string {
		if (e.allDay) return 'ganztägig';
		return new Date(e.start).toLocaleTimeString('de-DE', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: $settings.timeFormat === '12h'
		});
	}

	async function onToggle(id: string) {
		const nowDone = await toggleChore(id);
		if (!nowDone) return;
		// Was this the last open chore? Then throw a bigger party.
		const remaining = dueChores(get(chores), KID, todayIso()).filter((c) => !c.completed).length;
		celebrate({ big: remaining === 0 });
	}
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto px-4 py-4">
	<!-- Greeting -->
	<div>
		<h2 class="text-2xl font-extrabold">Hallo Feli! <span aria-hidden="true">🌟</span></h2>
		<p class="text-sm opacity-60">{todayLabel}</p>
	</div>

	<!-- Progress -->
	{#if total > 0}
		<div class="rounded-2xl bg-feli/15 px-4 py-3">
			<p class="text-base font-bold text-feli">
				{#if allDone}
					🎉 Alles geschafft! Super gemacht!
				{:else}
					{doneCount} von {total} geschafft!
				{/if}
			</p>
			<div class="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
				<div
					class="h-full rounded-full bg-feli transition-all duration-300"
					style={`width: ${total ? (doneCount / total) * 100 : 0}%`}
				></div>
			</div>
		</div>
	{/if}

	<!-- Today's events -->
	{#if todaysEvents.length}
		<section>
			<h3 class="mb-2 flex items-center gap-1.5 text-sm font-bold opacity-70">
				<CalendarDays size={16} aria-hidden="true" /> Heute
			</h3>
			<div class="space-y-2">
				{#each todaysEvents as e (e.id)}
					{@const color = getEventDisplayColor(e)}
					<div
						class="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm"
						style={`color: ${getContrastText(color)}; ${
							isGradient(color) ? `background: ${color};` : `background-color: ${color};`
						}`}
					>
						<span class="text-lg font-bold tabular-nums">{eventTime(e)}</span>
						<span class="min-w-0 flex-1 truncate text-base font-semibold">{e.title}</span>
						{#if e.category}
							<span class="text-xl" aria-hidden="true">{getCategoryMeta(e.category).icon}</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Chores -->
	<section>
		<h3 class="mb-2 flex items-center gap-1.5 text-sm font-bold opacity-70">
			<ListChecks size={16} aria-hidden="true" /> Meine Aufgaben
		</h3>
		{#if total === 0}
			<div class="rounded-2xl bg-surface shadow-sm">
				<EmptyState
					icon={PartyPopper}
					title="Heute keine Aufgaben! 🎈"
					subtitle="Alles frei — genieß deinen Tag!"
				/>
			</div>
		{:else}
			<div class="space-y-2">
				{#each todaysChores as c (c.id)}
					<button
						type="button"
						animate:flip={{ duration: 300 }}
						onclick={() => onToggle(c.id)}
						aria-pressed={c.completed}
						class="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left shadow-sm transition-transform active:scale-[0.98]"
					>
						<span
							class="grid size-8 shrink-0 place-items-center rounded-full border-2 text-lg font-bold transition-colors {c.completed
								? 'border-feli bg-feli'
								: 'border-black/20 text-transparent dark:border-white/25'}"
							style={c.completed ? `color: ${getContrastText(getPersonColor('feli'))};` : ''}
							aria-hidden="true"
						>
							✓
						</span>
						<span
							class="flex-1 text-lg font-semibold {c.completed ? 'text-text/50 line-through' : ''}"
						>
							{c.title}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</section>
</div>
