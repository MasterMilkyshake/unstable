// Everything the Rift's floor builds stays in the Rift: nothing built for the world beneath the
// sea may land on the surface isles (the far crust once stacked itself in Saltreach's plaza).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildRiftFloor } from '../src/world/riftFloor.js';

const terrain = new Terrain();
terrain.build();
const world = { scene: new THREE.Scene(), terrain, colliders: new Colliders(), addLight() {}, addEmitter() {} };
buildRiftFloor(world, [], { low: false });

test('the Rift floor builds nothing near the surface isles', () => {
  world.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let meshes = 0;
  world.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    box.setFromObject(o);
    assert.ok(box.min.x > 5000 && box.min.z > 5000, `${o.name || o.parent?.name || 'mesh'} reaches ${box.min.x.toFixed(0)}, ${box.min.z.toFixed(0)}`);
  });
  assert.ok(meshes > 0);
});
