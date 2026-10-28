import { HOUR, MINUTE } from './balance.js';

// Garden decorations. Each one is loved by some bugs: garden bugs that love a
// decoration spend their time beside it and forage more (bonus). Because
// "near it" comes from who loves what, not from live positions, the bonus is
// the same while the game is closed. A bug that loves several decorations
// gets the best bonus, not all of them.
//
//   price:   0 means it comes with every garden (the rock).
//   sprite:  art in decor/<id>.png (size: its [w, h] in art pixels), drawn at
//            `scale` map pixels per art pixel.
//   fixed:   [x, y] map position of its top-left corner; it can't be dragged.
//   loves:   (species) => true for the bugs that love it.
//   attracts: wild visitors that love it turn up this many times as often.
//   potBonus: makes the garden's coin pot this share bigger.
//   shadow:  [x, y] offset of its cast shadow (its silhouette), in map pixels.
const WATER = new Set(['water_strider', 'damselfly', 'dragonfly', 'mosquito', 'storm_dragonfly', 'bubble_ladybug', 'ice_worm', 'bubble_diver']);
export const NIGHT_FLYERS = new Set(['moth', 'luna_moth', 'atlas_moth', 'frost_moth', 'firefly', 'on_firefly', 'ember_moth', 'phantom_moth', 'lantern_fly', 'eclipse_moth', 'supernova_firefly']);
const ELECTRIC = new Set(['thunder_beetle', 'storm_dragonfly', 'tesla_centipede']);

// In the order they're meant to be bought: cheapest first.
export const DECOR = [
  {
    id: 'rock', name: 'Garden Rock', price: 0, bonus: 0.25, attracts: 2,
    loves: (sp) => sp.likesRock,
    desc: 'Shade-lovers hide underneath. Lift it for a find every few hours.',
  },
  {
    id: 'log', name: 'Mossy Log', price: 800, sprite: 'decor/log.png', size: [85, 70], scale: 0.9, shadow: [4, 4], bonus: 0.5, attracts: 2,
    loves: (sp) => sp.family === 'beetle' || sp.traits[0] === 'dig',
    desc: 'Beetles and diggers burrow into it. Tap to roll it over and see what was underneath.',
  },
  {
    id: 'battery', name: '9V Battery', price: 1500, sprite: 'decor/battery.png', size: [84, 68], scale: 0.6, shadow: [4, 4], bonus: 1, attracts: 4,
    loves: (sp) => ELECTRIC.has(sp.id),
    desc: 'Electric bugs charge up on it and forage double. Anyone else who gets too close gets a zap (and leaves a coin). Tap it to send out a pulse: every bug it catches drops a coin and zips around for a minute.',
  },
  {
    id: 'flower_bed', name: 'Flower Bed', price: 2500, sprite: 'decor/flower_bed.png', size: [82, 77], scale: 0.84, bonus: 0.5, attracts: 2,
    loves: (sp) => sp.family === 'flyer',
    desc: 'Flyers sip nectar here and forage more.',
  },
  {
    id: 'river', name: 'Tiny River', price: 4000, sprite: 'decor/river.png', size: [111, 92], scale: 2, fixed: [78, 0], bonus: 0.5, attracts: 3, potBonus: 0.25,
    loves: (sp) => WATER.has(sp.base) || sp.id === 'pond_snail',
    desc: 'Flows in along the top of the garden. Water bugs love it, and it makes the coin pot 25% bigger.',
  },
  {
    id: 'jar', name: 'Jar of Light', price: 6000, sprite: 'decor/jar.png', size: [44, 62], scale: 0.35, bonus: 0.5, attracts: 3,
    loves: (sp) => NIGHT_FLYERS.has(sp.base),
    desc: 'Moths and fireflies circle it, and it glows after dark.',
  },
];

// The river's outline: for each row of its sprite, the first and last
// pixel with water (in art pixels, before the river's scale). Used to keep decorations and the rock off the water.
export const RIVER_ROWS = '4-37,3-37,3-36,3-36,3-35,3-34,3-34,3-34,2-34,2-34,2-35,1-37,1-38,1-40,1-41,1-69,0-72,0-73,0-74,0-74,0-75,0-76,1-77,2-77,2-78,3-78,4-78,4-79,5-79,5-80,6-80,6-80,8-80,9-80,10-80,11-81,12-81,15-82,17-82,20-83,23-85,25-86,27-87,30-88,34-90,37-92,39-94,42-98,44-102,46-110,48-110,50-110,51-110,52-110,53-110,54-110,54-110,54-110,55-110,55-110,56-110,56-110,56-110,57-110,57-110,57-110,58-110,58-110,59-110,59-110,60-110,60-110,61-110,61-110,61-110,62-110,62-110,63-110,63-110,65-110,66-110,69-110,70-110,72-110,74-110,78-110,84-110,99-110,102-110,104-110,107-110,109-110'
  .split(',').map((r) => r.split('-').map(Number));

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

// Rolling the log over: a few coins at most every LOG.everyMs.
export const LOG = { everyMs: 2 * HOUR, coins: [10, 30] };
// The battery: how close counts as too close (map pixels), and how long a bug
// stays wary of it after a zap. Tapping it sends out a pulse reaching
// pulseRadius map pixels; bugs it catches move boostSpeed times as fast for
// boostMs (just for show: foraging and expeditions are unchanged). A bug
// drops at most one coin per cooldownMs, from zaps and pulses alike. The
// battery needs rechargeMs between pulses (no timer is shown).
export const BATTERY = { reach: 6, cooldownMs: 20e3, pulseRadius: 180, pulseMs: 1200, boostMs: 60e3, boostSpeed: 2.2, rechargeMs: 5 * MINUTE };
