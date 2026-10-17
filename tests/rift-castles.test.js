import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildRiftCastles, chainClear } from '../src/world/riftCastles.js';
import { RIFT_CASTLES, RIFT_SPOTS, RIFT_WAYS } from '../src/data/riftLayout.js';

// The Rift's ground and the island above it (the roof's height comes from Saltreach's), built
// for real; the rest of the world stays unbuilt so this runs in a moment.
const terrain = new Terrain();
for (const isl of terrain.islands) {
  if (['rift', 'saltreach', 'gulls_reach'].includes(isl.id)) isl.build();
  else isl.contains = () => false;
}
const lights = [];
const world = {
  scene: new THREE.Scene(), terrain, colliders: new Colliders(),
  addLight(p) { lights.push(p); }, addEmitter() {}, addInteract() {},
};
const exclusions = [];
const state = { low: false };
buildRiftCastles(world, exclusions, state);
const castle = [...world.colliders.all].filter((c) => c.tag === 'rift_castle');

function overlaps(c, x, z, r) {
  if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + r;
  const [lx, lz] = world.colliders._local(c, x, z);
  const dx = Math.max(0, Math.abs(lx) - c.hw), dz = Math.max(0, Math.abs(lz) - c.hd);
  return Math.hypot(dx, dz) < r;
}
// The floor you would stand on at (x, z) arriving from height `from`.
function floorAt(x, z, from) {
  const t = terrain.heightAt(x, z);
  return Math.max(t, world.colliders.groundAt(x, z, from + 0.6));
}
// Castle colliders between knee and head height within r of (x, z).
function obstacles(x, z, r, y) {
  return castle.filter((c) => c.y1 > y + 0.35 && c.y0 < y + 2.1 && overlaps(c, x, z, r));
}

test('castle geometry and colliders are finite and within budget', () => {
  let tris = 0;
  world.scene.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `${o.name} has a non-finite vertex`);
    tris += a.length / 9;
  });
  assert.ok(tris > 20000 && tris < 170000, `triangle count ${tris}`);
  assert.ok(castle.length > 300);
  for (const c of castle) for (const k of ['x', 'z', 'y0', 'y1']) assert.ok(Number.isFinite(c[k]), `collider ${k}`);
  for (const c of castle) assert.ok(c.y1 > c.y0, 'collider has height');
});

test('every contract spot is walkable, clear and has standing room', () => {
  for (const [id, s] of Object.entries(RIFT_SPOTS)) {
    const t = terrain.heightAt(s.x, s.z);
    const y = floorAt(s.x, s.z, t);
    assert.ok(y < t + 0.5, `${id} is not raised onto architecture`);
    const r = Math.max(1, s.clear ?? 0);
    assert.deepEqual(obstacles(s.x, s.z, r, y).length, 0, `${id} has a castle collider within ${r} m`);
    assert.ok(world.colliders.ceilingAt(s.x, s.z, y, y + 2.1) > y + 2.1, `${id} has standing room`);
  }
});

test('the Hollow Duke and the Grand Warden keep 5 m to fight in', () => {
  for (const [x, z] of [[6000, 6160], [RIFT_SPOTS.chainward_grand_warden.x, RIFT_SPOTS.chainward_grand_warden.z]]) {
    const y = floorAt(x, z, terrain.heightAt(x, z));
    assert.deepEqual(obstacles(x, z, 5, y).length, 0, `boss ground at ${x}, ${z}`);
  }
});

test('the nave, the throne collar and the Deep Gate are left alone', () => {
  for (const k of RIFT_CASTLES.chainward.keepClear) {
    const hits = castle.filter((c) => {
      if (k.r) return overlaps(c, k.x, k.z, k.r);
      // rectangle: sample it
      for (let x = -k.w / 2; x <= k.w / 2; x += 2) for (let z = -k.d / 2; z <= k.d / 2; z += 2) if (overlaps(c, k.x + x, k.z + z, 0.01)) return true;
      return false;
    });
    assert.equal(hits.length, 0, `keep-clear area at ${k.x}, ${k.z}`);
  }
});

// Walk a polyline at half-metre steps: no riser over 0.55 m (up or down) and nothing of the
// castles at chest height across `half` metres either side of the line.
function walk(points, half, label) {
  let prev = null;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / 0.5));
    for (let j = i === 1 ? 0 : 1; j <= n; j++) {
      const x = ax + ((bx - ax) * j) / n, z = az + ((bz - az) * j) / n;
      const y = floorAt(x, z, prev ?? terrain.heightAt(x, z));
      if (prev !== null) assert.ok(Math.abs(y - prev) <= 0.55, `${label}: riser ${(y - prev).toFixed(2)} m at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      assert.ok(y > -5, `${label}: falls into the void at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (const o of [-half, 0, half]) {
        const px = x + nx * o, pz = z + nz * o;
        const hit = castle.find((c) => c.y0 < y + 1.3 && c.y1 > y + 1.1 && overlaps(c, px, pz, 0.05));
        assert.ok(!hit, `${label}: blocked at chest height at ${px.toFixed(1)}, ${pz.toFixed(1)} (y ${y.toFixed(1)})`);
      }
      prev = y;
    }
  }
}

test('the processional ways stay open; the gates on them can be walked through', () => {
  for (const w of RIFT_WAYS) walk(w.points.map((p) => [p[0], p[1]]), w.width / 2 - 0.5, w.id);
});

test('the bridge carries you over the Sundering from bridgehead to Bastion court', () => {
  const B = RIFT_CASTLES.bridge ?? RIFT_CASTLES.bastion.bridge;
  walk([[B.ax - 14, B.z], [B.bx + 2, B.z], [6250, B.z]], B.width / 2 - 0.8, 'bridge');
  const [lipE, lipW] = state.castles.chasmLips;
  assert.ok(lipW - lipE > 8, 'the bridge found the void between the lips');
});

test('the Garrison Steps climb terrace to terrace by their stairs', () => {
  walk([[5846, 6094], [5840, 6104], [5815, 6104], [5806, 6114], [5806, 6130], [5800, 6130], [5778, 6130], [5770, 6118]], 1.6, 'garrison stairs');
});

test('the anchors are in the shape the omens read', () => {
  const A = state.castles.anchors;
  const fin = (p) => ['x', 'y', 'z'].every((k) => Number.isFinite(p[k]));
  assert.deepEqual(A.relays.map((r) => r.id).sort(), RIFT_CASTLES.relays.map((r) => r.id).sort());
  for (const r of A.relays) {
    const def = RIFT_CASTLES.relays.find((q) => q.id === r.id);
    assert.ok(fin(r));
    assert.ok(Math.hypot(r.x - def.x, r.z - def.z) < 6, `${r.id} ring sits on its tower`);
    assert.ok(Math.abs(r.y - (terrain.heightAt(def.x, def.z) + def.ringH)) < 2.5, `${r.id} ring at ground + ringH`);
  }
  assert.ok(A.chains.length >= 6 && A.chains.length <= 15, `chains ${A.chains.length}`);
  assert.ok(A.banners.length >= 6 && A.banners.length <= 15, `banners ${A.banners.length}`);
  assert.ok(A.gibbets.length >= 6 && A.gibbets.length <= 15, `gibbets ${A.gibbets.length}`);
  for (const c of A.chains) {
    assert.ok(fin(c));
    const cw = RIFT_CASTLES.chainward;
    assert.ok(Math.hypot(c.x - cw.x, c.z - cw.z) < 90, 'chain points are on the Chainward');
    const r = A.relays.find((q) => q.id === c.toward);
    if (r) assert.ok(chainClear(world, c, r), `chain from ${c.id} to ${c.toward} runs clear`);
  }
  for (const b of A.banners) {
    assert.ok(fin(b) && Number.isFinite(b.nx) && Number.isFinite(b.nz) && b.len > 3);
    assert.ok(Math.abs(Math.hypot(b.nx, b.nz) - 1) < 0.05, 'banner normal is unit');
    // the cloth hangs in front of the face, clear of colliders, above the ground
    const x = b.x + b.nx * 0.5, z = b.z + b.nz * 0.5;
    assert.ok(b.y - b.len > terrain.heightAt(x, z) - 0.5, 'banner clears the ground');
    for (let y = b.y - b.len; y < b.y - 0.3; y += 1) assert.ok(!world.colliders.pointInside(x, y, z), `banner at ${b.x}, ${b.z} hangs free`);
  }
  for (const g of A.gibbets) {
    assert.ok(fin(g));
    assert.ok(g.y - 6.5 > terrain.heightAt(g.x, g.z), `gibbet at ${g.x}, ${g.z} has its drop`);
    for (let y = g.y - 6.5; y < g.y - 0.3; y += 0.5) assert.ok(!world.colliders.pointInside(g.x, y, g.z), `gibbet at ${g.x}, ${g.z} hangs free at ${y}`);
  }
});

test('the upended towers can be climbed ledge to ledge to their tops', () => {
  for (const u of RIFT_CASTLES.upended) {
    const g = terrain.heightAt(u.x, u.z);
    const tops = castle.filter((c) => c.walkable && Math.hypot(c.x - u.x, c.z - u.z) < 10 && c.y1 > g + 0.5).map((c) => c.y1).sort((a, b) => a - b);
    assert.ok(tops.length > 3, `${u.id} has ledges`);
    let prev = g;
    for (const y of tops) {
      assert.ok(y - prev < 10.5, `${u.id}: ${(y - prev).toFixed(1)} m between holds at ${y.toFixed(1)}`);
      prev = Math.max(prev, y);
    }
    assert.ok(prev > g + 25, `${u.id} stands tall`);
  }
});

test('footprints are excluded from vegetation and rock', () => {
  assert.ok(exclusions.length >= 12);
  for (const s of [RIFT_CASTLES.chainward, RIFT_CASTLES.bastion, RIFT_CASTLES.garrison, ...RIFT_CASTLES.relays, ...RIFT_CASTLES.upended]) {
    assert.ok(exclusions.some((e) => Math.hypot(e.x - s.x, e.z - s.z) < e.r), `exclusion covers ${s.id ?? s.x}`);
  }
  assert.ok(lights.length <= 16, 'only a few watch-lights');
});
