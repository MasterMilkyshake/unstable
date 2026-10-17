// Skyline landmarks: the Unmoored Keystone and one signature monument per surface isle.
// All of them are the older masonry (the builders before the towns), so they share one
// kit vocabulary and the ancient palettes in style.js. Each is built twice from the same
// recipe: the full kit pass near, the kit's detail-0 pass everywhere else, so the far read
// is the same silhouette in fewer triangles rather than a painted card.
//
// Every monument stands where its lore puts it, on ground that can carry it; colliders go
// through the same site frame as the meshes, so stairs and ledges are where they look.
import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';
import { seededRandom } from '../core/util.js';
import { MONUMENTS, KEYSTONE } from '../data/vistas.js';
import { LORE_BY_ID } from '../data/lore.js';
import { act } from '../game/hooks.js';
import { addShelter } from './mason.js';

const noop = () => {};
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- palettes
const ISLE = { ...PALETTES.ancient, glow: '#7affd8', crystal: '#a98cff', metal: '#3a3640', moss: '#5f7d3c', earth: '#6b553c', bark: '#4a3a2a', leaf: '#557a34', leaf2: '#6f8a3a', leaf3: '#c4943a' };
const ABBEY = { ...PALETTES.ancient, roof: '#46545a', glow: '#ffcf8a', bell: '#8a6a3a', wood: '#5b4636', rope: '#a8895a', candle: '#e8dcc0', glass: '#4a6a72', cloth: '#6a2a2e' };
const NEEDLES = { ...PALETTES.ancient_thorn, roof: '#3e3430', nest: '#4a3a2a' };
const NAVE = { ...PALETTES.ancient_fen, pool: '#1e3a36', reed: '#7a8a4a', glow: '#7affd0' };
const KEEP = { ...PALETTES.ancient_frost, ice: '#cfe6f2', ice2: '#b4d2e2', crystal: '#bfe8ff' };
const CIRCLET = { ...PALETTES.ancient_ash, obsidian: '#1c1718', obsidian2: '#2a2224', glow: '#ff7a2a' };
const VERD = { ...PALETTES.ancient_verd, bark: '#4e3a26', bark2: '#5e4630', leaf: '#4f7a34', leaf2: '#6a8f3a', gold: '#d0a040' };

// ---------------------------------------------------------------- shapes
function quad(o, a, b, c, d) {
  o.push(...a, ...b, ...c, ...a, ...c, ...d);
}
// A box whose bottom face is `ratio` as wide (x) as its top: voussoirs and keystones.
const trapCache = new Map();
function trapUnit(ratio) {
  const key = ratio.toFixed(3);
  let u = trapCache.get(key);
  if (u) return u;
  const o = [];
  const b = ratio / 2;
  const A = [-b, -0.5, 0.5], B = [b, -0.5, 0.5], C = [b, -0.5, -0.5], D = [-b, -0.5, -0.5];
  const E = [-0.5, 0.5, 0.5], F = [0.5, 0.5, 0.5], G = [0.5, 0.5, -0.5], H = [-0.5, 0.5, -0.5];
  quad(o, A, B, F, E);
  quad(o, C, D, H, G);
  quad(o, B, C, G, F);
  quad(o, D, A, E, H);
  quad(o, E, F, G, H);
  quad(o, D, C, B, A);
  u = new Float32Array(o);
  trapCache.set(key, u);
  return u;
}
function trapezoid(k, x, y, z, wTop, wBot, h, d, c, o = {}) {
  return k.emit(trapUnit(wBot / wTop), k.local(x, y + h / 2, z, wTop, h, d, o), c, o);
}
// A cone or frustum hanging from y and narrowing downward.
function spike(k, x, y, z, r, h, c, o = {}) {
  return k.inverted(x, y, z, (kk) => kk.prism(0, 0, 0, r, h, c, { sides: o.sides ?? 7, top: o.top ?? 0, dr: o.dr ?? r }), o.ry || 0);
}

function tree(k, x, y, z, s, rng, leaf = 'leaf') {
  const lean = (rng() - 0.5) * 0.14, ry = rng() * TAU, alt = rng() < 0.5;
  k.prism(x, y - 0.4, z, 0.34 * s, 3.6 * s, 'bark', { sides: 5, top: 0.55, rz: lean, ry });
  const cy = y + 3.2 * s;
  k.rock(x, cy + 1.3 * s, z, 3.8 * s, 2.9 * s, 3.5 * s, leaf, { ry, grad: 0.4 });
  if (k.detail < 1) return;
  k.rock(x + 1.2 * s, cy + 0.6 * s, z - 0.7 * s, 2.3 * s, 1.9 * s, 2.3 * s, alt ? leaf : 'leaf2', { ry: ry + 1, grad: 0.4 });
  k.rock(x - 0.9 * s, cy + 2.3 * s, z + 0.6 * s, 2.1 * s, 1.7 * s, 2.1 * s, 'leaf2', { ry: ry + 2, grad: 0.4 });
}

// One chain link standing on its lower end bar; open sprung links lose a side.
function link(k, x, y, z, len, w, bar, ry, open = false) {
  k.at({ x, y, z, ry }, (kk) => {
    const m = { layer: 'metal' };
    kk.slab(-w / 2 + bar / 2, bar * 0.5, 0, bar, len - bar, bar, 'metal', m);
    if (!open) kk.slab(w / 2 - bar / 2, bar * 0.5, 0, bar, len - bar, bar, 'metal', m);
    else kk.slab(w / 2 - bar / 2, len * 0.62, 0, bar, len * 0.38 - bar * 0.5, bar, 'metal', { ...m, rz: -0.4 });
    kk.slab(0, len - bar, 0, w, bar, bar, 'metal', m);
    if (!open) kk.slab(0, 0, 0, w, bar, bar, 'metal', m);
  });
}

// A dressed carving stone: the lore of a monument cut into a boulder beside its approach.
function carving(k, x, y, z, ry) {
  k.at({ x, y, z, ry }, (kk) => {
    kk.rock(0, 0.55, 0, 2.0, 1.5, 1.3, 'stone2', { grad: 0.3 });
    kk.slab(0, 0.35, 0.48, 1.2, 0.95, 0.12, 'edge', { rx: -0.12 });
    if (kk.detail >= 1) for (let i = 0; i < 4; i++) kk.slab(0, 1.08 - i * 0.16, 0.56 - i * 0.02, 0.86 - (i % 2) * 0.2, 0.035, 0.03, 'dark', { grad: 0, rx: -0.12 });
  });
}

// ---------------------------------------------------------------- the Unmoored Keystone
// The crown of a lattice station's great arch, torn loose at the break and held aloft by
// the strain it still stores. Its housing is coursed masonry, cracked where the seam runs;
// the arch it closed fell away on both sides, leaving stubs of voussoirs. Two command-line
// chains run from iron eyes in the broken ends down to the chain-houses that still anchor
// them in the ground, so every link has something to hold at both ends. It is a skyline
// bearing only — no climb. The ground carving at the reach records what it was.
const KEY_ANCHORS = [
  // Monument-local (x, z) of the chain-houses: on the two bluff tops either side of the
  // North Road's ravine, just behind the town walls, so from the harbour and the Wash the
  // lines fall steeply behind Saltreach instead of slanting across its skyline.
  { lx: 44, lz: 89, side: 1 },
  { lx: -103, lz: 56, side: -1 },
];
const ARCH = { cy: -39.3, ri: 29.3, ro: 53.3, depth: 18, half: Math.atan2(10, 53.3) };

// A voussoir of the great arch at angle a (radians from the crown, + toward local +x),
// laid in courses so it reads as built; `cut` shortens a broken one from its outer end.
function voussoir(k, a, o = {}) {
  const { cy, ri, ro, depth, half } = ARCH;
  const top = 2 * ro * Math.tan(half), bot = 2 * ri * Math.tan(half);
  const ro2 = ro - (o.cut || 0);
  k.at({ y: cy, rz: -a }, (v) => {
    const courses = v.detail >= 1 ? 6 : 2;
    const span = ro2 - ri;
    for (let i = 0; i < courses; i++) {
      const r0 = ri + (span * i) / courses, r1 = ri + (span * (i + 1)) / courses;
      const w0 = bot + (top - bot) * ((r0 - ri) / (ro - ri)), w1 = bot + (top - bot) * ((r1 - ri) / (ro - ri));
      const inset = i % 2 ? 0.3 : 0;
      trapezoid(v, 0, r0, 0, w1 - inset, w0 - inset, r1 - r0 + 0.02, depth - inset * 2, i % 2 ? 'stone2' : 'stone');
    }
    if (o.cut && v.detail >= 1) {
      // The break: a ragged lip of half-courses where the next voussoir tore away.
      for (let j = 0; j < 4; j++) v.slab((j - 1.5) * 2.4, ro2 - 0.2, (j % 2 - 0.5) * 6, 2.2, 1.2 + (j % 3) * 0.7, depth * 0.36, j % 2 ? 'stone2' : 'stone', { rz: (j - 1.5) * 0.08 });
    }
  });
}

// Where a point at radius r, angle a of the arch sits in the keystone's frame.
function archPoint(a, r) {
  return [Math.sin(a) * r, ARCH.cy + Math.cos(a) * r];
}

// Links strung from a to b with a little sag; each link stands along the line and every
// other one is turned a quarter about it. Far detail is one bar per link.
function chainLine(k, a, b, o = {}) {
  const len = o.len ?? 3.4, w = o.w ?? 1.9, bar = o.bar ?? 0.5;
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const dist = Math.hypot(dx, dy, dz);
  const n = Math.max(2, Math.round(dist / (len - bar)));
  const sag = o.sag ?? dist * 0.025;
  const pt = (t) => [a[0] + dx * t, a[1] + dy * t - Math.sin(Math.PI * t) * sag, a[2] + dz * t];
  for (let i = 0; i < n; i++) {
    const p = pt(i / n), q = pt((i + 1) / n);
    const ex = q[0] - p[0], ey = q[1] - p[1], ez = q[2] - p[2];
    const el = Math.hypot(ex, ey, ez);
    const rx = Math.acos(Math.max(-1, Math.min(1, ey / el)));
    const ry = Math.atan2(ex, ez);
    k.at({ x: p[0], y: p[1], z: p[2], ry, rx }, (kk) => {
      if (kk.detail >= 1) link(kk, 0, 0, 0, el + bar, w, bar, i % 2 ? Math.PI / 2 : 0);
      else kk.slab(0, 0, 0, i % 2 ? bar : w * 0.7, el, i % 2 ? w * 0.7 : bar, 'metal', { layer: 'metal' });
    });
  }
}

// An iron eye: a squared ring of bars in the plane facing `ry`, centred at (x, y, z).
function ironEye(k, x, y, z, r, bar, ry, rz = 0) {
  k.at({ x, y, z, ry, rz }, (e) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      e.block(Math.cos(a) * r, Math.sin(a) * r, 0, bar, r * 0.85, bar, 'metal', { rz: a, layer: 'metal' });
    }
    e.block(0, 0, -0.5, r * 2.6, r * 2.6, 0.5, 'metal', { layer: 'metal' });
  });
}

// A chain-house: the squat stone block that holds a command line in the ground. Its face
// leans toward the Keystone, the eye set in the slope; a slate roof keeps the windlass dry.
function chainHouse(k, lx, ly, lz, yaw, lowest) {
  k.at({ x: lx, y: ly, z: lz, ry: yaw }, (h) => {
    h.footing(0, 0, 12.4, 12.4, 0.4, lowest - ly, 'stone2', { cap: 'edge' });
    h.masonry(0, 0.4, 0, 11, 2.2, 11, { c: 'stone2', c2: 'stone', course: 1.1 });
    h.masonry(0, 2.6, -1, 8.4, 5.2, 7.4, { c: 'stone', c2: 'stone2', course: 1.3 });
    h.cornice(0, 7.4, -1, 8.4, 7.4, 'edge');
    // The glacis on the Keystone side takes the pull.
    h.ramp(0, 2.6, 4.0, 8.4, 4.8, 2.6, 'stone2', { ry: 0 });
    for (const sx of [-1, 1]) h.buttress(sx * 4.2, 2.6, -1, 4.6, { ry: sx * Math.PI / 2, w: 1.0, depth: 1.4, stages: 2 });
    h.roof('hip', 0, 7.9, -1, 7.4, 6.4, 3.0, { c: 'roof', overhang: 0.6 });
    h.slab(0, 2.6, -4.72, 1.6, 2.4, 0.1, 'dark', { grad: 0 });
    h.lantern(-5.2, 0.4, 5.4, { post: 2.8 });
  });
}

function keystone(c) {
  const { def, f } = c;
  const hang = def.hangY;
  const rng = seededRandom(1309);
  const isle = c.part('isle', ISLE, { y: hang });
  const { ri, ro, depth, half } = ARCH;
  const top = 14;

  // The housing: the keystone itself, coursed, its crown cornice and the turf it carried up.
  voussoir(isle, 0);
  isle.slab(0, top - 0.1, 0, 21.4, 0.6, depth + 1.2, 'edge');
  isle.slab(0, top + 0.5, 0, 19.6, 0.35, depth - 0.6, 'moss');
  // Carved faces: a recessed panel and the lattice mark (a ring quartered by bars), the seam
  // crack of the break running through both.
  for (const s of [-1, 1]) {
    const zf = s * (depth / 2 + 0.04);
    if (isle.detail >= 1) {
      trapezoid(isle, 0, -6, zf, 15.4, 10.8, 18.5, 0.25, 'edge');
      trapezoid(isle, 0, -5.2, zf + s * 0.1, 13.6, 9.6, 16.8, 0.2, 'stone2');
    }
    ironEye(isle, 0, 4.2, zf + s * 0.25, 3.2, 0.6, s < 0 ? Math.PI : 0);
    for (let i = 0; i < 4; i++) {
      isle.glowPanel(0.6 * Math.sin(i * 2.3) - 1.2, -8 + i * 5.2, zf + s * 0.32, 0.36, 5.4, 0.08, 'glow', 1.35, { rz: (i % 2 ? 0.28 : -0.22) });
    }
  }
  // An iron band round the housing's waist carries the eyes the chains are fixed to.
  isle.slab(0, -3.4, 0, 2 * (ri + 9) * Math.tan(half) + 0.5, 1.1, depth + 0.5, 'metal', { layer: 'metal' });

  // What is left of the arch: two voussoirs to the west of the crown, one and a broken
  // half to the east. What tore away fell with the coast; nothing hangs loose in the air.
  voussoir(isle, -2 * half);
  voussoir(isle, -4 * half, { cut: 9 });
  voussoir(isle, 2 * half, { cut: 4.5 });

  // Turf and a few trees the housing tore up with it, on the crown and the stubs.
  const [wx, wy] = archPoint(-2 * half, ro), [ex1, ey1] = archPoint(2 * half, ro - 4.5);
  const trees = [[-6.4, top + 0.85, 5.6, 0.85], [7.0, top + 0.85, -5.8, 0.75], [wx + 1, wy - 0.4, 3, 0.8], [ex1 - 1, ey1 - 0.4, -3, 0.7]];
  trees.forEach(([x, y, z, s], i) => {
    if (isle.detail < 1 && i % 2) { rng(); rng(); rng(); return; }
    tree(isle, x, y, z, s, rng, i === 2 ? 'leaf3' : 'leaf');
  });

  // The regulator rotunda on the crown: eight columns round the governor that still turns.
  isle.at({ y: top + 0.85 }, (k) => {
    k.prism(0, 0, 0, 5.0, 0.4, 'edge', { sides: 10 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.column(Math.cos(a) * 4.0, 0.4, Math.sin(a) * 4.0, 4.4, 0.36, { sides: 6 });
    }
    k.prism(0, 4.8, 0, 4.7, 0.6, 'edge', { sides: 10 });
    k.roof('dome', 0, 5.4, 0, 9, 9, 3.4, { c: 'roof', sides: 10 });
    k.prism(0, 0.4, 0, 1.2, 1.6, 'stone2', { sides: 8 });
  });
  // Built about its own centre so it can turn in place.
  const governor = c.part('governor', ISLE, { y: hang + top + 3.6, dynamic: true });
  governor.at({}, (k) => {
    for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2]]) {
      k.at({ rx, ry }, (r) => {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          r.block(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5, 0.95, 0.18, 0.18, 'metal', { ry: -a + Math.PI / 2, layer: 'metal' });
        }
      });
    }
    k.glowPanel(0, 0, 0, 0.7, 0.7, 0.7, 'glow', 1.4);
  });

  // The chains, fixed at both ends: eyes in the broken stubs, eyes in the chain-houses.
  const chains = c.part('chains', ISLE);
  const houses = c.part('houses', ISLE);
  for (const an of KEY_ANCHORS) {
    const endA = an.side > 0 ? 3 * half - 0.05 : -5 * half + 0.05;
    const endR = an.side > 0 ? (ri + ro - 4.5) / 2 : (ri + ro - 9) / 2;
    const [ex, ey] = archPoint(endA, endR);
    const ly = f.ground(an.lx, an.lz);
    const yaw = Math.atan2(-an.lx, -an.lz);
    chainHouse(houses, an.lx, ly, an.lz, yaw, f.lowest(12.4, 12.4, an.lx, an.lz, yaw));
    // The eye on the glacis, in monument space.
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const eye = [an.lx + fx * 4.0, ly + 5.0, an.lz + fz * 4.0];
    ironEye(houses, eye[0], eye[1], eye[2], 0.9, 0.36, yaw);
    ironEye(isle, ex + an.side * 0.6, ey, 0, 1.1, 0.42, Math.PI / 2, -endA);
    chainLine(chains, [ex + an.side * 1.4, hang + ey, 0], eye, { len: 3.4, w: 1.9, bar: 0.5 });
    c.solid(an.lx, an.lz, 11, 11, ly - 1, ly + 2.6, { rot: yaw });
    c.solid(an.lx - fx * 1, an.lz - fz * 1, 8.4, 7.4, ly + 2.6, ly + 7.8, { rot: yaw });
    c.exclude(an.lx, an.lz, 12);
    for (let t = 0.04; t < 0.14; t += 0.03) c.exclude(eye[0] + (ex - eye[0]) * t, eye[2] + (0 - eye[2]) * t, 5);
    c.light(an.lx - fz * 5.2 + fx * 5.4, ly + 3.4, an.lz + fx * 5.2 + fz * 5.4, '#ffc98a', 0.8, 10, true, 0.5);
  }

  // Housing and stubs keep volume for lights/LOD; there is no walkable climb to the crown.
  c.solid(0, 0, 20, depth, hang - 10, hang + top + 0.5);
  for (const [a, cut] of [[-2 * half, 0], [-4 * half, 9], [2 * half, 4.5]]) {
    const [x0, y0] = archPoint(a, ri);
    const [x1, y1] = archPoint(a, ro - cut);
    c.solid((x0 + x1) / 2, 0, Math.abs(x1 - x0) + 6, depth, hang + Math.min(y0, y1), hang + Math.max(y0, y1) - 2);
  }

  c.light(0, hang + 4, depth / 2 + 3, '#6affd0', 4.2, 120, false, 3);
  c.light(0, hang + top + 3.6, 0, '#ffd59a', 2.2, 40, true, 2);
  c.animate((t, parts) => {
    parts.governor.rotation.y = t * 0.25;
  });
}

// ---------------------------------------------------------------- Seamspire Abbey
// On a sea headland at the end of the Wash, its west front to the beach and the spire over
// the water where the seam first opened. Stair from the sand; flyers on the weather side.
// A pew facing the altar (+z), standing on y.
function pew(k, x, y, z, w = 2.1) {
  k.slab(x, y + 0.42, z, w, 0.08, 0.44, 'wood');
  k.slab(x, y + 0.5, z - 0.24, w, 0.62, 0.07, 'wood');
  for (const sx of [-1, 1]) k.slab(x + sx * (w / 2 - 0.04), y, z - 0.04, 0.08, 0.92, 0.56, 'dark');
}

function abbey(c) {
  const { f } = c;
  const rng = seededRandom(5020);
  const k = c.part('abbey', ABBEY);
  const top = 0.45, paveT = 0.06;
  // The abbey stands on its own ground at the head of the Wash (data/world.js levels it): a
  // low plinth of dressed stone under its walls, two steps up to the portal, lamps by the path.
  const low = f.lowest(28, 40, 0, 4);
  // plinth stops under the nave paving so the two tops do not z-fight
  k.footing(0, -3.4, 14.2, 18.4, top - paveT, low, 'stone2', { cap: 'edge' });
  k.footing(0, 10, 26.6, 9.4, top - paveT, low, 'stone2', { cap: 'edge' });
  k.prism(0, low - 0.5, 17, 5.9, top - paveT - low + 0.5, 'stone2', { sides: 8 });
  const sg = f.ground(0, -13.4), sn = 2, srun = 0.55, srise = (top - sg) / sn, sz = -12.6 - sn * srun;
  k.stair(0, sg, sz, 3.6, sn, { rise: srise, run: srun, base: sg - 0.5 });
  for (let i = 0; i < sn; i++) c.solid(0, sz + srun * (i + 0.5), 3.6, srun + 0.02, sg - 1, sg + srise * (i + 1));
  for (const sx of [-1, 1]) {
    const lamp = k.lantern(sx * 2.8, f.ground(sx * 2.8, -16), -16, { post: 2.6, strength: 1.3 });
    if (sx > 0) c.lightAt(lamp, '#ffc98a', 1.2, 12, true, 0.8);
  }
  // The abbey's dead, in the lee of the nave: plain stones, a few leaning.
  if (k.detail >= 1) {
    for (const [x, z] of [[-8.4, -8.5], [8.4, -8.5], [-11.4, -3.5], [11.4, -3.5], [-11.4, 1.6], [11.4, 1.6], [-8.6, 18.8], [8.6, 18.8]]) {
      const lean = (rng() - 0.5) * 0.3, g = f.ground(x, z);
      k.slab(x, g - 0.2, z, 0.7, 1.05 + rng() * 0.3, 0.18, 'stone2', { ry: Math.PI / 2 + (rng() - 0.5) * 0.2, rz: lean });
      k.slab(x + Math.sign(x) * 0.9, g - 0.05, z, 1.6, 0.12, 0.7, 'moss', { ry: Math.PI / 2 });
    }
  }

  // Nave: buttressed, pointed windows lit from within, slate gable.
  const wy = top, wh = 11, hw = 5;
  for (const sx of [-hw, hw]) k.wall(sx, -10, sx, 6, wy, wh, { t: 1.2, buttress: 4, windows: true, windowEvery: 4, windowY: 4.2, pointed: true, cornice: true, lit: true });
  k.roof('gable', 0, wy + wh, -2, 2 * hw + 1.2, 16, 6.2, { c: 'roof', overhang: 0.6 });
  // West front: a gabled screen wall round the portal, a rose window and corner pinnacles.
  const W = 2 * hw + 3, H = wh + 1.5, dw = 2.8, dh = 4.0;
  k.at({ x: 0, y: wy, z: -11.2 }, (kk) => {
    for (const sx of [-1, 1]) kk.masonry(sx * (dw / 2 + (W - dw) / 4), 0, 0, (W - dw) / 2, H, 1.8, {});
    kk.masonry(0, dh, 0, dw, H - dh, 1.8, {});
    kk.wedge(0, H, 0, W, 6.6, 1.8, 'stone');
    kk.arch(0, dh, -0.9, 3.2, { pointed: true, t: 0.5, depth: 0.5, c: 'edge' });
    // the leaves stand open against the reveal, the threshold worn
    if (kk.detail >= 1) {
      for (const sx of [-1, 1]) kk.slab(sx * (dw / 2 - 0.05), 0, 1.5, 0.12, dh - 0.1, 1.35, 'wood', { ry: sx * 0.18 });
      kk.slab(0, -0.02, 0, dw + 0.4, 0.1, 1.8, 'edge');
      for (const sx of [-1, 1]) kk.banner(sx * 3.5, 3.6, -0.96, 1.2, 4.2, 'cloth', { ry: Math.PI });
    }
    // rose: stone ring proud of the wall, glow inset behind it so the two discs do not z-fight
    kk.prism(0, 7.6, -0.92, 2.3, 0.22, 'edge', { sides: 12, rx: Math.PI / 2 });
    kk.prism(0, 7.6, -1.12, 1.7, 0.16, 'glow', { sides: 12, rx: Math.PI / 2, layer: 'glow', strength: 1.0 });
    for (const sx of [-1, 1]) {
      kk.buttress(sx * (hw + 1.2), 0, -0.9, wh - 1, { ry: Math.PI, w: 1.4, depth: 2.0 });
      kk.pinnacle(sx * (hw + 1.2), wh + 1.5, 0, 1.0, { roof: 'roof' });
    }
  });
  // Transepts and the crossing tower that carries the spire and the bell.
  for (const sx of [-1, 1]) {
    k.masonry(sx * 9, wy, 10, 8, 9, 8, {});
    k.cornice(sx * 9, wy + 8.5, 10, 8, 8);
    k.roof('gable', sx * 9, wy + 9, 10, 8, 8, 4.6, { c: 'roof', ry: Math.PI / 2 });
    k.window(sx * 13.01, wy + 3.6, 10, 1.2, 2.4, { ry: sx * Math.PI / 2, pointed: true, lit: true });
  }
  const ty = k.tower(0, wy, 10, 9, 23, { setbacks: [0.62], taper: 0.86, pointed: true, windows: true });
  k.roof('spire', 0, ty, 10, 7.7, 7.7, 21, { c: 'roof', overhang: 0.3 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.pinnacle(0 + sx * 3.6, ty, 10 + sz * 3.6, 0.8, { roof: 'roof' });
  k.prism(0, ty + 20.6, 10, 0.16, 3.2, 'metal', { sides: 4, layer: 'metal' });
  // the bell, hung in the belfry openings where the sea can hear it
  k.prism(0, ty - 4.2, 10, 1.5, 2.2, 'bell', { sides: 12, top: 0.55, layer: 'metal' });
  // Apse and its flying buttresses on the seaward side.
  k.prism(0, wy, 17, 5.2, 9, 'stone', { sides: 8 });
  k.roof('cone', 0, wy + 9, 17, 10, 10, 5, { c: 'roof', sides: 8, overhang: 0.4 });
  for (const z of [-6, -1, 4]) {
    for (const sx of [-1, 1]) {
      const pg = Math.min(f.ground(sx * 10.2, z), top) - 0.3;
      k.pier(sx * 10.2, pg, z, 1.4, wy + 7.4 - pg);
      c.solid(sx * 10.2, z, 1.4, 1.4, pg, wy + 7.4);
      k.flyer([sx * 10.2, wy + 7.4, z], [sx * (hw + 0.6), wy + 9.8, z], { w: 0.8, t: 0.7 });
    }
  }

  // ---- the nave inside: paving and the chancel step, the arcade, the pews, the altar under
  // the crossing's wall, the cut bell-rope, the tally of the returned, the font by the door
  const ix = hw - 0.6, iz0 = -10.3, iz1 = 5.5;
  const pews = [];
  for (let z = -7.8; z <= 1.6; z += 1.35) pews.push(z);
  if (k.detail >= 1) {
    // paving finishes at `top` (walk height); plinth is already below it
    k.slab(0, top - paveT, (iz0 + iz1) / 2, 2 * ix, paveT, iz1 - iz0, 'edge');
    k.slab(0, top, 4.1, 2 * ix, 0.28, 2.8, 'stone2');
    // a boarded ceiling on dark beams, under the slate
    k.slab(0, wy + wh - 0.7, (iz0 + iz1) / 2, 2 * ix + 0.4, 0.3, iz1 - iz0 + 0.6, 'wood');
    for (let z = -9; z <= 5; z += 2) k.slab(0, wy + wh - 1.1, z, 2 * ix, 0.4, 0.32, 'dark');
    // the arcade
    for (const sx of [-1, 1]) {
      for (const z of [-8, -4, 0, 4]) k.column(sx * 3, wy, z, 6.6, 0.42);
      for (const z of [-6, -2, 2]) k.at({ x: sx * 3, y: wy + 6.6, z, ry: Math.PI / 2 }, (kk) => kk.arch(0, 0, 0, 3.15, { pointed: true, t: 0.42, depth: 0.7, c: 'edge', spandrel: true, spandrelH: 0.9, fill: 'stone' }));
    }
    for (const z of pews) for (const sx of [-1, 1]) pew(k, sx * 1.6, wy, z);
    // the altar, its cloth and candles, a stand of candles either side
    k.block(0, wy + 0.3 + 0.5, 4.5, 2.6, 1.0, 1.1, 'stone');
    k.slab(0, wy + 1.3, 4.5, 1.2, 0.04, 1.16, 'cloth');
    k.slab(0, wy + 0.5, 3.94, 1.2, 0.8, 0.04, 'cloth');
    for (const x of [-1.0, -0.6, 0.6, 1.0]) {
      k.prism(x, wy + 1.32, 4.6, 0.05, 0.28 + Math.abs(x) * 0.1, 'candle', { sides: 6 });
      k.prism(x, wy + 1.6 + Math.abs(x) * 0.1, 4.6, 0.04, 0.08, 'glow', { sides: 4, layer: 'glow', strength: 1.8 });
    }
    for (const sx of [-1, 1]) {
      k.prism(sx * 2.2, wy + 0.3, 4.4, 0.08, 1.4, 'metal', { sides: 6, layer: 'metal' });
      k.prism(sx * 2.2, wy + 1.7, 4.4, 0.35, 0.06, 'metal', { sides: 8, layer: 'metal' });
      for (const d of [-0.2, 0, 0.2]) k.prism(sx * 2.2 + d, wy + 1.76, 4.4, 0.04, 0.1, 'glow', { sides: 4, layer: 'glow', strength: 1.8 });
    }
    // the bell-rope, cut where a tall abbess could reach: its frayed end hangs over the nave
    k.slab(0, wy + 2.7, 2.4, 0.09, wh - 3.4, 0.09, 'rope');
    for (let i = 0; i < 5; i++) k.slab((i - 2) * 0.03, wy + 2.45, 2.4, 0.025, 0.28, 0.025, 'rope', { rz: (i - 2) * 0.22 });
    // RUNG FOR THE RETURNED: a stroke for each who came ashore, in fives, along the north aisle
    k.slab(-ix + 0.02, wy + 1.0, -3.5, 0.06, 2.6, 8.4, 'stone2');
    for (let row = 0; row < 7; row++) {
      for (let g = 0; g < 17; g++) {
        if (row === 6 && g > 9) break;
        const zc = -7.4 + g * 0.46, yc = wy + 1.25 + row * 0.33;
        for (let s5 = 0; s5 < 4; s5++) k.slab(-ix + 0.06, yc, zc + s5 * 0.07, 0.03, 0.22, 0.025, 'dark');
        k.slab(-ix + 0.06, yc + 0.02, zc + 0.1, 0.03, 0.26, 0.025, 'dark', { rx: 0.9 });
      }
    }
    // the font by the door, in the south aisle: stem, bowl, then water clear of the rim
    const fx = 3.6, fz = -9.2, fStem = 0.78, fBowl = 0.34;
    k.prism(fx, top, fz, 0.35, fStem, 'stone2', { sides: 8 });
    k.prism(fx, top + fStem, fz, 0.62, fBowl, 'stone', { sides: 8, top: 1.15 });
    k.prism(fx, top + fStem + fBowl, fz, 0.48, 0.05, 'glass', { sides: 8 });
    // lamps hung down the nave
    for (const z of [-5.5, 0.5]) {
      k.slab(0, wy + 6.4, z, 0.05, wh - 7.5, 0.05, 'metal', { layer: 'metal' });
      k.lantern(0, wy + 5.9, z, { post: 0, strength: 1.4 });
    }
  }
  for (const z of [-5.5, 0.5]) c.light(0, wy + 6, z, '#ffc98a', 1.6, 13, true, 0.7);
  c.light(0, wy + 2.2, 4.4, '#ffb870', 1.0, 8, true, 0.6);
  c.shelter(0, (iz0 + iz1) / 2, 2 * ix, iz1 - iz0, top, top + wh);

  // the plinth and the body of the church
  c.solid(0, -3.4, 14.2, 18.4, low - 1, top);
  c.solid(0, 10, 26.6, 9.4, low - 1, top);
  c.pillar(0, 17, 5.9, low - 1, top);
  for (const sx of [-hw, hw]) c.solid(sx, -2, 1.2, 16, top, top + wh);
  c.solid(0, -2, 2 * hw + 1.2, 16.4, top + wh - 0.7, top + wh + 6.5);
  for (const sx of [-1, 1]) c.solid(sx * (dw / 2 + (W - dw) / 4), -11.2, (W - dw) / 2, 1.8, top, top + H + 6);
  c.solid(0, -11.2, dw, 1.8, top + dh, top + H + 6);
  for (const sx of [-1, 1]) for (const z of [-8, -4, 0, 4]) c.pillar(sx * 3, z, 0.42, top, top + 6.6);
  c.solid(0, 4.1, 2 * ix, 2.8, top, top + 0.28);
  c.solid(0, 4.5, 2.6, 1.1, top + 0.3, top + 1.3);
  for (const z of pews) for (const sx of [-1, 1]) c.solid(sx * 1.6, z - 0.04, 2.1, 0.56, top, top + 0.5);
  c.solid(-ix + 0.02, -3.5, 0.1, 8.4, top + 1.0, top + 3.6);
  c.pillar(3.6, -9.2, 0.62, top, top + 1.17);
  c.solid(0, 10, 26, 8, top, top + 9);
  c.solid(0, 10, 9, 9, top, ty);
  c.pillar(0, 17, 5.2, top, top + 12);
}

// ---------------------------------------------------------------- the Widowneedles
// Five octagonal watch-towers on one court, every one leaning a little toward the sea. The
// owls took the crowns: the tallest keeps its roof, the others end in nests and teeth.
function octTower(k, x, z, r, h, o = {}) {
  const c1 = 'stone', c2 = 'stone2';
  const course = k.detail >= 1 ? 2.4 : h / 2;
  let y = 0, rr = r;
  const taper = o.taper ?? 0.985;
  k.prism(x, -2, z, r * 1.18, 2.6, 'stone2', { sides: 8 });
  k.prism(x, 0.6, z, r * 1.12, 0.4, 'edge', { sides: 8 });
  y = 1.0;
  let i = 0;
  while (y < h - 0.01) {
    const ch = Math.min(course, h - y);
    const rt = rr * taper;
    k.prism(x, y, z, rr, ch, i % 2 ? c2 : c1, { sides: 8, top: rt / rr });
    y += ch;
    rr = rt;
    i++;
    if (k.detail >= 1 && i % 4 === 0 && y < h - 3) k.prism(x, y - 0.25, z, rr * 1.07, 0.3, 'edge', { sides: 8 });
  }
  if (k.detail >= 1) {
    for (let s = 0; s < 3; s++) {
      const wy = h * (0.3 + s * 0.22);
      const a = (o.face ?? 0) + s * 2.1;
      k.window(x + Math.sin(a) * rr * 1.02, wy, z + Math.cos(a) * rr * 1.02, 0.5, 1.6, { ry: a });
    }
  }
  // Corbelled watch gallery.
  k.prism(x, h, z, rr * 1.05, 0.9, 'stone2', { sides: 8, top: 1.22 });
  k.prism(x, h + 0.9, z, rr * 1.3, 0.6, 'edge', { sides: 8 });
  const gt = h + 1.5;
  if (o.crown === 'roof') {
    k.prism(x, gt, z, rr * 1.0, 3.2, 'stone', { sides: 8 });
    k.pyramid(x, gt + 3.2, z, rr * 1.32, rr * 3.6, 'roof', { sides: 8 });
    if (k.detail >= 1) k.prism(x, gt + 3.2 + rr * 3.6, z, 0.12, 1.6, 'metal', { sides: 4, layer: 'metal' });
    return gt + 3.2 + rr * 3.6;
  }
  // Broken crown: parapet teeth of uneven height and an owls' nest of fallen roof timbers.
  const n = 8;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU + Math.PI / 8;
    const th = o.teeth ? o.teeth[j % o.teeth.length] : 1.2;
    if (th <= 0) continue;
    k.slab(x + Math.sin(a) * rr * 1.14, gt, z + Math.cos(a) * rr * 1.14, 0.9, th, 0.6, 'stone', { ry: a });
  }
  k.rock(x, gt + 0.4, z, rr * 1.4, 1.2, rr * 1.3, 'nest', { grad: 0.3 });
  if (k.detail >= 1) for (let j = 0; j < 5; j++) k.slab(x + Math.sin(j * 1.3) * rr * 0.5, gt + 0.7, z + Math.cos(j * 1.3) * rr * 0.5, 0.25, 0.25, rr * 1.6, 'nest', { ry: j * 0.7, rx: 0.2 });
  return gt + 1.2;
}

function widowneedles(c) {
  const { f, def } = c;
  const rng = seededRandom(688);
  const k = c.part('needles', NEEDLES);
  const lean = def.lean || [0, 2.4];
  const low = f.lowest(34, 34);
  k.footing(0, 0, 30, 28, 0.6, low, 'stone2', { cap: 'edge' });
  if (k.detail >= 1) k.stair(0, 0.2 - 0.0, -14 - 4 * 0.6, 4, 2, { rise: 0.2, run: 0.6, base: low - 0.4 });
  const towers = [
    { x: 0, z: 3, r: 3.6, h: 40, crown: 'roof' },
    { x: 9, z: -4, r: 2.9, h: 30, teeth: [1.4, 0.8, 1.6, 0, 1.2, 1.5, 0.6, 1.1] },
    { x: -9, z: 6, r: 2.7, h: 26, teeth: [1.2, 1.6, 0, 0, 0.9, 1.4, 1.2, 0.7] },
    { x: 6, z: 11, r: 2.3, h: 21, teeth: [0.8, 1.3, 1.1, 0.6, 0, 1.4, 1.0, 1.2] },
    { x: -7, z: -7, r: 2.4, h: 15, teeth: [0.4, 0, 0.6, 0.3, 0, 0.5, 0.2, 0] },
  ];
  for (const t of towers) {
    const s = t.h / 40;
    k.warp({ lean: [lean[0] * s, lean[1] * s], from: 4, to: t.h + 6, center: [t.x, t.z], ease: 1.6 }, (kk) => {
      t.top = octTower(kk, t.x, t.z, t.r, t.h, { crown: t.crown, teeth: t.teeth, face: rng() * TAU });
    });
    c.pillar(t.x, t.z, t.r * 1.05, -2, t.h);
  }
  // The bridge that tied the two tallest at the watch level: one span stands, one fell.
  const A = towers[0], B = towers[1];
  const by = 22;
  const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
  const ry = Math.atan2(dx, dz);
  k.warp({ lean: [lean[0] * 0.55, lean[1] * 0.55], from: 0, to: 30, ease: 1 }, (kk) => {
    kk.at({ x: A.x + (dx / d) * A.r, y: by, z: A.z + (dz / d) * A.r, ry }, (b) => {
      b.slab(0, 0, (d - A.r - B.r) * 0.28, 2.0, 1.0, (d - A.r - B.r) * 0.56, 'stone');
      b.ramp(0, -1.6, (d - A.r - B.r) * 0.18, 1.6, 1.6, (d - A.r - B.r) * 0.36, 'stone2', { ry: Math.PI });
    });
  });
  if (k.detail >= 1) k.rubble((A.x + B.x) / 2 + 1, 0.6, (A.z + B.z) / 2, 2.6, 8, rng, { size: 1.0 });
  c.solid(0, 0, 30, 28, low - 1, 0.6);
}

// ---------------------------------------------------------------- the Nave Below
// A basilica raised on dry peat that the fen took back: the floor is a pool, the clerestory
// fell into it, and worship moved out onto the causeway.
function naveBelow(c) {
  const { f } = c;
  const rng = seededRandom(658);
  const k = c.part('nave', NAVE);
  const floor = -0.5;
  const low = f.lowest(18, 38);
  k.footing(0, 0, 16, 36, floor, low, 'stone2', { cap: 'edge' });
  // The pool: still dark water filling the floor between the walls.
  k.slab(0, floor - 0.1, 0, 13.6, 0.12, 33.6, 'pool', { layer: 'metal', grad: 0, jitter: 0 });
  for (const sx of [-7, 7]) k.wall(sx, -16, sx, 14, floor, 9, { t: 1.2, ruin: rng, minFrac: 0.2, buttress: 5, c: 'stone', c2: 'moss' });
  k.wall(-7, -16.4, -2.2, -16.4, floor, 10, { t: 1.4, ruin: rng, minFrac: 0.45 });
  k.wall(2.2, -16.4, 7, -16.4, floor, 10, { t: 1.4, ruin: rng, minFrac: 0.45 });
  k.arch(0, floor + 5.2, -16.4, 4.4, { pointed: true, t: 0.7, depth: 1.5, c: 'edge' });
  for (const sx of [-2.2, 2.2]) k.pier(sx, floor, -16.4, 1.3, 5.2, { d: 1.5 });
  // Apse: half a drum still standing, its half-dome in the water.
  k.prism(0, floor, 16, 6.4, 6.4, 'stone', { sides: 10, top: 0.98 });
  k.prism(0, floor - 0.05, 16, 5.4, 6.6, 'dark', { sides: 10 });
  if (k.detail >= 1) {
    k.at({ x: 2.6, y: floor, z: 14.4, rz: 0.5, rx: -0.2 }, (kk) => kk.roof('dome', 0, 0, 0, 7, 7, 2.6, { c: 'stone2', sides: 8 }));
  }
  // Arcade columns: most stand, two snapped, one lies across the pool.
  for (let i = 0; i < 6; i++) {
    const z = -12 + i * 5;
    for (const sx of [-4, 4]) {
      const broken = (i === 2 && sx < 0) || (i === 4 && sx > 0);
      const fallen = i === 3 && sx > 0;
      if (fallen) {
        k.at({ x: 0.6, y: floor + 0.4, z: z + 0.8, ry: 1.15, rz: Math.PI / 2 }, (kk) => kk.prism(0, -3.8, 0, 0.55, 7.6, 'stone', { sides: 8 }));
        continue;
      }
      const h = broken ? 2.4 + rng() * 1.6 : 7.4;
      k.column(sx, floor, z, h, 0.55, { sides: 8, capital: !broken });
      if (broken && k.detail >= 1) k.rubble(sx * 0.7, floor, z + 1.2, 1.6, 4, rng, { size: 0.8, c2: 'moss' });
      c.pillar(sx, z, 0.6, floor - 1, floor + h);
    }
  }
  // The pediment slid off the front and lies half under the water, off to the side of the
  // causeway the worshippers built past it.
  k.at({ x: 8.6, y: floor - 1.5, z: -20.2, ry: 0.85, rx: 0.42, rz: -0.16 }, (kk) => {
    kk.wedge(0, 0, 0, 11, 3.2, 1.2, 'edge');
    kk.slab(0, -0.5, 0, 11.4, 0.5, 1.4, 'stone2');
  });
  // The causeway: kerbed paving on piles from the dry bank to the door; some slabs gone.
  const cl = 22;
  for (let i = 0; i < 11; i++) {
    const z = -18 - (i + 0.5) * (cl / 11);
    if (i === 6 && k.detail >= 1) continue;
    const g = f.ground(0, z);
    const top = Math.max(0.4, g + 0.5);
    k.slab(0, Math.min(g, top - 1) - 0.6, z, 3.2, top - Math.min(g, top - 1) + 0.6, cl / 11 - 0.12, i % 2 ? 'stone' : 'stone2');
    if (k.detail >= 1) for (const sx of [-1.75, 1.75]) k.slab(sx, top, z, 0.3, 0.25, cl / 11 - 0.1, 'edge');
    c.solid(0, z, 3.2, cl / 11, top - 2, top);
  }
  if (k.detail >= 1) {
    for (let i = 0; i < 14; i++) {
      const a = rng() * TAU, r = 10 + rng() * 6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 1.8;
      if (Math.abs(x) < 3 && z < -16) continue;
      k.prism(x, f.ground(x, z) - 0.2, z, 0.08, 1.4 + rng(), 'reed', { sides: 3, rz: (rng() - 0.5) * 0.3 });
    }
  }
  for (const sx of [-7, 7]) c.solid(sx, -1, 1.2, 30, floor - 1, floor + 4);
  c.solid(0, -16.4, 14, 1.4, floor - 1, floor + 4.5);
  c.light(0, floor + 1, 0, '#3affc8', 2.4, 22, true, 1);
  c.exclude(0, -18 - cl / 2, cl / 2 + 2);
}

// ---------------------------------------------------------------- the Stillkeep
// The northern regulator's outer housing: "poured, not built", so it has no coursed joints to
// crack, only the fused mass of it. A battered plinth glazed with ice, curtains three metres
// thick, squat towers that lean back into the slope, and the keep itself, square and blind.
// The strain still going in has frozen everything it touches: runoff hangs down the walls as
// sheets of ice, snow lies on every walk, frost has split the stone. Nothing is lit; no one
// keeps it but the Warden in the hollow below. The gate faces the pass (local -x).
function stillkeep(c) {
  const { f } = c;
  const rng = seededRandom(392);
  const k = c.part('keep', KEEP);
  const low = f.lowest(46, 42);
  const g0 = 0.4, plinth = 5.2, top = g0 + plinth;
  const hx = 16, hz = 14;
  k.footing(0, 0, 40, 36, g0, low, 'stone2', { cap: 'edge' });
  // the poured plinth, and its glacis: battered on every side, ice-glazed at the foot
  k.slab(0, g0, 0, 2 * hx, plinth, 2 * hz, 'stone2');
  for (const [nx, nz, len] of [[1, 0, 2 * hz], [-1, 0, 2 * hz], [0, 1, 2 * hx], [0, -1, 2 * hx]]) {
    const half = nx ? hx : hz;
    const ry = Math.atan2(nx, nz);
    k.ramp(nx * (half + 1.5), g0, nz * (half + 1.5), len + 6, plinth - 0.6, 3, 'stone2', { ry });
    k.ramp(nx * (half + 2.3), g0, nz * (half + 2.3), len + 7, 1.8, 1.8, 'ice2', { ry });
  }
  k.slab(0, top - 0.3, 0, 2 * hx + 0.6, 0.3, 2 * hz + 0.6, 'edge');
  // curtains on the plinth, gate toward the pass; the north curtain has fallen in part
  const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    const o = { t: 2.8, crenel: true, c: 'stone', c2: 'stone2', plinth: false };
    if (i === 3) {
      k.wall(ax, az, ax, -3.4, top, 7, o);
      k.wall(ax, 3.4, bx, bz, top, 7, o);
      continue;
    }
    if (i === 2) {
      // the frost split this run and half of it lies at its foot
      k.wall(ax, az, ax + (bx - ax) * 0.42, az, top, 7, o);
      k.wall(ax + (bx - ax) * 0.42, az, bx, bz, top, 7, { ...o, crenel: false, ruin: rng, minFrac: 0.3 });
      continue;
    }
    k.wall(ax, az, bx, bz, top, 7, o);
  }
  // snow on the wall-walks
  for (const [x, z, w, d] of [[0, -hz, 2 * hx, 2.6], [hx, 0, 2.6, 2 * hz], [-hx, -9, 2.6, 10], [-hx, 9, 2.6, 10]]) k.slab(x, top + 7.0, z, w + 0.2, 0.22, d, 'roof');
  // the gate: deep piers and a plain round arch, the passage dark behind it
  k.at({ x: -hx, y: top, z: 0, ry: Math.PI / 2 }, (kk) => {
    for (const sx of [-3.4, 3.4]) kk.pier(sx, 0, 0, 2.4, 9.4, { d: 3.4, c: 'stone', c2: 'stone2' });
    kk.arch(0, 6.0, 0, 4.4, { t: 1.0, depth: 3.0, spandrel: true, spandrelH: 0.8, c: 'edge', fill: 'stone' });
    kk.slab(0, 0, 0.6, 4.2, 5.6, 0.3, 'dark', { grad: 0 });
  });
  // a stair cut up the glacis to the gate
  const steps = 17, rise = plinth / steps, run = 0.6, sx0 = -hx - steps * run;
  k.stair(sx0, g0, 0, 3.8, steps, { rise, run, base: low - 0.6, ry: Math.PI / 2 });
  for (let i = 0; i < steps; i++) c.solid(sx0 + run * (i + 0.5), 0, run + 0.02, 3.8, low - 1, g0 + rise * (i + 1));
  // squat corner towers, battered, snow-capped; one lost its crown to the frost
  for (const [i, [x, z]] of corners.entries()) {
    const broken = i === 2;
    const th = broken ? 9 : 15;
    k.prism(x, g0, z, 5.2, th + plinth, 'stone', { sides: 8, top: 0.86 });
    if (!broken) {
      k.prism(x, g0 + plinth + th, z, 4.7, 0.5, 'edge', { sides: 8 });
      for (let m = 0; m < 8; m++) {
        const a = (m / 8) * TAU + Math.PI / 8;
        k.slab(x + Math.cos(a) * 4.1, g0 + plinth + th + 0.5, z + Math.sin(a) * 4.1, 1.3, 1.1, 0.9, 'stone2', { ry: -a + Math.PI / 2 });
      }
      k.prism(x, g0 + plinth + th + 0.5, z, 4.0, 0.3, 'roof', { sides: 8 });
    } else if (k.detail >= 1) {
      k.rubble(x + 6, g0, z + 4, 3.2, 9, rng, { size: 1.5, c: 'stone', c2: 'stone2' });
    }
    c.pillar(x, z, 5.0, low - 1, g0 + plinth + th);
  }
  // the keep, set back on the seaward side and settling as it rises
  let keepTop = 0;
  k.warp({ twist: 0.03, lean: [0.5, -0.25], from: top + 4, to: top + 26, center: [5, 0], ease: 1.6 }, (kk) => {
    keepTop = kk.tower(5, top, 0, 14, 22, { c: 'stone', c2: 'stone2', setbacks: [0.55], taper: 0.88, windows: true, lit: false, crenel: true });
    kk.slab(5, keepTop + 0.35, 0, 14 * 0.88 - 0.6, 0.3, 14 * 0.88 - 0.6, 'roof');
    // a squat stair turret on the keep's landward corner
    kk.prism(-1.2, top, -5.6, 2.4, 25.5, 'stone2', { sides: 6, top: 0.92 });
    kk.pyramid(-1.2, top + 25.5, -5.6, 2.8, 3.6, 'roof', { sides: 6 });
  });
  c.solid(5, 0, 14, 14, top - 1, top + 22);
  if (k.detail >= 1) {
    // ice: runoff frozen in sheets down the walls and the keep, rime at the foot
    const sheets = [[hx + 1.45, -7, 0], [hx + 1.45, 5, 0], [-6, -hz - 1.45, Math.PI / 2], [7, -hz - 1.45, Math.PI / 2], [-hx - 1.45, -9, 0], [12.1, -2, 0], [-2, 7.1, Math.PI / 2]];
    for (const [x, z, ry] of sheets) {
      const w = 1.4 + rng() * 1.6, h0 = x === 12.1 || z === 7.1 ? top + 20 : top + 7;
      for (let j = 0, y = h0, ww = w; j < 4 && y > g0 + 1; j++) {
        const hh = (h0 - g0) * (0.18 + rng() * 0.12);
        k.slab(x, y - hh, z, ww, hh, 0.35, j % 2 ? 'ice' : 'ice2', { ry });
        y -= hh * 0.92; ww *= 0.78;
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU, rx = Math.cos(a), rz = Math.sin(a);
      const x = Math.sign(rx) * Math.min(hx + 3.2, Math.abs(rx) * 30), z = Math.sign(rz) * Math.min(hz + 3.2, Math.abs(rz) * 30);
      k.rock(x, g0 + 0.3, z, 1.6 + rng() * 2, 0.7 + rng() * 0.6, 1.4 + rng() * 1.6, rng() < 0.5 ? 'ice' : 'ice2', { ry: rng() * TAU });
    }
    // frost cracks in the keep's poured face
    for (const [x, z, ry] of [[12.05, 1.5, Math.PI / 2], [-1.95, -3, -Math.PI / 2]]) {
      let y = top + 18;
      for (let j = 0; j < 5; j++) {
        const len = 2 + rng() * 2;
        k.slab(x, y - len, z + (rng() - 0.5) * 1.6, 0.18, len, 0.06, 'dark', { ry, rz: (rng() - 0.5) * 0.7, grad: 0 });
        y -= len * 0.85;
      }
    }
  }
  const curtain = [[0, -hz, 2 * hx, 2.8], [0, hz, 2 * hx, 2.8], [hx, 0, 2.8, 2 * hz]];
  for (const [x, z, w, d] of curtain) c.solid(x, z, w, d, top - 1, top + 7.2);
  c.solid(-hx, -9.2, 2.8, 11.6, top - 1, top + 7.2);
  c.solid(-hx, 9.2, 2.8, 11.6, top - 1, top + 7.2);
  c.solid(0, 0, 2 * hx + 6, 2 * hz + 6, low - 1, g0 + 0.6);
  c.solid(0, 0, 2 * hx, 2 * hz, low - 1, top);
}

// ---------------------------------------------------------------- the Ember Circlet
// Black teeth set along the high rim of the Caldera so the mountain has a mouth that is not
// only hunger. The arc stands back from the arena's edge and leaves the attendants' road open.
function emberCirclet(c) {
  const { f, def } = c;
  const rng = seededRandom(470);
  const k = c.part('circlet', CIRCLET);
  const rim = def.rim || 50;
  const teeth = 11;
  const [a0, a1] = def.arc || [-1.45, 1.45];
  for (let i = 0; i < teeth; i++) {
    const a = a0 + ((a1 - a0) * i) / (teeth - 1) + (rng() - 0.5) * 0.05;
    const r = rim + (rng() - 0.5) * 3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = f.lowest(6, 6, x, z);
    const base = f.ground(x, z);
    const h = (18 + (i % 3) * 7 + rng() * 6) * (i === 4 ? 1.7 : 1);
    const ry = -a + Math.PI / 2;
    const tilt = (rng() - 0.5) * 0.08;
    k.footing(x, z, 6.4, 5.2, base + 0.6, g, 'obsidian2', { cap: 'edge' });
    k.at({ x, y: base + 0.6, z, ry, rz: tilt, rx: -0.06 }, (kk) => {
      kk.prism(0, 0, 0, 2.9, h, i % 2 ? 'obsidian' : 'obsidian2', { sides: 5, top: 0.18, dr: 2.2 });
      kk.glowPanel(0, h * 0.32, 1.72, 0.32, h * 0.42, 0.08, 'glow', 1.35, { rz: 0.08 });
      if (kk.detail >= 1) {
        kk.glowPanel(0.9, h * 0.5, 1.3, 0.22, h * 0.2, 0.06, 'glow', 1.25, { rz: -0.2 });
        kk.prism(0, h * 0.2, 0, 3.0, 0.7, 'metal', { sides: 5, dr: 2.35, layer: 'metal', top: 0.93 });
      }
    });
    c.pillar(x, z, 2.6, base - 2, base + h * 0.7);
    c.exclude(x, z, 6);
  }
  c.light(0, 8, 0, '#ff5a1a', 3.2, 36, true, 2);
}

// ---------------------------------------------------------------- the Green Needle
// The first king of the Verdance sat down and did not get up: a stepped stone seat the
// roots swallowed, a living trunk spiralling into a needle, a stump throne at its foot.
function greenNeedle(c) {
  const { f } = c;
  const rng = seededRandom(132);
  const k = c.part('needle', VERD);
  const low = f.lowest(26, 26);
  const tiers = [[22, 3], [16, 3], [11, 2.6]];
  let y = 0;
  for (let i = 0; i < tiers.length; i++) {
    const [w, h] = tiers[i];
    if (i === 0) k.footing(0, 0, w, w, h, low, 'stone2', { cap: 'edge' });
    else {
      k.masonry(0, y, 0, w, h, w, { c: 'stone', c2: 'moss' });
      k.slab(0, y + h - 0.3, 0, w + 0.4, 0.3, w + 0.4, 'edge');
    }
    c.solid(0, 0, w, w, i ? y : low - 1, y + h);
    y += h;
  }
  // Root stair up the south face of each tier.
  let sy = 0;
  for (let i = 0; i < tiers.length; i++) {
    const [w, h] = tiers[i];
    const n = Math.round(h / 0.3);
    const z0 = -w / 2 - n * 0.6 - (i === 0 ? 0 : 0);
    if (i === 0) {
      k.stair(0, sy - h + 0.1 + h - 0.1, z0, 3.4, n, { rise: (h - 0.1) / n, run: 0.6, base: low - 0.4, c: 'stone', c2: 'moss' });
    }
    sy += h;
  }
  {
    const [w0, h0] = tiers[0];
    const n = 10, run = 0.6, rise = h0 / n;
    const z0 = -w0 / 2 - n * run;
    for (let i = 0; i < n; i++) c.solid(0, z0 + run * (i + 0.5), 3.4, run + 0.02, low - 1, rise * (i + 1));
  }
  // The trunk: three strands twisted around each other, thinning to the golden needle.
  const H = 34;
  k.warp({ twist: 1.6, from: y, to: y + H, center: [0, 0], ease: 1 }, (kk) => {
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * TAU;
      kk.prism(Math.cos(a) * 1.6, y - 0.4, Math.sin(a) * 1.6, 2.1, H, s % 2 ? 'bark' : 'bark2', { sides: 6, top: 0.3 });
    }
    kk.prism(0, y - 0.4, 0, 2.6, H * 0.7, 'bark2', { sides: 7, top: 0.45 });
  });
  c.pillar(0, 0, 3.2, y, y + H * 0.8);
  // Roots: buttress-like flares draping over the tiers and down to the ground.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI / 2) < 0.4) continue;
    const len = 9 + rng() * 4;
    k.at({ x: Math.cos(a) * 2.6, y: y - 0.2, z: Math.sin(a) * 2.6, ry: Math.PI / 2 - a }, (kk) => {
      kk.ramp(0, -0.2, len / 2, 1.3, 3.4, len, 'bark', { ry: Math.PI });
      if (kk.detail >= 1) kk.ramp(0, -y + 0.4 - 0.2, len + 2.4, 1.0, y + 0.6, 4.8, 'bark2', { ry: Math.PI });
    });
  }
  // Canopy crown round the needle, and the needle itself.
  const cy = y + H * 0.72;
  const blobs = k.detail >= 1 ? 7 : 3;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rng(), r = 3.6 + rng() * 2.4, yy = cy + (rng() - 0.3) * 6;
    if (i >= blobs) continue;
    k.rock(Math.cos(a) * r, yy, Math.sin(a) * r, 7 + rng() * 2, 4.4, 6.4, i % 2 ? 'leaf' : 'leaf2', { ry: a, grad: 0.4 });
  }
  k.prism(0, y + H - 0.6, 0, 0.6, 7, 'gold', { sides: 6, top: 0.05, layer: 'metal' });
  // The throne: a stump, its back the trunk, its arms two roots.
  k.at({ x: 0, y, z: -3.6 }, (kk) => {
    kk.prism(0, 0, 0, 1.5, 1.1, 'bark2', { sides: 7 });
    kk.slab(0, 1.1, 0.5, 2.4, 2.4, 0.5, 'bark', { rx: -0.08 });
    for (const sx of [-1.3, 1.3]) kk.slab(sx, 0, -0.2, 0.5, 1.6, 1.8, 'bark');
  });
}

const BUILDERS = { keystone, cathedral: abbey, spires: widowneedles, drowned_temple: naveBelow, ice_citadel: stillkeep, volcano_crown: emberCirclet, verdant_spire: greenNeedle };

// ---------------------------------------------------------------- raising a monument
// Runs the recipe once per detail level. Parts are named kits (one group each, at most four
// draws); colliders, lights and exclusions only come from the full pass.
function raise(world, def, recipe, exclusions) {
  const f = siteFrame(world, def.x, def.z, def.rot || 0, def.base ?? world.terrain.heightAt(def.x, def.z));
  const levels = [];
  let animate = null;
  for (const detail of [1, 0]) {
    const first = detail === 1;
    const parts = new Map();
    const c = {
      f,
      def,
      detail,
      part(name, palette, o = {}) {
        let p = parts.get(name);
        if (!p) parts.set(name, (p = { kit: new Kit(palette, { detail, shadow: first }), o }));
        return p.kit;
      },
      solid: first ? f.solid : noop,
      pillar: first ? f.pillar : noop,
      exclude: first ? (lx, lz, r) => {
        const [x, z] = f.at(lx, lz);
        exclusions.push({ x, z, r });
      } : noop,
      light: first ? (lx, ly, lz, col, i, d, fl = false, pr = 1) => {
        const [x, z] = f.at(lx, lz);
        world.addLight(new THREE.Vector3(x, f.y + ly, z), col, i, d, fl, pr);
      } : noop,
      lightAt: first ? (v, col, i, d, fl = false, pr = 1) => {
        const [x, z] = f.at(v.x, v.z);
        world.addLight(new THREE.Vector3(x, f.y + v.y, z), col, i, d, fl, pr);
      } : noop,
      animate: first ? (fn) => { animate = fn; } : noop,
      // where the weather stops: rain and snow are not drawn inside (world/weather.js)
      shelter: first ? (lx, lz, w, d, y0, y1) => {
        const [x, z] = f.at(lx, lz);
        addShelter(world, x, z, w, d, f.yaw, f.y + y0, f.y + y1);
      } : noop,
    };
    recipe(c);
    const group = new THREE.Group();
    group.name = `${def.id}_lod${first ? 0 : 1}`;
    const named = {};
    for (const [name, { kit, o }] of parts) {
      const g = kit.build(`${def.id}_${name}`);
      g.position.y = o.y || 0;
      if (o.dynamic) g.userData.dynamic = true;
      group.add(g);
      named[name] = g;
    }
    levels.push({ group, parts: named });
  }
  const root = new THREE.Group();
  root.name = 'monument_' + def.id;
  root.position.set(f.x, f.y, f.z);
  root.rotation.y = f.yaw;
  for (const l of levels) root.add(l.group);
  levels[1].group.visible = false;
  world.scene.add(root);
  if (animate) world.animated.push((t) => { for (const l of levels) if (l.group.visible) animate(t, l.parts); });
  return { f, root, full: levels[0].group, mid: levels[1].group };
}

export function buildMonuments(world, exclusions) {
  const marks = [];
  const terrain = world.terrain;
  const stones = new Kit('ancient');
  for (const def of MONUMENTS) {
    const recipe = BUILDERS[def.kind];
    if (!recipe || def.x > 3000) continue;
    const { f, root, full, mid } = raise(world, def, recipe, exclusions);
    exclusions.push({ x: def.x, z: def.z, r: def.exclude || 22 });

    if (def.lore && def.reach) {
      const { x, z } = def.reach;
      const y = terrain.heightAt(x, z);
      const face = Math.atan2(x - def.x, z - def.z);
      carving(stones, x, y, z, face);
      world.colliders.addBox({ x, z, w: 1.8, d: 1.2, y0: y - 1, y1: y + 1.2, rot: face });
      exclusions.push({ x, z, r: 4 });
      const lore = LORE_BY_ID[def.lore];
      const title = lore ? lore.title : def.name;
      const verb = 'Read the carving';
      const interaction = world.addInteract({
        id: 'lore_' + def.lore,
        kind: 'lore',
        pos: new THREE.Vector3(x, y + 1, z),
        radius: 3,
        label: `${verb}: ${title}`,
        use: () => act('readLore', def.lore),
      });
      if (lore && world.loreTablets) world.loreTablets.push({ lore, group: null, kind: 'carving', interaction, verb });
    }

    marks.push({ def, root, full, mid, pos: new THREE.Vector3(def.x, f.y + (def.hangY || 30), def.z) });
  }
  world.scene.add(stones.build('monument_carvings'));
  world.monuments = marks;
  return marks;
}

// Full detail near, the detail-0 build everywhere else. Low quality pulls the swap in.
export function updateMonuments(marks, camera, low) {
  if (!marks) return;
  for (const m of marks) {
    const near = m.def.near ?? 260;
    const d = camera.position.distanceTo(m.pos);
    const full = d < (low ? near * 0.4 : near);
    m.full.visible = full;
    m.mid.visible = !full;
  }
}

export { KEYSTONE };
