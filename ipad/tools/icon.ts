// Draws the app icon (1024x1024 PNG) from the kit's own pixel art: three
// cards fanned on the felt. Run with: node tools/icon.ts <out.png>

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { faceBitmap } from '../../kit/src/core/ui/pixelcards.ts';
import { toRGBA } from '../../kit/src/core/ui/pixel.ts';

const N = 1024;
const px = new Uint8ClampedArray(N * N * 4);
const set = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
	if (x < 0 || y < 0 || x >= N || y >= N || a === 0) return;
	const i = (y * N + x) * 4, k = a / 255;
	px[i] = px[i] * (1 - k) + r * k;
	px[i + 1] = px[i + 1] * (1 - k) + g * k;
	px[i + 2] = px[i + 2] * (1 - k) + b * k;
	px[i + 3] = 255;
};
// Felt, with rays from below (in 32px cells).
for (let y = 0; y < N; y++)
	for (let x = 0; x < N; x++) {
		const cx = Math.floor(x / 32) * 32 + 16, cy = Math.floor(y / 32) * 32 + 16;
		const a = Math.atan2(cy - (N + 200), cx - N / 2);
		const ray = Math.floor(((a + Math.PI) / Math.PI) * 18) % 2 === 0;
		const [r, g, b] = ray ? [0x1c, 0x52, 0x39] : [0x14, 0x40, 0x2c];
		set(x, y, r, g, b);
	}
// Three cards: an ace of hearts, the ace of spades, the king of diamonds.
const cards = [
	{ c: { suit: 2, rank: 13 }, ang: -0.32, dx: -190 },
	{ c: { suit: 3, rank: 14 }, ang: 0.32, dx: 190 },
	{ c: { suit: 4, rank: 14 }, ang: 0, dx: 0 }
];
for (const { c, ang, dx } of cards) {
	const bmp = faceBitmap(c, false, false);
	const rgba = toRGBA(bmp, 1);
	const s = Math.max(1, Math.floor(400 / bmp.w)); // art pixels to icon pixels
	const w = bmp.w * s, h = bmp.h * s;
	const ox = N / 2 + dx, oy = N / 2 + 40;
	const cos = Math.cos(ang), sin = Math.sin(ang);
	// Shadow, then the card: inverse-map each icon pixel into the card.
	for (const shadow of [true, false])
		for (let y = 0; y < N; y++)
			for (let x = 0; x < N; x++) {
				const qx = x - ox - (shadow ? 18 : 0), qy = y - oy - (shadow ? 24 : 0);
				const u = cos * qx + sin * qy + w / 2, v = -sin * qx + cos * qy + h / 2;
				if (u < 0 || v < 0 || u >= w || v >= h) continue;
				const i = (Math.floor(v / s) * bmp.w + Math.floor(u / s)) * 4;
				if (rgba[i + 3] === 0) continue;
				if (shadow) set(x, y, 0, 0, 0, 90);
				else set(x, y, rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
			}
}
// PNG.
const crcT = new Int32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c;
});
const crc = (b: Uint8Array) => {
	let c = -1;
	for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
};
const chunk = (type: string, data: Uint8Array) => {
	const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
	v.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	v.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
	return out;
};
const raw = new Uint8Array(N * (N * 3 + 1));
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let k = 0; k < 3; k++) raw[y * (N * 3 + 1) + 1 + x * 3 + k] = px[(y * N + x) * 4 + k];
const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
hv.setUint32(0, N);
hv.setUint32(4, N);
ihdr.set([8, 2, 0, 0, 0], 8);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]);
writeFileSync(process.argv[2], png);
