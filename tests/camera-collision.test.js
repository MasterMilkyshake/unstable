import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Colliders } from '../src/world/colliders.js';
import { cameraOrbit, cameraClearance, easeFocus } from '../src/game/cameraCollision.js';

function world() { return { colliders: new Colliders(), terrain: { raycast: () => null } }; }

test('camera retracts on the near side of a thin wall instead of stepping through it, keeping its heading', () => {
  const w = world();
  w.colliders.addBox({ x: 0, z: -0.75, w: 20, d: 0.3, y0: 0, y1: 20 });
  const focus = new THREE.Vector3(0, 1.6, 0);
  const { direction, allowed } = cameraOrbit(w, focus, new THREE.Vector3(0, 2, -6));
  const target = focus.clone().addScaledVector(direction, allowed);
  assert.ok(target.z > -0.6, 'never reaches the far side of the wall');
  assert.equal(w.colliders.pointInside(...target.toArray()), null);
  // the view never swings to another heading: the movement keys follow camYaw
  assert.ok(Math.abs(direction.x) < 1e-9 && direction.z < 0, `still looking along the same heading (${direction.toArray()})`);
});

test('under a low ceiling the arm is lowered to stay level rather than pulled into the head', () => {
  const w = world();
  w.colliders.addBox({ x: 0, z: 0, w: 30, d: 30, y0: 2.3, y1: 2.6 }); // a ceiling 0.7 m over the focus
  const focus = new THREE.Vector3(0, 1.6, 0);
  const desired = new THREE.Vector3(0, 1.6 + 6 * Math.sin(0.5), -6 * Math.cos(0.5)); // pitched down at the body
  const plain = cameraClearance(w, focus, desired.clone().sub(focus).normalize(), 6);
  const orbit = cameraOrbit(w, focus, desired);
  assert.ok(plain < 1.35, `the pitched arm meets the ceiling (${plain.toFixed(2)})`);
  assert.equal(orbit.lift, -0.35);
  assert.ok(orbit.allowed > plain + 1, `the lowered arm has room (${orbit.allowed.toFixed(2)})`);
  const target = focus.clone().addScaledVector(orbit.direction, orbit.allowed);
  assert.ok(target.y < 2.3, 'under the ceiling');
});

test('a held lift is kept while clear, and the shoulder view takes over only with room to spare', () => {
  const w = world();
  // a lintel over the arm: the shoulder view has about 1.5 m, just above the 1.35 m minimum
  w.colliders.addBox({ x: 0, z: -1.95, w: 20, d: 1, y0: 2.3, y1: 6 });
  const focus = new THREE.Vector3(0, 1.6, 0);
  const desired = new THREE.Vector3(0, 3.6, -5.6);
  const free = cameraOrbit(w, focus, desired);
  assert.equal(free.lift, null, 'with nothing held, the shoulder view is enough');
  const held = cameraOrbit(w, focus, desired, 1.35, -0.35);
  assert.equal(held.lift, -0.35, 'the held lift stays: the shoulder view has under minimum + 0.4');
});

test('the follow point eases a stair riser, never trails far, and takes a teleport at once', () => {
  const f = new THREE.Vector3(0, 1.6, 0);
  const t = new THREE.Vector3(0, 1.9, 0.4); // a 0.3 m riser
  easeFocus(f, t, 1 / 60);
  assert.ok(f.y > 1.6 && f.y < 1.75, `eased, not snapped (${f.y.toFixed(3)})`);
  assert.equal(f.z, 0.4, 'across the ground it follows exactly');
  for (let i = 0; i < 60; i++) easeFocus(f, t, 1 / 60);
  assert.ok(Math.abs(f.y - 1.9) < 0.01, 'settles on the body');
  easeFocus(f, new THREE.Vector3(0, 4, 0.4), 1 / 60);
  assert.ok(f.y >= 4 - 0.6 - 1e-9, `never more than 0.6 m below the body (${f.y.toFixed(2)})`);
  easeFocus(f, new THREE.Vector3(0, 1, 0.4), 1 / 60);
  assert.ok(f.y <= 1 + 0.35 + 1e-9, 'never more than 0.35 m above it');
  easeFocus(f, new THREE.Vector3(100, 20, 0), 1 / 60);
  assert.deepEqual(f.toArray(), [100, 20, 0]);
});

test('the camera near plane stops before a corner missed by its center ray', () => {
  const w = world();
  w.colliders.addBox({ x: 0.3, z: -2, w: 0.2, d: 0.4, y0: 0, y1: 4 });
  const focus = new THREE.Vector3(0, 1.6, 0), dir = new THREE.Vector3(0, 0, -1);
  assert.equal(w.colliders.raycast(0, 1.6, 0, 0, 0, -1, 6), 6);
  assert.ok(cameraClearance(w, focus, dir, 6) < 1.8);
});

test('a completely enclosed focus never forces the camera through geometry', () => {
  const w = world();
  w.colliders.addBox({ x: 0, z: 0, w: 4, d: 4, y0: 0, y1: 4 });
  const result = cameraOrbit(w, new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 2, -6));
  assert.equal(result.allowed, 0);
});
