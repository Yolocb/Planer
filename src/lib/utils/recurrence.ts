// -------------------------------------------------------------------------
// Recurrence expansion. A recurring event is stored once (the "master") with a
// RecurrenceRule; for display it is expanded into virtual occurrences within
// the visible range. Virtual occurrences carry a composite id `${masterId}::${iso}`
// and `recurringEventId` so the UI can tell them apart from real events.
// -------------------------------------------------------------------------
import type { CalendarEvent, RecurrenceRule, Weekday } from '$lib/types';

const WEEKDAY_NUM: Record<Weekday, number> = {
	SU: 0,
	MO: 1,
	TU: 2,
	WE: 3,
	TH: 4,
	FR: 5,
	SA: 6
};

const WEEKDAY_SHORT_DE: Record<Weekday, string> = {
	MO: 'Mo',
	TU: 'Di',
	WE: 'Mi',
	TH: 'Do',
	FR: 'Fr',
	SA: 'Sa',
	SU: 'So'
};

/** Delimiter between a master id and an occurrence ISO in a virtual id. */
export const OCCURRENCE_SEP = '::';

/** True if a calendar-event id refers to an expanded (virtual) occurrence. */
export function isOccurrenceId(id: string): boolean {
	return id.includes(OCCURRENCE_SEP);
}

/** The master series id for a (possibly virtual) event id. */
export function masterIdOf(id: string): string {
	const i = id.indexOf(OCCURRENCE_SEP);
	return i === -1 ? id : id.slice(0, i);
}

function addDays(d: Date, n: number): Date {
	const out = new Date(d);
	out.setDate(out.getDate() + n);
	return out;
}
function addMonths(d: Date, n: number): Date {
	const out = new Date(d);
	out.setMonth(out.getMonth() + n);
	return out;
}
function addYears(d: Date, n: number): Date {
	const out = new Date(d);
	out.setFullYear(out.getFullYear() + n);
	return out;
}
function endOfDay(iso: string): Date {
	const d = new Date(iso);
	d.setHours(23, 59, 59, 999);
	return d;
}

const MAX_OCCURRENCES = 2000; // hard safety cap for unbounded rules

/**
 * Yield occurrence start dates in chronological order, honouring interval,
 * byDay (weekly), count and until. Bounded by MAX_OCCURRENCES.
 */
function* occurrenceStarts(start: Date, rule: RecurrenceRule): Generator<Date> {
	const interval = Math.max(1, rule.interval ?? 1);
	const until = rule.until ? endOfDay(rule.until) : null;
	const maxCount = rule.count ?? Infinity;
	let emitted = 0;
	let guard = 0;

	if (rule.frequency === 'WEEKLY' && rule.byDay?.length) {
		const days = [...rule.byDay].map((d) => WEEKDAY_NUM[d]).sort((a, b) => a - b);
		// Anchor to the Sunday of the start's week, then walk weeks by interval.
		let weekStart = addDays(start, -start.getDay());
		weekStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
		while (guard++ < MAX_OCCURRENCES) {
			for (const dow of days) {
				const occ = addDays(weekStart, dow);
				if (occ < start) continue;
				if (until && occ > until) return;
				if (emitted >= maxCount) return;
				emitted++;
				yield occ;
			}
			weekStart = addDays(weekStart, 7 * interval);
		}
		return;
	}

	let occ = new Date(start);
	while (guard++ < MAX_OCCURRENCES) {
		if (until && occ > until) return;
		if (emitted >= maxCount) return;
		emitted++;
		yield new Date(occ);
		switch (rule.frequency) {
			case 'DAILY':
				occ = addDays(occ, interval);
				break;
			case 'WEEKLY':
				occ = addDays(occ, 7 * interval);
				break;
			case 'MONTHLY':
				occ = addMonths(occ, interval);
				break;
			case 'YEARLY':
				occ = addYears(occ, interval);
				break;
		}
	}
}

/** Expand one recurring master into virtual occurrences intersecting [rangeStart, rangeEnd]. */
function expandOne(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
	const rule = ev.recurrence;
	if (!rule) return [ev];

	const startDate = new Date(ev.start);
	const durationMs = new Date(ev.end).getTime() - startDate.getTime();
	const exdates = new Set(ev.exdates ?? []);
	const out: CalendarEvent[] = [];

	for (const occ of occurrenceStarts(startDate, rule)) {
		if (occ.getTime() > rangeEnd.getTime()) break; // chronological → safe to stop
		const endMs = occ.getTime() + durationMs;
		if (endMs < rangeStart.getTime()) continue; // entirely before the range
		const iso = occ.toISOString();
		if (exdates.has(iso)) continue;
		out.push({
			...ev,
			id: `${ev.id}${OCCURRENCE_SEP}${iso}`,
			start: iso,
			end: new Date(endMs).toISOString(),
			recurringEventId: ev.id
		});
	}
	return out;
}

/**
 * Expand a list of events for a visible range: non-recurring events pass through,
 * recurring masters are replaced by their occurrences within the range.
 */
export function expandRecurrences(
	list: CalendarEvent[],
	rangeStart: Date,
	rangeEnd: Date
): CalendarEvent[] {
	const out: CalendarEvent[] = [];
	for (const ev of list) {
		if (ev.recurrence) out.push(...expandOne(ev, rangeStart, rangeEnd));
		else out.push(ev);
	}
	return out;
}

/** Short German summary of a recurrence rule, e.g. "Wöchentlich · Mo, Mi, Fr". */
export function describeRecurrence(rule: RecurrenceRule): string {
	const interval = Math.max(1, rule.interval ?? 1);
	const base = (() => {
		switch (rule.frequency) {
			case 'DAILY':
				return interval === 1 ? 'Täglich' : `Alle ${interval} Tage`;
			case 'WEEKLY':
				return interval === 1 ? 'Wöchentlich' : `Alle ${interval} Wochen`;
			case 'MONTHLY':
				return interval === 1 ? 'Monatlich' : `Alle ${interval} Monate`;
			case 'YEARLY':
				return interval === 1 ? 'Jährlich' : `Alle ${interval} Jahre`;
		}
	})();

	const parts = [base];
	if (rule.frequency === 'WEEKLY' && rule.byDay?.length) {
		parts.push(rule.byDay.map((d) => WEEKDAY_SHORT_DE[d]).join(', '));
	}
	if (rule.count) {
		parts.push(`${rule.count}×`);
	} else if (rule.until) {
		parts.push(`bis ${new Date(rule.until).toLocaleDateString('de-DE')}`);
	}
	return parts.join(' · ');
}
