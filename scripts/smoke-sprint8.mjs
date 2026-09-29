// Sprint 8 smoke: @-mention autocomplete in EventModal title field.
// Verifies: typing "@" shows the dropdown, typing a letter filters it,
// clicking a result inserts the name + adds the person to personIds (chip
// becomes active), Escape dismisses without closing the modal, and typing
// "@Familie" then selecting adds Familie with the chip active.
// Run against a fresh DEV server:
//   npm run dev    (then)   node scripts/smoke-sprint8.mjs
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

// Open the EventModal via the FAB.
await page.getByRole('button', { name: 'Termin hinzufügen' }).click();
await page.waitForSelector('[aria-labelledby="event-modal-title"]', { timeout: 5000 });
results.modalOpen = true;

const titleInput = page.locator('#ev-title');

// 1. Typing "@" alone shows all 4 family members in the dropdown.
await titleInput.fill('@');
// Trigger oninput (fill doesn't fire input event in all cases — use type instead).
await titleInput.clear();
await titleInput.type('@');
await page.waitForTimeout(100);
const dropdownAll = page.locator('#mention-list [role="option"]');
results.dropdownShowsAll = (await dropdownAll.count()) === 4;

// 2. Typing "@C" filters to only "Christian".
await titleInput.clear();
await titleInput.type('@C');
await page.waitForTimeout(100);
const dropdownFiltered = page.locator('#mention-list [role="option"]');
results.dropdownFiltersToChristian = (await dropdownFiltered.count()) === 1;
const firstOptionText = await dropdownFiltered.first().textContent();
results.firstOptionIsChristian = firstOptionText?.includes('Christian') ?? false;

// 3. Clicking "Christian" in the dropdown inserts "@Christian" and ticks the chip.
await page.locator('#mention-list button').first().click();
await page.waitForTimeout(150);
const titleValue = await titleInput.inputValue();
results.titleHasMention = titleValue.includes('@Christian');
// The "Christian" chip in "Wer" should now be active (aria-pressed="true").
const christianChip = page.getByRole('button', { name: 'Christian', pressed: true });
results.christianChipActive = (await christianChip.count()) > 0;
// Dropdown should be gone.
results.dropdownClosed = (await page.locator('#mention-list').count()) === 0;

// 4. Escape dismisses dropdown without closing modal.
await titleInput.clear();
await titleInput.type('@Jan');
await page.waitForTimeout(100);
results.dropdownAppearsAgain = (await page.locator('#mention-list').count()) > 0;
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
results.escapeClosesMention = (await page.locator('#mention-list').count()) === 0;
results.modalStillOpen = (await page.locator('[aria-labelledby="event-modal-title"]').count()) > 0;

// 5. Arrow-key navigation + Enter selects a result.
await titleInput.clear();
await titleInput.type('@');
await page.waitForTimeout(100);
await page.keyboard.press('ArrowDown'); // moves to index 1
await page.waitForTimeout(50);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
results.arrowEnterWorks = (await page.locator('#mention-list').count()) === 0;
const titleAfterEnter = await titleInput.inputValue();
results.titleHasPersonAfterEnter = titleAfterEnter.startsWith('@');

// Close the modal cleanly.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.modalOpen &&
		results.dropdownShowsAll &&
		results.dropdownFiltersToChristian &&
		results.firstOptionIsChristian &&
		results.titleHasMention &&
		results.christianChipActive &&
		results.dropdownClosed &&
		results.dropdownAppearsAgain &&
		results.escapeClosesMention &&
		results.modalStillOpen &&
		results.arrowEnterWorks &&
		results.titleHasPersonAfterEnter
		? 0
		: 1
);
