import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../game/js/core/rng.js';
import { hatchOdds, rollHatch } from '../game/js/systems/eggs.js';
import { EGGS } from '../game/js/data/eggs.js';
import { SPECIES } from '../game/js/data/species.js';
import { makeGame } from './helpers.mjs';

const chanceOf = (odds, r) => odds.find((o) => o.rarity === r).chance;

test('hatch odds always sum to 100% and only include hatchable rarities', () => {
  const { game } = makeGame();
  for (const type of Object.keys(EGGS)) {
    const { odds } = hatchOdds(game.state, type);
    const total = odds.reduce((s, o) => s + o.chance, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, type);
    for (const o of odds) if (o.chance > 0) assert.ok(o.species.length > 0, `${type} ${o.rarity}`);
  }
  // The meadow has no epic or legendary bugs, so those odds roll into rare.
  const meadow = hatchOdds(game.state, 'meadow_egg').odds;
  assert.equal(chanceOf(meadow, 'epic'), 0);
  assert.equal(chanceOf(meadow, 'legendary'), 0);
});

test('chrysalis never hatches below rare; Four-Leaf Patch improves odds', () => {
  const { game } = makeGame();
  const ch = hatchOdds(game.state, 'chrysalis').odds;
  assert.equal(chanceOf(ch, 'common') + chanceOf(ch, 'uncommon'), 0);
  const before = chanceOf(hatchOdds(game.state, 'garden_egg').odds, 'rare');
  game.state.upgrades.clover_patch = 5;
  assert.ok(chanceOf(hatchOdds(game.state, 'garden_egg').odds, 'rare') > before);
});

test('rolled hatches match the advertised odds', () => {
  const { game } = makeGame();
  const rng = new Rng(99);
  const counts = {};
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const r = rollHatch(game.state, 'meadow_egg', rng);
    assert.ok(SPECIES[r.speciesId].habitats.includes('meadow'));
    counts[r.rarity] = (counts[r.rarity] || 0) + 1;
  }
  for (const o of hatchOdds(game.state, 'meadow_egg').odds) {
    assert.ok(Math.abs((counts[o.rarity] || 0) / N - o.chance) < 0.025, o.rarity);
  }
});

test('eggs hatch only when their persistent timer finishes', () => {
  const { game, clock } = makeGame();
  const egg = game.state.eggs[0];
  assert.equal(game.hatchEgg(egg.uid).ok, false);
  clock.t += egg.durationMs - 1000;
  assert.equal(game.hatchEgg(egg.uid).ok, false);
  clock.t += 1000;
  const bugs = game.state.bugs.length;
  const res = game.hatchEgg(egg.uid);
  assert.ok(res.ok);
  assert.equal(game.state.bugs.length, bugs + 1);
  assert.equal(game.state.eggs.length, 0);
  assert.ok(game.state.dex[res.bug.species].caught >= 1);
  assert.equal(game.state.stats.hatched, 1);
});

test('first discovery of a species pays a Bugdex reward', () => {
  const { game, clock } = makeGame();
  game.state.coins = 0;
  clock.t += 10 * 60e3;
  const res = game.hatchEgg(game.state.eggs[0].uid);
  if (res.newSpecies) assert.equal(game.state.coins, res.reward);
  else assert.equal(game.state.coins, 0);
});

test('nursery capacity is limited and upgradable', () => {
  const { game } = makeGame();
  const e1 = game.makeEgg('garden_egg');
  assert.equal(game.startEgg(e1.uid).ok, false, 'one plot, already used by the starter egg');
  game.state.coins = 1000;
  assert.ok(game.buyUpgrade('nursery').ok);
  assert.ok(game.startEgg(e1.uid).ok);
});

test('Warm Soil shortens incubation and Warm Moss halves the remaining time', () => {
  const { game, clock } = makeGame();
  game.state.upgrades.warm_soil = 2;
  game.state.upgrades.nursery = 1;
  const egg = game.makeEgg('pond_egg');
  game.startEgg(egg.uid);
  assert.equal(egg.durationMs, Math.round(EGGS.pond_egg.hatchMs * 0.8));
  game.addItem('warm_moss');
  const remaining = game.eggProgress(egg).remainingMs;
  assert.ok(game.useItem('warm_moss', egg.uid).ok);
  assert.ok(Math.abs(game.eggProgress(egg).remainingMs - remaining / 2) <= 1);
  clock.t += remaining / 2 + 1;
  assert.ok(game.eggProgress(egg).ready);
});
