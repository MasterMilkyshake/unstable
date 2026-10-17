// Weapon traits: the one special property of a rare or named weapon (data/weapons.js
// WEAPON_TRAITS has the names and the text each card shows). Three places carry them:
//  - where a hit is resolved (applyHit, the host on LAN): traits that read the target's state or
//    act on it, for whoever wields the weapon unless the trait is `foes: false`;
//  - the wielder's own side (Player.buildHit, startCombo, onDealtHit): stacks and move shapes;
//  - kills (game/talentpowers.js KILL_HOOKS): rewards, which reach a LAN guest through its kill event.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { WEAPONS, WEAPON_TRAITS } from '../data/weapons.js';

const _v = new THREE.Vector3();

// The trait of the weapon an actor holds (players by their equipped item, enemies by their weapon).
export function wieldedTrait(a) {
  if (!a) return null;
  const w = a.weaponItemDef ? a.weaponItemDef() : a.weaponDef || (a.info && a.info.weapon && WEAPONS[a.info.weapon.id]) || null;
  return (w && w.trait) || null;
}

// Whether a trait works in this wielder's hands (some are the player's alone).
function active(id, wielder) {
  const t = WEAPON_TRAITS[id];
  return !!t && (t.foes !== false || (wielder && wielder.team === 'player'));
}

// Damage multiplier for a landed weapon blow that depends on the target's state. ctx.frontal: the
// blow came from in front.
export function traitDamageMul(att, tgt, h, ctx = {}) {
  const id = h.trait;
  if (!id || h.kind !== 'melee' || !active(id, att)) return 1;
  const s = tgt.statuses || {};
  switch (id) {
    case 'static':
      return s.shock ? 1.25 : 1;
    case 'rime_bite':
      return s.chill || s.freeze ? 1.15 : 1;
    case 'thin_air':
      return ctx.frontal === false ? 1.4 : 1;
    default:
      return 1;
  }
}

// After a weapon blow lands on `tgt`.
export function traitOnHit(att, tgt, h, deps) {
  const id = h.trait;
  if (!id || h.kind !== 'melee' || !active(id, att) || tgt.dead) return;
  const s = tgt.statuses || {};
  switch (id) {
    case 'undertow':
      if (s.bleed) tgt.applyStatus('bleed', 1, att);
      break;
    case 'kindling': {
      const k = att.traitState || (att.traitState = {});
      k.kindle = k.kindleOn === tgt ? (k.kindle || 0) + 1 : 1;
      k.kindleOn = tgt;
      if (k.kindle >= 4) {
        k.kindle = 0;
        tgt.applyStatus('burn', 1, att);
      }
      break;
    }
    case 'molten':
      if (s.burn) {
        deps.damage(att, tgt, 6, 'ember', { kind: 'aoe' }, false);
        G.vfx && G.vfx.burst(tgt.center(_v), 'ember', 10, { speed: 4 });
      }
      break;
    case 'rootgrip':
      if (h.running) tgt.stunT = Math.max(tgt.stunT, 0.7);
      break;
    case 'heart_ice':
      if (h.crit && s.chill) tgt.applyStatus('freeze', 1, att);
      break;
    case 'hollow_gaze':
      if (h.crit) tgt.applyStatus('blind', 1, att);
      break;
    case 'core_fire':
      if (h.crit) {
        const c = tgt.pos.clone();
        G.vfx && G.vfx.ring(c, 'ember', 3, 0.4);
        G.vfx && G.vfx.burst(tgt.center(_v), 'ember', 26, { speed: 7 });
        deps.areaHit(att, c, 3, (t) => (t === tgt ? null : { dmg: h.dmg * 0.35, posture: 6, element: 'ember', kind: 'aoe', status: ['burn'], from: c.clone() }));
      }
      break;
    case 'lightning_rod':
      if (h.crit) {
        const near = deps.actorsNear(tgt.pos, 6, (a) => a !== tgt && a !== att && !a.dead && deps.hostile(att, a)).sort((a, b) => a.pos.distanceToSquared(tgt.pos) - b.pos.distanceToSquared(tgt.pos));
        for (const a of near.slice(0, 2)) {
          G.vfx && G.vfx.bolt(tgt.center(), a.center(), 'storm');
          deps.applyHit(att, a, { dmg: h.dmg * 0.3, posture: 4, element: 'storm', kind: 'aoe', status: ['shock'], from: tgt.pos.clone() });
        }
      }
      break;
    default:
      break;
  }
}

// A blocked weapon blow broke the guard.
export function traitOnGuardBreak(att, tgt, h) {
  const id = h.trait;
  if (!id || h.kind !== 'melee' || !active(id, att)) return;
  if (id === 'shatterhead') tgt.stunT += 0.5;
  else if (id === 'old_king') {
    tgt.stunT += 0.6;
    const dir = _v.set(tgt.pos.x - att.pos.x, 0, tgt.pos.z - att.pos.z);
    if (dir.lengthSq() > 1e-6) tgt.applyKnockback(dir.normalize(), 7);
    tgt.flinch = 1;
  }
}

// Posture a block takes, scaled by the defender's own weapon.
export function traitBlockMul(defender) {
  return wieldedTrait(defender) === 'breakwater' ? 0.7 : 1;
}

// The defender parried `att`'s blow with its own weapon.
export function traitOnParry(defender, att, h) {
  const id = wieldedTrait(defender);
  if (!id || !active(id, defender) || !att || att.dead) return;
  if (id === 'bramble' && att.applyStatus) att.applyStatus('bleed', 2, defender);
  else if (id === 'discipline' && att.addPosture) att.addPosture((att.maxPosture * 0.1 + (h && h.posture ? h.posture * 0.9 : att.maxPosture * 0.08)) * 0.5, defender);
}

// Kill rewards (the local player only: game/talentpowers.js calls this from a kill hook).
export function traitOnKill(p) {
  const id = wieldedTrait(p);
  if (id === 'toll_of_souls') {
    p.ether += 10;
    p.addSanity(6);
  } else if (id === 'grave_toll') {
    p.ether += 8;
    p.heal(p.maxHp * 0.04);
  } else if (id === 'notch') p.addBuff('notch', 3, { speed: 0.15 }, '#d84a2a');
}

// Damage multiplier the wielder's own state gives a swing (worked out where the swing is built).
export function traitSwingMul(wielder, d) {
  const id = wieldedTrait(wielder);
  if (!id || !active(id, wielder)) return 1;
  const k = wielder.traitState || {};
  switch (id) {
    case 'moonlit':
      return G.world && G.world.sky && G.world.sky.isNight && G.world.sky.isNight() ? 1.12 : 1;
    case 'charge':
      return d && d.running ? 1.3 : 1;
    case 'gnaw':
      return 1 + 0.05 * Math.min(5, k.gnaw || 0);
    case 'crowd':
      return 1 + 0.03 * Math.min(5, k.crowd || 0);
    default:
      return 1;
  }
}

// The wielder landed a weapon blow on `tgt` (its own side: stacks that follow it).
export function traitAfterHit(wielder, tgt) {
  const id = wieldedTrait(wielder);
  if (!id || !active(id, wielder)) return;
  const k = wielder.traitState || (wielder.traitState = {});
  if (id === 'gnaw') {
    const now = G.time || 0;
    k.gnaw = k.gnawOn === tgt && now - (k.gnawT || -9) < 2 ? (k.gnaw || 0) + 1 : 1;
    k.gnawOn = tgt;
    k.gnawT = now;
  } else if (id === 'crowd') k.crowd = Math.min(5, (k.crowd || 0) + 1);
}

// The wielder was struck: the crowd's favour is lost.
export function traitStruck(wielder) {
  if (wielder.traitState) wielder.traitState.crowd = 0;
}
