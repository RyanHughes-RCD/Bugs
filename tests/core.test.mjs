import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Rng } from '../game/js/core/rng.js';
import { SAVE_KEY, BACKUP_KEY, decodeSave, memoryStorage } from '../game/js/core/save.js';
import { SPECIES_LIST, SPECIES } from '../game/js/data/species.js';
import { RARITY_ORDER, RARITIES } from '../game/js/data/rarities.js';
import { TRAIT_IDS } from '../game/js/data/traits.js';
import { ITEMS } from '../game/js/data/items.js';
import { AREAS } from '../game/js/data/areas.js';
import { ENCOUNTERS } from '../game/js/data/encounters.js';
import { EGG_BY_ID, HATCHERY_MOTTO } from '../game/js/data/eggs.js';
import { SPRITES } from '../game/js/data/sprites.js';
import { makeGame, T0, HOUR, partyUids } from './helpers.mjs';

test('rng is deterministic and in range', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = new Rng(1);
  for (let i = 0; i < 1000; i++) {
    const n = r.int(3, 7);
    assert.ok(n >= 3 && n <= 7 && Number.isInteger(n));
  }
});

test('game data is valid: species, items, areas, encounters, sprites', () => {
  for (const s of SPECIES_LIST) {
    if (s.grid) assert.ok(SPRITES[s.grid], `${s.id} drawn sprite`);
    else assert.ok(existsSync(new URL(`../${s.sprite}`, import.meta.url)), s.sprite);
    assert.ok(s.traits.length >= 1, `${s.id} has a trait`);
    for (const t of s.traits) assert.ok(TRAIT_IDS.includes(t), `${s.id}: ${t}`);
    assert.ok(RARITY_ORDER.includes(s.rarity));
  }
  for (const r of RARITY_ORDER) assert.ok(SPECIES_LIST.some((s) => s.rarity === r), `species for ${r}`);
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(SPRITES[id], `sprite for ${id}`);
    for (const t of Object.keys(it.effects?.traits || {})) assert.ok(TRAIT_IDS.includes(t), `${id}: ${t}`);
  }
  for (const a of AREAS) {
    for (const [id] of [...a.loot, ...a.chest.loot]) assert.ok(ITEMS[id], `${a.id} loot ${id}`);
    assert.ok(EGG_BY_ID[a.eggTier], `${a.id} egg tier ${a.eggTier}`);
    assert.ok(a.encounters[0] >= 1 && a.encounters[1] >= a.encounters[0]);
    assert.ok(ENCOUNTERS.filter((e) => !e.areas || e.areas.includes(a.id)).length >= 10, `${a.id} has an encounter pool`);
  }
  for (let i = 1; i < AREAS.length; i++) {
    assert.ok(AREAS[i].difficulty > AREAS[i - 1].difficulty);
    assert.ok(AREAS[i].coinBase > AREAS[i - 1].coinBase);
    assert.ok(AREAS[i].encounters[1] >= AREAS[i - 1].encounters[1]);
  }
  for (const e of ENCOUNTERS) {
    for (const t of e.check?.traits || []) assert.ok(TRAIT_IDS.includes(t), `${e.id}: ${t}`);
    for (const id of e.areas || []) assert.ok(AREAS.some((a) => a.id === id), `${e.id}: ${id}`);
    if (e.category !== 'chest') assert.ok(e.check ? e.success && e.fail : e.result, `${e.id} has outcomes`);
  }
  for (const rows of Object.values(SPRITES)) {
    assert.equal(rows.length, 16);
    for (const row of rows) assert.equal(row.length, 16);
  }
});

test('every trait has encounters that test it', () => {
  for (const t of TRAIT_IDS) assert.ok(ENCOUNTERS.some((e) => e.check?.traits.includes(t)), t);
});

test('the hatchery motto appears in the game exactly as written', () => {
  assert.equal(HATCHERY_MOTTO, 'All bugs come from eggs. Everyone knows this.');
  const views = readFileSync(new URL('../game/js/ui/views.js', import.meta.url), 'utf8');
  assert.ok(views.includes('HATCHERY_MOTTO'));
});

test('a new game starts playable: four bugs in the garden, an egg, a key and coins', () => {
  const { game } = makeGame();
  const st = game.state;
  assert.equal(st.bugs.length, 4);
  assert.ok(st.bugs.every((b) => b.inGarden));
  assert.equal(st.eggs.length, 1);
  assert.equal(st.inventory.key, 1);
  assert.ok(st.coins >= EGG_BY_ID.common.price);
  assert.ok(st.areas.garden.unlocked);
  assert.equal(new Set(st.bugs.map((b) => b.uid)).size, 4, 'unique ids');
  for (const b of st.bugs) assert.ok(Object.keys(b.traits).length >= 1);
});

test('state survives a relaunch, including running timers and generated encounters', () => {
  const storage = memoryStorage();
  const clock = { t: T0 };
  const { game } = makeGame({ storage, clock });
  game.startIncubation(game.state.eggs[0].uid);
  const exp = game.launchExpedition('garden', partyUids(game)).expedition;
  clock.t += 5 * HOUR;
  const { game: again } = makeGame({ storage, clock });
  const exp2 = again.state.expeditions[0];
  assert.deepEqual(exp2.encounters, exp.encounters, 'encounters are not rerolled');
  assert.equal(exp2.endsAt, exp.endsAt);
  assert.ok(again.timeline(exp2).done);
  assert.ok(again.eggProgress(again.state.eggs[0]).ready);
});

test('a corrupted save falls back to the backup copy', () => {
  const storage = memoryStorage();
  const { game } = makeGame({ storage });
  game.state.coins = 4321;
  game.commit();
  makeGame({ storage }); // a successful load refreshes the backup
  storage.setItem(SAVE_KEY, '{ not json');
  const { game: again } = makeGame({ storage });
  assert.equal(again.state.coins, 4321);
  assert.ok(storage.getItem(BACKUP_KEY));
});

test('an unreadable save with no backup is kept aside, never overwritten', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{ broken');
  const clock = { t: T0 };
  makeGame({ storage, clock });
  assert.equal(storage.getItem(`${SAVE_KEY}-unreadable-${T0}`), '{ broken');
});

test('save codes round-trip and bad codes are rejected', () => {
  const { game } = makeGame();
  game.state.coins = 777;
  const code = game.exportSave();
  assert.equal(decodeSave(code).coins, 777);
  const { game: other } = makeGame({ seed: 9 });
  assert.ok(other.importSave(code).ok);
  assert.equal(other.state.coins, 777);
  assert.equal(other.importSave('not a save').ok, false);
});

test('saves from the first version are migrated without losing progress', () => {
  const v1 = {
    seed: 5, rngState: 99, coins: 50, nextUid: 20, lastSeen: T0,
    bugs: [
      { uid: 1, species: 'ant', level: 6, xp: 3, traits: ['fierce'], gear: 'thorn_spear', nickname: 'Sir Ant' },
      { uid: 2, species: 'bee', level: 1, traits: ['lucky'], gear: null, shiny: true },
    ],
    eggs: [{ uid: 3, type: 'golden_egg', startedAt: T0 - HOUR, durationMs: 2 * HOUR, bonusMs: 0 }, { uid: 4, type: 'meadow_egg', startedAt: null }],
    inventory: { sugar_cube: 2, honey_drop: 1, bug_net: 1 },
    upgrades: { training: 2 },
    areas: { meadow: { unlocked: true, runs: 4, guardianDefeated: true }, pond: { unlocked: true, runs: 1 } },
    expeditions: [{ result: { coins: 30, items: { amber_chunk: 1 }, eggs: ['pond_egg'] } }],
    dex: { ant: { seen: true, caught: 1 }, bee: { seen: true, caught: 1 } },
    stats: { expeditions: 7 }, flags: { welcomed: true },
  };
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(v1));
  const { game } = makeGame({ storage, clock: { t: T0 } });
  const st = game.state;
  assert.equal(st.version, 3);
  const ant = st.bugs.find((b) => b.uid === 1);
  assert.equal(ant.name, undefined, 'old nicknames are dropped');
  assert.equal(ant.level, undefined, 'no more levels');
  assert.equal(ant.item, 'thorn_spear');
  assert.deepEqual(Object.values(ant.traits), [2], 'a Common has one trait at level 2');
  assert.equal(st.bugs.find((b) => b.uid === 2).variant, 'shiny');
  assert.ok(st.bugs.every((b) => b.inGarden));
  const golden = st.eggs.find((e) => e.uid === 3);
  assert.equal(golden.tier, 'epic');
  assert.equal(golden.endsAt, T0 + HOUR, 'incubating egg keeps its original timer');
  assert.equal(st.eggs.find((e) => e.uid === 4).tier, 'common');
  assert.ok(st.eggs.some((e) => e.tier === 'uncommon'), 'egg from the unfinished expedition');
  assert.equal(st.inventory.sugar_cube, undefined);
  assert.equal(st.inventory.bug_net, 1);
  assert.equal(st.inventory.amber_chunk, 1);
  const refund = 2 * 24 + 30 + 100 + 175; // removed items + expedition coins + Training Log levels
  assert.equal(st.flags.migratedFromV1.refund, refund);
  assert.ok(st.coins >= 50 + refund);
  assert.ok(st.areas.forest.unlocked);
  assert.equal(st.areas.garden.runs, 4);
  assert.equal(st.stats.expeditions, 7);
});

test('v2 saves lose levels and get traits set by rarity, keeping their trait types', () => {
  const { game, storage } = makeGame();
  const st = JSON.parse(JSON.stringify(game.state));
  st.version = 2;
  st.bugs[0] = { ...st.bugs[0], level: 14, xp: 50, traits: { lift: 15 } };
  st.bugs.push({ ...st.bugs[0], uid: 900, species: 'bumblebee', level: 1, xp: 0, traits: { lift: 9, fight: 8, dig: 7 } });
  storage.setItem(SAVE_KEY, JSON.stringify(st));
  const { game: again } = makeGame({ storage });
  const [ant] = again.state.bugs;
  assert.equal(again.state.version, 3);
  assert.equal(ant.level, undefined);
  assert.deepEqual(ant.traits, { lift: 2 }, 'a maxed-out Common is back to Common strength');
  const big = again.bug(900);
  const [lo, hi] = RARITIES[SPECIES.bumblebee.rarity].traitLevels;
  assert.ok(Object.values(big.traits).every((l) => l >= lo && l <= hi));
  assert.ok(Object.keys(big.traits).includes('lift'));
  assert.equal(again.state.flags.rebalanced, true, 'the player is told once');
});
