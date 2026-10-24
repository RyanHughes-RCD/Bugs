import { SPECIES_LIST } from '../data/species.js';
import { EGGS } from '../data/eggs.js';
import { SPRITES } from '../data/sprites.js';

// Copy of pixel_bugs/palette.txt, used only if the file cannot be fetched.
const FALLBACK_PALETTE = {
  K: '#1a1c2c', k: '#333c57', s: '#566c86', l: '#94b0c2', W: '#f4f4f4', R: '#b13e53', r: '#ef7d57', Y: '#ffcd75',
  G: '#38b764', g: '#a7f070', T: '#257179', b: '#3b5dc9', c: '#41a6f6', C: '#73eff7', P: '#5d275d', N: '#7a4a2a',
  n: '#b07a4a', p: '#f4a0b0',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function canvas16(w = 16, h = 16) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Rotates hue for shiny variants while leaving outlines and greys alone.
function shinify(src) {
  const c = canvas16(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [r, g, b] = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max - min < 0.12) continue;
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

export class Assets {
  constructor() {
    this.palette = { ...FALLBACK_PALETTE };
    this.bugs = {};      // species -> 16x16 canvas
    this.shinyBugs = {};
    this.sprites = {};   // item/icon id -> 16x16 canvas
    this.eggs = {};      // egg type -> 16x16 canvas
    this.urls = new Map();
    this.map = [];
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
    } catch { /* fallback palette already set */ }

    const jobs = [
      ...['BugsMap/pixil-layer-0.png', 'BugsMap/pixil-layer-1.png'].map((src, i) => loadImage(src).then((img) => { this.map[i] = img; })),
      ...SPECIES_LIST.map((s) => loadImage(s.sprite).then((img) => { this.bugs[s.id] = this.downscale(img); })),
      loadImage('8x/chrysalis.png').then((img) => { this.chrysalis = this.downscale(img); }),
    ];
    let done = 0;
    await Promise.all(jobs.map((j) => j.then(() => onProgress(++done / jobs.length))));

    for (const [id, rows] of Object.entries(SPRITES)) if (id !== 'egg') this.sprites[id] = this.paint(rows);
    for (const [type, egg] of Object.entries(EGGS)) {
      this.eggs[type] = egg.sprite ? this.chrysalis : this.paint(SPRITES.egg, egg.colors);
    }
  }

  // The 8x sprites are exact nearest-neighbour upscales, so this is lossless.
  downscale(img) {
    const c = canvas16();
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 16, 16);
    return c;
  }

  paint(rows, remap = {}) {
    const c = canvas16();
    const ctx = c.getContext('2d');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const hex = this.palette[remap[ch] || ch];
        if (!hex) return;
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, 1, 1);
      });
    });
    return c;
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
    return shiny ? this.url(`shiny:${species}`, this.bug(species, true)) : `8x/${species}.png`;
  }

  spriteUrl(id) {
    return this.url(`sprite:${id}`, this.sprites[id]);
  }

  eggUrl(type) {
    return this.url(`egg:${type}`, this.eggs[type]);
  }

  rgb(ch) {
    return hexToRgb(this.palette[ch]);
  }
}
