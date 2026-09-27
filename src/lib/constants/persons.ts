import type { EventOwnerId, Person } from '$lib/types';

/**
 * The FamilyCal roster. Colours mirror the Design Document colour system and
 * the CSS tokens in app.css. `family` is the shared / unassigned pseudo-person.
 */
export const PERSONS: Person[] = [
	{ id: 'christian', name: 'Christian', color: '#4A90D9', initial: 'C' },
	{ id: 'janina', name: 'Janina', color: '#E87C6B', initial: 'J' },
	{ id: 'feli', name: 'Feli', color: '#6BBF6E', initial: 'F' },
	{ id: 'family', name: 'Familie', color: '#F5A623', initial: '★' }
];

/** Fast lookup by id. */
export const PERSON_BY_ID: Record<EventOwnerId, Person> = PERSONS.reduce(
	(acc, person) => {
		acc[person.id] = person;
		return acc;
	},
	{} as Record<EventOwnerId, Person>
);

/** Just the three real family members (excludes the shared "family" entry). */
export const FAMILY_MEMBERS = PERSONS.filter((p) => p.id !== 'family');

export function getPersonColor(id: EventOwnerId): string {
	return PERSON_BY_ID[id]?.color ?? PERSON_BY_ID.family.color;
}
