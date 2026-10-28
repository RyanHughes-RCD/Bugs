import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Studio, cleanRows, cleanSubmission, cleanEyes, refOf } from '../game/js/community/studio.js';
import { makeFakeClaude, makeFakeStore } from './fake-claude.mjs';

const PALETTE = { K: '#1a1c2c', R: '#b13e53', Y: '#ffcd75', G: '#38b764' };
const settle = () => new Promise((r) => setTimeout(r, 5));
const sprite = (ch = 'R', n = 16) => Array.from({ length: n }, (_, y) => (y === 8 ? `${'.'.repeat(4)}${ch.repeat(8)}${'.'.repeat(n - 12)}` : '.'.repeat(n)));

async function people() {
  const store = makeFakeStore();
  const owner = new Studio(makeFakeClaude({ store, me: 'u_owner', names: { u_sam: 'Sam' } }), PALETTE);
  const sam = new Studio(makeFakeClaude({ store, me: 'u_sam' }), PALETTE);
  await owner.connect();
  await sam.connect();
  await settle();
  return { store, owner, sam };
}

test('sprites must be 16 or 32 square rows of palette colours, with something drawn', () => {
  assert.ok(cleanRows(sprite(), PALETTE));
  assert.ok(cleanRows(sprite('G', 32), PALETTE));
  assert.equal(cleanRows(sprite().slice(1), PALETTE), null, 'wrong height');
  assert.equal(cleanRows(sprite('Z'), PALETTE), null, 'not in the palette');
  assert.equal(cleanRows(Array(16).fill('.'.repeat(16)), PALETTE), null, 'blank');
  assert.equal(cleanRows('nope', PALETTE), null);
});

test('bug ideas are cleaned: unknown families, rarities and traits fall back, text is clipped', () => {
  const idea = cleanSubmission({ kind: 'idea', rows: sprite(), name: '  Glitter Gnat  ', desc: 'x'.repeat(500), family: 'dragon', rarity: 'ultra', traits: ['fly', 'fly', 'laser'] }, PALETTE);
  assert.equal(idea.name, 'Glitter Gnat');
  assert.equal(idea.desc.length, 160);
  assert.equal(idea.family, 'crawler');
  assert.equal(idea.rarity, 'common');
  assert.deepEqual(idea.traits, ['fly']);
  assert.equal(cleanSubmission({ kind: 'idea', rows: sprite(), name: '   ' }, PALETTE), null, 'needs a name');
  assert.equal(cleanSubmission({ kind: 'fix', rows: sprite(), species: 'not_a_bug' }, PALETTE), null);
});

test('anyone can submit a fix; only the owner can approve it, and then it goes live', async () => {
  const { owner, sam } = await people();
  const res = await sam.submit({ kind: 'fix', species: 'ladybug', rows: sprite(), base: 'original', note: 'Spots were off' });
  assert.ok(res.ok, res.error);
  await settle();
  assert.equal(owner.list({ status: 'pending' }).length, 1, 'the owner sees it');
  assert.equal(owner.nameOf('u_sam'), 'Sam');
  assert.equal(sam.nameOf('u_sam'), 'You');

  assert.equal((await sam.approve(res.ref)).ok, false, 'Sam cannot approve his own fix');
  assert.ok((await owner.approve(res.ref)).ok);
  await settle();
  assert.equal(sam.status(res.ref), 'approved');
  assert.deepEqual(sam.live.sprites.ladybug.rows, sprite());
  assert.equal(sam.liveRef('ladybug'), res.ref);

  // Back to the original, then forward to the approved fix again.
  assert.ok((await owner.setLiveSprite('ladybug', null)).ok);
  await settle();
  assert.equal(sam.live.sprites.ladybug, undefined);
  assert.ok((await owner.setLiveSprite('ladybug', res.ref)).ok);
  await settle();
  assert.ok(sam.live.sprites.ladybug);
  assert.equal(owner.history('ladybug').length, 1);
});

test('people can only change their own submissions and likes', async () => {
  const { store, owner, sam } = await people();
  const mine = await sam.submit({ kind: 'idea', rows: sprite('G'), name: 'Moss Mite', family: 'arachnid', rarity: 'rare', traits: ['dig', 'build'], desc: 'Lives in moss.' });
  await settle();
  // Someone else writing into Sam's document is refused by the database rules.
  const eve = makeFakeClaude({ store, me: 'u_eve' });
  const db = await eve.use('db');
  await assert.rejects(db.doc('subs/u_sam').set({ items: {} }));
  await assert.rejects(db.doc('studio/live').set({ sprites: {} }));

  assert.ok((await owner.toggleLike(mine.ref)).ok);
  assert.ok((await sam.toggleLike(mine.ref)).ok);
  await settle();
  assert.equal(sam.likeCount(mine.ref), 2);
  assert.ok(sam.likedByMe(mine.ref));
  assert.ok((await sam.toggleLike(mine.ref)).ok);
  await settle();
  assert.equal(sam.likeCount(mine.ref), 1);

  // Edit while pending, then withdraw.
  const key = mine.ref.split('~')[1];
  assert.ok((await sam.submit({ kind: 'idea', rows: sprite('Y'), name: 'Moss Mite II' }, key)).ok);
  await settle();
  assert.equal(owner.subs.get(mine.ref).name, 'Moss Mite II');
  assert.ok((await sam.withdraw(key)).ok);
  await settle();
  assert.equal(owner.subs.size, 0);
});

test('approved bug ideas are kept for the game; rejected ones can carry a note; decided ones are locked', async () => {
  const { owner, sam } = await people();
  const a = await sam.submit({ kind: 'idea', rows: sprite('G'), name: 'Moss Mite', rarity: 'rare' });
  const b = await sam.submit({ kind: 'idea', rows: sprite('R'), name: 'Rust Roach' });
  await settle();
  assert.ok((await owner.approve(a.ref)).ok);
  assert.ok((await owner.reject(b.ref, 'Too close to the cockroach')).ok);
  await settle();
  assert.equal(sam.live.bugs[a.ref].name, 'Moss Mite');
  assert.equal(sam.live.bugs[a.ref].author, 'u_sam');
  assert.equal(sam.decisions[b.ref].note, 'Too close to the cockroach');
  assert.equal((await sam.submit({ kind: 'idea', rows: sprite(), name: 'Changed' }, a.ref.split('~')[1])).ok, false);
  assert.equal(refOf('u_sam', 'k'), 'u_sam~k');
});

test('outside the published game there is no studio, and nothing breaks', async () => {
  const st = new Studio(undefined, PALETTE);
  assert.equal(await st.connect(), false);
  assert.equal((await st.submit({ kind: 'fix', species: 'ladybug', rows: sprite() })).ok, false);
});

test('eye marks for Albinos are cleaned and travel with a fix into the live sprite', async () => {
  const rows = sprite();
  assert.deepEqual(cleanEyes([[4, 8], [4, 8], [0, 0], [99, 1], ['x', 2], [5, 8]], rows), [[4, 8], [5, 8]], 'only drawn pixels, once each');
  assert.equal(cleanEyes(Array.from({ length: 12 }, (_, i) => [4 + (i % 8), 8]), rows).length, 8, 'at most 8');
  const { owner, sam } = await people();
  const res = await sam.submit({ kind: 'fix', species: 'ladybug', rows, eyes: [[5, 8], [10, 8]] });
  await settle();
  assert.deepEqual(owner.subs.get(res.ref).eyes, [[5, 8], [10, 8]]);
  assert.ok((await owner.approve(res.ref)).ok);
  await settle();
  assert.deepEqual(sam.live.sprites.ladybug.eyes, [[5, 8], [10, 8]]);
  assert.ok((await owner.setLiveSprite('ladybug', null)).ok);
  assert.ok((await owner.setLiveSprite('ladybug', res.ref)).ok, 'back to that fix, eyes and all');
  await settle();
  assert.deepEqual(sam.live.sprites.ladybug.eyes, [[5, 8], [10, 8]]);
});
