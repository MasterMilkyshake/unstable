import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/core/globals.js';
import { addRep, ensureStanding } from '../src/game/factions.js';
import { RIVALS } from '../src/data/factions.js';

// Standing that matters (docs/agent/WORLD_LIFE_PLAN.md, task 9): a change with one faction moves
// its rivals the other way, on the same toast.
let toasts;
beforeEach(() => {
  toasts = [];
  G.ui = { toast: (m, kind) => toasts.push([m, kind]) };
  G.audio = null;
});

test('the Enclave and the Ministry pull against each other; the Watch sits between', () => {
  const ch = ensureStanding({});
  addRep(ch, 'enclave', 8);
  assert.deepEqual(ch.rep, { watch: -2, enclave: 8, ministry: -3 });
  assert.equal(toasts.length, 1, 'one toast for the change and its rivals');
  assert.match(toasts[0][0], /The Enclave: \+8 standing · the Ministry −3 · the Watch −2/);
  addRep(ch, 'ministry', 9);
  assert.equal(ch.rep.enclave, 8 - 3);
  addRep(ch, 'watch', 10);
  assert.equal(ch.rep.enclave, 5 - 2, 'a fifth of the Watch\'s change the other way');
  assert.equal(ch.rep.ministry, -3 + 9, 'the Ministry does not care about the Watch');
});

test('small changes round away to nothing, and rivals never chain', () => {
  const ch = ensureStanding({});
  addRep(ch, 'watch', 2);
  assert.deepEqual(ch.rep, { watch: 2, enclave: 0, ministry: 0 });
  assert.match(toasts[0][0], /^The Saltreach Watch: \+2 standing$/);
  // the Enclave's -15 moves the Ministry +5 and the Watch +4, and the Ministry's +5 moves nothing on
  addRep(ch, 'enclave', -15);
  assert.deepEqual(ch.rep, { watch: 6, enclave: -15, ministry: 5 });
});

test('a tier crossed by a rival\'s share is announced too', () => {
  const ch = ensureStanding({});
  ch.rep.ministry = 12; // Trusted
  addRep(ch, 'enclave', 10); // the Ministry -3: Neutral
  assert.ok(toasts.some(([m]) => /You are now Neutral with the Ministry/.test(m)));
  for (const f in RIVALS) for (const r in RIVALS[f]) assert.ok(RIVALS[f][r] < 0 && RIVALS[f][r] > -1, `${f} -> ${r}`);
});

test('the Honored and the Exalted are sent their rewards once, and titled', async () => {
  const { standingRewards } = await import('../src/game/factions.js');
  const { OUTFITS } = await import('../src/data/items.js');
  const { TRINKETS } = await import('../src/data/trinkets.js');
  const { TIER_REWARDS } = await import('../src/data/factions.js');
  const { ACTIONS } = await import('../src/game/hooks.js');
  // stand in for agent/release's rows where this build lacks them
  const added = [];
  for (const r of Object.values(TIER_REWARDS)) for (const g of Object.values(r)) {
    if (g.outfit && !OUTFITS[g.outfit]) { OUTFITS[g.outfit] = { name: g.outfit }; added.push([OUTFITS, g.outfit]); }
    if (g.trinket && !TRINKETS[g.trinket]) { TRINKETS[g.trinket] = { name: g.trinket }; added.push([TRINKETS, g.trinket]); }
  }
  const given = [];
  const game = { giveOutfit: (id) => given.push(id) };
  G.game = game;
  const prev = ACTIONS.giveTrinket;
  ACTIONS.giveTrinket = (id) => given.push(id);
  try {
    const ch = ensureStanding({});
    ch.rep.watch = 39;
    assert.deepEqual(standingRewards(ch, game), [], 'nothing below Honored');
    addRep(ch, 'watch', 1); // Honored, through the game's own path
    assert.ok(given.includes(TIER_REWARDS.watch.honored.outfit) && given.includes(TIER_REWARDS.watch.honored.trinket));
    given.length = 0;
    ch.rep.watch = 80;
    standingRewards(ch, game);
    standingRewards(ch, game);
    assert.deepEqual(given, [TIER_REWARDS.watch.exalted.trinket], 'the Exalted trinket, once');
    assert.ok(ch.titles.includes('Friend of the Lamp'));
  } finally {
    ACTIONS.giveTrinket = prev;
    G.game = null;
    for (const [t, id] of added) delete t[id];
  }
});
