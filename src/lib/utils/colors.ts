import { PERSON_BY_ID } from '$lib/constants/persons';
import type { CalendarEvent, EventOwnerId } from '$lib/types';

const FAMILY_COLOR = '#F5A623';

/** Colour for a single owner. Falls back to the shared family amber. */
export function getPersonColor(id: EventOwnerId): string {
	return PERSON_BY_ID[id]?.color ?? FAMILY_COLOR;
}

/**
 * Background for an event chip.
 * - Single owner  → that person's solid colour.
 * - Multi owner   → a hard-stop striped linear-gradient across each colour.
 */
export function getEventColor(personIds: EventOwnerId[]): string {
	if (!personIds || personIds.length === 0) return FAMILY_COLOR;
	if (personIds.length === 1) return getPersonColor(personIds[0]);

	const colors = personIds.map(getPersonColor);
	const step = 100 / colors.length;
	const stops = colors
		.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`)
		.join(', ');
	return `linear-gradient(135deg, ${stops})`;
}

/** Whether a background value is a gradient (needs `background`, not `background-color`). */
export function isGradient(color: string): boolean {
	return color.includes('gradient');
}

/** Resolve the display colour for an event, honouring an explicit override. */
export function getEventDisplayColor(event: Pick<CalendarEvent, 'personIds' | 'color'>): string {
	return event.color ?? getEventColor(event.personIds);
}
