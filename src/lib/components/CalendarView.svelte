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
	import { getEventDisplayColor, isGradient } from '$lib/utils/colors';
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
		/** Bindable imperative controls (today / prev / next). */
		api?: { today: () => void; prev: () => void; next: () => void } | undefined;
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
			slotMinTime: '06:00:00',
			slotMaxTime: '22:00:00',
			nowIndicator: true,
			height: '100%',
			expandRows: true,
			editable: true,
			selectable: true,
			selectMirror: true,
			dayMaxEvents: 3,
			eventTimeFormat: timeFormatOption(),
			events: (info, success) => {
				// `events` is read live here so each fetch expands the current list.
				success(toFcEvents(expandRecurrences(events, info.start, info.end)));
			},
			eventContent: renderEventContent,
			eventDidMount(info) {
				const raw = info.event.extendedProps.raw as CalendarEvent | undefined;
				if (!raw) return;
				const color = getEventDisplayColor(raw);
				if (isGradient(color)) {
					info.el.style.background = color;
					info.el.style.borderColor = 'transparent';
				} else {
					info.el.style.backgroundColor = color;
					info.el.style.borderColor = color;
				}
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
			next: () => calendar?.next()
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
	/* Chip layout — badge(s) + title, matching the person-colour system. */
	:global(.fc-chip) {
		display: flex;
		align-items: center;
		gap: 4px;
		overflow: hidden;
		padding: 1px 2px;
		font-size: 0.72rem;
		line-height: 1.1;
		color: #fff;
	}
	:global(.fc-chip-time) {
		font-variant-numeric: tabular-nums;
		opacity: 0.9;
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
		border: 1.5px solid rgba(255, 255, 255, 0.9);
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
	/* Readable event text regardless of person colour. */
	:global(.fc-event) {
		cursor: pointer;
	}
	:global(.fc .fc-toolbar-title) {
		font-size: 1rem;
	}
</style>
