# Bug Garden

A pixel-art bug collecting and idle expedition game built on this repo's art: the garden map in
`BugsMap/` and the 16×16 bug sprites in `pixel_bugs/` and `8x/`.

> "All bugs come from eggs. Everyone knows this."

## Play

No build step or dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

    npm start            # node serve.mjs, then open http://localhost:8080

The layout is designed for phones and also works on desktop.

## The loop

110 species across nine rarities: Drab, Common, Uncommon, Nice, Rare, Epic, Legendary, Mythic and Celestial. Bugs are called by what they are, with a prefix for colour variants ("Golden Ladybug"). Some are recoloured relatives of the original sprites, some are fantasy bugs with auras, and the Flea is a single black pixel.


1. **Hatchery:** buy eggs in seven tiers (Common → Celestial) and settle them into the bird's nests along the bottom of the garden (one nest per incubator slot). Base incubation is 4 hours, and it keeps running while the game is closed.
2. **Hatch:** a full-screen event where you tap the egg four times to crack it open. The tier changes the odds (shown exactly in the game) but never guarantees the result. On top of rarity, any bug can hatch **Shiny** (1%, inverted colours with a glow), **Albino** (0.5%, white with red eyes) or **Golden** (0.2%, gold with sparkles).
3. **Garden:** up to 10 bugs live here. They wander, visit flowers, dig in the dirt, and dig up a few coins. Tap a bug to inspect it. Drag the **rock** around: shy bugs hide underneath, so lifting it reveals them. A dirt patch forms under the rock over 3 hours and lingers for an hour after the rock moves.
4. **Explore:** send a party of exactly 4 bugs to one of five areas: The Garden, Misty Forest, Crystal Caves, Volcano and Aether. Each expedition has a random number of encounters (6–10 in the Garden, up to 14–20 in the Aether), and each takes 5 minutes before upgrades.
5. **Traits:** encounters test Lift, Cut, Fight, Fly, Dig and Build. Higher trait levels pass more checks and earn better rewards. A missing trait means worse odds, never a blocked expedition.
6. **Chests:** equip a Chest Key on a party member to open locked chests. The key is used up.
7. **Spend coins:** on eggs, equipment (one item per bug), permanent upgrades, and unlocking areas.

## How it's built

All rules live in plain, testable modules; the UI only calls `Game` methods, which validate everything.

| Folder | Contents |
| --- | --- |
| `game/js/data/` | **Configuration.** Edit these to add content without touching engine code: `species` (traits per species), `rarities`, `traits`, `eggs` (tiers, odds tables, visuals), `areas` (difficulty, encounter ranges, reward tables), `encounters` (the encounter catalogue), `items`, `upgrades` (cost and effect formulas), `balance` (global tuning) and `sprites`. |
| `game/js/systems/` | **Engine.** `bugs` (identity, traits, XP), `traits` (trait-check formula), `eggs` (odds, rolls, incubation), `expedition` (encounter generation, timeline), `garden`. |
| `game/js/core/` | Seeded RNG, saving (with a backup copy) and migration of older saves. |
| `game/js/game.js` | The `Game` class: every player action, with validation, saved immediately. |
| `game/js/ui/` | Garden canvas, area banners, screens, dialogs and the app controller. |

**Trait checks.** A party's score for a trait is its best bug's level, plus half the second best, a quarter of the third, and an eighth of the fourth. The chance to pass is `0.55 + 0.1 × (score − difficulty)`, clamped to 10–95%; with nobody holding the trait it is 8%. All of these numbers are in `data/balance.js`. The live log shows the trait, score, difficulty and chance for every check.

**Timers.** Eggs store their start and finish timestamps. Expeditions store their start time, encounter length, encounter count and the fully generated encounters. Progress is always computed from those timestamps, so closing the app, reloading or reopening a screen never rerolls or loses anything. Rewards are claimed once; the expedition then moves to history.

**Saves.** Saved to `localStorage` after every action. A backup copy is used if the main save is damaged, and an unreadable save is set aside rather than overwritten. Saves from the first version of the game are migrated: bugs, eggs and gear carry over, and removed items and upgrades are refunded as coins. Settings can export or import a save code.

**Art.** Only the garden has map art in `BugsMap/`, so the other four areas use generated pixel banners in the shared palette. Each area's art is configurable in `data/areas.js`. Eggs are drawn from configurable patterns and colours per tier; an `EGG_TIERS` entry can point `sprite` at real egg art.

## Testing

    npm test             # 47 unit tests: odds tables, trait checks, timers, keys, claims, saves, economy
    npm run test:e2e     # headless Chromium playthrough of the core loop (needs Playwright)

**Developer mode:** add `?debug` to the URL. Settings then shows time warp (+10 min, +1 h, +4 h), coin, key and egg grants, and an odds lab that simulates 10,000 hatches without touching your save. None of this appears without the flag.
