import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { SALTREACH_RAMPS } from '../src/data/saltreach.js';
import { NPCS } from '../src/data/world.js';

// Saltreach's civic pieces on the real terrain with everything around them, walked by their colliders.
const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [], interactables: [],
  addLight() {}, addInteract(it) { this.interactables.push(it); }, addEmitter() {},
};
world.terrain.build();
buildStructures(world);

const floorAt = (x, z, y) => Math.max(world.terrain.heightAt(x, z), world.colliders.groundAt(x, z, y + 0.55));

// Walk a polyline at a 0.15 m pace: never blocked, never a step over 0.55 m, never a fall.
// Returns the height the walk ends at and the largest single step it took.
function walk(points, label, y = floorAt(points[0].x, points[0].z, 1e9)) {
  let step = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15);
    for (let j = 1; j <= n; j++) {
      const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n;
      const g = floorAt(x, z, y);
      assert.ok(g > y - 0.6, `${label}: the floor gives way at ${x.toFixed(1)}, ${z.toFixed(1)} (${y.toFixed(2)} -> ${g.toFixed(2)})`);
      const actor = new THREE.Vector3(x, g + 0.02, z);
      world.colliders.resolve(actor, 0.4, 1.8);
      assert.ok(Math.hypot(actor.x - x, actor.z - z) < 0.06, `${label}: blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      step = Math.max(step, g - y);
      y = g;
    }
  }
  return { y, step };
}

test('the Crucible is entered by the Gate of Trials and its stands are climbed from the open side', () => {
  const a = world.arena;
  assert.ok(a && a.routes, 'the Crucible records its routes');
  const gate = walk(a.routes.gate, 'Gate of Trials');
  assert.ok(Math.abs(gate.y - a.y) < 0.1, 'the gate opens onto the sand');
  const stands = walk(a.routes.stands, 'the stands');
  assert.ok(stands.y > a.y + 4, 'the stair and tiers reach the promenade');
  // the trials' own points: the start on the sand, the healers' exit outside the wall
  const at = (ang, r) => ({ x: a.x + Math.sin(ang) * r, z: a.z + Math.cos(ang) * r });
  const start = at(a.gap, a.r * 0.45), out = at(a.gap, a.r + 5);
  assert.ok(Math.abs(world.colliders.groundAt(start.x, start.z, a.y + 6) - a.y) < 0.05, 'a trial starts on the sand');
  assert.ok(world.colliders.groundAt(out.x, out.z, a.y + 6) < a.y + 0.3, 'the fallen are laid outside on open ground');
  const vorn = NPCS.find(n => n.id === 'vorn');
  assert.ok(Math.hypot(vorn.x - out.x, vorn.z - out.z) < 7, 'the Pitmaster waits at his gate');
});

test("the Vowkeeper's Perch is climbed from the North Way to the vow stone", () => {
  const stair = world.approaches.find(p => p.id === 'vow_stair');
  assert.ok(stair, 'the Perch stair is recorded');
  const lane = [{ x: 2.6, z: 106 }, { x: 9, z: 111 }, { x: 16.4, z: 112 }];
  const r = walk([...lane, ...stair.route], "the Perch stair");
  assert.ok(r.y > 24, 'the walk ends on the rotunda floor');
  assert.ok(r.step <= 0.32, `no riser on the way up is higher than 0.3 m (${r.step.toFixed(2)})`);
});

test('the stairs between the wards climb on risers of at most 0.3 m', () => {
  for (const s of SALTREACH_RAMPS) {
    const len = Math.hypot(s.x2 - s.x, s.z2 - s.z), ux = (s.x2 - s.x) / len, uz = (s.z2 - s.z) / len;
    for (const off of [-s.w / 3, 0, s.w / 3]) {
      const p = (t) => ({ x: s.x + ux * t - uz * off, z: s.z + uz * t + ux * off });
      const r = walk([p(-1.2), p(len + 1.2)], `stair ${s.x},${s.z}`);
      assert.ok(Math.abs(r.y - s.y2) < 0.4, `the stair at ${s.x},${s.z} reaches its terrace (${r.y.toFixed(2)})`);
      assert.ok(r.step <= 0.32, `the stair at ${s.x},${s.z} keeps its risers low (${r.step.toFixed(2)})`);
    }
  }
});

test('the Lantern Tree is reached up its plinth from every side of the plaza', () => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const r = walk([{ x: Math.sin(a) * 10.2, z: 5 + Math.cos(a) * 10.2 }, { x: Math.sin(a) * 6.7, z: 5 + Math.cos(a) * 6.7 }], `plinth ${i}`);
    assert.ok(r.step <= 0.32, `plinth steps are a single riser (${r.step.toFixed(2)})`);
  }
});
