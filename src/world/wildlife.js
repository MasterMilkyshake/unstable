// Life that isn't hunting you: flocks over the coasts and fields, and herds that graze the
// uplands and bolt when you come too close. Nothing here is an actor or saved; it is placed
// around the player as they travel, on whatever ground is there, so it survives terrain work.
//   gulls     wheel over shorelines and harbours
//   crows     work the fields and the forest edges
//   sheep     the Breadfields and every meadow the Keepers graze
//   deer      forest clearings
//   goats     highland shelves, tundra and the snow line
// One InstancedMesh per species and body part, so the whole layer is a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G } from '../core/globals.js';
import { clamp, rand, angleWrap } from '../core/util.js';

const SURFACE_MAX_X = 3000;
// No grazing in town streets or on the arrival beach.
const QUIET = [
  { x: 0, z: 0, r: 120 },
  { x: 0, z: -330, r: 45 },
];

// ---------------------------------------------------------------- geometry
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

// A box with vertex colours, positioned in part-local space.
function box(w, h, d, x, y, z, color, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  _c.set(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // darker underside so the blocky bodies still read in flat light
    const shade = g.attributes.normal.getY(i) < -0.5 ? 0.62 : g.attributes.normal.getY(i) > 0.5 ? 1.08 : 0.9;
    col[i * 3] = _c.r * shade;
    col[i * 3 + 1] = _c.g * shade;
    col[i * 3 + 2] = _c.b * shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
const BIRD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });

// Quadrupeds: body (with neck and head) plus a front and a back leg pair that swing about
// their hips. Sizes in metres; z is forward.
const BEASTS = {
  sheep: {
    max: 36, speed: 4.2, flee: 8.5, wary: 16, herd: [4, 8], biomes: ['meadow', 'farmland', 'beach'],
    hipF: [0, 0.62, 0.42], hipB: [0, 0.62, -0.42],
    body: () => [box(0.82, 0.62, 1.25, 0, 0.88, 0, '#e8e2d2'), box(0.9, 0.5, 1.05, 0, 1.02, -0.02, '#f2ecdd'), box(0.34, 0.38, 0.42, 0, 1.0, 0.78, '#2f2a26'), box(0.42, 0.1, 0.16, 0, 1.12, 0.66, '#2f2a26')],
    legs: () => [box(0.14, 0.62, 0.14, -0.24, -0.31, 0, '#2f2a26'), box(0.14, 0.62, 0.14, 0.24, -0.31, 0, '#2f2a26')],
  },
  deer: {
    max: 28, speed: 5.2, flee: 12, wary: 26, herd: [3, 6], biomes: ['forest', 'emberwood', 'jungle'],
    hipF: [0, 1.0, 0.5], hipB: [0, 1.0, -0.5],
    body: () => [
      box(0.5, 0.56, 1.35, 0, 1.24, 0, '#8a5e3c'), box(0.46, 0.2, 0.5, 0, 1.0, -0.5, '#efe4cf'),
      box(0.24, 0.62, 0.26, 0, 1.68, 0.62, '#8a5e3c', -0.35), box(0.26, 0.26, 0.48, 0, 1.98, 0.86, '#7a5034'),
      box(0.05, 0.42, 0.05, -0.12, 2.28, 0.76, '#d8ccb4', -0.3), box(0.05, 0.42, 0.05, 0.12, 2.28, 0.76, '#d8ccb4', -0.3),
      box(0.3, 0.05, 0.05, 0, 2.42, 0.7, '#d8ccb4'),
    ],
    legs: () => [box(0.11, 1.0, 0.11, -0.17, -0.5, 0, '#6e4a30'), box(0.11, 1.0, 0.11, 0.17, -0.5, 0, '#6e4a30')],
  },
  goat: {
    max: 28, speed: 4.6, flee: 9.5, wary: 18, herd: [3, 6], biomes: ['highland', 'tundra', 'snow', 'hush', 'rock'],
    hipF: [0, 0.66, 0.38], hipB: [0, 0.66, -0.38],
    body: () => [
      box(0.5, 0.52, 1.05, 0, 0.94, 0, '#c9c3b6'), box(0.46, 0.18, 0.7, 0, 0.66, 0, '#a59d8e'),
      box(0.22, 0.42, 0.24, 0, 1.28, 0.5, '#c9c3b6', -0.25), box(0.24, 0.26, 0.4, 0, 1.46, 0.68, '#b8b1a3'),
      box(0.07, 0.07, 0.36, -0.08, 1.66, 0.54, '#5a5248', 0.6), box(0.07, 0.07, 0.36, 0.08, 1.66, 0.54, '#5a5248', 0.6),
      box(0.08, 0.2, 0.06, 0, 1.24, 0.86, '#ede8de'),
    ],
    legs: () => [box(0.12, 0.66, 0.12, -0.15, -0.33, 0, '#8b8376'), box(0.12, 0.66, 0.12, 0.15, -0.33, 0, '#8b8376')],
  },
};

// Birds: a small body and a V of wings that flaps by squashing through zero.
const BIRDS = {
  gull: { max: 48, body: '#f1f1ec', wing: '#d9dcdd', tip: '#3a3d40', size: 1.0 },
  crow: { max: 48, body: '#1e1d22', wing: '#26252b', tip: '#141318', size: 0.85 },
};

function birdGeometry(def) {
  const bodyG = box(0.2 * def.size, 0.18 * def.size, 0.62 * def.size, 0, 0, 0, def.body);
  const wing = (side) => {
    const g = new THREE.BufferGeometry();
    const s = def.size;
    // inner panel and tip panel, sloping up and back from the shoulder
    const p = [0, 0, 0.12 * s, side * 0.55 * s, 0.12, 0.0, side * 0.0, 0, -0.16 * s,
      side * 0.55 * s, 0.12, 0.0, side * 0.95 * s, 0.2, -0.16 * s, side * 0.0, 0, -0.16 * s];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const a = new THREE.Color(def.wing), b = new THREE.Color(def.tip);
    const col = [a, a, a, a, b, a].flatMap((c) => [c.r, c.g, c.b]);
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  };
  return { body: bodyG, wings: mergeGeometries([wing(-1), wing(1)]) };
}

function instanced(geo, mat, n, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = shadow;
  m.receiveShadow = false;
  m.frustumCulled = false;
  m.count = 0;
  m.userData.dynamic = true;
  return m;
}

// ---------------------------------------------------------------- placement
function surfaceOK(world, x, z, minH = 1.6) {
  if (x > SURFACE_MAX_X || z > SURFACE_MAX_X) return false;
  const h = world.terrain.heightAt(x, z);
  if (h < minH || h > 70) return false;
  if (QUIET.some((q) => Math.hypot(x - q.x, z - q.z) < q.r)) return false;
  // keep clear of every built footprint (houses, walls, camps, monuments)
  for (const e of world.exclusions || []) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + 6) ** 2) return false;
  return true;
}

function flatEnough(world, x, z) {
  const n = world.terrain.normalAt(x, z, _p);
  if (n.y < 0.86) return false;
  // not on a roof, wall or deck
  return world.colliders.groundAt(x, z, world.terrain.heightAt(x, z) + 6) < world.terrain.heightAt(x, z) + 0.3;
}

function nearWater(world, x, z) {
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2;
    if (world.terrain.heightAt(x + Math.cos(t) * 40, z + Math.sin(t) * 40) < 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------- herds
class Herd {
  constructor(kind, x, z, n) {
    this.kind = kind;
    this.def = BEASTS[kind];
    this.x = x;
    this.z = z;
    this.animals = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), r = rand(1.5, 7);
      this.animals.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y: 0, yaw: rand(-Math.PI, Math.PI), want: 0, speed: 0, t: rand(0, 4), phase: rand(0, 6), mode: 'graze', scale: rand(0.88, 1.1) });
    }
    this.fleeT = 0;
  }
}

function stepAnimal(world, herd, an, dt, player) {
  const def = herd.def;
  const dx = an.x - player.x, dz = an.z - player.z;
  const pd = Math.hypot(dx, dz);
  const wary = def.wary * (player.running ? 1.5 : 1);
  if (pd < wary) {
    // bolt away from the player, the whole herd with it
    herd.fleeT = rand(3.5, 6);
    herd.fx = player.x;
    herd.fz = player.z;
  }
  if (herd.fleeT > 0) {
    an.mode = 'flee';
    an.want = Math.atan2(an.x - herd.fx, an.z - herd.fz) + Math.sin(an.phase) * 0.35;
    an.speed = def.flee * (0.9 + 0.1 * Math.sin(an.phase * 3));
  } else {
    an.t -= dt;
    if (an.t <= 0) {
      if (an.mode === 'walk' || Math.random() < 0.55) {
        an.mode = 'graze';
        an.t = rand(3, 9);
        an.speed = 0;
      } else {
        an.mode = 'walk';
        an.t = rand(2, 5);
        // drift back toward the herd's middle if wandering off
        const hx = herd.x - an.x, hz = herd.z - an.z;
        an.want = Math.hypot(hx, hz) > 12 ? Math.atan2(hx, hz) + rand(-0.5, 0.5) : rand(-Math.PI, Math.PI);
        an.speed = def.speed * rand(0.25, 0.45);
      }
    }
  }
  an.yaw += angleWrap(an.want - an.yaw) * Math.min(1, dt * (an.mode === 'flee' ? 5 : 2));
  if (an.speed > 0) {
    const nx = an.x + Math.sin(an.yaw) * an.speed * dt;
    const nz = an.z + Math.cos(an.yaw) * an.speed * dt;
    // keep to dry, walkable ground; turn back from water, cliffs and walls
    const h0 = world.terrain.heightAt(an.x, an.z), h1 = world.terrain.heightAt(nx, nz);
    const blocked = h1 < 1.2 || Math.abs(h1 - h0) > an.speed * dt * 1.3 + 0.05 || world.colliders.groundAt(nx, nz, h1 + 2) > h1 + 0.4;
    if (blocked) {
      an.want = an.yaw + Math.PI * rand(0.6, 1.4);
      an.t = Math.min(an.t, 0.6);
    } else {
      an.x = nx;
      an.z = nz;
    }
  }
  an.phase += dt * (an.speed > 0 ? 2.2 + an.speed * 1.9 : 0.6);
}

// ---------------------------------------------------------------- flocks
class Flock {
  constructor(kind, x, z, y, n) {
    this.kind = kind;
    this.cx = x;
    this.cz = z;
    this.y = y;
    this.r = rand(16, 34);
    this.spin = rand(0.18, 0.32) * (Math.random() < 0.5 ? -1 : 1);
    this.drift = rand(0, Math.PI * 2);
    this.birds = [];
    for (let i = 0; i < n; i++) this.birds.push({ a: rand(0, Math.PI * 2), rr: rand(0.55, 1.15), dy: rand(-4, 4), ph: rand(0, 6), f: rand(5.5, 8) });
  }
}

export function buildWildlife(world) {
  const low = !!(G.settings && G.settings.quality === 'low');
  const scale = low ? 0.5 : 1;
  const parts = {};
  for (const [kind, def] of Object.entries(BEASTS)) {
    const max = Math.round(def.max * scale);
    parts[kind] = {
      body: instanced(mergeGeometries(def.body()), MAT, max, !low),
      front: instanced(mergeGeometries(def.legs()), MAT, max, false),
      back: instanced(mergeGeometries(def.legs()), MAT, max, false),
      max,
    };
    for (const k of ['body', 'front', 'back']) world.scene.add(parts[kind][k]);
  }
  const birdParts = {};
  for (const [kind, def] of Object.entries(BIRDS)) {
    const g = birdGeometry(def);
    const max = Math.round(def.max * scale);
    birdParts[kind] = { body: instanced(g.body, BIRD_MAT, max, false), wings: instanced(g.wings, BIRD_MAT, max, false), max };
    world.scene.add(birdParts[kind].body, birdParts[kind].wings);
  }

  const state = { herds: [], flocks: [], herdT: 2, flockT: 1, parts, birdParts, maxHerds: low ? 2 : 4, maxFlocks: low ? 2 : 4 };
  world.wildlife = state;

  const player = { x: 0, z: 0, running: false };
  world.animated.push((t, dt) => {
    const p = G.player;
    const active = p && !p.dead && p.pos.x < SURFACE_MAX_X && !(G.game && G.game.inRift);
    for (const part of Object.values(parts)) part.body.visible = part.front.visible = part.back.visible = active;
    for (const part of Object.values(birdParts)) part.body.visible = part.wings.visible = active;
    if (!active) return;
    dt = Math.min(dt || 0.016, 0.1);
    player.x = p.pos.x;
    player.z = p.pos.z;
    player.running = !!(p.vel && Math.hypot(p.vel.x, p.vel.z) > 6.5);
    tickHerds(world, state, dt, player);
    tickFlocks(world, state, dt, player, t);
  });
  return state;
}

function tickHerds(world, state, dt, player) {
  // retire herds the player has left behind
  state.herds = state.herds.filter((h) => Math.hypot(h.x - player.x, h.z - player.z) < 280);
  state.herdT -= dt;
  if (state.herdT <= 0 && state.herds.length < state.maxHerds) {
    state.herdT = rand(4, 9);
    const a = rand(0, Math.PI * 2), d = rand(80, 190);
    const x = player.x + Math.cos(a) * d, z = player.z + Math.sin(a) * d;
    if (surfaceOK(world, x, z, 2.2) && flatEnough(world, x, z) && !state.herds.some((h) => Math.hypot(h.x - x, h.z - z) < 90)) {
      const biome = world.biomeAt(x, z);
      const kind = Object.keys(BEASTS).find((k) => BEASTS[k].biomes.includes(biome));
      if (kind) {
        const def = BEASTS[kind];
        const used = state.herds.filter((h) => h.kind === kind).reduce((s, h) => s + h.animals.length, 0);
        const n = Math.min(Math.floor(rand(def.herd[0], def.herd[1] + 1)), state.parts[kind].max - used);
        if (n >= 2) state.herds.push(new Herd(kind, x, z, n));
      }
    }
  }
  const counts = {};
  for (const kind of Object.keys(BEASTS)) counts[kind] = 0;
  for (const herd of state.herds) {
    herd.fleeT = Math.max(0, herd.fleeT - dt);
    let sx = 0, sz = 0;
    for (const an of herd.animals) {
      stepAnimal(world, herd, an, dt, player);
      sx += an.x;
      sz += an.z;
      const part = state.parts[herd.kind];
      const i = counts[herd.kind]++;
      if (i >= part.max) continue;
      const def = herd.def;
      const moving = an.speed > 0.2;
      const gait = moving ? Math.sin(an.phase) : 0;
      const graze = an.mode === 'graze' ? 0.35 + Math.sin(an.phase * 0.7) * 0.08 : 0;
      an.y = world.terrain.heightAt(an.x, an.z);
      const bob = moving ? Math.abs(Math.sin(an.phase)) * 0.07 * Math.min(1, an.speed / 4) : 0;
      _q.setFromEuler(_e.set(graze * 0.35, an.yaw, 0, 'YXZ'));
      _s.setScalar(an.scale);
      _m.compose(_p.set(an.x, an.y + bob, an.z), _q, _s);
      part.body.setMatrixAt(i, _m);
      // legs swing about their hips in opposite phase
      for (const [key, hip, sign] of [['front', def.hipF, 1], ['back', def.hipB, -1]]) {
        const swing = gait * 0.55 * sign;
        const c = Math.cos(an.yaw), s = Math.sin(an.yaw);
        const hx = hip[2] * s * an.scale, hz = hip[2] * c * an.scale;
        _q.setFromEuler(_e.set(swing, an.yaw, 0, 'YXZ'));
        _m.compose(_p.set(an.x + hx, an.y + bob + hip[1] * an.scale, an.z + hz), _q, _s);
        part[key].setMatrixAt(i, _m);
      }
    }
    herd.x = sx / herd.animals.length;
    herd.z = sz / herd.animals.length;
  }
  for (const [kind, part] of Object.entries(state.parts)) {
    const n = Math.min(counts[kind], part.max);
    for (const k of ['body', 'front', 'back']) {
      part[k].count = n;
      part[k].instanceMatrix.needsUpdate = true;
    }
  }
}

function tickFlocks(world, state, dt, player, t) {
  state.flocks = state.flocks.filter((f) => Math.hypot(f.cx - player.x, f.cz - player.z) < 340);
  state.flockT -= dt;
  if (state.flockT <= 0 && state.flocks.length < state.maxFlocks) {
    state.flockT = rand(3, 7);
    const a = rand(0, Math.PI * 2), d = rand(60, 220);
    const x = player.x + Math.cos(a) * d, z = player.z + Math.sin(a) * d;
    const h = world.terrain.heightAt(x, z);
    if (x < SURFACE_MAX_X && z < SURFACE_MAX_X && h > -6 && !state.flocks.some((f) => Math.hypot(f.cx - x, f.cz - z) < 120)) {
      const biome = world.biomeAt(x, z);
      const coast = h < 4 || nearWater(world, x, z);
      const kind = coast && biome !== 'forest' && biome !== 'jungle' ? 'gull' : biome && !['volcanic', 'ashfield', 'snow'].includes(biome) ? 'crow' : null;
      if (kind) {
        const used = state.flocks.filter((f) => f.kind === kind).reduce((s, f) => s + f.birds.length, 0);
        const n = Math.min(Math.floor(rand(7, 15)), state.birdParts[kind].max - used);
        if (n >= 4) state.flocks.push(new Flock(kind, x, z, Math.max(h, 0) + rand(18, 36), n));
      }
    }
  }
  const counts = { gull: 0, crow: 0 };
  for (const f of state.flocks) {
    // the flock's centre wanders slowly; birds wheel around it on their own rings
    f.drift += dt * 0.05;
    f.cx += Math.cos(f.drift) * dt * 1.6;
    f.cz += Math.sin(f.drift * 0.8) * dt * 1.6;
    const part = state.birdParts[f.kind];
    for (const b of f.birds) {
      const i = counts[f.kind]++;
      if (i >= part.max) continue;
      b.a += f.spin * dt / b.rr;
      const r = f.r * b.rr;
      const x = f.cx + Math.cos(b.a) * r, z = f.cz + Math.sin(b.a) * r;
      const y = f.y + b.dy + Math.sin(t * 0.4 + b.ph) * 2.5;
      // tangent heading, banked into the turn
      const yaw = Math.atan2(-Math.sin(b.a) * Math.sign(f.spin), Math.cos(b.a) * Math.sign(f.spin));
      _q.setFromEuler(_e.set(0, yaw, -0.35 * Math.sign(f.spin), 'YXZ'));
      _s.setScalar(1);
      _m.compose(_p.set(x, y, z), _q, _s);
      part.body.setMatrixAt(i, _m);
      // flap in bursts, then glide with the wings held up
      const burst = Math.sin(t * 0.5 + b.ph) > 0.2;
      const flap = burst ? Math.sin(t * b.f + b.ph) : 0.55;
      _s.set(1, clamp(flap, -1, 1), 1);
      _m.compose(_p, _q, _s);
      part.wings.setMatrixAt(i, _m);
    }
  }
  for (const [kind, part] of Object.entries(state.birdParts)) {
    const n = Math.min(counts[kind], part.max);
    part.body.count = part.wings.count = n;
    part.body.instanceMatrix.needsUpdate = true;
    part.wings.instanceMatrix.needsUpdate = true;
  }
}
