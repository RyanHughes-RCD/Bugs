// Bug species. To add one, append a row to RAW (its own sprite at
// 8x/<id>.png) or to RELATIVES (an existing sprite recoloured).
// traits: the species' natural traits, signature trait first. Hatched bugs
// draw from these first and may roll extra traits on top.
export { RARITIES, RARITY_ORDER } from './rarities.js';

export const FAMILIES = {
  crawler: 'Crawler', beetle: 'Beetle', flyer: 'Flyer', arachnid: 'Arachnid', wriggler: 'Wriggler', hopper: 'Hopper',
};

// id, name, rarity, family, traits, description
const RAW = [
  ['ant', 'Worker Ant', 'common', 'crawler', ['lift', 'build', 'dig'], 'Carries ten times its weight and never takes a day off.'],
  ['aphid', 'Aphid', 'drab', 'crawler', ['cut', 'fly'], 'Tiny, green and always hungry for fresh shoots.'],
  ['ladybug', 'Ladybug', 'common', 'beetle', ['fly', 'fight'], 'Seven spots of pure good luck.'],
  ['worm', 'Earthworm', 'drab', 'wriggler', ['dig'], 'Turns the soil so the whole garden can grow.'],
  ['caterpillar', 'Caterpillar', 'common', 'wriggler', ['cut', 'build'], 'Munching its way toward something wonderful.'],
  ['cricket', 'Field Cricket', 'common', 'hopper', ['fight', 'dig'], 'Sings the meadow to sleep every evening.'],
  ['leafhopper', 'Leafhopper', 'common', 'hopper', ['fly', 'cut'], 'Gone in a flick before you can blink.'],
  ['housefly', 'Housefly', 'drab', 'flyer', ['fly'], 'Buzzes in circles. Somehow always lands on lunch.'],
  ['pill_bug', 'Pill Bug', 'common', 'crawler', ['dig', 'lift'], 'Rolls into an armoured ball at the first sign of trouble.'],
  ['water_strider', 'Water Strider', 'common', 'crawler', ['fly', 'build'], 'Skates across ponds on the surface tension.'],
  ['mosquito', 'Mosquito', 'drab', 'flyer', ['fly', 'fight'], 'Whines in your ear at the worst possible moment.'],
  ['crane_fly', 'Crane Fly', 'drab', 'flyer', ['fly'], 'All legs and no idea where it is going.'],
  ['slug', 'Garden Slug', 'drab', 'wriggler', ['dig', 'build'], 'Leaves a shimmering trail wherever it wanders.'],
  ['snail', 'Snail', 'common', 'wriggler', ['build', 'dig'], 'Carries its house everywhere. Never in a hurry.'],
  ['millipede', 'Millipede', 'common', 'wriggler', ['dig', 'lift'], 'Hundreds of legs moving in perfect rhythm.'],
  ['earwig', 'Earwig', 'common', 'crawler', ['fight', 'cut'], 'Waves its pincers to look far scarier than it is.'],
  ['moth', 'Dusk Moth', 'common', 'flyer', ['fly', 'cut'], 'Can never resist a warm glowing light.'],
  ['cockroach', 'Cockroach', 'common', 'crawler', ['dig', 'lift'], 'Survives absolutely everything.'],
  ['termite', 'Termite', 'common', 'crawler', ['build', 'dig', 'cut'], 'A master architect of wooden cities.'],
  ['weevil', 'Weevil', 'common', 'beetle', ['dig', 'cut'], 'Its long snout is perfect for drilling acorns.'],
  ['grub', 'Beetle Grub', 'drab', 'wriggler', ['dig'], 'Sleepy, chubby, and dreaming of becoming a beetle.'],
  ['firebug', 'Firebug', 'common', 'crawler', ['fight', 'build'], 'Red and black warning colours, baked in the sun.'],
  ['silverfish', 'Silverfish', 'drab', 'crawler', ['dig', 'cut'], 'Slips through cracks like quicksilver.'],
  ['tick', 'Tick', 'drab', 'arachnid', ['fight'], 'Small, patient, and holds on forever.'],
  ['stink_bug', 'Stink Bug', 'common', 'crawler', ['fight', 'build'], 'Its defence is a smell nobody forgets.'],

  ['grasshopper', 'Grasshopper', 'uncommon', 'hopper', ['fly', 'cut'], 'Can leap twenty times its own length.'],
  ['bee', 'Honeybee', 'nice', 'flyer', ['build', 'fly', 'fight'], 'Builds perfect hexagons and defends them bravely.'],
  ['butterfly', 'Sky Butterfly', 'uncommon', 'flyer', ['fly'], 'Drifts between flowers on bright blue wings.'],
  ['damselfly', 'Damselfly', 'nice', 'flyer', ['fly', 'fight'], 'A slender jewel that folds its wings at rest.'],
  ['firefly', 'Firefly', 'nice', 'flyer', ['fly', 'build'], 'Writes glowing messages across the dusk.'],
  ['centipede', 'Centipede', 'nice', 'wriggler', ['fight', 'cut'], 'A fast, fierce hunter of the leaf litter.'],
  ['harvestman', 'Harvestman', 'uncommon', 'arachnid', ['cut', 'lift'], 'Not quite a spider, all the way legs.'],
  ['garden_spider', 'Garden Spider', 'nice', 'arachnid', ['build', 'fight'], 'Weaves a brand-new orb web every single morning.'],
  ['spider', 'House Spider', 'uncommon', 'arachnid', ['build', 'fight'], 'Lurks in corners, keeping the flies in check.'],
  ['stick_insect', 'Stick Insect', 'uncommon', 'crawler', ['build', 'lift'], 'Spends its life pretending to be a twig.'],
  ['dung_beetle', 'Dung Beetle', 'nice', 'beetle', ['lift', 'dig', 'build'], 'Navigates by the stars of the Milky Way.'],
  ['cicada', 'Cicada', 'uncommon', 'flyer', ['dig', 'fly'], 'Sleeps underground for years, then sings for weeks.'],
  ['mole_cricket', 'Mole Cricket', 'uncommon', 'hopper', ['dig', 'lift'], 'Digs tunnels with shovel-shaped front legs.'],
  ['flying_ant', 'Flying Ant', 'uncommon', 'flyer', ['fly', 'lift', 'build'], 'Takes to the sky to found a brand-new colony.'],

  ['bumblebee', 'Bumblebee', 'rare', 'flyer', ['lift', 'fly'], 'Fuzzy, round, and much stronger than it looks.'],
  ['dragonfly', 'Dragonfly', 'rare', 'flyer', ['fly', 'fight'], 'An ancient aerial hunter with near-perfect aim.'],
  ['leaf_insect', 'Leaf Insect', 'rare', 'crawler', ['cut', 'build'], 'Indistinguishable from a leaf, even to other leaves.'],
  ['stag_beetle', 'Stag Beetle', 'rare', 'beetle', ['lift', 'fight', 'cut'], 'Duels rivals with magnificent antler-like jaws.'],
  ['tiger_beetle', 'Tiger Beetle', 'rare', 'beetle', ['fight', 'fly'], 'One of the fastest runners in the bug world.'],
  ['scorpion', 'Desert Scorpion', 'rare', 'arachnid', ['fight', 'cut', 'dig'], 'Glows faintly under moonlight. Mind the tail.'],
  ['wasp', 'Paper Wasp', 'rare', 'flyer', ['build', 'fly', 'fight'], 'Builds paper palaces and defends them fiercely.'],
  ['monarch', 'Monarch', 'rare', 'flyer', ['fly', 'build'], 'Flies thousands of miles following the sun.'],
  ['jumping_spider', 'Jumping Spider', 'rare', 'arachnid', ['fight', 'fly', 'build'], 'Big curious eyes and an acrobat\'s pounce.'],

  ['rhino_beetle', 'Rhino Beetle', 'epic', 'beetle', ['lift', 'fight', 'dig'], 'Can lift 850 times its own weight. A true titan.'],
  ['tarantula', 'Tarantula', 'epic', 'arachnid', ['dig', 'fight', 'build'], 'Large, hairy, and surprisingly gentle.'],
  ['jewel_beetle', 'Jewel Beetle', 'epic', 'beetle', ['dig', 'fly', 'lift'], 'Its shell shimmers like a polished gemstone.'],

  ['hornet', 'Giant Hornet', 'legendary', 'flyer', ['fight', 'fly', 'cut'], 'The undisputed terror of the canopy.'],
  ['blue_morpho', 'Blue Morpho', 'legendary', 'flyer', ['fly', 'cut', 'build'], 'Flashes electric blue then vanishes into shadow.'],

  ['mantis', 'Moon Mantis', 'mythic', 'crawler', ['cut', 'fight', 'fly'], 'Prays to the moon, strikes like lightning.'],
  ['luna_moth', 'Luna Moth', 'mythic', 'flyer', ['fly', 'build', 'lift'], 'A pale green spirit of the midnight sky.'],

  // A real giant: its sprite is 32x32, twice the size of everyone else.
  ['atlas_moth', 'Atlas Moth', 'epic', 'flyer', ['fly', 'lift'], 'Its wingtips look like snake heads.'],

  // Elemental and magical bugs.
  ['boulder_pill_bug', 'Boulder Pill Bug', 'uncommon', 'crawler', ['lift', 'dig'], 'Rolls up into a mossy stone. Nobody can tell the difference.'],
  ['ice_worm', 'Ice Worm', 'uncommon', 'wriggler', ['dig', 'cut'], 'Tunnels through glaciers, leaving icicles behind.'],
  ['spore_beetle', 'Spore Beetle', 'uncommon', 'beetle', ['dig', 'build'], 'Grows a little mushroom garden on its back.'],
  ['bubble_ladybug', 'Bubble Ladybug', 'nice', 'beetle', ['fly', 'build'], 'Floats everywhere in its own perfect bubble.'],
  ['on_firefly', 'On-Firefly', 'rare', 'flyer', ['fly', 'fight', 'build'], 'Its tail is not a lantern. It is actually on fire.'],
  ['magma_snail', 'Magma Snail', 'rare', 'wriggler', ['build', 'lift', 'dig'], 'Carries a shell of glowing lava and leaves a trail of smoke.'],
  ['frost_moth', 'Frost Moth', 'rare', 'flyer', ['fly', 'cut'], 'Each wingbeat scatters a flurry of snowflakes.'],
  ['thornvine_mantis', 'Thornvine Mantis', 'rare', 'crawler', ['cut', 'fight'], 'Half insect, half bramble, all patience.'],
  ['acid_wasp', 'Acid Wasp', 'rare', 'flyer', ['fight', 'cut'], 'Its sting fizzes. Best admired from a distance.'],
  ['gust_cicada', 'Gust Cicada', 'rare', 'flyer', ['fly', 'dig'], 'Its song is a howling wind that bends the grass.'],
  ['psychic_jumping_spider', 'Psychic Jumping Spider', 'epic', 'arachnid', ['fight', 'fly', 'build'], 'Reads your mind, then pounces before you finish the thought.'],
  ['thunder_beetle', 'Thunder Beetle', 'epic', 'beetle', ['lift', 'fight', 'fly'], 'Its stripes crackle before every storm.'],
  ['crystal_beetle', 'Crystal Beetle', 'epic', 'beetle', ['dig', 'lift', 'build'], 'Grows a shell of living crystal deep underground.'],
  ['magma_centipede', 'Magma Centipede', 'epic', 'wriggler', ['fight', 'dig', 'cut'], 'A hundred glowing legs, each one hot enough to melt rock.'],
  ['iron_stag_beetle', 'Iron Stag Beetle', 'epic', 'beetle', ['lift', 'fight', 'cut'], 'Forged, not hatched. Or so the legends say.'],
  ['storm_dragonfly', 'Storm Dragonfly', 'legendary', 'flyer', ['fly', 'fight', 'cut'], 'Flies on wings of cloud with lightning for a body.'],
  ['halo_bee', 'Halo Bee', 'legendary', 'flyer', ['fly', 'build', 'lift'], 'Wears a golden halo and makes the sweetest honey there is.'],
  ['ghost_spider', 'Ghost Spider', 'legendary', 'arachnid', ['cut', 'build', 'fly'], 'Spins webs you can only see by moonlight.'],
  ['void_ant', 'Void Ant', 'mythic', 'crawler', ['lift', 'build', 'dig', 'fight'], 'Its body holds a sky full of tiny stars.'],
  ['cosmic_butterfly', 'Cosmic Butterfly', 'celestial', 'flyer', ['fly', 'build', 'cut', 'lift', 'dig'], 'Born where two galaxies touched.'],
];

// Relatives reuse another species' sprite with its palette colours swapped
// (recolor maps palette characters from pixel_bugs/palette.txt), so they stay
// pixel-perfect and in the same style.
// id, name, base sprite, rarity, traits, recolor, description
const RELATIVES = [
  ['black_aphid', 'Black Aphid', 'aphid', 'drab', ['cut'], { G: 'k', g: 'l', T: 'K' }, 'Clusters on bean stalks in tiny dark crowds.'],
  ['fruit_fly', 'Fruit Fly', 'housefly', 'drab', ['fly'], { k: 'n', l: 'Y' }, 'Appears out of nowhere the moment a banana ripens.'],
  ['gnat', 'Gnat', 'mosquito', 'drab', ['fly'], { k: 's', l: 'W' }, 'Dances in little clouds on summer evenings.'],
  ['spider_mite', 'Spider Mite', 'tick', 'drab', ['fight'], { R: 'r', N: 'R' }, 'Smaller than a grain of sand, twice as stubborn.'],
  ['woodlouse', 'Woodlouse', 'pill_bug', 'drab', ['dig'], { k: 'N', l: 'n', s: 'N' }, 'A pill bug\'s cousin who never learned to roll.'],
  ['pot_worm', 'Pot Worm', 'worm', 'drab', ['dig'], { p: 'W', R: 'l' }, 'A pale little worm that lives in flowerpots.'],
  ['banana_slug', 'Banana Slug', 'slug', 'drab', ['dig'], { r: 'Y', Y: 'g', R: 'N' }, 'Bright yellow and proud of it.'],
  ['mealworm', 'Mealworm', 'grub', 'drab', ['dig'], { W: 'Y', l: 'n' }, 'Crunchy, golden, and always snacking.'],
  ['booklouse', 'Booklouse', 'silverfish', 'drab', ['cut'], { l: 'n', s: 'N' }, 'Nibbles the glue in very old books.'],

  ['fire_ant', 'Fire Ant', 'ant', 'common', ['fight', 'lift'], { k: 'R', W: 'Y' }, 'Small, red, and very easily annoyed.'],
  ['lacewing', 'Lacewing', 'crane_fly', 'common', ['fly'], { n: 'G', l: 'g' }, 'Delicate green wings like stained glass.'],
  ['yellow_ladybird', 'Yellow Ladybird', 'ladybug', 'common', ['fly'], { R: 'Y', r: 'R' }, 'A sunny ladybird with spots to spare.'],
  ['looper', 'Cabbage Looper', 'caterpillar', 'common', ['cut'], { G: 'g', T: 'G', g: 'Y' }, 'Walks by folding itself in half.'],
  ['house_cricket', 'House Cricket', 'cricket', 'common', ['dig'], { N: 'n', n: 'Y' }, 'Chirps behind the fridge all night long.'],
  ['pond_skater', 'Pond Skater', 'water_strider', 'common', ['fly'], { k: 'N', s: 'n' }, 'Glides across puddles without a ripple.'],
  ['cave_cricket', 'Cave Cricket', 'cricket', 'common', ['dig'], { N: 'l', n: 'W' }, 'Pale and leggy from a life in the dark.'],
  ['greenbottle', 'Greenbottle Fly', 'housefly', 'common', ['fly', 'fight'], { k: 'G', l: 'g' }, 'Shines like a green glass bead.'],

  ['leafcutter_ant', 'Leafcutter Ant', 'ant', 'uncommon', ['cut', 'lift'], { k: 'r', W: 'Y' }, 'Carries leaves home to farm fungus.'],
  ['bush_cricket', 'Bush Cricket', 'grasshopper', 'uncommon', ['fly', 'fight'], { G: 'T', g: 'G', T: 'K' }, 'Hides in hedges and sings with its wings.'],
  ['cabbage_white', 'Cabbage White', 'butterfly', 'uncommon', ['fly'], { b: 'W', c: 'l', r: 'k', k: 's' }, 'The garden\'s most familiar butterfly.'],
  ['rusty_millipede', 'Rusty Millipede', 'millipede', 'uncommon', ['dig', 'lift'], { N: 'R', n: 'r' }, 'Coiled, rust-red and in no hurry at all.'],
  ['pond_snail', 'Pond Snail', 'snail', 'uncommon', ['build', 'dig'], { n: 'k', N: 'K', l: 'C', s: 'c' }, 'Breathes air from a little lung bubble.'],
  ['rove_beetle', 'Rove Beetle', 'earwig', 'uncommon', ['fight', 'dig'], { N: 'k', n: 's' }, 'Raises its tail like a scorpion to bluff.'],
  ['mayfly', 'Mayfly', 'damselfly', 'uncommon', ['fly'], { c: 'Y', l: 'W', b: 'n' }, 'Lives for a single glorious day.'],
  ['shield_bug', 'Shield Bug', 'stink_bug', 'uncommon', ['build', 'fight'], { G: 'N', T: 'K', g: 'n' }, 'Wears its armour like a knight\'s shield.'],

  ['orchid_bee', 'Orchid Bee', 'bee', 'nice', ['fly', 'build'], { Y: 'G', C: 'g' }, 'Metallic green and smells of flowers.'],
  ['wolf_spider', 'Wolf Spider', 'spider', 'nice', ['fight', 'dig'], { k: 'N', P: 'n', R: 'Y' }, 'Hunts on foot, carrying its babies on its back.'],
  ['crab_spider', 'Crab Spider', 'garden_spider', 'nice', ['fight', 'build'], { Y: 'p', l: 'W' }, 'Waits inside flowers, the same colour as the petals.'],
  ['will_o_wisp', 'Will-o\'-Wisp', 'firefly', 'nice', ['fly', 'build'], { Y: 'C', R: 'b' }, 'A drifting blue light that leads travellers astray.'],
  ['green_grocer', 'Green Grocer Cicada', 'cicada', 'nice', ['dig', 'fly'], { l: 'g', k: 'G', C: 'Y' }, 'One of the loudest insects alive.'],
  ['violet_centipede', 'Violet Centipede', 'centipede', 'nice', ['fight', 'cut'], { R: 'P', r: 'p' }, 'A purple flash in the leaf litter.'],

  ['scarlet_darter', 'Scarlet Darter', 'dragonfly', 'rare', ['fly', 'fight'], { T: 'R', C: 'r' }, 'A red streak over the pond.'],
  ['emerald_tiger', 'Emerald Tiger Beetle', 'tiger_beetle', 'rare', ['fight', 'fly'], { T: 'G', C: 'g' }, 'Runs so fast its eyes can\'t keep up.'],
  ['regal_jumper', 'Regal Jumper', 'jumping_spider', 'rare', ['fight', 'fly'], { k: 'P', W: 'p' }, 'Royal purple, and it knows it.'],
  ['emperor_scorpion', 'Emperor Scorpion', 'scorpion', 'rare', ['fight', 'cut', 'dig'], { R: 'k', r: 's' }, 'Huge, dark and glows blue under moonlight.'],
  ['swallowtail', 'Swallowtail', 'monarch', 'rare', ['fly', 'build'], { r: 'Y' }, 'Yellow wings with elegant tails.'],

  ['hercules_beetle', 'Hercules Beetle', 'rhino_beetle', 'epic', ['lift', 'fight', 'dig'], { k: 'n', P: 'N', l: 'W' }, 'Its horn is longer than its body.'],
  ['goliath_beetle', 'Goliath Beetle', 'stag_beetle', 'epic', ['lift', 'fight', 'cut'], { N: 'W', n: 'l' }, 'One of the heaviest insects on Earth.'],
  ['orchid_mantis', 'Orchid Mantis', 'mantis', 'epic', ['cut', 'fight', 'build'], { G: 'p', g: 'W' }, 'Pretends to be a flower. Very convincingly.'],
  ['cobalt_tarantula', 'Cobalt Tarantula', 'tarantula', 'epic', ['dig', 'fight', 'build'], { k: 'b', N: 'c', r: 'C' }, 'Electric blue and famously grumpy.'],
  ['rainbow_scarab', 'Rainbow Scarab', 'jewel_beetle', 'epic', ['dig', 'fly', 'lift'], { G: 'P', T: 'b', g: 'C' }, 'Shifts colour with every step.'],

  ['crimson_hornet', 'Crimson Hornet', 'hornet', 'legendary', ['fight', 'fly', 'cut'], { Y: 'R', C: 'p' }, 'Its buzz alone clears a path.'],
  ['glasswing', 'Glasswing', 'blue_morpho', 'legendary', ['fly', 'cut', 'build'], { b: 'C', c: 'W' }, 'Wings so clear you can see right through them.'],
  ['flame_beetle', 'Flame Beetle', 'rhino_beetle', 'legendary', ['lift', 'fight', 'dig'], { k: 'R', P: 'r', l: 'Y' }, 'Its shell is always hot enough to toast a marshmallow.'],
  ['birdwing', 'Birdwing', 'butterfly', 'legendary', ['fly', 'build', 'lift'], { b: 'G', c: 'g', r: 'Y' }, 'So big it\'s sometimes mistaken for a bird.'],
  ['ruby_damsel', 'Ruby Damsel', 'damselfly', 'legendary', ['fly', 'fight', 'cut'], { c: 'P', l: 'p', b: 'R' }, 'A living gemstone on wings.'],

  ['sunset_moth', 'Sunset Moth', 'luna_moth', 'mythic', ['fly', 'build', 'lift'], { g: 'r', W: 'Y' }, 'Carries the last light of evening on its wings.'],
  ['shadow_mantis', 'Shadow Mantis', 'mantis', 'mythic', ['cut', 'fight', 'dig'], { G: 'k', g: 'P' }, 'Only seen when it wants to be.'],
  ['aurora_morpho', 'Aurora Morpho', 'blue_morpho', 'mythic', ['fly', 'cut', 'build'], { b: 'P', c: 'p', k: 'b' }, 'Shimmers like the northern lights.'],

  ['star_moth', 'Star Moth', 'luna_moth', 'celestial', ['fly', 'build', 'lift', 'cut'], { g: 'C', k: 'b' }, 'Said to fall from the sky on meteor nights.'],
  ['comet_dragonfly', 'Comet Dragonfly', 'dragonfly', 'celestial', ['fly', 'fight', 'cut', 'dig'], { T: 'b', C: 'W' }, 'Leaves a faint trail of light behind it.'],
  ['nebula_beetle', 'Nebula Beetle', 'jewel_beetle', 'celestial', ['lift', 'dig', 'fight', 'build'], { G: 'b', T: 'P', g: 'p', Y: 'W' }, 'There is a whole galaxy on its back.'],
];

// Hand-drawn species: their art is a text grid in data/sprites.js.
// id, name, sprite id, rarity, family, traits, description
const DRAWN = [
  ['flea', 'Flea', 'flea', 'uncommon', 'hopper', ['fly'], 'Exactly one pixel of pure jumping power.'],
  ['arcane_mite', 'Arcane Mite', 'arcane_mite', 'epic', 'arachnid', ['build', 'cut'], 'Barely visible, but it hums with old magic.'],
];

// Shade-lovers that like to hide under the garden rock (relatives inherit
// this from their base species).
const ROCK_LOVERS = new Set(['boulder_pill_bug', 'ice_worm', 'spore_beetle', 'pill_bug', 'earwig', 'cockroach', 'centipede', 'millipede', 'silverfish', 'worm', 'slug', 'grub', 'snail', 'cricket', 'mole_cricket', 'termite', 'spider', 'weevil', 'harvestman', 'tick']);

// Glowing auras for magical species (drawn behind the sprite).
const AURAS = {
  arcane_mite: '#c86ee0', will_o_wisp: '#73eff7', flame_beetle: '#ef7d57', shadow_mantis: '#5d275d',
  star_moth: '#73eff7', comet_dragonfly: '#41a6f6', nebula_beetle: '#f4a0b0',
  psychic_jumping_spider: '#c06ad8', on_firefly: '#ff9b3d', magma_snail: '#ff9b3d', halo_bee: '#fff07a',
};

// How each sprite is drawn. Most are top-down with the head pointing up; these
// are side views facing right, so they mirror and tilt instead of rotating.
const SIDE_VIEW = new Set(['magma_snail', 'caterpillar', 'cricket', 'dung_beetle', 'grub', 'mantis', 'millipede', 'mole_cricket', 'slug', 'snail', 'weevil', 'worm']);

const BASES = RAW.map(([id, name, rarity, family, traits, desc]) => ({
  id, name, rarity, family, traits, desc, base: id, recolor: null, sprite: `8x/${id}.png`, view: SIDE_VIEW.has(id) ? 'side' : 'top',
}));
const BASE_BY_ID = Object.fromEntries(BASES.map((s) => [s.id, s]));

export const SPECIES_LIST = [
  ...BASES,
  ...RELATIVES.map(([id, name, base, rarity, traits, recolor, desc]) => ({
    ...BASE_BY_ID[base], id, name, rarity, traits, desc, base, recolor,
  })),
  ...DRAWN.map(([id, name, grid, rarity, family, traits, desc]) => ({
    id, name, rarity, family, traits, desc, base: id, recolor: null, grid, sprite: null, view: 'top',
  })),
].map((s, index) => ({ ...s, aura: AURAS[s.id] || null, likesRock: ROCK_LOVERS.has(s.base), index }));

export const SPECIES = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s]));
