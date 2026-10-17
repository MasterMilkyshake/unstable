// Combat feel and presentation (task 8). Effects report outcomes and never decide them; these
// tests check what they report: telegraphs that read without colour, guard sounds and reactions
// by weapon class, hit-stop by weapon weight, the reduce-flashing setting, and the rig: a walk
// cycle that keeps a planted foot still, swings that meet their target when the rules strike,
// and a real hang from a ledge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, Actor, arena, player, enemy, DT } from './support/arena.js';

const { applyHit } = await import('../src/combat/combat.js');
const { HumanoidRig } = await import('../src/entities/rig.js');
const { ATTACKS, POSES } = await import('../src/entities/anims.js');

// record every effect and sound call
function spies() {
  const calls = [];
  const rec = (who) => new Proxy({}, { get: (_, name) => (...args) => (calls.push([who, name, ...args]), undefined) });
  G.vfx = rec('vfx');
  G.audio = rec('audio');
  return calls;
}
const sounds = (calls, name) => calls.filter((c) => c[0] === 'audio' && c[1] === 'play' && c[2] === name);

test('a red blow and an orange blow each have their own sound and shape, not only their colour', () => {
  arena();
  player();
  const calls = spies();
  const e = enemy('brigand', 0, 3);
  e.startAttack({ windup: 0.5, active: 0.1, recovery: 0.2, unparryable: true, dmg: 10 });
  e.cancelAttack();
  e.startAttack({ windup: 0.5, active: 0.1, recovery: 0.2, unblockable: true, dmg: 10 });
  const marks = calls.filter((c) => c[0] === 'vfx' && c[1] === 'warnMark').map((c) => c[3]);
  assert.deepEqual(marks, ['red', 'orange'], 'spikes for red, chevrons for orange');
  assert.equal(sounds(calls, 'warnRed').length, 1);
  assert.equal(sounds(calls, 'warnOrange').length, 1);
});

test('block, parry and guard-break sounds carry the striking weapon\'s class; bodies react to each', () => {
  const ring = (weapon) => {
    arena();
    const att = player({ weapon });
    const calls = spies();
    const tgt = enemy('brigand', 0, 2);
    tgt.yaw = Math.PI;
    tgt.blocking = true;
    tgt.model.anim.action = null;
    applyHit(att, tgt, Object.assign(att.buildHit({ dmgMul: 1 }, tgt), { from: att.pos.clone() }));
    return { cls: sounds(calls, 'block')[0][3].cls, recoil: tgt.model.anim.action && tgt.model.anim.action.name };
  };
  assert.deepEqual(ring('magma_maul'), { cls: 'hammer', recoil: 'blockRecoil' });
  assert.equal(ring('rusty_dagger').cls, 'dagger');

  arena();
  const att = enemy('brigand', 0, 2);
  att.yaw = Math.PI;
  const p = player();
  const calls = spies();
  p.parryT = 0.2;
  att.atk = { phase: 'active', def: {} };
  assert.equal(applyHit(att, p, Object.assign(att.buildHit(att.humanoidM1(0), p), { from: att.pos.clone() })), 'parried');
  assert.equal(sounds(calls, 'parry')[0][3].cls, 'sword', 'the parry rings for the brigand\'s sword');
  assert.equal(att.model.anim.action.name, 'deflected', 'its arm is thrown back');
  att.stunT = 0;
  att.guardBroken = false;
  att.posture = att.maxPosture - 1;
  att.guardBreak(p);
  assert.equal(att.model.anim.action.name, 'guardBroken');
});

test('hit-stop and shake follow the weapon\'s weight: a dagger barely pauses the fight, a maul lands hard', () => {
  const stop = (weapon) => {
    arena();
    const p = player({ weapon });
    const calls = spies();
    const foe = new Actor({ team: 'enemy', hp: 5000, posture: 5000 });
    foe.pos.set(0, 0, 2);
    foe.yaw = Math.PI;
    G.actors.push(foe);
    applyHit(p, foe, Object.assign(p.buildHit({ dmgMul: 1 }, foe), { from: p.pos.clone() }));
    return calls.find((c) => c[0] === 'vfx' && c[1] === 'hitStop')[2];
  };
  const [d, s, m] = [stop('rusty_dagger'), stop('steel_longsword'), stop('magma_maul')];
  assert.ok(d < s && s < m && m <= 0.12, `${d} < ${s} < ${m}`);
});

test('reduce flashing scales camera shake and light flashes to a third', async () => {
  const { VFX } = await import('../src/combat/vfx.js').catch(() => ({}));
  const Vfx = VFX || (await import('../src/combat/vfx.js')).default;
  const shake = (reduce) => {
    G.settings = { cameraShake: 1, reduceFlashing: reduce };
    const v = { shake: 0 };
    (Vfx ? Vfx.prototype : Object.getPrototypeOf(G.vfx)).addShake.call(v, 0.6);
    return v.shake;
  };
  try {
    assert.ok(Math.abs(shake(true) / shake(false) - 0.33) < 1e-9);
  } finally {
    G.settings = undefined;
  }
});

// ---------------------------------------------------------------- the rig
const rig = (scale = 1) => new HumanoidRig({ scale });
function tick(r, st, secs = 0.5) {
  for (let t = 0; t < secs; t += DT) r.update(DT, st);
}

test('the walk cycle keeps a planted foot still: the foot\'s backward speed at mid-stance matches the ground speed', () => {
  for (const [speed, scale] of [[3, 1], [5.8, 1], [9.7, 1], [5.8, 1.3]]) {
    const r = rig(scale);
    tick(r, { speed, grounded: true, runSpeed: 9.7 });
    const run = Math.min(1, Math.max(0, (speed - 5.5) / (9.7 - 5.5)));
    const footSpeed = 0.9 * scale * r.anim.stride * r.anim.cadence * (1 + run * 0.4);
    assert.ok(Math.abs(footSpeed / speed - 1) < 0.02, `at ${speed} m/s (scale ${scale}) the foot moves at ${footSpeed.toFixed(2)}`);
  }
  // backward and sideways
  const back = rig();
  tick(back, { speed: 4, grounded: true, fwd: -1, side: 0 });
  const p0 = back.anim.phase;
  tick(back, { speed: 4, grounded: true, fwd: -1, side: 0 }, 0.2);
  assert.ok(back.anim.phase < p0, 'walking backward runs the cycle backward');
  const sideways = rig();
  let out = 0;
  for (let t = 0; t < 0.8; t += DT) {
    sideways.update(DT, { speed: 4, grounded: true, fwd: 0, side: 1 });
    out = Math.max(out, Math.abs(sideways.anim.cur.lHip[2]));
  }
  assert.ok(out > 0.2, `a side-step swings the legs out to the side (${out.toFixed(2)} rad)`);
});

test('a swing reaches its contact pose as the active phase begins (when the rules strike)', () => {
  const r = rig();
  const w = 0.3;
  r.play('slashR', { windup: w, active: 0.12, recovery: 0.2 });
  // sample the action exactly at the wind-up's end
  const T = r.anim.target;
  r.anim.action.t = w;
  r.anim._sampleAction(T, r.anim.action);
  const mid = ATTACKS.slashR.mid.rShoulder;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(T.rShoulder[i] - mid[i]) < 1e-6, `rShoulder[${i}] at contact`);
  // and held for a flourish, it waits at the top of the wind, not partway to contact
  r.play('slashR', { windup: w, active: 0.12, recovery: 0.2 });
  r.holdSwing(true);
  r.update(0.5, { grounded: true });
  assert.ok(r.anim.action.t < w * 0.8, 'held before the swing starts to travel');
});

test('hanging from a ledge holds both hands up on the edge; leaping off it reaches up', () => {
  const r = rig();
  tick(r, { climbing: true, grounded: false }, 1);
  assert.ok(r.anim.cur.rShoulder[0] < -2.7 && r.anim.cur.lShoulder[0] < -2.7, 'both arms up');
  assert.ok(r.anim.cur.lKnee[0] > 0.2, 'legs hanging, knees soft');
  tick(r, { grounded: false, vy: 6, leap: true }, 0.6);
  assert.ok(r.anim.cur.lShoulder[0] < -2 && r.anim.cur.rShoulder[0] < -2, `reaching up for the edge above (${r.anim.cur.lShoulder[0].toFixed(2)})`);
  tick(r, { grounded: false, vy: 6 }, 0.6);
  assert.ok(r.anim.cur.lShoulder[0] > -1, 'an ordinary jump does not');
  assert.ok(POSES.leap);
});
