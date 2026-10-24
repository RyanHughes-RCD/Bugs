import * as V from './views.js';
import { GardenScene } from './garden-scene.js';
import { fmtTime, fmtNum } from './format.js';
import { ITEMS } from '../data/items.js';
import { EGG_BY_ID, EGG_TIERS } from '../data/eggs.js';
import { AREA_BY_ID } from '../data/areas.js';
import { UPGRADE_BY_ID, upgradeCost } from '../data/upgrades.js';
import { BIG_SPEND, PARTY_SIZE } from '../data/balance.js';
import { bugsOnExpedition, traitTotal, bugName } from '../systems/bugs.js';
import { gardenRatePerMin } from '../systems/garden.js';
import { simulateHatches } from '../systems/eggs.js';
import { checkForUpdate, applyUpdate } from './updater.js';

const PANELS = {
  garden: { title: 'Garden', icon: 'flower' },
  hatchery: { title: 'Hatchery', egg: true, render: V.renderHatchery },
  bugs: { title: 'Bugs', bug: 'ladybug', render: V.renderCollection },
  explore: { title: 'Explore', icon: 'map', render: V.renderExpeditions },
  items: { title: 'Items', icon: 'bag', render: V.renderItems },
  upgrades: { title: 'Upgrades', icon: 'hammer', render: V.renderUpgrades },
};
export const OFFSET_KEY = 'bug-garden-time-offset';

export class App {
  constructor(game, assets) {
    this.game = game;
    this.A = assets;
    this.ui = {
      panel: null, bugsTab: 'mine', itemsTab: 'shop', sort: 'rarity', filter: {}, plan: null,
      debug: new URLSearchParams(location.search).has('debug'), exportCode: '', oddsLab: null,
    };
    this.modal = null;
    this.pending = null;
    this.sig = '';
    this.hudSig = '';
  }

  get v() {
    return { game: this.game, A: this.A, ui: this.ui };
  }

  init(loadInfo = {}) {
    const $ = (s) => document.querySelector(s);
    this.el = {
      app: $('#app'), topbar: $('#topbar'), hud: $('#hud'), quick: $('#quick'), sheet: $('#sheet'), sheetTitle: $('#sheet-title'),
      sheetBody: $('#sheet-body'), nav: $('#nav'), modalRoot: $('#modal-root'), toasts: $('#toasts'),
    };
    this.el.nav.innerHTML = Object.entries(PANELS).map(([id, p]) => {
      const img = p.bug ? this.A.bugUrl(p.bug) : p.egg ? this.A.eggUrl('uncommon') : this.A.spriteUrl(p.icon);
      return `<button data-act="nav" data-panel="${id}" class="${id === 'garden' ? 'on' : ''}"><img class="px" src="${img}" alt=""><span>${p.title}</span></button>`;
    }).join('');

    this.scene = new GardenScene(document.querySelector('#garden'), this.game, this.A, {
      onCoins: () => this.collectGarden(false),
      onEgg: (egg) => (egg && this.game.eggProgress(egg).ready ? this.hatch(egg.uid) : this.openPanel('hatchery')),
      onBug: (uid) => this.showQuick(uid),
      onEmpty: () => this.hideQuick(),
      onRockLift: (found) => {
        this.hideQuick();
        if (found.length) {
          const names = found.map((uid) => this.game.bug(uid)).filter(Boolean).map(bugName);
          this.toast(`You lift the rock... ${names.join(' and ')} ${names.length > 1 ? 'were' : 'was'} hiding underneath! Say hi!`, 'good');
        }
      },
      onRockMoved: (x, y) => this.game.moveRock(x, y),
    });
    this.scene.start();

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      e.preventDefault();
      this.dispatch(el.dataset.act, { ...el.dataset });
    });
    this.el.modalRoot.addEventListener('click', (e) => {
      if (e.target.classList.contains('backdrop') && !this.modal?.locked) this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && !this.modal.locked) this.closeModal();
    });
    this.game.on((type) => { if (type === 'change') this.render(); });
    const persist = () => this.game.save();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persist();
      else {
        this.second();
        this.checkUpdate();
      }
    });
    this.checkUpdate();
    window.addEventListener('pagehide', persist);
    setInterval(() => this.second(), 1000);
    setInterval(persist, 15000);

    this.render();
    const flags = this.game.state.flags;
    if (flags.migratedFromV1 && !flags.migrationShown) {
      flags.migrationShown = true;
      this.game.commit();
      this.openModal(() => V.migratedModal(this.v, flags.migratedFromV1.refund), { static: true });
    } else if (!flags.welcomed) {
      this.openModal(() => V.welcomeModal(this.v), { static: true, locked: true });
    } else if (loadInfo.awayMs > 60e3) {
      this.welcomeBack(loadInfo.awayMs);
    }
  }

  // Quietly looks for a newer published version (at most every 5 minutes)
  // and shows an update chip on the garden if there is one.
  async checkUpdate({ force = false, report = false } = {}) {
    if (!force && Date.now() - (this.lastUpdateCheck || 0) < 5 * 60e3) return;
    this.lastUpdateCheck = Date.now();
    try {
      const res = await checkForUpdate();
      this.ui.updateAvailable = res.available ? res.latest : null;
      this.renderHud(true);
      if (report) this.toast(res.available ? `Version ${res.latest} is ready. Tap Update now.` : `You're on the latest version (${res.current}).`, 'good');
    } catch {
      if (report) this.toast('Could not check for updates. Are you online?', 'bad');
    }
  }

  welcomeBack(awayMs) {
    const g = this.game;
    const st = g.state;
    const done = st.expeditions.filter((e) => g.timeline(e).done).length;
    const eggs = st.eggs.filter((e) => e.startedAt && g.eggProgress(e).ready).length;
    const parts = [`Welcome back! You were away ${fmtTime(awayMs)}.`];
    if (done) parts.push(`${done} expedition${done > 1 ? 's have' : ' has'} rewards to claim.`);
    if (eggs) parts.push(`${eggs} egg${eggs > 1 ? 's are' : ' is'} ready to hatch!`);
    this.toast(parts.join(' '), 'good', 6000);
  }

  // ---------- rendering ----------

  render() {
    this.el.topbar.innerHTML = V.renderTopbar(this.v);
    this.renderHud(true);
    if (this.ui.panel) this.renderPanel();
    if (this.modal && !this.modal.static) this.renderModal();
    if (this.quickUid) this.showQuick(this.quickUid, false);
    this.sig = this.signature();
  }

  renderHud(force = false) {
    const sig = this.hudSignature();
    if (force || sig !== this.hudSig) {
      this.el.hud.innerHTML = V.renderHud(this.v);
      this.hudSig = sig;
    } else {
      const st = this.game.state;
      const pot = this.el.hud.querySelector('.pot b');
      if (pot) pot.textContent = fmtNum(st.garden.pot);
      const rate = this.el.hud.querySelector('.pot small');
      if (rate) rate.textContent = `+${gardenRatePerMin(st).toFixed(1)}/min`;
    }
  }

  renderPanel() {
    const fn = PANELS[this.ui.panel]?.render;
    if (fn) this.el.sheetBody.innerHTML = fn(this.v);
  }

  renderModal() {
    const html = this.modal.render();
    if (html === null) return this.closeModal();
    this.el.modalRoot.querySelector('.modal-body').innerHTML = html;
  }

  hudSignature() {
    const g = this.game;
    const st = g.state;
    return [
      st.expeditions.map((e) => `${e.id}:${g.timeline(e).resolved}:${g.timeline(e).done}`).join(','),
      st.eggs.map((e) => (e.startedAt ? `${e.uid}${g.eggProgress(e).ready ? 'R' : 'i'}` : '')).join(''),
      st.garden.pot >= 1,
      this.ui.updateAvailable || '',
    ].join('|');
  }

  // Changes when a timer crosses a threshold (encounter resolved, egg ready),
  // so open screens redraw at exactly that moment.
  signature() {
    return this.hudSignature();
  }

  second() {
    this.game.tick();
    if (this.signature() !== this.sig) {
      this.render();
      return;
    }
    this.renderHud();
    const now = this.game.now();
    for (const el of document.querySelectorAll('[data-ends]')) el.textContent = fmtTime(Number(el.dataset.ends) - now);
    for (const el of document.querySelectorAll('[data-since]')) el.textContent = fmtTime(now - Number(el.dataset.since));
    for (const el of document.querySelectorAll('[data-start]')) {
      const s = Number(el.dataset.start);
      const e = Number(el.dataset.ends);
      el.style.width = `${Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100)).toFixed(1)}%`;
    }
    for (const el of document.querySelectorAll('.march')) {
      const fill = el.closest('.modal-body')?.querySelector('.bar.exp i');
      if (fill) el.style.setProperty('--p', parseFloat(fill.style.width) / 100);
    }
  }

  // ---------- panels, modals, toasts ----------

  openPanel(name) {
    this.hideQuick();
    if (!PANELS[name]?.render) return this.closePanel();
    this.ui.panel = name;
    this.el.sheetTitle.textContent = PANELS[name].title;
    this.el.sheet.classList.add('open');
    this.el.sheetBody.scrollTop = 0;
    this.renderPanel();
    this.markNav();
  }

  closePanel() {
    this.ui.panel = null;
    this.el.sheet.classList.remove('open');
    this.markNav();
  }

  markNav() {
    for (const b of this.el.nav.querySelectorAll('button')) b.classList.toggle('on', b.dataset.panel === (this.ui.panel || 'garden'));
  }

  openModal(render, { static: isStatic = false, locked = false, cls = '', kind = '' } = {}) {
    this.modal = { render, static: isStatic, locked, kind };
    this.el.app.classList.add('has-modal');
    this.el.modalRoot.innerHTML = `<div class="backdrop"><div class="modal ${cls}" role="dialog"><button class="modal-x" data-act="close-modal" aria-label="Close" ${locked ? 'hidden' : ''}>×</button><div class="modal-body"></div></div></div>`;
    this.renderModal();
  }

  closeModal() {
    this.modal = null;
    this.pending = null;
    this.el.modalRoot.innerHTML = '';
    this.el.app.classList.remove('has-modal');
  }

  ask(opts, onYes) {
    this.openModal(() => V.confirmModal(this.v, opts), { static: true, kind: 'confirm' });
    this.pending = onYes;
  }

  // Asks first when a purchase is large compared with the player's coins.
  spendCheck(price, label, onYes) {
    const coins = this.game.state.coins;
    if (price >= BIG_SPEND.coins || price >= coins * BIG_SPEND.fraction) {
      this.ask({ title: 'Big purchase', body: `<p>Spend <b>${fmtNum(price)}</b> of your ${fmtNum(coins)} coins on ${label}?</p>`, yes: `Buy for ${fmtNum(price)}` }, onYes);
    } else {
      onYes();
    }
  }

  toast(text, kind = 'info', ms = 3200) {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  result(res, okMsg) {
    if (!res.ok) this.toast(res.error, 'bad');
    else if (okMsg) this.toast(okMsg, 'good');
    return res.ok;
  }

  showQuick(uid, fresh = true) {
    const html = V.quickBugCard(this.v, uid);
    if (!html) return this.hideQuick();
    this.quickUid = uid;
    this.el.quick.innerHTML = html;
    this.el.quick.hidden = false;
    this.el.app.classList.add('has-quick');
    if (fresh) {
      clearTimeout(this.quickTimer);
      this.quickTimer = setTimeout(() => this.hideQuick(), 8000);
    }
  }

  hideQuick() {
    this.quickUid = null;
    if (this.el?.quick) this.el.quick.hidden = true;
    this.el?.app.classList.remove('has-quick');
  }

  // ---------- actions ----------

  collectGarden(float = true) {
    const res = this.game.collectGarden();
    if (!res.ok) {
      this.toast(res.error, 'bad');
      return res;
    }
    if (float) this.scene.float(75, this.scene.camY + this.scene.viewH * 0.4, `+${res.coins}`);
    this.toast(`Your garden bugs dug up ${res.coins} coins.`, 'good');
    return res;
  }

  hatch(uid) {
    const res = this.game.hatchEgg(uid); // saved immediately, before the animation
    if (!this.result(res)) return;
    const s = { res, stage: 0 };
    this.hatchState = s;
    this.hideQuick();
    this.openModal(() => V.hatchModal(this.v, s), { cls: 'hatch-full', locked: true, static: true });
  }

  autoParty(areaId) {
    const st = this.game.state;
    const away = bugsOnExpedition(st);
    return st.bugs.filter((b) => !away.has(b.uid)).sort((a, b) => traitTotal(b) - traitTotal(a)).slice(0, PARTY_SIZE).map((b) => b.uid);
  }

  dispatch(act, d) {
    const g = this.game;
    const st = g.state;
    const ui = this.ui;
    const uid = d.uid !== undefined ? Number(d.uid) : null;
    switch (act) {
      case 'nav':
        this.closeModal();
        if (d.tab) ui.bugsTab = d.tab;
        this.openPanel(d.panel);
        break;
      case 'bugs-tab': ui.bugsTab = d.tab; this.renderPanel(); break;
      case 'items-tab': ui.itemsTab = d.tab; this.renderPanel(); break;
      case 'filter': ui.filter = { ...ui.filter, [d.key]: d.val || undefined }; this.renderPanel(); break;
      case 'sort': ui.sort = d.sort; this.renderPanel(); break;
      case 'open-bug': this.hideQuick(); this.openModal(() => V.bugModal(this.v, uid)); break;
      case 'open-species': this.openModal(() => V.speciesModal(this.v, d.id)); break;
      case 'release': {
        const bug = g.bug(uid);
        this.ask({ title: `Release this ${bugName(bug)}?`, body: '<p>It goes back to the wild and leaves you some coins as thanks. This cannot be undone.</p>', yes: 'Release', danger: true }, () => {
          const res = g.releaseBug(uid);
          this.result(res, `The ${bugName(bug)} waved goodbye. +${res.coins} coins.`);
        });
        break;
      }
      case 'garden-in': {
        const res = g.setInGarden(uid, true);
        if (this.result(res, `${bugName(g.bug(uid))} moved into the garden.`) && d.close) this.closeModal();
        break;
      }
      case 'garden-out': this.result(g.setInGarden(uid, false), `${bugName(g.bug(uid))} moved to storage. It's still in your collection.`); break;
      case 'equip':
        if (this.result(g.equip(uid, d.item), `Equipped ${ITEMS[d.item].name}.`) && this.modal?.kind === 'pick') this.dispatch('open-bug', { uid });
        break;
      case 'unequip': this.result(g.unequip(uid), 'Item returned to your inventory.'); break;
      case 'item-equip': this.openModal(() => V.pickBugModal(this.v, d.item), { kind: 'pick' }); break;
      case 'sell': {
        const res = g.sellItem(d.item, Number(d.qty));
        this.result(res, res.ok ? `Sold for ${res.coins} coins.` : '');
        break;
      }
      case 'buy-item':
        this.spendCheck(ITEMS[d.item].buy, ITEMS[d.item].name, () => this.result(g.buyItem(d.item), `Bought ${ITEMS[d.item].name}!`));
        break;
      case 'buy-egg': {
        const t = EGG_BY_ID[d.tier];
        this.spendCheck(t.price, `a ${t.name}`, () => this.result(g.buyEgg(d.tier), `${t.name} added to your basket.`));
        break;
      }
      case 'odds': this.openModal(() => V.oddsModal(this.v, d.tier)); break;
      case 'incubate': this.result(g.startIncubation(uid), 'The egg is warm and snug. It will hatch in time.'); break;
      case 'hatch': this.hatch(uid); break;
      case 'crack': {
        const s = this.hatchState;
        if (!s) break;
        s.stage = Math.min(4, s.stage + 1);
        if (s.stage === 4) this.modal.locked = false;
        this.renderModal();
        this.el.modalRoot.querySelector('.modal-x').hidden = true;
        const modal = this.el.modalRoot.querySelector('.modal');
        modal.classList.remove('quake');
        void modal.offsetWidth; // restart the shake animation
        if (s.stage >= 3) modal.classList.add('quake');
        navigator.vibrate?.(s.stage === 4 ? [30, 40, 80] : 20);
        break;
      }
      case 'upgrade': {
        const u = UPGRADE_BY_ID[d.id];
        const cost = upgradeCost(d.id, st.upgrades[d.id] || 0);
        this.spendCheck(cost, `${u.name} level ${(st.upgrades[d.id] || 0) + 1}`, () => this.result(g.buyUpgrade(d.id), `${u.name} upgraded!`));
        break;
      }
      case 'unlock': {
        const area = AREA_BY_ID[d.area];
        this.ask({ title: `Unlock ${area.name}?`, body: `<p>Pay <b>${fmtNum(area.unlock.coins)}</b> coins to open ${area.name} for expeditions.</p>`, yes: 'Unlock' },
          () => this.result(g.unlockArea(d.area), `${area.name} is open!`));
        break;
      }
      case 'plan':
        ui.plan = { areaId: d.area, party: this.autoParty(d.area) };
        this.openModal(() => V.plannerModal(this.v));
        break;
      case 'plan-toggle': {
        const p = ui.plan.party;
        if (p.includes(uid)) ui.plan.party = p.filter((u) => u !== uid);
        else if (p.length < PARTY_SIZE) p.push(uid);
        else this.toast(`A party is exactly ${PARTY_SIZE} bugs. Remove one first.`, 'bad');
        this.renderModal();
        break;
      }
      case 'plan-auto': ui.plan.party = this.autoParty(ui.plan.areaId); this.renderModal(); break;
      case 'launch': {
        const area = AREA_BY_ID[ui.plan.areaId];
        const names = ui.plan.party.map((u) => bugName(g.bug(u))).join(', ');
        const plan = { ...ui.plan, party: [...ui.plan.party] };
        this.ask({ title: `Send the party to ${area.name}?`, body: `<p>${names} will be away until the expedition ends. Their items can't be changed while they're exploring.</p>`, yes: 'Set off!' }, () => {
          const res = g.launchExpedition(plan.areaId, plan.party);
          if (this.result(res, `The party sets off for ${area.name}!`)) this.dispatch('view-exp', { id: res.expedition.id });
          else { ui.plan = plan; this.openModal(() => V.plannerModal(this.v)); }
        });
        break;
      }
      case 'view-exp': this.openModal(() => V.expeditionLogModal(this.v, Number(d.id))); break;
      case 'view-history': this.openModal(() => V.expeditionLogModal(this.v, Number(d.id), true)); break;
      case 'claim': {
        const res = g.claimExpedition(Number(d.id));
        if (this.result(res)) this.openModal(() => V.claimModal(this.v, res.report), { static: true });
        break;
      }
      case 'collect-garden': this.collectGarden(); break;
      case 'confirm-yes': {
        const fn = this.pending;
        this.closeModal();
        fn?.();
        break;
      }
      case 'settings': ui.exportCode = ''; this.openModal(() => V.settingsModal(this.v), { static: true }); break;
      case 'export':
        ui.exportCode = g.exportSave();
        this.openModal(() => V.settingsModal(this.v), { static: true });
        navigator.clipboard?.writeText(ui.exportCode).then(() => this.toast('Save code copied.', 'good'), () => {});
        break;
      case 'import': {
        const code = document.querySelector('#save-code')?.value || '';
        if (this.result(g.importSave(code), 'Save imported!')) this.closeModal();
        break;
      }
      case 'reset':
        this.ask({ title: 'Reset the game?', body: '<p>This erases all bugs, eggs, coins and progress on this device. It cannot be undone.</p>', yes: 'Erase everything', danger: true }, () => {
          g.reset();
          this.closePanel();
          this.openModal(() => V.welcomeModal(this.v), { static: true, locked: true });
        });
        break;
      case 'help': this.openModal(() => V.welcomeModal(this.v), { static: true }); break;
      case 'check-update':
        this.checkUpdate({ force: true, report: true }).then(() => {
          if (this.modal?.static) this.openModal(() => V.settingsModal(this.v), { static: true });
        });
        break;
      case 'update-app':
        g.save();
        this.toast('Updating to the latest version...', 'good');
        applyUpdate();
        break;
      case 'welcome-done': st.flags.welcomed = true; g.commit(); this.closeModal(); break;
      case 'close-modal': this.closeModal(); break;
      // Developer tools (?debug only).
      case 'warp':
        g.warp(Number(d.ms));
        try { localStorage.setItem(OFFSET_KEY, String(g.timeOffset)); } catch { /* ignore */ }
        this.openModal(() => V.settingsModal(this.v), { static: true });
        break;
      case 'dev-coins': g.earn(5000); g.commit(); break;
      case 'dev-key': g.addItem('key'); g.commit(); this.toast('Added a Chest Key.'); break;
      case 'dev-eggs': for (const t of EGG_TIERS) g.addEgg(t.id, 'dev'); g.commit(); this.toast('Added one egg of each tier.'); break;
      case 'dev-odds':
        ui.oddsLab = { tier: d.tier, counts: simulateHatches(d.tier, 10000, Date.now() % 100000) };
        this.openModal(() => V.settingsModal(this.v), { static: true });
        break;
      default: console.warn('Unknown action', act);
    }
  }
}
