import * as THREE from 'three';
// Implied routes. Lanes are drawn only where people walk every day (data/ways.js
// SETTLEMENT_GROUNDS); out in the open a route is told by the land and a few honest signs:
// a cairn at a fork or a blind bend, marker poles across snow, withies in the fen, broken
// runs of the old Compact paving, a lantern where a lane leaves town and steps cut into a
// climb. Nothing joins them up, so the traveller reads the way rather than follows a line.
import { LOCATIONS, islandAtPoint, biomeOfPoint } from '../data/world.js';
import { ROADS } from '../data/roads.js';
import { CIVIC_ROADS, SETTLEMENT_ROADS } from '../data/architecture.js';
import { SETTLEMENT_GROUNDS, SETTLEMENT_FADE, WAY_MARKS, STEP_GRADE, STEP_SPAN } from '../data/ways.js';
import { samplePath } from './paths.js';
import { Kit } from './kit.js';
import { familyFor } from './style.js';
import { seededRandom, smoothstep } from '../core/util.js';

let grounds = null;
// Settlement cores in world space (LOCATIONS are already placed).
export function settlementGrounds() {
  return grounds ||= SETTLEMENT_GROUNDS.map(g => {
    const at = LOCATIONS.find(l => l.name === g.name);
    if (!at) throw new Error(`settlement ground "${g.name}" names no location`);
    return { name: g.name, x: at.x, z: at.z, r: g.r ?? at.r };
  });
}

// 1 inside a settlement's worn ground, falling to 0 over SETTLEMENT_FADE past its edge.
export function settlementWeight(x, z) {
  let s = 0;
  for (const g of settlementGrounds()) {
    const d = Math.hypot(x - g.x, z - g.z);
    if (d < g.r + SETTLEMENT_FADE) s = Math.max(s, smoothstep(g.r + SETTLEMENT_FADE, g.r, d));
  }
  return s;
}

// The stretches of a sampled lane that run through settled ground. Charts ink only these:
// a town's streets are known, the way between towns is found by walking it.
export function settledRuns(samples, min = 0.5) {
  const runs = [];
  let run = null;
  for (const p of samples) {
    if (settlementWeight(p.x, p.z) >= min) (run ||= []).push(p);
    else if (run) { if (run.length > 1) runs.push(run); run = null; }
  }
  if (run && run.length > 1) runs.push(run);
  return runs;
}

// Every walked route: the regional ways plus town lanes (which run out into the open too).
export function allWays() {
  return [
    ...ROADS.map(r => ({ ...r, regional: true })),
    ...[...CIVIC_ROADS, ...SETTLEMENT_ROADS].map((r, i) => ({ ...r, id: r.id || `lane_${i}`, kind: r.kind || 'dirt' })),
  ].filter(w => w.points[0][0] < 3000);
}

// The mark a route uses at a point: the Compact's roads keep their paving, otherwise the
// country decides (snow, ash and fen each have their own way of marking ground).
function markAt(way, x, z) {
  if (way.kind === 'stone') return 'paving';
  if (way.kind === 'snow') return 'pole';
  if (way.kind === 'ash') return 'basalt';
  const hit = islandAtPoint(x, z);
  const biome = hit ? biomeOfPoint(hit.island, x, z) : 'meadow';
  if (biome === 'snow' || biome === 'tundra') return 'pole';
  if (biome === 'volcanic' || biome === 'ashfield') return 'basalt';
  if (biome === 'marsh') return 'withy';
  return 'cairn';
}
const SPACING = { cairn: WAY_MARKS.dirt.every, paving: WAY_MARKS.stone.every, pole: WAY_MARKS.snow.every, basalt: WAY_MARKS.ash.every, withy: WAY_MARKS.marsh.every };

// Where a way climbs: the terrain's own passes when it reports them (block terrain), else
// sustained steep runs found along the way's samples.
export function climbsAlong(world, way, samples) {
  if (Array.isArray(world.terrain.passes)) {
    return world.terrain.passes.filter(p => p.way === way.id).map(p => {
      const n = Math.max(2, Math.ceil(Math.hypot(p.bx - p.ax, p.bz - p.az) / 0.6));
      const ux = (p.bx - p.ax) / n, uz = (p.bz - p.az) / n, l = Math.hypot(ux, uz) || 1;
      return { way: way.id, width: Math.max(1.6, (p.width ?? way.width) - 2), points: Array.from({ length: n + 1 }, (_, i) => ({ x: p.ax + ux * i, z: p.az + uz * i, nx: -uz / l, nz: ux / l })) };
    });
  }
  const h = samples.map(p => world.terrain.heightAt(p.x, p.z));
  const out = [];
  let start = -1;
  for (let i = 1; i <= samples.length; i++) {
    const steep = i < samples.length && Math.abs(h[i] - h[i - 1]) / Math.max(0.01, samples[i].distance - samples[i - 1].distance) >= STEP_GRADE;
    if (steep && start < 0) start = i - 1;
    if (!steep && start >= 0) {
      if (samples[i - 1].distance - samples[start].distance >= STEP_SPAN) {
        // run uphill: reverse a descending run so the flight is built bottom to top
        const run = samples.slice(start, i);
        out.push({ way: way.id, width: Math.max(1.6, way.width - 0.6), points: h[i - 1] < h[start] ? run.reverse() : run });
      }
      start = -1;
    }
  }
  return out;
}

// ------------------------------------------------------------------ the marks themselves
function cairn(k, x, y, z, rng) {
  k.rock(x, y + 0.15, z, 1.3, 0.55, 1.1, 'stone2', { ry: rng() * 3 });
  let top = y + 0.32;
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.95 - i * 0.14;
    const h = 0.2 + rng() * 0.08;
    k.slab(x + (rng() - 0.5) * 0.12, top, z + (rng() - 0.5) * 0.12, s, h, s * (0.75 + rng() * 0.2), i === n - 1 ? 'edge' : i % 2 ? 'stone' : 'stone2', { ry: rng() * 3, rz: (rng() - 0.5) * 0.1 });
    top += h - 0.02;
  }
  return top - y;
}
function pole(k, x, y, z, rng) {
  const lean = (rng() - 0.5) * 0.12;
  k.slab(x, y - 0.3, z, 0.16, 3.3, 0.16, 'dark', { rz: lean, rx: (rng() - 0.5) * 0.08 });
  k.slab(x + 0.12, y + 2.55, z, 0.05, 0.75, 0.32, '#8e3a2c', { rz: lean + 0.12, ry: rng() * 3 });
  k.rock(x, y + 0.12, z, 0.9, 0.4, 0.8, 'stone2', { ry: rng() * 3 });
  return 3;
}
function basalt(k, x, y, z, rng) {
  let top = y;
  for (const [r, h] of [[0.55, 0.7], [0.45, 0.6], [0.34, 0.5]]) {
    k.prism(x + (rng() - 0.5) * 0.15, top, z + (rng() - 0.5) * 0.15, r, h, top === y ? 'stone2' : 'stone', { sides: 6, ry: rng() * 3 });
    top += h - 0.04;
  }
  k.slab(x + 0.2, top - 0.5, z, 0.04, 0.55, 0.26, 'cloth', { rz: 0.15 });
  return top - y;
}
function withy(k, x, y, z, rng) {
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    k.slab(x + Math.cos(a) * 0.18, y - 0.4, z + Math.sin(a) * 0.18, 0.07, 2 + rng() * 0.5, 0.07, '#7c6a49', { rz: Math.cos(a) * 0.14, rx: Math.sin(a) * 0.14 });
  }
  k.slab(x, y + 1.05, z, 0.32, 0.12, 0.32, '#9a8a5a', { ry: rng() * 3 });
  return 2.1;
}
function waystone(k, x, y, z, rng, yaw) {
  k.slab(x, y - 0.3, z, 0.62, 1.45, 0.42, 'stone', { ry: yaw, rz: (rng() - 0.5) * 0.12 });
  k.slab(x, y + 1.1, z, 0.72, 0.16, 0.52, 'edge', { ry: yaw });
  if (rng() < 0.6) k.slab(x, y + 0.2, z, 0.66, 0.35, 0.46, 'moss', { ry: yaw });
  return 1.3;
}
// A milestone of the Compact's road survey: a dressed post on a footing, banded where the
// distance was cut, capped against the rain.
function milestone(k, x, y, z, rng, yaw) {
  k.slab(x, y - 0.4, z, 0.9, 0.55, 0.7, 'stone2', { ry: yaw });
  k.slab(x, y + 0.15, z, 0.5, 1.15, 0.38, 'stone', { ry: yaw });
  k.slab(x, y + 0.75, z, 0.54, 0.16, 0.42, 'edge', { ry: yaw });
  k.pyramid(x, y + 1.3, z, 0.38, 0.32, 'stone', { sides: 4, ry: yaw + Math.PI / 4 });
  if (rng() < 0.4) k.slab(x, y + 0.15, z, 0.54, 0.22, 0.42, 'moss', { ry: yaw });
  return 1.6;
}
// A wayshrine: a roofed niche where travellers leave a light for the road ahead.
function wayshrine(k, x, y, z, rng, yaw) {
  k.slab(x, y - 0.5, z, 2.2, 0.8, 1.8, 'stone2', { ry: yaw });
  k.slab(x, y + 0.3, z, 1.6, 0.25, 1.3, 'edge', { ry: yaw });
  k.at({ x, y: 0, z, ry: yaw }, (kk) => {
    for (const sx of [-1, 1]) kk.slab(sx * 0.62, y + 0.55, -0.3, 0.26, 1.9, 0.26, 'stone', {});
    kk.slab(0, y + 0.55, -0.48, 1.2, 1.9, 0.18, 'stone', {});
    kk.roof('gable', 0, y + 2.45, -0.2, 1.7, 1.5, 0.8, { c: 'roof', overhang: 0.25, ry: Math.PI / 2 });
    kk.slab(0, y + 0.55, -0.2, 0.7, 0.18, 0.5, 'edge', {});
    kk.glowPanel(0, y + 0.95, -0.2, 0.22, 0.32, 0.22, 'glow', 1.5);
  });
  return 3.2;
}
function lanternPost(k, x, y, z) {
  k.lantern(x, y, z, { post: 2.4 });
  return 2.8;
}
// A broken run of the Compact's cut-stone paving, laid along the way and sunk unevenly.
function paving(k, world, samples, i, rng) {
  const n = 4 + Math.floor(rng() * 6);
  for (let j = 0; j < n && i + j * 2 < samples.length; j++) {
    const p = samples[i + j * 2];
    const yaw = Math.atan2(p.nz, -p.nx);
    for (const u of [-0.7, 0.7]) {
      if (rng() < 0.3) continue;
      const x = p.x + p.nx * (u + (rng() - 0.5) * 0.2), z = p.z + p.nz * (u + (rng() - 0.5) * 0.2);
      const y = world.terrain.heightAt(x, z);
      k.slab(x, y - 0.12, z, 1.25, 0.2, 1.15, rng() < 0.25 ? 'moss' : rng() < 0.5 ? 'stone2' : 'stone', { ry: yaw + (rng() - 0.5) * 0.15, rx: (rng() - 0.5) * 0.08, rz: (rng() - 0.5) * 0.08 });
    }
  }
}
// Where a way climbs: a cordonata, the old road-builders' ramp. The road keeps its graded
// surface; a low stone rib crosses it every couple of metres so feet and hooves find
// purchase, and a kerb runs up both sides. In the fen the climb is laid in timber instead.
// One tread colour, one kerb colour: a road you walk up, not a stripe of planks.
function flight(k, world, climb, rng, exclusions) {
  const pts = climb.points;
  const wood = climb.mark === 'withy';
  const w = climb.width;
  let since = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    if (run < 0.2) continue;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    const h = world.terrain.heightAt(x, z);
    since += run;
    // kerbs along both edges, seated in the ground
    for (const side of [-1, 1]) {
      const kx = x + a.nx * side * (w / 2 + 0.2), kz = z + a.nz * side * (w / 2 + 0.2);
      k.slab(kx, world.terrain.heightAt(kx, kz) - 0.3, kz, 0.42, 0.62, run + 0.12, wood ? '#6a5236' : 'stone2', { ry: yaw });
    }
    if (since >= 1.8) {
      since = 0;
      k.slab(x, h - 0.2, z, w + 0.1, 0.32, 0.3, wood ? '#5a4630' : 'stone', { ry: yaw });
    }
    if (i % 3 === 0) exclusions.push({ x, z, r: w / 2 + 0.8 });
  }
}
const BUILD = { cairn, pole, basalt, withy };

export function buildWayfinding(world, exclusions, add) {
  const ways = allWays();
  const sampled = ways.map(w => samplePath(w));
  const cues = [];
  const climbs = [];
  // Every lane sample on a coarse grid: forks, and keeping marks off other lanes.
  const grid = new Map();
  const key = (x, z) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
  sampled.forEach((samples, wi) => samples.forEach(p => {
    const kk = key(p.x, p.z);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push({ p, wi });
  }));
  const lanesNear = (x, z, r) => {
    const out = [];
    for (let ix = Math.floor((x - r) / 8); ix <= Math.floor((x + r) / 8); ix++) for (let iz = Math.floor((z - r) / 8); iz <= Math.floor((z + r) / 8); iz++) {
      for (const e of grid.get(`${ix},${iz}`) || []) if (Math.hypot(e.p.x - x, e.p.z - z) < r + e.p.width / 2) out.push(e);
    }
    return out;
  };
  const cueNear = (x, z, r) => cues.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < r * r);

  // A dry, level, unbuilt spot beside the lane (side +1 is the sample's normal).
  const beside = (p, side, extra = 1.7) => {
    const off = p.width / 2 + extra;
    const x = p.x + p.nx * side * off, z = p.z + p.nz * side * off;
    const y = world.terrain.heightAt(x, z);
    if (y < 0.9) return null;
    let lo = y, hi = y;
    for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) {
      const h = world.terrain.heightAt(x + dx, z + dz);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (hi - lo > 0.7) return null;
    if (world.colliders.query(x, z, 1.3).some(c => c.y1 > y + 0.2 && c.y0 < y + 2.5)) return null;
    if (lanesNear(x, z, 0.6).length) return null;
    return { x, z, y: lo };
  };

  ways.forEach((way, wi) => {
    const samples = sampled[wi];
    if (samples.length < 2) return;
    const rng = seededRandom(9001 + wi * 131);
    const family = familyFor(islandAtPoint(samples[0].x, samples[0].z)?.island.id, samples[0].x);
    const k = new Kit(family, { detail: 1 });
    let side = rng() < 0.5 ? -1 : 1;
    let since = 0;

    const place = (p, reason, mark, sideHint = 0, extra = 1.7) => {
      for (const s of sideHint ? [sideHint, -sideHint] : [side, -side]) {
        const spot = beside(p, s, extra);
        if (!spot) continue;
        const yaw = Math.atan2(p.nz, -p.nx);
        const h = mark === 'lantern' ? lanternPost(k, spot.x, spot.y, spot.z) : mark === 'waystone' ? waystone(k, spot.x, spot.y, spot.z, rng, yaw)
          : mark === 'milestone' ? milestone(k, spot.x, spot.y, spot.z, rng, yaw) : mark === 'wayshrine' ? wayshrine(k, spot.x, spot.y, spot.z, rng, yaw) : BUILD[mark](k, spot.x, spot.y, spot.z, rng);
        if (mark === 'wayshrine') world.addLight?.(new THREE.Vector3(spot.x, spot.y + 1, spot.z), '#ffc98a', 1.2, 9, true, 0.6);
        if (['cairn', 'basalt', 'waystone', 'milestone', 'wayshrine'].includes(mark)) world.colliders.addCyl({ x: spot.x, z: spot.z, r: mark === 'wayshrine' ? 1.1 : 0.55, y0: spot.y - 0.3, y1: spot.y + h, climbable: true, tag: 'waymark' });
        exclusions.push({ x: spot.x, z: spot.z, r: 1.6 });
        cues.push({ x: spot.x, z: spot.z, y: spot.y, mark, reason, way: way.id });
        side = -s;
        since = 0;
        return true;
      }
      return false;
    };
    // what stands at a decision point: the Compact's roads keep milestones there
    const decision = (p) => { const m = markAt(way, p.x, p.z); return m === 'paving' ? 'waystone' : m; };

    // forks: this way's ends where another way passes, out in the open
    for (const end of [0, samples.length - 1]) {
      const p = samples[end];
      if (settlementWeight(p.x, p.z) > 0.2) continue;
      if (!lanesNear(p.x, p.z, 4).some(e => e.wi !== wi)) continue;
      if (cueNear(p.x, p.z, 14)) continue;
      const q = samples[end ? end - 4 : 4] || p;
      if (!place({ ...q, nx: q.nx, nz: q.nz }, 'fork', way.regional ? 'wayshrine' : decision(p), 0, 2.6)) place({ ...q, nx: q.nx, nz: q.nz }, 'fork', decision(p));
    }

    // a wayshrine halfway along every long road, set back on the open side
    if (way.regional && samples.at(-1).distance > 250) {
      const midI = Math.floor(samples.length / 2);
      for (let k2 = 0; k2 < 30; k2++) {
        const p = samples[Math.min(samples.length - 1, midI + k2)];
        if (settlementWeight(p.x, p.z) > 0.2 || cueNear(p.x, p.z, 12)) continue;
        if (place(p, 'midway', 'wayshrine', 0, 2.6)) break;
      }
    }
    // kerbstones in short runs, so the road's edge reads among the grass
    if (way.regional && way.kind !== 'snow') for (let i = 6; i < samples.length - 6; i += 23) {
      if (settlementWeight(samples[i].x, samples[i].z) > 0.3) continue;
      for (let j = 0; j < 5 && i + j < samples.length; j++) {
        const p = samples[i + j];
        for (const sd of [-1, 1]) {
          const x = p.x + p.nx * sd * (p.width / 2 + 0.15), z = p.z + p.nz * sd * (p.width / 2 + 0.15);
          if (rng() < 0.18) continue;
          k.slab(x, world.terrain.heightAt(x, z) - 0.2, z, 0.34, 0.42, 1.1, way.kind === 'ash' ? 'stone2' : 'stone', { ry: Math.atan2(p.nz, -p.nx) + Math.PI / 2 + (rng() - 0.5) * 0.08 });
        }
      }
    }
    let milesince = 0;
    let prevS = settlementWeight(samples[0].x, samples[0].z);
    for (let i = 1; i < samples.length; i++) {
      const p = samples[i];
      since += p.distance - samples[i - 1].distance;
      const s = settlementWeight(p.x, p.z);
      // the edge of town: a lantern (or the country's own mark) where the lane runs out
      if ((prevS >= 0.25) !== (s >= 0.25) && !cueNear(p.x, p.z, 16)) {
        const m = markAt(way, p.x, p.z);
        place(p, 'threshold', m === 'cairn' || m === 'paving' ? 'lantern' : m);
      }
      prevS = s;
      if (s > 0.2) { since = 0; milesince = 0; continue; }
      // a milestone every furlong and a half of the regional roads
      milesince += p.distance - samples[i - 1].distance;
      if (way.regional && milesince > 180 && !cueNear(p.x, p.z, 20) && place(p, 'milestone', 'milestone')) { milesince = 0; continue; }
      // a bend you could miss: mark its outside
      if (i >= 8 && i + 8 < samples.length) {
        const t0 = samples[i - 8], t1 = samples[i + 8];
        const a0 = Math.atan2(t0.nz, -t0.nx), a1 = Math.atan2(t1.nz, -t1.nx);
        let turn = a1 - a0;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        if (Math.abs(turn) > 0.6 && !cueNear(p.x, p.z, 30) && place(p, 'bend', decision(p), turn > 0 ? -1 : 1)) continue;
      }
      // a long stretch with nothing to say people came this way
      const m = markAt(way, p.x, p.z);
      if (since >= SPACING[m] && !cueNear(p.x, p.z, SPACING[m] * 0.45)) {
        if (m === 'paving') {
          paving(k, world, samples, i, rng);
          cues.push({ x: p.x, z: p.z, y: world.terrain.heightAt(p.x, p.z), mark: 'paving', reason: 'stretch', way: way.id });
          since = 0;
        } else place(p, 'stretch', m);
      }
    }

    for (const climb of climbsAlong(world, way, samples)) {
      const mid = climb.points[Math.floor(climb.points.length / 2)];
      climb.mark = markAt(way, mid.x, mid.z);
      if (settlementWeight(mid.x, mid.z) > 0.6) continue; // town lanes already have their own stairs
      flight(k, world, climb, rng, exclusions);
      climbs.push(climb);
    }
    if (k.tris) add(k.build(`Waymarks — ${way.name || way.id}`));
  });
  world.wayCues = cues;
  world.wayClimbs = climbs;
  return { cues, climbs };
}
