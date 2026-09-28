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

/** Relative luminance (WCAG 2.x) of an `#rrggbb` colour. */
function luminance(hex: string): number {
	const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
	if (!m) return 0;
	const channel = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const r = channel(parseInt(m[1], 16));
	const g = channel(parseInt(m[2], 16));
	const b = channel(parseInt(m[3], 16));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Readable text colour for text sitting on a solid tint. Picks dark or white by
 * whichever gives more contrast (WCAG). Gradients are ambiguous, so keep white.
 */
export function getContrastText(color: string): string {
	if (isGradient(color)) return 'white';
	const L = luminance(color);
	// Contrast vs white (L=1) vs black (L=0); pick the higher ratio.
	const contrastWhite = 1.05 / (L + 0.05);
	const contrastDark = (L + 0.05) / 0.05;
	return contrastDark >= contrastWhite ? '#1a1a1a' : 'white';
}

/** Resolve the display colour for an event, honouring an explicit override. */
export function getEventDisplayColor(event: Pick<CalendarEvent, 'personIds' | 'color'>): string {
	return event.color ?? getEventColor(event.personIds);
}
