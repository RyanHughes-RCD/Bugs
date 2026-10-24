import { BASE_INCUBATION_MS } from './balance.js';

// Egg tiers, in order. odds = chance (%) of each BUG rarity hatching from this
// tier; every row must sum to 100. A tier never guarantees its own rarity.
// pool: optional list of species ids this tier can hatch (default: all species).
// visual: palette characters (see pixel_bugs/palette.txt) and effects used to
// draw the egg, so tiers read at a glance without revealing what's inside.
// sprite: optional path to custom egg art; drawn instead of the generated egg.
export const EGG_TIERS = [
  {
    id: 'common', name: 'Common Egg', price: 100, hatchMs: BASE_INCUBATION_MS,
    odds: { common: 70, uncommon: 22, rare: 6, epic: 1.5, legendary: 0.45, mythic: 0.05 },
    visual: { base: 'W', shade: 'l', mark: 's', pattern: 'speckles' },
    desc: 'A plain, speckled egg. Usually a common bug, but you never know.',
  },
  {
    id: 'uncommon', name: 'Uncommon Egg', price: 250, hatchMs: BASE_INCUBATION_MS,
    odds: { common: 40, uncommon: 40, rare: 15, epic: 4, legendary: 0.9, mythic: 0.1 },
    visual: { base: 'g', shade: 'G', mark: 'T', pattern: 'spots' },
    desc: 'Leafy green spots. Better odds of something special.',
  },
  {
    id: 'rare', name: 'Rare Egg', price: 600, hatchMs: BASE_INCUBATION_MS,
    odds: { common: 15, uncommon: 30, rare: 40, epic: 11, legendary: 3.5, mythic: 0.5 },
    visual: { base: 'c', shade: 'b', mark: 'C', pattern: 'stripes', band: 'W' },
    desc: 'Cool blue stripes with a silver band.',
  },
  {
    id: 'epic', name: 'Epic Egg', price: 1500, hatchMs: BASE_INCUBATION_MS,
    odds: { common: 5, uncommon: 15, rare: 30, epic: 37, legendary: 11, mythic: 2 },
    visual: { base: 'P', shade: 'K', mark: 'p', pattern: 'zigzag', band: 'Y', glow: 'rgba(200,110,224,0.55)' },
    desc: 'Royal purple zigzags and a faint violet glow.',
  },
  {
    id: 'legendary', name: 'Legendary Egg', price: 3500, hatchMs: BASE_INCUBATION_MS,
    odds: { common: 2, uncommon: 6, rare: 17, epic: 30, legendary: 38, mythic: 7 },
    visual: { base: 'Y', shade: 'r', mark: 'W', pattern: 'stars', band: 'R', gem: 'R', glow: 'rgba(255,205,117,0.7)', sparkles: 3 },
    desc: 'Golden, star-studded and warm to the touch.',
  },
  {
    id: 'mythic', name: 'Mythic Egg', price: 8000, hatchMs: BASE_INCUBATION_MS,
    odds: { common: 1, uncommon: 3, rare: 10, epic: 21, legendary: 30, mythic: 35 },
    visual: { base: 'k', shade: 'K', mark: 'C', mark2: 'p', pattern: 'swirl', band: 'C', gem: 'p', glow: 'rgba(244,160,176,0.75)', sparkles: 5 },
    desc: 'A swirling cosmic shell. Even this is no sure thing.',
  },
];

EGG_TIERS.forEach((e, i) => { e.index = i; });
export const EGG_BY_ID = Object.fromEntries(EGG_TIERS.map((e) => [e.id, e]));

export const HATCHERY_MOTTO = 'All bugs come from eggs. Everyone knows this.';
