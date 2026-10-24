import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../game/js/core/rng.js';
import { SPECIES_LIST, SPECIES } from '../game/js/data/species.js';
import { RARITY_ORDER, RARITIES, VARIANTS } from '../game/js/data/rarities.js';
import { SPRITES } from '../game/js/data/sprites.js';
import { EGG_TIERS } from '../game/js/data/eggs.js';
import { ROCK } from '../game/js/data/balance.js';
import { rollVariant, releaseValue, createBug } from '../game/js/systems/bugs.js';
import { eggOdds } from '../game/js/systems/eggs.js';
import { dirtPatches, patchStrength } from '../game/js/systems/garden.js';
import { makeGame, MIN, HOUR } from './helpers.mjs';

test('110 species across nine rarities, from Drab to Celestial', () => {
  assert.equal(SPECIES_LIST.length, 110);
  assert.equal(new Set(SPECIES_LIST.map((s) => s.id)).size, 110);
  assert.deepEqual(RARITY_ORDER, ['drab', 'plain', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial']);
  for (const r of RARITY_ORDER) assert.ok(SPECIES_LIST.some((s) => s.rarity === r), r);
  // Rarer tiers are scarcer.
  const count = (r) => SPECIES_LIST.filter((s) => s.rarity === r).length;
  assert.ok(count('celestial') < count('mythic') && count('mythic') < count('legendary') && count('legendary') < count('rare'));
});

test('recoloured relatives only remap real palette colours of their base sprite', () => {
  for (const s of SPECIES_LIST.filter((x) => x.recolor)) {
    assert.ok(SPECIES[s.base] && !SPECIES[s.base].recolor, `${s.id} has a drawn base`);
    for (const [from, to] of Object.entries(s.recolor)) {
      assert.ok(/^[KkslWRrYGgTbcCPNnp]$/.test(from) && /^[KkslWRrYGgTbcCPNnp]$/.test(to), `${s.id}: ${from}->${to}`);
      assert.notEqual(from, 'K', `${s.id} keeps the black outline`);
    }
  }
});

test('the Flea is exactly one black pixel; the Arcane Mite is tiny with a purple aura', () => {
  const flea = SPRITES[SPECIES.flea.grid].join('');
  assert.equal(flea.replace(/\./g, ''), 'K');
  const mite = SPRITES[SPECIES.arcane_mite.grid].join('').replace(/\./g, '');
  assert.ok(mite.length > 1 && mite.length <= 25, 'really small');
  assert.equal(SPECIES.arcane_mite.aura, '#c86ee0');
});

test('lower rarities start weaker; each rung up the ladder is stronger', () => {
  for (let i = 1; i < RARITY_ORDER.length; i++) {
    const lo = RARITIES[RARITY_ORDER[i - 1]];
    const hi = RARITIES[RARITY_ORDER[i]];
    assert.ok(hi.traitLevels[1] >= lo.traitLevels[1] && hi.traitLevels[0] >= lo.traitLevels[0]);
    assert.ok(hi.dexReward > lo.dexReward && hi.release > lo.release);
  }
});

test('variants are an independent luck layer at the advertised rates', () => {
  const rng = new Rng(5);
  const N = 200000;
  const counts = { shiny: 0, albino: 0, golden: 0, none: 0 };
  for (let i = 0; i < N; i++) counts[rollVariant(rng) || 'none'] += 1;
  for (const [id, v] of Object.entries(VARIANTS)) {
    assert.ok(Math.abs(counts[id] / N - v.chance) < v.chance * 0.15, `${id} ${counts[id] / N} vs ${v.chance}`);
  }
  assert.ok(VARIANTS.golden.chance < VARIANTS.albino.chance && VARIANTS.albino.chance < VARIANTS.shiny.chance);
});

test('variants are recorded in the Bugdex and raise the release value', () => {
  const { game } = makeGame();
  const plain = createBug(game.state, 'bee', game.rng, { variant: null }).bug;
  const gold = createBug(game.state, 'bee', game.rng, { variant: 'golden' }).bug;
  gold.level = plain.level;
  assert.equal(releaseValue(gold), releaseValue(plain) * VARIANTS.golden.releaseMult);
  assert.deepEqual(game.state.dex.bee.variants, { golden: true });
});

test('old saves turn the shiny flag into the shiny variant', async () => {
  const { migrate } = await import('../game/js/core/save.js');
  const st = migrate({ version: 2, seed: 1, bugs: [{ uid: 1, species: 'ant', traits: { lift: 1 }, shiny: true }, { uid: 2, species: 'bee', traits: { fly: 1 } }] });
  assert.equal(st.bugs[0].variant, 'shiny');
  assert.equal(st.bugs[1].variant, null);
  assert.equal(st.bugs[0].shiny, undefined);
  assert.ok(st.garden.rock, 'old gardens get a rock');
});

test('progression is slower: pricier eggs, and common eggs are mostly humble', () => {
  for (let i = 1; i < EGG_TIERS.length; i++) assert.ok(EGG_TIERS[i].price >= EGG_TIERS[i - 1].price * 2.5);
  const humble = eggOdds('common').filter((o) => ['drab', 'plain', 'common'].includes(o.rarity)).reduce((s, o) => s + o.chance, 0);
  assert.ok(humble >= 0.85, `common eggs: ${humble}`);
  assert.ok(EGG_TIERS.find((t) => t.id === 'rare').price >= 1500);
});

test('the rock: a dirt patch takes 3 hours to form and lingers 1 hour after a move', () => {
  const { game, clock, storage } = makeGame();
  const g = game.state.garden;
  assert.equal(patchStrength(g.rock, clock.t), 1, 'starts settled');
  assert.equal(ROCK.formMs, 3 * HOUR);
  assert.equal(ROCK.lingerMs, 1 * HOUR);
  const old = { x: g.rock.x, y: g.rock.y };
  assert.ok(game.moveRock(old.x - 40, old.y + 30).ok);
  assert.equal(game.moveRock(game.state.garden.rock.x + 1, game.state.garden.rock.y).ok, false, 'tiny nudges do nothing');
  const at = (dt) => dirtPatches(game.state.garden, clock.t + dt);
  // Under the rock: forming from scratch.
  assert.equal(at(0)[0].alpha, 0);
  assert.ok(Math.abs(at(1.5 * HOUR)[0].alpha - 0.5) < 1e-9);
  assert.equal(at(3 * HOUR)[0].alpha, 1);
  // Left behind: full strength for an hour, then fades away.
  const left = (dt) => at(dt).find((p) => !p.underRock && p.x === old.x && p.y === old.y);
  assert.equal(left(59 * MIN).alpha, 1);
  assert.ok(left(HOUR + ROCK.fadeMs / 2).alpha < 1);
  assert.equal(left(HOUR + ROCK.fadeMs + 1), undefined);
  // Persisted with timestamps, so it carries on while the app is closed.
  clock.t += 2 * HOUR;
  const { game: again } = makeGame({ storage, clock });
  assert.ok(Math.abs(patchStrength(again.state.garden.rock, clock.t) - 2 / 3) < 1e-9);
  assert.equal(dirtPatches(again.state.garden, clock.t).length, 1, 'the old patch has faded');
});

test('only some species like hiding under the rock', () => {
  const lovers = SPECIES_LIST.filter((s) => s.likesRock).map((s) => s.id);
  assert.ok(lovers.includes('pill_bug') && lovers.includes('woodlouse') && lovers.includes('millipede'));
  assert.ok(!lovers.includes('butterfly') && !lovers.includes('bee'));
});
