// Permanent, global upgrades bought with coins. Separate from bug equipment.
// cost(level) = round(base * growth^level). value(level) is the effect used by
// the game; text(level) describes it. Upgrades apply to timers started after
// purchase, never to eggs or expeditions already running.
export const UPGRADES = [
  {
    id: 'faster_incubation', name: 'Faster Incubation', max: 8, base: 200, growth: 1.8,
    desc: 'Eggs hatch sooner.',
    value: (l) => 0.07 * l,
    text: (l) => `-${Math.round(7 * l)}% hatch time`,
  },
  {
    id: 'expedition_efficiency', name: 'Expedition Efficiency', max: 8, base: 250, growth: 1.8,
    desc: 'Each encounter takes less time.',
    value: (l) => 0.06 * l,
    text: (l) => `-${Math.round(6 * l)}% encounter time`,
  },
  {
    id: 'better_finds', name: 'Better Finds', max: 10, base: 150, growth: 1.7,
    desc: 'More coins from expedition rewards.',
    value: (l) => 0.1 * l,
    text: (l) => `+${10 * l}% coins`,
  },
  {
    id: 'improved_exploration', name: 'Improved Exploration', max: 4, base: 600, growth: 2.6,
    desc: 'Run more expeditions at once, and find more treasure, chests and eggs.',
    value: (l) => ({ slots: Math.floor((l + 1) / 2), specialFind: 0.1 * l }),
    text: (l) => `${1 + Math.floor((l + 1) / 2)} expedition slot${l ? 's' : ''}, +${10 * l}% special finds`,
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
