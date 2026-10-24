// Bug species. Every id matches a sprite in /8x/<id>.png (16x16 art upscaled 8x).

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITIES = {
  common:    { id: 'common',    name: 'Common',    color: '#94b0c2', weight: 50,  total: 40, capture: 0.35, sell: 8,   dexReward: 10,  income: 1,  traitChance2: 0.15 },
  uncommon:  { id: 'uncommon',  name: 'Uncommon',  color: '#38b764', weight: 25,  total: 47, capture: 0.25, sell: 20,  dexReward: 20,  income: 2,  traitChance2: 0.25 },
  rare:      { id: 'rare',      name: 'Rare',      color: '#41a6f6', weight: 12,  total: 55, capture: 0.15, sell: 50,  dexReward: 40,  income: 4,  traitChance2: 0.40 },
  epic:      { id: 'epic',      name: 'Epic',      color: '#c86ee0', weight: 5,   total: 64, capture: 0.08, sell: 120, dexReward: 80,  income: 7,  traitChance2: 0.55 },
  legendary: { id: 'legendary', name: 'Legendary', color: '#ffcd75', weight: 1.5, total: 75, capture: 0.04, sell: 300, dexReward: 150, income: 12, traitChance2: 0.75 },
};

// Share of the rarity's stat total that goes to each stat.
export const ROLES = {
  tank:     { name: 'Tank',     hp: 0.40, atk: 0.17, def: 0.31, spd: 0.12 },
  striker:  { name: 'Striker',  hp: 0.26, atk: 0.38, def: 0.15, spd: 0.21 },
  speedy:   { name: 'Speedy',   hp: 0.26, atk: 0.24, def: 0.12, spd: 0.38 },
  balanced: { name: 'Balanced', hp: 0.30, atk: 0.25, def: 0.20, spd: 0.25 },
};

// Families drive garden behaviour (flyers hover, wrigglers creep slowly).
export const FAMILIES = {
  crawler: 'Crawler', beetle: 'Beetle', flyer: 'Flyer', arachnid: 'Arachnid', wriggler: 'Wriggler', hopper: 'Hopper',
};

// id, name, rarity, role, family, habitats, description
const RAW = [
  // Sunny Meadow
  ['ant', 'Worker Ant', 'common', 'striker', 'crawler', ['meadow'], 'Carries ten times its weight and never takes a day off.'],
  ['aphid', 'Aphid', 'common', 'speedy', 'crawler', ['meadow', 'pond'], 'Tiny, green and always hungry for fresh shoots.'],
  ['ladybug', 'Ladybug', 'common', 'tank', 'beetle', ['meadow'], 'Seven spots of pure good luck.'],
  ['worm', 'Earthworm', 'common', 'tank', 'wriggler', ['meadow'], 'Turns the soil so the whole garden can grow.'],
  ['caterpillar', 'Caterpillar', 'common', 'balanced', 'wriggler', ['meadow'], 'Munching its way toward something wonderful.'],
  ['cricket', 'Field Cricket', 'common', 'balanced', 'hopper', ['meadow'], 'Sings the meadow to sleep every evening.'],
  ['leafhopper', 'Leafhopper', 'common', 'speedy', 'hopper', ['meadow', 'pond'], 'Gone in a flick before you can blink.'],
  ['housefly', 'Housefly', 'common', 'speedy', 'flyer', ['meadow'], 'Buzzes in circles. Somehow always lands on lunch.'],
  ['pill_bug', 'Pill Bug', 'common', 'tank', 'crawler', ['meadow', 'woods'], 'Rolls into an armoured ball at the first sign of trouble.'],
  ['grasshopper', 'Grasshopper', 'uncommon', 'speedy', 'hopper', ['meadow'], 'Can leap twenty times its own length.'],
  ['bee', 'Honeybee', 'uncommon', 'striker', 'flyer', ['meadow'], 'A busy pollinator with a stinging sense of duty.'],
  ['butterfly', 'Sky Butterfly', 'uncommon', 'speedy', 'flyer', ['meadow'], 'Drifts between flowers on bright blue wings.'],
  ['bumblebee', 'Bumblebee', 'rare', 'tank', 'flyer', ['meadow'], 'Fuzzy, round, and much tougher than it looks.'],
  // Lily Pond
  ['water_strider', 'Water Strider', 'common', 'speedy', 'crawler', ['pond'], 'Skates across the pond on the surface tension.'],
  ['mosquito', 'Mosquito', 'common', 'speedy', 'flyer', ['pond'], 'Whines in your ear at the worst possible moment.'],
  ['crane_fly', 'Crane Fly', 'common', 'balanced', 'flyer', ['pond'], 'All legs and no idea where it is going.'],
  ['slug', 'Garden Slug', 'common', 'tank', 'wriggler', ['pond', 'woods'], 'Leaves a shimmering trail wherever it wanders.'],
  ['snail', 'Snail', 'common', 'tank', 'wriggler', ['pond', 'meadow'], 'Carries its house everywhere. Never in a hurry.'],
  ['damselfly', 'Damselfly', 'uncommon', 'speedy', 'flyer', ['pond'], 'A slender jewel that folds its wings at rest.'],
  ['firefly', 'Firefly', 'uncommon', 'balanced', 'flyer', ['pond', 'jungle'], 'Writes glowing messages across the dusk.'],
  ['dragonfly', 'Dragonfly', 'rare', 'striker', 'flyer', ['pond'], 'An ancient aerial hunter with near-perfect aim.'],
  ['leaf_insect', 'Leaf Insect', 'rare', 'tank', 'crawler', ['pond', 'jungle'], 'Indistinguishable from a leaf, even to other leaves.'],
  // Old Oak Woods
  ['millipede', 'Millipede', 'common', 'tank', 'wriggler', ['woods'], 'Hundreds of legs moving in perfect rhythm.'],
  ['earwig', 'Earwig', 'common', 'striker', 'crawler', ['woods'], 'Waves its pincers to look far scarier than it is.'],
  ['moth', 'Dusk Moth', 'common', 'balanced', 'flyer', ['woods'], 'Can never resist a warm glowing light.'],
  ['cockroach', 'Cockroach', 'common', 'speedy', 'crawler', ['woods'], 'Survives absolutely everything.'],
  ['termite', 'Termite', 'common', 'balanced', 'crawler', ['woods'], 'A master architect of wooden cities.'],
  ['weevil', 'Weevil', 'common', 'tank', 'beetle', ['woods'], 'Its long snout is perfect for drilling acorns.'],
  ['grub', 'Beetle Grub', 'common', 'tank', 'wriggler', ['woods', 'meadow'], 'Sleepy, chubby, and dreaming of becoming a beetle.'],
  ['centipede', 'Centipede', 'uncommon', 'striker', 'wriggler', ['woods'], 'A fast, fierce hunter of the leaf litter.'],
  ['harvestman', 'Harvestman', 'uncommon', 'speedy', 'arachnid', ['woods'], 'Not quite a spider, all the way legs.'],
  ['garden_spider', 'Garden Spider', 'uncommon', 'striker', 'arachnid', ['woods', 'meadow'], 'Weaves a brand-new orb web every single morning.'],
  ['spider', 'House Spider', 'uncommon', 'striker', 'arachnid', ['woods'], 'Lurks in corners, keeping the flies in check.'],
  ['stick_insect', 'Stick Insect', 'uncommon', 'tank', 'crawler', ['woods', 'jungle'], 'Spends its life pretending to be a twig.'],
  ['stag_beetle', 'Stag Beetle', 'rare', 'striker', 'beetle', ['woods'], 'Duels rivals with magnificent antler-like jaws.'],
  ['rhino_beetle', 'Rhino Beetle', 'epic', 'tank', 'beetle', ['woods', 'jungle'], 'Can lift 850 times its own weight. A true titan.'],
  // Dusty Dunes
  ['firebug', 'Firebug', 'common', 'balanced', 'crawler', ['dunes'], 'Red and black warning colours, baked in the sun.'],
  ['silverfish', 'Silverfish', 'common', 'speedy', 'crawler', ['dunes'], 'Slips through the sand like quicksilver.'],
  ['tick', 'Tick', 'common', 'striker', 'arachnid', ['dunes'], 'Small, patient, and holds on forever.'],
  ['stink_bug', 'Stink Bug', 'common', 'tank', 'crawler', ['dunes'], 'Its defence is a smell nobody forgets.'],
  ['dung_beetle', 'Dung Beetle', 'uncommon', 'tank', 'beetle', ['dunes'], 'Navigates by the stars of the Milky Way.'],
  ['cicada', 'Cicada', 'uncommon', 'balanced', 'flyer', ['dunes'], 'Sleeps underground for years, then sings for weeks.'],
  ['mole_cricket', 'Mole Cricket', 'uncommon', 'tank', 'hopper', ['dunes'], 'Digs tunnels with shovel-shaped front legs.'],
  ['flying_ant', 'Flying Ant', 'uncommon', 'speedy', 'flyer', ['dunes'], 'Takes to the sky to found a brand-new colony.'],
  ['tiger_beetle', 'Tiger Beetle', 'rare', 'speedy', 'beetle', ['dunes'], 'One of the fastest runners in the bug world.'],
  ['scorpion', 'Desert Scorpion', 'rare', 'striker', 'arachnid', ['dunes'], 'Glows faintly under moonlight. Mind the tail.'],
  ['tarantula', 'Tarantula', 'epic', 'tank', 'arachnid', ['dunes', 'jungle'], 'Large, hairy, and surprisingly gentle.'],
  ['jewel_beetle', 'Jewel Beetle', 'epic', 'balanced', 'beetle', ['dunes', 'jungle'], 'Its shell shimmers like a polished gemstone.'],
  // Moonlit Jungle
  ['wasp', 'Paper Wasp', 'rare', 'striker', 'flyer', ['jungle'], 'Builds paper palaces and defends them fiercely.'],
  ['monarch', 'Monarch', 'rare', 'speedy', 'flyer', ['jungle'], 'Flies thousands of miles following the sun.'],
  ['jumping_spider', 'Jumping Spider', 'rare', 'striker', 'arachnid', ['jungle'], 'Big curious eyes and an acrobat\'s pounce.'],
  ['hornet', 'Giant Hornet', 'epic', 'striker', 'flyer', ['jungle'], 'The undisputed terror of the canopy.'],
  ['blue_morpho', 'Blue Morpho', 'epic', 'speedy', 'flyer', ['jungle'], 'Flashes electric blue then vanishes into shadow.'],
  ['mantis', 'Moon Mantis', 'legendary', 'striker', 'crawler', ['jungle'], 'Prays to the moon, strikes like lightning.'],
  ['luna_moth', 'Luna Moth', 'legendary', 'speedy', 'flyer', ['jungle'], 'A pale green spirit of the midnight jungle.'],
];

function baseStats(rarity, role) {
  const total = RARITIES[rarity].total;
  const r = ROLES[role];
  return {
    hp: Math.round(total * r.hp * 1.6),
    atk: Math.round(total * r.atk),
    def: Math.round(total * r.def),
    spd: Math.round(total * r.spd),
  };
}

export const SPECIES_LIST = RAW.map(([id, name, rarity, role, family, habitats, desc], index) => ({
  id, name, rarity, role, family, habitats, desc, index,
  base: baseStats(rarity, role),
  sprite: `8x/${id}.png`,
}));

export const SPECIES = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s]));

export function speciesForArea(areaId) {
  return SPECIES_LIST.filter((s) => s.habitats.includes(areaId));
}
