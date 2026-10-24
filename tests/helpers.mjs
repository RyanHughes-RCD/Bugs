import { Game } from '../game/js/game.js';
import { memoryStorage } from '../game/js/core/save.js';

export const T0 = Date.UTC(2026, 0, 1, 12);

// A game on a fake clock and in-memory storage. Advance time with clock.t += ms.
export function makeGame({ seed = 12345, storage = memoryStorage(), clock = { t: T0 } } = {}) {
  const game = new Game({ storage, clock: () => clock.t, seed });
  game.load();
  return { game, clock, storage };
}

export function finishExpedition(game, clock, exp) {
  clock.t += exp.durationMs + 1;
  return game.collectExpedition(exp.id);
}
