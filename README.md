# Bug Garden

A pixel-art bug collecting and expedition game, built on the art in this repo:
the garden map in `BugsMap/` and the 16×16 bug sprites in `pixel_bugs/` and `8x/`.

## Play

No build step or dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

    npm start            # or: node serve.mjs   (any static server works, e.g. python3 -m http.server)

Then open <http://localhost:8080>. The layout is made for phones and also works on desktop.
Add `?debug` to the URL to get time-warp and coin buttons under ⚙ Settings, which is handy for testing timers.

## Systems

| System | What it does | Code |
| --- | --- | --- |
| **Living garden** | Your home bugs wander the `BugsMap` garden (flyers hover, hoppers hop, resting bugs snooze). They earn coins into a capped pot that you tap to collect. Day/night follows your clock, with fireflies and glowing bugs at night. Wild visitors drop by and can be befriended. | `ui/garden-scene.js`, `systems/garden.js` |
| **Collection & traits** | 55 species across 5 rarities, each with a role and family. Every bug rolls 1–2 of 16 traits, and 1 in 50 is shiny. Bugs gain XP and levels. The Bugdex tracks seen and caught species and pays a reward for each new discovery. | `data/species.js`, `data/traits.js`, `systems/bugs.js` |
| **Four-bug expeditions** | Pick a team of up to 4 and pack supplies. Each run is a seeded list of random encounters: battles, treasure, hazards, nests, rest spots and friendly wanderers. Events reveal over real time; rewards apply when you collect. Hurt bugs rest afterwards. | `systems/expedition.js`, `systems/battle.js` |
| **5 progression areas** | Sunny Meadow → Lily Pond → Old Oak Woods → Dusty Dunes → Moonlit Jungle. After 3 runs in an area its Guardian appears. Beat it, then pay the fee to unlock the next area. | `data/areas.js` |
| **Inventory & equipment** | Consumables (Honey Drop, Nectar, Sugar Cube, Warm Moss), expedition supplies (Net, Trail Mix, Clover, Salts), 9 pieces of gear (one slot per bug), and treasures to sell. | `data/items.js` |
| **Egg hatching** | 8 egg types incubate in the dirt-patch nursery. Hatches are rolled from rarity odds shown in the UI; a rarity an egg's pool doesn't have rolls into the nearest one that it does. | `systems/eggs.js`, `data/eggs.js` |
| **Persistent timers** | Expeditions, eggs, rest, garden income, visitors and the shop restock all use timestamps, so they keep running offline. You get a "welcome back" summary. | `game.js` |
| **Upgrades** | 12 permanent coin upgrades: nursery plots, incubation speed, hatch luck, stats, expedition speed, loot, capture chance, garden income and storage, rest time, extra teams, supply slots. | `data/upgrades.js` |

Progress auto-saves to `localStorage`. Settings can export or import a save code and reset the game.

## Architecture

    index.html, game/style.css
    game/js/game.js        Game class: state + every player action (pure logic, no DOM)
    game/js/data/          species, traits, items, eggs, areas, upgrades, item sprites
    game/js/systems/       bugs/stats, battle, expedition, eggs, garden, shop
    game/js/core/          seeded RNG, save/migrate/encode
    game/js/ui/            asset loading, garden canvas, area banners, HTML views, app controller

Every random roll goes through a seeded RNG stored in the save, so outcomes can be reproduced.
Item, egg and icon sprites in `game/js/data/sprites.js` use the same text format and
`pixel_bugs/palette.txt` palette as `pixel_bugs/sprites/*.txt`; the palette is loaded at runtime.

## Tests

    npm test             # 37 unit tests: every system, save/reload with timers, balance guards
    npm run test:e2e     # headless Chromium playthrough of the real UI (needs Playwright)
