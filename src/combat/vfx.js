// Visual effects: GPU point particles, mesh effects (rings, pillars, beams,
// bolts), weapon trails, pooled flash lights and floating damage numbers.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { rand, clamp } from '../core/util.js';

const ELEMENT_FX = {
  phys: { color: '#ffffff', c2: '#ffe0b0' },
  ember: { color: '#ff7a2f', c2: '#ffd23f' },
  rime: { color: '#9fe6ff', c2: '#ffffff' },
  storm: { color: '#ffe14d', c2: '#ffffff' },
  gale: { color: '#c8ffe6', c2: '#ffffff' },
  umbra: { color: '#8a4aff', c2: '#2a0a4a' },
  steel: { color: '#d8dee8', c2: '#8a94a4' },
  blood: { color: '#e0243f', c2: '#6a0a14' },
  support: { color: '#ffd27a', c2: '#ffffff' },
  move: { color: '#ffffff', c2: '#c8e8ff' },
};
export const elColor = (el) => (ELEMENT_FX[el] || ELEMENT_FX.phys).color;

class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.s0 = new Float32Array(cap);
    this.s1 = new Float32Array(cap);
    this.a0 = new Float32Array(cap);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec4 color;
        varying vec4 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, color, size, life, opts = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = color.r;
    this.col[i * 4 + 1] = color.g;
    this.col[i * 4 + 2] = color.b;
    this.a0[i] = opts.alpha ?? 1;
    this.col[i * 4 + 3] = this.a0[i];
    this.s0[i] = size;
    this.s1[i] = opts.endSize ?? size * 0.2;
    this.size[i] = size;
    this.life[i] = life;
    this.max[i] = life;
    this.grav[i] = opts.gravity ?? 0;
    this.drag[i] = opts.drag ?? 1.5;
  }

  update(dt) {
    const n = this.cap;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) {
        if (this.size[i] !== 0) this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.max[i]);
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * f;
      this.col[i * 4 + 3] = this.a0[i] * Math.min(1, f * 2.5);
      if (this.life[i] <= 0) this.size[i] = 0;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}

// Effects, projectiles and ice make their materials as they go and dispose of them when done.
// three.js shares one shader program among materials of a kind and deletes it when the last of
// them is disposed, so each bolt after a quiet spell compiled its shader again, and the first one
// compiled it in the frame it appeared. One hidden exemplar of each kind they use stays in the
// scene from boot: the warm-up compiles them behind the menu, and they are never released. The
// kinds are what splits a program: transparency, sidedness, fog and flat shading (not colour,
// opacity, blending or depth writes). A new effect of a new kind belongs here too.
function keepEffectPrograms(scene) {
  const keep = new THREE.Group();
  keep.name = 'effect programs';
  keep.visible = false;
  const geo = new THREE.PlaneGeometry(0.01, 0.01);
  const kinds = [];
  for (const fog of [true, false]) {
    for (const side of [THREE.FrontSide, THREE.DoubleSide]) {
      kinds.push(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side, fog }));
      kinds.push(new THREE.MeshBasicMaterial({ side, fog }));
    }
  }
  kinds.push(new THREE.MeshStandardMaterial({ flatShading: true, transparent: true })); // ice, spikes, a frozen body
  kinds.push(new THREE.MeshStandardMaterial({ flatShading: true })); // a thrown rock, a rod
  kinds.push(new THREE.MeshStandardMaterial({ flatShading: true, side: THREE.DoubleSide })); // a rented boat
  kinds.push(new THREE.MeshStandardMaterial({ emissive: '#ffffff' })); // a boat's lamp
  for (const m of kinds) keep.add(new THREE.Mesh(geo, m));
  scene.add(keep);
}

class Trail {
  constructor(scene, color, width = 1) {
    this.max = 14;
    this.samples = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 2 * 3);
    this.alpha = new Float32Array(this.max * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.active = false;
    this.fade = 0;
  }
  start(color) {
    this.samples.length = 0;
    this.active = true;
    this.fade = 1;
    if (color) this.mat.uniforms.uColor.value.set(color);
  }
  stop() {
    this.active = false;
  }
  push(a, b) {
    this.samples.unshift([a.clone(), b.clone()]);
    if (this.samples.length > this.max) this.samples.pop();
  }
  update(dt) {
    if (!this.active) this.fade = Math.max(0, this.fade - dt * 5);
    const n = this.samples.length;
    for (let i = 0; i < this.max; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      if (!s) {
        this.alpha[i * 2] = this.alpha[i * 2 + 1] = 0;
        continue;
      }
      this.pos.set([s[0].x, s[0].y, s[0].z], i * 6);
      this.pos.set([s[1].x, s[1].y, s[1].z], i * 6 + 3);
      const a = i < n ? (1 - i / this.max) * 0.75 * this.fade : 0;
      this.alpha[i * 2] = a * 0.2;
      this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
    this.mesh.visible = this.fade > 0 && n > 1;
  }
  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

export class VFX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Particles(scene, 5000, true);
    this.norm = new Particles(scene, 2500, false);
    this.effects = [];
    this.trails = new Set();
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 12, 2);
      l.userData.t = 0;
      scene.add(l);
      this.lights.push(l);
    }
    this.shake = 0;
    this.numbers = [];
    this.numLayer = document.getElementById('dmg-layer');
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this.emitters = [];
  }

  // ---------- particles
  burst(pos, el = 'phys', n = 16, o = {}) {
    const fx = ELEMENT_FX[el] || ELEMENT_FX.phys;
    const c1 = this._c.set(o.color || fx.color);
    const c2 = this._c2.set(o.color2 || fx.c2);
    const sp = o.speed ?? 6;
    const sys = o.normal ? this.norm : this.add;
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
      if (o.dir) dir.lerp(o.dir, 0.6).normalize();
      const s = sp * rand(0.3, 1);
      const col = Math.random() < 0.5 ? c1 : c2;
      sys.emit(pos.x, pos.y, pos.z, dir.x * s, dir.y * s + (o.up || 0), dir.z * s, col, (o.size ?? 0.35) * rand(0.6, 1.4), (o.life ?? 0.5) * rand(0.6, 1.3), { gravity: o.gravity ?? 4, drag: o.drag ?? 3 });
    }
  }

  sparks(pos, dir, color = '#ffd27a', n = 14) {
    const c = this._c.set(color);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize();
      if (dir) d.addScaledVector(dir, 0.8).normalize();
      const s = rand(6, 16);
      this.add.emit(pos.x, pos.y, pos.z, d.x * s, d.y * s, d.z * s, c, rand(0.1, 0.22), rand(0.15, 0.4), { gravity: 18, drag: 2, endSize: 0.02 });
    }
  }

  blood(pos, dir, n = 10) {
    const c = this._c.set('#8a0a14');
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)).normalize();
      if (dir) d.addScaledVector(dir, 1).normalize();
      const s = rand(2, 6);
      this.norm.emit(pos.x, pos.y, pos.z, d.x * s, d.y * s + 1, d.z * s, c, rand(0.12, 0.25), rand(0.3, 0.6), { gravity: 14, drag: 1 });
    }
  }

  dust(pos, n = 8, color = '#c8b89a', size = 0.6) {
    const c = this._c.set(color);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(1, 3);
      this.norm.emit(pos.x + Math.cos(a) * 0.3, pos.y + 0.1, pos.z + Math.sin(a) * 0.3, Math.cos(a) * s, rand(0.3, 1.2), Math.sin(a) * s, c, size * rand(0.6, 1.3), rand(0.5, 0.9), { gravity: -0.5, drag: 2.5, endSize: size * 1.8, alpha: 0.45 });
    }
  }

  splash(pos, n = 18) {
    const c = this._c.set('#e8f6ff');
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(1, 4);
      this.norm.emit(pos.x, 0.1, pos.z, Math.cos(a) * s, rand(3, 7), Math.sin(a) * s, c, rand(0.15, 0.35), rand(0.4, 0.8), { gravity: 16, drag: 1, alpha: 0.8 });
    }
  }

  trailPuff(pos, el, size = 0.3, n = 2) {
    const fx = ELEMENT_FX[el] || ELEMENT_FX.phys;
    const c = this._c.set(fx.color);
    for (let i = 0; i < n; i++) this.add.emit(pos.x + rand(-0.1, 0.1), pos.y + rand(-0.1, 0.1), pos.z + rand(-0.1, 0.1), rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), c, size * rand(0.7, 1.3), rand(0.2, 0.45), { drag: 2 });
  }

  fire(pos, spread = 0.3, n = 1, col = '#ff7a2f') {
    const c = this._c.set(col);
    const c2 = this._c2.set('#ffd23f');
    for (let i = 0; i < n; i++) {
      this.add.emit(pos.x + rand(-spread, spread), pos.y, pos.z + rand(-spread, spread), rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), Math.random() < 0.5 ? c : c2, rand(0.25, 0.5), rand(0.4, 0.8), { gravity: -1, drag: 1.5, endSize: 0.05 });
    }
  }

  // ---------- mesh effects
  _fx(obj, life, update) {
    this.scene.add(obj);
    this.effects.push({ obj, t: 0, life, update });
    return obj;
  }

  ring(pos, el = 'phys', radius = 4, life = 0.45, o = {}) {
    const color = o.color || elColor(el);
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.position.y += o.y ?? 0.15;
    if (o.vertical) {
      m.rotation.x = Math.PI / 2;
      if (o.yaw !== undefined) m.rotation.z = o.yaw;
    }
    return this._fx(m, life, (e, f) => {
      const s = 0.3 + radius * (1 - Math.pow(1 - f, 3));
      e.obj.scale.setScalar(s);
      e.obj.material.opacity = 0.9 * (1 - f);
    });
  }

  sphereFlash(pos, el = 'phys', radius = 2, life = 0.3, o = {}) {
    const color = o.color || elColor(el);
    const peak = G.settings && G.settings.reduceFlashing ? 0.23 : 0.7; // Settings: reduce flashing
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: peak, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos);
    return this._fx(m, life, (e, f) => {
      e.obj.scale.setScalar(radius * (0.4 + f * 0.8));
      e.obj.material.opacity = peak * (1 - f);
    });
  }

  pillar(pos, el, radius = 2, height = 10, life = 0.7) {
    const color = elColor(el);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos);
    return this._fx(m, life, (e, f) => {
      const grow = Math.min(1, f * 6);
      e.obj.scale.set(radius * (1 - f * 0.5), height * grow, radius * (1 - f * 0.5));
      e.obj.position.y = pos.y + (height * grow) / 2;
      e.obj.material.opacity = 0.8 * (1 - f);
    });
  }

  // A telegraph's shape, so a red or orange blow reads without its colour: spikes radiate round
  // the head of a fighter whose blow cannot be parried; chevrons press down over one whose blow
  // cannot be blocked. It follows the fighter and faces the camera.
  warnMark(actor, kind, life = 0.5) {
    const red = kind === 'red';
    const mat = new THREE.MeshBasicMaterial({ color: red ? '#ff2a1a' : '#ffaa1a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const g = new THREE.Group();
    if (red) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 4), mat);
        spike.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
        spike.rotation.z = a - Math.PI / 2; // pointing outward
        g.add(spike);
      }
    } else {
      for (let k = 0; k < 2; k++) {
        for (const s of [-1, 1]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.02), mat);
          bar.position.set(s * 0.16, -k * 0.27, 0);
          bar.rotation.z = s * 0.7; // a V pointing down
          g.add(bar);
        }
      }
    }
    g.userData.warn = kind;
    const over = (actor.height || 1.8) + 0.65;
    return this._fx(g, life, (e, f) => {
      e.obj.position.set(actor.pos.x, actor.pos.y + over - (red ? 0 : f * 0.3), actor.pos.z);
      if (G.camera) e.obj.quaternion.copy(G.camera.quaternion);
      e.obj.scale.setScalar(red ? 0.7 + f * 0.6 : 1);
      mat.opacity = 0.95 * (1 - f * f);
    });
  }

  telegraph(pos, radius, life, color = '#ff3a2a') {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.position.copy(pos);
    m.position.y += 0.12;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.add(ring);
    ring.position.y = 0.01;
    return this._fx(m, life, (e, f) => {
      e.obj.scale.setScalar(radius * Math.min(1, f * 3));
      e.obj.material.opacity = 0.15 + f * 0.25;
    });
  }

  beam(a, b, el = 'storm', width = 0.25, life = 0.25) {
    const color = elColor(el);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.scale.set(width, len, width);
    return this._fx(m, life, (e, f) => {
      e.obj.scale.x = e.obj.scale.z = width * (1 - f);
      e.obj.material.opacity = 0.95 * (1 - f);
    });
  }

  bolt(a, b, el = 'storm', life = 0.25, segs = 9) {
    const color = elColor(el);
    const pts = [];
    const dir = b.clone().sub(a);
    const len = dir.length();
    for (let i = 0; i <= segs; i++) {
      const p = a.clone().addScaledVector(dir, i / segs);
      if (i > 0 && i < segs) p.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(len * 0.06));
      pts.push(p);
    }
    const group = new THREE.Group();
    for (let i = 0; i < segs; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 4, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      const p0 = pts[i];
      const p1 = pts[i + 1];
      m.position.copy(p0).add(p1).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      m.scale.set(0.08, p0.distanceTo(p1), 0.08);
      group.add(m);
    }
    return this._fx(group, life, (e, f) => {
      e.obj.children.forEach((c) => {
        c.material.opacity = 1 - f;
        c.visible = Math.random() > f * 0.6;
      });
    });
  }

  slashArc(pos, yaw, el = 'phys', radius = 3, life = 0.25, o = {}) {
    const color = o.color || elColor(el);
    const geo = new THREE.RingGeometry(radius * 0.7, radius, 24, 1, -0.9, 1.8);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.rotation.y = yaw + Math.PI / 2;
    if (o.tilt) m.rotation.z = o.tilt;
    return this._fx(m, life, (e, f) => {
      e.obj.material.opacity = 0.8 * (1 - f);
      e.obj.scale.setScalar(1 + f * 0.25);
    });
  }

  spikes(pos, el = 'rime', h = 2.2, life = 1.2, color) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1, 5), new THREE.MeshStandardMaterial({ color: color || elColor(el), emissive: color || elColor(el), emissiveIntensity: 0.6, flatShading: true, transparent: true, roughness: 0.2 }));
    m.position.copy(pos);
    m.rotation.set(rand(-0.25, 0.25), rand(0, 6), rand(-0.25, 0.25));
    return this._fx(m, life, (e, f) => {
      const grow = Math.min(1, f * 8);
      e.obj.scale.set(1, h * grow, 1);
      e.obj.position.y = pos.y + (h * grow) / 2 - 0.2;
      e.obj.material.opacity = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
    });
  }

  meshFx(obj, life, update) {
    return this._fx(obj, life, update);
  }

  flashLight(pos, color = '#ffffff', intensity = 6, life = 0.15, dist = 14) {
    if (G.settings && G.settings.reduceFlashing) intensity *= 0.33; // Settings: reduce flashing
    let l = this.lights.find((x) => x.userData.t <= 0) || this.lights[0];
    l.position.copy(pos);
    l.color.set(color);
    l.distance = dist;
    l.userData.t = life;
    l.userData.life = life;
    l.userData.i = intensity;
    l.intensity = intensity;
  }

  addShake(a) {
    const s = (G.settings ? G.settings.cameraShake ?? 1 : 1) * (G.settings && G.settings.reduceFlashing ? 0.33 : 1);
    this.shake = Math.min(1.2, this.shake + a * s);
  }

  hitStop(t = 0.06) {
    G.game && G.game.hitStop(t);
  }

  number(pos, value, kind = 'dmg') {
    if (!this.numLayer || (G.settings && !G.settings.damageNumbers)) return;
    const el = document.createElement('div');
    el.className = 'dmg-num ' + kind;
    el.textContent = typeof value === 'number' ? Math.round(value) : value;
    this.numLayer.appendChild(el);
    this.numbers.push({ el, pos: pos.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), t: 0, life: 0.9 });
  }

  // Called once the world is built (so nothing the world makes is renumbered), before the
  // warm-up: a trail no one swings, so the trail shader is compiled behind the menu rather than
  // when the player first appears and is never released when the last swinger leaves, and an
  // exemplar of each kind of effect material (keepEffectPrograms).
  keepPrograms() {
    this.spareTrail = new Trail(this.scene, '#ffffff');
    this.spareTrail.mesh.visible = false;
    keepEffectPrograms(this.scene);
  }

  newTrail(color) {
    const t = new Trail(this.scene, color);
    this.trails.add(t);
    return t;
  }
  removeTrail(t) {
    if (!t) return;
    t.dispose(this.scene);
    this.trails.delete(t);
  }

  update(dt, camera) {
    this.add.update(dt);
    this.norm.update(dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const f = clamp(e.t / e.life, 0, 1);
      if (e.update) e.update(e, f, dt);
      if (e.t >= e.life) {
        this.scene.remove(e.obj);
        e.obj.traverse((c) => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        });
        this.effects.splice(i, 1);
      }
    }
    for (const t of this.trails) t.update(dt);
    for (const l of this.lights) {
      if (l.userData.t > 0) {
        l.userData.t -= dt;
        l.intensity = l.userData.i * Math.max(0, l.userData.t / l.userData.life);
      } else l.intensity = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 3.5);

    // emitters (campfires etc.)
    const pp = G.player ? G.player.pos : camera.position;
    for (const em of this.emitters) {
      if (Math.abs(em.pos.x - pp.x) > 80 || Math.abs(em.pos.z - pp.z) > 80) continue;
      em.acc = (em.acc || 0) + dt * em.rate;
      while (em.acc >= 1) {
        em.acc -= 1;
        const sp = em.spread || 0.25;
        if (em.kind === 'fire') this.fire(em.pos, sp, 1);
        else if (em.kind === 'riftfire') this.fire(em.pos, sp, 1, '#a274ff');
        else if (em.kind === 'smoke') {
          // hearth smoke: slow, grey, spreading as it rises off a roof
          const c = this._c.set(em.color || '#9c978b');
          this.norm.emit(em.pos.x + rand(-sp, sp), em.pos.y, em.pos.z + rand(-sp, sp), rand(-0.25, 0.25), rand(0.7, 1.2), rand(-0.25, 0.25), c, rand(0.45, 0.7), rand(3.5, 5), { gravity: -0.12, drag: 0.35, endSize: 2.4, alpha: 0.32 });
        }
        else if (em.kind === 'riftmote') {
          const c = this._c.set('#d8c0ff');
          this.add.emit(em.pos.x + rand(-sp, sp), em.pos.y + rand(-2, 2), em.pos.z + rand(-sp, sp), 0, rand(0.3, 1), 0, c, 0.15, 1.5, { drag: 0.5 });
        }
      }
    }

    // damage numbers
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new THREE.Vector3();
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += dt;
      if (n.t > n.life) {
        n.el.remove();
        this.numbers.splice(i, 1);
        continue;
      }
      v.copy(n.pos);
      v.y += 1.0 + n.t * 1.2;
      v.project(camera);
      if (v.z > 1) {
        n.el.style.display = 'none';
        continue;
      }
      n.el.style.display = 'block';
      n.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%,-50%) scale(${1 + Math.max(0, 0.2 - n.t) * 2})`;
      n.el.style.opacity = String(1 - Math.max(0, (n.t - 0.5) / 0.4));
    }
  }
}
