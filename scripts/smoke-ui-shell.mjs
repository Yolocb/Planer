// Visual/interaction regression for the UI overhaul (Tranche 1): frosted shell +
// premium FullCalendar styling. Assumes a dev server at http://localhost:5173/Planer/
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

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });
await page.waitForSelector('.fc-event', { timeout: 10000 });

// --- 1. Frosted header: backdrop-filter applied ---
results.headerFrosted = await page.evaluate(() => {
	const h = document.querySelector('header');
	const s = h && getComputedStyle(h);
	return !!s && (s.backdropFilter !== 'none' || s.webkitBackdropFilter !== 'none');
});

// --- 2. Event pill: 4px left accent + a resolved --pill custom prop ---
const pill = await page.evaluate(() => {
	const el = document.querySelector('.fc-event');
	if (!el) return null;
	const s = getComputedStyle(el);
	return { borderLeft: s.borderLeftWidth, pill: s.getPropertyValue('--pill').trim() };
});
results.pillLeftAccent = pill?.borderLeft === '4px';
results.pillHasColor = !!pill?.pill && pill.pill !== '';

// --- 3. Today cell carries the accent circle styling ---
results.todayStyled = await page.evaluate(() => {
	const n = document.querySelector('.fc-day-today .fc-daygrid-day-number');
	if (!n) return true; // week view (timegrid) has no daygrid number — not applicable
	const s = getComputedStyle(n);
	return s.borderRadius !== '0px' && s.backgroundImage !== 'none';
});

// --- 4. Nav: Woche → Monat still switches the view ---
await page.getByRole('button', { name: 'Monat' }).click();
await page.waitForTimeout(300);
results.monthSwitch = (await page.locator('.fc-dayGridMonth-view').count()) > 0;
await page.screenshot({ path: SHOTS + 'month-modern-light.png' });

await page.getByRole('button', { name: 'Woche' }).click();
await page.waitForTimeout(300);
results.weekSwitch = (await page.locator('.fc-timeGridWeek-view').count()) > 0;
await page.screenshot({ path: SHOTS + 'week-modern-light.png' });

// --- 5. FAB opens the event modal ---
await page.getByRole('button', { name: 'Termin hinzufügen' }).click();
await page.waitForTimeout(300);
results.fabOpensModal = (await page.getByRole('button', { name: /Termin erstellen/ }).count()) > 0;

// --- 5b. Escape closes the modal ---
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
results.escapeClosesModal =
	(await page.getByRole('button', { name: /Termin erstellen/ }).count()) === 0;

// --- 6. Alt palette (Feminin) + dark: still renders, capture a look ---
await page.evaluate(() => {
	document.documentElement.dataset.palette = 'feminin';
	document.documentElement.classList.add('dark');
});
await page.waitForTimeout(200);
await page.screenshot({ path: SHOTS + 'week-feminin-dark.png' });

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.headerFrosted &&
		results.pillLeftAccent &&
		results.pillHasColor &&
		results.todayStyled &&
		results.monthSwitch &&
		results.weekSwitch &&
		results.fabOpensModal &&
		results.escapeClosesModal
		? 0
		: 1
);
