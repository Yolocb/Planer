// -------------------------------------------------------------------------
// JSON backup / restore. A backup is a full-fidelity snapshot of events and
// chores (ids + timestamps preserved) wrapped in a small versioned envelope.
// -------------------------------------------------------------------------
import type { CalendarEvent, Chore } from '$lib/types';

const APP_TAG = 'familycal';
const BACKUP_VERSION = 1;

export interface BackupFile {
	app: typeof APP_TAG;
	version: number;
	exportedAt: string;
	events: CalendarEvent[];
	chores: Chore[];
}

/** Serialise events + chores into a pretty-printed backup document. */
export function buildBackup(events: CalendarEvent[], chores: Chore[]): string {
	const backup: BackupFile = {
		app: APP_TAG,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		events,
		chores
	};
	return JSON.stringify(backup, null, 2);
}

/**
 * Parse + validate a backup document. Throws on a wrong/unknown envelope so
 * the caller can show a clear error rather than clobbering data with garbage.
 */
export function parseBackup(text: string): { events: CalendarEvent[]; chores: Chore[] } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('Datei ist kein gültiges JSON.');
	}
	if (!parsed || typeof parsed !== 'object') throw new Error('Unerwartetes Backup-Format.');
	const b = parsed as Partial<BackupFile>;
	if (b.app !== APP_TAG) throw new Error('Das ist kein FamilyCal-Backup.');
	if (!Array.isArray(b.events)) throw new Error('Backup enthält keine Termine.');
	return { events: b.events, chores: Array.isArray(b.chores) ? b.chores : [] };
}
