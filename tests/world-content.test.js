import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { ARCHITECTURE } from '../src/data/architecture.js';
import { STRUCTURES, LOCATIONS, islandAtPoint, regionAtPoint } from '../src/data/world.js';
import { ROADS } from '../src/data/roads.js';
import { samplePath } from '../src/world/paths.js';
import { ACTIONS } from '../src/game/hooks.js';
import '../src/ui/worldmap.js';

const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [],
  interactables: [], addLight() {}, addInteract(it) { this.interactables.push(it); }, addEmitter() {},
};
world.terrain.build();
buildStructures(world);

test('the Wash shelter sits with the campfire, not in an empty field', () => {
  const shelter = ARCHITECTURE.find(s => s.id === 'wash_shelter');
  const fire = STRUCTURES.find(s => s.id === 'cf_wash');
  assert.ok(shelter && fire);
  assert.ok(Math.hypot(shelter.x - fire.x, shelter.z - fire.z) < 20, 'pavilion should share the camp');
  assert.ok(world.architecture.some(a => a.id === 'wash_shelter' && a.group.name === shelter.name));
});

test('huts are framed dwellings, not leftover solid boxes with cone roofs', () => {
  const huts = [];
  world.scene.traverse(o => { if (o.name === 'hut') huts.push(o); });
  assert.ok(huts.length >= 3, 'marsh and verdance huts still exist');
  for (const hut of huts) {
    hut.traverse(o => {
      if (!o.isMesh || !o.geometry?.parameters) return;
      const p = o.geometry.parameters;
      assert.ok(!(p.width === 4.4 && p.height === 2.4 && p.depth === 4.4), 'fallback box must be gone');
      assert.ok(!(o.geometry.type === 'ConeGeometry' && Math.abs((p.radius || 0) - 3.8) < 0.05), 'fallback cone roof must be gone');
    });
  }
});

test('the illustrated world map hook is registered', () => {
  assert.equal(typeof ACTIONS.openWorldMap, 'function');
});

test('the Hush lies on Frosthollow’s southern shore: one coast, its own region, a road between', () => {
  const place = (name) => LOCATIONS.find(l => l.name === name);
  const house = place('The Sounding House'), frostwatch = place('Frostwatch Village');
  for (const p of [house, frostwatch]) assert.equal(islandAtPoint(p.x, p.z).island.id, 'frosthollow', p.name);
  assert.equal(regionAtPoint(house.x, house.z).id, 'the_hush');
  assert.equal(regionAtPoint(frostwatch.x, frostwatch.z).id, 'frosthollow');
  // the Rime Road leaves the White Pass and meets the Sounding Way, on dry ground all the way
  const near = (road, [x, z], r) => ROADS.find(w => w.id === road).points.some(p => Math.hypot(p[0] - x, p[1] - z) < r);
  const rime = ROADS.find(r => r.id === 'rime_road');
  assert.ok(near('white_pass', rime.points[0], 1), 'the Rime Road leaves the White Pass');
  assert.ok(near('sounding_way', rime.points.at(-1), 8), 'the Rime Road meets the Sounding Way');
  for (const p of samplePath(rime, 4)) assert.ok(world.terrain.heightAt(p.x, p.z) > 0.8, `the Rime Road is dry at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
});

test('every roaming pack ranges dry, open country, clear of towns, roads and buildings', async () => {
  const { ROAMING_SPAWNERS } = await import('../src/data/roaming.js');
  const { ENEMIES } = await import('../src/data/enemies.js');
  for (const s of ROAMING_SPAWNERS) {
    const at = `${s.type} at ${s.x}, ${s.z}`;
    const roam = ENEMIES[s.type].roam;
    let lo = Infinity, hi = -Infinity;
    for (const r of [0, roam / 2, roam]) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const h = world.terrain.heightAt(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    assert.ok(lo > 1.2, `${at}: dry for ${roam} m round (lowest ${lo.toFixed(1)} m)`);
    assert.ok(hi - lo < 12, `${at}: gentle ground (${(hi - lo).toFixed(1)} m of relief)`);
    assert.ok(world.colliders.query(s.x, s.z, roam * 0.75, []).length <= 2, `${at}: open, not among buildings`);
    const town = Math.min(...LOCATIONS.map((l) => Math.hypot(l.x - s.x, l.z - s.z)));
    assert.ok(town > 90, `${at}: ${town.toFixed(0)} m from the nearest named place`);
    const isl = world.terrain.islandAt(s.x, s.z);
    assert.ok(!isl.roadAt || isl.roadAt(s.x, s.z).d > 18, `${at}: off the roads`);
  }
});
