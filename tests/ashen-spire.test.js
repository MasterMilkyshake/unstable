import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { buildRuinscapes } from '../src/world/ruinscapes.js';
import { samplePath } from '../src/world/paths.js';
import { ISLANDS, REGIONS, STRUCTURES, LOCATIONS, islandAtPoint, regionAtPoint, biomeOfPoint } from '../src/data/world.js';
import { ROADS } from '../src/data/roads.js';
import { WORLD_LAYOUT, ASHEN_SPIRE_MOVE, migrateWorldPosition } from '../src/data/worldPlacement.js';

const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [], interactables: [], loreTablets: [],
  addLight() {}, addInteract(it) { this.interactables.push(it); return it; }, addEmitter() {},
};
world.terrain.build();
const exclusions = [];
buildStructures(world);
buildRuinscapes(world, exclusions);
const H = (x, z) => world.terrain.heightAt(x, z);
const at = (name) => LOCATIONS.find((l) => l.name === name);
const thorn = ISLANDS.find((i) => i.id === 'thornwood');

test('the Ashen Spire stands on Thornwood and Meridian\'s continent and keeps its own region', () => {
  assert.ok(!ISLANDS.some((i) => i.id === 'ashen_spire'), 'no separate Ashen Spire landmass');
  for (const name of ['Cinderstead', 'The Caldera', 'The Emberwood', 'Meridian Garrison']) {
    const l = at(name);
    assert.equal(islandAtPoint(l.x, l.z)?.island.id, 'thornwood', `${name} is on the continent`);
  }
  for (const name of ['Cinderstead', 'The Caldera', 'The Emberwood']) {
    const l = at(name);
    assert.equal(regionAtPoint(l.x, l.z)?.id, 'ashen_spire', `${name} is in the Ashen Spire`);
  }
  const garrison = at('Meridian Garrison');
  assert.equal(regionAtPoint(garrison.x, garrison.z)?.id, 'meridian');
  // on Meridian's right (east, -x) on the chart, and south of the Wash
  const spire = REGIONS.find((r) => r.id === 'ashen_spire'), meridian = REGIONS.find((r) => r.id === 'meridian');
  assert.ok(spire.cx < meridian.cx - 400, 'east of Meridian');
  assert.ok(spire.cz < -900, 'south of Saltreach');
});

test('one coast runs from Meridian to the volcano: dry land the whole way, no strait', () => {
  const road = samplePath(ROADS.find((r) => r.id === 'ember_road'), 2);
  for (const p of road) assert.ok(H(p.x, p.z) > 0.4, `dry at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
  // the land bridge is broad: across the Emberwood it runs well over 300 m from shore to shore
  const [cx, cz] = [880, -960], [ux, uz] = [Math.SQRT1_2, -Math.SQRT1_2];
  let width = 0;
  for (let t = -300; t <= 300; t += 5) if (H(cx + ux * t, cz + uz * t) > 0.4) width += 5;
  assert.ok(width > 300, `the saddle is ${width} m across`);
});

test('bare ash on the cone, half-grown lava fields, and woods that run on into Meridian\'s', () => {
  const caldera = at('The Caldera');
  assert.equal(biomeOfPoint(thorn, caldera.x, caldera.z), 'volcanic');
  assert.equal(biomeOfPoint(thorn, 600, -1080), 'ashfield');
  for (const [x, z] of [[900, -950], [470, -880], [800, -1140]]) {
    assert.ok(['emberwood', 'forest', 'bastion'].includes(biomeOfPoint(thorn, x, z)), `woods or Meridian's ground at ${x}, ${z}`);
  }
  assert.equal(biomeOfPoint(thorn, 760, -1020) === 'volcanic', false, 'no bare ash on the saddle');
});

test('the Ember Road walks from Meridian\'s Dock Road to Cinderstead, over the overflow on a bridge', () => {
  const road = ROADS.find((r) => r.id === 'ember_road');
  const samples = samplePath(road, 0.4);
  let y = H(samples[0].x, samples[0].z), worst = 0, worstAt = null;
  for (const { x, z } of samples) {
    const g = Math.max(H(x, z), world.colliders.groundAt(x, z, y + 0.6, 0.2));
    if (g - y > worst) { worst = g - y; worstAt = [x, z]; }
    const p = new THREE.Vector3(x, g + 0.02, z);
    world.colliders.resolve(p, 0.4, 1.8);
    assert.ok(Math.hypot(p.x - x, p.z - z) < 0.05, `blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    for (const hz of world.hazards) {
      assert.ok(Math.hypot(hz.x - x, hz.z - z) > hz.r || g > hz.y + 0.9, `lava underfoot at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    }
    y = g;
  }
  assert.ok(worst < 0.65, `a step of ${worst.toFixed(2)} m at ${worstAt?.map((v) => v.toFixed(0))} is too tall to walk up`);
  const cinderstead = at('Cinderstead');
  const end = samples[samples.length - 1];
  assert.ok(Math.hypot(end.x - cinderstead.x, end.z - cinderstead.z) < cinderstead.r, 'the road ends in Cinderstead');
});

test('Meridian\'s docks still look out on open water', () => {
  const dock = STRUCTURES.find((s) => s.id === 'dock_meridian');
  const ux = Math.sin(dock.yaw), uz = Math.cos(dock.yaw);
  for (let d = dock.len + 10; d < 260; d += 10) {
    const h = H(dock.x + ux * d, dock.z + uz * d);
    assert.ok(h < -1, `the approach is ${h.toFixed(1)} m deep at ${d} m out`);
  }
});

test('characters on the old Ashen Spire follow it to Meridian\'s coast', () => {
  const cinderstead = at('Cinderstead');
  const before = { x: cinderstead.x - ASHEN_SPIRE_MOVE[0], z: cinderstead.z - ASHEN_SPIRE_MOVE[1] };
  const layout3 = { worldLayout: 3, pos: { ...before, y: 5 }, spawn: { x: before.x, z: before.z, id: 'cf_ash' }, contracts: { held: [{ x: 0, z: -320 }] } };
  migrateWorldPosition(layout3);
  assert.equal(layout3.worldLayout, WORLD_LAYOUT);
  assert.ok(Math.hypot(layout3.pos.x - cinderstead.x, layout3.pos.z - cinderstead.z) < 1e-9, 'standing in Cinderstead');
  assert.ok(Math.hypot(layout3.spawn.x - cinderstead.x, layout3.spawn.z - cinderstead.z) < 1e-9, 'resting at Cinderstead');
  assert.deepEqual(layout3.contracts.held[0], { x: 0, z: -320 }, 'the Wash stays where it is');
  // a layout-2 save still holds authored coordinates and is placed straight at the new coast
  const layout2 = { worldLayout: 2, pos: { x: 681, z: 754 } };
  migrateWorldPosition(layout2);
  assert.ok(Math.hypot(layout2.pos.x - cinderstead.x, layout2.pos.z - cinderstead.z) < 1e-9);
  // and nothing moves twice
  const again = { ...layout3, pos: { ...layout3.pos } };
  assert.equal(migrateWorldPosition(again), false);
});
