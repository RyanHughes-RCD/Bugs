import { Rng, hashSeed } from '../core/rng.js';

// Area banners. An area with art.image uses that project art; otherwise a
// small pixel scene is generated in the shared palette as a fallback.
const W = 96;
const H = 40;

function px(ctx, pal, ch, x, y, w = 1, h = 1) {
  ctx.fillStyle = pal[ch] || ch;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

const PAINTERS = {
  garden(ctx, pal, rng) {
    px(ctx, pal, 'G', 0, 0, W, H);
    for (let i = 0; i < 80; i++) px(ctx, pal, 'g', rng.int(0, W), rng.int(0, H), 2, 1);
    for (let i = 0; i < 10; i++) { const x = rng.int(2, W - 3); const y = rng.int(2, H - 3); px(ctx, pal, 'p', x - 1, y, 3, 1); px(ctx, pal, 'p', x, y - 1, 1, 3); px(ctx, pal, 'Y', x, y); }
  },
  forest(ctx, pal, rng) {
    px(ctx, pal, 'T', 0, 0, W, H);
    for (let i = 0; i < 10; i++) {
      const x = rng.int(0, W - 6);
      const w = rng.int(3, 7);
      px(ctx, pal, 'N', x, 0, w, H);
      px(ctx, pal, 'n', x + 1, 0, 1, H);
    }
    for (let i = 0; i < 40; i++) px(ctx, pal, rng.pick(['G', 'T', 'k']), rng.int(-4, W), rng.int(0, 12), rng.int(4, 10), rng.int(2, 4));
    for (let i = 0; i < 16; i++) { const x = rng.int(0, W); const y = rng.int(0, H); px(ctx, pal, 'G', x, y, 1, rng.int(4, 12)); }
    ctx.globalAlpha = 0.35;
    for (let y = 14; y < H; y += 7) px(ctx, pal, 'l', 0, y + rng.int(-1, 1), W, 3);
    ctx.globalAlpha = 1;
    px(ctx, pal, 'k', 0, H - 5, W, 5);
  },
  caves(ctx, pal, rng) {
    px(ctx, pal, 'K', 0, 0, W, H);
    for (let x = 0; x < W; x++) {
      const top = 4 + Math.round(3 * Math.sin(x / 6) + rng.int(0, 2));
      const bot = H - 6 - Math.round(2 * Math.sin(x / 9 + 1));
      px(ctx, pal, 'k', x, 0, 1, top);
      px(ctx, pal, 'k', x, bot, 1, H - bot);
      if (x % 9 === 3) px(ctx, pal, 's', x, top, 1, rng.int(2, 5));
    }
    for (let i = 0; i < 8; i++) {
      const x = rng.int(4, W - 6);
      const h = rng.int(5, 11);
      const c = rng.pick(['C', 'c', 'p']);
      for (let k = 0; k < h; k++) px(ctx, pal, c, x + Math.floor(k / 4), H - 6 - k, 2, 1);
      px(ctx, pal, 'W', x, H - 6 - h, 1, 1);
    }
    for (let i = 0; i < 20; i++) px(ctx, pal, rng.pick(['C', 'p']), rng.int(0, W), rng.int(8, H - 8), 1, 1);
  },
  volcano(ctx, pal, rng) {
    px(ctx, pal, 'P', 0, 0, W, 10);
    px(ctx, pal, 'R', 0, 10, W, 8);
    for (let x = 0; x < W; x++) {
      const h = Math.max(0, 30 - Math.abs(x - 48) * 0.9);
      px(ctx, pal, 'k', x, H - h, 1, h);
    }
    px(ctx, pal, 'r', 44, 10, 8, 3);
    for (let y = 12; y < H; y++) px(ctx, pal, rng.chance(0.5) ? 'r' : 'Y', 47 + Math.round(Math.sin(y / 3) * 2), y, 2, 1);
    px(ctx, pal, 'K', 0, H - 4, W, 4);
    for (let x = 0; x < W; x += 1) if (rng.chance(0.3)) px(ctx, pal, rng.pick(['r', 'Y', 'R']), x, H - 3, 1, 1);
    for (let i = 0; i < 14; i++) px(ctx, pal, 'Y', rng.int(30, 66), rng.int(0, 12), 1, 1);
  },
  aether(ctx, pal, rng) {
    for (let y = 0; y < H; y++) px(ctx, pal, y < 12 ? 'P' : y < 24 ? 'b' : 'c', 0, y, W, 1);
    for (let i = 0; i < 26; i++) px(ctx, pal, 'W', rng.int(0, W), rng.int(0, 20), 1, 1);
    for (let i = 0; i < 4; i++) {
      const x = rng.int(4, W - 24);
      const y = rng.int(14, H - 10);
      const w = rng.int(12, 20);
      px(ctx, pal, 'G', x, y, w, 2);
      px(ctx, pal, 'g', x + 1, y, w - 2, 1);
      for (let k = 0; k < 4; k++) px(ctx, pal, 'N', x + 2 + k, y + 2 + k, w - 4 - k * 2, 1);
    }
    for (let i = 0; i < 6; i++) px(ctx, pal, 'W', rng.int(0, W - 10), rng.int(20, H - 2), rng.int(6, 12), 2);
  },
  chem(ctx, pal, rng) {
    // Dim sky, a rusting factory with smokestacks, glowing spills and hazard stripes.
    px(ctx, pal, 'k', 0, 0, W, H);
    for (let i = 0; i < 6; i++) px(ctx, pal, 's', rng.int(0, W), rng.int(0, 10), rng.int(8, 16), 2);
    px(ctx, pal, 'K', 6, 14, 54, 20);
    px(ctx, pal, 'K', 64, 18, 26, 16);
    for (const [x, h] of [[12, 12], [22, 16], [72, 10]]) { px(ctx, pal, 'K', x, 14 - h, 4, h); px(ctx, pal, 'R', x, 14 - h + 2, 4, 1); }
    for (let i = 0; i < 9; i++) px(ctx, pal, rng.chance(0.4) ? 'y' : 's', 10 + i * 5, 20 + (i % 2) * 6, 2, 2);
    for (let i = 0; i < 12; i++) px(ctx, pal, 'l', rng.int(10, 30), rng.int(0, 6), 2, 1);
    px(ctx, pal, 's', 0, H - 6, W, 6);
    for (let i = 0; i < 4; i++) { const x = rng.int(4, W - 18); px(ctx, pal, 'G', x, H - 4, rng.int(8, 14), 2); px(ctx, pal, 'g', x + 2, H - 4, 4, 1); }
    for (let x = 0; x < W; x += 6) { px(ctx, pal, 'Y', x, H - 7, 3, 1); px(ctx, pal, 'K', x + 3, H - 7, 3, 1); }
    for (let i = 0; i < 3; i++) { const x = rng.int(60, W - 8); px(ctx, pal, 'g', x, H - 13, 5, 6); px(ctx, pal, 'K', x, H - 11, 5, 1); }
  },
  void(ctx, pal, rng) {
    // Deep dark, scattered stars, a swirling rift and drifting fragments.
    px(ctx, pal, 'V', 0, 0, W, H);
    for (let i = 0; i < 40; i++) px(ctx, pal, rng.pick(['W', 'v', 'i']), rng.int(0, W), rng.int(0, H), 1, 1);
    for (let r = 14; r > 2; r -= 3) {
      for (let a = 0; a < 40; a++) {
        const t = (a / 40) * Math.PI * 2 + r * 0.4;
        px(ctx, pal, r % 2 ? 'P' : 'v', 48 + Math.cos(t) * r * 1.6, 20 + Math.sin(t) * r * 0.8, 1, 1);
      }
    }
    px(ctx, pal, 'K', 46, 19, 5, 3);
    for (let i = 0; i < 5; i++) { const x = rng.int(0, W - 10); const y = rng.int(4, H - 6); px(ctx, pal, 'k', x, y, rng.int(4, 9), 2); px(ctx, pal, 's', x + 1, y, 2, 1); }
  },
  new_jersey(ctx, pal, rng) {
    // A turnpike under a hazy sky, a far-off skyline, marsh reeds and gulls.
    for (let y = 0; y < 22; y++) px(ctx, pal, y < 8 ? 'c' : y < 16 ? 'C' : 'p', 0, y, W, 1);
    for (let x = 0; x < W;) { const w = rng.int(3, 7); const h = rng.int(4, 12); px(ctx, pal, 's', x, 22 - h, w, h); if (rng.chance(0.4)) px(ctx, pal, 'Y', x + 1, 22 - h + 2, 1, 1); x += w + rng.int(0, 2); }
    px(ctx, pal, 'G', 0, 22, W, 6);
    for (let i = 0; i < 30; i++) px(ctx, pal, rng.pick(['g', 'T', 'N']), rng.int(0, W), rng.int(20, 27), 1, rng.int(2, 4));
    px(ctx, pal, 'k', 0, 28, W, 12);
    for (let x = 2; x < W; x += 8) px(ctx, pal, 'Y', x, 33, 4, 1);
    for (let i = 0; i < 4; i++) { const x = rng.int(0, W - 8); px(ctx, pal, rng.pick(['R', 'b', 'W', 'Y']), x, rng.chance(0.5) ? 30 : 35, 6, 3); }
    for (let i = 0; i < 4; i++) { const x = rng.int(4, W - 6); const y = rng.int(2, 8); px(ctx, pal, 'W', x, y, 1, 1); px(ctx, pal, 'W', x + 1, y - 1, 1, 1); px(ctx, pal, 'W', x + 2, y, 1, 1); }
  },
};

const cache = new Map();

export function sceneUrl(sceneId, palette) {
  if (cache.has(sceneId)) return cache.get(sceneId);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  (PAINTERS[sceneId] || PAINTERS.garden)(c.getContext('2d'), palette, new Rng(hashSeed('scene', sceneId)));
  const url = c.toDataURL();
  cache.set(sceneId, url);
  return url;
}

// CSS background for an area banner.
export function areaBackground(area, A) {
  if (area.art.image && A.map.length) return `background-image:url(BugsMap/pixil-layer-1.png),url(${area.art.image});background-size:cover;background-position:center 58%`;
  return `background-image:url(${sceneUrl(area.art.scene, A.palette)})`;
}
