import { Kit } from './kit.js';
import { PALETTES } from './style.js';
import { MERIDIAN_BRIDGE } from '../data/meridian.js';
import { placedPoint } from '../data/worldPlacement.js';

// The approaches grade only the banks. This physical span leaves the gorge open.
export function buildMeridianBridge(world, exclusions, add) {
  const { width, depth, deck } = MERIDIAN_BRIDGE;
  const [x, z] = placedPoint(MERIDIAN_BRIDGE.x, MERIDIAN_BRIDGE.z);
  const p = PALETTES.enclave;
  const k = new Kit({ ...p, edge: p.stone, dark: p.timber, metal: '#817452', glow: p.glass });
  const solid = (xx, yy, zz, w, h, d, color = 'stone2', tag = 'meridian_bridge') => {
    k.slab(xx, yy, zz, w, h, d, color);
    world.colliders.addBox({ x: x + xx, z: z + zz, w, d, y0: yy, y1: yy + h, tag });
  };
  const span = 34, rise = 17, spring = deck - rise - 1.8;
  k.arch(0, spring, 0, span, { rise, t: 1, depth: depth - 0.3, segments: 24,
    spandrel: true, spandrelH: 0.35, c: 'stone', fill: 'stone2' });
  // Conservative arch soffit collision, leaving the ravine passable underneath.
  for (let i = 0; i < 34; i++) {
    const xx = -span / 2 + i + 0.5;
    const edge = Math.max(Math.abs(xx - 0.5), Math.abs(xx + 0.5));
    const bottom = spring + rise * Math.sqrt(Math.max(0, 1 - (edge / (span / 2)) ** 2));
    world.colliders.addBox({ x: x + xx, z, w: 1, d: depth - 0.3, y0: bottom,
      y1: deck - 0.45, walkable: false, tag: 'meridian_bridge_arch' });
  }
  for (const side of [-1, 1]) {
    const xx = side * (width / 2 - 3);
    let foot = spring - 1;
    for (const dx of [-3, 0, 3]) for (const dz of [-3, 3]) {
      foot = Math.min(foot, world.terrain.heightAt(x + xx + dx, z + dz) - 0.5);
    }
    solid(xx, foot, 0, 6, deck - 0.45 - foot, depth + 0.8);
  }
  solid(0, deck - 0.45, 0, width, 0.45, depth, 'stone');
  for (const side of [-1, 1]) {
    const zz = side * (depth / 2 - 0.25);
    solid(0, deck, zz, width, 1.15, 0.5, 'stone2', 'meridian_bridge_parapet');
    k.slab(0, deck + 1.15, zz, width + 0.2, 0.2, 0.7, 'stone');
    for (const xx of [-21, -11, 0, 11, 21]) {
      solid(xx, deck, zz, 0.8, 1.55, 0.85, 'stone');
      if (Math.abs(xx) === 21) k.lantern(xx, deck + 1.55, zz, { post: 1.6 });
    }
  }
  const group = k.build('Meridian Signal Bridge'); group.position.set(x, 0, z); add(group);
  for (let xx = -width / 2; xx <= width / 2; xx += 3) exclusions.push({ x: x + xx, z, r: 5 });
  world.meridianBridge = { x, z, width, depth, deck };
}
