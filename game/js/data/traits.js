// Traits are rolled when a bug hatches or is caught. Each bug has one or two.
// mods: multipliers on the bug's own stats.
// team: bonuses shared by the whole expedition team (added together).
export const TRAITS = {
  sturdy:       { name: 'Sturdy',       weight: 10, desc: '+20% HP.', mods: { hp: 1.2 } },
  fierce:       { name: 'Fierce',       weight: 10, desc: '+15% Attack.', mods: { atk: 1.15 } },
  armored:      { name: 'Armored',      weight: 10, desc: '+20% Defense.', mods: { def: 1.2 } },
  swift:        { name: 'Swift',        weight: 10, desc: '+20% Speed.', mods: { spd: 1.2 } },
  tiny:         { name: 'Tiny',         weight: 6,  desc: '+10% Speed, -10% HP.', mods: { spd: 1.1, hp: 0.9 } },
  clumsy:       { name: 'Clumsy',       weight: 6,  desc: '-10% Attack, +10% HP.', mods: { atk: 0.9, hp: 1.1 } },
  scout:        { name: 'Scout',        weight: 6,  desc: 'Team expeditions finish 8% faster.', team: { duration: -0.08 } },
  lucky:        { name: 'Lucky',        weight: 6,  desc: 'Team finds 15% more loot and coins.', team: { loot: 0.15 } },
  charming:     { name: 'Charming',     weight: 6,  desc: '+10% capture chance for the team.', team: { capture: 0.1 } },
  forager:      { name: 'Forager',      weight: 7,  desc: 'Earns 50% more coins while in the garden.', garden: 0.5 },
  studious:     { name: 'Studious',     weight: 6,  desc: '+30% XP from expeditions.', xp: 0.3 },
  regenerating: { name: 'Regenerating', weight: 5,  desc: 'Heals 15% HP after every encounter.', regen: 0.15 },
  venomous:     { name: 'Venomous',     weight: 5,  desc: '25% chance to strike for +60% damage.', crit: 0.25 },
  nimble:       { name: 'Nimble',       weight: 5,  desc: 'Dodges 15% of attacks.', dodge: 0.15 },
  brave:        { name: 'Brave',        weight: 4,  desc: '+35% Attack against Guardians.', guardianAtk: 0.35 },
  glowing:      { name: 'Glowing',      weight: 4,  desc: '+25% all stats in the Moonlit Jungle. Glows at night.', areaBoost: { jungle: 0.25 } },
};

export const TRAIT_IDS = Object.keys(TRAITS);
