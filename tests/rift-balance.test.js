// The Rift's balance: sanity wears down over a ten-to-fifteen-minute run, there is no passive
// healing down there, and a kill gives back 10-25% of max health by how tough the foe was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, arena, player, enemy, step } from './support/arena.js';

const { RIFT_SANITY_DRAIN, killHealShare, KILL_HEAL } = await import('../src/game/riftBalance.js');
const { Game } = await import('../src/game/game.js');

test('a Rift run lasts 10 to 15 minutes before sanity is dangerous', () => {
  const minutes = (100 * 0.7) / RIFT_SANITY_DRAIN / 60;
  assert.ok(minutes >= 10 && minutes <= 15, `30% left after ${minutes.toFixed(1)} min`);
  const { game } = arena();
  const p = player();
  game.inRift = true;
  const s0 = p.ch.sanity;
  step(10);
  const lost = s0 - p.ch.sanity;
  assert.ok(Math.abs(lost - 10 * RIFT_SANITY_DRAIN * p.derived.sanityDrain) < 0.05, `drained once per frame: ${lost.toFixed(2)} in 10 s`);
});

test('no passive health regen in the Rift; on the surface it still comes back', () => {
  const { game } = arena();
  const p = player();
  p.hp = p.maxHp * 0.5;
  game.inRift = true;
  step(5);
  assert.equal(p.hp, p.maxHp * 0.5, 'no regen in the Rift');
  game.inRift = false;
  step(5);
  assert.ok(p.hp > p.maxHp * 0.5, 'regen on the surface');
});

test('a kill in the Rift heals the killer by 10-25% of max health, scaled by the foe', () => {
  assert.equal(killHealShare({ maxHp: 50 }), KILL_HEAL.min);
  assert.equal(killHealShare({ maxHp: 5000 }), KILL_HEAL.max);
  assert.equal(killHealShare({ maxHp: 200, spec: { boss: true } }), KILL_HEAL.max);
  const mid = killHealShare({ maxHp: 300 });
  assert.ok(mid > KILL_HEAL.min && mid < KILL_HEAL.max, `a middling foe gives ${(mid * 100).toFixed(0)}%`);

  const { game } = arena();
  const p = player();
  Object.assign(game, { ch: p.ch, player: p, quests: { onKill() {} }, ui: { toast() {}, banner() {} }, audio: G.audio, giveItem() {}, giveWeapon() {}, giveOutfit() {} });
  const kill = (inRift, killer, foe) => {
    p.hp = p.maxHp * 0.3;
    game.inRift = inRift;
    Game.prototype.onEnemyKilled.call(game, foe, killer);
    return p.hp - p.maxHp * 0.3;
  };
  const foe = enemy('brigand', 3, 0);
  const share = killHealShare(foe);
  const healed = kill(true, p, foe);
  assert.ok(Math.abs(healed - p.maxHp * share * p.derived.healMul) < 1e-6, `healed ${healed.toFixed(1)} of ${p.maxHp}`);
  assert.equal(kill(false, p, foe), 0, 'no heal on the surface');
  assert.equal(kill(true, null, foe), 0, 'no heal for a kill someone else made');
});
