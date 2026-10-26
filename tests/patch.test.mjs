import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, AREA_BY_ID } from '../game/js/data/areas.js';
import { ITEMS, sellPrice, itemStock } from '../game/js/data/items.js';
import { SPRITES } from '../game/js/data/sprites.js';
import { SPECIES } from '../game/js/data/species.js';
import { EGG_BY_ID } from '../game/js/data/eggs.js';
import { GARDEN_CHESTS, GARDEN_CHEST_BY_ID } from '../game/js/data/garden-chests.js';
import { CHEST } from '../game/js/data/encounters.js';
import { SAVE_KEY, memoryStorage } from '../game/js/core/save.js';
import { Rng } from '../game/js/core/rng.js';
import { rollGardenChest, gardenChestArea } from '../game/js/systems/chests.js';
import { rollDropTier } from '../game/js/systems/eggs.js';
import { encounterPool } from '../game/js/systems/expedition.js';
import { effectiveTraits } from '../game/js/systems/bugs.js';
import { makeGame, addBug, partyUids } from './helpers.mjs';

test('new areas sit in the right places: Chem Facility before Aether, the Void then New Jersey after it', () => {
  assert.deepEqual(AREAS.map((a) => a.id), ['garden', 'forest', 'caves', 'volcano', 'chem', 'aether', 'void', 'new_jersey']);
  assert.equal(AREA_BY_ID.chem.name, 'Chem Facility');
  assert.equal(AREA_BY_ID.chem.fullName, 'Abandoned Chemical Facility');
  for (let i = 1; i < AREAS.length; i++) {
    assert.ok(AREAS[i].difficulty > AREAS[i - 1].difficulty, AREAS[i].id);
    assert.ok(AREAS[i].pace.power > AREAS[i - 1].pace.power, AREAS[i].id);
    assert.ok(AREAS[i].unlock.coins > AREAS[i - 1].unlock.coins, AREAS[i].id);
  }
});

test('each new area unlocks after the one before it and runs real expeditions with its own encounters', () => {
  const { game, clock } = makeGame();
  game.state.coins = 1e7;
  for (const a of AREAS) {
    if (a.index === 0) continue;
    const prev = AREAS[a.index - 1];
    assert.equal(game.unlockArea(a.id).ok, false, `${a.id} needs ${prev.id} runs first`);
    game.state.areas[prev.id].runs = a.unlock.runs;
    assert.ok(game.unlockArea(a.id).ok, a.id);
  }
  for (const id of ['chem', 'void', 'new_jersey']) {
    const own = encounterPool(AREA_BY_ID[id], game.state.bugs).filter((e) => e.areas?.includes(id));
    assert.ok(own.length >= 2, `${id} has its own encounters`);
    const exp = game.launchExpedition(id, partyUids(game), 20).expedition;
    clock.t = exp.endsAt;
    const runs = game.state.areas[id].runs;
    const res = game.claimExpedition(exp.id);
    assert.ok(res.ok, id);
    assert.equal(game.state.areas[id].runs, runs + 1);
    for (const e of exp.encounters) assert.ok(typeof e.intro === 'string' && e.intro.length, `${id} intro`);
  }
});

test('saves from before the new areas keep their unlocks and runs', () => {
  const { game, storage } = makeGame();
  const old = JSON.parse(JSON.stringify(game.state));
  delete old.areas.chem; delete old.areas.void; delete old.areas.new_jersey;
  Object.assign(old.areas.aether, { unlocked: true, runs: 7 });
  Object.assign(old.areas.volcano, { unlocked: true, runs: 12 });
  old.inventory = { key: 9, amber_shell: 3, moon_pendant: 2, ember_stone: 40 };
  old.bugs[0].item = 'firefly_lantern';
  storage.setItem(SAVE_KEY, JSON.stringify(old));
  const { game: again } = makeGame({ storage });
  const st = again.state;
  assert.deepEqual([st.areas.aether.unlocked, st.areas.aether.runs], [true, 7], 'Aether stays open');
  assert.deepEqual([st.areas.volcano.unlocked, st.areas.volcano.runs], [true, 12]);
  assert.equal(st.areas.chem.unlocked, false, 'new areas start locked');
  assert.deepEqual(st.inventory, { key: 9, amber_shell: 3, moon_pendant: 2, ember_stone: 40 }, 'no items taken away');
  assert.equal(st.bugs[0].item, 'firefly_lantern', 'equipped items stay equipped');
});

test('item prices went up, relics are a stronger, pricier, gated tier', () => {
  const OLD = { power_brace: 150, acorn_cap: 260, silk_cloak: 320, trail_mix: 400, clover_charm: 450, bug_net: 500, amber_shell: 900, firefly_lantern: 1800 };
  for (const [id, price] of Object.entries(OLD)) assert.ok(ITEMS[id].buy >= price * 2, `${id} costs more`);
  const relics = Object.entries(ITEMS).filter(([, it]) => it.tier === 'relic');
  assert.ok(relics.length >= 4);
  const power = (it) => Object.values(it.effects.traits || {}).reduce((s, v) => s + v, 0);
  const bestOld = Math.max(...Object.values(ITEMS).filter((it) => it.tier !== 'relic' && it.type === 'gear').map(power));
  const dearestOld = Math.max(...Object.values(ITEMS).filter((it) => it.tier !== 'relic' && it.buy).map((it) => it.buy));
  for (const [id, it] of relics) {
    assert.ok(power(it) >= bestOld && it.buy >= dearestOld * 3, `${id} is a real step up in strength and price`);
    assert.ok(Math.max(...Object.values(it.effects.traits)) >= 4, `${id} beats any old item in its best trait`);
    assert.ok(SPRITES[id], `${id} has a sprite`);
    assert.ok(it.shop?.area && AREA_BY_ID[it.shop.area], `${id} is gated by an area`);
  }
  assert.ok(relics.some(([, it]) => power(it) > bestOld), 'at least one relic outclasses every old item');
  const { game } = makeGame();
  game.state.coins = 1e6;
  assert.equal(itemStock(game.state, 'void_blade').ok, false);
  assert.equal(game.buyItem('void_blade').ok, false, 'not before the Void is open');
  game.state.areas.void.unlocked = true;
  assert.ok(game.buyItem('void_blade').ok);
  assert.ok(sellPrice('void_blade') < ITEMS.void_blade.buy / 2, 'selling loses most of the price');
});

test('relics are equipped and counted like any other gear', () => {
  const { game } = makeGame();
  const bug = game.state.bugs[0];
  game.addItem('titan_gauntlet');
  assert.ok(game.equip(bug.uid, 'titan_gauntlet').ok);
  assert.equal(bug.item, 'titan_gauntlet');
  assert.equal(effectiveTraits(bug).lift, (bug.traits.lift || 0) + ITEMS.titan_gauntlet.effects.traits.lift, 'its bonus counts');
  assert.equal(game.state.inventory.titan_gauntlet, undefined);
});

test('garden chests: more keys for bigger chests, keys spent only on a successful opening', () => {
  assert.deepEqual(GARDEN_CHESTS.map((c) => c.keys), [...GARDEN_CHESTS.map((c) => c.keys)].sort((a, b) => a - b));
  const { game, storage } = makeGame();
  game.state.inventory.key = 2;
  const before = { coins: game.state.coins, eggs: game.state.eggs.length };
  assert.ok(GARDEN_CHEST_BY_ID.grand.keys > 2);
  const no = game.openGardenChest('grand');
  assert.equal(no.ok, false);
  assert.equal(game.state.inventory.key, 2, 'no keys taken when there are not enough');
  assert.equal(game.state.coins, before.coins);
  const yes = game.openGardenChest('small');
  assert.ok(yes.ok);
  assert.equal(game.state.inventory.key, 1, 'exactly one key spent');
  assert.equal(game.state.coins, before.coins + yes.coins, 'coins paid exactly once');
  for (const [id, n] of Object.entries(yes.items)) assert.equal(game.state.inventory[id], n);
  // It all survives a reload.
  const { game: again } = makeGame({ storage });
  assert.equal(again.state.inventory.key, 1);
  assert.equal(again.state.coins, game.state.coins);
  game.openGardenChest('small');
  assert.equal(game.state.inventory.key, undefined, 'the last key is gone');
  assert.equal(game.openGardenChest('small').ok, false);
});

test('garden chests never hold keys or relics, and draw from your best open area up to their cap', () => {
  const { game } = makeGame();
  for (const a of AREAS) game.state.areas[a.id].unlocked = true;
  assert.equal(gardenChestArea(game.state, GARDEN_CHEST_BY_ID.small).id, 'forest');
  assert.equal(gardenChestArea(game.state, GARDEN_CHEST_BY_ID.grand).id, 'new_jersey');
  const rng = new Rng(4);
  for (const c of GARDEN_CHESTS) for (let i = 0; i < 2000; i++) {
    for (const id of Object.keys(rollGardenChest(game.state, c, rng).items)) {
      assert.notEqual(id, 'key');
      assert.notEqual(ITEMS[id].tier, 'relic');
    }
  }
});

test('every garden chest is worth less than an expedition chest from the same area', () => {
  // Expected value of an expedition chest opened with a key, at the lowest
  // bonuses (no Better Finds, no special-find items).
  const value = (r) => r.coins + Object.entries(r.items).reduce((s, [id, n]) => s + n * (ITEMS[id].buy || ITEMS[id].sell || 0), 0) + r.eggs.reduce((s, t) => s + EGG_BY_ID[t].price, 0);
  const { game } = makeGame();
  for (const a of AREAS) game.state.areas[a.id].unlocked = true;
  for (const c of GARDEN_CHESTS) {
    const area = gardenChestArea(game.state, c);
    const rng = new Rng(9);
    let garden = 0, expedition = 0;
    const N = 40000;
    for (let i = 0; i < N; i++) {
      garden += value(rollGardenChest(game.state, c, rng));
      const items = {};
      const n = rng.int(CHEST.lootRolls[0], CHEST.lootRolls[1]);
      for (let k = 0; k < n; k++) { const id = rng.weighted(area.chest.loot); items[id] = (items[id] || 0) + 1; }
      const coins = Math.round(rng.float(0.8, 1.2) * area.coinBase * area.chest.coins);
      const eggs = rng.chance(area.chest.eggChance) ? [rollDropTier(area, 'chest', rng)] : [];
      expedition += value({ coins, items, eggs });
    }
    assert.ok(garden < expedition, `${c.id} (${area.id}): garden ${Math.round(garden / N)} < expedition ${Math.round(expedition / N)}`);
  }
});

test('the Orchid Mantis is its own collectible with its own sprite; the Moon Mantis is unchanged', () => {
  const o = SPECIES.orchid_mantis;
  const m = SPECIES.mantis;
  assert.equal(o.sprite, '8x/orchid_mantis.png');
  assert.equal(o.recolor, null);
  assert.equal(m.sprite, '8x/mantis.png');
  assert.equal(o.view, m.view);
  const { game } = makeGame();
  const bug = addBug(game, 'orchid_mantis', { cut: 7, fight: 8 }, { inGarden: true });
  game.addItem('thorn_spear');
  assert.ok(game.equip(bug.uid, 'thorn_spear').ok, 'can hold items');
  assert.ok(game.launchExpedition('garden', [bug.uid, ...partyUids(game).slice(0, 3)]).ok, 'can go exploring');
});
