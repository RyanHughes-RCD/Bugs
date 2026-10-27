// A stand-in for the published page's `window.claude`, for tests: an
// in-memory shared database with the studio's access rules (everyone reads;
// people write only subs/<their id> and votes/<their id>; the owner writes
// everything), plus a `user` namespace. Several fakes can share one `store`
// to play different people. Kept free of imports so the e2e test can inject
// it into the browser as plain script text.
export function makeFakeStore() {
  return { docs: new Map(), listeners: new Set() };
}

export function makeFakeClaude({ store = makeFakeStore(), me = 'u_owner', owner = 'u_owner', names = {} } = {}) {
  const later = (fn) => setTimeout(fn, 0);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const parentOf = (path) => path.split('/').slice(0, -1).join('/');
  const notify = () => { for (const l of store.listeners) later(l); };
  const mayWrite = (path) => {
    if (me === owner) return true;
    const [top, who] = path.split('/');
    return (top === 'subs' || top === 'votes') && who === me;
  };
  const snapOf = (path) => {
    const data = store.docs.get(path);
    return { id: path.split('/').pop(), exists: !!data, data: () => (data ? clone(data) : undefined), metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const reject = () => Promise.reject({ code: 'invalid_argument', message: 'not allowed' });
  const docRef = (path) => ({
    id: path.split('/').pop(),
    path,
    get: async () => snapOf(path),
    set: async (data) => { if (!mayWrite(path)) return reject(); store.docs.set(path, clone(data)); notify(); },
    update: async (data) => { if (!mayWrite(path) || !store.docs.has(path)) return reject(); store.docs.set(path, { ...store.docs.get(path), ...clone(data) }); notify(); },
    delete: async () => { if (!mayWrite(path)) return reject(); store.docs.delete(path); notify(); },
    onSnapshot(next) {
      const fire = () => next(snapOf(path));
      store.listeners.add(fire);
      later(fire);
      return () => store.listeners.delete(fire);
    },
  });
  const collRef = (path) => {
    const docs = () => [...store.docs.keys()].filter((p) => parentOf(p) === path).sort().map(snapOf);
    return {
      path,
      doc: (id) => docRef(`${path}/${id || Math.random().toString(36).slice(2)}`),
      get: async () => { const d = docs(); return { docs: d, size: d.length, empty: !d.length }; },
      onSnapshot(next) {
        const fire = () => { const d = docs(); next({ docs: d, size: d.length, empty: !d.length, docChanges: () => [] }); };
        store.listeners.add(fire);
        later(fire);
        return () => store.listeners.delete(fire);
      },
    };
  };
  const db = { doc: docRef, collection: collRef };
  const user = {
    id: async () => me,
    isOwner: async () => me === owner,
    canEdit: async () => me === owner,
    can: async () => null,
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: names[id] || '', isMe: id === me }])),
  };
  return { store, use: async (name) => (name === 'db' ? db : name === 'user' ? user : null) };
}
