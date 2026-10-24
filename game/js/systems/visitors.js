import { GARDEN_LIMIT, VISITORS, ROCK_FIND, MINUTE, HOUR } from '../data/balance.js';
import { SPECIES_LIST } from '../data/species.js';
import { bugsOnExpedition } from './bugs.js';
import { patchStrength } from './garden.js';

// Places in the garden not taken by bugs that are actually home right now.
export function freeGardenSpots(state) {
  const away = bugsOnExpedition(state);
  return GARDEN_LIMIT - state.bugs.filter((b) => b.inGarden && !away.has(b.uid)).length;
}

function rollGap(rng) {
  return rng.float(VISITORS.everyMin[0], VISITORS.everyMin[1]) * MINUTE;
}

function newVisitor(state, rng, at) {
  const rarity = rng.weighted(VISITORS.rarity);
  const pool = SPECIES_LIST.filter((s) => s.rarity === rarity);
  return {
    id: state.nextUid++,
    species: rng.pick(pool).id,
    arrivedAt: at,
    leavesAt: at + rng.float(VISITORS.stayMin[0], VISITORS.stayMin[1]) * MINUTE,
    greeted: false,
  };
}

// Brings visitors in and sends them home, from timestamps, so arrivals keep
// happening while the app is closed. Returns true if anything changed.
export function tickVisitors(state, now, rng) {
  const g = state.garden;
  const before = g.visitors.length;
  g.visitors = g.visitors.filter((v) => v.leavesAt > now);
  let changed = g.visitors.length !== before;
  if (!g.nextVisitAt) {
    g.nextVisitAt = now + rollGap(rng);
    return true;
  }
  let t = Math.max(g.nextVisitAt, now - VISITORS.catchUpHours * HOUR);
  while (t <= now) {
    const room = Math.min(VISITORS.max, freeGardenSpots(state)) - g.visitors.filter((v) => v.leavesAt > t).length;
    if (room > 0) {
      const v = newVisitor(state, rng, t);
      if (v.leavesAt > now) g.visitors.push(v);
    }
    t += rollGap(rng);
    changed = true;
  }
  g.nextVisitAt = t;
  return changed;
}

// A visitor's thank-you gift for being greeted.
export function rollVisitorGift(rng) {
  if (rng.chance(VISITORS.eggChance)) return { egg: rng.weighted(VISITORS.eggs) };
  return { coins: rng.int(VISITORS.coins[0], VISITORS.coins[1]) };
}

// Whether something is waiting under the rock: its patch has fully formed and
// nobody has looked yet.
export function rockFindReady(garden, now) {
  return patchStrength(garden.rock, now) >= 1 && !garden.rock.searched;
}

export function rollRockFind(rng) {
  if (rng.chance(ROCK_FIND.eggChance)) return { egg: rng.weighted(ROCK_FIND.eggs) };
  if (rng.chance(ROCK_FIND.coinChance)) return { coins: rng.int(ROCK_FIND.coins[0], ROCK_FIND.coins[1]) };
  return {};
}
