// A stand-in for the Supabase client library, for tests: in-memory tables
// with the same rules as supabase/schema.sql (everyone reads; people write
// only their own submissions, likes and name; only owners decide), email
// codes (always 123456), and live updates between clients sharing a store.
// Kept free of imports so the e2e test can inject it into the browser.
export function makeFakeSupabaseStore({ owners = [] } = {}) {
  return {
    tables: { submissions: [], likes: [], decisions: [], live_sprites: [], live_bugs: [], profiles: [], studio_owners: [] },
    users: {}, // email -> id
    ownerEmails: owners,
    listeners: new Set(),
    sent: [], // emails a code was sent to
    nextId: 1,
  };
}

export function makeFakeSupabaseLib(store = makeFakeSupabaseStore()) {
  const KEYS = { profiles: ['user_id'], decisions: ['submission_id'], live_sprites: ['species'], live_bugs: ['ref'], likes: ['user_id', 'submission_id'], submissions: ['id'], studio_owners: ['user_id'] };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const later = (fn) => setTimeout(fn, 0);
  return {
    createClient() {
      let session = null;
      const authListeners = new Set();
      const me = () => session?.user?.id || null;
      const isOwner = () => store.tables.studio_owners.some((r) => r.user_id === me());
      const denied = { code: '42501', message: 'new row violates row-level security policy' };
      const allowed = (table, row, op) => {
        if (!me()) return false;
        if (table === 'submissions') {
          if (op === 'delete') return row.author === me() || isOwner();
          if (row.author !== me()) return false;
          if (op === 'update') return !store.tables.decisions.some((d) => d.submission_id === row.id);
          return true;
        }
        if (table === 'likes' || table === 'profiles') return row.user_id === me();
        if (['decisions', 'live_sprites', 'live_bugs'].includes(table)) return isOwner();
        return false;
      };
      const notify = (table) => { for (const l of store.listeners) later(() => l(table)); };
      const query = (table) => {
        const q = { op: 'select', filters: [], returning: false, single: false };
        const matches = (r) => q.filters.every(([c, v]) => r[c] === v);
        const run = () => {
          const rows = store.tables[table];
          if (q.op === 'select') return { data: clone(rows.filter(matches)), error: null };
          if (q.op === 'insert' || q.op === 'upsert') {
            const row = { ...q.payload };
            if (table === 'submissions') {
              row.id = row.id || `sub-${store.nextId++}`;
              row.author = row.author || me();
              row.created_at = row.updated_at = new Date().toISOString();
              if (rows.filter((r) => r.author === row.author).length >= 60) return { data: null, error: { message: 'You have 60 submissions already. Withdraw an old one first.' } };
            }
            if (!allowed(table, row, 'insert')) return { data: null, error: denied };
            const key = KEYS[table];
            const i = rows.findIndex((r) => key.every((k) => r[k] === row[k]));
            if (i >= 0) {
              if (q.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key' } };
              rows[i] = { ...rows[i], ...row };
            } else rows.push(row);
            notify(table);
            return { data: q.returning ? (q.single ? clone(row) : [clone(row)]) : null, error: null };
          }
          const hit = rows.filter(matches).filter((r) => allowed(table, { ...r, ...(q.payload || {}) }, q.op) && (q.op !== 'update' || allowed(table, r, 'update')));
          if (q.op === 'update') for (const r of hit) Object.assign(r, q.payload);
          if (q.op === 'delete') {
            store.tables[table] = rows.filter((r) => !hit.includes(r));
            if (table === 'submissions') store.tables.likes = store.tables.likes.filter((l) => !hit.some((r) => r.id === l.submission_id));
          }
          if (hit.length) notify(table);
          return { data: null, error: null };
        };
        const b = {
          select() { if (q.op === 'select') q.op = 'select'; else q.returning = true; return b; },
          insert(p) { q.op = 'insert'; q.payload = p; return b; },
          upsert(p) { q.op = 'upsert'; q.payload = p; return b; },
          update(p) { q.op = 'update'; q.payload = p; return b; },
          delete() { q.op = 'delete'; return b; },
          eq(c, v) { q.filters.push([c, v]); return b; },
          single() { q.single = true; return b; },
          then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
        };
        return b;
      };
      const setSession = (s, event) => { session = s; for (const l of authListeners) later(() => l(event, s)); };
      return {
        from: query,
        channel() {
          const handlers = [];
          const ch = {
            on(_type, filter, fn) { handlers.push([filter.table, fn]); return ch; },
            subscribe() { store.listeners.add((table) => { for (const [t, fn] of handlers) if (t === table) fn(); }); return ch; },
          };
          return ch;
        },
        auth: {
          async getSession() { return { data: { session }, error: null }; },
          onAuthStateChange(fn) { authListeners.add(fn); return { data: { subscription: { unsubscribe: () => authListeners.delete(fn) } } }; },
          async signInWithOtp({ email }) { store.sent.push(email); return { data: {}, error: null }; },
          async verifyOtp({ email, token }) {
            if (token !== '123456' || !store.sent.includes(email)) return { data: {}, error: { message: 'Token has expired or is invalid' } };
            if (!store.users[email]) {
              store.users[email] = `user-${store.nextId++}`;
              if (store.ownerEmails.includes(email)) { store.tables.studio_owners.push({ user_id: store.users[email] }); notify('studio_owners'); }
            }
            const s = { user: { id: store.users[email], email } };
            setSession(s, 'SIGNED_IN');
            return { data: { session: s, user: s.user }, error: null };
          },
          async signOut() { setSession(null, 'SIGNED_OUT'); return { error: null }; },
        },
      };
    },
  };
}
