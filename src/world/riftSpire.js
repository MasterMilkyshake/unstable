// The Ascent: the keep at the heart of the inner citadel and the spine that rises out of it
// through the crust to the Wound. Every level of the climb is a place with a use:
//   the gate hall      the keep's ground floor round the dais, entered from the plaza
//   the guardroom      the keep's first floor (First Stair), stairs up from the gate hall
//   the archive        the keep's second floor (Second Stair), a balcony on the west face
//   the roof           the Guarded Landing, the restorers' gear-train and the hanging halls
//   the Hanging Keep   a gallery at its old door, on piers from the roof
//   the Thin Stair     the old lift hall over the south hall
//   the Last Stair     a corbelled gallery high on the spine
//   the summit         the crown under the shaft, and the Wound in it
// The way out is the stone lift (world/ascentLifts.js) on the keep's north wall (+z), from the
// courtyard to the summit. The climb's ledges, chimneys and handholds still run up the spine,
// the long way round past the guarded landings.
import * as THREE from 'three';
import { mat } from './props.js';
import { mergeStatic } from './merge.js';
import { Kit, groundRange, hash3 } from './kit.js';
import { G } from '../core/globals.js';
import { act } from '../game/hooks.js';
import { SPIRE, SPIRE_TIER, SPIRE_LORE } from '../data/riftSpire.js';
import { buildRiftBailey } from './riftBailey.js';
import { CITY_PAL } from './riftWalls.js';

const P = { ...CITY_PAL, wood: '#4a3c32', wood2: '#3e3229', paper: '#b9ac8e', leather: '#4b3a2e', ember: '#ff9a52' };

function solid(world, x, z, w, d, y0, y1, o = {}) {
  if (!(y1 > y0)) return;
  world.colliders.addBox({ x, z, w, d, y0, y1, rot: o.rot ?? 0, climbable: o.climbable ?? true, walkable: o.walkable ?? true, tag: 'rift_ascent' });
}

const FACE = {
  n: { x: 0, z: -1, ledgeW: 3.4, ledgeD: 1.7, ry: Math.PI },
  e: { x: 1, z: 0, ledgeW: 1.7, ledgeD: 3.4, ry: Math.PI / 2 },
  s: { x: 0, z: 1, ledgeW: 3.4, ledgeD: 1.7, ry: 0 },
  w: { x: -1, z: 0, ledgeW: 1.7, ledgeD: 3.4, ry: -Math.PI / 2 },
};
const FACES = ['n', 'e', 's', 'w'];
// A ramp turned over: flat top against what it carries, deep at the wall, thin at the tip.
const BRACKET = { rz: Math.PI, grad: 0.05 };

function facePos(face, dist) {
  const f = FACE[face];
  return { x: SPIRE.x + f.x * dist, z: SPIRE.z + f.z * dist, f };
}

// The keep: wall faces between the corner piers, its two floors and its roof (the Guarded
// Landing, t3), closed all round by its parapet.
export const KEEP = { h: 48, inner: 13.2, outer: 14.7, span: 9.8, floors: [16, 32] };

export function buildRiftSpire(world, exclusions, state) {
  const low = state.low;
  const CX = SPIRE.x;
  const CZ = SPIRE.z;
  const H = SPIRE.half;
  const ground = world.terrain.heightAt(CX, CZ);
  const top = ground + SPIRE.summitH;
  const pale = mat('#cdbfe6', { emissive: '#9a86c8', ei: 0.8, transparent: true, opacity: 0.5, double: true, depthWrite: false });
  const glowMat = mat(P.glow, { emissive: P.glow, ei: 1.1 });

  const k = new Kit(P, { detail: low ? 0 : 1 });
  const fine = !low;
  const yOf = (tier) => (typeof tier === 'string' ? ground + SPIRE_TIER[tier].h : ground + tier.h);
  const onFace = (face, fn) => k.at({ ry: FACE[face].ry }, fn);
  const lamp = (x, y, z, c = '#e8b070', i = 1.1, r = 14) => world.addLight(new THREE.Vector3(CX + x, y, CZ + z), c, i, r, true, 0.8);
  buildRiftBailey(world, exclusions, low);

  // ------------------------------------------------------------ apron and dais
  const [lo] = groundRange(world.terrain, CX, CZ, 34, 34, 0, 4);
  k.footing(0, 0, 34, 34, ground + 0.3, lo, 'stone2', { cap: 'stone2' });
  if (fine) {
    // worn flags in staggered courses, a kerb of long stones at the edge
    const rows = 17, s = 34 / rows;
    for (let j = 0; j < rows; j++) {
      const shift = (j % 2) * 1.1;
      for (let x = -17 + 0.1 - shift; x < 17; x += 2.2) {
        const x0 = Math.max(-17, x), x1 = Math.min(17, x + 2.2);
        if (x1 - x0 < 0.4) continue;
        const h = hash3(x, j, 7);
        const rim = j === 0 || j === rows - 1 || x0 === -17 || x1 === 17;
        k.slab((x0 + x1) / 2, ground + 0.3, -17 + s * (j + 0.5), x1 - x0 - 0.12, 0.1 + (h > 0.93 ? 0.05 : 0), s - 0.12, rim ? 'edge' : h < 0.55 ? 'stone2' : 'stone', { grad: 0.04, ry: (h - 0.5) * 0.03 });
      }
    }
  } else {
    k.slab(0, ground + 0.3, 0, 34, 0.1, 34, 'stone');
  }
  solid(world, CX, CZ, 34, 34, ground - 1, ground + 0.4);

  const pTop = ground + 3.8;
  k.slab(0, ground + 0.4, 0, 23.2, 0.7, 23.2, 'stone2');
  k.masonry(0, ground + 1.1, 0, 22, pTop - 0.48 - (ground + 1.1), 22, { course: 1.1 });
  k.cornice(0, pTop - 0.48, 0, 22, 22, 'edge');
  solid(world, CX, CZ, 22, 22, ground - 1, ground + 3.8);

  // The grand stair from the plaza through the south gate onto the dais, and a short flight up
  // the dais from each of the other three gates.
  const steps = 11, rise = 3.4 / steps, run = 0.54;
  const z0 = -11 - steps * run;
  k.stair(0, ground + 0.4, z0, 7, steps, { rise, run, base: ground, c: 'stone', c2: 'stone2' });
  for (let i = 0; i < steps; i++) {
    solid(world, CX, CZ + z0 + run * (i + 0.5), 7, run, ground - 1, ground + 0.4 + rise * (i + 1));
  }
  for (const sx of [-1, 1]) k.lantern(sx * 4.4, ground + 0.4, z0 + 0.6, { post: 3.2, metal: 'metal', strength: 1.1 });
  for (const face of ['e', 's', 'w']) {
    const F = FACE[face];
    const n = 9, r2 = 3.4 / n, u = 0.24;
    onFace(face, (f) => f.stair(0, ground + 0.4, 11 + n * u, 4, n, { rise: r2, run: u, base: ground, ry: Math.PI, c: 'stone', c2: 'stone2' }));
    for (let i = 0; i < n; i++) {
      const d = 11 + n * u - u * (i + 0.5);
      solid(world, CX + F.x * d, CZ + F.z * d, F.x ? u : 4, F.x ? 4 : u, ground - 1, ground + 0.4 + r2 * (i + 1));
    }
  }

  // ------------------------------------------------------------ the keep
  // Four coursed faces between the corner piers, each with a vaulted gate at its foot (the
  // south gate takes the grand stair), lancets for each storey, and on the west face the
  // archive's balcony door.
  const envTop = ground + KEEP.h;
  const WI = KEEP.inner, WO = KEEP.outer, WT = WO - WI, WM = (WI + WO) / 2, SPAN = KEEP.span;
  const BRACKET_OUT = { rz: Math.PI, ry: Math.PI, grad: 0.05 };
  const [f1, f2] = KEEP.floors.map((h) => ground + h);
  const BAL = { face: 'e', half: 1.7, y0: f2, y1: f2 + 4.6 };
  const PARAPET = [-SPAN - 1.2, SPAN + 1.2];
  for (const face of FACES) {
    const F = FACE[face];
    // the south gate is the widest, but every vault closes under the guardroom's floor
    const gateHalf = face === 'n' ? 4.0 : 3.2;
    const spring = ground + 8.2;
    const rr = gateHalf * 2 * 0.8;
    const apex = Math.sqrt(rr * rr - (rr - gateHalf) ** 2);
    const bed = spring + apex + 1.0 + 0.6;
    const balcony = face === BAL.face;
    onFace(face, (f) => {
      const [low] = groundRange(world.terrain, CX + F.x * WM, CZ + F.z * WM, SPAN * 2, WT + 1, 0, 3);
      f.footing(0, WM, SPAN * 2, WT + 0.6, ground + 0.4, low, 'stone2', { cap: 'stone2' });
      for (const sx of [-1, 1]) f.masonry(sx * (gateHalf + SPAN) / 2, ground + 0.4, WM, SPAN - gateHalf, KEEP.h - 0.4, WT, { course: 1.8 });
      f.arch(0, spring, WM, gateHalf * 2, { pointed: true, t: 1.0, depth: WT, spandrel: true, spandrelH: 0.6, c: 'edge', fill: 'stone' });
      if (balcony) {
        // the wall over the gate, opened at the archive's floor for the balcony door
        f.masonry(0, bed - 0.02, WM, gateHalf * 2 + 0.4, BAL.y0 - bed + 0.02, WT, { course: 1.8 });
        for (const sx of [-1, 1]) f.masonry(sx * (BAL.half + (gateHalf + 0.2 - BAL.half) / 2), BAL.y0, WM, gateHalf + 0.2 - BAL.half, BAL.y1 + 0.5 - BAL.y0, WT, { course: 1.8 });
        f.arch(0, BAL.y1 - BAL.half * 1.25, WM, BAL.half * 2, { pointed: true, t: 0.6, depth: WT + 0.2, spandrel: true, spandrelH: 0.3, c: 'edge', fill: 'stone' });
        f.masonry(0, BAL.y1 + 0.5, WM, gateHalf * 2 + 0.4, envTop - BAL.y1 - 0.5, WT, { course: 1.8 });
      } else {
        f.masonry(0, bed - 0.02, WM, gateHalf * 2 + 0.4, envTop - bed + 0.02, WT, { course: 1.8 });
      }
      f.arch(0, spring, WO + 0.2, gateHalf * 2 + 0.3, { pointed: true, t: 1.1, depth: 0.4, c: 'edge', key: 'edge' });
      if (fine) {
        for (const h of [KEEP.floors[0] - 1.2, KEEP.floors[1] - 1.2]) f.slab(0, ground + h, WO + 0.1, SPAN * 2, 0.32, 0.3, 'edge');
        // a lancet pair to each storey, lit where someone keeps a lamp
        for (const [y, h, lit] of [[ground + 7.5, 4.8, false], [f1 + 4, 4.6, true], [f2 + 4.6, 4.2, true]]) {
          for (const x of [-6.4, 6.4]) f.window(x, y, WO + 0.01, 1.0, h, { pointed: true, lit: lit && hash3(x, y, face.charCodeAt(0)) < 0.4, strength: 0.6 });
        }
        for (let i = 0; i < 9; i++) f.ramp(-SPAN + 1.1 + (i * (SPAN * 2 - 2.2)) / 8, envTop - 1.5, WO + 0.3, 0.6, 1.4, 0.6, 'edge', BRACKET_OUT);
      }
      // the roof's parapet: a coped breast wall with merlons
      const [a, b] = PARAPET;
      f.slab((a + b) / 2, envTop, WM + 0.3, b - a, 0.35, WT + 0.6, 'edge');
      f.slab((a + b) / 2, envTop + 0.35, WO + 0.15, b - a, 1.0, 0.7, 'stone');
      if (fine) f.crenels(a + 0.5, WO + 0.15, b - 0.5, WO + 0.15, envTop + 1.35, 0.7, { c: 'stone', h: 0.9 });
    });
    // Colliders in world axes: two side runs, the vault's haunches and the wall above it.
    const ax = Math.cos(F.ry), az = -Math.sin(F.ry);
    const box = (u, along, y0, y1, depth = WT, off = WM) => {
      const x = CX + ax * u + F.x * off, z = CZ + az * u + F.z * off;
      const ns = face === 'n' || face === 's';
      solid(world, x, z, ns ? along : depth, ns ? depth : along, y0, y1);
    };
    for (const sx of [-1, 1]) box(sx * (gateHalf + SPAN) / 2, SPAN - gateHalf, ground - 1, envTop);
    if (balcony) {
      box(0, gateHalf * 2, spring + apex * 0.7, BAL.y0);
      for (const sx of [-1, 1]) box(sx * (BAL.half + (gateHalf - BAL.half) / 2), gateHalf - BAL.half, BAL.y0, BAL.y1 + 0.5);
      box(0, gateHalf * 2, BAL.y1, envTop);
    } else box(0, gateHalf * 2, spring + apex * 0.7, envTop);
    {
      const [a, b] = PARAPET;
      box((a + b) / 2, b - a, envTop, envTop + 0.35, WT + 0.6, WM + 0.3);
      box((a + b) / 2, b - a, envTop + 0.35, envTop + 1.35, 0.7, WO + 0.15);
    }
  }

  // ---- floors: the guardroom at f1, the archive at f2 and the roof at envTop
  // Laid in flags on beams, round the spine and the corner piers. Hatches stay open where the
  // climb comes up the spine and over each stair.
  const STAIR_A = { x0: -10, z: 9.6, w: 2.2, n: 40 }; // dais (pTop) -> f1, climbing toward +x
  const STAIR_B = { x: -9.6, z0: 9.4, w: 2.2, n: 49 }; // f1 -> f2, climbing toward -z
  const runA = 0.46, riseA = (f1 - pTop) / STAIR_A.n;
  const runB = 0.38, riseB = (f2 - f1) / STAIR_B.n;
  const holes = {
    f1: [[-2.6, 2.6, -6.8, -3.6], [STAIR_A.x0 - 0.2, STAIR_A.x0 + STAIR_A.n * runA + 0.2, STAIR_A.z - 1.3, STAIR_A.z + 1.3]],
    f2: [[3.6, 6.8, -2.6, 2.6], [STAIR_B.x - 1.3, STAIR_B.x + 1.3, STAIR_B.z0 - STAIR_B.n * runB - 0.2, STAIR_B.z0 + 0.2]],
    roof: [[-3.6, 3.6, 3.6, 6.6]],
  };
  const deck = (y, hs) => {
    const cell = 1.1, N = 24, x0 = -13.2;
    const open = (x, z) => (Math.abs(x) < H && Math.abs(z) < H) || hs.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);
    for (let j = 0; j < N; j++) {
      const z = x0 + (j + 0.5) * cell;
      let start = null;
      for (let i = 0; i <= N; i++) {
        const x = x0 + (i + 0.5) * cell;
        if (i === N || open(x, z)) {
          if (start !== null) {
            const xa = start, xb = x0 + i * cell, w = xb - xa;
            k.slab((xa + xb) / 2, y - 0.7, z, w, 0.7, cell + 0.01, hash3(xa, y, z) < 0.5 ? 'stone' : 'stone2', { grad: 0.06 });
            solid(world, CX + (xa + xb) / 2, CZ + z, w, cell + 0.01, y - 0.7, y);
            start = null;
          }
        } else if (start === null) start = x0 + i * cell;
      }
    }
    // beams under the flags, wall to spine, and corbels where they bear on the walls
    if (fine) {
      for (let z = -11.5; z <= 11.6; z += 3.3) {
        const spans = Math.abs(z) < H + 0.4 ? [[-WI, -H], [H, WI]] : [[-WI, WI]];
        for (const [a, b] of spans) {
          let xa = a;
          const cuts = hs.filter(([, , c, d]) => z > c - 0.4 && z < d + 0.4).map(([p, q]) => [Math.max(a, p), Math.min(b, q)]).filter(([p, q]) => q > p).sort((u, v) => u[0] - v[0]);
          for (const [p, q] of [...cuts, [b, b]]) {
            if (p - xa > 0.8) k.slab((xa + p) / 2, y - 1.3, z, p - xa, 0.6, 0.55, 'wood2');
            xa = Math.max(xa, q);
          }
        }
        for (const sx of [-1, 1]) k.ramp(sx * (WI - 0.45), y - 2.3, z, 0.6, 1.4, 0.9, 'edge', { rz: Math.PI, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
  };
  deck(f1, holes.f1);
  deck(f2, holes.f2);
  deck(envTop, holes.roof);
  // the roof is walked: a kerb of edge stones round its hatch
  if (fine) for (const z of [3.75, 6.45]) k.slab(0, envTop, z, 7.2, 0.2, 0.3, 'edge');

  // Stair A: from the dais up the gate hall's north side to the guardroom, on a stepped
  // stringer wall (a stair is carried, not hung), with a rail on its open side.
  for (let i = 0; i < STAIR_A.n; i++) {
    const x = STAIR_A.x0 + runA * (i + 0.5), yT = pTop + riseA * (i + 1);
    k.slab(x, yT - 0.6, STAIR_A.z, runA + 0.02, 0.6, STAIR_A.w, i % 2 ? 'stone2' : 'stone');
    solid(world, CX + x, CZ + STAIR_A.z, runA + 0.02, STAIR_A.w, yT - 0.6, yT);
  }
  for (let i = 0; i < STAIR_A.n; i += 4) {
    const x = STAIR_A.x0 + runA * (i + 2), yT = pTop + riseA * (i + 1);
    k.slab(x, pTop, STAIR_A.z + 0.2, runA * 4 + 0.02, Math.max(0.2, yT - 0.6 - pTop), STAIR_A.w - 0.6, 'stone2');
  }
  if (fine) {
    const L = STAIR_A.n * runA, ang = Math.atan2(f1 - pTop, L);
    k.at({ x: STAIR_A.x0 + L / 2, y: (pTop + f1) / 2 + 0.95, z: STAIR_A.z - STAIR_A.w / 2 + 0.06, rz: ang }, (b) => b.block(0, 0, 0, Math.hypot(L, f1 - pTop), 0.1, 0.1, 'wood'));
  }
  // Stair B: from the guardroom up its west side to the archive.
  for (let i = 0; i < STAIR_B.n; i++) {
    const z = STAIR_B.z0 - runB * (i + 0.5), yT = f1 + riseB * (i + 1);
    k.slab(STAIR_B.x, yT - 0.6, z, STAIR_B.w, 0.6, runB + 0.02, i % 2 ? 'stone2' : 'stone');
    solid(world, CX + STAIR_B.x, CZ + z, STAIR_B.w, runB + 0.02, yT - 0.6, yT);
  }
  for (let i = 0; i < STAIR_B.n; i += 4) {
    const z = STAIR_B.z0 - runB * (i + 2), yT = f1 + riseB * (i + 1);
    k.slab(STAIR_B.x - 0.2, f1, z, STAIR_B.w - 0.6, Math.max(0.2, yT - 0.6 - f1), runB * 4 + 0.02, 'stone2');
  }

  // ---- the rooms
  // Gate hall: braziers on the dais, the climb's lane open on the south face, banners down the
  // walls between the lancets.
  for (const [x, z] of [[-8.5, -8.5], [8.5, -8.5], [8.5, 6.5], [-8.5, 4]]) {
    k.prism(x, pTop, z, 0.55, 0.9, 'stone2', { sides: 8 });
    k.prism(x, pTop + 0.9, z, 0.75, 0.35, 'metal', { sides: 8, top: 1.25, layer: 'metal' });
    k.prism(x, pTop + 1.1, z, 0.5, 0.3, 'ember', { sides: 6, layer: 'glow', strength: 0.8 });
    solid(world, CX + x, CZ + z, 1.1, 1.1, pTop, pTop + 1.3);
  }
  lamp(0, pTop + 3, -6, '#ffb060', 1.4, 18);
  lamp(6, pTop + 3, 6, '#ffb060', 1.0, 14);
  if (fine) {
    for (const face of FACES) onFace(face, (f) => {
      for (const sx of [-1, 1]) f.banner(sx * 7.2, f1 - 7, WI - 0.12, 1.6, 4.6, 'cloth', { ry: Math.PI });
    });
  }
  // Guardroom (First Stair): a hearth on the west wall, the long table and its benches, the
  // racks the watch hung their arms on, casks.
  {
    const y = f1;
    k.masonry(WI - 0.7, y, -4, 1.4, 4.6, 4.4, { course: 0.6 });
    k.slab(WI - 1.42, y, -4, 0.06, 2.2, 2.6, 'dark', { grad: 0 });
    k.slab(WI - 1.6, y, -4, 0.5, 0.3, 2.2, 'ember', { layer: 'glow', strength: 0.65 });
    k.slab(WI - 0.8, y + 4.6, -4, 1.8, 0.35, 5, 'edge');
    solid(world, CX + WI - 0.7, CZ - 4, 1.4, 4.4, y, y + 4.6);
    lamp(WI - 2.5, y + 1.2, -4, '#ff9a52', 1.6, 12);
    // table and benches along the room's east half
    for (const z of [-9.5, -6.5]) k.slab(-6, y, z, 6, 0.5, 0.6, 'wood2');
    k.slab(-6, y + 0.8, -8, 6.4, 0.14, 1.6, 'wood');
    for (const x of [-8.8, -3.2]) for (const z of [-8.6, -7.4]) k.slab(x, y, z, 0.18, 0.8, 0.18, 'wood2');
    solid(world, CX - 6, CZ - 8, 6.4, 1.6, y, y + 0.94);
    if (fine) {
      // arms racks against the south wall
      for (const x of [-11, 6, 10]) {
        k.slab(x, y, -WI + 0.5, 1.8, 0.2, 0.6, 'wood2');
        k.slab(x, y + 1.9, -WI + 0.5, 1.8, 0.12, 0.6, 'wood2');
        for (const sx of [-0.8, 0.8]) k.slab(x + sx, y, -WI + 0.5, 0.12, 2.1, 0.12, 'wood2');
        for (let s = 0; s < 4; s++) k.slab(x - 0.6 + s * 0.4, y + 0.2, -WI + 0.6, 0.06, 2.6, 0.06, 'metal', { layer: 'metal', rz: 0.08 });
      }
      for (const [x, z] of [[10.6, 4.6], [10.6, 6.4], [9.6, 5.5]]) k.prism(x, y, z, 0.48, 1.0, 'wood', { sides: 8 });
    }
    lamp(-6, y + 3, -6, '#e8a860', 1.0, 13);
  }
  // Archive (Second Stair): presses of records down the walls, a lectern by the balcony door,
  // the reading table under a hanging lamp.
  {
    const y = f2;
    const press = (x, z, ry) => k.at({ x, y, z, ry }, (b) => {
      b.slab(0, 0, 0, 3.2, 3.4, 0.7, 'wood2');
      if (fine) for (let r = 0; r < 4; r++) {
        b.slab(0, 0.35 + r * 0.8, 0.36, 3.0, 0.08, 0.05, 'wood');
        for (let i = 0; i < 9; i++) b.slab(-1.35 + i * 0.33, 0.43 + r * 0.8, 0.3, 0.24, 0.55 - (i % 3) * 0.08, 0.3, i % 4 ? 'leather' : 'paper');
      }
    });
    // two presses side by side down the west wall, flush (a slot between them once read as a gap)
    for (const z of [-10, -6.8]) { press(-WI + 0.4, z, Math.PI / 2); solid(world, CX - WI + 0.4, CZ + z, 0.7, 3.2, y, y + 3.4); }
    for (const x of [-6, 6, 10]) { press(x, -WI + 0.4, 0); solid(world, CX + x, CZ - WI + 0.4, 3.2, 0.7, y, y + 3.4); }
    for (const x of [-6, 0]) { press(x, WI - 0.4, Math.PI); solid(world, CX + x, CZ + WI - 0.4, 3.2, 0.7, y, y + 3.4); }
    k.slab(-2, y, -7.5, 4.2, 0.85, 1.4, 'wood2');
    k.slab(-2, y + 0.85, -7.5, 4.4, 0.1, 1.6, 'wood');
    solid(world, CX - 2, CZ - 7.5, 4.4, 1.6, y, y + 0.95);
    k.lantern(-2, y + 3.6, -7.5, { post: 0, strength: 1.0 });
    k.slab(-2, y + 4.3, -7.5, 0.06, envTop - 0.7 - (y + 4.3), 0.06, 'metal', { layer: 'metal' });
    k.prism(11.2, y, 2.8, 0.4, 1.1, 'stone2', { sides: 6 });
    k.slab(11.2, y + 1.1, 2.8, 0.9, 0.08, 0.7, 'wood', { rz: 0.25 });
    lamp(-2, y + 3, -7.5, '#e8b878', 1.1, 14);
    lamp(6, y + 3, 6, '#e8b878', 0.8, 12);
    // the balcony: a corbelled platform outside the west door, with its parapet
    onFace(BAL.face, (f) => {
      f.slab(0, BAL.y0 - 0.6, WO + 1.3, BAL.half * 2 + 2.4, 0.6, 2.6, 'stone2');
      if (fine) for (const sx of [-1, 0, 1]) f.ramp(sx * 1.6, BAL.y0 - 2.6, WO + 1.3, 0.7, 2.0, 2.4, 'edge', { ...BRACKET, ry: Math.PI });
      for (const [x, z, w, d] of [[0, WO + 2.4, BAL.half * 2 + 2.4, 0.4], [-(BAL.half + 1.0), WO + 1.3, 0.4, 2.6], [BAL.half + 1.0, WO + 1.3, 0.4, 2.6]]) f.slab(x, BAL.y0, z, w, 1.05, d, 'stone');
    });
    solid(world, CX + WO + 1.3, CZ, 2.6, BAL.half * 2 + 2.4, BAL.y0 - 0.6, BAL.y0);
    solid(world, CX + WO + 2.4, CZ, 0.4, BAL.half * 2 + 2.4, BAL.y0, BAL.y0 + 1.05);
    for (const sz of [-1, 1]) solid(world, CX + WO + 1.3, CZ + sz * (BAL.half + 1.0), 2.6, 0.4, BAL.y0, BAL.y0 + 1.05);
  }

  // Four halls stand in the citadel's quarters, clear of the street through the keep, the lift
  // towers and the processional stair: the guardhouse by the east gate, the archive's annex by
  // the west, and behind the keep the restorers' house and the chapter hall.
  function range(x, z, w, d, h, roof, roofH) {
    const [bottom] = groundRange(world.terrain, CX + x, CZ + z, w + 1, d + 1, 0, 4);
    k.footing(x, z, w + 0.6, d + 0.6, ground + 0.4, bottom - 1, 'stone2');
    k.masonry(x, ground + 0.4, z, w, h - 0.4, d, { course: 1.4 });
    k.cornice(x, ground + h - 0.48, z, w, d, 'edge');
    k.slab(x, ground + h, z, w + 0.7, 0.55, d + 0.7, 'dark');
    k.roof(roof, x, ground + h + 0.55, z, w, d, roofH, { c: 'roof' });
    solid(world, CX + x, CZ + z, w, d, bottom - 1, ground + h + 0.55);
    for (const side of [-1, 1]) {
      for (let u = -w / 2 + 2.4; u < w / 2 - 1.5; u += 4.2) {
        for (let y = 5; y < h - 2; y += 6) {
          k.window(x + u, ground + y, z + side * (d / 2 + 0.02), 0.9, 2.6,
            { ry: side < 0 ? Math.PI : 0, pointed: true, lit: hash3(u, y, x) < 0.25, strength: 0.6 });
        }
        k.buttress(x + u, ground + 0.4, z + side * d / 2, h * 0.6,
          { ry: side < 0 ? Math.PI : 0, w: 0.75, depth: 0.7, stages: 2 });
      }
      k.slab(x, ground + 10, z + side * (d / 2 + 0.04), w, 0.3, 0.22, 'edge');
    }
    // a door on the side facing the keep
    const door = z < 0 ? 1 : -1;
    k.slab(x, ground + 0.4, z + door * (d / 2 + 0.03), 2.0, 2.9, 0.1, 'dark', { grad: 0 });
    k.arch(x, ground + 3.3, z + door * (d / 2 + 0.06), 2.2, { t: 0.35, depth: 0.25, rise: 0.8, c: 'edge', segments: 6 });
    exclusions.push({ x: CX + x, z: CZ + z, r: Math.hypot(w, d) / 2 + 1 });
  }
  range(-38, -6, 20, 10, 15, 'hip', 4.5);
  range(38, -6, 20, 10, 16, 'hip', 4.5);
  range(-37, 31, 20, 10, 17, 'gable', 5);
  range(37, 31, 20, 10, 15, 'gable', 5);

  // ------------------------------------------------------------ the corner piers
  const pylonH = top - ground + 10;
  const aTop = ground + pylonH * 0.44;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const bTop = ground + (sx < 0 ? (sz < 0 ? 88 : 76) : (sz < 0 ? 70 : 62));
    const px = sx * 12.4;
    const pz = sz * 12.4;
    // Stage A: battered, buttressed, lancets on the two outward faces.
    k.slab(px, ground + 0.4, pz, 6.2, 1.4, 6.2, 'stone2');
    k.masonry(px, ground + 1.8, pz, 5.2, aTop - 0.48 - (ground + 1.8), 5.2, { course: 1.8 });
    k.cornice(px, aTop - 0.48, pz, 5.2, 5.2, 'edge');
    if (fine) {
      for (let y = ground + 10.8; y < aTop - 4; y += 9) k.slab(px, y, pz, 5.5, 0.3, 5.5, 'edge');
      for (const [fx, fz] of [[sx, 0], [0, sz]]) {
        const ry = Math.atan2(fx, fz);
        for (let y = ground + 13.4; y < aTop - 7; y += 9) {
          k.window(px + fx * 2.6, y, pz + fz * 2.6, 0.8, 2.6, { ry, pointed: true, lit: hash3(px, y, fx) < 0.18, strength: 0.6 });
        }
        k.buttress(px + fx * 2.6, ground + 1.8, pz + fz * 2.6, 9, { ry, w: 1.1, depth: 1.5, stages: 2 });
      }
    }
    k.buttress(px + sx * 2.6, ground + 0.4, pz + sz * 2.6, 15, { ry: Math.atan2(sx, sz), w: 1.3, depth: 2.2, stages: 3 });
    // Broad upper towers step back from the same grounded piers. Their varied
    // heights form a roofline that climbs toward the central summit.
    k.tower(px, aTop, pz, 4.8, bTop - aTop, {
      setbacks: [0.65], taper: 0.9, roof: sx < 0 && sz > 0 ? 'dome' : 'hip',
      roofH: sx < 0 ? 6 : 4, lit: sx < 0, pointed: true, glow: '#c9a26c',
    });
    solid(world, CX + px, CZ + pz, 5.0, 5.0, ground - 1, aTop);
    solid(world, CX + px, CZ + pz, 4.8, 4.8, aTop, bTop);
    // a flying buttress over the roof, pier to spine
    k.flyer([sx * 10.7, ground + 56, sz * 10.7], [sx * H, ground + 62, sz * H], { t: 1.0, w: 1.0 });
  }

  // The old suspended castle's halls stand on the keep's two walls along x, over the roof: the
  // narrow one on -z, the arcaded one on +z beside the lift tower.
  for (const [z, hallTop, arcade] of [[-12.4, 70, false], [12.4, 62, true]]) {
    const width = arcade ? 20 : 15, depth = 4.2, base = envTop;
    const bed = arcade ? base + 10 : base;
    if (arcade) {
      for (const x of [-9.2, 0, 9.2]) {
        k.pier(x, base, z, 1.1, 10, { d: depth, c: 'stone' });
        solid(world, CX + x, CZ + z, 1.1, depth, base, bed);
      }
      for (const x of [-4.6, 4.6]) {
        k.arch(x, base + 6, z, 8.1, { t: 0.65, depth, rise: 3.3, c: 'edge', spandrel: true });
      }
      solid(world, CX, CZ + z, width, depth, base + 9.3, bed);
    }
    k.masonry(0, bed, z, width, ground + hallTop - bed, depth, { course: 1.5 });
    solid(world, CX, CZ + z, width, depth, bed, ground + hallTop);
    k.cornice(0, ground + hallTop - 0.48, z, width, depth, 'edge');
    k.roof('gable', 0, ground + hallTop, z, depth, width, 4.5, { ry: Math.PI / 2, c: 'roof' });
    for (const face of [-1, 1]) for (const x of arcade ? [-6.4, -2.1, 2.1, 6.4] : [-5.2, -1.7, 1.7, 5.2]) {
      for (let y = bed + 2; y < ground + hallTop - 2; y += 6) {
        k.window(x, y, z + face * (depth / 2 + 0.02), 0.85, 2.5,
          { ry: face < 0 ? Math.PI : 0, pointed: true, lit: hash3(x, y, z) < 0.22, strength: 0.6 });
      }
    }
  }

  // ------------------------------------------------------------ core shaft
  // Laid straight, then turned: above the keep the spine twists a little as it climbs.
  const spineWarp = { twist: 0.05, from: envTop, to: top, center: [0, 0], ease: 1.4 };
  k.warp(spineWarp, () => {
    k.masonry(0, pTop, 0, H * 2, top - 2.2 - pTop, H * 2, { course: 1.8, inset: 0.05 });
    if (fine) {
      // Quoins: long-and-short corner stones give the shaft its vertical rhythm.
      for (let y = pTop, i = 0; y < top - 3; y += 0.9, i++) {
        const long = i % 2 === 0;
        for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          k.slab(qx * (H - (long ? 0.55 : 0.35)) + qx * 0.06, y, qz * (H - (long ? 0.35 : 0.55)) + qz * 0.06, long ? 1.1 : 0.7, 0.86, long ? 0.7 : 1.1, 'edge');
        }
      }
    }
    for (const h of [16, 32, 48, 64, 80, 96]) k.slab(0, ground + h - 1.25, 0, H * 2 + 0.36, 0.32, H * 2 + 0.36, 'edge');
  });
  solid(world, CX, CZ, H * 2, H * 2, ground - 1, top - 0.15);

  // Windows on the faces nothing else is using in each band: dark slits low down, a few of the
  // high ones lit softly (no lamp burns at full strength under the daylight).
  const bandH = [3.8, 16, 32, 48, 64, 80, 96, 112];
  const bandClimb = ['n', 'e', 's', 'w', 'n', 'e', 'e'];
  const landFace = ['n', 'e', 's', 'w', 'n', 'e'];
  k.warp(spineWarp, () => {
    for (let b = 3; b < 7; b++) {
      const used = new Set([bandClimb[b], landFace[b - 1], landFace[b]]);
      const y0 = ground + bandH[b], y1 = ground + bandH[b + 1];
      for (const face of FACES) {
        if (used.has(face)) continue;
        const lit = b >= 4 && hash3(b, face.charCodeAt(0), 3) < 0.4;
        onFace(face, (f) => f.window(0, y0 + (y1 - y0) * 0.36, H, 0.8, 3.0, { pointed: true, lit, strength: 0.55 }));
      }
    }
  });

  // ------------------------------------------------------------ the high landings
  // A gallery of stone: flags on a slab, a corbel table under its outer edge, deep brackets into
  // the spine and, where there is something below to stand on, piers; a parapet round its open
  // sides and a slate pentice over the spine's face.
  function gallery(id, o) {
    const tier = SPIRE_TIER[id];
    const y = yOf(tier);
    const face = tier.climb;
    const c = Math.hypot(tier.x - CX, tier.z - CZ);
    const lat = o.lat, depth = o.depth;
    const outer = c + depth / 2, inner = H;
    onFace(face, (f) => {
      f.slab(0, y - 0.5, (inner + outer) / 2, lat, 0.5, outer - inner, 'stone');
      f.slab(0, y - 1.3, (inner + outer) / 2, lat + 0.3, 0.8, outer - inner + 0.3, 'stone2');
      if (fine) {
        for (let u = -lat / 2 + 0.7; u < lat / 2; u += 1.4) f.slab(u, y - 0.04, (inner + outer) / 2, 1.3, 0.06, outer - inner - 0.3, hash3(u, y, 1) < 0.5 ? 'stone2' : 'edge', { grad: 0.04 });
        for (let i = 0; i < Math.round(lat / 1.4); i++) f.ramp(-lat / 2 + 0.7 + i * 1.4, y - 2.5, outer - 0.4, 0.6, 1.2, 0.8, 'edge', BRACKET);
      }
      for (const bx of [-lat / 2 + 1.2, lat / 2 - 1.2]) f.ramp(bx, y - 1.3 - 6, (inner + outer) / 2, 1.2, 6, outer - inner, 'stone2', BRACKET);
      for (const [px, pz, base] of o.piers || []) f.pier(px, base, pz, 1.4, y - 1.3 - base, { c: 'stone' });
      if (o.piers && o.piers.length === 2) {
        const [[ax, az, ab], [bx]] = o.piers;
        f.arch((ax + bx) / 2, Math.max(ab + 3, y - 5.2), az, Math.abs(bx - ax) - 1.4, { t: 0.7, depth: 1.4, rise: 2.4, spandrel: true, spandrelH: 0.3, c: 'edge', fill: 'stone' });
      }
      // parapet on the three open sides
      f.slab(0, y, outer - 0.25, lat, 1.05, 0.5, 'stone');
      for (const side of [-1, 1]) f.slab(side * (lat / 2 - 0.25), y, (inner + 0.3 + outer) / 2, 0.5, 1.05, outer - inner - 0.3, 'stone');
      // the pentice over the spine's face, on two posts
      if (o.pentice !== false) {
        for (const sx of [-1, 1]) f.slab(sx * (lat / 2 - 0.6), y, inner + 2.6, 0.35, 3.6, 0.35, 'wood2');
        f.slab(0, y + 3.6, inner + 1.4, lat - 0.6, 0.2, 2.8, 'wood2');
        f.wedge(0, y + 3.8, inner + 1.5, lat, 0.9, 3.2, 'roof');
      }
      if (o.dress) o.dress(f, y, inner, outer, lat);
      const flame = f.lantern(lat / 2 - 0.9, y, outer - 1.0, { post: 2.2, metal: 'metal', strength: 1.1 });
      world.addLight(flame.add(new THREE.Vector3(CX, 0, CZ)), '#e8b070', 1.2, 14, true, 0.8);
    });
    // colliders: floor, parapets and piers in world axes
    const F = FACE[face];
    const ns = face === 'n' || face === 's';
    const mid = (inner + outer) / 2;
    const at = (u, v) => [CX + F.x * v + (ns ? u * (face === 'n' ? -1 : 1) : 0), CZ + F.z * v + (ns ? 0 : u * (face === 'e' ? -1 : 1))];
    const box = (u, v, wu, wv, y0, y1) => {
      const [x, z] = at(u, v);
      solid(world, x, z, ns ? wu : wv, ns ? wv : wu, y0, y1);
    };
    box(0, mid, lat, outer - inner, y - 1.3, y);
    box(0, outer - 0.25, lat, 0.5, y, y + 1.05);
    for (const side of [-1, 1]) box(side * (lat / 2 - 0.25), (inner + 0.3 + outer) / 2, 0.5, outer - inner - 0.3, y, y + 1.05);
    for (const [px, pz, base] of o.piers || []) box(px, pz, 1.4, 1.4, base, y - 1.3);
    return { y, inner, outer, lat };
  }
  // The Hanging Keep (t4): the gallery before its old door, standing on two piers on the roof.
  gallery('t4', {
    lat: 12, depth: 14, piers: [[-4.5, 12, envTop], [4.5, 12, envTop]],
    dress: (f, y, inner, outer) => {
      for (const sx of [-1, 1]) {
        f.prism(sx * 4, y, outer - 2.6, 0.55, 0.9, 'stone2', { sides: 8 });
        f.prism(sx * 4, y + 0.9, outer - 2.6, 0.75, 0.35, 'metal', { sides: 8, top: 1.25, layer: 'metal' });
        f.prism(sx * 4, y + 1.1, outer - 2.6, 0.5, 0.3, 'ember', { sides: 6, layer: 'glow', strength: 0.75 });
      }
    },
  });
  // The Thin Stair (t5): the old lift hall over the -z hall, its piers standing on the hall's
  // wall, closed all round by its parapet now that no lift stops there.
  gallery('t5', {
    lat: 20, depth: 8.8, pentice: false, piers: [[-5, 11.6, ground + 70], [5, 11.6, ground + 70]],
    dress: (f, y, inner, outer) => {
      // a roof on four piers over the middle of the hall, its gable to the open side
      for (const [x, z] of [[-6.6, inner + 0.6], [6.6, inner + 0.6], [-6.6, outer - 1.2], [6.6, outer - 1.2]]) f.pier(x, y, z, 0.8, 4.6, { c: 'stone' });
      f.slab(0, y + 4.6, (inner + outer) / 2 - 0.3, 14, 0.4, outer - inner - 0.6, 'edge');
      f.roof('gable', 0, y + 5.0, (inner + outer) / 2 - 0.3, 13.6, outer - inner - 1, 2.6, { c: 'roof', overhang: 0.4 });
    },
  });
  // The Last Stair (t6): a gallery on the spine's west face under a slate pentice.
  gallery('t6', { lat: 12, depth: 8.8 });

  // The Hanging Keep: a door into the spine and the keep's banners over it.
  const keepY = yOf('t4');
  onFace('w', (f) => {
    f.slab(0, keepY, H, 3.4, 4.4, 0.14, 'dark', { grad: 0 });
    f.slab(-2.1, keepY, H + 0.2, 0.8, 4.8, 0.45, 'edge');
    f.slab(2.1, keepY, H + 0.2, 0.8, 4.8, 0.45, 'edge');
    f.arch(0, keepY + 4.8, H + 0.2, 3.4, { pointed: true, t: 0.6, depth: 0.45, spandrel: true, spandrelH: 0.3, c: 'edge', fill: 'stone' });
    if (fine) {
      f.banner(-1.4, keepY + 7.2, H + 0.12, 1.2, 4.2, 'cloth');
      f.banner(1.4, keepY + 7.2, H + 0.12, 1.2, 4.2, 'cloth');
    }
  });

  // ------------------------------------------------------------ ledges and chimneys
  function addLedge(face, y, extra = 0) {
    const dist = H + 0.85 + extra;
    const fromWall = extra < 0.5;
    // a ledge on brackets from the spine reaches back to it (one set a little off it once hung
    // clear of the wall); one standing out on the far side of a chimney keeps its own depth
    const inner = fromWall ? H : dist - 0.85, outer = dist + 0.85, mid = (inner + outer) / 2, depth = outer - inner;
    const { x, z } = facePos(face, mid);
    onFace(face, (fr) => {
      fr.slab(0, y - 0.3, mid, 3.4, 0.62, depth, 'edge');
      for (const bx of [-1.1, 1.1]) {
        fr.ramp(bx, y - 1.3, dist, 0.45, 1.0, 1.6, 'stone2', fromWall ? BRACKET : { ...BRACKET, ry: Math.PI });
      }
    });
    const ns = face === 'n' || face === 's';
    solid(world, x, z, ns ? 3.4 : depth, ns ? depth : 3.4, y - 0.3, y + 0.32);
  }

  function handholds(face, y0, y1) {
    if (!fine) return;
    onFace(face, (f) => {
      let i = 0;
      for (let y = y0 + 1.0; y < y1 - 0.6; y += 0.85, i++) {
        const x = (i % 2 ? -0.62 : 0.62) + (hash3(y, i, face.charCodeAt(0)) - 0.5) * 0.3;
        f.slab(x, y, H + 0.09, 0.55, 0.2, 0.2, 'edge');
      }
      for (const sx of [-2.1, 2.1]) f.slab(sx, y0, H + 0.06, 0.4, y1 - y0 - 1.4, 0.14, 'stone2');
    });
  }

  function climbRun(fromId, toId, face) {
    const y0 = yOf(fromId);
    const y1 = yOf(toId);
    addLedge(face, y0 + 7.2);
    handholds(face, Math.max(y0, pTop), y1);
  }

  climbRun('base', 't1', 'n');
  climbRun('t1', 't2', 'e');
  climbRun('t3', 't4', 'w');
  climbRun('t4', 't5', 'n');
  climbRun('t6', 'summit', 'e');

  // Chimney: a rib wall standing off the shaft, carrying nothing; the two close faces make
  // wall-jumping the intended tool. Inside the keep it stands on the archive's floor; outside,
  // on corbels and an arch out of the spine.
  function chimney(fromId, toId, face, onFloor) {
    const y0 = yOf(fromId);
    const y1 = yOf(toId);
    const { x, z } = facePos(face, H + 3.4);
    const w = face === 'n' || face === 's' ? 7.2 : 0.7;
    const d = face === 'e' || face === 'w' ? 7.2 : 0.7;
    onFace(face, (f) => {
      f.masonry(0, y0 + 0.2, H + 3.4, 7.2, y1 - 0.1 - (y0 + 0.2), 0.7, { course: 1.8 });
      if (fine) for (const px of [-2.4, 0, 2.4]) f.slab(px, y0 + 0.2, H + 3.85, 0.6, y1 - 0.1 - (y0 + 0.2), 0.2, 'edge');
      if (!onFloor) {
        for (const bx of [-3.25, 3.25]) f.ramp(bx, y0 - 4.2, H + 1.9, 0.7, 4.4, 3.8, 'stone2', BRACKET);
        f.arch(0, y0 - 2.6, H + 3.4, 5.8, { t: 0.7, depth: 0.7, spandrel: true, spandrelH: 0.1, c: 'edge', fill: 'stone' });
      } else f.slab(0, y0, H + 3.4, 7.4, 0.2, 0.9, 'stone2');
    });
    solid(world, x, z, w, d, y0 + 0.2, y1 - 0.1);
    addLedge(face, y0 + 7.2, 0.15);
    addLedge(face, y0 + 11.4, 1.55);
    // Opposite-wall nubs on the shaft for the return jump.
    addLedge(face, y0 + 4.8);
  }
  chimney('t2', 't3', 's', true);
  chimney('t5', 't6', 'e', false);

  // ------------------------------------------------------------ the summit
  // The crown: an octagonal platform on a corbel table round the spine's head, a parapet with
  // four pinnacled turrets and braziers at their feet, and the Wound's arch at its heart facing
  // the arrival shelf, under the shaft's daylight. Open where the lift's bridge comes in (+z)
  // and where the climb comes up the +x face.
  const CROWN_R = 10;
  const CR = CROWN_R / Math.cos(Math.PI / 8);
  k.prism(0, top - 1.1, 0, CR, 1.1, 'stone', { sides: 8 });
  k.prism(0, top - 4.2, 0, CR * 0.5, 3.1, 'stone2', { sides: 8, top: 1.96 });
  if (fine) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = Math.cos(a) * (CROWN_R - 0.6), z = Math.sin(a) * (CROWN_R - 0.6);
      if (x > 3 && Math.abs(z) < 2.4) continue;
      k.at({ x, y: top - 3.0, z, ry: Math.atan2(x, z) }, (b) => b.ramp(0, 0, -0.4, 0.7, 1.9, 1.4, 'edge', BRACKET));
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      k.slab(Math.cos(a) * 6.2, top - 0.04, Math.sin(a) * 6.2, 1.6, 0.06, 2.6, i % 2 ? 'stone2' : 'edge', { ry: Math.PI / 2 - a, grad: 0.04 });
    }
  }
  // the deck's collider: an octagon as two squares
  solid(world, CX, CZ, CROWN_R * 1.66, CROWN_R * 1.66, top - 1.1, top);
  solid(world, CX, CZ, CROWN_R * 1.66, CROWN_R * 1.66, top - 1.1, top, { rot: Math.PI / 4 });
  // parapet round the edge, open at the lift's bridge and at the climb
  const bridgeA = Math.atan2(8.5, 4.6);
  const openAt = (x, z) => (x > 0 && Math.abs(z) < 3.2) || Math.abs(((Math.atan2(z, x) - bridgeA + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.24;
  for (let i = 0; i < 32; i++) {
    const am = ((i + 0.5) / 32) * Math.PI * 2;
    const r = CROWN_R - 0.35;
    const x = Math.cos(am) * r, z = Math.sin(am) * r;
    if (openAt(x, z)) continue;
    const len = 2 * r * Math.sin(Math.PI / 32) + 0.08;
    k.at({ x, y: top, z, ry: Math.atan2(x, z) }, (b) => {
      b.slab(0, 0, 0, len, 1.1, 0.6, i % 2 ? 'stone' : 'stone2');
      if (fine && i % 2 === 0) b.slab(0, 1.1, 0, len * 0.9, 0.8, 0.7, 'stone');
    });
    solid(world, CX + x, CZ + z, len, 0.6, top, top + 1.1, { rot: Math.atan2(x, z) });
  }
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const x = Math.cos(a) * (CROWN_R - 1.2), z = Math.sin(a) * (CROWN_R - 1.2);
    k.pier(x, top, z, 1.6, 4.4, { c: 'stone' });
    k.pinnacle(x, top + 4.4, z, 0.75, { roof: 'roof' });
    solid(world, CX + x, CZ + z, 1.6, 1.6, top, top + 4.4);
    const bx = x * 0.74, bz = z * 0.74;
    k.prism(bx, top, bz, 0.45, 0.8, 'stone2', { sides: 8 });
    k.prism(bx, top + 0.8, bz, 0.6, 0.3, 'metal', { sides: 8, top: 1.25, layer: 'metal' });
    k.prism(bx, top + 0.95, bz, 0.4, 0.25, 'ember', { sides: 6, layer: 'glow', strength: 0.7 });
    solid(world, CX + bx, CZ + bz, 0.9, 0.9, top, top + 1.1);
  }
  // The Wound: a pointed doorway framing the portal, facing the arrival shelf.
  for (const sx of [-1, 1]) {
    k.pier(sx * 3.1, top, 0, 0.9, 8.1, { d: 1.2, c: 'stone' });
    solid(world, CX + sx * 3.1, CZ, 0.9, 1.2, top, top + 8.1);
  }
  k.arch(0, top + 8.1, 0, 7.1, { pointed: true, t: 0.8, depth: 1.2, spandrel: true, spandrelH: 0.4, c: 'edge', fill: 'stone' });
  k.pinnacle(0, top + 13.4, 0, 0.6, { roof: 'roof' });

  const portal = new THREE.Mesh(new THREE.BoxGeometry(5.2, 7.6, 0.12), pale);
  portal.position.set(0, top + 4.3, 0);
  portal.userData.dynamic = true;
  world.addLight(new THREE.Vector3(CX, top + 6, CZ), '#e0d4f4', 1.6, 24, false, 2);
  world.addLight(new THREE.Vector3(CX, top + 3, CZ + 6), '#ffb060', 1.2, 16, true, 1.2);
  world.addEmitter({ kind: 'riftmote', pos: new THREE.Vector3(CX, top + 5, CZ), rate: low ? 2 : 4, spread: 3 });
  world.addInteract({
    id: 'ascent_summit', kind: 'ascent_exit',
    pos: new THREE.Vector3(CX, top + 1.2, CZ), radius: 3.8,
    label: 'Step through the Wound',
    use: (game) => act('finishAscent', game),
  });

  const g = k.build('ascent');
  g.position.set(CX, 0, CZ);
  g.add(portal);
  const roots = [g];

  // Draughts cached on two landings, each on a stone shelf, so the climb is beatable at
  // modest Power.
  state.spirePickups = [];
  const shelves = new Kit(P, { detail: 1 });
  for (const pk of [
    { id: 'pk_ascent_t3', item: 'sanity_draught', tier: 't3', ox: -2.4, oz: 1.6 },
    { id: 'pk_ascent_t5', item: 'sanity_draught', tier: 't5', ox: 2.2, oz: -1.4 },
  ]) {
    const t = SPIRE_TIER[pk.tier];
    const y = yOf(t);
    shelves.masonry(t.x + pk.ox - CX, y, t.z + pk.oz - CZ, 0.7, 0.34, 0.7, { course: 0.17 });
    solid(world, t.x + pk.ox, t.z + pk.oz, 0.7, 0.7, y, y + 0.34);
    const pg = new THREE.Group();
    pg.userData.dynamic = true;
    pg.position.set(t.x + pk.ox, y, t.z + pk.oz);
    const vial = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), mat('#3a2a58', { emissive: '#6a4aaa', ei: 0.6 }));
    vial.position.y = 0.55;
    const stopper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), glowMat);
    stopper.position.y = 0.82;
    pg.add(vial, stopper);
    world.scene.add(pg);
    const it = world.addInteract({
      id: pk.id, kind: 'rift_pickup',
      pos: new THREE.Vector3(t.x + pk.ox, y + 0.6, t.z + pk.oz), radius: 2.0,
      label: 'Take a forgotten draught',
      enabled: () => !G.game?.ch?.flags?.[`took_${pk.id}`],
      use: () => act('takeRiftPickup', pk.id, pk.item),
    });
    state.spirePickups.push({ id: pk.id, group: pg, it });
  }
  const sg = shelves.build('ascent_shelves');
  sg.position.set(CX, 0, CZ);
  world.scene.add(sg);
  roots.push(sg);

  // Lift written sources onto their landings (landmarks placed them on the floor).
  const loreY = {
    ascent_charter: ground + 0.4,
    ascent_year57: yOf('t2'),
    ascent_keep: yOf('t4'),
    ascent_thin_air: yOf('t6'),
    ascent_summit: top,
  };
  for (const tab of world.loreTablets || []) {
    const y = loreY[tab.lore.id];
    if (y == null) continue;
    if (tab.group) tab.group.position.y = y;
    if (tab.interaction) tab.interaction.pos.y = y + 1;
  }

  world.addLight(new THREE.Vector3(CX, envTop + 3, CZ + 8), '#e8b070', 1.1, 18, true, 1.0);

  world.scene.add(g);
  mergeStatic(world.scene, roots);
  exclusions.push({ x: CX, z: CZ, r: 32 });
  state.spire = { ground, top, portal, envTop, crownR: CROWN_R };
  state.spireLore = SPIRE_LORE;
}

export function updateRiftSpire(state, dt) {
  if (!state.spire) return;
  const t = (G.world && G.world.time) || 0;
  if (state.spire.portal && state.spire.portal.material) {
    state.spire.portal.material.opacity = 0.42 + Math.sin(t * 2.4) * 0.1;
    state.spire.portal.material.emissiveIntensity = 0.75 + Math.sin(t * 1.6) * 0.15;
  }
}
