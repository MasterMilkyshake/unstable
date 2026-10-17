// The Rift's floor and its edges: what the ground is like between the places, and what the
// island is like seen from its rim and from below.
//   the underside   the island is a fallen slab of the country above: below its lip it breaks
//                   off in cliffs of bedded rock, then tapers to hanging spires far down in the
//                   void (the terrain's own skirt under the lip is cut away so this is what shows)
//   the ground      patches of silt, lichen and old soil on the plain (a ground shader); strata
//                   outcrops where the floor's beds break through; rubble where the crust has
//                   fallen (under every scar and every ravine); root mats under root curtains
//   the far crust   pieces of the crust that broke away, hanging at the edge of the haze
import * as THREE from 'three';
import { Kit } from './kit.js';
import { mergeStatic } from './merge.js';
import { seededRandom, smoothstep, lerp } from '../core/util.js';
import { Noise2D } from '../core/noise.js';
import { clearance } from './riftRock.js';
import { CRUST_SCARS, RAVINES, ravinePoint, ceilingYAt, bedColor, strataColor } from './riftCeiling.js';
import { RIFT_CENTER } from '../data/riftLayout.js';

const noise = new Noise2D(8811);
const CUT = -7; // the terrain's skirt is not drawn below this height (the underside takes over)

// ------------------------------------------------------------------ the terrain's surface
// The Rift island's own material: its void skirt cut away below CUT, and the plain broken into
// patches (old silt, lichen, packed soil) so it never reads as one flat purple.
function patchGround(island) {
  const mesh = island && island.mesh;
  if (!mesh || !mesh.material) return;
  const mat = mesh.material;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGroundW;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`)
      .replace('void main() {', `void main() {
  if (vGroundW.y < ${CUT.toFixed(1)}) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    // the surface terrain lerps bright 'veins' of lattice colour into this ground at 35%
    // (terrain.js): take them back out, leaving the ground's own colour under them
    vec3 V = vec3(0.254, 0.102, 0.737);
    float chroma = diffuseColor.b - diffuseColor.g;
    float tv = clamp((chroma - 0.07) / 0.18, 0.0, 1.0) * 0.35;
    diffuseColor.rgb = max(vec3(0.0), (diffuseColor.rgb - tv * V) / (1.0 - tv));
    vec2 q = vGroundW.xz;
    float broad = gNoise(q * 0.018) * 0.65 + gNoise(q * 0.07) * 0.35;
    float fine = gNoise(q * 0.45);
    // silt: pale, cold; lichen: a dull green-grey; old soil: warm and dark
    vec3 silt = vec3(0.30, 0.29, 0.33), lichen = vec3(0.24, 0.29, 0.27), soil = vec3(0.25, 0.20, 0.19);
    float s1 = smoothstep(0.58, 0.75, broad), s2 = smoothstep(0.62, 0.8, 1.0 - broad), s3 = smoothstep(0.55, 0.7, gNoise(q * 0.03 + 7.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, silt, s1 * 0.45);
    diffuseColor.rgb = mix(diffuseColor.rgb, lichen, s2 * 0.4);
    diffuseColor.rgb = mix(diffuseColor.rgb, soil, s3 * 0.3);
    diffuseColor.rgb *= 0.92 + fine * 0.14;
  }`);
  };
  mat.customProgramCacheKey = () => 'rift-ground-rift';
  mat.needsUpdate = true;
}

// ------------------------------------------------------------------ the underside
// The island's footprint on a grid, its distance from the edge, and a downward surface whose
// depth grows from the lip (cliffs) to the middle (deep hanging spires).
function underside(world, island, centre, o) {
  const T = world.terrain;
  const cell = o.cell;
  const x0 = centre.x - o.half, z0 = centre.z - o.half;
  const N = Math.round((o.half * 2) / cell);
  const land = new Uint8Array((N + 1) * (N + 1));
  const at = (i, j) => j * (N + 1) + i;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = x0 + i * cell, z = z0 + j * cell;
    land[at(i, j)] = T.heightAt(x, z) > CUT + 0.5 ? 1 : 0;
  }
  // grow the footprint by one cell so the underside reaches out under the cut lip
  const foot = land.slice();
  for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
    if (land[at(i, j)]) continue;
    if (land[at(i + 1, j)] || land[at(i - 1, j)] || land[at(i, j + 1)] || land[at(i, j - 1)]) foot[at(i, j)] = 2;
  }
  // distance from the edge, by a two-pass chamfer sweep
  const dist = new Float32Array((N + 1) * (N + 1)).fill(1e6);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) if (!foot[at(i, j)]) dist[at(i, j)] = 0;
  const D1 = cell, D2 = cell * Math.SQRT2;
  for (let j = 1; j <= N; j++) for (let i = 1; i < N; i++) {
    const k = at(i, j);
    dist[k] = Math.min(dist[k], dist[at(i - 1, j)] + D1, dist[at(i, j - 1)] + D1, dist[at(i - 1, j - 1)] + D2, dist[at(i + 1, j - 1)] + D2);
  }
  for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i > 0; i--) {
    const k = at(i, j);
    dist[k] = Math.min(dist[k], dist[at(i + 1, j)] + D1, dist[at(i, j + 1)] + D1, dist[at(i + 1, j + 1)] + D2, dist[at(i - 1, j + 1)] + D2);
  }
  // depth: cliffs a few cells deep at the edge, then a long taper; spires where noise peaks
  const depth = (x, z, e) => {
    const cliff = 26 * smoothstep(0, 10, e);
    const taper = (o.deep - 30) * smoothstep(8, o.reach, e) ** 0.8;
    const lumps = noise.fbm(x * 0.03, z * 0.03, 3) * 14 * smoothstep(6, 40, e);
    const spire = Math.max(0, noise.noise(x * 0.06 + 3, z * 0.06 - 2) - 0.45) * 90 * smoothstep(20, 60, e);
    return CUT + 0.5 - (4 + cliff + taper + lumps + spire);
  };
  const Y = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = at(i, j);
    if (!foot[k]) continue;
    const x = x0 + i * cell, z = z0 + j * cell;
    Y[k] = foot[k] === 2 ? CUT + 0.5 : depth(x, z, dist[k]);
  }
  const pos = [], col = [];
  const c0 = new THREE.Color(), rock = new THREE.Color(o.rock), root = new THREE.Color('#2b211b');
  const push = (p, c) => { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); };
  const V = (i, j) => [x0 + i * cell + (noise.noise(i * 1.7, j * 1.3) * cell * 0.25), Y[at(i, j)], z0 + j * cell + (noise.noise(j * 1.9, i * 1.1) * cell * 0.25)];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const ks = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    if (!ks.every((k) => foot[k])) continue;
    const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
    // facing down: (a, b, d) / (b, c, d) wound like the crust's underside
    for (const [p, q, r] of [[a, b, d], [b, c, d]]) {
      const yc = (p[1] + q[1] + r[1]) / 3;
      strataColor(c0, (p[0] + q[0] + r[0]) / 3, yc + 140, (p[2] + q[2] + r[2]) / 3);
      c0.lerp(rock, 0.55).multiplyScalar(lerp(0.45, 1, smoothstep(-200, -10, yc)));
      // soil and roots under the lip, where the floor's turf still hangs on
      if (yc > CUT - 8) c0.lerp(root, 0.4);
      push(p, c0); push(q, c0); push(r, c0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.18 });
  // it sinks into the void: the deeper it hangs, the more its haze goes to the dark below
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;')
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.05, 0.04, 0.07), smoothstep(-25.0, -190.0, vFogWorld.y) * 0.75);');
  };
  mat.customProgramCacheKey = () => 'rift-underside';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rift_underside';
  mesh.receiveShadow = false;
  return { mesh, foot, dist, at, N, x0, z0, cell, Y };
}

// Roots hanging off the lip where the turf above holds on, and dripstone off the spires.
function undersideDress(k, u, rng, low) {
  const { foot, dist, at, N, x0, z0, cell, Y } = u;
  for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
    const kk = at(i, j);
    if (foot[kk] !== 1) continue;
    const e = dist[kk];
    const x = x0 + i * cell, z = z0 + j * cell;
    if (e < cell * 2.5 && rng() < (low ? 0.12 : 0.35)) {
      // a root strand down the cliff face
      const len = 6 + rng() * 14;
      k.prism(x + (rng() - 0.5) * 2, Y[kk] - len, z + (rng() - 0.5) * 2, 0.25 + rng() * 0.2, len, rng() < 0.5 ? 'root' : 'root2', { sides: 4, top: 1.6, rx: (rng() - 0.5) * 0.3, rz: (rng() - 0.5) * 0.3 });
    } else if (e > 40 && rng() < (low ? 0.01 : 0.03)) {
      const s = 1.5 + rng() * 2.5;
      k.inverted(x, Y[kk] + 1, z, (h) => h.prism(0, 0, 0, s, s * (4 + rng() * 4), 'stone2', { sides: 5, top: 0.05, ry: rng() * 6 }), rng() * 6);
    }
  }
}

// ------------------------------------------------------------------ the cliff faces
// The ground's own edge is one smooth band from the lip down to the cut. Face it in bedded rock:
// strata stepping out and back down the face, coloured by their beds like the crust overhead,
// round every edge of the island (its rim, the Bastion's lobe, both walls of the Sundering).
function cliffFace(k, world, u, rng, low, solids) {
  const { foot, at, N, x0, z0, cell } = u;
  const T = world.terrain;
  const step = low ? 2 : 1;
  const c = new THREE.Color();
  for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
    if (foot[at(i, j)] !== 1 || (i + j) % step) continue;
    let nx = 0, nz = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (foot[at(i + di, j + dj)] !== 1) { nx += di; nz += dj; }
    }
    const L = Math.hypot(nx, nz);
    if (L < 0.5) continue;
    nx /= L; nz /= L;
    const x = x0 + i * cell, z = z0 + j * cell;
    const top = T.heightAt(x, z);
    if (top < CUT + 2) continue;
    // the lip: out from the cell to where the ground starts to fall away
    let lx = x, lz = z;
    for (let d = 0.5; d < cell * 1.8; d += 0.5) {
      if (T.heightAt(x + nx * d, z + nz * d) < top - 2) break;
      lx = x + nx * d; lz = z + nz * d;
    }
    const ry = Math.atan2(nx, nz);
    let y = CUT - 5;
    for (let n = 0; n < 9 && y < top - 0.7; n++) {
      const h = Math.min(top - 0.5 - y, 2.2 + rng() * 3.2);
      const out = 0.5 + rng() * 2.4 * (1 - 0.5 * (y - CUT) / (top - CUT + 5));
      const w = cell * step * (1.08 + rng() * 0.3);
      bedColor(c, Math.floor(5 + (y + 40) / 6 + rng() * 2)).multiplyScalar(0.6);
      const cx = lx + nx * (out / 2 - 1.4), cz = lz + nz * (out / 2 - 1.4), yaw = ry + (rng() - 0.5) * 0.22;
      k.at({ x: cx, y, z: cz, ry: yaw }, (b) => b.slab(0, 0, 0, w, h, out + 2.8, '#' + c.getHexString(), { rz: (rng() - 0.5) * 0.05, grad: 0.12 }));
      if (y + h >= top - 0.7 || n === 8) solids.push({ x: cx, z: cz, w, d: out + 2.8, y0: y, y1: y + h, rot: yaw, edge: true });
      y += h;
    }
  }
}

// ------------------------------------------------------------------ the far crust
// A piece of the crust that broke away: its flat bedded top, the strata in its sides, its
// underside tapering to points, dripstone off it.
// Built about (x, z): without that frame every piece landed on the world origin, in Saltreach.
function fragment(k, x, y, z, s, rng) {
  k.at({ x, z }, (k) => {
    const tiers = 4;
    let r = 8 * s, yy = y;
    for (let t = 0; t < tiers; t++) {
      const h = (3 + rng() * 3) * s;
      const c = '#' + bedColor(new THREE.Color(), Math.floor(14 + t + rng() * 3)).multiplyScalar(0.9).getHexString();
      k.prism((rng() - 0.5) * s * 2, yy - h, (rng() - 0.5) * s * 2, r, h, c, { sides: 6 + Math.floor(rng() * 3), top: t === 0 ? 0.92 : 1.18, ry: rng() * 6, dr: r * (0.7 + rng() * 0.3) });
      yy -= h;
      r *= 0.62;
    }
    k.prism(0, yy - 10 * s, 0, r, 10 * s, 'stone2', { sides: 5, top: 0.06, ry: rng() * 6 });
    // a scrap of the turf it carried, and roots down its side
    k.prism(0, y, 0, 8 * s * 0.85, 0.6 * s, 'moss', { sides: 7, top: 0.9 });
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2, d = 7 * s;
      k.prism(Math.cos(a) * d, y - 6 * s - rng() * 6 * s, Math.sin(a) * d, 0.3 * s, 6 * s + rng() * 6 * s, 'root', { sides: 4, top: 1.5 });
    }
  });
}

// ------------------------------------------------------------------ the floor's dressing
const FLOOR = {
  stone: '#4a4456', stone2: '#3c3646', edge: '#5d566a', earth: '#3b3141', moss: '#3f4a3a',
  root: '#2c211a', root2: '#372a20', fresh: '#776e63', dark: '#221d27',
};

// A fall of crust: the big beds first, broken across, then smaller pieces thrown out from them,
// all of them the crust's own colours (they came from overhead).
function rubbleField(k, world, cx, cz, r, rng, free, solids, o = {}) {
  const T = world.terrain;
  const big = o.big ?? 5;
  const ceilY = ceilingYAt(world, cx, cz);
  for (let i = 0; i < big; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 0.6;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const w = 3 + rng() * 4, dd = 2 + rng() * 3, h = 1.2 + rng() * 1.6;
    if (!free(x, z, Math.max(w, dd) * 0.6)) continue;
    const g = T.heightAt(x, z);
    if (g < -2) continue;
    const c = '#' + strataColor(new THREE.Color(), x, ceilY - rng() * 8, z).multiplyScalar(0.95).getHexString();
    const ry = rng() * Math.PI, rx = (rng() - 0.5) * 0.5, rz = (rng() - 0.5) * 0.5;
    k.slab(x, g - h * 0.45, z, w, h, dd, c, { ry, rx, rz });
    k.slab(x, g - h * 0.45 + h, z, w * 0.96, 0.2, dd * 0.96, FLOOR.fresh, { ry, rx, rz });
    solids.push({ x, z, w: w * 0.85, d: dd * 0.85, y0: g - 1, y1: g + h * 0.5, rot: ry });
  }
  const small = o.small ?? 22;
  for (let i = 0; i < small; i++) {
    const a = rng() * Math.PI * 2, d = (0.3 + rng() * 0.7) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (!free(x, z, 1)) continue;
    const g = T.heightAt(x, z);
    if (g < -2) continue;
    const s = 0.4 + rng() * 1.1 * (1 - d / r);
    const c = '#' + strataColor(new THREE.Color(), x, ceilY - rng() * 8, z).getHexString();
    k.rock(x, g + s * 0.15, z, s * 1.6, s, s * 1.3, c, { ry: rng() * 6 });
  }
}

// Strata of the floor breaking through it: beds stepped back and tilted the same way, as if the
// fall cracked the ground and lifted one edge.
function outcrop(k, world, x, z, s, rng, solids) {
  const g = world.terrain.heightAt(x, z);
  const yaw = rng() * Math.PI, tilt = 0.08 + rng() * 0.12;
  let w = 9 * s, d = 5 * s, y = g - 1.2;
  const beds = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < beds; i++) {
    const h = (0.9 + rng() * 0.7) * s;
    const c = '#' + bedColor(new THREE.Color(), 2 + i + Math.floor(rng() * 4)).multiplyScalar(0.8).getHexString();
    k.at({ x, y, z, ry: yaw, rx: tilt }, (b) => b.slab(-i * 0.6 * s, 0, i * 0.3 * s, w, h + 0.05, d, c));
    y += h;
    w *= 0.8;
    d *= 0.78;
  }
  if (rng() < 0.6) k.prism(x + Math.cos(yaw) * 3 * s, g, z + Math.sin(yaw) * 3 * s, 1.6 * s, 0.25, FLOOR.moss, { sides: 7, top: 0.9 });
  solids.push({ x, z, w: 8 * s, d: 4.4 * s, y0: g - 1.2, y1: y - 0.3, rot: yaw });
}

// Roots come down a curtain from the crust and spread on the floor where they land.
function rootMat(k, world, x, z, len, yaw, rng) {
  const g0 = world.terrain.heightAt(x, z);
  const n = Math.round(len * 1.4);
  for (let i = 0; i < n; i++) {
    const u = (rng() - 0.5) * len;
    const px = x + Math.cos(yaw) * u, pz = z + Math.sin(yaw) * u;
    const a = rng() * Math.PI * 2, l = 1.5 + rng() * 3.5;
    const g = world.terrain.heightAt(px, pz);
    if (Math.abs(g - g0) > 2) continue;
    k.at({ x: px, y: g + 0.08, z: pz, ry: a }, (b) => {
      b.block(0, 0, l / 2, 0.22 + rng() * 0.12, 0.16, l, rng() < 0.5 ? 'root' : 'root2', { rx: 0.04 });
      b.block(0.3, 0, l * 0.8, 0.12, 0.1, l * 0.5, 'root2', { ry: 0.5 });
    });
  }
}

export function buildRiftFloor(world, exclusions, state) {
  const low = !!state.low;
  const rng = seededRandom(31337);
  const T = world.terrain;
  const rift = T.byId && T.byId.rift;
  patchGround(rift);
  const roots = [];

  // the underside of the Rift island
  const kd = new Kit({ ...FLOOR }, { detail: low ? 0 : 1 });
  const faceSolids = [];
  for (const [isl, centre, o] of [
    [rift, RIFT_CENTER, { cell: low ? 9 : 6, half: 360, deep: 210, reach: 170, rock: '#3a3442' }],
  ]) {
    if (!isl) continue;
    const u = underside(world, isl, centre, o);
    world.scene.add(u.mesh);
    if (isl === rift) {
      undersideDress(kd, u, rng, low);
      cliffFace(kd, world, u, rng, low, faceSolids);
    }
  }
  // the far crust, at the edge of the haze, where pieces broke from the rim
  const far = low ? 6 : 13;
  for (let i = 0; i < far; i++) {
    const a = (i / far) * Math.PI * 2 + rng() * 0.3;
    const r = 300 + rng() * 80;
    const x = RIFT_CENTER.x + Math.cos(a) * r, z = RIFT_CENTER.z + Math.sin(a) * r;
    fragment(kd, x, -30 + rng() * 80, z, 0.9 + rng() * 1.6, rng);
  }
  const ug = kd.build('rift_underside_dress');
  world.scene.add(ug);
  roots.push(ug);
  for (const s of faceSolids) world.colliders.addBox({ x: s.x, z: s.z, w: s.w, d: s.d, y0: s.y0, y1: s.y1, rot: s.rot, climbable: true, walkable: true, tag: 'rift_cliff' });

  // the floor's dressing, clear of every place, pad and way
  const free = clearance(exclusions);
  const k = new Kit({ ...FLOOR }, { detail: low ? 0 : 1 });
  const solids = [];
  // rubble under every scar in the crust
  for (const s of CRUST_SCARS) rubbleField(k, world, s.x, s.z, s.r * 1.3, rng, free, solids, { big: low ? 3 : 6, small: low ? 8 : 26 });
  // and along every ravine, where its lips came down when it opened
  for (const r of RAVINES) {
    for (let i = 0; i < 4; i++) {
      const p = ravinePoint(r.rift, 0.15 + i * 0.23);
      if (T.heightAt(p.x, p.z) < -2) continue;
      const side = i % 2 ? 1 : -1;
      rubbleField(k, world, p.x + p.nx * side * 7, p.z + p.nz * side * 7, 7, rng, free, solids, { big: low ? 1 : 3, small: low ? 4 : 12 });
    }
  }
  // strata outcrops in the open floor
  const outcrops = [];
  for (let t = 0; t < 900 && outcrops.length < (low ? 10 : 22); t++) {
    const a = rng() * Math.PI * 2, d = 60 + Math.sqrt(rng()) * 170;
    const x = RIFT_CENTER.x + Math.cos(a) * d, z = RIFT_CENTER.z + Math.sin(a) * d;
    const s = 0.8 + rng() * 0.8;
    if (!free(x, z, 7 * s) || outcrops.some((o) => Math.hypot(o.x - x, o.z - z) < 30)) continue;
    const g = T.heightAt(x, z);
    if (g < 0) continue;
    // only on near-level ground: an outcrop on a riser would read as a step
    if (Math.abs(T.heightAt(x + 4, z) - g) > 1 || Math.abs(T.heightAt(x, z + 4) - g) > 1) continue;
    outcrop(k, world, x, z, s, rng, solids);
    outcrops.push({ x, z });
  }
  // root mats under the root curtains that reach the floor
  for (const c of state.ceiling?.curtains || []) {
    if (T.heightAt(c.x, c.z) < 0 || !free(c.x, c.z, c.len / 2)) continue;
    rootMat(k, world, c.x, c.z, c.len, c.yaw, rng);
  }
  const g = k.build('rift_floor_dress');
  world.scene.add(g);
  roots.push(g);
  for (const s of solids) {
    world.colliders.addBox({ x: s.x, z: s.z, w: s.w, d: s.d, y0: s.y0, y1: s.y1, rot: s.rot, climbable: true, walkable: true, tag: 'rift_floor' });
    exclusions.push({ x: s.x, z: s.z, r: Math.max(s.w, s.d) * 0.6 });
  }
  for (const o of outcrops) exclusions.push({ x: o.x, z: o.z, r: 8 });
  // the undersides keep their own material (their emissive tint and depth-darkened haze)
  mergeStatic(world.scene, roots);
  state.floor = { outcrops: outcrops.length, rubble: solids.length };
}
