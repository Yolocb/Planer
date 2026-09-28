// PWA finalisation checks (Sprint 6). Unlike the other smokes, PWA needs the
// built service worker (devOptions.enabled:false disables it in `dev`), so run
// this against a PREVIEW server:  npm run build && npm run preview
// then:  node scripts/smoke-pwa.mjs   (override with BASE=… if the port differs)
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173/Planer/';

const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const results = {};
const abs = (href) => new URL(href, BASE).toString();

await page.goto(BASE, { waitUntil: 'networkidle' });

// --- 1. Service worker registers and activates ---
results.swReady = await page
	.evaluate(
		() =>
			'serviceWorker' in navigator &&
			Promise.race([
				navigator.serviceWorker.ready.then(() => true),
				new Promise((r) => setTimeout(() => r(false), 8000))
			])
	)
	.catch(() => false);

// --- 2. Manifest is linked, fetches 200, and has the expected shape ---
const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
results.manifestLinked = !!manifestHref;
if (manifestHref) {
	const res = await page.request.get(abs(manifestHref));
	results.manifestStatus = res.status();
	if (res.ok()) {
		const m = await res.json();
		results.manifestName = m.name;
		results.hasMaskableIcon = (m.icons ?? []).some((i) => (i.purpose ?? '').includes('maskable'));
	}
}

// --- 3. Previously-broken / new assets all resolve 200 ---
for (const [key, path] of [
	['favicon', 'favicon.svg'],
	['appleTouch', 'icons/icon-180.png'],
	['maskable512', 'icons/icon-512-maskable.png']
]) {
	const res = await page.request.get(abs(path));
	results[`${key}Status`] = res.status();
}

// --- 4. Meta polish landed in the built shell ---
results.hasDescription = (await page.locator('meta[name="description"]').count()) > 0;
results.viewportAllowsZoom = !(
	(await page.locator('meta[name="viewport"]').getAttribute('content')) ?? ''
).includes('maximum-scale');
results.darkThemeColor =
	(await page.locator('meta[name="theme-color"][media*="dark"]').count()) > 0;

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(
	consoleErrors.length === 0 &&
		results.swReady === true &&
		results.manifestLinked &&
		results.manifestStatus === 200 &&
		results.manifestName === 'FamilyCal' &&
		results.hasMaskableIcon &&
		results.faviconStatus === 200 &&
		results.appleTouchStatus === 200 &&
		results.maskable512Status === 200 &&
		results.hasDescription &&
		results.viewportAllowsZoom &&
		results.darkThemeColor
		? 0
		: 1
);
