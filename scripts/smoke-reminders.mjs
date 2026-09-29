// Sprint (reminders) smoke: local event reminders fire a browser notification.
// DEV has no service worker (devOptions.enabled:false), so the reminder service
// falls back to page-level `new Notification`, which we stub to record calls.
// Run against a fresh DEV server:
//   npm run dev    (then)   node scripts/smoke-reminders.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5173/Planer/';
const ORIGIN = new URL(BASE).origin;
const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
await context.grantPermissions(['notifications'], { origin: ORIGIN });

// Before any app script: stub Notification to record constructions + force
// granted, and enable reminders in settings so the service runs.
await context.addInitScript(() => {
	window.__notifs = [];
	class FakeNotification {
		constructor(title, options) {
			window.__notifs.push({ title, options });
		}
		close() {}
		static permission = 'granted';
		static requestPermission() {
			return Promise.resolve('granted');
		}
	}
	window.Notification = FakeNotification;
	try {
		const raw = localStorage.getItem('familycal-settings');
		const s = raw ? JSON.parse(raw) : {};
		s.remindersEnabled = true;
		localStorage.setItem('familycal-settings', JSON.stringify(s));
	} catch {
		// ignore
	}
});

const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 20000 });

// Seed an event that is already inside its 15-minute reminder window (starts in
// ~1 min → fireAt is ~14 min in the past → due now).
await page.evaluate(async () => {
	const startMs = Date.now() + 60_000;
	const nowIso = new Date().toISOString();
	const ev = {
		id: 'smoke-reminder',
		title: 'Smoke Termin',
		start: new Date(startMs).toISOString(),
		end: new Date(startMs + 3_600_000).toISOString(),
		allDay: false,
		personIds: ['family'],
		reminder: 15,
		createdAt: nowIso,
		updatedAt: nowIso
	};
	await new Promise((resolve, reject) => {
		const req = indexedDB.open('familycal-db', 1);
		req.onsuccess = () => {
			const tx = req.result.transaction('events', 'readwrite');
			tx.objectStore('events').put(ev);
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
		};
		req.onerror = () => reject(req.error);
	});
});

// Reload so loadEvents() picks up the seeded event; the service scans on start.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 20000 });
await page.waitForTimeout(4000);

const notifs = await page.evaluate(() => window.__notifs ?? []);
const mine = notifs.find((n) => n.title === 'Smoke Termin');
results.notificationFired = !!mine;
results.bodyCorrect = mine?.options?.body === 'in 15 Minuten';
results.tagCorrect = mine?.options?.tag === 'smoke-reminder:15';
results.dayPresent = typeof mine?.options?.data?.day === 'string';

// The fired key should now be persisted, blocking a re-fire on reload.
const firedRaw = await page.evaluate(() => localStorage.getItem('familycal-fired-reminders'));
results.firedKeyPersisted = !!firedRaw && firedRaw.includes('smoke-reminder:15');

// Reload again: __notifs resets, but the persisted key must prevent a re-fire.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 20000 });
await page.waitForTimeout(4000);
const notifs2 = await page.evaluate(() => window.__notifs ?? []);
results.noRefire = !notifs2.some((n) => n.title === 'Smoke Termin');

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.notificationFired &&
		results.bodyCorrect &&
		results.tagCorrect &&
		results.dayPresent &&
		results.firedKeyPersisted &&
		results.noRefire
		? 0
		: 1
);
