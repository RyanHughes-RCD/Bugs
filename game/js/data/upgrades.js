// Permanent upgrades bought with coins. cost(level) = base * growth^level.
export const UPGRADES = [
  { id: 'nursery',        name: 'Nursery Plots',    max: 3,  base: 120, growth: 3,    desc: '+1 egg incubation slot.',             effect: (l) => `${1 + l} egg slot${l ? 's' : ''}` },
  { id: 'warm_soil',      name: 'Warm Soil',        max: 5,  base: 80,  growth: 2.1,  desc: '-10% egg incubation time.',            effect: (l) => `-${l * 10}% incubation` },
  { id: 'clover_patch',   name: 'Four-Leaf Patch',  max: 5,  base: 150, growth: 2.3,  desc: 'Better odds of rare hatches.',         effect: (l) => `+${l * 8} hatch luck` },
  { id: 'training',       name: 'Training Log',     max: 10, base: 100, growth: 1.75, desc: '+5% stats for every bug.',             effect: (l) => `+${l * 5}% stats` },
  { id: 'trail_maps',     name: 'Trail Maps',       max: 5,  base: 100, growth: 2.1,  desc: '-8% expedition time.',                 effect: (l) => `-${l * 8}% expedition time` },
  { id: 'explorer_pack',  name: "Explorer's Pack",  max: 5,  base: 120, growth: 2,    desc: '+10% expedition loot and coins.',      effect: (l) => `+${l * 10}% loot` },
  { id: 'silk_nets',      name: 'Silk Nets',        max: 5,  base: 100, growth: 2.1,  desc: '+5% capture chance.',                  effect: (l) => `+${l * 5}% capture` },
  { id: 'bloom',          name: 'Blooming Garden',  max: 10, base: 60,  growth: 1.65, desc: '+15% garden coin income.',             effect: (l) => `+${l * 15}% income` },
  { id: 'coin_jar',       name: 'Coin Jar',         max: 8,  base: 50,  growth: 1.8,  desc: '+150 garden coin storage.',            effect: (l) => `${200 + l * 150} storage` },
  { id: 'leaf_bed',       name: 'Leaf Beds',        max: 5,  base: 80,  growth: 2,    desc: '-12% bug rest time.',                  effect: (l) => `-${l * 12}% rest` },
  { id: 'camp',           name: 'Base Camp',        max: 2,  base: 500, growth: 4,    desc: '+1 expedition at the same time.',      effect: (l) => `${1 + l} expedition${l ? 's' : ''}` },
  { id: 'satchel',        name: 'Supply Satchel',   max: 2,  base: 200, growth: 3,    desc: '+1 supply slot per expedition.',       effect: (l) => `${1 + l} supply slot${l ? 's' : ''}` },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(id, level) {
  const u = UPGRADE_BY_ID[id];
  if (!u || level >= u.max) return Infinity;
  return Math.round(u.base * Math.pow(u.growth, level));
}
