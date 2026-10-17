// Street furniture shares placement rules, while colours and materials stay regional.
import { Kit } from './kit.js';
import { PALETTES } from './style.js';

export function buildSettlementFixture(world, s, add, exclusions) {
  if (!['civic_court', 'civic_seat', 'civic_rail', 'civic_standard', 'civic_bunting'].includes(s.type)) return false;
  const p = PALETTES[s.style || 'salt'];
  const k = new Kit({ ...p, edge: p.stone, dark: p.timber, metal: p.timber, glow: p.lantern });
  const yaw = s.rot || 0, y = world.terrain.heightAt(s.x, s.z);
  const point = (x, z) => [s.x + Math.cos(yaw) * x + Math.sin(yaw) * z, s.z - Math.sin(yaw) * x + Math.cos(yaw) * z];
  const ground = (x, z) => world.terrain.heightAt(...point(x, z)) - y;
  const box = (x, base, z, w, h, d, color, solid = true) => {
    k.slab(x, base, z, w, h, d, color);
    if (solid) {
      const [wx, wz] = point(x, z);
      world.colliders.addBox({ x: wx, z: wz, w, d, y0: y + base, y1: y + base + h, rot: yaw, tag: 'civic_fixture' });
    }
  };
  if (s.type === 'civic_court') {
    // Flush concentric bands bind the tree, seats and neighbouring doors together.
    for (const radius of [s.r - 2, s.r]) {
      const n = Math.ceil(radius * Math.PI * 2 / 0.8);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
        k.slab(x, ground(x, z) + 0.025, z, 0.83, 0.045, 0.24, 'stone2', { ry: a });
      }
    }
    exclusions.push({ x: s.x, z: s.z, r: s.r + 1 });
  } else if (s.type === 'civic_seat') {
    // Low timber seats on masonry feet, with planted end boxes.
    for (const x of [-1.25, 1.25]) box(x, ground(x, 0) - 0.2, 0, 0.5, Math.max(0.65, 0.65 - ground(x, 0)), 0.65, 'stone2');
    box(0, 0.45, 0, 3.4, 0.16, 0.8, 'timber');
    box(0, 0.8, -0.35, 3.4, 0.45, 0.12, 'timber');
    if (s.planter !== false) for (const x of [-2.3, 2.3]) {
      const gy = ground(x, 0);
      box(x, gy, 0, 0.95, 0.75, 1, 'stone2');
      box(x, gy + 0.75, 0, 1.05, 0.12, 1.1, 'stone');
      for (const dx of [-0.24, 0, 0.24]) k.prism(x + dx, gy + 0.87, 0, 0.25, 0.45 + Math.abs(dx), s.style === 'frost' ? '#798d80' : '#587044', { sides: 5, top: 0.5 });
    }
    exclusions.push({ x: s.x, z: s.z, r: 3.5 });
  } else if (s.type === 'civic_rail') {
    const length = Math.hypot(s.x2 - s.x, s.z2 - s.z), n = Math.ceil(length / 2.5);
    // Rails follow the upper lip of the actual shelf, not a floating constant height.
    for (let i = 0; i < n; i++) {
      const a = i * length / n, b = (i + 1) * length / n;
      const low = Math.min(ground(0, a), ground(0, b)), high = Math.max(ground(0, a), ground(0, b));
      box(0, low - 0.25, (a + b) / 2, 0.45, high - low + 0.55, b - a + 0.03, 'stone2');
      for (const h of [0.58, 1.1]) box(0, high + h, (a + b) / 2, 0.13, 0.14, b - a + 0.04, 'timber');
      for (const t of [0, 0.5]) box(0, high + 0.3, a + (b - a) * t, 0.14, 0.85, 0.14, 'timber');
      exclusions.push({ x: point(0, a)[0], z: point(0, a)[1], r: 1 });
    }
    box(0, ground(0, length), length, 0.22, 1.25, 0.22, 'stone');
  } else if (s.type === 'civic_standard') {
    const h = s.h || 12, w = s.w || 3.5;
    box(0, -0.3, 0, 0.8, 0.65, 0.8, 'stone2');
    box(0, 0, 0, 0.22, h + 0.5, 0.22, 'timber');
    box(w / 2, h - 0.2, 0, w + 0.5, 0.16, 0.18, 'timber', false);
    // A split sail-shaped banner, outlined in the town's ochre livery.
    const cloth = s.color || p.cloth;
    box(w / 2, h - 5, 0, w, 4.8, 0.07, cloth, false);
    for (const x of [0.15, w - 0.15]) box(x, h - 5.6, 0, 0.3, 5.4, 0.09, p.accent, false);
    box(w / 2, h - 3.8, 0.055, 0.18, 2.4, 0.05, 'stone', false);
    box(w / 2, h - 3.4, 0.055, 1.1, 0.18, 0.05, 'stone', false);
    exclusions.push({ x: s.x, z: s.z, r: 1 });
  } else {
    const length = Math.hypot(s.x2 - s.x, s.z2 - s.z), h = s.h || 7;
    for (const z of [0, length]) box(0, ground(0, z) - 0.3, z, 0.18, h + 0.3, 0.18, 'timber');
    const n = Math.ceil(length / 0.8), end = ground(0, length);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, z = length * t;
      const base = h + end * t - Math.sin(t * Math.PI) * 1.1;
      box(0, base, z, 0.05, 0.05, length / n + 0.06, 'timber', false);
      if (i % 2 === 0) {
        k.wedge(0, base - 0.8, z, 0.6, 0.8, 0.05, i % 4 ? p.cloth : p.accent, { ry: Math.PI / 2, rz: Math.PI });
      }
    }
  }
  const g = k.build(s.name || s.type); g.position.set(s.x, y, s.z); g.rotation.y = yaw; add(g);
  return true;
}
