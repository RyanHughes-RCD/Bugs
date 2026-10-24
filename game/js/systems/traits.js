import { TRAIT_CHECK } from '../data/balance.js';
import { effectiveTraits } from './bugs.js';

// A party's strength in one trait: its best bugs, with diminishing weight.
export function traitScore(levels, cfg = TRAIT_CHECK) {
  return [...levels].filter((l) => l > 0).sort((a, b) => b - a)
    .reduce((s, l, i) => s + l * (cfg.weights[i] ?? 0), 0);
}

export function partyTraitScores(party) {
  const out = {};
  const traitsByBug = party.map((b) => ({ bug: b, t: effectiveTraits(b) }));
  for (const { t } of traitsByBug) for (const k of Object.keys(t)) out[k] = null;
  for (const k of Object.keys(out)) {
    const holders = traitsByBug.filter((x) => x.t[k] > 0).sort((a, b) => b.t[k] - a.t[k]);
    out[k] = { score: traitScore(holders.map((h) => h.t[k])), best: holders[0].bug, bestLevel: holders[0].t[k], count: holders.length };
  }
  return out;
}

export function checkChance(score, difficulty, cfg = TRAIT_CHECK) {
  if (score <= 0) return cfg.noTraitChance;
  return Math.min(cfg.max, Math.max(cfg.min, cfg.base + cfg.slope * (score - difficulty)));
}

// Resolves a trait check. With several acceptable traits the party uses its
// strongest one. Returns everything needed to explain the result in the log.
export function resolveCheck(scores, traits, difficulty, rng, cfg = TRAIT_CHECK) {
  let pick = { trait: traits[0], score: 0, best: null };
  for (const t of traits) {
    const s = scores[t];
    if (s && s.score > pick.score) pick = { trait: t, score: s.score, best: s.best };
  }
  const chance = checkChance(pick.score, difficulty, cfg);
  const success = rng.chance(chance);
  const great = success && pick.score > 0 && pick.score - difficulty >= cfg.greatMargin;
  return { trait: pick.trait, score: Math.round(pick.score * 10) / 10, difficulty, chance, success, great, bug: pick.best };
}
