// Bug rarity tiers. Rarity shapes trait count and level ranges, but rolls
// overlap so a lucky common can beat an unlucky rare at its specialty.
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITIES = {
  common:    { name: 'Common',    color: '#94b0c2', traitLevels: [1, 3], traitCount: [[1, 75], [2, 25]],          dexReward: 20,  release: 15 },
  uncommon:  { name: 'Uncommon',  color: '#38b764', traitLevels: [2, 4], traitCount: [[1, 45], [2, 55]],          dexReward: 40,  release: 40 },
  rare:      { name: 'Rare',      color: '#41a6f6', traitLevels: [3, 5], traitCount: [[2, 70], [3, 30]],          dexReward: 80,  release: 100 },
  epic:      { name: 'Epic',      color: '#c86ee0', traitLevels: [4, 6], traitCount: [[2, 40], [3, 60]],          dexReward: 160, release: 250 },
  legendary: { name: 'Legendary', color: '#ffcd75', traitLevels: [5, 7], traitCount: [[3, 80], [4, 20]],          dexReward: 300, release: 600 },
  mythic:    { name: 'Mythic',    color: '#f4a0b0', traitLevels: [6, 8], traitCount: [[3, 50], [4, 50]],          dexReward: 600, release: 1500 },
};

export const PRIMARY_TRAIT_BONUS = 1; // a species' signature trait rolls one level higher
