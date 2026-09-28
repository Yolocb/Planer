<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';
	import { FAMILY_MEMBERS } from '$lib/constants/persons';
	import { getContrastText } from '$lib/utils/colors';
	import { trapFocus } from '$lib/actions/focusTrap';
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
	<div
		class="fixed inset-0 z-50 flex flex-col bg-bg text-text"
		role="dialog"
		aria-modal="true"
		aria-labelledby="chore-modal-title"
		use:trapFocus
		in:fly={{ y: 24, duration: 220 }}
		out:fade={{ duration: 160 }}
	>
		<!-- Header: close + centered title -->
		<header class="panel flex items-center gap-2 rounded-none border-x-0 border-t-0 px-3 py-3">
			<button
				type="button"
				aria-label="Abbrechen"
				class="grid size-11 place-items-center rounded-full opacity-70 transition-all duration-200 ease-out hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/10"
				onclick={onClose}
			>
				<X size={20} aria-hidden="true" />
			</button>
			<h2 id="chore-modal-title" class="flex-1 text-center text-base font-bold">
				{isEditing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
			</h2>
			<span class="size-11" aria-hidden="true"></span>
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
							class="flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-200 ease-out"
							class:opacity-40={!active}
							style={active
								? `background-color: ${person.color}; border-color: ${person.color}; color: ${getContrastText(person.color)};`
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
				<label class="flex min-h-11 items-center justify-between">
					<span class="text-sm font-medium">Erledigt</span>
					<input type="checkbox" bind:checked={done} class="size-6 accent-[var(--color-feli)]" />
				</label>
			{/if}
		</div>

		<!-- Action bar -->
		<footer
			class="panel flex gap-2 rounded-none border-x-0 border-b-0 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
		>
			<button type="button" class="btn btn-secondary" onclick={onClose}>Abbrechen</button>
			<button type="button" class="btn btn-primary btn-lg flex-1" onclick={save}>
				{isEditing ? 'Speichern' : 'Aufgabe erstellen'}
			</button>
		</footer>
	</div>
{/if}
