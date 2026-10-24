import { Rng, hashSeed } from '../core/rng.js';

// Small procedural pixel-art banners for each expedition area, drawn with the
// shared palette and scaled up with image-rendering: pixelated.
const W = 96;
const H = 40;

function px(ctx, pal, ch, x, y, w = 1, h = 1) {
  ctx.fillStyle = pal[ch] || ch;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

const PAINTERS = {
  meadow(ctx, pal, rng) {
    px(ctx, pal, 'c', 0, 0, W, 14);
    px(ctx, pal, 'C', 0, 10, W, 4);
    px(ctx, pal, 'W', 12, 4, 10, 2); px(ctx, pal, 'W', 15, 3, 5, 1);
    px(ctx, pal, 'W', 60, 6, 12, 2); px(ctx, pal, 'W', 63, 5, 6, 1);
    for (let x = 0; x < W; x++) {
      const hill = 14 + Math.round(3 * Math.sin(x / 11) + 2 * Math.sin(x / 5 + 1));
      px(ctx, pal, 'G', x, hill, 1, H - hill);
      px(ctx, pal, 'g', x, hill, 1, 1);
    }
    for (let i = 0; i < 60; i++) px(ctx, pal, rng.pick(['g', 'T']), rng.int(0, W), rng.int(20, H), 1, 1);
    for (let i = 0; i < 18; i++) {
      const x = rng.int(2, W - 3);
      const y = rng.int(21, H - 3);
      px(ctx, pal, 'T', x, y + 1, 1, 2);
      const c = rng.pick(['p', 'W', 'Y', 'R']);
      px(ctx, pal, c, x - 1, y, 3, 1); px(ctx, pal, c, x, y - 1, 1, 3); px(ctx, pal, 'Y', x, y, 1, 1);
    }
  },
  pond(ctx, pal, rng) {
    px(ctx, pal, 'C', 0, 0, W, 12);
    px(ctx, pal, 'G', 0, 10, W, 6);
    px(ctx, pal, 'b', 0, 15, W, H - 15);
    for (let i = 0; i < 30; i++) px(ctx, pal, 'c', rng.int(0, W), rng.int(16, H), rng.int(2, 6), 1);
    for (let i = 0; i < 7; i++) {
      const x = rng.int(4, W - 10);
      const y = rng.int(19, H - 5);
      px(ctx, pal, 'G', x, y, 8, 3); px(ctx, pal, 'g', x + 1, y, 5, 1); px(ctx, pal, 'b', x + 5, y + 1, 2, 1);
      if (rng.chance(0.4)) { px(ctx, pal, 'p', x + 2, y - 1, 3, 1); px(ctx, pal, 'W', x + 3, y - 2, 1, 1); }
    }
    for (let i = 0; i < 9; i++) {
      const x = rng.int(0, W);
      const h = rng.int(8, 14);
      px(ctx, pal, 'T', x, 16 - h + 6, 1, h);
      px(ctx, pal, 'N', x, 16 - h + 4, 1, 3);
    }
  },
  woods(ctx, pal, rng) {
    px(ctx, pal, 'T', 0, 0, W, H);
    px(ctx, pal, 'k', 0, 0, W, 6);
    for (let i = 0; i < 9; i++) {
      const x = rng.int(0, W - 6);
      const w = rng.int(4, 8);
      px(ctx, pal, 'N', x, 0, w, H - 8);
      px(ctx, pal, 'n', x + 1, 0, 1, H - 8);
    }
    for (let i = 0; i < 40; i++) px(ctx, pal, rng.pick(['G', 'T', 'k']), rng.int(0, W), rng.int(0, 10), rng.int(3, 8), rng.int(2, 4));
    px(ctx, pal, 'N', 0, H - 9, W, 9);
    for (let i = 0; i < 50; i++) px(ctx, pal, rng.pick(['r', 'n', 'Y', 'R']), rng.int(0, W), rng.int(H - 9, H), 2, 1);
    for (let i = 0; i < 5; i++) {
      const x = rng.int(2, W - 6);
      px(ctx, pal, 'W', x + 1, H - 11, 1, 3);
      px(ctx, pal, 'R', x, H - 13, 3, 2); px(ctx, pal, 'W', x + 1, H - 13, 1, 1);
    }
  },
  dunes(ctx, pal, rng) {
    px(ctx, pal, 'r', 0, 0, W, 8);
    px(ctx, pal, 'Y', 0, 8, W, 8);
    px(ctx, pal, 'W', 74, 4, 8, 6); px(ctx, pal, 'Y', 75, 5, 6, 4);
    for (let x = 0; x < W; x++) {
      const back = 16 + Math.round(4 * Math.sin(x / 13));
      px(ctx, pal, 'n', x, back, 1, H - back);
      const front = 25 + Math.round(4 * Math.sin(x / 9 + 2));
      px(ctx, pal, 'Y', x, front, 1, H - front);
      px(ctx, pal, 'W', x, front, 1, 1);
    }
    for (let i = 0; i < 4; i++) {
      const x = rng.int(4, W - 6);
      const y = rng.int(16, 24);
      px(ctx, pal, 'G', x, y, 2, 10); px(ctx, pal, 'G', x - 2, y + 3, 2, 3); px(ctx, pal, 'G', x + 2, y + 2, 2, 3);
      px(ctx, pal, 'T', x + 1, y, 1, 10);
    }
    for (let i = 0; i < 30; i++) px(ctx, pal, 'r', rng.int(0, W), rng.int(26, H), 1, 1);
  },
  jungle(ctx, pal, rng) {
    px(ctx, pal, 'K', 0, 0, W, H);
    px(ctx, pal, 'P', 0, 0, W, 10);
    for (let i = 0; i < 30; i++) px(ctx, pal, 'W', rng.int(0, W), rng.int(0, 14), 1, 1);
    px(ctx, pal, 'W', 14, 3, 7, 7); px(ctx, pal, 'K', 17, 3, 5, 5); px(ctx, pal, 'P', 17, 3, 5, 5);
    for (let i = 0; i < 26; i++) {
      const x = rng.int(-4, W);
      const y = rng.int(10, H);
      const c = rng.pick(['T', 'G', 'T', 'k']);
      px(ctx, pal, c, x, y, rng.int(6, 12), rng.int(3, 6));
      px(ctx, pal, 'g', x + 2, y + 1, 3, 1);
    }
    for (let i = 0; i < 22; i++) px(ctx, pal, rng.pick(['C', 'Y', 'g']), rng.int(0, W), rng.int(8, H), 1, 1);
  },
};

const cache = new Map();

export function areaSceneUrl(areaId, palette) {
  if (cache.has(areaId)) return cache.get(areaId);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  PAINTERS[areaId](ctx, palette, new Rng(hashSeed('scene', areaId)));
  const url = c.toDataURL();
  cache.set(areaId, url);
  return url;
}
