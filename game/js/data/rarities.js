// Bug rarity tiers. Common and Uncommon bugs have a single trait at a low
// level, so early parties have gaps and encounters can fail. Each step up the
// ladder adds traits and stronger starting levels. Levelling up raises traits
// further, so a well-trained common can still beat an untrained rare.
// traitLevels: [min, max] starting level for each trait.
// traitCount: weighted [count, weight] options for how many traits a bug has.
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITIES = {
  common:    { name: 'Common',    color: '#94b0c2', traitLevels: [1, 2], traitCount: [[1, 100]],          dexReward: 20,  release: 15 },
  uncommon:  { name: 'Uncommon',  color: '#38b764', traitLevels: [2, 3], traitCount: [[1, 100]],          dexReward: 40,  release: 40 },
  rare:      { name: 'Rare',      color: '#41a6f6', traitLevels: [3, 4], traitCount: [[2, 100]],          dexReward: 80,  release: 100 },
  epic:      { name: 'Epic',      color: '#c86ee0', traitLevels: [4, 5], traitCount: [[2, 50], [3, 50]],  dexReward: 160, release: 250 },
  legendary: { name: 'Legendary', color: '#ffcd75', traitLevels: [5, 7], traitCount: [[3, 100]],          dexReward: 300, release: 600 },
  mythic:    { name: 'Mythic',    color: '#f4a0b0', traitLevels: [7, 9], traitCount: [[3, 40], [4, 60]],  dexReward: 600, release: 1500 },
};
