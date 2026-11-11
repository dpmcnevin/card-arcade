<!-- Green baize in chunky pixels: an art deco sunburst rising from below the
     table, and a darker edge in four stepped bands. Drawn small and scaled
     up without smoothing, under the cards (as in the iPad app). -->
<script lang="ts">
	let { x, y = 0, w, h }: { x: number; y?: number; w: number; h: number } = $props();

	const CELL = 8;
	let canvas: HTMLCanvasElement;

	$effect(() => {
		const cw = Math.ceil(w / CELL),
			ch = Math.ceil(h / CELL);
		canvas.width = cw;
		canvas.height = ch;
		const g = canvas.getContext('2d')!;
		g.imageSmoothingEnabled = false;
		g.fillStyle = '#14402c';
		g.fillRect(0, 0, cw, ch);
		// Rays: 18 wedges from a point below the table.
		g.fillStyle = 'rgba(28, 82, 57, 0.35)';
		const cx = cw / 2,
			cy = ch + 120 / CELL,
			reach = Math.max(cw, ch) * 3;
		for (let i = 0; i < 36; i += 2) {
			const a0 = Math.PI + (i / 36) * Math.PI,
				a1 = Math.PI + ((i + 1) / 36) * Math.PI;
			g.beginPath();
			g.moveTo(cx, cy);
			g.lineTo(cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach);
			g.lineTo(cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
			g.closePath();
			g.fill();
		}
		// Snap the antialiased edges of the rays to whole pixels.
		const img = g.getImageData(0, 0, cw, ch);
		const base = [0x14, 0x40, 0x2c],
			light = [0x18, 0x48, 0x33];
		const vx = cw / 2,
			vy = ch / 2,
			start = 380 / CELL,
			end = 820 / CELL;
		for (let py = 0; py < ch; py++) {
			for (let px = 0; px < cw; px++) {
				const i = (py * cw + px) * 4;
				const lit = img.data[i + 1] > 0x44;
				const col = lit ? light : base;
				const d = Math.hypot(px + 0.5 - vx, py + 0.5 - vy);
				const t = Math.max(0, Math.min(1, (d - start) / (end - start)));
				const k = 1 - (Math.floor(t * 4) / 4) * 0.5;
				img.data[i] = col[0] * k;
				img.data[i + 1] = col[1] * k;
				img.data[i + 2] = col[2] * k;
				img.data[i + 3] = 255;
			}
		}
		g.putImageData(img, 0, 0);
	});
</script>

<canvas
	bind:this={canvas}
	class="felt"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	aria-hidden="true"
></canvas>

<style>
	.felt {
		position: absolute;
		image-rendering: pixelated;
	}
</style>
