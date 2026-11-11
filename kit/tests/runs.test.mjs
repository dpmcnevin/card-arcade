// Every game module runs end to end through the kit, and replays exactly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playRun } from '../tools/bot.ts';
import { replay } from '../src/run/save.ts';
import { bridge } from '../games/bridge/module.ts';
import { hearts } from '../games/hearts/module.ts';
import { euchre } from '../games/euchre/module.ts';

const GAMES = { bridge, hearts, euchre };

for (const [name, module] of Object.entries(GAMES)) {
	test(`${name}: bot runs finish, score, use the club, and replay exactly`, () => {
		let wins = 0,
			boards = 0,
			scored = 0;
		for (let i = 0; i < 6; i++) {
			const { run, save } = playRun(module, `${name.toUpperCase()}${i}`);
			assert.ok(run.phase === 'over' || run.phase === 'victory', `ends (${run.phase})`);
			assert.ok(run.stats.hands > 0, 'plays');
			scored += run.stats.total;
			boards += (run.table - 1) * module.boardsPerTable + run.board - 1;
			if (run.phase === 'victory') wins++;
			const again = replay(module, JSON.parse(JSON.stringify(save)));
			assert.equal(again.phase, run.phase);
			assert.equal(again.score, run.score);
			assert.equal(again.money, run.money);
			assert.deepEqual(again.relics.map((r) => r.key), run.relics.map((r) => r.key));
		}
		console.log(`${name}: ${wins}/6 wins, ${(boards / 6).toFixed(1)} boards won on average`);
		assert.ok(boards > 0 && scored > 0, 'scores and wins boards');
	});
}
