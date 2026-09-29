import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves this project from https://<user>.github.io/Planer/
const base = (process.env.BASE_PATH ?? '/Planer') as '' | `/${string}`;

// Dev-only bundle analyzer: `npm run build:analyze` sets ANALYZE=true and emits
// stats.html. Kept out of the normal prod build.
const analyzePlugins = process.env.ANALYZE
	? [
			(await import('rollup-plugin-visualizer')).visualizer({
				filename: 'stats.html',
				gzipSize: true
			})
		]
	: [];

export default defineConfig({
	// Expose the base path to the service worker, which cannot import $app/paths.
	define: {
		__PWA_BASE__: JSON.stringify(`${base}/`)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Static SPA build for GitHub Pages. GitHub serves 404.html for any
			// unmatched path, so that is our SPA fallback; the deploy workflow also
			// copies it to index.html so the root URL resolves with a 200.
			adapter: adapter({ fallback: '404.html', strict: false }),
			paths: { base },
			// SvelteKit compiles src/service-worker.ts but must NOT auto-register it:
			// @vite-pwa/sveltekit owns registration (virtual:pwa-register in +layout).
			// Leaving both on double-registers and, in dev, evaluates the un-injected
			// SW (self.__WB_MANIFEST undefined) → "script evaluation failed".
			serviceWorker: { register: false },
			// SPA: don't try to crawl/prerender routes at build time.
			prerender: { entries: [] }
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'injectManifest',
			// SvelteKit compiles its native SW source (src/service-worker.ts) to
			// service-worker.js; the plugin injects the precache manifest there.
			// We register manually via virtual:pwa-register in +layout.svelte.
			injectRegister: false,
			scope: `${base}/`,
			base: `${base}/`,
			manifest: {
				name: 'FamilyCal',
				short_name: 'FamilyCal',
				description: 'Shared family calendar for the Schumacher family',
				theme_color: '#4A90D9',
				background_color: '#FAFAFA',
				display: 'standalone',
				orientation: 'portrait',
				start_url: `${base}/`,
				scope: `${base}/`,
				icons: [
					{
						src: 'icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'icons/icon-192-maskable.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: 'icons/icon-512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,ico,woff2}']
				// SPA offline routing (navigateFallback) is handled by hand in
				// src/service-worker.ts — injectManifest has no navigateFallback option.
			},
			devOptions: {
				enabled: false
			}
		}),
		...analyzePlugins
	],
	build: {
		rollupOptions: {
			output: {
				// Keep FullCalendar (the largest dependency) in its own stable chunk so
				// app-code deploys don't bust its long-lived cache entry.
				manualChunks(id) {
					if (id.includes('@fullcalendar')) return 'fullcalendar';
				}
			}
		}
	},
	test: {
		environment: 'jsdom',
		// The default 'forks' pool fails to spawn workers on Windows paths with
		// spaces ("Claude Projects"); threads is reliable here.
		pool: 'threads',
		include: ['tests/unit/**/*.{test,spec}.ts', 'tests/integration/**/*.{test,spec}.ts'],
		globals: true
	}
});
