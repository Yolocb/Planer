<script lang="ts">
	import { FAMILY_MEMBERS } from '$lib/constants/persons';
	import { toDateInput } from '$lib/utils/datetime';
	import type { NewChoreData } from '$lib/stores/chores';
	import type { Chore, PersonId } from '$lib/types';

	interface Props {
		open: boolean;
		/** Editing target (its fields prefill the form). */
		chore?: Chore | null;
		/** Default assignee for a new chore. */
		initialPersonId?: PersonId;
		onClose: () => void;
		onSave: (data: NewChoreData) => void;
	}

	let { open, chore = null, initialPersonId = 'feli', onClose, onSave }: Props = $props();

	let title = $state('');
	let personId = $state<PersonId>('feli');
	let dueDate = $state('');
	let done = $state(false);
	let error = $state('');

	const isEditing = $derived(!!chore);

	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) hydrate();
		wasOpen = open;
	});

	function hydrate() {
		error = '';
		if (chore) {
			title = chore.title;
			personId = chore.personId;
			dueDate = chore.dueDate;
			done = chore.completed;
		} else {
			title = '';
			personId = initialPersonId;
			dueDate = toDateInput(new Date());
			done = false;
		}
	}

	function save() {
		const trimmed = title.trim();
		if (!trimmed) {
			error = 'Bitte gib einen Titel ein.';
			return;
		}
		if (trimmed.length > 100) {
			error = 'Der Titel darf höchstens 100 Zeichen haben.';
			return;
		}
		if (!dueDate) {
			error = 'Bitte wähle ein Datum.';
			return;
		}
		onSave({
			title: trimmed,
			personId,
			dueDate,
			completed: done,
			completedAt: done ? (chore?.completedAt ?? new Date().toISOString()) : undefined
		});
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex flex-col bg-bg text-text" role="dialog" aria-modal="true">
		<!-- Header: close + centered title -->
		<header
			class="flex items-center gap-2 border-b border-black/5 bg-surface px-3 py-3 dark:border-white/10"
		>
			<button
				type="button"
				aria-label="Abbrechen"
				class="grid size-9 place-items-center rounded-full text-lg opacity-70 hover:bg-black/5 dark:hover:bg-white/10"
				onclick={onClose}
			>
				✕
			</button>
			<h2 class="flex-1 text-center text-base font-bold">
				{isEditing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
			</h2>
			<span class="size-9" aria-hidden="true"></span>
		</header>

		<div class="flex-1 space-y-5 overflow-y-auto px-4 py-4">
			{#if error}
				<p
					class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/15 dark:text-red-400"
				>
					{error}
				</p>
			{/if}

			<!-- Title -->
			<div>
				<label for="chore-title" class="mb-1 block text-xs font-medium opacity-60">Aufgabe</label>
				<input
					id="chore-title"
					type="text"
					bind:value={title}
					maxlength="100"
					placeholder="z. B. Zimmer aufräumen"
					class="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 text-base outline-none focus:border-christian dark:border-white/15"
				/>
			</div>

			<!-- Person -->
			<div>
				<span class="mb-1.5 block text-xs font-medium opacity-60">Für wen</span>
				<div class="flex flex-wrap gap-2">
					{#each FAMILY_MEMBERS as person (person.id)}
						{@const active = personId === person.id}
						<button
							type="button"
							onclick={() => (personId = person.id as PersonId)}
							aria-pressed={active}
							class="flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
							class:opacity-40={!active}
							style={active
								? `background-color: ${person.color}; border-color: ${person.color}; color: white;`
								: `border-color: ${person.color}; color: ${person.color};`}
						>
							{person.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- Due date -->
			<div>
				<label for="chore-date" class="mb-1 block text-xs font-medium opacity-60">Fällig am</label>
				<input
					id="chore-date"
					type="date"
					bind:value={dueDate}
					class="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 dark:border-white/15"
				/>
			</div>

			{#if isEditing}
				<label class="flex items-center justify-between">
					<span class="text-sm font-medium">Erledigt</span>
					<input type="checkbox" bind:checked={done} class="size-5 accent-[var(--color-feli)]" />
				</label>
			{/if}
		</div>

		<!-- Action bar -->
		<footer
			class="flex gap-2 border-t border-black/5 bg-surface px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-white/10"
		>
			<button type="button" class="btn btn-secondary" onclick={onClose}>Abbrechen</button>
			<button type="button" class="btn btn-primary btn-lg flex-1" onclick={save}>
				{isEditing ? 'Speichern' : 'Aufgabe erstellen'}
			</button>
		</footer>
	</div>
{/if}
