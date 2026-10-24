// Expedition areas in progression order.
// difficulty: baseline for trait checks (see balance.js TRAIT_CHECK).
// encounters: [min, max] encounter count, rolled when an expedition starts.
// coinBase: coins for a typical successful encounter before modifiers.
// unlock: completed expeditions needed in the previous area, plus a coin fee.
// art: { image } uses real art from the project; { scene } falls back to a
//      generated pixel banner (bugs-map only contains the garden map).
// loot / eggs / chest: weighted reward tables for this area.
export const AREAS = [
  {
    id: 'garden', name: 'The Garden', difficulty: 2, encounters: [3, 5], coinBase: 15,
    unlock: { runs: 0, coins: 0 },
    art: { image: 'BugsMap/pixil-layer-0.png', scene: 'garden' },
    loot: [['honey_drop', 30], ['shiny_pebble', 30], ['key', 10], ['power_brace', 3], ['stinger_blade', 3], ['thorn_spear', 3], ['dew_wings', 3], ['pebble_shovel', 3], ['twig_hammer', 3]],
    eggs: [['common', 95], ['uncommon', 5]],
    chest: { coins: 4, eggChance: 0.12, eggs: [['common', 80], ['uncommon', 18], ['rare', 2]], loot: [['key', 10], ['acorn_cap', 15], ['silk_cloak', 10], ['dew_wings', 15], ['power_brace', 15], ['shiny_pebble', 30]] },
    desc: 'Friendly paths through your own backyard. Low risk, simple obstacles, common finds.',
  },
  {
    id: 'forest', name: 'The Misty Forest', difficulty: 4, encounters: [4, 6], coinBase: 25,
    unlock: { runs: 3, coins: 300 },
    art: { scene: 'forest' },
    loot: [['honey_drop', 20], ['dewdrop_pearl', 30], ['amber_chunk', 10], ['key', 10], ['stinger_blade', 4], ['twig_hammer', 4], ['acorn_cap', 3], ['silk_cloak', 3], ['trail_mix', 2]],
    eggs: [['common', 70], ['uncommon', 27], ['rare', 3]],
    chest: { coins: 4, eggChance: 0.15, eggs: [['common', 40], ['uncommon', 50], ['rare', 10]], loot: [['key', 10], ['silk_cloak', 15], ['trail_mix', 15], ['clover_charm', 10], ['amber_chunk', 30]] },
    desc: 'Vines, fallen trees and hidden paths wrapped in fog.',
  },
  {
    id: 'caves', name: 'The Crystal Caves', difficulty: 6, encounters: [5, 7], coinBase: 45,
    unlock: { runs: 3, coins: 1200 },
    art: { scene: 'caves' },
    loot: [['desert_glass', 30], ['amber_chunk', 15], ['key', 12], ['pebble_shovel', 5], ['power_brace', 5], ['amber_shell', 2], ['bug_net', 2]],
    eggs: [['common', 30], ['uncommon', 55], ['rare', 14], ['epic', 1]],
    chest: { coins: 4, eggChance: 0.18, eggs: [['uncommon', 60], ['rare', 35], ['epic', 5]], loot: [['key', 10], ['amber_shell', 15], ['bug_net', 15], ['clover_charm', 15], ['desert_glass', 30]] },
    desc: 'Underground passages, heavy rocks and glittering crystal seams.',
  },
  {
    id: 'volcano', name: 'The Volcano', difficulty: 8, encounters: [6, 8], coinBase: 80,
    unlock: { runs: 3, coins: 4000 },
    art: { scene: 'volcano' },
    loot: [['ember_stone', 30], ['desert_glass', 10], ['key', 12], ['thorn_spear', 4], ['amber_shell', 3], ['firefly_lantern', 1], ['clover_charm', 3]],
    eggs: [['uncommon', 45], ['rare', 45], ['epic', 9], ['legendary', 1]],
    chest: { coins: 4, eggChance: 0.2, eggs: [['rare', 60], ['epic', 35], ['legendary', 5]], loot: [['key', 10], ['firefly_lantern', 10], ['amber_shell', 15], ['bug_net', 15], ['ember_stone', 30]] },
    desc: 'Lava crossings, unstable ledges and fierce creatures guarding rich rewards.',
  },
  {
    id: 'aether', name: 'The Aether', difficulty: 10, encounters: [7, 10], coinBase: 140,
    unlock: { runs: 3, coins: 12000 },
    art: { scene: 'aether' },
    loot: [['moon_crystal', 30], ['ember_stone', 10], ['key', 12], ['firefly_lantern', 2], ['moon_pendant', 1], ['bug_net', 3]],
    eggs: [['rare', 50], ['epic', 38], ['legendary', 10], ['mythic', 2]],
    chest: { coins: 4, eggChance: 0.22, eggs: [['epic', 55], ['legendary', 35], ['mythic', 9], ['celestial', 1]], loot: [['key', 10], ['moon_pendant', 8], ['firefly_lantern', 15], ['moon_crystal', 30]] },
    desc: 'Floating islands above the clouds. Strange challenges, exceptional treasure.',
  },
];

AREAS.forEach((a, i) => { a.index = i; });
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
