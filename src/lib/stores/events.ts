import { derived, get, writable } from 'svelte/store';
import { getEvents, saveEvent, deleteEvent } from './db';
import { settings } from './settings';
import type { CalendarEvent, EventOwnerId } from '$lib/types';

/** All events currently loaded from IndexedDB. */
export const events = writable<CalendarEvent[]>([]);

/** True once the first load from IndexedDB has completed. */
export const eventsLoaded = writable(false);

/** Read all events from IndexedDB into the store. */
export async function loadEvents(): Promise<void> {
	try {
		const all = await getEvents();
		events.set(all);
	} catch (err) {
		console.error('Failed to load events:', err);
		events.set([]);
	} finally {
		eventsLoaded.set(true);
	}
}

/**
 * Pure person-filter: keep events that have at least one owner in `activeFilters`.
 * Extracted so it can be unit-tested independently of the store.
 */
export function filterEventsByPerson(
	list: CalendarEvent[],
	activeFilters: EventOwnerId[]
): CalendarEvent[] {
	if (activeFilters.length === 0) return [];
	return list.filter((e) => e.personIds.some((pid) => activeFilters.includes(pid)));
}

/** Events after applying the current person filter from settings. */
export const filteredEvents = derived([events, settings], ([$events, $settings]) =>
	filterEventsByPerson($events, $settings.activeFilters)
);

// -------------------------------------------------------------------------
// CRUD — writes go to IndexedDB and the in-memory store together.
// -------------------------------------------------------------------------

function uid(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
	return new Date().toISOString();
}

/** Fields the caller supplies when creating an event. */
export type NewEventData = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

/** Create a brand-new event (single or recurring master). */
export async function createEvent(data: NewEventData): Promise<CalendarEvent> {
	const ev: CalendarEvent = { ...data, id: uid(), createdAt: nowIso(), updatedAt: nowIso() };
	await saveEvent(ev);
	events.update((list) => [...list, ev]);
	return ev;
}

/** Patch an existing event by id. */
export async function updateEvent(
	id: string,
	patch: Partial<CalendarEvent>
): Promise<CalendarEvent | undefined> {
	const current = get(events).find((e) => e.id === id);
	if (!current) return undefined;
	const updated: CalendarEvent = { ...current, ...patch, id, updatedAt: nowIso() };
	await saveEvent(updated);
	events.update((list) => list.map((e) => (e.id === id ? updated : e)));
	return updated;
}

/** Delete a single event (also removes any recurrence-exception children). */
export async function removeEvent(id: string): Promise<void> {
	const children = get(events).filter((e) => e.recurringEventId === id);
	await deleteEvent(id);
	for (const child of children) await deleteEvent(child.id);
	events.update((list) => list.filter((e) => e.id !== id && e.recurringEventId !== id));
}

// -------------------------------------------------------------------------
// Recurrence-scope operations. `occurrenceIso` is the start of the clicked
// occurrence. "this" edits/removes a single occurrence, "future" splits the
// series, "all" acts on the master.
// -------------------------------------------------------------------------

/** ISO date (YYYY-MM-DD) of the day before the given occurrence — for `until`. */
function dayBefore(occurrenceIso: string): string {
	const d = new Date(occurrenceIso);
	d.setDate(d.getDate() - 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate()
	).padStart(2, '0')}`;
}

/** Skip a single occurrence by adding it to the master's exdates. */
export async function deleteOccurrence(masterId: string, occurrenceIso: string): Promise<void> {
	const master = get(events).find((e) => e.id === masterId);
	if (!master) return;
	const exdates = [...(master.exdates ?? []), occurrenceIso];
	await updateEvent(masterId, { exdates });
}

/** End the series the day before this occurrence (removes it and all later ones). */
export async function deleteFutureOccurrences(
	masterId: string,
	occurrenceIso: string
): Promise<void> {
	const master = get(events).find((e) => e.id === masterId);
	if (!master?.recurrence) return;
	await updateEvent(masterId, {
		recurrence: { ...master.recurrence, until: dayBefore(occurrenceIso), count: undefined }
	});
}

/** Delete the whole series (master + exceptions). */
export async function deleteSeries(masterId: string): Promise<void> {
	await removeEvent(masterId);
}

/** Edit the whole series in place. */
export async function updateSeries(masterId: string, patch: Partial<CalendarEvent>): Promise<void> {
	await updateEvent(masterId, patch);
}

/**
 * Edit a single occurrence: exclude it from the master and store a standalone
 * exception event carrying the edits (start/end come from the patch).
 */
export async function updateOccurrence(
	masterId: string,
	occurrenceIso: string,
	patch: NewEventData
): Promise<void> {
	const master = get(events).find((e) => e.id === masterId);
	if (!master) return;
	await updateEvent(masterId, { exdates: [...(master.exdates ?? []), occurrenceIso] });
	await createEvent({
		...patch,
		recurrence: undefined,
		recurringEventId: masterId,
		isRecurrenceException: true
	});
}

/**
 * Edit this and all following occurrences: cap the old series the day before,
 * then create a new recurring master from the edits.
 */
export async function updateFutureOccurrences(
	masterId: string,
	occurrenceIso: string,
	patch: NewEventData
): Promise<void> {
	const master = get(events).find((e) => e.id === masterId);
	if (!master?.recurrence) return;
	await updateEvent(masterId, {
		recurrence: { ...master.recurrence, until: dayBefore(occurrenceIso), count: undefined }
	});
	await createEvent(patch);
}
