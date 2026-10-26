import { GARDEN_FORAGE, ROCK } from '../data/balance.js';
import { RARITIES } from '../data/rarities.js';
import { SPECIES } from '../data/species.js';
import { DECOR, DECOR_BY_ID } from '../data/decor.js';
import { rarityOf } from './bugs.js';

// ---------- decorations ----------

export function ownsDecor(state, id) {
  return id === 'rock' || !!state.garden.decor[id];
}

// The owned decoration this species loves most, or null.
export function favouriteDecor(state, speciesId) {
  const sp = SPECIES[speciesId];
  return DECOR.filter((d) => ownsDecor(state, d.id) && d.loves(sp)).sort((a, b) => b.bonus - a.bonus)[0] || null;
}

export function potCap(state) {
  return GARDEN_FORAGE.cap + DECOR.reduce((s, d) => s + (ownsDecor(state, d.id) && d.potCap ? d.potCap : 0), 0);
}

// A placed decoration's footprint in map pixels, centred on its spot.
export function decorRect(id, x, y) {
  const d = DECOR_BY_ID[id];
  const w = d.size[0] * d.scale;
  const h = d.size[1] * d.scale;
  return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2, w, h };
}

const ROCK_SIZE = { w: 48, h: 33 }; // matches the rock sprite drawn by the garden scene
const BOUNDS = { x0: 4, x1: 146, y0: 30, y1: 284 };

// Whether a draggable decoration fits at (x, y): inside the garden and clear
// of the rock and every other placed decoration.
export function decorFits(garden, id, x, y) {
  const r = decorRect(id, x, y);
  if (r.x0 < BOUNDS.x0 || r.x1 > BOUNDS.x1 || r.y0 < BOUNDS.y0 || r.y1 > BOUNDS.y1) return false;
  const hit = (o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0;
  const rk = garden.rock;
  if (hit({ x0: rk.x - ROCK_SIZE.w / 2, x1: rk.x + ROCK_SIZE.w / 2, y0: rk.y - ROCK_SIZE.h * 0.62, y1: rk.y + ROCK_SIZE.h * 0.38 })) return false;
  for (const [other, spot] of Object.entries(garden.decor)) {
    if (other === id || DECOR_BY_ID[other].fixed || !spot) continue;
    if (hit(decorRect(other, spot.x, spot.y))) return false;
  }
  return true;
}

// The first free spot for a newly bought decoration, starting from the
// middle of the garden (where the view usually is) and working outwards.
export function freeDecorSpot(garden, id) {
  const rows = [];
  for (let k = 0; k <= 20; k++) rows.push(150 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12);
  for (const y of rows) {
    for (const x of [110, 40, 75, 128, 22]) if (decorFits(garden, id, x, y)) return { x, y };
  }
  return null;
}

// ---------- foraging ----------

// Garden bugs slowly forage coins into a capped pot. They keep earning while
// away on an expedition (their garden place is kept for them). A bug foraging
// beside a decoration it loves earns that decoration's bonus.
export function bugForageRate(state, bug) {
  const fav = favouriteDecor(state, bug.species);
  return RARITIES[rarityOf(bug)].forage * (1 + (fav ? fav.bonus : 0));
}

export function gardenRatePerMin(state) {
  return state.bugs.filter((b) => b.inGarden).reduce((s, b) => s + bugForageRate(state, b), 0);
}

export function tickGarden(state, now) {
  const g = state.garden;
  const dt = Math.max(0, now - g.lastTick);
  const cap = potCap(state);
  if (g.pot < cap) g.pot = Math.min(cap, g.pot + (gardenRatePerMin(state) * dt) / 60e3);
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
