// Base class for every combat-capable entity: physics, statuses, posture,
// parry/block windows and timed attack execution with hit detection.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { setRigShadows } from './rig.js';
import { uid, clamp, forwardFromYaw, angleDiff, dampAngle, hypot } from '../core/util.js';
import { applyHit, meleeTargets } from '../combat/combat.js';
import { COMBAT } from '../combat/rules.js';
import { elColor } from '../combat/vfx.js';

export const GRAVITY = 30;
export const SWIM_Y = -1.15;
export const STEP_BASE = 0.4; // metres over which a terrain rise is judged (the navigation grid's cell)
export const SLOPE_MAX = 1.35; // rise per metre past which terrain is a wall
export const TERRAIN_STEP_MAX = 0.6; // any terrain rise over this in one step is a wall
const MOVE_STEP = 0.3; // the longest horizontal move resolved against colliders at once

// Whether a grounded body moving on terrain from (px, py, pz) to (x, z) meets a wall. The slope is
// judged over STEP_BASE (as the navigation grid judges it cell to cell), not over one step's few
// centimetres: a sharp lip on gentle ground, like a graded road's verge, is stepped over, while a
// face rising faster than SLOPE_MAX is still a wall. Judged over one step, the Red Trail's 0.35 m
// verge stopped walkers the grid had routed across it. terrain.heightAt(x, z) is its height.
export function terrainBlocks(terrain, px, py, pz, x, z, grounded) {
  const rise = terrain.heightAt(x, z) - py;
  if (rise > TERRAIN_STEP_MAX) return true;
  const d = hypot(x - px, z - pz);
  if (!grounded || d <= 1e-4 || rise <= 0.04) return false;
  const L = Math.max(STEP_BASE, d);
  const ahead = terrain.heightAt(px + ((x - px) / d) * L, pz + ((z - pz) / d) * L);
  return Math.max(rise, ahead - py) / L > SLOPE_MAX;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Actor {
  constructor(o = {}) {
    this.id = uid();
    this.team = o.team || 'enemy';
    this.name = o.name || 'Actor';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.push = new THREE.Vector3();
    this.yaw = 0;
    this.radius = o.radius ?? 0.42;
    this.height = o.height ?? 1.8;
    this.level = o.level || 1;
    this.maxHp = o.hp || 100;
    this.hp = this.maxHp;
    this.maxPosture = o.posture || 80;
    this.posture = 0;
    this.postureIdle = 0;
    this.resist = Object.assign({ phys: 0 }, o.resist || {});
    this.grounded = false;
    this.swimming = false;
    this.flying = o.flying || 0;
    this.aquatic = !!o.aquatic;
    this.state = 'idle';
    this.atk = null;
    this.stunT = 0;
    this.iframes = 0;
    this.blocking = false;
    this.parryT = 0;
    this.parryCd = 0;
    this.autoParryT = 0;
    this.hyper = !!o.hyperarmor;
    this.statuses = {};
    this.flinch = 0;
    this.dead = false;
    this.knocked = false;
    this.removeT = -1;
    this.model = null;
    this.trail = null;
    this.speedMul = 1;
    this.lastAttacker = null;
    this.wallContact = null;
    this.stealth = 0;
    this.buffs = [];
    this.mods = {};
    this.freezeMesh = null;
    this.invuln = false;
  }

  get forward() {
    return forwardFromYaw(this.yaw, _v2);
  }
  center(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z);
  }
  get alive() {
    return !this.dead;
  }
  // Stunned also covers a launched body still in the air: it can neither act nor defend until it
  // lands (combat/rules.js canLaunch, Actor.liftOff).
  get stunned() {
    return this.stunT > 0 || !!this.statuses.freeze || (this.launched && !this.grounded);
  }
  get attacking() {
    return !!this.atk;
  }

  attachModel(model) {
    this.model = model;
    G.scene.add(model.root);
  }

  // ---------------- buffs
  addBuff(id, duration, mods, color) {
    const existing = this.buffs.find((b) => b.id === id);
    if (existing) {
      existing.t = duration;
      return existing;
    }
    const b = { id, t: duration, mods, color };
    this.buffs.push(b);
    this.onBuffsChanged && this.onBuffsChanged();
    return b;
  }
  buffMods() {
    const m = {};
    for (const b of this.buffs) for (const k in b.mods || {}) m[k] = (m[k] || 0) + b.mods[k];
    return m;
  }

  // ---------------- defense queries
  isParrying() {
    return this.parryT > 0 || this.autoParryT > 0;
  }
  canDefend() {
    return !this.dead && !this.knocked && !this.stunned && (!this.atk || this.atk.phase === 'recovery');
  }
  // Raise a parry. A miss locks the next one out for `missCd`; a parry that lands clears it.
  startParry(window, missCd = COMBAT.parry.missCooldown) {
    this.parryT = window;
    this.parryCd = missCd;
  }

  // ---------------- attacks
  startAttack(def) {
    if (this.dead) return false;
    def.windup = def.windup ?? 0.3;
    def.active = def.active ?? 0.12;
    def.recovery = def.recovery ?? 0.3;
    this.atk = { def, t: 0, phase: 'windup', hitSet: new Set(), hitIdx: 0, lastHitT: -1 };
    this.state = 'attack';
    if (this.model) this.model.play(def.anim || def.id || 'slashR', { windup: def.windup, active: def.active, recovery: def.recovery });
    if (def.unparryable || def.unblockable) this.telegraph(def.unparryable ? 'red' : 'orange', def.windup);
    if (def.onStart) def.onStart(this, def);
    return true;
  }

  // A red (unparryable) or orange (unblockable) blow announces itself by colour, by shape (vfx
  // warnMark: spikes or chevrons) and by sound (a shriek or a low toll), so it reads without colour.
  telegraph(kind, windup = 0.5) {
    if (!G.vfx) return;
    const color = kind === 'red' ? '#ff2a1a' : '#ffaa1a';
    const p = this.center(_v).clone();
    p.y += 0.5;
    G.vfx.sphereFlash(p, 'phys', 0.9, 0.35, { color });
    G.vfx.flashLight(p, color, 5, 0.3, 8);
    if (this.model) this.model.flash(color, 0.9, 0.35);
    if (G.vfx.warnMark) G.vfx.warnMark(this, kind, Math.min(1, Math.max(0.35, windup)));
    G.audio && G.audio.play(kind === 'red' ? 'warnRed' : 'warnOrange', { pos: this.pos, vol: 0.75 });
  }

  cancelAttack() {
    if (!this.atk) return;
    if (this.model) this.model.stop && this.model.stop();
    if (this.trail) this.trail.stop();
    this.atk = null;
    if (this.state === 'attack') this.state = 'idle';
  }

  feint() {
    if (this.atk && this.atk.phase === 'windup' && !this.atk.def.noFeint) {
      this.cancelAttack();
      G.audio && G.audio.play('dodge', { pos: this.pos, vol: 0.4 });
      return true;
    }
    return false;
  }

  updateAttack(dt) {
    const a = this.atk;
    if (!a) return;
    const d = a.def;
    a.t += dt;
    const fwd = forwardFromYaw(this.yaw, _v);
    if (a.phase === 'windup') {
      // a blinded fighter swings where it last saw its foe and no longer turns to follow it
      if (d.trackTarget && this.target && a.t <= d.windup * 0.6 && !this.statuses.blind) {
        const want = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, d.trackRate || 6, dt);
      }
      if (d.windLunge) this.moveHoriz(fwd, d.windLunge);
      // Flourish: a swing held at the top of its wind-up waits there (up to COMBAT.flourish.maxHold)
      // until it is let go. Whoever drives the swing sets a.hold each step.
      if (a.t >= d.windup && a.hold && (a.held || 0) < COMBAT.flourish.maxHold) {
        a.held = (a.held || 0) + (a.t - d.windup);
        a.t = d.windup;
        if (!a.holding) {
          a.holding = true;
          this.onSwingHeld && this.onSwingHeld(a);
        }
        if (this.model && this.model.holdSwing) this.model.holdSwing(true);
      } else if (a.t >= d.windup) {
        if (a.holding) {
          a.holding = false;
          if (this.model && this.model.holdSwing) this.model.holdSwing(false);
        }
        a.phase = 'active';
        a.activeT = 0;
        this.onActiveStart(a);
        if (d.onActive) d.onActive(this, d, a);
        if (d.type === 'melee' || !d.type) this.meleeSweep(a);
      }
    } else if (a.phase === 'active') {
      a.activeT += dt;
      if (d.lunge) {
        const tgt = this.target;
        const mine = this.radius + (this.meleePad || (this.spec && this.spec.meleePad) || 0);
        const theirs = tgt ? (tgt.radius || 0.4) + (tgt.meleePad || (tgt.spec && tgt.spec.meleePad) || 0) : 0;
        const touch = tgt && !tgt.dead && hypot(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z) < mine + theirs + 0.08;
        if (touch) {
          this.vel.x = 0;
          this.vel.z = 0;
        } else this.moveHoriz(fwd, d.lunge * (1 - (a.activeT / d.active) * 0.5));
      }
      if (d.type === 'melee' || !d.type) {
        const hits = d.hits || 1;
        const idx = Math.min(hits - 1, Math.floor((a.activeT / d.active) * hits));
        if (idx !== a.hitIdx) {
          a.hitIdx = idx;
          a.hitSet.clear();
          if (hits > 1) G.audio && G.audio.play(d.sound || 'swing', { pos: this.pos, pitch: (d.pitch || 1) * 1.1, vol: 0.6 });
        }
        this.meleeSweep(a);
      }
      if (d.onActiveTick) d.onActiveTick(this, d, a, dt);
      if (this.trail && this.model && this.model.weapon && this.model.weapon.tip) {
        const t = this.model.weapon.tip.getWorldPosition(new THREE.Vector3());
        const b = this.model.weapon.base.getWorldPosition(new THREE.Vector3());
        this.trail.push(b, t);
      }
      if (a.activeT >= d.active) {
        a.phase = 'recovery';
        a.recT = 0;
        if (this.trail) this.trail.stop();
        if (d.onEnd) d.onEnd(this, d, a);
      }
    } else {
      a.recT += dt;
      if (a.recT >= d.recovery) {
        this.atk = null;
        if (this.state === 'attack') this.state = 'idle';
        this.onAttackDone && this.onAttackDone(d);
      }
    }
  }

  onActiveStart(a) {
    const d = a.def;
    if (d.sound !== null && (d.type === 'melee' || !d.type)) G.audio && G.audio.play(d.sound || 'swing', { pos: this.pos, pitch: d.pitch || 1 });
    if (this.trail && (d.type === 'melee' || !d.type) && this.model && this.model.weapon && !this.model.weapon.fist) {
      // the trail says what the swing is: red or orange for a blow past parry or block, gold for a
      // critical, the enchant's colour otherwise
      this.trail.start(d.trailColor || (d.unparryable ? '#ff6a5a' : d.unblockable ? '#ffb45a' : d.crit ? '#ffe2a0' : this.trailTint || '#ffffff'));
    }
  }

  meleeSweep(a) {
    const d = a.def;
    const targets = meleeTargets(this, d.range, d.arc, d.vertical || 2.6);
    for (const t of targets) {
      if (a.hitSet.has(t.id)) continue;
      a.hitSet.add(t.id);
      const h = d.hit ? Object.assign({}, d.hit) : this.buildHit(d, t);
      if (this.nextHitBonus && h.dmg > 0) {
        h.dmg *= 1 + this.nextHitBonus;
        this.nextHitBonus = 0;
      }
      if (this.stealth > 0) this.breakStealth && this.breakStealth();
      const res = applyHit(this, t, h);
      if (d.onHit) d.onHit(this, t, res, a);
      if (d.stopOnHit && res !== 'none' && res !== 'evaded') {
        a.phase = 'recovery';
        a.recT = 0;
        this.vel.x = 0;
        this.vel.z = 0;
        if (this.trail) this.trail.stop();
        return;
      }
      if (res === 'parried' && !d.unparryable) return; // our attack bounced
    }
  }

  // Override in subclasses to compute damage from stats/weapon.
  buildHit(d, target) {
    return {
      dmg: d.dmg || 10,
      posture: d.posture ?? 10,
      element: d.element || 'phys',
      unparryable: !!d.unparryable,
      unblockable: !!d.unblockable,
      knockback: d.knockback || 0,
      launch: d.launch || 0,
      status: d.status ? [d.status] : null,
      kind: 'melee',
      crit: !!d.crit,
    };
  }

  moveHoriz(dir, speed) {
    this.vel.x = dir.x * speed;
    this.vel.z = dir.z * speed;
  }

  // ---------------- getting hit
  interrupt(t = 0.32) {
    if (this.hyper || (this.atk && this.atk.def.hyperarmor && this.atk.phase !== 'recovery')) return false;
    if (this.poiseT > 0) return false;
    // light blows (a stagger of 0.31 s or less) do not stop a Juggernaut's swing or a Focused Mind's cast
    const m = this.mods || {};
    if (this.atk && t <= 0.31 && this.atk.phase !== 'recovery') {
      const cast = this.atk.def.type === 'cast';
      if ((m.juggernaut && !cast) || (m.focusedMind && cast)) return false;
    }
    // Poise: enemies can only be interrupted a few times in a row before shrugging hits off.
    if (this.team === 'enemy' && !this.dummy) {
      const now = G.time;
      if (now - (this.lastInterruptT || -99) > 1.6) this.interruptCount = 0;
      this.lastInterruptT = now;
      this.interruptCount = (this.interruptCount || 0) + 1;
      if (this.interruptCount >= (this.boss ? 2 : 3)) {
        this.interruptCount = 0;
        this.poiseT = this.boss ? 2.4 : 1.3;
      }
    }
    this.cancelAttack();
    this.stunT = Math.max(this.stunT, t);
    this.state = 'stun';
    return true;
  }

  // A body's reaction to what a blow did (presentation only: the rules have already decided).
  // Humanoid rigs play it; creatures keep their flinch and flash.
  reactAnim(kind, k = 1) {
    if (!this.model || !this.model.anim) return;
    const T = { blockRecoil: [0.04, 0.08 * k, 0.16 + 0.1 * k], deflected: [0.05, 0.25, 0.5], guardBroken: [0.08, 0.8, 0.6] }[kind];
    if (T) this.model.play(kind, { windup: T[0], active: T[1], recovery: T[2] });
  }

  // h: the parried hit (its posture value makes heavy attacks costlier to have parried)
  getParried(by, h = null) {
    this.cancelAttack();
    this.reactAnim('deflected');
    this.stunT = Math.max(this.stunT, 0.85 * (1 - (this.mods.stunResist || 0)));
    this.state = 'stun';
    this.addPosture(this.maxPosture * 0.1 + (h && h.posture ? h.posture * 0.9 : this.maxPosture * 0.08), by);
    if (this.model) this.model.flash('#ffffff', 0.6, 0.15);
  }

  addPosture(amount, by) {
    if (this.guardBroken) return false; // no re-break while already broken
    this.posture += amount;
    this.postureIdle = 0;
    if (this.posture >= this.maxPosture) {
      this.posture = this.maxPosture;
      this.guardBreak(by);
      return true;
    }
    return false;
  }

  guardBreak(by) {
    this.blocking = false;
    this.cancelAttack();
    this.reactAnim('guardBroken');
    this.stunT = Math.max(this.stunT, 1.7 * (1 - (this.mods.stunResist || 0)));
    this.guardBroken = true;
    this.state = 'stun';
    const c = this.center(_v).clone();
    if (G.vfx) {
      G.vfx.ring(c, 'phys', 3, 0.5, { color: '#ffd27a', vertical: true, yaw: this.yaw });
      G.vfx.sparks(c, null, '#ffd27a', 26);
      G.vfx.flashLight(c, '#ffd27a', 8, 0.25);
    }
    const w = by && (by.weaponDef || (by.weaponItemDef && by.weaponItemDef()));
    G.audio && G.audio.play('guardbreak', { pos: this.pos, cls: w ? w.cls : null });
    if (this.onGuardBreak) this.onGuardBreak(by);
  }

  applyKnockback(dir, force, launch = 0) {
    if (this.blocking && this.mods.stonewall) return; // Stonewall: a held guard does not give
    const f = this.mods.lessKnockback ? 0.5 : 1;
    this.push.x += dir.x * force * f;
    this.push.z += dir.z * force * f;
    if (launch > 0 && !this.flying && !this.aquatic) {
      this.vel.y = Math.max(this.vel.y, launch * f);
      this.grounded = false;
    }
  }

  // Lifted off the ground by an uppercut or another rising blow: no defense until it lands, and
  // never further up than the room over its head allows.
  liftOff(speed, by = null) {
    if (this.dead) return;
    const cl = G.world && G.world.colliders;
    let v = Math.max(this.vel.y, speed);
    if (cl && cl.raycast) {
      const room = cl.raycast(this.pos.x, this.pos.y + this.height, this.pos.z, 0, 1, 0, 4);
      const rise = Math.max(0, room - 0.15);
      v = Math.min(v, Math.sqrt(2 * GRAVITY * rise));
    }
    this.vel.y = v;
    this.grounded = false;
    if (!this.launched) this.launchAir = 0;
    this.launched = true;
    this.launchedBy = by;
    this.cancelAttack();
    this.blocking = false;
    this.parryT = 0;
  }

  // Status ailments
  applyStatus(id, power = 1, src = null) {
    if (this.dead) return;
    const s = this.statuses;
    const srcMods = src ? src.mods || {} : {};
    const res = this.resist[{ burn: 'ember', chill: 'rime', freeze: 'rime', shock: 'storm', bleed: 'blood', blind: 'umbra' }[id]] || 0;
    if (res >= 0.95) return;
    const resMul = 1 - Math.max(0, res) * 0.7;
    switch (id) {
      case 'burn':
        s.burn = { t: 3.2 * (1 + (srcMods.burnDur || 0)) * resMul, dps: (3 + (src ? src.level * 0.35 : 2)) * power, src };
        break;
      case 'chill': {
        const c = s.chill || { stacks: 0, t: 0 };
        c.stacks = Math.min(this.mods.winterCoat ? 99 : 100, c.stacks + 26 * power * (1 + (srcMods.chillPower || 0)) * resMul);
        c.t = 2.5;
        s.chill = c;
        if (c.stacks >= 100) {
          delete s.chill;
          this.applyStatus('freeze', 1, src);
        }
        break;
      }
      case 'freeze':
        if (this.boss) {
          this.stunT = Math.max(this.stunT, 0.6);
          break;
        }
        s.freeze = { t: 1.6 * resMul };
        this.cancelAttack();
        this._showFreeze(true);
        break;
      case 'shock':
        s.shock = { t: 0.5 * (1 + (srcMods.shockDur || 0)) * resMul };
        if (!this.boss && !this.mods.staticCharge) this.interrupt(s.shock.t);
        break;
      case 'bleed': {
        const b = s.bleed || { stacks: 0, t: 0, src };
        b.stacks = Math.min(10, b.stacks + Math.max(1, Math.round(power)));
        b.t = 5;
        b.src = src;
        b.mul = 1 + (srcMods.bleedDmg || 0);
        s.bleed = b;
        break;
      }
      case 'blind':
        if (this.mods.blindImmune) break;
        // Clear Head halves blindness on its bearer; Dusk Shroud lengthens the blindness it deals
        s.blind = { t: COMBAT.blind.duration * resMul * (this.boss ? COMBAT.blind.bossMul : 1) * (this.mods.clearHead ? 0.5 : 1) * (srcMods.duskShroud ? 1.5 : 1) };
        break;
    }
    if (this.onStatus) this.onStatus(id);
  }

  clearStatus(id) {
    if (id === 'freeze') this._showFreeze(false);
    delete this.statuses[id];
  }

  _showFreeze(on) {
    if (on && !this.freezeMesh) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(this.radius * 2.6, this.height * 1.05, this.radius * 2.6),
        new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.55, roughness: 0.1, emissive: '#3a8ac8', emissiveIntensity: 0.4, flatShading: true })
      );
      m.position.y = this.height * 0.5;
      this.model && this.model.root.add(m);
      this.freezeMesh = m;
    } else if (!on && this.freezeMesh) {
      this.freezeMesh.parent && this.freezeMesh.parent.remove(this.freezeMesh);
      this.freezeMesh.geometry.dispose();
      this.freezeMesh.material.dispose();
      this.freezeMesh = null;
      if (G.vfx) G.vfx.burst(this.center(), 'rime', 14, { speed: 5 });
      G.audio && G.audio.play('rime', { pos: this.pos, vol: 0.5 });
    }
  }

  updateStatuses(dt) {
    const s = this.statuses;
    const c = this.center(_v);
    const wear = this.mods.thickSkin ? 2 : 1; // Thick Skin: burns and bleeds wear off twice as fast
    const burn = s.burn;
    if (burn) {
      burn.t -= dt * wear;
      if (G.vfx && Math.random() < dt * 20) G.vfx.fire(c.clone().add(new THREE.Vector3(0, -0.3, 0)), this.radius, 1);
      if (burn.t <= 0 || this.swimming) delete s.burn;
      this.takeDot(burn.dps * dt, 'ember', burn.src);
    }
    if (s.chill) {
      s.chill.t -= dt;
      if (s.chill.t <= 0) s.chill.stacks -= dt * 30;
      if (s.chill.stacks <= 0) delete s.chill;
      else if (G.vfx && Math.random() < dt * 6) G.vfx.trailPuff(c, 'rime', 0.2, 1);
    }
    if (s.freeze) {
      s.freeze.t -= dt;
      if (s.freeze.t <= 0) this.clearStatus('freeze');
    }
    if (s.shock) {
      s.shock.t -= dt;
      if (G.vfx && Math.random() < dt * 25) G.vfx.sparks(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6)), null, '#ffe14d', 2);
      if (s.shock.t <= 0) delete s.shock;
    }
    const bleed = s.bleed;
    if (bleed) {
      bleed.t -= dt * wear;
      if (G.vfx && Math.random() < dt * (3 + bleed.stacks)) G.vfx.blood(c, null, 1);
      if (bleed.t <= 0) delete s.bleed;
      this.takeDot(bleed.stacks * 1.4 * (bleed.mul || 1) * dt, 'blood', bleed.src);
    }
    if (this.dead) return;
    if (s.blind) {
      s.blind.t -= dt;
      // a dark veil over the eyes (shown, not decisive)
      if (G.vfx && this !== G.player && Math.random() < dt * 7) G.vfx.trailPuff(_v.set(this.pos.x, this.pos.y + this.height * 0.92, this.pos.z), 'umbra', 0.22, 1);
      if (s.blind.t <= 0) delete s.blind;
    }
  }

  takeDot(amount, element, src) {
    if (this.dead || this.knocked || amount <= 0) return;
    const r = this.resist[element] || 0;
    this.hp -= amount * (1 - r);
    if (this.hp <= 0) {
      this.hp = 0;
      this.onLethal(src);
    }
  }

  onLethal(src) {
    this.die(src);
  }

  die(src) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.cancelAttack();
    this.blocking = false;
    for (const k in this.statuses) this.clearStatus(k);
    this.removeT = 6;
    if (this.onDeath) this.onDeath(src);
  }

  // ---------------- physics
  physics(dt) {
    const world = G.world;
    const prevX = this.pos.x;
    const prevZ = this.pos.z;
    const prevY = this.pos.y;
    // gravity
    if (!this.flying && !(this.swimming && !this.knocked) && !this.aquatic && !this.noGravity) {
      if (!this.grounded) this.vel.y -= GRAVITY * dt;
    }
    const mx = (this.vel.x + this.push.x) * dt;
    const mz = (this.vel.z + this.push.z) * dt;
    const pd = Math.exp(-6 * dt);
    this.push.multiplyScalar(pd);

    // static colliders. A fast move (a lunge, a dash, a dodge) goes in steps of at most MOVE_STEP,
    // each resolved, so it stops at a thin wall instead of passing through it in one frame.
    const steps = Math.max(1, Math.ceil(hypot(mx, mz) / MOVE_STEP));
    let info = null;
    for (let i = 0; i < steps; i++) {
      this.pos.x += mx / steps;
      this.pos.z += mz / steps;
      const r = world.colliders.resolve(this.pos, this.radius, this.height);
      if (r.hit) info = r;
    }
    this.wallContact = info;

    // steep terrain acts like a wall
    let terrainH = world.terrain.heightAt(this.pos.x, this.pos.z);
    let colH = world.colliders.groundAt(this.pos.x, this.pos.z, prevY + 0.6, this.radius * 0.5);
    if (terrainH >= colH && !this.flying && !this.aquatic) {
      if (terrainBlocks(world.terrain, prevX, prevY, prevZ, this.pos.x, this.pos.z, this.grounded)) {
        const nx = prevX - this.pos.x;
        const nz = prevZ - this.pos.z;
        const l = hypot(nx, nz) || 1;
        this.pos.x = prevX;
        this.pos.z = prevZ;
        terrainH = world.terrain.heightAt(prevX, prevZ);
        colH = world.colliders.groundAt(prevX, prevZ, prevY + 0.6, this.radius * 0.5);
        this.wallContact = { hit: true, nx: nx / l, nz: nz / l, climbable: true, terrain: true, top: terrainH };
      }
    }
    this.pos.y += this.vel.y * dt;
    let ground = Math.max(terrainH, colH);
    this.groundH = ground;

    if (this.flying) {
      const want = ground + this.flying;
      this.pos.y += (want - this.pos.y) * Math.min(1, dt * 4);
      this.grounded = true;
      this.vel.y = 0;
    } else if (this.aquatic) {
      this.pos.y = -0.35;
      this.grounded = true;
      this.vel.y = 0;
    } else {
      const wasGrounded = this.grounded;
      if (this.pos.y <= ground) {
        const impact = -this.vel.y;
        this.pos.y = ground;
        if (this.vel.y < 0) this.vel.y = 0;
        if (!wasGrounded) this.onLand && this.onLand(impact);
        this.grounded = true;
      } else if (wasGrounded && this.vel.y <= 0.01 && this.pos.y - ground < 0.65) {
        this.pos.y = ground;
        this.vel.y = 0;
        this.grounded = true;
      } else this.grounded = false;
    }

    // water — surface sea only. The Rift's void under the isles is the abyss: you fall
    // through it and die, you do not swim on an invisible ocean at sea level.
    const overAbyss = !!(G.game && G.game.inRift && ground < -20);
    const deep = !overAbyss && ground < SWIM_Y - 0.5;
    if (overAbyss) {
      this.swimming = false;
    } else if (!this.aquatic && !this.flying && deep && this.pos.y <= SWIM_Y + 0.05) {
      if (!this.swimming) this.onEnterWater && this.onEnterWater();
      this.swimming = true;
      this.pos.y = Math.max(this.pos.y, SWIM_Y);
      if (this.vel.y < 0) this.vel.y *= 0.5;
      if (this.pos.y <= SWIM_Y + 0.01) {
        this.vel.y = Math.max(this.vel.y, 0);
        this.pos.y = SWIM_Y;
      }
      this.grounded = false;
    } else if (this.swimming && (!deep || this.pos.y > SWIM_Y + 0.6)) {
      this.swimming = false;
    }
  }

  // ---------------- per-frame common update
  baseUpdate(dt) {
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.stunT <= 0) {
        this.stunT = 0;
        if (this.guardBroken) {
          this.guardBroken = false;
          this.posture = this.maxPosture * 0.4;
        }
        if (this.state === 'stun') this.state = 'idle';
      }
    }
    if (this.iframes > 0) this.iframes -= dt;
    if (this.poiseT > 0) this.poiseT -= dt;
    if (this.launched) {
      this.launchAir += dt;
      if (this.grounded && this.launchAir > 0.05) {
        this.launched = false;
        this.launchedBy = null;
        this.stunT = Math.max(this.stunT, this.spiked ? 0.5 : 0.25); // a moment to find its feet
        if (this.state !== 'dead') this.state = 'stun';
        if (this.spiked && G.vfx) {
          G.vfx.dust(this.pos, 14);
          G.vfx.ring(this.pos, 'phys', 1.8, 0.3);
          G.audio && G.audio.play('land', { pos: this.pos, vol: 0.8 });
        }
        this.spiked = false;
      } else if (this.launchAir > COMBAT.launch.failsafe && G.world) {
        // never left hanging: set it down on whatever is below
        this.pos.y = G.world.groundAt ? G.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5) : this.pos.y;
        this.vel.y = 0;
        this.grounded = true;
      }
    }
    if (this.parryT > 0) this.parryT -= dt;
    if (this.parryCd > 0) this.parryCd -= dt;
    if (this.autoParryT > 0) this.autoParryT -= dt;
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt * 5);
    this.postureIdle += dt;
    // Iron Posture: posture recovers behind a held block too
    if (this.postureIdle > 1.4 && (!this.blocking || this.mods.ironPosture) && !this.guardBroken) this.posture = Math.max(0, this.posture - this.maxPosture * 0.22 * dt);
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.buffs.splice(i, 1);
        if (b.onEnd) b.onEnd(this);
        this.onBuffsChanged && this.onBuffsChanged();
      } else if (b.color && G.vfx && Math.random() < dt * 8) G.vfx.trailPuff(this.center(_v), 'phys', 0.25, 1);
    }
    if (!this.dead) this.updateStatuses(dt);
    if (this.atk && !this.dead) {
      if (this.stunned) this.cancelAttack();
      else this.updateAttack(dt);
    }
  }

  syncModel(dt, animState) {
    if (!this.model) return;
    // which way the body moves relative to its facing (the walk cycle's direction)
    if (animState && animState.fwd === undefined) {
      const sp = hypot(this.vel.x, this.vel.z);
      if (sp > 0.3) {
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        animState.fwd = (this.vel.x * fx + this.vel.z * fz) / sp;
        animState.side = (this.vel.z * fx - this.vel.x * fz) / sp;
      }
    }
    const r = this.model.root;
    r.position.copy(this.pos);
    r.rotation.y = this.yaw;
    if (this !== G.player && G.camera) setRigShadows(r, r.position.distanceToSquared(G.camera.position) < 30 * 30);
    this.model.update(dt, animState);
    this.model.updateFlash(dt);

  }

  hitFlash(el = 'phys') {
    if (this.model) this.model.flash(el === 'phys' ? '#ffffff' : elColor(el), 1, 0.18);
    this.flinch = 1;
  }

  removeFromScene() {
    if (this.model) {
      G.world?.releaseLights?.(this.model.root);
      G.scene.remove(this.model.root);
      this.model.dispose && this.model.dispose();
    }
    if (this.trail) G.vfx.removeTrail(this.trail);
    if (this.freezeMesh) this._showFreeze(false);
  }
}

export function facingDelta(actor, target) {
  const want = Math.atan2(target.pos.x - actor.pos.x, target.pos.z - actor.pos.z);
  return angleDiff(actor.yaw, want);
}

export { clamp };
