// End-to-end Sprite Studio test in headless Chromium, with a fake shared
// database standing in for the published page's `db` capability.
// One player (Sam) draws a sprite fix and a new bug idea; then the owner
// approves them on another page that shares the same data.
// Usage: node tests/e2e/studio.mjs [screenshot-dir]
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}

const PORT = 8124;
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const fake = readFileSync(new URL('../fake-claude.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
const server = spawn(process.execPath, ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await playwright.chromium.launch();
const errors = [];
let step = 0;

// A fresh page playing `me`, starting from the database contents `seed`.
async function open(me, seed = []) {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(`${fake}
    const store = makeFakeStore();
    for (const [k, v] of ${JSON.stringify(seed)}) store.docs.set(k, v);
    window.claude = makeFakeClaude({ store, me: ${JSON.stringify(me)}, owner: 'u_owner', names: { u_sam: 'Sam', u_owner: 'Ryan' } });`);
  // No Supabase here, so the game falls back to the claude.ai shared database (the fake).
  await page.route('**/game/vendor/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.supabase = null;' }));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('#loading', { state: 'detached' });
  await page.click('[data-act="welcome-done"]');
  await page.waitForFunction(() => window.bugGarden.studio.available);
  return page;
}

const act = async (page, selector, opts = {}) => { await page.click(selector, opts); await page.waitForTimeout(200); };
const snap = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${String(++step).padStart(2, '0')}-${name}.png` }); };
// Drags across the editor canvas between two grid cells.
async function stroke(page, [x0, y0], [x1, y1]) {
  const box = await page.locator('#ed-canvas').boundingBox();
  const n = await page.evaluate(() => window.bugGarden.app.editor.editor.n);
  const at = (x, y) => [box.x + ((x + 0.5) / n) * box.width, box.y + ((y + 0.5) / n) * box.height];
  await page.mouse.move(...at(x0, y0));
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(...at(x0 + ((x1 - x0) * k) / 8, y0 + ((y1 - y0) * k) / 8));
  await page.mouse.up();
}

try {
  // ---- Sam submits a fix and a new bug idea ----
  const sam = await open('u_sam');
  await act(sam, '#nav [data-panel="bugs"]');
  await act(sam, '[data-act="bugs-tab"][data-tab="studio"]');
  assert.ok(await sam.isVisible('text=Sprite Studio'));
  await act(sam, '[data-act="studio-pick"][data-mode="fix"]');
  const species = await sam.getAttribute('.modal [data-act="ed-fix"]', 'data-id');
  await act(sam, `.modal [data-act="ed-fix"][data-id="${species}"]`);
  await sam.waitForSelector('#ed-canvas');
  // Submitting without changes is refused.
  await act(sam, '[data-act="ed-submit"]');
  assert.ok(await sam.isVisible('.toast.bad'));
  await act(sam, '.swatch[data-c="R"]');
  await stroke(sam, [2, 13], [13, 13]);
  await act(sam, '[data-ed="undo"]');
  await act(sam, '[data-ed="redo"]');
  assert.equal(await sam.evaluate(() => window.bugGarden.app.editor.editor.rows()[13].slice(2, 14)), 'R'.repeat(12));
  await sam.fill('#ed-note', 'Fixed the legs');
  await snap(sam, 'editor-fix');
  await act(sam, '[data-act="ed-submit"]');
  await sam.waitForSelector('.sub-card');
  assert.equal(await sam.locator('.sub-card').count(), 1);
  assert.equal(await sam.locator('[data-act="studio-approve"]').count(), 0, 'only the owner can approve');

  await act(sam, '[data-act="studio-pick"][data-mode="idea"]');
  await act(sam, '[data-act="ed-idea"][data-size="16"]');
  await act(sam, '.swatch[data-c="G"]');
  await act(sam, '[data-ed="mirror"]');
  await stroke(sam, [3, 4], [3, 11]);
  assert.equal(await sam.evaluate(() => window.bugGarden.app.editor.editor.rows()[6][12]), 'G', 'mirrored');
  await act(sam, '[data-ed="tool"][data-tool="fill"]');
  await act(sam, '.swatch[data-c="Y"]');
  await stroke(sam, [7, 7], [7, 7]);
  await sam.fill('#ed-name', 'Glitter Gnat');
  await sam.fill('#ed-desc', 'Sparkles when it sneezes.');
  await sam.selectOption('#ed-rarity', 'rare');
  await sam.selectOption('#ed-family', 'flyer');
  await sam.selectOption('#ed-habitat', 'caves');
  await sam.check('[data-trait="fly"]');
  await snap(sam, 'editor-idea');
  await act(sam, '[data-act="ed-submit"]');
  await sam.waitForFunction(() => document.querySelectorAll('.sub-card').length === 2);
  await act(sam, '.sub-card:has-text("Glitter Gnat") [data-act="studio-like"]');
  assert.ok(await sam.isVisible('.sub-card:has-text("Glitter Gnat") .btn.like.on'));
  await snap(sam, 'studio-sam');
  const data = await sam.evaluate(() => [...window.claude.store.docs]);
  await sam.close();

  // ---- The owner approves both ----
  const owner = await open('u_owner', data);
  await act(owner, '#nav [data-panel="bugs"]');
  await act(owner, '[data-act="bugs-tab"][data-tab="studio"]');
  await owner.waitForFunction(() => document.querySelectorAll('[data-act="studio-approve"]').length === 2);
  assert.ok(await owner.isVisible('text=by Sam'));
  await snap(owner, 'studio-owner');
  const before = await owner.evaluate((id) => window.bugGarden.app.A.bugUrl(id), species);
  await act(owner, `.sub-card:has-text("Fix:") [data-act="studio-approve"]`);
  await owner.waitForFunction((id) => window.bugGarden.app.A.overrideKeys?.[id], species);
  const after = await owner.evaluate((id) => window.bugGarden.app.A.bugUrl(id), species);
  assert.notEqual(before, after, 'the approved fix replaced the sprite');
  await act(owner, '.sub-card:has-text("Glitter Gnat") [data-act="studio-approve"]');
  await owner.waitForSelector('.idea-cell:has-text("Glitter Gnat")');
  await act(owner, '[data-act="studio-filter"][data-status="approved"]');
  assert.equal(await owner.locator('.sub-card.s-approved').count(), 2);
  await owner.locator('.idea-gallery').scrollIntoViewIfNeeded();
  await snap(owner, 'studio-approved');
  // And back to the original sprite.
  await act(owner, '[data-act="studio-live"][data-ref=""]');
  await owner.waitForFunction((id) => !window.bugGarden.app.A.overrideKeys?.[id], species);
  assert.equal(await owner.evaluate((id) => window.bugGarden.app.A.bugUrl(id), species), before);

  assert.deepEqual(errors, []);
  console.log('E2E studio test passed.');
} finally {
  await browser.close();
  server.kill();
}
