import * as THREE from 'three';

// Modest, still-usable ground-floor rooms. Keep a broad central aisle from every
// doorway and put the everyday objects against the sides, where a room uses them.
export function furnishRiftInterior(world, house, index, y, k, box) {
  const { x, z, yaw, w, d } = house, floor = 0.12;
  const left = -w / 2 + 2, right = w / 2 - 2, back = -d / 2 + 1.65;
  const kind = ['lodging', 'workroom', 'store', 'sitting room'][index % 4];
  const timber = '#514a48', cloth = ['#666061', '#4d625e', '#655c50'][index % 3];
  const at = (lx, yy, lz) => new THREE.Vector3(x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, y + yy, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz);
  const table = (xx, zz, width = 1.8) => {
    for (const dx of [-width / 2 + 0.15, width / 2 - 0.15]) for (const dz of [-0.4, 0.4]) box(xx + dx, floor, zz + dz, 0.13, 0.85, 0.13, timber);
    box(xx, floor + 0.85, zz, width, 0.14, 1.1, timber);
  };
  const stool = (xx, zz) => {
    box(xx, floor, zz, 0.55, 0.5, 0.55, timber);
    box(xx, floor + 0.5, zz, 0.7, 0.12, 0.7, timber);
  };
  const crate = (xx, zz, base = floor) => {
    box(xx, base, zz, 1.1, 0.85, 0.95, timber);
    for (const yy of [0.14, 0.7]) box(xx, base + yy, zz, 1.14, 0.09, 0.99, 'dark', false);
  };
  // Worn floorboards, a plain runner and beams make the shell feel like a room.
  for (let xx = -w / 2 + 1.3; xx < w / 2 - 1; xx += 0.65) {
    box(xx, floor + 0.005, 0, 0.61, 0.025, d - 2.05, index % 2 ? '#454344' : '#484347', false);
  }
  box(0, floor + 0.035, 0.25, 2.4, 0.025, 3.1, '#454952', false);
  for (const zz of [-2.5, 0, 2.5]) box(0, 3.02, zz, w - 1.8, 0.2, 0.22, timber, false);
  for (const xx of [left, right]) box(xx, floor + 0.85, back - 0.3, 2, 0.15, 0.8, timber);
  for (let i = 0; i < 3; i++) k.prism(left - 0.5 + i * 0.48, floor + 1, back - 0.3, 0.15, 0.28 + i * 0.07, cloth, { sides: 8, top: 0.6 });

  if (kind === 'lodging') {
    box(left, floor, -1.1, 1.9, 0.38, 2.9, timber);
    box(left, floor + 0.38, -1.1, 1.75, 0.19, 2.75, cloth, false);
    box(left, floor + 0.57, -2.05, 1.3, 0.13, 0.55, '#898078', false);
    box(left, floor + 0.57, -0.3, 1.8, 0.06, 1.1, '#414e50', false);
    table(right, -1.7); stool(right, 0);
  } else if (kind === 'workroom') {
    table(left, -1.1, 2.2); stool(left, 0.5); crate(right, back);
    box(left - 0.3, floor + 1, -1.1, 0.9, 0.06, 0.7, '#7b7263', false);
    for (const dx of [-0.6, 0, 0.6]) box(left + dx, floor + 1.08, -1.3, 0.09, 0.09, 0.5, 'metal', false);
    for (const yy of [1.4, 2.1]) box(right, yy, back - 0.3, 2.1, 0.14, 0.8, timber);
  } else if (kind === 'store') {
    for (const zz of [-2.5, -1.3]) crate(left, zz);
    crate(left, -2.5, floor + 0.85); crate(right, back);
    table(right, 0.2, 2.1);
    for (const dx of [-0.5, 0.4]) k.prism(right + dx, floor + 1, 0.2, 0.2, 0.35, cloth, { sides: 8, top: 0.8 });
  } else {
    table(right, -1.3); stool(right, 0.2);
    box(left, floor, -0.5, 1.1, 0.48, 2.8, timber);
    box(left - 0.42, floor + 0.48, -0.5, 0.14, 0.65, 2.8, timber);
    box(left, floor + 0.48, -0.5, 0.8, 0.1, 2.4, cloth, false);
  }
  const cupX = kind === 'workroom' ? left : right;
  const cupZ = { lodging: -1.7, workroom: -1.1, store: 0.2, 'sitting room': -1.3 }[kind];
  k.prism(cupX + 0.4, floor + 1, cupZ, 0.13, 0.24, '#8a8174', { sides: 8 });
  k.lantern(0, 2.3, -1.2, { post: 0, glow: '#d7bd8d', strength: 0.65 });
  box(0, 2.94, -1.2, 0.06, 0.2, 0.06, 'metal', false);
  world.addLight(at(0, 2.65, -1.2), '#d7bd8d', 4.2, 7.5, true, 1.3);
  const room = { type: 'rift_tenement', name: `Drowned ${kind}`, kind, x, z, w, d, rot: yaw,
    floor: y + floor, entrance: at(0, floor, d / 2 + 1), center: at(0, floor, 0.8), loft: null };
  (world.interiors ||= []).push(room);
  (world.riftInteriors ||= []).push(room);
}
