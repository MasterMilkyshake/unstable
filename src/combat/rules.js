// Combat rules shared by the player, humanoid enemies and LAN avatars: defense timings and the
// pure defense decision. Nothing here touches the scene, audio or UI, so the rules can be tested
// headlessly (tests/combat-rules.test.js).

export const COMBAT = {
  parry: {
    window: 0.22, // seconds a tapped parry stays up (talents and gear add to it)
    // A parry that catches nothing locks the next one out for this long. The old 0.55 s let a
    // held-and-tapped F cover nearly half of every second; at 0.9 s a missed parry is a
    // commitment, for the player and for enemies alike.
    missCooldown: 0.9,
    // A parry that lands readies the next one at once, so two foes or a quick string can be
    // answered back to back.
    successCooldown: 0,
  },
  // Block and parry cover the front only: `arc` degrees in all, centred on the facing. A blow
  // blocked beyond `edge` degrees off the facing (near the arc's rim) costs `edgePosture` times
  // the posture. Side and back blows land.
  guard: { arc: 140, edge: 50, edgePosture: 1.3 },
  ai: {
    // Seconds into a foe's wind-up before an ordinary enemy can commit to a defense. Player M1
    // wind-ups run 0.14-0.36 s, so this stays short: it removes frame-perfect reads without
    // making light weapons unanswerable. Feints are punished by the shared parry cooldown.
    reaction: 0.06,
    bossReaction: 0.04,
    parryWindow: 0.28,
    minParryLead: 0.04, // a parry must start at least this long before the expected impact
    // A guard turns toward a foe at most this fast (rad/s), so circling to a flank works.
    guardTurn: 4.2,
  },
  // Flourish: an M1 held at the top of its wind-up for up to `maxHold` s, then released. A foe
  // that has seen the player flourish may wait for the top of the next swing before parrying
  // (patience = skill x min(1, flourishes seen / `learn`)), which a plain swing then beats.
  flourish: { maxHold: 0.35, learn: 2, enemyChance: 0.1, bossChance: 0.2, enemyHold: [0.15, 0.33] },
  // Uppercut (LMB in a slide) and the air chase after it.
  launch: {
    speed: 11, // upward speed given to a launched foe (about a 2 m rise)
    chaseWindow: 0.6, // seconds after a launch in which Space leaps after the foe
    juggle: 4, // upward speed each air-string hit gives the foe
    maxAir: 2.2, // a foe kept up longer than this is no longer lifted
    failsafe: 3.5, // a launched foe still not down after this is set on the ground
    spike: 18, // the closing slam drives the foe down at this speed
    chaseTime: 1.5, // the chaser stays up at most this long
  },
  // F in the first `frac` of a dodge ends it (motion and i-frames); the dodge cooldown grows.
  rollCancel: { frac: 0.6, cooldown: 0.6 },
  // A blinded enemy perceives only this close, and a boss is blinded for `bossMul` as long.
  blind: { perception: 3, duration: 3, bossMul: 0.5 },
  // A boss whose summon cast is cut short tries again after this many seconds.
  summonRetry: 3,
};

// Seconds a dodge or crit pressed a moment too early stays queued.
export const INPUT_BUFFER = 0.16;

const DEG = Math.PI / 180;

// The angle (radians, 0..PI) between a fighter's facing and the direction a blow comes from.
export function guardAngle(target, fromPos) {
  const want = Math.atan2(fromPos.x - target.pos.x, fromPos.z - target.pos.z);
  let d = (want - target.yaw) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Whether the guard (block or parry) covers a blow from `fromPos`.
export function guardCovers(target, fromPos) {
  // Stonewall (talent): a held block covers 180 degrees
  const arc = target.blocking && target.mods && target.mods.stonewall ? 180 : COMBAT.guard.arc;
  return guardAngle(target, fromPos) <= (arc / 2) * DEG;
}

// Posture multiplier for a blocked blow: the rim of the guard costs more.
export function guardPostureMul(target, fromPos) {
  return guardAngle(target, fromPos) > COMBAT.guard.edge * DEG ? COMBAT.guard.edgePosture : 1;
}

// Whether an uppercut or an air-string blow may lift this body: light and medium foes only,
// never bosses, large or armoured creatures, flyers, swimmers or players.
export function canLaunch(t) {
  if (!t || t.dead || t.boss || t.dummy || t.flying || t.aquatic || t.hyper || t.team === 'player') return false;
  const s = t.spec || {};
  if (s.launchable === false) return false;
  if (s.launchable === true) return true;
  return (t.height || 1.8) <= 2.4 && (t.radius || 0.42) < 0.95;
}

// The defense decision for one hit, separated from its effects.
// Returns { result, frontal, backstab, edge } where result is one of:
//   'void'    - nothing to hit (dead, invulnerable, knocked without a finisher)
//   'evaded'  - i-frames
//   'dispel'  - the target was an illusion
//   'parried' | 'blocked' | 'hit'
// `frontal` is the broad front (backstabs and front armour); `ctx.guard(tgt, from)` is the guard's
// narrower arc (block and parry). Without `ctx.guard`, the guard uses `ctx.frontal`.
export function resolveDefense(att, tgt, h, ctx) {
  if (!tgt || tgt.dead || tgt.invuln) return { result: 'void', frontal: false, backstab: false, edge: false };
  if (tgt.knocked && !h.finisher) return { result: 'void', frontal: false, backstab: false, edge: false };
  if (tgt.iframes > 0 && !h.ignoreIframes) return { result: 'evaded', frontal: false, backstab: false, edge: false };
  if (tgt.illusion) return { result: 'dispel', frontal: false, backstab: false, edge: false };
  const from = h.from || (att && att.pos);
  const frontal = !!(from && ctx.frontal(tgt, from));
  const covered = !!(from && (ctx.guard ? ctx.guard(tgt, from) : frontal));
  const edge = !!(covered && from && ctx.edge && ctx.edge(tgt, from));
  const canDefend = tgt.canDefend ? tgt.canDefend() : false;
  if ((covered || tgt.autoParryT > 0) && tgt.isParrying && tgt.isParrying() && !h.unparryable && canDefend) {
    return { result: 'parried', frontal, backstab: false, edge };
  }
  const backstab = !frontal && !!(att && att.mods && att.mods.backstab);
  if (covered && !backstab && tgt.blocking && !h.unblockable && canDefend) {
    return { result: 'blocked', frontal, backstab, edge };
  }
  return { result: 'hit', frontal, backstab, edge };
}
