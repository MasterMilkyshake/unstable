// The Drowned Precincts (data/riftCity.js): the outer curtain round the city's terraces with its
// three gatehouses, the wards' tenements, the shared stairs, the Bell Ward's belfry and the
// Chain Courts' colonnade, and the worn flags of the plaza and streets.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit } from './kit.js';
import { furnishRiftInterior } from './riftInteriors.js';
import { WallFrame, circuit, CITY_PAL } from './riftWalls.js';
import {
  RIFT_CITY_CIRCUIT, RIFT_CITY_GATE_DEFS, RIFT_CITY_TOPS, RIFT_CITY_STEP_Z, RIFT_CITY_WALL_T,
  RIFT_CITY_HOUSES, RIFT_CITY_RAMPS, RIFT_CITY_LANES,
} from '../data/riftCity.js';
import { RIFT_CITADEL } from '../data/riftCitadel.js';

const CITY = { x: 6000, z: 6030 };

// The outer curtain: one run of towers and walls round the terraces, closing on the Chainward's
// barbican at both ends of its north side.
function buildCurtainCircuit(world, city, exclusions, low) {
  const F = new WallFrame(world, CITY.x, CITY.z, CITY_PAL, { tag: 'rift_city_wall', name: 'Drowned city curtain', low });
  const terrace = (z) => (z > RIFT_CITY_STEP_Z + 2 ? 'upper' : 'middle');
  const base = (z) => (terrace(z) === 'upper' ? 17 : 10.6);
  const nodes = RIFT_CITY_CIRCUIT.map((n) => {
    const x = n.x - CITY.x, z = n.z - CITY.z;
    const top = RIFT_CITY_TOPS[terrace(n.z)];
    if (n.kind === 'gate') {
      const def = RIFT_CITY_GATE_DEFS[n.gate];
      const yaw = n.x < 5900 ? Math.PI / 2 : n.x > 6100 ? -Math.PI / 2 : 0;
      return { x, z, kind: 'gate', def, yaw, top: Math.max(top, n.gate === 'garrison' ? RIFT_CITY_TOPS.upper : top), floor: base(n.z) };
    }
    const corner = n.kind === 'corner';
    return { x, z, kind: 'tower', top, base: base(n.z), w: corner ? 11 : n.kind === 'join' ? 8 : 9,
      rise: n.step ? 12 : corner ? 6 : 4, roof: corner ? 'hip' : undefined, lit: corner };
  });
  const out = circuit(F, nodes, {
    t: RIFT_CITY_WALL_T,
    runTop: (mx, mz) => RIFT_CITY_TOPS[terrace(mz + CITY.z)],
    outward: (mx, mz, nx, nz) => (nx * mx + nz * mz > 0 ? 1 : -1),
  });
  city.add(F.build());
  exclusions.push(...F.ex);
  for (const p of out.lights) world.addLight(p, '#ffc27a', 1.2, 16, true, 0.8);
  world.riftCityWalls = out;
  return out;
}

// Worn flags: one-off stones in courses across a strip, a few lifted or missing, settled into
// the ground they lie on.
// Street flags: the city's stone, a shade darker underfoot and of near tones.
const FLAGS = ['#56645f', '#505e5a', '#5b6a65', '#4b5955'];
function flags(k, world, ax, az, bx, bz, width, rng, o = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux;
  const ry = Math.atan2(ux, uz);
  const fl = o.flag ?? 1.9;
  const rows = Math.max(1, Math.round(width / 1.5));
  for (let u = 0; u < len; u += fl) {
    for (let r = 0; r < rows; r++) {
      const v = -width / 2 + (r + 0.5) * (width / rows);
      const shift = (r % 2) * fl * 0.5;
      const uu = Math.min(len - fl * 0.5, u + shift);
      const x = ax + ux * uu + nx * v, z = az + uz * uu + nz * v;
      const h = rng();
      if (h < 0.05) continue; // a flag gone, the bed showing
      const y = world.terrain.heightAt(x, z);
      const c = h < 0.08 ? '#64726d' : FLAGS[Math.floor(h * 991) % FLAGS.length];
      k.slab(x - o.ox, y - 0.06, z - o.oz, (width / rows) - 0.08 - rng() * 0.12, 0.14 + (h > 0.92 ? 0.08 : 0), fl * (0.86 + rng() * 0.1), c,
        { ry: ry + (rng() - 0.5) * 0.08, rz: h > 0.92 ? (rng() - 0.5) * 0.12 : 0, grad: 0.04, jitter: 0.03, strength: 0.86 + rng() * 0.1 });
    }
  }
}

// A terrace stair: flights of the city's stone between stepped cheek walls, a newel at each end
// and the middle, and a lamp on each end newel, lit at the foot and the head.
function cityStair(world, s, low) {
  const y0 = s.y ?? world.terrain.heightAt(s.x, s.z), y1 = s.y2 ?? world.terrain.heightAt(s.x2, s.z2);
  const len = Math.hypot(s.x2 - s.x, s.z2 - s.z), yaw = Math.atan2(s.x2 - s.x, s.z2 - s.z);
  const w = s.w || 4, rise = y1 - y0, n = Math.max(2, Math.ceil(Math.abs(rise) / 0.34)), run = len / n;
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const at = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
  const k = new Kit(CITY_PAL, { detail: low ? 0 : 1 });
  for (let i = 0; i < n; i++) {
    const top = (rise * (i + 1)) / n, zc = run * (i + 0.5);
    k.slab(0, top - 2.2, zc, w, 2.2, run + 0.05, i % 2 ? 'stone' : 'stone2');
    const [x, z] = at(0, zc);
    world.colliders.addBox({ x, z, w, d: run + 0.05, y0: y0 + top - 2.2, y1: y0 + top, rot: yaw, tag: 'stair' });
    for (const sx of [-1, 1]) {
      k.slab(sx * (w / 2 + 0.28), top - 1.2, zc, 0.56, 2.1, run + 0.06, 'stone2');
      // the cheek's collider steps with the drawn cheek, 0.9 m over its tread: one box the
      // flight's whole length at the head's height stood an invisible wall up to the rise
      // over the foot (7 m beside the Ascent lift), and nothing could be jumped over or onto
      const [cx, cz] = at(sx * (w / 2 + 0.28), zc);
      world.colliders.addBox({ x: cx, z: cz, w: 0.56, d: run + 0.06, y0: y0 + top - 1.2, y1: y0 + top + 0.9, rot: yaw, climbable: true, tag: 'stair' });
    }
  }
  for (const sx of [-1, 1]) {
    const cx = sx * (w / 2 + 0.28);
    for (let i = 0; i <= 2; i++) {
      const tz = (len * i) / 2, ty = (rise * i) / 2;
      k.masonry(cx, ty - 1.2, tz, 0.8, 2.6, 0.8, { course: 0.5 });
      // the newel is solid too: walked and looked through before (the camera parked in its lamp)
      const [nx, nz] = at(cx, tz);
      world.colliders.addBox({ x: nx, z: nz, w: 0.95, d: 0.95, y0: y0 + ty - 1.2, y1: y0 + ty + 1.6, rot: yaw, climbable: true, walkable: false, tag: 'stair' });
      k.slab(cx, ty + 1.4, tz, 0.95, 0.2, 0.95, 'edge');
      if (i === 1) continue;
      const flame = k.lantern(cx, ty + 1.6, tz, { post: 0.9, metal: 'metal', strength: 0.9 });
      if (sx > 0) world.addLight(flame.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(s.x, y0, s.z)), '#e0a060', 0.9, 11, true, 0.6);
    }
  }
  const g = k.build('rift_city_stair');
  g.position.set(s.x, y0, s.z);
  g.rotation.y = yaw;
  return g;
}

export function buildRiftCity(world, exclusions) {
  const low = !!(G.settings && G.settings.quality === 'low');
  const city = new THREE.Group(); city.name = 'The Drowned Precincts';
  buildCurtainCircuit(world, city, exclusions, low);
  const part = (x, z, yaw, name, build, baseY = world.terrain.heightAt(x, z)) => {
    const y = baseY, k = new Kit(CITY_PAL);
    const box = (lx, base, lz, w, h, d, color = 'stone', collision = true) => {
      if (h > 3 && color === 'stone') k.masonry(lx, base, lz, w, h, d);
      else k.slab(lx, base, lz, w, h, d, color);
      if (collision) world.colliders.addBox({ x: x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z: z - Math.sin(yaw) * lx + Math.cos(yaw) * lz, w, d, y0: y + base, y1: y + base + h, rot: yaw, tag: 'rift_city' });
    };
    build(k, box, y);
    const g = k.build(name); g.position.set(x, y, z); g.rotation.y = yaw; city.add(g);
    exclusions.push({ x, z, r: 13 });
  };
  for (const [i, house] of RIFT_CITY_HOUSES.entries()) {
    const { x, z, yaw, w, d, floors, roof } = house;
    const atGround = (lx, lz) => world.terrain.heightAt(x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz);
    let baseY = atGround(0, 0);
    for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) baseY = Math.max(baseY, atGround(ix * w / 4, iz * d / 4));
    part(x, z, yaw, 'Drowned ward tenement', (k, box, y) => {
      const h = floors * 3.8, front = d / 2;
      const grounds = [];
      for (const dx of [-w / 2, 0, w / 2]) for (const dz of [-front, 0, front]) grounds.push(world.terrain.heightAt(x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz) - y);
      const bottom = Math.min(-0.6, ...grounds) - 0.4;
      // Solid foundations and enterable ground floors; upper storeys close the skyline.
      box(0, bottom, 0, w, -bottom + 0.12, d, 'stone2');
      box(0, 0, -front + 0.5, w, h, 1);
      for (const side of [-1, 1]) {
        box(side * (w / 2 - 0.5), 0, 0, 1, h, d);
        box(side * (w / 4 + 0.65), 0, front - 0.5, w / 2 - 1.3, h, 1);
      }
      box(0, 3.1, front - 0.5, 2.6, h - 3.1, 1);
      box(0, 3.6, 0, w - 1, 0.25, d - 1, 'stone2');
      for (let floor = 0; floor < floors; floor++) {
        const yy = floor * 3.8;
        box(0, yy + 3.25, 0, w + 0.35, 0.35, d + 0.35, 'edge', false);
        for (const face of [-1, 1]) for (const xx of [-w * 0.29, 0, w * 0.29]) {
          if (floor === 0 && face === 1 && xx === 0) continue;
          k.window(xx, yy + 0.85, face * (front + 0.03), 0.95, 1.65,
            { ry: face < 0 ? Math.PI : 0, pointed: floor === 0, lit: (i + floor * 3 + Math.round(xx)) % 11 === 0, strength: 0.9 });
        }
        for (const side of [-1, 1]) for (const zz of [-2.7, 2.7]) k.window(side * (w / 2 + 0.03), yy + 0.85, zz, 0.9, 1.6, { ry: side * Math.PI / 2 });
      }
      box(0, h, 0, w + 0.7, 0.5, d + 0.7, 'stone2');
      if (roof === 'dome') {
        k.prism(0, h + 0.5, 0, 5.4, 0.6, 'dark', { sides: 12 });
        k.roof('dome', 0, h + 1.1, 0, 10.8, 10.8, 4.4, { sides: 12 });
        k.prism(0, h + 5.5, 0, 0.3, 1, 'metal', { sides: 6 });
      } else {
        k.roof(roof, 0, h + 0.5, 0, w, d, 4.2 + i % 3, { overhang: 0.5 });
        if (i % 3 === 0) box(w * 0.28, h + 0.5, -2, 1.2, 5.5, 1.3, 'stone2');
        if (roof === 'gable') for (const zz of [-front - 0.3, front + 0.3]) k.wedge(0, h + 0.5, zz, w + 0.5, 4.4 + i % 3, 0.35, 'dark');
      }
      furnishRiftInterior(world, house, i, y, k, box);
      if (i % 4 === 0) k.banner(w * 0.3, 4, front + 0.35, 1.3, 3.4);
      if (i % 3 === 0) k.lantern(-1.8, 2.8, front + 0.35, { post: 0, strength: 1.1 });
    }, baseY);
  }
  // The Bell Ward's belfry: four piers under a bell-chamber and its cap, the bell still hung.
  part(5912, 6026, 0, 'The drowned belfry', (k, box) => {
    for (const x of [-3.2, 3.2]) for (const z of [-3.2, 3.2]) box(x, -1, z, 1.8, 15, 1.8);
    box(0, 13, 0, 9, 1, 9, 'edge');
    for (const [x, z, w, d] of [[0, -4.1, 8.2, 0.6], [0, 4.1, 8.2, 0.6], [-4.1, 0, 0.6, 8.2], [4.1, 0, 0.6, 8.2]]) box(x, 14, z, w, 1.1, d, 'stone2');
    // corner posts carry the cap over the bell-chamber's open sides
    for (const x of [-4.05, 4.05]) for (const z of [-4.05, 4.05]) box(x, 15.1, z, 0.9, 3.4, 0.9, 'stone2');
    box(0, 18.5, 0, 9.6, 0.8, 9.6, 'stone2');
    k.roof('hip', 0, 19.3, 0, 9, 9, 5, { c: 'roof' });
    k.prism(0, 15, 0, 1.4, 2.4, 'metal', { sides: 8, top: 0.55, layer: 'metal' });
    k.slab(0, 17.4, 0, 0.3, 1.1, 0.3, 'metal', { layer: 'metal' });
    k.slab(0, 18.4, 0, 6.6, 0.3, 0.3, 'dark');
  });
  // The Chain Courts' colonnade: where the chain's clerks met, an arcade on a stepped base.
  part(6080, 6024, 0, 'The Chain Courts colonnade', (k, box) => {
    box(0, -1, 0, 14, 1.2, 8, 'stone2');
    for (const x of [-5.6, -1.9, 1.9, 5.6]) for (const z of [-2.6, 2.6]) k.column(x, 0.2, z, 6.4, 0.45, { sides: 8 });
    for (const x of [-5.6, -1.9, 1.9, 5.6]) for (const z of [-2.6, 2.6]) world.colliders.addBox({ x: 6080 + x, z: 6024 + z, w: 1, d: 1, y0: 10, y1: 17.5, tag: 'rift_city' });
    box(0, 6.6, 0, 13.6, 0.8, 7, 'edge');
    k.roof('hip', 0, 7.4, 0, 13, 6.4, 2.6, { c: 'roof' });
    k.slab(0, 0.2, 0, 3.2, 0.9, 1.6, 'stone');
  });
  for (const r of RIFT_CITY_RAMPS) city.add(cityStair(world, r, low));
  // The plaza before the citadel and the streets: worn flags, a few gone.
  {
    const rng = (() => { let s = 4242; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    const k = new Kit(CITY_PAL, { detail: low ? 0 : 1 });
    const o = { ox: CITY.x, oz: CITY.z };
    const C = RIFT_CITADEL;
    const plazaN = C.z + C.front - 2, plazaS = 5951 + RIFT_CITY_WALL_T / 2 + 0.5;
    flags(k, world, C.x - C.halfWidth + 2, (plazaN + plazaS) / 2, C.x + C.halfWidth - 2, (plazaN + plazaS) / 2, plazaN - plazaS, rng, { ...o, flag: 2.1 });
    if (!low) for (const [ax, az, bx, bz, width] of RIFT_CITY_LANES) {
      // the plaza's own flags carry the street across it
      if (az === bz && az < C.z + C.front && az > 5951) {
        flags(k, world, ax, az, C.x - C.halfWidth + 2, az, width - 1, rng, o);
        flags(k, world, C.x + C.halfWidth - 2, az, bx, bz, width - 1, rng, o);
      } else flags(k, world, ax, az, bx, bz, width - 1, rng, o);
    }
    const g = k.build('rift_city_flags');
    g.position.set(CITY.x, 0, CITY.z);
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    city.add(g);
  }
  // Bare ground between buildings provides circulation; keep vegetation out of these passages.
  for (const [ax, az, bx, bz, width] of RIFT_CITY_LANES) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.15);
    for (let i = 0; i <= steps; i++) {
      exclusions.push({ x: ax + (bx - ax) * i / steps, z: az + (bz - az) * i / steps, r: width / 2 + 2 });
    }
  }
  world.scene.add(city); world.riftCity = city;
}
