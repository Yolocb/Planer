import { describe, it, expect } from 'vitest';
import type { CalendarEvent } from '$lib/types';
import {
	computeDueReminders,
	reminderBody,
	dedupeKey,
	REMINDER_GRACE_MS
} from '$lib/utils/reminders';

const MINUTE = 60_000;

function ev(overrides: Partial<CalendarEvent>): CalendarEvent {
	const now = new Date().toISOString();
	return {
		id: 'e1',
		title: 'Termin',
		start: now,
		end: now,
		allDay: false,
		personIds: ['family'],
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

function at(offsetMs: number): string {
	return new Date(Date.now() + offsetMs).toISOString();
}

describe('computeDueReminders', () => {
	const now = () => new Date();

	it('fires a reminder once its window has begun', () => {
		const start = at(10 * MINUTE);
		const events = [ev({ id: 'a', start, end: at(70 * MINUTE), reminder: 15 })];
		const due = computeDueReminders(events, now(), new Set());
		expect(due).toHaveLength(1);
		expect(due[0].key).toBe(dedupeKey('a', 15));
		expect(due[0].occurrenceId).toBe('a');
	});

	it('does not fire before the reminder window', () => {
		const events = [
			ev({ id: 'a', start: at(2 * 60 * MINUTE), end: at(3 * 60 * MINUTE), reminder: 15 })
		];
		expect(computeDueReminders(events, now(), new Set())).toHaveLength(0);
	});

	it('does not fire once the occurrence is past the grace period', () => {
		const events = [
			ev({ id: 'a', start: at(-REMINDER_GRACE_MS - MINUTE), end: at(30 * MINUTE), reminder: 15 })
		];
		expect(computeDueReminders(events, now(), new Set())).toHaveLength(0);
	});

	it('skips reminders already fired', () => {
		const events = [ev({ id: 'a', start: at(10 * MINUTE), end: at(70 * MINUTE), reminder: 15 })];
		const fired = new Set([dedupeKey('a', 15)]);
		expect(computeDueReminders(events, now(), fired)).toHaveLength(0);
	});

	it('ignores events without a reminder', () => {
		const events = [ev({ id: 'a', start: at(10 * MINUTE), end: at(70 * MINUTE) })];
		expect(computeDueReminders(events, now(), new Set())).toHaveLength(0);
	});

	it('fires for a recurring occurrence with a composite id', () => {
		const start = at(10 * MINUTE);
		const events = [
			ev({
				id: 'series',
				start,
				end: at(70 * MINUTE),
				reminder: 30,
				recurrence: { frequency: 'DAILY' }
			})
		];
		const due = computeDueReminders(events, now(), new Set());
		expect(due.length).toBeGreaterThanOrEqual(1);
		const first = due.find((d) => d.occurrenceId.startsWith('series::'));
		expect(first).toBeDefined();
		expect(first!.reminderMinutes).toBe(30);
	});
});

describe('reminderBody', () => {
	it('returns German text per reminder value', () => {
		expect(reminderBody(15)).toBe('in 15 Minuten');
		expect(reminderBody(30)).toBe('in 30 Minuten');
		expect(reminderBody(60)).toBe('in 1 Stunde');
		expect(reminderBody(1440)).toBe('morgen');
	});
});
