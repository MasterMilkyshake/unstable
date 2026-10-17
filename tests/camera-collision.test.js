import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Colliders } from '../src/world/colliders.js';
import { cameraOrbit, cameraClearance } from '../src/game/cameraCollision.js';

function world() { return { colliders: new Colliders(), terrain: { raycast: () => null } }; }

test('camera retracts on the near side of a thin wall instead of stepping through it', () => {
  const w = world();
  w.colliders.addBox({ x: 0, z: -0.75, w: 20, d: 0.3, y0: 0, y1: 20 });
  const focus = new THREE.Vector3(0, 1.6, 0);
  const { direction, allowed } = cameraOrbit(w, focus, new THREE.Vector3(0, 2, -6));
  const target = focus.clone().addScaledVector(direction, allowed);
  assert.ok(target.z > -0.6, 'never reaches the far side of the wall');
  assert.equal(w.colliders.pointInside(...target.toArray()), null);
  assert.ok(allowed >= 1.35, 'a free alternate orbit stays outside the head');
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
