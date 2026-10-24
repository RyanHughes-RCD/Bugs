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
// buy: price in the shop (omit for find-only items). sell: coins when sold.
export const MAX_ITEM_SPEED = 0.2;

export const ITEMS = {
  key:             { name: 'Chest Key',       type: 'gear', sell: 40, effects: { key: true }, desc: 'Opens one locked chest found on an expedition. Used up when it does.' },
  power_brace:     { name: 'Beetle Brace',    type: 'gear', buy: 150, effects: { traits: { lift: 2 } }, desc: 'A tough little harness for heavy lifting.' },
  stinger_blade:   { name: 'Stinger Blade',   type: 'gear', buy: 150, effects: { traits: { cut: 2 } }, desc: 'Razor-sharp. Vines don\'t stand a chance.' },
  thorn_spear:     { name: 'Thorn Spear',     type: 'gear', buy: 150, effects: { traits: { fight: 2 } }, desc: 'A sharpened rose thorn.' },
  dew_wings:       { name: 'Dewdrop Wings',   type: 'gear', buy: 150, effects: { traits: { fly: 2 } }, desc: 'Glistening wing-tips that catch the wind.' },
  pebble_shovel:   { name: 'Pebble Shovel',   type: 'gear', buy: 150, effects: { traits: { dig: 2 } }, desc: 'A flat pebble lashed to a twig.' },
  twig_hammer:     { name: 'Twig Hammer',     type: 'gear', buy: 150, effects: { traits: { build: 2 } }, desc: 'For bridges, ramps and the odd fort.' },
  acorn_cap:       { name: 'Acorn Helmet',    type: 'gear', buy: 260, effects: { traits: { fight: 1, lift: 1 } }, desc: 'Keeps your head safe while you push.' },
  silk_cloak:      { name: 'Silk Cloak',      type: 'gear', buy: 320, effects: { traits: { build: 1, fly: 1, cut: 1 } }, desc: 'Woven by a very patient spider.' },
  trail_mix:       { name: 'Trail Snacks',    type: 'gear', buy: 400, effects: { encounterSpeed: 0.05 }, desc: 'Fuel for the road: the whole party\'s encounters take 5% less time.' },
  clover_charm:    { name: 'Clover Charm',    type: 'gear', buy: 450, effects: { coinBonus: 0.15 }, desc: '+15% coins from the expedition.' },
  bug_net:         { name: 'Explorer\'s Net', type: 'gear', buy: 500, effects: { specialFind: 0.25 }, desc: 'More treasure, chests and eggs turn up.' },
  amber_shell:     { name: 'Amber Shell',     type: 'gear', buy: 900, effects: { traits: { lift: 3, dig: 2 } }, desc: 'Heavy, golden, nearly unbreakable.' },
  firefly_lantern: { name: 'Firefly Lantern', type: 'gear', buy: 1800, effects: { traits: { lift: 1, cut: 1, fight: 1, fly: 1, dig: 1, build: 1 } }, desc: 'A warm glow that steadies every task.' },
  moon_pendant:    { name: 'Moon Pendant',    type: 'gear', sell: 1500, effects: { traits: { lift: 2, cut: 2, fight: 2, fly: 2, dig: 2, build: 2 }, specialFind: 0.1 }, desc: 'Pulses with Aether light. Only found, never sold.' },

  honey_drop:    { name: 'Honey Drop',    type: 'resource', sell: 8,   desc: 'Sweet food gathered on the trail.' },
  shiny_pebble:  { name: 'Shiny Pebble',  type: 'resource', sell: 12,  desc: 'Smooth and sparkly.' },
  dewdrop_pearl: { name: 'Dewdrop Pearl', type: 'resource', sell: 30,  desc: 'Morning mist, frozen solid.' },
  amber_chunk:   { name: 'Amber Chunk',   type: 'resource', sell: 45,  desc: 'Ancient tree sap with something inside.' },
  desert_glass:  { name: 'Crystal Shard', type: 'resource', sell: 80,  desc: 'Hums when tapped. Grows in the deep caves.' },
  ember_stone:   { name: 'Ember Stone',   type: 'resource', sell: 140, desc: 'Still warm from the volcano.' },
  moon_crystal:  { name: 'Aether Crystal', type: 'resource', sell: 260, desc: 'Weightless and faintly singing.' },
};

export const ITEM_TYPES = { gear: 'Equipment', resource: 'Resources' };

export function sellPrice(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.buy || 0) * 0.4);
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
