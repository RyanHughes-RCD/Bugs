import { EGGS, BASE_SHINY_CHANCE } from '../data/eggs.js';
import { SPECIES_LIST, RARITIES, RARITY_ORDER } from '../data/species.js';
import { AREAS } from '../data/areas.js';
import { rollTraits } from './bugs.js';

export function nurseryCapacity(state) {
  return 1 + (state.upgrades.nursery || 0);
}

export function incubationMs(state, type) {
  return Math.round(EGGS[type].hatchMs * (1 - 0.1 * (state.upgrades.warm_soil || 0)));
}

export function hatchLuck(state, type) {
  return EGGS[type].rarityBonus + 0.08 * (state.upgrades.clover_patch || 0);
}

export function eggPool(state, type) {
  const egg = EGGS[type];
  if (egg.pool === 'area') return SPECIES_LIST.filter((s) => s.habitats.includes(egg.area));
  if (egg.pool === 'unlocked') {
    const open = AREAS.filter((a) => state.areas[a.id]?.unlocked).map((a) => a.id);
    return SPECIES_LIST.filter((s) => s.habitats.some((h) => open.includes(h)));
  }
  return SPECIES_LIST;
}

// Effective hatch odds per rarity, after redirecting rarities the pool lacks
// to the nearest rarity it has (lower first). These are exactly the odds used
// by rollHatch and the numbers shown in the UI.
export function hatchOdds(state, type) {
  const egg = EGGS[type];
  const pool = eggPool(state, type);
  const luck = hatchLuck(state, type);
  const minIdx = egg.minRarity ? RARITY_ORDER.indexOf(egg.minRarity) : 0;
  const byRarity = Object.fromEntries(RARITY_ORDER.map((r) => [r, pool.filter((s) => s.rarity === r).map((s) => s.id)]));
  const weights = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0]));
  RARITY_ORDER.forEach((r, i) => {
    if (i < minIdx) return;
    const w = RARITIES[r].weight * Math.exp(luck * i);
    let target = null;
    for (let d = 0; d < RARITY_ORDER.length && !target; d++) {
      for (const j of [i - d, i + d]) {
        if (j >= minIdx && j < RARITY_ORDER.length && byRarity[RARITY_ORDER[j]].length) { target = RARITY_ORDER[j]; break; }
      }
    }
    if (target) weights[target] += w;
  });
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const odds = RARITY_ORDER.map((r) => ({ rarity: r, chance: total ? weights[r] / total : 0, species: byRarity[r] }));
  return { odds, shinyChance: shinyChance(type) };
}

export function shinyChance(type) {
  return BASE_SHINY_CHANCE * (EGGS[type].shinyMult || 1);
}

export function rollHatch(state, type, rng) {
  const { odds } = hatchOdds(state, type);
  const rarity = rng.weighted(odds.filter((o) => o.chance > 0).map((o) => [o.rarity, o.chance]));
  const options = odds.find((o) => o.rarity === rarity).species;
  const speciesId = rng.pick(options);
  const traits = rollTraits(rng, rarity, EGGS[type].traitBonus || 0);
  const shiny = rng.chance(shinyChance(type));
  return { speciesId, traits, shiny, rarity };
}

export function eggProgress(egg, now) {
  if (!egg.startedAt) return { incubating: false, ready: false, fraction: 0, remainingMs: egg.durationMs || 0, endsAt: null };
  const elapsed = now - egg.startedAt + (egg.bonusMs || 0);
  const fraction = Math.min(1, Math.max(0, elapsed / egg.durationMs));
  const remainingMs = Math.max(0, egg.durationMs - elapsed);
  return { incubating: true, ready: fraction >= 1, fraction, remainingMs, endsAt: now + remainingMs };
}
