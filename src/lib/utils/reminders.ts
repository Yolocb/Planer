// -------------------------------------------------------------------------
// Local event reminders (tier 1). Pure, browser-free logic so it is unit-
// testable: given the stored events and the current time, decide which
// reminders are due to fire now. The controller in stores/reminderService.ts
// owns timers, notifications and persistence.
// -------------------------------------------------------------------------
import type { CalendarEvent, ReminderMinutes } from '$lib/types';
import { expandRecurrences } from '$lib/utils/recurrence';

const MINUTE_MS = 60_000;

/** How far ahead to expand occurrences: 24h (covers the 1440-min reminder) + 1h buffer. */
export const REMINDER_WINDOW_MS = 24 * 60 * MINUTE_MS + 60 * MINUTE_MS;

/**
 * Don't fire a reminder whose occurrence already started more than this ago —
 * prevents a flood of stale notifications after the tab was closed for a while.
 */
export const REMINDER_GRACE_MS = 5 * MINUTE_MS;

export interface DueReminder {
	/** Dedup key: `${occurrenceId}:${reminderMinutes}`. */
	key: string;
	/** Expanded occurrence id (plain id, or `master::iso` for a recurrence). */
	occurrenceId: string;
	reminderMinutes: ReminderMinutes;
	/** Epoch ms the reminder became due (occurrenceStart − reminder). */
	fireAt: number;
	/** Epoch ms the occurrence starts. */
	occurrenceStart: number;
	/** The expanded occurrence (title/start/end carried from the master). */
	event: CalendarEvent;
}

export function dedupeKey(occurrenceId: string, reminderMinutes: ReminderMinutes): string {
	return `${occurrenceId}:${reminderMinutes}`;
}

/**
 * Return the reminders that are due to fire at `now` and have not fired yet.
 * A reminder is due when now is past its fire time but the occurrence has not
 * started more than the grace period ago.
 */
export function computeDueReminders(
	events: CalendarEvent[],
	now: Date,
	alreadyFired: Set<string>,
	opts: { windowMs?: number; graceMs?: number } = {}
): DueReminder[] {
	const windowMs = opts.windowMs ?? REMINDER_WINDOW_MS;
	const graceMs = opts.graceMs ?? REMINDER_GRACE_MS;
	const nowMs = now.getTime();

	// Expand slightly into the past so just-started occurrences still surface.
	const rangeStart = new Date(nowMs - graceMs);
	const rangeEnd = new Date(nowMs + windowMs);

	const due: DueReminder[] = [];
	for (const ev of expandRecurrences(events, rangeStart, rangeEnd)) {
		const reminderMinutes = ev.reminder;
		if (reminderMinutes == null) continue;
		const occurrenceStart = new Date(ev.start).getTime();
		const fireAt = occurrenceStart - reminderMinutes * MINUTE_MS;
		const key = dedupeKey(ev.id, reminderMinutes);
		if (alreadyFired.has(key)) continue;
		if (nowMs >= fireAt && nowMs <= occurrenceStart + graceMs) {
			due.push({ key, occurrenceId: ev.id, reminderMinutes, fireAt, occurrenceStart, event: ev });
		}
	}
	return due;
}

/** German body text for a reminder notification. */
export function reminderBody(reminderMinutes: ReminderMinutes): string {
	switch (reminderMinutes) {
		case 15:
			return 'in 15 Minuten';
		case 30:
			return 'in 30 Minuten';
		case 60:
			return 'in 1 Stunde';
		case 1440:
			return 'morgen';
	}
}

/** Local calendar day (YYYY-MM-DD) of an epoch-ms timestamp. */
export function isoDay(epochMs: number): string {
	const d = new Date(epochMs);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}
