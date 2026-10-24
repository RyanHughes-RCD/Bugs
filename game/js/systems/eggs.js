import { Rng } from '../core/rng.js';
import { EGG_TIERS, EGG_BY_ID } from '../data/eggs.js';
import { SPECIES_LIST } from '../data/species.js';
import { RARITY_ORDER } from '../data/rarities.js';
import { BASE_INCUBATOR_SLOTS } from '../data/balance.js';
import { upgradeValue } from '../data/upgrades.js';

// Returns a list of problems with the egg tables (empty when valid).
export function validateEggTiers(tiers = EGG_TIERS) {
  const errors = [];
  for (const t of tiers) {
    const sum = RARITY_ORDER.reduce((s, r) => s + (t.odds[r] || 0), 0);
    if (Math.abs(sum - 100) > 1e-6) errors.push(`${t.id}: odds sum to ${sum}, not 100`);
    for (const [r, v] of Object.entries(t.odds)) {
      if (!RARITY_ORDER.includes(r)) errors.push(`${t.id}: unknown rarity ${r}`);
      if (!(v >= 0)) errors.push(`${t.id}: negative odds for ${r}`);
    }
    if ((t.odds[t.id] ?? 0) >= 100) errors.push(`${t.id}: guarantees its own rarity`);
    if (!(t.hatchMs > 0)) errors.push(`${t.id}: bad hatch time`);
    for (const r of RARITY_ORDER) if (t.odds[r] > 0 && !poolFor(t, r).length) errors.push(`${t.id}: no ${r} species in pool`);
  }
  return errors;
}

function poolFor(tier, rarity) {
  return SPECIES_LIST.filter((s) => s.rarity === rarity && (!tier.pool || tier.pool.includes(s.id))).map((s) => s.id);
}

// Hatch odds as fractions, with the species each rarity can produce.
export function eggOdds(tierId) {
  const tier = EGG_BY_ID[tierId];
  return RARITY_ORDER.map((r) => ({ rarity: r, chance: (tier.odds[r] || 0) / 100, species: poolFor(tier, r) }));
}

export function rollEgg(tierId, rng) {
  const odds = eggOdds(tierId).filter((o) => o.chance > 0 && o.species.length);
  const rarity = rng.weighted(odds.map((o) => [o.rarity, o.chance]));
  const speciesId = rng.pick(odds.find((o) => o.rarity === rarity).species);
  return { rarity, speciesId };
}

// Developer tool: hatch n eggs on a private RNG without touching game state.
export function simulateHatches(tierId, n, seed = 1) {
  const rng = new Rng(seed);
  const counts = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0]));
  for (let i = 0; i < n; i++) counts[rollEgg(tierId, rng).rarity]++;
  return counts;
}

export function incubationMs(state, tierId) {
  return Math.round(EGG_BY_ID[tierId].hatchMs * (1 - upgradeValue(state, 'faster_incubation')));
}

export function incubatorCount(state) {
  return BASE_INCUBATOR_SLOTS + upgradeValue(state, 'incubator_slots');
}

export function eggProgress(egg, now) {
  if (!egg.startedAt) return { incubating: false, ready: false, fraction: 0, remainingMs: 0, endsAt: null };
  const total = egg.endsAt - egg.startedAt;
  const remainingMs = Math.max(0, egg.endsAt - now);
  return { incubating: true, ready: now >= egg.endsAt, fraction: total > 0 ? Math.min(1, Math.max(0, (now - egg.startedAt) / total)) : 1, remainingMs, endsAt: egg.endsAt };
}
