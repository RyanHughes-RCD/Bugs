// Permanent, global upgrades bought with coins. Separate from bug equipment.
// cost(level) = round(base * growth^level). value(level) is the effect used by
// the game; text(level) describes it. Upgrades apply to timers started after
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
    id: 'improved_exploration', name: 'Improved Exploration', max: 2, base: 600, growth: 2.6,
    desc: 'Run more expeditions at once, and find more treasure, chests and eggs.',
    value: (l) => ({ slots: l ? 1 : 0, specialFind: 0.1 * l }),
    text: (l) => `${l ? 2 : 1} expedition slot${l ? 's' : ''}, +${10 * l}% special finds`,
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
  return Math.round(u.base * Math.pow(u.growth, level));
}

export function upgradeValue(state, id) {
  return UPGRADE_BY_ID[id].value(state.upgrades[id] || 0);
}
