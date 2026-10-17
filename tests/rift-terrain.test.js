// The Rift's ground keeps the shared layout (data/riftLayout.js): the castles' pads are level at
// their heights, the processional ways can be walked, the chasm cuts the Bastion off and every
// place already in the Rift still stands on ground.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Terrain } from '../src/world/terrain.js';
import { NPCS, CHESTS, SPAWNERS, STRUCTURES, LOCATIONS } from '../src/data/world.js';
import '../src/data/rift.js';
import { RIFT_SITES } from '../src/data/riftResearch.js';
import '../src/data/riftSpire.js';
import '../src/data/riftSites.js';
import { LORE } from '../src/data/lore.js';
import { ARCHITECTURE } from '../src/data/architecture.js';
import { RIFT_PADS, RIFT_WAYS, RIFT_CHASMS, RIFT_SPOTS, RIFT_CASTLES, RIFT_CENTER } from '../src/data/riftLayout.js';
import { RIFT_TERRAIN } from '../src/data/riftTerrain.js';

const terrain = new Terrain();
const rift = terrain.byId.rift;
rift.build();
const H = (x, z) => terrain.heightAt(x, z);
const VOID = -20;

function padEdge(p, x, z) {
  const dx = x - p.x, dz = z - p.z;
  if (p.shape === 'rect') return Math.max(Math.abs(dx) / (p.w / 2), Math.abs(dz) / (p.d / 2));
  if (p.rx) return Math.hypot(dx / p.rx, dz / p.rz);
  return Math.hypot(dx, dz) / p.r;
}

test('every pad is level at its height inside its core', () => {
  for (const [id, pad] of Object.entries(RIFT_PADS)) {
    const resolved = rift.padList.find((p) => p.id === id);
    const h = pad.h === 'auto' ? resolved.h : pad.h;
    const core = pad.core ?? 0.6;
    const rx = pad.shape === 'rect' ? pad.w / 2 : pad.rx || pad.r;
    const rz = pad.shape === 'rect' ? pad.d / 2 : pad.rz || pad.r;
    let worst = 0, at = null;
    for (let x = pad.x - rx; x <= pad.x + rx; x += 1) {
      for (let z = pad.z - rz; z <= pad.z + rz; z += 1) {
        if (padEdge(pad, x, z) > core) continue;
        // a higher pad nested inside this one (the Chainward's upper ward) owns its own core
        if (Object.values(RIFT_PADS).some((q) => q !== pad && q.h !== pad.h && padEdge(q, x, z) < 1)) continue;
        const d = Math.abs(H(x, z) - h);
        if (d > worst) { worst = d; at = [x, z]; }
      }
    }
    assert.ok(worst <= 0.3, `${id} is off level by ${worst.toFixed(2)} m at ${at}`);
  }
});

test('the chasm is open void and cuts the Bastion off from the basin', () => {
  for (const c of [...RIFT_CHASMS, ...RIFT_TERRAIN.fissures]) {
    let total = 0;
    for (let i = 1; i < c.points.length; i++) total += Math.hypot(c.points[i][0] - c.points[i - 1][0], c.points[i][1] - c.points[i - 1][1]);
    let along = 0;
    for (let i = 1; i < c.points.length; i++) {
      const [ax, az] = c.points[i - 1], [bx, bz] = c.points[i];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(L);
      for (let k = 0; k <= n; k++) {
        const s = along + (L * k) / n;
        // a tapered fissure narrows to a point: only test where it is wider than a mesh cell
        const half = (c.width / 2) * (c.taper ? Math.sqrt(Math.min(1, Math.min(s, total - s) / c.taper)) : 1);
        if (half < 3) continue;
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        assert.ok(H(x, z) < -100, `chasm ${c.id} has ground at ${x.toFixed(0)},${z.toFixed(0)}`);
      }
      along += L;
    }
  }
  // flood the land from the Bastion over the terrain grid: it must never reach the basin
  const { nx, nz, V, heights, x0, z0, cellX, cellZ } = rift;
  const idx = (x, z) => Math.round((z - z0) / cellZ) * V + Math.round((x - x0) / cellX);
  const seen = new Uint8Array(heights.length);
  const stack = [idx(RIFT_CASTLES.bastion.x, RIFT_CASTLES.bastion.z)];
  let reachedBasin = false;
  const basin = idx(RIFT_CENTER.x, RIFT_CENTER.z);
  while (stack.length) {
    const k = stack.pop();
    if (seen[k] || heights[k] < VOID) continue;
    seen[k] = 1;
    if (k === basin) { reachedBasin = true; break; }
    const i = k % V, j = (k - i) / V;
    if (i > 0) stack.push(k - 1);
    if (i < nx) stack.push(k + 1);
    if (j > 0) stack.push(k - V);
    if (j < nz) stack.push(k + V);
  }
  assert.ok(!reachedBasin, 'there is a land path from the Bastion to the basin around the chasm');
});

test('every processional way can be walked end to end across its width', () => {
  const bridge = RIFT_CASTLES.bastion.bridge;
  const carried = {
    bastion: (x) => x >= bridge.ax && x <= bridge.bx,
    chainward: (x, z) => z >= 6108 && z <= 6128,
  };
  for (const way of RIFT_WAYS) {
    const skip = carried[way.id] || (() => false);
    for (const side of [-1, 0, 1]) {
      let prev = null;
      for (let i = 1; i < way.points.length; i++) {
        const [ax, az] = way.points[i - 1], [bx, bz] = way.points[i];
        const L = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / L, nz = (bx - ax) / L;
        const off = (side * way.width) / 2;
        for (let s = 0; s <= L; s += 1) {
          const x = ax + ((bx - ax) * s) / L + nx * off, z = az + ((bz - az) * s) / L + nz * off;
          if (skip(x, z)) { prev = null; continue; }
          const h = H(x, z);
          assert.ok(Number.isFinite(h) && h > VOID, `${way.id} falls into the void at ${x.toFixed(0)},${z.toFixed(0)}`);
          if (prev) {
            const run = Math.hypot(x - prev.x, z - prev.z) || 1;
            const rise = Math.abs(h - prev.h);
            assert.ok(rise <= 0.5, `${way.id} has a ${rise.toFixed(2)} m step at ${x.toFixed(0)},${z.toFixed(0)}`);
            assert.ok(rise / run < 0.45, `${way.id} is too steep (${(rise / run).toFixed(2)}) at ${x.toFixed(0)},${z.toFixed(0)}`);
          }
          prev = { x, z, h };
        }
      }
    }
  }
});

// Everything already placed in the Rift: camps, NPCs, chests, records, spawners, gates, sites.
function riftContent() {
  const inRift = (p) => p && Number.isFinite(p.x) && Math.hypot(p.x - RIFT_CENTER.x, p.z - RIFT_CENTER.z) < 360;
  const out = [];
  const add = (kind, list) => { for (const p of list) if (inRift(p)) out.push({ kind, id: p.id || p.type || p.name, x: p.x, z: p.z }); };
  add('npc', NPCS); add('chest', CHESTS); add('spawner', SPAWNERS); add('structure', STRUCTURES); add('lore', LORE);
  add('location', LOCATIONS); add('architecture', ARCHITECTURE);
  add('site', Object.entries(RIFT_SITES).map(([id, p]) => ({ id, ...p })));
  add('spot', Object.entries(RIFT_SPOTS).map(([id, p]) => ({ id, ...p })));
  return out;
}

test('every place in the Rift stands on ground, not on a cliff or over the void', () => {
  const content = riftContent();
  assert.ok(content.length > 100);
  for (const p of content) {
    const h = H(p.x, p.z);
    assert.ok(h > VOID, `${p.kind} ${p.id} at ${p.x},${p.z} is over the void`);
    const e = 1;
    const slope = Math.hypot(H(p.x + e, p.z) - H(p.x - e, p.z), H(p.x, p.z + e) - H(p.x, p.z - e)) / (2 * e);
    assert.ok(slope < 0.6, `${p.kind} ${p.id} at ${p.x},${p.z} stands on a ${slope.toFixed(2)} slope`);
  }
});

test('the roof columns stand in the open void', () => {
  // world/riftCeiling.js COLUMNS: [degrees from +x toward +z, radius]
  for (const [deg, r] of [[22, 268], [118, 262], [196, 282], [262, 270], [318, 286]]) {
    const a = (deg * Math.PI) / 180;
    const x = RIFT_CENTER.x + Math.cos(a) * r, z = RIFT_CENTER.z + Math.sin(a) * r;
    for (let k = 0; k < 16; k++) {
      const b = (k / 16) * Math.PI * 2;
      const h = H(x + Math.cos(b) * 14, z + Math.sin(b) * 14);
      assert.ok(h < -100, `land reaches the roof column at ${deg}° (${h.toFixed(1)} m)`);
    }
  }
});

test('the Ascent plaza keeps its height', () => {
  for (let a = 0; a < 16; a++) {
    for (const r of [0, 10, 20]) {
      const x = 6000 + Math.cos(a) * r, z = 5988 + Math.sin(a) * r;
      assert.ok(Math.abs(H(x, z) - 10.6) < 0.01, `the Ascent plaza is ${H(x, z).toFixed(2)} at ${x.toFixed(0)},${z.toFixed(0)}`);
    }
  }
});

test('the Rift rock stands clear of every place, pad and way', async () => {
  const THREE = await import('three');
  const { Colliders } = await import('../src/world/colliders.js');
  const { buildRiftRock } = await import('../src/world/riftRock.js');
  const world = { scene: new THREE.Scene(), terrain, colliders: new Colliders() };
  const state = { low: false };
  const exclusions = [];
  buildRiftRock(world, exclusions, state);
  assert.ok(state.rock.pieces > 200, `only ${state.rock.pieces} pieces of rock`);
  // the scatter that follows (vegetation, boulders, forage) is kept off every way and pad
  const excluded = (x, z, pad) => exclusions.some((e) => Math.hypot(x - e.x, z - e.z) < e.r - pad);
  for (const way of RIFT_WAYS) {
    for (let i = 1; i < way.points.length; i++) {
      const [ax, az] = way.points[i - 1], [bx, bz] = way.points[i];
      const L = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= L; s += 1) {
        const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L;
        assert.ok(excluded(x, z, way.width / 2 + 1), `scatter is not kept off the ${way.id} way at ${x.toFixed(0)},${z.toFixed(0)}`);
      }
    }
  }
  for (const [id, pad] of Object.entries(RIFT_PADS)) assert.ok(excluded(pad.x, pad.z, 1), `scatter is not kept off the ${id} pad`);
  const rock = world.colliders.query(RIFT_CENTER.x, RIFT_CENTER.z, 420).filter((c) => c.tag === 'rift_rock');
  assert.ok(rock.length === state.rock.pieces);
  const hits = (x, z, r) => rock.filter((c) => {
    if (![c.y0, c.y1].every(Number.isFinite)) return true;
    if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + r;
    const [lx, lz] = world.colliders._local(c, x, z);
    return Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r;
  });
  for (const p of riftContent()) assert.deepEqual(hits(p.x, p.z, 2), [], `rock on ${p.kind} ${p.id}`);
  for (const way of RIFT_WAYS) {
    for (let i = 1; i < way.points.length; i++) {
      const [ax, az] = way.points[i - 1], [bx, bz] = way.points[i];
      const L = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= L; s += 1) {
        const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L;
        assert.deepEqual(hits(x, z, way.width / 2), [], `rock across the ${way.id} way at ${x.toFixed(0)},${z.toFixed(0)}`);
      }
    }
  }
  for (const [id, pad] of Object.entries(RIFT_PADS)) {
    for (const c of rock) assert.ok(padEdge(pad, c.x, c.z) > 1, `rock inside the ${id} pad at ${c.x.toFixed(0)},${c.z.toFixed(0)}`);
  }
});

test('levelled pads stand at one height', () => {
  for (const g of RIFT_TERRAIN.levelled) {
    const hs = g.pads.map((id) => H(RIFT_PADS[id].x, RIFT_PADS[id].z));
    assert.ok(Math.max(...hs) - Math.min(...hs) < 0.05, `${g.pads.join(', ')} stand at ${hs.map((h) => h.toFixed(2)).join(', ')}`);
  }
});
