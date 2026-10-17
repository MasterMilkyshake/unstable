import { SWIM_Y } from '../entities/actor.js';
import { hypot } from '../core/util.js';

const STOREY = 3; // a spawn floor more than this above the ground is someone's roof

// Where a spawned enemy stands (game.js Spawner), as [x, y, z]. On land, the lowest floor at or
// above the ground with room for a body: the street, not the top of a tower standing over it.
// A point inside a wall or a solid block steps out to the nearest open ground round it. Over
// the sea, and for those who perch (wall archers), the highest floor, as before. A spawner
// that names its floor (`floorY`, the Ascent's landings) stands on the floor at that height.
export function spawnSpot(world, x, z, perch = false, floorY = null) {
  const t = world.terrain.heightAt(x, z);
  if (floorY !== null && floorY !== undefined) return [x, Math.max(t, world.colliders.groundAt(x, z, floorY + 1.5)), z];
  if (perch || t < SWIM_Y - 0.6) return [x, Math.max(t, world.colliders.groundAt(x, z, 400)), z];
  const y = lowestFloor(world, x, z, t);
  if (y !== null && y - t < STOREY) return [x, y, z];
  for (const r of [1, 2, 3, 4.5, 6]) {
    for (let k = 0; k < 8; k++) {
      const px = x + Math.sin((k * Math.PI) / 4) * r;
      const pz = z + Math.cos((k * Math.PI) / 4) * r;
      const pt = world.terrain.heightAt(px, pz);
      const py = pt < SWIM_Y - 0.6 ? null : lowestFloor(world, px, pz, pt);
      if (py !== null && py - pt < STOREY) return [px, py, pz];
    }
  }
  return [x, y ?? Math.max(t, world.colliders.groundAt(x, z, 400)), z];
}

// The lowest walkable top at or above the terrain t at (x, z) with room for a body over it.
function lowestFloor(world, x, z, t) {
  const C = world.colliders;
  const floors = [t];
  for (const c of C.query(x, z, 0.1)) {
    if (!c.walkable || c.y1 <= t || c.y1 > 400) continue;
    if (c.kind === 'box') {
      const [lx, lz] = C._local(c, x, z);
      if (Math.abs(lx) > c.hw || Math.abs(lz) > c.hd) continue;
    } else if (hypot(x - c.x, z - c.z) > c.r) continue;
    floors.push(c.y1);
  }
  floors.sort((p, q) => p - q);
  for (const y of floors) if (!C.pointInside(x, y + 0.3, z) && !C.pointInside(x, y + 1, z) && !C.pointInside(x, y + 1.7, z)) return y;
  return null;
}
