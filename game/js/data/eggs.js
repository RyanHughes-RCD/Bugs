import { HOUR } from './balance.js';

// Egg tiers, in order. odds = chance (%) of each BUG rarity hatching from this
// tier; every row must sum to 100. A tier never guarantees its own rarity.
// pool: optional list of species ids this tier can hatch (default: all species).
// hatchMs: base incubation time; cheap eggs hatch fast, rare ones take longer.
// shop: when the egg shop stocks this tier: once an area is unlocked, and
//       optionally after a number of expeditions there.
// visual: palette characters (see pixel_bugs/palette.txt) and effects used to
// draw the egg, so tiers read at a glance without revealing what's inside.
// Patterns continue into the shaded side one shade darker; shadeMarks
// overrides that darker colour for specific marks.
// sprite: optional path to custom egg art; drawn instead of the generated egg.
export const EGG_TIERS = [
  {
    id: 'common', name: 'Common Egg', price: 100, hatchMs: 1 * HOUR, shop: { area: 'garden' },
    odds: { drab: 30, common: 40, uncommon: 20, nice: 6.5, rare: 2.5, epic: 0.75, legendary: 0.2, mythic: 0.04, celestial: 0.01 },
    visual: { base: 'W', shade: 'l', mark: 's', pattern: 'speckles' },
    desc: 'A plain, speckled egg. Usually something humble, but you never know.',
  },
  {
    id: 'uncommon', name: 'Uncommon Egg', price: 350, hatchMs: 2 * HOUR, shop: { area: 'garden' },
    odds: { drab: 12, common: 30, uncommon: 30, nice: 17, rare: 8, epic: 2.2, legendary: 0.6, mythic: 0.17, celestial: 0.03 },
    visual: { base: 'g', shade: 'G', mark: 'T', pattern: 'spots' },
    desc: 'Leafy green spots. Better odds of something special.',
  },
  {
    id: 'nice', name: 'Nice Egg', price: 800, hatchMs: 3 * HOUR, shop: { area: 'forest' },
    odds: { drab: 7, common: 20, uncommon: 28, nice: 26, rare: 14, epic: 3.8, legendary: 1, mythic: 0.18, celestial: 0.02 },
    visual: { base: 'C', shade: 'T', mark: 'W', pattern: 'spots' },
    desc: 'Minty, smooth and pleasantly cool. A nice step up.',
  },
  {
    id: 'rare', name: 'Rare Egg', price: 2000, hatchMs: 4 * HOUR, shop: { area: 'caves' },
    odds: { drab: 4, common: 12, uncommon: 22, nice: 25, rare: 25, epic: 9, legendary: 2.5, mythic: 0.45, celestial: 0.05 },
    visual: { base: 'c', shade: 'b', mark: 'C', pattern: 'stripes', band: 'W' },
    desc: 'Cool blue stripes with a silver band.',
  },
  {
    id: 'epic', name: 'Epic Egg', price: 6000, hatchMs: 6 * HOUR, shop: { area: 'volcano' },
    odds: { drab: 1.5, common: 5, uncommon: 12, nice: 18, rare: 28, epic: 26, legendary: 7.5, mythic: 1.8, celestial: 0.2 },
    visual: { base: 'P', shade: 'K', mark: 'p', pattern: 'zigzag', band: 'Y', glow: 'rgba(200,110,224,0.55)' },
    desc: 'Royal purple zigzags and a faint violet glow.',
  },
  {
    id: 'legendary', name: 'Legendary Egg', price: 20000, hatchMs: 8 * HOUR, shop: { area: 'aether' },
    odds: { drab: 0.5, common: 2.5, uncommon: 5, nice: 10, rare: 18, epic: 27, legendary: 28, mythic: 8, celestial: 1 },
    visual: { base: 'Y', shade: 'r', mark: 'W', shadeMarks: { W: 'Y' }, pattern: 'stars', band: 'R', gem: 'R', glow: 'rgba(255,205,117,0.7)', sparkles: 3 },
    desc: 'Golden, star-studded and warm to the touch.',
  },
  {
    id: 'mythic', name: 'Mythic Egg', price: 60000, hatchMs: 10 * HOUR, shop: { area: 'aether', runs: 10 },
    odds: { drab: 0.3, common: 1.2, uncommon: 3, nice: 5.5, rare: 10, epic: 20, legendary: 30, mythic: 25, celestial: 5 },
    visual: { base: 'k', shade: 'K', mark: 'C', mark2: 'p', pattern: 'swirl', band: 'C', gem: 'p', glow: 'rgba(244,160,176,0.75)', sparkles: 5 },
    desc: 'A swirling cosmic shell. Even this is no sure thing.',
  },
  {
    id: 'celestial', name: 'Celestial Egg', price: 150000, hatchMs: 12 * HOUR, shop: { area: 'aether', runs: 10 },
    odds: { drab: 0.1, common: 0.6, uncommon: 1.3, nice: 3, rare: 6, epic: 13, legendary: 26, mythic: 30, celestial: 20 },
    visual: { base: 'b', shade: 'K', mark: 'W', mark2: 'C', pattern: 'constellation', band: 'C', gem: 'W', glow: 'rgba(115,239,247,0.8)', sparkles: 7 },
    desc: 'A sliver of night sky in an eggshell.',
  },
];

EGG_TIERS.forEach((e, i) => { e.index = i; });
export const EGG_BY_ID = Object.fromEntries(EGG_TIERS.map((e) => [e.id, e]));

export const HATCHERY_MOTTO = 'All bugs come from eggs. Everyone knows this.';
