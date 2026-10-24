import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planExpedition } from '../game/js/systems/expedition.js';
import { addBug } from '../game/js/systems/bugs.js';
import { AREAS, AREA_BY_ID, GUARDIAN_RUNS } from '../game/js/data/areas.js';
import { Rng } from '../game/js/core/rng.js';
import { makeGame, finishExpedition } from './helpers.mjs';

const uids = (game) => game.state.bugs.map((b) => b.uid);

test('launch validation: team size, locked areas, supplies', () => {
  const { game } = makeGame();
  assert.equal(game.launchExpedition('meadow', []).ok, false);
  assert.equal(game.launchExpedition('pond', uids(game)).ok, false, 'pond is locked');
  addBug(game.state, 'bee', {}, new Rng(1));
  assert.equal(game.launchExpedition('meadow', uids(game)).ok, false, 'five bugs is too many');
  assert.equal(game.launchExpedition('meadow', uids(game).slice(0, 4), ['bug_net', 'trail_mix']).ok, false, 'one supply slot');
  assert.equal(game.launchExpedition('meadow', uids(game).slice(0, 4), ['honey_drop']).ok, false, 'not a supply');
  const nets = game.state.inventory.bug_net;
  const res = game.launchExpedition('meadow', uids(game).slice(0, 4), ['bug_net']);
  assert.ok(res.ok);
  assert.equal(game.state.inventory.bug_net, nets - 1, 'supply consumed');
  assert.equal(game.launchExpedition('meadow', [uids(game)[4]]).ok, false, 'area already has a team / slots full');
});

test('bugs away or resting cannot join another expedition', () => {
  const { game, clock } = makeGame();
  game.state.upgrades.camp = 1;
  game.state.areas.pond.unlocked = true;
  const [a, b] = uids(game);
  assert.ok(game.launchExpedition('meadow', [a]).ok);
  assert.equal(game.launchExpedition('pond', [a]).ok, false, 'already exploring');
  game.bug(b).restUntil = clock.t + 60e3;
  assert.equal(game.launchExpedition('pond', [b]).ok, false, 'resting');
  game.addItem('honey_drop');
  assert.ok(game.useItem('honey_drop', b).ok);
  assert.ok(game.launchExpedition('pond', [b]).ok, 'honey drop woke it up');
});

test('expeditions run on a timer and rewards apply only on collection', () => {
  const { game, clock } = makeGame();
  const coins = game.state.coins;
  const { expedition: exp } = game.launchExpedition('meadow', uids(game));
  assert.equal(game.collectExpedition(exp.id).ok, false, 'too early');
  assert.equal(game.state.coins, coins);
  const res = finishExpedition(game, clock, exp);
  assert.ok(res.ok);
  const r = exp.result;
  assert.equal(game.state.coins, coins + r.coins);
  assert.equal(game.state.expeditions.length, 0);
  assert.equal(game.state.stats.expeditions, 1);
  assert.equal(game.state.stats.captured, r.captures.length);
  for (const [id, n] of Object.entries(r.items)) assert.ok(game.state.inventory[id] >= n);
  assert.equal(game.state.areas.meadow.runs, r.retreated ? 0 : 1);
  const totalXp = game.state.bugs.slice(0, 4).reduce((s, b) => s + b.xp + (b.level - 1) * 100, 0);
  assert.ok(totalXp > 0, 'team gained xp');
});

test('the encounter plan is reproducible from its seed and varied across seeds', () => {
  const { game } = makeGame();
  const team = game.state.bugs;
  const a = planExpedition(game.state, AREAS[0], team, [], 777);
  const b = planExpedition(game.state, AREAS[0], team, [], 777);
  assert.deepEqual(a, b);
  const kinds = new Set();
  for (let s = 0; s < 60; s++) for (const e of planExpedition(game.state, AREAS[0], team, [], s).events) kinds.add(e.kind);
  for (const k of ['battle', 'treasure', 'hazard', 'nest', 'rest', 'wanderer', 'home']) assert.ok(kinds.has(k), k);
});

test('events are revealed progressively as time passes', () => {
  const { game, clock } = makeGame();
  const { expedition: exp } = game.launchExpedition('meadow', uids(game));
  const shown = () => exp.events.filter((e) => e.at <= game.expeditionProgress(exp).fraction).length;
  assert.equal(shown(), 0);
  clock.t += exp.durationMs / 2;
  const mid = shown();
  assert.ok(mid > 0 && mid < exp.events.length);
  clock.t += exp.durationMs;
  assert.equal(shown(), exp.events.length);
});

test('sugar cube halves the remaining expedition time', () => {
  const { game } = makeGame();
  const { expedition: exp } = game.launchExpedition('meadow', uids(game));
  game.addItem('sugar_cube');
  const before = game.expeditionProgress(exp).remainingMs;
  assert.ok(game.useItem('sugar_cube', exp.id).ok);
  assert.ok(Math.abs(game.expeditionProgress(exp).remainingMs - before / 2) <= 1);
});

test('bugs rest after an expedition depending on damage taken', () => {
  const { game, clock } = makeGame({ seed: 5 });
  const { expedition: exp } = game.launchExpedition('meadow', uids(game));
  finishExpedition(game, clock, exp);
  for (const uid of exp.team) {
    const hurt = exp.result.hp[uid] < exp.result.maxHp[uid];
    const resting = game.statusOf(game.bug(uid)) === 'resting';
    assert.equal(resting, hurt, `uid ${uid}`);
  }
});

test('trail maps and scout traits shorten expeditions', () => {
  const { game } = makeGame();
  game.state.upgrades.trail_maps = 5;
  for (const b of game.state.bugs) b.traits = ['scout'];
  const { expedition: exp } = game.launchExpedition('meadow', uids(game));
  // 60s * (1 - 0.4) * (1 - 0.3 cap); shorter still if the team retreated.
  assert.ok(exp.durationMs <= Math.round(60e3 * 0.6 * 0.7));
});

test(`guardian appears after ${GUARDIAN_RUNS} runs; defeating it allows unlocking the next area`, () => {
  const { game, clock } = makeGame({ seed: 77 });
  const st = game.state;
  for (const b of st.bugs) b.level = 12; // strong enough to win reliably
  st.areas.meadow.runs = GUARDIAN_RUNS;
  assert.equal(game.canUnlock('pond').ok, false);
  const { expedition: exp } = game.launchExpedition('meadow', uids(game));
  assert.equal(exp.events.at(-2).kind, 'guardian');
  const res = finishExpedition(game, clock, exp);
  assert.ok(res.report.guardian.won);
  assert.ok(st.areas.meadow.guardianDefeated);
  st.coins = 0;
  assert.equal(game.unlockArea('pond').ok, false, 'needs coins');
  st.coins = AREA_BY_ID.pond.unlockCost;
  assert.ok(game.unlockArea('pond').ok);
  assert.ok(st.areas.pond.unlocked);
  assert.equal(st.coins, 0);
  assert.equal(game.unlockArea('woods').ok, false, 'woods needs the pond guardian');
});

test('a full wipe retreats early and keeps loot found so far', () => {
  const { game, clock } = makeGame({ seed: 3 });
  game.state.areas.jungle.unlocked = true;
  const { expedition: exp } = game.launchExpedition('jungle', [game.state.bugs[0].uid]);
  assert.ok(exp.result.retreated, 'a level 1 bug alone cannot survive the jungle');
  assert.equal(exp.events.at(-1).kind, 'retreat');
  assert.ok(exp.durationMs < AREA_BY_ID.jungle.durationMs);
  const res = finishExpedition(game, clock, exp);
  assert.ok(res.ok);
  assert.equal(game.state.areas.jungle.runs, 0, 'retreats do not count toward the guardian');
  assert.ok(game.bug(exp.team[0]).restUntil > clock.t, 'fainted bug must rest');
});
