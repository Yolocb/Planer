// Visual/interaction capture for the UI overhaul (Tranche 3): friendly empty
// states (agenda / chores), KidView polish. Clears all data first so the empty
// states render. Assumes a dev server at http://localhost:5173/Planer/
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:5173/Planer/';
const SHOTS = fileURLToPath(new URL('./__screens__/', import.meta.url));
fs.mkdirSync(SHOTS, { recursive: true });

const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};

// Wipe all data via the app's own danger-zone flow (the DB re-seeds demo events
// on creation, so deleting the DB is not enough) so we see genuine empty states.
await page.goto(BASE + 'settings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Alle Daten löschen' }).click();
await page.getByRole('button', { name: 'Fortfahren' }).click();
await page.waitForTimeout(500);
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });

// --- 1. Agenda view: friendly empty state ---
await page.getByRole('button', { name: 'Agenda' }).click();
await page.waitForTimeout(400);
results.agendaEmptyState = (await page.locator('.fc-empty').count()) > 0;
await page.screenshot({ path: SHOTS + 't3-agenda-empty.png' });

// --- 2. Chores sheet: friendly empty state ---
await page.getByRole('button', { name: 'Aufgaben' }).click();
await page.waitForTimeout(400);
results.choresEmptyState = await page.getByText('Noch keine Aufgaben').isVisible();
await page.screenshot({ path: SHOTS + 't3-chores-empty.png' });
// Close the sheet.
await page.getByRole('button', { name: 'Schließen' }).click();
await page.waitForTimeout(300);

// --- 3. KidView (Feli tab): polished header icons + empty chores party ---
await page.getByRole('button', { name: 'Feli' }).click();
await page.waitForTimeout(400);
results.kidGreeting = await page.getByText('Hallo Feli!').isVisible();
results.kidChoreEmpty = await page.getByText('Heute keine Aufgaben!').isVisible();
await page.screenshot({ path: SHOTS + 't3-kidview.png' });

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.agendaEmptyState &&
		results.choresEmptyState &&
		results.kidChoreEmpty
		? 0
		: 1
);
