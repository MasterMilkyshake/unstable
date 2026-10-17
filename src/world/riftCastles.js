// The Rift's castles: the keep where the Anchor dynasty's command chain ended, torn down into
// the passage of the dead with the land around it (docs/WORLD_BIBLE.md). Built straight and
// heavy by the dynasty, then hurt by the Rift: towers lean and twist, one broke at mid-height,
// one was pulled up into the crust, the lattice splits the masonry where it pushed through.
//
//   The Chainward          the walled throne mount around the Broken Command (architecture.js):
//                          a concentric castle, outer wall on the lower ward, curtain and towers
//                          on the upper, a great gatehouse over the climb between them.
//   The Unanswered Bastion the star fort where the stations' calls came in and the relief answer
//                          never went out: relay hall, the dead signal drum, the bell that never
//                          rang, reached over the void by one bridge.
//   The Garrison Steps     the drowned knights' barracks on three terraces, still kept.
//   The relay towers       the signal towers that carried the chain's word, their cradles cold.
//   The upended towers     keep towers that fell the wrong way up.
//
// The Rift's own way of building, distinct from every surface castle: drowned violet-grey
// ashlar, sheer slab-sided towers four to eight times taller than wide on battered footings,
// lancet slits, machicolated galleries, needle spires, iron hawse rings for the command chain,
// almost no light. Sites, pads and spots come from data/riftLayout.js; heights are read from
// the terrain at build time. Every footprint is a collider you can stand on or climb, with
// string courses for ledges every few metres (the climb stamina's reach).
import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { Kit, siteFrame, groundRange, hash3 } from './kit.js';
import { PALETTES } from './style.js';
import { seededRandom } from '../core/util.js';
import { ceilingYAt, bedColor } from './riftCeiling.js';
import { RIFT_CASTLES, RIFT_PADS } from '../data/riftLayout.js';
import { WallFrame, gatehouse } from './riftWalls.js';

// The keep's stone: the Ascent's drowned ashlar, a shade darker and colder, so the castles read
// as dark masses against the haze. Iron is near-black; the only warmth is a watch-light.
export const CASTLE_PALETTE = {
  ...PALETTES.rift,
  stone: '#4f4a5e', stone2: '#3e384a', edge: '#6a6280', dark: '#17141e', joint: '#2c2636',
  roof: '#252838', metal: '#4a4440', iron: '#24212a', cloth: '#22152b', scar: '#7a7290',
  earth: '#33293b', root: '#1f1a20', bronze: '#4e4234', glow: '#ffc27a', ember: '#ff8f45',
};
const TAG = 'rift_castle';
const SITES = [];
const SQ2 = Math.SQRT2;
const UP = Math.PI / 2;

// ------------------------------------------------------------------ site frame
// A site: one Kit in site-local metres (y is absolute world height) and the colliders that go
// with it, both through kit.siteFrame so they cannot drift apart.
class Site {
  constructor(world, x, z, yaw, low, name) {
    this.world = world;
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.low = low;
    this.name = name;
    this.f = siteFrame(world, x, z, yaw, 0);
    this.k = new Kit(CASTLE_PALETTE, { detail: low ? 0 : 1 });
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    this.ex = [];
    SITES.push(this);
  }
  // a footprint (site-local centre, radius) kept free of vegetation and rock
  exclude(lx, lz, r) {
    const [x, z] = this.f.at(lx, lz);
    this.ex.push({ x: r2(x), z: r2(z), r: r2(r) });
  }
  // site-local -> world [x, z]
  w(lx, lz) {
    return this.f.at(lx, lz);
  }
  // world -> site-local [lx, lz]
  l(wx, wz) {
    const dx = wx - this.x, dz = wz - this.z;
    return [dx * this.c - dz * this.s, dx * this.s + dz * this.c];
  }
  // a site-local direction in world axes
  dir(nx, nz) {
    return [nx * this.c + nz * this.s, -nx * this.s + nz * this.c];
  }
  ground(lx, lz) {
    return this.world.terrain.heightAt(...this.f.at(lx, lz));
  }
  lowest(lx, lz, w, d, rot = 0) {
    const [wx, wz] = this.f.at(lx, lz);
    return groundRange(this.world.terrain, wx, wz, w, d, this.yaw + rot, 3)[0];
  }
  ceil(lx, lz) {
    return ceilingYAt(this.world, ...this.f.at(lx, lz));
  }
  solid(lx, lz, w, d, y0, y1, o = {}) {
    if (!(y1 > y0)) return null;
    return this.f.solid(lx, lz, w, d, y0, y1, { tag: TAG, ...o });
  }
  pillar(lx, lz, r, y0, y1) {
    const [wx, wz] = this.f.at(lx, lz);
    this.world.colliders.addCyl({ x: wx, z: wz, r, y0, y1, climbable: true, tag: TAG });
  }
  // A world point from site-local coordinates, bent by a tower's warp when it has one.
  pt(lx, y, lz, warp) {
    const v = new THREE.Vector3(lx, y, lz);
    if (warp) warpPoint(warp, v);
    const [x, z] = this.f.at(v.x, v.z);
    return { x: r2(x), y: r2(v.y), z: r2(z) };
  }
  build() {
    const g = this.k.build(this.name);
    g.position.set(this.x, 0, this.z);
    g.rotation.y = this.yaw;
    this.world.scene.add(g);
    return g;
  }
}

function r2(v) {
  return Math.round(v * 100) / 100;
}

// The same bend Kit.warp applies to vertices, for points we need to know (rings, colliders).
function warpPoint(wp, v) {
  const span = Math.max(0.001, wp.to - wp.from);
  const t = Math.min(1, Math.max(0, (v.y - wp.from) / span)) ** (wp.ease ?? 2);
  if (wp.twist) {
    const a = wp.twist * t;
    const dx = v.x - wp.center[0], dz = v.z - wp.center[1];
    const c = Math.cos(a), s = Math.sin(a);
    v.x = wp.center[0] + dx * c - dz * s;
    v.z = wp.center[1] + dx * s + dz * c;
  }
  if (wp.lean) {
    v.x += wp.lean[0] * t;
    v.z += wp.lean[1] * t;
  }
  return v;
}

function warpT(wp, y) {
  if (!wp) return 0;
  return Math.min(1, Math.max(0, (y - wp.from) / Math.max(0.001, wp.to - wp.from))) ** (wp.ease ?? 2);
}

// Rotate a tower-local offset into site-local axes.
function rot(lx, lz, r) {
  const c = Math.cos(r), s = Math.sin(r);
  return [lx * c + lz * s, -lx * s + lz * c];
}

// The four faces of a w x d footprint: angle (the face looks along (sin a, cos a)), distance
// of the face from the centre, and its width.
function faces(w, d) {
  return [
    { a: 0, half: d / 2, span: w, nx: 0, nz: 1 },
    { a: UP, half: w / 2, span: d, nx: 1, nz: 0 },
    { a: Math.PI, half: d / 2, span: w, nx: 0, nz: -1 },
    { a: -UP, half: w / 2, span: d, nx: -1, nz: 0 },
  ];
}
// point on a face (tower-local): u along the face, out beyond it
function onFace(F, u, out = 0) {
  const h = F.half + out;
  return [Math.sin(F.a) * h + Math.cos(F.a) * u, Math.cos(F.a) * h - Math.sin(F.a) * u];
}

// Where a hawse ring's chain runs to: a relay ring, or the Chainward's heart.
function targetOf(id) {
  const r = RIFT_CASTLES.relays.find((q) => q.id === id);
  if (r) return [r.x, r.z];
  if (id === 'chainward') return [CW_POS.x, CW_POS.z + 40];
  return null;
}
const CW_POS = { x: RIFT_CASTLES.chainward.x, z: RIFT_CASTLES.chainward.z };
// The face of a tower (at site-local x, z turned by ry) that looks most toward `id`.
function faceToward(S, x, z, ry, id) {
  const t = targetOf(id);
  if (!t) return 0;
  const [wx, wz] = S.w(x, z);
  const [lx, lz] = S.l(wx + (t[0] - wx), wz + (t[1] - wz));
  const dx = lx - x, dz = lz - z;
  let best = 0, bd = -Infinity;
  faces(1, 1).forEach((f, i) => {
    const [nx, nz] = rot(f.nx, f.nz, ry);
    const d = (nx * dx + nz * dz) / (Math.hypot(dx, dz) || 1);
    if (d > bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

// ------------------------------------------------------------------ the vocabulary
// An iron hawse ring on a face (built facing local +z inside the caller's frame): backing
// plate, the ring, and a stub of chain. Returns nothing; the caller knows where it put it.
function hawse(k, R = 1.0, links = 2) {
  k.slab(0, -R - 0.9, 0.15, R * 2.6, R * 2.6, 0.3, 'edge');
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    k.block(Math.cos(t) * R, Math.sin(t) * R, 0.55, 2 * R * Math.sin(Math.PI / n) + 0.12, 0.3, 0.3, 'iron', { layer: 'metal', rz: t + UP });
  }
  // the staple through the plate
  k.block(0, R, 0.4, 0.5, 0.5, 0.5, 'iron', { layer: 'metal' });
  if (k.detail < 1) return;
  for (let i = 0; i < links; i++) {
    const y = -R - 0.55 - i * 0.82;
    const ry = i % 2 ? UP : 0;
    k.at({ x: 0, y, z: 0.6, ry }, () => {
      for (const sx of [-1, 1]) k.block(sx * 0.27, 0, 0, 0.14, 0.95, 0.16, 'iron', { layer: 'metal' });
      for (const sy of [-1, 1]) k.block(0, sy * 0.42, 0, 0.6, 0.14, 0.16, 'iron', { layer: 'metal' });
    });
  }
}

// Where the lattice burst out of a wall and was cut back: a dark breach with scarred stone
// around it (built facing local +z).
function breach(k, rng, size = 1) {
  k.block(0, 0, 0.02, 2.4 * size, 3.2 * size, 0.3, 'dark', { grad: 0 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng();
    k.block(Math.cos(a) * 1.6 * size, Math.sin(a) * 1.9 * size, 0.2, 0.9 * size, 0.7 * size, 0.6, 'scar', { rz: rng() * 0.6 });
  }
}

// A drowned keep tower. Site-local position (x, z), turned by ry; heights absolute.
//   base   the ground it stands on (its battered footing starts here, footing reaches below)
//   top    the gallery floor; above it a parapet on corbels, bartizans and a needle spire
//   end    'needle' | 'flat' | 'broken' (stops at `top`, jagged) | 'fused' (runs into the crust)
//   lean/twist bend everything above `warpFrom`; slits, lit windows, hawse rings, banners,
//   breaches and string-course ledges (every `ledge` metres) are options.
// Returns the points the omens and the caller hang things from.
function keepTower(S, o) {
  const k = S.k;
  const rng = seededRandom(Math.floor(hash3(S.x + o.x, o.top, S.z + o.z) * 1e6));
  const w = o.w, d = o.d ?? o.w;
  const ry = o.ry ?? 0;
  const base = o.base;
  const flare = o.flare ?? 1.16;
  const batter = o.batter ?? Math.min(9, (o.top - base) * 0.16);
  const foot = Math.min(base, S.lowest(o.x, o.z, w * flare, d * flare, ry)) - 2;
  const end = o.end ?? 'needle';
  const ceil = S.ceil(o.x, o.z);
  let top = o.top;
  if (end === 'needle') top = Math.min(top, ceil - (o.spire ?? w * 2.4) - 4);
  const fine = k.detail >= 1;
  const F = faces(w, d);
  const warp = o.lean || o.twist ? { lean: o.lean ? rot(o.lean[0], o.lean[1], -0) : [0, 0], twist: o.twist || 0, from: o.warpFrom ?? base + batter, to: o.warpTo ?? top + 10, center: [o.x, o.z], ease: o.ease ?? 1.6 } : null;
  const out = { top, rings: [], banners: [], gibbets: [], lit: [] };
  const toSite = (lx, lz) => {
    const [a, b] = rot(lx, lz, ry);
    return [o.x + a, o.z + b];
  };

  const body = () => {
    k.at({ x: o.x, z: o.z, ry }, () => {
      // footing and battered base
      k.slab(0, foot, 0, w * flare, base - foot, d * flare, 'stone2');
      k.prism(0, base, 0, (w * flare) / 2 * SQ2, batter, 'stone2', { sides: 4, top: 1 / flare, dr: (d * flare) / 2 * SQ2 });
      if (fine) k.slab(0, base + batter - 0.4, 0, w + 0.5, 0.4, d + 0.5, 'edge');
      // the shaft, in big drowned courses, with string courses that double as ledges
      const y0 = base + batter;
      k.masonry(0, y0, 0, w, top - y0, d, { course: o.course ?? 1.8 });
      const ledge = o.ledge ?? 8;
      for (let y = y0 + ledge; y < (end === 'broken' ? top - 2 : top - 3); y += ledge) k.slab(0, y - 0.45, 0, w + 1.3, 0.45, d + 1.3, 'edge');
      // lancet slits, a few per face per storey band
      if (fine) {
        for (const f of F) {
          const nU = f.span > 7 ? 2 : 1;
          for (let y = y0 + 4; y < top - 5; y += 7.5) {
            for (let i = 0; i < nU; i++) {
              const u = nU === 1 ? 0 : (i ? 1 : -1) * f.span * 0.22;
              const [px, pz] = onFace(f, u, 0.01);
              k.window(px, y, pz, 0.42, 2.4, { ry: f.a, pointed: true, dark: 'dark' });
            }
          }
        }
      }
      // the few windows still lit, high up
      for (const L of o.lit || []) {
        const f = F[L.face ?? 0];
        const [px, pz] = onFace(f, L.u ?? 0, 0.01);
        k.window(px, L.y, pz, 0.8, 2.6, { ry: f.a, pointed: true, lit: true, glow: 'glow', strength: 1.5 });
        const [sx, sz] = toSite(...onFace(f, L.u ?? 0, 0.8));
        out.lit.push({ x: sx, y: L.y + 1.4, z: sz });
      }
      // iron hawse rings: the command chain was made fast to the keep's towers
      for (const H of o.hawse || []) {
        const f = F[H.face ?? faceToward(S, o.x, o.z, ry, H.toward)];
        const [px, pz] = onFace(f, H.u ?? 0, 0);
        k.at({ x: px, y: H.y, z: pz, ry: f.a }, () => hawse(k, H.r ?? 1.1, fine ? 3 : 0));
        const [sx, sz] = toSite(...onFace(f, H.u ?? 0, 0.6));
        out.rings.push({ x: sx, y: H.y, z: sz, face: f, toward: H.toward });
      }
      for (const B of o.breach || []) {
        const f = F[B.face];
        const [px, pz] = onFace(f, B.u ?? 0, 0);
        k.at({ x: px, y: B.y, z: pz, ry: f.a }, () => breach(k, rng, B.size ?? 1.2));
      }
      for (const B of o.banners || []) {
        const f = F[B.face];
        const [px, pz] = onFace(f, B.u ?? 0, 0.12);
        k.banner(px, B.y - B.len, pz, B.w ?? 2.2, B.len, 'cloth', { ry: f.a, rod: 'iron' });
      }

      if (end === 'broken') {
        // snapped mid-height: a jagged crown of the courses that held, scarred where they broke
        const n = fine ? 9 : 5;
        for (let i = 0; i < n; i++) {
          const f = F[i % 4];
          const u = (rng() - 0.5) * f.span * 0.7;
          const h = 0.8 + rng() * 4.5;
          const [px, pz] = onFace(f, u, -0.9);
          k.slab(px, top - 0.2, pz, 1.8 + rng() * 1.4, h, 1.8, i % 3 ? 'stone' : 'scar', { ry: f.a + (rng() - 0.5) * 0.2 });
        }
        k.slab(0, top - 0.6, 0, w - 1.2, 0.6, d - 1.2, 'scar');
      } else if (end === 'fused') {
        // a fighting gallery at `top`, then the upper keep set back between four corner
        // turrets, all of it running on up into the crust it was pulled into
        galleryTop(k, w, d, top, rng, { ...o, end: 'band', bartizans: false }, fine);
        const w2 = w * 0.74, d2 = d * 0.74, yT = Math.max(top + 4, ceil + 6);
        k.masonry(0, top, 0, w2, yT - top, d2, { course: o.course ?? 1.8 });
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          k.masonry(sx * (w2 / 2), top, sz * (d2 / 2), 2.8, yT - top, 2.8, { course: 1.8 });
        }
        for (let y = top + 9; y < ceil - 4; y += 9) k.slab(0, y, 0, w2 + 3.6, 0.45, d2 + 3.6, 'edge');
        if (fine) {
          for (const f of faces(w2, d2)) {
            for (let y = top + 4; y < ceil - 6; y += 6.5) {
              const [px, pz] = onFace(f, 0, 0.01);
              k.window(px, y, pz, 0.5, 2.8, { ry: f.a, pointed: true });
            }
          }
        }
        // pulled up into the crust: the courses near the rock split and step out
        for (let i = 0; i < (fine ? 10 : 4); i++) {
          const f = F[i % 4];
          const y = ceil - 10 + rng() * 9;
          const [px, pz] = onFace(f, (rng() - 0.5) * f.span * 0.8, 0.3);
          k.slab(px, y, pz, 2.2 + rng() * 2, 1.2 + rng(), 1.4, i % 2 ? 'stone2' : 'scar', { ry: f.a + (rng() - 0.5) * 0.4, rz: (rng() - 0.5) * 0.3 });
        }
        for (const f of F) {
          const [px, pz] = onFace(f, (rng() - 0.5) * f.span * 0.4, 0);
          k.at({ x: px, y: ceil - 6 - rng() * 6, z: pz, ry: f.a }, () => breach(k, rng, 1.0));
        }
      } else {
        galleryTop(k, w, d, top, rng, o, fine);
      }
    });
  };
  if (warp) k.warp(warp, body);
  else body();

  // spire tip and anchor points (warped)
  out.warp = warp;
  if (end === 'needle' || end === 'flat') {
    const proj = 1.3;
    // gibbet points: the gallery corners hang out over the drop
    for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const [lx, lz] = toSite(sx * (w / 2 + proj + 0.6), sz * (d / 2 + proj + 0.6));
      out.gibbets.push(S.pt(lx, top + 0.4, lz, warp));
    }
  }
  out.rings = out.rings.map((r) => ({ ...S.pt(r.x, r.y, r.z, warp), toward: r.toward }));
  out.lit = out.lit.map((p) => S.pt(p.x, p.y, p.z, warp));

  // colliders: footing, the shaft in leaning sections, ledges, gallery
  const fw = w * flare, fd = d * flare;
  S.exclude(o.x, o.z, Math.hypot(fw, fd) / 2 + 2.5 + (o.lean ? Math.hypot(...o.lean) * 0.3 : 0));
  S.solid(o.x, o.z, fw, fd, foot, base + batter * 0.5, { rot: ry });
  const y0 = base + batter * 0.5;
  const y1 = end === 'fused' ? Math.max(top + 4, ceil + 4) : end === 'broken' ? top + 1.5 : top;
  const step = warp ? 6 : 1e9;
  for (let y = y0; y < y1 - 0.01; y += step) {
    const ya = y, yb = Math.min(y1, y + step, ya < top ? top : Infinity);
    const t = warpT(warp, (ya + yb) / 2);
    const dx = warp ? warp.lean[0] * t : 0, dz = warp ? warp.lean[1] * t : 0;
    const shrink = end === 'fused' && ya >= top - 0.01 ? 0.74 : 1;
    S.solid(o.x + dx, o.z + dz, w * shrink + (shrink < 1 ? 2.8 : 0), d * shrink + (shrink < 1 ? 2.8 : 0), ya, yb, { rot: ry + (warp ? warp.twist * t : 0) });
    if (yb === top && y + step > top) y = top - step;
  }
  if (end === 'fused') {
    const t = warpT(warp, top);
    S.solid(o.x + (warp ? warp.lean[0] * t : 0), o.z + (warp ? warp.lean[1] * t : 0), w + 2.6, d + 2.6, top - 0.5, top, { rot: ry + (warp ? warp.twist * t : 0) });
  }
  const ledge = o.ledge ?? 8;
  const by = base + batter;
  for (let y = by + ledge; y < (end === 'broken' ? top - 2 : top - 3); y += ledge) {
    const t = warpT(warp, y);
    S.solid(o.x + (warp ? warp.lean[0] * t : 0), o.z + (warp ? warp.lean[1] * t : 0), w + 1.3, d + 1.3, y - 0.45, y, { rot: ry + (warp ? warp.twist * t : 0) });
  }
  if (end === 'needle' || end === 'flat') {
    const t = warpT(warp, top);
    const dx = warp ? warp.lean[0] * t : 0, dz = warp ? warp.lean[1] * t : 0;
    const r2_ = ry + (warp ? warp.twist * t : 0);
    const W = w + 2.6, D = d + 2.6;
    S.solid(o.x + dx, o.z + dz, W, D, top - 0.5, top, { rot: r2_ });
    // parapet walls so the gallery holds you
    for (const f of faces(W, D)) {
      const [px, pz] = rot(...onFace(f, 0, -0.35), r2_);
      const along = f.span;
      S.solid(o.x + dx + px, o.z + dz + pz, f.nx ? 0.7 : along, f.nx ? along : 0.7, top, top + 1.3, { rot: r2_ });
    }
  }
  return out;
}

// Corbelled, machicolated fighting gallery with corner bartizans and the roof above.
function galleryTop(k, w, d, top, rng, o, fine) {
  const proj = 1.3;
  const W = w + proj * 2, D = d + proj * 2;
  // corbels under the projecting floor
  if (fine) {
    for (const f of faces(w, d)) {
      const n = Math.max(3, Math.round(f.span / 1.5));
      for (let i = 0; i < n; i++) {
        const u = -f.span / 2 + (f.span / n) * (i + 0.5);
        const [px, pz] = onFace(f, u, proj / 2);
        k.ramp(px, top - 2.2, pz, 0.6, 1.7, proj, 'edge', { rz: Math.PI, ry: f.a + Math.PI });
      }
    }
  }
  k.slab(0, top - 0.5, 0, W, 0.5, D, 'edge');
  // the parapet, its merlons, and the dark machicolation slots between the corbels
  for (const f of faces(W, D)) {
    const [px, pz] = onFace(f, 0, -0.35);
    k.slab(px, top, pz, f.nx ? 0.7 : f.span, 1.3, f.nx ? f.span : 0.7, 'stone');
    if (fine) {
      const [ax, az] = onFace(f, -f.span / 2 + 0.6, -0.35);
      const [bx, bz] = onFace(f, f.span / 2 - 0.6, -0.35);
      k.crenels(ax, az, bx, bz, top + 1.3, 0.7, { c: 'stone', h: 1.1 });
    }
  }
  const end = o.end ?? 'needle';
  const ceilRoom = o._ceilRoom;
  if (end === 'band') {
    // a gallery only; what rises above it is the caller's
  } else if (end === 'needle') {
    const sp = o.spire ?? w * 2.4;
    k.slab(0, top, 0, w - 0.4, 2.2, d - 0.4, 'stone2');
    k.slab(0, top + 2.2, 0, w + 0.1, 0.3, d + 0.1, 'edge');
    k.pyramid(0, top + 2.5, 0, (w - 0.2) / 2 * SQ2, sp, 'roof', { sides: 4, dr: (d - 0.2) / 2 * SQ2 });
    k.prism(0, top + 2.5 + sp - 0.4, 0, 0.12, 2.6, 'iron', { sides: 4, layer: 'metal' });
    // spire lucarnes: one gabled slit per face, low on the needle
    if (fine) {
      for (const f of faces(w - 0.4, d - 0.4)) {
        const [px, pz] = onFace(f, 0, -0.6);
        k.at({ x: px, y: top + 3.6, z: pz, ry: f.a }, () => {
          k.slab(0, 0, 0, 1.2, 1.8, 1.2, 'stone2');
          k.wedge(0, 1.8, 0, 1.4, 1.0, 1.4, 'roof', { ry: UP });
          k.block(0, 0.9, 0.62, 0.36, 1.2, 0.05, 'dark', { grad: 0 });
        });
      }
    }
  } else if (end === 'flat') {
    k.slab(0, top, 0, w - 0.8, 0.3, d - 0.8, 'stone2');
  }
  // bartizans at the corners, each with its own needle
  if (fine && o.bartizans !== false) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = sx * (W / 2 - 0.4), z = sz * (D / 2 - 0.4);
      k.ramp(x, top - 2.4, z, 1.6, 1.9, 1.6, 'edge', { rz: Math.PI, ry: Math.atan2(sx, sz) + Math.PI });
      k.slab(x, top - 0.5, z, 1.8, 3.2, 1.8, 'stone');
      k.pyramid(x, top + 2.7, z, 1.35, end === 'needle' ? 4.2 : 3, 'roof', { sides: 4 });
      k.block(x + sx * 0.9, top + 1.4, z, 0.06, 1.2, 0.3, 'dark', { grad: 0 });
    }
  }
}

// A curtain wall from A to B (site-local). `out` is the side the enemy came from: +1 = the
// wall's local +x. Battered revetment down to its footing on the outside, a corbelled parapet
// with merlons over the drop, a walk on top, lancet slits on the outer face.
function curtain(S, ax, az, bx, bz, o) {
  const k = S.k;
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.5) return null;
  const ry = Math.atan2(bx - ax, bz - az);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const t = o.t ?? 3;
  const top = o.top;
  const out = o.out;
  const foot = Math.min(o.base, S.lowest(mx, mz, t + 2.4, len, ry)) - 1.5;
  const fine = k.detail >= 1;
  const batterTop = o.batterTop ?? o.base + 2.5;
  const bw = o.batterW ?? 1.2;
  for (let u = -len / 2; u <= len / 2 + 0.01; u += 8) S.exclude(mx + Math.sin(ry) * u, mz + Math.cos(ry) * u, t / 2 + bw + 3);
  if (o.ruin) return ruinedRun(S, ax, az, bx, bz, { ...o, t, foot, ry, len, mx, mz, batterTop, bw });
  k.at({ x: mx, z: mz, ry }, () => {
    if (batterTop - foot > 0.2) k.slab(0, foot, 0, t, Math.max(0.2, o.base - foot), len + 0.02, 'stone2');
    k.masonry(0, o.base, 0, t, top - o.base, len + 0.02, { course: o.course ?? 1.8 });
    // the battered skirt on the outside
    k.ramp(out * (t / 2 + bw / 2), foot, 0, len + 0.02, batterTop - foot, bw, 'stone2', { ry: out * UP });
    if (fine) k.slab(out * (t / 2 + 0.1), batterTop - 0.2, 0, 0.5, 0.4, len + 0.04, 'edge');
    // corbels, the projecting parapet and its merlons
    const pTop = top + (o.parapet ?? 1.3);
    if (fine) {
      const n = Math.max(2, Math.round(len / 1.6));
      for (let i = 0; i < n; i++) {
        const z = -len / 2 + (len / n) * (i + 0.5);
        k.ramp(out * (t / 2 + 0.4), top - 1.9, z, 0.55, 1.5, 0.8, 'edge', { rz: Math.PI, ry: out * UP + Math.PI });
      }
    }
    k.slab(out * (t / 2 + 0.05), top - 0.4, 0, 1.0, 0.4, len + 0.02, 'edge');
    k.slab(out * (t / 2 + 0.2), top, 0, 0.7, pTop - top, len + 0.02, 'stone');
    if (fine) k.crenels(out * (t / 2 + 0.2), -len / 2 + 0.5, out * (t / 2 + 0.2), len / 2 - 0.5, pTop, 0.7, { c: 'stone', h: 1.0 });
    // an inner kerb on the walk
    k.slab(-out * (t / 2 - 0.25), top, 0, 0.5, 0.5, len + 0.02, 'edge');
    if (fine && o.slits !== false) {
      const n = Math.max(1, Math.floor(len / 6));
      for (let i = 0; i < n; i++) {
        const z = -len / 2 + (len / n) * (i + 0.5);
        k.window(out * (t / 2 + 0.01), o.base + (top - o.base) * 0.42, z, 0.4, 2.2, { ry: out * UP, pointed: true });
      }
    }
  });
  // colliders: wall to the walk, the outer parapet
  S.solid(mx, mz, t, len, foot, top, { rot: ry });
  const [px, pz] = [mx + Math.cos(ry) * out * (t / 2 + 0.2), mz - Math.sin(ry) * out * (t / 2 + 0.2)];
  S.solid(px, pz, 0.7, len, top, top + (o.parapet ?? 1.3), { rot: ry });
  // anchor points along the outer face (site-local, later converted)
  const nx = Math.cos(ry) * out, nz = -Math.sin(ry) * out;
  const faceX = mx + nx * (t / 2 + 0.05), faceZ = mz + nz * (t / 2 + 0.05);
  return {
    banner: { x: faceX, z: faceZ, y: top - 2.4, nx, nz, len: bannerDrop(S, faceX, faceZ, nx, nz, top - 2.4) },
    gibbet: { x: mx + nx * (t / 2 + 1.8), z: mz + nz * (t / 2 + 1.8), y: top + 0.6 },
    ry, len, mx, mz,
  };
}

// A run the Rift tore down: the courses stand to ragged heights, the fallen ones lie in the
// field outside, a scar of fresh stone where each broke. Walkable on its stubs.
function ruinedRun(S, ax, az, bx, bz, o) {
  const k = S.k;
  const rng = seededRandom(Math.floor(hash3(ax, az, bx) * 1e6));
  const n = Math.max(3, Math.round(o.len / 3));
  const sl = o.len / n;
  k.at({ x: o.mx, z: o.mz, ry: o.ry }, () => {
    k.slab(0, o.foot, 0, o.t, Math.max(0.2, o.base - o.foot), o.len + 0.02, 'stone2');
    k.ramp(o.out * (o.t / 2 + o.bw / 2), o.foot, 0, o.len + 0.02, o.batterTop - o.foot, o.bw, 'stone2', { ry: o.out * UP });
    for (let i = 0; i < n; i++) {
      const edge = Math.min(i, n - 1 - i) / Math.max(1, (n - 1) / 2);
      const h = (o.top - o.base) * Math.max(0.1, Math.min(1, 0.25 + (1 - edge) * 0.55 + rng() * 0.3));
      const z = -o.len / 2 + sl * (i + 0.5);
      k.masonry(0, o.base, z, o.t, h, sl + 0.02, { course: o.course ?? 1.8 });
      k.slab(0, o.base + h - 0.2, z, o.t - 0.3, 0.25, sl - 0.2, 'scar');
      S.solid(o.mx + Math.sin(o.ry) * z, o.mz + Math.cos(o.ry) * z, o.t, sl, o.foot, o.base + h, { rot: o.ry });
    }
    if (k.detail >= 1) for (let i = 0; i < Math.round(o.len / 5); i++) k.rubble(o.out * (o.t / 2 + 3 + rng() * 3), o.base - 0.2, -o.len / 2 + (i + 0.5) * 5, 2.4, 6, rng);
  });
  return null;
}

// How far a banner can hang from yTop on a face at (x, z) looking along (nx, nz) before
// it would touch the ground in front of it.
function bannerDrop(S, x, z, nx, nz, yTop) {
  let g = -Infinity;
  for (const d of [0.4, 1.2, 2.4]) g = Math.max(g, S.ground(x + nx * d, z + nz * d));
  return r2(Math.max(0, Math.min(16, yTop - g - 1.2)));
}

// A pointed gate arch through a wall run along local x at z, with the mass above it filled.
function gateArch(k, z, spring, span, depth, fillTo, o = {}) {
  k.arch(0, spring, z, span, { pointed: true, t: o.t ?? 1.1, depth, spandrel: true, spandrelH: 0.2, c: 'edge', fill: 'stone', key: 'edge' });
  const apex = spring + span * 0.74 + (o.t ?? 1.1);
  if (fillTo > apex) k.masonry(0, apex - 0.2, z, span + 2.4, fillTo - apex + 0.2, depth, { course: 1.8 });
}

// A raised portcullis: iron grille teeth hanging under the arch.
function portcullis(k, z, y, span) {
  const n = Math.max(3, Math.round(span / 0.9));
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + 0.45 + (i * (span - 0.9)) / (n - 1);
    k.prism(x, y, z, 0.12, 2.6, 'iron', { sides: 4, layer: 'metal' });
    k.pyramid(x, y - 0.5, z, 0.16, 0.5, 'iron', { sides: 4, layer: 'metal', rx: Math.PI });
  }
  for (const yy of [y + 0.6, y + 1.8]) k.slab(0, yy, z, span - 0.4, 0.16, 0.16, 'iron', { layer: 'metal' });
}

// Stairs as colliders: n steps from (x, y0) climbing along the site direction (dx, dz).
function stairColliders(S, x, z, dx, dz, w, n, rise, run, y0, foot, ry) {
  for (let i = 0; i < n; i++) {
    const s = run * (i + 0.5);
    S.solid(x + dx * s, z + dz * s, w, run + 0.02, foot, y0 + rise * (i + 1), { rot: ry });
  }
}

// ================================================================== the Chainward
// Chainward-local frame: origin at the lower ward's centre (6000, 6168), yaw 0, so local
// offsets are world offsets (+x west, +z north). Upper ward centre is local (0, 4).
const CW = RIFT_CASTLES.chainward;
const UPPER = RIFT_PADS.chainward_upper;
const LOWER = RIFT_PADS.chainward_lower;
const FORE = RIFT_PADS.chainward_forecourt;

function upperRim(deg, f = 1) {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * UPPER.rx * f, UPPER.z - CW.z + Math.sin(a) * UPPER.rz * f];
}
function lowerRim(deg, grow = 0) {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * (LOWER.rx + grow), LOWER.z - CW.z + Math.sin(a) * (LOWER.rz + grow)];
}

function buildChainward(world, low, A) {
  const S = new Site(world, CW.x, CW.z, CW.yaw, low, 'rift_chainward');
  const k = S.k;
  const rng = seededRandom(6168);
  const fine = !low;
  const L = LOWER.h, U = UPPER.h; // 17, 24
  const towers = {};

  // ---------------------------------------------------------------- the gatehouse
  // Over the climb from the lower ward (17) to the upper (24): the stair runs z 6106 -> 6124
  // inside a vaulted passage 8 m wide, then a landing into the ward.
  const gz0 = CW.gate.z - CW.z - 9.5; // front face, world z 6106.5
  const gz1 = UPPER.z - CW.z - 45.5; // rear face, world z 6126.5 (the nave's court starts at 6127)
  const PH = 4; // passage half-width
  const TW = 10.5; // front tower width
  const steps = 24, rise = (U - L) / steps, run = 0.75;
  const sz0 = gz0 + 0.5; // first step
  k.stair(0, L, sz0, PH * 2, steps, { rise, run, base: L - 1, cheeks: false, c: 'stone', c2: 'stone2' });
  stairColliders(S, 0, sz0, 0, 1, PH * 2, steps, rise, run, L, L - 1, 0);
  const land0 = sz0 + steps * run;
  S.solid(0, (land0 + gz1 - 0.1) / 2, PH * 2, gz1 - 0.1 - land0, U - 1, U);
  k.slab(0, U - 0.4, (land0 + gz1 + 2) / 2, PH * 2, 0.42, gz1 + 2 - land0, 'stone');
  // the two front towers
  const gateTop = 58;
  for (const sx of [-1, 1]) {
    const tx = sx * (PH + TW / 2);
    const tz = gz0 + 5.5;
    towers['gate' + (sx > 0 ? 'W' : 'E')] = keepTower(S, {
      x: tx, z: tz, w: TW, d: 11, base: L, top: gateTop, spire: 15, batter: 6, flare: 1.12,
      lit: sx > 0 ? [{ face: 2, y: 52, u: 1.5 }] : [],
      hawse: [{ y: 46, toward: sx > 0 ? 'relay_west' : 'relay_south' }],
      banners: [{ face: 2, y: 43, len: 19, w: 2.6, u: -sx * 1.8 }],
    });
  }
  // the gate block between and behind the towers: over the passage, and the rear wings
  const blockTop = 46;
  const rearZ = (gz0 + 11 + gz1) / 2, rearD = gz1 - (gz0 + 11);
  for (const sx of [-1, 1]) {
    const cx = sx * (PH + 5.25);
    k.slab(cx, L - 1, rearZ, 10.5, U - L + 1, rearD, 'stone2');
    k.masonry(cx, U, rearZ, 10.5, blockTop - U, rearD, { course: 1.8 });
    S.solid(cx, rearZ, 10.5, rearD, L - 1, blockTop);
  }
  // the vault over the passage, the front and rear arches
  const vault = 33;
  k.masonry(0, vault, (gz0 + gz1) / 2, PH * 2 + 0.2, blockTop - vault, gz1 - gz0, { course: 1.8 });
  S.solid(0, (gz0 + gz1) / 2, PH * 2, gz1 - gz0, vault, blockTop);
  k.slab(0, vault - 0.3, (gz0 + gz1) / 2, PH * 2, 0.3, gz1 - gz0 - 1, 'dark');
  gateArch(k, gz0 + 0.8, 25, PH * 2, 1.6, vault);
  gateArch(k, gz1 - 0.8, 26, PH * 2, 1.6, vault);
  // inner faces of the passage: the towers and wings are solid, show them coursed
  for (const sx of [-1, 1]) k.slab(sx * (PH + 0.05), L - 1, (gz0 + gz1) / 2, 0.1, vault - L + 1, gz1 - gz0, 'stone2');
  portcullis(k, gz0 + 2.2, 29.5, PH * 2 - 0.4);
  // machicolated box over the gate between the towers, its parapet and the roof walk
  if (fine) {
    for (let i = 0; i < 6; i++) k.ramp(-PH + 0.67 + i * 1.33, 38.2, gz0 - 0.5, 0.55, 1.8, 1.0, 'edge', { rz: Math.PI, ry: 0 });
  }
  k.slab(0, 40, gz0 - 0.4, PH * 2, 0.5, 1.6, 'edge');
  k.slab(0, 40.5, gz0 - 1.0, PH * 2, 2.2, 0.6, 'stone');
  k.slab(0, blockTop - 0.4, (gz0 + gz1) / 2, PH * 2 + 21, 0.5, gz1 - gz0, 'edge');
  if (fine) k.crenels(-PH - 10.4, gz1 - 0.45, PH + 10.4, gz1 - 0.45, blockTop + 0.1, 0.7, { c: 'stone' });
  S.solid(0, gz1 - 0.45, PH * 2 + 21, 0.7, blockTop, blockTop + 1.2);
  // the forework: a porch out in front of the gate between its towers, its arch in three
  // receding orders, so the front is a deep mouth in a thick wall and not a slot in a slab;
  // a machicolated gallery runs across it from tower to tower
  {
    const pz0 = gz0 - 3.4, pd = gz0 - pz0 + 0.3;
    const pTop = L + 15;
    for (const sx of [-1, 1]) {
      k.masonry(sx * (PH + 1.5), L, pz0 + pd / 2, 3.0, pTop - L, pd, { course: 1.8 });
      if (fine) k.buttress(sx * (PH + 2.4), L, pz0, 9, { ry: Math.PI, w: 1.1, depth: 1.4, stages: 2 });
      S.solid(sx * (PH + 1.5), pz0 + pd / 2, 3.0, pd, L - 1, pTop);
    }
    for (let o = 0; o < 3; o++) {
      const span = PH * 2 + 2.4 - o * 0.8;
      k.arch(0, L + 8.2 - o * 0.2, pz0 + 0.45 + o * 0.95, span, { pointed: true, t: 0.75, depth: 0.95, spandrel: true, spandrelH: 0.2, c: o % 2 ? 'stone' : 'edge', fill: 'stone', key: 'edge' });
    }
    k.masonry(0, L + 15 - 0.3 - 0.6, pz0 + pd / 2, PH * 2 + 6, 0.6, pd, { course: 0.6 });
    if (fine) for (let i = 0; i < 9; i++) k.ramp(-PH - 2.6 + i * ((PH * 2 + 5.2) / 8), pTop - 1.6, pz0 - 0.35, 0.55, 1.4, 0.8, 'edge', { rz: Math.PI, ry: 0 });
    k.slab(0, pTop, pz0 + pd / 2 - 0.3, PH * 2 + 6.4, 0.4, pd + 0.9, 'edge');
    k.slab(0, pTop + 0.4, pz0 - 0.35, PH * 2 + 6.4, 1.2, 0.6, 'stone');
    if (fine) k.crenels(-PH - 3, pz0 - 0.35, PH + 3, pz0 - 0.35, pTop + 1.6, 0.6, { c: 'stone', h: 0.9 });
    S.solid(0, pz0 + pd / 2, PH * 2 + 6, pd, L + 14.1, pTop + 0.4);
    // braziers before the towers, the way's only warm light up to the gate
    for (const sx of [-1, 1]) {
      const bx = sx * 12, bz = pz0 - 1.4;
      k.slab(bx, L, bz, 1.4, 0.9, 1.4, 'stone2');
      k.prism(bx, L + 0.9, bz, 0.8, 0.4, 'iron', { sides: 8, top: 1.3, layer: 'metal' });
      k.prism(bx, L + 1.1, bz, 0.55, 0.3, 'ember', { sides: 6, layer: 'glow', strength: 0.75 });
      S.solid(bx, bz, 1.4, 1.4, L - 1, L + 1.3);
    }
  }
  // the great banner over the arch
  k.banner(0, 32.5, gz0 - 1.4, 3.2, 7.2, 'cloth', { rod: 'iron' });

  // ---------------------------------------------------------------- the upper curtain
  const ut = 3.2;
  const uTop = 36;
  const curtainRuns = [];
  const nodes = [];
  const addRim = (deg) => nodes.push({ p: upperRim(deg, 1 - (ut / 2 - 0.4) / 55) });
  const T = (id, p, w, opts) => nodes.push({ p, tower: { id, w, ...opts } });
  T('gateFlankW', [PH + 10.5, gz1 - 2.5], 0, { skip: true });
  nodes.push({ p: [33, -42.6] });
  T('sw', [38.5, -39], 9, { top: 50, spire: 14, hawse: [{ y: 40, toward: 'relay_west' }] });
  addRim(-38);
  T('w', upperRim(-20), 9, { top: 54, spire: 16, twist: 0.1, lit: [{ face: 1, y: 49 }] });
  addRim(0);
  addRim(20);
  T('nw', upperRim(45), 11, { top: 74, spire: 22, lean: [2.6, 3.2], warpFrom: 34, warpTo: 96, lit: [{ face: 1, y: 66 }], hawse: [{ y: 58, toward: 'relay_north' }, { y: 48, toward: 'relay_north' }] });
  addRim(68);
  T('n', [0, 51], 10, { top: 47, end: 'broken', breach: [{ face: 0, y: 38 }, { face: 2, y: 30, size: 0.9 }] });
  addRim(112);
  T('ne', upperRim(135), 15, { top: 50, end: 'fused', course: 2.4, twist: -0.14, warpFrom: 40, warpTo: 92, lit: [{ face: 3, y: 64, u: 2 }, { face: 2, y: 71, u: -3 }], hawse: [{ y: 54, toward: 'relay_northeast' }, { y: 44, toward: 'relay_south' }, { y: 60, toward: 'relay_northeast' }], breach: [{ face: 3, y: 34, size: 1.4 }] });
  addRim(158);
  T('e', upperRim(180), 9, { top: 56, spire: 15, lean: [-1.2, 1.6], warpFrom: 30, warpTo: 80, hawse: [{ y: 46, toward: 'relay_northeast' }] });
  addRim(205);
  T('se', [-38.5, -39], 9, { top: 46, spire: 12, breach: [{ face: 3, y: 33, size: 1.5 }, { face: 2, y: 27 }] });
  nodes.push({ p: [-33, -42.6] });
  T('gateFlankE', [-PH - 10.5, gz1 - 2.5], 0, { skip: true });
  // towers first (they own their footprint), then the wall runs between their faces
  const centre = [0, UPPER.z - CW.z];
  for (const n of nodes) {
    if (!n.tower || n.tower.skip) continue;
    const t = n.tower;
    const toCentre = Math.atan2(centre[0] - n.p[0], centre[1] - n.p[1]);
    towers[t.id] = keepTower(S, { x: n.p[0], z: n.p[1], w: t.w, base: L, ry: Math.round(toCentre / UP) * UP, ...t });
    towers[t.id].pos = n.p;
    towers[t.id].w = t.w;
  }
  for (let i = 0; i + 1 < nodes.length; i++) {
    let a = nodes[i].p, b = nodes[i + 1].p;
    // stop the run at a tower's face, not its centre
    const trim = (p, q, n) => {
      if (!n.tower || n.tower.skip) return p;
      const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const cut = n.tower.w / 2 - 0.5;
      return [p[0] + ((q[0] - p[0]) / L2) * cut, p[1] + ((q[1] - p[1]) / L2) * cut];
    };
    const a2 = trim(a, b, nodes[i]), b2 = trim(b, a, nodes[i + 1]);
    const mx = (a2[0] + b2[0]) / 2, mz = (a2[1] + b2[1]) / 2;
    const ry = Math.atan2(b2[0] - a2[0], b2[1] - a2[1]);
    const nx = Math.cos(ry), nz = -Math.sin(ry);
    const outSide = nx * (mx - centre[0]) + nz * (mz - centre[1]) > 0 ? 1 : -1;
    curtainRuns.push(curtain(S, a2[0], a2[1], b2[0], b2[1], { base: U - 0.5, top: uTop, t: ut, out: outSide, batterTop: U + 1.5 }));
  }

  // ---------------------------------------------------------------- flying buttresses
  // The donjon and the east tower were shored from the ward when the ground first moved:
  // piers in the upper ward, flyers leaning onto the towers' inner faces.
  const shore = (tw, dist, spread, pierTop, hitY) => {
    const c = tw.pos;
    const dx = centre[0] - c[0], dz = centre[1] - c[1];
    const m = Math.hypot(dx, dz), ux = dx / m, uz = dz / m, px = uz, pz = -ux;
    for (const sd of [-1, 1]) {
      const qx = c[0] + ux * dist + px * spread * sd, qz = c[1] + uz * dist + pz * spread * sd;
      k.pier(qx, U, qz, 2.4, pierTop - U, {});
      k.pinnacle(qx, pierTop, qz, 1.2, { roof: 'roof' });
      S.solid(qx, qz, 2.4, 2.4, U - 1, pierTop);
      const half = tw.w / 2 + 0.2;
      k.flyer([qx, pierTop - 0.4, qz], [c[0] + ux * half + px * spread * sd, hitY, c[1] + uz * half + pz * spread * sd], { t: 1.0, w: 1.1, segments: 8 });
    }
  };
  shore(towers.ne, 17, 4, 40, 50);
  shore(towers.e, 14, 3.5, 35, 44);

  // ---------------------------------------------------------------- the outer line
  // One wall round the outer bailey (the forecourt, sheer-rimmed at the lower ward's height)
  // and on along the lower ward's rim: the lists between it and the curtain stay open all the
  // way round. The ramp comes in through the outer gate on the bailey's south rim; the north
  // stretch is broken where the north tower's crown came down across it.
  const fc = [FORE.x - CW.x, FORE.z - CW.z];
  const FRX = FORE.rx ?? FORE.r + 2, FRZ = FORE.rz ?? FORE.r + 2;
  const lt = 2.6, lTop = 23.5;
  const foreRim = (deg, grow = 0) => {
    const a = (deg * Math.PI) / 180;
    return [fc[0] + Math.cos(a) * (FRX + grow), fc[1] + Math.sin(a) * (FRZ + grow)];
  };
  const inLower = (p) => (p[0] / LOWER.rx) ** 2 + ((p[1] - (LOWER.z - CW.z)) / LOWER.rz) ** 2 < 1;
  // where the bailey's rim runs into the lower ward
  let joinDeg = 0;
  for (let deg = -90; deg <= 90; deg += 1) if (!inLower(foreRim(deg))) joinDeg = deg;
  const lowerDeg = (p) => (Math.atan2((p[1] - (LOWER.z - CW.z)) / LOWER.rz, p[0] / LOWER.rx) * 180) / Math.PI;
  const gateDeg = 9; // half the opening the outer gate takes on the rim, in degrees
  const outer = [];
  for (let deg = -90 + gateDeg; deg < joinDeg; deg += 12) outer.push({ p: foreRim(deg, lt / 2), bailey: true });
  outer.push({ p: foreRim(joinDeg, lt / 2), bailey: true });
  const l0 = lowerDeg(foreRim(joinDeg)) + 4, l1 = 180 - l0;
  for (let deg = l0; deg <= l1 + 0.01; deg += (l1 - l0) / 24) outer.push({ p: lowerRim(deg, lt / 2), deg });
  outer.push({ p: foreRim(180 - joinDeg, lt / 2), bailey: true });
  for (let deg = 180 - joinDeg - 12; deg > 270 - gateDeg - 12; deg -= 12) outer.push({ p: foreRim(deg, lt / 2), bailey: true });
  outer.push({ p: foreRim(270 - gateDeg, lt / 2), bailey: true });
  const breachArc = [80, 98];
  for (let i = 0; i + 1 < outer.length; i++) {
    const a = outer[i].p, b = outer[i + 1].p;
    const dm = outer[i].deg ?? -999, dn = outer[i + 1].deg ?? -999;
    if (dm > breachArc[0] && dn < breachArc[1] + 14) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const ref = outer[i].bailey && outer[i + 1].bailey ? fc : [0, LOWER.z - CW.z];
    const outSide = Math.cos(ry) * (mx - ref[0]) - Math.sin(ry) * (mz - ref[1]) > 0 ? 1 : -1;
    const ruin = !outer[i].bailey && [3, 9, 16, 22].includes(i - outer.findIndex((q) => !q.bailey));
    curtainRuns.push(curtain(S, a[0], a[1], b[0], b[1], { base: L, top: lTop + (outer[i].bailey ? 1 : 0), t: lt, out: outSide, batterTop: L - 2, course: 1.5, ruin }));
  }
  // the outer gate: the barbican's gatehouse where the Processional Terrace's street comes in
  // across the bailey's south rim, its towers tied into the rim wall on both sides
  const ogz = fc[1] - FRZ - 0.4;
  const OG = new WallFrame(world, CW.x, CW.z, CASTLE_PALETTE, { tag: TAG, name: 'rift_chainward_outer_gate', low });
  gatehouse(OG, 0, ogz, 0, { width: PH * 2, depth: 9, towers: 7, top: L + 8.5, towerTop: L + 14, floorOut: L, floorIn: L });
  const outerGate = OG.build();
  for (const e of OG.ex) S.ex.push(e);
  // the bailey's paving: worn flags laid level at the lower ward's height
  // Courses of flags across the court, close-jointed, of near tones: a lifted flag here and
  // there, a few lighter where the feet went most.
  if (fine) {
    const FLAG = ['#433d51', '#3f3a4c', '#47415a', '#3b3647', '#4b4560'];
    let row = 0;
    for (let z = fc[1] - FRZ + 2; z < gz0 - 1; z += 1.42, row++) {
      let x = fc[0] - FRX + 1.2 + (row % 2) * 0.6;
      while (x < fc[0] + FRX - 1.2) {
        const w = 1.0 + hash3(x, z, 1) * 0.7, cx = x + w / 2;
        x += w + 0.08;
        if ((cx - fc[0]) ** 2 / (FRX - 2) ** 2 + (z - fc[1]) ** 2 / (FRZ - 2) ** 2 > 1 || inLower([cx, z])) continue;
        const h = hash3(cx, 3, z);
        if (h < 0.025) continue;
        const worn = Math.abs(cx - fc[0]) < PH + 1 && h > 0.55;
        k.slab(cx, L - 0.05, z, w, 0.1 + (h > 0.97 ? 0.05 : 0), 1.34, worn ? '#514a63' : FLAG[Math.floor(h * 977) % FLAG.length], { grad: 0.02, ry: (h - 0.5) * 0.03, rz: h > 0.97 ? 0.05 : 0 });
      }
    }
  }

  // flanking towers on the lower wall, standing out over the cliff
  for (const deg of [-38, 8, 50, 135, 172, 214]) {
    const p = lowerRim(deg, lt + 3.2);
    if (deg < l0 + 3 || deg > l1 - 3) continue;
    const toC = Math.atan2(-p[0], -p[1]);
    const id = 'lower' + deg;
    towers[id] = keepTower(S, { x: p[0], z: p[1], w: 6.4, base: L, top: 31 + (deg % 3), ry: toC, end: deg === 172 ? 'broken' : 'needle', spire: 8, batter: 4, ledge: 7, bartizans: false });
  }
  // the north tower's crown, fallen across the lower wall and down the slope to the void
  {
    const pieces = [[8, 60, 0.42, 7.5, 14, 0.35], [15, 69, 0.55, 7.0, 11, 0.6], [22, 77, 0.7, 6.5, 8, 0.9]];
    for (const [x, z, yaw, s, len, tilt] of pieces) {
      const g = S.ground(x, z);
      k.at({ x, y: g - 1.2, z, ry: yaw, rx: tilt * 0.4, rz: (rng() - 0.5) * 0.4 }, () => {
        k.masonry(0, 0, 0, s, s * 0.9, len, { course: 1.8 });
        k.slab(0, s * 0.9, 0, s + 0.6, 0.4, len * 0.2, 'edge');
        k.slab(0, 0, len / 2 - 0.4, s - 0.6, s * 0.9, 0.8, 'scar');
      });
      S.solid(x, z, s, len, g - 2, g - 1.2 + s * 0.8, { rot: yaw });
      k.rubble(x + 3, g, z - 2, 4, fine ? 9 : 4, rng);
    }
  }

  // ---------------------------------------------------------------- a stair to the walk
  // In the west lists, against the curtain: the garrison went up to the walk this way.
  {
    const sx = 52.4, sz0w = 18, n = Math.round((uTop - L) / 0.32);
    const rise2 = (uTop - L) / n, run2 = 0.62;
    // climbs south along the inner face of the lower ward? No: it climbs north against the
    // curtain's outer face, inside the lists, to a landing at the walk.
    const ux = upperRim(14)[0] + ut / 2 + 1.8;
    k.stair(ux, L, sz0w - n * run2, 2.4, n, { rise: rise2, run: run2, base: L - 0.5, c: 'stone', c2: 'stone2' });
    stairColliders(S, ux, sz0w - n * run2, 0, 1, 2.4, n, rise2, run2, L, L - 0.5, 0);
    void sx;
  }

  // ---------------------------------------------------------------- light, anchors, exclusions
  const lights = [];
  for (const t of Object.values(towers)) for (const p of t.lit || []) lights.push(p);
  const g = S.build();

  // anchors: chains from the hawse rings, banners on the outer faces, gibbets over the drops
  for (const [id, t] of Object.entries(towers)) {
    for (const r of t.rings || []) A.chains.push({ id: `chainward_${id}_${A.chains.length}`, x: r.x, y: r.y, z: r.z, toward: r.toward });
  }
  const pick = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);
  const longRuns = curtainRuns.filter((r) => r && r.len > 9 && r.banner.len > 8);
  for (const r of pick(longRuns, 7)) {
    const p = S.pt(r.banner.x, r.banner.y, r.banner.z);
    const [nx, nz] = S.dir(r.banner.nx, r.banner.nz);
    A.banners.push({ x: p.x, y: p.y, z: p.z, nx: r2(nx), nz: r2(nz), len: r2(Math.min(16, r.banner.len)), site: 'chainward' });
  }
  for (const r of pick(longRuns.slice(3), 4)) A.gibbets.push({ ...S.pt(r.gibbet.x, r.gibbet.y, r.gibbet.z), site: 'chainward' });
  for (const id of ['nw', 'w', 'e', 'gateW']) if (towers[id] && towers[id].gibbets[0]) A.gibbets.push({ ...towers[id].gibbets[0], site: 'chainward' });

  return { group: g, lights, towers, extra: [outerGate] };
}

// ================================================================== the Unanswered Bastion
// Bastion-local frame (yaw PI/2): local -z points east to the bridge, +z west, +x south.
const BA = RIFT_CASTLES.bastion;
const MESA = RIFT_PADS.bastion_mesa;

function buildBastion(world, low, A, anim) {
  const S = new Site(world, BA.x, BA.z, BA.yaw, low, 'rift_bastion');
  const k = S.k;
  const rng = seededRandom(6258);
  const fine = !low;
  const H = MESA.h; // 14
  const wTop = 24;
  const ax = MESA.rz, az = MESA.rx; // local x spans world z, local z spans world x
  // five arrowhead bastions with their salients on the mesa's rim
  const salients = [0, 70, 140, 220, 290].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const P = [ax * 0.95 * Math.sin(a), az * 0.95 * Math.cos(a)];
    const m = Math.hypot(P[0], P[1]);
    return { deg, P, u: [P[0] / m, P[1] / m] };
  });
  const rotv = (v, deg) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [c * v[0] - s * v[1], s * v[0] + c * v[1]];
  };
  const trace = [];
  for (const b of salients) {
    const fa = rotv(b.u, 40), fb = rotv(b.u, -40);
    const Sa = [b.P[0] - 11 * fa[0], b.P[1] - 11 * fa[1]];
    const Sb = [b.P[0] - 11 * fb[0], b.P[1] - 11 * fb[1]];
    const Ga = [Sa[0] - 4 * b.u[0], Sa[1] - 4 * b.u[1]];
    const Gb = [Sb[0] - 4 * b.u[0], Sb[1] - 4 * b.u[1]];
    // order the two sides by angle so the trace runs the same way round
    const ang = (p) => Math.atan2(p[0], p[1]);
    const first = ((ang(Sa) - ang(b.P) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI < 0 ? [Ga, Sa, Sb, Gb] : [Gb, Sb, Sa, Ga];
    trace.push({ pts: [first[0], first[1], b.P, first[2], first[3]], b });
  }
  const loop = [];
  for (const t of trace) for (const p of t.pts) loop.push(p);
  // walls round the loop; the east curtain (between the 140 and 220 bastions) has the gate
  const runs = [];
  const gateHalf = 3.6;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const outSide = Math.cos(ry) * mx - Math.sin(ry) * mz > 0 ? 1 : -1;
    const isGate = mz < -20 && Math.abs(mx) < 1 && Math.abs(a[0] - b[0]) > 20;
    if (isGate) {
      // split round the gatehouse
      const dir = Math.sign(b[0] - a[0]);
      const g1 = [-dir * (gateHalf + 7), a[1] + (b[1] - a[1]) * ((-dir * (gateHalf + 7) - a[0]) / (b[0] - a[0]))];
      const g2 = [dir * (gateHalf + 7), a[1] + (b[1] - a[1]) * ((dir * (gateHalf + 7) - a[0]) / (b[0] - a[0]))];
      runs.push(curtain(S, a[0], a[1], g1[0], g1[1], { base: H, top: wTop, t: 4, out: outSide, batterTop: H + 1 }));
      runs.push(curtain(S, g2[0], g2[1], b[0], b[1], { base: H, top: wTop, t: 4, out: outSide, batterTop: H + 1 }));
      continue;
    }
    runs.push(curtain(S, a[0], a[1], b[0], b[1], { base: H, top: wTop, t: 4, out: outSide, batterTop: H + 1 }));
  }
  // a watch turret on every salient, hung out over the drop
  const turrets = [];
  for (const b of salients) {
    const p = [b.P[0] - b.u[0] * 1.2, b.P[1] - b.u[1] * 1.2];
    const t = keepTower(S, { x: p[0], z: p[1], w: 3.6, base: wTop - 2, top: wTop + 5, end: 'needle', spire: 6, batter: 0.5, flare: 1, ledge: 99, bartizans: false, ry: Math.atan2(b.u[0], b.u[1]) });
    turrets.push(t);
  }

  // ---------------------------------------------------------------- the gate: the bridge's west head
  const gateFront = -(az - 2); // local z of the gate front (world x 6220)
  const gateBack = -24.5;
  const gD = gateBack - gateFront;
  const gzC = (gateFront + gateBack) / 2;
  const heads = {};
  for (const sx of [-1, 1]) {
    heads[sx] = keepTower(S, { x: sx * (gateHalf + 3.5), z: gzC, w: 7, d: gD, base: H, top: 44, spire: 13, batter: 4, ledge: 8,
      hawse: sx > 0 ? [{ y: 36, toward: 'chainward' }] : [],
      banners: [{ face: 2, y: 38, len: 13, w: 2.2 }] });
  }
  const gvault = 24.5;
  gateArch(k, gateFront + 0.8, H + 5.2, gateHalf * 2, 1.6, gvault);
  gateArch(k, gateBack - 0.8, H + 5.2, gateHalf * 2, 1.6, gvault);
  k.masonry(0, gvault, gzC, gateHalf * 2 + 0.2, 36 - gvault, gD, { course: 1.8 });
  S.solid(0, gzC, gateHalf * 2, gD, gvault, 36);
  k.slab(0, 36, gzC, gateHalf * 2 + 14, 0.4, gD, 'edge');
  if (fine) k.crenels(-gateHalf - 6.8, gateFront - 0.2, gateHalf + 6.8, gateFront - 0.2, 36.4, 0.7, { c: 'stone' });
  S.solid(0, gateFront - 0.2, gateHalf * 2 + 14, 0.7, 36, 37.3);
  portcullis(k, gateFront + 2, H + 8.6, gateHalf * 2 - 0.4);
  // the passage floor at the mesa's height (the lip below the gate is still being dressed)
  S.solid(0, gzC, gateHalf * 2, gD + 0.6, H - 3, H);
  k.slab(0, H - 3, gzC, gateHalf * 2, 3, gD + 0.6, 'stone2');

  // ---------------------------------------------------------------- the relay hall and its bell
  // The hall where the stations' calls were read off the drum. The east half of its roof is
  // gone: the drum, its chain wound and seized, stands open to the court.
  const hz0 = 10, hz1 = 23, hw = 15;
  const hT = 1.5, hTop = H + 10;
  for (const sx of [-1, 1]) {
    k.masonry(sx * (hw / 2 - hT / 2), H, (hz0 + hz1) / 2, hT, hTop - H, hz1 - hz0, { course: 1.5 });
    S.solid(sx * (hw / 2 - hT / 2), (hz0 + hz1) / 2, hT, hz1 - hz0, H - 1, hTop);
    if (fine) for (const z of [13, 17, 21]) k.window(sx * (hw / 2 + 0.01), H + 4.5, z, 0.6, 3.2, { ry: sx * UP, pointed: true, lit: sx > 0 && z === 21 });
    for (const z of [hz0 + 0.5, (hz0 + hz1) / 2, hz1 - 0.5]) k.buttress(sx * hw / 2, H, z, 8, { ry: sx * UP, depth: 1.6 });
  }
  // east front with its door to the court
  const doorW = 3.4;
  for (const sx of [-1, 1]) {
    const w2 = (hw - doorW) / 2;
    k.masonry(sx * (doorW / 2 + w2 / 2), H, hz0 + hT / 2, w2, hTop - H, hT, { course: 1.5 });
    S.solid(sx * (doorW / 2 + w2 / 2), hz0 + hT / 2, w2, hT, H - 1, hTop);
  }
  k.arch(0, H + 4.2, hz0 + hT / 2, doorW, { pointed: true, t: 0.6, depth: hT, spandrel: true, spandrelH: 0.2, c: 'edge', fill: 'stone' });
  k.masonry(0, H + 7.6, hz0 + hT / 2, doorW + 0.4, hTop - H - 7.6, hT, { course: 1.5 });
  S.solid(0, hz0 + hT / 2, doorW, hT, H + 7.4, hTop);
  // gable end over the door and the surviving west half of the roof
  k.wedge(0, hTop, hz0 + hT / 2, hw, 7, hT, 'stone', { ry: 0 });
  k.roof('gable', 0, hTop, hz1 - 3.5, hw - 1, 7, 7, { c: 'roof', overhang: 0.6, ry: 0 });
  // the fallen east half: iron ribs left standing, slates in the hall below
  if (fine) {
    for (const z of [hz0 + 2.2, hz0 + 4.6, hz0 + 7]) {
      for (const sx of [-1, 1]) k.block(sx * 3.6, hTop + 3.4, z, 0.25, 0.25, 8.6, 'iron', { layer: 'metal', rz: sx * 0.75, ry: UP });
    }
    k.rubble(3.5, H, hz0 + 4, 2.5, 7, rng, { c: 'roof', c2: 'stone2' });
  }
  // the dead signal drum on its cradles, the chain wound and seized on it, its free end slack
  const drumZ = (hz0 + hz1) / 2 + 1.2;
  for (const sx of [-1, 1]) {
    k.slab(sx * 4.6, H, drumZ, 1.4, 3.6, 3.0, 'stone2');
    k.slab(sx * 4.6, H + 3.6, drumZ, 1.8, 0.4, 3.4, 'edge');
    S.solid(sx * 4.6, drumZ, 1.4, 3.0, H - 1, H + 4);
  }
  k.prism(0, H + 2.2, drumZ, 2.1, 8.6, 'bronze', { sides: 8, rz: UP, layer: 'metal' });
  for (let i = 0; i < (fine ? 7 : 3); i++) k.prism(-3.3 + i * 1.1, H + 2.2, drumZ, 2.32, 0.5, 'iron', { sides: 8, rz: UP, layer: 'metal' });
  // the brake, seized: a bar through the spokes, pinned with a chain
  k.block(5.6, H + 4.2, drumZ, 0.4, 5.6, 0.4, 'iron', { layer: 'metal', rz: 0.5 });
  if (fine) for (let i = 0; i < 9; i++) k.block(-1.5 + i * 0.4, H + 0.2, drumZ - 2.6 - i * 0.55, 0.3, 0.2, 0.7, 'iron', { layer: 'metal', ry: 0.2 * i });
  S.solid(0, drumZ, 8.6, 4.4, H - 1, H + 4.3);
  // the bell tower, risen out of the west bastion
  const btZ = 27.5, btW = 8;
  const belfry = 50, btTop = 60;
  const bt = keepTower(S, { x: 0, z: btZ, w: btW, base: H, top: btTop, spire: 14, batter: 5, ledge: 8, lit: [{ face: 2, y: 40 }],
    breach: [{ face: 1, y: 30, size: 1.1 }] });
  // the belfry: big pointed openings cut on every face, the bell hanging dead in them
  for (const f of faces(btW, btW)) {
    const [px, pz] = onFace(f, 0, 0.02);
    k.at({ x: px, y: belfry - 6, z: btZ + pz, ry: f.a }, () => {
      k.block(0, 3.2, 0, 3.6, 6.4, 0.2, 'dark', { grad: 0 });
      k.arch(0, 4.6, 0.05, 3.6, { pointed: true, t: 0.5, depth: 0.4, c: 'edge' });
    });
  }
  const bell = new Kit(CASTLE_PALETTE, { detail: low ? 0 : 1 });
  bell.prism(0, -3.4, 0, 2.3, 0.5, 'bronze', { sides: 10, layer: 'metal' });
  bell.prism(0, -2.9, 0, 2.1, 2.6, 'bronze', { sides: 10, top: 0.62, layer: 'metal' });
  bell.prism(0, -0.3, 0, 1.3, 0.6, 'bronze', { sides: 10, top: 0.6, layer: 'metal' });
  bell.slab(0, 0.3, 0, 0.6, 0.9, 0.3, 'iron', { layer: 'metal' });
  // the clapper is chained up against the lip: it was never let swing
  bell.prism(0.9, -3.0, 0, 0.3, 1.6, 'iron', { sides: 6, layer: 'metal', rz: 0.5 });
  bell.block(1.6, -2.0, 0, 0.12, 1.6, 0.12, 'iron', { layer: 'metal', rz: -0.6 });
  const bellG = bell.build('bastion_bell');
  const [bwx, bwz] = S.w(0, btZ);
  const bellPivot = new THREE.Group();
  bellPivot.position.set(bwx, belfry - 1.2, bwz);
  bellPivot.add(bellG);
  bellPivot.userData.dynamic = true;
  world.scene.add(bellPivot);
  anim.push({ kind: 'bell', obj: bellPivot, t: 0 });
  // the receiving mast above the spire: an iron spar and the ring the stations' chain ran to
  const mastY = Math.min(btTop + 2.5 + 14 + 3, S.ceil(0, btZ) - 3);
  k.prism(0, btTop + 8, btZ, 0.22, mastY - btTop - 8 + 1.5, 'iron', { sides: 4, layer: 'metal' });
  k.at({ x: 0, y: mastY - 1.2, z: btZ, ry: -UP }, () => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      k.block(Math.cos(t) * 1.1, Math.sin(t) * 1.1, 0, 0.8, 0.26, 0.26, 'iron', { layer: 'metal', rz: t + UP });
    }
  });
  A.receivers.push({ id: 'bastion_mast', ...S.pt(0, mastY - 1.2, btZ) });

  // ---------------------------------------------------------------- a stair to the ramparts
  {
    // against the inside of the curtain between the south-east and south-west bastions
    const i70 = salients.findIndex((b) => b.deg === 70), i140 = salients.findIndex((b) => b.deg === 140);
    const ends = [trace[i70].pts[0], trace[i70].pts[4], trace[i140].pts[0], trace[i140].pts[4]];
    let a = null, b = null, bd = Infinity;
    for (const p of ends.slice(0, 2)) for (const q of ends.slice(2)) {
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < bd) {
        bd = d;
        a = q;
        b = p;
      }
    }
    const L2 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L2, uz = (b[1] - a[1]) / L2;
    let nx = -uz, nz = ux;
    if (nx * -(a[0] + b[0]) / 2 + nz * -(a[1] + b[1]) / 2 < 0) {
      nx = -nx;
      nz = -nz;
    }
    const n = Math.round((wTop - H) / 0.36), rr = (wTop - H) / n, ru = Math.min(0.62, (L2 - 1.5) / n);
    const off = 2 + 1.35;
    const x0 = a[0] + ux * 0.8 + nx * off, z0 = a[1] + uz * 0.8 + nz * off;
    const sry = Math.atan2(ux, uz);
    k.stair(x0, H, z0, 2.6, n, { rise: rr, run: ru, base: H - 0.5, ry: sry });
    stairColliders(S, x0, z0, ux, uz, 2.6, n, rr, ru, H, H - 0.5, sry);
  }

  // The mesa is the Bastion's own rock: bedded strata round its cliff, stepping and jutting,
  // with ledges, so it reads as a crag and not a drum. The bridge's landing stays clear.
  {
    const rngC = seededRandom(6259);
    const perim = Math.PI * (3 * (ax + az) - Math.sqrt((3 * ax + az) * (ax + 3 * az)));
    const n = Math.round(perim / 3.4);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      // site-local: x spans world z (rx = MESA.rz), z spans world x
      const lx = Math.cos(th) * ax, lz = Math.sin(th) * az;
      if (lz < -az * 0.8 && Math.abs(lx) < 13) continue;
      const nx = Math.cos(th) / ax, nz = Math.sin(th) / az, nl = Math.hypot(nx, nz);
      const ux = nx / nl, uz = nz / nl;
      const ry = Math.atan2(ux, uz);
      // the face shows from the rim down to where the island's underside takes over (riftFloor
      // cuts the ground at -7): clad all of that, from just below the cut
      const foot = Math.max(S.lowest(lx + ux * 2, lz + uz * 2, 4, 4) - 1.5, -10);
      let y = foot;
      let k2 = 0;
      while (y < H - 0.8 && k2 < 10) {
        const h = Math.min(H - 0.3 - y, 2.2 + rngC() * 3.2);
        const out = 0.4 + rngC() * 2.2 * (1 - (y - foot) / (H - foot + 1) * 0.6);
        const w = 3.2 + rngC() * 1.6;
        const c = '#' + bedColor(new THREE.Color(), Math.floor(4 + y / 5 + rngC() * 2)).multiplyScalar(0.7).getHexString();
        k.at({ x: lx + ux * (out / 2 - 1), y, z: lz + uz * (out / 2 - 1), ry: ry + (rngC() - 0.5) * 0.2 }, (b) => b.slab(0, 0, 0, w, h, out + 2, c, { rz: (rngC() - 0.5) * 0.06 }));
        y += h;
        k2++;
      }
      S.solid(lx + ux * 0.4, lz + uz * 0.4, 3.4, 2.8, foot, H - 0.3, { rot: ry });
    }
  }

  const g = S.build();
  // anchors
  const wallRuns = runs.filter(Boolean);
  for (const r of wallRuns.filter((_, i) => i % 5 === 2).slice(0, 4)) {
    const p = S.pt(r.banner.x, r.banner.y, r.banner.z);
    const [nx, nz] = S.dir(r.banner.nx, r.banner.nz);
    A.banners.push({ x: p.x, y: p.y, z: p.z, nx: r2(nx), nz: r2(nz), len: r2(Math.min(14, r.banner.len)), site: 'bastion' });
  }
  for (const t of turrets.slice(1, 4)) if (t.gibbets[0]) A.gibbets.push({ ...t.gibbets[0], site: 'bastion' });
  for (const sx of [-1, 1]) for (const r of heads[sx].rings) A.hawse.push({ id: 'bastion_gate', x: r.x, y: r.y, z: r.z, toward: r.toward });
  const lights = [...bt.lit, S.pt(hw / 2 + 0.8, H + 6, 21)];
  return { group: g, lights };
}

// ---------------------------------------------------------------- the bridge over the Sundering
function buildBridge(world, low, A) {
  const B = BA.bridge;
  const S = new Site(world, (B.ax + B.bx) / 2, B.z, 0, low, 'rift_bridge');
  const k = S.k;
  const rng = seededRandom(6196);
  const fine = !low;
  const x0 = B.ax - S.x, x1 = B.bx - S.x; // local x along the deck, +x west
  const hw = B.width / 2;
  const T = 1.4; // deck thickness
  // find the chasm's lips along the deck line, so the piers stand where the void is
  let lipE = null, lipW = null;
  for (let lx = x0; lx <= x1; lx += 0.5) {
    const h = S.ground(lx, 0);
    if (h < -20 && lipE === null) lipE = lx - 0.5;
    if (h < -20) lipW = lx + 0.5;
  }
  if (lipE === null) {
    lipE = -6;
    lipW = 6;
  }
  // level with each bridgehead, rising across the void between them
  const deckAt = (lx) => {
    const t = Math.min(1, Math.max(0, (lx - (lipE - 1)) / (lipW + 1 - (lipE - 1))));
    return B.deckA + 0.04 + t * (B.deckB - B.deckA);
  };
  const voidMid = (lipE + lipW) / 2;
  const deep = -78;
  // deck, its parapets and spandrel walls, in 1 m pieces so the colliders follow the rise
  const n = Math.ceil(x1 - x0 + 4);
  for (let i = 0; i < n; i++) {
    const a = x0 - 2 + i, b = a + 1;
    const y = deckAt((a + b) / 2);
    S.solid((a + b) / 2, 0, 1.02, B.width + 1.6, y - T, y);
    for (const sz of [-1, 1]) S.solid((a + b) / 2, sz * (hw + 0.45), 1.02, 0.7, y, y + 1.25);
  }
  const deckPiece = (xa, xb) => {
    const ya = deckAt(xa), yb = deckAt(xb);
    const len = xb - xa, slope = Math.atan2(yb - ya, len);
    k.at({ x: (xa + xb) / 2, y: (ya + yb) / 2, z: 0, rz: slope }, () => {
      k.slab(0, -T, 0, len + 0.05, T, B.width + 1.6, 'stone2');
      k.slab(0, -0.06, 0, len + 0.05, 0.08, B.width - 0.2, 'stone');
      for (const sz of [-1, 1]) {
        k.slab(0, 0, sz * (hw + 0.45), len + 0.05, 1.05, 0.7, 'stone');
        k.slab(0, 1.05, sz * (hw + 0.45), len + 0.25, 0.22, 0.9, 'edge');
        if (fine) for (let i = 0; i < Math.round(len / 1.6); i++) k.ramp(-len / 2 + 0.8 + i * 1.6, -T - 1.2, sz * (hw + 0.6), 0.5, 1.2, 0.8, 'edge', { rz: Math.PI, ry: sz > 0 ? Math.PI : 0 });
      }
    });
  };
  deckPiece(x0 - 2, lipE - 1);
  deckPiece(lipE - 1, lipW + 1);
  deckPiece(lipW + 1, x1 + 2);
  // the piers: one on each lip, one standing alone in the void, all plunging out of sight
  const piers = [
    { x: lipE - 0.6, w: 4.2, top: deckAt(lipE) - T },
    { x: voidMid, w: 4.0, top: deckAt(voidMid) - T },
    { x: lipW + 0.6, w: 4.2, top: deckAt(lipW) - T },
  ];
  for (const p of piers) {
    const d = B.width + 3;
    // battered toward the deep: wider the further down
    k.prism(p.x, deep, 0, (p.w * 1.7) / 2 * SQ2, p.top - 18 - deep, 'stone2', { sides: 4, top: 1 / 1.7, dr: (d * 1.4) / 2 * SQ2 });
    k.masonry(p.x, p.top - 18, 0, p.w, 18, d, { course: 1.8 });
    // cutwater prows up and down the chasm, as if the void still ran like a river
    for (const sz of [-1, 1]) k.prism(p.x, p.top - 30, sz * (d / 2 + 0.4), p.w / 2 * SQ2 * 0.75, 30, 'stone2', { sides: 4, top: 0.6, ry: Math.PI / 4 });
    S.solid(p.x, 0, p.w, d, p.top - 40, p.top);
  }
  // arches between the piers, three tiers down into the void
  for (const tier of [0, 1, 2]) {
    const springY = piers[0].top - 9 - tier * 22;
    for (let i = 0; i < 2; i++) {
      const a = piers[i], b = piers[i + 1];
      const span = b.x - b.w / 2 - (a.x + a.w / 2);
      if (span < 1.5) continue;
      const cx = (a.x + a.w / 2 + b.x - b.w / 2) / 2;
      k.arch(cx, springY, 0, span, { pointed: true, t: 1.0, depth: B.width + 1.2, spandrel: tier === 0, spandrelH: piers[0].top - springY - span * 0.74 - 1, c: 'edge', fill: 'stone' });
      if (tier > 0) k.slab(cx, springY + span * 0.74 + 1.0, 0, span + 1, 1.2, B.width + 1.2, 'stone2');
    }
  }
  // approach spans over the ground on either side of the void
  for (const [ga, gb] of [[x0 - 1, lipE - 2.7], [lipW + 2.7, x1 + 1]]) {
    const span = gb - ga;
    if (span < 2) continue;
    const cx = (ga + gb) / 2;
    const gy = Math.min(S.ground(ga + 0.5, 0), S.ground(gb - 0.5, 0), S.ground(cx, 0));
    const top = deckAt(cx) - T;
    if (top - gy < 0.5) continue;
    k.slab(cx, gy - 2, 0, span, top - gy + 2, B.width + 1.2, 'stone2');
    if (top - gy > 5) k.at({}, () => {
      k.block(cx, (gy + top) / 2 - 1, B.width / 2 + 0.62, span * 0.6, (top - gy) * 0.55, 0.06, 'dark', { grad: 0 });
      k.block(cx, (gy + top) / 2 - 1, -B.width / 2 - 0.62, span * 0.6, (top - gy) * 0.55, 0.06, 'dark', { grad: 0 });
    });
    S.solid(cx, 0, span, B.width + 1.2, gy - 2, top);
  }
  // the east bridgehead: a gate tower over the deck's landward end
  const head = { x: x0 - 3.5, w: 8, d: B.width + 10 };
  const gB = deckAt(x0);
  const legD = (head.d - (B.width + 1.6)) / 2;
  const legs = [];
  for (const sz of [-1, 1]) {
    legs.push(keepTower(S, { x: head.x, z: sz * (B.width / 2 + 0.8 + legD / 2), w: head.w, d: legD, base: gB, top: 42, spire: 12, batter: 3, ledge: 8, flare: 1.08,
      hawse: sz > 0 ? [{ y: 34, toward: 'chainward' }] : [] }));
  }
  const vaultY = gB + 9;
  k.at({ x: head.x, z: 0, ry: UP }, () => {
    gateArch(k, -head.w / 2 + 0.8, gB + 4.2, B.width + 1.6, 1.6, vaultY);
    gateArch(k, head.w / 2 - 0.8, gB + 4.2, B.width + 1.6, 1.6, vaultY);
    k.masonry(0, vaultY, 0, B.width + 1.8, 31 - vaultY, head.w, { course: 1.8 });
  });
  S.solid(head.x, 0, head.w, B.width + 1.6, vaultY, 31);
  k.slab(head.x, 31, 0, head.w + 0.6, 0.4, head.d, 'edge');
  if (fine) k.crenels(head.x - head.w / 2, -head.d / 2 + 0.6, head.x - head.w / 2, head.d / 2 - 0.6, 31.4, 0.7, { c: 'stone' });
  const g = S.build();
  // gibbets over the void from the parapets, chain points on the head
  for (const sz of [-1, 1]) A.gibbets.push({ ...S.pt(voidMid + sz * 3, deckAt(voidMid) + 1.6, sz * (hw + 1.6)), site: 'bridge' });
  for (const t of legs) for (const r of t.rings) A.hawse.push({ id: 'bridge_head', x: r.x, y: r.y, z: r.z, toward: r.toward });
  return { group: g, lips: [lipE + S.x, lipW + S.x] };
}

// ================================================================== the Garrison Steps
// Garrison-local frame, yaw 0 at (5800, 6116): local offsets are world offsets.
const GA = RIFT_CASTLES.garrison;
const G1 = RIFT_PADS.garrison_1, G2 = RIFT_PADS.garrison_2, G3 = RIFT_PADS.garrison_3;

// A barrack: two storeys of coursed stone under a steep slate roof, slits for windows, an
// arcade along the yard side. `face` is the yard side (+1 = local +z, -1 = -z).
function barrack(S, x, z, w, d, base, face, o = {}) {
  const k = S.k;
  const fine = k.detail >= 1;
  const H = o.h ?? 7.4;
  const lowG = Math.min(base, S.lowest(x, z, w + 1, d + 1)) - 1;
  k.slab(x, lowG, z, w + 0.6, base - lowG + 0.3, d + 0.6, 'stone2');
  k.masonry(x, base + 0.3, z, w, H, d, { course: 1.2 });
  k.slab(x, base + 0.3 + H - 0.3, z, w + 0.4, 0.35, d + 0.4, 'edge');
  k.roof('gable', x, base + 0.3 + H, z, d, w, Math.min(9, d * 0.85), { c: 'roof', ridge: 'iron', overhang: 0.5, ry: UP });
  S.solid(x, z, w, d, lowG, base + 0.3 + H);
  if (fine) {
    for (let i = 0; i < Math.floor(w / 3.2); i++) {
      const xx = x - w / 2 + 1.6 + i * 3.2;
      for (const sz of [-1, 1]) {
        k.window(xx, base + 1.6, z + sz * (d / 2 + 0.01), 0.45, 2.0, { ry: sz > 0 ? 0 : Math.PI, pointed: true });
        k.window(xx, base + 5.0, z + sz * (d / 2 + 0.01), 0.45, 1.6, { ry: sz > 0 ? 0 : Math.PI, pointed: true, lit: o.lit === i && sz === face });
      }
    }
    // chimneys of the knights' hearths, long cold
    for (const cx of [x - w / 3, x + w / 3]) k.slab(cx, base + H, z - face * d * 0.18, 1.0, 5.2, 1.0, 'stone2');
  }
  // the arcade: piers and arches carrying a lean-to over a walk on the yard side
  const ad = o.arcade ?? 3.2;
  if (ad > 0) {
    const az = z + face * (d / 2 + ad / 2);
    const n = Math.max(2, Math.round(w / 4));
    const pierH = 3.6;
    k.arcade(x - w / 2, z + face * (d / 2 + ad - 0.5), x + w / 2, z + face * (d / 2 + ad - 0.5), base + 0.3, n, pierH, { pier: 0.9, depth: 0.9, spandrelH: 0.4, c: 'stone', archC: 'edge' });
    const pw = 0.9, span = (w - pw * (n + 1)) / n;
    for (let i = 0; i <= n; i++) S.solid(x - w / 2 + pw / 2 + i * (span + pw), z + face * (d / 2 + ad - 0.5), pw, pw, base, base + 0.3 + pierH + 1.2);
    const roofY = base + 0.3 + pierH + span * 0.5 + 0.7;
    k.slab(x, roofY, az, w, 0.4, ad + 0.4, 'edge');
    k.ramp(x, roofY + 0.4, az, w, 1.2, ad + 0.4, 'roof', { ry: face > 0 ? 0 : Math.PI });
    S.solid(x, az, w, ad, roofY, roofY + 0.5);
  }
}

function buildGarrison(world, low, A) {
  const S = new Site(world, GA.x, GA.z, 0, low, 'rift_garrison');
  const k = S.k;
  const rng = seededRandom(5800);
  const fine = !low;
  const loc = (p) => ({ x0: p.x - p.w / 2 - S.x, x1: p.x + p.w / 2 - S.x, z0: p.z - p.d / 2 - S.z, z1: p.z + p.d / 2 - S.z, h: p.h });
  const t1 = loc(G1), t2 = loc(G2), t3 = loc(G3);
  const pTop = 1.2;
  // revetments: the terraces' sheer edges faced in masonry, with a parapet along the top
  const revet = (ax, az, bx, bz, top, out, o = {}) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ry = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const nx = Math.cos(ry) * out, nz = -Math.sin(ry) * out;
    const cx = mx + nx * 0.8, cz = mz + nz * 0.8;
    const foot = S.lowest(cx + nx * 0.8, cz + nz * 0.8, 3, len, ry) - 1.5;
    k.at({ x: cx, z: cz, ry }, () => {
      k.slab(0, foot, 0, 1.6, top - foot, len, 'stone2');
      k.ramp(out * 1.3, foot, 0, len, Math.min(6, top - foot) * 0.9, 1.0, 'stone2', { ry: out * UP });
      k.slab(out * 0.1, top - 0.3, 0, 1.9, 0.35, len + 0.1, 'edge');
      if (o.parapet !== false) {
        k.slab(out * 0.35, top, 0, 0.8, pTop, len, 'stone');
        k.slab(out * 0.35, top + pTop, 0, 1.0, 0.18, len + 0.1, 'edge');
      }
    });
    S.solid(cx, cz, 1.6, len, foot, top, { rot: ry });
    if (o.parapet !== false) S.solid(cx + nx * 0.35, cz + nz * 0.35, 0.8, len, top, top + pTop, { rot: ry });
  };
  // T1: west face toward the basin, north face, and the south face either side of the way
  revet(t1.x1, t1.z0, t1.x1, t1.z1, t1.h, 1);
  revet(t1.x0, t1.z1, t1.x1, t1.z1, t1.h, -1);
  revet(t1.x0 - 3, t1.z0, 39, t1.z0, t1.h, 1);
  revet(51, t1.z0, t1.x1, t1.z0, t1.h, 1);
  // The risers between the terraces: faced in masonry on the lower side (filling any gap the
  // ground leaves between the pads), with a parapet along the top except at the stair heads.
  const riser = (xUpper, xLower, top, low_, z0, z1) => {
    // the ground's mesh smears a sheer riser over a cell; the masonry takes that whole band
    const xa = Math.min(xUpper, xLower) - 3.4, xb = Math.max(xUpper, xLower) + 1.0;
    const cx = (xa + xb) / 2;
    const foot = Math.min(low_ - 1, S.lowest(cx, (z0 + z1) / 2, xb - xa, z1 - z0) - 1.5);
    k.masonry(cx, foot, (z0 + z1) / 2, xb - xa, top - foot, z1 - z0, { course: 1.5 });
    if (fine) for (let z = z0 + 4; z < z1 - 3; z += 8) k.buttress(xb, low_, z, top - low_ - 0.6, { ry: UP, depth: 1.2, w: 1.0 });
    S.solid(cx, (z0 + z1) / 2, xb - xa, z1 - z0, foot, top);
    return xb;
  };
  const r12 = riser(t2.x1, t1.x0, t2.h, t1.h, t1.z0, t1.z1);
  const r23 = riser(t3.x1, t2.x0, t3.h, t2.h, t2.z0, t2.z1);
  const stairZ1 = -12, stairZ2 = 14, sw = 5;
  const parapetAlong = (x, z0, z1, top, gap) => {
    for (const [a, b] of [[z0, gap - sw / 2 - 0.4], [gap + sw / 2 + 0.4, z1]]) {
      if (b - a < 0.5) continue;
      k.slab(x, top, (a + b) / 2, 0.8, pTop, b - a, 'stone');
      k.slab(x, top + pTop, (a + b) / 2, 1.0, 0.18, b - a + 0.1, 'edge');
      S.solid(x, (a + b) / 2, 0.8, b - a, top, top + pTop);
    }
  };
  parapetAlong(r12 - 0.45, t1.z0, t1.z1, t2.h, stairZ1);
  parapetAlong(r23 - 0.45, t2.z0, t2.z1, t3.h, stairZ2);
  // T2 and T3 side faces and T3's east face over the void
  revet(t2.x0, t2.z1, r12, t2.z1, t2.h, -1);
  revet(t2.x0, t2.z0, r12, t2.z0, t2.h, 1);
  revet(t3.x0, t3.z1, r23, t3.z1, t3.h, -1);
  revet(t3.x0, t3.z0, r23, t3.z0, t3.h, 1);
  revet(t3.x0, t3.z0, t3.x0, t3.z1, t3.h, -1);
  // the stairs between the terraces, climbing east
  const rise = 5 / 16, run = 0.68;
  for (const [xTop, z, y] of [[r12, stairZ1, t1.h], [r23, stairZ2, t2.h]]) {
    const xb = xTop + 16 * run;
    k.stair(xb, y, z, sw, 16, { rise, run, base: y - 0.5, ry: -UP });
    stairColliders(S, xb, z, -1, 0, sw, 16, rise, run, y, y - 0.5, UP);
    // a gate arch at the head of each stair
    for (const sz of [-1, 1]) {
      k.pier(xTop - 0.6, y + 5, z + sz * (sw / 2 + 0.6), 1.2, 5.6, {});
      S.solid(xTop - 0.6, z + sz * (sw / 2 + 0.6), 1.2, 1.2, y + 4, y + 10.6);
    }
    k.at({ x: xTop - 0.6, z, ry: UP }, () => k.arch(0, y + 10.6, 0, sw, { pointed: true, t: 0.7, depth: 1.2, spandrel: true, spandrelH: 0.4, c: 'edge', fill: 'stone' }));
  }
  // barracks
  barrack(S, 38.5, 24.8, 23, 10, t1.h, -1, { lit: 4 });
  barrack(S, 29, -25, 8, 10, t1.h, 1, { arcade: 0, h: 9 });
  barrack(S, 6, 26.5, 26, 9, t2.h, -1);
  barrack(S, 6, -26.5, 26, 9, t2.h, 1, { lit: 1 });
  barrack(S, -22, 24, 16, 13, t3.h, -1, { h: 10, arcade: 3.4, lit: 2 });
  barrack(S, -27, -27.5, 20, 7, t3.h, 1, { h: 7 });
  // the watch tower on the top terrace, a light still kept in it
  const watch = keepTower(S, { x: -44, z: -24, w: 8, base: t3.h, top: 62, spire: 15, batter: 4, ledge: 8,
    lit: [{ face: 3, y: 56 }, { face: 2, y: 56 }], banners: [{ face: 1, y: 52, len: 14, w: 2.0 }] });
  // a corner tower where the lowest terrace meets the basin
  keepTower(S, { x: t1.x1 + 1.5, z: t1.z1 - 1, w: 6.2, base: t1.h, top: 30, spire: 9, batter: 3, ledge: 7, bartizans: false });
  // the gate: where the Garrison road comes up to the lowest terrace, a gatehouse stands in the
  // gap of the south revetment, its towers built into the revetment's ends
  const GG = new WallFrame(world, GA.x, GA.z, CASTLE_PALETTE, { tag: TAG, name: 'rift_garrison_gate', low });
  gatehouse(GG, 45, t1.z0 + 1.2, 0, { width: 6.6, depth: 8, towers: 5.5, top: t1.h + 7.5, towerTop: t1.h + 11.5, floorOut: t1.h, floorIn: t1.h });
  const gate = GG.build();
  for (const e of GG.ex) S.ex.push(e);
  const g = S.build();
  A.gibbets.push({ ...S.pt(t3.x0 - 1.4, t3.h + 0.9, 10), site: 'garrison' });
  A.gibbets.push({ ...S.pt(t1.x1 + 1.4, t1.h + 0.9, 0), site: 'garrison' });
  A.banners.push({ ...S.pt(t1.x1 + 1.65, t1.h - 0.6, -10), nx: 1, nz: 0, len: bannerDrop(S, t1.x1 + 1.65, -10, 1, 0, t1.h - 0.6), site: 'garrison' });
  A.banners.push({ ...S.pt(r12 + 0.05, t2.h - 0.6, 10), nx: 1, nz: 0, len: bannerDrop(S, r12 + 0.05, 10, 1, 0, t2.h - 0.6), site: 'garrison' });
  void rng;
  return { group: g, lights: watch.lit, extra: [gate] };
}

// ================================================================== the relay towers
function buildRelay(world, low, r, A, anim) {
  const S = new Site(world, r.x, r.z, 0, low, 'rift_relay_' + r.id);
  const k = S.k;
  const g0 = S.ground(0, 0);
  const toward = Math.atan2(CW.x - r.x, CW.z + 30 - r.z); // the face that looks to the Chainward
  const shape = {
    relay_north: {},
    relay_northeast: { lean: [-1.6, 1.4] },
    relay_west: { twist: 0.35 },
    relay_south: { lean: [1.2, -2.0], breach: [{ face: 1, y: g0 + 18 }] },
  }[r.id] || {};
  const w = 5.4;
  const ringY = g0 + r.ringH;
  const top = ringY + 2.2;
  const t = keepTower(S, { x: 0, z: 0, w, base: g0, top, end: 'flat', batter: 3.5, flare: 1.25, ledge: 7, ry: toward, bartizans: false,
    hawse: [{ face: 0, y: ringY, r: 1.0 }], ...shape, warpFrom: g0 + 4, warpTo: top + 6 });
  // the beacon cradle: iron posts and hoops round a brazier that has not burned for a century
  const cr = t.warp;
  const cradle = () => {
    k.at({ ry: toward }, () => {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.prism(sx * 1.5, top + 1.3, sz * 1.5, 0.14, 4.2, 'iron', { sides: 4, layer: 'metal', rz: sx * 0.14, rx: -sz * 0.14 });
      for (const [y, rad] of [[top + 2.6, 1.8], [top + 5.2, 2.15]]) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          k.block(Math.cos(a) * rad, y, Math.sin(a) * rad, 0.2, 0.2, rad * 0.8, 'iron', { layer: 'metal', ry: -a });
        }
      }
      k.prism(0, top + 1.3, 0, 1.3, 0.9, 'iron', { sides: 8, top: 1.3, layer: 'metal' });
    });
  };
  if (cr) k.warp(cr, cradle);
  else cradle();
  // the keeper's door at the foot, in a porch on the face toward the keep
  k.at({ ry: toward }, () => {
    const pz = w * 0.66 + 0.7;
    k.masonry(0, S.ground(0, 0) - 0.6, pz, 3.0, 4.2, 1.6, { course: 0.9 });
    k.slab(0, g0 + 3.6, pz, 3.4, 0.3, 1.9, 'edge');
    k.slab(0, g0, pz + 0.81, 1.3, 2.5, 0.06, 'dark', { grad: 0 });
    k.slab(0, g0 + 2.5, pz + 0.84, 1.7, 0.3, 0.12, 'edge');
    k.slab(0, g0 - 0.1, pz + 1.3, 2.2, 0.2, 1.0, 'stone2');
  });
  {
    const pz = w * 0.66 + 0.7;
    S.solid(Math.sin(toward) * pz, Math.cos(toward) * pz, 3.0, 1.6, g0 - 1, g0 + 3.6, { rot: toward });
  }
  // the faint ember in the cradle: a separate, breathing glow
  const ember = new Kit(CASTLE_PALETTE, { detail: 1 });
  ember.prism(0, 0, 0, 0.9, 0.5, 'ember', { sides: 6, layer: 'glow', strength: 0.55 });
  const eg = ember.build('relay_ember');
  const ep = S.pt(0, top + 2.2, 0, cr);
  eg.position.set(ep.x, ep.y, ep.z);
  eg.userData.dynamic = true;
  world.scene.add(eg);
  anim.push({ kind: 'ember', obj: eg, t: hash3(r.x, r.z, 1) * 10 });
  const grp = S.build();
  const ring = t.rings[0];
  A.relays.push({ id: r.id, x: ring.x, y: ring.y, z: ring.z, ground: r2(g0) });
  return { group: grp, light: { x: ep.x, y: ep.y + 0.6, z: ep.z } };
}

// ================================================================== the upended towers
// Keep towers that fell the wrong way up: driven spire-first into the floor, the needle's
// last metres buried, the footing in the air with the ground it was torn from still on it,
// roots trailing. Built upright, then turned over; the impact threw up a mound of earth and
// broken courses on one side, and that is the way up to the hanging gallery.
function buildUpended(world, low, u, rng) {
  const S = new Site(world, u.x, u.z, u.yaw, low, 'rift_upended_' + u.id);
  const k = S.k;
  const fine = !low;
  const g0 = S.ground(0, 0);
  const w = 8;
  const foot = 4, body = 23, gal = 1.7, spire = 13;
  const total = foot + body + gal + spire;
  const bury = 2.6;
  const Htop = g0 + total - bury; // where the footing now is: in the air
  const lean = u.id === 'upended_a' ? [4.2, 1.6] : [-2.4, 3.8];
  const warp = { lean, twist: 0.1, from: g0, to: Htop, center: [0, 0], ease: 1.15 };
  const inv = (y) => Htop - y; // upright local y -> world y
  const ledgeYs = [];
  k.warp(warp, () => {
    k.inverted(0, Htop, 0, () => {
      // upright, local y from 0 (footing) to `total` (spire tip)
      k.slab(0, 0, 0, w * 1.28, 1.4, w * 1.28, 'stone2');
      k.prism(0, 1.4, 0, (w * 1.28) / 2 * SQ2, foot - 1.4, 'stone2', { sides: 4, top: 1 / 1.28 });
      k.masonry(0, foot, 0, w, body, w, { course: 1.8 });
      for (let y = foot + 6.5; y < foot + body - 2; y += 6.5) {
        k.slab(0, y, 0, w + 1.3, 0.45, w + 1.3, 'edge');
        ledgeYs.push(y);
      }
      if (fine) {
        for (const f of faces(w, w)) {
          for (let y = foot + 4; y < foot + body - 3; y += 6.5) {
            const [px, pz] = onFace(f, 0, 0.01);
            k.window(px, y, pz, 0.45, 2.4, { ry: f.a, pointed: true });
          }
        }
        // corners crumbled away where it struck
        for (let i = 0; i < 7; i++) {
          const sx = rng() < 0.5 ? -1 : 1, sz = rng() < 0.5 ? -1 : 1;
          k.slab(sx * (w / 2 - 0.5), foot + body - 2 - rng() * 8, sz * (w / 2 - 0.5), 1.3, 1.2 + rng() * 2, 1.3, 'scar');
        }
      }
      const gy = foot + body;
      galleryTop(k, w, w, gy + 0.5, rng, { end: 'flat', bartizans: true }, fine);
      // the needle it fell on
      k.slab(0, gy + 0.5, 0, w - 0.4, gal, w - 0.4, 'stone2');
      k.pyramid(0, gy + gal, 0, (w - 0.4) / 2 * SQ2, spire, 'roof', { sides: 4 });
    });
    // the torn-up ground on what is now its top: the underside of the earth it stood in,
    // rocks and roots, hanging off the footing's edge
    for (let i = 0; i < (fine ? 11 : 5); i++) {
      const a = (i / 11) * Math.PI * 2 + rng() * 0.3;
      const rr = 3.5 + rng() * 2.5;
      k.rock(Math.cos(a) * rr, Htop + 0.6 + rng() * 1.5, Math.sin(a) * rr, 3.4 + rng() * 2, 2.4 + rng() * 2, 3.2 + rng() * 2, i % 3 ? 'earth' : 'stone2', { ry: a });
    }
    k.rock(0, Htop + 1.6, 0, 8.5, 3.6, 8.5, 'earth');
    if (fine) {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + rng() * 0.2;
        const rr = 4.6 + rng() * 2;
        const len = 3 + rng() * 9;
        k.prism(Math.cos(a) * rr, Htop + 0.6 - len, Math.sin(a) * rr, 0.07 + rng() * 0.1, len, 'root', { sides: 4, rz: (rng() - 0.5) * 0.4, rx: (rng() - 0.5) * 0.4 });
      }
    }
  });
  // the impact: a ring of heaved slabs round the buried tip, and the mound thrown up on one
  // side, stepped high enough to reach the gallery's hanging parapet
  for (let i = 0; i < (fine ? 9 : 4); i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
    const r = 2.6 + rng() * 1.4;
    k.slab(Math.cos(a) * r, g0 - 0.8, Math.sin(a) * r, 2.2 + rng(), 1.6 + rng() * 1.2, 1.2, 'stone2', { ry: -a, rx: 0.5 + rng() * 0.3 });
  }
  const galY = inv(foot + body + 0.5); // the gallery floor, hanging
  const ld = [-lean[0], -lean[1]];
  const lm = Math.hypot(...ld);
  const mx = ld[0] / lm, mz = ld[1] / lm;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const top = g0 + ((galY - 2.2 - g0) * (i + 1)) / steps;
    const d = 12.5 - i * 1.25;
    const sx = mx * d + mz * (i % 2 ? 1.5 : -1.5), sz = mz * d - mx * (i % 2 ? 1.5 : -1.5);
    const bw = 3.6 - i * 0.15;
    // a heap of earth and broken courses, a fallen block of the tower on top of it
    k.rock(sx, (g0 - 1 + top) / 2 - 0.3, sz, bw * 1.5, top - g0 + 1.2, bw * 1.5, i % 2 ? 'earth' : 'stone2', { ry: i * 1.3 });
    k.slab(sx, top - 0.7, sz, bw * 0.8, 0.9, bw * 0.7, i % 3 ? 'stone' : 'scar', { ry: i * 0.4 + 0.3, rz: (rng() - 0.5) * 0.12 });
    S.solid(sx, sz, bw, bw, g0 - 1, top, { rot: i * 0.4 });
  }
  k.rubble(0, g0, 0, 10, fine ? 16 : 6, rng);
  const grp = S.build();
  // colliders: the needle (narrow, stepped), the shaft in leaning sections, the hanging
  // gallery and its parapet, the ledges, the top
  const at = (y) => {
    const t = warpT(warp, y);
    return { x: lean[0] * t, z: lean[1] * t, r: warp.twist * t };
  };
  const spireTop = inv(foot + body + 0.5 + gal);
  for (let i = 0; i < 3; i++) {
    const a = g0 - 1 + ((spireTop - g0 + 1) * i) / 3, b = g0 - 1 + ((spireTop - g0 + 1) * (i + 1)) / 3;
    const p = at((a + b) / 2);
    const wd = ((w - 0.4) * ((b + 0.2 - (g0 - bury)) / spire)) * 0.75;
    S.solid(p.x, p.z, Math.max(1, wd), Math.max(1, wd), a, b, { rot: p.r });
  }
  for (let i = 0; i < 5; i++) {
    const a = galY + ((Htop - galY) * i) / 5, b = galY + ((Htop - galY) * (i + 1)) / 5;
    const p = at((a + b) / 2);
    const wide = b > inv(foot) ? w * 1.18 : w;
    S.solid(p.x, p.z, wide, wide, a - (i === 0 ? 0.6 : 0), b, { rot: p.r });
  }
  {
    const p = at(galY);
    S.solid(p.x, p.z, w + 2.6, w + 2.6, galY - 0.5, galY, { rot: p.r });
    for (const f of faces(w + 2.6, w + 2.6)) {
      const [px, pz] = rot(...onFace(f, 0, -0.35), p.r);
      S.solid(p.x + px, p.z + pz, f.nx ? 0.7 : f.span, f.nx ? f.span : 0.7, galY - 1.8, galY - 0.5, { rot: p.r });
    }
  }
  for (const y of ledgeYs) {
    const yy = inv(y);
    const p = at(yy);
    S.solid(p.x, p.z, w + 1.3, w + 1.3, yy - 0.45, yy, { rot: p.r });
  }
  {
    const p = at(Htop);
    S.solid(p.x, p.z, w * 1.3, w * 1.3, Htop - 1, Htop + 2.4, { rot: p.r });
  }
  S.exclude(0, 0, 13);
  S.exclude(mx * 9, mz * 9, 7);
  return grp;
}

// Is a chain from a to b (sagging up to 8% of its length at mid-span) clear of colliders,
// leaving a couple of metres at each end where it meets its ring?
export function chainClear(world, a, b, sags = [0, 0.04, 0.08]) {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.ceil(len / 1.5);
  for (const sag of sags) {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (t * len < 2.5 || (1 - t) * len < 2.5) continue;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const y = a.y + (b.y - a.y) * t - 4 * sag * len * t * (1 - t);
      if (world.colliders.pointInside(x, y, z)) return false;
      if (y < world.terrain.heightAt(x, z) + 1) return false;
    }
  }
  return true;
}

// ================================================================== build
export function buildRiftCastles(world, exclusions, state) {
  const low = !!state.low;
  const A = { relays: [], chains: [], banners: [], gibbets: [], hawse: [], receivers: [] };
  SITES.length = 0;
  const anim = [];
  const roots = [];
  const lights = [];
  state.castles = { anchors: A, anim };

  const cw = buildChainward(world, low, A);
  roots.push(cw.group, ...(cw.extra || []));
  lights.push(...cw.lights);
  const ba = buildBastion(world, low, A, anim);
  roots.push(ba.group);
  lights.push(...ba.lights);
  const br = buildBridge(world, low, A);
  roots.push(br.group);
  const ga = buildGarrison(world, low, A);
  roots.push(ga.group, ...ga.extra);
  lights.push(...ga.lights);
  for (const r of RIFT_CASTLES.relays) {
    const re = buildRelay(world, low, r, A, anim);
    roots.push(re.group);
    world.addLight(new THREE.Vector3(re.light.x, re.light.y, re.light.z), '#ff9a5a', 0.9, 14, true, 0.5);
  }
  const urng = seededRandom(5880);
  for (const u of RIFT_CASTLES.upended) roots.push(buildUpended(world, low, u, urng));

  // the watch-lights: few, warm, high up
  for (const p of lights.slice(0, 8)) world.addLight(new THREE.Vector3(p.x, p.y, p.z), '#ffc27a', 1.6, 22, true, 0.8);

  // footprints for vegetation, rock and the omens' scatter
  exclusions.push({ x: CW.x, z: CW.z, r: 78 }, { x: FORE.x, z: FORE.z, r: 24 });
  exclusions.push({ x: BA.x, z: BA.z, r: 50 });
  const B = BA.bridge;
  for (let x = B.ax - 8; x <= B.bx; x += 8) exclusions.push({ x, z: B.z, r: 9 });
  exclusions.push({ x: GA.x, z: GA.z, r: 40 }, { x: G1.x + 4, z: G1.z, r: 34 });
  for (const r of RIFT_CASTLES.relays) exclusions.push({ x: r.x, z: r.z, r: 7 });
  for (const site of SITES) exclusions.push(...site.ex);
  SITES.length = 0;
  for (const u of RIFT_CASTLES.upended) exclusions.push({ x: u.x, z: u.z, r: 13 });

  // Chains are hung from the Chainward's rings to the relays' rings. Keep only the rings whose
  // run is clear of the castles' own masonry, straight or sagging.
  A.chains = A.chains.filter((c) => {
    const r = A.relays.find((q) => q.id === c.toward);
    return !r || chainClear(world, c, r);
  });

  // Banners and gibbets only where the cloth or the cage hangs free.
  const freeColumn = (x, z, y0, y1) => {
    for (let y = y0; y < y1; y += 0.5) if (world.colliders.pointInside(x, y, z)) return false;
    return y0 > world.terrain.heightAt(x, z);
  };
  A.banners = A.banners.filter((b) => b.len > 3 && freeColumn(b.x + b.nx * 0.5, b.z + b.nz * 0.5, b.y - b.len, b.y - 0.3));
  A.gibbets = A.gibbets.filter((g) => freeColumn(g.x, g.z, g.y - 6.5, g.y - 0.3));

  mergeStatic(world.scene, roots);
  state.castles.chasmLips = br.lips;
}

export function updateRiftCastles(state, dt) {
  const c = state.castles;
  if (!c || !c.anim) return;
  for (const a of c.anim) {
    a.t += dt;
    if (a.kind === 'bell') {
      // a draft through the belfry moves the dead bell a hair; it never swings far enough to ring
      a.obj.rotation.z = Math.sin(a.t * 0.35) * 0.035 + Math.sin(a.t * 0.13) * 0.02;
      a.obj.rotation.x = Math.sin(a.t * 0.27 + 1) * 0.02;
    } else if (a.kind === 'ember') {
      const s = 0.82 + Math.sin(a.t * 0.9) * 0.1 + Math.sin(a.t * 2.3) * 0.05;
      a.obj.scale.set(1, s, 1);
    }
  }
}
