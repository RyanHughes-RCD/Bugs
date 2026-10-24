import { SPECIES, RARITIES, SPECIES_LIST } from '../data/species.js';
import { AREAS } from '../data/areas.js';
import { bugsOnExpedition, traitValue } from './bugs.js';
import { BASE_SHINY_CHANCE } from '../data/eggs.js';

export const VISITOR_STAY_MS = 3 * 60e3;
export const VISITOR_GAP_MS = [4 * 60e3, 8 * 60e3];

export function gardenCap(state) {
  return 200 + 150 * (state.upgrades.coin_jar || 0);
}

// Bugs at home (ready or resting) earn coins every minute, by rarity and level.
export function bugIncomePerMin(bug) {
  return RARITIES[SPECIES[bug.species].rarity].income * (1 + 0.05 * (bug.level - 1)) * (1 + traitValue(bug, 'garden'));
}

export function gardenRatePerMin(state) {
  const away = bugsOnExpedition(state);
  const base = state.bugs.filter((b) => !away.has(b.uid)).reduce((s, b) => s + bugIncomePerMin(b), 0);
  return base * (1 + 0.15 * (state.upgrades.bloom || 0));
}

// Advances garden time: coin pot (capped), wild visitors arriving and leaving.
// Works for any gap, so it also handles offline time on load.
export function tickGarden(state, now, rng) {
  const g = state.garden;
  const dt = Math.max(0, now - g.lastTick);
  const cap = gardenCap(state);
  const before = g.pot;
  if (g.pot < cap) g.pot = Math.min(cap, g.pot + gardenRatePerMin(state) * dt / 60e3);
  g.lastTick = now;
  if (g.visitor && now >= g.visitor.expiresAt) g.visitor = null;
  if (!g.visitor && now >= g.nextVisitorAt) {
    g.visitor = spawnVisitor(state, now, rng);
    g.nextVisitorAt = now + rng.int(VISITOR_GAP_MS[0], VISITOR_GAP_MS[1]);
  }
  return g.pot - before;
}

export function spawnVisitor(state, now, rng) {
  const open = AREAS.filter((a) => state.areas[a.id]?.unlocked).map((a) => a.id);
  const pool = SPECIES_LIST.filter((s) => s.habitats.some((h) => open.includes(h)) && ['common', 'uncommon', 'rare'].includes(s.rarity));
  const speciesId = rng.weighted(pool.map((s) => [s.id, RARITIES[s.rarity].weight]));
  const topArea = AREAS.filter((a) => open.includes(a.id)).pop();
  return {
    species: speciesId,
    level: rng.int(1, Math.max(1, topArea.levels[0])),
    shiny: rng.chance(BASE_SHINY_CHANCE),
    expiresAt: now + VISITOR_STAY_MS,
  };
}
