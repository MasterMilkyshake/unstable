// The Rift's inhabited, ominous layer: the Kneeling statues, gibbets and banners hung from the
// castles, the chains strung between the relay towers. Sites come from data/riftLayout.js.
//
// Why each thing is here (docs/WORLD_BIBLE.md):
//   The Kneeling   the dynasty's honour guard, cut in stone along the two processional ways and
//                  bowed toward the Seat. The Rift has hurt them like everything else it took.
//   The chains     the command chain was a protocol and a structure. Its iron still runs from
//                  the relay towers' beacon rings to the Chainward; one line has parted.
//   Gibbets        the keep's discipline, still hanging where it was carried out.
//   Banners        the dynasty's colours on the walls, rotted to strips.
//
// Statues, chains and banners are kit-built and merged. The gibbets sway, so they are two
// instanced meshes whose matrices updateRiftOmens writes each frame.
import * as THREE from 'three';
import { Kit, groundRange } from './kit.js';
import { KIT_MATERIALS } from './style.js';
import { mergeStatic } from './merge.js';
import { seededRandom } from '../core/util.js';
import { RIFT_PADS, RIFT_CASTLES, RIFT_SPOTS } from '../data/riftLayout.js';
import { SPIRE } from '../data/riftSpire.js';

// Drowned stone: the rift palette's masonry, a little darker and cooler, with sea growth.
const STONE = { glow: '#ffc979', stone: '#4f4a5d', stone2: '#433e50', edge: '#676177', dark: '#17141d', moss: '#36595a', crystal: '#a07cff', metal: '#4b433f', panel: '#5d5869' };
const IRON = { metal: '#4a3f3a', metal2: '#5a4a40', dark: '#221d1c' };
const CLOTH = { cloth: '#3b1d2a', cloth2: '#472534', hem: '#24161c', mark: '#9a8a68', metal: '#403835', dark: '#1d181c' };
const GIBBET = { metal: '#3f3632', metal2: '#4c403a', cloth: '#2b2530', cloth2: '#36303d', dark: '#1a1619' };

const U = 12.5; // a statue's metre: a knight kneels ~18 m tall at this scale
const MIN_CHAIN_CLEAR = 10; // command chains keep this far above the ground along a span
const END_MARGIN = 10; // metres at each end where the chain is inside its own tower's footprint

// The six statues. Each faces the way, turned toward the Seat it bows to.
export const KNEELING = [
  { id: 'kneel_se1', toward: SPIRE, damage: 'moss' },
  { id: 'kneel_sw1', toward: SPIRE, damage: 'crystal' },
  { id: 'kneel_se2', toward: SPIRE, damage: 'head' },
  { id: 'kneel_sw2', toward: SPIRE, damage: 'arm' },
  { id: 'kneel_nw', toward: RIFT_CASTLES.chainward, damage: 'chained' },
  { id: 'kneel_ne', toward: RIFT_CASTLES.chainward, damage: 'sunk' },
];

export function statueYaw(pad, toward) {
  // perpendicular to the north-south way, toward it; then turned toward the Seat
  const px = Math.sign(6000 - pad.x) || 1;
  const tx = toward.x - pad.x, tz = toward.z - pad.z;
  const tl = Math.hypot(tx, tz) || 1;
  const dx = px + 0.6 * (tx / tl), dz = 0.6 * (tz / tl);
  return Math.atan2(dx, dz);
}

// ------------------------------------------------------------------ shared shapes
// A box from a to b (its length along the segment), w across and d deep.
function seg(k, a, b, w, d, c, o = {}) {
  const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
  const el = Math.hypot(ex, ey, ez);
  if (el < 1e-5) return;
  const ry = Math.atan2(ex, ez);
  const rx = Math.acos(Math.max(-1, Math.min(1, ey / el)));
  const pad = o.pad ?? 0;
  k.at({ x: a[0], y: a[1], z: a[2], ry, rx }, (kk) => kk.slab(0, -pad, 0, w, el + pad * 2, d, c, o));
}

// One chain link standing along local +y from 0 to len: two side bars and two end bars.
// `turn` spins it a quarter about its own axis so neighbours interlock.
function link(k, len, w, bar, turn, c, detail) {
  k.at({ ry: turn ? Math.PI / 2 : 0 }, (l) => {
    if (detail < 1) {
      l.slab(0, -bar / 2, 0, w * 0.7, len + bar, bar, c, { layer: 'metal', jitter: 0 });
      return;
    }
    for (const s of [-1, 1]) l.slab(s * (w / 2 - bar / 2), -bar / 2, 0, bar, len + bar, bar, c, { layer: 'metal', jitter: 0.04 });
    for (const y of [-bar / 2, len - bar / 2]) l.slab(0, y, 0, w - bar * 2 + 0.02, bar, bar, c, { layer: 'metal', jitter: 0.04 });
  });
}

// Links laid along a polyline, one link per `step` metres of path.
export function linksAlong(k, pts, o) {
  const len = o.len, w = o.w, bar = o.bar;
  const step = len - bar;
  const c = o.c || 'metal', c2 = o.c2 || c;
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const m = Math.max(1, Math.round(d / step));
    for (let j = 0; j < m; j++) {
      const t0 = j / m, t1 = (j + 1) / m;
      const p = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0];
      const q = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, a[2] + (b[2] - a[2]) * t1];
      const ex = q[0] - p[0], ey = q[1] - p[1], ez = q[2] - p[2];
      const el = Math.hypot(ex, ey, ez);
      const ry = Math.atan2(ex, ez);
      const rx = Math.acos(Math.max(-1, Math.min(1, ey / el)));
      k.at({ x: p[0], y: p[1], z: p[2], ry, rx }, (kk) => link(kk, el, w, bar, n % 2 === 1, n % 2 ? c2 : c, k.detail));
      n++;
    }
  }
  return n;
}

// A hanging chain between a and b: a parabola that sags `sag` metres at mid-span.
export function catenaryPoints(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

// The most a span may sag and still keep MIN_CHAIN_CLEAR over the terrain and a little air over
// any wall it crosses (its own towers' footprints at the ends excepted).
export function fitSag(world, a, b, want) {
  const horiz = Math.hypot(b[0] - a[0], b[2] - a[2]);
  let allowed = want;
  let straightClear = Infinity;
  const n = Math.max(12, Math.ceil(horiz / 3));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const d = t * horiz;
    if (d < END_MARGIN || horiz - d < END_MARGIN) continue;
    const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
    const line = a[1] + (b[1] - a[1]) * t;
    const ground = world.terrain.heightAt(x, z);
    const built = world.colliders ? world.colliders.groundAt(x, z, 1e4) : -Infinity;
    const need = Math.max(ground + MIN_CHAIN_CLEAR, built + 2);
    const room = line - need;
    straightClear = Math.min(straightClear, room);
    allowed = Math.min(allowed, room / (4 * t * (1 - t)));
  }
  return { sag: Math.max(0, allowed), ok: straightClear >= 0 };
}

// ------------------------------------------------------------------ the Kneeling
function helm(h) {
  h.slab(0, 0, 0, 0.26, 0.045, 0.28, 'edge');
  h.slab(0, 0.035, 0, 0.225, 0.23, 0.245, 'stone');
  h.block(0, 0.165, 0.124, 0.17, 0.026, 0.014, 'dark', { grad: 0 });
  h.block(0, 0.1, 0.124, 0.028, 0.085, 0.014, 'dark', { grad: 0 });
  h.slab(0, 0.255, 0, 0.19, 0.03, 0.2, 'stone2');
  h.slab(0, 0.27, -0.01, 0.045, 0.075, 0.25, 'edge');
}

// A bowed, crowned head in the helm's frame and units: collar, head, hair to the nape, a beard,
// and a circlet that has lost two of its tines.
function crownedHead(h) {
  h.slab(0, 0, 0, 0.21, 0.045, 0.23, 'edge');
  h.slab(0, 0.035, 0, 0.19, 0.2, 0.205, 'stone');
  h.slab(0, 0.06, -0.06, 0.215, 0.17, 0.12, 'stone2');
  h.slab(0, 0.02, 0.085, 0.13, 0.085, 0.07, 'stone2');
  h.slab(0, 0.215, 0, 0.215, 0.045, 0.225, 'metal');
  for (let i = 0; i < 8; i++) {
    if (i === 2 || i === 5) continue;
    const a = (i / 8) * Math.PI * 2;
    h.slab(Math.sin(a) * 0.095, 0.255, Math.cos(a) * 0.1, 0.03, i % 2 ? 0.05 : 0.075, 0.03, 'metal');
  }
}

// One kneeling knight in its own frame: faces +z, the left knee down, the right knee forward,
// torso upright, head bowed low over both gauntlets stacked on the pommel of a greatsword
// planted point-down in front, a cloak falling down the back. Units: 1 = a man's metre; the
// caller scales by U. The silhouette is meant to read from the side and the front at range.
const SWORD_Z = 0.56;
// o.crowned: a crowned head instead of the helm. o.chain: no sword; the gauntlets close on a
// chain the caller draws from the hands (about (0, 0.93, SWORD_Z)).
function knight(k, damage, rng, o = {}) {
  const armGone = damage === 'arm' ? -1 : 0; // the right arm (local -x) is the one broken off
  // kneeling leg (+x): shin flat along the ground, thigh upright to the hip
  k.slab(0.15, 0, -0.2, 0.18, 0.17, 0.52, 'stone');
  k.slab(0.15, 0, -0.5, 0.15, 0.12, 0.12, 'stone2');
  seg(k, [0.15, 0.1, 0.05], [0.14, 0.64, -0.03], 0.21, 0.23, 'stone', { pad: 0.04 });
  k.block(0.15, 0.13, 0.11, 0.2, 0.15, 0.1, 'edge');
  // forward leg (-x): foot flat, shin upright, thigh level back to the hip
  k.slab(-0.16, 0, 0.42, 0.16, 0.1, 0.3, 'stone2');
  seg(k, [-0.16, 0.06, 0.38], [-0.16, 0.53, 0.36], 0.17, 0.19, 'stone', { pad: 0.03 });
  seg(k, [-0.16, 0.55, 0.36], [-0.14, 0.64, -0.02], 0.21, 0.22, 'stone', { pad: 0.05 });
  k.block(-0.16, 0.55, 0.46, 0.2, 0.16, 0.08, 'edge');
  // hips, faulds and the tabard falling between the knees
  k.slab(0, 0.56, -0.03, 0.46, 0.2, 0.3, 'stone2');
  for (const sx of [-1, 1]) k.slab(sx * 0.14, 0.4, 0.11, 0.19, 0.22, 0.05, 'stone', { rx: -0.3 });
  seg(k, [0, 0.62, 0.13], [0, 0.18, 0.24], 0.17, 0.035, 'stone2');
  // the cloak: from the shoulders straight down the back, in heavy folds, pooling at the heel
  seg(k, [0, 1.15, -0.15], [0, 0.6, -0.25], 0.5, 0.05, 'stone2', { pad: 0.02 });
  seg(k, [0, 0.62, -0.25], [0, 0.0, -0.44], 0.62, 0.05, 'stone2', { pad: 0.02 });
  for (const fx of [-0.15, 0.02, 0.18]) {
    seg(k, [fx, 1.1, -0.18], [fx * 1.1, 0.6, -0.28], 0.07, 0.05, 'stone', { pad: 0.02 });
    seg(k, [fx * 1.1, 0.62, -0.28], [fx * 1.25, 0.02, -0.47], 0.08, 0.05, fx > 0.1 ? 'edge' : 'stone', { pad: 0.02 });
  }
  for (const sx of [-1, 1]) {
    seg(k, [sx * 0.25, 1.12, -0.12], [sx * 0.31, 0.55, -0.22], 0.07, 0.08, 'stone');
    seg(k, [sx * 0.31, 0.57, -0.22], [sx * 0.34, 0.0, -0.38], 0.08, 0.09, 'stone');
  }
  k.slab(0, 0, -0.5, 0.72, 0.06, 0.22, 'stone2');

  // torso, upright, barely leaning into the sword
  k.at({ y: 0.74, z: -0.03, rx: 0.1 }, (t) => {
    t.slab(0, 0, 0, 0.36, 0.2, 0.25, 'stone2');
    if (damage === 'crystal') {
      // split down the breastplate where the lattice grew through it and was cut out
      t.slab(-0.135, 0.16, 0.0, 0.23, 0.34, 0.29, 'stone', { rz: 0.05 });
      t.slab(0.14, 0.15, -0.005, 0.21, 0.33, 0.28, 'stone', { rz: -0.07 });
      t.slab(0, 0.15, -0.01, 0.06, 0.3, 0.2, 'dark', { grad: 0 });
    } else {
      t.slab(0, 0.16, 0.01, 0.5, 0.34, 0.3, 'stone');
      t.block(0, 0.33, 0.165, 0.07, 0.3, 0.05, 'edge');
    }
    t.slab(0, 0.04, 0, 0.42, 0.05, 0.3, 'edge');
    if (damage !== 'head') t.slab(0, 0.5, 0, 0.26, 0.07, 0.22, 'stone2');
    // pauldrons, three lames each
    for (const sx of [-1, 1]) {
      if (sx === armGone) {
        t.slab(sx * 0.27, 0.36, 0, 0.12, 0.12, 0.22, 'stone2', { rz: 0.4 });
        t.slab(sx * 0.3, 0.33, 0.03, 0.08, 0.07, 0.12, 'stone', { rz: -0.6, rx: 0.3 });
        continue;
      }
      for (let i = 0; i < 3; i++) t.slab(sx * (0.28 + i * 0.03), 0.46 - i * 0.07, 0, 0.24, 0.08, 0.34 - i * 0.025, i % 2 ? 'stone2' : 'edge', { rz: -sx * (0.3 + i * 0.1) });
      if (damage === 'moss') t.slab(sx * 0.29, 0.535, 0.02, 0.14, 0.02, 0.2, 'moss', { rz: -sx * 0.3, grad: 0 });
    }
    if (damage === 'head') {
      // the neck broke at the gorget: a jagged collar and nothing above it
      t.slab(0, 0.5, 0, 0.25, 0.05, 0.21, 'stone2');
      t.slab(0.05, 0.54, 0.02, 0.1, 0.05, 0.1, 'stone', { rz: 0.4 });
      t.slab(-0.06, 0.54, -0.03, 0.08, 0.04, 0.09, 'stone', { rz: -0.3 });
    } else {
      // bowed low, the face over the pommel
      t.at({ y: 0.54, z: 0.03, rx: 0.85 }, (h) => {
        if (o.crowned) crownedHead(h);
        else helm(h);
        if (damage === 'moss') h.slab(0, 0.29, -0.02, 0.07, 0.02, 0.2, 'moss', { grad: 0 });
      });
    }
  });

  // the greatsword, vertical, its point sunk in the plinth in front of the forward knee
  const z = SWORD_Z;
  if (!o.chain) {
    k.slab(0, -0.06, z, 0.1, 0.88, 0.045, 'metal');
    k.slab(0, -0.06, z, 0.025, 0.86, 0.06, 'edge');
    k.block(0, 0.84, z, 0.48, 0.05, 0.075, 'metal');
    for (const sx of [-1, 1]) k.block(sx * 0.25, 0.85, z, 0.05, 0.085, 0.08, 'metal');
    k.slab(0, 0.86, z, 0.05, 0.1, 0.05, 'dark');
  }
  // both gauntlets stacked on the pommel, the lower gripping, the upper laid over it
  k.slab(0, 0.89, z, 0.16, 0.09, 0.15, armGone ? 'stone2' : 'stone');
  if (!armGone) k.slab(0, 0.975, z - 0.005, 0.17, 0.09, 0.16, 'stone');
  else k.slab(0, 0.975, z, 0.08, 0.05, 0.08, 'metal');
  // arms: shoulder, elbow out at the side, hand on the pommel
  for (const sx of [-1, 1]) {
    if (sx === armGone) continue;
    const top = sx === 1 ? 1.02 : 0.93;
    const S = [sx * 0.29, 1.12, 0.05], E = [sx * 0.31, 0.86, 0.25], H = [sx * 0.05, top, z - 0.02];
    seg(k, S, E, 0.15, 0.15, 'stone', { pad: 0.04 });
    seg(k, E, H, 0.14, 0.13, 'stone', { pad: 0.03 });
    seg(k, [E[0] * 0.75 + H[0] * 0.25, E[1] * 0.75 + H[1] * 0.25, E[2] * 0.75 + H[2] * 0.25], [E[0] * 0.3 + H[0] * 0.7, E[1] * 0.3 + H[1] * 0.7, E[2] * 0.3 + H[2] * 0.7], 0.165, 0.155, 'stone2');
  }
}

// The kneeling figure for statues outside the Rift (the Anchor's Fall), with its collider
// footprint ([lx, lz, w, d, y0, y1] in figure units) and where its hands close.
export const KNEELING_HANDS = [0, 0.93, SWORD_Z];
export function kneelingFigure(k, o = {}) {
  knight(k, o.damage || 'whole', seededRandom(o.seed ?? 7), o);
  return knightBoxes(o.damage || 'whole');
}

// Footprint of the figure, in its own units, for colliders: [lx, lz, w, d, y0, y1].
function knightBoxes(damage) {
  const b = [
    [0, -0.12, 0.55, 0.9, 0, 0.74], // legs, hips and cloak
    [0, 0.02, 0.68, 0.42, 0.74, 1.26], // upright torso and pauldrons
    [0, 0.38, 0.6, 0.36, 0.84, 1.08], // arms reaching to the pommel
    [0, SWORD_Z, 0.2, 0.18, 0, 1.06], // sword and hands
  ];
  if (damage !== 'head') b.push([0, 0.16, 0.27, 0.32, 1.18, 1.46]);
  return b;
}

// Plinth: a base step, a coursed die and a cornice, sized to the figure with room at the front.
const PLINTH = { W: 13.4, D: 20.4, TOP: 3.1 };
const FIG_Z = -0.04; // figure offset along the plinth, in figure units

function buildStatue(world, k, def, rng, out) {
  const pad = RIFT_PADS[def.id];
  if (!pad) return;
  const g = world.terrain.heightAt(pad.x, pad.z);
  const yaw = statueYaw(pad, def.toward);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [pad.x + lx * c + lz * s, pad.z - lx * s + lz * c];
  const { W, D, TOP } = PLINTH;
  const lowest = groundRange(world.terrain, pad.x, pad.z, W + 1.6, D + 1.6, yaw, 5)[0] - g;
  const sunk = def.damage === 'sunk';
  const colliders = [];
  const box = (lx, lz, w, d, y0, y1, rot = 0) => {
    const [x, z] = at(lx, lz);
    colliders.push(world.colliders.addBox({ x, z, w, d, y0: g + y0, y1: g + y1, rot: yaw + rot, climbable: true, walkable: true, tag: 'kneeling' }));
  };
  const DIE = TOP - 0.9 - 0.48; // die height between the base step and the cornice

  k.at({ x: pad.x, y: g, z: pad.z, ry: yaw }, (p) => {
    p.footing(0, 0, W + 1.6, D + 1.6, 0.9, lowest, 'stone2');
    if (sunk) {
      // the die cracked through and its rear half settled
      p.masonry(0, 0.9, D / 4 + 0.1, W, DIE, D / 2 + 0.2, { c: 'stone', c2: 'stone2' });
      p.cornice(0, 0.9 + DIE, D / 4 + 0.1, W, D / 2 + 0.2, 'edge');
      p.at({ y: 0.9, z: -D / 4, rx: -0.045, rz: 0.035 }, (q) => {
        q.masonry(0, -0.45, 0, W, DIE, D / 2 - 0.2, { c: 'stone', c2: 'stone2' });
        q.cornice(0, DIE - 0.45, 0, W, D / 2 - 0.2, 'edge');
      });
      p.rubble(W / 2 + 1.8, 0, -2, 2.4, 6, rng, { c: 'stone', c2: 'stone2', size: 1.3 });
    } else {
      p.masonry(0, 0.9, 0, W, DIE, D, { c: 'stone', c2: 'stone2' });
      p.cornice(0, 0.9 + DIE, 0, W, D, 'edge');
    }
    // the name panel on the face toward the way, left smooth
    p.slab(0, 1.1, D / 2 + 0.02, 5.2, 1.1, 0.14, 'panel');
    p.slab(0, 0.98, D / 2 + 0.06, 5.8, 0.14, 0.16, 'edge');
    // the figure
    p.at({ y: TOP, z: FIG_Z * U, s: U, rz: sunk ? 0.04 : 0, rx: sunk ? -0.035 : 0 }, (f) => {
      f.slab(0, -0.03, 0.02, 0.86, 0.05, 1.3, 'stone2');
      knight(f, def.damage, rng);
    });
    if (def.damage === 'chained') {
      // the command chain looped over the crossguard and down to rings at the plinth's front
      for (const sx of [-1, 1]) {
        const guard = [sx * 0.25 * U, TOP + 0.85 * U, (SWORD_Z + FIG_Z) * U];
        const ring = [sx * (W / 2 - 1.0), TOP + 0.3, D / 2 - 1.0];
        p.slab(ring[0], TOP - 0.05, ring[2], 0.9, 0.4, 0.9, 'metal', { layer: 'metal' });
        const mid = [(guard[0] + ring[0]) / 2 + sx * 0.6, (guard[1] + ring[1]) / 2 - 1.8, (guard[2] + ring[2]) / 2 + 0.5];
        linksAlong(p, [guard, mid, ring], { len: 1.3, w: 0.78, bar: 0.2, c: 'metal' });
      }
    }
    if (def.damage === 'head') {
      // the head came down on the plinth, beside the sword, and rolled onto its back
      p.at({ x: 0.4 * U, y: TOP + 0.13 * U, z: (SWORD_Z + FIG_Z - 0.06) * U, ry: 0.9, rx: -Math.PI / 2 + 0.25, rz: 0.3, s: U }, (h) => helm(h));
      p.rubble(0.36 * U, TOP, (SWORD_Z + FIG_Z + 0.14) * U, 1.6, 5, rng, { c: 'stone', c2: 'stone2', size: 0.8 });
    }
  });

  // colliders: base step, die, then the figure in coarse blocks
  box(0, 0, W + 1.6, D + 1.6, lowest - 1, 0.9);
  box(0, 0, W, D, 0.9, TOP);
  for (const [lx, lz, w, d, y0, y1] of knightBoxes(def.damage)) box(lx * U, (lz + FIG_Z) * U, w * U, d * U, TOP + y0 * U, TOP + y1 * U);

  const info = { id: def.id, x: pad.x, z: pad.z, y: g, yaw, damage: def.damage, colliders, top: g + TOP + 1.46 * U };

  if (def.damage === 'head') {
    box(0.4 * U, (SWORD_Z + FIG_Z - 0.06) * U, 0.3 * U, 0.3 * U, TOP, TOP + 0.27 * U, 0.9);
    info.fallen = { x: at(0.4 * U, (SWORD_Z + FIG_Z - 0.06) * U)[0], z: at(0.4 * U, (SWORD_Z + FIG_Z - 0.06) * U)[1] };
  }
  if (def.damage === 'arm') {
    // the broken arm on the ground beside the plinth: upper arm, forearm and gauntlet
    const q = U / 8;
    const [ax, az] = at(-(W / 2 + 4.2), 3.2);
    const ag = world.terrain.heightAt(ax, az);
    info.debris = { x: ax, z: az, r: 5 };
    k.at({ x: ax, y: ag, z: az, ry: yaw + 0.4, s: q }, (a) => {
      seg(a, [0, 0.55, -2.6], [0.2, 0.6, 1.4], 1.05, 0.95, 'stone');
      seg(a, [0.0, 0.62, -1.2], [0.1, 0.66, 0.5], 1.25, 1.15, 'stone2');
      a.slab(0.4, 0, 2.1, 1.3, 0.75, 1.15, 'stone', { ry: 0.3, rz: 0.15 });
      a.rubble(1.8, 0, -3.2, 2.2, 6, rng, { c: 'stone', c2: 'stone2', size: 0.9 });
    });
    colliders.push(world.colliders.addBox({ x: ax, z: az, w: 1.6 * q, d: 5.0 * q, y0: ag - 1, y1: ag + 1.15 * q, rot: yaw + 0.4, climbable: true, walkable: true, tag: 'kneeling' }));
  }
  out.push(info);
}

// ------------------------------------------------------------------ chains
function anchorsOf(world, state) {
  const a = (state && state.castles && state.castles.anchors) || {};
  // Each relay ring as the castles published it, or the contract's ground + ringH until they do.
  const published = (Array.isArray(a.relays) ? a.relays : []).filter((r) => r && r.id && [r.x, r.y, r.z].every(Number.isFinite));
  const relays = RIFT_CASTLES.relays.map((r) => published.find((p) => p.id === r.id)
    || { id: r.id, x: r.x, y: world.terrain.heightAt(r.x, r.z) + r.ringH, z: r.z, fallback: true });
  for (const p of published) if (!relays.some((r) => r.id === p.id)) relays.push(p);
  const ok = (p) => p && [p.x, p.y, p.z].every(Number.isFinite);
  // the Chainward's hawse rings, then the outer rings whose lines run toward the keep
  const chains = [...(Array.isArray(a.chains) ? a.chains : []), ...(Array.isArray(a.hawse) ? a.hawse : [])].filter(ok);
  return { relays, chains, banners: Array.isArray(a.banners) ? a.banners : [], gibbets: Array.isArray(a.gibbets) ? a.gibbets : [] };
}

// The command chain's routes: relay to relay to the keep. The south relay's line has parted.
const CHAIN_ROUTES = [
  ['relay_west', 'relay_north'],
  ['relay_north', 'chainward'],
  ['relay_northeast', 'chainward'],
];
const SNAPPED = 'relay_south';

// Where a chain leaves a ring: on the ring's rim, on the side it pulls toward.
function ringPoint(r, toward, rim = 1.6) {
  const dx = toward[0] - r.x, dz = toward[2] - r.z;
  const l = Math.hypot(dx, dz) || 1;
  return [r.x + (dx / l) * rim, r.y, r.z + (dz / l) * rim];
}

// The Chainward's strong points, when the castles have not published theirs: high on the
// ward's flank towers, west and east of the keep.
function fallbackStrong(world) {
  const cw = RIFT_CASTLES.chainward;
  const top = (RIFT_PADS.chainward_upper?.h ?? 24) + 26;
  return [
    { x: cw.x + 50, y: top, z: cw.z + 4 },
    { x: cw.x - 50, y: top, z: cw.z + 4 },
  ];
}

function buildChains(world, k, anchors, out, blocked = []) {
  const byId = Object.fromEntries(anchors.relays.map((r) => [r.id, r]));
  const size = { len: 2.7, w: 1.5, bar: 0.34, c: 'metal', c2: 'metal2' };
  const span = (from, to, a, b) => {
    const horiz = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (horiz < 8) return;
    // no line was ever strung further than a relay could carry it: past that it reads as a thread
    if (horiz > 140) { blocked.push({ from, to, long: true }); return; }
    const want = Math.min(18, Math.max(3, horiz * 0.09));
    const fit = fitSag(world, a, b, want);
    // a line that would pass through a wall is not strung (the ring's own tower excepted)
    if (!fit.ok) { blocked.push({ from, to }); return; }
    const pts = catenaryPoints(a, b, fit.sag, Math.max(10, Math.round(horiz / 6)));
    const links = linksAlong(k, pts, size);
    out.push({ from, to, a, b, sag: fit.sag, ok: fit.ok, pts, links });
  };
  const P = (p) => [p.x, p.y, p.z];

  if (!anchors.chains.length) {
    // Nothing published yet: relay to relay to two strong points high on the Chainward.
    const strong = fallbackStrong(world);
    const used = new Set();
    for (const [from, to] of CHAIN_ROUTES) {
      const ra = byId[from];
      if (!ra) continue;
      let tb;
      if (to === 'chainward') {
        let best = null, bd = Infinity;
        for (const p of strong) {
          const d = Math.hypot(p.x - ra.x, p.z - ra.z);
          if (!used.has(p) && d < bd) { bd = d; best = p; }
        }
        if (!best) continue;
        used.add(best);
        tb = P(best);
      } else if (byId[to]) tb = ringPoint(byId[to], P(ra));
      else continue;
      span(from, to, ringPoint(ra, tb), tb);
    }
    return out;
  }

  // The castles name, for each hawse ring, the station its line runs to. A line to a relay is
  // strung to that relay's beacon ring; the south relay's line has parted, so only a torn length
  // hangs from the Chainward's ring. A line marked 'chainward' (the Bastion, the bridgehead, the
  // Garrison's watch) runs to the next node nearer the keep.
  const CW = RIFT_CASTLES.chainward;
  const toCW = (p) => Math.hypot(p.x - CW.x, p.z - CW.z);
  const perRelay = {};
  for (const c of anchors.chains) {
    const t = c.toward;
    if (t === SNAPPED) {
      out.push(...[torn(world, k, c, size, anchors)].filter(Boolean));
      continue;
    }
    if (t && byId[t]) {
      perRelay[t] = (perRelay[t] || 0) + 1;
      if (perRelay[t] > 3) continue;
      span(t, c.id || 'chainward', ringPoint(byId[t], P(c)), P(c));
      continue;
    }
    // next hop toward the Chainward: a relay or another ring that is nearer the keep
    const here = toCW(c);
    let best = null, bd = Infinity;
    for (const n of [...anchors.relays.filter((r) => r.id !== SNAPPED), ...anchors.chains]) {
      if (n === c || n.toward === SNAPPED || toCW(n) > here - 20) continue;
      const d = Math.hypot(n.x - c.x, n.z - c.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) span(c.id || 'ring', best.id || 'ring', P(c), best.ringH !== undefined || byId[best.id] === best ? ringPoint(best, P(c)) : P(best));
  }
  // a relay nobody pulls on (the Bastion's receiver) hands its line to the next node inward
  for (const r of anchors.relays) {
    if (r.id === SNAPPED || r.fallback || perRelay[r.id] || out.some((s) => s.to === r.id || s.from === r.id)) continue;
    const here = toCW(r);
    let best = null, bd = Infinity;
    for (const n of [...anchors.relays, ...anchors.chains]) {
      if (n === r || n.id === SNAPPED || n.toward === SNAPPED || toCW(n) > here - 20) continue;
      const d = Math.hypot(n.x - r.x, n.z - r.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) span(r.id, best.id || 'ring', ringPoint(r, P(best)), byId[best.id] === best ? ringPoint(best, P(r)) : P(best));
  }
  return out;
}

// A parted line at its keep end: a torn length hanging from the ring, clear of the wall below
// it, its last link split open.
function torn(world, k, c, size, anchors) {
  const r = anchors.relays.find((x) => x.id === SNAPPED);
  const tx = r ? r.x - c.x : 0, tz = r ? r.z - c.z : -1;
  const tl = Math.hypot(tx, tz) || 1;
  const ux = tx / tl, uz = tz / tl;
  let off = -1, floor = 0;
  for (let d = 0.8; d <= 5; d += 0.4) {
    const x = c.x + ux * d, z = c.z + uz * d;
    const f = Math.max(world.terrain.heightAt(x, z), world.colliders.groundAt(x, z, c.y - 0.5));
    if (f < c.y - 10) { off = d; floor = f; break; }
  }
  if (off < 0) return null;
  const len = Math.min(c.y - floor - 4, 12 + Math.abs((c.x * 7 + c.z) % 6));
  const hx = c.x + ux * (off + 0.6), hz = c.z + uz * (off + 0.6);
  const pts = [[c.x, c.y, c.z], [hx, c.y - 0.6, hz]];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    pts.push([hx + Math.sin(t * 2.1) * 0.4, c.y - 0.6 - len * t, hz + Math.sin(t * 1.3) * 0.3]);
  }
  const links = linksAlong(k, pts, size);
  const e = pts[pts.length - 1];
  k.slab(e[0] - 0.58, e[1] - 2.4, e[2], 0.34, 2.7, 0.34, 'metal2', { layer: 'metal' });
  return { from: c.id || 'ring', to: SNAPPED, torn: true, snapped: true, a: P0(c), pts, links };
}
const P0 = (p) => [p.x, p.y, p.z];

// The parted line: hanging from the south relay's ring, piled at the tower's foot, and its torn
// end dragged out along the ground toward where it used to run.
function buildSnapped(world, k, anchors, rng, out) {
  const r = anchors.relays.find((x) => x.id === SNAPPED);
  if (!r) return;
  const H = (x, z) => world.terrain.heightAt(x, z);
  const dx0 = SPIRE.x - r.x, dz0 = SPIRE.z - r.z;
  const dl = Math.hypot(dx0, dz0) || 1;
  const ux = dx0 / dl, uz = dz0 / dl; // toward the Ascent, where the line ran
  const vx = -uz, vz = ux;
  const top = ringPoint(r, [SPIRE.x, r.y, SPIRE.z], 2.0);
  const size = { len: 2.7, w: 1.5, bar: 0.34, c: 'metal', c2: 'metal2' };
  // Find the tower's face on that side: the chain drapes over the parapet and down the wall.
  const built = (x, z) => (world.colliders ? world.colliders.groundAt(x, z, r.y + 1) : -Infinity);
  let face = 2.0, sill = -Infinity;
  for (let d = 2.0; d <= 14; d += 0.5) {
    const x = r.x + ux * d, z = r.z + uz * d;
    const b = built(x, z);
    if (b < H(x, z) + 0.5) { face = d; break; }
    sill = Math.max(sill, b);
    face = d + 0.5;
  }
  const off = face + 0.9;
  // the coil sits clear of the tower's foot
  const cx = r.x + ux * (off + 8), cz = r.z + uz * (off + 8);
  const cg = H(cx, cz);
  const hang = [top];
  if (sill > -Infinity && sill < r.y) hang.push([r.x + ux * (face - 0.2), sill + 0.8, r.z + uz * (face - 0.2)]);
  const wallX = r.x + ux * off, wallZ = r.z + uz * off;
  const startY = hang[hang.length - 1][1];
  // straight down the face, then easing out toward the coil near the ground
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    const e = t * t * t;
    const x = wallX + (cx + vx * 3.4 - wallX) * e, z = wallZ + (cz + vz * 3.4 - wallZ) * e;
    hang.push([x, startY + (cg + 1.1 - startY) * t, z]);
  }
  let n = linksAlong(k, hang, size);
  // the coil: two loose turns lying on the ground
  const coil = [];
  const turns = 2.2, steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.atan2(vz, vx) + t * turns * Math.PI * 2;
    const rr = 3.4 - t * 1.9;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    coil.push([x, Math.max(H(x, z), cg - 0.4) + 0.62 + (t > 0.55 ? 0.62 : 0), z]);
  }
  n += linksAlong(k, coil, size);
  // the torn end, dragged north along the ground; its last link split open
  const tail = [];
  const last = coil[coil.length - 1];
  for (let i = 0; i <= 5; i++) {
    const d = i * 3;
    const x = last[0] + ux * d + vx * Math.sin(i * 0.9) * 0.8, z = last[2] + uz * d + vz * Math.sin(i * 0.9) * 0.8;
    tail.push([x, H(x, z) + 0.62, z]);
  }
  n += linksAlong(k, tail, size);
  const end = tail[tail.length - 1];
  const eg = H(end[0] + ux * 2, end[2] + uz * 2);
  k.at({ x: end[0] + ux * 2, y: eg + 0.2, z: end[2] + uz * 2, ry: Math.atan2(ux, uz) + 0.5 }, (b) => {
    b.slab(-0.58, 0, 0, 0.34, 0.34, 2.7, 'metal2', { layer: 'metal' });
    b.slab(0, 0, 1.18, 1.1, 0.34, 0.34, 'metal2', { layer: 'metal' });
    b.slab(0.9, 0, -0.6, 0.34, 0.34, 1.3, 'metal', { layer: 'metal', ry: 0.6 });
  });
  out.push({ from: SNAPPED, snapped: true, a: top, coil: [cx, cg, cz], pts: [...hang, ...coil, ...tail], links: n });
}

// ------------------------------------------------------------------ banners
function buildBanner(k, b, rng) {
  const len = Math.max(3, b.len || 10);
  const w = Math.min(3.2, Math.max(1.6, len * 0.22));
  const yaw = Math.atan2(b.nx || 0, b.nz || 1);
  k.at({ x: b.x, y: b.y, z: b.z, ry: yaw }, (f) => {
    // iron brackets out from the wall and the rod across them
    for (const sx of [-1, 1]) f.slab(sx * (w / 2 + 0.1), -0.1, 0.25, 0.14, 0.14, 0.5, 'metal', { layer: 'metal' });
    f.slab(0, -0.12, 0.45, w + 0.7, 0.14, 0.14, 'metal', { layer: 'metal' });
    f.slab(0, -0.62, 0.45, w + 0.1, 0.5, 0.1, 'cloth2');
    // the cloth, rotted into strips of different lengths
    const strips = Math.max(3, Math.round(w / 0.55));
    const sw = w / strips;
    for (let i = 0; i < strips; i++) {
      const x = -w / 2 + sw * (i + 0.5);
      const sl = len * (0.62 + rng() * 0.38) - 0.6;
      const segs = Math.max(3, Math.round(sl / 1.6));
      const sh = sl / segs;
      for (let j = 0; j < segs; j++) {
        if (j > 1 && rng() < 0.08) continue; // a moth-eaten gap
        const y = -0.62 - sh * (j + 1);
        const fold = (j + i) % 2 ? 0.05 : -0.04;
        const narrow = j === segs - 1 ? 0.55 + rng() * 0.3 : 1;
        f.slab(x + (rng() - 0.5) * 0.06, y, 0.45 + fold, sw * narrow - 0.02, sh + 0.02, 0.08, (i + j) % 3 ? 'cloth' : 'cloth2', { grad: 0.25, jitter: 0.06 });
      }
      if (rng() < 0.6) f.slab(x, -0.62 - sl - 0.1, 0.46, sw * 0.4, 0.5, 0.06, 'cloth2', { rz: (rng() - 0.5) * 0.4 });
    }
    // the dynasty's mark, faded: a crown over three links of chain
    const my = -0.62 - Math.min(2.6, len * 0.24);
    f.slab(0, my, 0.56, w * 0.5, 0.12, 0.03, 'mark', { grad: 0 });
    for (const cx of [-1, 0, 1]) f.slab(cx * w * 0.2, my + 0.12, 0.56, 0.1, cx ? 0.24 : 0.34, 0.03, 'mark', { grad: 0 });
    for (let l = 0; l < 3; l++) {
      const ly = my - 0.5 - l * 0.55;
      const lw = l % 2 ? 0.14 : 0.36;
      for (const sx of [-1, 1]) f.slab(sx * lw / 2, ly, 0.56, 0.07, 0.5, 0.03, 'mark', { grad: 0 });
      f.slab(0, ly + 0.43, 0.56, lw, 0.07, 0.03, 'mark', { grad: 0 });
      f.slab(0, ly, 0.56, lw, 0.07, 0.03, 'mark', { grad: 0 });
    }
    // a hem band of faded oxblood a little below the rod
    f.slab(0, -1.35, 0.55, w - 0.04, 0.16, 0.03, 'hem', { grad: 0 });
  });
}

// ------------------------------------------------------------------ gibbets
// Two chain lengths: a long drop where the anchor overhangs open air, a short one where the
// ground comes up close under it. A cage that would still touch is not hung.
const DROPS = [3.0, 0.8];
const CAGE_W = 1.1, CAGE_H = 2.1;
const cageBottom = (drop) => drop + 0.45 + CAGE_H + 0.1;

function gibbetCage(k, drop) {
  // chain from the anchor to the cage's hook
  linksAlong(k, [[0, 0, 0], [0, -drop, 0]], { len: 0.42, w: 0.24, bar: 0.06, c: 'metal', c2: 'metal2' });
  const top = -drop - 0.45, bot = top - CAGE_H;
  const h = CAGE_W / 2;
  // the crown: four straps rising to the hook
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) seg(k, [sx * h, top, sz * h], [0, -drop, 0], 0.07, 0.05, 'metal', { layer: 'metal' });
  // top and bottom hoops, a middle hoop, and the uprights
  for (const y of [top, top - CAGE_H * 0.5, bot + 0.05]) {
    k.slab(0, y - 0.04, -h, CAGE_W + 0.08, 0.08, 0.06, 'metal2', { layer: 'metal' });
    k.slab(0, y - 0.04, h, CAGE_W + 0.08, 0.08, 0.06, 'metal2', { layer: 'metal' });
    k.slab(-h, y - 0.04, 0, 0.06, 0.08, CAGE_W + 0.08, 'metal2', { layer: 'metal' });
    k.slab(h, y - 0.04, 0, 0.06, 0.08, CAGE_W + 0.08, 'metal2', { layer: 'metal' });
  }
  for (let i = 0; i < 4; i++) {
    for (const u of [-h, -h / 3, h / 3, h]) {
      const [x, z] = [[u, -h], [h, u], [-u, h], [-h, -u]][i];
      if (Math.abs(u) === h && i % 2) continue; // the corners once
      k.slab(x, bot, z, 0.055, CAGE_H, 0.055, 'metal', { layer: 'metal' });
    }
  }
  k.slab(0, bot - 0.06, 0, CAGE_W, 0.08, CAGE_W, 'dark', { layer: 'metal' });
}

function gibbetFigure(k, drop) {
  // slumped against the cage, knees drawn up, head hanging: a shape, not a wound
  const f = -drop - 0.45 - CAGE_H + 0.03;
  k.slab(0.05, f, 0.12, 0.42, 0.24, 0.5, 'cloth');
  seg(k, [-0.04, f + 0.2, -0.22], [0.1, f + 0.82, -0.14], 0.4, 0.24, 'cloth2', { pad: 0.04 });
  k.block(0.16, f + 0.86, 0.02, 0.2, 0.23, 0.21, 'cloth2', { rx: 0.7, rz: 0.45 });
  seg(k, [0.24, f + 0.74, -0.14], [0.3, f + 0.3, 0.12], 0.1, 0.1, 'cloth');
  seg(k, [-0.16, f + 0.72, -0.16], [-0.04, f + 0.3, 0.28], 0.1, 0.1, 'cloth');
}

function instanced(group, layer, count, material) {
  const m = group.children.find((c) => c.name.endsWith('_' + layer));
  if (!m || !count) return null;
  const im = new THREE.InstancedMesh(m.geometry, material, count);
  im.name = 'rift_gibbets_' + layer;
  im.castShadow = true;
  im.receiveShadow = true;
  im.userData.dynamic = true;
  return im;
}

// What is under a hanging cage: the ground or the top of anything built below the anchor.
function floorUnder(world, x, y, z) {
  let f = world.terrain.heightAt(x, z);
  if (world.colliders) f = Math.max(f, world.colliders.groundAt(x, z, y - 0.3, 1.1));
  return f;
}

function buildGibbets(world, anchors, low, rng) {
  const list = anchors.gibbets.filter((g) => g && [g.x, g.y, g.z].every(Number.isFinite));
  if (!list.length) return null;
  const items = [];
  const skipped = [];
  list.forEach((g, i) => {
    const floor = floorUnder(world, g.x, g.y, g.z);
    const v = DROPS.findIndex((d) => g.y - cageBottom(d) - floor >= 0.4);
    if (v < 0) { skipped.push(g); return; }
    items.push({
      x: g.x, y: g.y, z: g.z, v,
      yaw: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      ax: 0.05 + rng() * 0.04, az: 0.03 + rng() * 0.03, w: 0.6 + rng() * 0.35,
      held: i % 3 !== 2, // most of the cages are not empty
      ci: -1, fi: -1,
    });
  });
  const sets = DROPS.map((drop, v) => {
    const mine = items.filter((g) => g.v === v);
    if (!mine.length) return null;
    mine.forEach((g, i) => { g.ci = i; });
    let fi = 0;
    for (const g of mine) if (g.held) g.fi = fi++;
    const ck = new Kit(GIBBET, { detail: low ? 0 : 1 });
    gibbetCage(ck, drop);
    const fk = new Kit(GIBBET, { detail: 1 });
    gibbetFigure(fk, drop);
    const cageMesh = instanced(ck.build('rift_gibbet_cage'), 'metal', mine.length, KIT_MATERIALS.metal);
    const figMesh = instanced(fk.build('rift_gibbet_figure'), 'solid', fi, KIT_MATERIALS.solid);
    for (const m of [cageMesh, figMesh]) if (m) world.scene.add(m);
    return { drop, items: mine, cageMesh, figMesh };
  });
  const gib = { items, sets, skipped, time: 0, dummy: new THREE.Object3D() };
  poseGibbets(gib, 0);
  for (const s of sets) {
    if (!s) continue;
    for (const m of [s.cageMesh, s.figMesh]) {
      if (!m) continue;
      m.computeBoundingSphere();
      if (m.boundingSphere) m.boundingSphere.radius += 8;
    }
  }
  return gib;
}

function poseGibbets(gib, t) {
  const d = gib.dummy;
  for (const g of gib.items) {
    const s = gib.sets[g.v];
    d.position.set(g.x, g.y, g.z);
    d.rotation.set(Math.sin(t * g.w + g.phase) * g.ax, g.yaw + Math.sin(t * 0.21 + g.phase) * 0.25, Math.sin(t * g.w * 0.83 + g.phase * 1.7) * g.az, 'YXZ');
    d.updateMatrix();
    if (s.cageMesh) s.cageMesh.setMatrixAt(g.ci, d.matrix);
    if (s.figMesh && g.fi >= 0) s.figMesh.setMatrixAt(g.fi, d.matrix);
  }
  for (const s of gib.sets) {
    if (!s) continue;
    if (s.cageMesh) s.cageMesh.instanceMatrix.needsUpdate = true;
    if (s.figMesh) s.figMesh.instanceMatrix.needsUpdate = true;
  }
}


// ------------------------------------------------------------------ the one kept lamp
// The Garrison still keeps its roll, and a lamp burns beside it: the only warm light the
// knights tend. It stands on the first clear ground beside the lectern.
function clearAt(world, x, z, r, g) {
  for (const c of world.colliders.query(x, z, r + 0.2)) {
    if (c.y1 < g + 0.2 || c.y0 > g + 2.6) continue;
    if (c.kind === 'cyl') { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; continue; }
    const [lx, lz] = world.colliders._local(c, x, z);
    if (Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r) return false;
  }
  return true;
}

function buildLamp(world, k, out) {
  const spot = RIFT_SPOTS.garrison_roll;
  if (!spot) return;
  const g0 = world.terrain.heightAt(spot.x, spot.z);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 0.25 + (i / 16) * Math.PI * 2, d = 2.4 + (i % 2) * 0.6;
    const x = spot.x + Math.sin(a) * d, z = spot.z + Math.cos(a) * d;
    const g = world.terrain.heightAt(x, z);
    if (Math.abs(g - g0) > 0.35 || !clearAt(world, x, z, 0.9, g)) continue;
    const flame = k.lantern(x, g, z, { post: 2.5, metal: 'dark', strength: 1.7 });
    world.colliders.addCyl({ x, z, r: 0.3, y0: g - 0.5, y1: g + 3, climbable: false, tag: 'rift_lamp' });
    world.addLight(flame, '#ffb15e', 1.6, 18, true, 1);
    out.push({ x, z, flame });
    return;
  }
}

// ------------------------------------------------------------------ build / update
export function buildRiftOmens(world, exclusions, state = {}) {
  const low = !!state.low;
  const rng = seededRandom(7717);
  const omens = { statues: [], chains: [], banners: 0, gibbets: null, fallback: false };

  // The Kneeling
  const sk = new Kit(STONE, { detail: low ? 0 : 1 });
  for (const def of KNEELING) buildStatue(world, sk, def, rng, omens.statues);
  // Rock keeps clear of the plinths (their base step's half-diagonal) and the fallen pieces.
  const plinthR = Math.hypot(PLINTH.W + 1.6, PLINTH.D + 1.6) / 2 + 0.5;
  for (const s of omens.statues) {
    exclusions.push({ x: s.x, z: s.z, r: plinthR });
    if (s.debris) exclusions.push(s.debris);
  }
  omens.lamps = [];
  buildLamp(world, sk, omens.lamps);
  for (const l of omens.lamps) exclusions.push({ x: l.x, z: l.z, r: 1.5 });
  const statues = sk.build('rift_kneeling');
  world.scene.add(statues);

  // The command chain, and the line that parted
  const anchors = anchorsOf(world, state);
  omens.fallback = anchors.relays.some((r) => r.fallback) || !anchors.chains.length;
  const ck = new Kit(IRON, { detail: low ? 0 : 1, shadow: !low });
  omens.blocked = [];
  buildChains(world, ck, anchors, omens.chains, omens.blocked);
  buildSnapped(world, ck, anchors, rng, omens.chains);
  // and of every length of chain that lies on or near the ground (the parted line's coil and tail)
  for (const c of omens.chains) {
    if (!c.snapped) continue;
    if (c.coil) exclusions.push({ x: c.coil[0], z: c.coil[2], r: 5.5 });
    for (const p of c.pts) if (p[1] - world.terrain.heightAt(p[0], p[2]) < 4) exclusions.push({ x: p[0], z: p[2], r: 2.5 });
  }
  const chains = ck.build('rift_command_chain');
  world.scene.add(chains);

  // Banners on the castles' walls
  const bk = new Kit(CLOTH, { detail: low ? 0 : 1 });
  for (const b of anchors.banners) {
    if (![b.x, b.y, b.z].every(Number.isFinite)) continue;
    buildBanner(bk, b, rng);
    omens.banners++;
  }
  const banners = bk.build('rift_banners');
  world.scene.add(banners);

  mergeStatic(world.scene, [statues, chains, banners]);

  // Gibbets: swaying, so they stay out of the merge
  omens.gibbets = buildGibbets(world, anchors, low, rng);

  state.omens = omens;
  return omens;
}

export function updateRiftOmens(state, dt) {
  const o = state && state.omens;
  if (!o || !o.gibbets) return;
  o.gibbets.time += dt;
  poseGibbets(o.gibbets, o.gibbets.time);
}
