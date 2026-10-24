import { GARDEN_FORAGE, ROCK } from '../data/balance.js';
import { RARITIES } from '../data/rarities.js';
import { rarityOf } from './bugs.js';

// Garden bugs slowly forage coins into a capped pot. They keep earning while
// away on an expedition (their garden place is kept for them).
export function gardenRatePerMin(state) {
  return state.bugs.filter((b) => b.inGarden).reduce((s, b) => s + RARITIES[rarityOf(b)].forage, 0);
}

export function tickGarden(state, now) {
  const g = state.garden;
  const dt = Math.max(0, now - g.lastTick);
  if (g.pot < GARDEN_FORAGE.cap) g.pot = Math.min(GARDEN_FORAGE.cap, g.pot + (gardenRatePerMin(state) * dt) / 60e3);
  g.lastTick = now;
}

// ---------- the rock ----------

export function defaultRock(now) {
  // Starts settled, with its dirt patch already formed.
  return { x: ROCK.start.x, y: ROCK.start.y, placedAt: now - ROCK.formMs };
}

// How formed the dirt patch under the rock is (0..1). It takes ROCK.formMs to
// form fully at a new spot.
export function patchStrength(rock, now) {
  return Math.min(1, Math.max(0, (now - rock.placedAt) / ROCK.formMs));
}

// Dirt patches to draw: the one forming under the rock, plus patches left
// behind by earlier moves. A left-behind patch stays for ROCK.lingerMs, then
// fades out over ROCK.fadeMs.
export function dirtPatches(garden, now) {
  const out = [{ x: garden.rock.x, y: garden.rock.y, alpha: patchStrength(garden.rock, now), underRock: true }];
  for (const w of garden.welts || []) {
    const age = now - w.leftAt;
    if (age >= ROCK.lingerMs + ROCK.fadeMs) continue;
    const fade = age <= ROCK.lingerMs ? 1 : 1 - (age - ROCK.lingerMs) / ROCK.fadeMs;
    out.push({ x: w.x, y: w.y, alpha: w.strength * fade, underRock: false });
  }
  return out;
}

// Moves the rock. Whatever patch it had formed is left behind to linger.
export function moveRock(garden, x, y, now) {
  const rock = garden.rock;
  if (Math.hypot(x - rock.x, y - rock.y) < 3) return false;
  const strength = patchStrength(rock, now);
  garden.welts = (garden.welts || []).filter((w) => now - w.leftAt < ROCK.lingerMs + ROCK.fadeMs);
  if (strength > 0.02) garden.welts.push({ x: rock.x, y: rock.y, strength, leftAt: now });
  garden.rock = { x, y, placedAt: now };
  return true;
}
