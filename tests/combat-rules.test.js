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
const { COMBAT, resolveDefense } = await import('../src/combat/rules.js');
const { applyHit, isFrontal } = await import('../src/combat/combat.js');
const { Actor } = await import('../src/entities/actor.js');
const { Enemy } = await import('../src/entities/enemy.js');
const { MANTRAS } = await import('../src/data/mantras.js');
const { BIND } = await import('../src/core/input.js');

// Effects are presentation only: every vfx/audio call is a no-op here.
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

const CTX = { frontal: (t, from) => isFrontal(t, from) };

// A bare fighter at (x, z) facing +z (yaw 0) unless told otherwise.
function fighter(o = {}) {
  const a = new Actor({ team: o.team || 'enemy', hp: 200, posture: 100 });
  a.pos.set(o.x || 0, 0, o.z || 0);
  a.yaw = o.yaw || 0;
  a.level = o.level || 5;
  return a;
}
const swing = (att, extra = {}) => Object.assign({ dmg: 20, posture: 10, kind: 'melee', element: 'phys', from: att.pos.clone() }, extra);

test('defense resolves in a fixed order: i-frames, parry, block, hit', () => {
  const att = fighter({ team: 'player', z: 2, yaw: Math.PI });
  const tgt = fighter();
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'hit');
  tgt.blocking = true;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'blocked');
  tgt.parryT = 0.2;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'parried', 'a parry beats a held block');
  tgt.iframes = 0.1;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'evaded', 'i-frames beat everything');
  assert.equal(resolveDefense(att, tgt, swing(att, { ignoreIframes: true }), CTX).result, 'parried');
});

test('red and orange attacks get past the defense they ignore', () => {
  const att = fighter({ team: 'player', z: 2, yaw: Math.PI });
  const tgt = fighter();
  tgt.parryT = 0.2;
  tgt.blocking = true;
  assert.equal(resolveDefense(att, tgt, swing(att, { unparryable: true }), CTX).result, 'blocked');
  assert.equal(resolveDefense(att, tgt, swing(att, { unparryable: true, unblockable: true }), CTX).result, 'hit');
  tgt.parryT = 0;
  assert.equal(resolveDefense(att, tgt, swing(att, { unblockable: true }), CTX).result, 'hit');
});

test('guards face forward: a blow from behind lands unless an auto-parry covers the back', () => {
  const att = fighter({ team: 'player', z: -2 });
  const tgt = fighter();
  tgt.blocking = true;
  tgt.parryT = 0.2;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'hit');
  tgt.autoParryT = 0.5;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'parried');
});

test('a fighter mid-swing, stunned or knocked cannot defend', () => {
  const att = fighter({ team: 'player', z: 2, yaw: Math.PI });
  const tgt = fighter();
  tgt.blocking = true;
  tgt.atk = { phase: 'windup', def: {} };
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'hit');
  tgt.atk.phase = 'recovery';
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'blocked', 'recovery frames can block');
  tgt.atk = null;
  tgt.stunT = 0.3;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'hit');
  tgt.stunT = 0;
  tgt.knocked = true;
  assert.equal(resolveDefense(att, tgt, swing(att), CTX).result, 'void');
  assert.equal(resolveDefense(att, tgt, swing(att, { finisher: true }), CTX).result, 'hit');
});

test('a missed parry locks the next one out; a parry that lands readies it at once', () => {
  const att = fighter({ team: 'player', z: 2, yaw: Math.PI });
  const tgt = fighter();
  tgt.startParry(COMBAT.parry.window);
  assert.equal(tgt.parryCd, COMBAT.parry.missCooldown);
  tgt.baseUpdate(COMBAT.parry.window + 0.01); // nothing came: a miss
  assert.ok(!tgt.isParrying());
  assert.ok(tgt.parryCd > 0.5, 'still locked out well after the window closed');
  const t2 = fighter();
  t2.startParry(COMBAT.parry.window);
  att.atk = { phase: 'active', def: {} };
  assert.equal(applyHit(att, t2, swing(att)), 'parried');
  assert.equal(t2.parryCd, COMBAT.parry.successCooldown);
  assert.ok(att.stunT > 0, 'the parried attacker staggers');
});

test('mana charging is gone: mantras cost ether alone and G is unbound', () => {
  for (const [id, m] of Object.entries(MANTRAS)) {
    assert.equal(m.mana, undefined, `${id} still has a mana cost`);
    assert.ok(Number.isFinite(m.ether) && m.ether >= 0, `${id} needs an ether cost`);
  }
  // the old mana cost folded into ether at half weight
  assert.equal(MANTRAS.ember_bolt.ether, 18);
  assert.ok(!Object.values(BIND).some((codes) => codes.includes('KeyG')));
});

// ---------------------------------------------------------------- AI on the same rules
function aiFighter(defend, o = {}) {
  const e = Object.create(Enemy.prototype);
  Object.assign(e, fighter(o));
  e.spec = { defend, speed: 4 };
  e.boss = !!o.boss;
  e.model = { play() {}, flash() {}, anim: null };
  e.ai = { reactTo: null, parryAt: -1, blockT: 0, cds: {} };
  e.aggro = true;
  return e;
}
// The AI rolls its defensive choice; pin the roll so a test sees one branch every run.
function pinRandom(t, v) {
  const real = Math.random;
  Math.random = () => v;
  t.after(() => (Math.random = real));
}
function playerSwing(windup = 0.3) {
  const p = fighter({ team: 'player', z: 2, yaw: Math.PI });
  p.atk = { phase: 'windup', t: 0, def: { windup, active: 0.12, range: 3 } };
  return p;
}

test('an enemy reads a swing a moment after it starts, not on its first frame', (t) => {
  pinRandom(t, 0);
  const e = aiFighter({ parry: 1, block: 0, dodge: 0 });
  const p = playerSwing();
  e.target = p;
  e.react(0.016, 2);
  assert.equal(e.ai.parryAt, -1, 'no read before the perception delay');
  p.atk.t = COMBAT.ai.reaction;
  e.react(0.016, 2);
  assert.ok(e.ai.parryAt >= 0, 'committed to a parry');
});

test('the fastest player swing can still be read and parried', (t) => {
  pinRandom(t, 0);
  const e = aiFighter({ parry: 1, block: 0, dodge: 0 });
  const p = playerSwing(0.14); // a dagger's wind-up
  e.target = p;
  p.atk.t = COMBAT.ai.reaction;
  e.react(0.016, 2);
  assert.ok(e.ai.parryAt >= 0);
});

test('a feint baits an enemy parry, and the follow-up finds it on cooldown', (t) => {
  pinRandom(t, 0);
  const e = aiFighter({ parry: 1, block: 1, dodge: 0 });
  const p = playerSwing();
  e.target = p;
  p.atk.t = 0.1;
  e.react(0.016, 2); // reads the swing, schedules the parry
  p.atk = null; // ...which the player feints
  for (let i = 0; i < 20; i++) e.react(0.016, 2); // the parry goes up at nothing
  assert.ok(e.parryCd > 0, 'the whiffed parry is on cooldown');
  e.baseUpdate(0.3); // the window closes
  const real = playerSwing();
  e.target = real;
  real.atk.t = 0.1;
  e.react(0.016, 2);
  assert.equal(e.ai.parryAt, -1, 'cannot parry the real swing');
  assert.ok(e.blocking, 'so it blocks instead');
});
