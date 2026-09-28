<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { settings } from '$lib/stores/settings';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	// Web-manifest <link>, injected by @vite-pwa/sveltekit at build time (empty in dev).
	const webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';

	// Apply the light/dark/auto theme + colour palette to <html> from settings.
	$effect(() => {
		if (!browser) return;
		const theme = $settings.theme;
		const prefersDark =
			theme === 'dark' ||
			(theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', prefersDark);
		document.documentElement.dataset.palette = $settings.palette;
	});

	// Register the service worker (registerType: 'autoUpdate') once in the browser.
	onMount(async () => {
		if (!pwaInfo) return;
		const { registerSW } = await import('virtual:pwa-register');
		registerSW({ immediate: true });
	});
</script>

<svelte:head>
	<title>FamilyCal</title>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted build-time manifest link -->
	{@html webManifestLink}
</svelte:head>

{@render children()}
