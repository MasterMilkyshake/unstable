import * as THREE from 'three';
import { PALETTES } from './style.js';
import { Kit } from './kit.js';
import { Mason } from './mason.js';

// Short masonry bays follow the ground. Sample both faces and embed the footing
// below the lowest sample, so a wall cannot float over a cross-slope.
export function buildCurtain(world, chain, { palette = 'salt', height = 10, topY = null, tag = 'town_wall', name = 'Curtain wall' } = {}, exclusions = []) {
  const roots = [];
  for (let i = 1; i < chain.length; i++) {
    const [ax, az] = chain[i - 1], [bx, bz] = chain[i];
    const length = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax);
    const count = Math.ceil(length / 6), span = length / count;
    const g = new THREE.Group(); g.name = name;
    g.position.set(ax, 0, az); g.rotation.y = yaw;
    const colors = PALETTES[palette];
    const k = new Kit({ ...colors, edge: colors.edge || colors.stone }), bays = [];
    const point = (x, z) => [ax + Math.cos(yaw) * x + Math.sin(yaw) * z, az - Math.sin(yaw) * x + Math.cos(yaw) * z];
    const solid = (x, y, z, w, h, d) => {
      const [wx, wz] = point(x, z);
      world.colliders.addBox({ x: wx, z: wz, w, d, y0: y, y1: y + h, rot: yaw, tag });
    };
    for (let j = 0; j < count; j++) {
      const x = (j + 0.5) * span, grounds = [];
      // the bay's whole footprint: a sheer shelf edge can fall away under its last few centimetres
      for (const dx of [-span / 2 - 0.25, 0, span / 2 + 0.25]) for (const z of [-2.5, 0, 2.5]) grounds.push(world.terrain.heightAt(...point(x + dx, z)));
      const bottom = Math.min(...grounds) - 2;
      const top = topY ?? Math.ceil((Math.max(...grounds) + height) / 2) * 2;
      k.masonry(x, bottom, 0, span + 0.3, top - bottom, 3.8);
      solid(x, bottom, 0, span + 0.3, top - bottom, 3.8);
      k.slab(x, top, 0, span + 0.4, 0.35, 4.5, 'edge');
      solid(x, top, 0, span + 0.4, 0.35, 4.5);
      for (const side of [-1, 1]) {
        k.slab(x, top + 0.35, side * 1.85, span + 0.3, 0.65, 0.7, 'stone2');
        solid(x, top + 0.35, side * 1.85, span + 0.3, 0.65, 0.7);
        for (const dx of [-span / 3, span / 3]) {
          k.slab(x + dx, top + 1, side * 1.85, 1.35, 1.2, 0.8, 'stone2');
          solid(x + dx, top + 1, side * 1.85, 1.35, 1.2, 0.8);
        }
      }
      // Buttresses mask the masonry joints and carry each change of wall-walk height.
      k.slab(x - span / 2, bottom, 0, 1.1, top - bottom, 5, 'stone2');
      const [wx, wz] = point(x, 0); exclusions.push({ x: wx, z: wz, r: span / 2 + 4 });
      bays.push({ x: wx, z: wz, top: top + 0.35, bottom });
    }
    // End piers close angled joins and tie the curtain into gate jambs.
    for (const [x, bay] of [[0, bays[0]], [length, bays.at(-1)]]) {
      const ground = [];
      for (const dx of [-2.4, 0, 2.4]) for (const dz of [-2.4, 0, 2.4]) ground.push(world.terrain.heightAt(...point(x + dx, dz)));
      const bottom = Math.min(bay.bottom, ...ground) - 1;
      k.slab(x, bottom, 0, 4.8, bay.top - bottom, 4.8, 'stone2');
      solid(x, bottom, 0, 4.8, bay.top - bottom, 4.8);
      k.slab(x, bay.top, 0, 5.1, 0.4, 5.1, 'edge');
    }
    g.add(k.build(name));
    const middle = bays[Math.floor(bays.length / 2)];
    (world.fortifications ||= []).push({ ax, az, bx, bz, top: middle.top, bays, group: g });
    roots.push(g);
  }
  return roots;
}

// A gate is a deep, closed masonry gatehouse with an open vaulted passage.
// Its jambs overlap the curtain endpoints, rather than leaving a freestanding arch.
export function buildPostern(world, x, z, yaw, topY = null) {
  const g = new THREE.Group(); g.name = x > 500 ? 'Meridian postern' : 'Saltreach postern';
  const base = world.terrain.heightAt(x, z); g.position.set(x, base, z); g.rotation.y = yaw;
  const p = x > 500 ? PALETTES.enclave : PALETTES.salt;
  const k = new Kit({ ...PALETTES.ancient, stone: p.stone2, stone2: p.stone2, edge: p.stone });
  const at = (lx, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz];
  const solid = (lx, y0, lz, w, h, d) => {
    const [wx, wz] = at(lx, lz);
    world.colliders.addBox({ x: wx, z: wz, w, d, y0: base + y0, y1: base + y0 + h, rot: yaw, tag: 'postern' });
  };
  // Pick the roof height from adjacent wall walks so the joins close on sloping sites.
  const adjacent = (world.fortifications || []).flatMap(w => w.bays || []).filter(b => Math.hypot(b.x - x, b.z - z) < 19);
  const roof = Math.max(14, ...adjacent.map(b => b.top - base));
  const radius = 9, offset = 3, spring = 6, trim = 0.8;
  const crown = spring + Math.sqrt(radius * radius - offset * offset);
  // An authored level curtain shares its coping and battlement datum with the gate.
  const top = topY === null ? Math.max(roof, crown + 1.2) : Math.max(topY - base, crown + 1.2);
  const inner = [], outer = [];
  // Shared vertices meet at the apex: no rotated boxes or rectangular infill
  // approximating the arch, which left triangular cracks and visible overlaps.
  for (const [r, points] of [[radius, inner], [radius + trim, outer]]) {
    const end = Math.acos(-offset / r), half = 16;
    for (let i = 0; i <= half; i++) {
      const angle = Math.PI + (end - Math.PI) * i / half;
      points.push([i === half ? 0 : offset + r * Math.cos(angle), spring + r * Math.sin(angle)]);
    }
    for (let i = half - 1; i >= 0; i--) points.push([-points[i][0], points[i][1]]);
  }
  const grounds = [];
  for (const lx of [-12, -9, -6, 6, 9, 12]) for (const lz of [-4, 0, 4]) grounds.push(world.terrain.heightAt(...at(lx, lz)) - base);
  const bottom = Math.min(...grounds) - 2;
  const extrude = (points, depth, color) => {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    for (const p of points.slice(1)) shape.lineTo(...p);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    geometry.translate(0, 0, -depth / 2);
    k.emit(geometry.attributes.position.array, new THREE.Matrix4(), color, { grad: 0, jitter: 0 });
    geometry.dispose();
  };
  // One closed wall volume with the entire pointed opening cut out of it.
  extrude([[-12, bottom], [-6, bottom], ...inner, [6, bottom], [12, bottom], [12, top], [-12, top]], 8, 'stone');
  // Precisely adjoining voussoirs sit slightly proud of both faces and the vault.
  for (let i = 0; i < inner.length - 1; i++) {
    extrude([inner[i], inner[i + 1], outer[i + 1], outer[i]], 8.24, i % 2 ? 'edge' : p.plaster2);
  }
  for (const side of [-1, 1]) {
    k.slab(side * 6.4, bottom, 0, trim, spring - bottom, 8.24, 'edge', { grad: 0, jitter: 0 });
    solid(side * 9, bottom, 0, 6, top - bottom, 8);
    for (const face of [-1, 1]) k.lantern(side * 7.5, 3.4, face * 4.4, { post: 0 });
  }
  // Mortar is surface detail on the solid wall, not recesses between separate slabs.
  for (let yy = 0.9, row = 0; yy < top - 0.1; yy += 1.2, row++) {
    const edge = yy < spring ? 6 + trim : Math.max(0, Math.sqrt(Math.max(0, (radius + trim) ** 2 - (yy - spring) ** 2)) - offset);
    for (const face of [-1, 1]) for (const side of [-1, 1]) {
      const width = 12 - edge;
      k.slab(side * (12 + edge) / 2, yy, face * 4.012, width, 0.025, 0.018, '#8e8c83', { grad: 0, jitter: 0 });
      for (let xx = 1.5 + (row % 2) * 1.5; xx < 11.8; xx += 3) {
        const low = yy - 1.15;
        const lowEdge = low < spring ? 6 + trim : Math.max(0, Math.sqrt(Math.max(0, (radius + trim) ** 2 - (low - spring) ** 2)) - offset);
        if (xx < lowEdge + 0.08) continue;
        k.slab(side * xx, low, face * 4.012, 0.025, 1.15, 0.018, '#8e8c83', { grad: 0, jitter: 0 });
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const xx = -5.5 + i;
    const soffit = spring + Math.sqrt(radius * radius - (offset + Math.abs(xx)) ** 2);
    solid(xx, soffit, 0, 1, top - soffit, 8);
  }
  const coping = topY === null ? 0.5 : 0.35, parapet = topY === null ? 0.75 : 0.65;
  k.slab(0, top, 0, 25, coping, 8.8, 'edge'); solid(0, top, 0, 25, coping, 8.8);
  for (const face of [-1, 1]) {
    k.slab(0, top + coping, face * 4, 25, parapet, 0.7, 'stone2');
    solid(0, top + coping, face * 4, 25, parapet, 0.7);
    for (let xx = -11; xx <= 11; xx += 2.75) {
      k.slab(xx, top + coping + parapet, face * 4, 1.3, 1.2, 0.8, 'stone2');
      solid(xx, top + coping + parapet, face * 4, 1.3, 1.2, 0.8);
    }
  }
  g.add(k.build('postern_gatehouse')); return g;
}

// ============================================================== ramparts
// A ring of curtain between towers. Every chain vertex stands a tower; the spans butt a
// metre into its masonry, so a bend is a tower and never a leaning buttress or a wedge gap.
// The wall walk stands `rise` (8-11 m) above the town-side ground and steps with it: where
// the ground climbs, the walk climbs in 0.3 m steps, never steeper than a stair.
//
// ring: { id, name, palette, tag, rise, t, center: [x, z], tower: { R, roof: 'cone'|'flat' },
//         chains: [{ points, start: 'tower'|'abut', end: 'tower'|'abut', stairs: [metres] }] }
const STEP_RISE = 0.3, STEP_RUN = 0.45;

function towerRadius(ring) { return ring.tower?.R ?? 4.6; }
function inradius(ring) { return towerRadius(ring) * Math.cos(Math.PI / 8); }

// Town-side ground along a span, sampled at walk-step spacing.
function spanProfile(world, ax, az, bx, bz, inner, t) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  const nx = -uz * inner, nz = ux * inner;
  const n = Math.max(2, Math.ceil(L / STEP_RUN));
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * L / n, x = ax + ux * s, z = az + uz * s;
    const g = Math.max(world.terrain.heightAt(x, z), world.terrain.heightAt(x + nx * (t / 2 + 0.6), z + nz * (t / 2 + 0.6)));
    out.push({ s, x, z, g });
  }
  return { L, n, ux, uz, nx, nz, samples: out };
}

const quant = (y) => Math.ceil(y / STEP_RISE - 1e-6) * STEP_RISE;
function limitSteps(c) {
  for (let i = 1; i < c.length; i++) c[i] = Math.max(c[i], c[i - 1] - STEP_RISE);
  for (let i = c.length - 2; i >= 0; i--) c[i] = Math.max(c[i], c[i + 1] - STEP_RISE);
  return c;
}

export function buildRampart(world, ring, exclusions = []) {
  const roots = [];
  const tag = ring.tag || 'town_wall';
  const T = ring.t ?? 3.6, rise = ring.rise ?? 9.5;
  const pts = ring.chains.flatMap(c => c.points);
  const center = ring.center || [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  const ri = inradius(ring);
  world.fortifications ||= [];
  world.wallTowers ||= [];
  for (const chain of ring.chains) {
    const P = chain.points;
    // spans, trimmed back from the towers at their ends
    const spans = [];
    for (let i = 1; i < P.length; i++) {
      const [ax, az] = P[i - 1], [bx, bz] = P[i];
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      const towerA = i > 1 || chain.start === 'tower', towerB = i < P.length - 1 || chain.end === 'tower';
      const ta = towerA ? ri - 1 : 0, tb = towerB ? ri - 1 : 0;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const inner = ((center[0] - mx) * -uz + (center[1] - mz) * ux) >= 0 ? 1 : -1;
      const A = [ax + ux * ta, az + uz * ta], B = [bx - ux * tb, bz - uz * tb];
      const prof = spanProfile(world, A[0], A[1], B[0], B[1], inner, T);
      // where a span butts into a gatehouse or palace, the ground under that structure's own
      // footprint is not the wall's ground: take it from just outside
      const skipA = i === 1 && chain.start === 'abut' ? (chain.skip ?? 5.5) : 0;
      const skipB = i === P.length - 1 && chain.end === 'abut' ? (chain.skip ?? 5.5) : 0;
      const firstOk = prof.samples.find(q => q.s >= skipA), lastOk = [...prof.samples].reverse().find(q => q.s <= prof.L - skipB);
      if (firstOk && lastOk) for (const q of prof.samples) { if (q.s < skipA) q.g = firstOk.g; if (q.s > prof.L - skipB) q.g = lastOk.g; }
      const crest = limitSteps(prof.samples.map(p => quant(p.g + rise)));
      spans.push({ A, B, inner, prof, crest, towerA, towerB, ax, az, bx, bz });
    }
    // A tower's floor is the higher of the walks arriving at it. A walk within a storey of it
    // climbs to its door; one far below (a lower terrace) butts the tower's body instead, so
    // the curtain never ramps up a cliff to reach a tower standing on top of it.
    const floors = [], joins = [];
    for (let i = 0; i < P.length; i++) {
      const prev = spans[i - 1], next = spans[i];
      const isTower = (i > 0 && i < P.length - 1) || (i === 0 && chain.start === 'tower') || (i === P.length - 1 && chain.end === 'tower');
      if (!isTower) { floors.push(null); joins.push([false, false]); continue; }
      const a = prev ? prev.crest.at(-1) : -Infinity, b = next ? next.crest[0] : -Infinity;
      const f = Math.max(a, b);
      floors.push(f);
      joins.push([!!prev && a >= f - 2.4, !!next && b >= f - 2.4]);
    }
    spans.forEach((sp, i) => {
      if (floors[i] != null && joins[i][1]) sp.crest[0] = Math.max(sp.crest[0], floors[i]);
      if (floors[i + 1] != null && joins[i + 1][0]) sp.crest[sp.crest.length - 1] = Math.max(sp.crest.at(-1), floors[i + 1]);
      limitSteps(sp.crest);
      for (let k = 0; k < sp.crest.length; k++) sp.crest[k] = Math.round(sp.crest[k] / STEP_RISE) * STEP_RISE;
    });
    spans.forEach((sp) => roots.push(buildSpan(world, ring, sp, tag, T, exclusions)));
    for (let i = 0; i < P.length; i++) {
      if (floors[i] == null) continue;
      const heads = [];
      if (spans[i - 1] && joins[i][0]) heads.push(Math.atan2(spans[i - 1].ax - P[i][0], spans[i - 1].az - P[i][1]));
      if (spans[i] && joins[i][1]) heads.push(Math.atan2(spans[i].bx - P[i][0], spans[i].bz - P[i][1]));
      roots.push(buildWallTower(world, ring, P[i][0], P[i][1], floors[i], heads, tag, exclusions));
    }
    for (const u of chain.stairs || []) {
      const sp = spans[u.span ?? 0];
      if (sp) roots.push(buildWalkStair(world, ring, sp, u, tag, T));
    }
  }
  return roots;
}

function buildSpan(world, ring, sp, tag, T, exclusions) {
  const { A, B, prof, crest, inner } = sp;
  const L = prof.L, ry = Math.atan2(B[0] - A[0], B[1] - A[1]);
  const m = new Mason(world, { x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, yaw: ry, y: 0, palette: ring.palette, tag, name: ring.name || 'Curtain wall', lights: 0 });
  // local frame: z runs A -> B; +x side is `side` toward the town
  const side = inner > 0 ? -1 : 1; // local +x maps to world (cos ry, -sin ry); inner normal is (-uz, ux) * inner
  const xin = side * 1, xout = -side * 1;
  // group samples into bays of one crest, at most 6 m long
  const bays = [];
  let cur = null;
  prof.samples.forEach((p, i) => {
    const s0 = i * L / prof.n, s1 = (i + 1) * L / prof.n;
    if (cur && Math.abs(cur.c - crest[i]) < 1e-6 && s1 - cur.s0 <= 6.01) { cur.s1 = s1; cur.n++; }
    else { cur = { s0, s1, c: crest[i], n: 1 }; bays.push(cur); }
  });
  const record = [];
  for (const [bi, b] of bays.entries()) {
    const len = b.s1 - b.s0, zc = -L / 2 + (b.s0 + b.s1) / 2;
    const lo = Math.min(m.lowest(T + 0.6, len + 0.3, 0, zc), b.c - 1.5);
    const bottom = lo - 1.2;
    const ground = Math.max(m.ground(xin * (T / 2 + 0.5), zc), m.ground(0, zc));
    const stair = len < 1.5;
    // core to the walk, coursed; a projecting base course where it meets the ground
    m.k.masonry(0, bottom, zc, T, b.c - bottom, len, { c: 'stone', c2: 'stone2', course: 1.2 });
    m.solid(0, bottom, zc, T, b.c - bottom, len);
    m.trim(0, b.c - 0.06, zc, T - 1.2, 0.08, len, 'edge', { grad: 0 });
    m.trim(0, Math.max(bottom, lo - 0.3), zc, T + 0.5, 0.75, len + (stair ? 0 : 0.02), 'stone2');
    // outer parapet with merlons (plain where the walk is a stair), low inner breastwork
    const px = xout * (T / 2 - 0.3), ix = xin * (T / 2 - 0.22);
    m.block(px, b.c, zc, 0.6, 1.1, len, 'stone', { walkable: false });
    m.block(ix, b.c, zc, 0.45, 0.9, len, 'stone2', { walkable: false });
    m.trim(ix, b.c + 0.9, zc, 0.55, 0.1, len, 'edge');
    if (!stair && len > 2) {
      m.k.crenels(px, zc - len / 2 + 0.2, px, zc + len / 2 - 0.2, b.c + 1.1, 0.6, { c: 'stone', h: 1.0 });
      m.solid(px, b.c + 1.1, zc, 0.6, 1.0, len, { walkable: false });
      // a string course under the walk and an arrow loop in every other bay on the field face
      m.trim(xout * (T / 2 + 0.06), b.c - 1.6, zc, 0.14, 0.26, len, 'edge');
      if (bi % 2 === 0 && b.c - ground > 4) m.trim(xout * (T / 2 + 0.02), b.c - 4.2, zc, 0.06, 1.5, 0.28, 'dark', { grad: 0 });
    } else {
      m.trim(px, b.c + 1.1, zc, 0.7, 0.12, len, 'edge');
    }
    const [wx, wz] = m.f.at(0, zc);
    record.push({ x: wx, z: wz, top: b.c, bottom });
    exclusions.push({ x: wx, z: wz, r: Math.max(len, T) / 2 + 3.5 });
  }
  const mid = record[Math.floor(record.length / 2)] || { top: crest[0] };
  world.fortifications.push({ ax: sp.ax, az: sp.az, bx: sp.bx, bz: sp.bz, top: mid.top, bays: record, group: m.g, ring: ring.id });
  return m.build();
}

// A flight against the town face of a span, from the ground up to the walk.
function buildWalkStair(world, ring, sp, u, tag, T) {
  const { A, B, prof, crest, inner } = sp;
  const L = prof.L, ry = Math.atan2(B[0] - A[0], B[1] - A[1]);
  const m = new Mason(world, { x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, yaw: ry, y: 0, palette: ring.palette, tag, name: 'Wall-walk stair', lights: 0 });
  const side = inner > 0 ? -1 : 1, dir = u.dir ?? 1, w = 1.8;
  const x = side * (T / 2 + w / 2);
  const headS = u.at; // metres from A where the flight reaches the walk
  const i = Math.max(0, Math.min(crest.length - 1, Math.floor(headS / L * prof.n)));
  const top = crest[i];
  const foot = m.ground(x, -L / 2 + headS - dir * 20);
  const run = Math.ceil((top - foot) / STEP_RISE) * STEP_RUN;
  const z0 = -L / 2 + headS - dir * run;
  const g0 = m.ground(x, z0);
  m.stair(x, z0, dir > 0 ? 0 : Math.PI, w, g0, top, { run: STEP_RUN, c: 'stone2', nose: 'edge' });
  // the stair's open side carries a parapet that climbs with it
  const n = Math.ceil((top - g0) / STEP_RISE);
  for (let k = 0; k < n; k += 2) {
    const zz = z0 + dir * (k + 1) * STEP_RUN, yy = g0 + (top - g0) * (k + 1) / n;
    m.block(x + side * (w / 2 + 0.2), yy - 0.2, zz, 0.4, 1.2, STEP_RUN * 2, 'stone', { walkable: false });
  }
  return m.build();
}

// A drum tower where curtains meet: solid to the walk, a guard room the walk passes through,
// then a slate cone (the Compact) or a crenellated fighting top (the Enclave).
export function buildWallTower(world, ring, x, z, floor, heads, tag, exclusions = []) {
  const R = towerRadius(ring), ri = R * Math.cos(Math.PI / 8);
  const rot = heads.length ? heads[0] : 0;
  const m = new Mason(world, { x, z, yaw: 0, y: 0, palette: ring.palette, tag, name: `${ring.name || 'Curtain'} tower`, lights: 1 });
  const base = m.lowest(R * 2 + 1.5, R * 2 + 1.5) - 1.4;
  const roomH = 3.4;
  // battered foot, then coursed drum to the walk
  m.k.prism(0, base, 0, R + 0.7, 2.6, 'stone2', { sides: 8, ry: rot, top: (R + 0.05) / (R + 0.7) });
  let y = base + 2.6, i = 0;
  while (y < floor - 0.31) {
    const h = Math.min(1.2, floor - 0.3 - y);
    m.k.prism(0, y, 0, i % 2 ? R - 0.04 : R, h, i % 2 ? 'stone2' : 'stone', { sides: 8, ry: rot });
    y += h; i++;
  }
  m.k.prism(0, floor - 0.3, 0, R + 0.12, 0.3, 'edge', { sides: 8, ry: rot });
  m.pillar(0, base, 0, ri, floor - base);
  m.k.prism(0, floor - 0.04, 0, ri - 0.6, 0.06, 'floor', { sides: 8, ry: rot });
  // the guard room: eight faces, doors where the walks come in
  const door = Math.atan(1.25 / (ri - 0.35));
  const doors = heads.map(h => [h - door, h + door]);
  const inDoor = (a) => doors.some(([d0, d1]) => angleIn(a, d0, d1));
  for (let f = 0; f < 8; f++) {
    const fa = rot + f * Math.PI / 4;
    // walk the face from one corner to the other in small steps, keeping the solid runs
    const steps = 12, half = Math.PI / 8;
    let runStart = null;
    for (let s = 0; s <= steps; s++) {
      const a = fa - half + (2 * half) * s / steps;
      const solid = s < steps && !inDoor(a + half / steps);
      if (solid && runStart === null) runStart = a;
      if ((!solid || s === steps) && runStart !== null) {
        const a1 = solid ? a + (2 * half) / steps : a;
        roomWall(m, ri, fa, runStart, a1, floor, roomH, f, rot);
        runStart = null;
      }
    }
    // lintels over the doors on this face
    for (const [d0, d1] of doors) {
      const lo = Math.max(d0, fa - half), hi = Math.min(d1, fa + half);
      if (hi - lo > 0.01 && angleIn((lo + hi) / 2, fa - half, fa + half)) roomWall(m, ri, fa, lo, hi, floor + 2.8, roomH - 2.8, -1, rot);
    }
  }
  m.k.prism(0, floor + roomH, 0, R + 0.35, 0.45, 'edge', { sides: 8, ry: rot });
  m.pillar(0, floor + roomH, 0, R + 0.2, 0.45);
  // a lantern on its bracket by the door the walk comes in by, so the room is never a black hole
  const la = (heads[0] ?? 0) + Math.PI / 4, lr = ri - 1.1;
  m.trim(Math.sin(la) * (lr + 0.35), floor + 2.35, Math.cos(la) * (lr + 0.35), 0.12, 0.12, 0.7, 'metal', { ry: la, layer: 'metal' });
  m.lantern(Math.sin(la) * lr, floor + 1.75, Math.cos(la) * lr, { light: false });
  m.k.prism(0, floor + roomH - 0.25, 0, ri - 0.6, 0.25, 'ceiling', { sides: 8, ry: rot });
  m.light(0, floor + 2.2, 0, { intensity: 3, distance: 8, priority: 1.6 });
  if ((ring.tower?.roof ?? 'cone') === 'cone') {
    // the Compact's lantern band under a slate cone
    m.k.prism(0, floor + roomH + 0.45, 0, R - 0.3, 1.5, 'plaster', { sides: 8, ry: rot });
    for (let f = 0; f < 8; f++) {
      const a = rot + f * Math.PI / 4 + Math.PI / 8, r = (R - 0.3) * Math.cos(Math.PI / 8) + 0.02;
      if (f % 2 === 0) m.k.glowPanel(Math.sin(a) * r, floor + roomH + 1.2, Math.cos(a) * r, 0.9, 0.9, 0.06, 'glow', 1.1, { ry: a });
    }
    m.k.pyramid(0, floor + roomH + 1.85, 0, R + 1.0, 0.7, 'roof2', { sides: 8, ry: rot });
    m.k.prism(0, floor + roomH + 1.9, 0, R + 0.95, 1.0, 'roof', { sides: 8, ry: rot, top: (R - 0.2) / (R + 0.95) });
    m.k.pyramid(0, floor + roomH + 2.9, 0, R - 0.2, R * 1.25, 'roof', { sides: 8, ry: rot });
    m.k.prism(0, floor + roomH + 2.9 + R * 1.25 - 0.2, 0, 0.12, 1.4, 'metal', { sides: 4, layer: 'metal' });
  } else {
    // fighting top: merlons round the parapet, a signal staff
    const yy = floor + roomH + 0.45;
    m.k.prism(0, yy, 0, R + 0.3, 1.0, 'stone', { sides: 8, ry: rot });
    for (let f = 0; f < 16; f++) {
      if (f % 2) continue;
      const a = rot + f * Math.PI / 8, r = (R + 0.1) * Math.cos(Math.PI / 8);
      m.trim(Math.sin(a) * r, yy + 1.0, Math.cos(a) * r, 1.1, 0.9, 0.55, 'stone', { ry: a });
    }
    m.solid(0, yy, 0, R * 1.5, 1.9, R * 1.5, { walkable: false });
    m.trim(0, yy, 0, 0.18, 7, 0.18, 'metal', { layer: 'metal' });
    m.k.banner(0.5, yy + 4.2, 0, 1.6, 2.4, 'cloth', { ry: Math.PI / 2 });
  }
  (world.wallTowers ||= []).push({ x, z, floor, R, ring: ring.id });
  exclusions.push({ x, z, r: R + 3 });
  return m.build();
}

function angleIn(a, a0, a1) {
  const w = (v) => Math.atan2(Math.sin(v), Math.cos(v));
  const d = w(a - a0), span = w(a1 - a0);
  return span >= 0 ? d >= 0 && d <= span : d <= 0 && d >= span;
}

// One solid run of a guard-room face between two angles (measured like headings).
function roomWall(m, ri, fa, a0, a1, y, h, face, rot) {
  const t = 0.7, r = ri - t / 2;
  const s0 = r * Math.tan(a0 - fa), s1 = r * Math.tan(a1 - fa);
  const len = Math.abs(s1 - s0);
  if (len < 0.05 || h < 0.05) return;
  const sm = (s0 + s1) / 2;
  // the face's centre is at heading fa, distance r; along it runs perpendicular to fa
  const cx = Math.sin(fa) * r + Math.cos(fa) * sm, cz = Math.cos(fa) * r - Math.sin(fa) * sm;
  m.block(cx, y, cz, len + 0.02, h, t, 'stone', { ry: fa + Math.PI / 2 - Math.PI / 2, walkable: false });
  if (face >= 0 && face % 2 === 1 && len > 1.6) m.trim(Math.sin(fa) * (ri + 0.01), y + 1.0, Math.cos(fa) * (ri + 0.01), 0.3, 1.4, 0.06, 'dark', { ry: fa, grad: 0 });
}
