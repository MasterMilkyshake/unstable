import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildHightoll } from '../src/world/hightoll.js';
import { buildGreatBridge } from '../src/world/greatBridge.js';
import { buildCarrierLines } from '../src/world/ziplines.js';
import { G } from '../src/core/globals.js';
import { ACTIONS } from '../src/game/hooks.js';
import '../src/game/ziplines.js';
import { regionOffset } from '../src/data/worldPlacement.js';
import { SPAWNERS, LOCATIONS, CHESTS, STRUCTURES } from '../src/data/world.js';
import { ENEMIES } from '../src/data/enemies.js';
import { MANTRAS } from '../src/data/mantras.js';
import { WEAPONS } from '../src/data/weapons.js';
import { TRINKET_DROPS } from '../src/data/trinkets.js';
import { LORE_BY_ID } from '../src/data/lore.js';
import { VISTA_SHOTS } from '../src/data/vistas.js';
import { ARCH_LENGTH, ARCH_BAY, archPoint, GREAT_BRIDGE } from '../src/data/greatBridge.js';
import {
  HIGHTOLL, tollPoint, ROCK_OUTLINE, HIGHTOLL_SPAWNERS, HIGHTOLL_LOCATIONS, HIGHTOLL_CHESTS, HIGHTOLL_LINES, LINE_HANG,
  HIGHTOLL_LORE, HIGHTOLL_REGISTER, HIGHTOLL_SHOTS, HIGHTOLL_STRUCTURES, HIGHTOLL_HOME, HIGHTOLL_LAND_GATE, CARRIER_LINE_NOTICE,
} from '../src/data/hightoll.js';

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
buildGreatBridge(world, exclusions);
const castle = buildHightoll(world, exclusions);
const lines = buildCarrierLines(world, exclusions, HIGHTOLL_LINES);
const TOP = HIGHTOLL.top;
const H = (x, z) => world.terrain.heightAt(x, z);
const ground = (x, z, maxY) => Math.max(H(x, z), world.colliders.groundAt(x, z, maxY, 0.2));
const at = (lx, lz) => tollPoint(lx, lz);

// Anything standing between a walker's knees and head at (x, z), for a body of radius 0.35.
function blockerAt(x, z, foot) {
  for (const c of world.colliders.query(x, z, 0.6, [])) {
    if (c.y1 <= foot + 0.55 || c.y0 >= foot + 1.8) continue;
    if (c.kind === 'box') {
      const [lx, lz] = world.colliders._local(c, x, z);
      if (Math.abs(lx) <= c.hw + 0.35 && Math.abs(lz) <= c.hd + 0.35) return c;
    } else if (Math.hypot(x - c.x, z - c.z) <= c.r + 0.35) return c;
  }
  return null;
}

test('Hightoll stands where the Arches end, its court level with their road', () => {
  const [ex, ez] = archPoint(ARCH_LENGTH, 0);
  const south = Math.min(...ROCK_OUTLINE.map(([x, z]) => Math.hypot(...at(x, z).map((v, i) => v - [ex, ez][i]))));
  assert.ok(south < 20, `the rock rises within a span of the last pier (${south.toFixed(1)} m)`);
  assert.equal(TOP, GREAT_BRIDGE.deck);
  for (const [x, z] of [[0, -30], [-10, -20], [20, 30], [40, 0], [-20, 30]]) assert.equal(H(...at(x, z)), TOP, `the crown is level at ${x}, ${z}`);
});

test('the rock falls sheer to the fen on every side: nothing climbs to Hightoll', () => {
  for (const [x, z] of [[0, -56], [26, -53], [50, -42], [64, -8], [62, 16], [46, 54], [10, 60], [-22, 50], [-40, 2], [-36, -32]]) {
    const h = H(...at(x, z));
    assert.ok(h < 14, `the face at ${x}, ${z} is not sheer (ground ${h.toFixed(1)} m)`);
  }
});

test('the carrier lines run from floor to floor, clear of stone and ground the whole way', () => {
  assert.equal(lines.length, HIGHTOLL_LINES.length);
  for (const { def, curve, interaction } of lines) {
    assert.ok(Math.abs(ground(curve.a.x, curve.a.z, curve.floorA + 1) - curve.floorA) < 0.1, `${def.id} starts on its floor`);
    assert.ok(Math.abs(ground(curve.b.x, curve.b.z, curve.floorB + 1) - curve.floorB) < 0.1, `${def.id} lands on its floor`);
    assert.ok(interaction && interaction.kind === 'zipline' && typeof interaction.use === 'function', `${def.id} can be ridden`);
    const p = new THREE.Vector3();
    for (let t = 0.02; t <= 0.98; t += 0.004) {
      curve.point(t, p);
      const feet = p.y - LINE_HANG;
      assert.ok(H(p.x, p.z) < feet - 0.3, `${def.id} drags the rider through the ground at t=${t.toFixed(3)}`);
      for (const c of world.colliders.query(p.x, p.z, 0.5, [])) {
        if (c.y1 <= feet + 0.05 || c.y0 >= p.y + 0.2) continue;
        const inside = c.kind === 'box'
          ? (([lx, lz]) => Math.abs(lx) <= c.hw + 0.3 && Math.abs(lz) <= c.hd + 0.3)(world.colliders._local(c, p.x, p.z))
          : Math.hypot(p.x - c.x, p.z - c.z) <= c.r + 0.3;
        assert.ok(!inside, `${def.id} runs the rider into masonry at t=${t.toFixed(3)} (${c.y0.toFixed(1)}-${c.y1.toFixed(1)})`);
      }
    }
  }
  // the last line from the Arches lands outside the Bridge Gate, the first starts where the south road ends
  const first = lines.find((l) => l.def.id === 'line_first_break').curve;
  assert.ok(Math.hypot(...first.a.toArray().filter((_, i) => i !== 1).map((v, i) => v - archPoint(ARCH_BAY * 7 + GREAT_BRIDGE.pierW / 2 + 3.2)[i])) < 0.2);
});

test('the north road carries a walker from one line\'s landing to the next line\'s mast', () => {
  const from = lines.find((l) => l.def.id === 'line_lone_pier').curve.b;
  const to = lines.find((l) => l.def.id === 'line_to_hightoll').curve.a;
  let foot = GREAT_BRIDGE.deck;
  const n = Math.ceil(from.distanceTo(to) / 0.3);
  for (let i = 0; i <= n; i++) {
    const x = from.x + (to.x - from.x) * i / n, z = from.z + (to.z - from.z) * i / n;
    const g = ground(x, z, foot + 0.6);
    assert.ok(Math.abs(g - foot) < 0.6, `the deck steps by ${(g - foot).toFixed(2)} m at ${i}/${n}`);
    foot = g;
    assert.equal(blockerAt(x, z, foot), null, `blocked on the north road at ${i}/${n}`);
  }
});

test('a ride carries the rider along the line and sets them down on the landing', () => {
  for (const line of lines) {
    const p = { pos: new THREE.Vector3(line.curve.a.x, line.curve.floorA, line.curve.a.z), vel: new THREE.Vector3(), yaw: 0, fallStart: 0, zip: null, grounded: true };
    G.player = p;
    G.world = world;
    assert.ok(ACTIONS.rideLine(line.def.id), `${line.def.id} takes a rider`);
    assert.equal(line.riding, p);
    let secs = 0;
    while (p.zip && secs < 60) {
      p.zip.step(p, 1 / 60);
      secs += 1 / 60;
    }
    assert.equal(p.zip, null, `${line.def.id} ends`);
    assert.ok(secs > 1 && secs < line.curve.len / line.def.speed + 4, `${line.def.id} takes ${secs.toFixed(1)} s`);
    assert.ok(Math.hypot(p.pos.x - line.curve.b.x, p.pos.z - line.curve.b.z) < 0.1 && Math.abs(p.pos.y - line.curve.floorB) < 0.2, `${line.def.id} sets the rider down on the landing`);
    assert.equal(line.riding, null, 'the trolley is free again');
  }
  G.player = null;
  G.world = null;
});

test('the way from the Land Gate through both courts to the castellan is open', () => {
  const route = [[HIGHTOLL_LAND_GATE.x, 53], [HIGHTOLL_LAND_GATE.x, 38], [-2, 9], [-2, -6], HIGHTOLL_HOME];
  let foot = TOP;
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
    for (let k = 0; k <= n; k++) {
      const lx = ax + (bx - ax) * k / n, lz = az + (bz - az) * k / n;
      const [x, z] = at(lx, lz);
      foot = ground(x, z, foot + 0.6);
      const b = blockerAt(x, z, foot);
      assert.equal(b, null, `blocked at ${lx.toFixed(1)}, ${lz.toFixed(1)} by a collider ${b && `${b.y0.toFixed(1)}-${b.y1.toFixed(1)}`}`);
    }
  }
  assert.ok(Math.abs(foot - TOP) < 0.3, 'the walk stays on the court');
});

test('the Bridge Court is open round the castellan, and the Bridge Gate opens on the drop', () => {
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    for (const r of [3, 7, 11]) {
      const [x, z] = at(HIGHTOLL_HOME[0] + Math.cos(a) * r, HIGHTOLL_HOME[1] + Math.sin(a) * r);
      assert.equal(blockerAt(x, z, TOP), null, `something stands in the fight at ${r} m`);
    }
  }
  // out through the gate onto the road's last metres, which end in the air
  const [gx, gz] = at(0, -50);
  assert.equal(ground(gx, gz, TOP + 1), TOP, 'the broken road reaches past the gate');
  const [fx, fz] = at(0, -58);
  assert.ok(ground(fx, fz, TOP + 1) < 15, 'and then the drop, to the last pier\'s stump far below');
});

test('the castellan, his garrison, his rewards and the castle\'s records are registered', () => {
  for (const s of HIGHTOLL_SPAWNERS) assert.ok(SPAWNERS.includes(s), `${s.type} spawner`);
  const boss = HIGHTOLL_SPAWNERS.find((s) => s.type === 'castellan');
  assert.ok(boss && boss.boss && ENEMIES.castellan.boss, 'the castellan is a boss');
  assert.ok(WEAPONS[ENEMIES.castellan.weapon] && WEAPONS.toll_hammer, 'he carries the Toll Hammer');
  assert.equal(MANTRAS.bell_toll.bell, 'castellan', 'his bell');
  assert.ok(TRINKET_DROPS.castellan.length, 'his seal');
  assert.ok(ENEMIES[ENEMIES.castellan.summons.type], 'the sentries he calls exist');
  for (const l of HIGHTOLL_LOCATIONS) assert.ok(LOCATIONS.includes(l), l.name);
  for (const c of HIGHTOLL_CHESTS) assert.ok(CHESTS.includes(c), c.id);
  for (const s of HIGHTOLL_STRUCTURES) assert.ok(STRUCTURES.includes(s), s.id);
  for (const l of [...HIGHTOLL_LORE, HIGHTOLL_REGISTER, CARRIER_LINE_NOTICE]) assert.ok(LORE_BY_ID[l.id], `${l.id} is a source`);
  assert.ok(world.interactables.some((i) => i.id === 'lore_' + HIGHTOLL_REGISTER.id), 'the crack register can be read');
});

test('everything of Hightoll is in final coordinates, on its rock or its road', () => {
  const points = [...HIGHTOLL_SPAWNERS, ...HIGHTOLL_LOCATIONS, ...HIGHTOLL_CHESTS, ...HIGHTOLL_STRUCTURES, ...HIGHTOLL_LORE].map((p) => [p.x, p.z]);
  for (const [x, z] of points) assert.deepEqual(regionOffset(x, z), [0, 0], `${x}, ${z} would be moved by world placement`);
  const fire = HIGHTOLL_STRUCTURES.find((s) => s.type === 'campfire');
  assert.equal(fire.y, TOP);
  assert.equal(ground(fire.x, fire.z, TOP + 1), TOP, 'the Bridge Gate fire burns on the road outside the gate');
  const [hx, hz] = at(...HIGHTOLL_HOME);
  assert.ok(Math.hypot(fire.x - hx, fire.z - hz) > ENEMIES.castellan.aggro + 4, 'out of the castellan\'s sight');
  const notice = CARRIER_LINE_NOTICE;
  assert.equal(ground(notice.x, notice.z, notice.y + 1), notice.y, 'the line notice stands on the south road');
  for (const l of HIGHTOLL_LORE) assert.equal(H(l.x, l.z), TOP, `${l.id} is on the crown`);
  for (const c of HIGHTOLL_CHESTS) assert.equal(ground(c.x, c.z, TOP + 1), TOP, `${c.id} stands on something`);
});

test('cameras see Hightoll from above the ground, and the bell can toll', () => {
  for (const [id, shot] of Object.entries(HIGHTOLL_SHOTS)) {
    assert.equal(VISTA_SHOTS[id], shot);
    assert.ok(shot.y > H(shot.x, shot.z), `${id} camera is under the ground`);
  }
  assert.ok(exclusions.length > 40, 'vegetation keeps off the rock and the walls');
  castle.toll(0.5);
  for (let i = 0; i < 30; i++) for (const fn of world.animated) fn(i / 60, 1 / 60);
  assert.notEqual(castle.levels[0].bell.rotation.x, 0, 'the bell swings');
  for (const c of world.colliders.all) for (const key of ['x', 'z', 'y0', 'y1']) assert.ok(Number.isFinite(c[key]), `collider ${key}`);
  world.scene.traverse((o) => {
    if (o.isMesh) assert.ok(o.geometry.attributes.position.count > 0 && Number.isFinite(o.geometry.boundingSphere.radius), o.name);
  });
});

test('the crags and the meadow keep off the Reed Road, the descent line and everyone round the rock', async () => {
  const { ROADS } = await import('../src/data/roads.js');
  const { NPCS } = await import('../src/data/world.js');
  const { LORE } = await import('../src/data/lore.js');
  const { HIGHTOLL_CRAGS } = await import('../src/data/hightoll.js');
  const { ADVENTURE_SITES } = await import('../src/data/adventure.js');
  const { pieces } = castle.surrounds;
  assert.ok(pieces.filter((p) => p.kind === 'column').length > 60, 'the crags stand');
  assert.ok(HIGHTOLL_CRAGS.some((d) => d.peak > HIGHTOLL.top + 40), 'a crag rises well over the crown');
  for (const kind of ['chapel', 'tower', 'ruin', 'outcrop', 'tree']) assert.ok(pieces.some((p) => p.kind === kind), `the meadow has its ${kind}`);
  const toSeg = (x, z, [ax, az], [bx, bz]) => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
  };
  const reed = ROADS.find((r) => r.id === 'reed_road').points;
  const descent = HIGHTOLL_LINES.find((l) => l.id === 'line_land_gate');
  const [mx, mz] = tollPoint(12, 0);
  const near = (o) => Math.hypot(o.x - mx, o.z - mz) < 320;
  // the roadside people (Hobb at his crossroads fire) join NPCS when the world settles their
  // sites; their authored anchors are within a few metres of where they settle
  const roadside = ADVENTURE_SITES.filter((s) => s.npc).map((s) => ({ name: s.npc.name, x: s.x + (s.npc.dx || 0), z: s.z + (s.npc.dz || 0) }));
  const people = [...NPCS, ...roadside].filter(near), chests = CHESTS.filter(near), lore = LORE.filter((l) => Number.isFinite(l.x) && near(l));
  const camps = SPAWNERS.filter((s) => near(s) && !HIGHTOLL_SPAWNERS.includes(s));
  assert.ok(people.some((n) => n.name === 'Hobb'), "Hobb's fire is in range of the check");
  for (const p of pieces) {
    const at = `${p.kind} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`;
    for (let i = 1; i < reed.length; i++) assert.ok(toSeg(p.x, p.z, reed[i - 1], reed[i]) - p.r > 4, `${at} is on the Reed Road`);
    assert.ok(toSeg(p.x, p.z, [descent.a.x, descent.a.z], [descent.b.x, descent.b.z]) - p.r > 6, `${at} is under the descent line`);
    for (const n of people) assert.ok(Math.hypot(p.x - n.x, p.z - n.z) - p.r > 10, `${at} crowds ${n.name}`);
    for (const c of chests) assert.ok(Math.hypot(p.x - c.x, p.z - c.z) - p.r > 8, `${at} is on chest ${c.id}`);
    for (const l of lore) assert.ok(Math.hypot(p.x - l.x, p.z - l.z) - p.r > 8, `${at} is on the record ${l.id}`);
    for (const s of camps) assert.ok(Math.hypot(p.x - s.x, p.z - s.z) - p.r > 6, `${at} is on a ${s.type} camp`);
  }
});
