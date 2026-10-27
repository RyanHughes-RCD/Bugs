import { SPECIES, FAMILIES } from '../data/species.js';
import { RARITY_ORDER } from '../data/rarities.js';
import { TRAIT_IDS } from '../data/traits.js';
import { AREA_BY_ID } from '../data/areas.js';

// The Sprite Studio: players draw fixes for wonky bug sprites and invent new
// bugs, the owner approves them, and approved fixes replace the sprite for
// everyone. It lives in the published game's shared database (the `db`
// capability), so it only lights up there.
//
// Where everything is kept:
//   subs/<person>    { items: { <key>: submission } }  each person writes only their own
//   votes/<person>   { likes: { <ref>: true } }         each person writes only their own
//   studio/reviews   { decisions: { <ref>: decision } }  owner only
//   studio/live      { sprites: { <species>: fix }, bugs: { <ref>: idea } }  owner only
// A submission's ref is "<person>~<key>". Everything read back from the
// database was written by someone else, so it is cleaned before use.

// The access rules the published page declares for its database.
export const STUDIO_DB_RULES = [
  { path: '', read: 'view', write: 'owner' },
  { path: 'subs', read: 'view', write: 'owner' },
  { path: 'subs/{self}', write: 'interact' },
  { path: 'votes', read: 'view', write: 'owner' },
  { path: 'votes/{self}', write: 'interact' },
];

export const LIMITS = { name: 28, desc: 160, note: 160, perPerson: 60, traits: 4 };
export const SIZES = [16, 32];

const clip = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

// A sprite is rows of palette characters ('.' is transparent), 16x16 or
// 32x32. Anything else is rejected rather than repaired.
export function cleanRows(rows, palette) {
  if (!Array.isArray(rows) || !SIZES.includes(rows.length)) return null;
  const n = rows.length;
  const ok = (ch) => ch === '.' || Object.prototype.hasOwnProperty.call(palette, ch);
  for (const r of rows) if (typeof r !== 'string' || r.length !== n || ![...r].every(ok)) return null;
  if (rows.every((r) => /^\.+$/.test(r))) return null; // nothing drawn
  return rows.slice();
}

export function cleanSubmission(raw, palette) {
  if (!raw || typeof raw !== 'object') return null;
  const rows = cleanRows(raw.rows, palette);
  if (!rows) return null;
  const base = {
    rows,
    note: clip(raw.note, LIMITS.note),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
  };
  if (raw.kind === 'fix') {
    if (!SPECIES[raw.species]) return null;
    return { ...base, kind: 'fix', species: raw.species, base: clip(raw.base, 120) || 'original' };
  }
  if (raw.kind !== 'idea') return null;
  const name = clip(raw.name, LIMITS.name);
  if (!name) return null;
  const traits = [...new Set(Array.isArray(raw.traits) ? raw.traits : [])].filter((t) => TRAIT_IDS.includes(t)).slice(0, LIMITS.traits);
  return {
    ...base,
    kind: 'idea',
    name,
    desc: clip(raw.desc, LIMITS.desc),
    family: FAMILIES[raw.family] ? raw.family : 'crawler',
    view: raw.view === 'side' ? 'side' : 'top',
    rarity: RARITY_ORDER.includes(raw.rarity) ? raw.rarity : 'common',
    traits: traits.length ? traits : ['dig'],
    habitat: AREA_BY_ID[raw.habitat] ? raw.habitat : null,
    from: SPECIES[raw.from] ? raw.from : null,
  };
}

export const refOf = (person, key) => `${person}~${key}`;
const newKey = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export class Studio {
  constructor(claude, palette) {
    this.claude = claude;
    this.palette = palette;
    this.available = false; // the shared database answered
    this.me = null; // this viewer's id
    this.isOwner = false;
    this.subs = new Map(); // ref -> { ref, author, key, ...submission }
    this.subDocs = new Map(); // person -> their stored document
    this.voteDocs = new Map();
    this.likes = new Map(); // ref -> Set of people
    this.decisions = {};
    this.live = { sprites: {}, bugs: {} };
    this.names = {};
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what) { for (const fn of this.listeners) fn(what); }

  async connect() {
    if (!this.claude?.use) return false;
    const [db, user] = await Promise.all([this.claude.use('db'), this.claude.use('user')]);
    if (!db) return false;
    this.db = db;
    this.user = user;
    this.me = (await user?.id()) ?? null;
    this.isOwner = (await user?.isOwner()) ?? false;
    this.available = true;
    db.collection('subs').onSnapshot((snap) => this.readSubs(snap), () => {});
    db.collection('votes').onSnapshot((snap) => this.readVotes(snap), () => {});
    db.doc('studio/reviews').onSnapshot((snap) => this.readReviews(snap), () => {});
    db.doc('studio/live').onSnapshot((snap) => this.readLive(snap), () => {});
    this.emit('ready');
    return true;
  }

  readSubs(snap) {
    this.subs = new Map();
    this.subDocs = new Map(snap.docs.map((d) => [d.id, d.data()]));
    for (const doc of snap.docs) {
      const items = doc.data()?.items;
      if (!items || typeof items !== 'object') continue;
      for (const [key, raw] of Object.entries(items)) {
        const s = cleanSubmission(raw, this.palette);
        if (s) this.subs.set(refOf(doc.id, key), { ...s, ref: refOf(doc.id, key), author: doc.id, key });
      }
    }
    this.resolveNames();
    this.emit('subs');
  }

  readVotes(snap) {
    this.likes = new Map();
    this.voteDocs = new Map(snap.docs.map((d) => [d.id, d.data()]));
    for (const doc of snap.docs) {
      const likes = doc.data()?.likes;
      if (!likes || typeof likes !== 'object') continue;
      for (const [ref, on] of Object.entries(likes)) {
        if (on !== true) continue;
        if (!this.likes.has(ref)) this.likes.set(ref, new Set());
        this.likes.get(ref).add(doc.id);
      }
    }
    this.emit('votes');
  }

  readReviews(snap) {
    const raw = (snap.exists && snap.data()?.decisions) || {};
    const out = {};
    for (const [ref, d] of Object.entries(raw)) {
      if (!d || !['approved', 'rejected'].includes(d.status)) continue;
      out[ref] = { status: d.status, at: Number(d.at) || 0, note: clip(d.note, LIMITS.note), species: SPECIES[d.species] ? d.species : null, rows: cleanRows(d.rows, this.palette) };
    }
    this.decisions = out;
    this.emit('reviews');
  }

  readLive(snap) {
    const raw = (snap.exists && snap.data()) || {};
    const sprites = {};
    for (const [id, fix] of Object.entries(raw.sprites || {})) {
      const rows = SPECIES[id] && cleanRows(fix?.rows, this.palette);
      if (rows) sprites[id] = { rows, ref: clip(fix.ref, 120), at: Number(fix.at) || 0 };
    }
    const bugs = {};
    for (const [ref, idea] of Object.entries(raw.bugs || {})) {
      const s = cleanSubmission({ ...idea, kind: 'idea' }, this.palette);
      if (s) bugs[ref] = { ...s, ref, author: clip(idea.author, 120), at: Number(idea.at) || 0 };
    }
    this.live = { sprites, bugs };
    this.emit('live');
  }

  async resolveNames() {
    if (!this.user?.profiles) return;
    const ids = [...new Set([...this.subs.values()].map((s) => s.author).concat(Object.values(this.live.bugs).map((b) => b.author)))].filter(Boolean);
    if (!ids.length) return;
    const ps = await this.user.profiles(ids);
    let changed = false;
    for (const id of ids) {
      const name = ps[id]?.name || '';
      if (this.names[id] !== name) { this.names[id] = name; changed = true; }
    }
    if (changed) this.emit('names');
  }

  nameOf(person) {
    if (person && person === this.me) return 'You';
    return this.names[person] || 'Someone';
  }

  status(ref) {
    return this.decisions[ref]?.status || 'pending';
  }

  likeCount(ref) { return this.likes.get(ref)?.size || 0; }
  likedByMe(ref) { return !!this.me && !!this.likes.get(ref)?.has(this.me); }

  // Submissions, newest first, optionally filtered.
  list({ kind = null, status = null, mine = false, species = null } = {}) {
    return [...this.subs.values()]
      .filter((s) => (!kind || s.kind === kind) && (!status || this.status(s.ref) === status) && (!mine || s.author === this.me) && (!species || s.species === species))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // What a fix starts from: the live approved fix for that bug, or the original.
  liveRef(species) {
    return this.live.sprites[species]?.ref || 'original';
  }

  mine() {
    return [...this.subs.values()].filter((s) => s.author === this.me);
  }

  // ---------- writes ----------

  // Writes a whole document, then applies it locally straight away so a
  // second action right after the first builds on it (the database's echo
  // arrives a moment later and agrees).
  async put(path, data) {
    return this.write(async () => {
      await this.db.doc(path).set(data);
      const snap = { id: path.split('/').pop(), exists: true, data: () => data };
      if (path === 'studio/reviews') this.readReviews(snap);
      else if (path === 'studio/live') this.readLive(snap);
      else {
        const [top] = path.split('/');
        const others = top === 'subs' ? this.subDocs : this.voteDocs;
        others.set(snap.id, data);
        const docs = [...others].map(([id, d]) => ({ id, data: () => d }));
        if (top === 'subs') this.readSubs({ docs });
        else this.readVotes({ docs });
      }
    });
  }

  async write(fn) {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      const code = e?.code;
      if (code === 'invalid_argument' || code === 'not_granted') return { ok: false, error: "You can't save to the studio. Ask the game's owner to share it with you as a Contributor." };
      if (code === 'quota_exceeded') return { ok: false, error: 'The studio is full. Ask the owner to clear out old submissions.' };
      return { ok: false, error: 'Could not save to the studio. Check your connection and try again.' };
    }
  }

  // Saves a new submission, or replaces one of your own pending ones (key).
  async submit(raw, key = null) {
    if (!this.available || !this.me) return { ok: false, error: 'The studio only works in the shared game on claude.ai.' };
    const now = Date.now();
    const existing = key && this.subs.get(refOf(this.me, key));
    if (key && (!existing || this.status(existing.ref) !== 'pending')) return { ok: false, error: 'That submission can no longer be changed.' };
    const item = cleanSubmission({ ...raw, createdAt: existing?.createdAt || now, updatedAt: now }, this.palette);
    if (!item) return { ok: false, error: raw.kind === 'idea' && !clip(raw.name, LIMITS.name) ? 'Give your bug a name.' : 'Draw something first.' };
    if (!key && this.mine().length >= LIMITS.perPerson) return { ok: false, error: `You have ${LIMITS.perPerson} submissions already. Withdraw an old one first.` };
    const k = key || newKey();
    const items = this.ownItems();
    items[k] = item;
    const res = await this.put(`subs/${this.me}`, { items });
    return res.ok ? { ok: true, ref: refOf(this.me, k) } : res;
  }

  // Your own items as stored (for rewriting your document).
  ownItems() {
    const out = {};
    for (const s of this.mine()) {
      const { ref, author, key, ...item } = s;
      out[key] = item;
    }
    return out;
  }

  async withdraw(key) {
    const items = this.ownItems();
    if (!items[key]) return { ok: false, error: 'Nothing to withdraw.' };
    delete items[key];
    return this.put(`subs/${this.me}`, { items });
  }

  async toggleLike(ref) {
    if (!this.available || !this.me) return { ok: false, error: 'The studio only works in the shared game on claude.ai.' };
    const likes = {};
    for (const [r, people] of this.likes) if (people.has(this.me)) likes[r] = true;
    if (likes[ref]) delete likes[ref];
    else likes[ref] = true;
    return this.put(`votes/${this.me}`, { likes });
  }

  // ---------- the owner's controls ----------

  async decide(ref, status, note = '') {
    if (!this.isOwner) return { ok: false, error: 'Only the owner can approve submissions.' };
    const s = this.subs.get(ref);
    if (!s) return { ok: false, error: 'That submission is gone.' };
    const decisions = { ...this.decisions };
    decisions[ref] = { status, at: Date.now(), note: clip(note, LIMITS.note), species: s.species || null, rows: status === 'approved' && s.kind === 'fix' ? s.rows : null };
    const res = await this.put('studio/reviews', { decisions });
    if (!res.ok || status !== 'approved') return res;
    const live = { sprites: { ...this.live.sprites }, bugs: { ...this.live.bugs } };
    if (s.kind === 'fix') live.sprites[s.species] = { rows: s.rows, ref, at: Date.now() };
    else {
      const { key, ...idea } = s;
      live.bugs[ref] = { ...idea, at: Date.now() };
    }
    return this.put('studio/live', live);
  }

  approve(ref) { return this.decide(ref, 'approved'); }
  reject(ref, note) { return this.decide(ref, 'rejected', note); }

  // Puts a bug back to its original sprite, or to an earlier approved fix.
  async setLiveSprite(species, ref = null) {
    if (!this.isOwner) return { ok: false, error: 'Only the owner can change live sprites.' };
    const sprites = { ...this.live.sprites };
    if (!ref) delete sprites[species];
    else {
      const rows = this.decisions[ref]?.rows;
      if (!rows) return { ok: false, error: 'That fix is no longer available.' };
      sprites[species] = { rows, ref, at: Date.now() };
    }
    return this.put('studio/live', { ...this.live, sprites });
  }

  // Approved fixes for one bug, newest first (for going back to an earlier one).
  history(species) {
    return Object.entries(this.decisions)
      .filter(([, d]) => d.status === 'approved' && d.species === species && d.rows)
      .map(([ref, d]) => ({ ref, ...d }))
      .sort((a, b) => b.at - a.at);
  }
}
