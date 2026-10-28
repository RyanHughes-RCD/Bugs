import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, upgradeCost, upgradeValue } from '../game/js/data/upgrades.js';
import { GARDEN_LIMIT, GARDEN_FORAGE } from '../game/js/data/balance.js';
import { potCap } from '../game/js/systems/garden.js';
import { ITEMS, sellPrice } from '../game/js/data/items.js';
import { AREA_BY_ID } from '../game/js/data/areas.js';
import { expeditionSlots } from '../game/js/systems/expedition.js';
import { gardenRatePerMin } from '../game/js/systems/garden.js';
import { gardenLimit } from '../game/js/systems/bugs.js';
import { freeGardenSpots } from '../game/js/systems/visitors.js';
import { makeGame, addBug, partyUids, MIN } from './helpers.mjs';

test('the four required upgrade paths exist with rising costs and levels', () => {
  for (const id of ['faster_incubation', 'expedition_efficiency', 'better_finds', 'improved_exploration']) {
    const u = UPGRADES.find((x) => x.id === id);
    assert.ok(u && u.max > 1, id);
    for (let l = 1; l < u.max; l++) assert.ok(upgradeCost(id, l) > upgradeCost(id, l - 1));
    assert.equal(upgradeCost(id, u.max), Infinity);
  }
});

test('upgrade purchases validate coins and max level, never going negative', () => {
  const { game } = makeGame();
  game.state.coins = upgradeCost('better_finds', 0) - 1;
  assert.equal(game.buyUpgrade('better_finds').ok, false);
  assert.equal(game.state.upgrades.better_finds, 0);
  game.state.coins = 1e9;
  const u = UPGRADES.find((x) => x.id === 'improved_exploration');
  for (let i = 0; i < u.max; i++) assert.ok(game.buyUpgrade(u.id).ok);
  assert.equal(game.buyUpgrade(u.id).ok, false);
  assert.equal(game.state.upgrades[u.id], u.max);
  assert.ok(game.state.coins >= 0);
});

test('upgrade effects: better finds, more expedition slots', () => {
  const { game } = makeGame();
  game.state.upgrades.better_finds = 10;
  assert.equal(upgradeValue(game.state, 'better_finds'), 0.5);
  assert.equal(expeditionSlots(game.state), 1);
  game.state.upgrades.improved_exploration = 1;
  assert.equal(expeditionSlots(game.state), 2);
  game.state.upgrades.improved_exploration = 2;
  assert.equal(expeditionSlots(game.state), 2, 'two slots at most');
});

test('Better Finds adds half again the coins at max level for the same expedition', async () => {
  const { planExpedition } = await import('../game/js/systems/expedition.js');
  const { game } = makeGame();
  const party = game.state.bugs;
  const base = planExpedition(game.state, AREA_BY_ID.forest, party, 42);
  game.state.upgrades.better_finds = 10;
  const boosted = planExpedition(game.state, AREA_BY_ID.forest, party, 42);
  const sum = (p) => p.encounters.reduce((s, e) => s + e.coins, 0);
  assert.ok(Math.abs(sum(boosted) - 1.5 * sum(base)) <= boosted.encounters.length, `${sum(boosted)} ≈ 1.5 × ${sum(base)}`);
});

test('the garden holds at most 10 bugs; leaving it never removes a bug', () => {
  const { game } = makeGame();
  for (let i = 0; i < 10; i++) addBug(game, 'ant', { lift: 2 });
  const outside = game.state.bugs.filter((b) => !b.inGarden);
  for (let i = 0; i < 6; i++) assert.ok(game.setInGarden(outside[i].uid, true).ok);
  assert.equal(game.state.bugs.filter((b) => b.inGarden).length, GARDEN_LIMIT);
  const res = game.setInGarden(outside[6].uid, true);
  assert.equal(res.ok, false);
  const total = game.state.bugs.length;
  assert.ok(game.setInGarden(game.state.bugs[0].uid, false).ok);
  assert.equal(game.state.bugs.length, total, 'still in the collection');
  assert.ok(game.setInGarden(outside[6].uid, true).ok);
});

test('Bigger Garden adds 5 garden places per level, up to 25', () => {
  const { game } = makeGame();
  assert.equal(gardenLimit(game.state), GARDEN_LIMIT);
  for (let i = 0; i < 30; i++) addBug(game, 'ant', { lift: 2 });
  const fill = () => {
    for (const b of game.state.bugs) if (!b.inGarden) game.setInGarden(b.uid, true);
    return game.state.bugs.filter((b) => b.inGarden).length;
  };
  assert.equal(fill(), 10);
  game.state.coins = 1e9;
  for (const size of [15, 20, 25]) {
    assert.ok(game.buyUpgrade('garden_space').ok);
    assert.equal(gardenLimit(game.state), size);
    assert.equal(fill(), size);
  }
  assert.equal(game.buyUpgrade('garden_space').ok, false, 'capped at 25');
  assert.equal(freeGardenSpots(game.state), 0);
  game.setInGarden(game.state.bugs.find((b) => b.inGarden).uid, false);
  assert.equal(freeGardenSpots(game.state), 1);
});

test('garden bugs forage a few coins up to a cap, even while away exploring', () => {
  const { game, clock } = makeGame();
  const rate = gardenRatePerMin(game.state);
  assert.ok(rate > 0);
  clock.t += 10 * MIN;
  game.tick();
  assert.ok(Math.abs(game.state.garden.pot - rate * 10) < 1e-6);
  clock.t += 1000 * MIN;
  game.tick();
  const cap = potCap(game.state);
  assert.equal(game.state.garden.pot, cap);
  const coins = game.state.coins;
  assert.equal(game.collectGarden().coins, cap);
  assert.equal(game.state.coins, coins + cap);
  game.launchExpedition('garden', partyUids(game));
  assert.equal(gardenRatePerMin(game.state), rate, 'income continues during expeditions');
  const before = game.state.garden.pot;
  clock.t += 10 * MIN;
  game.tick();
  assert.ok(game.state.garden.pot > before);
});

test('one item per bug: equip swaps, nothing is duplicated or lost', () => {
  const { game } = makeGame();
  const [a, b] = game.state.bugs;
  game.addItem('thorn_spear');
  const count = () => (game.state.inventory.key || 0) + (game.state.inventory.thorn_spear || 0) + game.state.bugs.filter((x) => x.item).length;
  const before = count();
  assert.ok(game.equip(a.uid, 'key').ok);
  assert.ok(game.equip(a.uid, 'thorn_spear').ok, 'swap');
  assert.equal(a.item, 'thorn_spear');
  assert.equal(game.state.inventory.key, 1);
  assert.ok(game.unequip(a.uid).ok);
  assert.ok(game.equip(b.uid, 'thorn_spear').ok, 'moved to another bug');
  assert.equal(game.equip(a.uid, 'thorn_spear').ok, false, 'only one existed');
  assert.equal(count(), before);
  assert.equal(game.equip(a.uid, 'honey_drop').ok, false, 'resources are not equipment');
});

test('equipment and upgrades are separate: removing an item keeps the upgrade', async () => {
  const { encounterMs } = await import('../game/js/systems/expedition.js');
  const { game } = makeGame();
  game.state.upgrades.expedition_efficiency = 2;
  const party = game.state.bugs.slice(0, 4);
  party[0].item = 'trail_mix';
  const withItem = encounterMs(game.state, AREA_BY_ID.garden, party);
  party[0].item = null;
  const without = encounterMs(game.state, AREA_BY_ID.garden, party);
  assert.ok(withItem < without);
  assert.equal(without, Math.round(5 * MIN * 0.92));
});

test('shop purchases and sales validate the balance and inventory', () => {
  const { game } = makeGame();
  game.state.coins = 100;
  assert.equal(game.buyItem('power_brace').ok, false);
  assert.equal(game.buyItem('key').ok, false, 'keys are found, not bought');
  game.state.coins = 1000;
  assert.ok(game.buyItem('power_brace').ok);
  assert.equal(game.state.coins, 1000 - ITEMS.power_brace.buy);
  game.addItem('ember_stone', 3);
  const c = game.state.coins;
  assert.ok(game.sellItem('ember_stone', 3).ok);
  assert.equal(game.state.coins, c + 3 * sellPrice('ember_stone'));
  assert.equal(game.sellItem('ember_stone', 1).ok, false);
});

test('areas unlock with completed expeditions in the previous area plus coins', () => {
  const { game } = makeGame();
  game.state.coins = 1e6;
  assert.equal(game.unlockArea('forest').ok, false);
  game.state.areas.garden.runs = 3;
  assert.equal(game.unlockArea('caves').ok, false, 'one at a time');
  assert.ok(game.unlockArea('forest').ok);
  assert.equal(game.state.coins, 1e6 - AREA_BY_ID.forest.unlock.coins);
});

test('the starting resources fund the first eggs, and early expeditions keep them coming', async () => {
  const { planExpedition } = await import('../game/js/systems/expedition.js');
  const { game } = makeGame();
  assert.ok(game.state.coins >= 3 * 100, 'three common eggs from the start');
  let coins = 0;
  for (let s = 0; s < 200; s++) coins += planExpedition(game.state, AREA_BY_ID.garden, game.state.bugs, s).encounters.reduce((x, e) => x + e.coins, 0);
  const perRun = coins / 200;
  assert.ok(perRun >= 30 && perRun <= 120, `starter garden run pays ${perRun}`);
});
