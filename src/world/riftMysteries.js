// What the Rift kept that it should not have: the glyphs and the vault they open, a court that
// will not pick an up, the works that were here before the Rift, the four stones that marked
// them, and the rooms that are only there when the mind is thin.
//   the Glyph Circle   a sunken court under the plateau's cliff: a paved ring, four carved stelae
//                      and, cut into the cliff to the north, the Sealed Vault's door
//   the Folded Court   a walled court whose stair climbs to a landing and goes on from its
//                      underside, an arch stood on its crown, a door hung from its lintel
//   the pre-Rift works pale stone and green bronze older than the dynasty: a stepped podium,
//                      its colonnade, the domed vessel and its conduits, a trilithon gate
//   the monoliths      the same stone, standing at the quarters of the basin
//   the Whisper Gate   a veiled arch and the archive behind it, solid only to a thin mind
import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';
import { mat } from './props.js';
import { mergeStatic } from './merge.js';
import { seededRandom } from '../core/util.js';
import { RIFT_SITES, RIFT_GLYPHS } from '../data/riftResearch.js';
import { G } from '../core/globals.js';
import { act } from '../game/hooks.js';

const _a = new THREE.Color(), _b = new THREE.Color('#2b2535');
const drown = (hex, amt) => '#' + _a.set(hex).lerp(_b, amt).getHexString();
// The dynasty's drowned ashlar, with its rough rock and the inlay of its carvings.
const STONE = { ...PALETTES.rift, stone: '#4a4558', stone2: '#3b3648', edge: '#5f5872', dark: '#141018', rock: '#3a3442', rock2: '#2f2a37', inlay: '#7a7096', metal: '#3f3836', brass: '#6e6040' };
// Older than the dynasty: pale dressed limestone and green bronze, drowned only a little.
const A0 = PALETTES.ancient;
const ANCIENT = {
  ...A0, stone: drown(A0.stone, 0.42), stone2: drown(A0.stone2, 0.46), edge: drown(A0.edge, 0.38), dark: drown(A0.dark, 0.3),
  joint: drown(A0.joint, 0.4), metal: drown(A0.metal, 0.35), bronze: drown('#5f7a62', 0.3), earth: drown(A0.earth, 0.4), inlay: drown('#b8a878', 0.4),
};

function place(world, k, f, name) {
  const g = k.build(name);
  g.position.set(f.x, f.y, f.z);
  g.rotation.y = f.yaw;
  world.scene.add(g);
  return g;
}

// ------------------------------------------------------------------ the Glyph Circle
function buildGlyphs(world, low, state) {
  const C = RIFT_SITES.glyphs;
  const f = siteFrame(world, C.x, C.z, 0);
  const k = new Kit(STONE, { detail: low ? 0 : 1 });
  // the ring: a low paved round, an inlaid circle at the stelae's radius, a carved centre stone
  const lo = f.lowest(18, 18);
  k.prism(0, lo - 0.6, 0, 9.4, 0.72 - lo, 'stone2', { sides: 24 });
  k.prism(0, 0.06, 0, 8.9, 0.06, 'stone', { sides: 24 });
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    k.slab(Math.sin(a) * 6.2, 0.1, Math.cos(a) * 6.2, 0.18, 0.04, 1.26, 'inlay', { ry: a + Math.PI / 2 });
  }
  k.prism(0, 0.1, 0, 1.7, 0.18, 'stone', { sides: 12 });
  for (const ry of [0, Math.PI / 2]) k.slab(0, 0.27, 0, 3.0, 0.02, 0.12, 'inlay', { ry });
  const g = place(world, k, f, 'rift_glyph_circle');
  f.solid(0, 0, 17, 17, -1, 0.12);
  // the stelae: one at each quarter, its carved face toward the middle
  const roots = [g], marks = [];
  for (const gl of RIFT_GLYPHS) {
    const yaw = Math.atan2(C.x - gl.x, C.z - gl.z);
    const sf = siteFrame(world, gl.x, gl.z, yaw);
    const sk = new Kit(STONE, { detail: low ? 0 : 1 });
    sk.slab(0, -0.6, 0, 2.0, 0.9, 1.2, 'stone2');
    sk.prism(0, 0.3, 0, 0.95, 4.6, 'stone', { sides: 4, top: 0.82, ry: Math.PI / 4 });
    sk.slab(0, 4.85, 0, 1.1, 0.3, 0.75, 'edge');
    sk.pyramid(0, 5.15, 0, 0.62, 0.7, 'stone2', { sides: 4, ry: Math.PI / 4 });
    roots.push(place(world, sk, sf, 'rift_glyph_stele'));
    sf.solid(0, 0, 1.6, 1.0, -1, 5.2);
    // each mark its own material: it brightens when its glyph has been traced
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.0, 0.04), new THREE.MeshStandardMaterial({ color: '#6e6688', emissive: '#8a7cb8', emissiveIntensity: 0.45, roughness: 0.8 }));
    const [mx, mz] = sf.at(0, 0.66);
    mark.position.set(mx, sf.y + 2.6, mz);
    mark.rotation.y = yaw;
    mark.userData.dynamic = true;
    world.scene.add(mark);
    marks.push(mark);
    world.addInteract({
      id: `glyph_${gl.id}`, kind: 'rift_glyph',
      pos: new THREE.Vector3(gl.x, sf.y + 1.4, gl.z), radius: 2.6,
      label: `Trace the glyph: ${gl.title}`,
      use: () => act('traceRiftGlyph', gl.id, gl.title),
    });
  }
  state.glyphMarks = marks;
  world.addLight(new THREE.Vector3(C.x, f.y + 2.4, C.z), '#9a90c0', 0.7, 14, false, 0.6);
  return roots;
}

// ------------------------------------------------------------------ the Sealed Vault
// A house of rock against the cliff north of the circle, its front cut into a portal of three
// receding orders. The door is one slab: it rises into the wall when the glyphs are traced.
function buildVault(world, low, state) {
  const S = RIFT_SITES.vault;
  const f = siteFrame(world, S.x, S.z - 1, Math.PI);
  const k = new Kit(STONE, { detail: low ? 0 : 1 });
  const rng = seededRandom(6014);
  const IW = 9, ID = 10.5, T = 1.7, H = 8.6, front = 5.0, back = front - T - ID - T;
  const lo = f.lowest(IW + T * 2 + 4, front - back + 2, 0, (front + back) / 2);
  // the floor, and the shell of rough rock
  k.slab(0, lo - 0.5, (front + back) / 2, IW + T * 2, 0.62 - lo, front - back, 'stone2');
  for (const sx of [-1, 1]) {
    k.masonry(sx * (IW / 2 + T / 2), lo - 0.5, (front + back) / 2, T, H + 0.5 - lo, front - back, { c: 'rock', c2: 'rock2', course: 1.9 });
    // the front's flanks, battered out like a cliff's foot
    k.ramp(sx * (IW / 2 + T + 1.0), lo - 0.5, front - 1.6, 2.0, H * 0.7 - lo, 3.2, 'rock2', { ry: Math.PI });
  }
  k.masonry(0, lo - 0.5, back + T / 2, IW + T * 2, H + 0.5 - lo, T, { c: 'rock', c2: 'rock2', course: 1.9 });
  k.slab(0, H, (front + back) / 2, IW + T * 2 + 0.6, 1.4, front - back + 0.6, 'rock2');
  // the cliff's rock heaped over the roof and down the flanks: the house is in the rock
  for (let i = 0; i < (low ? 6 : 14); i++) {
    const x = (rng() - 0.5) * (IW + 6), z = back + rng() * (front - back - 1);
    k.rock(x, H + 1.2 + rng() * 1.6, z, 3 + rng() * 3, 2 + rng() * 2.2, 3 + rng() * 3, rng() < 0.5 ? 'rock' : 'rock2', { ry: rng() * 3 });
  }
  // the portal: the front wall, three orders stepping in to the door, the lintel and tympanum
  const DW = 3.4, DH = 5.2;
  for (const sx of [-1, 1]) {
    k.masonry(sx * (IW / 2 + T) / 2 + sx * DW / 4, lo - 0.5, front - T / 2, (IW + T * 2) / 2 - DW / 2, H + 0.5 - lo, T, { c: 'rock', c2: 'rock2', course: 1.9 });
    for (let o = 0; o < 3; o++) {
      const x = sx * (DW / 2 + 0.35 + o * 0.6);
      k.slab(x, 0.12, front + 0.15 + o * 0.35, 0.7, DH + 0.6 + o * 0.6, 0.6, o % 2 ? 'stone2' : 'stone');
    }
  }
  k.masonry(0, DH + 0.12, front - T / 2, DW + 0.2, H - DH - 0.12, T, { course: 1.2 });
  for (let o = 0; o < 3; o++) k.slab(0, DH + 0.72 + o * 0.6, front + 0.15 + o * 0.35, DW + 1.6 + o * 1.2, 0.6, 0.6, o % 2 ? 'stone2' : 'stone');
  k.slab(0, DH + 2.6, front + 1.0, DW + 5.4, 0.4, 0.9, 'edge');
  // the tympanum: a carved ring and the four glyph plates under it
  k.prism(0, DH + 3.3, front + 0.05, 1.2, 0.12, 'inlay', { sides: 16, rx: Math.PI / 2 });
  k.prism(0, DH + 3.3, front + 0.1, 0.9, 0.14, 'stone', { sides: 16, rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) k.slab(-1.5 + i, DH + 1.55, front + 0.42, 0.55, 0.7, 0.06, 'inlay');
  k.slab(0, 0, front + 1.4, DW + 2.6, 0.12, 1.6, 'stone');
  // inside: a dais at the back, the name carved round the back wall
  k.slab(0, 0.12, back + T + 1.6, IW - 1, 0.45, 3.0, 'stone');
  k.prism(0, 3.2, back + T + 0.06, 2.0, 0.08, 'inlay', { sides: 20, rx: Math.PI / 2 });
  for (const sx of [-1, 1]) k.slab(sx * (IW / 2 - 0.4), 0.12, (front + back) / 2, 0.8, 0.5, ID - 1, 'stone2');
  const g = place(world, k, f, 'rift_vault');
  // colliders: shell, roof, the portal's piers
  const zc = (front + back) / 2, D = front - back;
  for (const sx of [-1, 1]) f.solid(sx * (IW / 2 + T / 2), zc, T, D, lo - 1, H);
  f.solid(0, back + T / 2, IW + T * 2, T, lo - 1, H);
  f.solid(0, zc, IW + T * 2, D, H, H + 1.4);
  for (const sx of [-1, 1]) f.solid(sx * ((IW + T * 2) / 4 + DW / 4), front - T / 2, (IW + T * 2) / 2 - DW / 2, T, lo - 1, H);
  f.solid(0, front - T / 2, DW + 0.2, T, DH + 0.12, H);
  f.solid(0, zc, IW, D, lo - 1, 0.12);
  // the door: a single slab in the portal, lifted into the wall above when unsealed
  const door = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.5), mat('#262030', { roughness: 0.9 }));
  const [dx, dz] = f.at(0, front - 0.3);
  door.position.set(dx, f.y + 0.12 + DH / 2, dz);
  door.rotation.y = f.yaw;
  door.userData.dynamic = true;
  world.scene.add(door);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, DH - 0.4, 0.04), mat('#6e6688', { emissive: '#8a7cb8', ei: 0.4 }));
  const [sx2, sz2] = f.at(0, front - 0.02);
  seam.position.set(sx2, f.y + 0.12 + DH / 2, sz2);
  seam.rotation.y = f.yaw;
  seam.userData.dynamic = true;
  world.scene.add(seam);
  const block = world.colliders.addBox({ x: dx, z: dz, w: DW, d: 0.6, y0: f.y - 1, y1: f.y + DH, rot: f.yaw });
  state.vault = { group: g, door, seam, block, y: f.y, open: 0, doorY: f.y + 0.12 + DH / 2, lift: DH + 0.2, top: f.y + DH };
  const [ix, iz] = f.at(0, zc - 1);
  world.addLight(new THREE.Vector3(ix, f.y + 4.2, iz), '#9a90c0', 0.8, 12, false, 0.6);
  return [g];
}

// ------------------------------------------------------------------ the Folded Court
function stairBoxes(world, f, x, z, w, n, rise, run, y0) {
  for (let i = 0; i < n; i++) f.solid(x, z + run * (i + 0.5), w, run, y0 - 0.4, y0 + rise * (i + 1));
}
function buildFold(world, low) {
  const S = RIFT_SITES.fold;
  const f = siteFrame(world, S.x, S.z, Math.PI / 2);
  const k = new Kit(STONE, { detail: low ? 0 : 1 });
  const R = 7.5, wallH = 3.6;
  const lo = f.lowest(R * 2 + 2, R * 2 + 2);
  // the court's paving and its walls on three sides, the open side to the path
  k.slab(0, lo - 0.4, 0, R * 2, 0.52 - lo, R * 2, 'stone2');
  k.slab(0, 0.06, 0, R * 2 - 0.4, 0.06, R * 2 - 0.4, 'stone');
  const wall = (ax, az, bx, bz) => {
    k.wall(ax, az, bx, bz, lo - 0.4, wallH + 0.4 - lo, { t: 0.9, crenel: false, buttress: 0 });
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    f.solid((ax + bx) / 2, (az + bz) / 2, 0.9, L, lo - 1, wallH, { rot: ry });
  };
  wall(-R, -R, R, -R);
  wall(-R, -R, -R, 1.6);
  wall(-R, 4.6, -R, R);
  wall(R, -R, R, R - 4);
  // the west wall's doorway, its door hung from the lintel and lying flat in the air
  for (const z of [1.6, 4.6]) k.pier(-R, 0.12, z, 1.0, 3.0, {});
  k.slab(-R, 3.0, 3.1, 1.2, 0.6, 4.0, 'edge');
  k.at({ x: -R + 0.55, y: 2.95, z: 3.1 }, () => k.slab(1.2, -0.12, 0, 2.4, 0.12, 2.6, 'wood'));
  // the stair: up along the south wall to a landing on a pier, and on from the landing's
  // underside, the same flight hanging the wrong way up
  const n = 9, rise = 0.32, run = 0.55, sx = -4.5, sz0 = -R + 1.2;
  k.stair(sx, 0.12, sz0, 2.4, n, { rise, run, base: 0, c: 'stone', c2: 'stone2' });
  stairBoxes(world, f, sx, sz0, 2.4, n, rise, run, f.y + 0.12);
  const ly = 0.12 + rise * n, lz = sz0 + run * n + 1.3;
  k.slab(sx, ly - 0.4, lz, 3.0, 0.4, 2.6, 'edge');
  k.masonry(sx, 0.12, lz, 1.6, ly - 0.52, 1.6, { course: 0.6 });
  f.solid(sx, lz, 3.0, 2.6, ly - 0.4, ly);
  f.solid(sx, lz, 1.6, 1.6, 0, ly - 0.4);
  k.inverted(sx, ly - 0.4, lz + 1.3, () => k.stair(0, 0, 0, 2.4, n, { rise, run, base: 0.4, c: 'stone2', c2: 'stone' }));
  f.solid(sx, lz + 1.3 + (n * run) / 2, 2.6, n * run, 0, ly - 0.4);
  // an arch stood on its crown, its springers in the air carrying nothing
  k.inverted(4.0, 0.12 + 4.2 * 0.742 + 0.7, -2.0, () => k.arch(0, 0, 0, 4.2, { pointed: true, t: 0.7, depth: 1.0, c: 'edge' }), Math.PI / 2);
  f.solid(4.0, -2.0, 1.2, 4.6, 0.12, 4.0);
  // a block through the east wall: square to the wall on one side, turned on the other
  k.block(R - 0.9, 1.4, -1.2, 1.6, 1.6, 1.6, 'stone', { ry: 0.0 });
  k.block(R + 0.9, 1.4, -1.2, 1.6, 1.6, 1.6, 'stone', { ry: 0.55, rz: 0.3 });
  f.solid(R, -1.2, 3.4, 1.8, 0.6, 2.2);
  const g = place(world, k, f, 'rift_folded_court');
  return [g];
}

// ------------------------------------------------------------------ the pre-Rift works
function buildPrerift(world, low) {
  const S = RIFT_SITES.prerift;
  const yaw = Math.atan2(2, -10);
  const f = siteFrame(world, S.x, S.z, yaw);
  const k = new Kit(ANCIENT, { detail: low ? 0 : 1 });
  const rng = seededRandom(5948);
  // the podium behind the forecourt, three steps up, and its colonnade along the front edge
  const PW = 18, PD = 11, pz = -4 - PD / 2, top = 1.5;
  const lo = f.lowest(PW + 2, PD + 2, 0, pz);
  k.slab(0, lo - 0.6, pz, PW, top + 0.6 - lo, PD, 'stone2');
  for (let i = 0; i < 3; i++) k.slab(0, i * 0.5, pz + PD / 2 + 0.55 * (3 - i) - 0.3, PW - 2 - i * 0.4, 0.5, 0.6, i % 2 ? 'stone' : 'stone2');
  k.slab(0, top, pz, PW + 0.3, 0.2, PD + 0.3, 'edge');
  f.solid(0, pz, PW, PD, lo - 1, top + 0.2);
  for (let i = 0; i < 3; i++) f.solid(0, pz + PD / 2 + 0.55 * (3 - i) - 0.3, PW - 2, 0.6, lo - 1, (i + 1) * 0.5);
  const cols = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5], full = 7.2;
  const heights = [full, full, 3.4, 1.2, full * 0.55, 0.6];
  cols.forEach((x, i) => {
    const h = heights[i], z = pz + PD / 2 - 1.0;
    k.slab(x, top + 0.2, z, 1.5, 0.3, 1.5, 'stone2');
    for (let y = top + 0.5; y < top + 0.5 + h - 0.1; y += 1.2) {
      const dh = Math.min(1.2, top + 0.5 + h - y);
      k.prism(x, y, z, 0.62, dh - 0.04, 'stone', { sides: 10 });
      if (dh > 0.6) k.prism(x, y + dh - 0.12, z, 0.66, 0.1, 'bronze', { sides: 10, layer: 'metal' });
    }
    f.solid(x, z, 1.3, 1.3, top, top + 0.5 + h);
    if (h < full * 0.6 && Math.abs(x - 2) > 1.8) {
      // its drums where they fell, toward the forecourt
      for (let j = 0; j < 2; j++) k.prism(x + (rng() - 0.5) * 1.5, -0.1 + 0.62, pz + PD / 2 + 2.5 + j * 1.3, 0.62, 1.1, 'stone', { sides: 10, rz: Math.PI / 2, ry: rng() * 0.6 });
    }
  });
  // the architrave still spanning the first pair
  k.slab((cols[0] + cols[1]) / 2, top + 0.5 + full, pz + PD / 2 - 1.0, 4.6, 0.9, 1.4, 'edge');
  k.slab((cols[0] + cols[1]) / 2, top + 1.4 + full, pz + PD / 2 - 1.0, 4.9, 0.25, 1.6, 'stone2');
  // the works: a domed vessel of green bronze on the podium, its conduits into the stone and
  // out under the ground, a wheel valve on the main
  {
    const vx = 3.5, vz = pz - 1.0;
    k.prism(vx, top + 0.2, vz, 3.0, 2.4, 'bronze', { sides: 14, layer: 'metal' });
    k.roof('dome', vx, top + 2.6, vz, 6.0, 6.0, 2.6, { c: 'bronze', sides: 14 });
    for (let i = 0; i < 3; i++) k.prism(vx, top + 0.6 + i * 0.8, vz, 3.08, 0.12, 'stone2', { sides: 14 });
    f.solid(vx, vz, 5.6, 5.6, top, top + 5.0);
    for (const [ex, ez, len, rot] of [[vx - 3.2, vz + 0.4, 6, 0], [vx + 3.0, vz - 1.0, 9, 0.2]]) {
      k.prism(ex, top + 0.9, ez, 0.36, len, 'bronze', { sides: 8, layer: 'metal', rz: Math.PI / 2, ry: rot });
    }
    k.prism(-4.5, top + 0.9, vz + 0.4, 0.36, 3.2, 'bronze', { sides: 8, layer: 'metal' });
    k.prism(-4.5, top + 1.1, vz + 0.4, 0.75, 0.12, 'bronze', { sides: 12, layer: 'metal', rx: Math.PI / 2 });
    for (const sx of [-1, 1]) k.prism(PW / 2 * sx * 0.98, -0.4, pz - 2, 0.42, 1.0, 'bronze', { sides: 8, layer: 'metal', rz: Math.PI / 2 });
  }
  // the capped shaft beside the works, its bronze lid bolted down
  {
    const wx = -4.0, wz = pz - 2.0;
    k.prism(wx, top + 0.2, wz, 1.5, 0.8, 'stone', { sides: 12 });
    k.prism(wx, top + 1.0, wz, 1.25, 0.14, 'bronze', { sides: 12, layer: 'metal' });
    f.solid(wx, wz, 2.8, 2.8, top, top + 1.1);
  }
  // the trilithon where the way comes in: two uprights and a lintel of the same pale stone
  {
    const tz = 7.5, gy = f.ground(0, tz);
    for (const sx of [-1, 1]) {
      k.slab(sx * 2.6, gy - 0.8, tz, 1.5, 6.6, 1.3, 'stone', { grad: 0.12 });
      f.solid(sx * 2.6, tz, 1.5, 1.3, gy - 0.8, gy + 5.8);
    }
    k.slab(0, gy + 5.8, tz, 7.4, 1.3, 1.5, 'stone2', { grad: 0.12 });
    k.slab(0, gy + 6.0, tz + 0.77, 5.6, 0.3, 0.04, 'inlay');
    f.solid(0, tz, 7.4, 1.5, gy + 5.8, gy + 7.1);
  }
  const g = place(world, k, f, 'rift_prerift_works');
  return [g];
}

// ------------------------------------------------------------------ the monoliths
const MONOLITHS = [[5876, 5932, 15, 0.04], [6178, 5940, 13, -0.05], [5935, 5815, 16, 0.03], [6040, 5850, 14, -0.035]];
function buildMonoliths(world, low) {
  const roots = [];
  for (const [x, z, h, lean] of MONOLITHS) {
    const f = siteFrame(world, x, z, Math.atan2(6000 - x, 5988 - z));
    const k = new Kit(ANCIENT, { detail: low ? 0 : 1 });
    const lo = f.lowest(4, 3);
    k.slab(0, lo - 1.2, 0, 3.6, 1.6 - lo, 2.6, 'stone2', { grad: 0.1 });
    k.at({ rz: lean }, () => {
      k.prism(0, 0.3, 0, 1.6, h, 'stone', { sides: 4, top: 0.72, ry: Math.PI / 4, grad: 0.16 });
      for (const y of [h * 0.38, h * 0.62]) k.slab(0, y, 1.0, 1.7, 0.35, 0.04, 'inlay');
      k.pyramid(0, h + 0.3, 0, 0.82, 1.2, 'stone2', { sides: 4, ry: Math.PI / 4 });
    });
    if (!low) for (let i = 0; i < 4; i++) k.rock((i - 1.5) * 1.6, 0.1, 2.0 + (i % 2), 0.9, 0.5, 0.7, 'stone2', { ry: i });
    roots.push(place(world, k, f, 'rift_monolith'));
    f.solid(0, 0, 2.4, 2.0, lo - 1, h);
  }
  return roots;
}

// ------------------------------------------------------------------ the Whisper Gate and Archive
function buildWhisper(world, low, state) {
  const G1 = RIFT_SITES.whisper, G2 = RIFT_SITES.archive;
  const colliders = [];
  const solid = (f, x, z, w, d, y0, y1, rot = 0) => { const c = f.solid(x, z, w, d, y0, y1, { rot }); c.top = c.y1; colliders.push(c); };
  // the gate: a slender arch, its veil moving when nothing moves the air
  const gf = siteFrame(world, G1.x, G1.z, Math.atan2(G2.x - G1.x, G2.z - G1.z));
  const gk = new Kit(STONE, { detail: low ? 0 : 1 });
  for (const sx of [-1, 1]) {
    gk.slab(sx * 2.0, -0.6, 0, 1.0, 1.0, 1.2, 'stone2');
    gk.prism(sx * 2.0, 0.4, 0, 0.42, 4.2, 'edge', { sides: 8, top: 0.9 });
    solid(gf, sx * 2.0, 0, 0.9, 0.9, -1, 4.6);
  }
  gk.arch(0, 4.6, 0, 4.0, { pointed: true, t: 0.5, depth: 0.7, c: 'edge' });
  const gate = place(world, gk, gf, 'rift_whisper_gate');
  const veil = mat('#c8bede', { emissive: '#8a7cb8', ei: 0.45, transparent: true, opacity: 0.16, double: true, depthWrite: false });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6), veil);
  cloth.position.set(gf.x, gf.y + 3.2, gf.z);
  cloth.rotation.y = gf.yaw;
  cloth.userData.dynamic = true;
  world.scene.add(cloth);
  // the archive: a small walled room with a door toward the gate, shelves of tablets inside
  const af = siteFrame(world, G2.x, G2.z, Math.atan2(G1.x - G2.x, G1.z - G2.z));
  const ak = new Kit(STONE, { detail: low ? 0 : 1 });
  const W = 8.0, D = 8.0, H = 3.4, T = 0.7;
  const lo = Math.max(-3, af.lowest(W, D));
  ak.slab(0, lo - 0.5, 0, W, 0.62 - lo, D, 'stone2');
  ak.masonry(0, 0.12, -D / 2 + T / 2, W, H, T, { course: 0.8 });
  for (const sx of [-1, 1]) ak.masonry(sx * (W / 2 - T / 2), 0.12, 0, T, H, D, { course: 0.8 });
  for (const sx of [-1, 1]) ak.masonry(sx * (W / 4 + 0.7), 0.12, D / 2 - T / 2, W / 2 - 1.4, H, T, { course: 0.8 });
  ak.slab(0, H - 0.6, D / 2 - T / 2, 2.8, 0.6, T, 'edge');
  ak.slab(0, H + 0.12, 0, W + 0.5, 0.4, D + 0.5, 'stone2');
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    ak.slab(sx * (W / 2 - T - 0.3), 0.6 + i * 0.85, -0.6, 0.5, 0.06, 4.0, 'stone');
    for (let j = 0; j < 5; j++) ak.slab(sx * (W / 2 - T - 0.3), 0.66 + i * 0.85, -2.2 + j * 0.8, 0.3, 0.42, 0.08, 'inlay', { rz: 0.06 * sx });
  }
  const room = place(world, ak, af, 'rift_whisper_archive');
  solid(af, 0, -D / 2 + T / 2, W, T, -1, H + 0.5);
  for (const sx of [-1, 1]) solid(af, sx * (W / 2 - T / 2), 0, T, D, -1, H + 0.5);
  for (const sx of [-1, 1]) solid(af, sx * (W / 4 + 0.7), D / 2 - T / 2, W / 2 - 1.4, T, -1, H + 0.5);
  solid(af, 0, 0, W, D, H + 0.1, H + 0.5);
  const lp = new THREE.Vector3(G2.x, af.y + 2.2, G2.z);
  world.addLight(lp, '#9a90c0', 0.8, 10, true, 0.6);
  // until the mind thins, none of it is there: not seen, and not in the way
  for (const c of colliders) c.y1 = c.y0;
  state.whisper = { gate, room, cloth, colliders, visible: false };
  gate.visible = room.visible = cloth.visible = false;
  return [gate, room];
}

export function buildRiftMysteries(world, exclusions, state) {
  const low = !!state.low;
  const roots = [];
  roots.push(...buildGlyphs(world, low, state));
  roots.push(...buildVault(world, low, state));
  roots.push(...buildFold(world, low));
  roots.push(...buildPrerift(world, low));
  roots.push(...buildMonoliths(world, low));
  const whisper = buildWhisper(world, low, state);
  for (const [p, r] of [
    [RIFT_SITES.glyphs, 14], [RIFT_SITES.vault, 12], [RIFT_SITES.fold, 12],
    [RIFT_SITES.prerift, 16], [RIFT_SITES.whisper, 6], [RIFT_SITES.archive, 7],
  ]) exclusions.push({ x: p.x, z: p.z, r });
  for (const [x, z] of MONOLITHS) exclusions.push({ x, z, r: 4 });
  // the whisper's pieces stay out of the merge so they can vanish with the mind
  mergeStatic(world.scene, roots);
  state.mysteryRoots = whisper;
}

export function updateRiftMysteries(state, dt) {
  const ch = G.game && G.game.ch;
  const p = G.player;
  const v = state.vault;
  if (v) {
    const want = ch && ch.flags && ch.flags.rift_vault_unsealed ? 1 : 0;
    v.open += (want - v.open) * Math.min(1, dt * 1.5);
    v.door.position.y = v.doorY + v.open * v.lift;
    v.seam.visible = v.open < 0.05;
    if (v.block) v.block.y1 = v.open > 0.55 ? v.block.y0 : v.top;
  }
  if (state.glyphMarks) {
    const t = (G.world && G.world.time) || 0;
    for (let i = 0; i < state.glyphMarks.length; i++) {
      const m = state.glyphMarks[i];
      const lit = !!(ch && ch.flags && (ch.flags.rift_glyph || [])[i]);
      m.scale.y = 1 + Math.sin(t * 0.8 + i) * 0.02 + (lit ? 0.12 : 0);
      m.material.emissiveIntensity = lit ? 0.9 : 0.45;
    }
  }
  const w = state.whisper;
  if (w && p && ch) {
    const max = Math.max(1, p.maxSanity || 100);
    const thin = ch.sanity / max < 0.35;
    if (thin !== w.visible) {
      w.visible = thin;
      w.gate.visible = w.room.visible = w.cloth.visible = thin;
      for (const c of w.colliders) c.y1 = thin ? c.top : c.y0;
    }
    if (thin) w.cloth.rotation.y = w.gate.rotation.y + Math.sin((G.world?.time || 0) * 1.4) * 0.15;
  }
}
