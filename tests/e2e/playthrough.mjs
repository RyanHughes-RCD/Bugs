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

  // The map is bigger than the screen: dragging the grass pans the view both ways.
  const cam0 = await st(() => ({ x: window.bugGarden.app.scene.camX, y: window.bugGarden.app.scene.camY }));
  const box = await page.locator('#garden').boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.45, { steps: 10 });
  await page.mouse.up();
  const cam1 = await st(() => ({ x: window.bugGarden.app.scene.camX, y: window.bugGarden.app.scene.camY }));
  assert.ok(cam1.x > cam0.x + 5 && cam1.y > cam0.y + 5, `panned right and down: ${JSON.stringify([cam0, cam1])}`);
  await page.evaluate(() => { const s = window.bugGarden.app.scene; const r = s.game.state.garden.rock; s.lookAt(r.x, r.y); });

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
  await page.evaluate(() => { window.bugGarden.game.addItem('thorn_spear'); window.bugGarden.game.commit(); });
  await act('[data-act="plan"][data-area="garden"]');
  assert.equal(await page.locator('.team-slots .slot.filled').count(), 4);
  // Equipment panels under the party: give the second bug a Thorn Spear from here.
  assert.equal(await page.locator('.gear-panels .gear-panel[data-act="plan-gear"]').count(), 4, 'one panel per party bug');
  const second = await page.getAttribute('.gear-panels .gear-panel[data-act="plan-gear"] >> nth=1', 'data-uid');
  await act('.gear-panels .gear-panel[data-act="plan-gear"] >> nth=1');
  await act('.gear-picker [data-act="plan-equip"][data-item="thorn_spear"]');
  assert.equal(await st(() => window.bugGarden.game.state.bugs.find((b) => b.item === 'thorn_spear')?.uid), Number(second), 'equipped on the right bug');
  assert.equal(await st(() => window.bugGarden.game.state.inventory.thorn_spear), undefined, 'taken from the bag, not copied');
  assert.ok((await page.textContent('.gear-panels')).includes('Thorn Spear'), 'the panel shows it straight away');
  await act('[data-act="plan-count"]:has-text("8h overnight")');
  const trip = await st(async () => {
    const { encounterMs } = await import('./game/js/systems/expedition.js');
    const { AREA_BY_ID } = await import('./game/js/data/areas.js');
    const g = window.bugGarden.game;
    const { plan } = window.bugGarden.app.ui;
    return { count: plan.count, ms: plan.count * encounterMs(g.state, AREA_BY_ID[plan.areaId], plan.party.map((u) => g.bug(u))) };
  });
  assert.ok(Math.abs(trip.ms - 8 * HOUR) <= 5 * 60e3, `8h preset gives ${trip.count} encounters = ${trip.ms / HOUR}h`);
  assert.ok((await page.textContent('.modal')).includes(`${trip.count} encounters`));
  await snap('planner');
  await act('[data-act="plan-count"]:has-text("Short")');
  await act('[data-act="launch"]');
  await act('[data-act="confirm-yes"]');
  const exp = await st(() => window.bugGarden.game.state.expeditions[0]);
  assert.ok(await st(() => { const g = window.bugGarden.game; return g.state.expeditions[0].party.some((u) => g.bug(u).item === 'thorn_spear'); }), 'the party set off with the new gear');
  assert.equal(exp.endsAt - exp.startAt, exp.count * exp.encounterMs, 'the timer matches the encounters');
  assert.ok(exp.encounterMs <= 5 * 60e3, 'starters or better are on pace in the Garden: 5 minutes or less each');
  await warp(15 * 60e3);
  assert.ok((await page.textContent('.modal')).includes(`of ${exp.count}`));
  await snap('live-log');
  // While the party is away: wild visitors to greet.
  await act('.modal [data-act="close-modal"]');
  await act('#nav [data-panel="garden"]');
  await warp(2 * HOUR);
  // Pick a visitor that is still here and not under the HUD, and hold it still for the tap.
  // Empty the pot first so no garden coin sits under the tap.
  await page.evaluate(() => { window.bugGarden.game.collectGarden(); });
  const visitor = await st(() => {
    const s = window.bugGarden.app.scene;
    const b = s.canvas.getBoundingClientRect();
    for (const e of s.entities.values()) {
      if (!e.visitor || e.hidden || e.leaving || e.greeted || e.x < 12 || e.x > 138) continue;
      const [x, y] = s.toScreen(e.x, e.y);
      const at = [b.left + x / s.dpr, b.top + y / s.dpr];
      if (document.elementFromPoint(...at) !== s.canvas) continue;
      Object.assign(e, { wait: 30, act: null, actTime: 0 });
      return { id: e.visitor, at };
    }
    return null;
  });
  if (visitor) {
    await page.mouse.click(...visitor.at);
    await page.waitForTimeout(300);
    assert.ok(await st(() => window.bugGarden.game.state.stats.visitorsGreeted >= 1), 'greeted a visitor');
  }
  await snap('visitors');
  await act('#hud [data-act="view-exp"]', { force: true });
  await page.waitForSelector('.modal [data-act="claim"]');
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

  // Garden decorations: buy a log from the Upgrades panel, then drag it.
  await page.evaluate(() => { window.bugGarden.game.earn(2000); window.bugGarden.game.commit(); });
  await act('#nav [data-panel="upgrades"]');
  await act('[data-act="buy-decor"][data-id="log"]');
  if (await page.$('[data-act="confirm-yes"]')) await act('[data-act="confirm-yes"]');
  const log = await st(() => ({ ...window.bugGarden.game.state.garden.decor.log }));
  // Bring it into view, and park the bugs elsewhere so the drag grabs the log, not a bug on it.
  await page.evaluate(({ x, y }) => {
    const s = window.bugGarden.app.scene;
    s.lookAt(x, y);
    for (const e of s.entities.values()) Object.assign(e, { x: 12, y: 20, tx: 12, ty: 20, wait: 60, act: null, actTime: 0 });
  }, log);
  assert.ok(Number.isFinite(log.x), 'the log is in the garden');
  const toPage = (x, y) => page.evaluate(([x, y]) => { const s = window.bugGarden.app.scene; const [a, b] = s.toScreen(x, y); const r = s.canvas.getBoundingClientRect(); return [r.left + a / s.dpr, r.top + b / s.dpr]; }, [x, y]);
  const free = await st(async () => {
    const { decorFits } = await import('./game/js/systems/garden.js');
    const g = window.bugGarden.game.state.garden;
    const s = window.bugGarden.app.scene;
    // A free spot that's on screen (the map is bigger than the view).
    for (let y = s.camY + 50; y < s.camY + s.viewH - 70; y += 10) {
      for (let x = s.camX + 30; x < s.camX + s.viewW - 30; x += 15) {
        if (decorFits(g, 'log', Math.round(x), Math.round(y)) && Math.hypot(x - g.decor.log.x, y - g.decor.log.y) > 30) return [Math.round(x), Math.round(y)];
      }
    }
    return null;
  });
  await page.mouse.move(...(await toPage(log.x, log.y)));
  await page.mouse.down();
  await page.mouse.move(...(await toPage(...free)), { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const moved = await st(() => window.bugGarden.game.state.garden.decor.log);
  assert.ok(Math.hypot(moved.x - free[0], moved.y - free[1]) <= 2, `log dragged to ${free}: ${JSON.stringify(moved)}`);
  await snap('decorations');

  // Garden chests: spend keys from the garden screen.
  await act('#nav [data-panel="garden"]');
  await page.evaluate(() => { const g = window.bugGarden.game; g.state.inventory.key = 3; g.commit(); });
  await act('#hud [data-act="garden-chests"]', { force: true });
  const keysBefore = await st(() => window.bugGarden.game.state.inventory.key);
  await act('.modal [data-act="open-chest"][data-id="small"]');
  await page.click('.modal [data-act="open-chest"][data-id="small"]', { force: true }).catch(() => {}); // a hasty second tap while it's revealing
  assert.equal(await st(() => window.bugGarden.game.state.inventory.key), keysBefore - 1, 'one key per opening, even with a double tap');
  assert.ok(await page.$('.modal .chest-reveal'), 'shows what was inside');
  await snap('garden-chest');
  await act('.modal [data-act="close-modal"]');

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
