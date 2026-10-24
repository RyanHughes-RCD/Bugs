import { Rng, hashSeed } from '../core/rng.js';
import { AREAS } from '../data/areas.js';
import { ITEMS } from '../data/items.js';
import { EGGS } from '../data/eggs.js';

export const ROTATION_MS = 2 * 60 * 60e3;
export const FIXED_STOCK = ['garden_egg', 'honey_drop', 'xp_nectar', 'sugar_cube', 'warm_moss', 'bug_net', 'trail_mix', 'clover_leaf', 'smelling_salts'];

const GEAR_BY_TIER = [
  ['acorn_cap', 'thorn_spear', 'dew_wings'],
  ['dew_wings', 'silk_cloak', 'acorn_cap'],
  ['silk_cloak', 'clover_charm', 'amber_shell'],
  ['amber_shell', 'stinger_blade', 'firefly_lantern'],
  ['firefly_lantern', 'stinger_blade', 'moon_pendant'],
];

export function rotationId(now) {
  return Math.floor(now / ROTATION_MS);
}

export function priceOf(id) {
  return EGGS[id]?.price ?? ITEMS[id]?.price ?? 0;
}

// Three limited deals that change every two hours, chosen from what the
// player has unlocked. Seeded from the save seed + rotation, so they are
// stable across reloads.
export function rotatingOffers(state, now) {
  const rid = rotationId(now);
  const rng = new Rng(hashSeed(state.seed, rid));
  const open = AREAS.filter((a) => state.areas[a.id]?.unlocked);
  const tier = open.length - 1;
  const offers = [];
  offers.push({ id: rng.pick(open).eggType });
  const gear = rng.pick(GEAR_BY_TIER[tier]);
  offers.push({ id: gear });
  const roll = rng.next();
  if (tier >= 2 && roll < 0.08) offers.push({ id: 'chrysalis' });
  else if (roll < 0.3) offers.push({ id: 'golden_egg' });
  else offers.push({ id: rng.pick(GEAR_BY_TIER[Math.max(0, tier - 1)].filter((id) => id !== gear)) });
  return offers.map((o, i) => {
    const discount = rng.pick([0, 0.1, 0.2, 0.3]);
    const price = Math.round(priceOf(o.id) * (1 - discount));
    return { index: i, id: o.id, kind: EGGS[o.id] ? 'egg' : 'item', price, discount, rotationId: rid };
  });
}

export function rotationEndsAt(now) {
  return (rotationId(now) + 1) * ROTATION_MS;
}
