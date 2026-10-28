import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VISITORS, ROCK, GARDEN_LIMIT } from '../game/js/data/balance.js';
import { SPECIES } from '../game/js/data/species.js';
import { freeGardenSpots } from '../game/js/systems/visitors.js';
import { makeGame, addBug, partyUids, HOUR, MIN } from './helpers.mjs';

const live = (game) => game.state.garden.visitors.filter((v) => v.leavesAt > game.now());

test('wild visitors wander in over time, up to the cap and the free places', () => {
  const { game, clock } = makeGame();
  assert.equal(live(game).length, 0, 'nobody on the first day yet');
  let seen = 0;
  for (let i = 0; i < 48; i++) {
    clock.t += HOUR / 2;
    game.tick();
    const n = live(game).length;
    assert.ok(n <= Math.min(VISITORS.max, freeGardenSpots(game.state)));
    seen = Math.max(seen, n);
    for (const v of live(game)) assert.ok(SPECIES[v.species]);
  }
  assert.ok(seen >= 1, 'someone dropped by in a day');
});

test('a full garden gets no visitors; the party leaving makes room', () => {
  const { game, clock } = makeGame();
  for (let i = 0; i < GARDEN_LIMIT - 4; i++) addBug(game, 'ant', { lift: 2 }, { inGarden: true });
  assert.equal(freeGardenSpots(game.state), 0);
  clock.t += 12 * HOUR;
  game.tick();
  assert.equal(live(game).length, 0);
  game.state.coins = 1e6;
  game.launchExpedition('garden', partyUids(game), 150);
  assert.equal(freeGardenSpots(game.state), 4);
  clock.t += 6 * HOUR;
  game.tick();
  assert.ok(live(game).length >= 1, 'visitors fill the empty spots');
});

test('arrivals are caught up while the app is closed, but only for a day', () => {
  const { game, clock, storage } = makeGame();
  game.save();
  clock.t += 30 * 24 * HOUR;
  const { game: again } = makeGame({ storage, clock });
  const vs = again.state.garden.visitors;
  assert.ok(vs.every((v) => v.arrivedAt >= clock.t - VISITORS.catchUpHours * HOUR));
  assert.ok(vs.every((v) => v.leavesAt > clock.t), 'only visitors still here are kept');
});

test('saying hi gives one gift, then the visitor heads home', () => {
  const { game, clock } = makeGame();
  let v;
  while (!(v = live(game)[0])) { clock.t += HOUR; game.tick(); }
  const coins = game.state.coins;
  const eggs = game.state.eggs.length;
  const res = game.greetVisitor(v.id);
  assert.ok(res.ok);
  assert.ok(res.coins > 0 || res.egg);
  assert.equal(game.state.coins + game.state.eggs.length > coins + eggs, true);
  assert.equal(game.greetVisitor(v.id).ok, false, 'only one gift each');
  assert.ok(v.leavesAt <= game.now() + VISITORS.afterHiMin * 60e3);
  clock.t += VISITORS.afterHiMin * 60e3 + 1;
  game.tick();
  assert.equal(game.greetVisitor(v.id).ok, false, 'gone home');
});

test('visitors sometimes leave eggs, which settle into a free nest', () => {
  const { game, clock } = makeGame();
  let gifts = 0, eggs = 0;
  for (let i = 0; i < 400 && gifts < 120; i++) {
    clock.t += HOUR;
    game.tick();
    for (const v of live(game)) {
      if (v.greeted) continue;
      const res = game.greetVisitor(v.id);
      gifts += 1;
      if (res.egg) {
        eggs += 1;
        assert.equal(typeof res.nested, 'boolean');
      }
    }
    for (const e of game.state.eggs.filter((x) => x.startedAt)) { e.endsAt = game.now(); game.hatchEgg(e.uid); }
  }
  const rate = eggs / gifts;
  assert.ok(rate > 0.04 && rate < 0.35, `egg rate ${rate}`);
});

test('the rock hides one find per spot, once its patch has formed', () => {
  const { game, clock } = makeGame();
  assert.ok(game.searchRock().ok, 'the starting rock is settled');
  assert.equal(game.searchRock().ok, false, 'only once');
  const r = game.state.garden.rock;
  assert.ok(game.moveRock(r.x + 20, r.y).ok);
  assert.equal(game.searchRock().ok, false, 'a new spot needs time');
  clock.t += ROCK.formMs - 1;
  assert.equal(game.searchRock().ok, false);
  clock.t += 1;
  assert.ok(game.searchRock().ok);
});

test('rock finds pay out eggs often enough to matter', () => {
  let eggs = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { game } = makeGame({ seed });
    const before = game.state.eggs.length;
    const res = game.searchRock();
    if (res.egg) {
      eggs += 1;
      assert.equal(game.state.eggs.length, before + 1);
    }
  }
  assert.ok(eggs > 25 && eggs < 80, `${eggs} eggs in 200 lifts`);
});

test('the paper boat comes by every so often with an egg, only while you have the river', async () => {
  const { BOAT } = await import('../game/js/data/balance.js');
  const { game, clock } = makeGame();
  assert.equal(game.boatDue(), false, 'no river, no boat');
  game.state.coins = 1e6;
  game.buyDecor('river');
  assert.equal(game.boatDue(), false, 'the first one is scheduled, not instant');
  assert.equal(game.catchBoat().ok, false);
  clock.t += BOAT.everyMin[1] * MIN + 1;
  assert.ok(game.boatDue());
  const eggs = game.state.eggs.length;
  const res = game.catchBoat();
  assert.ok(res.ok && res.egg);
  assert.equal(game.state.eggs.length, eggs + 1);
  assert.equal(game.catchBoat().ok, false, 'one egg per boat');
  clock.t += BOAT.everyMin[1] * MIN + 1;
  game.boatGone(); // drifted past untouched
  assert.equal(game.boatDue(), false);
});

test("the boat's egg gets rarer the fuller your Bugdex", async () => {
  const { boatEggOdds } = await import('../game/js/systems/visitors.js');
  const share = (stars, id) => { const o = boatEggOdds(stars); const t = o.reduce((s, [, w]) => s + w, 0); return o.find(([k]) => k === id)[1] / t; };
  assert.ok(share(0, 'common') > 0.45);
  assert.ok(share(146, 'common') < share(0, 'common') / 5);
  for (const id of ['rare', 'epic', 'legendary', 'mythic', 'celestial']) assert.ok(share(146, id) > share(40, id) && share(40, id) > share(0, id), id);
  assert.ok(share(146, 'celestial') < 0.02, 'still a rare treat');
});

test('the bird on the log: shooing it pays coins for every bug it scared', async () => {
  const { BIRD } = await import('../game/js/data/balance.js');
  const { game, clock } = makeGame();
  game.state.coins = 1e6;
  game.buyDecor('log');
  game.birdDue();
  clock.t += BIRD.everyMin[1] * MIN + 1;
  assert.ok(game.birdDue());
  const coins = game.state.coins;
  const res = game.shooBird(3);
  assert.ok(res.ok);
  assert.equal(res.coins.length, 3);
  for (const c of res.coins) assert.ok(c >= BIRD.coins[0] && c <= BIRD.coins[1]);
  assert.equal(game.state.coins, coins + res.coins.reduce((a, b) => a + b, 0));
  assert.equal(game.shooBird(3).ok, false, 'it has flown');
  clock.t += BIRD.everyMin[1] * MIN + 1;
  assert.equal(game.shooBird(999).coins.length, game.state.bugs.filter((b) => b.inGarden).length, 'never more bugs than live in the garden');
});
