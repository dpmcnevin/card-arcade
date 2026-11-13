<!-- The look of a relic edition over whatever it wraps (usually an icon):
     an engraved silver sheen, a red gloss, a drifting rainbow foil, TV static,
     glowing magma, frost and sparkles, a buzzing neon tube, or a pale
     see-through ghost for Phantom. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { edition, children }: { edition?: string | null; children: Snippet } = $props();
</script>

{#if edition}
	<span class="shine {edition}">{@render children()}</span>
{:else}
	{@render children()}
{/if}

<style>
	.shine {
		position: relative;
		display: inline-flex;
		overflow: hidden;
		flex: none;
	}
	/* The sheen is a band on an oversized layer that slides across by
	   transform (the GPU moves it; nothing is repainted each frame). */
	.shine::after {
		content: '';
		position: absolute;
		left: -100%;
		top: -100%;
		width: 300%;
		height: 300%;
		pointer-events: none;
		background: linear-gradient(135deg, transparent 44%, rgba(255, 255, 255, 0.85) 50%, transparent 56%);
		mix-blend-mode: screen;
		animation: sweep 1.8s linear infinite;
		will-change: transform;
	}
	.shine.etched::before,
	.shine.lacquered::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}
	.shine.etched::before {
		background: rgba(201, 214, 222, 0.35);
		mix-blend-mode: color;
	}
	.shine.lacquered::before {
		background: rgba(232, 87, 63, 0.3);
		mix-blend-mode: overlay;
	}
	/* Rainbow foil: diagonal bands of color drifting across the card, like a
	   holographic sheen (no center to spin around). The bands repeat every
	   90px along their slant, so sliding the layer sideways by one repeat
	   (90px / sin 110deg = 95.78px) loops seamlessly; it's a transform, so the
	   GPU moves it without repainting. */
	.shine.prismatic::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: calc(100% + 96px);
		pointer-events: none;
		z-index: 1;
		/* The bands written out as one long gradient (not a repeating one,
		   which Chrome draws as tiles that leave a seam on a moving layer). */
		background: linear-gradient(110deg, #ff4d4d 0px, #ffa64d 15px, #fff24d 30px, #66ff66 45px, #4dd2ff 60px, #8c66ff 75px, #ff4d4d 90px, #ffa64d 105px, #fff24d 120px, #66ff66 135px, #4dd2ff 150px, #8c66ff 165px, #ff4d4d 180px, #ffa64d 195px, #fff24d 210px, #66ff66 225px, #4dd2ff 240px, #8c66ff 255px, #ff4d4d 270px, #ffa64d 285px, #fff24d 300px, #66ff66 315px, #4dd2ff 330px, #8c66ff 345px, #ff4d4d 360px, #ffa64d 375px, #fff24d 390px, #66ff66 405px, #4dd2ff 420px, #8c66ff 435px, #ff4d4d 450px, #ffa64d 465px, #fff24d 480px, #66ff66 495px, #4dd2ff 510px, #8c66ff 525px, #ff4d4d 540px, #ffa64d 555px, #fff24d 570px, #66ff66 585px, #4dd2ff 600px, #8c66ff 615px, #ff4d4d 630px, #ffa64d 645px, #fff24d 660px, #66ff66 675px, #4dd2ff 690px, #8c66ff 705px, #ff4d4d 720px);
		opacity: 0.6;
		mix-blend-mode: overlay;
		animation: foil 2.6s linear infinite;
		will-change: transform;
	}

	.shine.phantom {
		opacity: 0.6;
		filter: saturate(0.15) drop-shadow(2px 2px 0 #9fb0ff);
	}
	.shine.phantom::after {
		display: none;
	}
	@keyframes sweep {
		from {
			transform: translate(-34%, -34%);
		}
		to {
			transform: translate(34%, 34%);
		}
	}
	@keyframes foil {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-95.78px);
		}
	}
	/* ---- The animated editions. Each moves by transform or opacity only, so
	   the GPU animates it without repainting. */

	/* Static: TV snow (a tiny noise image, drawn chunky) jumping about, and
	   scanlines rolling down. */
	.shine.static::before {
		content: '';
		position: absolute;
		left: -40px;
		top: -40px;
		right: -40px;
		bottom: -40px;
		pointer-events: none;
		z-index: 1;
		background: url("data:image/png;base64,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") 0 0 / 64px 64px;
		image-rendering: pixelated;
		mix-blend-mode: overlay;
		opacity: 0.75;
		animation: snow 0.4s steps(1) infinite;
		will-change: transform;
	}
	.shine.static::after {
		left: 0;
		top: -100%;
		width: 100%;
		height: 200%;
		background: repeating-linear-gradient(0deg, rgba(20, 20, 30, 0.22) 0 2px, transparent 2px 5px);
		mix-blend-mode: normal;
		animation: scan 3s linear infinite;
	}
	@keyframes snow {
		0% { transform: translate(0, 0); }
		25% { transform: translate(-17px, 11px); }
		50% { transform: translate(13px, -19px); }
		75% { transform: translate(-7px, -9px); }
	}
	@keyframes scan {
		from { transform: translateY(0); }
		to { transform: translateY(50%); }
	}

	/* Molten: a glow of magma, swelling and fading like heat. */
	.shine.molten::before {
		content: '';
		position: absolute;
		inset: -10%;
		pointer-events: none;
		z-index: 1;
		background:
			radial-gradient(ellipse 60% 40% at 30% 75%, rgba(255, 90, 20, 0.95), transparent 70%),
			radial-gradient(ellipse 50% 35% at 75% 25%, rgba(255, 170, 40, 0.85), transparent 70%),
			linear-gradient(rgba(255, 120, 30, 0.35), rgba(200, 30, 10, 0.55));
		box-shadow: inset 0 0 14px 4px rgba(255, 100, 20, 0.9);
		mix-blend-mode: multiply;
		animation: heat 2.4s ease-in-out infinite alternate;
		will-change: transform, opacity;
	}
	@keyframes heat {
		from { opacity: 0.45; transform: scale(1) translateY(2%); }
		to { opacity: 0.85; transform: scale(1.08) translateY(-3%); }
	}

	/* Frost: a cold tint, and sparkles twinkling. */
	.shine.frost::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
		background: linear-gradient(160deg, rgb(150, 205, 255), rgb(215, 238, 255) 50%, rgb(140, 195, 255));
		box-shadow: inset 0 0 12px 3px rgba(90, 170, 255, 0.85);
		mix-blend-mode: multiply;
		opacity: 0.75;
	}
	.shine.frost::after {
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		background:
			radial-gradient(circle at 18% 22%, #fff 0 1.5px, rgba(70, 160, 255, 0.95) 2.5px, transparent 4.0px),
			radial-gradient(circle at 72% 14%, #fff 0 1px, rgba(70, 160, 255, 0.95) 2.0px, transparent 3.5px),
			radial-gradient(circle at 56% 48%, #fff 0 2px, rgba(70, 160, 255, 0.95) 3.0px, transparent 4.5px),
			radial-gradient(circle at 28% 70%, #fff 0 1px, rgba(70, 160, 255, 0.95) 2.0px, transparent 3.5px),
			radial-gradient(circle at 82% 78%, #fff 0 1.5px, rgba(70, 160, 255, 0.95) 2.5px, transparent 4.0px),
			radial-gradient(circle at 44% 90%, #fff 0 1px, rgba(70, 160, 255, 0.95) 2.0px, transparent 3.5px);
		mix-blend-mode: normal;
		animation: twinkle 2.2s steps(4) infinite alternate;
	}
	@keyframes twinkle {
		from { opacity: 0.15; transform: translateY(1px); }
		to { opacity: 1; transform: translateY(-2px); }
	}

	/* Neon: a glowing tube round the card that buzzes and flickers. */
	.shine.neon::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
		box-shadow:
			inset 0 0 0 2px #ff4fd8,
			inset 0 0 0 4px rgba(79, 231, 255, 0.55),
			inset 0 0 14px 4px rgba(255, 79, 216, 0.75);
		animation: buzz 3.2s linear infinite;
		will-change: opacity;
	}
	@keyframes buzz {
		0%, 5%, 9%, 55%, 59%, 100% { opacity: 1; }
		6%, 8% { opacity: 0.25; }
		56%, 58% { opacity: 0.45; }
	}

	/* Stepped: the shine jumps a pixel-art step at a time (a dozen frames a
	   sweep), which a browser without a GPU draws far more cheaply. */
	:global(.stepped) .shine::after {
		animation-timing-function: steps(12);
	}
	:global(.stepped) .shine.prismatic::before {
		animation-timing-function: steps(24);
	}
	@media (prefers-reduced-motion: reduce) {
		.shine::after,
		.shine.prismatic::before,
		.shine.static::before,
		.shine.molten::before,
		.shine.neon::before {
			animation: none;
		}
	}
</style>
