<!-- A hand's score, for any game: the lines come in one by one while chips
     and mult count up, then the total lands. When this one hand beat the
     board's goal it lands in gold, with a turning sunburst behind it and a
     shine across it. A click skips to the end. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, scale as pop } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { arcade } from '../app.svelte.ts';
	import { fx } from '../fx.svelte.ts';
	import { hex } from '$kit/src/core/ui/theme.ts';
	import * as sound from '../audio/sound.ts';
	import { editionColor } from './editions.ts';
	import Button from './Button.svelte';

	const run = arcade.run!;
	const m = run.module;
	const b = run.result!;
	const STEP = 280;

	let shown = $state(0);
	const done = $derived(shown >= b.lines.length);
	const chips = new Tween(0, { duration: 220, easing: cubicOut });
	const mult = new Tween(1, { duration: 220, easing: cubicOut });
	const onFire = b.made && b.total >= run.target && b.total > 0;

	/** Chips and mult after the first n lines. */
	function upTo(n: number): [number, number] {
		let c = 0,
			x = 1;
		for (const l of b.lines.slice(0, n)) {
			c += l.chips ?? 0;
			x += l.mult ?? 0;
			if (l.xmult) x *= l.xmult;
		}
		return n >= b.lines.length ? [b.chips, b.mult] : [c, x];
	}

	function reveal(n: number) {
		shown = n;
		const [c, x] = upTo(n);
		chips.target = c;
		mult.target = x;
	}

	let timer: ReturnType<typeof setInterval> | null = null;
	function land() {
		if (timer) clearInterval(timer);
		timer = null;
		reveal(b.lines.length);
		if (!b.made) return sound.play('down');
		sound.play('total');
		if (onFire) {
			fx.burst(1080, 470, 46, [hex('#f6e3a8'), hex('#e8c873'), hex('#d9a441'), hex('#ece6d6')], 340, { life: 1.1, size: 8 });
			fx.shake(6);
		} else if (b.total > 0) fx.burst(1080, 470, 14, [hex('#d9a441'), hex('#ece6d6')], 200, { life: 0.7, size: 6 });
	}

	onMount(() => {
		timer = setInterval(() => {
			if (shown >= b.lines.length) return land();
			const l = b.lines[shown];
			sound.play(l.mult || l.xmult ? 'mult' : 'tick', { pitch: 1 + shown * 0.04, volume: 0.7 });
			reveal(shown + 1);
		}, STEP);
		return () => timer && clearInterval(timer);
	});

	const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2));
	const big = (n: number) => Math.round(n).toLocaleString();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="panel" class:bad={!b.made} onclick={() => !done && land()}>
	<h2>{b.title}</h2>
	{#if arcade.ui?.scoreChips}
		<div class="chips">{#each arcade.ui.scoreChips(run) as c}<span class="chip {c.tone ?? ''}" class:me={c.me}>{c.text}</span>{/each}</div>
	{:else if arcade.ui?.scoreLine}<div class="sum">{arcade.ui.scoreLine(run)}</div>{/if}
	<div class="lines">
		{#each b.lines.slice(0, shown) as l}
			<div class="line" in:fly={{ x: -24, duration: 200, easing: cubicOut }}>
				<span style:color={l.edition ? editionColor(l.edition) : ''}>{l.label}</span>
				<span>
					{#if l.chips}<span class="chips">{l.chips > 0 ? '+' : ''}{fmt(l.chips)}</span>{/if}
					{#if l.mult}<span class="mult">+{fmt(l.mult)}</span>{/if}
					{#if l.xmult && l.xmult !== 1}<span class="mult">x{fmt(l.xmult)}</span>{/if}
					{#if l.money}<span class="money">+${l.money}</span>{/if}
				</span>
			</div>
		{/each}
	</div>
	<div class="total">
		<span class="pill chips-bg">{big(chips.current)}</span>
		<span class="x">x</span>
		<span class="pill mult-bg">{mult.current.toFixed(2)}</span>
		{#if done}
			<span class="eq" class:fire={onFire} in:pop={{ start: 1.6, duration: 320, easing: backOut }}>
				{#if onFire}<span class="rays"></span>{/if}
				<span class="num">{b.made ? big(b.total) : 0}</span>
			</span>
		{/if}
	</div>
	<div class="dim">{m.words.table} {run.table} · goal {run.target.toLocaleString()} · scored {run.score.toLocaleString()} · {run.handsLeft} {m.words.hands} left</div>
	{#if done}
		<div class="go" in:fly={{ y: 10, duration: 200 }}>
			<Button pulse onclick={() => arcade.do({ t: 'next' })} style="width: 240px">
				{run.score >= run.target ? 'Board won!' : run.handsLeft <= 0 ? 'Out of ' + m.words.hands : 'Next ' + m.words.hand}
			</Button>
		</div>
	{/if}
</div>

<style>
	.panel {
		position: absolute;
		left: var(--tcx);
		top: calc(var(--ty) + 110px);
		transform: translateX(-50%);
		width: 580px;
		box-sizing: border-box;
		padding: 20px 26px;
		background: rgba(12, 22, 18, 0.97);
		border: 3px solid var(--good);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 120;
		cursor: default;
	}
	.panel.bad {
		border-color: var(--bad);
	}
	h2 {
		margin: 0 0 6px;
		color: var(--brass);
		font-size: 30px;
	}
	.sum {
		margin-top: -6px;
		color: var(--ink-dim);
		font-size: 15px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: -4px;
	}
	.chip {
		padding: 3px 10px;
		font-size: 15px;
		background: var(--panel-edge);
		color: var(--ink);
	}
	.chip.good {
		background: color-mix(in srgb, var(--good) 30%, var(--panel));
		color: var(--good);
	}
	.chip.bad {
		background: color-mix(in srgb, var(--bad) 28%, var(--panel));
		color: var(--bad);
	}
	.chip.me {
		outline: 2px solid var(--brass);
		font-weight: 700;
	}
	.lines {
		min-height: 120px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.line {
		display: flex;
		justify-content: space-between;
		font-size: 17px;
	}
	.chips {
		color: var(--chips);
		margin-left: 8px;
	}
	.mult {
		color: var(--mult);
		margin-left: 8px;
	}
	.money {
		color: var(--brass);
		margin-left: 8px;
	}
	.total {
		margin-top: 8px;
		height: 56px;
		font-size: 30px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pill {
		padding: 2px 14px;
		min-width: 60px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.chips-bg {
		background: var(--chips);
	}
	.mult-bg {
		background: var(--mult);
	}
	.x {
		color: var(--ink-dim);
	}
	.eq {
		position: relative;
		margin-left: auto;
		font-size: 38px;
	}
	/* One hand beat the goal: a gold pill with a shine, a sunburst behind. */
	.eq.fire .num {
		position: relative;
		display: inline-block;
		padding: 0 16px;
		background: linear-gradient(#f0d27a, var(--brass) 55%, #b9822c);
		color: #2a1d08;
		text-shadow: 0 2px 0 rgba(255, 245, 210, 0.6);
		box-shadow:
			0 0 0 3px #f6e3a8,
			0 5px 0 3px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		animation: pulse 1.1s ease-in-out infinite;
	}
	/* A band sliding across by transform (no repaint each frame). */
	.eq.fire .num::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -100%;
		width: 300%;
		background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.85) 50%, transparent 58%);
		animation: shine 1.6s linear infinite;
		will-change: transform;
	}
	.num {
		position: relative;
		z-index: 1;
	}
	.rays {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 190px;
		height: 190px;
		margin: -95px 0 0 -95px;
		border-radius: 50%;
		background: repeating-conic-gradient(rgba(240, 210, 122, 0.55) 0 9deg, transparent 9deg 24deg);
		mask: radial-gradient(circle, #000 25%, transparent 70%);
		-webkit-mask: radial-gradient(circle, #000 25%, transparent 70%);
		animation: spin 9s linear infinite;
		pointer-events: none;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes shine {
		from {
			transform: translateX(-34%);
		}
		to {
			transform: translateX(34%);
		}
	}
	@keyframes pulse {
		50% {
			transform: scale(1.06);
		}
	}
	.dim {
		color: var(--ink-dim);
	}
	.go {
		align-self: flex-end;
	}
</style>
