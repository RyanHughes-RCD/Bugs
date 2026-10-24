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

// Hue-rotates a sprite for shiny variants, leaving outlines and greys alone.
function shinify(src) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [r, g, b] = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 0.12) continue;
    const l = (max + min) / 2;
    const s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    let h = max === r ? (g - b) / (max - min) + (g < b ? 6 : 0) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    h = (h / 6 + 0.42) % 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    d[i] = hue(h + 1 / 3) * 255;
    d[i + 1] = hue(h) * 255;
    d[i + 2] = hue(h - 1 / 3) * 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

// Pattern painters for generated eggs: return a palette char or null per pixel.
const PATTERNS = {
  speckles: (x, y, v) => (((x * 7 + y * 13) % 11 === 0) ? v.mark : null),
  spots: (x, y, v) => ([[6, 4], [7, 4], [9, 7], [10, 7], [5, 9], [6, 9], [9, 11], [8, 11]].some(([a, b]) => a === x && b === y) ? v.mark : null),
  stripes: (x, y, v) => (y === 5 || y === 8 || y === 11 ? v.mark : null),
  zigzag: (x, y, v) => (y === 6 + ((x >> 1) % 2) || y === 10 + ((x >> 1) % 2) ? v.mark : null),
  stars: (x, y, v) => ([[6, 5], [10, 8], [6, 11]].some(([a, b]) => (Math.abs(a - x) + Math.abs(b - y) === 1) || (a === x && b === y)) ? v.mark : null),
  swirl: (x, y, v) => (((x * 2 + y * 3) % 7 < 2) ? (y % 2 ? v.mark : v.mark2 || v.mark) : null),
};
const CRACK_PATHS = [
  [[7, 3], [7, 4], [6, 5]],
  [[5, 6], [4, 7], [8, 5], [9, 6]],
  [[10, 7], [11, 8], [6, 7], [7, 8], [8, 7]],
];

export class Assets {
  constructor() {
    this.palette = { ...FALLBACK_PALETTE };
    this.bugs = {};
    this.shinyBugs = {};
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

    for (const [id, rows] of Object.entries(SPRITES)) this.sprites[id] = this.paint(rows);
    const fallbackBug = this.paint(SPRITES.star);
    const soft = (src, fn) => loadImage(src).then(fn, () => { this.missing.push(src); });
    const jobs = [
      ...MAP_LAYERS.map((src, i) => soft(src, (img) => { this.map[i] = img; })),
      ...SPECIES_LIST.map((s) => soft(s.sprite, (img) => { this.bugs[s.id] = this.downscale(img); })),
      ...EGG_TIERS.filter((t) => t.sprite).map((t) => soft(t.sprite, (img) => { this.eggs[t.id] = [this.downscale(img)]; })),
    ];
    let done = 0;
    await Promise.all(jobs.map((j) => j.then(() => onProgress(++done / jobs.length))));
    for (const s of SPECIES_LIST) if (!this.bugs[s.id]) this.bugs[s.id] = fallbackBug;
    for (const t of EGG_TIERS) if (!this.eggs[t.id]) this.eggs[t.id] = this.makeEgg(t.visual);
    if (this.map[0]) this.flowerSpots = this.findFlowers(this.map[0]);
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

  // Builds an egg (plus three cracked stages) from the tier's visual config.
  makeEgg(v) {
    const rows = SPRITES.egg.map((row, y) => [...row].map((ch, x) => {
      if (ch === '3') return v.shade;
      if (ch !== '1' && ch !== '2') return ch;
      if (v.band && y === 9) return v.band;
      if (v.gem && y >= 9 && y <= 9 && (x === 7 || x === 8)) return v.gem;
      return PATTERNS[v.pattern]?.(x, y, v) || v.base;
    }).join(''));
    if (v.gem) rows[8] = rows[8].slice(0, 7) + v.gem + rows[8].slice(8);
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

  bug(species, shiny = false) {
    if (!shiny) return this.bugs[species];
    if (!this.shinyBugs[species]) this.shinyBugs[species] = shinify(this.bugs[species]);
    return this.shinyBugs[species];
  }

  url(key, canvas) {
    if (!this.urls.has(key)) this.urls.set(key, canvas.toDataURL());
    return this.urls.get(key);
  }

  bugUrl(species, shiny = false) {
    return this.url(`bug:${species}:${shiny}`, this.bug(species, shiny));
  }

  spriteUrl(id) {
    return this.url(`sprite:${id}`, this.sprites[id] || this.sprites.star);
  }

  eggUrl(tier, stage = 0) {
    const stages = this.eggs[tier];
    return this.url(`egg:${tier}:${stage}`, stages[Math.min(stage, stages.length - 1)]);
  }
}
