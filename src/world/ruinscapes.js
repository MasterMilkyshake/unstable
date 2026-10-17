// Wilderness ruins and framed vistas: aqueducts, colonnades, collapsed
// towers, overlooks, waterfalls and golden autumn groves.
// Masonry comes from the shared kit and stands on the same site frame as its
// colliders. Groves and waterfall sheets stay instanced or animated meshes.
import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { familyFor } from './style.js';
import { mat } from './props.js';
import { seededRandom } from '../core/util.js';
import { regionAtPoint } from '../data/world.js';
import { LANDFORMS } from '../data/landforms.js';
import { ROADS } from '../data/roads.js';
import { samplePath } from './paths.js';
import { G } from '../core/globals.js';
import { LIGHT_COLORS } from './style.js';
import {
  LAVA_FLOWS,
  PLUMES,
  SOUNDING_LINES,
  AQUEDUCTS,
  COLONNADES,
  COLLAPSED_TOWERS,
  OVERLOOKS,
  WATERFALLS,
  AUTUMN_GROVES,
} from '../data/vistas.js';
import { excludedAt } from './exclusionIndex.js';

function paletteAt(x, z) {
  const region = regionAtPoint(x, z);
  return familyFor(region ? region.id : 'saltreach', x);
}

function raise(world, x, z, yaw, name, fn, y) {
  const f = siteFrame(world, x, z, yaw, y);
  const k = new Kit(paletteAt(x, z), { detail: 1 });
  fn(k, f);
  const g = k.build(name);
  g.position.set(f.x, f.y, f.z);
  g.rotation.y = f.yaw;
  world.scene.add(g);
  return { f, g };
}

function aqueduct(world, spec) {
  const dx = spec.x1 - spec.x0;
  const dz = spec.z1 - spec.z0;
  const len = Math.hypot(dx, dz) || 1;
  const yaw = Math.atan2(dx, dz);
  const n = spec.arches;
  const span = len / n;
  const h = spec.h;
  const broken = new Set(spec.broken || []);
  raise(world, spec.x0, spec.z0, yaw, spec.id, (k, f) => {
    for (let i = 0; i <= n; i++) {
      const lz = span * i;
      const gy = f.ground(0, lz);
      const ph = Math.max(h + 2, h - gy + 2);
      const full = !broken.has(i) && !broken.has(i - 1);
      const stump = !full && !broken.has(i);
      if (full) {
        k.pier(0, gy, lz, 2.2, ph, { d: 2.2 });
        f.solid(0, lz, 2.2, 2.2, gy - 1, gy + ph);
      } else if (stump) {
        // Half pier only — no wing slab sticking out of the break.
        k.pier(0, gy, lz, 2.2, ph * 0.5, { d: 2.2 });
        f.solid(0, lz, 2.2, 2.2, gy - 1, gy + ph * 0.5);
      }
      if (i >= n || broken.has(i)) continue;
      const mz = span * (i + 0.5);
      const deckTop = Math.max(f.ground(0, mz) + h, h);
      const deckH = 1.35;
      const deckBase = deckTop - deckH;
      // Missing far pier: stop at this pier. No stub beam hanging into open air.
      if (broken.has(i + 1)) continue;
      k.slab(0, deckBase, mz, 2.5, deckH, span * 0.94, 'stone');
      const archSpan = Math.min(span * 0.8, 9);
      const spring = deckBase - archSpan * 0.46;
      const floor = Math.max(gy, f.ground(0, lz + span), f.ground(0, mz));
      if (spring > floor + 0.6) {
        k.arch(0, spring, mz, archSpan, { ry: Math.PI / 2, depth: 2.15, t: 0.55, c: 'edge' });
      }
    }
  });
}

function colonnade(world, spec) {
  const n = Math.max(4, Math.round(spec.len / 4));
  raise(world, spec.x, spec.z, spec.rot, 'colonnade', (k, f) => {
    for (let i = 0; i < n; i++) {
      const z = -spec.len * 0.5 + (i / (n - 1)) * spec.len;
      const fallen = (i * 17 + Math.round(spec.x)) % 7 < spec.fallen * 7;
      if (fallen) {
        k.slab(i % 2 ? 1.2 : -1.0, 0.15, z, 1.15, 1.15, 6.2, 'stone', { rz: 1.15 });
        continue;
      }
      k.column(-2.4, 0, z, 6.6, 0.48);
      k.column(2.4, 0, z, 6.6, 0.48);
      k.slab(0, 6.45, z, 6.2, 0.7, 1.45, 'edge');
      f.pillar(-2.4, z, 0.55, -1, 6.6);
      f.pillar(2.4, z, 0.55, -1, 6.6);
    }
  });
}

function collapsedTower(world, spec) {
  const rng = seededRandom(Math.round(spec.x * 3 + spec.z));
  raise(world, spec.x, spec.z, spec.lean || 0, 'collapsed_tower', (k, f) => {
    const h = spec.h;
    const low = f.lowest(6.4, 6.4);
    k.footing(0, 0, 6.2, 6.2, Math.min(1.2, h * 0.12), low);
    k.masonry(0, 0, 0, 5.4, h * 0.46, 5.4);
    k.at({ x: 0.5, y: h * 0.46, z: 0.25, rz: spec.lean, rx: spec.lean * 0.35 }, (kk) => {
      kk.masonry(0, 0, 0, 4.6, h * 0.36, 4.6, { c: 'stone2' });
      kk.slab(0, h * 0.36, 0, 5.0, 0.32, 5.0, 'edge');
    });
    k.rubble(2.8, 0.15, 1.2, 2.2, 7, rng, { size: 1.05 });
    f.solid(0, 0, 6.2, 6.2, low - 1, h * 0.5);
  });
}

function overlook(world, spec) {
  const yaw = Math.atan2(spec.lookX - spec.x, spec.lookZ - spec.z);
  raise(world, spec.x, spec.z, yaw, 'overlook_' + spec.name, (k, f) => {
    const low = f.lowest(8.4, 6.4);
    k.footing(0, 0, 8.2, 6.2, 0.45, low);
    k.pier(-3.2, 0.45, 0.35, 1.15, 5.4, { d: 1.15 });
    k.pier(3.2, 0.45, 0.35, 1.15, 5.4, { d: 1.15 });
    k.slab(0, 5.85, 0.35, 7.8, 0.7, 1.35, 'stone');
    k.pinnacle(0, 6.55, 0.35, 0.65, { finial: 'metal' });
    k.slab(-3.5, 0.45, -1.6, 0.7, 1.15, 2.6, 'stone2');
    k.slab(3.5, 0.45, -1.6, 0.7, 1.15, 2.6, 'stone2');
    f.solid(0, 0, 8.2, 6.2, low - 1, 0.55);
    f.pillar(-3.2, 0.35, 0.65, 0, 6.1);
    f.pillar(3.2, 0.35, 0.65, 0, 6.1);
  });
}

// The drop a fall at (x, z) pours over: high ground 3 m behind it, the pool 3 m in front.
export function fallDrop(terrain, spec) {
  const ux = Math.sin(spec.rot), uz = Math.cos(spec.rot);
  const top = terrain.heightAt(spec.x - ux * 3, spec.z - uz * 3);
  const base = terrain.heightAt(spec.x + ux * 3, spec.z + uz * 3);
  return { top, base, h: top - base };
}

const FALL = {
  clear: { color: '#d8f0ff', emissive: '#8fd0ff' },
  ice: { color: '#cfefff', emissive: '#7ad0ff' },
};
const fallMats = new Map();
function fallMaterial(kind) {
  let m = fallMats.get(kind);
  if (!m) {
    const { color, emissive } = FALL[kind] || FALL.clear;
    m = {
      sheet: new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.2, vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, flatShading: true, roughness: 0.35 }),
      foam: mat('#eef8ff', { emissive, ei: 0.15, transparent: true, opacity: 0.22, depthWrite: false }),
    };
    fallMats.set(kind, m);
  }
  return m;
}

// Water thins where it leaves the lip, runs full down the face and breaks into spray at the
// foot; the edges are thinner than the middle, so it never reads as a white panel.
function fallSheet(w, len) {
  const geo = new THREE.PlaneGeometry(w, len, 4, 6);
  const pos = geo.attributes.position;
  const rgba = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getY(i) / len + 0.5; // 0 at the foot, 1 at the lip
    const u = Math.abs(pos.getX(i) / w) * 2; // 0 middle, 1 edge
    const a = (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, v * 1.15))) * (1 - 0.6 * u * u);
    rgba.set([1, 1, 1, a], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  return geo;
}

// A sheet laid down the cliff face from the lip to the pool, its height taken from the
// ground itself, so a fall can never hang off flat land.
function waterfall(world, spec) {
  const kind = spec.kind || 'clear';
  const { h } = fallDrop(world.terrain, spec);
  if (h < 6) return null;
  const { base } = fallDrop(world.terrain, spec);
  const { f, g } = raise(world, spec.x, spec.z, spec.rot, 'waterfall', (k) => {
    // the lip is a boulder bedded into the crest, not resting on it
    k.rock(0, h - 0.35, -2.6, spec.w + 2.2, 1.5, 3.2, 'stone2');
  }, base);
  const { sheet: sheetMat, foam } = fallMaterial(kind);
  const len = Math.hypot(h, 6);
  const sheet = new THREE.Mesh(fallSheet(spec.w, len), sheetMat);
  sheet.rotation.x = -Math.atan2(6, h);
  sheet.position.set(0, h / 2 + 0.5, 0.5);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(spec.w * 0.55, 16).rotateX(-Math.PI / 2), foam);
  ring.position.set(0, f.ground(0, 3.2) + 0.12, 3.2);
  g.add(sheet, ring);
  return ring;
}

function autumnGroves(world, exclusions) {
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
  const golds = ['#d4a028', '#c46a20', '#e0b040', '#a84818', '#c88830'];
  const barks = ['#5a3a20', '#4a2e18'];
  const trunks = [];
  const canopies = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();

  const excluded = (x, z, pad) => excludedAt(exclusions, x, z, pad);

  for (const grove of AUTUMN_GROVES) {
    if (grove.snow) continue;
    const rng = seededRandom(Math.round(grove.x * 13 + grove.z * 7));
    for (let i = 0; i < grove.n; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * grove.r;
      const x = grove.x + Math.cos(a) * r;
      const z = grove.z + Math.sin(a) * r;
      const h = world.terrain.heightAt(x, z);
      if (h < 1.6 || h > 40) continue;
      if (excluded(x, z, 2.4)) continue;
      const th = 3.2 + rng() * 2.8;
      const cs = 2.0 + rng() * 1.5;
      trunks.push({ x, y: h, z, h: th, r: rng() * 6, bark: barks[Math.floor(rng() * barks.length)] });
      canopies.push({
        x,
        y: h + th + cs * 0.4,
        z,
        s: cs,
        r: rng() * 6,
        c: golds[Math.floor(rng() * golds.length)],
      });
      if (rng() < 0.5) {
        canopies.push({
          x: x + (rng() - 0.5) * cs,
          y: h + th + cs * 0.1,
          z: z + (rng() - 0.5) * cs,
          s: cs * 0.6,
          r: rng() * 6,
          c: golds[Math.floor(rng() * golds.length)],
        });
      }
      world.colliders.addCyl({ x, z, r: 0.35, y0: h - 1, y1: h + th });
    }
  }

  const paint = (geo, items, key) => {
    if (!items.length) return;
    const im = new THREE.InstancedMesh(geo, mat('#ffffff'), items.length);
    items.forEach((item, i) => {
      e.set(0, item.r, 0);
      q.setFromEuler(e);
      if (key === 'trunk') m4.compose(p.set(item.x, item.y, item.z), q, s.set(1.3, item.h, 1.3));
      else m4.compose(p.set(item.x, item.y, item.z), q, s.set(item.s, item.s * 0.8, item.s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.set(key === 'trunk' ? item.bark : item.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    world.scene.add(im);
  };
  paint(trunkGeo, trunks, 'trunk');
  paint(canopyGeo, canopies, 'canopy');
}

// The sounding lines: standing stones a chain apart, each leaning a little with the wind and
// notched with its tally, from the listening places out to the cliffs. A stone is only set
// on firm, level moor: never in water or on a wall's edge.
function soundingLines(world, exclusions) {
  const T = world.terrain;
  const k = new Kit(paletteAt(-1280, 1140), { detail: 1 });
  const rng = seededRandom(4471);
  const hollows = Object.values(LANDFORMS).flat().filter((d) => d && d.kind === 'tarn');
  const inTarn = (x, z) => hollows.some((t) => Math.hypot(x - t.x, z - t.z) < Math.max(t.rx, t.rz) + 3);
  let n = 0;
  for (const line of SOUNDING_LINES) {
    const [ax, az] = line.from, [bx, bz] = line.to;
    const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    for (let d = line.every; d <= len; d += line.every) {
      const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
      const y = T.heightAt(x, z);
      let lo = Infinity, hi = -Infinity;
      for (const [ox, oz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) {
        const h = T.heightAt(x + ox, z + oz);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      if (y < 3 || hi - lo > 1.2 || inTarn(x, z) || excludedAt(exclusions, x, z, 2)) continue;
      const h = 2.4 + rng() * 1.4;
      k.at({ x, y: lo - 0.6, z, ry: yaw + (rng() - 0.5) * 0.3, rz: (rng() - 0.5) * 0.12, rx: -0.06 }, (kk) => {
        kk.slab(0, 0, 0, 1.0, h + 0.6, 0.55, 'stone2');
        kk.slab(0, h + 0.55, 0, 0.8, 0.22, 0.45, 'stone');
        const tally = 2 + Math.floor(rng() * 6);
        for (let i = 0; i < tally; i++) kk.slab(-0.3 + i * 0.11, h - 0.9, 0.28, 0.05, 0.5, 0.03, 'dark', { grad: 0 });
        kk.slab(0, h * 0.25, -0.29, 0.7, 0.9, 0.04, 'moss', { grad: 0 });
      });
      world.colliders.addBox({ x, z, w: 1.0, d: 0.6, y0: y - 1, y1: y + h, climbable: true });
      exclusions.push({ x, z, r: 1.6 });
      n++;
    }
  }
  if (n) world.scene.add(k.build('hush_sounding_lines'));
}

// Tarns: still water laid in the moor's peat hollows (data/landforms.js `tarn`), its surface
// just under the hollow's lowest rim, so it never stands above the ground around it. Frosthollow's
// cold skins each one with ice from the banks, ragged where it gives out over the black water.
function tarns(world) {
  const T = world.terrain;
  const water = new THREE.MeshStandardMaterial({ color: '#2f3a44', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88, flatShading: false });
  const ice = new THREE.MeshStandardMaterial({ color: '#c6d1d9', roughness: 0.32, metalness: 0.05 });
  const rng = seededRandom(9311);
  for (const def of Object.values(LANDFORMS).flat().filter((d) => d && d.kind === 'tarn')) {
    const c = Math.cos(def.rot || 0), s = Math.sin(def.rot || 0);
    const at = (u, v) => [def.x + u * c - v * s, def.z + u * s + v * c];
    let rim = Infinity;
    for (let a = 0; a < 24; a++) {
      const [x, z] = at(Math.cos((a / 24) * Math.PI * 2) * def.rx * 1.02, Math.sin((a / 24) * Math.PI * 2) * def.rz * 1.02);
      rim = Math.min(rim, T.heightAt(x, z));
    }
    const level = rim - 0.35;
    if (!(T.heightAt(def.x, def.z) < level - 0.4)) continue;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), water);
    disc.scale.set(def.rx * 1.02, 1, def.rz * 1.02);
    disc.rotation.y = -(def.rot || 0);
    disc.position.set(def.x, level, def.z);
    disc.receiveShadow = true;
    disc.name = 'tarn';
    world.scene.add(disc);
    const shelf = new THREE.RingGeometry(0.72, 1, 28, 1).rotateX(-Math.PI / 2);
    const p = shelf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      if (r < 0.9) { const k = (0.56 + rng() * 0.3) / r; p.setXYZ(i, p.getX(i) * k, 0, p.getZ(i) * k); }
    }
    shelf.computeVertexNormals();
    const rimIce = new THREE.Mesh(shelf, ice);
    rimIce.scale.copy(disc.scale);
    rimIce.rotation.y = disc.rotation.y;
    rimIce.position.set(def.x, level + 0.03, def.z);
    rimIce.receiveShadow = true;
    rimIce.name = 'tarn_ice';
    world.scene.add(rimIce);
  }
}

// ---------------------------------------------------------------- the furnace's overflow
// Molten rock moving down its bed: a glowing ribbon whose crust drifts downstream, hottest in
// the middle of the stream and skinned dark at its banks. Where the bed drops off a wall the
// ribbon drops with it, a lava fall; where it reaches the sea it ends in steam.
const LAVA_MAT = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
  fog: true,
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    #include <fog_pars_vertex>
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    #include <fog_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main() {
      float flow = vUv.y * 0.32 - uTime * 0.22;
      float n = noise(vec2(vUv.x * 3.0, flow)) * 0.6 + noise(vec2(vUv.x * 7.0 + 3.0, flow * 2.3)) * 0.4;
      float mid = smoothstep(0.0, 0.4, vUv.x) * smoothstep(1.0, 0.6, vUv.x);
      vec3 col = mix(vec3(0.62, 0.15, 0.04), vec3(1.0, 0.45, 0.12) * 1.45, mid * (0.55 + 0.45 * n));
      col = mix(col, vec3(0.11, 0.05, 0.035), clamp(smoothstep(0.6, 0.8, n) * 0.85 + (1.0 - mid) * 0.45, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});

function lavaFlows(world, exclusions) {
  const T = world.terrain;
  const channels = Object.values(LANDFORMS).flat().filter((d) => d && d.kind === 'channel');
  const k = new Kit(paletteAt(340, -1200), { detail: 1 }); // the Ashen Spire's caldera
  const rng = seededRandom(9061);
  const ends = [];
  // where a way meets a flow, the attendants laid a slab bridge over it (the Ember Road)
  const ways = ROADS.map((r) => samplePath(r, 1));
  const crossings = [];
  for (const flow of LAVA_FLOWS) {
    const ch = channels[flow.channel];
    if (!ch) continue;
    const pts = ch.points, hw = flow.w / 2;
    // the bed, sampled every metre down the line until it reaches the water
    const samples = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
      for (let d = 0; d < len; d += 1) samples.push({ x: ax + tx * d, z: az + tz * d, tx, tz });
    }
    // each way that crosses the bed crosses at its point nearest the bed's line
    const here = [];
    const x0 = Math.min(...pts.map((q) => q[0])) - 8, x1 = Math.max(...pts.map((q) => q[0])) + 8;
    const z0 = Math.min(...pts.map((q) => q[1])) - 8, z1 = Math.max(...pts.map((q) => q[1])) + 8;
    for (const way of ways) {
      let best = null;
      for (const q of way) if (q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1) for (const p of samples) {
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < hw + 0.5 && (!best || d < best.d)) best = { d, q };
      }
      if (best) here.push({ x: best.q.x, z: best.q.z, yaw: Math.atan2(best.q.nz, -best.q.nx), w: best.q.width, span: flow.w });
    }
    crossings.push(...here);
    const pos = [], uv = [], idx = [];
    let along = 0, last = null;
    for (const p of samples) {
      let y = T.heightAt(p.x, p.z);
      const sea = y < 0.15;
      if (sea) y = -0.6; // the last metre pours into the water
      if (last) along += Math.hypot(p.x - last.x, p.z - last.z, y - last.y);
      const nx = -p.tz, nz = p.tx, n = pos.length / 3;
      pos.push(p.x + nx * hw, y + 0.12, p.z + nz * hw, p.x - nx * hw, y + 0.12, p.z - nz * hw);
      uv.push(0, along, 1, along);
      if (n) idx.push(n - 2, n, n - 1, n - 1, n, n + 1);
      const bridged = here.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.w / 2 + 3.2);
      // banks of chilled crust, and the heat for whoever wades in (none under a bridge)
      if (!bridged && (!last || Math.abs(y - last.y) < 0.6)) {
        if (rng() < 0.45) for (const side of [-1, 1]) k.rock(p.x + nx * side * (hw + 0.5 + rng() * 0.8), y + 0.1, p.z + nz * side * (hw + 0.5 + rng() * 0.8), 1 + rng(), 0.5 + rng() * 0.5, 0.9 + rng(), 'dark', { ry: rng() * 6 });
        if (Math.round(along) % 3 === 0) world.hazards.push({ x: p.x, z: p.z, r: hw + 0.3, y, dps: 24, element: 'ember', status: 'burn' });
      }
      if (Math.round(along) % 18 === 0) world.addLight(new THREE.Vector3(p.x, y + 2.2, p.z), '#ff6a24', 2.0, 18, true, 0.8);
      exclusions.push({ x: p.x, z: p.z, r: hw + 1.6 });
      last = { x: p.x, z: p.z, y };
      if (sea) break;
    }
    if (pos.length >= 12) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const ribbon = new THREE.Mesh(geo, LAVA_MAT);
      ribbon.name = 'lava_flow';
      world.scene.add(ribbon);
    }
    if (last) ends.push(last);
    // the gallery mouth it breaks from: a Compact arch in the foot of the wall, its passage
    // glowing where the overflow still comes through
    const [ax, az] = pts[0], [bx, bz] = pts[1];
    const yaw = Math.atan2(bx - ax, bz - az);
    const m = flow.mouth;
    const gy = T.heightAt(m.x, m.z);
    k.at({ x: m.x, y: gy, z: m.z, ry: yaw }, (kk) => {
      for (const sx of [-1, 1]) kk.pier(sx * 3.0, -0.6, -0.6, 1.5, 6.4, { c: 'stone', c2: 'stone2' });
      kk.arch(0, 4.0, -0.6, 4.5, { t: 0.7, depth: 1.6, c: 'edge', spandrel: true, fill: 'stone' });
      kk.slab(0, -0.6, -1.6, 4.4, 5.2, 0.4, 'dark', { grad: 0 });
      kk.glowPanel(0, 1.2, -1.3, 3.2, 2.2, 0.1, 'glow', 1.2);
    });
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const sx of [-1, 1]) world.colliders.addBox({ x: m.x + c * sx * 3.0 - sn * 0.6, z: m.z - sn * sx * 3.0 - c * 0.6, w: 1.6, d: 1.6, y0: gy - 1, y1: gy + 6, rot: yaw });
    world.addLight(new THREE.Vector3(m.x, gy + 2, m.z), '#ff7a2a', 2.4, 20, true, 1);
    exclusions.push({ x: m.x, z: m.z, r: 6 });
  }
  for (const c of crossings) {
    // basalt slabs on two abutments, the deck a hand above the higher bank
    const len = c.span + 4.2, ux = Math.sin(c.yaw), uz = Math.cos(c.yaw);
    const banks = [-1, 1].map((e) => T.heightAt(c.x + ux * e * (len / 2 - 0.6), c.z + uz * e * (len / 2 - 0.6)));
    const top = Math.max(...banks) + 0.25, deckW = c.w + 0.8;
    k.at({ x: c.x, y: top, z: c.z, ry: c.yaw }, (kk) => {
      kk.slab(0, -0.45, 0, deckW, 0.45, len, 'stone');
      for (const e of [-1, 1]) {
        kk.slab(0, -0.45 - 1.6, e * (len / 2 - 0.9), deckW + 0.4, 1.6, 1.8, 'stone2');
        for (const sx of [-1, 1]) kk.slab(sx * (deckW / 2 - 0.2), 0, e * (len / 2 - 0.5), 0.45, 0.55, 1.0, 'edge');
      }
    });
    world.colliders.addBox({ x: c.x, z: c.z, w: deckW, d: len, y0: top - 2, y1: top, rot: c.yaw });
    exclusions.push({ x: c.x, z: c.z, r: len / 2 + 1 });
  }
  world.scene.add(k.build('ashen_overflow'));
  world.animated.push((t) => { LAVA_MAT.uniforms.uTime.value = t; });
  return ends;
}

// A plume as low-poly puffs: each rises, swells and drifts downwind, then thins away at the
// top and starts again at the vent. Meshes, not particles, so it stands up in the fog.
const PUFF = new THREE.IcosahedronGeometry(1, 1);
function plume(world, spec) {
  const n = 26;
  const steam = spec.kind === 'steam';
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: steam ? 0.62 : 0.72, depthWrite: false });
  const im = new THREE.InstancedMesh(PUFF, material, n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  im.castShadow = false;
  im.name = 'plume';
  im.renderOrder = 3;
  const lo = new THREE.Color(steam ? '#c9cdd0' : '#5d5752'), hi = new THREE.Color(steam ? '#eef1f3' : '#a29b94');
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) im.setColorAt(i, c.copy(lo).lerp(hi, i / n));
  im.instanceColor.needsUpdate = true;
  const y0 = spec.y ?? world.terrain.heightAt(spec.x, spec.z);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const wind = new THREE.Vector2(0.55, 0.3);
  const seeds = Array.from({ length: n }, (_, i) => [((i * 0.6180339) % 1), Math.sin(i * 12.9) * 0.5 + 0.5]);
  const step = (t) => {
    for (let i = 0; i < n; i++) {
      const [ph, r] = seeds[i];
      const f = (t * (steam ? 0.05 : 0.03) + ph) % 1;
      const rise = f * spec.h;
      const swell = spec.r * (0.9 + f * 4.4) * Math.sin(Math.min(1, f * 1.25) * Math.PI * 0.5 + 0.25) * (1 - smoothstepJS(0.72, 1, f));
      const spread = spec.r * (0.5 + f * 2.2);
      v.set(spec.x + wind.x * rise * rise * 0.012 + (r - 0.5) * spread * 2, y0 + rise, spec.z + wind.y * rise * rise * 0.012 + Math.sin(i * 2.3) * spread);
      q.setFromEuler(e.set(r * 3, t * 0.05 + i, r));
      im.setMatrixAt(i, m4.compose(v, q, sc.set(swell * 1.15, swell * 0.7, swell)));
    }
    im.instanceMatrix.needsUpdate = true;
  };
  step(0);
  world.scene.add(im);
  world.animated.push((t) => {
    const cam = G.game?.camera;
    if (cam && Math.hypot(cam.position.x - spec.x, cam.position.z - spec.z) > 2200) return;
    step(t);
  });
}
function smoothstepJS(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function buildRuinscapes(world, exclusions) {
  soundingLines(world, exclusions);
  tarns(world);
  const ends = lavaFlows(world, exclusions);
  for (const p of PLUMES) plume(world, p);
  for (const e of ends) plume(world, { x: e.x, z: e.z, y: 0.2, r: 2.2, h: 46, kind: 'steam' });
  for (const a of AQUEDUCTS) {
    aqueduct(world, a);
    exclusions.push({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2, r: Math.hypot(a.x1 - a.x0, a.z1 - a.z0) * 0.45 });
  }
  for (const c of COLONNADES) {
    colonnade(world, c);
    exclusions.push({ x: c.x, z: c.z, r: c.len * 0.55 });
  }
  for (const t of COLLAPSED_TOWERS) {
    collapsedTower(world, t);
    exclusions.push({ x: t.x, z: t.z, r: 8 });
  }
  for (const o of OVERLOOKS) {
    overlook(world, o);
    exclusions.push({ x: o.x, z: o.z, r: 7 });
  }
  // One shared pulse for every fall: the sheets shimmer and the foam rings spread.
  const rings = WATERFALLS.map((w) => waterfall(world, w)).filter(Boolean);
  if (rings.length) {
    world.animated.push((t) => {
      for (const m of fallMats.values()) m.sheet.opacity = 0.47 + Math.sin(t * 6) * 0.06;
      const s = 0.85 + ((t * 0.4) % 1) * 0.3;
      for (const r of rings) r.scale.setScalar(s);
    });
  }
  autumnGroves(world, exclusions);
}
