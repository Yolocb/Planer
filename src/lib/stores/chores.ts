import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getChores, saveChore, deleteChore } from './db';
import { uid, nowIso } from '$lib/utils/id';
import { toDateInput } from '$lib/utils/datetime';
import type { Chore, PersonId } from '$lib/types';

/** All chores currently loaded from IndexedDB. */
export const chores = writable<Chore[]>([]);

/** True once the first load from IndexedDB has completed. */
export const choresLoaded = writable(false);

const SEED_FLAG = 'familycal-chores-seeded';

/** Read all chores from IndexedDB into the store (seeding demo data once). */
export async function loadChores(): Promise<void> {
	try {
		let all = await getChores();
		if (all.length === 0 && browser && !localStorage.getItem(SEED_FLAG)) {
			for (const c of buildSeedChores()) await saveChore(c);
			localStorage.setItem(SEED_FLAG, '1');
			all = await getChores();
		}
		chores.set(all);
	} catch (err) {
		console.error('Failed to load chores:', err);
		chores.set([]);
	} finally {
		choresLoaded.set(true);
	}
}

// -------------------------------------------------------------------------
// Pure selectors (exported for reuse + testability)
// -------------------------------------------------------------------------

/** Today's date as YYYY-MM-DD. */
export function todayIso(): string {
	return toDateInput(new Date());
}

/** Chores assigned to a person. */
export function choresForPerson(list: Chore[], personId: PersonId): Chore[] {
	return list.filter((c) => c.personId === personId);
}

/**
 * Chores that are "due now" for a person on `dateIso`: due that day, plus any
 * still-open chores from earlier days (overdue). Sorted done-last.
 */
export function dueChores(list: Chore[], personId: PersonId, dateIso: string): Chore[] {
	return list
		.filter(
			(c) =>
				c.personId === personId && (c.dueDate === dateIso || (c.dueDate < dateIso && !c.completed))
		)
		.sort(
			(a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate)
		);
}

// -------------------------------------------------------------------------
// CRUD — writes go to IndexedDB and the in-memory store together.
// -------------------------------------------------------------------------

export type NewChoreData = Omit<Chore, 'id' | 'completed' | 'completedAt'> &
	Partial<Pick<Chore, 'completed' | 'completedAt'>>;

export async function createChore(data: NewChoreData): Promise<Chore> {
	const chore: Chore = {
		completed: false,
		...data,
		id: uid()
	};
	await saveChore(chore);
	chores.update((list) => [...list, chore]);
	return chore;
}

export async function updateChore(id: string, patch: Partial<Chore>): Promise<Chore | undefined> {
	const current = get(chores).find((c) => c.id === id);
	if (!current) return undefined;
	const updated: Chore = { ...current, ...patch, id };
	await saveChore(updated);
	chores.update((list) => list.map((c) => (c.id === id ? updated : c)));
	return updated;
}

/** Flip completion, stamping/clearing completedAt. Returns the new state. */
export async function toggleChore(id: string): Promise<boolean> {
	const current = get(chores).find((c) => c.id === id);
	if (!current) return false;
	const completed = !current.completed;
	await updateChore(id, { completed, completedAt: completed ? nowIso() : undefined });
	return completed;
}

export async function removeChore(id: string): Promise<void> {
	await deleteChore(id);
	chores.update((list) => list.filter((c) => c.id !== id));
}

// -------------------------------------------------------------------------
// Demo seed (first run only)
// -------------------------------------------------------------------------

function buildSeedChores(): Chore[] {
	const today = toDateInput(new Date());
	return [
		{ id: uid(), title: 'Zimmer aufräumen', dueDate: today, personId: 'feli', completed: false },
		{ id: uid(), title: 'Zähne putzen', dueDate: today, personId: 'feli', completed: false },
		{ id: uid(), title: 'Hausaufgaben machen', dueDate: today, personId: 'feli', completed: false },
		{
			id: uid(),
			title: 'Müll rausbringen',
			dueDate: today,
			personId: 'christian',
			completed: false
		}
	];
}
