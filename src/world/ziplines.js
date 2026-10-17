// The carrier lines (data/carrierLines.js): the cable the Hightoll garrison strung across the
// Arches' breaks and down from its Land Gate, and the lines the coast's own people rigged since,
// a timber mast at each end and a trolley hanging at each start. Some ends stand on a station:
// a timber tower or stage built for the line, its stair up one side. The ride itself is
// game/ziplines.js; this raises the stations, the masts and the cable, keeps scatter out from
// under them and offers the trolley.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { Mason } from './mason.js';
import { PALETTES } from './style.js';
import { LINE_HANG, LINE_LIFT } from '../data/hightoll.js';
import { CARRIER_LINES, LINE_STATIONS, endFloor } from '../data/carrierLines.js';
import { act } from '../game/hooks.js';

const P = { ...PALETTES.ancient, wood: '#4d3b2b', wood2: '#5e4834', iron: '#2b2a29', bronze: '#8c7340', rope: '#857456' };
// the cable ends this far over the landing, so the last of the sag clears the edge
const SETTLE = 0.4;

// Where a line's cable runs: at hand height over each landing (the rider is lifted onto it at
// the start), sagging between. `point(t)` is the cable; the rider hangs LINE_HANG under it.
export function lineCurve(def, terrain) {
  const ground = (x, z) => terrain.heightAt(x, z);
  const floorA = endFloor(def.a, ground), floorB = endFloor(def.b, ground);
  const a = new THREE.Vector3(def.a.x, floorA + LINE_HANG + LINE_LIFT, def.a.z);
  const b = new THREE.Vector3(def.b.x, floorB + LINE_HANG + SETTLE, def.b.z);
  const len = a.distanceTo(b);
  const dip = def.sag * len * 4;
  const point = (t, out = new THREE.Vector3()) => out.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - dip * t * (1 - t));
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  return { a, b, len, point, dir, yaw: Math.atan2(dir.x, dir.z), floorA, floorB };
}

// A timber mast square across the line: two posts, the beam the cable runs over, braces and the
// sheave. `back` > 0 stands it behind the point along the line, < 0 beyond it. A hauling line's
// top mast carries the drum its counterweight turns, the weight hanging beside it.
function mast(k, world, at, floor, top, dir, back, haul = false) {
  const across = new THREE.Vector3(dir.z, 0, -dir.x);
  const cx = at.x - dir.x * back, cz = at.z - dir.z * back;
  const ry = Math.atan2(dir.x, dir.z);
  const h = top + 0.5 - floor;
  for (const s of [-1, 1]) {
    const px = cx + across.x * s * 1.35, pz = cz + across.z * s * 1.35;
    k.slab(px, floor - 0.6, pz, 0.32, h + 1.0, 0.32, s > 0 ? 'wood' : 'wood2', { ry });
    world.colliders.addCyl({ x: px, z: pz, r: 0.22, y0: floor - 0.6, y1: floor + h });
  }
  k.at({ x: cx, y: top + 0.25, z: cz, ry }, (kk) => {
    kk.slab(0, 0, 0, 3.2, 0.32, 0.34, 'wood');
    for (const s of [-1, 1]) kk.slab(s * 0.85, -1.1, 0, 0.16, 1.4, 0.18, 'wood2', { rz: s * 0.75 });
    kk.prism(0, -0.05, 0, 0.32, 0.12, 'iron', { sides: 10, rz: Math.PI / 2, layer: 'metal' });
    if (haul) {
      // the drum on the beam, the rope wound on it, and the weight hanging off its end
      kk.prism(1.2, 0.05, 0, 0.42, 0.7, 'wood2', { sides: 10, rz: Math.PI / 2 });
      kk.prism(1.2, 0.05, 0, 0.46, 0.4, 'rope', { sides: 10, rz: Math.PI / 2 });
      kk.slab(1.55, -2.3, 0, 0.05, 2.1, 0.05, 'rope');
      kk.slab(1.55, -3.0, 0, 0.7, 0.8, 0.7, 'stone');
    }
  });
}

// The cable, in short straight runs along its sag.
function cable(k, curve, t0 = 0, t1 = 1) {
  const n = Math.max(6, Math.ceil(curve.len / 2.5));
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    curve.point(t0 + (t1 - t0) * (i / n), p);
    curve.point(t0 + (t1 - t0) * ((i + 1) / n), q);
    const len = p.distanceTo(q);
    const ry = Math.atan2(q.x - p.x, q.z - p.z);
    const rx = -Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z));
    k.at({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2, ry, rx }, (kk) => kk.block(0, 0, 0, 0.07, 0.07, len + 0.04, 'iron', { layer: 'metal' }));
  }
}

// The trolley: two sheaves on a bronze cheek-plate and the bar a rider holds.
function trolley() {
  const k = new Kit(P, { detail: 1 });
  k.slab(0, -0.32, 0, 0.12, 0.42, 0.5, 'bronze', { layer: 'metal' });
  for (const z of [-0.16, 0.16]) k.prism(0.09, 0.02, z, 0.1, 0.06, 'iron', { sides: 8, rz: Math.PI / 2, layer: 'metal' });
  for (const s of [-1, 1]) k.slab(0, -0.62, s * 0.14, 0.05, 0.4, 0.05, 'iron', { layer: 'metal' });
  k.slab(0, -0.68, 0, 0.6, 0.06, 0.06, 'wood', { ry: Math.PI / 2 });
  const g = k.build('carrier_trolley');
  g.userData.dynamic = true;
  return g;
}

// ---------------------------------------------------------------- stations
// A station: four posts braced on every face, a planked platform `h` up over the ground at its
// centre, a rail on the two sides away from the stair, and a gangway stair on trestles up the
// +x side, as ships' carpenters build them. A stage is the same, low.
const RISE = 0.3, RUN = 0.42;
export function buildStation(world, s, exclusions = []) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.yaw || 0, palette: s.palette || 'redwake', tag: 'line_station', name: s.name, lights: 2 });
  const W = s.w, H = s.h, half = W / 2;
  const lo = Math.min(0, m.lowest(W, W));
  // posts and braces
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.block(sx * (half - 0.2), lo - 0.6, sz * (half - 0.2), 0.36, H - lo + 0.6 + 1.1, 0.36, 'timber', { walkable: false });
  for (let y = lo + 2.6; y < H - 0.8; y += 2.6) {
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      const x0 = ax * (half - 0.2), z0 = az * (half - 0.2), x1 = bx * (half - 0.2), z1 = bz * (half - 0.2);
      const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      m.trim((x0 + x1) / 2, y, (z0 + z1) / 2, 0.14, 0.2, len, 'timber', { ry });
      // a cross brace below each girt
      for (const sg of [-1, 1]) m.k.at({ x: (x0 + x1) / 2, y: y - 1.3, z: (z0 + z1) / 2, ry, rx: sg * Math.atan2(2.6, len) }, (k) => k.block(0, 0, 0, 0.1, 0.12, Math.hypot(len, 2.6), 'wood'));
    }
  }
  // the platform, and its rail on the -z and -x sides; the stair arrives on the +x side
  m.block(0, H - 0.3, 0, W + 0.4, 0.3, W + 0.4, 'wood');
  m.trim(0, H - 0.34, 0, W + 0.5, 0.08, W + 0.5, 'timber');
  m.rail(-half - 0.1, -half - 0.1, half + 0.1, -half - 0.1, H, { c: 'timber' });
  m.rail(-half - 0.1, half + 0.1, -half - 0.1, -half - 0.1, H, { c: 'timber' });
  let foot, path;
  if (s.stair === 'wrap') ({ foot, path } = wrapStair(m, s, lo, half));
  else {
    // the gangway stair against the +x face, rising toward +z, its head level with the
    // platform at the middle of that face (a corner post stands at the corner)
    const n = Math.max(1, Math.ceil((H - lo) / RISE - 1e-6));
    const rise = (H - lo) / n;
    const sx = half + 0.95, head = 0.4;
    for (let i = 0; i < n; i++) {
      const top = lo + rise * (i + 1);
      const z = head - (n - i - 0.5) * RUN;
      const g = m.ground(sx, z);
      const base = Math.max(g - 0.3, top - rise - 0.25);
      m.block(sx, base, z, 1.5, top - base, RUN + 0.04, 'wood', { climbable: false });
      if (i % 7 === 3 && base > g + 0.4) {
        // a trestle, its collider kept under the treads
        m.block(sx, g - 0.4, z, 1.2, base - g + 0.4, 0.28, 'timber', { solid: false });
        if (base - g > 0.8) m.solid(sx, g - 0.4, z, 1.2, base - g - 0.2, 0.28, { walkable: false });
      }
    }
    // footing steps where the ground falls away from the foot: the first tread stood up to
    // 0.6 m over a slope, more than a body steps up; one step down is laid wherever it stands
    // more than three quarters of a rise over the grade
    let fTop = lo + rise, fz = head - n * RUN, extra = 0;
    for (; extra < 6; extra++) {
      const g = m.ground(sx, fz - RUN / 2);
      if (fTop - g <= RISE * 0.75) break;
      fTop -= Math.min(RISE, (fTop - g) / 2);
      fz -= RUN;
      m.block(sx, g - 0.3, fz + RUN / 2, 1.5, fTop - g + 0.3, RUN + 0.04, 'wood', { climbable: false });
    }
    // stringers along both sides, and a hand rope on the outside
    const len = n * RUN, sy = (lo + H) / 2, sz = head - len / 2, pitch = -Math.atan2(H - lo, len);
    for (const off of [-0.8, 0.8]) m.k.at({ x: sx + off, y: sy, z: sz, rx: pitch }, (k) => k.block(0, -0.2, 0, 0.12, 0.3, Math.hypot(len, H - lo), 'timber'));
    m.k.at({ x: sx + 0.82, y: sy + 1.0, z: sz, rx: pitch }, (k) => k.block(0, 0, 0, 0.05, 0.05, Math.hypot(len, H - lo), '#857456'));
    const c = Math.cos(s.yaw || 0), sn = Math.sin(s.yaw || 0);
    exclusions.push({ x: s.x + sx * c + sz * sn, z: s.z - sx * sn + sz * c, r: len / 2 + 3 });
    foot = m.point(sx, lo, fz - 0.6);
    // the way up, for whoever checks it: along the treads, then in across the platform
    path = [m.point(sx, lo, fz - 0.6), m.point(sx, H, head - 0.2), m.point(0, H, 0)];
  }
  if (s.banner) {
    // a flagpole off the platform's back corner, the cloth hung high enough to show over trees
    const pole = s.pole ?? 4.2;
    m.block(-half + 0.2, H + 1.1, -half + 0.2, 0.18, pole, 0.18, 'timber', { walkable: false });
    const bh = Math.min(4.6, pole * 0.52);
    m.k.banner(-half + 0.2, H + 1.1 + pole - bh - 0.2, -half + 0.45, bh * 0.6, bh, s.banner, { ry: Math.PI / 2 });
  }
  if (s.brazier) {
    // a fire basket on the platform's corner toward the trail: the Hold's mark from the pier by night
    m.block(-half + 0.5, H, half - 0.5, 0.5, 1.0, 0.5, 'timber', { walkable: false });
    m.trim(-half + 0.5, H + 1.0, half - 0.5, 0.8, 0.35, 0.8, 'metal', { layer: 'metal' });
    m.glow(-half + 0.5, H + 1.25, half - 0.5, 0.6, 0.3, 0.6, 2.2, '#ff9a4a');
    m.light(-half + 0.5, H + 1.6, half - 0.5, { color: '#ff8a3a', intensity: 3, distance: 18, flicker: true, priority: 1.4, night: 2.2 });
  }
  m.lantern(half - 0.3, H, -half + 0.3, { post: 1.3, light: true, intensity: 1.2 });
  exclusions.push({ x: s.x, z: s.z, r: W + 4 });
  const g = m.build();
  world.scene.add(g);
  return { def: s, x: s.x, z: s.z, top: m.y + H, foot, path, group: g };
}

// A stair that wraps the tower: a flight up each face in turn, landings at the corners, then
// a bridge from the last tread onto the platform. Its foot is returned.
function wrapStair(m, s, lo, half) {
  const H = s.h, o = half + 0.85, sw = 1.3;
  const corners = [[o, -o], [o, o], [-o, o], [-o, -o]];
  let y = lo, k = 0, foot = null;
  // where treads already stand: a tread of a later lap that passes over one of an earlier lap
  // gets no trestle post, or its post would stand up through the lower flight
  const laid = [];
  const tread = (x, z, top, ry, w, d) => {
    const g = m.ground(x, z);
    const base = Math.max(g - 0.3, top - RISE - 0.25);
    m.block(x, base, z, w, top - base, d, 'wood', { climbable: false, ry });
    const over = laid.some(([lx, lz]) => Math.abs(lx - x) < 1.0 && Math.abs(lz - z) < 1.0);
    laid.push([x, z]);
    if (!over && base > g + 1.2 && (Math.round(x * 3 + z * 7) % 3 === 0)) {
      // a trestle post under the tread: drawn up to it, its collider kept well under the treads
      m.block(x, g - 0.4, z, 0.26, base - g + 0.4, 0.26, 'timber', { solid: false });
      m.solid(x, g - 0.4, z, 0.26, Math.max(0.1, base - g - 0.2), 0.26, { walkable: false });
    }
  };
  // the first landing, at the foot
  const [fx, fz] = corners[0];
  tread(fx, fz, y + 0.05, 0, sw, sw);
  foot = m.point(fx + 1.4, lo, fz - 1.4);
  const path = [foot, m.point(fx, lo, fz)];
  while (y < H - 1e-6) {
    const [ax, az] = corners[k % 4], [bx, bz] = corners[(k + 1) % 4];
    const ux = Math.sign(bx - ax), uz = Math.sign(bz - az), ry = Math.atan2(ux, uz);
    const avail = 2 * o - sw;
    const n = Math.min(Math.floor(avail / RUN), Math.ceil((H - y) / RISE - 1e-6));
    for (let i = 0; i < n; i++) {
      y = Math.min(H, y + RISE);
      const u = sw / 2 + RUN * (i + 0.5);
      tread(ax + ux * u, az + uz * u, y, ry, sw, RUN + 0.04);
      if (y >= H - 1e-6) {
        // the bridge onto the platform, square off the face this flight climbs
        const cx = ax + ux * u, cz = az + uz * u;
        const nx = -Math.sign(cx) * (Math.abs(cx) > Math.abs(cz) ? 1 : 0), nz = -Math.sign(cz) * (Math.abs(cz) >= Math.abs(cx) ? 1 : 0);
        const L = o - half + 0.6;
        m.block(cx + nx * L / 2, H - 0.3, cz + nz * L / 2, nx ? L : sw, 0.3, nz ? L : sw, 'wood', { climbable: false });
        path.push(m.point(cx, H, cz), m.point(cx + nx * L, H, cz + nz * L), m.point(0, H, 0));
        break;
      }
    }
    k++;
    if (y < H - 1e-6) {
      const [cx, cz] = corners[k % 4];
      tread(cx, cz, y, 0, sw, sw);
      path.push(m.point(cx, y, cz));
    }
  }
  return { foot, path };
}

export function buildCarrierLines(world, exclusions = [], defs = CARRIER_LINES) {
  const k = new Kit(P, { detail: 1 });
  const lines = [];
  // the stations the chosen lines stand on
  const used = new Set(defs.flatMap((d) => [d.a.station, d.b.station]).filter(Boolean));
  world.lineStations = LINE_STATIONS.filter((s) => used.has(s.id)).map((s) => buildStation(world, s, exclusions));
  const starts = defs.map((d) => d.a);
  for (const def of defs) {
    const curve = lineCurve(def, world.terrain);
    // A station where one line comes in and the next leaves shares the leaving line's mast.
    const shared = starts.some((s) => s !== def.a && Math.hypot(s.x - def.b.x, s.z - def.b.z) < 3);
    // a hauling line that arrives here turns its drum on this mast
    const drum = defs.some((d) => d.haul && Math.hypot(d.b.x - def.a.x, d.b.z - def.a.z) < 3);
    mast(k, world, curve.a, curve.floorA, curve.a.y, curve.dir, 0.9, drum);
    if (!shared) {
      mast(k, world, curve.b, curve.floorB, curve.b.y, curve.dir, -1.0, def.haul);
      // past the far mast the cable is staked down to the ground beyond it
      if (!def.b.station) {
        const stake = curve.b.clone().addScaledVector(curve.dir, 4.2);
        stake.y = curve.floorB;
        const top = curve.b.clone().addScaledVector(curve.dir, 1.0);
        k.at({ x: (top.x + stake.x) / 2, y: (top.y + stake.y) / 2, z: (top.z + stake.z) / 2, ry: curve.yaw, rx: Math.atan2(top.y - stake.y, 3.2) }, (kk) => kk.block(0, 0, 0, 0.07, 0.07, Math.hypot(top.y - stake.y, 3.2), 'iron', { layer: 'metal' }));
        k.slab(stake.x, stake.y - 0.3, stake.z, 0.3, 0.7, 0.3, 'iron', { layer: 'metal' });
      }
    }
    cable(k, curve);
    const handle = trolley();
    handle.position.copy(curve.a);
    handle.rotation.y = curve.yaw;
    world.scene.add(handle);
    // nothing grows up into the line, and the landings stay clear
    for (let d = 0; d <= curve.len; d += 6) {
      const p = curve.point(d / curve.len);
      const ground = world.terrain.heightAt(p.x, p.z);
      if (p.y - LINE_HANG - ground < 18) exclusions.push({ x: p.x, z: p.z, r: 5 });
    }
    for (const e of [curve.a, curve.b]) exclusions.push({ x: e.x, z: e.z, r: 4 });
    const line = { def, curve, trolley: handle, riding: null };
    line.interaction = world.addInteract({
      id: 'line_' + def.id, kind: 'zipline', pos: new THREE.Vector3(curve.a.x, curve.floorA + 1, curve.a.z), radius: 2.6,
      label: `${def.haul ? 'Ride the haul line up' : 'Ride the line'} to ${def.name}`, enabled: () => !line.riding,
      use: () => act('rideLine', def.id),
    });
    lines.push(line);
  }
  world.scene.add(k.build('carrier_lines'));
  world.carrierLines = lines;
  return lines;
}
