// A save made in the Rift before its floor was reshaped may now stand over the Sundering, a
// sinkhole, inside a castle wall raised since, or where the Abyssal Depths were. On load, step
// the player back onto the arrival shelf rather than let an old save fall into the void and
// spend a life.
import { START_HOOKS } from './hooks.js';
import { RIFT_SPAWN } from '../data/world.js';

export function riftFooting(game) {
  const p = game.player;
  if (!p || !game.inRift) return false;
  const w = game.world;
  const ground = w.terrain.heightAt(p.pos.x, p.pos.z);
  const inside = w.colliders.pointInside(p.pos.x, p.pos.y + 1, p.pos.z);
  if (ground > -20 && !inside) return false;
  const x = RIFT_SPAWN.x, z = RIFT_SPAWN.z;
  p.pos.set(x, w.groundAt(x, z, 200) + 0.2, z);
  p.fallStart = p.pos.y;
  if (p.vel) p.vel.set(0, 0, 0);
  return true;
}

START_HOOKS.push((game) => riftFooting(game));
