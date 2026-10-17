// Island terrain: procedural heightfields, low-poly meshes and exact height
// sampling that matches the rendered triangles.
import * as THREE from 'three';
import { Noise2D } from '../core/noise.js';
import { ISLANDS, SEA_FLOOR, islandDist } from '../data/world.js';
import { samplePath } from './paths.js';
import { islandBounds } from '../data/coastlines.js';
import { ROADS } from '../data/roads.js';
import { smoothstep, lerp, clamp } from '../core/util.js';
import { shelfDistance } from './shelfOutline.js';
import { LANDFORM_PROFILES, DEFAULT_LANDFORM } from '../data/landforms.js';
import { BIOME_COLORS } from './biomeGround.js';
import { initBlocks, initPasses, blockHeight, buildBlocks, sampleBlocks } from './landforms.js';
import { LANDFORMS } from '../data/landforms.js';
import { CLIFF_STRATA, CLIFF_FOOT, CLIFF_LIP, cliffEdge, contourCell, triangleHeight } from './cliffContours.js';

export { BIOME_COLORS };

// Relief per biome: base fbm, ridged noise and fine detail combined into extra height.
function biomeRelief(biome, maxH, base, ridge, detail, d) {
  switch (biome) {
    case 'marsh':
      return maxH * base * 0.9;
    case 'volcanic': {
      const cone = Math.pow(smoothstep(0.92, 0.1, d), 1.35);
      return maxH * cone * (0.85 + 0.15 * base) + ridge * 7 * smoothstep(0.9, 0.5, d);
    }
    case 'snow':
    case 'tundra':
      return maxH * (0.3 * base + 0.7 * ridge);
    case 'jungle':
      return maxH * 1.5 * (0.45 * base + 0.55 * ridge * ridge) + detail * 0.3;
    case 'highland':
      // broad shoulders rather than spikes: the terraces carve them into shelves
      return maxH * (0.5 * base + 0.5 * ridge) + detail * 0.4;
    case 'farmland':
      return maxH * 0.5 * base;
    case 'dunes':
      // long swells with a little chop: blowouts and hollows behind the strand
      return maxH * (0.7 * base + 0.3 * ridge) + detail * 0.8;
    case 'hush':
      // rolling moor broken by tall headlands
      return maxH * 1.3 * (0.5 * base + 0.5 * ridge * ridge);
    case 'rift':
      return maxH * (0.4 * base + 0.6 * ridge * ridge);
    default:
      return maxH * (0.55 * base + 0.45 * ridge);
  }
}

// Terrace step (m) per biome: the land rises in flat shelves with steep stone risers, the
// stacked-cliff look of the old Anchorage uplands. 0 = natural slopes (beaches, marsh).
const TERRACE = Object.fromEntries(Object.entries(LANDFORM_PROFILES).map(([biome, p]) => [biome, p.shelf]));

function terraced(h, step, warp) {
  if (!step) return h;
  const q = (h + warp * step) / step;
  const k = Math.floor(q);
  const f = q - k;
  return (k + smoothstep(0.92, 1.0, f)) * step - warp * step;
}

// Nearest point on a polyline [[x, z, ...], ...]: distance, arc length along it, and the
// cumulative lengths (`cum`) must be precomputed by the caller.
function polyNearest(pts, cum, x, z) {
  let best = Infinity, bs = 0;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0], az = pts[i - 1][1];
    const dx = pts[i][0] - ax, dz = pts[i][1] - az;
    const L = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1);
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) {
      best = d;
      bs = cum[i - 1] + t * (cum[i] - cum[i - 1]);
    }
  }
  return { d: best, s: bs };
}

function polyLengths(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

// Normalised distance from a pad's centre: < 1 inside its shape, `core` and below dead level.
// Shapes: circle (r), ellipse (rx, rz), rect (w, d, box metric); `yaw` turns ellipse and rect.
function padEdge(p, x, z) {
  let dx = x - p.x, dz = z - p.z;
  if (p.yaw) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
  }
  if (p.shape === 'rect') return Math.max(Math.abs(dx) / (p.w / 2), Math.abs(dz) / (p.d / 2));
  if (p.rx) return Math.hypot(dx / p.rx, dz / p.rz);
  return Math.hypot(dx, dz) / p.r;
}

// Roads painted onto the ground (see data/roads.js), cut to the segments near this island.
function roadSegments(x0, z0, x1, z1) {
  const out = [];
  for (const r of ROADS) {
    const points = samplePath(r, 5);
    for (let i = 1; i < points.length; i++) {
      const { x: ax, z: az, height: ah } = points[i - 1];
      const { x: bx, z: bz, height: bh } = points[i];
      const pad = r.width + 12;
      if (Math.max(ax, bx) < x0 - pad || Math.min(ax, bx) > x1 + pad || Math.max(az, bz) < z0 - pad || Math.min(az, bz) > z1 + pad) continue;
      out.push({ ax, az, bx, bz, ah, bh, w: r.width, kind: r.kind || 'dirt' });
    }
  }
  return out;
}

class Island {
  constructor(def) {
    Object.assign(this, def);
    this.def = def;
    this.noise = new Noise2D(def.seed);
    // bounding box of every lobe, with room for the shelf beyond the coast
    let x0 = def.cx - def.radius * 1.42, x1 = def.cx + def.radius * 1.42;
    let z0 = def.cz - def.radius * 1.42, z1 = def.cz + def.radius * 1.42;
    for (const l of def.lobes || []) {
      x0 = Math.min(x0, l.x - l.r * 1.3);
      x1 = Math.max(x1, l.x + l.r * 1.3);
      z0 = Math.min(z0, l.z - l.r * 1.3);
      z1 = Math.max(z1, l.z + l.r * 1.3);
    }
    if (def.outline) ({ x0, z0, x1, z1 } = islandBounds(def, 100));
    this.x0 = x0;
    this.z0 = z0;
    this.sizeX = x1 - x0;
    this.sizeZ = z1 - z0;
    this.half = Math.max(this.sizeX, this.sizeZ) / 2;
    // ~3m cells, coarser only for the very largest landmasses (vertex budget per island,
    // `maxCells` where a continent has been given more)
    let cell = def.res || 3.0;
    while ((this.sizeX / cell) * (this.sizeZ / cell) > (def.maxCells ?? 150000)) cell += 0.25;
    this.nx = Math.max(48, Math.round(this.sizeX / cell));
    this.nz = Math.max(48, Math.round(this.sizeZ / cell));
    this.cellX = this.sizeX / this.nx;
    this.cellZ = this.sizeZ / this.nz;
    this.n = Math.max(this.nx, this.nz);
    this.cell = (this.cellX + this.cellZ) / 2;
    this.voidLike = def.biome === 'rift';
    this.voidFloor = this.voidLike ? -260 : SEA_FLOOR;
    this.coastAmp = def.coastAmp ?? 0.16;
    this.roads = this.voidLike ? [] : roadSegments(x0, z0, x1, z1);
    this.roadCells = new Map();
    for (const segment of this.roads) {
      const pad = segment.w / 2 + 12;
      for (let ix = Math.floor((Math.min(segment.ax, segment.bx) - pad) / 32); ix <= Math.floor((Math.max(segment.ax, segment.bx) + pad) / 32); ix++) {
        for (let iz = Math.floor((Math.min(segment.az, segment.bz) - pad) / 32); iz <= Math.floor((Math.max(segment.az, segment.bz) + pad) / 32); iz++) {
          const key = `${ix},${iz}`;
          if (!this.roadCells.has(key)) this.roadCells.set(key, []);
          this.roadCells.get(key).push(segment);
        }
      }
    }
    // The surface isles stand on block terrain: broad shelves and sheer walls (landforms.js).
    this.blocks = !this.voidLike && def.blocks !== false;
    if (this.blocks) {
      this.landforms = def.landforms ?? LANDFORMS[def.id] ?? [];
      initBlocks(this);
    }
    // flats with h: 'auto' settle at the natural ground height of their center
    for (const f of this.flats || []) if (f.h === 'auto' || f.h == null) {
      // on block terrain a place takes its shelf's level; its way is cut to meet it
      const road = this.blocks ? { d: Infinity } : this.roadAt(f.x, f.z);
      f.h = Math.max(1.4, road.d < (f.r || 0) * 0.8 ? road.height : this.heightRaw(f.x, f.z, true));
    }
    if (this.blocks) initPasses(this);
    if (def.pads || def.ways || def.chasms) this._layout(def);
  }

  // Contract ground for the Rift (data/riftLayout.js), opt-in through the island def:
  //   pads   level ground at an exact height ('auto' = the natural ground at the centre);
  //          `cliff` keeps the whole shape level and drops sheer at its edge, otherwise the
  //          pad is dead level inside `core` and blends out to its rim.
  //   ways   graded walking corridors: they follow the ground, pinned where a point has a
  //          height, with the grade held under `maxGrade`.
  //   chasms polylines of open void `width` across, with sheer lips.
  _layout(def) {
    this.padList = [];
    for (const p of def.pads || []) {
      const q = { ...p };
      if (q.h === 'auto' || q.h == null) q.h = Math.max(1.4, this.heightRaw(q.x, q.z, true));
      // the level ground runs one mesh cell past `core` so the rendered triangles are level
      // there too; the blend then needs a few metres to meet the ground
      const rMin = q.shape === 'rect' ? Math.min(q.w, q.d) / 2 : q.rx ? Math.min(q.rx, q.rz) : q.r;
      q.e0 = (q.core ?? 0.6) + (this.cell * 1.1) / rMin;
      q.e1 = Math.max(1, q.e0 + 4 / rMin);
      q.rMin = rMin;
      this.padList.push(q);
    }
    this.chasmList = (def.chasms || []).map((c) => ({ ...c, cum: polyLengths(c.points), half: c.width / 2 }));
    this.wayList = [];
    for (const w of def.ways || []) this.wayList.push(this._wayProfile(w));
    // `levelled`: groups of pads that stand at one height, the mean of their own or the height
    // of the way between them. A pad moved off its ground blends back over a wider skirt.
    for (const g of def.levelled || []) {
      const ps = g.pads.map((id) => this.padList.find((p) => p.id === id)).filter(Boolean);
      if (!ps.length) continue;
      const mean = ps.reduce((a, p) => a + p.h, 0) / ps.length;
      let h = Number.isFinite(g.h) ? g.h : mean;
      if (g.h === 'way') {
        const way = this.wayAt(ps.reduce((a, p) => a + p.x, 0) / ps.length, ps.reduce((a, p) => a + p.z, 0) / ps.length);
        if (way) h = way.h;
      }
      for (const p of ps) {
        p.e1 = Math.max(p.e1, p.e0 + Math.max(4, 1.6 * Math.abs(h - p.h)) / p.rMin);
        p.h = h;
      }
    }
  }

  // Height profile of one walking route at 1 m steps.
  _wayProfile(w) {
    const pts = w.points;
    const cum = polyLengths(pts);
    const L = cum[cum.length - 1];
    const n = Math.max(2, Math.ceil(L));
    const ds = L / n;
    const ground = new Float64Array(n + 1);
    const pinned = new Array(n + 1).fill(null);
    let seg = 1;
    for (let k = 0; k <= n; k++) {
      const s = k * ds;
      while (seg < pts.length - 1 && cum[seg] < s) seg++;
      const t = (s - cum[seg - 1]) / (cum[seg] - cum[seg - 1] || 1);
      const x = lerp(pts[seg - 1][0], pts[seg][0], t), z = lerp(pts[seg - 1][1], pts[seg][1], t);
      ground[k] = this.heightRaw(x, z);
      // where the route crosses a pad's level ground it keeps the pad's height
      for (const p of this.padList) if (padEdge(p, x, z) < (p.cliff ? 1 : p.e0)) pinned[k] = p.h;
    }
    pts.forEach((p, i) => {
      const k = Math.round(cum[i] / ds);
      if (Number.isFinite(p[2])) pinned[k] = p[2];
      // a leg pinned at both ends is a straight ramp between them
      const q = pts[i - 1];
      if (q && Number.isFinite(p[2]) && Number.isFinite(q[2])) {
        const k0 = Math.round(cum[i - 1] / ds);
        for (let j = k0; j <= k; j++) pinned[j] = lerp(q[2], p[2], (j - k0) / (k - k0 || 1));
      }
    });
    if (pinned[0] == null) pinned[0] = ground[0];
    if (pinned[n] == null) pinned[n] = ground[n];
    // follow a smoothed ground, then hold the grade between neighbours and pins
    const G = w.maxGrade ?? 0.3;
    const win = w.smooth ?? 8;
    const prof = new Float64Array(n + 1);
    for (let k = 0; k <= n; k++) {
      if (pinned[k] != null) { prof[k] = pinned[k]; continue; }
      let sum = 0, cnt = 0;
      for (let j = Math.max(0, k - win); j <= Math.min(n, k + win); j++) { sum += ground[j]; cnt++; }
      let v = sum / cnt;
      for (let j = 0; j <= n; j++) if (pinned[j] != null) v = clamp(v, pinned[j] - G * ds * Math.abs(j - k), pinned[j] + G * ds * Math.abs(j - k));
      prof[k] = v;
    }
    for (let pass = 0; pass < 50; pass++) {
      let moved = false;
      for (let k = 1; k <= n; k++) {
        if (pinned[k] != null) continue;
        const v = clamp(prof[k], prof[k - 1] - G * ds, prof[k - 1] + G * ds);
        if (v !== prof[k]) { prof[k] = v; moved = true; }
      }
      for (let k = n - 1; k >= 0; k--) {
        if (pinned[k] != null) continue;
        const v = clamp(prof[k], prof[k + 1] - G * ds, prof[k + 1] + G * ds);
        if (v !== prof[k]) { prof[k] = v; moved = true; }
      }
      if (!moved) break;
    }
    return { ...w, cum, ds, n, prof, half: w.width / 2 + (w.margin ?? 1.6), shoulder: w.shoulder ?? 6 };
  }

  // Graded route height at (x, z): { w: blend weight, h } or null when off every route.
  wayAt(x, z) {
    let best = null;
    for (const w of this.wayList || []) {
      const { d, s } = polyNearest(w.points, w.cum, x, z);
      if (d >= w.half + w.shoulder) continue;
      const wt = smoothstep(w.half + w.shoulder, w.half, d);
      if (best && best.w >= wt) continue;
      const f = clamp(s / w.ds, 0, w.n);
      const k = Math.min(w.n - 1, Math.floor(f));
      best = { w: wt, h: lerp(w.prof[k], w.prof[k + 1], f - k), d, id: w.id };
    }
    return best;
  }

  // Distance to the nearest chasm's centreline less its half-width (< 0 inside the void).
  // `taper` (m) narrows a fissure to a point over that length at each end.
  chasmAt(x, z) {
    let best = Infinity;
    for (const c of this.chasmList || []) {
      const { d: dc, s } = polyNearest(c.points, c.cum, x, z);
      let half = c.half;
      if (c.taper) half *= Math.sqrt(clamp(Math.min(s, c.cum[c.cum.length - 1] - s) / c.taper, 0, 1));
      const d = dc - half;
      if (d < best) best = d;
    }
    return best;
  }

  _layoutHeight(x, z, h) {
    const pads = this.padList || [];
    for (const p of pads) {
      if (p.cliff) continue;
      const e = padEdge(p, x, z);
      if (e < p.e1) h = lerp(h, p.h, smoothstep(p.e1, p.e0, e));
    }
    const way = this.wayAt(x, z);
    if (way) h = lerp(h, way.h, way.w);
    for (const p of pads) if (p.cliff && padEdge(p, x, z) < 1) h = p.h;
    if (this.chasmAt(x, z) < 0) h = this.voidFloor;
    return h;
  }

  // Blend weights of sub-region zones at (x, z).
  // Sink lakes warp their radius with noise so the shore reads as a tarn, not a compass circle.
  zoneWeights(x, z) {
    const zones = this.zones;
    if (!zones) return null;
    let out = null;
    const n = this.noise;
    for (const zn of zones) {
      const lx = x - zn.x, lz = z - zn.z;
      let t;
      if (zn.sink) {
        const ang = Math.atan2(lz, lx);
        const wob = 0.2 * n.fbm(Math.cos(ang) * 2.4 + zn.x * 0.011, Math.sin(ang) * 2.4 + zn.z * 0.011, 2)
          + 0.12 * n.noise(x * 0.038 + 9, z * 0.038 - 4)
          + 0.08 * Math.sin(ang * 3.0 + zn.x * 0.02);
        const aspect = zn.aspect ?? 1.18;
        const rx = (zn.rx ?? zn.r * aspect), rz = (zn.rz ?? zn.r / aspect);
        t = Math.hypot(lx / rx, lz / rz) / (1 + wob);
      } else {
        t = Math.hypot(lx, lz) / zn.r;
      }
      if (t >= 1) continue;
      (out ||= []).push([zn, smoothstep(1, zn.sink ? 0.7 : 0.55, t)]);
    }
    return out;
  }

  heightRaw(x, z, noFlats = false, terraceStep = 0) {
    if (this.blocks) return blockHeight(this, x, z, noFlats);
    const n = this.noise;
    const coast = n.fbm(x * 0.007 + 100, z * 0.007 - 50, 3);
    const d = islandDist(this, x, z) / (1 + this.coastAmp * coast);
    if (d > 1.32) return this.voidFloor;

    const profile = LANDFORM_PROFILES[this.biome] || DEFAULT_LANDFORM;
    const scale = Math.min(profile.scale, this.radius * 1.8);
    // Two broad octaves make districts of high ground, instead of dozens of knolls.
    const base = 0.5 + 0.5 * n.fbm(x / scale, z / scale, 2);
    const ridge = n.ridged(x / (scale * 1.3) + 33, z / (scale * 1.3) - 71, 2);
    const detail = n.noise(x * 0.06, z * 0.06);
    const maxH = this.maxH;
    let extra = biomeRelief(this.biome, maxH, base, ridge, detail, d);
    let sink = 0;
    let sinkDepth = 3.2;
    const zw = this.zoneWeights(x, z);
    if (zw) {
      for (const [zn, w] of zw) {
        if (zn.sink) {
          if (w > sink) {
            sink = w;
            sinkDepth = zn.depth ?? 3.2;
          }
          continue;
        }
        const ze = biomeRelief(zn.biome, maxH, base, ridge, detail, d) * (zn.h ?? 1);
        extra = lerp(extra, ze, w);
      }
    }

    let h;
    const inner = smoothstep(0.84, 0.3, d);
    if (this.voidLike) {
      h = 1.5 + extra * smoothstep(0.95, 0.35, d) + detail * 0.5;
      // `rim`: the floor climbs into broken crags toward its edge, then breaks off sheer.
      const rim = this.rim;
      if (rim) h += rim.h * smoothstep(rim.from, rim.to, d) * (rim.base + (1 - rim.base) * ridge);
      const [d0, d1] = rim?.drop ?? [0.9, 1.05];
      if (d > d0) h = lerp(h, this.voidFloor, smoothstep(d0, d1, d));
    } else if (d < 0.84) {
      h = 1.1 + extra * inner + detail * 0.35;
    } else if (d < 0.94) {
      h = lerp(1.1 + detail * 0.35, -1.6, (d - 0.84) / 0.1);
    } else {
      h = lerp(-1.6, this.voidFloor, smoothstep(0.94, 1.3, d));
    }

    if ((this.biome === 'marsh' || zw?.some(([zone, weight]) => zone.biome === 'marsh' && weight > 0.5)) && d < 0.86) {
      const p = n.noise(x * 0.022 + 9, z * 0.022 - 4);
      if (p > 0.2) h = Math.max(-1.3, h - (p - 0.2) * 7);
    }
    // terraces: shelves and risers, faded out toward the shoreline
    {
      const warp = n.noise(x / (scale * 1.6) + 41, z / (scale * 1.6) - 17) * 0.06;
      if (terraceStep) return h / terraceStep + warp;
      let ht = terraced(h, this.terrace ?? TERRACE[this.biome] ?? 5, warp);
      if (zw) for (const [zn, w] of zw) if (!zn.sink) ht = lerp(ht, terraced(h, zn.terrace ?? TERRACE[zn.biome] ?? 5, warp), w);
      // the lowest shelf is a beach, never seabed: terraces must not drown the shoreline
      ht = Math.max(ht, Math.min(h, 1.5));
      h = lerp(h, ht, smoothstep(1.6, 4.5, h));
    }
    // lakes: zones with `sink` drop the ground below the waterline (`depth` makes a wadeable mere)
    if (sink > 0) h = lerp(h, -sinkDepth + detail * 0.4, sink);

    // Narrow transitions between broad shelves make exposed cliff faces, while
    // the terrain mesh remains the source of truth for movement and collision.
    for (const cliff of this.escarpments || []) {
      // Large staggered strata. Unequal offsets and a slowly varying outline
      // produce shoulders and recesses, rather than concentric pyramid slopes.
      let shelves = 0;
      for (const stratum of CLIFF_STRATA) shelves += smoothstep(CLIFF_FOOT, CLIFF_LIP, cliffEdge(n, cliff, stratum, x, z)) * stratum.rise;
      h += cliff.h * shelves;
    }

    // Smooth elliptical rises (the Arches' Foot hill, etc.): full height at the centre,
    // zero at the rim. `sharp` > 1 flattens the crown and steepens the skirts.
    for (const rise of this.rises || []) {
      let dx = x - rise.x, dz = z - rise.z;
      if (rise.rot) [dx, dz] = [dx * Math.cos(rise.rot) + dz * Math.sin(rise.rot), -dx * Math.sin(rise.rot) + dz * Math.cos(rise.rot)];
      const edge = Math.hypot(dx / rise.rx, dz / rise.rz);
      if (edge >= 1) continue;
      const t = 1 - edge * edge;
      h += rise.h * t ** (rise.sharp ?? 1.25);
    }

    // Carve a generous shoulder so the road is walkable across its full width.
    const route = this.roadAt(x, z);
    if (route.d < 12) h = lerp(h, route.height, smoothstep(12, 2, route.d));
    if (noFlats) return h;
    // flats: `core` is the fraction of the radius that stays perfectly level (terraces use ~0.85)
    for (const f of this.flats || []) {
      const fd = f.rx ? Math.max(Math.abs(x - f.x) / f.rx, (f.front ? z - f.z : Math.abs(z - f.z)) / f.rz)
        : Math.hypot(x - f.x, z - f.z) / f.r;
      if (f.outline) {
        if (Math.abs(x - f.x) <= f.rx + 1 && Math.abs(z - f.z) <= f.rz + 1) {
          // Strategic bastions reserve a cliff crown while their authored road
          // profiles cut a continuous, graded arrival into that crown.
          const target = f.roadCuts && route.d < 12 ? lerp(f.h, route.height, smoothstep(12, 2, route.d)) : f.h;
          h = lerp(h, target, smoothstep(-0.35, 0.35, shelfDistance(f.outline, x, z)));
        }
        continue;
      }
      if (fd < 1) {
        let w = smoothstep(1, f.core ?? 0.55, fd);
        if (f.front) {
          let edge = f.front[0][1];
          for (let i = 1; i < f.front.length; i++) {
            const [ax, az] = f.front[i - 1], [bx, bz] = f.front[i];
            edge = lerp(az, bz, clamp((x - ax) / (bx - ax), 0, 1));
            if (x <= bx) break;
          }
          w *= smoothstep(edge, edge + f.cliffWidth, z);
        }
        h = lerp(h, f.h, w);
      }
    }
    // Authored streets cut the shelf edges, including their full walking width.
    for (const r of this.ramps || []) {
      const dx = r.x2 - r.x, dz = r.z2 - r.z, len = Math.hypot(dx, dz);
      const t = Math.max(0, Math.min(1, ((x - r.x) * dx + (z - r.z) * dz) / (len * len)));
      const d = Math.hypot(x - r.x - dx * t, z - r.z - dz * t);
      const shoulder = r.shoulder ?? 4;
      if (d < r.w / 2 + shoulder) h = lerp(h, lerp(r.y, r.y2, t), smoothstep(r.w / 2 + shoulder, r.w / 2, d));
    }
    if (this.padList) h = this._layoutHeight(x, z, h);
    return h;
  }

  build() {
    if (this.blocks) return buildBlocks(this);
    this.surfaceCells = new Map();
    const NX = this.nx;
    const NZ = this.nz;
    const VX = NX + 1;
    const VZ = NZ + 1;
    const heights = new Float32Array(VX * VZ);
    for (let j = 0; j < VZ; j++) {
      for (let i = 0; i < VX; i++) {
        heights[j * VX + i] = this.heightRaw(this.x0 + i * this.cellX, this.z0 + j * this.cellZ);
      }
    }
    if (this.parentGrid) {
      // The fine boundary must meet the coarse triangles exactly, not resample a
      // curved edge at different frequencies and leave a seam in the land.
      for (let j = 0; j < VZ; j++) for (let i = 0; i < VX; i++) {
        if (i === 0 || j === 0 || i === NX || j === NZ) heights[j * VX + i] = this.parentGrid.sample(this.x0 + i * this.cellX, this.z0 + j * this.cellZ);
      }
    }
    this.heights = heights;
    this.V = VX;
    // Refine authored cliff districts locally; the rest of a continent keeps its
    // ordinary grid. Mesh and movement both sample these same smaller triangles.
    this.patches = [];
    for (const spec of this.detailPatches || []) {
      const patch = Object.create(this);
      const ix = Math.ceil((spec.x - this.x0) / this.cellX), iz = Math.ceil((spec.z - this.z0) / this.cellZ);
      const nx = Math.floor((spec.x2 - this.x0) / this.cellX) - ix;
      const nz = Math.floor((spec.z2 - this.z0) / this.cellZ) - iz;
      Object.assign(patch, { x0: this.x0 + ix * this.cellX, z0: this.z0 + iz * this.cellZ,
        nx: nx * spec.subdivisions, nz: nz * spec.subdivisions,
        sizeX: nx * this.cellX, sizeZ: nz * this.cellZ,
        cellX: this.cellX / spec.subdivisions, cellZ: this.cellZ / spec.subdivisions,
        cell: this.cell / spec.subdivisions, detailPatches: [], patches: [], parentGrid: this });
      patch.build();
      this.patches.push(patch);
    }
    this.mesh = this._mesh();
    for (const patch of this.patches) this.mesh.add(patch.mesh);
  }

  contains(x, z) {
    return x >= this.x0 && z >= this.z0 && x < this.x0 + this.sizeX && z < this.z0 + this.sizeZ;
  }

  shoreWeight(x, z) {
    const coast = this.noise.fbm(x * 0.007 + 100, z * 0.007 - 50, 3);
    const distance = islandDist(this, x, z) / (1 + this.coastAmp * coast);
    return smoothstep(0.77, 0.85, distance);
  }

  sample(x, z) {
    if (this.blocks) return sampleBlocks(this, x, z);
    const patches = this.patches; // (no empty array made per sample when there are none)
    if (patches) for (const patch of patches) if (patch.contains(x, z)) return patch.sample(x, z);
    const fx = (x - this.x0) / this.cellX;
    const fz = (z - this.z0) / this.cellZ;
    let i = Math.floor(fx);
    let j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return this.voidFloor;
    const surface = this.surfaceCells?.get(j * this.nx + i);
    if (surface) {
      const height = triangleHeight(surface, x, z);
      if (height !== null) return height;
    }
    const u = fx - i;
    const v = fz - j;
    const V = this.V;
    const H = this.heights;
    const ha = H[j * V + i];
    const hb = H[(j + 1) * V + i];
    const hc = H[(j + 1) * V + i + 1];
    const hd = H[j * V + i + 1];
    if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
    return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  }

  // distance to the nearest painted road and its kind
  roadAt(x, z) {
    let best = Infinity;
    let kind = null;
    let width = 0, height = 0;
    for (const s of this.roadCells.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) || []) {
      const dx = s.bx - s.ax;
      const dz = s.bz - s.az;
      const L = dx * dx + dz * dz || 1;
      const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L, 0, 1);
      const d = Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) - s.w / 2;
      if (d < best) {
        best = d;
        kind = s.kind;
        width = s.w;
        height = lerp(s.ah, s.bh, t);
      }
    }
    return { d: best, kind, width, height };
  }

  _mesh() {
    const outlinedShelves = (this.flats || []).filter(f => f.outline);
    const VX = this.nx + 1;
    const VZ = this.nz + 1;
    const NX = this.nx;
    const NZ = this.nz;
    const H = this.heights;
    const pos = new Float32Array(VX * VZ * 3);
    const col = new Float32Array(VX * VZ * 3);
    const palette = (b) => {
      const pal = BIOME_COLORS[b] || BIOME_COLORS.meadow;
      const C = {};
      for (const k in pal) C[k] = new THREE.Color(pal[k]);
      return C;
    };
    const C = palette(this.biome);
    const zonePal = {};
    for (const zn of this.zones || []) zonePal[zn.biome] ||= palette(zn.biome);
    const tmp = new THREE.Color();
    const ztmp = new THREE.Color();
    const n = this.noise;
    const veinColor = new THREE.Color('#8a5adf');
    const lavaVein = new THREE.Color('#a8401a');
    const roadCol = { dirt: new THREE.Color('#8a7556'), stone: new THREE.Color('#8b8a82'), snow: new THREE.Color('#b8bcc0'), ash: new THREE.Color('#3a3330') };
    const cellAvg = this.cell;
    const pave = new THREE.Color();
    const paveDark = new THREE.Color('#77756c');
    const dry = new THREE.Color('#b8a060');
    const lush = new THREE.Color('#4a8a38');
    const wetSand = new THREE.Color('#d4c890');
    const heath = new THREE.Color('#7f7559');

    // ground color for one palette, mirroring the original biome rules
    const shade = (out, P, biome, h, slope, mix, x, z) => {
      const snowLine = biome === 'snow' ? 6 : biome === 'tundra' ? 18 : this.maxH * 0.72 + 4;
      const volcanic = biome === 'volcanic' || biome === 'ashfield';
      // Fen water is dark peat even where it is only knee-deep, so the pools read as water.
      const peat = biome === 'marsh' && h < -0.25;
      if (h < -0.9 || peat) {
        out.copy(P.under).lerp(P.sand, smoothstep(-6, -1, h) * (peat ? 0.12 : 0.5));
      } else if (h < 1.9 && (biome === 'beach' || biome === 'dunes') && slope < 0.9) {
        out.copy(P.sand);
        if (biome === 'marsh') out.lerp(P.grass2, 0.35);
      } else if (slope > 0.95) {
        out.copy(P.rock);
      } else {
        out.copy(P.grass).lerp(P.grass2, mix);
        if (biome === 'farmland') {
          // patchwork fields: alternating crop strips
          const strip = Math.sin(x * 0.11 + Math.sin(z * 0.013) * 3) * Math.sin(z * 0.09);
          if (strip > 0.35) out.lerp(P.grass2, 0.7);
          else if (strip < -0.45) out.lerp(new THREE.Color('#7d8a46'), 0.5);
        }
        if (slope > 0.6) out.lerp(P.rock, smoothstep(0.6, 0.95, slope));
        if (h > snowLine && !volcanic) out.lerp(P.high, smoothstep(snowLine, snowLine + 8, h));
        if (volcanic && h > this.maxH * 0.55) out.lerp(P.high, 0.6);
        if (volcanic) {
          const crack = n.noise(x * 0.09 - 3, z * 0.09 + 11);
          if (crack > 0.74) out.lerp(lavaVein, smoothstep(0.74, 0.86, crack) * 0.55);
        }
        if (!volcanic && biome !== 'marsh' && biome !== 'snow' && biome !== 'tundra') {
          const patch = n.noise(x * 0.045 + 12, z * 0.045 - 8);
          if (patch > 0.62) out.lerp(lush, smoothstep(0.62, 0.82, patch) * 0.45);
          else if (patch < -0.55) out.lerp(dry, smoothstep(-0.55, -0.78, patch) * 0.4);
          const golden = Math.sin(x * 0.07 + z * 0.05) * Math.sin(z * 0.06 - x * 0.04);
          if (golden > 0.55 && (biome === 'meadow' || biome === 'farmland' || biome === 'beach' || biome === 'dunes')) {
            out.lerp(dry, smoothstep(0.55, 0.85, golden) * 0.35);
          }
        }
        if (biome === 'dunes') {
          // Wind scours sand out of the crests; heath and thrift hold the hollows.
          const blow = n.noise(x * 0.05 + 3, z * 0.05 - 7);
          if (blow > 0.42) out.lerp(P.sand, smoothstep(0.42, 0.72, blow) * 0.65);
          const hollow = n.noise(x * 0.07 - 11, z * 0.07 + 5);
          if (hollow > 0.48) out.lerp(heath, smoothstep(0.48, 0.8, hollow) * 0.45);
        }
        if ((biome === 'beach' || biome === 'meadow' || biome === 'dunes') && h < 2.2 && slope < 0.55) {
          const wet = n.noise(x * 0.11, z * 0.11);
          if (wet > 0.35) out.lerp(wetSand, smoothstep(0.35, 0.7, wet) * 0.55);
        }
      }
      // Sand follows the coast, not every low inland shelf. A small rise on the
      // foreshore must not paint a grass stripe between two strips of beach.
      if (!volcanic && biome !== 'marsh' && biome !== 'snow' && biome !== 'tundra' && h >= -0.9 && h < 4.5 && slope < 0.9) {
        out.lerp(P.sand, this.shoreWeight(x, z));
      }
      return out;
    };

    for (let j = 0; j < VZ; j++) {
      for (let i = 0; i < VX; i++) {
        const idx = j * VX + i;
        const x = this.x0 + i * this.cellX;
        const z = this.z0 + j * this.cellZ;
        const h = H[idx];
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = h;
        pos[idx * 3 + 2] = z;
        const hl = H[j * VX + Math.max(0, i - 1)];
        const hr = H[j * VX + Math.min(VX - 1, i + 1)];
        const hu = H[Math.max(0, j - 1) * VX + i];
        const hd = H[Math.min(VZ - 1, j + 1) * VX + i];
        const slope = Math.hypot(hr - hl, hd - hu) / (2 * cellAvg);
        const mix = 0.5 + 0.5 * n.noise(x * 0.03, z * 0.03) + 0.18 * (n.noise(x * 0.11, z * 0.09) - 0.5);

        if (this.voidLike) {
          if (slope > 0.9) tmp.copy(C.rock);
          else tmp.copy(C.grass).lerp(C.grass2, mix);
          if (h > 14) tmp.lerp(C.high, smoothstep(14, 24, h));
          const vein = n.noise(x * 0.08 + 5, z * 0.08);
          if (vein > 0.8) tmp.lerp(veinColor, 0.35);
        } else {
          shade(tmp, C, this.biome, h, slope, mix, x, z);
          const zw = this.zones && this.zoneWeights(x, z);
          if (zw) for (const [zn, w] of zw) if (!zn.sink) tmp.lerp(shade(ztmp, zonePal[zn.biome], zn.biome, h, slope, mix, x, z), w);
          if (this.paved && h > 0.6 && slope < 0.6) {
            for (const pv of this.paved) {
              const pd = Math.hypot(x - pv.x, z - pv.z);
              if (pd > pv.r + 1) continue;
              // cut-stone flags: alternating tones in a staggered grid
              const gx = Math.floor((x - pv.x) / 2.2 + (Math.floor((z - pv.z) / 2.2) % 2) * 0.5);
              const gz = Math.floor((z - pv.z) / 2.2);
              const tone = ((gx * 7 + gz * 13) & 3) / 3;
              pave.set(pv.color || '#a9a79c').lerp(paveDark, tone * 0.35);
              tmp.lerp(pave, smoothstep(pv.r + 1, pv.r - 1, pd) * 0.92);
            }
          }
          if (this.roads.length && h > 0.6) {
            const r = this.roadAt(x, z);
            if (r.d < 1.2) {
              const rc = roadCol[r.kind] || roadCol.dirt;
              tmp.lerp(rc, smoothstep(1.2, -0.6, r.d) * (slope > 0.9 ? 0.4 : 0.85));
            } else if (r.d < 4.5 && r.kind) {
              tmp.lerp(roadCol.dirt, smoothstep(4.5, 1.4, r.d) * 0.35);
            }
          }
        }
        const jit = 0.94 + 0.12 * Math.abs(n.noise(x * 0.4, z * 0.4));
        col[idx * 3] = tmp.r * jit;
        col[idx * 3 + 1] = tmp.g * jit;
        col[idx * 3 + 2] = tmp.b * jit;
      }
    }

    const index = [], extraPos = [], extraCol = [];
    // Cache lattice values; only new contour crossings need additional noise samples.
    const terraceSteps = new Set([this.terrace ?? TERRACE[this.biome] ?? 5,
      ...(this.zones || []).filter(z => !z.sink).map(z => z.terrace ?? TERRACE[z.biome] ?? 5)]);
    const terraceFields = [...terraceSteps].filter(step => step > 0).map(step => {
      const values = new Float64Array(VX * VZ);
      for (let j = 0; j < VZ; j++) for (let i = 0; i < VX; i++) values[j * VX + i] = this.heightRaw(this.x0 + i * this.cellX, this.z0 + j * this.cellZ, true, step);
      return (x, z) => {
        const fx = (x - this.x0) / this.cellX, fz = (z - this.z0) / this.cellZ;
        const i = Math.round(fx), j = Math.round(fz);
        if (Math.abs(fx - i) < 1e-8 && Math.abs(fz - j) < 1e-8) return values[j * VX + i];
        return this.heightRaw(x, z, true, step);
      };
    });
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const cx = this.x0 + (i + 0.5) * this.cellX, cz = this.z0 + (j + 0.5) * this.cellZ;
        if (this.patches.some(p => p.contains(cx, cz))) continue;
        const a = j * VX + i;
        const b = (j + 1) * VX + i;
        const c = (j + 1) * VX + i + 1;
        const d = j * VX + i + 1;
        // Keep the existing coarse/fine patch seam intact. All other cliff cells
        // gain vertices at the rock lip and foot instead of sharp diagonal folds.
        const patchEdge = (this.parentGrid && (i === 0 || j === 0 || i === NX - 1 || j === NZ - 1))
          || this.patches.some(p => cx > p.x0 - this.cellX && cx < p.x0 + p.sizeX + this.cellX
            && cz > p.z0 - this.cellZ && cz < p.z0 + p.sizeZ + this.cellZ);
        const polygons = !patchEdge && contourCell(this.x0 + i * this.cellX, this.z0 + j * this.cellZ,
          this.cellX, this.cellZ, this.escarpments || [], n, terraceFields, outlinedShelves);
        if (!polygons) { index.push(a, b, d, b, c, d); continue; }
        const surface = [];
        for (const polygon of polygons) {
          const points = polygon.map(([x, z]) => [Math.fround(x), Math.fround(this.heightRaw(x, z)), Math.fround(z)]);
          for (let t = 1; t < points.length - 1; t++) {
            const tri = [points[0], points[t], points[t + 1]];
            const ab = new THREE.Vector3().subVectors(new THREE.Vector3(...tri[1]), new THREE.Vector3(...tri[0]));
            const ac = new THREE.Vector3().subVectors(new THREE.Vector3(...tri[2]), new THREE.Vector3(...tri[0]));
            const normal = ab.cross(ac);
            if (Math.abs(normal.y) < 1e-8) continue;
            const rock = Math.hypot(normal.x, normal.z) > Math.abs(normal.y) * 1.3;
            surface.push(tri);
            for (const p of tri) {
              index.push(pos.length / 3 + extraPos.length / 3);
              extraPos.push(...p);
              if (rock) {
                const zone = this.zoneWeights(p[0], p[2])?.find(([, w]) => w > 0.5);
                const rockColor = zone ? zonePal[zone[0].biome].rock : C.rock;
                extraCol.push(rockColor.r, rockColor.g, rockColor.b);
              } else {
                const u = clamp((p[0] - this.x0) / this.cellX - i, 0, 1);
                const v = clamp((p[2] - this.z0) / this.cellZ - j, 0, 1);
                for (let channel = 0; channel < 3; channel++) extraCol.push(lerp(lerp(col[a * 3 + channel], col[d * 3 + channel], u), lerp(col[b * 3 + channel], col[c * 3 + channel], u), v));
              }
            }
          }
        }
        this.surfaceCells.set(j * NX + i, surface);
      }
    }
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(pos.length + extraPos.length); positions.set(pos); positions.set(extraPos, pos.length);
    const colors = new Float32Array(col.length + extraCol.length); colors.set(col); colors.set(extraCol, col.length);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'terrain_' + this.id;
    return mesh;
  }
}

export class Terrain {
  constructor() {
    this.islands = ISLANDS.map((d) => new Island(d));
    this.byId = Object.fromEntries(this.islands.map((i) => [i.id, i]));
  }

  build(scene) {
    for (const isl of this.islands) {
      isl.build();
      if (scene) scene.add(isl.mesh);
    }
    if (scene) {
      const g = new THREE.PlaneGeometry(7000, 7000, 1, 1);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#8a7d5c', roughness: 1 }));
      m.position.set(40, SEA_FLOOR - 0.05, 330);
      m.receiveShadow = false;
      scene.add(m);
      this.seabed = m;
    }
  }

  // Where ways climb a shelf through a cut ramp: [{ way, x, z, yaw, from, to, width, len,
  // ax, az (foot), bx, bz (top) }] (world/landforms.js initPasses).
  get passes() {
    return this.islands.flatMap(isl => isl.passes || []);
  }

  islandAt(x, z) {
    for (const isl of this.islands) if (isl.contains(x, z)) return isl;
    return null;
  }

  heightAt(x, z) {
    let best = -Infinity;
    for (const isl of this.islands) {
      if (isl.contains(x, z)) {
        const h = isl.sample(x, z);
        if (h > best) best = h;
      }
    }
    if (best === -Infinity) return x > 3000 ? -260 : SEA_FLOOR;
    return best;
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.6;
    const hl = this.heightAt(x - e, z);
    const hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e);
    const hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  // Normalized distance from the nearest island's landmass (lobes and bays included).
  islandFactor(x, z) {
    let best = Infinity;
    let isl = null;
    for (const i of this.islands) {
      if (i.cx > 3000 !== x > 3000) continue;
      const d = islandDist(i, x, z);
      if (d < best) {
        best = d;
        isl = i;
      }
    }
    if (!isl) isl = this.islands[0];
    return { d: best, island: isl };
  }

  raycast(origin, dir, maxDist = 200, step = 0.5) {
    const p = origin.clone();
    let prevAbove = p.y - this.heightAt(p.x, p.z);
    for (let t = step; t <= maxDist; t += step) {
      p.copy(origin).addScaledVector(dir, t);
      const above = p.y - this.heightAt(p.x, p.z);
      if (above <= 0) {
        // refine
        const tt = t - step * (above / (above - prevAbove));
        return { dist: tt, point: origin.clone().addScaledVector(dir, tt) };
      }
      prevAbove = above;
    }
    return null;
  }
}
