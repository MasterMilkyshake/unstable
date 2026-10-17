import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';

if (modules.registerHooks) {
  modules.registerHooks({ load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
  } });
} else {
  modules.register('data:text/javascript,' + encodeURIComponent(`
    export async function load(url, context, next) {
      return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
    }
  `), import.meta.url);
}
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { G } = await import('../src/core/globals.js');
const { Actor } = await import('../src/entities/actor.js');
const { applyHit } = await import('../src/combat/combat.js');

// Effects are presentation only.
const noop = new Proxy({}, { get: () => () => {} });
beforeEach(() => {
  G.vfx = noop;
  G.audio = noop;
  G.ui = noop;
  G.net = null;
  G.player = null;
  G.time = 100;
  G.actors = [];
});

const DT = 1 / 30;
function body(o = {}) {
  const a = new Actor({ team: o.team || 'enemy', hp: o.hp || 500, posture: 100, level: o.level || 5, resist: o.resist });
  a.pos.set(o.x || 0, 0, o.z || 0);
  a.yaw = o.yaw || 0;
  if (o.boss) a.boss = true;
  return a;
}
function run(a, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) a.baseUpdate(DT);
}
const swing = { anim: 'slash', windup: 0.6, active: 0.2, recovery: 0.4, range: 2, arc: 90 };

test('burn deals its damage over 3.2 s, less through ember resist, and water puts it out', () => {
  const src = body({ team: 'player', level: 10 }); // 3 + 10 x 0.35 = 6.5 per second
  const a = body();
  a.applyStatus('burn', 1, src);
  run(a, 4);
  assert.ok(!a.statuses.burn, 'burned out');
  assert.ok(Math.abs(500 - a.hp - 6.5 * 3.2) < 0.5, `took ${(500 - a.hp).toFixed(1)}`);

  const proof = body({ resist: { ember: 0.5 } });
  proof.applyStatus('burn', 1, src);
  run(proof, 4);
  // resist shortens it (x 0.65) and takes half of every tick
  assert.ok(Math.abs(500 - proof.hp - 6.5 * 3.2 * 0.65 * 0.5) < 0.5, `took ${(500 - proof.hp).toFixed(1)}`);

  const swimmer = body();
  swimmer.applyStatus('burn', 1, src);
  swimmer.swimming = true;
  run(swimmer, 0.1);
  assert.ok(!swimmer.statuses.burn, 'doused');
});

test('chill builds to a freeze that stops an attack, then thaws; a boss only staggers', () => {
  const a = body();
  for (let i = 0; i < 3; i++) a.applyStatus('chill');
  assert.equal(Math.round(a.statuses.chill.stacks), 78);
  assert.ok(!a.statuses.freeze && !a.stunned, 'three chills are not a freeze');
  a.startAttack(swing);
  a.applyStatus('chill');
  assert.ok(a.statuses.freeze && !a.statuses.chill, 'the fourth freezes');
  assert.ok(a.stunned);
  assert.equal(a.atk, null, 'the swing is lost');
  run(a, 1.7);
  assert.ok(!a.statuses.freeze && !a.stunned, 'thawed after 1.6 s');

  const lone = body();
  lone.applyStatus('chill');
  run(lone, 2.5 + 26 / 30 + 0.1);
  assert.ok(!lone.statuses.chill, 'one chill fades once it stops being renewed');

  const boss = body({ boss: true });
  for (let i = 0; i < 4; i++) boss.applyStatus('chill');
  assert.ok(!boss.statuses.freeze, 'bosses do not freeze');
  assert.ok(boss.stunned && boss.stunT <= 0.6);
  run(boss, 0.7);
  assert.ok(!boss.stunned);
});

test('shock interrupts a wind-up for half a second, but not a boss', () => {
  const a = body();
  a.startAttack(swing);
  a.applyStatus('shock');
  run(a, DT);
  assert.equal(a.atk, null, 'the swing is broken off');
  assert.ok(a.stunned);
  run(a, 0.5);
  assert.ok(!a.stunned && !a.statuses.shock);

  const boss = body({ boss: true });
  boss.startAttack(swing);
  boss.applyStatus('shock');
  run(boss, DT);
  assert.ok(boss.atk, 'a boss swings on through it');
});

test('bleed stacks to ten, bleeds 1.4 a second per stack, and stops 5 s after the last cut', () => {
  const src = body({ team: 'player' });
  const a = body();
  for (let i = 0; i < 12; i++) a.applyStatus('bleed', 1, src);
  assert.equal(a.statuses.bleed.stacks, 10);
  run(a, 5.2);
  assert.ok(!a.statuses.bleed);
  assert.ok(Math.abs(500 - a.hp - 10 * 1.4 * 5) < 0.6, `took ${(500 - a.hp).toFixed(1)}`);
});

test('blind lasts 3 s and is ignored by those immune to it', () => {
  const a = body();
  a.applyStatus('blind');
  run(a, 2.9);
  assert.ok(a.statuses.blind);
  run(a, 0.2);
  assert.ok(!a.statuses.blind);
  const sighted = body();
  sighted.mods.blindImmune = true;
  sighted.applyStatus('blind');
  assert.ok(!sighted.statuses.blind);
});

test('an element resisted almost wholly brings no ailment at all', () => {
  const a = body({ resist: { ember: 0.95, rime: 0.95, storm: 0.95, blood: 0.95, umbra: 0.95 } });
  for (const id of ['burn', 'chill', 'shock', 'bleed', 'blind']) a.applyStatus(id);
  assert.deepEqual(Object.keys(a.statuses), []);
});

test('an ailment rides on a blow that lands, not on one blocked or parried', () => {
  const att = body({ team: 'player', z: 2, yaw: Math.PI });
  const hit = () => ({ dmg: 10, posture: 5, kind: 'melee', element: 'phys', status: ['bleed'], from: att.pos.clone() });
  const open = body();
  assert.equal(applyHit(att, open, hit()), 'hit');
  assert.ok(open.statuses.bleed);
  const guard = body();
  guard.blocking = true;
  assert.equal(applyHit(att, guard, hit()), 'blocked');
  assert.ok(!guard.statuses.bleed);
  const parrier = body();
  parrier.parryT = 0.2;
  assert.equal(applyHit(att, parrier, hit()), 'parried');
  assert.ok(!parrier.statuses.bleed);
});
