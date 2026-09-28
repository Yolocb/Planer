// Accessibility tranche checks (Sprint 6): dialog focus management, accessible
// names, and dark-text-on-tint contrast. Runs against a fresh DEV server:
//   npm run dev    (then)   node scripts/smoke-a11y.mjs
// Override the base with BASE=… if the port differs.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5173/Planer/';
const SEL =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};

// Does document.activeElement sit inside the dialog with the given labelledby id?
const focusInside = (labelId) =>
	page.evaluate((id) => {
		const d = document.querySelector(`[aria-labelledby="${id}"]`);
		return !!d && d.contains(document.activeElement);
	}, labelId);

// aria-labelledby points at a non-empty heading.
const nameResolves = (labelId) =>
	page.evaluate((id) => {
		const d = document.querySelector(`[aria-labelledby="${id}"]`);
		const t = d && document.getElementById(id)?.textContent?.trim();
		return !!t;
	}, labelId);

// Tab from the last focusable wraps to the first (focus stays trapped).
async function tabWraps(labelId) {
	await page.evaluate(
		({ id, sel }) => {
			const d = document.querySelector(`[aria-labelledby="${id}"]`);
			const items = [...d.querySelectorAll(sel)].filter(
				(el) => el.offsetWidth || el.offsetHeight || el.getClientRects().length
			);
			items[items.length - 1].focus();
		},
		{ id: labelId, sel: SEL }
	);
	await page.keyboard.press('Tab');
	return page.evaluate(
		({ id, sel }) => {
			const d = document.querySelector(`[aria-labelledby="${id}"]`);
			const items = [...d.querySelectorAll(sel)].filter(
				(el) => el.offsetWidth || el.offsetHeight || el.getClientRects().length
			);
			return document.activeElement === items[0];
		},
		{ id: labelId, sel: SEL }
	);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });

// ---------- EventModal ----------
await page.getByRole('button', { name: 'Termin hinzufügen' }).click();
await page.waitForSelector('[aria-labelledby="event-modal-title"]', { timeout: 5000 });
results.eventModalNamed = await nameResolves('event-modal-title');
results.eventModalAutofocus = await focusInside('event-modal-title');
results.eventModalTabWraps = await tabWraps('event-modal-title');

// Contrast: an active person chip must NOT use white text.
const famChip = page.getByRole('button', { name: 'Familie', pressed: true });
if ((await famChip.count()) === 0) await page.getByRole('button', { name: 'Familie' }).click();
results.chipContrastColor = await page
	.getByRole('button', { name: 'Familie', pressed: true })
	.evaluate((el) => getComputedStyle(el).color);
results.chipNotWhite = results.chipContrastColor !== 'rgb(255, 255, 255)';

// Escape closes and restores focus to the FAB trigger.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
results.eventModalClosed =
	(await page.locator('[aria-labelledby="event-modal-title"]').count()) === 0;
results.focusRestored = await page.evaluate(
	() => document.activeElement?.getAttribute('aria-label') === 'Termin hinzufügen'
);

// ---------- EventDetailSheet (tap an existing event) ----------
await page.locator('.fc-event').first().click();
await page.waitForSelector('[aria-labelledby="detail-title"]', { timeout: 5000 });
results.detailAutofocus = await focusInside('detail-title');
results.detailTabWraps = await tabWraps('detail-title');
// Owner badge dark text.
results.ownerBadgeNotWhite = await page.evaluate(() => {
	const d = document.querySelector('[aria-labelledby="detail-title"]');
	const badge = d?.querySelector('span[style*="background-color"]');
	return badge ? getComputedStyle(badge).color !== 'rgb(255, 255, 255)' : true;
});
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ---------- ChoresSheet → ChoreModal ----------
await page.getByRole('button', { name: 'Aufgaben' }).click();
await page.waitForSelector('[aria-labelledby="chores-title"]', { timeout: 5000 });
results.choresAutofocus = await focusInside('chores-title');
results.choresTabWraps = await tabWraps('chores-title');

await page.getByRole('button', { name: 'Neue Aufgabe' }).click();
await page.waitForSelector('[aria-labelledby="chore-modal-title"]', { timeout: 5000 });
results.choreModalNamed = await nameResolves('chore-modal-title');
results.choreModalAutofocus = await focusInside('chore-modal-title');
results.choreModalTabWraps = await tabWraps('chore-modal-title');
await page.keyboard.press('Escape'); // close ChoreModal
await page.waitForTimeout(200);
await page.keyboard.press('Escape'); // close ChoresSheet
await page.waitForTimeout(200);

// ---------- Reduced motion: still opens/closes, no errors ----------
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.fc', { timeout: 10000 });
await page.getByRole('button', { name: 'Termin hinzufügen' }).click();
await page.waitForSelector('[aria-labelledby="event-modal-title"]', { timeout: 5000 });
results.reducedMotionOpens =
	(await page.locator('[aria-labelledby="event-modal-title"]').count()) > 0;
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.eventModalNamed &&
		results.eventModalAutofocus &&
		results.eventModalTabWraps &&
		results.chipNotWhite &&
		results.eventModalClosed &&
		results.focusRestored &&
		results.detailAutofocus &&
		results.detailTabWraps &&
		results.ownerBadgeNotWhite &&
		results.choresAutofocus &&
		results.choresTabWraps &&
		results.choreModalNamed &&
		results.choreModalAutofocus &&
		results.choreModalTabWraps &&
		results.reducedMotionOpens
		? 0
		: 1
);
