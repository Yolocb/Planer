import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { AppSettings } from '$lib/types';

const STORAGE_KEY = 'familycal-settings';

export const DEFAULT_SETTINGS: AppSettings = {
	defaultView: 'week',
	weekStartsOn: 1,
	timeFormat: '24h',
	theme: 'auto'
};

function load(): AppSettings {
	if (!browser) return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		// Merge so newly-added settings keys fall back to defaults.
		return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function createSettingsStore() {
	const { subscribe, set, update } = writable<AppSettings>(load());

	function persist(value: AppSettings) {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
			} catch {
				// Storage may be unavailable (private mode) — settings stay in-memory.
			}
		}
		return value;
	}

	return {
		subscribe,
		set(value: AppSettings) {
			set(persist(value));
		},
		update(fn: (value: AppSettings) => AppSettings) {
			update((current) => persist(fn(current)));
		},
		/** Patch a subset of settings. */
		patch(partial: Partial<AppSettings>) {
			update((current) => persist({ ...current, ...partial }));
		},
		reset() {
			set(persist({ ...DEFAULT_SETTINGS }));
		}
	};
}

export const settings = createSettingsStore();
