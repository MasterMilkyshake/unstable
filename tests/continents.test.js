import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import * as WORLD from '../src/data/world.js';
import { GREAT_BRIDGE as B, ARCH_BAY, archPoint } from '../src/data/greatBridge.js';
import { inSightline } from '../src/data/vistas.js';

const { STRUCTURES, FERRY_ROUTES, FERRY_NPCS, LOCATIONS, START_POS, regionAtPoint } = WORLD;
const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [], interactables: [], loreTablets: [],
  addLight() {}, addInteract(it) { this.interactables.push(it); return it; }, addEmitter() {},
};
world.terrain.build();
buildStructures(world);
const H = (x, z) => world.terrain.heightAt(x, z);
// the first point along a line lower than `floor` (dry land by default), or null
const dryLine = (x0, z0, x1, z1, floor = 0.3, step = 5) => {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
    if (H(x, z) < floor) return [x, z];
  }
  return null;
};

test('the Ashen Spire meets Meridian along its whole flank, and the old harbour is dry', () => {
  // north coast to south coast through the Emberwood, without a strait
  assert.equal(dryLine(900, -470, 900, -1260), null, 'dry from Meridian\'s north shore to the south shore');
  for (const [x, z] of [[900, -600], [960, -680], [850, -560]]) assert.ok(H(x, z) > 0.3, `the old harbour at ${x}, ${z} is land`);
  assert.equal(regionAtPoint(940, -520)?.id, 'meridian', 'the silted harbour is Meridian\'s');
  assert.equal(regionAtPoint(600, -560)?.id, 'ashen_spire', 'the woods north to the Ember Head are the Ashen Spire\'s');
});

test('Meridian\'s port stands on the north coast at the end of the Dock Road', () => {
  const dock = STRUCTURES.find((s) => s.id === 'dock_meridian');
  const docks = LOCATIONS.find((l) => l.name === 'Meridian Docks');
  assert.ok(Math.hypot(dock.x - docks.x, dock.z - docks.z) < docks.r, 'the docks are named where the dock is');
  for (const g of STRUCTURES.filter((s) => s.type === 'galleon')) assert.ok(H(g.x, g.z) < -3, `${g.name} rides at anchor in deep water`);
});

test('Shimmerfen runs on from Saltreach without an inlet, and keeps no port', () => {
  // the fen keeps its knee-deep meres; what is gone is the sea
  assert.equal(dryLine(-300, -330, -560, -330, -1.4), null, 'no sea between the Seamspire Rise and the fen');
  assert.equal(dryLine(-330, -420, -470, -520, -1.4), null, 'the bay head is silted');
  assert.ok(!STRUCTURES.some((s) => s.id === 'dock_fen'), 'no Shimmerfen dock');
  assert.ok(!FERRY_ROUTES.some((r) => r.id === 'dock_fen') && !Object.values(FERRY_NPCS).includes('dock_fen'), 'no ferry calls there');
});

test('the Hush runs into Frosthollow without a notch on the east coast', () => {
  assert.equal(dryLine(-1500, 1150, -1560, 1500), null, 'dry up the east coast from the moor to the snow');
});

test('no whirlpools: the Crown Sluice under Meridian\'s drydock is the living way down', () => {
  assert.equal(WORLD.WHIRLPOOLS, undefined);
  const sluice = STRUCTURES.find((s) => s.type === 'crown_sluice');
  assert.ok(sluice, 'the sluice stands in the world');
  const drydock = LOCATIONS.find((l) => l.name === 'The Crown Drydock');
  assert.ok(Math.hypot(sluice.x - drydock.x, sluice.z - drydock.z) < drydock.r, 'beside the drydock');
  const way = world.interactables.find((i) => i.kind === 'sluice');
  assert.ok(way && typeof way.use === 'function', 'it can be used');
  assert.ok(H(way.pos.x, way.pos.z) > 0, 'from the shore');
});

test('the Hundred Arches stand on the skyline from the Wash where the drowned wake', () => {
  const eye = new THREE.Vector3(START_POS.x, H(START_POS.x, START_POS.z) + 1.7, START_POS.z);
  assert.ok(eye.y > 10, 'the Wash is raised above the strand');
  let seen = 0;
  for (let i = 3; i <= 12; i++) {
    const [x, z] = archPoint(ARCH_BAY * i);
    const top = new THREE.Vector3(x, B.deck - 6, z);
    let clear = true;
    for (let t = 0.04; t < 0.96 && clear; t += 0.01) {
      const p = eye.clone().lerp(top, t);
      if (H(p.x, p.z) > p.y) clear = false;
    }
    if (clear) seen++;
    // tall enough at its distance to read from the Wash: the deck stands 3.5° or more over the eye
    assert.ok((B.deck - eye.y) / Math.hypot(x - eye.x, z - eye.z) > 0.061, `pier ${i} is close enough to read`);
  }
  assert.ok(seen >= 8, `only ${seen} of the standing piers clear the ground from the Wash`);
  // and no tall tree grows across the view
  assert.ok(inSightline(...archPoint(ARCH_BAY * 7).map((v, k) => (k ? (v + eye.z) / 2 : (v + eye.x) / 2))));
});
