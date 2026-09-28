<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	interface Props {
		open: boolean;
		/** Governs the button labels. */
		mode: 'edit' | 'delete';
		onChoose: (scope: 'this' | 'future' | 'all') => void;
		onCancel: () => void;
	}

	let { open, mode, onChoose, onCancel }: Props = $props();

	const verb = $derived(mode === 'delete' ? 'löschen' : 'bearbeiten');
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-labelledby="scope-title"
		transition:fade={{ duration: 160 }}
	>
		<div
			class="panel w-full max-w-sm rounded-2xl p-5"
			in:fly={{ y: 16, duration: 200 }}
			out:fade={{ duration: 140 }}
		>
			<h2 id="scope-title" class="mb-1 text-base font-bold">Wiederkehrender Termin</h2>
			<p class="mb-4 text-sm opacity-70">Welche Termine möchtest du {verb}?</p>
			<div class="flex flex-col gap-2">
				<button
					type="button"
					class="min-h-11 rounded-xl bg-black/5 px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
					onclick={() => onChoose('this')}
				>
					Nur diesen Termin
				</button>
				<button
					type="button"
					class="min-h-11 rounded-xl bg-black/5 px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
					onclick={() => onChoose('future')}
				>
					Diesen und alle folgenden
				</button>
				<button
					type="button"
					class="min-h-11 rounded-xl bg-black/5 px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
					onclick={() => onChoose('all')}
				>
					Alle Termine
				</button>
			</div>
			<button
				type="button"
				class="mt-4 min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-medium opacity-70 transition-all duration-200 ease-out hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
				onclick={onCancel}
			>
				Abbrechen
			</button>
		</div>
	</div>
{/if}
