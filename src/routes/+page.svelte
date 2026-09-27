<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import CalendarView from '$lib/components/CalendarView.svelte';
	import type { FcViewId } from '$lib/components/CalendarView.svelte';
	import PersonFilterBar from '$lib/components/PersonFilterBar.svelte';
	import { filteredEvents, loadEvents, eventsLoaded } from '$lib/stores/events';
	import { settings } from '$lib/stores/settings';
	import type { CalendarEvent, CalendarViewId } from '$lib/types';

	const VIEW_MAP: Record<CalendarViewId, FcViewId> = {
		week: 'timeGridWeek',
		month: 'dayGridMonth',
		day: 'timeGridDay',
		agenda: 'listWeek'
	};

	const NAV_ITEMS: { id: CalendarViewId; label: string; icon: string }[] = [
		{ id: 'week', label: 'Woche', icon: '🗓️' },
		{ id: 'month', label: 'Monat', icon: '📆' },
		{ id: 'agenda', label: 'Agenda', icon: '📋' }
	];

	let currentTab = $state<CalendarViewId>(get(settings).defaultView);
	let rangeTitle = $state('');
	let calApi = $state<{ today: () => void; prev: () => void; next: () => void } | undefined>(
		undefined
	);

	const fcView = $derived(VIEW_MAP[currentTab] ?? 'timeGridWeek');

	// Swipe navigation (mobile): horizontal drag → prev/next.
	let touchStartX = 0;
	let touchStartY = 0;
	function onTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].clientX;
		touchStartY = e.changedTouches[0].clientY;
	}
	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
			if (dx < 0) calApi?.next();
			else calApi?.prev();
		}
	}

	function goToday() {
		calApi?.today();
	}

	function handleEventClick(event: CalendarEvent) {
		// EventDetailSheet lands in Sprint 3.
		console.log('Event tapped:', event);
	}

	function handleSlotSelect(sel: { start: Date; end: Date; allDay: boolean }) {
		// Pre-filled EventModal lands in Sprint 3.
		console.log('Slot selected:', sel);
	}

	function openAddEvent() {
		console.log('FAB tapped → open Add Event modal (Sprint 3)');
	}

	onMount(() => {
		loadEvents();
	});
</script>

<div class="flex h-dvh flex-col bg-bg text-text">
	<!-- Header: title + date-range navigation -->
	<header class="border-b border-black/5 bg-surface shadow-sm dark:border-white/10">
		<div class="flex items-center justify-between px-4 pt-3">
			<h1 class="text-lg font-bold tracking-tight">
				<span class="text-christian">Family</span><span class="text-family">Cal</span>
			</h1>
			<button
				type="button"
				aria-label="Menü öffnen"
				class="grid size-11 place-items-center rounded-full text-xl hover:bg-black/5 dark:hover:bg-white/10"
			>
				☰
			</button>
		</div>
		<div class="flex items-center justify-between px-2 pb-2">
			<button
				type="button"
				aria-label="Vorheriger Zeitraum"
				onclick={() => calApi?.prev()}
				class="grid size-10 place-items-center rounded-full text-xl hover:bg-black/5 dark:hover:bg-white/10"
			>
				‹
			</button>
			<span class="text-sm font-semibold">{rangeTitle}</span>
			<button
				type="button"
				aria-label="Nächster Zeitraum"
				onclick={() => calApi?.next()}
				class="grid size-10 place-items-center rounded-full text-xl hover:bg-black/5 dark:hover:bg-white/10"
			>
				›
			</button>
		</div>
	</header>

	<!-- Person filter bar (doubles as the always-visible colour legend) -->
	<PersonFilterBar />

	<!-- Calendar -->
	<main
		class="relative flex-1 overflow-hidden p-2"
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
	>
		{#if !$eventsLoaded}
			<div class="grid h-full place-items-center text-sm opacity-60">Lade Termine…</div>
		{/if}
		<CalendarView
			view={fcView}
			events={$filteredEvents}
			weekStartsOn={$settings.weekStartsOn}
			timeFormat={$settings.timeFormat}
			onEventClick={handleEventClick}
			onSlotSelect={handleSlotSelect}
			onRangeChange={(t) => (rangeTitle = t)}
			bind:api={calApi}
		/>
	</main>

	<!-- Floating Action Button -->
	<button
		type="button"
		onclick={openAddEvent}
		aria-label="Termin hinzufügen"
		class="fixed bottom-20 right-4 z-20 grid size-14 place-items-center rounded-full text-3xl text-white shadow-lg transition-transform active:scale-95"
		style="background-color: var(--color-family)"
	>
		+
	</button>

	<!-- Bottom navigation -->
	<nav
		class="flex items-stretch justify-around border-t border-black/5 bg-surface pb-[env(safe-area-inset-bottom)] dark:border-white/10"
	>
		<button
			type="button"
			onclick={goToday}
			class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs opacity-60"
		>
			<span class="text-lg" aria-hidden="true">📍</span>
			Heute
		</button>
		{#each NAV_ITEMS as item (item.id)}
			<button
				type="button"
				onclick={() => (currentTab = item.id)}
				aria-current={currentTab === item.id ? 'page' : undefined}
				class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {currentTab ===
				item.id
					? 'font-semibold text-christian'
					: 'opacity-60'}"
			>
				<span class="text-lg" aria-hidden="true">{item.icon}</span>
				{item.label}
			</button>
		{/each}
	</nav>
</div>
