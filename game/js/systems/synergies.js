import { SPECIES } from '../data/species.js';
import { RARITIES, RARITY_ORDER } from '../data/rarities.js';
import { DECOR_BY_ID } from '../data/decor.js';
import { SYNERGIES, VARIANT_STACK, SYNERGY_LIMITS } from '../data/synergies.js';
import { effectiveTraits, traitTotal } from './bugs.js';
import { partyTraitScores, traitScore } from './traits.js';

const EPIC = RARITY_ORDER.indexOf('epic');
const COMMON = RARITY_ORDER.indexOf('common');

// What a bug counts as for party bonuses.
export function bugTags(bug) {
  const sp = SPECIES[bug.species];
  const t = effectiveTraits(bug);
  return {
    family: sp.family,
    flyer: sp.family === 'flyer' || (t.fly || 0) > 0,
    water: DECOR_BY_ID.river.loves(sp),
    electric: DECOR_BY_ID.battery.loves(sp),
    night: DECOR_BY_ID.jar.loves(sp) || !!sp.aura,
    digger: (t.dig || 0) > 0 || sp.family === 'wriggler' || sp.likesRock,
    magical: !!sp.aura || sp.fx.length > 0,
    rank: RARITY_ORDER.indexOf(sp.rarity),
  };
}

// Whether a launch hour (0-23, the device's local time) is night-shift time.
export function isNightHour(hour, def = SYNERGIES.night_shift) {
  return hour !== null && hour !== undefined && (hour >= def.from || hour < def.to);
}

// Which bonuses a party has. `hour` is the launch hour on the device clock
// (null when unknown, e.g. planning ahead). Returns the active bonuses (each
// with a strength `n` where it stacks) and near misses for the planner.
export function partySynergies(party, { hour = null } = {}) {
  const active = {};
  const hints = [];
  if (!party.length) return { active, hints };
  const tags = party.map((b) => ({ bug: b, ...bugTags(b) }));
  const count = (fn) => tags.filter(fn).length;
  const families = {};
  for (const t of tags) families[t.family] = (families[t.family] || 0) + 1;
  const species = {};
  for (const b of party) species[b.species] = (species[b.species] || 0) + 1;
  const full = party.length === 4;
  const on = (id, extra = {}) => { active[id] = { n: 1, ...extra }; };
  const near = (id, text) => hints.push({ id, text });

  const beetles = families.beetle || 0;
  if (beetles >= 3) on('shell_wall');
  else if (beetles === 2) near('shell_wall', '1 more beetle');

  const top = Math.max(...Object.values(families));
  if (full && top === 4) on('hive_mind');
  else if (top === 3) near('hive_mind', `1 more ${Object.keys(families).find((f) => families[f] === 3)}`);

  const flyers = count((t) => t.flyer);
  if (full && flyers === 4) on('tailwind');
  else if (flyers === 3) near('tailwind', '1 more flyer');

  const water = count((t) => t.water);
  if (water >= 2) on('pearl_divers');
  else if (water === 1) near('pearl_divers', '1 more water bug');

  const arachnids = families.arachnid || 0;
  const bait = count((t) => t.family === 'flyer');
  if (arachnids >= 2 && bait >= 1) on('ambush');
  else if (arachnids >= 2) near('ambush', 'a flyer as bait');
  else if (arachnids === 1 && bait >= 1) near('ambush', '1 more arachnid');

  const night = count((t) => t.night);
  if (night >= 3 && isNightHour(hour)) on('night_shift');
  else if (night >= 3) near('night_shift', 'launch between 9pm and 5am');
  else if (night === 2) near('night_shift', '1 more night bug');

  const diggers = count((t) => t.digger);
  if (diggers >= 3) on('tunnel_network');
  else if (diggers === 2) near('tunnel_network', '1 more digger');

  const distinctFamilies = Object.keys(families).length;
  if (full && distinctFamilies === 4) on('ecosystem');
  else if (distinctFamilies === 3 && party.length === 3) near('ecosystem', 'a bug from a 4th family');

  const hasBig = tags.some((t) => t.rank >= EPIC);
  const hasSmall = tags.some((t) => t.rank <= COMMON);
  if (hasBig && hasSmall) on('mentor');
  else if (hasBig) near('mentor', 'a Drab or Common bug');
  else if (hasSmall) near('mentor', 'an Epic-or-better bug');

  const electric = tags.filter((t) => t.electric);
  const conductor = electric.some((e) => tags.some((w) => w !== e && w.water));
  if (conductor) on('conductor');
  else if (electric.length) near('conductor', 'a water bug');
  else if (water) near('conductor', 'an electric bug');

  const magical = count((t) => t.magical);
  if (magical >= 2) on('leyline');
  else if (magical === 1) near('leyline', '1 more aura or special-effect bug');

  const hoppers = families.hopper || 0;
  if (hoppers >= 3) on('leapfrog');
  else if (hoppers === 2) near('leapfrog', '1 more hopper');

  const most = Math.max(...Object.values(species));
  if (most >= 2) on('bonded', { n: most });

  const ranks = new Set(tags.map((t) => t.rank)).size;
  if (full && ranks === 4) on('spectrum');
  else if (ranks === 3 && party.length === 3) near('spectrum', 'a bug of a 4th rarity');

  for (const id of ['lure', 'unseen', 'midas']) {
    const n = party.filter((b) => b.variant === SYNERGIES[id].variant).length;
    if (n) on(id, { n: VARIANT_STACK[Math.min(n, VARIANT_STACK.length - 1)] });
  }
  const variants = new Set(party.map((b) => b.variant).filter(Boolean)).size;
  if (variants === 3) on('prismatic');
  else if (variants === 2) near('prismatic', 'the third variant');

  return { active, hints };
}

// The party as the bonuses make it: Ecosystem and Bonded raise traits. These
// are copies; the real bugs are never changed.
export function boostedParty(party, active) {
  const groups = {};
  for (const b of party) groups[b.species] = (groups[b.species] || 0) + 1;
  return party.map((b) => {
    const traits = { ...b.traits };
    if (active.ecosystem) for (const t of Object.keys(traits)) traits[t] += SYNERGIES.ecosystem.plus;
    if (active.bonded && groups[b.species] >= 2) {
      const sig = SPECIES[b.species].traits[0];
      traits[sig] = (traits[sig] || 0) + (groups[b.species] >= 3 ? SYNERGIES.bonded.triplets : SYNERGIES.bonded.twins);
    }
    return { ...b, traits };
  });
}

// Trait scores for checks, with Hive Mind's shared minds.
export function synergyScores(boosted, active) {
  const scores = partyTraitScores(boosted);
  if (active.hive_mind) {
    for (const s of Object.values(scores)) {
      const lvl = s.bestLevel + SYNERGIES.hive_mind.plus;
      s.score = traitScore(Array(boosted.length).fill(lvl));
    }
  }
  return scores;
}

// What a bug is worth for trip speed. Mentor lifts Drab and Common bugs to
// what a typical bug two rarities up would bring.
function typicalPower(rank, traits) {
  const r = RARITIES[RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, rank)]];
  const count = Math.max(traits, r.traitCount.reduce((s, [c, w]) => s + c * w, 0) / r.traitCount.reduce((s, [, w]) => s + w, 0));
  return ((r.traitLevels[0] + r.traitLevels[1]) / 2) * count;
}

export function synergyPower(boosted, active) {
  return boosted.reduce((sum, b) => {
    const own = traitTotal(b);
    const rank = RARITY_ORDER.indexOf(SPECIES[b.species].rarity);
    if (active.mentor && rank <= COMMON) return sum + Math.max(own, typicalPower(rank + SYNERGIES.mentor.up, Object.keys(b.traits).length));
    return sum + own;
  }, 0);
}

// How much faster every encounter runs (a multiplier on its time).
export function synergySpeed(active) {
  let f = 1;
  if (active.night_shift) f *= 1 - SYNERGIES.night_shift.speed;
  if (active.unseen) f *= 1 - SYNERGIES.unseen.speed * active.unseen.n;
  return Math.max(SYNERGY_LIMITS.minSpeedFactor, f);
}

// Extra coin multiplier (added to the base 1).
export function synergyCoins(active) {
  return (active.spectrum ? SYNERGIES.spectrum.coinMult : 0) + (active.midas ? SYNERGIES.midas.coinMult * active.midas.n : 0);
}

// Roughly how much of the normal trip time the skips and instant finishes
// save, for estimates before launch (the real trip is rolled at launch).
export function expectedTimeShare(active) {
  let share = 1;
  const w = SYNERGY_LIMITS.instantWeight;
  if (active.tailwind) share -= (1 - w) / SYNERGIES.tailwind.every;
  if (active.leapfrog) share *= 1 - SYNERGIES.leapfrog.chance * (1 - w);
  return share;
}
