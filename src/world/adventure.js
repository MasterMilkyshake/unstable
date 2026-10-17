// Builds the overworld's points of adventure (data/adventure.js): settles each site on dry,
// gentle ground near its anchor and off the roads, moves its spawners, chests, records and
// traders with it, and raises what is there: tents and fires, carts, towers, arches, dens,
// barrows. Runs right after the structure pass, before records, chests and NPCs are built,
// so everything downstream reads the settled positions.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit, siteFrame } from './kit.js';
import { mergeStatic } from './merge.js';
import { seededRandom, hashString } from '../core/util.js';
import { ADVENTURE_SITES, ADVENTURE_RECORDS } from '../data/adventure.js';
import { LANDFORMS } from '../data/landforms.js';
import { excludedAt } from './exclusionIndex.js';

// Towns keep their own streets.
const QUIET = [
  { x: 0, z: 0, r: 110 },
  { x: 0, z: -330, r: 60 },
];

const PAL = {
  wood: '#6a5238', wood2: '#56432f', timber: '#3e3226', dark: '#2a2420', stone: '#8a857a', stone2: '#6e6a60', edge: '#a39d90',
  earth: '#5a4a36', metal: '#4a4a4e', glow: '#ffb35a', cloth: '#8b7a5e', cloth2: '#6e604a', bone: '#ddd3bd', ash: '#3a3432',
  ember: '#ff7a2a', ice: '#cfeaf6', moss: '#5f7040', straw: '#b8a464', sail: '#c8bca0', crystal: '#a8e4ff', roof: '#4f4438',
};

// ---------------------------------------------------------------- settling
function roadDistance(world, x, z) {
  const isl = world.terrain.islandAt(x, z);
  if (!isl || !isl.roadAt) return Infinity;
  return isl.roadAt(x, z).d;
}

function roadDirection(world, x, z) {
  // gradient of road distance: points away from the road
  const e = 3;
  const gx = roadDistance(world, x + e, z) - roadDistance(world, x - e, z);
  const gz = roadDistance(world, x, z + e) - roadDistance(world, x, z - e);
  return Math.atan2(-gx, -gz); // yaw facing the road
}

// Mountain ranges are scenery, too sheer to climb (data/landforms.js): nothing settles on them.
const RANGES = Object.values(LANDFORMS).flat().filter((l) => l && l.kind === 'range' && l.points);
function onRange(x, z, pad) {
  for (const r of RANGES) {
    for (let i = 1; i < r.points.length; i++) {
      const [ax, az] = r.points[i - 1], [bx, bz] = r.points[i];
      if (segDist(x, z, ax, az, bx, bz) < r.w / 2 + pad) return true;
    }
  }
  return false;
}

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}

function footprint(world, x, z, r) {
  let lo = Infinity, hi = -Infinity, wet = 0;
  const pts = [[0, 0]];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a + 0.4) * r * 0.5, Math.sin(a + 0.4) * r * 0.5]);
  }
  for (const [dx, dz] of pts) {
    const h = world.terrain.heightAt(x + dx, z + dz);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
    if (h < 1.6) wet++;
    // something built here already (roof, wall, deck)
    if (world.colliders.groundAt(x + dx, z + dz, h + 40) > h + 0.35) return null;
  }
  return { lo, hi, wet };
}

export function settleSite(world, site) {
  const exclusions = world.exclusions || [];
  const fr = site.size;
  const shore = site.lair === 'skiff';
  const passes = world.terrain.passes || [];
  let best = null;
  for (let ring = 0; ring <= site.r; ring += 3) {
    const n = ring === 0 ? 1 : Math.max(6, Math.round((ring * Math.PI * 2) / 5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring * 0.37;
      const x = site.x + Math.cos(a) * ring, z = site.z + Math.sin(a) * ring;
      if (QUIET.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + fr)) continue;
      if (excludedAt(exclusions, x, z, fr * 0.8)) continue;
      if (onRange(x, z, fr + 24)) continue;
      const f = footprint(world, x, z, fr);
      if (!f) continue;
      if (shore ? f.lo < -0.4 || f.hi > 5 : f.wet > 0 || f.lo < 2) continue;
      const rd = roadDistance(world, x, z);
      if (site.nearRoad ? rd < 4 || rd > 16 : rd < fr * 0.6 + 4) continue;
      // Shelf edges are sheer walls: a camp must not straddle one, and must keep off cut ramps.
      if (passes.some((p) => segDist(x, z, p.ax, p.az, p.bx, p.bz) < (p.width || 6) / 2 + fr + 2)) continue;
      const range = f.hi - f.lo;
      const steep = Math.max(0, range - (site.lair === 'den' || site.lair === 'slag' ? 3 : 1));
      const cost = range * 2 + steep * 12 + ring * 0.05 + (site.nearRoad ? Math.abs(rd - 7) * 0.2 : 0);
      if (!best || cost < best.cost) best = { x, z, cost, range };
    }
  }
  const rng = seededRandom(hashString(site.id));
  if (!best) {
    best = { x: site.x, z: site.z, cost: Infinity, range: 0 };
    site.unsettled = true;
  }
  site.sx = best.x;
  site.sz = best.z;
  site.sy = world.terrain.heightAt(best.x, best.z);
  site.yaw = site.nearRoad ? roadDirection(world, best.x, best.z) : rng() * Math.PI * 2;
  site.range = best.range;
  return site;
}

// Move every record of a settled site: offsets turn with the site (siteFrame convention).
function placeRecords() {
  for (const r of ADVENTURE_RECORDS) {
    const s = r.site;
    if (s.sx == null) continue;
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    r.record.x = s.sx + r.dx * c + r.dz * sn;
    r.record.z = s.sz - r.dx * sn + r.dz * c;
  }
}

// ---------------------------------------------------------------- smoke you can see for miles
const SMOKE_VERT = /* glsl */ `
  uniform float uTime; uniform vec2 uWind;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vUv = uv;
    vec3 p = position;
    float h = uv.y;
    // the column leans downwind and swells as it rises
    p.xz *= 1.0 + h * 3.2;
    p.xz += uWind * h * h * 26.0 + vec2(sin(h * 5.0 + uTime * 0.3), cos(h * 4.0 + uTime * 0.25)) * h * 2.0;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SMOKE_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    vec3 toCam = cameraPosition - vW;
    float facing = abs(dot(normalize(vN.xz), normalize(toCam.xz + 1e-4)));
    float puff = noise(vec2(vUv.x * 6.0, vUv.y * 9.0 - uTime * 0.35)) * 0.6 + noise(vec2(vUv.x * 13.0, vUv.y * 17.0 - uTime * 0.6)) * 0.4;
    float a = pow(facing, 1.6) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    a *= 0.35 + puff * 0.65;
    float d = length(toCam);
    a *= smoothstep(6.0, 30.0, d);
    vec3 col = mix(uColor * 0.82, uColor * 1.08, puff);
    gl_FragColor = vec4(col, a * uAlpha);
  }`;
const smokeUniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.6, 0.35) }, uColor: { value: new THREE.Color('#9a958c') }, uAlpha: { value: 0.55 } };
const SMOKE_MAT = new THREE.ShaderMaterial({ uniforms: smokeUniforms, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
function smokeColumn(x, y, z, h = 46, r = 0.9) {
  const geo = new THREE.CylinderGeometry(r, r, h, 10, 14, true);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, SMOKE_MAT);
  m.position.set(x, y, z);
  m.renderOrder = 4;
  m.frustumCulled = false;
  m.name = 'adventure_smoke';
  m.userData.dynamic = true;
  return m;
}

// ---------------------------------------------------------------- pieces (kit, site-local)
function firePit(k, x, z, rng, o = {}) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.rock(x + Math.cos(a) * 0.9, 0.12, z + Math.sin(a) * 0.9, 0.42, 0.3, 0.36, i % 2 ? 'stone' : 'stone2', { ry: a });
  }
  if (o.cold) {
    k.slab(x, 0, z, 1.0, 0.06, 1.0, 'ash');
    k.slab(x - 0.2, 0.05, z, 0.9, 0.14, 0.16, 'dark', { ry: 0.7 });
    return null;
  }
  for (let i = 0; i < 3; i++) k.slab(x, 0.04, z, 1.1, 0.16, 0.18, 'wood2', { ry: i * 1.05 + rng() * 0.2 });
  k.glowPanel(x, 0.32, z, 0.5, 0.36, 0.5, 'ember', 1.6);
  return new THREE.Vector3(x, 0.5, z);
}

function tent(k, x, z, ry, o = {}) {
  const w = o.w ?? 3.2, d = o.d ?? 4.2, h = o.h ?? 2.5;
  k.at({ x, z, ry }, () => {
    k.wedge(0, 0, 0, w, h, d, o.cloth || 'cloth');
    // the ridge pole runs out past both ends; sail tents use an oar
    k.slab(0, h - 0.08, 0, 0.12, 0.12, d + 0.7, o.pole || 'timber');
    for (const sz of [-1, 1]) k.slab(0, 0, sz * (d / 2 + 0.25), 0.12, h, 0.12, 'timber');
    k.slab(0, 0, d / 2 + 0.01, w * 0.42, h * 0.62, 0.05, 'dark', { grad: 0 });
    if (o.patch) k.slab(w * 0.2, h * 0.35, -d * 0.1, 0.06, 0.8, 1.1, o.patch, { rz: -0.66 });
  });
}

function crates(k, x, z, rng, n = 3) {
  for (let i = 0; i < n; i++) {
    const s = 0.7 + rng() * 0.35;
    k.slab(x + (i % 2) * 0.9 + rng() * 0.2, i > 1 ? s : 0, z + (i > 1 ? 0.2 : i * 0.1), s, s, s, i % 2 ? 'wood' : 'wood2', { ry: rng() * 0.5 });
  }
  k.prism(x - 1.1, 0, z + 0.4, 0.38, 0.95, 'wood2', { sides: 8 });
  k.slab(x - 1.1, 0.3, z + 0.4, 0.82, 0.08, 0.82, 'metal', { layer: 'metal' });
}

function sacks(k, x, z, rng, n = 4) {
  for (let i = 0; i < n; i++) k.rock(x + (rng() - 0.5) * 2.2, 0.25, z + (rng() - 0.5) * 1.6, 0.8, 0.5, 0.6, 'straw', { ry: rng() * 3, grad: 0.15 });
}

function bannerPole(k, x, z, color, h = 6.5) {
  k.prism(x, 0, z, 0.1, h, 'timber', { sides: 6 });
  k.slab(x + 0.75, h - 2.6, z, 1.4, 2.3, 0.06, color, { grad: 0.2 });
  k.wedge(x + 0.75, h - 3.1, z, 1.4, 0.5, 0.06, color, { rz: Math.PI, grad: 0.2 });
}

function stakes(k, cx, cz, r, from, to, rng) {
  const n = Math.round(((to - from) * r) / 0.9);
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * i) / n;
    const h = 1.6 + rng() * 0.8;
    k.prism(cx + Math.cos(a) * r, -0.2, cz + Math.sin(a) * r, 0.16, h + 0.2, 'wood2', { sides: 5, top: 0.3, rz: (rng() - 0.5) * 0.12 });
  }
}

function bedroll(k, x, z, ry) {
  k.at({ x, z, ry }, () => {
    k.slab(0, 0, 0, 0.8, 0.12, 1.9, 'cloth2');
    k.prism(0, 0.06, -0.85, 0.2, 0.75, 'cloth', { sides: 6, rz: Math.PI / 2 });
  });
}

function pack(k, x, z, ry) {
  k.at({ x, z, ry }, () => {
    k.slab(0, 0, 0, 0.6, 0.75, 0.38, 'cloth');
    k.slab(0, 0.75, 0, 0.64, 0.12, 0.42, 'cloth2');
    k.prism(0, 0.85, -0.05, 0.12, 0.62, 'straw', { sides: 6, rz: Math.PI / 2 });
  });
}

function wagon(k, x, z, ry, o = {}) {
  k.at({ x, z, ry, rz: o.tip || 0 }, () => {
    const L = o.L ?? 4.2, W = o.W ?? 1.9;
    k.slab(0, 0.75, 0, W, 0.18, L, 'wood2');
    for (const sx of [-1, 1]) k.slab(sx * (W / 2 - 0.05), 0.93, 0, 0.1, 0.65, L, 'wood');
    k.slab(0, 0.93, L / 2 - 0.05, W, 0.65, 0.1, 'wood');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (o.lostWheel && sx > 0 && sz > 0) continue;
      k.prism(sx * (W / 2 + 0.12), 0.62, sz * (L / 2 - 0.7), 0.62, 0.12, 'timber', { sides: 8, rz: Math.PI / 2 });
      k.prism(sx * (W / 2 + 0.12), 0.62, sz * (L / 2 - 0.7), 0.16, 0.2, 'metal', { sides: 6, rz: Math.PI / 2, layer: 'metal' });
    }
    // shafts dropped in the dirt where the beast was cut loose
    for (const sx of [-0.45, 0.45]) k.slab(sx, 0.05, -L / 2 - 1.2, 0.1, 0.1, 2.6, 'timber', { rx: -0.25 });
    if (o.ore) {
      k.slab(0, 1.0, 0, W - 0.3, 0.6, L - 0.4, 'metal', { layer: 'metal' });
      for (let i = 0; i < 6; i++) k.rock(((i % 2) - 0.5) * 0.7, 1.45, -1.3 + i * 0.5, 0.6, 0.4, 0.5, i % 3 ? 'ash' : 'dark', { ry: i });
      k.glowPanel(0, 1.5, 0.3, 0.5, 0.12, 0.8, 'ember', 1.2);
    }
  });
  if (o.wheelOff) k.prism(x + Math.cos(ry) * 2.6, 0.06, z - Math.sin(ry) * 2.6, 0.62, 0.12, 'timber', { sides: 8 });
}

function mule(k, x, z, ry) {
  k.at({ x, z, ry }, () => {
    k.slab(0, 0.9, 0, 0.55, 0.62, 1.35, '#6e6052');
    for (const [sx, sz] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) k.slab(sx, 0, sz, 0.14, 0.92, 0.14, '#4e443a');
    k.slab(0, 1.35, 0.72, 0.26, 0.6, 0.3, '#6e6052', { rx: -0.5 });
    k.slab(0, 1.62, 1.0, 0.24, 0.24, 0.5, '#5e5244');
    for (const sx of [-0.08, 0.08]) k.slab(sx, 1.86, 0.88, 0.05, 0.3, 0.08, '#4e443a', { rx: -0.3 });
    for (const sx of [-1, 1]) k.slab(sx * 0.38, 0.95, 0, 0.26, 0.5, 0.7, 'cloth2');
  });
}

function tower(k, x, z, rng) {
  // the Keepers' watch tower: coursed stone, its top broken off and its floors fallen in
  k.at({ x, z }, () => {
    k.masonry(0, -1, 0, 5.4, 4, 5.4, { c: 'stone', c2: 'stone2', course: 0.8 });
    k.masonry(0, 3, 0, 5.0, 9, 5.0, { c: 'stone', c2: 'stone2', course: 0.8 });
    // broken crown: uneven merlon stubs
    for (let i = 0; i < 6; i++) k.slab(-2 + (i % 3) * 2, 12, i < 3 ? -2.2 : 2.2, 1.1, 0.6 + rng() * 1.6, 0.7, 'stone');
    k.slab(0, 11.7, 0, 5.4, 0.35, 5.4, 'edge');
    k.slab(0, 0, 2.52, 1.4, 2.4, 0.1, 'dark', { grad: 0 });
    for (const y of [5, 8.5]) k.slab(0, y, -2.52, 0.6, 1.2, 0.1, 'dark', { grad: 0 });
    // the nest: a mat of sticks on the crown
    for (let i = 0; i < 14; i++) k.slab((rng() - 0.5) * 3.6, 12.1 + rng() * 0.5, (rng() - 0.5) * 3.6, 2.4, 0.12, 0.12, 'wood2', { ry: rng() * 3 });
    for (let i = 0; i < 3; i++) k.rock((rng() - 0.5) * 1.2, 12.5, (rng() - 0.5) * 1.2, 0.36, 0.44, 0.36, 'bone');
  });
  k.rubble(x + 4, 0, z - 2, 3, 10, rng, { c: 'stone', c2: 'stone2' });
}

function tollArch(k, x, z, ry, rng) {
  k.at({ x, z, ry }, () => {
    for (const sx of [-1, 1]) k.pier(sx * 4.2, 0, 0, 2.0, 6.5, { d: 2.4 });
    k.arch(0, 6.5, 0, 6.4, { t: 0.8, depth: 2.4, spandrel: true, spandrelH: 0.6, c: 'edge', fill: 'stone' });
    k.slab(0, 10.3, 0, 10.8, 0.4, 2.8, 'edge');
    // the bar across the way, and the tollkeeper's heap of what people paid
    k.slab(0, 1.1, -1.4, 6.2, 0.22, 0.22, 'timber', { rz: 0.06 });
    sacks(k, -6.5, 3.5, rng, 5);
    crates(k, 5.5, 3.8, rng, 3);
    for (let i = 0; i < 4; i++) k.prism(-5 + i * 0.8, 0, 5.2, 0.32, 0.12, 'metal', { sides: 6, layer: 'metal' });
  });
}

function den(k, x, z, rng) {
  // a crescent of boulders open to the south, the floor littered with bone
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (i / 8) * 0.7);
    const r = 8 + rng() * 1.5;
    k.rock(x + Math.cos(a) * r, 0.6, z + Math.sin(a) * r, 3.6 + rng() * 1.6, 2.6 + rng() * 2, 3 + rng(), i % 2 ? 'stone' : 'stone2', { ry: a });
  }
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, r = 1.5 + rng() * 6;
    k.slab(x + Math.cos(a) * r, 0.02, z + Math.sin(a) * r, 0.12, 0.1, 0.6 + rng() * 0.6, 'bone', { ry: rng() * 3 });
  }
  k.slab(x + 2, 0.02, z + 5, 1.6, 0.05, 1.1, '#e9e4dc', { ry: 0.4 });
}

function slagHeaps(k, x, z, rng) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.4, r = 9 + rng() * 2.5;
    const hx = x + Math.cos(a) * r, hz = z + Math.sin(a) * r;
    k.prism(hx, -0.3, hz, 3 + rng() * 1.5, 2 + rng() * 1.8, 'ash', { sides: 6, top: 0.35, ry: rng() });
    k.glowPanel(hx, 0.7, hz, 0.25, 0.08, 2.4, 'ember', 1.1, { ry: rng() * 3 });
  }
  // the chute that fed it, broken off its trestle
  k.slab(x - 11, 0, z + 4, 0.4, 5.5, 0.4, 'timber');
  k.slab(x - 11, 0, z + 6, 0.4, 4.2, 0.4, 'timber');
  k.slab(x - 8.5, 4.2, z + 5, 1.2, 0.3, 6.5, 'metal', { rx: 0.45, layer: 'metal' });
}

function barrow(k, x, z, rng) {
  k.prism(x, -0.6, z, 5.2, 2.2, 'moss', { sides: 10, top: 0.55 });
  k.slab(x, 1.55, z, 2.4, 0.5, 1.6, 'stone', { ry: 0.3 });
  // an oar for every crew the sea kept, blade up
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    const r = 6.4 + (i % 2) * 0.4;
    const ox = x + Math.cos(a) * r, oz = z + Math.sin(a) * r;
    k.at({ x: ox, z: oz, ry: -a, rz: (rng() - 0.5) * 0.12 }, () => {
      k.slab(0, -0.4, 0, 0.1, 3.2, 0.1, 'wood');
      k.slab(0, 2.8, 0, 0.06, 1.1, 0.34, 'wood2');
    });
  }
}

function gibbets(k, x, z, rng) {
  for (const [gx, gz, ry] of [[-2.5, 0, 0.3], [2.6, -1.2, -0.4]]) {
    k.at({ x: x + gx, z: z + gz, ry }, () => {
      k.slab(0, 0, 0, 0.3, 5.6, 0.3, 'timber');
      k.slab(0.9, 5.3, 0, 2.1, 0.26, 0.26, 'timber');
      k.slab(0.5, 4.5, 0, 0.14, 1.0, 0.14, 'timber', { rz: -0.8 });
      k.slab(1.75, 3.6, 0, 0.04, 1.6, 0.04, 'metal', { layer: 'metal' });
      // the cage, empty: whoever hung here has been cut down
      for (const [cx, cz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) k.slab(1.75 + cx, 1.6, cz, 0.05, 2.0, 0.05, 'metal', { layer: 'metal' });
      k.slab(1.75, 1.55, 0, 0.8, 0.06, 0.8, 'metal', { layer: 'metal' });
      k.slab(1.75, 3.55, 0, 0.8, 0.06, 0.8, 'metal', { layer: 'metal' });
    });
  }
  // the Redwake cairn the Writ's men walk past every day
  for (let i = 0; i < 7; i++) k.rock(x - 4 + (rng() - 0.5) * 1.4, 0.3 + (i > 4 ? 0.6 : 0), z + 5.4 + (rng() - 0.5) * 1.4, 1.0, 0.7, 0.9, 'stone2', { ry: rng() * 3 });
}

function hatch(k, x, z, rng) {
  k.slab(x, -0.3, z, 3.4, 0.7, 3.4, 'stone2');
  k.slab(x, 0.35, z, 2.4, 0.18, 2.4, 'metal', { layer: 'metal', rx: 0.08 });
  k.slab(x - 0.8, 0.5, z, 0.25, 0.12, 0.6, 'metal', { layer: 'metal' });
  // the signal bell on its frame
  k.at({ x: x + 3.2, z: z - 0.5 }, () => {
    for (const sx of [-1.1, 1.1]) k.slab(sx, 0, 0, 0.3, 4.2, 0.3, 'timber');
    k.slab(0, 4.0, 0, 2.8, 0.3, 0.4, 'timber');
    k.prism(0, 2.6, 0, 0.55, 1.2, 'metal', { sides: 8, top: 0.55, layer: 'metal' });
  });
  for (let i = 0; i < 5; i++) k.rock(x + (rng() - 0.5) * 6, 0.2, z + 2.5 + rng() * 2, 1.1, 0.5, 0.9, 'ice', { ry: rng() * 3 });
}

function skiff(k, x, z, ry) {
  k.at({ x, z, ry, rz: 0.45 }, () => {
    k.slab(0, 0, 0, 1.5, 0.55, 4.2, 'wood2');
    k.wedge(0, 0, 2.6, 1.5, 0.55, 1.0, 'wood2', { rx: Math.PI / 2 });
    k.slab(0, 0.55, 0, 1.6, 0.08, 4.0, 'timber');
  });
  // the sounding line, paid out across the sand to its lead
  for (let i = 0; i < 9; i++) k.slab(x + 1 + i * 1.1, 0.02, z + Math.sin(i * 0.7) * 0.6, 1.2, 0.04, 0.05, 'cloth2', { ry: 0.2 });
  k.prism(x + 11, 0, z, 0.18, 0.4, 'metal', { sides: 6, layer: 'metal' });
}

function kiln(k, x, z, rng) {
  k.prism(x, -0.2, z, 2.2, 1.8, 'earth', { sides: 8, top: 0.45 });
  k.slab(x, 1.5, z, 0.6, 0.25, 0.6, 'ash');
  for (let i = 0; i < 3; i++) k.slab(x + 2.5, 0, z - 1 + i * 0.7, 1.8, 0.35, 0.35, 'wood2', { ry: 0.1 });
}

function effigy(k, x, z, rng) {
  // a pilgrim kept upright in the ice: a pale shape inside a block
  k.slab(x, 0, z, 0.55, 1.75, 0.4, 'cloth', { ry: rng() });
  k.crystal(x, -0.1, z, 0.85, 2.5, 'ice', { ry: rng() });
}

function brazier(k, x, z) {
  k.prism(x, 0, z, 0.18, 1.2, 'metal', { sides: 4, layer: 'metal' });
  k.prism(x, 1.2, z, 0.7, 0.5, 'metal', { sides: 6, top: 1.3, layer: 'metal' });
  k.glowPanel(x, 1.55, z, 0.8, 0.3, 0.8, 'ember', 1.7);
  return new THREE.Vector3(x, 2, z);
}

function leanTo(k, x, z, ry) {
  k.at({ x, z, ry }, () => {
    k.slab(0, 0, 1.4, 3.6, 2.4, 0.15, 'wood2');
    k.slab(0, 2.1, 0, 3.8, 0.12, 3.2, 'cloth', { rx: 0.42 });
    for (const sx of [-1.7, 1.7]) k.slab(sx, 0, -1.2, 0.14, 1.3, 0.14, 'timber');
  });
}

// ---------------------------------------------------------------- per kind
function buildSite(world, site, low) {
  const rng = seededRandom(hashString(site.id) + 7);
  const k = new Kit(PAL, { detail: low ? 0 : 1 });
  const f = siteFrame(world, site.sx, site.sz, site.yaw, site.sy);
  const fires = [];
  const smokes = [];
  // Everything is draped over the ground under it, so a camp on a slope sits on the slope.
  k.warps.push((v) => { v.y += f.ground(v.x, v.z); });
  const solid = (lx, lz, w, d, h, o) => {
    const gy = f.ground(lx, lz);
    f.solid(lx, lz, w, d, gy - 1, gy + h, o);
  };

  if (site.kind === 'camp') {
    fires.push(firePit(k, 0, 0, rng));
    const n = site.tents || 0;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.35 + (i / Math.max(1, n)) * Math.PI * 1.3;
      const tx = Math.cos(a) * 8.5, tz = Math.sin(a) * 8.5;
      const sail = site.faction === 'redwake';
      tent(k, tx, tz, -a + Math.PI / 2, { cloth: sail ? 'sail' : site.faction === 'cult' ? '#eef2f4' : site.faction === 'deserters' ? '#5d6a72' : 'cloth', patch: sail ? site.banner : null });
      solid(tx, tz, 3.4, 4.4, 2.4, { rot: -a + Math.PI / 2 });
    }
    if (site.faction !== 'cult') {
      crates(k, -7.5, -4, rng);
      solid(-7.1, -4, 2.6, 1.6, 1.2);
    }
    stakes(k, 0, 0, site.size - 1, Math.PI * 1.15, Math.PI * 1.85, rng);
    if (site.banner) bannerPole(k, 5.5, -6, site.banner);
    if (site.tower) {
      k.at({ x: -9, z: 6 }, () => {
        for (const [sx, sz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) k.slab(sx, 0, sz, 0.3, 7, 0.3, 'timber');
        k.slab(0, 6.8, 0, 3.4, 0.25, 3.4, 'wood2');
        k.slab(0, 7.05, -1.6, 3.4, 1.0, 0.12, 'wood');
      });
      solid(-9, 6, 3, 3, 7.05);
    }
    for (let i = 0; i < (site.effigies || 0); i++) {
      const a = (i / site.effigies) * Math.PI * 2 + 0.4;
      effigy(k, Math.cos(a) * 11, Math.sin(a) * 11, rng);
      solid(Math.cos(a) * 11, Math.sin(a) * 11, 1.4, 1.4, 2.4);
    }
    for (let i = 0; i < (site.braziers || 0); i++) {
      const a = (i / site.braziers) * Math.PI * 2 + 1.1;
      fires.push(brazier(k, Math.cos(a) * 7, Math.sin(a) * 7));
      solid(Math.cos(a) * 7, Math.sin(a) * 7, 1.2, 1.2, 1.7);
    }
    bedroll(k, 2.6, 1.8, 0.4);
    bedroll(k, -2.4, 2.4, -0.6);
    if (site.smoke) smokes.push([0, 0, 50]);
  } else if (site.kind === 'caravan') {
    const ore = site.id === 'slag_wagon';
    wagon(k, 0, 0, 0.25, { tip: ore ? 0 : 0.9, lostWheel: true, wheelOff: true, ore });
    solid(0, 0, 2.4, 4.6, ore ? 2.1 : 1.6, { rot: 0.25 });
    sacks(k, -2.6, 1.8, rng, ore ? 0 : 6);
    crates(k, 3.0, 2.6, rng, ore ? 1 : 3);
    if (!ore) {
      // the ox, cut loose and gone; its yoke left in the road
      k.slab(0.4, 0.05, -4.6, 1.8, 0.16, 0.22, 'timber', { ry: 0.4 });
    }
  } else if (site.kind === 'fire') {
    fires.push(firePit(k, 0, 0, rng));
    bedroll(k, -2.4, 1.4, 1.1);
    pack(k, 2.0, 1.6, 0.6);
    k.at({ x: -1.2, z: -2.6 }, () => k.slab(0, 0, 0, 0.9, 0.5, 0.4, 'wood2'));
    const flame = k.lantern(3.4, 0, -2.2, { post: 2.2, metal: 'metal' });
    flame.y += f.ground(3.4, -2.2);
    world.addLight(flame.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw).add(new THREE.Vector3(site.sx, site.sy, site.sz)), '#ffb35a', 1.1, 14, true, 1.1);
    if (site.mule) {
      mule(k, 4.4, 3.2, 0.9);
      solid(4.4, 3.2, 1.0, 1.8, 1.9, { rot: 0.9 });
    }
    if (site.lean) {
      leanTo(k, 0, 4.6, 0);
      solid(0, 5.9, 3.8, 0.4, 2.4);
    }
    for (let i = 0; i < (site.kilns || 0); i++) {
      const kx = -7 + i * 7, kz = 7 + (i % 2) * 2;
      kiln(k, kx, kz, rng);
      solid(kx, kz, 3.6, 3.6, 1.6);
      smokes.push([kx, kz, 34]);
    }
    if (site.smoke && !site.kilns) smokes.push([0, 0, 30]);
  } else if (site.kind === 'lair') {
    if (site.lair === 'tower') {
      tower(k, -6, 6, rng);
      solid(-6, 6, 5.4, 5.4, 12.3);
    } else if (site.lair === 'arch') {
      tollArch(k, 0, 6, 0, rng);
      for (const sx of [-4.2, 4.2]) solid(sx, 6, 2.0, 2.4, 6.5);
      solid(0, 6, 10.8, 2.8, 10.7, { walkable: true, climbable: true });
      fires.push(firePit(k, 6, -2, rng));
    } else if (site.lair === 'den') {
      den(k, 0, 0, rng);
    } else if (site.lair === 'slag') {
      slagHeaps(k, 0, 0, rng);
    }
  } else if (site.kind === 'memorial') {
    if (site.lair === 'gibbets') gibbets(k, 0, 0, rng);
    else if (site.lair === 'hatch') {
      hatch(k, 0, 0, rng);
      solid(0, 0, 3.4, 3.4, 0.45);
    } else {
      barrow(k, 0, 0, rng);
      solid(0, 0, 7, 7, 1.0);
    }
  } else if (site.kind === 'rest') {
    if (site.lair === 'skiff') skiff(k, -3, 0, 0.6);
    else {
      firePit(k, 0, 0, rng, { cold: true });
      bedroll(k, -0.4, -1.8, 1.4);
      pack(k, 1.8, -0.4, -0.5);
      k.slab(-2.0, 0, 0.8, 0.08, 1.7, 0.08, 'timber', { rz: 1.2 });
    }
  }

  const g = k.build('adventure_' + site.id);
  g.position.set(site.sx, site.sy, site.sz);
  g.rotation.y = site.yaw;
  world.scene.add(g);
  for (const p of fires) {
    if (!p) continue;
    p.y += f.ground(p.x, p.z);
    const w = p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw).add(new THREE.Vector3(site.sx, site.sy, site.sz));
    world.addLight(w.clone().add(new THREE.Vector3(0, 0.6, 0)), '#ff9a4a', 1.5, 16, true, 1.2);
    world.addEmitter({ kind: 'fire', pos: w, rate: 12 });
  }
  for (const [lx, lz, h] of smokes) {
    const [wx, wz] = f.at(lx, lz);
    world.scene.add(smokeColumn(wx, world.terrain.heightAt(wx, wz) + 0.6, wz, h));
  }
  return g;
}

export function buildAdventure(world, exclusions) {
  world.exclusions = exclusions;
  const low = !!(G.settings && G.settings.quality === 'low');
  const roots = [];
  for (const site of ADVENTURE_SITES) {
    settleSite(world, site);
    // claim the ground before the next site looks for its own
    exclusions.push({ x: site.sx, z: site.sz, r: site.size + 2, adventure: site.id });
  }
  placeRecords();
  for (const site of ADVENTURE_SITES) roots.push(buildSite(world, site, low));
  mergeStatic(world.scene, roots);
  world.adventure = { sites: ADVENTURE_SITES };
  world.animated.push((t) => {
    smokeUniforms.uTime.value = t;
    const fog = world.scene.fog;
    if (fog) smokeUniforms.uColor.value.copy(fog.color).lerp(new THREE.Color('#8f8a82'), 0.55);
  });
  return world.adventure;
}
