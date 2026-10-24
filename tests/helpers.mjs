import { Game } from '../game/js/game.js';
import { memoryStorage } from '../game/js/core/save.js';
import { Rng } from '../game/js/core/rng.js';
import { createBug } from '../game/js/systems/bugs.js';

export const T0 = Date.UTC(2026, 0, 1, 12);
export const MIN = 60e3;
export const HOUR = 60 * MIN;

// A game on a fake clock and in-memory storage. Advance time with clock.t += ms.
export function makeGame({ seed = 12345, storage = memoryStorage(), clock = { t: T0 } } = {}) {
  const game = new Game({ storage, clock: () => clock.t, seed });
  game.load();
  return { game, clock, storage };
}

// Adds a bug with exact traits, for deterministic trait tests.
export function addBug(game, species, traits, extra = {}) {
  const { bug } = createBug(game.state, species, new Rng(game.state.nextUid), { traits, shiny: false });
  Object.assign(bug, extra);
  return bug;
}

export const partyUids = (game) => game.state.bugs.slice(0, 4).map((b) => b.uid);
