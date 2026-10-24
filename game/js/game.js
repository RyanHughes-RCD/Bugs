import { Rng } from './core/rng.js';
import { SAVE_KEY, newGameState, serialize, deserialize, encodeSave, decodeSave } from './core/save.js';
import { AREAS, AREA_BY_ID } from './data/areas.js';
import { SPECIES } from './data/species.js';
import { ITEMS, sellPrice } from './data/items.js';
import { EGGS } from './data/eggs.js';
import { UPGRADE_BY_ID, upgradeCost } from './data/upgrades.js';
import { addBug, addXp, bugName, bugStatus, bugsOnExpedition, recordDex, releaseValue } from './systems/bugs.js';
import { nurseryCapacity, incubationMs, rollHatch, eggProgress } from './systems/eggs.js';
import {
  MAX_TEAM, expeditionSlots, supplySlots, expeditionDurationMs, planExpedition, expeditionProgress, restDurationMs,
} from './systems/expedition.js';
import { tickGarden } from './systems/garden.js';
import { FIXED_STOCK, rotatingOffers, rotationId, priceOf } from './systems/shop.js';

const fail = (error) => ({ ok: false, error });

export class Game {
  constructor({ storage = null, clock = () => Date.now(), seed = null } = {}) {
    this.storage = storage;
    this.clock = clock;
    this.timeOffset = 0; // debug time-warp only
    this.seedOverride = seed;
    this.listeners = new Set();
    this.state = null;
    this.rng = null;
  }

  now() {
    return this.clock() + this.timeOffset;
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, payload) {
    for (const fn of this.listeners) fn(type, payload);
  }

  // ---------- persistence ----------

  load() {
    const raw = this.storage?.getItem(SAVE_KEY);
    if (raw) {
      try {
        this.state = deserialize(raw);
      } catch (e) {
        console.warn('Save could not be read, starting fresh', e);
        this.state = null;
      }
    }
    if (!this.state) return this.newGame();
    this.rng = new Rng(this.state.rngState);
    const coinsBefore = this.state.garden.pot;
    const awayMs = this.now() - (this.state.lastSeen || this.now());
    tickGarden(this.state, this.now(), this.rng);
    this.commit();
    return { fresh: false, awayMs, gardenEarned: Math.floor(this.state.garden.pot - coinsBefore) };
  }

  newGame() {
    const now = this.now();
    const seed = this.seedOverride ?? Math.floor(Math.random() * 0x7fffffff);
    this.state = newGameState(now, seed);
    this.rng = new Rng(seed);
    for (const id of ['ant', 'ladybug', 'pill_bug', 'caterpillar']) addBug(this.state, id, { origin: 'starter', now }, this.rng);
    this.state.coins = 100;
    this.state.stats.coinsEarned = 0;
    const egg = this.makeEgg('meadow_egg');
    this.startEgg(egg.uid, { silent: true });
    this.commit();
    return { fresh: true };
  }

  save() {
    if (!this.state) return;
    this.state.rngState = this.rng.state;
    this.state.lastSeen = this.now();
    this.storage?.setItem(SAVE_KEY, serialize(this.state));
  }

  commit() {
    this.save();
    this.emit('change');
  }

  exportSave() {
    this.save();
    return encodeSave(this.state);
  }

  importSave(code) {
    try {
      const st = decodeSave(code);
      if (!Array.isArray(st.bugs) || st.seed === undefined) return fail('That save code is not valid.');
      this.state = st;
      this.rng = new Rng(st.rngState || st.seed);
      this.commit();
      return { ok: true };
    } catch {
      return fail('That save code is not valid.');
    }
  }

  reset() {
    this.storage?.removeItem(SAVE_KEY);
    this.seedOverride = null;
    this.newGame();
    return { ok: true };
  }

  toast(text, kind = 'info') {
    this.emit('toast', { text, kind });
  }

  // ---------- time ----------

  // Called every second by the UI. Saves only when something visible changed.
  tick() {
    const st = this.state;
    const hadVisitor = !!st.garden.visitor;
    tickGarden(st, this.now(), this.rng);
    if (!!st.garden.visitor !== hadVisitor) {
      if (st.garden.visitor) this.toast(`A wild ${SPECIES[st.garden.visitor.species].name} is visiting your garden!`);
      this.commit();
    }
  }

  warp(ms) {
    this.timeOffset += ms;
    this.tick();
    this.emit('change');
  }

  // ---------- queries ----------

  bug(uid) {
    return this.state.bugs.find((b) => b.uid === uid);
  }

  statusOf(bug) {
    return bugStatus(bug, this.state, this.now());
  }

  readyBugs() {
    const away = bugsOnExpedition(this.state);
    return this.state.bugs.filter((b) => bugStatus(b, this.state, this.now(), away) === 'ready');
  }

  incubatingEggs() {
    return this.state.eggs.filter((e) => e.startedAt);
  }

  eggProgress(egg) {
    return eggProgress(egg, this.now());
  }

  expeditionProgress(exp) {
    return expeditionProgress(exp, this.now());
  }

  canUnlock(areaId) {
    const area = AREA_BY_ID[areaId];
    if (!area || area.index === 0) return fail('Unknown area.');
    if (this.state.areas[areaId].unlocked) return fail('Already unlocked.');
    const prev = AREAS[area.index - 1];
    if (!this.state.areas[prev.id].guardianDefeated) return fail(`Defeat the ${prev.name} Guardian first.`);
    if (this.state.coins < area.unlockCost) return fail(`Needs ${area.unlockCost} coins.`);
    return { ok: true };
  }

  shopOffers() {
    const st = this.state;
    const rid = rotationId(this.now());
    if (st.shop.rotationId !== rid) st.shop = { rotationId: rid, bought: [] };
    return rotatingOffers(st, this.now()).map((o) => ({ ...o, sold: st.shop.bought.includes(o.index) }));
  }

  // ---------- coins ----------

  earn(n) {
    this.state.coins += n;
    this.state.stats.coinsEarned += n;
  }

  spend(n) {
    if (this.state.coins < n) return false;
    this.state.coins -= n;
    return true;
  }

  collectGarden() {
    tickGarden(this.state, this.now(), this.rng);
    const n = Math.floor(this.state.garden.pot);
    if (n < 1) return fail('Nothing to collect yet.');
    this.state.garden.pot -= n;
    this.earn(n);
    this.commit();
    return { ok: true, coins: n };
  }

  // ---------- garden visitor ----------

  catchVisitor({ useHoney = false } = {}) {
    const st = this.state;
    tickGarden(st, this.now(), this.rng);
    const v = st.garden.visitor;
    if (!v) return fail('The visitor has already left.');
    if (useHoney && !this.takeItem('honey_drop')) return fail('You have no Honey Drops.');
    st.garden.visitor = null;
    recordDex(st, v.species, 'seen');
    const chance = useHoney ? 1 : 0.6 + 0.05 * (st.upgrades.silk_nets || 0);
    if (!this.rng.chance(chance)) {
      this.commit();
      return { ok: true, caught: false, species: v.species };
    }
    const res = addBug(st, v.species, { level: v.level, shiny: v.shiny, origin: 'visitor', now: this.now() }, this.rng);
    st.stats.captured += 1;
    this.commit();
    return { ok: true, caught: true, ...res };
  }

  // ---------- inventory ----------

  addItem(id, n = 1) {
    this.state.inventory[id] = (this.state.inventory[id] || 0) + n;
  }

  takeItem(id, n = 1) {
    if ((this.state.inventory[id] || 0) < n) return false;
    this.state.inventory[id] -= n;
    if (!this.state.inventory[id]) delete this.state.inventory[id];
    return true;
  }

  useItem(itemId, target) {
    const st = this.state;
    const item = ITEMS[itemId];
    if (!item || item.type !== 'consumable') return fail('That item cannot be used like that.');
    if (!(st.inventory[itemId] > 0)) return fail(`You have no ${item.name}.`);
    let message;
    if (itemId === 'honey_drop') {
      const bug = this.bug(target);
      if (!bug) return fail('Choose a bug.');
      if (this.statusOf(bug) !== 'resting') return fail(`${bugName(bug)} is not resting.`);
      bug.restUntil = 0;
      message = `${bugName(bug)} is wide awake!`;
    } else if (itemId === 'xp_nectar') {
      const bug = this.bug(target);
      if (!bug) return fail('Choose a bug.');
      const lv = addXp(bug, item.xp);
      message = `${bugName(bug)} gained ${item.xp} XP` + (lv ? ` and reached Lv${bug.level}!` : '.');
    } else if (itemId === 'sugar_cube') {
      const exp = st.expeditions.find((e) => e.id === target);
      if (!exp) return fail('Choose an expedition.');
      const p = this.expeditionProgress(exp);
      if (p.done) return fail('That expedition is already back.');
      exp.bonusMs = (exp.bonusMs || 0) + Math.ceil(p.remainingMs / 2);
      message = 'The team speeds up!';
    } else if (itemId === 'warm_moss') {
      const egg = st.eggs.find((e) => e.uid === target);
      if (!egg || !egg.startedAt) return fail('Choose an incubating egg.');
      const p = this.eggProgress(egg);
      if (p.ready) return fail('That egg is ready to hatch.');
      egg.bonusMs = (egg.bonusMs || 0) + Math.ceil(p.remainingMs / 2);
      message = 'The egg feels toasty.';
    } else {
      return fail('Nothing happens.');
    }
    this.takeItem(itemId);
    this.commit();
    return { ok: true, message };
  }

  equip(bugUid, itemId) {
    const bug = this.bug(bugUid);
    const item = ITEMS[itemId];
    if (!bug) return fail('Unknown bug.');
    if (!item || item.type !== 'gear') return fail('That is not gear.');
    if (this.statusOf(bug) === 'expedition') return fail(`${bugName(bug)} is away exploring.`);
    if (!this.takeItem(itemId)) return fail(`You have no ${item.name}.`);
    if (bug.gear) this.addItem(bug.gear);
    bug.gear = itemId;
    this.commit();
    return { ok: true };
  }

  unequip(bugUid) {
    const bug = this.bug(bugUid);
    if (!bug?.gear) return fail('Nothing equipped.');
    if (this.statusOf(bug) === 'expedition') return fail(`${bugName(bug)} is away exploring.`);
    this.addItem(bug.gear);
    bug.gear = null;
    this.commit();
    return { ok: true };
  }

  sell(itemId, qty = 1) {
    const price = sellPrice(itemId);
    if (!price) return fail('Nobody wants to buy that.');
    if (!this.takeItem(itemId, qty)) return fail('You do not have that many.');
    this.earn(price * qty);
    this.commit();
    return { ok: true, coins: price * qty };
  }

  releaseBug(uid) {
    const st = this.state;
    const bug = this.bug(uid);
    if (!bug) return fail('Unknown bug.');
    if (this.statusOf(bug) === 'expedition') return fail('That bug is away exploring.');
    if (st.bugs.length <= 1) return fail('Your garden needs at least one bug.');
    if (bug.gear) this.addItem(bug.gear);
    const coins = releaseValue(bug);
    st.bugs = st.bugs.filter((b) => b.uid !== uid);
    this.earn(coins);
    this.commit();
    return { ok: true, coins };
  }

  renameBug(uid, name) {
    const bug = this.bug(uid);
    if (!bug) return fail('Unknown bug.');
    const clean = String(name || '').trim().slice(0, 16);
    bug.nickname = clean || undefined;
    this.commit();
    return { ok: true };
  }

  // ---------- eggs ----------

  makeEgg(type) {
    const egg = { uid: this.state.nextUid++, type, startedAt: null, durationMs: null, bonusMs: 0 };
    this.state.eggs.push(egg);
    return egg;
  }

  startEgg(eggUid, { silent = false } = {}) {
    const egg = this.state.eggs.find((e) => e.uid === eggUid);
    if (!egg) return fail('Unknown egg.');
    if (egg.startedAt) return fail('Already incubating.');
    if (this.incubatingEggs().length >= nurseryCapacity(this.state)) return fail('The nursery is full. Upgrade Nursery Plots for more room.');
    egg.startedAt = this.now();
    egg.durationMs = incubationMs(this.state, egg.type);
    egg.bonusMs = 0;
    if (!silent) this.commit();
    return { ok: true };
  }

  hatchEgg(eggUid) {
    const st = this.state;
    const egg = st.eggs.find((e) => e.uid === eggUid);
    if (!egg) return fail('Unknown egg.');
    if (!this.eggProgress(egg).ready) return fail('This egg is not ready yet.');
    const roll = rollHatch(st, egg.type, this.rng);
    st.eggs = st.eggs.filter((e) => e !== egg);
    const res = addBug(st, roll.speciesId, { traits: roll.traits, shiny: roll.shiny, origin: 'hatched', now: this.now() }, this.rng);
    st.stats.hatched += 1;
    this.commit();
    return { ok: true, eggType: egg.type, rarity: roll.rarity, ...res };
  }

  // ---------- expeditions ----------

  launchExpedition(areaId, uids, supplies = []) {
    const st = this.state;
    const area = AREA_BY_ID[areaId];
    if (!area) return fail('Unknown area.');
    if (!st.areas[areaId].unlocked) return fail(`${area.name} is locked.`);
    if (st.expeditions.length >= expeditionSlots(st)) return fail('All expedition slots are busy. Upgrade Base Camp for more.');
    if (st.expeditions.some((e) => e.areaId === areaId)) return fail(`A team is already exploring ${area.name}.`);
    const unique = [...new Set(uids)];
    if (!unique.length) return fail('Pick at least one bug.');
    if (unique.length > MAX_TEAM) return fail(`A team has at most ${MAX_TEAM} bugs.`);
    const team = unique.map((u) => this.bug(u));
    if (team.some((b) => !b)) return fail('Unknown bug.');
    const away = bugsOnExpedition(st);
    for (const b of team) {
      const s = bugStatus(b, st, this.now(), away);
      if (s !== 'ready') return fail(`${bugName(b)} is ${s === 'resting' ? 'resting' : 'already exploring'}.`);
    }
    if (supplies.length > supplySlots(st)) return fail(`You can pack ${supplySlots(st)} supplies.`);
    const need = {};
    for (const s of supplies) {
      if (ITEMS[s]?.type !== 'supply') return fail('Only supplies can be packed.');
      need[s] = (need[s] || 0) + 1;
    }
    for (const [s, n] of Object.entries(need)) if ((st.inventory[s] || 0) < n) return fail(`Not enough ${ITEMS[s].name}.`);
    for (const [s, n] of Object.entries(need)) this.takeItem(s, n);

    const seed = this.rng.seed();
    const plan = planExpedition(st, area, team, supplies, seed);
    const exp = {
      id: st.nextUid++,
      areaId,
      team: unique,
      supplies,
      seed,
      startAt: this.now(),
      durationMs: Math.round(expeditionDurationMs(st, area, team) * plan.lengthFraction),
      bonusMs: 0,
      events: plan.events,
      result: plan.result,
    };
    st.expeditions.push(exp);
    this.commit();
    return { ok: true, expedition: exp };
  }

  collectExpedition(id) {
    const st = this.state;
    const exp = st.expeditions.find((e) => e.id === id);
    if (!exp) return fail('Unknown expedition.');
    if (!this.expeditionProgress(exp).done) return fail('The team is still exploring.');
    const area = AREA_BY_ID[exp.areaId];
    const r = exp.result;
    const now = this.now();
    const report = { area, events: exp.events, coins: r.coins, items: r.items, eggs: [], captures: [], levelUps: [], retreated: r.retreated, guardian: null, unlockedHint: null };

    this.earn(r.coins);
    for (const [id2, n] of Object.entries(r.items)) this.addItem(id2, n);
    for (const type of r.eggs) report.eggs.push(this.makeEgg(type));
    for (const sp of r.seen) recordDex(st, sp, 'seen');
    for (const c of r.captures) {
      const res = addBug(st, c.species, { level: c.level, traits: c.traits, shiny: c.shiny, origin: 'captured', now }, this.rng);
      st.stats.captured += 1;
      report.captures.push(res);
    }
    for (const uid of exp.team) {
      const bug = this.bug(uid);
      if (!bug) continue;
      const before = bug.level;
      if (addXp(bug, r.xp[uid] || 0)) report.levelUps.push({ uid, name: bugName(bug), from: before, to: bug.level });
      bug.restUntil = now + restDurationMs(st, area, r.hp[uid], r.maxHp[uid]);
    }
    const areaState = st.areas[area.id];
    if (!r.retreated) areaState.runs += 1;
    if (r.guardianFought) report.guardian = { won: r.guardianDefeated, first: r.firstGuardianWin, name: area.guardian.name };
    if (r.firstGuardianWin) {
      areaState.guardianDefeated = true;
      st.stats.guardians += 1;
      const next = AREAS[area.index + 1];
      if (next) report.unlockedHint = next;
    }
    st.expeditions = st.expeditions.filter((e) => e !== exp);
    st.stats.expeditions += 1;
    this.commit();
    return { ok: true, report };
  }

  unlockArea(areaId) {
    const check = this.canUnlock(areaId);
    if (!check.ok) return check;
    const area = AREA_BY_ID[areaId];
    this.spend(area.unlockCost);
    this.state.areas[areaId].unlocked = true;
    this.commit();
    return { ok: true };
  }

  // ---------- shop & upgrades ----------

  buy(id, { offerIndex = null } = {}) {
    const st = this.state;
    let price;
    if (offerIndex !== null) {
      const offer = this.shopOffers().find((o) => o.index === offerIndex);
      if (!offer || offer.id !== id) return fail('That deal is gone.');
      if (offer.sold) return fail('Sold out until the next restock.');
      price = offer.price;
    } else {
      if (!FIXED_STOCK.includes(id)) return fail('Not for sale.');
      price = priceOf(id);
    }
    if (!this.spend(price)) return fail('Not enough coins.');
    if (offerIndex !== null) st.shop.bought.push(offerIndex);
    if (EGGS[id]) this.makeEgg(id);
    else this.addItem(id);
    this.commit();
    return { ok: true, price };
  }

  buyUpgrade(id) {
    const u = UPGRADE_BY_ID[id];
    if (!u) return fail('Unknown upgrade.');
    const level = this.state.upgrades[id] || 0;
    if (level >= u.max) return fail('Already maxed out.');
    const cost = upgradeCost(id, level);
    if (!this.spend(cost)) return fail('Not enough coins.');
    this.state.upgrades[id] = level + 1;
    this.commit();
    return { ok: true, level: level + 1 };
  }
}
