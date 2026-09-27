import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CalendarEvent, Chore } from '$lib/types';

const DB_NAME = 'familycal-db';
const DB_VERSION = 1;

interface FamilyCalDB extends DBSchema {
	events: {
		key: string;
		value: CalendarEvent;
	};
	chores: {
		key: string;
		value: Chore;
	};
}

let dbPromise: Promise<IDBPDatabase<FamilyCalDB>> | null = null;

/**
 * Open (and, on first ever load, create + seed) the FamilyCal database.
 * Safe to call anywhere — throws a clear error if IndexedDB is unavailable
 * (e.g. SSR context or locked-down private browsing).
 */
export function getDB(): Promise<IDBPDatabase<FamilyCalDB>> {
	if (!browser || typeof indexedDB === 'undefined') {
		return Promise.reject(new Error('IndexedDB is not available in this environment.'));
	}

	if (!dbPromise) {
		dbPromise = openDB<FamilyCalDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('events')) {
					const events = db.createObjectStore('events', { keyPath: 'id' });
					// Seed a demo event per person exactly once, at DB creation.
					for (const event of buildSeedEvents()) {
						events.put(event);
					}
				}
				if (!db.objectStoreNames.contains('chores')) {
					db.createObjectStore('chores', { keyPath: 'id' });
				}
			}
		});
	}

	return dbPromise;
}

// -------------------------------------------------------------------------
// Events
// -------------------------------------------------------------------------

export async function getEvents(): Promise<CalendarEvent[]> {
	const db = await getDB();
	return db.getAll('events');
}

export async function saveEvent(event: CalendarEvent): Promise<void> {
	const db = await getDB();
	await db.put('events', event);
}

export async function deleteEvent(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('events', id);
}

// -------------------------------------------------------------------------
// Chores
// -------------------------------------------------------------------------

export async function getChores(): Promise<Chore[]> {
	const db = await getDB();
	return db.getAll('chores');
}

export async function saveChore(chore: Chore): Promise<void> {
	const db = await getDB();
	await db.put('chores', chore);
}

export async function deleteChore(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('chores', id);
}

/** Wipe every store (used by Settings → "Clear all data"). */
export async function clearAllData(): Promise<void> {
	const db = await getDB();
	await Promise.all([db.clear('events'), db.clear('chores')]);
}

// -------------------------------------------------------------------------
// Seed data
// -------------------------------------------------------------------------

function isoAt(dayOffset: number, hour: number, minute = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + dayOffset);
	d.setHours(hour, minute, 0, 0);
	return d.toISOString();
}

function buildSeedEvents(): CalendarEvent[] {
	const now = new Date().toISOString();
	const base = { allDay: false, createdAt: now, updatedAt: now };

	return [
		{
			...base,
			id: 'seed-christian',
			title: 'Team-Meeting',
			start: isoAt(0, 9),
			end: isoAt(0, 10),
			personIds: ['christian'],
			category: 'other'
		},
		{
			...base,
			id: 'seed-janina',
			title: 'Zahnarzt',
			start: isoAt(1, 14),
			end: isoAt(1, 15),
			personIds: ['janina'],
			category: 'medical'
		},
		{
			...base,
			id: 'seed-feli',
			title: 'Fußballtraining',
			start: isoAt(2, 16),
			end: isoAt(2, 17, 30),
			personIds: ['feli'],
			category: 'sport'
		}
	];
}
