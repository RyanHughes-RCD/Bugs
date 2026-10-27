import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daylight } from '../game/js/systems/daylight.js';

// Local times on the device's own clock.
const at = (h, m = 0) => new Date(2026, 5, 1, h, m).getTime();

test('the garden follows the device clock: dark at night, clear by day', () => {
  assert.equal(daylight(at(2)).phase, 'night');
  assert.equal(daylight(at(2)).dark, 1);
  assert.equal(daylight(at(13)).phase, 'day');
  assert.equal(daylight(at(13)).dark, 0);
  assert.equal(daylight(at(13)).tint[3], 0);
  assert.equal(daylight(at(6, 30)).phase, 'dawn');
  assert.equal(daylight(at(19, 30)).phase, 'dusk');
  assert.equal(daylight(at(23, 59)).phase, 'night');
});

test('dusk and dawn blend smoothly, minute by minute', () => {
  for (let m = 0; m < 24 * 60 - 1; m++) {
    const a = daylight(at(0, m));
    const b = daylight(at(0, m + 1));
    assert.ok(Math.abs(a.dark - b.dark) < 0.02, `jump at minute ${m}`);
    assert.ok(Math.abs(a.tint[3] - b.tint[3]) < 0.01, `tint jump at minute ${m}`);
    assert.ok(a.dark >= 0 && a.dark <= 1);
  }
});
