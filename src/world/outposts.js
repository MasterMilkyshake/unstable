// Outposts and waymarks between the towns, laid by the mason (world/mason.js) in the
// palette of the country they stand in:
//
//   White Pass Watch     the frost gate across the White Pass road and its guard post
//   Kestrel Beacon       the Compact relay tower on Kestrel Heights kept as a watch post:
//                        a walled yard, the keeper's lodge, the signal fire and the lookout
//
// Each records what it is for (world.outposts) so the review tools can find it.
import { Mason } from './mason.js';
import * as F from './furnishing.js';
import { buildVernacular } from './vernacular.js';

const record = (world, o) => (world.outposts ||= []).push(o);

// A gate tower: fieldstone to the first floor, logs above under a steep shingle gable.
function gateTower(q, x, z, w, o = {}) {
  const lo = q.lowest(w + 0.6, w + 0.6, x, z), stoneH = o.stone ?? 3.4, logH = o.log ?? 3.2;
  q.footing(x, z, w + 0.6, w + 0.6, Math.max(0, lo) + 0.3, { c: 'stone2' });
  const base = Math.max(0, lo) + 0.3;
  q.mass(x, base, z, w, stoneH, w, { climbable: false });
  q.trim(x, base + stoneH, z, w + 0.3, 0.2, w + 0.3, 'edge');
  q.shell(x, z, w, w, base + stoneH + 0.2, logH, { t: 0.4, style: 'log', lit: true, openings: o.openings || {
    n: [{ u: 0, y: 1.0, w: 0.7, h: 0.8 }], s: [{ u: 0, y: 1.0, w: 0.7, h: 0.8 }],
  } });
  q.solid(x, base + stoneH, z, w - 0.8, logH, w - 0.8, { walkable: false });
  const eave = base + stoneH + 0.2 + logH;
  q.roof(x, eave, z, w + 0.3, w + 0.3, 2.6, { kind: 'gable', along: o.along || 'z', snow: true, overhang: 0.5, solid: false });
  return { base, eave };
}

// ---------------------------------------------------------------- White Pass Watch
// Local frame: +z up the pass along the road, x across it. The way through is 4.4 m wide.
export function buildPassWatch(world, s, exclusions, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, palette: 'frost', tag: 'pass_gate', name: s.name || 'White Pass Watch', lights: 4 });
  const W = 4.4, tw = 3.8, tx = W / 2 + tw / 2;
  const towers = [-1, 1].map((sx) => gateTower(m, sx * tx, 0, tw, { along: 'z' }));
  const gy = Math.max(0, m.ground(0, 0));
  // the covered bridge over the way, its breastwork downhill, a shingle roof under snow
  const by = Math.min(towers[0].base, towers[1].base) + 3.4;
  m.block(0, by, 0, W + 0.4, 0.4, tw - 0.4, 'wood', { solid: false });
  m.solid(0, by, 0, W + 0.4, 0.4, tw - 0.4, { walkable: false });
  m.wall(-W / 2, -tw / 2 + 0.3, W / 2, -tw / 2 + 0.3, by + 0.4, 2.2, { t: 0.3, style: 'log', openings: [{ u: W / 2, y: 0.8, w: 1.0, h: 0.6 }] });
  m.wall(-W / 2, tw / 2 - 0.3, W / 2, tw / 2 - 0.3, by + 0.4, 2.2, { t: 0.3, style: 'log' });
  m.roof(0, by + 2.6, 0, W + 0.2, tw, 1.6, { kind: 'gable', along: 'x', snow: true, overhang: 0.4, solid: false });
  // the gate leaves stand open against the towers' uphill faces; a bar rests beside them
  for (const sx of [-1, 1]) m.k.at({ x: sx * (W / 2 - 0.1), y: gy, z: tw / 2 + 0.05, ry: sx * 1.45 }, (k) => k.block(sx * 1.05, 1.6, 0, 2.1, 3.2, 0.14, 'timber'));
  m.trim(-W / 2 - 0.3, gy + 0.2, tw / 2 + 1.2, 0.2, 0.2, 2.6, 'timber');
  // lamps on the downhill faces, a brazier inside, the Watch's banner
  for (const sx of [-1, 1]) m.lantern(sx * (W / 2 + 0.25), towers[sx > 0 ? 1 : 0].base + 2.4, -tw / 2 - 0.25, { post: 0, light: sx > 0, intensity: 1.5, distance: 14 });
  F.brazier(m, -W / 2 - 1.4, gy, tw / 2 + 2.4, { h: 0.6, intensity: 2.5, distance: 12, priority: 1.2 });
  m.banner(0, by - 1.9, -tw / 2 + 0.12, 1.3, 1.8, 'cloth', Math.PI);
  // short fieldstone wings tie the towers into the ground on either hand
  for (const sx of [-1, 1]) {
    const x0 = sx * (tx + tw / 2), x1 = sx * (tx + tw / 2 + 5.5);
    m.at((x0 + x1) / 2, 0, Math.PI / 2, (q) => {
      const lo = q.lowest(0.9, 5.5), hi = Math.max(0, q.highest(0.9, 5.5));
      q.mass(0, lo - 0.4, 0, 0.9, hi + 2.6 - lo + 0.4, 5.6, { climbable: false });
      q.k.wedge(0, hi + 2.6, 0, 1.2, 0.45, 5.7, 'snow');
    });
  }
  exclusions.push({ x: s.x, z: s.z, r: 14 });
  add(m.build());
  // the guard post: a log hut beside the way on the uphill side, its door to the road
  const [px, pz] = [s.post[0], s.post[1]];
  const c = Math.cos(s.rot || 0), n = Math.sin(s.rot || 0);
  buildVernacular(world, { type: 'hut', name: 'White Pass guard post', palette: 'frost', x: s.x + px * c + pz * n, z: s.z - px * n + pz * c, rot: (s.rot || 0) + s.post[2], w: 5.2, d: 4.6 }, add, exclusions);
  record(world, { id: s.id, name: s.name, use: 'the frost gate on the White Pass road and the post that keeps it', x: s.x, z: s.z });
}

// ---------------------------------------------------------------- Kestrel Beacon
// A Compact relay tower on Kestrel Heights, kept now as a watch post: a low walled yard
// round its foot, the keeper's lodge, the signal fire on its iron cradle and a lookout
// stage on the yard wall toward the Kestrel Climb. Local frame: +z toward the Climb.
export function buildBeaconPost(world, s, exclusions, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, palette: 'salt', tag: 'beacon_post', name: s.name || 'Kestrel Beacon', lights: 4 });
  const R = s.yard ?? 13;
  // the yard wall: eight fieldstone bays round the tower, a gate toward the Climb
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8, a1 = a0 + Math.PI / 4;
    const ax = Math.sin(a0) * R, az = Math.cos(a0) * R, bx = Math.sin(a1) * R, bz = Math.cos(a1) * R;
    const mid = (a0 + a1) / 2, len = Math.hypot(bx - ax, bz - az);
    m.at((ax + bx) / 2, (az + bz) / 2, mid + Math.PI / 2, (q) => {
      const lo = q.lowest(0.8, len), hi = Math.max(0, q.highest(0.8, len));
      const gate = i === 7; // the bay facing +z
      const parts = gate ? [[-len / 2, -1.6], [1.6, len / 2]] : [[-len / 2, len / 2]];
      for (const [u0, u1] of parts) {
        q.mass(0, lo - 0.5, (u0 + u1) / 2, 0.8, hi + 1.6 - lo + 0.5, u1 - u0 + 0.05, { climbable: false });
        q.trim(0, hi + 1.6, (u0 + u1) / 2, 0.95, 0.14, u1 - u0 + 0.1, 'edge');
      }
      q.block(0, lo - 0.5, -len / 2, 0.95, hi + 2.0 - lo + 0.5, 0.95, 'stone', { walkable: false });
      if (gate) for (const e of [-1, 1]) {
        q.block(0, lo - 0.4, e * 1.8, 0.9, hi + 2.4 - lo + 0.4, 0.6, 'stone', { walkable: false });
        q.lantern(0, hi + 2.4, e * 1.8, { post: 0.2, light: e > 0, intensity: 1.2 });
      }
    });
  }
  // the keeper's lodge against the yard wall, the woodstack and the signal fire
  buildVernacular(world, { type: 'house', name: "Beacon keeper's lodge", low: true, x: s.x + s.lodge[0] * Math.cos(s.rot || 0) + s.lodge[1] * Math.sin(s.rot || 0), z: s.z - s.lodge[0] * Math.sin(s.rot || 0) + s.lodge[1] * Math.cos(s.rot || 0), rot: (s.rot || 0) + s.lodge[2], w: 7, d: 6 }, add, exclusions);
  const [fx, fz] = s.fire;
  m.k.prism(fx, 0, fz, 1.4, 0.5, 'stone2', { sides: 8 });
  m.pillar(fx, 0, fz, 1.4, 0.5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    m.k.at({ x: fx + Math.sin(a) * 0.7, y: 0.5, z: fz + Math.cos(a) * 0.7, ry: a, rx: -0.25 }, (k) => k.block(0, 0.7, 0, 0.1, 1.5, 0.1, 'metal', { layer: 'metal' }));
  }
  m.k.prism(fx, 1.85, fz, 0.95, 0.35, 'metal', { sides: 8, top: 1.3, layer: 'metal' });
  m.glow(fx, 2.25, fz, 1.2, 0.3, 1.2, 1.6, 'glow');
  m.light(fx, 2.8, fz, { color: '#ffb05a', intensity: 3, distance: 18, flicker: true, priority: 1.2 });
  for (let i = 0; i < 6; i++) m.k.at({ x: fx + 2.6, y: 0.12 + (i % 3) * 0.3, z: fz - 1 + Math.floor(i / 3) * 0.3, rz: Math.PI / 2 }, (k) => k.prism(0, -1.0, 0, 0.14, 2.0, 'wood', { sides: 6 }));
  // the lookout stage inside the yard wall beside the gate, high enough to see over it
  {
    const H = 2.4, w = 3.2, d = 2.0, cx = -5, cz = R * Math.cos(Math.PI / 8) - 0.6 - d / 2 - 0.4, lo = Math.max(0, m.lowest(w, d, cx, cz));
    m.block(cx, lo + H - 0.25, cz, w, 0.25, d, 'wood', { climbable: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.block(cx + sx * (w / 2 - 0.15), lo - 0.3, cz + sz * (d / 2 - 0.15), 0.24, H + 1.3, 0.24, 'timber', { walkable: false });
    m.rail(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, lo + H, { c: 'timber' });
    m.rail(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, lo + H, { c: 'timber' });
    m.rail(cx + w / 2, cz - d / 2 + 1.1, cx + w / 2, cz + d / 2, lo + H, { c: 'timber' });
    m.stair(cx + w / 2 - 0.55, cz - d / 2 - 8 * 0.45, 0, 1.0, lo, lo + H, { cheeks: false, base: lo - 0.3 });
    m.lantern(cx - w / 2 + 0.3, lo + H, cz + d / 2 - 0.3, { post: 1.2, light: false });
  }
  exclusions.push({ x: s.x, z: s.z, r: R + 3 });
  add(m.build());
  record(world, { id: 'kestrel_beacon', name: s.name, use: 'the old relay tower kept as a watch post over the Kestrel Climb', x: s.x, z: s.z });
}

// ---------------------------------------------------------------- light towers
// A Compact light or relay tower: an octagonal shaft that tapers in coursed stages, a door
// at its foot, slit windows up the stair, a corbelled gallery behind an iron rail and the
// lantern room under a slate cap. s.lit: whether a keeper still trims the lamp.
export function buildLightTower(world, s, exclusions, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, palette: 'salt', tag: 'lighthouse', name: s.name || 'Old Lighthouse', lights: 2 });
  const R = s.r ?? 3.2, H = s.h ?? 30, stages = 4, lo = m.lowest(R * 2.6, R * 2.6);
  m.k.prism(0, lo - 0.6, 0, R * 1.3, 1.2 - lo + 0.6, 'stone2', { sides: 8, ry: Math.PI / 8 });
  m.k.prism(0, 1.1, 0, R * 1.32, 0.12, 'edge', { sides: 8, ry: Math.PI / 8 });
  world.colliders.addCyl({ x: s.x, z: s.z, r: R * 1.2, y0: m.y + lo - 0.6, y1: m.y + 1.2, tag: 'lighthouse' });
  let y = 1.2, r = R;
  for (let i = 0; i < stages; i++) {
    const h = (H - 1.2) / stages, r1 = r * 0.93;
    m.k.prism(0, y, 0, r, h, i % 2 ? 'stone2' : 'stone', { sides: 8, top: r1 / r, ry: Math.PI / 8 });
    m.k.prism(0, y + h - 0.35, 0, r1 + 0.18, 0.35, 'edge', { sides: 8, ry: Math.PI / 8 });
    // a slit window on alternate faces, turning as the stair climbs
    const a = (i * 3 + 1) * Math.PI / 4;
    m.at(Math.sin(a) * (r + r1) / 2, Math.cos(a) * (r + r1) / 2, a, (q) => {
      if (s.lit) q.glow(0, y + h * 0.5, 0.02, 0.32, 1.3, 0.06, 1.1);
      else q.trim(0, y + h * 0.5 - 0.65, 0.02, 0.32, 1.3, 0.06, 'dark', { grad: 0 });
    });
    y += h; r = r1;
  }
  world.colliders.addCyl({ x: s.x, z: s.z, r: R, y0: m.y + 1.2, y1: m.y + H, climbable: true, tag: 'lighthouse' });
  // the door at the foot, toward s.rot's +z
  m.trim(0, 1.2, R - 0.02, 1.3, 2.4, 0.12, 'dark', { grad: 0 });
  m.doorArch(0, 3.6, R + 0.04, 1.3, 0, { pointed: false, depth: 0.25 });
  // the gallery on corbels, its rail, the lantern room and its cap
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.at(Math.sin(a) * (r + 0.35), Math.cos(a) * (r + 0.35), a, (q) => q.k.wedge(0, H - 0.9, 0, 0.6, 0.9, 0.7, 'edge', { rx: Math.PI }));
  }
  m.k.prism(0, H, 0, r + 1.1, 0.35, 'edge', { sides: 8, ry: Math.PI / 8 });
  world.colliders.addCyl({ x: s.x, z: s.z, r: r + 1.0, y0: m.y + H, y1: m.y + H + 0.35, tag: 'lighthouse' });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    m.trim(Math.sin(a) * (r + 0.95), H + 0.35, Math.cos(a) * (r + 0.95), 0.08, 1.0, 0.08, 'metal', { layer: 'metal' });
  }
  m.k.prism(0, H + 1.3, 0, r + 1.0, 0.08, 'metal', { sides: 16, top: 1, layer: 'metal' });
  const lr = r * 0.62;
  m.k.prism(0, H + 0.35, 0, lr, 0.6, 'stone', { sides: 8, ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    m.trim(Math.sin(a) * lr, H + 0.95, Math.cos(a) * lr, 0.16, 2.2, 0.16, 'metal', { layer: 'metal' });
  }
  if (s.lit) {
    m.k.prism(0, H + 0.95, 0, lr * 0.92, 2.2, 'glow', { sides: 8, layer: 'glow', strength: 1.6 });
    m.light(0, H + 2.0, 0, { intensity: 4, distance: 40, priority: 0.8 });
  } else m.k.prism(0, H + 0.95, 0, lr * 0.92, 2.2, 'dark', { sides: 8 });
  m.k.pyramid(0, H + 3.15, 0, lr + 0.5, 2.0, 'roof', { sides: 8, ry: Math.PI / 8 });
  m.k.prism(0, H + 5.1, 0, 0.1, 1.2, 'metal', { sides: 4, layer: 'metal' });
  exclusions.push({ x: s.x, z: s.z, r: R + 3 });
  add(m.build());
}

// ---------------------------------------------------------------- Signal Keepers Camp
// The lamp crews' ledge on the Signal Keepers Trail, halfway up the mountain watch: a paved
// flat walled where it falls away, the lamp store against the rock, a lean-to for the
// crews' bunks, the ledger by the fire, and the lantern line they keep along the trail up
// to the Signal Bridge, the last lamp left burning for a relief that has not come.
// s.flats: [x0, x1, z0, z1] rectangles round s (the trail's ramp is left between them);
// s.fire: the campfire's offset, whose own ground is kept open round it.
export function buildSignalCamp(world, s, exclusions, add, road) {
  const m = new Mason(world, { x: s.x, z: s.z, palette: 'enclave', tag: 'signal_camp', name: s.name || 'Signal Keepers Camp', lights: 4 });
  // level with the highest of the ledge's own ground (the rock wall behind it does not count)
  let hi = 0;
  for (const [x0, x1, z0, z1] of s.flats) for (let x = x0 + 0.5; x < x1; x += 1) for (let z = z0 + 0.5; z < z1; z += 1) {
    const g = m.ground(x, z);
    if (g < 0.8) hi = Math.max(hi, g);
  }
  const top = hi + 0.08;
  const [fx, fz] = s.fire, hole = 1.7;
  const part = (x0, x1, z0, z1) => x1 - x0 > 0.1 && z1 - z0 > 0.1 && m.footing((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, top, { c: 'floor', cap: false, sink: 0.6 });
  for (const [x0, x1, z0, z1] of s.flats) {
    const hx0 = fx - hole, hx1 = fx + hole, hz0 = fz - hole, hz1 = fz + hole;
    if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) { part(x0, x1, z0, z1); continue; }
    // the paving round the hearth: four pieces about the open square
    part(x0, hx0, z0, z1); part(hx1, x1, z0, z1); part(hx0, hx1, z0, hz0); part(hx0, hx1, hz1, z1);
  }
  const fg = m.ground(fx, fz);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    m.block(fx + Math.sin(a) * 1.35, fg - 0.2, fz + Math.cos(a) * 1.35, 0.5, top - fg + 0.32, 0.4, 'stone2', { ry: a });
  }
  // a retaining wall and a parapet wherever a flat stands over a fall
  for (const [X0, X1, Z0, Z1] of s.flats) [[X0, Z0, X1, Z0], [X1, Z0, X1, Z1], [X1, Z1, X0, Z1], [X0, Z1, X0, Z0]].forEach(([ax, az, bx, bz]) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2)), ux = (bx - ax) / len, uz = (bz - az) / len;
    for (let i = 0; i < n; i++) {
      const cx = ax + ux * len * (i + 0.5) / n, cz = az + uz * len * (i + 0.5) / n;
      const ox = uz * 0.35, oz = -ux * 0.35; // outward of a counter-clockwise rectangle
      const g = m.ground(cx + ox * 3, cz + oz * 3);
      if (g > top - 1.2) continue; // level ground or rock beyond: no wall
      if (s.flats.some(([a0, a1, b0, b1]) => cx + ox * 3 > a0 && cx + ox * 3 < a1 && cz + oz * 3 > b0 && cz + oz * 3 < b1)) continue;
      const open = (s.openings || []).some(([px, pz, r]) => Math.hypot(cx - px, cz - pz) < r);
      const ry = Math.atan2(ux, uz), seg = len / n;
      m.mass(cx + ox, Math.min(g, top) - 0.6, cz + oz, 0.7, top - Math.min(g, top) + 0.6, seg + 0.03, { ry, climbable: false });
      if (!open) m.parapet(cx + ox - ux * seg / 2, cz + oz - uz * seg / 2, cx + ox + ux * seg / 2, cz + oz + uz * seg / 2, top, { t: 0.5, h: 0.95 });
    }
  });
  // the lamp store against the rock: a stone room, its door to the fire, lamps racked inside
  m.at(s.store[0], s.store[1], s.store[2], (q) => {
    const w = 5.2, d = 4.4, H = 3.0;
    q.shell(0, 0, w, d, top, H, { t: 0.5, style: 'stone', openings: { n: [{ u: 0, w: 1.4, h: 2.4 }], e: [{ u: 0, y: 1.3, w: 0.6, h: 0.7 }] } });
    q.floor(0, top + 0.04, 0, w - 1, d - 1, 'floor', { t: 0.1 });
    q.ceiling(0, top + H - 0.25, 0, w - 1, d - 1, { solid: false, every: 1.4 });
    q.roof(0, top + H, 0, w + 0.2, d + 0.2, 1.2, { kind: 'gable', along: 'x', overhang: 0.35 });
    for (const sx of [-1, 1]) {
      F.shelves(q, sx * 1.35, top, -d / 2 + 0.75, 1.5, 2.2, { goods: ['brass', 'metal', 'glow'] });
      F.barrel(q, sx * 1.6, top, 0.9);
    }
    for (let i = 0; i < 3; i++) q.lantern(-1.8 + i * 0.5, top + 1.25, -d / 2 + 0.6, { post: 0, light: false });
    q.light(0, top + 2.3, 0, { intensity: 2, distance: 7, priority: 1.4 });
    q.shelter(0, 0, w, d, top, top + H);
  });
  // the crews' lean-to on the north rock: three bunks under a slab roof on posts
  m.at(s.shelter[0], s.shelter[1], s.shelter[2], (q) => {
    const w = s.shelter[3] ?? 6.4, d = 3.2, hB = 2.9, hF = 2.2;
    for (const sx of [-1, 0, 1]) q.block(sx * (w / 2 - 0.15), top, d / 2 - 0.15, 0.22, hF, 0.22, 'timber', { walkable: false });
    q.block(0, top, -d / 2 + 0.2, w, hB, 0.4, 'stone2', { walkable: false });
    q.k.at({ x: 0, y: (hB + hF) / 2 + top + 0.1, z: 0, rx: Math.atan2(hB - hF, d) }, (k) => k.slab(0, 0, 0, w + 0.4, 0.16, d + 0.6, 'roof'));
    for (let i = 0; i < 3; i++) F.bed(q, -w / 2 + 1.0 + i * (w - 2) / 2, top, -0.2, { w: 1.0, len: 2.0 });
    q.shelter(0, 0, w, d, top, top + hB);
  });
  // the ledger table by the fire, oil and lamp crates, a brazier for the night watch
  F.table(m, s.ledger[0], top, s.ledger[1], 1.4, 0.8, { ry: s.ledger[2] });
  m.trim(s.ledger[0], top + 0.82, s.ledger[1], 0.45, 0.04, 0.32, '#d8cfae', { ry: s.ledger[2], grad: 0 });
  m.lantern(s.ledger[0] + 0.45, top + 0.82, s.ledger[1], { post: 0, light: true, intensity: 1.2, distance: 9 });
  for (let i = 0; i < 3; i++) F.crate(m, s.crates[0], top, s.crates[1] + i * 0.9, 0.75, { ry: i * 0.3 });
  F.barrel(m, s.crates[0] - 3.6, top, s.crates[1]);
  for (const [x0, x1, z0, z1] of s.flats) exclusions.push({ x: s.x + (x0 + x1) / 2, z: s.z + (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 + 2 });
  add(m.build());
  // the lantern line: a lamp on a stone post every 9 m along the trail's outer side from its
  // foot to the bridge head, cold glass in all but the last
  if (road) {
    const lm = new Mason(world, { x: s.x, z: s.z, palette: 'enclave', tag: 'lantern_line', name: 'the Keepers’ lantern line', lights: 2 });
    const near = ([ox, oz]) => road.reduce((b, p, i) => (Math.hypot(p.x - s.x - ox, p.z - s.z - oz) < Math.hypot(road[b].x - s.x - ox, road[b].z - s.z - oz) ? i : b), 0);
    const pts = road.slice(near(s.lineFrom), near(s.lineTo) + 1);
    pts.forEach((p, i) => {
      const last = i === pts.length - 1;
      const lx = p.x - s.x + p.nx * (p.width / 2 + 1.0), lz = p.z - s.z + p.nz * (p.width / 2 + 1.0);
      const g = lm.ground(lx, lz);
      lm.block(lx, g - 0.4, lz, 0.5, 1.0, 0.5, 'stone2', { walkable: false });
      lm.k.prism(lx, g + 0.6, lz, 0.08, 1.4, 'metal', { sides: 4, layer: 'metal' });
      lm.trim(lx, g + 2.0, lz, 0.5, 0.1, 0.5, 'dark', { layer: 'metal' });
      if (last) lm.lantern(lx, g + 2.0, lz, { post: 0, light: true, intensity: 1.6, distance: 14, priority: 1.3 });
      else {
        lm.trim(lx, g + 2.1, lz, 0.3, 0.5, 0.3, 'dark', { grad: 0 });
        lm.k.pyramid(lx, g + 2.62, lz, 0.38, 0.32, 'dark', { layer: 'metal' });
      }
    });
    add(lm.build());
  }
  record(world, { id: 'signal_camp', name: s.name, use: 'the lamp crews’ ledge on the trail to the Signal Bridge, and the lantern line they keep', x: s.x, z: s.z });
}
