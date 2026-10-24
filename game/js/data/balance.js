// Global tuning knobs. Gameplay code reads these instead of hard-coding numbers.

export const MINUTE = 60e3;
export const HOUR = 60 * MINUTE;

export const BASE_INCUBATION_MS = 4 * HOUR;
export const BASE_ENCOUNTER_MS = 5 * MINUTE;
export const GARDEN_LIMIT = 10;
export const PARTY_SIZE = 4;
export const BASE_INCUBATOR_SLOTS = 2;
export const BASE_EXPEDITION_SLOTS = 1;
export const MAX_BUG_LEVEL = 20;
export const MAX_TRAIT_LEVEL = 15;
export const HISTORY_LIMIT = 15;

// Expedition length is picked in the planner. Presets are trip lengths in
// hours, turned into an encounter count using the party's encounter time.
export const EXPEDITION_LENGTH = { min: 4, max: 150, presetHours: [1, 2, 4, 8] };

// Trait checks. A party's score for a trait combines its best bugs with
// diminishing weight, so stacking one trait helps without dominating:
//   score = L1*w1 + L2*w2 + L3*w3 + L4*w4   (bug levels sorted high to low)
//   chance = clamp(base + slope * (score - difficulty), min, max)
// With nobody holding the trait, the chance is noTraitChance.
export const TRAIT_CHECK = {
  weights: [1, 0.5, 0.25, 0.125],
  base: 0.55,
  slope: 0.1,
  min: 0.1,
  max: 0.95,
  noTraitChance: 0.08,
  greatMargin: 4, // score this far above difficulty earns a great result
};

export const XP = {
  perEncounter: 6,
  successBonus: 6,
  toNext: (level) => Math.round(30 * Math.pow(level, 1.5)),
};

export const STARTING = {
  coins: 300,
  bugs: ['ant', 'ladybug', 'pill_bug', 'caterpillar'],
  eggs: ['common'],
  items: { key: 1 },
};

// Coins dug up by garden bugs (per-rarity rates are in rarities.js).
export const GARDEN_FORAGE = { cap: 100 };

// The garden rock. Some bugs like to hide under it. Where it rests, a dirt
// patch slowly forms; after the rock is moved the patch lingers, then fades.
export const ROCK = { formMs: 3 * HOUR, lingerMs: 1 * HOUR, fadeMs: 10 * MINUTE, start: { x: 34, y: 187 } }; // the patch's spot on the map

export const BIG_SPEND = { coins: 500, fraction: 0.5 }; // ask for confirmation above either
