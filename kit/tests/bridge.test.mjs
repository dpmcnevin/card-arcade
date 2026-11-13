// The iPad bridge, bundled as the app gets it and run in a bare context (no
// Node globals), plays whole runs of every game through its JSON API: the
// snapshot builds at every step, prompts' actions are taken as they come,
// and the save it writes replays to the same place.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';

const out = join(mkdtempSync(join(tmpdir(), 'bridge-')), 'game-bundle.js');
execFileSync('npx', ['esbuild', 'bridge/entry.ts', '--bundle', '--format=iife', '--target=es2022', `--outfile=${out}`, '--log-level=error'], { cwd: new URL('..', import.meta.url).pathname });
const code = readFileSync(out, 'utf8');

function context() {
	const ctx = vm.createContext({});
	vm.runInContext(code, ctx);
	return ctx.CardArcade;
}

const api = context();
const games = JSON.parse(api.games());

test('the bridge lists every game with its decks', () => {
	assert.deepEqual(games.map((g) => g.id), ['hearts', 'bridge', 'euchre', 'tarot', 'whist22']);
	for (const g of games) assert.ok(g.decks.some((d) => d.key === 'basic'));
});

for (const g of games) {
	test(`${g.id}: a run plays through the bridge, and its save replays`, () => {
		let v = JSON.parse(api.newRun(g.id, 'standard'));
		let n = 0;
		for (let step = 0; step < 4000; step++) {
			if (v.phase === 'over' || v.phase === 'victory') break;
			if (v.phase === 'pre' || v.phase === 'play') {
				if (v.aiToMove) {
					v = JSON.parse(api.stepAI()).view;
					continue;
				}
				assert.ok(v.tableView && v.tableView.seats.length === 4);
				let a = JSON.parse(api.bot(`b${n++}`));
				if (v.phase === 'pre') {
					assert.ok(v.prompt, 'a prompt before play');
					if (v.prompt.pick) {
						assert.equal(api.checkPick(JSON.stringify(a.cards)), '');
						a = JSON.parse(v.prompt.pick.action.replace('"$picked"', JSON.stringify(a.cards)));
					} else {
						const c = v.prompt.choices.find((c) => c.enabled && c.action === JSON.stringify(a));
						assert.ok(c, `the bot's move ${JSON.stringify(a)} is a choice`);
						a = JSON.parse(c.action);
					}
				} else if (a.t === 'play') {
					const c = v.tableView.seats.flatMap((s) => s.cards).find((c) => c.code === a.card);
					assert.ok(c && v.tableView.legal.includes(c.key), 'the bot plays a legal card');
					if (v.cardChoices[a.card]) assert.ok(v.cardChoices[a.card].some((x) => x.action === JSON.stringify(a)), 'a card with a question: the bot picks an answer');
				}
				const r = JSON.parse(api.act(JSON.stringify({ t: 'game', a })));
				assert.ok(r.ok, r.error);
				v = r.view;
			} else if (v.phase === 'scored') {
				assert.ok(v.result);
				v = JSON.parse(api.act('{"t":"next"}')).view;
			} else if (v.phase === 'won') v = JSON.parse(api.act('{"t":"shop"}')).view;
			else if (v.phase === 'shop') {
				assert.ok(Array.isArray(v.shop));
				const i = v.shop.findIndex((it) => it.canBuy && !it.needsCard);
				if (i >= 0 && v.shop[i].kind !== 'bundle') v = JSON.parse(api.act(JSON.stringify({ t: 'buy', slot: i }))).view;
				v = JSON.parse(api.act('{"t":"leave"}')).view;
			}
		}
		assert.ok(n > 10, 'the run went somewhere');
		const save = api.save();
		const other = context();
		const w = JSON.parse(other.restore(save));
		assert.equal(w.phase, v.phase);
		assert.equal(w.score, v.score);
		assert.equal(w.money, v.money);
		assert.equal(w.table, v.table);
		const img = JSON.parse(api.cardImage(1, 12, false, false));
		assert.equal(img.rgba.length, Math.ceil((img.w * img.h * 4) / 3) * 4);
		JSON.parse(api.catalog(g.id));
		JSON.parse(api.noteProfile('', 'x'));
	});
}
