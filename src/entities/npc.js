// Friendly NPCs: idle animation, look-at, floating name labels.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { HumanoidRig, setRigShadows } from './rig.js';
import { dampAngle, uid } from '../core/util.js';

export function makeLabel(name, title, color = "#f3ead6") {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.font = '600 44px Cinzel, Georgia, serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(name, 256, 56);
  ctx.fillStyle = color;
  ctx.fillText(name, 256, 56);
  if (title) {
    ctx.font = 'italic 30px Georgia, serif';
    ctx.strokeText(title, 256, 100);
    ctx.fillStyle = '#c9b88a';
    ctx.fillText(title, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sp.scale.set(2.4, 0.6, 1);
  return sp;
}


export class NPC {
  constructor(def) {
    this.id = def.id;
    this.uid = uid();
    this.def = def;
    this.name = def.name;
    this.team = 'npc';
    // Indoor NPCs must stand on the room floor, not the highest roof overhead.
    const floor = G.world.terrain.heightAt(def.x, def.z) + (def.floor || 0);
    this.pos = new THREE.Vector3(def.x, G.world.groundAt(def.x, def.z, floor + 0.6), def.z);
    const isl = G.world.terrain.islandFactor(def.x, def.z).island;
    this.homeYaw = def.yaw ?? Math.atan2(isl.cx - def.x, isl.cz - def.z);
    this.yaw = this.homeYaw;
    const look = Object.assign({ hairStyle: (def.name.length * 7) % 5 }, def.look);
    this.rig = new HumanoidRig(look);
    this.rig.anim.setStance('none');
    G.scene.add(this.rig.root);
    this.label = makeLabel(def.name, def.title);
    this.label.position.set(0, 2.35 * (look.scale || 1), 0);
    this.rig.root.add(this.label);
    this.talkT = 0;
    this.radius = 0.4;
    this.height = 1.8;
    this.dead = false;
    this.sitting = !!def.sit;
    if (!def.when) G.world.colliders.addCyl({ x: this.pos.x, z: this.pos.z, r: 0.4, y0: this.pos.y - 1, y1: this.pos.y + 1.8 });
  }

  update(dt) {
    const p = G.player;
    // story-gated NPCs (def.when(ch)) appear only while their moment lasts
    this.hidden = !!(this.def.when && !(G.game && G.game.ch && this.def.when(G.game.ch)));
    if (this.hidden) {
      this.rig.root.visible = false;
      return;
    }
    const d = p ? this.pos.distanceTo(p.pos) : 999;
    if (d > 90) {
      this.rig.root.visible = false;
      return;
    }
    this.rig.root.visible = true;
    // LOD: distant NPCs cast no shadows and animate at ~10Hz
    const near = d < 35;
    setRigShadows(this.rig.root, d < 28);
    if (!near) {
      this._lodT = (this._lodT || 0) + dt;
      if (this._lodT < 0.1) return;
      dt = this._lodT;
    }
    this._lodT = 0;
    const want = d < 7 && p ? Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : this.homeYaw;
    this.yaw = dampAngle(this.yaw, want, 4, dt);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.label.visible = d < 18;
    this.talkT -= dt;
    if (this.talkT < -6 + Math.random() * 2 && d < 10) {
      this.talkT = 1.4;
      this.rig.anim.play('castPush', { windup: 0.4, active: 0.4, recovery: 0.6 });
    }
    this.rig.update(dt, { speed: 0, grounded: true, weaponOut: false, sit: this.sitting });
  }

  center() {
    return this.pos.clone().add(new THREE.Vector3(0, 1, 0));
  }
}
