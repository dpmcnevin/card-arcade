<!-- The run at a glance, for any game: progress, the goal, money, relics,
     ploys and upgrade levels. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Icon from './Icon.svelte';
	import Shine from './Shine.svelte';
	import Count from './Count.svelte';
	import RelicInfo from './RelicInfo.svelte';
	let reading = $state<string | null>(null);
	/** A held ploy whose details are open (tap to read, then Use). */
	let ploy = $state<number | null>(null);
	import { TAGS } from '$kit/src/run/content.ts';
	import Button from './Button.svelte';
	import * as sound from '../audio/sound.ts';
	import SpeedSlider from './SpeedSlider.svelte';
	import { settings } from '../settings.svelte.ts';

	const run = $derived((void arcade.v, arcade.run!));
	const info = $derived((void arcade.v, arcade.ui!.handInfo?.(arcade.run!) ?? null));
	const m = $derived(run.module);
	const levels = $derived(m.upgrades);
</script>

<!-- The run is mutated in place: redraw when it changes. -->
{#key arcade.v}
<aside>
	<div class="row top"><span class="title">{m.title.toUpperCase()}</span><span class="money"><Count value={run.money} prefix="$" /></span></div>
	<div class="row"><span>{m.words.table} {run.table} of {m.tables}</span><span class="tables">{#each Array(m.tables) as _, i}<span class:done={i + 1 < run.table} class:now={i + 1 === run.table}></span>{/each}</span></div>
	<!-- The board, the goal and the boss open the table overview. -->
	<button class="row dim open" onclick={() => (arcade.overlay = 'table')}><span>{R.boardName(run)}</span><span>{run.board} of {m.boardsPerTable} · details</span></button>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="goal open" onclick={() => (arcade.overlay = 'table')}>
		<div class="row dim"><span>Goal</span><span>Scored</span></div>
		<div class="row big"><span>{run.target.toLocaleString()}</span><span class:good={run.score >= run.target}><Count value={run.score} /></span></div>
		<div class="bar"><div style:width="{Math.min(100, (100 * run.score) / Math.max(1, run.target))}%"></div></div>
		<div class="row dim hands">
			<span>{m.words.hands} left</span>
			<span class="dots">{#each Array(Math.max(run.handsThisBoard, run.handsLeft)) as _, i}<span class:on={i < run.handsLeft}></span>{/each}</span>
			<span>{run.handsLeft} of {run.handsThisBoard}</span>
		</div>
	</div>
	{#if info && (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY || run.phase === R.PHASE.SCORED)}
		<div class="info">
			<div class="it">{info.title}</div>
			<div class="ir">
				{#each info.rows as r}<div class:hot={r.hot}><span>{r.label}</span><b>{r.value}</b></div>{/each}
			</div>
		</div>
	{/if}
	{#if run.boss}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="boss open" class:on={R.bossActive(run)} title={run.boss.text} onclick={() => (arcade.overlay = 'table')}>
			<span class="bl">{R.bossActive(run) ? 'Boss now' : `${m.boardName?.({ ...run, board: m.boardsPerTable }) ?? 'Last board'} boss`}</span>
			<span class="bn">{run.boss.name}</span>
			<span class="bt">{run.boss.text}</span>
		</div>
	{/if}
	{#if R.skipTag(run)}
		{@const tag = TAGS[R.skipTag(run)!]}
		<Button variant="ploy" size="sm" title={tag.text} onclick={() => arcade.do({ t: 'skip' })} style="width: 100%">Skip board for {tag.name}</Button>
	{/if}

	<div class="mid">
	<div class="sub">Levels</div>
	{#each levels as u}
		<div class="lv">{#if u.glyph}<span class="glyph">{u.glyph}</span>{:else}<Icon name={u.icon} scale={1} />{/if}<span>{u.name}</span><span class="dim">Lv.{run.levels[u.key] ?? 1}</span></div>
	{/each}

	<div class="sub">Ploys {run.ploys.length}/{R.PLOY_SLOTS}</div>
	<div class="ploys">
		{#each run.ploys as key, i}
			{@const def = R.ployDef(run, key)!}
			{@const ok = R.canUsePloy(run, i)}
			<Button variant="ploy" size="sm" title={def.text} onclick={() => (ploy = ploy === i ? null : i)} style="width: 100%; {ok[0] ? '' : 'opacity: 0.6'}">{def.name}</Button>
		{/each}
	</div>

	<div class="sub">Relics {R.relicSlotsUsed(run)}/{R.relicSlots(run)}</div>
	<div class="relics">
		{#each run.relics as r}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div onclick={() => (reading = reading === r.key ? null : r.key)} class:sel={reading === r.key} class="relic" class:jinxed={R.bossActive(run) && run.jinxed === r.key} title="{r.name}: {r.def.describe?.(r) ?? r.def.text}{R.bossActive(run) && run.jinxed === r.key ? ' (jinxed this board)' : ''}"><Shine edition={r.edition}><Icon name={r.def.icon} scale={2} /></Shine></div>
		{/each}
	</div>

	</div>
	<SpeedSlider />
	{#if ploy !== null && run.ploys[ploy]}
		{@const def = R.ployDef(run, run.ploys[ploy])!}
		{@const ok = R.canUsePloy(run, ploy)}
		<div class="pop ploypop">
			<div class="pk">Ploy · one use</div>
			<h3>{def.name}</h3>
			<p>{def.text}.</p>
			<div class="pb">
				<Button variant="ploy" size="sm" enabled={ok[0]} onclick={() => { const s = ploy!; ploy = null; arcade.do({ t: 'ploy', slot: s }); }} style="width: 100%">{ok[0] ? 'Use it' : ok[1]}</Button>
				<Button variant="plain" size="sm" onclick={() => (ploy = null)} style="width: 100%">Keep</Button>
			</div>
		</div>
	{/if}
	{#if reading && run.relics.find((r) => r.key === reading)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="pop" onclick={() => (reading = null)}><RelicInfo relic={run.relics.find((r) => r.key === reading)!} note={R.bossActive(run) && run.jinxed === reading ? 'Jinxed this board' : undefined} /></div>
	{/if}
	<div class="toggles">
		<Button variant="plain" size="sm" title="Sound effects" onclick={() => sound.toggleSfx()} style="width: 100%; {settings.sfx ? '' : 'opacity: 0.55'}">Sound</Button>
		<Button variant="plain" size="sm" title="Music (M)" onclick={() => sound.toggleMusic()} style="width: 100%; {settings.music ? '' : 'opacity: 0.55'}">Music</Button>
		<Button variant="plain" size="sm" onclick={() => (arcade.overlay = 'help')} style="width: 100%">Help</Button>
		<Button variant="plain" size="sm" onclick={() => arcade.toMenu()} style="width: 100%">Menu</Button>
	</div>
	<div class="foot dim">Seed {run.seed} · <button class="link" onclick={() => arcade.downloadLog()}>log</button></div>
</aside>
{/key}

<style>
	aside {
		position: absolute;
		left: 0;
		top: 0;
		width: var(--sw);
		height: var(--sh);
		box-sizing: border-box;
		padding: 14px 16px;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 100;
	}
	/* Portrait: the sidebar runs along the top, in columns. */
	:global(.stage.portrait) aside {
		flex-wrap: wrap;
		align-content: flex-start;
		column-gap: 18px;
		border-right: none;
		border-bottom: 3px solid var(--brass-dim);
	}
	:global(.stage.portrait) aside > :global(*) {
		width: 236px;
		box-sizing: border-box;
	}
	:global(.stage.portrait) .foot {
		flex-wrap: wrap;
	}
	:global(.stage.portrait) .mid {
		display: contents;
	}
	.top {
		align-items: baseline;
	}
	.mid {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		scrollbar-width: thin;
		scrollbar-color: var(--brass-dim) transparent;
	}
	.title {
		color: var(--brass);
		font-size: 22px;
		font-weight: 700;
	}
	.row {
		display: flex;
		justify-content: space-between;
	}
	.dim {
		color: var(--ink-dim);
	}
	.open {
		cursor: pointer;
	}
	button.open {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
	}
	button.open:hover span:last-child,
	.goal.open:hover,
	.boss.open:hover {
		filter: brightness(1.2);
	}
	.goal {
		padding: 8px 10px;
		border: 2px solid var(--brass-dim);
		background: var(--panel);
	}
	.big {
		font-size: 30px;
		font-weight: 700;
	}
	.good {
		color: var(--good);
	}
	.bar {
		height: 6px;
		background: var(--bg);
		margin: 4px 0;
	}
	.bar div {
		height: 100%;
		background: var(--good);
	}
	.hands {
		align-items: center;
		gap: 8px;
	}
	.dots {
		flex: 1;
		display: flex;
		gap: 4px;
	}
	.dots span {
		width: 12px;
		height: 12px;
		background: var(--bg);
	}
	.dots span.on {
		background: var(--brass);
	}
	.tables {
		display: flex;
		gap: 3px;
		align-items: center;
	}
	.tables span {
		width: 9px;
		height: 9px;
		background: var(--panel-edge);
	}
	.tables span.done {
		background: var(--brass-dim);
	}
	.tables span.now {
		background: var(--ink);
	}
	.money {
		color: var(--brass);
		font-size: 26px;
		font-weight: 700;
	}
	.info {
		font-size: 13px;
	}
	.it {
		color: var(--ink-dim);
		margin-bottom: 4px;
	}
	.ir {
		display: flex;
		gap: 4px;
	}
	.ir div {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3px 0;
		background: var(--panel);
		border: 1px solid var(--panel-edge);
	}
	.ir span {
		color: var(--ink-dim);
		font-size: 11px;
	}
	.ir b {
		font-size: 17px;
	}
	.ir .hot b {
		color: var(--bad);
	}
	.boss {
		display: flex;
		flex-direction: column;
		padding: 6px 8px;
		border: 2px solid var(--panel-edge);
		background: var(--panel);
		font-size: 13px;
	}
	.boss.on {
		border-color: var(--bad);
	}
	.bl {
		color: var(--ink-dim);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
	}
	.bn {
		color: var(--bad);
		font-size: 16px;
	}
	.bt {
		color: var(--ink-dim);
	}
	.sub {
		margin-top: 2px;
		color: var(--ink-dim);
		font-size: 14px;
	}
	.lv {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 14px;
	}
	.lv span:nth-child(2) {
		flex: 1;
	}
	.glyph {
		width: 18px;
		text-align: center;
		color: var(--brass);
	}
	.ploys {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.relics {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.relic {
		padding: 3px;
		background: var(--panel);
	}
	.relic {
		cursor: pointer;
	}
	.relic.sel {
		outline: 2px solid var(--brass);
	}
	.pop {
		position: absolute;
		left: calc(100% + 8px);
		top: 300px;
		z-index: 160;
		cursor: pointer;
	}
	.ploypop {
		width: 250px;
		padding: 10px 14px 12px;
		background: var(--panel);
		border: 2px solid var(--ploy);
		box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45);
		cursor: default;
	}
	.pk {
		font-size: 12px;
		color: var(--ploy-light);
	}
	.ploypop h3 {
		margin: 2px 0 4px;
		font-size: 18px;
	}
	.ploypop p {
		margin: 0 0 10px;
		font-size: 14px;
		color: var(--ink-dim);
	}
	.pb {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	:global(.stage.portrait) .pop {
		left: 16px;
		top: calc(100% + 8px);
	}
	.relic.jinxed {
		opacity: 0.3;
		outline: 2px solid var(--bad);
	}
	.link {
		font: inherit;
		background: none;
		border: none;
		padding: 0;
		color: var(--ink-dim);
		text-decoration: underline;
		cursor: pointer;
	}
	.toggles {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.foot {
		font-size: 12px;
	}
</style>
