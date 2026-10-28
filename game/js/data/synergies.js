// Party bonuses: what a party is made of, not just how strong it is.
// systems/synergies.js decides which ones a party qualifies for; each trip,
// the standard ones kick in by chance (TRIGGER) and the variant ones (from
// Shiny, Albino and Golden bugs, marked `always`) every time. Players aren't
// shown this list: a bonus is discovered the first time they launch a party
// that qualifies for it, and only hinted at before that.
//
// Each bonus: name, need (what it takes), does (what it does), and its numbers.

export const SYNERGIES = {
  shell_wall: {
    name: 'Shell Wall', icon: 'rock', need: '3+ beetles',
    does: 'Armoured: the first 2 failed trait checks each trip count as passes.',
    saves: 2,
  },
  hive_mind: {
    name: 'Hive Mind', icon: 'star', need: 'All 4 from the same family',
    does: "They think as one: every check uses the party's best level for that trait, +2, as if all four had it.",
    plus: 2,
  },
  tailwind: {
    name: 'Tailwind', icon: 'trait_fly', need: 'All 4 are flyers or can Fly',
    does: 'They fly over trouble: every 4th encounter is skipped, but still pays its rewards.',
    every: 4,
  },
  pearl_divers: {
    name: 'Pearl Divers', icon: 'chest', need: '2+ water bugs',
    does: 'Each encounter has a 10% chance of a sunken chest, which opens with no key.',
    chance: 0.1, coins: [0.25, 0.4],
  },
  ambush: {
    name: 'Ambush', icon: 'trait_fight', need: '2 arachnids + 1 flyer (the bait)',
    does: 'Fight checks always pass, and Fight encounters pay double coins plus a share of the spoils.',
    coinMult: 2,
  },
  night_shift: {
    name: 'Night Shift', icon: 'star', need: '3+ night bugs, launched 9pm–5am',
    does: 'By your device clock: encounters run 30% faster and eggs found roll one tier higher.',
    speed: 0.3, from: 21, to: 5,
  },
  tunnel_network: {
    name: 'Tunnel Network', icon: 'trait_dig', need: '3+ diggers (Dig, wrigglers or rock-lovers)',
    does: 'Every encounter digs up bonus coins, and the trip may turn up a buried egg.',
    coins: [0.1, 0.2], eggChance: 0.25,
  },
  ecosystem: {
    name: 'Ecosystem', icon: 'flower', need: '4 different families',
    does: 'Balanced party: every bug gets +1 to every trait it has.',
    plus: 1,
  },
  mentor: {
    name: 'Mentor', icon: 'heart', need: 'An Epic-or-better bug + a Drab or Common',
    does: 'The low bug counts as two rarities higher for trip speed.',
    up: 2,
  },
  conductor: {
    name: 'Conductor', icon: 'trait_fight', need: 'An electric bug + a water bug',
    does: 'Chain lightning: whenever an encounter goes well, there is a 30% chance the next one is cleared instantly.',
    chance: 0.3,
  },
  leyline: {
    name: 'Leyline', icon: 'star', need: '2+ bugs with auras or special effects',
    does: 'Relic-tier items drop twice as often, and eggs found get +1 tier.',
    relicMult: 2,
  },
  leapfrog: {
    name: 'Leapfrog', icon: 'trait_fly', need: '3+ hoppers',
    does: 'Each encounter has a 30% chance to finish instantly.',
    chance: 0.3,
  },
  bonded: {
    name: 'Bonded', icon: 'heart', need: '2 of the same species (3 for more)',
    does: 'Twins: each gets +2 to its signature trait. Triplets get +4.',
    twins: 2, triplets: 4,
  },
  spectrum: {
    name: 'Spectrum', icon: 'coin', need: '4 different rarities',
    does: '+50% coins all trip.',
    coinMult: 0.5,
  },

  // ---- Variant bonuses: one per variant in the party ----
  lure: {
    name: 'Lure', icon: 'heart', always: true, variant: 'shiny', need: 'A Shiny bug',
    does: 'Its shimmer draws eggs in: every trip brings home at least one egg, other eggs are 50% more likely, and wild visitors come twice as often for an hour after it gets home.',
    eggChance: 0.5, lureMs: 3600e3,
  },
  unseen: {
    name: 'Unseen', icon: 'star', always: true, variant: 'albino', need: 'An Albino bug',
    does: 'Hard to spot: encounters are 15% faster, and a failed check still pays half its reward.',
    speed: 0.15, failPay: 0.5,
  },
  midas: {
    name: 'Midas', icon: 'coin', always: true, variant: 'golden', need: 'A Golden bug',
    does: '+50% coins all trip, and every chest has a chance of an extra key or relic.',
    coinMult: 0.5, chestBonus: 0.35, relicShare: 0.15,
  },
  prismatic: {
    name: 'Prismatic', icon: 'star', always: true, need: 'A Shiny, an Albino and a Golden bug',
    does: 'One of each variant guarantees a relic at the end of the trip.',
  },
};

// The chance each standard bonus kicks in on a trip (rolled at launch). The
// Jar of Light in the garden raises it.
export const TRIGGER = { chance: 0.25, jarChance: 0.35 };

// Two of one variant count twice; a third and fourth add less.
export const VARIANT_STACK = [0, 1, 2, 2.5, 3];

// Caps so stacked speed bonuses can't make trips instant.
export const SYNERGY_LIMITS = { minSpeedFactor: 0.45, instantWeight: 0.1 };

export const SYNERGY_IDS = Object.keys(SYNERGIES);
