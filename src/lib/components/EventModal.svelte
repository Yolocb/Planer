<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';
	import { PERSONS } from '$lib/constants/persons';
	import { getContrastText, getPersonColor } from '$lib/utils/colors';
	import { trapFocus } from '$lib/actions/focusTrap';
	import { CATEGORIES } from '$lib/constants/categories';
	import {
		isoToParts,
		partsToIso,
		nextFullHour,
		addHours,
		toDateInput,
		toTimeInput
	} from '$lib/utils/datetime';
	import type { NewEventData } from '$lib/stores/events';
	import type {
		CalendarEvent,
		EventCategory,
		EventOwnerId,
		RecurrenceFrequency,
		ReminderMinutes,
		Weekday
	} from '$lib/types';

	interface Props {
		open: boolean;
		/** Editing target (its fields prefill the form). */
		event?: CalendarEvent | null;
		/** Prefill for a new event (from FAB or a slot selection). */
		initial?: { start?: string; end?: string; allDay?: boolean; personIds?: EventOwnerId[] } | null;
		onClose: () => void;
		onSave: (data: NewEventData) => void;
	}

	let { open, event = null, initial = null, onClose, onSave }: Props = $props();

	const WEEKDAYS: { code: Weekday; label: string }[] = [
		{ code: 'MO', label: 'Mo' },
		{ code: 'TU', label: 'Di' },
		{ code: 'WE', label: 'Mi' },
		{ code: 'TH', label: 'Do' },
		{ code: 'FR', label: 'Fr' },
		{ code: 'SA', label: 'Sa' },
		{ code: 'SU', label: 'So' }
	];
	const WEEKDAY_FROM_DAY: Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

	const REPEAT_OPTIONS: { value: 'none' | RecurrenceFrequency; label: string }[] = [
		{ value: 'none', label: 'Wiederholt sich nicht' },
		{ value: 'DAILY', label: 'Täglich' },
		{ value: 'WEEKLY', label: 'Wöchentlich' },
		{ value: 'MONTHLY', label: 'Monatlich' },
		{ value: 'YEARLY', label: 'Jährlich' }
	];

	// --- form state ---
	let title = $state('');
	let personIds = $state<EventOwnerId[]>(['family']);
	let allDay = $state(false);
	let startDate = $state('');
	let startTime = $state('');
	let endDate = $state('');
	let endTime = $state('');
	let category = $state<EventCategory | ''>('');
	let location = $state('');
	let notes = $state('');
	let reminder = $state<ReminderMinutes | ''>('');
	let repeat = $state<'none' | RecurrenceFrequency>('none');
	let interval = $state(1);
	let byDay = $state<Weekday[]>([]);
	let endMode = $state<'never' | 'until' | 'count'>('never');
	let untilDate = $state('');
	let count = $state(10);
	let error = $state('');

	const isEditing = $derived(!!event);

	// Hydrate the form once each time the modal opens.
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) hydrate();
		wasOpen = open;
	});

	function hydrate() {
		error = '';
		if (event) {
			title = event.title;
			personIds = [...event.personIds];
			allDay = event.allDay;
			const s = isoToParts(event.start);
			const e = isoToParts(event.end);
			startDate = s.date;
			startTime = s.time;
			endDate = e.date;
			endTime = e.time;
			category = event.category ?? '';
			location = event.location ?? '';
			notes = event.description ?? '';
			reminder = event.reminder ?? '';
			const r = event.recurrence;
			repeat = r?.frequency ?? 'none';
			interval = r?.interval ?? 1;
			byDay = r?.byDay ? [...r.byDay] : [];
			if (r?.count) {
				endMode = 'count';
				count = r.count;
			} else if (r?.until) {
				endMode = 'until';
				untilDate = r.until;
			} else {
				endMode = 'never';
			}
		} else {
			const startD = initial?.start ? new Date(initial.start) : nextFullHour();
			const endD = initial?.end ? new Date(initial.end) : addHours(startD, 1);
			title = '';
			personIds = initial?.personIds?.length ? [...initial.personIds] : ['family'];
			allDay = initial?.allDay ?? false;
			startDate = toDateInput(startD);
			startTime = toTimeInput(startD);
			endDate = toDateInput(endD);
			endTime = toTimeInput(endD);
			category = '';
			location = '';
			notes = '';
			reminder = '';
			repeat = 'none';
			interval = 1;
			byDay = [];
			endMode = 'never';
			untilDate = toDateInput(endD);
			count = 10;
		}
	}

	function togglePerson(id: EventOwnerId) {
		personIds = personIds.includes(id) ? personIds.filter((x) => x !== id) : [...personIds, id];
	}

	function toggleDay(code: Weekday) {
		byDay = byDay.includes(code) ? byDay.filter((x) => x !== code) : [...byDay, code];
	}

	// When switching to weekly, seed the weekday of the start date.
	function onRepeatChange() {
		if (repeat === 'WEEKLY' && byDay.length === 0 && startDate) {
			byDay = [WEEKDAY_FROM_DAY[new Date(startDate).getDay()]];
		}
	}

	function save() {
		const t = title.trim();
		if (!t) return (error = 'Bitte einen Titel eingeben.');
		if (t.length > 100) return (error = 'Der Titel darf höchstens 100 Zeichen haben.');
		if (personIds.length === 0) return (error = 'Bitte mindestens eine Person wählen.');
		if (!startDate || (!allDay && !startTime)) return (error = 'Bitte Startdatum/-zeit angeben.');

		const startIso = partsToIso(startDate, startTime, allDay);
		const endIso = partsToIso(endDate || startDate, endTime || startTime, allDay);
		if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
			return (error = 'Das Ende darf nicht vor dem Start liegen.');
		}

		const recurrence =
			repeat === 'none'
				? undefined
				: {
						frequency: repeat,
						interval: interval > 1 ? interval : undefined,
						byDay:
							repeat === 'WEEKLY'
								? byDay.length
									? [...byDay]
									: [WEEKDAY_FROM_DAY[new Date(startIso).getDay()]]
								: undefined,
						until: endMode === 'until' && untilDate ? untilDate : undefined,
						count: endMode === 'count' && count > 0 ? count : undefined
					};

		const data: NewEventData = {
			title: t,
			start: startIso,
			end: endIso,
			allDay,
			personIds: [...personIds],
			description: notes.trim() || undefined,
			location: location.trim() || undefined,
			category: category || undefined,
			recurrence,
			reminder: reminder === '' ? undefined : reminder,
			recurringEventId: event?.recurringEventId,
			isRecurrenceException: event?.isRecurrenceException,
			exdates: event?.exdates,
			color: event?.color
		};
		onSave(data);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex flex-col bg-bg text-text"
		role="dialog"
		aria-modal="true"
		aria-labelledby="event-modal-title"
		use:trapFocus
		in:fly={{ y: 24, duration: 220 }}
		out:fade={{ duration: 160 }}
	>
		<!-- Header: close + centered title (Save lives in the bottom bar) -->
		<header class="panel flex items-center gap-2 rounded-none border-x-0 border-t-0 px-3 py-3">
			<button
				type="button"
				aria-label="Abbrechen"
				class="grid size-11 place-items-center rounded-full opacity-70 transition-all duration-200 ease-out hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/10"
				onclick={onClose}
			>
				<X size={20} aria-hidden="true" />
			</button>
			<h2 id="event-modal-title" class="flex-1 text-center text-base font-bold">
				{isEditing ? 'Termin bearbeiten' : 'Neuer Termin'}
			</h2>
			<span class="size-11" aria-hidden="true"></span>
		</header>

		<div class="flex-1 space-y-5 overflow-y-auto px-4 py-4">
			{#if error}
				<p
					class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/15 dark:text-red-400"
				>
					{error}
				</p>
			{/if}

			<!-- Title -->
			<div>
				<label for="ev-title" class="mb-1 block text-xs font-medium opacity-60">Titel</label>
				<input
					id="ev-title"
					type="text"
					bind:value={title}
					maxlength="100"
					placeholder="z. B. Zahnarzttermin"
					class="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 text-base outline-none focus:border-christian dark:border-white/15"
				/>
			</div>

			<!-- People -->
			<div>
				<span class="mb-1.5 block text-xs font-medium opacity-60">Wer</span>
				<div class="flex flex-wrap gap-2">
					{#each PERSONS as person (person.id)}
						{@const active = personIds.includes(person.id)}
						<button
							type="button"
							onclick={() => togglePerson(person.id)}
							aria-pressed={active}
							class="flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-200 ease-out"
							class:opacity-40={!active}
							style={active
								? `background-color: ${person.color}; border-color: ${person.color}; color: ${getContrastText(person.color)};`
								: `border-color: ${person.color}; color: ${person.color};`}
						>
							{person.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- All-day -->
			<label class="flex min-h-11 items-center justify-between">
				<span class="text-sm font-medium">Ganztägig</span>
				<input
					type="checkbox"
					bind:checked={allDay}
					class="size-6 accent-[var(--color-christian)]"
				/>
			</label>

			<!-- Start / End -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span class="w-12 shrink-0 text-xs font-medium opacity-60" id="ev-start-label">Start</span
					>
					<input
						type="date"
						id="ev-start-date"
						aria-labelledby="ev-start-label"
						bind:value={startDate}
						class="flex-1 rounded-xl border border-black/10 bg-surface px-3 py-2 dark:border-white/15"
					/>
					{#if !allDay}
						<input
							type="time"
							id="ev-start-time"
							aria-label="Startzeit"
							bind:value={startTime}
							class="rounded-xl border border-black/10 bg-surface px-3 py-2 dark:border-white/15"
						/>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<span class="w-12 shrink-0 text-xs font-medium opacity-60" id="ev-end-label">Ende</span>
					<input
						type="date"
						id="ev-end-date"
						aria-labelledby="ev-end-label"
						bind:value={endDate}
						class="flex-1 rounded-xl border border-black/10 bg-surface px-3 py-2 dark:border-white/15"
					/>
					{#if !allDay}
						<input
							type="time"
							id="ev-end-time"
							aria-label="Endzeit"
							bind:value={endTime}
							class="rounded-xl border border-black/10 bg-surface px-3 py-2 dark:border-white/15"
						/>
					{/if}
				</div>
			</div>

			<!-- Category -->
			<div>
				<span class="mb-1.5 block text-xs font-medium opacity-60">Kategorie</span>
				<div class="flex flex-wrap gap-2">
					{#each CATEGORIES as cat (cat.id)}
						{@const active = category === cat.id}
						<button
							type="button"
							onclick={() => (category = active ? '' : cat.id)}
							aria-pressed={active}
							class="flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-all duration-200 ease-out {active
								? 'border-christian bg-christian/10 font-semibold text-christian'
								: 'border-black/10 opacity-70 dark:border-white/15'}"
						>
							<span aria-hidden="true">{cat.icon}</span>
							{cat.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Repeat -->
			<div>
				<label for="ev-repeat" class="mb-1 block text-xs font-medium opacity-60">Wiederholung</label
				>
				<select
					id="ev-repeat"
					bind:value={repeat}
					onchange={onRepeatChange}
					class="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 dark:border-white/15"
				>
					{#each REPEAT_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>

				{#if repeat !== 'none'}
					<div class="mt-3 space-y-3 rounded-xl bg-black/5 p-3 dark:bg-white/5">
						<div class="flex items-center gap-2 text-sm">
							<span>Alle</span>
							<input
								type="number"
								min="1"
								max="99"
								bind:value={interval}
								class="w-16 rounded-lg border border-black/10 bg-surface px-2 py-1 dark:border-white/15"
							/>
							<span>
								{repeat === 'DAILY'
									? 'Tage'
									: repeat === 'WEEKLY'
										? 'Wochen'
										: repeat === 'MONTHLY'
											? 'Monate'
											: 'Jahre'}
							</span>
						</div>

						{#if repeat === 'WEEKLY'}
							<div class="flex flex-wrap gap-1.5">
								{#each WEEKDAYS as d (d.code)}
									{@const on = byDay.includes(d.code)}
									<button
										type="button"
										onclick={() => toggleDay(d.code)}
										aria-pressed={on}
										style={on ? `color: ${getContrastText(getPersonColor('christian'))};` : ''}
										class="size-11 rounded-full border text-xs font-semibold transition-all duration-200 ease-out {on
											? 'border-christian bg-christian'
											: 'border-black/10 opacity-60 dark:border-white/15'}"
									>
										{d.label}
									</button>
								{/each}
							</div>
						{/if}

						<div class="space-y-1.5 text-sm">
							<label class="flex items-center gap-2">
								<input type="radio" value="never" bind:group={endMode} /> Endet nie
							</label>
							<label class="flex items-center gap-2">
								<input type="radio" value="until" bind:group={endMode} /> Bis
								<input
									type="date"
									bind:value={untilDate}
									disabled={endMode !== 'until'}
									class="rounded-lg border border-black/10 bg-surface px-2 py-1 disabled:opacity-40 dark:border-white/15"
								/>
							</label>
							<label class="flex items-center gap-2">
								<input type="radio" value="count" bind:group={endMode} /> Nach
								<input
									type="number"
									min="1"
									max="999"
									bind:value={count}
									disabled={endMode !== 'count'}
									class="w-16 rounded-lg border border-black/10 bg-surface px-2 py-1 disabled:opacity-40 dark:border-white/15"
								/>
								Terminen
							</label>
						</div>
					</div>
				{/if}
			</div>

			<!-- Location -->
			<div>
				<label for="ev-loc" class="mb-1 block text-xs font-medium opacity-60">Ort</label>
				<input
					id="ev-loc"
					type="text"
					bind:value={location}
					placeholder="Optional"
					class="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 dark:border-white/15"
				/>
			</div>

			<!-- Reminder -->
			<div>
				<label for="ev-remind" class="mb-1 block text-xs font-medium opacity-60">Erinnerung</label>
				<select
					id="ev-remind"
					bind:value={reminder}
					class="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 dark:border-white/15"
				>
					<option value="">Keine</option>
					<option value={15}>15 Minuten vorher</option>
					<option value={30}>30 Minuten vorher</option>
					<option value={60}>1 Stunde vorher</option>
					<option value={1440}>1 Tag vorher</option>
				</select>
			</div>

			<!-- Notes -->
			<div>
				<label for="ev-notes" class="mb-1 block text-xs font-medium opacity-60">Notizen</label>
				<textarea
					id="ev-notes"
					bind:value={notes}
					rows="3"
					placeholder="Optional"
					class="w-full resize-none rounded-xl border border-black/10 bg-surface px-3 py-2.5 dark:border-white/15"
				></textarea>
			</div>
		</div>

		<!-- Prominent, always-visible action bar (Save is the dominant element) -->
		<footer
			class="panel flex gap-2 rounded-none border-x-0 border-b-0 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
		>
			<button type="button" class="btn btn-secondary" onclick={onClose}>Abbrechen</button>
			<button type="button" class="btn btn-primary btn-lg flex-1" onclick={save}>
				{isEditing ? 'Speichern' : 'Termin erstellen'}
			</button>
		</footer>
	</div>
{/if}
