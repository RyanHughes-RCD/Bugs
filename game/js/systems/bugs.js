import { SPECIES } from '../data/species.js';
import { RARITIES, VARIANTS } from '../data/rarities.js';
import { TRAIT_IDS } from '../data/traits.js';
import { ITEMS } from '../data/items.js';
import { GARDEN_LIMIT, MAX_TRAIT_LEVEL } from '../data/balance.js';
import { upgradeValue } from '../data/upgrades.js';

// Rolls the extra luck layer on top of rarity: null, or a VARIANTS key.
export function rollVariant(rng) {
  let r = rng.next();
  for (const [id, v] of Object.entries(VARIANTS)) {
    if (r < v.chance) return id;
    r -= v.chance;
  }
  return null;
}

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
  for (const t of chosen) traits[t] = Math.min(MAX_TRAIT_LEVEL, rng.int(r.traitLevels[0], r.traitLevels[1]));
  return traits;
}

// What a bug is called: its species, prefixed by any colour variant
// ("Golden Ladybug"). Bugs have no individual nicknames.
export function bugName(bug) {
  const v = VARIANTS[bug.variant];
  return `${v ? `${v.name} ` : ''}${SPECIES[bug.species].name}`;
}

export function recordDex(state, speciesId, variant = null) {
  const entry = state.dex[speciesId] || (state.dex[speciesId] = { caught: 0 });
  entry.caught += 1;
  if (variant) entry.variants = { ...(entry.variants || {}), [variant]: true };
  return entry.caught === 1;
}

// Creates a bug, adds it to the collection and pays the first-discovery
// reward. The bug goes to the garden if there is room and placeInGarden is set.
export function createBug(state, speciesId, rng, { now = 0, origin = 'hatched', eggTier = null, placeInGarden = false, traits = null, variant } = {}) {
  if (!SPECIES[speciesId]) throw new Error(`Unknown species ${speciesId}`);
  const bug = {
    uid: state.nextUid++,
    species: speciesId,
    traits: traits || rollTraits(speciesId, rng),
    variant: variant === undefined ? rollVariant(rng) : variant,
    item: null,
    inGarden: false,
    origin,
    eggTier,
    obtainedAt: now,
  };
  state.bugs.push(bug);
  if (placeInGarden && gardenCount(state) < gardenLimit(state)) bug.inGarden = true;
  const newSpecies = recordDex(state, speciesId, bug.variant);
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

// How many bugs can live in the garden: 10, plus 5 per Bigger Garden level.
export function gardenLimit(state) {
  return GARDEN_LIMIT + upgradeValue(state, 'garden_space');
}

// Garden places are reserved while a garden bug is away exploring.
export function gardenCount(state) {
  return state.bugs.filter((b) => b.inGarden).length;
}

export function releaseValue(bug) {
  const mult = VARIANTS[bug.variant]?.releaseMult || 1;
  return Math.round(RARITIES[rarityOf(bug)].release * mult);
}

export function traitTotal(bug) {
  return Object.values(effectiveTraits(bug)).reduce((s, v) => s + v, 0);
}
