import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, upgradeCost } from '../game/js/data/upgrades.js';
import { computeStats, addXp, xpToNext } from '../game/js/systems/bugs.js';
import { gardenCap, gardenRatePerMin, VISITOR_STAY_MS } from '../game/js/systems/garden.js';
import { ROTATION_MS, FIXED_STOCK, priceOf } from '../game/js/systems/shop.js';
import { sellPrice } from '../game/js/data/items.js';
import { makeGame } from './helpers.mjs';

test('upgrade costs grow, spend coins, and stop at max level', () => {
  const { game } = makeGame();
  for (const u of UPGRADES) assert.ok(upgradeCost(u.id, 1) > upgradeCost(u.id, 0), u.id);
  game.state.coins = 1e7;
  const u = UPGRADES.find((x) => x.id === 'camp');
  for (let i = 0; i < u.max; i++) assert.ok(game.buyUpgrade('camp').ok);
  assert.equal(game.buyUpgrade('camp').ok, false);
  assert.equal(game.state.upgrades.camp, u.max);
  game.state.coins = 0;
  assert.equal(game.buyUpgrade('bloom').ok, false, 'not enough coins');
});

test('Training Log raises every bug\'s stats', () => {
  const { game } = makeGame();
  const bug = game.state.bugs[0];
  const before = computeStats(bug, game.state);
  game.state.upgrades.training = 10;
  const after = computeStats(bug, game.state);
  for (const k of ['hp', 'atk', 'def', 'spd']) assert.ok(after[k] >= before[k], k);
  assert.ok(after.hp > before.hp);
});

test('levels raise stats and xp carries over', () => {
  const { game } = makeGame();
  const bug = game.state.bugs[0];
  const s1 = computeStats(bug, game.state);
  const gained = addXp(bug, xpToNext(1) + xpToNext(2) + 3);
  assert.equal(gained, 2);
  assert.equal(bug.level, 3);
  assert.equal(bug.xp, 3);
  assert.ok(computeStats(bug, game.state).atk > s1.atk);
});

test('garden earns coins over time up to its cap, and only from bugs at home', () => {
  const { game, clock } = makeGame();
  const rate = gardenRatePerMin(game.state);
  assert.ok(rate > 0);
  clock.t += 5 * 60e3;
  game.tick();
  assert.ok(Math.abs(game.state.garden.pot - rate * 5) < 0.01);
  clock.t += 24 * 60 * 60e3;
  game.tick();
  assert.equal(game.state.garden.pot, gardenCap(game.state));
  const coins = game.state.coins;
  const res = game.collectGarden();
  assert.equal(game.state.coins, coins + res.coins);
  assert.ok(game.state.garden.pot < 1);
  game.launchExpedition('meadow', game.state.bugs.map((b) => b.uid));
  assert.equal(gardenRatePerMin(game.state), 0, 'everyone is away');
  game.state.upgrades.coin_jar = 2;
  assert.equal(gardenCap(game.state), 500);
});

test('offline time accumulates garden coins on load', () => {
  const { game, clock, storage } = makeGame();
  game.save();
  clock.t += 30 * 60e3;
  const { game: again } = makeGame({ storage, clock });
  assert.equal(Math.floor(again.state.garden.pot), Math.floor(Math.min(gardenCap(again.state), gardenRatePerMin(again.state) * 30)));
});

test('wild visitors appear, leave, and can be befriended', () => {
  const { game, clock } = makeGame();
  clock.t = game.state.garden.nextVisitorAt;
  game.tick();
  const v = game.state.garden.visitor;
  assert.ok(v, 'visitor arrived');
  clock.t += VISITOR_STAY_MS + 1;
  game.tick();
  assert.notEqual(game.state.garden.visitor, v, 'the first visitor left');
  game.state.garden.visitor = { ...v, expiresAt: clock.t + 60e3 };
  game.addItem('honey_drop');
  const bugs = game.state.bugs.length;
  const res = game.catchVisitor({ useHoney: true });
  assert.ok(res.ok && res.caught, 'honey guarantees the catch');
  assert.equal(game.state.bugs.length, bugs + 1);
  assert.equal(game.catchVisitor().ok, false, 'no visitor left');
});

test('shop: fixed stock, once-per-rotation deals, selling', () => {
  const { game, clock } = makeGame();
  game.state.coins = 10000;
  for (const id of FIXED_STOCK) assert.ok(game.buy(id).ok, id);
  assert.equal(game.state.coins, 10000 - FIXED_STOCK.reduce((s, id) => s + priceOf(id), 0));
  assert.ok(game.state.eggs.some((e) => e.type === 'garden_egg'), 'eggs go to the egg basket');
  assert.equal(game.buy('moon_pendant').ok, false, 'not sold in fixed stock');

  const offers = game.shopOffers();
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map((o) => o.id)).size, 3, 'no duplicate deals');
  assert.ok(game.buy(offers[0].id, { offerIndex: 0 }).ok);
  assert.equal(game.buy(offers[0].id, { offerIndex: 0 }).ok, false, 'sold out');
  clock.t += ROTATION_MS;
  assert.equal(game.shopOffers()[0].sold, false, 'restocked');

  game.addItem('moon_crystal', 3);
  const coins = game.state.coins;
  assert.ok(game.sell('moon_crystal', 3).ok);
  assert.equal(game.state.coins, coins + sellPrice('moon_crystal') * 3);
  assert.equal(game.sell('moon_crystal', 1).ok, false);
});

test('gear equips, swaps and returns to the bag', () => {
  const { game } = makeGame();
  const bug = game.state.bugs[0];
  const base = computeStats(bug, game.state);
  game.addItem('thorn_spear');
  game.addItem('acorn_cap');
  assert.ok(game.equip(bug.uid, 'thorn_spear').ok);
  assert.equal(game.state.inventory.thorn_spear, undefined);
  assert.equal(computeStats(bug, game.state).atk, base.atk + 5);
  assert.ok(game.equip(bug.uid, 'acorn_cap').ok, 'swap');
  assert.equal(game.state.inventory.thorn_spear, 1);
  assert.ok(game.unequip(bug.uid).ok);
  assert.equal(game.state.inventory.acorn_cap, 1);
  assert.equal(game.equip(bug.uid, 'honey_drop').ok, false, 'not gear');
});

test('releasing a bug pays coins, returns gear, and keeps at least one bug', () => {
  const { game } = makeGame();
  const [a, b, c, d] = game.state.bugs;
  game.addItem('thorn_spear');
  game.equip(a.uid, 'thorn_spear');
  const coins = game.state.coins;
  const res = game.releaseBug(a.uid);
  assert.ok(res.ok && res.coins > 0);
  assert.equal(game.state.coins, coins + res.coins);
  assert.equal(game.state.inventory.thorn_spear, 1);
  game.releaseBug(b.uid);
  game.releaseBug(c.uid);
  assert.equal(game.releaseBug(d.uid).ok, false);
});

test('nectar grants xp and rename sets a nickname', () => {
  const { game } = makeGame();
  const bug = game.state.bugs[0];
  game.addItem('xp_nectar');
  assert.ok(game.useItem('xp_nectar', bug.uid).ok);
  assert.ok(bug.level > 1);
  game.renameBug(bug.uid, '  Sir Antony  ');
  assert.equal(bug.nickname, 'Sir Antony');
});
