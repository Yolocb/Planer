// Generates placeholder PWA icons (no external deps) — a simple white
// calendar motif on the FamilyCal blue (#4A90D9). Run: node scripts/generate-icons.mjs
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

function drawIcon(size) {
	const px = (x, y, rgb) => {
		const o = y * size * 3 + x * 3;
		raw[o] = rgb[0];
		raw[o + 1] = rgb[1];
		raw[o + 2] = rgb[2];
	};
	const raw = Buffer.alloc(size * size * 3);
	// Background.
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px(x, y, BLUE);

	// White calendar body with a header band + grid dots.
	const m = Math.round(size * 0.2); // margin
	const bodyTop = Math.round(size * 0.28);
	const rect = (x0, y0, x1, y1, rgb) => {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, rgb);
	};
	rect(m, bodyTop, size - m, size - m, WHITE);
	// Header band.
	const bandH = Math.round(size * 0.12);
	rect(m, bodyTop, size - m, bodyTop + bandH, BLUE);
	// Two hanging rings.
	const ringW = Math.round(size * 0.03);
	rect(
		m + Math.round(size * 0.12),
		bodyTop - Math.round(size * 0.06),
		m + Math.round(size * 0.12) + ringW,
		bodyTop + Math.round(size * 0.02),
		WHITE
	);
	rect(
		size - m - Math.round(size * 0.12) - ringW,
		bodyTop - Math.round(size * 0.06),
		size - m - Math.round(size * 0.12),
		bodyTop + Math.round(size * 0.02),
		WHITE
	);
	// A 3x2 grid of blue dots on the white body.
	const gridTop = bodyTop + bandH + Math.round(size * 0.06);
	const dot = Math.round(size * 0.06);
	const stepX = Math.round((size - 2 * m - dot) / 3);
	const stepY = Math.round(size * 0.14);
	for (let r = 0; r < 2; r++)
		for (let c = 0; c < 3; c++) {
			const x0 = m + Math.round(size * 0.04) + c * stepX;
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

for (const size of [192, 512]) {
	const file = join(OUT_DIR, `icon-${size}.png`);
	writeFileSync(file, drawIcon(size));
	console.log('wrote', file);
}
