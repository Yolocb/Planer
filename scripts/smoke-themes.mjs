// Headless smoke test for the colour-theme switcher.
// Assumes a dev server at http://localhost:5173/Planer/
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173/Planer/';
const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const paletteAttr = () => page.evaluate(() => document.documentElement.dataset.palette);
const accent = () =>
	page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
	);
const stored = () =>
	page.evaluate(() => JSON.parse(localStorage.getItem('familycal-settings') || '{}').palette);

const results = {};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });

// --- 1. Defaults to "modern" (indigo accent) ---
results.initialPalette = await paletteAttr();
const modernAccent = await accent();

// --- 2. Switch to "Feminin" → attr + accent var + storage all change ---
await page.getByRole('button', { name: 'Farbthema wählen' }).click();
await page.getByRole('menuitemradio', { name: /Feminin/ }).click();
await page.waitForTimeout(150);
const femininPalette = await paletteAttr();
const femininAccent = await accent();
results.switchedToFeminin = femininPalette === 'feminin' && femininAccent !== modernAccent;
results.femininPersisted = (await stored()) === 'feminin';

// --- 3. Switch to "Kind" → distinct accent again ---
await page.getByRole('button', { name: 'Farbthema wählen' }).click();
await page.getByRole('menuitemradio', { name: /Kind/ }).click();
await page.waitForTimeout(150);
const kindAccent = await accent();
results.switchedToKind =
	(await paletteAttr()) === 'kind' && kindAccent !== femininAccent && kindAccent !== modernAccent;

// --- 4. Persists across reload (new session) ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
results.persistsAfterReload = (await paletteAttr()) === 'kind';

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.initialPalette === 'modern' &&
		results.switchedToFeminin &&
		results.femininPersisted &&
		results.switchedToKind &&
		results.persistsAfterReload
		? 0
		: 1
);
