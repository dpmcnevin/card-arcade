<!-- The table ahead, for any game, shown as each board starts: its boards
     with their goals and pay, the boss on the last, and the tag for skipping
     the board you're on. -->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import { TAGS } from '$kit/src/run/content.ts';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';

	let { close }: { close: () => void } = $props();
	const run = arcade.run!;
	const m = run.module;
	const boards = Array.from({ length: m.boardsPerTable }, (_, i) => i + 1);
	const name = (b: number) => m.boardName?.({ ...run, board: b }) ?? `Board ${b}`;
	const tag = R.skipTag(run);
	// Opened from the sidebar mid-board, it's a look, not a start.
	const started = run.score > 0 || run.handsLeft < run.handsThisBoard || run.phase === R.PHASE.SCORED;
</script>

<div class="veil" transition:fade={{ duration: 150 }}>
	<div class="panel" in:fly={{ y: 30, duration: 300, easing: backOut }}>
		<div class="head">
			<h2>{m.words.table} {run.table} of {m.tables}{run.endless && run.table > m.tables ? ' · endless' : ''}</h2>
			<div class="dots">{#each Array(m.tables) as _, i}<span class:done={i + 1 < run.table} class:now={i + 1 === run.table}></span>{/each}</div>
		</div>
		<p class="dim">Reach each board's goal within its {m.words.hands} to move on.</p>
		<div class="boards">
			{#each boards as b}
				{@const boss = b === m.boardsPerTable ? run.boss : null}
				<div class="board" class:now={b === run.board} class:past={b < run.board} class:boss={!!boss}>
					<div class="bh"><b>{name(b)}</b><span>{b < run.board ? 'done' : b === run.board ? 'now' : 'up next'}</span></div>
					<div class="goal">{R.goalFor(m, run.table, b).toLocaleString()}</div>
					<div class="dim">{(boss?.hands ?? m.handsPerBoard)} {m.words.hands} · pays ${R.MONEY_PER_BOARD}{boss ? `+${R.BOSS_BONUS}` : ''}</div>
					{#if b === run.board && started}<div class="prog">Scored {run.score.toLocaleString()} · {run.handsLeft} {m.words.hands} left</div>{/if}
					{#if boss}
						<div class="bossname">Boss: {boss.name}</div>
						<div class="dim">{boss.text}</div>
					{:else if b < m.boardsPerTable && run.tagOffers[b - 1]}
						{@const t = TAGS[run.tagOffers[b - 1]]}
						<div class="tag"><Icon name={t.icon} scale={1} /><span>Skip for {t.name}: {t.text.toLowerCase()}</span></div>
					{/if}
				</div>
			{/each}
		</div>
		<div class="foot">
			{#if tag}
				<Button variant="ploy" onclick={() => { close(); arcade.do({ t: 'skip' }); }} style="width: 240px">Skip for {TAGS[tag].name}</Button>
			{/if}
			<Button pulse onclick={close} style="width: 220px">{started ? 'Back to the table' : `Play ${name(run.board)}`}</Button>
		</div>
	</div>
</div>

<style>
	.veil {
		position: absolute;
		left: var(--tx);
		top: var(--ty);
		width: var(--tw);
		height: var(--th);
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 140;
	}
	.panel {
		width: min(820px, calc(var(--tw) - 40px));
		padding: 20px 26px;
		background: rgba(12, 22, 18, 0.97);
		border: 3px solid var(--brass-dim);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		color: var(--brass);
		font-size: 34px;
	}
	.dots {
		display: flex;
		gap: 5px;
	}
	.dots span {
		width: 12px;
		height: 12px;
		background: var(--panel-edge);
	}
	.dots .done {
		background: var(--brass-dim);
	}
	.dots .now {
		background: var(--ink);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.boards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin: 14px 0 18px;
	}
	.board {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		background: var(--panel);
		border: 2px solid var(--panel-edge);
		min-height: 150px;
	}
	.board.now {
		border-color: var(--brass);
	}
	.board.past {
		opacity: 0.55;
	}
	.board.boss {
		border-color: var(--bad);
	}
	.bh {
		display: flex;
		justify-content: space-between;
		font-size: 18px;
	}
	.bh span {
		color: var(--brass);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.goal {
		font-size: 34px;
		font-weight: 700;
	}
	.prog {
		color: var(--good);
		font-size: 14px;
	}
	.bossname {
		color: var(--bad);
		margin-top: 4px;
	}
	.tag {
		display: flex;
		gap: 6px;
		align-items: center;
		margin-top: 4px;
		color: var(--ploy-light);
		font-size: 13px;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}
</style>
