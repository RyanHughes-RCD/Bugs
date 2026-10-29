import { SPECIES } from '../data/species.js';
import { EGG_BY_ID } from '../data/eggs.js';
import { DECOR_BY_ID, BATTERY, NIGHT_FLYERS } from '../data/decor.js';
import { CATS, catsAsleep } from '../data/cats.js';
import { GARDEN_MAP, BOAT, BIRD } from '../data/balance.js';
import { Rng } from '../core/rng.js';
import { bugsOnExpedition, effectiveTraits } from '../systems/bugs.js';
import { incubatorCount } from '../systems/eggs.js';
import { dirtPatches, favouriteDecor, potCap, decorFits, decorRect } from '../systems/garden.js';
import { rockFindReady } from '../systems/visitors.js';
import { fmtTime } from './format.js';
import { daylight } from '../systems/daylight.js';
import { updateFx, drawUnder, drawOver, spriteFx } from './bug-fx.js';

// World units are pixels of the BugsMap art (150 x 300).
export const WORLD_W = GARDEN_MAP.w;
export const WORLD_H = GARDEN_MAP.h;
const BOUNDS = { x0: 8, x1: WORLD_W - 8, y0: 14, y1: WORLD_H - 8 };
const MOVE = { wriggler: 4, crawler: 11, beetle: 8, arachnid: 13, hopper: 9, flyer: 16 };
const PERSONAL_SPACE = 11;
// What a bug says when the rock lands on it: [text, weight]. A newline splits
// a long line in two so it fits above the bug.
const CRUSH_REACTIONS = [['YEEEOUCH!', 47], ['OWOWOWOW', 47], ["Dude why'd you do that?\nNot cool, man.", 6]];

const rand = (a, b) => a + Math.random() * (b - a);
// The paper boat's course down the middle of the river, in the river art's pixels.
const BOAT_PATH = [[19, -8], [19, 8], [24, 16], [38, 22], [55, 30], [68, 40], [80, 48], [92, 56], [104, 62], [118, 67]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// A campfire's flicker, 0 to 1: a slow sway, quicker licks, and now and
// then a sharp dip, from sines that never quite line up.
const flicker = (t) => {
  const v = 0.55 + 0.2 * Math.sin(t * 2.3) + 0.14 * Math.sin(t * 6.7 + 1.3) + 0.08 * Math.sin(t * 13.1 + 0.4) + 0.05 * Math.sin(t * 23.9 + 2.1);
  const dip = Math.max(0, Math.sin(t * 1.7 + 0.8) * Math.sin(t * 4.9)) ** 6 * 0.35;
  return clamp(v - dip, 0, 1);
};
// The two orbs of light inside the Jar of Light, in its art's pixels:
// [x, y, radius, phase].
// Where the cats sit, in the flower bed art's pixels: [x, y of their lowest
// pixel]. Each is in front of the box's bottom edge, two pixels below its
// shadow there: Mika on the left face, Noctis and Vyke on the right.
const CAT_SEATS = [[13, 69], [45, 68], [69, 56]];
const JAR_ORBS = [[17, 42, 3, 0], [27, 46, 2.5, 2.4]];

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
    this.pulses = []; // electric rings spreading from the battery
    this.camX = null;
    this.fireflies = Array.from({ length: 40 }, () => ({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), p: rand(0, 6.28) }));
    const coinRng = new Rng(7);
    // Dug-up coins show around the middle of the garden.
    this.coinSpots = Array.from({ length: 10 }, () => [coinRng.int(WORLD_W / 2 - 55, WORLD_W / 2 + 55), coinRng.int(WORLD_H / 2 - 110, WORLD_H / 2 + 100)]);
    this.flowers = assets.flowerSpots.filter((f) => f.x > BOUNDS.x0 && f.x < BOUNDS.x1 && f.y > BOUNDS.y0 && f.y < BOUNDS.y1);
    this.camY = null;
    this.t = 0;
    this.dl = daylight(game.now());
    this.shade = document.createElement('canvas'); // the night's darkness, with holes cut by lights
    this.last = performance.now();
    this.drag = null;
    this.rockDrag = null;
    this.decorDrag = null;
    this.water = null; // the river's animated surface, built once its art has loaded
    this.logRoll = 0;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.drag = null; this.rockDrag = null; this.decorDrag = null; });
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
    // Whole device pixels per art pixel keeps the pixel art crisp. The scale
    // fits a view-sized window of the map; the rest is reached by dragging.
    this.scale = Math.max(1, Math.ceil(Math.max(cw / GARDEN_MAP.viewW, ch / GARDEN_MAP.viewH)));
    this.viewW = cw / this.scale;
    this.viewH = ch / this.scale;
    // Start looking at the rock.
    const rock = this.game.state.garden.rock;
    if (this.camX === null) this.camX = rock.x - this.viewW / 2;
    if (this.camY === null) this.camY = rock.y - this.viewH * 0.45;
    this.clampCamera();
    this.bugPx = Math.max(1, Math.round(this.scale * 0.8));
  }

  clampCamera() {
    this.camX = clamp(this.camX, 0, Math.max(0, WORLD_W - this.viewW));
    this.camY = clamp(this.camY, 0, Math.max(0, WORLD_H - this.viewH));
  }

  // Centres the view on a map point.
  lookAt(x, y) {
    this.camX = x - this.viewW / 2;
    this.camY = y - this.viewH / 2;
    this.clampCamera();
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

  // Garden bugs that are home, plus wild visitors (keyed 'v<id>'). Anyone who
  // is no longer here walks off the edge of the garden instead of vanishing.
  sync() {
    const st = this.game.state;
    const now = this.game.now();
    const away = bugsOnExpedition(st);
    const home = st.bugs.filter((b) => b.inGarden && !away.has(b.uid));
    const visitors = st.garden.visitors.filter((v) => v.leavesAt > now);
    const keep = new Set([...home.map((b) => b.uid), ...visitors.map((v) => `v${v.id}`)]);
    for (const [key, e] of this.entities) {
      if (keep.has(key) || e.leaving) continue;
      if (e.hidden || !this.ready) this.entities.delete(key);
      else this.leave(e);
    }
    const place = (key, species, fresh) => {
      let e = this.entities.get(key);
      if (!e) {
        e = this.spawn(species, fresh);
        e.uid = key;
        this.entities.set(key, e);
      }
      if (e.leaving) {
        e.leaving = false;
        e.tx = clamp(e.x, BOUNDS.x0, BOUNDS.x1);
        e.ty = clamp(e.y, BOUNDS.y0, BOUNDS.y1);
      }
      const sp = SPECIES[species];
      e.fav = favouriteDecor(st, species)?.id || null;
      e.species = species;
      e.aura = sp.aura;
      e.fx = sp.fx;
      e.fxColor = sp.fxColor;
      e.glowing = sp.base === 'firefly' || sp.base === 'luna_moth' || !!sp.aura;
      e.nocturnal = e.glowing || NIGHT_FLYERS.has(sp.base); // stays up all night
      return e;
    };
    for (const b of home) {
      const e = place(b.uid, b.species, this.ready);
      e.variant = b.variant;
      e.digger = (effectiveTraits(b).dig || 0) > 0;
    }
    for (const v of visitors) {
      const e = place(`v${v.id}`, v.species, this.ready);
      e.visitor = v.id;
      e.greeted = v.greeted;
      e.variant = null;
    }
    this.ready = true;
  }

  leave(e) {
    e.leaving = true;
    e.act = null;
    e.actTime = 0;
    e.wait = 0;
    // Off the nearer side of the screen.
    e.tx = e.x < this.camX + this.viewW / 2 ? this.camX - 14 : this.camX + this.viewW + 14;
    e.ty = e.y + rand(-10, 10);
  }

  // New arrivals walk in from the edge; bugs already here at load are placed.
  spawn(species, walkIn = false) {
    const sp = SPECIES[species];
    const fam = sp.family;
    const side = sp.view === 'side';
    // Somewhere on screen; new arrivals walk in from just off one side of it.
    let x = rand(Math.max(BOUNDS.x0, this.camX + 10), Math.min(BOUNDS.x1, this.camX + this.viewW - 10));
    const y = rand(Math.max(BOUNDS.y0, this.camY + 10), Math.min(BOUNDS.y1, this.camY + this.viewH - 30));
    if (walkIn) x = Math.random() < 0.5 ? this.camX - 10 : this.camX + this.viewW + 10;
    const e = {
      species, family: fam, side, likesRock: sp.likesRock, flip: Math.random() < 0.5 ? -1 : 1,
      x, y, tx: x, ty: y, angle: side ? 0 : rand(0, Math.PI * 2), wait: rand(0, 2),
      speed: MOVE[fam] * rand(0.8, 1.2), phase: rand(0, 6.28), act: null, actTime: 0, bubble: 0, hearts: 0, surprised: 0,
    };
    if (walkIn) {
      e.tx = clamp(x + (x < this.camX ? rand(25, 50) : -rand(25, 50)), BOUNDS.x0, BOUNDS.x1);
      e.wait = 0;
      return e;
    }
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

  // Picks the next thing to do: hang around a favourite decoration, wander,
  // visit a flower, dig, or hide under the rock.
  pickTarget(e) {
    e.act = null;
    // At night most bugs nod off where they are; night flyers stay busy.
    e.sleeping = !e.nocturnal && !e.leaving && !(e.boost > 0) && Math.random() < 0.75 * this.dl.dark;
    if (e.sleeping) {
      e.wait = rand(8, 20);
      return;
    }
    const roll = Math.random();
    const fav = e.fav && e.fav !== 'rock' && this.decorSpot(e.fav);
    if (fav && roll < 0.6) {
      this.visitDecor(e, e.fav, fav);
    } else if (e.likesRock && !this.rockDrag && roll < 0.3) {
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
    this.avoidBird(e);
  }

  // Where a placed decoration is right now (the river follows the top of the
  // screen; the one being dragged follows the finger).
  decorSpot(id) {
    if (this.decorDrag?.id === id) return this.decorDrag;
    if (id === 'river') return this.game.state.garden.decor.river ? this.riverRect() : null;
    return this.game.state.garden.decor[id] || null;
  }

  riverRect() {
    const d = DECOR_BY_ID.river;
    const [x0, y0] = d.fixed;
    const [w, h] = d.size.map((v) => v * d.scale);
    return { x: x0 + w / 2, y: y0 + h / 2, x0, y0, w, h, s: d.scale };
  }

  // A random point on the river's water, in map pixels.
  riverPoint() {
    const cells = this.assets.riverWater?.cells;
    const r = this.riverRect();
    if (!cells?.length) return [r.x, r.y];
    const [x, y] = cells[Math.floor(Math.random() * cells.length)];
    return [r.x0 + (x + 0.5) * r.s, r.y0 + (y + 0.5) * r.s];
  }

  // Sends a bug to the decoration it loves, doing that decoration's thing.
  visitDecor(e, id, spot) {
    const r = id === 'river' ? spot : decorRect(id, spot.x, spot.y);
    if (id === 'river') {
      [e.tx, e.ty] = this.riverPoint();
      e.tx = clamp(e.tx, BOUNDS.x0, BOUNDS.x1);
      e.ty = clamp(e.ty, BOUNDS.y0, BOUNDS.y1);
      e.act = 'sniff';
    } else if (id === 'battery') {
      e.tx = spot.x + rand(-r.w * 0.25, r.w * 0.25);
      e.ty = spot.y - r.h * 0.2 + rand(-4, 4);
      e.act = 'charge';
    } else if (id === 'log') {
      const side = Math.random() < 0.5 ? -1 : 1;
      e.tx = clamp(spot.x + side * rand(r.w * 0.2, r.w * 0.5), BOUNDS.x0, BOUNDS.x1);
      e.ty = clamp(spot.y + rand(r.h * 0.1, r.h * 0.5), BOUNDS.y0, BOUNDS.y1);
      e.act = 'dig';
    } else {
      // Flower bed and jar: hover or sniff around the top of it.
      const a = rand(0, Math.PI * 2);
      e.tx = clamp(spot.x + Math.cos(a) * r.w * 0.45, BOUNDS.x0, BOUNDS.x1);
      e.ty = clamp(spot.y + Math.sin(a) * r.h * 0.3 - (id === 'jar' ? r.h * 0.3 : 0), BOUNDS.y0, BOUNDS.y1);
      e.act = 'sniff';
    }
  }

  updateEntity(e, dt, others) {
    e.phase += dt * (e.family === 'flyer' ? 8 : 12);
    e.bubble = Math.max(0, e.bubble - dt);
    e.hearts = Math.max(0, e.hearts - dt);
    e.surprised = Math.max(0, e.surprised - dt);
    e.squish = Math.max(0, (e.squish || 0) - dt);
    e.slow = Math.max(0, (e.slow || 0) - dt);
    if (e.boost > 0) {
      e.boost -= dt;
      if (e.wait > 0.4) e.wait = 0.4; // too wired to sit still
      if (Math.random() < dt * 5) this.particles.push({ x: e.x + rand(-3, 3), y: e.y - rand(0, 5), vx: rand(-6, 6), vy: rand(-10, -2), life: 0.35, color: Math.random() < 0.5 ? '#fff07a' : '#73eff7' });
    }
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
    if (e.leaving) {
      e.act = null;
      e.wait = 0;
      e.actTime = 0;
      if (e.x < this.camX - 10 || e.x > this.camX + this.viewW + 10 || e.x < -10 || e.x > WORLD_W + 10) { this.entities.delete(e.uid); return; }
    }
    for (const o of others) {
      if (o === e || o.hidden || e.leaving || e.x < BOUNDS.x0 || e.x > BOUNDS.x1) continue;
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
      if (e.sleeping) {
        if (Math.random() < dt * 0.4) this.floaters.push({ x: e.x + 4, y: e.y - 6, text: 'z', color: '#c8d4ff', life: 1.6 });
        if (e.wait <= 0) this.pickTarget(e);
        return;
      }
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
      else if (e.act === 'charge') e.actTime = rand(4, 8);
      else e.wait = e.family === 'flyer' ? rand(0.2, 1.2) : rand(0.6, 3.5);
      return;
    }
    let sp = e.speed * (e.slow > 0 ? 0.35 : 1); // a squished bug limps for a bit
    if (e.boost > 0) sp *= BATTERY.boostSpeed; // charged up by a battery pulse
    if (e.leaving) sp *= 2.5; // off on an adventure, or heading home
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
    const color = dig ? '#7a4a2a' : e.act === 'charge' ? '#fff07a' : e.fav === 'flower_bed' ? '#f0c7f0' : '#ffcd75';
    this.particles.push({ x: e.x + rand(-4, 4), y: e.y + rand(-2, 4), vx: rand(-6, 6), vy: dig ? rand(-14, -6) : rand(-8, -3), life: 0.8, color });
  }

  update(dt) {
    this.t += dt;
    this.dl = daylight(this.game.now());
    this.sync();
    const list = [...this.entities.values()];
    for (const e of list) this.updateEntity(e, dt, list);
    for (const e of list) updateFx(this, e, dt);
    for (const f of this.fireflies) {
      f.p += dt;
      f.x = (f.x + Math.cos(f.p * 0.7) * dt * 6 + WORLD_W) % WORLD_W;
      f.y = (f.y + Math.sin(f.p * 0.5) * dt * 6 + WORLD_H) % WORLD_H;
    }
    this.zapCheck(list);
    this.updatePulses(dt, list);
    this.updateWater(dt);
    this.updateBoat(dt);
    this.updateBird(dt, list);
    this.updateCats(dt);
    this.logRoll = Math.max(0, this.logRoll - dt);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * (p.g ?? 1) * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-220);
    this.floaters = this.floaters.filter((f) => (f.life -= dt) > 0);
  }

  // ---------- drawing ----------

  draw() {
    const { ctx, scale } = this;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5c8c4c'; // the grass base colour, around the edges of the map
    ctx.fillRect(0, 0, cw, ch);
    const [mx, my] = this.toScreen(0, 0);
    // Only the base layer: the map's brown patch layer is drawn under the rock.
    if (this.assets.map[0]) ctx.drawImage(this.assets.map[0], Math.round(mx), Math.round(my), WORLD_W * scale, WORLD_H * scale);

    this.drawPatches();
    this.drawRiver(); // under the decorations, so its bank never covers them
    this.drawBoat();
    this.drawDecor();
    this.drawCats();
    this.drawCoins();
    const all = [...this.entities.values()].filter((e) => !e.hidden).sort((a, b) => a.y - b.y);
    for (const e of all) this.drawShadow(e);
    for (const e of all) if (e.act === 'charge' && e.actTime > 0) this.glow(e.x, e.y, 10 + Math.sin(this.t * 9) * 2, 'rgba(255, 240, 122, 0.6)');
    for (const e of all) if (e.aura) this.glow(e.x, e.y - this.bob(e), 11 + Math.sin(this.t * 3 + e.phase) * 2, hexA(e.aura, 0.55));
    for (const e of all) if (e.variant === 'shiny') this.glow(e.x, e.y - this.bob(e), 12 + Math.sin(this.t * 2 + e.phase), 'rgba(220, 245, 255, 0.55)');
    for (const e of all) drawUnder(this, e);
    for (const e of all) this.drawBug(e);
    for (const e of all) drawOver(this, e);
    this.drawBird();
    this.drawRock();
    this.drawRockHint();
    for (const p of this.particles) {
      const [sx, sy] = this.toScreen(p.x, p.y);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      if (p.star) this.sparkle(sx, sy, scale * 0.7, p.color);
      else if (p.ring) {
        // A bubble: a hollow ring with a glint.
        ctx.fillRect(sx - scale, sy - 2 * scale, 2 * scale, scale * 0.6);
        ctx.fillRect(sx - scale, sy + scale, 2 * scale, scale * 0.6);
        ctx.fillRect(sx - 2 * scale, sy - scale, scale * 0.6, 2 * scale);
        ctx.fillRect(sx + 1.4 * scale, sy - scale, scale * 0.6, 2 * scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - scale * 0.8, sy - scale * 0.8, scale * 0.6, scale * 0.6);
      } else ctx.fillRect(sx, sy, scale, scale);
    }
    ctx.globalAlpha = 1;

    this.drawNight(all);
    this.drawPulses();
    for (const e of all) this.drawOverlay(e);
    for (const f of this.floaters) {
      const [sx, sy] = this.toScreen(f.x, f.y - (1.6 - f.life) * 14);
      ctx.globalAlpha = Math.min(1, f.life * 2);
      this.text(f.text, sx, sy, f.color || '#ffcd75', 6);
      ctx.globalAlpha = 1;
    }
    this.drawNests();
  }

  // The day/night wash from the device clock. After dark, glowing bugs, the
  // jar, the battery and fireflies light up little pools in the darkness.
  drawNight(all) {
    const { ctx } = this;
    const { dark, tint } = this.dl;
    if (tint[3] < 0.005) return;
    const lights = [];
    if (dark > 0.02) {
      for (const e of all) {
        if (e.glowing) lights.push([e.x, e.y - this.bob(e), 18, 0.9]);
        else if (e.act === 'charge' && e.actTime > 0) lights.push([e.x, e.y, 12, 0.7]);
      }
      const jar = this.decorSpot('jar');
      if (jar) lights.push([jar.x, jar.y + 5, 50 + flicker(this.t) * 10, 0.85 + 0.15 * flicker(this.t + 0.5)]); // the jar lights up a good patch of garden
      const bat = this.decorSpot('battery');
      if (bat) lights.push([bat.x, bat.y, 16 + Math.sin(this.t * 7) * 1.5, 0.5]);
      for (const f of this.fireflies) lights.push([f.x, f.y, 7, 0.5 + 0.4 * Math.sin(f.p * 3)]);
    }
    const sh = this.shade;
    if (sh.width !== this.canvas.width || sh.height !== this.canvas.height) {
      sh.width = this.canvas.width;
      sh.height = this.canvas.height;
    }
    const c = sh.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, sh.width, sh.height);
    c.fillStyle = `rgba(${tint[0] | 0}, ${tint[1] | 0}, ${tint[2] | 0}, ${tint[3]})`;
    c.fillRect(0, 0, sh.width, sh.height);
    c.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, a] of lights) this.glow(x, y, r, `rgba(0, 0, 0, ${a * dark})`, c);
    ctx.drawImage(sh, 0, 0);
    if (dark < 0.02) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of all) if (e.glowing) this.glow(e.x, e.y - this.bob(e), 14, `rgba(255, 220, 120, ${0.35 * dark})`);
    const jar = this.decorSpot('jar');
    if (jar) this.glow(jar.x, jar.y + 5, 32 + flicker(this.t) * 10, `rgba(255, 215, 110, ${(0.3 + 0.25 * flicker(this.t + 0.3)) * dark})`);
    for (const f of this.fireflies) this.glow(f.x, f.y, 4, `rgba(220, 255, 140, ${(0.4 + 0.4 * Math.sin(f.p * 3)) * dark})`);
    ctx.globalCompositeOperation = 'source-over';
  }

  glow(x, y, r, color, c = this.ctx) {
    const [sx, sy] = this.toScreen(x, y);
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, r * this.scale);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(sx - r * this.scale, sy - r * this.scale, r * 2 * this.scale, r * 2 * this.scale);
  }

  // Outlined text centred on (sx, sy), nudged inside the canvas so it is
  // never cut off at the edges. A newline starts a second line above.
  text(str, sx, sy, color, size = 4) {
    const { ctx } = this;
    const px = Math.round(size * this.scale);
    ctx.font = `${px}px "Jersey 10", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, this.scale * 0.9);
    ctx.strokeStyle = '#1a1c2c';
    ctx.fillStyle = color;
    const lines = String(str).split('\n');
    const half = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 2 + ctx.lineWidth;
    const x = clamp(sx, half, Math.max(half, this.canvas.width - half));
    // Stay below the HUD that sits over the top of the garden.
    const inset = this.handlers.topInset?.() || 0;
    const top = Math.max(inset + px * 0.6, sy - (lines.length - 1) * px * 0.9);
    lines.forEach((l, i) => {
      const y = top + i * px * 0.9;
      ctx.strokeText(l, x, y);
      ctx.fillText(l, x, y);
    });
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
    const big = this.assets.bug(e.species).width / 16;
    this.ctx.ellipse(sx, sy, 5 * big * this.scale, 2 * big * this.scale, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawBug(e) {
    const { ctx } = this;
    const wig = e.moving || e.actTime > 0 ? 1 + Math.sin(e.phase * (e.act === 'dig' ? 2 : 1)) * 0.06 : 1;
    // Squished flat by the rock, then springing back into shape.
    const flat = e.squish > 1.6 ? 1 : (e.squish || 0) / 1.6;
    const blit = (img, x, y, alpha = 1, dx = 0, angle = e.angle, flip = e.flip) => {
      const size = img.width * this.bugPx; // drawn at its own pixel size, so big bugs look big
      const [sx, sy] = this.toScreen(x, y - this.bob(e));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(sx + dx * this.bugPx), Math.round(sy));
      if (e.side) ctx.scale(flip, 1);
      ctx.rotate(angle);
      ctx.scale(wig * (1 + 0.35 * flat), (2 - wig) * (1 - 0.55 * flat));
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    };
    const img = this.assets.bug(e.species, e.variant);
    if (e.fx?.length) spriteFx(this, e, img, blit);
    else blit(img, e.x, e.y);
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
    if (e.visitor && !e.greeted && !e.leaving && !e.bubble) this.text('?', sx, sy - this.scale + Math.sin(this.t * 4 + e.phase) * this.scale, '#a7f070', 7);
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

  // Something is waiting under a settled rock: a glint at its edge.
  drawRockHint() {
    if (this.rockDrag || !rockFindReady(this.game.state.garden, this.game.now())) return;
    const r = this.rock();
    const rs = this.rockSize();
    for (let k = 0; k < 2; k++) {
      const a = Math.sin(this.t * 2.2 + k * 2.6);
      if (a < 0.4) continue;
      const [sx, sy] = this.toScreen(r.x + (k ? 0.36 : -0.3) * rs.w, r.y + rs.h * 0.22);
      this.ctx.globalAlpha = a;
      this.sparkle(sx, sy, this.scale * 0.8, '#fff3b8');
      this.ctx.globalAlpha = 1;
    }
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
      // Skip bugs already reacting to this drop, so one crush says one thing.
      if (e.hidden || e.squish > 0 || !this.onRock(e.x, e.y - this.bob(e), { x, y })) continue;
      e.squish = 2.4;
      e.slow = 6;
      e.label = pickWeighted(CRUSH_REACTIONS);
      e.bubble = e.label.includes('\n') ? 3 : 1.8;
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
    return pot < 1 ? 0 : clamp(Math.ceil((pot / potCap(this.game.state)) * 10), 1, 10);
  }

  // ---------- decorations ----------

  // Draggable decorations at their spots, back to front. The one being
  // dragged is lifted, and tinted red where it won't fit.
  drawDecor() {
    const { ctx, scale } = this;
    const placed = Object.keys(this.game.state.garden.decor).filter((id) => !DECOR_BY_ID[id].fixed && this.assets.decor[id]);
    placed.sort((a, b) => this.decorSpot(a).y - this.decorSpot(b).y);
    for (const id of placed) {
      const d = DECOR_BY_ID[id];
      const spot = this.decorSpot(id);
      const art = this.assets.decor[id];
      const px = Math.max(1, Math.round(scale * d.scale));
      const [sx, sy] = this.toScreen(spot.x, spot.y);
      const dragging = this.decorDrag?.id === id;
      const lift = dragging ? 4 * scale : 0;
      // Its shadow: its own silhouette, cast down and to the right (further,
      // and fainter, while it's picked up).
      if (d.shadow) {
        const [ox, oy] = d.shadow;
        const sil = this.assets.silhouette(id);
        const far = dragging ? 1.6 : 1;
        ctx.globalAlpha = dragging ? 0.2 : 0.35;
        ctx.drawImage(sil, Math.round(sx + ox * far * scale - (art.width * px) / 2), Math.round(sy + oy * far * scale - (art.height * px) / 2), art.width * px, art.height * px);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy - lift));
      if (id === 'log' && this.logRoll > 0) ctx.rotate(Math.sin(this.logRoll * 14) * 0.25 * this.logRoll);
      if (dragging && !decorFits(this.game.state.garden, id, spot.x, spot.y)) ctx.globalAlpha = 0.5;
      ctx.drawImage(art, -Math.round((art.width * px) / 2), -Math.round((art.height * px) / 2), art.width * px, art.height * px);
      if (id === 'jar') this.drawJarOrbs(art, px);
      ctx.restore();
      // The battery crackles now and then.
      if (id === 'battery' && Math.random() < 0.02) {
        const r = decorRect(id, spot.x, spot.y);
        for (let k = 0; k < 3; k++) this.particles.push({ x: r.x0 + r.w * rand(0.2, 0.5), y: r.y0 + rand(0, 3), vx: rand(-10, 10), vy: rand(-16, -6), life: 0.5, color: '#fff07a' });
      }
    }
  }

  // The jar's two little orbs of light, drifting inside the glass and
  // flickering like a campfire. Drawn in the jar's own (translated) space.
  drawJarOrbs(art, px) {
    const { ctx } = this;
    for (const [ox, oy, r, ph] of JAR_ORBS) {
      const f = flicker(this.t * 1.1 + ph);
      const x = (ox - art.width / 2 + Math.sin(this.t * 0.9 + ph) * 1.2) * px;
      const y = (oy - art.height / 2 + Math.sin(this.t * 1.3 + ph * 2) * 1) * px;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3 * px);
      halo.addColorStop(0, `rgba(255, 220, 110, ${0.35 + 0.35 * f})`);
      halo.addColorStop(1, 'rgba(255, 200, 90, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 3 * px, y - r * 3 * px, r * 6 * px, r * 6 * px);
      // A pixel disc: deep yellow, a brighter heart, a white-hot centre.
      const rr = r * (0.9 + 0.15 * f);
      for (const [k, color] of [[1, '#ffcd75'], [0.6, '#fff07a'], [0.25, '#ffffff']]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(Math.round(x), Math.round(y), Math.max(px * 0.5, rr * k * px), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---------- the river ----------
  // The river is redrawn finer than its art (assets.makeRiver) and brought to
  // life by an animated surface at that resolution: currents drifting
  // downstream, rings spreading from little splashes, and glints of light,
  // all clipped to the open water.

  makeWater() {
    const river = this.assets.river;
    if (!river) return null;
    const surface = document.createElement('canvas');
    surface.width = river.w;
    surface.height = river.h;
    return { cells: river.cells, mask: river.mask, surface, ctx: surface.getContext('2d'), currents: [], rings: [], glints: [], spawn: 0 };
  }

  // A map point in the river picture's pixels.
  riverPixel(x, y) {
    const r = this.riverRect();
    const { k, pad } = this.assets.river;
    return [((x - r.x0) / r.s) * k + pad, ((y - r.y0) / r.s) * k + pad];
  }

  updateWater(dt) {
    if (!this.game.state.garden.decor.river) return;
    if (!this.water) this.water = this.makeWater();
    const w = this.water;
    if (!w) return;
    const pick = () => w.cells[Math.floor(Math.random() * w.cells.length)];
    // Currents: short light streaks drifting downstream (the river runs from
    // the top-left down to the right).
    while (w.currents.length < 320) {
      const [x, y] = pick();
      w.currents.push({ x, y, len: 3 + Math.floor(Math.random() * 8), age: 0, life: rand(1.2, 2.6), vx: rand(15, 27), vy: rand(6, 12) });
    }
    for (const c of w.currents) { c.age += dt; c.x += c.vx * dt; c.y += c.vy * dt; }
    w.currents = w.currents.filter((c) => c.age < c.life);
    // Rings: a steady patter of little splashes.
    w.spawn += dt * 18;
    while (w.spawn >= 1) {
      w.spawn -= 1;
      const [x, y] = pick();
      w.rings.push({ x, y, age: 0, life: rand(0.8, 1.4), size: rand(6, 12) });
    }
    for (const r of w.rings) r.age += dt;
    w.rings = w.rings.filter((r) => r.age < r.life);
    // Glints: sparkles of light that wink on and off.
    while (w.glints.length < 60) {
      const [x, y] = pick();
      w.glints.push({ x, y, age: 0, life: rand(0.5, 1.2) });
    }
    for (const g of w.glints) g.age += dt;
    w.glints = w.glints.filter((g) => g.age < g.life);
  }

  // Draws the water's moving surface onto its small canvas, clipped to the water.
  paintWater(shine) {
    const w = this.water;
    const c = w.ctx;
    c.clearRect(0, 0, w.surface.width, w.surface.height);
    for (const cur of w.currents) {
      c.globalAlpha = Math.sin((cur.age / cur.life) * Math.PI) * 0.6;
      c.fillStyle = '#a8e6ff';
      c.fillRect(Math.floor(cur.x), Math.floor(cur.y), cur.len, 1);
      c.fillRect(Math.floor(cur.x) + 2, Math.floor(cur.y) + 1, Math.max(1, cur.len - 3), 1); // a softer trailing edge
    }
    for (const r of w.rings) {
      if (r.age < 0) continue;
      const t = r.age / r.life;
      const rad = 0.8 + t * r.size;
      c.globalAlpha = (1 - t) * 0.75;
      c.fillStyle = '#dff6ff';
      const steps = Math.max(8, Math.round(rad * 7));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        c.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.55), 1, 1);
      }
    }
    for (const g of w.glints) {
      c.globalAlpha = Math.sin((g.age / g.life) * Math.PI) * shine;
      c.fillStyle = '#ffffff';
      c.fillRect(g.x, g.y, 1, 1);
      if (g.age / g.life > 0.25 && g.age / g.life < 0.75) { c.fillRect(g.x - 1, g.y, 3, 1); c.fillRect(g.x, g.y - 1, 1, 3); }
      if (g.age / g.life > 0.4 && g.age / g.life < 0.6) { c.fillRect(g.x - 2, g.y, 5, 1); c.fillRect(g.x, g.y - 2, 1, 5); }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(w.mask, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  drawRiver() {
    const river = this.assets.river;
    if (!river || !this.game.state.garden.decor.river) return;
    const { ctx, scale } = this;
    const r = this.riverRect();
    const px = (r.s / river.k) * scale; // screen pixels per river pixel
    const [sx, sy] = this.toScreen(r.x0 - (river.pad * r.s) / river.k, r.y0 - (river.pad * r.s) / river.k);
    const [dx, dy, dw, dh] = [Math.round(sx), Math.round(sy), Math.round(river.w * px), Math.round(river.h * px)];
    ctx.drawImage(river.art, dx, dy, dw, dh);
    if (!this.water) return;
    this.paintWater(1 - 0.65 * this.dl.dark);
    ctx.drawImage(this.water.surface, dx, dy, dw, dh);
  }

  // Whether a map point is on the river's water.
  onRiver(wx, wy) {
    const cells = this.assets.riverWater;
    if (!cells || !this.game.state.garden.decor.river) return false;
    const r = this.riverRect();
    const x = Math.floor((wx - r.x0) / r.s);
    const y = Math.floor((wy - r.y0) / r.s);
    return x >= 0 && y >= 0 && x < cells.w && y < cells.h && cells.set.has(y * cells.w + x);
  }

  // Which decoration is under a point, front-most first.
  decorAt(wx, wy) {
    const placed = Object.keys(this.game.state.garden.decor).filter((id) => this.decorSpot(id));
    placed.sort((a, b) => this.decorSpot(b).y - this.decorSpot(a).y);
    for (const id of placed) {
      const spot = this.decorSpot(id);
      if (id === 'river') {
        if (this.onRiver(wx, wy)) return id;
        continue;
      }
      const r = decorRect(id, spot.x, spot.y);
      if (wx >= r.x0 && wx <= r.x1 && wy >= r.y0 && wy <= r.y1) return id;
    }
    return null;
  }

  // ---------- the paper boat ----------
  // It drifts down the middle of the river, following BOAT_PATH (in the
  // river art's pixels), and is gone once it floats off the map.

  boatPath() {
    const r = this.riverRect();
    const pts = BOAT_PATH.map(([x, y]) => [r.x0 + x * r.s, r.y0 + y * r.s]);
    let len = 0;
    const segs = pts.slice(1).map((p, i) => {
      const l = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]);
      len += l;
      return { a: pts[i], b: p, l };
    });
    return { segs, len };
  }

  // Where the boat is after drifting `d` map pixels: [x, y, heading].
  boatAt(d) {
    const { segs } = this.boat.path;
    for (const s of segs) {
      if (d <= s.l) {
        const t = d / s.l;
        return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t, Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])];
      }
      d -= s.l;
    }
    const last = segs[segs.length - 1];
    return [last.b[0], last.b[1], 0];
  }

  updateBoat(dt) {
    if (!this.boat) {
      if (this.ready && this.assets.river && this.game.boatDue()) this.boat = { d: 0, path: this.boatPath(), wake: 0 };
      return;
    }
    const b = this.boat;
    if (b.caught) {
      b.sink -= dt;
      if (b.sink <= 0) this.boat = null;
      return;
    }
    if (!this.game.state.garden.decor.river) { this.boat = null; return; }
    b.d += BOAT.speed * dt;
    b.wake -= dt;
    if (b.wake <= 0 && this.water) {
      // A soft wake behind it.
      const [x, y] = this.boatAt(Math.max(0, b.d - 4));
      const [rx, ry] = this.riverPixel(x, y + 3);
      this.water.rings.push({ x: rx, y: ry, age: 0, life: 1.4, size: 9 });
      b.wake = 0.7;
    }
    if (b.d >= b.path.len) {
      this.game.boatGone();
      this.boat = null;
    }
  }

  drawBoat() {
    const b = this.boat;
    if (!b) return;
    const [x, y, heading] = this.boatAt(b.d);
    const img = this.assets.sprites.paper_boat;
    const size = img.width * this.bugPx * 1.25; // a touch bigger than a bug, so it's easy to spot
    const [sx, sy] = this.toScreen(x, y + Math.sin(this.t * 2.2) * 0.8);
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    if (Math.cos(heading) < 0) ctx.scale(-1, 1);
    ctx.rotate(Math.sin(this.t * 1.7) * 0.08);
    if (b.caught) {
      const p = Math.max(0, b.sink) / 0.6;
      ctx.globalAlpha = p;
      ctx.translate(0, (1 - p) * size * 0.4);
    }
    ctx.drawImage(img, -size / 2, -size * 0.7, size, size);
    ctx.restore();
  }

  catchBoat() {
    const res = this.handlers.onBoat?.();
    if (!res?.ok) return;
    const [x, y] = this.boatAt(this.boat.d);
    this.boat.caught = true;
    this.boat.sink = 0.6;
    this.float(x, y - 10, 'Egg!', '#a7f070');
    if (this.water) {
      const [rx, ry] = this.riverPixel(x, y);
      for (let k = 0; k < 3; k++) this.water.rings.push({ x: rx, y: ry, age: -k * 0.15, life: 1.4, size: 16 });
    }
  }

  // ---------- the bird on the log ----------
  // It flies in, perches on the log, and every bug within BIRD.radius
  // scurries off until it leaves. Tap it to shoo it away.

  logCentre() {
    const spot = this.decorSpot('log');
    return spot && this.decorDrag?.id !== 'log' ? spot : null;
  }

  updateBird(dt, list) {
    const log = this.logCentre();
    if (!this.bird) {
      if (this.ready && log && this.game.birdDue()) {
        const r = decorRect('log', log.x, log.y);
        const px = log.x + rand(-r.w * 0.2, r.w * 0.2);
        const py = log.y - r.h * 0.3;
        const from = Math.random() < 0.5 ? -1 : 1;
        this.bird = { phase: 'in', x: px + from * 150, y: py - 130, tx: px, ty: py, t: 0, stay: rand(...BIRD.staySec), scared: new Set(), face: -from };
      }
      return;
    }
    const b = this.bird;
    b.t += dt;
    if (!log && b.phase !== 'out') this.birdLeaves(false);
    if (b.phase === 'perched' && b.t > b.stay) this.birdLeaves(false);
    if (b.phase !== 'perched') {
      const speed = b.phase === 'out' ? 110 : 75;
      const dx = b.tx - b.x;
      const dy = b.ty - b.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 1) b.face = dx < 0 ? -1 : 1;
      if (d < speed * dt) {
        b.x = b.tx;
        b.y = b.ty;
        if (b.phase === 'in') { b.phase = 'perched'; b.t = 0; b.face = -b.face; }
        else { this.bird = null; return; }
      } else {
        b.x += (dx / d) * speed * dt;
        b.y += (dy / d) * speed * dt;
      }
    }
    if (b.phase !== 'perched' || !log) return;
    // Everyone near the log scurries off.
    for (const e of list) {
      if (e.hidden || e.leaving) continue;
      if (Math.hypot(e.x - log.x, e.y - log.y) >= BIRD.radius) continue;
      if (!b.scared.has(e.uid)) {
        b.scared.add(e.uid);
        Object.assign(e, { surprised: 1.4, label: 'Eek!', labelColor: '#ffcd75', bubble: 1.2, sleeping: false });
      }
      if (Math.hypot(e.tx - log.x, e.ty - log.y) < BIRD.radius + 4) {
        Object.assign(e, { act: null, actTime: 0, wait: 0 });
        this.avoidBird(e);
      }
    }
  }

  // Keeps a bug's destination outside the bird's reach while it's perched.
  avoidBird(e) {
    const log = this.bird?.phase === 'perched' && this.logCentre();
    if (!log) return;
    const dx = e.tx - log.x;
    const dy = e.ty - log.y;
    const d = Math.hypot(dx, dy);
    if (d >= BIRD.radius + 4) return;
    const a = d > 0.5 ? Math.atan2(dy, dx) : Math.atan2(e.y - log.y, e.x - log.x) || rand(0, Math.PI * 2);
    e.tx = clamp(log.x + Math.cos(a) * (BIRD.radius + rand(8, 18)), BOUNDS.x0, BOUNDS.x1);
    e.ty = clamp(log.y + Math.sin(a) * (BIRD.radius + rand(8, 18)), BOUNDS.y0, BOUNDS.y1);
  }

  birdLeaves(shooed) {
    const b = this.bird;
    if (!b || b.phase === 'out') return;
    if (!shooed) this.game.birdGone();
    b.phase = 'out';
    b.tx = b.x + (b.face || 1) * 160;
    b.ty = b.y - 160;
  }

  shooBird() {
    const b = this.bird;
    const scared = [...b.scared].map((uid) => this.entities.get(uid)).filter((e) => e && !e.leaving);
    const res = this.handlers.onBird?.(scared.length);
    if (!res?.ok) return;
    res.coins.forEach((c, i) => { if (scared[i]) { scared[i].hearts = 1.2; this.float(scared[i].x, scared[i].y - 8, `+${c}`); } });
    for (let k = 0; k < 6; k++) this.particles.push({ x: b.x, y: b.y, vx: rand(-25, 25), vy: rand(-25, 0), life: 0.7, color: k % 2 ? '#b07a4a' : '#7a4a2a' });
    this.birdLeaves(true);
  }

  drawBird() {
    const b = this.bird;
    if (!b) return;
    const s = this.assets.sprites;
    const img = b.phase === 'perched' ? s.bird_perch : Math.floor(this.t * 9) % 2 ? s.bird_up : s.bird_down;
    const size = img.width * this.bugPx;
    const hop = b.phase === 'perched' && Math.sin(this.t * 1.3) > 0.97 ? 2 : 0; // the odd little hop
    const [sx, sy] = this.toScreen(b.x, b.y - hop);
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    if (b.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -size / 2, -size * 0.85, size, size);
    ctx.restore();
  }

  // ---------- the cats ----------
  // Whoever is visiting stands along the flower bed, in the same order each
  // time. Opened at night (CAT_VISITS.asleep), they're curled up asleep for
  // the whole session; awake, they meow now and then until petted.

  updateCats(dt) {
    this.catTimer = (this.catTimer || 0) - dt;
    if (this.catTimer <= 0) {
      this.catTimer = 1;
      this.cats = this.ready ? this.game.catVisit() : null;
      if (this.catsAsleep === undefined && this.ready) this.catsAsleep = catsAsleep(this.game.now());
    }
    const visit = this.cats;
    if (!visit?.here.length || this.decorDrag?.id === 'flower_bed') return;
    for (const c of this.catSpots()) {
      if (Math.random() > dt * (this.catsAsleep ? 0.5 : visit.petted ? 0 : 0.15)) continue;
      if (this.catsAsleep) this.float(c.x + 2, c.y - 14, 'z', '#94b0c2');
      else this.float(c.x, c.y - 26, 'Meow!', '#f4f4f4');
    }
  }

  // Where each visiting cat is: [{ id, x, y }], in map pixels, with y the
  // bottom of its lowest pixel: in front of the flower bed's bottom edge,
  // just below the bed's shadow (CAT_SEATS).
  catSpots() {
    const visit = this.cats;
    const bed = this.decorSpot('flower_bed');
    if (!visit?.here.length || !bed) return [];
    const r = decorRect('flower_bed', bed.x, bed.y);
    const k = DECOR_BY_ID.flower_bed.scale;
    return CATS.map((c, i) => ({ id: c.id, x: r.x0 + (CAT_SEATS[i][0] + 0.5) * k, y: r.y0 + (CAT_SEATS[i][1] + 1) * k, seat: CAT_SEATS[i] }))
      .filter((c) => visit.here.includes(c.id));
  }

  // The lowest drawn row of a sprite (redrawn cats may differ), cached per image.
  lowestRow(img) {
    this.lowRows = this.lowRows || new WeakMap();
    if (!this.lowRows.has(img)) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      let low = img.height - 1;
      while (low > 0 && ![...Array(img.width).keys()].some((x) => d[(low * img.width + x) * 4 + 3] > 0)) low--;
      this.lowRows.set(img, low);
    }
    return this.lowRows.get(img);
  }

  drawCats() {
    const spots = this.catSpots();
    const art = this.assets.decor.flower_bed;
    if (!spots.length || !art) return;
    const { ctx } = this;
    // Seats are in the bed art's pixels, placed exactly as drawDecor draws it.
    const bed = this.decorSpot('flower_bed');
    const px = Math.max(1, Math.round(this.scale * DECOR_BY_ID.flower_bed.scale));
    const [bx, by] = this.toScreen(bed.x, bed.y);
    const left = Math.round(bx) - Math.round((art.width * px) / 2);
    const top = Math.round(by) - Math.round((art.height * px) / 2);
    for (const c of spots.sort((a, b) => a.y - b.y)) {
      const img = this.assets.bugs[this.catsAsleep ? `${c.id}_asleep` : c.id];
      if (!img) continue;
      const size = img.width * this.bugPx;
      const fx = left + (c.seat[0] + 0.5) * px;
      const fy = top + (c.seat[1] + 1) * px; // the bottom of the cat's lowest pixel
      // A slow breath while asleep; awake, the odd little shift of weight.
      const breath = Math.sin(this.t * (this.catsAsleep ? 1.2 : 0.7) + c.x) > 0.6 ? this.bugPx : 0;
      ctx.drawImage(img, Math.round(fx - size / 2), Math.round(fy - (this.lowestRow(img) + 1) * this.bugPx - breath), size, size);
    }
  }

  // Tapped a cat? Pets them all (once a visit).
  catAt(wx, wy) {
    if (!this.cats || this.cats.petted) return false;
    return this.catSpots().some((c) => Math.abs(c.x - wx) < 13 && wy > c.y - 22 && wy < c.y + 1);
  }

  petCats() {
    const res = this.handlers.onCats?.();
    if (!res?.ok) return;
    for (const c of this.catSpots()) {
      for (let k = 0; k < 5; k++) this.particles.push({ x: c.x, y: c.y - 16, vx: rand(-14, 14), vy: rand(-24, -8), life: 0.9, color: '#f4a0b0', g: 0.2 });
      this.float(c.x, c.y - 26, 'Purr', '#f4a0b0');
    }
    this.cats = this.game.catVisit();
  }

  // Tapping the battery: a ring of electricity spreads out from it.
  pulse() {
    const spot = this.decorSpot('battery');
    if (!spot) return;
    this.pulses.push({ x: spot.x, y: spot.y, age: 0, hit: new Set() });
    for (let k = 0; k < 14; k++) {
      const a = rand(0, Math.PI * 2);
      this.particles.push({ x: spot.x, y: spot.y, vx: Math.cos(a) * rand(20, 40), vy: Math.sin(a) * rand(20, 40) - 10, life: 0.5, color: k % 2 ? '#fff07a' : '#ffffff' });
    }
  }

  // Tapped while recharging: a feeble crackle, nothing more.
  fizzle() {
    const spot = this.decorSpot('battery');
    if (!spot) return;
    const r = decorRect('battery', spot.x, spot.y);
    for (let k = 0; k < 4; k++) this.particles.push({ x: r.x0 + r.w * rand(0.2, 0.5), y: r.y0 + rand(0, 3), vx: rand(-8, 8), vy: rand(-10, -4), life: 0.4, color: '#566c86' });
  }

  // Each bug the ring sweeps over gets a jolt: coins and a burst of speed.
  updatePulses(dt, list) {
    for (const p of this.pulses) {
      p.age += dt;
      const radius = Math.min(1, p.age / (BATTERY.pulseMs / 1000)) * BATTERY.pulseRadius;
      for (const e of list) {
        if (e.hidden || e.leaving || p.hit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > radius) continue;
        p.hit.add(e);
        e.boost = BATTERY.boostMs / 1000;
        Object.assign(e, { label: 'Bzzt!', labelColor: '#fff07a', bubble: 1.2, surprised: 1, sleeping: false, act: null, actTime: 0, wait: 0.2 });
        for (let k = 0; k < 6; k++) this.particles.push({ x: e.x, y: e.y - 4, vx: rand(-20, 20), vy: rand(-20, -4), life: 0.5, color: k % 2 ? '#fff07a' : '#73eff7' });
        // Coins straight into the pot (shown even if it's already full).
        const res = this.handlers.onPulseZap?.();
        if (res?.ok) this.float(e.x + 8, e.y - 4, res.coins ? `+${res.coins}` : 'Pot full');
      }
    }
    this.pulses = this.pulses.filter((p) => p.age < BATTERY.pulseMs / 1000 + 0.25);
  }

  // The pulse: a jagged, flickering ring that fades as it spreads.
  drawPulses() {
    const { ctx, scale } = this;
    for (const p of this.pulses) {
      const t = Math.min(1, p.age / (BATTERY.pulseMs / 1000));
      const radius = t * BATTERY.pulseRadius;
      const fade = 1 - Math.max(0, (p.age - BATTERY.pulseMs / 1000) / 0.25);
      ctx.globalAlpha = (1 - t * 0.6) * fade;
      this.glow(p.x, p.y, radius * 0.9, 'rgba(255, 240, 122, 0.18)');
      const steps = 48;
      for (const [color, jit] of [['#73eff7', 3], ['#fff07a', 1.8], ['#ffffff', 0.8]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, scale * (color === '#ffffff' ? 0.5 : 0.8));
        ctx.beginPath();
        for (let k = 0; k <= steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          const r = radius + (k % steps ? rand(-jit, jit) : 0);
          const [sx, sy] = this.toScreen(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7);
          if (k) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Bugs that wander too close to the battery get a zap and hop away.
  // Electric bugs love it and never get zapped.
  zapCheck(list) {
    const spot = this.decorSpot('battery');
    if (!spot || this.decorDrag?.id === 'battery') return;
    const r = decorRect('battery', spot.x, spot.y);
    const now = performance.now();
    for (const e of list) {
      if (e.hidden || e.leaving || e.fav === 'battery' || (e.zapUntil || 0) > now) continue;
      const inside = e.x > r.x0 - BATTERY.reach && e.x < r.x1 + BATTERY.reach && e.y > r.y0 - BATTERY.reach && e.y < r.y1 + BATTERY.reach;
      if (!inside) continue;
      e.zapUntil = now + BATTERY.cooldownMs;
      Object.assign(e, { label: 'Bzzt!', labelColor: '#fff07a', bubble: 1.4, surprised: 1.2, act: null, actTime: 0, wait: 0.8 });
      const a = Math.atan2(e.y - spot.y, e.x - spot.x);
      e.x = clamp(spot.x + Math.cos(a) * (r.w / 2 + BATTERY.reach + 3), BOUNDS.x0, BOUNDS.x1);
      e.y = clamp(spot.y + Math.sin(a) * (r.h / 2 + BATTERY.reach + 3), BOUNDS.y0, BOUNDS.y1);
      for (let k = 0; k < 6; k++) this.particles.push({ x: e.x, y: e.y - 4, vx: rand(-20, 20), vy: rand(-20, -4), life: 0.5, color: k % 2 ? '#fff07a' : '#ffffff' });
      if (this.handlers.onZap?.()) this.float(e.x + 8, e.y - 4, '+1');
    }
  }

  // Tapping a decoration: the log rolls over, the river ripples.
  tapDecor(id, x, y) {
    if (id === 'river' && this.water) {
      const [rx, ry] = this.riverPixel(x, y);
      for (let k = 0; k < 3; k++) this.water.rings.push({ x: rx, y: ry, age: -k * 0.18, life: 1.6, size: 20 });
    }
    if (id === 'battery') {
      if (this.handlers.onPulse?.()) this.pulse();
      else this.fizzle();
    }
    if (id === 'log') {
      this.logRoll = 0.9;
      const spot = this.decorSpot('log');
      for (const e of this.entities.values()) {
        if (e.hidden || Math.hypot(e.x - spot.x, e.y - spot.y) > 50) continue;
        Object.assign(e, { surprised: 1.5, act: null, actTime: 0, wait: 0 });
        e.tx = clamp(e.x + (e.x - spot.x) * 1.5, BOUNDS.x0, BOUNDS.x1);
        e.ty = clamp(e.y + (e.y - spot.y) * 1.5 + 10, BOUNDS.y0, BOUNDS.y1);
      }
      for (let k = 0; k < 16; k++) this.particles.push({ x: spot.x + rand(-30, 30), y: spot.y + rand(0, 12), vx: rand(-12, 12), vy: rand(-18, -6), life: 0.9, color: k % 3 ? '#7a4a2a' : '#f4f4f4' });
    }
    const res = this.handlers.onDecorTap?.(id);
    if (res?.coins) this.float(x, y - 6, `+${res.coins}`);
  }

  drawCoins() {
    for (let i = 0; i < this.coinCount(); i++) {
      const [sx, sy] = this.toScreen(...this.coinSpots[i]);
      const w = Math.abs(Math.cos(this.t * 2 + i)) * 0.7 + 0.3;
      const size = 9 * this.scale;
      this.ctx.drawImage(this.assets.sprites.coin, sx - (size * w) / 2, sy - size / 2, size * w, size);
    }
  }

  greet(e) {
    const res = this.handlers.onVisitor?.(e.visitor);
    if (!res?.ok) return;
    e.greeted = true;
    e.label = 'Hi!';
    e.labelColor = '#a7f070';
    e.bubble = 1.6;
    e.wait = 3;
    if (res.coins) this.float(e.x, e.y - 8, `+${res.coins}`);
    if (res.egg) this.float(e.x, e.y - 8, 'Egg!', '#a7f070');
  }

  float(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.6 });
  }

  // ---------- input ----------

  onDown(e) {
    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    const [cx, cy] = this.toCanvas(e.clientX, e.clientY);
    this.canvas.setPointerCapture?.(e.pointerId);
    // The bird and the boat come first: they don't hang around.
    if (this.bird && this.bird.phase !== 'out' && Math.hypot(this.bird.x - wx, this.bird.y - 9 - wy) < 15) return this.shooBird();
    if (this.boat && !this.boat.caught) {
      const [bx, by] = this.boatAt(this.boat.d);
      if (Math.hypot(bx - wx, by - wy) < 11) return this.catchBoat();
    }
    if (this.catAt(wx, wy)) return this.petCats();
    const onNest = this.nestLayout().some((n) => Math.abs(cx - n.x) < n.size / 2 && Math.abs(cy - n.y) < n.size / 2);
    const r = this.game.state.garden.rock;
    const onBug = [...this.entities.values()].some((b) => !b.hidden && !b.leaving && Math.hypot(b.x - wx, b.y - this.bob(b) - wy) < 8);
    const decor = !onNest && !onBug && this.decorAt(wx, wy);
    if (decor && !this.onRock(wx, wy)) {
      const spot = this.decorSpot(decor);
      this.decorDrag = { id: decor, x: spot.x, y: spot.y, grabX: wx - spot.x, grabY: wy - spot.y, moved: 0, startX: e.clientX, startY: e.clientY, fixed: !!DECOR_BY_ID[decor].fixed, tapX: wx, tapY: wy };
      return;
    }
    if (!onNest && this.onRock(wx, wy)) {
      this.rockDrag = { x: r.x, y: r.y, grabX: wx - r.x, grabY: wy - r.y, moved: 0, startX: e.clientX, startY: e.clientY };
      const found = this.reveal();
      this.handlers.onRockLift?.(found);
      return;
    }
    this.drag = { y: e.clientY, x: e.clientX, camX: this.camX, camY: this.camY, moved: 0 };
  }

  onMove(e) {
    if (this.decorDrag) {
      const d = this.decorDrag;
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.startX, e.clientY - d.startY));
      if (d.fixed || d.moved <= 6) return;
      const [wx, wy] = this.toWorld(e.clientX, e.clientY);
      d.x = clamp(wx - d.grabX, BOUNDS.x0, BOUNDS.x1);
      d.y = clamp(wy - d.grabY, BOUNDS.y0, BOUNDS.y1);
      return;
    }
    if (this.rockDrag) {
      const [wx, wy] = this.toWorld(e.clientX, e.clientY);
      const d = this.rockDrag;
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.startX, e.clientY - d.startY));
      d.x = clamp(wx - d.grabX, 26, WORLD_W - 26);
      d.y = clamp(wy - d.grabY, 30, WORLD_H - 20);
      return;
    }
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
    if (this.drag.moved > 6) {
      this.camX = this.drag.camX - (dx * this.dpr) / this.scale;
      this.camY = this.drag.camY - (dy * this.dpr) / this.scale;
      this.clampCamera();
    }
  }

  onUp(e) {
    if (this.decorDrag) {
      const d = this.decorDrag;
      this.decorDrag = null;
      if (d.moved > 6 && !d.fixed) this.handlers.onDecorMoved?.(d.id, d.x, d.y);
      else if (d.moved <= 8) this.tapDecor(d.id, d.tapX, d.tapY);
      return;
    }
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
      if (e.hidden || e.leaving) continue;
      const d = Math.hypot(e.x - x, e.y - this.bob(e) - y);
      if (d < 11 && (!best || d < best.d)) best = { e, d };
    }
    if (best) {
      const e = best.e;
      e.hearts = 1.2;
      e.wait = 2;
      e.actTime = 0;
      e.sleeping = false; // a tap wakes a sleepy bug
      if (e.visitor) return this.greet(e);
      return this.handlers.onBug(e.uid);
    }
    this.handlers.onEmpty?.();
  }
}

function pickWeighted(entries) {
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of entries) if ((r -= w) < 0) return v;
  return entries[0][0];
}

function hexA(hex, a) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
