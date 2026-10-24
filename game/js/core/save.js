import { AREAS } from '../data/areas.js';
import { UPGRADES } from '../data/upgrades.js';
import { STARTING } from '../data/balance.js';
import { migrateV1 } from './migrate-v1.js';
import { defaultRock } from '../systems/garden.js';
import { rollTraits } from '../systems/bugs.js';
import { RARITIES } from '../data/rarities.js';
import { SPECIES } from '../data/species.js';
import { Rng } from './rng.js';

export const SAVE_KEY = 'bug-garden-save';
export const BACKUP_KEY = 'bug-garden-save-backup';
export const SAVE_VERSION = 3;

export function newGameState(now, seed) {
  return migrate({
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    createdAt: now,
    lastSeen: now,
    coins: STARTING.coins,
    nextUid: 1,
    bugs: [],
    eggs: [],
    inventory: { ...STARTING.items },
    upgrades: {},
    areas: {},
    expeditions: [],
    history: [],
    garden: { pot: 0, lastTick: now, rock: defaultRock(now), welts: [], visitors: [], nextVisitAt: 0 },
    dex: {},
    stats: {},
    flags: {},
  });
}

// Brings any save up to the current version and fills in missing fields.
export function migrate(raw) {
  let s = raw && typeof raw === 'object' ? raw : {};
  if (!s.version || s.version < 2) s = migrateV1(s);
  const fromVersion = s.version || SAVE_VERSION;
  s.version = SAVE_VERSION;
  s.coins = Number.isFinite(s.coins) && s.coins >= 0 ? Math.floor(s.coins) : 0;
  s.nextUid = s.nextUid || 1;
  s.bugs = Array.isArray(s.bugs) ? s.bugs : [];
  s.eggs = Array.isArray(s.eggs) ? s.eggs : [];
  s.inventory = s.inventory || {};
  for (const [k, v] of Object.entries(s.inventory)) if (!(v > 0)) delete s.inventory[k];
  s.upgrades = s.upgrades || {};
  for (const u of UPGRADES) s.upgrades[u.id] = Math.max(0, Math.min(u.max, Math.floor(s.upgrades[u.id] || 0)));
  s.areas = s.areas || {};
  for (const a of AREAS) s.areas[a.id] = { unlocked: a.index === 0, runs: 0, ...(s.areas[a.id] || {}) };
  s.expeditions = Array.isArray(s.expeditions) ? s.expeditions : [];
  s.history = Array.isArray(s.history) ? s.history : [];
  s.garden = { pot: 0, lastTick: s.lastSeen || 0, welts: [], visitors: [], nextVisitAt: 0, ...(s.garden || {}) };
  if (!s.garden.rock) s.garden.rock = defaultRock(s.lastSeen || 0);
  s.dex = s.dex || {};
  s.stats = { expeditions: 0, hatched: 0, eggsBought: 0, chestsOpened: 0, coinsEarned: 0, visitorsGreeted: 0, rockFinds: 0, ...(s.stats || {}) };
  s.flags = s.flags || {};
  for (const b of s.bugs) {
    b.traits = b.traits && typeof b.traits === 'object' && !Array.isArray(b.traits) ? b.traits : {};
    b.item = b.item || null;
    b.inGarden = !!b.inGarden;
    if (b.variant === undefined) b.variant = b.shiny ? 'shiny' : null;
    delete b.shiny;
    delete b.name; // bugs no longer have nicknames
    delete b.level; // v3: no more levels, rarity sets strength
    delete b.xp;
  }
  if (fromVersion < 3) rebalanceTraits(s);
  return s;
}

// v3 made rarity, not levels, decide a bug's strength. Each bug keeps the
// traits it had where it can, re-rolled at its rarity's new levels.
function rebalanceTraits(s) {
  for (const b of s.bugs) {
    if (!SPECIES[b.species]) continue;
    const rng = new Rng((s.seed || 1) * 31 + b.uid);
    const fresh = rollTraits(b.species, rng);
    const [lo, hi] = RARITIES[SPECIES[b.species].rarity].traitLevels;
    const keys = [...new Set([...Object.keys(b.traits), ...Object.keys(fresh)])].slice(0, Object.keys(fresh).length);
    b.traits = Object.fromEntries(keys.map((t) => [t, rng.int(lo, hi)]));
  }
  for (const e of s.expeditions) delete e.xp;
  s.flags.rebalanced = true;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  return migrate(JSON.parse(text));
}

export function encodeSave(state) {
  const bytes = new TextEncoder().encode(serialize(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeSave(code) {
  const bin = atob(code.trim());
  return deserialize(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
