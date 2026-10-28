import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREA_BY_ID } from '../game/js/data/areas.js';
import { ITEMS } from '../game/js/data/items.js';
import { SYNERGIES, SYNERGY_IDS, TRIGGER } from '../game/js/data/synergies.js';
import { partySynergies, boostedParty, synergyScores, synergyPower, rollSynergies } from '../game/js/systems/synergies.js';
import { planExpedition, encounterMs, expeditionTimeline, tripMs, sumRewards } from '../game/js/systems/expedition.js';
import { traitTotal } from '../game/js/systems/bugs.js';
import { makeGame, addBug, HOUR } from './helpers.mjs';

const T = { lift: 3, fight: 3 };
function partyOf(species, extra = []) {
  const { game } = makeGame();
  const party = species.map((id, i) => addBug(game, id, { ...T }, extra[i] || {}));
  return { game, party };
}
const has = (party, opts) => Object.keys(partySynergies(party, opts).active);

test('each party bonus switches on for the right mix of bugs', () => {
  assert.ok(has(partyOf(['ladybug', 'weevil', 'stag_beetle', 'ant']).party).includes('shell_wall'));
  assert.ok(has(partyOf(['ladybug', 'weevil', 'stag_beetle', 'dung_beetle']).party).includes('hive_mind'));
  assert.ok(has(partyOf(['housefly', 'moth', 'bee', 'mosquito']).party).includes('tailwind'));
  assert.ok(has(partyOf(['water_strider', 'mosquito', 'ant', 'worm']).party).includes('pearl_divers'));
  assert.ok(has(partyOf(['tick', 'spider', 'housefly', 'ant']).party).includes('ambush'));
  assert.ok(has(partyOf(['worm', 'slug', 'pill_bug', 'bee']).party).includes('tunnel_network'));
  assert.ok(has(partyOf(['ant', 'ladybug', 'housefly', 'tick']).party).includes('ecosystem'));
  assert.ok(has(partyOf(['ant', 'rhino_beetle', 'bee', 'tick']).party).includes('mentor'));
  assert.ok(has(partyOf(['thunder_beetle', 'water_strider', 'ant', 'tick']).party).includes('conductor'));
  assert.ok(has(partyOf(['arcane_mite', 'ember_moth', 'ant', 'tick']).party).includes('leyline'));
  assert.ok(has(partyOf(['cricket', 'leafhopper', 'grasshopper', 'ant']).party).includes('leapfrog'));
  assert.ok(has(partyOf(['ant', 'ant', 'tick', 'bee']).party).includes('bonded'));
  assert.ok(has(partyOf(['worm', 'ant', 'grasshopper', 'bee']).party).includes('spectrum'), 'drab, common, uncommon, nice');
  // A storm dragonfly is both electric and water, but Conductor needs two bugs.
  assert.ok(!has(partyOf(['storm_dragonfly', 'ant', 'tick', 'worm']).party).includes('conductor'));
});

test('Night Shift goes by the launch hour on the device clock', () => {
  const { party } = partyOf(['moth', 'firefly', 'luna_moth', 'ant']);
  assert.ok(has(party, { hour: 23 }).includes('night_shift'));
  assert.ok(has(party, { hour: 3 }).includes('night_shift'));
  assert.ok(!has(party, { hour: 13 }).includes('night_shift'));
  assert.ok(partySynergies(party, { hour: 13 }).hints.some((h) => h.id === 'night_shift' && /9pm/.test(h.text)));
});

test('variant bonuses stack, and all three variants make Prismatic', () => {
  const { party } = partyOf(['ant', 'ant', 'tick', 'bee'], [{ variant: 'golden' }, { variant: 'golden' }, { variant: 'shiny' }, { variant: 'albino' }]);
  const { active } = partySynergies(party);
  assert.equal(active.midas.n, 2);
  assert.equal(active.lure.n, 1);
  assert.ok(active.unseen && active.prismatic);
});

test('near misses tell you what one more bug would unlock', () => {
  const { party } = partyOf(['ladybug', 'weevil', 'ant']);
  const { hints } = partySynergies(party);
  assert.ok(hints.some((h) => h.id === 'shell_wall' && h.text === '1 more beetle'));
});

test('Ecosystem and Bonded raise traits; Hive Mind shares the best; Mentor lifts weak bugs', () => {
  const eco = partyOf(['ant', 'ladybug', 'housefly', 'tick']).party;
  const { active } = partySynergies(eco);
  const boosted = boostedParty(eco, active);
  assert.equal(traitTotal(boosted[0]), traitTotal(eco[0]) + 2, '+1 to each of its two traits');
  assert.equal(eco[0].traits.lift, 3, 'the real bug is untouched');

  const twins = partyOf(['ant', 'ant', 'tick', 'bee']).party;
  const tb = boostedParty(twins, partySynergies(twins).active);
  assert.equal(tb[0].traits.lift, 5, "+2 to the ant's signature trait (lift)");

  const { game } = makeGame();
  const hive = ['ladybug', 'weevil', 'stag_beetle', 'dung_beetle'].map((id, i) => addBug(game, id, { lift: i + 1 }));
  const ha = partySynergies(hive).active;
  const scores = synergyScores(boostedParty(hive, ha), ha);
  assert.ok(scores.lift.score > synergyScores(hive, {}).lift.score);

  const mentor = partyOf(['worm', 'rhino_beetle', 'tick', 'bee']);
  mentor.party[0].traits = { dig: 1 };
  const ma = partySynergies(mentor.party).active;
  assert.ok(ma.mentor);
  assert.ok(synergyPower(mentor.party, ma) > synergyPower(mentor.party, {}));
});

test('Shell Wall turns failed checks into passes, at most twice a trip', () => {
  const { game } = makeGame();
  const weak = (id) => addBug(game, id, { dig: 1 });
  const party = [weak('ladybug'), weak('weevil'), weak('stag_beetle'), weak('ant')];
  const area = AREA_BY_ID.new_jersey;
  for (let seed = 1; seed < 20; seed++) {
    const plan = planExpedition(game.state, area, party, seed, 20);
    const saves = plan.encounters.filter((e) => e.notes?.some((n) => n.id === 'shell_wall'));
    assert.ok(saves.length <= 2);
    for (const e of saves) assert.notEqual(e.outcome, 'fail');
  }
});

test('Ambush passes every Fight check and pays double; Tailwind skips every 4th encounter', () => {
  const { game } = makeGame();
  const amb = [addBug(game, 'tick', { fight: 1 }), addBug(game, 'spider', { fight: 1 }), addBug(game, 'housefly', { fly: 1 }), addBug(game, 'ant', { lift: 1 })];
  const plan = planExpedition(game.state, AREA_BY_ID.new_jersey, amb, 7, 30);
  const fights = plan.encounters.filter((e) => e.trait === 'fight');
  assert.ok(fights.length > 0);
  for (const e of fights) assert.notEqual(e.outcome, 'fail');

  const fly = ['housefly', 'moth', 'bee', 'mosquito'].map((id) => addBug(game, id, { fly: 4 }));
  const tp = planExpedition(game.state, AREA_BY_ID.garden, fly, 3, 12);
  assert.deepEqual(tp.encounters.map((e, i) => (e.w ? i : -1)).filter((i) => i >= 0 && (i + 1) % 4 === 0), [3, 7, 11]);
  for (const i of [3, 7, 11]) assert.notEqual(tp.encounters[i].outcome, 'fail');
});

test('skipped encounters shorten the trip, and the timeline follows them', () => {
  const { game } = makeGame();
  const fly = ['housefly', 'moth', 'bee', 'mosquito'].map((id) => addBug(game, id, { fly: 4 }));
  const area = AREA_BY_ID.garden;
  const plan = planExpedition(game.state, area, fly, 3, 12);
  const encMs = encounterMs(game.state, area, fly);
  const exp = { startAt: 0, encounterMs: encMs, count: plan.count, encounters: plan.encounters };
  exp.endsAt = tripMs(exp);
  assert.ok(exp.endsAt < 12 * encMs * 0.8, 'three of twelve encounters are nearly instant');
  assert.equal(expeditionTimeline(exp, exp.endsAt).resolved, 12);
  assert.ok(expeditionTimeline(exp, exp.endsAt).done);
  // Right after the 3rd encounter, the 4th (skipped) resolves almost at once.
  const t3 = 3 * encMs;
  assert.equal(expeditionTimeline(exp, t3 + 1).resolved, 3);
  assert.equal(expeditionTimeline(exp, t3 + encMs * 0.11).resolved, 4);
});

test('an expedition without bonuses plays out exactly as before', () => {
  const { game } = makeGame();
  const party = ['ant', 'worm', 'aphid', 'housefly'].map((id) => addBug(game, id, { lift: 2 }));
  const { active } = partySynergies(party);
  assert.deepEqual(Object.keys(active).filter((id) => id !== 'spectrum'), []);
  const plan = planExpedition(game.state, AREA_BY_ID.garden, party, 11, 10);
  assert.ok(plan.encounters.every((e) => e.w === undefined && !e.notes));
});

test('Midas pays more coins; Prismatic guarantees a relic; Lure draws visitors after the trip', () => {
  const { game } = makeGame();
  const make = (variant) => ['ant', 'worm', 'aphid', 'housefly'].map((id) => addBug(game, id, { lift: 2 }, { variant }));
  const area = AREA_BY_ID.garden;
  let plain = 0;
  let gold = 0;
  for (let seed = 1; seed <= 30; seed++) {
    plain += sumRewards(planExpedition(game.state, area, make(null), seed, 10).encounters).coins;
    gold += sumRewards(planExpedition(game.state, area, make('golden'), seed, 10).encounters).coins;
  }
  assert.ok(gold > plain * 2, `${gold} vs ${plain}`);

  const prism = make(null);
  prism[0].variant = 'shiny';
  prism[1].variant = 'albino';
  prism[2].variant = 'golden';
  const pp = planExpedition(game.state, area, prism, 5, 10);
  const items = sumRewards(pp.encounters).items;
  assert.ok(Object.keys(items).some((id) => ITEMS[id].tier === 'relic'), 'a relic');

  // Launch for real with a shiny and claim: wild visitors come twice as often for an hour.
  const { game: g2, clock } = makeGame();
  const p2 = ['ant', 'worm', 'aphid', 'housefly'].map((id, i) => addBug(g2, id, { lift: 2 }, { variant: i ? null : 'shiny' }));
  const res = g2.launchExpedition('garden', p2.map((b) => b.uid), 6);
  assert.ok(res.ok, res.error);
  assert.ok(res.expedition.synergies.includes('lure'));
  clock.t = res.expedition.endsAt + 1;
  assert.ok(g2.claimExpedition(res.expedition.id).ok);
  assert.ok(g2.state.garden.lureUntil >= clock.t + SYNERGIES.lure.lureMs - 1);
});

test('night trips launched from the game use the device hour', () => {
  const { game, clock } = makeGame();
  clock.t = new Date(2026, 0, 2, 23, 30).getTime();
  const party = ['moth', 'firefly', 'luna_moth', 'ant'].map((id) => addBug(game, id, { fly: 3 }));
  const res = game.launchExpedition('garden', party.map((b) => b.uid), 6);
  assert.ok(res.ok);
  assert.ok(res.expedition.qualified.includes('night_shift'));
  assert.ok(res.expedition.endsAt - res.expedition.startAt < 6 * HOUR);
});

test('standard bonuses kick in on 25% of trips (35% with the Jar of Light); variant bonuses always', () => {
  const { game } = makeGame();
  const party = ['ladybug', 'weevil', 'stag_beetle', 'ant'].map((id, i) => addBug(game, id, { lift: 3 }, { variant: i ? null : 'golden' }));
  const rate = () => {
    let shell = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const r = rollSynergies(game.state, party, seed);
      assert.ok(r.qualified.shell_wall && r.qualified.midas);
      assert.ok(r.triggered.midas, 'Midas every time');
      if (r.triggered.shell_wall) shell++;
    }
    return shell / 4000;
  };
  assert.ok(Math.abs(rate() - TRIGGER.chance) < 0.03);
  game.state.garden.decor.jar = { x: 100, y: 300 };
  assert.ok(Math.abs(rate() - TRIGGER.jarChance) < 0.03);
});

test('a bonus that does not kick in changes nothing on the trip', () => {
  const { game } = makeGame();
  const weak = ['ladybug', 'weevil', 'stag_beetle', 'ant'].map((id) => addBug(game, id, { dig: 1 }));
  const plan = planExpedition(game.state, AREA_BY_ID.new_jersey, weak, 4, 20, { active: {} });
  assert.ok(plan.encounters.every((e) => !e.notes));
  assert.deepEqual(plan.synergies, []);
});

test('bonuses are discovered the first time a qualifying party sets off', () => {
  const { game } = makeGame();
  const party = ['ladybug', 'weevil', 'stag_beetle', 'ant'].map((id) => addBug(game, id, { lift: 3 }));
  assert.deepEqual(game.state.discovered, {});
  const res = game.launchExpedition('garden', party.map((b) => b.uid), 6);
  assert.ok(res.ok);
  assert.ok(game.state.discovered.shell_wall, 'discovered whether or not it kicked in');
  assert.ok(res.expedition.discovered.includes('shell_wall'));
  assert.ok(SYNERGY_IDS.filter((id) => game.state.discovered[id]).every((id) => res.expedition.qualified.includes(id)));
});

test('party presets: save, keep through a release, delete; limited in number', () => {
  const { game } = makeGame();
  const bugs = ['ant', 'worm', 'tick', 'bee', 'aphid'].map((id) => addBug(game, id, { lift: 2 }));
  assert.equal(game.savePreset('Too few', [bugs[0].uid]).ok, false);
  assert.equal(game.savePreset('Twice', [bugs[0].uid, bugs[0].uid, bugs[1].uid, bugs[2].uid]).ok, false);
  const res = game.savePreset('  My crew  ', bugs.slice(0, 4).map((b) => b.uid));
  assert.ok(res.ok);
  assert.equal(res.preset.name, 'My crew');
  assert.equal(game.savePreset('', bugs.slice(1, 5).map((b) => b.uid)).preset.name, 'Party 2');
  assert.ok(game.releaseBug(bugs[0].uid).ok);
  assert.equal(game.state.presets[0].party.length, 4, 'a released bug leaves a gap, nothing else changes');
  assert.ok(game.deletePreset(res.preset.id).ok);
  assert.equal(game.state.presets.length, 1);
  for (let i = 0; i < 11; i++) game.savePreset(`P${i}`, bugs.slice(1, 5).map((b) => b.uid));
  assert.equal(game.state.presets.length, 12);
  assert.equal(game.savePreset('one more', bugs.slice(1, 5).map((b) => b.uid)).ok, false);
});
