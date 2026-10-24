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
