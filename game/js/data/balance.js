// Global tuning knobs. Gameplay code reads these instead of hard-coding numbers.

export const MINUTE = 60e3;
export const HOUR = 60 * MINUTE;

export const BASE_INCUBATION_MS = 4 * HOUR;
export const BASE_ENCOUNTER_MS = 5 * MINUTE;
export const GARDEN_LIMIT = 10; // before Bigger Garden upgrades (+5 each, up to 25)
export const PARTY_SIZE = 4;
export const PRESET_LIMIT = 12; // saved party presets
export const BASE_INCUBATOR_SLOTS = 2;
export const BASE_EXPEDITION_SLOTS = 1;
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

// Expedition pace. Each area suits a party of a certain power (the party's
// total trait levels, so mostly its rarity). A weaker party takes longer per
// encounter, a stronger one less: time x (suited power / party power) ^
// steepness, kept within [min, max]. Areas set their own steepness, so
// being under-powered hurts more in harder places.
export const PACE = { min: 0.5, max: 8 };

export const STARTING = {
  coins: 500,
  bugs: ['ant', 'ladybug', 'pill_bug', 'caterpillar'],
  eggs: ['common'],
  items: { key: 1 },
};

// Coins dug up by garden bugs (per-rarity rates are in rarities.js).
export const GARDEN_FORAGE = { cap: 200 };

// The garden map, in map pixels (BugsMap/pixil-layer-0.png is this size). The
// screen shows about a 150 x 300 window of it; drag to look around.
export const GARDEN_MAP = { w: 300, h: 600, viewW: 150, viewH: 300 };

// The garden rock. Some bugs like to hide under it. Where it rests, a dirt
// patch slowly forms; after the rock is moved the patch lingers, then fades.
export const ROCK = { formMs: 3 * HOUR, lingerMs: 1 * HOUR, fadeMs: 10 * MINUTE, start: { x: 150, y: 300 } }; // starts in the middle of the garden

// Eggs found on expeditions: the tier is rolled up from the area's egg tier.
// [tiers above, weight]. Chests lean higher but never pass +3.
export const EGG_DROPS = {
  find: [[0, 85], [1, 11], [2, 3], [3, 1]],
  chest: [[0, 55], [1, 30], [2, 11], [3, 4]],
};

// Wild bugs wander into the garden while it has room (say, while the party is
// away). Say hi before they leave and they give a small gift: usually coins,
// sometimes an egg. Times are in minutes.
export const VISITORS = {
  max: 3, // at most this many at once, and never more than the garden's free places
  everyMin: [40, 100], // gap between arrivals
  stayMin: [60, 240], // how long one stays if nobody says hi
  afterHiMin: 2, // a greeted visitor heads off soon after
  rarity: [['drab', 30], ['common', 35], ['uncommon', 20], ['nice', 10], ['rare', 5]],
  coins: [5, 20],
  eggChance: 0.15,
  eggs: [['common', 80], ['uncommon', 17], ['rare', 3]],
  catchUpHours: 24, // arrivals simulated while the app was closed
};

// Lifting the rock once its dirt patch has fully formed turns up a find,
// once per spot. Move the rock and wait again for the next one.
export const ROCK_FIND = {
  eggChance: 0.25,
  coinChance: 0.5, // otherwise just a few curious woodlice
  coins: [10, 30],
  eggs: [['common', 75], ['uncommon', 20], ['rare', 5]],
};

export const BIG_SPEND = { coins: 500, fraction: 0.5 }; // ask for confirmation above either
