import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStudio } from '../game/js/community/supabase-studio.js';
import { makeFakeSupabaseLib, makeFakeSupabaseStore } from './fake-supabase.mjs';

const PALETTE = { K: '#1a1c2c', R: '#b13e53', G: '#38b764' };
const settle = () => new Promise((r) => setTimeout(r, 10));
const sprite = (ch = 'R') => Array.from({ length: 16 }, (_, y) => (y === 8 ? `....${ch.repeat(8)}....` : '.'.repeat(16)));
const CONFIG = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };

async function people() {
  const store = makeFakeSupabaseStore({ owners: ['ryan@example.com'] });
  const make = async () => { const s = new SupabaseStudio(CONFIG, PALETTE, makeFakeSupabaseLib(store)); await s.connect(); return s; };
  const owner = await make();
  const sam = await make();
  return { store, owner, sam };
}
const signIn = async (studio, email) => {
  assert.ok((await studio.sendCode(email)).ok);
  assert.ok((await studio.verifyCode(email, '123 456')).ok);
  await settle();
};

test('signing in with an emailed 6-digit code', async () => {
  const { sam } = await people();
  assert.ok(sam.available);
  assert.ok(sam.needsSignIn);
  assert.equal((await sam.sendCode('not an email')).ok, false);
  assert.ok((await sam.sendCode('sam@example.com')).ok);
  assert.equal((await sam.verifyCode('sam@example.com', '000000')).ok, false);
  assert.equal((await sam.verifyCode('sam@example.com', '12')).ok, false);
  assert.ok((await sam.verifyCode('sam@example.com', '123456')).ok);
  assert.equal(sam.needsSignIn, false);
  assert.equal(sam.email, 'sam@example.com');
  assert.ok((await sam.signOut()).ok);
  assert.ok(sam.needsSignIn);
});

test('signed-out players can look but not submit or like', async () => {
  const { sam } = await people();
  const res = await sam.submit({ kind: 'fix', species: 'ladybug', rows: sprite() });
  assert.equal(res.ok, false);
  assert.match(res.error, /Sign in/);
});

test('the full loop: name, submit, like, owner approves, sprite goes live, revert', async () => {
  const { owner, sam } = await people();
  await signIn(owner, 'ryan@example.com');
  await signIn(sam, 'sam@example.com');
  assert.ok(owner.isOwner, 'the owner is recognised from studio_owners');
  assert.equal(sam.isOwner, false);
  assert.ok((await sam.setName('Sam')).ok);
  const sub = await sam.submit({ kind: 'fix', species: 'ladybug', rows: sprite(), note: 'Spots' });
  assert.ok(sub.ok, sub.error);
  await settle();
  assert.equal(owner.list({ status: 'pending' }).length, 1, 'the owner sees it live');
  assert.equal(owner.nameOf(sam.me), 'Sam');
  assert.equal(sam.nameOf(sam.me), 'You');
  assert.ok((await owner.toggleLike(sub.ref)).ok);
  await settle();
  assert.equal(sam.likeCount(sub.ref), 1);

  assert.equal((await sam.approve(sub.ref)).ok, false, 'Sam cannot approve');
  assert.ok((await owner.approve(sub.ref)).ok);
  await settle();
  assert.equal(sam.status(sub.ref), 'approved');
  assert.deepEqual(sam.live.sprites.ladybug.rows, sprite());
  assert.equal((await sam.submit({ kind: 'fix', species: 'ladybug', rows: sprite('G') }, sub.ref)).ok, false, 'locked once decided');
  assert.ok((await owner.setLiveSprite('ladybug', null)).ok);
  await settle();
  assert.equal(sam.live.sprites.ladybug, undefined);
  assert.ok((await owner.setLiveSprite('ladybug', sub.ref)).ok);
  await settle();
  assert.ok(sam.live.sprites.ladybug);
});

test('bug ideas: edit while pending, reject with a note, approve into the gallery, withdraw', async () => {
  const { owner, sam } = await people();
  await signIn(owner, 'ryan@example.com');
  await signIn(sam, 'sam@example.com');
  const a = await sam.submit({ kind: 'idea', rows: sprite('G'), name: 'Moss Mite', rarity: 'rare', traits: ['dig'] });
  const b = await sam.submit({ kind: 'idea', rows: sprite('R'), name: 'Rust Roach' });
  assert.ok(a.ok && b.ok);
  assert.ok((await sam.submit({ kind: 'idea', rows: sprite('G'), name: 'Moss Mite II' }, a.ref)).ok);
  await settle();
  assert.equal(owner.subs.get(a.ref).name, 'Moss Mite II');
  assert.ok((await owner.approve(a.ref)).ok);
  assert.ok((await owner.reject(b.ref, 'Too close to the cockroach')).ok);
  await settle();
  assert.equal(sam.live.bugs[a.ref].name, 'Moss Mite II');
  assert.equal(sam.live.bugs[a.ref].author, sam.me);
  assert.equal(sam.decisions[b.ref].note, 'Too close to the cockroach');
  assert.ok((await sam.withdraw(b.ref)).ok);
  await settle();
  assert.equal(owner.subs.has(b.ref), false);
});

test("people can't change each other's things, and the database's refusals read well", async () => {
  const { store, sam } = await people();
  await signIn(sam, 'sam@example.com');
  const eve = new SupabaseStudio(CONFIG, PALETTE, makeFakeSupabaseLib(store));
  await eve.connect();
  await signIn(eve, 'eve@example.com');
  const sub = await sam.submit({ kind: 'fix', species: 'ladybug', rows: sprite() });
  await settle();
  const sneaky = await eve.submit({ kind: 'fix', species: 'ladybug', rows: sprite('G') }, sub.ref);
  assert.equal(sneaky.ok, false);
  const res = await eve.decide(sub.ref, 'approved');
  assert.equal(res.ok, false);
  for (let i = 0; i < 60; i++) await eve.submit({ kind: 'fix', species: 'ant', rows: sprite() });
  const over = await eve.submit({ kind: 'fix', species: 'ant', rows: sprite() });
  assert.equal(over.ok, false);
  assert.match(over.error, /60 submissions/);
});

test("if the Studio server can't be reached, connect fails (so the game can fall back)", async () => {
  const lib = { createClient: () => ({ from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) }) };
  const st = new SupabaseStudio(CONFIG, PALETTE, lib);
  await assert.rejects(st.connect());
  assert.equal(st.available, false);
});

test('codes of any length Supabase is set to (6 to 10 digits) are accepted, spaces and all', async () => {
  const store = makeFakeSupabaseStore();
  const lib = makeFakeSupabaseLib(store);
  const st = new SupabaseStudio(CONFIG, PALETTE, lib);
  await st.connect();
  const seen = [];
  const real = st.sb.auth.verifyOtp;
  st.sb.auth.verifyOtp = async (args) => { seen.push(args.token); return real({ ...args, token: '123456' }); };
  await st.sendCode('ryan@example.com');
  assert.ok((await st.verifyCode('ryan@example.com', '1602 0548')).ok);
  assert.equal(seen[0], '16020548', 'all 8 digits reach Supabase');
  assert.equal((await st.verifyCode('ryan@example.com', '12345678901')).ok, false, 'too long');
});
