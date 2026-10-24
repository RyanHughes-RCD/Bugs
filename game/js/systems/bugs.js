import { SPECIES } from '../data/species.js';
import { RARITIES, PRIMARY_TRAIT_BONUS } from '../data/rarities.js';
import { TRAIT_IDS } from '../data/traits.js';
import { ITEMS } from '../data/items.js';
import { BUG_NAMES, GARDEN_LIMIT, MAX_BUG_LEVEL, MAX_TRAIT_LEVEL, XP } from '../data/balance.js';

export const SHINY_CHANCE = 1 / 50;

export function rarityOf(bug) {
  return SPECIES[bug.species].rarity;
}

// Rolls a species' traits and their levels. The signature trait is always
// included; rarity decides how many traits and how strong they are.
export function rollTraits(speciesId, rng) {
  const sp = SPECIES[speciesId];
  const r = RARITIES[sp.rarity];
  const count = Math.max(1, Math.min(TRAIT_IDS.length, rng.weighted(r.traitCount)));
  const chosen = sp.traits.slice(0, count);
  const extras = rng.shuffle(TRAIT_IDS.filter((t) => !chosen.includes(t)));
  while (chosen.length < count) chosen.push(extras.shift());
  const traits = {};
  chosen.forEach((t, i) => {
    traits[t] = Math.min(MAX_TRAIT_LEVEL, rng.int(r.traitLevels[0], r.traitLevels[1]) + (i === 0 ? PRIMARY_TRAIT_BONUS : 0));
  });
  return traits;
}

export function pickName(state, rng) {
  const used = new Set(state.bugs.map((b) => b.name));
  const free = BUG_NAMES.filter((n) => !used.has(n));
  if (free.length) return rng.pick(free);
  let i = 2;
  const base = rng.pick(BUG_NAMES);
  while (used.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export function recordDex(state, speciesId) {
  const entry = state.dex[speciesId] || (state.dex[speciesId] = { caught: 0 });
  entry.caught += 1;
  return entry.caught === 1;
}

// Creates a bug, adds it to the collection and pays the first-discovery
// reward. The bug goes to the garden if there is room and placeInGarden is set.
export function createBug(state, speciesId, rng, { now = 0, origin = 'hatched', eggTier = null, placeInGarden = false, traits = null, shiny = null } = {}) {
  if (!SPECIES[speciesId]) throw new Error(`Unknown species ${speciesId}`);
  const bug = {
    uid: state.nextUid++,
    name: pickName(state, rng),
    species: speciesId,
    level: 1,
    xp: 0,
    traits: traits || rollTraits(speciesId, rng),
    shiny: shiny ?? rng.chance(SHINY_CHANCE),
    item: null,
    inGarden: false,
    origin,
    eggTier,
    obtainedAt: now,
  };
  state.bugs.push(bug);
  if (placeInGarden && gardenCount(state) < GARDEN_LIMIT) bug.inGarden = true;
  const newSpecies = recordDex(state, speciesId);
  let reward = 0;
  if (newSpecies) {
    reward = RARITIES[SPECIES[speciesId].rarity].dexReward;
    state.coins += reward;
    state.stats.coinsEarned += reward;
  }
  return { bug, newSpecies, reward };
}

// Trait levels including the equipped item. Items can grant a trait the bug
// doesn't naturally have.
export function effectiveTraits(bug) {
  const out = { ...bug.traits };
  const fx = bug.item && ITEMS[bug.item]?.effects?.traits;
  if (fx) for (const [t, v] of Object.entries(fx)) out[t] = (out[t] || 0) + v;
  return out;
}

export function itemBonus(bug, trait) {
  return (bug.item && ITEMS[bug.item]?.effects?.traits?.[trait]) || 0;
}

// Each level up raises the bug's weakest natural trait by one.
export function addXp(bug, amount) {
  const gains = [];
  if (bug.level >= MAX_BUG_LEVEL) return gains;
  bug.xp += Math.round(amount);
  while (bug.level < MAX_BUG_LEVEL && bug.xp >= XP.toNext(bug.level)) {
    bug.xp -= XP.toNext(bug.level);
    bug.level += 1;
    const order = SPECIES[bug.species].traits;
    const t = Object.keys(bug.traits)
      .filter((k) => bug.traits[k] < MAX_TRAIT_LEVEL)
      .sort((a, b) => bug.traits[a] - bug.traits[b] || (order.indexOf(a) + 9) % 9 - (order.indexOf(b) + 9) % 9)[0];
    if (t) bug.traits[t] += 1;
    gains.push({ level: bug.level, trait: t });
  }
  if (bug.level >= MAX_BUG_LEVEL) bug.xp = 0;
  return gains;
}

export function bugsOnExpedition(state) {
  const set = new Set();
  for (const e of state.expeditions) for (const uid of e.party) set.add(uid);
  return set;
}

// 'expedition' | 'garden' | 'available'
export function assignmentOf(bug, state, away = bugsOnExpedition(state)) {
  if (away.has(bug.uid)) return 'expedition';
  return bug.inGarden ? 'garden' : 'available';
}

// Garden places are reserved while a garden bug is away exploring.
export function gardenCount(state) {
  return state.bugs.filter((b) => b.inGarden).length;
}

export function releaseValue(bug) {
  return Math.round(RARITIES[rarityOf(bug)].release * (1 + 0.1 * (bug.level - 1)));
}

export function traitTotal(bug) {
  return Object.values(effectiveTraits(bug)).reduce((s, v) => s + v, 0);
}
