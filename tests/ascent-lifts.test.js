import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceToRift, riftToSurface, inAscentHole, ASCENT_HOLE_R } from '../src/world/riftCeiling.js';
import * as THREE from 'three';
import { ASCENT_LIFTS, updateAscentLifts } from '../src/world/ascentLifts.js';
import { SPIRE } from '../src/data/riftSpire.js';
import { G } from '../src/core/globals.js';
import { ACTIONS } from '../src/game/hooks.js';
import '../src/game/ascentLifts.js';

test('surface-to-rift mapping aligns Wash, Saltreach and Keystone', () => {
  const wash = surfaceToRift(0, -330);
  assert.ok(Math.hypot(wash.x - 6000, wash.z - 5818.5) < 0.05, 'Wash sits over the arrival shelf');
  const salt = surfaceToRift(0, 0);
  assert.equal(salt.x, 6000);
  assert.equal(salt.z, 6000);
  const key = surfaceToRift(8, 48);
  assert.ok(Math.abs(key.x - 6004.4) < 1e-6 && Math.abs(key.z - 6026.4) < 1e-6);
  assert.ok(Math.hypot(key.x - SPIRE.x, key.z - SPIRE.z) < 45, 'Keystone hangs near the Ascent');
  const back = riftToSurface(6000, 6000);
  assert.equal(back.x, 0);
  assert.equal(back.z, 0);
});

test('the Ascent hole is centered on the spire and wide enough to frame it', () => {
  assert.equal(inAscentHole(SPIRE.x, SPIRE.z), true);
  assert.equal(inAscentHole(SPIRE.x + 16, SPIRE.z), true);
  assert.equal(inAscentHole(SPIRE.x + ASCENT_HOLE_R + 1, SPIRE.z), false);
});

// The user's call (2026-10-16): one lift in the Rift, not three.
test('one lift carries a climber from the courtyard to the summit', () => {
  assert.equal(ASCENT_LIFTS.length, 1);
  const [lift] = ASCENT_LIFTS;
  assert.equal(lift.from, 'base');
  assert.equal(lift.to, 'summit');
  assert.ok(lift.padOz > 14.7, 'it stands outside the keep, against its +z wall');
  assert.ok(lift.label && lift.downLabel, 'both ways are named');
});

// A weak player must be able to leave the Rift: every lift carries a character who has never
// pulled the lever, seated the gears or fought the knight.
test('every lift carries a newcomer up, with no lever, gears or guardian first', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  G.ui = noop;
  G.audio = noop;
  G.vfx = noop;
  for (const def of ASCENT_LIFTS) {
    const lift = { def, x: 0, z: 0, ry: 0, y: 0, y0: 0, y1: 16, dest: 0, moving: false, rideDir: 0, pad: { position: new THREE.Vector3() } };
    const player = { pos: new THREE.Vector3(0, 0, 0), dead: false };
    G.game = { world: { rift: { ascentLifts: { lifts: [lift] } } }, player, ch: { flags: {} } };
    ACTIONS.rideAscentLift(def.id);
    assert.equal(lift.dest, lift.y1, `${def.id} rises`);
    assert.ok(lift.moving);
    assert.ok(!('unlock' in def) && !('unlockFlag' in def), `${def.id} has no gate`);
  }
});

// A Rift death ends the character, so the cage must not let a rider step or be knocked out
// over a 110 m drop: its grilles and front bar ride with it, and the bar is lifted only at the
// courtyard, where the cage is boarded from the front.
test('the cage keeps its rider in on the way up and opens at the courtyard', () => {
  const v = () => new THREE.Vector3();
  const [def] = ASCENT_LIFTS;
  const lift = {
    def, x: 10, z: 20, ry: 0, y: 0, y0: 0, y1: 110, dest: 0, moving: false,
    pad: { position: v() }, bar: { position: v(), visible: true }, cw: { position: v() },
    cage: { sides: [{}, {}], bar: {} }, col: {}, ride: { pos: v() },
    chain: { position: v(), scale: v() }, cwChain: { position: v(), scale: v() }, gear: { rotation: v() },
  };
  const state = { ascentLifts: { lifts: [lift] } };
  const rider = { pos: new THREE.Vector3(10.2, 0, 21.5), grounded: true, dead: false };
  G.actors = [rider];
  updateAscentLifts(state, 0);
  assert.equal(lift.bar.visible, false, 'the bar is lifted at the courtyard');
  assert.ok(lift.cage.bar.y1 < lift.y0 - 1, 'and out of the way of boarding');
  lift.dest = lift.y1;
  lift.moving = true;
  for (let i = 0; i < 30 * 20; i++) updateAscentLifts(state, 1 / 30);
  assert.equal(lift.y, lift.y1);
  assert.ok(Math.abs(rider.pos.y - lift.y1) < 1e-6, 'the rider rode up with it');
  assert.ok(rider.pos.z - lift.z < 0.95, 'the rider was drawn in clear of the bar');
  assert.equal(lift.bar.visible, true);
  assert.ok(lift.cage.bar.y0 === lift.y && lift.cage.bar.y1 > lift.y + 1, 'the bar is down at the summit');
  for (const side of lift.cage.sides) assert.ok(side.y0 === lift.y && side.y1 > lift.y + 2, 'the grilles ride with the cage');
  G.actors = [];
});
