// Where the player stands, for the place's own sounds (core/audio.js PlaceBed): near the shore
// or out at sea, how high above it, in a town, by a fire, among trees or reeds, under a roof.
// Read four times a second; each value runs 0..1.
import { G } from '../core/globals.js';
import { UPDATE_HOOKS } from './hooks.js';
import { STRUCTURES } from '../data/world.js';

const RING = Array.from({ length: 12 }, (_, i) => [Math.sin((i * Math.PI) / 6), Math.cos((i * Math.PI) / 6)]);
const GREEN = { forest: 1, jungle: 1, meadow: 0.6, farmland: 0.6, highland: 0.4, emberwood: 0.3, beach: 0.2, dunes: 0.2 };
const FIRES = STRUCTURES.filter((s) => s.type === 'campfire' && !s.hostile);

export function placeAt(world, pos, { afloat = false } = {}) {
  const T = world.terrain;
  const { x, y, z } = pos;
  // the shore: how much of the ground round about lies under the sea, heard near sea level
  let wet = 0;
  for (const [ux, uz] of RING) for (const r of [12, 28]) if (T.heightAt(x + ux * r, z + uz * r) < -0.3) wet++;
  const nearSea = Math.max(0, 1 - Math.max(0, y - 6) / 18);
  const shore = afloat ? 1 : Math.min(1, (wet / 24) * 2.2) * nearSea;
  // wind with height over the sea
  const height = Math.max(0, Math.min(1, (y - 22) / 55));
  // a town: houses close round about
  let houses = 0;
  for (const it of world.interiors || []) {
    const dx = it.x - x, dz = it.z - z;
    if (dx * dx + dz * dz < 45 * 45) houses++;
  }
  const town = Math.min(1, houses / 6);
  // a fire within a few paces
  let fire = 0;
  for (const s of FIRES) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < 10) fire = Math.max(fire, 1 - d / 10);
  }
  const biome = (world.biomeAt && world.biomeAt(x, z)) || '';
  // a roof or a ceiling a little over the head
  const indoor = !!(world.colliders && world.colliders.ceilingAt(x, z, y + 1.6, y + 7) < y + 7);
  return { shore, height, town, fire, green: GREEN[biome] || 0, marsh: biome === 'marsh' ? 1 : 0, indoor };
}

let t = 0;
UPDATE_HOOKS.push((game, dt) => {
  const p = game.player;
  if (!p || !G.audio || !G.audio.setPlace) return;
  if ((t -= dt) > 0) return;
  t = 0.25;
  if (game.inRift) return G.audio.setPlace({});
  G.audio.setPlace(placeAt(game.world, p.pos, { afloat: !!p.boat || !!p.swimming }));
});
