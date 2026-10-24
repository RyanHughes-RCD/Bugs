// Egg types. rarityBonus tilts hatch odds toward rarer bugs (see systems/eggs.js).
// pool: 'area' = that area's habitat species, 'unlocked' = every unlocked area, 'all' = every species.
// colors map the egg sprite template's 1/2/3 channels to palette characters.
export const EGGS = {
  garden_egg:  { name: 'Garden Egg',  pool: 'unlocked', hatchMs: 3 * 60e3,  rarityBonus: 0,    price: 80,   colors: { 1: 'W', 2: 'g', 3: 'l' }, desc: 'A plain egg from the garden. Could be anything you have discovered nearby.' },
  meadow_egg:  { name: 'Meadow Egg',  pool: 'area', area: 'meadow', hatchMs: 2 * 60e3,  rarityBonus: 0,    price: 50,   colors: { 1: 'g', 2: 'Y', 3: 'G' }, desc: 'Warm from the sun. Hatches a Sunny Meadow bug.' },
  pond_egg:    { name: 'Pond Egg',    pool: 'area', area: 'pond',   hatchMs: 5 * 60e3,  rarityBonus: 0.1,  price: 120,  colors: { 1: 'C', 2: 'b', 3: 'c' }, desc: 'Cool and a little damp. Hatches a Lily Pond bug.' },
  woods_egg:   { name: 'Woods Egg',   pool: 'area', area: 'woods',  hatchMs: 10 * 60e3, rarityBonus: 0.2,  price: 250,  colors: { 1: 'n', 2: 'G', 3: 'N' }, desc: 'Smells of moss and oak. Hatches an Old Oak Woods bug.' },
  dune_egg:    { name: 'Dune Egg',    pool: 'area', area: 'dunes',  hatchMs: 15 * 60e3, rarityBonus: 0.3,  price: 500,  colors: { 1: 'Y', 2: 'r', 3: 'n' }, desc: 'Sun-baked and speckled. Hatches a Dusty Dunes bug.' },
  jungle_egg:  { name: 'Jungle Egg',  pool: 'area', area: 'jungle', hatchMs: 25 * 60e3, rarityBonus: 0.4,  price: 900,  colors: { 1: 'P', 2: 'C', 3: 'b' }, desc: 'Faintly glowing. Hatches a Moonlit Jungle bug.' },
  golden_egg:  { name: 'Golden Egg',  pool: 'unlocked', hatchMs: 20 * 60e3, rarityBonus: 0.6, price: 1200, shinyMult: 2, traitBonus: 0.2, colors: { 1: 'Y', 2: 'W', 3: 'r' }, desc: 'Heavy with promise. Much better odds of rare bugs and shinies.' },
  chrysalis:   { name: 'Chrysalis',   pool: 'all', hatchMs: 45 * 60e3, rarityBonus: 0.7, minRarity: 'rare', price: 2500, traitBonus: 0.3, sprite: '8x/chrysalis.png', desc: 'Something magnificent is forming inside. Always Rare or better.' },
};

export const BASE_SHINY_CHANCE = 1 / 50;
