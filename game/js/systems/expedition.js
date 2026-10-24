import { Rng } from '../core/rng.js';
import { ENCOUNTERS, CHEST } from '../data/encounters.js';
import { ITEMS, MAX_ITEM_SPEED } from '../data/items.js';
import { BASE_ENCOUNTER_MS, BASE_EXPEDITION_SLOTS, PARTY_SIZE, XP } from '../data/balance.js';
import { upgradeValue } from '../data/upgrades.js';
import { partyTraitScores, resolveCheck } from './traits.js';
import { effectiveTraits, bugName } from './bugs.js';

export function expeditionSlots(state) {
  return BASE_EXPEDITION_SLOTS + upgradeValue(state, 'improved_exploration').slots;
}

// Equipment effects shared by the whole party.
export function partyBonuses(party) {
  const out = { encounterSpeed: 0, coinBonus: 0, specialFind: 0, keys: [] };
  for (const b of party) {
    const fx = ITEMS[b.item]?.effects;
    if (!fx) continue;
    out.encounterSpeed += fx.encounterSpeed || 0;
    out.coinBonus += fx.coinBonus || 0;
    out.specialFind += fx.specialFind || 0;
    if (fx.key) out.keys.push(b.uid);
  }
  out.encounterSpeed = Math.min(MAX_ITEM_SPEED, out.encounterSpeed);
  return out;
}

// Length of every encounter on an expedition with this party, fixed at launch.
export function encounterMs(state, party) {
  const eff = upgradeValue(state, 'expedition_efficiency');
  return Math.round(BASE_ENCOUNTER_MS * (1 - eff) * (1 - partyBonuses(party).encounterSpeed));
}

function pickIntro(def, area, rng) {
  const intro = def.intro;
  const opts = typeof intro === 'string' ? [intro] : Array.isArray(intro) ? intro : [].concat(intro[area.id] || Object.values(intro)[0]);
  return rng.pick(opts);
}

function fill(text, ctx) {
  return text.replace('{bug}', ctx.bug ?? 'The party').replace('{trait}', ctx.trait ?? '');
}

export function encounterPool(area, party) {
  const scores = partyTraitScores(party);
  return ENCOUNTERS.filter((e) => (!e.areas || e.areas.includes(area.id)) && (!e.needsTrait || scores[e.needsTrait]));
}

// Builds and resolves every encounter of an expedition from one seed. The
// result is saved with the expedition and revealed over time, so reopening
// screens or reloading never rerolls anything.
export function planExpedition(state, area, party, seed) {
  const rng = new Rng(seed);
  const count = rng.int(area.encounters[0], area.encounters[1]);
  const bonus = partyBonuses(party);
  const special = 1 + upgradeValue(state, 'improved_exploration').specialFind + bonus.specialFind;
  const coinMult = 1 + upgradeValue(state, 'better_finds') + bonus.coinBonus;
  const scores = partyTraitScores(party);
  const keys = [...bonus.keys];
  const used = {};
  const pool = encounterPool(area, party);
  const names = Object.fromEntries(party.map((b) => [b.uid, bugName(b)]));
  const xp = Object.fromEntries(party.map((b) => [b.uid, 0]));

  const rollCoins = (range) => (range ? Math.round(rng.float(range[0], range[1]) * area.coinBase * coinMult) : 0);
  const rollLoot = (table) => rng.weighted(table);
  const gearOnly = area.loot.filter(([id]) => ITEMS[id].type === 'gear' && id !== 'key');

  const applyOutcome = (o, rec) => {
    rec.coins += rollCoins(o.coins);
    const add = (id, n = 1) => { rec.items[id] = (rec.items[id] || 0) + n; };
    for (const [id, n] of o.items || []) add(id, n);
    if (o.loot && rng.chance(Math.min(1, o.loot * Math.sqrt(special)))) add(rollLoot(area.loot));
    if (o.gear && rng.chance(o.gear)) add(rollLoot(gearOnly));
    if (o.egg && rng.chance(Math.min(1, o.egg))) rec.eggs.push(rollLoot(area.eggs));
    if (o.xp) for (const uid of Object.keys(xp)) xp[uid] += o.xp;
  };

  const encounters = [];
  let last = null;
  for (let i = 0; i < count; i++) {
    const options = pool.filter((e) => e.id !== last && (!e.maxPerRun || (used[e.id] || 0) < e.maxPerRun));
    const def = rng.weighted(options.map((e) => [e, e.weight * (e.special ? special : 1)]));
    used[def.id] = (used[def.id] || 0) + 1;
    last = def.id;
    const rec = { id: def.id, category: def.category, intro: pickIntro(def, area, rng), text: '', outcome: 'neutral', coins: 0, items: {}, eggs: [] };

    if (def.category === 'chest') {
      if (keys.length) {
        const uid = keys.shift();
        rec.outcome = 'opened';
        rec.keyUsedBy = uid;
        rec.bugUid = uid;
        rec.text = `${names[uid]} unlocks it with a Chest Key!`;
        rec.coins = Math.round(rng.float(0.8, 1.2) * area.coinBase * area.chest.coins * coinMult);
        const n = rng.int(CHEST.lootRolls[0], CHEST.lootRolls[1]);
        for (let k = 0; k < n; k++) { const id = rollLoot(area.chest.loot); rec.items[id] = (rec.items[id] || 0) + 1; }
        if (rng.chance(Math.min(1, area.chest.eggChance * Math.sqrt(special)))) rec.eggs.push(rollLoot(area.chest.eggs));
        rec.chest = true;
      } else {
        const chk = resolveCheck(scores, [CHEST.pryTrait], area.difficulty + CHEST.pryDifficulty, rng);
        Object.assign(rec, { trait: chk.trait, score: chk.score, difficulty: chk.difficulty, chance: chk.chance });
        if (chk.success) {
          rec.outcome = 'pried';
          if (chk.bug) rec.bugUid = chk.bug.uid;
          rec.text = `No key, but ${chk.bug ? bugName(chk.bug) : 'the whole party'} forces the lid open${chk.bug ? ' with sheer Lift' : ' by sheer luck'}! Only the coins are reachable.`;
          rec.coins = Math.round(rng.float(0.8, 1.2) * area.coinBase * area.chest.coins * CHEST.pryCoinFraction * coinMult);
        } else {
          rec.outcome = 'locked';
          rec.text = 'Nobody has a Chest Key, and the lid won\'t budge. Equip a Key next time!';
        }
      }
    } else if (def.check) {
      const chk = resolveCheck(scores, def.check.traits, area.difficulty + (def.check.difficulty || 0), rng);
      const o = chk.great && def.great ? def.great : chk.success ? def.success : def.fail;
      rec.outcome = chk.great ? 'great' : chk.success ? 'success' : 'fail';
      Object.assign(rec, { trait: chk.trait, options: def.check.traits, score: chk.score, difficulty: chk.difficulty, chance: chk.chance });
      if (chk.success && chk.bug) rec.bugUid = chk.bug.uid;
      rec.text = fill(o.text, { bug: chk.bug && bugName(chk.bug), trait: chk.trait[0].toUpperCase() + chk.trait.slice(1) });
      applyOutcome(o, rec);
      if (chk.great && !def.great) { rec.coins = Math.round(rec.coins * 1.5); rec.text += ' A great result!'; }
      if (chk.success) {
        for (const uid of Object.keys(xp)) xp[uid] += XP.successBonus;
        if (chk.bug) xp[chk.bug.uid] += XP.successBonus;
      }
    } else {
      rec.text = def.result.text;
      applyOutcome(def.result, rec);
    }
    for (const uid of Object.keys(xp)) xp[uid] += XP.perEncounter;
    encounters.push(rec);
  }
  return { count, encounters, xp };
}

// Where an expedition is right now, from its saved timestamps.
export function expeditionTimeline(exp, now) {
  const total = exp.count * exp.encounterMs;
  const elapsed = Math.min(total, Math.max(0, now - exp.startAt));
  const resolved = Math.min(exp.count, Math.floor(elapsed / exp.encounterMs));
  const done = now >= exp.endsAt;
  const current = done ? null : resolved;
  const currentEndsAt = done ? exp.endsAt : exp.startAt + (resolved + 1) * exp.encounterMs;
  return { total, elapsed, remaining: Math.max(0, exp.endsAt - now), resolved, current, currentEndsAt, done, fraction: total ? elapsed / total : 1 };
}

export function sumRewards(encounters) {
  const out = { coins: 0, items: {}, eggs: [] };
  for (const e of encounters) {
    out.coins += e.coins;
    for (const [id, n] of Object.entries(e.items)) out.items[id] = (out.items[id] || 0) + n;
    out.eggs.push(...e.eggs);
  }
  return out;
}

export function validateParty(state, uids, away) {
  if (!Array.isArray(uids) || uids.length !== PARTY_SIZE) return `A party needs exactly ${PARTY_SIZE} bugs.`;
  if (new Set(uids).size !== uids.length) return 'Each bug can only be picked once.';
  for (const uid of uids) {
    const b = state.bugs.find((x) => x.uid === uid);
    if (!b) return 'Unknown bug.';
    if (away.has(uid)) return `${bugName(b)} is already on an expedition.`;
    if (!Object.values(effectiveTraits(b)).some((v) => v > 0)) return `${bugName(b)} has no traits.`;
  }
  return null;
}
