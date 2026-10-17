// The things factions carry and set up on the roads (game/worldLife.js): a supply cart, the
// Enclave's and the Watch's checkpoint barricades, and a dropped bundle a contract sends you to
// recover (game/contracts.js). Built once, hidden, and lent out, so an
// event never builds a mesh or compiles a material in play (docs/ARCHITECTURE.md, "Keeping
// frames even"): the warm-up uploads them with the rest of the scene behind the menu.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { PALETTES } from './style.js';

const POOL = { cart: 3, barricade_enclave: 3, barricade_watch: 2, bundle: 2, flotsam: 8 };
const free = new Map();
let built = null;

function cart() {
  const k = new Kit({ ...PALETTES.ancient, wood: '#6a4a2c', wood2: '#5a3e24', iron: '#2e2c2a', cloth: '#b8a888' }, { detail: 1 });
  k.slab(0, 0.55, 0, 1.6, 0.14, 2.8, 'wood');
  for (const s of [-1, 1]) {
    k.slab(s * 0.78, 0.69, 0, 0.08, 0.5, 2.8, 'wood2');
    k.at({ x: s * 0.88, y: 0.5, z: -0.3, rz: Math.PI / 2 }, (q) => q.prism(0, -0.06, 0, 0.5, 0.12, 'wood2', { sides: 10 }));
  }
  k.slab(0, 0.42, 1.9, 0.12, 0.12, 1.4, 'wood2');
  for (const [x, z, s] of [[-0.35, -0.6, 0.6], [0.35, -0.5, 0.55], [0, 0.4, 0.62], [-0.3, 0.95, 0.5]]) k.slab(x, 0.69, z, s, s, s, 'wood');
  k.slab(0, 1.05, 0.1, 1.5, 0.08, 2.2, 'cloth');
  const g = k.build('life_cart');
  return g;
}

function barricade(enclave) {
  const k = new Kit({ ...PALETTES.ancient, wood: enclave ? '#2e2a28' : '#5e4834', wood2: enclave ? '#3a3532' : '#4d3b2b', cloth: enclave ? '#8e1f24' : '#2a4a7a' }, { detail: 1 });
  // two trestles of crossed stakes, a pole between, a pennant at each end
  for (const s of [-1, 1]) {
    for (const r of [-0.6, 0.6]) k.at({ x: s * 2.2, y: 0, z: 0, rz: r }, (q) => q.slab(0, 0, 0, 0.14, 1.5, 0.14, 'wood2'));
    k.slab(s * 2.2, 1.6, 0, 0.1, 1.6, 0.1, 'wood');
    k.banner(s * 2.2 + 0.32 * s, 2.6, 0, 0.6, 0.55, 'cloth');
  }
  k.slab(0, 1.0, 0, 4.6, 0.16, 0.16, 'wood');
  if (enclave) for (let i = -1; i <= 1; i++) k.slab(i * 1.3, 0.92, 0, 0.6, 0.2, 0.18, '#d8d0c0');
  return k.build(enclave ? 'life_barricade_enclave' : 'life_barricade_watch');
}

// a satchel, case or coil dropped in the grass: a leather bundle with its strap loose
function bundle() {
  const k = new Kit({ ...PALETTES.ancient, leather: '#5a4030', leather2: '#4a3426', brass: '#a08850', rope: '#b8a070' }, { detail: 1 });
  k.slab(0, 0, 0, 0.5, 0.26, 0.34, 'leather', { ry: 0.3 });
  k.slab(0.02, 0.26, -0.02, 0.46, 0.06, 0.3, 'leather2', { ry: 0.3 });
  k.slab(0.05, 0.12, 0.17, 0.08, 0.08, 0.02, 'brass', { ry: 0.3 });
  k.at({ x: -0.32, y: 0.02, z: 0.2, rz: Math.PI / 2 }, (q) => q.prism(0, 0, 0, 0.16, 0.08, 'rope', { sides: 8 }));
  k.slab(0.3, 0.01, 0.35, 0.05, 0.02, 0.6, 'leather2', { ry: -0.6 });
  return k.build('life_bundle');
}

// wreckage afloat: a split plank, a stove-in cask and a snarl of line
function flotsam() {
  const k = new Kit({ ...PALETTES.ancient, wood: '#5e4630', wood2: '#4a3626', rope: '#a89060' }, { detail: 1 });
  k.slab(0, 0, 0, 0.5, 0.14, 2.6, 'wood', { ry: 0.2 });
  k.slab(0.5, 0.02, 0.6, 0.4, 0.12, 1.4, 'wood2', { ry: -0.4 });
  k.prism(-0.6, -0.1, -0.5, 0.36, 0.6, 'wood2', { sides: 8 });
  k.slab(0.2, 0.12, -0.9, 0.7, 0.05, 0.08, 'rope', { ry: 0.9 });
  return k.build('life_flotsam');
}

// Build the pool once (game/worldLife.js calls this at boot and at game start).
export function buildLifeProps(world) {
  if (built) return built;
  built = [];
  for (const [kind, n] of Object.entries(POOL)) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const object = kind === 'cart' ? cart() : kind === 'bundle' ? bundle() : kind === 'flotsam' ? flotsam() : barricade(kind === 'barricade_enclave');
      object.visible = false;
      object.userData.dynamic = true;
      world.scene.add(object);
      list.push({ kind, object, dirty: false });
      built.push(object);
    }
    free.set(kind, list);
  }
  return built;
}

// Lend a prop at a place: shown there until it is given back.
export function lifeProp(kind, x, y, z, yaw = 0) {
  const list = free.get(kind);
  const p = list && list.length ? list.pop() : null;
  if (!p) {
    // none left (or none built, in tools and tests): a placeholder where it would stand
    const object = new THREE.Object3D();
    object.position.set(x, y, z);
    object.rotation.y = yaw;
    return { kind, object, dirty: false, spare: true };
  }
  p.object.position.set(x, y, z);
  p.object.rotation.y = yaw;
  p.object.visible = true;
  return p;
}
export function releaseLifeProp(p) {
  if (!p || p.spare) return;
  p.object.visible = false;
  free.get(p.kind)?.push(p);
}
