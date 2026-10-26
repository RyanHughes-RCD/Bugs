import { HOUR } from './balance.js';

// Garden decorations. Each one is loved by some bugs: garden bugs that love a
// decoration spend their time beside it and forage more (bonus). Because
// "near it" comes from who loves what, not from live positions, the bonus is
// the same while the game is closed. A bug that loves several decorations
// gets the best bonus, not all of them.
//
//   price:   0 means it comes with every garden (the rock).
//   sprite:  art in decor/<id>.png (size: its [w, h] in art pixels), drawn at
//            `scale` map pixels per art pixel.
//   fixed:   drawn at a set place instead of being dragged around.
//   loves:   (species) => true for the bugs that love it.
//   attracts: wild visitors that love it turn up this many times as often.
//   potCap:  extra room in the garden's coin pot.
const WATER = new Set(['water_strider', 'damselfly', 'dragonfly', 'mosquito', 'storm_dragonfly', 'bubble_ladybug', 'ice_worm']);
const NIGHT_FLYERS = new Set(['moth', 'luna_moth', 'atlas_moth', 'frost_moth', 'firefly', 'on_firefly']);
const ELECTRIC = new Set(['thunder_beetle', 'storm_dragonfly']);

export const DECOR = [
  {
    id: 'rock', name: 'Garden Rock', price: 0, bonus: 0.25, attracts: 2,
    loves: (sp) => sp.likesRock,
    desc: 'Shade-lovers hide underneath. Lift it for a find every few hours.',
  },
  {
    id: 'flower_bed', name: 'Flower Bed', price: 800, sprite: 'decor/flower_bed.png', size: [51, 56], scale: 0.6, bonus: 0.5, attracts: 2,
    loves: (sp) => sp.family === 'flyer',
    desc: 'Flyers sip nectar here and forage more.',
  },
  {
    id: 'log', name: 'Mossy Log', price: 1500, sprite: 'decor/log.png', size: [61, 49], scale: 0.6, bonus: 0.5, attracts: 2,
    loves: (sp) => sp.family === 'beetle' || sp.traits[0] === 'dig',
    desc: 'Beetles and diggers burrow into it. Tap to roll it over and see what was underneath.',
  },
  {
    id: 'jar', name: 'Jar of Light', price: 2500, sprite: 'decor/jar.png', size: [16, 27], scale: 0.7, bonus: 0.5, attracts: 3,
    loves: (sp) => NIGHT_FLYERS.has(sp.base),
    desc: 'Moths and fireflies circle it, and it glows after dark.',
  },
  {
    id: 'river', name: 'Tiny River', price: 4000, sprite: 'decor/river.png', size: [110, 23], scale: 1, fixed: 'top', bonus: 0.5, attracts: 3, potCap: 200,
    loves: (sp) => WATER.has(sp.base) || sp.id === 'pond_snail',
    desc: 'Runs along the top of the garden. Water bugs love it, and it doubles the coin pot.',
  },
  {
    id: 'battery', name: '9V Battery', price: 6000, sprite: 'decor/battery.png', size: [103, 88], scale: 0.5, bonus: 1, attracts: 4,
    loves: (sp) => ELECTRIC.has(sp.id),
    desc: 'Electric bugs charge up on it and forage double. Anyone else who gets too close gets a zap (and leaves a coin).',
  },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

// Rolling the log over: a few coins at most every LOG.everyMs.
export const LOG = { everyMs: 2 * HOUR, coins: [10, 30] };
// The battery: how close counts as too close (map pixels), and how long a bug
// stays wary of it after a zap.
export const BATTERY = { reach: 6, cooldownMs: 20e3 };
