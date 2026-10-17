// Tidebound architecture: the timber-and-plaster style of the Anchorage's surviving towns.
// Flared hip roofs with upturned eaves, dark timber frames over pale plaster, lattice windows,
// stone plinths that step down to uneven ground, and asymmetric wings, porches and towers.
// Each region builds with its own materials (STYLES). Everything is static and batched by
// world/merge.js; colliders keep floors, plinths and roofs walkable and walls climbable.
import * as THREE from 'three';
import { PALETTES } from './style.js';
import { Kit, groundRange } from './kit.js';
import { addShelter } from './mason.js';
import { kneelingFigure, linksAlong, KNEELING_HANDS } from './riftOmens.js';

export const STYLES = Object.fromEntries(['salt', 'redwake', 'reed', 'frost', 'cinder', 'root', 'enclave', 'hush'].map((k) => [k, PALETTES[k]]));
// Codex-era palette names map onto building styles.
const PALETTE_STYLE = { harbor: 'salt', ruin: 'salt', drowned: 'hush' };
export const styleFor = (s) => STYLES[s.style] || STYLES[PALETTE_STYLE[s.palette] || s.palette] || STYLES.salt;

const hash = (x, z, k = 0) => {
  const h = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

// ---------------------------------------------------------------- geometry
// A hip roof whose eaves sweep up at the corners. Footprint w x d (without eaves) centered at
// the origin; base at y = 0. Concave profile: steep near the ridge, flattening at the eaves.
export function flaredRoofGeometry(w, d, rise, eave = 1.2, curl = 0.9, segs = 6) {
  const ex = w / 2 + eave;
  const ez = d / 2 + eave;
  const rx = w >= d ? ((w - d) / 2) * 0.92 : 0;
  const rz = d > w ? ((d - w) / 2) * 0.92 : 0;
  // ring: [halfX, halfZ, height, curlScale]
  const rings = [
    [ex, ez, -0.05, 1],
    [ex * 0.62 + rx * 0.38, ez * 0.62 + rz * 0.38, rise * 0.32, 0.45],
    [ex * 0.3 + rx * 0.7, ez * 0.3 + rz * 0.7, rise * 0.7, 0.12],
    [rx, rz, rise, 0],
  ];
  const corners = (hx, hz) => [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  const pos = [];
  const pt = (ring, side, u) => {
    const [hx, hz, hy, cs] = rings[ring];
    const c = corners(hx, hz);
    const a = c[side];
    const b = c[(side + 1) % 4];
    const t = Math.abs(u * 2 - 1);
    const lift = curl * cs * t * t * t - (ring === 0 ? 0.12 * (1 - t * t) : 0);
    return [a[0] + (b[0] - a[0]) * u, hy + lift, a[1] + (b[1] - a[1]) * u];
  };
  for (let side = 0; side < 4; side++) {
    for (let r = 0; r < rings.length - 1; r++) {
      for (let i = 0; i < segs; i++) {
        const u0 = i / segs;
        const u1 = (i + 1) / segs;
        const a = pt(r, side, u0);
        const b = pt(r, side, u1);
        const c = pt(r + 1, side, u1);
        const e = pt(r + 1, side, u0);
        pos.push(...a, ...e, ...b, ...b, ...e, ...c);
      }
    }
    // fascia: a thin band hanging under the eave line
    for (let i = 0; i < segs; i++) {
      const a = pt(0, side, i / segs);
      const b = pt(0, side, (i + 1) / segs);
      const a2 = [a[0], a[1] - 0.32, a[2]];
      const b2 = [b[0], b[1] - 0.32, b[2]];
      pos.push(...a2, ...a, ...b2, ...b2, ...a, ...b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- kit
// A builder bound to one group (local coordinates, rotated with the group).
export function tide(world, g, st, mat, tag) {
  const yaw = g.rotation.y;
  const UP = new THREE.Vector3(0, 1, 0);
  const M = {};
  const m = (k, o) => (M[k + (o ? JSON.stringify(o) : '')] ||= mat(st[k] || k, o || {}));
  const wp = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(UP, yaw).add(g.position);
  const solid = (x, y0, z, w, h, d, opts = {}) => {
    const p = wp(x, 0, z);
    world.colliders.addBox({ x: p.x, z: p.z, w, d, y0: g.position.y + y0, y1: g.position.y + y0 + h, rot: yaw + (opts.rot || 0), tag, climbable: opts.climbable ?? true });
  };
  const box = (x, y, z, w, h, d, key, collide = false, rotY = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof key === 'string' ? m(key) : key);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    if (collide) solid(x, y - h / 2, z, w, h, d, { rot: rotY });
    return mesh;
  };
  const glow = () => m('glass', { emissive: st.glass, ei: 0.45 });
  const ground = (x, z) => world.terrain.heightAt(...(() => { const p = wp(x, 0, z); return [p.x, p.z]; })()) - g.position.y;

  // lowest / highest ground under a local rectangle
  const groundRange = (x, z, w, d) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [sx, sz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0]]) {
      const gh = ground(x + sx * w, z + sz * d);
      lo = Math.min(lo, gh);
      hi = Math.max(hi, gh);
    }
    return [lo, hi];
  };

  // stone plinth from the ground up to `top` (local y), with a capping course
  const plinth = (x, z, w, d, top, key = 'stone') => {
    const [lo] = groundRange(x, z, w, d);
    const bottom = Math.min(lo, top) - 1.5;
    box(x, (top + bottom) / 2, z, w, top - bottom, d, key, true);
    box(x, top - 0.12, z, w + 0.3, 0.24, d + 0.3, 'stone2');
  };

  // timber-framed plaster storey: posts, rails, studs and lattice windows on all four faces
  const storey = (x, y0, z, w, d, h, opts = {}) => {
    box(x, y0 + h / 2, z, w, h, d, opts.plaster || 'plaster', true);
    const t = 0.32;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + (sx * w) / 2, y0 + h / 2, z + (sz * d) / 2, t, h + 0.05, t, 'timber');
    for (const yy of [y0 + 0.15, y0 + h - 0.15]) {
      box(x, yy, z + d / 2 + 0.04, w + 0.1, 0.26, 0.12, 'timber');
      box(x, yy, z - d / 2 - 0.04, w + 0.1, 0.26, 0.12, 'timber');
      box(x + w / 2 + 0.04, yy, z, 0.12, 0.26, d + 0.1, 'timber');
      box(x - w / 2 - 0.04, yy, z, 0.12, 0.26, d + 0.1, 'timber');
    }
    const faces = [
      [0, d / 2, w, 0],
      [0, -d / 2, w, Math.PI],
      [w / 2, 0, d, Math.PI / 2],
      [-w / 2, 0, d, -Math.PI / 2],
    ];
    faces.forEach(([fx, fz, span, ry], fi) => {
      const bays = Math.max(1, Math.round(span / 3.2));
      for (let b = 0; b < bays; b++) {
        const u = (b + 0.5) / bays - 0.5;
        const lx = Math.cos(ry) * u * span;
        const lz = -Math.sin(ry) * u * span;
        const nx = Math.sin(ry);
        const nz = Math.cos(ry);
        const px = x + fx + lx;
        const pz = z + fz + lz;
        if (b > 0) box(px - Math.cos(ry) * (span / bays) * 0.5 + nx * 0.05, y0 + h / 2, pz + Math.sin(ry) * (span / bays) * 0.5 + nz * 0.05, 0.18, h - 0.3, 0.18, 'timber');
        if (opts.door && fi === 0 && b === Math.floor(bays / 2)) {
          box(px + nx * 0.08, y0 + 1.25, pz + nz * 0.08, 1.5, 2.5, 0.12, 'timber', false, ry);
          box(px + nx * 0.12, y0 + 2.62, pz + nz * 0.12, 1.9, 0.22, 0.14, 'stone2', false, ry);
          continue;
        }
        if (hash(px, pz, y0) < (opts.blank ?? 0.12)) continue;
        const wy = y0 + h * 0.55;
        box(px + nx * 0.06, wy, pz + nz * 0.06, 1.25, 1.2, 0.1, glow(), false, ry);
        box(px + nx * 0.1, wy, pz + nz * 0.1, 1.45, 0.12, 0.08, 'timber', false, ry);
        box(px + nx * 0.1, wy - 0.62, pz + nz * 0.1, 1.55, 0.14, 0.2, 'timber', false, ry);
        box(px + nx * 0.1, wy + 0.62, pz + nz * 0.1, 1.55, 0.14, 0.2, 'timber', false, ry);
        box(px + nx * 0.1, wy, pz + nz * 0.1, 0.1, 1.25, 0.08, 'timber', false, ry);
      }
    });
  };

  // flared hip roof with ridge cap and corner finials; stepped colliders keep it walkable
  const roof = (x, y, z, w, d, rise, opts = {}) => {
    const eave = opts.eave ?? 1.1;
    const curl = opts.curl ?? 0.85;
    const r = new THREE.Mesh(flaredRoofGeometry(w, d, rise, eave, curl), m(opts.key || 'roof', { double: true }));
    r.position.set(x, y, z);
    r.castShadow = true;
    r.receiveShadow = true;
    g.add(r);
    const rx = w >= d ? ((w - d) / 2) * 0.92 : 0;
    const rz = d > w ? ((d - w) / 2) * 0.92 : 0;
    box(x, y + rise + 0.1, z, rx * 2 + 0.5, 0.3, rz * 2 + 0.5, 'ridge');
    for (const sx of [-1, 1]) {
      const end = w >= d ? [x + sx * (rx + 0.2), z] : [x, z + sx * (rz + 0.2)];
      box(end[0], y + rise + 0.45, end[1], 0.3, 0.8, 0.3, 'ridge');
    }
    // corner rafter tips
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tip = box(x + sx * (w / 2 + eave + 0.15), y + curl + 0.05, z + sz * (d / 2 + eave + 0.15), 0.22, 0.22, 0.9, 'ridge');
      tip.rotation.y = Math.atan2(sx, sz);
      tip.rotation.x = -0.6;
    }
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps;
      solid(x, y - 0.1, z, Math.max(1, (w + eave * 2) * (1 - f) + rx * 2 * f), rise * f * 0.85 + 0.3, Math.max(1, (d + eave * 2) * (1 - f) + rz * 2 * f));
    }
    if (opts.snow) {
      const cap = new THREE.Mesh(flaredRoofGeometry(w * 0.7, d * 0.7, rise * 0.6, eave * 0.4, curl * 0.3), m('#f4f7fa', { double: true }));
      cap.position.set(x, y + rise * 0.42, z);
      g.add(cap);
    }
    return r;
  };

  // hanging paper lantern on a short bracket, with a light source
  const lantern = (x, y, z, light = true) => {
    box(x, y + 0.55, z, 0.06, 0.5, 0.06, 'timber');
    box(x, y, z, 0.5, 0.65, 0.5, m('lantern', { emissive: st.lantern, ei: 1.4 }));
    box(x, y + 0.36, z, 0.6, 0.08, 0.6, 'timber');
    box(x, y - 0.36, z, 0.6, 0.08, 0.6, 'timber');
    if (light) world.addLight(wp(x, y, z), st.lantern, 0.9, 11, true, 0.6);
  };

  const rail = (x0, z0, x1, z1, y, h = 1.0) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    box((x0 + x1) / 2, y + h, (z0 + z1) / 2, 0.14, 0.14, len, 'timber', false, ry);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) box(x0 + ((x1 - x0) * i) / n, y + h / 2, z0 + ((z1 - z0) * i) / n, 0.14, h, 0.14, 'timber');
  };

  return { box, solid, plinth, storey, roof, lantern, rail, glow, ground, groundRange, wp, m };
}

// ---------------------------------------------------------------- dwellings
// type: house | inn | smithy | barracks — all asymmetric, all on plinths.
export function buildDwelling(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  const baseY = world.terrain.heightAt(s.x, s.z);
  g.position.set(s.x, baseY, s.z);
  g.rotation.y = s.rot || 0;
  g.name = s.name || `${s.type} (${s.palette || s.style || 'salt'})`;
  const k = tide(world, g, st, mat, s.type);
  const w = s.w || 9;
  const d = s.d || 8;
  const v = Math.floor(hash(s.x, s.z, 3) * 4);
  // level the floor with the uphill corner; the downhill side shows its foundation
  const [, hi] = k.groundRange(0, 0, w + 2, d + 2);
  const floor = Math.max(0.5, hi + 0.45);
  const stilts = st.stilts;
  if (stilts) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box((sx * w) / 2, floor / 2 - 0.5, (sz * d) / 2, 0.4, floor + 1.6, 0.4, 'timber', true);
    k.box(0, floor - 0.15, 0, w + 1.6, 0.3, d + 1.6, 'timber', true);
  } else k.plinth(0, 0, w + 1.2, d + 1.2, floor);
  const H = 3.4;
  const floors = s.type === 'inn' ? 3 : s.type === 'barracks' ? 2 : s.type === 'smithy' ? 1 : s.low ? 1 : 1 + (v % 2);
  // main block, upper storeys slightly jettied out over the street
  for (let f = 0; f < floors; f++) {
    const jut = f > 0 ? 0.5 : 0;
    k.storey(0, floor + f * H, f > 0 ? 0.25 : 0, w + jut, d + jut * 0.5, H, { door: f === 0, plaster: f % 2 ? 'plaster2' : 'plaster' });
    if (f > 0 && f < floors) {
      // skirt roof between storeys
      k.roof(0, floor + f * H - 0.15, f > 0 ? 0.25 : 0, w + jut - 0.6, d + jut * 0.5 - 0.6, 0.9, { eave: 0.9, curl: 0.45, key: 'roof2' });
    }
  }
  const top = floor + floors * H;
  const mainRise = Math.min(w, d) * (s.type === 'inn' ? 0.5 : 0.55);
  k.roof(0, top, floors > 1 ? 0.25 : 0, w + 0.4, d + 0.4, mainRise, { snow: st === STYLES.frost });
  // a second, smaller tier rising through the ridge of tall halls
  if (s.type === 'inn' || (s.type === 'barracks' && st === STYLES.enclave)) {
    const ty = top + mainRise * 0.55;
    k.storey(0, ty, 0.25, w * 0.4, d * 0.4, 2.8, { blank: 0.3 });
    k.roof(0, ty + 2.8, 0.25, w * 0.4, d * 0.4, Math.min(w, d) * 0.3, { eave: 0.9, curl: 0.8, snow: st === STYLES.frost });
  }
  // asymmetric wing / annex / porch
  const side = hash(s.x, s.z, 7) < 0.5 ? -1 : 1;
  if (v === 0 || s.type === 'inn') {
    const ww = w * 0.55;
    const wd = d * 0.7;
    const wx = side * (w / 2 + ww / 2 - 0.2);
    const wz = -d * 0.12;
    const [, whi] = k.groundRange(wx, wz, ww, wd);
    const wf = Math.max(floor - 1.2, whi + 0.4);
    k.plinth(wx, wz, ww + 1, wd + 1, wf);
    k.storey(wx, wf, wz, ww, wd, H * 0.9, {});
    k.roof(wx, wf + H * 0.9, wz, ww, wd, Math.min(ww, wd) * 0.5, { eave: 0.9, snow: st === STYLES.frost });
  } else if (v === 1) {
    // lean-to annex at the back
    k.box(0, floor + 1.2, -d / 2 - 1.4, w * 0.7, 2.4, 2.6, 'plaster2', true);
    k.roof(0, floor + 2.4, -d / 2 - 1.4, w * 0.7, 2.6, 0.9, { eave: 0.7, curl: 0.3, key: 'roof2' });
  } else if (v === 2 && floors > 1) {
    // exterior stair to the upper floor
    for (let i = 0; i < 7; i++) k.box(side * (w / 2 + 0.9), floor + 0.25 + i * (H / 7), d / 2 - 0.8 - i * 0.62, 1.2, 0.3, 0.7, 'timber', true);
    k.rail(side * (w / 2 + 1.5), d / 2 - 0.6, side * (w / 2 + 1.5), d / 2 - 4.8, floor + H * 0.5);
  }
  // porch over the door: two posts and a small flared roof
  const pz = d / 2 + 1.3;
  for (const sx of [-1, 1]) k.box(sx * 1.6, floor + 1.4, pz + 0.4, 0.28, 2.8, 0.28, 'timber', true);
  k.roof(0, floor + 2.8, pz - 0.1, 3.6, 1.8, 0.7, { eave: 0.5, curl: 0.5, key: 'roof2' });
  k.lantern(side * 2.1, floor + 2.2, pz + 0.9, s.type !== 'house' || v === 0);
  // steps up to a raised door
  const doorGround = k.ground(0, pz + 1.4);
  const rise = floor - doorGround;
  if (rise > 0.6) {
    const n = Math.min(10, Math.ceil(rise / 0.4));
    for (let i = 0; i < n; i++) {
      const hh = floor - (i + 1) * (rise / n) + 0.2;
      k.box(0, (hh + doorGround - 0.5) / 2, pz + 0.5 + i * 0.55, 2.2, Math.max(0.3, hh - doorGround + 0.5), 0.55, 'stone', true);
    }
  }
  // type details
  if (s.type === 'smithy') {
    const sx = -side;
    const shedX = sx * (w / 2 + 2.6);
    for (const zz of [-2.4, 2.4]) k.box(shedX + sx * 2, floor + 1.6, zz, 0.3, 3.2, 0.3, 'timber', true);
    k.roof(shedX, floor + 3.1, 0, 4.4, 6, 0.8, { eave: 0.6, curl: 0.4, key: 'roof2' });
    k.box(shedX, floor + 0.55, -1.2, 1.8, 1.1, 1.4, 'stone2', true);
    k.box(shedX, floor + 1.15, -1.2, 1.2, 0.18, 0.8, mat('#ff6a1a', { emissive: '#ff4a10', ei: 2 }));
    k.box(shedX, floor + 0.65, 1.4, 0.9, 0.6, 0.45, mat('#3a3a40', { metalness: 0.6, roughness: 0.4 }), true);
    k.box(shedX - sx * 0.5, top + 1.5, -d * 0.25, 1.3, top - floor + 4, 1.3, 'stone2');
    world.addLight(k.wp(shedX, floor + 1.6, -1.2), '#ff7a2f', 2.2, 14, true);
  }
  if (s.type === 'inn') {
    // balcony on the first floor with a string of lanterns
    k.box(0, floor + H + 0.1, d / 2 + 1.1, w * 0.8, 0.22, 1.9, 'timber', true);
    k.rail((-w * 0.8) / 2, d / 2 + 2, (w * 0.8) / 2, d / 2 + 2, floor + H + 0.1, 1.0);
    for (let i = 0; i < 4; i++) k.lantern(-w * 0.3 + i * w * 0.2, floor + H * 2 - 0.6, d / 2 + 1.9, i % 2 === 0);
    k.box(side * (w / 2 + 0.6), floor + 3.4, d / 2 - 0.6, 0.12, 1.2, 1.9, 'accent');
  }
  if (s.type === 'barracks') {
    for (const sx of [-1, 1]) k.box(sx * (w / 2 + 0.2), floor + H * 1.4, d / 2 + 0.15, 1.4, 3.6, 0.08, 'cloth');
  }
  add(g);
  return { group: g, floor: baseY + floor, top: baseY + top };
}

// ---------------------------------------------------------------- pagoda tower
// Tiered tower (attunement observatories, shrines, Ministry spires). s: { x, z, r, h, tiers? }
export function buildPagoda(world, s, add, mat, opts = {}) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
  g.rotation.y = s.rot || 0;
  g.name = s.name || 'pagoda';
  const k = tide(world, g, st, mat, 'pagoda');
  const base = (s.r || 6) * 1.6;
  const tiers = s.tiers || Math.max(3, Math.round((s.h || 22) / 6.5));
  const [, hi] = k.groundRange(0, 0, base + 3, base + 3);
  let y = Math.max(0.6, hi + 0.6);
  k.plinth(0, 0, base + 3, base + 3, y);
  for (let i = 0; i < tiers; i++) {
    const f = 1 - i * (0.55 / tiers);
    const w = base * f;
    const h = i === 0 ? 4.6 : 3.6;
    k.storey(0, y, 0, w, w, h, { door: i === 0, blank: 0.25 });
    // balcony ring on the second tier
    if (i === 1) {
      k.box(0, y + 0.05, 0, w + 2.4, 0.22, w + 2.4, 'timber', true);
      for (const [a, b, c, dd] of [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]]) k.rail(a * (w / 2 + 1.1), b * (w / 2 + 1.1), c * (w / 2 + 1.1), dd * (w / 2 + 1.1), y + 0.05, 0.9);
    }
    y += h;
    const last = i === tiers - 1;
    k.roof(0, y, 0, w + 0.3, w + 0.3, last ? w * 0.75 : w * 0.32, { eave: last ? 1.3 : 1.6, curl: last ? 1.0 : 1.2 });
    if (!last) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lantern(sx * (w / 2 + 1.3), y - 0.7, sz * (w / 2 + 1.3), sx > 0 && sz > 0);
    }
    y += last ? w * 0.75 : 0.9;
  }
  // finial: stacked rings and an orb
  for (let i = 0; i < 4; i++) k.box(0, y + 0.3 + i * 0.55, 0, 0.9 - i * 0.15, 0.25, 0.9 - i * 0.15, 'ridge');
  const orbColor = opts.orb || st.lantern;
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat(orbColor, { emissive: orbColor, ei: 1.8 }));
  orb.position.set(0, y + 3.1, 0);
  orb.userData.dynamic = true;
  g.add(orb);
  world.animated.push((t) => {
    orb.rotation.y = t * 0.6;
    orb.position.y = y + 3.1 + Math.sin(t * 1.3) * 0.2;
  });
  world.addLight(k.wp(0, y + 3, 0), orbColor, 1.6, 26);
  add(g);
  return g;
}

// ---------------------------------------------------------------- watchtower
// Tall timber lookout on braced legs with a lattice cabin and flared cap.
export function buildWatchtower(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
  g.rotation.y = s.rot || 0;
  g.name = s.name || 'watchtower';
  const k = tide(world, g, st, mat, 'watchtower');
  if (st === STYLES.enclave) {
    const h = s.h || 18, w = 6.4;
    const [lo, hi] = k.groundRange(0, 0, w + 1, w + 1);
    k.box(0, (lo - 1 + hi + h) / 2, 0, w, hi + h - lo + 1, w, 'stone2', true);
    for (const side of [-1, 1]) {
      for (const y of [4, 9, 14]) {
        k.box(0, hi + y, side * (w / 2 + 0.03), 0.7, 2, 0.1, 'timber');
        k.box(side * (w / 2 + 0.03), hi + y, 0, 0.1, 2, 0.7, 'timber');
      }
      for (const offset of [-w / 2, w / 2]) k.box(side * w / 2, hi + h / 2, offset, 0.65, h, 0.65, 'stone');
      k.box(0, hi + h + 0.6, side * w / 2, w + 0.8, 1.2, 0.6, 'stone', true);
      k.box(side * w / 2, hi + h + 0.6, 0, 0.6, 1.2, w, 'stone', true);
      for (const t of [-1, 0, 1]) {
        k.box(t * 2.8, hi + h + 1.65, side * w / 2, 1, 1, 0.8, 'stone', true);
        k.box(side * w / 2, hi + h + 1.65, t * 2.8, 0.8, 1, 1, 'stone', true);
      }
    }
    k.box(0, hi + h, 0, w + 1.1, 0.5, w + 1.1, 'stone', true);
    k.box(0, hi + h + 2, 0, 3, 3.5, 3, 'stone2', true);
    k.roof(0, hi + h + 3.8, 0, 3.8, 3.8, 1.8, { eave: 0.3, curl: 0 });
    k.box(0, hi + h - 4, -w / 2 - 0.08, 1.5, 5, 0.12, 'cloth');
    add(g); return g;
  }
  const h = s.h || 16;
  const w = s.w || 4.2;
  const [lo, hi] = k.groundRange(0, 0, w + 1, w + 1);
  k.plinth(0, 0, w + 1.6, w + 1.6, hi + 0.5);
  const y0 = hi + 0.5;
  // solid dark shaft (the stacked-timber look) with braces on each face
  k.box(0, y0 + h / 2, 0, w, h, w, 'timber', true);
  for (let i = 0; i < Math.floor(h / 4); i++) {
    const yy = y0 + 2 + i * 4;
    for (const [fx, fz, ry] of [[0, w / 2 + 0.05, 0], [0, -w / 2 - 0.05, 0], [w / 2 + 0.05, 0, Math.PI / 2], [-w / 2 - 0.05, 0, Math.PI / 2]]) {
      k.box(fx, yy, fz, w + 0.2, 0.22, 0.12, 'stone2', false, ry);
      const brace = k.box(fx, yy + 2, fz, 0.16, 4.4, 0.1, 'stone2', false, ry);
      brace.rotation.z = (i % 2 ? 1 : -1) * 0.75;
    }
  }
  // cabin
  const cy = y0 + h;
  k.box(0, cy + 0.1, 0, w + 2, 0.25, w + 2, 'timber', true);
  k.storey(0, cy + 0.2, 0, w + 0.6, w + 0.6, 2.4, { blank: 0 });
  k.roof(0, cy + 2.6, 0, w + 0.6, w + 0.6, (w + 0.6) * 0.55, { eave: 1.2, curl: 0.9 });
  k.lantern(w / 2 + 1.2, cy - 0.6, w / 2 + 1.2);
  // ladder
  for (let i = 0; i < h / 0.6; i++) k.box(0, y0 + 0.3 + i * 0.6, w / 2 + 0.25, 1.0, 0.08, 0.08, 'timber');
  for (const sx of [-0.5, 0.5]) k.box(sx, y0 + h / 2, w / 2 + 0.25, 0.1, h, 0.1, 'timber');
  add(g);
  return g;
}

// ---------------------------------------------------------------- arched bridge
// A curved timber footbridge from (x, z) to (x2, z2) on trestles, deck rising mid-span.
export function buildArchBridge(world, s, add, mat) {
  const st = styleFor(s);
  const len = Math.hypot(s.x2 - s.x, s.z2 - s.z);
  const g = new THREE.Group();
  const ya = world.terrain.heightAt(s.x, s.z);
  const yb = world.terrain.heightAt(s.x2, s.z2);
  g.position.set((s.x + s.x2) / 2, 0, (s.z + s.z2) / 2);
  g.rotation.y = Math.atan2(s.x2 - s.x, s.z2 - s.z);
  g.name = s.name || 'bridge';
  const k = tide(world, g, st, mat, 'bridge');
  const width = s.width || 3.2;
  const arc = s.arc ?? Math.min(4, len * 0.1);
  const ends = [Math.max(ya, s.ya ?? ya), Math.max(yb, s.yb ?? yb)];
  const segs = Math.max(10, Math.round(len / 0.9));
  const deck = (t) => ends[0] + (ends[1] - ends[0]) * t + Math.sin(Math.PI * t) * arc + 0.3;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const z0 = -len / 2 + t0 * len;
    const z1 = -len / 2 + t1 * len;
    const y0 = deck(t0);
    const y1 = deck(t1);
    const seg = k.box(0, (y0 + y1) / 2, (z0 + z1) / 2, width, 0.28, Math.hypot(z1 - z0, y1 - y0) + 0.05, 'timber');
    seg.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
    k.solid(0, Math.max(y0, y1) - 0.6, (z0 + z1) / 2, width, 0.75, z1 - z0 + 0.05, { climbable: false });
    // railings follow the arc
    for (const sx of [-1, 1]) {
      const post = k.box(sx * (width / 2 - 0.1), y0 + 0.55, z0, 0.16, 1.1, 0.16, 'timber');
      post.castShadow = false;
      const r = k.box(sx * (width / 2 - 0.1), (y0 + y1) / 2 + 1.05, (z0 + z1) / 2, 0.12, 0.12, Math.hypot(z1 - z0, y1 - y0) + 0.05, 'stone2');
      r.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
    }
    // trestle legs every few segments
    if (i % 4 === 2) {
      const zz = (z0 + z1) / 2;
      for (const sx of [-1, 1]) {
        const gx = sx * (width / 2 - 0.2);
        const gh = Math.max(-6, k.ground(gx, zz));
        const hh = (y0 + y1) / 2 - gh;
        if (hh > 0.8) {
          k.box(gx, gh + hh / 2, zz, 0.32, hh, 0.32, 'timber');
          const x = k.box(0, gh + hh * 0.55, zz, width, 0.18, 0.18, 'timber');
          x.rotation.z = sx * Math.atan2(hh * 0.5, width);
        }
      }
    }
  }
  if (s.lanterns !== false) for (const t of [0.04, 0.96]) k.lantern(width / 2 + 0.2, deck(t) + 1.6, -len / 2 + t * len, t < 0.5);
  add(g);
  return g;
}

// ---------------------------------------------------------------- pavilion & gate
export function buildPavilion(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
  g.rotation.y = s.rot || 0;
  const k = tide(world, g, st, mat, 'pavilion');
  const w = s.w || 5;
  const [, hi] = k.groundRange(0, 0, w + 1, w + 1);
  const y = s.plinth === false ? 0 : Math.max(0.3, hi + 0.35);
  if (s.plinth !== false) k.plinth(0, 0, w + 1, w + 1, y);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box((sx * w) / 2, y + 1.5, (sz * w) / 2, 0.3, 3, 0.3, 'timber', true);
  k.roof(0, y + 3, 0, w, w, w * 0.45, { eave: 1, curl: 0.9 });
  k.lantern(0, y + 2.4, 0);
  // the rain stops under the roof (world/weather.js)
  addShelter(world, s.x, s.z, w + 1, w + 1, s.rot || 0, g.position.y + y - 0.2, g.position.y + y + 3);
  add(g);
  return g;
}

// Ceremonial gate: two posts, a curved double lintel and hanging lanterns.
export function buildGateArch(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
  g.rotation.y = s.rot || 0;
  const k = tide(world, g, st, mat, 'gate');
  const w = s.w || 8;
  const h = s.h || 6.5;
  for (const sx of [-1, 1]) {
    k.box((sx * w) / 2, h / 2, 0, 0.7, h, 0.7, 'timber', true);
    k.box((sx * w) / 2, 0.4, 0, 1.2, 0.8, 1.2, 'stone2');
  }
  k.box(0, h - 1.2, 0, w + 0.6, 0.35, 0.45, 'timber');
  const top = new THREE.Mesh(flaredRoofGeometry(w + 1.2, 0.6, 0.35, 0.3, 0.7, 8), k.m('roof', { double: true }));
  top.position.set(0, h, 0);
  g.add(top);
  k.box(0, h - 0.2, 0, w + 1.6, 0.25, 0.6, 'ridge');
  for (const sx of [-1, 1]) k.lantern((sx * w) / 3.2, h - 2.2, 0.3, sx > 0);
  add(g);
  return g;
}

// ---------------------------------------------------------------- civic features
const groupAt = (world, s, rotY = s.rot || 0) => {
  const g = new THREE.Group();
  g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
  g.rotation.y = rotY;
  if (s.name) g.name = s.name;
  return g;
};

// The great tree in a ringed stone plaza, lanterns hanging from its lower limbs.
export function buildGreatTree(world, s, add, mat) {
  const st = styleFor(s);
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'great_tree');
  const R = s.r || 7;
  // stepped circular platform with engraved rings
  for (let i = 0; i < 3; i++) {
    const r = R + 2.4 - i * 1.2;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, 0.5, 12), k.m(i % 2 ? 'stone2' : 'stone'));
    ring.position.y = 0.25 + i * 0.5;
    ring.receiveShadow = true;
    g.add(ring);
    world.colliders.addCyl({ x: s.x, z: s.z, r, y0: g.position.y - 1, y1: g.position.y + 0.5 + i * 0.5, climbable: false });
  }
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R * (0.45 + i * 0.18), 0.06, 3, 12), k.m('timber'));
    t.rotation.x = Math.PI / 2;
    t.position.y = 1.52;
    g.add(t);
  }
  const h = s.h || 22;
  const bark = mat('#cfcac0');
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, h, 9), bark);
  trunk.position.y = 1.5 + h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 4.2, 6), bark);
    root.position.set(Math.cos(a) * 1.9, 2.4, Math.sin(a) * 1.9);
    root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(root);
  }
  // limbs and layered canopy
  const leaf = ['#3f6f4a', '#4d7e55', '#365f40', '#5a8a5e'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 6), bark);
    limb.position.set(Math.cos(a) * 3, 1.5 + h * 0.62, Math.sin(a) * 3);
    limb.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0);
    g.add(limb);
  }
  const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = i === 0 ? 0 : 4 + (i % 3) * 2.5;
    const sz = (9 - (i % 3) * 1.5) * (s.crown || 1);
    const c = new THREE.Mesh(canopyGeo, mat(leaf[i % leaf.length]));
    c.scale.set(sz, sz * 0.45, sz);
    c.position.set(Math.cos(a) * r, 1.5 + h * (0.72 + (i % 2) * 0.12), Math.sin(a) * r);
    c.castShadow = true;
    g.add(c);
  }
  // hanging lanterns from the lower canopy
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const r = 5 + (i % 2) * 2.5;
    const y = 1.5 + h * 0.55 - (i % 3) * 1.2;
    k.box(Math.cos(a) * r, y + 2.2, Math.sin(a) * r, 0.04, 3.6, 0.04, 'timber');
    k.lantern(Math.cos(a) * r, y, Math.sin(a) * r, i % 3 === 0);
  }
  world.colliders.addCyl({ x: s.x, z: s.z, r: 2, y0: g.position.y, y1: g.position.y + h, climbable: true });
  add(g);
  return R + 3;
}

// Stone retaining wall along an arc: the face of a raised terrace, with a stair gap.
export function buildTerraceWall(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  const k = tide(world, g, st, mat, 'terrace_wall');
  const top = s.top;
  const n = Math.max(4, Math.round(((s.a1 - s.a0) * s.r) / 4));
  for (let i = 0; i < n; i++) {
    const a = s.a0 + ((i + 0.5) / n) * (s.a1 - s.a0);
    if ([s.gap, s.gap2, s.gap3, s.gap4].some(gap => gap != null && Math.abs(a - gap) < (gap === s.gap3 || gap === s.gap4 ? 0.24 : s.gapW || 0.18))) continue;
    const x = Math.sin(a) * s.r;
    const z = Math.cos(a) * s.r;
    const seg = ((s.a1 - s.a0) * s.r) / n + 0.3;
    const gy = world.terrain.heightAt(s.x + x, s.z + z);
    const bottom = gy - 2;
    k.box(x, (top + bottom) / 2, z, seg, top - bottom, 1.4, i % 3 ? 'stone' : 'stone2', true, a);
    k.box(x, top + 0.2, z, seg + 0.2, 0.4, 1.8, 'stone2', true, a);
    if (i % 2 === 0) k.box(x + Math.sin(a) * 0.9, top + 0.75, z + Math.cos(a) * 0.9, seg * 0.8, 0.8, 0.3, 'timber', false, a);
    if (i % 4 === 1) k.lantern(x + Math.sin(a) * 1.1, top + 1.7, z + Math.cos(a) * 1.1, i % 8 === 1);
  }
  add(g);
}

// Straight stone stair from (x, z) to (x2, z2), ground to ground (or to explicit y2).
export function buildStair(world, s, add, mat) {
  const st = styleFor(s);
  const len = Math.hypot(s.x2 - s.x, s.z2 - s.z);
  const g = new THREE.Group();
  const y0 = s.y ?? world.terrain.heightAt(s.x, s.z);
  const y1 = s.y2 ?? world.terrain.heightAt(s.x2, s.z2);
  g.position.set(s.x, y0, s.z);
  g.rotation.y = Math.atan2(s.x2 - s.x, s.z2 - s.z);
  const k = tide(world, g, st, mat, 'stair');
  const w = s.w || 4;
  const rise = y1 - y0;
  const n = Math.max(2, Math.ceil(Math.abs(rise) / 0.36));
  for (let i = 0; i < n; i++) {
    const top = (rise * (i + 1)) / n;
    const zc = (len * (i + 0.5)) / n;
    k.box(0, (top - 2) / 2, zc, w, top + 2, len / n + 0.05, i % 2 ? 'stone' : 'stone2', true);
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i <= 2; i++) {
      const t = i / 2;
      k.box((sx * (w + 0.6)) / 2, rise * t + 0.9, len * t, 0.6, 1.8, 0.6, 'stone2', true);
      if (i !== 1) k.lantern((sx * (w + 0.6)) / 2, rise * t + 2.4, len * t, i === 0);
    }
  }
  add(g);
}

// A rope of paper lanterns slung between two posts across a street.
export function buildLanternLine(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(0, 0, 0);
  const k = tide(world, g, st, mat, 'lantern_line');
  const ya = world.terrain.heightAt(s.x, s.z);
  const yb = world.terrain.heightAt(s.x2, s.z2);
  const h = s.h || 6;
  for (const [x, z, y] of [[s.x, s.z, ya], [s.x2, s.z2, yb]]) {
    if (s.posts !== false) k.box(x, y + h / 2, z, 0.32, h, 0.32, 'timber', true);
  }
  const len = Math.hypot(s.x2 - s.x, s.z2 - s.z);
  const n = Math.max(3, Math.round(len / 2.2));
  const ry = Math.atan2(s.x2 - s.x, s.z2 - s.z);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const sag = (t) => -Math.sin(Math.PI * t) * 1.2;
    const p0 = [s.x + (s.x2 - s.x) * t0, ya + (yb - ya) * t0 + h - 0.2 + sag(t0), s.z + (s.z2 - s.z) * t0];
    const p1 = [s.x + (s.x2 - s.x) * t1, ya + (yb - ya) * t1 + h - 0.2 + sag(t1), s.z + (s.z2 - s.z) * t1];
    const seg = k.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, 0.05, 0.05, len / n + 0.05, 'timber', false, ry);
    seg.rotation.x = -Math.atan2(p1[1] - p0[1], len / n);
    seg.castShadow = false;
    if (i > 0) {
      const lit = i === Math.floor(n / 2);
      const lc = i % 3 === 0 ? 'accent' : 'lantern';
      const L = k.box(p0[0], p0[1] - 0.55, p0[2], 0.42, 0.55, 0.42, mat(st[lc], { emissive: st[lc], ei: 1.3 }));
      L.castShadow = false;
      if (lit) world.addLight(new THREE.Vector3(p0[0], p0[1] - 0.6, p0[2]), st.lantern, 0.8, 10, true, 0.5);
    }
  }
  add(g);
}

// Courtyard tree: a modest trunk under a clump of layered leaves.
export function buildTownTree(world, s, add, mat) {
  const g = groupAt(world, s, 0);
  const h = s.h || 7;
  const bark = mat('#6a5644');
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 7), bark);
  t.position.y = h / 2;
  t.castShadow = true;
  g.add(t);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const col = s.blossom ? ['#e8b8c0', '#d89aa8', '#f0ccd2'] : ['#4f7e4a', '#5f8f55', '#43703f'];
  for (let i = 0; i < 4; i++) {
    const a = i * 2.1;
    const c = new THREE.Mesh(geo, mat(col[i % col.length]));
    const sz = 3.4 - i * 0.3;
    c.scale.set(sz, sz * 0.6, sz);
    c.position.set(Math.cos(a) * (i ? 1.4 : 0), h + (i % 2) * 0.9 - 0.4, Math.sin(a) * (i ? 1.4 : 0));
    c.castShadow = true;
    g.add(c);
  }
  // stone planter ring
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.6, 10), mat('#a19f95'));
  ring.position.y = 0.3;
  g.add(ring);
  world.colliders.addCyl({ x: s.x, z: s.z, r: 1.4, y0: g.position.y - 1, y1: g.position.y + 0.6 });
  world.colliders.addCyl({ x: s.x, z: s.z, r: 0.5, y0: g.position.y, y1: g.position.y + h });
  add(g);
}

// Grand hall: raised plinth, front colonnade, two storeys and a double flared roof.
export function buildHall(world, s, add, mat) {
  const st = styleFor(s);
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'hall');
  const w = s.w || 22;
  const d = s.d || 14;
  const [, hi] = k.groundRange(0, 0, w + 4, d + 6);
  const fl = Math.max(1.2, hi + 1.2);
  k.plinth(0, -1, w + 4, d + 6, fl);
  // front stair across the full width
  const front = k.ground(0, d / 2 + 4);
  const n = Math.max(2, Math.ceil((fl - front) / 0.38));
  for (let i = 0; i < n; i++) {
    const top = fl - ((i + 1) * (fl - front)) / n + 0.38;
    k.box(0, (top + front - 1) / 2, d / 2 + 2.2 + i * 0.6, w * 0.6, top - front + 1, 0.6, 'stone', true);
  }
  k.storey(0, fl, 0, w, d, 5.2, { door: true, blank: 0.1 });
  // colonnade under a porch roof
  for (let i = 0; i <= 6; i++) {
    const x = -w / 2 + (i / 6) * w;
    k.box(x, fl + 2.6, d / 2 + 1.6, 0.55, 5.2, 0.55, 'accent', true);
    k.box(x, fl + 0.2, d / 2 + 1.6, 0.9, 0.4, 0.9, 'stone2');
  }
  k.roof(0, fl + 5.2, d / 2 + 1.2, w + 1, 3.4, 1.2, { eave: 0.9, curl: 0.8, key: 'roof2' });
  k.roof(0, fl + 5.2, 0, w, d, 1.3, { eave: 1.4, curl: 1.0, key: 'roof2' });
  k.storey(0, fl + 6.4, 0, w * 0.7, d * 0.72, 4, { blank: 0.2, plaster: 'plaster2' });
  k.roof(0, fl + 10.4, 0, w * 0.7, d * 0.72, d * 0.5, { eave: 1.6, curl: 1.2 });
  for (const sx of [-1, 1]) {
    k.box(sx * w * 0.3, fl + 6.6, d / 2 + 0.2, 1.6, 4.2, 0.08, 'cloth');
    k.lantern(sx * w * 0.42, fl + 4.2, d / 2 + 2.3);
  }
  add(g);
}

// Harbor warehouse: long, low, a loading door and a hoist beam.
export function buildWarehouse(world, s, add, mat) {
  const st = styleFor(s);
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'warehouse');
  const w = s.w || 14;
  const d = s.d || 9;
  const [, hi] = k.groundRange(0, 0, w + 1, d + 1);
  const fl = Math.max(0.4, hi + 0.3);
  k.plinth(0, 0, w + 1, d + 1, fl, 'stone2');
  const h = 5.2, t = 0.28, door = 3.4;
  k.box(0, fl + 0.1, 0, w - 0.5, 0.2, d - 0.5, 'timber', true);
  k.box(0, fl + h / 2, -d / 2 + t / 2, w, h, t, 'plaster2', true);
  for (const side of [-1, 1]) k.box(side * (w / 2 - t / 2), fl + h / 2, 0, t, h, d, 'plaster2', true);
  k.box(-(w + door) / 4, fl + h / 2, d / 2 - t / 2, (w - door) / 2, h, t, 'plaster2', true);
  k.box((w + door) / 4, fl + h / 2, d / 2 - t / 2, (w - door) / 2, h, t, 'plaster2', true);
  k.box(0, fl + h - 0.65, d / 2 - t / 2, door, 1.3, t, 'plaster2', true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * (w / 2), fl + h / 2, sz * (d / 2), 0.34, h + 0.08, 0.34, 'timber');
  for (let i = 0; i <= 4; i++) k.box(-w / 2 + (i / 4) * w, fl + h / 2, d / 2 + 0.05, 0.3, h, 0.2, 'timber');
  for (const yy of [fl + 0.18, fl + h - 0.18]) {
    k.box(0, yy, d / 2 + 0.06, w + 0.08, 0.22, 0.14, 'timber');
    k.box(0, yy, -d / 2 - 0.06, w + 0.08, 0.22, 0.14, 'timber');
  }
  k.box(0, fl + 1.6, d / 2 + 0.1, door, 3.2, 0.15, 'timber');
  k.box(0, fl + 6.2, d / 2 + 1.4, 0.3, 0.3, 3, 'timber');
  k.box(0, fl + 4.4, d / 2 + 2.8, 0.05, 3.4, 0.05, 'timber');
  k.box(0, fl + 2.5, d / 2 + 2.8, 0.7, 0.7, 0.7, '#8a6a40');
  k.roof(0, fl + h, 0, w, d, d * 0.42, { eave: 0.9, curl: 0.5 });
  for (let i = 0; i < 4; i++) k.box(-w / 2 + 1 + i * 1.1, fl + 0.5, d / 2 + 1.2, 1, 1, 1, '#8a6a40', true);
  add(g);
}

// Harbor crane on a dock: a timber mast, a jib and a hanging net of cargo.
export function buildCrane(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, s.y ?? Math.max(1.5, world.terrain.heightAt(s.x, s.z)), s.z);
  g.rotation.y = s.rot || 0;
  const k = tide(world, g, st, mat, 'crane');
  k.box(0, 4.5, 0, 0.6, 9, 0.6, 'timber', true);
  const jib = k.box(0, 8.6, 2.6, 0.4, 0.4, 6.4, 'timber');
  jib.rotation.x = -0.25;
  k.box(0, 6.2, 5.4, 0.04, 4.4, 0.04, 'timber');
  k.box(0, 3.8, 5.4, 1.2, 1, 1.2, '#7a6040');
  for (const a of [0.6, -0.6]) {
    const b = k.box(0, 3, 0, 0.25, 6, 0.25, 'timber');
    b.rotation.z = a;
  }
  add(g);
}

// A static ship of the line: hull, stacked castles, three masts and furled or set sails.
export function buildGalleon(world, s, add, mat) {
  const st = STYLES[s.style || 'enclave'];
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.rot || 0;
  g.name = s.name || 'galleon';
  const k = tide(world, g, st, mat, 'galleon');
  const L = s.len || 30;
  const hull = st.timber;
  // hull: stacked, tapering slabs
  for (let i = 0; i < 4; i++) {
    const y = -1.8 + i * 1.3;
    const wv = 4 + i * 1.3;
    k.box(0, y, 0, wv, 1.3, L * (0.78 + i * 0.06), hull, i >= 1);
  }
  // the deck on the hull: solid down to the top course, so nothing slips in under it
  k.box(0, 3.3, 0, 8.6, 0.3, L * 0.95, '#6a5038');
  k.solid(0, 2.7, 0, 8.6, 0.75, L * 0.95);
  // bow and stern
  const bow = new THREE.Mesh(new THREE.ConeGeometry(4.2, 7, 4), k.m(hull));
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.scale.set(1, 1, 0.5);
  bow.position.set(0, 1.2, L * 0.52);
  g.add(bow);
  k.box(0, 4.4, L * 0.58, 0.3, 0.3, 5, hull);
  k.box(0, 5.5, -L * 0.38, 8.4, 4.4, L * 0.2, hull, true);
  k.box(0, 7.9, -L * 0.38, 8.8, 0.3, L * 0.22, '#6a5038', true);
  for (let i = 0; i < 4; i++) k.box(-3 + i * 2, 5.6, -L * 0.48 - 0.05, 1.1, 1.1, 0.1, k.glow());
  k.box(0, 4.6, L * 0.32, 8, 2.2, L * 0.12, hull, true);
  // gunports
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) k.box(sx * 4.9, 1.6, -L * 0.3 + i * (L * 0.09), 0.1, 0.7, 0.9, '#121214');
  // masts, yards and sails
  const sail = mat(s.sail || '#d9d2c2', { double: true });
  [L * 0.24, -L * 0.02, -L * 0.26].forEach((z, i) => {
    const mh = 22 - i * 3;
    k.box(0, 3.4 + mh / 2, z, 0.6, mh, 0.6, hull);
    for (let j = 0; j < 2; j++) {
      const yy = 3.4 + mh * (0.45 + j * 0.3);
      k.box(0, yy + 2.4, z, 9 - j * 2.4, 0.3, 0.3, hull);
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(8.4 - j * 2.4, 4.6 - j), sail);
      sl.position.set(0, yy, z + 0.35);
      g.add(sl);
    }
    // pennant in the faction colour
    const f = k.box(0.9, 3.4 + mh + 0.4, z, 1.8, 0.6, 0.05, mat(st.accent, { double: true }));
    f.castShadow = false;
  });
  // stern banner
  k.box(0, 9.6, -L * 0.48, 2.2, 3, 0.08, mat(st.accent, { double: true }));
  add(g);
}

// Plank pier on piles from (x, z) heading along rot for len meters (not a ferry dock).
export function buildPier(world, s, add, mat) {
  const st = styleFor(s);
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.rot || 0;
  const k = tide(world, g, st, mat, 'pier');
  const len = s.len || 24;
  const w = s.w || 3.6;
  const deck = s.deck ?? 1.6;
  k.box(0, deck - 0.15, len / 2, w, 0.3, len, '#7a5c40');
  for (let z = 0; z < len; z += 2) k.solid(0, deck - 3, z + 1, w, 3, 2.1, { climbable: false });
  for (let z = 0; z <= len; z += 4) for (const sx of [-1, 1]) k.box((sx * w) / 2, deck - 3.4, z, 0.35, 7, 0.35, 'timber');
  for (const sx of [-1, 1]) k.rail((sx * w) / 2, 0, (sx * w) / 2, len, deck, 0.9);
  k.lantern(w / 2 + 0.3, deck + 2, len - 1);
  for (let i = 0; i < 3; i++) k.box(-w / 2 + 0.7, deck + 0.4, len * 0.3 + i * 1.2, 0.8, 0.8, 0.8, '#8a6a40');
  add(g);
}

// The Anchor's Fall: a colossal cloaked and crowned king kneeling in the shallows, head bowed
// under an unseen weight, the broken command chain running from his hands over the shore.
// Cut by the same masons as the dynasty's honour guard in the Rift (world/riftOmens.js), in
// pale weathered stone. Climbable from the cloak's folds to the crown, where something waits.
const ANCHOR_STONE = { stone: '#a3a8a2', stone2: '#8d938d', edge: '#b4b8b1', dark: '#4f5550', moss: '#61805a', metal: '#6f6748', panel: '#9a9f99' };

export function buildAnchorStatue(world, s, add) {
  const g = new THREE.Group();
  const ground = world.terrain.heightAt(s.x, s.z);
  g.position.set(s.x, ground, s.z);
  g.rotation.y = s.rot || 0;
  g.name = s.name || 'statue';
  const U = (s.scale || 6) * 3.7; // figure units to metres: the king kneels some 32 m tall
  const W = 1.07 * U, D = 1.63 * U, TOP = 4; // the plinth, proportioned as the Rift's
  const UP = new THREE.Vector3(0, 1, 0);
  const local = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyAxisAngle(UP, g.rotation.y).add(g.position);
  const solid = (lx, lz, w, d, y0, y1) => {
    const p = local(lx, 0, lz);
    world.colliders.addBox({ x: p.x, z: p.z, w, d, y0: ground + y0, y1: ground + y1, rot: g.rotation.y, climbable: true });
  };
  const lowest = groundRange(world.terrain, s.x, s.z, W + 1.6, D + 1.6, g.rotation.y, 5)[0] - ground;
  const k = new Kit({ ...ANCHOR_STONE });
  k.footing(0, 0, W + 1.6, D + 1.6, 0.9, lowest, 'stone2');
  k.masonry(0, 0.9, 0, W, TOP - 1.38, D, { c: 'stone', c2: 'stone2' });
  k.cornice(0, TOP - 0.48, 0, W, D, 'edge');
  k.slab(0, 1.1, D / 2 + 0.02, 7, 1.3, 0.14, 'panel');
  let boxes = [];
  k.at({ y: TOP, s: U }, (f) => {
    f.slab(0, -0.03, 0.02, 0.86, 0.05, 1.3, 'stone2');
    boxes = kneelingFigure(f, { crowned: true, chain: true, damage: 'moss' });
  });
  g.add(k.build(g.name));
  // the command chain: oval links from the closed hands, over the plinth's lip and away across
  // the shore; the last one snapped open
  const [hx, hy, hz] = KNEELING_HANDS;
  const path = [[hx * U, TOP + hy * U, hz * U], [0.4, TOP + 0.45 * U, 0.72 * U], [1.2, TOP + 0.3, D / 2 + 0.6], [2.5, 0.2, D / 2 + 5], [6, -0.6, D / 2 + 22], [9, -1.2, D / 2 + 36]].map((p) => new THREE.Vector3(...p));
  const bronze = new THREE.MeshStandardMaterial({ color: ANCHOR_STONE.metal, metalness: 0.45, roughness: 0.6, flatShading: true });
  const R = 0.06 * U, tube = 0.016 * U, step = R * 2 * 1.5 * 0.82;
  const link = new THREE.TorusGeometry(R, tube, 5, 10);
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
  const n = Math.floor(cum[cum.length - 1] / step);
  const q = new THREE.Quaternion(), twist = new THREE.Quaternion(), tan = new THREE.Vector3();
  for (let i = 0, seg = 1; i <= n; i++) {
    const d = i * step;
    while (seg < path.length - 1 && cum[seg] < d) seg++;
    const a = path[seg - 1], b = path[seg], t = (d - cum[seg - 1]) / (cum[seg] - cum[seg - 1]);
    tan.subVectors(b, a).normalize();
    const last = i === n;
    const o = new THREE.Mesh(last ? new THREE.TorusGeometry(R, tube, 5, 10, Math.PI * 1.35) : link, bronze);
    o.position.lerpVectors(a, b, t);
    o.quaternion.copy(q.setFromUnitVectors(UP, tan).multiply(twist.setFromAxisAngle(UP, i % 2 ? Math.PI / 2 : 0)));
    if (last) o.rotateZ(0.6);
    o.scale.set(1, 1.5, 1);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
  }
  add(g);
  solid(0, 0, W + 1.6, D + 1.6, lowest - 1, 0.9);
  solid(0, 0, W, D, 0.9, TOP);
  for (const [lx, lz, w, d, y0, y1] of boxes) solid(lx * U, lz * U, w * U, d * U, TOP + y0 * U, TOP + y1 * U);
  world.addLight(local(0, TOP + 1.42 * U, 0.2 * U), '#ffe0a0', 0.6, 30);
  return D / 2 + 4;
}

// Rows of empty chairs facing the sea: how the Ministry keeps the names of the lost.
export function buildChairField(world, s, add, mat) {
  const g = groupAt(world, s);
  const k = tide(world, g, styleFor(s), mat, 'chairs');
  const rows = s.rows || 5;
  const cols = s.cols || 8;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (hash(r, c, s.x) < 0.12) continue;
      const x = (c - (cols - 1) / 2) * 2.4 + (r % 2) * 0.6;
      const z = (r - (rows - 1) / 2) * 3;
      const y = k.ground(x, z);
      const tilt = (hash(c, r, 9) - 0.5) * 0.3;
      const seat = k.box(x, y + 0.5, z, 0.9, 0.12, 0.9, 'timber', false, tilt);
      seat.castShadow = false;
      k.box(x - Math.sin(tilt) * 0.4, y + 1.0, z - Math.cos(tilt) * 0.4, 0.9, 1.0, 0.1, 'timber', false, tilt);
      for (const lx of [-0.38, 0.38]) for (const lz of [-0.38, 0.38]) k.box(x + lx, y + 0.25, z + lz, 0.08, 0.5, 0.08, 'timber');
      if (hash(r, c, 3) < 0.15) k.lantern(x, y + 1.0, z + 0.2, hash(r, c, 4) < 0.3);
    }
  }
  add(g);
}

// A ring of tall standing stones, some fallen.
export function buildStoneCircle(world, s, add, mat) {
  const g = groupAt(world, s, 0);
  const n = s.n || 9;
  const R = s.r || 9;
  const st = mat(s.color || '#77737a');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 4 + hash(i, s.x) * 4;
    const fallen = hash(i, s.z) < 0.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 0.9), st);
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const y = world.terrain.heightAt(s.x + x, s.z + z) - g.position.y;
    if (fallen) {
      m.position.set(x, y + 0.45, z);
      m.rotation.set(Math.PI / 2, a, 0);
    } else {
      m.position.set(x, y + h / 2 - 0.4, z);
      m.rotation.set(0, -a, (hash(i, 7) - 0.5) * 0.12);
      world.colliders.addBox({ x: s.x + x, z: s.z + z, w: 1.3, d: 0.9, y0: g.position.y + y - 1, y1: g.position.y + y + h - 0.4, rot: -a, climbable: true });
    }
    m.castShadow = true;
    g.add(m);
  }
  add(g);
  return R + 3;
}

// A great bell hung in a timber frame (the Ministry's sounding bell, or a drowned one).
export function buildBellFrame(world, s, add, mat) {
  const st = styleFor(s);
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'bell');
  const h = s.h || 9;
  const w = s.w || 7;
  for (const sx of [-1, 1]) {
    k.box((sx * w) / 2, h / 2, 0, 0.8, h, 0.8, 'timber', true);
    const brace = k.box((sx * w) / 2 - sx * 0.9, h * 0.3, 0, 0.3, h * 0.6, 0.3, 'timber');
    brace.rotation.z = sx * 0.4;
  }
  k.box(0, h, 0, w + 1.4, 0.7, 1.0, 'timber');
  k.roof(0, h + 0.4, 0, w + 0.6, 2.2, 1.4, { eave: 0.8, curl: 0.9 });
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.4, 3.4, 8, 1, true), mat(s.bell || '#7a6a3e', { metalness: 0.6, roughness: 0.4, double: true }));
  bell.position.y = h - 2.3;
  g.add(bell);
  if (s.tilt) g.rotation.z = s.tilt;
  add(g);
}

// Gallows: a timber frame with hanging cages (the Enclave's warning on its rocks).
export function buildGallows(world, s, add, mat) {
  const st = styleFor({ style: 'enclave' });
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'gallows');
  k.box(0, 0.4, 0, 6, 0.8, 3, 'timber', true);
  for (const sx of [-1, 1]) k.box(sx * 2.6, 3.5, 0, 0.4, 6.2, 0.4, 'timber', true);
  k.box(0, 6.4, 0, 6, 0.4, 0.4, 'timber');
  for (const x of [-1.4, 1.2]) {
    k.box(x, 5.2, 0, 0.05, 2, 0.05, 'timber');
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 6, 1, true), mat('#2a2a2e', { metalness: 0.5, double: true }));
    cage.position.set(x, 3.4, 0);
    g.add(cage);
  }
  add(g);
}

// Faction banner on a pole: tall cloth in the faction's colour with a pale device.
export function buildBannerPole(world, s, add, mat) {
  const st = styleFor(s);
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'banner');
  const h = s.h || 9;
  k.box(0, h / 2, 0, 0.25, h, 0.25, 'timber');
  k.box(0, h - 0.2, 0.6, 0.12, 0.12, 1.6, 'timber');
  const cloth = k.box(0, h - 2.4, 1.2, 0.06, 4, 1.2, mat(s.color || st.accent, { double: true }));
  cloth.castShadow = false;
  k.box(0.05, h - 2.0, 1.2, 0.05, 0.9, 0.7, mat(s.device || '#e6dfcf'));
  add(g);
}

// A wrecked ship broken across a sandbar: bow and stern apart, ribs showing.
export function buildWreck(world, s, add, mat) {
  const g = groupAt(world, s);
  g.position.y = Math.min(g.position.y, 0.4);
  const k = tide(world, g, STYLES.redwake, mat, 'wreck');
  const L = s.len || 26;
  const wood = mat('#4c3a2c');
  const halves = [[L * 0.28, 0.25, 0.3], [-L * 0.3, -0.35, -0.22]];
  halves.forEach(([z, roll, pitch], hi) => {
    const h = new THREE.Group();
    h.position.set(hi ? 1.5 : -1, 0, z);
    h.rotation.set(pitch, hi ? 0.4 : -0.2, roll);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(4 + i * 1.2, 1.2, L * 0.4), wood);
      m.position.y = -1 + i * 1.2;
      m.castShadow = true;
      h.add(m);
    }
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), wood);
      rib.position.set(i % 2 ? 3.2 : -3.2, 2.2, -L * 0.18 + i * (L * 0.07));
      rib.rotation.z = i % 2 ? -0.3 : 0.3;
      h.add(rib);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 14, 6), wood);
    mast.position.set(0, 6, 0);
    mast.rotation.z = hi ? 0.9 : -0.5;
    h.add(mast);
    g.add(h);
    world.colliders.addBox({ x: s.x + (hi ? 1.5 : -1), z: s.z + z, w: 6, d: L * 0.4, y0: g.position.y - 3, y1: g.position.y + 2.2, rot: g.rotation.y, climbable: true });
  });
  k.lantern(0, 2.5, 0, false);
  add(g);
}

// Drydock cradle with an unfinished hull: timber ribs over stone slipways.
export function buildDrydock(world, s, add, mat) {
  const st = styleFor({ style: 'enclave' });
  const g = groupAt(world, s);
  const k = tide(world, g, st, mat, 'drydock');
  const L = s.len || 34;
  k.box(0, -0.5, 0, 12, 1.2, L + 4, 'stone', true);
  for (let i = 0; i < 9; i++) {
    const z = -L / 2 + (i / 8) * L;
    for (const sx of [-1, 1]) {
      const rib = k.box(sx * 3.2, 4, z, 0.4, 7.5, 0.4, '#5a4632');
      rib.rotation.z = sx * -0.35;
    }
    k.box(0, 0.6, z, 6.4, 0.5, 0.5, '#5a4632');
  }
  k.box(0, 0.9, 0, 0.9, 0.9, L, '#5a4632');
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) k.box(sx * 6.5, 4.25, -L / 2 + 4 + i * (L / 3.6), 0.5, 11.5, 0.5, 'timber', true);
  for (const sx of [-1, 1]) k.box(sx * 6.5, 10, 0, 0.4, 0.4, L, 'timber');
  add(g);
}

// Dispatch for the structure types above (props.js default case).
export function buildFeature(world, s, add, mat, exclusions) {
  switch (s.type) {
    case 'great_tree':
      exclusions.push({ x: s.x, z: s.z, r: buildGreatTree(world, s, add, mat) });
      return true;
    case 'terrace_wall':
      buildTerraceWall(world, s, add, mat);
      return true;
    case 'stair':
      buildStair(world, s, add, mat);
      exclusions.push({ x: (s.x + s.x2) / 2, z: (s.z + s.z2) / 2, r: Math.hypot(s.x2 - s.x, s.z2 - s.z) / 2 + 3 });
      return true;
    case 'lantern_line':
      buildLanternLine(world, s, add, mat);
      return true;
    case 'town_tree':
      buildTownTree(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: 3 });
      return true;
    case 'pavilion':
      buildPavilion(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: (s.w || 5) * 0.8 + 2 });
      return true;
    case 'gate_arch':
      buildGateArch(world, s, add, mat);
      return true;
    case 'watchtower_t':
      buildWatchtower(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: 5 });
      return true;
    case 'arch_bridge':
      buildArchBridge(world, s, add, mat);
      return true;
    case 'pagoda':
      buildPagoda(world, s, add, mat, { orb: s.orb });
      exclusions.push({ x: s.x, z: s.z, r: (s.r || 6) * 1.6 + 4 });
      return true;
    case 'hall':
      buildHall(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: Math.max(s.w || 22, s.d || 14) * 0.7 + 4 });
      return true;
    case 'warehouse':
      buildWarehouse(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: Math.max(s.w || 14, s.d || 9) * 0.65 + 2 });
      return true;
    case 'crane':
      buildCrane(world, s, add, mat);
      return true;
    case 'galleon':
      buildGalleon(world, s, add, mat);
      return true;
    case 'pier':
      buildPier(world, s, add, mat);
      return true;
    case 'anchor_statue':
      exclusions.push({ x: s.x, z: s.z, r: buildAnchorStatue(world, s, add, mat) });
      return true;
    case 'chair_field':
      buildChairField(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: Math.max((s.cols || 8) * 1.3, (s.rows || 5) * 1.6) + 2 });
      return true;
    case 'stone_circle':
      exclusions.push({ x: s.x, z: s.z, r: buildStoneCircle(world, s, add, mat) });
      return true;
    case 'bell_frame':
      buildBellFrame(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: 6 });
      return true;
    case 'gallows':
      buildGallows(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: 5 });
      return true;
    case 'banner_pole':
      buildBannerPole(world, s, add, mat);
      return true;
    case 'wreck':
      buildWreck(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: (s.len || 26) * 0.6 });
      return true;
    case 'drydock':
      buildDrydock(world, s, add, mat);
      exclusions.push({ x: s.x, z: s.z, r: (s.len || 34) * 0.6 });
      return true;
    default:
      return false;
  }
}
