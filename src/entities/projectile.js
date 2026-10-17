// Projectiles: orbs, rods, rocks, crescents. Parryable (deflect/reflect),
// blocked by walls and wards.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { applyHit, hostile, areaHit } from '../combat/combat.js';
import { elColor } from '../combat/vfx.js';

const _seg = new THREE.Vector3();
const _c = new THREE.Vector3();

export class Projectile {
  constructor(owner, o) {
    this.owner = owner;
    this.team = owner.team;
    this.pos = o.pos.clone();
    this.vel = o.vel.clone();
    this.radius = o.radius ?? 0.4;
    this.life = o.life ?? 2;
    this.hit = o.hit; // hit template
    this.element = o.hit.element || 'phys';
    this.homing = o.homing || 0;
    this.target = o.target || null;
    this.pierce = !!o.pierce;
    this.gravity = o.gravity || 0;
    this.onExplode = o.onExplode || null;
    this.hitSet = o.hitSet || new Set(); // shared by the pieces of one wave, so each foe is struck once
    this.dead = false;
    this.color = o.color || elColor(this.element);
    this.trailEl = o.trailEl || this.element;
    const size = o.size ?? 0.35;
    let mesh;
    if (o.rod) {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.25, size * 0.25, size * 5, 6), new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3, flatShading: true }));
      mesh.geometry.rotateX(Math.PI / 2);
    } else if (o.rock) {
      mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), new THREE.MeshStandardMaterial({ color: this.color, flatShading: true, roughness: 0.9, emissive: o.hit.element === 'ember' ? '#ff4a00' : '#000000', emissiveIntensity: 0.6 }));
      mesh.castShadow = true;
    } else if (o.crescent) {
      mesh = new THREE.Mesh(new THREE.RingGeometry(size * 0.8, size * 1.4, 16, 1, -1.2, 2.4), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      mesh.geometry.rotateX(-Math.PI / 2);
      mesh.geometry.rotateY(Math.PI / 2);
    } else {
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(size * 0.55, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      mesh.add(core);
    }
    this.mesh = mesh;
    this.spin = !!o.rock;
    mesh.position.copy(this.pos);
    G.scene.add(mesh);
    G.projectiles.push(this);
  }

  update(dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) return this.kill(true);
    if (this.homing && this.target && !this.target.dead) {
      const want = this.target.center(_c).sub(this.pos).normalize().multiplyScalar(this.vel.length());
      this.vel.lerp(want, Math.min(1, this.homing * dt));
    }
    this.vel.y -= this.gravity * dt;
    const prev = _seg.copy(this.pos);
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos);
    if (this.vel.lengthSq() > 0.01) this.mesh.lookAt(this.pos.clone().add(this.vel));
    if (this.spin) this.mesh.rotation.x += dt * 8;
    if (G.vfx && Math.random() < dt * 40) G.vfx.trailPuff(this.pos, this.trailEl, this.radius * 0.7, 1);

    // world collision
    const w = G.world;
    const gh = w.terrain.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y < gh || w.colliders.pointInside(this.pos.x, this.pos.y, this.pos.z)) return this.kill(true);
    for (const b of w.projectileBlockers) {
      if (b.contains(this.pos) && b.team !== this.team) return this.kill(true);
    }

    // actors
    for (const a of G.actors) {
      if (a.dead || a.knocked || this.hitSet.has(a.id)) continue;
      if (!hostile(this, a)) continue;
      const c = a.center(_c);
      const dy = Math.abs(this.pos.y - c.y);
      if (dy > a.height * 0.6 + this.radius) continue;
      const dx = this.pos.x - c.x;
      const dz = this.pos.z - c.z;
      if (dx * dx + dz * dz > (a.radius + this.radius) ** 2) continue;
      // ward deflection
      if (a.wardT > 0) {
        this.deflect(a, false);
        return;
      }
      this.hitSet.add(a.id);
      const h = Object.assign({}, this.hit, { kind: 'proj', projectile: this, from: prev.clone() });
      const res = applyHit(this.owner, a, h);
      if (res === 'parried' || res === 'blocked' || res === 'guardbreak' || this.dead) return;
      if (!this.pierce) return this.kill(true);
    }
  }

  deflect(by, reflect) {
    if (reflect) {
      this.owner = by;
      this.team = by.team;
      this.vel.multiplyScalar(-1.15);
      if (this.owner && this.hit) this.hit = Object.assign({}, this.hit, { dmg: this.hit.dmg * 2 });
      this.life = Math.max(this.life, 1.2);
      this.hitSet = new Set();
      this.homing = 0;
    } else {
      G.vfx && G.vfx.sparks(this.pos, null, '#ffffff', 10);
      this.kill(false);
    }
  }

  kill(explode = true) {
    if (this.dead) return;
    this.dead = true;
    G.scene.remove(this.mesh);
    this.mesh.traverse((c) => {
      c.geometry && c.geometry.dispose();
      c.material && c.material.dispose();
    });
    if (G.vfx) G.vfx.burst(this.pos, this.element, 10, { speed: 5 });
    if (explode && this.onExplode) this.onExplode(this);
  }
}

export function updateProjectiles(dt) {
  const list = G.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.update(dt);
    if (p.dead) list.splice(i, 1);
  }
}

export { areaHit };
