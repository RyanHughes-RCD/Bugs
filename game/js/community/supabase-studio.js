import { Studio, cleanRows, cleanSubmission } from './studio.js';

// The Sprite Studio on Supabase (see supabase/schema.sql), so it works in any
// copy of the game: the home-screen app, a browser, or claude.ai. Players
// sign in with a 6-digit code emailed to them; the database's row-level
// security decides who may do what, the game only reflects it.
//
// It keeps the same local state as the claude.ai Studio (subs, likes,
// decisions, live, names), so the screens work with either one. A
// submission's ref (and key) is its row id.

const TABLES = ['submissions', 'likes', 'decisions', 'live_sprites', 'live_bugs', 'profiles', 'studio_owners'];
const TIMEOUT_MS = 8000;

// The bundled client (game/vendor/supabase.js) defines window.supabase.
function loadClient() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'game/vendor/supabase.js';
    s.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Supabase client missing')));
    s.onerror = () => reject(new Error('Could not load the Supabase client'));
    document.head.appendChild(s);
  });
}

const withTimeout = (p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('The Studio server did not answer')), TIMEOUT_MS))]);
const when = (iso) => Date.parse(iso) || 0;

export class SupabaseStudio extends Studio {
  constructor(config, palette, lib = null) {
    super(null, palette);
    this.config = config;
    this.lib = lib; // a stand-in client library for tests
    this.backend = 'supabase';
    this.needsSignIn = true; // until a session is found
    this.email = null;
    this.owners = new Set();
  }

  async connect() {
    const lib = this.lib || (await loadClient());
    this.sb = lib.createClient(this.config.url, this.config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    // One read of everything; if the server can't be reached, this throws
    // and the game falls back to the claude.ai Studio (or none).
    await withTimeout(Promise.all(TABLES.map((t) => this.refresh(t, true))));
    const { data } = await this.sb.auth.getSession();
    this.setSession(data?.session);
    this.sb.auth.onAuthStateChange((_event, session) => this.setSession(session));
    // Live updates: any change to a table re-reads it.
    const channel = this.sb.channel('studio');
    for (const table of TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.refresh(table));
    channel.subscribe();
    this.available = true;
    this.emit('ready');
    return true;
  }

  setSession(session) {
    const user = session?.user || null;
    this.me = user?.id || null;
    this.email = user?.email || null;
    this.needsSignIn = !this.me;
    this.isOwner = !!this.me && this.owners.has(this.me);
    this.emit('auth');
  }

  get myName() {
    return (this.me && this.names[this.me]) || '';
  }

  // Re-reads one table into the local state. `strict` throws on errors (for
  // the first load); otherwise a failed refresh keeps what was there.
  async refresh(table, strict = false) {
    const { data, error } = await this.sb.from(table).select('*');
    if (error) {
      if (strict) throw error;
      return;
    }
    const rows = data || [];
    if (table === 'submissions') {
      this.subs = new Map();
      for (const r of rows) {
        const s = cleanSubmission({ ...r.data, createdAt: when(r.created_at), updatedAt: when(r.updated_at) }, this.palette);
        if (s) this.subs.set(r.id, { ...s, ref: r.id, key: r.id, author: r.author });
      }
      this.emit('subs');
    } else if (table === 'likes') {
      this.likes = new Map();
      for (const r of rows) {
        if (!this.likes.has(r.submission_id)) this.likes.set(r.submission_id, new Set());
        this.likes.get(r.submission_id).add(r.user_id);
      }
      this.emit('votes');
    } else if (table === 'decisions') {
      this.readReviews({ exists: true, data: () => ({ decisions: Object.fromEntries(rows.map((r) => [r.submission_id, { ...r, at: when(r.decided_at) }])) }) });
    } else if (table === 'live_sprites' || table === 'live_bugs') {
      this[`raw_${table}`] = rows;
      const sprites = Object.fromEntries((this.raw_live_sprites || []).map((r) => [r.species, { rows: r.rows, ref: r.ref, at: when(r.updated_at) }]));
      const bugs = Object.fromEntries((this.raw_live_bugs || []).map((r) => [r.ref, { ...r.data, author: r.author, at: when(r.approved_at) }]));
      this.readLive({ exists: true, data: () => ({ sprites, bugs }) });
    } else if (table === 'profiles') {
      this.names = Object.fromEntries(rows.map((r) => [r.user_id, String(r.name || '').slice(0, 24)]));
      this.emit('names');
    } else if (table === 'studio_owners') {
      this.owners = new Set(rows.map((r) => r.user_id));
      this.isOwner = !!this.me && this.owners.has(this.me);
      this.emit('auth');
    }
  }

  resolveNames() {} // names come from the profiles table

  nameOf(person) {
    if (person && person === this.me) return 'You';
    return this.names[person] || 'Someone';
  }

  // Runs a write, turns database errors into something a player can read,
  // and re-reads the tables it touched.
  async run(tables, fn) {
    if (!this.available) return { ok: false, error: 'The Studio is not connected.' };
    if (!this.me) return { ok: false, error: 'Sign in at the top of the Studio first.' };
    try {
      const out = await fn();
      if (out?.error) throw out.error;
      await Promise.all(tables.map((t) => this.refresh(t)));
      return { ok: true, data: out?.data };
    } catch (e) {
      const msg = e?.message || '';
      if (/60 submissions/.test(msg)) return { ok: false, error: msg };
      if (e?.code === '42501' || /row-level security|permission/i.test(msg)) return { ok: false, error: "You're not allowed to do that." };
      return { ok: false, error: 'Could not save to the Studio. Check your connection and try again.' };
    }
  }

  // ---------- signing in ----------

  async sendCode(email) {
    const clean = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: 'That doesn\'t look like an email address.' };
    const { error } = await this.sb.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
    if (error) return { ok: false, error: /rate limit/i.test(error.message) ? 'Too many codes sent. Wait a few minutes and try again.' : error.message };
    return { ok: true, email: clean };
  }

  async verifyCode(email, code) {
    const token = String(code || '').replace(/\D/g, '');
    if (token.length < 6) return { ok: false, error: 'Enter the 6-digit code from the email.' };
    const { data, error } = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { ok: false, error: 'That code didn\'t work. Check it, or send a new one.' };
    this.setSession(data?.session);
    return { ok: true };
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.setSession(null);
    return { ok: true };
  }

  async setName(name) {
    const clean = String(name || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 24);
    if (!clean) return { ok: false, error: 'Pick a name first.' };
    return this.run(['profiles'], () => this.sb.from('profiles').upsert({ user_id: this.me, name: clean }));
  }

  // ---------- submissions ----------

  async submit(raw, key = null) {
    const existing = key && this.subs.get(key);
    if (key && (!existing || existing.author !== this.me || this.status(key) !== 'pending')) return { ok: false, error: 'That submission can no longer be changed.' };
    const item = cleanSubmission({ ...raw, createdAt: 0, updatedAt: 0 }, this.palette);
    if (!item) return { ok: false, error: raw.kind === 'idea' && !String(raw.name || '').trim() ? 'Give your bug a name.' : 'Draw something first.' };
    const { createdAt, updatedAt, ...data } = item;
    const res = await this.run(['submissions'], () => (key
      ? this.sb.from('submissions').update({ data, updated_at: new Date().toISOString() }).eq('id', key)
      : this.sb.from('submissions').insert({ data }).select('id').single()));
    return res.ok ? { ok: true, ref: key || res.data?.id } : res;
  }

  withdraw(key) {
    return this.run(['submissions', 'likes'], () => this.sb.from('submissions').delete().eq('id', key));
  }

  toggleLike(ref) {
    return this.run(['likes'], () => (this.likedByMe(ref)
      ? this.sb.from('likes').delete().eq('user_id', this.me).eq('submission_id', ref)
      : this.sb.from('likes').insert({ user_id: this.me, submission_id: ref })));
  }

  // ---------- the owner's controls ----------

  async decide(ref, status, note = '') {
    if (!this.isOwner) return { ok: false, error: 'Only the owner can approve submissions.' };
    const s = this.subs.get(ref);
    if (!s) return { ok: false, error: 'That submission is gone.' };
    const res = await this.run(['decisions'], () => this.sb.from('decisions').upsert({
      submission_id: ref, status, note: String(note || '').slice(0, 160), species: s.species || null,
      rows: status === 'approved' && s.kind === 'fix' ? s.rows : null, decided_at: new Date().toISOString(),
    }));
    if (!res.ok || status !== 'approved') return res;
    if (s.kind === 'fix') {
      return this.run(['live_sprites'], () => this.sb.from('live_sprites').upsert({ species: s.species, rows: s.rows, ref, updated_at: new Date().toISOString() }));
    }
    const { key, ref: _r, author, createdAt, updatedAt, ...idea } = s;
    return this.run(['live_bugs'], () => this.sb.from('live_bugs').upsert({ ref, author, data: idea, approved_at: new Date().toISOString() }));
  }

  async setLiveSprite(species, ref = null) {
    if (!this.isOwner) return { ok: false, error: 'Only the owner can change live sprites.' };
    if (!ref) return this.run(['live_sprites'], () => this.sb.from('live_sprites').delete().eq('species', species));
    const rows = this.decisions[ref]?.rows;
    if (!cleanRows(rows, this.palette)) return { ok: false, error: 'That fix is no longer available.' };
    return this.run(['live_sprites'], () => this.sb.from('live_sprites').upsert({ species, rows, ref, updated_at: new Date().toISOString() }));
  }
}
