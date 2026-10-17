import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { buildRiftCity } from '../src/world/riftCity.js';
import { buildRiftSpire } from '../src/world/riftSpire.js';
import { ASCENT_LIFTS, liftDeckRoutes, buildAscentLifts } from '../src/world/ascentLifts.js';
import { SPIRE, SPIRE_TIER } from '../src/data/riftSpire.js';
import { RIFT_CITADEL, RIFT_CITADEL_GATES } from '../src/data/riftCitadel.js';
import { shelfDistance } from '../src/world/shelfOutline.js';
import { buildPostern } from '../src/world/fortifications.js';
import { navGrid, navBody } from '../src/entities/nav.js';
import { SPAWNERS } from '../src/data/world.js';
import { spawnSpot } from '../src/world/spawnSpot.js';
import { ENEMIES } from '../src/data/enemies.js';
import { SALTREACH_RAMPS, SALTREACH_SHELVES } from '../src/data/saltreach.js';
import { RIFT_CITY_RAMPS, RIFT_CITY_GATES, RIFT_CITY_LANES, RIFT_CITY_HOUSES } from '../src/data/riftCity.js';
import { POSTERN_GATES, ARCHITECTURE } from '../src/data/architecture.js';
import { LORE } from '../src/data/lore.js';
import { NPCS, CHESTS, STRUCTURES } from '../src/data/world.js';
import { RIFT_PICKUPS } from '../src/data/riftResearch.js';
import '../src/data/rift.js';
const world = { scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(), animated: [], docks: {}, hazards: [], dummySpots: [], addLight() {}, addInteract: (it) => it, addEmitter() {} };
world.terrain.build();
buildStructures(world);
buildRiftCity(world, []);
const riftState = { low: true };
buildRiftSpire(world, [], riftState);
buildAscentLifts(world, [], riftState);
const H = (x, z) => world.terrain.heightAt(x, z);

function walk(points, message, initialY = H(...points[0])) {
  let y = initialY;
  for (const [x, z] of points) {
    y = Math.max(H(x, z), world.colliders.groundAt(x, z, y + 0.55));
    const p = new THREE.Vector3(x, y + 0.02, z);
    world.colliders.resolve(p, 0.4, 1.8);
    assert.ok(Math.hypot(p.x - x, p.z - z) < 0.05, `${message} blocked at ${x}, ${z}`);
  }
}

test('Saltreach has broad, separately elevated civic and upper wards', () => {
  for (const [x, z, y] of [[-40, 12, 10.5], [0, 12, 10.5], [20, 12, 10.5], [-40, 70, 27], [0, 70, 19], [20, 70, 19]]) {
    assert.ok(Math.abs(H(x, z) - y) < 0.1, `ward shelf at ${x}, ${z}`);
  }
  assert.ok(H(0, 70) - H(0, -50) > 14);
  assert.ok(Math.abs(H(6000, 5988) - 10.6) < 0.001, 'Ascent retains its original climb datum');
});

test('all city stair routes can be walked uphill and downhill without jumping', () => {
  for (const r of [...SALTREACH_RAMPS, ...RIFT_CITY_RAMPS]) {
    const n = Math.ceil(Math.hypot(r.x2 - r.x, r.z2 - r.z) / 0.15);
    for (const offset of [-r.w * 0.3, 0, r.w * 0.3]) {
      const length = Math.hypot(r.x2 - r.x, r.z2 - r.z);
      const points = Array.from({ length: n + 1 }, (_, i) => [
        r.x + (r.z2 - r.z) / length * offset + (r.x2 - r.x) * i / n,
        r.z - (r.x2 - r.x) / length * offset + (r.z2 - r.z) * i / n,
      ]);
      walk(points, 'uphill stair'); walk(points.reverse(), 'downhill stair');
    }
  }
});

test('side, north and Rift gates have wide open passages and solid connected jambs', () => {
  for (const [x, z, yaw] of [...POSTERN_GATES, ...RIFT_CITY_GATES]) {
    const point = (lx, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz];
    // The lift gate is reached on an elevated bridge. Start on that landing,
    // rather than attempting to walk through the rock face underneath it.
    const lift = world.meridianLift;
    const landing = z === lift.z && Math.abs(x - lift.x) < 20 ? lift.y1 : undefined;
    // gatehouses publish their passage half-width; walk its edges as well as its centre
    const house = world.gates?.find(g => Math.hypot(g.x - x, g.z - z) < 0.01);
    const half = house?.PW ?? 3.6;
    // a gatehouse's outer mouth may open onto the head of its stair: start just outside it
    const from = house ? -house.D / 2 - 1 : -10;
    for (const lx of [-(half - 0.6), 0, half - 0.6]) walk(Array.from({ length: Math.round((10 - from) * 4) + 1 }, (_, i) => point(lx, from + i / 4)), 'gate passage', landing);
    for (const lx of [-10, 10]) {
      const [xx, zz] = point(lx, 0), p = new THREE.Vector3(xx, H(xx, zz) + 0.1, zz);
      assert.ok(world.colliders.resolve(p, 0.4, 1.8).hit, 'jamb joins wall with solid masonry');
    }
  }
});

test('enemy navigation routes through the Saltreach gates and round the corner inside', () => {
  const nav = navGrid(world);
  const body = navBody({ radius: 0.42, height: 1.8 });
  const groundY = (x, z) => Math.max(H(x, z), world.colliders.groundAt(x, z, H(x, z) + 0.6, 0.21));
  // the west, east and north gates: the north one climbs a switchback to the upper ward
  for (const [x, z, yaw] of POSTERN_GATES.slice(0, 3)) {
    const local = (wx, wz) => [(wx - x) * Math.cos(yaw) - (wz - z) * Math.sin(yaw), (wx - x) * Math.sin(yaw) + (wz - z) * Math.cos(yaw)];
    const point = (lx, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz];
    const half = world.gates?.find(g => Math.hypot(g.x - x, g.z - z) < 0.01)?.PW ?? 3.6;
    // from well off to one side outside, to round the wall on the other side inside, and back
    for (const [a, b] of [[point(-14, -16), point(12, 12)], [point(12, 12), point(-14, -16)]]) {
      assert.equal(nav.walkLine(a[0], a[1], groundY(...a), b[0], b[1], body), false, 'the straight line is walled');
      const route = nav.findPath(a[0], a[1], groundY(...a), b[0], b[1], groundY(...b), body);
      assert.ok(route && route.complete, `a route through the gate at ${x}, ${z}`);
      const pts = [a, ...route.points.map(p => [p[0], p[2]])].map(p => local(...p));
      const through = pts.some((p, i) => i && Math.sign(p[1]) !== Math.sign(pts[i - 1][1]) &&
        Math.abs(pts[i - 1][0] + (p[0] - pts[i - 1][0]) * (pts[i - 1][1] / (pts[i - 1][1] - p[1]))) < half);
      assert.ok(through, `the route crosses the wall inside the passage at ${x}, ${z}`);
    }
  }
});

test('Saltreach’s watch and the palace wardens spawn in the street and the hall, not on the roofs', () => {
  const town = SPAWNERS.filter(d => /^watch_|^lantern_|^peacekeeper/.test(d.type) && Math.abs(d.x) < 120 && d.z > -140 && d.z < 140);
  assert.ok(town.length >= 6);
  for (const d of town) {
    for (let i = 0; i < 12; i++) {
      const x = d.x + Math.cos(i) * d.radius * (i % 3) / 2, z = d.z + Math.sin(i) * d.radius * (i % 3) / 2;
      const perch = !!ENEMIES[d.type].perch; // wall archers keep to the walls
      const [sx, y, sz] = spawnSpot(world, x, z, perch);
      if (!perch) assert.ok(y - H(sx, sz) < 2.5, `${d.type} at ${d.x}, ${d.z} spawns ${(y - H(sx, sz)).toFixed(1)} m above the ground`);
      assert.ok(Math.hypot(sx - x, sz - z) < 6.1, `${d.type} at ${d.x}, ${d.z} spawns far from its post`);
      for (const h of [0.3, 1, 1.7]) assert.ok(!world.colliders.pointInside(sx, y + h, sz), `${d.type} at ${d.x}, ${d.z} spawns inside something`);
    }
  }
});

test('new Rift masonry does not enclose lore, NPCs, chests or research pickups', () => {
  for (const p of [...LORE, ...NPCS, ...CHESTS, ...RIFT_PICKUPS].filter(p => p.x > 5800 && p.x < 6300)) {
    const y = H(p.x, p.z);
    const blockers = world.colliders.query(p.x, p.z, 0.5).filter(c => {
      if (!['rift_city', 'rift_city_wall', 'rift_citadel'].includes(c.tag) || c.y1 < y + 0.55 || c.y0 > y + 1.8) return false;
      const [x, z] = world.colliders._local(c, p.x, p.z);
      return Math.abs(x) < c.hw + 0.5 && Math.abs(z) < c.hd + 0.5;
    });
    assert.equal(blockers.length, 0, p.id);
  }
});

test('curtain foundations cover their full footprint on sloping ground', () => {
  for (const c of world.colliders.all) {
    if (!['town_wall', 'rift_city_wall'].includes(c.tag) || c.y1 - c.y0 < 8) continue;
    if (c.kind === 'cyl') {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        assert.ok(c.y0 <= H(c.x + Math.sin(a) * c.r, c.z + Math.cos(a) * c.r) + 0.1, 'tower footing must reach ground');
      }
      continue;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [dx, dz] = world.colliders._world(c, sx * c.hw, sz * c.hd);
      assert.ok(c.y0 <= H(c.x + dx, c.z + dz) + 0.1, 'wall footing must reach ground');
    }
  }
});

test('Saltreach buildings open onto shared ward ground without private stair flights', () => {
  const town = world.interiors.filter(b => Math.abs(b.x) < 70 && b.z > -75 && b.z < 100);
  assert.ok(town.length > 15);
  for (const b of town) {
    const x = b.x + Math.sin(b.rot) * (b.d / 2 + 1.6);
    const z = b.z + Math.cos(b.rot) * (b.d / 2 + 1.6);
    assert.ok(b.floor - H(x, z) < 0.75, `${b.name} at ${b.x}, ${b.z} needs a separate stair flight`);
  }
  assert.equal(SALTREACH_RAMPS.length, 3, 'shared stairs serve the two wards and Sage\'s Rock; the palace keeps its own stair');
});

test('every large landmass contains a broad walkable elevated shelf', () => {
  for (const island of world.terrain.islands.filter(i => i.radius >= 100)) {
    let found = false;
    for (let x = island.x0; x < island.x0 + island.sizeX && !found; x += 20) {
      for (let z = island.z0; z < island.z0 + island.sizeZ && !found; z += 20) {
        const heights = [];
        for (const dx of [-15, 0, 15]) for (const dz of [-15, 0, 15]) heights.push(H(x + dx, z + dz));
        found = Math.min(...heights) > 5 && Math.max(...heights) - Math.min(...heights) < 1.8;
      }
    }
    assert.ok(found, `${island.id} needs a level shelf at least thirty metres across`);
  }
});

test('contour cliff triangles cover their cells and match the movement surface', () => {
  // Noise-relief isles (the Rift); block isles draw true walls instead.
  for (const island of world.terrain.islands.filter(i => !i.blocks).flatMap(i => [i, ...(i.patches || [])])) {
    let checked = 0;
    for (const [cell, triangles] of island.surfaceCells || []) {
      if (++checked > 100) break;
      let area = 0;
      for (const [a, b, c] of triangles) {
        area += Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / 2;
        const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3;
        assert.ok(Math.abs(island.sample(x, z) - (a[1] + b[1] + c[1]) / 3) < 0.02, `${island.id}: collision disagrees with cliff cell ${cell}`);
      }
      assert.ok(Math.abs(area - island.cellX * island.cellZ) < 0.02, `${island.id}: hole or overlap in cliff cell ${cell}`);
    }
  }
});

test('postern masonry has no gaps around the pointed vault, on either face', () => {
  const gate = buildPostern({ terrain: { heightAt: () => 0 }, colliders: new Colliders() }, 0, 0, 0);
  gate.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const side of [-1, 1]) {
    for (let x = -11.7; x < 12; x += 0.37) for (let y = 0.3; y < 15.5; y += 0.31) {
      const crown = 6 + Math.sqrt(81 - (3 + Math.min(6, Math.abs(x))) ** 2);
      const solid = Math.abs(x) > 6 || y > crown;
      // Avoid polygon/chord tolerance right along the carved stone silhouette.
      if (Math.abs(y - crown) < 0.06 || Math.abs(Math.abs(x) - 6) < 0.06) continue;
      ray.set(new THREE.Vector3(x, y, side * 12), new THREE.Vector3(0, 0, -side));
      assert.equal(ray.intersectObject(gate, true).length > 0, solid, `vault face ${side} at ${x}, ${y}`);
    }
  }
});

test('refined terrain patches join the coarse land without cracks or height jumps', () => {
  // Block isles need no refinement (their shelf walls are exact); noise isles still use it.
  const island = world.terrain.islands.find(i => !i.blocks && i.patches?.length);
  const patch = island?.patches[0];
  if (!patch) return;
  for (const axis of ['x', 'z']) for (const end of [0, 1]) for (let i = 1; i < 30; i++) {
    const x = axis === 'x' ? patch.x0 + end * patch.sizeX : patch.x0 + i / 30 * patch.sizeX;
    const z = axis === 'z' ? patch.z0 + end * patch.sizeZ : patch.z0 + i / 30 * patch.sizeZ;
    const dx = axis === 'x' ? 0.0001 : 0, dz = axis === 'z' ? 0.0001 : 0;
    assert.ok(Math.abs(H(x - dx, z - dz) - H(x + dx, z + dz)) < 0.01, `terrain seam at ${x}, ${z}`);
  }
});

test('town shelves have steep, irregular rock fronts outside the shared stairs', () => {
  const island = world.terrain.islands.find(i => i.id === 'saltreach');
  for (const shelf of island.flats.filter(f => f.front)) {
    const edges = [];
    for (const x of [-48, -32, 32, 48]) {
      const index = shelf.front.findIndex(p => p[0] >= x);
      const [ax, az] = shelf.front[index - 1], [bx, bz] = shelf.front[index];
      const z = az + (bz - az) * (x - ax) / (bx - ax);
      edges.push(z);
      assert.ok(H(x, z + 2) - H(x, z - 2) > 5, `cliff at ${x}, ${z} became a ramp`);
    }
    assert.ok(Math.max(...edges) - Math.min(...edges) > 4, 'ledge should recede and protrude');
  }
});


test('dense Rift blocks preserve the full width of the main circulation routes', () => {
  for (const [ax, az, bx, bz, width] of RIFT_CITY_LANES) {
    const length = Math.hypot(bx - ax, bz - az), n = Math.ceil(length / 0.3);
    for (const offset of [-width / 2 + 0.6, 0, width / 2 - 0.6]) {
      const points = Array.from({ length: n + 1 }, (_, i) => [
        ax + (bx - ax) * i / n + (bz - az) / length * offset,
        az + (bz - az) * i / n - (bx - ax) / length * offset,
      ]);
      walk(points, 'dense district lane'); walk(points.reverse(), 'return district lane');
    }
  }
});

test('Rift tenements have grounded foundations and separated roof footprints', () => {
  const houses = world.riftCity.children.filter(g => g.name === 'Drowned ward tenement');
  for (const [i, a] of RIFT_CITY_HOUSES.entries()) {
    const bounds = new THREE.Box3().setFromObject(houses[i]);
    for (const dx of [-a.w / 2, a.w / 2]) for (const dz of [-a.d / 2, a.d / 2]) {
      assert.ok(bounds.min.y <= H(a.x + Math.cos(a.yaw) * dx + Math.sin(a.yaw) * dz, a.z - Math.sin(a.yaw) * dx + Math.cos(a.yaw) * dz), 'tenement foundation reaches terrain');
    }
    for (const b of RIFT_CITY_HOUSES.slice(i + 1)) {
      assert.ok(Math.abs(a.x - b.x) >= a.hx + b.hx ||
        Math.abs(a.z - b.z) >= a.hz + b.hz, 'neighboring roofs do not intersect');
    }
  }
});


test('inhabited Saltreach promontories have level crowns and abrupt rock edges', () => {
  for (const shelf of SALTREACH_SHELVES) {
    for (const dx of [-2, 0, 2]) for (const dz of [-2, 0, 2]) {
      assert.ok(Math.abs(H(shelf.x + dx, shelf.z + dz) - shelf.h) < 0.05, `${shelf.name} crown stays level`);
    }
    const occupants = STRUCTURES.filter(s => ['house', 'tower'].includes(s.type) && shelfDistance(shelf.outline, s.x, s.z) > 3);
    const palace = ARCHITECTURE.find(a => a.kind === 'lantern_palace' && shelfDistance(shelf.outline, a.x, a.z) > 3);
    assert.ok(occupants.length >= 2 || palace, `${shelf.name} supports a neighbourhood or the palace`);
    if (palace) assert.ok(Math.abs(H(palace.x, palace.z) - shelf.h) < 0.1, 'the palace stands on the shelf');
    for (const s of occupants) assert.ok(Math.abs(H(s.x, s.z) - shelf.h) < 0.1, 'occupied shelf uses the actual terrain');
    const [a, b] = shelf.outline.slice(1, 3), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const nx = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length;
    // block walls step along the 3 m terrain grid, so probe a cell either side of the outline
    assert.ok(H(x + nx * 3.5, z + nz * 3.5) - H(x - nx * 3.5, z - nz * 3.5) > 6, 'outcrop has a steep side, not a mound');
  }
});


test('every Rift tenement has a furnished ground floor with a clear entrance and central aisle', () => {
  assert.equal(world.riftInteriors.length, RIFT_CITY_HOUSES.length);
  assert.equal(new Set(world.riftInteriors.map(r => r.kind)).size, 4);
  for (const room of world.riftInteriors) {
    for (const offset of [-0.55, 0, 0.55]) {
      const start = room.d / 2 + 0.9;
      const n = Math.ceil((start + 1.6) / 0.15);
      const points = Array.from({ length: n + 1 }, (_, i) => {
        const zz = start - i / n * (start + 1.6);
        return [room.x + Math.cos(room.rot) * offset + Math.sin(room.rot) * zz,
          room.z - Math.sin(room.rot) * offset + Math.cos(room.rot) * zz];
      });
      walk(points, `${room.name} entrance`); walk(points.reverse(), `${room.name} exit`, room.floor);
    }
    assert.ok(world.colliders.groundAt(room.x, room.z, room.floor + 0.2) >= room.floor - 0.02, 'room has a supported floor');
    assert.ok(H(room.x, room.z) <= room.floor, 'terrain stays below the floor');
  }
});

test('the expanded Rift citadel keeps every lift approach and travel shaft clear', () => {
  const base = H(SPIRE.x, SPIRE.z);
  for (const lift of ASCENT_LIFTS) {
    const from = base + (lift.from === 'base' ? 0.55 : SPIRE_TIER[lift.from].h);
    const to = base + SPIRE_TIER[lift.to].h;
    for (let y = from; y <= to; y += 0.4) {
      const p = new THREE.Vector3(SPIRE.x + lift.padOx, y, SPIRE.z + lift.padOz);
      const before = p.clone();
      world.colliders.resolve(p, 0.4, 1.8);
      assert.ok(p.distanceTo(before) < 0.05, `${lift.id} shaft blocked at ${y}`);
    }
    // Upper passengers disembark inward along the existing bridge routes.
    const routes = liftDeckRoutes(lift);
    if (lift.from === 'base') routes.from = [[SPIRE.x + lift.padOx, SPIRE.z + lift.padOz + 4],
      [SPIRE.x + lift.padOx, SPIRE.z + lift.padOz]];
    for (const [end, route] of Object.entries(routes)) for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1], [bx, bz] = route[i];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
      for (let j = 0; j <= steps; j++) {
        const p = new THREE.Vector3(ax + (bx - ax) * j / steps,
          (end === 'from' ? from : to) + 0.2, az + (bz - az) * j / steps);
        const before = p.clone();
        world.colliders.resolve(p, 0.4, 1.8);
        assert.ok(p.distanceTo(before) < 0.05, `${lift.id} ${end} bridge blocked`);
        // and something stands under every step past the cage (which rides with you): the
        // stop's sill, the bridge, the crown
        const y = end === 'from' ? from : to;
        if (Math.hypot(p.x - SPIRE.x - lift.padOx, p.z - SPIRE.z - lift.padOz) < 1.6) continue;
        assert.ok(world.colliders.groundAt(p.x, p.z, y + 0.5) >= y - 0.3, `${lift.id} ${end} route unsupported at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
      }
    }
  }
  // The summit route ends within reach of the Wound (its interact radius is 3.8 m).
  const lift = ASCENT_LIFTS[0];
  const end = liftDeckRoutes(lift).to.at(-1);
  assert.equal(lift.to, 'summit');
  assert.ok(Math.hypot(end[0] - SPIRE.x, end[1] - SPIRE.z) < 3.8 + 5, 'the bridge lands on the crown, a few steps from the Wound');
  const top = base + SPIRE_TIER.summit.h;
  const walkTo = [[end[0], end[1]], [SPIRE.x + 1.5, SPIRE.z + 2.8]];
  for (let i = 0; i <= 20; i++) {
    const x = walkTo[0][0] + (walkTo[1][0] - walkTo[0][0]) * i / 20, z = walkTo[0][1] + (walkTo[1][1] - walkTo[0][1]) * i / 20;
    const p = new THREE.Vector3(x, top + 0.2, z);
    const before = p.clone();
    world.colliders.resolve(p, 0.4, 1.8);
    assert.ok(p.distanceTo(before) < 0.05, `the crown blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    assert.ok(world.colliders.groundAt(x, z, top + 0.5) >= top - 0.3, 'the crown is under foot');
  }
  assert.ok(Math.hypot(1.5, 2.8) < 3.8, 'the walk ends inside the Wound\'s reach');
});

test('the inner citadel connects to the city through its three walkable gates', () => {
  for (const gate of RIFT_CITADEL_GATES) {
    for (const offset of [-3, 0, 3]) {
      const points = Array.from({ length: 65 }, (_, i) => {
        const along = -8 + i / 4;
        return [RIFT_CITADEL.x + gate.x + Math.cos(gate.yaw) * offset + Math.sin(gate.yaw) * along,
          RIFT_CITADEL.z + gate.z - Math.sin(gate.yaw) * offset + Math.cos(gate.yaw) * along];
      });
      walk(points, 'citadel court entrance'); walk(points.reverse(), 'citadel court exit');
    }
  }
});

test('Rift citadel gates and angled curtains share a continuous wall-walk elevation', () => {
  const { walks, gates } = world.riftCitadelWalls;
  assert.equal(gates.length, 3);
  assert.ok(walks.length >= 8);
  for (const part of [...walks, ...gates]) assert.equal(part.top, H(SPIRE.x, SPIRE.z) + RIFT_CITADEL.wallHeight + 0.5);
});
