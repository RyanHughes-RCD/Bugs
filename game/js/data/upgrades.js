import { AREA_BY_ID } from './areas.js';

// Permanent, global upgrades bought with coins. Separate from bug equipment.
// cost(level) = round(base * growth^level), unless levelCosts sets that
// level's price. needs: { level: area } keeps a level locked until that area
// is unlocked. value(level) is the effect used by the game; text(level)
// describes it. Upgrades apply to timers started after
// purchase, never to eggs or expeditions already running.
export const UPGRADES = [
  {
    id: 'faster_incubation', name: 'Faster Incubation', max: 8, base: 200, growth: 2.0,
    desc: 'Eggs hatch sooner.',
    value: (l) => 0.07 * l,
    text: (l) => `-${Math.round(7 * l)}% hatch time`,
  },
  {
    id: 'expedition_efficiency', name: 'Expedition Efficiency', max: 8, base: 250, growth: 2.0,
    desc: 'Each encounter takes less time.',
    value: (l) => 0.04 * l,
    text: (l) => `-${Math.round(4 * l)}% encounter time`,
  },
  {
    id: 'better_finds', name: 'Better Finds', max: 10, base: 150, growth: 1.9,
    desc: 'More coins from expedition rewards.',
    value: (l) => 0.05 * l,
    text: (l) => `+${5 * l}% coins`,
  },
  {
    id: 'improved_exploration', name: 'Improved Exploration', max: 3, base: 600, growth: 2.6,
    levelCosts: { 2: 50000 }, needs: { 2: 'void' }, // the third slot is a late-game goal
    desc: 'Run more expeditions at once, and find more treasure, chests and eggs.',
    value: (l) => ({ slots: l >= 3 ? 2 : l ? 1 : 0, specialFind: 0.1 * Math.min(l, 2) }),
    text: (l) => `${1 + (l >= 3 ? 2 : l ? 1 : 0)} expedition slot${l ? 's' : ''}, +${10 * Math.min(l, 2)}% special finds`,
  },
  {
    id: 'garden_space', name: 'Bigger Garden', max: 3, base: 1500, growth: 2.5,
    desc: 'Room for 5 more bugs to live in the garden.',
    value: (l) => 5 * l,
    text: (l) => `${10 + 5 * l} garden places`, showZero: true,
  },
  {
    id: 'incubator_slots', name: 'Extra Incubators', max: 3, base: 400, growth: 2.5,
    desc: 'Incubate more eggs at the same time.',
    value: (l) => l,
    text: (l) => `${2 + l} incubators`,
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(id, level) {
  const u = UPGRADE_BY_ID[id];
  if (!u || level >= u.max) return Infinity;
  return u.levelCosts?.[level] ?? Math.round(u.base * Math.pow(u.growth, level));
}

// Why the next level can't be bought yet (an area still locked), or null.
export function upgradeLock(state, id) {
  const u = UPGRADE_BY_ID[id];
  const area = u?.needs?.[state.upgrades[id] || 0];
  if (!area || state.areas[area]?.unlocked) return null;
  return `Unlocks with ${AREA_BY_ID[area].name}`;
}

export function upgradeValue(state, id) {
  return UPGRADE_BY_ID[id].value(state.upgrades[id] || 0);
}
