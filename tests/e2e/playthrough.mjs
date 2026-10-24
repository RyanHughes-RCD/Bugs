// End-to-end playthrough in headless Chromium: drives the real UI through
// every major system and fails on any console error.
// Usage: node tests/e2e/playthrough.mjs [screenshot-dir]
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}

const PORT = 8123;
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const server = spawn(process.execPath, ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await playwright.chromium.launch();
const errors = [];
let step = 0;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const snap = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${String(++step).padStart(2, '0')}-${name}.png` }); };
  const state = (fn) => page.evaluate(fn);
  const act = async (selector) => { await page.click(selector); await page.waitForTimeout(250); };
  const warp = async (ms) => { await page.evaluate((m) => window.bugGarden.game.warp(m), ms); await page.waitForTimeout(1200); };

  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForSelector('#loading', { state: 'detached' });
  await snap('welcome');
  await act('[data-act="welcome-done"]');
  assert.equal(await state(() => window.bugGarden.game.state.bugs.length), 4, 'starts with four bugs');
  await page.waitForTimeout(800);
  await snap('garden');

  // Bugs panel and a bug's detail sheet.
  await act('#nav [data-panel="bugs"]');
  await snap('bugs');
  await act('.bug-card');
  await snap('bug-detail');
  await act('[data-act="close-modal"]');
  await act('[data-act="bugs-tab"][data-tab="dex"]');
  await snap('bugdex');

  // Expedition: plan with auto-picked team, pack a supply, launch.
  await act('#nav [data-panel="explore"]');
  await snap('explore');
  await act('[data-act="plan"][data-area="meadow"]');
  assert.equal(await page.locator('.team-slots .slot.filled').count(), 4, 'auto-pick fills four slots');
  await act('[data-act="plan-supply-add"][data-item="bug_net"]');
  await snap('planner');
  await act('[data-act="launch"]');
  assert.equal(await state(() => window.bugGarden.game.state.expeditions.length), 1, 'expedition launched');
  await warp(30e3);
  await snap('expedition-progress');
  await warp(60e3);
  await act('.modal [data-act="collect-exp"]');
  await snap('report');
  assert.equal(await state(() => window.bugGarden.game.state.stats.expeditions), 1, 'expedition collected');
  await act('.modal [data-act="close-modal"]');

  // Nursery: the starter egg hatches after its timer.
  await act('#nav [data-panel="nursery"]');
  await warp(3 * 60e3);
  await snap('nursery-ready');
  const bugsBefore = await state(() => window.bugGarden.game.state.bugs.length);
  await act('[data-act="hatch"]');
  await page.waitForTimeout(1800);
  await snap('hatched');
  assert.equal(await state(() => window.bugGarden.game.state.bugs.length), bugsBefore + 1, 'egg hatched into a bug');
  await act('.modal [data-act="close-modal"]');

  // Shop: buy an egg and an upgrade.
  await page.evaluate(() => { window.bugGarden.game.earn(2000); window.bugGarden.game.commit(); });
  await act('#nav [data-panel="shop"]');
  await snap('shop');
  await act('[data-act="buy"][data-id="garden_egg"]');
  await act('[data-act="shop-tab"][data-tab="upgrades"]');
  await act('[data-act="upgrade"][data-id="nursery"]');
  await snap('upgrades');
  assert.equal(await state(() => window.bugGarden.game.state.upgrades.nursery), 1, 'upgrade bought');

  // Bag: equip gear from the bag.
  await page.evaluate(() => { window.bugGarden.game.addItem('thorn_spear'); window.bugGarden.game.commit(); });
  await act('#nav [data-panel="bag"]');
  await snap('bag');
  await act('[data-act="item-equip"][data-item="thorn_spear"]');
  await act('.modal .bug-card:not([disabled])');
  assert.equal(await state(() => window.bugGarden.game.state.bugs.filter((b) => b.gear === 'thorn_spear').length), 1, 'gear equipped');
  await snap('equipped');
  await act('.modal [data-act="close-modal"]');

  // Garden: coins accumulate over time and can be collected.
  await act('#nav [data-panel="garden"]');
  await warp(10 * 60e3);
  const coinsBefore = await state(() => window.bugGarden.game.state.coins);
  await act('.pot');
  assert.ok((await state(() => window.bugGarden.game.state.coins)) > coinsBefore, 'garden coins collected');
  await snap('garden-later');

  // Persistence: reload and confirm progress is still there.
  const before = await state(() => JSON.stringify({ c: window.bugGarden.game.state.coins, b: window.bugGarden.game.state.bugs.length, u: window.bugGarden.game.state.upgrades.nursery }));
  await page.reload();
  await page.waitForSelector('#loading', { state: 'detached' });
  const after = await state(() => JSON.stringify({ c: window.bugGarden.game.state.coins, b: window.bugGarden.game.state.bugs.length, u: window.bugGarden.game.state.upgrades.nursery }));
  assert.equal(after, before, 'state survives reload');
  await act('[data-act="settings"]');
  await snap('settings');

  assert.deepEqual(errors, [], 'no console errors');
  console.log(`E2E playthrough passed${shots ? ` (screenshots in ${shots})` : ''}.`);
} catch (err) {
  console.error(err);
  if (errors.length) console.error('Console errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
