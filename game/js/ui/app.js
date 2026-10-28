import * as V from './views.js';
import { GardenScene } from './garden-scene.js';
import { fmtTime, fmtNum } from './format.js';
import { ITEMS } from '../data/items.js';
import { EGG_BY_ID, EGG_TIERS } from '../data/eggs.js';
import { AREA_BY_ID } from '../data/areas.js';
import { UPGRADE_BY_ID, upgradeCost } from '../data/upgrades.js';
import { BIG_SPEND, PARTY_SIZE } from '../data/balance.js';
import { SPECIES } from '../data/species.js';
import { clampEncounterCount, defaultEncounterCount, encounterMs } from '../systems/expedition.js';
import { partySynergies, guaranteedOnly } from '../systems/synergies.js';
import { bugsOnExpedition, bugName } from '../systems/bugs.js';
import { gardenRatePerMin, favouriteDecor } from '../systems/garden.js';
import { DECOR_BY_ID } from '../data/decor.js';
import { simulateHatches } from '../systems/eggs.js';
import { checkForUpdate, applyUpdate } from './updater.js';
import { SpriteEditor } from '../community/editor.js';
import { cleanRows } from '../community/studio.js';

const anEgg = (tier) => { const n = EGG_BY_ID[tier].name; return `${/^[AEIOU]/.test(n) ? 'an' : 'a'} ${n}`; };
const BACKUP_TIME_KEY = 'bug-garden-last-backup';
const LIVE_SPRITES_KEY = 'bug-garden-studio-sprites'; // approved fixes, so they show before the studio connects

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
      studioFilter: { status: 'pending', kind: null, mine: false },
    };
    this.modal = null;
    this.pending = null;
    this.sig = '';
    this.hudSig = '';
  }

  get v() {
    return { game: this.game, A: this.A, ui: this.ui, studio: this.studio };
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
          const names = found.map((key) => {
            const v = typeof key === 'string' && this.game.visitor(Number(key.slice(1)));
            return v ? `a wild ${SPECIES[v.species].name}` : this.game.bug(key) && bugName(this.game.bug(key));
          }).filter(Boolean);
          if (names.length) this.toast(`You lift the rock... ${names.join(' and ')} ${names.length > 1 ? 'were' : 'was'} hiding underneath! Say hi!`, 'good');
        }
        const res = this.game.searchRock();
        if (!res.ok) return;
        const r = this.game.state.garden.rock;
        if (res.egg) {
          this.scene.float(r.x, r.y - 20, 'Egg!', '#a7f070');
          this.toast(`Under the rock: ${anEgg(res.egg)}! ${res.nested ? "It's settled into a nest." : "It's waiting in the Hatchery."}`, 'good');
        } else if (res.coins) {
          this.scene.float(r.x, r.y - 20, `+${res.coins}`);
          this.toast(`Under the rock: ${res.coins} coins somebody buried.`, 'good');
        } else {
          this.toast('Under the rock: just a few woodlice. Move it somewhere new and check back in a few hours.');
        }
      },
      onVisitor: (id) => {
        this.hideQuick();
        const res = this.game.greetVisitor(id);
        if (!res.ok) return res;
        if (res.egg) this.toast(`The wild ${res.name} left you ${anEgg(res.egg)}! ${res.nested ? "It's settled into a nest." : "It's waiting in the Hatchery."}`, 'good');
        else this.toast(`The wild ${res.name} says hi back and leaves you ${res.coins} coins.`, 'good');
        return res;
      },
      onRockMoved: (x, y) => {
        const res = this.game.moveRock(x, y);
        if (!res.ok && res.error !== 'The rock barely moved.') this.toast(res.error, 'bad');
      },
      onDecorMoved: (id, x, y) => this.result(this.game.moveDecor(id, x, y)),
      onDecorTap: (id) => this.decorTap(id),
      onZap: () => this.game.batteryZap().ok,
      onPulse: () => this.game.pulseBattery().ok,
      onBoat: () => {
        const res = this.game.catchBoat();
        if (res.ok) this.toast(`You fish the paper boat out of the river. ${anEgg(res.egg)} was tucked inside! ${res.nested ? "It's settled into a nest." : "It's waiting in the Hatchery."}`, 'good', 4500);
        return res;
      },
      onBird: (scared) => {
        const res = this.game.shooBird(scared);
        if (!res.ok) return res;
        const total = res.coins.reduce((a, b) => a + b, 0);
        this.toast(total ? `You shoo the bird off the log. The bugs it scared thank you with ${total} coins!` : 'You shoo the bird off the log.', total ? 'good' : 'info');
        return res;
      },
      // How far the HUD reaches down over the garden, in canvas pixels.
      topInset: () => {
        const hud = this.el.hud.getBoundingClientRect();
        const canvas = this.scene.canvas.getBoundingClientRect();
        return Math.max(0, hud.bottom - canvas.top) * (window.devicePixelRatio || 1);
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
    document.addEventListener('change', async (e) => {
      if (e.target.id !== 'save-file' || !e.target.files?.[0]) return;
      const file = e.target.files[0];
      e.target.value = '';
      this.restore(await file.text().catch(() => ''));
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
      delete flags.rebalanced;
      this.game.commit();
      this.openModal(() => V.migratedModal(this.v, flags.migratedFromV1.refund), { static: true });
    } else if (!flags.welcomed) {
      this.openModal(() => V.welcomeModal(this.v), { static: true, locked: true });
    } else if (flags.rebalanced) {
      delete flags.rebalanced;
      this.game.commit();
      this.openModal(() => V.rebalancedModal(this.v), { static: true });
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
    this.afterClose = null;
    this.editor = null;
    this.pending = null;
    this.el.modalRoot.innerHTML = '';
    this.el.app.classList.remove('has-modal');
  }

  // ---------- Sprite Studio ----------

  attachStudio(studio) {
    this.studio = studio;
    // Approved fixes from last time show straight away, before the studio connects.
    try {
      const cached = JSON.parse(localStorage.getItem(LIVE_SPRITES_KEY) || '{}');
      this.applyLiveSprites(Object.fromEntries(Object.entries(cached).map(([id, rows]) => [id, cleanRows(rows, this.A.palette)]).filter(([id, rows]) => rows && SPECIES[id])));
    } catch { /* no saved fixes */ }
    studio.on((what) => {
      if (what === 'live') {
        const map = Object.fromEntries(Object.entries(studio.live.sprites).map(([id, fix]) => [id, fix.rows]));
        try { localStorage.setItem(LIVE_SPRITES_KEY, JSON.stringify(map)); } catch { /* fine */ }
        this.applyLiveSprites(map);
        this.checkEditorBase();
      }
      if (this.ui.panel === 'bugs' && this.ui.bugsTab === 'studio') this.renderPanel();
    });
  }

  applyLiveSprites(map) {
    if (!this.A.setOverrides(map).length) return;
    for (const img of this.el?.nav?.querySelectorAll('img') || []) if (img.src.startsWith('data:') && img.closest('[data-panel="bugs"]')) img.src = this.A.bugUrl('ladybug');
    this.render?.();
  }

  openEditor(ed) {
    if (!this.studio?.available) return this.toast('The studio only works in the shared game on claude.ai.', 'bad');
    // Locked: only Cancel (which asks first) can close it, so a drawing is never lost by accident.
    this.openModal(() => V.editorModal(this.v, ed), { static: true, locked: true, cls: 'editor' });
    const root = this.el.modalRoot;
    const canvas = root.querySelector('#ed-canvas');
    const preview = root.querySelector('#ed-preview');
    const state = { ed, dirty: false };
    let queued = false;
    const refresh = () => {
      queued = false;
      const rows = state.editor.rows();
      const art = this.A.paint(rows);
      const view = ed.kind === 'fix' ? SPECIES[ed.species].view : root.querySelector('#ed-view')?.value || 'top';
      const looks = [['Normal', art], ['Shiny', this.A.shiny(art)], ['Golden', this.A.golden(art)], ['Albino', this.A.albino(art, view)]];
      preview.innerHTML = `<div class="pv-cell"><img class="px pv-1" alt=""><small>Actual size</small></div>${looks.map(([label]) => `<div class="pv-cell"><img class="px pv-3" alt=""><small>${label}</small></div>`).join('')}`;
      const imgs = preview.querySelectorAll('img');
      imgs[0].src = art.toDataURL();
      looks.forEach(([, c], i) => { imgs[i + 1].src = c.toDataURL(); });
      for (const b of root.querySelectorAll('[data-ed="tool"]')) b.classList.toggle('on', b.dataset.tool === state.editor.tool);
      for (const b of root.querySelectorAll('[data-ed="color"]')) b.classList.toggle('on', b.dataset.c === state.editor.color);
      root.querySelector('[data-ed="mirror"]')?.classList.toggle('on', state.editor.mirror);
    };
    const changed = (what) => {
      if (what !== 'tool') state.dirty = true;
      if (!queued) { queued = true; requestAnimationFrame(refresh); }
    };
    state.editor = new SpriteEditor(canvas, this.A.palette, ed.rows, changed);
    root.querySelector('.ed-tools').addEventListener('click', (e) => this.editorTool(e, state, changed));
    root.querySelector('.ed-palette').addEventListener('click', (e) => this.editorTool(e, state, changed));
    root.querySelector('#ed-view')?.addEventListener('change', () => changed('tool'));
    root.querySelector('#ed-warn')?.addEventListener('click', (e) => this.editorTool(e, state, changed));
    this.editor = state;
    refresh();
  }

  editorTool(e, state, changed) {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    const ed = state.editor;
    switch (b.dataset.ed) {
      case 'tool': ed.tool = b.dataset.tool; break;
      case 'color': ed.color = b.dataset.c; if (ed.tool === 'erase' || ed.tool === 'pick') ed.tool = 'pen'; break;
      case 'mirror': ed.mirror = !ed.mirror; ed.draw(); break;
      case 'undo': ed.undo(); break;
      case 'redo': ed.redo(); break;
      case 'size':
        if (state.dirty && !this.armed(b, 'Tap again: starts blank')) return;
        ed.resizeGrid(ed.n === 16 ? 32 : 16);
        b.textContent = ed.n === 16 ? 'Make it 32×32' : 'Make it 16×16';
        b.classList.remove('armed');
        break;
      case 'clear':
        if (!this.armed(b, 'Tap again to clear')) return;
        ed.clear();
        b.textContent = 'Clear';
        break;
      case 'rebase':
        ed.load(this.A.rowsOf(state.ed.species));
        state.ed.base = this.studio.liveRef(state.ed.species);
        state.ed.original = ed.rows().join('');
        state.dirty = false;
        this.el.modalRoot.querySelector('#ed-warn').hidden = true;
        break;
      default: return;
    }
    changed('tool');
  }

  // Two-tap confirmation for a button inside the editor: the first tap
  // relabels it, a second tap within a few seconds goes ahead.
  armed(el, label) {
    if (!el) return true;
    if (el.classList.contains('armed')) return true;
    const old = el.textContent;
    el.classList.add('armed');
    el.textContent = label;
    setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = old; } }, 3000);
    return false;
  }

  // A fix someone else got approved while you were drawing.
  checkEditorBase() {
    const st = this.editor;
    if (!st || st.ed.kind !== 'fix') return;
    const warn = this.el.modalRoot.querySelector('#ed-warn');
    if (!warn || this.studio.liveRef(st.ed.species) === st.ed.base) return;
    warn.hidden = false;
    warn.innerHTML = `Heads up: another fix for this bug was just approved while you were drawing. You can still submit yours, or <button class="btn link" data-ed="rebase">start again from the new sprite</button>.`;
  }

  async submitEditor() {
    const st = this.editor;
    if (!st) return;
    const root = this.el.modalRoot;
    const val = (sel) => root.querySelector(sel)?.value || '';
    const { ed } = st;
    const rows = st.editor.rows();
    if (ed.kind === 'fix' && rows.join('') === ed.original) return this.toast('Change something first: this is the same as the current sprite.', 'bad');
    const raw = ed.kind === 'fix'
      ? { kind: 'fix', species: ed.species, base: ed.base, rows, note: val('#ed-note') }
      : {
        kind: 'idea', rows, from: ed.from, name: val('#ed-name'), desc: val('#ed-desc'), family: val('#ed-family'), view: val('#ed-view'),
        rarity: val('#ed-rarity'), habitat: val('#ed-habitat') || null, note: val('#ed-note'),
        traits: [...root.querySelectorAll('[data-trait]:checked')].map((c) => c.dataset.trait),
      };
    if (raw.kind === 'idea' && raw.traits.length > 4) return this.toast('Pick up to 4 traits.', 'bad');
    const btnEl = root.querySelector('[data-act="ed-submit"]');
    if (btnEl) btnEl.disabled = true;
    const res = await this.studio.submit(raw, ed.key || null);
    if (btnEl) btnEl.disabled = false;
    if (!res.ok) return this.toast(res.error, 'bad');
    this.closeModal();
    this.ui.bugsTab = 'studio';
    this.ui.studioFilter = { ...this.ui.studioFilter, status: 'pending', mine: false };
    if (this.ui.panel === 'bugs') this.renderPanel();
    else this.openPanel('bugs');
    this.toast(ed.key ? 'Saved your changes.' : 'Submitted! The owner will take a look.', 'good');
  }

  // Tapping a decoration says what it does; the log also rolls over.
  decorTap(id) {
    this.hideQuick();
    const d = DECOR_BY_ID[id];
    if (id === 'battery') return null; // the scene sends out a pulse
    if (id === 'log') {
      const res = this.game.rollLog();
      this.toast(res.coins ? `You roll the log over. ${res.coins} coins were tucked underneath!` : 'You roll the log over. Just some sleepy grubs this time.', res.coins ? 'good' : '');
      return res;
    }
    const lovers = this.game.state.bugs.filter((b) => b.inGarden && favouriteDecor(this.game.state, b.species)?.id === id).length;
    this.toast(`${d.name}: ${d.desc} ${lovers ? `${lovers} of your garden bug${lovers > 1 ? 's' : ''} love${lovers > 1 ? '' : 's'} it: +${Math.round(d.bonus * 100)}% foraging.` : ''}`);
    return null;
  }

  lastBackup() {
    try { return Number(localStorage.getItem(BACKUP_TIME_KEY)) || 0; } catch { return 0; }
  }

  markBackup() {
    this.ui.lastBackup = Date.now();
    try { localStorage.setItem(BACKUP_TIME_KEY, String(this.ui.lastBackup)); } catch { /* storage unavailable */ }
  }

  // Share sheet first (lets iPhone "Save to Files"), then a plain download.
  async backupFile() {
    const code = this.game.exportSave();
    const name = `bug-garden-backup-${new Date().toISOString().slice(0, 10)}.txt`;
    const file = new File([code], name, { type: 'text/plain' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Bug Garden backup' });
        this.markBackup();
        this.toast('Backup saved. Load it from Settings any time to restore.', 'good');
        this.openModal(() => V.settingsModal(this.v), { static: true });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10e3);
      this.markBackup();
      this.toast(`Backup downloaded as ${name}.`, 'good');
      this.openModal(() => V.settingsModal(this.v), { static: true });
    } catch {
      this.toast("This browser can't save files here. Use Copy save code instead.", 'bad');
    }
  }

  restore(code) {
    if (!code.trim()) return this.toast('Paste a save code or pick a backup file first.', 'bad');
    const s = this.game.state;
    this.ask({ title: 'Restore this backup?', body: `<p>It replaces the game on this device (${s.bugs.length} bugs, ${fmtNum(s.coins)} coins) with the backup.</p>`, yes: 'Restore', danger: true }, () => {
      if (this.result(this.game.importSave(code), 'Backup restored!')) {
        this.closePanel();
        this.closeModal();
      }
    });
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

  // Auto-pick: the four free bugs with the highest combined power, not
  // counting items. Finding good bonus combinations is up to the player.
  autoParty() {
    const st = this.game.state;
    const away = bugsOnExpedition(st);
    const base = (b) => Object.values(b.traits).reduce((s, v) => s + v, 0);
    return st.bugs.filter((b) => !away.has(b.uid)).sort((a, b) => base(b) - base(a)).slice(0, PARTY_SIZE).map((b) => b.uid);
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
      case 'garden-chests': ui.chestResult = null; this.hideQuick(); this.openModal(() => V.gardenChestsModal(this.v)); break;
      case 'open-chest': {
        // Ignore taps while the last opening is still on screen being revealed.
        if (ui.chestBusy) break;
        const res = g.openGardenChest(d.id);
        if (!res.ok) { this.toast(res.error, 'bad'); break; }
        ui.chestResult = res;
        ui.chestBusy = true;
        this.renderModal();
        setTimeout(() => { ui.chestBusy = false; if (this.modal) this.renderModal(); }, 700);
        break;
      }
      case 'buy-decor': {
        const dec = DECOR_BY_ID[d.id];
        this.spendCheck(dec.price, `the ${dec.name}`, () => {
          if (!this.result(g.buyDecor(d.id), `The ${dec.name} is in your garden!${dec.fixed ? '' : ' Drag it wherever you like.'}`)) return;
          if (dec.fixed) this.scene.lookAt(dec.fixed[0] + (dec.size[0] * dec.scale) / 2, dec.fixed[1] + (dec.size[1] * dec.scale) / 2); // show off the river
          this.closePanel();
        });
        break;
      }
      case 'unlock': {
        const area = AREA_BY_ID[d.area];
        this.ask({ title: `Unlock ${area.name}?`, body: `<p>Pay <b>${fmtNum(area.unlock.coins)}</b> coins to open ${area.name} for expeditions.</p>`, yes: 'Unlock' },
          () => this.result(g.unlockArea(d.area), `${area.name} is open!`));
        break;
      }
      case 'plan':
        ui.plan = { areaId: d.area, party: this.autoParty(d.area), count: ui.lastTrip ?? defaultEncounterCount(AREA_BY_ID[d.area]) };
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
      // Equipment panels in the planner: pick a bug, then equip or unequip in place.
      case 'plan-gear': ui.plan.gearFor = ui.plan.gearFor === uid ? null : uid; this.renderModal(); break;
      case 'plan-equip':
        if (this.result(g.equip(uid, d.item), `${bugName(g.bug(uid))} equipped ${ITEMS[d.item].name}.`)) ui.plan.gearFor = null;
        this.renderModal();
        break;
      case 'plan-unequip':
        this.result(g.unequip(uid), 'Item returned to your bag.');
        this.renderModal();
        break;
      case 'plan-count': ui.plan.count = ui.lastTrip = clampEncounterCount(Number(d.n)); this.renderModal(); break;
      case 'plan-auto': ui.plan.party = this.autoParty(ui.plan.areaId); this.renderModal(); break;
      case 'preset-save': {
        const name = document.querySelector('#preset-name')?.value || '';
        if (this.result(g.savePreset(name, ui.plan.party), 'Preset saved.')) this.renderModal();
        break;
      }
      case 'preset-load': {
        const p = st.presets.find((x) => x.id === Number(d.id));
        if (!p) break;
        const away = bugsOnExpedition(st);
        const ready = p.party.filter((u) => g.bug(u) && !away.has(u));
        ui.plan.party = ready;
        const missing = p.party.length - ready.length;
        if (missing) this.toast(`${missing} bug${missing > 1 ? 's' : ''} from "${p.name}" ${missing > 1 ? 'are' : 'is'} away or gone. Fill the gap to launch.`, 'bad');
        this.renderModal();
        break;
      }
      case 'preset-delete': {
        const el = document.querySelector(`[data-act="preset-delete"][data-id="${d.id}"]`);
        if (!this.armed(el, 'Delete?')) break;
        this.result(g.deletePreset(Number(d.id)));
        this.renderModal();
        break;
      }
      case 'syn-guide': {
        // Opens over the planner and returns to it on close.
        const fromPlanner = this.modal && ui.plan;
        this.openModal(() => V.synergyGuideModal(this.v), { static: true });
        if (fromPlanner) this.afterClose = () => this.openModal(() => V.plannerModal(this.v));
        break;
      }
      case 'launch': {
        const area = AREA_BY_ID[ui.plan.areaId];
        const names = ui.plan.party.map((u) => bugName(g.bug(u))).join(', ');
        const plan = { ...ui.plan, party: [...ui.plan.party] };
        const party = plan.party.map((u) => g.bug(u));
        const hour = new Date(g.now()).getHours();
        const sure = guaranteedOnly(partySynergies(party, { hour }).active); // bonuses that might kick in could make it quicker
        const ms = plan.count * encounterMs(st, area, party, { hour, active: sure });
        this.ask({ title: `Send the party to ${area.name}?`, body: `<p>${plan.count} encounters, about <b>${fmtTime(ms)}</b>. ${names} will be away until the expedition ends. Their items can't be changed while they're exploring.</p>`, yes: 'Set off!' }, () => {
          const res = g.launchExpedition(plan.areaId, plan.party, plan.count);
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
      case 'settings': ui.exportCode = ''; ui.lastBackup = this.lastBackup(); this.openModal(() => V.settingsModal(this.v), { static: true }); break;
      case 'export':
        ui.exportCode = g.exportSave();
        this.markBackup();
        this.openModal(() => V.settingsModal(this.v), { static: true });
        document.querySelector('#save-code')?.select();
        navigator.clipboard?.writeText(ui.exportCode).then(() => this.toast('Save code copied. Paste it somewhere safe, like your notes.', 'good'), () => this.toast('Select the code below and copy it somewhere safe.'));
        break;
      case 'backup-file': this.backupFile(); break;
      case 'import': this.restore(document.querySelector('#save-code')?.value || ''); break;
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
      case 'close-modal': {
        const then = this.afterClose;
        this.closeModal();
        then?.();
        break;
      }
      case 'studio-filter':
        if (d.mine) ui.studioFilter = { ...ui.studioFilter, mine: !ui.studioFilter.mine };
        else if (d.status) ui.studioFilter = { ...ui.studioFilter, status: d.status, mine: false };
        else ui.studioFilter = { ...ui.studioFilter, kind: d.kind || null };
        this.renderPanel();
        break;
      case 'studio-pick': this.openModal(() => V.studioPickModal(this.v, d.mode), { static: true }); break;
      case 'ed-fix': {
        const rows = this.A.rowsOf(d.id);
        this.openEditor({ kind: 'fix', species: d.id, rows, original: rows.join(''), base: this.studio.liveRef(d.id), form: {} });
        break;
      }
      case 'ed-idea': {
        const sp = d.id && SPECIES[d.id];
        const n = Number(d.size) || 16;
        const rows = sp ? this.A.rowsOf(d.id) : Array.from({ length: n }, () => '.'.repeat(n));
        this.openEditor({ kind: 'idea', from: sp ? sp.id : null, rows, form: sp ? { family: sp.family, view: sp.view, rarity: sp.rarity, traits: sp.traits.slice(0, 4) } : { family: 'crawler', view: 'top', rarity: 'common', traits: [] } });
        break;
      }
      case 'ed-edit': {
        const s = this.studio.subs.get(d.ref);
        if (!s) break;
        this.openEditor({ kind: s.kind, species: s.species, from: s.from, ref: s.ref, key: s.key, rows: s.rows, original: s.kind === 'fix' ? this.A.rowsOf(s.species).join('') : null, base: s.base, form: { ...s } });
        break;
      }
      case 'ed-cancel':
        // A drawing in progress needs a second tap to throw away.
        if (this.editor?.dirty && !this.armed(document.querySelector('[data-act="ed-cancel"]'), 'Tap again to discard')) break;
        this.closeModal();
        break;
      case 'ed-submit': this.submitEditor(); break;
      case 'studio-like': this.studio.toggleLike(d.ref).then((res) => { if (!res.ok) this.toast(res.error, 'bad'); }); break;
      case 'studio-withdraw':
        this.ask({ title: 'Withdraw this submission?', body: '<p>It will be removed from the studio. Anything already approved stays in the game.</p>', yes: 'Withdraw', danger: true }, async () => {
          const res = await this.studio.withdraw(d.key);
          this.result(res, 'Submission withdrawn.');
        });
        break;
      case 'studio-approve': this.studio.approve(d.ref).then((res) => this.result(res, 'Approved! It is live for everyone.')); break;
      case 'studio-reject': this.openModal(() => V.rejectModal(this.v, d.ref), { static: true }); break;
      case 'studio-reject-yes': {
        const note = document.querySelector('#reject-note')?.value || '';
        this.closeModal();
        this.studio.reject(d.ref, note).then((res) => this.result(res, 'Rejected.'));
        break;
      }
      case 'studio-live': this.studio.setLiveSprite(d.id, d.ref || null).then((res) => this.result(res, d.ref ? 'Switched to that fix.' : `${SPECIES[d.id].name} is back to its original sprite.`)); break;
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
