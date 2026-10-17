// Knocked (the user's call, 2026-10-16): no struggling up with Space and no giving in with R.
// A knocked player rises once no foe is watching (after 5 s), or bleeds out while one is near.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, arena, player, enemy, step } from './support/arena.js';

function knock() {
  const { input } = arena();
  const p = player();
  G.game.onPlayerDeath = () => {};
  p.onLethal(null);
  assert.ok(p.knocked);
  return { p, input };
}

test('Space no longer struggles a knocked player up, and R no longer gives in', () => {
  const { p, input } = knock();
  const foe = enemy('brigand', 0, 8);
  foe.setAggro(p);
  step(2, () => {
    foe.ai.atkCd = 99;
    foe.pos.set(0, 0, 8);
    input.pressed.add('Space');
    input.down.add('Space');
    input.down.add('KeyR');
  });
  assert.ok(p.knocked && !p.dead, 'still knocked: neither key does anything');
});

test('a knocked player rises when no foe is watching, and bleeds out when one is', () => {
  const alone = knock().p;
  step(5.5);
  assert.ok(!alone.knocked && !alone.dead, 'up again with no one near');

  const { p } = knock();
  const foe = enemy('brigand', 0, 20);
  foe.setAggro(p);
  step(13, () => {
    foe.ai.atkCd = 99;
    foe.pos.set(0, 0, 20); // watching from 20 m, never coming to grip
  });
  assert.ok(p.dead, 'bled out under a watching foe');
});
