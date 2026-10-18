// Riding a carrier line (world/ziplines.js strings them). The rider is lifted onto the trolley,
// runs out along the cable, gathering speed and easing off before the far landing, and is set
// down on it. Player.update hands the rider to the ride while `player.zip` is set.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS } from './hooks.js';
import { LINE_HANG } from '../data/hightoll.js';

const GRAB = 0.35; // seconds to reach up and take the bar
const RAMP = 1.1; // seconds to come up to speed
const EASE = 7; // metres from the end where the trolley starts to brake
const ease = (t) => t * t * (3 - 2 * t);
// letting go mid-line: how much of the run is kept, the hop up off the bar, and how long before
// a line can be taken again (so the jump doesn't land straight back on the trolley)
export const LINE_JUMP = { keep: 0.75, hop: 5.5, regrab: 0.9 };

class Ride {
  constructor(line, p) {
    this.line = line;
    this.from = p.pos.clone();
    this.grab = 0;
    this.run = 0;
    this.s = 0;
    this.v = 0;
    this.at = new THREE.Vector3();
    line.riding = p;
  }

  hang(t) {
    this.line.curve.point(t, this.at);
    return this.at;
  }

  step(p, dt) {
    const { curve, def, trolley } = this.line;
    p.yaw = curve.yaw;
    if (this.grab < 1) {
      this.grab = Math.min(1, this.grab + dt / GRAB);
      const hold = this.hang(0);
      p.pos.lerpVectors(this.from, hold.clone().setY(hold.y - LINE_HANG), ease(this.grab));
      return;
    }
    this.run += dt;
    const left = curve.len - this.s;
    const v = def.speed * Math.min(1, 0.15 + this.run / RAMP) * Math.max(0.3, Math.min(1, left / EASE));
    this.v = v;
    this.s = Math.min(curve.len, this.s + v * dt);
    const t = this.s / curve.len;
    const hold = this.hang(t);
    trolley.position.copy(hold);
    p.pos.set(hold.x, hold.y - LINE_HANG, hold.z);
    if (t >= 1) this.land(p);
  }

  // set down on the far landing, stepping off forward
  land(p) {
    const { curve } = this.line;
    p.pos.set(curve.b.x, curve.floorB + 0.05, curve.b.z);
    p.vel.set(curve.dir.x * 2.5, 0, curve.dir.z * 2.5);
    p.fallStart = p.pos.y;
    G.audio?.play('block', { pos: p.pos, pitch: 0.6, vol: 0.6 });
    this.release(p);
  }

  // Jump pressed on the line: once the bar is taken, let go with the run carried on along the
  // cable and a hop up; the fall from here counts as any other.
  canJump() {
    return this.grab >= 1 && this.s > 0;
  }
  jump(p) {
    const { curve } = this.line;
    const t0 = Math.max(0, this.s / curve.len - 0.002), t1 = Math.min(1, this.s / curve.len + 0.002);
    const a = curve.point(t0), b = curve.point(t1);
    const dir = b.sub(a).normalize();
    p.vel.copy(dir).multiplyScalar(this.v * LINE_JUMP.keep);
    p.vel.y = Math.max(0, p.vel.y) + LINE_JUMP.hop;
    p.fallStart = p.pos.y;
    p.zipCool = LINE_JUMP.regrab;
    G.audio?.play('jump', { pos: p.pos });
    this.release(p);
  }

  // knocked or killed on the line: let go where it happened
  drop(p) {
    p.fallStart = Math.max(p.fallStart, p.pos.y);
    this.release(p);
  }

  release(p) {
    p.zip = null;
    p.grounded = false;
    this.line.riding = null;
    this.line.trolley.position.copy(this.line.curve.a);
  }
}

ACTIONS.rideLine = (id) => {
  const p = G.player;
  const line = G.world?.carrierLines?.find((l) => l.def.id === id);
  if (!p || !line || line.riding || p.zip || p.dead || p.knocked || p.boat || p.zipCool > 0) return false;
  p.cancelAttack?.();
  p.sitting = false;
  p.blocking = false;
  p.climbing = false;
  p.zip = new Ride(line, p);
  G.audio?.play('swing', { pos: p.pos, pitch: 0.6 });
  return true;
};
