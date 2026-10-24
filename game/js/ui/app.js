import * as V from './views.js';
import { GardenScene } from './garden-scene.js';
import { fmtTime, fmtNum } from './format.js';
import { ITEMS } from '../data/items.js';
import { EGGS } from '../data/eggs.js';
import { SPECIES } from '../data/species.js';
import { AREA_BY_ID } from '../data/areas.js';
import { MAX_TEAM, supplySlots } from '../systems/expedition.js';
import { computeStats, power, bugName, bugsOnExpedition, bugStatus } from '../systems/bugs.js';
import { gardenRatePerMin } from '../systems/garden.js';
import { rotationId } from '../systems/shop.js';

const PANELS = {
  garden: { title: 'Garden', icon: 'flower' },
  bugs: { title: 'Bugs', icon: null },
  explore: { title: 'Explore', icon: 'map' },
  nursery: { title: 'Nursery', icon: null },
  bag: { title: 'Bag', icon: 'bag' },
  shop: { title: 'Shop', icon: 'shop' },
};
const RENDER = { bugs: V.renderBugs, explore: V.renderExplore, nursery: V.renderNursery, bag: V.renderBag, shop: V.renderShop };
export const OFFSET_KEY = 'bug-garden-time-offset';

export class App {
  constructor(game, assets) {
    this.game = game;
    this.A = assets;
    const params = new URLSearchParams(location.search);
    this.ui = { panel: null, bugsTab: 'mine', bugSort: 'rarity', shopTab: 'market', plan: null, debug: params.has('debug'), exportCode: '' };
    this.modal = null;
    this.lastTap = { uid: null, at: 0 };
    this.panelSig = '';
    this.hudSig = '';
  }

  get v() {
    return { game: this.game, A: this.A, ui: this.ui };
  }

  init(loadInfo = {}) {
    const $ = (s) => document.querySelector(s);
    this.el = {
      topbar: $('#topbar'), hud: $('#hud'), sheet: $('#sheet'), sheetTitle: $('#sheet-title'), sheetBody: $('#sheet-body'),
      nav: $('#nav'), modalRoot: $('#modal-root'), toasts: $('#toasts'),
    };
    this.el.nav.innerHTML = Object.entries(PANELS).map(([id, p]) => {
      const img = id === 'bugs' ? this.A.bugUrl('ladybug') : id === 'nursery' ? this.A.eggUrl('meadow_egg') : this.A.spriteUrl(p.icon);
      return `<button data-act="nav" data-panel="${id}" class="${id === 'garden' ? 'on' : ''}"><img class="px" src="${img}" alt=""><span>${p.title}</span></button>`;
    }).join('');

    this.scene = new GardenScene(document.querySelector('#garden'), this.game, this.A, {
      onVisitor: () => this.dispatch('visitor', {}),
      onCoins: () => this.collectGarden(false),
      onEgg: (egg) => {
        if (egg && this.game.eggProgress(egg).ready) this.hatch(egg.uid);
        else this.openPanel('nursery');
      },
      onBug: (uid) => {
        const now = performance.now();
        if (this.lastTap.uid === uid && now - this.lastTap.at < 2500) this.dispatch('open-bug', { uid });
        this.lastTap = { uid, at: now };
      },
      labelFor: (uid) => {
        const b = this.game.bug(uid);
        return b ? `${bugName(b)} Lv${b.level}` : '';
      },
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
    this.game.on((type, payload) => {
      if (type === 'change') this.render();
      if (type === 'toast') this.toast(payload.text, payload.kind);
    });
    const persist = () => this.game.save();
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    window.addEventListener('pagehide', persist);
    setInterval(() => this.second(), 1000);
    setInterval(persist, 15000);

    this.render();
    if (!this.game.state.flags.welcomed) this.openModal(() => V.welcomeModal(this.v), { static: true, locked: true });
    else if (loadInfo.awayMs > 60e3) this.welcomeBack(loadInfo);
  }

  welcomeBack(info) {
    const st = this.game.state;
    const done = st.expeditions.filter((e) => this.game.expeditionProgress(e).done).length;
    const eggs = st.eggs.filter((e) => e.startedAt && this.game.eggProgress(e).ready).length;
    const parts = [`Welcome back! You were away ${fmtTime(info.awayMs)}.`];
    if (info.gardenEarned > 0) parts.push(`The garden made ${fmtNum(info.gardenEarned)} coins.`);
    if (done) parts.push(`${done} team${done > 1 ? 's are' : ' is'} home.`);
    if (eggs) parts.push(`${eggs} egg${eggs > 1 ? 's are' : ' is'} ready.`);
    this.toast(parts.join(' '), 'good', 6000);
  }

  // ---------- rendering ----------

  render() {
    this.el.topbar.innerHTML = V.renderTopbar(this.v);
    this.renderHud(true);
    if (this.ui.panel) this.renderPanel();
    if (this.modal && !this.modal.static) this.renderModal();
    this.panelSig = this.signature();
  }

  renderHud(force = false) {
    const st = this.game.state;
    const sig = this.hudSignature();
    if (force || sig !== this.hudSig) {
      this.el.hud.innerHTML = V.renderHud(this.v);
      this.hudSig = sig;
    } else {
      const pot = this.el.hud.querySelector('.pot b');
      if (pot) pot.textContent = fmtNum(st.garden.pot);
      const rate = this.el.hud.querySelector('.pot small');
      if (rate) rate.textContent = `+${gardenRatePerMin(st).toFixed(1)}/min`;
    }
  }

  renderPanel() {
    const fn = RENDER[this.ui.panel];
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
      st.expeditions.map((e) => `${e.id}:${g.expeditionProgress(e).done}`).join(','),
      st.eggs.filter((e) => e.startedAt && g.eggProgress(e).ready).length,
      st.garden.visitor?.species || '',
      st.garden.pot >= 1,
    ].join('|');
  }

  // Discrete time-driven state. When it changes, timers crossed a threshold
  // (an egg became ready, a bug woke up...) and the open views need a redraw.
  signature() {
    const g = this.game;
    const st = g.state;
    const now = g.now();
    return [
      st.expeditions.map((e) => {
        const p = g.expeditionProgress(e);
        return `${e.id}:${e.events.filter((ev) => ev.at <= p.fraction + 1e-9).length}:${p.done}`;
      }).join(','),
      st.eggs.map((e) => (e.startedAt ? (g.eggProgress(e).ready ? 'R' : 'i') : '-')).join(''),
      st.bugs.map((b) => (b.restUntil > now ? 1 : 0)).join(''),
      st.garden.visitor?.species || '',
      rotationId(now),
    ].join('|');
  }

  second() {
    this.game.tick();
    const sig = this.signature();
    if (sig !== this.panelSig) {
      this.render();
      return;
    }
    this.renderHud();
    const now = this.game.now();
    for (const el of document.querySelectorAll('[data-ends]')) el.textContent = fmtTime(Number(el.dataset.ends) - now);
    for (const el of document.querySelectorAll('[data-start]')) {
      const s = Number(el.dataset.start);
      const e = Number(el.dataset.ends);
      el.style.width = `${Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100)).toFixed(1)}%`;
    }
    for (const el of document.querySelectorAll('.march')) {
      const bar = el.closest('.modal-body')?.querySelector('.bar.exp i');
      if (bar) el.style.setProperty('--p', parseFloat(bar.style.width) / 100);
    }
  }

  // ---------- panels, modals, toasts ----------

  openPanel(name) {
    if (name === 'garden' || !RENDER[name]) return this.closePanel();
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
    document.querySelector('#app').classList.add('has-modal');
    this.el.modalRoot.innerHTML = `<div class="backdrop"><div class="modal ${cls}" role="dialog"><button class="modal-x" data-act="close-modal" aria-label="Close" ${locked ? 'hidden' : ''}>×</button><div class="modal-body"></div></div></div>`;
    this.renderModal();
  }

  closeModal() {
    this.modal = null;
    this.el.modalRoot.innerHTML = '';
    document.querySelector('#app').classList.remove('has-modal');
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

  // ---------- actions ----------

  collectGarden(float = true) {
    const res = this.game.collectGarden();
    if (!res.ok) {
      this.toast(res.error, 'bad');
      return res;
    }
    if (float) this.scene.float(75, this.scene.camY + this.scene.viewH * 0.4, `+${res.coins}`);
    this.toast(`Collected ${res.coins} coins from the garden.`, 'good');
    return res;
  }

  hatch(uid) {
    const res = this.game.hatchEgg(uid);
    if (!this.result(res)) return;
    this.openModal(() => V.hatchModal(this.v, res, 'egg'), { static: true, locked: true, cls: 'hatch' });
    setTimeout(() => {
      if (this.modal?.locked) this.openModal(() => V.hatchModal(this.v, res, 'reveal'), { static: true, cls: 'hatch' });
    }, 1500);
  }

  autoTeam(areaId) {
    const st = this.game.state;
    const away = bugsOnExpedition(st);
    return st.bugs
      .filter((b) => bugStatus(b, st, this.game.now(), away) === 'ready')
      .sort((a, b) => power(computeStats(b, st, { areaId })) - power(computeStats(a, st, { areaId })))
      .slice(0, MAX_TEAM)
      .map((b) => b.uid);
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
      case 'bug-sort': ui.bugSort = d.sort; this.renderPanel(); break;
      case 'shop-tab': ui.shopTab = d.tab; this.renderPanel(); break;
      case 'open-bug': this.openModal(() => V.bugModal(this.v, uid)); break;
      case 'open-species': this.openModal(() => V.speciesModal(this.v, d.id)); break;
      case 'rename': {
        const bug = g.bug(uid);
        const name = prompt('Give this bug a nickname (leave empty to reset):', bug?.nickname || '');
        if (name !== null) this.result(g.renameBug(uid, name));
        break;
      }
      case 'release': {
        const bug = g.bug(uid);
        if (bug && confirm(`Release ${bugName(bug)} back into the wild? You will receive some coins as thanks.`)) {
          const res = g.releaseBug(uid);
          if (this.result(res, `${bugName(bug)} waved goodbye. +${res.coins} coins.`)) this.closeModal();
        }
        break;
      }
      case 'equip':
        if (this.result(g.equip(uid, d.item), `Equipped ${ITEMS[d.item].name}.`)) this.dispatch('open-bug', { uid });
        break;
      case 'unequip': this.result(g.unequip(uid), 'Gear returned to your bag.'); break;
      case 'use-on-bug': {
        const res = g.useItem(d.item, uid);
        if (this.result(res, res.message)) this.dispatch('open-bug', { uid });
        break;
      }
      case 'plan':
        ui.plan = { areaId: d.area, team: this.autoTeam(d.area), supplies: [] };
        this.openModal(() => V.plannerModal(this.v));
        break;
      case 'plan-toggle': {
        const t = ui.plan.team;
        if (t.includes(uid)) ui.plan.team = t.filter((u) => u !== uid);
        else if (t.length < MAX_TEAM) t.push(uid);
        else this.toast(`A team has at most ${MAX_TEAM} bugs.`, 'bad');
        this.renderModal();
        break;
      }
      case 'plan-auto': ui.plan.team = this.autoTeam(ui.plan.areaId); this.renderModal(); break;
      case 'plan-supply-add':
        if (ui.plan.supplies.length < supplySlots(st)) ui.plan.supplies.push(d.item);
        this.renderModal();
        break;
      case 'plan-supply-remove': {
        const i = ui.plan.supplies.indexOf(d.item);
        if (i >= 0) ui.plan.supplies.splice(i, 1);
        this.renderModal();
        break;
      }
      case 'launch': {
        const res = g.launchExpedition(ui.plan.areaId, ui.plan.team, ui.plan.supplies);
        if (this.result(res, `The team sets off for ${AREA_BY_ID[ui.plan.areaId].name}!`)) this.dispatch('view-exp', { id: res.expedition.id });
        break;
      }
      case 'view-exp': this.openModal(() => V.expeditionModal(this.v, Number(d.id))); break;
      case 'collect-exp': {
        const res = g.collectExpedition(Number(d.id));
        if (this.result(res)) this.openModal(() => V.reportModal(this.v, res.report), { static: true });
        break;
      }
      case 'sugar': {
        const res = g.useItem('sugar_cube', Number(d.id));
        if (this.result(res, res.message) && this.modal?.kind === 'pick') this.closeModal();
        break;
      }
      case 'moss': {
        const res = g.useItem('warm_moss', uid);
        if (this.result(res, res.message) && this.modal?.kind === 'pick') this.closeModal();
        break;
      }
      case 'unlock': {
        const area = AREA_BY_ID[d.area];
        if (confirm(`Unlock ${area.name} for ${fmtNum(area.unlockCost)} coins?`)) this.result(g.unlockArea(d.area), `${area.name} is open for exploring!`);
        break;
      }
      case 'incubate': this.result(g.startEgg(uid), 'The egg is snug in the nursery.'); break;
      case 'hatch': this.hatch(uid); break;
      case 'odds': this.openModal(() => V.oddsModal(this.v, d.type)); break;
      case 'item-use': {
        const it = ITEMS[d.item];
        if (it.use === 'bug') this.openModal(() => V.pickBugModal(this.v, d.item, 'use'));
        else this.openModal(() => V.pickTargetModal(this.v, d.item), { kind: 'pick' });
        break;
      }
      case 'item-equip': this.openModal(() => V.pickBugModal(this.v, d.item, 'equip')); break;
      case 'sell': {
        const res = g.sell(d.item, Number(d.qty));
        this.result(res, res.ok ? `Sold for ${res.coins} coins.` : '');
        break;
      }
      case 'buy': {
        const res = g.buy(d.id, { offerIndex: d.offer !== undefined ? Number(d.offer) : null });
        const name = EGGS[d.id]?.name || ITEMS[d.id]?.name;
        this.result(res, `Bought ${name}!${EGGS[d.id] ? ' Find it in the Nursery.' : ''}`);
        break;
      }
      case 'upgrade': {
        const res = g.buyUpgrade(d.id);
        this.result(res, 'Upgrade complete!');
        break;
      }
      case 'collect-garden': this.collectGarden(); break;
      case 'visitor': this.openModal(() => V.visitorModal(this.v)); break;
      case 'catch': {
        const res = g.catchVisitor({ useHoney: d.honey === '1' });
        if (!this.result(res)) break;
        if (res.caught) {
          this.toast(`${SPECIES[res.bug.species].name} joined your garden!${res.newSpecies ? ` New species! +${res.reward}` : ''}`, 'good');
          this.dispatch('open-bug', { uid: res.bug.uid });
        } else {
          this.toast(`The ${SPECIES[res.species].name} got spooked and flew away.`, 'bad');
          this.closeModal();
        }
        break;
      }
      case 'settings': ui.exportCode = ''; this.openModal(() => V.settingsModal(this.v), { static: true }); break;
      case 'export':
        ui.exportCode = g.exportSave();
        this.openModal(() => V.settingsModal(this.v), { static: true });
        navigator.clipboard?.writeText(ui.exportCode).then(() => this.toast('Save code copied to clipboard.', 'good'), () => {});
        break;
      case 'import': {
        const code = document.querySelector('#save-code')?.value || '';
        if (this.result(g.importSave(code), 'Save imported!')) this.closeModal();
        break;
      }
      case 'reset':
        if (confirm('Erase all progress and start a brand-new garden?') && confirm('Are you really sure? This cannot be undone.')) {
          g.reset();
          this.closeModal();
          this.closePanel();
          this.openModal(() => V.welcomeModal(this.v), { static: true, locked: true });
        }
        break;
      case 'warp':
        g.warp(Number(d.ms));
        try { localStorage.setItem(OFFSET_KEY, String(g.timeOffset)); } catch { /* ignore */ }
        this.openModal(() => V.settingsModal(this.v), { static: true });
        break;
      case 'cheat-coins': g.earn(1000); g.commit(); break;
      case 'help': this.openModal(() => V.welcomeModal(this.v), { static: true }); break;
      case 'welcome-done': st.flags.welcomed = true; g.commit(); this.closeModal(); break;
      case 'close-modal': this.closeModal(); break;
      default: console.warn('Unknown action', act);
    }
  }
}
