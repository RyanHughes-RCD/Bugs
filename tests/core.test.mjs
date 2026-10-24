import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../game/js/core/rng.js';
import { SAVE_KEY, newGameState, migrate, encodeSave, decodeSave, memoryStorage } from '../game/js/core/save.js';
import { SPECIES_LIST } from '../game/js/data/species.js';
import { ITEMS } from '../game/js/data/items.js';
import { AREAS } from '../game/js/data/areas.js';
import { SPRITES } from '../game/js/data/sprites.js';
import { existsSync } from 'node:fs';
import { makeGame, T0 } from './helpers.mjs';

test('rng is deterministic and in range', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const r = new Rng(1);
  for (let i = 0; i < 1000; i++) {
    const n = r.int(3, 7);
    assert.ok(n >= 3 && n <= 7 && Number.isInteger(n));
  }
  const counts = { x: 0, y: 0 };
  for (let i = 0; i < 4000; i++) counts[r.weighted([['x', 3], ['y', 1]])]++;
  assert.ok(counts.x > counts.y * 2.4 && counts.x < counts.y * 3.6);
});

test('every species and egg sprite asset exists', () => {
  assert.equal(SPECIES_LIST.length, 55);
  for (const s of SPECIES_LIST) assert.ok(existsSync(new URL(`../${s.sprite}`, import.meta.url)), s.sprite);
  assert.ok(existsSync(new URL('../8x/chrysalis.png', import.meta.url)));
  assert.ok(existsSync(new URL('../BugsMap/pixil-layer-0.png', import.meta.url)));
  for (const id of Object.keys(ITEMS)) assert.ok(SPRITES[id], `sprite for ${id}`);
  for (const rows of Object.values(SPRITES)) {
    assert.equal(rows.length, 16);
    for (const row of rows) assert.equal(row.length, 16);
  }
});

test('every area has species, loot and a guardian', () => {
  assert.equal(AREAS.length, 5);
  for (const a of AREAS) {
    assert.ok(SPECIES_LIST.some((s) => s.habitats.includes(a.id)), a.id);
    assert.ok(SPECIES_LIST.find((s) => s.id === a.guardian.species));
    for (const [id] of a.loot) assert.ok(ITEMS[id], `${a.id} loot ${id}`);
  }
});

test('new game starts with four bugs, an incubating egg and starter items', () => {
  const { game } = makeGame();
  const st = game.state;
  assert.equal(st.bugs.length, 4);
  assert.equal(st.coins, 100);
  assert.equal(st.eggs.length, 1);
  assert.ok(st.eggs[0].startedAt);
  assert.ok(st.areas.meadow.unlocked);
  assert.ok(!st.areas.pond.unlocked);
  for (const b of st.bugs) assert.ok(b.traits.length >= 1);
});

test('state is saved and restored, including running timers', () => {
  const storage = memoryStorage();
  const clock = { t: T0 };
  const { game } = makeGame({ storage, clock });
  const res = game.launchExpedition('meadow', game.state.bugs.map((b) => b.uid));
  assert.ok(res.ok);
  const json = storage.getItem(SAVE_KEY);
  assert.ok(json.includes('"expeditions"'));

  clock.t += 10 * 60e3; // ten minutes "offline"
  const { game: again } = makeGame({ storage, clock });
  assert.equal(again.state.expeditions.length, 1);
  assert.ok(again.expeditionProgress(again.state.expeditions[0]).done);
  assert.ok(again.eggProgress(again.state.eggs[0]).ready);
  assert.ok(again.collectExpedition(again.state.expeditions[0].id).ok);
});

test('old or partial saves are migrated with defaults', () => {
  const st = migrate({ coins: 5, bugs: [{ uid: 1, species: 'ant' }], seed: 3 });
  assert.equal(st.coins, 5);
  assert.deepEqual(st.bugs[0].traits, []);
  assert.equal(st.bugs[0].level, 1);
  assert.equal(st.upgrades.nursery, 0);
  assert.ok(st.areas.meadow.unlocked);
  assert.ok(st.garden && st.shop && st.dex);
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
  assert.equal(encodeSave(newGameState(T0, 1)).length > 10, true);
});
