import { ISLANDS } from '../data/world.js';
import { Kit } from './kit.js';
import { BIOME_COLORS } from './biomeGround.js';

// Continuous rock strata, following the authored ledge rather than the heightfield's
// triangle diagonals. The cap closes the small sampling bevel behind the sheer face.
export function buildShelfFaces(world, exclusions, add) {
  for (const island of ISLANDS) {
    // block terrain raises these shelves as exact levels with their own strata walls
    if (world.terrain.byId?.[island.id]?.blocks) continue;
    const shelves = (island.flats || []).filter(f => f.front || f.outline);
    if (!shelves.length) continue;
    const colors = BIOME_COLORS[island.biome];
    const k = new Kit({ stone: colors.high, stone2: colors.rock, edge: colors.grass, earth: colors.under }, { gradient: 0.08 });
    const slab = (a, b, low, high, offset, color, collide = true) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      const depth = 3.2 - offset, zc = (3.2 + offset) / 2;
      const x = (a[0] + b[0]) / 2 + Math.sin(yaw) * zc;
      const z = (a[1] + b[1]) / 2 + Math.cos(yaw) * zc;
      k.slab(x, low, z, length + 0.06, high - low, depth, color, { ry: yaw });
      if (collide) world.colliders.addBox({ x, z, w: length + 0.06, d: depth, y0: low, y1: high, rot: yaw, tag: 'shelf_face' });
    };
    for (const f of shelves) {
      if (f.outline) {
        for (let i = 0; i < f.outline.length; i++) {
          const a = f.outline[i], b = f.outline[(i + 1) % f.outline.length];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const nx = (b[1] - a[1]) / length, nz = -(b[0] - a[0]) / length;
          const count = Math.ceil(length / 2);
          for (let j = 0; j < count; j++) {
            const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            const start = at(j / count), end = at((j + 1) / count), mid = at((j + 0.5) / count);
            if (f.roadCuts && world.terrain.islands.find(terrain => terrain.id === island.id)?.roadAt(...mid).d < 8) continue;
            // Both horizontal and vertical stair corridors cut the entire rock face.
            if ((island.ramps || []).some(r => {
              const dx = r.x2 - r.x, dz = r.z2 - r.z;
              const t = Math.max(0, Math.min(1, ((mid[0] - r.x) * dx + (mid[1] - r.z) * dz) / (dx * dx + dz * dz)));
              return Math.hypot(mid[0] - r.x - dx * t, mid[1] - r.z - dz * t) < r.w / 2 + 5;
            })) continue;
            const low = Math.min(...[start, mid, end].map(([x, z]) => world.terrain.heightAt(x + nx * 2, z + nz * 2))) - 0.4;
            if (f.h - low < 1.5) continue;
            const middle = low + (f.h - low) * 0.45;
            slab(start, end, low, middle, -0.15, 'stone2');
            slab(start, end, middle, f.h - 0.4, 0.12, 'stone');
            slab(start, end, f.h - 0.4, f.h - 0.12, -0.35, 'earth');
            slab(start, end, f.h - 0.12, f.h + 0.015, -0.35, 'edge');
            exclusions.push({ x: mid[0], z: mid[1], r: 1.5 });
          }
        }
        continue;
      }
      for (let i = 1; i < f.front.length; i++) {
        const a = f.front[i - 1], b = f.front[i];
        // Split only at staircase corridors. The remaining runs stay long and planar.
        const cuts = [a[0], b[0]];
        for (const r of island.ramps || []) {
          const half = r.w / 2 + 1.2;
          for (const x of [r.x - half, r.x + half]) if (x > a[0] && x < b[0]) cuts.push(x);
        }
        cuts.sort((a, b) => a - b);
        const point = x => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
        for (let j = 1; j < cuts.length; j++) {
          const start = point(cuts[j - 1]), end = point(cuts[j]), mid = point((cuts[j - 1] + cuts[j]) / 2);
          if (Math.abs(mid[0] - f.x) > f.rx * 0.76) continue;
          if ((island.ramps || []).some(r => Math.abs(mid[0] - r.x) < r.w / 2 + 1.2 && mid[1] >= Math.min(r.z, r.z2) - 4 && mid[1] <= Math.max(r.z, r.z2) + 4)) continue;
          const low = Math.min(...[start, mid, end].map(([x, z]) => world.terrain.heightAt(x, z - 2))) - 0.6;
          const high = f.h, height = high - low;
          if (height < 2) continue;
          // Recessed middle stratum and proud upper rim break up a flat wall silhouette.
          slab(start, end, low, low + height * 0.38, -0.55, 'stone2');
          slab(start, end, low + height * 0.38, high - 0.45, -0.2, 'stone');
          slab(start, end, high - 0.45, high - 0.12, -0.7, 'earth');
          slab(start, end, high - 0.12, high + 0.015, -0.7, 'edge');
          const n = Math.ceil((end[0] - start[0]) / 4);
          for (let j = 0; j <= n; j++) {
            const x = start[0] + (end[0] - start[0]) * j / n, p = point(x);
            exclusions.push({ x, z: p[1], r: 1.5 });
          }
        }
      }
    }
    const g = k.build('Stratified town cliffs'); add(g);
  }
}
