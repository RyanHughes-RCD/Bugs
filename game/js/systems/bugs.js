import { SPECIES, RARITIES } from '../data/species.js';
import { TRAITS, TRAIT_IDS } from '../data/traits.js';
import { ITEMS } from '../data/items.js';

export const MAX_LEVEL = 40;
const STAT_KEYS = ['hp', 'atk', 'def', 'spd'];

export function xpToNext(level) {
  return Math.round(15 * Math.pow(level, 1.6));
}

export function rollTraits(rng, rarity, bonus = 0) {
  const count = rng.chance(RARITIES[rarity].traitChance2 + bonus) ? 2 : 1;
  const out = [];
  while (out.length < count) {
    const t = rng.weighted(TRAIT_IDS.filter((id) => !out.includes(id)).map((id) => [id, TRAITS[id].weight]));
    out.push(t);
  }
  return out;
}

export function recordDex(state, speciesId, kind) {
  const entry = state.dex[speciesId] || (state.dex[speciesId] = { seen: false, caught: 0 });
  const isNew = kind === 'caught' && entry.caught === 0;
  entry.seen = true;
  if (kind === 'caught') entry.caught += 1;
  return isNew;
}

// Creates a bug, adds it to the collection, updates the Bugdex and pays the
// first-discovery reward. Returns { bug, newSpecies, reward }.
export function addBug(state, speciesId, { level = 1, traits, shiny = false, origin = 'hatched', now = 0 }, rng) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species ${speciesId}`);
  const bug = {
    uid: state.nextUid++,
    species: speciesId,
    level: Math.min(MAX_LEVEL, level),
    xp: 0,
    traits: traits || rollTraits(rng, species.rarity),
    shiny: !!shiny,
    gear: null,
    restUntil: 0,
    origin,
    obtainedAt: now,
  };
  state.bugs.push(bug);
  const newSpecies = recordDex(state, speciesId, 'caught');
  let reward = 0;
  if (newSpecies) {
    reward = RARITIES[species.rarity].dexReward;
    state.coins += reward;
    state.stats.coinsEarned += reward;
  }
  return { bug, newSpecies, reward };
}

export function bugName(bug) {
  return bug.nickname || SPECIES[bug.species].name;
}

// Final stats for a bug: species base, level, traits, shiny, Training Log, gear,
// and area-specific boosts.
export function computeStats(bug, state, { areaId = null } = {}) {
  const sp = SPECIES[bug.species];
  const levelMult = 1 + 0.1 * (bug.level - 1);
  const training = 1 + 0.05 * (state.upgrades.training || 0);
  const shiny = bug.shiny ? 1.1 : 1;
  const stats = {};
  for (const k of STAT_KEYS) {
    let v = sp.base[k] * levelMult * training * shiny;
    for (const t of bug.traits) v *= TRAITS[t]?.mods?.[k] ?? 1;
    if (areaId) for (const t of bug.traits) v *= 1 + (TRAITS[t]?.areaBoost?.[areaId] ?? 0);
    stats[k] = v;
  }
  const gear = bug.gear && ITEMS[bug.gear];
  if (gear) for (const [k, v] of Object.entries(gear.stats || {})) stats[k] += v;
  for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.round(stats[k]));
  return stats;
}

export function power(stats) {
  return Math.round(stats.hp * 0.5 + stats.atk * 1.6 + stats.def * 1.1 + stats.spd * 0.8);
}

export function addXp(bug, amount) {
  let gained = 0;
  if (bug.level >= MAX_LEVEL) return 0;
  bug.xp += Math.round(amount);
  while (bug.level < MAX_LEVEL && bug.xp >= xpToNext(bug.level)) {
    bug.xp -= xpToNext(bug.level);
    bug.level += 1;
    gained += 1;
  }
  if (bug.level >= MAX_LEVEL) bug.xp = 0;
  return gained;
}

export function bugsOnExpedition(state) {
  const set = new Set();
  for (const e of state.expeditions) for (const uid of e.team) set.add(uid);
  return set;
}

export function bugStatus(bug, state, now, away = bugsOnExpedition(state)) {
  if (away.has(bug.uid)) return 'expedition';
  if (bug.restUntil > now) return 'resting';
  return 'ready';
}

// Sum of team-wide bonuses from traits and gear.
export function teamBonuses(bugs) {
  const out = { duration: 0, loot: 0, capture: 0 };
  for (const b of bugs) {
    for (const t of b.traits) for (const [k, v] of Object.entries(TRAITS[t]?.team || {})) out[k] += v;
    const g = b.gear && ITEMS[b.gear];
    if (g?.team) for (const [k, v] of Object.entries(g.team)) out[k] += v;
  }
  out.duration = Math.max(-0.3, out.duration);
  return out;
}

export function traitValue(bug, key) {
  return bug.traits.reduce((s, t) => s + (TRAITS[t]?.[key] || 0), 0);
}

export function releaseValue(bug) {
  return Math.round(RARITIES[SPECIES[bug.species].rarity].sell * (1 + 0.15 * (bug.level - 1)) * (bug.shiny ? 3 : 1));
}
