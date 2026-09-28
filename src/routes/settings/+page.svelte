<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { ChevronLeft } from '@lucide/svelte';
	import { settings } from '$lib/stores/settings';
	import { loadEvents, importEvents } from '$lib/stores/events';
	import { loadChores } from '$lib/stores/chores';
	import { getEvents, getChores, clearAllData, replaceAllData } from '$lib/stores/db';
	import { downloadText, pickTextFile } from '$lib/utils/file';
	import { eventsToIcs, icsToNewEvents } from '$lib/utils/ical';
	import { buildBackup, parseBackup } from '$lib/utils/backup';
	import Segmented from '$lib/components/Segmented.svelte';
	import type { PaletteSetting, ThemeSetting, CalendarViewId } from '$lib/types';

	// Prevent demo chores from re-seeding after an explicit clear / restore.
	const CHORES_SEED_FLAG = 'familycal-chores-seeded';

	const THEMES: { id: ThemeSetting; label: string; icon: string }[] = [
		{ id: 'light', label: 'Hell', icon: '☀️' },
		{ id: 'dark', label: 'Dunkel', icon: '🌙' },
		{ id: 'auto', label: 'Automatisch', icon: '🌗' }
	];

	const PALETTES: { id: PaletteSetting; name: string; swatch: string; hint: string }[] = [
		{
			id: 'modern',
			name: 'Modern',
			swatch: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
			hint: 'Sleek & klar'
		},
		{
			id: 'feminin',
			name: 'Feminin',
			swatch: 'linear-gradient(135deg,#e0699a,#b57edc)',
			hint: 'Sanft & elegant'
		},
		{
			id: 'kind',
			name: 'Kind',
			swatch: 'linear-gradient(135deg,#ff8a3d,#ff6b9d)',
			hint: 'Bunt & verspielt'
		}
	];

	const VIEWS: { id: CalendarViewId; label: string }[] = [
		{ id: 'week', label: 'Woche' },
		{ id: 'month', label: 'Monat' },
		{ id: 'agenda', label: 'Agenda' }
	];

	/** Transient status message shown at the bottom of the Data section. */
	let status = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
	function flash(kind: 'ok' | 'error', text: string) {
		status = { kind, text };
		setTimeout(() => (status = null), 4000);
	}

	/** Pending confirmation (restore / clear) rendered as an inline dialog. */
	let confirming = $state<{ text: string; run: () => Promise<void> } | null>(null);

	/** Label of the in-progress data operation, or null. Drives the skeleton. */
	let busy = $state<string | null>(null);

	/** Yield one frame so the skeleton paints before a blocking parse runs. */
	const nextFrame = () => new Promise((r) => setTimeout(r, 0));

	onMount(() => {
		// Populate the in-memory stores so a later "back" shows fresh data.
		loadEvents();
		loadChores();
	});

	async function exportIcs() {
		try {
			const events = await getEvents();
			if (events.length === 0) return flash('error', 'Keine Termine zum Exportieren.');
			downloadText('familycal.ics', 'text/calendar', eventsToIcs(events));
			flash('ok', `${events.length} Termine als .ics exportiert.`);
		} catch (err) {
			flash('error', `Export fehlgeschlagen: ${(err as Error).message}`);
		}
	}

	async function importIcs() {
		try {
			const file = await pickTextFile('.ics,text/calendar');
			if (!file) return;
			busy = 'Termine werden importiert …';
			await nextFrame();
			const newEvents = icsToNewEvents(file.text, 'family');
			if (newEvents.length === 0) return flash('error', 'Keine Termine in der Datei gefunden.');
			const n = await importEvents(newEvents);
			flash('ok', `${n} Termine importiert.`);
		} catch (err) {
			flash('error', `Import fehlgeschlagen: ${(err as Error).message}`);
		} finally {
			busy = null;
		}
	}

	async function exportBackup() {
		try {
			const [events, chores] = await Promise.all([getEvents(), getChores()]);
			downloadText('familycal-backup.json', 'application/json', buildBackup(events, chores));
			flash('ok', 'Backup gespeichert.');
		} catch (err) {
			flash('error', `Backup fehlgeschlagen: ${(err as Error).message}`);
		}
	}

	async function importBackup() {
		try {
			const file = await pickTextFile('.json,application/json');
			if (!file) return;
			busy = 'Backup wird gelesen …';
			await nextFrame();
			const { events, chores } = parseBackup(file.text);
			confirming = {
				text: `Backup wiederherstellen? Alle aktuellen Daten werden durch ${events.length} Termine und ${chores.length} Aufgaben ersetzt.`,
				run: async () => {
					await replaceAllData(events, chores);
					localStorage.setItem(CHORES_SEED_FLAG, '1');
					await Promise.all([loadEvents(), loadChores()]);
					flash('ok', 'Backup wiederhergestellt.');
				}
			};
		} catch (err) {
			flash('error', `Backup ungültig: ${(err as Error).message}`);
		} finally {
			busy = null;
		}
	}

	function clearData() {
		confirming = {
			text: 'Wirklich ALLE Termine und Aufgaben unwiderruflich löschen?',
			run: async () => {
				await clearAllData();
				localStorage.setItem(CHORES_SEED_FLAG, '1');
				await Promise.all([loadEvents(), loadChores()]);
				flash('ok', 'Alle Daten wurden gelöscht.');
			}
		};
	}

	async function runConfirm() {
		const action = confirming;
		confirming = null;
		if (!action) return;
		busy = 'Einen Moment …';
		await nextFrame();
		try {
			await action.run();
		} catch (err) {
			flash('error', `Fehlgeschlagen: ${(err as Error).message}`);
		} finally {
			busy = null;
		}
	}

	/** Escape dismisses the confirm dialog (same as Abbrechen). */
	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && confirming) confirming = null;
	}
</script>

<svelte:window onkeydown={handleEscape} />

<div class="mx-auto flex min-h-dvh max-w-lg flex-col bg-bg text-text">
	<!-- Header -->
	<header
		class="panel sticky top-0 z-10 flex items-center gap-2 rounded-none border-x-0 border-t-0 px-3 py-3"
	>
		<a
			href={resolve('/')}
			aria-label="Zurück"
			class="grid size-11 place-items-center rounded-full bg-black/5 transition-all duration-200 ease-out hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:bg-white/10 dark:hover:bg-white/15"
		>
			<ChevronLeft size={22} aria-hidden="true" />
		</a>
		<h1 class="text-lg font-bold tracking-tight">Einstellungen</h1>
	</header>

	<div class="flex-1 space-y-6 p-4 pb-16">
		<!-- Darstellung -->
		<section class="space-y-3">
			<h2 class="px-1 text-xs font-semibold uppercase tracking-wide opacity-60">Darstellung</h2>
			<div class="space-y-4 rounded-2xl border border-black/5 bg-surface p-4 dark:border-white/10">
				<div>
					<span class="mb-2 block text-sm font-medium">Modus</span>
					<Segmented
						label="Modus"
						stacked
						value={$settings.theme}
						onSelect={(v) => settings.patch({ theme: v as ThemeSetting })}
						options={THEMES.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
					/>
				</div>

				<div>
					<span class="mb-2 block text-sm font-medium">Farbthema</span>
					<div class="space-y-1.5">
						{#each PALETTES as p (p.id)}
							{@const active = $settings.palette === p.id}
							<button
								type="button"
								onclick={() => settings.patch({ palette: p.id })}
								aria-pressed={active}
								class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10 {active
									? 'bg-black/5 dark:bg-white/10'
									: ''}"
							>
								<span
									class="size-7 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
									style={`background: ${p.swatch};`}
									aria-hidden="true"
								></span>
								<span class="min-w-0 flex-1">
									<span class="block text-sm font-semibold">{p.name}</span>
									<span class="block text-xs opacity-60">{p.hint}</span>
								</span>
								{#if active}
									<span class="text-sm font-bold text-accent" aria-hidden="true">✓</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!-- Kalender -->
		<section class="space-y-3">
			<h2 class="px-1 text-xs font-semibold uppercase tracking-wide opacity-60">Kalender</h2>
			<div class="space-y-4 rounded-2xl border border-black/5 bg-surface p-4 dark:border-white/10">
				<div>
					<span class="mb-2 block text-sm font-medium">Standardansicht</span>
					<Segmented
						label="Standardansicht"
						value={$settings.defaultView}
						onSelect={(v) => settings.patch({ defaultView: v as CalendarViewId })}
						options={VIEWS.map((v) => ({ value: v.id, label: v.label }))}
					/>
				</div>

				<div>
					<span class="mb-2 block text-sm font-medium">Wochenstart</span>
					<Segmented
						label="Wochenstart"
						value={String($settings.weekStartsOn)}
						onSelect={(v) => settings.patch({ weekStartsOn: Number(v) as 0 | 1 })}
						options={[
							{ value: '1', label: 'Montag' },
							{ value: '0', label: 'Sonntag' }
						]}
					/>
				</div>

				<div>
					<span class="mb-2 block text-sm font-medium">Zeitformat</span>
					<Segmented
						label="Zeitformat"
						value={$settings.timeFormat}
						onSelect={(v) => settings.patch({ timeFormat: v as '12h' | '24h' })}
						options={[
							{ value: '24h', label: '24 Stunden' },
							{ value: '12h', label: '12 Stunden' }
						]}
					/>
				</div>
			</div>
		</section>

		<!-- Daten -->
		<section class="space-y-3">
			<h2 class="px-1 text-xs font-semibold uppercase tracking-wide opacity-60">Daten</h2>
			<div class="space-y-2 rounded-2xl border border-black/5 bg-surface p-4 dark:border-white/10">
				<p class="text-xs opacity-60">
					Exportiere deine Termine für andere Kalender oder sichere alle Daten als Backup.
				</p>
				<div class="grid grid-cols-2 gap-2">
					<button type="button" class="btn btn-secondary" onclick={exportIcs}>
						📤 .ics exportieren
					</button>
					<button type="button" class="btn btn-secondary" onclick={importIcs}>
						📥 .ics importieren
					</button>
					<button type="button" class="btn btn-secondary" onclick={exportBackup}>
						💾 Backup sichern
					</button>
					<button type="button" class="btn btn-secondary" onclick={importBackup}>
						♻️ Wiederherstellen
					</button>
				</div>
				{#if busy}
					<div class="space-y-2" aria-live="polite" aria-busy="true">
						<p class="text-sm opacity-70">{busy}</p>
						<div class="skeleton h-4 w-3/4"></div>
						<div class="skeleton h-4 w-1/2"></div>
						<div class="skeleton h-4 w-2/3"></div>
					</div>
				{:else if status}
					<p
						class="rounded-lg px-3 py-2 text-sm {status.kind === 'ok'
							? 'bg-feli/15 text-feli'
							: 'bg-janina/15 text-janina'}"
					>
						{status.text}
					</p>
				{/if}
			</div>
		</section>

		<!-- Gefahrenzone -->
		<section class="space-y-3">
			<h2 class="px-1 text-xs font-semibold uppercase tracking-wide opacity-60">Gefahrenzone</h2>
			<div class="rounded-2xl border border-janina/30 bg-surface p-4">
				<button type="button" class="btn btn-danger w-full" onclick={clearData}>
					Alle Daten löschen
				</button>
			</div>
		</section>

		<p class="px-1 text-center text-xs opacity-40">
			FamilyCal · alle Daten bleiben auf diesem Gerät
		</p>
	</div>
</div>

<!-- Confirm dialog for destructive / replacing actions -->
{#if confirming}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-text"
	>
		<div class="w-full max-w-sm rounded-2xl bg-surface p-5 text-text shadow-2xl">
			<p id="confirm-text" class="text-sm">{confirming.text}</p>
			<div class="mt-4 flex gap-2">
				<button type="button" class="btn btn-secondary flex-1" onclick={() => (confirming = null)}>
					Abbrechen
				</button>
				<button type="button" class="btn btn-danger flex-1" onclick={runConfirm}>
					Fortfahren
				</button>
			</div>
		</div>
	</div>
{/if}
