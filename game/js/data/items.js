// Inventory items. Sprites live in game/js/data/sprites.js under the same id.
// type: consumable (used from the bag), supply (packed for an expedition),
//       gear (equipped on one bug), treasure (sold for coins).
export const ITEMS = {
  honey_drop:     { name: 'Honey Drop',     type: 'consumable', use: 'bug',        price: 40,  desc: 'Wakes a resting bug fully healed, ready to explore.' },
  xp_nectar:      { name: 'Nectar Vial',    type: 'consumable', use: 'bug',        price: 90,  desc: 'A bug drinks it and gains 120 XP.', xp: 120 },
  sugar_cube:     { name: 'Sugar Cube',     type: 'consumable', use: 'expedition', price: 60,  desc: 'Halves the remaining time of an expedition.' },
  warm_moss:      { name: 'Warm Moss',      type: 'consumable', use: 'egg',        price: 50,  desc: 'Halves the remaining incubation time of an egg.' },

  bug_net:        { name: 'Bug Net',        type: 'supply', price: 30, desc: 'Supply: +20% capture chance for one expedition.', supply: { capture: 0.2 } },
  trail_mix:      { name: 'Trail Mix',      type: 'supply', price: 35, desc: 'Supply: heals the team 40% the first time a bug drops below half HP.', supply: { snack: 0.4 } },
  clover_leaf:    { name: 'Clover Leaf',    type: 'supply', price: 45, desc: 'Supply: +30% loot and coins for one expedition.', supply: { loot: 0.3 } },
  smelling_salts: { name: 'Smelling Salts', type: 'supply', price: 70, desc: 'Supply: revives the first bug that faints with 50% HP.', supply: { revive: 0.5 } },

  acorn_cap:       { name: 'Acorn Cap',       type: 'gear', price: 120, stats: { hp: 6, def: 4 },  desc: 'A sturdy little helmet.' },
  thorn_spear:     { name: 'Thorn Spear',     type: 'gear', price: 120, stats: { atk: 5 },         desc: 'A sharpened rose thorn.' },
  dew_wings:       { name: 'Dewdrop Wings',   type: 'gear', price: 140, stats: { spd: 6 },         desc: 'Glistening wing-tips that catch the wind.' },
  silk_cloak:      { name: 'Silk Cloak',      type: 'gear', price: 160, stats: { hp: 16 },        desc: 'Woven by a very patient spider.' },
  clover_charm:    { name: 'Clover Charm',    type: 'gear', price: 200, stats: {}, team: { loot: 0.15 }, desc: 'The team finds 15% more loot.' },
  amber_shell:     { name: 'Amber Shell',     type: 'gear', price: 260, stats: { def: 10, spd: -2 }, desc: 'Heavy, golden, nearly unbreakable.' },
  stinger_blade:   { name: 'Stinger Blade',   type: 'gear', price: 320, stats: { atk: 11, def: -2 }, desc: 'Borrowed from a scorpion. Do not ask how.' },
  firefly_lantern: { name: 'Firefly Lantern', type: 'gear', price: 380, stats: { hp: 6, atk: 4, def: 4, spd: 4 }, desc: 'A warm glow that steadies the nerves.' },
  moon_pendant:    { name: 'Moon Pendant',    type: 'gear', price: 700, stats: { hp: 16, atk: 8, def: 8, spd: 8 }, desc: 'Pulses softly with moonlight.' },

  shiny_pebble:  { name: 'Shiny Pebble',  type: 'treasure', sell: 12,  desc: 'Smooth and sparkly. A merchant will pay for it.' },
  dewdrop_pearl: { name: 'Dewdrop Pearl', type: 'treasure', sell: 25,  desc: 'A drop of morning dew, frozen solid.' },
  amber_chunk:   { name: 'Amber Chunk',   type: 'treasure', sell: 60,  desc: 'Ancient tree sap with something inside.' },
  desert_glass:  { name: 'Desert Glass',  type: 'treasure', sell: 110, desc: 'Sand fused by lightning.' },
  moon_crystal:  { name: 'Moon Crystal',  type: 'treasure', sell: 220, desc: 'Hums quietly when held up to the night sky.' },
};

export function sellPrice(itemId) {
  const it = ITEMS[itemId];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.price || 0) * 0.4);
}

export const ITEM_TYPES = {
  consumable: 'Consumables',
  supply: 'Expedition Supplies',
  gear: 'Gear',
  treasure: 'Treasures',
};
