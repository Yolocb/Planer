/// <reference lib="webworker" />
// -------------------------------------------------------------------------
// Custom service worker (injectManifest). Replaces the previous Workbox-
// generated SW. Responsibilities:
//   - precache the build assets (offline app shell)
//   - SPA navigation fallback (unmatched navigations → cached shell)
//   - notificationclick: focus/reopen the app on the reminder's day
//   - push: placeholder for tier-2 Web Push
// The base path is injected at build time via Vite `define` (__PWA_BASE__),
// since a worker cannot import $app/paths.
// -------------------------------------------------------------------------
import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare const __PWA_BASE__: string;

// Cast the worker global once instead of redeclaring `self` (avoids clashing
// with the DOM lib's ambient `self`).
const sw = self as unknown as ServiceWorkerGlobalScope;

// Precache everything injected by the build. The reference below MUST be the
// literal `self.__WB_MANIFEST` — injectManifest string-scans the compiled output
// for that exact token, so it can't go through the `sw` alias.
precacheAndRoute(
	(self as unknown as { __WB_MANIFEST: Array<{ url: string; revision: string | null }> })
		.__WB_MANIFEST
);

// SPA offline fallback. adapter-static writes the HTML shell only to the deploy
// output (build/), NOT to the directory the precache manifest is built from, so
// the shell is absent from __WB_MANIFEST and createHandlerBoundToURL would throw
// at evaluation ("non-precached-url"). Instead we cache the shell ourselves and
// serve it for every navigation; SvelteKit's client router takes over from there.
const SHELL_URL = __PWA_BASE__;
const SHELL_CACHE = 'familycal-shell';

// Warm the shell cache on install so the very next offline load has it.
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL_CACHE)
			.then((cache) => cache.add(SHELL_URL))
			.catch(() => {
				// Network hiccup at install: the navigation handler caches lazily instead.
			})
	);
});

// Any navigation resolves to the cached shell (cache-first, lazily populated).
registerRoute(
	new NavigationRoute(async () => {
		const cache = await caches.open(SHELL_CACHE);
		const cached = await cache.match(SHELL_URL);
		if (cached) return cached;
		const resp = await fetch(SHELL_URL);
		if (resp && resp.ok) await cache.put(SHELL_URL, resp.clone());
		return resp;
	})
);

// autoUpdate: activate the new worker immediately instead of waiting.
sw.skipWaiting();
clientsClaim();

// Tapping a reminder focuses an open app window (asking it to navigate to the
// event's day) or opens a new one.
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const data = (event.notification.data ?? {}) as { url?: string; day?: string };
	const target = data.url ?? __PWA_BASE__;
	event.waitUntil(
		(async () => {
			const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				if (client.url.startsWith(__PWA_BASE__)) {
					await client.focus();
					client.postMessage({ type: 'reminder-navigate', day: data.day });
					return;
				}
			}
			await sw.clients.openWindow(target);
		})()
	);
});

// Tier-2 placeholder: Web Push delivery when the app is closed. Intentionally
// inert for now — see the notifications backlog.
sw.addEventListener('push', () => {
	// TODO tier-2: const payload = event.data?.json(); sw.registration.showNotification(...)
});
