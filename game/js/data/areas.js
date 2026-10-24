// Expedition areas, in progression order. Each unlocks once the previous
// area's Guardian is defeated and the unlock fee is paid.
export const GUARDIAN_RUNS = 3; // completed expeditions before the Guardian appears

export const AREAS = [
  {
    id: 'meadow', name: 'Sunny Meadow', short: 'Meadow', unlockCost: 0,
    levels: [1, 2], maxEnemies: 2, recPower: 180, durationMs: 60e3, encounters: 4, restMs: 60e3,
    coins: [4, 9], eggType: 'meadow_egg',
    guardian: { species: 'bumblebee', name: 'Queen Bumble', level: 5, mult: { hp: 2.2, atk: 1.1, def: 1.1, spd: 1 } },
    loot: [['shiny_pebble', 30], ['honey_drop', 16], ['bug_net', 14], ['trail_mix', 14], ['clover_leaf', 8], ['acorn_cap', 5], ['thorn_spear', 5], ['sugar_cube', 6], ['warm_moss', 6]],
    hazards: ['A sudden gust of wind', 'A curious bird swoops low', 'A lawnmower rumbles past', 'A sprinkler bursts to life'],
    desc: 'Wildflowers, warm sun and plenty of friendly bugs. A gentle place to start.',
  },
  {
    id: 'pond', name: 'Lily Pond', short: 'Pond', unlockCost: 150,
    levels: [4, 7], maxEnemies: 2, recPower: 280, durationMs: 3 * 60e3, encounters: 5, restMs: 2 * 60e3,
    coins: [8, 16], eggType: 'pond_egg',
    guardian: { species: 'dragonfly', name: 'Emerald Skyking', level: 10, mult: { hp: 2.6, atk: 1.2, def: 1.15, spd: 1.1 } },
    loot: [['dewdrop_pearl', 26], ['shiny_pebble', 14], ['honey_drop', 14], ['bug_net', 10], ['trail_mix', 10], ['sugar_cube', 8], ['warm_moss', 8], ['dew_wings', 5], ['silk_cloak', 4], ['xp_nectar', 4]],
    hazards: ['A frog\'s tongue flicks out', 'The lily pad starts to sink', 'A fish leaps from the water', 'Raindrops pound the pond'],
    desc: 'Lily pads, cattails and darting hunters above the water.',
  },
  {
    id: 'woods', name: 'Old Oak Woods', short: 'Woods', unlockCost: 600,
    levels: [8, 12], maxEnemies: 3, recPower: 420, durationMs: 6 * 60e3, encounters: 5, restMs: 4 * 60e3,
    coins: [15, 28], eggType: 'woods_egg',
    guardian: { species: 'rhino_beetle', name: 'Timber Titan', level: 15, mult: { hp: 2.6, atk: 1.2, def: 1.2, spd: 1 } },
    loot: [['amber_chunk', 22], ['shiny_pebble', 10], ['honey_drop', 12], ['xp_nectar', 8], ['smelling_salts', 8], ['clover_leaf', 8], ['acorn_cap', 6], ['silk_cloak', 5], ['clover_charm', 3], ['amber_shell', 3]],
    hazards: ['An acorn plummets from above', 'A woodpecker hammers nearby', 'A sticky web blocks the path', 'A rotten log collapses'],
    desc: 'Damp leaf litter and ancient roots, home to armoured giants.',
  },
  {
    id: 'dunes', name: 'Dusty Dunes', short: 'Dunes', unlockCost: 2000,
    levels: [13, 18], maxEnemies: 3, recPower: 560, durationMs: 10 * 60e3, encounters: 6, restMs: 6 * 60e3,
    coins: [28, 48], eggType: 'dune_egg',
    guardian: { species: 'scorpion', name: 'Sandstorm Scorpion', level: 21, mult: { hp: 2.7, atk: 1.25, def: 1.2, spd: 1.05 } },
    loot: [['desert_glass', 20], ['amber_chunk', 10], ['honey_drop', 10], ['xp_nectar', 10], ['smelling_salts', 8], ['sugar_cube', 8], ['amber_shell', 4], ['stinger_blade', 4], ['firefly_lantern', 2]],
    hazards: ['A sandstorm whips up', 'The dune gives way', 'The midday sun blazes down', 'A lizard darts out of a burrow'],
    desc: 'Scorching sand and the toughest survivors in the land.',
  },
  {
    id: 'jungle', name: 'Moonlit Jungle', short: 'Jungle', unlockCost: 6000,
    levels: [18, 23], maxEnemies: 3, recPower: 760, durationMs: 15 * 60e3, encounters: 6, restMs: 8 * 60e3,
    coins: [45, 80], eggType: 'jungle_egg',
    guardian: { species: 'mantis', name: 'Moon Mantis', level: 27, mult: { hp: 2.8, atk: 1.25, def: 1.2, spd: 1.1 } },
    loot: [['moon_crystal', 18], ['desert_glass', 8], ['xp_nectar', 12], ['honey_drop', 10], ['smelling_salts', 8], ['clover_leaf', 8], ['firefly_lantern', 4], ['stinger_blade', 3], ['moon_pendant', 2]],
    hazards: ['A tropical downpour begins', 'A vine snaps back', 'Glowing eyes watch from the dark', 'A pitcher plant yawns open'],
    desc: 'Glowing fungi, towering leaves and legends under the moon.',
  },
];

AREAS.forEach((a, i) => { a.index = i; });
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
