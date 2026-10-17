// The kingdom's outer works: what ties the Drowned Precincts to the fortresses outside them and
// the floor's camps and ruins to its roads.
//   the long wall   from the city's north-east tower to the Garrison's north-west corner, so the
//                   knights' terraces sit inside the realm's line; a postern in it lets the path
//                   out to the north-east relay
//   the roads       the processional, the Bastion and Garrison roads and the keep's road to the
//                   Bastion (data/riftLayout.js RIFT_WAYS), laid in worn setts between kerbs
//   the paths       trodden ways from the roads to every camp, ruin and tower on the floor, each
//                   ending at that place's gate (the camps' own, world/riftCamps.js)
import * as THREE from 'three';
import { Kit } from './kit.js';
import { PALETTES } from './style.js';
import { mergeStatic } from './merge.js';
import { seededRandom } from '../core/util.js';
import { WallFrame, curtain, tower, gatehouse } from './riftWalls.js';
import { RIFT_WAYS } from '../data/riftLayout.js';
import { RIFT_SITES } from '../data/riftResearch.js';

// The knights' stone: the castles' darker drowned ashlar (riftCastles.js CASTLE_PALETTE).
const KNIGHTS = { ...PALETTES.rift, stone: '#4f4a5e', stone2: '#3e384a', edge: '#6a6280', dark: '#17141e', roof: '#252838', metal: '#4a4440', glow: '#d39a56' };
const TRACK = { stone: '#4a4456', stone2: '#3f3a4b', edge: '#5c5568', earth: '#3a3346', worn: '#4d4659', glow: '#d39a56' };

// The roads that are paved outside the walls, and the stretches the castles carry themselves.
const PAVED = { arrival: true, bastion: true, garrison: true, chainward_bastion: true };
// The paths: [from, to] polylines in world x, z. Each leaves a road or another path and ends at
// a place's gate.
export const RIFT_PATHS = [
  // from the arrival shelf to Scholar's Landing and to Quill's station
  { id: 'to_scholar', pts: [[5996, 5845], [5980, 5851], [RIFT_SITES.scholar.x + 7, RIFT_SITES.scholar.z + 1]] },
  { id: 'to_survey', pts: [[6004, 5852], [6028, 5871], [RIFT_SITES.survey.x - 8, RIFT_SITES.survey.z - 4]] },
  // from Quill's station past the Fallen Light to the Bastion road, and out to the upended tower
  { id: 'survey_light', pts: [[RIFT_SITES.survey.x + 6, RIFT_SITES.survey.z + 6], [6098, 5924], [6110, 5940], [6114, 5962], [6118, 5976]] },
  { id: 'to_upended_a', pts: [[RIFT_SITES.survey.x + 8, RIFT_SITES.survey.z - 3], [6108, 5891], [6134, 5884]] },
  // east: the scholars' camp to the Folded Court, Sunken Saltreach, the pre-Rift works and the
  // Order's watch, which sits on the Garrison road
  { id: 'scholar_fold', pts: [[RIFT_SITES.scholar.x - 8, RIFT_SITES.scholar.z + 2], [5932, 5864], [RIFT_SITES.fold.x + 9, RIFT_SITES.fold.z]] },
  { id: 'fold_saltreach', pts: [[RIFT_SITES.fold.x - 2, RIFT_SITES.fold.z + 9], [5896, 5892], [5890, 5898]] },
  { id: 'saltreach_works', pts: [[5878, 5922], [5866, 5932], [RIFT_SITES.prerift.x + 2, RIFT_SITES.prerift.z - 10]] },
  { id: 'saltreach_whisper', pts: [[5874, 5912], [5856, 5908], [RIFT_SITES.whisper.x + 6, RIFT_SITES.whisper.z]] },
  { id: 'works_order', pts: [[RIFT_SITES.prerift.x + 4, RIFT_SITES.prerift.z + 11], [5866, 5970], [RIFT_SITES.order.x - 1, RIFT_SITES.order.z - 8]] },
  { id: 'order_garrison', pts: [[RIFT_SITES.order.x + 1, RIFT_SITES.order.z + 9], [5874, 6020], [5874, 6040], [5872, 6058]] },
  { id: 'to_upended_b', pts: [[RIFT_SITES.prerift.x - 10, RIFT_SITES.prerift.z + 4], [5844, 5956]] },
  // south to the south relay's keeper
  { id: 'to_relay_south', pts: [[RIFT_SITES.scholar.x - 4, RIFT_SITES.scholar.z - 7], [5938, 5828], [5916, 5810]] },
  // west: off the Bastion road to the Glyph Circle, and off the keep's road to the rope
  { id: 'to_glyphs', pts: [[6124, 5978], [6128, 5987]] },
  { id: 'to_rope', pts: [[6177, 6054], [RIFT_SITES.rope.x + 5, RIFT_SITES.rope.z]] },
  { id: 'to_year57', pts: [[6184, 6092], [6168, 6092]] },
  // north-east, through the long wall's postern to the north-east relay
  { id: 'to_relay_ne', pts: [[5874, 6062], [5872, 6110], [5874, 6128], [5880, 6168], [5884, 6180]] },
];

// The long wall from the city's north-east corner to the Garrison's north-west corner.
const LONG = { a: [5894, 6104], b: [5852, 6148], postern: 0.45, top: 19, t: 3 };

function laySetts(k, world, pts, width, rng, o) {
  // worn setts in courses across the way, kerbs of long stones along both edges
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.5) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    const ry = Math.atan2(ux, uz);
    for (let u = 0; u < L; u += o.step) {
      if (o.skip && o.skip(ax + ux * u, az + uz * u)) continue;
      const cols = Math.max(1, Math.round(width / o.sett));
      for (let c = 0; c < cols; c++) {
        const h = rng();
        if (h < o.gaps) continue;
        const v = -width / 2 + (c + 0.5) * (width / cols) + (rng() - 0.5) * 0.2;
        const x = ax + ux * (u + (c % 2) * o.step * 0.5) + nx * v, z = az + uz * (u + (c % 2) * o.step * 0.5) + nz * v;
        const y = world.terrain.heightAt(x, z);
        const s = (width / cols) * (0.7 + rng() * 0.22);
        k.slab(x - o.ox, y - 0.05, z - o.oz, s, 0.12, o.step * (0.62 + rng() * 0.3), h < 0.2 ? 'edge' : h < 0.65 ? 'stone2' : 'stone', { ry: ry + (rng() - 0.5) * 0.18, grad: 0.04, jitter: 0.04 });
      }
      if (o.kerb) {
        for (const side of [-1, 1]) {
          const x = ax + ux * u + nx * side * (width / 2 + 0.25), z = az + uz * u + nz * side * (width / 2 + 0.25);
          const y = world.terrain.heightAt(x, z);
          if (rng() < 0.12) continue;
          k.slab(x - o.ox, y - 0.2, z - o.oz, 0.42, 0.42, o.step * 0.92, 'edge', { ry, grad: 0.1 });
        }
      }
    }
  }
}

// The paths are not built, only walked: a band of trodden ground, darker down the middle where
// the feet go and fading into the floor at its sides.
function trodden(world, paths) {
  const pos = [], col = [], idx = [];
  const across = [[-1.9, 0], [-0.9, 0.85], [0.9, 0.85], [1.9, 0]];
  const c = new THREE.Color('#2a2430');
  for (const p of paths) {
    const pts = [];
    for (let i = 1; i < p.pts.length; i++) {
      const [ax, az] = p.pts[i - 1], [bx, bz] = p.pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) pts.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]);
    }
    const base = pos.length / 3;
    pts.forEach(([x, z], i) => {
      const [px, pz] = pts[Math.max(0, i - 1)], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)];
      const L = Math.hypot(qx - px, qz - pz) || 1, nx = -(qz - pz) / L, nz = (qx - px) / L;
      // the ends fade out too, so a path starts and stops in the ground rather than at a line
      const end = Math.min(1, i / 3, (pts.length - 1 - i) / 3);
      for (const [v, a] of across) {
        const wx = x + nx * v, wz = z + nz * v;
        pos.push(wx, world.terrain.heightAt(wx, wz) + 0.05, wz);
        col.push(c.r, c.g, c.b, a * end);
      }
    });
    for (let i = 0; i + 1 < pts.length; i++) {
      for (let j = 0; j < 3; j++) {
        const a = base + i * 4 + j, b = a + 4;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'rift_paths';
  m.renderOrder = 1;
  m.receiveShadow = true;
  return m;
}

export function buildRiftKingdom(world, exclusions, state) {
  const low = !!state.low;
  const rng = seededRandom(9191);
  const roots = [];

  // ------------------------------------------------------------ the long wall
  {
    const F = new WallFrame(world, LONG.a[0], LONG.a[1], KNIGHTS, { tag: 'rift_long_wall', name: 'rift_long_wall', low });
    const ax = 0, az = 0, bx = LONG.b[0] - LONG.a[0], bz = LONG.b[1] - LONG.a[1];
    const L = Math.hypot(bx, bz), ux = bx / L, uz = bz / L;
    // its outer face (the run's local +x) looks north, over the open floor toward the relay
    const pm = LONG.postern * L;
    const gw = 4.5;
    for (const [s0, s1] of [[5, pm - gw / 2 - 4.5 + 1.2], [pm + gw / 2 + 4.5 - 1.2, L - 6]]) {
      curtain(F, ax + ux * s0, az + uz * s0, ax + ux * s1, az + uz * s1, { t: LONG.t, top: LONG.top, out: 1, base: 4 });
    }
    // a tower at the Garrison end, tied into its corner
    tower(F, bx - ux * 3, bz - uz * 3, { w: 8, top: LONG.top + 4, base: 11, ry: Math.atan2(ux, uz), lit: true });
    // the postern: a small gatehouse where the path to the north-east relay goes through
    const yaw = Math.atan2(ux, uz) + Math.PI / 2;
    gatehouse(F, ax + ux * pm, az + uz * pm, yaw - Math.PI, { width: gw, depth: 6, towers: 4.5, top: LONG.top, towerTop: LONG.top + 3, lit: false });
    roots.push(F.build());
    exclusions.push(...F.ex);
  }

  // ------------------------------------------------------------ roads and paths
  {
    const k = new Kit(TRACK, { detail: low ? 0 : 1 });
    const o = { ox: 6000, oz: 6000 };
    if (!low) {
      for (const w of RIFT_WAYS) {
        if (!PAVED[w.id]) continue;
        // the bridge carries the Bastion road over the void; the gates their own floors
        const skip = (x, z) => (x > 6168 && x < 6222 && Math.abs(z - 5962) < 6) || world.terrain.heightAt(x, z) < -5;
        laySetts(k, world, w.points.map((p) => [p[0], p[1]]), w.width - 1.2, rng, { ...o, step: 1.6, sett: 1.3, gaps: 0.06, kerb: true, skip });
      }
    }
    for (const p of RIFT_PATHS) {
      // keep the scatter off the path
      for (let i = 1; i < p.pts.length; i++) {
        const [ax, az] = p.pts[i - 1], [bx, bz] = p.pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
        for (let j = 0; j <= n; j++) exclusions.push({ x: ax + ((bx - ax) * j) / n, z: az + ((bz - az) * j) / n, r: 2.6 });
      }
    }
    const g = k.build('rift_roads');
    g.position.set(o.ox, 0, o.oz);
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    world.scene.add(g);
    roots.push(g);
    world.scene.add(trodden(world, RIFT_PATHS));
  }
  mergeStatic(world.scene, roots);
  state.kingdom = { paths: RIFT_PATHS.length };
}
