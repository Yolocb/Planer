/**
 * Svelte action for accessible dialogs. When applied to a dialog root:
 * - remembers the element that had focus before the dialog opened,
 * - moves focus into the dialog on open (the container itself by default, so the
 *   mobile keyboard does not pop for form dialogs),
 * - keeps Tab / Shift+Tab cycling within the dialog,
 * - restores focus to the original element when the dialog closes.
 *
 * Each dialog is `{#if open}`-gated, so mount = open and destroy = close. The
 * keydown listener is bound to the node (not document) so a dialog stacked on
 * top of another does not steal Tab handling from the one that holds focus.
 */
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusable(node: HTMLElement): HTMLElement[] {
	return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
	);
}

export function trapFocus(node: HTMLElement) {
	const previouslyFocused = document.activeElement as HTMLElement | null;

	// Focus the container itself (avoids popping the mobile keyboard on form dialogs).
	if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
	node.focus();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const items = focusable(node);
		if (items.length === 0) {
			e.preventDefault();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;

		if (e.shiftKey) {
			if (active === first || active === node) {
				e.preventDefault();
				last.focus();
			}
		} else if (active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
		}
	};
}
