<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { Trash2, Plus, ClipboardList } from '@lucide/svelte';
	import { chores, toggleChore, removeChore } from '$lib/stores/chores';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { celebrate } from '$lib/utils/confetti';
	import { FAMILY_MEMBERS } from '$lib/constants/persons';
	import type { Chore, PersonId } from '$lib/types';

	interface Props {
		open: boolean;
		onClose: () => void;
		onAdd: () => void;
		onEdit: (chore: Chore) => void;
	}

	let { open, onClose, onAdd, onEdit }: Props = $props();

	// Group chores by family member, in roster order, done-last within each group.
	const grouped = $derived(
		FAMILY_MEMBERS.map((p) => ({
			person: p,
			items: $chores
				.filter((c) => c.personId === (p.id as PersonId))
				.sort(
					(a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate)
				)
		})).filter((g) => g.items.length > 0)
	);

	function fmtDate(iso: string): string {
		return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
			day: '2-digit',
			month: 'short'
		});
	}

	async function onToggle(c: Chore) {
		const nowDone = await toggleChore(c.id);
		if (nowDone) celebrate();
	}

	async function onDelete(c: Chore) {
		if (confirm(`Aufgabe „${c.title}" löschen?`)) await removeChore(c.id);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
		role="dialog"
		aria-modal="true"
		aria-labelledby="chores-title"
		transition:fade={{ duration: 180 }}
	>
		<button
			type="button"
			class="absolute inset-0 h-full w-full"
			aria-label="Schließen"
			onclick={onClose}
		></button>

		<div
			class="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl sm:mb-6 sm:rounded-3xl"
			in:fly={{ y: 320, duration: 260 }}
			out:fly={{ y: 320, duration: 200 }}
		>
			<div class="flex items-center justify-between px-5 pb-3 pt-5">
				<div class="mx-auto flex-1">
					<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25"></div>
					<h2 id="chores-title" class="text-lg font-bold">Aufgaben</h2>
				</div>
			</div>

			<div class="flex-1 space-y-5 overflow-y-auto px-5 pb-3">
				{#if grouped.length === 0}
					<EmptyState
						icon={ClipboardList}
						title="Noch keine Aufgaben"
						subtitle="Tippe auf „Neue Aufgabe“, um die erste Aufgabe anzulegen."
					/>
				{:else}
					{#each grouped as group (group.person.id)}
						<section>
							<div class="mb-2 flex items-center gap-2">
								<span
									class="grid size-5 place-items-center rounded-full text-[10px] font-bold text-white"
									style={`background-color: ${group.person.color};`}
								>
									{group.person.initial}
								</span>
								<h3 class="text-sm font-bold">{group.person.name}</h3>
							</div>
							<div class="space-y-2">
								{#each group.items as c (c.id)}
									<div
										class="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5 dark:bg-white/5"
									>
										<input
											type="checkbox"
											checked={c.completed}
											onchange={() => onToggle(c)}
											aria-label={`${c.title} erledigt`}
											class="size-6 shrink-0 accent-[var(--color-feli)]"
										/>
										<button
											type="button"
											class="min-h-11 min-w-0 flex-1 text-left"
											onclick={() => onEdit(c)}
										>
											<span
												class="block truncate text-sm font-medium {c.completed
													? 'opacity-50 line-through'
													: ''}">{c.title}</span
											>
											<span class="text-xs opacity-50">fällig {fmtDate(c.dueDate)}</span>
										</button>
										<button
											type="button"
											aria-label="Löschen"
											class="grid size-11 shrink-0 place-items-center rounded-full text-red-500 transition-all duration-200 ease-out hover:bg-red-500/10"
											onclick={() => onDelete(c)}
										>
											<Trash2 size={18} aria-hidden="true" />
										</button>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				{/if}
			</div>

			<footer class="border-t border-black/5 px-5 py-3 dark:border-white/10">
				<button type="button" class="btn btn-primary btn-lg w-full" onclick={onAdd}>
					<Plus size={18} aria-hidden="true" /> Neue Aufgabe
				</button>
			</footer>
		</div>
	</div>
{/if}
