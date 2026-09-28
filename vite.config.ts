import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves this project from https://<user>.github.io/Planer/
const base = (process.env.BASE_PATH ?? '/Planer') as '' | `/${string}`;

export default defineConfig({
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
			// SPA: don't try to crawl/prerender routes at build time.
			prerender: { entries: [] }
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'generateSW',
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
			workbox: {
				globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,ico,woff2}'],
				// SPA offline routing: unmatched navigations fall back to the cached
				// app-shell entry (adapter-static emits 404.html; the deploy also
				// copies it to index.html for the root 200).
				navigateFallback: `${base}/`
			},
			devOptions: {
				enabled: false
			}
		})
	],
	test: {
		environment: 'jsdom',
		include: ['tests/unit/**/*.{test,spec}.ts', 'tests/integration/**/*.{test,spec}.ts'],
		globals: true
	}
});
