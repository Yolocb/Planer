// Headless smoke test for FamilyCal Sprint 3 (event CRUD + recurrence).
// Assumes a dev server at http://localhost:5173/Planer/
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173/Planer/';
const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};
const dbCount = () =>
	page.evaluate(
		() =>
			new Promise((resolve) => {
				const req = indexedDB.open('familycal-db');
				req.onsuccess = () => {
					const db = req.result;
					const all = db.transaction('events').objectStore('events').getAll();
					all.onsuccess = () => resolve(all.result.length);
				};
			})
	);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });
results.initialDbCount = await dbCount();

// --- 1. FAB opens the modal, create a simple event ---
await page.getByRole('button', { name: 'Termin hinzufügen' }).click();
await page.waitForSelector('#ev-title', { timeout: 5000 });
results.modalOpened = true;
await page.fill('#ev-title', 'Smoke Test Termin');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.waitForTimeout(400);
results.dbCountAfterCreate = await dbCount();
results.createdPersisted = results.dbCountAfterCreate === results.initialDbCount + 1;

// --- 2. Tap the seeded Team-Meeting → detail sheet shows its title ---
const meeting = page.locator('.fc-event', { hasText: 'Team-Meeting' }).first();
if (await meeting.count()) {
	await meeting.click();
	await page.waitForTimeout(300);
	results.detailShowsTitle = await page
		.locator('#detail-title')
		.innerText()
		.then((t) => t.includes('Team-Meeting'))
		.catch(() => false);
	// Open edit form from the detail sheet
	await page.getByRole('button', { name: 'Bearbeiten' }).click();
	await page.waitForTimeout(300);
	results.editPrefilled = (await page.inputValue('#ev-title')) === 'Team-Meeting';
	await page.getByRole('button', { name: 'Abbrechen' }).click();
	await page.waitForTimeout(200);
}

// --- 3. Create a WEEKLY recurring event, verify it expands to many occurrences ---
await page.getByRole('button', { name: 'Termin hinzufügen' }).click();
await page.waitForSelector('#ev-title');
await page.fill('#ev-title', 'Woechentlich');
await page.selectOption('#ev-repeat', 'WEEKLY');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.waitForTimeout(400);
results.dbCountAfterRecurring = await dbCount();

// Switch to month view; a weekly series should render on multiple days.
await page.getByRole('button', { name: 'Monat' }).click();
await page.waitForTimeout(600);
results.recurringOccurrencesInMonth = await page
	.locator('.fc-chip-title', { hasText: 'Woechentlich' })
	.count();
results.recurrenceExpands = results.recurringOccurrencesInMonth >= 2;

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.createdPersisted &&
		results.detailShowsTitle &&
		results.editPrefilled &&
		results.recurrenceExpands
		? 0
		: 1
);
