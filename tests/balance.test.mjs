// Guards the difficulty curve so tuning changes don't make the game unwinnable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS } from '../game/js/data/areas.js';
import { planExpedition } from '../game/js/systems/expedition.js';
import { newGameState } from '../game/js/core/save.js';

const bug = (species, level, gear = null) => ({ uid: Math.random(), species, level, traits: [], shiny: false, gear });

function rates(area, team, { guardian = false, training = 0, n = 200 } = {}) {
  let retreat = 0;
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const st = newGameState(0, 1);
    st.upgrades.training = training;
    st.areas[area.id].runs = guardian ? 3 : 0;
    const { result } = planExpedition(st, area, team, [], i * 7919 + 13);
    retreat += result.retreated;
    wins += result.guardianDefeated;
  }
  return { retreat: retreat / n, wins: wins / n };
}

test('the starter team handles its first Sunny Meadow trip', () => {
  const r = rates(AREAS[0], ['ant', 'ladybug', 'pill_bug', 'caterpillar'].map((s) => bug(s, 1)));
  assert.ok(r.retreat < 0.12, `retreat ${r.retreat}`);
});

test('each guardian is beatable by a well-prepared team', () => {
  const teams = {
    meadow: { team: ['ant', 'ladybug', 'grasshopper', 'bee'].map((s) => bug(s, 4)) },
    pond: { team: ['bee', 'grasshopper', 'butterfly', 'bumblebee'].map((s) => bug(s, 9)) },
    woods: { team: ['stag_beetle', 'dragonfly', 'centipede', 'leaf_insect'].map((s) => bug(s, 14)) },
    dunes: { team: ['stag_beetle', 'dragonfly', 'rhino_beetle', 'scorpion'].map((s) => bug(s, 20)), training: 3 },
    jungle: { team: [bug('wasp', 24, 'stinger_blade'), bug('rhino_beetle', 24, 'amber_shell'), bug('tarantula', 22, 'firefly_lantern'), bug('monarch', 24, 'dew_wings')], training: 6 },
  };
  for (const area of AREAS) {
    const { team, training = 0 } = teams[area.id];
    const r = rates(area, team, { guardian: true, training, n: 120 });
    assert.ok(r.wins > 0.6, `${area.id} guardian win rate ${r.wins}`);
  }
});

test('under-levelled teams struggle in later areas', () => {
  const r = rates(AREAS[3], ['ant', 'ladybug', 'pill_bug', 'caterpillar'].map((s) => bug(s, 5)), { n: 80 });
  assert.ok(r.retreat > 0.8, `retreat ${r.retreat}`);
});
