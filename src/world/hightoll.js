// Hightoll: the castle at the north end of the Hundred Arches (data/hightoll.js).
//
// The Compact's post where the viaduct came ashore on the high country, crowned by the Anchors
// with a keep, a curtain and a toll tower whose bell rang every cart through. Its rock was left
// standing when the low country sank; the spans south of it fell and its Bridge Gate now opens
// on a sixty-metre drop, the Arches marching away from it into the mere. Hightoll Road climbs
// the tail behind it to the Land Gate; the North Court lies inside, then the Toll Gate, then
// the Bridge Court, where the castellan still waits facing the gate the relief never came
// through.
//
// Built in the castle's own frame (local x across the Arches' line, +x toward the Wash; local
// z up the line, +z north; y is world height) through one siteFrame, so colliders cannot drift
// from the meshes. Raised twice from the same recipe, full kit near and detail-0 far, like the
// Arches. The bell hangs in its own part so it can swing when it tolls.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';
import { seededRandom } from '../core/util.js';
import { addShelter } from './mason.js';
import { LORE, LORE_BY_ID } from '../data/lore.js';
import { VISTA_SHOTS } from '../data/vistas.js';
import { act } from '../game/hooks.js';
import { HIGHTOLL, HIGHTOLL_ORIGIN, HIGHTOLL_LAND_GATE, HIGHTOLL_LORE, HIGHTOLL_REGISTER, HIGHTOLL_SHOTS, CARRIER_LINE_NOTICE, HIGHTOLL_CRAGS, ROCK_JOINTS, ROCK_OUTLINE, HIGHTOLL_MEADOW } from '../data/hightoll.js';
import { mergeStatic } from './merge.js';

// The notice and the daybook are written sources on carriers landmarks.js builds; the cameras
// are the feature's own. Both register with it, like the Arches'.
for (const l of [...HIGHTOLL_LORE, CARRIER_LINE_NOTICE]) {
  if (LORE_BY_ID[l.id]) continue;
  LORE.push(l);
  LORE_BY_ID[l.id] = l;
}
Object.assign(VISTA_SHOTS, HIGHTOLL_SHOTS);

const noop = () => {};
const TAU = Math.PI * 2;
const UP = Math.PI / 2;
const TOP = HIGHTOLL.top;
// the middle of the rock: walls face away from it
const MID = [12, 0];

// The Arches' pale Compact limestone, a shade warmer where the Anchors dressed it; slate roofs,
// verdigris on the dome and the finials, the toll bell's bronze, faded crown cloth.
const P = {
  ...PALETTES.ancient,
  stone: '#c6c0aa', stone2: '#a9a38d', edge: '#dbd5bf', dark: '#33352f', joint: '#857f6c',
  roof: '#48535e', roof2: '#3c4651', ridge: '#2c343c', moss: '#5d7a3a', moss2: '#4a6532',
  metal: '#5f8a7a', copper: '#6f9c88', bronze: '#8c7340', iron: '#2b2a29', glow: '#ffcd86',
  cloth: '#7b2f2b', cloth2: '#8c6a34', wood: '#4d3b2b', wood2: '#5e4834', bark: '#4a3c2e',
  leaf: '#5d7f38', leaf2: '#6f8a3c', gold: '#d6a23a', gold2: '#c4822c', ember: '#ff9a4a', ash: '#4a4440',
};

// ---------------------------------------------------------------- plan
// Towers of the curtain, walked round from the Bridge Gate's west tower.
export const TOWERS = {
  bridge_w: { x: 8.5, z: -42, w: 10, d: 12, h: 30, kind: 'gate' },
  bridge_e: { x: -8.5, z: -42, w: 10, d: 12, h: 30, kind: 'gate' },
  sw: { x: 42, z: -36, r: 7, h: 30, kind: 'round' },
  nw: { x: 44, z: 38, r: 7, h: 42, kind: 'round', coneH: 20 }, // the north watch, the castle's second spire
  land_w: { x: HIGHTOLL_LAND_GATE.x + 7, z: 44.5, w: 8, h: 20, kind: 'square' },
  land_e: { x: HIGHTOLL_LAND_GATE.x - 7, z: 44.5, w: 8, h: 20, kind: 'square' },
  ne: { x: -22, z: 34, r: 6, h: 22, kind: 'round' },
  e1: { x: -29, z: 0, w: 8.5, h: 19, kind: 'square' },
  se: { x: -24, z: -32, r: 6.5, h: 20, kind: 'round', ruin: true },
  toll_w: { x: 3.5, z: 0, w: 5.5, h: 15, kind: 'square' },
  toll_e: { x: -7.5, z: 0, w: 5.5, h: 15, kind: 'square' },
};
// The keep stands on the cliff over the Wash; its west wall is the curtain there.
export const KEEP = { x0: 24, x1: 53, z0: -24, z1: 22, h: 30 };
export const KEEP_DOOR = { x: KEEP.x0, z: -12, w: 3.4, h: 5.2 };
export const TOLL_TOWER = { x: (KEEP.x0 + KEEP.x1) / 2, z: 8, w: 15 };
// The Bridge Court: where the castellan keeps the gate. Its paving and its open middle.
export const BRIDGE_COURT = { x0: -22, x1: 22, z0: -36, z1: -2, home: [-1, -19] };
export const NORTH_COURT = { x0: -20, x1: 40, z0: 3, z1: 42 };
const T = TOWERS;
const pt = (id) => [T[id].x, T[id].z];
const CURTAIN = [
  [pt('bridge_w'), pt('sw')],
  [pt('sw'), [KEEP.x1, KEEP.z0]],
  [[KEEP.x1, KEEP.z1], pt('nw')],
  [pt('nw'), pt('land_w')],
  [pt('land_e'), pt('ne')],
  [pt('ne'), pt('e1')],
  [pt('e1'), pt('se')],
  [pt('se'), pt('bridge_e')],
];
const INNER = [
  [pt('e1'), pt('toll_e')],
  [pt('toll_w'), [KEEP.x0, 0]],
];

// ---------------------------------------------------------------- pieces
function lowest(c, x, z, w, d, rot = 0) {
  return Math.min(TOP, c.f.lowest(w, d, x, z, rot));
}

// A run of curtain from A to B: footing, coursed body, battered skirt, a walk behind a
// corbelled parapet on the outer face, a kerb on the inner, arrow slits.
function curtain(c, k, [ax, az], [bx, bz], o = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.5) return;
  const ry = Math.atan2(bx - ax, bz - az);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const t = o.t ?? 3.2;
  const top = TOP + (o.h ?? 13);
  const nx = Math.cos(ry), nz = -Math.sin(ry);
  const out = (mx - MID[0]) * nx + (mz - MID[1]) * nz > 0 ? 1 : -1;
  const foot = lowest(c, mx, mz, t + 2.4, len, ry) - 1.2;
  const fine = k.detail >= 1;
  k.at({ x: mx, y: 0, z: mz, ry }, () => {
    k.slab(0, foot, 0, t + 0.8, TOP + 0.5 - foot, len + 0.4, 'stone2');
    k.masonry(0, TOP, 0, t, top - TOP, len + 0.02, { course: 1.7 });
    k.ramp(out * (t / 2 + 0.6), TOP - 0.2, 0, len + 0.02, 3.2, 1.2, 'stone2', { ry: out * UP });
    if (fine) k.slab(out * (t / 2 + 0.1), TOP + 2.8, 0, 0.5, 0.4, len + 0.04, 'edge');
    const pTop = top + 1.3;
    if (fine) {
      const n = Math.max(2, Math.round(len / 1.7));
      for (let i = 0; i < n; i++) {
        const z = -len / 2 + (len / n) * (i + 0.5);
        k.ramp(out * (t / 2 + 0.4), top - 1.9, z, 0.55, 1.5, 0.8, 'edge', { rz: Math.PI, ry: out * UP + Math.PI });
      }
    }
    k.slab(out * (t / 2 + 0.05), top - 0.4, 0, 1.0, 0.4, len + 0.02, 'edge');
    k.slab(out * (t / 2 + 0.2), top, 0, 0.7, pTop - top, len + 0.02, 'stone');
    k.crenels(out * (t / 2 + 0.2), -len / 2 + 0.5, out * (t / 2 + 0.2), len / 2 - 0.5, pTop, 0.7, { c: 'stone', h: 1.1 });
    k.slab(-out * (t / 2 - 0.25), top, 0, 0.5, 0.5, len + 0.02, 'edge');
    if (fine) {
      const n = Math.max(1, Math.floor(len / 6));
      for (let i = 0; i < n; i++) {
        const z = -len / 2 + (len / n) * (i + 0.5);
        k.window(out * (t / 2 + 0.01), TOP + (top - TOP) * 0.45, z, 0.4, 2.2, { ry: out * UP, pointed: true });
      }
      // moss where the rain runs down off the walk
      const rng = seededRandom(Math.round(mx * 31 + mz * 7));
      for (let i = 0; i < Math.floor(len / 7); i++) {
        if (rng() < 0.4) continue;
        const h = 2 + rng() * 5;
        k.slab(out * (t / 2 + 0.03), top - h - 0.6, -len / 2 + rng() * len, 0.1, h, 0.8 + rng() * 1.8, rng() < 0.6 ? 'moss' : 'moss2', { grad: 0.4 });
      }
    }
  });
  c.solid(mx, mz, t, len, foot, top, { rot: ry });
  c.solid(mx + nx * out * (t / 2 + 0.2), mz + nz * out * (t / 2 + 0.2), 0.7, len, top, pTopOf(top), { rot: ry });
  for (let u = -len / 2; u <= len / 2 + 0.01; u += 6) c.exclude(mx + Math.sin(ry) * u, mz + Math.cos(ry) * u, t + 3);
}
const pTopOf = (top) => top + 1.3;

// A round tower: a battered base grown out of the rock, coursed drum, slits, a corbelled
// gallery and a slate cone. A ruined one ends in broken teeth with a tree in the shell.
function roundTower(c, k, d, rng) {
  const { x, z, r, h } = d;
  const sides = k.detail >= 1 ? 16 : 10;
  const lo = lowest(c, x, z, r * 2.4, r * 2.4) - 1.5;
  const top = TOP + h;
  if (lo < TOP - 0.5) k.prism(x, lo, z, r * 1.16, TOP + 2.4 - lo, 'stone2', { sides, top: 0.9 });
  else k.prism(x, TOP - 1.5, z, r * 1.14, 3.9, 'stone2', { sides, top: 0.9 });
  const course = k.detail >= 1 ? 2.6 : (top - TOP);
  for (let y = TOP + 2.4, i = 0; y < top - 0.01; i++) {
    const ch = Math.min(course, top - y);
    k.prism(x, y, z, r, ch, i % 2 ? 'stone2' : 'stone', { sides });
    if (k.detail >= 1 && i % 3 === 2) k.prism(x, y + ch - 0.25, z, r * 1.04, 0.3, 'edge', { sides });
    y += ch;
  }
  if (k.detail >= 1) {
    for (let s = 0; s < 4; s++) {
      const a = (d.face ?? 0) + s * 1.6 + rng() * 0.4;
      const wy = TOP + h * (0.25 + 0.17 * s);
      k.window(x + Math.sin(a) * r * 1.01, wy, z + Math.cos(a) * r * 1.01, 0.45, 2.0, { ry: a, pointed: true, lit: s === 3 && !d.ruin });
    }
    for (let i = 0; i < 4; i++) {
      if (rng() < 0.4) continue;
      const a = rng() * TAU, mh = 3 + rng() * 6;
      k.slab(x + Math.sin(a) * r * 1.0, top - mh - 2 - rng() * 6, z + Math.cos(a) * r * 1.0, 0.12, mh, 1.2 + rng() * 2, rng() < 0.5 ? 'moss' : 'moss2', { ry: a + UP, grad: 0.4 });
    }
  }
  c.pillar(x, z, r, lo, top);
  c.exclude(x, z, r + 3);
  if (d.ruin) {
    // the crown came down when the spans did: teeth of uneven height, a tree in the shell
    const n = 10;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU;
      const th = [3.5, 1.2, 0, 2.4, 4.8, 2.0, 0.6, 0, 1.6, 3.0][j];
      if (th <= 0) continue;
      k.slab(x + Math.sin(a) * r * 0.86, top, z + Math.cos(a) * r * 0.86, 2.6, th, 1.4, j % 2 ? 'stone' : 'stone2', { ry: a });
    }
    if (k.detail >= 1) {
      tree(k, x + 1, top - 0.5, z - 0.5, 1.3, rng, true);
      k.rubble(x + r + 3, lowest(c, x + r + 3, z, 4, 4) + 0.2, z - 2, 4, 8, rng, { size: 1.6, ground: (gx, gz) => c.f.ground(gx, gz) });
    }
    return top;
  }
  // corbelled gallery, crenellated, then the cone
  k.prism(x, top, z, r, 1.1, 'stone2', { sides, top: 1.14 });
  k.prism(x, top + 1.1, z, r * 1.16, 0.4, 'edge', { sides });
  const n = k.detail >= 1 ? Math.round((TAU * r) / 2.2) : 0;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU;
    k.slab(x + Math.sin(a) * r * 1.1, top + 1.5, z + Math.cos(a) * r * 1.1, 1.1, 1.1, 0.6, 'stone', { ry: a });
  }
  const coneH = d.coneH ?? r * 2.5;
  k.prism(x, top + 1.5, z, r * 0.92, 2.2, 'stone', { sides });
  k.pyramid(x, top + 3.7, z, r * 1.12, coneH, 'roof', { sides });
  if (k.detail >= 1) {
    k.prism(x, top + 3.7 + coneH - 0.2, z, 0.14, 2.6, 'metal', { sides: 4, layer: 'metal' });
    k.prism(x, top + 3.7 + coneH + 1.2, z, 0.45, 0.12, 'metal', { sides: 6, layer: 'metal' });
  }
  return top + 3.7 + coneH;
}

// A square tower on its footing: coursed stages with a setback, windows, a crenellated top
// and a slate spire (or a hip for the low ones).
function squareTower(c, k, d) {
  const { x, z, w, h } = d;
  const dd = d.d ?? w;
  const lo = lowest(c, x, z, w + 1, dd + 1) - 1.2;
  if (lo < TOP - 0.2) k.footing(x, z, w + 1.2, dd + 1.2, TOP + 0.4, lo, 'stone2', { cap: 'edge' });
  let y = TOP;
  const stages = d.stages ?? [0.55, 0.45];
  let ww = w, dw = dd;
  for (const [i, f] of stages.entries()) {
    const sh = f * h;
    k.masonry(x, y, z, ww, sh, dw, {});
    if (k.detail >= 1) {
      k.slab(x, y + sh - 0.3, z, ww + 0.4, 0.3, dw + 0.4, 'edge');
      if (sh > 5) {
        for (const [fx, fz, ry] of [[0, dw / 2 + 0.01, 0], [ww / 2 + 0.01, 0, UP], [0, -dw / 2 - 0.01, Math.PI], [-ww / 2 - 0.01, 0, -UP]]) {
          k.window(x + fx, y + sh * 0.45, z + fz, 0.7, 1.8, { ry, pointed: true, lit: i === stages.length - 1 && d.lit });
        }
      }
    }
    y += sh;
    if (i < stages.length - 1) { ww *= 0.9; dw *= 0.9; }
  }
  c.solid(x, z, w, dd, lo, TOP + h);
  c.exclude(x, z, Math.max(w, dd) / 2 + 3);
  // crenellated top on corbels
  k.slab(x, y, z, ww + 0.8, 0.45, dw + 0.8, 'edge');
  const hw = ww / 2 + 0.2, hd = dw / 2 + 0.2;
  for (const [ax, az, bx, bz] of [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]]) k.crenels(x + ax, z + az, x + bx, z + bz, y + 0.45, 0.6, { c: 'stone' });
  if (d.roof === 'flat') return y + 1.5;
  const rh = d.roofH ?? Math.max(ww, dw) * 1.5;
  // the spire stands on a short drum inside the parapet
  k.masonry(x, y + 0.45, z, ww - 1.6, 1.6, dw - 1.6, {});
  k.roof('spire', x, y + 2.05, z, ww - 1.2, dw - 1.2, rh, { c: 'roof', overhang: 0.2 });
  if (k.detail >= 1) k.prism(x, y + 2.05 + rh - 0.3, z, 0.12, 2.2, 'metal', { sides: 4, layer: 'metal' });
  return y + 2.05 + rh;
}

// Blocky tree rooted in the masonry or the court: a trunk and stepped crowns, gold or green.
function tree(k, x, y, z, s, rng, gold = false) {
  const h = 3.2 * s;
  k.prism(x, y, z, 0.28 * s, h, 'bark', { sides: 5, top: 0.6 });
  const leaves = gold ? ['gold', 'gold2', 'gold'] : ['leaf', 'leaf2', 'moss'];
  let yy = y + h * 0.7;
  for (let i = 0; i < 3; i++) {
    const r = (1.8 - i * 0.45) * s;
    k.prism(x + (rng() - 0.5) * 0.6 * s, yy, z + (rng() - 0.5) * 0.6 * s, r, 1.3 * s, leaves[i], { sides: 6, top: 0.72, ry: rng() * TAU });
    yy += 1.05 * s;
  }
}

// A gatehouse between two flanking towers already raised: the passage vault, pointed arch
// faces at both ends, the room over it, a raised portcullis. Passage runs along local z.
function gatePassage(c, k, x, z, span, len, o = {}) {
  const ph = o.ph ?? 8;
  const over = o.over ?? 18;
  // side walls of the passage
  for (const s of [-1, 1]) {
    k.masonry(x + s * (span / 2 + 0.6), TOP, z, 1.2, ph, len, {});
    c.solid(x + s * (span / 2 + 0.6), z, 1.2, len, TOP, TOP + ph);
  }
  // the vault and the room above
  k.masonry(x, TOP + ph, z, span + 2.4, over - ph, len, {});
  c.solid(x, z, span + 2.4, len, TOP + ph, TOP + over);
  k.slab(x, TOP + ph - 0.5, z, span, 0.5, len - 0.1, 'stone2');
  for (const s of [-1, 1]) {
    k.at({ x, y: TOP + ph - span * 0.55, z: z + s * (len / 2 + 0.05) }, (kk) => kk.arch(0, 0, 0, span, { pointed: true, t: 0.8, depth: 0.9, c: 'edge', sharp: 0.75 }));
  }
  if (k.detail >= 1) {
    // the portcullis, wound up into its slot: teeth showing under the outer arch
    const pz = z + (o.outer ?? -1) * (len / 2 - 1.6);
    for (let i = 0; i < 7; i++) k.slab(x - span / 2 + 0.45 + i * (span - 0.9) / 6, TOP + ph - 1.6, pz, 0.16, 1.6, 0.16, 'iron', { layer: 'metal' });
    k.slab(x, TOP + ph - 1.0, pz, span - 0.4, 0.14, 0.16, 'iron', { layer: 'metal' });
    // worn threshold
    k.slab(x, TOP - 0.1, z, span, 0.16, len, 'edge', { grad: 0.1 });
  }
  // crenellated roof over the passage, between the towers
  const top = TOP + over;
  k.slab(x, top, z, span + 3, 0.4, len + 0.6, 'edge');
  for (const s of [-1, 1]) k.crenels(x - span / 2 - 1.3, z + s * (len / 2 + 0.1), x + span / 2 + 1.3, z + s * (len / 2 + 0.1), top + 0.4, 0.6, { c: 'stone' });
  if (o.banner && k.detail >= 1) k.banner(x, TOP + ph + 1.2, z + (o.outer ?? -1) * (len / 2 + 0.3), 2.0, 5.5, 'cloth', { ry: o.outer > 0 ? 0 : Math.PI });
}

// ---------------------------------------------------------------- the Bridge Gate
// Two tall towers built up out of the cliff where the road came in, the passage between them
// open on the drop. Under the sill the abutment of the fallen span; beyond it a ragged reach of
// the old road, broken off over the fen.
function bridgeGate(c, k, rng) {
  const span = 6, len = 12;
  squareTower(c, k, { ...T.bridge_w, d: T.bridge_w.d, stages: [0.6, 0.4], roofH: 17, lit: true });
  squareTower(c, k, { ...T.bridge_e, d: T.bridge_e.d, stages: [0.6, 0.4], roofH: 17, lit: true });
  gatePassage(c, k, 0, -42, span, len, { ph: 9, over: 20, outer: -1, banner: true });
  // the abutment: a buttressed face down the cliff carrying the road's last metres
  const zf = -48;
  const lo = lowest(c, 0, zf - 3, 14, 6) - 1;
  k.at({ x: 0, y: 0, z: zf - 2.6 }, (kk) => {
    kk.masonry(0, lo, 0, 13.6, TOP - 1.3 - lo, 5.2, { course: 2.2 });
    if (kk.detail >= 1) for (const s of [-1, 1]) kk.buttress(s * 7.2, lo, 0, TOP - 6 - lo, { ry: s * UP, w: 2.2, depth: 2.4, stages: 4 });
  });
  c.solid(0, zf - 2.6, 13.6, 5.2, lo, TOP - 1.3);
  // the road: deck slab, string course, parapets, ending in a ragged break
  const z0 = -48, reach = 6.5;
  k.slab(0, TOP - 1.9, z0 - reach / 2, 14.3, 0.6, reach, 'edge');
  for (let i = 0; i < 4; i++) {
    const x = -6.5 + (i + 0.5) * (13 / 4);
    const L = reach * (0.55 + rng() * 0.45);
    k.slab(x, TOP - 1.3, z0 - L / 2, 13 / 4 + 0.02, 1.3, L, i % 2 ? 'stone2' : 'stone');
    c.solid(x, z0 - L / 2, 13 / 4, L, TOP - 1.3, TOP);
    if (k.detail >= 1) {
      k.slab(x, TOP - 0.06, z0 - L / 2, 13 / 4 - 0.15, 0.1, L - 0.2, rng() < 0.5 ? 'edge' : 'stone', { grad: 0.15 });
      k.block(x + (rng() - 0.5), TOP - 1.6 - rng(), z0 - L + 0.3, 1 + rng(), 1 + rng(), 0.8, 'dark', { ry: rng() });
    }
  }
  // parapet stubs: the inland one runs out a few metres, the sea one barely leaves the gate
  k.slab(-6.1, TOP, z0 - 2.2, 0.8, 1.1, 4.4, 'stone');
  k.slab(6.1, TOP, z0 - 1.1, 0.8, 0.7, 2.2, 'stone2');
  c.solid(-6.1, z0 - 2.2, 0.8, 4.4, TOP, TOP + 1.1);
  c.solid(6.1, z0 - 1.1, 0.8, 2.2, TOP, TOP + 0.7);
  // the passage floor out to the edge
  c.solid(0, -42, span, len, TOP - 1, TOP);
  if (k.detail >= 1) {
    // grass in the joints at the break, and a golden sapling that took the end of the road
    tree(k, 3.8, TOP, z0 - 3.4, 0.75, rng, true);
    k.rubble(4, lowest(c, 4, z0 - 14, 8, 8) + 0.1, z0 - 14, 7, 12, rng, { size: 1.8, ground: (gx, gz) => c.f.ground(gx, gz) });
  }
}

// ---------------------------------------------------------------- the keep and the toll tower
function keep(c, k, rng) {
  const { x0, x1, z0, z1, h } = KEEP;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const t = 2.6, top = TOP + h;
  const fine = k.detail >= 1;
  const lo = lowest(c, cx, cz, w + 2, d + 2) - 1.2;
  if (lo < TOP - 0.2) k.footing(cx, cz, w + 1.6, d + 1.6, TOP + 0.4, lo, 'stone2', { cap: 'edge' });
  else k.slab(cx, TOP - 1.2, cz, w + 1.6, 1.6, d + 1.6, 'stone2');
  // four walls; the east one has the hall door
  const dz0 = KEEP_DOOR.z - KEEP_DOOR.w / 2, dz1 = KEEP_DOOR.z + KEEP_DOOR.w / 2;
  k.masonry(x1 - t / 2, TOP, cz, t, h, d, { course: 1.8 });
  k.masonry(cx, TOP, z0 + t / 2, w, h, t, { course: 1.8 });
  k.masonry(cx, TOP, z1 - t / 2, w, h, t, { course: 1.8 });
  k.masonry(x0 + t / 2, TOP, (z0 + dz0) / 2, t, h, dz0 - z0, { course: 1.8 });
  k.masonry(x0 + t / 2, TOP, (dz1 + z1) / 2, t, h, z1 - dz1, { course: 1.8 });
  k.masonry(x0 + t / 2, TOP + KEEP_DOOR.h, KEEP_DOOR.z, t, h - KEEP_DOOR.h, KEEP_DOOR.w, { course: 1.8 });
  c.solid(x1 - t / 2, cz, t, d, lo, top);
  c.solid(cx, z0 + t / 2, w, t, lo, top);
  c.solid(cx, z1 - t / 2, w, t, lo, top);
  c.solid(x0 + t / 2, (z0 + dz0) / 2, t, dz0 - z0, lo, top);
  c.solid(x0 + t / 2, (dz1 + z1) / 2, t, z1 - dz1, lo, top);
  c.solid(x0 + t / 2, KEEP_DOOR.z, t, KEEP_DOOR.w, TOP + KEEP_DOOR.h, top);
  // the hall's ceiling, and the solid floors above it under the roof
  const hallH = 16;
  k.slab(cx, TOP + hallH, cz, w - 2 * t, h - hallH, d - 2 * t, 'stone2');
  c.solid(cx, cz, w - 2 * t, d - 2 * t, TOP + hallH, top);
  c.shelter(cx, cz, w - 2 * t, d - 2 * t, TOP, TOP + hallH);
  // the door: a pointed arch in a projecting frame, the leaves thrown open
  k.at({ x: x0 - 0.2, y: TOP + KEEP_DOOR.h - 1.9, z: KEEP_DOOR.z, ry: UP }, (kk) => kk.arch(0, 0, 0, KEEP_DOOR.w, { pointed: true, t: 0.6, depth: 0.8, c: 'edge' }));
  if (fine) {
    for (const s of [-1, 1]) k.slab(x0 - 0.3, TOP, KEEP_DOOR.z + s * (KEEP_DOOR.w / 2 + 0.5), 0.9, KEEP_DOOR.h + 1.4, 1.0, 'edge');
    for (const s of [-1, 1]) k.slab(x0 + 0.9, TOP, KEEP_DOOR.z + s * (KEEP_DOOR.w / 2 - 0.1), 1.5, KEEP_DOOR.h - 0.4, 0.14, 'wood', { ry: s * 0.4 });
    k.stair(x0 - 2.6, TOP - 0.6, KEEP_DOOR.z, KEEP_DOOR.w + 1.6, 2, { rise: 0.3, run: 0.8, ry: UP, base: TOP - 1 });
  }
  // buttresses on the long faces, two storeys of tall windows lit from within
  const faces = [[x1, 1], [x0, -1]];
  for (const [fx, s] of faces) {
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const z = z0 + 2 + (d - 4) * (i / n);
      if (s < 0 && Math.abs(z - KEEP_DOOR.z) < 4) continue;
      k.buttress(fx, TOP, z, h * 0.78, { ry: s * UP, w: 1.4, depth: 2.2, stages: 3 });
      c.solid(fx + s * 0.9, z, 1.8, 1.4, TOP, TOP + h * 0.6);
      if (fine && i < n) {
        const wz = z + (d - 4) / n / 2;
        k.window(fx + s * 0.02, TOP + 6.2, wz, 1.3, 4.2, { ry: s * UP, pointed: true, lit: true });
        k.window(fx + s * 0.02, TOP + 18.5, wz, 1.1, 3.4, { ry: s * UP, pointed: true, lit: (i + (s > 0)) % 2 === 0 });
      }
    }
  }
  for (const [fz, s] of [[z0, -1], [z1, 1]]) {
    if (fine) for (const x of [cx - 7, cx, cx + 7]) k.window(x, TOP + 18.5, fz + s * 0.02, 1.1, 3.4, { ry: s > 0 ? 0 : Math.PI, pointed: true, lit: x === cx });
  }
  // corbel table and parapet round the roof
  k.slab(cx, top - 0.5, cz, w + 1.2, 0.5, d + 1.2, 'edge');
  if (fine) {
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) {
      k.crenels(ax + Math.sign(cx - ax) * -0.3, az + Math.sign(cz - az) * -0.3, bx + Math.sign(cx - bx) * -0.3, bz + Math.sign(cz - bz) * -0.3, top, 0.7, { c: 'stone' });
    }
  }
  // the roof: steep slate along the hall
  k.roof('gable', cx, top, cz - 4, w - 4, d - 10, 15, { c: 'roof', overhang: 0.3 });
  if (fine) {
    for (const z of [cz - 18, cz - 10]) {
      for (const s of [-1, 1]) {
        k.at({ x: cx + s * 6.4, y: top + 4.5, z, ry: s * UP }, (kk) => {
          kk.slab(0, 0, 0, 2.4, 2.6, 2.4, 'stone');
          kk.wedge(0, 2.6, 0, 3, 1.8, 3, 'roof');
          kk.window(0, 0.5, 1.21, 0.8, 1.4, { lit: true });
        });
      }
    }
  }
  c.solid(cx, cz, w, d, top - 0.5, top);
  // bartizans: turrets corbelled out at the keep's four corners
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
    const r = 3.3, y0 = TOP + h - 12;
    k.prism(x, y0 - 4, z, r * 0.4, 4, 'stone2', { sides: 10, top: 2.4 });
    k.prism(x, y0, z, r, 21, 'stone', { sides: 12 });
    if (fine) {
      k.prism(x, y0 + 7, z, r * 1.05, 0.3, 'edge', { sides: 12 });
      k.window(x + Math.sign(x - cx) * r * 0.72, y0 + 10, z + Math.sign(z - cz) * r * 0.72, 0.45, 1.6, { ry: Math.atan2(x - cx, z - cz), pointed: true, lit: true });
    }
    k.prism(x, y0 + 21, z, r * 1.12, 0.5, 'edge', { sides: 12 });
    k.pyramid(x, y0 + 21.5, z, r * 1.2, 11, 'roof', { sides: 12 });
    if (fine) k.prism(x, y0 + 32.3, z, 0.1, 2.0, 'metal', { sides: 4, layer: 'metal' });
  }
  // the crown's cloth down the cliff face over the Wash
  if (fine) {
    for (const z of [cz - 12, cz + 12]) {
      k.banner(x1 + 0.35, TOP + 9, z, 3.2, 12, 'cloth', { ry: UP });
      k.slab(x1 + 0.42, TOP + 9 + 4, z, 0.06, 1.2, 3.25, 'cloth2', { ry: 0 });
    }
  }
  c.exclude(cx, cz, Math.max(w, d) / 2 + 4);
}

// The Toll Tower: rising out of the keep's roof, its belfry open on every face, the bell that
// rang each cart through hanging where the fen can hear it, a verdigris dome and lantern over.
function tollTower(c, k, bellKit) {
  const { x, z, w } = TOLL_TOWER;
  const fine = k.detail >= 1;
  const y0 = TOP + KEEP.h - 2;
  const body = 36;
  // the shaft: two stages with a setback, corner pilasters, lit lancets
  let y = y0, ww = w;
  for (const [i, sh] of [[0, body * 0.55], [1, body * 0.45]]) {
    k.masonry(x, y, z, ww, sh, ww, { course: 1.9 });
    if (fine) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.slab(x + sx * (ww / 2), y, z + sz * (ww / 2), 1.6, sh, 1.6, 'edge');
      for (let f = 0; f < 4; f++) {
        const a = (f * Math.PI) / 2;
        for (const off of [-ww * 0.22, ww * 0.22]) {
          const fx = Math.sin(a) * (ww / 2 + 0.02) + Math.cos(a) * off, fz = Math.cos(a) * (ww / 2 + 0.02) - Math.sin(a) * off;
          k.window(x + fx, y + sh * 0.35, z + fz, 0.9, sh * 0.32, { ry: a, pointed: true, lit: i === 1 || f % 2 === 0 });
        }
      }
    }
    k.slab(x, y + sh - 0.4, z, ww + 0.8, 0.5, ww + 0.8, 'edge');
    y += sh;
    if (i === 0) ww *= 0.9;
  }
  // the belfry: four open bays a side, piers between them
  const bh = 12, bw = ww;
  const piers = 3;
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2;
    k.at({ x, y, z, ry: a }, (kk) => {
      for (let i = 0; i <= piers; i++) {
        const u = -bw / 2 + 0.9 + (bw - 1.8) * (i / piers);
        kk.slab(u, 0, bw / 2 - 0.9, 1.8, bh, 1.8, 'stone');
      }
      for (let i = 0; i < piers; i++) {
        const u = -bw / 2 + 0.9 + (bw - 1.8) * ((i + 0.5) / piers);
        const sp = (bw - 1.8) / piers - 1.8;
        kk.arch(u, bh - sp * 0.9, bw / 2 - 0.9, sp, { pointed: true, t: 0.55, depth: 1.8, c: 'edge', spandrel: true, spandrelH: 0.5, fill: 'stone' });
      }
    });
  }
  k.slab(x, y - 0.2, z, bw - 1.6, 0.4, bw - 1.6, 'stone2');
  // the bell, hung from its beam (built in its own part so it can swing)
  const bellY = y + bh - 2.6;
  k.slab(x, y + bh - 1.4, z, bw - 1.8, 0.8, 0.9, 'wood');
  bellKit.prism(0, -4.6, 0, 2.5, 4.6, 'bronze', { sides: 14, top: 0.55, layer: 'metal' });
  bellKit.prism(0, -4.95, 0, 2.75, 0.4, 'bronze', { sides: 14, layer: 'metal' });
  bellKit.prism(0, -0.1, 0, 0.9, 0.6, 'bronze', { sides: 8, layer: 'metal' });
  y += bh;
  // cornice, the octagonal drum, the dome, the lantern and its needle
  k.slab(x, y, z, bw + 1.4, 0.7, bw + 1.4, 'edge');
  if (fine) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = x + sx * (bw / 2 + 0.1), pz = z + sz * (bw / 2 + 0.1);
    k.slab(px, y + 0.7, pz, 1.4, 3, 1.4, 'stone');
    k.pyramid(px, y + 3.7, pz, 1.1, 5.5, 'roof', { sides: 4 });
  }
  const dr = bw * 0.46;
  k.prism(x, y + 0.7, z, dr, 5, 'stone', { sides: 8 });
  if (fine) for (let f = 0; f < 8; f++) {
    const a = (f / 8) * TAU + Math.PI / 8;
    k.window(x + Math.sin(a) * dr * 0.93, y + 2, z + Math.cos(a) * dr * 0.93, 0.8, 2, { ry: a, lit: true });
  }
  k.prism(x, y + 5.7, z, dr * 1.06, 0.5, 'edge', { sides: 8 });
  k.roof('dome', x, y + 6.2, z, dr * 2, dr * 2, 8.5, { c: 'copper', sides: 12 });
  const ly = y + 6.2 + 8.2;
  k.prism(x, ly, z, 1.5, 3.8, 'stone', { sides: 8 });
  if (fine) k.prism(x, ly + 0.8, z, 1.52, 1.8, 'glow', { sides: 8, layer: 'glow', strength: 1.1 });
  k.pyramid(x, ly + 3.8, z, 1.8, 3.2, 'copper', { sides: 8 });
  k.prism(x, ly + 6.8, z, 0.14, 6, 'metal', { sides: 4, layer: 'metal' });
  if (fine) k.prism(x, ly + 10.5, z, 0.7, 0.12, 'gold', { sides: 6, layer: 'metal' });
  return { bell: { x, y: bellY, z }, top: ly + 12.8 };
}

// ---------------------------------------------------------------- the courts
function bridgeCourt(c, k, rng) {
  const { x0, x1, z0, z1 } = BRIDGE_COURT;
  const fine = k.detail >= 1;
  if (!fine) return;
  // flags laid in courses across the court, a broad lane of larger slabs from gate to gate
  const rows = Math.round((z1 - z0) / 2);
  for (let r = 0; r < rows; r++) {
    const z = z0 + (r + 0.5) * ((z1 - z0) / rows);
    const n = 10 + (r % 2);
    for (let i = 0; i < n; i++) {
      const w = (x1 - x0) / n;
      const x = x0 + (i + 0.5) * w;
      const roll = rng();
      if (roll < 0.05) continue;
      k.slab(x, TOP - 0.1, z, w - 0.14, 0.14 + rng() * 0.04, (z1 - z0) / rows - 0.14, roll < 0.45 ? 'stone' : roll < 0.8 ? 'edge' : 'stone2', { grad: 0.12 });
      if (rng() < 0.06) k.slab(x + (rng() - 0.5) * w * 0.5, TOP + 0.03, z, 0.5 + rng() * 0.6, 0.05, 0.4 + rng() * 0.5, 'moss', { grad: 0 });
    }
  }
  // the toll lane: two cart ruts worn from the Bridge Gate to the Toll Gate
  for (const rx of [-1.4, 0.9]) k.slab(rx, TOP - 0.04, (z0 + z1) / 2, 0.5, 0.1, z1 - z0, 'joint', { grad: 0 });
  // braziers at the corners of the court, banked and still burning
  for (const [x, z] of [[x0 + 3, z0 + 4], [x1 - 3, z0 + 4], [x0 + 3, z1 - 4], [x1 - 3, z1 - 4]]) {
    k.prism(x, TOP, z, 0.7, 0.4, 'stone2', { sides: 8 });
    k.prism(x, TOP + 0.4, z, 0.22, 1.5, 'iron', { sides: 6, layer: 'metal' });
    k.prism(x, TOP + 1.9, z, 0.85, 0.5, 'iron', { sides: 8, top: 1.3, layer: 'metal' });
    k.glowPanel(x, TOP + 2.55, z, 0.9, 0.35, 0.9, 'ember', 1.8);
    c.pillar(x, z, 0.75, TOP, TOP + 2.4);
  }
  for (const [x, z] of [[x0 + 3, z0 + 4], [x1 - 3, z1 - 4]]) c.light(x, TOP + 3, z, '#ffa860', 1.8, 16, true, 0.9);
  // the toll stone by the Toll Gate: where carts stopped and the bell was rung for them
  const [tx, tz] = [-9, -6];
  k.slab(tx, TOP, tz, 2.4, 1.2, 1.6, 'stone2');
  k.slab(tx, TOP + 1.2, tz, 2.6, 0.25, 1.8, 'edge');
  k.slab(tx, TOP + 1.45, tz, 1.2, 0.08, 0.9, 'bronze', { layer: 'metal' });
  c.solid(tx, tz, 2.4, 1.6, TOP, TOP + 1.45);
}

function northCourt(c, k, rng) {
  const fine = k.detail >= 1;
  // the Toll House: where the carters paid, a gabled hall against the north curtain
  const hx = 21, hz = 33, hw = 14, hd = 8;
  k.slab(hx, TOP - 0.6, hz, hw + 0.8, 0.8, hd + 0.8, 'stone2');
  k.masonry(hx, TOP, hz, hw, 7, hd, {});
  k.roof('gable', hx, TOP + 7, hz, hw, hd, 4.6, { c: 'roof', overhang: 0.5, ry: UP });
  c.solid(hx, hz, hw, hd, TOP - 1, TOP + 7);
  c.solid(hx, hz, hw, hd, TOP + 7, TOP + 10, { walkable: false });
  if (fine) {
    for (const x of [hx - 4.5, hx, hx + 4.5]) k.window(x, TOP + 2.6, hz - hd / 2 - 0.02, 1.0, 2.0, { ry: Math.PI, lit: x === hx });
    k.slab(hx + 5, TOP, hz - hd / 2 - 0.05, 1.6, 2.8, 0.15, 'wood');
    k.prism(hx - 4, TOP + 7, hz + 1.5, 0.8, 4.2, 'stone2', { sides: 4 });
  }
  // stores along the east curtain under a lean-to roof
  for (const [z, len] of [[10, 9], [22, 8]]) {
    k.masonry(-18.5, TOP, z, 5, 4.2, len, {});
    k.ramp(-18.5, TOP + 4.2, z, 6, 1.6, len + 0.8, 'roof', { ry: UP });
    c.solid(-18.5, z, 5, len, TOP, TOP + 4.2);
    if (fine) k.slab(-15.95, TOP, z, 0.15, 2.4, 1.5, 'wood');
  }
  // the well, carts that never left, a stack of barrels
  k.prism(8, TOP, 22, 1.5, 0.9, 'stone2', { sides: 10 });
  if (fine) {
    k.prism(8, TOP + 0.85, 22, 1.2, 0.08, 'dark', { sides: 10 });
    for (const s of [-1, 1]) k.slab(8 + s * 1.3, TOP + 0.9, 22, 0.25, 2.2, 0.25, 'wood');
    k.slab(8, TOP + 3.1, 22, 3.0, 0.25, 0.3, 'wood');
  }
  c.pillar(8, 22, 1.5, TOP, TOP + 0.9);
  if (fine) {
    for (const [x, z, ry] of [[-6, 16, 0.3], [30, 12, -0.6]]) {
      k.at({ x, y: TOP, z, ry }, (kk) => {
        kk.slab(0, 0.6, 0, 1.8, 0.7, 3.4, 'wood2');
        for (const s of [-1, 1]) kk.prism(s * 1.05, 0.55, -0.6, 0.55, 0.16, 'wood', { sides: 8, rz: UP });
        kk.slab(0, 0.55, 2.4, 0.15, 0.15, 2.4, 'wood');
      });
      c.solid(x, z, 1.9, 3.6, TOP, TOP + 1.3, { rot: ry });
    }
    for (let i = 0; i < 5; i++) k.prism(32 + (i % 3) * 1.0, TOP + Math.floor(i / 3) * 1.1, 24 + (i % 2) * 0.4, 0.45, 1.1, 'wood2', { sides: 8 });
    c.solid(33, 24.2, 3.4, 1.4, TOP, TOP + 2.2);
    // trees that seeded in the court since the carts stopped
    tree(k, -15, TOP, 39, 1.6, rng, true);
    tree(k, 31, TOP, 40, 1.2, rng, false);
    tree(k, -14, TOP, 6, 1.0, rng, true);
  }
  for (const [x, z] of [[-15, 39], [31, 40], [-14, 6]]) c.pillar(x, z, 0.5, TOP, TOP + 4);
}

// The hall inside the keep: the castellan's lectern and his strongbox (data/hightoll.js), a long
// table nobody has eaten at in a long time, two rows of columns under the ceiling, his chair.
function keepHall(c, k) {
  const { x0, x1, z0, z1 } = KEEP;
  const ix0 = x0 + 2.6, ix1 = x1 - 2.6, iz0 = z0 + 2.6, iz1 = z1 - 2.6;
  const cx = (ix0 + ix1) / 2;
  const fine = k.detail >= 1;
  for (const x of [cx - 5.5, cx + 5.5]) {
    for (let z = iz0 + 5; z <= iz1 - 4; z += 6.5) {
      if (fine) k.column(x, TOP, z, 16, 0.75);
      c.pillar(x, z, 0.8, TOP, TOP + 16);
    }
  }
  if (!fine) return;
  k.slab(cx, TOP - 0.08, (iz0 + iz1) / 2, ix1 - ix0, 0.12, iz1 - iz0, 'edge', { grad: 0.1 });
  // the long table and its benches
  k.slab(cx, TOP + 0.85, 2, 2.4, 0.18, 18, 'wood');
  for (const z of [-6, 2, 10]) for (const s of [-1, 1]) k.slab(cx + s * 0.8, TOP, z, 0.25, 0.85, 0.25, 'wood2');
  for (const s of [-1, 1]) k.slab(cx + s * 2.0, TOP + 0.45, 2, 0.6, 0.1, 17, 'wood2');
  c.solid(cx, 2, 2.4, 18, TOP, TOP + 1.03);
  for (const s of [-1, 1]) c.solid(cx + s * 2.0, 2, 0.6, 17, TOP, TOP + 0.55);
  // cups and a candle stub nobody cleared
  for (const z of [-4, 1.5, 7]) k.prism(cx + 0.5, TOP + 1.03, z, 0.12, 0.2, 'bronze', { sides: 6, layer: 'metal' });
  // the castellan's chair at the head of the hall, its back to the north wall
  k.slab(cx, TOP, iz1 - 1.6, 2.2, 0.5, 1.8, 'stone2');
  k.slab(cx, TOP + 0.5, iz1 - 1.6, 1.6, 0.5, 1.2, 'wood');
  k.slab(cx, TOP + 1.0, iz1 - 1.0, 1.6, 2.6, 0.25, 'wood');
  k.banner(cx, TOP + 5, iz1 - 0.1, 3.0, 6.5, 'cloth', { ry: Math.PI });
  c.solid(cx, iz1 - 1.6, 2.2, 1.8, TOP, TOP + 1.0);
  // braziers either side of the door, hanging lamps down the hall
  for (const z of [KEEP_DOOR.z - 4, KEEP_DOOR.z + 4]) {
    k.prism(ix0 + 1.5, TOP, z, 0.6, 1.4, 'iron', { sides: 6, layer: 'metal' });
    k.glowPanel(ix0 + 1.5, TOP + 1.55, z, 0.8, 0.3, 0.8, 'ember', 1.7);
    c.pillar(ix0 + 1.5, z, 0.6, TOP, TOP + 1.4);
  }
  // the tall windows, bright from inside where the day comes through them
  for (const [wx, s] of [[ix1, -1], [ix0, 1]]) {
    for (let i = 0; i < 7; i++) {
      const wz = z0 + 2 + (z1 - z0 - 4) * ((i + 0.5) / 7);
      if (s > 0 && Math.abs(wz - KEEP_DOOR.z) < 4) continue;
      k.glowPanel(wx + s * 0.03, TOP + 8.3, wz, 0.06, 4.2, 1.3, 'glow', 1.25);
      k.glowPanel(wx + s * 0.03, TOP + 20.2, wz, 0.06, 3.4, 1.1, 'glow', 1.1);
    }
  }
  for (const z of [-8, 8]) {
    k.slab(cx, TOP + 9.5, z, 0.08, 6.5, 0.08, 'iron', { layer: 'metal' });
    k.lantern(cx, TOP + 8.8, z, { post: 0, strength: 1.5 });
  }
  c.light(cx, TOP + 8.5, -8, '#ffc07a', 2.4, 22, true, 1.2);
  c.light(cx, TOP + 8.5, 8, '#ffc07a', 2.2, 22, true, 1.0);
}

// The crack register: a bronze plaque on the Bridge Gate's inner face, where the crews' reports
// were cut. Returns the reading point in the frame.
function register(c, k) {
  const x = T.bridge_e.x, z = T.bridge_e.z + T.bridge_e.d / 2 + 0.06;
  k.slab(x, TOP + 1.0, z, 2.4, 1.6, 0.1, 'bronze', { layer: 'metal' });
  if (k.detail >= 1) {
    k.slab(x, TOP + 0.85, z + 0.02, 2.7, 0.15, 0.16, 'edge');
    for (let l = 0; l < 7; l++) k.slab(x - 0.1 + (l % 2) * 0.15, TOP + 1.2 + l * 0.18, z + 0.06, 1.8 - (l % 3) * 0.3, 0.04, 0.03, 'dark', { grad: 0 });
  }
  return { x, z: z + 1.2 };
}

// The Land Gate: the north gate, onto the road that went down with the low country. A stone
// landing is built out over the drop in front of it, where the descent line leaves for the Reed
// Road (data/hightoll.js): corbelled out of the rock, a parapet round its open sides.
function landGate(c, k) {
  const { x } = HIGHTOLL_LAND_GATE;
  const z = T.land_w.z;
  squareTower(c, k, { ...T.land_w, stages: [0.6, 0.4], roofH: 10 });
  squareTower(c, k, { ...T.land_e, stages: [0.6, 0.4], roofH: 10 });
  gatePassage(c, k, x, z, 5, 8, { ph: 7, over: 15, outer: 1, banner: true });
  const z0 = z + 4, z1 = z + 9.6, w = 9;
  const lo = lowest(c, x, (z0 + z1) / 2, w, z1 - z0) - 1;
  k.masonry(x, TOP - 2.4, (z0 + z1) / 2, w, 2.4, z1 - z0, { course: 0.8 });
  k.ramp(x, lo, (z0 + z1) / 2 - 0.6, w - 1, TOP - 2.4 - lo, z1 - z0 - 1.2, 'stone2', { ry: Math.PI });
  k.slab(x, TOP - 0.12, (z0 + z1) / 2, w - 0.3, 0.16, z1 - z0 - 0.3, 'edge', { grad: 0.1 });
  c.solid(x, (z0 + z1) / 2, w, z1 - z0, TOP - 2.4, TOP);
  // parapets on the flanks, the far side left open at the middle where the line runs out
  for (const s of [-1, 1]) {
    k.slab(x + s * (w / 2 - 0.35), TOP, (z0 + z1) / 2, 0.7, 1.1, z1 - z0, 'stone');
    c.solid(x + s * (w / 2 - 0.35), (z0 + z1) / 2, 0.7, z1 - z0, TOP, TOP + 1.1);
    k.slab(x + s * (w / 2 - 1.4), TOP, z1 - 0.35, 2.2, 1.1, 0.7, 'stone');
    c.solid(x + s * (w / 2 - 1.4), z1 - 0.35, 2.2, 0.7, TOP, TOP + 1.1);
  }
  if (k.detail >= 1) for (const s of [-1, 1]) k.lantern(x + s * 3.6, TOP, z0 + 0.8, { post: 2.4, strength: 1.2 });
}

function tollGate(c, k) {
  squareTower(c, k, { ...T.toll_w, stages: [1], roof: 'flat' });
  squareTower(c, k, { ...T.toll_e, stages: [1], roof: 'flat' });
  gatePassage(c, k, -2, 0, 5.5, 5.5, { ph: 6.5, over: 11, outer: -1 });
  c.solid(-2, 0, 5.5, 5.5, TOP - 1, TOP);
}

// ---------------------------------------------------------------- raising it
function recipe(c, k, bellKit) {
  const rng = seededRandom(7310);
  for (const run of CURTAIN) curtain(c, k, run[0], run[1], { h: 13 });
  for (const run of INNER) curtain(c, k, run[0], run[1], { h: 9, t: 2.6 });
  for (const id of ['sw', 'nw', 'ne', 'se']) roundTower(c, k, { ...T[id], face: Math.atan2(T[id].x - MID[0], T[id].z - MID[1]) }, rng);
  squareTower(c, k, { ...T.e1, roofH: 12 });
  bridgeGate(c, k, rng);
  landGate(c, k);
  tollGate(c, k);
  keep(c, k, rng);
  const tower = tollTower(c, k, bellKit);
  bridgeCourt(c, k, rng);
  northCourt(c, k, rng);
  keepHall(c, k);
  tower.register = register(c, k);
  // the rock's crown: no scatter anywhere on it
  for (let x = -24; x <= 52; x += 12) for (let z = -40; z <= 44; z += 12) c.exclude(x, z, 9);
  return tower;
}

// ---------------------------------------------------------------- the crags and the meadow
// The old high country's stone round the rock (data/hightoll.js): the crags behind the castle,
// the joints in the rock's own faces, and the meadow on the Wash side with the post's ruined
// chapel and watchtower among amber trees. One static kit merged into the map's cells; every
// column, wall and outcrop has a collider, and scatter keeps off them.
const STONE_P = { ...P, crag: '#959789', crag2: '#86887b', crag3: '#a2a395', crag4: '#787a6e', turf: '#6a8a3e', turf2: '#5a7a34', rubble: '#8f8a78' };
const CRAG_TONES = ['crag', 'crag2', 'crag3', 'crag4'];

// One standing column of the old country's stone, sunk in the ground, its head at `top`.
function column(c, k, rng, lx, lz, r, top) {
  const y0 = c.f.ground(lx, lz) - 3;
  if (top - y0 < 4) return;
  const tone = () => CRAG_TONES[(rng() * CRAG_TONES.length) | 0];
  k.prism(lx, y0, lz, r, top - y0, tone(), { sides: 5 + ((rng() * 2) | 0), top: 0.6 + rng() * 0.28, ry: rng() * TAU, rx: (rng() - 0.5) * 0.04, rz: (rng() - 0.5) * 0.04, grad: 0.22 });
  // a broken head where the column split again, or turf caught on it
  if (rng() < 0.4) {
    k.prism(lx + (rng() - 0.5) * r * 0.5, top - 0.6, lz + (rng() - 0.5) * r * 0.5, r * (0.35 + rng() * 0.25), 2 + rng() * 6, tone(), { sides: 5, top: 0.25 + rng() * 0.35, ry: rng() * TAU, grad: 0.2 });
  } else if (rng() < 0.3) {
    k.prism(lx, top - 0.35, lz, r * 0.66, 0.7, rng() < 0.5 ? 'turf' : 'turf2', { sides: 6, top: 0.82, ry: rng() * TAU, grad: 0 });
  }
  c.pillar(lx, lz, r * 0.82, y0, top);
  c.exclude(lx, lz, r + 2.5);
  c.piece(lx, lz, r, 'column');
}

// A crag: columns packed on a jittered grid over its ellipse, the heads falling away from the
// middle so the mass reads as a peak, the stoutest columns at its heart; round its foot, the
// talus of blocks that have come down off it.
function crag(c, k, d) {
  const rng = seededRandom(7400 + d.seed);
  const step = 6.4, row = step * 0.87;
  for (let j = -Math.ceil(d.rz / row); j <= Math.ceil(d.rz / row); j++) {
    for (let i = -Math.ceil(d.rx / step) - 1; i <= Math.ceil(d.rx / step); i++) {
      const lx = d.x + i * step + (j & 1 ? step / 2 : 0) + (rng() - 0.5) * 2.4;
      const lz = d.z + j * row + (rng() - 0.5) * 2.4;
      const q = Math.hypot((lx - d.x) / d.rx, (lz - d.z) / d.rz);
      if (q > 1) continue;
      const top = d.base + (d.peak - d.base) * Math.pow(1 - q, 0.85) + (rng() - 0.5) * 9;
      column(c, k, rng, lx, lz, (3 + rng() * 1.8) * (1.45 - 0.55 * q), top);
    }
  }
  const n = Math.round((d.rx + d.rz) * 0.8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng() * 0.3, out = 0.92 + rng() * 0.3;
    const lx = d.x + Math.sin(a) * d.rx * out, lz = d.z + Math.cos(a) * d.rz * out;
    const g = c.f.ground(lx, lz), s = 3 + rng() * 4.5;
    k.rock(lx, g + s * 0.22, lz, s * 1.45, s, s * 1.2, CRAG_TONES[(rng() * CRAG_TONES.length) | 0], { ry: rng() * TAU });
    c.pillar(lx, lz, s * 0.55, g - 1, g + s * 0.72);
    c.exclude(lx, lz, s + 1);
    c.piece(lx, lz, s * 0.75, 'talus');
  }
}

// Columns standing proud of the rock's faces toward the Wash and the town.
function rockJoints(c, k) {
  const J = ROCK_JOINTS, rng = seededRandom(7400 + J.seed), n = ROCK_OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = ROCK_OUTLINE[i], [bx, bz] = ROCK_OUTLINE[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az);
    let nx = (bz - az) / len, nz = -(bx - ax) / len;
    if (nx * ((ax + bx) / 2 - MID[0]) + nz * ((az + bz) / 2 - MID[1]) < 0) { nx = -nx; nz = -nz; }
    if (nx < J.facing) continue;
    for (let u = J.step / 2; u < len; u += J.step) {
      const t = u / len, r = 2.6 + rng() * 1.6;
      column(c, k, rng, ax + (bx - ax) * t + nx * r * 0.55, az + (bz - az) * t + nz * r * 0.55, r, J.top[0] + rng() * (J.top[1] - J.top[0]));
    }
  }
}

// A wall piece in a ruin's own frame (turned by ry about its centre at cx, cz), with its collider.
function ruinWall(c, k, cx, cz, ry, x, z, w, d, y0, h, tone = 'stone2') {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const lx = cx + x * cs + z * sn, lz = cz - x * sn + z * cs;
  k.slab(lx, y0, lz, w, h, d, tone, { ry });
  k.slab(lx, y0 + h, lz, w + 0.1, 0.18, d + 0.1, 'edge', { ry });
  c.solid(lx, lz, w, d, y0, y0 + h + 0.18, { rot: ry });
}

// The post's chapel: the nave unroofed, its west gable standing with the window in it, the side
// walls broken down, the apse fallen into the grass.
function chapel(c, k, d, rng) {
  const W = 8, L = 14, T = 0.9, g = c.f.ground(d.x, d.z) - 0.6;
  const wall = (x, z, w, dd, y0, h) => ruinWall(c, k, d.x, d.z, d.ry, x, z, w, dd, y0, h);
  // the west gable: piers either side of the window, the sill under it and the head over it
  wall(-(W / 2 - 1.4), -L / 2, 2.8, T, g, 9.4);
  wall(W / 2 - 1.4, -L / 2, 2.8, T, g, 8.2);
  wall(0, -L / 2, 2.4, T, g, 2.6);
  wall(-0.6, -L / 2, 1.2, T, g + 6.6, 2.8);
  // the side walls in broken runs, a gap where the south door was
  const runs = [[-1, [5.6, 3.2, 4.6, 1.4]], [1, [4.2, 6.1, 0, 2.2]]];
  for (const [side, hs] of runs) hs.forEach((h, i) => { if (h > 0) wall(side * (W / 2 - T / 2), -L / 2 + 1.75 + i * 3.5, T, 3.3, g, h); });
  // the east end: a stub of the apse wall and its fallen stones
  wall(0, L / 2, W - 1, T, g, 1.1);
  for (let i = 0; i < 7; i++) {
    const a = rng() * TAU, rr = 1 + rng() * 5;
    const [x, z] = [d.x + Math.cos(a) * rr + Math.sin(d.ry) * (L / 2 + 1.5), d.z + Math.sin(a) * rr + Math.cos(d.ry) * (L / 2 + 1.5)];
    const s = 0.6 + rng() * 0.9;
    k.rock(x, c.f.ground(x, z) + s * 0.25, z, s * 1.4, s * 0.8, s, 'rubble', { ry: rng() * TAU });
  }
  c.exclude(d.x, d.z, L / 2 + 3);
  c.piece(d.x, d.z, L / 2 + 1, 'chapel');
}

// The chapel's watchtower: a round shell broken off at the top, the door's dark mouth on one side.
function ruinedTower(c, k, d, rng) {
  const g = c.f.ground(d.x, d.z) - 0.6;
  k.prism(d.x, g, d.z, d.r, d.h, 'stone2', { sides: 10, top: 0.94 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rng() * 0.3, h = 0.6 + rng() * 2.6;
    k.slab(d.x + Math.sin(a) * (d.r - 0.5), g + d.h - 0.1, d.z + Math.cos(a) * (d.r - 0.5), 1.4, h, 0.9, 'stone', { ry: a });
  }
  k.slab(d.x + d.r - 0.2, g + 0.5, d.z, 0.4, 2.6, 1.3, 'dark', { grad: 0 });
  c.pillar(d.x, d.z, d.r, g, g + d.h + 1);
  c.exclude(d.x, d.z, d.r + 3);
  c.piece(d.x, d.z, d.r + 0.5, 'tower');
}

// The meadow below the rock on the Wash side.
function meadow(c, k) {
  const M = HIGHTOLL_MEADOW, rng = seededRandom(7461);
  chapel(c, k, M.chapel, rng);
  ruinedTower(c, k, M.tower, rng);
  // stubs of the post's outbuildings, and the stones fallen from them
  for (const [x, z, ry] of M.ruins) {
    const g = c.f.ground(x, z) - 0.5;
    ruinWall(c, k, x, z, ry, 0, 0, 4.5 + rng() * 2.5, 0.8, g, 1.2 + rng() * 2.2);
    if (rng() < 0.7) ruinWall(c, k, x, z, ry, 2.6, 2.4, 0.8, 4.2, g, 0.8 + rng() * 1.4);
    for (let i = 0; i < 3; i++) {
      const s = 0.5 + rng() * 0.7, px = x + (rng() - 0.5) * 7, pz = z + (rng() - 0.5) * 7;
      k.rock(px, c.f.ground(px, pz) + s * 0.25, pz, s * 1.3, s * 0.8, s, 'rubble', { ry: rng() * TAU });
    }
    c.exclude(x, z, 6);
    c.piece(x, z, 6, 'ruin');
  }
  // outcrops of the same stone as the crags, breaking the turf
  for (const [x, z, s] of M.outcrops) {
    const g = c.f.ground(x, z);
    k.rock(x, g + s * 0.2, z, s * 1.5, s * 0.95, s * 1.15, 'crag2', { ry: rng() * TAU });
    k.rock(x + s * 0.55, g + s * 0.1, z - s * 0.35, s * 0.8, s * 0.55, s * 0.7, 'crag3', { ry: rng() * TAU });
    c.pillar(x, z, s * 0.6, g - 1, g + s * 0.62);
    c.exclude(x, z, s + 2);
    c.piece(x, z, s, 'outcrop');
  }
  // amber trees, a few still green, on the dry ground clear of the rock and the ruins
  const T = M.trees, trng = seededRandom(7400 + T.seed);
  const keepOff = [[M.chapel.x, M.chapel.z, 13], [M.tower.x, M.tower.z, 8], ...M.ruins.map(([x, z]) => [x, z, 7]), ...M.outcrops.map(([x, z, s]) => [x, z, s + 3]), ...M.clear];
  for (let n = 0, tries = 0; n < T.count && tries < T.count * 15; tries++) {
    const x = T.x[0] + trng() * (T.x[1] - T.x[0]), z = T.z[0] + trng() * (T.z[1] - T.z[0]);
    const g = c.f.ground(x, z);
    if (g < 0.8 || keepOff.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r)) continue;
    const s = 1.3 + trng() * 1.0;
    tree(k, x, g - 0.2, z, s, trng, trng() < T.gold);
    c.pillar(x, z, 0.3 * s, g - 1, g + 3.2 * s);
    c.exclude(x, z, 2.5);
    c.piece(x, z, 2, 'tree');
    keepOff.push([x, z, 4.5]);
    n++;
  }
}

function buildSurrounds(world, f, exclusions) {
  const k = new Kit(STONE_P, { detail: 1, shadow: true });
  // every piece's footprint in the world, so tests can hold it clear of roads, lines and people
  const pieces = [];
  const c = {
    f, solid: f.solid, pillar: f.pillar,
    exclude: (lx, lz, r) => { const [x, z] = f.at(lx, lz); exclusions.push({ x, z, r }); },
    piece: (lx, lz, r, kind) => { const [x, z] = f.at(lx, lz); pieces.push({ x, z, r, kind }); },
  };
  for (const d of HIGHTOLL_CRAGS) crag(c, k, d);
  rockJoints(c, k);
  meadow(c, k);
  const group = k.build('hightoll_crags');
  group.position.set(f.x, 0, f.z);
  group.rotation.y = f.yaw;
  world.scene.add(group);
  mergeStatic(world.scene, [group]);
  return { tris: k.tris, pieces };
}

export function buildHightoll(world, exclusions = []) {
  const [ox, oz] = HIGHTOLL_ORIGIN;
  const f = siteFrame(world, ox, oz, HIGHTOLL.yaw, 0);
  const levels = [];
  let bellAt = null, registerAt = null;
  for (const detail of [1, 0]) {
    const first = detail === 1;
    const k = new Kit(P, { detail, shadow: first });
    const bellKit = new Kit(P, { detail, shadow: first });
    const c = {
      f,
      solid: first ? f.solid : noop,
      pillar: first ? f.pillar : noop,
      exclude: first ? (lx, lz, r) => {
        const [x, z] = f.at(lx, lz);
        exclusions.push({ x, z, r });
      } : noop,
      light: first ? (lx, ly, lz, col, i, d, fl = false, pr = 1) => {
        const [x, z] = f.at(lx, lz);
        world.addLight(new THREE.Vector3(x, ly, z), col, i, d, fl, pr);
      } : noop,
      shelter: first ? (lx, lz, w, d, y0, y1) => {
        const [x, z] = f.at(lx, lz);
        addShelter(world, x, z, w, d, f.yaw, y0, y1);
      } : noop,
    };
    const tower = recipe(c, k, bellKit);
    const group = k.build(`hightoll_lod${first ? 0 : 1}`);
    const bell = bellKit.build(`hightoll_bell_lod${first ? 0 : 1}`);
    bell.position.set(tower.bell.x, tower.bell.y, tower.bell.z);
    bell.userData.dynamic = true;
    group.add(bell);
    if (first) {
      bellAt = tower.bell;
      registerAt = tower.register;
    }
    levels.push({ group, bell });
  }
  const root = new THREE.Group();
  root.name = 'hightoll';
  root.position.set(f.x, 0, f.z);
  root.rotation.y = f.yaw;
  root.add(levels[0].group, levels[1].group);
  levels[1].group.visible = false;
  world.scene.add(root);

  // The bell swings when it tolls (game/hightoll.js rings it); otherwise it hangs still.
  const state = { swing: 0, phase: 0 };
  const [mx, mz] = f.at(MID[0], MID[1]);
  const centre = new THREE.Vector3(mx, TOP + 30, mz);
  world.animated.push((t, dt) => {
    const cam = G.game?.camera;
    if (cam) {
      // the spawn's view of it is full detail: the castle is what the drowned see first
      const low = G.game?.settings?.quality === 'low';
      const full = cam.position.distanceTo(centre) < (low ? 220 : 460);
      levels[0].group.visible = full;
      levels[1].group.visible = !full;
    }
    if (state.swing > 0.001) {
      const step = Math.min(dt || 0.016, 0.1);
      state.phase += step * 2.4;
      state.swing *= Math.exp(-step * 0.35);
      for (const l of levels) l.bell.rotation.x = Math.sin(state.phase) * state.swing;
    }
  });
  // the crack register is read off the gate's wall, like the Arches' service plate
  const [rx, rz] = f.at(registerAt.x, registerAt.z);
  if (!LORE_BY_ID[HIGHTOLL_REGISTER.id]) {
    LORE.push({ ...HIGHTOLL_REGISTER, x: rx, z: rz });
    LORE_BY_ID[HIGHTOLL_REGISTER.id] = LORE[LORE.length - 1];
  }
  const lore = LORE_BY_ID[HIGHTOLL_REGISTER.id];
  const verb = 'Read the carving';
  const interaction = world.addInteract({
    id: 'lore_' + lore.id, kind: 'lore', pos: new THREE.Vector3(rx, TOP + 1, rz), radius: 3,
    label: `${verb}: ${lore.title}`, use: () => act('readLore', lore.id),
  });
  if (world.loreTablets) world.loreTablets.push({ lore, group: null, kind: 'carving', interaction, verb });

  const surrounds = buildSurrounds(world, f, exclusions);
  const [bx, bz] = f.at(bellAt.x, bellAt.z);
  world.hightoll = {
    root, frame: f, levels, surrounds,
    bell: new THREE.Vector3(bx, bellAt.y, bz),
    toll(strength = 0.35) { state.swing = Math.max(state.swing, strength); },
  };
  return world.hightoll;
}
