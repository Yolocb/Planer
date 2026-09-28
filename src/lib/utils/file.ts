// -------------------------------------------------------------------------
// Browser file I/O helpers (dependency-free). Used by the Settings page for
// .ics / JSON export (download) and import (pick a local file).
// -------------------------------------------------------------------------

/** Trigger a download of `text` as a file named `filename`. */
export function downloadText(filename: string, mimeType: string, text: string): void {
	const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	// Revoke on the next tick so the click has been processed.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Prompt the user to pick a local text file and resolve its contents.
 * Resolves `null` if the picker is dismissed without a selection.
 */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.style.display = 'none';

		// `change` fires on selection; if the dialog is cancelled nothing fires,
		// so we also resolve(null) when the window regains focus with no file.
		let settled = false;
		const finish = (value: { name: string; text: string } | null) => {
			if (settled) return;
			settled = true;
			input.remove();
			resolve(value);
		};

		input.addEventListener('change', async () => {
			const file = input.files?.[0];
			if (!file) return finish(null);
			finish({ name: file.name, text: await file.text() });
		});

		// Fallback for cancellation: focus returns to the window without a change.
		window.addEventListener('focus', () => setTimeout(() => finish(null), 500), { once: true });

		document.body.appendChild(input);
		input.click();
	});
}
