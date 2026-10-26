// Chests opened from the garden by spending Chest Keys: a way to use spare
// keys, deliberately worth less than the chests found on expeditions.
//
// Each tier draws from the chest table of your best open area, up to
// maxArea, then pays less of everything than an expedition chest there:
//   coinFactor:  share of that area's chest coins (expedition chests also get
//                Better Finds and item bonuses; these don't)
//   rolls:       [min, max] loot rolls (expedition chests roll 1-2)
//   eggFactor:   share of that area's chest egg chance
// Garden chests never contain keys or relic-tier items.
export const GARDEN_CHESTS = [
  { id: 'small', name: 'Small Chest', keys: 1, maxArea: 'forest', coinFactor: 0.5, rolls: [1, 1], eggFactor: 0.4, desc: 'A little box of odds and ends.' },
  { id: 'sturdy', name: 'Sturdy Chest', keys: 2, maxArea: 'aether', coinFactor: 0.7, rolls: [1, 1], eggFactor: 0.6, desc: 'Iron-banded and heavy. Better finds from further afield.' },
  { id: 'grand', name: 'Grand Chest', keys: 4, maxArea: 'new_jersey', coinFactor: 0.85, rolls: [1, 2], eggFactor: 0.8, desc: 'Gilded and gleaming, stocked from the furthest place you have been.' },
];

export const GARDEN_CHEST_BY_ID = Object.fromEntries(GARDEN_CHESTS.map((c) => [c.id, c]));
