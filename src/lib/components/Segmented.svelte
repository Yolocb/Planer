<script lang="ts">
	interface SegOption {
		value: string;
		label: string;
		/** Optional emoji shown alongside / above the label. */
		icon?: string;
	}
	interface Props {
		options: SegOption[];
		/** Currently selected value. */
		value: string;
		onSelect: (value: string) => void;
		/** Accessible label for the control group. */
		label: string;
		/** Stack the icon above the label (used for the theme-mode control). */
		stacked?: boolean;
	}

	let { options, value, onSelect, label, stacked = false }: Props = $props();
</script>

<!-- iOS-style segmented control: a soft track with a raised active segment.
     Buttons (not radios) so existing role/name-based smokes keep matching. -->
<div class="flex gap-1 rounded-2xl bg-black/5 p-1 dark:bg-white/10" role="group" aria-label={label}>
	{#each options as opt (opt.value)}
		{@const active = value === opt.value}
		<button
			type="button"
			onclick={() => onSelect(opt.value)}
			aria-pressed={active}
			class="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent {stacked
				? 'flex-col gap-1 py-1.5 text-xs'
				: 'py-2 text-sm'} {active
				? 'bg-surface font-semibold text-accent shadow-sm'
				: 'font-medium opacity-60 hover:opacity-100'}"
		>
			{#if opt.icon}
				<span class={stacked ? 'text-lg' : 'text-base'} aria-hidden="true">{opt.icon}</span>
			{/if}
			{opt.label}
		</button>
	{/each}
</div>
