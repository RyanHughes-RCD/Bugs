// The garden's day/night cycle, from the clock on the player's own device
// (local time, so it follows their phone's time zone).
//
// Keyframes by hour: `dark` is how night-like it is (0 day, 1 deep night) and
// drives the darkness, lights and sleepy bugs; `tint` is the colour washed
// over the garden [r, g, b, alpha]. Between keyframes everything blends.
const KEYS = [
  { h: 0, dark: 1, tint: [8, 10, 40, 0.68] },
  { h: 4.5, dark: 1, tint: [8, 10, 40, 0.68] },
  { h: 6, dark: 0.45, tint: [120, 80, 130, 0.3] },
  { h: 7, dark: 0.1, tint: [255, 160, 110, 0.16] },
  { h: 8.5, dark: 0, tint: [255, 230, 190, 0] },
  { h: 17, dark: 0, tint: [255, 230, 190, 0] },
  { h: 18.5, dark: 0.05, tint: [255, 130, 50, 0.2] },
  { h: 19.75, dark: 0.45, tint: [190, 60, 120, 0.32] },
  { h: 21, dark: 1, tint: [8, 10, 40, 0.68] },
  { h: 24, dark: 1, tint: [8, 10, 40, 0.68] },
];

export function hourOf(ts) {
  const d = new Date(ts);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function daylight(ts) {
  const h = hourOf(ts);
  let i = 0;
  while (KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const mix = (x, y) => x + (y - x) * t;
  const dark = mix(a.dark, b.dark);
  const tint = a.tint.map((v, k) => mix(v, b.tint[k]));
  const phase = dark >= 0.7 ? 'night' : dark > 0.02 || tint[3] > 0.02 ? (h < 12 ? 'dawn' : 'dusk') : 'day';
  return { hour: h, dark, tint, phase };
}

export const timeOfDay = (ts) => daylight(ts).phase;
