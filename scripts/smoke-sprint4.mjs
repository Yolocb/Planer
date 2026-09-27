// Headless smoke test for FamilyCal Sprint 4 (kid view + chores + confetti).
// Assumes a dev server at http://localhost:5173/Planer/
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173/Planer/';
const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 390, height: 780 },
	reducedMotion: 'no-preference' // ensure confetti animates
});
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};
const choreState = () =>
	page.evaluate(
		() =>
			new Promise((resolve) => {
				const req = indexedDB.open('familycal-db');
				req.onsuccess = () => {
					const db = req.result;
					const all = db.transaction('chores').objectStore('chores').getAll();
					all.onsuccess = () =>
						resolve({
							count: all.result.length,
							done: all.result.filter((c) => c.completed).length
						});
				};
			})
	);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });
await page.waitForTimeout(400); // let chores seed
results.seeded = await choreState();

// --- 1. Open Feli's kid view; her seeded chores render ---
await page.getByRole('button', { name: 'Feli' }).click();
await page.waitForTimeout(300);
results.greetingShown = await page.getByText('Hallo Feli!').isVisible();
results.kidChoreVisible = await page.getByRole('button', { name: 'Zimmer aufräumen' }).isVisible();

// --- 2. Tick a chore → completed flips in IndexedDB + confetti canvas appears ---
await page.getByRole('button', { name: 'Zimmer aufräumen' }).click();
await page.waitForTimeout(150);
results.confettiCanvas = (await page.locator('canvas').count()) >= 1;
await page.waitForTimeout(300);
const afterToggle = await choreState();
results.choreCompleted = afterToggle.done === results.seeded.done + 1;

// --- 3. Family chores sheet lists all members; add a chore via the modal ---
await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
await page.waitForTimeout(300);
results.sheetShowsChristian = await page.getByRole('heading', { name: 'Christian' }).isVisible();
results.sheetShowsFeli = await page.getByRole('heading', { name: 'Feli', exact: true }).isVisible();

await page.getByRole('button', { name: /Neue Aufgabe/ }).click();
await page.waitForSelector('#chore-title', { timeout: 5000 });
await page.fill('#chore-title', 'Smoke Aufgabe');
await page.getByRole('button', { name: 'Aufgabe erstellen' }).click();
await page.waitForTimeout(400);
const afterAdd = await choreState();
results.choreAdded = afterAdd.count === results.seeded.count + 1;

// --- 4. Persists across reload (new session) ---
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const afterReload = await choreState();
results.persistsAfterReload = afterReload.count === afterAdd.count && afterReload.done >= 1;

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.greetingShown &&
		results.kidChoreVisible &&
		results.confettiCanvas &&
		results.choreCompleted &&
		results.sheetShowsChristian &&
		results.choreAdded &&
		results.persistsAfterReload
		? 0
		: 1
);
