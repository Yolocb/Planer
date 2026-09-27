// Headless render/interaction smoke test for FamilyCal (Sprint 2).
// Assumes a dev server is running at http://localhost:5173/Planer/
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173/Planer/';
const consoleErrors = [];
const consoleLogs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

page.on('console', (msg) => {
	consoleLogs.push(msg.text());
	if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

const results = {};

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. FullCalendar renders.
await page.waitForSelector('.fc', { timeout: 10000 });
results.calendarRendered = true;

// 2. Range title present in the header.
results.rangeTitle = (await page.locator('header').innerText()).replace(/\s+/g, ' ').trim();

// 3. Seeded events visible.
await page.waitForTimeout(500);
results.eventCount = await page.locator('.fc-event').count();
results.eventTitles = await page.locator('.fc-chip-title').allInnerTexts();

// 4. Tap the first event → expect a console log.
if (results.eventCount > 0) {
	await page.locator('.fc-event').first().click();
	await page.waitForTimeout(200);
	results.eventTapLogged = consoleLogs.some((l) => l.includes('Event tapped'));
}

// 5. Switch to Month view.
await page.getByRole('button', { name: 'Monat' }).click();
await page.waitForTimeout(500);
results.monthViewRendered = (await page.locator('.fc-dayGridMonth-view').count()) > 0;
await page.screenshot({ path: 'C:/tmp/familycal-month.png' });

// 6. Back to Week and screenshot.
await page.getByRole('button', { name: 'Woche' }).click();
await page.waitForTimeout(500);
results.weekViewRendered = (await page.locator('.fc-timeGridWeek-view').count()) > 0;
await page.screenshot({ path: 'C:/tmp/familycal-week.png' });

// 7. Toggle the person whose event is visible → count should drop to 0.
const before = await page.locator('.fc-event').count();
await page.getByRole('button', { name: 'Christian' }).click();
await page.waitForTimeout(400);
const after = await page.locator('.fc-event').count();
results.filterWorks = before > 0 && after < before;
results.filterBefore = before;
results.filterAfter = after;

results.consoleErrors = consoleErrors;

console.log(JSON.stringify(results, null, 2));
await browser.close();

process.exit(consoleErrors.length === 0 && results.calendarRendered ? 0 : 1);
