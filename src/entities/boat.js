// Boats: skiff, sloop, longship (player-sailed) and captained ferries. Every boat has seats;
// seat 0 is the helm. Occupants can be the local player, LAN friends (RemotePlayer) or a
// captain (a plain object for ferries).
//   API: new Boat(pos, yaw, type) · board(actor, seat) · leave(actor) · freeSeat() · seatPos(actor)
//        drive(dt, input) (helm only) · update(dt) · dispose()
//   netProxy = true: positions come from the network; update() only syncs the mesh.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { makeBoatMesh } from '../world/props.js';
import { waveHeight } from '../world/water.js';
import { damp } from '../core/util.js';
import { BOATS } from '../data/boats.js';
import { ACTIONS } from '../game/hooks.js';
import { SWIM_Y } from './actor.js';

const _f = new THREE.Vector3();
const _probe = new THREE.Vector3();

let nextId = 1;
const mats = new Map();
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, side: o.double ? THREE.DoubleSide : THREE.FrontSide, metalness: o.metal || 0 }));
  return mats.get(key);
}
function part(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

// A tapered hull: box midsection plus a pointed bow and blunt stern.
function hull(g, def, L, W, H) {
  const wood = M(def.hull);
  const dark = M(new THREE.Color(def.hull).multiplyScalar(0.7).getStyle());
  part(g, new THREE.BoxGeometry(W, H, L * 0.7), wood, 0, 0, -L * 0.05);
  const bow = part(g, new THREE.ConeGeometry(W * 0.72, L * 0.32, 4), wood, 0, 0, L * 0.45);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.scale.set(1, 1, H / W);
  part(g, new THREE.BoxGeometry(W * 0.92, H * 0.85, L * 0.12), dark, 0, 0, -L * 0.42);
  part(g, new THREE.BoxGeometry(W * 0.86, 0.06, L * 0.72), M('#8a6a48'), 0, H * 0.42, -L * 0.05); // deck
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.08, 0.14, L * 0.74), dark, s * W * 0.48, H * 0.52, -L * 0.05); // gunwales
}

function sailMesh(g, def, w, h, y, z, stripes = 0) {
  const sail = new THREE.Group();
  sail.position.set(0, y, z);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M(def.sail, { double: true }));
  cloth.castShadow = true;
  sail.add(cloth);
  if (stripes && def.stripe) {
    for (let i = 0; i < stripes; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.001, h / (stripes * 2 + 1)), M(def.stripe, { double: true }));
      s.position.set(0, -h / 2 + (h / (stripes * 2 + 1)) * (i * 2 + 1.5), 0.01);
      sail.add(s);
    }
  }
  g.add(sail);
  return sail;
}

function buildMesh(type, def) {
  if (type === 'skiff') return makeBoatMesh(def.hull, def.sail, true);
  const g = new THREE.Group();
  const L = def.length;
  if (type === 'sloop' || type === 'cutter') {
    hull(g, def, L, 2.2, 0.9);
    part(g, new THREE.CylinderGeometry(0.08, 0.1, 7, 6), M('#4a3a28'), 0, 3.8, 0.6);
    g.userData.sail = sailMesh(g, def, 2.8, 4.6, 3.8, 0.75, 1);
    const jib = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 6.8, 0.6), new THREE.Vector3(0, 1.2, 0.6), new THREE.Vector3(0, 1.2, 3.6)]), M(def.sail, { double: true }));
    jib.geometry.computeVertexNormals();
    g.add(jib);
  } else if (type === 'longship') {
    hull(g, def, L, 2.4, 1.0);
    // curled prow and stern posts
    for (const [z, dir] of [[L * 0.58, 1], [-L * 0.48, -1]]) {
      const post = part(g, new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6), M(def.hull), 0, 1.3, z);
      post.rotation.x = dir * 0.35;
      part(g, new THREE.TorusGeometry(0.35, 0.1, 5, 8, Math.PI * 1.4), M(def.hull), 0, 2.5, z + dir * 0.35);
    }
    // shields along the gunwales
    const shieldCols = [def.stripe || '#a8281c', '#d8c8a8', '#2a4a7a'];
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const sh = part(g, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 10), M(shieldCols[(i + (s > 0 ? 1 : 0)) % 3]), s * 1.26, 0.55, -L * 0.32 + i * (L * 0.1));
        sh.rotation.z = Math.PI / 2;
      }
    }
    // oars
    for (let i = 0; i < 5; i++) {
      for (const s of [-1, 1]) {
        const oar = part(g, new THREE.CylinderGeometry(0.04, 0.04, 3.2, 4), M('#8a6a48'), s * 2.2, 0.1, -L * 0.28 + i * (L * 0.12));
        oar.rotation.z = s * 1.15;
      }
    }
    part(g, new THREE.CylinderGeometry(0.1, 0.12, 6.5, 6), M('#4a3a28'), 0, 3.6, -0.2);
    part(g, new THREE.CylinderGeometry(0.06, 0.06, 4.2, 5), M('#4a3a28'), 0, 6.2, -0.2).rotation.z = Math.PI / 2;
    g.userData.sail = sailMesh(g, def, 4.0, 3.8, 4.3, -0.1, 2);
  } else {
    // ferry: wide hull, stern cabin, single mast
    hull(g, def, L, 2.8, 1.0);
    part(g, new THREE.BoxGeometry(2.4, 1.4, 2.0), M('#6a5a48'), 0, 1.15, -L * 0.33);
    part(g, new THREE.BoxGeometry(2.7, 0.18, 2.3), M(def.stripe || '#3a3a3a'), 0, 1.9, -L * 0.33);
    part(g, new THREE.CylinderGeometry(0.09, 0.11, 6.5, 6), M('#4a3a28'), 0, 3.6, 0.8);
    g.userData.sail = sailMesh(g, def, 3.0, 4.2, 3.9, 0.95, 1);
    // lantern at the bow
    const lamp = part(g, new THREE.BoxGeometry(0.25, 0.3, 0.25), new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffb84a', emissiveIntensity: 1.6 }), 0, 1.6, L * 0.4);
    lamp.castShadow = false;
  }
  return g;
}

export class Boat {
  constructor(pos, yaw, type = 'skiff') {
    this.id = 'b' + nextId++;
    this.type = BOATS[type] ? type : 'skiff';
    this.def = BOATS[this.type];
    this.pos = pos.clone();
    this.pos.y = 0;
    this.yaw = yaw;
    this.speed = 0;
    this.occupants = new Array(this.def.seats.length).fill(null);
    this.netProxy = false;
    this.autopilot = null; // set by game/travel.js for captained crossings
    this.mesh = buildMesh(this.type, this.def);
    this.mesh.traverse((c) => {
      if (c.isMesh) c.castShadow = true;
    });
    G.scene.add(this.mesh);
    this.wakeT = 0;
    this.syncMesh();
  }

  // seat 0 is the helm; `driver` mirrors it for older code paths
  get driver() {
    return this.occupants[0];
  }
  set driver(a) {
    this.occupants[0] = a || null;
  }
  freeSeat() {
    for (let i = 0; i < this.occupants.length; i++) if (!this.occupants[i]) return i;
    return -1;
  }
  passengers() {
    return this.occupants.filter((o, i) => o && i > 0);
  }
  board(actor, seat = this.freeSeat()) {
    if (seat < 0 || seat >= this.occupants.length) return false;
    if (this.occupants.includes(actor)) this.leave(actor);
    if (this.occupants[seat]) return false;
    this.occupants[seat] = actor;
    return true;
  }
  leave(actor) {
    const i = this.occupants.indexOf(actor);
    if (i >= 0) this.occupants[i] = null;
  }
  seatIndex(actor) {
    const i = this.occupants.indexOf(actor);
    return i < 0 ? 0 : i;
  }
  seatPos(actor) {
    const [lx, lz] = this.def.seats[actor === undefined ? 0 : this.seatIndex(actor)];
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return new THREE.Vector3(this.pos.x + lx * c + lz * s, this.pos.y + 0.15 + (this.type === 'skiff' ? 0 : 0.45), this.pos.z - lx * s + lz * c);
  }

  drive(dt, I) {
    let throttle = 0;
    let turn = 0;
    if (I) {
      throttle = (I.isDown('forward') ? 1 : 0) - (I.isDown('back') ? 0.5 : 0);
      turn = (I.isDown('left') ? 1 : 0) - (I.isDown('right') ? 1 : 0);
    }
    this.steer(dt, throttle, turn, !!(I && I.isDown('sprint')));
  }

  steer(dt, throttle, turn, boost = false) {
    const d = this.def;
    const max = (boost ? d.boost : d.speed) * this.windFactor();
    this.speed = damp(this.speed, throttle * max, (throttle ? 1.2 : 0.6) * d.accel, dt);
    // a rudder needs water moving past it: hardly any turn at rest, full turn under way
    const way = Math.min(1, Math.abs(this.speed) / 5);
    this.yaw += turn * dt * (0.15 + 1.05 * way) * d.turn;
    this.move(dt);
  }

  // The wind in the sail: up to 15% faster running before it, as much slower beating into it.
  windFactor() {
    const w = ACTIONS.wind?.();
    const s = w ? Math.hypot(w.x, w.z) : 0;
    if (s < 0.1) return 1;
    const along = (Math.sin(this.yaw) * w.x + Math.cos(this.yaw) * w.z) / s;
    return 1 + 0.15 * along * Math.min(1, s / 4);
  }

  // What the hull meets at (x, z): the shore rising out of the water, or a pier, a mole or a
  // wreck standing in it. Returns the way back out to open water, or null.
  contact(x, z) {
    const T = G.world.terrain;
    if (T.heightAt(x, z) > -0.8) {
      const gx = T.heightAt(x + 1.5, z) - T.heightAt(x - 1.5, z);
      const gz = T.heightAt(x, z + 1.5) - T.heightAt(x, z - 1.5);
      const g = Math.hypot(gx, gz);
      if (g > 1e-4) return { x: -gx / g, z: -gz / g };
      const dx = this.pos.x - x, dz = this.pos.z - z, dd = Math.hypot(dx, dz) || 1;
      return { x: dx / dd, z: dz / dd };
    }
    const cols = G.world.colliders;
    if (!cols) return null;
    _probe.set(x, this.pos.y - 0.6, z);
    const info = cols.resolve(_probe, this.def.length > 6 ? 1.0 : 0.7, 1.8, 0);
    if (!info.hit) return null;
    const n = Math.hypot(info.nx, info.nz);
    if (n > 1e-4) return { x: info.nx / n, z: info.nz / n };
    const dx = this.pos.x - x, dz = this.pos.z - z, dd = Math.hypot(dx, dz) || 1;
    return { x: dx / dd, z: dz / dd };
  }

  move(dt) {
    const f = _f.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let mx = f.x * this.speed * dt;
    let mz = f.z * this.speed * dt;
    const reach = this.def.length * 0.5 + 0.5;
    const dir = Math.sign(this.speed || 1);
    const bow = (x, z) => this.contact(x + f.x * reach * dir, z + f.z * reach * dir);
    const n = bow(this.pos.x + mx, this.pos.z + mz);
    if (n) {
      // run along what it meets rather than into it: the way into it is lost, and speed with
      // it, all of it head on and little when glancing
      const into = mx * n.x + mz * n.z;
      if (into < 0) {
        mx -= n.x * into;
        mz -= n.z * into;
      }
      const head = Math.max(0, -(f.x * n.x + f.z * n.z) * dir);
      this.speed = damp(this.speed, this.speed * (1 - head), 8, dt);
      // and a little off it, so the hull doesn't stick
      mx += n.x * 0.6 * dt;
      mz += n.z * 0.6 * dt;
      if (bow(this.pos.x + mx, this.pos.z + mz) && this.contact(this.pos.x + mx, this.pos.z + mz)) mx = mz = 0;
    }
    this.pos.x += mx;
    this.pos.z += mz;
    this.keepApart(dt);
    this.syncMesh();
    if (Math.abs(this.speed) > 3 && G.vfx?.norm) {
      this.wakeT -= dt;
      if (this.wakeT <= 0) {
        this.wakeT = 0.05;
        const back = this.pos.clone().addScaledVector(f, -this.def.length * 0.5);
        const c = new THREE.Color('#ffffff');
        const w = this.def.length > 6 ? 1.1 : 0.7;
        for (const s of [-1, 1]) G.vfx.norm.emit(back.x + f.z * s * w, 0.15, back.z - f.x * s * w, f.z * s * 1.5, 0.6, -f.x * s * 1.5, c, 0.4 * w, 0.9, { alpha: 0.6, endSize: 1.2 * w, drag: 1 });
      }
    }
  }

  // Hulls don't pass through each other: this one gives way to any boat it lies in.
  keepApart(dt) {
    const boats = G.game?.boats;
    if (!boats) return;
    for (const b of boats) {
      if (b === this || !b.def) continue;
      const dx = this.pos.x - b.pos.x, dz = this.pos.z - b.pos.z, d = Math.hypot(dx, dz);
      const min = (this.def.length + b.def.length) * 0.3;
      if (d >= min) continue;
      const k = d > 1e-3 ? (min - d) / d : 0;
      this.pos.x += (d > 1e-3 ? dx : Math.sin(this.yaw)) * Math.min(1, k) * Math.min(1, dt * 8);
      this.pos.z += (d > 1e-3 ? dz : Math.cos(this.yaw)) * Math.min(1, k) * Math.min(1, dt * 8);
      this.speed *= 1 - Math.min(0.5, dt * 2);
    }
  }

  // Where someone stepping off the boat lands: dry ground beside it if there is any within a
  // few metres (a pier, a beach), never inside a wall; otherwise the water on the open side.
  landingSpot() {
    const T = G.world.terrain, cols = G.world.colliders;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const W = this.def.length > 6 ? 1.6 : 1.1, L = this.def.length * 0.5;
    const cands = [];
    for (const [lx, lz] of [[W + 0.8, 0], [-(W + 0.8), 0], [0, L + 1], [0, -(L + 1)], [W + 2.2, 0], [-(W + 2.2), 0], [W + 1, L * 0.6], [-(W + 1), L * 0.6], [W + 1, -L * 0.6], [-(W + 1), -L * 0.6], [0, L + 2.6], [W + 3.6, 0], [-(W + 3.6), 0]]) {
      const x = this.pos.x + lx * c + lz * s, z = this.pos.z - lx * s + lz * c;
      const g = Math.max(T.heightAt(x, z), cols ? cols.groundAt(x, z, this.pos.y + 2.4) : -Infinity);
      const dry = g > SWIM_Y + 0.2;
      // nothing to stand inside, and a step up no higher than a climb out of a boat
      if (dry && g > this.pos.y + 2.2) continue;
      if (cols) {
        _probe.set(x, Math.max(g, SWIM_Y) + 0.05, z);
        const before = _probe.clone();
        cols.resolve(_probe, 0.4, 1.8);
        if (_probe.distanceTo(before) > 0.05) continue;
      }
      cands.push({ x, z, y: dry ? g : SWIM_Y, dry, d: Math.hypot(lx, lz) });
    }
    cands.sort((a, b) => (b.dry - a.dry) || a.d - b.d);
    const best = cands[0];
    return best ? new THREE.Vector3(best.x, best.y, best.z) : null;
  }

  syncMesh() {
    const t = G.time;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const half = Math.min(3, this.def.length * 0.4);
    this.pos.y = waveHeight(this.pos.x, this.pos.z, t) - 0.05;
    const pitch = (waveHeight(this.pos.x + f.x * half, this.pos.z + f.z * half, t) - waveHeight(this.pos.x - f.x * half, this.pos.z - f.z * half, t)) * (0.4 / half);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(-pitch, this.yaw, Math.sin(t * 1.3) * 0.03 * (5 / this.def.length), 'YXZ');
    if (this.mesh.userData.sail) this.mesh.userData.sail.scale.x = 1 + Math.min(0.25, Math.abs(this.speed) * 0.015);
  }

  update(dt) {
    if (this.netProxy) return this.syncMesh();
    if (this.autopilot) return this.autopilot.update(this, dt);
    const helm = this.driver;
    // a player at the helm drives from Player.update; a remote helmsman's position comes from the net
    if (!helm || helm.isRemote) {
      this.speed = damp(this.speed, 0, 0.8, dt);
      this.move(dt);
    }
  }

  dispose() {
    G.scene.remove(this.mesh);
    this.mesh.traverse((c) => c.geometry && c.geometry.dispose());
  }
}
