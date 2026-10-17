// The faction seats. A palace is a place you walk through: a gatehouse, a forecourt, a
// raised hall, the room where the faction sits in judgement, galleries, stairs, terraces
// and the crown that names it on the skyline. Every room has a use, a light and its own
// furniture; every surface comes from the kit in the faction's one palette.
//
//   The Lantern Palace (Saltreach)  the Compact of lantern-keepers on the Keepers' Shelf.
//   The Enclave Palace (Meridian) the Enclave's command on the bastion rock (the Vice Warden's seat).
//
// Coordinates are the palace's own: +z toward its front, x across; y relative to its datum.
import * as THREE from 'three';
import { Mason } from './mason.js';
import { buildGatehouse } from './seaGate.js';
import { buildWallTower } from './fortifications.js';
import * as F from './furnishing.js';

const STEP = 0.3, RUN = 0.45;

// ---------------------------------------------------------------- shared parts
// A spiral stair in a square turret: flights round the walls, landings at the corners.
// Climbs from y0 to y1 inside the turret's inner w x w, starting at the -x,-z corner going +z.
function turretStair(m, cx, cz, w, y0, y1, o = {}) {
  const fw = o.flight ?? 1.1; // flight width
  const side = w - fw * 2; // run along each wall between the two corner landings
  const N = Math.ceil((y1 - y0) / STEP - 1e-6);
  const rise = (y1 - y0) / N;
  // treads stay at least 0.42 m, so a walker on one step never stubs a foot two steps up;
  // the risers are shared over the fewest flights that end at the wanted corner
  const tmax = Math.max(2, Math.floor(side / 0.42));
  let flights = Math.ceil(N / tmax);
  if (o.end != null) while (flights % 4 !== o.end) flights++;
  const per = (i) => Math.floor(N / flights) + (i < N % flights ? 1 : 0);
  const h = w / 2 - fw / 2;
  const corners = [[-h, -h], [-h, h], [h, h], [h, -h]];
  m.landing(cx + corners[0][0], cz + corners[0][1], fw, fw, y0, { base: y0 - 0.3 });
  let y = y0, k = 0, left = N;
  while (left > 0 && k < flights) {
    const a = corners[k % 4], b = corners[(k + 1) % 4];
    const dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]);
    const sx = cx + a[0] + dx * fw / 2, sz = cz + a[1] + dz * fw / 2; // off corner a's landing
    const n = Math.min(per(k), left);
    const r = side / n; // a short last flight spreads its treads along the wall
    for (let i = 0; i < n; i++) {
      const top = y + rise * (i + 1), u = r * (i + 0.5);
      const px = sx + dx * u, pz = sz + dz * u;
      m.trim(px, top - 0.35, pz, dx ? r : fw, 0.35, dz ? r : fw, 'stone2');
      m.solid(px, top - 0.35, pz, dx ? r + 0.04 : fw, 0.35, dz ? r + 0.04 : fw, { climbable: false });
      m.trim(px - dx * (r / 2 - 0.03), top - 0.05, pz - dz * (r / 2 - 0.03), dx ? 0.08 : fw - 0.04, 0.06, dz ? 0.08 : fw - 0.04, 'edge');
    }
    y += n * rise; left -= n;
    m.landing(cx + b[0], cz + b[1], fw, fw, y, { base: y - 0.35 });
    k++;
  }
  // the newel: a square core the flights wind round
  m.block(cx, y0, cz, w - fw * 2 - 0.05, y1 - y0 + 0.5, w - fw * 2 - 0.05, 'stone', { walkable: false });
  return { y, corner: corners[k % 4], flights };
}

// Hanging lanterns along a line under a ceiling at `ceil`.
function lanternRow(m, ax, az, bx, bz, ceil, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    m.hanging(ax + (bx - ax) * t, ceil, az + (bz - az) * t, o.drop ?? 1.4, { light: i === Math.floor(n / 2) && o.light !== false, intensity: o.intensity ?? 2, priority: o.priority ?? 1.6, distance: o.distance ?? 14 });
  }
}

// Coursed piers with arches between: a range of n bays from x0 to x1 at z, depth d.
function arcadeRun(m, x0, x1, z, y, n, pierH, top, o = {}) {
  m.arcade(x0, x1, z, y, n, pierH, top, { pier: o.pier ?? 0.8, depth: o.depth ?? 0.7, pointed: o.pointed ?? true, sharp: 0.72, c: o.c || 'stone', archC: 'edge' });
}

// A stone-and-slate range: two storeys between (x0, z0) and (x1, z1), its court face toward
// +z (o.face) unless told otherwise. Doors and windows by side, a timber upper floor on beams,
// a stair between the floors and a slate roof. Returns the floor heights.
function range(m, x0, x1, z0, z1, y, o = {}) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const h1 = o.h1 ?? 4.6, h2 = o.h2 ?? 4.2, t = 0.7;
  const H = h1 + h2;
  // the floor sits a hand above the ground it covers, so turf never shows through it
  m.floor(cx, y + 0.08, cz, w - 0.1, d - 0.1, 'floor', { t: 0.5 });
  m.shell(cx, cz, w, d, y, h1, { t, openings: o.ground || {}, style: o.style || 'stone', lit: true, corners: o.style !== 'brick' });
  m.shell(cx, cz, w, d, y + h1, h2, { t, openings: o.upper || {}, style: o.style || 'stone', lit: true, corners: o.style !== 'brick' });
  m.trim(cx, y + h1 - 0.3, cz, w + 0.24, 0.3, d + 0.24, 'edge');
  // the upper floor on beams, with a stair well at o.well
  const well = o.well; // { x, z, w, d } in the range's own coordinates
  const inner = [w - t * 2, d - t * 2];
  if (well) {
    // floor in strips around the well
    const fx0 = x0 + t, fx1 = x1 - t, fz0 = z0 + t, fz1 = z1 - t;
    const wx0 = well.x - well.w / 2, wx1 = well.x + well.w / 2, wz0 = well.z - well.d / 2, wz1 = well.z + well.d / 2;
    const strips = [[fx0, wx0, fz0, fz1], [wx1, fx1, fz0, fz1], [wx0, wx1, fz0, wz0], [wx0, wx1, wz1, fz1]];
    for (const [a, b, c, e] of strips) if (b - a > 0.05 && e - c > 0.05) m.ceiling((a + b) / 2, y + h1 - 0.3, (c + e) / 2, b - a, e - c, { axis: w > d ? 'z' : 'x', every: 1.8 });
    for (const [a, b, c, e] of strips) if (b - a > 0.05 && e - c > 0.05) m.floor((a + b) / 2, y + h1, (c + e) / 2, b - a, e - c, 'wood', { t: 0.05, solid: false });
    // the flight itself
    const dir = well.dir ?? 0; // heading of the climb
    const sx = well.x - Math.sin(dir) * (well.len / 2), sz = well.z - Math.cos(dir) * (well.len / 2);
    m.stair(sx, sz, dir, Math.min(well.w, well.d) - 0.15, y, y + h1, { base: y, run: well.len / Math.ceil(h1 / STEP), c: 'wood', nose: 'dark' });
    // a rail round the well's open edge upstairs
    if (o.wellRail !== false) m.rail(wx0, wz0, wx0, wz1, y + h1, { c: 'timber' });
  } else {
    m.ceiling(cx, y + h1 - 0.3, cz, inner[0], inner[1], { axis: w > d ? 'z' : 'x', every: 1.8 });
    m.floor(cx, y + h1, cz, inner[0], inner[1], 'wood', { t: 0.05, solid: false });
  }
  // the upper rooms' ceiling under the roof
  m.ceiling(cx, y + H - 0.3, cz, inner[0], inner[1], { axis: w > d ? 'z' : 'x', every: 2.2 });
  m.shelter(cx, cz, w, d, y - 0.2, y + H + 0.2);
  if (o.roof === 'terrace') {
    // a walkable roof: paved, behind a crenellated parapet outside and a breastwork inside
    // the walk runs on into the towers at its ends (o.extend: metres past each side)
    const ex = { n: 0, s: 0, e: 0, w: 0, ...(o.extend || {}) };
    m.floor(cx + (ex.e - ex.w) / 2, y + H + 0.35, cz + (ex.n - ex.s) / 2, w + ex.e + ex.w, d + ex.n + ex.s, 'stone', { t: 0.65 });
    m.trim(cx, y + H + 0.35, cz, w + 0.3, 0.2, d + 0.3, 'edge');
    for (const [side, crenel, gaps = []] of o.parapets || []) {
      if (!side) continue;
      const [ax, az, bx, bz] = side === 'n' ? [x0, z1 - 0.3, x1, z1 - 0.3] : side === 's' ? [x0, z0 + 0.3, x1, z0 + 0.3] : side === 'e' ? [x1 - 0.3, z0, x1 - 0.3, z1] : [x0 + 0.3, z0, x0 + 0.3, z1];
      // runs between the gaps (given as [from, to] along the side, metres from its first end)
      const L = Math.hypot(bx - ax, bz - az), cuts = [[0, 0], ...gaps.slice().sort((p, q) => p[0] - q[0]), [L, L]];
      for (let i = 1; i < cuts.length; i++) {
        const u0 = cuts[i - 1][1], u1 = cuts[i][0];
        if (u1 - u0 < 0.3) continue;
        const pa = [ax + (bx - ax) * u0 / L, az + (bz - az) * u0 / L], pb = [ax + (bx - ax) * u1 / L, az + (bz - az) * u1 / L];
        m.parapet(pa[0], pa[1], pb[0], pb[1], y + H + 0.35, { t: 0.6, h: 1.1, c: 'stone' });
        if (crenel) m.k.crenels(pa[0], pa[1], pb[0], pb[1], y + H + 1.45, 0.6, { c: 'stone', h: 1.0 });
      }
    }
  } else {
    m.trim(cx, y + H, cz, w + 0.5, 0.3, d + 0.5, 'edge');
    m.roof(cx, y + H + 0.3, cz, w + 0.2, d + 0.2, o.rise ?? Math.min(w, d) * 0.62, { flare: o.flare ?? 0.7, overhang: 0.7, c: 'roof', c2: 'roof2' });
  }
  return { y1: y + h1, y2: y + H, top: y + H };
}

// ---------------------------------------------------------------- the Lantern Palace
// The Compact's seat on the Keepers' Shelf. Local frame: +z faces the North Way (world +x),
// x runs across the front (local +x is world south). Datum: the shelf top.
export function buildLanternPalace(world, s, exclusions, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.yaw, y: s.y, palette: 'salt', tag: s.id, name: 'The Lantern Palace', lights: 40 });
  const Y1 = 1.8; // the palace terrace above the forecourt
  const rec = (world.palaces ||= []);
  const rooms = [];
  const room = (name, use, x, z, w, d, y) => rooms.push({ name, use, at: m.point(x, y, z), w, d });

  // ---- the double stair from the North Way up the shelf face to the gate landing
  {
    const foot = s.terrace - s.y; // the terrace below, relative to the shelf
    const LZ0 = 28, LZ1 = 33.2;
    m.landing(0, (LZ0 + LZ1) / 2, 11, LZ1 - LZ0, 0, { c: 'stone' });
    for (const side of [-1, 1]) {
      // two flights descending away from the landing along the shelf face, one turn-landing
      const zc = 30.6, fw = 3.6;
      const n1 = Math.ceil(-foot / 2 / STEP), n2 = Math.ceil(-foot / STEP) - n1;
      const xTop = side * 5.5;
      // upper flight: from the mid landing up to the top landing
      const midX = side * (5.5 + n2 * RUN + 1.25);
      const yMid = -n2 * STEP;
      m.stair(midX - side * 1.25, zc, side > 0 ? -Math.PI / 2 : Math.PI / 2, fw, yMid, 0, { cheeks: false });
      m.landing(midX, zc, 2.5, fw, yMid, { c: 'stone' });
      const footX = midX + side * (1.25 + n1 * RUN);
      m.stair(footX, zc, side > 0 ? -Math.PI / 2 : Math.PI / 2, fw, foot, yMid, { cheeks: false });
      // balustrade on the open side, piers and lanterns at the landings
      const span = (a, b, ya, yb) => {
        const n = Math.max(1, Math.round(Math.abs(b - a) / RUN / 2));
        for (let i = 0; i < n; i++) {
          const u0 = a + (b - a) * i / n, u1 = a + (b - a) * (i + 1) / n;
          const yy = ya + (yb - ya) * (i + 0.5) / n;
          m.block((u0 + u1) / 2, yy - 0.2, zc + fw / 2 + 0.25, Math.abs(u1 - u0) + 0.02, 1.25, 0.45, 'stone2', { walkable: false });
        }
        m.trim((a + b) / 2, Math.max(ya, yb) + 1.0, zc + fw / 2 + 0.25, Math.abs(b - a), 0.12, 0.6, 'edge');
      };
      span(footX, midX + side * 1.25, foot, yMid);
      span(midX - side * 1.25, xTop, yMid, 0);
      for (const px of [footX, midX, xTop]) {
        const py = px === footX ? foot : px === midX ? yMid : 0;
        m.block(px, py, zc + fw / 2 + 0.25, 0.8, 1.5, 0.8, 'stone', { walkable: false });
        m.lantern(px, py + 1.5, zc + fw / 2 + 0.25, { post: 0.9, light: px !== footX, priority: 0.7, intensity: 1 });
      }
      // the stair's mass against the shelf face, so no flight floats
      m.block(midX, foot, zc - fw / 2 - 0.25, Math.abs(footX - xTop) + 2, -foot, 0.5, 'stone2', { solid: false });
    }
    m.parapet(-5.5, LZ1, 5.5, LZ1, 0, { t: 0.5, h: 1.05 });
  }

  // ---- the gatehouse
  {
    const g = new THREE.Group();
    const p = m.point(0, 0, 24);
    g.position.copy(p);
    g.rotation.y = s.yaw + Math.PI;
    buildGatehouse(world, { x: p.x, z: p.z, rot: s.yaw + Math.PI, palette: 'salt', tag: s.id, name: 'Lantern Gate',
      pw: 2.6, spring: 4.4, depth: 8, tx: 7.6, tw: 5.6, td: 8.4, walk: 9.6, lightInside: true }, g);
    add(g);
    room('Lantern Gate', 'the gate passage, watched from its two lookouts', 0, 24, 5, 8, 0);
  }

  // ---- the front range: guardroom and chandlery either side of the gate, a terrace above
  for (const side of [-1, 1]) {
    // its ends meet the side ranges' corners (they start at ±21.5)
    const x0 = side > 0 ? 10.4 : -21.5, x1 = side > 0 ? 21.5 : -10.4;
    const doorU = side > 0 ? -3 : 3;
    const r = range(m, x0, x1, 20, 28, 0, {
      ground: { s: [{ u: doorU, w: 2.2, h: 2.9 }, { u: -doorU * 0.2, w: 1.2, y: 1.2, h: 1.6 }], n: [{ u: 0, w: 0.5, y: 1.4, h: 1.6 }, { u: side * 3, w: 0.5, y: 1.4, h: 1.6 }] },
      upper: { s: [{ u: -2.5, w: 1.1, y: 1, h: 1.9 }, { u: 2.5, w: 1.1, y: 1, h: 1.9 }], n: [{ u: 0, w: 0.5, y: 1.0, h: 1.8 }] },
      well: { x: (x0 + x1) / 2 + side * 3.4, z: 25.6, w: 1.4, d: 4, len: 4, dir: Math.PI },
      rise: 3.2,
    });
    const cx = (x0 + x1) / 2;
    if (side > 0) {
      // the Wardens' guardroom: a table for the watch, racks, a hearth on the end wall
      F.table(m, cx + 1.4, 0, 23.6, 2.4, 1.0, { cloth: 'cloth' });
      F.bench(m, cx + 1.4, 0, 22.7, 2.2);
      F.bench(m, cx + 1.4, 0, 24.5, 2.2, { ry: Math.PI });
      F.rack(m, cx - 3, 0, 26.9, 2.4, { ry: Math.PI });
      F.hearth(m, x1 - 1.05, 0, 24, { ry: -Math.PI / 2, w: 1.6, h: 2.6 });
      room("Wardens' Guardroom", 'the lantern wardens off watch: their table, their pikes', cx, 24, x1 - x0, 8, 0);
      // upstairs: their bunks
      for (let i = 0; i < 3; i++) F.bunk(m, x0 + 1.6 + i * 2.1, r.y1, 26.4, { ry: Math.PI });
      m.light(cx, r.y1 + 2.4, 24, { intensity: 3.5, distance: 9, priority: 1.6 });
    } else {
      // the chandlery: oil for every lamp in the city, wicks and spare glass
      for (let i = 0; i < 4; i++) F.barrel(m, x0 + 1.4 + i * 0.95, 0, 26.6);
      F.shelves(m, cx + 1.5, 0, 27.0, 3, 2.4, { ry: Math.PI, goods: ['glow', 'metal', 'edge'] });
      F.counter(m, cx, 0, 22.6, 3.2, { goodsC: 'glow' });
      F.crate(m, x0 + 1.2, 0, 22.0); F.crate(m, x0 + 1.2, 0.8, 22.0, 0.6);
      m.hanging(cx - 1, r.y1 - 0.3, 24.2, 0.9, { intensity: 4, priority: 1.7 });
      room('Chandlery', 'oil, wick and glass for every lantern the Compact keeps', cx, 24, x1 - x0, 8, 0);
      F.bed(m, x0 + 1.4, r.y1, 26.2, { ry: Math.PI }); F.table(m, cx + 1, r.y1, 24, 1.6, 0.9);
      F.shelves(m, x1 - 1.4, r.y1, 27.0, 2, 2, { ry: Math.PI });
      m.light(cx, r.y1 + 2.4, 24, { intensity: 3.5, distance: 9, priority: 1.6 });
    }
  }

  // ---- the corner towers: the ring meets the palace at the rear two
  const ring = { id: 'saltreach_ring', name: 'Lantern Palace', palette: 'salt', tower: { R: 5.0, roof: 'cone' } };
  const towerAt = (lx, lz, floor, heads) => {
    const p = m.point(lx, 0, lz);
    add(buildWallTower(world, ring, p.x, p.z, s.y + floor, heads.map(h => h + s.yaw), s.id, exclusions));
  };
  towerAt(26, 25, 9.95, [-Math.PI / 2, Math.PI]);
  towerAt(-26, 25, 9.95, [Math.PI / 2, Math.PI]);
  towerAt(26, -26, 9.3, [0, -Math.PI / 2]);
  towerAt(-26, -26, 9.3, [0, Math.PI / 2]);

  // ---- the side ranges along the forecourt and the cloisters
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? 21.5 : -28, x1 = side > 0 ? 28 : -21.5;
    const innerU = (z) => z; // openings on the court face are given as z offsets from the range centre
    // forecourt half: Hall of Records (+x), the Keepers' kitchen (-x)
    const zf0 = 5.2, zf1 = 20, zfc = (zf0 + zf1) / 2;
    const courtFace = side > 0 ? 'w' : 'e';
    const ground = { [courtFace]: [{ u: innerU(side > 0 ? -1.5 : 1.5), w: 2.2, h: 2.9 }, { u: side * 4.5, w: 1.2, y: 1.2, h: 1.7 }, { u: -side * 4.5, w: 1.2, y: 1.2, h: 1.7 }],
      [side > 0 ? 'e' : 'w']: [{ u: 3, w: 0.5, y: 1.6, h: 1.4 }, { u: -3, w: 0.5, y: 1.6, h: 1.4 }] };
    const upper = { [courtFace]: [{ u: -4, w: 1.1, y: 1, h: 1.9 }, { u: 0, w: 1.1, y: 1, h: 1.9 }, { u: 4, w: 1.1, y: 1, h: 1.9 }],
      [side > 0 ? 'e' : 'w']: [{ u: 0, w: 1.0, y: 1.0, h: 1.8, lit: true }] };
    const rf = range(m, x0, x1, zf0, zf1, 0, { ground, upper, well: { x: (x0 + x1) / 2, z: zf1 - 2.9, w: 1.6, d: 4.4, len: 4.4, dir: 0 }, rise: 3.4 });
    const fx = (x0 + x1) / 2;
    if (side > 0) {
      F.shelves(m, x1 - 1.0, 0, zfc - 2.5, 3, 2.6, { ry: -Math.PI / 2 });
      F.shelves(m, x1 - 1.0, 0, zfc + 1.0, 3, 2.6, { ry: -Math.PI / 2 });
      F.table(m, fx - 0.6, 0, zfc - 3.5, 1.8, 1.0); F.chair(m, fx - 0.6, 0, zfc - 4.4);
      m.hanging(fx, rf.y1 - 0.3, zfc, 1.0, { intensity: 4, priority: 1.7 });
      room('Hall of Records', 'the Compact’s lamp rolls: every lantern lit, every keeper sworn', fx, zfc, 6.5, zf1 - zf0, 0);
      F.table(m, fx, rf.y1, zfc - 3, 2, 1); F.shelves(m, x1 - 1.0, rf.y1, zfc, 3, 2.2, { ry: -Math.PI / 2 });
    } else {
      F.hearth(m, x0 + 1.05, 0, zfc - 2, { ry: Math.PI / 2, w: 2, h: 2.8 });
      F.table(m, fx + 0.6, 0, zfc + 4.6, 2.2, 1.0);
      F.bench(m, fx + 0.6, 0, zfc + 3.7, 2); F.bench(m, fx + 0.6, 0, zfc + 5.5, 2, { ry: Math.PI });
      for (let i = 0; i < 3; i++) F.barrel(m, fx - 1.6, 0, zf0 + 1.4 + i * 0.95);
      room("Keepers' Kitchen", 'where the night keepers eat before the rounds', fx, zfc, 6.5, zf1 - zf0, 0);
      for (let i = 0; i < 3; i++) F.bed(m, x0 + 1.5, rf.y1, zf0 + 2 + i * 2.6, { ry: Math.PI / 2 });
      m.light(fx, rf.y1 + 2.4, zfc, { intensity: 3.5, distance: 9, priority: 1.6 });
    }
    // palace half (on the terrace): the Lantern Archive (+x), the Keepers' lodging (-x)
    const zp0 = -21, zp1 = 5.2, zpc = (zp0 + zp1) / 2;
    // a court face's u runs toward +z on either side, so the doors face each other across the
    // hall, clear of the cloister stairs that climb along these walls from z 2.2 to -5.9; the
    // upper door opens on the gallery's end walk
    const groundP = { [courtFace]: [{ u: -6, w: 2.2, h: 2.9 }, { u: -3, w: 1.1, y: 1.1, h: 1.8 }, { u: -9, w: 1.1, y: 1.1, h: 1.8 }],
      [side > 0 ? 'e' : 'w']: [{ u: -8, w: 0.5, y: 1.6, h: 1.4 }, { u: 0, w: 0.5, y: 1.6, h: 1.4 }, { u: 8, w: 0.5, y: 1.6, h: 1.4 }] };
    const upperP = { [courtFace]: [{ u: -5, w: 2.0, h: 2.6 }, { u: -2, w: 1.1, y: 1, h: 1.9 }, { u: -8, w: 1.1, y: 1, h: 1.9 }, { u: 10, w: 1.1, y: 1, h: 1.9 }],
      [side > 0 ? 'e' : 'w']: [{ u: -5, w: 1, y: 1, h: 1.8, lit: true }, { u: 5, w: 1, y: 1, h: 1.8, lit: true }] };
    m.footing((x0 + x1) / 2, zpc, x1 - x0, zp1 - zp0, Y1, { solid: false, cap: false });
    const rp = range(m, x0, x1, zp0, zp1, Y1, { ground: groundP, upper: upperP, h1: 5.0, rise: 3.4 });
    if (side > 0) {
      for (let i = 0; i < 4; i++) F.shelves(m, x1 - 1.0, Y1, zp0 + 3 + i * 5.6, 4.2, 3.2, { ry: -Math.PI / 2, goods: ['cushion', 'edge', 'cloth', 'accent'] });
      F.table(m, fx - 0.8, Y1, zpc, 1.8, 3.4); F.chair(m, fx - 1.8, Y1, zpc, { ry: Math.PI / 2 });
      F.lanternStand(m, fx - 1.6, Y1, zp0 + 2.2);
      lanternRow(m, fx, zp0 + 3, fx, zp1 - 3, rp.y1 - 0.3, 3, { drop: 1.0, intensity: 5, priority: 1.8, distance: 16 });
      room('Lantern Archive', 'the logbooks of every lamp that ever went out, and why', fx, zpc, 6.5, zp1 - zp0, Y1);
      for (let i = 0; i < 3; i++) F.shelves(m, x1 - 1.0, rp.y1, zp0 + 4 + i * 7, 4.2, 2.6, { ry: -Math.PI / 2 });
      m.light(fx, rp.y1 + 2.4, zpc, { intensity: 3.5, distance: 11, priority: 1.6 });
    } else {
      for (let i = 0; i < 4; i++) {
        F.bed(m, x0 + 1.5, Y1, zp0 + 2.6 + i * 6, { ry: Math.PI / 2 });
        F.table(m, x0 + 1.4, Y1, zp0 + 4.6 + i * 6, 0.8, 0.8, { h: 0.7 });
      }
      F.hearth(m, fx, Y1, zp1 - 1.05, { ry: Math.PI, w: 1.8 });
      room("Keepers' Lodging", 'the cells of the keepers who tend the crown lantern', fx, zpc, 6.5, zp1 - zp0, Y1);
      for (let i = 0; i < 4; i++) F.bed(m, x0 + 1.5, rp.y1, zp0 + 3 + i * 6, { ry: Math.PI / 2 });
      m.light(fx, rp.y1 + 2.4, zpc, { intensity: 3.5, distance: 11, priority: 1.6 });
    }
  }

  // ---- the rear range on the cliff: the treasury and the keepers' chapter house above
  {
    const r = range(m, -21.5, 21.5, -28, -21, Y1, {
      ground: { n: [{ u: -13, w: 2.2, h: 2.9 }, { u: 13, w: 2.2, h: 2.9 }, { u: -17, w: 1.1, y: 1.1, h: 1.8 }, { u: 17, w: 1.1, y: 1.1, h: 1.8 }],
        s: [{ u: -15, w: 0.5, y: 2, h: 1.4 }, { u: -9, w: 0.5, y: 2, h: 1.4 }, { u: 9, w: 0.5, y: 2, h: 1.4 }, { u: 15, w: 0.5, y: 2, h: 1.4 }] },
      upper: { n: [{ u: -16, w: 1.1, y: 1, h: 1.9 }, { u: 16, w: 1.1, y: 1, h: 1.9 }, { u: -11, w: 1.8, h: 2.6 }, { u: 11, w: 1.8, h: 2.6 }],
        s: [{ u: -16, w: 1.4, y: 0.9, h: 2.2, lit: true }, { u: -10, w: 1.4, y: 0.9, h: 2.2, lit: true }, { u: 10, w: 1.4, y: 0.9, h: 2.2, lit: true }, { u: 16, w: 1.4, y: 0.9, h: 2.2, lit: true }] },
      h1: 5.0, rise: 3.6,
    });
    for (const sx of [-1, 1]) {
      F.crate(m, sx * 15, Y1, -26.6, 0.9); F.crate(m, sx * 16.1, Y1, -26.6, 0.8); F.barrel(m, sx * 17.2, Y1, -26.4);
      F.shelves(m, sx * 11, Y1, -27.2, 2.6, 2.4, { goods: ['brass', 'edge', 'glow'] });
      m.hanging(sx * 14, r.y1 - 0.3, -24.5, 1.0, { intensity: 4, priority: 1.7, light: true });
      F.table(m, sx * 14, r.y1, -24.6, 3, 1.2, { cloth: 'cloth' });
      for (const dx of [-1, 0, 1]) F.chair(m, sx * 14 + dx, r.y1, -25.5);
    }
    room('Strongroom', 'the Compact’s silver and the spare great lenses', 15, -24.5, 6, 6, Y1);
    room('Chapter House', 'where the keepers sit to name a new keeper', 14, -24.5, 8, 6, r.y1);
  }

  // ---- the forecourt: the Lantern Court
  {
    const z0 = 7.8, z1 = 20, zc = (z0 + z1) / 2;
    // paving in large slabs, an edging course and drains
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) {
      const x = -19 + i * 38 / 8, z = z0 + 1.2 + j * (z1 - z0 - 2.4) / 4;
      m.trim(x, 0.04, z, 4.1, 0.05, 2.35, (i + j) % 2 ? 'floor' : 'stone2', { grad: 0 });
    }
    m.floor(0, 0.06, zc, 43, z1 - z0 + 2, 'floor', { t: 0.5 });
    // the Lantern Well: the Compact's first flame, kept on a stand in a stepped basin
    m.k.prism(0, 0, zc, 3.2, 0.45, 'stone2', { sides: 12 });
    m.k.prism(0, 0.45, zc, 2.6, 0.35, 'stone', { sides: 12 });
    m.k.prism(0, 0.5, zc, 2.2, 0.31, '#5c7d86', { sides: 12 });
    m.pillar(0, 0, zc, 2.6, 0.8);
    m.k.prism(0, 0.8, zc, 0.45, 2.2, 'stone', { sides: 8, top: 0.7 });
    m.k.prism(0, 3.0, zc, 0.7, 0.3, 'edge', { sides: 8 });
    m.trim(0, 3.3, zc, 0.12, 1.2, 0.12, 'metal', { layer: 'metal' });
    m.k.prism(0, 4.1, zc, 0.62, 1.1, 'metal', { sides: 6, top: 0.8, layer: 'metal' });
    m.glow(0, 4.65, zc, 0.8, 0.85, 0.8, 1.6);
    m.k.pyramid(0, 5.2, zc, 0.75, 0.6, 'metal', { sides: 6, layer: 'metal' });
    m.light(0, 4.6, zc, { intensity: 1.8, distance: 18, priority: 1.2, color: '#ffc98a' });
    // two rows of standing lanterns lead the eye from the gate to the hall
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) F.lanternStand(m, sx * 7.5, 0, z0 + 0.8 + i * (z1 - z0 - 1.6) / 3, { post: 2.4 });
    for (const sx of [-1, 1]) {
      F.bench(m, sx * 12.5, 0, zc - 2.2, 2.6, { back: true, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
      F.bench(m, sx * 12.5, 0, zc + 2.2, 2.6, { back: true, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
    room('Lantern Court', 'the first flame of the Compact, kept in its well', 0, zc, 43, z1 - z0, 0);
  }

  // ---- the podium: the palace stands a man's height above the court
  {
    m.footing(0, -8, 43, 26.4, Y1, { solid: true, cap: false, c: 'stone2' });
    m.trim(0, Y1 - 0.2, 5.2, 43.2, 0.2, 0.5, 'edge');
    // the hall stair, flanked by balustrades along the podium edge
    m.stair(0, 7.9, Math.PI, 12, 0, Y1, { run: RUN, c: 'stone' });
    for (const sx of [-1, 1]) {
      m.parapet(sx * 6.3, 5.4, sx * 21.4, 5.4, Y1, { t: 0.4, h: 0.95 });
      m.block(sx * 6.3, 0, 6.6, 0.8, Y1 + 1.4, 2.6, 'stone', { walkable: false });
      m.lantern(sx * 6.3, Y1 + 1.4, 6.6, { post: 0.8, light: false });
    }
  }

  // ---- the Great Hall
  const HZ0 = -11, HZ1 = 5, HX = 11, HH = 12.5;
  {
    const hz = (HZ0 + HZ1) / 2, hd = HZ1 - HZ0;
    m.floor(0, Y1, hz, HX * 2 - 1, hd - 1, 'floor', { t: 0.2 });
    // walls: tall windows on the sides, the great door and a rose of lit panes over it
    const sideWindows = (u) => [{ u, w: 1.3, y: 8.0, h: 3.0, lit: true, mullion: true }];
    m.shell(0, hz, HX * 2, hd, Y1, HH, {
      t: 0.9,
      openings: {
        n: [{ u: 0, w: 3.4, h: 5.2 }, { u: -6, w: 1.4, y: 6.4, h: 4.2, lit: true, mullion: true }, { u: 6, w: 1.4, y: 6.4, h: 4.2, lit: true, mullion: true }, { u: 0, w: 2.2, y: 7.0, h: 3.6, lit: true, mullion: true }],
        s: [{ u: 0, w: 5.0, h: 7.4 }],
        e: [{ u: 1, w: 2.2, h: 3.0 }, { u: -5, w: 2.0, y: 5.0, h: 2.6, door: true }, ...sideWindows(-1), ...sideWindows(4)],
        w: [{ u: 1, w: 2.2, h: 3.0 }, { u: -5, w: 2.0, y: 5.0, h: 2.6, door: true }, ...sideWindows(-1), ...sideWindows(4)],
      },
    });
    m.doorArch(0, Y1 + 5.2, HZ1 + 0.2, 3.6, 0, { t: 0.45, depth: 0.5 });
    m.doorArch(0, Y1 + 7.4, HZ0 - 0.2, 5.2, 0, { t: 0.5, depth: 0.5 });
    // pilasters carry the roof between the windows (the cloister galleries buttress the walls)
    for (const sx of [-1, 1]) for (const z of [HZ0 + 0.6, -3.3, 2.0, HZ1 - 0.6]) m.trim(sx * (HX + 0.12), Y1 + 5.6, z, 0.24, HH - 5.6, 0.9, 'stone2');
    // the arcade of the nave: columns carrying the galleries over the aisles
    const GY = Y1 + 5.0, gx = 6.2;
    for (const sx of [-1, 1]) {
      for (const z of [-8, -4, 0, 3.4]) m.column(sx * gx, Y1, z, GY - Y1, 0.42, { sides: 8 });
      // gallery deck over the aisle, beams on the columns, a balustrade to the nave
      m.floor(sx * (gx + (HX - 0.45 - gx) / 2), GY + 0.3, (HZ0 + HZ1) / 2 - 0.3, HX - 0.45 - gx + 0.5, hd - 1.6, 'wood', { t: 0.3 });
      m.trim(sx * gx, GY, (HZ0 + HZ1) / 2 - 0.3, 0.6, 0.35, hd - 1.6, 'timber');
      m.parapet(sx * (gx - 0.1), HZ0 + 1.1, sx * (gx - 0.1), HZ1 - 1.4, GY + 0.3, { t: 0.3, h: 1.0, c: 'stone2' });
      for (const z of [-6, -2, 1.7]) m.banner(sx * (gx - 0.3), GY - 0.4, z, 1.3, 3.2, 'cloth', sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    // a timber ceiling on tie beams, the slate roof over it
    m.ceiling(0, Y1 + HH - 0.3, hz, HX * 2 - 1.8, hd - 1.8, { axis: 'z', every: 2.4, c: 'ceiling' });
    m.trim(0, Y1 + HH, hz, HX * 2 + 0.6, 0.35, hd + 0.6, 'edge');
    m.roof(0, Y1 + HH + 0.35, hz, HX * 2 + 0.2, hd + 0.2, 8.5, { flare: 0.9, overhang: 0.8, c: 'roof', c2: 'roof2' });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      // dormer lanterns on the long slopes: the hall's name, lit from the town at night
      const z = HZ0 + 3 + i * 5;
      m.block(sx * (HX - 2.2), Y1 + HH + 0.35, z, 1.6, 2.2, 1.6, 'plaster', { walkable: false });
      m.glow(sx * (HX - 2.2 + sx * 0.82), Y1 + HH + 1.4, z, 0.04, 1.0, 0.9, 1.1);
      m.roof(sx * (HX - 2.2), Y1 + HH + 2.55, z, 1.6, 1.6, 1.2, { kind: 'pyramid', overhang: 0.25 });
    }
    // furniture: two long tables either side of the aisle, braziers, the keepers' lamps
    for (const sx of [-1, 1]) {
      for (const tz of [-5.6, 0.6]) {
        F.table(m, sx * 3.2, Y1, tz, 1.3, 4.0, { cloth: 'cloth' });
        F.bench(m, sx * 2.2, Y1, tz, 3.6, { ry: Math.PI / 2 });
        F.bench(m, sx * 4.2, Y1, tz, 3.6, { ry: -Math.PI / 2 });
      }
      F.brazier(m, sx * 8.6, Y1, -8, { light: sx > 0, intensity: 5, distance: 16 });
      F.brazier(m, sx * 8.6, Y1, 2.5, { light: sx < 0, intensity: 5, distance: 16 });
    }
    F.rug(m, 0, Y1, -2.5, 2.2, 13, { c: 'cushion', c2: 'accent' });
    lanternRow(m, 0, HZ0 + 2, 0, HZ1 - 2, Y1 + HH - 0.3, 3, { drop: 3.2, light: false });
    m.light(0, Y1 + 4.8, -3, { intensity: 7, distance: 24, priority: 2.2 });
    m.shelter(0, hz, HX * 2, hd, Y1 - 0.2, Y1 + HH + 0.3);
    room('The Great Hall', 'where the Compact feasts the keepers who brought the lanterns home', 0, hz, HX * 2, hd, Y1);
  }

  // ---- the Keepers' Chair under the Lantern Crown
  const CZ0 = -21.2, CZ1 = HZ0, CX = 7;
  {
    const cz = (CZ0 + CZ1) / 2, cd = CZ1 - CZ0;
    m.floor(0, Y1, cz, CX * 2 - 1.6, cd - 1.6, 'floor', { t: 0.2 });
    const TH = 34; // the crown's lantern gallery floor above the terrace
    m.shell(0, cz, CX * 2, cd, Y1, TH, {
      t: 1.0,
      openings: {
        n: [{ u: 0, w: 5.0, h: 7.4 }, { u: 0, w: 1.4, y: HH + 3.5, h: 3, lit: true }, { u: 0, w: 1.4, y: HH + 10, h: 3, lit: true }],
        s: [{ u: 0, w: 1.6, y: 6.0, h: 3.6, lit: true, mullion: true }, { u: 0, w: 1.2, y: 15, h: 3, lit: true }, { u: 0, w: 1.2, y: 22, h: 3, lit: true }],
        e: [{ u: -2.9, w: 1.6, h: 3.0 }, { u: 2.5, w: 1.0, y: 15, h: 2.6, lit: true }, { u: -2.5, w: 1.0, y: 22, h: 2.6, lit: true }],
        w: [{ u: 3.5, w: 1.0, y: 5.5, h: 2.8, lit: true }, { u: -2.5, w: 1.0, y: 15, h: 2.6, lit: true }, { u: 2.5, w: 1.0, y: 22, h: 2.6, lit: true }],
      },
    });
    // string courses and pilaster strips mark the stages
    for (const yy of [HH + 0.4, 20, 27]) m.trim(0, Y1 + yy, cz + 0.5, CX * 2 + 0.5, 0.35, cd + 1.5, 'edge');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.block(sx * (CX - 0.2), Y1, (sz > 0 ? CZ1 + 0.5 : CZ0) + sz * 0.3, 1.3, TH, 1.3, 'stone2', { walkable: false });
    // the dais and the Lantern Chair
    F.throne(m, 0, Y1, CZ0 + 2.6, { w: 6, steps: 3, cushion: 'cushion', back: 3.4, device: (mm, x, y, z) => {
      mm.trim(x, y, z, 0.12, 0.9, 0.12, 'metal', { layer: 'metal' });
      mm.k.prism(x, y + 0.9, z, 0.5, 0.8, 'metal', { sides: 6, top: 0.8, layer: 'metal' });
      mm.glow(x, y + 1.3, z, 0.6, 0.6, 0.6, 1.5);
    } });
    F.rug(m, 0, Y1, -15, 2.4, 6.5, { c: 'cushion', c2: 'accent' });
    F.chartTable(m, 0, Y1, -14.2, 3.2, 1.6, { c: 'wood' });
    for (const sx of [-1, 1]) for (const dz of [-0.6, 0.6]) F.chair(m, sx * 2.0, Y1, -14.2 + dz, { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
    for (const sx of [-1, 1]) for (const z of [CZ0 + 1.3, CZ1 - 1.6]) {
      if (sx > 0 && z < CZ0 + 2) continue; // the crown stair's door
      F.lanternStand(m, sx * (CX - 1.6), Y1, z, { post: 2.6, light: z > CZ0 + 2 && sx > 0, intensity: 4, priority: 1.9 });
    }
    for (const sx of [-1, 1]) m.banner(sx * 3.1, Y1 + 3.2, CZ0 + 1.05, 1.4, 4.6, 'cloth', 0);
    m.ceiling(0, Y1 + 10.4, cz, CX * 2 - 2, cd - 2, { axis: 'x', every: 2.2 });
    m.light(0, Y1 + 4.2, -16.5, { intensity: 6, distance: 16, priority: 2.2 });
    m.shelter(0, cz, CX * 2, cd, Y1 - 0.2, Y1 + TH + 9);
    room("The Keepers' Chair", 'the seat of the Compact, under the lantern it keeps', 0, cz, CX * 2, cd, Y1);
    // upper stages: floors the turret serves, then the lantern gallery and the spire
    for (const fy of [16.6, 23.6]) {
      m.floor(0, Y1 + fy, cz, CX * 2 - 2, cd - 2, 'wood', { t: 0.3 });
      m.ceiling(0, Y1 + fy - 0.3, cz, CX * 2 - 2, cd - 2, { axis: 'x', every: 2, solid: false });
      F.shelves(m, -CX + 1.4, Y1 + fy, cz, 4, 2.4, { ry: Math.PI / 2, goods: ['glow', 'metal', 'edge'] });
      m.light(0, Y1 + fy + 2.2, cz, { intensity: 3.5, distance: 8, priority: 1.6 });
    }
    // the Lantern Crown: an open arcade round the great lamp, a walk outside it, slate spire
    const LY = Y1 + TH;
    const tz0 = -19.0 + 1.65 - 2.8 - 0.05, tz1 = -19.0 + 1.65 + 2.8 + 0.05; // the turret's z extent
    m.floor(-0.8, LY + 0.4, cz, CX * 2 + 1.8, cd + 3.4, 'stone', { t: 0.8 });
    const gz0 = cz - cd / 2 - 1.7, gz1 = cz + cd / 2 + 1.7;
    m.floor(CX + 0.85, LY + 0.4, (gz0 + tz0) / 2, 1.7, tz0 - gz0, 'stone', { t: 0.8 });
    m.floor(CX + 0.85, LY + 0.4, (tz1 + gz1) / 2, 1.7, gz1 - tz1, 'stone', { t: 0.8 });
    for (let i = 0; i < 8; i++) m.block(-CX - 1.3 + i * (CX * 2 + 2.6) / 7, LY - 1.4, cz + (cd / 2 + 1.5), 0.6, 1.4, 1.6, 'edge', { solid: false });
    m.parapet(-CX - 1.5, cz - cd / 2 - 1.5, CX + 1.5, cz - cd / 2 - 1.5, LY + 0.4, { t: 0.4, h: 1.0 });
    m.parapet(-CX - 1.5, cz + cd / 2 + 1.5, CX + 1.5, cz + cd / 2 + 1.5, LY + 0.4, { t: 0.4, h: 1.0 });
    m.parapet(-CX - 1.5, cz - cd / 2 - 1.5, -CX - 1.5, cz + cd / 2 + 1.5, LY + 0.4, { t: 0.4, h: 1.0 });
    m.parapet(CX + 1.5, cz - cd / 2 - 1.5, CX + 1.5, tz0, LY + 0.4, { t: 0.4, h: 1.0 });
    m.parapet(CX + 1.5, tz1, CX + 1.5, cz + cd / 2 + 1.5, LY + 0.4, { t: 0.4, h: 1.0 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.block(sx * (CX - 0.9), LY + 0.4, cz + sz * (cd / 2 - 0.9), 1.4, 5.6, 1.4, 'stone', { walkable: false });
    for (const sx of [-1, 1]) arcadeRun(m, -CX + 1.6, CX - 1.6, cz + sx * (cd / 2 - 0.9), LY + 0.4, 3, 3.2, LY + 6, { depth: 0.9 });
    m.at(-(CX - 0.9), cz, Math.PI / 2, (mm) => arcadeRun(mm, -cd / 2 + 1.6, cd / 2 - 1.6, 0, LY + 0.4, 2, 3.2, LY + 6, { depth: 0.9 }));
    // the east side backs onto the crown stair: a wall, its door facing the stair's, and a
    // window looking along the walk north of the turret
    m.wall(CX - 0.9, cz - cd / 2 + 1.6, CX - 0.9, cz + cd / 2 - 1.6, LY + 0.4, 5.6, { t: 0.9, openings: [{ u: (-19.0) - (cz - cd / 2 + 1.6), w: 1.2, h: 2.8 }, { u: tz1 + 0.75 - (cz - cd / 2 + 1.6), w: 1.2, y: 1.0, h: 2.2, lit: false, glass: false }] });
    // the slot between that wall and the turret's is built up solid to the turret's eaves, the
    // passage from door to door running through it
    m.wall(CX - 0.2, tz0 + 0.05, CX - 0.2, tz1 - 0.05, LY + 0.4, 3.0, { t: 0.5, jambs: false, openings: [{ u: (-19.0) - (tz0 + 0.05), w: 1.2, h: 2.6 }] });
    // the great lamp: a lens-cage of the Compact over a bronze stand
    m.k.prism(0, LY + 0.4, cz, 1.2, 0.6, 'stone2', { sides: 8 });
    m.k.prism(0, LY + 1.0, cz, 0.35, 1.4, 'metal', { sides: 6, layer: 'metal' });
    m.glow(0, LY + 3.4, cz, 2.0, 2.4, 2.0, 1.6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.trim(sx * 1.05, LY + 2.2, cz + sz * 1.05, 0.12, 2.4, 0.12, 'metal', { layer: 'metal' });
    m.k.prism(0, LY + 4.6, cz, 1.5, 0.3, 'metal', { sides: 8, layer: 'metal' });
    m.pillar(0, LY + 0.4, cz, 1.3, 4.5);
    m.light(0, LY + 3.4, cz, { intensity: 4, distance: 46, priority: 0.9, color: '#ffd08a', force: true });
    m.ceiling(0, LY + 6, cz, CX * 2 - 0.8, cd - 0.8, { axis: 'x', every: 2, solid: false });
    m.trim(0, LY + 6.0, cz, CX * 2 + 1.0, 0.4, cd + 1.0, 'edge');
    m.roof(0, LY + 6.4, cz, CX * 2, cd, 3.0, { flare: 1.0, overhang: 1.1, c: 'roof2' });
    m.roof(0, LY + 8.6, cz, CX * 2 - 4, cd - 4, 11, { kind: 'pyramid', overhang: 0.4, c: 'roof' });
    m.trim(0, LY + 19.4, cz, 0.16, 3.0, 0.16, 'metal', { layer: 'metal' });
    m.glow(0, LY + 22.2, cz, 0.45, 0.45, 0.45, 1.6);
    room('The Lantern Crown', 'the great lamp the Compact has never let go out', 0, cz, CX * 2, cd, LY + 0.4);

    // the crown stair: a turret against the tower's east face, entered from the Keepers'
    // Chair, winding up to the lantern gallery through the arcade on that side
    const tw = 4.4, tt = 0.6, TO = tw + tt * 2;
    const tx = CX + 0.05 + TO / 2, th = tw / 2 - 0.55, tz = -19.0 + th;
    m.footing(tx, tz, TO, TO, Y1, { solid: false, cap: false });
    const st = turretStair(m, tx, tz, tw, Y1, Y1 + TH + 0.4, { flight: 1.1, end: 0 });
    m.crownFlights = st.flights;
    const slits = (n) => Array.from({ length: n }, (_, i) => ({ u: 0, w: 0.35, y: 4 + i * 7.5, h: 1.3 }));
    m.shell(tx, tz, TO, TO, Y1, TH + 3.4, { t: tt, openings: {
      w: [{ u: -th, w: 1.1, h: 2.6 }, { u: st.corner[1], w: 1.1, y: TH + 0.4, h: 2.6, door: true }],
      e: slits(4), n: slits(4), s: slits(4),
    } });
    m.roof(tx, Y1 + TH + 3.4, tz, TO, TO, 3.4, { kind: 'pyramid', overhang: 0.35 });
    for (const yy of [6, 16, 26]) m.light(tx, Y1 + yy, tz, { intensity: 3, distance: 8, priority: 1.6 });
    m.shelter(tx, tz, TO, TO, Y1 - 0.2, Y1 + TH + 4);
    m.record = { ...(m.record || {}), crownStair: { x: tx, z: tz, w: tw, th, top: Y1 + TH + 0.4, exit: st.corner } };
  }

  // ---- the cloisters: arcaded galleries round a garden either side of the hall
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? HX : -21.5, x1 = side > 0 ? 21.5 : -HX;
    const z0 = CZ0 + (side > 0 ? 6.8 : 0.2), z1 = HZ1;
    const gw = 2.6, GY = Y1 + 5.0;
    const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
    // the garden: turf, a rill, two trees in stone planters
    m.trim(cxm, Y1 - 0.06, czm, x1 - x0 - gw * 2, 0.08, z1 - z0 - gw * 2, 'moss', { grad: 0 });
    m.trim(cxm, Y1 - 0.04, czm, 0.6, 0.06, z1 - z0 - gw * 2 - 2, '#5c7d86', { grad: 0 });
    for (const z of [czm - 6, czm + 6]) F.tree(m, cxm, Y1, z, { planter: true, blossom: side > 0 });
    // gallery arcades on the garden's long sides and ends, roofed walks behind them
    const inX = side > 0 ? x0 + gw : x1 - gw, outX = side > 0 ? x1 - gw : x0 + gw;
    for (const ax of [inX, outX]) m.at(ax, czm, Math.PI / 2, (mm) => arcadeRun(mm, -(z1 - z0) / 2 + gw, (z1 - z0) / 2 - gw, 0, Y1, 5, 3.2, GY, { depth: 0.6 }));
    for (const az of [z0 + gw, z1 - gw]) arcadeRun(m, Math.min(inX, outX), Math.max(inX, outX), az, Y1, 2, 3.2, GY, { depth: 0.6 });
    // the upper gallery deck round the court, a balustrade on its garden edge
    // [x0, x1, z0, z1] of each walk: the two ends, then the two long sides
    // the outer walk stops at the head of the cloister stair, which climbs under it from the end
    const stairN = Math.ceil((GY + 0.3 - Y1) / STEP - 1e-6), stairHead = z1 - gw - 0.2 - stairN * RUN;
    const outer = side > 0 ? [x1 - gw, x1] : [x0, x0 + gw], innerW = side > 0 ? [x0, x0 + gw] : [x1 - gw, x1];
    const ring4 = [[x0, x1, z0, z0 + gw], [x0, x1, z1 - gw, z1], [...innerW, z0 + gw, z1 - gw], [...outer, z0 + gw, stairHead]];
    for (const [a, b, c, e] of ring4) {
      m.floor((a + b) / 2, GY + 0.3, (c + e) / 2, Math.abs(b - a), Math.abs(e - c), 'stone', { t: 0.3 });
      m.ceiling((a + b) / 2, GY - 0.32, (c + e) / 2, Math.abs(b - a), Math.abs(e - c), { axis: 'x', every: 1.6, solid: false });
    }
    m.parapet(inX, z0 + gw, inX, z1 - gw, GY + 0.3, { t: 0.35, h: 1.0, c: 'stone2' });
    m.parapet(outX, z0 + gw, outX, z1 - gw, GY + 0.3, { t: 0.35, h: 1.0, c: 'stone2' });
    m.parapet(Math.min(inX, outX), z0 + gw, Math.max(inX, outX), z0 + gw, GY + 0.3, { t: 0.35, h: 1.0, c: 'stone2' });
    m.parapet(Math.min(inX, outX), z1 - gw, Math.max(inX, outX), z1 - gw, GY + 0.3, { t: 0.35, h: 1.0, c: 'stone2' });
    // a lean-to slate roof over the upper walk on the side-range side
    m.roof(side > 0 ? x1 - gw / 2 : x0 + gw / 2, GY + 3.2, czm, gw + 0.4, z1 - z0, 1.2, { kind: 'gable', overhang: 0.3 });
    // the cloister stair up to the gallery, against the court's front end
    m.stair(side > 0 ? x1 - gw / 2 : x0 + gw / 2, z1 - gw - 0.2, Math.PI, gw - 0.4, Y1, GY + 0.3, { run: 0.45, base: Y1 });
    for (let i = 0; i < 3; i++) F.bench(m, outX - side * 0.5, Y1, czm - 6 + i * 6, 2, { ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    lanternRow(m, outX + side * 1.3, z0 + 3, outX + side * 1.3, z1 - 3, GY - 0.32, 3, { drop: 0.8, intensity: 3.5, priority: 1.5, light: true });
    m.shelter(side > 0 ? x1 - gw / 2 : x0 + gw / 2, czm, gw, z1 - z0, Y1, GY + 4);
    room(side > 0 ? 'South Cloister' : 'North Cloister', 'a garden walk between the hall and the archive', cxm, czm, Math.abs(x1 - x0), z1 - z0, Y1);
  }
  // the lamp yard: the open corner of the podium between the crown stair and the rear range
  F.tree(m, 16.5, Y1, -18.6, { planter: true, h: 3.6 });
  F.bench(m, 16.5, Y1, -16.6, 2.2, { back: true, ry: Math.PI });

  // ---- lantern-keepers' dressing: banners on the façade, lamps on the parapets
  for (const sx of [-1, 1]) {
    m.banner(sx * 15.5, 4.0, 28.1, 2.2, 4.6, 'cloth', 0);
    for (const x of [12, 20]) m.lantern(sx * x, 4.75, 28.25, { post: 0, light: false });
  }
  m.banner(0, Y1 + 13, HZ1 + 0.5, 2.6, 6, 'accent', 0);

  // ---- records: the rooms, and the walks that must stay open through them
  const turret = [[8.2, -19.0], [8.2, -15.7], [11.5, -15.7], [11.5, -19.0]];
  const crownFlights = m.crownFlights ?? 24;
  const ROUTES = [
    { id: 'south stair', y0: s.terrace - s.y, points: [[24, 30.6], [20.3, 30.6], [13.9, 30.6], [11.3, 30.6], [5.6, 30.6], [0, 30.6]] },
    { id: 'north stair', y0: s.terrace - s.y, points: [[-24, 30.6], [-20.3, 30.6], [-13.9, 30.6], [-11.3, 30.6], [-5.6, 30.6], [0, 30.6]] },
    { id: 'gate to the Keepers\' Chair', y0: 0, points: [[0, 31], [0, 19], [4, 17], [4, 9.5], [0, 8.6], [0, 4], [0, -9], [0, -12.5], [3.6, -13], [3.6, -17.4]] },
    { id: 'hall to the cloister gallery and the hall gallery', y0: Y1, points: [[0, -1.9], [10.3, -1.9], [12.3, -1.9], [12.3, 3.5], [20.2, 3.6], [20.2, 2.5], [20.2, -6.5], [20.2, -13.4], [12.3, -13.4], [12.3, -8], [8.5, -8], [7.2, -8]] },
    { id: 'court to the guardroom', y0: 0, points: [[0, 18], [12.9, 18.5], [12.9, 19.9], [12.9, 22.5], [15, 22]] },
    { id: 'court to the kitchen', y0: 0, points: [[0, 18], [-15, 18], [-21, 14.1], [-23.5, 14.1], [-24.5, 11]] },
    { id: 'the crown stair to the lantern', y0: Y1, points: [[0, -15.5], [5.2, -19.0], ...Array.from({ length: crownFlights + 1 }, (_, k) => turret[k % 4]), [6.6, -19.0], [4.0, -19.0], [2.4, -16.1]] },
  ];
  const routes = ROUTES.map(r => ({ id: r.id, y0: s.y + r.y0, points: r.points.map(([x, z]) => m.point(x, 0, z)) }));
  rec.push({ id: s.id, name: 'The Lantern Palace', rooms, routes, group: m.g, frame: m.f });
  add(m.build());
  exclusions.push({ x: s.x, z: s.z, r: 42 });
  return { rooms };
}

// ---------------------------------------------------------------- the Chain Citadel
// The Enclave's seat on the Meridian bastion: brick ranges with grey dressings
// round a quarterdeck yard, barracks wings for the captains and halberdiers, the Vice Warden's
// Hall and throne, the War and Chart Room under the Signal Crown, and roof terraces that
// walk the whole square. Local frame: +z faces the parade ground (north), datum the rock.
export function buildEnclavePalace(world, s, exclusions, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.yaw, y: s.y, palette: 'enclave', tag: s.id, name: 'The Chain Citadel', lights: 40 });
  const Y1 = 1.8, H = 8.8, TY = H + 0.35; // podium, range height, terrace walk
  const rooms = [];
  const room = (name, use, x, z, w, d, y) => rooms.push({ name, use, at: m.point(x, y, z), w, d });
  const chainDevice = (mm, x, y, z) => {
    // the Enclave's device: a chain of three links over an anchor stock
    for (let i = 0; i < 3; i++) mm.trim(x, y + 0.2 + i * 0.36, z, i % 2 ? 0.1 : 0.34, 0.3, i % 2 ? 0.34 : 0.1, 'brass', { layer: 'metal' });
    mm.trim(x, y + 1.3, z, 0.9, 0.12, 0.12, 'brass', { layer: 'metal' });
  };

  // ---- the gatehouse onto the parade ground
  {
    const g = new THREE.Group();
    const p = m.point(0, 0, 28);
    g.position.copy(p); g.rotation.y = s.yaw + Math.PI;
    buildGatehouse(world, { x: p.x, z: p.z, rot: s.yaw + Math.PI, palette: 'enclave', tag: s.id, name: 'The Chain Gate',
      pw: 3.0, spring: 4.8, depth: 8, tx: 8.2, tw: 6.2, td: 8.6, walk: TY, lookout: false, beacon: true, lightInside: true }, g);
    add(g);
    room('The Chain Gate', 'the gate the parade ground marches through', 0, 28, 6, 8, 0);
  }

  // ---- the front range: the guardhouse and the writ office either side of the gate
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? 11.4 : -31, x1 = side > 0 ? 31 : -11.4, cx = (x0 + x1) / 2;
    range(m, x0, x1, 24, 32, 0, {
      style: 'brick', roof: 'terrace', parapets: [['n', true], ['s', false]], extend: side > 0 ? { e: 1.4 } : { w: 1.4 },
      ground: { s: [{ u: -side * 4, w: 2.2, h: 3.0 }, { u: side * 3, w: 1.2, y: 1.1, h: 1.8 }, { u: side * 7, w: 1.2, y: 1.1, h: 1.8 }],
        n: [{ u: -4, w: 0.5, y: 1.4, h: 1.6 }, { u: 4, w: 0.5, y: 1.4, h: 1.6 }] },
      upper: { s: [{ u: -5, w: 1.2, y: 1, h: 1.9 }, { u: 0, w: 1.2, y: 1, h: 1.9 }, { u: 5, w: 1.2, y: 1, h: 1.9 }], n: [{ u: -4, w: 0.5, y: 1, h: 1.6 }, { u: 4, w: 0.5, y: 1, h: 1.6 }] },
      well: { x: cx + side * 6.6, z: 29.6, w: 1.6, d: 4.2, len: 4.2, dir: Math.PI },
    });
    if (side > 0) {
      F.rack(m, cx + 2, 0, 31.1, 3, { ry: Math.PI }); F.rack(m, cx - 2, 0, 31.1, 3, { ry: Math.PI });
      F.table(m, cx - 2, 0, 27, 2.4, 1.1, { cloth: 'cloth' }); F.bench(m, cx - 2, 0, 26.1, 2.2); F.bench(m, cx - 2, 0, 27.9, 2.2, { ry: Math.PI });
      F.hearth(m, x1 - 1.05, 0, 28, { ry: -Math.PI / 2, w: 1.6, h: 2.6 });
      for (let i = 0; i < 4; i++) F.bunk(m, x0 + 1.8 + i * 2.6, 4.6, 30.4, { ry: Math.PI });
      m.light(cx, 4.6 + 2.4, 28, { intensity: 3.5, distance: 11, priority: 1.6 });
      room('Guardhouse', 'the gate watch: their pikes, their fire, their bunks above', cx, 28, x1 - x0, 8, 0);
    } else {
      F.counter(m, cx + 1, 0, 26.4, 5, { goodsC: 'plaster' });
      for (let i = 0; i < 3; i++) F.shelves(m, x0 + 2.5 + i * 3.4, 0, 31.1, 3, 2.6, { ry: Math.PI, goods: ['plaster', 'edge', 'cushion', 'brass'] });
      F.table(m, cx - 3, 4.6, 28, 2.2, 1.1); F.chair(m, cx - 3, 4.6, 27.1);
      F.shelves(m, x0 + 2, 4.6, 31.1, 3, 2.2, { ry: Math.PI });
      m.hanging(cx, 4.3, 28, 0.9, { intensity: 4, priority: 1.7 });
      m.light(cx, 4.6 + 2.4, 28, { intensity: 3.2, distance: 11, priority: 1.6 });
      room('Writ Office', 'where a stranger is counted, papered and given a number', cx, 28, x1 - x0, 8, 0);
    }
  }

  // ---- the corner towers: fighting tops on the terrace walk; the ring meets the rear two
  const ring = { id: 'meridian_ring', name: 'Chain Citadel', palette: 'enclave', tower: { R: 5.2, roof: 'flat' } };
  const towerAt = (lx, lz, heads) => {
    const p = m.point(lx, 0, lz);
    add(buildWallTower(world, ring, p.x, p.z, s.y + TY, heads.map(h => h + s.yaw), s.id, exclusions));
  };
  towerAt(36, 28, [-Math.PI / 2, Math.PI]);
  towerAt(-36, 28, [Math.PI / 2, Math.PI]);
  towerAt(36, -29, [0, -Math.PI / 2]);
  towerAt(-36, -29, [0, Math.PI / 2]);

  // ---- the barracks wings
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? 31 : -40.2, x1 = side > 0 ? 40.2 : -31, cx = (x0 + x1) / 2;
    // the north end meets the front range's corner (that range starts at z 24), and the terrace
    // walk still runs on to 24.6, onto the front range's
    const z0 = -23.6, z1 = 24, cz = (z0 + z1) / 2;
    const inner = side > 0 ? 'w' : 'e', outer = side > 0 ? 'e' : 'w';
    range(m, x0, x1, z0, z1, 0, {
      style: 'brick', roof: 'terrace', parapets: [[outer, true], [inner, false]], extend: { n: 0.6, s: 1.4 },
      ground: { [inner]: [{ u: 10.5, w: 2.4, h: 3.0 }, { u: 18, w: 2.2, h: 3.0 }, { u: 14, w: 1.2, y: 1.1, h: 1.8 }, { u: 6, w: 1.2, y: 1.1, h: 1.8 }],
        [outer]: [-18, -12, -6, 0, 6, 12, 18].map(u => ({ u, w: 0.45, y: 1.6, h: 1.4 })) },
      upper: { [inner]: [-6, 0, 6, 12, 18].map(u => ({ u, w: 1.2, y: 1, h: 1.9 })), [outer]: [-15, -5, 5, 15].map(u => ({ u, w: 0.5, y: 1, h: 1.6 })) },
      well: { x: cx, z: z1 - 3.1, w: 1.6, d: 4.4, len: 4.4, dir: 0 },
    });
    // bunks down the outer wall, arms racks and the mess table by the door
    const wallX = side > 0 ? x1 - 1.45 : x0 + 1.45;
    for (let i = 0; i < 8; i++) F.bunk(m, wallX, 0, z0 + 2.2 + i * 2.6, { ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    F.table(m, cx - side * 1.6, 0, 12, 1.2, 6, { cloth: 'cloth' });
    F.bench(m, cx - side * 0.7, 0, 12, 5.6, { ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    F.rack(m, cx - side * 3.6, 0, 3.5, 3, { ry: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    F.rack(m, cx - side * 3.6, 0, -4, 3, { ry: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    for (let i = 0; i < 6; i++) F.bunk(m, wallX, 4.6, z0 + 3 + i * 3.4, { ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    lanternRow(m, cx - side * 1.6, z0 + 3, cx - side * 1.6, z1 - 6, 4.3, 3, { drop: 0.8, intensity: 4, priority: 1.6, distance: 16 });
    m.light(cx, 4.6 + 2.4, cz, { intensity: 3.5, distance: 16, priority: 1.5 });
    room(side > 0 ? "Captains' Barracks" : "Halberdiers' Barracks", side > 0 ? 'the captains of the Patient Crown and the Writ of Iron, between voyages' : 'the halberdiers who hold the bastion’s gates', cx, cz, x1 - x0, z1 - z0, 0);
  }

  // ---- the rear range on the south curtain: the Vice Warden's quarters over the strongroom
  {
    // The podium runs up to the range's north face, so its two ground doors open at the
    // podium's height (Y1): a landing inside each and a stair down to the strongroom floor.
    const r = range(m, -31, 31, -32.6, -25.6, 0, {
      style: 'brick', roof: 'terrace', parapets: [['s', true], ['n', false, [[1.8, 3.8], [58.2, 60.2]]]], extend: { e: 1.4, w: 1.4 },
      ground: { n: [-16, 16].map(u => ({ u, w: 2.2, y: Y1, h: 2.4, door: true })), s: [-24, -14, -4, 4, 14, 24].map(u => ({ u, w: 0.45, y: 1.8, h: 1.4 })) },
      upper: { n: [-22, -16, 16, 22].map(u => ({ u, w: 1.2, y: 1, h: 1.9 })), s: [-20, -10, 10, 20].map(u => ({ u, w: 1.2, y: 1, h: 1.9, lit: true })) },
      well: { x: -26, z: -29.1, w: 4.4, d: 1.6, len: 4.4, dir: Math.PI / 2 },
    });
    for (const sx of [-1, 1]) {
      const zw = -26.3, zl = -27.6; // the landing: from the wall's inner face to the stair head
      m.landing(sx * 16, (zw + zl) / 2, 2.4, zw - zl, Y1);
      m.stair(sx * 16, zl - Math.ceil(Y1 / STEP - 1e-6) * RUN, 0, 2.2, 0, Y1, { run: RUN, c: 'stone' });
      for (const e of [-1, 1]) m.rail(sx * 16 + e * 1.15, zl, sx * 16 + e * 1.15, zw - 0.05, Y1, { c: 'metal' });
    }
    for (let i = 0; i < 5; i++) F.crate(m, 12 + i * 1.1, 0, -31.6, 0.9);
    F.barrel(m, 18, 0, -29); F.barrel(m, 19, 0, -29.6);
    F.shelves(m, 22, 0, -31.9, 3, 2.4, { goods: ['brass', 'metal', 'edge'] });
    room('Strongroom', 'the fleet’s pay chests and the Grand Warden’s sealed orders', 18, -29, 10, 7, 0);
    F.bed(m, -12, r.y1, -30.6, { w: 1.8, len: 2.4, ry: 0, blanket: 'cushion' });
    F.table(m, -6, r.y1, -29, 2.2, 1.1, { cloth: 'cloth' }); F.chair(m, -6, r.y1, -29.9);
    F.shelves(m, -2, r.y1, -31.9, 3, 2.2, { goods: ['brass', 'plaster', 'cushion'] });
    F.hearth(m, -18, r.y1, -31.95, { ry: 0, w: 1.6 });
    F.rug(m, -9, r.y1, -29, 5, 2.6, { c: 'cushion', c2: 'brass' });
    room("Vice Warden's Quarters", 'where the Vice Warden sleeps above the pay of a fleet', -9, -29, 14, 7, r.y1);
  }

  // ---- the quarterdeck yard: a mast with signal halyards, the anchor of the first fleet
  {
    const z0 = 4.2, z1 = 23.8, zc = (z0 + z1) / 2;
    m.floor(0, 0.06, zc, 62, z1 - z0, 'floor', { t: 0.5 });
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) m.trim(-27.5 + i * 5, 0.04, z0 + 2.4 + j * 5, 4.8, 0.05, 4.8, (i + j) % 2 ? 'floor' : 'stone2', { grad: 0 });
    // the mast: a stepped stone foot, a tall spar, yards and the halyards' cleats
    m.k.prism(0, 0, zc, 1.8, 0.6, 'stone2', { sides: 8 });
    m.k.prism(0, 0.6, zc, 1.3, 0.5, 'stone', { sides: 8 });
    m.pillar(0, 0, zc, 1.6, 1.1);
    m.k.prism(0, 1.1, zc, 0.28, 18, 'dark', { sides: 8, top: 0.55 });
    for (const [y, w] of [[12, 7], [16, 4.6]]) m.trim(0, 1.1 + y, zc, w, 0.22, 0.22, 'dark');
    for (const sx of [-1, 1]) {
      m.banner(sx * 3.2, 1.1 + 12 - 3.2, zc, 1.4, 3, 'cloth', Math.PI / 2);
      m.trim(sx * 1.1, 1.1, zc, 0.06, 11.2, 0.06, 'metal', { layer: 'metal' });
    }
    // the anchor: stock, shank and flukes in iron on a plinth
    m.block(0, 0, zc + 6, 3.6, 0.7, 1.8, 'stone2', { walkable: false });
    m.trim(0, 0.7, zc + 6, 0.4, 3.4, 0.4, 'metal', { layer: 'metal' });
    m.trim(0, 3.6, zc + 6, 2.8, 0.3, 0.3, 'metal', { layer: 'metal' });
    for (const sx of [-1, 1]) m.trim(sx * 0.8, 0.7, zc + 6, 1.4, 0.32, 0.36, 'metal', { layer: 'metal', rz: sx * 0.5 });
    for (const sx of [-1, 1]) for (const z of [z0 + 2, z1 - 2]) F.lanternStand(m, sx * 9, 0, z, { post: 2.6, light: z > zc && sx > 0, intensity: 1.6 });
    room('Quarterdeck Yard', 'where the watch is mustered under the mast and the first anchor', 0, zc, 62, z1 - z0, 0);
  }

  // ---- the podium and its stair
  m.footing(0, -11, 62, 30, Y1, { cap: false, c: 'stone2' });
  m.trim(0, Y1 - 0.2, 4.1, 62.2, 0.2, 0.5, 'edge');
  m.stair(0, 4.0 + Math.ceil(Y1 / STEP - 1e-6) * RUN, Math.PI, 14, 0, Y1, { run: RUN, c: 'stone' });
  for (const sx of [-1, 1]) {
    m.parapet(sx * 7.3, 4.4, sx * 30.6, 4.4, Y1, { t: 0.4, h: 0.95 });
    m.block(sx * 7.3, 0, 5.6, 0.9, Y1 + 1.4, 2.8, 'stone', { walkable: false });
    m.lantern(sx * 7.3, Y1 + 1.4, 5.6, { post: 0.9, light: false });
  }

  // ---- the Vice Warden's Hall
  const HX = 12, HZ0 = -14, HZ1 = 4, HH = 12;
  {
    const hz = (HZ0 + HZ1) / 2, hd = HZ1 - HZ0;
    m.floor(0, Y1, hz, HX * 2 - 1, hd - 1, 'floor', { t: 0.2 });
    const tall = (u) => ({ u, w: 1.3, y: 4.2, h: 5.4, lit: true, mullion: true });
    m.shell(0, hz, HX * 2, hd, Y1, HH, {
      t: 0.9, style: 'brick',
      openings: {
        n: [{ u: 0, w: 3.6, h: 5.4 }, tall(-6.5), tall(6.5)],
        s: [{ u: -4.2, w: 1.8, h: 3.2 }, { u: 4.2, w: 1.8, h: 3.2 }],
        e: [{ u: 0, w: 2.2, h: 3.0 }, tall(-5), tall(5)],
        w: [{ u: 0, w: 2.2, h: 3.0 }, tall(-5), tall(5)],
      },
    });
    m.doorArch(0, Y1 + 5.4, HZ1 + 0.2, 3.8, 0, { t: 0.45, depth: 0.5, pointed: false, c: 'stone' });
    for (const sx of [-1, 1]) for (const z of [HZ0 + 0.6, -5, 1.0, HZ1 - 0.6]) m.trim(sx * (HX + 0.12), Y1, z, 0.24, HH, 0.9, 'stone');
    // the hall: a nave between two rows of iron-banded columns, chains hung from the beams
    for (const sx of [-1, 1]) for (const z of [-10, -5, 0]) {
      m.column(sx * 6, Y1, z, 9.6, 0.45, { sides: 8, c: 'stone' });
      for (const yy of [2.5, 6.5]) m.k.prism(sx * 6, Y1 + yy, z, 0.5, 0.14, 'metal', { sides: 8, layer: 'metal' });
    }
    for (const sx of [-1, 1]) for (const z of [-10, -5, 0]) {
      for (let i = 0; i < 6; i++) m.trim(sx * 3, Y1 + HH - 0.6 - i * 0.42, z + 0.5, i % 2 ? 0.08 : 0.28, 0.36, i % 2 ? 0.28 : 0.08, 'metal', { layer: 'metal' });
    }
    m.ceiling(0, Y1 + HH - 0.3, hz, HX * 2 - 1.8, hd - 1.8, { axis: 'z', every: 2.6 });
    m.trim(0, Y1 + HH, hz, HX * 2 + 0.6, 0.35, hd + 0.6, 'stone');
    m.roof(0, Y1 + HH + 0.35, hz, HX * 2 + 0.2, hd + 0.2, 6.4, { overhang: 0.6, c: 'roof', c2: 'roof2' });
    // the Vice Warden's chair of state on its dais, the fleet's banners behind it, the council either side
    F.throne(m, 0, Y1, HZ0 + 2.2, { w: 5.2, steps: 3, cushion: 'cushion', back: 3.8, c: 'stone', device: chainDevice });
    for (const sx of [-1, 1]) {
      m.banner(sx * 2.4, Y1 + 4.4, HZ0 + 0.55, 1.6, 5.2, 'cloth', 0);
      F.brazier(m, sx * 3.6, Y1, -8.6, { light: sx > 0, intensity: 5, distance: 18 });
      // the council's benches against the side walls, clear of the cross-aisle to the doors
      for (let i = 0; i < 3; i++) F.chair(m, sx * 10.6, Y1, -12.4 + i * 1.4, { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
      F.table(m, sx * 9.6, Y1, -11, 0.8, 4, { cloth: 'cloth' });
      F.bench(m, sx * 10.7, Y1, 1.6, 3.4, { back: true, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
    F.rug(m, 0, Y1, -3.5, 2.6, 14, { c: 'cushion', c2: 'brass' });
    lanternRow(m, 0, HZ0 + 3, 0, HZ1 - 2, Y1 + HH - 0.3, 3, { drop: 3.4, light: false });
    m.light(0, Y1 + 5, -4, { intensity: 7, distance: 24, priority: 2.2 });
    m.shelter(0, hz, HX * 2, hd, Y1 - 0.2, Y1 + HH + 0.3);
    room("The Vice Warden's Hall", 'where the Vice Warden sits to read the Grand Warden’s writs aloud', 0, hz, HX * 2, hd, Y1);
  }

  // ---- the War and Chart Room under the Signal Crown
  const CX = 7, CZ0 = -25.6, CZ1 = HZ0, TH = 30;
  {
    const cz = (CZ0 + CZ1) / 2, cd = CZ1 - CZ0;
    m.floor(0, Y1, cz, CX * 2 - 1.6, cd - 1.6, 'floor', { t: 0.2 });
    m.shell(0, cz, CX * 2, cd, Y1, TH, {
      t: 1.0, style: 'brick',
      openings: {
        n: [{ u: -4.2, w: 1.8, h: 3.2 }, { u: 4.2, w: 1.8, h: 3.2 }, { u: 0, w: 1.4, y: HH + 3, h: 3, lit: true }, { u: 0, w: 1.4, y: HH + 10, h: 3, lit: true }],
        s: [{ u: 0, w: 1.4, y: 13, h: 3, lit: true }, { u: 0, w: 1.4, y: 21, h: 3, lit: true }],
        e: [{ u: -2.4, w: 1.6, h: 3.0 }, { u: 2.5, w: 1.0, y: 13, h: 2.6, lit: true }, { u: -2.5, w: 1.0, y: 21, h: 2.6, lit: true }],
        w: [{ u: 0, w: 1.2, y: 3.6, h: 2.6, lit: true }, { u: -2.5, w: 1.0, y: 13, h: 2.6, lit: true }, { u: 2.5, w: 1.0, y: 21, h: 2.6, lit: true }],
      },
    });
    for (const yy of [HH + 0.4, 19, 25.5]) m.trim(0, Y1 + yy, cz, CX * 2 + 0.5, 0.35, cd + 0.5, 'stone');
    // the great chart: the whole Anchorage on one table, the fleet in brass on it
    F.chartTable(m, 0, Y1, cz + 0.6, 5.2, 3.2, { c: 'wood' });
    for (let i = 0; i < 7; i++) m.k.prism(-1.8 + i * 0.6, Y1 + 0.92, cz + 0.6 + ((i * 5) % 3 - 1) * 0.6, 0.08, 0.16, 'brass', { sides: 4, layer: 'metal' });
    for (const sx of [-1, 1]) for (const dz of [-1.0, 0, 1.0]) F.chair(m, sx * 3.2, Y1, cz + 0.6 + dz, { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
    F.shelves(m, -CX + 1.4, Y1, cz - 1.5, 3.4, 2.6, { ry: Math.PI / 2, goods: ['plaster', 'edge', 'brass'] });
    F.shelves(m, 0, Y1, CZ0 + 1.45, 4.4, 2.8, { goods: ['plaster', 'edge', 'cushion'] });
    F.lanternStand(m, -CX + 1.6, Y1, CZ1 - 1.6, { post: 2.6, light: false });
    m.light(0, Y1 + 4, cz, { intensity: 6, distance: 15, priority: 2.2 });
    m.ceiling(0, Y1 + 9.5, cz, CX * 2 - 2, cd - 2, { axis: 'x', every: 2.2 });
    // the tower keeps the rain out up to the Signal Crown's floor; the crown itself is open
    m.shelter(0, cz, CX * 2, cd, Y1 - 0.2, Y1 + TH - 0.4);
    room('War and Chart Room', 'the Anchorage on one table, and the Enclave’s fleet in brass upon it', 0, cz, CX * 2, cd, Y1);
    for (const fy of [14.6, 21.6]) {
      m.floor(0, Y1 + fy, cz, CX * 2 - 2, cd - 2, 'wood', { t: 0.3 });
      m.ceiling(0, Y1 + fy - 0.3, cz, CX * 2 - 2, cd - 2, { axis: 'x', every: 2, solid: false });
      F.shelves(m, -CX + 1.4, Y1 + fy, cz, 4, 2.4, { ry: Math.PI / 2, goods: ['cloth', 'brass', 'edge'] });
      m.light(0, Y1 + fy + 2.2, cz, { intensity: 2.6, distance: 8, priority: 1.5 });
    }
    // the Signal Crown: an open fighting top, the beacon brazier and the semaphore mast
    const LY = Y1 + TH;
    m.floor(-0.8, LY + 0.4, cz, CX * 2 + 1.8, cd + 3.4, 'stone', { t: 0.8 });
    const tw = 4.4, TO = tw + 1.2, tx = CX + 0.05 + TO / 2, th = tw / 2 - 0.55, tz = -22.4 + th;
    const tz0 = tz - TO / 2 - 0.05, tz1 = tz + TO / 2 + 0.05, gz0 = cz - cd / 2 - 1.7, gz1 = cz + cd / 2 + 1.7;
    m.floor(CX + 0.85, LY + 0.4, (gz0 + tz0) / 2, 1.7, tz0 - gz0, 'stone', { t: 0.8 });
    m.floor(CX + 0.85, LY + 0.4, (tz1 + gz1) / 2, 1.7, gz1 - tz1, 'stone', { t: 0.8 });
    for (let i = 0; i < 9; i++) m.trim(-CX - 1.3 + i * (CX * 2 + 2.6) / 8, LY - 1.2, gz1 - 0.3, 0.6, 1.2, 0.8, 'stone');
    const edge = (ax, az, bx, bz) => { m.parapet(ax, az, bx, bz, LY + 0.4, { t: 0.5, h: 1.1, c: 'stone' }); m.k.crenels(ax, az, bx, bz, LY + 1.5, 0.5, { c: 'stone', h: 0.9 }); };
    edge(-CX - 1.5, gz0 + 0.2, CX + 1.5, gz0 + 0.2);
    edge(-CX - 1.5, gz1 - 0.2, CX + 1.5, gz1 - 0.2);
    edge(-CX - 1.5, gz0 + 0.2, -CX - 1.5, gz1 - 0.2);
    edge(CX + 1.5, gz0 + 0.2, CX + 1.5, tz0);
    edge(CX + 1.5, tz1, CX + 1.5, gz1 - 0.2);
    // the beacon: a great iron basket on a stone drum, lit for the fleet to read at sea
    m.k.prism(0, LY + 0.4, cz, 1.8, 1.0, 'stone', { sides: 8 });
    m.pillar(0, LY + 0.4, cz, 1.8, 1.6);
    m.k.prism(0, LY + 1.4, cz, 1.6, 0.9, 'metal', { sides: 8, top: 1.25, layer: 'metal' });
    m.glow(0, LY + 2.1, cz, 2.4, 0.7, 2.4, 1.6, 'ember');
    m.light(0, LY + 2.6, cz, { intensity: 5, distance: 48, priority: 0.9, color: '#ff9a4a', force: true, flicker: true });
    // the semaphore mast with its two arms, the Enclave's ensign at the head
    m.trim(-CX + 1.6, LY + 0.4, cz - 3, 0.3, 12, 0.3, 'dark');
    m.pillar(-CX + 1.6, LY + 0.4, cz - 3, 0.3, 12);
    for (const [yy, a] of [[8.5, 0.7], [11, -0.5]]) m.trim(-CX + 1.6 + Math.cos(a) * 1.4, LY + 0.4 + yy + Math.sin(a) * 1.4, cz - 3, 2.8, 0.3, 0.2, 'dark', { rz: a });
    m.banner(-CX + 2.4, LY + 9, cz - 3, 1.6, 2.6, 'cloth', Math.PI / 2);
    room('The Signal Crown', 'the beacon and the semaphore that speak to the fleet at sea', 0, cz, CX * 2, cd, LY + 0.4);
    // its stair turret, entered from the chart room
    m.footing(tx, tz, TO, TO, Y1, { solid: false, cap: false });
    const st = turretStair(m, tx, tz, tw, Y1, LY + 0.4, { flight: 1.1, end: 0 });
    m.shell(tx, tz, TO, TO, Y1, TH + 3.2, { t: 0.6, style: 'brick', openings: {
      w: [{ u: -th, w: 1.1, h: 2.6 }, { u: st.corner[1], w: 1.1, y: TH + 0.4, h: 2.6, door: true }],
      e: [0, 1, 2, 3].map(i => ({ u: 0, w: 0.35, y: 4 + i * 7, h: 1.3 })), s: [0, 1, 2, 3].map(i => ({ u: 0, w: 0.35, y: 6 + i * 7, h: 1.3 })),
    } });
    m.roof(tx, Y1 + TH + 3.2, tz, TO, TO, 2.4, { kind: 'pyramid', overhang: 0.3 });
    for (const yy of [6, 15, 24]) m.light(tx, Y1 + yy, tz, { intensity: 3, distance: 8, priority: 1.6 });
    m.shelter(tx, tz, TO, TO, Y1 - 0.2, Y1 + TH + 4);
    m.crown = { flights: st.flights, corners: [[tx - th, tz - th], [tx - th, tz + th], [tx + th, tz + th], [tx + th, tz - th]] };
  }

  // ---- the side rooms on the podium: the officers' mess (west) and the signal office (east)
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? 13 : -30.3, x1 = side > 0 ? 30.3 : -13, cx = (x0 + x1) / 2, z0 = -13.5, z1 = 3.6, cz = (z0 + z1) / 2;
    const toHall = side > 0 ? 'w' : 'e';
    m.floor(cx, Y1, cz, x1 - x0 - 0.1, z1 - z0 - 0.1, 'floor', { t: 0.2 });
    m.shell(cx, cz, x1 - x0, z1 - z0, Y1, 6.4, { t: 0.7, style: 'brick', openings: {
      n: [{ u: side * 4, w: 1.2, y: 1.2, h: 2.2, lit: true }, { u: -side * 3, w: 1.2, y: 1.2, h: 2.2, lit: true }],
      [toHall]: [{ u: -5 - cz, w: 2.2, h: 3.0 }],
      s: [{ u: side * 5, w: 2.0, h: 3.0 }, { u: -side * 3, w: 1.4, y: 1.2, h: 2.2, lit: true }],
    } });
    m.ceiling(cx, Y1 + 6.1, cz, x1 - x0 - 1.4, z1 - z0 - 1.4, { axis: 'x', every: 2 });
    m.roof(cx, Y1 + 6.4, cz, x1 - x0, z1 - z0, 3.4, { overhang: 0.5 });
    m.shelter(cx, cz, x1 - x0, z1 - z0, Y1 - 0.2, Y1 + 6.6);
    if (side < 0) {
      F.table(m, cx, Y1, cz, 2, 9, { cloth: 'cloth' });
      for (let i = 0; i < 6; i++) for (const e of [-1, 1]) F.chair(m, cx + e * 1.3, Y1, cz - 3.75 + i * 1.5, { ry: e > 0 ? -Math.PI / 2 : Math.PI / 2 });
      F.hearth(m, x0 + 1.05, Y1, cz, { ry: Math.PI / 2, w: 2.2, h: 2.8 });
      F.shelves(m, cx, Y1, z0 + 1.1, 4, 2.2, { goods: ['brass', 'glow', 'plaster'] });
      m.light(cx, Y1 + 3.6, cz, { intensity: 4.5, distance: 14, priority: 1.9 });
      room("Officers' Mess", 'the captains of the line at table, toasting the Grand Warden', cx, cz, x1 - x0, z1 - z0, Y1);
    } else {
      for (let i = 0; i < 3; i++) { F.table(m, cx - 4 + i * 4, Y1, cz - 2, 1.8, 1.0); F.chair(m, cx - 4 + i * 4, Y1, cz - 2.9); }
      F.shelves(m, x1 - 1.0, Y1, cz, 6, 2.8, { ry: -Math.PI / 2, goods: ['plaster', 'edge', 'plaster', 'brass'] });
      for (let i = 0; i < 4; i++) m.lantern(cx - 6 + i * 4, Y1 + 0.82, cz + 3.2, { post: 0, light: false, glow: i % 2 ? 'glow' : 'ember' });
      F.table(m, cx, Y1, cz + 3.2, 14, 0.9);
      m.light(cx, Y1 + 3.6, cz, { intensity: 4.5, distance: 14, priority: 1.9 });
      room('Signal Office', 'where the beacon’s messages are written, coded and sent', cx, cz, x1 - x0, z1 - z0, Y1);
    }
  }

  // ---- the light courts behind the side rooms, and their stairs to the terrace walk
  for (const side of [-1, 1]) {
    const x = side * 28.6;
    m.stair(x, -14.4, Math.PI, 1.6, Y1, TY, { run: RUN, cheeks: 1.0, base: Y1 });
    F.tree(m, side * 19, Y1, -20, { planter: true, h: 3.8 });
    F.bench(m, side * 22, Y1, -17, 2.4, { back: true, ry: Math.PI });
  }

  // ---- dressing: ensigns on the front towers, lamps along the parapets
  for (const sx of [-1, 1]) {
    m.banner(sx * 21, 3.6, 32.1, 2.4, 5, 'cloth', 0);
    for (const x of [15, 27]) m.lantern(sx * x, 4.9, 32.3, { post: 0, light: false });
  }
  m.banner(0, Y1 + HH - 3, HZ1 + 0.5, 3, 6, 'cloth', 0);

  // ---- records and walks
  const c = m.crown.corners;
  const ROUTES = [
    { id: 'gate to the Admiral’s Throne', y0: 0, points: [[0, 35], [0, 23], [3.8, 21.4], [4, 16], [4, 9], [0, 8], [0, 3.5], [0, -6], [0, -9.6]] },
    { id: 'hall to the chart room', y0: Y1, points: [[0, -6], [5, -7], [4.6, -12.5], [4.2, -14.6], [4.2, -16.6], [2, -17]] },
    { id: 'the crown stair to the beacon', y0: Y1, points: [[3, -20.5], [5.0, c[0][1]], [6.6, c[0][1]], ...Array.from({ length: m.crown.flights + 1 }, (_, k) => c[k % 4]), [6.4, c[0][1]], [4, c[0][1]], [3, -17]] },
    { id: 'yard to the captains’ barracks', y0: 0, points: [[4, 11], [26, 11], [30.6, 10.3], [33, 10.3], [33, 4]] },
    { id: 'light court to the terrace walk', y0: Y1, points: [[20, -4.5], [27.3, -4.5], [27.3, -14.0], [28.6, -14.0], [28.6, -25.4], [28.6, -27.4], [29.4, -29], [36, -29], [36, -24.5], [35.6, -12]] },
    ...[-1, 1].flatMap(sx => [
      { id: `podium down into the strongroom range (${sx > 0 ? 'east' : 'west'} door)`, y0: Y1, points: [[sx * 16, -21], [sx * 16, -27], [sx * 16, -30.6], [sx * 14, -30.6]] },
      { id: `strongroom range back up to the podium (${sx > 0 ? 'east' : 'west'} door)`, y0: 0, points: [[sx * 14, -30.6], [sx * 16, -30.6], [sx * 16, -27], [sx * 16, -21]] },
    ]),
  ];
  const routes = ROUTES.map(r => ({ id: r.id, y0: s.y + r.y0, points: r.points.map(([x, z]) => m.point(x, 0, z)) }));
  (world.palaces ||= []).push({ id: s.id, name: 'The Chain Citadel', rooms, routes, group: m.g, frame: m.f });
  add(m.build());
  exclusions.push({ x: s.x, z: s.z, r: 46 });
  return { rooms };
}
