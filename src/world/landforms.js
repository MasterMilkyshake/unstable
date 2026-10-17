// Block terrain for the surface isles.
//
// The Anchorage shelf broke into fault blocks in the Fracture (docs/WORLD_BIBLE.md): the old
// high country stayed up, the coast sank into basins and pieces of shelf were left standing
// as pillars. So the surface isles stand on a few broad, nearly level shelves with sheer
// stone walls between them, instead of rolling noise.
//
// Every mesh cell takes one level from its island's landforms (data/landforms.js). Corners of
// cells on the same level share vertices, so shelves stay smooth; where neighbouring cells
// differ, the mesh drops a wall of strata under a turf lip, notched into the rock (never out
// of it), with scree banked at its foot. Soft landforms (mounds, tarns, channels, craters)
// shape the ground between the walls without making new ones. Ways
// (data/roads.js) cut ramped passes into a shelf where they climb it. Movement reads the same
// split heightfield through sampleBlocks(), so the walls are real: a step over 0.6 m stops
// you, and you climb it (entities/actor.js).
import * as THREE from 'three';
import { smoothstep, lerp } from '../core/util.js';
import { Noise2D } from '../core/noise.js';
import { islandDist, STRUCTURES } from '../data/world.js';
import { ROADS } from '../data/roads.js';
import { CIVIC_ROADS, SETTLEMENT_ROADS, ARCHITECTURE } from '../data/architecture.js';
import { samplePath } from './paths.js';
import { BIOME_COLORS } from './biomeGround.js';

// Per biome: lowland height, soft relief amplitude (m), and the low shelves that break up
// open ground where nothing is authored: [step, amplitude] in metres (0 = none). Only an
// island with `shelves: true` uses them; elsewhere every shelf is an authored landform.
const GROUND = {
  meadow: { low: 3, soft: 1.3, shelf: [4, 9] },
  forest: { low: 3, soft: 1.5, shelf: [5, 11] },
  emberwood: { low: 3, soft: 1.6, shelf: [5, 11] },
  highland: { low: 3.5, soft: 1.7, shelf: [6, 14] },
  farmland: { low: 3, soft: 0.7, shelf: [0, 0] },
  dunes: { low: 2.4, soft: 2.1, shelf: [0, 0] },
  beach: { low: 2, soft: 0.5, shelf: [0, 0] },
  marsh: { low: 1.6, soft: 0.5, shelf: [0, 0] },
  snow: { low: 4, soft: 1.8, shelf: [6, 13] },
  tundra: { low: 3.5, soft: 1.5, shelf: [5, 10] },
  volcanic: { low: 3, soft: 1.2, shelf: [5, 10] },
  ashfield: { low: 3, soft: 1.3, shelf: [4, 8] },
  jungle: { low: 3, soft: 1.4, shelf: [5, 10] },
  bastion: { low: 3, soft: 1, shelf: [4, 8] },
  hush: { low: 3, soft: 1.3, shelf: [5, 10] },
  rock: { low: 2.5, soft: 0.6, shelf: [0, 0] },
};
const groundOf = (biome) => GROUND[biome] || GROUND.meadow;

// A way climbs at most this many metres per metre where it cuts a pass into a shelf.
const PASS_GRADE = 0.42;
const OP = { max: 0, min: 1, top: 2 };
const PASS = -1e6; // cell level marker: the cell lies in a pass cut
// Settlement shelves (flats with an `outline` or a `front`) are exact levels: dead level at
// their height, whatever flats, soft relief or rises do around them. Stored as h + EXACT.
const EXACT = 1e5;

function hash2(i, j, s) {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t];
}

// ---------------------------------------------------------------- landform shapes
// A shape is a blocky footprint at one level: a superellipse (p = 2 round, p > 4 boxy) whose
// outline is sampled on a `block`-metre lattice, so the edges step in big rectilinear chunks,
// then wobbled by low noise (`warp`) and per-block jitter (`jit`).
// `noise`: the seed of the island a landform was built on, kept when its region joins another
// island's coast, so its edges wander as they always did (data/landforms.js grain()).
const GRAINS = new Map();
const grainOf = (seed) => GRAINS.get(seed) || GRAINS.set(seed, new Noise2D(seed)).get(seed);

function makeShape(def, extra = {}) {
  const d = { ...def, ...extra };
  const rot = d.rot || 0;
  const s = {
    cx: d.x, cz: d.z, rx: d.rx, rz: d.rz, top: d.top, p: d.p ?? 3,
    warp: d.warp ?? 0.14, jit: d.jit ?? 0.06, B: d.block ?? 6,
    cos: Math.cos(rot), sin: Math.sin(rot), margin: d.margin ?? (d.op === 'min' ? 0 : -9),
    seed: d.seed | 0, op: OP[d.op || 'max'], f: 1.6 / Math.max(d.rx || d.w || 10, d.rz || d.w || 10),
    exact: !!d.exact, noise: d.noise != null ? grainOf(d.noise) : null,
  };
  if (s.exact) { s.warp = 0; s.jit = 0; s.margin = d.margin ?? 0; }
  if (d.points) {
    s.pts = d.points;
    s.hw = d.w / 2;
    s.rx = s.rz = s.hw;
    const xs = d.points.map(p => p[0]), zs = d.points.map(p => p[1]);
    const pad = s.hw * (1 + s.warp + s.jit) + s.B;
    s.x0 = Math.min(...xs) - pad; s.x1 = Math.max(...xs) + pad;
    s.z0 = Math.min(...zs) - pad; s.z1 = Math.max(...zs) + pad;
  } else {
    const R = Math.max(d.rx, d.rz) * (1 + s.warp + s.jit) * (s.p > 2 ? 1.42 : 1) + s.B;
    s.x0 = d.x - R; s.x1 = d.x + R; s.z0 = d.z - R; s.z1 = d.z + R;
  }
  return s;
}

function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function shapeHit(s, x, z, inland, noise) {
  if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return false;
  if (s.poly) return inPoly(s.poly, x, z);
  const B = s.B;
  let r, qx, qz, gx, gz;
  if (s.pts) {
    gx = Math.floor(x / B); gz = Math.floor(z / B);
    qx = s.exact ? x : (gx + 0.5) * B; qz = s.exact ? z : (gz + 0.5) * B;
    let best = Infinity;
    for (let i = 1; i < s.pts.length; i++) {
      const [a, b] = [s.pts[i - 1], s.pts[i]];
      best = Math.min(best, segDist(qx, qz, a[0], a[1], b[0], b[1])[0]);
    }
    r = best / s.hw;
  } else {
    let lx = x - s.cx, lz = z - s.cz;
    if (s.sin) { const t = lx * s.cos + lz * s.sin; lz = -lx * s.sin + lz * s.cos; lx = t; }
    gx = Math.floor(lx / B); gz = Math.floor(lz / B);
    qx = s.exact ? lx : (gx + 0.5) * B; qz = s.exact ? lz : (gz + 0.5) * B;
    const u = Math.abs(qx) / s.rx, v = Math.abs(qz) / s.rz;
    r = s.p === 2 ? Math.hypot(u, v) : (u ** s.p + v ** s.p) ** (1 / s.p);
  }
  if (r > 1 + s.warp + s.jit) return false;
  if (s.exact) return r < 1 && inland >= s.margin;
  const cell = hash2(gx, gz, s.seed);
  // A negative margin runs the shelf out over the shallows, so where high ground meets the
  // sea its wall drops straight into the water instead of standing behind a beach.
  if (s.margin < 0 ? inland < s.margin : inland < s.margin * (0.3 + 1.4 * cell)) return false;
  const wob = s.warp * noise.fbm(qx * s.f + s.seed * 0.37, qz * s.f - s.seed * 0.53, 2) * 1.6 + s.jit * (cell - 0.5) * 2;
  return r < 1 + wob;
}

// Authored landforms (data/landforms.js) expanded into shapes:
//   plateau { x, z, rx, rz, h, steps?: [{ h, s, x?, z? }] }    one broad shelf, or nested shelves
//   massif  { x, z, rx, rz, h, tiers = 3, lean?, shrink? }    a mountain built of stacked shelves
//   basin   { x, z, rx, rz, h }                               ground sunk to h (op min)
//   gorge   { points: [[x, z], ...], w, h }                   a channel cut to h (op min)
//   pillars { x, z, rx, rz, n, h: [lo, hi], size: [lo, hi] }  shelf left standing as stone columns
// Any of them takes p, warp, jit, block, rot, margin, seed; `over: true` stands it on top of
// basins and gorges (op top).
function expand(isl, def, out, idx) {
  const seed = (def.seed ?? isl.seed * 131 + idx * 977) | 0;
  const r = rng(seed);
  const op = def.over ? 'top' : def.op;
  const low = def.base ?? groundOf(isl.biome).low;
  switch (def.kind) {
    case 'massif': {
      const n = def.tiers ?? 3;
      const lean = def.lean ?? r() * Math.PI * 2;
      const levels = def.levels || Array.from({ length: n }, (_, k) => low + (def.h - low) * (k + 1) / n);
      levels.forEach((top, k) => {
        const sc = 1 - (k / Math.max(1, levels.length - 1 || 1)) * (def.shrink ?? 0.7) * (levels.length > 1 ? 1 : 0);
        const drift = (1 - sc) * (def.drift ?? 0.5);
        const ox = Math.cos(lean) * def.rx * drift + (r() - 0.5) * def.rx * 0.1 * (k > 0);
        const oz = Math.sin(lean) * def.rz * drift + (r() - 0.5) * def.rz * 0.1 * (k > 0);
        out.push(makeShape(def, { x: def.x + ox, z: def.z + oz, rx: def.rx * sc, rz: def.rz * sc, top, seed: seed + k * 17, op, warp: (def.warp ?? 0.15) * (1 + 0.4 * k / levels.length) }));
      });
      break;
    }
    case 'plateau': {
      const lumps = def.lumps ?? 0;
      if (!lumps) out.push(makeShape(def, { top: def.h, seed, op }));
      else {
        // A core block and `lumps` blocks thrown around it: the outline of a broken shelf,
        // with bays and promontories instead of one rounded rectangle.
        const c = Math.cos(def.rot || 0), sn = Math.sin(def.rot || 0);
        const lump = (u, v, sx, sz, k) => out.push(makeShape(def, {
          x: def.x + u * def.rx * c - v * def.rz * sn, z: def.z + u * def.rx * sn + v * def.rz * c,
          rx: def.rx * sx, rz: def.rz * sz, top: def.h, seed: seed + k * 13, op, p: def.p ?? 8, warp: def.warp ?? 0.05,
        }));
        lump(0, 0, 0.66, 0.66, 0);
        const a0 = r() * Math.PI * 2;
        for (let k = 1; k <= lumps; k++) {
          const a = a0 + (k + (r() - 0.5) * 0.7) / lumps * Math.PI * 2;
          const sx = 0.22 + r() * 0.32, sz = 0.22 + r() * 0.32;
          // reach the nominal rim, some a little past it, some short of it (bays)
          const d = (1.04 - Math.max(sx, sz)) * (0.72 + r() * 0.42);
          lump(Math.cos(a) * d, Math.sin(a) * d, sx, sz, k);
        }
      }
      for (const [k, st] of (def.steps || []).entries()) {
        out.push(makeShape(def, { x: st.x ?? def.x, z: st.z ?? def.z, rx: def.rx * (st.s ?? 0.6), rz: def.rz * (st.s ?? 0.6), top: st.h, seed: seed + 31 * (k + 1), op, warp: st.warp ?? def.warp }));
      }
      break;
    }
    case 'basin':
    case 'gorge':
      // h: 'low' carves a shelf back down to the lowland around it (a hollow open to it)
      out.push(makeShape(def, { top: def.h === 'low' ? -Infinity : def.h, seed, op: def.over ? 'top' : 'min' }));
      break;
    case 'pillars': {
      const placed = [];
      const [lo, hi] = def.h;
      const [s0, s1] = def.size || [7, 14];
      for (let k = 0, tries = 0; k < def.n && tries < def.n * 30; tries++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r());
        const x = def.x + Math.cos(a) * rr * def.rx, z = def.z + Math.sin(a) * rr * def.rz;
        const w = s0 + r() * (s1 - s0);
        if (placed.some(p => Math.hypot(p.x - x, p.z - z) < (p.w + w) * 0.9)) continue;
        if ((isl.flats || []).some(f => Math.hypot(f.x - x, f.z - z) < f.r + w * 0.8)) continue;
        if (isl.roads.length && isl.roadAt(x, z).d < w * 0.75 + 8) continue;
        if ((def.avoid || []).some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar + w)) continue;
        const top = lo + r() * (hi - lo);
        placed.push({ x, z, w });
        out.push(makeShape({ x, z, rx: w / 2, rz: (w / 2) * (0.75 + r() * 0.5), p: 6, warp: 0.06, jit: 0.12, block: def.block ?? 2, margin: def.margin ?? 2, top, seed: seed + k * 7, op: 'top', rot: def.rot ?? 0, noise: def.noise }));
        if (def.cap !== false && r() < 0.45) {
          // a second, smaller block on the crown: the column was two strata once
          const cw = w * (0.4 + r() * 0.25);
          out.push(makeShape({ x: x + (r() - 0.5) * (w - cw) * 0.6, z: z + (r() - 0.5) * (w - cw) * 0.6, rx: cw / 2, rz: cw / 2, p: 6, warp: 0.04, jit: 0.1, block: 2, margin: 0, top: top + 2 + r() * 4, seed: seed + k * 7 + 3, op: 'top', noise: def.noise }));
        }
        k++;
      }
      break;
    }
    case 'range': {
      // Scenery: a mountain range along a ridge line, built as a massif. Its foot is one
      // sheer wall (`base`, more than a grip can climb); above it ridge tiers about 14 m
      // apart step back toward the crest, each a ledge for snow, scree or turf, so the range
      // climbs like a mountain rather than standing as one wall; a broken line of summit
      // blocks makes the skyline at `peak`.
      // { points, w (half width), base, peak, tiers = rise / 14, summits = length / 40 }
      const pts = def.points;
      const tiers = def.tiers ?? Math.max(3, Math.round((def.peak - def.base) / 14));
      for (let k = 0; k < tiers; k++) {
        const f = k / tiers;
        const top = def.base + (def.peak - def.base) * f * 0.9;
        const w = def.w * (1 - 0.7 * f ** 0.85);
        out.push(makeShape(def, { points: pts, w: w * 2, top, seed: seed + k * 41, op, p: 2, warp: (def.warp ?? 0.16) * (1 + 1.4 * f), jit: def.jit ?? 0.12, block: def.block ?? 6 }));
      }
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        segs.push([pts[i - 1], pts[i], L]);
        total += L;
      }
      const n = def.summits ?? Math.max(2, Math.round(total / 40));
      for (let k = 0; k < n; k++) {
        let t = (k + 0.2 + r() * 0.6) / n * total, sg = segs[0];
        for (const g of segs) { if (t <= g[2]) { sg = g; break; } t -= g[2]; }
        const [[ax, az], [bx, bz], L] = sg;
        const tx = (bx - ax) / L, tz = (bz - az) / L;
        const u = (r() - 0.5) * 0.4;
        const x = ax + tx * t - tz * u * def.w, z = az + tz * t + tx * u * def.w;
        // crags of uneven height, each a stack of two or three shrinking blocks
        const top = def.peak * (0.8 + r() * 0.2);
        const w = def.w * (0.28 + r() * 0.3), d = def.w * (0.26 + r() * 0.24);
        const steps = 2 + (r() < 0.5 ? 1 : 0);
        for (let q = 0; q < steps; q++) {
          const sc = 1 - q * 0.3;
          out.push(makeShape({ x: x + (r() - 0.5) * w * 0.3 * q, z: z + (r() - 0.5) * d * 0.3 * q, rx: w * sc, rz: d * sc, p: 3, warp: 0.12, jit: 0.12, block: def.block ?? 6, margin: -9,
            top: top - (steps - 1 - q) * (def.peak - def.base) * 0.08, seed: seed + 500 + k * 31 + q, op: 'max', rot: Math.atan2(tz, tx) + (r() - 0.5) * 0.6, noise: def.noise }));
        }
      }
      break;
    }
    case 'mound': {
      // A smooth rise of earth on open ground: no wall anywhere, full height at the centre and
      // falling away to nothing at its rim; `sharp` > 1 flattens the crown and steepens the
      // skirt. Where mounds overlap the higher wins, so a saddle never tops either crown.
      (isl.blkMounds ||= []).push(mound(def));
      break;
    }
    case 'mounds': {
      // A scatter of mounds: tussock islands in a fen, kept off flats, ways and `avoid`.
      const [lo, hi] = def.h, [s0, s1] = def.size;
      const placed = [];
      for (let k = 0, tries = 0; k < def.n && tries < def.n * 40; tries++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r());
        const x = def.x + Math.cos(a) * rr * def.rx, z = def.z + Math.sin(a) * rr * def.rz;
        const w = s0 + r() * (s1 - s0);
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.w + w) * 0.55)) continue;
        if ((isl.flats || []).some((f) => Math.hypot(f.x - x, f.z - z) < f.r + w * 0.6)) continue;
        if (isl.roads.length && isl.roadAt(x, z).d < w * 0.6 + 6) continue;
        if ((def.avoid || []).some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar + w * 0.6)) continue;
        placed.push({ x, z, w });
        (isl.blkMounds ||= []).push(mound({ x, z, rx: w, rz: w * (0.6 + r() * 0.5), rot: r() * Math.PI, h: lo + r() * (hi - lo), sharp: 1.3 + r() * 0.6 }));
        k++;
      }
      break;
    }
    case 'skerries': {
      // Rock outcrops around a ring at the waterline, running out over the shallows: low
      // blocky shelves of the island's own stone, so the shore breaks into reef and cove.
      // { x, z, r, n, h: [lo, hi], size: [lo, hi], arc?: [a0, a1], avoid }
      const [lo, hi] = def.h, [s0, s1] = def.size, [a0, a1] = def.arc || [0, Math.PI * 2];
      for (let k = 0, tries = 0; k < def.n && tries < def.n * 30; tries++) {
        const a = a0 + r() * (a1 - a0), rr = def.r * (0.78 + r() * 0.32);
        const x = def.x + Math.cos(a) * rr, z = def.z + Math.sin(a) * rr;
        const w = s0 + r() * (s1 - s0);
        if ((def.avoid || []).some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar + w)) continue;
        const top = lo + r() * (hi - lo);
        out.push(Object.assign(makeShape({ x, z, rx: w, rz: w * (0.55 + r() * 0.6), p: 2.4, warp: 0.22, jit: 0.22, block: 1.2, margin: -9, top, seed: seed + k * 11, op: 'max', rot: a + (r() - 0.5) }), { rocky: true }));
        // a crag on its back, so the reef breaks the swell in a jagged line, not a pavement
        if (r() < 0.65) out.push(Object.assign(makeShape({ x: x + (r() - 0.5) * w * 0.5, z: z + (r() - 0.5) * w * 0.5, rx: w * (0.3 + r() * 0.2), rz: w * (0.25 + r() * 0.2), p: 2.2, warp: 0.25, jit: 0.25, block: 1.2, margin: -9, top: top + 0.6 + r() * 1.4, seed: seed + k * 11 + 3, op: 'max', rot: r() * 3 }), { rocky: true }));
        if (r() < 0.5) out.push(Object.assign(makeShape({ x: x + Math.cos(a) * w * 0.9, z: z + Math.sin(a) * w * 0.9, rx: w * 0.5, rz: w * 0.4, p: 2.4, warp: 0.22, jit: 0.22, block: 1.2, margin: -9, top: lo * 0.7, seed: seed + k * 11 + 5, op: 'max', rot: a }), { rocky: true }));
        k++;
      }
      break;
    }
    case 'crater': {
      // { x, z, floor, crest, outer (radii), h (crest above the shelf), base (floor above it) }
      (isl.blkCraters ||= []).push(def);
      break;
    }
    case 'channel': {
      // A bed worn into the ground along a line, `h` deep and `w` wide, on shelf and lowland
      // alike: where an overflow of lava has run for a century.
      const pts = def.points;
      const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
      (isl.blkChannels ||= []).push({ pts, hw: def.w / 2, h: def.h, x0: Math.min(...xs) - def.w * 2, x1: Math.max(...xs) + def.w * 2, z0: Math.min(...zs) - def.w * 2, z1: Math.max(...zs) + def.w * 2 });
      break;
    }
    case 'tarn': {
      // A peat hollow: the ground, shelf or lowland alike, dips smoothly `h` metres to a bowl.
      (isl.blkTarns ||= []).push(mound({ ...def, sharp: def.sharp ?? 1.1 }));
      break;
    }
    case 'dry':
      break; // read by initBlocks
    default:
      throw new Error(`unknown landform kind ${def.kind}`);
  }
}

function mound(d) {
  const rot = d.rot || 0;
  return { x: d.x, z: d.z, rx: d.rx, rz: d.rz, h: d.h, sharp: d.sharp ?? 1.25, cos: Math.cos(rot), sin: Math.sin(rot), R: Math.max(d.rx, d.rz) };
}
function moundHeight(ms, x, z) {
  let best = 0;
  for (const m of ms) {
    let dx = x - m.x, dz = z - m.z;
    if (Math.abs(dx) > m.R || Math.abs(dz) > m.R) continue;
    [dx, dz] = [dx * m.cos + dz * m.sin, -dx * m.sin + dz * m.cos];
    const e = (dx / m.rx) ** 2 + (dz / m.rz) ** 2;
    if (e < 1) best = Math.max(best, m.h * (1 - e) ** m.sharp);
  }
  return best;
}

// ---------------------------------------------------------------- setup
export function initBlocks(isl) {
  isl.blkMounds = [];
  isl.blkTarns = [];
  isl.blkChannels = [];
  isl.blkCraters = [];
  const shapes = [];
  const ramps = [];
  (isl.landforms || []).forEach((def, i) => {
    expand(isl, def, shapes, i);
    for (const r of def.ramps || []) ramps.push({ ...r, def });
  });
  // Legacy escarpments become three nested shelves, as their smooth shelving did before.
  for (const f of isl.flats || []) {
    let poly = f.outline;
    if (!poly && f.front) {
      // a terrace: its front edge, then straight back to its rear line
      const x0 = f.x - f.rx * (f.core ?? 1), x1 = f.x + f.rx * (f.core ?? 1);
      const front = [];
      const at = (x) => {
        for (let i = 1; i < f.front.length; i++) {
          const [ax, az] = f.front[i - 1], [bx, bz] = f.front[i];
          if (x <= bx || i === f.front.length - 1) return lerp(az, bz, Math.max(0, Math.min(1, (x - ax) / (bx - ax))));
        }
        return f.front[0][1];
      };
      front.push([x0, at(x0)]);
      for (const p of f.front) if (p[0] > x0 && p[0] < x1) front.push(p);
      front.push([x1, at(x1)]);
      poly = [...front, [x1, f.z + f.rz], [x0, f.z + f.rz]];
    }
    if (!poly || typeof f.h !== 'number') continue;
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    shapes.push({ poly, top: f.h + EXACT, op: 3, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
  }
  for (const [i, e] of (isl.escarpments || []).entries()) {
    const low = groundOf(isl.biome).low + 2;
    [[1, 0.38], [0.81, 0.72], [0.61, 1]].forEach(([s, f], k) => shapes.push(makeShape({ x: e.x, z: e.z, rx: e.rx * s, rz: e.rz * s, p: 8, warp: 0.08, jit: 0.08, block: 6, top: low + e.h * f, seed: isl.seed * 7 + i * 13 + k })));
  }
  const G = 48;
  const grid = new Map();
  for (const s of shapes) {
    for (let ix = Math.floor(s.x0 / G); ix <= Math.floor(s.x1 / G); ix++) {
      for (let iz = Math.floor(s.z0 / G); iz <= Math.floor(s.z1 / G); iz++) {
        const key = ix * 100003 + iz;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(s);
      }
    }
  }
  const g0 = groundOf(isl.biome);
  const dry = (isl.landforms || []).filter(d => d.kind === 'dry');
  isl.blk = { shapes, grid, G, passSegs: [], passCells: new Map(), low0: g0.low, shelf: isl.shelves === true ? g0.shelf : isl.shelves || [0, 0], ramps, dry,
    rockyLevels: new Set(shapes.filter((sh) => sh.rocky).map((sh) => Math.fround(sh.top))) };
  isl.passes = [];
}

// After the island's flats resolve: cut a pass wherever a way climbs a shelf faster than it can
// be walked. The ramp is the lower envelope of the ground along the way at PASS_GRADE, so it
// is cut down into the upper shelf from the foot of the wall.
export function initPasses(isl) {
  const B = isl.blk;
  // Authored streets and stairs up a settlement's shelves (`ramps` on the island).
  for (const r of isl.ramps || []) {
    // a shoulder each side, so the cut is never narrower than the flight built on it
    B.passSegs.push({ ax: r.x, az: r.z, bx: r.x2, bz: r.z2, ah: r.y, bh: r.y2, hw: r.w / 2 + 1.5, first: true, last: true });
    const [lo, hi] = r.y <= r.y2 ? [[r.x, r.z, r.y], [r.x2, r.z2, r.y2]] : [[r.x2, r.z2, r.y2], [r.x, r.z, r.y]];
    isl.passes.push({ way: r.id ?? null, street: true, x: (r.x + r.x2) / 2, z: (r.z + r.z2) / 2, yaw: Math.atan2(hi[0] - lo[0], hi[1] - lo[1]),
      from: lo[2], to: hi[2], width: r.w, len: Math.hypot(r.x2 - r.x, r.z2 - r.z), ax: lo[0], az: lo[1], bx: hi[0], bz: hi[1] });
  }
  // A worn ramp down one side of a knoll or shelf: `ramps: [{ yaw, w?, len? }]` on its
  // landform, yaw pointing downhill from the centre. It runs from just inside the edge out
  // to the ground below, never steeper than PASS_GRADE.
  for (const r of B.ramps) {
    const d = r.def, ux = Math.sin(r.yaw), uz = Math.cos(r.yaw);
    // walk out from the centre to the real edge (lumps and warp move it)
    const crown = blockHeight(isl, d.x, d.z);
    let edge = 0;
    while (edge < 2 * Math.max(d.rx, d.rz) && blockHeight(isl, d.x + ux * (edge + 1), d.z + uz * (edge + 1)) > crown - 1.5) edge += 1;
    const ax = d.x + ux * (edge - 3), az = d.z + uz * (edge - 3);
    const top = blockHeight(isl, ax, az);
    let len = r.len ?? 0, foot;
    for (let k = 0; k < 4; k++) {
      foot = blockHeight(isl, ax + ux * (len + 3), az + uz * (len + 3));
      len = Math.max(r.len ?? 0, (top - foot) / (PASS_GRADE - 0.04));
    }
    const bx = ax + ux * (len + 3), bz = az + uz * (len + 3);
    B.passSegs.push({ ax, az, bx, bz, ah: top, bh: foot, hw: (r.w ?? 4) / 2, first: true, last: true });
    isl.passes.push({ way: r.way ?? null, ramp: true, x: (ax + bx) / 2, z: (az + bz) / 2, yaw: r.yaw + Math.PI, from: foot, to: top, width: r.w ?? 4, len: len + 3, ax: bx, az: bz, bx: ax, bz: az });
  }
  for (const road of [...ROADS, ...[...CIVIC_ROADS, ...SETTLEMENT_ROADS].filter(r => r.pass)]) {
    const pts = samplePath(road, 2.5).filter(p => isl.contains(p.x, p.z) && islandDist(isl, p.x, p.z) < 0.9);
    if (pts.length < 3) continue;
    const H0 = pts.map(p => blockHeight(isl, p.x, p.z));
    // A `graded` way keeps its authored heights (all of it, or its first `graded` metres):
    // a ledge road built along a rock's flank, a causeway raised to a gate. Elsewhere the
    // way follows the land, cut down wherever it climbs faster than can be walked.
    const fixed = pts.map(p => road.graded === true || (road.graded > 0 && p.distance <= road.graded));
    const H = H0.map((h, i) => (fixed[i] ? pts[i].height : h));
    const step = (i, j) => PASS_GRADE * Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
    // past the end of a graded stretch the way ramps back down to the land (a built causeway)
    const filled = fixed.slice();
    for (let i = 1; i < pts.length; i++) if (!fixed[i] && filled[i - 1] && H[i - 1] - step(i, i - 1) > H[i]) { H[i] = H[i - 1] - step(i, i - 1); filled[i] = true; }
    for (let i = pts.length - 2; i >= 0; i--) if (!fixed[i] && filled[i + 1] && H[i + 1] - step(i, i + 1) > H[i]) { H[i] = H[i + 1] - step(i, i + 1); filled[i] = true; }
    for (let i = 1; i < pts.length; i++) if (!fixed[i]) H[i] = Math.min(H[i], H[i - 1] + step(i, i - 1));
    for (let i = pts.length - 2; i >= 0; i--) if (!fixed[i]) H[i] = Math.min(H[i], H[i + 1] + step(i, i + 1));
    const cut = H0.map((h, i) => (filled[i] ? Math.abs(h - H[i]) > 0.15 : h - H[i] > 0.15));
    // a way may ask for a broader cut than its lane where it climbs through a shelf (roads.js `cut`)
    const hw = road.cut ?? road.width / 2 + 1.6;
    let run = null;
    const close = () => {
      if (!run) return;
      const [i0, i1] = [Math.max(0, run[0] - 3), Math.min(pts.length - 1, run[1] + 3)];
      for (let i = i0 + 1; i <= i1; i++) {
        B.passSegs.push({ ax: pts[i - 1].x, az: pts[i - 1].z, bx: pts[i].x, bz: pts[i].z, ah: H[i - 1], bh: H[i], hw, first: i === i0 + 1, last: i === i1 });
      }
      let [lo, hi] = H[i0] <= H[i1] ? [i0, i1] : [i1, i0];
      let len = 0;
      for (let i = i0 + 1; i <= i1; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      isl.passes.push({
        way: road.id ?? road.name ?? null, x: (pts[lo].x + pts[hi].x) / 2, z: (pts[lo].z + pts[hi].z) / 2,
        yaw: Math.atan2(pts[hi].x - pts[lo].x, pts[hi].z - pts[lo].z), from: H[lo], to: H[hi],
        width: hw * 2, len, ax: pts[lo].x, az: pts[lo].z, bx: pts[hi].x, bz: pts[hi].z,
      });
      run = null;
    };
    // cuts a few samples apart are one cut: the few metres between two shelf edges would
    // otherwise be left to whatever block a mesh cell happens to centre on
    const runs = [];
    for (let i = 0; i < pts.length; i++) {
      if (!cut[i]) continue;
      const last = runs[runs.length - 1];
      if (last && i - last[1] <= 5) last[1] = i;
      else runs.push([i, i]);
    }
    for (const r of runs) { run = r; close(); }
  }
  for (const s of B.passSegs) {
    const pad = s.hw + 8;
    for (let ix = Math.floor((Math.min(s.ax, s.bx) - pad) / 32); ix <= Math.floor((Math.max(s.ax, s.bx) + pad) / 32); ix++) {
      for (let iz = Math.floor((Math.min(s.az, s.bz) - pad) / 32); iz <= Math.floor((Math.max(s.az, s.bz) + pad) / 32); iz++) {
        const key = ix * 100003 + iz;
        if (!B.passCells.has(key)) B.passCells.set(key, []);
        B.passCells.get(key).push(s);
      }
    }
  }
}

// Nearest pass cut: distance from its centreline minus its half width, and the ramp height.
function passAt(isl, x, z, clamp = false) {
  let best = Infinity, height = 0, beyond = false;
  for (const s of isl.blk.passCells.get(Math.floor(x / 32) * 100003 + Math.floor(z / 32)) || []) {
    // past the open ends of a cut the ground is the ground, not the ramp's end height
    const dx = s.bx - s.ax, dz = s.bz - s.az, u = ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1);
    const out = (s.first && u < 0) || (s.last && u > 1);
    if (out && !clamp) continue;
    const [d, t] = segDist(x, z, s.ax, s.az, s.bx, s.bz);
    if (d - s.hw < best) { best = d - s.hw; height = lerp(s.ah, s.bh, t); beyond = out; }
  }
  return { d: best, height, beyond };
}

// ---------------------------------------------------------------- heights
// Ground parameters at a point, blended across sub-region zones.
function groundAt(isl, x, z, zw) {
  const g = groundOf(isl.biome);
  let low = g.low, soft = g.soft, marsh = isl.biome === 'marsh' ? 1 : 0, biome = isl.biome, wb = 0.5;
  if (zw) for (const [zn, w] of zw) {
    if (zn.sink) continue;
    const z2 = groundOf(zn.biome);
    low = lerp(low, z2.low, w);
    soft = lerp(soft, z2.soft, w);
    marsh = lerp(marsh, zn.biome === 'marsh' ? 1 : 0, w);
    if (w > wb) { wb = w; biome = zn.biome; }
  }
  return { low, soft, marsh, biome };
}

// The level of the shelf at (x, z), or NaN on open lowland.
function levelAt(isl, x, z, inland, biome) {
  const B = isl.blk;
  const n = isl.noise;
  let L = NaN;
  // low shelves on open ground, kept off flats and ways so towns and routes stay level
  const [step, amp] = B.shelf;
  if (step > 0 && inland > 26) {
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    const m = n.fbm((gx + 0.5) * 8 * 0.0042 + 300, (gz + 0.5) * 8 * 0.0042 - 200, 2) + 0.07 * (hash2(gx, gz, isl.seed) - 0.5);
    const k = Math.floor(Math.max(0, (m - 0.06) / 0.42) * amp / step);
    if (k > 0 && !nearKept(isl, x, z)) L = B.low0 + k * step;
  }

  let lo = Infinity, top = -Infinity, exact = -Infinity;
  for (const s of B.grid.get(Math.floor(x / B.G) * 100003 + Math.floor(z / B.G)) || []) {
    if (!shapeHit(s, x, z, inland, s.noise || n)) continue;
    if (s.op === 0) L = L === L ? Math.max(L, s.top) : s.top;
    else if (s.op === 1) lo = Math.min(lo, s.top);
    else if (s.op === 3) exact = Math.max(exact, s.top);
    else top = Math.max(top, s.top);
  }
  // A basin cuts shelves down to its floor; on open lowland it only sinks ground that lies
  // above its floor, and h: 'low' (-Infinity) returns it to the lowland itself.
  if (lo === -Infinity) L = NaN;
  else if (lo < Infinity) L = L === L ? Math.min(L, lo) : lo < B.low0 ? lo : NaN;
  if (top > -Infinity) L = L === L ? Math.max(L, top) : top;
  // A settlement's flat that lies well below a shelf cuts its own ground out of it, so the
  // shelf ends at the town's edge in a wall instead of a slumped ramp.
  if (L === L) for (const f of isl.flats || []) {
    if (f.r && typeof f.h === 'number' && L > f.h + 1.5 && (x - f.x) ** 2 + (z - f.z) ** 2 < f.r * f.r) { L = NaN; break; }
  }
  // the settlement's own shelves stand on whatever is around them
  if (exact > -Infinity && !(L === L && L > exact - EXACT)) L = exact;
  return L;
}

function inDry(isl, x, z) {
  for (const s of isl.blk.dry) {
    for (let i = 1; i < s.points.length; i++) {
      const [a, b] = [s.points[i - 1], s.points[i]];
      if (segDist(x, z, a[0], a[1], b[0], b[1])[0] < s.w / 2) return true;
    }
  }
  return false;
}

function nearKept(isl, x, z) {
  for (const f of isl.flats || []) if (Math.hypot(x - f.x, z - f.z) < f.r * 1.25 + 8) return true;
  return isl.roads.length > 0 && isl.roadAt(x, z).d < 16;
}

// Everything at a point except its level: h(level) = a * (level ? level + soft : low) + t.
// `low` is the lowland ground there (coast profile, soft relief, fen pools), `soft` the gentle
// relief a shelf top keeps, and (a, t) the lerps that flats and lakes apply on top.
function terms(isl, x, z, out, noFlats = false) {
  const n = isl.noise;
  // the coast wanders; a small isle's on a short grain too, so it is not a ring
  const coast = n.fbm(x * 0.007 + 100, z * 0.007 - 50, 3) + (isl.coastDetail ? isl.coastDetail * n.fbm(x * 0.045 + 7, z * 0.045 - 3, 2) : 0);
  const d = islandDist(isl, x, z) / (1 + isl.coastAmp * coast);
  const k = isl.outline ? 180 : isl.radius;
  out.inland = -(d - 0.88) * k;
  out.a = 1; out.t = 0; out.soft = 0;
  if (d > 1.32) {
    out.low = isl.voidFloor;
    return out;
  }
  const zw = isl.zoneWeights(x, z);
  const g = groundAt(isl, x, z, zw);
  out.biome = g.biome;
  const beach = 0.04 * k;
  let cp;
  if (d >= 0.94) cp = lerp(-1.6, isl.voidFloor, smoothstep(0.94, 1.3, d));
  else if (d >= 0.84) cp = lerp(1.1, -1.6, (d - 0.84) / 0.1);
  else cp = lerp(1.1, g.low, smoothstep(beach, beach + 35, out.inland));
  const detail = n.noise(x * 0.06, z * 0.06);
  let soft = (g.soft * n.fbm(x * 0.0065 + 11, z * 0.0065 - 7, 3) + 0.3 * detail) * smoothstep(beach, beach + 30, out.inland);
  if (isl.blkTarns?.length) soft -= moundHeight(isl.blkTarns, x, z);
  for (const c of isl.blkCraters || []) {
    const r = Math.hypot(x - c.x, z - c.z);
    if (r > c.outer) continue;
    // the rim's height wanders round the ring (noise on the unit circle, so it has no seam)
    const ca = (x - c.x) / (r || 1), sa = (z - c.z) / (r || 1);
    const crest = c.h * (0.82 + 0.18 * n.fbm(ca * 1.6 + 5, sa * 1.6 + r * 0.02, 2) + 0.1 * n.noise(x * 0.05, z * 0.05));
    soft += r < c.crest ? c.base + (crest - c.base) * smoothstep(c.floor, c.crest, r) : crest * smoothstep(c.outer, c.crest, r);
  }
  for (const c of isl.blkChannels || []) {
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    let dc = Infinity;
    for (let i = 1; i < c.pts.length; i++) dc = Math.min(dc, segDist(x, z, c.pts[i - 1][0], c.pts[i - 1][1], c.pts[i][0], c.pts[i][1])[0]);
    soft -= c.h * smoothstep(c.hw * 1.9, c.hw * 0.6, dc);
  }
  out.soft = soft;
  let low = cp + soft;
  // The fen: damp hollows where the peat has sunk, and between them tussock hummocks a metre
  // or three high. Its open water is the authored meres; none on flats, ways or the dry
  // corridors a landform keeps (`dry`).
  if (g.marsh > 0.2 && d < 0.86 && out.inland > 9) {
    const m = n.fbm(x * 0.017 + 9, z * 0.017 - 4, 3) + 0.22 * n.noise(x * 0.052 + 3, z * 0.052 - 1);
    const t = 0.1 + (1 - g.marsh) * 0.55; // the wetter the ground, the more of it is water
    const inland = smoothstep(9, 30, out.inland);
    if (m > t - 0.12 && !nearKept(isl, x, z) && !inDry(isl, x, z)) {
      // Damp hollows where the peat has settled, kept above the waterline: open water in the
      // fen is only the authored meres (sink zones), whose surface lies still. Knee-deep pools
      // cut here stood under the sea's swell, which washed in and out of them as it rolled.
      const depth = Math.min(0.3, (m - t + 0.12) * 2.5) + Math.max(0, m - t) * 3;
      low = Math.max(Math.min(low, 0.45), low - Math.min(1.1 * g.marsh, depth) * inland);
    } else if (m < t - 0.12) {
      const hum = n.noise(x * 0.047 + 31, z * 0.047 - 12) + 0.35 * n.noise(x * 0.13 - 5, z * 0.13 + 2);
      if (hum > 0.1 && !nearKept(isl, x, z)) low += Math.min(1, (hum - 0.1) * 1.6) * (1.2 + 1.6 * smoothstep(0.3, 0.9, hum)) * g.marsh * smoothstep(t - 0.12, t - 0.3, m) * inland;
    }
  }
  // Ways keep their feet dry where they run along low shore.
  if (isl.roads.length) {
    const rd = isl.roadAt(x, z).d;
    if (rd < 6) low = Math.max(low, lerp(low, 1.7, smoothstep(6, 1.5, rd)));
  }
  out.low = low;
  // lakes: zones with `sink` drop the ground below the waterline
  let sink = 0, depth = 3.2;
  if (zw) for (const [zn, w] of zw) if (zn.sink && w > sink) { sink = w; depth = zn.depth ?? 3.2; }
  if (sink > 0) lerpTo(out, sink, -depth + detail * 0.4);
  // smooth rises (the Arches' Foot) lift every level alike
  // Smooth rises (the Arches' Foot) shape the open ground only: a shelf over one stays level,
  // so a rise reads as the road's ramp up through the rock that stands around it.
  for (const rise of isl.rises || []) {
    let dx = x - rise.x, dz = z - rise.z;
    // `rot` turns a rise like a landform shape (world/landforms.js makeShape)
    if (rise.rot) [dx, dz] = [dx * Math.cos(rise.rot) + dz * Math.sin(rise.rot), -dx * Math.sin(rise.rot) + dz * Math.cos(rise.rot)];
    const e = Math.hypot(dx / rise.rx, dz / rise.rz);
    if (e < 1) out.low += rise.h * (1 - e * e) ** (rise.sharp ?? 1.25);
  }
  if (isl.blkMounds?.length) out.low += moundHeight(isl.blkMounds, x, z);
  if (noFlats) return out;
  for (const f of isl.flats || []) {
    const fd = Math.hypot(x - f.x, z - f.z);
    if (fd < f.r) lerpTo(out, smoothstep(f.r, f.r * (f.core ?? 0.55), fd), f.h);
  }
  return out;
}
function lerpTo(o, w, target) {
  o.a *= 1 - w;
  o.t = o.t * (1 - w) + w * target;
}
const levelHeight = (o, L) => (L >= EXACT / 2 ? L - EXACT : o.a * (L === L ? L + o.soft : o.low) + o.t);

const _t = {};
// Exact height at a point (the level is taken at the point itself, not its mesh cell).
export function blockHeight(isl, x, z, noFlats = false) {
  terms(isl, x, z, _t, noFlats);
  if (_t.low === isl.voidFloor && _t.inland < 0) return _t.low;
  const p = isl.blk.passSegs.length ? passAt(isl, x, z) : null;
  if (p && p.d < 0) return p.height;
  return levelHeight(_t, levelAt(isl, x, z, _t.inland, _t.biome));
}

// ---------------------------------------------------------------- mesh
export function buildBlocks(isl) {
  const NX = isl.nx, NZ = isl.nz, VX = NX + 1, VZ = NZ + 1;
  const nV = VX * VZ;
  const LOW = new Float32Array(nV), SOFT = new Float32Array(nV), A = new Float32Array(nV), T = new Float32Array(nV), INL = new Float32Array(nV);
  const RAMP = new Float32Array(nV).fill(NaN);
  const BIOME = new Array(nV);
  const o = {};
  for (let j = 0; j < VZ; j++) {
    for (let i = 0; i < VX; i++) {
      const v = j * VX + i;
      const x = isl.x0 + i * isl.cellX, z = isl.z0 + j * isl.cellZ;
      terms(isl, x, z, o);
      LOW[v] = o.low; SOFT[v] = o.soft; A[v] = o.a; T[v] = o.t; INL[v] = o.inland; BIOME[v] = o.biome || isl.biome;
      if (isl.blk.passSegs.length) {
        // cut cells lie on the ramp; just past a cut's open end they meet the real ground
        // when it is close, so the mouth has no lip
        const p = passAt(isl, x, z, true);
        if (p.d < 6) {
          let h = p.height;
          if (p.beyond) { const e = blockHeight(isl, x, z); if (Math.abs(e - h) < 1.5) h = e; }
          RAMP[v] = h;
        }
      }
    }
  }
  const cellL = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = isl.x0 + (i + 0.5) * isl.cellX, z = isl.z0 + (j + 0.5) * isl.cellZ;
      const v = j * VX + i;
      // a cell touched by a cut takes the exact ground at its corners
      if (isl.blk.passSegs.length && RAMP[v] === RAMP[v] && RAMP[v + 1] === RAMP[v + 1] && RAMP[v + VX] === RAMP[v + VX] && RAMP[v + VX + 1] === RAMP[v + VX + 1] && passAt(isl, x, z).d < 0) {
        cellL[j * NX + i] = PASS;
        continue;
      }
      terms(isl, x, z, o, true);
      cellL[j * NX + i] = o.low === isl.voidFloor && o.inland < 0 ? NaN : levelAt(isl, x, z, o.inland, o.biome || isl.biome);
    }
  }
  Object.assign(isl.blk, { LOW, SOFT, A, T, INL, RAMP, cellL, VX });
  isl.V = VX;
  talus(isl);
  isl.mesh = blockMesh(isl, BIOME);
}

// Scree. A wall sheds stone, and what falls lies against its foot: the ground at the base of
// every tall wall ramps up a metre or two toward it over the next cell or two. It is real
// ground (movement reads it through cornerH), a gentle slope that only shortens the wall.
// Towns, passes, roads, flats and the shore keep their exact ground. TAL[v] is the rise at
// vertex v on the level TALL[v] (the wall's foot); CON[v] how much wall stands over it.
const sameL = (a, b) => a === b || (a !== a && b !== b);
const SEABED = new THREE.Color('#8a7d5c'); // the open sea floor (world/terrain.js)
const AROUND = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
function talus(isl) {
  const B = isl.blk, NX = isl.nx, NZ = isl.nz, VX = NX + 1, nV = VX * (NZ + 1);
  const TAL = new Float32Array(nV), TALL = new Float32Array(nV).fill(NaN), CON = new Float32Array(nV);
  const kept = keptSites(isl);
  const blocked = (x, z) => (isl.roads.length && isl.roadAt(x, z).d < 6) || kept(x, z);
  const foot = new Uint8Array(nV);
  for (let j = 1; j < NZ; j++) {
    for (let i = 1; i < NX; i++) {
      const v = j * VX + i;
      let lo = Infinity, hi = -Infinity, baseL = NaN, pass = false;
      for (const [di, dj] of AROUND) {
        const L = B.cellL[(j + dj) * NX + i + di];
        if (L === PASS) pass = true;
        const h = cornerH(B, v, L);
        if (h < lo) { lo = h; baseL = L; }
        if (h > hi) hi = h;
      }
      const H = hi - lo;
      if (pass || H < 1.2 || baseL >= EXACT / 2 || lo < 0.4 || B.A[v] < 0.98) continue;
      const x = isl.x0 + i * isl.cellX, z = isl.z0 + j * isl.cellZ;
      if (blocked(x, z)) continue;
      TALL[v] = baseL;
      CON[v] = Math.min(1, H / 8);
      if (H < 3.5) continue;
      TAL[v] = Math.min(2.6, 0.45 + 0.12 * H) * (0.7 + 0.6 * hash2(i, j, isl.seed + 29));
      foot[v] = 1;
    }
  }
  // the apron runs out over the next ring of open ground on the same level
  for (let j = 1; j < NZ; j++) {
    for (let i = 1; i < NX; i++) {
      const v = j * VX + i;
      if (foot[v]) continue;
      const L0 = B.cellL[j * NX + i];
      let flat = L0 !== PASS && !(L0 >= EXACT / 2);
      for (const [di, dj] of AROUND) if (flat && !sameL(B.cellL[(j + dj) * NX + i + di], L0)) flat = false;
      if (!flat || B.A[v] < 0.98) continue;
      let t = 0;
      for (const [di, dj, k] of [[1, 0, 0.42], [-1, 0, 0.42], [0, 1, 0.42], [0, -1, 0.42], [1, 1, 0.26], [-1, 1, 0.26], [1, -1, 0.26], [-1, -1, 0.26]]) {
        const n = (j + dj) * VX + i + di;
        if (foot[n] && sameL(TALL[n], L0)) t = Math.max(t, TAL[n] * k);
      }
      if (t < 0.05 || blocked(isl.x0 + i * isl.cellX, isl.z0 + j * isl.cellZ)) continue;
      TAL[v] = t;
      TALL[v] = L0;
      CON[v] = Math.max(CON[v], t * 0.2);
    }
  }
  Object.assign(B, { TAL, TALL, CON });
}

// Built places keep the ground they were laid out on: no scree under a house or a camp.
function keptSites(isl) {
  const cells = new Map();
  for (const s of [...STRUCTURES, ...ARCHITECTURE.map((a) => ({ ...a, r: Math.max(a.r || 0, 18) }))]) {
    if (!isl.contains(s.x, s.z)) continue;
    const r = Math.max(s.r || 0, (s.w || 0) / 2, (s.d || 0) / 2, (s.len || 0) / 2, 6) + 6;
    for (let ix = Math.floor((s.x - r) / 32); ix <= Math.floor((s.x + r) / 32); ix++) {
      for (let iz = Math.floor((s.z - r) / 32); iz <= Math.floor((s.z + r) / 32); iz++) {
        const key = ix * 100003 + iz;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push([s.x, s.z, r]);
      }
    }
  }
  return (x, z) => {
    for (const [sx, sz, r] of cells.get(Math.floor(x / 32) * 100003 + Math.floor(z / 32)) || []) if ((x - sx) ** 2 + (z - sz) ** 2 < r * r) return true;
    return false;
  };
}

const cornerH = (B, v, L) => {
  if (L === PASS) return B.RAMP[v];
  if (L >= EXACT / 2) return L - EXACT;
  let h = L === L ? L + B.SOFT[v] : B.LOW[v];
  if (B.TAL && B.TAL[v] > 0 && sameL(L, B.TALL[v])) h += B.TAL[v];
  return B.A[v] * h + B.T[v];
};

export function sampleBlocks(isl, x, z) {
  const fx = (x - isl.x0) / isl.cellX;
  const fz = (z - isl.z0) / isl.cellZ;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= isl.nx || j >= isl.nz) return isl.voidFloor;
  const u = fx - i, w = fz - j;
  const B = isl.blk, V = B.VX;
  const L = B.cellL[j * isl.nx + i];
  const ha = cornerH(B, j * V + i, L);
  const hb = cornerH(B, (j + 1) * V + i, L);
  const hc = cornerH(B, (j + 1) * V + i + 1, L);
  const hd = cornerH(B, j * V + i + 1, L);
  if (u + w <= 1) return ha + (hd - ha) * u + (hb - ha) * w;
  return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - w);
}

// Stone strata on the walls: beds of stone in a few tones, with dark seams. The wall
// geometry (blockMesh) notches its faces on the same beds: STRATA metres of warped height
// (bedY), offset by 0.8 sin(0.031 x + 0.027 z) so the courses wander gently along a cliff.
const STRATA = 3.4;
// Beds are not all one thickness: height is warped (monotonically) before it is cut into
// courses, so a cliff shows thin beds and thick ones, 2.3 to 6.7 m. The shader runs the same.
const bedY = (y) => y + 2.6 * Math.sin(y * 0.19 + 1.3);
const bedDY = (y) => 1 + 0.494 * Math.cos(y * 0.19 + 1.3);
function bedInv(w) {
  let y = w;
  for (let i = 0; i < 6; i++) y -= (bedY(y) - w) / bedDY(y);
  return y;
}
// What settles on a ledge: moss and turf on the green isles, snow in the north, ash at the
// furnace, rimed lichen on the Hush and lichen on the bare islets.
const LEDGE = { snow: '#e4ebf2', tundra: '#d3dbd7', volcanic: '#554c46', ashfield: '#554c46', hush: '#aab1b6', rock: '#7c7d64', beach: '#7d8a52', dunes: '#7d8a52' };
let groundMat = null;
function groundMaterial() {
  return (groundMat ||= Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, metalness: 0 }), { name: 'terrain_ground' }));
}
const wallMaterials = new Map();
function wallMaterial(biome) {
  const ledge = LEDGE[biome] || new THREE.Color((BIOME_COLORS[biome] || BIOME_COLORS.meadow).grass).multiplyScalar(0.82).getStyle();
  let m = wallMaterials.get(ledge);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.97, metalness: 0 });
  const uLedge = { value: new THREE.Color(ledge) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLedge = uLedge;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStrata;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrata = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStrata;\nuniform vec3 uLedge;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    // courses: each band its own bed of stone, warm or cool, cut into blocks with dark seams
    float wy = vStrata.y + 2.6 * sin(vStrata.y * 0.19 + 1.3) + 0.8 * sin(vStrata.x * 0.031 + vStrata.z * 0.027);
    float band = floor(wy / ${STRATA.toFixed(1)});
    float fy = fract(wy / ${STRATA.toFixed(1)});
    float along = vStrata.x + vStrata.z;
    float block = floor(along / 7.5 + band * 0.43);
    float hb = fract(sin(band * 17.137 + 4.1) * 43758.5453);
    float hsh = fract(sin(band * 12.9898 + block * 78.233) * 43758.5453);
    vec3 bed = mix(vec3(1.05, 1.0, 0.92), vec3(0.92, 0.97, 1.05), hb) * (0.86 + 0.2 * hb);
    float seamY = smoothstep(0.0, 0.06, fy) * smoothstep(1.0, 0.96, fy);
    float fb = fract(along / 7.5 + band * 0.43);
    float seamX = smoothstep(0.0, 0.025, fb) * smoothstep(1.0, 0.975, fb);
    // rain runs off each ledge and stains the course below it in narrow streaks
    float sh = fract(sin(floor(along * 0.8) * 91.7 + band * 3.1) * 43758.5453);
    float streak = step(0.78, sh) * smoothstep(0.1, 1.0, fy);
    diffuseColor.rgb *= bed * (0.93 + 0.12 * hsh) * mix(0.72, 1.0, seamY * mix(0.85, 1.0, seamX)) * (1.0 - 0.14 * streak);
  }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    // the faces a band leans back on catch what falls: moss, snow or ash
    vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float up = dot(normal, upV);
    diffuseColor.rgb = mix(diffuseColor.rgb, uLedge, smoothstep(0.16, 0.5, up) * 0.7);
  }`);
  };
  m.customProgramCacheKey = () => 'terrain-strata-2';
  m.name = 'terrain_strata';
  wallMaterials.set(ledge, m);
  return m;
}

function palette(biome) {
  const pal = BIOME_COLORS[biome] || BIOME_COLORS.meadow;
  const C = {};
  for (const k in pal) C[k] = new THREE.Color(pal[k]);
  return C;
}

function blockMesh(isl, BIOME) {
  const B = isl.blk;
  const NX = isl.nx, NZ = isl.nz, VX = NX + 1;
  const n = isl.noise;
  const pals = {};
  const pal = (b) => (pals[b] ||= palette(b));
  const pos = [], col = [];
  const topIdx = [], rockIdx = [];
  const levelIds = new Map();
  const vid = new Map();
  const tmp = new THREE.Color(), scree = new THREE.Color();
  const lush = new THREE.Color('#4a8a38'), dry = new THREE.Color('#b8a060'), heath = new THREE.Color('#7f7559');
  const bracken = new THREE.Color('#6e5532');
  const lavaVein = new THREE.Color('#a8401a');
  const cell = (isl.cellX + isl.cellZ) / 2;
  const lvl = (L) => {
    const key = L === L ? L : 'low';
    if (!levelIds.has(key)) levelIds.set(key, levelIds.size);
    return levelIds.get(key);
  };

  // Ground colour for one biome. The cover mixes its two greens (or snows, ashes, heathers),
  // then the ground shows through in patches of its own: soil worn through, moss in the damp,
  // ground bleached, blown or trodden; broad drifts of light and shade keep a plain from
  // reading as one tone. Sand belongs to the shore (by distance inland), not to every low
  // shelf, so a low inland meadow stays a meadow.
  const shadeTop = (out, biome, h, slope, x, z, inland, soft) => {
    const P = pal(biome);
    const mix = 0.5 + 0.5 * n.noise(x * 0.03, z * 0.03) + 0.18 * (n.noise(x * 0.11, z * 0.09) - 0.5);
    const snowy = biome === 'snow' || biome === 'tundra';
    const volcanic = biome === 'volcanic' || biome === 'ashfield';
    const peat = biome === 'marsh' && h < -0.25;
    // under water the ground darkens with depth and fades into the open seabed, so an isle's
    // own patch of sea floor has no edge where its mesh ends
    if (h < -0.9 || peat) return out.copy(P.under).lerp(P.sand, smoothstep(-6, -1, h) * (peat ? 0.12 : 0.5)).lerp(SEABED, peat ? 0 : smoothstep(-4, -12, h));
    out.copy(P.grass).lerp(P.grass2, mix);
    if (biome === 'farmland') {
      const strip = Math.sin(x * 0.11 + Math.sin(z * 0.013) * 3) * Math.sin(z * 0.09);
      if (strip > 0.35) out.lerp(P.grass2, 0.7);
      else if (strip < -0.45) out.lerp(tmp.set('#7d8a46'), 0.5);
    }
    out.multiplyScalar(1 + 0.09 * n.fbm(x * 0.0055 + 31, z * 0.0055 - 17, 2));
    const soilN = n.noise(x * 0.031 - 7, z * 0.031 + 19) + 0.3 * n.noise(x * 0.13 + 5, z * 0.13);
    if (soilN > 0.5) out.lerp(P.soil, smoothstep(0.5, 0.9, soilN) * (volcanic ? 0.7 : 0.48));
    const mossN = n.noise(x * 0.043 + 23, z * 0.043 + 3) + 0.25 * n.noise(x * 0.16 - 3, z * 0.16 + 8);
    if (mossN > 0.45) out.lerp(P.moss, smoothstep(0.45, 0.85, mossN) * (biome === 'hush' ? 0.55 : 0.42));
    const wearN = n.noise(x * 0.052 - 41, z * 0.052 + 13);
    if (wearN > 0.55) out.lerp(P.wear, smoothstep(0.55, 0.88, wearN) * 0.38);
    if (volcanic) {
      // black basalt flows across the ash, and the old veins still glow dull red in cracks
      const flow = n.fbm(x * 0.011 + 7, z * 0.011 - 3, 3) + 0.15 * n.noise(x * 0.06, z * 0.06);
      out.lerp(P.rock, smoothstep(0.08, 0.32, flow) * 0.8);
      if (h > 30) out.lerp(P.high, 0.35);
      const crack = n.noise(x * 0.09 - 3, z * 0.09 + 11);
      if (crack > 0.76 && flow > 0.1) out.lerp(lavaVein, smoothstep(0.76, 0.88, crack) * 0.5);
    } else if (snowy) {
      // drifts: bright on the windward crests, blue in the hollows, rock where the wind scours
      const drift = n.noise(x * 0.018 + z * 0.041, z * 0.018 - x * 0.012);
      out.lerp(P.moss, smoothstep(0.25, 0.7, drift) * 0.6);
      out.lerp(tmp.set(biome === 'snow' ? '#aebfd6' : '#9eadb1'), smoothstep(0.2, -0.6, soft + drift * 0.5) * 0.45);
      const scour = n.noise(x * 0.07 + 2, z * 0.07 - 6);
      if (scour > 0.62) out.lerp(P.soil, smoothstep(0.62, 0.86, scour) * (biome === 'snow' ? 0.5 : 0.65));
    } else if (biome === 'hush') {
      // a winter moor: rime silvers the sedge in broad drifts, old snow lies in the hollows and
      // the lee of the rises, and the peat shows black where the wind has it bare
      const rime = n.noise(x * 0.016 + z * 0.033, z * 0.016 - x * 0.011);
      out.lerp(P.wear, smoothstep(0.05, 0.6, rime) * 0.32);
      out.lerp(P.high, smoothstep(0.05, -0.75, soft + rime * 0.45) * 0.62);
      const bare = n.noise(x * 0.064 - 5, z * 0.064 + 9);
      if (bare > 0.62) out.lerp(P.soil, smoothstep(0.62, 0.86, bare) * 0.42);
    } else if (biome !== 'marsh') {
      const patch = n.noise(x * 0.045 + 12, z * 0.045 - 8);
      if (patch > 0.62) out.lerp(lush, smoothstep(0.62, 0.82, patch) * 0.35);
      else if (patch < -0.55) out.lerp(dry, smoothstep(-0.55, -0.78, patch) * 0.32);
      const golden = Math.sin(x * 0.07 + z * 0.05) * Math.sin(z * 0.06 - x * 0.04);
      if (golden > 0.55 && (biome === 'meadow' || biome === 'farmland' || biome === 'beach' || biome === 'dunes')) out.lerp(dry, smoothstep(0.55, 0.85, golden) * 0.3);
    }
    if (biome === 'emberwood') {
      // bracken rusting in the glades, and the black soil showing through where it is worn
      const fern = n.noise(x * 0.05 - 19, z * 0.05 + 7) + 0.3 * n.noise(x * 0.14 + 6, z * 0.14 - 2);
      if (fern > 0.35) out.lerp(bracken, smoothstep(0.35, 0.75, fern) * 0.38);
    }
    if (biome === 'marsh') {
      // mud where the water reaches, straw-coloured sedge and dead reed on the tussocks
      out.lerp(P.soil, smoothstep(1.3, 0.25, h) * 0.75);
      const straw = n.noise(x * 0.06 + 17, z * 0.06 - 5) + 0.3 * n.noise(x * 0.17, z * 0.17 + 9);
      if (straw > 0.3) out.lerp(P.wear, smoothstep(0.3, 0.75, straw) * 0.5);
      out.lerp(P.sand, smoothstep(2.4, 4.2, h) * 0.25);
    }
    if (biome === 'dunes') {
      // bare sand on the crests and in the blowouts; marram and heath hold the rest of the plain
      // (the strand below is the beach, so the grass behind it must read as grass)
      const cover = n.noise(x * 0.034 + 5, z * 0.034 - 9) + 0.35 * n.noise(x * 0.11 - 2, z * 0.11 + 4) + 0.25 * soft;
      out.lerp(tmp.copy(P.sand).lerp(P.wear, smoothstep(0.2, 0.9, n.noise(x * 0.06, z * 0.06 + 3)) * 0.5), smoothstep(-0.2, -0.6, cover) * 0.85);
      const hollow = n.noise(x * 0.07 - 11, z * 0.07 + 5);
      if (hollow > 0.48) out.lerp(heath, smoothstep(0.48, 0.8, hollow) * 0.35);
    }
    if (slope > 0.6) out.lerp(P.rock, smoothstep(0.6, 0.95, slope));
    if (snowy && slope > 0.35) out.lerp(P.soil, smoothstep(0.35, 0.7, slope) * 0.5);
    const frostLine = biome === 'snow' ? 6 : biome === 'tundra' ? 18 : biome === 'hush' ? 26 : 60;
    if (h > frostLine && !volcanic) out.lerp(P.high, smoothstep(0, 8, h - frostLine) * 0.6);
    // the shore: sand (or mud, in the fen) along the coast, darker where the sea wets it
    if (!volcanic) {
      // a small isle's beach is a strip, not its whole width; a rocky isle has sand only in coves
      const bw = isl.outline ? 34 : Math.min(34, isl.radius * 0.32);
      let shore = smoothstep(bw, bw * 0.35, inland + bw * 0.26 * n.noise(x * 0.021 + 4, z * 0.021 - 2)) * smoothstep(4.5, 2.0, h);
      if (biome === 'rock') shore *= smoothstep(-0.1, 0.4, n.noise(x * 0.05 + 8, z * 0.05 - 3));
      if (shore > 0) out.lerp(P.sand, shore * (slope > 0.9 ? 0.3 : 1));
      if (h < 1.1) out.lerp(tmp.copy(P.sand).lerp(P.under, 0.45).multiplyScalar(0.85), smoothstep(1.1, 0.25, h) * 0.6);
    }
    return out;
  };
  // A point's ground blends every biome whose zone reaches it. The edges wander with noise
  // (fingers of heath into dune, of tundra into snow) over tens of metres, rather than
  // switching at the line where one zone's weight passes another's.
  const ztmp = new THREE.Color();
  const groundColor = (out, v, h, slope, x, z) => {
    const inland = B.INL[v], soft = B.SOFT[v];
    shadeTop(out, isl.biome, h, slope, x, z, inland, soft);
    const zw = isl.zoneWeights(x, z);
    if (zw) for (const [zn, w] of zw) {
      if (zn.sink || w <= 0) continue;
      const k = smoothstep(0.15, 0.85, w + 0.3 * n.fbm(x * 0.016 + 3, z * 0.016 - 9, 3));
      if (k > 0.004) out.lerp(shadeTop(ztmp, zn.biome, h, slope, x, z, inland, soft), k);
    }
    return out;
  };

  const vx = (v) => isl.x0 + (v % VX) * isl.cellX;
  const vz = (v) => isl.z0 + Math.floor(v / VX) * isl.cellZ;
  const pushV = (x, y, z, c, k = 1) => {
    pos.push(x, y, z);
    col.push(c.r * k, c.g * k, c.b * k);
    return pos.length / 3 - 1;
  };
  // The vertex for corner v of a cell on level L, shared by every cell on that level.
  const corner = (v, L) => {
    const key = v * 8192 + lvl(L === PASS ? 'pass' : L);
    let id = vid.get(key);
    if (id !== undefined) return id;
    const h = cornerH(B, v, L);
    const i = v % VX, j = Math.floor(v / VX);
    const at = (ii, jj) => {
      const w = Math.max(0, Math.min(VX - 1, ii)) + Math.max(0, Math.min(isl.nz, jj)) * VX;
      const hh = cornerH(B, w, L);
      return hh === hh ? hh : h;
    };
    const slope = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * cell);
    const x = vx(v), z = vz(v);
    groundColor(tmp, v, h, L === PASS ? Math.min(slope, 0.5) : slope, x, z);
    if (B.rockyLevels.has(L)) {
      // a skerry's back: bare wet rock, lichen above the tide
      const P = pal(BIOME[v]);
      tmp.copy(P.rock).lerp(P.high, 0.35).lerp(P.moss, smoothstep(1.2, 3.5, h) * 0.3).multiplyScalar(0.85 + 0.15 * n.noise(x * 0.3, z * 0.3));
    }
    if (L === PASS) tmp.lerp(pal(BIOME[v]).rock, 0.25);
    if (B.TALL && sameL(L, B.TALL[v])) {
      // the foot of a wall: scree where stone has fallen, and the wall's own shade
      const P = pal(BIOME[v]);
      if (B.TAL[v] > 0) tmp.lerp(scree.copy(P.rock).lerp(P.soil || P.under, 0.3).multiplyScalar(0.78), Math.min(0.75, 0.2 + B.TAL[v] * 0.35));
      tmp.multiplyScalar(1 - 0.3 * B.CON[v]);
    }
    const jit = 0.94 + 0.12 * Math.abs(n.noise(x * 0.4, z * 0.4));
    id = pushV(x, h, z, tmp, jit);
    vid.set(key, id);
    return id;
  };

  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const L = B.cellL[j * NX + i];
      const a = corner(j * VX + i, L), b = corner((j + 1) * VX + i, L);
      const c = corner((j + 1) * VX + i + 1, L), d = corner(j * VX + i + 1, L);
      topIdx.push(a, b, d, b, c, d);
    }
  }

  // Walls wherever neighbouring cells stand on different levels.
  //
  // A wall is not a flat card. Every wall that meets a lattice vertex reads one profile there
  // (profile(v)): breakpoints in height, each with a recess into the rock. Where a level's
  // ground ends the recess is 0, so shelves and floors meet the wall on the grid line and
  // movement (which reads the grid) is unchanged. Between them the strata: each band stands
  // proud at its foot and leans back to a notch under the band above, so the bands catch the
  // sky on their slopes and throw a line of shadow under each overhang; under the turf the
  // rock is cut back so the lip overhangs. Recesses only ever go into the rock, and every
  // face meeting at a vertex shares its breakpoints, so neighbouring faces stay closed.
  const cliffs = [];
  const rockCol = new THREE.Color(), lipCol = new THREE.Color(), footCol = new THREE.Color(), mossCol = new THREE.Color(), c0 = new THREE.Color();
  const profiles = new Map();
  const profile = (v) => {
    let pr = profiles.get(v);
    if (pr) return pr;
    const i = v % VX, j = (v - i) / VX;
    const cs = [];
    for (const [di, dj] of AROUND) {
      const ci = i + di, cj = j + dj;
      if (ci < 0 || cj < 0 || ci >= NX || cj >= NZ) continue;
      cs.push([cornerH(B, v, B.cellL[cj * NX + ci]), di + 0.5, dj + 0.5]);
    }
    const hs = [...new Set(cs.map((c) => c[0]))].sort((a, b) => a - b);
    const x = vx(v), z = vz(v);
    const phase = 0.8 * Math.sin(x * 0.031 + z * 0.027);
    const ys = [], ox = [], oz = [], tops = new Map();
    const at = (y, r, ux, uz) => { ys.push(y); ox.push(ux * r); oz.push(uz * r); };
    at(hs[0], 0, 0, 0);
    for (let k = 1; k < hs.length; k++) {
      const lo = hs[k - 1], hi = hs[k], H = hi - lo;
      // into the rock: away from the cells open at this height, toward those standing over it
      let ux = 0, uz = 0;
      for (const [h, sx, sz] of cs) {
        const s = h >= hi - 1e-6 ? 1 : h <= lo + 1e-6 ? -1 : 0;
        ux += sx * s; uz += sz * s;
      }
      const ul = Math.hypot(ux, uz);
      const lip = Math.min(0.4 + 1.25 * hash2(v, k, 11), H * (H < 2.6 ? 0.4 : 0.26));
      tops.set(hi, hi - lip);
      if (H >= 2.6 && ul > 1e-6) {
        ux /= ul; uz /= ul;
        const amp = 0.35 + 0.65 * smoothstep(2.6, 10, H);
        const yl = hi - lip;
        for (let n = Math.ceil((bedY(lo + 1.2) + phase) / STRATA), top = Math.floor((bedY(yl - 1.0) + phase) / STRATA); n <= top; n++) {
          const y = bedInv(n * STRATA - phase);
          // the notch belongs to the band, so a stratum line runs on along the cliff; how far
          // each stretch has weathered back is the rock's own
          const notch = 0.3 + 0.34 * hash2(n, isl.seed, 13);
          at(y - notch, (0.25 + 0.5 * hash2(n, isl.seed, 21)) * amp * (0.85 + 0.3 * hash2(v, n, 17)), ux, uz);
          at(y, 0.05 * hash2(v, n, 19) * amp, ux, uz);
        }
        if (H >= 4) at(yl - 0.32, (0.3 + 0.26 * hash2(v, k, 23)) * amp, ux, uz);
        at(yl, 0.04, ux, uz);
      }
      at(hi, 0, 0, 0);
    }
    pr = { ys, ox, oz, tops };
    profiles.set(v, pr);
    return pr;
  };
  // One side of a face: the profile's breakpoints from y0 up to y1, cut at `cut` (the turf).
  const column = (pr, y0, y1, cut) => {
    const lo = [], hi = [];
    const lerpAt = (y) => {
      for (let k = 1; k < pr.ys.length; k++) {
        if (pr.ys[k] < y - 1e-6) continue;
        const a = pr.ys[k - 1], t = pr.ys[k] - a > 1e-9 ? (y - a) / (pr.ys[k] - a) : 0;
        return [y, lerp(pr.ox[k - 1], pr.ox[k], t), lerp(pr.oz[k - 1], pr.oz[k], t)];
      }
      return [y, 0, 0];
    };
    lo.push(lerpAt(y0));
    for (let k = 0; k < pr.ys.length; k++) {
      const y = pr.ys[k];
      if (y <= y0 + 1e-4 || y >= y1 - 1e-4) continue;
      if (Math.abs(y - cut) < 1e-4) continue;
      (y < cut ? lo : hi).push([y, pr.ox[k], pr.oz[k]]);
    }
    const c = lerpAt(cut);
    lo.push(c);
    hi.unshift(c);
    hi.push(lerpAt(y1));
    return [lo, hi];
  };
  const wall = (p, q, LA, LB, nx, nz) => {
    const hAp = cornerH(B, p, LA), hAq = cornerH(B, q, LA), hBp = cornerH(B, p, LB), hBq = cornerH(B, q, LB);
    if (Math.abs(hAp - hBp) < 0.03 && Math.abs(hAq - hBq) < 0.03) return;
    const aUp = hAp + hAq >= hBp + hBq;
    const [tp, tq, bp, bq] = aUp ? [hAp, hAq, hBp, hBq] : [hBp, hBq, hAp, hAq];
    const sx = aUp ? 1 : -1; // the wall faces the lower cell
    const px = vx(p), pz = vz(p), qx = vx(q), qz = vz(q);
    const biome = BIOME[p];
    const P = pal(biome);
    // weathered stone as the shelf broke; the strata shader bands it into courses
    rockCol.copy(P.rock).lerp(P.high, 0.42).multiplyScalar(1.04);
    if (biome === 'snow' || biome === 'tundra') rockCol.copy(P.rock).lerp(P.high, 0.12);
    if (biome === 'hush') rockCol.copy(P.rock).lerp(P.high, 0.2);
    if (biome === 'volcanic' || biome === 'ashfield') rockCol.copy(P.rock).lerp(P.sand, 0.25);
    footCol.copy(rockCol).multiplyScalar(0.62);
    const upper = aUp ? LA : LB;
    const topCorner = corner(p, upper);
    lipCol.setRGB(col[topCorner * 3], col[topCorner * 3 + 1], col[topCorner * 3 + 2]);
    // the turf's torn edge: darker soil and roots where it hangs over the face
    mossCol.copy(lipCol).lerp(P.under, 0.35).multiplyScalar(0.68);
    const Pp = profile(p), Pq = profile(q);
    const cutP = Math.max(bp, Pp.tops.get(tp) ?? tp - Math.min(0.5, (tp - bp) * 0.4));
    const cutQ = Math.max(bq, Pq.tops.get(tq) ?? tq - Math.min(0.5, (tq - bq) * 0.4));
    const [rockP, lipP] = column(Pp, bp, tp, cutP), [rockQ, lipQ] = column(Pq, bq, tq, cutQ);
    // orientation: (p->q) x up must point along the outward normal, else flip the winding
    const ex = qx - px, ez = qz - pz;
    const flip = (-ez * (nx * sx) + ex * (nz * sx)) < 0; // (ex,0,ez) x (0,1,0) = (-ez, 0, ex)
    const ramp = (a, b, y) => (b - a > 1e-6 ? smoothstep(a, b, y) : 1);
    const shade = (y, y0, y1, lipSide) => {
      if (lipSide) return c0.copy(mossCol).lerp(lipCol, ramp(y0, y1, y));
      // dark at the foot where it stands in its own scree, weathering paler toward the top
      return c0.copy(footCol).lerp(rockCol, ramp(y0, y0 + Math.min(4, (y1 - y0) * 0.6), y));
    };
    const strip = (L, R, list, lipSide) => {
      if (L[L.length - 1][0] - L[0][0] < 0.01 && R[R.length - 1][0] - R[0][0] < 0.01) return;
      const [l0, l1, r0, r1] = [L[0][0], L[L.length - 1][0], R[0][0], R[R.length - 1][0]];
      const vL = L.map(([y, ox, oz]) => pushV(px + ox, y, pz + oz, shade(y, lipSide ? l0 : bp, lipSide ? l1 : tp, lipSide)));
      const vR = R.map(([y, ox, oz]) => pushV(qx + ox, y, qz + oz, shade(y, lipSide ? r0 : bq, lipSide ? r1 : tq, lipSide)));
      const tri = (a, b, c) => {
        // a zero-height step leaves a sliver with no area: no fragments, so leave it out
        const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
        const wx = pos[c * 3] - pos[a * 3], wy = pos[c * 3 + 1] - pos[a * 3 + 1], wz = pos[c * 3 + 2] - pos[a * 3 + 2];
        if ((uy * wz - uz * wy) ** 2 + (uz * wx - ux * wz) ** 2 + (ux * wy - uy * wx) ** 2 < 1e-10) return;
        if (flip) list.push(a, c, b);
        else list.push(a, b, c);
      };
      let i = 0, k = 0;
      const tL = (n) => (l1 - l0 > 1e-6 ? (L[n][0] - l0) / (l1 - l0) : n / (L.length - 1));
      const tR = (n) => (r1 - r0 > 1e-6 ? (R[n][0] - r0) / (r1 - r0) : n / (R.length - 1));
      while (i < L.length - 1 || k < R.length - 1) {
        if (k >= R.length - 1 || (i < L.length - 1 && tL(i + 1) <= tR(k + 1))) { tri(vL[i], vR[k], vL[i + 1]); i++; }
        else { tri(vL[i], vR[k], vR[k + 1]); k++; }
      }
    };
    strip(rockP, rockQ, rockIdx, false);
    strip(lipP, lipQ, topIdx, true);
    const hMid = (tp - bp + tq - bq) / 2;
    if (hMid > 1.5) cliffs.push({ x: (px + qx) / 2, z: (pz + qz) / 2, nx: nx * sx, nz: nz * sx, top: (tp + tq) / 2, bot: (bp + bq) / 2, len: Math.hypot(ex, ez), biome, ax: px, az: pz, bx: qx, bz: qz });
  };
  const same = (a, b) => a === b || (a !== a && b !== b);
  for (let j = 0; j < NZ; j++) {
    for (let i = 1; i < NX; i++) {
      const LA = B.cellL[j * NX + i - 1], LB = B.cellL[j * NX + i];
      if (!same(LA, LB)) wall(j * VX + i, (j + 1) * VX + i, LA, LB, 1, 0, j * NX + i);
    }
  }
  for (let j = 1; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const LA = B.cellL[(j - 1) * NX + i], LB = B.cellL[j * NX + i];
      if (!same(LA, LB)) wall(j * VX + i, j * VX + i + 1, LA, LB, 0, 1, j * NX + i + 7919);
    }
  }
  B.cliffs = cliffs;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array([...topIdx, ...rockIdx]), 1));
  geo.addGroup(0, topIdx.length, 0);
  geo.addGroup(topIdx.length, rockIdx.length, 1);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // The ground is smooth-shaded: rolling dunes and moor read as land, not as a field of
  // facets; the rock walls keep their flat-cut faces.
  const mesh = new THREE.Mesh(geo, [groundMaterial(), wallMaterial(isl.biome)]);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain_' + isl.id;
  return mesh;
}
