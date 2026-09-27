// Dependency-free confetti burst for chore-completion celebrations.
// Appends a throwaway full-screen canvas, animates particles, then cleans up.
// No-op when the user prefers reduced motion.

const COLORS = ['#4A90D9', '#E87C6B', '#6BBF6E', '#F5A623', '#ffffff'];

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	color: string;
	rot: number;
	vr: number;
}

/**
 * Fire a confetti burst. `big` doubles the particle count for the
 * "all chores done" moment.
 */
export function celebrate(opts: { big?: boolean } = {}): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

	const canvas = document.createElement('canvas');
	canvas.style.cssText =
		'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100';
	const dpr = window.devicePixelRatio || 1;
	const W = window.innerWidth;
	const H = window.innerHeight;
	canvas.width = W * dpr;
	canvas.height = H * dpr;
	document.body.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		canvas.remove();
		return;
	}
	ctx.scale(dpr, dpr);

	const count = opts.big ? 160 : 80;
	const cx = W / 2;
	const cy = H * 0.4;
	const particles: Particle[] = Array.from({ length: count }, () => {
		const angle = Math.random() * Math.PI * 2;
		const speed = 4 + Math.random() * 7;
		return {
			x: cx,
			y: cy,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 4,
			size: 6 + Math.random() * 6,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			rot: Math.random() * Math.PI,
			vr: (Math.random() - 0.5) * 0.3
		};
	});

	const start = performance.now();
	const DURATION = 1400;

	function frame(now: number) {
		const elapsed = now - start;
		ctx!.clearRect(0, 0, W, H);
		for (const p of particles) {
			p.vy += 0.18; // gravity
			p.x += p.vx;
			p.y += p.vy;
			p.rot += p.vr;
			ctx!.save();
			ctx!.translate(p.x, p.y);
			ctx!.rotate(p.rot);
			ctx!.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
			ctx!.fillStyle = p.color;
			ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
			ctx!.restore();
		}
		if (elapsed < DURATION) {
			requestAnimationFrame(frame);
		} else {
			canvas.remove();
		}
	}
	requestAnimationFrame(frame);
}
