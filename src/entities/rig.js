// Procedural low-poly humanoid model + pose-blending animator.
import * as THREE from 'three';
import { JOINTS, SCALARS, STANCES, POSES, ATTACKS } from './anims.js';
import { damp, clamp, lerp, angleWrap } from '../core/util.js';
import { buildWeaponMesh, buildGauntlet } from './weaponMesh.js';

function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: o.roughness ?? 0.85,
    metalness: o.metalness ?? 0,
    emissive: o.emissive || '#000000',
    emissiveIntensity: o.ei ?? 1,
  });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

// Shadow LOD for any rig. Parts smaller than a few texels of the 140 m shadow map (eyes,
// fingers, trims) never cast; the rest cast only while `on`. In a crowded street the tiny
// parts were most of the shadow pass's draw calls and none of its visible shadow.
const _scale = new THREE.Vector3();
export function setRigShadows(root, on) {
  let casters = root.userData.casters;
  if (!casters) {
    casters = root.userData.casters = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const sc = o.getWorldScale(_scale);
      if (o.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) >= 0.15) casters.push(o);
    });
    root.userData.shadowOn = null;
  }
  if (root.userData.shadowOn === on) return;
  root.userData.shadowOn = on;
  for (const o of casters) o.castShadow = on;
}

// The leg's length (hip to sole) at scale 1, for the walk cadence, and how much farther than a
// planted stride a running stride carries (its flight).
const LEG = 0.9;
const FLIGHT = 0.4;
// Share of an attack's wind-up spent winding; the rest carries the blade to the contact pose, so it
// meets the target as the active phase (the rules' strike) begins.
const CONTACT_LEAD = 0.78;

export class HumanoidRig {
  constructor(look = {}) {
    this.look = look;
    const o = look.outfit || { main: '#7a6a55', trim: '#4b3f31', pants: '#4a4036', boots: '#2e2620' };
    const f = look.features || {};
    this.mats = {
      skin: M(look.skin || '#d8a880', { emissive: f.glow || '#000000', ei: f.glow ? 0.35 : 1, metalness: f.scales ? 0.25 : 0, roughness: f.scales ? 0.5 : 0.85 }),
      main: M(o.main, { metalness: look.armored ? 0.5 : 0, roughness: look.armored ? 0.45 : 0.9 }),
      trim: M(o.trim),
      pants: M(o.pants),
      boots: M(o.boots),
      hair: M(look.hair || '#2a1a10'),
      eye: M(look.eyes || '#222222', { emissive: look.glowEyes ? look.eyes || '#ffffff' : '#000000', ei: look.glowEyes ? 2.5 : 1 }),
      white: M('#f2f2ee'),
    };
    this.flashMats = [this.mats.skin, this.mats.main, this.mats.trim, this.mats.pants, this.mats.boots, this.mats.hair];
    for (const m of this.flashMats) m.userData.baseEmissive = m.emissive.clone();
    this.flashT = 0;

    const root = (this.root = new THREE.Group());
    const sg = (this.scaleGroup = new THREE.Group());
    const scale = look.scale || 1;
    sg.scale.setScalar(scale);
    root.add(sg);
    const body = (this.body = new THREE.Group());
    body.position.y = 0.95;
    sg.add(body);

    const j = (this.j = {});
    const mt = this.mats;
    // spine / torso
    j.spine = new THREE.Group();
    body.add(j.spine);
    j.spine.add(box(0.36, 0.2, 0.22, mt.pants, 0, -0.02, 0));
    j.spine.add(box(0.42, 0.5, 0.25, mt.main, 0, 0.27, 0));
    j.spine.add(box(0.44, 0.07, 0.27, mt.trim, 0, 0.06, 0));
    if (look.apron) j.spine.add(box(0.34, 0.55, 0.03, M('#8a7a60'), 0, 0.12, 0.14));
    j.chest = new THREE.Group();
    j.chest.position.y = 0.5;
    j.spine.add(j.chest);
    j.chest.add(box(0.2, 0.06, 0.27, mt.trim, 0, -0.01, 0));
    if (look.armored) {
      for (const sx of [-1, 1]) j.chest.add(box(0.2, 0.08, 0.22, mt.main, sx * 0.27, 0.0, 0));
    }
    if (look.cape) {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.0, 0.03), M(look.cape));
      cape.geometry.translate(0, -0.5, 0);
      cape.position.set(0, -0.02, -0.15);
      cape.castShadow = true;
      j.chest.add(cape);
      this.cape = cape;
    }

    // head
    j.head = new THREE.Group();
    j.head.position.y = 0.06;
    j.chest.add(j.head);
    j.head.add(box(0.11, 0.1, 0.11, mt.skin, 0, 0.03, 0));
    const head = box(0.26, 0.29, 0.27, mt.skin, 0, 0.21, 0);
    j.head.add(head);
    for (const sx of [-1, 1]) j.head.add(box(0.05, 0.035, 0.02, mt.eye, sx * 0.065, 0.23, 0.137));
    this._buildHair(look);
    this._buildFeatures(look, f);

    // arms
    const arm = (side) => {
      const s = side === 'l' ? 1 : -1;
      const sh = new THREE.Group();
      sh.position.set(s * 0.27, -0.05, 0);
      j.chest.add(sh);
      sh.add(box(0.13, 0.3, 0.13, mt.main, 0, -0.13, 0));
      const el = new THREE.Group();
      el.position.y = -0.29;
      sh.add(el);
      el.add(box(0.115, 0.27, 0.115, look.armored ? mt.main : mt.skin, 0, -0.13, 0));
      el.add(box(0.125, 0.06, 0.125, mt.trim, 0, -0.22, 0));
      const hand = new THREE.Group();
      hand.position.y = -0.28;
      el.add(hand);
      hand.add(box(0.09, 0.1, 0.09, mt.skin, 0, -0.04, 0));
      j[side + 'Shoulder'] = sh;
      j[side + 'Elbow'] = el;
      j[side + 'Hand'] = hand;
    };
    arm('l');
    arm('r');

    // legs
    const leg = (side) => {
      const s = side === 'l' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(s * 0.105, -0.06, 0);
      body.add(hip);
      hip.add(box(0.16, 0.44, 0.17, mt.pants, 0, -0.21, 0));
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      hip.add(knee);
      knee.add(box(0.14, 0.3, 0.14, mt.pants, 0, -0.12, 0));
      knee.add(box(0.15, 0.2, 0.15, mt.boots, 0, -0.3, 0));
      knee.add(box(0.15, 0.1, 0.25, mt.boots, 0, -0.39, 0.04));
      j[side + 'Hip'] = hip;
      j[side + 'Knee'] = knee;
    };
    leg('l');
    leg('r');

    if (f.tail) this._buildTail(f.tail);

    this.weapon = null;
    this.gauntlets = [];
    this.anim = new Animator(this);
  }

  _buildHair(look) {
    const j = this.j;
    const hm = this.mats.hair;
    const style = look.hairStyle ?? 0;
    if (look.hood) {
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 6), M(look.outfit ? look.outfit.main : '#444'));
      hood.position.set(0, 0.34, -0.02);
      hood.castShadow = true;
      j.head.add(hood);
      j.head.add(box(0.3, 0.2, 0.3, M(look.outfit ? look.outfit.main : '#444'), 0, 0.24, -0.02));
      return;
    }
    if (look.helm) {
      j.head.add(box(0.31, 0.2, 0.31, M(look.helm, { metalness: 0.6, roughness: 0.3 }), 0, 0.32, 0));
      j.head.add(box(0.08, 0.12, 0.05, M(look.helm, { metalness: 0.6, roughness: 0.3 }), 0, 0.42, 0.06));
      return;
    }
    if (style !== 3) j.head.add(box(0.28, 0.08, 0.29, hm, 0, 0.37, -0.005));
    if (style === 0) j.head.add(box(0.28, 0.12, 0.08, hm, 0, 0.3, -0.12));
    if (style === 1) {
      j.head.add(box(0.29, 0.38, 0.1, hm, 0, 0.18, -0.12));
      for (const sx of [-1, 1]) j.head.add(box(0.04, 0.24, 0.2, hm, sx * 0.14, 0.24, -0.02));
    }
    if (style === 2) {
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), hm);
        c.position.set(0, 0.43, 0.1 - i * 0.06);
        c.rotation.x = -0.3 - i * 0.1;
        j.head.add(c);
      }
    }
    if (style === 4) {
      j.head.add(box(0.28, 0.12, 0.08, hm, 0, 0.3, -0.12));
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.3, 5), hm);
      tail.position.set(0, 0.2, -0.2);
      tail.rotation.x = 0.4;
      j.head.add(tail);
    }
    if (look.beard) j.head.add(box(0.22, 0.12, 0.06, M(look.beard), 0, 0.08, 0.12));
    if (look.bandana) j.head.add(box(0.29, 0.05, 0.29, M(look.bandana), 0, 0.31, 0));
    if (look.crown) {
      const cm = M(look.crown, { emissive: look.crown, ei: 1.2 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), cm);
        c.position.set(Math.sin(a) * 0.13, 0.48, Math.cos(a) * 0.13);
        j.head.add(c);
      }
    }
  }

  _buildFeatures(look, f) {
    const j = this.j;
    const sk = this.mats.skin;
    const hair = this.mats.hair;
    if (f.ears === 'pointed') {
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), sk);
        e.position.set(sx * 0.15, 0.25, -0.02);
        e.rotation.z = -sx * 1.2;
        e.rotation.x = -0.3;
        j.head.add(e);
      }
    } else if (f.ears === 'cat' || f.ears === 'wolf') {
      const big = f.ears === 'wolf' ? 1.25 : 1;
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.06 * big, 0.14 * big, 4), hair);
        e.position.set(sx * 0.09, 0.42, -0.02);
        e.rotation.z = -sx * 0.25;
        j.head.add(e);
      }
    }
    if (f.horns === 'curled') {
      const hm = M('#e8dcc4');
      for (const sx of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 5, 8, Math.PI * 1.4), hm);
        t.position.set(sx * 0.15, 0.33, -0.03);
        t.rotation.y = Math.PI / 2;
        t.rotation.z = sx > 0 ? 0.5 : 2.6;
        j.head.add(t);
      }
    } else if (f.horns === 'straight') {
      const hm = M('#3a3028');
      for (const sx of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), hm);
        c.position.set(sx * 0.09, 0.42, -0.08);
        c.rotation.x = -0.7;
        c.rotation.z = -sx * 0.2;
        j.head.add(c);
      }
    }
    if (f.snout) j.head.add(box(0.14, 0.1, 0.1, sk, 0, 0.13, 0.17));
    if (f.tusks) {
      for (const sx of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 4), this.mats.white);
        c.position.set(sx * 0.07, 0.12, 0.13);
        j.head.add(c);
      }
    }
    if (f.brow) j.head.add(box(0.27, 0.05, 0.06, sk, 0, 0.27, 0.13));
    if (f.crystals) {
      const cm = M('#bfefff', { emissive: '#7ff7ff', ei: 0.9, roughness: 0.2 });
      const spots = [[0.27, 0.05, 0, 'chest'], [-0.27, 0.05, 0, 'chest'], [0.1, 0.36, -0.1, 'head']];
      for (const [x, y, z, p] of spots) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), cm);
        c.position.set(x, y, z);
        c.scale.y = 1.8;
        j[p].add(c);
      }
    }
    if (f.marks) {
      const mm = M(f.marks, { emissive: f.marks, ei: 1.2 });
      for (const sx of [-1, 1]) j.head.add(box(0.015, 0.1, 0.02, mm, sx * 0.08, 0.15, 0.137));
    }
    if (f.starMarks) {
      const mm = M('#ffffff', { emissive: '#ffffff', ei: 2 });
      const pts = [[0.07, 0.3, 0.137], [-0.05, 0.12, 0.137], [0.1, 0.1, 0.137]];
      for (const [x, y, z] of pts) j.head.add(box(0.02, 0.02, 0.01, mm, x, y, z));
    }
  }

  _buildTail(kind) {
    const mat = kind === 'lizard' ? this.mats.skin : this.mats.hair;
    const g = new THREE.Group();
    // sit on the lower back; cylinders are local -Y, so +X rotation aims that axis behind the body
    g.position.set(0, -0.14, -0.13);
    this.body.add(g);
    const segs = kind === 'cat' ? 4 : 3;
    let parent = g;
    this.tailSegs = [];
    for (let i = 0; i < segs; i++) {
      const r0 = kind === 'lizard' ? 0.09 - i * 0.025 : kind === 'wolf' ? 0.07 + (i === 1 ? 0.02 : 0) : 0.035;
      const len = kind === 'cat' ? 0.18 : 0.2;
      const seg = new THREE.Group();
      if (i > 0) seg.position.y = -len;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.8, r0, len, 5), mat);
      mesh.position.y = -len / 2;
      mesh.castShadow = true;
      seg.add(mesh);
      // root ~70° toward -Z (back + slightly down); later segments gently curl
      seg.rotation.x = i === 0 ? 1.2 : 0.28;
      parent.add(seg);
      parent = seg;
      this.tailSegs.push(seg);
    }
  }

  setWeapon(def, enchant) {
    if (this.weapon) {
      this.weapon.group.parent && this.weapon.group.parent.remove(this.weapon.group);
      this.weapon = null;
    }
    for (const gnt of this.gauntlets) gnt.parent && gnt.parent.remove(gnt);
    this.gauntlets = [];
    if (!def) return;
    if (def.cls === 'fist') {
      if (!def.bare) for (const side of ['l', 'r']) {
        const gnt = buildGauntlet(def);
        gnt.position.y = -0.05;
        this.j[side + 'Hand'].add(gnt);
        this.gauntlets.push(gnt);
      }
      this.weapon = { group: new THREE.Group(), tip: this.j.rHand, base: this.j.rElbow, fist: true };
      return;
    }
    const w = buildWeaponMesh(def, enchant);
    w.group.position.set(0, -0.06, 0);
    this.j.rHand.add(w.group);
    this.weapon = w;
  }

  play(name, timing, opts) {
    this.anim.play(name, timing, opts);
  }
  stop() {
    this.anim.stop();
  }
  // A flourish holds the swing at the top of its wind-up (the attack's timing decides; this only shows it).
  holdSwing(on) {
    if (this.anim.action) this.anim.action.pause = on;
  }
  update(dt, st) {
    this.anim.update(dt, st);
  }

  setWeaponVisible(v) {
    if (this.weapon && this.weapon.group) this.weapon.group.visible = v;
  }

  flash(color = '#ffffff', intensity = 0.8, time = 0.12) {
    this.flashT = time;
    this.flashDur = time;
    this.flashColor = new THREE.Color(color);
    this.flashI = intensity;
  }

  setOpacity(o) {
    const all = [...Object.values(this.mats)];
    for (const m of all) {
      m.transparent = o < 1;
      m.opacity = o;
      m.depthWrite = o >= 1;
    }
    if (this.weapon && this.weapon.group) this.weapon.group.traverse((c) => {
      if (c.material) {
        c.material.transparent = o < 1;
        c.material.opacity = o;
      }
    });
  }

  updateFlash(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / this.flashDur) * this.flashI;
      for (const m of this.flashMats) m.emissive.copy(m.userData.baseEmissive).lerp(this.flashColor, k);
      if (this.flashT <= 0) for (const m of this.flashMats) m.emissive.copy(m.userData.baseEmissive);
    }
  }

  dispose() {
    const mats = new Set(Object.values(this.mats));
    this.root.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) mats.add(c.material);
    });
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  }
}

// ---------------------------------------------------------------- animator
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);

export class Animator {
  constructor(rig) {
    this.rig = rig;
    this.cur = {};
    this.target = {};
    for (const k of JOINTS) {
      this.cur[k] = [0, 0, 0];
      this.target[k] = [0, 0, 0];
    }
    for (const k of SCALARS) {
      this.cur[k] = 0;
      this.target[k] = 0;
    }
    this.phase = Math.random() * 10;
    this.stance = 'none';
    this.action = null;
    this.time = Math.random() * 10;
    this.roll = null;
  }

  setStance(s) {
    this.stance = STANCES[s] ? s : 'none';
  }

  // name from ATTACKS. timing: { windup, active, recovery }
  play(name, timing, opts = {}) {
    const def = ATTACKS[name];
    if (!def) return;
    this.action = { def, name, t: 0, w: Math.max(0.01, timing.windup), a: Math.max(0.01, timing.active), r: Math.max(0.01, timing.recovery), hold: opts.hold || false };
  }

  playPose(poseName, duration) {
    const p = POSES[poseName];
    if (!p) return;
    this.action = { def: { wind: p, strike: p }, name: poseName, t: 0, w: 0.12, a: Math.max(0.01, duration - 0.24), r: 0.12 };
  }

  stop() {
    this.action = null;
  }

  startRoll(dirLocal, duration) {
    this.roll = { t: 0, d: duration, dir: dirLocal };
  }

  _apply(T, pose, w = 1) {
    for (const k in pose) {
      const v = pose[k];
      if (Array.isArray(v)) {
        const t = T[k];
        t[0] = lerp(t[0], v[0], w);
        t[1] = lerp(t[1], v[1], w);
        t[2] = lerp(t[2], v[2], w);
      } else T[k] = lerp(T[k], v, w);
    }
  }

  update(dt, st) {
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const T = this.target;
    for (const k of JOINTS) {
      T[k][0] = 0;
      T[k][1] = 0;
      T[k][2] = 0;
    }
    for (const k of SCALARS) T[k] = 0;

    const speed = st.speed || 0;
    const stanceKey = st.weaponOut === false ? 'none' : this.stance;
    const stance = STANCES[stanceKey];
    this._apply(T, stance);

    if (st.dead) this._apply(T, POSES.dead);
    else if (st.knocked) this._apply(T, POSES.knocked);
    else if (st.swimming) this._swim(T, speed);
    else if (st.climbing) this._hang(T);
    else if (st.sliding) this._apply(T, POSES.slide);
    else if (!st.grounded) this._apply(T, (st.vy || 0) > 1 ? (st.leap ? POSES.leap : POSES.jump) : POSES.fall, 0.85);
    else this._walk(T, speed, dt, stanceKey, st.runSpeed || 9, st.fwd ?? 1, st.side ?? 0);

    if (st.sit) this._apply(T, POSES.sit);
    if (st.charging) this._apply(T, POSES.charge);
    if (st.blocking && !st.dead && !st.knocked) {
      const bp = stanceKey === 'fist' || stanceKey === 'none' ? POSES.block_fist : stanceKey === 'twoHand' ? POSES.block_heavy : POSES.block_weapon;
      this._apply(T, bp);
    }
    if (st.stunned) this._apply(T, POSES.stunned);
    if (st.flinch > 0) {
      T.spine[0] -= 0.35 * st.flinch;
      T.head[0] -= 0.3 * st.flinch;
    }

    let fast = false;
    if (this.action && !st.dead && !st.knocked) {
      const a = this.action;
      a.t += dt;
      if (a.pause && a.t > a.w * CONTACT_LEAD - 0.001) a.t = a.w * CONTACT_LEAD - 0.001; // held at the top of the wind
      const total = a.w + a.a + a.r;
      if (a.t >= total && !a.hold) this.action = null;
      else {
        this._sampleAction(T, a);
        fast = true;
      }
    }

    if (this.roll) {
      const r = this.roll;
      r.t += dt;
      const f = clamp(r.t / r.d, 0, 1);
      if (f >= 1) this.roll = null;
      else {
        const s = Math.sin(f * Math.PI);
        if (r.dir === 'f') {
          T.bodyPitch = f * Math.PI * 2;
          T.bodyY = -0.45 * s;
        } else if (r.dir === 'b') {
          T.bodyPitch = -0.5 * s;
          T.spine[0] = -0.3 * s;
          T.bodyY = -0.15 * s;
        } else {
          const sd = r.dir === 'l' ? 1 : -1;
          T.bodyRoll = -sd * 0.55 * s;
          T.bodyY = -0.2 * s;
        }
        T.lHip[0] = -1.2 * s;
        T.rHip[0] = -1.2 * s;
        T.lKnee[0] = 1.8 * s;
        T.rKnee[0] = 1.8 * s;
        fast = true;
      }
    }

    // damp toward target
    const C = this.cur;
    const k = fast ? 40 : 16;
    for (const key of JOINTS) {
      const c = C[key];
      const t = T[key];
      c[0] = damp(c[0], t[0], k, dt);
      c[1] = damp(c[1], t[1], k, dt);
      c[2] = damp(c[2], t[2], k, dt);
    }
    for (const key of SCALARS) {
      if (key === 'bodyYaw' || key === 'bodyPitch') {
        C[key] = T[key] + angleWrap(C[key] - T[key]);
      }
      C[key] = damp(C[key], T[key], key === 'bodyPitch' && this.roll ? 60 : k, dt);
    }

    // never let a bad value poison the pose
    for (const key of JOINTS) {
      const c = C[key];
      if (!Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(c[2])) C[key] = [0, 0, 0];
    }
    for (const key of SCALARS) if (!Number.isFinite(C[key])) C[key] = 0;
    // write
    const j = this.rig.j;
    for (const key of JOINTS) {
      const v = C[key];
      j[key].rotation.set(v[0], v[1], v[2]);
    }
    const b = this.rig.body;
    b.position.y = 0.95 + C.bodyY;
    b.rotation.set(C.bodyPitch, C.bodyYaw, C.bodyRoll, 'YXZ');

    // secondary motion
    if (this.rig.cape) this.rig.cape.rotation.x = -0.15 - Math.min(0.9, speed * 0.07) + Math.sin(this.time * 3) * 0.04;
    if (this.rig.tailSegs) {
      this.rig.tailSegs.forEach((s, i) => {
        s.rotation.z = Math.sin(this.time * 2.2 + i * 0.7) * 0.25;
      });
    }
  }

  _sampleAction(T, a) {
    const d = a.def;
    const keys = new Set([...Object.keys(d.wind || {}), ...Object.keys(d.strike || {}), ...Object.keys(d.mid || {})]);
    if (d.keysActive) for (const p of d.keysActive) for (const k in p) keys.add(k);
    const val = (pose, k) => (pose && pose[k] !== undefined ? pose[k] : T[k]);
    const mix = (va, vb, f) => (Array.isArray(va) ? [lerp(va[0], vb[0], f), lerp(va[1], vb[1], f), lerp(va[2], vb[2], f)] : lerp(va, vb, f));
    const out = {};
    for (const k of keys) {
      const base = T[k];
      let v;
      // The blade meets its target when the attack's active phase starts (that is when the rules
      // strike), so the swing travels from the wind to the contact pose in the wind-up's last part
      // (CONTACT_LEAD on), and the active phase follows through. The contact pose is the middle
      // key, or most of the way to the strike for a two-key swing.
      const lead = a.w * CONTACT_LEAD;
      const contact = (kk) => (d.mid ? val(d.mid, kk) : mix(val(d.wind, kk), val(d.strike, kk), 0.6));
      if (d.keysActive) {
        if (a.t < a.w) v = mix(base, val(d.wind, k), ease(a.t / a.w));
        else if (a.t < a.w + a.a) {
          const seq = [d.wind, ...d.keysActive, d.strike];
          const x = ((a.t - a.w) / a.a) * (seq.length - 1);
          const i = Math.min(seq.length - 2, Math.floor(x));
          v = mix(val(seq[i], k), val(seq[i + 1], k), x - i);
        } else if (a.hold) v = val(d.strike, k);
        else v = mix(val(d.strike, k), base, ease(clamp((a.t - a.w - a.a) / a.r, 0, 1)));
      } else if (a.t < lead) v = mix(base, val(d.wind, k), ease(a.t / lead));
      else if (a.t < a.w) v = mix(val(d.wind, k), contact(k), ease((a.t - lead) / (a.w - lead)));
      else if (a.t < a.w + a.a) v = mix(contact(k), val(d.strike, k), easeOut((a.t - a.w) / a.a));
      else if (a.hold) v = val(d.strike, k);
      else {
        const f = clamp((a.t - a.w - a.a) / a.r, 0, 1);
        v = mix(val(d.strike, k), base, ease(f));
      }
      out[k] = v;
    }
    for (const k in out) {
      if (Array.isArray(out[k])) {
        T[k][0] = out[k][0];
        T[k][1] = out[k][1];
        T[k][2] = out[k][2];
      } else T[k] = out[k];
    }
  }

  // The legs swing at the cadence that keeps a planted foot still: at mid-stance the foot moves
  // back at legLen * A * rate, which must match the ground speed (less a running stride's flight).
  // Walking backward runs the cycle in reverse; moving sideways swings the legs out to the side.
  _walk(T, speed, dt, stanceKey, runSpeed, fwd = 1, side = 0) {
    const moving = speed > 0.3;
    const run = clamp((speed - 5.5) / (runSpeed - 5.5), 0, 1);
    const A = moving ? clamp(speed / 5, 0.3, 1) * (0.55 + run * 0.35) : 0;
    const legLen = LEG * (this.rig.look && this.rig.look.scale ? this.rig.look.scale : 1);
    const rate = moving ? speed / (legLen * Math.max(0.2, A) * (1 + run * FLIGHT)) : 0;
    const sideways = Math.abs(side) > Math.abs(fwd) + 0.2;
    this.phase += dt * rate * (fwd < -0.3 && !sideways ? -1 : 1);
    this.cadence = rate;
    this.stride = A;
    const p = this.phase;
    const s = Math.sin(p);
    const c = Math.cos(p);
    if (sideways) {
      // a side-step: the hips open and close to the side, the knees lift less
      const k = Math.sign(side) || 1;
      T.lHip[2] += (s * A * 0.7 + 0.05) * k;
      T.rHip[2] += (-s * A * 0.7 - 0.05) * k;
      T.lKnee[0] += A * 0.6 * Math.max(0, -c) + 0.08;
      T.rKnee[0] += A * 0.6 * Math.max(0, c) + 0.08;
      T.bodyY += (Math.abs(c) - 1) * 0.03 * A;
      return;
    }
    T.lHip[0] += s * A;
    T.rHip[0] += -s * A;
    T.lKnee[0] += A * 1.4 * Math.max(0, -c) + (moving ? 0.1 : 0.04);
    T.rKnee[0] += A * 1.4 * Math.max(0, c) + (moving ? 0.1 : 0.04);
    T.bodyY += moving ? (Math.abs(c) - 1) * 0.045 * A : Math.sin(this.time * 1.6) * 0.008 - 0.01;
    T.spine[0] += run * 0.22 + (moving ? 0.04 : 0);
    T.spine[1] += s * A * 0.12;
    T.chest[0] += Math.sin(this.time * 1.7) * 0.02;
    T.head[0] -= run * 0.15;
    if (stanceKey === 'none' || run > 0.5) {
      const armA = stanceKey === 'none' ? A * 0.9 : A * 0.6 * run;
      T.lShoulder[0] += -s * armA;
      T.rShoulder[0] += s * armA * (stanceKey === 'none' ? 1 : 0.5);
      T.lElbow[0] -= 0.3 + run * 0.6;
      if (stanceKey === 'none') T.rElbow[0] -= 0.3 + run * 0.6;
    }
    if (!moving) {
      T.lShoulder[2] += Math.sin(this.time * 1.7) * 0.015;
      T.rShoulder[2] -= Math.sin(this.time * 1.7) * 0.015;
    }
  }

  _swim(T, speed) {
    this.phase += 0.016 * (2 + speed);
    const p = this.phase;
    const moving = speed > 0.5;
    T.bodyPitch = moving ? 1.25 : 0.25;
    T.bodyY = moving ? -0.7 : -0.5;
    T.head[0] = moving ? -1.0 : -0.2;
    if (moving) {
      T.rShoulder = [-1.5 + Math.sin(p) * 1.4, 0, -0.3];
      T.lShoulder = [-1.5 - Math.sin(p) * 1.4, 0, 0.3];
      T.lHip[0] = Math.sin(p * 3) * 0.3;
      T.rHip[0] = -Math.sin(p * 3) * 0.3;
    } else {
      T.rShoulder = [-0.3 + Math.sin(p * 2) * 0.3, 0, -0.9];
      T.lShoulder = [-0.3 - Math.sin(p * 2) * 0.3, 0, 0.9];
      T.lHip[0] = Math.sin(p * 2) * 0.4;
      T.rHip[0] = -Math.sin(p * 2) * 0.4;
      T.lKnee[0] = 0.5;
      T.rKnee[0] = 0.5;
    }
  }

  // Hanging from a ledge (or a carrier line): both hands up on the edge, the body close to the
  // wall, the legs hanging with a little sway.
  _hang(T) {
    const sway = Math.sin(this.time * 1.6) * 0.05;
    T.rShoulder = [-2.95, 0.05, -0.28];
    T.lShoulder = [-2.95, -0.05, 0.28];
    T.rElbow[0] = -0.38;
    T.lElbow[0] = -0.38;
    T.spine[0] = -0.08;
    T.head[0] = -0.3;
    T.lHip[0] = 0.12 + sway;
    T.rHip[0] = 0.05 - sway;
    T.lKnee[0] = 0.32;
    T.rKnee[0] = 0.45;
    T.bodyRoll = sway * 0.6;
  }

  _climb(T, climbSpeed) {
    this.phase += 0.016 * (1 + Math.abs(climbSpeed) * 2);
    const s = Math.sin(this.phase * 2);
    T.rShoulder = [-2.7 + s * 0.35, 0, -0.35];
    T.lShoulder = [-2.7 - s * 0.35, 0, 0.35];
    T.rElbow[0] = -0.6 - Math.max(0, s) * 0.6;
    T.lElbow[0] = -0.6 - Math.max(0, -s) * 0.6;
    T.lHip[0] = -0.6 - s * 0.4;
    T.rHip[0] = -0.6 + s * 0.4;
    T.lKnee[0] = 1.0 + s * 0.3;
    T.rKnee[0] = 1.0 - s * 0.3;
    T.spine[0] = -0.1;
    T.head[0] = -0.4;
  }
}
