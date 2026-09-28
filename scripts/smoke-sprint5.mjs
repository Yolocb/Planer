// Headless smoke test for Sprint 5: Settings page + import/export.
// Assumes a dev server at http://localhost:5173/Planer/
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:5173/Planer/';
const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 390, height: 780 },
	acceptDownloads: true
});
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};

async function downloadText(triggerLocator) {
	const [download] = await Promise.all([page.waitForEvent('download'), triggerLocator.click()]);
	const path = await download.path();
	return fs.readFileSync(path, 'utf8');
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });

// --- 1. Navigate to Settings via the header ⚙️ link ---
await page.getByRole('link', { name: 'Einstellungen' }).click();
await page.waitForSelector('text=Einstellungen', { timeout: 5000 });
results.settingsRendered = await page.getByRole('heading', { name: 'Einstellungen' }).isVisible();

// --- 2. Export .ics → contains a VEVENT and a seeded title ---
const ics = await downloadText(page.getByRole('button', { name: /\.ics exportieren/ }));
results.icsHasEvent = ics.includes('BEGIN:VEVENT');
results.icsHasSeed = ics.includes('Team-Meeting');

// --- 3. Settings persistence: Zeitformat 12h + palette Feminin ---
await page.getByRole('button', { name: '12 Stunden' }).click();
await page.getByRole('button', { name: /Feminin/ }).click();
await page.waitForTimeout(150);
const stored = await page.evaluate(() =>
	JSON.parse(localStorage.getItem('familycal-settings') || '{}')
);
const paletteAttr = await page.evaluate(() => document.documentElement.dataset.palette);
results.timeFormatPersisted = stored.timeFormat === '12h';
results.palettePersisted = stored.palette === 'feminin' && paletteAttr === 'feminin';

// --- 4. JSON backup → valid envelope with the seeded events ---
const backupText = await downloadText(page.getByRole('button', { name: /Backup sichern/ }));
const backup = JSON.parse(backupText);
results.backupValid = backup.app === 'familycal' && Array.isArray(backup.events);
results.backupHasEvents = backup.events.length >= 3;

// --- 5. Clear all data (guarded) → events store empty after reload ---
await page.getByRole('button', { name: 'Alle Daten löschen' }).click();
await page.getByRole('button', { name: 'Fortfahren' }).click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
results.clearedEvents = await page.evaluate(
	() =>
		new Promise((resolve, reject) => {
			const req = indexedDB.open('familycal-db');
			req.onsuccess = () => {
				const db = req.result;
				const tx = db.transaction('events', 'readonly');
				const countReq = tx.objectStore('events').count();
				countReq.onsuccess = () => resolve(countReq.result === 0);
				countReq.onerror = () => reject(countReq.error);
			};
			req.onerror = () => reject(req.error);
		})
);

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.settingsRendered &&
		results.icsHasEvent &&
		results.icsHasSeed &&
		results.timeFormatPersisted &&
		results.palettePersisted &&
		results.backupValid &&
		results.backupHasEvents &&
		results.clearedEvents
		? 0
		: 1
);
