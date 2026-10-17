// Hit resolution: parry, block/posture, guard break, damage, ailments and feedback.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { AudioSys } from '../core/audio.js';
import { ACTIONS } from '../game/hooks.js';
import { WEAPON_CLASSES } from '../data/weapons.js';
import { angleDiff, clamp } from '../core/util.js';
import { COMBAT, resolveDefense, guardCovers, guardPostureMul, canLaunch } from './rules.js';
import { traitDamageMul, traitOnHit, traitOnGuardBreak, traitOnParry, traitBlockMul } from './weaponTraits.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const DEFENSE_CTX = {
  frontal: (tgt, from) => isFrontal(tgt, from),
  guard: (tgt, from) => guardCovers(tgt, from),
  edge: (tgt, from) => guardPostureMul(tgt, from) > 1,
};

// Targeting rule (not a hit-landing rule: the LAN host applies friends' hits separately).
// Only `direct` weapon swings can provoke a calm guard; spells, area effects and projectiles
// pass through guards that are not already fighting the attacker.
export function hostile(a, b, direct = false) {
  if (!a || !b || a === b) return false;
  if (a.team === 'npc' || b.team === 'npc') return false;
  if (a.team === b.team) return false;
  // one faction is one side: the Enclave's wardens and its garrison never strike each other
  const fa = (a.owner || a).faction;
  if (fa && fa === (b.owner || b).faction) return false;
  if (a.team === 'guard' && b.team === 'player') {
    const g = a.owner || a;
    return !!(g.hostileTo && g.hostileTo(b));
  }
  if (!direct && a.team === 'player' && b.team === 'guard') return !!(b.hostileTo && b.hostileTo(a.owner || a));
  return true;
}

export function actorsNear(pos, r, filter = null) {
  const out = [];
  for (const a of G.actors) {
    if (a.dead) continue;
    const dx = a.pos.x - pos.x;
    const dz = a.pos.z - pos.z;
    if (dx * dx + dz * dz > (r + a.radius) * (r + a.radius)) continue;
    if (Math.abs(a.pos.y + a.height * 0.5 - pos.y) > r + a.height) continue;
    if (filter && !filter(a)) continue;
    out.push(a);
  }
  return out;
}

// Collision radius plus any extra body length (a mudlurker is much longer than it is wide).
export function bodyRadius(a) {
  return (a.radius || 0) + (a.meleePad || (a.spec && a.spec.meleePad) || 0);
}

export function meleeTargets(att, range, arcDeg, vertical = 2.6) {
  const out = [];
  const half = ((arcDeg || 90) * Math.PI) / 360;
  for (const t of G.actors) {
    if (t === att || t.dead || !hostile(att, t, true)) continue;
    if (t.knocked && !att.canHitKnocked) continue;
    const dx = t.pos.x - att.pos.x;
    const dz = t.pos.z - att.pos.z;
    const d = Math.hypot(dx, dz);
    const pad = bodyRadius(t) - (t.radius || 0);
    if (d > range + bodyRadius(t)) continue;
    const dy = t.pos.y - att.pos.y;
    if (dy > vertical || dy < -vertical - t.height * 0.5) continue;
    if (d > 0.6 && half < Math.PI) {
      const ang = Math.abs(angleDiff(att.yaw, Math.atan2(dx, dz)));
      const slack = Math.atan2(t.radius + pad, d);
      if (ang > half + slack) continue;
    }
    out.push(t);
  }
  return out;
}

export function isFrontal(target, fromPos, arc = 1.85) {
  const want = Math.atan2(fromPos.x - target.pos.x, fromPos.z - target.pos.z);
  return Math.abs(angleDiff(target.yaw, want)) < arc;
}

// h: { dmg, posture, element, unparryable, unblockable, knockback, launch, status[],
//      kind: 'melee'|'proj'|'mantra'|'aoe', from (Vector3), projectile, crit, sanity, noInterrupt }
export function applyHit(att, tgt, h) {
  if (!tgt || tgt.dead || tgt.invuln) return 'none';
  if (!h.fromNet) {
    // LAN co-op authority: replicas never deal damage themselves
    if (att && (att.isRemote || att.netProxy)) return 'none';
    if (tgt.knocked && !h.finisher) return 'none';
    // our hit on a host-owned enemy: the host applies it and replies with the outcome
    if (tgt.netProxy) {
      if (G.net && G.net.isGuest) G.net.sendHit(att, tgt, h);
      return 'sent';
    }
    // a host enemy hit another player: their game resolves parry/block/dodge
    if (tgt.isRemote) {
      if (G.net && G.net.isHost) G.net.forwardHit(att, tgt, h);
      return 'remote';
    }
  }
  // the defense decision (combat/rules.js), then its effects
  const from = h.from || att.pos;
  const { result, frontal, backstab, edge } = resolveDefense(att, tgt, h, DEFENSE_CTX);
  if (result === 'void') return 'none';
  if (result === 'evaded') {
    tgt.onEvade && tgt.onEvade(att, h);
    return 'evaded';
  }
  if (result === 'dispel') {
    tgt.dispel && tgt.dispel();
    return 'none';
  }
  const center = tgt.center(_a);
  const dir = _b.set(tgt.pos.x - from.x, 0, tgt.pos.z - from.z);
  if (dir.lengthSq() < 1e-6) dir.set(Math.sin(att.yaw), 0, Math.cos(att.yaw));
  dir.normalize();
  const isPlayerInvolved = att === G.player || tgt === G.player;

  // ------------- PARRY
  if (result === 'parried') {
    tgt.parryT = 0;
    tgt.parryCd = COMBAT.parry.successCooldown;
    const p = center.clone().addScaledVector(dir, -0.4);
    G.vfx.sparks(p, dir.clone().negate(), '#fff2c0', 24);
    G.vfx.sphereFlash(p, 'phys', 0.8, 0.18, { color: '#fff6d8' });
    G.vfx.flashLight(p, '#fff2c0', 9, 0.2);
    G.audio.play('parry', { pos: tgt.pos, cls: AudioSys.weaponCls(att) });
    if (isPlayerInvolved) {
      G.vfx.addShake(0.28);
      G.vfx.hitStop(0.1);
    }
    if (h.projectile) {
      // a reflecting talent, or Arc Ward's moment of perfect parries, sends it back
      h.projectile.deflect(tgt, !!(tgt.mods && tgt.mods.reflect) || tgt.autoParryT > 0);
    } else if (h.kind === 'melee' && !h.proj) {
      att.getParried && att.getParried(tgt, h);
      traitOnParry(tgt, att, h); // the defender's weapon answers the parried blow
    }
    tgt.onParry && tgt.onParry(att, h);
    return 'parried';
  }

  // ------------- BLOCK
  if (result === 'blocked') {
    let pd = (h.posture ?? 10) * (1 - ((tgt.mods && tgt.mods.blockPosture) || 0));
    if (h.kind !== 'melee') pd *= 0.8;
    if (edge) pd *= COMBAT.guard.edgePosture; // caught on the rim of the guard
    pd *= traitBlockMul(tgt);
    if (h.projectile && tgt.mods && tgt.mods.arcBlock) pd = 0; // Arcwarder: a blocked projectile costs nothing
    const am = att.mods || {};
    // Bull Rush: a running attack bullies through a guard
    if (h.running && am.bullRush) {
      pd *= 1.5;
      tgt.applyKnockback(dir, 6);
    }
    // Crushing Blows: a critical on a guard past half its posture breaks it outright
    if (h.crit && am.crushingBlows && tgt.posture > tgt.maxPosture * 0.5) pd = Math.max(pd, tgt.maxPosture);
    const p = center.clone().addScaledVector(dir, -0.4);
    G.vfx.sparks(p, dir.clone().negate(), '#ffd27a', 8);
    G.audio.play('block', { pos: tgt.pos, cls: AudioSys.weaponCls(att) });
    tgt.applyKnockback(dir, 2.5);
    tgt.reactAnim && tgt.reactAnim('blockRecoil', h.heavy ? 1.6 : 1);
    let chip = 0;
    if (h.element && h.element !== 'phys') chip = h.dmg * 0.2;
    else if (h.chip > 0) chip = h.dmg * h.chip; // a heavy or edged weapon bites through the guard
    if (tgt.mods && tgt.mods.bulwark) chip = 0; // Bulwark: nothing gets through
    if (chip > 0) damage(att, tgt, chip, h.element || 'phys', h, true);
    if (h.projectile) h.projectile.kill();
    const broke = tgt.addPosture(pd, att);
    if (broke) {
      traitOnGuardBreak(att, tgt, h);
      if (am.boneCrusher) tgt.stunT += 0.4; // Bone Crusher
    }
    tgt.onBlock && tgt.onBlock(att, h, broke);
    if (isPlayerInvolved) {
      G.vfx.addShake(broke ? 0.45 : 0.1);
      if (broke) G.vfx.hitStop(0.11);
    }
    return broke ? 'guardbreak' : 'blocked';
  }

  // ------------- HIT
  let dmg = h.dmg;
  if (att.mods) {
    if (att.mods.exploit && (tgt.stunT > 0 || tgt.guardBroken)) dmg *= 1.3;
  }
  if (tgt.statuses.freeze && att.mods && att.mods.shatterpoint) {
    dmg *= 1.4;
    tgt.clearStatus('freeze');
  }
  if (tgt.frontArmor && frontal && (h.element || 'phys') === 'phys') dmg *= 1 - tgt.frontArmor;
  if (h.mantra && h.element === 'ember' && att.mods && att.mods.ignition && tgt.statuses.burn) dmg *= 1.2;
  if (backstab) dmg *= 1.35;
  dmg *= traitDamageMul(att, tgt, h, { frontal });
  dmg *= talentDamageMul(att, tgt, h);
  const wasFrozen = !!tgt.statuses.freeze;
  const dealt = damage(att, tgt, dmg, h.element || 'phys', h, false);
  // Glacial Core: striking a frozen foe spreads the cold to those around it
  if (wasFrozen && att.mods && att.mods.glacialCore) {
    for (const a of actorsNear(tgt.pos, 3, (x) => x !== tgt && hostile(att, x))) a.applyStatus('chill', 1, att);
  }

  if (h.posture) tgt.addPosture(h.posture * 0.35, att);
  if (h.status) for (const s of h.status) if (s) tgt.applyStatus(s, h.statusPower || 1, att);
  traitOnHit(att, tgt, Object.assign(h, { dmg }), TRAIT_DEPS);
  if (h.sanity && tgt.addSanity) tgt.addSanity(-h.sanity);

  // feedback
  const el = h.element || 'phys';
  tgt.hitFlash(el);
  if (el === 'phys') {
    if (!tgt.construct) G.vfx.blood(center, dir, h.crit ? 16 : 8);
    G.vfx.sparks(center, dir, '#ffffff', h.crit ? 10 : 5);
  } else G.vfx.burst(center, el, 14, { speed: 6 });
  G.audio.play(h.heavy || h.crit ? 'hitHeavy' : 'hit', { pos: tgt.pos, pitch: tgt.construct ? 0.7 : 1, cls: AudioSys.weaponCls(att) });
  G.vfx.number(center, dealt, tgt === G.player ? 'taken' : h.crit ? 'crit' : el === 'phys' ? 'dmg' : 'el-' + el);
  if (isPlayerInvolved) {
    // weighted by the weapon: a dagger's hit barely pauses the fight, a maul's lands hard
    const wt = WEIGHT_FEEL[weaponType(att)] || WEIGHT_FEEL.medium;
    G.vfx.addShake(tgt === G.player ? 0.32 : h.crit ? 0.3 : wt.shake);
    if (att === G.player && h.kind === 'melee') {
      G.vfx.hitStop(Math.min(0.12, wt.stop + (h.crit ? 0.025 : 0)));
      G.ui && G.ui.flashCrosshair && G.ui.flashCrosshair();
    }
  }

  if (!tgt.dead && !tgt.knocked) {
    if (!h.noInterrupt) tgt.interrupt(h.stun || (h.heavy ? 0.45 : 0.3));
    // a player's blows lift only light and medium foes (combat/rules.js canLaunch)
    let lift = h.launch && (att.team !== 'player' || canLaunch(tgt)) ? h.launch : 0;
    if (lift && tgt.launched && tgt.launchAir > COMBAT.launch.maxAir) lift = 0; // kept up long enough
    if (h.knockback) tgt.applyKnockback(dir, h.knockback, lift);
    else if (lift) tgt.applyKnockback(dir, h.launcher ? 0.4 : 1, lift);
    else tgt.applyKnockback(dir, 1.6);
    if (lift && tgt.liftOff && canLaunch(tgt)) tgt.liftOff(lift, att);
    // the air string's closing slam drives an airborne foe into the ground
    if (h.spike && !tgt.grounded && canLaunch(tgt)) {
      tgt.vel.y = Math.min(tgt.vel.y, -h.spike);
      tgt.spiked = true;
    }
  }
  att.onDealtHit && att.onDealtHit(tgt, dealt, h);
  return 'hit';
}

// Hit-stop and camera shake for a player's landed blow, by the weight of the weapon's class.
const WEIGHT_FEEL = { light: { stop: 0.045, shake: 0.08 }, medium: { stop: 0.065, shake: 0.12 }, heavy: { stop: 0.095, shake: 0.2 } };
function weaponType(att) {
  const w = att && (att.weaponDef || (att.weaponItemDef && att.weaponItemDef()));
  const c = w && WEAPON_CLASSES[w.cls];
  return c ? c.type : 'medium';
}

// Talent multipliers on a landed blow that read the moment (data/talents.js; each tested).
function talentDamageMul(att, tgt, h) {
  const am = (att && att.mods) || {};
  const tm = tgt.mods || {};
  let m = 1;
  const s = tgt.statuses || {};
  // Arcane Mastery: a mantra on a foe already suffering an ailment
  if (h.mantra && am.arcaneMastery && (s.burn || s.chill || s.freeze || s.shock || s.bleed || s.blind)) m *= 1.2;
  // Conductor: Stormcall in the rain
  if (h.mantra && h.element === 'storm' && am.conductor) {
    const w = ACTIONS.weatherState && ACTIONS.weatherState();
    if (w && w.rain > 0.2) m *= 1.15;
  }
  // Shroud: the first blow on a foe that has not noticed you
  if (am.shroud && att.team === 'player' && tgt.team !== 'player' && tgt.aggro === false) m *= 1.4;
  // Windrunner: projectiles find a sprinter less often
  if (h.projectile && tm.windrunner && tgt.sprinting) m *= 0.7;
  // Tacet (resonance): a blow on a foe whose eyes are on someone else
  if (am.tacet && tgt.team !== 'player' && tgt.target !== att) m *= 1.15;
  return m;
}

// Raw damage application with resistances. Returns damage dealt.
export function damage(att, tgt, amount, element, h = {}, chip = false) {
  if (tgt.dead || tgt.knocked) return 0;
  let res = element === 'phys' ? tgt.resist.phys || 0 : tgt.resist[element] || 0;
  if (tgt.armorBuff) res += tgt.armorBuff;
  if (element === 'phys' && h.pen > 0 && res > 0) res *= 1 - h.pen; // a piercing weapon finds the gaps
  res = clamp(res, -0.5, 0.9);
  let dmg = amount * (1 - res);
  if (tgt.mods && tgt.mods.dmgTaken) dmg *= 1 + tgt.mods.dmgTaken;
  if (tgt.mods && tgt.mods.lastBastion && tgt.hp < tgt.maxHp * 0.3) dmg *= 0.8;
  if (tgt.dmgTakenMul) dmg *= tgt.dmgTakenMul;
  dmg = Math.max(chip ? 0 : 1, dmg);
  if (tgt.undyingCheck && tgt.hp - dmg <= 0 && tgt.undyingCheck()) dmg = tgt.hp - 1;
  tgt.hp -= dmg;
  tgt.lastAttacker = att;
  tgt.onDamaged && tgt.onDamaged(att, dmg, element, h);
  if (tgt.hp <= 0) {
    tgt.hp = 0;
    tgt.onLethal(att);
  }
  return dmg;
}

// Area hit helper used by mantras / creature AoEs.
export function areaHit(att, center, radius, hFn, opts = {}) {
  const hits = [];
  for (const t of G.actors) {
    if (t.dead || !hostile(att, t)) continue;
    const dx = t.pos.x - center.x;
    const dz = t.pos.z - center.z;
    const d = Math.hypot(dx, dz);
    if (d > radius + t.radius) continue;
    if (Math.abs(t.pos.y - center.y) > (opts.vertical ?? 4)) continue;
    const h = hFn(t, d);
    if (!h) continue; // the caller has already struck this one
    h.from = h.from || center;
    const r = applyHit(att, t, h);
    hits.push([t, r]);
  }
  return hits;
}

// Hit feedback for a result reported by the LAN host (guest side).
export function netHitFeedback(att, tgt, res, dealt, h) {
  if (!tgt || !tgt.center) return;
  const center = tgt.center(_a).clone();
  const dir = _b.set(tgt.pos.x - att.pos.x, 0, tgt.pos.z - att.pos.z);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize();
  const el = h.element || 'phys';
  const cls = AudioSys.weaponCls(att);
  if (res === 'parried') {
    const p = center.clone().addScaledVector(dir, -0.4);
    G.vfx.sparks(p, dir.clone().negate(), '#fff2c0', 24);
    G.vfx.sphereFlash(p, 'phys', 0.8, 0.18, { color: '#fff6d8' });
    G.audio.play('parry', { pos: tgt.pos, cls });
    G.vfx.addShake(0.25);
  } else if (res === 'blocked' || res === 'guardbreak') {
    G.vfx.sparks(center.clone().addScaledVector(dir, -0.4), dir.clone().negate(), '#ffd27a', 8);
    G.audio.play(res === 'guardbreak' ? 'guardbreak' : 'block', { pos: tgt.pos, cls });
    tgt.reactAnim && tgt.reactAnim(res === 'guardbreak' ? 'guardBroken' : 'blockRecoil');
    if (res === 'guardbreak') G.vfx.ring(center, 'phys', 3, 0.5, { color: '#ffd27a', vertical: true, yaw: tgt.yaw });
  } else if (res === 'hit') {
    tgt.hitFlash(el);
    if (el === 'phys') {
      if (!tgt.construct) G.vfx.blood(center, dir, h.crit ? 16 : 8);
      G.vfx.sparks(center, dir, '#ffffff', h.crit ? 10 : 5);
    } else G.vfx.burst(center, el, 14, { speed: 6 });
    G.audio.play(h.heavy || h.crit ? 'hitHeavy' : 'hit', { pos: tgt.pos, pitch: tgt.construct ? 0.7 : 1, cls: AudioSys.weaponCls(att) });
    if (dealt > 0) G.vfx.number(center, dealt, h.crit ? 'crit' : el === 'phys' ? 'dmg' : 'el-' + el);
    G.vfx.addShake(h.crit || h.heavy ? 0.3 : 0.12);
    if (h.kind === 'melee') G.vfx.hitStop(h.crit || h.heavy ? 0.085 : 0.045);
  }
}

// What weapon traits may call back into (weaponTraits.js cannot import this module: it would be circular).
const TRAIT_DEPS = { damage, areaHit, applyHit, actorsNear, hostile };
