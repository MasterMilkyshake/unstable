// Runtime implementations of mantra behaviors. Each produces an attack/cast
// definition consumed by Actor.startAttack.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { MANTRAS } from '../data/mantras.js';
import { applyHit, areaHit, hostile, actorsNear } from './combat.js';
import { Projectile } from '../entities/projectile.js';
import { elColor } from './vfx.js';
import { rand, forwardFromYaw, angleDiff } from '../core/util.js';

const UP = new THREE.Vector3(0, 1, 0);

export function mantraPower(caster, m, stars = 0) {
  if (caster.mantraPowerFn) return caster.mantraPowerFn(m) * (1 + stars * 0.15);
  return (caster.mantraPower || 1) * (1 + (caster.level || 1) * 0.03);
}

function soundFor(el) {
  return { ember: 'ember', rime: 'rime', storm: 'storm', gale: 'gale', umbra: 'umbra', steel: 'steel', blood: 'blood' }[el] || 'cast';
}

function handPos(c) {
  if (c.model && c.model.j && c.model.j.rHand) {
    const p = c.model.j.rHand.getWorldPosition(new THREE.Vector3());
    return p;
  }
  return c.center().addScaledVector(forwardFromYaw(c.yaw), 0.6);
}

function hitT(m, power, extra = {}, caster = null) {
  const el = m.el === 'phys' || m.el === 'support' ? 'phys' : m.el;
  return Object.assign(
    {
      dmg: (m.p.dmg || 0) * power,
      posture: m.p.posture || 0,
      element: el,
      status: m.p.status ? [m.p.status] : null,
      knockback: m.p.knockback || 0,
      launch: m.p.launch || 0,
      kind: 'mantra',
      mantra: m.id,
      unblockable: !!m.p.unblockable,
      unparryable: !!m.p.unparryable,
      statusPower: m.p.statusPower || 1,
    },
    extra
  );
}

// A weapon art strikes with the weapon, scaled by its stars and sparks (m.bonus, set by makeCastDef).
function weaponHit(c, m, wMul, extra = {}) {
  const base = c.weaponHitTemplate ? c.weaponHitTemplate() : { dmg: 12, posture: 10, element: 'phys' };
  return Object.assign({}, base, {
    dmg: base.dmg * wMul * (m.bonus || 1), posture: m.p.posture ?? base.posture, kind: 'melee', status: m.p.status ? [m.p.status] : base.status,
    statusPower: m.p.statusPower || 1,
  }, extra);
}

function aimPoint(caster, aim, range) {
  if (aim.target && !aim.target.dead) return aim.target.pos.clone();
  const p = aim.point ? aim.point.clone() : caster.pos.clone().addScaledVector(aim.dir, range * 0.6);
  const d = p.clone().sub(caster.pos);
  d.y = 0;
  if (d.length() > range) p.copy(caster.pos).addScaledVector(d.normalize(), range);
  p.y = G.world.groundAt(p.x, p.z, p.y + 5);
  return p;
}

function nearestHostile(caster, range, maxAngle = Math.PI) {
  let best = null;
  let bd = Infinity;
  for (const a of G.actors) {
    if (a.dead || a.knocked || !hostile(caster, a)) continue;
    const d = a.pos.distanceTo(caster.pos);
    if (d > range) continue;
    const ang = Math.abs(angleDiff(caster.yaw, Math.atan2(a.pos.x - caster.pos.x, a.pos.z - caster.pos.z)));
    if (ang > maxAngle) continue;
    const score = d + ang * 6;
    if (score < bd) {
      bd = score;
      best = a;
    }
  }
  return best;
}

// --------------------------------------------------------------- behaviors
const EXEC = {
  projectile(c, m, power, aim) {
    const from = handPos(c);
    const tgtPoint = aim.target && !aim.target.dead ? aim.target.center() : aim.point || from.clone().addScaledVector(aim.dir, 20);
    const base = tgtPoint.clone().sub(from).normalize();
    const shots = m.p.shots || 1;
    for (let i = 0; i < shots; i++) {
      const dir = shots > 1 ? base.clone().applyAxisAngle(UP, ((i - (shots - 1) / 2) * 7 * Math.PI) / 180) : base.clone();
      new Projectile(c, {
        pos: from.clone(), vel: dir.multiplyScalar(m.p.speed), radius: m.p.radius, size: m.p.size, life: m.p.life || 2,
        hit: hitT(m, power, {}, c), homing: m.p.homing || 0, target: aim.target, pierce: m.p.pierce, rod: m.p.rod, crescent: m.p.crescent,
      });
    }
    G.vfx.burst(from, m.el, 8, { speed: 3 });
  },
  multiProjectile(c, m, power, aim) {
    const from = handPos(c);
    const tgtPoint = aim.target && !aim.target.dead ? aim.target.center() : aim.point || from.clone().addScaledVector(aim.dir, 20);
    const base = tgtPoint.clone().sub(from).normalize();
    const n = m.p.count;
    for (let i = 0; i < n; i++) {
      const a = ((i - (n - 1) / 2) * m.p.spread * Math.PI) / 180;
      const dir = base.clone().applyAxisAngle(UP, a);
      new Projectile(c, { pos: from.clone(), vel: dir.multiplyScalar(m.p.speed), radius: m.p.radius, size: m.p.size, life: m.p.life || 1.5, hit: hitT(m, power), rod: true });
    }
  },
  eruption(c, m, power, aim) {
    const p = aimPoint(c, aim, m.p.range);
    G.vfx.telegraph(p, m.p.radius, m.p.delay, elColor(m.el));
    setTimer(m.p.delay, () => {
      G.vfx.pillar(p, m.el, m.p.radius * 0.8, 9, 0.7);
      G.vfx.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), m.el, 40, { speed: 10, up: 6, size: 0.5 });
      G.vfx.flashLight(p.clone().add(new THREE.Vector3(0, 2, 0)), elColor(m.el), 8, 0.35, 20);
      G.vfx.addShake(0.25);
      G.audio.play(soundFor(m.el), { pos: p });
      areaHit(c, p, m.p.radius, () => hitT(m, power, { launch: m.p.launch || 0, from: p.clone().add(new THREE.Vector3(0.01, 0, 0)), noInterrupt: false }));
    });
  },
  nova(c, m, power) {
    const p = c.pos.clone();
    G.vfx.ring(p, m.el, m.p.radius, 0.5, { color: m.p.color });
    G.vfx.ring(p.clone().add(new THREE.Vector3(0, 1, 0)), m.el, m.p.radius * 0.8, 0.4, { color: m.p.color });
    G.vfx.burst(c.center(), m.el, 40, { speed: 14, size: 0.45, color: m.p.color });
    G.vfx.flashLight(c.center(), m.p.color || elColor(m.el), 8, 0.3, 18);
    G.vfx.addShake(0.3);
    areaHit(c, p, m.p.radius, () => hitT(m, power, { from: p.clone() }));
  },
  leap(c, m) {
    c.vel.y = m.p.up;
    const f = forwardFromYaw(c.yaw);
    c.push.addScaledVector(f, m.p.forward);
    c.grounded = false;
    c.fallStart = c.pos.y + 6;
    G.vfx.dust(c.pos, 14);
    G.vfx.ring(c.pos, m.el === 'phys' ? 'phys' : m.el, 3, 0.35);
    if (m.el !== 'phys') G.vfx.burst(c.pos, m.el, 24, { speed: 6, up: 6 });
    c.leapTrail = m.el === 'phys' ? null : { el: m.el, t: 0.8 };
  },
  spikesLine(c, m, power, aim) {
    const dir = forwardFromYaw(c.yaw);
    const hit = new Set();
    for (let i = 0; i < m.p.count; i++) {
      setTimer(0.04 * i, () => {
        const p = c.pos.clone().addScaledVector(dir, 1.8 + (i * m.p.length) / m.p.count);
        p.y = G.world.groundAt(p.x, p.z, p.y + 4);
        G.vfx.spikes(p, m.el, 2.2 + Math.random(), 1.4);
        if (i % 2 === 0) G.audio.play(soundFor(m.el), { pos: p, vol: 0.5 });
        areaHit(c, p, 1.4, (t) => {
          if (hit.has(t.id)) return null;
          hit.add(t.id);
          return hitT(m, power, { launch: m.p.launch, from: c.pos.clone() });
        });
      });
    }
  },
  wall(c, m) {
    const f = forwardFromYaw(c.yaw);
    const p = c.pos.clone().addScaledVector(f, m.p.dist);
    p.y = G.world.groundAt(p.x, p.z, p.y + 3);
    G.world.spawnIceWall(p, c.yaw, m.p.width, m.p.height, m.p.duration, c.team);
    G.audio.play('rime', { pos: p });
  },
  beam(c, m, power, aim) {
    const from = handPos(c);
    const tgt = aim.target && !aim.target.dead ? aim.target.center() : aim.point || from.clone().addScaledVector(aim.dir, m.p.range);
    const dir = tgt.clone().sub(from).normalize();
    let len = m.p.range;
    const th = G.world.terrain.raycast(from, dir, m.p.range, 0.8);
    if (th) len = Math.min(len, th.dist);
    const cl = G.world.colliders.raycast(from.x, from.y, from.z, dir.x, dir.y, dir.z, len);
    len = Math.min(len, cl);
    const end = from.clone().addScaledVector(dir, len);
    G.vfx.bolt(from, end, m.el, 0.3);
    G.vfx.bolt(from, end, m.el, 0.2);
    G.vfx.flashLight(end, elColor(m.el), 7, 0.2);
    G.vfx.burst(end, m.el, 16, { speed: 8 });
    for (const a of G.actors) {
      if (a.dead || !hostile(c, a)) continue;
      const ac = a.center();
      const t = Math.max(0, Math.min(len, ac.clone().sub(from).dot(dir)));
      const closest = from.clone().addScaledVector(dir, t);
      if (closest.distanceTo(ac) < (m.p.width || 0.6) + a.radius) applyHit(c, a, hitT(m, power, { from: from.clone() }));
    }
  },
  skyStrike(c, m, power, aim) {
    const p = aimPoint(c, aim, m.p.range);
    G.vfx.telegraph(p, m.p.radius, m.p.delay, elColor(m.el));
    setTimer(m.p.delay, () => {
      const top = p.clone().add(new THREE.Vector3(rand(-2, 2), 35, rand(-2, 2)));
      G.vfx.bolt(top, p, m.el, 0.4, 14);
      G.vfx.bolt(top, p, m.el, 0.3, 10);
      G.vfx.ring(p, m.el, m.p.radius * 1.2, 0.4);
      G.vfx.burst(p.clone().add(new THREE.Vector3(0, 0.5, 0)), m.el, 30, { speed: 10, up: 4 });
      G.vfx.flashLight(p.clone().add(new THREE.Vector3(0, 3, 0)), elColor(m.el), 12, 0.3, 30);
      G.vfx.addShake(0.35);
      G.audio.play('storm', { pos: p });
      areaHit(c, p, m.p.radius, () => hitT(m, power, { from: p.clone().add(new THREE.Vector3(0.01, 0, 0)) }));
    });
  },
  chain(c, m, power, aim) {
    let cur = aim.target && !aim.target.dead && aim.target.pos.distanceTo(c.pos) <= m.p.range ? aim.target : nearestHostile(c, m.p.range, 1.2);
    let from = handPos(c);
    const jumps = m.p.jumps + ((c.mods && c.mods.chainJumps) || 0);
    const hitSet = new Set();
    let i = 0;
    const step = () => {
      if (!cur || i > jumps) return;
      hitSet.add(cur.id);
      const to = cur.center();
      G.vfx.bolt(from, to, m.el, 0.3);
      G.vfx.flashLight(to, elColor(m.el), 5, 0.2);
      applyHit(c, cur, hitT(m, power * (1 - i * 0.12), { from: from.clone() }));
      G.audio.play('storm', { pos: to, vol: 0.6 });
      from = to;
      let next = null;
      let bd = m.p.jumpRange;
      for (const a of G.actors) {
        if (a.dead || hitSet.has(a.id) || !hostile(c, a)) continue;
        const d = a.pos.distanceTo(cur.pos);
        if (d < bd) {
          bd = d;
          next = a;
        }
      }
      cur = next;
      i++;
      setTimer(0.09, step);
    };
    if (!cur) {
      G.vfx.bolt(from, from.clone().addScaledVector(aim.dir, 8), m.el, 0.2);
      return;
    }
    step();
  },
  blink(c, m, power) {
    const dir = forwardFromYaw(c.yaw);
    const from = c.pos.clone();
    let dist = m.p.distance;
    const o = c.center();
    const cl = G.world.colliders.raycast(o.x, o.y, o.z, dir.x, 0, dir.z, dist);
    if (cl < dist) dist = cl - 0.8;
    // stop before steep terrain
    for (let d = 1; d <= dist; d += 0.5) {
      const h = G.world.terrain.heightAt(from.x + dir.x * d, from.z + dir.z * d);
      if (h - from.y > 2.5) {
        dist = d - 1;
        break;
      }
    }
    dist = Math.max(0, dist);
    const to = from.clone().addScaledVector(dir, dist);
    to.y = Math.max(G.world.groundAt(to.x, to.z, from.y + 3), from.y - 3);
    G.vfx.bolt(from.clone().add(new THREE.Vector3(0, 1, 0)), to.clone().add(new THREE.Vector3(0, 1, 0)), m.el, 0.3, 8);
    for (const a of G.actors) {
      if (a.dead || !hostile(c, a)) continue;
      const t = Math.max(0, Math.min(dist, a.pos.clone().sub(from).dot(dir)));
      const p = from.clone().addScaledVector(dir, t);
      if (p.distanceTo(a.pos) < 1.4 + a.radius) applyHit(c, a, hitT(m, power, { from: from.clone() }));
    }
    c.pos.copy(to);
    c.iframes = Math.max(c.iframes, 0.2);
    G.vfx.burst(c.center(), m.el, 20, { speed: 6 });
  },
  vortex(c, m, power, aim) {
    const p = aimPoint(c, aim, m.p.range);
    let n = 0;
    G.audio.play('gale', { pos: p });
    const tick = () => {
      n++;
      G.vfx.ring(p, m.el, m.p.radius, 0.35);
      for (let i = 0; i < 12; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(0.5, m.p.radius);
        const q = p.clone().add(new THREE.Vector3(Math.cos(a) * r, rand(0, 5), Math.sin(a) * r));
        G.vfx.add.emit(q.x, q.y, q.z, -Math.sin(a) * 10, rand(1, 4), Math.cos(a) * 10, new THREE.Color(elColor(m.el)), 0.3, 0.4, { drag: 1 });
      }
      for (const a of G.actors) {
        if (a.dead || !hostile(c, a)) continue;
        const d = a.pos.distanceTo(p);
        if (d > m.p.radius + 2) continue;
        const dir = p.clone().sub(a.pos).setY(0).normalize();
        a.push.addScaledVector(dir, m.p.pull * 0.6);
        if (d <= m.p.radius + a.radius) applyHit(c, a, hitT(m, power, { from: p.clone(), noInterrupt: n % 2 === 1 }));
      }
      if (n < m.p.ticks) setTimer(m.p.interval, tick);
    };
    tick();
  },
  ward(c, m) {
    c.wardT = m.p.duration;
    c.addBuff('tempest', m.p.duration, {}, elColor(m.el));
    G.vfx.ring(c.pos, m.el, m.p.radius, 0.5);
    G.audio.play('gale', { pos: c.pos });
    let t = 0;
    const tick = () => {
      t += 0.25;
      if (c.dead) return;
      for (let i = 0; i < 10; i++) {
        const a = rand(0, Math.PI * 2);
        const q = c.pos.clone().add(new THREE.Vector3(Math.cos(a) * m.p.radius * 0.7, rand(0.2, 2.2), Math.sin(a) * m.p.radius * 0.7));
        G.vfx.add.emit(q.x, q.y, q.z, -Math.sin(a) * 8, 0.5, Math.cos(a) * 8, new THREE.Color(elColor(m.el)), 0.22, 0.3, { drag: 1 });
      }
      for (const a of actorsNear(c.pos, m.p.radius, (x) => hostile(c, x))) {
        const dir = a.pos.clone().sub(c.pos).setY(0).normalize();
        a.applyKnockback(dir, m.p.knockback * 0.5);
      }
      if (t < m.p.duration) setTimer(0.25, tick);
    };
    tick();
  },
  teleportBehind(c, m, power, aim) {
    const t = aim.target && !aim.target.dead && aim.target.pos.distanceTo(c.pos) <= m.p.range ? aim.target : nearestHostile(c, m.p.range, 1.0);
    G.vfx.burst(c.center(), 'umbra', 24, { speed: 4, normal: false });
    if (!t) {
      EXEC.blink(c, Object.assign({}, m, { p: { distance: 8, dmg: 0 }, el: 'umbra' }), 0);
      return;
    }
    const behind = t.pos.clone().addScaledVector(forwardFromYaw(t.yaw), -1.8);
    behind.y = G.world.groundAt(behind.x, behind.z, t.pos.y + 2);
    c.pos.copy(behind);
    c.yaw = Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z);
    c.iframes = Math.max(c.iframes, 0.25);
    c.addBuff('shade', 3, { nextHit: m.p.buff });
    c.nextHitBonus = m.p.buff;
    G.vfx.burst(c.center(), 'umbra', 24, { speed: 4 });
  },
  stealth(c, m) {
    c.stealth = m.p.duration;
    c.nextHitBonus = m.p.bonus;
    c.addBuff('veil', m.p.duration, {}, null).onEnd = (a) => {
      a.stealth = 0;
      a.model && a.model.setOpacity(1);
    };
    c.model && c.model.setOpacity(0.18);
    G.vfx.burst(c.center(), 'umbra', 30, { speed: 3 });
  },
  buff(c, m) {
    c.addBuff(m.id, m.p.duration, m.p.mods, m.p.color);
    G.vfx.burst(c.center(), m.el, 30, { speed: 5, color: m.p.color });
    G.vfx.ring(c.pos, m.el, 2.5, 0.4, { color: m.p.color });
    G.audio.play(soundFor(m.el), { pos: c.pos });
  },
  heal(c, m) {
    const amt = c.maxHp * m.p.pct;
    c.heal ? c.heal(amt) : (c.hp = Math.min(c.maxHp, c.hp + amt));
    if (m.p.cleanse) {
      c.clearStatus('bleed');
      c.clearStatus('burn');
      c.clearStatus('chill');
    }
    if (m.p.sanity && c.addSanity) c.addSanity(m.p.sanity);
    if (m.p.hot) c.addBuff('regen_' + m.id, 8, { regen: (c.maxHp * m.p.hot) / 8 }, m.p.color);
    G.vfx.burst(c.center(), 'support', 34, { speed: 4, up: 3, color: m.p.color });
    G.vfx.ring(c.pos, 'support', 2.5, 0.6, { color: m.p.color });
    G.audio.play('heal', { pos: c.pos });
  },
  warcry(c, m) {
    G.vfx.ring(c.pos, 'phys', m.p.radius, 0.5, { color: '#ffd27a' });
    G.vfx.ring(c.center(), 'phys', m.p.radius * 0.7, 0.4, { color: '#ffd27a', vertical: true, yaw: c.yaw });
    G.audio.play('roar', { pos: c.pos, pitch: 1.6 });
    G.vfx.addShake(0.3);
    for (const a of actorsNear(c.pos, m.p.radius, (x) => hostile(c, x))) {
      a.addPosture(m.p.posture, c);
      if (!a.boss) a.interrupt(0.6);
    }
    c.addBuff(m.id, m.p.duration, m.p.mods, '#ffd27a');
  },
  // ---------------- BELLS (boss-granted mantras) ----------------
  // Meteors rain around the target over a couple of seconds.
  meteorShower(c, m, power, aim) {
    const center = aimPoint(c, aim, m.p.range);
    for (let i = 0; i < m.p.count; i++) {
      setTimer(i * m.p.interval, () => {
        const a = Math.random() * Math.PI * 2;
        const r = i === 0 ? 0 : Math.sqrt(Math.random()) * m.p.spread;
        const p = center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        p.y = G.world.groundAt(p.x, p.z, p.y + 10);
        G.vfx.telegraph(p, m.p.radius, m.p.delay, elColor(m.el));
        setTimer(m.p.delay, () => {
          const top = p.clone().add(new THREE.Vector3(rand(-6, 6), 30, rand(-6, 6)));
          G.vfx.beam(top, p, m.el, 0.6, 0.25);
          G.vfx.pillar(p, m.el, m.p.radius * 0.7, 6, 0.6);
          G.vfx.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), m.el, 30, { speed: 9, up: 6 });
          G.vfx.flashLight(p, elColor(m.el), 8, 0.3, 20);
          G.vfx.addShake(0.2);
          G.audio.play('hitHeavy', { pos: p, pitch: 0.6 });
          G.audio.play(soundFor(m.el), { pos: p, vol: 0.6 });
          areaHit(c, p, m.p.radius, () => hitT(m, power, { launch: m.p.launch || 0, from: p.clone().add(new THREE.Vector3(0.01, 0, 0)) }));
        });
      });
    }
  },
  // Expanding rings of ice spikes around the caster.
  glacierRings(c, m, power) {
    const origin = c.pos.clone();
    const hit = new Set();
    m.p.rings.forEach((radius, ri) => {
      setTimer(ri * 0.18, () => {
        const n = Math.round(radius * 2.2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const p = origin.clone().add(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
          p.y = G.world.groundAt(p.x, p.z, p.y + 4);
          G.vfx.spikes(p, m.el, 1.8 + Math.random(), 1.6);
        }
        G.vfx.ring(origin, m.el, radius, 0.4);
        G.audio.play(soundFor(m.el), { pos: origin, vol: 0.7 });
        areaHit(c, origin, radius + 0.8, (t) => {
          if (hit.has(t.id)) return null;
          hit.add(t.id);
          return hitT(m, power, { from: origin.clone(), launch: m.p.launch || 0 });
        });
      });
    });
  },
  // Successive shockwaves rolling out from the caster.
  quake(c, m, power) {
    const origin = c.pos.clone();
    const hits = new Map();
    for (let i = 0; i < m.p.waves; i++) {
      setTimer(i * m.p.interval, () => {
        const radius = m.p.radius * (0.55 + i * 0.3);
        G.vfx.ring(origin, 'phys', radius, 0.45, { color: '#d8c8a8' });
        G.vfx.dust(origin, 30, '#a89a80', 1.2);
        G.vfx.addShake(0.35);
        G.audio.play('hitHeavy', { pos: origin, pitch: 0.5 });
        areaHit(c, origin, radius, (t) => {
          const n = hits.get(t.id) || 0;
          hits.set(t.id, n + 1);
          return hitT(m, power * (n ? 0.5 : 1), { from: origin.clone(), launch: m.p.launch, knockback: m.p.knockback });
        });
      });
    }
  },
  // Rings of sound rolling out from a struck bell: each catches a foe once, breaking guard.
  knell(c, m, power) {
    const origin = c.pos.clone();
    const hit = new Set();
    m.p.rings.forEach((radius, i) => {
      setTimer(i * m.p.interval, () => {
        G.vfx.ring(origin, 'phys', radius, 0.5, { color: m.p.color });
        G.vfx.ring(origin.clone().add(new THREE.Vector3(0, 1.2, 0)), 'phys', radius * 0.9, 0.4, { color: m.p.color });
        G.vfx.dust(origin, 16, '#b8aa88', 1);
        G.vfx.addShake(0.22);
        G.audio.play('toll', { pos: origin, vol: 0.8, pitch: 1 + i * 0.12, gap: 0 });
        areaHit(c, origin, radius + 0.6, (t) => {
          if (hit.has(t.id)) return null;
          hit.add(t.id);
          return hitT(m, power, { from: origin.clone(), knockback: m.p.knockback });
        });
      });
    });
  },
  // Lanterns orbit the caster, then seek out foes one by one.
  lanternSwarm(c, m, power, aim) {
    for (let i = 0; i < m.p.count; i++) {
      setTimer(0.12 * i, () => {
        if (c.dead) return;
        const a = (i / m.p.count) * Math.PI * 2;
        const from = c.center().add(new THREE.Vector3(Math.cos(a) * 1.6, 0.8, Math.sin(a) * 1.6));
        const target = aim.target && !aim.target.dead ? aim.target : nearestHostile(c, m.p.range, Math.PI);
        const dir = target ? target.center().sub(from).normalize() : forwardFromYaw(c.yaw).add(new THREE.Vector3(0, 0.3, 0)).normalize();
        new Projectile(c, {
          pos: from, vel: dir.multiplyScalar(m.p.speed), radius: 0.5, size: 0.45, life: 3, homing: m.p.homing, target,
          hit: hitT(m, power), color: m.p.color,
        });
        G.vfx.burst(from, m.el, 6, { speed: 2, color: m.p.color });
      });
    }
  },
  // A field of thorns keeps erupting around the target.
  thornField(c, m, power, aim) {
    const center = aimPoint(c, aim, m.p.range);
    G.vfx.telegraph(center, m.p.radius, 0.5, elColor(m.el));
    let n = 0;
    const tick = () => {
      n++;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * m.p.radius;
        const p = center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        p.y = G.world.groundAt(p.x, p.z, p.y + 4);
        G.vfx.spikes(p, m.el, 1.2 + Math.random() * 0.8, 0.8, m.p.color);
      }
      areaHit(c, center, m.p.radius, () => hitT(m, power, { from: center.clone(), noInterrupt: n % 2 === 0 }));
      if (n < m.p.ticks) setTimer(m.p.interval, tick);
    };
    setTimer(0.5, tick);
  },
  // A wall of rift-water surges forward, carrying foes with it.
  tidalWave(c, m, power) {
    const f = forwardFromYaw(c.yaw);
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const base = c.pos.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(f, 1.5);
    const struck = new Set();
    for (let i = 0; i < m.p.width; i++) {
      const off = (i - (m.p.width - 1) / 2) * 1.2;
      const from = base.clone().addScaledVector(right, off);
      new Projectile(c, {
        pos: from, vel: f.clone().multiplyScalar(m.p.speed), radius: 0.9, size: 0.9, life: m.p.life, pierce: true, crescent: true, hitSet: struck,
        hit: hitT(m, power, { knockback: m.p.knockback }),
      });
    }
    G.vfx.burst(base, m.el, 40, { speed: 8 });
  },
  // Resonance: blood for ether, and a ready critical attack.
  resSanguine(c, m) {
    if (c.ether !== undefined) c.ether += m.p.ether;
    if (c.critCd !== undefined) c.critCd = 0;
    G.vfx.blood(c.center(), null, 24);
    G.vfx.sphereFlash(c.center(), 'blood', 1.6, 0.35);
    G.vfx.ring(c.pos, 'blood', 3, 0.4);
  },
  // Mark a target: it takes extra damage from every source for a while.
  mark(c, m, power, aim) {
    const t = aim.target && !aim.target.dead && aim.target.pos.distanceTo(c.pos) <= m.p.range ? aim.target : nearestHostile(c, m.p.range, 0.9);
    if (!t) {
      if (c === G.player) G.ui && G.ui.toast('No target to mark.');
      return;
    }
    const amp = m.p.amp * (power > 1 ? Math.min(1.5, power) : 1);
    t.dmgTakenMul = 1 + amp;
    t.markedUntil = G.time + m.p.duration;
    G.vfx.sphereFlash(t.center(), 'blood', 1.4, 0.4, { color: m.p.color || '#ff3a3a' });
    G.vfx.beam(handPos(c), t.center(), 'blood', 0.06, 0.3);
    G.audio.play('blood', { pos: t.pos, pitch: 1.4 });
    let n = 0;
    const tick = () => {
      if (t.dead || G.time >= t.markedUntil) {
        if (G.time >= t.markedUntil) t.dmgTakenMul = 1;
        return;
      }
      if (n++ % 2 === 0) G.vfx.ring(t.pos, 'blood', 1.2, 0.4, { color: m.p.color || '#ff3a3a' });
      setTimer(0.5, tick);
    };
    tick();
  },
  arcWard(c, m) {
    c.autoParryT = m.p.duration;
    c.addBuff('arc_ward', m.p.duration, {}, '#7fc8ff');
    G.vfx.sphereFlash(c.center(), 'phys', 1.6, m.p.duration, { color: '#7fc8ff' });
    G.audio.play('steel', { pos: c.pos, pitch: 1.5 });
  },
};

// Behaviors that are themselves attacks (movement + melee hit detection).
const ATTACKS = {
  grab(c, m, power) {
    const dur = m.p.range / m.p.speed;
    return {
      anim: m.anim, windup: m.cast, active: dur, recovery: 0.4, lunge: m.p.speed, type: 'melee', range: 1.7, arc: 90, sound: null,
      hit: hitT(m, power), stopOnHit: true, element: m.el,
      onActive: (a) => G.audio.play(soundFor(m.el), { pos: a.pos, vol: 0.6 }),
      onActiveTick: (a) => Math.random() < 0.6 && G.vfx.trailPuff(handPos(a), m.el, 0.35, 2),
      onHit: (a, t) => {
        if (m.p.explode) {
          const p = t.center();
          G.vfx.sphereFlash(p, m.el, m.p.explode, 0.3);
          G.vfx.burst(p, m.el, 30, { speed: 10 });
          G.vfx.flashLight(p, elColor(m.el), 8, 0.3);
          areaHit(a, t.pos, m.p.explode, (x) => (x === t ? null : hitT(m, power * 0.6, { from: t.pos.clone() })));
        }
      },
    };
  },
  dash(c, m, power) {
    const dur = m.p.duration || 0.4;
    return {
      anim: m.anim, windup: m.cast, active: dur, recovery: 0.2, lunge: m.p.distance / dur, type: m.p.dmg ? 'melee' : 'move', range: 1.5, arc: 360, sound: null,
      hit: m.p.dmg ? hitT(m, power) : null, iframes: dur * 0.6,
      onActive: (a) => {
        a.iframes = Math.max(a.iframes, dur * 0.6);
        G.audio.play(m.el === 'phys' ? 'dodge' : soundFor(m.el), { pos: a.pos, vol: 0.6 });
      },
      onActiveTick: (a) => {
        if (m.p.trail === 'rime') G.vfx.spikes(a.pos.clone(), 'rime', 0.5, 0.8);
        else G.vfx.trailPuff(a.center(), m.el === 'phys' ? 'move' : m.el, 0.4, 2);
      },
    };
  },
  bash(c, m, power) {
    const dur = 0.35;
    return {
      anim: 'bash', windup: m.cast, active: dur, recovery: 0.4, lunge: m.p.distance / dur, type: 'melee', range: 1.8, arc: 100, sound: null,
      hit: weaponHit(c, m, 0.8, { dmg: m.p.dmg * power, posture: m.p.posture, knockback: m.p.knockback, heavy: true }), stopOnHit: true,
      onActive: (a) => G.audio.play('dodge', { pos: a.pos }),
    };
  },
  melee(c, m, power) {
    return {
      anim: m.anim, windup: m.cast, active: 0.16, recovery: 0.45, type: 'melee', range: m.p.range, arc: m.p.arc, unparryable: m.p.unparryable,
      hit: weaponHit(c, m, m.p.wMul, { unparryable: m.p.unparryable, heavy: true }), sound: 'swingHeavy',
      onActive: (a) => {
        if (m.p.launchDown) {
          const p = a.pos.clone().addScaledVector(forwardFromYaw(a.yaw), 1.8);
          G.vfx.dust(p, 12);
          G.vfx.ring(p, 'phys', 2.5, 0.3);
        }
      },
    };
  },
  flurry(c, m, power) {
    return {
      anim: 'flurry', windup: m.cast, active: m.p.duration, recovery: 0.35, type: 'melee', range: m.p.range, arc: 100, hits: m.p.hits, lunge: 3,
      hit: weaponHit(c, m, m.p.wMul), sound: 'swing', pitch: 1.4,
    };
  },
  lunge(c, m, power) {
    const dur = 0.22;
    return {
      anim: 'lunge', windup: m.cast, active: dur, recovery: 0.45, type: 'melee', range: 2.2, arc: 60, lunge: m.p.distance / dur, unblockable: m.p.unblockable,
      hit: weaponHit(c, m, m.p.wMul, { unblockable: m.p.unblockable, heavy: true }), sound: 'swingHeavy',
    };
  },
  spin(c, m, power) {
    return {
      anim: 'whirlwind', windup: m.cast, active: m.p.duration, recovery: 0.4, type: 'melee', range: m.p.radius, arc: 360, hits: m.p.hits,
      hit: weaponHit(c, m, m.p.wMul), sound: 'swingHeavy',
    };
  },
  slam(c, m, power) {
    return {
      anim: 'heavySlam', windup: m.cast, active: 0.15, recovery: 0.6, type: 'cast', sound: null,
      onActive: (a) => {
        const p = a.pos.clone().addScaledVector(forwardFromYaw(a.yaw), 1.8);
        p.y = G.world.groundAt(p.x, p.z, p.y + 3);
        G.vfx.ring(p, 'phys', m.p.radius, 0.5, { color: '#d8c8a8' });
        G.vfx.dust(p, 30, '#a89a80', 1);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          G.vfx.spikes(p.clone().add(new THREE.Vector3(Math.cos(ang) * 2.2, 0, Math.sin(ang) * 2.2)), 'phys', 1.2, 0.9, '#7a6a5a');
        }
        G.vfx.addShake(0.5);
        G.audio.play('hitHeavy', { pos: p, pitch: 0.6 });
        areaHit(a, p, m.p.radius, () => weaponHit(a, m, m.p.wMul, { launch: m.p.launch, from: p.clone(), kind: 'aoe', heavy: true }));
      },
    };
  },
  airDash(c, m, power, getAim) {
    const aim = getAim();
    const dir = aim.dir.clone();
    const dur = 0.25;
    return {
      anim: 'iaido', windup: m.cast, active: dur, recovery: 0.3, type: 'melee', range: 2.2, arc: 140, sound: 'swing', airOk: true,
      hit: weaponHit(c, m, m.p.wMul),
      onActive: (a) => {
        a.iframes = Math.max(a.iframes, 0.2);
        a.vel.y = dir.y * (m.p.distance / dur) * 0.6;
        a.grounded = false;
        G.audio.play('gale', { pos: a.pos });
      },
      onActiveTick: (a) => {
        a.vel.x = dir.x * (m.p.distance / dur);
        a.vel.z = dir.z * (m.p.distance / dur);
        G.vfx.trailPuff(a.center(), 'gale', 0.45, 3);
      },
      onEnd: (a) => {
        a.vel.x *= 0.2;
        a.vel.z *= 0.2;
        if (a.vel.y > 2) a.vel.y = 2;
      },
    };
  },
  rush(c, m, power) {
    const dur = 0.45;
    return {
      anim: 'flurry', windup: m.cast, active: dur, recovery: 0.35, type: 'melee', range: 2.3, arc: 120, hits: m.p.hits, lunge: m.p.distance / dur,
      hit: weaponHit(c, m, m.p.wMul), sound: 'swing', pitch: 1.2,
      onActive: (a) => G.vfx.burst(a.center(), 'phys', 16, { color: '#ff5a5a', speed: 6 }),
    };
  },
};

// Mantra modifiers ("sparks") chosen at the altar reshape a mantra's parameters.
// They live on the caster's character: ch.mantras[id].mods = ['potent', 'far', ...].
export function applyModifiers(m, mods) {
  if (!mods || !mods.length) return { m, powerMul: 1 };
  const p = Object.assign({}, m.p);
  let powerMul = 1;
  for (const mod of mods) {
    switch (mod) {
      case 'potent':
        powerMul *= 1.2;
        if (m.behavior === 'heal') {
          if (p.pct) p.pct *= 1.2;
          if (p.hot) p.hot *= 1.2;
        }
        break;
      case 'far':
        for (const k of ['range', 'distance', 'length']) if (p[k]) p[k] *= 1.3;
        if (p.speed) p.speed *= 1.3;
        if (p.radius) p.radius *= 1.2;
        if (p.rings) p.rings = p.rings.map((r) => r * 1.2);
        if (p.spread) p.spread *= 1.15;
        break;
      case 'twin':
        if (m.behavior === 'projectile') p.shots = (p.shots || 1) + 1;
        if (p.count) p.count += 2;
        if (p.jumps) p.jumps += 2;
        if (p.ticks) p.ticks += 3;
        if (p.waves) p.waves += 1;
        if (p.hits) p.hits += 1;
        if (p.width && m.behavior === 'tidalWave') p.width += 2;
        break;
      case 'lingering':
        p.statusPower = (p.statusPower || 1) * 2;
        break;
      case 'empowered':
        if (p.duration) p.duration *= 1.3;
        if (p.pct) p.pct *= 1.3;
        if (p.hot) p.hot *= 1.3;
        if (p.mods) p.mods = Object.fromEntries(Object.entries(p.mods).map(([k, v]) => [k, v * 1.3]));
        if (p.amp) p.amp *= 1.3;
        if (p.sanity) p.sanity *= 1.3;
        if (p.buff) p.buff *= 1.3;
        break;
      default:
        break;
    }
  }
  return { m: Object.assign({}, m, { p }), powerMul };
}

export function makeCastDef(caster, id, getAim, stars = 0) {
  const st = caster.ch && caster.ch.mantras ? caster.ch.mantras[id] : null;
  const mod = applyModifiers(Object.assign({ id }, MANTRAS[id]), st && st.mods);
  const m = mod.m;
  const power = mantraPower(caster, m, stars) * mod.powerMul;
  m.bonus = (1 + stars * 0.15) * mod.powerMul; // what stars and Potent add to a weapon art
  if (ATTACKS[m.behavior]) {
    const def = ATTACKS[m.behavior](caster, m, power, getAim);
    def.mantra = id;
    return def;
  }
  const exec = EXEC[m.behavior];
  return {
    anim: m.anim || 'castPush', windup: m.cast, active: 0.12, recovery: 0.3, type: 'cast', sound: null, mantra: id,
    onStart: (a) => {
      G.audio.play('cast', { pos: a.pos, vol: 0.55, el: m.el });
      if (m.el !== 'phys' && m.el !== 'support') {
        G.vfx.burst(handPos(a), m.el, 10, { speed: 2 });
      }
    },
    onActive: (a) => {
      if (!exec) return;
      exec(a, m, power, getAim());
      if (m.behavior !== 'eruption' && m.behavior !== 'skyStrike') G.audio.play(soundFor(m.el), { pos: a.pos, vol: 0.8 });
    },
  };
}

// ---------------------------------------------------------- tiny timer system
const timers = [];
export function setTimer(t, fn) {
  timers.push({ t, fn });
}
export function updateTimers(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    const tm = timers[i];
    tm.t -= dt;
    if (tm.t <= 0) {
      timers.splice(i, 1);
      try {
        tm.fn();
      } catch (e) {
        console.error(e);
      }
    }
  }
}
export function clearTimers() {
  timers.length = 0;
}
