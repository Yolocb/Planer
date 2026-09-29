// -------------------------------------------------------------------------
// iCalendar (.ics) <-> CalendarEvent mapping.
//   export: our events -> RFC 5545 via the `ics` library.
//   import: .ics text -> NewEventData[] via `ical.js`.
// Only stored masters are exported; recurrence is preserved as an RRULE.
// -------------------------------------------------------------------------
import { createEvents, type DateArray, type EventAttributes } from 'ics';
import ICAL from 'ical.js';
import { CATEGORIES } from '$lib/constants/categories';
import type { NewEventData } from '$lib/stores/events';
import type {
	CalendarEvent,
	EventCategory,
	EventOwnerId,
	RecurrenceRule,
	Weekday
} from '$lib/types';

const VALID_WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

// ---- Export -------------------------------------------------------------

/** ISO -> local date array ([y,m,d] all-day, else [y,m,d,h,min]). */
function isoToArray(iso: string, allDay: boolean): DateArray {
	const d = new Date(iso);
	return allDay
		? [d.getFullYear(), d.getMonth() + 1, d.getDate()]
		: [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
}

/** RecurrenceRule -> RFC 5545 RRULE string (no leading "RRULE:"). */
function ruleToRRule(rule: RecurrenceRule): string {
	const parts = [`FREQ=${rule.frequency}`];
	if (rule.interval && rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
	if (rule.frequency === 'WEEKLY' && rule.byDay?.length)
		parts.push(`BYDAY=${rule.byDay.join(',')}`);
	if (rule.count) parts.push(`COUNT=${rule.count}`);
	else if (rule.until) parts.push(`UNTIL=${rule.until.replaceAll('-', '')}`);
	return parts.join(';');
}

function toAttributes(ev: CalendarEvent): EventAttributes {
	const category = ev.category ? CATEGORIES.find((c) => c.id === ev.category) : undefined;
	const attrs: EventAttributes = {
		uid: ev.id,
		title: ev.title,
		start: isoToArray(ev.start, ev.allDay),
		end: isoToArray(ev.end, ev.allDay),
		startInputType: 'local',
		endInputType: 'local',
		startOutputType: 'local',
		endOutputType: 'local'
	};
	if (ev.description) attrs.description = ev.description;
	if (ev.location) attrs.location = ev.location;
	if (category) attrs.categories = [category.label];
	if (ev.recurrence) attrs.recurrenceRule = ruleToRRule(ev.recurrence);
	if (ev.exdates?.length) attrs.exclusionDates = ev.exdates.map((x) => isoToArray(x, ev.allDay));
	return attrs;
}

/** Serialise stored (non-virtual) events to a single .ics document. */
export function eventsToIcs(list: CalendarEvent[]): string {
	// Guard against accidentally passing expanded occurrences (composite ids).
	const masters = list.filter((e) => !e.id.includes('::'));
	const { error, value } = createEvents(masters.map(toAttributes));
	if (error || !value) throw error ?? new Error('Konnte iCal nicht erzeugen.');
	return value;
}

/**
 * Serialise a single event (or one occurrence of a recurring series) to a
 * one-event .ics document suitable for "Add to Calendar".
 *
 * - Regular / master event  → exported with its RRULE so the whole series is
 *   imported into the target calendar app.
 * - Virtual occurrence (id contains "::") → exported as a standalone one-time
 *   VEVENT using the occurrence's expanded start/end, with no RRULE.  The
 *   `master` param supplies title, category etc. when only the occurrence is
 *   available; if omitted, `event` itself is used for those fields.
 */
export function eventToIcs(event: CalendarEvent, master?: CalendarEvent | null): string {
	const isOccurrence = event.id.includes('::');
	let attrs: EventAttributes;

	if (isOccurrence) {
		// Build a one-time VEVENT from the occurrence's own start/end but inherit
		// metadata (title, location, category, description) from the master.
		const source = master ?? event;
		attrs = {
			uid: event.id, // unique per occurrence
			title: source.title,
			start: isoToArray(event.start, event.allDay),
			end: isoToArray(event.end, event.allDay),
			startInputType: 'local',
			endInputType: 'local',
			startOutputType: 'local',
			endOutputType: 'local'
		};
		if (source.description) attrs.description = source.description;
		if (source.location) attrs.location = source.location;
		if (source.category) {
			const cat = CATEGORIES.find((c) => c.id === source.category);
			if (cat) attrs.categories = [cat.label];
		}
		// Intentionally no recurrenceRule — the user is adding only this date.
	} else {
		attrs = toAttributes(event);
	}

	const { error, value } = createEvents([attrs]);
	if (error || !value) throw error ?? new Error('Konnte iCal nicht erzeugen.');
	return value;
}

// ---- Import -------------------------------------------------------------

/** ICAL.Recur -> RecurrenceRule (best effort; unsupported parts dropped). */
function parseRRule(recur: ICAL.Recur): RecurrenceRule | undefined {
	const freq = recur.freq as RecurrenceRule['frequency'];
	if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return undefined;
	const rule: RecurrenceRule = { frequency: freq };
	if (recur.interval && recur.interval > 1) rule.interval = recur.interval;

	const byDayRaw = recur.parts?.BYDAY as string[] | undefined;
	if (byDayRaw?.length) {
		const days = byDayRaw
			.map((d) => d.replace(/^[+-]?\d+/, '') as Weekday)
			.filter((d) => VALID_WEEKDAYS.includes(d));
		if (days.length) rule.byDay = days;
	}
	if (recur.count) rule.count = recur.count;
	else if (recur.until) {
		const u = recur.until.toJSDate();
		rule.until = `${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, '0')}-${String(
			u.getDate()
		).padStart(2, '0')}`;
	}
	return rule;
}

function labelToCategory(label: unknown): EventCategory | undefined {
	if (typeof label !== 'string') return undefined;
	const hit = CATEGORIES.find((c) => c.label.toLowerCase() === label.trim().toLowerCase());
	return hit?.id;
}

/**
 * Parse .ics text into new-event payloads. All events are assigned to `owner`
 * (we have no way to map external attendees to our roster). Fresh ids and
 * timestamps are assigned later by the events store.
 */
export function icsToNewEvents(text: string, owner: EventOwnerId): NewEventData[] {
	const comp = new ICAL.Component(ICAL.parse(text));
	const vevents = comp.getAllSubcomponents('vevent');
	const out: NewEventData[] = [];

	for (const ve of vevents) {
		const event = new ICAL.Event(ve);
		const startTime = event.startDate;
		if (!startTime) continue;
		const allDay = startTime.isDate;
		const start = startTime.toJSDate().toISOString();
		const end = (event.endDate ?? startTime).toJSDate().toISOString();

		const recurProp = ve.getFirstPropertyValue('rrule') as ICAL.Recur | null;
		const recurrence = recurProp ? parseRRule(recurProp) : undefined;

		const data: NewEventData = {
			title: event.summary || '(ohne Titel)',
			start,
			end,
			allDay,
			personIds: [owner]
		};
		if (event.description) data.description = event.description;
		if (event.location) data.location = event.location;
		const category = labelToCategory(ve.getFirstPropertyValue('categories'));
		if (category) data.category = category;
		if (recurrence) data.recurrence = recurrence;

		out.push(data);
	}
	return out;
}
