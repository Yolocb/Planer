// -------------------------------------------------------------------------
// Local event reminders (tier 1) — browser controller. Runs while the app is
// open: on a periodic tick (and whenever events change) it asks the pure
// logic in utils/reminders.ts which reminders are due and shows a browser
// notification for each, preferring the service worker so notifications work
// on Android and can be clicked to reopen the app.
//
// Reminders only fire while a tab is open — closed-tab delivery needs Web Push
// (tier 2). Fired keys are persisted so a reload does not re-fire.
// -------------------------------------------------------------------------
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { get } from 'svelte/store';
import { events } from '$lib/stores/events';
import { settings } from '$lib/stores/settings';
import { masterIdOf } from '$lib/utils/recurrence';
import { computeDueReminders, reminderBody, isoDay, type DueReminder } from '$lib/utils/reminders';

const FIRED_KEY = 'familycal-fired-reminders';
const TICK_MS = 30_000;
/** Drop fired entries older than the expansion window so storage stays bounded. */
const RETENTION_MS = 26 * 60 * 60 * 1000;

/** dedupeKey → occurrenceStart (epoch ms), used both for dedup and pruning. */
let firedKeys = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let unsubEvents: (() => void) | null = null;
let started = false;

function loadFired(): void {
	firedKeys = new Map();
	try {
		const raw = localStorage.getItem(FIRED_KEY);
		if (!raw) return;
		const now = Date.now();
		for (const [key, start] of JSON.parse(raw) as [string, number][]) {
			if (start + RETENTION_MS >= now) firedKeys.set(key, start);
		}
	} catch {
		// Corrupt / unavailable storage — start with an empty set.
	}
}

function persistFired(): void {
	try {
		localStorage.setItem(FIRED_KEY, JSON.stringify([...firedKeys.entries()]));
	} catch {
		// Storage unavailable (private mode) — dedup stays in-memory for this session.
	}
}

async function fireNotification(due: DueReminder): Promise<void> {
	const day = isoDay(due.occurrenceStart);
	const options: NotificationOptions = {
		body: reminderBody(due.reminderMinutes),
		tag: due.key,
		icon: `${base}/icons/icon-192.png`,
		badge: `${base}/icons/icon-192.png`,
		data: {
			eventId: masterIdOf(due.occurrenceId),
			day,
			url: `${base}/?date=${day}`
		}
	};

	// Prefer the service worker: required on Android, and its notificationclick
	// handler can reopen/navigate the app. Fall back to a page Notification on
	// desktop / in dev (where the SW is disabled).
	if ('serviceWorker' in navigator) {
		const reg = await Promise.race([
			navigator.serviceWorker.ready,
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
		]);
		if (reg) {
			await reg.showNotification(due.event.title, options);
			return;
		}
	}
	try {
		new Notification(due.event.title, options);
	} catch {
		// Some platforms (Android) only allow SW notifications — nothing to do.
	}
}

async function scan(): Promise<void> {
	if (!browser) return;
	if (!get(settings).remindersEnabled) return;
	if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

	const due = computeDueReminders(get(events), new Date(), new Set(firedKeys.keys()));
	if (due.length === 0) return;

	const now = Date.now();
	for (const d of due) {
		await fireNotification(d);
		firedKeys.set(d.key, d.occurrenceStart);
	}
	// Prune stale entries while we're here.
	for (const [key, start] of firedKeys) {
		if (start + RETENTION_MS < now) firedKeys.delete(key);
	}
	persistFired();
}

/** Request notification permission (call from a user gesture, e.g. the toggle). */
export async function requestReminderPermission(): Promise<NotificationPermission> {
	if (typeof Notification === 'undefined') return 'denied';
	if (Notification.permission !== 'default') return Notification.permission;
	return Notification.requestPermission();
}

/** Start the reminder service. Idempotent — safe to call more than once. */
export function startReminderService(): void {
	if (!browser || started) return;
	started = true;
	loadFired();
	// Subscribing fires the callback immediately with the current events, which
	// runs the first scan; it then re-scans on every change.
	unsubEvents = events.subscribe(() => void scan());
	timer = setInterval(() => void scan(), TICK_MS);
}

export function stopReminderService(): void {
	if (timer) clearInterval(timer);
	timer = null;
	if (unsubEvents) unsubEvents();
	unsubEvents = null;
	started = false;
}
