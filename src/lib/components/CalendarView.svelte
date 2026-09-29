<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Calendar,
		type CalendarOptions,
		type EventInput,
		type EventClickArg,
		type DateSelectArg,
		type DatesSetArg,
		type EventContentArg,
		type EventDropArg
	} from '@fullcalendar/core';
	import dayGridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
	import deLocale from '@fullcalendar/core/locales/de';
	import { PERSON_BY_ID } from '$lib/constants/persons';
	import { getPersonColor, isGradient } from '$lib/utils/colors';
	import { expandRecurrences, isOccurrenceId } from '$lib/utils/recurrence';
	import type { CalendarEvent, EventOwnerId } from '$lib/types';

	export type FcViewId = 'timeGridWeek' | 'dayGridMonth' | 'timeGridDay' | 'listWeek';

	interface Props {
		view: FcViewId;
		events: CalendarEvent[];
		weekStartsOn?: 0 | 1;
		timeFormat?: '12h' | '24h';
		onEventClick?: (event: CalendarEvent) => void;
		onSlotSelect?: (sel: { start: Date; end: Date; allDay: boolean }) => void;
		onRangeChange?: (title: string) => void;
		/** Persist a drag/resize of a non-recurring event (ISO start/end). */
		onEventDrop?: (id: string, start: string, end: string, allDay: boolean) => void;
		/** Bindable imperative controls (today / prev / next / go to a date). */
		api?:
			| { today: () => void; prev: () => void; next: () => void; gotoDate: (d: Date) => void }
			| undefined;
	}

	let {
		view,
		events,
		weekStartsOn = 1,
		timeFormat = '24h',
		onEventClick,
		onSlotSelect,
		onRangeChange,
		onEventDrop,
		api = $bindable()
	}: Props = $props();

	let el: HTMLDivElement;
	let calendar: Calendar | undefined;

	function toFcEvents(list: CalendarEvent[]): EventInput[] {
		return list.map((e) => ({
			id: e.id,
			title: e.title,
			start: e.start,
			end: e.end,
			allDay: e.allDay,
			// Virtual recurrence occurrences must not be dragged/resized directly.
			editable: !isOccurrenceId(e.id),
			extendedProps: { raw: e }
		}));
	}

	function timeFormatOption() {
		return { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' } as const;
	}

	function emitDrop(arg: EventDropArg | EventResizeDoneArg) {
		const raw = arg.event.extendedProps.raw as CalendarEvent | undefined;
		if (!raw || isOccurrenceId(raw.id)) {
			arg.revert();
			return;
		}
		const start = arg.event.start?.toISOString();
		if (!start) {
			arg.revert();
			return;
		}
		const end = arg.event.end?.toISOString() ?? start;
		onEventDrop?.(raw.id, start, end, arg.event.allDay);
	}

	/** Build the custom chip content: person-initial badge(s) + title. */
	function renderEventContent(arg: EventContentArg) {
		const raw = arg.event.extendedProps.raw as CalendarEvent | undefined;
		const wrap = document.createElement('div');
		wrap.className = 'fc-chip';

		const badges = document.createElement('span');
		badges.className = 'fc-chip-badges';
		const ids = (raw?.personIds ?? []).slice(0, 3);
		for (const id of ids) {
			const person = PERSON_BY_ID[id as EventOwnerId];
			if (!person) continue;
			const badge = document.createElement('span');
			badge.className = 'fc-chip-badge';
			badge.style.backgroundColor = person.color;
			badge.textContent = person.initial;
			badge.title = person.name;
			badges.appendChild(badge);
		}

		const title = document.createElement('span');
		title.className = 'fc-chip-title';
		title.textContent = arg.event.title;

		if (arg.timeText) {
			const time = document.createElement('span');
			time.className = 'fc-chip-time';
			time.textContent = arg.timeText;
			wrap.appendChild(time);
		}
		if (ids.length) wrap.appendChild(badges);
		wrap.appendChild(title);
		return { domNodes: [wrap] };
	}

	function baseOptions(): CalendarOptions {
		return {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
			initialView: view,
			headerToolbar: false,
			locale: deLocale,
			firstDay: weekStartsOn,
			// Cover the full day so events at any hour are always visible in the
			// time grid (a fixed 06–22 window silently clipped late/early events).
			// Open scrolled to the morning so the default view stays comfortable.
			slotMinTime: '00:00:00',
			slotMaxTime: '24:00:00',
			scrollTime: '07:00:00',
			nowIndicator: true,
			height: '100%',
			expandRows: true,
			editable: true,
			selectable: true,
			selectMirror: true,
			dayMaxEvents: 3,
			// Friendly empty state for the agenda (list) view when a week has no events.
			noEventsContent() {
				const wrap = document.createElement('div');
				wrap.className = 'fc-empty';
				wrap.innerHTML =
					'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
					'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>' +
					'<p class="fc-empty-title">Keine Termine</p>' +
					'<p class="fc-empty-sub">Diese Woche ist frei — genieß die Zeit! ☀️</p>';
				return { domNodes: [wrap] };
			},
			eventTimeFormat: timeFormatOption(),
			events: (info, success) => {
				// `events` is read live here so each fetch expands the current list.
				success(toFcEvents(expandRecurrences(events, info.start, info.end)));
			},
			eventContent: renderEventContent,
			eventDidMount(info) {
				const raw = info.event.extendedProps.raw as CalendarEvent | undefined;
				if (!raw) return;
				// A single accent drives both the tinted fill and the left border
				// (see the pill styles below). Honour an explicit non-gradient
				// colour override, else fall back to the first owner's colour.
				const accent =
					raw.color && !isGradient(raw.color)
						? raw.color
						: getPersonColor(raw.personIds[0] ?? 'family');
				info.el.style.setProperty('--pill', accent);
			},
			eventClick(arg: EventClickArg) {
				const raw = arg.event.extendedProps.raw as CalendarEvent | undefined;
				if (raw) onEventClick?.(raw);
			},
			eventDrop: emitDrop,
			eventResize: emitDrop,
			select(arg: DateSelectArg) {
				onSlotSelect?.({ start: arg.start, end: arg.end, allDay: arg.allDay });
			},
			datesSet(arg: DatesSetArg) {
				onRangeChange?.(arg.view.title);
			}
		};
	}

	onMount(() => {
		calendar = new Calendar(el, baseOptions());
		calendar.render();
		api = {
			today: () => calendar?.today(),
			prev: () => calendar?.prev(),
			next: () => calendar?.next(),
			gotoDate: (d: Date) => calendar?.gotoDate(d)
		};
		return () => calendar?.destroy();
	});

	// React to view switches from the bottom nav.
	$effect(() => {
		if (calendar) calendar.changeView(view);
	});

	// React to filtered/edited events changing — re-run the feed for the range.
	$effect(() => {
		// Reading `events` here registers the dependency that triggers refetch.
		if (events) calendar?.refetchEvents();
	});

	// React to week-start / time-format settings changes.
	$effect(() => {
		if (!calendar) return;
		calendar.setOption('firstDay', weekStartsOn);
		calendar.setOption('eventTimeFormat', timeFormatOption());
	});
</script>

<div class="fc-host h-full" bind:this={el}></div>

<style>
	/* ---------------------------------------------------------------- */
	/* FullCalendar theming — set FC's own CSS vars (per palette) instead */
	/* of fighting its injected styles. All colours resolve in the        */
	/* palette context via lazy custom-property substitution.             */
	/* ---------------------------------------------------------------- */
	:global(.fc-host) {
		--fc-border-color: var(--hairline);
		--fc-page-bg-color: transparent;
		--fc-neutral-bg-color: transparent;
		--fc-today-bg-color: color-mix(in srgb, var(--color-accent) 8%, transparent);
		--fc-now-indicator-color: var(--color-accent);
		--fc-list-event-hover-bg-color: color-mix(in srgb, var(--color-text) 6%, transparent);
	}
	:global(.fc) {
		font-family: var(--font-sans);
	}

	/* Column headers → clean dashboard labels. */
	:global(.fc .fc-col-header-cell-cushion) {
		padding: 8px 4px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 55%, transparent);
	}
	:global(.fc .fc-daygrid-day-number) {
		padding: 6px 8px;
		font-size: 0.9rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--color-text) 78%, transparent);
	}

	/* Today: accent gradient circle on the number + a soft ring on the cell. */
	:global(.fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number) {
		display: inline-grid;
		place-items: center;
		min-width: 1.7rem;
		height: 1.7rem;
		margin: 3px;
		border-radius: 9999px;
		background-image: var(--accent-gradient);
		color: #fff;
	}
	:global(.fc .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion) {
		color: var(--color-accent);
	}
	@media (prefers-reduced-motion: no-preference) {
		:global(.fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number) {
			animation: fc-today-pulse 2.6s ease-out 4;
		}
		@keyframes fc-today-pulse {
			0% {
				box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 40%, transparent);
			}
			70% {
				box-shadow: 0 0 0 9px color-mix(in srgb, var(--color-accent) 0%, transparent);
			}
			100% {
				box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 0%, transparent);
			}
		}
	}

	/* List / agenda: softer day headers + row hover. */
	:global(.fc .fc-list-day-cushion) {
		background: color-mix(in srgb, var(--color-text) 5%, transparent);
	}
	:global(.fc .fc-list),
	:global(.fc .fc-list-table td) {
		border-color: var(--hairline);
	}

	/* Friendly agenda empty state (see noEventsContent). */
	:global(.fc .fc-list-empty) {
		background: transparent;
	}
	:global(.fc-empty) {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 2.5rem 1rem;
		color: color-mix(in srgb, var(--color-text) 55%, transparent);
	}
	:global(.fc-empty svg) {
		color: var(--color-accent);
		opacity: 0.85;
	}
	:global(.fc-empty-title) {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-text);
	}
	:global(.fc-empty-sub) {
		font-size: 0.78rem;
	}

	/* ---------------------------------------------------------------- */
	/* Event pills — soft tint + left accent. `--pill` is set per event   */
	/* in eventDidMount; falls back to the accent colour.                 */
	/* ---------------------------------------------------------------- */
	:global(.fc-event),
	:global(.fc-daygrid-event),
	:global(.fc-timegrid-event),
	:global(.fc-daygrid-block-event) {
		--pill: var(--color-accent);
		border: none !important;
		border-left: 4px solid var(--pill) !important;
		border-radius: 0.55rem !important;
		background: color-mix(in srgb, var(--pill) 15%, var(--color-surface)) !important;
		box-shadow: none !important;
	}
	:global(.fc-daygrid-event) {
		padding: 1px 3px;
	}
	:global(.fc-timegrid-event) {
		padding: 2px 4px;
	}
	:global(.fc-event:hover) {
		filter: brightness(0.97);
	}
	/* Agenda-view leading dot follows the same accent. */
	:global(.fc-list-event-dot) {
		border-color: var(--pill, var(--color-accent)) !important;
	}

	/* Chip layout — badge(s) + title, matching the person-colour system. */
	:global(.fc-chip) {
		display: flex;
		align-items: center;
		gap: 4px;
		overflow: hidden;
		padding: 1px 2px;
		font-size: 0.72rem;
		line-height: 1.1;
		color: var(--color-text);
	}
	:global(.fc-chip-time) {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}
	:global(.fc-chip-badges) {
		display: inline-flex;
		flex-shrink: 0;
	}
	:global(.fc-chip-badge) {
		display: grid;
		place-items: center;
		width: 15px;
		height: 15px;
		margin-left: -4px;
		border: 1.5px solid var(--color-surface);
		border-radius: 9999px;
		font-size: 9px;
		font-weight: 700;
		color: #fff;
	}
	:global(.fc-chip-badge:first-child) {
		margin-left: 0;
	}
	:global(.fc-chip-title) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	:global(.fc-event) {
		cursor: pointer;
	}
	:global(.fc .fc-toolbar-title) {
		font-size: 1rem;
	}
</style>
