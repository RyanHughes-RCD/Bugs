// End-to-end playthrough in headless Chromium: drives the real UI through the
// core loop and fails on any console error.
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
const HOUR = 3600e3;
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
  const st = (fn) => page.evaluate(fn);
  const act = async (selector, opts = {}) => { await page.click(selector, opts); await page.waitForTimeout(250); };
  const warp = async (ms) => { await page.evaluate((m) => window.bugGarden.game.warp(m), ms); await page.waitForTimeout(1200); };

  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForSelector('#loading', { state: 'detached' });
  await act('[data-act="welcome-done"]');
  assert.equal(await st(() => window.bugGarden.game.state.bugs.length), 4);
  assert.equal(await st(() => window.bugGarden.app.scene.entities.size), 4, 'garden shows the four starter bugs');
  await snap('garden');

  // Drag the garden rock to a new spot; the old dirt patch is left behind.
  const rockBefore = await st(() => ({ ...window.bugGarden.game.state.garden.rock }));
  const at = await st(() => { const s = window.bugGarden.app.scene; const r = s.game.state.garden.rock; const [x, y] = s.toScreen(r.x, r.y - 4); const b = s.canvas.getBoundingClientRect(); return [b.left + x / s.dpr, b.top + y / s.dpr]; });
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  await page.mouse.move(at[0] + 90, at[1] - 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await st(() => window.bugGarden.game.state.garden);
  assert.ok(after.rock.x > rockBefore.x + 10, "rock moved");
  assert.equal(after.welts.length, 1, 'old dirt patch left behind');
  await snap('rock-moved');

  // Hatchery: motto, incubate, four hours, crack, reveal, place in garden.
  await act('#nav [data-panel="hatchery"]');
  assert.ok((await page.textContent('#sheet')).includes('"All bugs come from eggs. Everyone knows this."'));
  await act('#sheet [data-act="incubate"]');
  await snap('incubating');
  await warp(4 * HOUR);
  await act('#sheet [data-act="hatch"]');
  for (let i = 0; i < 4; i++) await act('[data-act="crack"]', { force: true });
  await page.waitForTimeout(1500);
  await snap('hatched');
  await act('.modal [data-act="garden-in"]');
  assert.equal(await st(() => window.bugGarden.game.state.bugs.filter((b) => b.inGarden).length), 5);

  // Equip the starter Chest Key from the inventory.
  await act('#nav [data-panel="items"]');
  await act('[data-act="items-tab"][data-tab="inventory"]');
  await act('[data-act="item-equip"][data-item="key"]');
  await act('.modal .bug-card:not([disabled])');
  assert.equal(await st(() => window.bugGarden.game.state.bugs.filter((b) => b.item === 'key').length), 1);
  await act('.modal [data-act="close-modal"]');

  // Expedition: exactly four, confirm, live log, claim once.
  await act('#nav [data-panel="explore"]');
  await act('[data-act="plan"][data-area="garden"]');
  assert.equal(await page.locator('.team-slots .slot.filled').count(), 4);
  await act('[data-act="plan-count"]:has-text("8h overnight")');
  assert.ok((await page.textContent('.modal')).includes('96 encounters'));
  await snap('planner');
  await act('[data-act="plan-count"]:has-text("Short")');
  await act('[data-act="launch"]');
  await act('[data-act="confirm-yes"]');
  const exp = await st(() => window.bugGarden.game.state.expeditions[0]);
  assert.equal(exp.endsAt - exp.startAt, exp.count * 5 * 60e3, 'five minutes per encounter');
  await warp(15 * 60e3);
  assert.ok((await page.textContent('.modal')).includes(`of ${exp.count}`));
  await snap('live-log');
  await warp(2 * HOUR);
  await act('.modal [data-act="claim"]');
  await snap('claimed');
  const claimed = await st(() => ({ runs: window.bugGarden.game.state.areas.garden.runs, again: window.bugGarden.game.claimExpedition(window.bugGarden.game.state.history[0].id).ok }));
  assert.deepEqual(claimed, { runs: 1, again: false }, 'claimed exactly once');
  await act('.modal [data-act="close-modal"]');

  // Upgrades with a big-purchase confirmation.
  await page.evaluate(() => { window.bugGarden.game.earn(5000); window.bugGarden.game.commit(); });
  await act('#nav [data-panel="upgrades"]');
  await act('[data-act="upgrade"][data-id="improved_exploration"]');
  await act('[data-act="confirm-yes"]');
  assert.equal(await st(() => window.bugGarden.game.state.upgrades.improved_exploration), 1);
  await snap('upgrades');

  // Persistence across a reload.
  const sig = () => JSON.stringify({ c: window.bugGarden.game.state.coins, b: window.bugGarden.game.state.bugs.map((x) => [x.uid, x.item, x.inGarden, x.traits]), u: window.bugGarden.game.state.upgrades, h: window.bugGarden.game.state.history.length });
  const before = await st(sig);
  await page.reload();
  await page.waitForSelector('#loading', { state: 'detached' });
  assert.equal(await st(sig), before, 'state survives reload');
  await act('#nav [data-panel="bugs"]');
  await snap('collection');

  // Backup to a file, lose progress, then restore from that file.
  await act('[data-act="settings"]');
  const download = page.waitForEvent('download');
  await act('.modal [data-act="backup-file"]');
  const backupPath = await (await download).path();
  assert.ok((await page.textContent('.modal')).includes('Last backup: just now'));
  await page.evaluate(() => { window.bugGarden.game.state.coins = 1; window.bugGarden.game.commit(); });
  await page.setInputFiles('#save-file', backupPath);
  await page.waitForSelector('[data-act="confirm-yes"]');
  await act('[data-act="confirm-yes"]');
  assert.equal(await st(sig), before, 'backup file restores the save');

  // Update button: pretend a newer build is on the server.
  await page.route(/version\.js\?t=/, (route) => route.fulfill({ contentType: 'text/javascript', body: "export const VERSION = '99.0.0';" }));
  await act('[data-act="settings"]');
  await snap('settings');
  await page.click('.modal [data-act="check-update"]');
  await page.waitForSelector('#hud .chip.update', { state: 'attached' });
  await page.waitForSelector('.modal [data-act="update-app"]');
  await snap('update-available');
  const reloaded = page.waitForEvent('load');
  await page.click('.modal [data-act="update-app"]');
  await reloaded;
  await page.waitForSelector('#loading', { state: 'detached' });
  assert.equal(await st(sig), before, 'save survives the update reload');

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
