<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { settings } from '$lib/stores/settings';

	let { children } = $props();

	// Apply the light/dark/auto theme to <html> whenever the setting changes.
	$effect(() => {
		if (!browser) return;
		const theme = $settings.theme;
		const prefersDark =
			theme === 'dark' ||
			(theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', prefersDark);
	});
</script>

<svelte:head>
	<title>FamilyCal</title>
	<meta name="theme-color" content="#4A90D9" />
</svelte:head>

{@render children()}
