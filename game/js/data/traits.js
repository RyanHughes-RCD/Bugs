// The six expedition traits. Every bug has at least one, each with its own level.
// icon: sprite id in data/sprites.js.
export const TRAITS = {
  lift:  { id: 'lift',  name: 'Lift',  icon: 'trait_lift',  color: '#ef7d57', verb: 'heaves',   desc: 'Move heavy objects, raise gates and debris, recover heavy treasure.' },
  cut:   { id: 'cut',   name: 'Cut',   icon: 'trait_cut',   color: '#38b764', verb: 'slices',   desc: 'Cut vines, clear dense plants, break through tangles.' },
  fight: { id: 'fight', name: 'Fight', icon: 'trait_fight', color: '#b13e53', verb: 'battles',  desc: 'Defeat hostile creatures and protect the party.' },
  fly:   { id: 'fly',   name: 'Fly',   icon: 'trait_fly',   color: '#41a6f6', verb: 'flutters', desc: 'Cross gaps, reach high places, catch airborne treasure.' },
  dig:   { id: 'dig',   name: 'Dig',   icon: 'trait_dig',   color: '#b07a4a', verb: 'digs',     desc: 'Dig tunnels and uncover buried treasure.' },
  build: { id: 'build', name: 'Build', icon: 'trait_build', color: '#ffcd75', verb: 'builds',   desc: 'Repair bridges, build crossings, reinforce structures.' },
};

export const TRAIT_IDS = Object.keys(TRAITS);
