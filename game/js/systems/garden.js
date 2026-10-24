import { GARDEN_FORAGE } from '../data/balance.js';
import { rarityOf, bugsOnExpedition } from './bugs.js';

// Garden bugs (not away exploring) slowly forage coins into a capped pot.
export function gardenRatePerMin(state) {
  const away = bugsOnExpedition(state);
  return state.bugs.filter((b) => b.inGarden && !away.has(b.uid)).reduce((s, b) => s + GARDEN_FORAGE.perMinute[rarityOf(b)], 0);
}

export function tickGarden(state, now) {
  const g = state.garden;
  const dt = Math.max(0, now - g.lastTick);
  if (g.pot < GARDEN_FORAGE.cap) g.pot = Math.min(GARDEN_FORAGE.cap, g.pot + (gardenRatePerMin(state) * dt) / 60e3);
  g.lastTick = now;
}
