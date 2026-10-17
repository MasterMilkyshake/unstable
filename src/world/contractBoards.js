// The contract boards (game/contracts.js): a notice board on two posts beside each faction's
// officer, under a little pent roof, its face pinned with the faction's postings and its
// colours on a pennant. Built once at boot as one static, merged kit with its colliders, so
// nothing is built or compiled in play.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { mergeStatic } from './merge.js';
import { PALETTES } from './style.js';

const W = 1.7; // the board's width
const SPOTS = [[2.2, 0.4], [-2.2, 0.4], [2.4, -1.2], [-2.4, -1.2], [0, -2.2], [3.2, 1.6], [-3.2, 1.6]];

// Where a board can stand beside an officer: the first of a few places round them, to their
// right first, with level floor under it and nothing in its way.
export function boardSpot(world, officer) {
  const { x, y, z } = officer.pos;
  const yaw = officer.yaw ?? 0;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const probe = new THREE.Vector3();
  for (const [lx, lz] of SPOTS) {
    const bx = x + lx * c + lz * s, bz = z - lx * s + lz * c;
    const by = world.groundAt(bx, bz, y + 1.2);
    if (Math.abs(by - y) > 0.35) continue;
    let clear = true;
    for (const [ox, oz] of [[0, 0], [-W / 2, 0], [W / 2, 0]]) {
      probe.set(bx + ox * c, by + 0.05, bz - ox * s);
      const before = probe.clone();
      world.colliders.resolve(probe, 0.35, 2.2);
      if (probe.distanceTo(before) > 0.02) clear = false;
    }
    if (clear) return { x: bx, y: by, z: bz, yaw };
  }
  return null;
}

// boards: [{ faction, color, x, y, z, yaw }]
export function buildContractBoards(world, boards) {
  const k = new Kit({ ...PALETTES.ancient, wood: '#5e4834', wood2: '#4d3b2b', paper: '#d8ccb0', paper2: '#c8b894', iron: '#2e2c2a' }, { detail: 1 });
  for (const b of boards) {
    k.at({ x: b.x, y: b.y, z: b.z, ry: b.yaw }, (q) => {
      for (const sx of [-1, 1]) q.slab(sx * (W / 2 + 0.06), 0, 0, 0.14, 2.3, 0.14, 'wood2');
      q.slab(0, 0.95, 0, W, 1.05, 0.08, 'wood');
      q.slab(0, 2.0, 0, W + 0.12, 0.08, 0.1, 'wood2');
      q.at({ x: 0, y: 2.3, z: 0.05, rx: -0.5 }, (r) => r.slab(0, 0, 0, W + 0.5, 0.06, 0.62, 'wood2'));
      // the postings: three pinned sheets and a torn one
      for (const [px, py, pw, ph, c] of [[-0.5, 1.2, 0.42, 0.56, 'paper'], [0.05, 1.32, 0.38, 0.5, 'paper2'], [0.55, 1.15, 0.4, 0.6, 'paper'], [-0.1, 1.0, 0.3, 0.22, 'paper2']]) {
        q.slab(px, py, 0.05, pw, ph, 0.02, c, { grad: 0 });
        q.slab(px, py + ph - 0.06, 0.07, 0.04, 0.04, 0.02, 'iron');
      }
      q.banner(W / 2 + 0.06, 1.35, 0.1, 0.36, 0.6, b.color);
    });
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    for (const sx of [-1, 1]) {
      const px = b.x + sx * (W / 2 + 0.06) * c, pz = b.z - sx * (W / 2 + 0.06) * s;
      world.colliders.addCyl({ x: px, z: pz, r: 0.1, y0: b.y - 0.2, y1: b.y + 2.3 });
    }
    world.colliders.addBox({ x: b.x, z: b.z, w: W, d: 0.1, y0: b.y + 0.95, y1: b.y + 2.0, rot: b.yaw, climbable: false, walkable: false, tag: 'contract_board' });
  }
  const g = k.build('contract_boards');
  world.scene.add(g);
  mergeStatic(world.scene, [g]);
  return g;
}
