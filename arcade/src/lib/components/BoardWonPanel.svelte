<!-- A board won: the payout comes in like a cash-out, row by row with dollar
     pips and a coin each, then the total, then the way to the club. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import * as sound from '../audio/sound.ts';
	import Button from './Button.svelte';

	const run = arcade.run!;
	const m = run.module;
	const p = run.lastPayout!;
	const rows = [
		{ label: `${R.boardName(run)} won`, n: p.board },
		{ label: `${m.words.hands} left over`, n: p.unused },
		{ label: 'Interest ($1 per $5)', n: p.interest },
		{ label: 'Relics', n: p.relics },
		{ label: 'Boss beaten', n: p.boss }
	].filter((r) => r.n > 0);
	let shown = $state(0);
	const done = $derived(shown >= rows.length);

	onMount(() => {
		const t = setInterval(() => {
			if (shown >= rows.length) {
				clearInterval(t);
				return sound.play('coin', { pitch: 1.2 });
			}
			sound.play('coin', { pitch: 0.9 + shown * 0.08, volume: 0.7 });
			shown++;
		}, 320);
		return () => clearInterval(t);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="panel" onclick={() => (shown = rows.length)}>
	<h2>{R.boardName(run)} won!</h2>
	<div class="dim">Scored {run.score.toLocaleString()} of {run.target.toLocaleString()}</div>
	<div class="rows">
		{#each rows.slice(0, shown) as r}
			<div class="row" in:fly={{ x: -20, duration: 200 }}>
				<span>{r.label}</span>
				<span class="pips">{#each Array(Math.min(r.n, 10)) as _, i}<span class="pip" style:animation-delay="{i * 40}ms">$</span>{/each}</span>
				<span class="money">${r.n}</span>
			</div>
		{/each}
	</div>
	{#if done}
		<div class="total" in:scale={{ start: 1.4, duration: 300, easing: backOut }}><span>Paid</span><span class="money">${p.total}</span></div>
		<div class="dim">You have ${run.money}</div>
		<div class="go" in:fly={{ y: 10, duration: 200 }}>
			<Button pulse onclick={() => arcade.do({ t: 'shop' })} style="width: 240px">To the club</Button>
		</div>
	{/if}
</div>

<style>
	.panel {
		position: absolute;
		left: var(--tcx);
		top: calc(var(--ty) + 110px);
		transform: translateX(-50%);
		width: 520px;
		box-sizing: border-box;
		padding: 20px 26px;
		background: rgba(12, 22, 18, 0.97);
		border: 3px solid var(--brass);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 120;
	}
	h2 {
		margin: 0;
		color: var(--brass);
		font-size: 32px;
	}
	.dim {
		color: var(--ink-dim);
	}
	.rows {
		min-height: 150px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 6px;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto 50px;
		gap: 10px;
		align-items: center;
		font-size: 17px;
	}
	.pips {
		display: flex;
		gap: 2px;
	}
	.pip {
		color: var(--brass);
		font-size: 13px;
		animation: pip 0.25s backwards;
	}
	@keyframes pip {
		from {
			transform: translateY(-8px);
			opacity: 0;
		}
	}
	.money {
		color: var(--brass);
		text-align: right;
		font-weight: 700;
	}
	.total {
		display: flex;
		justify-content: space-between;
		font-size: 26px;
		font-weight: 700;
		border-top: 2px solid var(--panel-edge);
		padding-top: 8px;
	}
	.go {
		align-self: flex-end;
	}
</style>
