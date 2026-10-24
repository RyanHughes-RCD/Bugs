import { SPECIES, SPECIES_LIST, RARITIES, RARITY_ORDER, ROLES, FAMILIES } from '../data/species.js';
import { TRAITS } from '../data/traits.js';
import { ITEMS, ITEM_TYPES, sellPrice } from '../data/items.js';
import { EGGS } from '../data/eggs.js';
import { AREAS, AREA_BY_ID, GUARDIAN_RUNS } from '../data/areas.js';
import { UPGRADES, upgradeCost } from '../data/upgrades.js';
import { computeStats, power, xpToNext, bugName, bugsOnExpedition, bugStatus, releaseValue, MAX_LEVEL, teamBonuses } from '../systems/bugs.js';
import { hatchOdds, nurseryCapacity, incubationMs } from '../systems/eggs.js';
import { MAX_TEAM, expeditionSlots, supplySlots, expeditionDurationMs, recommendedPower, teamPower, guardianDue } from '../systems/expedition.js';
import { gardenCap, gardenRatePerMin } from '../systems/garden.js';
import { FIXED_STOCK, priceOf, rotationEndsAt } from '../systems/shop.js';
import { areaSceneUrl } from './scenes.js';
import { esc, fmtTime, fmtNum, pct } from './format.js';

// ---------- small building blocks ----------

const icon = (A, id, cls = '') => `<img class="px icon ${cls}" src="${A.spriteUrl(id)}" alt="">`;
const bugImg = (A, species, shiny = false, cls = '') => `<img class="px bug-img ${shiny ? 'shiny' : ''} ${cls}" src="${A.bugUrl(species, shiny)}" alt="${esc(SPECIES[species].name)}">`;
const eggImg = (A, type, cls = '') => `<img class="px egg-img ${cls}" src="${A.eggUrl(type)}" alt="${esc(EGGS[type].name)}">`;
const itemImg = (A, id, cls = '') => (EGGS[id] ? eggImg(A, id, cls) : icon(A, id, cls));
const itemName = (id) => EGGS[id]?.name || ITEMS[id]?.name || id;
export const coins = (A, n) => `<span class="coins">${icon(A, 'coin', 'sm')}${fmtNum(n)}</span>`;
const rarityTag = (r) => `<span class="rarity r-${r}">${RARITIES[r].name}</span>`;
const countdown = (game, ends) => `<span data-ends="${ends}">${fmtTime(ends - game.now())}</span>`;
const bar = (frac, cls = '', start = null, ends = null) =>
  `<div class="bar ${cls}"><i style="width:${(frac * 100).toFixed(1)}%" ${start !== null ? `data-start="${start}" data-ends="${ends}"` : ''}></i></div>`;
const btn = (label, act, data = {}, cls = '', disabled = false) =>
  `<button class="btn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${disabled ? 'disabled' : ''}>${label}</button>`;
const traitChips = (bug) => bug.traits.map((t) => `<span class="trait" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>`).join('');

function statRows(stats, compare = null) {
  const max = { hp: 160, atk: 70, def: 60, spd: 70 };
  const label = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD' };
  return `<div class="stats">${Object.keys(label).map((k) => {
    const diff = compare ? stats[k] - compare[k] : 0;
    return `<div class="stat"><span>${label[k]}</span>${bar(Math.min(1, stats[k] / max[k]), `s-${k}`)}<b>${stats[k]}${diff ? `<em class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff}</em>` : ''}</b></div>`;
  }).join('')}</div>`;
}

function statusBadge(v, bug, status) {
  if (status === 'expedition') return '<span class="badge away">AWAY</span>';
  if (status === 'resting') return `<span class="badge rest">zz ${countdown(v.game, bug.restUntil)}</span>`;
  return '';
}

function bugCard(v, bug, { act = 'open-bug', selected = false, disabled = false, extra = '' } = {}) {
  const sp = SPECIES[bug.species];
  const status = bugStatus(bug, v.game.state, v.game.now());
  return `<button class="bug-card r-${sp.rarity} ${selected ? 'selected' : ''}" data-act="${act}" data-uid="${bug.uid}" ${disabled ? 'disabled' : ''}>
    ${bugImg(v.A, bug.species, bug.shiny)}
    <span class="bc-name">${esc(bugName(bug))}</span>
    <span class="bc-lv">Lv ${bug.level}${bug.shiny ? ' <span class="shiny-tag">SHINY</span>' : ''}</span>
    ${bug.gear ? `<span class="bc-gear">${icon(v.A, bug.gear, 'xs')}</span>` : ''}
    ${statusBadge(v, bug, status)}${extra}
  </button>`;
}

// ---------- top bar & garden HUD ----------

export function renderTopbar(v) {
  const st = v.game.state;
  const caught = Object.values(st.dex).filter((d) => d.caught).length;
  return `
    <div class="tb-coins" title="Coins">${coins(v.A, st.coins)}</div>
    <button class="tb-dex" data-act="nav" data-panel="bugs" data-tab="dex" title="Bugdex">${icon(v.A, 'star', 'sm')}<span>${caught}/${SPECIES_LIST.length}</span></button>
    <button class="tb-btn" data-act="settings" title="Settings">${icon(v.A, 'cog', 'sm')}</button>`;
}

export function renderHud(v) {
  const { game, A } = v;
  const st = game.state;
  const pot = Math.floor(st.garden.pot);
  const cap = gardenCap(st);
  const rate = gardenRatePerMin(st);
  const chips = [];
  for (const exp of st.expeditions) {
    const p = game.expeditionProgress(exp);
    const area = AREA_BY_ID[exp.areaId];
    chips.push(`<button class="chip ${p.done ? 'ready' : ''}" data-act="view-exp" data-id="${exp.id}">${icon(A, 'map', 'xs')}${area.short}
      ${p.done ? '<b>Back!</b>' : `${bar(p.fraction, 'mini', exp.startAt - (exp.bonusMs || 0), exp.startAt - (exp.bonusMs || 0) + exp.durationMs)}`}</button>`);
  }
  const readyEggs = st.eggs.filter((e) => e.startedAt && game.eggProgress(e).ready).length;
  if (readyEggs) chips.push(`<button class="chip ready" data-act="nav" data-panel="nursery">${eggImg(A, 'meadow_egg', 'xs')}<b>${readyEggs} egg${readyEggs > 1 ? 's' : ''} ready!</b></button>`);
  if (st.garden.visitor) chips.push(`<button class="chip visitor" data-act="visitor">${bugImg(A, st.garden.visitor.species, st.garden.visitor.shiny, 'xs')}<b>A wild visitor!</b></button>`);
  return `
    <button class="pot ${pot >= 1 ? 'has' : ''}" data-act="collect-garden">
      ${icon(A, 'coin')}<span><b>${fmtNum(pot)}</b>/${fmtNum(cap)}</span><small>+${rate.toFixed(1)}/min</small>
    </button>
    <div class="chips">${chips.join('')}</div>`;
}

// ---------- Bugs ----------

const SORTS = {
  rarity: (a, b) => RARITY_ORDER.indexOf(SPECIES[b.species].rarity) - RARITY_ORDER.indexOf(SPECIES[a.species].rarity) || b.level - a.level,
  level: (a, b) => b.level - a.level || a.uid - b.uid,
  power: null,
  newest: (a, b) => b.uid - a.uid,
};

export function renderBugs(v) {
  const { game, ui } = v;
  const st = game.state;
  const tabs = `<div class="tabs">${btn(`My Bugs (${st.bugs.length})`, 'bugs-tab', { tab: 'mine' }, ui.bugsTab === 'mine' ? 'on' : '')}${btn('Bugdex', 'bugs-tab', { tab: 'dex' }, ui.bugsTab === 'dex' ? 'on' : '')}</div>`;
  if (ui.bugsTab === 'dex') return tabs + renderDex(v);
  const sort = ui.bugSort || 'rarity';
  const list = [...st.bugs];
  if (sort === 'power') list.sort((a, b) => power(computeStats(b, st)) - power(computeStats(a, st)));
  else list.sort(SORTS[sort]);
  return `${tabs}
    <div class="row sort-row"><span>Sort:</span>${Object.keys(SORTS).map((k) => btn(k, 'bug-sort', { sort: k }, `sm ${sort === k ? 'on' : ''}`)).join('')}</div>
    <div class="bug-grid">${list.map((b) => bugCard(v, b)).join('')}</div>`;
}

function renderDex(v) {
  const st = v.game.state;
  const caught = SPECIES_LIST.filter((s) => st.dex[s.id]?.caught).length;
  const seen = SPECIES_LIST.filter((s) => st.dex[s.id]?.seen).length;
  return `<div class="dex-head"><b>${caught}</b> of ${SPECIES_LIST.length} discovered · ${seen} seen ${bar(caught / SPECIES_LIST.length, 'dex-bar')}
      <small>Discover a new species to earn a coin reward!</small></div>
    <div class="dex-grid">${SPECIES_LIST.map((s) => {
      const d = st.dex[s.id];
      const known = d?.caught;
      return `<button class="dex-cell r-${s.rarity} ${known ? 'known' : d?.seen ? 'seen' : 'unknown'}" data-act="open-species" data-id="${s.id}" ${d?.seen ? '' : 'disabled'}>
        <span class="dex-no">#${String(s.index + 1).padStart(2, '0')}</span>
        ${bugImg(v.A, s.id, false, known ? '' : 'sil')}
        <span class="dex-name">${d?.seen ? esc(s.name) : '???'}</span>
        ${known ? `<span class="dex-count">x${d.caught}</span>` : ''}
      </button>`;
    }).join('')}</div>`;
}

export function bugModal(v, uid) {
  const { game, A } = v;
  const st = game.state;
  const bug = game.bug(uid);
  if (!bug) return null;
  const sp = SPECIES[bug.species];
  const stats = computeStats(bug, st);
  const status = bugStatus(bug, st, game.now());
  const next = xpToNext(bug.level);
  const gear = bug.gear ? ITEMS[bug.gear] : null;
  const ownedGear = Object.keys(st.inventory).filter((id) => ITEMS[id]?.type === 'gear');
  return `<div class="modal-head r-${sp.rarity}">
      <div class="portrait r-${sp.rarity}">${bugImg(A, bug.species, bug.shiny, 'big')}</div>
      <div><h3>${esc(bugName(bug))} ${btn('rename', 'rename', { uid }, 'link')}</h3>
        <div>${rarityTag(sp.rarity)} ${bug.shiny ? '<span class="shiny-tag">SHINY</span>' : ''}</div>
        <small>${esc(sp.name)} · ${ROLES[sp.role].name} · ${FAMILIES[sp.family]}</small></div>
    </div>
    <div class="lvl-line"><b>Lv ${bug.level}</b>${bug.level < MAX_LEVEL ? `${bar(bug.xp / next, 'xp')}<small>${bug.xp}/${next} XP</small>` : '<small>MAX LEVEL</small>'}</div>
    <div class="status-line">${status === 'ready' ? 'In the garden, ready to explore.' : status === 'resting' ? `Resting for ${countdown(game, bug.restUntil)}` : 'Away on an expedition.'}
      · Power <b>${power(stats)}</b></div>
    ${statRows(stats)}
    <h4>Traits</h4><div class="traits">${bug.traits.map((t) => `<div class="trait-row"><span class="trait">${TRAITS[t].name}</span> ${esc(TRAITS[t].desc)}</div>`).join('')}</div>
    <h4>Gear</h4>
    <div class="gear-slot">${gear ? `${icon(A, bug.gear)} <div><b>${gear.name}</b><small>${gearStats(bug.gear)}</small></div> ${btn('Unequip', 'unequip', { uid }, 'sm', status === 'expedition')}` : '<span class="muted">Nothing equipped.</span>'}</div>
    ${status !== 'expedition' && ownedGear.length ? `<div class="gear-pick">${ownedGear.map((id) => `<button class="item-chip" data-act="equip" data-uid="${uid}" data-item="${id}">${icon(A, id, 'sm')}${ITEMS[id].name} x${st.inventory[id]}<small>${gearStats(id)}</small></button>`).join('')}</div>` : ''}
    <div class="row wrap actions">
      ${status === 'resting' ? btn(`${icon(A, 'honey_drop', 'xs')} Honey Drop (${st.inventory.honey_drop || 0})`, 'use-on-bug', { uid, item: 'honey_drop' }, '', !st.inventory.honey_drop) : ''}
      ${btn(`${icon(A, 'xp_nectar', 'xs')} Nectar (${st.inventory.xp_nectar || 0})`, 'use-on-bug', { uid, item: 'xp_nectar' }, '', !st.inventory.xp_nectar || bug.level >= MAX_LEVEL)}
      ${btn(`Release (+${releaseValue(bug)})`, 'release', { uid }, 'danger', status === 'expedition' || st.bugs.length <= 1)}
    </div>
    <p class="flavor">"${esc(sp.desc)}"</p>`;
}

function gearStats(id) {
  const it = ITEMS[id];
  const parts = Object.entries(it.stats || {}).map(([k, val]) => `${val > 0 ? '+' : ''}${val} ${k.toUpperCase()}`);
  if (it.team?.loot) parts.push(`+${pct(it.team.loot)} team loot`);
  return parts.join(', ');
}

export function speciesModal(v, id) {
  const { game, A } = v;
  const sp = SPECIES[id];
  const d = game.state.dex[id] || {};
  const base = computeStats({ species: id, level: 1, traits: [], shiny: false, gear: null }, { upgrades: {} });
  return `<div class="modal-head r-${sp.rarity}">
      <div class="portrait r-${sp.rarity}">${bugImg(A, id, false, `big ${d.caught ? '' : 'sil'}`)}</div>
      <div><h3>#${sp.index + 1} ${esc(sp.name)}</h3><div>${rarityTag(sp.rarity)}</div>
      <small>${ROLES[sp.role].name} · ${FAMILIES[sp.family]}</small></div>
    </div>
    <p class="flavor">"${esc(sp.desc)}"</p>
    <p><b>Found in:</b> ${sp.habitats.map((h) => AREA_BY_ID[h].name).join(', ')}</p>
    <p><b>Owned:</b> ${d.caught ? `${game.state.bugs.filter((b) => b.species === id).length} now · ${d.caught} discovered total` : 'Not yet caught — seen on an expedition.'}</p>
    <h4>Base stats (Lv 1)</h4>${statRows(base)}`;
}

// ---------- Explore ----------

export function renderExplore(v) {
  const { game, A } = v;
  const st = game.state;
  const active = st.expeditions.map((exp) => {
    const p = game.expeditionProgress(exp);
    const area = AREA_BY_ID[exp.areaId];
    const start = exp.startAt - (exp.bonusMs || 0);
    return `<div class="exp-card ${p.done ? 'done' : ''}">
      <div class="exp-top"><b>${area.name}</b><span>${p.done ? 'Back home!' : countdown(game, start + exp.durationMs)}</span></div>
      <div class="exp-team">${exp.team.map((uid) => { const b = game.bug(uid); return b ? bugImg(A, b.species, b.shiny, 'sm walk') : ''; }).join('')}</div>
      ${bar(p.fraction, 'exp', start, start + exp.durationMs)}
      <div class="row">${btn('Log', 'view-exp', { id: exp.id }, 'sm')}${p.done ? btn('Collect', 'collect-exp', { id: exp.id }, 'go') : btn(`${icon(A, 'sugar_cube', 'xs')} Sugar (${st.inventory.sugar_cube || 0})`, 'sugar', { id: exp.id }, 'sm', !st.inventory.sugar_cube)}</div>
    </div>`;
  }).join('');
  const slots = expeditionSlots(st);
  return `<div class="section-title">Expeditions <small>${st.expeditions.length}/${slots} teams out</small></div>
    ${active || '<p class="muted center">No teams out right now. Pick an area below to explore!</p>'}
    <div class="section-title">Areas</div>
    ${AREAS.map((a) => areaCard(v, a)).join('')}`;
}

function areaCard(v, area) {
  const { game, A } = v;
  const st = game.state;
  const as = st.areas[area.id];
  const busy = st.expeditions.some((e) => e.areaId === area.id);
  const prev = AREAS[area.index - 1];
  let guardian;
  if (as.guardianDefeated) guardian = `<span class="ok">Guardian ${area.guardian.name} defeated ✓</span>`;
  else if (guardianDue(st, area.id)) guardian = `<span class="warn">Guardian ${area.guardian.name} (Lv ${area.guardian.level}) awaits!</span>`;
  else guardian = `Guardian appears after ${GUARDIAN_RUNS - as.runs} more expedition${GUARDIAN_RUNS - as.runs > 1 ? 's' : ''}.`;
  let action;
  if (as.unlocked) {
    const slotsFull = st.expeditions.length >= expeditionSlots(st);
    action = btn(busy ? 'Team exploring...' : 'Plan expedition', 'plan', { area: area.id }, 'go', busy || slotsFull);
  } else if (st.areas[prev.id].guardianDefeated) {
    action = btn(`${icon(A, 'lock', 'xs')} Unlock for ${fmtNum(area.unlockCost)}`, 'unlock', { area: area.id }, 'go', st.coins < area.unlockCost);
  } else {
    action = `<span class="muted">${icon(A, 'lock', 'xs')} Defeat the ${prev.name} Guardian, then pay ${fmtNum(area.unlockCost)} coins.</span>`;
  }
  return `<div class="area-card ${as.unlocked ? '' : 'locked'}">
    <div class="area-banner px-bg" style="background-image:url(${areaSceneUrl(area.id, A.palette)})"><span>${area.index + 1}. ${area.name}</span></div>
    <div class="area-body">
      <p>${esc(area.desc)}</p>
      <div class="meta">Wild Lv ${area.levels[0]}–${area.levels[1]} · ${fmtTime(area.durationMs)} · ${area.encounters} encounters · Rec. power ${recommendedPower(area)}</div>
      <div class="meta">${as.unlocked ? `${guardian} · ${as.runs} run${as.runs === 1 ? '' : 's'}` : ''}</div>
      <div class="row">${action}</div>
    </div></div>`;
}

export function plannerModal(v) {
  const { game, A, ui } = v;
  const st = game.state;
  const plan = ui.plan;
  const area = AREA_BY_ID[plan.areaId];
  const away = bugsOnExpedition(st);
  const team = plan.team.map((u) => game.bug(u)).filter(Boolean);
  const tp = teamPower(st, team, area.id);
  const rec = recommendedPower(area);
  const dur = team.length ? expeditionDurationMs(st, area, team) : area.durationMs;
  const tb = teamBonuses(team);
  const ordered = [...st.bugs].sort((a, b) => {
    const sa = bugStatus(a, st, game.now(), away) === 'ready' ? 0 : 1;
    const sb = bugStatus(b, st, game.now(), away) === 'ready' ? 0 : 1;
    return sa - sb || power(computeStats(b, st, { areaId: area.id })) - power(computeStats(a, st, { areaId: area.id }));
  });
  const supplyIds = Object.keys(st.inventory).filter((id) => ITEMS[id]?.type === 'supply');
  const nSlots = supplySlots(st);
  const packedCount = (id) => plan.supplies.filter((s) => s === id).length;
  const ratio = tp / rec;
  const verdict = !team.length ? '' : ratio >= 1.15 ? '<span class="ok">Looks easy</span>' : ratio >= 0.9 ? '<span class="warn">Fair fight</span>' : '<span class="bad">Risky!</span>';
  return `<div class="area-banner px-bg small" style="background-image:url(${areaSceneUrl(area.id, A.palette)})"><span>${area.name}</span></div>
    ${guardianDue(st, area.id) ? `<p class="warn center">The Guardian ${area.guardian.name} (Lv ${area.guardian.level}) will block the path home!</p>` : ''}
    <div class="section-title">Team <small>${team.length}/${MAX_TEAM}</small> ${btn('Auto-pick', 'plan-auto', {}, 'sm')}</div>
    <div class="team-slots">${Array.from({ length: MAX_TEAM }, (_, i) => {
      const b = team[i];
      return b ? `<button class="slot filled" data-act="plan-toggle" data-uid="${b.uid}">${bugImg(A, b.species, b.shiny)}<small>Lv${b.level}</small></button>` : '<div class="slot">+</div>';
    }).join('')}</div>
    <div class="power-line">Team power <b>${tp}</b> / recommended ${rec} ${verdict}${bar(Math.min(1, tp / (rec * 1.3)), ratio >= 0.9 ? 'good' : 'risky')}</div>
    <div class="meta center">Duration ${fmtTime(dur)}${tb.loot ? ` · +${pct(tb.loot)} loot` : ''}${tb.capture ? ` · +${pct(tb.capture)} capture` : ''}</div>
    <div class="bug-grid compact">${ordered.map((b) => {
      const s = bugStatus(b, st, game.now(), away);
      return bugCard(v, b, { act: 'plan-toggle', selected: plan.team.includes(b.uid), disabled: s !== 'ready', extra: `<span class="bc-pow">${power(computeStats(b, st, { areaId: area.id }))}</span>` });
    }).join('')}</div>
    <div class="section-title">Supplies <small>${plan.supplies.length}/${nSlots}</small></div>
    <div class="supplies">${supplyIds.length ? supplyIds.map((id) => {
      const n = packedCount(id);
      return `<div class="supply ${n ? 'on' : ''}">${icon(A, id, 'sm')}<div><b>${ITEMS[id].name}</b> <small>x${st.inventory[id] - n} left</small><small>${esc(ITEMS[id].desc.replace('Supply: ', ''))}</small></div>
        ${n ? btn('−', 'plan-supply-remove', { item: id }, 'sm') : ''}${btn('+', 'plan-supply-add', { item: id }, 'sm', plan.supplies.length >= nSlots || n >= st.inventory[id])}</div>`;
    }).join('') : '<p class="muted">No supplies. Buy Bug Nets, Trail Mix and more in the Shop.</p>'}</div>
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}${btn(`Launch expedition`, 'launch', {}, 'go big', !team.length)}</div>`;
}

const EVENT_ICONS = { battle: 'thorn_spear', treasure: 'coin', hazard: 'acorn_cap', nest: 'egg', rest: 'heart', wanderer: 'flower', guardian: 'star', retreat: 'heart', home: 'flower' };

function eventRow(v, ev) {
  const A = v.A;
  const ic = ev.kind === 'nest' ? eggImg(A, ev.egg, 'sm') : icon(A, EVENT_ICONS[ev.kind] || 'star', 'sm');
  return `<div class="event ev-${ev.kind} ${ev.won === false ? 'lost' : ''}">
    ${ic}<div><b>${esc(ev.title)}</b><p>${esc(ev.text)}</p>
    ${ev.lines?.length ? `<ul>${ev.lines.slice(0, 6).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    <p class="ev-result">${esc(ev.result || '')}</p>
    ${ev.capture ? `<div class="capture">${bugImg(A, ev.capture.species, ev.capture.shiny, 'sm')} ${esc(SPECIES[ev.capture.species].name)} Lv${ev.capture.level} joins!</div>` : ''}
    </div></div>`;
}

export function expeditionModal(v, id) {
  const { game, A } = v;
  const exp = game.state.expeditions.find((e) => e.id === id);
  if (!exp) return null;
  const area = AREA_BY_ID[exp.areaId];
  const p = game.expeditionProgress(exp);
  const start = exp.startAt - (exp.bonusMs || 0);
  const shown = exp.events.filter((e) => e.at <= p.fraction + 1e-9);
  const sugar = game.state.inventory.sugar_cube || 0;
  return `<div class="area-banner px-bg small" style="background-image:url(${areaSceneUrl(area.id, A.palette)})"><span>${area.name}</span>
      <div class="march" style="--p:${p.fraction}">${exp.team.map((uid) => { const b = game.bug(uid); return b ? bugImg(A, b.species, b.shiny, 'sm walk') : ''; }).join('')}</div></div>
    ${bar(p.fraction, 'exp', start, start + exp.durationMs)}
    <div class="meta center">${p.done ? 'The team is home!' : `Returns in ${countdown(game, start + exp.durationMs)} · ${shown.length}/${exp.events.length} events so far`}</div>
    <div class="events">${shown.length ? shown.map((e) => eventRow(v, e)).join('') : '<p class="muted center">The team sets off down the trail...</p>'}</div>
    <div class="row sticky-foot">${p.done ? btn('Collect rewards', 'collect-exp', { id }, 'go big') : btn(`${icon(A, 'sugar_cube', 'xs')} Use Sugar Cube (${sugar})`, 'sugar', { id }, '', !sugar)}${btn('Close', 'close-modal')}</div>`;
}

export function reportModal(v, report) {
  const { A } = v;
  const items = Object.entries(report.items);
  return `<div class="area-banner px-bg small" style="background-image:url(${areaSceneUrl(report.area.id, A.palette)})"><span>${report.retreated ? 'Retreated from' : 'Returned from'} ${report.area.name}</span></div>
    ${report.guardian ? `<p class="center ${report.guardian.won ? 'ok' : 'bad'}"><b>${report.guardian.won ? `${report.guardian.name} defeated!` : `${report.guardian.name} was too strong.`}</b></p>` : ''}
    ${report.unlockedHint ? `<p class="center ok">You can now unlock <b>${report.unlockedHint.name}</b> in the Explore tab!</p>` : ''}
    <div class="rewards">
      <div class="reward">${coins(A, report.coins)}</div>
      ${items.map(([id, n]) => `<div class="reward">${icon(A, id, 'sm')} ${ITEMS[id].name} x${n}</div>`).join('')}
      ${report.eggs.map((e) => `<div class="reward">${eggImg(A, e.type, 'sm')} ${EGGS[e.type].name}</div>`).join('')}
    </div>
    ${report.captures.length ? `<div class="section-title">New friends</div><div class="captures">${report.captures.map((c) => `<div class="cap r-${SPECIES[c.bug.species].rarity}">${bugImg(A, c.bug.species, c.bug.shiny)}<b>${esc(SPECIES[c.bug.species].name)}</b><small>Lv${c.bug.level} · ${c.bug.traits.map((t) => TRAITS[t].name).join(', ')}</small>${c.newSpecies ? `<span class="new">NEW! +${c.reward}</span>` : ''}</div>`).join('')}</div>` : ''}
    ${report.levelUps.length ? `<div class="section-title">Level ups</div>${report.levelUps.map((l) => `<p>${esc(l.name)}: Lv ${l.from} → <b>Lv ${l.to}</b></p>`).join('')}` : ''}
    <details><summary>Full expedition log (${report.events.length})</summary><div class="events">${report.events.map((e) => eventRow(v, e)).join('')}</div></details>
    <div class="row sticky-foot">${btn('Great!', 'close-modal', {}, 'go big')}</div>`;
}

// ---------- Nursery ----------

export function renderNursery(v) {
  const { game, A } = v;
  const st = game.state;
  const cap = nurseryCapacity(st);
  const incubating = st.eggs.filter((e) => e.startedAt).sort((a, b) => a.startedAt - b.startedAt);
  const bag = st.eggs.filter((e) => !e.startedAt);
  const moss = st.inventory.warm_moss || 0;
  const slots = Array.from({ length: cap }, (_, i) => {
    const egg = incubating[i];
    if (!egg) return `<div class="nest empty"><div class="nest-egg">+</div><small>Empty plot</small></div>`;
    const p = game.eggProgress(egg);
    const start = egg.startedAt - (egg.bonusMs || 0);
    return `<div class="nest ${p.ready ? 'ready' : ''}">
      <div class="nest-egg ${p.ready ? 'wobble' : ''}">${eggImg(A, egg.type)}</div>
      <b>${EGGS[egg.type].name}</b>
      ${bar(p.fraction, 'egg', start, start + egg.durationMs)}
      ${p.ready ? btn('Hatch!', 'hatch', { uid: egg.uid }, 'go') : `<small>${countdown(game, start + egg.durationMs)}</small>${btn(`${icon(A, 'warm_moss', 'xs')} Moss (${moss})`, 'moss', { uid: egg.uid }, 'sm', !moss)}`}
    </div>`;
  }).join('');
  const groups = {};
  for (const e of bag) (groups[e.type] = groups[e.type] || []).push(e);
  const full = incubating.length >= cap;
  return `<p class="muted">Eggs incubate in the dirt patch in your garden. Hatching is chance-based: check the odds for each egg.</p>
    <div class="section-title">Nursery <small>${incubating.length}/${cap} plots</small></div>
    <div class="nests">${slots}</div>
    <div class="section-title">Egg basket <small>${bag.length}</small></div>
    ${Object.keys(groups).length ? Object.entries(groups).map(([type, list]) => `<div class="list-row">
      ${eggImg(A, type, 'sm')}<div class="grow"><b>${EGGS[type].name}</b> x${list.length}<small>${esc(EGGS[type].desc)} Incubates in ${fmtTime(incubationMs(st, type))}.</small></div>
      ${btn('Odds', 'odds', { type }, 'sm')}${btn('Incubate', 'incubate', { uid: list[0].uid }, 'go sm', full)}
    </div>`).join('') : '<p class="muted center">No eggs waiting. Find them on expeditions or buy them in the Shop.</p>'}`;
}

export function oddsModal(v, type) {
  const { game, A } = v;
  const { odds, shinyChance } = hatchOdds(game.state, type);
  return `<div class="modal-head">${eggImg(A, type, 'big')}<div><h3>${EGGS[type].name}</h3><small>${esc(EGGS[type].desc)}</small></div></div>
    <table class="odds">${odds.filter((o) => o.chance > 0).map((o) => `<tr><td>${rarityTag(o.rarity)}</td><td><b>${pct(o.chance, 1)}</b></td>
      <td class="odds-bugs">${o.species.map((id) => bugImg(A, id, false, `xs ${game.state.dex[id]?.caught ? '' : 'sil'}`)).join('')}</td></tr>`).join('')}</table>
    <p class="meta">Shiny chance ${pct(shinyChance, 1)}. Upgrade the Four-Leaf Patch for better odds.</p>
    <div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

export function hatchModal(v, res, stage) {
  const { A } = v;
  if (stage === 'egg') {
    return `<div class="hatch-stage"><div class="hatch-egg shake">${eggImg(A, res.eggType, 'huge')}</div><p>Something is moving...</p></div>`;
  }
  const sp = SPECIES[res.bug.species];
  return `<div class="hatch-stage reveal r-${sp.rarity}">
      <div class="burst"></div>
      ${bugImg(A, sp.id, res.bug.shiny, 'huge pop')}
      <h3>${esc(sp.name)}</h3>
      <div>${rarityTag(sp.rarity)} ${res.bug.shiny ? '<span class="shiny-tag">SHINY!</span>' : ''}</div>
      ${res.newSpecies ? `<p class="new">New species discovered! +${res.reward} coins</p>` : ''}
      <div class="traits">${traitChips(res.bug)}</div>
    </div>
    <div class="row sticky-foot">${btn('Meet them', 'open-bug', { uid: res.bug.uid })}${btn('Hooray!', 'close-modal', {}, 'go big')}</div>`;
}

// ---------- Bag ----------

export function renderBag(v) {
  const { game, A } = v;
  const st = game.state;
  const ids = Object.keys(st.inventory).filter((id) => ITEMS[id] && st.inventory[id] > 0);
  const equipped = st.bugs.filter((b) => b.gear);
  const sections = Object.entries(ITEM_TYPES).map(([type, title]) => {
    const list = ids.filter((id) => ITEMS[id].type === type);
    if (!list.length) return '';
    return `<div class="section-title">${title}</div>${list.map((id) => {
      const it = ITEMS[id];
      const n = st.inventory[id];
      const price = sellPrice(id);
      let actions = '';
      if (it.type === 'consumable') actions += btn('Use', 'item-use', { item: id }, 'go sm');
      if (it.type === 'gear') actions += btn('Equip', 'item-equip', { item: id }, 'go sm');
      if (price) actions += btn(`Sell ${price}`, 'sell', { item: id, qty: 1 }, 'sm');
      if (price && n > 1 && it.type === 'treasure') actions += btn(`All ${price * n}`, 'sell', { item: id, qty: n }, 'sm');
      return `<div class="list-row">${icon(A, id)}<div class="grow"><b>${it.name}</b> x${n}<small>${esc(it.desc)}${it.type === 'gear' ? ` (${gearStats(id)})` : ''}</small></div><div class="row">${actions}</div></div>`;
    }).join('')}`;
  }).join('');
  return `${sections || '<p class="muted center">Your bag is empty. Expeditions are full of treasures!</p>'}
    ${equipped.length ? `<div class="section-title">Equipped</div>${equipped.map((b) => `<div class="list-row">${icon(A, b.gear)}<div class="grow"><b>${ITEMS[b.gear].name}</b><small>on ${esc(bugName(b))}</small></div>${btn('Bug', 'open-bug', { uid: b.uid }, 'sm')}</div>`).join('')}` : ''}`;
}

export function pickBugModal(v, itemId, mode) {
  const { game, A } = v;
  const st = game.state;
  const it = ITEMS[itemId];
  let list = [...st.bugs];
  if (itemId === 'honey_drop') list = list.filter((b) => bugStatus(b, st, game.now()) === 'resting');
  if (mode === 'equip') list = list.filter((b) => bugStatus(b, st, game.now()) !== 'expedition');
  list.sort(SORTS.rarity);
  const act = mode === 'equip' ? 'equip' : 'use-on-bug';
  return `<div class="modal-head">${icon(A, itemId, 'big')}<div><h3>${it.name}</h3><small>${esc(it.desc)}</small></div></div>
    <div class="section-title">Choose a bug</div>
    ${list.length ? `<div class="bug-grid compact">${list.map((b) => bugCard(v, b, { act }).replace('data-act', `data-item="${itemId}" data-act`)).join('')}</div>` : '<p class="muted center">No bug can use this right now.</p>'}
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}</div>`;
}

export function pickTargetModal(v, itemId) {
  const { game, A } = v;
  const st = game.state;
  const it = ITEMS[itemId];
  let rows = '';
  if (itemId === 'sugar_cube') {
    rows = st.expeditions.filter((e) => !game.expeditionProgress(e).done).map((e) => `<div class="list-row">${icon(A, 'map')}<div class="grow"><b>${AREA_BY_ID[e.areaId].name}</b><small>${countdown(game, e.startAt - (e.bonusMs || 0) + e.durationMs)} left</small></div>${btn('Use', 'sugar', { id: e.id }, 'go sm')}</div>`).join('');
  } else if (itemId === 'warm_moss') {
    rows = st.eggs.filter((e) => e.startedAt && !game.eggProgress(e).ready).map((e) => `<div class="list-row">${eggImg(A, e.type)}<div class="grow"><b>${EGGS[e.type].name}</b><small>${countdown(game, e.startedAt - (e.bonusMs || 0) + e.durationMs)} left</small></div>${btn('Use', 'moss', { uid: e.uid }, 'go sm')}</div>`).join('');
  }
  return `<div class="modal-head">${icon(A, itemId, 'big')}<div><h3>${it.name}</h3><small>${esc(it.desc)}</small></div></div>
    ${rows || '<p class="muted center">Nothing to use this on right now.</p>'}
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}</div>`;
}

// ---------- Shop & upgrades ----------

export function renderShop(v) {
  const { game, A, ui } = v;
  const st = game.state;
  const tabs = `<div class="tabs">${btn('Market', 'shop-tab', { tab: 'market' }, ui.shopTab === 'market' ? 'on' : '')}${btn('Upgrades', 'shop-tab', { tab: 'upgrades' }, ui.shopTab === 'upgrades' ? 'on' : '')}</div>`;
  if (ui.shopTab === 'upgrades') return tabs + renderUpgrades(v);
  const offers = game.shopOffers();
  const desc = (id) => esc(EGGS[id]?.desc || ITEMS[id]?.desc || '');
  return `${tabs}
    <div class="section-title">Traveling deals <small>restock in ${countdown(game, rotationEndsAt(game.now()))}</small></div>
    <div class="offers">${offers.map((o) => `<div class="offer ${o.sold ? 'sold' : ''}">
      ${o.discount ? `<span class="sale">-${pct(o.discount)}</span>` : ''}
      ${itemImg(A, o.id, 'big')}<b>${itemName(o.id)}</b>
      ${o.sold ? '<span class="muted">SOLD</span>' : btn(coins(A, o.price), 'buy', { id: o.id, offer: o.index }, 'go sm', st.coins < o.price)}
      <small>${desc(o.id)}</small></div>`).join('')}</div>
    <div class="section-title">Always in stock</div>
    ${FIXED_STOCK.map((id) => `<div class="list-row">${itemImg(A, id)}<div class="grow"><b>${itemName(id)}</b>${st.inventory[id] ? ` <small class="inline">(own ${st.inventory[id]})</small>` : ''}<small>${desc(id)}</small></div>${btn(coins(A, priceOf(id)), 'buy', { id }, 'go sm', st.coins < priceOf(id))}</div>`).join('')}`;
}

function renderUpgrades(v) {
  const { game, A } = v;
  const st = game.state;
  return `<p class="muted">Permanent improvements to your garden and expeditions.</p>
    ${UPGRADES.map((u) => {
      const lvl = st.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id, lvl);
      const maxed = lvl >= u.max;
      return `<div class="upgrade ${maxed ? 'maxed' : ''}">
        <div class="grow"><b>${u.name}</b><small>${u.desc}</small>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          <small>${u.effect(lvl)}${maxed ? '' : ` → <b>${u.effect(lvl + 1)}</b>`}</small></div>
        ${maxed ? '<span class="ok">MAX</span>' : btn(coins(A, cost), 'upgrade', { id: u.id }, 'go sm', st.coins < cost)}
      </div>`;
    }).join('')}`;
}

// ---------- garden visitor, settings, welcome ----------

export function visitorModal(v) {
  const { game, A } = v;
  const vis = game.state.garden.visitor;
  if (!vis) return '<p class="center">The visitor has wandered off.</p><div class="row sticky-foot">' + btn('Close', 'close-modal') + '</div>';
  const sp = SPECIES[vis.species];
  const honey = game.state.inventory.honey_drop || 0;
  return `<div class="modal-head r-${sp.rarity}"><div class="portrait r-${sp.rarity}">${bugImg(A, vis.species, vis.shiny, 'big')}</div>
      <div><h3>A wild ${esc(sp.name)}!</h3><div>${rarityTag(sp.rarity)} ${vis.shiny ? '<span class="shiny-tag">SHINY</span>' : ''} Lv ${vis.level}</div>
      <small>Leaves in ${countdown(game, vis.expiresAt)}</small></div></div>
    <p>It's exploring your garden. Try to befriend it!</p>
    <div class="row wrap">${btn('Approach gently (60%)', 'catch', { honey: 0 }, 'go')}${btn(`${icon(A, 'honey_drop', 'xs')} Offer Honey (100%) · ${honey} left`, 'catch', { honey: 1 }, '', !honey)}</div>
    <div class="row sticky-foot">${btn('Leave it be', 'close-modal')}</div>`;
}

export function settingsModal(v) {
  const { game, ui } = v;
  const s = game.state.stats;
  return `<h3>Garden journal</h3>
    <table class="kv">
      <tr><td>Expeditions</td><td>${s.expeditions}</td></tr><tr><td>Eggs hatched</td><td>${s.hatched}</td></tr>
      <tr><td>Bugs befriended</td><td>${s.captured}</td></tr><tr><td>Guardians defeated</td><td>${s.guardians}</td></tr>
      <tr><td>Coins earned</td><td>${fmtNum(s.coinsEarned)}</td></tr>
    </table>
    <h4>Save</h4><p class="muted">Progress saves automatically in this browser. Copy the code to move it elsewhere.</p>
    <textarea id="save-code" rows="3" placeholder="Paste a save code here to import">${ui.exportCode ? esc(ui.exportCode) : ''}</textarea>
    <div class="row wrap">${btn('Export code', 'export')}${btn('Import code', 'import')}${btn('Reset game', 'reset', {}, 'danger')}</div>
    ${ui.debug ? `<h4>Debug tools</h4><p class="muted">Time warp: ${fmtTime(game.timeOffset)} ahead.</p>
      <div class="row wrap">${btn('+1 min', 'warp', { ms: 60e3 })}${btn('+10 min', 'warp', { ms: 600e3 })}${btn('+1 hour', 'warp', { ms: 3600e3 })}${btn('+1000 coins', 'cheat-coins')}</div>` : ''}
    <div class="row sticky-foot">${btn('Close', 'close-modal')}${btn('How to play', 'help')}</div>`;
}

export function welcomeModal(v) {
  const { A } = v;
  return `<div class="welcome">
    <div class="welcome-bugs">${['ant', 'ladybug', 'pill_bug', 'caterpillar'].map((id) => bugImg(A, id, false, 'big walk')).join('')}</div>
    <h3>Welcome to Bug Garden!</h3>
    <ol>
      <li>${icon(A, 'flower', 'sm')} <b>Garden:</b> your bugs live here and drop coins. Tap the coins to collect them, and tap a bug to say hi (tap again for details).</li>
      <li>${icon(A, 'map', 'sm')} <b>Explore:</b> send a team of up to <b>4 bugs</b> on timed expeditions. They fight wild bugs, find treasure, and may befriend new bugs.</li>
      <li>${eggImg(A, 'meadow_egg', 'sm')} <b>Nursery:</b> eggs incubate in the dirt patch. Each hatch is a roll of the dice, and shinies are rare!</li>
      <li>${icon(A, 'star', 'sm')} <b>Guardians:</b> after 3 expeditions in an area, its Guardian appears. Beat it to unlock the next of the <b>5 areas</b>.</li>
      <li>${icon(A, 'hammer', 'sm')} <b>Upgrades:</b> spend coins on permanent boosts in the Shop.</li>
    </ol>
    <p class="muted">Timers keep running while you're away.</p></div>
    <div class="row sticky-foot">${btn("Let's go!", 'welcome-done', {}, 'go big')}</div>`;
}
