<!-- The debug menu (press D five times): performance switches, and gameplay
     cheats for the run in progress. -->
<script lang="ts">
	import { debug } from '../debug.svelte.ts';
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';

	const run = $derived((void arcade.v, arcade.run));
	const live = $derived((void arcade.v, !!run && arcade.screen === 'run'));
	const inBoard = $derived((void arcade.v, !!run && (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY || run.phase === R.PHASE.SCORED)));
	const relics = $derived(run ? [...run.module.relics].sort((a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name)) : []);
	const ploys = $derived(run ? R.allPloys(run.module) : []);
	let relic = $state('');
	let ploy = $state('');

	const PERF = [
		['stepped', 'Stepped shine', 'Edition shine in pixel steps: choppier, far less CPU'],
		['noConfetti', 'No confetti', 'Skip every confetti burst'],
		['noShake', 'No screen shake', 'The stage stays still'],
		['noIdle', 'No idle motion', 'Cards stop swaying, wares stop floating, buttons stop bobbing'],
		['noAnim', 'No animation at all', 'Every CSS animation and transition off'],
		['fps', 'Frame meter', 'Frames per second and the slowest frame, in the corner']
	] as const;
</script>

<div class="veil" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && (debug.open = false)}>
	<div class="panel" role="dialog" aria-label="Debug menu">
		<div class="head">
			<h2>Debug</h2>
			<span class="dim">D ×5 to close</span>
			<button class="x" onclick={() => (debug.open = false)}>Close</button>
		</div>
		<div class="cols">
			<section>
				<h3>Performance</h3>
				{#each PERF as [k, label, hint]}
					<label class="row" title={hint}>
						<input type="checkbox" checked={debug[k]} onchange={() => debug.toggle(k)} />
						<span><b>{label}</b><small>{hint}</small></span>
					</label>
				{/each}
			</section>
			<section>
				<h3>Gameplay</h3>
				{#if !live}
					<p class="dim">Start or continue a run to use these.</p>
				{:else}
					<label class="row" title="Every seat's cards face up">
						<input type="checkbox" checked={debug.peek} onchange={() => debug.toggle('peek')} />
						<span><b>See every hand</b><small>All four seats face up</small></span>
					</label>
					<label class="row" title="The bot plays for you, through the club and on">
						<input type="checkbox" checked={debug.autoplay} onchange={() => debug.toggleAutoplay()} />
						<span><b>Autoplay</b><small>The bot plays for you, club included</small></span>
					</label>
					<div class="btns">
						<button onclick={() => debug.cheat({ op: 'money', n: 10 })}>+$10</button>
						<button onclick={() => debug.cheat({ op: 'money', n: 100 })}>+$100</button>
						<button disabled={!inBoard} onclick={() => debug.cheat({ op: 'hand' })}>+1 {run?.module.words.hand}</button>
						<button disabled={!inBoard} onclick={() => debug.cheat({ op: 'win' })}>Win this board</button>
					</div>
					<div class="give">
						<select bind:value={relic}>
							<option value="">Give a relic…</option>
							{#each relics as r}<option value={r.key}>{R.RARITY_NAME[r.rarity]} · {r.name}</option>{/each}
						</select>
						<button disabled={!relic} onclick={() => debug.cheat({ op: 'relic', key: relic })}>Give</button>
					</div>
					<div class="give">
						<select bind:value={ploy}>
							<option value="">Give a ploy…</option>
							{#each ploys as p}<option value={p.key}>{p.name}</option>{/each}
						</select>
						<button disabled={!ploy} onclick={() => debug.cheat({ op: 'ploy', key: ploy })}>Give</button>
					</div>
					<div class="btns">
						<button onclick={() => arcade.downloadLog()}>Download the game log</button>
					</div>
					<p class="dim">Seed {run?.seed}{run?.ext.debugged ? ' · debugged run (the log shows each cheat)' : ''}</p>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.veil {
		position: absolute;
		inset: 0;
		z-index: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
	}
	.panel {
		width: 820px;
		padding: 16px 22px 18px;
		background: #0f1a16;
		border: 3px solid #e0604f;
		box-shadow: 0 8px 0 rgba(0, 0, 0, 0.45);
		color: var(--ink);
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 10px;
	}
	h2 {
		margin: 0;
		font-size: 30px;
		color: #e0604f;
	}
	h3 {
		margin: 0 0 8px;
		font-size: 19px;
		color: var(--brass);
	}
	.x {
		margin-left: auto;
	}
	.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 22px;
	}
	.row {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 5px 0;
		cursor: pointer;
	}
	.row input {
		margin-top: 4px;
		accent-color: var(--brass);
		width: 16px;
		height: 16px;
	}
	.row span {
		display: flex;
		flex-direction: column;
	}
	.row b {
		font-size: 16px;
		font-weight: normal;
	}
	small,
	.dim {
		color: var(--ink-dim);
		font-size: 13px;
	}
	.btns,
	.give {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin: 8px 0;
	}
	.give select {
		flex: 1;
		min-width: 0;
	}
	button,
	select {
		font: inherit;
		font-size: 15px;
		padding: 5px 12px;
		background: var(--panel-edge, #2c4a3d);
		color: var(--ink);
		border: none;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.4);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
