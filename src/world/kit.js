// The architectural kit: one vocabulary for every built thing. A Kit accumulates
// flat-shaded, vertex-coloured triangles into a handful of layers (solid, metal, glow,
// crystal) and emits one mesh per layer, so a whole monument costs a few draw calls and
// still merges with its neighbours in world/merge.js.
//
// Coordinates are structure-local, metres, with y the BASE of most elements (things stand
// on something). push()/pop() nest transforms; warp() bends what is built inside it after
// the fact, which is how the Rift gets architecture that was built straight and then hurt.
import * as THREE from 'three';
import { PALETTES, KIT_MATERIALS, MATERIAL_RULES, SCALE } from './style.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

export function hash3(x, y, z) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

// ---------------------------------------------------------------- unit shapes
// Non-indexed triangle soups in a unit cell (x,z in -0.5..0.5 or radius 1, y in -0.5..0.5).
function quad(out, a, b, c, d) {
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
}
const BOX = (() => {
  const o = [];
  const p = (x, y, z) => [x - 0.5, y - 0.5, z - 0.5];
  quad(o, p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1));
  quad(o, p(1, 0, 0), p(0, 0, 0), p(0, 1, 0), p(1, 1, 0));
  quad(o, p(1, 0, 1), p(1, 0, 0), p(1, 1, 0), p(1, 1, 1));
  quad(o, p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0));
  quad(o, p(0, 1, 1), p(1, 1, 1), p(1, 1, 0), p(0, 1, 0));
  quad(o, p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1));
  return new Float32Array(o);
})();
// Gable / wedge: rectangle base, ridge along z at x = 0.
const WEDGE = (() => {
  const o = [];
  const a = [-0.5, -0.5, 0.5], b = [0.5, -0.5, 0.5], c = [0.5, -0.5, -0.5], d = [-0.5, -0.5, -0.5];
  const r0 = [0, 0.5, 0.5], r1 = [0, 0.5, -0.5];
  o.push(...a, ...b, ...r0);
  o.push(...c, ...d, ...r1);
  quad(o, b, c, r1, r0);
  quad(o, d, a, r0, r1);
  quad(o, d, c, b, a);
  return new Float32Array(o);
})();
// Ramp: full height at z = -0.5, zero at z = +0.5 (sloped buttress caps, stair cheeks).
const RAMP = (() => {
  const o = [];
  const a = [-0.5, -0.5, 0.5], b = [0.5, -0.5, 0.5], c = [0.5, -0.5, -0.5], d = [-0.5, -0.5, -0.5];
  const e = [0.5, 0.5, -0.5], f = [-0.5, 0.5, -0.5];
  quad(o, a, b, e, f);
  quad(o, c, d, f, e);
  o.push(...b, ...c, ...e);
  o.push(...d, ...a, ...f);
  quad(o, d, c, b, a);
  return new Float32Array(o);
})();
const prismCache = new Map();
// n-sided frustum, circumradius 1 at the base and `top` at the top. A flat face looks +z.
function prismUnit(n, top) {
  const key = n + '|' + top.toFixed(3);
  let g = prismCache.get(key);
  if (g) return g;
  const o = [];
  const off = Math.PI / n;
  const pt = (i, y, r) => {
    const a = off + (i / n) * Math.PI * 2;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  };
  for (let i = 0; i < n; i++) {
    const a0 = pt(i, -0.5, 1), a1 = pt(i + 1, -0.5, 1);
    const b0 = pt(i, 0.5, top), b1 = pt(i + 1, 0.5, top);
    if (top > 0.0001) quad(o, a0, a1, b1, b0);
    else o.push(...a0, ...a1, ...b0);
    o.push(0, -0.5, 0, ...a1, ...a0);
    if (top > 0.0001) o.push(0, 0.5, 0, ...b0, ...b1);
  }
  g = new Float32Array(o);
  prismCache.set(key, g);
  return g;
}
const OCTA = (() => {
  const o = [];
  const t = [0, 0.5, 0], b = [0, -0.5, 0];
  const r = [[0.5, 0, 0], [0, 0, 0.5], [-0.5, 0, 0], [0, 0, -0.5]];
  for (let i = 0; i < 4; i++) {
    const p = r[i], q = r[(i + 1) % 4];
    o.push(...p, ...t, ...q);
    o.push(...q, ...b, ...p);
  }
  return new Float32Array(o);
})();
// Irregular rock: a faceted dodecahedron blob (36 tris), squashed per instance.
const ROCK = (() => {
  const g = new THREE.DodecahedronGeometry(0.5, 0);
  return new Float32Array((g.index ? g.toNonIndexed() : g).attributes.position.array);
})();

class Layer {
  constructor() {
    this.pos = [];
    this.col = [];
  }
}

export class Kit {
  constructor(palette = 'ancient', opts = {}) {
    this.p = typeof palette === 'string' ? PALETTES[palette] || PALETTES.ancient : palette;
    this.layers = { solid: new Layer(), metal: new Layer(), glow: new Layer(), crystal: new Layer() };
    this.stack = [new THREE.Matrix4()];
    this.warps = [];
    this.detail = opts.detail ?? 1;
    this.jitter = opts.jitter ?? MATERIAL_RULES.jitter;
    this.gradient = opts.gradient ?? MATERIAL_RULES.gradient;
    this.shadow = opts.shadow ?? true;
    this.tris = 0;
    this.boxes = []; // [layer, first float, float count] per element, in the order they were laid
  }

  get matrix() {
    return this.stack[this.stack.length - 1];
  }
  push({ x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1 } = {}) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(s, s, s));
    this.stack.push(this.matrix.clone().multiply(_m));
    return this;
  }
  pop() {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }
  at(t, fn) {
    this.push(t);
    fn(this);
    this.pop();
    return this;
  }
  // Bend everything built inside fn: twist (radians at `to`), lean [dx, dz] metres at `to`,
  // both easing in from `from` (structure-local heights) around centre [cx, cz].
  warp({ twist = 0, lean = [0, 0], from = 0, to = 10, center = [0, 0], ease = 2 }, fn) {
    const span = Math.max(0.001, to - from);
    this.warps.push((v) => {
      const t = Math.min(1, Math.max(0, (v.y - from) / span)) ** ease;
      if (twist) {
        const a = twist * t;
        const dx = v.x - center[0];
        const dz = v.z - center[1];
        const c = Math.cos(a), s = Math.sin(a);
        v.x = center[0] + dx * c - dz * s;
        v.z = center[1] + dx * s + dz * c;
      }
      v.x += lean[0] * t;
      v.z += lean[1] * t;
    });
    fn(this);
    this.warps.pop();
    return this;
  }

  // Build fn upside-down, hanging from height y (it grows downward). The sky-lit gradient
  // stays on the upward faces.
  inverted(x, y, z, fn, ry = 0) {
    this.push({ x, y, z, ry, rx: Math.PI });
    this.flip = !this.flip;
    fn(this);
    this.flip = !this.flip;
    this.pop();
    return this;
  }

  color(c) {
    return (this.p && this.p[c]) || c;
  }

  // Core emitter: unit soup -> layer, with a local transform, per-element jitter and the
  // vertical gradient that gives every block a lit top and a shadowed foot.
  emit(unit, local, c, o = {}) {
    const layer = this.layers[o.layer || 'solid'];
    const m = _m.multiplyMatrices(this.matrix, local);
    _c.set(this.color(c));
    const strength = o.strength ?? 1;
    _v.set(0, 0, 0).applyMatrix4(m);
    const j = o.jitter ?? (o.layer === 'glow' ? 0 : this.jitter);
    const f = (1 + (hash3(_v.x, _v.y, _v.z) - 0.5) * 2 * j) * strength;
    const grad = o.grad ?? (o.layer === 'glow' ? 0 : this.gradient);
    const r = _c.r * f, g = _c.g * f, b = _c.b * f;
    const v = new THREE.Vector3();
    // every element but a rock is remembered so build() can part its flush faces (see unflush;
    // a warp leaves a level face level, and a face it bends simply finds nothing flush with it)
    if (unit !== ROCK) this.boxes.push(layer, layer.pos.length, unit.length);
    for (let i = 0; i < unit.length; i += 3) {
      const uy = this.flip ? 0.5 - unit[i + 1] : unit[i + 1] + 0.5;
      v.set(unit[i], unit[i + 1], unit[i + 2]).applyMatrix4(m);
      for (const w of this.warps) w(v);
      layer.pos.push(v.x, v.y, v.z);
      const k = 1 - grad * (1 - uy);
      layer.col.push(r * k, g * k, b * k);
    }
    this.tris += unit.length / 9;
    return this;
  }
  local(x, y, z, sx, sy, sz, o = {}) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')),
      new THREE.Vector3(sx, sy, sz),
    );
  }

  // ------------------------------------------------------------ primitives
  // Centre-based box.
  block(x, y, z, w, h, d, c = 'stone', o = {}) {
    return this.emit(BOX, this.local(x, y, z, w, h, d, o), c, o);
  }
  // Base-based box: stands on y.
  slab(x, y, z, w, h, d, c = 'stone', o = {}) {
    if (o.rx || o.rz) {
      return this.at({ x, y, z, ry: o.ry || 0, rx: o.rx || 0, rz: o.rz || 0 }, (k) => k.emit(BOX, k.local(0, h / 2, 0, w, h, d), c, { ...o, ry: 0, rx: 0, rz: 0 }));
    }
    return this.emit(BOX, this.local(x, y + h / 2, z, w, h, d, o), c, o);
  }
  prism(x, y, z, r, h, c = 'stone', o = {}) {
    const n = o.sides ?? 8;
    return this.emit(prismUnit(n, o.top ?? 1), this.local(x, y + h / 2, z, r, h, o.dr ?? r, o), c, o);
  }
  pyramid(x, y, z, r, h, c = 'roof', o = {}) {
    return this.emit(prismUnit(o.sides ?? 4, 0), this.local(x, y + h / 2, z, r, h, r, o), c, o);
  }
  wedge(x, y, z, w, h, d, c = 'roof', o = {}) {
    return this.emit(WEDGE, this.local(x, y + h / 2, z, w, h, d, o), c, o);
  }
  ramp(x, y, z, w, h, d, c = 'stone', o = {}) {
    return this.emit(RAMP, this.local(x, y + h / 2, z, w, h, d, o), c, o);
  }
  crystal(x, y, z, r, h, c = 'crystal', o = {}) {
    return this.emit(OCTA, this.local(x, y + h / 2, z, r * 2, h, r * 2, o), c, { layer: 'crystal', grad: 0.25, ...o });
  }
  rock(x, y, z, sx, sy, sz, c = 'stone2', o = {}) {
    return this.emit(ROCK, this.local(x, y, z, sx, sy, sz, o), c, { grad: 0.3, ...o });
  }
  glowPanel(x, y, z, w, h, d, c = 'glow', strength = 1.4, o = {}) {
    return this.emit(BOX, this.local(x, y, z, w, h, d, o), c, { ...o, layer: 'glow', strength });
  }
  geometry(geo, c, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const a = g.attributes.position.array;
    // remap y into the unit range so the gradient still works
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < a.length; i += 3) {
      lo = Math.min(lo, a[i]);
      hi = Math.max(hi, a[i]);
    }
    const span = Math.max(0.001, hi - lo);
    const unit = new Float32Array(a.length);
    for (let i = 0; i < a.length; i += 3) {
      unit[i] = a[i];
      unit[i + 1] = (a[i + 1] - lo) / span - 0.5;
      unit[i + 2] = a[i + 2];
    }
    const l = this.local(o.x || 0, (o.y || 0) + lo + span / 2, o.z || 0, 1, span, 1, o);
    return this.emit(unit, l, c, o);
  }

  // ------------------------------------------------------------ masonry
  // A block of coursed masonry: alternate courses step in a hair and shift tone, which is
  // what makes a low-poly wall read as built rather than extruded.
  masonry(x, y, z, w, h, d, o = {}) {
    const c = o.c || 'stone';
    const c2 = o.c2 || o.c || 'stone2';
    if (this.detail < 1 || h < SCALE.course * 2.5) return this.slab(x, y, z, w, h, d, c, o);
    const course = o.course ?? SCALE.course * 2;
    const n = Math.max(2, Math.round(h / course));
    const ch = h / n;
    const inset = o.inset ?? Math.min(0.08, Math.min(w, d) * 0.03);
    for (let i = 0; i < n; i++) {
      const odd = i % 2 === 1;
      this.slab(x, y + i * ch, z, w - (odd ? inset * 2 : 0), ch, d - (odd ? inset * 2 : 0), odd ? c2 : c, o);
    }
    return this;
  }
  // Footing from below the lowest ground up to `top`, with a projecting base course.
  footing(x, z, w, d, top, lowest, c = 'stone2', o = {}) {
    const bottom = Math.min(lowest, top) - SCALE.footing;
    this.slab(x, bottom, z, w, top - bottom, d, c, o);
    this.slab(x, top - 0.35, z, w + 0.4, 0.35, d + 0.4, o.cap || 'edge', o);
    return this;
  }
  cornice(x, y, z, w, d, c = 'edge', o = {}) {
    this.slab(x, y, z, w + 0.3, 0.22, d + 0.3, o.c2 || 'stone2', o);
    this.slab(x, y + 0.22, z, w + 0.65, 0.26, d + 0.65, c, o);
    return this;
  }
  // Stepped buttress against a wall face; ry points it outward along +z.
  buttress(x, y, z, h, o = {}) {
    const w = o.w ?? 1.1;
    const depth = o.depth ?? 1.6;
    const stages = this.detail < 1 ? 1 : (o.stages ?? 3);
    const c = o.c || 'stone2';
    this.at({ x, y, z, ry: o.ry || 0 }, (k) => {
      let yy = 0;
      for (let s = 0; s < stages; s++) {
        const sh = (h / stages) * (s === stages - 1 ? 1 : 1);
        const dd = depth * (1 - s / (stages + 0.6));
        k.slab(0, yy, dd / 2, w - s * 0.12, sh, dd, c);
        k.ramp(0, yy + sh, dd / 2, w - s * 0.12, Math.min(0.9, dd * 0.6), dd, o.cap || 'edge', { ry: Math.PI });
        yy += sh;
      }
    });
    return this;
  }
  pinnacle(x, y, z, s = 1, o = {}) {
    const c = o.c || 'stone';
    this.slab(x, y, z, 0.9 * s, 1.6 * s, 0.9 * s, c);
    this.slab(x, y + 1.6 * s, z, 1.1 * s, 0.2 * s, 1.1 * s, 'edge');
    this.pyramid(x, y + 1.8 * s, z, 0.62 * s, 2.4 * s, o.roof || c, { sides: 4 });
    if (o.finial) this.prism(x, y + 4.1 * s, z, 0.12 * s, 0.6 * s, o.finial, { sides: 4, layer: 'metal' });
    return this;
  }
  crenels(ax, az, bx, bz, y, t, o = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    const ry = Math.atan2(bx - ax, bz - az);
    const mw = SCALE.merlon.w, gap = SCALE.merlon.gap;
    const n = Math.max(1, Math.floor((len + gap) / (mw + gap)));
    const used = n * mw + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const u = -used / 2 + mw / 2 + i * (mw + gap);
      const f = (len / 2 + u) / len;
      if (o.skip && o.skip(i, n)) continue;
      this.slab(ax + (bx - ax) * f, y, az + (bz - az) * f, t, o.h ?? SCALE.merlon.h, mw, o.c || 'stone', { ry });
    }
    return this;
  }
  // A recessed window: dark reveal, sill and lintel; lit windows glow.
  window(x, y, z, w = SCALE.window.w, h = SCALE.window.h, o = {}) {
    const ry = o.ry || 0;
    this.at({ x, y, z, ry }, (k) => {
      if (o.lit) k.glowPanel(0, h / 2, 0.02, w, h, 0.08, o.glow || 'glow', o.strength ?? 1.3);
      else k.block(0, h / 2, 0.02, w, h, 0.08, o.dark || 'dark', { grad: 0 });
      if (o.pointed) k.wedge(0, h, 0.02, w, w * 0.7, 0.08, o.lit ? (o.glow || 'glow') : (o.dark || 'dark'), { layer: o.lit ? 'glow' : 'solid', strength: o.strength ?? 1.3, grad: 0 });
      if (this.detail >= 1) {
        k.slab(0, -0.14, 0.1, w + 0.3, 0.14, 0.24, o.trim || 'edge');
        if (!o.pointed) k.slab(0, h, 0.08, w + 0.3, 0.2, 0.2, o.trim || 'edge');
      }
    });
    return this;
  }

  // A wall run from A to B standing on y. Options: t (thickness), buttress spacing,
  // crenels, cornice, plinth, windows, and ruin: an rng that breaks the top into a stepped
  // profile and leaves the fallen courses as rubble at the foot.
  wall(ax, az, bx, bz, y, h, o = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) return this;
    const t = o.t ?? SCALE.wall;
    const ry = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    this.at({ x: mx, y, z: mz, ry }, (k) => {
      // local: length along z, thickness along x
      const segs = o.ruin ? Math.max(2, Math.round(len / 2.2)) : 1;
      const sl = len / segs;
      let fallen = 0;
      for (let i = 0; i < segs; i++) {
        let hh = h;
        if (o.ruin) {
          const r = o.ruin();
          const edge = Math.min(i, segs - 1 - i) / Math.max(1, segs / 2);
          hh = h * Math.max(o.minFrac ?? 0.12, Math.min(1, 0.35 + edge * 0.5 + r * 0.45));
          fallen += (h - hh) * sl;
        }
        const z0 = -len / 2 + sl * (i + 0.5);
        k.masonry(0, 0, z0, t, hh, sl + 0.01, { c: o.c, c2: o.c2 });
        if (o.cornice && !o.ruin) k.cornice(0, hh - 0.48, z0, t, sl, o.trim || 'edge');
      }
      if (o.plinth !== false && this.detail >= 1) k.slab(0, 0, 0, t + 0.5, 0.5, len + 0.5, o.trim || 'stone2');
      if (o.crenel && !o.ruin) {
        k.crenels(0, -len / 2, 0, len / 2, h, t, { c: o.c });
      }
      if (o.buttress && this.detail >= 1) {
        const n = Math.max(1, Math.round(len / o.buttress));
        for (let i = 0; i <= n; i++) {
          const z0 = -len / 2 + (len / n) * i;
          for (const side of o.bothSides ? [-1, 1] : [1]) {
            const bh = (o.ruin ? h * 0.55 : h * 0.82);
            k.buttress(side * t / 2, 0, z0, bh, { ry: side > 0 ? Math.PI / 2 : -Math.PI / 2, c: o.c2 || o.c, depth: Math.min(1.8, t * 1.4) });
          }
        }
      }
      if (o.windows && this.detail >= 1 && !o.ruin) {
        const n = Math.max(1, Math.floor(len / (o.windowEvery ?? 4.5)));
        for (let i = 0; i < n; i++) {
          const z0 = -len / 2 + (len / n) * (i + 0.5);
          for (const side of [-1, 1]) k.window(side * (t / 2 + 0.01), o.windowY ?? h * 0.45, z0, 0.8, 1.6, { ry: side * Math.PI / 2, lit: o.lit, pointed: o.pointed });
        }
      }
      if (o.ruin && fallen > 0 && this.detail >= 1 && o.rubble !== false) {
        const piles = Math.max(1, Math.round(len / 6));
        for (let p = 0; p < piles; p++) {
          const side = o.ruin() < 0.5 ? -1 : 1;
          k.rubble(side * (t / 2 + 1.0), 0, -len / 2 + (len / piles) * (p + 0.5), 1.6, 6, o.ruin, { c: o.c || 'stone', c2: o.c2 || 'stone2' });
        }
      }
    });
    return this;
  }

  // Composed debris: big pieces first, smaller ones rolled further out, all resting on y.
  rubble(x, y, z, r, n, rng, o = {}) {
    const rand = rng || Math.random;
    const c = o.c || 'stone', c2 = o.c2 || 'stone2';
    const size = o.size ?? 1;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const a = rand() * Math.PI * 2;
      const d = r * (0.15 + t * 0.85) * (0.6 + rand() * 0.4);
      const s = size * (1.1 - t * 0.65) * (0.7 + rand() * 0.5);
      const w = s * (0.9 + rand() * 0.6), h = s * (0.45 + rand() * 0.35), dd = s * (0.7 + rand() * 0.5);
      // o.ground(x, z): on a slope each stone beds into the ground under it, not the pile's centre
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = o.ground ? Math.min(o.ground(px, pz), y + h) : y;
      this.slab(px, py - h * 0.15, pz, w, h, dd, i % 3 ? c : c2, { ry: rand() * 3, rz: (rand() - 0.5) * 0.35, rx: (rand() - 0.5) * 0.25 });
    }
    return this;
  }

  // ------------------------------------------------------------ orders
  column(x, y, z, h, r = 0.5, o = {}) {
    const c = o.c || 'stone';
    const sides = o.sides ?? 8;
    if (this.detail < 1) return this.prism(x, y, z, r * 1.1, h, c, { sides: 6 });
    const base = Math.min(0.5, h * 0.06);
    this.slab(x, y, z, r * 2.6, base, r * 2.6, o.trim || 'edge');
    this.prism(x, y + base, z, r * 1.25, base * 0.6, c, { sides, top: 0.86 });
    const shaftH = h - base * 1.6 - (o.capital === false ? 0 : r * 1.4);
    this.prism(x, y + base * 1.6, z, r, shaftH, c, { sides, top: o.taper ?? 0.88 });
    if (o.capital !== false) {
      this.prism(x, y + base * 1.6 + shaftH, z, r * 0.9, r * 0.8, c, { sides, top: 1.45 });
      this.slab(x, y + h - r * 0.6, z, r * 2.7, r * 0.6, r * 2.7, o.trim || 'edge');
    }
    return this;
  }
  // Square pier with base and impost blocks.
  pier(x, y, z, w, h, o = {}) {
    this.masonry(x, y, z, w, h, o.d ?? w, { c: o.c, c2: o.c2 });
    if (this.detail >= 1) {
      this.slab(x, y, z, w + 0.3, 0.45, (o.d ?? w) + 0.3, o.trim || 'edge');
      this.slab(x, y + h - 0.35, z, w + 0.35, 0.35, (o.d ?? w) + 0.35, o.trim || 'edge');
    }
    return this;
  }
  // Voussoir arch springing at y over a span along local x; depth along z.
  arch(x, y, z, span, o = {}) {
    const t = o.t ?? Math.max(0.5, span * 0.12);
    const depth = o.depth ?? 1.2;
    const pointed = o.pointed ?? false;
    let n = this.detail < 1 ? 4 : (o.segments ?? Math.max(7, Math.round(span * 1.4)));
    const R = span / 2;
    const c = o.c || 'edge';
    const pts = [];
    if (pointed) {
      // two arcs, each centred inside the opposite half, meeting at the apex
      const rr = span * (o.sharp ?? 0.8);
      const cx = -R + rr;
      const thA = Math.acos((R - rr) / rr);
      const half = Math.max(2, Math.ceil(n / 2));
      const left = [];
      for (let i = 0; i <= half; i++) {
        const th = Math.PI - (Math.PI - thA) * (i / half);
        left.push([cx + rr * Math.cos(th), rr * Math.sin(th)]);
      }
      pts.push(...left);
      for (let i = half - 1; i >= 0; i--) pts.push([-left[i][0], left[i][1]]);
      n = pts.length - 1;
    } else {
      for (let i = 0; i <= n; i++) {
        const a = Math.PI - (i / n) * Math.PI;
        pts.push([Math.cos(a) * R, Math.sin(a) * R * (o.rise ? o.rise / R : 1)]);
      }
    }
    this.at({ x, y, z, ry: o.ry || 0 }, (k) => {
      // One keystone at the crown. Pointed arches used to mark both apex segments and
      // grow them inward, which read as a protruding twin blob in the passage.
      const keyI = Math.floor((n - 1) / 2);
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const key = i === keyI;
        const tk = key ? t * 1.12 : t;
        // Grow the key outward along the normal so it sits proud of the face, not into the opening.
        const grow = (tk - t) / 2;
        k.block(mx + nx * (t / 2 + grow), my + ny * (t / 2 + grow), 0, len + 0.04, tk, depth, key ? (o.key || 'stone') : c, { rz: ang });
      }
      if (o.spandrel) {
        const apex = Math.max(...pts.map((p) => p[1]));
        const top = apex + t + (o.spandrelH ?? 0.4);
        const inner = (xm) => {
          if (Math.abs(xm) >= R) return 0;
          for (let i = 0; i < pts.length - 1; i++) {
            const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
            if ((xm - x0) * (xm - x1) <= 0 && x1 !== x0) return y0 + ((xm - x0) / (x1 - x0)) * (y1 - y0);
          }
          return 0;
        };
        const cols = Math.max(2, Math.round(span / 1.2));
        for (let i = 0; i < cols; i++) {
          const u0 = i / cols, u1 = (i + 1) / cols;
          const xx0 = -R - t + u0 * (span + 2 * t), xx1 = -R - t + u1 * (span + 2 * t);
          const xm = (xx0 + xx1) / 2;
          const inside = Math.abs(xm) < R ? inner(xm) + t * 0.9 : 0;
          const hh = top - inside;
          if (hh > 0.05) k.slab(xm, inside, 0, xx1 - xx0 + 0.02, hh, depth * 0.96, o.fill || 'stone');
        }
      }
    });
    return this;
  }
  // Arcade of n arches between A and B on piers of height pierH.
  arcade(ax, az, bx, bz, y, n, pierH, o = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    const ry = Math.atan2(bz - az, bx - ax);
    const pw = o.pier ?? 1.4;
    const span = (len - pw * (n + 1)) / n;
    this.at({ x: ax, y, z: az, ry: -ry }, (k) => {
      for (let i = 0; i <= n; i++) {
        const px = pw / 2 + i * (span + pw);
        if (o.broken && o.broken.includes(i)) continue;
        const ph = o.pierHeights ? o.pierHeights[i] ?? pierH : pierH;
        k.pier(px, 0, 0, pw, ph, { d: o.depth ?? pw, c: o.c, c2: o.c2 });
      }
      for (let i = 0; i < n; i++) {
        if (o.broken && (o.broken.includes(i) || o.broken.includes(i + 1))) continue;
        const cx = pw + i * (span + pw) + span / 2;
        k.arch(cx, pierH, 0, span, { t: o.t ?? Math.max(0.6, span * 0.14), depth: o.depth ?? pw, spandrel: true, spandrelH: o.spandrelH ?? 0.6, c: o.archC || 'edge', fill: o.c || 'stone' });
      }
    });
    return this;
  }
  // Solid stair: every step reaches the ground below it. Climbs along +z from (x, y, z).
  stair(x, y, z, w, n, o = {}) {
    const rise = o.rise ?? SCALE.step.rise;
    const run = o.run ?? SCALE.step.run;
    const base = o.base ?? y - 0.4;
    this.at({ x, y: 0, z, ry: o.ry || 0 }, (k) => {
      for (let i = 0; i < n; i++) {
        const top = y + rise * (i + 1);
        k.slab(0, base, run * (i + 0.5), w, top - base, run + 0.02, i % 2 ? (o.c2 || o.c || 'stone2') : (o.c || 'stone'));
      }
      if (o.cheeks !== false && this.detail >= 1) {
        for (const side of [-1, 1]) {
          k.slab(side * (w / 2 + 0.25), base, (run * n) / 2, 0.5, y - base + 0.25, run * n, o.trim || 'edge');
          k.ramp(side * (w / 2 + 0.25), y + 0.25, (run * n) / 2, 0.5, rise * n, run * n, o.trim || 'edge', { ry: Math.PI });
        }
      }
    });
    return this;
  }

  // ------------------------------------------------------------ roofs & towers
  roof(kind, x, y, z, w, d, h, o = {}) {
    const c = o.c || 'roof';
    const ov = o.overhang ?? 0.5;
    const ry = o.ry || 0;
    if (kind === 'gable') {
      this.wedge(x, y, z, w + ov * 2, h, d + ov * 2, c, { ry });
      if (this.detail >= 1) this.at({ x, y, z, ry }, (k) => k.slab(0, h - 0.05, 0, 0.3, 0.25, d + ov * 2 + 0.1, o.ridge || 'dark'));
    } else if (kind === 'hip') {
      this.emit(prismUnit(4, 0.22), this.local(x, y + h / 2, z, (w + ov * 2) / Math.SQRT2, h, (d + ov * 2) / Math.SQRT2, { ry }), c);
      if (this.detail >= 1) this.at({ x, y, z, ry }, (k) => k.slab(0, h - 0.08, 0, (w + ov * 2) * 0.24, 0.22, (d + ov * 2) * 0.24, o.ridge || 'dark'));
    } else if (kind === 'spire') {
      this.pyramid(x, y, z, (w + ov * 2) / Math.SQRT2, h, c, { sides: o.sides ?? 4, ry });
    } else if (kind === 'cone') {
      this.pyramid(x, y, z, w / 2 + ov, h, c, { sides: o.sides ?? 8 });
    } else if (kind === 'dome') {
      const rings = this.detail < 1 ? 2 : 4;
      for (let i = 0; i < rings; i++) {
        const a0 = (i / rings) * Math.PI / 2, a1 = ((i + 1) / rings) * Math.PI / 2;
        const r0 = Math.cos(a0) * w / 2, r1 = Math.cos(a1) * w / 2;
        const y0 = Math.sin(a0) * h, y1 = Math.sin(a1) * h;
        this.prism(x, y + y0, z, r0, y1 - y0, c, { sides: o.sides ?? 10, top: r1 / r0 });
      }
    }
    return this;
  }
  // A tower: footing course, coursed body with setbacks, string courses, windows, top.
  tower(x, y, z, w, h, o = {}) {
    const c = o.c || 'stone', c2 = o.c2 || 'stone2';
    const sides = o.sides ?? 4;
    const setbacks = o.setbacks ?? [0.45, 0.75];
    let yy = y;
    let ww = w;
    const stages = [0, ...setbacks, 1];
    for (let s = 0; s < stages.length - 1; s++) {
      const sh = (stages[s + 1] - stages[s]) * h;
      if (sides === 4) this.masonry(x, yy, z, ww, sh, ww, { c, c2 });
      else this.prism(x, yy, z, ww / 2 / Math.cos(Math.PI / sides), sh, s % 2 ? c2 : c, { sides });
      if (this.detail >= 1) {
        if (sides === 4) this.slab(x, yy + sh - 0.3, z, ww + 0.35, 0.3, ww + 0.35, o.trim || 'edge');
        if (o.windows !== false && sides === 4 && sh > 4) {
          const wy = yy + sh * 0.5;
          for (let f = 0; f < 4; f++) {
            const a = (f * Math.PI) / 2;
            this.window(x + Math.sin(a) * (ww / 2 + 0.01), wy, z + Math.cos(a) * (ww / 2 + 0.01), 0.7, 1.5, { ry: a, lit: o.lit, pointed: o.pointed, glow: o.glow });
          }
        }
      }
      yy += sh;
      if (s < stages.length - 2) ww *= o.taper ?? 0.82;
    }
    if (o.crenel && sides === 4) {
      const hw = ww / 2;
      this.slab(x, yy, z, ww + 0.6, 0.35, ww + 0.6, o.trim || 'edge');
      for (const [ax, az, bx, bz] of [[-hw, -hw, hw, -hw], [hw, -hw, hw, hw], [hw, hw, -hw, hw], [-hw, hw, -hw, -hw]]) this.crenels(x + ax, z + az, x + bx, z + bz, yy + 0.35, 0.5, { c });
    }
    if (o.roof) this.roof(o.roof, x, yy + (o.crenel ? 0.35 : 0), z, ww, ww, o.roofH ?? ww * 1.6, { c: o.roofC || 'roof', sides: sides === 4 ? 4 : sides, overhang: o.overhang ?? 0.35 });
    return yy;
  }
  // Two-stage flying buttress from an outer pier top (a) leaning onto a wall (b).
  flyer(a, b, o = {}) {
    const t = o.t ?? 0.9;
    const w = o.w ?? 0.9;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const horiz = Math.hypot(dx, dz);
    const ry = Math.atan2(dx, dz);
    const n = this.detail < 1 ? 3 : (o.segments ?? 7);
    const sag = o.sag ?? horiz * 0.28;
    this.at({ x: a[0], y: a[1], z: a[2], ry }, (k) => {
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const pz = u * horiz;
        const py = u * dy - Math.sin(u * Math.PI) * sag * 0.35 + u * (1 - u) * sag * 0.0;
        if (prev) {
          const mz = (prev[0] + pz) / 2, my = (prev[1] + py) / 2;
          const len = Math.hypot(pz - prev[0], py - prev[1]);
          const ang = Math.atan2(py - prev[1], pz - prev[0]);
          k.block(0, my, mz, w, t, len + 0.05, o.c || 'stone', { rx: -ang });
        }
        prev = [pz, py];
      }
      // the sloped coping on top
      const ang = Math.atan2(dy, horiz);
      k.block(0, dy / 2 + t * 0.55, horiz / 2, w * 0.7, 0.25, Math.hypot(horiz, dy), o.trim || 'edge', { rx: -ang });
    });
    return this;
  }
  banner(x, y, z, w, h, c = 'cloth', o = {}) {
    this.at({ x, y, z, ry: o.ry || 0 }, (k) => {
      k.slab(0, 0, 0, w, h, 0.08, c, { grad: 0.3 });
      k.slab(0, h - 0.05, 0, w + 0.4, 0.14, 0.14, o.rod || 'metal', { layer: 'metal' });
      k.wedge(0, -w * 0.4, 0, w, w * 0.4, 0.08, c, { rz: Math.PI, grad: 0.3 });
    });
    return this;
  }
  // Iron lantern on a post; returns the world-local flame position.
  lantern(x, y, z, o = {}) {
    const ph = o.post ?? 2.6;
    if (ph > 0) {
      this.slab(x, y, z, 0.5, 0.3, 0.5, o.base || 'stone2');
      this.prism(x, y + 0.3, z, 0.09, ph - 0.3, o.metal || 'dark', { sides: 4, layer: 'metal' });
    }
    const ly = y + ph;
    this.slab(x, ly, z, 0.46, 0.1, 0.46, 'dark', { layer: 'metal' });
    this.glowPanel(x, ly + 0.36, z, 0.3, 0.5, 0.3, o.glow || 'glow', o.strength ?? 1.5);
    this.pyramid(x, ly + 0.62, z, 0.38, 0.32, 'dark', { layer: 'metal' });
    return new THREE.Vector3(x, ly + 0.36, z).applyMatrix4(this.matrix);
  }

  // ------------------------------------------------------------ output
  build(name = 'kit') {
    unflush(this.boxes);
    const g = new THREE.Group();
    g.name = name;
    for (const [key, layer] of Object.entries(this.layers)) {
      if (!layer.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(layer.pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(layer.col, 3));
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      // where each straight element starts (and its length), so world/merge.js can part flush faces between structures
      const starts = [];
      for (let i = 0; i < this.boxes.length; i += 3) if (this.boxes[i] === layer) starts.push(this.boxes[i + 1], this.boxes[i + 2]);
      if (starts.length) geo.userData.boxes = starts;
      const mesh = new THREE.Mesh(geo, KIT_MATERIALS[key]);
      mesh.name = `${name}_${key}`;
      mesh.castShadow = this.shadow && key !== 'glow';
      mesh.receiveShadow = key !== 'glow';
      g.add(mesh);
    }
    this.boxes = [];
    return g;
  }
}

// Two elements whose faces share a plane and overlap (a floor laid on a plinth, a trim flush
// with its wall, a cap on a footing) fight for the same depth and flicker as the camera
// moves. The block laid later is the one meant to show, so its face is moved out along its
// normal by 1.2 cm per block already under it (at most three steps): invisible at arm's length,
// and enough for the depth buffer to tell the two apart across a town. Faces up to 11 mm
// apart count as flush (they fight too, from further off); one laid just under another is
// first lifted level with it.
const UNFLUSH = 0.012;
const UNFLUSH_STEPS = 3;
const UNFLUSH_NEAR = 0.011;
export function unflush(boxes) {
  if (boxes.length < 6) return;
  const faces = new Map();
  const list = [];
  for (let e = 0; e < boxes.length; e += 3) {
    const pos = boxes[e].pos, s = boxes[e + 1], end = s + boxes[e + 2];
    // the element's flat faces: its triangles grouped by plane
    const own = new Map();
    for (let o = s; o < end; o += 9) {
      const ax = pos[o], ay = pos[o + 1], az = pos[o + 2];
      const ux = pos[o + 3] - ax, uy = pos[o + 4] - ay, uz = pos[o + 5] - az;
      const vx = pos[o + 6] - ax, vy = pos[o + 7] - ay, vz = pos[o + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-6) continue;
      nx /= len; ny /= len; nz /= len;
      const d = nx * ax + ny * ay + nz * az;
      const key = `${Math.round(nx * 500)},${Math.round(ny * 500)},${Math.round(nz * 500)},`;
      const bin = Math.round(d * 200); // 5 mm
      let face = own.get(key + bin);
      if (!face) {
        face = { e, pos, s, end, tris: [], nx, ny, nz, d, rank: 0, poly: null };
        own.set(key + bin, face);
        for (const b of [bin - 2, bin - 1, bin, bin + 1, bin + 2]) {
          const L = faces.get(key + b);
          if (L) for (const other of L) list.push([other, face]);
        }
        let L = faces.get(key + bin);
        if (!L) faces.set(key + bin, (L = []));
        L.push(face);
      }
      face.tris.push(o);
    }
  }
  if (!list.length) return;
  // in the order the later face was laid, so the faces under it already have their places
  list.sort((a, b) => a[1].e - b[1].e || a[1].tris[0] - b[1].tris[0] || a[0].e - b[0].e);
  const moved = [];
  for (let i = 0; i < list.length; ) {
    const over = list[i][1];
    const taken = new Set();
    let lift = 0; // how far the face sits under the faces it overlaps, before it is parted
    for (; i < list.length && list[i][1] === over; i++) {
      const under = list[i][0];
      if (under.e === over.e || Math.abs(under.d - over.d) > UNFLUSH_NEAR) continue;
      if (overlapArea(facePoly(under), facePoly(over)) < 0.0025) continue;
      taken.add(under.rank);
      lift = Math.max(lift, under.d - over.d);
    }
    if (!taken.size) continue;
    // one step above the highest face under it; a ring of blocks each over the last (an arena's
    // tiers, a round tower's courses) would climb forever, so past the cap any free step will do
    let r = Math.max(...taken) + 1;
    if (r > UNFLUSH_STEPS) for (r = 0; taken.has(r); r++);
    over.rank = r;
    over.lift = lift;
    if (r) moved.push(over);
  }
  for (const f of moved) {
    const pos = f.pos;
    const off = UNFLUSH * f.rank + f.lift;
    for (let i = f.s; i < f.end; i += 3) {
      if (Math.abs(pos[i] * f.nx + pos[i + 1] * f.ny + pos[i + 2] * f.nz - f.d) > 0.004) continue;
      pos[i] += f.nx * off; pos[i + 1] += f.ny * off; pos[i + 2] += f.nz * off;
    }
  }
}
// A face's outline in its own plane: the convex hull of its triangles' corners.
function facePoly(f) {
  if (f.poly) return f.poly;
  const ax = Math.abs(f.ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let ux = ax[1] * f.nz - ax[2] * f.ny, uy = ax[2] * f.nx - ax[0] * f.nz, uz = ax[0] * f.ny - ax[1] * f.nx;
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const wx = f.ny * uz - f.nz * uy, wy = f.nz * ux - f.nx * uz, wz = f.nx * uy - f.ny * ux;
  const pts = [];
  for (const o of f.tris) {
    for (let q = 0; q < 9; q += 3) {
      const x = f.pos[o + q], y = f.pos[o + q + 1], z = f.pos[o + q + 2];
      pts.push([x * ux + y * uy + z * uz, x * wx + y * wy + z * wz]);
    }
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return (f.poly = lower.concat(upper));
}
// Area shared by two convex polygons (Sutherland-Hodgman).
function overlapArea(subject, clipper) {
  let out = subject;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  let s = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

// A structure's footprint in the world: local (x, z) metres around an origin turned by
// yaw, the same transform a Kit group placed at (x, y, z) with rotation.y = yaw applies.
// Colliders and ground queries go through it so they never drift from the visuals.
export function siteFrame(world, x, z, yaw = 0, y = world.terrain.heightAt(x, z)) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const solid = (lx, lz, w, d, y0, y1, o = {}) => {
    const [wx, wz] = at(lx, lz);
    return world.colliders.addBox({ x: wx, z: wz, w, d, y0: y + y0, y1: y + y1, rot: yaw + (o.rot || 0), climbable: o.climbable ?? true, walkable: o.walkable ?? true, tag: o.tag ?? null });
  };
  const pillar = (lx, lz, r, y0, y1, o = {}) => {
    const [wx, wz] = at(lx, lz);
    world.colliders.addCyl({ x: wx, z: wz, r, y0: y + y0, y1: y + y1, climbable: o.climbable ?? true });
  };
  const ground = (lx, lz) => world.terrain.heightAt(...at(lx, lz)) - y;
  const lowest = (w, d, lx = 0, lz = 0, rot = 0) => {
    const [wx, wz] = at(lx, lz);
    return groundRange(world.terrain, wx, wz, w, d, yaw + rot, 3)[0] - y;
  };
  return { x, z, y, yaw, at, solid, pillar, ground, lowest };
}

// Lowest and highest terrain under a rotated local rectangle.
export function groundRange(terrain, cx, cz, w, d, ry = 0, samples = 3) {
  let lo = Infinity, hi = -Infinity;
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i <= samples; i++) {
    for (let j = 0; j <= samples; j++) {
      const lx = (i / samples - 0.5) * w, lz = (j / samples - 0.5) * d;
      const h = terrain.heightAt(cx + lx * c + lz * s, cz - lx * s + lz * c);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  return [lo, hi];
}
