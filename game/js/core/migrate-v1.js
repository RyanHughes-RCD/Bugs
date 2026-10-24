// Converts saves from the first version of Bug Garden (combat stats, 16
// traits, area eggs) to the current format. Nothing the player earned is
// silently lost: bugs keep species, level, name and gear; eggs map to tiers;
// removed items and old upgrades are refunded as coins.
import { Rng } from './rng.js';
import { SPECIES } from '../data/species.js';
import { ITEMS } from '../data/items.js';
import { GARDEN_LIMIT, MAX_BUG_LEVEL, BASE_INCUBATION_MS } from '../data/balance.js';
import { rollTraits, pickName } from '../systems/bugs.js';

const EGG_MAP = {
  garden_egg: 'common', meadow_egg: 'common', pond_egg: 'uncommon', woods_egg: 'uncommon',
  dune_egg: 'rare', jungle_egg: 'rare', golden_egg: 'epic', chrysalis: 'legendary',
};
const AREA_MAP = { meadow: 'garden', pond: 'forest', woods: 'caves', dunes: 'volcano', jungle: 'aether' };
const REMOVED_ITEM_REFUND = { xp_nectar: 36, sugar_cube: 24, warm_moss: 20, clover_leaf: 18, smelling_salts: 28 };
const OLD_UPGRADES = {
  nursery: [120, 3], warm_soil: [80, 2.1], clover_patch: [150, 2.3], training: [100, 1.75], trail_maps: [100, 2.1],
  explorer_pack: [120, 2], silk_nets: [100, 2.1], bloom: [60, 1.65], coin_jar: [50, 1.8], leaf_bed: [80, 2],
  camp: [500, 4], satchel: [200, 3],
};

export function migrateV1(old) {
  const now = old.lastSeen || Date.now();
  const seed = old.seed ?? 1;
  const rng = new Rng((old.rngState ?? seed) ^ 0x5bd1e995);
  const s = {
    version: 2, seed, rngState: old.rngState ?? seed, createdAt: old.createdAt ?? now, lastSeen: now,
    coins: old.coins || 0, nextUid: old.nextUid || 1, bugs: [], eggs: [], inventory: {}, upgrades: {}, areas: {},
    expeditions: [], history: [], garden: { pot: Math.min(100, old.garden?.pot || 0), lastTick: now },
    dex: {}, stats: { ...(old.stats || {}) }, flags: { ...(old.flags || {}) },
  };
  let refund = 0;

  const addItem = (id, n = 1) => {
    if (ITEMS[id]) s.inventory[id] = (s.inventory[id] || 0) + n;
    else refund += (REMOVED_ITEM_REFUND[id] || 0) * n;
  };
  for (const [id, n] of Object.entries(old.inventory || {})) addItem(id, n);

  for (const ob of old.bugs || []) {
    if (!SPECIES[ob.species]) continue;
    const bug = {
      uid: ob.uid, name: ob.nickname || pickName(s, rng), species: ob.species,
      level: 1, xp: 0, traits: rollTraits(ob.species, rng), variant: ob.shiny ? 'shiny' : null, item: null,
      inGarden: false, origin: ob.origin || 'hatched', obtainedAt: ob.obtainedAt || now,
    };
    // Re-grant old levels as trait growth.
    const target = Math.min(MAX_BUG_LEVEL, ob.level || 1);
    const keys = Object.keys(bug.traits);
    for (let l = 1; l < target; l++) bug.traits[keys[(l - 1) % keys.length]] += 1;
    bug.level = target;
    if (ob.gear) {
      if (ITEMS[ob.gear]?.type === 'gear') bug.item = ob.gear;
      else addItem(ob.gear);
    }
    s.bugs.push(bug);
  }
  s.bugs.slice(0, GARDEN_LIMIT).forEach((b) => { b.inGarden = true; });
  for (const b of s.bugs) {
    s.dex[b.species] = s.dex[b.species] || { caught: 0 };
    s.dex[b.species].caught += 1;
  }
  for (const [id, d] of Object.entries(old.dex || {})) {
    if (SPECIES[id] && d.caught && !s.dex[id]) s.dex[id] = { caught: d.caught };
  }

  for (const oe of old.eggs || []) {
    const tier = EGG_MAP[oe.type] || 'common';
    const egg = { uid: oe.uid ?? s.nextUid++, tier, startedAt: null, endsAt: null, source: 'migrated' };
    if (oe.startedAt) {
      egg.startedAt = oe.startedAt;
      egg.endsAt = oe.startedAt + (oe.durationMs || BASE_INCUBATION_MS) - (oe.bonusMs || 0);
    }
    s.eggs.push(egg);
  }

  // Old expeditions had pre-rolled results: pay them out now.
  for (const exp of old.expeditions || []) {
    const r = exp.result || {};
    refund += r.coins || 0;
    for (const [id, n] of Object.entries(r.items || {})) addItem(id, n);
    for (const type of r.eggs || []) s.eggs.push({ uid: s.nextUid++, tier: EGG_MAP[type] || 'common', startedAt: null, endsAt: null, source: 'migrated' });
  }

  for (const [id, lvl] of Object.entries(old.upgrades || {})) {
    const cfg = OLD_UPGRADES[id];
    if (!cfg) continue;
    for (let l = 0; l < lvl; l++) refund += Math.round(cfg[0] * Math.pow(cfg[1], l));
  }

  for (const [oldId, a] of Object.entries(old.areas || {})) {
    const id = AREA_MAP[oldId];
    if (id) s.areas[id] = { unlocked: !!a.unlocked || id === 'garden', runs: a.runs || 0 };
  }

  s.coins += refund;
  s.flags.migratedFromV1 = { refund };
  return s;
}
