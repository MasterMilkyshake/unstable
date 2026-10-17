// Non-humanoid creature models with simple procedural animation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp } from '../core/util.js';
import { G as GL } from '../core/globals.js';

function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0,
    emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1,
    transparent: !!o.transparent, opacity: o.opacity ?? 1,
  });
}
function P(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
function G(x = 0, y = 0, z = 0, parent = null) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const Cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const _up = new THREE.Vector3(0, 1, 0);
// Turn a mesh (a cone's tip, a box's long side) to point along (x, y, z) in its parent.
function aim(m, x, y, z) {
  m.quaternion.setFromUnitVectors(_up, new THREE.Vector3(x, y, z).normalize());
  return m;
}
// Small parts (teeth, claws, glints) are not worth a shadow.
const bare = (m) => ((m.castShadow = false), m);
// A detailed body is built from many small parts. Within each group (each moving joint), the
// parts that share a material and a shadow setting become one mesh, so the beast draws in a
// handful of calls; joints and anything an animator holds (c.p) are left as they are.
function mergeParts(c) {
  const held = new Set(Object.values(c.p).flat());
  const groups = [];
  c.root.traverse((o) => o.isGroup && groups.push(o));
  for (const g of groups) {
    const sets = new Map();
    for (const m of g.children) {
      if (!m.isMesh || held.has(m)) continue;
      const key = m.material.id + (m.castShadow ? 's' : '');
      if (!sets.has(key)) sets.set(key, []);
      sets.get(key).push(m);
    }
    for (const parts of sets.values()) {
      if (parts.length < 2) continue;
      const geos = parts.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const one = new THREE.Mesh(mergeGeometries(geos), parts[0].material);
      one.castShadow = parts[0].castShadow;
      for (const m of parts) {
        g.remove(m);
        m.geometry.dispose();
      }
      for (const geo of geos) geo.dispose();
      g.add(one);
    }
  }
}

export class CreatureModel {
  constructor(kind, opts = {}) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.inner = G(0, 0, 0, this.root);
    this.mats = [];
    this.time = Math.random() * 10;
    this.act = null;
    this.weapon = null;
    this.opts = opts;
    this.p = {};
    const build = BUILDERS[kind] || BUILDERS.lurker;
    build(this, opts);
    this.inner.scale.setScalar(opts.size || 1);
    for (const m of this.mats) m.userData.baseEmissive = m.emissive.clone();
    this.flashT = 0;
  }

  mat(color, o) {
    // palette lets enemy variants recolor a shared body plan (base color -> variant color)
    const pal = this.opts.palette;
    if (pal) {
      if (pal[color]) color = pal[color];
      if (o && o.emissive && pal[o.emissive]) o = Object.assign({}, o, { emissive: pal[o.emissive] });
    }
    const m = M(color, o);
    this.mats.push(m);
    return m;
  }

  play(name, timing) {
    this.act = { name, t: 0, w: timing.windup || 0.3, a: timing.active || 0.15, r: timing.recovery || 0.3 };
  }
  stop() {
    this.act = null;
  }
  phase() {
    const a = this.act;
    if (!a) return null;
    if (a.t < a.w) return { ph: 'wind', f: a.t / a.w, name: a.name };
    if (a.t < a.w + a.a) return { ph: 'active', f: (a.t - a.w) / a.a, name: a.name };
    return { ph: 'rec', f: clamp((a.t - a.w - a.a) / a.r, 0, 1), name: a.name };
  }
  // 0 -> 1 during windup, 1 during active, back to 0 during recovery
  pull() {
    const p = this.phase();
    if (!p) return 0;
    if (p.ph === 'wind') return p.f;
    if (p.ph === 'active') return 1;
    return 1 - p.f;
  }
  strike() {
    const p = this.phase();
    if (!p) return 0;
    if (p.ph === 'active') return Math.sin(p.f * Math.PI * 0.5);
    if (p.ph === 'rec') return 1 - p.f;
    return 0;
  }

  flash(color = '#ffffff', intensity = 0.8, time = 0.12) {
    this.flashT = time;
    this.flashDur = time;
    this.flashColor = new THREE.Color(color);
    this.flashI = intensity;
  }
  updateFlash(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / this.flashDur) * this.flashI;
      for (const m of this.mats) m.emissive.copy(m.userData.baseEmissive).lerp(this.flashColor, k);
      if (this.flashT <= 0) for (const m of this.mats) m.emissive.copy(m.userData.baseEmissive);
    }
  }
  setOpacity(o) {
    for (const m of this.mats) {
      m.transparent = o < 1;
      m.opacity = o;
    }
  }
  setWeapon() {}
  setWeaponVisible() {}

  update(dt, st) {
    this.time += dt;
    if (this.act) {
      this.act.t += dt;
      if (this.act.t > this.act.w + this.act.a + this.act.r) this.act = null;
    }
    const anim = ANIMATORS[this.kind];
    if (anim) anim(this, dt, st);
    if (st.dead) {
      this.inner.rotation.z = lerp(this.inner.rotation.z, Math.PI / 2, 1 - Math.exp(-6 * dt));
      this.inner.position.y = lerp(this.inner.position.y, (this.opts.size || 1) * 0.2, 1 - Math.exp(-6 * dt));
    }
  }

  dispose() {
    this.root.traverse((c) => c.geometry && c.geometry.dispose());
    for (const m of this.mats) m.dispose();
  }
}

const BUILDERS = {
  dummy(c) {
    const wood = c.mat('#6a4a2a');
    const straw = c.mat('#d8c070');
    P(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 6), wood, 0, 0.95, 0, c.inner);
    c.p.body = G(0, 1.0, 0, c.inner);
    P(new THREE.CylinderGeometry(0.25, 0.22, 0.75, 8), straw, 0, 0.25, 0, c.p.body);
    P(Box(1.2, 0.1, 0.1), wood, 0, 0.45, 0, c.p.body);
    P(Sph(0.18), straw, 0, 0.82, 0, c.p.body);
    P(Box(0.3, 0.06, 0.02), c.mat('#a8281c'), 0, 0.84, 0.17, c.p.body);
  },
  lurker(c) {
    const skin = c.mat('#5a6a3a');
    const belly = c.mat('#9a9a6a');
    const body = (c.p.body = G(0, 0.45, 0, c.inner));
    P(Sph(0.5, 8, 6), skin, 0, 0, 0, body).scale.set(1.1, 0.75, 1.4);
    P(Sph(0.42, 8, 5), belly, 0, -0.12, 0.05, body).scale.set(1.0, 0.5, 1.2);
    const head = (c.p.head = G(0, 0.08, 0.55, body));
    P(Box(0.62, 0.3, 0.45), skin, 0, 0.05, 0.12, head);
    c.p.jaw = G(0, -0.08, 0.0, head);
    P(Box(0.58, 0.1, 0.45), belly, 0, -0.04, 0.14, c.p.jaw);
    const eye = c.mat('#ffd23f', { emissive: '#aa8800', ei: 0.6 });
    for (const sx of [-1, 1]) P(Sph(0.08, 6, 4), eye, sx * 0.2, 0.25, 0.05, head);
    c.p.tongue = P(Box(0.08, 0.05, 1), c.mat('#d86a7a'), 0, 0, 0.5, head);
    c.p.tongue.scale.z = 0.01;
    c.p.legs = [];
    for (const [x, z] of [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.35], [0.45, -0.35]]) {
      const l = G(x, -0.1, z, body);
      P(Box(0.14, 0.38, 0.14), skin, 0, -0.18, 0, l);
      c.p.legs.push(l);
    }
    const tail = P(Cone(0.18, 0.7, 5), skin, 0, 0, -0.85, body);
    tail.rotation.x = -Math.PI / 2;
  },
  // Great owl (Gloomowl, Thunderwing, Old Hookbeak): a hunched, near-black bird on long scaled
  // legs, three times a man's height at the tufts. A pale heart-shaped face holds two lamp-like
  // eyes under a frowning brow; the wings hang folded like a cloak, their ragged primaries
  // almost to the ground, until it opens them to dive. Cold glints run along the coverts.
  owl(c) {
    const fea = c.mat('#23202c');
    const mantle = c.mat('#17151d');
    const breast = c.mat('#5d5872');
    const bar = c.mat('#6c6880');
    const face = c.mat('#a39fb0');
    const bone = c.mat('#bdb6a2');
    const talon = c.mat('#0e0d12');
    const eye = c.mat('#d6f6ff', { emissive: '#8fe4ff', ei: 2.2 });
    const glint = c.mat('#9fe6ff', { emissive: '#5fc8f0', ei: 1.6 });
    const body = (c.p.body = G(0, 1.95, 0, c.inner));
    P(Sph(0.85, 10, 8), fea, 0, 0, 0, body).scale.set(1.05, 1.2, 0.95);
    // the breast: a paler shield barred with chevrons
    P(Sph(0.68, 9, 7), breast, 0, -0.05, 0.36, body).scale.set(0.95, 1.15, 0.62);
    for (let r = 0; r < 3; r++) {
      for (const k of [-1, 0, 1]) {
        const b = bare(P(Cone(0.1, 0.28, 3), bar, k * 0.24 * (1 - r * 0.15), 0.36 - r * 0.32, 0.7 - Math.abs(k) * 0.08, body));
        b.rotation.x = Math.PI;
        b.scale.z = 0.35;
      }
    }
    // a ragged mantle at the neck, its feathers pointing out and down
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sx = Math.sin(a), sz = Math.cos(a);
      aim(P(Cone(0.13, 0.6 + (i % 3) * 0.14, 3), mantle, sx * 0.6, 0.78, sz * 0.5, body), sx, -0.75, sz);
    }
    const head = (c.p.head = G(0, 1.05, 0.18, body));
    P(Sph(0.62, 10, 8), fea, 0, 0, 0, head).scale.set(1.18, 0.95, 0.95);
    for (const sx of [-1, 1]) {
      // the facial disc's two lobes, a dark socket in each, and a lamp in the socket
      P(Sph(0.4, 9, 7), face, sx * 0.25, 0.0, 0.38, head).scale.set(1, 1.15, 0.38);
      bare(P(Sph(0.19, 8, 6), talon, sx * 0.25, 0.06, 0.49, head)).scale.z = 0.5;
      bare(P(Sph(0.14, 8, 6), eye, sx * 0.25, 0.06, 0.55, head));
      // a heavy brow, inner end low: it frowns
      P(Box(0.42, 0.09, 0.2), mantle, sx * 0.25, 0.26, 0.5, head).rotation.z = sx * 0.35;
      // horn tufts swept up, out and back
      P(Cone(0.1, 0.85, 4), mantle, sx * 0.42, 0.5, -0.1, head).rotation.set(-0.55, 0, -sx * 0.45);
    }
    // a hooked beak, and a lower mandible that opens to screech
    P(Cone(0.1, 0.36, 4), bone, 0, -0.1, 0.62, head).rotation.x = Math.PI / 2 + 0.75;
    c.p.mandible = G(0, -0.2, 0.56, head);
    bare(P(Cone(0.07, 0.2, 4), bone, 0, 0, 0.06, c.p.mandible)).rotation.x = Math.PI / 2 + 0.2;
    c.p.wings = [];
    for (const sx of [-1, 1]) {
      // the shoulder swings the wing forward; inside it the wing lifts out from the body and
      // then turns on its own length (ZYX), so an opened wing shows its face, not its edge
      const w = G(sx * 0.8, 0.62, -0.08, body);
      const wi = G(0, 0, 0, w);
      wi.rotation.order = 'ZYX';
      // coverts (the wing's shoulder) with a line of glints; primaries hang from them
      P(Box(0.16, 1.05, 0.95), fea, sx * 0.04, -0.5, 0, wi);
      for (let k = 0; k < 4; k++) bare(P(Sph(0.045, 4, 3), glint, sx * 0.13, -0.22 - k * 0.2, 0.3 - k * 0.13, wi));
      const blades = [];
      for (let k = 0; k < 5; k++) {
        const b = G(sx * 0.04, -0.85, 0.34 - k * 0.17, wi);
        const len = 0.95 + ((k * 7) % 3) * 0.15; // uneven: the wing reads ragged
        P(Box(0.06, len, 0.4), mantle, 0, -len / 2, 0, b);
        blades.push(b);
      }
      w.userData.blades = blades;
      w.userData.inner = wi;
      c.p.wings.push(w);
    }
    // a fan of tail feathers, angled down and back
    c.p.tail = G(0, -0.55, -0.72, body);
    c.p.tailBlades = [];
    for (let k = 0; k < 5; k++) {
      const b = G(0, 0, 0, c.p.tail);
      P(Box(0.22, 1.0, 0.05), mantle, 0, -0.45, 0, b);
      c.p.tailBlades.push(b);
    }
    c.p.legs = [];
    for (const sx of [-1, 1]) {
      const l = G(sx * 0.36, -0.75, 0.05, body);
      P(Sph(0.4, 8, 6), fea, 0, -0.1, 0, l).scale.set(1, 1.3, 1.1); // feathered thigh
      const shin = G(0, -0.42, 0.06, l);
      P(Box(0.2, 0.72, 0.2), bone, 0, -0.36, 0, shin);
      const foot = G(0, -0.72, 0, shin);
      for (const a of [-0.45, 0, 0.45]) aim(bare(P(Cone(0.05, 0.38, 3), talon, Math.sin(a) * 0.12, -0.02, 0.12 + Math.cos(a) * 0.08, foot)), Math.sin(a), -0.3, Math.cos(a));
      aim(bare(P(Cone(0.05, 0.28, 3), talon, 0, -0.02, -0.1, foot)), 0, -0.4, -1);
      l.userData.shin = shin;
      c.p.legs.push(l);
    }
    mergeParts(c);
  },
  // Sharko: a pale, hulking walker three times a man's height. It goes on two digitigrade
  // legs, hunched, with long clawed arms that hang to its knuckles; a blunt wedge of a head
  // splits into a jaw with teeth in both rows, gill scars on the neck, a fin on the back of
  // the shoulders and a heavy finned tail for balance.
  sharko(c) {
    const hide = c.mat('#c8c2b4');
    const back = c.mat('#8a847a');
    const belly = c.mat('#e4dfd2');
    const mouth = c.mat('#4a1e24');
    const tooth = c.mat('#f0e9d6');
    const claw = c.mat('#2a2622');
    const eye = c.mat('#14100e', { emissive: '#ffcf6a', ei: 0.9 });
    const hips = (c.p.hips = G(0, 2.35, -0.3, c.inner));
    P(Sph(0.75, 9, 7), hide, 0, 0, 0, hips).scale.set(1.1, 0.8, 1.0);
    // the torso leans forward from the hips; everything above hangs from it
    const body = (c.p.body = G(0, 0.3, 0.2, hips));
    body.rotation.x = 0.55;
    P(Sph(1.05, 10, 8), hide, 0, 0.9, 0, body).scale.set(1.0, 1.25, 1.0);
    P(Sph(0.85, 9, 7), belly, 0, 0.75, 0.42, body).scale.set(0.95, 1.1, 0.6);
    P(Sph(0.85, 9, 7), back, 0, 1.75, -0.05, body).scale.set(1.15, 0.8, 1.0); // shoulder hump
    // a tall fin on the back of the shoulders, raked back: it shows over the head head-on
    const fin = P(Cone(0.45, 1.9, 4), back, 0, 2.15, -0.45, body);
    fin.rotation.x = -0.75;
    fin.scale.z = 0.28;
    const head = (c.p.head = G(0, 1.95, 0.75, body));
    head.rotation.x = -0.45;
    // a long blunt snout, like a shark's, over a jaw as long again
    P(Sph(0.62, 9, 7), hide, 0, 0.2, 0.8, head).scale.set(0.88, 0.6, 1.95);
    P(Box(0.36, 0.12, 1.7), back, 0, 0.55, 0.6, head);
    P(Box(0.76, 0.1, 1.5), mouth, 0, -0.2, 0.8, head); // seen when the jaw drops
    for (let k = 0; k < 5; k++) {
      const a = (k / 4 - 0.5) * 2.2; // round the front of the upper jaw
      bare(P(Cone(0.07, 0.32, 3), tooth, Math.sin(a) * 0.44, -0.12, 0.85 + Math.cos(a) * 0.9, head)).rotation.x = Math.PI;
    }
    for (const sx of [-1, 1]) {
      bare(P(Sph(0.08, 6, 4), eye, sx * 0.46, 0.3, 1.0, head));
      for (let k = 0; k < 2; k++) bare(P(Box(0.05, 0.42, 0.07), mouth, sx * 0.56, 0.0, -0.1 - k * 0.2, head));
    }
    const jaw = (c.p.jaw = G(0, -0.08, 0.05, head));
    P(Sph(0.55, 9, 6), belly, 0, -0.16, 0.8, jaw).scale.set(0.85, 0.35, 1.85);
    for (let k = 0; k < 4; k++) {
      const a = (k / 3 - 0.5) * 2.0;
      bare(P(Cone(0.06, 0.28, 3), tooth, Math.sin(a) * 0.38, 0.0, 0.8 + Math.cos(a) * 0.8, jaw));
    }
    c.p.arms = [];
    for (const sx of [-1, 1]) {
      const a = G(sx * 1.15, 1.45, 0.2, body);
      P(Box(0.52, 1.4, 0.56), hide, 0, -0.65, 0, a);
      const fore = G(0, -1.3, 0, a);
      P(Box(0.46, 1.35, 0.5), hide, 0, -0.65, 0, fore);
      const hand = G(0, -1.32, 0, fore);
      P(Box(0.52, 0.26, 0.54), back, 0, -0.08, 0.05, hand);
      for (const x of [-0.17, 0, 0.17]) aim(bare(P(Cone(0.07, 0.55, 3), claw, x, -0.3, 0.18, hand)), 0, -1, 0.55);
      a.userData.fore = fore;
      c.p.arms.push(a);
    }
    c.p.legs = [];
    for (const sx of [-1, 1]) {
      const l = G(sx * 0.62, -0.1, 0, hips);
      P(Box(0.62, 1.25, 0.72), hide, 0, -0.55, 0, l);
      const knee = G(0, -1.1, 0, l);
      P(Box(0.42, 1.1, 0.46), hide, 0, -0.5, 0, knee);
      const ankle = G(0, -1.0, 0, knee);
      P(Box(0.3, 0.42, 0.3), back, 0, -0.17, 0, ankle);
      const foot = G(0, -0.34, 0, ankle);
      P(Box(0.66, 0.16, 0.95), back, 0, -0.02, 0.25, foot);
      for (const x of [-0.2, 0.2]) aim(bare(P(Cone(0.07, 0.4, 3), claw, x, -0.04, 0.78, foot)), 0, -0.25, 1);
      l.userData.knee = knee;
      l.userData.ankle = ankle;
      l.userData.foot = foot;
      c.p.legs.push(l);
    }
    // the tail: two segments and a finned end, carried out behind for balance
    const tail = (c.p.tail = G(0, 0.05, -0.65, hips));
    P(Sph(0.55, 8, 6), hide, 0, 0, -0.6, tail).scale.set(0.9, 0.8, 1.6);
    const tail2 = (c.p.tail2 = G(0, 0, -1.15, tail));
    P(Sph(0.4, 8, 6), hide, 0, 0, -0.55, tail2).scale.set(0.85, 0.75, 1.7);
    const fluke = G(0, 0, -1.1, tail2);
    for (const up of [1, -1]) {
      const lobe = P(Cone(0.3, 1.0, 4), back, 0, up * 0.3, -0.25, fluke);
      lobe.scale.x = 0.25;
      aim(lobe, 0, up, -0.9);
    }
    mergeParts(c);
  },
  crab(c) {
    const shell = c.mat('#b8502a');
    const dark = c.mat('#7a301a');
    const body = (c.p.body = G(0, 0.55, 0, c.inner));
    P(Sph(0.7, 8, 5), shell, 0, 0, 0, body).scale.set(1.4, 0.55, 1.0);
    P(Box(1.4, 0.15, 0.9), dark, 0, -0.18, 0, body);
    for (const sx of [-1, 1]) {
      const st = P(Box(0.05, 0.3, 0.05), dark, sx * 0.2, 0.35, 0.5, body);
      P(Sph(0.07, 6, 4), c.mat('#111111'), 0, 0.17, 0, st);
    }
    c.p.legs = [];
    for (let i = 0; i < 3; i++) {
      for (const sx of [-1, 1]) {
        const l = G(sx * 0.8, -0.05, -0.35 + i * 0.35, body);
        const seg = P(Box(0.6, 0.08, 0.08), dark, sx * 0.3, 0, 0, l);
        const lower = P(Box(0.08, 0.6, 0.08), dark, sx * 0.3, -0.3, 0, seg);
        lower.position.set(sx * 0.3, -0.25, 0);
        l.rotation.z = sx * 0.4;
        l.userData.side = sx;
        l.userData.i = i;
        c.p.legs.push(l);
      }
    }
    c.p.claws = [];
    for (const sx of [-1, 1]) {
      const cl = G(sx * 0.6, 0.05, 0.65, body);
      P(Box(0.18, 0.18, 0.6), shell, 0, 0, 0.3, cl);
      const pin = G(0, 0, 0.6, cl);
      P(Box(0.32, 0.26, 0.45), shell, 0, 0, 0.2, pin);
      c.p.claws.push(cl);
    }
  },
  wolf(c) {
    const fur = c.mat('#e8eef5');
    const dark = c.mat('#9aaab8');
    const body = (c.p.body = G(0, 0.85, 0, c.inner));
    P(Box(0.5, 0.5, 1.15), fur, 0, 0, 0, body);
    P(Box(0.55, 0.55, 0.45), fur, 0, 0.05, 0.4, body);
    const head = (c.p.head = G(0, 0.25, 0.7, body));
    P(Box(0.36, 0.34, 0.4), fur, 0, 0, 0.1, head);
    P(Box(0.22, 0.18, 0.32), dark, 0, -0.06, 0.4, head);
    c.p.jaw = G(0, -0.15, 0.25, head);
    P(Box(0.2, 0.06, 0.3), dark, 0, 0, 0.12, c.p.jaw);
    const eye = c.mat('#8fd8ff', { emissive: '#4ab0ff', ei: 1.5 });
    for (const sx of [-1, 1]) {
      P(Box(0.06, 0.04, 0.03), eye, sx * 0.1, 0.07, 0.31, head);
      P(Cone(0.07, 0.18, 4), fur, sx * 0.12, 0.25, 0.0, head);
    }
    c.p.legs = [];
    for (const [x, z] of [[-0.18, 0.42], [0.18, 0.42], [-0.18, -0.45], [0.18, -0.45]]) {
      const l = G(x, -0.2, z, body);
      P(Box(0.14, 0.4, 0.16), fur, 0, -0.18, 0, l);
      const k = G(0, -0.38, 0, l);
      P(Box(0.1, 0.35, 0.1), dark, 0, -0.15, 0, k);
      l.userData.knee = k;
      c.p.legs.push(l);
    }
    c.p.tail = G(0, 0.15, -0.6, body);
    const t = P(Cone(0.1, 0.65, 5), fur, 0, 0, -0.3, c.p.tail);
    t.rotation.x = -Math.PI / 2;
    c.p.tail.rotation.x = 0.5;
  },
  golem(c, opts) {
    const rock = c.mat(opts.lavaGlow ? '#2e2420' : '#5a4f48');
    const dark = c.mat(opts.lavaGlow ? '#1a1412' : '#3e3530');
    const glow = c.mat('#ff6a1a', { emissive: '#ff4a00', ei: opts.lavaGlow ? 2.4 : 1.4 });
    const body = (c.p.body = G(0, 1.15, 0, c.inner));
    P(Box(1.2, 0.9, 0.8), rock, 0, 0.4, 0, body);
    P(Box(0.9, 0.45, 0.6), dark, 0, -0.15, 0, body);
    P(Box(0.4, 0.4, 0.06), glow, 0, 0.45, 0.41, body);
    for (let i = 0; i < 4; i++) P(Box(0.06, 0.3 + i * 0.1, 0.05), glow, -0.4 + i * 0.27, 0.2 + (i % 2) * 0.3, 0.41, body);
    const head = (c.p.head = G(0, 0.95, 0.1, body));
    P(Box(0.42, 0.38, 0.4), rock, 0, 0.1, 0, head);
    for (const sx of [-1, 1]) P(Box(0.08, 0.05, 0.04), glow, sx * 0.1, 0.12, 0.21, head);
    c.p.arms = [];
    for (const sx of [-1, 1]) {
      const a = G(sx * 0.78, 0.65, 0, body);
      P(Box(0.42, 0.42, 0.42), dark, 0, 0, 0, a);
      P(Box(0.38, 0.7, 0.38), rock, 0, -0.45, 0, a);
      const fore = G(0, -0.8, 0, a);
      P(Box(0.48, 0.65, 0.48), rock, 0, -0.3, 0, fore);
      P(Box(0.55, 0.4, 0.55), dark, 0, -0.75, 0, fore);
      a.userData.fore = fore;
      c.p.arms.push(a);
    }
    c.p.legs = [];
    for (const sx of [-1, 1]) {
      const l = G(sx * 0.32, -0.35, 0, body);
      P(Box(0.42, 0.85, 0.45), dark, 0, -0.38, 0, l);
      P(Box(0.5, 0.2, 0.6), rock, 0, -0.75, 0.06, l);
      c.p.legs.push(l);
    }
  },
  shark(c) {
    const skin = c.mat('#5a6a7a');
    const belly = c.mat('#c8d0d8');
    const body = (c.p.body = G(0, -0.3, 0, c.inner));
    P(Sph(0.5, 8, 6), skin, 0, 0, 0, body).scale.set(0.9, 0.8, 3.2);
    P(Sph(0.45, 8, 5), belly, 0, -0.15, 0.1, body).scale.set(0.8, 0.5, 2.8);
    const fin = P(Cone(0.35, 0.9, 4), skin, 0, 0.75, -0.1, body);
    fin.scale.z = 0.3;
    fin.rotation.x = -0.3;
    c.p.tail = G(0, 0, -1.5, body);
    const tf = P(Cone(0.4, 0.9, 4), skin, 0, 0.2, -0.3, c.p.tail);
    tf.scale.z = 0.25;
    tf.rotation.x = -0.6;
    c.p.jaw = G(0, -0.15, 1.3, body);
    P(Box(0.5, 0.1, 0.5), c.mat('#7a2a2a'), 0, 0, 0.1, c.p.jaw);
    for (const sx of [-1, 1]) P(Sph(0.05, 5, 4), c.mat('#111111'), sx * 0.3, 0.12, 1.25, body);
  },
  eye(c) {
    const shell = c.mat('#1a1424');
    const body = (c.p.body = G(0, 1.6, 0, c.inner));
    P(Sph(0.55, 10, 8), shell, 0, 0, -0.08, body);
    P(Sph(0.45, 10, 8), c.mat('#e8e0f0'), 0, 0, 0.12, body);
    c.p.iris = P(Sph(0.2, 8, 6), c.mat('#a274ff', { emissive: '#8a4aff', ei: 2.2 }), 0, 0, 0.45, body);
    c.p.iris.scale.z = 0.4;
    c.p.tentacles = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const t = G(Math.cos(a) * 0.3, -0.35, Math.sin(a) * 0.3 - 0.1, body);
      const m = P(Cone(0.07, 1.1, 4), shell, 0, -0.5, 0, t);
      m.rotation.x = Math.PI;
      t.userData.a = a;
      c.p.tentacles.push(t);
    }
  },
  imp(c) {
    const skin = c.mat('#7a1a10');
    const body = (c.p.body = G(0, 1.4, 0, c.inner));
    P(Box(0.4, 0.5, 0.3), skin, 0, 0, 0, body);
    const head = (c.p.head = G(0, 0.42, 0, body));
    P(Box(0.32, 0.3, 0.3), skin, 0, 0, 0, head);
    const eye = c.mat('#ffd23f', { emissive: '#ffb000', ei: 2 });
    for (const sx of [-1, 1]) {
      P(Box(0.06, 0.04, 0.02), eye, sx * 0.08, 0.03, 0.16, head);
      const h = P(Cone(0.04, 0.2, 4), c.mat('#1a1010'), sx * 0.1, 0.22, 0, head);
      h.rotation.z = -sx * 0.4;
    }
    c.p.wings = [];
    for (const sx of [-1, 1]) {
      const w = G(sx * 0.18, 0.15, -0.15, body);
      const wm = P(Box(0.9, 0.5, 0.04), c.mat('#3a0a08'), sx * 0.45, 0, 0, w);
      wm.rotation.z = sx * 0.2;
      c.p.wings.push(w);
    }
    for (const sx of [-1, 1]) {
      const a = G(sx * 0.26, 0.15, 0, body);
      P(Box(0.1, 0.4, 0.1), skin, 0, -0.18, 0, a);
      P(Sph(0.09, 6, 4), c.mat('#ffaa3a', { emissive: '#ff6a1a', ei: 2 }), 0, -0.42, 0, a);
    }
    const tail = P(Cone(0.05, 0.6, 4), skin, 0, -0.35, -0.25, body);
    tail.rotation.x = -2.4;
  },
  // Great ape (Grove Ape / Primadon): hunched torso, long knuckle-walking arms.
  ape(c) {
    const fur = c.mat('#3a3028');
    const skin = c.mat('#6a5040');
    const pale = c.mat('#8a7a68');
    const body = (c.p.body = G(0, 1.35, 0, c.inner));
    const torso = P(Box(1.3, 1.1, 0.95), fur, 0, 0.35, 0, body);
    torso.rotation.x = 0.35;
    P(Box(0.9, 0.7, 0.2), skin, 0, 0.3, 0.45, body).rotation.x = 0.35;
    P(Box(1.0, 0.5, 0.8), fur, 0, -0.35, -0.15, body);
    const head = (c.p.head = G(0, 0.85, 0.5, body));
    P(Box(0.6, 0.55, 0.55), fur, 0, 0, 0, head);
    P(Box(0.5, 0.32, 0.25), skin, 0, -0.08, 0.28, head);
    P(Box(0.62, 0.1, 0.15), fur, 0, 0.14, 0.28, head);
    c.p.jaw = G(0, -0.22, 0.18, head);
    P(Box(0.42, 0.12, 0.3), skin, 0, 0, 0.1, c.p.jaw);
    const eye = c.mat('#ffb000', { emissive: '#ff8a00', ei: 1.6 });
    for (const sx of [-1, 1]) P(Box(0.08, 0.05, 0.03), eye, sx * 0.13, 0.06, 0.29, head);
    c.p.arms = [];
    for (const sx of [-1, 1]) {
      const a = G(sx * 0.82, 0.55, 0.1, body);
      P(Sph(0.32, 7, 5), fur, 0, 0, 0, a);
      P(Box(0.36, 0.95, 0.36), fur, 0, -0.5, 0, a);
      const fore = G(0, -0.95, 0, a);
      P(Box(0.4, 0.85, 0.4), fur, 0, -0.4, 0, fore);
      P(Box(0.5, 0.36, 0.5), pale, 0, -0.9, 0.04, fore);
      a.userData.fore = fore;
      c.p.arms.push(a);
    }
    c.p.legs = [];
    for (const sx of [-1, 1]) {
      const l = G(sx * 0.38, -0.55, -0.2, body);
      P(Box(0.38, 0.6, 0.42), fur, 0, -0.25, 0, l);
      P(Box(0.4, 0.15, 0.55), pale, 0, -0.62, 0.08, l);
      c.p.legs.push(l);
    }
  },
  // Burrowing worm (Thresher): a segmented body rising from the ground, ringed maw.
  worm(c) {
    const hide = c.mat('#6a5a48');
    const plate = c.mat('#9a8a70');
    const maw = c.mat('#7a2a2a');
    const tooth = c.mat('#e8e0c8');
    c.p.segs = [];
    for (let i = 0; i < 8; i++) {
      const s = G(0, 0, 0, c.inner);
      const r = 0.62 - i * 0.04;
      P(Sph(r, 9, 6), i % 2 ? hide : plate, 0, 0, 0, s).scale.set(1, 1, 1.1);
      if (i % 2 === 0) for (let k = 0; k < 3; k++) {
        const sp = P(Cone(0.08, 0.35, 4), tooth, Math.cos(k * 2.1) * r * 0.7, r * 0.75, Math.sin(k * 2.1) * r * 0.3, s);
        sp.rotation.z = -Math.cos(k * 2.1) * 0.6;
      }
      c.p.segs.push(s);
    }
    const head = (c.p.head = G(0, 0, 0, c.inner));
    P(Sph(0.7, 10, 7), plate, 0, 0, -0.1, head).scale.set(1, 1, 1.2);
    P(new THREE.CylinderGeometry(0.55, 0.62, 0.2, 10), maw, 0, 0, 0.6, head).rotation.x = Math.PI / 2;
    c.p.teeth = G(0, 0, 0.66, head);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const t = P(Cone(0.07, 0.3, 4), tooth, Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.05, c.p.teeth);
      t.rotation.set(Math.PI / 2, 0, a - Math.PI / 2);
      t.rotation.x = Math.PI / 2 + 0.4;
    }
    c.p.dirt = P(new THREE.CylinderGeometry(1.4, 1.7, 0.25, 9), c.mat('#4a3a28'), 0, 0.05, 0, c.inner);
  },
  // Serpent: a low, segmented body with a raised head.
  snake(c) {
    const scale = c.mat('#3a7a4a');
    const belly = c.mat('#c8d08a');
    c.p.segs = [];
    for (let i = 0; i < 10; i++) {
      const s = G(0, 0.25, -i * 0.42, c.inner);
      const r = 0.3 - i * 0.017;
      P(Sph(r, 8, 5), i % 3 === 1 ? belly : scale, 0, 0, 0, s).scale.set(1.15, 0.85, 1.4);
      c.p.segs.push(s);
    }
    const head = (c.p.head = G(0, 0.6, 0.35, c.inner));
    P(Box(0.42, 0.24, 0.55), scale, 0, 0, 0.1, head);
    const eye = c.mat('#ffe14d', { emissive: '#ffb000', ei: 1.5 });
    for (const sx of [-1, 1]) P(Box(0.06, 0.05, 0.06), eye, sx * 0.18, 0.08, 0.22, head);
    c.p.jaw = G(0, -0.1, 0.05, head);
    P(Box(0.36, 0.08, 0.45), belly, 0, 0, 0.15, c.p.jaw);
    for (const sx of [-1, 1]) P(Cone(0.03, 0.14, 4), c.mat('#f2eee0'), sx * 0.1, -0.06, 0.32, head).rotation.x = Math.PI;
    c.p.neck = P(Sph(0.24, 7, 5), scale, 0, 0.42, 0.12, c.inner);
  },
};

const ANIMATORS = {
  dummy(c, dt, st) {
    const w = st.flinch || 0;
    c.p.body.rotation.x = Math.sin(c.time * 18) * w * 0.4;
  },
  lurker(c, dt, st) {
    const sp = st.speed || 0;
    const t = c.time;
    c.p.body.position.y = 0.45 + Math.abs(Math.sin(t * sp * 1.5)) * 0.06 * Math.min(1, sp);
    c.p.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * (4 + sp * 2) + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 * Math.min(1, sp)));
    const pull = c.pull();
    const s = c.strike();
    const ph = c.phase();
    c.p.body.rotation.x = -pull * 0.25 + s * 0.35;
    c.p.jaw.rotation.x = s * 0.7;
    c.p.tongue.scale.z = ph && ph.name === 'tongue' ? Math.max(0.01, s * 3.5) : 0.01;
    c.p.tongue.position.z = c.p.tongue.scale.z * 0.5 + 0.2;
    c.p.body.scale.y = 1 + Math.sin(t * 2) * 0.03;
  },
  owl(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    const ph = c.phase();
    const name = ph && ph.name;
    const pull = c.pull();
    const s = c.strike();
    const walk = Math.min(1, sp / 3);
    const f = t * (2.6 + sp * 0.7);
    // a long-legged stride: the shank folds back as each foot lifts, the body rocks over it
    c.p.legs.forEach((l, i) => {
      const a = f + i * Math.PI;
      l.rotation.x = Math.sin(a) * 0.5 * walk;
      l.userData.shin.rotation.x = Math.max(0, Math.sin(a + 0.8)) * 0.7 * walk;
    });
    let lean = 0.12 + 0.1 * walk;
    let spread = sp > 5 ? 0.3 + Math.sin(t * 9) * 0.12 : 0; // running: half-open for balance
    let sweep = 0;
    let headX = 0;
    let beak = 0;
    if (name === 'talon_dive') {
      spread = ph.ph === 'wind' ? pull * 1.1 : ph.ph === 'active' ? 0.95 + Math.sin(t * 16) * 0.35 : pull;
      lean += ph.ph === 'wind' ? -0.3 * pull : 0.5 * s;
      if (ph.ph !== 'wind') c.p.legs.forEach((l) => (l.rotation.x = -0.9 * s)); // talons out in front
    } else if (name === 'gust') {
      spread = pull;
      sweep = s * 0.9;
      lean += -0.2 * pull + 0.3 * s;
    } else if (name === 'screech') {
      spread = pull * 1.3;
      headX = -0.5 * pull;
      beak = 0.6 * pull;
      lean -= 0.2 * pull;
    } else if (name) {
      // peck, and the bite it grips a fallen foe with
      headX = -0.35 * pull + 0.9 * s;
      lean += 0.35 * s;
      beak = 0.4 * pull;
    }
    c.p.body.position.y = 1.95 + Math.abs(Math.sin(f)) * 0.12 * walk + Math.sin(t * 1.8) * 0.02;
    c.p.body.rotation.set(lean, 0, Math.sin(f) * 0.06 * walk);
    c.p.wings.forEach((w, i) => {
      const sx = i === 0 ? -1 : 1;
      w.rotation.y = -sx * sweep;
      // lifted out, then face forward: the glinting coverts toward the foe
      w.userData.inner.rotation.set(0, -sx * Math.min(1, spread) * 1.25, sx * (0.1 + spread * 1.35));
      // folded, the primaries lie back along the tail; opened, they fan
      const open = Math.min(1, spread);
      w.userData.blades.forEach((b, k) => (b.rotation.x = (1 - open) * 0.4 + spread * (k - 2) * 0.24));
    });
    c.p.tail.rotation.x = 0.55 + spread * 0.3;
    c.p.tailBlades.forEach((b, k) => (b.rotation.z = (k - 2) * (0.12 + spread * 0.15)));
    c.p.mandible.rotation.x = beak;
    // an owl's head turns in snaps, holds, then snaps again; facing front to fight or walk
    if (!c.look || t > c.look.until) c.look = { yaw: (Math.random() * 2 - 1) * 1.2, until: t + 1.2 + Math.random() * 2.5 };
    const yaw = ph || sp > 0.5 ? 0 : c.look.yaw;
    c.p.head.rotation.x = headX;
    c.p.head.rotation.y += (yaw - c.p.head.rotation.y) * (1 - Math.exp(-10 * dt));
  },
  sharko(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    const walk = Math.min(1, sp / 3);
    const run = clamp((sp - 4) / 5, 0, 1);
    const ph = c.phase();
    const name = ph && ph.name;
    const pull = c.pull();
    const s = c.strike();
    const charging = name === 'charge' && ph.ph === 'active';
    const f = t * (2.0 + sp * 0.5) + (charging ? t * 6 : 0);
    const stride = charging ? 1 : walk;
    // rest: thighs forward, shanks back, the long arms hanging to the knuckles
    const THIGH = -0.5, KNEE = 0.9, ANKLE = -0.6, ARM = -0.75, ELBOW = -0.4;
    c.p.legs.forEach((l, i) => {
      const a = f + i * Math.PI;
      l.rotation.x = THIGH + Math.sin(a) * (0.45 + 0.25 * run) * stride;
      l.userData.knee.rotation.x = KNEE + Math.max(0, Math.sin(a + 1.2)) * 0.7 * stride;
      l.userData.ankle.rotation.x = ANKLE;
      // keep the foot flat to the ground under the swinging leg
      l.userData.foot.rotation.x = -(l.rotation.x + l.userData.knee.rotation.x + ANKLE);
    });
    c.p.arms.forEach((a, i) => {
      a.rotation.set(ARM + Math.sin(f + (i ? 0 : Math.PI)) * 0.4 * stride, 0, (i ? 1 : -1) * 0.12);
      a.userData.fore.rotation.x = ELBOW;
    });
    let crouch = 0.08 * walk;
    let lean = 0.55 + 0.12 * run + Math.sin(t * 1.3) * 0.02;
    let twist = Math.sin(f) * 0.08 * stride;
    let headX = -0.45 + Math.sin(t * 0.8) * 0.05;
    let headY = ph || sp > 0.5 ? 0 : Math.sin(t * 0.37) * 0.35;
    let jaw = 0.05 + Math.max(0, Math.sin(t * 0.9)) * 0.08; // it breathes through the mouth
    const [L, R] = c.p.arms;
    const [, RL] = c.p.legs;
    switch (name) {
      case 'rake':
        R.rotation.x = ARM - 2.0 * pull + s * 2.6;
        R.rotation.z = 0.2 + pull * 0.5;
        twist = pull * 0.45 - s * 0.8;
        break;
      case 'double_rake': {
        // the left arm, then the right: the active window carries both blows
        const act = ph.ph === 'active';
        const aL = act ? Math.min(1, ph.f * 2) : 0;
        const aR = act ? Math.max(0, ph.f * 2 - 1) : 0;
        const back = ph.ph === 'rec' ? 1 - ph.f : 0;
        const raiseL = ph.ph === 'wind' ? pull : act ? 1 - aL : 0;
        const raiseR = 0.7 * (ph.ph === 'wind' ? pull : act ? 1 - aR : 0);
        L.rotation.x = ARM - 2.0 * raiseL + 2.4 * (act ? aL : back);
        R.rotation.x = ARM - 2.0 * raiseR + 2.4 * (act ? aR : back);
        twist = ((act ? aL - aR : 0) - 0.3 * raiseL + 0.3 * raiseR) * 0.5;
        break;
      }
      case 'bite':
        headX += -0.35 * pull + s * 0.45;
        jaw = pull * 0.85 * (1 - s * 0.9);
        lean += -0.15 * pull + s * 0.35;
        break;
      case 'kick':
        RL.rotation.x = THIGH - pull * 0.9 - s * 0.7;
        RL.userData.knee.rotation.x = KNEE + pull * 0.8 - s * 1.5;
        RL.userData.foot.rotation.x = 0;
        lean -= 0.2 * pull;
        break;
      case 'charge':
        if (ph.ph === 'wind') {
          crouch += 0.4 * pull;
          lean += 0.35 * pull;
          headX += 0.2 * pull;
          for (const a of c.p.arms) a.rotation.x = ARM + 0.8 * pull;
          jaw = 0.3 * pull;
        } else {
          lean += 0.3 * (ph.ph === 'active' ? 1 : 1 - ph.f);
          jaw = 0.5 * (ph.ph === 'active' ? 1 : 1 - ph.f);
          if (ph.ph === 'active') for (const a of c.p.arms) a.rotation.x = ARM - 0.9;
        }
        break;
      case 'roar':
        // it rears, head back, and opens its arms forward and out, claws up
        lean -= 0.5 * pull;
        headX -= 0.7 * pull;
        jaw = 0.95 * pull;
        for (const a of c.p.arms) {
          a.rotation.x = ARM - 0.9 * pull;
          a.userData.fore.rotation.x = ELBOW - 0.9 * pull;
        }
        L.rotation.z = -(0.12 + pull * 0.55);
        R.rotation.z = 0.12 + pull * 0.55;
        break;
      default:
    }
    c.p.hips.position.y = 2.35 - crouch + Math.abs(Math.sin(f)) * 0.1 * stride;
    c.p.hips.rotation.y = -twist * 0.3;
    c.p.body.rotation.set(lean, twist, 0);
    c.p.body.scale.setScalar(1 + Math.sin(t * 1.4) * 0.012);
    c.p.head.rotation.set(headX, headY, 0);
    c.p.jaw.rotation.x = jaw;
    c.p.tail.rotation.set(-0.15 + Math.sin(t * 1.1) * 0.05, Math.sin(t * 1.6) * 0.2 + Math.sin(f) * 0.15 * stride, 0);
    c.p.tail2.rotation.y = Math.sin(t * 1.6 - 0.8) * 0.25;
  },
  crab(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    c.p.legs.forEach((l) => {
      l.rotation.z = l.userData.side * (0.4 + Math.sin(t * 10 + l.userData.i * 2 + (l.userData.side > 0 ? 1 : 0)) * 0.25 * Math.min(1, sp));
    });
    const ph = c.phase();
    const pull = c.pull();
    const s = c.strike();
    if (ph && ph.name === 'shell_spin') {
      c.inner.rotation.y += dt * (ph.ph === 'active' ? 25 : ph.ph === 'wind' ? 3 : 0);
    } else c.inner.rotation.y = 0;
    c.p.claws.forEach((cl, i) => {
      const active = !ph || ph.name === 'pinch' ? i === 1 : true;
      cl.rotation.x = active ? -pull * 0.8 + s * 0.9 : 0;
      cl.position.z = 0.65 + (active ? s * 0.4 : 0);
    });
    c.p.body.position.y = 0.55 + Math.sin(t * 3) * 0.02;
  },
  wolf(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    const gallop = Math.min(1, sp / 6);
    const f = t * (5 + sp * 1.2);
    c.p.legs.forEach((l, i) => {
      const off = i < 2 ? 0 : Math.PI * 0.8;
      const sgn = i % 2 ? 0.25 : 0;
      l.rotation.x = Math.sin(f + off + sgn) * 0.8 * gallop;
      l.userData.knee.rotation.x = Math.max(0, Math.sin(f + off + sgn + 1)) * 0.8 * gallop;
    });
    c.p.body.position.y = 0.85 + Math.abs(Math.sin(f)) * 0.08 * gallop;
    c.p.body.rotation.x = Math.sin(f) * 0.06 * gallop;
    const ph = c.phase();
    const pull = c.pull();
    const s = c.strike();
    if (ph && ph.name === 'pounce') {
      c.p.body.rotation.x = -pull * 0.35 + s * 0.2;
      c.p.legs.forEach((l, i) => (l.rotation.x = (i < 2 ? -1.1 : 0.9) * s));
    }
    c.p.head.rotation.x = ph && ph.name !== 'pounce' ? -pull * 0.4 + s * 0.5 : Math.sin(t * 1.5) * 0.05;
    c.p.jaw.rotation.x = s * 0.6 + (ph && ph.name === 'frost_breath' ? pull * 0.5 : 0);
    c.p.tail.rotation.y = Math.sin(t * 6) * 0.3;
  },
  golem(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    const f = t * (2.5 + sp);
    const walk = Math.min(1, sp / 2);
    c.p.legs.forEach((l, i) => (l.rotation.x = Math.sin(f + i * Math.PI) * 0.45 * walk));
    c.p.body.position.y = 1.15 + Math.abs(Math.sin(f)) * 0.05 * walk;
    const ph = c.phase();
    const pull = c.pull();
    const s = c.strike();
    const [L, R] = c.p.arms;
    L.rotation.set(Math.sin(f + Math.PI) * 0.3 * walk, 0, 0.12);
    R.rotation.set(Math.sin(f) * 0.3 * walk, 0, -0.12);
    L.userData.fore.rotation.x = -0.3;
    R.userData.fore.rotation.x = -0.3;
    c.p.body.rotation.x = 0;
    c.p.body.rotation.y = 0;
    if (ph) {
      if (ph.name === 'punch') {
        R.rotation.x = pull * 0.9 - s * 2.4;
        R.userData.fore.rotation.x = -1.2 * pull + s * 1.1;
        c.p.body.rotation.y = pull * 0.4 - s * 0.8;
      } else if (ph.name === 'slam' || ph.name === 'magma') {
        const up = -2.9 * pull + s * 2.4;
        L.rotation.x = up;
        R.rotation.x = up;
        c.p.body.rotation.x = -0.25 * pull + s * 0.55;
      } else if (ph.name === 'sweep') {
        R.rotation.set(-1.4, 0, -0.2 - pull * 1.2);
        c.p.body.rotation.y = pull * 1.0 - s * 2.0;
      } else if (ph.name === 'rock_throw' || ph.name === 'boulder') {
        R.rotation.x = -2.8 * pull + s * 2.0;
        c.p.body.rotation.x = -0.2 * pull + s * 0.3;
      }
    }
    c.p.head.rotation.y = Math.sin(t * 0.6) * 0.15;
  },
  shark(c, dt, st) {
    const t = c.time;
    c.p.tail.rotation.y = Math.sin(t * 8) * 0.5;
    c.inner.rotation.z = Math.sin(t * 2) * 0.05;
    c.p.jaw.rotation.x = c.pull() * 0.6;
  },
  eye(c, dt, st) {
    const t = c.time;
    c.p.body.position.y = 1.6 + Math.sin(t * 2) * 0.15;
    c.p.tentacles.forEach((tn, i) => {
      tn.rotation.x = Math.sin(t * 3 + i) * 0.35;
      tn.rotation.z = Math.cos(t * 2.5 + i) * 0.35;
    });
    const p = c.pull();
    c.p.iris.scale.setScalar(1 + p * 0.6);
    c.p.iris.scale.z = 0.4;
  },
  imp(c, dt, st) {
    const t = c.time;
    c.p.body.position.y = 1.4 + Math.sin(t * 4) * 0.12;
    c.p.wings.forEach((w, i) => (w.rotation.y = (i ? 1 : -1) * (0.3 + Math.sin(t * 18) * 0.5)));
    const p = c.pull();
    c.p.body.rotation.x = -p * 0.4 + c.strike() * 0.5;
  },
  ape(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    const walk = Math.min(1, sp / 4);
    const f = t * (3 + sp * 0.9);
    const [L, R] = c.p.arms;
    // knuckle-walk: arms reach forward and plant alternately
    L.rotation.set(-0.5 * walk + Math.sin(f) * 0.6 * walk, 0, 0.18);
    R.rotation.set(-0.5 * walk + Math.sin(f + Math.PI) * 0.6 * walk, 0, -0.18);
    L.userData.fore.rotation.x = -0.25;
    R.userData.fore.rotation.x = -0.25;
    c.p.legs.forEach((l, i) => (l.rotation.x = Math.sin(f + (i ? 0 : Math.PI)) * 0.5 * walk));
    c.p.body.position.y = 1.35 + Math.abs(Math.sin(f)) * 0.1 * walk + Math.sin(t * 1.6) * 0.03;
    c.p.body.rotation.set(0.25 * walk, 0, 0);
    c.p.head.rotation.set(Math.sin(t * 0.9) * 0.08, Math.sin(t * 0.5) * 0.25, 0);
    c.p.jaw.rotation.x = 0;
    const ph = c.phase();
    if (!ph) return;
    const pull = c.pull();
    const s = c.strike();
    switch (ph.name) {
      case 'swipe':
        R.rotation.set(-0.6 - pull * 1.4, pull * 0.6 - s * 1.6, -0.2 - pull * 0.6);
        c.p.body.rotation.y = pull * 0.5 - s * 0.9;
        break;
      case 'sweep':
        L.rotation.set(-1.4, 0, 0.3 + pull * 1.3 - s * 2.2);
        R.rotation.set(-1.4, 0, -0.3 - pull * 1.3 + s * 2.2);
        c.p.body.rotation.y = -pull * 0.6 + s * 1.4;
        break;
      case 'double_slam':
      case 'ground_pound':
      case 'leap_smash': {
        const up = -2.9 * pull + s * 2.6;
        L.rotation.set(up, 0, 0.25);
        R.rotation.set(up, 0, -0.25);
        c.p.body.rotation.x = -0.35 * pull + s * 0.7;
        c.p.jaw.rotation.x = pull * 0.5;
        break;
      }
      case 'boulder':
      case 'rock_throw':
        R.rotation.set(-2.8 * pull + s * 2.2, 0, -0.3);
        L.rotation.set(-0.8 * pull, 0, 0.4);
        c.p.body.rotation.x = -0.3 * pull + s * 0.4;
        break;
      case 'roar':
      case 'chest_beat': {
        if (!c.act.grunted && ph.ph === 'wind' && ph.f > 0.3) {
          c.act.grunted = true;
          if (GL.audio) GL.audio.play('grunt', { pos: c.root.position, pitch: 0.7 });
        }
        const beat = Math.sin(t * 22) * pull;
        L.rotation.set(-1.4 * pull + beat * 0.3, 0.9 * pull, 0.2);
        R.rotation.set(-1.4 * pull - beat * 0.3, -0.9 * pull, -0.2);
        L.userData.fore.rotation.x = -1.4 * pull;
        R.userData.fore.rotation.x = -1.4 * pull;
        c.p.body.rotation.x = -0.4 * pull;
        c.p.head.rotation.x = -0.6 * pull;
        c.p.jaw.rotation.x = pull * 0.8;
        break;
      }
      case 'enrage':
      default:
        c.p.jaw.rotation.x = pull * 0.6;
        c.p.head.rotation.x = -0.5 * pull;
    }
  },
  worm(c, dt, st) {
    const t = c.time;
    const ph = c.phase();
    const pull = c.pull();
    const s = c.strike();
    // how far the body has risen out of the ground (0 = buried)
    let rise = 1;
    let lean = 0.35 + Math.sin(t * 1.3) * 0.08;
    let bite = 0;
    if (ph) {
      if (ph.name === 'burrow_strike') {
        if (!c.act.rumbled) {
          c.act.rumbled = true;
          if (GL.audio) GL.audio.play('rumble', { pos: c.root.position });
          if (GL.vfx) GL.vfx.dust(c.root.position, 30, '#5a4a38', 1.5);
        }
        rise = ph.ph === 'wind' ? 1 - ph.f : ph.ph === 'active' ? Math.min(1, ph.f * 2.5) : 1;
        lean = 0.9 * s;
      } else if (ph.name === 'lunge_bite') {
        lean = 0.35 - pull * 0.4 + s * 1.1;
        bite = s;
      } else if (ph.name === 'tail_slam') {
        lean = 0.35 - pull * 0.5 + s * 1.3;
      } else if (ph.name === 'acid_spit') {
        lean = 0.35 - pull * 0.45 + s * 0.4;
        bite = pull * 0.6;
      }
    }
    const segs = c.p.segs;
    const n = segs.length;
    const height = 4.2 * rise;
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n; // 1 at top
      const y = -0.6 + height * k;
      const wave = Math.sin(t * 2.4 - i * 0.7) * 0.18 * k;
      segs[i].position.set(wave, y, Math.sin(lean) * height * k * k * 0.6);
    }
    const top = segs[0].position;
    c.p.head.position.set(top.x, top.y + 0.55 * rise, top.z + 0.25 + Math.sin(lean) * 0.6);
    c.p.head.rotation.set(Math.PI / 2 - 0.9 - lean * 0.6, 0, Math.sin(t * 1.7) * 0.1);
    c.p.teeth.scale.setScalar(1 + bite * 0.35);
    c.p.teeth.rotation.z = t * (bite > 0 ? 6 : 0.6);
    c.p.dirt.scale.setScalar(0.8 + (1 - rise) * 0.6);
  },
  snake(c, dt, st) {
    const t = c.time;
    const sp = st.speed || 0;
    const sl = 2 + sp * 1.4;
    const amp = 0.12 + Math.min(0.25, sp * 0.04);
    c.p.segs.forEach((s, i) => {
      s.position.x = Math.sin(t * sl - i * 0.8) * amp * (0.3 + i * 0.1);
    });
    const ph = c.phase();
    const pull = c.pull();
    const st2 = c.strike();
    let rear = 0;
    let fwd = 0;
    if (ph) {
      if (ph.name === 'bite') {
        rear = pull * 0.35;
        fwd = st2 * 0.7;
      } else if (ph.name === 'coil_strike') {
        rear = pull * 0.6;
        fwd = st2 * 1.2;
      } else if (ph.name === 'spit') rear = pull * 0.45;
    }
    c.p.head.position.set(c.p.segs[0].position.x, 0.6 + rear + Math.sin(t * 2) * 0.04, 0.35 - rear * 0.6 + fwd);
    c.p.head.rotation.x = -rear * 0.8 + fwd * 0.5;
    c.p.neck.position.set(c.p.segs[0].position.x * 0.6, 0.42 + rear * 0.5, 0.12 - rear * 0.3 + fwd * 0.5);
    c.p.jaw.rotation.x = (ph ? Math.max(pull * 0.6, st2 * 0.8) : 0) * (ph && ph.name === 'spit' ? 1.2 : 1);
  },
};
