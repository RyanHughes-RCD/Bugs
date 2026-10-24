// Bug rarity tiers, lowest first. Rarity alone sets how strong a bug is:
// there is no levelling, so finding rarer bugs is how a party gets better.
// Each step up adds trait levels, and the top tiers add more traits.
// traitLevels: [min, max] level for each trait.
// traitCount: weighted [count, weight] options for how many traits a bug has.
// forage: coins per minute the bug digs up while it lives in the garden
// (including while it is away on an expedition).
export const RARITY_ORDER = ['drab', 'common', 'uncommon', 'nice', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];

export const RARITIES = {
  drab:      { name: 'Drab',      color: '#7d7a72', traitLevels: [1, 1],   traitCount: [[1, 100]],         dexReward: 10,   release: 5,    forage: 0.1 },
  common:    { name: 'Common',    color: '#94b0c2', traitLevels: [2, 2],   traitCount: [[1, 100]],         dexReward: 25,   release: 20,   forage: 0.15 },
  uncommon:  { name: 'Uncommon',  color: '#38b764', traitLevels: [3, 3],   traitCount: [[1, 60], [2, 40]], dexReward: 50,   release: 50,   forage: 0.18 },
  nice:      { name: 'Nice',      color: '#3fc4b4', traitLevels: [4, 4],   traitCount: [[2, 100]],         dexReward: 75,   release: 80,   forage: 0.2 },
  rare:      { name: 'Rare',      color: '#41a6f6', traitLevels: [5, 6],   traitCount: [[2, 100]],         dexReward: 100,  release: 120,  forage: 0.25 },
  epic:      { name: 'Epic',      color: '#c86ee0', traitLevels: [7, 8],   traitCount: [[3, 100]],         dexReward: 200,  release: 300,  forage: 0.35 },
  legendary: { name: 'Legendary', color: '#ffcd75', traitLevels: [9, 10],  traitCount: [[3, 100]],         dexReward: 400,  release: 700,  forage: 0.45 },
  mythic:    { name: 'Mythic',    color: '#f4a0b0', traitLevels: [11, 12], traitCount: [[4, 100]],         dexReward: 800,  release: 1800, forage: 0.55 },
  celestial: { name: 'Celestial', color: '#73eff7', traitLevels: [13, 15], traitCount: [[5, 100]],         dexReward: 2000, release: 5000, forage: 0.75 },
};

// Rare colour variants, rolled on top of rarity whenever a bug hatches. They
// are cosmetic and collectible; releasing one pays a bonus.
export const VARIANTS = {
  shiny:  { name: 'Shiny',  chance: 1 / 100, releaseMult: 3, desc: 'Inverted colours and a soft glow.' },
  albino: { name: 'Albino', chance: 1 / 200, releaseMult: 4, desc: 'Pale white with red eyes.' },
  golden: { name: 'Golden', chance: 1 / 500, releaseMult: 8, desc: 'Solid gold, and it sparkles.' },
};
