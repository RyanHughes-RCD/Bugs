import { SPECIES_LIST } from '../data/species.js';
import { EGG_TIERS } from '../data/eggs.js';
import { SPRITES } from '../data/sprites.js';

// Copy of pixel_bugs/palette.txt, used only if the file cannot be fetched.
const FALLBACK_PALETTE = {
  K: '#1a1c2c', k: '#333c57', s: '#566c86', l: '#94b0c2', W: '#f4f4f4', R: '#b13e53', r: '#ef7d57', Y: '#ffcd75',
  G: '#38b764', g: '#a7f070', T: '#257179', b: '#3b5dc9', c: '#41a6f6', C: '#73eff7', P: '#5d275d', N: '#7a4a2a',
  n: '#b07a4a', p: '#f4a0b0',
};
const MAP_LAYERS = ['BugsMap/pixil-layer-0.png', 'BugsMap/pixil-layer-1.png'];

const GOLD_RAMP = ['#7a4f12', '#b8801c', '#e6aa2e', '#ffd75e', '#fff3b8'];
const ALBINO_RAMP = ['#aeb8c2', '#d3dae0', '#eef1f4', '#ffffff'];
const ALBINO_EYE = '#e0323c';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function makeCanvas(w = 16, h = 16) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

// Pattern painters for generated eggs: return a palette char or null per pixel.
const PATTERNS = {
  speckles: (x, y, v) => (((x * 7 + y * 13) % 11 === 0) ? v.mark : null),
  spots: (x, y, v) => ([[6, 4], [7, 4], [9, 7], [10, 7], [5, 9], [6, 9], [9, 11], [8, 11]].some(([a, b]) => a === x && b === y) ? v.mark : null),
  stripes: (x, y, v) => (y === 5 || y === 8 || y === 11 ? v.mark : null),
  zigzag: (x, y, v) => (y === 6 + ((x >> 1) % 2) || y === 10 + ((x >> 1) % 2) ? v.mark : null),
  stars: (x, y, v) => ([[7, 4], [10, 8], [5, 10]].some(([a, b]) => (Math.abs(a - x) + Math.abs(b - y) === 1) || (a === x && b === y)) ? v.mark : null),
  swirl: (x, y, v) => (((x * 2 + y * 3) % 7 < 2) ? (y % 2 ? v.mark : v.mark2 || v.mark) : null),
  constellation: (x, y, v) => {
    if ([[6, 4], [9, 6], [4, 8], [10, 10], [7, 12]].some(([a, b]) => a === x && b === y)) return v.mark;
    if ([[7, 5], [8, 5], [5, 7], [8, 11], [9, 11]].some(([a, b]) => a === x && b === y)) return v.mark2;
    return null;
  },
};
const CRACK_PATHS = [
  [[7, 2], [7, 3], [8, 4], [7, 5]],
  [[6, 6], [5, 7], [8, 6], [9, 7], [10, 7]],
  [[4, 8], [5, 8], [6, 9], [7, 8], [8, 9], [9, 8]],
];

export class Assets {
  constructor() {
    this.palette = { ...FALLBACK_PALETTE };
    this.bugs = {};
    this.variants = {};
    this.sprites = {};
    this.eggs = {};
    this.urls = new Map();
    this.map = [];
    this.flowerSpots = [];
    this.missing = [];
  }

  async load(onProgress = () => {}) {
    try {
      const text = await (await fetch('pixel_bugs/palette.txt')).text();
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const [ch, hex] = t.split(/\s+/);
        if (ch && /^#[0-9a-f]{6}$/i.test(hex)) this.palette[ch] = hex;
      }
    } catch { this.missing.push('pixel_bugs/palette.txt'); }
    this.byRgb = new Map(Object.entries(this.palette).map(([ch, hex]) => [hexRgb(hex).join(','), ch]));

    for (const [id, rows] of Object.entries(SPRITES)) this.sprites[id] = this.paint(rows);
    const fallbackBug = this.paint(SPRITES.star);
    const baseArt = {};
    const soft = (src, fn) => loadImage(src).then(fn, () => { this.missing.push(src); });
    const files = [...new Set(SPECIES_LIST.filter((s) => s.sprite).map((s) => s.sprite))];
    const jobs = [
      ...MAP_LAYERS.map((src, i) => soft(src, (img) => { this.map[i] = img; })),
      ...files.map((src) => soft(src, (img) => { baseArt[src] = this.downscale(img); })),
      ...EGG_TIERS.filter((t) => t.sprite).map((t) => soft(t.sprite, (img) => { this.eggs[t.id] = [this.downscale(img)]; })),
    ];
    let done = 0;
    await Promise.all(jobs.map((j) => j.then(() => onProgress(++done / jobs.length))));
    for (const s of SPECIES_LIST) {
      if (s.grid) this.bugs[s.id] = this.sprites[s.grid];
      else if (baseArt[s.sprite]) this.bugs[s.id] = s.recolor ? this.recolor(baseArt[s.sprite], s.recolor) : baseArt[s.sprite];
      else this.bugs[s.id] = fallbackBug;
    }
    for (const t of EGG_TIERS) if (!this.eggs[t.id]) this.eggs[t.id] = this.makeEgg(t.visual);
    if (this.map[0]) this.flowerSpots = this.findFlowers(this.map[0]);
    // The brown patch on the map's second layer is the dirt the rock leaves.
    this.patch = this.map[1] ? this.cropToContent(this.map[1]) : null;
    this.rock = this.makeRock(this.patch ? this.patch.width : 64);
    if (this.missing.length) console.warn('Missing assets (fallbacks used):', this.missing);
  }

  // 8x sprites are exact nearest-neighbour upscales of 16x16 art.
  downscale(img) {
    const c = makeCanvas();
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 16, 16);
    return c;
  }

  paint(rows, remap = {}) {
    const c = makeCanvas();
    const ctx = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const hex = this.palette[remap[ch] || ch];
      if (ch === '.' || !hex) return;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, 1, 1);
    }));
    return c;
  }

  // Runs fn over every opaque pixel. fn gets the palette char (if any), the
  // rgb, position and whether the pixel is part of the outer outline.
  mapPixels(src, fn) {
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const W = c.width;
    const H = c.height;
    const opaque = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
    const out = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (!d[i + 3]) continue;
        const rgb = [d[i], d[i + 1], d[i + 2]];
        const ch = this.byRgb.get(rgb.join(','));
        const edge = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1);
        out.push({ i, x, y, rgb, ch, outline: ch === 'K' && edge });
      }
    }
    fn(out, { W, H });
    for (const p of out) if (p.set) [d[p.i], d[p.i + 1], d[p.i + 2]] = p.set;
    ctx.putImageData(img, 0, 0);
    return c;
  }

  recolor(src, map) {
    return this.mapPixels(src, (px) => {
      for (const p of px) if (map[p.ch]) p.set = hexRgb(this.palette[map[p.ch]]);
    });
  }

  // Shiny: every colour inverted except the black outline.
  shiny(src) {
    return this.mapPixels(src, (px) => {
      for (const p of px) if (!p.outline) p.set = p.rgb.map((v) => 255 - v);
    });
  }

  // Golden: brightness mapped onto a gold ramp; the outline stays.
  golden(src) {
    return this.mapPixels(src, (px) => {
      for (const p of px) if (!p.outline) p.set = hexRgb(GOLD_RAMP[Math.min(GOLD_RAMP.length - 1, Math.floor(lum(...p.rgb) * GOLD_RAMP.length))]);
    });
  }

  // Albino: pale whites and greys, with red eyes.
  albino(src, view) {
    return this.mapPixels(src, (px, { W }) => {
      for (const p of px) if (!p.outline) p.set = hexRgb(ALBINO_RAMP[Math.min(ALBINO_RAMP.length - 1, Math.floor(lum(...p.rgb) * ALBINO_RAMP.length))]);
      for (const p of findEyes(px, W, view)) p.set = hexRgb(ALBINO_EYE);
    });
  }

  // Trims transparent margins (used for the dirt-patch layer of the map).
  cropToContent(img) {
    const c = makeCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let [x0, y0, x1, y1] = [c.width, c.height, -1, -1];
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (!d[(y * c.width + x) * 4 + 3]) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    if (x1 < 0) return null;
    const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
    out.getContext('2d').drawImage(c, -x0, -y0);
    return out;
  }

  // The rock sprite from data/sprites.js, trimmed and upscaled 3x with
  // Scale3x, which keeps its shape and colours but smooths the stair-stepped
  // edges into finer pixels. rockScale is how many map pixels each of those
  // finer pixels covers, so the rock stays about as wide as the dirt patch.
  makeRock(targetWidth) {
    const art = scale3x(this.cropToContent(this.sprites.rock));
    this.rockScale = targetWidth / art.width;
    return art;
  }

  // Builds an egg (plus three cracked stages) from the tier's visual config.
  makeEgg(v) {
    const rows = SPRITES.egg.map((row, y) => [...row].map((ch, x) => {
      if (ch === '3') return v.shade;
      if (ch !== '1' && ch !== '2') return ch;
      if (v.gem && y === 9 && (x === 7 || x === 8)) return v.gem;
      if (v.band && y === 9) return v.band;
      return PATTERNS[v.pattern]?.(x, y, v) || v.base;
    }).join(''));
    const stages = [this.paint(rows)];
    const cracked = rows.map((r) => [...r]);
    for (const path of CRACK_PATHS) {
      for (const [x, y] of path) if (cracked[y][x] !== '.') cracked[y][x] = 'K';
      stages.push(this.paint(cracked.map((r) => r.join(''))));
    }
    return stages;
  }

  // Flower pixels in the garden map become places bugs like to visit.
  findFlowers(img) {
    try {
      const c = makeCanvas(img.width, img.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const cells = new Map();
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const flower = (d[i] > 150 && d[i + 1] < 60 && d[i + 2] > 120) || (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240);
          if (!flower) continue;
          const key = `${x >> 3},${y >> 3}`;
          const cell = cells.get(key) || { x: 0, y: 0, n: 0 };
          cell.x += x; cell.y += y; cell.n += 1;
          cells.set(key, cell);
        }
      }
      return [...cells.values()].filter((c2) => c2.n >= 3).map((c2) => ({ x: c2.x / c2.n, y: c2.y / c2.n }));
    } catch {
      return [];
    }
  }

  // variant: null | 'shiny' | 'albino' | 'golden'
  bug(species, variant = null) {
    if (!variant) return this.bugs[species];
    const key = `${species}:${variant}`;
    if (!this.variants[key]) {
      const view = SPECIES_LIST.find((s) => s.id === species)?.view;
      this.variants[key] = variant === 'albino' ? this.albino(this.bugs[species], view) : this[variant](this.bugs[species]);
    }
    return this.variants[key];
  }

  url(key, canvas) {
    if (!this.urls.has(key)) this.urls.set(key, canvas.toDataURL());
    return this.urls.get(key);
  }

  bugUrl(species, variant = null) {
    return this.url(`bug:${species}:${variant}`, this.bug(species, variant));
  }

  spriteUrl(id) {
    return this.url(`sprite:${id}`, this.sprites[id] || this.sprites.star);
  }

  eggUrl(tier, stage = 0) {
    const stages = this.eggs[tier];
    return this.url(`egg:${tier}:${stage}`, stages[Math.min(stage, stages.length - 1)]);
  }
}

// Finds a bug's eyes: the bright pixels in the head region (top for top-down
// sprites, right end for side views). Falls back to a symmetric pair just
// below the top of the head when a sprite has no highlighted eyes.
function findEyes(px, W, view) {
  const solid = px.filter((p) => p.ch !== undefined);
  if (!solid.length) return [];
  const xs = solid.map((p) => p.x);
  const ys = solid.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const bright = (p) => lum(...p.rgb) > 0.75 && !p.outline;
  if (view === 'side') {
    const head = px.filter((p) => p.x >= x1 - (x1 - x0) * 0.35 && p.y <= y0 + (y1 - y0) * 0.7);
    const eyes = head.filter(bright).sort((a, b) => b.x - a.x || a.y - b.y).slice(0, 1);
    if (eyes.length) return eyes;
    const inner = head.filter((p) => !p.outline).sort((a, b) => b.x - a.x || a.y - b.y);
    return inner.slice(0, 1);
  }
  const cx = (x0 + x1) / 2;
  const head = px.filter((p) => p.y <= y0 + (y1 - y0) * 0.4 && Math.abs(p.x + 0.5 - (cx + 0.5)) <= 3.5);
  const eyes = head.filter(bright).sort((a, b) => a.y - b.y);
  if (eyes.length) return eyes.filter((p) => p.y === eyes[0].y).slice(0, 2);
  // No bright eyes: use the first row that is at least 3 pixels wide, nearest the centre.
  const byRow = new Map();
  for (const p of head) byRow.set(p.y, [...(byRow.get(p.y) || []), p]);
  for (const y of [...byRow.keys()].sort((a, b) => a - b)) {
    const row = byRow.get(y).sort((a, b) => a.x - b.x);
    if (row.length < 3) continue;
    const left = row.filter((p) => p.x <= cx).pop();
    const right = row.find((p) => p.x > cx);
    return [left, right].filter(Boolean);
  }
  return [];
}

// Scale3x / AdvMAME3x pixel-art upscaler: every pixel becomes a 3x3 block,
// with corners taken from matching neighbours so diagonals stay smooth.
function scale3x(src) {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext('2d');
  const sd = new Uint32Array(sctx.getImageData(0, 0, w, h).data.buffer);
  const out = makeCanvas(w * 3, h * 3);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w * 3, h * 3);
  const od = new Uint32Array(img.data.buffer);
  const at = (x, y) => sd[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [A, B, C] = [at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1)];
      const [D, E, F] = [at(x - 1, y), at(x, y), at(x + 1, y)];
      const [G, H, I] = [at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1)];
      const db = D === B && D !== H && B !== F;
      const bf = B === F && B !== D && F !== H;
      const dh = D === H && D !== B && H !== F;
      const hf = H === F && D !== H && B !== F;
      const px = [
        db ? D : E,
        (db && E !== C) || (bf && E !== A) ? B : E,
        bf ? F : E,
        (db && E !== G) || (dh && E !== A) ? D : E,
        E,
        (bf && E !== I) || (hf && E !== C) ? F : E,
        dh ? D : E,
        (dh && E !== I) || (hf && E !== G) ? H : E,
        hf ? F : E,
      ];
      for (let k = 0; k < 9; k++) od[(y * 3 + Math.floor(k / 3)) * w * 3 + x * 3 + (k % 3)] = px[k];
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}
