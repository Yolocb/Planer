// -------------------------------------------------------------------------
// Local date/time helpers. All <input type="date|time"> values are in LOCAL
// time; IndexedDB stores ISO 8601 (UTC). These helpers bridge the two without
// timezone drift.
// -------------------------------------------------------------------------

function pad2(n: number): string {
	return n.toString().padStart(2, '0');
}

/** `Date` → `YYYY-MM-DD` in local time (for <input type="date">). */
export function toDateInput(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `Date` → `HH:mm` in local time (for <input type="time">). */
export function toTimeInput(d: Date): string {
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Split an ISO string into local `{ date, time }` input values. */
export function isoToParts(iso: string): { date: string; time: string } {
	const d = new Date(iso);
	return { date: toDateInput(d), time: toTimeInput(d) };
}

/**
 * Combine local `YYYY-MM-DD` (+ optional `HH:mm`) into an ISO string.
 * For all-day events the time is pinned to local midnight.
 */
export function partsToIso(date: string, time: string, allDay: boolean): string {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = allDay ? [0, 0] : time.split(':').map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

/** Next full hour from `from` (e.g. 14:23 → 15:00). */
export function nextFullHour(from: Date = new Date()): Date {
	const d = new Date(from);
	d.setMinutes(0, 0, 0);
	d.setHours(d.getHours() + 1);
	return d;
}

export function addHours(d: Date, hours: number): Date {
	const out = new Date(d);
	out.setHours(out.getHours() + hours);
	return out;
}

const WEEKDAY_LONG = [
	'Sonntag',
	'Montag',
	'Dienstag',
	'Mittwoch',
	'Donnerstag',
	'Freitag',
	'Samstag'
];

/**
 * Human-readable German date/time range for the detail sheet.
 * Honours the all-day flag and the 12h/24h preference.
 */
export function formatEventRange(
	startIso: string,
	endIso: string,
	allDay: boolean,
	timeFormat: '12h' | '24h' = '24h'
): string {
	const start = new Date(startIso);
	const end = new Date(endIso);
	const sameDay = toDateInput(start) === toDateInput(end);

	const dateFmt = new Intl.DateTimeFormat('de-DE', {
		weekday: 'short',
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
	const timeFmt = new Intl.DateTimeFormat('de-DE', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: timeFormat === '12h'
	});

	if (allDay) {
		return sameDay ? dateFmt.format(start) : `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
	}
	if (sameDay) {
		return `${dateFmt.format(start)}, ${timeFmt.format(start)}–${timeFmt.format(end)}`;
	}
	return `${dateFmt.format(start)} ${timeFmt.format(start)} – ${dateFmt.format(end)} ${timeFmt.format(end)}`;
}

/** Long German weekday name for a date (Sunday-indexed). */
export function weekdayName(d: Date): string {
	return WEEKDAY_LONG[d.getDay()];
}
