// Stone outcrops dress the edges of the terrain shelves. They follow existing cliff lips
// instead of scattering small mesas over otherwise level ground. Tops remain walkable.
// Instanced per island so off-screen islands are culled.
import * as THREE from 'three';
import { ISLANDS, islandAreaFactor, islandScatter, biomeOfPoint, START_POS } from '../data/world.js';
import { BIOME_COLORS } from './terrain.js';
import { seededRandom } from '../core/util.js';
import { G } from '../core/globals.js';
import { mat, fogCullable, cullPastFog } from './props.js';
import { excludedAt } from './exclusionIndex.js';

// clusters per classic 175m island, by biome
const DENSITY = { meadow: 9, forest: 14, emberwood: 14, highland: 26, farmland: 0, snow: 22, tundra: 14, volcanic: 16, ashfield: 14, jungle: 20, bastion: 16, hush: 11, rock: 5, marsh: 3, beach: 1 };
const STONE = {
  default: ['#c4c2b7', '#b6b4a9', '#cfccc0', '#a9a79c'],
  highland: ['#aeab9f', '#9f9c91', '#bab7ab'],
  snow: ['#a4adb4', '#b8c0c6', '#95a0a8'],
  tundra: ['#a8aeae', '#b9bdb8', '#979d9c'],
  volcanic: ['#3e3632', '#4a403a', '#332c29'],
  ashfield: ['#4a423c', '#574e46', '#3c3530'],
  emberwood: ['#55504a', '#4a4641', '#605a52'],
  hush: ['#858c96', '#78808b', '#929aa3'],
  marsh: ['#7d7e6c', '#6f705f'],
  jungle: ['#a7a898', '#98998a', '#b3b4a3'],
};
const CAP = { snow: '#f2f5f8', tundra: '#dfe5e6', volcanic: '#4e433c', ashfield: '#5a5048', hush: '#d6dce2' };

const unitBox = new THREE.BoxGeometry(1, 1, 1);

class Batch {
  constructor(material) {
    this.material = material;
    this.items = [];
  }
  add(x, y, z, w, h, d, yaw, color) {
    this.items.push({ x, y, z, w, h, d, yaw, color });
  }
  build(scene, shadow) {
    if (!this.items.length) return;
    const im = new THREE.InstancedMesh(unitBox, this.material, this.items.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    this.items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.yaw);
      m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.w, it.h, it.d));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, c.set(it.color));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = 'cliffs';
    scene.add(im);
  }
}

export function buildCliffs(world, exclusions) {
  const { terrain, colliders, scene } = world;
  const excluded = (x, z, pad) => excludedAt(exclusions, x, z, pad);
  const stoneMat = mat('#ffffff');
  const capMat = mat('#ffffff', { roughness: 1 });
  let total = 0;
  const dressing = {
    scree: new Scatter(GEO.scree, mat('#ffffff'), { maxDist: 380, shadow: true }),
    tuft: new Scatter(GEO.tuft, mat('#ffffff'), { maxDist: 150 }),
    drape: new Scatter(GEO.drape, mat('#ffffff', { double: true }), { maxDist: 300 }),
    cornice: new Scatter(GEO.scree, mat('#ffffff', { roughness: 1 }), { maxDist: 420 }),
  };
  for (const isl of ISLANDS) {
    if (isl.cx > 3000) continue; // the Rift is shaped elsewhere
    const tIsl = terrain.byId[isl.id];
    // Block terrain draws its own walls where its shelves meet (world/landforms.js); they are
    // dressed along their own feet and lips instead of with scattered boxes.
    if (tIsl?.blocks) {
      total += dressWalls(world, tIsl, exclusions, dressing);
      total += dressShore(world, tIsl, isl, exclusions, dressing);
      continue;
    }
    const rng = seededRandom(isl.seed * 4243 + 7);
    const stone = new Batch(stoneMat);
    const cap = new Batch(capMat);
    // a shared grain per island so neighbouring blocks read as one rock formation
    const grain = rng() * Math.PI;
    const clusters = Math.round((DENSITY[isl.biome] ?? 10) * islandAreaFactor(isl) * 0.35);
    for (let c = 0; c < clusters; c++) {
      let spot = null;
      for (let t = 0; t < 25 && !spot; t++) {
        const [x, z] = islandScatter(isl, rng);
        const h = terrain.heightAt(x, z);
        if (h < 3.2) continue;
        // Keep the Wash camp terrace open — no grass-capped mesa on the spawn flat.
        if (isl.id === 'saltreach' && z < -278 && z > -368 && x > -55 && x < 55 && h < 4.2) continue;
        // hillsides and shelf edges, not the middle of every meadow
        const e = 4;
        const slope = Math.hypot(terrain.heightAt(x + e, z) - terrain.heightAt(x - e, z), terrain.heightAt(x, z + e) - terrain.heightAt(x, z - e)) / (2 * e);
        if (slope < 0.45) continue;
        if (excluded(x, z, 9)) continue;
        // No random mesa blocks on the open Wash beach where players wake.
        if (isl.id === 'saltreach' && Math.hypot(x - START_POS.x, z - START_POS.z) < 52) continue;
        if (tIsl && tIsl.roads.length && tIsl.roadAt(x, z).d < 6) continue;
        spot = { x, z, h };
      }
      if (!spot) continue;
      const biome = biomeOfPoint(isl, spot.x, spot.z);
      const pal = STONE[biome] || STONE.default;
      const capCol = CAP[biome] || (BIOME_COLORS[biome] || BIOME_COLORS.meadow).grass;
      const n = 1 + Math.floor(rng() * 4);
      for (let b = 0; b < n; b++) {
        const yaw = grain + (rng() < 0.7 ? 0 : Math.PI / 4) + (rng() - 0.5) * 0.12;
        const w = 5 + rng() * 10;
        const d = 5 + rng() * 10;
        const ox = b === 0 ? 0 : (rng() - 0.5) * 16;
        const oz = b === 0 ? 0 : (rng() - 0.5) * 16;
        const x = spot.x + ox;
        const z = spot.z + oz;
        if (b > 0 && excluded(x, z, 6)) continue;
        // footprint ground range
        let lo = Infinity;
        let hi = -Infinity;
        for (const [sx, sz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0]]) {
          const lx = sx * w;
          const lz = sz * d;
          const gx = x + lx * Math.cos(yaw) + lz * Math.sin(yaw);
          const gz = z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
          const gh = terrain.heightAt(gx, gz);
          lo = Math.min(lo, gh);
          hi = Math.max(hi, gh);
        }
        if (lo < 0.5) continue; // keep the shoreline open
        // Rock dresses an existing cliff lip, never invents another small hill.
        const top = hi + 0.35;
        const bottom = lo - 2.5;
        const color = pal[Math.floor(rng() * pal.length)];
        stone.add(x, (top + bottom) / 2, z, w, top - bottom, d, yaw, color);
        cap.add(x, top + 0.18, z, w + 0.5, 0.5, d + 0.5, yaw, capCol);
        colliders.addBox({ x, z, w, d, y0: bottom, y1: top + 0.43, rot: yaw, climbable: true });
        exclusions.push({ x, z, r: Math.max(w, d) * 0.62 });
        total++;
      }
    }
    stone.build(scene, true);
    cap.build(scene, false);
  }
  const chunks = [];
  for (const sc of Object.values(dressing)) sc.build(scene, chunks);
  // Small things drop out a little way off, like the grass; the rest goes with the fog.
  world.animated.push(() => {
    const cam = G.game?.camera;
    if (cam && scene.fog) cullPastFog(chunks, cam, scene.fog.far);
  });
  return total;
}

// ---------------------------------------------------------------- block-wall dressing
const GEO = {
  scree: new THREE.DodecahedronGeometry(1, 0),
  tuft: (() => { const g = new THREE.ConeGeometry(0.18, 0.6, 3); g.translate(0, 0.3, 0); return g; })(),
  // a clump of turf and roots slumped over a lip: top at y = 0, hanging 1 m below
  drape: (() => { const g = new THREE.DodecahedronGeometry(0.5, 0); g.translate(0, -0.5, 0); return g; })(),
};
const GREEN = new Set(['meadow', 'forest', 'emberwood', 'highland', 'farmland', 'jungle', 'marsh', 'bastion', 'dunes', 'beach']);
const VEG_CELL = 192;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// Instances split into map cells, so the camera, the shadow frustum and the fog can drop them.
class Scatter {
  constructor(geo, material, o = {}) {
    this.geo = geo;
    this.material = material;
    this.o = o;
    this.items = [];
  }
  add(x, y, z, sx, sy, sz, yaw, color, rx = 0, rz = 0) {
    this.items.push([x, y, z, sx, sy, sz, yaw, color, rx, rz]);
  }
  build(scene, chunks) {
    const cells = new Map();
    for (const it of this.items) {
      const key = Math.floor(it[0] / VEG_CELL) * 100003 + Math.floor(it[2] / VEG_CELL);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(it);
    }
    for (const items of cells.values()) {
      const im = new THREE.InstancedMesh(this.geo, this.material, items.length);
      items.forEach(([x, y, z, sx, sy, sz, yaw, color, rx, rz], i) => {
        _q.setFromEuler(_e.set(rx, yaw, rz, 'YXZ'));
        im.setMatrixAt(i, _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
        im.setColorAt(i, _c.copy(color));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = !!this.o.shadow;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      im.name = 'cliff_dressing';
      scene.add(im);
      chunks.push(fogCullable(im, this.o.maxDist ?? Infinity));
    }
  }
}

// Boulders at the waterline: rocky coasts are strewn with them, sand beaches carry a few,
// the fen's mud shores none. Half sunk and darker where the sea wets them.
const SHORE_ROCKS = { rock: 0.45, snow: 0.2, tundra: 0.25, volcanic: 0.3, ashfield: 0.3, emberwood: 0.24, hush: 0.28, highland: 0.22, forest: 0.14, bastion: 0.18, meadow: 0.08, jungle: 0.08, farmland: 0.05, beach: 0.04, dunes: 0.035, marsh: 0 };
function dressShore(world, isl, def, exclusions, d) {
  const rng = seededRandom(isl.seed * 3301 + 17);
  const docks = Object.values(world.docks || {});
  const nearDock = (x, z) => docks.some((k) => {
    const dx = k.end.x - k.start.x, dz = k.end.z - k.start.z, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - k.start.x) * dx + (z - k.start.z) * dz) / L));
    return Math.hypot(x - k.start.x - dx * t, z - k.start.z - dz * t) < 9;
  });
  const near = (x, z, r) => excludedAt(exclusions, x, z, r);
  const P = {};
  const pal = (b) => (P[b] ||= Object.fromEntries(Object.entries(BIOME_COLORS[b] || BIOME_COLORS.meadow).map(([k, v]) => [k, new THREE.Color(v)])));
  const step = isl.cellX * 2;
  let n = 0;
  for (let j = 1; j < isl.nz; j++) {
    for (let i = 1; i < isl.nx; i++) {
      const x = isl.x0 + i * isl.cellX, z = isl.z0 + j * isl.cellZ;
      const h = isl.sample(x, z);
      if (h < -0.7 || h > 0.8) continue;
      const biome = biomeOfPoint(def, x, z);
      const p = SHORE_ROCKS[biome] ?? 0.08;
      if (!p || rng() > p) continue;
      // a shoreline: open water a couple of cells off one side
      let wet = null;
      for (const [ox, oz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) if (isl.sample(x + ox, z + oz) < -0.5) { wet = [ox / step, oz / step]; break; }
      if (!wet || near(x, z, 2) || nearDock(x, z) || (isl.roads.length && isl.roadAt(x, z).d < 5)) continue;
      const C = pal(biome);
      const big = biome === 'rock' || biome === 'snow' || biome === 'tundra' || biome === 'hush' || biome === 'volcanic' || biome === 'ashfield' || biome === 'emberwood' || biome === 'highland';
      const count = 1 + Math.floor(rng() * (big ? 3 : 2));
      for (let k = 0; k < count; k++) {
        const out = rng() * 2.5;
        const rx = x + wet[0] * out + (rng() - 0.5) * 3, rz = z + wet[1] * out + (rng() - 0.5) * 3;
        const s = (big ? 0.7 : 0.45) + rng() * rng() * (big ? 1.6 : 0.9);
        const y = Math.min(isl.sample(rx, rz), isl.sample(rx + s * 0.7, rz), isl.sample(rx - s * 0.7, rz), isl.sample(rx, rz + s * 0.7), isl.sample(rx, rz - s * 0.7));
        _c.copy(C.rock).lerp(C.high, 0.15 + rng() * 0.2).lerp(C.under, 0.2).multiplyScalar(0.7 + rng() * 0.2);
        d.scree.add(rx, y + s * 0.1, rz, s * (1 + rng() * 0.5), s * (0.6 + rng() * 0.45), s * (0.9 + rng() * 0.5), rng() * 6.3, _c.clone(), (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4);
        n++;
      }
    }
  }
  return n;
}

// What a wall leaves at its foot and hangs from its lip (walls from world/landforms.js).
function dressWalls(world, isl, exclusions, d) {
  const H = (x, z) => world.terrain.heightAt(x, z);
  const rng = seededRandom(isl.seed * 7717 + 5);
  const near = new Map();
  for (const e of exclusions) {
    const key = Math.floor(e.x / 64) * 100003 + Math.floor(e.z / 64);
    if (!near.has(key)) near.set(key, []);
    near.get(key).push(e);
  }
  const excluded = (x, z, pad) => {
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
      for (const e of near.get((Math.floor(x / 64) + ix) * 100003 + Math.floor(z / 64) + iz) || []) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2) return true;
    }
    return false;
  };
  const onRoad = (x, z) => isl.roads.length > 0 && isl.roadAt(x, z).d < 3;
  const pals = {};
  const pal = (b) => (pals[b] ||= Object.fromEntries(Object.entries(BIOME_COLORS[b] || BIOME_COLORS.meadow).map(([k, v]) => [k, new THREE.Color(v)])));
  let n = 0;
  for (const c of isl.blk.cliffs || []) {
    const h = c.top - c.bot;
    const P = pal(c.biome);
    const snowy = c.biome === 'snow' || c.biome === 'tundra';
    const ash = c.biome === 'volcanic' || c.biome === 'ashfield';
    const along = (t) => [c.ax + (c.bx - c.ax) * t, c.az + (c.bz - c.az) * t];
    // scree at the foot: more and bigger under taller walls
    const rocks = h > 3.5 ? (rng() < 0.85 ? 1 : 0) + (h > 9 && rng() < 0.6 ? 1 : 0) : rng() < 0.2 ? 1 : 0;
    for (let k = 0; k < rocks; k++) {
      const [ex, ez] = along(rng());
      const out = 0.5 + rng() * rng() * 3.2;
      const x = ex + c.nx * out, z = ez + c.nz * out;
      const s = Math.min(1.35, (0.32 + rng() * 0.55) * (0.7 + Math.min(h, 22) / 18));
      if (excluded(x, z, s + 0.5) || onRoad(x, z)) continue;
      // seated on the lowest ground under it, so on a slope its downhill side still touches
      const y = Math.min(H(x, z), H(x + s * 0.7, z), H(x - s * 0.7, z), H(x, z + s * 0.7), H(x, z - s * 0.7));
      if (y < 0.3) continue;
      _c.copy(P.rock).lerp(P.high, 0.25 + rng() * 0.2).multiplyScalar(0.8 + rng() * 0.2);
      if (ash) _c.copy(P.rock).multiplyScalar(0.7 + rng() * 0.3);
      d.scree.add(x, y + s * 0.18, z, s * (0.9 + rng() * 0.5), s * (0.55 + rng() * 0.35), s * (0.9 + rng() * 0.5), rng() * 6.3, _c.clone(), (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5);
      n++;
    }
    // grass catching in the scree
    if (GREEN.has(c.biome) || c.biome === 'hush') {
      const tufts = rng() < 0.7 ? 1 + Math.floor(rng() * 3) : 0;
      for (let k = 0; k < tufts; k++) {
        const [ex, ez] = along(rng());
        const out = 0.3 + rng() * 3;
        const x = ex + c.nx * out, z = ez + c.nz * out;
        if (excluded(x, z, 0.3) || onRoad(x, z)) continue;
        const y = H(x, z);
        if (y < 0.5) continue;
        _c.copy(P.grass).lerp(P.grass2, rng()).multiplyScalar(0.72 + rng() * 0.2);
        if (c.biome === 'hush') _c.lerp(P.high, 0.3);
        const s = 0.8 + rng() * 0.7;
        d.tuft.add(x, y - 0.05, z, s, s * (0.8 + rng() * 0.6), s, rng() * 6.3, _c.clone(), (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.3);
      }
    }
    if (h < 2.2) continue;
    const yaw = Math.atan2(c.nx, c.nz);
    if (snowy || (c.biome === 'hush' && rng() < 0.45)) {
      // a cornice: the snow on the shelf curls a little way over its edge (on the Hush, only
      // where the drifts have reached it)
      const lumps = rng() < 0.55 ? 1 + Math.floor(rng() * 2) : 0;
      for (let k = 0; k < lumps; k++) {
        const [ex, ez] = along(0.15 + rng() * 0.7);
        const w = 0.9 + rng() * 1.2;
        _c.set('#eef3f8').multiplyScalar(0.92 + rng() * 0.08);
        d.cornice.add(ex + c.nx * 0.05, c.top - 0.12, ez + c.nz * 0.05, w * 1.3, 0.32 + rng() * 0.25, 0.55, yaw, _c.clone());
      }
    } else if (!ash) {
      // turf and roots hang off the torn edge of the shelf
      const tongues = rng() < 0.75 ? 1 + Math.floor(rng() * 2) : 0;
      for (let k = 0; k < tongues; k++) {
        const [ex, ez] = along(0.1 + rng() * 0.8);
        const len = 0.45 + rng() * Math.min(h * 0.15, 1.3);
        const w = 0.9 + rng() * 1.1;
        _c.copy(P.grass).lerp(P.grass2, rng()).lerp(P.soil || P.under, 0.15 + rng() * 0.2).multiplyScalar(0.82 + rng() * 0.14);
        if (c.biome === 'hush') _c.lerp(P.high, 0.3);
        d.drape.add(ex + c.nx * 0.18, c.top + 0.12, ez + c.nz * 0.18, w, len, 0.55, yaw, _c.clone(), 0.12, 0);
      }
    }
  }
  return n;
}
