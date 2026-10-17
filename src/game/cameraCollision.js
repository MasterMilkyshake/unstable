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

export function cameraOrbit(world, focus, desired, minimum = 1.35) {
  const direction = desired.clone().sub(focus);
  const distance = direction.length();
  direction.normalize();
  let allowed = cameraClearance(world, focus, direction, distance);
  if (allowed >= minimum) return { direction, allowed };
  // At a tight corner, look from above or from the free side. Never search
  // beyond an obstruction: every candidate is swept from the player's focus.
  let best = { direction, allowed };
  for (const yaw of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    for (const lift of [0.65, 1.5]) {
      const candidate = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      candidate.y += lift;
      candidate.normalize();
      const clear = cameraClearance(world, focus, candidate, distance);
      if (clear > best.allowed) best = { direction: candidate, allowed: clear };
      if (clear >= minimum + 0.3) return best;
    }
  }
  return best;
}
