// The Hundred Arches: a colossal Compact viaduct standing in the Arch Mere of eastern
// Shimmerfen. Nineteen of its hundred spans survive; two great breaks cut it into a south
// road (reached up the sudden hill of the Arches' Foot) and a north road nobody reaches.
//
// Built in the bridge's own frame: local +z runs up the line from the south abutment,
// local x crosses it, y is world height. Chunks of four bays are raised twice from the
// same recipe (full kit near, detail-0 far) like the monuments; colliders, exclusions and
// interactions only come from the full pass, through the same siteFrame as the meshes.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit, siteFrame, groundRange } from './kit.js';
import { PALETTES } from './style.js';
import { seededRandom } from '../core/util.js';
import { LORE, LORE_BY_ID } from '../data/lore.js';
import { VALLEY_FOG, VISTA_SHOTS } from '../data/vistas.js';
import {
  GREAT_BRIDGE as B, ARCH_PIERS, ARCH_BAYS, ARCH_PLATE, ARCH_YAW, ARCH_BAY, ARCH_LENGTH,
  ARCHES_LORE, ARCHES_NOTICE, ARCHES_FOG, ARCHES_SHOTS, archPoint,
} from '../data/greatBridge.js';
import { act } from '../game/hooks.js';

// The mist the piers stand in, the notice at the camp (landmarks.js builds its post) and
// the preview cameras all belong to the feature, so they register with it.
VALLEY_FOG.push(...ARCHES_FOG);
Object.assign(VISTA_SHOTS, ARCHES_SHOTS);
if (!LORE_BY_ID[ARCHES_NOTICE.id]) {
  LORE.push(ARCHES_NOTICE);
  LORE_BY_ID[ARCHES_NOTICE.id] = ARCHES_NOTICE;
}

const noop = () => {};
const TAU = Math.PI * 2;

// Pale Compact limestone, greened at the foot by the fen.
const STONE = {
  ...PALETTES.ancient,
  stone: '#bdb9a6', stone2: '#a29e89', edge: '#d3cfba', dark: '#3c4038', joint: '#7d7a68',
  moss: '#5d7a3a', moss2: '#4a6532', metal: '#6f8f7f', etch: '#3e5a50',
  bark: '#4a3c2e', leaf: '#5d7f38', leaf2: '#6f8a3c', gold: '#d6a23a', gold2: '#c4822c',
  dead: '#5e554b', dead2: '#4c443c', reed: '#8f8a52', reed2: '#6e7a44',
};

const PW = B.pierW;
const W = B.width;
const DECK = B.deck;
const DECK_T = 1.3; // road slab under the surface
const SPAN = ARCH_BAY - PW;
const R = SPAN / 2;
const RING = 3.0; // voussoir depth
const UNDER = DECK - DECK_T; // underside of the road slab
// Pointed arches: two arcs of radius RR, each centred inside the opposite half.
const RR = SPAN * 0.75;
const CX = -R + RR;
const APEX = Math.sqrt(RR * RR - CX * CX);
const SPRING = UNDER - APEX - RING - 1.2; // arch springing line, world y
const intrados = (u) => (Math.abs(u) >= R ? 0 : Math.sqrt(Math.max(0, RR * RR - (Math.abs(u) + CX) ** 2)));
const CHUNK = 4; // bays per LOD chunk

const zOf = (i) => i * ARCH_BAY; // pier centre along the line
const deckBearing = (state) => state === 'whole';

// ---------------------------------------------------------------- shapes
// Voussoirs and spandrel of one bay's arch, kept only where the local offset u (metres from
// the bay centre along the line) lies in [from, to]: whole arches keep everything, broken
// ones keep their springers.
function archRun(k, zc, from = -Infinity, to = Infinity, o = {}) {
  const half = k.detail < 1 ? 3 : Math.max(6, Math.round(SPAN * 0.55));
  const thA = Math.acos(-CX / RR);
  const left = [];
  for (let i = 0; i <= half; i++) {
    const th = Math.PI - (Math.PI - thA) * (i / half);
    left.push([CX + RR * Math.cos(th), RR * Math.sin(th)]);
  }
  const pts = [...left];
  for (let i = half - 1; i >= 0; i--) pts.push([-left[i][0], left[i][1]]);
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [u0, v0] = pts[i], [u1, v1] = pts[i + 1];
    const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
    if (um < from || um > to) continue;
    const len = Math.hypot(u1 - u0, v1 - v0);
    const ang = Math.atan2(v1 - v0, u1 - u0);
    const key = i === half - 1 || i === half;
    k.block(0, SPRING + vm + Math.cos(ang) * RING / 2, zc + um - Math.sin(ang) * RING / 2, W, RING * (key ? 1.15 : 1), len + 0.05, key ? 'stone' : 'edge', { rx: -ang });
  }
  // Spandrel: columns from the extrados to the underside of the road.
  const cols = k.detail < 1 ? 6 : Math.round((SPAN + 2 * RING) / 1.6);
  const total = SPAN + 2 * RING;
  for (let i = 0; i < cols; i++) {
    const u0 = -R - RING + (i / cols) * total, u1 = u0 + total / cols;
    const um = (u0 + u1) / 2;
    if (um < from || um > to) continue;
    const inner = Math.abs(um) < R ? intrados(um) + RING * 0.85 : 0;
    const y0 = SPRING + inner;
    const top = o.top ?? UNDER;
    if (top - y0 > 0.05) k.slab(0, y0, zc + um, W * 0.97, top - y0, u1 - u0 + 0.03, i % 2 ? 'stone' : 'stone2');
  }
}

// String course on corbels under the road edge, then the road slab, along [za, zb].
function roadRun(k, za, zb, rng, o = {}) {
  const len = zb - za;
  if (len <= 0.05) return;
  const zm = (za + zb) / 2;
  k.slab(0, UNDER - 0.55, zm, W + 1.3, 0.6, len, 'edge');
  k.slab(0, UNDER + 0.05, zm, W + 0.5, DECK_T - 0.05, len, 'stone2');
  if (k.detail >= 1) {
    const n = Math.max(1, Math.floor(len / 1.7));
    for (let i = 0; i < n; i++) {
      const z = za + (i + 0.5) * (len / n);
      for (const s of [-1, 1]) k.slab(s * (W / 2 + 0.35), UNDER - 1.35, z, 0.6, 0.8, 0.62, 'stone2');
    }
    // The road: courses of flagstones laid across it, staggered row to row, with the cart
    // ruts worn into the inland lane and grass in the joints.
    const rows = Math.max(1, Math.round(len / 1.8));
    const lane = W - 1.8;
    for (let r = 0; r < rows; r++) {
      const z = za + (r + 0.5) * (len / rows);
      const n = 4 + (r % 2);
      for (let c = 0; c < n; c++) {
        const w = lane / n;
        const x = -lane / 2 + (c + 0.5) * w;
        const roll = rng();
        if (roll < 0.06) continue; // a flag lifted long ago
        const tone = roll < 0.4 ? 'stone' : roll < 0.75 ? 'edge' : 'stone2';
        k.slab(x, DECK - 0.06, z, w - 0.12, 0.08 + rng() * 0.05, len / rows - 0.12, tone, { grad: 0.15 });
        if (rng() < 0.12) k.slab(x + (rng() - 0.5) * w * 0.5, DECK, z, 0.4 + rng() * 0.5, 0.12 + rng() * 0.25, 0.4 + rng() * 0.6, rng() < 0.5 ? 'moss' : 'moss2');
      }
      for (const rx of [-2.6, -0.9]) k.slab(rx, DECK - 0.05, z, 0.45, 0.06, len / rows + 0.02, 'joint', { grad: 0 });
    }
  }
  if (o.parapet !== false) {
    for (const s of [-1, 1]) {
      const keep = o.parapetKeep ? o.parapetKeep(s) : [za, zb];
      if (!keep) continue;
      const [pa, pb] = keep;
      // Broken parapets come down in runs, never as single teeth.
      const segs = Math.max(1, Math.round((pb - pa) / 3.3));
      for (let i = 0; i < segs; i++) {
        const a = pa + (i / segs) * (pb - pa), b = pa + ((i + 1) / segs) * (pb - pa);
        const gone = o.ruined && rng() < 0.22;
        if (gone) continue;
        const h = o.ruined && rng() < 0.3 ? 0.4 + rng() * 0.5 : 1.1;
        k.slab(s * (W / 2 - 0.4), DECK, (a + b) / 2, 0.8, h, b - a + 0.01, i % 2 ? 'stone' : 'stone2');
        if (h > 1 && k.detail >= 1) {
          k.slab(s * (W / 2 - 0.4), DECK + h, (a + b) / 2, 1.0, 0.18, b - a + 0.02, 'edge');
          // a pilaster at each joint, standing proud of the parapet on both faces
          k.slab(s * (W / 2 - 0.4), DECK - 0.05, a + 0.3, 1.25, h + 0.4, 0.6, 'edge');
        }
      }
    }
  }
  // Moss hangs off the string course in curtains.
  if (k.detail >= 1 && o.moss !== false) {
    const n = Math.floor(len / 5);
    for (let i = 0; i < n; i++) {
      if (rng() < 0.45) continue;
      const s = rng() < 0.5 ? -1 : 1;
      const h = 1.5 + rng() * 4.5;
      k.slab(s * (W / 2 + 0.7), UNDER - 0.55 - h, za + (i + rng()) * (len / Math.max(1, n)), 0.12, h, 0.8 + rng() * 1.6, rng() < 0.6 ? 'moss' : 'moss2', { grad: 0.4 });
    }
  }
}

// A ragged break: a few slabs of road of uneven length reaching from z0 in direction dir.
function brokenEdge(k, z0, dir, reach, rng, solid) {
  const strips = 4;
  for (let i = 0; i < strips; i++) {
    const x = -W / 2 + (i + 0.5) * (W / strips);
    const L = reach * (0.45 + rng() * 0.55);
    const zm = z0 + dir * L / 2;
    k.slab(x, UNDER + 0.05, zm, W / strips + 0.02, DECK_T - 0.05, L, i % 2 ? 'stone2' : 'stone');
    k.slab(x, UNDER - 0.55, zm - dir * 0.3, W / strips + (i === 0 || i === strips - 1 ? 0.65 : 0), 0.6, Math.max(0.2, L - 0.6), 'edge');
    solid(x, zm, W / strips, L, UNDER, DECK);
    if (k.detail >= 1) {
      // the reinforcing rubble core shows where the slab sheared
      k.block(x + (rng() - 0.5), UNDER - 0.2 - rng() * 1.2, z0 + dir * L - dir * 0.3, 1 + rng(), 1 + rng(), 0.8, 'dark', { ry: rng() });
    }
  }
}

// Blocky tree that has rooted in the masonry: a trunk and stepped crowns.
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

// A drowned, leafless tree: crooked trunk and a few dead limbs.
function deadTree(k, x, y, z, s, rng) {
  const lean = (rng() - 0.5) * 0.25;
  const h = (6 + rng() * 5) * s;
  k.prism(x, y - 0.6, z, 0.42 * s, h, 'dead', { sides: 5, top: 0.35, rz: lean, rx: (rng() - 0.5) * 0.2 });
  const limbs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < limbs; i++) {
    const a = rng() * TAU;
    const at = h * (0.45 + rng() * 0.4);
    const len = (1.8 + rng() * 2.4) * s;
    k.at({ x: x + Math.sin(lean) * -at, y: y + at, z, ry: a }, (kk) => kk.prism(0, 0, 0, 0.14 * s, len, 'dead2', { sides: 4, top: 0.4, rx: 0.9 + rng() * 0.4 }));
  }
}

function reeds(k, x, y, z, rng) {
  const n = 5 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const h = 1.4 + rng() * 1.3;
    k.slab(x + (rng() - 0.5) * 2.4, y - 0.3, z + (rng() - 0.5) * 2.4, 0.12, h, 0.12, rng() < 0.5 ? 'reed' : 'reed2', { ry: rng() * 3, rz: (rng() - 0.5) * 0.25, grad: 0.5 });
  }
}

// ---------------------------------------------------------------- the recipe
function pierBase(c, i) {
  const { f } = c;
  const z = zOf(i);
  const [lo, hi] = groundRange(c.world.terrain, ...f.at(0, z), W + 6, PW + 2, ARCH_YAW, 3);
  let base = Math.max(hi, 0) + 1.1;
  // When the Arches' Foot buries a pier, keep the shaft starting below the springing
  // line so the head still reads as masonry emerging from the hillside.
  if (ARCH_PIERS[i].top === 1) base = Math.min(base, SPRING - 2);
  return { lo, base };
}

function pier(c, k, i, rng) {
  const def = ARCH_PIERS[i];
  const z = zOf(i);
  const { lo, base } = pierBase(c, i);
  const full = def.top === 1;
  const hill = def.top === 'hill';

  // South approach piers: only a few courses poke from the hillside — the fallen spans
  // are under the mountain, not held up as a stone ramp.
  if (hill) {
    const gy = Math.max(c.f.ground(0, z), base - 2);
    const stub = 1.8 + rng() * 2.4;
    k.footing(0, z, W * 0.9, PW * 0.9, gy, lo, 'stone2', { cap: 'edge' });
    k.masonry(0, gy, z, W * 0.75, stub, PW * 0.75, {});
    if (k.detail >= 1) {
      for (let j = 0; j < 3; j++) {
        const bx = (rng() - 0.5) * (W - 2), bz = (rng() - 0.5) * (PW + 2);
        k.slab(bx, gy + stub * (0.3 + rng() * 0.5), z + bz, 1.4 + rng() * 2, 0.7 + rng(), 1.2 + rng() * 1.6, j % 2 ? 'stone' : 'stone2');
      }
      if (rng() < 0.55) tree(k, (rng() - 0.5) * 4, gy + stub, z + (rng() - 0.5) * 3, 0.7 + rng() * 0.4, rng, true);
    }
    c.solid(0, z, W * 0.75, PW * 0.75, lo - 1, gy + stub);
    c.exclude(0, z, W * 0.7);
    return;
  }

  const top = base + (UNDER - base) * def.top;

  k.footing(0, z, W + 2.6, PW + 2.6, base, lo, 'stone2', { cap: 'edge' });
  c.solid(0, z, W + 2.6, PW + 2.6, lo - 2, base);
  c.exclude(0, z, W * 0.8);
  // Cutwaters: diamond noses on both faces, capped with a sloped hood.
  const nose = PW * 0.74;
  const noseTop = Math.min(top - 1, full ? SPRING - 4 : top - 1);
  if (!def.turrets && noseTop > base + 1) {
    for (const s of [-1, 1]) {
      k.masonry(s * W / 2, base, z, nose, noseTop - base, nose, { ry: Math.PI / 4 });
      k.pyramid(s * W / 2, noseTop, z, nose * 0.72, 2.6, 'stone2', { sides: 4 });
      c.solid(s * W / 2, z, nose, nose, base, noseTop, { rot: Math.PI / 4 });
    }
  }
  // The shaft, stepping in once above the waterline course.
  const shaftTop = full ? SPRING : top;
  const step = base + Math.min(6, Math.max(0.5, (shaftTop - base) * 0.3));
  if (shaftTop > base + 0.4) {
    k.masonry(0, base, z, W + 0.6, Math.max(0.4, step - base), PW + 0.6, {});
    if (shaftTop > step + 0.2) k.masonry(0, step, z, W, shaftTop - step, PW, {});
    if (k.detail >= 1) k.slab(0, step - 0.3, z, W + 1, 0.3, PW + 1, 'edge');
  }
  c.solid(0, z, W + 0.6, PW + 0.6, base, full ? UNDER : top);
  // Green waterline.
  if (k.detail >= 1 && base < 8) k.slab(0, base, z, W + 0.7, 1.3 + rng() * 0.8, PW + 0.7, 'moss2', { grad: 0.2 });

  if (full) {
    k.slab(0, SPRING - 0.5, z, W + 0.5, 0.55, PW + 0.6, 'edge');
    k.masonry(0, SPRING, z, W, UNDER - SPRING, PW, {});
    // A relieving opening through the pier head, seen from both sides of the bridge.
    for (const s of [-1, 1]) {
      k.block(s * (W / 2 + 0.01), SPRING + 9, z, 0.12, 9, 3.2, 'dark', { grad: 0 });
      k.at({ x: s * (W / 2 + 0.06), y: SPRING + 13.5, z, ry: Math.PI / 2 }, (kk) => kk.arch(0, 0, 0, 3.6, { t: 0.6, depth: 0.5, c: 'edge', pointed: true }));
    }
  } else {
    // Broken crown: the last courses stand in a stepped, uneven break.
    const n = k.detail < 1 ? 2 : 5;
    for (let j = 0; j < n; j++) {
      const bx = (rng() - 0.5) * (W - 3), bz = (rng() - 0.5) * (PW - 2);
      const bh = 0.8 + rng() * 3.2;
      k.slab(bx, top, z + bz, 2.2 + rng() * 3, bh, 1.6 + rng() * 2.4, j % 2 ? 'stone' : 'stone2');
    }
    if (k.detail >= 1) {
      k.rubble(W / 2 + 4, Math.max(c.f.ground(W / 2 + 4, z), -1.2), z + 3, 5, 9, rng, { size: 1.7, ground: (x, z) => Math.max(c.f.ground(x, z), -1.2) });
      tree(k, (rng() - 0.5) * 3, top + 0.5, z, 0.9 + rng() * 0.4, rng, rng() < 0.5);
    }
  }

  // Square turrets that rise past the parapet, standing on the cutwater footings.
  if (def.turrets) {
    const ruin = def.turrets === 'ruin';
    for (const s of [-1, 1]) {
      const tx = s * (W / 2 + 2.3);
      const h = (ruin ? DECK + (s > 0 ? 2.5 : 5.5) : DECK + 9) - base;
      k.footing(tx, z, 5.4, 5.4, base, lo, 'stone2', { cap: 'edge' });
      if (ruin) {
        k.masonry(tx, base, z, 4.6, h, 4.6, {});
        k.slab(tx - 0.8, base + h, z + 0.6, 2.2, 1.6, 2.4, 'stone2');
        if (k.detail >= 1) tree(k, tx + 0.6, base + h, z - 0.8, 0.8, rng, true);
      } else {
        const ty = k.tower(tx, base, z, 4.6, h, { setbacks: [0.62], taper: 0.9, windows: true, crenel: true });
        if (k.detail >= 1) k.pinnacle(tx, ty + 0.35, z, 0.7);
      }
      c.solid(tx, z, 4.6, 4.6, base, base + h);
    }
  }

  // The wardens' post: a gatehouse over the road, with a stair turret on its inland corner.
  if (def.gatehouse) {
    const gh = 11, gl = 10, pass = 5.4;
    for (const s of [-1, 1]) {
      const bx = s * (pass / 2 + (W + 1 - pass) / 4);
      k.masonry(bx, DECK, z, (W + 1 - pass) / 2, gh, gl, {});
      c.solid(bx, z, (W + 1 - pass) / 2, gl, DECK, DECK + gh);
      if (k.detail >= 1) {
        k.window(s * ((W + 1) / 2 + 0.01), DECK + 6.5, z - 2, 0.8, 1.6, { ry: s * Math.PI / 2 });
        k.window(s * ((W + 1) / 2 + 0.01), DECK + 6.5, z + 2, 0.8, 1.6, { ry: s * Math.PI / 2 });
      }
    }
    k.masonry(0, DECK + 6.6, z, pass + 0.1, gh - 6.6, gl, {});
    c.solid(0, z, pass, gl, DECK + 6.6, DECK + gh);
    for (const s of [-1, 1]) k.at({ x: 0, y: DECK + 4, z: z + s * (gl / 2 + 0.05) }, (kk) => kk.arch(0, 0, 0, pass, { t: 0.7, depth: 0.7, c: 'edge', spandrel: false }));
    k.slab(0, DECK + gh, z, W + 1.6, 0.35, gl + 0.6, 'edge');
    k.crenels(-(W + 1) / 2, z - gl / 2, (W + 1) / 2, z - gl / 2, DECK + gh + 0.35, 0.5, {});
    k.crenels(-(W + 1) / 2, z + gl / 2, (W + 1) / 2, z + gl / 2, DECK + gh + 0.35, 0.5, {});
    k.crenels(-(W + 1) / 2, z - gl / 2, -(W + 1) / 2, z + gl / 2, DECK + gh + 0.35, 0.5, {});
    k.crenels((W + 1) / 2, z - gl / 2, (W + 1) / 2, z + gl / 2, DECK + gh + 0.35, 0.5, {});
    const tx = -(W + 1) / 2 + 1.6, tz = z + gl / 2 - 1.6;
    const ty = k.tower(tx, DECK + gh, tz, 3.6, 6.5, { setbacks: [], windows: false });
    k.roof('spire', tx, ty, tz, 3.6, 3.6, 5.5, { c: 'roof', overhang: 0.3 });
  }
}

function bay(c, k, i, rng) {
  const state = ARCH_BAYS[i];
  const za = zOf(i), zb = zOf(i + 1), zc = (za + zb) / 2;
  const { f } = c;
  if (state === 'whole') {
    archRun(k, zc);
    roadRun(k, za, zb, rng, { ruined: i >= 10 });
    c.solid(0, zc, W, ARCH_BAY, UNDER, DECK);
    for (const s of [-1, 1]) c.solid(s * (W / 2 - 0.4), zc, 0.8, ARCH_BAY, DECK, DECK + 1.1);
    // The north road has gone to grass and saplings; nobody walks it.
    if (i >= 10 && k.detail >= 1) {
      for (let t = 0; t < 2; t++) if (rng() < 0.6) tree(k, (rng() - 0.5) * (W - 4), DECK, za + rng() * ARCH_BAY, 0.7 + rng() * 0.5, rng, rng() < 0.4);
    }
    return;
  }
  if (state === 'approach') {
    if (i !== 0) return; // one pass dresses the whole south hillside
    const zTop = zOf(3) - PW / 2;
    const zFoot = -6;
    // The causeway starts where the crest comes down below the road's height.
    let zA = zTop;
    while (zA > zFoot + 10 && f.ground(0, zA - 1) < DECK + 0.3) zA -= 1;
    // Half-buried remnants of the fallen span: courses and parapet stubs bedded into the
    // hillside so the climb reads as land, not a ramp on stilts.
    if (k.detail >= 1) {
      for (let j = 0; j < 14; j++) {
        const u = rng();
        const z = zFoot + u * (zTop - zFoot);
        const sx = (rng() - 0.5) * (W + 4);
        // each piece beds into the ground under it, never hovering over the water's edge
        const gy = f.ground(sx, z);
        const w = 2.2 + rng() * 3.5, h = 0.7 + rng() * 1.1, d = 1.4 + rng() * 2.2;
        const tilt = { rx: (rng() - 0.5) * 0.35, rz: (rng() - 0.5) * 0.25, ry: (rng() - 0.5) * 0.4 };
        if (gy < -0.6 || (z > zA - 3 && Math.abs(sx) < W / 2 + 3)) continue;
        k.slab(sx, gy - 0.35, z, w, h, d, j % 2 ? 'stone2' : 'stone', tilt);
      }
      for (let j = 0; j < 5; j++) {
        const z = zFoot + 8 + rng() * (zTop - zFoot - 16);
        const sx = (rng() < 0.5 ? -1 : 1) * (W / 2 + 2 + rng() * 4);
        const gy = f.ground(sx, z);
        const r = 4 + rng() * 3, n = 6 + Math.floor(rng() * 5), size = 1.5 + rng();
        if (gy > -0.6) k.rubble(sx, gy, z, r, n, rng, { size, ground: f.ground });
      }
    }
    // The causeway: the road carried from the crest to the first standing pier at its own
    // height, on coursed blocks that each reach the ground under them and step down with it.
    // Parapets stand along the stretches where the hill falls away beside the road.
    const z1 = zTop + 0.4, n = Math.max(1, Math.round((z1 - zA) / 2.4)), cd = (z1 - zA) / n, cw = W / 3;
    for (let j = 0; j < n; j++) {
      const z = zA + cd * (j + 0.5);
      for (let q = 0; q < 3; q++) {
        const x = -W / 2 + cw * (q + 0.5);
        const lo = Math.min(f.lowest(cw, cd, x, z), DECK) - 0.8;
        if (lo < UNDER - 1.35) k.masonry(x, lo, z, cw + 0.02, UNDER - 0.55 - lo, cd + 0.02, { c: 'stone2', c2: 'stone', course: 1.1 });
        c.solid(x, z, cw, cd + 0.04, lo, DECK);
      }
    }
    const drops = (s, z) => f.ground(s * (W / 2 + 1.2), z) < DECK - 0.9;
    const keep = (s) => {
      let za = z1;
      while (za - 0.5 > zA && drops(s, za - 0.5)) za -= 0.5;
      return za < z1 - 1.5 ? [za, z1] : null;
    };
    roadRun(k, zA, z1, rng, { moss: true, parapetKeep: keep });
    for (const s of [-1, 1]) {
      const kept = keep(s);
      if (kept) c.solid(s * (W / 2 - 0.4), (kept[0] + kept[1]) / 2, 0.8, kept[1] - kept[0], DECK, DECK + 1.1);
    }
    // the spur the road climbs is the approach: the scatter keeps off its rock and the causeway
    for (let z = zFoot; z <= zTop; z += 12) c.exclude(0, z, 40);
    return;
  }
  if (state === 'jut') {
    // The south road ends here: a ragged reach of road past the pier, springers below it.
    archRun(k, zc, -Infinity, -R + 7.5, { top: UNDER });
    archRun(k, zc, R - 2.4, Infinity, { top: SPRING + APEX * 0.6 });
    const z0 = za + PW / 2;
    roadRun(k, za, z0, rng, { moss: false, parapetKeep: () => [za, z0] });
    c.solid(0, (za + z0) / 2, W, z0 - za, UNDER, DECK);
    brokenEdge(k, z0, 1, 9, rng, c.solid);
    // Parapet stubs on the jut: the inland one carries the service plate.
    k.slab(-(W / 2 - 0.4), DECK, z0 + 2.5, 0.8, 1.1, 5, 'stone');
    k.slab(-(W / 2 - 0.4), DECK + 1.1, z0 + 2.5, 1.0, 0.18, 5, 'edge');
    k.slab(W / 2 - 0.4, DECK, z0 + 1.4, 0.8, 0.8, 2.8, 'stone2');
    c.solid(-(W / 2 - 0.4), z0 + 2.5, 0.8, 5, DECK, DECK + 1.1);
    c.solid(W / 2 - 0.4, z0 + 1.4, 0.8, 2.8, DECK, DECK + 0.8);
    fallen(c, k, i, rng, 0.55);
    return;
  }
  if (state === 'stub') {
    archRun(k, zc, -Infinity, -R + 3, { top: SPRING + APEX * 0.55 });
    archRun(k, zc, R - 3, Infinity, { top: SPRING + APEX * 0.55 });
    fallen(c, k, i, rng, 0.7);
    return;
  }
  fallen(c, k, i, rng, 1);
}

// What a fallen bay left in the water: road slabs, a broken ring and smaller courses.
function fallen(c, k, i, rng, amount) {
  if (k.detail < 1 && amount < 0.8) return;
  const { f } = c;
  const zc = (zOf(i) + zOf(i + 1)) / 2;
  // what fell rests on the bed under it; where that bed is too deep to see, nothing is laid
  const g = (x, z) => f.ground(x, z);
  const seen = (x, z) => g(x, z) > -2.4;
  const slabs = Math.round(2 * amount + 0.4);
  for (let s = 0; s < slabs; s++) {
    const x = (rng() - 0.5) * 10, z = zc + (rng() - 0.5) * (SPAN - 8);
    const ry = (rng() - 0.5) * 0.9, rx = (rng() - 0.5) * 0.5, rz = (rng() - 0.5) * 0.5;
    const w = W * (0.5 + rng() * 0.4), d = 6 + rng() * 5;
    if (!seen(x, z)) continue;
    k.block(x, g(x, z) + 0.2, z, w, DECK_T + 0.6, d, s % 2 ? 'stone2' : 'stone', { rx, ry, rz });
    c.solid(x, z, W * 0.45, 5, g(x, z) - 1, g(x, z) + 0.9, { rot: ry });
  }
  // A run of the arch ring, still joined, lying on its side.
  // rx ≈ π/2 folds the XY voussoir run into the ground plane; RING is the vertical axis.
  if (rng() < 0.8 * amount) {
    const x = (rng() < 0.5 ? -1 : 1) * (4 + rng() * 6), z = zc + (rng() - 0.5) * 10;
    if (seen(x, z)) {
      const gy = g(x, z);
      k.at({ x, y: gy + RING * 0.5, z, ry: rng() * TAU, rx: Math.PI / 2 - 0.18 }, (kk) => {
        for (let j = 0; j < 4; j++) {
          const a = j * 0.25;
          kk.block(Math.cos(a) * 6, Math.sin(a) * 6, 0, 2.1, 4, RING, 'edge', { rz: a });
        }
      });
    }
  }
  if (k.detail >= 1) {
    for (let r = 0; r < 3; r++) {
      const x = (rng() - 0.5) * 18, z = zc + (rng() - 0.5) * SPAN;
      const rad = 4 + rng() * 4, size = 1.5 + rng();
      if (seen(x, z)) k.rubble(x, g(x, z), z, rad, Math.round(8 * amount) + 3, rng, { size, ground: g });
    }
  }
  c.exclude(0, zc, 14);
}

// Exposed pier heads at the ends of a road get a piece of road and a ragged break.
function pierRoad(c, k, i, rng) {
  const def = ARCH_PIERS[i];
  if (def.top !== 1) return;
  const z = zOf(i);
  const south = i > 0 && !deckBearing(ARCH_BAYS[i - 1]) && ARCH_BAYS[i - 1] !== 'jut';
  const north = i < ARCH_BAYS.length && !deckBearing(ARCH_BAYS[i]) && ARCH_BAYS[i] !== 'jut';
  if (!south && !north) return;
  const za = south ? z - PW / 2 : z;
  const zb = north ? z + PW / 2 : z;
  roadRun(k, za, zb, rng, { moss: false, ruined: true, parapetKeep: () => [za + 0.6, zb - 0.6] });
  c.solid(0, (za + zb) / 2, W, zb - za, UNDER, DECK);
  if (south && ARCH_BAYS[i - 1] !== 'approach') brokenEdge(k, za, -1, 3.5, rng, c.solid);
  if (north) brokenEdge(k, zb, 1, 3.5, rng, c.solid);
  if (def.lone && k.detail >= 1) {
    tree(k, 2, DECK, z + 1, 1.4, rng, true);
    tree(k, -3, DECK, z - 1.5, 1.0, rng, false);
  }
}

// The service plate: verdigris bronze set into the inland parapet of the jut.
function plate(c, k) {
  const z = zOf(ARCH_PLATE.bay) + PW / 2 + ARCH_PLATE.along;
  const x = ARCH_PLATE.side * (W / 2 - 0.4) - ARCH_PLATE.side * 0.42;
  k.block(x, DECK + 0.62, z, 0.08, 0.8, 1.4, 'metal', { layer: 'metal' });
  if (k.detail >= 1) for (let l = 0; l < 4; l++) k.block(x - ARCH_PLATE.side * 0.03, DECK + 0.38 + l * 0.15, z, 0.04, 0.04, 1.1 - (l % 2) * 0.3, 'etch', { grad: 0 });
  return { x: x - ARCH_PLATE.side * 0.6, y: DECK, z };
}

// Mere dressing for one chunk's stretch: drowned trees, reed beds, golden trees on islets.
function mere(c, k, z0, z1, rng) {
  if (k.detail < 1) return;
  const { f } = c;
  for (let t = 0; t < 40; t++) {
    const x = (rng() < 0.5 ? -1 : 1) * (14 + rng() * 80), z = z0 + rng() * (z1 - z0);
    const g = f.ground(x, z);
    if (g < -0.2 && g > -1.5) {
      if (rng() < 0.22) deadTree(k, x, g, z, 0.8 + rng() * 0.5, rng);
      else reeds(k, x, g, z, rng);
    } else if (g > 0.6 && g < 3.2 && rng() < 0.18) {
      tree(k, x, g - 0.1, z, 1.2 + rng() * 0.7, rng, rng() < 0.65);
      c.exclude(x, z, 3);
    }
  }
}

// ---------------------------------------------------------------- raising it
function raiseChunk(world, f, ci, exclusions) {
  const levels = [];
  let plateAt = null;
  const p0 = ci * CHUNK, p1 = Math.min(ARCH_PIERS.length - 1, p0 + CHUNK - 1);
  for (const detail of [1, 0]) {
    const first = detail === 1;
    const k = new Kit(STONE, { detail, shadow: first });
    const rng = seededRandom(9100 + ci * 31);
    const c = {
      f,
      world,
      detail,
      solid: first ? f.solid : noop,
      exclude: first ? (lx, lz, r) => {
        const [x, z] = f.at(lx, lz);
        exclusions.push({ x, z, r });
      } : noop,
    };
    for (let i = p0; i <= p1; i++) {
      pier(c, k, i, rng);
      pierRoad(c, k, i, rng);
      if (i < ARCH_BAYS.length) bay(c, k, i, rng);
      if (i === ARCH_PLATE.bay) {
        const at = plate(c, k);
        if (first) plateAt = at;
      }
    }
    mere(c, k, zOf(p0) - ARCH_BAY / 2, zOf(p1) + ARCH_BAY / 2, rng);
    const g = k.build(`arches_${ci}_lod${detail ? 0 : 1}`);
    levels.push(g);
  }
  const root = new THREE.Group();
  root.name = 'hundred_arches_' + ci;
  root.position.set(f.x, 0, f.z);
  root.rotation.y = f.yaw;
  root.add(levels[0], levels[1]);
  levels[1].visible = false;
  world.scene.add(root);
  const [cx, cz] = f.at(0, (zOf(p0) + zOf(p1)) / 2);
  return { root, full: levels[0], mid: levels[1], pos: new THREE.Vector3(cx, DECK * 0.6, cz), half: (zOf(p1) - zOf(p0)) / 2, plateAt };
}

export function buildGreatBridge(world, exclusions = []) {
  const f = siteFrame(world, B.x0, B.z0, ARCH_YAW, 0);
  const chunks = [];
  let plateAt = null;
  const n = Math.ceil(ARCH_PIERS.length / CHUNK);
  for (let ci = 0; ci < n; ci++) {
    const ch = raiseChunk(world, f, ci, exclusions);
    if (ch.plateAt) plateAt = ch.plateAt;
    chunks.push(ch);
  }

  // The plate is a written source: registered here, after landmarks.js has built its own
  // carriers, so it is read off the parapet instead of a stone in the water below.
  if (plateAt) {
    const [x, z] = f.at(plateAt.x, plateAt.z);
    for (const l of ARCHES_LORE) {
      if (!LORE_BY_ID[l.id]) {
        l.x = x;
        l.z = z;
        LORE.push(l);
        LORE_BY_ID[l.id] = l;
      }
    }
    const lore = LORE_BY_ID[ARCH_PLATE.id];
    const verb = 'Read the carving';
    const interaction = world.addInteract({
      id: 'lore_' + lore.id,
      kind: 'lore',
      pos: new THREE.Vector3(x, plateAt.y + 1, z),
      radius: 3,
      label: `${verb}: ${lore.title}`,
      use: () => act('readLore', lore.id),
    });
    if (world.loreTablets) world.loreTablets.push({ lore, group: null, kind: 'carving', interaction, verb });
  }

  // Full detail near, the detail-0 pass everywhere else.
  world.animated.push(() => {
    const cam = G.game?.camera;
    if (!cam) return;
    const low = G.game?.settings?.quality === 'low';
    for (const ch of chunks) {
      const d = Math.max(0, cam.position.distanceTo(ch.pos) - ch.half);
      const full = d < (low ? 140 : 320);
      ch.full.visible = full;
      ch.mid.visible = !full;
    }
  });
  world.greatBridge = { chunks, frame: f, length: ARCH_LENGTH };
  return world.greatBridge;
}

// For tests and tools: world point of the road surface `along` metres up the line.
export function deckPoint(along, side = 0) {
  const [x, z] = archPoint(along, side);
  return { x, y: DECK, z };
}
