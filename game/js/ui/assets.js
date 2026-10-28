import { SPECIES_LIST } from '../data/species.js';
import { EGG_TIERS } from '../data/eggs.js';
import { SPRITES } from '../data/sprites.js';
import { DECOR } from '../data/decor.js';
import { Rng } from '../core/rng.js';

// Copy of pixel_bugs/palette.txt, used only if the file cannot be fetched.
const FALLBACK_PALETTE = {
  K: '#1a1c2c', k: '#333c57', s: '#566c86', l: '#94b0c2', W: '#f4f4f4', R: '#b13e53', r: '#ef7d57', Y: '#ffcd75',
  G: '#38b764', g: '#a7f070', T: '#257179', b: '#3b5dc9', c: '#41a6f6', C: '#73eff7', P: '#5d275d', N: '#7a4a2a',
  n: '#b07a4a', p: '#f4a0b0', v: '#c06ad8', m: '#ff5fa8', f: '#ff9b3d', y: '#fff07a', i: '#d6f6ff', V: '#2b1b4a',
};
const MAP_LAYERS = ['BugsMap/pixil-layer-0.png', 'BugsMap/pixil-layer-1.png'];

// The redrawn river: RIVER.k pixels for every pixel of its art, with `pad`
// pixels of bank around it.
const RIVER = {
  k: 3, pad: 8,
  colors: {
    foam: '#e8fbff', shallow: '#73eff7', sandy: '#a8e8d8', mid: '#41a6f6', deep: '#3b7fd9', deepest: '#3b5dc9',
    mud: '#4f3a2a', soil: '#6e5236', sand: '#c99a62', sandLight: '#d8ad74', pebble: '#94b0c2', pebbleDark: '#566c86',
    stone: '#7d8a99', stoneLight: '#b9c7d2', stoneDark: '#4a5566',
    pad: '#38b764', padLight: '#a7f070', padDark: '#257179', flower: '#f4a0b0', flowerMid: '#fff07a',
    reed: '#38b764', reedDark: '#257179', reedLight: '#a7f070', cattail: '#7a4a2a',
  },
};

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
  spots: (x, y, v) => ([[6, 4], [7, 4], [9, 7], [10, 7], [5, 9], [6, 9], [9, 11], [8, 11], [11, 9], [12, 9], [6, 12], [7, 12]].some(([a, b]) => a === x && b === y) ? v.mark : null),
  stripes: (x, y, v) => (y === 5 || y === 8 || y === 11 ? v.mark : null),
  zigzag: (x, y, v) => (y === 6 + ((x >> 1) % 2) || y === 10 + ((x >> 1) % 2) ? v.mark : null),
  stars: (x, y, v) => ([[7, 4], [10, 8], [5, 10], [9, 12]].some(([a, b]) => (Math.abs(a - x) + Math.abs(b - y) === 1) || (a === x && b === y)) ? v.mark : null),
  swirl: (x, y, v) => (((x * 2 + y * 3) % 7 < 2) ? (y % 2 ? v.mark : v.mark2 || v.mark) : null),
  constellation: (x, y, v) => {
    if ([[6, 4], [9, 6], [4, 8], [10, 10], [7, 12], [12, 8]].some(([a, b]) => a === x && b === y)) return v.mark;
    if ([[7, 5], [8, 5], [5, 7], [8, 11], [9, 11], [11, 6], [10, 13]].some(([a, b]) => a === x && b === y)) return v.mark2;
    return null;
  },
};
// One step darker for each palette colour, used to carry egg patterns into
// the shaded side of the shell.
const DARKER = { W: 'l', l: 's', s: 'k', k: 'K', K: 'K', R: 'P', r: 'R', Y: 'r', G: 'T', g: 'G', T: 'k', b: 'k', c: 'b', C: 'c', P: 'K', N: 'K', n: 'N', p: 'R' };
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
    this.decor = {};
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
      ...DECOR.filter((d) => d.sprite).map((d) => soft(d.sprite, (img) => { this.decor[d.id] = img; })),
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
    if (this.decor.river) {
      this.riverWater = this.waterCells(this.decor.river);
      this.river = this.makeRiver(this.decor.river);
    }
    if (this.missing.length) console.warn('Missing assets (fallbacks used):', this.missing);
  }

  // 8x sprites are exact nearest-neighbour upscales of their art: usually
  // 16x16, but a big bug can be drawn larger (the Atlas Moth is 32x32).
  downscale(img) {
    const c = makeCanvas(Math.max(1, Math.round(img.width / 8)), Math.max(1, Math.round(img.height / 8)));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  paint(rows, remap = {}) {
    const c = makeCanvas(rows[0]?.length || 16, rows.length || 16);
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

  // Albino: pale whites and greys, with red eyes: the marked eye pixels
  // when the Studio gave it some ([x, y] pairs), or else a best guess.
  albino(src, view, eyes = null) {
    return this.mapPixels(src, (px, { W }) => {
      for (const p of px) if (!p.outline) p.set = hexRgb(ALBINO_RAMP[Math.min(ALBINO_RAMP.length - 1, Math.floor(lum(...p.rgb) * ALBINO_RAMP.length))]);
      const marked = eyes?.length ? new Set(eyes.map(([x, y]) => `${x},${y}`)) : null;
      const red = marked ? px.filter((p) => marked.has(`${p.x},${p.y}`)) : findEyes(px, W, view);
      for (const p of red) p.set = hexRgb(ALBINO_EYE);
    });
  }

  // Where a bug's Albino eyes are now: its marks, or the best guess.
  eyesOf(species) {
    if (this.eyeMarks?.[species]?.length) return this.eyeMarks[species];
    let guess = [];
    const view = SPECIES_LIST.find((s) => s.id === species)?.view;
    this.mapPixels(this.bugs[species], (px, { W }) => { guess = findEyes(px, W, view).map((p) => [p.x, p.y]); });
    return guess;
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
    const art = thinOutline(scale3x(this.cropToContent(this.sprites.rock)), this.palette.K);
    this.rockScale = targetWidth / art.width;
    return art;
  }

  // Builds an egg (plus three cracked stages) from the tier's visual config.
  // The shell's lit side takes the base colour; the shaded side ('3') takes
  // the shade colour, dithered where the two meet. Bands, gems and patterns
  // run across both, one step darker in the shade.
  makeEgg(v) {
    const T = SPRITES.egg;
    const lit = (x, y) => T[y]?.[x] === '1' || T[y]?.[x] === '2' || T[y]?.[x] === 'W';
    const rows = T.map((row, y) => [...row].map((ch, x) => {
      if (ch !== '1' && ch !== '2' && ch !== '3') return ch;
      const shaded = ch === '3';
      const dark = (c) => (shaded ? v.shadeMarks?.[c] || DARKER[c] || c : c);
      if (v.gem && y === 9 && (x === 7 || x === 8)) return dark(v.gem);
      if (v.band && y === 9) return dark(v.band);
      const mark = PATTERNS[v.pattern]?.(x, y, v);
      if (mark) return dark(mark) === v.shade ? mark : dark(mark);
      if (!shaded) return v.base;
      const edge = lit(x - 1, y) || lit(x, y - 1);
      return edge && (x + y) % 2 ? v.base : v.shade;
    }).join(''));
    const stages = [this.paint(rows)];
    const cracked = rows.map((r) => [...r]);
    for (const path of CRACK_PATHS) {
      for (const [x, y] of path) if (cracked[y][x] !== '.') cracked[y][x] = 'K';
      stages.push(this.paint(cracked.map((r) => r.join(''))));
    }
    return stages;
  }

  // The river, redrawn at RIVER.k times its art's resolution from its outline
  // (smoothed like the rock): foam at the shore, shallows shading to a deep
  // channel, a sandy bank with pebbles and reeds, lily pads and rocks. Seeded,
  // so it looks the same every time. Returns the picture (with `pad` pixels
  // of bank around the art's box) and the open water for the animation.
  makeRiver(img) {
    const { k: K, pad: PAD } = RIVER;
    const src = makeCanvas(img.width, img.height);
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const sd = sctx.getImageData(0, 0, img.width, img.height).data;
    const mask = makeCanvas(img.width, img.height);
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#fff';
    for (let i = 0; i < img.width * img.height; i++) if (sd[i * 4 + 3] > 127) mctx.fillRect(i % img.width, Math.floor(i / img.width), 1, 1);
    const smooth = scale3x(mask);
    const W = smooth.width + PAD * 2;
    const H = smooth.height + PAD * 2;
    const md = smooth.getContext('2d').getImageData(0, 0, smooth.width, smooth.height).data;
    const water = new Uint8Array(W * H);
    for (let y = 0; y < smooth.height; y++) for (let x = 0; x < smooth.width; x++) if (md[(y * smooth.width + x) * 4 + 3] > 127) water[(y + PAD) * W + x + PAD] = 1;
    // The art runs off the top and right of the map: so does the water.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = Math.min(smooth.width - 1, Math.max(0, x - PAD));
      const sy = Math.min(smooth.height - 1, Math.max(0, y - PAD));
      if ((y < PAD || x >= W - PAD) && md[(sy * smooth.width + sx) * 4 + 3] > 127) water[y * W + x] = 1;
    }
    // Distance to the shore, inside the water and out on the bank.
    const dist = (inside) => {
      const d = new Int16Array(W * H).fill(-1);
      const q = new Int32Array(W * H);
      let head = 0;
      let tail = 0;
      for (let i = 0; i < W * H; i++) if (water[i] !== inside) { d[i] = 0; q[tail++] = i; }
      while (head < tail) {
        const i = q[head++];
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= W * H || d[j] !== -1) continue;
          d[j] = d[i] + 1;
          q[tail++] = j;
        }
      }
      return d;
    };
    const dIn = dist(1);
    const dOut = dist(0);
    const rng = new Rng(4242);
    const hash = (x, y) => (Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0) / 4294967296;
    const C = Object.fromEntries(Object.entries(RIVER.colors).map(([kk, hex]) => [kk, hexRgb(hex)]));
    const out = new Uint8ClampedArray(W * H * 4);
    const put = (x, y, rgb) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2]; out[i + 3] = 255;
    };
    const chk = (x, y) => (x + y) % 2 === 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const h = hash(x, y);
        if (water[i]) {
          const d = dIn[i];
          let c;
          if (d <= 1) c = h < 0.18 ? C.shallow : C.foam;
          else if (d <= 3) c = h < 0.05 ? C.sandy : C.shallow;
          else if (d <= 5) c = chk(x, y) ? C.shallow : C.mid;
          else if (d <= 11) c = C.mid;
          else if (d <= 13) c = chk(x, y) ? C.mid : C.deep;
          else if (d <= 20) c = C.deep;
          else if (d <= 22) c = chk(x, y) ? C.deep : C.deepest;
          else c = C.deepest;
          put(x, y, c);
        } else {
          const d = dOut[i];
          if (d === 1) put(x, y, C.mud);
          else if (d === 2) put(x, y, h < 0.5 ? C.mud : C.soil);
          else if (d <= 4) put(x, y, h < 0.07 ? (h < 0.035 ? C.pebble : C.pebbleDark) : chk(x, y) ? C.sand : C.sandLight);
          else if (d === 5 && chk(x, y)) put(x, y, C.sand);
        }
      }
    }
    const open = new Uint8Array(W * H); // water free for the animation
    for (let i = 0; i < W * H; i++) open[i] = water[i] && dIn[i] >= 2 ? 1 : 0;
    const spots = (test, n, gap) => {
      const got = [];
      for (let tries = 0; got.length < n && tries < n * 400; tries++) {
        const x = rng.int(0, W - 1);
        const y = rng.int(0, H - 1);
        if (test(y * W + x) && got.every(([gx, gy]) => Math.hypot(gx - x, gy - y) > gap)) got.push([x, y]);
      }
      return got;
    };
    // Rocks breaking the surface, with foam around them.
    for (const [cx, cy] of spots((i) => water[i] && dIn[i] >= 9 && dIn[i] <= 18, 4, 34)) {
      const r = rng.int(3, 6);
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const dd = Math.hypot(x, y * 1.3);
        const i = (cy + y) * W + cx + x;
        if (dd <= r) {
          put(cx + x, cy + y, x + y < -r * 0.5 ? C.stoneLight : x + y > r * 0.6 ? C.stoneDark : C.stone);
          open[i] = 0;
        } else if (dd <= r + 1.2 && water[i]) { put(cx + x, cy + y, C.foam); open[i] = 0; }
      }
    }
    // Lily pads, some flowering.
    for (const [cx, cy] of spots((i) => open[i] && dIn[i] >= 7 && dIn[i] <= 18, 9, 20)) {
      const r = rng.int(5, 7);
      const notch = rng.float(0, Math.PI * 2);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        if (Math.hypot(x, y * 1.2) > r) continue;
        const a = Math.atan2(y, x);
        if (Math.abs(((a - notch + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.4 && Math.hypot(x, y) > 0.5) continue;
        put(cx + x, cy + y, x + y < -1 ? C.padLight : x + y > 2 ? C.padDark : C.pad);
        open[(cy + y) * W + cx + x] = 0;
      }
      // A thin dark rim so the pad reads against the water.
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const dd = Math.hypot(x, y * 1.2);
        if (dd > r && dd <= r + 1 && open[(cy + y) * W + cx + x]) { put(cx + x, cy + y, C.padDark); open[(cy + y) * W + cx + x] = 0; }
      }
      if (rng.chance(0.45)) {
        put(cx, cy, C.flowerMid);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) put(cx + dx, cy + dy, C.flower);
        put(cx, cy - 2, C.flower);
      }
    }
    // Reeds and cattails along the bank.
    for (const [cx, cy] of spots((i) => !water[i] && dOut[i] >= 2 && dOut[i] <= 4, 16, 9)) {
      const blades = rng.int(3, 5);
      for (let b = 0; b < blades; b++) {
        const x0 = cx + b - Math.floor(blades / 2);
        const tall = rng.int(6, 12);
        const lean = rng.float(-0.25, 0.25);
        for (let t = 0; t < tall; t++) put(Math.round(x0 + lean * t), cy - t, t > tall - 3 ? C.reedLight : b % 2 ? C.reedDark : C.reed);
        if (rng.chance(0.35)) for (let t = 0; t < 3; t++) put(Math.round(x0 + lean * (tall + t)), cy - tall - t, C.cattail);
      }
    }
    const art = makeCanvas(W, H);
    art.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
    const cells = [];
    for (let i = 0; i < W * H; i++) if (open[i]) cells.push([i % W, Math.floor(i / W)]);
    const surfaceMask = makeCanvas(W, H);
    const sm = surfaceMask.getContext('2d');
    sm.fillStyle = '#fff';
    for (const [x, y] of cells) sm.fillRect(x, y, 1, 1);
    return { art, w: W, h: H, k: K, pad: PAD, cells, mask: surfaceMask };
  }

  // The river's water pixels (its most common colour), for animating waves
  // and glitter on top of the sprite.
  waterCells(img) {
    const c = makeCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) counts.set(d[i] << 16 | d[i + 1] << 8 | d[i + 2], (counts.get(d[i] << 16 | d[i + 1] << 8 | d[i + 2]) || 0) + 1);
    const water = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const cells = [];
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3] && (d[i] << 16 | d[i + 1] << 8 | d[i + 2]) === water) cells.push([x, y]);
      }
    }
    return { w: c.width, h: c.height, cells, set: new Set(cells.map(([x, y]) => y * c.width + x)) };
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

  // A bug's current art as rows of palette characters ('.' transparent), for
  // the sprite editor. Colours off the palette snap to the nearest one.
  rowsOf(species) {
    const src = this.bugs[species];
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const pal = Object.entries(this.palette).map(([ch, hex]) => [ch, hexRgb(hex)]);
    const nearest = (r, g, b) => pal.reduce((best, [ch, [pr, pg, pb]]) => {
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      return dist < best[1] ? [ch, dist] : best;
    }, ['K', Infinity])[0];
    const rows = [];
    for (let y = 0; y < c.height; y++) {
      let row = '';
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        row += d[i + 3] < 128 ? '.' : this.byRgb.get(`${d[i]},${d[i + 1]},${d[i + 2]}`) || nearest(d[i], d[i + 1], d[i + 2]);
      }
      rows.push(row);
    }
    return rows;
  }

  // Approved sprite fixes from the studio: { species: { rows, eyes } } (or
  // just rows, from older saves). Species left out go back to their original
  // art. Returns the species that changed.
  setOverrides(map) {
    this.originals = this.originals || {};
    this.eyeMarks = this.eyeMarks || {};
    const changed = [];
    for (const id of new Set([...Object.keys(map), ...Object.keys(this.originals)])) {
      if (!this.bugs[id] && !this.originals[id]) continue;
      const fix = Array.isArray(map[id]) ? { rows: map[id], eyes: [] } : map[id];
      const key = fix ? `${fix.rows.join('')}|${JSON.stringify(fix.eyes || [])}` : null;
      if ((this.overrideKeys?.[id] || null) === key) continue;
      if (!this.originals[id]) this.originals[id] = this.bugs[id];
      this.bugs[id] = key ? this.paint(fix.rows) : this.originals[id];
      this.eyeMarks[id] = fix?.eyes?.length ? fix.eyes : null;
      if (!key) delete this.originals[id];
      this.overrideKeys = { ...this.overrideKeys, [id]: key };
      for (const k of Object.keys(this.variants)) if (k.startsWith(`${id}:`)) delete this.variants[k];
      for (const k of [...this.urls.keys()]) if (k.startsWith(`bug:${id}:`)) this.urls.delete(k);
      changed.push(id);
    }
    return changed;
  }

  // A decoration's shape as a flat dark silhouette, for its shadow.
  silhouette(id) {
    this.silhouettes = this.silhouettes || {};
    if (!this.silhouettes[id]) {
      const art = this.decor[id];
      const c = makeCanvas(art.width, art.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(art, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(0, 0, c.width, c.height);
      this.silhouettes[id] = c;
    }
    return this.silhouettes[id];
  }

  // A data URL for any rows (studio thumbnails), cached by content.
  rowsUrl(rows, variant = null, eyes = null) {
    const key = `rows:${variant}:${rows.join('')}:${JSON.stringify(eyes || [])}`;
    if (!this.urls.has(key)) {
      const art = this.paint(rows);
      this.urls.set(key, (variant ? (variant === 'albino' ? this.albino(art, 'top', eyes) : this[variant](art)) : art).toDataURL());
    }
    return this.urls.get(key);
  }

  // Rainbow effect: the bug with every colour turned k/12 of the way round
  // the colour wheel (done by hand: canvas filters don't work everywhere).
  hueFrame(species, variant, k) {
    const key = `${species}:${variant}:hue${k}`;
    if (!this.variants[key]) {
      const turn = k / 12;
      this.variants[key] = this.mapPixels(this.bug(species, variant), (px) => {
        for (const p of px) {
          if (p.outline) continue;
          const [h, s, l] = rgbToHsl(...p.rgb);
          if (s < 0.08) continue; // greys and whites stay put
          p.set = hslToRgb((h + turn) % 1, s, l);
        }
      });
    }
    return this.variants[key];
  }

  // Glitch effect: the bug as a flat red and a flat cyan silhouette.
  glitchGhosts(species, variant) {
    const key = `${species}:${variant}:glitch`;
    if (!this.variants[key]) {
      const src = this.bug(species, variant);
      this.variants[key] = [[255, 40, 90], [40, 240, 255]].map((rgb) => this.mapPixels(src, (px) => { for (const p of px) p.set = rgb; }));
    }
    return this.variants[key];
  }

  // variant: null | 'shiny' | 'albino' | 'golden'
  bug(species, variant = null) {
    if (!variant) return this.bugs[species];
    const key = `${species}:${variant}`;
    if (!this.variants[key]) {
      const view = SPECIES_LIST.find((s) => s.id === species)?.view;
      this.variants[key] = variant === 'albino' ? this.albino(this.bugs[species], view, this.eyeMarks?.[species]) : this[variant](this.bugs[species]);
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

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

// Scale3x / AdvMAME3x pixel-art upscaler: every pixel becomes a 3x3 block,
// with corners taken from matching neighbours so diagonals stay smooth.
// Thins a sprite's outline (colour `hex`) to one pixel: outline pixels with
// no transparent neighbour take the colour of the stone just inside them.
function thinOutline(c, hex) {
  const w = c.width;
  const h = c.height;
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const d = new Uint32Array(img.data.buffer);
  const n = parseInt(hex.slice(1), 16);
  const ink = (0xff << 24 | (n & 0xff) << 16 | (n & 0xff00) | n >> 16) >>> 0; // ABGR, as the canvas stores it
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let pass = 0; pass < 3; pass++) {
    const next = d.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[y * w + x] !== ink) continue;
        if (N4.some(([dx, dy]) => (at(x + dx, y + dy) >>> 24) === 0)) continue;
        const fill = N4.map(([dx, dy]) => at(x + dx, y + dy)).find((v) => v >>> 24 && v !== ink);
        if (fill) next[y * w + x] = fill;
      }
    }
    d.set(next);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

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
