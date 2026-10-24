import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, AREA_BY_ID } from '../game/js/data/areas.js';
import { BASE_ENCOUNTER_MS } from '../game/js/data/balance.js';
import { planExpedition, expeditionTimeline, encounterMs } from '../game/js/systems/expedition.js';
import { makeGame, addBug, partyUids, MIN, HOUR } from './helpers.mjs';

const unlockAll = (game) => { for (const a of AREAS) game.state.areas[a.id].unlocked = true; };

test('a party must be exactly four eligible bugs', () => {
  const { game } = makeGame();
  const uids = partyUids(game);
  assert.equal(game.launchExpedition('garden', uids.slice(0, 3)).ok, false, 'three is not enough');
  addBug(game, 'bee', { fly: 3 });
  assert.equal(game.launchExpedition('garden', game.state.bugs.map((b) => b.uid)).ok, false, 'five is too many');
  assert.equal(game.launchExpedition('garden', [uids[0], uids[0], uids[1], uids[2]]).ok, false, 'no duplicates');
  assert.equal(game.launchExpedition('forest', uids).ok, false, 'locked area');
  assert.ok(game.launchExpedition('garden', uids).ok);
});

test('bugs cannot be on two expeditions at once, or change items while away', () => {
  const { game } = makeGame();
  game.state.upgrades.improved_exploration = 1;
  for (const s of ['bee', 'wasp', 'moth', 'tick']) addBug(game, s, { fly: 2 });
  const uids = partyUids(game);
  assert.ok(game.launchExpedition('garden', uids).ok);
  assert.equal(game.launchExpedition('garden', [uids[0], ...game.state.bugs.slice(4, 7).map((b) => b.uid)]).ok, false);
  assert.equal(game.equip(uids[0], 'key').ok, false, 'no gear changes while exploring');
  assert.equal(game.releaseBug(uids[0]).ok, false);
  assert.equal(game.assignment(game.bug(uids[0])), 'expedition');
  assert.ok(game.launchExpedition('garden', game.state.bugs.slice(4, 8).map((b) => b.uid)).ok, 'second slot');
});

test('encounter counts are randomized within each area\'s range, saved at launch', () => {
  const { game } = makeGame();
  const party = game.state.bugs;
  for (const area of AREAS) {
    const seen = new Set();
    for (let s = 0; s < 120; s++) {
      const p = planExpedition(game.state, area, party, s);
      assert.ok(p.count >= area.encounters[0] && p.count <= area.encounters[1], area.id);
      assert.equal(p.encounters.length, p.count);
      seen.add(p.count);
    }
    assert.equal(seen.size, area.encounters[1] - area.encounters[0] + 1, `${area.id} uses its whole range`);
  }
});

test('every base encounter lasts 10 minutes: five encounters take 50 minutes', () => {
  const { game, clock } = makeGame();
  assert.equal(BASE_ENCOUNTER_MS, 10 * MIN);
  let exp;
  for (let i = 0; i < 40 && !exp; i++) {
    const res = game.launchExpedition('garden', partyUids(game)).expedition;
    if (res.count === 5) exp = res;
    else game.state.expeditions = [];
  }
  assert.equal(exp.encounterMs, 10 * MIN);
  assert.equal(exp.endsAt - exp.startAt, 50 * MIN);
  const tl = (dt) => expeditionTimeline(exp, exp.startAt + dt);
  assert.equal(tl(0).resolved, 0);
  assert.equal(tl(9 * MIN).current, 0);
  assert.equal(tl(10 * MIN).resolved, 1);
  assert.equal(tl(25 * MIN).current, 2);
  assert.equal(tl(25 * MIN).currentEndsAt, exp.startAt + 30 * MIN);
  assert.ok(Math.abs(tl(25 * MIN).fraction - 0.5) < 1e-9);
  assert.ok(!tl(50 * MIN - 1).done);
  assert.ok(tl(50 * MIN).done);
  assert.equal(game.claimExpedition(exp.id).ok, false, 'not before it ends');
  clock.t = exp.endsAt;
  assert.ok(game.claimExpedition(exp.id).ok);
});

test('Expedition Efficiency and speed items shorten encounters; the timer matches', () => {
  const { game } = makeGame();
  game.state.upgrades.expedition_efficiency = 5;
  game.state.bugs[0].item = 'trail_mix';
  const exp = game.launchExpedition('garden', partyUids(game)).expedition;
  const expected = Math.round(10 * MIN * (1 - 0.3) * (1 - 0.05));
  assert.equal(exp.encounterMs, expected);
  assert.equal(exp.endsAt - exp.startAt, exp.count * expected);
  assert.equal(encounterMs(game.state, game.state.bugs.slice(0, 4)), expected);
});

test('an upgrade bought mid-expedition does not change the running timer', () => {
  const { game } = makeGame();
  game.state.coins = 10000;
  const exp = game.launchExpedition('garden', partyUids(game)).expedition;
  const end = exp.endsAt;
  game.buyUpgrade('expedition_efficiency');
  assert.equal(game.state.expeditions[0].endsAt, end);
});

test('rewards are claimed exactly once and applied in full', () => {
  const { game, clock, storage } = makeGame();
  const exp = game.launchExpedition('garden', partyUids(game)).expedition;
  clock.t = exp.endsAt;
  const coins = game.state.coins;
  const total = exp.encounters.reduce((s, e) => s + e.coins, 0);
  const res = game.claimExpedition(exp.id);
  assert.ok(res.ok);
  assert.equal(game.state.coins, coins + total);
  assert.equal(game.claimExpedition(exp.id).ok, false, 'second claim refused');
  assert.equal(game.state.coins, coins + total);
  const { game: reopened } = makeGame({ storage, clock });
  assert.equal(reopened.claimExpedition(exp.id).ok, false, 'still refused after relaunch');
  assert.equal(reopened.state.coins, coins + total);
  assert.equal(reopened.state.areas.garden.runs, 1);
  assert.equal(reopened.state.history[0].id, exp.id, 'kept in history for the log');
});

test('all five areas run, resolve encounters and pay rewards', () => {
  const { game, clock } = makeGame();
  unlockAll(game);
  game.state.upgrades.improved_exploration = 0;
  for (const area of AREAS) {
    const res = game.launchExpedition(area.id, partyUids(game));
    assert.ok(res.ok, area.id);
    const exp = res.expedition;
    for (const e of exp.encounters) {
      assert.ok(e.intro && e.text, `${area.id}/${e.id} has text`);
      assert.ok(Number.isInteger(e.coins) && e.coins >= 0);
    }
    clock.t = exp.endsAt;
    const claim = game.claimExpedition(exp.id);
    assert.ok(claim.ok);
    assert.ok(claim.report.rewards.coins > 0, `${area.id} pays coins`);
  }
});

test('later areas pay more', () => {
  const { game } = makeGame();
  const party = game.state.bugs;
  const avg = (area) => {
    let c = 0;
    for (let s = 0; s < 150; s++) c += planExpedition(game.state, area, party, s).encounters.reduce((x, e) => x + e.coins, 0);
    return c / 150;
  };
  let prev = 0;
  for (const area of AREAS) {
    const a = avg(area);
    assert.ok(a > prev, `${area.id} ${a} > ${prev}`);
    prev = a;
  }
});

test('Chest Keys open locked chests, are consumed once, and are credited in the log', () => {
  const { game, clock } = makeGame();
  // Find a seed with a chest in the first garden expedition.
  game.state.bugs[0].item = 'key';
  let exp;
  for (let i = 0; i < 300 && !exp; i++) {
    const e = game.launchExpedition('garden', partyUids(game)).expedition;
    if (e.encounters.some((x) => x.category === 'chest')) exp = e;
    else game.state.expeditions = [];
  }
  assert.ok(exp, 'found a chest');
  const chests = exp.encounters.filter((x) => x.category === 'chest');
  assert.equal(chests[0].outcome, 'opened');
  assert.equal(chests[0].keyUsedBy, game.state.bugs[0].uid);
  assert.ok(chests[0].text.includes(game.state.bugs[0].name));
  if (chests[1]) assert.notEqual(chests[1].outcome, 'opened', 'one key opens one chest');
  assert.equal(game.state.bugs[0].item, 'key', 'still held until the rewards are claimed');
  clock.t = exp.endsAt;
  const res = game.claimExpedition(exp.id);
  assert.deepEqual(res.report.keysUsed, [game.state.bugs[0].uid]);
  assert.equal(game.state.bugs[0].item, null, 'key consumed');
  assert.equal(game.claimExpedition(exp.id).ok, false);
  assert.equal(game.state.inventory.key, 1, 'the spare key in the bag is untouched');
});

test('without a key, chests stay locked unless the party can force them with Lift', () => {
  const { game } = makeGame();
  const area = AREA_BY_ID.garden;
  const weak = [addBug(game, 'ant', { dig: 1 }), addBug(game, 'aphid', { cut: 1 }), addBug(game, 'moth', { fly: 1 }), addBug(game, 'tick', { fight: 1 })];
  const strong = [addBug(game, 'rhino_beetle', { lift: 12 }), addBug(game, 'stag_beetle', { lift: 10 }), addBug(game, 'ant', { lift: 8 }), addBug(game, 'bee', { fly: 1 })];
  const outcomes = (party) => {
    const out = { locked: 0, pried: 0, opened: 0 };
    for (let s = 0; s < 400; s++) for (const e of planExpedition(game.state, area, party, s).encounters) if (e.category === 'chest') out[e.outcome] += 1;
    return out;
  };
  const w = outcomes(weak);
  const s = outcomes(strong);
  assert.equal(w.opened + s.opened, 0, 'no keys, no key openings');
  assert.ok(w.locked > w.pried * 4, 'weak lifters mostly fail');
  assert.ok(s.pried > s.locked * 4, 'strong lifters usually force it');
});
