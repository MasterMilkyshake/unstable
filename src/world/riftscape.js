// The Rift, dressed to match its lore: "the world beneath the world". The underside of the isles
// hangs overhead (see riftCeiling.js), drowned ships rest on the floor, the Hollow Duke's great
// chain (the command line to the Keep) rises from his throne into the rock, and the Ferryman's
// boat lies beached below his landing on the north-east lip.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit } from './kit.js';
import { PALETTES } from './style.js';
import { mergeStatic } from './merge.js';
import { FERRYMAN } from '../data/rift.js';
import { ceilingYAt } from './riftCeiling.js';

export const RIFT_SCAPE = { x: 6000, z: 6000, ceil: 150, throne: { x: 6000, z: 6178 } };

function chain(points, linkLen, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const total = curve.getLength();
  const n = Math.max(2, Math.floor(total / linkLen));
  const geo = new THREE.TorusGeometry(radius, radius * 0.22, 6, 12);
  geo.scale(1, 1.55, 1);
  const im = new THREE.InstancedMesh(geo, material, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const twist = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    q.setFromUnitVectors(up, tan);
    twist.setFromAxisAngle(up, i % 2 ? Math.PI / 2 : 0);
    q.multiply(twist);
    m.compose(p, q, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m);
  }
  im.castShadow = true;
  im.computeBoundingSphere();
  return im;
}

// Underwater half of the prow: a wedge from the gunwale tip down to the keel.
const BILGE_BOW = (() => {
  const A = [-0.5, 0.5, -0.5], B = [0.5, 0.5, -0.5], C = [0, 0.5, 0.5], D = [0, -0.5, -0.5];
  return new Float32Array([...B, ...C, ...D, ...A, ...D, ...C, ...A, ...C, ...B, ...A, ...B, ...D]);
})();

// A carvel hull along +z (bow): a V bilge under straight topsides, a ridged prow with its
// stem standing proud, stern deck, bulwarks and wales. Waterline at y = 0.
function ship(k, o = {}) {
  const L = o.L ?? 14, W = o.W ?? 4.2, H = o.H ?? 2.6;
  const mid = L * 0.7, zc = -L / 2 + mid / 2, front = -L / 2 + mid, bow = L - mid;
  const top = H * 0.55, keel = H * 0.45;
  k.slab(0, 0, zc, W, top, mid, 'wood2');
  k.wedge(0, -keel, zc, W, keel, mid, 'timber', { rz: Math.PI });
  k.at({ y: top / 2, z: front, rx: Math.PI / 2 }, () => k.wedge(0, 0, 0, W, bow, top, 'wood2', { grad: 0.04 }));
  k.emit(BILGE_BOW, k.local(0, -keel / 2, front + bow / 2, W, keel, bow), 'timber');
  k.slab(0, -keel * 0.4, front + bow - 0.25, 0.3, top + keel * 0.4 + (o.stem ?? 1.0), 0.4, 'timber', { rx: 0.3 });
  for (const sx of [-1, 1]) {
    k.slab(sx * (W / 2 + 0.03), top * 0.45, zc, 0.12, 0.24, mid, 'timber');
    k.slab(sx * (W / 2 - 0.09), top, -L / 2 + (3.6 + mid) / 2, 0.18, 0.5, mid - 3.6, 'wood2');
    k.slab(sx * (W / 2 - 0.09), top + 0.5, -L / 2 + (3.6 + mid) / 2, 0.26, 0.08, mid - 3.6, 'timber');
  }
  k.slab(0, top, zc, W - 0.36, 0.05, mid, 'wood');
  if (o.castle !== false) {
    k.slab(0, top, -L / 2 + 1.8, W - 0.1, 1.3, 3.6, 'wood2');
    k.slab(0, top + 1.3, -L / 2 + 1.8, W + 0.1, 0.14, 3.8, 'timber');
    for (const sx of [-0.9, 0.9]) k.slab(sx, top + 0.45, -L / 2 - 0.02, 0.5, 0.6, 0.06, 'dark');
    k.slab(0, -keel * 0.8, -L / 2 - 0.15, 0.2, top + keel * 0.6, 1.0, 'timber');
  }
  if (o.broken) {
    // The starboard flank stove in: planking gone, ribs left standing.
    k.slab(W / 2 + 0.02, -keel * 0.3, zc + 1, 0.06, top + keel * 0.3 - 0.1, 4.2, 'dark');
    for (let i = 0; i < 5; i++) k.slab(W / 2 + 0.1, -keel * 0.4, zc - 0.7 + i * 0.85, 0.16, top + keel * 0.4 + 0.35, 0.2, 'wood');
  }
  if (o.mast !== false) {
    k.at({ y: top, z: zc + 1.4, rz: o.mastLean ?? 0.14 }, () => {
      k.prism(0, 0, 0, 0.2, 7.6, 'timber', { sides: 6, top: 0.75 });
      k.slab(0, 6.0, 0, 5.0, 0.16, 0.16, 'timber');
      k.slab(-0.9, 3.5, 0.12, 2.6, 2.5, 0.05, 'cloth');
      k.slab(1.4, 4.5, 0.12, 1.2, 1.5, 0.05, 'cloth');
    });
    if (o.castle !== false) k.prism(0, top + 1.44, -L / 2 + 1.8, 0.15, 2.0, 'timber', { sides: 6, top: 0.6 });
  }
}

// Where the resting hulls lie, and why.
const WRECKS = [
  // On the Driftwood Shore: the dock beside it is built from her timbers.
  { x: 6044, z: 5873, yaw: 2.5, heel: 0.36, s: 1.25, broken: true },
  // A Saltreach fishing hull that went down with its harbour.
  { x: 5935, z: 5910, yaw: -0.7, heel: -0.42, s: 1.0, castle: false },
  // Run aground against the drowned keep's west wall.
  { x: 5922, z: 6104, yaw: 1.25, heel: 0.5, s: 1.45, broken: true, mastLean: 0.5 },
];

export function buildRiftscape(world, exclusions = []) {
  const { scene, terrain } = world;
  const R = RIFT_SCAPE;

  // =============================================================== THE RIFT
  const lowQ = !!(G.settings && G.settings.quality === 'low');
  // the Duke's chain: from behind the throne up into the rock overhead
  const iron = new THREE.MeshStandardMaterial({ color: '#2e2a30', roughness: 0.6, metalness: 0.55, emissive: '#1c1824', emissiveIntensity: 0.25, flatShading: true });
  const tb = terrain.heightAt(R.throne.x, R.throne.z + 9);
  const greatChain = chain(
    [new THREE.Vector3(R.throne.x, tb - 1, R.throne.z + 9), new THREE.Vector3(R.throne.x + 3, tb + 30, R.throne.z + 16), new THREE.Vector3(R.throne.x + 9, ceilingYAt(world, R.throne.x + 9, R.throne.z + 26) - 16, R.throne.z + 26), new THREE.Vector3(R.throne.x + 15, ceilingYAt(world, R.throne.x + 15, R.throne.z + 34) + 8, R.throne.z + 34)],
    4.2, 1.9, iron,
  );
  scene.add(greatChain);
  // an iron anchor-collar where the chain meets the ground
  const collar = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.9, 8, 16), iron);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(R.throne.x, tb + 0.4, R.throne.z + 9);
  scene.add(collar);
  world.colliders.addCyl({ x: R.throne.x, z: R.throne.z + 9, r: 2.6, y0: tb - 2, y1: tb + 6 });
  // drowned ships resting where they came down
  const detail = lowQ ? 0 : 1;
  const resting = new Kit('rift', { detail });
  const L = 14, W = 4.2, H = 2.6;
  for (const w of WRECKS) {
    const c = Math.cos(w.yaw), sn = Math.sin(w.yaw), half = (L * w.s) / 2 * 0.8;
    const h = terrain.heightAt(w.x, w.z);
    const hb = terrain.heightAt(w.x + sn * half, w.z + c * half);
    const hs = terrain.heightAt(w.x - sn * half, w.z - c * half);
    const pitch = THREE.MathUtils.clamp(Math.atan2(hs - hb, 2 * half), -0.25, 0.25);
    const y = Math.min(h, (hb + hs) / 2) + 0.2 * H * w.s;
    resting.at({ x: w.x - R.x, y, z: w.z - R.z, ry: w.yaw, rx: pitch, rz: w.heel, s: w.s }, () => ship(resting, { L, W, H, ...w }));
    world.colliders.addBox({ x: w.x, z: w.z, w: W * w.s * 0.9, d: L * w.s * 0.85, y0: y - 2, y1: y + H * 0.45 * w.s, rot: w.yaw });
    exclusions.push({ x: w.x, z: w.z, r: L * w.s * 0.55 });
  }
  const restingGroup = resting.build('rift_wrecks');
  restingGroup.position.set(R.x, 0, R.z);
  scene.add(restingGroup);
  mergeStatic(scene, [restingGroup]);
  for (const w of WRECKS) {
    const y = terrain.heightAt(w.x, w.z);
    world.addLight(new THREE.Vector3(w.x, y + 2.2, w.z), '#8a9ad8', 0.85, 22, false, 0.55);
  }
  // =============================================================== THE LANDING
  // The Ferryman's boat, beached in the dry channel under the landing his crossings never
  // reached (data/rift.js FERRYMAN), its lamp still lit at the tip of the raked stem.
  const F = FERRYMAN.boat;
  const bk = new Kit({ ...PALETTES.rift, wood: '#1a1014', wood2: '#120a0d', timber: '#0c0608' }, { detail });
  ship(bk, { L: 11, W: 2.2, H: 1.4, castle: false, mast: false, stem: 3.6 });
  bk.slab(0, 3.96, 6.85, 0.06, 0.32, 0.06, 'metal', { layer: 'metal' });
  bk.slab(0, 3.86, 6.85, 0.46, 0.1, 0.46, 'metal', { layer: 'metal' });
  bk.slab(0, 3.34, 6.85, 0.34, 0.52, 0.34, '#ff5a3a', { layer: 'glow', strength: 1.3 });
  bk.slab(0, 3.24, 6.85, 0.46, 0.1, 0.46, 'metal', { layer: 'metal' });
  const boat = bk.build('ferryman_boat');
  const fy = terrain.heightAt(F.x, F.z) + 0.25;
  boat.position.set(F.x, fy, F.z);
  boat.rotation.set(0, F.yaw, 0.12);
  scene.add(boat);
  boat.updateMatrixWorld(true);
  const lamp = new THREE.Vector3(0, 3.4, 6.85).applyMatrix4(boat.matrixWorld);
  mergeStatic(scene, [boat]);
  world.colliders.addBox({ x: F.x, z: F.z, w: 2.2 * 0.9, d: 11 * 0.85, y0: fy - 2, y1: fy + 1.4 * 0.45, rot: F.yaw });
  exclusions.push({ x: F.x, z: F.z, r: 7 });
  world.addLight(lamp, '#ff5a3a', 1.2, 16, true, 0.6);
  ferrymanBeacon(world, lamp);
}

// The Ferryman's lamp read from across the Rift (P5): a halo round the flame and a faint column
// of its red light standing over the Landing, so the lip has a beacon that shows over the long
// wall from its postern and the east road. Unlit additive shells, no light of their own (the
// scene's light count stays fixed, ADR-005); they breathe slowly, as the flame flickers.
function ferrymanBeacon(world, lamp) {
  const g = new THREE.Group();
  g.name = 'ferryman_beacon';
  g.position.copy(lamp);
  g.userData.dynamic = true;
  const mat = (opacity) => new THREE.MeshBasicMaterial({ color: '#ff5a3a', transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const shells = [[0.55, 0.5], [1.4, 0.2], [3.0, 0.075]].map(([r, o]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat(o));
    m.userData.base = o;
    g.add(m);
    return m;
  });
  // the column: a bright thread and a wide faint sleeve, fading upward in three lengths
  for (const [r, h, o, y0] of [[0.32, 20, 0.3, 0], [0.32, 22, 0.16, 20], [0.32, 26, 0.07, 42], [1.4, 30, 0.04, 0], [1.4, 28, 0.02, 30]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10, 1, true), mat(o));
    m.position.y = y0 + h / 2 + 0.4;
    m.userData.base = o;
    shells.push(m);
    g.add(m);
  }
  for (const m of shells) m.renderOrder = 2;
  world.scene.add(g);
  world.animated.push((t) => {
    const k = 0.86 + Math.sin(t * 1.3) * 0.1 + Math.sin(t * 3.7) * 0.04;
    for (const m of shells) m.material.opacity = m.userData.base * k;
  });
  world.ferrymanBeacon = g;
}
