// Pre-renders the game's audio for the iPad app (card-arcade/ipad): every sound effect as a WAV
// file, and several generative music takes as lossless ALAC (.caf), plus a
// manifest with each take's seam point. The app's JavaScriptCore has no JIT,
// so rendering audio on the device would be far too slow; the web build keeps
// rendering live.
//
// Run with: node tools/render-audio.ts <out-dir> [takes]

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { defs, renderTakeAll } from '../src/core/audio/sounds.ts';
import type { Buffer as SynthBuffer } from '../src/core/audio/synth.ts';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node tools/render-audio.ts <out-dir> [takes]');
const takes = Number(process.argv[3]) || 6;

function wav(buf: SynthBuffer): Uint8Array {
	const n = buf.data.length;
	const bytes = new Uint8Array(44 + n * 2);
	const v = new DataView(bytes.buffer);
	const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
	str(0, 'RIFF');
	v.setUint32(4, 36 + n * 2, true);
	str(8, 'WAVE');
	str(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); // PCM
	v.setUint16(22, 1, true); // mono
	v.setUint32(24, buf.rate, true);
	v.setUint32(28, buf.rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	str(36, 'data');
	v.setUint32(40, n * 2, true);
	for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, buf.data[i])) * 32767), true);
	return bytes;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const [name, render] of Object.entries(defs)) {
	writeFileSync(join(OUT, `${name}.wav`), wav(render()));
}

const manifest: { file: string; rate: number; length: number; samples: number }[] = [];
for (let i = 1; i <= takes; i++) {
	const take = renderTakeAll(`ipad-take-${i}`);
	const tmp = join(OUT, `music-${i}.wav`);
	writeFileSync(tmp, wav(take.buffer));
	const caf = `music-${i}.caf`;
	execFileSync('afconvert', ['-f', 'caff', '-d', 'alac', tmp, join(OUT, caf)]);
	rmSync(tmp);
	manifest.push({ file: caf, rate: take.buffer.rate, length: take.length, samples: take.buffer.data.length });
	console.log(`take ${i}: ${(take.length / take.buffer.rate).toFixed(1)}s`);
}
writeFileSync(join(OUT, 'music.json'), JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(defs).length} effects, ${takes} music takes -> ${OUT}`);
