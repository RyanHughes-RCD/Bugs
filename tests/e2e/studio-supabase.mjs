// End-to-end test of the Sprite Studio on Supabase, in headless Chromium,
// with a stand-in for the Supabase client (tests/fake-supabase.mjs): sign in
// with an emailed code, pick a name, submit a sprite fix, approve it as the
// owner and see the sprite change.
// Usage: node tests/e2e/studio-supabase.mjs [screenshot-dir]
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

const PORT = 8125;
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const fake = readFileSync(new URL('../fake-supabase.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
const server = spawn(process.execPath, ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await playwright.chromium.launch();
const errors = [];
let step = 0;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/game/vendor/supabase.js', (r) => r.fulfill({
    contentType: 'text/javascript',
    body: `${fake}\nwindow.supabase = makeFakeSupabaseLib(makeFakeSupabaseStore({ owners: ['ryan@example.com'] }));`,
  }));
  const snap = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${String(++step).padStart(2, '0')}-${name}.png` }); };
  const act = async (selector) => { await page.click(selector); await page.waitForTimeout(250); };
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('#loading', { state: 'detached' });
  await act('[data-act="welcome-done"]');
  await page.waitForFunction(() => window.bugGarden.studio.available && window.bugGarden.studio.backend === 'supabase');

  await act('#nav [data-panel="bugs"]');
  await act('[data-act="bugs-tab"][data-tab="studio"]');
  assert.ok(await page.isVisible('text=Sign in to draw and vote'));
  // Signed out: drawing asks you to sign in first.
  await act('[data-act="studio-pick"][data-mode="fix"]');
  assert.ok(await page.isVisible('.toast.bad >> text=Sign in'));
  await page.fill('#studio-email', 'ryan@example.com');
  await act('[data-act="studio-send-code"]');
  assert.ok(await page.isVisible('text=Check your email'));
  await snap('code');
  await page.fill('#studio-code', '000000');
  await act('[data-act="studio-verify"]');
  assert.ok(await page.isVisible('.toast.bad'), 'a wrong code is refused');
  await page.fill('#studio-code', '123456');
  await act('[data-act="studio-verify"]');
  await page.waitForSelector('.studio-auth.signed-in');
  assert.ok(await page.isVisible('text=owner'));
  await page.fill('#studio-name', 'Ryan');
  await act('[data-act="studio-save-name"]');
  assert.equal(await page.inputValue('#studio-name'), 'Ryan');

  await act('[data-act="studio-pick"][data-mode="fix"]');
  const species = await page.getAttribute('.modal [data-act="ed-fix"]', 'data-id');
  await act(`.modal [data-act="ed-fix"][data-id="${species}"]`);
  await act('.swatch[data-c="R"]');
  const box = await page.locator('#ed-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 8 });
  await page.mouse.up();
  await act('[data-act="ed-submit"]');
  await page.waitForSelector('.sub-card');
  assert.ok(await page.isVisible('.sub-card >> text=by You'));
  await snap('submitted');
  const before = await page.evaluate((id) => window.bugGarden.app.A.bugUrl(id), species);
  await act('[data-act="studio-approve"]');
  await page.waitForFunction((id) => window.bugGarden.app.A.overrideKeys?.[id], species);
  assert.notEqual(await page.evaluate((id) => window.bugGarden.app.A.bugUrl(id), species), before, 'the approved fix is live');
  await act('[data-act="studio-signout"]');
  assert.ok(await page.isVisible('text=Sign in to draw and vote'));
  await snap('signed-out');

  assert.deepEqual(errors, []);
  console.log('E2E Supabase studio test passed.');
} finally {
  await browser.close();
  server.kill();
}
