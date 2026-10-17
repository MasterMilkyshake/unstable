import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { ARCHITECTURE, CIVIC_ROADS, SETTLEMENT_ROADS, TOWN_WALLS, MERIDIAN_WALLS, INNER_WARDS, MERIDIAN_LOWER_WALLS } from '../src/data/architecture.js';
import { ROADS } from '../src/data/roads.js';
import { CHESTS } from '../src/data/world.js';
import { samplePath } from '../src/world/paths.js';
import { LORE } from '../src/data/lore.js';
import { NPCS, SPAWNERS, FERRY_ROUTES, STRUCTURES } from '../src/data/world.js';
import { SALTREACH_GATES } from '../src/data/architecture.js';
import { updateMeridianLift } from '../src/world/meridianLift.js';

// Use the real terrain and the complete structure pass to catch placement and
// rotation errors that a flat-ground geometry fixture would miss.
const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [],
  interactables: [], addLight() {}, addInteract(it) { this.interactables.push(it); }, addEmitter() {},
};
world.terrain.build();
const exclusions = buildStructures(world);

test('Saltreach wall walks stand 8 to 11 m over their ground and step with it', () => {
  const walls = world.fortifications.filter(w => w.ring === 'saltreach_ring');
  assert.ok(walls.length > 10);
  for (const wall of walls) for (const bay of wall.bays) {
    const rise = bay.top - world.terrain.heightAt(bay.x, bay.z);
    assert.ok(rise >= 8 && rise <= 11, `wall walk ${rise.toFixed(1)} m over the ground at ${bay.x.toFixed(0)}, ${bay.z.toFixed(0)}`);
    assert.ok(bay.bottom <= world.terrain.heightAt(bay.x, bay.z));
  }
  // every chain vertex is a tower, so no span meets another at an open bend
  for (const chain of SALTREACH_GATES.length ? world.fortifications.filter(w => w.ring === 'saltreach_ring') : []) {
    for (const end of [[chain.ax, chain.az], [chain.bx, chain.bz]]) {
      const tower = world.wallTowers.some(t => Math.hypot(t.x - end[0], t.z - end[1]) < 0.01);
      const gate = world.gates.some(g => Math.hypot(g.x - end[0], g.z - end[1]) < 16);
      const palace = Math.hypot(end[0] + 72, end[1] - 72) < 32;
      assert.ok(tower || gate || palace, `span end ${end} meets a tower, gatehouse or the palace`);
    }
  }
});

test('Meridian lift carries a rider both ways, aligns with its landings and can be recalled', () => {
  const lift = world.meridianLift;
  const rider = { pos: new THREE.Vector3(lift.x, lift.y0, lift.z), grounded: true };
  const bystander = { pos: new THREE.Vector3(lift.x - 6, lift.y0, lift.z), grounded: true };
  const advance = () => { for (let i = 0; i < 600; i++) updateMeridianLift(lift, 1 / 60, [rider, bystander]); };
  const traverse = (from, to, y) => {
    for (let x = from; x <= to; x += 0.2) {
      const ground = Math.max(world.terrain.heightAt(x, lift.z), world.colliders.groundAt(x, lift.z, y + 0.5));
      assert.ok(Math.abs(ground - y) < 0.4, `landing unsupported at ${x}: ${ground} versus ${y}`);
      const p = new THREE.Vector3(x, ground, lift.z);
      world.colliders.resolve(p, 0.4, 1.8);
      assert.ok(Math.abs(p.x - x) < 0.05 && Math.abs(p.z - lift.z) < 0.05, `landing blocked at ${x}`);
    }
  };
  traverse(lift.x - 7, lift.x, lift.y0);
  lift.ride.use({ player: rider }); advance();
  assert.equal(lift.y, lift.y1); assert.equal(lift.moving, false);
  assert.ok(Math.abs(rider.pos.y - lift.y1) < 1e-6);
  assert.equal(bystander.pos.y, lift.y0);
  traverse(lift.x, lift.x + 21, lift.y1);
  lift.ride.use({ player: rider }); advance();
  assert.equal(lift.y, lift.y0); assert.ok(Math.abs(rider.pos.y - lift.y0) < 1e-6);
  rider.pos.x -= 8;
  const call = world.interactables.find(it => it.id === 'meridian_lift_call_upper');
  assert.ok(call.enabled()); call.use(); advance();
  assert.equal(lift.y, lift.y1); assert.ok(!call.enabled());
  assert.ok(Math.abs(rider.pos.y - lift.y0) < 1e-6, 'empty recall leaves former rider on the landing');
  lift.callTo(lift.y0); advance();
});

function obstaclesAt(x, z, radius = 0.7, raise = 0) {
  const terrain = world.terrain.heightAt(x, z);
  const y = Math.max(terrain, world.colliders.groundAt(x, z, terrain + raise + 0.6));
  return world.colliders.query(x, z, radius).filter(c => {
    // Roads now include stairs: use the same step clearance as Colliders.resolve.
    if (!c.tag || c.y1 < y + (c.walkable ? 0.55 : 0.15) || c.y0 > y + 2.1) return false;
    if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + radius;
    const [lx, lz] = world.colliders._local(c, x, z);
    return Math.abs(lx) < c.hw + radius && Math.abs(lz) < c.hd + radius;
  });
}

test('new architecture leaves records, NPCs, ferry arrivals and interactions accessible', () => {
  const points = [...LORE, ...NPCS, ...FERRY_ROUTES.map(s => ({ ...s.spawn, id: s.id })), ...STRUCTURES.filter(s => s.id)];
  for (const p of points) assert.deepEqual(obstaclesAt(p.x, p.z, NPCS.includes(p) ? 0.4 : 0.7, p.floor || 0).map(c => c.tag), [], p.id);
});

test('new architecture preserves maneuvering space around every boss spawn', () => {
  for (const boss of SPAWNERS.filter(s => s.boss)) {
    for (let dx = -5; dx <= 5; dx += 2.5) for (let dz = -5; dz <= 5; dz += 2.5) {
      assert.deepEqual(obstaclesAt(boss.x + dx, boss.z + dz).map(c => c.tag), [], `${boss.type} at ${dx}, ${dz}`);
    }
  }
});

test('NPCs and bosses do not spawn on new overhead architecture', () => {
  for (const p of [...NPCS, ...SPAWNERS.filter(s => s.boss)]) {
    const ground = world.terrain.heightAt(p.x, p.z);
    if (p.interior) {
      // fen houses stand on piles; their hosts declare the raised floor they stand on
      const raise = p.floor || 0;
      const floor = world.colliders.groundAt(p.x, p.z, ground + raise + 0.6);
      assert.ok(floor >= ground && floor < ground + raise + 0.5, `${p.id} has a room floor below the roof`);
      continue;
    }
    const raised = world.colliders.query(p.x, p.z, 0.1).filter(c => {
      if (!c.tag || !c.walkable || c.y1 <= ground + 0.5) return false;
      if (c.kind === 'cyl') return Math.hypot(p.x - c.x, p.z - c.z) <= c.r;
      const [x, z] = world.colliders._local(c, p.x, p.z);
      return Math.abs(x) <= c.hw && Math.abs(z) <= c.hd;
    });
    assert.deepEqual(raised.map(c => c.tag), [], p.id || p.type);
  }
});

test('the harbor gate has a continuous walkable center passage and solid towers', () => {
  for (let z = -82; z <= -62; z++) assert.equal(obstaclesAt(0, z).length, 0, `gate passage z=${z}`);
  assert.ok(obstaclesAt(11, -72).some(c => c.tag === 'harbor_gate'));
  assert.ok(world.colliders.ceilingAt(0, -72, 5, 7) > 18, 'arch clears player head height');
});

test('inner ward gateways preserve broad routes and curved walls have grounded collision', () => {
  assert.equal(world.innerWards.length, INNER_WARDS.length);
  for (const ward of INNER_WARDS) {
    for (const gate of ward.gates) {
      for (const offset of [-4, 0, 4]) {
        let y = world.terrain.heightAt(gate.x + offset, gate.z - 4);
        for (let z = -4; z <= 4; z += 0.2) {
          const x = gate.x + Math.cos(gate.rot) * offset + Math.sin(gate.rot) * z;
          const zz = gate.z - Math.sin(gate.rot) * offset + Math.cos(gate.rot) * z;
          y = Math.max(world.terrain.heightAt(x, zz), world.colliders.groundAt(x, zz, y + 0.55));
          const p = new THREE.Vector3(x, y + 0.02, zz);
          world.colliders.resolve(p, 0.4, 1.8);
          assert.ok(Math.hypot(p.x - x, p.z - zz) < 0.05, `${ward.name} passage blocked`);
        }
      }
    }
    const walls = [...world.colliders.all].filter(c => c.tag === ward.id && c.y1 - c.y0 > 4);
    assert.ok(walls.length > 10, 'inner curtain has solid masonry');
    for (const c of walls) {
      // High arch spandrels are intentionally above the open street.
      if (c.y0 > world.terrain.heightAt(c.x, c.z)) continue;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const [dx, dz] = world.colliders._world(c, sx * c.hw, sz * c.hd);
        assert.ok(c.y0 <= world.terrain.heightAt(c.x + dx, c.z + dz) + 0.1, 'inner wall footing reaches terrain');
      }
    }
  }
});

test('the side and north gates preserve traversable routes through the curtain walls', () => {
  for (const gate of SALTREACH_GATES.filter(g => g.id !== 'north_gate')) for (let dx = -5.5; dx <= 5.5; dx++) {
    assert.deepEqual(obstaclesAt(gate.x + dx, gate.z).map(c => c.tag), [], `side gate ${gate.x}, ${dx}`);
  }
  const north = SALTREACH_GATES.find(g => g.id === 'north_gate');
  for (let z = north.z - 8; z <= north.z + 4; z++) assert.deepEqual(obstaclesAt(north.x, z).map(c => c.tag), [], `north gate ${z}`);
  assert.equal(world.fortifications.length, [...TOWN_WALLS, ...MERIDIAN_WALLS, ...MERIDIAN_LOWER_WALLS].reduce((n, points) => n + points.length - 1, 0));
  for (const wall of world.fortifications) {
    const x = (wall.ax + wall.bx) / 2, z = (wall.az + wall.bz) / 2;
    assert.ok(obstaclesAt(x, z).some(c => c.tag === 'town_wall'), 'wall geometry must be solid');
    assert.ok(world.colliders.groundAt(x, z, wall.top + 0.5) >= wall.top, 'rampart must support a player');
  }
});

test('winding lanes have clear centers and exclude vegetation along their full curves', () => {
  for (const road of [...CIVIC_ROADS, ...SETTLEMENT_ROADS, ...ROADS]) {
    const samples = samplePath(road);
    assert.ok(samples.every(p => Number.isFinite(p.x + p.z + p.width) && p.width > 0));
    for (const p of samples) {
      assert.deepEqual(obstaclesAt(p.x, p.z, 0.4).map(c => c.tag), [], `lane ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
      assert.ok(exclusions.some(e => Math.hypot(e.x - p.x, e.z - p.z) < e.r), 'lane has vegetation clearance');
    }
  }
  const approach = samplePath(CIVIC_ROADS[1]);
  assert.ok(Math.max(...approach.map(p => Math.abs(p.x))) > 5, 'harbor approach bends between dock and gate');
});

test('the Wash connects to Saltreach on dry land while the harbor stays navigable', () => {
  const trail = samplePath(CIVIC_ROADS[0]);
  for (const p of trail) assert.ok(world.terrain.heightAt(p.x, p.z) > 1, `coast trail is dry at ${p.x}, ${p.z}`);
  assert.ok(world.terrain.heightAt(0, -173) < 0, 'the harbor pier still ends over water');
});

test('every inn has an open doorway, supported room floor, sleeping loft and safe rest point', () => {
  const inns = world.interiors.filter(i => i.type === 'inn');
  assert.equal(inns.length, 7);
  for (const inn of inns) {
    for (let z = inn.d / 2 + 1; z >= 0.8; z -= 0.25) {
      const x = inn.x + Math.sin(inn.rot) * z, zz = inn.z + Math.cos(inn.rot) * z;
      const pos = new THREE.Vector3(x, inn.floor + 0.02, zz);
      world.colliders.resolve(pos, 0.4, 1.8);
      assert.ok(Math.hypot(pos.x - x, pos.z - zz) < 0.05, `${inn.name} doorway obstructed at ${z}`);
      assert.ok(world.terrain.heightAt(x, zz) < inn.floor + 0.2, `${inn.name} terrain protrudes into room`);
    }
    // the inn's wake point: its keeper sets it; it offers no [E] of its own, upstairs or down
    const bed = world.interactables.find(it => it.kind === 'rest_point' && it.name === inn.name);
    assert.ok(bed, inn.name);
    assert.ok(bed.enabled && !bed.enabled(), `${inn.name}: no rent-a-room prompt`);
    assert.ok(world.restPoints[bed.id] === bed.pos, `${inn.name}: recorded as a rest point`);
    assert.ok(!world.interactables.some(it => it.id === `${bed.id}_bed`), `${inn.name}: no bedside prompt`);
    const support = world.colliders.groundAt(bed.pos.x, bed.pos.z, bed.pos.y + 0.5);
    assert.ok(Math.abs(support - inn.floor) < 0.1, `${inn.name} rest anchor stays on the room floor`);
    assert.ok(inn.loft > inn.floor + 3.5);
    let previous = inn.floor;
    // up the stair along the -x wall, from inside the front wall to the back of the loft
    const stairX = inn.stairX ?? -inn.w / 2 + 1.45, wall = inn.wall ?? 0.38;
    for (let localZ = inn.d / 2 - wall - 0.42; localZ >= -inn.d / 2 + wall + 0.5; localZ -= 0.1) {
      const x = inn.x + Math.cos(inn.rot) * stairX + Math.sin(inn.rot) * localZ;
      const z = inn.z - Math.sin(inn.rot) * stairX + Math.cos(inn.rot) * localZ;
      const support = world.colliders.groundAt(x, z, previous + 0.55);
      assert.ok(support >= previous - 0.3, `${inn.name} stairs have continuous support`);
      const pos = new THREE.Vector3(x, support + 0.02, z);
      world.colliders.resolve(pos, 0.35, 1.8);
      assert.ok(Math.hypot(pos.x - x, pos.z - z) < 0.1, `${inn.name} stair route is blocked`);
      previous = support;
    }
    assert.ok(previous >= inn.loft - 0.35, `${inn.name} stairs reach the sleeping loft`);
  }
});

test('all regional landmarks are built, vegetation is excluded and meshes are batched', () => {
  assert.equal(world.architecture.length, ARCHITECTURE.length);
  for (const s of ARCHITECTURE) {
    assert.ok(world.architecture.some(a => a.id === s.id && a.group.name === s.name));
    assert.ok(exclusions.some(e => e.x === s.x && e.z === s.z && e.r >= 10));
  }
  assert.ok(world.mergeStats.removed > 3000);
  assert.ok(world.mergeStats.merged < 600, `seven inhabited settlements must keep the global batching budget bounded (${world.mergeStats.merged})`);
  world.scene.traverse(o => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position.array;
    assert.ok(a.every(Number.isFinite), `${o.name} has valid vertices`);
  });
});


test('joined regions have continuous dry, gently graded overland routes', () => {
  for (const road of ROADS) {
    const samples = samplePath(road);
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i], height = world.terrain.heightAt(p.x, p.z);
      assert.ok(height > 1, `${road.id} enters water at ${p.x}, ${p.z}`);
      if (i) {
        const prev = samples[i - 1], before = world.terrain.heightAt(prev.x, prev.z);
        const grade = Math.abs(height - before) / Math.hypot(p.x - prev.x, p.z - prev.z);
        assert.ok(grade < 0.6, `${road.id} too steep (${grade}) at ${p.x}, ${p.z}`);
      }
    }
  }
  for (const [id, dock] of Object.entries(world.docks)) {
    assert.ok(world.terrain.heightAt(dock.end.x, dock.end.z) < 0, `${id} must end over water`);
  }
});

test('the North Gate reaches Millbrook by the North Stair and the North Road at walking height', () => {
  // through the gate and down every flight and landing of the stair, by its colliders
  const stair = world.approaches.find(a => a.id === 'north_stair');
  const north = SALTREACH_GATES.find(g => g.id === 'north_gate');
  const route = [{ x: north.x, z: north.z - 6 }, ...stair.route];
  let y = world.terrain.heightAt(route[0].x, route[0].z);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15);
    for (let j = 1; j <= n; j++) {
      const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n;
      const g = Math.max(world.terrain.heightAt(x, z), world.colliders.groundAt(x, z, y + 0.55));
      assert.ok(g > y - 0.6, `the stair drops away under a walker at ${x.toFixed(1)}, ${z.toFixed(1)} (${y.toFixed(2)} -> ${g.toFixed(2)})`);
      const actor = new THREE.Vector3(x, g + 0.02, z);
      world.colliders.resolve(actor, 0.4, 1.8);
      assert.ok(Math.hypot(actor.x - x, actor.z - z) < 0.06, `North Stair blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      y = g;
    }
  }
  assert.ok(Math.abs(y - world.terrain.heightAt(stair.foot.x, stair.foot.z)) < 0.6, 'the stair lands on the valley floor');
  // then the road over open ground to the village
  const road = ROADS.find(r => r.id === 'north_road');
  const points = samplePath(road, 0.2).filter(p => p.z <= 240);
  assert.ok(Math.hypot(points[0].x - stair.foot.x, points[0].z - stair.foot.z) < 3, 'the road begins at the foot of the stair');
  for (const offset of [-1.2, 0, 1.2]) {
    let before = null;
    for (const p of points) {
      const x = p.x + offset, h = world.terrain.heightAt(x, p.z);
      if (before) assert.ok(Math.abs(h - before) < 0.55, `cliff interrupts village road at ${x}, ${p.z}`);
      const actor = new THREE.Vector3(x, h + 0.02, p.z);
      world.colliders.resolve(actor, 0.4, 1.8);
      assert.ok(Math.hypot(actor.x - x, actor.z - p.z) < 0.05, 'village route must remain open');
      before = h;
    }
  }
});

test('Meridian closes the old road gate and joins its mountain without opening a second fort entrance', () => {
  assert.ok(obstaclesAt(1138, -654).some(c => c.tag === 'town_wall'), 'former road gate is sealed');
  const paths = ROADS.filter(r => r.id.startsWith('meridian') || r.id === 'garrison_road');
  for (const road of paths) for (const p of samplePath(road)) {
    assert.ok(!(p.x > 1130 && p.x < 1250 && p.z < -615 && p.z > -775), 'regional roads stay outside the upper fort');
  }
  for (let i = 0; i <= 30; i++) {
    const x = 1240 + i * 100 / 30, z = -750 - i * 25 / 30;
    // The shoulder remains broad up to the deliberate bridged ravine.
    if (x < 1300) assert.ok(world.terrain.heightAt(x, z) >= 28, `mountain shoulder disconnected at ${x}, ${z}`);
  }
  for (const item of CHESTS.filter(c => c.id === 'c_signal_keeper')) assert.deepEqual(obstaclesAt(item.x, item.z).map(c => c.tag), []);
  const camp = STRUCTURES.find(s => s.id === 'cf_signal_keepers');
  for (let i = 0; i <= 50; i++) {
    const x = 1342 + (camp.x - 1342) * i / 50, z = -704 + (camp.z + 704) * i / 50;
    const y = world.terrain.heightAt(x, z);
    assert.ok(Math.abs(y - 16) < 0.6, 'camp turnout connects to the signal trail');
  }
});

test('Signal Bridge crosses an open ravine with supported approaches and solid parapets', () => {
  const { x, z, width, deck } = world.meridianBridge;
  for (let dx = -8; dx <= 8; dx++) {
    assert.ok(world.terrain.heightAt(x + dx, z) < deck - 20, 'gorge remains open below the bridge');
  }
  for (const offset of [-1.7, 0, 1.7]) for (const direction of [-1, 1]) {
    let before = deck;
    for (let i = 0; i <= (width + 6) * 5; i++) {
      const xx = x + direction * (-width / 2 - 3 + i / 5), zz = z + offset;
      const y = Math.max(world.terrain.heightAt(xx, zz), world.colliders.groundAt(xx, zz, deck + 0.55));
      assert.ok(Math.abs(y - before) < 0.55, `bridge approach has a step at ${xx}, ${zz}: ${before} -> ${y}`);
      const actor = new THREE.Vector3(xx, y + 0.02, zz);
      world.colliders.resolve(actor, 0.4, 1.8);
      assert.ok(Math.hypot(actor.x - xx, actor.z - zz) < 0.05, 'bridge crossing stays clear');
      before = y;
    }
  }
  for (const side of [-1, 1]) {
    const actor = new THREE.Vector3(x + 4, deck + 0.02, z + side * 2.4);
    world.colliders.resolve(actor, 0.4, 1.8);
    assert.ok(Math.abs(actor.z - z) < 2.4, 'parapet prevents walking off the deck');
  }
});
