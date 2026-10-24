import { SPECIES } from '../data/species.js';
import { Rng } from '../core/rng.js';
import { bugsOnExpedition } from '../systems/bugs.js';
import { gardenCap } from '../systems/garden.js';
import { nurseryCapacity } from '../systems/eggs.js';

// World units are pixels of the BugsMap art (150 x 300).
export const WORLD_W = 150;
export const WORLD_H = 300;
// The dirt patch in BugsMap/pixil-layer-1.png is the nursery.
export const NURSERY = { x: 4, y: 166, w: 60, h: 42 };
const EGG_SLOTS = [[22, 184], [40, 180], [52, 192], [32, 197]];
const BOUNDS = { x0: 8, x1: 142, y0: 14, y1: 292 };
const MOVE = { wriggler: 4, crawler: 11, beetle: 8, arachnid: 13, hopper: 9, flyer: 16 };

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function timeOfDay(ts) {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 20.5 || h < 5.5) return 'night';
  if (h >= 18.5) return 'dusk';
  if (h < 7) return 'dawn';
  return 'day';
}

export class GardenScene {
  constructor(canvas, game, assets, handlers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.assets = assets;
    this.handlers = handlers;
    this.entities = new Map();
    this.visitor = null;
    this.floaters = [];
    this.fireflies = Array.from({ length: 10 }, () => ({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), p: rand(0, 6.28) }));
    const coinRng = new Rng(7);
    this.coinSpots = Array.from({ length: 10 }, () => [coinRng.int(20, 130), coinRng.int(40, 270)]);
    this.camY = null;
    this.t = 0;
    this.last = performance.now();
    this.drag = null;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  start() {
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!document.hidden) {
        this.update(dt);
        this.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(parent.clientWidth * dpr));
    const ch = Math.max(1, Math.round(parent.clientHeight * dpr));
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.dpr = dpr;
    // Whole device pixels per art pixel keeps the pixel art crisp.
    this.scale = Math.max(1, Math.ceil(Math.max(cw / WORLD_W, ch / WORLD_H)));
    this.viewW = cw / this.scale;
    this.viewH = ch / this.scale;
    this.camX = (WORLD_W - this.viewW) / 2;
    const maxCam = Math.max(0, WORLD_H - this.viewH);
    if (this.camY === null) this.camY = clamp(NURSERY.y + NURSERY.h / 2 - this.viewH * 0.55, 0, maxCam);
    this.camY = clamp(this.camY, 0, maxCam);
    this.bugPx = Math.max(1, Math.round(this.scale * 0.8));
  }

  toScreen(x, y) {
    return [(x - this.camX) * this.scale, (y - this.camY) * this.scale];
  }

  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return [(clientX - r.left) * this.dpr / this.scale + this.camX, (clientY - r.top) * this.dpr / this.scale + this.camY];
  }

  // ---------- entities ----------

  sync() {
    const st = this.game.state;
    const away = bugsOnExpedition(st);
    const home = st.bugs.filter((b) => !away.has(b.uid));
    const keep = new Set(home.map((b) => b.uid));
    for (const uid of this.entities.keys()) if (!keep.has(uid)) this.entities.delete(uid);
    for (const b of home) {
      let e = this.entities.get(b.uid);
      if (!e) {
        e = this.spawn(b.species);
        e.uid = b.uid;
        this.entities.set(b.uid, e);
      }
      e.species = b.species;
      e.shiny = b.shiny;
      e.glowing = b.traits.includes('glowing') || b.species === 'firefly';
      e.resting = b.restUntil > this.game.now();
    }
    const v = st.garden.visitor;
    if (v && (!this.visitor || this.visitor.species !== v.species)) {
      this.visitor = this.spawn(v.species);
      this.visitor.isVisitor = true;
      this.visitor.shiny = v.shiny;
    } else if (!v) {
      this.visitor = null;
    }
  }

  spawn(species) {
    const fam = SPECIES[species].family;
    const x = rand(BOUNDS.x0, BOUNDS.x1);
    const y = rand(Math.max(BOUNDS.y0, this.camY + 10), Math.min(BOUNDS.y1, this.camY + this.viewH - 10));
    return {
      species, family: fam, x, y, tx: x, ty: y, angle: rand(0, Math.PI * 2), wait: rand(0, 2),
      speed: MOVE[fam] * rand(0.8, 1.2), phase: rand(0, 6.28), bubble: 0, hearts: 0,
    };
  }

  pickTarget(e) {
    const range = e.family === 'flyer' ? 60 : 32;
    e.tx = clamp(e.x + rand(-range, range), BOUNDS.x0, BOUNDS.x1);
    e.ty = clamp(e.y + rand(-range, range), BOUNDS.y0, BOUNDS.y1);
  }

  updateEntity(e, dt) {
    e.phase += dt * (e.family === 'flyer' ? 8 : 12);
    e.bubble = Math.max(0, e.bubble - dt);
    e.hearts = Math.max(0, e.hearts - dt);
    e.moving = false;
    if (e.resting) return;
    if (e.wait > 0) {
      e.wait -= dt;
      if (e.wait <= 0) this.pickTarget(e);
      return;
    }
    const dx = e.tx - e.x;
    const dy = e.ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.6) {
      e.wait = e.family === 'flyer' ? rand(0.2, 1.2) : rand(0.6, 3.5);
      return;
    }
    let sp = e.speed;
    if (e.family === 'hopper') sp *= Math.sin(e.phase * 0.5) > 0.3 ? 3.2 : 0.2;
    const step = Math.min(d, sp * dt);
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
    e.moving = true;
    const want = Math.atan2(dy, dx) + Math.PI / 2;
    let diff = ((want - e.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    e.angle += diff * Math.min(1, dt * 6);
  }

  update(dt) {
    this.t += dt;
    this.sync();
    for (const e of this.entities.values()) this.updateEntity(e, dt);
    if (this.visitor) this.updateEntity(this.visitor, dt);
    for (const f of this.fireflies) {
      f.p += dt;
      f.x = (f.x + Math.cos(f.p * 0.7) * dt * 6 + WORLD_W) % WORLD_W;
      f.y = (f.y + Math.sin(f.p * 0.5) * dt * 6 + WORLD_H) % WORLD_H;
    }
    this.floaters = this.floaters.filter((f) => (f.life -= dt) > 0);
  }

  // ---------- drawing ----------

  draw() {
    const { ctx, scale } = this;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#39b270';
    ctx.fillRect(0, 0, cw, ch);
    const [mx, my] = this.toScreen(0, 0);
    for (const layer of this.assets.map) ctx.drawImage(layer, Math.round(mx), Math.round(my), WORLD_W * scale, WORLD_H * scale);

    this.drawNursery();
    this.drawCoins();

    const all = [...this.entities.values()];
    if (this.visitor) all.push(this.visitor);
    all.sort((a, b) => a.y - b.y);
    for (const e of all) this.drawShadow(e);
    for (const e of all) this.drawBug(e);

    const tod = timeOfDay(this.game.now());
    if (tod !== 'day') {
      ctx.fillStyle = tod === 'night' ? 'rgba(20, 24, 70, 0.42)' : tod === 'dusk' ? 'rgba(180, 70, 60, 0.16)' : 'rgba(255, 180, 120, 0.12)';
      ctx.fillRect(0, 0, cw, ch);
    }
    if (tod === 'night') {
      ctx.globalCompositeOperation = 'lighter';
      for (const e of all) if (e.glowing) this.glow(e.x, e.y, 14, 'rgba(255, 220, 120, 0.35)');
      for (const f of this.fireflies) {
        const a = 0.4 + 0.4 * Math.sin(f.p * 3);
        this.glow(f.x, f.y, 4, `rgba(220, 255, 140, ${a})`);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const e of all) this.drawOverlay(e);
    for (const f of this.floaters) {
      const [sx, sy] = this.toScreen(f.x, f.y - (1.6 - f.life) * 14);
      ctx.globalAlpha = Math.min(1, f.life * 2);
      this.text(f.text, sx, sy, f.color || '#ffcd75', 5);
      ctx.globalAlpha = 1;
    }
  }

  glow(x, y, r, color) {
    const [sx, sy] = this.toScreen(x, y);
    const g = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, r * this.scale);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(sx - r * this.scale, sy - r * this.scale, r * 2 * this.scale, r * 2 * this.scale);
  }

  text(str, sx, sy, color, size = 4) {
    const { ctx } = this;
    ctx.font = `bold ${Math.round(size * this.scale)}px "Jersey 10", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, this.scale * 0.9);
    ctx.strokeStyle = '#1a1c2c';
    ctx.strokeText(str, sx, sy);
    ctx.fillStyle = color;
    ctx.fillText(str, sx, sy);
  }

  bob(e) {
    return e.family === 'flyer' && !e.resting ? 5 + Math.sin(e.phase * 0.6) * 1.5 : 0;
  }

  drawShadow(e) {
    if (e.family !== 'flyer' || e.resting) return;
    const [sx, sy] = this.toScreen(e.x, e.y + 5);
    this.ctx.fillStyle = 'rgba(26, 28, 44, 0.22)';
    this.ctx.beginPath();
    this.ctx.ellipse(sx, sy, 5 * this.scale, 2 * this.scale, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawBug(e) {
    const { ctx } = this;
    const img = this.assets.bug(e.species, e.shiny);
    if (!img) return;
    const size = 16 * this.bugPx;
    const [sx, sy] = this.toScreen(e.x, e.y - this.bob(e));
    const wig = e.moving ? 1 + Math.sin(e.phase) * 0.06 : 1;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    ctx.rotate(e.resting ? 0 : e.angle);
    ctx.scale(wig, 2 - wig);
    if (e.resting) ctx.globalAlpha = 0.85;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  drawOverlay(e) {
    const [sx, sy] = this.toScreen(e.x, e.y - this.bob(e) - 11);
    if (e.resting) {
      const z = (this.t * 0.8 + e.phase) % 1;
      this.text('z', sx + 4 * this.scale, sy - z * 6 * this.scale, '#f4f4f4', 4);
    }
    if (e.isVisitor) {
      const b = Math.sin(this.t * 6) * this.scale;
      this.text('!', sx, sy + b, '#ffcd75', 7);
    }
    if (e.shiny && Math.sin(this.t * 4 + e.phase) > 0.6) this.text('+', sx + 6 * this.scale, sy + 4 * this.scale, '#ffcd75', 4);
    if (e.bubble > 0 && e.label) this.text(e.label, sx, sy - 2 * this.scale, '#f4f4f4', 4.5);
    if (e.hearts > 0) {
      const img = this.assets.sprites.heart;
      const s = 8 * this.scale;
      const [hx, hy] = this.toScreen(e.x + 6, e.y - 14 - (1.2 - e.hearts) * 8);
      this.ctx.globalAlpha = Math.min(1, e.hearts * 2);
      this.ctx.drawImage(img, hx - s / 2, hy - s / 2, s, s);
      this.ctx.globalAlpha = 1;
    }
  }

  eggSlots() {
    const st = this.game.state;
    const eggs = st.eggs.filter((e) => e.startedAt).sort((a, b) => a.startedAt - b.startedAt);
    const cap = nurseryCapacity(st);
    return EGG_SLOTS.slice(0, Math.max(cap, eggs.length)).map(([x, y], i) => ({ x, y, egg: eggs[i] || null }));
  }

  drawNursery() {
    const { ctx } = this;
    for (const slot of this.eggSlots()) {
      const [sx, sy] = this.toScreen(slot.x, slot.y);
      const s = this.scale;
      if (!slot.egg) {
        ctx.strokeStyle = 'rgba(244, 244, 244, 0.45)';
        ctx.setLineDash([s, s]);
        ctx.lineWidth = Math.max(1, s * 0.6);
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const p = this.game.eggProgress(slot.egg);
      const img = this.assets.eggs[slot.egg.type];
      const size = 16 * this.bugPx * 0.75;
      ctx.save();
      ctx.translate(sx, sy);
      if (p.ready) ctx.rotate(Math.sin(this.t * 10) * 0.18 * (Math.sin(this.t * 1.5) > 0 ? 1 : 0.2));
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
      const bw = 12 * s;
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(sx - bw / 2 - s * 0.5, sy + 7 * s, bw + s, 2.5 * s);
      ctx.fillStyle = p.ready ? '#a7f070' : '#ffcd75';
      ctx.fillRect(sx - bw / 2, sy + 7.5 * s, bw * p.fraction, 1.5 * s);
      if (p.ready && Math.sin(this.t * 5) > 0) this.text('!', sx + 6 * s, sy - 6 * s, '#a7f070', 5);
    }
  }

  coinCount() {
    const st = this.game.state;
    const pot = st.garden.pot;
    if (pot < 1) return 0;
    return clamp(Math.ceil((pot / gardenCap(st)) * 10), 1, 10);
  }

  drawCoins() {
    const n = this.coinCount();
    const img = this.assets.sprites.coin;
    for (let i = 0; i < n; i++) {
      const [x, y] = this.coinSpots[i];
      const [sx, sy] = this.toScreen(x, y);
      const w = Math.abs(Math.cos(this.t * 2 + i)) * 0.7 + 0.3;
      const size = 9 * this.scale;
      this.ctx.drawImage(img, sx - (size * w) / 2, sy - size / 2, size * w, size);
    }
  }

  float(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.6 });
  }

  // ---------- input ----------

  onDown(e) {
    this.drag = { x: e.clientY, cam: this.camY, moved: 0, startX: e.clientX, startY: e.clientY };
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  onMove(e) {
    if (!this.drag) return;
    const dy = e.clientY - this.drag.x;
    this.drag.moved = Math.max(this.drag.moved, Math.hypot(e.clientX - this.drag.startX, dy));
    if (this.drag.moved > 6) this.camY = clamp(this.drag.cam - (dy * this.dpr) / this.scale, 0, Math.max(0, WORLD_H - this.viewH));
  }

  onUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved > 8) return;
    this.tap(...this.toWorld(e.clientX, e.clientY));
  }

  tap(x, y) {
    const near = (ex, ey, r) => Math.hypot(ex - x, ey - y) <= r;
    if (this.visitor && near(this.visitor.x, this.visitor.y - this.bob(this.visitor), 12)) return this.handlers.onVisitor();
    const n = this.coinCount();
    for (let i = 0; i < n; i++) {
      if (near(this.coinSpots[i][0], this.coinSpots[i][1], 8)) {
        const res = this.handlers.onCoins();
        if (res?.coins) this.float(x, y, `+${res.coins}`);
        return null;
      }
    }
    for (const slot of this.eggSlots()) if (near(slot.x, slot.y, 9)) return this.handlers.onEgg(slot.egg);
    let best = null;
    for (const e of this.entities.values()) {
      const d = Math.hypot(e.x - x, e.y - this.bob(e) - y);
      if (d < 11 && (!best || d < best.d)) best = { e, d };
    }
    if (best) {
      const e = best.e;
      e.hearts = 1.2;
      e.bubble = 2;
      e.label = this.handlers.labelFor(e.uid);
      e.wait = 1.5;
      return this.handlers.onBug(e.uid);
    }
    if (x >= NURSERY.x && x <= NURSERY.x + NURSERY.w && y >= NURSERY.y && y <= NURSERY.y + NURSERY.h) return this.handlers.onEgg(null);
    return null;
  }
}
