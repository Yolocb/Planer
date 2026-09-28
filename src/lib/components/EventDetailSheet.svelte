<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { PERSON_BY_ID } from '$lib/constants/persons';
	import { getCategoryMeta } from '$lib/constants/categories';
	import { getContrastText, getEventDisplayColor, isGradient } from '$lib/utils/colors';
	import { formatEventRange } from '$lib/utils/datetime';
	import { describeRecurrence } from '$lib/utils/recurrence';
	import { trapFocus } from '$lib/actions/focusTrap';
	import type { CalendarEvent, EventOwnerId, ReminderMinutes } from '$lib/types';

	interface Props {
		open: boolean;
		event: CalendarEvent | null;
		/** Master series for a recurring event, used to show the repeat rule. */
		master?: CalendarEvent | null;
		timeFormat?: '12h' | '24h';
		onClose: () => void;
		onEdit: () => void;
		onDelete: () => void;
	}

	let {
		open,
		event,
		master = null,
		timeFormat = '24h',
		onClose,
		onEdit,
		onDelete
	}: Props = $props();

	const REMINDER_LABEL: Record<ReminderMinutes, string> = {
		15: '15 Minuten vorher',
		30: '30 Minuten vorher',
		60: '1 Stunde vorher',
		1440: '1 Tag vorher'
	};

	const headerColor = $derived(event ? getEventDisplayColor(event) : '#ccc');
	const headerText = $derived(getContrastText(headerColor));
	const owners = $derived(
		(event?.personIds ?? []).map((id) => PERSON_BY_ID[id as EventOwnerId]).filter(Boolean)
	);
	const isRecurring = $derived(!!(event?.recurringEventId || event?.recurrence));
	const rule = $derived(master?.recurrence ?? event?.recurrence);
</script>

{#if open && event}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
		role="dialog"
		aria-modal="true"
		aria-labelledby="detail-title"
		use:trapFocus
		transition:fade={{ duration: 180 }}
	>
		<!-- Click-away backdrop -->
		<button
			type="button"
			class="absolute inset-0 h-full w-full"
			aria-label="Schließen"
			onclick={onClose}
		></button>

		<div
			class="relative z-10 w-full max-w-lg rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl sm:mb-6 sm:rounded-3xl"
			in:fly={{ y: 320, duration: 260 }}
			out:fly={{ y: 320, duration: 200 }}
		>
			<!-- Coloured header -->
			<div
				class="rounded-t-3xl px-5 pb-4 pt-5"
				style={`color: ${headerText}; ${
					isGradient(headerColor)
						? `background: ${headerColor};`
						: `background-color: ${headerColor};`
				}`}
			>
				<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/50"></div>
				<h2 id="detail-title" class="text-lg font-bold leading-tight">{event.title}</h2>
				<p class="mt-1 text-sm" style="opacity: 0.85">
					{formatEventRange(event.start, event.end, event.allDay, timeFormat)}
				</p>
			</div>

			<div class="space-y-3 px-5 py-4 text-sm">
				<!-- Owners -->
				<div class="flex flex-wrap items-center gap-2">
					{#each owners as person (person.id)}
						<span
							class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
							style={`background-color: ${person.color}; color: ${getContrastText(person.color)};`}
						>
							<span
								class="grid size-4 place-items-center rounded-full bg-white/30 text-[9px] font-bold"
							>
								{person.initial}
							</span>
							{person.name}
						</span>
					{/each}
				</div>

				{#if event.category}
					<div class="flex items-center gap-2">
						<span aria-hidden="true">{getCategoryMeta(event.category).icon}</span>
						<span>{getCategoryMeta(event.category).label}</span>
					</div>
				{/if}

				{#if isRecurring && rule}
					<div class="flex items-center gap-2">
						<span aria-hidden="true">🔁</span>
						<span>{describeRecurrence(rule)}</span>
					</div>
				{/if}

				{#if event.location}
					<div class="flex items-center gap-2">
						<span aria-hidden="true">📍</span>
						<span>{event.location}</span>
					</div>
				{/if}

				{#if event.reminder}
					<div class="flex items-center gap-2">
						<span aria-hidden="true">⏰</span>
						<span>{REMINDER_LABEL[event.reminder]}</span>
					</div>
				{/if}

				{#if event.description}
					<p class="whitespace-pre-wrap rounded-xl bg-black/5 p-3 dark:bg-white/10">
						{event.description}
					</p>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-2 border-t border-black/5 px-5 py-3 dark:border-white/10">
				<button type="button" class="btn btn-primary flex-1" onclick={onEdit}> Bearbeiten </button>
				<button type="button" class="btn btn-danger flex-1" onclick={onDelete}> Löschen </button>
			</div>
		</div>
	</div>
{/if}
