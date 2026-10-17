// Small, reusable camp and roadside scatter. Keeps settlements looking inhabited
// without adding unique characters or new encounter rules.
import * as THREE from 'three';
import { placedPoint } from '../data/worldPlacement.js';
import { Kit } from './kit.js';
import { seededRandom } from '../core/util.js';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function mesh(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function crate(mat, x, y, z, s = 1) {
  const m = mesh(B(0.9 * s, 0.9 * s, 0.9 * s), mat('#8a6a40'), x, y + 0.45 * s, z);
  m.rotation.y = (x + z) * 0.15;
  return m;
}

export function buildDressing(world, exclusions, add, mat) {
  const wood = mat('#6a4a2a');
  const dark = mat('#4a3a28');
  const cloth = mat('#6a5a40');
  const y = (x, z) => world.terrain.heightAt(x, z);

  // Wash shore: tide-line boulders and a cairn on the Seamspire footpath. No camp wall.
  const k = new Kit('ancient', { detail: 1 });
  const rng = seededRandom(3250);
  const boulders = (x, z, s) => {
    const g = y(x, z);
    k.rock(x, g + 0.25 * s, z, 2.6 * s, 1.5 * s, 2.1 * s, 'stone2', { ry: rng() * 3 });
    for (let i = 0; i < 4; i++) {
      const a = rng() * Math.PI * 2, d = (1.6 + rng() * 1.4) * s, q = (0.5 + rng() * 0.6) * s;
      const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
      k.rock(bx, y(bx, bz) + 0.12 * q, bz, 1.4 * q, 0.8 * q, 1.2 * q, i % 2 ? 'stone' : 'stone2', { ry: rng() * 3 });
    }
    world.colliders.addCyl({ x, z, r: 1.0 * s, y0: g - 1, y1: g + 0.9 * s, climbable: true });
  };
  for (const [x, z, s] of [[14, -398, 1.2], [46, -362, 1.0], [41, -318, 0.9], [33, -292, 1.1], [27, -376, 0.8]]) boulders(x, z, s);
  add(k.build('Wash shore stones'));

  // Wash camp: nets, sitting logs and a work pile tying the pavilion to the fire.
  const wash = new THREE.Group();
  wash.name = 'Wash camp dressing';
  wash.userData.dynamic = true;
  const wy = y(-8, -316);
  wash.position.set(-8, wy, -316);
  wash.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.8, 6), dark, 1.6, 0.16, 0.8));
  wash.children[0].rotation.z = 1.2;
  wash.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 6), dark, 2.2, 0.14, 1.4));
  wash.children[1].rotation.z = -0.9;
  wash.add(mesh(B(1.8, 0.08, 1.1), cloth, 3.4, 0.06, -0.4));
  wash.add(crate(mat, -1.2, 0, 1.1, 0.85));
  wash.add(crate(mat, -0.3, 0, 1.4, 0.7));
  const pole = mesh(B(0.12, 2.4, 0.12), wood, -2.4, 1.2, -1.6);
  wash.add(pole);
  wash.add(mesh(B(0.04, 1.1, 0.7), mat('#5a6a50', { double: true }), -2.1, 1.6, -1.6));
  add(wash);
  exclusions.push({ x: -8, z: -316, r: 3.2 });

  // Quiet offerings at a few named ruins so they read as places, not props.
  for (const raw of [[830, 96], [-668, -372], [28, 1074]]) {
    const [x, z] = placedPoint(...raw);
    const g = new THREE.Group();
    g.position.set(x, y(x, z), z);
    g.add(mesh(B(0.7, 0.16, 0.7), wood, 0, 0.08, 0));
    g.add(mesh(B(0.22, 0.28, 0.22), mat('#c8b070'), 0.08, 0.28, -0.05));
    add(g);
  }
}
