import { SPECIES } from '../data/species.js';
import { EGG_BY_ID } from '../data/eggs.js';
import { GARDEN_FORAGE } from '../data/balance.js';
import { Rng } from '../core/rng.js';
import { bugsOnExpedition, effectiveTraits } from '../systems/bugs.js';
import { incubatorCount } from '../systems/eggs.js';
import { dirtPatches } from '../systems/garden.js';
import { fmtTime } from './format.js';

// World units are pixels of the BugsMap art (150 x 300).
export const WORLD_W = 150;
export const WORLD_H = 300;
const BOUNDS = { x0: 8, x1: 142, y0: 14, y1: 292 };
const MOVE = { wriggler: 4, crawler: 11, beetle: 8, arachnid: 13, hopper: 9, flyer: 16 };
const PERSONAL_SPACE = 11;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
    this.floaters = [];
    this.particles = [];
    this.fireflies = Array.from({ length: 10 }, () => ({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), p: rand(0, 6.28) }));
    const coinRng = new Rng(7);
    this.coinSpots = Array.from({ length: 10 }, () => [coinRng.int(20, 130), coinRng.int(40, 250)]);
    this.flowers = assets.flowerSpots.filter((f) => f.x > BOUNDS.x0 && f.x < BOUNDS.x1 && f.y > BOUNDS.y0 && f.y < BOUNDS.y1);
    this.camY = null;
    this.t = 0;
    this.last = performance.now();
    this.drag = null;
    this.rockDrag = null;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.drag = null; this.rockDrag = null; });
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  start() {
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!document.hidden && this.canvas.offsetParent !== null) {
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
    if (this.camY === null) this.camY = clamp(this.game.state.garden.rock.y - this.viewH * 0.45, 0, maxCam);
    this.camY = clamp(this.camY, 0, maxCam);
    this.bugPx = Math.max(1, Math.round(this.scale * 0.8));
  }

  toScreen(x, y) {
    return [(x - this.camX) * this.scale, (y - this.camY) * this.scale];
  }

  toWorld(clientX, clientY) {
    const [sx, sy] = this.toCanvas(clientX, clientY);
    return [sx / this.scale + this.camX, sy / this.scale + this.camY];
  }

  toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return [(clientX - r.left) * this.dpr, (clientY - r.top) * this.dpr];
  }

  rock() {
    return this.rockDrag ? { x: this.rockDrag.x, y: this.rockDrag.y } : this.game.state.garden.rock;
  }

  // ---------- bugs ----------

  sync() {
    const st = this.game.state;
    const away = bugsOnExpedition(st);
    const home = st.bugs.filter((b) => b.inGarden && !away.has(b.uid));
    const keep = new Set(home.map((b) => b.uid));
    for (const uid of this.entities.keys()) if (!keep.has(uid)) this.entities.delete(uid);
    for (const b of home) {
      let e = this.entities.get(b.uid);
      if (!e) {
        e = this.spawn(b.species);
        e.uid = b.uid;
        this.entities.set(b.uid, e);
      }
      const sp = SPECIES[b.species];
      e.species = b.species;
      e.variant = b.variant;
      e.aura = sp.aura;
      e.digger = (effectiveTraits(b).dig || 0) > 0;
      e.glowing = sp.base === 'firefly' || sp.base === 'luna_moth' || !!sp.aura;
    }
  }

  spawn(species) {
    const sp = SPECIES[species];
    const fam = sp.family;
    const side = sp.view === 'side';
    const x = rand(BOUNDS.x0, BOUNDS.x1);
    const y = rand(Math.max(BOUNDS.y0, this.camY + 10), Math.min(BOUNDS.y1, this.camY + this.viewH - 30));
    const e = {
      species, family: fam, side, likesRock: sp.likesRock, flip: Math.random() < 0.5 ? -1 : 1,
      x, y, tx: x, ty: y, angle: side ? 0 : rand(0, Math.PI * 2), wait: rand(0, 2),
      speed: MOVE[fam] * rand(0.8, 1.2), phase: rand(0, 6.28), act: null, actTime: 0, bubble: 0, hearts: 0, surprised: 0,
    };
    // Shade-lovers often start the day tucked under the rock.
    if (e.likesRock && Math.random() < 0.5) this.hide(e, rand(20, 90));
    return e;
  }

  hide(e, seconds) {
    const r = this.game.state.garden.rock;
    e.hidden = seconds;
    e.x = r.x + rand(-12, 12);
    e.y = r.y + rand(-6, 4);
    e.act = null;
  }

  // Lifting the rock uncovers anyone hiding underneath.
  reveal() {
    const found = [];
    for (const e of this.entities.values()) {
      if (!e.hidden) continue;
      e.hidden = 0;
      e.surprised = 2.5;
      e.hearts = 1.6;
      e.wait = rand(2.5, 4);
      e.actTime = 0;
      found.push(e.uid);
    }
    return found;
  }

  // Picks the next thing to do: wander, visit a flower, dig, or hide under the rock.
  pickTarget(e) {
    e.act = null;
    const roll = Math.random();
    if (e.likesRock && !this.rockDrag && roll < 0.3) {
      const r = this.game.state.garden.rock;
      e.tx = r.x;
      e.ty = r.y;
      e.act = 'hide';
    } else if (roll < 0.5 && this.flowers.length) {
      const f = this.flowers[Math.floor(Math.random() * this.flowers.length)];
      e.tx = f.x + rand(-2, 2);
      e.ty = f.y + 4;
      e.act = 'sniff';
    } else if (roll < 0.6 && e.digger) {
      // Diggers work the edge of a dirt patch (the rock covers the middle).
      const patches = dirtPatches(this.game.state.garden, this.game.now()).filter((p) => p.alpha > 0.3);
      const p = patches[Math.floor(Math.random() * patches.length)] || this.game.state.garden.rock;
      const a = rand(0, Math.PI * 2);
      e.tx = clamp(p.x + Math.cos(a) * rand(18, 28), BOUNDS.x0, BOUNDS.x1);
      e.ty = clamp(p.y + Math.sin(a) * rand(12, 18), BOUNDS.y0, BOUNDS.y1);
      e.act = 'dig';
    } else {
      const range = e.family === 'flyer' ? 60 : 32;
      e.tx = clamp(e.x + rand(-range, range), BOUNDS.x0, BOUNDS.x1);
      e.ty = clamp(e.y + rand(-range, range) * (e.side ? 0.4 : 1), BOUNDS.y0, BOUNDS.y1);
    }
  }

  updateEntity(e, dt, others) {
    e.phase += dt * (e.family === 'flyer' ? 8 : 12);
    e.bubble = Math.max(0, e.bubble - dt);
    e.hearts = Math.max(0, e.hearts - dt);
    e.surprised = Math.max(0, e.surprised - dt);
    e.squish = Math.max(0, (e.squish || 0) - dt);
    e.slow = Math.max(0, (e.slow || 0) - dt);
    e.moving = false;
    if (e.hidden) {
      e.hidden = Math.max(0, e.hidden - dt);
      if (!e.hidden) {
        // Crawl back out beside the rock.
        const r = this.game.state.garden.rock;
        const a = rand(0, Math.PI * 2);
        const rs = this.rockSize();
        e.x = clamp(r.x + Math.cos(a) * (rs.w / 2 + 6), BOUNDS.x0, BOUNDS.x1);
        e.y = clamp(r.y + Math.sin(a) * (rs.h / 2 + 4), BOUNDS.y0, BOUNDS.y1);
        e.wait = rand(0.5, 2);
      }
      return;
    }
    for (const o of others) {
      if (o === e || o.hidden) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < PERSONAL_SPACE) {
        const push = ((PERSONAL_SPACE - d) / PERSONAL_SPACE) * 14 * dt;
        e.x = clamp(e.x + (dx / d) * push, BOUNDS.x0, BOUNDS.x1);
        e.y = clamp(e.y + (dy / d) * push, BOUNDS.y0, BOUNDS.y1);
      }
    }
    if (e.actTime > 0) {
      e.actTime -= dt;
      if (Math.random() < dt * 6) this.puff(e);
      if (e.actTime <= 0) e.wait = rand(0.3, 1);
      return;
    }
    if (e.wait > 0) {
      e.wait -= dt;
      // Look around while idle: top-down bugs turn, side views about-face.
      if (e.side) {
        if (Math.random() < dt * 0.15) e.flip = -e.flip;
        e.angle *= 1 - Math.min(1, dt * 4);
      } else {
        if (Math.random() < dt * 0.6) e.turn = rand(-1.2, 1.2);
        if (e.turn) { e.angle += e.turn * dt * 2; e.turn *= 0.96; }
      }
      if (e.wait <= 0) this.pickTarget(e);
      return;
    }
    if (e.act === 'hide') {
      const r = this.rock();
      e.tx = r.x;
      e.ty = r.y;
    }
    const dx = e.tx - e.x;
    const dy = e.ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < (e.act === 'hide' ? 10 : 0.8)) {
      if (e.act === 'hide' && !this.rockDrag) this.hide(e, rand(25, 120));
      else if (e.act === 'sniff' || e.act === 'dig') e.actTime = rand(1.5, 3);
      else e.wait = e.family === 'flyer' ? rand(0.2, 1.2) : rand(0.6, 3.5);
      return;
    }
    let sp = e.speed * (e.slow > 0 ? 0.35 : 1); // a squished bug limps for a bit
    if (e.family === 'hopper') sp *= Math.sin(e.phase * 0.5) > 0.3 ? 3.2 : 0.2;
    const step = Math.min(d, sp * dt);
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
    e.moving = true;
    if (e.side) {
      if (Math.abs(dx) > 0.3) e.flip = dx < 0 ? -1 : 1;
      const tilt = clamp(Math.atan2(dy, Math.abs(dx)), -0.5, 0.5);
      e.angle += (tilt - e.angle) * Math.min(1, dt * 6);
      return;
    }
    const want = Math.atan2(dy, dx) + Math.PI / 2;
    const diff = ((want - e.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    e.angle += diff * Math.min(1, dt * 6);
  }

  puff(e) {
    const dig = e.act === 'dig';
    this.particles.push({ x: e.x + rand(-4, 4), y: e.y + rand(-2, 4), vx: rand(-6, 6), vy: dig ? rand(-14, -6) : rand(-8, -3), life: 0.8, color: dig ? '#7a4a2a' : '#ffcd75' });
  }

  update(dt) {
    this.t += dt;
    this.sync();
    const list = [...this.entities.values()];
    for (const e of list) this.updateEntity(e, dt, list);
    for (const f of this.fireflies) {
      f.p += dt;
      f.x = (f.x + Math.cos(f.p * 0.7) * dt * 6 + WORLD_W) % WORLD_W;
      f.y = (f.y + Math.sin(f.p * 0.5) * dt * 6 + WORLD_H) % WORLD_H;
    }
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-80);
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
    // Only the base layer: the map's brown patch layer is drawn under the rock.
    if (this.assets.map[0]) ctx.drawImage(this.assets.map[0], Math.round(mx), Math.round(my), WORLD_W * scale, WORLD_H * scale);

    this.drawPatches();
    this.drawCoins();
    const all = [...this.entities.values()].filter((e) => !e.hidden).sort((a, b) => a.y - b.y);
    for (const e of all) this.drawShadow(e);
    for (const e of all) if (e.aura) this.glow(e.x, e.y - this.bob(e), 11 + Math.sin(this.t * 3 + e.phase) * 2, hexA(e.aura, 0.55));
    for (const e of all) if (e.variant === 'shiny') this.glow(e.x, e.y - this.bob(e), 12 + Math.sin(this.t * 2 + e.phase), 'rgba(220, 245, 255, 0.55)');
    for (const e of all) this.drawBug(e);
    this.drawRock();
    for (const p of this.particles) {
      const [sx, sy] = this.toScreen(p.x, p.y);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx, sy, scale, scale);
    }
    ctx.globalAlpha = 1;

    const tod = timeOfDay(this.game.now());
    if (tod !== 'day') {
      ctx.fillStyle = tod === 'night' ? 'rgba(20, 24, 70, 0.4)' : tod === 'dusk' ? 'rgba(180, 70, 60, 0.15)' : 'rgba(255, 180, 120, 0.12)';
      ctx.fillRect(0, 0, cw, ch);
    }
    if (tod === 'night') {
      ctx.globalCompositeOperation = 'lighter';
      for (const e of all) if (e.glowing) this.glow(e.x, e.y, 14, 'rgba(255, 220, 120, 0.35)');
      for (const f of this.fireflies) this.glow(f.x, f.y, 4, `rgba(220, 255, 140, ${0.4 + 0.4 * Math.sin(f.p * 3)})`);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const e of all) this.drawOverlay(e);
    for (const f of this.floaters) {
      const [sx, sy] = this.toScreen(f.x, f.y - (1.6 - f.life) * 14);
      ctx.globalAlpha = Math.min(1, f.life * 2);
      this.text(f.text, sx, sy, f.color || '#ffcd75', 6);
      ctx.globalAlpha = 1;
    }
    this.drawNests();
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
    ctx.font = `${Math.round(size * this.scale)}px "Jersey 10", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, this.scale * 0.9);
    ctx.strokeStyle = '#1a1c2c';
    ctx.strokeText(str, sx, sy);
    ctx.fillStyle = color;
    ctx.fillText(str, sx, sy);
  }

  // A tiny four-point pixel sparkle.
  sparkle(sx, sy, size, color) {
    const { ctx } = this;
    const p = Math.max(1, Math.round(size));
    ctx.fillStyle = color;
    ctx.fillRect(sx - p / 2, sy - p * 1.5, p, p * 3);
    ctx.fillRect(sx - p * 1.5, sy - p / 2, p * 3, p);
  }

  bob(e) {
    return e.family === 'flyer' ? 5 + Math.sin(e.phase * 0.6) * 1.5 - (e.actTime > 0 ? 4 : 0) : 0;
  }

  drawShadow(e) {
    if (e.family !== 'flyer') return;
    const [sx, sy] = this.toScreen(e.x, e.y + 5);
    this.ctx.fillStyle = 'rgba(26, 28, 44, 0.22)';
    this.ctx.beginPath();
    this.ctx.ellipse(sx, sy, 5 * this.scale, 2 * this.scale, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawBug(e) {
    const { ctx } = this;
    const img = this.assets.bug(e.species, e.variant);
    const size = 16 * this.bugPx;
    const [sx, sy] = this.toScreen(e.x, e.y - this.bob(e));
    const wig = e.moving || e.actTime > 0 ? 1 + Math.sin(e.phase * (e.act === 'dig' ? 2 : 1)) * 0.06 : 1;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    if (e.side) ctx.scale(e.flip, 1);
    ctx.rotate(e.angle);
    // Squished flat by the rock, then springing back into shape.
    const flat = e.squish > 1.6 ? 1 : (e.squish || 0) / 1.6;
    ctx.scale(wig * (1 + 0.35 * flat), (2 - wig) * (1 - 0.55 * flat));
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  drawOverlay(e) {
    const [sx, sy] = this.toScreen(e.x, e.y - this.bob(e) - 11);
    if (e.variant === 'golden') {
      for (let k = 0; k < 3; k++) {
        const ph = this.t * 2.5 + e.phase + k * 2.1;
        const a = Math.sin(ph);
        if (a <= 0.3) continue;
        const ox = Math.sin(k * 7.3 + Math.floor(ph / 6.283) * 1.7) * 6;
        const oy = Math.cos(k * 3.1 + Math.floor(ph / 6.283) * 2.3) * 6 + 11;
        const [px, py] = this.toScreen(e.x + ox, e.y - this.bob(e) - 11 + oy);
        this.ctx.globalAlpha = a;
        this.sparkle(px, py, this.scale * 0.8, '#fff3b8');
        this.ctx.globalAlpha = 1;
      }
    }
    if (e.surprised > 0) this.text('!', sx, sy - 2 * this.scale + Math.sin(this.t * 12) * this.scale, '#ffcd75', 7);
    if (e.bubble > 0 && e.label) this.text(e.label, sx, sy - 2 * this.scale, e.labelColor || '#f4f4f4', 6);
    if (e.hearts > 0) {
      const s = 8 * this.scale;
      const [hx, hy] = this.toScreen(e.x + 6, e.y - 14 - (1.6 - e.hearts) * 8);
      this.ctx.globalAlpha = Math.min(1, e.hearts * 2);
      this.ctx.drawImage(this.assets.sprites.heart, hx - s / 2, hy - s / 2, s, s);
      this.ctx.globalAlpha = 1;
    }
  }

  // The dirt patch art from BugsMap/pixil-layer-1.png, centred on each patch.
  drawPatches() {
    const { ctx, scale } = this;
    const art = this.assets.patch;
    for (const p of dirtPatches(this.game.state.garden, this.game.now())) {
      if (p.alpha <= 0.01) continue;
      const [sx, sy] = this.toScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (art) {
        ctx.drawImage(art, Math.round(sx - (art.width * scale) / 2), Math.round(sy - (art.height * scale) / 2), art.width * scale, art.height * scale);
      } else {
        ctx.fillStyle = '#6b4a2b';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 30 * scale, 21 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // The rock is drawn at map resolution and sits on its patch, slightly
  // raised; lifted while being dragged.
  drawRock() {
    const { ctx, scale } = this;
    const r = this.rock();
    const art = this.assets.rock;
    const size = this.rockSize();
    const lifted = this.rockDrag ? 6 : 0;
    const [sx, sy] = this.toScreen(r.x, r.y);
    if (lifted) {
      ctx.fillStyle = 'rgba(26, 28, 44, 0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * scale, (size.w / 2) * scale, (size.h / 3) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Whole device pixels per rock pixel keeps the finer pixels crisp.
    const px = Math.max(1, Math.round(scale * this.assets.rockScale));
    const dw = art.width * px;
    const dh = art.height * px;
    ctx.drawImage(art, Math.round(sx - dw / 2), Math.round(sy - (size.h * 0.62 + lifted) * scale), dw, dh);
  }

  // The rock's size in map pixels.
  rockSize() {
    const art = this.assets.rock;
    return { w: art.width * this.assets.rockScale, h: art.height * this.assets.rockScale };
  }

  // Whether a world point is on the rock (at its saved spot, or at r).
  onRock(wx, wy, r = this.game.state.garden.rock) {
    const art = this.rockSize();
    const dx = (wx - r.x) / (art.w / 2);
    const dy = (wy - (r.y - art.h * 0.12)) / (art.h / 2);
    return dx * dx + dy * dy <= 1.1;
  }

  // Cosmetic only: bugs caught under a dropped rock get squashed, complain,
  // pop out from under it and move slowly for a few seconds.
  squishUnder(x, y) {
    const art = this.rockSize();
    for (const e of this.entities.values()) {
      if (e.hidden || !this.onRock(e.x, e.y - this.bob(e), { x, y })) continue;
      e.squish = 2.4;
      e.slow = 6;
      e.label = Math.random() < 0.5 ? 'Ouch!' : 'Ow\u2026';
      e.bubble = 1.8;
      e.labelColor = '#ef7d57';
      e.act = null;
      e.actTime = 0;
      e.wait = 1.2;
      const a = Math.atan2(e.y - y, e.x - x) || rand(0, Math.PI * 2);
      e.x = clamp(x + Math.cos(a) * (art.w / 2 + 8), BOUNDS.x0, BOUNDS.x1);
      e.y = clamp(y - art.h * 0.12 + Math.sin(a) * (art.h / 2 + 9), BOUNDS.y0, BOUNDS.y1);
    }
  }

  // ---------- nests (screen space, along the bottom) ----------

  nestLayout() {
    const st = this.game.state;
    const eggs = st.eggs.filter((e) => e.startedAt).sort((a, b) => a.startedAt - b.startedAt);
    const n = Math.max(incubatorCount(st), eggs.length);
    const px = Math.max(2, Math.round(this.scale * 1.1));
    const size = 16 * px;
    const cw = this.canvas.width;
    const gap = cw / n;
    const cy = this.canvas.height - size * 0.45;
    return Array.from({ length: n }, (_, i) => ({ x: gap * (i + 0.5), y: cy, size, px, egg: eggs[i] || null }));
  }

  drawNests() {
    const { ctx } = this;
    const now = this.game.now();
    for (const n of this.nestLayout()) {
      const left = n.x - n.size / 2;
      const top = n.y - n.size / 2;
      ctx.drawImage(this.assets.sprites.nest, left, top, n.size, n.size);
      if (n.egg) {
        const p = this.game.eggProgress(n.egg);
        const v = EGG_BY_ID[n.egg.tier].visual;
        const eggSize = n.size * 0.95;
        const ex = n.x;
        const ey = top + n.size * 0.36;
        if (v.glow) {
          const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, eggSize * 0.7);
          g.addColorStop(0, v.glow);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(ex - eggSize, ey - eggSize, eggSize * 2, eggSize * 2);
        }
        ctx.save();
        ctx.translate(ex, ey + eggSize * 0.3);
        if (p.ready) ctx.rotate(Math.sin(this.t * 10) * 0.15 * (Math.sin(this.t * 1.5) > 0 ? 1 : 0.2));
        ctx.drawImage(this.assets.eggs[n.egg.tier][0], -eggSize / 2, -eggSize * 0.8, eggSize, eggSize);
        ctx.restore();
        ctx.drawImage(this.assets.sprites.nest_front, left, top, n.size, n.size);
        if (v.sparkles && Math.sin(this.t * 3 + n.x) > 0.6) this.sparkle(ex + eggSize * 0.3, ey - eggSize * 0.35, n.px, '#ffffff');
        const label = p.ready ? 'Hatch!' : fmtTime(p.remainingMs);
        const ly = top + n.size * 0.2 - eggSize * 0.25;
        ctx.font = `${Math.round(n.px * 5.5)}px "Jersey 10", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, n.px);
        ctx.strokeStyle = '#1a1c2c';
        ctx.strokeText(label, n.x, ly);
        ctx.fillStyle = p.ready ? '#a7f070' : '#f4f4f4';
        ctx.fillText(label, n.x, ly);
      } else {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(this.assets.sprites.nest_front, left, top, n.size, n.size);
        ctx.globalAlpha = 1;
      }
    }
  }

  coinCount() {
    const pot = this.game.state.garden.pot;
    return pot < 1 ? 0 : clamp(Math.ceil((pot / GARDEN_FORAGE.cap) * 10), 1, 10);
  }

  drawCoins() {
    for (let i = 0; i < this.coinCount(); i++) {
      const [sx, sy] = this.toScreen(...this.coinSpots[i]);
      const w = Math.abs(Math.cos(this.t * 2 + i)) * 0.7 + 0.3;
      const size = 9 * this.scale;
      this.ctx.drawImage(this.assets.sprites.coin, sx - (size * w) / 2, sy - size / 2, size * w, size);
    }
  }

  float(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.6 });
  }

  // ---------- input ----------

  onDown(e) {
    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    const [cx, cy] = this.toCanvas(e.clientX, e.clientY);
    this.canvas.setPointerCapture?.(e.pointerId);
    const onNest = this.nestLayout().some((n) => Math.abs(cx - n.x) < n.size / 2 && Math.abs(cy - n.y) < n.size / 2);
    const r = this.game.state.garden.rock;
    if (!onNest && this.onRock(wx, wy)) {
      this.rockDrag = { x: r.x, y: r.y, grabX: wx - r.x, grabY: wy - r.y, moved: 0, startX: e.clientX, startY: e.clientY };
      const found = this.reveal();
      this.handlers.onRockLift?.(found);
      return;
    }
    this.drag = { y: e.clientY, cam: this.camY, moved: 0, x: e.clientX };
  }

  onMove(e) {
    if (this.rockDrag) {
      const [wx, wy] = this.toWorld(e.clientX, e.clientY);
      const d = this.rockDrag;
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.startX, e.clientY - d.startY));
      d.x = clamp(wx - d.grabX, 26, 124);
      d.y = clamp(wy - d.grabY, 30, 280);
      return;
    }
    if (!this.drag) return;
    const dy = e.clientY - this.drag.y;
    this.drag.moved = Math.max(this.drag.moved, Math.hypot(e.clientX - this.drag.x, dy));
    if (this.drag.moved > 6) this.camY = clamp(this.drag.cam - (dy * this.dpr) / this.scale, 0, Math.max(0, WORLD_H - this.viewH));
  }

  onUp(e) {
    if (this.rockDrag) {
      const d = this.rockDrag;
      this.rockDrag = null;
      if (d.moved > 6) {
        this.squishUnder(d.x, d.y);
        this.handlers.onRockMoved?.(d.x, d.y);
      }
      return;
    }
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved > 8) return;
    const [cx, cy] = this.toCanvas(e.clientX, e.clientY);
    for (const n of this.nestLayout()) {
      if (Math.abs(cx - n.x) < n.size / 2 && Math.abs(cy - n.y) < n.size / 2) return this.handlers.onEgg(n.egg);
    }
    this.tap(...this.toWorld(e.clientX, e.clientY));
  }

  tap(x, y) {
    const near = (ex, ey, r) => Math.hypot(ex - x, ey - y) <= r;
    for (let i = 0; i < this.coinCount(); i++) {
      if (near(this.coinSpots[i][0], this.coinSpots[i][1], 8)) {
        const res = this.handlers.onCoins();
        if (res?.coins) this.float(x, y, `+${res.coins}`);
        return;
      }
    }
    let best = null;
    for (const e of this.entities.values()) {
      if (e.hidden) continue;
      const d = Math.hypot(e.x - x, e.y - this.bob(e) - y);
      if (d < 11 && (!best || d < best.d)) best = { e, d };
    }
    if (best) {
      const e = best.e;
      e.hearts = 1.2;
      e.wait = 2;
      e.actTime = 0;
      return this.handlers.onBug(e.uid);
    }
    this.handlers.onEmpty?.();
  }
}

function hexA(hex, a) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
