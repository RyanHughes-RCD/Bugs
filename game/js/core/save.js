import { AREAS } from '../data/areas.js';
import { UPGRADES } from '../data/upgrades.js';

export const SAVE_KEY = 'bug-garden-save';
export const SAVE_VERSION = 1;

export function newGameState(now, seed) {
  const state = {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    createdAt: now,
    lastSeen: now,
    coins: 100,
    nextUid: 1,
    bugs: [],
    eggs: [],
    inventory: { honey_drop: 1, bug_net: 2, trail_mix: 1 },
    upgrades: {},
    areas: {},
    expeditions: [],
    garden: { pot: 0, lastTick: now, visitor: null, nextVisitorAt: now + 90e3 },
    shop: { rotationId: -1, bought: [] },
    dex: {},
    stats: { expeditions: 0, hatched: 0, captured: 0, coinsEarned: 0, guardians: 0 },
    flags: {},
  };
  return migrate(state);
}

// Fill in anything missing from older or hand-edited saves.
export function migrate(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  s.version = SAVE_VERSION;
  s.coins = Number.isFinite(s.coins) ? s.coins : 0;
  s.nextUid = s.nextUid || 1;
  s.bugs = Array.isArray(s.bugs) ? s.bugs : [];
  s.eggs = Array.isArray(s.eggs) ? s.eggs : [];
  s.inventory = s.inventory || {};
  s.upgrades = s.upgrades || {};
  for (const u of UPGRADES) s.upgrades[u.id] = Math.min(u.max, s.upgrades[u.id] || 0);
  s.areas = s.areas || {};
  for (const a of AREAS) {
    s.areas[a.id] = { unlocked: a.index === 0, runs: 0, guardianDefeated: false, ...(s.areas[a.id] || {}) };
  }
  s.expeditions = Array.isArray(s.expeditions) ? s.expeditions : [];
  s.garden = { pot: 0, lastTick: Date.now(), visitor: null, nextVisitorAt: 0, ...(s.garden || {}) };
  s.shop = { rotationId: -1, bought: [], ...(s.shop || {}) };
  s.dex = s.dex || {};
  s.stats = { expeditions: 0, hatched: 0, captured: 0, coinsEarned: 0, guardians: 0, ...(s.stats || {}) };
  s.flags = s.flags || {};
  for (const b of s.bugs) {
    b.traits = b.traits || [];
    b.xp = b.xp || 0;
    b.level = b.level || 1;
    b.gear = b.gear || null;
    b.restUntil = b.restUntil || 0;
  }
  return s;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  return migrate(JSON.parse(text));
}

export function encodeSave(state) {
  const json = serialize(state);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeSave(code) {
  const bin = atob(code.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
