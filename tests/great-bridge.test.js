import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildGreatBridge } from '../src/world/greatBridge.js';
import { SWIM_Y } from '../src/entities/actor.js';
import { regionOffset } from '../src/data/worldPlacement.js';
import { LOCATIONS, CHESTS, ISLANDS } from '../src/data/world.js';
import { LORE_BY_ID } from '../src/data/lore.js';
import { MONUMENTS, AQUEDUCTS, COLONNADES, COLLAPSED_TOWERS, OVERLOOKS, VALLEY_FOG, VISTA_SHOTS } from '../src/data/vistas.js';
import {
  GREAT_BRIDGE as B, ARCH_PIERS, ARCH_BAYS, ARCH_BAY, ARCH_LENGTH, archPoint,
  ARCHES_STRUCTURES, ARCHES_LOCATIONS, ARCHES_SPAWNERS, ARCHES_CHESTS, ARCHES_NOTICE, ARCHES_FOG, ARCHES_SHOTS,
} from '../src/data/greatBridge.js';
import { HIGHTOLL_LOCATIONS } from '../src/data/hightoll.js';

const world = {
  scene: new THREE.Scene(),
  terrain: new Terrain(),
  colliders: new Colliders(),
  animated: [],
  interactables: [],
  loreTablets: [],
  addLight() {},
  addInteract(entry) { this.interactables.push(entry); return entry; },
};
world.terrain.build();
const exclusions = [];
const bridge = buildGreatBridge(world, exclusions);
const ground = (x, z, maxY) => Math.max(world.terrain.heightAt(x, z), world.colliders.groundAt(x, z, maxY, 0.2));

test('the plan has a pier for every bay boundary and a state for every bay', () => {
  assert.equal(ARCH_PIERS.length, B.bays + 1);
  assert.equal(ARCH_BAYS.length, B.bays);
  assert.ok(ARCH_BAY > B.pierW + 20, 'arches keep a wide clear span');
  assert.equal(bridge.chunks.length, Math.ceil(ARCH_PIERS.length / 4));
});

test('the Arches keep their own ground: clear of every other vista and of the towns', () => {
  const near = (x, z, r) => {
    for (let a = 0; a <= ARCH_LENGTH; a += 8) {
      const [px, pz] = archPoint(a, 0);
      if (Math.hypot(px - x, pz - z) < r) return true;
    }
    return false;
  };
  for (const m of MONUMENTS) assert.ok(!near(m.x, m.z, (m.exclude || 20) + 25), `${m.name} is too close to the Arches`);
  for (const a of AQUEDUCTS) for (const [x, z] of [[a.x0, a.z0], [a.x1, a.z1]]) assert.ok(!near(x, z, 25), `${a.id} is too close`);
  for (const c of [...COLONNADES, ...COLLAPSED_TOWERS, ...OVERLOOKS]) assert.ok(!near(c.x, c.z, 25), `ruin at ${c.x}, ${c.z} is too close`);
  // Hightoll stands at the Arches' north end on purpose: its places are the Arches' own ground
  const own = new Set([...ARCHES_LOCATIONS, ...HIGHTOLL_LOCATIONS].map((l) => l.name));
  for (const l of LOCATIONS) {
    if (own.has(l.name) || l.r > 80) continue;
    assert.ok(!near(l.x, l.z, l.r + 10), `${l.name} is under the Arches`);
  }
});

test('everything of the Arches is authored in final coordinates and stays on Shimmerfen', () => {
  const points = [
    [B.x0, B.z0], [B.x1, B.z1], ...ARCHES_STRUCTURES.map((s) => [s.x, s.z]), ...ARCHES_LOCATIONS.map((l) => [l.x, l.z]),
    ...ARCHES_SPAWNERS.map((s) => [s.x, s.z]), ...ARCHES_CHESTS.map((c) => [c.x, c.z]), [ARCHES_NOTICE.x, ARCHES_NOTICE.z],
  ];
  for (const [x, z] of points) assert.deepEqual(regionOffset(x, z), [0, 0], `${x}, ${z} would be moved by world placement`);
  const camp = ARCHES_STRUCTURES.find((s) => s.type === 'campfire');
  assert.ok(world.terrain.heightAt(camp.x, camp.z) > 0.8, 'the camp at the foot is dry');
  assert.ok(world.terrain.heightAt(ARCHES_NOTICE.x, ARCHES_NOTICE.z) > 0.5, 'the notice post is dry');
});

test('the Arch Mere is wadeable everywhere around the piers', () => {
  // Shimmerfen shares Saltreach's terrain, so its zones are carried by the merged island.
  const meres = ISLANDS.flatMap((i) => i.zones || []).filter((zn) => zn.sink && zn.depth);
  assert.ok(meres.length >= 3, 'the mere zones reach the terrain');
  for (const zn of meres) {
    for (let dx = -zn.r * 0.75; dx <= zn.r * 0.75; dx += 6) {
      for (let dz = -zn.r * 0.75; dz <= zn.r * 0.75; dz += 6) {
        if (Math.hypot(dx, dz) > zn.r * 0.75) continue;
        const h = world.terrain.heightAt(zn.x + dx, zn.z + dz);
        assert.ok(h > SWIM_Y - 0.45, `the mere is swim-deep at ${(zn.x + dx).toFixed(0)}, ${(zn.z + dz).toFixed(0)} (h=${h.toFixed(2)})`);
      }
    }
  }
  // and it is really water under the standing arches, not dry fen (the south approach
  // is the Arches' Foot hill, so sampling starts past the crest)
  let wet = 0, n = 0;
  for (let a = ARCH_BAY * 5; a <= ARCH_BAY * 12; a += 5) {
    const [x, z] = archPoint(a, 22);
    n++;
    if (world.terrain.heightAt(x, z) < -0.3) wet++;
  }
  assert.ok(wet / n > 0.75, `only ${wet}/${n} samples beside the piers are under water`);
});

test('the Arches\' Foot hill carries a walker from the fen to the end of the south road', () => {
  let prev = null;
  let worst = 0;
  const end = ARCH_BAY * 7 + B.pierW / 2 + 3.5;
  for (let a = -20; a <= end; a += 0.4) {
    const [x, z] = archPoint(a, 0);
    const g = prev == null ? world.terrain.heightAt(x, z) : ground(x, z, prev + 0.6);
    if (prev != null) worst = Math.max(worst, g - prev);
    prev = g;
  }
  assert.ok(worst < 0.65, `a step of ${worst.toFixed(2)} m is too tall to walk up`);
  assert.ok(Math.abs(prev - B.deck) < 0.05, `the walk ends on the road at deck height (got ${prev})`);
  // the parapets keep a walker on the road
  const [px, pz] = archPoint(ARCH_BAY * 5.5, B.width / 2 - 0.4);
  assert.ok(ground(px, pz, B.deck + 2) > B.deck + 0.9, 'parapet stands along the road');
});

test('the chest and the service plate sit on the road where it ends', () => {
  const chest = CHESTS.find((c) => c.id === ARCHES_CHESTS[0].id);
  assert.ok(chest, 'the chest is registered with the world');
  assert.equal(chest.y, B.deck);
  assert.equal(world.colliders.groundAt(chest.x, chest.z, B.deck + 1), B.deck, 'road under the chest');
  const plate = world.interactables.find((i) => i.id === 'lore_arches_service_plate');
  assert.ok(plate, 'plate interaction');
  assert.equal(world.colliders.groundAt(plate.pos.x, plate.pos.z, B.deck + 1), B.deck, 'road in front of the plate');
  assert.ok(LORE_BY_ID.arches_service_plate && LORE_BY_ID.arches_covenant_notice, 'both sources are registered');
  assert.ok(world.loreTablets.some((t) => t.lore.id === 'arches_service_plate'), 'the plate updates its revisit label');
});

test('piers standing in water stand on shoals, so hulls ground instead of sailing through', () => {
  for (let i = 0; i < ARCH_PIERS.length; i++) {
    for (const side of [-B.width / 2 - 2, 0, B.width / 2 + 2]) {
      const [x, z] = archPoint(ARCH_BAY * i, side);
      assert.ok(world.terrain.heightAt(x, z) > -0.8, `pier ${i} stands in navigable water`);
    }
  }
});

test('mist, cameras and colliders register with the feature', () => {
  for (const f of ARCHES_FOG) assert.ok(VALLEY_FOG.includes(f), 'mist registered');
  for (const [id, shot] of Object.entries(ARCHES_SHOTS)) {
    assert.equal(VISTA_SHOTS[id], shot);
    assert.ok(shot.y > world.terrain.heightAt(shot.x, shot.z), `${id} camera is under the ground`);
  }
  for (const c of world.colliders.all) for (const key of ['x', 'z', 'y0', 'y1']) assert.ok(Number.isFinite(c[key]), `collider ${key}`);
  assert.ok(exclusions.length > 20, 'vegetation is kept off the piers and the approach');
  world.scene.traverse((o) => {
    if (o.isMesh) assert.ok(o.geometry.attributes.position.count > 0 && Number.isFinite(o.geometry.boundingSphere.radius), o.name);
  });
});
