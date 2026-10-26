// Expedition areas in progression order.
// difficulty: baseline for trait checks (see balance.js TRAIT_CHECK).
// encounters: [min, max] encounter count, rolled when an expedition starts.
// coinBase: coins for a typical successful encounter before modifiers.
// pace: { power, steep }: the party power this area suits, and how sharply
//       encounters slow down for weaker parties (see balance.js PACE).
// unlock: completed expeditions needed in the previous area, plus a coin fee.
// name: shown everywhere; fullName (optional): the long name, shown on the area card.
// art: { image } uses real art from the project; { scene } falls back to a
//      generated pixel banner (bugs-map only contains the garden map).
// eggTier: the egg this area usually gives. Each egg found rolls its tier:
//          usually this one, rarely up to 3 tiers higher (balance.js EGG_DROPS).
// loot / chest: weighted reward tables for this area.
export const AREAS = [
  {
    id: 'garden', name: 'The Garden', difficulty: 2, encounters: [6, 10], coinBase: 18, pace: { power: 8, steep: 0.5 },
    unlock: { runs: 0, coins: 0 },
    art: { image: 'BugsMap/pixil-layer-0.png', scene: 'garden' },
    loot: [['honey_drop', 30], ['shiny_pebble', 30], ['key', 10], ['power_brace', 1], ['stinger_blade', 1], ['thorn_spear', 1], ['dew_wings', 1], ['pebble_shovel', 1], ['twig_hammer', 1]],
    eggTier: 'common',
    chest: { coins: 4, eggChance: 0.06, loot: [['key', 10], ['acorn_cap', 6], ['silk_cloak', 4], ['dew_wings', 6], ['power_brace', 6], ['shiny_pebble', 40]] },
    desc: 'Friendly paths through your own backyard. Low risk, simple obstacles, common finds.',
  },
  {
    id: 'forest', name: 'The Misty Forest', difficulty: 4, encounters: [8, 12], coinBase: 22, pace: { power: 16, steep: 0.75 },
    unlock: { runs: 3, coins: 300 },
    art: { scene: 'forest' },
    loot: [['honey_drop', 20], ['dewdrop_pearl', 30], ['amber_chunk', 10], ['key', 10], ['stinger_blade', 1.5], ['twig_hammer', 1.5], ['acorn_cap', 1], ['silk_cloak', 1], ['trail_mix', 0.7]],
    eggTier: 'uncommon',
    chest: { coins: 4, eggChance: 0.08, loot: [['key', 10], ['silk_cloak', 6], ['trail_mix', 5], ['clover_charm', 4], ['amber_chunk', 40]] },
    desc: 'Vines, fallen trees and hidden paths wrapped in fog.',
  },
  {
    id: 'caves', name: 'The Crystal Caves', difficulty: 6, encounters: [10, 14], coinBase: 28, pace: { power: 32, steep: 1.0 },
    unlock: { runs: 3, coins: 1200 },
    art: { scene: 'caves' },
    loot: [['desert_glass', 30], ['amber_chunk', 15], ['key', 12], ['pebble_shovel', 1.5], ['power_brace', 1.5], ['amber_shell', 0.6], ['bug_net', 0.6]],
    eggTier: 'nice',
    chest: { coins: 4, eggChance: 0.09, loot: [['key', 10], ['amber_shell', 4], ['bug_net', 6], ['clover_charm', 6], ['desert_glass', 40]] },
    desc: 'Underground passages, heavy rocks and glittering crystal seams.',
  },
  {
    id: 'volcano', name: 'The Volcano', difficulty: 9, encounters: [12, 16], coinBase: 36, pace: { power: 60, steep: 1.25 },
    unlock: { runs: 3, coins: 4000 },
    art: { scene: 'volcano' },
    loot: [['ember_stone', 30], ['desert_glass', 10], ['key', 12], ['thorn_spear', 1.2], ['amber_shell', 1], ['firefly_lantern', 0.3], ['clover_charm', 1]],
    eggTier: 'rare',
    chest: { coins: 4, eggChance: 0.1, loot: [['key', 10], ['firefly_lantern', 3], ['amber_shell', 6], ['bug_net', 6], ['ember_stone', 40]] },
    desc: 'Lava crossings, unstable ledges and fierce creatures guarding rich rewards.',
  },
  {
    id: 'chem', name: 'Chem Facility', fullName: 'Abandoned Chemical Facility', difficulty: 10, encounters: [13, 18], coinBase: 41, pace: { power: 80, steep: 1.4 },
    unlock: { runs: 3, coins: 7000 },
    art: { scene: 'chem' },
    loot: [['toxic_vial', 30], ['ember_stone', 10], ['key', 9], ['amber_shell', 0.8], ['trail_mix', 0.8], ['bug_net', 0.5]],
    eggTier: 'rare',
    chest: { coins: 4, eggChance: 0.1, loot: [['key', 10], ['toxic_vial', 30], ['amber_shell', 8], ['bug_net', 8], ['firefly_lantern', 4], ['hazmat_suit', 1]] },
    desc: 'Rusting tanks, flickering lights and puddles that glow. Nobody has worked here for years. Something still lives here.',
  },
  {
    id: 'aether', name: 'The Aether', difficulty: 12, encounters: [14, 20], coinBase: 46, pace: { power: 100, steep: 1.5 },
    unlock: { runs: 3, coins: 12000 },
    art: { scene: 'aether' },
    loot: [['moon_crystal', 30], ['ember_stone', 10], ['key', 12], ['firefly_lantern', 0.6], ['moon_pendant', 0.3], ['bug_net', 1]],
    eggTier: 'epic',
    chest: { coins: 4, eggChance: 0.11, loot: [['key', 10], ['moon_pendant', 3], ['firefly_lantern', 6], ['titan_gauntlet', 0.5], ['moon_crystal', 40]] },
    desc: 'Floating islands above the clouds. Strange challenges, exceptional treasure.',
  },
  {
    id: 'void', name: 'The Void', difficulty: 14, encounters: [16, 22], coinBase: 56, pace: { power: 140, steep: 1.6 },
    unlock: { runs: 3, coins: 25000 },
    art: { scene: 'void' },
    loot: [['void_shard', 30], ['moon_crystal', 10], ['key', 7], ['firefly_lantern', 0.6], ['moon_pendant', 0.3]],
    eggTier: 'legendary',
    chest: { coins: 4, eggChance: 0.12, loot: [['key', 10], ['void_shard', 30], ['moon_pendant', 6], ['firefly_lantern', 8], ['storm_wings', 1], ['void_blade', 1]] },
    desc: 'Past the edge of the sky, where the stars run out. Paths drift, echoes answer back, and strange bugs watch from the dark.',
  },
  {
    id: 'new_jersey', name: 'New Jersey', difficulty: 16, encounters: [18, 24], coinBase: 66, pace: { power: 190, steep: 1.75 },
    unlock: { runs: 3, coins: 50000 },
    art: { scene: 'new_jersey' },
    loot: [['pork_roll', 30], ['void_shard', 8], ['key', 6], ['firefly_lantern', 0.6], ['moon_pendant', 0.3]],
    eggTier: 'mythic',
    chest: { coins: 4, eggChance: 0.13, loot: [['key', 10], ['pork_roll', 30], ['moon_pendant', 8], ['titan_gauntlet', 1], ['void_blade', 1], ['garden_state_crown', 0.5]] },
    desc: 'The final frontier: turnpikes, diners, boardwalks and marshland. Only the toughest bugs make it out.',
  },
];

AREAS.forEach((a, i) => { a.index = i; });
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
