import type { EventCategory } from '$lib/types';

export interface CategoryMeta {
	id: EventCategory;
	label: string;
	icon: string;
}

/** Selectable event categories with a German label and an emoji icon. */
export const CATEGORIES: CategoryMeta[] = [
	{ id: 'school', label: 'Schule', icon: '🎓' },
	{ id: 'sport', label: 'Sport', icon: '⚽' },
	{ id: 'medical', label: 'Arzt', icon: '🩺' },
	{ id: 'birthday', label: 'Geburtstag', icon: '🎂' },
	{ id: 'holiday', label: 'Urlaub', icon: '🏖️' },
	{ id: 'music', label: 'Musik', icon: '🎵' },
	{ id: 'fun', label: 'Freizeit', icon: '🎉' },
	{ id: 'other', label: 'Sonstiges', icon: '📌' }
];

export const CATEGORY_BY_ID: Record<EventCategory, CategoryMeta> = CATEGORIES.reduce(
	(acc, c) => {
		acc[c.id] = c;
		return acc;
	},
	{} as Record<EventCategory, CategoryMeta>
);

/** Look up a category's metadata; falls back to "Sonstiges". */
export function getCategoryMeta(id?: EventCategory): CategoryMeta {
	return (id && CATEGORY_BY_ID[id]) || CATEGORY_BY_ID.other;
}
