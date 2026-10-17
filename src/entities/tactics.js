// Group tactics: how enemies fight together (Enemy.update asks these).
//  - Turns: at most TACTICS.strikers melee foes press one target at once; the rest circle at
//    TACTICS.holdRadius and wait. A foe gives its turn up after a full string when others wait.
//  - Flanks: a second presser comes in off the first one's line, by TACTICS.flank radians.
//  - Falling back: an ordinary foe brought under TACTICS.retreatAt of its health falls back for
//    TACTICS.retreatFor seconds and calls its own side within TACTICS.callRange.
//  - Ranged and support foes keep to their band (spec.keep) and take no turns; monsters and
//    bosses press whenever they like, and never fall back.
import { G } from '../core/globals.js';
import { hypot } from '../core/util.js';

export const TACTICS = {
  strikers: 2,
  holdRadius: 5.5,
  turn: 4, // a turn lapses after this long even mid-fight
  rest: 1.2, // after giving a turn up, this long before claiming another
  flank: 1.1,
  retreatAt: 0.3,
  retreatFor: 2.5,
  callRange: 30,
};

const turns = new WeakMap(); // target -> Map(enemy -> turn ends at)

// Melee foes queue for turns; bosses, monsters, ranged and support foes do not.
export function takesTurns(e) {
  if (e.boss || !e.spec) return false;
  const r = e.spec.role;
  return r !== 'monster' && r !== 'ranged' && r !== 'support';
}

function table(t) {
  let m = turns.get(t);
  if (!m) turns.set(t, (m = new Map()));
  return m;
}
function prune(m, t, now) {
  for (const [a, until] of m) {
    if (a.dead || a.knocked || a.target !== t || !a.aggro) m.delete(a);
    else if (until < now) {
      // a turn run out without a full string (a foe that cannot reach, or is kept from swinging)
      // rests before it is claimed again, when someone else waits for one
      if (waiting(t, now) > 0) a.ai.restUntil = now + TACTICS.rest;
      m.delete(a);
    }
  }
}

// Whether `e` may press `t` now, claiming a turn if one is free.
export function mayPress(e, t, now) {
  if (!t || !takesTurns(e)) return true;
  const m = table(t);
  prune(m, t, now);
  if (m.has(e)) return true;
  if (m.size < TACTICS.strikers && now >= (e.ai.restUntil || 0)) {
    m.set(e, now + TACTICS.turn);
    return true;
  }
  return false;
}

// Foes on `t`'s side of the fight waiting for a turn.
export function waiting(t, now) {
  const m = turns.get(t);
  let n = 0;
  for (const a of G.actors) if (a.target === t && a.aggro && !a.dead && takesTurns(a) && !(m && m.has(a))) n++;
  return n;
}

// Give the turn up after a full string, if anyone is waiting for one.
export function yieldTurn(e, t, now, force = false) {
  const m = t && turns.get(t);
  if (!m || !m.has(e)) return;
  if (!force && waiting(t, now) === 0) return;
  m.delete(e);
  e.ai.restUntil = now + TACTICS.rest;
}

// The other foe pressing the same target, if any.
export function partner(e, t) {
  const m = turns.get(t);
  if (!m) return null;
  for (const a of m.keys()) if (a !== e && !a.dead) return a;
  return null;
}

// Where `e` should come in to strike `t` from when `other` already presses it: off its line by
// TACTICS.flank, on whichever side `e` already is.
export function flankPoint(e, t, other, reach) {
  const base = Math.atan2(other.pos.x - t.pos.x, other.pos.z - t.pos.z);
  const mine = Math.atan2(e.pos.x - t.pos.x, e.pos.z - t.pos.z);
  let d = mine - base;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = base + (d >= 0 ? TACTICS.flank : -TACTICS.flank);
  return [t.pos.x + Math.sin(a) * reach, t.pos.z + Math.cos(a) * reach];
}

// Whether `e` falls back when badly hurt.
export function fallsBack(e) {
  if (e.boss || e.dummy || e.illusion || e.construct || !e.spec) return false;
  const r = e.spec.role;
  return r !== 'monster' && r !== 'bruiser' && e.spec.flee !== false;
}

// Call the foe's own side to the fight.
export function callForHelp(e, t) {
  let n = 0;
  for (const a of G.actors) {
    if (a === e || a.dead || a.team !== e.team || !a.setAggro || a.dummy) continue;
    if (hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) > TACTICS.callRange) continue;
    if (!a.aggro) {
      a.setAggro(t);
      n++;
    }
  }
  return n;
}
