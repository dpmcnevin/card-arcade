<!-- The overlays over the table, for any game: the hand's score, the board
     won, and the end of the run. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Button from './Button.svelte';
	import ScorePanel from './ScorePanel.svelte';
	import BoardWonPanel from './BoardWonPanel.svelte';

	const run = $derived((void arcade.v, arcade.run!));
	const m = $derived(run.module);
	const b = $derived(run.result);
	const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2));
</script>

<!-- The run is mutated in place: redraw when it changes. -->
{#key arcade.v}
{#if run.phase === R.PHASE.SCORED && b && !arcade.hold}
	<ScorePanel />
{:else if run.phase === R.PHASE.WON && run.lastPayout}
	<BoardWonPanel />
{:else if run.phase === R.PHASE.OVER || run.phase === R.PHASE.VICTORY}
	<div class="panel">
		<h2>{run.phase === R.PHASE.VICTORY ? 'Victory!' : 'Run over'}</h2>
		<div class="dim">Reached {m.words.table} {run.table}, {R.boardName(run)}</div>
		<div class="endstats">
			<div><span>{m.words.hands}</span><b>{run.stats.hands}</b></div>
			<div><span>Best {m.words.hand}</span><b>{run.stats.best.toLocaleString()}</b></div>
			<div><span>Total</span><b>{run.stats.total.toLocaleString()}</b></div>
			<div><span>Ploys used</span><b>{run.stats.ploysUsed}</b></div>
			{#each Object.entries(m.counterNames ?? {}) as [k, label]}<div><span>{label}</span><b>{m.counters?.(run)[k] ?? 0}</b></div>{/each}
		</div>
		<div class="dim">Relics: {run.relics.map((r) => r.name).join(', ') || 'none'} · seed {run.seed}</div>
		<Button variant="plain" size="sm" onclick={() => arcade.downloadLog()} style="width: 200px">Download the game log</Button>
		{#if run.phase === R.PHASE.VICTORY}
			<Button variant="ploy" onclick={() => arcade.do({ t: 'endless' })} style="width: 200px">Keep going</Button>
		{/if}
		<Button onclick={() => arcade.start(m.id)} style="width: 200px">New run</Button>
		<Button variant="plain" onclick={() => arcade.toMenu()} style="width: 200px">Menu</Button>
	</div>
{/if}
{/key}

<style>
	.panel {
		position: absolute;
		left: var(--tcx);
		top: calc(var(--ty) + 120px);
		transform: translateX(-50%);
		width: 560px;
		box-sizing: border-box;
		padding: 20px 26px;
		background: rgba(12, 22, 18, 0.97);
		border: 3px solid var(--good);
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: stretch;
		z-index: 120;
	}
	.panel :global(.btn) {
		align-self: flex-end;
	}
	h2 {
		margin: 0 0 6px;
		color: var(--brass);
		font-size: 30px;
	}
	.endstats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.endstats div {
		display: flex;
		flex-direction: column;
		padding: 6px 8px;
		background: var(--panel);
	}
	.endstats span {
		font-size: 12px;
		color: var(--ink-dim);
	}
	.endstats b {
		font-size: 22px;
		color: var(--brass);
	}
	.dim {
		color: var(--ink-dim);
	}
</style>
