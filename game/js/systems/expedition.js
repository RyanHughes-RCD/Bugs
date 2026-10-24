import { Rng } from '../core/rng.js';
import { GUARDIAN_RUNS } from '../data/areas.js';
import { SPECIES, RARITIES, speciesForArea } from '../data/species.js';
import { ITEMS } from '../data/items.js';
import { BASE_SHINY_CHANCE } from '../data/eggs.js';
import { teamBonuses, rollTraits, computeStats, power, traitValue } from './bugs.js';
import { allyCombatant, enemyCombatant, runBattle } from './battle.js';

export const MAX_TEAM = 4;

export const ENCOUNTER_WEIGHTS = [['battle', 45], ['treasure', 18], ['hazard', 12], ['nest', 8], ['rest', 8], ['wanderer', 9]];

export function expeditionSlots(state) {
  return 1 + (state.upgrades.camp || 0);
}

export function supplySlots(state) {
  return 1 + (state.upgrades.satchel || 0);
}

export function expeditionDurationMs(state, area, teamBugs) {
  const tb = teamBonuses(teamBugs);
  return Math.round(area.durationMs * (1 - 0.08 * (state.upgrades.trail_maps || 0)) * (1 + tb.duration));
}

export function guardianDue(state, areaId) {
  const a = state.areas[areaId];
  return !a.guardianDefeated && a.runs >= GUARDIAN_RUNS;
}

// Team power a player should have for an area to go reasonably well.
export function recommendedPower(area) {
  return area.recPower;
}

export function teamPower(state, bugs, areaId = null) {
  return bugs.reduce((s, b) => s + power(computeStats(b, state, { areaId })), 0);
}

function rollLoot(area, rng) {
  return rng.weighted(area.loot);
}

function addItem(result, id, n = 1) {
  result.items[id] = (result.items[id] || 0) + n;
}

// Pre-rolls the entire expedition from a seed. The events are revealed over
// time by the UI and rewards are only applied when the player collects, so a
// reload mid-expedition always shows the same story.
export function planExpedition(state, area, teamBugs, supplies, seed) {
  const rng = new Rng(seed);
  const allies = teamBugs.map((b) => allyCombatant(b, state, area.id));
  const tb = teamBonuses(teamBugs);
  const sup = { capture: 0, loot: 0, snack: 0, revive: 0 };
  for (const s of supplies) for (const [k, v] of Object.entries(ITEMS[s]?.supply || {})) sup[k] += v;
  const lootMult = 1 + tb.loot + sup.loot + 0.1 * (state.upgrades.explorer_pack || 0);
  const captureBonus = tb.capture + sup.capture + 0.05 * (state.upgrades.silk_nets || 0);
  let snackLeft = sup.snack > 0;
  let reviveLeft = sup.revive > 0;
  const hooks = {
    onFaint(c) {
      if (!reviveLeft) return false;
      reviveLeft = false;
      c.hp = Math.round(c.maxHp * sup.revive);
      return true;
    },
    afterHit(c) {
      if (!snackLeft || c.hp >= c.maxHp / 2) return null;
      snackLeft = false;
      for (const a of allies) if (a.hp > 0) a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * sup.snack));
      return 'The team shared some trail mix and feels refreshed!';
    },
  };

  const areaState = state.areas[area.id];
  const firstGuardian = guardianDue(state, area.id);
  const guardian = firstGuardian || (areaState.guardianDefeated && rng.chance(0.15));

  const kinds = [];
  for (let i = 0; i < area.encounters; i++) kinds.push(rng.weighted(ENCOUNTER_WEIGHTS));
  if (!kinds.includes('battle')) kinds[0] = 'battle';
  if (guardian) kinds.push('guardian');

  const result = {
    coins: 0, items: {}, eggs: [], captures: [], xp: {}, seen: [],
    guardianFought: guardian, guardianDefeated: false, firstGuardianWin: false, retreated: false,
    hp: {}, maxHp: {}, fainted: [],
  };
  for (const a of allies) result.xp[a.uid] = 0;

  const alive = () => allies.filter((a) => a.hp > 0);
  const giveXp = (amount) => {
    for (const a of alive()) result.xp[a.uid] += amount;
  };
  const coins = (n) => {
    const v = Math.round(n * lootMult);
    result.coins += v;
    return v;
  };
  const tryCapture = (enemies) => {
    for (const e of enemies) {
      const chance = Math.min(0.9, RARITIES[SPECIES[e.species].rarity].capture + captureBonus);
      if (rng.chance(chance)) {
        const cap = { species: e.species, level: e.level, traits: e.traits, shiny: rng.chance(BASE_SHINY_CHANCE) };
        result.captures.push(cap);
        return cap;
      }
    }
    return null;
  };
  const wildPool = speciesForArea(area.id).map((s) => [s.id, RARITIES[s.rarity].weight]);
  const makeWild = () => {
    const id = rng.weighted(wildPool);
    const lvl = rng.int(area.levels[0], area.levels[1]);
    if (!result.seen.includes(id)) result.seen.push(id);
    return enemyCombatant(id, lvl, rollTraits(rng, SPECIES[id].rarity));
  };

  const handlers = {
    battle() {
      const count = rng.int(1, Math.min(area.maxEnemies, Math.max(1, alive().length)));
      const enemies = Array.from({ length: count }, makeWild);
      const names = enemies.map((e) => `${SPECIES[e.species].name} Lv${e.level}`).join(', ');
      const res = runBattle(allies, enemies, rng, { hooks });
      const ev = { kind: 'battle', title: 'Wild encounter!', text: `The team ran into ${names}.`, lines: res.lines, won: res.won };
      if (res.won) {
        giveXp(enemies.reduce((s, e) => s + e.level * 6, 0));
        const c = coins(enemies.reduce((s, e) => s + e.level * 2, 0));
        const cap = tryCapture(rng.shuffle(enemies));
        ev.result = `Victory! +${c} coins.` + (cap ? ` Caught a ${SPECIES[cap.species].name}!` : '');
        ev.capture = cap;
      } else {
        ev.result = alive().length ? 'Both sides backed away.' : 'The team was overwhelmed.';
      }
      return ev;
    },
    treasure() {
      const c = coins(rng.int(area.coins[0], area.coins[1]) * 2);
      const found = [];
      if (rng.chance(0.75)) found.push(rollLoot(area, rng));
      if (rng.chance(Math.min(0.9, lootMult - 1))) found.push(rollLoot(area, rng));
      for (const id of found) addItem(result, id);
      return {
        kind: 'treasure', title: 'Hidden stash', text: 'Something glints under a leaf.',
        result: `+${c} coins` + (found.length ? `, ${found.map((id) => ITEMS[id].name).join(', ')}` : '') + '.', items: found,
      };
    },
    hazard() {
      const text = rng.pick(area.hazards) + '!';
      const team = alive();
      const avgSpd = team.reduce((s, a) => s + a.spd, 0) / team.length;
      const expected = 10 * (1 + 0.1 * (area.levels[1] - 1));
      const pass = Math.min(0.9, Math.max(0.15, 0.45 + (avgSpd - expected) / expected));
      if (rng.chance(pass)) {
        giveXp(area.levels[1] * 3);
        return { kind: 'hazard', title: 'Danger!', text, result: 'Everyone scrambled clear just in time.' };
      }
      for (const a of team) a.hp = Math.max(1, a.hp - Math.round(a.maxHp * rng.float(0.1, 0.22) * (25 / (25 + a.def)) * 1.6));
      return { kind: 'hazard', title: 'Danger!', text, result: 'The team got knocked about.', hurt: true };
    },
    nest() {
      const type = rng.chance(0.06 * lootMult) ? 'golden_egg' : area.eggType;
      result.eggs.push(type);
      return { kind: 'nest', title: 'An abandoned nest', text: 'Tucked in the grass sits a lonely egg.', result: `Found a ${type === 'golden_egg' ? 'Golden Egg' : 'new egg'}!`, egg: type };
    },
    rest() {
      for (const a of alive()) a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * 0.35));
      return { kind: 'rest', title: 'A quiet clearing', text: 'The team rests in the shade.', result: 'Everyone recovered some HP.' };
    },
    wanderer() {
      const wild = makeWild();
      const name = SPECIES[wild.species].name;
      if (rng.chance(0.5)) {
        const id = rollLoot(area, rng);
        addItem(result, id);
        return { kind: 'wanderer', title: 'A friendly face', text: `A ${name} waves hello.`, result: `It shared a ${ITEMS[id].name}!`, items: [id] };
      }
      if (rng.chance(Math.min(0.9, 0.4 + captureBonus))) {
        const cap = { species: wild.species, level: area.levels[0], traits: wild.traits, shiny: rng.chance(BASE_SHINY_CHANCE) };
        result.captures.push(cap);
        return { kind: 'wanderer', title: 'A friendly face', text: `A lost ${name} wanders up.`, result: `It decided to join your garden!`, capture: cap };
      }
      return { kind: 'wanderer', title: 'A friendly face', text: `A shy ${name} peeks out.`, result: 'It scurried away before you could say hi.' };
    },
    guardian() {
      const g = area.guardian;
      const rematch = areaState.guardianDefeated;
      if (!result.seen.includes(g.species)) result.seen.push(g.species);
      const boss = enemyCombatant(g.species, g.level + (rematch ? 2 : 0), [], g.mult, g.name);
      const res = runBattle(allies, [boss], rng, { guardian: true, hooks });
      const ev = { kind: 'guardian', title: `Guardian: ${g.name}`, text: `${g.name} blocks the path home!`, lines: res.lines, won: res.won };
      if (res.won) {
        result.guardianDefeated = true;
        result.firstGuardianWin = !rematch;
        giveXp(boss.level * 20);
        const c = coins(area.coins[1] * 8);
        const egg = rng.chance(rematch ? 0.3 : 1) ? (rematch ? 'golden_egg' : area.eggType) : null;
        if (egg) result.eggs.push(egg);
        const loot = [rollLoot(area, rng), rollLoot(area, rng)];
        for (const id of loot) addItem(result, id);
        ev.result = `The Guardian is defeated! +${c} coins` + (egg ? ', an egg' : '') + `, ${loot.map((id) => ITEMS[id].name).join(', ')}.`;
      } else {
        ev.result = 'The Guardian was too strong this time.';
      }
      return ev;
    },
  };

  const events = [];
  for (const kind of kinds) {
    if (!alive().length) break;
    const ev = handlers[kind]();
    for (const a of alive()) if (a.regen) a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * a.regen));
    events.push(ev);
  }
  if (!alive().length) {
    result.retreated = true;
    events.push({ kind: 'retreat', title: 'Retreat!', text: 'Every bug fainted. The team limps home.', result: 'Loot found so far is kept.' });
  } else {
    events.push({ kind: 'home', title: 'Home again', text: 'The team returns to the garden.', result: 'Ready to collect rewards!' });
  }

  for (const a of allies) {
    result.hp[a.uid] = a.hp;
    result.maxHp[a.uid] = a.maxHp;
    if (a.hp <= 0) result.fainted.push(a.uid);
  }
  for (const b of teamBugs) result.xp[b.uid] = Math.round(result.xp[b.uid] * (1 + traitValue(b, 'xp')));

  // A retreat brings the team home early.
  const planned = kinds.length + 1;
  const lengthFraction = result.retreated ? Math.max(0.35, events.length / planned) : 1;
  events.forEach((e, i) => { e.at = (i + 1) / events.length; });
  return { events, result, lengthFraction };
}

export function expeditionProgress(exp, now) {
  const elapsed = now - exp.startAt + (exp.bonusMs || 0);
  const fraction = Math.min(1, Math.max(0, elapsed / exp.durationMs));
  return { fraction, done: fraction >= 1, remainingMs: Math.max(0, exp.durationMs - elapsed), endsAt: now + Math.max(0, exp.durationMs - elapsed) };
}

export function restDurationMs(state, area, hp, maxHp) {
  const leaf = 1 - 0.12 * (state.upgrades.leaf_bed || 0);
  if (hp <= 0) return Math.round(area.restMs * 1.5 * leaf);
  return Math.round(area.restMs * (1 - hp / maxHp) * leaf);
}
