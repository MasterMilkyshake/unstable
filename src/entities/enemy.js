// Enemy AI for humanoids (weapon movesets, reactive defense, mantras) and creatures.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Actor, SWIM_Y } from './actor.js';
import { HumanoidRig } from './rig.js';
import { CreatureModel } from './creatures.js';
import { STANCE_FOR_CLASS } from './anims.js';
import { ENEMIES } from '../data/enemies.js';
import { WEAPONS, WEAPON_CLASSES, weaponFeel } from '../data/weapons.js';
import { traitSwingMul } from '../combat/weaponTraits.js';
import { MANTRAS } from '../data/mantras.js';
import { Projectile } from './projectile.js';
import { areaHit, applyHit, hostile } from '../combat/combat.js';
import { makeCastDef, setTimer } from '../combat/mantraRuntime.js';
import { COMBAT, guardCovers } from '../combat/rules.js';
import { navGrid, navBody, PathSearch, crossesAvoid } from './nav.js';
import { TACTICS, mayPress, yieldTurn, partner, flankPoint, fallsBack, callForHelp, takesTurns } from './tactics.js';
import { rand, randInt, chance, clamp, damp, dampAngle, angleDiff, forwardFromYaw, weightedChoice, choice, hypot } from '../core/util.js';
import { ACTIONS } from '../game/hooks.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
// Where an actor stands: its feet, or the ground under it while it is in the air.
// climbing after a target out of reach above (Enemy.chaseAbove)
const CLIMB_MIN = 1.3; // higher than a step and a hop
const CLIMB_MAX = 14; // m: as high as wall hops and ledge catches take a player
const CLIMB_SPEED = 6; // m/s up a face
const footY = (a) => (a.grounded || a.groundH == null ? a.pos.y : Math.min(a.pos.y, a.groundH));

export class Enemy extends Actor {
  constructor(type, pos, opts = {}) {
    const s = ENEMIES[type];
    const scale = s.scale || 1;
    // Every enemy of a type is the same enemy: its table's health, damage and posture wherever
    // it is met and whoever meets it. (opts.scaleTo, which raised a spawn to the player's Power,
    // is no longer honoured.) `level` stays an internal rating from the table: it sets XP falloff.
    const level = s.level;
    const hp = s.hp;
    super({
      team: s.team || 'enemy', name: s.name, radius: s.radius ?? 0.42 * scale, height: s.height ?? 1.8 * scale,
      level, hp, posture: s.posture, resist: s.resist, flying: s.flying, aquatic: s.aquatic, hyperarmor: s.hyperarmor,
    });
    this.type = type;
    this.spec = s;
    // Faction guards (team 'guard'): patrol a route or hold a post, fight monsters, and
    // only turn on a player who provokes them or whose standing with `faction` is hostile.
    this.faction = s.faction || null;
    this.patrol = opts.patrol || null;
    this.postYaw = opts.face ?? null;
    this.provoked = new Map(); // player actor -> seconds of remaining provocation
    this.boss = !!s.boss;
    this.dummy = !!s.dummy;
    this.illusion = !!s.illusion;
    this.construct = s.model === 'golem' || s.model === 'dummy';
    this.frontArmor = s.frontArmor || 0;
    this.knockable = !!s.knockable;
    this.netProxy = !!opts.netProxy; // LAN guest: replica of a host-owned enemy
    if (opts.netId != null) this.netId = opts.netId;
    this.localOnly = this.illusion; // hallucinations exist only for the player who sees them
    this.netSpeed = 0;
    this.pos.copy(pos);
    this.home = pos.clone();
    this.yaw = rand(-Math.PI, Math.PI);
    this.spawner = opts.spawner || null;
    this.aggro = false;
    this.target = null;
    this.dmgMul = s.dmgMul ?? 1;
    this.levelMul = 1 + level * 0.06;
    this.speedMul = 1;
    this.enraged = false;
    this.ai = {
      state: 'idle', t: 0, wanderT: rand(1, 4), wanderTo: null, strafe: chance(0.5) ? 1 : -1, strafeT: rand(1, 3),
      atkCd: rand(0.6, 1.4), comboLeft: 0, blockT: 0, reactTo: null, parryAt: -1, cds: {}, gripT: 0, usedOnce: {},
      summonsDone: 0, lastSeen: 0, summonRetryAt: 0, seenX: pos.x, seenZ: pos.z, flourishes: 0,
    };
    if (s.model === 'humanoid') {
      const look = Object.assign({ hairStyle: randInt(0, 4) }, s.look, { scale });
      const rig = new HumanoidRig(look);
      this.attachModel(rig);
      const w = WEAPONS[s.weapon] || WEAPONS.fists;
      this.weaponDef = w;
      rig.setWeapon(w);
      rig.anim.setStance(STANCE_FOR_CLASS[w.cls] || 'oneHand');
      this.trail = G.vfx.newTrail('#ffffff');
    } else {
      this.attachModel(new CreatureModel(s.model, { size: s.size || 1, lavaGlow: s.lavaGlow, palette: s.palette }));
    }
    if (this.illusion) this.model.setOpacity(0.55);
    this.syncModel(0, { grounded: true });
  }

  // ------------------------------------------------------------ hits
  buildHit(d, target) {
    if (this.weaponDef && (d.weaponHit || !d.dmg)) {
      const w = this.weaponDef;
      const cls = WEAPON_CLASSES[w.cls];
      const feel = weaponFeel(w);
      return {
        chip: feel.chip, pen: feel.pen, trait: w.trait || null,
        dmg: w.damage * (d.dmgMul || 1) * this.dmgMul * this.levelMul * (this.enraged ? 1.15 : 1) * traitSwingMul(this, d) * this.rallyMul(),
        posture: w.posture * (cls.postureMul || 1) * (d.postureMul || 1) * (1 + this.level * 0.03),
        element: d.element || 'phys', unparryable: !!d.unparryable, unblockable: !!d.unblockable,
        knockback: d.knockback || (d.crit ? 5 : 0), launch: d.launch || 0, kind: 'melee', crit: !!d.crit,
        heavy: cls.type === 'heavy' || !!d.crit, status: w.enchant === 'frozen' && chance(0.4) ? ['chill'] : w.enchant === 'cruel' && chance(0.3) ? ['bleed'] : w.enchant === 'riftborn' && chance(0.1) ? ['blind'] : null,
        sanity: this.spec.sanityHit || 0,
      };
    }
    return {
      dmg: (d.dmg || 8) * (this.enraged ? 1.15 : 1) * this.rallyMul(), posture: d.posture ?? 8, element: d.element || 'phys',
      unparryable: !!d.unparryable, unblockable: !!d.unblockable, knockback: d.knockback || 0, launch: d.launch || 0,
      status: d.status ? [d.status] : null, kind: 'melee', heavy: (d.dmg || 0) > 20, sanity: this.spec.sanityHit || 0,
    };
  }
  // A support foe's rally (supportDef) strengthens its side's blows for a while.
  rallyMul() {
    const r = this.ai && this.ai.rally;
    return r && r.until > G.time ? r.mul : 1;
  }

  weaponHitTemplate() {
    const w = this.weaponDef || WEAPONS.golem_fist;
    return { dmg: w.damage * this.dmgMul * this.levelMul, posture: w.posture, element: 'phys', kind: 'melee' };
  }
  get mantraPower() {
    return (this.spec.mantraPower || 1) * (1 + this.level * 0.025);
  }

  onDamaged(att, dmg) {
    if (att && att.team === 'player' && this.team === 'guard') this.provoke(att);
    if (att && (att.team === 'player' || (att.team === 'guard') !== (this.team === 'guard')) && !this.aggro) this.setAggro(att);
    if (this.dummy) this.hp = Math.max(this.hp, 1);
    this.regenLock = 6;
  }

  // A guard (and the guards around it) stays hostile to whoever struck it for a while.
  provoke(p, secs = 90, spread = true) {
    this.provoked.set(p, secs);
    if (!spread) return;
    for (const a of G.actors) if (a !== this && a.team === 'guard' && !a.dead && a.provoke && a.pos.distanceTo(this.pos) < 24) a.provoke(p, secs, false);
  }

  // Whether this guard will fight player actor `p` (local or LAN friend).
  hostileTo(p) {
    if (this.team !== 'guard') return true;
    if (!p || p.team !== 'player') return false;
    if ((this.provoked.get(p) || 0) > 0) return true;
    return !!(ACTIONS.guardHostile && ACTIONS.guardHostile(this, p));
  }
  onDealtHit(tgt) {
    if (tgt === G.player) G.player.refreshDanger();
  }

  setAggro(t) {
    if (this.dummy || this.aggro) return;
    this.aggro = true;
    this.target = t;
    this.ai.state = 'chase';
    if (this.boss) {
      if (t === G.player) G.game.startBoss(this);
    } else if (this.type !== 'hallucination') G.audio.play(this.spec.alert || (this.spec.model === 'owl' ? 'screech' : 'cast'), { pos: this.pos, pitch: 0.6, vol: 0.3 });
    // alert nearby allies
    for (const a of G.actors) {
      if (a !== this && a.team === this.team && !a.aggro && !a.dummy && a.pos.distanceTo(this.pos) < 14 && a.setAggro) a.setAggro(t);
    }
  }

  dropAggro() {
    if (this.evading) this.endEvade();
    this.aggro = false;
    this.target = null;
    this.ai.state = 'return';
    this.blocking = false;
    if (this.boss) G.game.endBoss(this, false);
  }

  onLethal(src) {
    if (this.dummy) {
      this.hp = 1;
      return;
    }
    if (this.knockable && !this.knocked && !this.dead) {
      this.knocked = true;
      this.knockedT = 0;
      this.state = 'knocked';
      this.cancelAttack();
      this.blocking = false;
      this.hp = 0;
      this.killer = src;
      G.audio.play('knock', { pos: this.pos });
      if (src === G.player) {
        G.vfx.addShake(0.32);
        G.vfx.hitStop(0.07);
      }
      return;
    }
    this.die(src);
  }

  finish(by) {
    if (this.dead) return;
    if (this.netProxy) {
      if (G.net) G.net.send({ t: 'grip', to: G.net.hostId, e: this.netId });
      return;
    }
    this.gripped = true;
    this.knocked = false;
    G.audio.play('grip', { pos: this.pos });
    if (by === G.player) {
      G.vfx.addShake(0.34);
      G.vfx.hitStop(0.09);
    }
    this.die(by);
  }

  die(src) {
    if (this.dead) return;
    // Conflagration (talent): a foe burning by its bearer's hand sets those around it alight
    const burn = this.statuses.burn;
    if (burn && burn.src && burn.src.mods && burn.src.mods.conflagration && !this.netProxy) {
      G.vfx && G.vfx.burst(this.center(_v), 'ember', 24, { speed: 6 });
      for (const a of G.actors) {
        if (a === this || a.dead || !hostile(burn.src, a)) continue;
        if (hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) <= 3 + a.radius) a.applyStatus('burn', 1, burn.src);
      }
    }
    super.die(src || this.killer);
    if (this.illusion) {
      this.removeT = 0.01;
      return;
    }
    if (this.dummy) return;
    if (G.net) G.net.enemyDied(this, src || this.killer);
    G.game.onEnemyKilled(this, src || this.killer);
    if (this.boss) G.game.endBoss(this, true);
    if (this.spawner) this.spawner.onDeath(this);
  }

  dispel() {
    G.vfx.burst(this.center(_v), 'umbra', 30, { speed: 5 });
    G.audio.play('whisper', { pos: this.pos });
    this.dead = true;
    this.removeT = 0.01;
  }

  // ------------------------------------------------------------ attack defs
  // The reach of this enemy's weapon: its class's, plus the weapon's own (data/weapons.js).
  weaponReach() {
    return this.weaponDef ? WEAPON_CLASSES[this.weaponDef.cls].range + weaponFeel(this.weaponDef).reach : 0;
  }

  humanoidM1(i) {
    const cls = WEAPON_CLASSES[this.weaponDef.cls];
    const k = cls.combo[i % cls.combo.length];
    const quick = weaponFeel(this.weaponDef).speed;
    const slow = this.boss ? 1.05 : 1.2;
    return {
      anim: k, windup: (cls.windup * slow) / quick / this.speedMul, active: cls.active, recovery: (cls.recovery * 1.15) / quick / this.speedMul,
      range: this.weaponReach(), arc: cls.arc, dmgMul: cls.comboDmg[i % cls.comboDmg.length], sound: cls.sound, pitch: cls.pitch, lunge: 2.5,
      trackTarget: true, trackRate: 5, weaponHit: true, netKey: ['m1', i], hyperarmor: !!this.spec.swingHyper, // a bruiser swings through blows
    };
  }

  humanoidCrit() {
    const cls = WEAPON_CLASSES[this.weaponDef.cls];
    const c = cls.crit;
    const feel = weaponFeel(this.weaponDef);
    const d = Object.assign({}, c, {
      windup: (c.windup * 1.15) / feel.speed, range: (c.range || cls.range * 1.1) + feel.reach, arc: c.arc || cls.arc, crit: true, weaponHit: true,
      sound: cls.type === 'heavy' ? 'swingHeavy' : 'swing', trackTarget: true, trackRate: 4, netKey: ['crit'],
    });
    if (c.shockwave) {
      d.onActive = (a) => {
        const p = a.pos.clone().addScaledVector(forwardFromYaw(a.yaw), 2);
        p.y = G.world.groundAt(p.x, p.z, p.y + 3);
        G.vfx.ring(p, 'phys', c.shockwave, 0.45, { color: '#ffe0b0' });
        G.vfx.dust(p, 14);
        areaHit(a, p, c.shockwave, (t) => Object.assign(this.buildHit(Object.assign({}, d, { dmgMul: c.dmgMul * 0.5 }), t), { from: p.clone(), kind: 'aoe' }));
      };
    }
    return d;
  }

  creatureDef(at) {
    const humanoidAnim = at.type === 'leap' ? 'heavySlam' : at.type === 'buff' ? 'castRaise' : 'slashR';
    // an attack may name its own animation (a humanoid boss's slam is a heavySlam, not a slash)
    const d = Object.assign({}, at, { anim: at.anim || (this.weaponDef ? humanoidAnim : at.id), trackTarget: true, trackRate: at.type === 'leap' ? 3 : 6, netKey: ['cre', at.id] });
    const self = this;
    switch (at.type) {
      case 'projectile':
        d.type = 'cast';
        d.active = 0.1;
        d.onActive = (a) => self.fireProjectile(at);
        break;
      case 'aoe':
        d.type = 'cast';
        d.onStart = (a) => G.vfx.telegraph(a.pos, at.radius, at.windup, at.unblockable ? '#ffaa1a' : '#ff3a2a');
        d.onActive = (a) => {
          G.vfx.ring(a.pos, at.element || 'phys', at.radius, 0.5, { color: '#e8d8c0' });
          G.vfx.dust(a.pos, 20, '#a89a80', 1);
          if (at.sound) G.audio.play(at.sound, { pos: a.pos });
          else G.audio.play('hitHeavy', { pos: a.pos, pitch: 0.6 });
          if (G.player && G.player.pos.distanceTo(a.pos) < 25) G.vfx.addShake(0.35);
          areaHit(a, a.pos, at.radius, () => ({ dmg: at.dmg, posture: at.posture, element: at.element || 'phys', unblockable: at.unblockable, launch: at.launch || 0, knockback: 6, kind: 'aoe', from: a.pos.clone(), sanity: self.spec.sanityHit }));
        };
        break;
      case 'leap': {
        d.type = 'melee';
        // where the landing strikes, from the body's centre: a big beast names its own reach
        d.range = at.hitRange || 2.6;
        d.arc = at.arc || 90;
        d.onActive = (a) => {
          const t = self.target;
          const to = t ? t.pos.clone() : a.pos.clone().addScaledVector(forwardFromYaw(a.yaw), at.range * 0.7);
          const dist = Math.min(at.range, hypot(to.x - a.pos.x, to.z - a.pos.z));
          const dir = _w.set(to.x - a.pos.x, 0, to.z - a.pos.z).normalize();
          a.leapVel = dir.clone().multiplyScalar(dist / at.active);
          a.vel.y = at.flyArc ?? 8;
          a.grounded = false;
          G.vfx.dust(a.pos, 10);
        };
        d.onActiveTick = (a) => {
          if (a.leapVel) {
            a.vel.x = a.leapVel.x;
            a.vel.z = a.leapVel.z;
          }
        };
        d.onEnd = (a) => {
          a.leapVel = null;
          a.vel.x *= 0.1;
          a.vel.z *= 0.1;
          if (at.shockwave) {
            G.vfx.ring(a.pos, 'phys', at.shockwave, 0.5, { color: '#ffb08a' });
            G.vfx.dust(a.pos, 24, '#a89a80', 1);
            G.vfx.addShake(0.45);
            G.audio.play('hitHeavy', { pos: a.pos, pitch: 0.55 });
            areaHit(a, a.pos, at.shockwave, () => ({ dmg: at.dmg * 0.6 * (self.weaponDef ? self.levelMul : 1), posture: at.posture, unparryable: true, kind: 'aoe', knockback: 8, from: a.pos.clone() }));
          }
        };
        if (self.weaponDef) {
          d.weaponHit = true;
          d.dmgMul = 1.3;
        }
        break;
      }
      case 'multi':
        d.type = 'melee';
        d.active = at.active + (at.hits - 1) * at.gap;
        break;
      case 'mantra': {
        d.type = 'cast';
        d.anim = at.id;
        d.active = 0.1;
        d.onActive = (a) => {
          const reps = at.repeat || 1;
          for (let r = 0; r < reps; r++) {
            setTimer(r * 0.45, () => {
              if (a.dead || !a.target) return;
              const cast = makeCastDef(a, at.mantra, () => a.aimAt(a.target, 30));
              cast.onActive && cast.onActive(a, cast, {});
            });
          }
        };
        break;
      }
      case 'buff':
        d.type = 'cast';
        d.anim = at.anim || 'castRaise';
        d.onActive = (a) => self.enrage();
        break;
      default:
        d.type = 'melee';
    }
    return d;
  }

  enrage() {
    if (this.enraged) return;
    this.enraged = true;
    this.speedMul = 1.25;
    this.posture = 0;
    G.audio.play('roar', { pos: this.pos, pitch: 0.8 });
    G.vfx.ring(this.pos, 'phys', 8, 0.6, { color: '#ff5a3a' });
    G.vfx.burst(this.center(_v), 'ember', 40, { speed: 8 });
    G.vfx.addShake(0.4);
    G.ui.toast(`${this.name} is enraged!`, 'bad');
    if (this.model.mats && this.model.mats.eye) {
      this.model.mats.eye.emissive.set('#ff3a1a');
      this.model.mats.eye.emissiveIntensity = 3;
    }
  }

  aimAt(t, range) {
    const from = this.center();
    const tp = t ? t.center() : from.clone().addScaledVector(forwardFromYaw(this.yaw), 10);
    return { dir: tp.clone().sub(from).normalize(), point: t ? t.pos.clone() : tp, target: t };
  }

  fireProjectile(at) {
    const p = at.proj;
    const from = this.center(_v).clone();
    from.y += this.spec.model === 'golem' ? 1.2 : 0.2;
    from.addScaledVector(forwardFromYaw(this.yaw), this.radius + 0.4);
    const t = this.target;
    let aim = t ? t.center() : from.clone().addScaledVector(forwardFromYaw(this.yaw), 10);
    if (t) aim.addScaledVector(t.vel, from.distanceTo(aim) / p.speed * 0.6);
    const dir = aim.clone().sub(from);
    const flatDist = hypot(dir.x, dir.z);
    dir.normalize();
    const vel = dir.multiplyScalar(p.speed);
    if (p.gravity) vel.y += (p.gravity * (flatDist / p.speed)) / 2;
    new Projectile(this, {
      pos: from, vel, radius: p.size * 0.9, size: p.size, life: 3, rod: p.rod, rock: p.rock, homing: p.homing || 0, target: t, gravity: p.gravity || 0, color: p.color,
      hit: { dmg: at.dmg, posture: at.posture, element: p.element || 'phys', status: p.status ? [p.status] : null, knockback: p.knockback || 0, sanity: p.sanity || this.spec.sanityHit || 0 },
    });
    G.audio.play(p.element === 'ember' ? 'ember' : p.element === 'umbra' ? 'umbra' : p.element === 'rime' ? 'rime' : 'swing', { pos: this.pos, vol: 0.6 });
  }

  // ------------------------------------------------------------ AI
  chooseAttack(dist) {
    const s = this.spec;
    const ai = this.ai;
    const hp = this.hp / this.maxHp;
    // specials (bosses)
    for (const sp of s.specials || []) {
      if ((ai.cds[sp.id] || 0) > 0) continue;
      if (sp.once && ai.usedOnce[sp.id]) continue;
      if (sp.hpBelow && hp > sp.hpBelow) continue;
      // an area special with no range of its own reaches as far as its radius, as attacks do
      if (sp.type === 'buff' || (dist <= (sp.range ?? sp.radius ?? 0) && dist >= (sp.minRange || 0) && chance(0.45))) {
        ai.cds[sp.id] = sp.cd;
        if (sp.once) ai.usedOnce[sp.id] = true;
        return this.creatureDef(sp);
      }
    }
    // summons: a wave is spent only when its cast completes; a cast cut short is tried again
    // COMBAT.summonRetry seconds later, so every HP threshold brings exactly one wave
    if (s.summons && ai.summonsDone < s.summons.atHp.length && hp <= s.summons.atHp[ai.summonsDone] && G.time >= (ai.summonRetryAt || 0)) {
      const wave = ai.summonsDone;
      const d = this.summonDef(wave);
      ai.summonRetryAt = G.time + d.windup + COMBAT.summonRetry;
      return d;
    }
    if (this.weaponDef) {
      if (s.mantras && chance(s.mantraChance || 0) && dist > 3) {
        const ready = s.mantras.filter((m) => (ai.cds['m_' + m] || 0) <= 0 && dist <= (MANTRAS[m].p.range || 12) + 2);
        if (ready.length) {
          const m = choice(ready);
          ai.cds['m_' + m] = MANTRAS[m].cd * 1.6;
          return this.mantraDef(m);
        }
      }
      if (s.ranged && dist >= s.ranged.minRange && dist <= s.ranged.range && (ai.cds.ranged || 0) <= 0) {
        ai.cds.ranged = s.ranged.cd;
        return this.rangedDef();
      }
      if (dist > this.weaponReach() + 1.0) return null;
      const cls = WEAPON_CLASSES[this.weaponDef.cls];
      if (chance(s.critChance || 0) && (ai.cds.crit || 0) <= 0) {
        ai.cds.crit = cls.crit.cd * 1.3;
        return this.humanoidCrit();
      }
      ai.comboLeft = randInt(1, s.comboMax || 3) - 1;
      ai.comboIdx = 0;
      return this.humanoidM1(0);
    }
    // a large monster follows its pattern in order, each step readable from its own wind-up
    if (s.pattern) {
      const id = s.pattern[(ai.patternI || 0) % s.pattern.length];
      const step = (s.attacks || []).find((a) => a.id === id);
      if (!step) {
        ai.patternI = (ai.patternI || 0) + 1;
        return null;
      }
      if (dist > (step.range || step.radius || 2) + this.radius + 0.3 || dist < (step.minRange || 0)) return null;
      ai.patternI = (ai.patternI || 0) + 1;
      return this.creatureDef(step);
    }
    const options = (s.attacks || []).filter((a) => (ai.cds[a.id] || 0) <= 0 && dist <= (a.range || a.radius || 2) + this.radius + 0.3 && dist >= (a.minRange || 0));
    const at = weightedChoice(options);
    if (!at) return null;
    if (at.cd) ai.cds[at.id] = at.cd;
    return this.creatureDef(at);
  }

  // A support foe's turn: mend the most wounded of its side, or rally them (spec.support).
  supportAction() {
    const sp = this.spec.support;
    if (!sp) return null;
    const ai = this.ai;
    const within = (a, r) => hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z) <= r;
    if (sp.heal && (ai.cds.heal || 0) <= 0) {
      let best = null;
      let low = 0.6;
      for (const a of G.actors) {
        if (a === this || a.dead || a.knocked || a.team !== this.team || !a.spec || a.dummy || a.illusion || !within(a, sp.heal.range)) continue;
        if (a.hp / a.maxHp < low) {
          low = a.hp / a.maxHp;
          best = a;
        }
      }
      if (!best && this.hp / this.maxHp < 0.45) best = this;
      if (best) {
        ai.cds.heal = sp.heal.cd;
        return this.supportDef('heal', best);
      }
    }
    if (sp.rally && (ai.cds.rally || 0) <= 0) {
      if (G.actors.some((a) => a !== this && !a.dead && a.team === this.team && a.aggro && a.spec && within(a, sp.rally.range))) {
        ai.cds.rally = sp.rally.cd;
        return this.supportDef('rally');
      }
    }
    return null;
  }

  // The cast behind a support action. Its wind-up is long and interruptible: strike the mender.
  supportDef(kind, ally = null) {
    const sp = (this.spec.support || {})[kind] || { windup: 0.9 };
    return {
      anim: 'castRaise', windup: sp.windup || 0.9, active: 0.1, recovery: 0.6, type: 'cast', netKey: ['sup', kind], ally,
      onStart: (a) => {
        // seen coming: a green glow on the one to be mended, a gold ring for a rally
        if (kind === 'heal' && ally && ally.model) ally.model.flash('#7aff9a', 0.6, sp.windup || 0.9);
        if (G.vfx) G.vfx.ring(a.pos, 'support', kind === 'rally' ? 3 : 1.6, sp.windup || 0.9, { color: kind === 'rally' ? '#ffd27a' : '#7aff9a' });
        G.audio && G.audio.play('cast', { pos: a.pos, pitch: kind === 'rally' ? 0.8 : 1.3, vol: 0.6 });
      },
      onActive: (a) => {
        if (a.netProxy) return; // the host mends; snapshots carry the health
        if (kind === 'heal' && ally && !ally.dead && !ally.knocked) {
          const amt = ally.maxHp * (sp.pct || 0.25);
          ally.hp = Math.min(ally.maxHp, ally.hp + amt);
          if (G.vfx) {
            G.vfx.pillar(ally.pos, 'support', 0.8, 3.5, 0.6);
            G.vfx.number(ally.center(), '+' + Math.round(amt), 'heal');
          }
          G.audio && G.audio.play('heal', { pos: ally.pos });
        } else if (kind === 'rally') {
          for (const b of G.actors) {
            if (b.dead || b.team !== a.team || !b.ai || hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > (sp.range || 12)) continue;
            b.ai.rally = { until: G.time + (sp.duration || 8), mul: 1 + (sp.dmg || 0.15) };
            if (b.model) b.model.flash('#ffd27a', 0.5, 0.3);
          }
          if (G.vfx) G.vfx.ring(a.pos, 'support', sp.range || 12, 0.6, { color: '#ffd27a' });
          G.audio && G.audio.play('roar', { pos: a.pos, pitch: 1.2, vol: 0.6 });
        }
      },
    };
  }

  summonDef(wave = -1) {
    const s = this.spec;
    return {
      anim: 'castRaise', windup: 0.8, active: 0.1, recovery: 0.6, type: 'cast', netKey: ['summon'],
      onActive: (a) => {
        if (wave >= 0 && !a.netProxy) {
          a.ai.summonsDone = Math.max(a.ai.summonsDone, wave + 1);
          a.ai.summonRetryAt = 0;
        }
        G.audio.play('umbra', { pos: a.pos });
        for (let i = 0; i < s.summons.count; i++) {
          const p = a.pos.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5)));
          p.y = G.world.groundAt(p.x, p.z, p.y + 5);
          G.vfx.pillar(p, 'umbra', 1.2, 5, 0.8);
          if (a.netProxy) continue; // the host spawns the real ones
          const e = G.game.spawnEnemy(s.summons.type, p);
          e.setAggro(a.target || G.player);
        }
      },
    };
  }

  mantraDef(id) {
    const d = makeCastDef(this, id, () => this.aimAt(this.target, 30));
    d.netKey = ['mantra', id];
    return d;
  }

  rangedDef() {
    const r = this.spec.ranged;
    return { anim: 'castThrow', windup: r.windup, active: 0.1, recovery: r.recovery, type: 'cast', trackTarget: true, netKey: ['ranged'], onActive: () => this.fireProjectile(r) };
  }

  // Rebuild an attack from its network key (guest replicas replay the host's attacks).
  defFromKey(key) {
    if (!Array.isArray(key)) return null;
    const s = this.spec;
    switch (key[0]) {
      case 'm1':
        return this.weaponDef ? this.humanoidM1(key[1] || 0) : null;
      case 'crit':
        return this.weaponDef ? this.humanoidCrit() : null;
      case 'cre': {
        const at = [...(s.attacks || []), ...(s.specials || [])].find((a) => a.id === key[1]);
        return at ? this.creatureDef(at) : null;
      }
      case 'mantra':
        return MANTRAS[key[1]] ? this.mantraDef(key[1]) : null;
      case 'ranged':
        return s.ranged ? this.rangedDef() : null;
      case 'summon':
        return s.summons ? this.summonDef() : null;
      case 'sup':
        return s.support ? this.supportDef(key[1]) : null;
      default:
        return null;
    }
  }

  startAttack(def) {
    if (this.boss && def.type !== 'cast') def.hyperarmor = true;
    const ok = super.startAttack(def);
    if (ok && def.type !== 'cast' && !def.onStart && G.vfx) {
      const color = def.unparryable ? '#ff3a2a' : def.unblockable ? '#ffaa1a' : '#ffb15a';
      G.vfx.telegraph(this.pos, Math.max(1.55, Math.min(2.8, (def.range || 2) * 0.85)), Math.max(0.3, def.windup || 0.35), color);
      if (this.model) this.model.flash(color, 0.95, Math.min(def.windup || 0.35, 0.5));
    }
    if (ok && !this.netProxy && G.net && G.net.isHost) G.net.enemyAttack(this, def);
    // Humanoids sometimes feint: start a swing, then cancel it to bait a parry. Or they flourish:
    // hold an M1 at the top of its wind-up, by the player's rule (COMBAT.flourish).
    if (ok && !this.netProxy && this.weaponDef && def.netKey && (def.netKey[0] === 'm1' || def.netKey[0] === 'crit')) {
      const F = COMBAT.flourish;
      const feintChance = this.boss ? 0.25 : this.spec.feintChance ?? 0.12;
      const flourishChance = this.spec.flourishChance ?? (this.boss ? F.bossChance : F.enemyChance);
      // a blinded foe neither feints nor flourishes: both are reads on someone it can see
      if (this.statuses.blind) {
        // nothing
      } else if (chance(feintChance) && this.target) this.atk.feintAt = def.windup * rand(0.45, 0.8);
      else if (def.netKey[0] === 'm1' && this.target && chance(flourishChance)) {
        this.atk.holdFor = rand(F.enemyHold[0], F.enemyHold[1]);
        if (G.net && G.net.isHost) G.net.enemyAnim(this, 'hold', { h: Math.round(this.atk.holdFor * 100) / 100 });
      }
    }
    return ok;
  }

  // A held swing glints, so the one facing it can read the flourish (presentation only).
  onSwingHeld() {
    if (this.model) this.model.flash('#fff2c8', 0.55, 0.14);
    G.audio && G.audio.play('swing', { pos: this.pos, vol: 0.25, pitch: 0.6 });
  }

  // Cancel the current wind-up as a bait, then follow up quickly.
  doFeint() {
    if (!this.atk || this.atk.phase !== 'windup') return;
    this.cancelAttack();
    this.ai.comboLeft = 0;
    this.ai.atkCd = rand(0.15, 0.4);
    G.audio.play('dodge', { pos: this.pos, vol: 0.35, pitch: 1.4 });
    if (this.model) this.model.flash('#c8d8ff', 0.35, 0.12);
    if (G.net) G.net.enemyAnim(this, 'feint');
  }

  // ------------------------------------------------------------ LAN replica (guest side)
  playNetAttack(key, target) {
    if (this.dead || this.knocked) return;
    if (target) this.target = target;
    const def = this.defFromKey(key);
    if (!def) return;
    this.cancelAttack();
    super.startAttack(def);
  }

  // row = [netId, type, x, y, z, yaw, hp, maxHp, posture, maxPosture, flags, level, statusFlags, bleedStacks, targetId]
  netSnap(row, net) {
    if (!this.netPos) this.netPos = new THREE.Vector3(row[2], row[3], row[4]);
    else this.netPos.set(row[2], row[3], row[4]);
    this.netYaw = row[5];
    const prevHp = this.hp;
    this.hp = row[6];
    this.maxHp = row[7];
    this.posture = row[8];
    this.maxPosture = row[9];
    const f = row[10];
    if (row[11] && row[11] !== this.level) this.level = row[11];
    if (this.hp < prevHp - 0.5 && !(f & 1)) this.flinch = Math.max(this.flinch, 0.6);
    this.knocked = !!(f & 2);
    this.aggro = !!(f & 4);
    this.blocking = !!(f & 8);
    this.netStunned = !!(f & 16);
    this.guardBroken = !!(f & 64);
    if (f & 32 && !this.enraged) this.enrage();
    if (f & 1) this.markNetDead();
    const sf = row[12] || 0;
    this.netStatus = sf;
    this.statuses = {};
    if (sf & 1) this.statuses.burn = { t: 1, dps: 0 };
    if (sf & 2) this.statuses.chill = { t: 1, stacks: 50 };
    if (sf & 4) this.statuses.freeze = { t: 1 };
    if (sf & 8) this.statuses.shock = { t: 1 };
    if (sf & 16) this.statuses.bleed = { t: 1, stacks: row[13] || 1 };
    if (sf & 32) this.statuses.blind = { t: 1 };
    const tgt = net.playerById(row[14]);
    if (tgt) this.target = tgt;
  }

  markNetDead() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.knocked = false;
    this.cancelAttack();
    this.removeT = 30; // the host's snapshots decide when it disappears
    if (this.freezeMesh) this._showFreeze(false);
  }

  proxyUpdate(dt) {
    if (this.netPos) {
      const d = this.pos.distanceTo(this.netPos);
      const prevX = this.pos.x;
      const prevZ = this.pos.z;
      if (d > 12) this.pos.copy(this.netPos);
      else this.pos.lerp(this.netPos, 1 - Math.exp(-12 * dt));
      const moved = hypot(this.pos.x - prevX, this.pos.z - prevZ) / Math.max(dt, 1e-3);
      this.netSpeed = damp(this.netSpeed, Math.min(moved, 20), 10, dt);
    }
    if (this.netYaw !== undefined && !this.atk) this.yaw = dampAngle(this.yaw, this.netYaw, 12, dt);
    if (this.atk && this.atk.holdFor) this.atk.hold = (this.atk.held || 0) < this.atk.holdFor;
    if (this.atk && !this.dead) this.updateAttack(dt);
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt * 5);
    // ailment visuals only; the host owns the real statuses
    const sf = this.netStatus || 0;
    const c = this.center(_v);
    if (sf & 1 && Math.random() < dt * 20) G.vfx.fire(c.clone().add(new THREE.Vector3(0, -0.3, 0)), this.radius, 1);
    if (sf & 8 && Math.random() < dt * 20) G.vfx.sparks(c, null, '#ffe14d', 2);
    if (sf & 16 && Math.random() < dt * 4) G.vfx.blood(c, null, 1);
    if (!!(sf & 4) !== !!this.freezeMesh && !this.dead) this._showFreeze(!!(sf & 4));
    this.vel.set(0, 0, 0);
    this.push.set(0, 0, 0);
    this.syncModel(dt, {
      speed: this.netSpeed, grounded: true, blocking: this.blocking, stunned: this.netStunned, dead: this.dead, knocked: this.knocked,
      flinch: this.flinch, vy: 0, runSpeed: this.spec.speed * 1.2,
    });
  }

  onAttackDone() {
    const ai = this.ai;
    if (this.weaponDef && ai.comboLeft > 0 && this.target && !this.target.dead) {
      const dist = this.pos.distanceTo(this.target.pos);
      if (dist < this.weaponReach() + 1.2) {
        ai.comboLeft--;
        ai.comboIdx++;
        this.startAttack(this.humanoidM1(ai.comboIdx));
        return;
      }
    }
    ai.atkCd = rand(0.7, 1.7) * (this.boss ? 0.6 : 1) / this.speedMul;
    // a full string done: let a waiting ally have its turn; a skirmisher darts back out
    if (this.target && takesTurns(this)) yieldTurn(this, this.target, G.time, this.spec.role === 'skirmisher');
    if (this.spec.role === 'skirmisher' && this.target && !this.target.dead) this.aiDodge(true);
    // Intimidate (talent): a foe of lower Power than its target waits longer between attacks
    const t = this.target;
    if (t && t.mods && t.mods.intimidate && this.level < t.level) ai.atkCd *= 1.3;
    ai.comboLeft = 0;
  }

  getParried(by, h = null) {
    if (this.netProxy) {
      this.cancelAttack();
      if (this.model) this.model.flash('#ffffff', 0.6, 0.15);
      if (G.net) G.net.send({ t: 'parry', to: G.net.hostId, e: this.netId, po: h && h.posture ? Math.round(h.posture) : 0 });
      return;
    }
    super.getParried(by, h);
    this.ai.comboLeft = 0;
    this.ai.atkCd = rand(0.9, 1.4);
  }

  // How likely this foe is to wait for the top of a swing before parrying: its skill, scaled by
  // how many flourishes it has seen from the player lately.
  flourishPatience() {
    const def = this.spec.defend || {};
    const skill = this.boss ? 0.9 : clamp((def.parry || 0) * 2.5, 0.15, 0.8);
    return skill * Math.min(1, (this.ai.flourishes || 0) / COMBAT.flourish.learn);
  }

  react(dt, dist) {
    const p = this.target;
    const ai = this.ai;
    const def = this.spec.defend;
    if (!def || !p || this.stunned || this.atk) return;
    // blind: it cannot see a swing coming, so it neither parries, blocks nor rolls from one
    if (this.statuses.blind) {
      ai.parryAt = -1;
      ai.watch = null;
      ai.blockT = 0;
      this.blocking = false;
      return;
    }
    // pending parry timing. The parry follows the player's rules: a miss (a feint baited it)
    // locks the next one out, and the enemy falls back on its guard.
    if (ai.parryAt >= 0) {
      ai.parryAt -= dt;
      if (ai.parryAt <= 0) {
        ai.parryAt = -1;
        if (this.parryCd > 0) {
          this.blocking = true;
          ai.blockT = Math.max(ai.blockT, 0.35);
        } else {
          this.startParry(COMBAT.ai.parryWindow);
          this.model.play && this.model.play('parry', { windup: 0.06, active: 0.12, recovery: 0.2 });
          if (G.net) G.net.enemyAnim(this, 'parry');
        }
      }
    }
    if (ai.blockT > 0) {
      ai.blockT -= dt;
      this.blocking = ai.blockT > 0;
    }
    const pa = p.atk;
    // A foe's swing is read a moment after it starts (perception), never on its first frame.
    const reaction = this.spec.reaction ?? (this.boss ? COMBAT.ai.bossReaction : COMBAT.ai.reaction);
    // a swing seen held at the top past the perception delay is a flourish: remember it
    if (pa && pa.holding && (pa.held || 0) >= reaction && ai.sawHold !== pa) {
      ai.sawHold = pa;
      ai.flourishes = Math.min(4, (ai.flourishes || 0) + 1);
    }
    // waiting at the top of a swing: a hold, once seen, is parried for the rest of it; a swing
    // that comes down without a hold catches the waiting foe with its guard down
    if (ai.watch) {
      const w = ai.watch;
      if (w !== pa || w.phase !== 'windup') ai.watch = null;
      else if (w.holding && (w.held || 0) >= reaction) {
        ai.watch = null;
        if (this.parryCd <= 0 && guardCovers(this, p.pos)) ai.parryAt = 0;
      }
    }
    if (pa && pa !== ai.reactTo && pa.phase === 'windup' && pa.t >= reaction && dist < (pa.def.range || 4) + 2.5) {
      ai.reactTo = pa;
      const left = Math.max(0, pa.def.windup - pa.t);
      const r = Math.random();
      const unp = pa.def.unparryable;
      // the guard covers the front only: a blow from the flank can only be rolled away from
      const covered = guardCovers(this, p.pos);
      const canParry = !unp && covered && this.parryCd <= 0 && left >= COMBAT.ai.minParryLead;
      const parryC = canParry ? def.parry * (this.boss ? 1 : 0.9) : 0;
      const blockC = pa.def.unblockable || unp || !covered ? 0 : def.block;
      const dodgeC = (def.dodge || 0) * (unp ? 2.5 : 1) * (covered ? 1 : 1.6);
      if (r < parryC) {
        if (pa.def.flourish && chance(this.flourishPatience())) ai.watch = pa;
        else ai.parryAt = Math.max(0, left - COMBAT.ai.minParryLead);
      } else if (r < parryC + blockC) {
        ai.blockT = left + pa.def.active + 0.35;
        this.blocking = true;
      } else if (r < parryC + blockC + dodgeC) {
        setTimer(Math.max(0, left - 0.18), () => this.aiDodge());
      }
    }
    // dodge incoming projectiles occasionally
    if (def.dodge && chance(dt * 1.2)) {
      for (const pr of G.projectiles) {
        if (pr.team === this.team || pr.dead) continue;
        if (pr.pos.distanceTo(this.pos) < 7 && pr.vel.clone().normalize().dot(this.pos.clone().sub(pr.pos).normalize()) > 0.85) {
          if (chance(def.block + def.parry)) {
            this.blocking = true;
            ai.blockT = 0.6;
          } else this.aiDodge();
          break;
        }
      }
    }
  }

  aiDodge(back = false) {
    if (this.dead || this.knocked || this.stunned || this.atk) return;
    const side = chance(0.5) ? 1 : -1;
    const f = forwardFromYaw(this.yaw, _w);
    const k = back ? 0.35 : 1; // a skirmisher's dart back out leans away rather than aside
    const dir = new THREE.Vector3(-f.z * side * k - f.x * 0.6 * (back ? 2 : 1), 0, f.x * side * k - f.z * 0.6 * (back ? 2 : 1)).normalize();
    this.push.addScaledVector(dir, 16);
    this.iframes = 0.28;
    this.blocking = false;
    if (this.model.anim) this.model.anim.startRoll(side > 0 ? 'r' : 'l', 0.4);
    if (G.net) G.net.enemyAnim(this, 'roll', { d: side > 0 ? 'r' : 'l' });
    G.audio.play('dodge', { pos: this.pos, vol: 0.6 });
    G.vfx.dust(this.pos, 5);
  }

  // Nearest living player (local or LAN friend); sticks to its current target unless someone is much closer.
  pickTarget() {
    if (this.team === 'guard') return this.pickGuardTarget();
    const players = this.localOnly ? (G.player ? [G.player] : []) : G.game.playerActors();
    let best = null;
    let bd = Infinity;
    for (const c of players) {
      const d = hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    const cur = this.target;
    if (this.aggro && cur && players.includes(cur)) {
      const dc = hypot(cur.pos.x - this.pos.x, cur.pos.z - this.pos.z);
      if (!(best && best !== cur && !cur.knocked && bd < dc * 0.5 && dc > 6)) return cur;
    }
    // a guard that struck us keeps our attention unless a player wanders much closer
    if (this.aggro && cur && cur.team === 'guard' && !cur.dead) {
      const dc = hypot(cur.pos.x - this.pos.x, cur.pos.z - this.pos.z);
      if (!(best && bd < dc * 0.5)) return cur;
    }
    return best;
  }

  // Guards: hostile players, plus monsters close to the guard or its post.
  pickGuardTarget() {
    let best = null;
    let bd = Infinity;
    const range = this.spec.aggro || 20;
    for (const c of G.game.playerActors()) {
      if (!this.hostileTo(c)) continue;
      const d = hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    for (const a of G.actors) {
      if (a.team !== 'enemy' || a.dead || a.knocked || a.dummy || a.illusion || a.aquatic || !hostile(this, a)) continue;
      const d = hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z);
      if (d > range && hypot(a.pos.x - this.home.x, a.pos.z - this.home.z) > range) continue;
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    const cur = this.target;
    if (this.aggro && cur && cur !== best && !cur.dead && !(cur.knocked && cur.team !== 'player') && (cur.team !== 'player' || this.hostileTo(cur))) {
      const dc = hypot(cur.pos.x - this.pos.x, cur.pos.z - this.pos.z);
      if (!(best && bd < dc * 0.5 && dc > 6)) return cur;
    }
    return best;
  }

  // Idle guard: walk the patrol loop, or stand at the post facing its watch direction.
  guardIdle(dt) {
    const ai = this.ai;
    const s = this.spec;
    if (this.patrol && this.patrol.length) {
      ai.patrolI = ai.patrolI ?? 0;
      const [wx, wz] = this.patrol[ai.patrolI % this.patrol.length];
      // a patrol point we are stuck short of, with no route round, is skipped rather than
      // walked into a wall forever (one only off a ledge is still walked to, as before)
      if (this.nav && this.nav.stuck >= 3 && this.navUnreachable(wx, wz)) ai.patrolI = (ai.patrolI + 1) % this.patrol.length;
      else if (hypot(wx - this.pos.x, wz - this.pos.z) > 1.4) {
        this.navTo(wx, wz, NaN, s.speed * 0.42, dt);
        return s.speed * 0.42;
      }
      ai.waitT = (ai.waitT ?? rand(1, 3)) - dt;
      if (ai.waitT <= 0) {
        ai.waitT = rand(1.5, 4);
        ai.patrolI = (ai.patrolI + 1) % this.patrol.length;
      }
      this.halt(dt);
      return 0;
    }
    if (this.pos.distanceTo(this.home) > 1.5) {
      this.navTo(this.home.x, this.home.z, this.home.y, s.speed * 0.45, dt);
      return s.speed * 0.45;
    }
    this.halt(dt);
    if (this.postYaw != null) this.yaw = dampAngle(this.yaw, this.postYaw, 3, dt);
    return 0;
  }

  // A roaming beast (spec.roam, metres) ranges over the open ground round its camp rather than
  // pacing a few steps from where it woke. A camp's pack shares each leg's destination (kept
  // on the spawner), each beast a few metres off it, so the pack moves together; it walks
  // there, stands a while, and sets off again.
  roamIdle(dt) {
    const s = this.spec;
    const ai = this.ai;
    const pack = this.spawner ? (this.spawner.roam ||= {}) : (ai.roam ||= {});
    const cx = this.spawner ? this.spawner.def.x : this.home.x;
    const cz = this.spawner ? this.spawner.def.z : this.home.z;
    if (!(pack.until > G.time)) {
      pack.until = G.time + rand(20, 34);
      pack.to = null;
      for (let i = 0; i < 4 && !pack.to; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(0.3, 1) * s.roam;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (this.canStepTo(x, z)) pack.to = [x, z];
      }
    }
    ai.roamOff ||= [rand(-4, 4), rand(-4, 4)];
    if (!pack.to) {
      this.halt(dt);
      return 0;
    }
    const tx = pack.to[0] + ai.roamOff[0];
    const tz = pack.to[1] + ai.roamOff[1];
    // a destination it cannot reach ends the leg early: the pack picks another
    if (this.nav && this.nav.stuck >= 3 && this.navUnreachable(tx, tz)) pack.until = 0;
    if (hypot(tx - this.pos.x, tz - this.pos.z) < 2.5) {
      this.halt(dt);
      return 0;
    }
    this.navTo(tx, tz, NaN, s.speed * 0.4, dt);
    return s.speed * 0.4;
  }

  canStepTo(x, z) {
    const h = G.world.terrain.heightAt(x, z);
    if (this.aquatic) return h < -4;
    if (this.flying) return true;
    if (h >= SWIM_Y - 0.6) return true;
    // over water: a pier, deck or bridge underfoot still bears a walker, if it is not a drop
    const cl = G.world.colliders;
    if (!cl) return false;
    const deck = cl.groundAt(x, z, this.pos.y + 0.6, this.radius * 0.5);
    return deck > SWIM_Y - 0.6 && deck > this.pos.y - 1.5;
  }

  moveToward(tx, tz, speed, dt, face = true) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = hypot(dx, dz);
    if (d < 0.05) return this.halt(dt);
    const nx = dx / d;
    const nz = dz / d;
    const ahead = 1.2;
    if (!this.canStepTo(this.pos.x + nx * ahead, this.pos.z + nz * ahead)) return this.halt(dt);
    this.vel.x = damp(this.vel.x, nx * speed, 8, dt);
    this.vel.z = damp(this.vel.z, nz * speed, 8, dt);
    if (face) this.yaw = dampAngle(this.yaw, Math.atan2(nx, nz), 8, dt);
  }
  halt(dt) {
    this.vel.x = damp(this.vel.x, 0, 10, dt);
    this.vel.z = damp(this.vel.z, 0, 10, dt);
  }

  // Walk toward (tx, ty, tz) around walls: straight while the way is clear, along a planned
  // route when it is not (entities/nav.js). ty NaN: any level will do. Strafing and backing
  // off stay on moveToward.
  navTo(tx, tz, ty, speed, dt, face = true) {
    if (this.flying || this.aquatic || this.swimming || !G.world.colliders) return this.moveToward(tx, tz, speed, dt, face);
    const grid = navGrid(G.world, G.time);
    const nav = this.nav || (this.nav = {
      body: navBody(this), path: null, i: 0, search: null, goal: null, check: 0, avoid: [], failed: [],
      watchT: 0, wx: this.pos.x, wz: this.pos.z, stuck: 0, last: G.time,
    });
    if (G.time - nav.last > 0.2) {
      // back on the move after a fight or a stagger: the old route and watch are stale
      this.navWatchReset();
      if (G.time - nav.last > 0.5) {
        nav.path = null;
        nav.search = null;
        nav.check = 0;
      }
    }
    nav.last = G.time;
    if (nav.search && nav.search.run()) {
      const r = nav.search.result;
      const [gx, gz] = nav.search.goal;
      nav.search = null;
      const end = r && r.points[r.points.length - 1];
      // a partial route only helps if it ends well short of where we already stand
      if (end && (r.complete || hypot(end[0] - gx, end[2] - gz) < hypot(this.pos.x - gx, this.pos.z - gz) - 2)) {
        nav.path = r.points;
        nav.i = 0;
        nav.goal = [gx, gz];
      } else {
        // nowhere better to go: push on straight, and leave this goal alone for a while
        nav.path = null;
        this.navFailed(gx, gz);
      }
    }
    nav.check -= dt;
    if (nav.check <= 0) {
      nav.check = rand(0.3, 0.45);
      this.navReplan(grid, nav, tx, tz, ty);
    }
    let wx = tx;
    let wz = tz;
    if (nav.path) {
      let p = nav.path[nav.i];
      while (p && hypot(p[0] - this.pos.x, p[2] - this.pos.z) < 0.7) p = nav.path[++nav.i];
      if (p) {
        wx = p[0];
        wz = p[2];
      } else nav.path = null;
    }
    if (!nav.path && nav.search) {
      // the way is blocked and a route is being planned: wait for it rather than push into the
      // wall, where the stuck watch would throw the unfinished search away (a long one, round
      // Brigand Hold's palisade, never finished)
      this.halt(dt);
      this.navWatchReset();
      return;
    }
    // on a detour, look where we walk rather than at a target behind the wall
    this.moveToward(wx, wz, speed, dt, face || !!nav.path);
    this.navWatch(nav, speed, dt, tx, tz);
  }

  navReplan(grid, nav, tx, tz, ty) {
    const { x, z } = this.pos;
    const y = footY(this);
    const now = G.time;
    if (nav.avoid.length) nav.avoid = nav.avoid.filter((a) => a[3] > now);
    const clear = nav.stuck || crossesAvoid(x, z, tx, tz, nav.avoid) ? false : grid.walkLine(x, z, y, tx, tz, nav.body);
    if (clear !== false) {
      // clear, or not known yet (tiles still being built): straight on, as before navigation
      nav.path = null;
      nav.search = null;
      return;
    }
    if (nav.path) {
      const last = nav.path[nav.path.length - 1];
      const keep = hypot(tx - nav.goal[0], tz - nav.goal[1]) < 2 || grid.walkLine(last[0], last[2], last[1], tx, tz, nav.body);
      if (keep) {
        // cut corners: head for the furthest of the next few waypoints in plain reach
        for (let j = Math.min(nav.i + 3, nav.path.length - 1); j > nav.i; j--) {
          const p = nav.path[j];
          if (grid.walkLine(x, z, y, p[0], p[2], nav.body)) {
            nav.i = j;
            break;
          }
        }
        return;
      }
    }
    if (!nav.search && !this.navUnreachable(tx, tz)) {
      nav.search = new PathSearch(grid, x, z, y, tx, tz, ty, nav.body, undefined, nav.avoid);
    }
  }

  // A route to (x, z) was searched for lately and not found. A few goals are remembered, so
  // a guard cut off from every patrol point does not search them over and over in turn.
  navUnreachable(x, z) {
    const f = this.nav && this.nav.failed;
    return !!f && f.some((g) => G.time < g[2] && hypot(x - g[0], z - g[1]) < 2);
  }
  navFailed(x, z) {
    const nav = this.nav;
    nav.failed = nav.failed.filter((g) => G.time < g[2]).slice(-5);
    nav.failed.push([x, z, G.time + 8]);
  }

  // Stuck watch: pushing at a full walk and getting nowhere means the grid missed something
  // (a slope it rounded, a gap too tight for this body). Mark the spot ahead as a wall for a
  // while and plan around it.
  navWatch(nav, speed, dt, tx, tz) {
    if (speed < 1.5) return this.navWatchReset();
    nav.watchT += dt;
    if (nav.watchT < 0.8) return;
    const moved = hypot(this.pos.x - nav.wx, this.pos.z - nav.wz);
    if (moved < speed * nav.watchT * 0.15) {
      const f = hypot(this.vel.x, this.vel.z) > 0.2 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw;
      nav.avoid.push([this.pos.x + Math.sin(f) * 0.9, this.pos.z + Math.cos(f) * 0.9, 0.5, G.time + 8]);
      if (nav.avoid.length > 6) nav.avoid.shift();
      nav.stuck = Math.min(nav.stuck + 1, 3);
      nav.path = null;
      nav.search = null;
      nav.check = 0;
      // marked once; renewing the mark at every stuck check kept a cut-off walker from ever
      // searching again (it stood still on the Red Trail's climb)
      if (nav.stuck >= 3 && !this.navUnreachable(tx, tz)) this.navFailed(tx, tz);
    } else nav.stuck = 0;
    this.navWatchReset();
  }
  navWatchReset() {
    const nav = this.nav;
    if (!nav) return;
    nav.watchT = 0;
    nav.wx = this.pos.x;
    nav.wz = this.pos.z;
  }

  // ------------------------------------------------------------ out of reach above
  // A target standing on something the walkers can't path onto (a roof reached by wall hops and
  // ledge catches, a wall top, a cart) used to be safe from every melee foe. Now a foe that has
  // pressed toward such a target for a moment walks to the wall under it and climbs up after it
  // (Enemy.findClimb / startClimb, run as its own short move in update). A foe that finds no
  // place to climb (or may not: spec.noClimb, a body too big for the ledge) stops taking damage and
  // recovers until the target comes down, so the perch can't be used to whittle it down either.
  canClimb() {
    return !this.flying && !this.aquatic && !this.spec.noClimb && !this.dummy && this.spec.speed > 0;
  }
  findClimb(t) {
    const W = G.world;
    const cl = W.colliders;
    const ty = footY(t);
    const fy = footY(this);
    const dx = t.pos.x - this.pos.x;
    const dz = t.pos.z - this.pos.z;
    const d = hypot(dx, dz);
    if (d < 0.3) return null;
    const ux = dx / d;
    const uz = dz / d;
    const room = (this.height || 1.8) + 0.1;
    let px = this.pos.x;
    let pz = this.pos.z;
    for (let s = 0.25; s <= d + 0.01; s += 0.25) {
      const x = this.pos.x + ux * s;
      const z = this.pos.z + uz * s;
      const top = W.groundAt(x, z, ty + 0.6);
      if (top > fy + CLIMB_MIN && Math.abs(top - ty) < 0.8) {
        // land a stride in from the lip, where the target's own floor carries on
        const k = Math.min(0.6, d - s);
        const lx = x + ux * k;
        const lz = z + uz * k;
        const ly = W.groundAt(lx, lz, ty + 0.6);
        if (!(Math.abs(ly - top) < 0.4)) return null;
        if (cl.raycast(lx, ly + 0.05, lz, 0, 1, 0, room) < room) return null; // no room to stand
        if (ly - fy > CLIMB_MAX) return null;
        // the face must be open above the foot of the climb (not a floor or an eave overhead)
        const rise = ly - fy;
        if (cl.raycast(px, fy + 0.6, pz, 0, 1, 0, rise) < rise - 0.1) return null;
        return { wx: px, wz: pz, x: lx, y: ly, z: lz, wallD: s };
      }
      // anything solid at chest height short of the lip is the wall we climb; keep the last
      // open point before it
      if (cl.raycast(x, fy + 1.0, z, ux, 0, uz, 0.3) >= 0.3) {
        px = x;
        pz = z;
      }
    }
    return null;
  }
  startClimb(c) {
    const fy = this.pos.y;
    const up = Math.max(0.45, (c.y - fy) / CLIMB_SPEED);
    this.climb = { ax: this.pos.x, ay: fy, az: this.pos.z, ...c, t: 0, up, over: 0.3 };
    this.vel.set(0, 0, 0);
    this.blocking = false;
    this.yaw = Math.atan2(c.x - this.pos.x, c.z - this.pos.z);
    G.audio?.play('jump', { pos: this.pos, vol: 0.45 });
  }
  updateClimb(dt) {
    const c = this.climb;
    c.t += dt;
    if (c.t < c.up) {
      // up the face, pressed against it
      const k = c.t / c.up;
      this.pos.set(c.ax + (c.wx - c.ax) * Math.min(1, k * 3), c.ay + (c.y + 0.05 - c.ay) * k, c.az + (c.wz - c.az) * Math.min(1, k * 3));
    } else {
      // over the lip
      const k = Math.min(1, (c.t - c.up) / c.over);
      this.pos.set(c.wx + (c.x - c.wx) * k, c.y + 0.05, c.wz + (c.z - c.wz) * k);
      if (k >= 1) {
        this.climb = null;
        this.vel.set(0, 0, 0);
        this.fallStart = this.pos.y;
        if (this.ai) this.ai.aboveT = 0;
      }
    }
    if (this.model && this.model.root) this.model.root.position.copy(this.pos);
    this.syncModel(dt, { speed: 0, grounded: false, vy: CLIMB_SPEED, flinch: 0, runSpeed: this.spec.speed * 1.2 });
  }
  // Called each step while chasing a target: true when the climb (or the wait for one) has the
  // move this step.
  chaseAbove(t, dt, tdist) {
    const ai = this.ai;
    const dy = footY(t) - footY(this);
    const above = t.grounded && !t.climbing && !t.zip && dy > CLIMB_MIN && tdist < 12;
    if (!above) {
      ai.aboveT = 0;
      ai.climbTo = null;
      if (this.evading) this.endEvade();
      return false;
    }
    ai.aboveT = (ai.aboveT || 0) + dt;
    // stalled: no nearer for a while (a route round by a stair keeps closing in, so it is left be)
    const gap = tdist + dy;
    if (!(ai.aboveBest < Infinity) || ai.aboveT <= dt || gap < ai.aboveBest - 0.5) {
      ai.aboveBest = gap;
      ai.aboveStall = 0;
    } else ai.aboveStall = (ai.aboveStall || 0) + dt;
    if (ai.aboveStall < 1.2 && !ai.climbTo) return false;
    if (this.canClimb()) {
      if (!ai.climbTo || ai.climbCheck <= G.time) {
        ai.climbTo = this.findClimb(t);
        ai.climbCheck = G.time + 0.5;
      }
      const c = ai.climbTo;
      if (c) {
        if (this.evading) this.endEvade();
        if (hypot(c.wx - this.pos.x, c.wz - this.pos.z) < 1.1 + this.radius) {
          ai.climbTo = null;
          this.startClimb(c);
        } else this.navTo(c.wx, c.wz, NaN, this.spec.speed * this.speedMul, dt);
        return true;
      }
    }
    // nowhere to climb: wait it out below, untouchable and recovering
    if (ai.aboveStall > 3 && !this.evading) this.startEvade();
    return false;
  }
  startEvade() {
    this.evading = true;
    this.invuln = true;
    if (this.target === G.player && G.ui && (!G.ui._evadeToastAt || G.time - G.ui._evadeToastAt > 30)) {
      G.ui._evadeToastAt = G.time;
      G.ui.toast(`The ${this.spec.name || 'foe'} can't reach you up there, and won't take wounds until you come down.`, 'bad');
    }
    if (G.vfx && G.vfx.ring) G.vfx.ring(this.pos, 'support', 1.6, 0.5, { color: '#cfd6e0' });
  }
  endEvade() {
    this.evading = false;
    this.invuln = false;
  }

  update(dt) {
    if (this.netProxy) return this.proxyUpdate(dt);
    const s = this.spec;
    const ai = this.ai;
    for (const k in ai.cds) ai.cds[k] -= dt;
    if (this.atk && this.atk.feintAt !== undefined && this.atk.phase === 'windup' && this.atk.t >= this.atk.feintAt && !this.stunned) this.doFeint();
    if (this.atk && this.atk.holdFor) this.atk.hold = (this.atk.held || 0) < this.atk.holdFor;
    this.baseUpdate(dt);
    if (this.regenLock > 0) this.regenLock -= dt;

    if (this.dead) {
      this.halt(dt);
      this.physics(dt);
      this.syncModel(dt, { dead: true });
      if (this.trail) this.trail.stop();
      return;
    }
    if (this.knocked) {
      this.knockedT += dt;
      this.halt(dt);
      this.physics(dt);
      this.syncModel(dt, { knocked: true });
      if (this.knockedT > 10) this.die(this.killer);
      return;
    }
    if (this.dummy) {
      this.hp = Math.min(this.maxHp, this.hp + dt * 80);
      this.physics(dt);
      this.syncModel(dt, { flinch: this.flinch, grounded: true });
      return;
    }

    if (this.provoked.size) for (const [who, t] of this.provoked) if (t - dt <= 0) this.provoked.delete(who); else this.provoked.set(who, t - dt);
    const p = this.pickTarget();
    const dist = p ? hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 999;
    const dy = p ? Math.abs(p.pos.y - this.pos.y) : 0;
    const sameRealm = p && (p.pos.x > 3000) === (this.pos.x > 3000);
    // boss bar for the local player even when someone else pulled it
    if (this.boss && this.aggro && G.player && G.game.bossActive !== this && G.player.pos.distanceTo(this.pos) < 60) G.game.startBoss(this);

    // perception
    // a rider in a moving lift cage (world/ascentLifts.js, meridianLift.js) is not noticed until it docks
    if (!this.aggro && p && sameRealm && !p.dead && !p.knocked && !(p.liftRideUntil > (G.time || 0))) {
      let range = s.aggro * (1 - ((p.mods && p.mods.stealth) || 0));
      if (p.stealth > 0) range *= 0.15;
      if (G.world.sky.isNight() && p.team === 'player') range *= 0.8;
      if (this.statuses.blind) range = Math.min(range, COMBAT.blind.perception);
      if (dist < range && dy < 12) this.setAggro(p);
    }
    if (this.aggro) {
      const leash = s.leash || 45;
      const fromHome = this.pos.distanceTo(this.home);
      if (!p || p.dead || !sameRealm || dist > leash * 1.6 || (fromHome > leash && dist > 12) || (p.boat && !this.aquatic)) this.dropAggro();
    }
    this.target = this.aggro ? p : null;
    if (this.climb) {
      if (this.stunned || this.dead) this.climb = null;
      else return this.updateClimb(dt);
    }
    if (this.evading) {
      // untouchable below a perch it can't climb: recover while waiting
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.12 * dt);
      this.posture = Math.max(0, this.posture - dt * 30);
      if (!this.target) this.endEvade();
    }

    let speed = 0;
    if (this.stunned) {
      this.blocking = false;
      this.halt(dt);
    } else if (this.atk) {
      if (!(this.atk.def.lunge && this.atk.phase !== 'windup') && !this.leapVel) this.halt(dt);
    } else if (this.target) {
      const t = this.target;
      // grip a knocked player
      if (t.knocked) {
        if (dist > 2) {
          speed = s.speed * this.speedMul;
          this.navTo(t.pos.x, t.pos.z, footY(t), speed, dt);
        } else {
          this.halt(dt);
          ai.gripT += dt;
          if (ai.gripT === dt) {
            this.yaw = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
            if (this.model.anim) this.model.anim.play('grip', { windup: 0.6, active: 0.2, recovery: 0.5 });
            else this.model.play('bite', { windup: 0.6, active: 0.2, recovery: 0.5 });
            if (G.net) G.net.enemyAnim(this, 'grip');
          }
          if (ai.gripT > 0.8) {
            if (t.getGripped) t.getGripped(this); // players (local or LAN friend)
            else if (t.finish) t.finish(this); // e.g. a monster executing a knocked guard
            ai.gripT = 0;
          }
        }
      } else {
        ai.gripT = 0;
        this.react(dt, dist);
        ai.atkCd -= dt;
        // where it fights: its foe, or while blind, the place it last saw it (COMBAT.blind)
        if (!this.statuses.blind || dist <= COMBAT.blind.perception) {
          ai.seenX = t.pos.x;
          ai.seenZ = t.pos.z;
        }
        const tx = ai.seenX;
        const tz = ai.seenZ;
        const tdist = hypot(tx - this.pos.x, tz - this.pos.z);
        const body = this.radius + (this.spec.meleePad || 0) + (t.radius || 0.4);
        // overlapping a target is not a waiting stance
        if (tdist < body + 0.2 && ai.atkCd > 0.28) ai.atkCd = 0.28;
        // punish a target that is healing, eating or casting right in front of us
        const busy = t.eatT > 0 || (t.atk && t.atk.def && t.atk.def.type === 'cast' && t.atk.phase !== 'recovery');
        if (busy && tdist < 7 && ai.atkCd > 0.12 && !this.atk) ai.atkCd = 0.12;
        const reach = this.weaponDef ? this.weaponReach() : Math.max(...(s.attacks || [{ range: 2 }]).map((a) => a.range || a.radius || 2));
        const prefer = Math.max(this.weaponDef ? reach * 0.75 : Math.min(reach, 2.4) * 0.85, body);
        const role = s.role || 'melee';
        // out of reach above: climb up after it, or wait untouchable (chaseAbove)
        if (role !== 'ranged' && !this.atk && this.chaseAbove(t, dt, tdist)) {
          this.physics(dt);
          this.syncModel(dt, { speed: hypot(this.vel.x, this.vel.z), grounded: this.grounded, swimming: this.swimming, blocking: false, stunned: false, vy: this.vel.y, flinch: this.flinch, runSpeed: s.speed * 1.2 });
          return;
        }
        // badly hurt: fall back a moment and call the others in (entities/tactics.js)
        if (!ai.fled && fallsBack(this) && this.hp < this.maxHp * TACTICS.retreatAt) {
          ai.fled = true;
          ai.retreatUntil = G.time + TACTICS.retreatFor;
          yieldTurn(this, t, G.time, true);
          callForHelp(this, t);
          G.audio.play('roar', { pos: this.pos, pitch: 1.5, vol: 0.5 });
          if (G.net && G.net.isHost) G.net.enemyAnim(this, 'call');
        }
        const retreating = ai.retreatUntil > G.time;
        // melee foes take turns pressing one target; the rest circle and wait
        const pressing = !retreating && mayPress(this, t, G.time);
        const keeps = role === 'ranged' || role === 'support';
        // a skirmisher waits for its target to look away before it commits (or 1.5 s)
        if (role === 'skirmisher' && pressing && ai.flankFrom === undefined) ai.flankFrom = G.time;
        const skirmishReady = role !== 'skirmisher' || !guardCovers(t, this.pos) || G.time - (ai.flankFrom ?? G.time) > 1.5;
        if (ai.atkCd <= 0 && !this.blocking && dy < 4 && !retreating && (pressing || keeps) && skirmishReady) {
          let swinging = 0;
          if (!this.boss) {
            for (const a of G.actors) {
              if (a !== this && a.team === 'enemy' && a.atk && a.target === t && a.atk.phase !== 'recovery') swinging++;
            }
          }
          const def = swinging >= 2 ? null : (role === 'support' && this.supportAction()) || this.chooseAttack(tdist);
          if (def) {
            if (!def.ally) this.yaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
            this.startAttack(def);
            ai.flankFrom = undefined;
          } else ai.atkCd = swinging >= 2 ? 0.35 : 0.25;
        }
        if (!this.atk) {
          const want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
          if (!(this.nav && this.nav.path && G.time - this.nav.last < 0.1)) {
            const ny = dampAngle(this.yaw, want, 7, dt);
            // a raised guard turns no faster than COMBAT.ai.guardTurn, so a flank can be taken
            if (this.blocking || this.parryT > 0) {
              const m = COMBAT.ai.guardTurn * dt;
              this.yaw += clamp(angleDiff(this.yaw, ny), -m, m);
            } else this.yaw = ny;
          }
          const away = (k) => {
            const d = tdist || 1;
            return [this.pos.x + ((this.pos.x - tx) / d) * k, this.pos.z + ((this.pos.z - tz) / d) * k];
          };
          const other = pressing && takesTurns(this) ? partner(this, t) : null;
          if (retreating) {
            // falling back: away from the foe, on its feet
            speed = s.speed * 0.9;
            const [ax, az] = away(6);
            this.navTo(ax, az, NaN, speed, dt, false);
          } else if (keeps && tdist < s.keep[0]) {
            // ranged and support foes keep back from the fight
            speed = s.speed * 0.8;
            const [ax, az] = away(4);
            this.navTo(ax, az, NaN, speed, dt, false);
          } else if (keeps && tdist > s.keep[1]) {
            speed = s.speed * this.speedMul;
            this.navTo(tx, tz, footY(t), speed, dt, false);
          } else if (keeps) {
            // in its band: side-step, keeping its aim
            ai.strafeT -= dt;
            if (ai.strafeT <= 0) {
              ai.strafe *= -1;
              ai.strafeT = rand(1.2, 2.5);
            }
            const f = forwardFromYaw(this.yaw, _w);
            speed = s.speed * 0.45;
            this.moveToward(this.pos.x - f.z * ai.strafe * 2, this.pos.z + f.x * ai.strafe * 2, speed, dt, false);
          } else if (!pressing && !keeps) {
            // waiting for a turn: circle at the edge of the fight
            const hr = TACTICS.holdRadius;
            if (tdist < hr - 1) {
              speed = s.speed * 0.6;
              this.moveToward(...away(3), speed, dt, false);
            } else if (tdist > hr + 1.5) {
              speed = s.speed * this.speedMul;
              this.navTo(tx, tz, footY(t), speed, dt, false);
            } else {
              ai.strafeT -= dt;
              if (ai.strafeT <= 0) {
                ai.strafe *= -1;
                ai.strafeT = rand(1.5, 3);
              }
              const f = forwardFromYaw(this.yaw, _w);
              speed = s.speed * 0.4;
              this.moveToward(this.pos.x - f.z * ai.strafe * 2, this.pos.z + f.x * ai.strafe * 2, speed, dt, false);
            }
          } else if (other && tdist > prefer + 0.6 && hypot(other.pos.x - tx, other.pos.z - tz) < reach + 2) {
            // a second presser comes in off the first one's line: a flank
            const [fx, fz] = flankPoint(this, t, other, prefer);
            speed = s.speed * this.speedMul;
            this.navTo(fx, fz, footY(t), speed, dt, false);
          } else if (role === 'skirmisher' && !skirmishReady && tdist < prefer + 2.5) {
            // circle toward the target's back before committing
            const f = forwardFromYaw(this.yaw, _w);
            speed = s.speed * 0.75;
            this.moveToward(this.pos.x - f.z * ai.strafe * 2, this.pos.z + f.x * ai.strafe * 2, speed, dt, false);
          } else if (tdist < body + 0.15 && !this.boss) {
            speed = s.speed * 0.9;
            this.moveToward(this.pos.x - (tx - this.pos.x), this.pos.z - (tz - this.pos.z), speed, dt, false);
          } else if (tdist > prefer + 0.6) {
            speed = s.speed * this.speedMul * (this.blocking ? 0.5 : 1) * (tdist > 10 ? 1.15 : 1);
            this.navTo(tx, tz, footY(t), speed, dt, false);
          } else if (tdist < Math.max(prefer - 0.35, body + 0.25) && !this.boss) {
            speed = s.speed * 0.55;
            this.moveToward(this.pos.x - (tx - this.pos.x), this.pos.z - (tz - this.pos.z), speed, dt, false);
          } else {
            // strafe while waiting
            ai.strafeT -= dt;
            if (ai.strafeT <= 0) {
              ai.strafe *= -1;
              ai.strafeT = rand(1, 2.5);
            }
            const f = forwardFromYaw(this.yaw, _w);
            speed = s.speed * 0.35;
            this.moveToward(this.pos.x - f.z * ai.strafe * 2, this.pos.z + f.x * ai.strafe * 2, speed, dt, false);
          }
        }
      }
    } else if (this.team === 'guard') {
      this.blocking = false;
      ai.state = 'idle';
      speed = this.guardIdle(dt);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.08 * dt);
      this.posture = Math.max(0, this.posture - dt * 20);
    } else {
      // idle / return / wander
      this.blocking = false;
      const fromHome = this.pos.distanceTo(this.home);
      if (ai.state === 'return' && fromHome > 2) {
        speed = s.speed;
        this.navTo(this.home.x, this.home.z, this.home.y, speed, dt);
        if (!(this.regenLock > 0)) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04 * dt);
      } else {
        ai.state = 'idle';
        if (s.roam) speed = this.roamIdle(dt);
        else {
          ai.wanderT -= dt;
          if (ai.wanderT <= 0) {
            ai.wanderT = rand(3, 7);
            // a guard posted to a floor (the Ascent's landings) holds its post: a wander there
            // steps off the edge
            const posted = this.spawner && this.spawner.def.y != null;
            ai.wanderTo = !posted && chance(0.6) && s.speed > 0 ? this.home.clone().add(new THREE.Vector3(rand(-7, 7), 0, rand(-7, 7))) : null;
          }
          if (ai.wanderTo && this.pos.distanceTo(ai.wanderTo) > 1) {
            speed = s.speed * 0.4;
            this.moveToward(ai.wanderTo.x, ai.wanderTo.z, speed, dt);
          } else this.halt(dt);
        }
        if (!(this.regenLock > 0)) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.015 * dt);
        this.posture = Math.max(0, this.posture - dt * 20);
      }
    }

    this.physics(dt);
    if (this.swimming && !this.aquatic) {
      // non-swimmers flounder back to shore
      this.vel.x *= 0.5;
      this.vel.z *= 0.5;
      this.moveToward(this.home.x, this.home.z, 3, dt);
    }
    const hs = hypot(this.vel.x, this.vel.z);
    this.syncModel(dt, {
      speed: hs, grounded: this.grounded || !!this.flying, swimming: this.swimming, blocking: this.blocking, stunned: this.stunned,
      vy: this.vel.y, flinch: this.flinch, runSpeed: s.speed * 1.2,
    });
  }
}

export { applyHit };
