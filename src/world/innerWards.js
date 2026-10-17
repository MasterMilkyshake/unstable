import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';
import { samplePath } from './paths.js';

// Narrower, lower curtains distinguish the civic and command wards from the
// outer defenses. Short tangent bays turn continuously around the authored bends.
export function buildInnerWard(world, ward, exclusions) {
  const root = new THREE.Group(); root.name = ward.name;
  const p = PALETTES[ward.palette], palette = { ...p, edge: p.stone, dark: p.timber, glow: p.glass, metal: p.ridge };
  const bays = [];
  for (const points of ward.walls) {
    const samples = samplePath({ points, width: 1.6 }, 2.8);
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
      const yaw = -Math.atan2(b.z - a.z, b.x - a.x), width = Math.hypot(b.x - a.x, b.z - a.z) + 0.12;
      const frame = siteFrame(world, x, z, yaw, 0), grounds = [];
      for (const lx of [-width / 2, 0, width / 2]) for (const lz of [-1.1, 0, 1.1]) grounds.push(frame.ground(lx, lz));
      const bottom = Math.min(...grounds) - 1.2, top = Math.ceil((Math.max(...grounds) + ward.height) * 2) / 2;
      const k = new Kit(palette), g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = yaw;
      const solid = (y, w, h, d, color) => {
        k.slab(0, y, 0, w, h, d, color);
        frame.solid(0, 0, w, d, y, y + h, { tag: ward.id });
      };
      solid(bottom, width, top - bottom, 1.6, 'stone2');
      solid(top - 0.25, width + 0.15, 0.3, 2, 'edge');
      solid(top + 0.05, width, 0.55, 1.6, 'stone');
      solid(top + 0.6, 0.95, 0.95, 1.7, 'edge');
      // Broad piers punctuate a curved run without making a tower at every bend.
      if (i % 5 === 1 || i === samples.length - 1) {
        solid(bottom, 1.1, top - bottom + 0.7, 2.2, 'stone');
        solid(top + 0.7, 1.4, 0.3, 2.5, 'edge');
      }
      for (let y = bottom + 1.4; y < top; y += 1.4) for (const side of [-1, 1]) {
        k.slab(0, y, side * 0.805, width, 0.025, 0.015, p.stone, { grad: 0 });
      }
      g.add(k.build('inner_curtain')); root.add(g);
      exclusions.push({ x, z, r: 3 }); bays.push({ x, z, top, bottom });
    }
  }
  for (const gate of ward.gates) {
    const base = world.terrain.heightAt(gate.x, gate.z);
    const frame = siteFrame(world, gate.x, gate.z, gate.rot, base);
    const k = new Kit(palette), g = new THREE.Group();
    g.name = `${ward.name} gateway`; g.position.set(gate.x, base, gate.z); g.rotation.y = gate.rot;
    const spring = Math.max(5, ...bays.filter(b => Math.hypot(b.x - gate.x, b.z - gate.z) < 12).map(b => b.top - base - 2));
    const rise = 3.5, crown = spring + rise + 1.2;
    for (const side of [-1, 1]) {
      const x = side * (gate.span / 2 + 0.7), bottom = Math.min(-1.2, frame.lowest(1.6, 2.8, x) - 1);
      k.slab(x, bottom, 0, 1.6, crown - bottom, 2.8, 'stone2');
      frame.solid(x, 0, 1.6, 2.8, bottom, crown, { tag: ward.id });
      k.slab(x, crown, 0, 2.1, 0.4, 3.2, 'edge');
      k.slab(x, crown + 0.4, 0, 1.2, 1.2, 2.4, 'stone');
      k.banner(x, spring - 1, -1.48, 0.8, 3, p.cloth);
      for (const face of [-1, 1]) k.lantern(x, 3, face * 1.6, { post: 0 });
    }
    k.arch(0, spring, 0, gate.span, { rise, depth: 2.7, t: 0.7, spandrel: true });
    k.slab(0, crown, 0, gate.span + 3, 0.4, 3.2, 'edge');
    frame.solid(0, 0, gate.span + 3, 3.2, crown, crown + 0.4, { tag: ward.id });
    for (let x = -gate.span / 2; x <= gate.span / 2; x += 2) {
      k.slab(x, crown + 0.4, 0, 0.9, 0.9, 2.7, 'stone');
      frame.solid(x, 0, 0.9, 2.7, crown + 0.4, crown + 1.3, { tag: ward.id });
    }
    for (let i = 0; i < 24; i++) {
      const x = -gate.span / 2 + (i + 0.5) * gate.span / 24;
      const soffit = spring + rise * Math.sqrt(1 - (x / (gate.span / 2)) ** 2);
      frame.solid(x, 0, gate.span / 24, 2.7, soffit, crown, { tag: ward.id });
    }
    g.add(k.build('inner_gate')); root.add(g);
    exclusions.push({ x: gate.x, z: gate.z, r: gate.span / 2 + 3 });
  }
  (world.innerWards ||= []).push({ ...ward, bays, group: root });
  return root;
}
