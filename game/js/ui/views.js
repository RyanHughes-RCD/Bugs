import { SPECIES, SPECIES_LIST, FAMILIES } from '../data/species.js';
import { RARITIES, RARITY_ORDER, VARIANTS } from '../data/rarities.js';
import { TRAITS, TRAIT_IDS } from '../data/traits.js';
import { ITEMS, ITEM_TYPES, sellPrice, itemEffectsText } from '../data/items.js';
import { EGG_TIERS, EGG_BY_ID, HATCHERY_MOTTO } from '../data/eggs.js';
import { AREAS, AREA_BY_ID } from '../data/areas.js';
import { UPGRADES, upgradeCost } from '../data/upgrades.js';
import { GARDEN_LIMIT, PARTY_SIZE, MAX_BUG_LEVEL, XP, GARDEN_FORAGE, BASE_ENCOUNTER_MS, EXPEDITION_LENGTH } from '../data/balance.js';
import { effectiveTraits, itemBonus, bugName, bugsOnExpedition, assignmentOf, gardenCount, releaseValue, rarityOf, traitTotal } from '../systems/bugs.js';
import { eggOdds, incubatorCount, incubationMs } from '../systems/eggs.js';
import { expeditionSlots, encounterMs, partyBonuses, sumRewards, defaultEncounterCount, encountersForHours } from '../systems/expedition.js';
import { partyTraitScores, checkChance } from '../systems/traits.js';
import { gardenRatePerMin } from '../systems/garden.js';
import { areaBackground } from './scenes.js';
import { esc, fmtTime, fmtNum, pct, fmtClock, fmtDur } from './format.js';
import { VERSION } from '../version.js';

// ---------- building blocks ----------

const icon = (A, id, cls = '') => `<img class="px icon ${cls}" src="${A.spriteUrl(id)}" alt="">`;
// Bug image with its colour variant and any magical aura. Golden bugs get a
// wrapper so CSS can draw sparkles around them.
export const bugImg = (A, bug, cls = '') => {
  const sp = SPECIES[bug.species];
  const img = `<img class="px bug-img ${bug.variant ? `v-${bug.variant}` : ''} ${sp.aura ? 'aura' : ''} ${sp.view} ${cls}" ${sp.aura ? `style="--aura:${sp.aura}"` : ''} src="${A.bugUrl(bug.species, bug.variant)}" alt="${esc(sp.name)}">`;
  return bug.variant === 'golden' ? `<span class="sparkle-wrap">${img}</span>` : img;
};
const speciesImg = (A, id, cls = '', variant = null) => bugImg(A, { species: id, variant }, cls);
const variantTag = (bug) => (bug.variant ? `<span class="variant-tag v-${bug.variant}">${VARIANTS[bug.variant].name}</span>` : '');
export const eggImg = (A, tier, cls = '', stage = 0) => `<span class="egg-wrap t-${tier} ${cls}"><img class="px egg-img" src="${A.eggUrl(tier, stage)}" alt="${esc(EGG_BY_ID[tier].name)}"></span>`;
export const coins = (A, n) => `<span class="coins">${icon(A, 'coin', 'sm')}${fmtNum(n)}</span>`;
const rarityTag = (r) => `<span class="rarity r-${r}">${RARITIES[r].name}</span>`;
const countdown = (game, ends) => `<span data-ends="${ends}">${fmtTime(ends - game.now())}</span>`;
const since = (game, start) => `<span data-since="${start}">${fmtTime(game.now() - start)}</span>`;
const bar = (frac, cls = '', start = null, ends = null) =>
  `<div class="bar ${cls}"><i style="width:${(Math.min(1, frac) * 100).toFixed(1)}%" ${start !== null ? `data-start="${start}" data-ends="${ends}"` : ''}></i></div>`;
const btn = (label, act, data = {}, cls = '', disabled = false) =>
  `<button class="btn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${disabled ? 'disabled' : ''}>${label}</button>`;
const traitIcon = (A, t, cls = 'xs') => icon(A, TRAITS[t].icon, cls);
const ASSIGN_LABEL = { garden: 'Garden', available: 'Storage', expedition: 'Exploring' };

export function traitChips(A, bug) {
  const eff = effectiveTraits(bug);
  return TRAIT_IDS.filter((t) => eff[t]).map((t) => {
    const b = itemBonus(bug, t);
    return `<span class="tchip" style="--tc:${TRAITS[t].color}" title="${TRAITS[t].name}">${traitIcon(A, t)}${eff[t]}${b ? '<em>*</em>' : ''}</span>`;
  }).join('');
}

function bugCard(v, bug, { act = 'open-bug', selected = false, disabled = false, extra = '', data = {} } = {}) {
  const st = v.game.state;
  const r = rarityOf(bug);
  const asg = assignmentOf(bug, st, v.away);
  return `<button class="bug-card r-${r} ${selected ? 'selected' : ''}" data-act="${act}" data-uid="${bug.uid}" ${Object.entries(data).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ')} ${disabled ? 'disabled' : ''}>
    ${bugImg(v.A, bug)}
    <span class="bc-name">${esc(bugName(bug))}</span>
    <span class="bc-lv">Lv ${bug.level}</span>
    <span class="bc-traits">${traitChips(v.A, bug)}</span>
    ${bug.item ? `<span class="bc-gear">${icon(v.A, bug.item, 'xs')}</span>` : ''}
    <span class="badge a-${asg}">${ASSIGN_LABEL[asg]}</span>${extra}
  </button>`;
}

const withAway = (v) => ({ ...v, away: bugsOnExpedition(v.game.state) });

// ---------- top bar & HUD ----------

export function renderTopbar(v) {
  const st = v.game.state;
  const caught = Object.values(st.dex).filter((d) => d.caught).length;
  return `<div class="tb-coins" title="Coins">${coins(v.A, st.coins)}</div>
    <button class="tb-dex" data-act="nav" data-panel="bugs" data-tab="dex" title="Bugdex">${icon(v.A, 'star', 'sm')}<span>${caught}/${SPECIES_LIST.length}</span></button>
    <button class="tb-btn" data-act="settings" title="Settings">${icon(v.A, 'cog', 'sm')}</button>`;
}

export function renderHud(v) {
  const { game, A } = v;
  const st = game.state;
  const pot = Math.floor(st.garden.pot);
  const chips = [];
  for (const exp of st.expeditions) {
    const tl = game.timeline(exp);
    const area = AREA_BY_ID[exp.areaId];
    chips.push(`<button class="chip ${tl.done ? 'ready' : ''}" data-act="view-exp" data-id="${exp.id}">${icon(A, 'map', 'xs')}${area.name.replace('The ', '')}
      ${tl.done ? '<b>Rewards ready!</b>' : `<small>${tl.resolved + 1}/${exp.count}</small> ${countdown(game, exp.endsAt)}`}</button>`);
  }
  if (v.ui.updateAvailable) chips.unshift(`<button class="chip update" data-act="update-app">${icon(A, 'star', 'xs')}<b>New version! Tap to update</b></button>`);
  const garden = gardenCount(st);
  return `<div class="hud-row">
      <button class="pot ${pot >= 1 ? 'has' : ''}" data-act="collect-garden" title="Coins your garden bugs dug up">${icon(A, 'coin')}<span><b>${fmtNum(pot)}</b>/${GARDEN_FORAGE.cap}</span><small>+${gardenRatePerMin(st).toFixed(1)}/min</small></button>
      <button class="chip garden-count" data-act="nav" data-panel="bugs">${icon(A, 'flower', 'xs')} ${garden}/${GARDEN_LIMIT}</button>
    </div>
    <div class="chips">${chips.join('')}</div>`;
}

export function quickBugCard(v, uid) {
  const { game, A } = v;
  const bug = game.bug(uid);
  if (!bug) return null;
  const r = rarityOf(bug);
  return `<div class="quick r-${r}">
    <div class="portrait sm r-${r}">${bugImg(A, bug)}</div>
    <div class="grow"><b>${esc(bugName(bug))}</b> ${rarityTag(r)}<small>Lv ${bug.level}${bug.item ? ` · ${ITEMS[bug.item].name}` : ''}</small>
      <div class="bc-traits">${traitChips(A, bug)}</div></div>
    ${btn('Details', 'open-bug', { uid }, 'sm go')}
  </div>`;
}

// ---------- Hatchery ----------

export function renderHatchery(v) {
  const { game, A } = v;
  const st = game.state;
  const slots = incubatorCount(st);
  const incubating = st.eggs.filter((e) => e.startedAt).sort((a, b) => a.startedAt - b.startedAt);
  const basket = st.eggs.filter((e) => !e.startedAt);
  const full = incubating.length >= slots;
  const nests = Array.from({ length: slots }, (_, i) => {
    const egg = incubating[i];
    if (!egg) return `<div class="nest empty"><div class="nest-art">${icon(A, 'nest', 'nest-img')}</div><small>Empty nest</small></div>`;
    const p = game.eggProgress(egg);
    return `<div class="nest ${p.ready ? 'ready' : ''}">
      <div class="nest-art ${p.ready ? 'wobble' : ''}">${icon(A, 'nest', 'nest-img')}${eggImg(A, egg.tier, 'big in-nest')}${icon(A, 'nest_front', 'nest-img front')}</div>
      <b>${EGG_BY_ID[egg.tier].name}</b>
      ${bar(p.fraction, 'egg', egg.startedAt, egg.endsAt)}
      ${p.ready ? btn('Hatch!', 'hatch', { uid: egg.uid }, 'go') : `<small>Hatches in ${countdown(game, egg.endsAt)}</small>`}
    </div>`;
  }).join('');
  const groups = {};
  for (const e of basket) (groups[e.tier] = groups[e.tier] || []).push(e);
  return `<div class="motto">${eggImg(A, 'common', 'sm')}<p>"${HATCHERY_MOTTO}"</p></div>
    <div class="section-title">Nests <small>${incubating.length}/${slots} in use · more nests in Upgrades</small></div>
    <div class="nests">${nests}</div>
    <div class="section-title">Egg basket <small>${basket.length} waiting</small></div>
    ${EGG_TIERS.filter((t) => groups[t.id]).map((t) => `<div class="list-row">
      ${eggImg(A, t.id)}<div class="grow"><b>${t.name}</b> x${groups[t.id].length}<small>Hatches in ${fmtDur(incubationMs(st, t.id))}</small></div>
      ${btn('Incubate', 'incubate', { uid: groups[t.id][0].uid }, 'go sm', full)}</div>`).join('') || '<p class="muted center">No eggs waiting. Buy one below or find them on expeditions.</p>'}
    <div class="section-title">Egg shop</div>
    <div class="egg-shop">${EGG_TIERS.map((t) => `<div class="egg-offer t-${t.id}">
      ${eggImg(A, t.id, 'big')}<b>${t.name}</b>
      <small>${esc(t.desc)}</small>
      <div class="row">${btn('Odds', 'odds', { tier: t.id }, 'sm')}${btn(coins(A, t.price), 'buy-egg', { tier: t.id }, 'go sm', st.coins < t.price)}</div>
    </div>`).join('')}</div>
    <p class="muted center">The tier changes the odds, never guarantees the result. Tap Odds to see exactly what's possible.</p>`;
}

export function oddsModal(v, tierId) {
  const { A } = v;
  const tier = EGG_BY_ID[tierId];
  return `<div class="modal-head">${eggImg(A, tierId, 'big')}<div><h3>${tier.name}</h3><small>${esc(tier.desc)}</small></div></div>
    <table class="odds">${eggOdds(tierId).filter((o) => o.chance > 0).map((o) => `<tr><td>${rarityTag(o.rarity)}</td><td><b>${pct(o.chance, o.chance < 0.01 ? 2 : 1)}</b></td>
      <td class="odds-bugs">${o.species.map((id) => speciesImg(A, id, `xs ${v.game.state.dex[id]?.caught ? '' : 'sil'}`)).join('')}</td></tr>`).join('')}</table>
    <p class="meta">Base incubation ${fmtDur(tier.hatchMs)}. No hidden pity timer: every egg is an independent roll.</p>
    <p class="meta">On top of rarity, any hatchling can be ${Object.entries(VARIANTS).map(([id, va]) => `<span class="variant-tag v-${id}">${va.name}</span> ${pct(va.chance, 1)}`).join(', ')}.</p>
    <div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

const HATCH_HINTS = ['Tap the egg!', 'It moved!', 'Cracks are spreading...', 'One more tap!'];

// Full-screen hatching event: tap the egg four times to crack it open.
export function hatchModal(v, s) {
  const { A } = v;
  const tier = EGG_BY_ID[s.res.tier];
  if (s.stage < 4) {
    const shards = s.stage ? Array.from({ length: 6 + s.stage * 3 }, (_, i) => `<i class="shard" style="--a:${(i * 360) / (6 + s.stage * 3) + s.stage * 17}deg;--d:${60 + ((i * 37) % 50)}px"></i>`).join('') : '';
    return `<div class="hatch-event t-${tier.id} stage-${s.stage}">
      <div class="rays"></div>
      <p class="he-title">${tier.name}</p>
      <button class="he-egg ${s.stage ? 'shake' : 'idle'}" data-act="crack" aria-label="Crack the egg">
        <img class="px" src="${A.eggUrl(tier.id, s.stage)}" alt="">${shards}
      </button>
      <div class="he-pips">${[0, 1, 2, 3].map((i) => `<i class="${i < s.stage ? 'on' : ''}"></i>`).join('')}</div>
      <p class="he-hint">${HATCH_HINTS[s.stage]}</p>
    </div>`;
  }
  const { bug, newSpecies, reward, gardenFull } = s.res;
  const r = rarityOf(bug);
  const sp = SPECIES[bug.species];
  const eff = effectiveTraits(bug);
  return `<div class="hatch-event reveal r-${r} ${bug.variant ? `v-${bug.variant}` : ''}">
      <div class="rays"></div><div class="flash"></div>
      <div class="shell left"><img class="px" src="${A.eggUrl(tier.id, 3)}" alt=""></div>
      <div class="shell right"><img class="px" src="${A.eggUrl(tier.id, 3)}" alt=""></div>
      <div class="he-bug">${bugImg(A, bug, 'pop')}</div>
      <h2>${esc(bugName(bug))}</h2>
      <div class="rar-pop">${rarityTag(r)}</div>
      ${bug.variant ? `<div class="variant-banner v-${bug.variant}">✦ ${VARIANTS[bug.variant].name.toUpperCase()}! ✦</div>` : ''}
      <small>from a ${tier.name}</small>
      ${newSpecies ? `<p class="new">New species discovered! +${reward} coins</p>` : ''}
      <div class="reveal-traits">${Object.keys(eff).map((t, i) => `<div class="rt" style="animation-delay:${1 + i * 0.25}s">${traitIcon(A, t, 'sm')} <b>${TRAITS[t].name}</b> ${bar(eff[t] / 12, `t-${t}`)} Lv ${eff[t]}</div>`).join('')}</div>
      <div class="row he-actions">
        ${btn('Keep in collection', 'close-modal')}
        ${gardenFull ? `<span class="muted">Garden full (${GARDEN_LIMIT}/${GARDEN_LIMIT})</span>` : btn('Place in garden', 'garden-in', { uid: bug.uid, close: 1 }, 'go big')}
      </div>
    </div>`;
}

// ---------- Collection ----------

export function renderCollection(v0) {
  const v = withAway(v0);
  const { game, ui, A } = v;
  const st = game.state;
  const tabs = `<div class="tabs">${btn(`My bugs (${st.bugs.length})`, 'bugs-tab', { tab: 'mine' }, ui.bugsTab === 'mine' ? 'on' : '')}${btn('Bugdex', 'bugs-tab', { tab: 'dex' }, ui.bugsTab === 'dex' ? 'on' : '')}</div>`;
  if (ui.bugsTab === 'dex') return tabs + renderDex(v);
  const f = ui.filter;
  let list = st.bugs.filter((b) => (!f.rarity || rarityOf(b) === f.rarity) && (!f.trait || effectiveTraits(b)[f.trait]) && (!f.place || assignmentOf(b, st, v.away) === f.place));
  const sorts = {
    rarity: (a, b) => RARITY_ORDER.indexOf(rarityOf(b)) - RARITY_ORDER.indexOf(rarityOf(a)) || b.level - a.level,
    trait: (a, b) => (f.trait ? (effectiveTraits(b)[f.trait] || 0) - (effectiveTraits(a)[f.trait] || 0) : traitTotal(b) - traitTotal(a)),
    level: (a, b) => b.level - a.level,
    newest: (a, b) => b.uid - a.uid,
  };
  list = [...list].sort(sorts[ui.sort] || sorts.rarity);
  const chip = (label, key, val) => btn(label, 'filter', { key, val: f[key] === val ? '' : val }, `sm ${f[key] === val ? 'on' : ''}`);
  return `${tabs}
    <div class="garden-line">${icon(A, 'flower', 'sm')} Garden <b>${gardenCount(st)}/${GARDEN_LIMIT}</b> · open a bug to move it in or out</div>
    <div class="filters">
      <div class="row wrap">${['garden', 'available', 'expedition'].map((p) => chip(ASSIGN_LABEL[p], 'place', p)).join('')}</div>
      <div class="row wrap">${RARITY_ORDER.map((r) => chip(RARITIES[r].name, 'rarity', r)).join('')}</div>
      <div class="row wrap">${TRAIT_IDS.map((t) => chip(`${traitIcon(A, t)}${TRAITS[t].name}`, 'trait', t)).join('')}</div>
      <div class="row wrap"><span class="muted">Sort</span>${Object.keys(sorts).map((k) => btn(k, 'sort', { sort: k }, `sm ${ui.sort === k ? 'on' : ''}`)).join('')}</div>
    </div>
    <div class="bug-grid">${list.map((b) => bugCard(v, b)).join('') || '<p class="muted">No bugs match these filters.</p>'}</div>`;
}

function renderDex(v) {
  const st = v.game.state;
  const caught = SPECIES_LIST.filter((s) => st.dex[s.id]?.caught).length;
  return `<div class="dex-head"><b>${caught}</b> of ${SPECIES_LIST.length} species discovered ${bar(caught / SPECIES_LIST.length, 'dex-bar')}
      <small>Each new species pays a discovery reward. Every one of them comes from an egg.</small></div>
    <div class="dex-grid">${SPECIES_LIST.map((s) => {
      const d = st.dex[s.id];
      return `<button class="dex-cell r-${s.rarity} ${d?.caught ? 'known' : 'unknown'}" data-act="open-species" data-id="${s.id}" ${d?.caught ? '' : 'disabled'}>
        <span class="dex-no">#${String(s.index + 1).padStart(2, '0')}</span>
        ${speciesImg(v.A, s.id, d?.caught ? '' : 'sil')}
        <span class="dex-name">${d?.caught ? esc(s.name) : '???'}</span>
        ${d?.caught ? `<span class="dex-count">x${d.caught}</span>` : ''}
        ${d?.variants ? `<span class="dex-vars">${Object.keys(VARIANTS).filter((k) => d.variants[k]).map((k) => `<i class="v-${k}" title="${VARIANTS[k].name}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('')}</div>`;
}

export function speciesModal(v, id) {
  const { A } = v;
  const sp = SPECIES[id];
  return `<div class="modal-head"><div class="portrait r-${sp.rarity}">${speciesImg(A, id, 'big')}</div>
      <div><h3>#${sp.index + 1} ${esc(sp.name)}</h3>${rarityTag(sp.rarity)}<small>${FAMILIES[sp.family]}</small></div></div>
    <p class="flavor">"${esc(sp.desc)}"</p>
    <p><b>Natural traits:</b> ${sp.traits.map((t) => `${traitIcon(A, t)} ${TRAITS[t].name}`).join(', ')}</p>
    <h4>Variants found</h4>
    <div class="variant-row">${Object.entries(VARIANTS).map(([k, va]) => {
      const found = v.game.state.dex[id]?.variants?.[k];
      return `<div class="variant-cell ${found ? '' : 'missing'}">${found ? speciesImg(A, id, 'big', k) : speciesImg(A, id, 'big sil')}<span class="variant-tag v-${k}">${va.name}</span><small>${found ? 'Found!' : `${pct(va.chance, 1)} per hatch`}</small></div>`;
    }).join('')}</div>
    <p class="meta">Signature trait first. Drab and Common hatchlings get only their signature trait; rarer ones get more traits at higher levels.</p>
    <div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

export function bugModal(v, uid) {
  const { game, A } = v;
  const st = game.state;
  const bug = game.bug(uid);
  if (!bug) return null;
  const r = rarityOf(bug);
  const sp = SPECIES[bug.species];
  const asg = game.assignment(bug);
  const eff = effectiveTraits(bug);
  const next = XP.toNext(bug.level);
  const gear = Object.keys(st.inventory).filter((id) => ITEMS[id]?.type === 'gear');
  const away = asg === 'expedition';
  return `<div class="modal-head">
      <div class="portrait r-${r}">${bugImg(A, bug, 'big')}</div>
      <div><h3>${esc(bugName(bug))}</h3>
        <div>${rarityTag(r)} ${variantTag(bug)}</div>
        <small>${esc(sp.name)} · ${FAMILIES[sp.family]} · #${bug.uid}</small></div>
    </div>
    <div class="lvl-line"><b>Lv ${bug.level}</b>${bug.level < MAX_BUG_LEVEL ? `${bar(bug.xp / next, 'xp')}<small>${bug.xp}/${next} XP</small>` : '<small>MAX</small>'}</div>
    <small>Each level up raises this bug's weakest trait by 1.</small>
    <h4>Traits</h4>
    <div class="trait-list">${Object.keys(eff).map((t) => {
      const b = itemBonus(bug, t);
      return `<div class="trait-row">${traitIcon(A, t, 'sm')}<b>${TRAITS[t].name}</b>${bar(eff[t] / 12, `t-${t}`)}<span>Lv ${eff[t]}${b ? ` <em class="up">(+${b} item)</em>` : ''}</span></div>`;
    }).join('')}</div>
    <h4>Equipped item <small class="inline">(one per bug)</small></h4>
    <div class="gear-slot">${bug.item ? `${icon(A, bug.item)}<div class="grow"><b>${ITEMS[bug.item].name}</b><small>${itemEffectsText(bug.item)}</small></div>${btn('Unequip', 'unequip', { uid }, 'sm', away)}` : '<span class="muted">Nothing equipped.</span>'}</div>
    ${!away && gear.length ? `<div class="gear-pick">${gear.map((id) => `<button class="item-chip" data-act="equip" data-uid="${uid}" data-item="${id}">${icon(A, id, 'sm')}<span>${ITEMS[id].name} x${st.inventory[id]}<small>${itemEffectsText(id)}</small></span></button>`).join('')}</div>` : ''}
    <h4>Where</h4>
    <div class="row wrap">
      <span class="badge-inline a-${asg}">${ASSIGN_LABEL[asg]}</span>
      ${bug.inGarden ? btn('Move to storage', 'garden-out', { uid }, 'sm') : btn(`Place in garden (${gardenCount(st)}/${GARDEN_LIMIT})`, 'garden-in', { uid }, 'sm go', gardenCount(st) >= GARDEN_LIMIT)}
      ${btn(`Release (+${releaseValue(bug)})`, 'release', { uid }, 'sm danger', away)}
    </div>
    <p class="flavor">"${esc(sp.desc)}"</p>
    <div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

// ---------- Expeditions ----------

export function renderExpeditions(v) {
  const { game, A } = v;
  const st = game.state;
  const slots = expeditionSlots(st);
  const active = st.expeditions.map((exp) => {
    const tl = game.timeline(exp);
    const area = AREA_BY_ID[exp.areaId];
    return `<div class="exp-card ${tl.done ? 'done' : ''}">
      <div class="exp-top"><b>${area.name}</b><span>${tl.done ? 'Complete!' : `Encounter ${tl.resolved + 1}/${exp.count} · ${countdown(game, exp.endsAt)} left`}</span></div>
      <div class="exp-team">${exp.party.map((uid) => { const b = game.bug(uid); return b ? bugImg(A, b, 'sm walk') : ''; }).join('')}</div>
      ${bar(tl.fraction, 'exp', exp.startAt, exp.endsAt)}
      <div class="row">${btn('Live log', 'view-exp', { id: exp.id }, 'sm')}${tl.done ? btn('Claim rewards', 'claim', { id: exp.id }, 'go') : ''}</div>
    </div>`;
  }).join('');
  const history = st.history.slice(0, 5).map((h) => `<button class="list-row hist" data-act="view-history" data-id="${h.id}">${icon(A, 'map', 'sm')}<div class="grow"><b>${AREA_BY_ID[h.areaId].name}</b><small>${h.count} encounters · ${h.partyNames.join(', ')}</small></div>${coins(A, h.rewards.coins)}</button>`).join('');
  return `<div class="section-title">Underway <small>${st.expeditions.length}/${slots} expedition slots</small></div>
    ${active || '<p class="muted center">No parties out. Choose an area and assemble four bugs.</p>'}
    <div class="section-title">Areas</div>
    ${AREAS.map((a) => areaCard(v, a)).join('')}
    ${history ? `<div class="section-title">Recent expeditions</div>${history}` : ''}`;
}

function areaCard(v, area) {
  const { game, A } = v;
  const st = game.state;
  const as = st.areas[area.id];
  const busy = st.expeditions.length >= expeditionSlots(st);
  const encMin = encounterMs(st, []);
  let action;
  if (as.unlocked) action = btn('Assemble party', 'plan', { area: area.id }, 'go', busy);
  else {
    const prev = AREAS[area.index - 1];
    const runs = st.areas[prev.id].runs;
    const ready = runs >= area.unlock.runs;
    action = `<div class="unlock-req">${icon(A, 'lock', 'xs')} ${Math.min(runs, area.unlock.runs)}/${area.unlock.runs} expeditions in ${prev.name} · ${fmtNum(area.unlock.coins)} coins</div>
      ${btn(`Unlock for ${fmtNum(area.unlock.coins)}`, 'unlock', { area: area.id }, 'go', !ready || st.coins < area.unlock.coins)}`;
  }
  return `<div class="area-card ${as.unlocked ? '' : 'locked'}">
    <div class="area-banner px-bg" style="${areaBackground(area, A)}"><span>${area.index + 1}. ${area.name}</span><i class="diff">Difficulty ${area.difficulty}</i></div>
    <div class="area-body"><p>${esc(area.desc)}</p>
      <div class="meta">${fmtDur(encMin)} per encounter · trips from ${fmtDur(EXPEDITION_LENGTH.min * encMin)} to overnight${as.unlocked ? ` · ${as.runs} completed` : ''}</div>
      <div class="row wrap">${action}</div></div></div>`;
}

export function plannerModal(v0) {
  const v = withAway(v0);
  const { game, A, ui } = v;
  const st = game.state;
  const area = AREA_BY_ID[ui.plan.areaId];
  const party = ui.plan.party.map((u) => game.bug(u)).filter(Boolean);
  const scores = partyTraitScores(party);
  const bonus = partyBonuses(party);
  const encMs = encounterMs(st, party);
  const eligible = [...st.bugs].sort((a, b) => (v.away.has(a.uid) - v.away.has(b.uid)) || traitTotal(b) - traitTotal(a));
  const keyHolders = party.filter((b) => b.item === 'key');
  return `<div class="area-banner px-bg small" style="${areaBackground(area, A)}"><span>${area.name}</span><i class="diff">Difficulty ${area.difficulty}</i></div>
    <div class="section-title">Party <small>${party.length}/${PARTY_SIZE} — exactly ${PARTY_SIZE} needed</small>${btn('Auto-pick', 'plan-auto', {}, 'sm')}</div>
    <div class="team-slots">${Array.from({ length: PARTY_SIZE }, (_, i) => {
      const b = party[i];
      return b ? `<button class="slot filled" data-act="plan-toggle" data-uid="${b.uid}">${bugImg(A, b)}<small>${esc(bugName(b))}</small></button>` : '<div class="slot">+</div>';
    }).join('')}</div>
    <div class="coverage">${TRAIT_IDS.map((t) => {
      const s = scores[t];
      const score = s ? s.score : 0;
      const chance = checkChance(score, area.difficulty);
      return `<div class="cov-row">${traitIcon(A, t, 'sm')}<b>${TRAITS[t].name}</b>${bar(score / (area.difficulty * 2 + 2), `t-${t}`)}<span>${score ? score.toFixed(1) : '—'}</span><small>${pct(chance)}</small></div>`;
    }).join('')}<small class="muted">Party score per trait (best bug counts fully, helpers less) and the chance to pass an average ${area.name} check.</small></div>
    <div class="meta">${keyHolders.length ? `${icon(A, 'key', 'xs')} ${keyHolders.map((b) => esc(bugName(b))).join(', ')} carr${keyHolders.length > 1 ? 'y keys' : 'ies a key'} for locked chests.` : `${icon(A, 'chest', 'xs')} No Chest Key equipped. Locked chests can only be forced with very strong Lift.`}</div>
    ${tripLength(v, area, party, encMs)}
    ${bonus.coinBonus || bonus.specialFind || bonus.encounterSpeed ? `<div class="meta">${[bonus.encounterSpeed && `Items: encounters -${pct(bonus.encounterSpeed)} time`, bonus.coinBonus && `+${pct(bonus.coinBonus)} coins`, bonus.specialFind && `+${pct(bonus.specialFind)} special finds`].filter(Boolean).join(' · ')}</div>` : ''}
    <div class="bug-grid compact">${eligible.map((b) => bugCard(v, b, { act: 'plan-toggle', selected: ui.plan.party.includes(b.uid), disabled: v.away.has(b.uid) })).join('')}</div>
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}${btn('Launch expedition', 'launch', {}, 'go big', party.length !== PARTY_SIZE)}</div>`;
}

// Trip length picker: presets by hours, plus fine-tuning by single encounters.
function tripLength(v, area, party, encMs) {
  const { game, ui } = v;
  const count = ui.plan.count;
  const back = new Date(game.now() + count * encMs);
  const sameDay = back.toDateString() === new Date(game.now()).toDateString();
  const presets = [['Short', defaultEncounterCount(area)], ...EXPEDITION_LENGTH.presetHours.map((h) => [h === 8 ? '8h overnight' : `${h}h`, encountersForHours(game.state, party, h)])];
  return `<div class="section-title">Trip length</div>
    <div class="trip">
      <div class="row wrap presets">${presets.map(([label, n]) => btn(label, 'plan-count', { n }, `sm ${n === count ? 'on' : ''}`)).join('')}</div>
      <div class="row stepper">${btn('−', 'plan-count', { n: count - 1 }, 'sm', count <= EXPEDITION_LENGTH.min)}<b>${count} encounters</b>${btn('+', 'plan-count', { n: count + 1 }, 'sm', count >= EXPEDITION_LENGTH.max)}</div>
      <div class="meta">${count} × ${fmtDur(encMs)} = <b>${fmtDur(count * encMs)}</b> · back ${sameDay ? '' : 'tomorrow '}at <b>${back.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b></div>
    </div>`;
}

function encounterLine(v, exp, e, i) {
  const { A } = v;
  const at = (i + 1) * exp.encounterMs;
  const r = { coins: e.coins, items: e.items, eggs: e.eggs };
  const check = e.chance !== undefined ? `<span class="check">${traitIcon(A, e.trait)} ${TRAITS[e.trait].name} ${e.score} vs ${e.difficulty} · ${pct(e.chance)}</span>` : '';
  return `<div class="log-line o-${e.outcome} ${e.chest ? 'chest-line' : ''}">
    <span class="ts">${fmtClock(at)}</span>
    <div class="grow"><p>${esc(e.intro)}</p><p class="res">${e.chest ? icon(A, 'chest_open', 'xs') : ''}${esc(e.text)}</p>${check}${rewardInline(A, r)}</div>
  </div>`;
}

function rewardInline(A, r) {
  const parts = [];
  if (r.coins) parts.push(coins(A, r.coins));
  for (const [id, n] of Object.entries(r.items)) parts.push(`${icon(A, id, 'xs')}${n > 1 ? `x${n}` : ''}`);
  for (const t of r.eggs) parts.push(eggImg(A, t, 'xs'));
  return parts.length ? `<div class="rw">${parts.join(' ')}</div>` : '';
}

export function expeditionLogModal(v, id, fromHistory = false) {
  const { game, A } = v;
  const st = game.state;
  const exp = (fromHistory ? st.history : st.expeditions).find((e) => e.id === id);
  if (!exp) return null;
  const area = AREA_BY_ID[exp.areaId];
  const tl = fromHistory ? { done: true, resolved: exp.count, fraction: 1, current: null } : game.timeline(exp);
  const shown = exp.encounters.slice(0, tl.resolved);
  const soFar = sumRewards(shown);
  const cur = tl.current !== null ? exp.encounters[tl.current] : null;
  const party = exp.party.map((uid, i) => game.bug(uid) || { gone: exp.partyNames[i], species: 'ant', variant: null });
  return `<div class="area-banner px-bg small" style="${areaBackground(area, A)}"><span>${area.name}</span>
      <div class="march" style="--p:${tl.fraction}">${party.map((b) => bugImg(A, b, 'sm walk')).join('')}</div></div>
    <div class="party-line">${party.map((b) => `<span>${bugImg(A, b, 'xs')}${esc(b.gone || bugName(b))}</span>`).join('')}</div>
    ${fromHistory ? '' : `${bar(tl.fraction, 'exp', exp.startAt, exp.endsAt)}
    <div class="timing"><span>Encounter <b>${tl.done ? exp.count : tl.resolved + 1}</b> of ${exp.count}</span><span>Elapsed ${tl.done ? fmtTime(exp.endsAt - exp.startAt) : since(game, exp.startAt)}</span><span>Remaining ${tl.done ? '0s' : countdown(game, exp.endsAt)}</span></div>`}
    ${cur ? `<div class="current"><b>Now:</b> ${esc(cur.intro)}<small>Resolves in ${countdown(game, tl.currentEndsAt)}</small></div>` : ''}
    <div class="section-title">Found so far</div>${rewardInline(A, soFar) || '<p class="muted">Nothing yet.</p>'}
    <div class="section-title">Expedition log</div>
    <div class="log">
      <div class="log-line"><span class="ts">${fmtClock(0)}</span><div class="grow"><p>Your party entered ${area.name}.</p></div></div>
      ${shown.map((e, i) => encounterLine(v, exp, e, i)).join('')}
      ${tl.done ? `<div class="log-line o-great"><span class="ts">${fmtClock(exp.count * exp.encounterMs)}</span><div class="grow"><p><b>Expedition complete!</b> ${fromHistory ? 'Rewards claimed.' : 'Rewards are ready to claim.'}</p></div></div>`
        : `<div class="log-line future"><span class="ts">${fmtClock((tl.resolved + 2) * exp.encounterMs)}</span><div class="grow"><p>${tl.resolved + 1 < exp.count ? 'Next encounter: ???' : 'The party heads home.'}</p></div></div>`}
    </div>
    <div class="row sticky-foot">${btn('Close', 'close-modal')}${!fromHistory && tl.done ? btn('Claim rewards', 'claim', { id }, 'go big') : ''}</div>`;
}

export function claimModal(v, report) {
  const { A } = v;
  const { rewards, area, expedition: exp } = report;
  const chests = exp.encounters.filter((e) => e.chest);
  return `<div class="area-banner px-bg small" style="${areaBackground(area, A)}"><span>Back from ${area.name}</span></div>
    ${chests.map((c, i) => `<div class="chest-reveal" style="animation-delay:${i * 0.4}s">
      <div class="chest-anim">${icon(A, 'chest', 'big closed')}${icon(A, 'chest_open', 'big open')}</div>
      <div><b>Chest opened by ${esc(v.game.bug(c.keyUsedBy) ? bugName(v.game.bug(c.keyUsedBy)) : 'a party member')}!</b><small>The Chest Key was used up.</small>${rewardInline(A, c)}</div></div>`).join('')}
    <div class="section-title">Rewards</div>
    <div class="rewards">
      <div class="reward">${coins(A, rewards.coins)}</div>
      ${Object.entries(rewards.items).map(([id, n]) => `<div class="reward">${icon(A, id, 'sm')} ${ITEMS[id].name} x${n}</div>`).join('')}
      ${rewards.eggs.map((t) => `<div class="reward">${eggImg(A, t, 'sm')} ${EGG_BY_ID[t].name}</div>`).join('')}
    </div>
    ${rewards.eggs.length ? '<p class="meta">New eggs are waiting in the Hatchery basket.</p>' : ''}
    ${report.levelUps.length ? `<div class="section-title">Level ups</div>${report.levelUps.map((l) => `<p>${esc(l.name)} reached Lv ${l.level}: ${l.traits.filter(Boolean).map((t) => `+1 ${TRAITS[t].name}`).join(', ')}</p>`).join('')}` : ''}
    ${report.unlockable ? `<p class="ok center">${report.unlockable.name} can now be unlocked in Explore!</p>` : ''}
    <div class="row sticky-foot">${btn('View log', 'view-history', { id: exp.id })}${btn('Great!', 'close-modal', {}, 'go big')}</div>`;
}

// ---------- Items ----------

export function renderItems(v) {
  const { game, A, ui } = v;
  const st = game.state;
  const tabs = `<div class="tabs">${btn('Shop', 'items-tab', { tab: 'shop' }, ui.itemsTab === 'shop' ? 'on' : '')}${btn('Inventory', 'items-tab', { tab: 'inventory' }, ui.itemsTab === 'inventory' ? 'on' : '')}</div>`;
  if (ui.itemsTab === 'shop') {
    return `${tabs}<p class="muted">Equipment for your bugs. Each bug holds one item. Chest Keys can't be bought: find them on expeditions.</p>
      ${Object.entries(ITEMS).filter(([, it]) => it.buy).map(([id, it]) => `<div class="list-row">${icon(A, id)}<div class="grow"><b>${it.name}</b>${st.inventory[id] ? ` <small class="inline">(own ${st.inventory[id]})</small>` : ''}<small>${itemEffectsText(id)}</small><small>${esc(it.desc)}</small></div>${btn(coins(A, it.buy), 'buy-item', { item: id }, 'go sm', st.coins < it.buy)}</div>`).join('')}`;
  }
  const ids = Object.keys(st.inventory).filter((id) => ITEMS[id]);
  const equipped = st.bugs.filter((b) => b.item);
  const sections = Object.entries(ITEM_TYPES).map(([type, title]) => {
    const list = ids.filter((id) => ITEMS[id].type === type);
    if (!list.length) return '';
    return `<div class="section-title">${title}</div>${list.map((id) => {
      const n = st.inventory[id];
      const price = sellPrice(id);
      return `<div class="list-row">${icon(A, id)}<div class="grow"><b>${ITEMS[id].name}</b> x${n}<small>${type === 'gear' ? itemEffectsText(id) : esc(ITEMS[id].desc)}</small></div>
        <div class="row col">${type === 'gear' ? btn('Equip', 'item-equip', { item: id }, 'go sm') : ''}${btn(`Sell ${price}`, 'sell', { item: id, qty: 1 }, 'sm')}${n > 1 && type === 'resource' ? btn(`All ${price * n}`, 'sell', { item: id, qty: n }, 'sm') : ''}</div></div>`;
    }).join('')}`;
  }).join('');
  return `${tabs}${sections || '<p class="muted center">Your inventory is empty.</p>'}
    ${equipped.length ? `<div class="section-title">Equipped on bugs</div>${equipped.map((b) => `<div class="list-row">${icon(A, b.item)}<div class="grow"><b>${ITEMS[b.item].name}</b><small>on ${esc(bugName(b))}${game.assignment(b) === 'expedition' ? ' (exploring)' : ''}</small></div>${btn('Unequip', 'unequip', { uid: b.uid }, 'sm', game.assignment(b) === 'expedition')}</div>`).join('')}` : ''}`;
}

export function pickBugModal(v0, itemId) {
  const v = withAway(v0);
  const { game, A } = v;
  const list = game.state.bugs.filter((b) => !v.away.has(b.uid));
  return `<div class="modal-head">${icon(A, itemId, 'big')}<div><h3>Equip ${ITEMS[itemId].name}</h3><small>${itemEffectsText(itemId)}</small></div></div>
    <p class="meta">A bug's current item goes back to your inventory.</p>
    <div class="bug-grid compact">${list.map((b) => bugCard(v, b, { act: 'equip', data: { item: itemId } })).join('')}</div>
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}</div>`;
}

// ---------- Upgrades ----------

export function renderUpgrades(v) {
  const { game, A } = v;
  const st = game.state;
  return `<p class="muted">Permanent, global improvements. They apply to eggs and expeditions started after you buy them.</p>
    ${UPGRADES.map((u) => {
      const lvl = st.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id, lvl);
      const maxed = lvl >= u.max;
      return `<div class="upgrade ${maxed ? 'maxed' : ''}">
        <div class="grow"><b>${u.name}</b> <small class="inline">Lv ${lvl}/${u.max}</small><small>${u.desc}</small>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          <small>Now: ${lvl ? u.text(lvl) : 'no bonus yet'}${maxed ? '' : `<br>Next: <b>${u.text(lvl + 1)}</b>`}</small></div>
        ${maxed ? '<span class="ok">MAX</span>' : btn(coins(A, cost), 'upgrade', { id: u.id }, 'go sm', st.coins < cost)}
      </div>`;
    }).join('')}`;
}

// ---------- dialogs ----------

export function confirmModal(v, { title, body, yes = 'Confirm', danger = false }) {
  return `<h3>${title}</h3><div class="confirm-body">${body}</div>
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}${btn(yes, 'confirm-yes', {}, danger ? 'danger big' : 'go big')}</div>`;
}

const timeAgo = (ms) => {
  const m = Math.floor(ms / 60e3), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d) return `${d} day${d > 1 ? 's' : ''} ago`;
  if (h) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return m ? `${m} min ago` : 'just now';
};

export function settingsModal(v) {
  const { game, ui, A } = v;
  const s = game.state.stats;
  return `<h3>Settings</h3>
    <table class="kv">
      <tr><td>Expeditions completed</td><td>${s.expeditions}</td></tr><tr><td>Eggs hatched</td><td>${s.hatched}</td></tr>
      <tr><td>Chests opened</td><td>${s.chestsOpened}</td></tr><tr><td>Coins earned</td><td>${fmtNum(s.coinsEarned)}</td></tr>
    </table>
    <h4>App version</h4>
    <p class="muted">You're on version <b>${VERSION}</b>.${ui.updateAvailable ? ` Version <b>${esc(ui.updateAvailable)}</b> is ready.` : ''}</p>
    <div class="row wrap">${ui.updateAvailable ? btn('Update now', 'update-app', {}, 'go') : btn('Check for updates', 'check-update')}</div>
    <h4>Backup</h4>
    <p class="muted">Progress saves automatically, but only on this device. Removing the home-screen icon or clearing website data erases it, so keep a backup. ${ui.lastBackup ? `Last backup: <b>${timeAgo(Date.now() - ui.lastBackup)}</b>.` : '<b>No backup yet.</b>'}</p>
    <div class="row wrap">${btn('Save backup file', 'backup-file', {}, 'go')}<label class="btn">Load backup file<input id="save-file" type="file" accept=".txt,text/plain" hidden></label></div>
    <p class="muted">Or copy a save code into your notes, then paste it here to restore.</p>
    <textarea id="save-code" rows="3" placeholder="Paste a save code here to restore it">${ui.exportCode ? esc(ui.exportCode) : ''}</textarea>
    <div class="row wrap">${btn('Copy save code', 'export')}${btn('Restore from code', 'import')}${btn('Reset game', 'reset', {}, 'danger')}</div>
    ${ui.debug ? devTools(v) : ''}
    <div class="row sticky-foot">${btn('How to play', 'help')}${btn('Close', 'close-modal')}</div>`;
}

function devTools(v) {
  const { game, ui, A } = v;
  return `<h4>Developer tools <small class="inline">(only with ?debug)</small></h4>
    <p class="muted">Time warp: ${fmtTime(game.timeOffset)} ahead. Warping moves the game clock, so timers finish exactly as they would for real.</p>
    <div class="row wrap">${btn('+10 min', 'warp', { ms: 600e3 })}${btn('+1 hour', 'warp', { ms: 3600e3 })}${btn('+4 hours', 'warp', { ms: 4 * 3600e3 })}${btn('+5000 coins', 'dev-coins')}${btn('+1 Chest Key', 'dev-key')}${btn('+1 of each egg', 'dev-eggs')}</div>
    <p class="muted">Odds lab: hatch 10,000 simulated eggs without touching your save.</p>
    <div class="row wrap">${EGG_TIERS.map((t) => btn(t.name.replace(' Egg', ''), 'dev-odds', { tier: t.id }, 'sm')).join('')}</div>
    ${ui.oddsLab ? `<table class="odds">${RARITY_ORDER.map((r) => `<tr><td>${rarityTag(r)}</td><td>${ui.oddsLab.counts[r]}</td><td>${pct(ui.oddsLab.counts[r] / 10000, 2)}</td><td class="muted">expected ${EGG_BY_ID[ui.oddsLab.tier].odds[r]}%</td></tr>`).join('')}</table>` : ''}`;
}

export function welcomeModal(v) {
  const { A } = v;
  return `<div class="welcome">
    <div class="welcome-bugs">${['ant', 'ladybug', 'pill_bug', 'caterpillar'].map((id) => speciesImg(A, id, 'big walk')).join('')}</div>
    <h3>Welcome to Bug Garden!</h3>
    <p class="center motto-inline">"${HATCHERY_MOTTO}"</p>
    <ol>
      <li>${icon(A, 'flower', 'sm')} <b>Garden:</b> up to ${GARDEN_LIMIT} bugs live here. Tap one to meet it, and tap coins they dig up.</li>
      <li>${eggImg(A, 'common', 'sm')} <b>Hatchery:</b> buy eggs and settle them into the nests at the bottom of the garden. After 4 hours, tap to crack them open. Higher tiers improve the odds but guarantee nothing, and any bug might hatch Shiny, Albino or Golden.</li>
      <li>${icon(A, 'rock', 'sm')} <b>The rock:</b> drag it around the garden. Shy bugs like to hide underneath, so lift it to say hi.</li>
      <li>${icon(A, 'map', 'sm')} <b>Explore:</b> send exactly 4 bugs out. Each encounter takes ${fmtDur(BASE_ENCOUNTER_MS)} and tests their traits: ${TRAIT_IDS.map((t) => `${traitIcon(A, t)}${TRAITS[t].name}`).join(' ')}.</li>
      <li>${icon(A, 'key', 'sm')} <b>Keys:</b> equip a Chest Key on a party member to open locked chests.</li>
      <li>${icon(A, 'hammer', 'sm')} <b>Upgrades:</b> permanent boosts bought with coins.</li>
    </ol>
    <p class="muted">Timers keep running while the game is closed.</p></div>
    <div class="row sticky-foot">${btn("Let's go!", 'welcome-done', {}, 'go big')}</div>`;
}

export function migratedModal(v, refund) {
  return `<h3>Bug Garden has grown!</h3>
    <p>Your garden was updated to the new version. All your bugs, eggs and gear came with you:</p>
    <ul><li>Bugs now have the six expedition traits (Lift, Cut, Fight, Fly, Dig, Build), with levels based on how far you'd trained them.</li>
    <li>Old eggs became the new egg tiers. Eggs already incubating keep their original timers.</li>
    <li>Old upgrades, items that no longer exist and unfinished expeditions were refunded: <b>${fmtNum(refund)} coins</b>.</li></ul>
    <div class="row sticky-foot">${btn('Show me', 'close-modal', {}, 'go big')}</div>`;
}
