<!-- How to play: this game's rules, then what every game shares. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import Overlay from './Overlay.svelte';

	const ui = arcade.ui!;
	const m = ui.module;
	const shared = [
		{ title: 'The run', text: `${m.tables} ${m.words.table.toLowerCase()}s of ${m.boardsPerTable} boards. Reach each board’s goal within its ${m.handsPerBoard} ${m.words.hands} to win it, get paid and visit the club. The last board of each ${m.words.table.toLowerCase()} has a boss with a rule of its own. You can skip the first boards for a tag.` },
		{ title: 'Score', text: `A ${m.words.hand} scores ${m.words.chips} x mult: the game’s own lines, then upgrade levels, relics (in the order you hold them), enhanced cards you played, the boss, then ploys.` },
		{ title: 'The club', text: 'Relics (five slots) change how you score; upgrades level a kind of hand; ploys are one-shot tricks (hold two); card editions and seals go on a card in your pack for the rest of the run; bundles open to a choice of three. Reroll for new offers; sell relics for half.' },
		{ title: 'Money', text: `$${4} a board, $1 for each ${m.words.hand} left over, interest of $1 per $5 held (up to $5), and $2 for beating a boss.` }
	];
</script>

<Overlay title="How to play {m.title}" close={() => (arcade.overlay = null)}>
	{#each [...ui.help, ...shared] as s}
		<h3>{s.title}</h3>
		<p>{s.text}</p>
	{/each}
</Overlay>

<style>
	h3 {
		margin: 12px 0 2px;
		color: var(--brass);
	}
	p {
		margin: 0;
		color: var(--ink-dim);
		line-height: 1.4;
	}
</style>
