import { Rng } from '../core/rng.js';
import { ENCOUNTERS, CHEST } from '../data/encounters.js';
import { ITEMS, MAX_ITEM_SPEED } from '../data/items.js';
import { BASE_ENCOUNTER_MS, BASE_EXPEDITION_SLOTS, EXPEDITION_LENGTH, PACE, PARTY_SIZE } from '../data/balance.js';
import { upgradeValue } from '../data/upgrades.js';
import { partyTraitScores, resolveCheck } from './traits.js';
import { effectiveTraits, bugName, traitTotal } from './bugs.js';

import { rollDropTier } from './eggs.js';
import { EGG_TIERS, EGG_BY_ID } from '../data/eggs.js';
import { AREAS } from '../data/areas.js';
import { SYNERGIES, SYNERGY_LIMITS } from '../data/synergies.js';
import { partySynergies, boostedParty, synergyScores, synergyPower, synergySpeed, synergyCoins } from './synergies.js';

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

// A party's power: the total of its trait levels, items included.
export function partyPower(party) {
  return party.reduce((s, b) => s + traitTotal(b), 0);
}

// The party bonuses in play: the ones rolled for a trip (opts.active), or
// else every one the party qualifies for. `opts.hour` is the launch hour on
// the device clock, for Night Shift.
const activeFor = (party, opts) => opts.active ?? partySynergies(party, opts).active;

// How much longer (or shorter) each encounter takes for this party here.
// Party bonuses that raise traits (or Mentor) count towards its power.
export function paceFactor(area, party, opts = {}) {
  const active = activeFor(party, opts);
  const power = synergyPower(boostedParty(party, active), active);
  const f = Math.pow(area.pace.power / Math.max(1, power), area.pace.steep);
  return Math.min(PACE.max, Math.max(PACE.min, f));
}

// Length of every encounter on an expedition with this party, fixed at launch
// (skipped and instant encounters take a fraction of it).
export function encounterMs(state, area, party, opts = {}) {
  const eff = upgradeValue(state, 'expedition_efficiency');
  const active = activeFor(party, opts);
  return Math.round(BASE_ENCOUNTER_MS * (1 - eff) * (1 - partyBonuses(party).encounterSpeed) * paceFactor(area, party, opts) * synergySpeed(active));
}

// Default trip length for an area: the middle of its encounter range.
export function defaultEncounterCount(area) {
  return Math.round((area.encounters[0] + area.encounters[1]) / 2);
}

export function clampEncounterCount(n) {
  return Math.min(EXPEDITION_LENGTH.max, Math.max(EXPEDITION_LENGTH.min, Math.round(n)));
}

// Encounters that fit in a trip of this many hours with this party.
export function encountersForHours(state, area, party, hours, opts = {}) {
  return clampEncounterCount((hours * 3600e3) / encounterMs(state, area, party, opts));
}

// An egg tier `up` steps higher, capped at the top tier.
function bumpTier(tier, up) {
  return up ? EGG_TIERS[Math.min(EGG_TIERS.length - 1, EGG_BY_ID[tier].index + up)].id : tier;
}

// A relic-tier item from this area or an easier one. Early areas have none of
// their own: there it's the cheapest relic (Prismatic's promise) or, when
// `orKey`, a Chest Key.
function pickRelic(area, rng, orKey = false) {
  const all = Object.entries(ITEMS).filter(([, it]) => it.tier === 'relic');
  const here = all.filter(([, it]) => !it.shop || AREAS.findIndex((a) => a.id === it.shop.area) <= area.index);
  if (here.length) return rng.pick(here)[0];
  return orKey ? 'key' : all.sort((a, b) => a[1].buy - b[1].buy)[0][0];
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
// screens or reloading never rerolls anything. Without a chosen count, the
// length is rolled from the area's range. Per-run caps (chests, eggs...)
// grow with longer trips so they stay as rewarding per encounter.
//
// Party bonuses (systems/synergies.js) are applied here too; each one that
// changes an encounter leaves a note on it for the log.
export function planExpedition(state, area, party, seed, chosenCount, opts = {}) {
  const rng = new Rng(seed);
  const rolled = rng.int(area.encounters[0], area.encounters[1]);
  const count = chosenCount ? clampEncounterCount(chosenCount) : rolled;
  const capScale = Math.max(1, count / defaultEncounterCount(area));
  const bonus = partyBonuses(party);
  const special = 1 + upgradeValue(state, 'improved_exploration').specialFind + bonus.specialFind;
  const active = activeFor(party, opts);
  const S = SYNERGIES;
  const coinMult = 1 + upgradeValue(state, 'better_finds') + bonus.coinBonus + synergyCoins(active);
  const scores = synergyScores(boostedParty(party, active), active);
  const eggMult = 1 + (active.lure ? S.lure.eggChance * active.lure.n : 0);
  const eggUp = (active.night_shift ? 1 : 0) + (active.leyline ? 1 : 0);
  const instant = SYNERGY_LIMITS.instantWeight;
  let saves = active.shell_wall ? S.shell_wall.saves : 0;
  let charged = false; // Conductor: the next encounter is cleared instantly
  // Tunnel Network: maybe one buried egg somewhere along the way.
  const buriedAt = active.tunnel_network && rng.chance(Math.min(1, S.tunnel_network.eggChance * capScale)) ? rng.int(0, count - 1) : -1;
  const keys = [...bonus.keys];
  const used = {};
  const pool = encounterPool(area, party);
  const names = Object.fromEntries(party.map((b) => [b.uid, bugName(b)]));

  const rollCoins = (range) => (range ? Math.round(rng.float(range[0], range[1]) * area.coinBase * coinMult) : 0);
  // Leyline makes relic-tier items more likely in every loot roll.
  const rollLoot = (table) => rng.weighted(active.leyline ? table.map(([id, w]) => [id, ITEMS[id]?.tier === 'relic' ? w * S.leyline.relicMult : w]) : table);
  const findEgg = (kind) => bumpTier(rollDropTier(area, kind, rng), eggUp);
  const gearOnly = area.loot.filter(([id]) => ITEMS[id].type === 'gear' && id !== 'key');

  const applyOutcome = (o, rec) => {
    rec.coins += rollCoins(o.coins);
    const add = (id, n = 1) => { rec.items[id] = (rec.items[id] || 0) + n; };
    for (const [id, n] of o.items || []) add(id, n);
    if (o.loot && rng.chance(Math.min(1, o.loot * Math.sqrt(special)))) add(rollLoot(area.loot));
    if (o.gear && rng.chance(o.gear)) add(rollLoot(gearOnly));
    if (o.egg && rng.chance(Math.min(1, o.egg * eggMult))) rec.eggs.push(findEgg('find'));
  };
  const note = (rec, id, text) => { (rec.notes = rec.notes || []).push({ id, text }); };
  const add = (rec, id, n = 1) => { rec.items[id] = (rec.items[id] || 0) + n; };

  const encounters = [];
  let last = null;
  for (let i = 0; i < count; i++) {
    const options = pool.filter((e) => e.id !== last && (!e.maxPerRun || (used[e.id] || 0) < Math.ceil(e.maxPerRun * capScale)));
    const def = rng.weighted(options.map((e) => [e, e.weight * (e.special ? special : 1)]));
    used[def.id] = (used[def.id] || 0) + 1;
    last = def.id;
    const rec = { id: def.id, category: def.category, intro: pickIntro(def, area, rng), text: '', outcome: 'neutral', coins: 0, items: {}, eggs: [] };
    // Encounters the party gets through without a fight: skipped by Tailwind,
    // or cleared by a Conductor's chain lightning.
    let free = null;
    if (active.tailwind && i % S.tailwind.every === S.tailwind.every - 1) free = ['tailwind', 'Tailwind: the party flies straight over it.'];
    if (charged) { free = ['conductor', 'Conductor: chain lightning clears it in a flash!']; charged = false; }
    if (free) { rec.w = instant; note(rec, ...free); }
    else if (active.leapfrog && rng.chance(S.leapfrog.chance)) { rec.w = instant; note(rec, 'leapfrog', 'Leapfrog: the hoppers bound through it in no time.'); }

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
        if (rng.chance(Math.min(1, area.chest.eggChance * Math.sqrt(special) * eggMult))) rec.eggs.push(findEgg('chest'));
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
      const fightable = active.ambush && def.check.traits.includes('fight');
      const chk = resolveCheck(scores, fightable ? ['fight'] : def.check.traits, area.difficulty + (def.check.difficulty || 0), rng);
      if (!chk.success && (free || fightable)) {
        chk.success = true;
        if (fightable && !free) note(rec, 'ambush', 'Ambush: the bait lures it in and the spiders pounce.');
      } else if (!chk.success && saves > 0) {
        saves -= 1;
        chk.success = true;
        note(rec, 'shell_wall', 'Shell Wall: the beetles shrug off a failed check!');
      }
      const o = chk.great && def.great ? def.great : chk.success ? def.success : def.fail;
      rec.outcome = chk.great ? 'great' : chk.success ? 'success' : 'fail';
      Object.assign(rec, { trait: chk.trait, options: def.check.traits, score: chk.score, difficulty: chk.difficulty, chance: chk.chance });
      if (chk.success && chk.bug) rec.bugUid = chk.bug.uid;
      rec.text = fill(o.text, { bug: chk.bug && bugName(chk.bug), trait: chk.trait[0].toUpperCase() + chk.trait.slice(1) });
      applyOutcome(o, rec);
      if (chk.great && !def.great) { rec.coins = Math.round(rec.coins * 1.5); rec.text += ' A great result!'; }
      if (fightable) {
        rec.coins = Math.round(rec.coins * S.ambush.coinMult);
        add(rec, rollLoot(area.loot)); // the spoils
      }
      if (!chk.success && active.unseen && def.success?.coins) {
        const half = Math.round(rollCoins(def.success.coins) * S.unseen.failPay);
        rec.coins += half;
        note(rec, 'unseen', `Unseen: nobody noticed them, so they still slipped away with ${half} coins.`);
      }
    } else {
      rec.text = def.result.text;
      applyOutcome(def.result, rec);
    }
    // Conductor: anything that goes well can set off chain lightning.
    if (active.conductor && !free && !['fail', 'locked'].includes(rec.outcome) && rng.chance(S.conductor.chance)) charged = true;
    // Bonuses that pay out on top of whatever happened.
    if (def.category === 'chest' && rec.outcome !== 'locked' && active.midas && rng.chance(Math.min(0.9, S.midas.chestBonus * active.midas.n))) {
      const id = rng.chance(S.midas.relicShare) ? pickRelic(area, rng, true) : 'key';
      add(rec, id);
      note(rec, 'midas', `Midas: something golden glints in the chest: ${ITEMS[id].name}!`);
    }
    if (active.pearl_divers && rng.chance(S.pearl_divers.chance)) {
      const coins = Math.round(rng.float(...S.pearl_divers.coins) * area.coinBase * area.chest.coins * coinMult);
      const id = rollLoot(area.loot.filter(([it]) => it !== 'key' && ITEMS[it].tier !== 'relic'));
      rec.coins += coins;
      add(rec, id);
      note(rec, 'pearl_divers', `Pearl Divers: a sunken chest! ${coins} coins and ${ITEMS[id].name}.`);
    }
    if (active.tunnel_network) {
      const coins = Math.round(rng.float(...S.tunnel_network.coins) * area.coinBase * coinMult);
      rec.coins += coins;
      if (i === buriedAt) { rec.eggs.push(findEgg('find')); note(rec, 'tunnel_network', `Tunnel Network: ${coins} coins and a buried egg!`); }
    }
    encounters.push(rec);
  }
  // Lure: a Shiny always brings home at least one egg.
  if (active.lure && encounters.length && !encounters.some((e) => e.eggs.length)) {
    const last = encounters[encounters.length - 1];
    last.eggs.push(findEgg('find'));
    note(last, 'lure', 'Lure: something shimmering caught an egg on the way home!');
  }
  if (active.prismatic && encounters.length) {
    const last = encounters[encounters.length - 1];
    const id = pickRelic(area, rng);
    add(last, id);
    note(last, 'prismatic', `Prismatic: three variants, one gift. The party brings home a ${ITEMS[id].name}!`);
  }
  return { count, encounters, synergies: Object.keys(active) };
}

// How long each encounter takes, in whole encounter-lengths (skipped and
// instant ones take a fraction), and when each one finishes after the start.
export function encounterEnds(exp) {
  let t = 0;
  return exp.encounters.slice(0, exp.count).map((e) => (t += (e.w ?? 1) * exp.encounterMs));
}

export function tripMs(exp) {
  const ends = encounterEnds(exp);
  return Math.round(ends[ends.length - 1] || 0);
}

// Where an expedition is right now, from its saved timestamps.
export function expeditionTimeline(exp, now) {
  const ends = encounterEnds(exp);
  const total = exp.endsAt - exp.startAt;
  const elapsed = Math.min(total, Math.max(0, now - exp.startAt));
  let resolved = 0;
  while (resolved < exp.count && ends[resolved] <= elapsed) resolved++;
  const done = now >= exp.endsAt;
  if (done) resolved = exp.count;
  const current = done ? null : resolved;
  const currentEndsAt = done ? exp.endsAt : Math.min(exp.endsAt, exp.startAt + Math.round(ends[resolved]));
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

