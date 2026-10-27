import { Game } from './game.js';
import { memoryStorage } from './core/save.js';
import { Assets } from './ui/assets.js';
import { App, OFFSET_KEY } from './ui/app.js';
import { Studio } from './community/studio.js';

function pickStorage() {
  try {
    localStorage.setItem('__bug_test', '1');
    localStorage.removeItem('__bug_test');
    return localStorage;
  } catch {
    return memoryStorage(); // private mode etc: playable, but won't persist
  }
}

async function boot() {
  const fill = document.querySelector('#loading .bar i');
  const assets = new Assets();
  await assets.load((p) => { if (fill) fill.style.width = `${Math.round(p * 100)}%`; });

  const storage = pickStorage();
  const game = new Game({ storage });
  if (new URLSearchParams(location.search).has('debug')) {
    game.timeOffset = Number(storage.getItem(OFFSET_KEY)) || 0;
  }
  const info = game.load();
  const app = new App(game, assets);
  const studio = new Studio(window.claude, assets.palette);
  app.attachStudio(studio);
  app.init(info);
  // The Sprite Studio lights up once the shared database answers (only in the
  // published game on claude.ai); the game never waits for it.
  studio.connect().catch((err) => console.warn('Sprite Studio unavailable', err));
  document.querySelector('#loading')?.remove();
  window.bugGarden = { game, app, studio }; // handy for testing from the console
}

boot().catch((err) => {
  console.error(err);
  const el = document.querySelector('#loading p');
  if (el) el.textContent = `Could not start the game: ${err.message}. Serve this folder over http (see README).`;
});
