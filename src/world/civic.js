// Civic set pieces, laid by the mason (world/mason.js) in the town's own stone, timber and
// cloth and walked as they are drawn:
//
//   lantern tree   the Great Tree of Saltreach on its stepped octagonal plinth, the seat-high
//                  kerb of its bed, buttress roots, and lanterns hung from its lower limbs
//   crucible       Vorn's pit below the Crucible Gate: a sand floor inside a fighting wall,
//                  a horseshoe of stone tiers open toward the town, the Gate of Trials and the
//                  Pitmaster's tribune facing it across the sand
//   vow perch      the Vowkeeper's sanctum: a revetted podium on the knoll by the north wall,
//                  its public stair from the North Way, and the open rotunda of the vow-light
//   stall          a market stall in the region's cloth: trestle counter, goods rack, awning
//   terrace stair  a broad flight between wards: risers of at most 0.3 m on long treads,
//                  cheek walls on both sides, lamp piers at its head and foot
import * as THREE from 'three';
import { Kit } from './kit.js';
import { Mason, BUILD_PALETTES, RISE } from './mason.js';
import * as F from './furnishing.js';
import { vernacularOf } from './vernacular.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);
const PAL = { salt: 'salt', farm: 'salt', wood: 'salt', enclave: 'enclave', frost: 'frost', root: 'root', cinder: 'cinder', reed: 'reed', redwake: 'redwake', hush: 'hush' };
const LEAF = ['#4b7b52', '#5a8a5c', '#42704a', '#669460'];

// A crown of leaf: a broad flattened lobe with a shallower cap and an underside, turned so
// neighbouring crowns never line up.
function crown(m, x, y, z, r, h, c, turn = 0) {
  m.k.prism(x, y, z, r, h, c, { sides: 7, top: 0.58, ry: turn });
  m.k.prism(x, y - h * 0.32, z, r * 0.82, h * 0.34, c, { sides: 7, top: 1.22, rx: Math.PI, ry: turn + 0.4 });
  m.k.prism(x + r * 0.12, y + h * 0.82, z - r * 0.1, r * 0.55, h * 0.5, c, { sides: 6, top: 0.5, ry: turn + 1.1 });
}

// A limb: a tapering six-sided prism leaning out along heading `a` by `tilt` from upright.
function limb(m, x, y, z, a, tilt, len, r, c) {
  m.k.at({ x, y, z, ry: a, rx: tilt }, (k) => k.prism(0, 0, 0, r, len, c, { sides: 6, top: 0.62 }));
  return [x + Math.sin(a) * Math.sin(tilt) * len, y + Math.cos(tilt) * len, z + Math.cos(a) * Math.sin(tilt) * len];
}
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------------------------------------------------------------- the Lantern Tree
export function buildLanternTree(world, s, add, exclusions) {
  const m = new Mason(world, { x: s.x, z: s.z, palette: 'salt', tag: 'great_tree', name: s.name || 'The Lantern Tree', lights: 4 });
  const R = s.r || 6.5, H = s.h || 26;
  // the plinth: three octagonal steps of one riser each, then the bed's seat-high kerb
  const steps = [R + 2.4, R + 1.6, R + 0.8];
  const lo = m.lowest(steps[0] * 2, steps[0] * 2);
  steps.forEach((r, i) => {
    const top = RISE * (i + 1), base = i === 0 ? lo - 0.6 : RISE * i - 0.05;
    m.k.prism(0, base, 0, r, top - base, i % 2 ? 'stone2' : 'stone', { sides: 8 });
    m.k.prism(0, top - 0.06, 0, r + 0.04, 0.06, 'edge', { sides: 8 });
    world.colliders.addCyl({ x: s.x, z: s.z, r: r * 0.95, y0: m.y + base, y1: m.y + top, tag: 'great_tree' });
  });
  const P = RISE * 3, kerbR = R - 0.6, kerbH = 0.45;
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * TAU, chord = 2 * kerbR * Math.tan(Math.PI / 8) + 0.5;
    m.at(Math.sin(a) * kerbR, Math.cos(a) * kerbR, a, (q) => {
      q.block(0, P, 0, chord, kerbH, 0.6, 'stone2', { climbable: false });
      q.trim(0, P + kerbH, 0, chord + 0.06, 0.1, 0.78, 'edge');
    });
  }
  // the bed: dark earth and moss, the roots spread over it
  m.k.prism(0, P, 0, kerbR - 0.25, kerbH - 0.08, '#4f4433', { sides: 8, ry: Math.PI / 8 });
  m.k.prism(0, P + kerbH - 0.08, 0, kerbR - 0.3, 0.04, 'moss', { sides: 8, ry: Math.PI / 8 });
  world.colliders.addCyl({ x: s.x, z: s.z, r: kerbR - 0.3, y0: m.y + P, y1: m.y + P + kerbH - 0.04, tag: 'great_tree' });
  const T = P + kerbH;
  // the trunk: four tapering drums, each turned and set a little off the last, so it reads
  // as grown rather than turned; pale salt-bleached bark with darker fluting
  const bark = '#c4bcad', bark2 = '#a69d8d';
  const fork = H * 0.62;
  let tx = 0, tz = 0, ty = T, r = 2.3;
  const drums = [[0.26, 0], [0.26, 0.35], [0.26, -0.3], [0.22, 0.2]];
  for (const [f, lean] of drums) {
    const h = fork * f, r1 = r * 0.86;
    m.k.prism(tx, ty, tz, r, h + 0.3, bark, { sides: 7, top: r1 / r, ry: ty * 0.37 });
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU + ty * 0.37 + 0.45;
      m.trim(tx + Math.sin(a) * r * 0.9, ty, tz + Math.cos(a) * r * 0.9, 0.22, h, 0.22, bark2, { ry: a });
    }
    tx += Math.sin(lean) * 0.25; tz += Math.cos(lean) * 0.25; ty += h; r = r1;
  }
  world.colliders.addCyl({ x: s.x, z: s.z, r: 2.4, y0: m.y + T - 0.2, y1: m.y + ty, climbable: true, tag: 'great_tree' });
  // buttress roots: flaring ribs from the trunk's foot out over the bed
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3, len = 2.4 + (i % 3) * 0.5;
    m.at(Math.sin(a) * (2.0 + len / 2), Math.cos(a) * (2.0 + len / 2), a, (q) => {
      q.k.ramp(0, T - 0.1, 0, 0.75 - (i % 2) * 0.15, 1.6 + (i % 3) * 0.4, len, bark, { ry: Math.PI });
    });
  }
  // the limbs and their crowns; lanterns hang on chains from the lower crowns
  const ends = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5, tilt = 0.85 + (i % 2) * 0.2;
    const base = [tx * 0.6, fork - 2.2 + (i % 3) * 1.1, tz * 0.6];
    const e = limb(m, ...base, a, tilt, 7.5 + (i % 2) * 1.5, 0.85, bark);
    const e2 = limb(m, e[0], e[1] - 0.3, e[2], a + 0.35, tilt * 0.55, 3.6, 0.55, bark);
    ends.push({ base, e, e2, a });
  }
  limb(m, tx, ty - 0.5, tz, 0.2, 0.12, H - fork + 1, 1.2, bark);
  // the canopy: lobes clustered over each limb's end and along it, three more over the
  // leader, so light falls between them onto the plaza
  const cs = s.crown || 1, lobes = [];
  ends.forEach(({ e, e2, a }, i) => {
    for (let j = 0; j < 3; j++) {
      const b = a + (j - 1) * 0.75, rr = 1.4 + j * 0.5;
      lobes.push([e2[0] + Math.sin(b) * rr, e2[1] + 0.3 + (j % 2) * 1.3, e2[2] + Math.cos(b) * rr, (3.2 + ((i + j) % 3) * 0.6) * cs]);
    }
    lobes.push([(e[0] + e2[0]) / 2 - Math.sin(a) * 1.2, e[1] + 1.0, (e[2] + e2[2]) / 2 - Math.cos(a) * 1.2, 2.9 * cs]);
  });
  for (let j = 0; j < 3; j++) lobes.push([tx + Math.sin(j * 2.1) * 2.4, T + H - 2.4 + j * 0.9, tz + Math.cos(j * 2.1) * 2.4, (4.0 - j * 0.6) * cs]);
  lobes.forEach(([x, y, z, r], i) => crown(m, x, y, z, r, 2.1 + (i % 3) * 0.5, LEAF[i % LEAF.length], i * 1.3));
  // lanterns on chains from the limbs: one under each, four more further out
  ends.forEach(({ base, e, e2 }, i) => {
    const hangs = [lerp3(base, e, 0.6)];
    if (i < 4) hangs.push(lerp3(e, e2, 0.4));
    hangs.forEach((p, j) => {
      const drop = 1.4 + ((i + j) % 3) * 0.7, ly = p[1] - drop - 0.95;
      m.trim(p[0], ly + 0.94, p[2], 0.05, drop, 0.05, 'metal', { layer: 'metal' });
      m.lantern(p[0], ly, p[2], { post: 0, light: j === 0 && i % 2 === 0, intensity: 1.6, distance: 14, priority: 1 });
    });
  });
  exclusions.push({ x: s.x, z: s.z, r: steps[0] + 1 });
  add(m.build());
  return steps[0] + 1;
}

// ---------------------------------------------------------------- the Crucible
// Local frame: the site's centre, yaw 0. A ring piece at angle a stands in the frame turned
// by a, where +z runs out from the centre and +x along the ring.
export function buildCrucible(world, s, add, exclusions) {
  const R = s.r ?? 18, gap = s.gapYaw ?? -Math.PI / 2;
  const m = new Mason(world, { x: s.x, z: s.z, palette: 'salt', tag: 'crucible', name: 'The Crucible', lights: 7 });
  const S = Math.max(0, m.highest(2 * R, 2 * R)) + 0.08; // the sand
  const N = 48, da = TAU / N;
  const BAR0 = R + 0.4, BAR1 = R + 1.4, WALK = BAR1 + 1.6, TIER = 0.85, TIERS = 4, RT = 0.45;
  const PROM0 = WALK + TIER * TIERS, PROM1 = PROM0 + 1.4, OUT1 = PROM1 + 0.8;
  const yBar = S + 3.2, yWalk = S + 2.3, yTier = (k) => yWalk + RT * (k + 1), yProm = yTier(TIERS), yOut = yProm + 1.1;
  const OPEN = 0.95; // half the open sector toward the town, either side of the gate
  const chord = (r) => 2 * r * Math.tan(da / 2) + 0.06;
  const lo = m.lowest(2 * OUT1 + 2, 2 * OUT1 + 2);

  // the sand, laid level over the whole pit, raked darker where the fights turn
  m.k.prism(0, lo - 0.6, 0, R + 0.5, S - lo + 0.6, 'sand', { sides: N, ry: gap });
  world.colliders.addCyl({ x: s.x, z: s.z, r: R + 0.45, y0: m.y + lo - 0.6, y1: m.y + S, tag: 'crucible' });
  for (let i = 0; i < 6; i++) {
    const a = gap + Math.PI + (i - 2.5) * 0.7, r = 5 + (i % 3) * 3.4;
    m.trim(Math.sin(a) * r, S, Math.cos(a) * r, 2.6 + (i % 2) * 1.8, 0.02, 1.2 + (i % 3) * 0.6, 'sand2', { ry: a + i, grad: 0 });
  }
  m.k.prism(0, S, 0, 2.6, 0.02, 'sand2', { sides: 8, grad: 0 });

  for (let i = 0; i < N; i++) {
    const a = gap + i * da, off = angDiff(a, gap);
    const cavea = off > OPEN, gate = off < da * 1.5;
    m.at(0, 0, a, (q) => {
      // the fighting wall: coursed stone, sand side shields, a coping to lean on
      if (!gate) {
        const g = Math.min(S, q.lowest(chord(BAR1), BAR1 - BAR0, 0, (BAR0 + BAR1) / 2));
        q.mass(0, g - 0.6, (BAR0 + BAR1) / 2, chord(BAR1), yBar - g + 0.6, BAR1 - BAR0, { climbable: false });
        q.trim(0, yBar, (BAR0 + BAR1) / 2, chord(BAR1) + 0.04, 0.18, BAR1 - BAR0 + 0.3, 'edge');
        if (i % 4 === 2) {
          const zf = BAR0 - 0.05, c = i % 8 === 2 ? 'cloth' : 'accent';
          q.trim(0, S + 1.45, zf, 0.95, 0.95, 0.08, c);
          q.k.wedge(0, S + 1.0, zf, 0.95, 0.45, 0.08, c, { rz: Math.PI });
          q.trim(0, S + 1.75, zf - 0.04, 0.24, 0.24, 0.06, 'brass');
        }
        if (cavea && i % 12 === 0) {
          F.brazier(q, 0, yBar + 0.18, (BAR0 + BAR1) / 2, { h: 0.5, intensity: 1.8, distance: 16, priority: 0.9 });
        }
      }
      if (!cavea) return;
      // the cavea: a solid core to the walk, four tiers of seats, the promenade, the outer wall
      const g = q.lowest(chord(OUT1), OUT1 - BAR1, 0, (BAR1 + OUT1) / 2);
      q.block(0, g - 0.6, (BAR1 + OUT1) / 2, chord(OUT1), yWalk - g + 0.6, OUT1 - BAR1, 'floor', { climbable: false });
      for (let k = 0; k < TIERS; k++) {
        const r0 = WALK + TIER * k;
        q.block(0, yWalk, (r0 + PROM1) / 2, chord(PROM1), yTier(k) - yWalk, PROM1 - r0, k % 2 ? 'stone2' : 'stone', { climbable: false });
        q.trim(0, yTier(k) - 0.05, r0 + 0.05, chord(r0 + 0.1), 0.07, 0.12, 'edge');
      }
      q.block(0, yWalk, (PROM0 + PROM1) / 2, chord(PROM1), yProm - yWalk, PROM1 - PROM0, 'floor', { climbable: false });
      q.mass(0, g - 0.6, (PROM1 + OUT1) / 2, chord(OUT1), yOut - g + 0.6, OUT1 - PROM1, { climbable: false });
      q.trim(0, yOut, (PROM1 + OUT1) / 2, chord(OUT1) + 0.06, 0.16, OUT1 - PROM1 + 0.3, 'edge');
      // the outer face: a blind arcade, a pier at every bay's edge, banners on every sixth
      const zo = OUT1 + 0.3, go = Math.min(S, q.ground(0, zo)), half = OUT1 * Math.tan(da / 2);
      q.pier(half, go - 0.4, zo, 1.0, yOut + 0.5 - go + 0.4, { d: 0.6 });
      if (i % 6 === 3) {
        q.block(half, yOut + 0.5, zo, 0.16, 4.6, 0.16, 'timber', { walkable: false });
        q.banner(half, yOut + 2.4, zo + 0.14, 1.1, 2.4, i % 12 === 3 ? 'cloth' : 'accent', 0);
      }
      const sp = 2 * half - 1.3, spring = S + 1.7;
      q.trim(0, go - 0.1, OUT1 + 0.02, sp, spring + sp / 2 - go + 0.1, 0.04, 'dark', { grad: 0 });
      q.k.arch(0, spring, OUT1 + 0.12, sp, { t: 0.32, depth: 0.22, c: 'edge', key: 'edge' });
    });
  }

  // the cavea's ends: stepped cheeks on the tiers, and a stair up to the walk from the open
  // ground on the town side
  for (const side of [-1, 1]) {
    const aE = gap + side * (Math.ceil(OPEN / da - 0.5) + 0.5) * da; // the edge of the last cavea bay
    m.at(0, 0, aE, (q) => {
      // the frame's +x runs on round the ring: the cavea lies on the side's own hand
      const sx = side * 0.2;
      for (let k = 0; k <= TIERS; k++) {
        const r0 = k < TIERS ? WALK + TIER * k : PROM0, r1 = k < TIERS ? r0 + TIER : PROM1;
        const top = k < TIERS ? yTier(k) : yProm;
        q.block(sx, yWalk, (r0 + r1) / 2, 0.5, top + 1.0 - yWalk, r1 - r0, 'stone2', { walkable: false });
        q.trim(sx, top + 1.0, (r0 + r1) / 2, 0.62, 0.1, r1 - r0 + 0.04, 'edge');
      }
      const zc = (BAR1 + WALK) / 2, w = WALK - BAR1 - 0.1;
      const g = Math.max(0, q.ground(-side * 2, zc));
      const n = Math.ceil((yWalk - g) / RISE - 1e-6), L = n * 0.45;
      const xFoot = -side * (L + 0.1);
      q.stair(xFoot, zc, side > 0 ? Math.PI / 2 : -Math.PI / 2, w, g, yWalk, { cheeks: 1.0 });
      q.lantern(xFoot - side * 0.5, g, WALK + 0.9, { post: 2.2, light: side > 0, intensity: 1.2 });
    });
  }

  // the Gate of Trials: two piers carrying an arch over the gap in the wall, its portcullis
  // drawn up, the Compact's banners and two braziers over the attic
  m.at(0, 0, gap, (q) => {
    const zc = (BAR0 + BAR1) / 2, half = 2.85, pw = 1.1, d = 1.7, spring = S + 3.0;
    for (const sx of [-1, 1]) {
      const px = sx * (half + pw / 2);
      const g = Math.min(S, q.lowest(pw, d, px, zc));
      q.pier(px, g - 0.4, zc, pw, spring - g + 0.4, { d });
      q.mass(px, spring, zc, pw, 4.0, d, { climbable: false });
      q.banner(px, spring + 0.5, zc + d / 2 + 0.06, 0.9, 2.6, 'cloth', 0);
      q.banner(px, spring + 0.5, zc - d / 2 - 0.06, 0.9, 2.6, 'accent', Math.PI);
    }
    q.k.arch(0, spring, zc, half * 2, { t: 0.6, depth: d, spandrel: true, spandrelH: 0.45, c: 'edge', fill: 'stone', key: 'edge' });
    q.solid(0, spring + half, zc, half * 2, 1.4, d, { walkable: false });
    const attic = spring + half + 1.05;
    q.mass(0, attic, zc, (half + pw) * 2, 0.95, d + 0.1, { climbable: false });
    q.trim(0, attic + 0.95, zc, (half + pw) * 2 + 0.3, 0.2, d + 0.4, 'edge');
    for (const face of [-1, 1]) {
      const fz = zc + face * (d / 2 + 0.06);
      q.trim(0, attic + 0.12, fz, 0.9, 0.7, 0.06, 'accent');
      q.k.wedge(0, attic - 0.2, fz, 0.9, 0.32, 0.06, 'accent', { rz: Math.PI });
      for (const e of [-1, 1]) q.trim(e * 0.85, attic + 0.2, fz, 0.12, 0.12, 0.05, 'brass', { rz: e * 0.8 });
    }
    // the portcullis drawn up into the arch: bars to the intrados, two rails across
    for (let j = -3; j <= 3; j++) {
      const x = j * 0.6, crownY = spring + Math.sqrt(half * half - x * x) - 0.08;
      q.trim(x, crownY - 1.1, zc, 0.09, 1.1, 0.09, 'metal', { layer: 'metal' });
    }
    for (const yy of [1.85, 2.3]) q.trim(0, spring + yy, zc, 3.9, 0.09, 0.09, 'metal', { layer: 'metal' });
    for (const sx of [-1, 1]) F.brazier(q, sx * (half + pw / 2), attic + 1.15, zc, { h: 0.4, light: sx > 0, intensity: 2.2, distance: 18, priority: 1 });
    // the forecourt: flags laid from the gate to the foot of the Crucible Gate Stair
    const f0 = BAR0 + 0.1, f1 = OUT1 - 2.2;
    q.footing(0, (f0 + f1) / 2, half * 2 + 3.2, f1 - f0, S, { c: 'floor', cap: false });
    // the Pitmaster's table at the gate: his ledger, the purse and the entry tokens
    F.table(q, 3.8, S, f1 - 1.4, 1.8, 0.9, { ry: Math.PI / 2 });
    q.trim(3.8, S + 0.82, f1 - 1.4, 0.5, 0.06, 0.7, '#d8cfae', { ry: Math.PI / 2, grad: 0 });
    F.crate(q, 3.9, S, f1 - 0.1, 0.7);
  });

  // the Pitmaster's tribune across the sand: a loggia on the upper tiers under a slate hip
  m.at(0, 0, gap + Math.PI, (q) => {
    const z0 = WALK + TIER * 3, z1 = PROM1, zc = (z0 + z1) / 2, hw = 3.4;
    const P = yProm + 0.3;
    q.block(0, yWalk, zc, hw * 2 + 0.6, P - yWalk, z1 - z0, 'stone', { climbable: false });
    q.trim(0, P - 0.06, zc, hw * 2 + 0.7, 0.08, z1 - z0 + 0.1, 'edge');
    for (const sx of [-1, 1]) for (const z of [z0 + 0.35, z1 - 0.35]) q.column(sx * (hw - 0.3), P, z, 3.3, 0.3);
    q.rail(-hw + 0.6, z0 + 0.15, -0.9, z0 + 0.15, P, { c: 'timber' });
    q.rail(0.9, z0 + 0.15, hw - 0.6, z0 + 0.15, P, { c: 'timber' });
    q.trim(0, P + 3.3, zc, hw * 2 + 0.2, 0.4, z1 - z0 + 0.2, 'edge');
    q.roof(0, P + 3.7, zc, hw * 2, z1 - z0, 1.9, { flare: 0.5, overhang: 0.5 });
    F.chair(q, 0, P, zc + 0.3, { ry: Math.PI });
    F.bell(q, -hw + 1.4, P, zc + 0.6, { h: 2.4, s: 0.45, ry: Math.PI });
    for (const sx of [-1, 1]) q.banner(sx * (hw - 0.3), P + 0.6, z0 - 0.1, 0.8, 2.4, 'cloth', Math.PI);
    q.hanging(0, P + 3.3, zc, 0.9, { intensity: 1.2, distance: 10 });
    q.shelter(0, zc, hw * 2, z1 - z0, P, P + 3.4);
  });

  // the ways a walker takes: in through the Gate of Trials to the sand, and up into the stands
  const polar = (a, r) => new THREE.Vector3(s.x + Math.sin(a) * r, 0, s.z + Math.cos(a) * r);
  const aE = gap + (Math.ceil(OPEN / da - 0.5) + 0.5) * da, zc = (BAR1 + WALK) / 2;
  const nE = Math.ceil(yWalk / RISE - 1e-6) + 1;
  const tangent = (x) => new THREE.Vector3(s.x + Math.sin(aE) * zc + Math.cos(aE) * x, 0, s.z + Math.cos(aE) * zc - Math.sin(aE) * x);
  const routes = {
    gate: [polar(gap, OUT1 - 2.6), polar(gap, (BAR0 + BAR1) / 2), polar(gap, R * 0.45), polar(gap, 1.5)],
    stands: [tangent(-nE * 0.45 - 1.2), tangent(0.4), polar(aE + 2.5 * da, zc), polar(aE + 2.5 * da, WALK + TIER * 2.5), polar(aE + 2.5 * da, (PROM0 + PROM1) / 2), polar(aE + 6 * da, (PROM0 + PROM1) / 2)],
  };
  exclusions.push({ x: s.x, z: s.z, r: OUT1 + 3 });
  world.arena = { x: s.x, z: s.z, r: R, y: m.y + S, gap, routes, stands: m.y + yProm };
  add(m.build());
}

// ---------------------------------------------------------------- the Vowkeeper's Perch
// s.podium: { x0, x1, z0, z1 } in world metres (the knoll's built crown), s.stair: the
// public stair's axis z on the podium's -x face; the rotunda stands at (s.x, s.z).
export function buildVowPerch(world, s, add, exclusions) {
  const pd = s.podium, top = s.top;
  const m = new Mason(world, { x: s.x, z: s.z, palette: 'salt', tag: 'vow_perch', name: s.name || "Vowkeeper's Perch", y: top, lights: 5 });
  const X0 = pd.x0 - s.x, X1 = pd.x1 - s.x, Z0 = pd.z0 - s.z, Z1 = pd.z1 - s.z;
  const t = 1.2, P = 0.15; // revetment thickness; the paving stands a hair over the knoll
  const sz = s.stair - s.z, sw = 5;
  // the paving over the whole crown, laid in strips of the two salt stones
  const strips = Math.round((X1 - X0) / 3);
  for (let i = 0; i < strips; i++) {
    const x0 = X0 + (X1 - X0) * i / strips, x1 = X0 + (X1 - X0) * (i + 1) / strips;
    m.trim((x0 + x1) / 2, P - 0.4, (Z0 + Z1) / 2, x1 - x0 + 0.01, 0.4, Z1 - Z0, i % 2 ? 'floor' : 'stone2', { grad: 0 });
  }
  m.solid((X0 + X1) / 2, -0.6, (Z0 + Z1) / 2, X1 - X0, P + 0.6, Z1 - Z0, { climbable: false });
  // the revetment on the three open faces, with a plinth course, pilasters and a parapet
  const faces = [
    { ax: X0, az: s.eastEnd - s.z, bx: X0, bz: Z0, n: -1, axis: 'x' },  // -x face (the North Way side)
    { ax: X0, az: Z0, bx: X1, bz: Z0, n: -1, axis: 'z' },  // -z face
    { ax: X1, az: Z0, bx: X1, bz: s.westEnd - s.z, n: 1, axis: 'x' }, // +x face, to the tower
  ];
  for (const f of faces) {
    const len = Math.hypot(f.bx - f.ax, f.bz - f.az), ry = Math.atan2(f.bx - f.ax, f.bz - f.az);
    const ox = f.axis === 'x' ? f.n * t / 2 : 0, oz = f.axis === 'z' ? f.n * t / 2 : 0;
    const bays = Math.max(1, Math.round(len / 3));
    for (let i = 0; i < bays; i++) {
      const u0 = len * i / bays, u1 = len * (i + 1) / bays, uc = (u0 + u1) / 2;
      const cx = f.ax + (f.bx - f.ax) * uc / len - ox, cz = f.az + (f.bz - f.az) * uc / len - oz;
      const g = m.lowest(u1 - u0, t + 1, cx + ox * 2, cz + oz * 2, ry);
      // leave the stair's mouth open in the parapet
      const atStair = f.axis === 'x' && f.n < 0 && Math.abs(cz - sz) < sw / 2 + 0.4;
      m.mass(cx, g - 0.6, cz, t, P - g + 0.6, u1 - u0 + 0.02, { ry, climbable: false });
      m.trim(cx + ox * 0.3, g - 0.1, cz + oz * 0.3, t + 0.3, 1.2, u1 - u0 + 0.04, 'stone2', { ry });
      m.trim(cx + ox * 0.2, P - 0.55, cz + oz * 0.2, t + 0.16, 0.22, u1 - u0 + 0.04, 'edge', { ry });
      if (!atStair) {
        m.block(cx, P, cz, 0.5, 0.95, u1 - u0 + 0.02, 'stone', { ry, walkable: false });
        m.trim(cx, P + 0.95, cz, 0.66, 0.12, u1 - u0 + 0.08, 'edge', { ry });
      }
      if (i > 0) {
        const px = f.ax + (f.bx - f.ax) * u0 / len + ox * 0.6, pz = f.az + (f.bz - f.az) * u0 / len + oz * 0.6;
        m.trim(px, g - 0.1, pz, f.axis === 'x' ? 0.5 : 0.9, P - g + 1.2, f.axis === 'x' ? 0.9 : 0.5, 'stone2');
      }
    }
  }
  // the public stair: down the -x face to the North Way's terrace, a landing halfway
  {
    const terrace = m.ground(X0 - 12, sz);
    const n1 = Math.ceil((P - terrace) / RISE / 2), rise = (P - terrace) / (n1 * 2);
    const run = 0.45, L1 = n1 * run, land = 1.8;
    const xHead = X0;
    // upper flight from the landing to the head, lower flight from the terrace to the landing
    const yMid = terrace + n1 * rise;
    m.stair(xHead - L1, sz, Math.PI / 2, sw, yMid, P, { rise, cheeks: 1.0 });
    m.landing(xHead - L1 - land / 2, sz, land, sw, yMid);
    for (const e of [-1, 1]) m.parapet(xHead - L1 - land, sz + e * (sw / 2 + 0.25), xHead - L1, sz + e * (sw / 2 + 0.25), yMid, { t: 0.5 });
    m.stair(xHead - L1 * 2 - land, sz, Math.PI / 2, sw, terrace, yMid, { rise, cheeks: 1.0 });
    const xFoot = xHead - L1 * 2 - land;
    for (const e of [-1, 1]) {
      m.block(xFoot - 0.45, terrace - 0.3, sz + e * (sw / 2 + 0.25), 0.9, 1.8, 0.9, 'stone', { walkable: false });
      m.lantern(xFoot - 0.45, terrace + 1.5, sz + e * (sw / 2 + 0.25), { post: 0.9, light: e > 0, intensity: 1.2 });
      m.lantern(xHead + 0.6, P, sz + e * (sw / 2 + 0.6), { post: 2.4, light: false });
    }
    world.approaches ||= [];
    world.approaches.push({ id: 'vow_stair', top: m.point(xHead + 1, P, sz), foot: m.point(xFoot - 1.4, terrace, sz),
      route: [[xFoot - 1.4, sz], [xHead + 1.5, sz], [-7.5, sz], [-4.4, 1.8], [-2.4, 1.0]].map(([x, z]) => m.point(x, 0, z)) });
  }
  // the rotunda: three steps, eight columns, a ring of lintels, a slate dome and its lantern
  const steps = [7.0, 6.4, 5.8], C = 5.0, CH = 5.6;
  steps.forEach((r, i) => {
    m.k.prism(0, P - 0.2 + RISE * i, 0, r, RISE + 0.2, i % 2 ? 'stone2' : 'stone', { sides: 8, ry: Math.PI / 8 });
    m.k.prism(0, P + RISE * (i + 1) - 0.05, 0, r + 0.03, 0.05, 'edge', { sides: 8, ry: Math.PI / 8 });
    world.colliders.addCyl({ x: m.point(0, 0, 0).x, z: m.point(0, 0, 0).z, r: r * 0.95, y0: m.y + P - 0.2, y1: m.y + P + RISE * (i + 1), tag: 'vow_perch' });
  });
  const B = P + RISE * 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    m.column(Math.sin(a) * C, B, Math.cos(a) * C, CH, 0.4);
    const am = a + Math.PI / 8, ri = C * Math.cos(Math.PI / 8);
    m.at(Math.sin(am) * ri, Math.cos(am) * ri, am, (q) => {
      q.block(0, B + CH, 0, 2 * C * Math.sin(Math.PI / 8) + 0.9, 0.75, 0.9, 'stone', { walkable: false });
      q.trim(0, B + CH + 0.75, 0, 2 * C * Math.sin(Math.PI / 8) + 1.3, 0.2, 1.3, 'edge');
    });
  }
  const E = B + CH + 0.95;
  m.k.prism(0, E, 0, C + 0.9, 0.5, 'stone2', { sides: 8, ry: Math.PI / 8 });
  m.k.pyramid(0, E + 0.5, 0, C + 1.5, 3.8, 'roof', { sides: 8, ry: Math.PI / 8 });
  m.k.prism(0, E + 0.38, 0, C + 1.55, 0.14, 'ridge', { sides: 8, ry: Math.PI / 8 });
  m.k.prism(0, E + 3.4, 0, 1.4, 1.5, 'stone', { sides: 8, ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    m.k.glowPanel(Math.sin(a) * 1.3, E + 4.15, Math.cos(a) * 1.3, 0.5, 0.8, 0.08, 'glow', 1.4, { ry: a });
  }
  m.k.pyramid(0, E + 4.9, 0, 1.75, 1.7, 'roof', { sides: 8, ry: Math.PI / 8 });
  m.k.prism(0, E + 6.6, 0, 0.1, 1.1, 'brass', { sides: 4, layer: 'metal' });
  m.k.prism(0, E - 0.14, 0, C * 0.86, 0.14, 'ceiling', { sides: 8, ry: Math.PI / 8 });
  for (const ry of [0, Math.PI / 2]) m.trim(0, E - 0.4, 0, 0.26, 0.26, C * 1.7, 'timber', { ry });
  // the vow stone: an octagonal pedestal, a lit basin, and the vow-light over it
  m.k.prism(0, B, 0, 1.25, 0.9, 'stone2', { sides: 8 });
  m.k.prism(0, B + 0.9, 0, 1.4, 0.18, 'edge', { sides: 8 });
  m.glow(0, B + 1.08, 0, 1.4, 0.06, 1.4, 1.2);
  m.pillar(0, B, 0, 1.3, 1.08);
  m.light(0, B + 2.4, 0, { color: '#ffe9a3', intensity: 2.5, distance: 16, priority: 1.4 });
  m.shelter(0, 0, 9, 9, B, E + 0.5);
  // the court: two benches facing the vow stone and lamp stands on the corners
  for (const e of [-1, 1]) F.bench(m, e * 8.6, P, 0, 3.2, { ry: e > 0 ? -Math.PI / 2 : Math.PI / 2, back: true });
  for (const [x, z] of [[X0 + 1.6, Z0 + 1.6], [X1 - 1.6, Z0 + 1.6], [X0 + 1.6, Z1 - 4]]) F.lanternStand(m, x, P, z, { post: 2.2, light: false });
  for (const [x, z] of [[X1 - 3, Z1 - 7], [X0 + 4.5, Z0 + 4]]) F.tree(m, x, P, z, { h: 5.4, planter: true });
  add(m.build());
  // the vow-light, its own small kit so it can turn
  const k = new Kit(BUILD_PALETTES.salt);
  k.crystal(0, -0.55, 0, 0.42, 1.1, '#ffe9a3', { layer: 'glow', strength: 2 });
  const orb = k.build('vow_light');
  const p = m.point(0, B + 2.2, 0);
  orb.position.copy(p);
  orb.userData.dynamic = true;
  add(orb);
  world.animated.push((time) => { orb.position.y = p.y + Math.sin(time) * 0.2; orb.rotation.y = time * 0.5; });
  exclusions.push({ x: (pd.x0 + pd.x1) / 2, z: (pd.z0 + pd.z1) / 2, r: Math.hypot(pd.x1 - pd.x0, pd.z1 - pd.z0) / 2 + 2 });
}

// ---------------------------------------------------------------- market stalls
export function buildStall(world, s, add, exclusions) {
  const V = vernacularOf(s), pal = PAL[V];
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, palette: pal, tag: 'stall', name: 'stall', lights: 1 });
  const w = 4.2, d = 2.4;
  m.footing(0, 0, w + 0.6, d + 0.6, 0.12, { c: 'stone2', cap: false });
  // trestle counter toward the street (+z), goods rack at the back
  F.counter(m, 0, 0.12, d / 2 - 0.45, w - 0.6, { goods: false });
  const goods = ['cloth', 'accent', 'brass', 'moss', 'cushion'];
  for (let i = 0; i < 5; i++) {
    const gx = -w / 2 + 0.75 + i * 0.68;
    if (i % 2) m.k.prism(gx, 1.2, d / 2 - 0.45, 0.24, 0.26, 'wood', { sides: 7, top: 1.2 });
    m.trim(gx, i % 2 ? 1.42 : 1.2, d / 2 - 0.45, 0.36, 0.2, 0.32, goods[(i + Math.round(s.x)) % 5]);
  }
  F.shelves(m, 0, 0.12, -d / 2 + 0.3, w - 1.0, 1.9);
  F.crate(m, -w / 2 + 0.5, 0.12, -0.1, 0.65);
  F.barrel(m, w / 2 - 0.55, 0.12, -0.2);
  // four posts carry an awning that falls toward the street, striped in the town's cloth
  const hB = 3.0, hF = 2.55;
  for (const sx of [-1, 1]) {
    m.block(sx * (w / 2 - 0.1), 0.12, -d / 2 + 0.1, 0.16, hB - 0.12, 0.16, 'timber', { walkable: false });
    m.block(sx * (w / 2 - 0.1), 0.12, d / 2 - 0.1, 0.16, hF - 0.12, 0.16, 'timber', { walkable: false });
  }
  // the awning runs from the back posts' heads over the front ones and 0.8 m beyond
  const zb = -d / 2 + 0.1, zf = d / 2 + 0.8, slope = (hB - hF) / (d - 0.2);
  const tilt = Math.atan(slope), len = (zf - zb) / Math.cos(tilt), zc = (zb + zf) / 2;
  const yAt = (z) => hB + 0.08 - slope * (z - zb), stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const sx = -w / 2 - 0.15 + (w + 0.3) * (i + 0.5) / stripes, c = i % 2 ? 'cloth' : 'plaster';
    m.k.at({ x: sx, y: yAt(zc), z: zc, rx: tilt }, (k) => k.slab(0, -0.03, 0, (w + 0.3) / stripes + 0.01, 0.06, len, c));
    m.k.wedge(sx, yAt(zf) - 0.4, zf, (w + 0.3) / stripes, 0.36, 0.05, c, { rz: Math.PI });
  }
  m.trim(0, hB - 0.1, -d / 2 + 0.1, w, 0.14, 0.14, 'timber');
  m.trim(0, hF - 0.1, d / 2 - 0.1, w, 0.14, 0.14, 'timber');
  m.hanging(w / 2 - 0.4, hF - 0.1, d / 2 - 0.1, 0.7, { light: s.light ?? false, intensity: 0.8 });
  m.shelter(0, 0.2, w, d + 0.6, 0, hF);
  exclusions.push({ x: s.x, z: s.z, r: 3.6 });
  add(m.build());
}

// ---------------------------------------------------------------- terrace stairs
// From (x, z) at y up to (x2, z2) at y2, on long treads where the slope is gentle.
export function buildTerraceStair(world, s, add, exclusions) {
  const V = vernacularOf(s), pal = PAL[V];
  const dx = s.x2 - s.x, dz = s.z2 - s.z, len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  const y0 = s.y ?? world.terrain.heightAt(s.x, s.z), y1 = s.y2 ?? world.terrain.heightAt(s.x2, s.z2);
  const m = new Mason(world, { x: s.x, z: s.z, yaw, y: y0, palette: pal, tag: 'stair', name: 'terrace stair', lights: 2 });
  const w = s.w || 4, rise = y1 - y0;
  // risers of at most 0.3 m; where the slope is too steep for treads the walker can take,
  // the treads keep 0.42 m and the risers share the rise
  const n0 = Math.max(2, Math.ceil(rise / RISE - 1e-6));
  const N = len / n0 >= 0.42 ? n0 : Math.max(2, Math.floor(len / 0.42));
  const run = len / N, ry = rise / N;
  for (let i = 0; i < N; i++) {
    const top = ry * (i + 1), z = run * (i + 0.5);
    const base = Math.min(top - ry - 0.3, m.lowest(w, run, 0, z) - 0.4);
    m.k.slab(0, base, z, w, top - base, run, 'stone');
    m.solid(0, base, z, w, top - base, run + 0.04, { climbable: false });
    m.trim(0, top - 0.06, z - run / 2 + 0.05, w - 0.04, 0.07, 0.12, 'edge');
    // cheek walls step up with the treads, every other tread a coping stone
    for (const e of [-1, 1]) {
      const cx = e * (w / 2 + 0.25), cg = Math.min(base, m.lowest(0.5, run, cx, z) - 0.3);
      m.block(cx, cg, z, 0.5, top - cg + 0.9, run + 0.01, 'stone2', { walkable: false });
      if (i % 2 === 0) m.trim(cx, top + 0.9, z, 0.62, 0.12, Math.min(run * 2, len - z + run / 2), 'edge');
    }
  }
  // lamp piers at the foot and the head
  for (const e of [-1, 1]) for (const [z, y] of [[-0.4, 0], [len + 0.4, rise]]) {
    m.block(e * (w / 2 + 0.25), y - 0.3, z, 0.8, 1.5, 0.8, 'stone', { walkable: false });
    m.lantern(e * (w / 2 + 0.25), y + 1.2, z, { post: 0.9, light: e > 0 && z > 0, intensity: 1.0 });
  }
  exclusions.push({ x: (s.x + s.x2) / 2, z: (s.z + s.z2) / 2, r: len / 2 + 3 });
  add(m.build());
}

// ---------------------------------------------------------------- lamps, wells and streets
// A street lamp in the town's palette: a stone foot, an iron shaft and a lit cage.
export function buildLamp(world, s, add, exclusions) {
  const m = new Mason(world, { x: s.x, z: s.z, palette: PAL[vernacularOf(s)], tag: null, name: 'lamp', lights: 1 });
  F.lanternStand(m, 0, 0, 0, { post: s.h ?? 2.6, light: s.light !== false, intensity: 1.3, priority: 0.7 });
  exclusions.push({ x: s.x, z: s.z, r: 1.2 });
  add(m.build());
}

// A draw well under a little roof, or a spring in its kerbed pool; both keep the
// well's interaction (drink / refill).
export function buildWell(world, s, add, exclusions) {
  // props keep untagged colliders: the well is a thing to walk up to, not architecture
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, palette: PAL[vernacularOf(s)], tag: null, name: 'well', lights: 0 });
  const lo = m.lowest(3, 3);
  if (s.spring) {
    m.k.prism(0, lo - 0.3, 0, 2.0, 0.85 - lo, 'stone2', { sides: 8 });
    m.k.prism(0, 0.55, 0, 2.06, 0.08, 'edge', { sides: 8 });
    m.k.prism(0, 0.4, 0, 1.55, 0.2, 'moss', { sides: 8 });
    m.k.prism(0, 0.58, 0, 1.4, 0.02, '#3a8ab0', { sides: 8, layer: 'glow', strength: 0.35 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      m.k.rock(Math.sin(a) * 2.25, 0.2, Math.cos(a) * 2.25, 0.6, 0.45 + (i % 3) * 0.1, 0.55, 'stone2', { ry: a });
    }
    m.pillar(0, lo - 0.3, 0, 1.9, 0.93 - lo);
  } else {
    m.k.prism(0, lo - 0.3, 0, 1.25, 1.2 - lo, 'stone', { sides: 8 });
    m.k.prism(0, 0.9, 0, 1.32, 0.12, 'edge', { sides: 8 });
    m.k.prism(0, 0.88, 0, 0.95, 0.02, 'dark', { sides: 8, grad: 0 });
    m.pillar(0, lo - 0.3, 0, 1.25, 1.32 - lo);
    for (const sx of [-1, 1]) m.block(sx * 1.05, 0.9, 0, 0.18, 1.9, 0.18, 'timber', { walkable: false });
    m.k.at({ x: 0, y: 2.1, z: 0, rz: Math.PI / 2 }, (k) => k.prism(0, -1.05, 0, 0.12, 2.1, 'wood', { sides: 6 }));
    m.trim(0, 1.25, 0, 0.03, 0.85, 0.03, 'metal', { layer: 'metal' });
    m.k.prism(0, 1.05, 0, 0.18, 0.24, 'wood', { sides: 6 });
    m.roof(0, 2.8, 0, 2.2, 1.6, 0.9, { kind: 'gable', along: 'x', overhang: 0.3, solid: false });
  }
  add(m.build());
  world.addInteract({ id: s.id, kind: 'well', pos: m.point(0, 1, 0), radius: 3.2, label: 'Drink / Refill' });
  exclusions.push({ x: s.x, z: s.z, r: 3 });
}

// A street: kerbstones down both sides of a polyline (metres round s), set in the ground.
export function buildStreet(world, s, add, exclusions) {
  const m = new Mason(world, { x: s.x, z: s.z, palette: PAL[vernacularOf(s)], tag: 'street', name: 'street', lights: 0 });
  const P = s.points, w = s.w ?? 4.4;
  for (let i = 1; i < P.length; i++) {
    const [ax, az] = P[i - 1], [bx, bz] = P[i], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const n = Math.max(1, Math.round(len / 1.15)), ry = Math.atan2(ux, uz);
    for (let j = 0; j < n; j++) for (const side of [-1, 1]) {
      const t = (j + 0.5) / n, x = ax + (bx - ax) * t + uz * side * w / 2, z = az + (bz - az) * t - ux * side * w / 2;
      if ((s.gaps || []).some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) < r)) continue;
      const g = m.ground(x, z);
      m.trim(x, g - 0.25, z, 0.3, 0.37, len / n - 0.06, j % 3 ? 'stone2' : 'stone', { ry });
    }
    exclusions.push({ ...m.point((ax + bx) / 2, 0, (az + bz) / 2), r: len / 2 + w / 2 });
  }
  add(m.build());
}
