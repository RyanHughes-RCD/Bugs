// Special effects for the showiest bugs in the garden (species.fx in
// data/species.js). Each effect is a little state on the bug's garden entity,
// updated every frame, plus some drawing under and over its sprite. The
// sprite itself changes for rainbow (colour cycling), phase (flickering out),
// glitch (tearing) and trail (afterimages): see spriteFx, used by the scene's
// drawBug.

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------- per frame ----------

export function updateFx(scene, e, dt) {
  const fx = e.fx;
  if (!fx?.length || e.hidden) return;
  const y = e.y - scene.bob(e);
  const puff = (p) => scene.particles.push(p);
  const has = (k) => fx.includes(k);
  if (has('embers') && Math.random() < dt * 9) {
    puff({ x: e.x + rand(-4, 4), y: y + rand(-2, 3), vx: rand(-4, 4), vy: rand(-14, -6), g: -0.15, life: rand(0.6, 1.1), color: ['#ff9b3d', '#fff07a', '#ef7d57'][Math.floor(rand(0, 3))] });
  }
  if (has('bubbles') && Math.random() < dt * 3) {
    puff({ x: e.x + rand(-5, 5), y: y + rand(-3, 3), vx: rand(-2, 2), vy: rand(-8, -4), g: -0.1, life: rand(1, 1.6), color: '#d6f6ff', ring: true });
  }
  if (has('frost') && Math.random() < dt * 7) {
    puff({ x: e.x + rand(-12, 12), y: y - rand(10, 16), vx: rand(-3, 3), vy: rand(3, 7), g: 0, life: rand(1.2, 1.8), color: Math.random() < 0.5 ? '#f4f4f4' : '#d6f6ff' });
  }
  if (has('sparkle') && Math.random() < dt * 3) {
    puff({ x: e.x + rand(-9, 9), y: y + rand(-9, 7), vx: 0, vy: 0, g: 0, life: 0.6, color: e.fxColor, star: true });
  }
  if (has('void') && Math.random() < dt * 10) {
    const a = rand(0, TAU);
    const r = rand(12, 18);
    const life = rand(0.5, 0.8);
    puff({ x: e.x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7, vx: (-Math.cos(a) * r) / life, vy: (-Math.sin(a) * r * 0.7) / life, g: 0, life, color: Math.random() < 0.3 ? '#c06ad8' : '#2b1b4a' });
  }
  if (has('lightning')) {
    e.boltT = (e.boltT || 0) - dt;
    if (e.boltT < -rand(1.2, 3)) {
      const a = rand(0, TAU);
      const r = rand(12, 18);
      const pts = [[e.x, y]];
      for (let k = 1; k <= 4; k++) pts.push([e.x + Math.cos(a) * r * (k / 4) + rand(-3, 3), y + Math.sin(a) * r * (k / 4) * 0.8 + rand(-3, 3)]);
      e.bolt = pts;
      e.boltT = 0.16;
      for (let k = 0; k < 4; k++) puff({ x: pts[4][0], y: pts[4][1], vx: rand(-20, 20), vy: rand(-20, 0), life: 0.35, color: '#fff07a' });
    }
  }
  if (has('nova')) {
    e.novaT = (e.novaT ?? rand(0, 4)) + dt;
    if (e.novaT > 5) {
      e.novaT = 0;
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        puff({ x: e.x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 22, g: 0, life: 0.7, color: k % 2 ? '#fff07a' : '#f4f4f4', star: k % 2 === 0 });
      }
    }
  }
  if (has('startrail')) {
    // Stars left hanging in the air wherever it goes (and the odd one while it rests).
    e.starT = (e.starT || 0) - dt;
    if (e.starT <= 0) {
      e.starT = e.moving ? 0.07 : rand(0.6, 1.4);
      const c = ['#f4f4f4', '#d6f6ff', '#73eff7', '#41a6f6'][Math.floor(rand(0, 4))];
      puff({ x: e.x + rand(-2, 2), y: y + rand(-1, 3), vx: rand(-1, 1), vy: rand(-1, 1), g: 0, life: rand(0.9, 1.5), color: c, star: Math.random() < 0.6 });
    }
  }
  if (has('stardust') && Math.random() < dt * 8) {
    // Glitter shaken from its wings, drifting down.
    puff({ x: e.x + rand(-8, 8), y: y + rand(-3, 2), vx: rand(-3, 3), vy: rand(4, 9), g: 0, life: rand(0.8, 1.4), color: Math.random() < 0.5 ? '#73eff7' : '#f4f4f4', star: Math.random() < 0.2 });
  }
  if (has('nebula')) {
    // Soft clouds of pink, violet and blue, with tiny stars twinkling in them.
    if (Math.random() < dt * 5) {
      const a = rand(0, TAU);
      puff({ x: e.x + Math.cos(a) * 4, y: y + Math.sin(a) * 3, vx: Math.cos(a) * rand(2, 5), vy: Math.sin(a) * rand(1.5, 4) - 1, g: 0, life: rand(1.2, 2), color: ['#f4a0b0', '#c06ad8', '#3b5dc9', '#ff5fa8'][Math.floor(rand(0, 4))], cloud: rand(5, 8) });
    }
    if (Math.random() < dt * 3) puff({ x: e.x + rand(-9, 9), y: y + rand(-7, 6), vx: 0, vy: 0, g: 0, life: 0.5, color: '#f4f4f4', star: true });
  }
  if (has('galaxy') && Math.random() < dt * 12) {
    // Motes spun off along two spiral arms.
    const arm = Math.random() < 0.5 ? 0 : Math.PI;
    const a = scene.t * 1.5 + arm + rand(-0.3, 0.3);
    const v = rand(7, 11);
    puff({ x: e.x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, g: 0, spin: 2.2, life: rand(1, 1.5), color: ['#73eff7', '#f4a0b0', '#c06ad8', '#f4f4f4'][Math.floor(rand(0, 4))] });
  }
  if (has('shooting')) {
    // Now and then a shooting star streaks across above it.
    e.shootT = (e.shootT ?? rand(1, 4)) - dt;
    if (e.shootT <= 0) {
      e.shootT = rand(3, 7);
      const dir = Math.random() < 0.5 ? -1 : 1;
      puff({ x: e.x - dir * 14, y: y - rand(14, 20), vx: dir * 45, vy: 16, g: 0, life: 0.55, color: '#f4f4f4', streak: true });
    }
  }
  if (has('sands') && Math.random() < dt * 9) {
    // Time trickling away: grains of sand falling straight down.
    puff({ x: e.x + rand(-3, 3), y: y - rand(9, 12), vx: rand(-0.5, 0.5), vy: rand(10, 14), g: 0, life: rand(0.6, 0.9), color: Math.random() < 0.7 ? '#ffcd75' : '#73eff7' });
  }
  if (has('glitch')) {
    e.glitchT = (e.glitchT || 0) - dt;
    if (e.glitchT < -rand(0.8, 2.5)) e.glitchT = rand(0.1, 0.35);
  }
  if (has('phase')) {
    // Now and then it blinks out entirely for a moment.
    e.blinkT = (e.blinkT || 0) - dt;
    if (e.blinkT < -rand(2, 5)) e.blinkT = rand(0.15, 0.4);
  }
  if (has('trail')) {
    e.trailT = (e.trailT || 0) + dt;
    e.trail = e.trail || [];
    if (e.trailT > 0.07) {
      e.trailT = 0;
      const last = e.trail[e.trail.length - 1];
      if (!last || Math.hypot(last.x - e.x, last.y - e.y) > 1.2) e.trail.push({ x: e.x, y: e.y, angle: e.angle, flip: e.flip });
      else e.trail.shift();
      if (e.trail.length > 6) e.trail.shift();
    }
  }
}

// ---------- drawing ----------

// Light and shapes behind the bug.
export function drawUnder(scene, e) {
  const fx = e.fx;
  if (!fx?.length) return;
  const { ctx } = scene;
  const t = scene.t + e.phase * 0.1;
  const y = e.y - scene.bob(e);
  if (fx.includes('pulse')) scene.glow(e.x, y, 12 + Math.sin(t * 2.4) * 5, hexA(e.fxColor, 0.6));
  if (fx.includes('rays')) {
    const [sx, sy] = scene.toScreen(e.x, y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.4);
    const r = 17 * scene.scale;
    for (let k = 0; k < 8; k++) {
      ctx.rotate(TAU / 8);
      const g = ctx.createLinearGradient(0, 0, r, 0);
      g.addColorStop(0, hexA(e.fxColor, 0.45));
      g.addColorStop(1, hexA(e.fxColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r, -r * 0.13);
      ctx.lineTo(r, r * 0.13);
      ctx.fill();
    }
    ctx.restore();
  }
  if (fx.includes('void')) scene.glow(e.x, y, 15, 'rgba(26, 12, 46, 0.5)');
  if (fx.includes('constellation')) {
    const stars = constellation(e, t);
    ctx.strokeStyle = hexA('#d6f6ff', 0.45);
    ctx.lineWidth = Math.max(1, scene.scale * 0.35);
    ctx.beginPath();
    stars.forEach(([x, sy], k) => {
      const [px, py] = scene.toScreen(x, sy);
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
  }
}

// Things in front of the bug.
export function drawOver(scene, e) {
  const fx = e.fx;
  if (!fx?.length) return;
  const { ctx } = scene;
  const t = scene.t + e.phase * 0.1;
  const y = e.y - scene.bob(e);
  if (fx.includes('orbit')) {
    for (let k = 0; k < 3; k++) {
      const a = t * 2 + (k * TAU) / 3;
      const ox = Math.cos(a) * 11;
      const oy = Math.sin(a) * 6;
      scene.glow(e.x + ox, y + oy, 3.5, hexA(e.fxColor, 0.7));
      const [px, py] = scene.toScreen(e.x + ox, y + oy);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(px - scene.scale / 2), Math.round(py - scene.scale / 2), scene.scale, scene.scale);
    }
  }
  if (fx.includes('constellation')) {
    for (const [k, [x, sy]] of constellation(e, t).entries()) {
      const [px, py] = scene.toScreen(x, sy);
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + k * 1.7);
      scene.sparkle(px, py, scene.scale * 0.6, '#f4f4f4');
    }
    ctx.globalAlpha = 1;
  }
  if (fx.includes('lightning') && e.boltT > 0 && e.bolt) {
    for (const [w, color] of [[2, hexA('#fff07a', 0.8)], [0.8, '#ffffff']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, scene.scale * w * 0.5);
      ctx.beginPath();
      e.bolt.forEach(([x, by], k) => {
        const [px, py] = scene.toScreen(x, by);
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
    scene.glow(e.x, y, 14, 'rgba(255, 240, 122, 0.35)');
  }
  if (fx.includes('nova') && e.novaT < 0.8) {
    const p = e.novaT / 0.8;
    const [px, py] = scene.toScreen(e.x, y);
    ctx.strokeStyle = hexA('#fff07a', 1 - p);
    ctx.lineWidth = Math.max(1, scene.scale * 0.8);
    ctx.beginPath();
    ctx.ellipse(px, py, p * 22 * scene.scale, p * 15 * scene.scale, 0, 0, TAU);
    ctx.stroke();
    scene.glow(e.x, y, 20 * (1 - p) + 4, `rgba(255, 250, 220, ${0.7 * (1 - p)})`);
  }
}

// Five stars that slowly wheel around the bug.
function constellation(e, t) {
  const pts = [[-12, -6], [-6, -12], [4, -10], [12, -3], [9, 8]];
  const a = t * 0.25;
  const y = e.y;
  return pts.map(([x, py]) => [e.x + x * Math.cos(a) - py * Math.sin(a) * 0.6, y + (x * Math.sin(a) + py * Math.cos(a)) * 0.7]);
}

// How the sprite itself is drawn: which image, how see-through, and any
// extra copies (afterimages, glitch ghosts). blit(img, x, y, alpha, dx, angle, flip).
export function spriteFx(scene, e, img, blit) {
  const fx = e.fx || [];
  let art = img;
  if (fx.includes('rainbow')) art = scene.assets.hueFrame(e.species, e.variant, Math.floor(scene.t * 4) % 12);
  if (fx.includes('trail') && e.trail?.length) {
    e.trail.forEach((p, k) => blit(art, p.x, p.y, 0.1 + (0.25 * k) / e.trail.length, 0, p.angle, p.flip));
  }
  let alpha = 1;
  if (fx.includes('phase')) {
    alpha = e.blinkT > 0 ? 0.08 : 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(scene.t * 1.8 + e.phase));
  }
  if (fx.includes('glitch') && e.glitchT > 0) {
    const [red, cyan] = scene.assets.glitchGhosts(e.species, e.variant);
    const j = Math.round(rand(1, 2));
    blit(red, e.x, e.y, 0.75, -j);
    blit(cyan, e.x, e.y, 0.75, j);
    if (Math.random() < 0.3) return; // a dropped frame
    blit(art, e.x, e.y, alpha, Math.round(rand(-1, 1)));
    return;
  }
  blit(art, e.x, e.y, alpha, 0);
}
