import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../game/js/core/rng.js';
import { EGG_TIERS } from '../game/js/data/eggs.js';
import { RARITY_ORDER } from '../game/js/data/rarities.js';
import { SPECIES } from '../game/js/data/species.js';
import { BASE_INCUBATION_MS } from '../game/js/data/balance.js';
import { validateEggTiers, eggOdds, rollEgg, simulateHatches, incubatorCount } from '../game/js/systems/eggs.js';
import { makeGame, HOUR } from './helpers.mjs';

const rarePlus = (tier) => eggOdds(tier).filter((o) => RARITY_ORDER.indexOf(o.rarity) >= RARITY_ORDER.indexOf('rare')).reduce((s, o) => s + o.chance, 0);

test('egg probability tables are valid and sum to 100%', () => {
  assert.deepEqual(validateEggTiers(), []);
  const broken = [{ ...EGG_TIERS[0], odds: { ...EGG_TIERS[0].odds, common: 90 } }];
  assert.ok(validateEggTiers(broken).length > 0, 'the validator catches bad tables');
});

test('egg tier shifts the odds but never guarantees the result', () => {
  for (let i = 0; i < EGG_TIERS.length; i++) {
    const t = EGG_TIERS[i];
    assert.ok(t.odds[t.id] < 100, `${t.id} is not guaranteed`);
    const below = RARITY_ORDER.slice(0, RARITY_ORDER.indexOf(t.id)).reduce((s, r) => s + (t.odds[r] || 0), 0);
    if (i > 0) assert.ok(below > 0, `${t.id} can hatch something lower`);
    if (i > 0) assert.ok(rarePlus(t.id) > rarePlus(EGG_TIERS[i - 1].id), `${t.id} beats ${EGG_TIERS[i - 1].id}`);
  }
  assert.ok(eggOdds('common').find((o) => o.rarity === 'mythic').chance > 0, 'a common egg can still surprise');
});

test('rolled hatches match the advertised odds', () => {
  for (const tier of ['common', 'rare', 'mythic']) {
    const N = 20000;
    const counts = simulateHatches(tier, N, 7);
    for (const o of eggOdds(tier)) assert.ok(Math.abs(counts[o.rarity] / N - o.chance) < 0.012, `${tier} ${o.rarity}`);
  }
  const rng = new Rng(3);
  for (let i = 0; i < 200; i++) {
    const r = rollEgg('epic', rng);
    assert.equal(SPECIES[r.speciesId].rarity, r.rarity);
  }
});

test('base incubation is four hours and survives closing the game', () => {
  const { game, clock, storage } = makeGame();
  const egg = game.state.eggs[0];
  assert.ok(game.startIncubation(egg.uid).ok);
  assert.equal(egg.endsAt - egg.startedAt, BASE_INCUBATION_MS);
  assert.equal(BASE_INCUBATION_MS, 4 * HOUR);
  clock.t += 4 * HOUR - 1000;
  const { game: reopened } = makeGame({ storage, clock });
  assert.equal(reopened.hatchEgg(egg.uid).ok, false, 'not yet');
  clock.t += 1000;
  const { game: later } = makeGame({ storage, clock });
  assert.ok(later.eggProgress(later.egg(egg.uid)).ready);
});

test('hatching consumes the egg once and creates a bug with valid traits', () => {
  const { game, clock } = makeGame();
  const egg = game.state.eggs[0];
  game.startIncubation(egg.uid);
  clock.t += 4 * HOUR;
  const res = game.hatchEgg(egg.uid);
  assert.ok(res.ok);
  assert.equal(game.state.bugs.length, 5);
  assert.ok(Object.keys(res.bug.traits).length >= 1);
  assert.equal(res.bug.inGarden, false, 'the player chooses whether to place it');
  assert.equal(game.hatchEgg(egg.uid).ok, false, 'cannot hatch twice');
  assert.ok(game.state.dex[res.bug.species].caught >= 1);
});

test('every hatched bug has 1+ valid traits, more for rarer bugs on average', () => {
  const { game, clock } = makeGame();
  game.state.upgrades.incubator_slots = 3;
  const traitsByRarity = {};
  for (let i = 0; i < 300; i++) {
    const egg = game.addEgg(i % 2 ? 'legendary' : 'common', 'test');
    game.startIncubation(egg.uid);
    clock.t += 4 * HOUR;
    const { bug, rarity } = game.hatchEgg(egg.uid);
    const ts = Object.entries(bug.traits);
    assert.ok(ts.length >= 1);
    for (const [, lvl] of ts) assert.ok(Number.isInteger(lvl) && lvl >= 1 && lvl <= 15);
    (traitsByRarity[rarity] = traitsByRarity[rarity] || []).push(ts.length);
  }
  const avg = (r) => traitsByRarity[r].reduce((a, b) => a + b, 0) / traitsByRarity[r].length;
  assert.ok(avg('legendary') > avg('common'));
});

test('low rarities have one weak trait; stats climb steadily up the rarity ladder', async () => {
  const { rollTraits } = await import('../game/js/systems/bugs.js');
  const { SPECIES_LIST } = await import('../game/js/data/species.js');
  const rng = new Rng(11);
  const stats = {};
  for (const sp of SPECIES_LIST) {
    for (let i = 0; i < 40; i++) {
      const t = Object.values(rollTraits(sp.id, rng));
      const s = (stats[sp.rarity] = stats[sp.rarity] || { count: 0, best: 0, total: 0, n: 0, maxCount: 0 });
      s.count += t.length; s.best += Math.max(...t); s.total += t.reduce((a, b) => a + b, 0); s.n += 1;
      s.maxCount = Math.max(s.maxCount, t.length);
      if (['drab', 'plain', 'common'].includes(sp.rarity)) assert.equal(t.length, 1, `${sp.id} has one trait`);
      if (sp.rarity === 'drab') assert.equal(t[0], 1, 'drab bugs start at level 1');
      if (sp.rarity === 'plain') assert.ok(t[0] <= 2, 'plain bugs start weak');
    }
  }
  for (let i = 1; i < RARITY_ORDER.length; i++) {
    const lo = stats[RARITY_ORDER[i - 1]];
    const hi = stats[RARITY_ORDER[i]];
    assert.ok(hi.best / hi.n > lo.best / lo.n, `${RARITY_ORDER[i]} best trait beats ${RARITY_ORDER[i - 1]}`);
    assert.ok(hi.total / hi.n > lo.total / lo.n, `${RARITY_ORDER[i]} total beats ${RARITY_ORDER[i - 1]}`);
    assert.ok(hi.count / hi.n >= lo.count / lo.n, `${RARITY_ORDER[i]} has at least as many traits`);
  }
});

test('buying eggs validates coins; incubators are limited and upgradable', () => {
  const { game } = makeGame();
  game.state.coins = 50;
  assert.equal(game.buyEgg('common').ok, false);
  assert.equal(game.state.coins, 50);
  game.state.coins = 10000;
  assert.ok(game.buyEgg('common').ok);
  assert.ok(game.buyEgg('uncommon').ok);
  const [a, b, c] = game.state.eggs;
  assert.equal(incubatorCount(game.state), 2);
  assert.ok(game.startIncubation(a.uid).ok);
  assert.ok(game.startIncubation(b.uid).ok);
  assert.equal(game.startIncubation(c.uid).ok, false, 'all incubators busy');
  assert.ok(game.buyUpgrade('incubator_slots').ok);
  assert.ok(game.startIncubation(c.uid).ok);
});

test('Faster Incubation only affects eggs started after the purchase', () => {
  const { game } = makeGame();
  game.state.coins = 10000;
  const first = game.state.eggs[0];
  game.startIncubation(first.uid);
  const before = first.endsAt;
  game.buyUpgrade('faster_incubation');
  assert.equal(first.endsAt, before, 'running egg untouched');
  const { egg } = game.buyEgg('common');
  game.startIncubation(egg.uid);
  assert.equal(egg.endsAt - egg.startedAt, Math.round(4 * HOUR * (1 - 0.07)));
});
