// The Ascent's stone lift: one lift tower the restorers raised against the keep's north wall
// (+z), where the walk from the arrival shelf ends. It is a masonry shaft standing on its own
// footing from the courtyard, open on its outer face so the cage and its counterweight can be
// seen working: corner piers tied by stone lintels, a back wall with a door at the summit, a
// gear housing beside it, and on top the winch-house where the drive wheel turns. It rises past
// the keep's roof to the summit and carries a climber from the courtyard to the Wound.
//
// The lift runs from the moment you arrive: a weak player must be able to leave the Rift (the
// user's call, 2026-10-15), and there is one lift, not three (2026-10-16). The plaza lever and
// the restorers' gear-train that once woke the lifts still stand, as the works they were.
// Gameplay (rides, the first-ride ambush) lives in src/game/ascentLifts.js; this module builds
// the tower and moves the cage.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit, groundRange } from './kit.js';
import { mergeStatic } from './merge.js';
import { CITY_PAL } from './riftWalls.js';
import { act } from '../game/hooks.js';
import { SPIRE, SPIRE_TIER } from '../data/riftSpire.js';
import { KEEP } from './riftSpire.js';

const P = { ...CITY_PAL, bronze: '#8a6d3c', iron: '#2e2a2c', wood: '#4a3c32' };
const SPEED = 7;
const PAD_W = 3.3;
const PAD_D = 3.1;
const PAD_H = 0.72;

// The lift stands square to the keep (ry turns its open front outward); `hand` puts its
// counterweight on the side away from the keep's gate. `decks` are the walked points past each
// stop's door, keep-relative: from the summit door over a bridge onto the crown.
export const ASCENT_LIFTS = [
  {
    id: 'ascent_lift', from: 'base', to: 'summit',
    // 0.6 m off the keep's face, so the +z arcade hall's eave and the corner tower's hip roof
    // (both overhang to about z 15.0) clear its back wall
    padOx: 8, padOz: 18.2, ry: 0, hand: 1,
    decks: { to: [[5.6, 10.2], [4.0, 7.0]] },
    label: 'the summit', downLabel: 'the courtyard',
  },
];

export const ASCENT_LIFT = Object.fromEntries(ASCENT_LIFTS.map((l) => [l.id, l]));

export function liftFlags(game = G.game) {
  if (!game || !game.ch) return {};
  game.ch.flags ||= {};
  return game.ch.flags;
}

function yOf(ground, id) {
  if (id === 'base') return ground + 0.55;
  return ground + SPIRE_TIER[id].h;
}

// Pad-local (x across the front, z outward) to world.
function toWorld(def, lx, lz) {
  const c = Math.cos(def.ry), s = Math.sin(def.ry);
  return [SPIRE.x + def.padOx + lx * c + lz * s, SPIRE.z + def.padOz - lx * s + lz * c];
}

// The shaft: piers at its four corners, the counterweight's slot on the `hand` side.
const T = { left: -3.4, right: 5.0, back: -2.9, front: 2.9, pier: 1.4 };
const CW_X = 2.8; // the counterweight rides between the cage and the far piers
const WHEEL_R = CW_X / 2;
const headY = (y1) => y1 + 3.6;
const wheelY = (y1) => headY(y1) + 2.2;

function onPad(actor, lift, prevY) {
  if (!actor || actor.dead) return false;
  const y = prevY == null ? lift.y : prevY;
  const dx = actor.pos.x - lift.x;
  const dz = actor.pos.z - lift.z;
  const c = Math.cos(lift.ry || 0), s = Math.sin(lift.ry || 0);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) < PAD_W * 0.52
    && Math.abs(lz) < PAD_D * 0.52
    && Math.abs(actor.pos.y - y) < 0.85;
}

// A box in pad-local coordinates as a world collider.
function solidLocal(world, def, lx, lz, w, d, y0, y1, tag) {
  if (!(y1 > y0)) return;
  const [x, z] = toWorld(def, lx, lz);
  world.colliders.addBox({ x, z, w, d, y0, y1, rot: def.ry, climbable: true, walkable: true, tag });
}

function buildTower(world, k, def, y0, y1, ground) {
  const h = def.hand;
  const L = h > 0 ? T.left : -T.right, R = h > 0 ? T.right : -T.left; // local x extent
  const xs = [L + T.pier / 2, R - T.pier / 2];
  const [lo] = groundRange(world.terrain, ...toWorld(def, (L + R) / 2, 0), R - L + 2, T.front - T.back + 2, def.ry, 4);
  const foot = Math.min(lo, ground) - 1.5;
  const pit = def.from === 'base' ? ground : y0 - PAD_H - 0.4; // the floor the cage rests on
  const head = headY(y1), roofY = head + 6;
  const stops = [y0, y1];
  const tag = def.id + '_tower';
  const W = R - L, D = T.front - T.back;
  const cx = (L + R) / 2, cz = (T.front + T.back) / 2;
  k.at({ x: def.padOx, z: def.padOz, ry: def.ry }, (b) => {
    // footing and, for the upper lifts, the solid tower under the shaft
    b.slab(cx, foot, cz, W + 1.2, ground + 0.4 - foot, D + 1.2, 'stone2');
    if (pit > ground + 1) {
      b.masonry(cx, ground + 0.4, cz, W, pit - ground - 0.4, D, { course: 1.8 });
      for (let y = ground + 6; y < pit - 2; y += 9) {
        b.slab(cx, y, cz, W + 0.3, 0.3, D + 0.3, 'edge');
        b.window(cx, y + 2.2, T.front + 0.01, 0.5, 2.4, { pointed: true });
      }
      b.slab(cx, pit - 0.4, cz, W + 0.5, 0.4, D + 0.5, 'edge');
    } else {
      b.slab(cx, ground + 0.4 - 0.3, cz, W, 0.3, D, 'stone2');
    }
    // the four corner piers, the full height of the shaft, and a cornice at the head
    for (const x of xs) for (const z of [T.back + T.pier / 2, T.front - T.pier / 2]) b.masonry(x, pit, z, T.pier, head - pit, T.pier, { course: 1.8 });
    // the back wall, against the keep, with a door at each stop
    const doors = def.from === 'base' ? stops.slice(1) : stops;
    let yb = pit;
    for (const s of [...doors.sort((a, c) => a - c), head]) {
      const top = s === head ? head : s;
      if (top - yb > 0.3) b.masonry(cx, yb, T.back + 0.4, W - T.pier * 2 + 0.02, top - yb, 0.8, { course: 1.8 });
      if (s !== head) {
        // a door 3 m wide: jambs to the sides of the cage's width, an arched head over it
        const jw = (W - T.pier * 2 - 3.2) / 2;
        for (const side of [-1, 1]) {
          const jx = side < 0 ? L + T.pier + jw / 2 : R - T.pier - jw / 2;
          if (jw > 0.2) b.masonry(jx, s, T.back + 0.4, jw, 3.4, 0.8, { course: 0.85 });
        }
        b.arch(0, s + 2.7, T.back + 0.4, 3.2, { t: 0.45, depth: 0.8, rise: 0.7, spandrel: true, spandrelH: 0.1, c: 'edge', fill: 'stone', segments: 6 });
        yb = s + 3.4;
      }
    }
    // the side walls, slit-lit, carrying a gear housing beside each stop
    for (const sx of [L, R]) {
      const x = sx < cx ? L + 0.4 : R - 0.4;
      b.masonry(x, pit, cz, 0.8, head - pit, D - T.pier * 2 + 0.02, { course: 1.8 });
      for (let y = pit + 5; y < head - 3; y += 9) b.window(x + (sx < cx ? -0.41 : 0.41), y, cz, 0.42, 2.4, { ry: sx < cx ? -Math.PI / 2 : Math.PI / 2, pointed: true });
    }
    for (const s of stops) {
      if (def.from === 'base' && s === y0) continue;
      const gx = h > 0 ? L - 0.7 : R + 0.7;
      b.masonry(gx, s + 0.4, T.back + 1.2, 1.4, 2.4, 1.8, { course: 0.6 });
      // stepped corbels under it, out of the side wall
      b.slab(gx + h * 0.25, s - 0.2, T.back + 1.2, 0.9, 0.6, 1.6, 'edge');
      b.slab(gx + h * 0.5, s - 0.8, T.back + 1.2, 0.4, 0.6, 1.2, 'stone2');
      b.slab(gx, s + 2.8, T.back + 1.2, 1.7, 0.3, 2.1, 'edge');
      b.prism(gx + (h > 0 ? -0.75 : 0.75), s + 1.6, T.back + 1.2, 0.85, 0.22, 'bronze', { sides: 12, rz: Math.PI / 2, layer: 'metal' });
      b.prism(gx + (h > 0 ? -0.86 : 0.86), s + 1.6, T.back + 1.2, 0.18, 0.12, 'iron', { sides: 6, rz: Math.PI / 2, layer: 'metal' });
    }
    // stone lintels tying the open front's piers, every storey
    for (let y = pit + 9; y < head - 2; y += 9) b.slab(cx, y, T.front - T.pier / 2, W - T.pier * 2 + 0.04, 0.9, T.pier - 0.2, 'stone2');
    // dark iron guide rails let into the piers' inner faces, and the counterweight's slot
    for (const x of [-PAD_W / 2 - 0.12, PAD_W / 2 + 0.12, h * (CW_X - 0.65), h * (CW_X + 0.65)]) b.slab(x, pit + 0.4, 0, 0.12, head - pit - 0.4, 0.14, 'iron', { layer: 'metal' });
    // stop sills from the cage's back to the door
    for (const s of stops) b.slab(0, s - 0.5, (-PAD_D / 2 + T.back) / 2 - 0.05, 3.2, 0.5, -PAD_D / 2 - T.back - 0.1, 'stone');
    // the winch-house: its floor over the shaft, walls opened with arches on the wheel, a roof
    b.slab(cx, head, cz, W + 0.6, 0.6, D + 0.6, 'edge');
    for (const [x, z, w, d] of [[cx, T.back + 0.3, W, 0.6], [cx, T.front - 0.3, W, 0.6], [L + 0.3, cz, 0.6, D], [R - 0.3, cz, 0.6, D]]) b.masonry(x, head + 0.6, z, w, roofY - head - 0.6, d, { course: 0.9 });
    for (const z of [T.back + 0.3, T.front - 0.3]) {
      b.slab(h * WHEEL_R, head + 1.2, z, 2.4, 3.0, 0.62, 'dark', { grad: 0 });
      b.arch(h * WHEEL_R, head + 4.2, z, 2.6, { t: 0.4, depth: 0.7, rise: 0.9, c: 'edge', segments: 6 });
    }
    b.cornice(cx, roofY - 0.3, cz, W, D, 'edge');
    b.roof('hip', cx, roofY + 0.2, cz, W, D, 3.4, { c: 'roof' });
    const lamp = b.lantern(cx, head + 0.6, T.front + 0.45, { post: 0, strength: 1.0 });
    b.slab(cx, head + 1.2, T.front + 0.2, 0.12, 0.12, 0.6, 'iron', { layer: 'metal' });
    world.addLight(lamp.add(new THREE.Vector3(SPIRE.x, 0, SPIRE.z)), '#e8b070', 0.9, 14, true, 0.5);
  });
  // colliders
  solidLocal(world, def, cx, cz, W + 1.2, D + 1.2, foot, ground + 0.4, tag);
  if (pit > ground + 1) solidLocal(world, def, cx, cz, W, D, ground, pit, tag);
  for (const x of xs) for (const z of [T.back + T.pier / 2, T.front - T.pier / 2]) solidLocal(world, def, x, z, T.pier, T.pier, pit, head, tag);
  let yb = pit;
  for (const s of [...stops.filter((q) => def.from !== 'base' || q !== y0).sort((a, c) => a - c), head]) {
    solidLocal(world, def, cx, T.back + 0.4, W - T.pier * 2, 0.8, yb, s === head ? head : s, tag);
    if (s !== head) {
      const jw = (W - T.pier * 2 - 3.2) / 2;
      for (const side of [-1, 1]) solidLocal(world, def, side < 0 ? L + T.pier + jw / 2 : R - T.pier - jw / 2, T.back + 0.4, jw, 0.8, s, s + 3.4, tag);
      solidLocal(world, def, 0, T.back + 0.4, 3.2, 0.8, s + 3.0, s + 3.4, tag);
      yb = s + 3.4;
    }
  }
  for (const x of [L + 0.4, R - 0.4]) solidLocal(world, def, x, cz, 0.8, D - T.pier * 2, pit, head, tag);
  for (const s of stops) solidLocal(world, def, 0, (-PAD_D / 2 + T.back) / 2 - 0.05, 3.2, -PAD_D / 2 - T.back - 0.1, s - 0.5, s, tag);
  solidLocal(world, def, cx, cz, W + 0.6, D + 0.6, head, roofY + 0.2, tag);
  return { head, roofY };
}

function chainKit(len) {
  const k = new Kit(P);
  // Built one unit tall from enough links for the longest run; scaled to the live length.
  const n = Math.max(8, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const y = i / n, wide = i % 2 === 0, h = 1 / n;
    for (const side of [-1, 1]) k.slab(wide ? side * 0.2 : 0, y, wide ? 0 : side * 0.2, wide ? 0.09 : 0.16, h, wide ? 0.16 : 0.09, 'iron', { layer: 'metal', jitter: 0 });
  }
  const g = k.build('lift_chain');
  g.userData.dynamic = true;
  return g;
}

function buildMechanism(def, y0, y1) {
  const span = y1 - y0 + 6;
  const chain = chainKit(span);
  const [cx, cz] = toWorld(def, 0, 0);
  chain.position.set(cx, y0 + 2.6, cz);
  const cwChain = chainKit(span);
  const [wx, wz] = toWorld(def, def.hand * CW_X, 0);
  cwChain.position.set(wx, y1, wz);
  // The drive wheel: rim, spokes and hub in the cage's plane, turning on its axle.
  const gk = new Kit(P);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    gk.block(Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, 0, 0.62, 0.28, 0.34, 'bronze', { rz: a + Math.PI / 2, layer: 'metal' });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    gk.block(0, 0, 0, WHEEL_R * 2 - 0.2, 0.16, 0.16, 'wood', { rz: a });
  }
  gk.prism(0, -0.4, 0, 0.36, 0.8, 'bronze', { sides: 8, rx: Math.PI / 2, layer: 'metal' });
  const gear = gk.build('lift_drive_wheel');
  gear.userData.dynamic = true;
  const [gx, gz] = toWorld(def, def.hand * WHEEL_R, 0);
  gear.position.set(gx, wheelY(y1), gz);
  gear.rotation.y = def.ry;
  return { chain, cwChain, gear };
}

// The cage: a stone floor with a carved edge, stone corner posts, iron grilles on its two
// sides, a stone canopy with the chain's eye, open front and back.
function buildPadGroup(def, y) {
  const k = new Kit(P, { detail: 1 });
  k.slab(0, -PAD_H, 0, PAD_W, PAD_H, PAD_D, 'stone');
  k.slab(0, -PAD_H - 0.16, 0, PAD_W + 0.28, 0.16, PAD_D + 0.28, 'edge');
  k.slab(0, -0.04, 0, PAD_W - 0.35, 0.08, PAD_D - 0.35, 'stone2');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.slab(sx * (PAD_W / 2 - 0.16), 0, sz * (PAD_D / 2 - 0.16), 0.3, 2.3, 0.3, 'stone2');
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) k.slab(sx * (PAD_W / 2 - 0.16), 0.1, -PAD_D / 2 + 0.55 + i * 0.4, 0.06, 2.1, 0.06, 'iron', { layer: 'metal' });
    for (const yy of [1.05, 2.0]) k.slab(sx * (PAD_W / 2 - 0.16), yy, 0, 0.1, 0.08, PAD_D - 0.4, 'iron', { layer: 'metal' });
  }
  k.slab(0, 2.3, 0, PAD_W + 0.2, 0.25, PAD_D + 0.2, 'edge');
  k.slab(0, 2.55, 0, 0.6, 0.14, 0.6, 'iron', { layer: 'metal' });
  const g = k.build('ascent_lift_pad');
  g.userData.dynamic = true;
  g.position.set(def.padOx + SPIRE.x, y, def.padOz + SPIRE.z);
  g.rotation.y = def.ry;
  return g;
}

// The cage's drop bar: two iron rails across its open front, down whenever the cage is off the
// courtyard stop, so a climber cannot step or be knocked out over the drop. It is lifted at
// the courtyard, where the cage is boarded from the front.
const BAR_Z = PAD_D / 2 - 0.16;
function buildBar(def, y) {
  const k = new Kit(P, { detail: 1 });
  for (const yy of [1.05, 0.5]) k.slab(0, yy, BAR_Z, PAD_W - 0.6, 0.1, 0.1, 'iron', { layer: 'metal' });
  for (const sx of [-1, 1]) k.slab(sx * (PAD_W / 2 - 0.36), 0, BAR_Z, 0.12, 1.15, 0.12, 'iron', { layer: 'metal' });
  const g = k.build('ascent_lift_bar');
  g.userData.dynamic = true;
  g.position.set(def.padOx + SPIRE.x, y, def.padOz + SPIRE.z);
  g.rotation.y = def.ry;
  return g;
}

// The cage's walls as colliders that ride with it: the two grilles, and the drop bar while it
// is down. Their heights are set each step by placeCage.
function cageColliders(world, def, y) {
  const box = (lx, lz, w, d) => {
    const [x, z] = toWorld(def, lx, lz);
    return world.colliders.addBox({ x, z, w, d, y0: y, y1: y + 2.3, rot: def.ry, climbable: false, tag: def.id + '_cage' });
  };
  return {
    sides: [-1, 1].map((sx) => box(sx * (PAD_W / 2 - 0.16), 0, 0.14, PAD_D - 0.3)),
    bar: box(0, BAR_Z, PAD_W - 0.3, 0.14),
  };
}

function placeCage(lift) {
  const up = lift.y > lift.y0 + 0.3;
  for (const c of lift.cage.sides) {
    c.y0 = lift.y;
    c.y1 = lift.y + 2.3;
  }
  // a lifted bar is parked under the courtyard's paving, out of every body's way
  lift.cage.bar.y0 = up ? lift.y : lift.y0 - 40;
  lift.cage.bar.y1 = up ? lift.y + 1.15 : lift.y0 - 39;
  lift.bar.position.y = lift.y;
  lift.bar.visible = up;
}

// A rider stays clear of the cage's walls and its lowered bar, so they never meet a collider
// rising through the body.
const ROOM_X = PAD_W / 2 - 0.16 - 0.07 - 0.42;
const ROOM_Z = BAR_Z - 0.07 - 0.42;
function keepInCage(actor, lift) {
  const c = Math.cos(lift.ry || 0), s = Math.sin(lift.ry || 0);
  const dx = actor.pos.x - lift.x, dz = actor.pos.z - lift.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const cx = Math.max(-ROOM_X, Math.min(ROOM_X, lx)), cz = Math.min(ROOM_Z, lz);
  if (cx === lx && cz === lz) return;
  actor.pos.x = lift.x + cx * c + cz * s;
  actor.pos.z = lift.z - cx * s + cz * c;
}

function buildCounterweight(def, y) {
  const k = new Kit(P, { detail: 1 });
  k.masonry(0, 0, 0, 1.1, 2.6, 1.3, { course: 0.65 });
  for (const yy of [0.35, 2.05]) k.slab(0, yy, 0, 1.2, 0.18, 1.4, 'bronze', { layer: 'metal' });
  k.slab(0, 2.6, 0, 0.5, 0.3, 0.2, 'iron', { layer: 'metal' });
  const g = k.build('ascent_lift_cw');
  g.userData.dynamic = true;
  const [x, z] = toWorld(def, def.hand * CW_X, 0);
  g.position.set(x, y, z);
  g.rotation.y = def.ry;
  return g;
}

// A short stone bridge from a stop's door to where the landing begins, on brackets at both ends
// and parapets either side. Over the keep's roof the roof itself is the way, so nothing is built.
function addBridge(world, k, ax, az, bx, bz, y, w = 2.6) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.6) return;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const ry = Math.atan2(bx - ax, bz - az);
  k.at({ x: mx - SPIRE.x, y: 0, z: mz - SPIRE.z, ry }, (b) => {
    b.slab(0, y - 0.5, 0, w, 0.5, len + 0.4, 'stone');
    b.slab(0, y - 1.3, 0, w - 0.4, 0.8, len + 0.4, 'stone2');
    for (const sz of [-1, 1]) b.ramp(0, y - 3.3, sz * (len / 2 - 0.6), w - 0.6, 2.0, Math.min(2.4, len / 2), 'edge', { rz: Math.PI, ry: sz > 0 ? Math.PI : 0 });
    for (const sx of [-1, 1]) b.slab(sx * (w / 2 - 0.2), y, 0, 0.4, 1.05, len + 0.2, 'stone');
  });
  world.colliders.addBox({ x: mx, z: mz, w, d: len + 0.4, y0: y - 1.3, y1: y, rot: ry, climbable: true, tag: 'rift_ascent' });
  for (const sx of [-1, 1]) world.colliders.addBox({ x: mx + Math.cos(ry) * sx * (w / 2 - 0.2), z: mz - Math.sin(ry) * sx * (w / 2 - 0.2), w: 0.4, d: len + 0.2, y0: y, y1: y + 1.05, rot: ry, climbable: true, tag: 'rift_ascent' });
}

// The walked points from a cage to each stop's landing: through the door, then on to the
// landing itself.
export function liftDeckRoutes(def) {
  const a = toWorld(def, 0, 0);
  const back = toWorld(def, 0, -(PAD_D / 2 + 1.6));
  const keep = (pts) => (pts || []).map(([x, z]) => [SPIRE.x + x, SPIRE.z + z]);
  return {
    from: def.from === 'base' ? [] : [a, back, ...keep(def.decks.from)],
    to: [a, back, ...keep(def.decks.to)],
  };
}

const insideKeep = (x, z) => Math.abs(x - SPIRE.x) < 14.8 && Math.abs(z - SPIRE.z) < 14.8;

export function buildAscentLifts(world, exclusions, state) {
  const low = !!(state && state.low);
  const ground = state.spire?.ground ?? world.terrain.heightAt(SPIRE.x, SPIRE.z);
  const k = new Kit(P, { detail: low ? 0 : 1 });
  const lifts = [];

  for (const def of ASCENT_LIFTS) {
    const y0 = yOf(ground, def.from);
    const y1 = yOf(ground, def.to);
    buildTower(world, k, def, y0, y1, ground);
    const padX = SPIRE.x + def.padOx;
    const padZ = SPIRE.z + def.padOz;
    const ry = def.ry;

    // Bridges from a stop's door across open air to the landing's edge. On the keep's roof the
    // roof itself is the way, so nothing is built there.
    const routes = liftDeckRoutes(def);
    for (const [end, route] of Object.entries(routes)) {
      const y = end === 'from' ? y0 : y1;
      if (route.length < 3 || Math.abs(y - (ground + KEEP.h)) < 0.5) continue;
      const [sx, sz] = toWorld(def, 0, T.back);
      const pts = [[sx, sz], ...route.slice(2)];
      let ex = sx, ez = sz, found = false;
      for (let i = 1; i < pts.length && !found; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        const L = Math.hypot(bx - ax, bz - az);
        // the threshold under the door is the tower's own: start the search just outside it
        for (let t = i === 1 ? 0.3 : 0; t <= L; t += 0.2) {
          const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L;
          if (world.colliders.groundAt(x, z, y + 0.5) > y - 0.2) { found = true; break; }
          ex = x; ez = z;
        }
      }
      addBridge(world, k, sx, sz, ex, ez, y);
    }

    // The base cage stands at the paving's height: a stone apron before its open front.
    if (def.from === 'base') {
      k.at({ x: def.padOx, z: def.padOz, ry }, (w) => {
        w.slab(0, ground - 0.8, T.front + 1.6, PAD_W + 3.0, 1.2, 3.2, 'stone2');
        w.slab(0, ground + 0.32, T.front + 1.6, PAD_W + 3.2, 0.08, 3.4, 'edge');
      });
      const [ax, az] = toWorld(def, 0, T.front + 1.6);
      world.colliders.addBox({ x: ax, z: az, w: PAD_W + 3.0, d: 3.2, y0: ground - 0.8, y1: ground + 0.4, rot: ry, climbable: true, walkable: true });
    }
    const pad = buildPadGroup(def, y0);
    const bar = buildBar(def, y0);
    const cage = cageColliders(world, def, y0);
    const cw = buildCounterweight(def, y1);
    const { chain, cwChain, gear } = buildMechanism(def, y0, y1);
    world.scene.add(pad, bar, cw, chain, cwChain, gear);
    const col = world.colliders.addBox({
      x: padX, z: padZ, w: PAD_W, d: PAD_D, y0: y0 - PAD_H, y1: y0,
      rot: ry, climbable: true, walkable: true, tag: def.id,
    });

    const ride = world.addInteract({
      id: def.id, kind: 'ascent_lift',
      pos: new THREE.Vector3(padX, y0 + 1.0, padZ), radius: 2.3,
      label: `Ride the stone lift up to ${def.label}`,
      enabled: () => false,
      use: () => act('rideAscentLift', def.id),
    });
    const callAt = (end, y) => {
      const r = routes[end];
      const p = r.length ? r[r.length - 1] : toWorld(def, 0, T.front + 1.8);
      return new THREE.Vector3(p[0], y + 1.1, p[1]);
    };
    const callA = world.addInteract({
      id: `${def.id}_call_a`, kind: 'ascent_lift_call',
      pos: callAt('from', y0), radius: 2.6,
      label: 'Call the stone lift',
      enabled: () => false,
      use: () => act('callAscentLift', def.id, def.from),
    });
    const callB = world.addInteract({
      id: `${def.id}_call_b`, kind: 'ascent_lift_call',
      pos: callAt('to', y1), radius: 2.6,
      label: 'Call the stone lift',
      enabled: () => false,
      use: () => act('callAscentLift', def.id, def.to),
    });

    lifts.push({
      def, x: padX, z: padZ, y: y0, y0, y1, dest: y0, moving: false,
      pad, bar, cage, cw, col, ride, callA, callB, ry, ground,
      ambushed: false, chain, cwChain, gear,
    });
    const [ex, ez] = toWorld(def, 0, 0);
    exclusions.push({ x: ex, z: ez, r: 7 });
  }

  // The plaza lever that once woke the lifts, beside the tower's open front.
  const lever = toWorld(ASCENT_LIFT.ascent_lift, T.left - 1.8, T.front + 2.4);
  k.at({ x: lever[0] - SPIRE.x, z: lever[1] - SPIRE.z }, (w) => {
    w.slab(0, ground + 0.4, 0, 1.3, 0.35, 1.3, 'stone2');
    w.prism(0, ground + 0.75, 0, 0.18, 1.15, 'iron', { sides: 6, layer: 'metal' });
    w.slab(0.35, ground + 1.85, 0, 0.7, 0.14, 0.18, 'iron', { layer: 'metal', rz: -0.4 });
    w.slab(0, ground + 1.3, 0.24, 0.16, 0.16, 0.06, 'bronze', { layer: 'metal' });
  });
  world.colliders.addBox({ x: lever[0], z: lever[1], w: 1.3, d: 1.3, y0: ground - 0.5, y1: ground + 0.75, climbable: true });

  // The restorers' gear-train on the keep's roof (the Guarded Landing): three gears on a stone
  // bed and the gearwright's notation stone beside them.
  const t3 = SPIRE_TIER.t3;
  const t3y = yOf(ground, 't3');
  const gearOff = [[-9.5, -0.4], [-7, -0.4], [-4.5, -0.4]];
  k.slab(t3.x - 7 - SPIRE.x, t3y, t3.z - 0.4 - SPIRE.z, 7.6, 0.28, 1.6, 'stone2');
  k.slab(t3.x - 11.6 - SPIRE.x, t3y, t3.z - 0.4 - SPIRE.z, 1.3, 0.9, 0.5, 'stone2');
  k.slab(t3.x - 11.6 - SPIRE.x, t3y + 0.9, t3.z - 0.4 - SPIRE.z, 1.4, 0.1, 0.6, 'edge');
  world.colliders.addBox({ x: t3.x - 11.6, z: t3.z - 0.4, w: 1.3, d: 0.5, y0: t3y, y1: t3y + 1.0, climbable: true });
  for (let i = 0; i < 3; i++) {
    const [ox, oz] = gearOff[i];
    k.at({ x: t3.x + ox - SPIRE.x, z: t3.z + oz - SPIRE.z }, (w) => {
      w.prism(0, t3y + 0.28, 0, 0.7, 0.22, 'bronze', { sides: 8, layer: 'metal' });
      for (let t = 0; t < 6; t++) {
        const a = (t / 6) * Math.PI * 2;
        w.slab(Math.sin(a) * 0.72, t3y + 0.36, Math.cos(a) * 0.72, 0.18, 0.1, 0.34, 'bronze', { layer: 'metal', ry: a });
      }
      w.slab(0.4, t3y + 0.55, 0, 0.55, 0.1, 0.12, 'iron', { layer: 'metal' });
    });
  }
  world.colliders.addBox({ x: t3.x - 7, z: t3.z - 0.4, w: 7.6, d: 1.6, y0: t3y, y1: t3y + 0.28, climbable: true });

  const g = k.build('ascent_lifts');
  g.position.set(SPIRE.x, 0, SPIRE.z);
  world.scene.add(g);
  mergeStatic(world.scene, [g]);

  state.ascentLifts = { lifts, ground, low };
  updateAscentLifts(state, 0);
  return state.ascentLifts;
}

function applyRide(lift, dt) {
  const prevY = lift.y;
  const delta = lift.dest - lift.y;
  if (Math.abs(delta) < 0.01) {
    lift.y = lift.dest;
    lift.moving = false;
  } else {
    const step = Math.sign(delta) * Math.min(Math.abs(delta), SPEED * dt);
    lift.y += step;
    lift.moving = true;
  }
  const dy = lift.y - prevY;
  lift.pad.position.y = lift.y;
  lift.cw.position.y = lift.y0 + lift.y1 - lift.y;
  lift.col.y0 = lift.y - PAD_H;
  lift.col.y1 = lift.y;
  lift.ride.pos.y = lift.y + 1.0;
  if (dy !== 0 && G.actors) {
    for (const a of G.actors) {
      if (a.grounded && onPad(a, lift, prevY)) {
        if (lift.y > lift.y0 + 0.3) keepInCage(a, lift);
        a.pos.y += dy;
        a.fallStart = a.pos.y;
        a.liftRideUntil = (G.time || 0) + 1; // enemies don't pick a fight with a rider shut in the cage (Enemy.update)
        if (a.model) a.model.root.position.y += dy;
        if (a.ascentAmbush && a.home) a.home.y += dy;
      }
    }
  }
  return dy;
}

export function updateAscentLifts(state, dt) {
  const pack = state.ascentLifts;
  if (!pack) return;
  for (const lift of pack.lifts) {
    if (lift.y !== lift.dest || lift.moving) applyRide(lift, dt);
    if (lift.pad) {
      if (lift.cage) placeCage(lift);
      const wy = wheelY(lift.y1);
      lift.chain.position.y = lift.y + 2.65;
      lift.chain.scale.y = Math.max(0.1, wy - lift.chain.position.y);
      const cwTop = lift.y0 + lift.y1 - lift.y + 2.9;
      lift.cwChain.position.y = cwTop;
      lift.cwChain.scale.y = Math.max(0.1, wy - cwTop);
      if (lift.moving) lift.gear.rotation.z += dt * (SPEED / WHEEL_R) * Math.sign(lift.dest - lift.y || 1);
    }
  }
}

export function setLiftDest(state, id, destId) {
  const pack = state.ascentLifts;
  if (!pack) return null;
  const lift = pack.lifts.find((l) => l.def.id === id);
  if (!lift) return null;
  lift.dest = destId === lift.def.to ? lift.y1 : lift.y0;
  lift.moving = true;
  return lift;
}

export function liftById(state, id) {
  return state?.ascentLifts?.lifts.find((l) => l.def.id === id) || null;
}

export { onPad, SPEED };
