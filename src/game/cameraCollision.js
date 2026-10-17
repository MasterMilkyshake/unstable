import * as THREE from 'three';

// Sweep the near plane, not just its center. Retraction is immediate; expansion
// is smoothed by the caller only within this frame's unobstructed segment.
export function cameraClearance(world, focus, direction, distance, radius = 0.24) {
  const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  let allowed = distance;
  for (const [x, y] of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const origin = focus.clone().addScaledVector(right, x * radius).addScaledVector(up, y * radius);
    const hit = world.colliders.raycast(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, distance);
    allowed = Math.min(allowed, Math.max(0, hit - 0.12));
    const terrain = world.terrain.raycast(origin, direction, distance, 0.15);
    if (terrain) allowed = Math.min(allowed, Math.max(0, terrain.dist - radius));
  }
  return allowed;
}

// Where the arm points when the shoulder view is blocked: the same heading, only raised (look
// down from above) or lowered (stay level under a low ceiling). The camera never swings round
// to another heading: movement keys follow camYaw, so a view turned 90 degrees off it walked
// the player sideways to what the screen showed (stairs, interiors). `lift` is added to the
// direction's y before it is normalised.
export const ORBIT_LIFTS = [0.65, 1.5, -0.35];

// The arm's direction and the length it may have. Below `minimum` the shoulder direction is
// swapped for a raised or lowered one, if that is clearer. `held` is the lift chosen last frame:
// it is tried first and kept while it stays clear, and the plain shoulder view only takes over
// again once it has `minimum + 0.4` of room, so a camera at a doorway edge does not flick
// between two directions frame by frame. Every candidate is swept from the player's focus,
// never beyond an obstruction.
export function cameraOrbit(world, focus, desired, minimum = 1.35, held = null) {
  const direction = desired.clone().sub(focus);
  const distance = direction.length();
  direction.normalize();
  const allowed = cameraClearance(world, focus, direction, distance);
  if (allowed >= minimum + (held != null ? 0.4 : 0)) return { direction, allowed, lift: null };
  const lifted = (lift) => {
    const candidate = direction.clone();
    candidate.y += lift;
    return candidate.normalize();
  };
  let best = { direction, allowed, lift: null };
  if (held != null) {
    const d = lifted(held);
    const clear = cameraClearance(world, focus, d, distance);
    if (clear >= minimum) return { direction: d, allowed: clear, lift: held };
    if (clear > best.allowed) best = { direction: d, allowed: clear, lift: held };
  }
  for (const lift of ORBIT_LIFTS) {
    if (lift === held) continue;
    const d = lifted(lift);
    const clear = cameraClearance(world, focus, d, distance);
    if (clear > best.allowed + 0.05) best = { direction: d, allowed: clear, lift };
    if (clear >= minimum + 0.3) return best;
  }
  // nothing clears it: the shoulder view pulled in (the body fades) rather than a lift that
  // gains a few centimetres
  if (best.lift != null && best.allowed < minimum && best.allowed < allowed + 0.5) return { direction, allowed, lift: null };
  return best;
}

// The point the camera looks from round the body. Across the ground it follows the body exactly;
// its height eases after it, so a stair's risers, a step up a kerb, the ground snapping down a
// tread or a catch on a ledge do not jerk the whole view. It never trails the body by more than
// `below` (the body risen above it) or `above` (the body dropped below it): kept within the
// body's own height, it stays a safe place to sweep the arm from. A jump of over 5 m (a
// teleport, a respawn) is taken at once. Returns `cur` (or a new vector when there is none).
export function easeFocus(cur, target, dt, { grounded = true, below = 0.6, above = 0.35 } = {}) {
  if (!cur || !Number.isFinite(cur.y) || cur.distanceToSquared(target) > 25) return (cur || new THREE.Vector3()).copy(target);
  const rate = grounded ? 12 : 18;
  cur.x = target.x;
  cur.z = target.z;
  cur.y += (target.y - cur.y) * (1 - Math.exp(-rate * dt));
  cur.y = Math.min(target.y + above, Math.max(target.y - below, cur.y));
  return cur;
}
