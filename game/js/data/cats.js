// The owner's three cats. They visit the flower bed: every two hours, on the
// hour (by the device clock), each one has a `chance` of turning up. Pet
// them for an egg as good as the toughest area you've unlocked gives, one
// tier better for each extra cat (data/areas.js eggTier), up to Mythic. Only
// all three at once, with the last area (New Jersey) unlocked, give Celestial.
// Each has two 32x32 sprites in data/sprites.js, standing (`<id>`) and
// asleep (`<id>_asleep`); the owner can redraw both in the Sprite Studio.
// Whether they're awake depends on the time the game was opened: opened
// between `asleep[0]` and `asleep[1]` o'clock, they're curled up asleep.
export const CATS = [
  { id: 'cat_mika', name: 'Mika', desc: 'A tabby with a tidy "M" on her forehead.' },
  { id: 'cat_noctis', name: 'Noctis', desc: 'Black as midnight, with a white patch on his chest.' },
  { id: 'cat_vyke', name: 'Vyke', desc: 'A fluffy lavender ragdoll.' },
];
export const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));

// Every sprite of every cat, for the Studio.
export const CAT_SPRITES = CATS.flatMap((c) => [{ id: c.id, name: c.name }, { id: `${c.id}_asleep`, name: `${c.name} (asleep)` }]);
export const CAT_SPRITE_BY_ID = Object.fromEntries(CAT_SPRITES.map((c) => [c.id, c]));

export const CAT_VISITS = { everyHours: 2, chance: 0.25, asleep: [21, 7], maxEgg: 'mythic', allCatsEgg: 'celestial' };

// Are the cats asleep, for a game opened at `time`?
export function catsAsleep(time) {
  const h = new Date(time).getHours();
  const [from, to] = CAT_VISITS.asleep;
  return from > to ? h >= from || h < to : h >= from && h < to;
}
