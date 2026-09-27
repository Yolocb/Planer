// Shared id / timestamp helpers used by the events and chores stores.

/** A stable unique id — crypto.randomUUID where available, else a fallback. */
export function uid(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
	return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Current time as an ISO 8601 string. */
export function nowIso(): string {
	return new Date().toISOString();
}
