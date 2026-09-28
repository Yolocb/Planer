// Visual/interaction capture for the UI overhaul (Tranche 4): settings segmented
// controls + refined PersonLegend. Assumes a dev server at http://localhost:5173/Planer/
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

// --- 1. PersonLegend: still a labelled list with all members ---
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });
results.legendMembers = await page
	.getByRole('list', { name: 'Familienmitglieder' })
	.getByRole('listitem')
	.count();
await page
	.locator('[aria-label="Familienmitglieder"]')
	.screenshot({ path: SHOTS + 't4-legend.png' });

// --- 2. Settings segmented controls: still <button>s, selection toggles ---
await page.goto(BASE + 'settings', { waitUntil: 'networkidle' });
await page.waitForSelector('h1', { timeout: 5000 });

// Zeitformat: click "12 Stunden" → aria-pressed flips (name must survive for smoke-sprint5).
const twelve = page.getByRole('button', { name: '12 Stunden' });
await twelve.click();
await page.waitForTimeout(150);
results.timeFormatToggled = (await twelve.getAttribute('aria-pressed')) === 'true';

// Standardansicht: switch to Monat.
const monat = page.getByRole('button', { name: 'Monat' });
await monat.click();
await page.waitForTimeout(150);
results.viewToggled = (await monat.getAttribute('aria-pressed')) === 'true';

// Wochenstart: Sonntag.
const sonntag = page.getByRole('button', { name: 'Sonntag' });
await sonntag.click();
await page.waitForTimeout(150);
results.weekStartToggled = (await sonntag.getAttribute('aria-pressed')) === 'true';

await page.screenshot({ path: SHOTS + 't4-settings.png' });

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.legendMembers >= 4 &&
		results.timeFormatToggled &&
		results.viewToggled &&
		results.weekStartToggled
		? 0
		: 1
);
