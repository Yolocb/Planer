// Sprint 7 smoke: "Zum Kalender hinzufügen" button in EventDetailSheet.
// Verifies: button present, click triggers ICS generation + delivery (Web
// Share API stubbed → falls back to <a download>), generated ICS contains
// expected VEVENT fields, 0 console errors.
// Run against a fresh DEV server:
//   npm run dev    (then)   node scripts/smoke-sprint7.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5173/Planer/';
const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 15000 });

// Stub navigator.share so the Web Share path doesn't throw (not supported in
// headless Chromium) and we can assert the fallback download fires instead.
// Also stub URL.createObjectURL / revokeObjectURL used by downloadText.
await page.evaluate(() => {
	window.__shareFiles = [];
	window.__downloadClicks = [];

	// Stub share: record the file and resolve immediately.
	Object.defineProperty(navigator, 'share', {
		value: async ({ files }) => {
			window.__shareFiles.push(...(files ?? []));
		},
		configurable: true
	});
	Object.defineProperty(navigator, 'canShare', {
		value: () => false, // force fallback to downloadText
		configurable: true
	});

	// Intercept the <a download> click that downloadText() triggers.
	const origCreate = URL.createObjectURL.bind(URL);
	URL.createObjectURL = (blob) => {
		const url = origCreate(blob);
		// Read the blob text async and store it for later assertion.
		blob.text().then((t) => (window.__lastIcsContent = t));
		return url;
	};
	// Intercept anchor click to capture filename and avoid actual download.
	const origAppend = document.body.appendChild.bind(document.body);
	document.body.appendChild = (el) => {
		if (el instanceof HTMLAnchorElement && el.download) {
			window.__downloadClicks.push({ filename: el.download, href: el.href });
			el.click = () => {}; // suppress real click
		}
		return origAppend(el);
	};
});

// Open the detail sheet for the first seeded event.
await page.locator('.fc-event').first().click();
await page.waitForSelector('[aria-labelledby="detail-title"]', { timeout: 5000 });
results.detailSheetOpen = true;

// Capture the event title from the sheet for later ICS verification.
const eventTitle = await page
	.locator('[aria-labelledby="detail-title"] #detail-title')
	.textContent();
results.eventTitle = eventTitle?.trim() ?? '';

// The "Zum Kalender hinzufügen" button.
const calBtn = page.getByRole('button', { name: 'Zum Kalender hinzufügen' });
results.buttonPresent = (await calBtn.count()) > 0;

if (results.buttonPresent) {
	await calBtn.click();
	// Give downloadText's async blob.text() a moment to settle.
	await page.waitForTimeout(600);

	const downloadInfo = await page.evaluate(() => ({
		clicks: window.__downloadClicks ?? [],
		icsContent: window.__lastIcsContent ?? ''
	}));

	results.downloadTriggered = downloadInfo.clicks.length > 0;
	results.filenameIsIcs = downloadInfo.clicks[0]?.filename?.endsWith('.ics') ?? false;
	const ics = downloadInfo.icsContent;
	results.icsHasVEvent = ics.includes('BEGIN:VEVENT');
	results.icsHasDTSTART = ics.includes('DTSTART');
	results.icsHasSummary = ics.includes('SUMMARY');
	// The SUMMARY line should contain the event title.
	results.icsSummaryMatchesTitle =
		results.eventTitle.length > 0 &&
		ics.includes(`SUMMARY:${results.eventTitle.replace(/\s+/g, ' ')}`);
}

// Close the detail sheet and confirm no errors.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
results.consoleErrors = consoleErrors;

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.detailSheetOpen &&
		results.buttonPresent &&
		results.downloadTriggered &&
		results.filenameIsIcs &&
		results.icsHasVEvent &&
		results.icsHasDTSTART &&
		results.icsHasSummary
		? 0
		: 1
);
