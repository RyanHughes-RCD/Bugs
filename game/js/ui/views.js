import { SPECIES, SPECIES_LIST, FAMILIES } from '../data/species.js';
import { RARITIES, RARITY_ORDER, VARIANTS } from '../data/rarities.js';
import { TRAITS, TRAIT_IDS } from '../data/traits.js';
import { ITEMS, ITEM_TYPES, ITEM_TIERS, sellPrice, itemEffectsText, itemStock } from '../data/items.js';
import { EGG_TIERS, EGG_BY_ID, HATCHERY_MOTTO } from '../data/eggs.js';
import { AREAS, AREA_BY_ID } from '../data/areas.js';
import { UPGRADES, upgradeCost, upgradeValue } from '../data/upgrades.js';
import { GARDEN_LIMIT, PARTY_SIZE, BASE_ENCOUNTER_MS, EXPEDITION_LENGTH } from '../data/balance.js';
import { DECOR } from '../data/decor.js';
import { GARDEN_CHESTS } from '../data/garden-chests.js';
import { gardenChestArea } from '../systems/chests.js';
import { effectiveTraits, itemBonus, bugName, bugsOnExpedition, assignmentOf, gardenCount, gardenLimit, releaseValue, rarityOf, traitTotal } from '../systems/bugs.js';
import { eggOdds, incubatorCount, incubationMs, shopStock } from '../systems/eggs.js';
import { expeditionSlots, encounterMs, partyBonuses, sumRewards, defaultEncounterCount, encountersForHours, paceFactor, encounterEnds } from '../systems/expedition.js';
import { partySynergies, boostedParty, synergyScores, synergyPower, expectedTimeShare, guaranteedOnly, triggerChance } from '../systems/synergies.js';
import { SYNERGIES, SYNERGY_IDS, TRIGGER } from '../data/synergies.js';
import { PRESET_LIMIT } from '../data/balance.js';
import { partyTraitScores, checkChance } from '../systems/traits.js';
import { gardenRatePerMin, potCap, ownsDecor, favouriteDecor } from '../systems/garden.js';
import { areaBackground } from './scenes.js';
import { esc, fmtTime, fmtNum, pct, fmtClock, fmtDur } from './format.js';
import { VERSION } from '../version.js';

// ---------- building blocks ----------

const icon = (A, id, cls = '') => `<img class="px icon ${cls}" src="${A.spriteUrl(id)}" alt="">`;
// Bug image with its colour variant and any magical aura. Golden bugs get a
// wrapper so CSS can draw sparkles around them.
// Bugs with special effects (species fx) get matching CSS animations, and a
// wrapper that draws particles around them (not on silhouettes).
const PARTICLE_FX = ['embers', 'bubbles', 'frost', 'sparkle', 'nova', 'constellation', 'orbit', 'lightning', 'void', 'rays'];
export const bugImg = (A, bug, cls = '') => {
  const sp = SPECIES[bug.species];
  const sil = cls.includes('sil');
  const fx = sil ? [] : sp.fx;
  const style = [sp.aura ? `--aura:${sp.aura}` : '', fx.length ? `--fx:${sp.fxColor}` : ''].filter(Boolean).join(';');
  let img = `<img class="px bug-img ${bug.variant ? `v-${bug.variant}` : ''} ${sp.aura ? 'aura' : ''} ${fx.map((f) => `fx-${f}`).join(' ')} ${sp.view} ${cls}" ${style ? `style="${style}"` : ''} src="${A.bugUrl(bug.species, bug.variant)}" alt="${esc(sp.name)}">`;
  const particles = fx.find((f) => PARTICLE_FX.includes(f));
  if (particles) img = `<span class="fx-wrap fxp-${particles}" style="--fx:${sp.fxColor}">${img}</span>`;
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

// A small coloured tag naming an item's tier (Common ... Relic).
const itemTierTag = (it) => (it.tier ? `<span class="item-tier" style="--tc:${ITEM_TIERS[it.tier].color}">${ITEM_TIERS[it.tier].name}</span>` : '');

function bugCard(v, bug, { act = 'open-bug', selected = false, disabled = false, extra = '', data = {}, unlocks = [] } = {}) {
  const st = v.game.state;
  const r = rarityOf(bug);
  const asg = assignmentOf(bug, st, v.away);
  return `<button class="bug-card r-${r} ${selected ? 'selected' : ''}" data-act="${act}" data-uid="${bug.uid}" ${Object.entries(data).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ')} ${disabled ? 'disabled' : ''}>
    ${bugImg(v.A, bug)}
    <span class="bc-name">${esc(bugName(bug))}</span>
    <span class="bc-lv">Power ${traitTotal(bug)}</span>
    <span class="bc-traits">${traitChips(v.A, bug)}</span>
    ${bug.item ? `<span class="bc-gear">${icon(v.A, bug.item, 'xs')}</span>` : ''}
    <span class="badge a-${asg}">${ASSIGN_LABEL[asg]}</span>${extra}
    ${unlocks.length ? `<span class="bc-syn">+${unlocks.map(esc).join(', +')}</span>` : ''}
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
      <button class="pot ${pot >= 1 ? 'has' : ''}" data-act="collect-garden" title="Coins your garden bugs dug up">${icon(A, 'coin')}<span><b>${fmtNum(pot)}</b>/${potCap(st)}</span><small>+${gardenRatePerMin(st).toFixed(1)}/min</small></button>
      <button class="chip garden-count" data-act="nav" data-panel="bugs">${icon(A, 'flower', 'xs')} ${garden}/${gardenLimit(st)}</button>
      <button class="chip chests-chip" data-act="garden-chests" title="Open chests with your Chest Keys">${icon(A, 'key', 'xs')} ${st.inventory.key || 0}</button>
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
    <div class="grow"><b>${esc(bugName(bug))}</b> ${rarityTag(r)}<small>Power ${traitTotal(bug)}${bug.item ? ` · ${ITEMS[bug.item].name}` : ''}</small>
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
    <div class="egg-shop">${EGG_TIERS.map((t) => {
      const stock = shopStock(st, t.id);
      return `<div class="egg-offer t-${t.id} ${stock.ok ? '' : 'locked'}">
      ${eggImg(A, t.id, 'big')}<b>${t.name}</b>
      <small>${stock.ok ? `${esc(t.desc)} Hatches in ${fmtDur(incubationMs(st, t.id))}.` : `${icon(A, 'lock', 'xs')} ${esc(stock.reason)}`}</small>
      <div class="row">${btn('Odds', 'odds', { tier: t.id }, 'sm')}${btn(coins(A, t.price), 'buy-egg', { tier: t.id }, 'go sm', !stock.ok || st.coins < t.price)}</div>
    </div>`;
    }).join('')}</div>
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
        ${gardenFull ? `<span class="muted">Garden full (${gardenLimit(v.game.state)}/${gardenLimit(v.game.state)})</span>` : btn('Place in garden', 'garden-in', { uid: bug.uid, close: 1 }, 'go big')}
      </div>
    </div>`;
}

// ---------- Collection ----------

export function renderCollection(v0) {
  const v = withAway(v0);
  const { game, ui, A } = v;
  const st = game.state;
  const tabs = `<div class="tabs">${btn(`My bugs (${st.bugs.length})`, 'bugs-tab', { tab: 'mine' }, ui.bugsTab === 'mine' ? 'on' : '')}${btn('Bugdex', 'bugs-tab', { tab: 'dex' }, ui.bugsTab === 'dex' ? 'on' : '')}${btn('Studio', 'bugs-tab', { tab: 'studio' }, ui.bugsTab === 'studio' ? 'on' : '')}</div>`;
  if (ui.bugsTab === 'dex') return tabs + renderDex(v);
  if (ui.bugsTab === 'studio') return tabs + renderStudio(v);
  const f = ui.filter;
  let list = st.bugs.filter((b) => (!f.rarity || rarityOf(b) === f.rarity) && (!f.trait || effectiveTraits(b)[f.trait]) && (!f.place || assignmentOf(b, st, v.away) === f.place));
  const sorts = {
    rarity: (a, b) => RARITY_ORDER.indexOf(rarityOf(b)) - RARITY_ORDER.indexOf(rarityOf(a)) || traitTotal(b) - traitTotal(a),
    trait: (a, b) => (f.trait ? (effectiveTraits(b)[f.trait] || 0) - (effectiveTraits(a)[f.trait] || 0) : traitTotal(b) - traitTotal(a)),
    power: (a, b) => traitTotal(b) - traitTotal(a),
    newest: (a, b) => b.uid - a.uid,
  };
  list = [...list].sort(sorts[ui.sort] || sorts.rarity);
  const chip = (label, key, val) => btn(label, 'filter', { key, val: f[key] === val ? '' : val }, `sm ${f[key] === val ? 'on' : ''}`);
  return `${tabs}
    <div class="garden-line">${icon(A, 'flower', 'sm')} Garden <b>${gardenCount(st)}/${gardenLimit(st)}</b> · open a bug to move it in or out</div>
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
    <div class="row sticky-foot">${v.studio?.available ? btn('Edit sprite', 'ed-fix', { id }, 'sm') : ''}${btn('Close', 'close-modal')}</div>`;
}

// ---------- Sprite Studio ----------

const ago = (t) => `${fmtTime(Math.max(0, Date.now() - t))} ago`;
const STATUS_LABEL = { pending: 'Waiting for approval', approved: 'Approved', rejected: 'Not approved' };

export function renderStudio(v) {
  const { A, ui } = v;
  const studio = v.studio;
  const head = `<div class="studio-head"><b>Sprite Studio</b>
      <small>Redraw a wonky sprite or invent a brand-new bug. The game's owner approves what goes in: approved fixes replace the sprite for everyone.</small></div>`;
  if (!studio?.available) {
    return `${head}<p class="muted">The studio works in the shared game on claude.ai, where everyone the game is shared with can draw and submit. It isn't available in this copy.</p>`;
  }
  const f = ui.studioFilter;
  const list = studio.list({ kind: f.kind, status: f.mine ? null : f.status, mine: f.mine });
  const chip = (label, data, on) => btn(label, 'studio-filter', data, `sm ${on ? 'on' : ''}`);
  const live = Object.entries(studio.live.sprites);
  const ideas = Object.values(studio.live.bugs).sort((a, b) => b.at - a.at);
  return `${head}
    <div class="row wrap studio-actions">${btn('Fix a sprite', 'studio-pick', { mode: 'fix' }, 'go')}${btn('New bug idea', 'studio-pick', { mode: 'idea' }, 'go')}</div>
    <div class="filters">
      <div class="row wrap">${['pending', 'approved', 'rejected'].map((st) => chip(st[0].toUpperCase() + st.slice(1), { status: st }, !f.mine && f.status === st)).join('')}${chip('Mine', { mine: 1 }, f.mine)}</div>
      <div class="row wrap">${chip('All', { kind: '' }, !f.kind)}${chip('Fixes', { kind: 'fix' }, f.kind === 'fix')}${chip('Bug ideas', { kind: 'idea' }, f.kind === 'idea')}</div>
    </div>
    <div class="sub-list">${list.map((s) => submissionCard(v, s)).join('') || `<p class="muted">Nothing here yet.${f.status === 'pending' && !f.mine ? ' Be the first to submit something!' : ''}</p>`}</div>
    ${ideas.length ? `<h4>Approved bug ideas</h4><p class="meta">These are on their way into the game.</p><div class="idea-gallery">${ideas.map((b) => `<div class="idea-cell r-${b.rarity}"><img class="px bug-img" src="${A.rowsUrl(b.rows)}" alt=""><b>${esc(b.name)}</b><small>by ${esc(studio.nameOf(b.author))}</small></div>`).join('')}</div>` : ''}
    ${studio.isOwner && live.length ? `<h4>Live sprite fixes</h4><p class="meta">Only you see this. Put a bug back to its original art, or to an earlier approved fix.</p>
      ${live.map(([id, fix]) => `<div class="upgrade"><img class="px bug-img" src="${A.rowsUrl(fix.rows)}" alt=""><div class="grow"><b>${esc(SPECIES[id].name)}</b><small>Live since ${ago(fix.at)}</small>
        <div class="row wrap">${studio.history(id).filter((h) => h.ref !== fix.ref).map((h) => `<button class="hist-btn" data-act="studio-live" data-id="${id}" data-ref="${esc(h.ref)}" title="Use this fix"><img class="px" src="${A.rowsUrl(h.rows)}" alt=""></button>`).join('')}</div></div>
        ${btn('Use original', 'studio-live', { id, ref: '' }, 'sm')}</div>`).join('')}` : ''}`;
}

function submissionCard(v, s) {
  const { A } = v;
  const studio = v.studio;
  const status = studio.status(s.ref);
  const mine = s.author === studio.me;
  const d = studio.decisions[s.ref];
  const art = s.kind === 'fix'
    ? `<img class="px bug-img" src="${A.bugUrl(s.species)}" alt="now"><span class="arrow">→</span><img class="px bug-img" src="${A.rowsUrl(s.rows)}" alt="fix">`
    : `<img class="px bug-img big" src="${A.rowsUrl(s.rows)}" alt="">`;
  const title = s.kind === 'fix'
    ? `<b>Fix: ${esc(SPECIES[s.species].name)}</b>`
    : `<b>${esc(s.name)}</b> ${rarityTag(s.rarity)} <small class="inline">${FAMILIES[s.family]}</small>`;
  const ideaInfo = s.kind === 'idea'
    ? `${s.desc ? `<small>"${esc(s.desc)}"</small>` : ''}<small>${s.traits.map((t) => `${traitIcon(A, t)} ${TRAITS[t].name}`).join(' ')}${s.habitat ? ` · lives in ${esc(AREA_BY_ID[s.habitat].name)}` : ''}</small>`
    : '';
  const liked = studio.likedByMe(s.ref);
  const actions = [
    btn(`${liked ? '♥' : '♡'} ${studio.likeCount(s.ref)}`, 'studio-like', { ref: s.ref }, `sm like ${liked ? 'on' : ''}`),
    mine && status === 'pending' ? btn('Edit', 'ed-edit', { ref: s.ref }, 'sm') : '',
    mine ? btn(status === 'pending' ? 'Withdraw' : 'Remove', 'studio-withdraw', { key: s.key }, 'sm') : '',
    studio.isOwner && status === 'pending' ? btn('Approve', 'studio-approve', { ref: s.ref }, 'sm go') : '',
    studio.isOwner && status === 'pending' ? btn('Reject', 'studio-reject', { ref: s.ref }, 'sm danger') : '',
  ].join('');
  return `<div class="sub-card s-${status}">
      <div class="sub-art">${art}</div>
      <div class="grow">${title}${ideaInfo}
        ${s.note ? `<small class="note">"${esc(s.note)}"</small>` : ''}
        <small class="muted">by ${esc(studio.nameOf(s.author))} · ${ago(s.updatedAt)} · <span class="st-${status}">${STATUS_LABEL[status]}</span></small>
        ${d?.note ? `<small class="note">Owner: "${esc(d.note)}"</small>` : ''}
        <div class="row wrap sub-actions">${actions}</div></div>
    </div>`;
}

// Choose what to draw: a bug to fix, or how to start a new idea.
export function studioPickModal(v, mode) {
  const { A, game } = v;
  const studio = v.studio;
  const st = game.state;
  const known = SPECIES_LIST.filter((s) => studio.isOwner || st.dex[s.id]?.caught);
  const cells = known.map((s) => `<button class="dex-cell known r-${s.rarity}" data-act="${mode === 'fix' ? 'ed-fix' : 'ed-idea'}" data-id="${s.id}">${speciesImg(A, s.id)}<span class="dex-name">${esc(s.name)}</span>${mode === 'fix' && studio.list({ kind: 'fix', status: 'pending', species: s.id }).length ? '<span class="dex-count">✎</span>' : ''}</button>`).join('');
  return mode === 'fix'
    ? `<h3>Fix a sprite</h3><p class="meta">Pick a bug you've discovered. ✎ marks bugs that already have a fix waiting for approval.</p>
      <div class="dex-grid">${cells || '<p class="muted">Discover some bugs first.</p>'}</div><div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`
    : `<h3>New bug idea</h3><p class="meta">Start from a blank canvas, or trace over a bug you know.</p>
      <div class="row wrap">${btn('Blank 16×16', 'ed-idea', { size: 16 }, 'go')}${btn('Blank 32×32 (big bug)', 'ed-idea', { size: 32 })}</div>
      <h4>Start from a bug</h4><div class="dex-grid">${cells}</div><div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

// The editor. Rendered once (a static modal); the app wires the canvas,
// tools and preview after it opens.
export function editorModal(v, ed) {
  const { A } = v;
  const studio = v.studio;
  const sp = ed.species && SPECIES[ed.species];
  const pendingOthers = ed.kind === 'fix' ? studio.list({ kind: 'fix', status: 'pending', species: ed.species }).filter((s) => s.ref !== ed.ref).length : 0;
  const opt = (val, label, cur) => `<option value="${val}" ${val === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const f = ed.form;
  const ideaForm = ed.kind === 'idea' ? `
    <h4>About your bug</h4>
    <label class="field">Name<input id="ed-name" maxlength="28" value="${esc(f.name || '')}" placeholder="e.g. Glitter Gnat"></label>
    <label class="field">Description<textarea id="ed-desc" maxlength="160" rows="2" placeholder="One line of flavour, like the Bugdex">${esc(f.desc || '')}</textarea></label>
    <div class="field-row">
      <label class="field">Family<select id="ed-family">${Object.entries(FAMILIES).map(([k, n]) => opt(k, n, f.family)).join('')}</select></label>
      <label class="field">Rarity<select id="ed-rarity">${RARITY_ORDER.map((r) => opt(r, RARITIES[r].name, f.rarity)).join('')}</select></label>
    </div>
    <div class="field-row">
      <label class="field">Drawn as<select id="ed-view">${opt('top', 'Top-down, head up', f.view)}${opt('side', 'Side view, facing right', f.view)}</select></label>
      <label class="field">Lives in<select id="ed-habitat">${opt('', 'Anywhere', f.habitat || '')}${AREAS.map((a) => opt(a.id, a.name, f.habitat)).join('')}</select></label>
    </div>
    <div class="field">Traits <small class="inline">(up to 4, signature first)</small><div class="row wrap">${TRAIT_IDS.map((t) => `<label class="trait-pick"><input type="checkbox" data-trait="${t}" ${f.traits?.includes(t) ? 'checked' : ''}>${traitIcon(A, t)} ${TRAITS[t].name}</label>`).join('')}</div></div>` : '';
  return `<h3>${ed.kind === 'fix' ? `Fix: ${esc(sp.name)}` : ed.ref ? 'Edit bug idea' : 'New bug idea'}</h3>
    ${pendingOthers ? `<p class="meta warn">${pendingOthers} other fix${pendingOthers > 1 ? 'es are' : ' is'} already waiting for this bug. Yours will sit beside ${pendingOthers > 1 ? 'them' : 'it'} for the owner to choose.</p>` : ''}
    <p class="meta warn" id="ed-warn" hidden></p>
    <div class="ed-canvas-wrap"><canvas id="ed-canvas"></canvas></div>
    <div class="row wrap ed-tools">
      ${['pen', 'erase', 'fill', 'pick'].map((t) => `<button class="btn sm" data-ed="tool" data-tool="${t}">${{ pen: 'Pen', erase: 'Eraser', fill: 'Fill', pick: 'Pick colour' }[t]}</button>`).join('')}
      <button class="btn sm" data-ed="mirror">Mirror</button>
      <button class="btn sm" data-ed="undo">Undo</button><button class="btn sm" data-ed="redo">Redo</button>
      <button class="btn sm danger" data-ed="clear">Clear</button>
      ${ed.kind === 'idea' ? `<button class="btn sm" data-ed="size">${ed.rows.length === 16 ? 'Make it 32×32' : 'Make it 16×16'}</button>` : ''}
    </div>
    <div class="ed-palette">${Object.entries(A.palette).map(([ch, hex]) => `<button class="swatch" data-ed="color" data-c="${ch}" style="--c:${hex}" title="${ch}"></button>`).join('')}</div>
    <h4>Preview</h4>
    <div class="ed-preview" id="ed-preview"></div>
    ${ideaForm}
    <label class="field">Note for the owner <small class="inline">(optional)</small><textarea id="ed-note" maxlength="160" rows="2" placeholder="${ed.kind === 'fix' ? 'What did you fix?' : 'Anything else about it?'}">${esc(f.note || '')}</textarea></label>
    <div class="row sticky-foot">${btn('Cancel', 'ed-cancel')}${btn(ed.ref ? 'Save changes' : 'Submit', 'ed-submit', {}, 'go')}</div>`;
}

export function rejectModal(v, ref) {
  const s = v.studio.subs.get(ref);
  if (!s) return null;
  return `<h3>Reject ${s.kind === 'fix' ? `this ${esc(SPECIES[s.species].name)} fix` : `"${esc(s.name)}"`}?</h3>
    <label class="field">Note for ${esc(v.studio.nameOf(s.author))} <small class="inline">(optional)</small><textarea id="reject-note" maxlength="160" rows="2" placeholder="Why not, or what to change"></textarea></label>
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}${btn('Reject', 'studio-reject-yes', { ref }, 'danger')}</div>`;
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
  const gear = Object.keys(st.inventory).filter((id) => ITEMS[id]?.type === 'gear');
  const away = asg === 'expedition';
  return `<div class="modal-head">
      <div class="portrait r-${r}">${bugImg(A, bug, 'big')}</div>
      <div><h3>${esc(bugName(bug))}</h3>
        <div>${rarityTag(r)} ${variantTag(bug)}</div>
        <small>${esc(sp.name)} · ${FAMILIES[sp.family]} · #${bug.uid}</small></div>
    </div>
    <div class="lvl-line"><b>Power ${traitTotal(bug)}</b><small>Its total trait levels. Rarity sets them, so rarer bugs make a faster party.</small></div>
    <h4>Traits</h4>
    <div class="trait-list">${Object.keys(eff).map((t) => {
      const b = itemBonus(bug, t);
      return `<div class="trait-row">${traitIcon(A, t, 'sm')}<b>${TRAITS[t].name}</b>${bar(eff[t] / 15, `t-${t}`)}<span>Lv ${eff[t]}${b ? ` <em class="up">(+${b} item)</em>` : ''}</span></div>`;
    }).join('')}</div>
    ${(() => { const fav = favouriteDecor(st, bug.species); return fav ? `<p class="meta">${icon(A, 'heart', 'xs')} Loves the <b>${fav.name}</b>: forages +${Math.round(fav.bonus * 100)}% while it lives in the garden.</p>` : ''; })()}
    <h4>Equipped item <small class="inline">(one per bug)</small></h4>
    <div class="gear-slot">${bug.item ? `${icon(A, bug.item)}<div class="grow"><b>${ITEMS[bug.item].name}</b><small>${itemEffectsText(bug.item)}</small></div>${btn('Unequip', 'unequip', { uid }, 'sm', away)}` : '<span class="muted">Nothing equipped.</span>'}</div>
    ${!away && gear.length ? `<div class="gear-pick">${gear.map((id) => `<button class="item-chip" data-act="equip" data-uid="${uid}" data-item="${id}">${icon(A, id, 'sm')}<span>${ITEMS[id].name} x${st.inventory[id]}<small>${itemEffectsText(id)}</small></span></button>`).join('')}</div>` : ''}
    <h4>Where</h4>
    <div class="row wrap">
      <span class="badge-inline a-${asg}">${ASSIGN_LABEL[asg]}</span>
      ${bug.inGarden ? btn('Move to storage', 'garden-out', { uid }, 'sm') : btn(`Place in garden (${gardenCount(st)}/${gardenLimit(st)})`, 'garden-in', { uid }, 'sm go', gardenCount(st) >= gardenLimit(st))}
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
  const encMin = BASE_ENCOUNTER_MS * (1 - upgradeValue(st, 'expedition_efficiency'));
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
    <div class="area-body">${area.fullName ? `<p class="meta"><b>${esc(area.fullName)}</b></p>` : ''}<p>${esc(area.desc)}</p>
      <div class="meta">${eggImg(A, area.eggTier, 'xs')} Finds ${EGG_BY_ID[area.eggTier].name}s, and rarely better: up to ${EGG_TIERS[Math.min(EGG_TIERS.length - 1, EGG_BY_ID[area.eggTier].index + 3)].name}s</div>
      <div class="meta">Suits party power <b>${area.pace.power}</b>: ${fmtDur(encMin)} per encounter at that power, longer for weaker parties${area.index ? ' (and more so here than in easier areas)' : ''}${as.unlocked ? ` · ${as.runs} completed` : ''}</div>
      <div class="row wrap">${action}</div></div></div>`;
}

export function plannerModal(v0) {
  const v = withAway(v0);
  const { game, A, ui } = v;
  const st = game.state;
  const area = AREA_BY_ID[ui.plan.areaId];
  const party = ui.plan.party.map((u) => game.bug(u)).filter(Boolean);
  const opts = { hour: new Date(game.now()).getHours() }; // Night Shift: launching now
  const syn = partySynergies(party, opts);
  // Estimates count only the bonuses certain to kick in (the variant ones).
  const sure = guaranteedOnly(syn.active);
  const est = { ...opts, active: sure };
  const scores = synergyScores(boostedParty(party, sure), sure);
  const bonus = partyBonuses(party);
  const encMs = encounterMs(st, area, party, est);
  const eligible = [...st.bugs].sort((a, b) => (v.away.has(a.uid) - v.away.has(b.uid)) || traitTotal(b) - traitTotal(a));
  const keyHolders = party.filter((b) => b.item === 'key');
  return `<div class="area-banner px-bg small" style="${areaBackground(area, A)}"><span>${area.name}</span><i class="diff">Difficulty ${area.difficulty}</i></div>
    <div class="section-title">Party <small>${party.length}/${PARTY_SIZE} — exactly ${PARTY_SIZE} needed</small>${btn('Auto-pick', 'plan-auto', {}, 'sm')}</div>
    <div class="team-slots">${Array.from({ length: PARTY_SIZE }, (_, i) => {
      const b = party[i];
      return b ? `<button class="slot filled" data-act="plan-toggle" data-uid="${b.uid}">${bugImg(A, b)}<small>${esc(bugName(b))}</small></button>` : '<div class="slot">+</div>';
    }).join('')}</div>
    ${presetPanel(v, party, opts)}
    ${synergyPanel(v, syn)}
    ${partyGear(v, party)}
    <div class="coverage">${TRAIT_IDS.map((t) => {
      const s = scores[t];
      const score = s ? s.score : 0;
      const chance = checkChance(score, area.difficulty);
      return `<div class="cov-row">${traitIcon(A, t, 'sm')}<b>${TRAITS[t].name}</b>${bar(score / (area.difficulty * 2 + 2), `t-${t}`)}<span>${score ? score.toFixed(1) : '—'}</span><small>${pct(chance)}</small></div>`;
    }).join('')}<small class="muted">Party score per trait (best bug counts fully, helpers less) and the chance to pass an average ${area.name} check.</small></div>
    <div class="meta">${keyHolders.length ? `${icon(A, 'key', 'xs')} ${keyHolders.map((b) => esc(bugName(b))).join(', ')} carr${keyHolders.length > 1 ? 'y keys' : 'ies a key'} for locked chests.` : `${icon(A, 'chest', 'xs')} No Chest Key equipped. Locked chests can only be forced with very strong Lift.`}</div>
    ${paceLine(area, party, encMs, est, sure)}
    ${tripLength(v, area, party, encMs, expectedTimeShare(sure))}
    ${bonus.coinBonus || bonus.specialFind || bonus.encounterSpeed ? `<div class="meta">${[bonus.encounterSpeed && `Items: encounters -${pct(bonus.encounterSpeed)} time`, bonus.coinBonus && `+${pct(bonus.coinBonus)} coins`, bonus.specialFind && `+${pct(bonus.specialFind)} special finds`].filter(Boolean).join(' · ')}</div>` : ''}
    <div class="bug-grid compact">${eligible.map((b) => bugCard(v, b, { act: 'plan-toggle', selected: ui.plan.party.includes(b.uid), disabled: v.away.has(b.uid), unlocks: v.away.has(b.uid) ? [] : wouldUnlock(party, b, syn, opts).map((id) => synName(st, id)) })).join('')}</div>
    <div class="row sticky-foot">${btn('Cancel', 'close-modal')}${btn('Launch expedition', 'launch', {}, 'go big', party.length !== PARTY_SIZE)}</div>`;
}

// Equipment panels under the party slots: one per bug, in the same order.
// Tapping a panel opens a picker of the gear in your bag for that bug.
function partyGear(v, party) {
  const { game, A, ui } = v;
  const st = game.state;
  const panels = Array.from({ length: PARTY_SIZE }, (_, i) => {
    const b = party[i];
    if (!b) return '<div class="gear-panel empty"></div>';
    const it = b.item && ITEMS[b.item];
    return `<button class="gear-panel ${ui.plan.gearFor === b.uid ? 'open' : ''}" data-act="plan-gear" data-uid="${b.uid}" title="Change ${esc(bugName(b))}'s item">
      ${it ? `${icon(A, b.item, 'sm')}<small>${esc(it.name)}</small>` : `<span class="muted">+</span><small>No item</small>`}</button>`;
  }).join('');
  const bug = party.find((b) => b.uid === ui.plan.gearFor);
  let picker = '';
  if (bug) {
    const gear = Object.keys(st.inventory).filter((id) => ITEMS[id]?.type === 'gear' && st.inventory[id] > 0);
    picker = `<div class="gear-picker"><div class="section-title">${esc(bugName(bug))}'s item <small>one per bug; the old one goes back in your bag</small></div>
      ${bug.item ? `<div class="list-row">${icon(A, bug.item, 'sm')}<div class="grow"><b>${ITEMS[bug.item].name}</b> <small class="inline">equipped</small><small>${itemEffectsText(bug.item)}</small></div>${btn('Unequip', 'plan-unequip', { uid: bug.uid }, 'sm')}</div>` : ''}
      ${gear.map((id) => `<div class="list-row">${icon(A, id, 'sm')}<div class="grow"><b>${ITEMS[id].name}</b> x${st.inventory[id]} ${itemTierTag(ITEMS[id])}<small>${itemEffectsText(id)}</small></div>${btn('Equip', 'plan-equip', { uid: bug.uid, item: id }, 'go sm')}</div>`).join('') || '<p class="muted center">No spare gear in your bag. Buy some in Items, or find it on expeditions.</p>'}
    </div>`;
  }
  return `<div class="gear-panels">${panels}</div>${picker}`;
}

// How the party's power compares with what the area suits, and what that
// does to the time per encounter.
// ---------- party bonuses ----------

const synBadge = (A, id, n = 1, cls = '') => `<span class="syn-badge ${SYNERGIES[id].variant ? `v-${SYNERGIES[id].variant}` : ''} ${id === 'prismatic' ? 'prism' : ''} ${cls}">${icon(A, SYNERGIES[id].icon, 'xs')}${SYNERGIES[id].name}${n > 1 ? ` ×${n}` : ''}</span>`;
const unknownBadge = (A) => `<span class="syn-badge unknown">${icon(A, 'star', 'xs')}???</span>`;
const found = (st, id) => !!st.discovered?.[id];
// A bonus by name once it's been discovered; ??? until then.
const synName = (st, id) => (found(st, id) ? SYNERGIES[id].name : '???');
const chanceText = (st, id) => (SYNERGIES[id].always ? 'Every trip' : `${pct(triggerChance(st))} of trips`);

// The planner's party-bonus box: what this party qualifies for (by name once
// discovered), and hints at what one more bug would unlock.
function synergyPanel(v, syn) {
  const { A, game } = v;
  const st = game.state;
  const active = Object.entries(syn.active);
  const known = SYNERGY_IDS.filter((id) => found(st, id)).length;
  return `<div class="syn-panel">
    <div class="section-title">Party bonuses <small>${active.length} ready</small>${btn(`Found ${known}/${SYNERGY_IDS.length}`, 'syn-guide', {}, 'sm')}</div>
    ${active.length ? active.map(([id, a]) => (found(st, id)
    ? `<div class="syn-row on">${synBadge(A, id, a.n)}<small>${esc(SYNERGIES[id].does)} <b class="chance">${chanceText(st, id)}</b></small></div>`
    : `<div class="syn-row on">${unknownBadge(A)}<small>An undiscovered bonus! Launch with this party to find out what it does.</small></div>`)).join('')
    : '<p class="muted small">No bonuses yet. Mix and match your bugs: the hints below show what one more bug would unlock.</p>'}
    ${syn.hints.length ? `<div class="syn-hints">${syn.hints.slice(0, 4).map((h) => `<span class="syn-hint">${esc(synName(st, h.id))}: needs ${esc(h.text)}</span>`).join('')}</div>` : ''}
  </div>`;
}

// Bonuses a bug would switch on by joining the party (open slots only).
function wouldUnlock(party, bug, syn, opts) {
  if (party.length >= PARTY_SIZE || party.some((b) => b.uid === bug.uid)) return [];
  const next = partySynergies([...party, bug], opts).active;
  return Object.keys(next).filter((id) => !syn.active[id]);
}

// Saved parties, with the discovered bonuses each one brings.
function presetPanel(v, party, opts) {
  const { A, game } = v;
  const st = game.state;
  const cards = st.presets.map((p) => {
    const bugs = p.party.map((u) => game.bug(u));
    const present = bugs.filter(Boolean);
    const q = present.length === PARTY_SIZE ? Object.keys(partySynergies(present, opts).active) : [];
    const known = q.filter((id) => found(st, id));
    const unknown = q.length - known.length;
    return `<div class="preset">
      <button class="preset-load" data-act="preset-load" data-id="${p.id}">
        <b>${esc(p.name)}</b>
        <span class="preset-bugs">${bugs.map((b) => (b ? bugImg(A, b, 'xs') : '<span class="gone">?</span>')).join('')}</span>
        <span class="preset-syn">${known.map((id) => synBadge(A, id)).join('')}${unknown ? `<span class="syn-badge unknown">+${unknown} ???</span>` : ''}${present.length < PARTY_SIZE ? '<small class="muted">A bug from this party was released.</small>' : ''}</span>
      </button>
      <button class="btn sm preset-del" data-act="preset-delete" data-id="${p.id}" title="Delete preset">✕</button>
    </div>`;
  }).join('');
  return `<div class="presets">
    <div class="section-title">Presets <small>${st.presets.length}/${PRESET_LIMIT}</small></div>
    ${cards || '<p class="muted small">Save a party you like to come back to it in one tap.</p>'}
    <div class="row preset-save"><input id="preset-name" maxlength="24" placeholder="Name this party">${btn('Save party', 'preset-save', {}, 'sm', party.length !== PARTY_SIZE || st.presets.length >= PRESET_LIMIT)}</div>
  </div>`;
}

// The bonuses found so far. Undiscovered ones stay a mystery.
export function synergyGuideModal(v) {
  const { A, game } = v;
  const st = game.state;
  const known = SYNERGY_IDS.filter((id) => found(st, id));
  const row = (id) => (found(st, id)
    ? `<div class="syn-row">${synBadge(A, id)}<div class="grow"><b class="need">${esc(SYNERGIES[id].need)}</b><small>${esc(SYNERGIES[id].does)} <b class="chance">${chanceText(st, id)}</b></small></div></div>`
    : `<div class="syn-row">${unknownBadge(A)}<div class="grow"><small class="muted">Not discovered yet.</small></div></div>`);
  return `<h3>Party bonuses</h3>
    <p class="meta">You've found <b>${known.length}</b> of ${SYNERGY_IDS.length}. The right mix of bugs unlocks a bonus: watch the planner's hints, try a party, and launch it to find out what it does.</p>
    <p class="meta">Most bonuses kick in on ${pct(TRIGGER.chance)} of trips (${pct(TRIGGER.jarChance)} with a Jar of Light in your garden). Bonuses from Shiny, Albino and Golden bugs kick in every time.</p>
    ${[...known, ...SYNERGY_IDS.filter((id) => !found(st, id))].map(row).join('')}
    <div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

function paceLine(area, party, encMs, opts, active) {
  if (!party.length) return '';
  const power = Math.round(synergyPower(boostedParty(party, active), active));
  const f = paceFactor(area, party, opts);
  const verdict = f > 1.05 ? `<b class="bad">${f.toFixed(1)}× slower</b>` : f < 0.95 ? `<b class="ok">${(1 / f).toFixed(1)}× faster</b>` : '<b class="ok">right on pace</b>';
  return `<div class="meta pace">Party power <b>${power}</b> / ${area.name} suits <b>${area.pace.power}</b>: encounters ${verdict} · ${fmtDur(encMs)} each</div>`;
}

// Trip length picker: presets by hours, plus fine-tuning by single encounters.
function tripLength(v, area, party, encMs, share = 1) {
  const { game, ui } = v;
  const count = ui.plan.count;
  const ms = count * encMs * share; // skips and instant finishes, on average
  const back = new Date(game.now() + ms);
  const sameDay = back.toDateString() === new Date(game.now()).toDateString();
  const presets = [['Short', defaultEncounterCount(area)], ...EXPEDITION_LENGTH.presetHours.map((h) => [h === 8 ? '8h overnight' : `${h}h`, encountersForHours(game.state, area, party, h)])];
  return `<div class="section-title">Trip length</div>
    <div class="trip">
      <div class="row wrap presets">${presets.map(([label, n]) => btn(label, 'plan-count', { n }, `sm ${n === count ? 'on' : ''}`)).join('')}</div>
      <div class="row stepper">${btn('−', 'plan-count', { n: count - 1 }, 'sm', count <= EXPEDITION_LENGTH.min)}<b>${count} encounters</b>${btn('+', 'plan-count', { n: count + 1 }, 'sm', count >= EXPEDITION_LENGTH.max)}</div>
      <div class="meta">${count} × ${fmtDur(encMs)}${share < 1 ? ', with skips' : ''} = ${share < 1 ? 'about ' : ''}<b>${fmtDur(ms)}</b> · back ${sameDay ? '' : 'tomorrow '}${share < 1 ? 'around' : 'at'} <b>${back.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b></div>
    </div>`;
}

function encounterLine(v, exp, e, i, ends = encounterEnds(exp)) {
  const { A } = v;
  const at = ends[i];
  const r = { coins: e.coins, items: e.items, eggs: e.eggs };
  const check = e.chance !== undefined ? `<span class="check">${traitIcon(A, e.trait)} ${TRAITS[e.trait].name} ${e.score} vs ${e.difficulty} · ${pct(e.chance)}</span>` : '';
  return `<div class="log-line o-${e.outcome} ${e.chest ? 'chest-line' : ''}">
    <span class="ts">${fmtClock(at)}</span>
    <div class="grow"><p>${esc(e.intro)}</p><p class="res">${e.chest ? icon(A, 'chest_open', 'xs') : ''}${esc(e.text)}</p>${check}${(e.notes || []).map((n) => `<p class="syn-note">${icon(A, SYNERGIES[n.id]?.icon || 'star', 'xs')} ${esc(n.text)}</p>`).join('')}${rewardInline(A, r)}</div>
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
  const ends = encounterEnds(exp);
  const synergies = (exp.synergies || []).filter((id) => SYNERGIES[id]);
  const missed = (exp.qualified || []).filter((id) => SYNERGIES[id] && !synergies.includes(id));
  return `<div class="area-banner px-bg small" style="${areaBackground(area, A)}"><span>${area.name}</span>
      <div class="march" style="--p:${tl.fraction}">${party.map((b) => bugImg(A, b, 'sm walk')).join('')}</div></div>
    <div class="party-line">${party.map((b) => `<span>${bugImg(A, b, 'xs')}${esc(b.gone || bugName(b))}</span>`).join('')}</div>
    ${synergies.length || missed.length ? `<div class="syn-badges">${synergies.map((id) => synBadge(A, id)).join('')}${missed.map((id) => synBadge(A, id, 1, 'missed')).join('')}</div>` : ''}
    ${missed.length ? `<p class="meta muted">${missed.map((id) => SYNERGIES[id].name).join(', ')} didn't kick in this trip.</p>` : ''}
    ${fromHistory ? '' : `${bar(tl.fraction, 'exp', exp.startAt, exp.endsAt)}
    <div class="timing"><span>Encounter <b>${tl.done ? exp.count : tl.resolved + 1}</b> of ${exp.count}</span><span>Elapsed ${tl.done ? fmtTime(exp.endsAt - exp.startAt) : since(game, exp.startAt)}</span><span>Remaining ${tl.done ? '0s' : countdown(game, exp.endsAt)}</span></div>`}
    ${cur ? `<div class="current"><b>Now:</b> ${esc(cur.intro)}<small>Resolves in ${countdown(game, tl.currentEndsAt)}</small></div>` : ''}
    <div class="section-title">Found so far</div>${rewardInline(A, soFar) || '<p class="muted">Nothing yet.</p>'}
    <div class="section-title">Expedition log</div>
    <div class="log">
      <div class="log-line"><span class="ts">${fmtClock(0)}</span><div class="grow"><p>Your party entered ${area.name}.</p>
        ${(exp.discovered || []).filter((id) => SYNERGIES[id]).map((id) => `<p class="syn-note discovery">${synBadge(A, id)} <b>New bonus discovered!</b> ${esc(SYNERGIES[id].need)}: ${esc(SYNERGIES[id].does)}</p>`).join('')}</div></div>
      ${shown.map((e, i) => encounterLine(v, exp, e, i, ends)).join('')}
      ${tl.done ? `<div class="log-line o-great"><span class="ts">${fmtClock(exp.endsAt - exp.startAt)}</span><div class="grow"><p><b>Expedition complete!</b> ${fromHistory ? 'Rewards claimed.' : 'Rewards are ready to claim.'}</p></div></div>`
        : `<div class="log-line future"><span class="ts">${fmtClock(ends[tl.resolved] ?? exp.endsAt - exp.startAt)}</span><div class="grow"><p>${tl.resolved + 1 < exp.count ? 'Next encounter: ???' : 'The party heads home.'}</p></div></div>`}
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
      ${Object.entries(ITEMS).filter(([, it]) => it.buy).map(([id, it]) => {
        const stock = itemStock(st, id);
        return `<div class="list-row ${stock.ok ? '' : 'locked'}">${icon(A, id)}<div class="grow"><b>${it.name}</b> ${itemTierTag(it)}${st.inventory[id] ? ` <small class="inline">(own ${st.inventory[id]})</small>` : ''}<small>${itemEffectsText(id)}</small><small>${stock.ok ? esc(it.desc) : `${icon(A, 'lock', 'xs')} ${esc(stock.reason)}`}</small></div>${btn(coins(A, it.buy), 'buy-item', { item: id }, 'go sm', !stock.ok || st.coins < it.buy)}</div>`;
      }).join('')}`;
  }
  const ids = Object.keys(st.inventory).filter((id) => ITEMS[id]);
  const equipped = st.bugs.filter((b) => b.item);
  const sections = Object.entries(ITEM_TYPES).map(([type, title]) => {
    const list = ids.filter((id) => ITEMS[id].type === type);
    if (!list.length) return '';
    return `<div class="section-title">${title}</div>${list.map((id) => {
      const n = st.inventory[id];
      const price = sellPrice(id);
      return `<div class="list-row">${icon(A, id)}<div class="grow"><b>${ITEMS[id].name}</b> x${n} ${type === 'gear' ? itemTierTag(ITEMS[id]) : ''}<small>${type === 'gear' ? itemEffectsText(id) : esc(ITEMS[id].desc)}</small></div>
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

// ---------- Garden chests ----------

export function gardenChestsModal(v) {
  const { game, A, ui } = v;
  const st = game.state;
  const keys = st.inventory.key || 0;
  const onBugs = st.bugs.filter((b) => b.item === 'key').length;
  const r = ui.chestResult;
  const result = r ? `<div class="chest-reveal">
      <div class="chest-anim">${icon(A, 'chest', 'big closed')}${icon(A, 'chest_open', 'big open')}</div>
      <div><b>${esc(r.chest.name)} opened!</b><small>Stocked from ${esc(r.area.name)} · ${r.chest.keys} key${r.chest.keys > 1 ? 's' : ''} spent</small>${rewardInline(A, { coins: r.coins, items: r.items, eggs: r.eggs.map((e) => e.tier) })}</div>
    </div>` : '';
  return `<div class="modal-head">${icon(A, 'chest', 'big')}<div><h3>Garden chests</h3><small>Spend Chest Keys on a chest right here. Chests found on expeditions are still the better deal.</small></div></div>
    <p class="key-balance">${icon(A, 'key', 'sm')} <b>${keys}</b> Chest Key${keys === 1 ? '' : 's'} in your bag${onBugs ? ` <small class="inline">(${onBugs} more equipped on bugs)</small>` : ''}</p>
    ${result}
    ${GARDEN_CHESTS.map((c) => {
      const area = gardenChestArea(st, c);
      const short = keys < c.keys;
      return `<div class="list-row garden-chest">${icon(A, 'chest', 'sm')}<div class="grow"><b>${c.name}</b> <small class="inline">${icon(A, 'key', 'xs')} x${c.keys}</small>
          <small>${esc(c.desc)}</small><small>Stocked from <b>${esc(area.name)}</b>: about ${fmtNum(Math.round(area.coinBase * area.chest.coins * c.coinFactor))} coins, ${c.rolls[0] === c.rolls[1] ? c.rolls[0] : `${c.rolls[0]}-${c.rolls[1]}`} item${c.rolls[1] > 1 ? 's' : ''}, sometimes an egg</small></div>
        ${btn(short ? `Need ${c.keys}` : `Open (${c.keys} ${icon(A, 'key', 'xs')})`, 'open-chest', { id: c.id }, 'go sm', short || ui.chestBusy)}</div>`;
    }).join('')}
    <div class="row sticky-foot">${btn('Close', 'close-modal')}</div>`;
}

// ---------- Upgrades ----------

export function renderUpgrades(v) {
  const { game, A } = v;
  const st = game.state;
  const decor = DECOR.map((d) => {
    const owned = ownsDecor(st, d.id);
    const lovers = st.bugs.filter((b) => b.inGarden && favouriteDecor(st, b.species)?.id === d.id).length;
    const art = d.sprite ? `<img class="px decor-art" src="${d.sprite}" alt="">` : icon(A, 'rock', 'decor-art');
    return `<div class="upgrade decor ${owned ? 'maxed' : ''}">
      ${art}<div class="grow"><b>${d.name}</b><small>${esc(d.desc)}</small>
        <small>Bugs that love it forage <b>+${Math.round(d.bonus * 100)}%</b>${owned ? ` · ${lovers} in your garden` : ''}</small></div>
      ${owned ? '<span class="ok">Owned</span>' : btn(coins(A, d.price), 'buy-decor', { id: d.id }, 'go sm', st.coins < d.price)}
    </div>`;
  }).join('');
  return `<div class="section-title">Garden decorations <small>tap one in the garden to see who loves it; drag to move</small></div>${decor}
    <div class="section-title">Upgrades</div>
    <p class="muted">Permanent, global improvements. They apply to eggs and expeditions started after you buy them.</p>
    ${UPGRADES.map((u) => {
      const lvl = st.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id, lvl);
      const maxed = lvl >= u.max;
      return `<div class="upgrade ${maxed ? 'maxed' : ''}">
        <div class="grow"><b>${u.name}</b> <small class="inline">Lv ${lvl}/${u.max}</small><small>${u.desc}</small>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          <small>Now: ${lvl || u.showZero ? u.text(lvl) : 'no bonus yet'}${maxed ? '' : `<br>Next: <b>${u.text(lvl + 1)}</b>`}</small></div>
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
      <tr><td>Chests opened</td><td>${s.chestsOpened}</td></tr><tr><td>Visitors greeted</td><td>${s.visitorsGreeted || 0}</td></tr><tr><td>Coins earned</td><td>${fmtNum(s.coinsEarned)}</td></tr>
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
      <li>${icon(A, 'flower', 'sm')} <b>Garden:</b> up to ${GARDEN_LIMIT} bugs live here (more with Bigger Garden upgrades). Tap one to meet it, and tap coins they dig up. It follows your device's clock: after dark most bugs nap, while fireflies and moths come out.</li>
      <li>${eggImg(A, 'common', 'sm')} <b>Hatchery:</b> buy eggs and settle them into the nests at the bottom of the garden. After 4 hours, tap to crack them open. Higher tiers improve the odds but guarantee nothing, and any bug might hatch Shiny, Albino or Golden.</li>
      <li>${icon(A, 'rock', 'sm')} <b>The rock:</b> drag it around the garden. Shy bugs like to hide underneath, so lift it to say hi. Leave it a few hours and something might turn up under it.</li>
      <li>${icon(A, 'heart', 'sm')} <b>Visitors:</b> wild bugs drop by when the garden has room, like while your party is away. Tap one to say hi and it leaves a little gift, sometimes even an egg.</li>
      <li>${icon(A, 'map', 'sm')} <b>Explore:</b> send exactly 4 bugs out. Each encounter tests their traits: ${TRAIT_IDS.map((t) => `${traitIcon(A, t)}${TRAITS[t].name}`).join(' ')}. Rarer bugs have stronger traits, and a stronger party gets through each area faster. The right mix of bugs unlocks secret party bonuses: follow the planner's hints to discover them. Shiny, Albino and Golden bugs bring bonuses of their own.</li>
      <li>${icon(A, 'key', 'sm')} <b>Keys:</b> equip a Chest Key on a party member to open locked chests.</li>
      <li>${icon(A, 'hammer', 'sm')} <b>Upgrades:</b> permanent boosts bought with coins.</li>
    </ol>
    <p class="muted">Timers keep running while the game is closed.</p></div>
    <div class="row sticky-foot">${btn("Let's go!", 'welcome-done', {}, 'go big')}</div>`;
}

export function rebalancedModal() {
  return `<h3>Bugs got a shake-up!</h3>
    <ul><li><b>Rarity is strength now.</b> Levels and XP are gone: every bug's traits were reset to match its rarity, so rarer bugs are much stronger.</li>
    <li><b>Party power sets the pace.</b> Each area suits a certain party power. Weaker parties can still go anywhere, but their encounters take longer, especially in the harder areas.</li>
    <li><b>Eggs:</b> cheap eggs hatch faster, and better eggs appear in the shop as you explore new areas.</li></ul>
    <div class="row sticky-foot">${btn('Got it', 'close-modal', {}, 'go big')}</div>`;
}

export function migratedModal(v, refund) {
  return `<h3>Bug Garden has grown!</h3>
    <p>Your garden was updated to the new version. All your bugs, eggs and gear came with you:</p>
    <ul><li>Bugs now have the six expedition traits (Lift, Cut, Fight, Fly, Dig, Build), with levels set by their rarity.</li>
    <li>Old eggs became the new egg tiers. Eggs already incubating keep their original timers.</li>
    <li>Old upgrades, items that no longer exist and unfinished expeditions were refunded: <b>${fmtNum(refund)} coins</b>.</li></ul>
    <div class="row sticky-foot">${btn('Show me', 'close-modal', {}, 'go big')}</div>`;
}
