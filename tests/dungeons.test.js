import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { buildAdventure } from '../src/world/adventure.js';
import { buildDungeons } from '../src/world/dungeons.js';
import { DUNGEONS, DUNGEON_ENEMIES, roomById, roomPoint, roomRect, inDungeonBand } from '../src/data/dungeons.js';
import { LANDFORMS } from '../src/data/landforms.js';
import { ENEMIES } from '../src/data/enemies.js';
import { SPAWNERS, CHESTS } from '../src/data/world.js';
import { LORE } from '../src/data/lore.js';
import { carrierOf } from '../src/world/landmarks.js';

const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [], interactables: [],
  addLight() {}, addInteract(it) { this.interactables.push(it); }, addEmitter() {},
  groundAt(x, z, maxY = 1e4) { return Math.max(this.terrain.heightAt(x, z), this.colliders.groundAt(x, z, maxY)); },
  sky: { update() {}, sun: { intensity: 1, color: new THREE.Color() }, hemi: { intensity: 1, color: new THREE.Color(), groundColor: new THREE.Color() } },
};
world.terrain.build();
const exclusions = buildStructures(world);
buildAdventure(world, exclusions);
buildDungeons(world, exclusions);

// Walk like the player: step up at most 0.55 m, never through a wall.
function walk(points, y0, message) {
  let y = y0;
  for (const [x, z] of points) {
    y = world.groundAt(x, z, y + 0.55);
    assert.ok(y > 200, `${message}: floor under ${x.toFixed(1)}, ${z.toFixed(1)}`);
    const p = new THREE.Vector3(x, y + 0.02, z);
    world.colliders.resolve(p, 0.4, 1.8);
    assert.ok(Math.hypot(p.x - x, p.z - z) < 0.05, `${message}: blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  return y;
}
const line = (a, b, step = 0.3) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
};
function opening(dg, a, b) {
  const ra = roomRect(dg, roomById(dg, a)), rb = roomRect(dg, roomById(dg, b));
  if (Math.abs(ra.z1 - rb.z0) < 0.01 || Math.abs(rb.z1 - ra.z0) < 0.01) {
    const z = Math.abs(ra.z1 - rb.z0) < 0.01 ? ra.z1 : ra.z0;
    return [(Math.max(ra.x0, rb.x0) + Math.min(ra.x1, rb.x1)) / 2, z];
  }
  const x = Math.abs(ra.x1 - rb.x0) < 0.01 ? ra.x1 : ra.x0;
  return [x, (Math.max(ra.z0, rb.z0) + Math.min(ra.z1, rb.z1)) / 2];
}

test('the dungeons lie underground, out of the way of the surface and the Rift', () => {
  for (const dg of DUNGEONS) assert.ok(inDungeonBand(dg.origin.x, dg.origin.z), dg.id);
  assert.ok(!inDungeonBand(0, 0) && !inDungeonBand(6000, 6000) && !inDungeonBand(-1000, 1400));
  for (let i = 0; i < DUNGEONS.length; i++) for (let j = i + 1; j < DUNGEONS.length; j++) {
    assert.ok(Math.hypot(DUNGEONS[i].origin.x - DUNGEONS[j].origin.x, DUNGEONS[i].origin.z - DUNGEONS[j].origin.z) > 400, 'far enough apart that their spawners and lights never mix');
  }
});

test('every dungeon has a way down on dry surface ground off the mountain ranges, and a way back up', () => {
  const ranges = Object.values(LANDFORMS).flat().filter((l) => l && l.kind === 'range' && l.points);
  for (const e of world.dungeons) {
    const s = e.surface;
    assert.ok(s && s.at.y > 1.5, `${e.dungeon.id} has an entrance above the sea`);
    for (const r of ranges) for (let i = 1; i < r.points.length; i++) {
      const [ax, az] = r.points[i - 1], [bx, bz] = r.points[i];
      const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((s.at.x - ax) * vx + (s.at.z - az) * vz) / (vx * vx + vz * vz)));
      assert.ok(Math.hypot(s.at.x - ax - vx * t, s.at.z - az - vz * t) > r.w / 2, `${e.dungeon.id} entrance is not on a range`);
    }
    assert.ok(Math.abs(s.out.y - world.terrain.heightAt(s.out.x, s.out.z)) < 1.5, `${e.dungeon.id} sets you down on the ground outside`);
    assert.ok(world.interactables.some((i) => i.id === `enter_${e.dungeon.id}`));
    assert.ok(world.interactables.some((i) => i.id === `exit_${e.dungeon.id}`));
  }
});

test('every room can be walked into from the start, and gates hold until their lever is pulled', () => {
  for (const dg of DUNGEONS) {
    const entry = world.dungeons.find((e) => e.dungeon === dg);
    for (const [a, b, opt = {}] of dg.links) {
      const pa = roomPoint(dg, roomById(dg, a)), pb = roomPoint(dg, roomById(dg, b));
      const o = opening(dg, a, b);
      const route = [...line([pa.x, pa.z], o), ...line(o, [pb.x, pb.z])];
      if (opt.gate) {
        assert.throws(() => walk(route, pa.y, `${dg.id} ${a}→${b}`), /blocked/, `${opt.gate} is shut at first`);
        const lever = world.interactables.find((i) => i.id === `lever_${dg.id}_${opt.gate}`);
        assert.ok(lever && lever.enabled(), 'its lever can be pulled');
        lever.use();
        assert.ok(!lever.enabled(), 'and stays pulled');
      }
      walk(route, pa.y, `${dg.id} ${a}→${b}`);
      walk([...route].reverse(), pb.y, `${dg.id} ${b}→${a}`);
    }
    assert.ok(Object.values(entry.gates).every((g) => g.open), 'every gate opened by its lever');
  }
});

test('enemies, chests and records stand on the floors of their rooms', () => {
  for (const sp of SPAWNERS.filter((s) => s.dungeon)) {
    assert.ok(ENEMIES[sp.type], sp.type);
    const g = world.groundAt(sp.x, sp.z, 400);
    assert.ok(g > 290 && g < 305, `${sp.type} spawns on a floor, not the roof (${g})`);
  }
  for (const c of CHESTS.filter((c) => c.dungeon)) assert.ok(Math.abs(world.groundAt(c.x, c.z, c.y + 0.5) - c.y) < 0.05, `${c.id} rests on its floor`);
  for (const l of LORE.filter((l) => l.dungeon)) {
    assert.ok(Math.abs(world.groundAt(l.x, l.z, l.y + 0.5) - l.y) < 0.05, `${l.id} rests on its floor`);
    assert.ok(['letter', 'notice', 'carving', 'book'].includes(carrierOf(l)));
  }
  for (const [id, def] of Object.entries(DUNGEON_ENEMIES)) assert.ok(def.boss && SPAWNERS.some((s) => s.type === id && s.boss && s.respawn === 0), `${id} is a one-time boss`);
});

test('dungeon geometry is finite', () => {
  world.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    assert.ok(o.geometry.attributes.position.array.every(Number.isFinite), o.name);
  });
});
