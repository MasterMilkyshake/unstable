// The smaller faction seats, laid by the mason (world/mason.js) in each faction's palette:
//
//   the Sounding House  the Ministry of Soundings on the Hush's summit table: a walled
//                       precinct entered by the Quiet Gate at the head of the Ministry
//                       Stair, the Sounding Tower over the Hall of Soundings, the Listening
//                       Room's gallery and the Sounder's loft; the Office, the Quiet Archive
//                       and the clerks' lodging round its court (vernacular halls)
//
// Each records its rooms and the routes a walker takes through it (world.seats).
import * as THREE from 'three';
import { Mason, RISE } from './mason.js';
import * as F from './furnishing.js';
import { buildApproach } from './approaches.js';
import { buildTerraceStair } from './civic.js';

// A pent roof round a storey: a sloped ring of tiles from a wall face (half-size i at y1)
// down to the eaves (half-size o at y0), with its soffit and fascia and nothing inside it.
function skirt(m, ix, iz, y1, ox, oz, y0, c = 'roof') {
  const v = [];
  const q = (a, b, e, d) => v.push(...a, ...b, ...e, ...a, ...e, ...d);
  const I = [[-ix, -iz], [ix, -iz], [ix, iz], [-ix, iz]], O = [[-ox, -oz], [ox, -oz], [ox, oz], [-ox, oz]];
  const f = 0.2;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const ia = [I[i][0], y1, I[i][1]], ib = [I[j][0], y1, I[j][1]];
    const oa = [O[i][0], y0, O[i][1]], ob = [O[j][0], y0, O[j][1]];
    const oa2 = [oa[0], y0 - f, oa[2]], ob2 = [ob[0], y0 - f, ob[2]];
    const ia2 = [ia[0], y1 - f - 0.12, ia[2]], ib2 = [ib[0], y1 - f - 0.12, ib[2]];
    q(ia, ib, ob, oa);    // the tiles, facing up and out
    q(oa2, ob2, ib2, ia2); // the soffit
    q(oa, ob, ob2, oa2);   // the fascia
  }
  m.k.emit(new Float32Array(v), new THREE.Matrix4(), c, { grad: 0 });
  if (m.snowRoofs) {
    // snow lies on the upper slope of the tiles, short of the eaves
    const s = [];
    const t = 0.7, lift = 0.1, sy = y1 + (y0 - y1) * t + lift;
    const S = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * (ix + (ox - ix) * t), b * (iz + (oz - iz) * t)]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const a = [I[i][0], y1 + lift, I[i][1]], b = [I[j][0], y1 + lift, I[j][1]];
      s.push(...a, ...b, S[j][0], sy, S[j][1], ...a, S[j][0], sy, S[j][1], S[i][0], sy, S[i][1]);
    }
    m.k.emit(new Float32Array(s), new THREE.Matrix4(), 'snow', { grad: 0 });
  }
  // corner ridges where the slopes meet
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const ax = sx * ix, az = sz * iz, bx = sx * ox, bz = sz * oz;
    const len = Math.hypot(bx - ax, y0 - y1, bz - az), mid = [(ax + bx) / 2, (y1 + y0) / 2, (az + bz) / 2];
    const tilt = Math.atan2(y1 - y0, Math.hypot(bx - ax, bz - az));
    m.k.at({ x: mid[0], y: mid[1], z: mid[2], ry: Math.atan2(bx - ax, bz - az), rx: tilt }, (k) => k.block(0, 0.04, 0, 0.22, 0.16, len, 'ridge'));
  }
}

// A plastered precinct wall on a stone base under a tiled coping, from a to b, in bays.
function precinctWall(m, ax, az, bx, bz, o = {}) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 7)), ry = Math.atan2(bx - ax, bz - az);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, L = len / n;
    const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2;
    m.at(cx, cz, ry, (q) => {
      const lo = q.lowest(1, L), hi = Math.max(0, q.highest(1, L));
      const top = hi + (o.h ?? 3.4);
      q.block(0, lo - 0.5, 0, 0.95, hi + 0.8 - lo + 0.5, L + 0.02, 'stone2', { climbable: false });
      q.trim(0, hi + 0.8, 0, 1.05, 0.12, L + 0.04, 'edge');
      q.block(0, hi + 0.92, 0, 0.6, top - hi - 0.92, L + 0.02, 'plaster', { climbable: false });
      q.trim(0, top - 0.22, 0, 0.72, 0.22, L + 0.04, 'timber');
      q.k.wedge(0, top, 0, 1.5, 0.5, L + 0.12, 'roof');
      q.trim(0, top + 0.44, 0, 0.18, 0.12, L + 0.14, 'ridge');
      if (i > 0 || o.firstPier) {
        q.block(0, lo - 0.5, -L / 2, 1.0, top - lo + 0.8, 1.0, 'stone', { walkable: false });
        q.k.pyramid(0, top + 0.3, -L / 2, 0.8, 0.5, 'roof', { sides: 4 });
      }
    });
  }
}

// ---------------------------------------------------------------- the Sounding House
// Local frame: the tower's centre on the summit table, world-aligned (+x east toward the
// gate, +z north toward the halls). The tower itself faces its door east (+x).
export function buildSoundingHouse(world, s, add, exclusions) {
  const m = new Mason(world, { x: s.x, z: s.z, palette: 'hush', tag: 'sounding_house', name: 'The Sounding House', lights: 9 });
  const rooms = [], routes = [];
  const X0 = -27.5, X1 = 37, Z0 = -26.5, Z1 = 34, GATE = 2.7;

  // ---- the precinct wall, its gate in the east side over the Ministry Stair
  precinctWall(m, X0, Z1, X1, Z1, { firstPier: true });
  precinctWall(m, X1, Z1, X1, GATE, { firstPier: true });
  precinctWall(m, X1, -GATE, X1, Z0);
  precinctWall(m, X1, Z0, X0, Z0, { firstPier: true });
  precinctWall(m, X0, Z0, X0, Z1, { firstPier: true });
  m.at(X1, 0, Math.PI / 2, (q) => {
    // the Quiet Gate: a roofed gateway on four posts, its leaves folded back into the court
    for (const sx of [-1, 1]) for (const sz of [-1.7, 1.7]) {
      q.block(sx * 2.4, -0.3, sz, 0.8, 0.75, 0.8, 'stone2', { walkable: false });
      q.block(sx * 2.4, 0.45, sz, 0.42, 4.0, 0.42, 'timber', { walkable: false });
    }
    for (const sz of [-1.7, 1.7]) q.trim(0, 4.2, sz, 5.5, 0.32, 0.36, 'timber');
    for (const sx of [-1, 1]) q.trim(sx * 2.4, 4.2, 0, 0.36, 0.32, 3.8, 'timber');
    q.trim(0, 3.3, 1.92, 2.4, 0.7, 0.08, 'timber');
    q.trim(0, 3.42, 1.97, 2.0, 0.46, 0.04, 'plaster');
    q.block(0, -0.4, 0, 4.4, 0.52, 3.2, 'stone', { climbable: false });
    for (const sx of [-1, 1]) q.trim(sx * 2.0, 0.12, -0.5, 0.1, 3.3, 2.0, 'timber');
    q.roof(0, 4.55, 0, 5.8, 4.2, 2.1, { flare: 0.5, overhang: 0.7, solid: false });
    q.hanging(0, 4.2, 0, 0.9, { intensity: 1.4, distance: 12, priority: 1.2 });
    q.shelter(0, 0, 5.4, 3.8, 0, 4.4);
  });
  rooms.push({ name: 'The Quiet Gate', use: 'the one way into the precinct, at the head of the Ministry Stair', at: m.point(X1, 0, 0) });

  // ---- the court: a paved way from the gate to the tower, a walk round it, paths to doors
  const pave = (x0, x1, z0, z1) => m.footing((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.12, { c: 'floor', cap: false, sink: 0.4 });
  pave(9.6, X1 - 1.2, -2.6, 2.6);
  pave(-10.4, 10.4, 8.4, 10.4); pave(-10.4, 10.4, -10.4, -8.4); pave(-10.4, -8.4, -8.4, 8.4); pave(8.4, 10.4, -8.4, 8.4);
  pave(20.7, 23.3, 2.6, 20.4);   // to the Office of Soundings
  pave(-17.3, -10.4, 8.4, 10.4); pave(-17.3, -14.7, 10.4, 20.4); // to the Quiet Archive
  pave(17.7, 20.3, -15.3, -2.6); // to the clerks' lodging
  for (const x of [18, 26, 33]) for (const z of [-3.4, 3.4]) F.lanternStand(m, x, 0.12, z, { post: 2.2, light: x === 26 && z > 0, intensity: 1.4 });

  // ---- the garden of quiet stones, south-west of the tower
  {
    const gx = -19, gz = -18;
    F.tree(m, gx, 0, gz, { h: 5.6, s: 1.1 });
    m.k.prism(gx + 3.6, 0, gz + 1.2, 1.1, 0.6, 'stone2', { sides: 8 });
    m.k.prism(gx + 3.6, 0.6, gz + 1.2, 1.2, 0.1, 'edge', { sides: 8 });
    m.glow(gx + 3.6, 0.66, gz + 1.2, 1.4, 0.02, 1.4, 0.6, 'glass');
    m.pillar(gx + 3.6, 0, gz + 1.2, 1.15, 0.7);
    for (let i = 0; i < 5; i++) {
      const a = 0.6 + i * 1.15, r = 3.8 + (i % 2) * 0.6, h = 1.5 + (i % 3) * 0.55;
      m.block(gx + Math.sin(a) * r, -0.3, gz + Math.cos(a) * r, 0.7, h + 0.3, 0.5, 'stone2', { ry: a + 0.4, walkable: false });
      m.trim(gx + Math.sin(a) * r, h, gz + Math.cos(a) * r, 0.74, 0.08, 0.54, 'edge', { ry: a + 0.4 });
    }
    for (const e of [-1, 1]) F.bench(m, gx + e * 2.2, 0, gz + 4.6, 1.8, { back: true, ry: Math.PI });
  }

  // ---- the Sounding Tower, door to the east
  m.at(0, 0, Math.PI / 2, (q) => {
    // three stepped courses all round, then the Hall of Soundings
    [[16.8, 0.3], [15.9, 0.6], [15.0, 0.9]].forEach(([w, top], i) => q.footing(0, 0, w, w, top, { c: i % 2 ? 'stone2' : 'stone', cap: false, sink: 0.6 }));
    const P = 0.9, H1 = 7, t = 0.8, hw = 6.5, inner = hw - t;
    const Y2 = P + H1, H2 = 4.4, Y3 = Y2 + H2, H3 = 3.8, Y4 = Y3 + H3, H4 = 3.6, TOP = Y4 + H4;
    q.floor(0, P + 0.06, 0, inner * 2 + 0.02, inner * 2 + 0.02, 'floor', { t: 0.4 });
    q.shell(0, 0, hw * 2, hw * 2, P, H1, { t, style: 'stone', lit: true, openings: {
      n: [{ u: 0, w: 2.6, h: 3.6 }, { u: 0, y: 4.7, w: 1.6, h: 1.5 }],
      e: [{ u: -3.2, y: 1.9, w: 1.2, h: 2.8 }, { u: 3.0, y: 1.9, w: 1.2, h: 2.8 }],
      w: [{ u: 3.9, y: 4.4, w: 1.2, h: 1.8 }],
      s: [{ u: 3.6, y: 1.9, w: 1.2, h: 2.8 }],
    } });
    q.doorArch(0, P + 3.6, hw + 0.05, 2.6, 0, { pointed: false, depth: 0.4 });
    // the Sounding Well: the Ministry's line to the sea floor, its winch and depth dial
    const wz = 0.6;
    q.k.prism(0, P, wz, 1.5, 0.85, 'stone2', { sides: 8 });
    q.k.prism(0, P + 0.85, wz, 1.62, 0.12, 'edge', { sides: 8 });
    q.k.prism(0, P + 0.97, wz, 1.2, 0.015, 'dark', { sides: 8, grad: 0 });
    q.pillar(0, P, wz, 1.55, 0.97);
    for (const sx of [-1, 1]) q.block(sx * 1.95, P, wz, 0.26, 2.9, 0.26, 'timber', { walkable: false });
    q.k.at({ x: 0, y: P + 2.5, z: wz, rz: Math.PI / 2 }, (k) => k.prism(0, -1.95, 0, 0.3, 3.9, 'wood', { sides: 8 }));
    q.trim(0, P + 1.2, wz, 0.035, 1.05, 0.035, 'metal', { layer: 'metal' });
    q.k.prism(0, P + 1.0, wz, 0.13, 0.32, 'metal', { sides: 6, layer: 'metal' });
    q.block(1.3, P, wz + 1.9, 0.16, 1.25, 0.16, 'metal', { walkable: false });
    q.k.at({ x: 1.3, y: P + 1.45, z: wz + 1.9, rx: Math.PI / 2 }, (k) => k.prism(0, -0.04, 0, 0.36, 0.08, 'brass', { sides: 10, layer: 'metal' }));
    // the Minister's desk under the south windows, charts and logs along the walls
    F.table(q, 3.4, P, -1.4, 1.1, 2.4, { cloth: 'cloth' });
    q.lantern(3.4, P + 0.82, -2.3, { post: 0, light: false });
    for (let i = 0; i < 3; i++) q.trim(3.3, P + 0.82, -1.0 + i * 0.35, 0.5, 0.04 + i * 0.03, 0.3, i % 2 ? 'plaster' : 'edge');
    F.chartTable(q, 4.7, P, 3.2, 2.6, 1.3, { ry: Math.PI / 2 });
    F.shelves(q, 3.6, P, -inner + 0.25, 2.4, 2.8, { goods: ['plaster', 'edge', 'cushion'] });
    F.bench(q, -inner + 0.4, P, 4.4, 2.2, { back: true, ry: Math.PI / 2 });
    q.hanging(0, P + H1 - 0.3, wz, 2.4, { intensity: 5, distance: 15, priority: 2.2 });
    q.light(3.4, P + 2.6, -1.4, { intensity: 3, distance: 10, priority: 2 });
    q.shelter(0, 0, hw * 2, hw * 2, P, Y2);
    rooms.push({ name: 'The Hall of Soundings', use: 'where the Ministry lowers its line into the well and writes down what comes back', at: q.point(0, P, 0) });
    // the stair: up the north wall to a landing, then along the back wall to the Listening
    // Room; the back flight is broad so a walker keeps clear of the wall that stands over it
    const SA = 2.2, SB = 2.5, mid = P + H1 / 2, run = 12 * 0.45;
    const zB = -inner + SB / 2, xA = -inner + SA / 2;
    q.stair(xA, -inner + SB + run, Math.PI, SA, P, mid, { base: P });
    q.landing(xA, zB, SA, SB, mid, { base: P });
    q.stair(-inner + SA, zB, Math.PI / 2, SB, mid, Y2, { base: P });
    const holeX0 = -2.4, holeX1 = -inner + SA + run, holeZ1 = -inner + SB;
    // the Listening Room's floor round the stair well, on beams that stop at the well
    const strips = [[-inner, holeX0, -inner, inner], [holeX1, inner, -inner, inner], [holeX0, holeX1, holeZ1, inner]];
    for (const [a, b, c, e] of strips) {
      q.floor((a + b) / 2, Y2, (c + e) / 2, b - a, e - c, 'wood', { t: 0.3 });
      q.trim((a + b) / 2, Y2 - 0.5, (c + e) / 2, b - a, 0.2, e - c, 'ceiling', { grad: 0 });
    }
    for (let i = 0; i < 5; i++) {
      const bx = -inner + 1.1 + i * 2.4, overWell = bx > holeX0 - 0.2 && bx < holeX1 + 0.2;
      const z0 = overWell ? holeZ1 : -inner;
      q.trim(bx, Y2 - 0.72, (z0 + inner) / 2, 0.3, 0.42, inner - z0, 'timber');
    }
    q.trim((holeX0 + holeX1) / 2, Y2 - 0.42, -inner + 0.45, holeX1 - holeX0 + 0.6, 0.42, 0.9, 'timber');
    q.rail(holeX0, holeZ1, holeX1 - 0.9, holeZ1, Y2);
    q.rail(holeX0, -inner + 0.9, holeX0, holeZ1, Y2);
    // the gallery round the Listening Room, on the hall's wall heads, behind a rail
    const h2 = 5.3, g = hw - 0.1;
    for (const [x, z, w, d] of [[0, (h2 + hw) / 2, hw * 2, hw - h2], [0, -(h2 + hw) / 2, hw * 2, hw - h2], [(h2 + hw) / 2, 0, hw - h2, h2 * 2], [-(h2 + hw) / 2, 0, hw - h2, h2 * 2]]) q.trim(x, Y2, z, w, 0.06, d, 'edge');
    for (const [ax, az, bx, bz] of [[-g, -g, g, -g], [g, -g, g, g], [g, g, -g, g], [-g, g, -g, -g]]) q.rail(ax, az, bx, bz, Y2 + 0.06, { c: 'timber' });
    skirt(q, hw, hw, Y2 - 0.35, hw + 1.5, hw + 1.5, Y2 - 1.15);
    // the Listening Room: plaster in a timber frame, a window to every quarter
    q.shell(0, 0, h2 * 2, h2 * 2, Y2 + 0.06, H2, { t: 0.7, style: 'plaster', lit: true, openings: {
      n: [{ u: 0, w: 1.6, h: 2.6 }, { u: -3.0, y: 1.0, w: 1.1, h: 1.7 }, { u: 3.0, y: 1.0, w: 1.1, h: 1.7 }],
      e: [{ u: 0, y: 1.0, w: 1.4, h: 1.7 }], w: [{ u: 2.4, y: 1.0, w: 1.4, h: 1.7 }], s: [{ u: 2.6, y: 1.0, w: 1.4, h: 1.7 }],
    } });
    for (const [x, z, ry] of [[-2.4, 3.4, 0], [3.4, 0, Math.PI / 2], [-3.4, 2.4, -Math.PI / 2], [3.0, -3.4, Math.PI]]) {
      // listening horns on stands, turned to the windows
      q.block(x, Y2 + 0.06, z, 0.14, 1.2, 0.14, 'metal', { walkable: false });
      q.k.at({ x, y: Y2 + 1.45, z, ry, rx: Math.PI / 2 }, (k) => k.prism(0, -0.4, 0, 0.09, 0.8, 'brass', { sides: 8, top: 3.6, layer: 'metal' }));
    }
    F.bench(q, -1.6, Y2 + 0.06, -0.6, 2.2, { back: true, ry: -Math.PI / 2 });
    F.chair(q, -3.2, Y2 + 0.06, 0.9, { ry: -Math.PI / 2 });
    q.ceiling(0, Y3 - 0.36, 0, h2 * 2 - 1.4, h2 * 2 - 1.4, { axis: 'x', every: 2.0, solid: false });
    q.hanging(0, Y3 - 0.3, -0.6, 0.9, { intensity: 3.2, distance: 11, priority: 1.8 });
    q.shelter(0, 0, h2 * 2, h2 * 2, Y2, Y3);
    rooms.push({ name: 'The Listening Room', use: 'where the clerks sit with the horns to the windows and listen to the shelf move under the sea', at: q.point(0, Y2, 0) });
    // the sealed record storey, the Sounder's loft and the roof
    q.floor(0, Y3, 0, h2 * 2 + 0.2, h2 * 2 + 0.2, 'stone', { t: 0.3 });
    skirt(q, 4.3, 4.3, Y3 + 0.8, h2 + 1.5, h2 + 1.5, Y3 - 0.45);
    q.shell(0, 0, 8.6, 8.6, Y3, H3, { t: 0.6, style: 'plaster', lit: true, openings: {
      n: [{ u: -1.8, y: 1.2, w: 1.0, h: 1.5 }, { u: 1.8, y: 1.2, w: 1.0, h: 1.5 }], s: [{ u: 0, y: 1.2, w: 1.0, h: 1.5 }],
      e: [{ u: 0, y: 1.2, w: 1.0, h: 1.5 }], w: [{ u: 0, y: 1.2, w: 1.0, h: 1.5 }],
    } });
    q.floor(0, Y4, 0, 8.8, 8.8, 'stone', { t: 0.4 });
    skirt(q, 3.5, 3.5, Y4 + 0.75, 5.5, 5.5, Y4 - 0.4);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.pier(sx * 3.0, Y4, sz * 3.0, 1.0, H4, { solid: true });
    for (const [ax, az, bx, bz] of [[-2.5, -3.0, 2.5, -3.0], [3.0, -2.5, 3.0, 2.5], [2.5, 3.0, -2.5, 3.0], [-3.0, 2.5, -3.0, -2.5]]) {
      q.parapet(ax, az, bx, bz, Y4, { t: 0.4, h: 0.9 });
      q.trim((ax + bx) / 2, Y4 + H4 - 0.5, (az + bz) / 2, Math.abs(bx - ax) + 0.4 || 0.5, 0.5, Math.abs(bz - az) + 0.4 || 0.5, 'timber');
    }
    q.trim(0, Y4 + H4 - 0.75, 0, 0.3, 0.3, 6.6, 'timber');
    q.k.prism(0, Y4 + 0.9, 0, 1.15, 1.75, 'bell', { sides: 10, top: 0.48, layer: 'metal' });
    q.k.prism(0, Y4 + 2.6, 0, 0.4, 0.3, 'bell', { sides: 8, layer: 'metal' });
    q.trim(0, Y4 + 2.9, 0, 0.06, 0.2, 0.06, 'metal', { layer: 'metal' });
    q.glow(0, Y4 + 0.6, 0, 0.5, 0.5, 0.5, 1.8);
    q.light(0, Y4 + 1.6, 0, { intensity: 2.4, distance: 16, priority: 1.0 });
    q.trim(0, TOP, 0, 7.4, 0.3, 7.4, 'edge');
    q.roof(0, TOP + 0.3, 0, 7.2, 7.2, 3.6, { flare: 0.6, overhang: 0.9, solid: false });
    q.k.prism(0, TOP + 3.7, 0, 0.12, 2.2, 'brass', { sides: 4, layer: 'metal' });
    q.k.crystal(0, TOP + 5.6, 0, 0.36, 0.9, 'glow', { layer: 'glow', strength: 1.8 });
    rooms.push({ name: "The Sounder's Loft", use: 'the bell that rings when the Ministry hears something it cannot keep', at: q.point(0, Y4, 0) });
    const court = [[X1 + 1.5, 0], [12, 0], [8.6, 0]].map(([a, b]) => new THREE.Vector3(s.x + a, m.y, s.z + b));
    routes.push({ id: 'gate to the Hall of Soundings', y0: 0, points: [...court, ...[[0, 7.1], [0, 4.6], [-2.8, 3.0], [-2.8, -1.8], [2.2, -1.8]].map(([a, b]) => q.point(a, 0, b))] });
    routes.push({ id: 'up to the Listening Room and out on its gallery', y0: P, points: [[-3.0, 3.0], [xA, -inner + SB + run + 0.6], [xA, zB + 0.2], [-inner + SA - 0.1, zB + 0.3], [holeX1 + 0.6, zB + 0.3], [2.0, -1.5], [1.2, 2.2], [0, 3.6], [0, (h2 + hw) / 2], [(h2 + hw) / 2, (h2 + hw) / 2], [(h2 + hw) / 2, -(h2 + hw) / 2]].map(([a, b]) => q.point(a, 0, b)) });
  });
  for (const [x, z] of [[-14, -13], [-14, 20], [20, -13], [20, 20], [4, 4]]) exclusions.push({ x: s.x + x, z: s.z + z, r: 22 });

  // ---- the Ministry Stair: flights stacked down the table's east face, and the step below
  buildApproach(world, { id: 'ministry_stair', name: 'The Ministry Stair', kind: 'switchback', x: s.x + X1 + 3, z: s.z, yaw: Math.PI / 2, y: m.y,
    drop: 'auto', flights: 5, x0: 3, z0: 3.4, topW: 6, topD: 6.4, dir0: 1, topEdges: ['far', 'end'], palette: 'hush', tag: 'ministry_stair' }, exclusions, add);
  // The lower flight climbs the shelf's face from the Sounding Way to the lip, at the height of
  // the summit cut's foot (data/world.js the_hush ramps), onto a landing on the shelf: the cut
  // goes on up to the west, the shelf lane turns south to the Ministry Stair, and a parapet
  // closes the gully beside the cut.
  const foot = world.terrain.heightAt(s.x + 80, s.z + 20);
  buildTerraceStair(world, { x: s.x + 97.5, z: s.z + 16, x2: s.x + 83.8, z2: s.z + 16, y2: foot, w: 4, style: 'hush' }, add, exclusions);
  {
    const L = new Mason(world, { x: s.x + 81.2, z: s.z + 15.3, y: foot, palette: 'hush', tag: 'ministry_stair', name: 'the shelf landing', lights: 0 });
    L.landing(0, 0, 5.6, 4.6, 0, { c: 'stone' });
    L.trim(0, -0.06, 0, 5.7, 0.08, 4.7, 'edge');
    L.parapet(2.8, 2.15, -0.5, 2.15, 0, { h: 0.95 });
    L.block(-0.75, -0.6, 2.15, 0.8, 1.9, 0.8, 'stone', { walkable: false });
    L.k.pyramid(-0.75, 1.3, 2.15, 0.6, 0.4, 'roof', { sides: 4 });
    exclusions.push({ x: s.x + 81.2, z: s.z + 15.3, r: 5 });
    add(L.build());
  }

  world.seats ||= [];
  world.seats.push({ id: 'sounding_house', name: 'The Sounding House', rooms, routes });
  add(m.build());
}

// ---------------------------------------------------------------- Brigand Hold
// The Redwake's stockade on Thornwood: the Retained Shiphouse at its heart, roofed with
// the clinker hull of the ferry Kaelen's crew took back from the harbor, the gate where the
// Red Trail arrives, the back court where Kaelen makes his stand, a sail loft, a watch
// stage and the crews' tents. s.wall: the stockade's corners round s (metres east, north);
// s.gate / s.postern: [edge index, width]. Local frames are noted where they turn.

// A log of the stockade: a red-stained trunk sharpened to a point, standing in its own ground.
function stake(m, x, z, h, r, c) {
  const g = m.ground(x, z);
  m.k.prism(x, g - 0.6, z, r, h + 0.6, c, { sides: 6, ry: x * 1.7 + z });
  m.k.pyramid(x, g + h, z, r * 1.02, 0.7, c, { sides: 6, ry: x * 1.7 + z });
}

// A sailcloth ridge tent on two A-frames, its back laced shut and its front flap tied open.
function tent(m, x, z, ry) {
  m.at(x, z, ry, (q) => {
    const L = 3.6, W = 3.0, H = 2.3, tilt = Math.atan2(H, W / 2), slope = Math.hypot(H, W / 2);
    // pitched on the ground under it: the frame drops to the lowest corner, the solid reaches it
    const g = q.lowest(W, L);
    q.k.push({ y: g });
    for (const e of [-1, 1]) {
      for (const sx of [-1, 1]) q.k.at({ x: sx * W / 4, y: H / 2, z: e * L / 2, rz: sx * (Math.PI / 2 - tilt) }, (k) => k.block(0, 0, 0, 0.1, slope + 0.2, 0.1, 'timber'));
    }
    q.trim(0, H, 0, 0.12, 0.12, L + 0.6, 'timber');
    for (const sx of [-1, 1]) q.k.at({ x: sx * W / 4, y: H / 2, z: 0, rz: sx * (Math.PI / 2 - tilt) }, (k) => k.block(sx * 0.06, 0, 0, 0.05, slope, L, sx > 0 ? 'plaster' : 'plaster2'));
    q.k.wedge(0, 0, -L / 2 + 0.03, W, H, 0.05, 'plaster2');
    q.k.wedge(0.5, 0, L / 2, W * 0.4, H * 0.75, 0.05, 'cloth', { ry: 0.6 });
    q.trim(0, 0.02, 0, W - 0.4, 0.04, L - 0.4, 'cushion', { grad: 0 });
    q.k.pop();
    q.solid(0, g - 0.3, 0, W - 0.2, H * 0.6 + 0.3, L, { walkable: false });
  });
}

// The Retained Shiphouse. Local frame: +z runs to the bow door (west, toward the gate), x
// across the hall (+x north); the high seat stands at the stern (-z).
function shiphouse(world, x, z, yaw, rec) {
  const m = new Mason(world, { x, z, yaw, palette: 'redwake', tag: 'shiphouse', name: 'The Retained Shiphouse', lights: 6 });
  const L = 34, W = 13, t = 0.5, WH = 3.6;
  const hi = m.highest(W + 1.2, L + 1.2), Fy = Math.max(0, hi) + 0.45;
  m.footing(0, 0, W + 1.2, L + 1.2, Fy, { c: 'stone' });
  m.floor(0, Fy, 0, W - t * 2 + 0.02, L - t * 2 + 0.02, 'floor', { t: 0.3 });
  const win = (u) => ({ u, y: 1.5, w: 0.8, h: 0.9 });
  m.shell(0, 0, W, L, Fy, WH, { t, style: 'log', lit: true, openings: {
    n: [{ u: 0, w: 2.4, h: 3.0 }], s: [{ u: 3.4, w: 1.8, h: 2.6 }],
    e: [win(-11), win(-5), win(5), win(11)], w: [win(-11), win(-5), win(5), win(11)],
  } });
  // steps up to both doors
  const g0 = m.ground(0, L / 2 + 2), g1 = m.ground(3.4, -L / 2 - 2);
  const n0 = Math.ceil((Fy - g0) / RISE - 1e-6), n1 = Math.ceil((Fy - g1) / RISE - 1e-6);
  m.stair(0, L / 2 + 0.6 + n0 * 0.45, Math.PI, 3.2, g0, Fy, { cheeks: false });
  m.stair(3.4, -L / 2 - 0.6 - n1 * 0.45, 0, 2.2, g1, Fy, { cheeks: false });
  // the hull roof: a gambrel of clinker strakes over ribs, the keel along its ridge
  const ye = Fy + WH, hw0 = W / 2 + 0.55, hk = 4.3, yk = ye + 2.7, yr = ye + 4.3, RL = L + 1.4;
  const slopes = [[hw0, ye, hk, yk], [hk, yk, 0, yr]];
  for (const sx of [-1, 1]) for (const [ax, ay, bx, by] of slopes) {
    // the slab's +y is its outer face on both sides
    const len = Math.hypot(ax - bx, by - ay), ang = -sx * Math.atan2(by - ay, ax - bx);
    const cx = sx * (ax + bx) / 2, cy = (ay + by) / 2;
    m.k.at({ x: cx, y: cy, z: 0, rz: ang }, (k) => {
      k.block(0, 0, 0, len + 0.12, 0.24, RL, 'roof');
      // three strakes laid over each other down the slope
      for (let i = 0; i < 3; i++) k.block(-len / 2 + len * (i + 0.5) / 3, 0.13, 0, len / 3 + 0.08, 0.06, RL + 0.02, i % 2 ? 'roof2' : 'timber');
    });
    // each slope's solid stands on the eave, so the upper one rests on the lower
    m.solid(cx, ye - 0.1, 0, Math.abs(ax - bx) + 0.3, Math.min(ay, by) - ye + Math.abs(by - ay) * 0.5 + 0.4, RL, { walkable: false });
  }
  // ribs outside every 2.8 m and inside over the hall; the keel and its horned ends
  for (let rz = -L / 2 + 1.4; rz <= L / 2 - 1.3; rz += 2.8) for (const sx of [-1, 1]) for (const [ax, ay, bx, by] of slopes) {
    const len = Math.hypot(ax - bx, by - ay), ang = -sx * Math.atan2(by - ay, ax - bx);
    for (const off of [0.27, -0.27]) m.k.at({ x: sx * (ax + bx) / 2, y: (ay + by) / 2, z: rz, rz: ang }, (k) => k.block(0, off, 0, len, 0.18, 0.22, 'timber'));
  }
  m.trim(0, yr - 0.05, 0, 0.55, 0.6, RL + 1.2, 'timber');
  for (const e of [-1, 1]) {
    m.k.at({ x: 0, y: yr + 0.3, z: e * (RL / 2 + 0.5), rx: e * 0.55 }, (k) => k.block(0, 0.9, 0, 0.5, 2.0, 0.55, 'timber'));
    m.k.at({ x: 0, y: yr + 1.9, z: e * (RL / 2 + 1.3), rx: e * 1.15 }, (k) => k.block(0, 0.6, 0, 0.42, 1.4, 0.45, 'timber'));
    // the gable: planked to the hull's line
    for (let yy = ye, i = 0; yy < yr - 0.1; yy += 0.32, i++) {
      const hwy = yy < yk ? hw0 + (hk - hw0) * (yy - ye) / (yk - ye) : hk * (1 - (yy - yk) / (yr - yk));
      m.trim(0, yy, e * (L / 2 - 0.15), Math.max(0.3, hwy * 2 - 0.7), 0.33, 0.24, i % 2 ? 'timber' : 'dark');
    }
  }
  m.shelter(0, 0, W, L, Fy, yr);
  // the long hearth, the set benches, the crews' tables
  m.block(0, Fy, 0, 1.6, 0.32, 11, 'stone2', { walkable: false });
  m.glow(0, Fy + 0.34, 0, 0.9, 0.08, 10, 1.6, 'ember');
  for (const e of [-1, 1]) for (const zz of [-4, 0, 4]) m.trim(e * 0.35, Fy + 0.32, zz, 0.1, 0.35, 0.8, 'metal', { layer: 'metal' });
  m.light(0, Fy + 1.6, -3, { color: '#ff9a4a', intensity: 5, distance: 16, flicker: true, priority: 1.9 });
  m.light(0, Fy + 1.6, 6, { color: '#ff9a4a', intensity: 4, distance: 14, flicker: true, priority: 1.8 });
  const inner = W / 2 - t;
  for (const sx of [-1, 1]) {
    m.block(sx * (inner - 0.8), Fy, 0.75, 1.6, 0.42, 25.5, 'wood', { climbable: false });
    m.trim(sx * (inner - 1.62), Fy, 0.75, 0.1, 0.46, 25.5, 'timber');
    for (let i = 0; i < 6; i++) F.crate(m, sx * (inner - 0.55), Fy + 0.42, -10 + i * 4.2, 0.6, { c: i % 2 ? 'wood' : 'timber' });
    for (let i = 0; i < 5; i++) m.trim(sx * (inner - 1.0), Fy + 0.43, -8 + i * 4.2, 0.9, 0.08, 1.9, i % 2 ? 'cushion' : 'plaster2', { grad: 0 });
    for (const [z0, z1] of [[-8, -2], [2, 8]]) {
      F.table(m, sx * 3.0, Fy, (z0 + z1) / 2, 1.0, z1 - z0, { cloth: false });
      F.bench(m, sx * 2.1, Fy, (z0 + z1) / 2, z1 - z0, { ry: Math.PI / 2 });
    }
    // oars racked against the bow wall
    for (let i = 0; i < 5; i++) m.k.at({ x: sx * (2.2 + i * 0.5), y: Fy, z: L / 2 - t - 0.25, rx: -0.12 }, (k) => k.block(0, 1.7, 0, 0.1, 3.4, 0.06, 'wood'));
    F.rack(m, sx * (inner - 0.25), Fy, -14.6, 2.4, { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  // the high seat at the stern under the red sail, and the crews' ledger
  F.throne(m, 0, Fy, -14.4, { w: 4.4, steps: 2, back: 2.4, c: 'wood', device: (q, bx, by, bz) => {
    q.trim(bx, by + 1.6, bz - 0.2, 4.2, 0.14, 0.14, 'timber');
    q.trim(bx, by - 0.6, bz - 0.25, 3.6, 2.2, 0.06, 'cloth');
    q.trim(bx, by + 0.1, bz - 0.2, 0.9, 0.9, 0.04, 'accent');
  } });
  F.table(m, -3.4, Fy, -12.2, 1.6, 0.9);
  for (let i = 0; i < 3; i++) m.trim(-3.6 + i * 0.35, Fy + 0.82, -12.2, 0.32, 0.03 + i * 0.02, 0.45, i % 2 ? 'plaster' : 'edge');
  m.lantern(-2.8, Fy + 0.82, -12.4, { post: 0, light: false });
  for (const zz of [-10, 0, 10]) m.hanging(0, yr - 0.4, zz, 2.6, { light: zz === -10, intensity: 2.6, distance: 12, priority: 1.7 });
  rec.rooms.push({ name: 'The Retained Shiphouse', use: "the Redwake's hall under the hull of the ferry they took back: their fire, their benches and Kaelen's high seat", at: m.point(0, Fy, 0) });
  rec.routes.push({ id: 'the bow door to the high seat', y0: 0, points: [[0, L / 2 + 0.6 + n0 * 0.45 + 1.5], [0, L / 2 - 1], [1.35, 8.6], [1.35, -9.2], [0.6, -11.6]].map(([a, b]) => m.point(a, 0, b)) });
  rec.at.ledger = m.point(-2.4, Fy, -10.4);
  return m.build();
}

// Redwake life in the yard: sailors' habits kept inside a brigand camp (docs/WORLD_BIBLE.md,
// Thornwood). A longboat drawn up and turned keel-up on trestles is the crews' mess, its cook
// fire before it; hammocks are slung off the north palisade; nets and a sail dry on lines
// strung between its stakes. Dressing only, clear of the tents, the stage, the lookout and the
// ways the record walks (tests/palaces.test.js).
function redwakeLife(world, m, s, rec) {
  // ---- the longboat, keel up on two trestles, open at the ends
  m.at(16, 14, 0.3, (q) => {
    const L = 11, W = 3.0, gun = 1.7, keel = 3.1;
    for (const tz of [-3.2, 3.2]) {
      const g = q.ground(0, tz);
      for (const sx of [-1, 1]) q.block(sx * 1.2, g - 0.3, tz, 0.22, gun - g + 0.3, 0.22, 'timber', { walkable: false });
      q.trim(0, gun - 0.1, tz, 2.8, 0.2, 0.26, 'timber');
    }
    // the hull, upside down: two planked flanks meeting at the keel, the strakes overlapping
    const slope = Math.atan2(keel - gun, W / 2);
    const flank = Math.hypot(keel - gun, W / 2);
    for (const sx of [-1, 1]) {
      q.k.at({ x: sx * W / 4, y: (gun + keel) / 2, z: 0, rz: -sx * slope }, (k) => {
        k.block(0, 0, 0, flank + 0.1, 0.16, L, 'wood');
        for (let i = 0; i < 3; i++) k.block(-flank / 2 + flank * (i + 0.5) / 3, 0.09, 0, flank / 3 + 0.06, 0.05, L + 0.02, i % 2 ? 'timber' : 'dark');
      });
      q.trim(sx * (W / 2 + 0.02), gun - 0.05, 0, 0.12, 0.16, L + 0.1, 'timber');
    }
    q.trim(0, keel + 0.05, 0, 0.24, 0.22, L + 0.8, 'timber');
    for (const e of [-1, 1]) q.k.at({ x: 0, y: keel - 0.4, z: e * (L / 2 + 0.5), rx: e * 0.5 }, (k) => k.block(0, 0, 0, 0.22, 1.4, 0.24, 'timber'));
    // a roof to the weather and to bodies: overhead, so a crew stands under it, carried on the
    // trestles (posts inside the planking, from their heads up to it)
    q.solid(0, 2.25, 0, W, keel - 2.25, L, { walkable: false });
    for (const tz of [-3.2, 3.2]) for (const sx of [-1, 1]) q.solid(sx * 1.2, gun - 0.05, tz, 0.22, 2.3 - gun + 0.05, 0.22, { walkable: false });
    q.shelter(0, 0, W, L, 0, keel);
    // a table and the crews' stores under the keel
    F.table(q, 0, q.ground(0, 0), 0.6, 0.9, 3.2, { cloth: false });
    for (const [x, z] of [[0.9, -3.6], [-0.9, -3.9], [0.8, 4.2]]) F.barrel(q, x, q.ground(x, z), z, { c: 'wood' });
    F.crate(q, -0.9, q.ground(-0.9, 3.8), 3.8, 0.7, { c: 'timber' });
    // oars leaned against the trestles
    for (let i = 0; i < 4; i++) q.k.at({ x: 1.55, y: q.ground(1.55, -1.5 + i * 0.5), z: -1.5 + i * 0.5, rz: -0.2 }, (k) => k.block(0, 1.6, 0, 0.08, 3.2, 0.06, 'wood'));
  });
  // ---- the cook fire before it, log benches round it, a kettle on a tripod
  m.at(9, 4, 0, (q) => {
    const g = q.ground(0, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      q.trim(Math.sin(a) * 0.75, g, Math.cos(a) * 0.75, 0.32, 0.22, 0.32, 'stone2', { ry: a });
    }
    q.glow(0, g + 0.05, 0, 0.7, 0.16, 0.7, 1.4, '#ff9a4a');
    for (let i = 0; i < 3; i++) q.trim((i - 1) * 0.25, g + 0.12, 0, 0.12, 0.12, 0.9, 'dark', { ry: i * 0.9 });
    for (let i = 0; i < 3; i++) q.k.at({ x: 0, y: g, z: 0, ry: (i / 3) * Math.PI * 2, rx: 0.32 }, (k) => k.block(0, 0.85, -0.3, 0.06, 1.8, 0.06, 'timber'));
    q.k.prism(0, g + 0.75, 0, 0.26, 0.34, 'metal', { sides: 8, layer: 'metal' });
    q.solid(0, g - 0.2, 0, 1.6, 0.5, 1.6, { walkable: false });
    for (const [x, z, ry] of [[0, -2.2, Math.PI / 2], [2.1, 0.4, 0.2], [-2.0, 0.8, -0.3]]) {
      q.k.at({ x, y: q.ground(x, z) + 0.22, z, ry, rz: Math.PI / 2 }, (k) => k.prism(0, -1.1, 0, 0.24, 2.2, 'wood', { sides: 7 }));
      q.solid(x, q.ground(x, z), z, 2.2, 0.45, 0.5, { ry });
    }
    q.light(0, g + 1.3, 0, { color: '#ff9a4a', intensity: 3, distance: 14, flicker: true, priority: 1.6 });
    world.addEmitter?.({ kind: 'fire', pos: q.point(0, g + 0.3, 0), rate: 14 });
    rec.rooms.push({ name: 'The Mess Fire', use: 'the crews eat under a longboat drawn up keel-up on trestles, as they would on any beach', at: q.point(0, g, 0) });
  });
  // ---- hammocks slung off the north palisade, each to a post set in the yard
  const [ax, az] = s.wall[9], [bx, bz] = s.wall[10];
  const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux;
  for (const u of [9, 13.5, 18]) {
    const wx = ax + ux * u + nx * 0.9, wz = az + uz * u + nz * 0.9;
    const px = wx + nx * 3.6, pz = wz + nz * 3.6;
    const gp = m.ground(px, pz);
    m.block(px, gp - 0.4, pz, 0.26, 2.3, 0.26, 'timber', { walkable: false });
    const mx = (wx + px) / 2, mz = (wz + pz) / 2, ry = Math.atan2(px - wx, pz - wz);
    const gy = m.ground(mx, mz);
    m.k.at({ x: mx, y: gy + 1.05, z: mz, ry }, (k) => {
      k.block(0, 0, 0, 0.9, 0.06, 2.4, u === 13.5 ? 'cloth' : 'plaster2');
      for (const e of [-1, 1]) k.at({ z: e * 1.6, rx: e * 0.55 }, (kk) => kk.block(0, 0.3, 0, 0.04, 0.04, 1.3, '#857456'));
    });
  }
  // ---- nets and a sail drying on lines strung between the stakes, east along the north wall
  const [cx, cz] = s.wall[8], [dx, dz] = s.wall[9];
  const l2 = Math.hypot(dx - cx, dz - cz), vx = (dx - cx) / l2, vz = (dz - cz) / l2;
  const ry2 = Math.atan2(vx, vz);
  for (const [u0, u1, y] of [[3, 13, 3.6], [14, 26, 3.9]]) {
    const mx = cx + vx * (u0 + u1) / 2 - vz * 0.5, mz = cz + vz * (u0 + u1) / 2 + vx * 0.5;
    const g = m.ground(mx, mz);
    m.trim(mx, g + y, mz, 0.04, 0.04, u1 - u0, '#857456', { ry: ry2 });
    if (y < 3.8) for (let i = 0; i < 4; i++) m.trim(mx + vx * (i - 1.5) * 2.2, g + y - 1.0, mz + vz * (i - 1.5) * 2.2, 0.03, 2.0, 1.8, 'dark', { ry: ry2 });
    else m.banner(mx, g + y - 0.1, mz, 5.5, 2.6, 'plaster2', ry2 + Math.PI / 2);
  }
  rec.routes.push({ id: 'across the yard to the mess fire', y0: 0, points: [[-30, 2], [-12, 6], [5, 6], [8, 1.6]].map(([a, b]) => m.point(a, 0, b)) });
}

export function buildBrigandHold(world, s, exclusions, add) {
  const rec = { id: 'brigand_hold', name: 'Brigand Hold', rooms: [], routes: [], at: {} };
  const m = new Mason(world, { x: s.x, z: s.z, palette: 'redwake', tag: 'palisade', name: 'Brigand Hold', lights: 4 });
  const P = s.wall, N = P.length;
  // the stockade, edge by edge, leaving the gate and the postern open
  const openings = { [s.gate[0]]: s.gate[1], [s.postern[0]]: s.postern[1] };
  for (let i = 0; i < N; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % N];
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const gap = openings[i] ?? 0, g0 = len / 2 - gap / 2, g1 = len / 2 + gap / 2;
    const n = Math.round(len / 0.56);
    for (let j = 0; j <= n; j++) {
      const u = len * j / n;
      if (gap && u > g0 && u < g1) continue;
      const h = 4.2 + ((i * 31 + j * 17) % 7) * 0.1;
      stake(m, ax + ux * u, az + uz * u, h, 0.27 + (j % 3) * 0.02, j % 4 === 0 ? 'dark' : 'timber');
    }
    // rails on the inner face and a collider in short runs that follow the ground
    const runs = gap ? [[0, g0], [g1, len]] : [[0, len]];
    for (const [r0, r1] of runs) {
      const k = Math.max(1, Math.round((r1 - r0) / 5));
      for (let j = 0; j < k; j++) {
        const u0 = r0 + (r1 - r0) * j / k, u1 = r0 + (r1 - r0) * (j + 1) / k, uc = (u0 + u1) / 2;
        const cx = ax + ux * uc, cz = az + uz * uc, ry = Math.atan2(ux, uz);
        const lo = m.lowest(0.6, u1 - u0, cx, cz, ry);
        m.solid(cx, lo - 1, cz, 0.62, 5.4, u1 - u0 + 0.05, { ry });
        // rails on the inner side (the polygon runs counter-clockwise: its inside is to the left)
        for (const yy of [1.3, 3.1]) m.trim(cx - uz * 0.36, m.ground(cx, cz) + yy, cz + ux * 0.36, 0.14, 0.18, u1 - u0 + 0.05, 'timber', { ry });
        // a prop log leaning in against the wall on every third run
        if (j % 3 === 1) m.k.at({ x: cx - uz * 1.2, y: m.ground(cx - uz * 1.2, cz + ux * 1.2) - 0.2, z: cz + ux * 1.2, ry, rz: -0.42 }, (q) => q.block(0, 1.7, 0, 0.24, 3.6, 0.24, 'timber'));
      }
    }
  }
  // the gate where the Red Trail arrives: two log towers, a fighting bridge, leaves folded in
  const gateFrame = (i) => {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % N];
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    return { x: (ax + bx) / 2, z: (az + bz) / 2, yaw: Math.atan2(uz, -ux) };
  };
  const G = gateFrame(s.gate[0]);
  m.at(G.x, G.z, G.yaw, (q) => {
    const half = s.gate[1] / 2, tw = 3.6, th = 7.2, opening = half - tw;
    for (const sx of [-1, 1]) {
      const tx = sx * (half - tw / 2), lo = q.lowest(tw, tw, tx, 0);
      q.footing(tx, 0, tw + 0.4, tw + 0.4, Math.max(0, lo) + 0.4, { c: 'stone' });
      q.wall(tx - tw / 2, -tw / 2, tx - tw / 2, tw / 2, lo, th, { t: 0.4, style: 'log' });
      q.wall(tx + tw / 2, -tw / 2, tx + tw / 2, tw / 2, lo, th, { t: 0.4, style: 'log' });
      q.wall(tx - tw / 2, tw / 2, tx + tw / 2, tw / 2, lo, th, { t: 0.4, style: 'log', openings: [{ u: tw / 2, y: 4.6, w: 0.6, h: 0.9 }] });
      q.wall(tx - tw / 2, -tw / 2, tx + tw / 2, -tw / 2, lo, th, { t: 0.4, style: 'log' });
      q.solid(tx, lo, 0, tw, th, tw, { walkable: false });
      q.trim(tx, lo + th, 0, tw + 0.4, 0.25, tw + 0.4, 'timber');
      q.roof(tx, lo + th + 0.25, 0, tw + 0.2, tw + 0.2, 1.8, { kind: 'pyramid', overhang: 0.5, solid: false });
      q.lantern(tx - sx * (tw / 2 + 0.25), lo + 3.2, tw / 2 + 0.3, { post: 0, light: sx > 0, intensity: 1.6 });
    }
    // the bridge between the towers over the way, its breastwork toward the trail
    const gy = q.ground(0, 0);
    q.block(0, gy + 4.6, 0, opening * 2 + 0.4, 0.35, 2.4, 'wood', { solid: false });
    q.solid(0, gy + 4.6, 0, opening * 2 + 0.4, 0.35, 2.4, { walkable: false });
    for (const ez of [-1.1, 1.1]) for (let j = 0; j <= 6; j++) q.trim(-opening + j * opening / 3, gy + 4.95, ez, 0.16, 1.1, 0.16, 'timber');
    q.trim(0, gy + 5.95, 1.1, opening * 2, 0.16, 0.18, 'timber');
    q.banner(0, gy + 2.4, 1.32, 1.4, 2.1, 'cloth', 0);
    for (const sx of [-1, 1]) q.k.at({ x: sx * (opening - 0.15), y: gy, z: -1.1, ry: sx * 1.35 }, (k) => k.block(sx * 0.95, 1.7, 0, 1.9, 3.4, 0.12, 'timber'));
  });
  rec.rooms.push({ name: 'The Red Gate', use: 'where the Red Trail meets the stockade, watched from two log towers', at: m.point(G.x, 0, G.z) });
  const B = gateFrame(s.postern[0]);
  m.at(B.x, B.z, B.yaw, (q) => {
    const half = s.postern[1] / 2;
    for (const sx of [-1, 1]) q.block(sx * (half + 0.3), q.ground(sx * (half + 0.3), 0) - 0.6, 0, 0.6, 5.8, 0.6, 'timber', { walkable: false });
    q.trim(0, Math.max(q.ground(0, 0), 0) + 4.6, 0, half * 2 + 1.4, 0.4, 0.5, 'timber');
    q.k.at({ x: half - 0.2, y: q.ground(half, 0), z: -0.7, ry: 1.2 }, (k) => k.block(-0.9, 1.6, 0, 1.8, 3.2, 0.12, 'timber'));
  });
  // the watch stage by the north corner: a platform on posts and the stair to it
  m.at(s.stage[0], s.stage[1], s.stage[2], (q) => {
    const H = 3.6, w = 4.0, d = 3.2, lo = q.lowest(w, d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.block(sx * (w / 2 - 0.2), lo - 0.4, sz * (d / 2 - 0.2), 0.32, H + 1.6 + 0.4, 0.32, 'timber', { walkable: false });
    q.block(0, lo + H - 0.25, 0, w, 0.25, d, 'wood', { climbable: false });
    for (const [ax, az, bx, bz] of [[-w / 2, d / 2, w / 2, d / 2], [w / 2, -d / 2, w / 2, d / 2], [-w / 2, -d / 2, -w / 2, d / 2], [-w / 2, -d / 2, 0.6, -d / 2]]) q.rail(ax, az, bx, bz, lo + H, { c: 'timber' });
    q.stair(w / 2 - 1.2 / 2 - 0.1 - 0, -d / 2 - 12 * 0.45, 0, 1.2, lo, lo + H, { cheeks: false, base: lo - 0.3 });
    q.lantern(0, lo + H, d / 2 - 0.4, { post: 1.4, light: true, intensity: 1.4 });
    rec.rooms.push({ name: 'The Watch Stage', use: 'a lookout over the stockade toward the Red Trail and the sea', at: q.point(0, lo + H, 0) });
  });
  for (const [x, z, ry] of s.tents) tent(m, x, z, ry);
  redwakeLife(world, m, s, rec);
  add(shiphouse(world, s.x + s.hall[0], s.z + s.hall[1], s.hall[2], rec));
  for (const [x, z] of [[0, 0], [-25, 0], [25, 0], [0, -25], [0, 25], [40, 25]]) exclusions.push({ x: s.x + x, z: s.z + z, r: 26 });
  rec.routes.push({ id: 'in at the Red Gate', y0: 0, points: [[G.x - Math.sin(G.yaw) * -8, G.z - Math.cos(G.yaw) * -8], [G.x, G.z], [G.x - Math.sin(G.yaw) * 10, G.z - Math.cos(G.yaw) * 10]].map(([a, b]) => m.point(a, 0, b)) });
  world.seats ||= [];
  world.seats.push(rec);
  add(m.build());
}

// ---------------------------------------------------------------- the Reed Covenant Outlet
// The Compact's reed station on its knoll in Shimmerfen, kept by the Reed Covenant: the
// Sunken Shrine's flooded floor feeds a channel to the reed basin, where the Covenant's
// living reeds drink the pressure in, and a second channel runs on to the outlet's headwall
// on the knoll's west lip, where the culvert breathes green into the deep pool between two
// sluice towers. Local frame: +z west toward the pool, +x north; y from the knoll's crown.
function wheel(m, x, y, z, r, ry = 0) {
  m.at(x, z, ry, (q) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      q.k.at({ x: Math.sin(a) * r, y: y + Math.cos(a) * r, z: 0, rz: -a }, (k) => k.block(0, 0, 0, 2 * r * Math.tan(Math.PI / 12) + 0.04, 0.18, 0.2, 'metal', { layer: 'metal' }));
    }
    for (let i = 0; i < 6; i++) q.k.at({ x: 0, y, z: 0.02, rz: (i / 6) * Math.PI }, (k) => k.block(0, 0, 0, 0.1, r * 2, 0.1, 'metal', { layer: 'metal' }));
    q.k.at({ x: 0, y, z: 0, rx: Math.PI / 2 }, (k) => k.prism(0, -0.3, 0, 0.26, 0.6, 'metal', { sides: 8, layer: 'metal' }));
  });
}

export function buildReedOutlet(world, s, exclusions, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: -Math.PI / 2, palette: 'ancient_fen', tag: 'reed_outlet', name: 'Reed Covenant Outlet', lights: 4 });
  const reed = new Mason(world, { x: s.x, z: s.z, yaw: -Math.PI / 2, palette: 'reed', tag: 'reed_outlet', name: 'Covenant reeds', lights: 2 });
  const rec = { id: 'reed_outlet', name: 'Reed Covenant Outlet', rooms: [], routes: [], at: {} };
  const water = 1.8 - m.y; // the fen's surface, relative to the crown
  // ---- the headwall on the west lip, its culvert, buttresses and sluice towers
  // the face stands out on the shelf at the water's edge; its mass fills back to the crown
  const HZ0 = 24.5, HZ1 = 26.9, HB = 20.8, HW = 8;
  const base = Math.min(water - 2, m.lowest(HW * 2, HZ1 - HB + 1, 0, (HB + HZ1) / 2)) - 0.6;
  m.mass(0, base, (HB + HZ1) / 2, HW * 2, 0.1 - base, HZ1 - HB, { climbable: false });
  m.block(0, base, HZ1 + 0.3, HW * 2 + 0.6, water + 0.6 - base, 0.6, 'stone2', { climbable: false });
  m.trim(0, -0.25, HZ1 + 0.05, HW * 2 + 0.3, 0.25, 0.3, 'edge');
  for (const sx of [-1, 1]) m.k.buttress(sx * (HW + 0.2), base, (HB + HZ1) / 2, -base + 0.2, { w: 1.4, depth: 2.6, ry: sx * Math.PI / 2, stages: 3 });
  const spring = water + 1.2, span = 3.6;
  m.trim(0, water - 0.4, HZ1 + 0.62, span, spring + span / 2 - water + 0.4, 0.04, 'dark', { grad: 0 });
  m.k.arch(0, spring, HZ1 + 0.4, span, { t: 0.55, depth: 0.5, c: 'edge', key: 'edge' });
  for (let j = -2; j <= 2; j++) m.trim(j * 0.6, spring + 0.4, HZ1 + 0.5, 0.1, Math.sqrt(span * span / 4 - j * j * 0.36) - 0.5, 0.1, 'metal', { layer: 'metal' });
  m.k.glowPanel(0, (water + spring) / 2 - 0.2, HZ1 + 0.9, 2.6, spring - water + 0.2, 0.05, 'glow', 0.7);
  m.k.glowPanel(0, water + 0.05, HZ1 + 2.6, 3.2, 0.06, 3.2, 'glow', 0.45);
  m.parapet(-HW, HZ0 + 0.3, -1.0, HZ0 + 0.3, 0.1, { t: 0.5 });
  m.parapet(1.0, HZ0 + 0.3, HW, HZ0 + 0.3, 0.1, { t: 0.5 });
  m.parapet(-HW + 0.25, HZ0, -HW + 0.25, HZ1, 0.1, { t: 0.5 });
  m.parapet(HW - 0.25, HZ0, HW - 0.25, HZ1, 0.1, { t: 0.5 });
  m.parapet(-HW, HZ1 - 0.25, HW, HZ1 - 0.25, 0.1, { t: 0.5 });
  for (const sx of [-1, 1]) {
    const tx = sx * 5.2, tz = HZ0 + 1.6;
    m.mass(tx, 0.1, tz, 3.0, 3.6, 3.0, { climbable: false });
    m.trim(tx, 3.7, tz, 3.4, 0.25, 3.4, 'edge');
    m.k.pyramid(tx, 3.95, tz, 2.4, 1.8, 'roof', { sides: 4 });
    wheel(m, tx, 2.0, tz + 1.62, 1.25);
    m.lantern(tx - sx * 1.8, 0.1, HZ0 + 0.4, { post: 2.0, light: sx > 0, intensity: 1.4, distance: 14 });
  }
  rec.rooms.push({ name: 'The Outlet', use: "the Compact's culvert where the reed station breathes the Rift's pressure out into the deep pool", at: m.point(0, 0, HZ0) });
  // ---- the reed basin, and the channels that feed it and drain it
  const BZ = 12, bw = 9, bd = 7;
  m.footing(0, BZ, bw, bd, 0.8, { c: 'stone2', cap: 'edge' });
  m.k.glowPanel(0, 0.84, BZ, bw - 1.1, 0.04, bd - 1.1, 'glow', 0.5);
  m.solid(0, 0.8, BZ, bw, 0.05, bd, { walkable: false });
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 40) * 3.0;
    const x = Math.sin(a) * r * 1.2, z = BZ + Math.cos(a) * r * 0.85, h = 1.6 + (i % 5) * 0.35;
    reed.k.at({ x, y: 0.82, z, rx: ((i % 5) - 2) * 0.05, rz: ((i % 7) - 3) * 0.04 }, (k) => k.prism(0, 0, 0, 0.05, h, i % 3 ? 'thatch' : 'moss', { sides: 4, top: 0.4 }));
    if (i % 4 === 0) reed.k.glowPanel(x, 0.82 + h + 0.1, z, 0.14, 0.22, 0.14, 'glow', 1.2);
  }
  const channel = (z0, z1) => {
    m.footing(0, (z0 + z1) / 2, 2.2, z1 - z0, 0.25, { c: 'stone2', cap: false });
    for (const sx of [-1, 1]) m.block(sx * 0.85, 0.25, (z0 + z1) / 2, 0.5, 0.3, z1 - z0, 'edge', { walkable: false });
    m.k.glowPanel(0, 0.28, (z0 + z1) / 2, 1.0, 0.04, z1 - z0, 'glow', 0.6);
  };
  channel(BZ + bd / 2, HZ0 + 0.4);
  channel(3.0, BZ - bd / 2);
  rec.rooms.push({ name: 'The Reed Basin', use: 'where the Covenant binds the pressure into living reeds before it reaches the outlet', at: m.point(0, 0, BZ) });
  // ---- the Sunken Shrine: broken columns round a flooded floor, the Covenant's effigies
  const SX = 2, SZ = -4, R = 6.2;
  m.k.prism(SX, -0.6, SZ, 7.6, 0.95, 'stone2', { sides: 12 });
  m.k.prism(SX, 0.3, SZ, 7.64, 0.06, 'edge', { sides: 12 });
  m.k.prism(SX, 0.06, SZ, 3.7, 0.3, 'dark', { sides: 12 });
  m.k.prism(SX, 0.33, SZ, 3.5, 0.02, 'glow', { sides: 12, layer: 'glow', strength: 0.4 });
  world.colliders.addCyl({ x: m.point(SX, 0, SZ).x, z: m.point(SX, 0, SZ).z, r: 7.4, y0: m.y - 0.6, y1: m.y + 0.36, tag: 'reed_outlet' });
  const heights = [5.4, 5.4, 2.2, 4.8, 1.3, 3.0, 4.4, 1.9];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, x = SX + Math.sin(a) * R, z = SZ + Math.cos(a) * R, h = heights[i];
    const broken = h < 5;
    if (i === 6) m.k.at({ x, y: 0.36, z, rz: 0.1 }, (k) => k.column(0, 0, 0, h, 0.48, { capital: false }));
    else m.k.column(x, 0.36, z, h, 0.48, { capital: !broken });
    m.pillar(x, 0.36, z, 0.55, h);
    if (broken) m.k.at({ x: x + Math.sin(a) * 1.6, y: 0.36, z: z + Math.cos(a) * 1.6, ry: a + 0.6, rz: Math.PI / 2 }, (k) => k.prism(0, -0.5, 0, 0.42, 1.0 + (i % 2) * 0.5, 'stone', { sides: 8 }));
  }
  // the lintel the two tallest still carry
  {
    const am = 0.2 + Math.PI / 8, ri = R * Math.cos(Math.PI / 8), chord = 2 * R * Math.sin(Math.PI / 8);
    m.at(SX + Math.sin(am) * ri, SZ + Math.cos(am) * ri, am, (q) => q.trim(0, 5.76, 0, chord + 1.0, 0.7, 0.9, 'stone'));
  }
  for (const i of [2, 5]) {
    const a = (i / 8) * Math.PI * 2 + 0.2, x = SX + Math.sin(a) * (R - 0.62), z = SZ + Math.cos(a) * (R - 0.62);
    for (let j = 0; j < 7; j++) reed.k.prism(x + (j % 3 - 1) * 0.12, 0.4, z + (j % 2) * 0.1, 0.07, 2.2 + (j % 3) * 0.2, 'thatch', { sides: 4, top: 0.5 });
    reed.trim(x, 1.6, z, 0.5, 0.6, 0.5, 'cloth');
    reed.k.pyramid(x, 2.2, z, 0.32, 0.4, 'cloth', { sides: 4 });
  }
  for (const [x, z] of [[SX + 4.4, SZ - 6.6], [SX - 4.6, SZ - 6.4]]) m.lantern(x, 0.36, z, { post: 2.0, light: x > SX, intensity: 1.2, distance: 12 });
  rec.rooms.push({ name: 'The Sunken Shrine', use: 'a Compact shrine whose floor the fen took, where the Covenant ties its effigies and keeps its testaments', at: m.point(SX, 0.36, SZ) });
  for (const [x, z] of [[0, 0], [0, 14], [0, -10]]) exclusions.push({ ...m.point(x, 0, z), r: 15 });
  world.seats ||= [];
  world.seats.push(rec);
  add(m.build());
  add(reed.build());
}
