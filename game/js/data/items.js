// Items. Sprites are in data/sprites.js under the same id.
// type 'gear': equipped by one bug at a time. effects:
//   traits:        { trait: +levels } added to the wearer's trait levels
//   encounterSpeed: fraction cut from EVERY encounter of the wearer's expedition
//                   (party total capped by MAX_ITEM_SPEED). Applied when the
//                   expedition starts, so the shown timer always matches.
//   coinBonus:     + fraction of coins from expedition encounters
//   specialFind:   + chance-weight for treasure, eggs and chests
//   key:           opens one locked chest, then is used up
// type 'resource': found on expeditions and sold for coins.
// tier: how valuable a piece of gear is (ITEM_TIERS), shown in shop and bag.
// buy: price in the shop (omit for find-only items). sell: coins when sold
//      (otherwise SELL_FRACTION of the price).
// shop: { area } keeps an item out of the shop until that area is unlocked.
import { AREA_BY_ID } from './areas.js';

export const MAX_ITEM_SPEED = 0.2;
export const SELL_FRACTION = 0.3;

export const ITEM_TIERS = {
  common: { name: 'Common', color: '#94b0c2' },
  uncommon: { name: 'Uncommon', color: '#38b764' },
  rare: { name: 'Rare', color: '#41a6f6' },
  relic: { name: 'Relic', color: '#ff9b3d' },
};

export const ITEMS = {
  key:             { name: 'Chest Key',       type: 'gear', tier: 'common', sell: 40, effects: { key: true }, desc: 'Opens one locked chest found on an expedition, or a garden chest. Used up when it does.' },
  power_brace:     { name: 'Beetle Brace',    type: 'gear', tier: 'common', buy: 400, effects: { traits: { lift: 2 } }, desc: 'A tough little harness for heavy lifting.' },
  stinger_blade:   { name: 'Stinger Blade',   type: 'gear', tier: 'common', buy: 400, effects: { traits: { cut: 2 } }, desc: 'Razor-sharp. Vines don\'t stand a chance.' },
  thorn_spear:     { name: 'Thorn Spear',     type: 'gear', tier: 'common', buy: 400, effects: { traits: { fight: 2 } }, desc: 'A sharpened rose thorn.' },
  dew_wings:       { name: 'Dewdrop Wings',   type: 'gear', tier: 'common', buy: 400, effects: { traits: { fly: 2 } }, desc: 'Glistening wing-tips that catch the wind.' },
  pebble_shovel:   { name: 'Pebble Shovel',   type: 'gear', tier: 'common', buy: 400, effects: { traits: { dig: 2 } }, desc: 'A flat pebble lashed to a twig.' },
  twig_hammer:     { name: 'Twig Hammer',     type: 'gear', tier: 'common', buy: 400, effects: { traits: { build: 2 } }, desc: 'For bridges, ramps and the odd fort.' },
  acorn_cap:       { name: 'Acorn Helmet',    type: 'gear', tier: 'uncommon', buy: 700, effects: { traits: { fight: 1, lift: 1 } }, desc: 'Keeps your head safe while you push.' },
  silk_cloak:      { name: 'Silk Cloak',      type: 'gear', tier: 'uncommon', buy: 850, effects: { traits: { build: 1, fly: 1, cut: 1 } }, desc: 'Woven by a very patient spider.' },
  trail_mix:       { name: 'Trail Snacks',    type: 'gear', tier: 'uncommon', buy: 1100, effects: { encounterSpeed: 0.05 }, desc: 'Fuel for the road: the whole party\'s encounters take 5% less time.' },
  clover_charm:    { name: 'Clover Charm',    type: 'gear', tier: 'uncommon', buy: 1200, effects: { coinBonus: 0.15 }, desc: '+15% coins from the expedition.' },
  bug_net:         { name: 'Explorer\'s Net', type: 'gear', tier: 'uncommon', buy: 1400, effects: { specialFind: 0.25 }, desc: 'More treasure, chests and eggs turn up.' },
  amber_shell:     { name: 'Amber Shell',     type: 'gear', tier: 'rare', buy: 2600, effects: { traits: { lift: 3, dig: 2 } }, desc: 'Heavy, golden, nearly unbreakable.' },
  firefly_lantern: { name: 'Firefly Lantern', type: 'gear', tier: 'rare', buy: 5000, effects: { traits: { lift: 1, cut: 1, fight: 1, fly: 1, dig: 1, build: 1 } }, desc: 'A warm glow that steadies every task.' },
  moon_pendant:    { name: 'Moon Pendant',    type: 'gear', tier: 'rare', sell: 2000, effects: { traits: { lift: 2, cut: 2, fight: 2, fly: 2, dig: 2, build: 2 }, specialFind: 0.1 }, desc: 'Pulses with Aether light. Only found, never sold.' },

  // Relics: the late-game tier. Much stronger, much pricier, stocked only once
  // their area is open, and rare finds in late-area chests.
  hazmat_suit:        { name: 'Hazmat Suit',        type: 'gear', tier: 'relic', buy: 18000, shop: { area: 'chem' }, effects: { traits: { lift: 4, dig: 4, build: 4 }, encounterSpeed: 0.05 }, desc: 'Rated for anything the Chem Facility can throw at you.' },
  titan_gauntlet:     { name: 'Titan Gauntlet',     type: 'gear', tier: 'relic', buy: 24000, shop: { area: 'aether' }, effects: { traits: { lift: 7, fight: 5 } }, desc: 'Punches boulders into gravel.' },
  storm_wings:        { name: 'Storm Wings',        type: 'gear', tier: 'relic', buy: 28000, shop: { area: 'void' }, effects: { traits: { fly: 8, fight: 4 } }, desc: 'Crackling wings that ride the lightning.' },
  void_blade:         { name: 'Void Blade',         type: 'gear', tier: 'relic', buy: 32000, shop: { area: 'void' }, effects: { traits: { cut: 7, fight: 6 } }, desc: 'Cuts through things that aren\'t even there.' },
  garden_state_crown: { name: 'Garden State Crown', type: 'gear', tier: 'relic', buy: 75000, shop: { area: 'new_jersey' }, effects: { traits: { lift: 4, cut: 4, fight: 4, fly: 4, dig: 4, build: 4 }, coinBonus: 0.2 }, desc: 'Fit for the ruler of New Jersey. Nobody has ever ruled New Jersey.' },

  honey_drop:    { name: 'Honey Drop',    type: 'resource', sell: 5,   desc: 'Sweet food gathered on the trail.' },
  shiny_pebble:  { name: 'Shiny Pebble',  type: 'resource', sell: 5,   desc: 'Smooth and sparkly.' },
  dewdrop_pearl: { name: 'Dewdrop Pearl', type: 'resource', sell: 10,  desc: 'Morning mist, frozen solid.' },
  amber_chunk:   { name: 'Amber Chunk',   type: 'resource', sell: 15,  desc: 'Ancient tree sap with something inside.' },
  desert_glass:  { name: 'Crystal Shard', type: 'resource', sell: 27,  desc: 'Hums when tapped. Grows in the deep caves.' },
  ember_stone:   { name: 'Ember Stone',   type: 'resource', sell: 47,  desc: 'Still warm from the volcano.' },
  toxic_vial:    { name: 'Toxic Vial',    type: 'resource', sell: 62,  desc: 'Glows a worrying green. Collectors pay well for it.' },
  moon_crystal:  { name: 'Aether Crystal', type: 'resource', sell: 87,  desc: 'Weightless and faintly singing.' },
  void_shard:    { name: 'Void Shard',    type: 'resource', sell: 120, desc: 'A sliver of nothing, somehow heavy.' },
  pork_roll:     { name: 'Pork Roll',     type: 'resource', sell: 160, desc: 'Or Taylor Ham, depending who you ask. Priceless to the right buyer.' },
};

export const ITEM_TYPES = { gear: 'Equipment', resource: 'Resources' };

export function sellPrice(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.buy || 0) * SELL_FRACTION);
}

export function itemEffectsText(id) {
  const e = ITEMS[id]?.effects || {};
  const parts = [];
  for (const [t, v] of Object.entries(e.traits || {})) parts.push(`+${v} ${t[0].toUpperCase()}${t.slice(1)}`);
  if (e.encounterSpeed) parts.push(`-${Math.round(e.encounterSpeed * 100)}% encounter time`);
  if (e.coinBonus) parts.push(`+${Math.round(e.coinBonus * 100)}% coins`);
  if (e.specialFind) parts.push(`+${Math.round(e.specialFind * 100)}% special finds`);
  if (e.key) parts.push('Opens a locked chest');
  return parts.join(', ');
}

// Whether the shop sells this item right now (relics wait for their area).
export function itemStock(state, id) {
  const it = ITEMS[id];
  if (!it?.buy) return { ok: false, reason: 'Not sold in the shop' };
  const area = it.shop && AREA_BY_ID[it.shop.area];
  if (area && !state.areas[area.id]?.unlocked) return { ok: false, reason: `In stock once ${area.name} is open` };
  return { ok: true };
}
