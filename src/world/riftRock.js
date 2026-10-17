// The Rift's rock: the stone the floor is made of where it breaks. The ground itself is the
// 'rift' island (data/world.js, data/riftTerrain.js); this gives its edges the blocky stacked
// stone the surface gets from world/cliffs.js:
//   crags   basalt stacks along every lip where the floor breaks off into the void (the rim, the
//           Sundering chasm, the fissure and the sinkholes), stepped like broken courses;
//   skins   blocks on each mesa tier's edge, so every riser ends in a sheer face;
//   organs  packed hexagonal columns standing on the mesas and the south-east shelf.
// Every piece is a climbable collider with a walkable top (tag 'rift_rock'), and keeps clear of
// the castles' pads, the processional ways and every place already in the Rift.
import * as THREE from 'three';
import { seededRandom } from '../core/util.js';
import { mat } from './props.js';
import { groundRange } from './kit.js';
import { RIFT_TERRAIN } from '../data/riftTerrain.js';
import { RIFT_PADS, RIFT_WAYS, RIFT_SPOTS, RIFT_CENTER } from '../data/riftLayout.js';
import { NPCS, SPAWNERS, CHESTS, STRUCTURES } from '../data/world.js';
import { LORE } from '../data/lore.js';

const VOID = -20;
const TAG = 'rift_rock';
const BASALT = ['#3b3547', '#433c50', '#35303f', '#4a4257', '#3f3a4a'];
// Caps match the drowned ground (biomeGround.js 'rift'), with a little lighter stone and moss.
const CAP = ['#433a52', '#3d354b', '#4b4259', '#3a4a4c'];

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitHex = new THREE.CylinderGeometry(1, 1, 1, 6);

class Batch {
  constructor(geo, name) {
    this.geo = geo;
    this.name = name;
    this.items = [];
  }
  add(x, y0, y1, z, sx, sz, yaw, color, rx = 0, rz = 0) {
    this.items.push({ x, y: (y0 + y1) / 2, z, sx, sy: y1 - y0, sz, yaw, color, rx, rz });
  }
  build(scene, shadow) {
    if (!this.items.length) return null;
    const im = new THREE.InstancedMesh(this.geo, mat('#ffffff', { roughness: 0.95 }), this.items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    this.items.forEach((it, i) => {
      q.setFromEuler(e.set(it.rx, it.yaw, it.rz, 'YXZ'));
      m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sz));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, c.set(it.color));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    // Named like the surface cliffs so world.js fog-culls them with the ground.
    im.name = 'cliffs';
    scene.add(im);
    return im;
  }
}

function distToPolyline(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az;
    const L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

function padEdge(p, x, z) {
  const dx = x - p.x, dz = z - p.z;
  if (p.shape === 'rect') return Math.max(Math.abs(dx) / (p.w / 2), Math.abs(dz) / (p.d / 2));
  if (p.rx) return Math.hypot(dx / p.rx, dz / p.rz);
  return Math.hypot(dx, dz) / p.r;
}

// Everything rock must leave clear: places, pads, ways and whatever earlier passes excluded.
// Shared with the floor's dressing (world/riftFloor.js).
export function clearance(exclusions) {
  const inRift = (p) => p && Number.isFinite(p.x) && Math.hypot(p.x - RIFT_CENTER.x, p.z - RIFT_CENTER.z) < 420;
  const points = [];
  for (const e of exclusions) if (inRift(e)) points.push({ x: e.x, z: e.z, r: e.r });
  for (const p of [...NPCS, ...LORE, ...CHESTS, ...Object.values(RIFT_SPOTS)]) if (inRift(p)) points.push({ x: p.x, z: p.z, r: 6 });
  for (const s of SPAWNERS) if (inRift(s)) points.push({ x: s.x, z: s.z, r: (s.radius || 0) + 6 });
  for (const s of STRUCTURES) if (inRift(s)) points.push({ x: s.x, z: s.z, r: 9 });
  // the Ascent's plaza, the arrival shelf and the harbour fall's splash
  points.push({ x: 6000, z: 5988, r: 44 }, { x: 6000, z: 5830, r: 30 }, { x: 6014, z: 5900, r: 10 });
  const pads = Object.values(RIFT_PADS);
  return (x, z, r) => {
    for (const p of points) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + r) ** 2) return false;
    for (const p of pads) {
      const size = p.shape === 'rect' ? Math.min(p.w, p.d) / 2 : Math.min(p.rx || p.r, p.rz || p.r);
      if (padEdge(p, x, z) < 1 + (r + 3) / size) return false;
    }
    for (const w of RIFT_WAYS) if (distToPolyline(w.points, x, z) < w.width / 2 + r + 3) return false;
    return true;
  };
}

export function buildRiftRock(world, exclusions, state) {
  const { terrain, colliders, scene } = world;
  const rift = terrain.byId && terrain.byId.rift;
  if (!rift) return;
  const low = !!state.low;
  const rng = seededRandom(66061);
  const H = (x, z) => terrain.heightAt(x, z);
  const free = clearance(exclusions);
  const stone = new Batch(unitBox, 'rift_rock_box');
  const cap = new Batch(unitBox, 'rift_rock_cap');
  const hex = new Batch(unitHex, 'rift_rock_hex');
  const hexCap = new Batch(unitHex, 'rift_rock_hexcap');
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const placed = [];

  // One block standing on the ground under its footprint, its top at `top`.
  const block = (x, z, w, d, yaw, top, o = {}) => {
    const [lo, hi] = groundRange(terrain, x, z, w, d, yaw, 2);
    if (hi < VOID) return false;
    top = Math.max(top, hi + 0.8);
    // a lip block runs on down the face of the break, but not all the way to the void floor
    const bottom = Math.max(lo - 2.5, hi - 34);
    stone.add(x, bottom, top, z, w, d, yaw, o.color || pick(BASALT), o.rx || 0, o.rz || 0);
    if (!o.rx && !o.rz) cap.add(x, top, top + 0.4, z, w + 0.35, d + 0.35, yaw, pick(CAP));
    colliders.addBox({ x, z, w, d, y0: bottom, y1: top + 0.4, rot: yaw, climbable: true, tag: TAG });
    placed.push({ x, z, r: Math.max(w, d) * 0.6 });
    return true;
  };
  const column = (x, z, r, top, o = {}) => {
    const [lo, hi] = groundRange(terrain, x, z, r * 2, r * 2, 0, 1);
    if (lo < VOID) return false;
    top = Math.max(top, hi + 0.6);
    const yaw = o.yaw ?? rng() * Math.PI;
    hex.add(x, lo - 1.5, top, z, r, r, yaw, o.color || pick(BASALT), o.rx || 0, o.rz || 0);
    if (!o.rx && !o.rz) hexCap.add(x, top, top + 0.3, z, r * 1.06, r * 1.06, yaw, pick(CAP));
    colliders.addCyl({ x, z, r: r * 0.95, y0: lo - 1.5, y1: top + 0.3, climbable: true, tag: TAG });
    placed.push({ x, z, r });
    return true;
  };

  // ------------------------------------------------------------ crags along every lip
  // Lip cells: ground with void within 7 m. The outward normal points at the void.
  const lips = [];
  const step = 5;
  const probe = 7;
  const dirs = [];
  for (let k = 0; k < 12; k++) dirs.push([Math.cos((k / 12) * Math.PI * 2), Math.sin((k / 12) * Math.PI * 2)]);
  for (let z = rift.z0; z <= rift.z0 + rift.sizeZ; z += step) {
    for (let x = rift.x0; x <= rift.x0 + rift.sizeX; x += step) {
      const h = H(x, z);
      if (h < -1) continue;
      let nx = 0, nz = 0, n = 0;
      for (const [dx, dz] of dirs) if (H(x + dx * probe, z + dz * probe) < VOID) { nx += dx; nz += dz; n++; }
      if (!n || n > 9) continue;
      const l = Math.hypot(nx, nz) || 1;
      lips.push({ x, z, h, nx: nx / l, nz: nz / l });
    }
  }
  // shuffle, then keep lip points at least `spacing` apart
  for (let i = lips.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lips[i], lips[j]] = [lips[j], lips[i]];
  }
  const spacing = low ? 15 : 9;
  const kept = [];
  const cell = new Map();
  const key = (x, z) => `${Math.floor(x / spacing)},${Math.floor(z / spacing)}`;
  for (const p of lips) {
    let ok = true;
    const cx = Math.floor(p.x / spacing), cz = Math.floor(p.z / spacing);
    for (let i = -1; i <= 1 && ok; i++) for (let j = -1; j <= 1 && ok; j++) {
      for (const q of cell.get(`${cx + i},${cz + j}`) || []) if (Math.hypot(q.x - p.x, q.z - p.z) < spacing) { ok = false; break; }
    }
    if (!ok) continue;
    kept.push(p);
    const k = key(p.x, p.z);
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(p);
  }
  let crags = 0;
  for (const p of kept) {
    // gaps in the rim, so it reads as broken ground rather than a fence
    if (rng() < 0.22) continue;
    const tangent = Math.atan2(p.nx, p.nz) + Math.PI / 2;
    const tx = Math.sin(tangent), tz = Math.cos(tangent);
    const inset = 2 + rng() * 3.5;
    const cx = p.x - p.nx * inset, cz = p.z - p.nz * inset;
    if (!free(cx, cz, 5)) continue;
    // Mostly low broken courses; now and then a stack stands tall over the drop.
    const spire = rng() < (p.h > 10 ? 0.16 : 0.08);
    let top = H(cx, cz) + (spire ? 9 + rng() * 9 : 1.5 + rng() * 4.5);
    if (spire) column(cx, cz, 1.8 + rng() * 1.4, top);
    else {
      const slump = rng() < 0.3 ? 0.12 + rng() * 0.2 : 0;
      block(cx, cz, 4 + rng() * 5, 2.5 + rng() * 3, tangent + (rng() - 0.5) * 0.25, top,
        slump ? { rx: slump * p.nz, rz: -slump * p.nx } : {});
    }
    // The courses behind it step down inland, like strata broken off at the edge.
    const n = Math.floor(rng() * (low ? 2 : 4));
    for (let b = 0; b < n; b++) {
      const along = (rng() - 0.5) * 8;
      const inward = 2.5 + b * 2.5 + rng() * 2;
      const x = cx + tx * along - p.nx * inward;
      const z = cz + tz * along - p.nz * inward;
      if (!free(x, z, 3)) continue;
      top -= 1.2 + rng() * 2.4;
      if (top < H(x, z) + 0.8) break;
      if (rng() < 0.3) column(x, z, 1.2 + rng() * 1.2, top);
      else block(x, z, 3 + rng() * 4.5, 2.5 + rng() * 2.5, tangent + (rng() - 0.5) * 0.4, top);
    }
    crags++;
  }

  // ------------------------------------------------------------ skins on the mesa risers
  // terrain.js escarpments step at box-metric edges ~0.99, 0.81 and 0.61 of (rx, rz).
  for (const s of RIFT_TERRAIN.shelves) {
    if (s.skin === false) continue;
    for (const e of [0.99, 0.81, 0.61]) {
      const hx = s.rx * e, hz = s.rz * e;
      const sides = [
        { ax: -hx, az: -hz, bx: hx, bz: -hz, nx: 0, nz: -1 },
        { ax: hx, az: -hz, bx: hx, bz: hz, nx: 1, nz: 0 },
        { ax: hx, az: hz, bx: -hx, bz: hz, nx: 0, nz: 1 },
        { ax: -hx, az: hz, bx: -hx, bz: -hz, nx: -1, nz: 0 },
      ];
      for (const sd of sides) {
        const len = Math.hypot(sd.bx - sd.ax, sd.bz - sd.az);
        const n = Math.max(1, Math.round(len / (low ? 7 : 5)));
        const yaw = Math.atan2(sd.bx - sd.ax, sd.bz - sd.az) + Math.PI / 2;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const px = s.x + sd.ax + (sd.bx - sd.ax) * t, pz = s.z + sd.az + (sd.bz - sd.az) * t;
          if (!free(px, pz, 3)) continue;
          const top = H(px - sd.nx * 2.5, pz - sd.nz * 2.5) + 0.2 + (rng() < 0.25 ? rng() * 1.6 : 0);
          const foot = H(px + sd.nx * 3.5, pz + sd.nz * 3.5);
          if (foot < VOID || top - foot < 1.2) continue;
          block(px + sd.nx * 1.0, pz + sd.nz * 1.0, len / n + 0.6 + rng() * 0.8, 2.6 + rng() * 1.4, yaw + (rng() - 0.5) * 0.08, top, { color: BASALT[(i + Math.round(e * 10)) % BASALT.length] });
        }
      }
    }
  }

  // ------------------------------------------------------------ basalt organs
  for (const o of RIFT_TERRAIN.organs || []) {
    const pitch = 2.7;
    const lat = [];
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = o.x + (i + (j % 2) * 0.5) * pitch, z = o.z + j * pitch * 0.866;
      const d = Math.hypot(x - o.x, z - o.z) / o.r;
      if (d <= 1 && rng() < (low ? 0.45 : 0.82)) lat.push({ x, z, d });
    }
    const base = H(o.x, o.z);
    for (const c of lat) {
      if (!free(c.x, c.z, 1.5)) continue;
      // tallest toward one side of the cluster, as if the flow cooled against a wall
      const lean = 0.5 + 0.5 * ((c.x - o.x) * Math.cos(o.face ?? 0) + (c.z - o.z) * Math.sin(o.face ?? 0)) / o.r;
      const top = base + o.h[0] + (o.h[1] - o.h[0]) * Math.max(0, Math.min(1, (1 - c.d) * 0.6 + lean * 0.4 + (rng() - 0.5) * 0.3));
      const broken = rng() < 0.12;
      column(c.x, c.z, 1.2 + rng() * 0.25, top, broken ? { rx: (rng() - 0.5) * 0.5, rz: (rng() - 0.5) * 0.5 } : { yaw: 0 });
    }
  }

  stone.build(scene, true);
  cap.build(scene, false);
  hex.build(scene, true);
  hexCap.build(scene, false);
  for (const p of placed) exclusions.push(p);
  // The scatter after this (props.js vegetation and boulders, forage) only avoids `exclusions`:
  // keep it off the processional ways and the castles' pads too.
  for (const w of RIFT_WAYS) {
    for (let i = 1; i < w.points.length; i++) {
      const [ax, az] = w.points[i - 1], [bx, bz] = w.points[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) exclusions.push({ x: ax + ((bx - ax) * k) / n, z: az + ((bz - az) * k) / n, r: w.width / 2 + 3 });
    }
  }
  for (const p of Object.values(RIFT_PADS)) {
    const r = p.shape === 'rect' ? Math.hypot(p.w, p.d) / 2 : Math.max(p.rx || p.r, p.rz || p.r);
    exclusions.push({ x: p.x, z: p.z, r: r + 2 });
  }
  state.rock = { crags, pieces: placed.length };
}
