// Generates placeholder PWA icons (no external deps) — a simple white
// calendar motif on the FamilyCal blue (#4A90D9). Run: node scripts/generate-icons.mjs
//
// Emits, into static/icons/:
//   icon-192.png / icon-512.png        — purpose "any" (full-bleed motif)
//   icon-180.png                       — apple-touch-icon (opaque; iOS ignores alpha)
//   icon-192-maskable.png / 512        — purpose "maskable" (motif shrunk into the
//                                        central safe zone so Android adaptive masks
//                                        never clip the calendar)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const BLUE = [0x4a, 0x90, 0xd9];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
	let c = ~0;
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i];
		for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
	}
	return ~c >>> 0;
}

function chunk(type, data) {
	const typeBuf = Buffer.from(type, 'ascii');
	const body = Buffer.concat([typeBuf, data]);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

/**
 * @param {number} size    output edge length in px
 * @param {number} scale    fraction of the canvas the motif occupies (1 = full-bleed
 *                          "any" icon; ~0.8 leaves a maskable safe-zone margin).
 */
function drawIcon(size, scale = 1) {
	const px = (x, y, rgb) => {
		const o = y * size * 3 + x * 3;
		raw[o] = rgb[0];
		raw[o + 1] = rgb[1];
		raw[o + 2] = rgb[2];
	};
	const raw = Buffer.alloc(size * size * 3);
	// Background: always full-bleed blue (maskable-safe; masks only trim the blue).
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px(x, y, BLUE);

	// Motif drawn inside a centred D×D box; scale<1 insets it into the safe zone.
	const D = Math.round(size * scale);
	const off = Math.round((size - D) / 2);
	const R = (k) => Math.round(D * k); // scaled length
	const rect = (x0, y0, x1, y1, rgb) => {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, rgb);
	};

	// White calendar body with a header band + grid dots.
	const bl = off + R(0.2); // body left
	const br = off + D - R(0.2); // body right
	const bt = off + R(0.28); // body top
	const bb = off + D - R(0.2); // body bottom
	rect(bl, bt, br, bb, WHITE);
	// Header band.
	const bandH = R(0.12);
	rect(bl, bt, br, bt + bandH, BLUE);
	// Two hanging rings.
	const ringW = R(0.03);
	const ringInset = R(0.12);
	const ringTop = bt - R(0.06);
	const ringBot = bt + R(0.02);
	rect(bl + ringInset, ringTop, bl + ringInset + ringW, ringBot, WHITE);
	rect(br - ringInset - ringW, ringTop, br - ringInset, ringBot, WHITE);
	// A 3x2 grid of blue dots on the white body.
	const gridTop = bt + bandH + R(0.06);
	const dot = R(0.06);
	const gridLeft = bl + R(0.04);
	const stepX = Math.round((br - bl - dot) / 3);
	const stepY = R(0.14);
	for (let r = 0; r < 2; r++)
		for (let c = 0; c < 3; c++) {
			const x0 = gridLeft + c * stepX;
			const y0 = gridTop + r * stepY;
			rect(x0, y0, x0 + dot, y0 + dot, BLUE);
		}

	// PNG: add filter byte (0) at the start of each row.
	const rows = Buffer.alloc(size * (size * 3 + 1));
	for (let y = 0; y < size; y++) {
		rows[y * (size * 3 + 1)] = 0;
		raw.copy(rows, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour RGB
	const png = Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0))
	]);
	return png;
}

const ICONS = [
	{ name: 'icon-192.png', size: 192 },
	{ name: 'icon-512.png', size: 512 },
	{ name: 'icon-180.png', size: 180 }, // apple-touch-icon
	{ name: 'icon-192-maskable.png', size: 192, scale: 0.8 },
	{ name: 'icon-512-maskable.png', size: 512, scale: 0.8 }
];

for (const { name, size, scale } of ICONS) {
	const file = join(OUT_DIR, name);
	writeFileSync(file, drawIcon(size, scale ?? 1));
	console.log('wrote', file);
}
