import { derived, writable } from 'svelte/store';
import { getEvents } from './db';
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
