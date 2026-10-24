// Encounter catalogue. The engine (systems/encounters.js) picks from these by
// area and weight, so new encounters are added here without touching code.
//
// Fields
//   id, category: discovery | treasure | challenge | special | chest
//   areas: list of area ids, or omit for every area
//   weight: relative pick weight; special: true means special-find bonuses raise it
//   maxPerRun: cap per expedition; needsTrait: only appears if the party has it
//   intro: what the party runs into (string, list, or { areaId: list })
//   check: { traits: [one or more acceptable traits], difficulty: +/- vs area }
//          The party's best acceptable trait is used.
//   success / fail / great (great is optional): outcome for checks
//   result: outcome for encounters without a check
// Outcome fields
//   text: log line. {bug} = credited bug, {trait} = trait used
//   coins: [min, max] multiples of the area's coinBase
//   loot: chance of a roll on the area loot table; gear: chance of a gear-only roll
//   egg: chance of an egg from the area's egg table; items: fixed [[id, n]]
const any = undefined;

export const ENCOUNTERS = [
  // ---------- simple discoveries ----------
  { id: 'coin_trail', category: 'discovery', areas: any, weight: 8,
    intro: ['A trail of dropped coins glints along the path.', 'Something sparkles under a leaf.'],
    result: { text: 'The party scoops up the coins.', coins: [0.6, 1] } },
  { id: 'food_stash', category: 'discovery', areas: any, weight: 5,
    intro: ['A squirrel\'s forgotten food stash!', 'Sweet nectar drips from a broken stem.'],
    result: { text: 'The party packs up some food for later.', coins: [0.2, 0.4], items: [['honey_drop', 2]] } },
  { id: 'hidden_cache', category: 'discovery', areas: any, weight: 4, special: true,
    intro: ['A hollow log hides a forgotten cache.', 'Someone left a little bundle tucked under a stone.'],
    result: { text: 'Inside: coins and a few odds and ends.', coins: [0.8, 1.3], loot: 0.7 } },
  { id: 'campsite', category: 'discovery', areas: any, weight: 4,
    intro: 'The party finds an abandoned campsite.',
    result: { text: 'They rest by the old fire pit and search the packs left behind.', coins: [0.4, 0.7], loot: 0.5 } },
  { id: 'mysterious_egg', category: 'discovery', areas: any, weight: 0.5, special: true, maxPerRun: 2,
    intro: 'Something round and warm sits all alone...',
    result: { text: 'A mysterious egg! The party carries it home carefully.', coins: [0, 0], egg: 1 } },
  { id: 'friendly_creature', category: 'discovery', areas: any, weight: 4,
    intro: {
      garden: ['A friendly snail shares a shortcut.', 'An old toad tells stories of the garden.'],
      forest: ['A wise owl hoots directions through the mist.', 'A hedgehog points the way with its nose.'],
      caves: ['A glow-worm lights the way ahead.', 'A blind cave fish waves a fin hello.'],
      volcano: ['A heat-loving lizard shows the cool path.', 'A salamander basks happily nearby.'],
      aether: ['A cloud whale drifts past, humming.', 'A star-moth circles the party, curious.'],
    },
    result: { text: 'The party makes a new friend and finds a few coins along the way.', coins: [0.3, 0.5] } },
  { id: 'unusual_place', category: 'special', areas: any, weight: 3, special: true,
    intro: {
      garden: ['A fairy ring of mushrooms.', 'A forgotten garden gnome, covered in moss.'],
      forest: ['A tree with a door in its trunk.', 'A circle of standing stones in the fog.'],
      caves: ['An underground lake that glows blue.', 'A cavern ringing with crystal chimes.'],
      volcano: ['A glassy obsidian mirror.', 'A geyser shaped like a giant beetle.'],
      aether: ['A staircase leading into the clouds.', 'A garden floating upside down.'],
    },
    result: { text: 'The party explores the strange place and finds something unusual.', coins: [0.5, 0.9], loot: 1 } },

  // ---------- treasure ----------
  { id: 'locked_chest', category: 'chest', areas: any, weight: 4, special: true, maxPerRun: 4,
    intro: 'The party discovers a locked treasure chest!' },
  { id: 'buried_treasure', category: 'treasure', areas: any, weight: 4, special: true,
    intro: ['An X is scratched into the dirt.', 'Something metal pokes out of the ground.'],
    check: { traits: ['dig'], difficulty: 1 },
    success: { text: '{bug} digs up a buried treasure pouch!', coins: [1.4, 2], loot: 0.5 },
    great: { text: '{bug} digs deep and unearths a whole buried hoard!', coins: [2, 2.8], loot: 1, egg: 0.04 },
    fail: { text: 'The ground is too hard. The party only scrapes up a few coins.', coins: [0.07, 0.1] } },
  { id: 'bramble_stash', category: 'treasure', areas: any, weight: 3, special: true,
    intro: 'A concealed stash sits behind a wall of thorny brambles.',
    check: { traits: ['cut'], difficulty: 1 },
    success: { text: '{bug} slices a way through to the stash.', coins: [1.2, 1.6], loot: 0.7 },
    fail: { text: 'The thorns are too thick. They grab what they can reach.', coins: [0.07, 0.13] } },
  { id: 'high_pouch', category: 'treasure', areas: any, weight: 3,
    intro: ['A pouch of coins dangles from a high branch.', 'Treasure glitters on a ledge far above.'],
    check: { traits: ['fly'], difficulty: 0 },
    success: { text: '{bug} flutters up and retrieves it!', coins: [1.4, 2] },
    fail: { text: 'Nobody can reach it. The party moves on, looking up wistfully.', coins: [0.03, 0.07] } },
  { id: 'rare_gear', category: 'treasure', areas: any, weight: 1.5, special: true, maxPerRun: 2,
    intro: 'Something glints under a pile of old leaves...',
    check: { traits: ['lift', 'dig'], difficulty: 0 },
    success: { text: '{bug} clears the pile and finds a piece of equipment!', coins: [0.4, 0.6], gear: 1 },
    fail: { text: 'It\'s stuck fast. The party leaves with a few coins.', coins: [0.1, 0.17] } },
  { id: 'airborne_treasure', category: 'special', areas: any, weight: 2, needsTrait: 'fly', special: true,
    intro: 'A gust of wind carries a sparkling seed pod overhead!',
    check: { traits: ['fly'], difficulty: 2 },
    success: { text: '{bug} snatches it out of the air. It\'s full of treasure!', coins: [1.5, 2.2], loot: 1 },
    fail: { text: 'It drifts out of reach.', coins: [0, 0.03] } },

  // ---------- trait challenges ----------
  { id: 'fallen_tree', category: 'challenge', areas: ['garden', 'forest'], weight: 5,
    intro: ['A fallen tree blocks the path.', 'A heavy branch has dropped across the trail.'],
    check: { traits: ['lift'], difficulty: 0 },
    success: { text: '{bug} heaves it aside!', coins: [1, 1.3] },
    fail: { text: 'Too heavy. The party takes the long way around.', coins: [0.13, 0.2] } },
  { id: 'heavy_boulder', category: 'challenge', areas: ['caves', 'volcano'], weight: 5,
    intro: ['A boulder has rolled across the tunnel.', 'A slab of rock blocks the passage.'],
    check: { traits: ['lift'], difficulty: 1 },
    success: { text: '{bug} rolls it out of the way, revealing coins beneath.', coins: [1.1, 1.5] },
    fail: { text: 'It won\'t budge. The party squeezes through a narrow gap instead.', coins: [0.13, 0.2] } },
  { id: 'raise_gate', category: 'challenge', areas: ['caves', 'aether'], weight: 3,
    intro: 'An ancient gate bars the way.',
    check: { traits: ['lift'], difficulty: 2 },
    success: { text: '{bug} raises the gate. A treasure room lies beyond!', coins: [1.3, 1.8], loot: 0.5 },
    fail: { text: 'The gate stays shut. They find another way.', coins: [0.13, 0.17] } },
  { id: 'vines', category: 'challenge', areas: ['garden', 'forest'], weight: 5,
    intro: ['Tangled vines choke the path.', 'A curtain of creepers hangs across the trail.'],
    check: { traits: ['cut'], difficulty: 0 },
    success: { text: '{bug} slices through the vines.', coins: [1, 1.3] },
    fail: { text: 'The party wriggles through the tangle, slowly.', coins: [0.13, 0.2] } },
  { id: 'crystal_web', category: 'challenge', areas: ['caves', 'aether'], weight: 4,
    intro: 'Glittering crystal threads web the tunnel shut.',
    check: { traits: ['cut'], difficulty: 1 },
    success: { text: '{bug} cuts a clean path and pockets a few crystals.', coins: [1, 1.4], loot: 0.4 },
    fail: { text: 'The threads are too tough. A long detour follows.', coins: [0.13, 0.2] } },
  { id: 'hostile_creature', category: 'challenge', areas: any, weight: 6,
    intro: {
      garden: ['A grumpy wasp guards the path!', 'A territorial beetle blocks the way!'],
      forest: ['A hungry shrew sniffs at the party!', 'A mob of mist-mites attacks!'],
      caves: ['A swarm of cave crickets surrounds the party!', 'A giant cave spider descends!'],
      volcano: ['Fire ants pour out of a crack!', 'A lava lizard snaps at the party!'],
      aether: ['Storm sprites crackle with lightning!', 'A sky serpent coils around the island!'],
    },
    check: { traits: ['fight'], difficulty: 1 },
    success: { text: '{bug} bravely drives it off and finds what it was guarding.', coins: [1.2, 1.6], loot: 0.3 },
    great: { text: '{bug} wins so convincingly the creature hands over its treasure!', coins: [1.8, 2.4], loot: 0.8 },
    fail: { text: 'The party hides until it leaves.', coins: [0.1, 0.17] } },
  { id: 'gap', category: 'challenge', areas: any, weight: 5,
    intro: ['A wide gap splits the trail.', 'The path ends at a cliff edge with a ledge across.'],
    check: { traits: ['fly'], difficulty: 0 },
    success: { text: '{bug} flies a guide-thread across and everyone crosses safely.', coins: [1, 1.3] },
    fail: { text: 'No way across. They climb all the way down and back up.', coins: [0.13, 0.2] } },
  { id: 'tunnel', category: 'challenge', areas: any, weight: 5,
    intro: { garden: 'A root-wall blocks the way, but the soil beneath looks soft.', forest: 'A rockfall blocks the path ahead.', caves: 'The tunnel ends in loose rubble.', volcano: 'Cooled lava seals the passage.', aether: 'A cloud-bank has hardened into a wall.' },
    check: { traits: ['dig'], difficulty: 0 },
    success: { text: '{bug} digs a tunnel straight through, finding coins on the way.', coins: [1, 1.4] },
    fail: { text: 'The party finds a long way around.', coins: [0.13, 0.2] } },
  { id: 'broken_bridge', category: 'challenge', areas: any, weight: 5,
    intro: ['A rickety bridge has collapsed.', 'The old plank crossing is broken.'],
    check: { traits: ['build'], difficulty: 0 },
    success: { text: '{bug} builds a sturdy new crossing.', coins: [1, 1.3] },
    fail: { text: 'The party wades through the mud instead.', coins: [0.13, 0.2] } },
  { id: 'reinforce', category: 'challenge', areas: ['caves', 'volcano'], weight: 3,
    intro: 'The tunnel ceiling creaks and drips dust.',
    check: { traits: ['build'], difficulty: 2 },
    success: { text: '{bug} props it up, uncovering a seam of treasure.', coins: [1.3, 1.7], loot: 0.5 },
    fail: { text: 'They hurry through, nervously.', coins: [0.1, 0.17] } },

  // ---------- multi-solution and environmental ----------
  { id: 'stream', category: 'challenge', areas: ['garden', 'forest'], weight: 4,
    intro: 'A rushing stream cuts across the path.',
    check: { traits: ['build', 'fly'], difficulty: 0 },
    success: { text: '{bug} gets everyone across using {trait}.', coins: [1, 1.3] },
    fail: { text: 'They follow the bank for ages before finding a crossing.', coins: [0.1, 0.17] } },
  { id: 'stone_door', category: 'challenge', areas: ['forest', 'caves', 'aether'], weight: 3,
    intro: 'A heavy stone door seals an old ruin.',
    check: { traits: ['lift', 'dig'], difficulty: 1 },
    success: { text: '{bug} uses {trait} to get inside. There\'s treasure!', coins: [1.4, 1.9], loot: 0.6 },
    fail: { text: 'The ruin stays sealed.', coins: [0.1, 0.13] } },
  { id: 'overgrown_ruin', category: 'challenge', areas: ['forest', 'aether'], weight: 3,
    intro: 'An overgrown ruin is half-buried in moss.',
    check: { traits: ['cut', 'build'], difficulty: 1 },
    success: { text: '{bug} clears a way in with {trait}.', coins: [1.3, 1.7], loot: 0.5 },
    fail: { text: 'Too overgrown to explore.', coins: [0.1, 0.13] } },
  { id: 'lava_flow', category: 'challenge', areas: ['volcano'], weight: 5,
    intro: ['A river of lava blocks the path!', 'Molten rock bubbles across the trail.'],
    check: { traits: ['build', 'fly'], difficulty: 1 },
    success: { text: '{bug} gets the party over the lava with {trait}.', coins: [1.2, 1.6] },
    fail: { text: 'They wait for it to cool and cross on the crust.', coins: [0.1, 0.17] } },
  { id: 'floating_island', category: 'challenge', areas: ['aether'], weight: 5,
    intro: 'The next island floats just out of reach.',
    check: { traits: ['fly', 'build'], difficulty: 1 },
    success: { text: '{bug} bridges the sky with {trait}.', coins: [1.2, 1.6] },
    fail: { text: 'They wait for the islands to drift together.', coins: [0.1, 0.17] } },
  { id: 'unstable_ground', category: 'special', areas: ['caves', 'volcano', 'aether'], weight: 3,
    intro: 'Dangerous terrain: the ground ahead is cracked and unstable!',
    check: { traits: ['fly', 'dig', 'build'], difficulty: 1 },
    success: { text: '{bug} finds safe footing with {trait}.', coins: [1, 1.3] },
    fail: { text: 'Slow going, but everyone makes it across.', coins: [0.1, 0.17] } },
  { id: 'hidden_shortcut', category: 'special', areas: any, weight: 2.5, special: true,
    intro: 'A faint draft hints at a hidden passage...',
    check: { traits: ['dig', 'cut'], difficulty: 1 },
    success: { text: '{bug} opens a hidden shortcut, full of forgotten treasure.', coins: [1.3, 1.8], loot: 0.6 },
    fail: { text: 'The passage stays hidden.', coins: [0.07, 0.1] } },
];

export const ENCOUNTER_BY_ID = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e]));

// Chest contents when opened with a key, or pried open with a strong Lift check.
export const CHEST = {
  pryTrait: 'lift',
  pryDifficulty: 4, // added to the area difficulty
  pryCoinFraction: 0.5, // pried chests give only coins, at half value
  lootRolls: [1, 2],
};
