import { Game } from './game.js';
import { memoryStorage } from './core/save.js';
import { Assets } from './ui/assets.js';
import { App, OFFSET_KEY } from './ui/app.js';
import { Studio } from './community/studio.js';
import { SupabaseStudio } from './community/supabase-studio.js';
import { SUPABASE } from './community/config.js';

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
  const fill = document.querySelector('#loading .load-fill');
  const assets = new Assets();
  await assets.load((p) => { if (fill) fill.style.height = `${Math.round(p * 100)}%`; });

  const storage = pickStorage();
  const game = new Game({ storage });
  if (new URLSearchParams(location.search).has('debug')) {
    game.timeOffset = Number(storage.getItem(OFFSET_KEY)) || 0;
  }
  const info = game.load();
  const app = new App(game, assets);
  // The Sprite Studio lives on Supabase, so it works in every copy of the
  // game. If that can't be reached, it falls back to the claude.ai shared
  // database where there is one. The game never waits for either.
  const studio = new SupabaseStudio(SUPABASE, assets.palette);
  app.attachStudio(studio);
  app.init(info);
  studio.connect().catch(async (err) => {
    console.warn('Sprite Studio server unavailable', err);
    const fallback = new Studio(window.claude, assets.palette);
    if (await fallback.connect().catch(() => false)) app.attachStudio(fallback);
    else {
      studio.failed = true;
      app.studioChanged();
    }
  });
  finishLoading(fill);
  window.bugGarden = { game, app, get studio() { return app.studio; } }; // handy for testing from the console
}

// Lets the pink fill finish rising to the top, then fades the loading screen
// out. The game is already running underneath.
function finishLoading(fill) {
  const el = document.querySelector('#loading');
  if (!el) return;
  if (fill) fill.style.height = '100%';
  setTimeout(() => {
    el.classList.add('done');
    setTimeout(() => el.remove(), 260);
  }, el.classList.contains('ready') ? 850 : 0);
}

boot().catch((err) => {
  console.error(err);
  const el = document.querySelector('#loading p');
  if (el) el.textContent = `Could not start the game: ${err.message}. Serve this folder over http (see README).`;
});
