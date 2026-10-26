import { Rng } from './core/rng.js';
import { SAVE_KEY, BACKUP_KEY, newGameState, serialize, deserialize, encodeSave, decodeSave } from './core/save.js';
import { AREAS, AREA_BY_ID } from './data/areas.js';
import { EGG_BY_ID } from './data/eggs.js';
import { ITEMS, sellPrice, itemStock } from './data/items.js';
import { UPGRADE_BY_ID, upgradeCost } from './data/upgrades.js';
import { EXPEDITION_LENGTH, GARDEN_MAP, HISTORY_LIMIT, STARTING, VISITORS } from './data/balance.js';
import { createBug, gardenLimit, bugName, assignmentOf, bugsOnExpedition, gardenCount, releaseValue } from './systems/bugs.js';
import { incubationMs, incubatorCount, rollEgg, eggProgress, shopStock } from './systems/eggs.js';
import { expeditionSlots, encounterMs, planExpedition, expeditionTimeline, sumRewards, validateParty } from './systems/expedition.js';
import { tickGarden, moveRock, decorFits, freeDecorSpot, potCap, overlapsRiver, rockRect } from './systems/garden.js';
import { DECOR_BY_ID, LOG } from './data/decor.js';
import { GARDEN_CHEST_BY_ID } from './data/garden-chests.js';
import { rollGardenChest } from './systems/chests.js';
import { tickVisitors, rollVisitorGift, rockFindReady, rollRockFind } from './systems/visitors.js';
import { SPECIES } from './data/species.js';

const fail = (error) => ({ ok: false, error });

// Owns the game state. Every change goes through a method here that checks the
// rules, then saves, so the UI can never put the save into an invalid state.
export class Game {
  constructor({ storage = null, clock = () => Date.now(), seed = null } = {}) {
    this.storage = storage;
    this.clock = clock;
    this.timeOffset = 0; // developer time-warp only (?debug)
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
    for (const key of [SAVE_KEY, BACKUP_KEY]) {
      const raw = this.storage?.getItem(key);
      if (!raw) continue;
      try {
        this.state = deserialize(raw);
        if (key === SAVE_KEY) this.storage.setItem(BACKUP_KEY, raw);
        break;
      } catch (e) {
        console.warn(`Save "${key}" could not be read`, e);
      }
    }
    if (!this.state) {
      // Keep any unreadable save instead of overwriting it with a new game.
      const raw = this.storage?.getItem(SAVE_KEY);
      if (raw) this.storage.setItem(`${SAVE_KEY}-unreadable-${this.now()}`, raw);
      return this.newGame();
    }
    this.rng = new Rng(this.state.rngState);
    const awayMs = this.now() - (this.state.lastSeen || this.now());
    tickGarden(this.state, this.now());
    tickVisitors(this.state, this.now(), this.rng);
    this.commit();
    return { fresh: false, awayMs };
  }

  newGame() {
    const now = this.now();
    const seed = this.seedOverride ?? Math.floor(Math.random() * 0x7fffffff);
    this.state = newGameState(now, seed);
    this.rng = new Rng(seed);
    for (const id of STARTING.bugs) createBug(this.state, id, this.rng, { now, origin: 'starter', placeInGarden: true, variant: null });
    for (const tier of STARTING.eggs) this.addEgg(tier, 'starter');
    this.state.coins = STARTING.coins;
    this.state.stats.coinsEarned = 0;
    this.commit();
    return { fresh: true };
  }

  save() {
    if (!this.state) return;
    this.state.rngState = this.rng.state;
    this.state.lastSeen = Math.max(this.state.lastSeen || 0, this.now());
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
      this.rng = new Rng(st.rngState ?? st.seed);
      this.commit();
      return { ok: true };
    } catch {
      return fail('That save code is not valid.');
    }
  }

  reset() {
    this.storage?.removeItem(SAVE_KEY);
    this.storage?.removeItem(BACKUP_KEY);
    this.seedOverride = null;
    this.newGame();
    return { ok: true };
  }

  tick() {
    tickGarden(this.state, this.now());
    if (tickVisitors(this.state, this.now(), this.rng)) this.save();
  }

  // Developer tool: moves the game clock forward. Only exposed with ?debug.
  warp(ms) {
    this.timeOffset += ms;
    this.tick();
    this.commit();
  }

  // ---------- queries ----------

  bug(uid) {
    return this.state.bugs.find((b) => b.uid === uid);
  }

  assignment(bug) {
    return assignmentOf(bug, this.state);
  }

  egg(uid) {
    return this.state.eggs.find((e) => e.uid === uid);
  }

  eggProgress(egg) {
    return eggProgress(egg, this.now());
  }

  timeline(exp) {
    return expeditionTimeline(exp, this.now());
  }

  canUnlock(areaId) {
    const area = AREA_BY_ID[areaId];
    if (!area) return fail('Unknown area.');
    if (this.state.areas[areaId].unlocked) return fail('Already unlocked.');
    const prev = AREAS[area.index - 1];
    if (this.state.areas[prev.id].runs < area.unlock.runs) return fail(`Complete ${area.unlock.runs} expeditions in ${prev.name} first.`);
    if (this.state.coins < area.unlock.coins) return fail(`Needs ${area.unlock.coins} coins.`);
    return { ok: true };
  }

  // ---------- coins ----------

  earn(n) {
    this.state.coins += n;
    this.state.stats.coinsEarned += n;
  }

  spend(n) {
    if (!(n >= 0) || this.state.coins < n) return false;
    this.state.coins -= n;
    return true;
  }

  collectGarden() {
    this.tick();
    const n = Math.floor(this.state.garden.pot);
    if (n < 1) return fail('Nothing to collect yet.');
    this.state.garden.pot -= n;
    this.earn(n);
    this.commit();
    return { ok: true, coins: n };
  }

  // Drag the garden rock somewhere new (world coordinates of the garden map).
  moveRock(x, y) {
    const cx = Math.min(GARDEN_MAP.w - 26, Math.max(26, Math.round(x)));
    const cy = Math.min(GARDEN_MAP.h - 20, Math.max(30, Math.round(y)));
    const g = this.state.garden;
    const after = { ...g, rock: { ...g.rock, x: cx, y: cy } };
    if (Object.entries(g.decor).some(([id, spot]) => spot && !DECOR_BY_ID[id].fixed && !decorFits(after, id, spot.x, spot.y))) return fail('Something is already there.');
    if (overlapsRiver(g, rockRect(after.rock))) return fail('The rock would sink in the river.');
    if (!moveRock(g, cx, cy, this.now())) return fail('The rock barely moved.');
    this.commit();
    return { ok: true };
  }

  // ---------- garden decorations ----------

  buyDecor(id) {
    const d = DECOR_BY_ID[id];
    const g = this.state.garden;
    if (!d || !d.price) return fail('That is not for sale.');
    if (g.decor[id]) return fail(`You already have the ${d.name}.`);
    if (id === 'river' && overlapsRiver({ decor: { river: {} } }, rockRect(g.rock))) return fail('Move the rock out of the top corner first: the river runs there.');
    const spot = d.fixed ? {} : freeDecorSpot(g, id);
    if (!spot) return fail('There is no room left in the garden. Try moving things around.');
    if (!this.spend(d.price)) return fail('Not enough coins.');
    g.decor[id] = spot;
    // The river flows where it flows: anything standing in the way moves aside.
    for (const [other, at] of Object.entries(g.decor)) {
      if (DECOR_BY_ID[other].fixed || decorFits(g, other, at.x, at.y)) continue;
      g.decor[other] = { ...at, ...(freeDecorSpot(g, other) || at) };
    }
    this.commit();
    return { ok: true, spot };
  }

  moveDecor(id, x, y) {
    const g = this.state.garden;
    const d = DECOR_BY_ID[id];
    if (!g.decor[id] || d.fixed) return fail('That cannot be moved.');
    const [cx, cy] = [Math.round(x), Math.round(y)];
    if (!decorFits(g, id, cx, cy)) return fail('Not enough room there.');
    g.decor[id] = { ...g.decor[id], x: cx, y: cy };
    this.commit();
    return { ok: true };
  }

  // Roll the log over: a few coins underneath, at most every couple of hours.
  rollLog() {
    const log = this.state.garden.decor.log;
    if (!log) return fail('No log yet.');
    const now = this.now();
    if (log.rolledAt && now - log.rolledAt < LOG.everyMs) return { ok: true, coins: 0 };
    log.rolledAt = now;
    const coins = this.rng.int(LOG.coins[0], LOG.coins[1]);
    this.earn(coins);
    this.commit();
    return { ok: true, coins };
  }

  // A bug got too close to the battery: the zap knocks a coin into the pot.
  batteryZap() {
    const g = this.state.garden;
    if (!g.decor.battery) return fail('No battery.');
    g.pot = Math.min(potCap(this.state), g.pot + 1);
    this.save();
    return { ok: true };
  }

  // ---------- garden chests ----------

  // Spends Chest Keys from the bag on a garden chest. Everything is checked
  // and rolled first; keys and rewards then change together in one save, so
  // a failed opening never costs keys and a success pays out exactly once.
  openGardenChest(id) {
    const chest = GARDEN_CHEST_BY_ID[id];
    if (!chest) return fail('Unknown chest.');
    const have = this.state.inventory.key || 0;
    if (have < chest.keys) return fail(`The ${chest.name} needs ${chest.keys} Chest Key${chest.keys > 1 ? 's' : ''}. You have ${have}.`);
    const loot = rollGardenChest(this.state, chest, this.rng);
    this.takeItem('key', chest.keys);
    this.earn(loot.coins);
    for (const [itemId, n] of Object.entries(loot.items)) this.addItem(itemId, n);
    const eggs = loot.eggs.map((tier) => this.addEgg(tier, 'chest'));
    this.state.stats.gardenChests = (this.state.stats.gardenChests || 0) + 1;
    this.commit();
    return { ok: true, chest, area: loot.area, coins: loot.coins, items: loot.items, eggs };
  }

  // ---------- visitors & the rock ----------

  visitor(id) {
    return this.state.garden.visitors.find((v) => v.id === id && v.leavesAt > this.now());
  }

  // Say hi to a wild visitor: it leaves a gift, then heads home soon after.
  greetVisitor(id) {
    const v = this.visitor(id);
    if (!v) return fail('That visitor has already gone home.');
    if (v.greeted) return fail('You already said hi.');
    v.greeted = true;
    v.leavesAt = Math.min(v.leavesAt, this.now() + VISITORS.afterHiMin * 60e3);
    const gift = this.giveFind(rollVisitorGift(this.rng), 'visitor');
    this.state.stats.visitorsGreeted = (this.state.stats.visitorsGreeted || 0) + 1;
    this.commit();
    return { ok: true, name: SPECIES[v.species].name, ...gift };
  }

  // Looks under the rock once its patch has formed. One find per spot.
  searchRock() {
    const g = this.state.garden;
    if (!rockFindReady(g, this.now())) return fail('Nothing new under the rock yet.');
    g.rock.searched = true;
    this.state.stats.rockFinds = (this.state.stats.rockFinds || 0) + 1;
    const find = this.giveFind(rollRockFind(this.rng), 'rock');
    this.commit();
    return { ok: true, ...find };
  }

  // Pays out a find. Eggs settle straight into a free nest when there is one.
  giveFind(find, source) {
    if (find.coins) this.earn(find.coins);
    if (!find.egg) return find;
    const egg = this.addEgg(find.egg, source);
    const busy = this.state.eggs.filter((e) => e.startedAt).length;
    const nested = busy < incubatorCount(this.state) && this.startIncubation(egg.uid).ok;
    return { ...find, nested };
  }

  // ---------- eggs ----------

  addEgg(tier, source) {
    const egg = { uid: this.state.nextUid++, tier, startedAt: null, endsAt: null, source };
    this.state.eggs.push(egg);
    return egg;
  }

  buyEgg(tier) {
    const t = EGG_BY_ID[tier];
    if (!t) return fail('Unknown egg.');
    const stock = shopStock(this.state, tier);
    if (!stock.ok) return fail(`Not in the shop yet. ${stock.reason}.`);
    if (!this.spend(t.price)) return fail('Not enough coins.');
    const egg = this.addEgg(tier, 'shop');
    this.state.stats.eggsBought += 1;
    this.commit();
    return { ok: true, egg };
  }

  startIncubation(eggUid) {
    const egg = this.egg(eggUid);
    if (!egg) return fail('Unknown egg.');
    if (egg.startedAt) return fail('That egg is already incubating.');
    if (this.state.eggs.filter((e) => e.startedAt).length >= incubatorCount(this.state)) return fail('All incubators are busy. Buy Extra Incubators in Upgrades.');
    const now = this.now();
    egg.startedAt = now;
    egg.endsAt = now + incubationMs(this.state, egg.tier);
    this.commit();
    return { ok: true, egg };
  }

  hatchEgg(eggUid) {
    const st = this.state;
    const egg = this.egg(eggUid);
    if (!egg) return fail('Unknown egg.');
    if (!this.eggProgress(egg).ready) return fail('This egg is not ready yet.');
    const roll = rollEgg(egg.tier, this.rng);
    st.eggs = st.eggs.filter((e) => e !== egg);
    const res = createBug(st, roll.speciesId, this.rng, { now: this.now(), origin: 'hatched', eggTier: egg.tier });
    st.stats.hatched += 1;
    this.commit();
    return { ok: true, tier: egg.tier, rarity: roll.rarity, gardenFull: gardenCount(st) >= gardenLimit(st), ...res };
  }

  // ---------- bugs ----------

  setInGarden(uid, inGarden) {
    const bug = this.bug(uid);
    if (!bug) return fail('Unknown bug.');
    if (inGarden && !bug.inGarden && gardenCount(this.state) >= gardenLimit(this.state)) return fail(`The garden holds ${gardenLimit(this.state)} bugs. Move one out first, or buy Bigger Garden in Upgrades.`);
    bug.inGarden = !!inGarden;
    this.commit();
    return { ok: true };
  }

  releaseBug(uid) {
    const st = this.state;
    const bug = this.bug(uid);
    if (!bug) return fail('Unknown bug.');
    if (this.assignment(bug) === 'expedition') return fail(`${bugName(bug)} is away exploring.`);
    if (st.bugs.length <= 1) return fail('You need to keep at least one bug.');
    if (bug.item) this.addItem(bug.item);
    const coins = releaseValue(bug);
    st.bugs = st.bugs.filter((b) => b !== bug);
    this.earn(coins);
    this.commit();
    return { ok: true, coins };
  }

  // ---------- items ----------

  addItem(id, n = 1) {
    this.state.inventory[id] = (this.state.inventory[id] || 0) + n;
  }

  takeItem(id, n = 1) {
    if (!((this.state.inventory[id] || 0) >= n)) return false;
    this.state.inventory[id] -= n;
    if (!this.state.inventory[id]) delete this.state.inventory[id];
    return true;
  }

  buyItem(id) {
    const it = ITEMS[id];
    if (!it?.buy) return fail('That item is not for sale.');
    const stock = itemStock(this.state, id);
    if (!stock.ok) return fail(`${stock.reason}.`);
    if (!this.spend(it.buy)) return fail('Not enough coins.');
    this.addItem(id);
    this.commit();
    return { ok: true };
  }

  sellItem(id, qty = 1) {
    const price = sellPrice(id);
    if (!price) return fail('Nobody wants to buy that.');
    if (!(qty >= 1) || !this.takeItem(id, qty)) return fail('You do not have that many.');
    this.earn(price * qty);
    this.commit();
    return { ok: true, coins: price * qty };
  }

  // One item per bug. Equipping onto a bug that already holds something swaps
  // the old item back into the inventory, so nothing is duplicated or lost.
  equip(uid, itemId) {
    const bug = this.bug(uid);
    if (!bug) return fail('Unknown bug.');
    if (ITEMS[itemId]?.type !== 'gear') return fail('That cannot be equipped.');
    if (this.assignment(bug) === 'expedition') return fail(`${bugName(bug)} is away exploring.`);
    if (!this.takeItem(itemId)) return fail(`You have no ${ITEMS[itemId].name}.`);
    if (bug.item) this.addItem(bug.item);
    bug.item = itemId;
    this.commit();
    return { ok: true };
  }

  unequip(uid) {
    const bug = this.bug(uid);
    if (!bug?.item) return fail('Nothing is equipped.');
    if (this.assignment(bug) === 'expedition') return fail(`${bugName(bug)} is away exploring.`);
    this.addItem(bug.item);
    bug.item = null;
    this.commit();
    return { ok: true };
  }

  // ---------- upgrades & areas ----------

  buyUpgrade(id) {
    const u = UPGRADE_BY_ID[id];
    if (!u) return fail('Unknown upgrade.');
    const level = this.state.upgrades[id] || 0;
    if (level >= u.max) return fail('Already at max level.');
    if (!this.spend(upgradeCost(id, level))) return fail('Not enough coins.');
    this.state.upgrades[id] = level + 1;
    this.commit();
    return { ok: true, level: level + 1 };
  }

  unlockArea(areaId) {
    const check = this.canUnlock(areaId);
    if (!check.ok) return check;
    this.spend(AREA_BY_ID[areaId].unlock.coins);
    this.state.areas[areaId].unlocked = true;
    this.commit();
    return { ok: true };
  }

  // ---------- expeditions ----------

  launchExpedition(areaId, uids, count) {
    const st = this.state;
    const area = AREA_BY_ID[areaId];
    if (!area) return fail('Unknown area.');
    if (!st.areas[areaId].unlocked) return fail(`${area.name} is locked.`);
    if (st.expeditions.length >= expeditionSlots(st)) return fail('All expedition slots are in use. Improved Exploration adds more.');
    const err = validateParty(st, uids, bugsOnExpedition(st));
    if (err) return fail(err);
    if (count !== undefined && !(Number.isInteger(count) && count >= EXPEDITION_LENGTH.min && count <= EXPEDITION_LENGTH.max)) {
      return fail(`An expedition is ${EXPEDITION_LENGTH.min} to ${EXPEDITION_LENGTH.max} encounters.`);
    }
    const party = uids.map((u) => this.bug(u));
    const seed = this.rng.seed();
    const plan = planExpedition(st, area, party, seed, count);
    const now = this.now();
    const encMs = encounterMs(st, area, party);
    const exp = {
      id: st.nextUid++, areaId, party: [...uids], partyNames: party.map(bugName), seed,
      startAt: now, encounterMs: encMs, count: plan.count, endsAt: now + plan.count * encMs,
      encounters: plan.encounters, claimed: false,
    };
    st.expeditions.push(exp);
    this.commit();
    return { ok: true, expedition: exp };
  }

  // Pays out a finished expedition exactly once, then archives it.
  claimExpedition(id) {
    const st = this.state;
    const exp = st.expeditions.find((e) => e.id === id);
    if (!exp) return fail(st.history.some((h) => h.id === id) ? 'Those rewards were already claimed.' : 'Unknown expedition.');
    if (exp.claimed) return fail('Those rewards were already claimed.');
    if (!this.timeline(exp).done) return fail('The party is still exploring.');
    exp.claimed = true;
    const area = AREA_BY_ID[exp.areaId];
    const rewards = sumRewards(exp.encounters);
    this.earn(rewards.coins);
    for (const [itemId, n] of Object.entries(rewards.items)) this.addItem(itemId, n);
    const eggs = rewards.eggs.map((tier) => this.addEgg(tier, area.id));
    const keysUsed = [];
    for (const e of exp.encounters) {
      if (!e.keyUsedBy) continue;
      const bug = this.bug(e.keyUsedBy);
      if (bug?.item === 'key') {
        bug.item = null;
        keysUsed.push(bug.uid);
      }
      st.stats.chestsOpened += 1;
    }
    st.areas[area.id].runs += 1;
    st.stats.expeditions += 1;
    st.expeditions = st.expeditions.filter((e) => e !== exp);
    const record = { ...exp, claimedAt: this.now(), rewards: { coins: rewards.coins, items: rewards.items, eggs: rewards.eggs } };
    st.history.unshift(record);
    st.history.length = Math.min(st.history.length, HISTORY_LIMIT);
    this.commit();
    const nextArea = AREAS[area.index + 1];
    const unlockable = nextArea && !st.areas[nextArea.id].unlocked && st.areas[area.id].runs === nextArea.unlock.runs ? nextArea : null;
    return { ok: true, report: { expedition: record, area, rewards, eggs, keysUsed, unlockable } };
  }
}
