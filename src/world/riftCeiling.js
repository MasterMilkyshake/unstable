// The roof of the Rift is the underside of the isles above it: a crust tens of metres thick,
// laid down in strata and broken into inverted shelves, hanging lowest where the hills above
// are highest and vaulting up over the Ascent. It carries on past the basin's rim, rising
// away into the haze. Nothing in it is random: what hangs from it depends on what is above.
//   under the sea     the harbor and the Wash: wet, cold stone, dripstone, the pilings of
//                     Saltreach's piers driven down through the seabed, salt seams;
//   under the town    Saltreach's cellars and foundations, cut open around the Ascent's shaft;
//   under the land    soil bands and root curtains from the woods and fields above.
// Four ravines and the Ascent's shaft go all the way through, each under a real surface place:
// the Wash over the arrival shelf, the harbor and the Gull's Reach wreck (the sea pours through
// them), and the North Road's valley over the Chainward. Daylight falls out of each as a soft
// raymarched shaft with dust in it; at the top of each is the sky, seen as a pale glow.
//
// One vertex-coloured crust mesh (underside, opening walls, top and skirt) plus Kit-built
// hanging stone, merged; shafts, falls and sky caps stay unmerged for their shaders.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { clamp, lerp, smoothstep, seededRandom } from '../core/util.js';
import { Noise2D } from '../core/noise.js';
import { Kit, hash3 } from './kit.js';
import { KIT_MATERIALS } from './style.js';
import { mergeStatic } from './merge.js';
import { SPIRE } from '../data/riftSpire.js';

export const RIFT_MAP = { ox: 6000, oz: 6000, scale: 0.55 };
export const ASCENT_HOLE_R = 21;
// The crust's upper face: every opening runs up to the daylight here.
export const CRUST_TOP = 206;
const STEP = 6; // one stratum: the shelves of the underside step by this much
const GRID = 680; // the detailed square over the basin
const REACH = 1450; // how far the crust carries on beyond it, in widening cells

const noise = new Noise2D(6061);
const _c = new THREE.Color();
const _d = new THREE.Color();

export function surfaceToRift(sx, sz) {
  return { x: RIFT_MAP.ox + sx * RIFT_MAP.scale, z: RIFT_MAP.oz + sz * RIFT_MAP.scale };
}

export function riftToSurface(rx, rz) {
  return { x: (rx - RIFT_MAP.ox) / RIFT_MAP.scale, z: (rz - RIFT_MAP.oz) / RIFT_MAP.scale };
}

export function inAscentHole(x, z, r = ASCENT_HOLE_R) {
  return Math.hypot(x - SPIRE.x, z - SPIRE.z) < r;
}

// ------------------------------------------------------------------ the ravines
// Polylines in surface coordinates (so each lies under the place that explains it), with a
// half-width in Rift metres. `sea` ravines carry the sea down with the light.
export const RAVINES = [
  { id: 'wash', name: 'The Wash', kind: 'light', hw: 5.2, light: 1.0, pts: [[-70, -298], [-34, -306], [0, -311], [34, -315], [64, -305]] },
  { id: 'harbor', name: 'the harbor', kind: 'sea', hw: 4.6, light: 0.8, fall: 0.5, pts: [[24, -148], [34, -176], [41, -204], [54, -230]] },
  { id: 'gulls', name: "the Gull's Reach", kind: 'sea', hw: 4.2, light: 0.7, fall: 0.45, pts: [[136, -326], [160, -356], [178, -390]] },
  { id: 'north_road', name: 'the North Road', kind: 'roots', hw: 4.4, light: 0.85, pts: [[-6, 126], [-10, 150], [-14, 174], [-20, 200], [-26, 228], [-30, 252]] },
].map((r) => ({ ...r, rift: r.pts.map(([x, z]) => { const p = surfaceToRift(x, z); return [p.x, p.z]; }) }));

// Where the crust has let go of a piece since the fall: a fresh hollow overhead and the
// rubble of it on the floor below (world/riftFloor.js lays the rubble).
export const CRUST_SCARS = [
  { x: 5848, z: 5872, r: 15, d: 9 },
  { x: 6136, z: 5906, r: 13, d: 8 },
  { x: 5940, z: 5806, r: 12, d: 7 },
  { x: 6150, z: 6040, r: 11, d: 7 },
  { x: 5822, z: 6010, r: 12, d: 8 },
  { x: 6066, z: 5836, r: 10, d: 6 },
];

function segInfo(px, pz, pts) {
  let best = Infinity, total = 0, bestT = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) lens.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = lens.reduce((a, b) => a + b, 0);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const t = clamp(((px - ax) * vx + (pz - az) * vz) / l2, 0, 1);
    const d = Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
    if (d < best) { best = d; bestT = (total + t * lens[i - 1]) / L; }
    total += lens[i - 1];
  }
  return { d: best, t: bestT, L };
}

// Half-width of a ravine at fraction t of its length: pinched to a crack at both ends, and
// wandering a little so neither lip is a drawn line.
function ravineHalf(r, t, x, z) {
  const taper = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
  return r.hw * (0.3 + 0.7 * taper) * (0.82 + 0.36 * (noise.noise(x * 0.07 + 11, z * 0.07) * 0.5 + 0.5));
}

export function ravineAt(x, z, pad = 0) {
  for (const r of RAVINES) {
    const s = segInfo(x, z, r.rift);
    if (s.d < ravineHalf(r, s.t, x, z) + pad) return r;
  }
  return null;
}

function opening(x, z) {
  const hd = Math.hypot(x - SPIRE.x, z - SPIRE.z);
  if (hd < ASCENT_HOLE_R + noise.noise(x * 0.12, z * 0.12) * 1.6) return 'hole';
  return ravineAt(x, z);
}

// What lies above a point of the roof: the sea, the town, or open land.
export function crustRegion(world, x, z) {
  const s = riftToSurface(x, z);
  const h = world.terrain ? world.terrain.heightAt(s.x, s.z) : 5;
  if (h < 0.5) return 'sea';
  if (Math.abs(s.x) < 98 && s.z > -78 && s.z < 100) return 'town';
  return 'land';
}

// ------------------------------------------------------------------ the underside's height
function vaultY(world, x, z) {
  const s = riftToSurface(x, z);
  const h = world.terrain ? clamp(world.terrain.heightAt(s.x, s.z), 0, 55) : 0;
  // Thicker crust under high ground: the hills above hang lower here.
  let y = 149 - h * 0.16;
  const hd = Math.hypot(x - SPIRE.x, z - SPIRE.z);
  y -= smoothstep(26, 200, hd) * 37;
  // The collar sags toward the Ascent so its crown rises into the shaft.
  y -= (1 - smoothstep(ASCENT_HOLE_R, ASCENT_HOLE_R + 30, hd)) * 12;
  const dist = Math.hypot(x - RIFT_MAP.ox, z - RIFT_MAP.oz);
  y -= smoothstep(160, 250, dist) * 13;
  // Broad inverted landforms: long ridges and basins of the crust, no smaller than a castle.
  y += noise.fbm(x * 0.0075, z * 0.0075, 3) * 10 * smoothstep(ASCENT_HOLE_R + 8, 70, hd);
  // Past the rim the crust lifts a little over the void, then far out comes down toward the
  // horizon, so it meets the haze there rather than ending in the air.
  y += smoothstep(250, 520, dist) * 18 - smoothstep(620, 1400, dist) * 125;
  return y;
}

// The underside at (x, z): its height, the bed it exposes and how far up a riser it is.
const _sample = { y: 0, bed: 0, rise: 0, scar: 0 };
function crustSample(world, x, z, out = _sample) {
  const v = vaultY(world, x, z);
  // Strata shelves: flat undersides and short risers, the cliffs above turned over. The
  // contours wander slowly, so each shelf is a broad plate of one bed.
  const warp = noise.noise(x * 0.011 + 7, z * 0.011 - 3) * 2.4;
  const q = (v + warp) / STEP;
  const k = Math.floor(q);
  const rise = smoothstep(0.6, 1.0, q - k);
  let y = (k + rise) * STEP - warp;
  // Mid-scale relief on the plates: bosses and hollows a few metres across, never as deep as
  // a bed, so close views hold up without breaking the strata.
  y += noise.noise(x * 0.085, z * 0.085) * 0.9 + noise.noise(x * 0.21 + 3, z * 0.21 - 5) * 0.35;
  let scar = 0;
  for (const s of CRUST_SCARS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) {
      const f = 1 - (d / s.r) ** 2;
      y += s.d * f;
      scar = Math.max(scar, f);
    }
  }
  out.y = clamp(y, 60, 176);
  out.bed = k + (rise > 0.5 ? 1 : 0);
  out.rise = rise;
  out.scar = scar;
  return out;
}

export function ceilingYAt(world, x, z) {
  return crustSample(world, x, z).y;
}

// ------------------------------------------------------------------ strata
// One bed per STEP metres of height. The beds alternate light and dark so they read from the
// floor, run cold and slaty low down (drowned) and warm toward the soil near the top, with a
// marker bed of ironstone or chalk every few.
const DEEP = new THREE.Color('#4b4c55');
const HIGH = new THREE.Color('#6d5d49');
const IRON = new THREE.Color('#5f4a3b');
const CHALK = new THREE.Color('#857f74');
const SOIL = new THREE.Color('#4a3828');
const TURF = new THREE.Color('#4f6236');
const SEAM = new THREE.Color('#9a927f');
const WET = new THREE.Color('#38434c');
const FRESH = new THREE.Color('#8b8173');
const VALUE = [0.84, 1.1, 0.93, 1.16, 0.8, 1.03, 0.9, 1.12];

// The colour of bed k (the stratum between k and k+1 steps up).
export function bedColor(out, k) {
  const depth = smoothstep(84, 170, k * STEP);
  out.copy(DEEP).lerp(HIGH, depth);
  const m = ((k % 9) + 9) % 9;
  if (m === 4) out.lerp(IRON, 0.65);
  else if (m === 7) out.lerp(CHALK, 0.55);
  return out.multiplyScalar(VALUE[((k % 8) + 8) % 8]);
}

// Any exposed face: the bed at its height, with a pale seam where two beds meet.
export function strataColor(out, x, y, z) {
  const t = (y + 1.6 * noise.noise(x * 0.02, z * 0.02)) / STEP;
  const k = Math.floor(t);
  bedColor(out, k);
  if (t - k > 0.9) out.lerp(SEAM, 0.3);
  return out.multiplyScalar(0.97 + hash3(x, y * 0.31, z) * 0.06);
}

function regionTint(out, region, y, x, z) {
  if (region === 'sea') out.lerp(WET, 0.28 + 0.12 * noise.noise(x * 0.05, z * 0.05));
  else if (region === 'land') out.lerp(SOIL, 0.12 * smoothstep(110, 150, y));
  return out;
}

// The walls of an opening: strata the whole way up, then soil under the turf at the top,
// paling toward the daylight that falls down them.
function wallColor(out, x, y, z, region) {
  strataColor(out, x, y, z);
  const top = CRUST_TOP;
  if (region === 'land' || region === 'town') {
    out.lerp(SOIL, smoothstep(top - 16, top - 7, y));
    if (y > top - 2.5) out.lerp(TURF, 0.8);
  } else out.lerp(WET, smoothstep(top - 30, top - 4, y) * 0.5);
  return out.multiplyScalar(1 + 0.45 * smoothstep(top - 60, top, y));
}

function pushV(pos, col, x, y, z, c) {
  pos.push(x, y, z);
  col.push(c.r, c.g, c.b);
}

// Grid lines: even cells over the basin, then cells widening out to REACH so the crust runs on
// into the fog with no edge to find.
function axis(o, inner) {
  const outer = 18, step = GRID / inner;
  const out = [];
  let w = step, d = GRID / 2;
  const tail = [];
  for (let i = 0; i < outer; i++) {
    w *= 1.24;
    d = Math.min(REACH, d + w);
    tail.push(d);
  }
  tail[outer - 1] = REACH;
  for (let i = outer - 1; i >= 0; i--) out.push(o - tail[i]);
  for (let i = 0; i <= inner; i++) out.push(o - GRID / 2 + i * step);
  for (let i = 0; i < outer; i++) out.push(o + tail[i]);
  return out;
}

function buildCrust(world, low) {
  const inner = low ? 150 : 228;
  const xs = axis(RIFT_MAP.ox, inner), zs = axis(RIFT_MAP.oz, inner);
  const n = xs.length - 1, nv = n + 1;
  const ys = new Float32Array(nv * nv), beds = new Int16Array(nv * nv), rises = new Float32Array(nv * nv), scars = new Float32Array(nv * nv);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nv; i++) {
      const s = crustSample(world, xs[i], zs[j]);
      ys[j * nv + i] = s.y;
      beds[j * nv + i] = s.bed;
      rises[j * nv + i] = s.rise;
      scars[j * nv + i] = s.scar;
    }
  }
  const open = new Array(n * n);
  const region = new Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      open[j * n + i] = opening(cx, cz);
      region[j * n + i] = crustRegion(world, cx, cz);
    }
  }
  const pos = [], col = [];
  const corner = (i, j) => [xs[i], ys[j * nv + i], zs[j]];
  const ca = new THREE.Color();
  const tri = (a, b, c, color) => {
    pushV(pos, col, ...a, color);
    pushV(pos, col, ...b, color);
    pushV(pos, col, ...c, color);
  };
  const openAt = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? null : open[j * n + i]);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (open[j * n + i]) continue;
      const a = corner(i, j), b = corner(i + 1, j), c = corner(i + 1, j + 1), d = corner(i, j + 1);
      const ia = j * nv + i, ib = ia + 1, ic = ia + nv + 1, id = ia + nv;
      const reg = region[j * n + i];
      // A plate is one bed, one colour; a riser shows the beds it cuts, triangle by triangle.
      for (const [p, q, r, vi] of [[a, b, d, [ia, ib, id]], [b, c, d, [ib, ic, id]]]) {
        const yc = (p[1] + q[1] + r[1]) / 3;
        const flat = vi.every((v) => (rises[v] < 0.04 || rises[v] > 0.96) && beds[v] === beds[vi[0]]);
        if (flat) bedColor(ca, beds[vi[0]]).multiplyScalar(0.98 + hash3(p[0], 1, p[2]) * 0.04);
        else strataColor(ca, (p[0] + q[0] + r[0]) / 3, yc, (p[2] + q[2] + r[2]) / 3);
        regionTint(ca, reg, yc, p[0], p[2]);
        const sc = Math.max(scars[vi[0]], scars[vi[1]], scars[vi[2]]);
        // where the crust let go the stone is fresh: paler, unweathered
        if (sc > 0) ca.lerp(FRESH, 0.4 * Math.min(1, sc * 1.6));
        // (a,b,d) / (b,c,d) wind downward so the underside faces the floor.
        tri(p, q, r, ca);
      }
      for (const [o, p0, p1] of [[openAt(i, j - 1), a, b], [openAt(i + 1, j), b, c], [openAt(i, j + 1), c, d], [openAt(i - 1, j), d, a]]) {
        if (o) openingWall(pos, col, p0, p1, reg);
      }
      // the slab's outer edge
      if (i === 0) skirt(pos, col, d, a);
      if (i === n - 1) skirt(pos, col, b, c);
      if (j === 0) skirt(pos, col, a, b);
      if (j === n - 1) skirt(pos, col, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// A wall from an underside edge up through the crust, in courses so the strata show, each
// course pushed in or out a little so the face is broken rock rather than a sheet.
function openingWall(pos, col, p0, p1, region) {
  const top = CRUST_TOP;
  const bottom = Math.min(p0[1], p1[1]);
  const rows = Math.max(2, Math.ceil((top - bottom) / 3));
  const nx = p1[2] - p0[2], nz = -(p1[0] - p0[0]);
  const nl = Math.hypot(nx, nz) || 1;
  const ex = nx / nl, ez = nz / nl;
  const at = (p, r) => {
    const y = r === 0 ? p[1] : lerp(bottom, top, r / rows);
    const push = r === 0 || r === rows ? 0 : noise.noise(p[0] * 0.21 + y * 0.13, p[2] * 0.21) * 1.1;
    return [p[0] + ex * push, y, p[2] + ez * push];
  };
  const c0 = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const a = at(p0, r), b = at(p1, r), c = at(p1, r + 1), d = at(p0, r + 1);
    wallColor(c0, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2, region);
    pushV(pos, col, ...a, c0); pushV(pos, col, ...b, c0); pushV(pos, col, ...c, c0);
    pushV(pos, col, ...a, c0); pushV(pos, col, ...c, c0); pushV(pos, col, ...d, c0);
  }
}

// The cut edge of the slab, far out in the haze.
function skirt(pos, col, p0, p1) {
  const c0 = new THREE.Color('#2c2826');
  const a = p0, b = p1, c = [p1[0], CRUST_TOP, p1[2]], d = [p0[0], CRUST_TOP, p0[2]];
  pushV(pos, col, ...a, c0); pushV(pos, col, ...b, c0); pushV(pos, col, ...c, c0);
  pushV(pos, col, ...a, c0); pushV(pos, col, ...c, c0); pushV(pos, col, ...d, c0);
}

// The material every piece of the crust shares. The underside never sees the key light; a
// vertex-tinted fill keeps the strata legible, and only part of the fog is applied overhead so
// the beds hold. Normals come from the (non-indexed) geometry rather than screen derivatives,
// so a sliver triangle can never shade to NaN.
function crustMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  mat.name = 'rift_crust';
  mat.color.set('#6a6a6a');
  mat.emissive.set('#ffffff');
  mat.emissiveIntensity = 0.5;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;',
    ).replace(
      '#include <fog_fragment>',
      // Seen from inside the slab (its back faces) the crust is solid dark rock, never a view.
      'if (!gl_FrontFacing) gl_FragColor.rgb = vec3(0.035, 0.031, 0.028);\nvec3 roofLit = gl_FragColor.rgb;\n#include <fog_fragment>\ngl_FragColor.rgb = mix(roofLit, gl_FragColor.rgb, mix(0.42, 1.0, smoothstep(fogNear + (fogFar - fogNear) * 0.35, fogFar, vFogDepth)));\nif (!gl_FrontFacing) gl_FragColor.rgb = mix(vec3(0.035, 0.031, 0.028), gl_FragColor.rgb, 0.25);',
    );
    // The crust reaches 1450 m out from the Rift's middle, inside the far plane of Thornwood's
    // north shore, where its dark back faces stood on the sea horizon. From the surface (the
    // camera under x 3000, world/rift.js inRiftView) nothing of it is drawn: its vertices are
    // put outside the clip volume, so the one program serves both and nothing is hidden or
    // shown (that would leave it out of the warm-up's compile).
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  if (cameraPosition.x < 3000.0) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
    );
  };
  mat.customProgramCacheKey = () => 'rift-crust';
  return mat;
}

// The top of the slab: dark rock seen only from inside the crust (a camera that climbs past
// the underside meets stone, never sky).
function crustTop(mat) {
  const geo = new THREE.PlaneGeometry(REACH * 2, REACH * 2, 1, 1).rotateX(Math.PI / 2);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([0.17, 0.15, 0.14], i * 3);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(RIFT_MAP.ox, CRUST_TOP + 1.5, RIFT_MAP.oz);
  m.name = 'rift_crust_top';
  return m;
}

// ------------------------------------------------------------------ hanging stone
const HANG = {
  stone: '#4b4542', stone2: '#3d3836', edge: '#5f574d', earth: '#4a3a2c', root: '#2c211a', root2: '#372a20',
  moss: '#46583a', dark: '#211c1b', wet: '#3a4249', salt: '#8a8c86', pile: '#3a2d22', iron: '#2b2723',
  mason: '#6c665d', mason2: '#5b564f', plaster: '#7d766a', bronze: '#5c4a32',
};

// A hanging cluster: one long dripstone and its smaller kin, rooted in a boss of rock.
// It is the bed it hangs from, a shade darker for the water running down it.
const _drip = new THREE.Color();
function dripstone(k, x, y, z, s, rng, wet) {
  strataColor(_drip, x, y + 1, z).multiplyScalar(0.82);
  if (wet) _drip.lerp(WET, 0.35);
  const c1 = '#' + _drip.getHexString();
  const c2 = '#' + _drip.multiplyScalar(0.86).getHexString();
  k.inverted(x, y + 1.2, z, (h) => {
    h.prism(0, -0.4, 0, 2.6 * s, 1.8 * s, c1, { sides: 7, top: 0.55, ry: rng() * 3 });
    h.prism(0, 1.2 * s, 0, 1.2 * s, (6 + rng() * 7) * s, c1, { sides: 6, top: 0.06, ry: rng() * 3 });
    const m = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < m; i++) {
      const a = rng() * Math.PI * 2, d = (1.1 + rng() * 1.3) * s;
      h.prism(Math.cos(a) * d, 0.2, Math.sin(a) * d, (0.3 + rng() * 0.45) * s, (1.8 + rng() * 4.5) * s, c2, { sides: 5, top: 0.1, ry: rng() * 3 });
    }
  }, rng() * 6);
}

// A root: tapering, kinked strands hanging from the underside, sometimes ending in a moss beard.
function root(k, x, y, z, len, rng, r0 = 0.3) {
  k.inverted(x, y + 0.3, z, (h) => {
    let px = 0, pz = 0, py = 0, r = r0 + rng() * 0.18;
    const segs = 4;
    for (let i = 0; i < segs; i++) {
      const sl = len / segs;
      const tilt = (rng() - 0.5) * 0.45;
      const turn = (rng() - 0.5) * 0.45;
      h.prism(px, py, pz, r, sl + 0.25, i % 2 ? 'root' : 'root2', { sides: 4, top: 0.72, rz: tilt, rx: turn });
      px -= Math.sin(tilt) * sl;
      pz += Math.sin(turn) * sl;
      py += Math.cos(tilt) * sl;
      r *= 0.72;
    }
    if (rng() < 0.35) h.prism(px, py - 0.5, pz, r * 2.6, 1.3, 'moss', { sides: 4, top: 0.4 });
  }, rng() * 6);
}

// A curtain of roots along a line where a tree line above found a seam in the crust.
function rootCurtain(k, world, x, z, len, yaw, rng, dense = 1) {
  const n = Math.max(4, Math.round(len * 1.1 * dense));
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1) - 0.5) * len + (rng() - 0.5) * 0.6;
    const px = x + Math.cos(yaw) * u + (rng() - 0.5) * 1.2, pz = z + Math.sin(yaw) * u + (rng() - 0.5) * 1.2;
    if (opening(px, pz)) continue;
    const y = ceilingYAt(world, px, pz);
    root(k, px, y, pz, 4 + rng() * 12 * (0.5 + 0.5 * Math.sin((i / n) * Math.PI)), rng, 0.26);
  }
}

// A pendant: a great hanging mass of the crust, bedded like the rest, with drips off its point.
function pendant(k, x, y, z, s, rng) {
  k.inverted(x, y + 1, z, (h) => {
    let r = 5 * s, py = 0;
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const th = (2.4 + rng() * 2.2) * s;
      h.prism((rng() - 0.5) * s, py, (rng() - 0.5) * s, r, th, i % 2 ? 'stone2' : 'stone', { sides: 6, top: 0.72 + rng() * 0.1, ry: rng() * 6, dr: r * (0.75 + rng() * 0.3) });
      py += th;
      r *= 0.66;
    }
    h.prism(0, py, 0, r, 4 * s, 'edge', { sides: 5, top: 0.05, ry: rng() * 6 });
  }, rng() * 6);
}

// Saltreach from below: a foundation wall's footing hanging out of the crust, a cellar floor
// broken open, the shaft of a well, a drain's bronze pipe.
function foundation(k, x, y, z, rng, kind) {
  k.at({ x, y, z, ry: rng() * Math.PI }, (b) => {
    if (kind === 0) {
      // footing courses of a wall, the lowest course stepped out
      b.masonry(0, -4.2, 0, 7 + rng() * 4, 4.6, 1.6, { c: 'mason', c2: 'mason2', course: 0.75 });
      b.slab(0, -4.8, 0, 7.6 + rng() * 4, 0.6, 2.2, 'mason2');
    } else if (kind === 1) {
      // a cellar's flagged floor, broken, with the stub of its walls going up into the rock
      b.slab(0, -0.9, 0, 6, 0.6, 5, 'mason');
      for (let i = 0; i < 5; i++) b.slab(-2.4 + i * 1.2, -1.3 - rng() * 0.6, (rng() - 0.5) * 3, 1.1, 0.4, 1.4, 'mason2', { rz: (rng() - 0.5) * 0.3 });
      b.slab(-3, -2.4, 0, 0.6, 2.4, 5, 'plaster');
    } else if (kind === 2) {
      // a well's shaft, its curb still ringed, open at the bottom
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.slab(Math.cos(a) * 1.3, -6, Math.sin(a) * 1.3, 1.0, 6, 0.4, 'mason2', { ry: -a + Math.PI / 2 });
      }
      b.slab(0, -6.3, 0, 3.4, 0.3, 3.4, 'mason');
      b.slab(0, -6.2, 0, 1.9, 0.32, 1.9, 'dark');
    } else {
      // a drain run in its culvert, the bronze pipe broken off
      b.slab(0, -1.8, 0, 1.6, 1.8, 9, 'mason2');
      b.prism(0, -3.8, 4.2, 0.35, 2.2, 'bronze', { sides: 6, layer: 'metal' });
    }
  });
}

// The harbor's piers were driven into the seabed; from below their pilings come through.
function pilings(k, world, x, z, yaw, rng) {
  for (let i = 0; i < 6; i++) {
    const u = (i - 2.5) * 2.6;
    for (const side of [-1, 1]) {
      const px = x + Math.cos(yaw) * u - Math.sin(yaw) * side * 1.8, pz = z + Math.sin(yaw) * u + Math.cos(yaw) * side * 1.8;
      if (opening(px, pz)) continue;
      const y = ceilingYAt(world, px, pz);
      const len = 1.5 + rng() * 3.5;
      k.prism(px, y - len, pz, 0.32, len + 0.6, 'pile', { sides: 6, top: 0.9 });
      k.prism(px, y - len - 0.5, pz, 0.34, 0.6, 'iron', { sides: 6, top: 0.3, layer: 'metal' });
    }
  }
}

function decorate(world, low, mat) {
  const k = new Kit(HANG, { detail: low ? 0 : 1 });
  const rng = seededRandom(1488);
  const y = (x, z) => ceilingYAt(world, x, z);
  // Dripstone hangs where the beds step and water finds its way out along the riser: everywhere
  // over the basin, densest under the sea.
  const spots = [];
  const want = low ? 50 : 130;
  for (let t = 0; t < 6000 && spots.length < want; t++) {
    const a = rng() * Math.PI * 2, d = 30 + Math.sqrt(rng()) * 290;
    const x = RIFT_MAP.ox + Math.cos(a) * d, z = RIFT_MAP.oz + Math.sin(a) * d;
    if (opening(x, z) || inAscentHole(x, z, ASCENT_HOLE_R + 8) || ravineAt(x, z, 4)) continue;
    const here = y(x, z);
    const step = Math.max(Math.abs(here - y(x + 4, z)), Math.abs(here - y(x, z + 4)), Math.abs(here - y(x - 4, z)), Math.abs(here - y(x, z - 4)));
    const reg = crustRegion(world, x, z);
    const keep = step > 3 ? 1 : reg === 'sea' ? 0.2 : 0.04;
    if (rng() > keep) continue;
    if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 14)) continue;
    spots.push([x, z]);
    const low4 = Math.min(here, y(x + 4, z), y(x, z + 4), y(x - 4, z), y(x, z - 4));
    dripstone(k, x, low4, z, (0.9 + rng() * 1.0) * (reg === 'sea' ? 1.15 : 1), rng, reg === 'sea');
  }
  // Root curtains under the land, along seams where the woods above send their roots down.
  const curtains = low ? 18 : 52;
  const curtainSpots = [];
  for (let i = 0, t = 0; i < curtains && t < 3000; t++) {
    const a = rng() * Math.PI * 2, d = 40 + Math.sqrt(rng()) * 270;
    const x = RIFT_MAP.ox + Math.cos(a) * d, z = RIFT_MAP.oz + Math.sin(a) * d;
    if (crustRegion(world, x, z) !== 'land' || opening(x, z) || ravineAt(x, z, 3)) continue;
    const len = 6 + rng() * 10, yaw = rng() * Math.PI;
    rootCurtain(k, world, x, z, len, yaw, rng, low ? 0.5 : 1);
    curtainSpots.push({ x, z, len, yaw });
    i++;
  }
  // Pendants: great hanging masses of the crust, out over the open basin and the rim.
  for (let i = 0, t = 0; i < (low ? 8 : 22) && t < 2000; t++) {
    const a = rng() * Math.PI * 2, d = 70 + rng() * 260;
    const x = RIFT_MAP.ox + Math.cos(a) * d, z = RIFT_MAP.oz + Math.sin(a) * d;
    if (opening(x, z) || ravineAt(x, z, 10)) continue;
    pendant(k, x, y(x, z), z, 0.9 + rng() * 1.1, rng);
    i++;
  }
  // Every ravine: roots and drips along both lips, wetter where the sea comes through.
  for (const r of RAVINES) {
    const pts = r.rift;
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const n = Math.round(L / (low ? 7 : 3.2));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = along(pts, t);
      for (const side of [-1, 1]) {
        const hw = ravineHalf(r, t, p.x, p.z);
        const off = hw + 0.9 + rng() * 1.6;
        const x = p.x + p.nx * off * side, z = p.z + p.nz * off * side;
        if (opening(x, z)) continue;
        if (r.kind === 'sea') {
          if (rng() < 0.5) dripstone(k, x + p.nx * side * 2, y(x, z), z + p.nz * side * 2, 0.6 + rng() * 0.4, rng, true);
        } else root(k, x, y(x, z), z, 4 + rng() * 11, rng);
      }
    }
  }
  // Under the town: Saltreach's footings and cellars around the shaft, and on its walls.
  for (let i = 0; i < (low ? 10 : 26); i++) {
    const a = (i / 26) * Math.PI * 2 + rng() * 0.2;
    const r = ASCENT_HOLE_R + 6 + rng() * 34;
    const x = SPIRE.x + Math.cos(a) * r, z = SPIRE.z + Math.sin(a) * r;
    if (opening(x, z) || crustRegion(world, x, z) !== 'town') continue;
    foundation(k, x, y(x, z) + 0.4, z, rng, i % 4);
  }
  // In the shaft itself the cut goes straight through cellars: their vaults, shelves and
  // casks open to the light, and the footings of the houses above them.
  shaftCellars(k, low, rng);
  // Under the harbor: rows of the old pier pilings.
  for (const [x, z, yaw] of [[6008, 5935, 1.4], [6034, 5928, 1.3], [5978, 5932, 1.6], [6046, 5905, 1.1]]) {
    if (crustRegion(world, x, z) === 'sea') pilings(k, world, x, z, yaw, rng);
  }
  const g = k.build('rift_ceiling_hang');
  g.traverse((m) => { if (m.isMesh && m.material === KIT_MATERIALS.solid) m.material = mat; });
  world.scene.add(g);
  mergeStatic(world.scene, [g]);
  return { curtains: curtainSpots };
}

// A point and its normal at fraction t along a polyline.
function along(pts, t) {
  let L = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) { lens.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); L += lens[lens.length - 1]; }
  let s = t * L;
  for (let i = 1; i < pts.length; i++) {
    if (s <= lens[i - 1] || i === pts.length - 1) {
      const f = Math.min(1, s / lens[i - 1]);
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const dx = (bx - ax) / lens[i - 1], dz = (bz - az) / lens[i - 1];
      return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, dx, dz, nx: -dz, nz: dx };
    }
    s -= lens[i - 1];
  }
  return { x: pts[0][0], z: pts[0][1], dx: 1, dz: 0, nx: 0, nz: 1 };
}
export { along as ravinePoint };

// Cellars in section round the Ascent's shaft, between the strata and the turf.
function shaftCellars(k, low, rng) {
  const n = low ? 6 : 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const r = ASCENT_HOLE_R + 0.4;
    const floor = CRUST_TOP - 22 - (i % 3) * 5.5;
    k.at({ x: SPIRE.x + Math.cos(a) * r, y: floor, z: SPIRE.z + Math.sin(a) * r, ry: Math.PI / 2 - a }, (b) => {
      // the back wall and flagged floor, a vaulted ceiling cut in half
      const w = 5 + (i % 2) * 2;
      b.slab(0, -0.5, 0.8, w, 0.5, 3.2, 'mason');
      b.masonry(0, 0, 2.2, w, 3.4, 0.5, { c: 'mason', c2: 'mason2', course: 0.6 });
      b.arch(0, 2.2, 0.8, w - 0.6, { t: 0.5, depth: 3.0, rise: 1.2, c: 'mason2', segments: 6 });
      for (const sx of [-1, 1]) b.slab(sx * (w / 2 - 0.25), 0, 0.8, 0.5, 2.3, 3.0, 'mason2');
      if (i % 3 === 0) {
        // casks on their side against the back wall
        for (let j = 0; j < 3; j++) b.prism(-1.4 + j * 1.4, 0.55, 1.6, 0.5, 1.4, 'pile', { sides: 8, rx: Math.PI / 2 });
      } else if (i % 3 === 1) {
        b.slab(0, 1.2, 1.9, w - 1.2, 0.12, 0.6, 'pile');
        for (let j = 0; j < 4; j++) b.slab(-w / 2 + 1 + j * 1.1, 1.32, 1.9, 0.5, 0.5, 0.4, j % 2 ? 'plaster' : 'mason2');
      }
      // a house's footing above the cellar, under the turf
      b.masonry(0, 4.6, 1.6, w + 1.4, 3.2 + (i % 2) * 2, 1.4, { c: 'mason2', c2: 'mason', course: 0.8 });
    });
  }
}

// ------------------------------------------------------------------ the columns
// Where the floor ends five great pillars of the crust come down into the void: flared where
// they leave the roof, narrowing to a waist about the floor's height and on down to broken
// points far below, bedded like the crust and wrapped in the roots that followed them down.
export const COLUMNS = [[22, 268, 0.8], [118, 262, 0.95], [196, 282, 0.7], [262, 270, 0.85], [318, 286, 0.75]];

function columnGeometry(world, x, z, s, rng) {
  const top = ceilingYAt(world, x, z) + 8;
  const bottom = -150 - rng() * 40;
  const sides = 10;
  const rows = [];
  const H = top - bottom;
  const nRows = 40;
  let ox = 0, oz = 0;
  const seed = rng() * 100;
  for (let r = 0; r <= nRows; r++) {
    const v = r / nRows; // 0 at the point, 1 at the roof
    const y = bottom + v * H;
    // a long taper from the broken point, a waist about the floor's height, a flare into the
    // roof; harder beds stand out as ledges, softer ones are worn back
    const flare = smoothstep(0.7, 1.0, v) ** 1.8;
    const bedding = 1 + 0.12 * Math.sin(y * 0.55 + seed) + 0.08 * noise.noise(y * 0.08, seed);
    let rad = s * (0.5 + 6.4 * smoothstep(0.0, 0.6, v) + 28 * flare) * bedding;
    if (r === 0) rad = s * 0.2;
    ox += (rng() - 0.5) * 2.2 * (1 - flare);
    oz += (rng() - 0.5) * 2.2 * (1 - flare);
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const j = 1 + noise.noise(i * 0.9 + seed, y * 0.045) * 0.32 + (rng() - 0.5) * 0.1;
      ring.push([x + ox + Math.cos(a) * rad * j, y, z + oz + Math.sin(a) * rad * j]);
    }
    rows.push(ring);
  }
  const pos = [], col = [];
  const c0 = new THREE.Color();
  const rock = new THREE.Color('#4d4844');
  for (let r = 0; r < nRows; r++) {
    for (let i = 0; i < sides; i++) {
      const a = rows[r][i], b = rows[r][(i + 1) % sides], c = rows[r + 1][(i + 1) % sides], d = rows[r + 1][i];
      for (const [p, q, w] of [[a, c, b], [a, d, c]]) {
        const cx = (p[0] + q[0] + w[0]) / 3, cy = (p[1] + q[1] + w[1]) / 3, cz = (p[2] + q[2] + w[2]) / 3;
        // one rock: the crust's beds only whisper through, and it darkens into the void
        strataColor(c0, cx, cy, cz);
        c0.lerp(rock, 0.72).multiplyScalar(lerp(0.5, 1, smoothstep(-120, 60, cy)) * (0.94 + hash3(cx, cy, cz) * 0.12));
        pushV(pos, col, ...p, c0); pushV(pos, col, ...q, c0); pushV(pos, col, ...w, c0);
      }
    }
  }
  return { pos, col, top, rows, center: (r) => {
    const ring = rows[r];
    let cx = 0, cz = 0;
    for (const p of ring) { cx += p[0]; cz += p[2]; }
    return [cx / ring.length, ring[0][1], cz / ring.length];
  } };
}

function columns(world, low, mat) {
  const rng = seededRandom(2401);
  const pos = [], col = [];
  const k = new Kit(HANG, { detail: low ? 0 : 1 });
  for (const [deg, r, s] of COLUMNS) {
    const a = (deg * Math.PI) / 180;
    const x = RIFT_MAP.ox + Math.cos(a) * r, z = RIFT_MAP.oz + Math.sin(a) * r;
    const g = columnGeometry(world, x, z, s, rng);
    pos.push(...g.pos);
    col.push(...g.col);
    const rows = g.rows;
    // Roots that followed the pillar down from the woods above: a few thick ones winding round
    // it from the roof, lying on its face, thinning as they go.
    const strands = low ? 2 : 4;
    for (let n = 0; n < strands; n++) {
      let ph = (n / strands) * Math.PI * 2 + rng();
      const start = rows.length - 6, end = Math.max(8, start - 12 - Math.floor(rng() * 10));
      let thick = 1.1 * s + 0.3;
      for (let rr = start; rr > end; rr--) {
        const at = (ring, f) => {
          const i = Math.floor(f * ring.length) % ring.length;
          const [cx, , cz] = g.center(rr);
          const p = ring[i];
          // just proud of the face
          const dx = p[0] - cx, dz = p[2] - cz, l = Math.hypot(dx, dz) || 1;
          return [p[0] + (dx / l) * thick * 0.4, p[1], p[2] + (dz / l) * thick * 0.4];
        };
        const f0 = ((ph / (Math.PI * 2)) % 1 + 1) % 1;
        ph += 0.32;
        const f1 = ((ph / (Math.PI * 2)) % 1 + 1) % 1;
        const p = at(rows[rr], f0), q = at(rows[rr - 1], f1);
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, mz = (p[2] + q[2]) / 2;
        const len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        const rx = Math.atan2(Math.hypot(q[0] - p[0], q[2] - p[2]), p[1] - q[1]);
        k.at({ x: mx, y: my, z: mz, ry: Math.atan2(q[0] - p[0], q[2] - p[2]), rx }, (b) => b.block(0, 0, 0, thick, len + thick * 0.6, thick, rr % 2 ? 'root' : 'root2'));
        thick *= 0.93;
      }
    }
    if (!low) {
      // hard ledges at the waist, and drips off the flare's underside
      const waist = rows[Math.round(rows.length * 0.58)];
      for (let i = 0; i < 3; i++) {
        const p = waist[Math.floor(rng() * waist.length)];
        k.rock(p[0], p[1] - 1, p[2], 5.5 * s, 2.4 * s, 4.5 * s, 'stone2', { ry: rng() * 6 });
      }
      const flareRow = rows[Math.round(rows.length * 0.82)];
      for (let i = 0; i < 4; i++) {
        const p = flareRow[Math.floor(rng() * flareRow.length)];
        dripstone(k, p[0], p[1], p[2], 0.8 * s, rng, false);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rift_columns';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  world.scene.add(mesh);
  const g = k.build('rift_column_roots');
  g.traverse((m) => { if (m.isMesh && m.material === KIT_MATERIALS.solid) m.material = mat; });
  world.scene.add(g);
  mergeStatic(world.scene, [g]);
}

// ------------------------------------------------------------------ daylight
// The sky at the top of an opening: a pale glow, brightest along its middle, never a white
// card. It stands a little below the crust's top so the shaft's walls frame it.
const SKY_VERT = /* glsl */ `
  varying float vC;
  attribute float across;
  void main(){ vC = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uEdge; uniform vec3 uMid; varying float vC;
  void main(){
    float m = 1.0 - abs(vC);
    vec3 col = mix(uEdge, uMid, smoothstep(0.0, 0.9, m));
    gl_FragColor = vec4(col, 1.0);
  }`;

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uEdge: { value: new THREE.Color('#5d6a76') }, uMid: { value: new THREE.Color('#aeb8bf') } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, fog: false, side: THREE.DoubleSide,
  });
}

// A ribbon along a polyline at height y, `across` running -1..1 from lip to lip.
function ribbon(pts, half, y) {
  const pos = [], acr = [];
  const N = 40;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const a = along(pts, t0), b = along(pts, t1);
    const ha = half(t0), hb = half(t1);
    const A0 = [a.x - a.nx * ha, y, a.z - a.nz * ha], A1 = [a.x + a.nx * ha, y, a.z + a.nz * ha];
    const B0 = [b.x - b.nx * hb, y, b.z - b.nz * hb], B1 = [b.x + b.nx * hb, y, b.z + b.nz * hb];
    pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
    acr.push(-1, -1, 1, -1, 1, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('across', new THREE.Float32BufferAttribute(acr, 1));
  return geo;
}

function disc(cx, cz, r, y) {
  const pos = [], acr = [];
  const N = 32;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    pos.push(cx, y, cz, cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r);
    acr.push(0, 1, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('across', new THREE.Float32BufferAttribute(acr, 1));
  return geo;
}

// A shaft of light, raymarched through its bounding box: soft at its edges, bright where it
// leaves the crust and gone well before the floor, with slow streaks of dust drifting through
// it. The camera close by sees almost nothing of it, so walking toward the light never fills
// the screen.
const BEAM_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const BEAM_FRAG = /* glsl */ `
  uniform vec2 uPts[8]; uniform float uHw[8]; uniform int uN;
  uniform float uTop; uniform float uUnder; uniform float uBottom;
  uniform vec3 uColor; uniform float uStrength; uniform float uTime; uniform vec2 uSlant;
  uniform vec3 uMin; uniform vec3 uMax;
  varying vec3 vWorld;
  float beam(vec3 p){
    vec2 q = p.xz - uSlant * (uTop - p.y);
    float best = 1e6; float hw = 1.0;
    for (int i = 0; i < 7; i++) {
      if (i >= uN - 1) break;
      vec2 a = uPts[i], b = uPts[i + 1];
      vec2 v = b - a; float l2 = max(dot(v, v), 1e-3);
      float t = clamp(dot(q - a, v) / l2, 0.0, 1.0);
      float d = length(q - (a + v * t));
      if (d < best) { best = d; hw = mix(uHw[i], uHw[i + 1], t); }
    }
    // below the crust the light spreads a little and softens
    float spread = 1.0 + 0.35 * clamp((uUnder - p.y) / 60.0, 0.0, 1.0);
    hw *= spread;
    float e = best / hw;
    float edge = exp(-e * e * 2.6);
    float v = clamp((p.y - uBottom) / max(uTop - uBottom, 1.0), 0.0, 1.0);
    float fall = smoothstep(0.0, 0.75, v) * smoothstep(0.0, 0.25, v);
    float rays = 0.86 + 0.14 * sin(q.x * 0.31 + sin(q.y * 0.23) * 2.0 + uTime * 0.05) * sin(q.y * 0.27 - uTime * 0.04);
    return edge * fall * rays / spread;
  }
  void main(){
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - ro);
    vec3 sgn = vec3(rd.x >= 0.0 ? 1.0 : -1.0, rd.y >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
    vec3 inv = sgn / max(abs(rd), vec3(1e-5));
    vec3 t0s = (uMin - ro) * inv, t1s = (uMax - ro) * inv;
    vec3 tn = min(t0s, t1s), tf = max(t0s, t1s);
    float t0 = max(max(tn.x, tn.y), max(tn.z, 0.0));
    float t1 = min(min(tf.x, tf.y), tf.z);
    if (!(t1 > t0)) discard;
    const int N = 20;
    float dt = (t1 - t0) / float(N);
    float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float acc = 0.0;
    for (int i = 0; i < N; i++) {
      float t = t0 + dt * (float(i) + jit);
      vec3 p = ro + rd * t;
      acc += beam(p) * smoothstep(4.0, 34.0, t) * dt;
    }
    // a shaft reads from the side; looking straight up it must not flood the view
    float a = acc * uStrength * (0.45 + 0.55 * (1.0 - abs(rd.y)));
    a = 1.0 - exp(-a);
    gl_FragColor = vec4(uColor * a * 0.85, 1.0);
  }`;

function beam(pts, hws, top, under, bottom, strength, color, slant = [0.06, 0.04]) {
  const n = pts.length;
  const P = [], HW = [];
  for (let i = 0; i < 8; i++) {
    const p = pts[Math.min(i, n - 1)];
    P.push(new THREE.Vector2(p[0], p[1]));
    HW.push(hws[Math.min(i, n - 1)]);
  }
  // The footprint at the bottom has drifted by the slant (the light leans as it falls), and the
  // light spreads a third wider below the crust: the box holds all of it.
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const pad = Math.max(...hws) * 2.4 + 4;
  for (const [x, z] of pts) {
    for (const s of [0, top - bottom]) {
      const px = x + slant[0] * s, pz = z + slant[1] * s;
      x0 = Math.min(x0, px - pad); x1 = Math.max(x1, px + pad);
      z0 = Math.min(z0, pz - pad); z1 = Math.max(z1, pz + pad);
    }
  }
  const min = new THREE.Vector3(x0, bottom, z0), max = new THREE.Vector3(x1, top, z1);
  const uniforms = {
    uPts: { value: P }, uHw: { value: HW }, uN: { value: n },
    uTop: { value: top }, uUnder: { value: under }, uBottom: { value: bottom },
    uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uTime: { value: 0 },
    uSlant: { value: new THREE.Vector2(slant[0], slant[1]) }, uMin: { value: min }, uMax: { value: max },
  };
  // Two faces of one box sharing the uniforms: outside, the near face is the entry and lets
  // nearer masonry hide the light; inside, only the far face is left to draw from.
  const make = (side) => new THREE.ShaderMaterial({
    uniforms, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side,
  });
  const front = make(THREE.FrontSide), back = make(THREE.BackSide);
  const size = max.clone().sub(min);
  const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), front);
  m.position.copy(min).add(max).multiplyScalar(0.5);
  m.renderOrder = 4;
  m.name = 'rift_daylight';
  m.userData.box = { min, max, front, back };
  return m;
}

// Dust turning in the light: motes inside a shaft's footprint, sinking slowly and fading out
// where the light does.
const MOTE_VERT = /* glsl */ `
  attribute vec4 seed;
  uniform float uTime; uniform float uTop; uniform float uBottom; uniform float uScale;
  varying float vA;
  void main(){
    float span = uTop - uBottom;
    float y = uBottom + mod(seed.y - uTime * (0.5 + seed.w * 0.8), span);
    vec3 p = vec3(position.x + sin(uTime * 0.21 + seed.x) * 1.4, y, position.z + cos(uTime * 0.17 + seed.z) * 1.4);
    float v = (y - uBottom) / span;
    vA = smoothstep(0.0, 0.5, v) * (1.0 - smoothstep(0.9, 1.0, v)) * (0.55 + 0.45 * sin(uTime * 1.3 + seed.x * 7.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(uScale * (0.08 + seed.w * 0.07) / -mv.z, 1.0, 5.0);
    vA *= smoothstep(3.0, 12.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor; varying float vA;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; gl_FragColor = vec4(uColor * vA * (1.0 - d * 4.0) * 0.7, 1.0); }`;

function motes(pts, hws, top, bottom, n, rng) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const p = along(pts, rng());
    const hw = hws[Math.min(hws.length - 1, Math.floor(rng() * hws.length))];
    const off = (rng() * 2 - 1) * hw * 0.8;
    pos.set([p.x + p.nx * off, 0, p.z + p.nz * off], i * 3);
    seed.set([rng() * 6.28, rng() * (top - bottom), rng() * 6.28, rng()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTop: { value: top }, uBottom: { value: bottom }, uScale: { value: 600 }, uColor: { value: new THREE.Color('#fff2d8') } },
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const m = new THREE.Points(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 5;
  m.name = 'rift_daylight_motes';
  return m;
}

// ------------------------------------------------------------------ the sea coming through
// A thick curtain of falling water: three sheets one behind another, streaming fast, broken at
// its edges and softened where it nears the camera.
const FALL_VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FALL_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uSpeed; uniform float uLen;
  uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
  varying vec2 vUv; varying vec3 vW;
  void main(){
    float y = vUv.y * uLen;
    float streak = sin(vUv.x * 37.0 + sin(vUv.x * 11.0) * 2.0) * 0.5 + 0.5;
    float flow = fract(y * 0.045 + uTime * 0.55 * uSpeed + streak * 0.3);
    float sheet = 0.55 + 0.45 * smoothstep(0.2, 0.8, flow) * streak;
    float edge = smoothstep(0.0, 0.16 + 0.1 * sin(y * 0.2 + uTime), vUv.x) * smoothstep(1.0, 0.84 - 0.1 * sin(y * 0.17 - uTime), vUv.x);
    float head = smoothstep(1.0, 0.985, vUv.y);
    float tail = smoothstep(0.0, 0.08, vUv.y);
    float lit = 0.55 + 0.45 * smoothstep(0.35, 1.0, vUv.y);
    float a = (0.08 + sheet * 0.2) * edge * head * tail;
    vec3 col = mix(uColor, vec3(0.56, 0.63, 0.69), sheet * 0.4) * lit;
    float dist = length(cameraPosition - vW);
    a *= smoothstep(5.0, 18.0, dist);
    col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist) * 0.85);
    gl_FragColor = vec4(col, a);
  }`;

function fallMaterial(speed, len) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#3f5262') }, uSpeed: { value: speed }, uLen: { value: len },
      uFog: { value: new THREE.Color('#3f3a55') }, uFogNear: { value: 20 }, uFogFar: { value: 300 } },
    vertexShader: FALL_VERT, fragmentShader: FALL_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

// Mist where the water lands: a few soft billboards that thin out as you walk into them.
const MIST_VERT = /* glsl */ `
  varying vec2 vUv; varying float vD;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    mv.xy += position.xy * s;
    vD = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const MIST_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv; varying float vD;
  void main(){
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * uAlpha * (0.8 + 0.2 * sin(uTime * 0.7 + vUv.x * 6.0));
    a *= smoothstep(4.0, 20.0, vD);
    gl_FragColor = vec4(uColor, a);
  }`;

function mist(x, y, z, w, h, rng) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#7e8896') }, uAlpha: { value: 0.16 }, uTime: { value: 0 } },
    vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.position.set(x + (rng() - 0.5) * w * 0.6, y + h * (0.25 + i * 0.22), z + (rng() - 0.5) * w * 0.6);
    m.scale.set(w * (1.2 - i * 0.12), h * 0.7, 1);
    m.frustumCulled = false;
    m.renderOrder = 6;
    g.add(m);
  }
  g.userData.mat = mat;
  g.name = 'rift_fall_mist';
  return g;
}

// The plunge pool the falls have worn into the floor: dark water with rings running out.
const POOL_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uFoam; varying vec2 vUv;
  void main(){
    vec2 c = vUv - 0.5; float r = length(c) * 2.0;
    float ring = sin(r * 18.0 - uTime * 3.0) * 0.5 + 0.5;
    float foam = (1.0 - smoothstep(0.0, 0.55, r)) * (0.5 + 0.5 * ring);
    vec3 col = mix(uDeep, uFoam, foam * 0.6 + ring * 0.08);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

function pool(x, y, z, r) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#2c3a47') }, uFoam: { value: new THREE.Color('#7d8f9d') } }]),
    vertexShader: /* glsl */ `varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: '#include <fog_pars_fragment>\n' + POOL_FRAG,
    fog: true,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), mat);
  m.position.set(x, y, z);
  m.name = 'rift_fall_pool';
  return m;
}

function waterfall(world, r, low, anims, rng) {
  // the sea comes through where the ravine is widest
  const t = 0.5;
  const p = along(r.rift, t);
  const hw = ravineHalf(r, t, p.x, p.z);
  const under = ceilingYAt(world, p.x + p.nx * (hw + 2), p.z + p.nz * (hw + 2));
  const floor = world.terrain.heightAt(p.x, p.z);
  const abyss = floor < -20;
  const top = CRUST_TOP - 1;
  const bottom = abyss ? -140 : floor + 0.1;
  const len = top - bottom;
  // along the ravine the water is as long as the gap is wide; across it, a few metres deep
  const wl = hw * 2.4 * r.fall * 2, wd = Math.max(2.4, hw * 0.8);
  const ry = Math.atan2(p.dx, p.dz);
  const faces = low
    ? [[0, 0, wl, 0], [0, 0, wd, Math.PI / 2]]
    : [[0, wd / 2, wl, 0], [0, -wd / 2, wl, 0], [wl / 2, 0, wd, Math.PI / 2], [-wl / 2, 0, wd, Math.PI / 2], [0, 0, wl * 0.8, 0.12]];
  for (const [u, v, width, turn] of faces) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len, 1, 1), fallMaterial(1 + Math.abs(u + v) * 0.05 + turn, len));
    // u runs along the ravine, v across it
    m.position.set(p.x + p.dx * u + p.nx * v, (top + bottom) / 2, p.z + p.dz * u + p.nz * v);
    m.rotation.y = ry + Math.PI / 2 + turn;
    m.renderOrder = 3;
    m.name = 'rift_fall';
    world.scene.add(m);
    anims.push(m);
  }
  const w = wl;
  if (abyss) {
    const ms = mist(p.x, under - 60, p.z, w * 2.4, 40, rng);
    ms.userData.mat.uniforms.uAlpha.value = 0.1;
    world.scene.add(ms);
    anims.push(ms);
    return { x: p.x, z: p.z, floor, abyss, hw };
  }
  const ms = mist(p.x, floor, p.z, w * 2.2, 14, rng);
  world.scene.add(ms);
  anims.push(ms);
  if (!low) {
    const pl = pool(p.x, floor + 0.06, p.z, Math.max(wl, wd) * 0.7 + 1.5);
    world.scene.add(pl);
    anims.push(pl);
  }
  world.addLight(new THREE.Vector3(p.x, floor + 4, p.z), '#b9c9da', 0.9, 20, true, 0.6);
  return { x: p.x, z: p.z, floor, abyss, hw };
}

// ------------------------------------------------------------------ build
export function buildRiftCeiling(world, exclusions, state) {
  const low = !!(state && state.low);
  const mat = crustMaterial();
  const geo = buildCrust(world, low);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rift_ceiling';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  world.scene.add(mesh);
  world.scene.add(crustTop(mat));
  const hung = decorate(world, low, mat);
  columns(world, low, mat);
  const anims = [], beams = [];
  const rng = seededRandom(7001);
  const sky = skyMaterial();
  const falls = [];

  for (const r of RAVINES) {
    const half = (t) => {
      const p = along(r.rift, t);
      return ravineHalf(r, t, p.x, p.z) + 2.2;
    };
    world.scene.add(Object.assign(new THREE.Mesh(ribbon(r.rift, half, CRUST_TOP - 0.5), sky), { name: 'rift_sky_cap' }));
    // the shaft: its light spills below the crust and is gone long before the floor
    const pts = [], hws = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const p = along(r.rift, t);
      pts.push([p.x, p.z]);
      hws.push(ravineHalf(r, t, p.x, p.z) * 0.95);
    }
    let under = Infinity, floor = -Infinity;
    for (const [x, z] of pts) {
      under = Math.min(under, ceilingYAt(world, x, z));
      floor = Math.max(floor, world.terrain.heightAt(x, z));
    }
    const bottom = Math.max(floor + 14, under - 85);
    const b = beam(pts, hws, CRUST_TOP, under, bottom, (low ? 0.016 : 0.022) * r.light, '#f3ead7');
    world.scene.add(b);
    beams.push(b);
    anims.push(b);
    if (!low) {
      const m = motes(pts, hws, under + 6, bottom, 140, rng);
      world.scene.add(m);
      anims.push(m);
    }
    if (r.kind === 'sea') falls.push(waterfall(world, r, low, anims, rng));
    // where the light lands, a soft daylight wash on the ground (no visible cone)
    const mid = along(r.rift, 0.5);
    const g = world.terrain.heightAt(mid.x, mid.z);
    if (g > -8) world.addLight(new THREE.Vector3(mid.x, g + 10, mid.z), '#e9e2d2', 1.0, 34, false, 0.8);
  }

  // The Ascent's shaft: the sky at its top, light falling onto the crown of the tower.
  world.scene.add(Object.assign(new THREE.Mesh(disc(SPIRE.x, SPIRE.z, ASCENT_HOLE_R + 3, CRUST_TOP - 0.5), sky), { name: 'rift_sky_cap' }));
  const ground = state.spire?.ground ?? world.terrain.heightAt(SPIRE.x, SPIRE.z);
  const holeUnder = ceilingYAt(world, SPIRE.x + ASCENT_HOLE_R + 3, SPIRE.z);
  const hb = beam([[SPIRE.x, SPIRE.z], [SPIRE.x + 0.01, SPIRE.z]], [ASCENT_HOLE_R * 0.9, ASCENT_HOLE_R * 0.9], CRUST_TOP, holeUnder, ground + 78, low ? 0.008 : 0.011, '#f1eadb', [0.02, 0.0]);
  world.scene.add(hb);
  beams.push(hb);
  anims.push(hb);
  if (!low) {
    const m = motes([[SPIRE.x - 12, SPIRE.z], [SPIRE.x + 12, SPIRE.z]], [10, 10], holeUnder + 10, ground + 80, 120, rng);
    world.scene.add(m);
    anims.push(m);
  }
  world.addLight(new THREE.Vector3(SPIRE.x, ground + 124, SPIRE.z), '#e9e5d9', 2.0, 60, false, 2);

  if (state.sky) state.sky.hideDome = true;
  state.ceiling = { mesh, mat, anims, beams, falls, curtains: hung.curtains, time: 0 };
  return state.ceiling;
}

const _cam = new THREE.Vector3();
export function updateRiftCeiling(state, dt) {
  const c = state.ceiling;
  if (!c) return;
  c.time += dt;
  const scene = c.mesh && c.mesh.parent;
  const fog = scene && scene.fog;
  // In the basin the crust is the sky: the Rift's own dome stays hidden.
  if (state.sky) state.sky.hideDome = true;
  if (fog) {
    fog.near = Math.max(fog.near, 12);
    fog.far = Math.min(Math.max(fog.far, 260), 440);
  }
  for (const m of c.anims) {
    const mat = m.material || m.userData.mat;
    const u = mat && mat.uniforms;
    if (!u) continue;
    if (u.uTime) u.uTime.value = c.time;
    if (u.uFog && fog) {
      u.uFog.value.copy(fog.color);
      u.uFogNear.value = fog.near;
      u.uFogFar.value = fog.far;
    }
  }
  const cam = G.camera || (G.game && G.game.camera);
  if (cam) {
    _cam.copy(cam.position);
    for (const b of c.beams) {
      const { min, max, front, back } = b.userData.box;
      const inside = _cam.x > min.x - 0.5 && _cam.x < max.x + 0.5 && _cam.y > min.y - 0.5 && _cam.y < max.y + 0.5 && _cam.z > min.z - 0.5 && _cam.z < max.z + 0.5;
      b.material = inside ? back : front;
    }
  }
}
