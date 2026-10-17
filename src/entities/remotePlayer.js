// Another player's character as seen on this machine. Purely a replica: its
// position and state come from the network, its attacks and spells are replayed
// for visuals, and it never deals damage itself (combat.applyHit enforces this).
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Actor } from './actor.js';
import { HumanoidRig } from './rig.js';
import { STANCE_FOR_CLASS } from './anims.js';
import { makeLabel } from './npc.js';
import { makeBoatMesh } from '../world/props.js';
import { RACE_BY_ID } from '../data/races.js';
import { OUTFITS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { makeCastDef } from '../combat/mantraRuntime.js';
import { damp, dampAngle, forwardFromYaw } from '../core/util.js';

// player-state flag bits (must match Net)
export const PF = {
  grounded: 1, swimming: 2, climbing: 4, sliding: 8, blocking: 16, charging: 32, knocked: 64, dead: 128,
  stunned: 256, sit: 512, boat: 1024, stealth: 2048, handsDown: 4096,
};

export class RemotePlayer extends Actor {
  constructor(peerId, info) {
    super({ team: 'player', name: info.name || 'Wanderer', radius: 0.42, height: 1.8 });
    this.isRemote = true;
    this.peerId = peerId;
    this.netPos = null;
    this.netYaw = 0;
    this.netSpeed = 0;
    this.flags = PF.grounded;
    this.mods = {};
    this.lastStateAt = performance.now();
    this.applyInfo(info, true);
  }

  applyInfo(info, first = false) {
    const prev = this.info;
    this.info = info;
    this.name = info.name || 'Wanderer';
    this.level = info.level || 1;
    this.mods = info.mods || {};
    this.netExt = info.ext || null; // e.g. faction reputation / wanted status from game.netExt()
    const race = RACE_BY_ID[info.race] || RACE_BY_ID.morrow;
    const lookKey = JSON.stringify([info.race, info.look, info.outfit]);
    if (first || !prev || lookKey !== this._lookKey) {
      const keep = this.model ? { pos: this.model.root.position.clone(), yaw: this.model.root.rotation.y } : null;
      if (this.model) {
        G.scene.remove(this.model.root);
        this.model.dispose();
      }
      const outfit = OUTFITS[info.outfit] || OUTFITS.rags;
      const look = Object.assign({}, info.look || {}, {
        features: race.features,
        outfit: outfit.colors,
        scale: (race.scale || 1) * ((info.look && info.look.height) || 1),
      });
      this.attachModel(new HumanoidRig(look));
      this.height = 1.8 * look.scale;
      if (keep) {
        this.model.root.position.copy(keep.pos);
        this.model.root.rotation.y = keep.yaw;
      }
      this._lookKey = lookKey;
      this._weaponKey = null;
      this._labelKey = null;
      if (!this.trail) this.trail = G.vfx.newTrail('#ffffff');
    }
    const w = info.weapon || {};
    const wKey = `${w.id}|${w.enchant}`;
    if (wKey !== this._weaponKey) {
      const def = WEAPONS[w.id] || WEAPONS.fists;
      this.model.setWeapon(def, w.enchant || null);
      this.model.anim.setStance(STANCE_FOR_CLASS[def.cls] || 'oneHand');
      this._weaponKey = wKey;
    }
    const labelKey = `${this.name}|${this.level}`;
    if (labelKey !== this._labelKey) {
      if (this.label) {
        this.label.parent && this.label.parent.remove(this.label);
        this.label.material.map.dispose();
        this.label.material.dispose();
      }
      this.label = makeLabel(this.name, `Power ${this.level}`, '#9fe0ff');
      this.label.position.set(0, this.height + 0.55, 0);
      this.model.root.add(this.label);
      this._labelKey = labelKey;
    }
  }

  // s = [x, y, z, yaw, speed, vy, flags, hp, maxHp, posture, maxPosture, level, boatYaw]
  applyState(s) {
    if (!s || s.length < 11) return;
    if (!this.netPos) {
      this.netPos = new THREE.Vector3(s[0], s[1], s[2]);
      this.pos.copy(this.netPos);
      this.yaw = s[3];
    } else this.netPos.set(s[0], s[1], s[2]);
    this.netYaw = s[3];
    this.netSpeed = s[4];
    this.vel.y = s[5];
    this.flags = s[6];
    this.hp = s[7];
    this.maxHp = s[8];
    this.posture = s[9];
    this.maxPosture = s[10];
    if (s[11] && s[11] !== this.level) this.applyInfo(Object.assign({}, this.info, { level: s[11] }));
    this.boatYaw = s[12];
    this.knocked = !!(this.flags & PF.knocked);
    this.dead = !!(this.flags & PF.dead);
    this.blocking = !!(this.flags & PF.blocking);
    this.swimming = !!(this.flags & PF.swimming);
    this.grounded = !!(this.flags & PF.grounded);
    this.boat = !!(this.flags & PF.boat);
    this.stealth = this.flags & PF.stealth ? 1 : 0;
    this.lastStateAt = performance.now();
  }

  // ---------------------------------------------------------------- replays
  playAttack(m) {
    if (this.dead || this.knocked) return;
    const def = {
      anim: m.a, windup: m.w, active: m.ac, recovery: m.r, type: 'melee', range: m.range || 3, arc: m.arc || 100,
      hits: m.hits || 1, unparryable: !!m.unp, unblockable: !!m.unb, crit: !!m.crit, sound: m.sound || 'swing', pitch: m.pitch || 1,
      flourish: !!m.fl, // the host's enemies read a held swing on the avatar as they would the player's
    };
    if (m.shock) {
      def.onActive = (a) => {
        const p = a.pos.clone().addScaledVector(forwardFromYaw(a.yaw), 2);
        p.y = G.world.groundAt(p.x, p.z, p.y + 3);
        G.vfx.ring(p, 'phys', m.shock, 0.45, { color: '#ffe0b0' });
        G.vfx.dust(p, 14);
      };
    }
    this.yaw = this.netYaw;
    this.cancelAttack();
    this.startAttack(def);
  }

  playCast(m, net) {
    if (this.dead || this.knocked) return;
    const aim = net.deAim(m.aim, this);
    let def;
    try {
      def = makeCastDef(this, m.m, () => aim, m.stars || 0);
    } catch (e) {
      return;
    }
    this.yaw = this.netYaw;
    this.cancelAttack();
    this.startAttack(def);
  }

  playAnim(m) {
    if (m.pose === 'eat') this.eatT = m.d || 1.1;
    if (m.pose) this.model.anim.playPose(m.pose, m.d || 1);
    else if (m.n) this.model.anim.play(m.n, { windup: m.w || 0.3, active: m.ac || 0.15, recovery: m.r || 0.3 });
  }

  roll(dir) {
    this.model.anim.startRoll(dir || 'f', 0.4);
    G.vfx.dust(this.pos, 5);
    G.audio.play('dodge', { pos: this.pos, vol: 0.5 });
  }

  // ---------------------------------------------------------------- authority hooks
  // Damage, posture and statuses are owned by the remote player's own game.
  interrupt() {
    return false;
  }
  addPosture() {
    return false;
  }
  applyKnockback() {}
  applyStatus() {}
  takeDot() {}
  onLethal() {}
  getParried() {
    if (this.model) this.model.flash('#ffffff', 0.5, 0.15);
  }
  getGripped(by) {
    if (G.net) G.net.send({ t: 'gripped', to: this.peerId, e: by && by.netId != null ? by.netId : -1 });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (this.netPos) {
      const d = this.pos.distanceTo(this.netPos);
      if (d > 14) this.pos.copy(this.netPos);
      else this.pos.lerp(this.netPos, 1 - Math.exp(-14 * dt));
    }
    this.yaw = dampAngle(this.yaw, this.netYaw, 14, dt);
    // replayed attacks/casts (their damage is blocked; visuals and non-damage effects remain)
    if (this.atk) this.updateAttack(dt);
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.buffs.splice(i, 1);
        if (b.onEnd) b.onEnd(this);
      }
    }
    if (this.wardT > 0) this.wardT -= dt;
    if (this.eatT > 0) this.eatT -= dt;
    if (this.autoParryT > 0) this.autoParryT -= dt;
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt * 5);
    // the replica must never drift because of local physics
    this.vel.x = 0;
    this.vel.z = 0;
    this.push.set(0, 0, 0);

    const f = this.flags;
    const stealthed = !!(f & PF.stealth);
    if (stealthed !== this._stealthShown) {
      this.model.setOpacity(stealthed ? 0.18 : 1);
      this._stealthShown = stealthed;
    }
    this.updateBoat(dt);
    this.label.visible = !this.dead;
    this.syncModel(dt, {
      speed: this.netSpeed,
      grounded: !!(f & PF.grounded),
      swimming: !!(f & PF.swimming),
      climbing: !!(f & PF.climbing),
      climbSpeed: this.vel.y,
      sliding: !!(f & PF.sliding),
      blocking: !!(f & PF.blocking),
      charging: !!(f & PF.charging),
      knocked: !!(f & PF.knocked),
      dead: !!(f & PF.dead),
      stunned: !!(f & PF.stunned),
      sit: !!(f & PF.sit),
      vy: this.vel.y,
      flinch: this.flinch,
      runSpeed: 9,
      weaponOut: !(f & (PF.boat | PF.handsDown)),
    });
    if (f & PF.charging && Math.random() < dt * 20) {
      const a = Math.random() * Math.PI * 2;
      const p = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.2, 0.2 + Math.random() * 1.6, Math.sin(a) * 1.2));
      G.vfx.add.emit(p.x, p.y, p.z, -Math.cos(a) * 1.5, 0.6, -Math.sin(a) * 1.5, new THREE.Color('#8fd0ff'), 0.15, 0.6, { drag: 1 });
    }
  }

  updateBoat(dt) {
    const synced = this.boat && G.game.boats.some((b) => b.occupants && b.occupants.includes(this));
    if (this.boat && !synced) {
      if (!this.boatMesh) {
        this.boatMesh = makeBoatMesh('#7a5434', '#efe6d2', true);
        G.scene.add(this.boatMesh);
      }
      const yaw = this.boatYaw ?? this.yaw;
      const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(1.4);
      this.boatMesh.position.set(this.pos.x + back.x, 0, this.pos.z + back.z);
      this.boatMesh.rotation.y = yaw;
    } else if (this.boatMesh) {
      G.scene.remove(this.boatMesh);
      this.boatMesh = null;
    }
    if (synced) {
      // sit exactly in the seat the synced boat gives us (no drift between updates)
      const b = G.game.boats.find((x) => x.occupants && x.occupants.includes(this));
      if (b) this.pos.copy(b.seatPos(this));
    }
  }

  removeFromScene() {
    super.removeFromScene();
    if (this.boatMesh) G.scene.remove(this.boatMesh);
  }
}
