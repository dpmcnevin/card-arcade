<!-- Frames per second and the slowest frame in the last second (debug). It
     runs its own frame loop only while it's shown. -->
<script lang="ts">
	import { onMount } from 'svelte';

	let fps = $state(0);
	let worst = $state(0);

	onMount(() => {
		let raf = 0,
			last = performance.now(),
			start = last,
			frames = 0,
			slow = 0;
		const frame = (now: number) => {
			frames++;
			slow = Math.max(slow, now - last);
			last = now;
			if (now - start >= 1000) {
				fps = Math.round((frames * 1000) / (now - start));
				worst = Math.round(slow);
				frames = 0;
				slow = 0;
				start = now;
			}
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="fps" class:bad={fps && fps < 50} title="Frames per second · slowest frame in the last second">{fps} fps · {worst} ms</div>

<style>
	.fps {
		position: absolute;
		right: 8px;
		bottom: 8px;
		z-index: 650;
		padding: 3px 9px;
		background: rgba(10, 16, 13, 0.85);
		border: 2px solid var(--good, #4fbf7a);
		color: var(--good, #4fbf7a);
		font-size: 14px;
		pointer-events: none;
	}
	.fps.bad {
		border-color: #e0604f;
		color: #e0604f;
	}
</style>
