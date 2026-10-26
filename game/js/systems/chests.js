import { AREAS, AREA_BY_ID } from '../data/areas.js';
import { ITEMS } from '../data/items.js';
import { rollDropTier } from './eggs.js';

// The area a garden chest draws from: your best open area, up to its cap.
export function gardenChestArea(state, chest) {
  const cap = AREA_BY_ID[chest.maxArea].index;
  return [...AREAS].reverse().find((a) => a.index <= cap && state.areas[a.id]?.unlocked) || AREAS[0];
}

// What a garden chest holds: fewer coins, rolls and eggs than an expedition
// chest from the same area. It rolls the same loot table, but a key or relic
// comes out as the area's everyday resource instead, so a garden chest can
// never beat an expedition chest.
export function rollGardenChest(state, chest, rng) {
  const area = gardenChestArea(state, chest);
  const table = area.chest.loot;
  const common = table.filter(([id]) => ITEMS[id].type === 'resource').sort((a, b) => b[1] - a[1])[0][0];
  const items = {};
  const n = rng.int(chest.rolls[0], chest.rolls[1]);
  for (let k = 0; k < n; k++) {
    let id = rng.weighted(table);
    if (id === 'key' || ITEMS[id].tier === 'relic') id = common;
    items[id] = (items[id] || 0) + 1;
  }
  const coins = Math.round(rng.float(0.8, 1.2) * area.coinBase * area.chest.coins * chest.coinFactor);
  const eggs = rng.chance(area.chest.eggChance * chest.eggFactor) ? [rollDropTier(area, 'chest', rng)] : [];
  return { area, coins, items, eggs };
}
