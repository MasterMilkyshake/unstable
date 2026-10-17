// Gatehouses: one gatehouse, not an arch with things set on it. Two flanking towers swallow
// the ends of the curtain; the block between them carries a vaulted passage, the raised
// portcullis in its grooves, a machicolated parapet over the field and the winch house that
// lifts the grille. Built with the shared kit and collided through siteFrame so the camera
// meets the same masonry the eye does. The Saltreach sea gate is the type; the side, north
// and Meridian gates are the same gatehouse at their own size, height and palette.
//
// Local frame: +z is the inside (town), -z the outside, y = 0 the ground at the gate centre.
import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { BUILD_PALETTES } from './mason.js';

const SHARP = 0.75; // pointed-arch ratio (kit.arch)

// Gate palettes are the ring palettes, with the dark of an iron-shod door.
function gatePalette(name) {
  const p = BUILD_PALETTES[name] || BUILD_PALETTES.salt;
  return { ...p, dark: '#2b2622', metal: '#3f4144', glow: p.lantern || p.glow };
}

// Height of the pointed intrados above the spring at local x (matches Kit.arch).
function intradosFor(PW) {
  const rr = PW * 2 * SHARP;
  const cx = rr - PW;
  return (x) => {
    const ax = Math.abs(x);
    if (ax >= PW) return 0;
    return Math.sqrt(Math.max(0, rr * rr - (cx + ax) ** 2));
  };
}

function tower(k, f, sx, G) {
  const { TX, TW, TD, TH, BH, SPRING, tag } = G;
  const x = sx * TX;
  const lowest = f.lowest(TW + 1.6, TD + 1.6, x, 0);
  k.footing(x, 0, TW + 0.6, TD + 0.6, 0.5, lowest, 'stone2', { cap: 'stone2' });
  // Battered talus: the tower base splays into the rock it stands on.
  // ry turns each ramp's tall side (local -z) against the tower.
  for (const [ox, oz, w, d, ry] of [[0, -1, TW + 1.4, 0.9, Math.PI], [0, 1, TW + 1.4, 0.9, 0], [-1, 0, TD + 1.4, 0.9, -Math.PI / 2], [1, 0, TD + 1.4, 0.9, Math.PI / 2]]) {
    k.ramp(x + ox * (TW / 2 + 0.45), 0.5, oz * (TD / 2 + 0.45), w, 1.6, d, 'stone2', { ry });
  }
  k.masonry(x, 0.5, 0, TW, TH - 0.5, TD, { c: 'stone', c2: 'stone2', course: 1.2 });
  // String courses line up with the passage impost and the gate block's walk.
  for (const y of [SPRING - 0.3, BH - 0.35]) k.slab(x, y, 0, TW + 0.3, 0.32, TD + 0.3, 'edge');
  // Long-and-short quoins on the outer corners.
  for (let y = 0.5, i = 0; y < TH - 0.6; y += 0.9, i++) {
    const long = i % 2 === 0;
    for (const qz of [-1, 1]) {
      const cx = x + sx * (TW / 2 - (long ? 0.6 : 0.4));
      k.slab(cx, y, qz * (TD / 2 - 0.35), long ? 1.25 : 0.85, 0.84, 0.76, 'edge');
    }
  }
  // Arrow slits on the field faces, one lit window over each face of the gate.
  for (const fz of [-1, 1]) {
    for (const y of [Math.min(3.4, SPRING - 1.6), Math.max(SPRING + 1.2, BH - 3.4)]) k.window(x + sx * TW * 0.2, y, fz * (TD / 2 + 0.01), 0.32, 1.6, { ry: fz < 0 ? Math.PI : 0 });
    k.window(x - sx * TW * 0.2, TH - 3.6, fz * (TD / 2 + 0.01), 0.8, 1.5, { ry: fz < 0 ? Math.PI : 0, lit: true, pointed: true });
  }
  k.window(x + sx * (TW / 2 + 0.01), BH - 3.4, 0, 0.32, 1.6, { ry: sx * Math.PI / 2 });
  // Parapet: a corbelled walk with merlons, then a roofed lookout set back from it so the
  // eaves never touch the merlons or the gate block.
  for (let i = 0; i < 7; i++) {
    const u = -TW / 2 + 0.6 + i * ((TW - 1.2) / 6);
    for (const fz of [-1, 1]) k.ramp(x + u, TH - 1.1, fz * (TD / 2 + 0.2), 0.5, 1.1, 0.5, 'edge', { rz: Math.PI, ry: fz < 0 ? Math.PI : 0 });
  }
  k.slab(x, TH, 0, TW + 0.8, 0.4, TD + 0.8, 'edge');
  const hw = (TW + 0.8) / 2 - 0.3, hd = (TD + 0.8) / 2 - 0.3;
  for (const [ax, az, bx, bz] of [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]]) {
    k.crenels(x + ax, az, x + bx, bz, TH + 0.4, 0.6, { c: 'stone', h: 1.05 });
  }
  f.solid(x, 0, TW, TD, -1, TH + 0.4, { tag });
  if (G.lookout === false) {
    if (G.beacon) {
      // the Enclave's signal brazier on an iron tripod over the tower top
      k.prism(x, TH + 0.4, 0, 0.8, 0.5, 'stone', { sides: 8 });
      k.prism(x, TH + 0.9, 0, 0.55, 0.45, 'metal', { sides: 8, top: 1.3, layer: 'metal' });
      k.glowPanel(x, TH + 1.25, 0, 0.7, 0.3, 0.7, 'glow', 1.4);
    }
    return;
  }
  const LW = Math.min(4.6, TW - 2.4);
  k.masonry(x, TH + 0.4, 0, LW, 3.2, LW, { c: 'plaster', c2: 'plaster', course: 3.2 });
  for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.slab(x + qx * (LW / 2 - 0.15), TH + 0.4, qz * (LW / 2 - 0.15), 0.34, 3.2, 0.34, 'timber');
  k.slab(x, TH + 3.4, 0, LW + 0.2, 0.26, LW + 0.2, 'timber');
  for (const fz of [-1, 1]) k.window(x, TH + 1.3, fz * (LW / 2 + 0.01), 1.2, 1.2, { ry: fz < 0 ? Math.PI : 0, lit: fz < 0 });
  // Flared hip: a shallow skirt under a steeper cap, both inside the parapet's reach.
  const base = TH + 3.66;
  const a0 = LW / 2 + 1.1;
  k.prism(x, base, 0, a0 * Math.SQRT2, 0.8, 'roof', { sides: 4, top: (LW / 2 + 0.45) / a0 });
  k.prism(x, base + 0.7, 0, (LW / 2 + 0.55) * Math.SQRT2, 2.6, 'roof', { sides: 4, top: 0.12 });
  k.slab(x, base + 3.25, 0, 0.3, 0.5, 0.3, 'ridge');
  k.prism(x, base + 3.7, 0, 0.08, 1.1, 'metal', { sides: 4, layer: 'metal' });
  f.solid(x, 0, LW, LW, TH + 0.4, TH + 3.6, { tag });
}

function gateBlock(k, f, G) {
  const { PW, D, SPRING, BH, TX, TW, tag, intrados } = G;
  // Piers either side of the passage rise unbroken to the walk.
  for (const sx of [-1, 1]) {
    const x = sx * (PW + (TX - TW / 2 - PW) / 2);
    const w = TX - TW / 2 - PW;
    k.footing(x, 0, w + 0.4, D + 0.4, 0.3, f.lowest(w, D, x, 0), 'stone2', { cap: 'stone2' });
    k.masonry(x, 0.3, 0, w, BH - 0.3, D, { c: 'stone', c2: 'stone2', course: 1.2 });
    // Impost moulding where the vault springs, carried round the passage reveal.
    k.slab(x - sx * 0.1, SPRING - 0.3, 0, w + 0.2, 0.32, D + 0.3, 'edge');
    f.solid(x, 0, w, D, -1, BH, { tag });
  }
  // The vault: one barrel of pointed voussoirs through the whole depth, its haunches
  // filled to a level bed, then coursed masonry up to the walk.
  k.arch(0, SPRING, 0, PW * 2, { pointed: true, sharp: SHARP, t: 0.95, depth: D, spandrel: true, spandrelH: 0.5, c: 'stone2', fill: 'stone' });
  const bed = SPRING + intrados(0) + 0.95 + 0.5;
  if (BH > bed) k.masonry(0, bed - 0.02, 0, PW * 2 + 2, BH - bed + 0.02, D, { c: 'stone', c2: 'stone2', course: 1.2 });
  // Archivolts frame both mouths, standing proud of the face.
  for (const fz of [-1, 1]) {
    k.arch(0, SPRING, fz * (D / 2 + 0.22), PW * 2 + 0.3, { pointed: true, sharp: SHARP, t: 1.15, depth: 0.45, c: 'edge', key: 'edge' });
    for (const sx of [-1, 1]) k.slab(sx * (PW + 0.55), 0.3, fz * (D / 2 + 0.22), 0.9, SPRING - 0.3, 0.45, 'edge');
  }
  // Colliders follow the vault: stepped boxes under the haunches, then the solid above.
  for (let i = 0; i < 5; i++) {
    const x0 = (PW * i) / 5, x1 = (PW * (i + 1)) / 5;
    const y0 = SPRING + intrados((x0 + x1) / 2);
    for (const sx of [-1, 1]) f.solid(sx * (x0 + x1) / 2, 0, x1 - x0, D, y0, BH, { tag });
  }

  // Paving through the passage, laid on the ground it crosses.
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 6; j++) {
      const x = -PW + 0.05 + (PW * 2 - 0.1) * (i + 0.5) / 3;
      const z = -D / 2 + D * (j + 0.5) / 6 + ((i % 2) - 0.5) * 0.3;
      k.slab(x, f.ground(x, z) - 0.1, z, (PW * 2) / 3 - 0.12, 0.16, D / 6 - 0.12, (i + j) % 2 ? 'stone2' : 'edge', { ry: (j % 3 - 1) * 0.02 });
    }
  }
}

function portcullis(k, G) {
  const { PW, D, SPRING, intrados } = G;
  const z = -D / 2 + 1.5;
  // The grooves it runs in: a dark channel between two jamb ribs on each reveal.
  for (const sx of [-1, 1]) {
    k.slab(sx * (PW - 0.02), 0.3, z, 0.06, SPRING - 0.3, 0.5, 'dark', { grad: 0 });
    for (const dz of [-0.4, 0.4]) k.slab(sx * (PW - 0.12), 0.3, z + dz, 0.28, SPRING - 0.3, 0.26, 'edge');
  }
  // Raised into the vault slot: only the teeth hang under the crown, not a dark grille
  // filling the middle of the passage.
  const crown = SPRING + intrados(0);
  const bottom = crown - 0.55;
  const bars = Math.max(5, Math.round(PW * 3.4));
  for (let i = 0; i < bars; i++) {
    const x = -PW + 0.45 + i * ((PW * 2 - 0.9) / (bars - 1));
    const top = SPRING + intrados(x) + 0.55;
    if (top - bottom < 0.2) continue;
    k.slab(x, bottom, z, 0.12, top - bottom, 0.12, 'metal', { layer: 'metal' });
    k.pyramid(x, bottom - 0.35, z, 0.1, 0.35, 'metal', { sides: 4, rx: Math.PI, layer: 'metal' });
  }
  for (const y of [bottom + 0.2, bottom + 0.55]) {
    const half = Math.max(0, halfWidth(G, y - SPRING) - 0.05);
    if (half > 0.3) k.slab(0, y, z, half * 2, 0.1, 0.1, 'metal', { layer: 'metal' });
  }
}

// Half-width of the passage at height h above the spring.
function halfWidth(G, h) {
  let lo = 0, hi = G.PW;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (G.intrados(m) > h) lo = m; else hi = m;
  }
  return lo;
}

function walkAndWinch(k, f, G) {
  const { D, BH, TX, TW, tag } = G;
  // The walk across the gate block, merlons to the town and a machicolated breastwork to the
  // field: the parapet steps out on corbels so the gate's own wall can be defended.
  const span = (TX - TW / 2) * 2;
  k.slab(0, BH - 0.2, 0, span, 0.3, D, 'edge');
  f.solid(0, 0, span, D, BH - 0.2, BH + 0.1, { tag });
  k.crenels(-span / 2 + 0.2, D / 2 - 0.35, span / 2 - 0.2, D / 2 - 0.35, BH + 0.1, 0.6, { c: 'stone', h: 1.05 });
  for (let i = 0; i < 9; i++) {
    const x = -span / 2 + 0.75 + i * ((span - 1.5) / 8);
    k.ramp(x, BH - 1.5, -D / 2 - 0.35, 0.55, 1.3, 0.7, 'edge', { rz: Math.PI, ry: Math.PI });
  }
  k.slab(0, BH - 0.2, -D / 2 - 0.4, span, 0.3, 1.0, 'edge');
  k.slab(0, BH + 0.1, -D / 2 - 0.7, span, 0.75, 0.45, 'stone');
  k.crenels(-span / 2 + 0.2, -D / 2 - 0.7, span / 2 - 0.2, -D / 2 - 0.7, BH + 0.85, 0.45, { c: 'stone', h: 0.85 });
  f.solid(0, D / 2 - 0.35, span, 0.6, BH, BH + 1.15, { tag, walkable: false });
  f.solid(0, -D / 2 - 0.5, span, 1.0, BH - 0.2, BH + 1.7, { tag, walkable: false });
  if (G.winch === false) return;

  // Winch house: a timber room over the portcullis slot, roofed across the walk.
  const wz = -D / 2 + 2.1, ww = Math.min(6.4, span - 2.6);
  k.slab(0, BH + 0.1, wz, ww, 2.9, 3.4, 'plaster');
  for (const x of [-ww / 2 + 0.15, -ww / 6, ww / 6, ww / 2 - 0.15]) for (const z of [wz - 1.55, wz + 1.55]) k.slab(x, BH + 0.1, z, 0.3, 2.9, 0.3, 'timber');
  k.slab(0, BH + 2.95, wz, ww + 0.3, 0.24, 3.7, 'timber');
  k.slab(0, BH + 0.1, wz + 1.72, 1.2, 2.1, 0.08, 'dark', { grad: 0 });
  k.window(-ww * 0.31, BH + 1.2, wz - 1.72, 0.8, 0.9, { ry: Math.PI, lit: true });
  k.window(ww * 0.31, BH + 1.2, wz - 1.72, 0.8, 0.9, { ry: Math.PI });
  k.roof('gable', 0, BH + 3.15, wz, 3.7, ww + 0.3, 1.9, { c: 'roof', ridge: 'ridge', overhang: 0.45, ry: Math.PI / 2 });
  f.solid(0, wz, ww, 3.4, BH, BH + 3.1, { tag });
}

function dressing(k, f, world, G) {
  const { PW, D, TX, TD } = G;
  // Banners hang on the tower faces toward the field; lanterns on iron arms flank both
  // mouths at a height a passer-by would light them from a ladder.
  for (const sx of [-1, 1]) {
    if (G.banners !== false) k.banner(sx * TX, Math.min(3.6, G.SPRING - 1), -TD / 2 - 0.08, 2.4, Math.min(6, G.BH - 4.5), 'cloth', { ry: 0 });
    for (const fz of [-1, 1]) {
      const x = sx * (PW + 1.25);
      const z = fz * (D / 2 + 0.75);
      const ly = Math.min(3.85, G.SPRING - 1.2);
      k.slab(x, ly + 0.93, fz * (D / 2 + 0.3), 0.14, 0.14, 0.9, 'metal', { layer: 'metal' });
      const flame = k.lantern(x, ly, z, { post: 0 });
      if (fz < 0 || G.lightInside) {
        const [wx, wz] = f.at(flame.x, flame.z);
        world.addLight?.(new THREE.Vector3(wx, f.y + flame.y, wz), '#ffc98a', 0.9, 12, true, 0.7);
      }
    }
  }
}

// A gatehouse at s.x, s.z turned by s.rot (+z inside). Sizes in metres; walk is the wall-walk
// height above the gate's ground, so the curtain either side meets the gate at its own level.
export function buildGatehouse(world, s, group) {
  const yaw = s.rot || 0;
  const f = siteFrame(world, s.x, s.z, yaw, group.position.y);
  const k = new Kit(gatePalette(s.palette || 'salt'));
  const PW = s.pw ?? 3.2;
  const G = {
    PW, D: s.depth ?? 8, SPRING: s.spring ?? 6.6, BH: s.walk ?? 15.4,
    TX: s.tx ?? 11, TW: s.tw ?? 8, TD: s.td ?? 9.2,
    tag: s.tag || 'harbor_gate', intrados: intradosFor(PW),
    lookout: s.lookout, beacon: s.beacon, winch: s.winch, banners: s.banners, lightInside: s.lightInside,
  };
  // the walk always clears the vault's crown with a full course of masonry
  G.BH = Math.max(G.BH, G.SPRING + G.intrados(0) + 2.6);
  G.TH = Math.max(s.th ?? 0, G.BH + 3.6);
  for (const sx of [-1, 1]) tower(k, f, sx, G);
  gateBlock(k, f, G);
  if (s.portcullis !== false) portcullis(k, G);
  walkAndWinch(k, f, G);
  dressing(k, f, world, G);
  group.add(k.build(s.name || 'gatehouse'));
  return { ...G, x: s.x, z: s.z, yaw, y: f.y, walkY: f.y + G.BH };
}

// The Saltreach sea gate: the type of the gatehouse, on the harbor road.
export const SEA_GATE = { D: 8, PW: 3.2, SPRING: 6.6, TX: 11, TW: 8, TD: 9.2 };
export function buildSeaGate(world, s, group) {
  return buildGatehouse(world, { ...s, ...(s.gate || {}), palette: 'salt', tag: 'harbor_gate', name: 'saltreach_sea_gate',
    pw: SEA_GATE.PW, depth: SEA_GATE.D, spring: s.spring ?? SEA_GATE.SPRING, walk: s.walk ?? 10.5 }, group);
}
