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
	import { TAGS, CARD_EDITIONS, modKey } from '$kit/src/run/content.ts';
	import * as cards from '$kit/src/core/rules/cards.ts';
	import SealBadge from './SealBadge.svelte';
	import { editionColor } from './editions.ts';
	import Button from './Button.svelte';
	import * as sound from '../audio/sound.ts';
	import SpeedSlider from './SpeedSlider.svelte';
	import { settings } from '../settings.svelte.ts';

	const run = $derived((void arcade.v, arcade.run!));
	const info = $derived((void arcade.v, arcade.ui!.handInfo?.(arcade.run!) ?? null));
	const m = $derived(run.module);
	const levels = $derived(m.upgrades);
	/** Any board's name (the last one may be called something else). */
	const nameOf = (b: number) => R.boardName({ ...run, board: b } as R.Run);
	const bossNow = $derived(R.bossActive(run));
	/** Cards the run has enhanced (editions, seals), for the list. */
	const enhanced = $derived(
		Object.entries(run.mods)
			.filter(([, md]) => md.edition || md.seal)
			.map(([k, md]) => ({ card: run.pack.find((c) => modKey(c) === k), md }))
			.filter((x) => x.card)
	);
	const freeRelics = $derived(Math.max(0, R.relicSlots(run) - R.relicSlotsUsed(run)));
</script>

<!-- The run is mutated in place: redraw when it changes. -->
{#key arcade.v}
<aside>
	<div class="row top"><span class="title">{m.title.toUpperCase()}</span><span class="money"><Count value={run.money} prefix="$" /><small class="int" title="Interest paid when you win this board">+${R.interest(run)}</small></span></div>
	<div class="row"><span>{m.words.table} {run.table} of {m.tables}</span><span class="tables">{#each Array(m.tables) as _, i}<span class:done={i + 1 < run.table} class:now={i + 1 === run.table}></span>{/each}</span></div>
	<!-- The board, the goal and the boss open the table overview. -->
	<button class="chips open" title="The table: every board's goal, pay and boss" onclick={() => (arcade.overlay = 'table')}>
		{#each Array(m.boardsPerTable) as _, i}
			{@const b = i + 1}
			{@const done = b < run.board || (b === run.board && run.score >= run.target)}
			<span class="chip" class:done class:now={b === run.board && !done}>{nameOf(b)}</span>
		{/each}
	</button>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="goal open" onclick={() => (arcade.overlay = 'table')}>
		<div class="row dim"><span>{R.boardName(run)} goal</span><span>Scored</span></div>
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
			<span class="bl">{bossNow ? 'Boss now' : `${nameOf(m.boardsPerTable)} boss`}</span>
			<span class="bn">{run.boss.name}</span>
			{#if bossNow}<span class="bt">{run.boss.text}</span>{/if}
		</div>
	{/if}
	{#if R.skipTag(run)}
		{@const tag = TAGS[R.skipTag(run)!]}
		<Button variant="ploy" size="sm" title={tag.text} onclick={() => arcade.do({ t: 'skip' })} style="width: 100%">Skip board for {tag.name}</Button>
	{/if}

	<div class="mid">
	<div class="sub">Levels</div>
	<div class="levels">
		{#each levels as u}
			{@const lv = run.levels[u.key] ?? 1}
			<span class="lv" class:up={lv > 1} title="{u.name}, level {lv}: {u.text}">{#if u.glyph}<span class="glyph">{u.glyph}</span>{:else}<Icon name={u.icon} scale={1} />{/if}<span class="ln">{u.name.replace(/^The /, '')}</span><b>{lv}</b></span>
		{/each}
	</div>
	{#if enhanced.length}
		<div class="sub">Enhanced cards</div>
		<div class="enh">
			{#each enhanced as e}
				{@const ed = e.md.edition ? CARD_EDITIONS[e.md.edition as keyof typeof CARD_EDITIONS] : undefined}
				{@const seal = R.sealOf(run, e.card!)}
				<span class="ec" title={[ed && `${ed.name}: ${ed.text}`, seal && `${seal.name}: ${seal.text}`].filter(Boolean).join(' · ')}>
					{#if ed}<i class="edot" style:background={editionColor(ed.key)}></i>{/if}{#if seal}<SealBadge {seal} size={14} />{/if}<span class:red={cards.SUITS[e.card!.suit].red}>{cards.name(e.card!)}</span>
				</span>
			{/each}
		</div>
	{/if}

	<div class="sub">Ploys {run.ploys.length}/{R.PLOY_SLOTS}</div>
	<div class="ploys">
		{#each run.ploys as key, i}
			{@const def = R.ployDef(run, key)!}
			{@const ok = R.canUsePloy(run, i)}
			<Button variant="ploy" size="sm" title={def.text} onclick={() => (ploy = ploy === i ? null : i)} style="width: 100%; {ok[0] ? '' : 'opacity: 0.6'}">{def.name}</Button>
		{/each}
		{#each Array(Math.max(0, R.PLOY_SLOTS - run.ploys.length)) as _}<div class="empty ps" title="An empty ploy slot: buy ploys in the club"></div>{/each}
	</div>

	<div class="sub">Relics {R.relicSlotsUsed(run)}/{R.relicSlots(run)}</div>
	<div class="relics">
		{#each run.relics as r}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div onclick={() => (reading = reading === r.key ? null : r.key)} class:sel={reading === r.key} class="relic" class:jinxed={R.bossActive(run) && run.jinxed === r.key} title="{r.name}: {r.def.describe?.(r) ?? r.def.text}{R.bossActive(run) && run.jinxed === r.key ? ' (jinxed this board)' : ''}"><Shine edition={r.edition}><Icon name={r.def.icon} scale={2} /></Shine></div>
		{/each}
		{#each Array(freeRelics) as _}<div class="empty rs" title="An empty relic slot"></div>{/each}
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
		padding: 12px 16px;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
		display: flex;
		flex-direction: column;
		gap: 7px;
		/* Above the club (110), so a ploy or relic popup isn't hidden behind
		   it; below full-screen overlays (150). */
		z-index: 120;
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
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 8px;
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
		flex-basis: 100%;
		color: var(--ink-dim);
	}
	.sub {
		margin-top: 2px;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink-dim);
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.sub::after {
		content: '';
		flex: 1;
		height: 2px;
		background: var(--panel-edge);
	}
	.int {
		margin-left: 6px;
		font-size: 13px;
		font-weight: 400;
		color: var(--ink-dim);
	}
	.chips {
		display: flex;
		gap: 4px;
		font: inherit;
		background: none;
		border: none;
		padding: 0;
		color: inherit;
	}
	.chip {
		flex: 1;
		padding: 3px 0;
		text-align: center;
		font-size: 12px;
		white-space: nowrap;
		background: var(--panel);
		color: var(--ink-faint);
	}
	.chip.done {
		color: var(--good);
	}
	.chip.done::before {
		content: '✓ ';
	}
	.chip.now {
		background: var(--brass);
		color: var(--bg);
		font-weight: 700;
	}
	.chips:hover .chip {
		filter: brightness(1.15);
	}
	.levels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
	}
	.lv b {
		color: var(--ink-faint);
	}
	.lv.up b,
	.lv.up .ln {
		color: var(--brass);
	}
	.enh {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.ec {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 6px;
		background: var(--panel);
		font-size: 13px;
	}
	.ec .red {
		color: var(--bad);
	}
	.edot {
		width: 8px;
		height: 8px;
	}
	.empty {
		box-sizing: border-box;
		border: 2px dashed var(--panel-edge);
	}
	.empty.ps {
		height: 26px;
	}
	.empty.rs {
		width: 34px;
		height: 34px;
	}
	.lv {
		display: flex;
		gap: 6px;
		align-items: center;
		padding: 2px 6px;
		background: var(--panel);
		font-size: 13px;
		min-width: 0;
	}
	.ln {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
