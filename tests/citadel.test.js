import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCitadel } from '../src/world/citadel.js';
import { Colliders } from '../src/world/colliders.js';

for (const spec of [
  { id: 'lantern', w: 19, d: 18, h: 46, passage: 9, rot: 0 },
  { id: 'meridian', w: 20, d: 19, h: 34, passage: 9, variant: 'garrison', rot: 0.63 },
  { id: 'sage', w: 13, d: 12, h: 30, passage: 4.5, rot: Math.PI },
]) {
  test(`${spec.id}: citadel has a walkable passage and grounded, solid wings`, () => {
    const world = { terrain: { heightAt: (x, z) => x * 0.025 + z * 0.015 }, colliders: new Colliders() };
    const s = { ...spec, x: 35, z: -20 };
    const group = new THREE.Group();
    group.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
    group.rotation.y = s.rot;
    buildCitadel(world, s, group);
    group.updateMatrixWorld(true);
    const point = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(group.matrixWorld);
    // Probe both edges as well as the center, through both faces of the arch.
    for (const offset of [-s.passage / 2 + 0.6, 0, s.passage / 2 - 0.6]) {
      for (let z = -s.d / 2 - 2; z <= s.d / 2 + 2; z += 0.25) {
        const p = point(offset, z); p.y = world.terrain.heightAt(p.x, p.z) + 0.02;
        const before = p.clone(); world.colliders.resolve(p, 0.4, 1.8);
        assert.ok(p.distanceTo(before) < 0.01, `passage blocked at ${offset}, ${z}`);
      }
    }
    for (const side of [-1, 1]) {
      const p = point(side * (s.w + s.passage) / 4, 0);
      p.y = world.terrain.heightAt(p.x, p.z) + 0.02;
      assert.ok(world.colliders.resolve(p, 0.4, 1.8).hit, 'masonry wing must be solid');
    }
    for (const c of [...world.colliders.all].filter(c => c.y0 < group.position.y - 1)) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const [dx, dz] = world.colliders._world(c, sx * c.hw, sz * c.hd);
        assert.ok(c.y0 <= world.terrain.heightAt(c.x + dx, c.z + dz), 'footing reaches terrain');
      }
    }
    let meshes = 0;
    group.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
    });
    assert.ok(meshes <= 3, 'ornament stays batched into shared material layers');
  });
}
