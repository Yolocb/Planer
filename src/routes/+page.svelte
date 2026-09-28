<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import {
		Settings,
		ListChecks,
		ChevronLeft,
		ChevronRight,
		CalendarRange,
		CalendarDays,
		ListTodo,
		LocateFixed,
		Plus
	} from '@lucide/svelte';
	import type { FcViewId } from '$lib/components/CalendarView.svelte';
	import PersonLegend from '$lib/components/PersonLegend.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import {
		events,
		filteredEvents,
		loadEvents,
		eventsLoaded,
		createEvent,
		updateEvent,
		removeEvent,
		deleteOccurrence,
		deleteFutureOccurrences,
		deleteSeries,
		updateOccurrence,
		updateFutureOccurrences,
		updateSeries,
		type NewEventData
	} from '$lib/stores/events';
	import { settings } from '$lib/stores/settings';
	import { loadChores, createChore, updateChore, type NewChoreData } from '$lib/stores/chores';
	import { isOccurrenceId, masterIdOf } from '$lib/utils/recurrence';
	import type { CalendarEvent, CalendarViewId, Chore } from '$lib/types';

	const VIEW_MAP: Record<CalendarViewId, FcViewId> = {
		week: 'timeGridWeek',
		month: 'dayGridMonth',
		day: 'timeGridDay',
		agenda: 'listWeek'
	};

	const NAV_ITEMS: { id: CalendarViewId; label: string; icon: Component }[] = [
		{ id: 'week', label: 'Woche', icon: CalendarRange },
		{ id: 'month', label: 'Monat', icon: CalendarDays },
		{ id: 'agenda', label: 'Agenda', icon: ListTodo }
	];

	let currentTab = $state<CalendarViewId>(get(settings).defaultView);
	/** When true, the playful kid view replaces the calendar. */
	let kidMode = $state(false);
	let rangeTitle = $state('');
	let calApi = $state<{ today: () => void; prev: () => void; next: () => void } | undefined>(
		undefined
	);

	const fcView = $derived(VIEW_MAP[currentTab] ?? 'timeGridWeek');

	// --- Lazy-loaded components: kept off the initial parse path. Each is loaded
	// on first use and cached; onMount also prefetches them on idle so the first
	// open is instant while the initial bundle stays small. The types come from
	// each module's default export (the Svelte 5 functional component type), so
	// props and bindings stay fully checked at the render sites below. ---
	type CalendarViewType = (typeof import('$lib/components/CalendarView.svelte'))['default'];
	type EventModalType = (typeof import('$lib/components/EventModal.svelte'))['default'];
	type EventDetailSheetType = (typeof import('$lib/components/EventDetailSheet.svelte'))['default'];
	type RecurrenceScopeDialogType =
		(typeof import('$lib/components/RecurrenceScopeDialog.svelte'))['default'];
	type ChoresSheetType = (typeof import('$lib/components/ChoresSheet.svelte'))['default'];
	type ChoreModalType = (typeof import('$lib/components/ChoreModal.svelte'))['default'];
	type KidViewType = (typeof import('$lib/components/KidView.svelte'))['default'];

	let CalendarViewComp = $state<CalendarViewType | null>(null);
	let EventModalComp = $state<EventModalType | null>(null);
	let EventDetailSheetComp = $state<EventDetailSheetType | null>(null);
	let RecurrenceScopeDialogComp = $state<RecurrenceScopeDialogType | null>(null);
	let ChoresSheetComp = $state<ChoresSheetType | null>(null);
	let ChoreModalComp = $state<ChoreModalType | null>(null);
	let KidViewComp = $state<KidViewType | null>(null);

	async function loadEventModal() {
		if (!EventModalComp)
			EventModalComp = (await import('$lib/components/EventModal.svelte')).default;
	}
	async function loadDetailSheet() {
		if (!EventDetailSheetComp)
			EventDetailSheetComp = (await import('$lib/components/EventDetailSheet.svelte')).default;
	}
	async function loadScopeDialog() {
		if (!RecurrenceScopeDialogComp)
			RecurrenceScopeDialogComp = (await import('$lib/components/RecurrenceScopeDialog.svelte'))
				.default;
	}
	async function loadChoresSheet() {
		if (!ChoresSheetComp)
			ChoresSheetComp = (await import('$lib/components/ChoresSheet.svelte')).default;
	}
	async function loadChoreModal() {
		if (!ChoreModalComp)
			ChoreModalComp = (await import('$lib/components/ChoreModal.svelte')).default;
	}
	async function loadKidView() {
		if (!KidViewComp) KidViewComp = (await import('$lib/components/KidView.svelte')).default;
	}

	async function openKidView() {
		await loadKidView();
		kidMode = true;
	}

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
		kidMode = false;
		calApi?.today();
	}

	// --- Event modal / detail / recurrence-scope orchestration ---
	let modalOpen = $state(false);
	let modalEvent = $state<CalendarEvent | null>(null);
	let modalInitial = $state<{
		start?: string;
		end?: string;
		allDay?: boolean;
	} | null>(null);
	/** When editing an occurrence, remember the series + occurrence for scoping. */
	let editCtx = $state<{ master: CalendarEvent | null; occurrenceIso: string } | null>(null);

	let detailOpen = $state(false);
	let detailEvent = $state<CalendarEvent | null>(null);
	let detailMaster = $state<CalendarEvent | null>(null);

	let scopeOpen = $state(false);
	let scopeMode = $state<'edit' | 'delete'>('edit');
	let scopeCtx = $state<{
		master: CalendarEvent | null;
		occurrenceIso: string;
		payload: NewEventData | null;
	} | null>(null);

	function findMaster(id: string): CalendarEvent | null {
		return get(events).find((e) => e.id === id) ?? null;
	}

	async function handleEventClick(event: CalendarEvent) {
		await loadDetailSheet();
		detailEvent = event;
		detailMaster = isOccurrenceId(event.id) ? findMaster(masterIdOf(event.id)) : null;
		detailOpen = true;
	}

	async function handleSlotSelect(sel: { start: Date; end: Date; allDay: boolean }) {
		await loadEventModal();
		modalEvent = null;
		editCtx = null;
		modalInitial = {
			start: sel.start.toISOString(),
			end: sel.end.toISOString(),
			allDay: sel.allDay
		};
		modalOpen = true;
	}

	async function openAddEvent() {
		await loadEventModal();
		modalEvent = null;
		editCtx = null;
		modalInitial = null; // modal defaults to the next full hour
		modalOpen = true;
	}

	async function startEdit() {
		const raw = detailEvent;
		if (!raw) return;
		await loadEventModal();
		detailOpen = false;
		if (isOccurrenceId(raw.id)) {
			const master = findMaster(masterIdOf(raw.id));
			// Edit series fields, but anchored at this occurrence's date/time.
			modalEvent = master ? { ...master, start: raw.start, end: raw.end } : raw;
			editCtx = { master, occurrenceIso: raw.start };
		} else {
			modalEvent = raw;
			editCtx = null;
		}
		modalInitial = null;
		modalOpen = true;
	}

	async function confirmDelete() {
		const raw = detailEvent;
		if (!raw) return;
		if (isOccurrenceId(raw.id)) {
			await loadScopeDialog();
			scopeCtx = {
				master: findMaster(masterIdOf(raw.id)),
				occurrenceIso: raw.start,
				payload: null
			};
			scopeMode = 'delete';
			detailOpen = false;
			scopeOpen = true;
		} else {
			detailOpen = false;
			await removeEvent(raw.id);
		}
	}

	async function handleSave(data: NewEventData) {
		modalOpen = false;
		if (!modalEvent) {
			await createEvent(data);
		} else if (editCtx?.master) {
			await loadScopeDialog();
			scopeCtx = { master: editCtx.master, occurrenceIso: editCtx.occurrenceIso, payload: data };
			scopeMode = 'edit';
			scopeOpen = true;
		} else {
			await updateEvent(modalEvent.id, data);
		}
	}

	async function handleScope(scope: 'this' | 'future' | 'all') {
		scopeOpen = false;
		const ctx = scopeCtx;
		scopeCtx = null;
		if (!ctx?.master) return;
		const { master, occurrenceIso, payload } = ctx;
		if (scopeMode === 'delete') {
			if (scope === 'this') await deleteOccurrence(master.id, occurrenceIso);
			else if (scope === 'future') await deleteFutureOccurrences(master.id, occurrenceIso);
			else await deleteSeries(master.id);
		} else if (payload) {
			if (scope === 'this') await updateOccurrence(master.id, occurrenceIso, payload);
			else if (scope === 'future') await updateFutureOccurrences(master.id, occurrenceIso, payload);
			else await updateSeries(master.id, payload);
		}
	}

	async function handleEventDrop(id: string, start: string, end: string, allDay: boolean) {
		await updateEvent(id, { start, end, allDay });
	}

	/**
	 * Global Escape-to-close. Dismisses only the topmost open layer so that, e.g.,
	 * closing the chore form (on top of the chores sheet) leaves the sheet open.
	 */
	function handleEscape(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		if (choreModalOpen) choreModalOpen = false;
		else if (modalOpen) modalOpen = false;
		else if (scopeOpen) scopeOpen = false;
		else if (detailOpen) detailOpen = false;
		else if (choresOpen) choresOpen = false;
		else return;
		e.preventDefault();
	}

	// --- Chores: family sheet + add/edit modal ---
	let choresOpen = $state(false);
	let choreModalOpen = $state(false);
	let choreEdit = $state<Chore | null>(null);

	async function openChores() {
		await loadChoresSheet();
		kidMode = false;
		choresOpen = true;
	}

	async function addChore() {
		await loadChoreModal();
		choreEdit = null;
		choreModalOpen = true;
	}

	async function editChore(chore: Chore) {
		await loadChoreModal();
		choreEdit = chore;
		choresOpen = false;
		choreModalOpen = true;
	}

	async function saveChore(data: NewChoreData) {
		choreModalOpen = false;
		if (choreEdit) await updateChore(choreEdit.id, data);
		else await createChore(data);
	}

	onMount(() => {
		loadEvents();
		loadChores();
		// Calendar is the default view — load it right away (skeleton covers the gap).
		import('$lib/components/CalendarView.svelte').then((m) => (CalendarViewComp = m.default));
		// Warm the on-demand chunks once the main thread is idle, so the first
		// open of any modal / kid view is instant without bloating initial parse.
		const prefetch = () => {
			loadEventModal();
			loadDetailSheet();
			loadScopeDialog();
			loadChoresSheet();
			loadChoreModal();
			loadKidView();
		};
		const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
			.requestIdleCallback;
		if (ric) ric(prefetch);
		else setTimeout(prefetch, 1500);
	});
</script>

<svelte:window onkeydown={handleEscape} />

<div class="flex h-dvh flex-col bg-bg text-text">
	<!-- Header: title + date-range navigation -->
	<header class="panel sticky top-0 z-10 rounded-none border-x-0 border-t-0">
		<div class="flex items-center justify-between px-4 pt-3">
			<h1 class="text-lg font-bold tracking-tight">
				<span class="text-christian">Family</span><span class="text-family">Cal</span>
			</h1>
			<div class="flex items-center gap-1.5">
				<ThemeSwitcher />
				<button
					type="button"
					onclick={openChores}
					class="flex min-h-11 items-center gap-1.5 rounded-full bg-black/5 px-3.5 text-sm font-medium transition-all duration-200 ease-out hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-white/10 dark:hover:bg-white/15"
				>
					<ListChecks size={17} aria-hidden="true" /> Aufgaben
				</button>
				<a
					href={resolve('/settings')}
					aria-label="Einstellungen"
					class="grid min-h-11 min-w-11 place-items-center rounded-full bg-black/5 transition-all duration-200 ease-out hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-white/10 dark:hover:bg-white/15"
				>
					<Settings size={19} aria-hidden="true" />
				</a>
			</div>
		</div>
		{#if !kidMode}
			<div class="flex items-center justify-between px-2 pb-2">
				<button
					type="button"
					aria-label="Vorheriger Zeitraum"
					onclick={() => calApi?.prev()}
					class="grid size-11 place-items-center rounded-full transition-all duration-200 ease-out hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/10"
				>
					<ChevronLeft size={22} aria-hidden="true" />
				</button>
				<span class="text-sm font-semibold">{rangeTitle}</span>
				<button
					type="button"
					aria-label="Nächster Zeitraum"
					onclick={() => calApi?.next()}
					class="grid size-11 place-items-center rounded-full transition-all duration-200 ease-out hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/10"
				>
					<ChevronRight size={22} aria-hidden="true" />
				</button>
			</div>
		{/if}
	</header>

	<!-- Person colour legend (no filtering — everyone sees all entries) -->
	{#if !kidMode}
		<PersonLegend />
	{/if}

	<!-- Calendar / kid view -->
	<main
		class="relative flex-1 overflow-hidden {kidMode ? '' : 'p-2'}"
		ontouchstart={kidMode ? undefined : onTouchStart}
		ontouchend={kidMode ? undefined : onTouchEnd}
	>
		{#if kidMode}
			<div class="h-full" in:fade={{ duration: 150 }}>
				{#if KidViewComp}
					<KidViewComp />
				{/if}
			</div>
		{:else}
			{#if !$eventsLoaded || !CalendarViewComp}
				<div class="absolute inset-2 z-10 flex flex-col gap-2" aria-hidden="true">
					<div class="skeleton h-9 w-full"></div>
					<div class="skeleton h-6 w-2/3"></div>
					<div class="skeleton flex-1 w-full"></div>
				</div>
			{/if}
			{#if CalendarViewComp}
				<div class="h-full" in:fade={{ duration: 150 }}>
					<CalendarViewComp
						view={fcView}
						events={$filteredEvents}
						weekStartsOn={$settings.weekStartsOn}
						timeFormat={$settings.timeFormat}
						onEventClick={handleEventClick}
						onSlotSelect={handleSlotSelect}
						onEventDrop={handleEventDrop}
						onRangeChange={(t) => (rangeTitle = t)}
						bind:api={calApi}
					/>
				</div>
			{/if}
		{/if}
	</main>

	<!-- Floating Action Button (add event — hidden in kid view) -->
	{#if !kidMode}
		<button
			type="button"
			onclick={openAddEvent}
			aria-label="Termin hinzufügen"
			class="fixed bottom-20 right-4 z-20 grid size-14 place-items-center rounded-full text-white transition-transform duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
			style="background-color: var(--color-accent); background-image: var(--accent-gradient); box-shadow: 0 10px 24px -6px color-mix(in srgb, var(--color-accent) 70%, transparent)"
		>
			<Plus size={28} aria-hidden="true" />
		</button>
	{/if}

	<!-- Bottom navigation -->
	<nav
		class="panel flex items-stretch justify-around rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
	>
		<button
			type="button"
			onclick={goToday}
			class="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs opacity-60 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
		>
			<span class="grid size-8 place-items-center rounded-full">
				<LocateFixed size={20} aria-hidden="true" />
			</span>
			Heute
		</button>
		{#each NAV_ITEMS as item (item.id)}
			{@const active = !kidMode && currentTab === item.id}
			<button
				type="button"
				onclick={() => {
					currentTab = item.id;
					kidMode = false;
				}}
				aria-current={active ? 'page' : undefined}
				class="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset {active
					? 'font-semibold text-accent'
					: 'opacity-60'}"
			>
				<span
					class="grid size-8 place-items-center rounded-full transition-all duration-200 ease-out"
					style={active
						? 'background-color: color-mix(in srgb, var(--color-accent) 15%, transparent)'
						: ''}
				>
					<item.icon size={20} aria-hidden="true" />
				</span>
				{item.label}
			</button>
		{/each}
		<button
			type="button"
			onclick={openKidView}
			aria-current={kidMode ? 'page' : undefined}
			class="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-feli focus-visible:ring-inset {kidMode
				? 'font-semibold text-feli'
				: 'opacity-60'}"
		>
			<span
				class="grid size-8 place-items-center rounded-full text-lg transition-all duration-200 ease-out"
				style={kidMode
					? 'background-color: color-mix(in srgb, var(--color-feli) 18%, transparent)'
					: ''}
				aria-hidden="true">⭐</span
			>
			Feli
		</button>
	</nav>
</div>

<!-- Add / edit form -->
{#if EventModalComp}
	<EventModalComp
		open={modalOpen}
		event={modalEvent}
		initial={modalInitial}
		onClose={() => (modalOpen = false)}
		onSave={handleSave}
	/>
{/if}

<!-- Tap-to-view detail sheet -->
{#if EventDetailSheetComp}
	<EventDetailSheetComp
		open={detailOpen}
		event={detailEvent}
		master={detailMaster}
		timeFormat={$settings.timeFormat}
		onClose={() => (detailOpen = false)}
		onEdit={startEdit}
		onDelete={confirmDelete}
	/>
{/if}

<!-- This / future / all scope picker for recurring events -->
{#if RecurrenceScopeDialogComp}
	<RecurrenceScopeDialogComp
		open={scopeOpen}
		mode={scopeMode}
		onChoose={handleScope}
		onCancel={() => (scopeOpen = false)}
	/>
{/if}

<!-- Family chores list -->
{#if ChoresSheetComp}
	<ChoresSheetComp
		open={choresOpen}
		onClose={() => (choresOpen = false)}
		onAdd={addChore}
		onEdit={editChore}
	/>
{/if}

<!-- Add / edit chore -->
{#if ChoreModalComp}
	<ChoreModalComp
		open={choreModalOpen}
		chore={choreEdit}
		onClose={() => (choreModalOpen = false)}
		onSave={saveChore}
	/>
{/if}
