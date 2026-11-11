<!-- Everything a game holds (relics, ploys, bosses, decks, seals,
     editions), marked with what you've found, and your stats. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import * as R from '$kit/src/run/run.ts';
	import { CARD_EDITIONS, RELIC_EDITIONS } from '$kit/src/run/content.ts';
	import type { GameUI } from '../games/types.ts';
	import { arcade } from '../app.svelte.ts';
	import Overlay from './Overlay.svelte';
	import Icon from './Icon.svelte';
	import SealBadge from './SealBadge.svelte';
	import { editionColor } from './editions.ts';

	let { ui, close }: { ui: GameUI; close: () => void } = $props();
	// Opened for one game; it doesn't change while open.
	const m = untrack(() => ui.module);
	const p = arcade.profile(m.id);
	const tabs = ['Relics', 'Ploys', 'Bosses', 'Decks', 'Cards', 'Stats'] as const;
	let tab = $state<(typeof tabs)[number]>('Relics');
	const relics = [...m.relics].sort((a, b) => a.rarity - b.rarity || a.cost - b.cost);
	const found = new Set(p.relicsFound);
	const beaten = new Set(p.bossesBeaten);
	const fmtDate = (t: number) => new Date(t).toLocaleDateString();
</script>

<!-- One height for every tab, so switching tabs doesn't resize it. -->
<Overlay title="{m.title}: collection" {close} width={900} height={620}>
	<div class="tabs">
		{#each tabs as t}<button class:on={tab === t} onclick={() => (tab = t)}>{t}</button>{/each}
	</div>
	{#if tab === 'Relics'}
		<p class="dim">{found.size} of {relics.length} found</p>
		<div class="grid">
			{#each relics as r}
				<div class="item" class:unseen={!found.has(r.key)}>
					<Icon name={r.icon} scale={2} />
					<div><b>{r.name}</b> <span class="rar">{R.RARITY_NAME[r.rarity]} · ${r.cost}</span><br /><span class="dim">{r.text}</span></div>
				</div>
			{/each}
		</div>
	{:else if tab === 'Ploys'}
		<div class="grid">
			{#each R.allPloys(m) as d}
				<div class="item"><Icon name={d.icon} scale={2} /><div><b>{d.name}</b> <span class="rar">${d.cost}</span><br /><span class="dim">{d.text}</span></div></div>
			{/each}
		</div>
	{:else if tab === 'Bosses'}
		<p class="dim">{beaten.size} of {(m.bosses ?? []).length} beaten</p>
		<div class="grid">
			{#each m.bosses ?? [] as b}
				<div class="item" class:unseen={!beaten.has(b.key)}><div><b class="boss">{b.name}</b> <span class="rar">tier {b.tier ?? 1}</span><br /><span class="dim">{b.text}</span></div></div>
			{/each}
		</div>
	{:else if tab === 'Decks'}
		<div class="grid">
			{#each R.allDecks(m) as d}
				<div class="item"><div><b>{d.name}</b><br /><span class="dim">{d.text}</span></div></div>
			{/each}
		</div>
	{:else if tab === 'Cards'}
		<h3>Seals</h3>
		<div class="grid">
			{#each R.allSeals(m) as s}
				<div class="item"><SealBadge seal={s} size={32} /><div><b>{s.name}</b> <span class="rar">${s.cost}</span><br /><span class="dim">{s.text}</span></div></div>
			{/each}
		</div>
		<h3>Card editions</h3>
		<div class="grid">
			{#each Object.values(CARD_EDITIONS) as e}
				<div class="item"><div><b style:color={editionColor(e.key)}>{e.name}</b> <span class="rar">${e.cost}</span><br /><span class="dim">{e.text}</span></div></div>
			{/each}
		</div>
		<h3>Relic editions</h3>
		<div class="grid">
			{#each Object.values(RELIC_EDITIONS) as e}
				<div class="item"><div><b style:color={editionColor(e.key)}>{e.name}</b> <span class="rar">+${e.cost}</span><br /><span class="dim">{e.text}</span></div></div>
			{/each}
		</div>
	{:else}
		<div class="stats">
			<div><span>Runs</span><b>{p.runs}</b></div>
			<div><span>Wins</span><b>{p.wins}</b></div>
			<div><span>Furthest {m.words.table.toLowerCase()}</span><b>{p.bestTable}</b></div>
			<div><span>Best {m.words.hand}</span><b>{p.bestHand.toLocaleString()}</b></div>
			<div><span>{m.words.hands} played</span><b>{p.handsPlayed}</b></div>
			{#each Object.entries(m.counterNames ?? {}) as [k, label]}<div><span>{label}</span><b>{p.counters[k] ?? 0}</b></div>{/each}
		</div>
		<h3>Recent runs</h3>
		{#each p.history.slice(0, 12) as r}
			<div class="run"><span>{fmtDate(r.started)}</span><span>{r.deck}</span><span>{m.words.table} {r.table}, board {r.board}</span><span>best {r.bestHand}</span><span class="res {r.result}">{r.result}</span></div>
		{:else}
			<p class="dim">No runs yet.</p>
		{/each}
	{/if}
</Overlay>

<style>
	.tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 10px;
	}
	.tabs button {
		font: inherit;
		padding: 4px 12px;
		border: none;
		background: var(--panel-edge);
		color: var(--ink);
		cursor: pointer;
	}
	.tabs button.on {
		background: var(--brass);
		color: var(--bg);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.item {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 8px 10px;
		background: var(--panel);
		font-size: 14px;
	}
	.item.unseen {
		opacity: 0.45;
	}
	.rar {
		color: var(--ink-faint);
		font-size: 12px;
	}
	.boss {
		color: var(--bad);
	}
	.dim {
		color: var(--ink-dim);
	}
	h3 {
		margin: 14px 0 6px;
		color: var(--brass);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}
	.stats div {
		display: flex;
		flex-direction: column;
		padding: 8px 10px;
		background: var(--panel);
	}
	.stats span {
		color: var(--ink-dim);
		font-size: 13px;
	}
	.stats b {
		font-size: 26px;
		color: var(--brass);
	}
	.run {
		display: grid;
		grid-template-columns: 1fr 1fr 2fr 1fr 1fr;
		padding: 4px 0;
		border-bottom: 1px solid var(--panel-edge);
		font-size: 14px;
	}
	.res.won {
		color: var(--good);
	}
	.res.lost {
		color: var(--bad);
	}
</style>
