// Walkable Rift architecture: ruins of what fell, warped surface landmarks,
// and the two return-gates framed as wounds in the world.
//
// Everything is kit-built. Rift masonry uses the drowned palette; relics that fell from the
// surface keep their own architecture (Saltreach plaster, timber and slate; Gull's banded
// lamp) with their values pulled toward the Rift, so they read as fallen rather than foreign.
import * as THREE from 'three';
import { mat } from './props.js';
import { mergeStatic } from './merge.js';
import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';
import { seededRandom } from '../core/util.js';
import { RIFT_LANDMARKS } from '../data/rift.js';

const RIFT = PALETTES.rift;
const _a = new THREE.Color();
const _b = new THREE.Color(RIFT.dark);
function drown(hex, amt) {
  _a.set(hex).lerp(_b, amt);
  return '#' + _a.getHexString();
}
const SALT = PALETTES.salt;
// Saltreach as it looks after falling through the sea.
const SUNK = {
  ...RIFT,
  plaster: drown(SALT.plaster, 0.38),
  plaster2: drown(SALT.plaster2, 0.42),
  timber: drown(SALT.timber, 0.1),
  roof: drown(SALT.roof, 0.18),
  ridge: drown(SALT.ridge, 0.1),
  stone: drown(SALT.stone2, 0.35),
  stone2: drown(SALT.stone2, 0.5),
  edge: drown(SALT.stone, 0.3),
  cloth: drown(SALT.cloth, 0.3),
};

const frame = siteFrame;

function place(world, k, f, name) {
  const g = k.build(name);
  g.position.set(f.x, f.y, f.z);
  g.rotation.y = f.yaw;
  world.scene.add(g);
  return g;
}

// ---------------------------------------------------------------- the drowned keep
// The great gateway (architecture.js) faces north; this is the courtyard behind it. The
// south curtain came down when the keep sank, which is why the yard is open on that side.
function buildKeep(world, low, rng) {
  const f = frame(world, 5950, 6075, 0);
  const k = new Kit('rift', { detail: low ? 0 : 1 });
  const H = 7.2, T = 2.0;
  for (const sx of [-1, 1]) {
    const x = sx * 13.5;
    k.footing(x, -5, T + 0.6, 20, 0, f.lowest(T + 0.6, 20, x, -5), 'stone2', { cap: 'stone2' });
    k.wall(x, 4, x, -14, 0, H, { t: T, crenel: true, buttress: 6, windows: true, windowY: 3.4, lit: sx < 0, pointed: true });
    f.solid(x, -5, T, 18, -1, H);
  }
  // South curtain: courses tumbled out of it, leaving a stepped broken profile.
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const x = -13.5 + (27 / segs) * (i + 0.5);
    const edge = Math.min(i, segs - 1 - i) / (segs / 2);
    const h = Math.max(0.6, H * (0.2 + (1 - edge) * 0.55 + rng() * 0.25));
    if (i === 4 || i === 5) continue;
    k.masonry(x, 0, -14, 27 / segs + 0.02, h, T, { course: 1.1 });
    f.solid(x, -14, 27 / segs, T, -1, h);
  }
  k.rubble(-1, 0, -16.5, 3.4, low ? 5 : 12, rng);
  k.rubble(6, 0, -15.8, 2.4, low ? 3 : 8, rng);
  // The yard tower fell inward: its stump stands, its courses lie where they landed.
  k.tower(-9.5, 0, -10, 4.2, 6.5, { setbacks: [], windows: false });
  for (let i = 0; i < 5; i++) {
    k.slab(-7.4 + i * 2.1, 0, -7.6 + i * 1.8, 4.0 - i * 0.2, 1.9, 1.6, i % 2 ? 'stone2' : 'stone', { ry: 0.85 + (rng() - 0.5) * 0.3, rz: (rng() - 0.5) * 0.2 });
  }
  f.solid(-9.5, -10, 4.2, 4.2, -1, 6.5);
  // Banners of the drowned order on the inner walls.
  for (const sx of [-1, 1]) k.banner(sx * 12.45, 3.2, -2, 1.6, 3.2, 'cloth', { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
  const flame = k.lantern(9.5, 0, -6, { post: 2.6, metal: 'metal' });
  const g = place(world, k, f, 'drowned_keep_yard');
  world.addLight(flame.add(new THREE.Vector3(f.x, f.y, f.z)), '#ffc979', 1.4, 16, true, 1.1);
  return g;
}

// ---------------------------------------------------------------- Gull's light
function buildLighthouse(world, low, rng) {
  const L = RIFT_LANDMARKS.lighthouse;
  const f = frame(world, L.x, L.z, 0.6);
  const k = new Kit(SUNK, { detail: low ? 0 : 1 });
  // The piece of cliff that came down with it.
  const lo = f.lowest(9, 9);
  k.prism(0, lo - 1, 0, 4.6, 1.5 - lo, 'stone2', { sides: 7, top: 0.92 });
  for (let i = 0; i < (low ? 4 : 8); i++) {
    const a = (i / 8) * Math.PI * 2 + rng() * 0.4;
    k.rock(Math.cos(a) * 4.4, 0.3, Math.sin(a) * 4.4, 2.6, 1.4, 2.0, i % 2 ? 'stone2' : 'earth', { ry: a });
  }
  // Built plumb on the cliff, leaning now because the cliff is.
  k.warp({ lean: [2.0, 1.1], from: 1.5, to: 22, ease: 1.4 }, () => {
    for (let i = 0; i < 6; i++) {
      const r = 2.5 - i * 0.16;
      k.prism(0, 1.5 + i * 2.6, 0, r, 2.6, i % 2 ? 'cloth' : 'edge', { sides: 8, top: (r - 0.16) / r });
    }
    if (!low) for (const y of [5, 10.2]) k.window(0, y, 2.3, 0.6, 1.2, { lit: true, ry: 0 });
    k.prism(0, 17.1, 0, 2.3, 0.35, 'stone', { sides: 8 });
    if (!low) for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.slab(Math.cos(a) * 2.05, 17.45, Math.sin(a) * 2.05, 0.12, 0.8, 0.12, 'metal', { layer: 'metal' });
    }
    k.prism(0, 17.45, 0, 1.25, 2.0, 'glow', { sides: 8, layer: 'glow', strength: 1.5 });
    k.roof('cone', 0, 19.45, 0, 2.9, 2.9, 1.8, { c: 'roof', overhang: 0.1 });
    k.prism(0, 21.2, 0, 0.1, 0.8, 'metal', { sides: 4, layer: 'metal' });
  });
  const g = place(world, k, f, 'rift_lighthouse');
  world.colliders.addCyl({ x: L.x, z: L.z, r: 2.6, y0: f.y - 2, y1: f.y + 16, climbable: true });
  world.colliders.addCyl({ x: L.x, z: L.z, r: 4.6, y0: f.y - 2, y1: f.y + 0.5 });
  world.addLight(new THREE.Vector3(L.x + 1.6, f.y + 18, L.z + 0.9), '#ffc58a', 3.0, 40, true, 2);
  return g;
}

// ---------------------------------------------------------------- sunken Saltreach
// "A street. A well. The inn's east wall and three roofs."
function saltHouse(k, w, d, o = {}) {
  const g = 2.6, u = 2.4;
  k.masonry(0, 0, 0, w, g, d, { c: 'stone', c2: 'stone2', course: 0.9 });
  k.slab(0, g, 0, w - 0.2, u, d - 0.2, 'plaster');
  k.slab(0, g - 0.1, 0, w + 0.1, 0.24, d + 0.1, 'timber');
  for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.slab(qx * (w / 2 - 0.12), g, qz * (d / 2 - 0.12), 0.26, u, 0.26, 'timber');
  k.slab(0, g + u - 0.1, 0, w + 0.06, 0.2, d + 0.06, 'timber');
  for (const sx of [-1.4, 1.4]) k.window(sx, g + 0.6, d / 2 - 0.08, 0.8, 1.1, { lit: o.lit && sx < 0 });
  k.slab(0, 0, d / 2 - 0.02, 1.1, 2.0, 0.12, 'timber');
  k.roof('gable', 0, g + u, 0, w, d, 2.4, { c: 'roof', ridge: 'ridge', overhang: 0.45, ry: Math.PI / 2 });
  k.slab(w / 2 - 1.1, g + u + 0.6, 0.6, 0.7, 2.6, 0.7, 'stone2');
}

function buildSunkenSaltreach(world, low, rng) {
  const L = RIFT_LANDMARKS.saltreach;
  const f = frame(world, L.x, L.z, 0);
  const k = new Kit(SUNK, { detail: low ? 0 : 1 });
  const homes = [
    { x: -6, z: 2, rot: 0.5, tilt: 0.16, lit: true },
    { x: 5, z: -3, rot: -0.8, tilt: -0.12 },
    { x: 1, z: 8, rot: 2.2, tilt: 0.09, lit: true },
  ];
  for (const h of homes) {
    // Each roof landed where its house sank: ground floor gone into the floor, eaves at 3.4.
    k.at({ x: h.x, y: -1.6, z: h.z, ry: h.rot, rz: h.tilt }, () => saltHouse(k, 6.4, 5.2, h));
    f.solid(h.x, h.z, 6.4, 5.2, -1, 3.4, { rot: h.rot });
  }
  // The street they stood on, still laid in its courses between them.
  if (!low) {
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const x = -11 + t * 21, z = -7 + t * 7 + Math.sin(t * 3) * 1.5;
      for (const off of [-1, 0, 1]) {
        const px = x + off * 0.9, pz = z - off * 0.5;
        const hy = world.terrain.heightAt(L.x + px, L.z + pz) - f.y;
        k.slab(px, hy - 0.04, pz, 1.1, 0.14, 0.8, (i + off) % 2 ? 'edge' : 'stone', { ry: 0.32, rz: (rng() - 0.5) * 0.08 });
      }
    }
  }
  // The well, its water still the colour of the sky it came from.
  k.prism(-1, 0, -6, 1.4, 0.95, 'stone', { sides: 10 });
  k.prism(-1, 0.84, -6, 1.05, 0.06, '#a98cff', { sides: 10, layer: 'glow', strength: 1.1 });
  for (const sx of [-1, 1]) k.slab(-1 + sx * 1.1, 0.9, -6, 0.22, 2.0, 0.22, 'timber');
  k.slab(-1, 2.9, -6, 2.6, 0.2, 0.3, 'timber');
  k.roof('gable', -1, 3.1, -6, 1.6, 2.8, 0.9, { c: 'roof', overhang: 0.1, ry: Math.PI / 2 });
  f.solid(-1, -6, 2.6, 2.6, -1, 0.95);
  // The inn's east wall: one gable end standing alone, its window still lit.
  k.at({ x: 9, z: 3, ry: 0.4 }, () => {
    k.masonry(0, -0.5, 0, 0.7, 3.1, 6.2, { c: 'stone', c2: 'stone2', course: 0.9 });
    k.slab(0, 2.6, 0, 0.5, 2.6, 6.0, 'plaster');
    k.wedge(0, 5.2, 0, 0.5, 2.2, 6.0, 'plaster', { ry: Math.PI / 2, rz: 0 });
    for (const z of [-2.9, 2.9]) k.slab(0, 2.6, z, 0.6, 2.6, 0.26, 'timber');
    k.window(0.3, 3.2, 0, 0.9, 1.3, { ry: Math.PI / 2, lit: true });
    k.rubble(1.6, 0, 0, 2.2, low ? 3 : 7, rng, { c: 'stone', c2: 'plaster' });
  });
  f.solid(9, 3, 0.7, 6.2, -1, 5.2, { rot: 0.4 });
  const g = place(world, k, f, 'sunken_saltreach');
  world.addLight(new THREE.Vector3(L.x - 1, f.y + 1.4, L.z - 6), '#a274ff', 1.3, 14, true, 0.9);
  return g;
}

// ---------------------------------------------------------------- the shattered vow
function buildVow(world, low, rng) {
  const L = RIFT_LANDMARKS.vow;
  const f = frame(world, L.x, L.z, 0.3);
  const k = new Kit('rift', { detail: low ? 0 : 1 });
  const lo = f.lowest(10, 10);
  k.prism(0, lo - 1, 0, 4.9, 1.35 - lo, 'edge', { sides: 8 });
  k.prism(0, 0.35, 0, 3.7, 0.35, 'edge', { sides: 8 });
  k.slab(0, 0.7, 0, 3.2, 1.5, 3.2, 'stone');
  k.slab(0, 2.2, 0, 2.4, 0.2, 2.4, 'metal', { layer: 'metal' });
  // The ring of columns that held the canopy; drums lie outward from where they stood.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 4.2, z = Math.sin(a) * 4.2;
    const h = 1.2 + ((i * 5) % 7) * 0.45;
    k.column(x, 0.35, z, h, 0.36, { capital: false, sides: 8, c: 'edge' });
    if (i % 2 === 0 && !low) {
      for (let j = 0; j < 2; j++) {
        const d = 5.6 + j * 1.0;
        k.prism(Math.cos(a + 0.12 * j) * d, 0.1, Math.sin(a + 0.12 * j) * d, 0.36, 0.7, 'edge', { sides: 8, rz: Math.PI / 2, ry: a + rng() * 0.3 });
      }
    }
  }
  const g = place(world, k, f, 'shattered_vow');
  f.solid(0, 0, 9.2, 9.2, -1, 0.35);
  f.solid(0, 0, 6.8, 6.8, -1, 0.7);
  f.solid(0, 0, 3.2, 3.2, -1, 2.2);
  // A shard of the Vowkeeper's white hanging above, turning.
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat('#e8e4dc', { emissive: '#c8b070', ei: 0.35 }));
  shard.scale.set(0.5, 1.6, 0.9);
  shard.position.set(0, 7.4, 0);
  shard.userData.dynamic = true;
  g.add(shard);
  world.addLight(new THREE.Vector3(L.x, f.y + 3, L.z), '#ffe9a3', 1.6, 16, false, 1.2);
  return { group: g, shard };
}

// ---------------------------------------------------------------- the driftwood dock
function buildDock(world, low, rng) {
  const L = RIFT_LANDMARKS.dock;
  const f = frame(world, L.x, L.z, Math.PI);
  const k = new Kit('rift', { detail: low ? 0 : 1 });
  const wood = 'wood', wood2 = 'wood2';
  for (let i = 0; i < 8; i++) {
    const z = -i * 2.1;
    for (let p = 0; p < 5; p++) k.slab(-1.36 + p * 0.68, 0.04, z, 0.62, 0.22, 2.0, (i + p) % 2 ? wood : wood2, { ry: (rng() - 0.5) * 0.03 });
    k.slab(0, -0.18, z, 3.6, 0.22, 0.3, 'timber');
    if (i % 2 === 0) {
      for (const sx of [-1.6, 1.6]) {
        const hy = world.terrain.heightAt(...f.at(sx, z)) - f.y;
        k.prism(sx, Math.min(-1.5, hy - 1), z, 0.16, 2.6 - Math.min(-1.5, hy - 1), wood2, { sides: 6 });
      }
    }
  }
  // The last bays tilt into the void.
  k.at({ x: 0, y: -0.2, z: -17.4, rx: 0.42 }, () => {
    for (let p = 0; p < 4; p++) k.slab(-1.0 + p * 0.68, 0, 0, 0.62, 0.22, 3.2, p % 2 ? wood : wood2, { rz: (p - 1.5) * 0.04 });
  });
  const flame = k.lantern(1.4, 0.26, -4, { post: 2.4, metal: 'metal' });
  if (!low) for (let i = 0; i < 4; i++) k.slab(-1.6, 0.26, -2 - i * 3.6, 0.12, 1.0, 0.12, 'timber');
  const g = place(world, k, f, 'driftwood_dock');
  f.solid(0, -7.35, 3.4, 16.8, -1, 0.26);
  world.addLight(flame.add(new THREE.Vector3(0, 0, 0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw).add(new THREE.Vector3(f.x, f.y, f.z)), '#ffc979', 1.1, 12, true, 0.8);
  return g;
}

// ---------------------------------------------------------------- the crystal veins
// Where the lattice broke through the city's floor: a cracked basin in a kerbed court, and out
// of it a stand of spires tall enough to show over the ward's roofs from the stair.
function buildGrove(world, low, rng) {
  const L = RIFT_LANDMARKS.crystals;
  const f = frame(world, L.x, L.z, Math.atan2(6065 - L.x, 6040 - L.z));
  const k = new Kit('rift', { detail: low ? 0 : 1 });
  const lo = f.lowest(15, 15);
  // the court's paving and its kerb, broken where the basin heaved it up
  k.prism(0, lo - 0.4, 0, 7.4, 0.5 - lo, 'stone2', { sides: 16 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (i % 5 === 2) continue;
    k.slab(Math.sin(a) * 7.2, 0.1, Math.cos(a) * 7.2, 0.5, 0.35, 2.7, 'edge', { ry: a + Math.PI / 2 });
  }
  // the basin: heaved slabs and rock round a dark floor split by the veins
  const n = low ? 8 : 13;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 4.2 + (rng() - 0.5) * 0.6;
    k.rock(Math.cos(a) * r, 0.3, Math.sin(a) * r, 2.0 + rng(), 1.1 + rng() * 0.6, 1.6 + rng() * 0.6, i % 3 ? 'stone2' : 'stone', { ry: a });
  }
  k.prism(0, 0.06, 0, 3.8, 0.1, 'dark', { sides: 12 });
  for (let i = 0; i < 6; i++) k.slab(0, 0.17, 0, 0.12, 0.02, 3.2 + rng() * 2, 'crystal', { ry: i * 0.52 + rng() * 0.3, layer: 'crystal' });
  // the spires: a stand of five tall ones out of the middle, the lesser round them
  const tall = [[0.3, 0.2, 12.5], [-1.4, 1.0, 10.2], [1.6, -0.9, 9.0], [-0.6, -1.8, 7.8], [1.2, 1.9, 7.0]];
  for (const [x, z, h] of tall) {
    const lean = Math.atan2(x, z);
    k.crystal(x, 0.1, z, 0.55 + h * 0.035, h, 'crystal', { rx: Math.cos(lean) * 0.12, rz: -Math.sin(lean) * 0.12 });
  }
  for (let i = 0; i < (low ? 6 : 12); i++) {
    const a = (i / 12) * Math.PI * 2 + rng() * 0.4, r = 2.4 + rng() * 1.4;
    k.crystal(Math.cos(a) * r, 0.2, Math.sin(a) * r, 0.25 + rng() * 0.2, 1.8 + rng() * 3.2, 'crystal', { rz: -Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35 });
  }
  const g = place(world, k, f, 'crystal_veins');
  f.solid(0, 0, 10, 10, -1, 0.5);
  f.pillar(0, 0, 2.4, 0, 12);
  // the stair down into the court from the Processional Terrace, which passes along its head
  {
    const T = world.terrain, x = L.x, z0 = L.z + 4.6;
    const yb = T.heightAt(x, z0 - 1), yt = T.heightAt(x, L.z + 15);
    const n = Math.max(2, Math.round((yt - yb) / 0.32)), rise = (yt - yb) / n, run = 0.5;
    const sf = frame(world, x, z0, 0, yb);
    const sk = new Kit('rift', { detail: low ? 0 : 1 });
    sk.stair(0, 0, 0, 3.0, n, { rise, run, base: -0.6, c: 'stone', c2: 'stone2' });
    for (let i = 0; i < n; i++) sf.solid(0, run * (i + 0.5), 3.0, run, -0.6, rise * (i + 1));
    const sg = place(world, sk, sf, 'crystal_veins_stair');
    g.updateMatrixWorld(true);
    sg.updateMatrixWorld(true);
    g.attach(sg);
  }
  world.addLight(new THREE.Vector3(L.x, f.y + 5, L.z), '#a48cff', 1.8, 22, true, 1.3);
  world.addEmitter({ kind: 'riftmote', pos: new THREE.Vector3(L.x, f.y + 3, L.z), rate: 4, spread: 3 });
  return g;
}

export function buildRiftLandmarks(world, exclusions, state) {
  const low = state.low;
  const rng = seededRandom(7766);

  const L = RIFT_LANDMARKS;
  const roots = [];
  const animated = [];

  // The two sealed pale gates stood here, each drawing from the seeded stream for its broken
  // walls (7 courses a side) and rubble (9 draws a stone, 14 stones a side, 5 in low quality).
  // They are gone; drawing what they drew keeps every landmark after them as it was.
  for (let i = 0, n = 2 * 2 * (7 + 9 * (low ? 5 : 14)); i < n; i++) rng();

  roots.push(buildKeep(world, low, rng));
  roots.push(buildLighthouse(world, low, rng));
  roots.push(buildSunkenSaltreach(world, low, rng));
  const vow = buildVow(world, low, rng);
  roots.push(vow.group);
  animated.push(vow);
  roots.push(buildDock(world, low, rng));
  const grove = buildGrove(world, low, rng);
  roots.push(grove);
  state.grove = grove;

  for (const p of [
    [L.keep, 18], [L.lighthouse, 10], [L.saltreach, 16], [L.vow, 10],
    [L.dock, 10], [L.crystals, 12],
  ]) {
    exclusions.push({ x: p[0].x, z: p[0].z, r: p[1] });
  }

  mergeStatic(world.scene, roots);
  state.landmarkAnim = animated;
}
