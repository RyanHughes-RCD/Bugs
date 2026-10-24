import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../game/js/core/rng.js';
import { TRAIT_CHECK } from '../game/js/data/balance.js';
import { AREA_BY_ID } from '../game/js/data/areas.js';
import { traitScore, checkChance, partyTraitScores, resolveCheck } from '../game/js/systems/traits.js';
import { planExpedition } from '../game/js/systems/expedition.js';
import { effectiveTraits, rollTraits, traitTotal } from '../game/js/systems/bugs.js';
import { SPECIES_LIST } from '../game/js/data/species.js';
import { RARITIES, RARITY_ORDER } from '../game/js/data/rarities.js';
import { makeGame, addBug } from './helpers.mjs';

test('party trait score uses diminishing weights so one trait cannot dominate', () => {
  assert.equal(traitScore([4]), 4);
  assert.equal(traitScore([2, 4]), 4 + 2 * 0.5);
  assert.equal(traitScore([4, 4, 4, 4]), 4 * (1 + 0.5 + 0.25 + 0.125));
  assert.ok(traitScore([4, 4, 4, 4]) < 4 * 2, 'four copies are worth less than double one');
  assert.equal(traitScore([0, 0]), 0);
});

test('higher trait levels give better odds; no trait is hard but not impossible', () => {
  let prev = 0;
  for (let s = 1; s <= 12; s++) {
    const c = checkChance(s, 5);
    assert.ok(c >= prev);
    prev = c;
  }
  assert.ok(checkChance(9, 5) > checkChance(5, 5));
  assert.equal(checkChance(0, 5), TRAIT_CHECK.noTraitChance);
  assert.ok(TRAIT_CHECK.noTraitChance > 0);
  assert.ok(checkChance(100, 1) <= TRAIT_CHECK.max && checkChance(0.5, 100) >= TRAIT_CHECK.min);
});

test('multi-trait challenges use the party\'s best acceptable trait', () => {
  const { game } = makeGame();
  const party = [addBug(game, 'bee', { fly: 6 }), addBug(game, 'ant', { build: 2 })];
  const chk = resolveCheck(partyTraitScores(party), ['build', 'fly'], 4, new Rng(1));
  assert.equal(chk.trait, 'fly');
  assert.equal(chk.bug, party[0]);
});

test('items add trait levels, even traits the bug lacks, and stop when removed', () => {
  const { game } = makeGame();
  const bug = addBug(game, 'worm', { dig: 3 });
  game.addItem('dew_wings');
  game.equip(bug.uid, 'dew_wings');
  assert.deepEqual(effectiveTraits(bug), { dig: 3, fly: 2 });
  game.unequip(bug.uid);
  assert.deepEqual(effectiveTraits(bug), { dig: 3 });
});

test('rarity sets trait levels: every step up is stronger on average', () => {
  const rng = new Rng(3);
  const avgPower = RARITY_ORDER.map((r) => {
    const pool = SPECIES_LIST.filter((s) => s.rarity === r);
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const traits = rollTraits(rng.pick(pool).id, rng);
      const [lo, hi] = RARITIES[r].traitLevels;
      assert.ok(Object.values(traits).every((l) => l >= lo && l <= hi), r);
      total += traitTotal({ traits, item: null });
    }
    return total / 200;
  });
  for (let i = 1; i < avgPower.length; i++) assert.ok(avgPower[i] > avgPower[i - 1], `${RARITY_ORDER[i]} beats ${RARITY_ORDER[i - 1]}`);
  assert.ok(avgPower.at(-1) >= 30 * avgPower[0], 'a Celestial is worth many Drab bugs');
});

// Measures how often a party succeeds at checks of one trait over many expeditions.
function successRate(game, areaId, party, trait) {
  let ok = 0;
  let n = 0;
  let coins = 0;
  for (let s = 0; s < 400; s++) {
    for (const e of planExpedition(game.state, AREA_BY_ID[areaId], party, s).encounters) {
      if (e.trait !== trait || e.category === 'chest') continue;
      n += 1;
      if (e.outcome === 'success' || e.outcome === 'great') ok += 1;
      coins += e.coins;
    }
  }
  return { rate: ok / n, coinsPerCheck: coins / n };
}

test('trait levels change real expedition outcomes and rewards', () => {
  const { game } = makeGame();
  const filler = () => [addBug(game, 'moth', { fly: 1 }), addBug(game, 'tick', { fight: 1 }), addBug(game, 'aphid', { cut: 1 })];
  const low = successRate(game, 'caves', [addBug(game, 'worm', { dig: 2 }), ...filler()], 'dig');
  const high = successRate(game, 'caves', [addBug(game, 'mole_cricket', { dig: 10 }), ...filler()], 'dig');
  const none = successRate(game, 'caves', [addBug(game, 'bee', { build: 2 }), ...filler()], 'dig');
  assert.ok(high.rate > low.rate + 0.3, `dig 10 (${high.rate}) beats dig 2 (${low.rate})`);
  assert.ok(low.rate > none.rate, 'some dig beats none');
  assert.ok(none.rate > 0, 'no Dig bug can still occasionally succeed');
  assert.ok(high.coinsPerCheck > low.coinsPerCheck * 1.3, 'better outcomes pay more');
});

test('rarity is not everything: a strong common beats a mismatched rare', () => {
  const { game } = makeGame();
  const filler = () => [addBug(game, 'moth', { fly: 1 }), addBug(game, 'tick', { fight: 1 }), addBug(game, 'aphid', { cut: 1 })];
  const common = successRate(game, 'forest', [addBug(game, 'ant', { lift: 7 }), ...filler()], 'lift');
  const rare = successRate(game, 'forest', [addBug(game, 'dragonfly', { fly: 6, fight: 5, lift: 1 }), ...filler()], 'lift');
  assert.ok(common.rate > rare.rate + 0.2);
});
