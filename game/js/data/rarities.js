// Bug rarity tiers, lowest first. The lower tiers have a single weak trait,
// so early parties have gaps and encounters can fail. Each step up the ladder
// adds traits and stronger starting levels. Levelling up raises traits
// further, so a well-trained low-rarity bug can still beat an untrained rare.
// traitLevels: [min, max] starting level for each trait.
// traitCount: weighted [count, weight] options for how many traits a bug has.
// forage: coins per minute the bug digs up while in the garden.
export const RARITY_ORDER = ['drab', 'plain', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];

export const RARITIES = {
  drab:      { name: 'Drab',      color: '#7d7a72', traitLevels: [1, 1], traitCount: [[1, 100]],         dexReward: 10,   release: 5,    forage: 0.05 },
  plain:     { name: 'Plain',     color: '#b8a98f', traitLevels: [1, 2], traitCount: [[1, 100]],         dexReward: 15,   release: 10,   forage: 0.08 },
  common:    { name: 'Common',    color: '#94b0c2', traitLevels: [2, 3], traitCount: [[1, 100]],         dexReward: 25,   release: 20,   forage: 0.1 },
  uncommon:  { name: 'Uncommon',  color: '#38b764', traitLevels: [2, 4], traitCount: [[1, 70], [2, 30]], dexReward: 50,   release: 50,   forage: 0.15 },
  rare:      { name: 'Rare',      color: '#41a6f6', traitLevels: [3, 5], traitCount: [[2, 100]],         dexReward: 100,  release: 120,  forage: 0.2 },
  epic:      { name: 'Epic',      color: '#c86ee0', traitLevels: [4, 6], traitCount: [[2, 50], [3, 50]], dexReward: 200,  release: 300,  forage: 0.3 },
  legendary: { name: 'Legendary', color: '#ffcd75', traitLevels: [5, 7], traitCount: [[3, 100]],         dexReward: 400,  release: 700,  forage: 0.4 },
  mythic:    { name: 'Mythic',    color: '#f4a0b0', traitLevels: [7, 9], traitCount: [[3, 40], [4, 60]], dexReward: 800,  release: 1800, forage: 0.5 },
  celestial: { name: 'Celestial', color: '#73eff7', traitLevels: [9, 11], traitCount: [[4, 60], [5, 40]], dexReward: 2000, release: 5000, forage: 0.7 },
};

// Rare colour variants, rolled on top of rarity whenever a bug hatches. They
// are cosmetic and collectible; releasing one pays a bonus.
export const VARIANTS = {
  shiny:  { name: 'Shiny',  chance: 1 / 100, releaseMult: 3, desc: 'Inverted colours and a soft glow.' },
  albino: { name: 'Albino', chance: 1 / 200, releaseMult: 4, desc: 'Pale white with red eyes.' },
  golden: { name: 'Golden', chance: 1 / 500, releaseMult: 8, desc: 'Solid gold, and it sparkles.' },
};
