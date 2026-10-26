import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECOR, DECOR_BY_ID, LOG } from '../game/js/data/decor.js';
import { GARDEN_FORAGE } from '../game/js/data/balance.js';
import { RARITIES } from '../game/js/data/rarities.js';
import { SPECIES } from '../game/js/data/species.js';
import { gardenRatePerMin, bugForageRate, favouriteDecor, potCap, decorFits } from '../game/js/systems/garden.js';
import { makeGame, addBug, MIN, HOUR } from './helpers.mjs';

const rich = () => { const g = makeGame(); g.game.state.coins = 1e6; return g; };

test('decorations are bought once, placed somewhere free, and the rock stays free', () => {
  const { game } = rich();
  assert.equal(DECOR_BY_ID.rock.price, 0);
  assert.equal(game.buyDecor('rock').ok, false, 'the rock is not for sale');
  const coins = game.state.coins;
  const res = game.buyDecor('log');
  assert.ok(res.ok);
  assert.equal(game.state.coins, coins - DECOR_BY_ID.log.price);
  assert.equal(game.buyDecor('log').ok, false, 'only one log');
  for (const d of DECOR.filter((x) => x.price && x.id !== 'log')) assert.ok(game.buyDecor(d.id).ok, d.id);
  const g = game.state.garden;
  for (const [id, spot] of Object.entries(g.decor)) if (!DECOR_BY_ID[id].fixed) assert.ok(decorFits(g, id, spot.x, spot.y), `${id} fits where it was put`);
  const { game: poor } = makeGame();
  assert.equal(poor.buyDecor('battery').ok, false, 'needs the coins');
});

test('decorations can be dragged, but not onto the rock or each other', () => {
  const { game } = rich();
  game.buyDecor('log');
  game.buyDecor('flower_bed');
  const g = game.state.garden;
  assert.equal(game.moveDecor('log', g.rock.x, g.rock.y).ok, false, 'not on the rock');
  assert.equal(game.moveDecor('log', g.decor.flower_bed.x, g.decor.flower_bed.y).ok, false, 'not on the flower bed');
  assert.equal(game.moveDecor('log', -50, 100).ok, false, 'not off the edge');
  assert.ok(game.moveDecor('log', 75, 250).ok);
  assert.deepEqual([g.decor.log.x, g.decor.log.y], [75, 250]);
  assert.equal(game.moveRock(75, 250).ok, false, 'the rock cannot land on the log either');
  game.buyDecor('river');
  assert.equal(game.moveDecor('river', 75, 100).ok, false, 'the river stays put');
});

test('bugs forage more when they live with a decoration they love, closed game or not', () => {
  const { game, clock } = rich();
  for (const b of game.state.bugs) b.inGarden = false;
  const beetle = addBug(game, 'stag_beetle', { lift: 5 }, { inGarden: true });
  const base = RARITIES[SPECIES.stag_beetle.rarity].forage;
  assert.equal(favouriteDecor(game.state, 'stag_beetle'), null);
  assert.equal(bugForageRate(game.state, beetle), base);
  game.buyDecor('log');
  assert.equal(favouriteDecor(game.state, 'stag_beetle').id, 'log');
  assert.equal(bugForageRate(game.state, beetle), base * 1.5);
  // The bonus is in the saved rate, so ten minutes away earns it too.
  game.tick();
  const pot = game.state.garden.pot;
  clock.t += 10 * MIN;
  game.tick();
  assert.ok(Math.abs(game.state.garden.pot - pot - base * 1.5 * 10) < 1e-9);
});

test('a bug that loves several decorations gets the best bonus, not all of them', () => {
  const { game } = rich();
  const fly = addBug(game, 'storm_dragonfly', { fly: 9 }, { inGarden: true });
  game.buyDecor('river');
  game.buyDecor('flower_bed');
  assert.equal(bugForageRate(game.state, fly), RARITIES.legendary.forage * 1.5);
  game.buyDecor('battery');
  assert.equal(favouriteDecor(game.state, 'storm_dragonfly').id, 'battery');
  assert.equal(bugForageRate(game.state, fly), RARITIES.legendary.forage * 2);
});

test("the river doubles the coin pot; the rock's shade-lovers get a small bonus", () => {
  const { game } = rich();
  assert.equal(potCap(game.state), GARDEN_FORAGE.cap);
  game.buyDecor('river');
  assert.equal(potCap(game.state), GARDEN_FORAGE.cap * 2);
  const pill = game.state.bugs.find((b) => b.species === 'pill_bug');
  assert.equal(bugForageRate(game.state, pill), RARITIES.common.forage * 1.25);
  assert.ok(gardenRatePerMin(game.state) > 0);
});

test('rolling the log pays a few coins at most every couple of hours', () => {
  const { game, clock } = rich();
  assert.equal(game.rollLog().ok, false);
  game.buyDecor('log');
  const first = game.rollLog();
  assert.ok(first.coins >= LOG.coins[0] && first.coins <= LOG.coins[1]);
  assert.equal(game.rollLog().coins, 0, 'nothing new under it yet');
  clock.t += LOG.everyMs;
  assert.ok(game.rollLog().coins > 0);
});

test('a battery zap knocks a coin into the pot, up to its cap', () => {
  const { game } = rich();
  assert.equal(game.batteryZap().ok, false);
  game.buyDecor('battery');
  const pot = game.state.garden.pot;
  assert.ok(game.batteryZap().ok);
  assert.equal(game.state.garden.pot, pot + 1);
  game.state.garden.pot = potCap(game.state);
  game.batteryZap();
  assert.equal(game.state.garden.pot, potCap(game.state));
});

test('decorations draw in the visitors that love them', () => {
  const count = (decor) => {
    const { game, clock } = rich();
    for (const id of decor) game.buyDecor(id);
    let lovers = 0, all = 0;
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      clock.t += HOUR;
      game.tick();
      for (const v of game.state.garden.visitors) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        all += 1;
        if (SPECIES[v.species].family === 'flyer') lovers += 1;
      }
    }
    return lovers / all;
  };
  const without = count([]);
  const withBed = count(['flower_bed']);
  assert.ok(withBed > without * 1.2, `flyer visitors ${without.toFixed(2)} -> ${withBed.toFixed(2)}`);
});

test('the river keeps decorations and the rock off its water', () => {
  const { game } = rich();
  game.buyDecor('log');
  assert.ok(game.moveDecor('log', 250, 52).ok, 'the top corner is free before the river');
  game.buyDecor('river');
  const g = game.state.garden;
  assert.ok(decorFits(g, 'log', g.decor.log.x, g.decor.log.y), 'the log was moved out of the water');
  assert.notDeepEqual([g.decor.log.x, g.decor.log.y], [250, 52]);
  assert.equal(game.moveDecor('log', 250, 52).ok, false, 'and cannot go back in');
  assert.equal(game.moveRock(250, 50).ok, false, 'nor can the rock');
  assert.ok(game.moveDecor('log', 40, 240).ok, 'dry land is fine');
});
