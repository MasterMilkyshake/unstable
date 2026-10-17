// The approved moves (task 1): flourish, uppercut and air chase, roll-cancel, directional block,
// blind on enemies, and boss summon waves that come back after an interrupted cast. A real Player
// driven through the real Input's key sets, real Enemy AI, flat ground (tests/support/arena.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, Actor, arena, player, enemy, step, pinRandom, DT } from './support/arena.js';

const { COMBAT, canLaunch, guardCovers } = await import('../src/combat/rules.js');
const { applyHit } = await import('../src/combat/combat.js');

const F = COMBAT.flourish;
const L = COMBAT.launch;

// A punching bag that never fights back, `z` metres ahead of the player.
function bag(z = 1.6, o = {}) {
  const a = new Actor({ team: 'enemy', hp: 1000, posture: 1000, level: 5, ...o });
  a.pos.set(o.x || 0, 0, z);
  a.yaw = Math.PI;
  a.grounded = true;
  G.actors.push(a);
  return a;
}
// An enemy that stands and defends but never swings.
function sparring(type, z, defend) {
  const e = enemy(type, 0, z);
  e.yaw = Math.PI;
  if (defend) e.spec = { ...e.spec, defend };
  e.setAggro(G.player);
  e.ai.atkCd = 99;
  return e;
}
const quiet = (...es) => () => {
  for (const e of es) e.ai.atkCd = 99;
};
const clickLMB = (input) => {
  input.mPressed[0] = true;
  input.mDown[0] = true;
};

// ---------------------------------------------------------------- flourish
test('flourish: an M1 held on its press waits at the top of the wind-up, and strikes when LMB is let go', () => {
  const { input } = arena();
  const p = player();
  const foe = bag();
  clickLMB(input);
  step(DT);
  assert.ok(p.atk && p.atk.def.flourish, 'an M1 can be flourished');
  const windup = p.atk.def.windup;
  step(windup + 0.2);
  assert.equal(p.atk.phase, 'windup', 'held at the top');
  assert.ok(p.atk.holding && p.atk.held > 0.15, `holding (${p.atk.held.toFixed(2)} s)`);
  assert.equal(foe.hp, 1000, 'nothing struck yet');
  input.mDown[0] = false;
  step(DT * 2);
  assert.ok(p.atk.phase !== 'windup', 'let go: the swing comes down');
  step(0.3);
  assert.ok(foe.hp < 1000, 'and lands');
});

test('flourish: a hold ends by itself after COMBAT.flourish.maxHold; a click is not a flourish', () => {
  const { input } = arena();
  const p = player();
  const foe = bag();
  clickLMB(input);
  let struckAt = null;
  step(1.2, (t) => {
    if (struckAt === null && p.atk && p.atk.phase === 'active') struckAt = t;
  });
  const windup = 0.15;
  // released at the cap: within a couple of 30 Hz steps of wind-up + maxHold (seen the step after)
  assert.ok(struckAt !== null && struckAt - (windup + F.maxHold) > -DT && struckAt - (windup + F.maxHold) < 3.5 * DT, `struck ${struckAt?.toFixed(2)} s in (wind-up + ${F.maxHold})`);
  assert.ok(foe.hp < 1000);
  // a click: down and straight up
  input.mDown[0] = false;
  p.combo = 0;
  step(0.8);
  let held = 0;
  input.mPressed[0] = true;
  step(0.6, (t) => {
    if (t > 0) input.mDown[0] = false;
    if (p.atk) held = Math.max(held, p.atk.held || 0);
  });
  assert.equal(held, 0, 'a click strikes at the top without waiting');
});

test('flourish: a held swing can still be feinted, and a second LMB press lets the first go', () => {
  const { input } = arena();
  const p = player();
  bag();
  clickLMB(input);
  step(0.3);
  assert.ok(p.atk && p.atk.holding);
  input.mPressed[2] = true; // RMB
  step(DT);
  assert.ok(p.atk === null, 'feinted from the hold');
  assert.ok(p.feintCd > 0);

  p.feintCd = 0;
  step(0.5);
  clickLMB(input);
  step(0.3);
  assert.ok(p.atk && p.atk.holding);
  input.mPressed[0] = true; // pressed again while still holding
  step(DT * 2);
  assert.ok(!p.atk || p.atk.phase !== 'windup', 'a new press releases the held swing');
});

test('flourish: a long hold beats a foe that parried at the usual moment', (t) => {
  pinRandom(t, 0); // the brigand always chooses to parry
  const { input } = arena();
  const p = player();
  const e = sparring('brigand', 2.2, { parry: 1, block: 0, dodge: 0 });
  clickLMB(input);
  step(0.15 + 0.3, quiet(e)); // hold 0.3 s past the top
  assert.ok(e.parryCd > 0 && !e.isParrying(), 'its parry went up at the top and closed again');
  input.mDown[0] = false;
  step(0.3, quiet(e));
  assert.ok(e.hp < e.maxHp, 'the flourish lands');
  assert.equal(p.stunT, 0, 'and was not parried');
});

test('flourish: a foe that has seen the player flourish waits for the top and parries the hold; a plain swing then catches it', (t) => {
  pinRandom(t, 0);
  const { input } = arena();
  const p = player();
  const e = sparring('brigand', 2.2, { parry: 0.3, block: 0, dodge: 0 });
  e.ai.flourishes = F.learn; // it has seen enough of them
  assert.ok(e.flourishPatience() > 0.5, `patience ${e.flourishPatience().toFixed(2)}`);
  clickLMB(input);
  step(0.15 + 0.3, quiet(e));
  input.mDown[0] = false;
  step(0.3, quiet(e));
  assert.ok(p.stunT > 0 || p.atk === null, 'the held swing was parried');
  assert.equal(e.hp, e.maxHp);

  // the same foe, a plain click: it waits for a hold that never comes and is struck
  step(1.2, quiet(e));
  e.parryCd = 0;
  e.ai.reactTo = null;
  p.combo = 0;
  input.mPressed[0] = true;
  step(0.5, (tt) => {
    e.ai.atkCd = 99;
    if (tt > 0) input.mDown[0] = false;
  });
  assert.ok(e.hp < e.maxHp, 'a swing with no hold beats the waiting guard');
});

test('flourish: a foe that has never seen one parries as before (patience grows with flourishes seen)', () => {
  arena();
  player();
  const e = sparring('brigand', 2.2);
  assert.equal(e.flourishPatience(), 0);
  e.ai.flourishes = 1;
  const half = e.flourishPatience();
  e.ai.flourishes = 2;
  assert.ok(e.flourishPatience() > half && half > 0);
  const boss = sparring('duelist', 3);
  boss.ai.flourishes = 2;
  assert.ok(boss.flourishPatience() > e.flourishPatience(), 'a boss reads it more often');
});

test('enemies flourish by the same rule: a held M1 waits at the top, then comes down', () => {
  arena();
  const p = player();
  const e = sparring('brigand', 2.2);
  e.target = p;
  e.startAttack(e.humanoidM1(0));
  e.atk.feintAt = undefined;
  e.atk.holdFor = 0.25;
  const windup = e.atk.def.windup;
  let topAt = null;
  let struckAt = null;
  step(windup + 0.6, (t) => {
    e.ai.atkCd = 99;
    if (e.atk && e.atk.holding && topAt === null) topAt = t;
    if (e.atk && e.atk.phase === 'active' && struckAt === null) struckAt = t;
  });
  assert.ok(topAt !== null, 'it held the swing');
  assert.ok(struckAt !== null && struckAt - windup > 0.2 && struckAt - windup < 0.32, `struck ${(struckAt - windup).toFixed(2)} s after the top`);
});

// ---------------------------------------------------------------- uppercut and air chase
function slideAt(p, input) {
  input.down.add('KeyW');
  input.down.add('ShiftLeft');
  step(0.8);
  input.pressed.add('KeyC');
  step(DT);
  assert.ok(p.slideT > 0, `sliding (speed ${p.speed.toFixed(1)})`);
}

test('uppercut: LMB in a slide ends the slide with a rising strike that launches a light foe, which cannot defend until it lands', () => {
  const { input } = arena();
  const p = player();
  const e = sparring('brigand', 9, { parry: 0, block: 0, dodge: 0 });
  slideAt(p, input);
  input.down.delete('KeyW');
  input.down.delete('ShiftLeft');
  e.pos.z = p.pos.z + 2.4;
  e.pos.x = p.pos.x;
  input.mPressed[0] = true;
  step(DT);
  assert.ok(p.atk && p.atk.def.upper, 'an uppercut');
  assert.equal(p.slideT, 0, 'the slide is over');
  let peak = 0;
  let defended = null;
  let landed = null;
  step(2, (t) => {
    e.ai.atkCd = 99;
    peak = Math.max(peak, e.pos.y);
    if (e.launched && !e.grounded && defended === null && e.pos.y > 0.8) {
      // mid-air: a raised guard does nothing
      e.blocking = true;
      e.parryT = 0.2;
      defended = applyHit(p, e, { dmg: 1, posture: 1, kind: 'melee', from: p.pos.clone() });
    }
    if (landed === null && peak > 0.5 && e.grounded) landed = t;
  });
  assert.ok(peak > 1.4 && peak < 3, `launched about two metres (${peak.toFixed(2)} m)`);
  assert.equal(defended, 'hit', 'no block or parry in the air');
  assert.ok(landed !== null && landed < 1.6, 'and it came down');
  assert.equal(e.launched, false, 'on its feet again');
  assert.ok(p.chaseTarget === e, 'the air chase opened');
});

test('uppercut: bosses, large and armoured creatures are not launched', () => {
  arena();
  const p = player();
  assert.ok(canLaunch(enemy('brigand', 0, 3)));
  assert.ok(canLaunch(enemy('rimefang', 0, 3)));
  for (const type of ['duelist', 'warlord', 'ash_golem', 'jungle_ape', 'gloomowl', 'drowned_knight', 'bog_lurker', 'primadon']) {
    const e = enemy(type, 0, 2.6);
    assert.equal(canLaunch(e), false, `${type} stays down`);
    e.yaw = Math.PI;
    applyHit(p, e, { dmg: 1, posture: 1, kind: 'melee', launch: L.speed, launcher: true, upper: true, from: p.pos.clone() });
    assert.ok(e.vel.y < 1 && !e.launched, `${type} was not lifted`);
    e.dead = true;
  }
});

test('uppercut: a launched foe is never lifted into a ceiling, and never left hanging', () => {
  const { colliders } = arena();
  const p = player();
  colliders.addBox({ x: 0, z: 2, w: 4, d: 4, y0: 2.6, y1: 3, walkable: true });
  const e = sparring('brigand', 2, { parry: 0, block: 0, dodge: 0 });
  applyHit(p, e, { dmg: 1, posture: 1, kind: 'melee', launch: L.speed, launcher: true, from: p.pos.clone() });
  assert.ok(e.launched);
  let peak = 0;
  step(1.5, () => {
    e.ai.atkCd = 99;
    peak = Math.max(peak, e.pos.y + e.height);
  });
  assert.ok(peak < 2.6, `the head stayed under the 2.6 m ceiling (${peak.toFixed(2)})`);
  assert.ok(e.grounded && !e.launched);
  // something holds it up (a bug elsewhere): the failsafe sets it down
  e.liftOff(L.speed);
  e.noGravity = true;
  step(L.failsafe + 0.3, () => {
    e.ai.atkCd = 99;
    e.vel.y = 0;
  });
  assert.ok(e.pos.y < 0.05, `set down (${e.pos.y.toFixed(2)})`);
});

test('air chase: Space soon after the launch leaps after the foe; two cuts keep it up, the slam drives it down', () => {
  const { input } = arena();
  const p = player();
  const e = sparring('brigand', 9, { parry: 0, block: 0, dodge: 0 });
  slideAt(p, input);
  input.down.delete('KeyW');
  input.down.delete('ShiftLeft');
  e.pos.set(p.pos.x, 0, p.pos.z + 2.4);
  input.mPressed[0] = true;
  step(0.3, quiet(e)); // the uppercut lands and lifts it
  assert.ok(e.launched, 'launched');
  input.pressed.add('Space');
  step(DT, quiet(e));
  assert.ok(p.chase, 'chasing');
  assert.ok(p.vel.y > 5, 'leaping up');
  const hp0 = e.hp;
  let air = 0;
  let spiked = false;
  let presses = 0;
  let pressedOn = null;
  step(2.2, (t) => {
    e.ai.atkCd = 99;
    if (!e.grounded) air += DT;
    if (e.spiked) spiked = true;
    // a press at the top of the leap, then one as each cut ends
    if (presses < 3 && p.chase && t > 0.25 && (!p.atk || (p.atk.phase === 'recovery' && p.atk !== pressedOn))) {
      input.mPressed[0] = true;
      pressedOn = p.atk;
      presses++;
    }
  });
  assert.equal(presses, 3, 'cut, cut, slam');
  assert.ok(e.hp < hp0 - 5, `the string landed (${(hp0 - e.hp).toFixed(1)})`);
  assert.ok(spiked, 'the slam drove it down');
  assert.ok(e.grounded && p.grounded && !p.chase, 'both back on the ground, the chase over');
  assert.ok(air < L.maxAir + 1, `not juggled forever (${air.toFixed(2)} s up)`);
});

test('air chase: with a wall in reach, Space is the usual jump and wall hop, and the chase never catches a ledge', () => {
  const { input, colliders } = arena();
  const p = player();
  const e = sparring('brigand', 2.5, { parry: 0, block: 0, dodge: 0 });
  colliders.addBox({ x: 0, z: 1.0, w: 6, d: 0.4, y0: 0, y1: 6, walkable: false }); // its face 0.8 m ahead
  e.pos.set(0, 1.5, 2.5);
  e.grounded = false;
  e.launched = true;
  e.launchAir = 0.1;
  p.chaseWin = 0.5;
  p.chaseTarget = e;
  input.pressed.add('Space');
  step(DT);
  assert.ok(p.chase === null, 'no chase into the wall');
  assert.ok(p.vel.y > 7, 'a plain jump');
  input.pressed.add('Space');
  step(DT);
  assert.equal(p.latches, 1, 'and in the air a wall hop, as always');

  // the chase leap itself never latches onto a ledge it passes
  const a2 = arena();
  const q = player();
  const f = sparring('brigand', 3, { parry: 0, block: 0, dodge: 0 });
  a2.colliders.addBox({ x: 0, z: 5, w: 6, d: 3, y0: 0, y1: 2.1, walkable: true }); // a ledge 2.1 m up, 3.5 m ahead
  f.pos.set(0, 2.2, 3.2);
  f.grounded = false;
  f.launched = true;
  f.launchAir = 0.1;
  q.chaseTarget = f;
  q.chaseWin = 0.5;
  a2.input.down.add('KeyW');
  a2.input.pressed.add('Space');
  let hung = false;
  step(0.6, () => {
    f.ai.atkCd = 99;
    if (q.chase && q.chase.t < q.chase.rise && q.climbing) hung = true;
  });
  assert.ok(q.chase || q.grounded, 'chased');
  assert.equal(hung, false, 'no catch on the way up');
});

// ---------------------------------------------------------------- roll-cancel
test('roll-cancel: F in the first 60% of a roll ends it (motion and i-frames) and raises the parry, at a cost to the next roll', () => {
  const { input } = arena();
  const p = player();
  input.down.add('KeyW');
  input.pressed.add('KeyQ');
  step(DT);
  assert.ok(p.dodgeT > 0 && p.iframes > 0, 'rolling');
  const cd0 = p.dodgeCd;
  step(0.1);
  assert.ok(p.speed > 8, `rolling fast (${p.speed.toFixed(1)} m/s)`);
  input.down.delete('KeyW');
  input.pressed.add('KeyF');
  step(DT);
  assert.equal(p.dodgeT, 0, 'the roll is over');
  assert.ok(p.iframes <= 0, 'no i-frames left');
  assert.ok(p.isParrying(), 'the parry is up at once');
  assert.ok(p.speed < 5, `the roll's motion is gone (${p.speed.toFixed(1)} m/s)`);
  assert.ok(p.dodgeCd > cd0 - 0.2 + COMBAT.rollCancel.cooldown - 0.05, `the next roll waits longer (${p.dodgeCd.toFixed(2)} s)`);

  // late in the roll: no cancel
  step(3);
  input.pressed.add('KeyQ');
  step(DT);
  step(0.26);
  const left = p.dodgeT;
  assert.ok(left > 0);
  input.pressed.add('KeyF');
  step(DT);
  assert.ok(p.dodgeT > 0 || left < DT * 1.5, 'past 60%, the roll runs out');
});

// ---------------------------------------------------------------- directional block
test('directional block: the guard covers 140 degrees in front; side and back blows land; the rim costs 1.3x posture', () => {
  arena();
  const att = new Actor({ team: 'player', hp: 100 });
  const tgt = new Actor({ team: 'enemy', hp: 1000, posture: 1000 });
  tgt.yaw = 0;
  const at = (deg, d = 2) => att.pos.set(Math.sin((deg * Math.PI) / 180) * d, 0, Math.cos((deg * Math.PI) / 180) * d);
  const swing = () => ({ dmg: 10, posture: 10, kind: 'melee', element: 'phys', from: att.pos.clone() });
  tgt.blocking = true;
  const results = {};
  for (const deg of [0, 30, 60, 69, 72, 90, 135, 180]) {
    at(deg);
    tgt.posture = 0;
    tgt.guardBroken = false;
    results[deg] = [applyHit(att, tgt, swing()), tgt.posture];
  }
  for (const deg of [0, 30, 60, 69]) assert.equal(results[deg][0], 'blocked', `${deg} deg is guarded`);
  for (const deg of [72, 90, 135, 180]) assert.equal(results[deg][0], 'hit', `${deg} deg gets through`);
  assert.ok(Math.abs(results[60][1] / results[0][1] - COMBAT.guard.edgePosture) < 1e-9, 'the rim costs more posture');
  assert.equal(results[30][1], results[0][1]);
  // the parry has the same arc
  tgt.blocking = false;
  at(90);
  tgt.parryT = 0.2;
  assert.equal(applyHit(att, tgt, swing()), 'hit', 'no parry from the side');
  at(20);
  tgt.parryT = 0.2;
  tgt.stunT = 0;
  assert.equal(applyHit(att, tgt, swing()), 'parried');
});

test('directional block: a blocking player faces the camera aim; a blocking enemy turns no faster than COMBAT.ai.guardTurn', () => {
  const { input, game } = arena();
  const p = player();
  game.camYaw = Math.PI / 2;
  input.down.add('KeyF');
  step(0.5);
  assert.ok(p.blocking);
  assert.ok(Math.abs(p.yaw - Math.PI / 2) < 0.05, `faces the aim (${p.yaw.toFixed(2)})`);
  input.down.delete('KeyF');

  const e = sparring('brigand', 0, { parry: 0, block: 0, dodge: 0 });
  e.pos.set(0, 0, 0);
  p.pos.set(2.5, 0, 0); // 90 degrees to its left
  e.yaw = 0;
  e.blocking = true;
  e.ai.blockT = 5;
  step(0.2, quiet(e));
  assert.ok(e.yaw > 0.1 && e.yaw <= COMBAT.ai.guardTurn * 0.2 + 1e-6, `turned ${e.yaw.toFixed(2)} rad in 0.2 s with its guard up`);
  e.blocking = false;
  e.ai.blockT = 0;
  e.yaw = 0;
  step(0.2, quiet(e));
  assert.ok(e.yaw > COMBAT.ai.guardTurn * 0.2, 'faster with its guard down');
});

test('directional block: an enemy does not raise a guard against a swing from its flank', (t) => {
  pinRandom(t, 0);
  arena();
  const p = player();
  const e = sparring('brigand', 0, { parry: 1, block: 1, dodge: 0 });
  e.pos.set(0, 0, 0);
  e.yaw = 0;
  p.pos.set(2.2, 0, 0); // its flank
  p.atk = { phase: 'windup', t: 0.1, def: { windup: 0.3, active: 0.12, range: 3 } };
  e.target = p;
  e.react(DT, 2.2);
  assert.equal(e.ai.parryAt, -1, 'no parry');
  assert.equal(e.blocking, false, 'no block');
  assert.equal(guardCovers(e, p.pos), false);
});

// ---------------------------------------------------------------- blind on enemies
test('blind: an enemy perceives only 3 m, cannot parry or block, stops tracking mid-swing, and swings where it last saw its foe', () => {
  const { input } = arena();
  const p = player();
  const e = enemy('brigand', 0, 6);
  e.yaw = Math.PI;
  e.applyStatus('blind', 1, p);
  assert.ok(e.statuses.blind.t > 2.5, 'three seconds for an ordinary foe');
  step(0.3, () => (e.ai.atkCd = 99));
  assert.equal(e.aggro, false, 'unseen at 6 m');
  p.pos.set(0, 0, 3.4);
  step(0.2, () => (e.ai.atkCd = 99));
  assert.equal(e.aggro, true, 'within 3 m it finds you');

  // no defense while blind
  e.spec = { ...e.spec, defend: { parry: 1, block: 1, dodge: 1 } };
  e.applyStatus('blind', 1, p);
  p.atk = { phase: 'windup', t: 0.1, def: { windup: 0.3, active: 0.12, range: 3 } };
  e.react(DT, 2.6);
  assert.equal(e.ai.parryAt, -1);
  assert.equal(e.blocking, false);
  p.atk = null;

  // it swings at the place it last saw you: you step aside out of its 3 m
  e.pos.set(0, 0, 6);
  p.pos.set(0, 0, 3.6); // seen
  step(DT, () => (e.ai.atkCd = 99));
  p.pos.set(5, 0, 3.6); // gone sideways, 5 m off
  e.applyStatus('blind', 1, p);
  const seen = [e.ai.seenX, e.ai.seenZ];
  e.ai.atkCd = 0;
  let swungAt = null;
  let topYaw = null;
  step(2, () => {
    e.applyStatus('blind', 1, p); // kept blind
    if (e.atk && e.atk.def.trackTarget && swungAt === null) swungAt = { yaw: e.yaw, x: e.pos.x, z: e.pos.z, atk: e.atk };
    if (swungAt && topYaw === null && e.atk === swungAt.atk && e.atk.phase !== 'windup') topYaw = e.yaw;
  });
  assert.ok(e.atk === null || !e.atk.feintAt, 'a blind foe does not feint');
  assert.ok(Math.abs(seen[0]) < 0.01 && Math.abs(seen[1] - 3.6) < 0.01, 'remembered where it saw you');
  assert.ok(swungAt, 'it swung');
  const toSeen = Math.atan2(seen[0] - swungAt.x, seen[1] - swungAt.z);
  const toPlayer = Math.atan2(p.pos.x - swungAt.x, p.pos.z - swungAt.z);
  const off = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  assert.ok(off(swungAt.yaw, toSeen) < off(swungAt.yaw, toPlayer), 'at the old spot, not at you');
  assert.ok(topYaw !== null && Math.abs(topYaw - swungAt.yaw) < 1e-9, 'and it did not turn to follow mid-swing');
});

test('blind: a boss is blinded for half as long', () => {
  arena();
  const p = player();
  const e = enemy('brigand', 0, 3);
  const b = enemy('warlord', 3, 3);
  e.applyStatus('blind', 1, p);
  b.applyStatus('blind', 1, p);
  assert.ok(Math.abs(b.statuses.blind.t / e.statuses.blind.t - COMBAT.blind.bossMul) < 1e-9);
});

// ---------------------------------------------------------------- boss summons
test('boss summons: an interrupted summon cast is tried again about 3 s later; each HP threshold brings exactly one wave', () => {
  arena();
  const p = player();
  const boss = enemy('witch_queen', 0, 3);
  boss.yaw = Math.PI;
  boss.setAggro(p);
  boss.target = p;
  const witches = () => G.actors.filter((a) => a.type === 'fen_witch' && !a.dead).length;
  boss.hp = boss.maxHp * 0.6; // below the first threshold (0.65)
  const d = boss.chooseAttack(2);
  assert.ok(d && d.netKey[0] === 'summon');
  boss.startAttack(d);
  step(0.3, () => (boss.ai.atkCd = 99));
  boss.interrupt(0.4); // a blow in the wind-up
  step(0.6, () => (boss.ai.atkCd = 99));
  assert.equal(witches(), 0, 'the cast was cut short: no wave');
  assert.equal(boss.ai.summonsDone, 0, 'and the wave is not spent');
  assert.notEqual(boss.chooseAttack(2)?.netKey?.[0], 'summon', 'not straight away');
  G.time += COMBAT.summonRetry;
  const again = boss.chooseAttack(2);
  assert.equal(again && again.netKey[0], 'summon', 'tried again after the wait');
  boss.startAttack(again);
  step(1.6, () => (boss.ai.atkCd = 99));
  assert.equal(witches(), 2, 'one wave');
  assert.equal(boss.ai.summonsDone, 1);
  G.time += 10;
  assert.notEqual(boss.chooseAttack(2)?.netKey?.[0], 'summon', 'no second wave at the same threshold');
  boss.hp = boss.maxHp * 0.25;
  assert.equal(boss.chooseAttack(2)?.netKey?.[0], 'summon', 'the next threshold brings the next');
});
