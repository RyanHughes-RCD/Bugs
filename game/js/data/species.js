// Bug species. To add one, append a row: the sprite path defaults to
// 8x/<id>.png and can be overridden with a `sprite` field.
// traits: the species' natural traits, signature trait first. Hatched bugs
// draw from these first and may roll extra traits on top.
export { RARITIES, RARITY_ORDER } from './rarities.js';

export const FAMILIES = {
  crawler: 'Crawler', beetle: 'Beetle', flyer: 'Flyer', arachnid: 'Arachnid', wriggler: 'Wriggler', hopper: 'Hopper',
};

// id, name, rarity, family, traits, description
const RAW = [
  ['ant', 'Worker Ant', 'common', 'crawler', ['lift', 'build', 'dig'], 'Carries ten times its weight and never takes a day off.'],
  ['aphid', 'Aphid', 'common', 'crawler', ['cut', 'fly'], 'Tiny, green and always hungry for fresh shoots.'],
  ['ladybug', 'Ladybug', 'common', 'beetle', ['fly', 'fight'], 'Seven spots of pure good luck.'],
  ['worm', 'Earthworm', 'common', 'wriggler', ['dig'], 'Turns the soil so the whole garden can grow.'],
  ['caterpillar', 'Caterpillar', 'common', 'wriggler', ['cut', 'build'], 'Munching its way toward something wonderful.'],
  ['cricket', 'Field Cricket', 'common', 'hopper', ['fight', 'dig'], 'Sings the meadow to sleep every evening.'],
  ['leafhopper', 'Leafhopper', 'common', 'hopper', ['fly', 'cut'], 'Gone in a flick before you can blink.'],
  ['housefly', 'Housefly', 'common', 'flyer', ['fly'], 'Buzzes in circles. Somehow always lands on lunch.'],
  ['pill_bug', 'Pill Bug', 'common', 'crawler', ['dig', 'lift'], 'Rolls into an armoured ball at the first sign of trouble.'],
  ['water_strider', 'Water Strider', 'common', 'crawler', ['fly', 'build'], 'Skates across ponds on the surface tension.'],
  ['mosquito', 'Mosquito', 'common', 'flyer', ['fly', 'fight'], 'Whines in your ear at the worst possible moment.'],
  ['crane_fly', 'Crane Fly', 'common', 'flyer', ['fly'], 'All legs and no idea where it is going.'],
  ['slug', 'Garden Slug', 'common', 'wriggler', ['dig', 'build'], 'Leaves a shimmering trail wherever it wanders.'],
  ['snail', 'Snail', 'common', 'wriggler', ['build', 'dig'], 'Carries its house everywhere. Never in a hurry.'],
  ['millipede', 'Millipede', 'common', 'wriggler', ['dig', 'lift'], 'Hundreds of legs moving in perfect rhythm.'],
  ['earwig', 'Earwig', 'common', 'crawler', ['fight', 'cut'], 'Waves its pincers to look far scarier than it is.'],
  ['moth', 'Dusk Moth', 'common', 'flyer', ['fly', 'cut'], 'Can never resist a warm glowing light.'],
  ['cockroach', 'Cockroach', 'common', 'crawler', ['dig', 'lift'], 'Survives absolutely everything.'],
  ['termite', 'Termite', 'common', 'crawler', ['build', 'dig', 'cut'], 'A master architect of wooden cities.'],
  ['weevil', 'Weevil', 'common', 'beetle', ['dig', 'cut'], 'Its long snout is perfect for drilling acorns.'],
  ['grub', 'Beetle Grub', 'common', 'wriggler', ['dig'], 'Sleepy, chubby, and dreaming of becoming a beetle.'],
  ['firebug', 'Firebug', 'common', 'crawler', ['fight', 'build'], 'Red and black warning colours, baked in the sun.'],
  ['silverfish', 'Silverfish', 'common', 'crawler', ['dig', 'cut'], 'Slips through cracks like quicksilver.'],
  ['tick', 'Tick', 'common', 'arachnid', ['fight'], 'Small, patient, and holds on forever.'],
  ['stink_bug', 'Stink Bug', 'common', 'crawler', ['fight', 'build'], 'Its defence is a smell nobody forgets.'],

  ['grasshopper', 'Grasshopper', 'uncommon', 'hopper', ['fly', 'cut'], 'Can leap twenty times its own length.'],
  ['bee', 'Honeybee', 'uncommon', 'flyer', ['build', 'fly', 'fight'], 'Builds perfect hexagons and defends them bravely.'],
  ['butterfly', 'Sky Butterfly', 'uncommon', 'flyer', ['fly'], 'Drifts between flowers on bright blue wings.'],
  ['damselfly', 'Damselfly', 'uncommon', 'flyer', ['fly', 'fight'], 'A slender jewel that folds its wings at rest.'],
  ['firefly', 'Firefly', 'uncommon', 'flyer', ['fly', 'build'], 'Writes glowing messages across the dusk.'],
  ['centipede', 'Centipede', 'uncommon', 'wriggler', ['fight', 'cut'], 'A fast, fierce hunter of the leaf litter.'],
  ['harvestman', 'Harvestman', 'uncommon', 'arachnid', ['cut', 'lift'], 'Not quite a spider, all the way legs.'],
  ['garden_spider', 'Garden Spider', 'uncommon', 'arachnid', ['build', 'fight'], 'Weaves a brand-new orb web every single morning.'],
  ['spider', 'House Spider', 'uncommon', 'arachnid', ['build', 'fight'], 'Lurks in corners, keeping the flies in check.'],
  ['stick_insect', 'Stick Insect', 'uncommon', 'crawler', ['build', 'lift'], 'Spends its life pretending to be a twig.'],
  ['dung_beetle', 'Dung Beetle', 'uncommon', 'beetle', ['lift', 'dig', 'build'], 'Navigates by the stars of the Milky Way.'],
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
];

export const SPECIES_LIST = RAW.map(([id, name, rarity, family, traits, desc], index) => ({
  id, name, rarity, family, traits, desc, index, sprite: `8x/${id}.png`,
}));

export const SPECIES = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s]));
