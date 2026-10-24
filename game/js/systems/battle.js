import { SPECIES } from '../data/species.js';
import { computeStats, traitValue, bugName } from './bugs.js';

const MAX_ROUNDS = 40;

export function allyCombatant(bug, state, areaId) {
  const stats = computeStats(bug, state, { areaId });
  return {
    uid: bug.uid, side: 'ally', name: bugName(bug), species: bug.species, level: bug.level,
    maxHp: stats.hp, hp: stats.hp, atk: stats.atk, def: stats.def, spd: stats.spd,
    dodge: traitValue(bug, 'dodge'), crit: traitValue(bug, 'crit'),
    regen: traitValue(bug, 'regen'), guardianAtk: traitValue(bug, 'guardianAtk'),
  };
}

// Wild bugs use the same stat formula as yours, without upgrades or gear.
export function enemyCombatant(speciesId, level, traits = [], mult = null, name = null) {
  const sp = SPECIES[speciesId];
  const fake = { species: speciesId, level, traits, shiny: false, gear: null };
  const stats = computeStats(fake, { upgrades: {} });
  const m = mult || {};
  const hp = Math.round(stats.hp * (m.hp || 1));
  return {
    uid: null, side: 'enemy', name: name || `Wild ${sp.name}`, species: speciesId, level, traits,
    maxHp: hp, hp, atk: Math.round(stats.atk * (m.atk || 1)), def: Math.round(stats.def * (m.def || 1)),
    spd: Math.round(stats.spd * (m.spd || 1)), dodge: 0, crit: 0, regen: 0, guardianAtk: 0,
  };
}

export function damageRoll(attacker, defender, rng, { guardian = false } = {}) {
  let dmg = attacker.atk * (0.85 + 0.3 * rng.next()) * (25 / (25 + defender.def));
  if (guardian && attacker.side === 'ally') dmg *= 1 + attacker.guardianAtk;
  let crit = false;
  if (attacker.crit && rng.chance(attacker.crit)) { dmg *= 1.6; crit = true; }
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

// Auto-battle. Allies keep their HP between battles, so pass the same objects
// through a whole expedition. hooks.onFaint(c) may revive (return true) and
// hooks.afterHit(c) may heal the team.
export function runBattle(allies, enemies, rng, { guardian = false, hooks = {} } = {}) {
  const lines = [];
  const fainted = [];
  let rounds = 0;
  const alive = (list) => list.filter((c) => c.hp > 0);
  while (rounds < MAX_ROUNDS && alive(allies).length && alive(enemies).length) {
    rounds += 1;
    const order = [...alive(allies), ...alive(enemies)]
      .map((c) => ({ c, init: c.spd * (0.85 + 0.3 * rng.next()) }))
      .sort((a, b) => b.init - a.init)
      .map((o) => o.c);
    for (const actor of order) {
      if (actor.hp <= 0) continue;
      const foes = alive(actor.side === 'ally' ? enemies : allies);
      if (!foes.length) break;
      const target = rng.pick(foes);
      if (target.dodge && rng.chance(target.dodge)) {
        if (lines.length < 12) lines.push(`${target.name} dodged ${actor.name}!`);
        continue;
      }
      const { dmg, crit } = damageRoll(actor, target, rng, { guardian });
      target.hp = Math.max(0, target.hp - dmg);
      if (crit && lines.length < 12) lines.push(`${actor.name} landed a venomous strike for ${dmg}!`);
      if (target.hp === 0) {
        if (target.side === 'ally') {
          if (hooks.onFaint?.(target)) {
            lines.push(`${target.name} fainted... but the smelling salts revived it!`);
          } else {
            fainted.push(target.uid);
            lines.push(`${target.name} fainted.`);
          }
        } else {
          lines.push(`${actor.name} defeated ${target.name}.`);
        }
      } else if (target.side === 'ally') {
        const healed = hooks.afterHit?.(target);
        if (healed) lines.push(healed);
      }
    }
  }
  return { won: alive(enemies).length === 0 && alive(allies).length > 0, rounds, lines, fainted };
}
