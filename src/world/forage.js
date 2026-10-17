// Gatherable foraging nodes (berry bushes, hives, lilies, peppers, salt, glowcaps, mendleaf),
// scattered per biome. Gathering grants ingredients; nodes regrow after a while.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ISLANDS, islandBiomeRegions, islandScatter, biomeOfPoint } from '../data/world.js';
import { ITEMS } from '../data/items.js';
import { seededRandom } from '../core/util.js';
import { mat } from './props.js';
import { excludedAt } from './exclusionIndex.js';

// kind -> { item, count:[min,max], respawn (s), biomes: {biome: count}, minH, maxH, label }
export const FORAGE = {
  berry_bush: { item: 'berries', count: [2, 3], respawn: 240, biomes: { forest: 14, emberwood: 8, meadow: 8, beach: 3, jungle: 14, farmland: 6, highland: 5, bastion: 6, rock: 1 }, minH: 1.5, maxH: 40, label: 'Pick Thornberries' },
  beehive: { item: 'honeycomb', count: [1, 2], respawn: 320, biomes: { forest: 8, meadow: 4, jungle: 10, farmland: 6, bastion: 3 }, minH: 1.5, maxH: 40, label: 'Take Honeycomb' },
  frost_lily: { item: 'frost_lily', count: [1, 2], respawn: 260, biomes: { snow: 14, tundra: 10 }, minH: 2, maxH: 60, label: 'Pick Frost Lily' },
  ember_pepper: { item: 'ember_pepper', count: [1, 2], respawn: 260, biomes: { volcanic: 12, ashfield: 10, emberwood: 4 }, minH: 2, maxH: 45, label: 'Pick Ember Peppers' },
  salt_crust: { item: 'salt', count: [1, 3], respawn: 200, biomes: { beach: 6, meadow: 5, marsh: 3, forest: 3, jungle: 3, bastion: 4, hush: 3, rock: 3, farmland: 2 }, minH: 0.2, maxH: 2.2, label: 'Scrape Sea Salt' },
  glowcap: { item: 'mushroom', count: [1, 2], respawn: 220, biomes: { marsh: 12, forest: 4, emberwood: 4, rift: 8, jungle: 6, hush: 10, highland: 2 }, minH: -0.6, maxH: 40, label: 'Gather Glowcaps' },
  mendleaf: { item: 'herb', count: [1, 1], respawn: 280, biomes: { marsh: 6, meadow: 5, forest: 5, emberwood: 4, jungle: 8, farmland: 4, highland: 5, bastion: 4, hush: 5, tundra: 2 }, minH: 0.5, maxH: 40, label: 'Gather Mendleaf' },
  // last, so the scatter of every kind above stays where it was: Sticks for a campfire (game/camp.js)
  fallen_branch: { item: 'stick', count: [2, 3], respawn: 200, biomes: { forest: 12, jungle: 10, emberwood: 6, highland: 6, meadow: 4, marsh: 4, farmland: 4, beach: 3 }, minH: 0.5, maxH: 60, label: 'Gather Sticks' },
};

const skepProfile = [
  new THREE.Vector2(0.06, 0),
  new THREE.Vector2(0.30, 0.04),
  new THREE.Vector2(0.38, 0.14),
  new THREE.Vector2(0.40, 0.28),
  new THREE.Vector2(0.36, 0.42),
  new THREE.Vector2(0.28, 0.54),
  new THREE.Vector2(0.16, 0.64),
  new THREE.Vector2(0.05, 0.70),
  new THREE.Vector2(0, 0.72),
];

const geo = {
  bush: new THREE.IcosahedronGeometry(0.7, 0),
  berry: new THREE.SphereGeometry(0.09, 5, 4),
  stump: new THREE.CylinderGeometry(0.32, 0.40, 0.55, 8),
  stumpCap: new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8),
  // Wild skep: lathed wax dome with horizontal comb ridges and a dark entrance.
  skep: new THREE.LatheGeometry(skepProfile, 10),
  hiveBand: new THREE.TorusGeometry(0.34, 0.035, 5, 10),
  hiveMouth: new THREE.CylinderGeometry(0.07, 0.09, 0.08, 6),
  hiveDrip: new THREE.SphereGeometry(0.05, 5, 4),
  stem: new THREE.CylinderGeometry(0.025, 0.03, 0.4, 4),
  petal: new THREE.ConeGeometry(0.12, 0.22, 5),
  crust: new THREE.DodecahedronGeometry(0.32, 0),
  cap: new THREE.SphereGeometry(0.2, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2),
  leaf: new THREE.ConeGeometry(0.16, 0.5, 3),
  branch: new THREE.CylinderGeometry(0.035, 0.05, 1.0, 5),
};

function part(g, m, x, y, z, parent) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}

function buildNodeMesh(kind, rng) {
  const g = new THREE.Group();
  const fruit = new THREE.Group(); // hidden when picked
  g.add(fruit);
  switch (kind) {
    case 'berry_bush': {
      const b = part(geo.bush, mat('#3f6e34'), 0, 0.55, 0, g);
      b.scale.set(1.1, 0.8, 1.1);
      const bm = mat('#c2283a', { emissive: '#5a0a12', ei: 0.4 });
      for (let i = 0; i < 9; i++) {
        const a = rng() * Math.PI * 2;
        part(geo.berry, bm, Math.cos(a) * 0.62, 0.35 + rng() * 0.55, Math.sin(a) * 0.62, fruit);
      }
      break;
    }
    case 'beehive': {
      // Stump + hive are one gatherable — both hide when taken so we never leave a lone trunk.
      // Seat the stump a little into the turf so block terrain never floats it.
      part(geo.stump, mat('#6a4a32'), 0, 0.12, 0, fruit);
      part(geo.stumpCap, mat('#8a6a48'), 0, 0.42, 0, fruit);
      const wax = mat('#e0b048', { emissive: '#5a3808', ei: 0.35 });
      const comb = mat('#c49030', { emissive: '#3a2400', ei: 0.25 });
      const skep = part(geo.skep, wax, 0, 0.46, 0, fruit);
      skep.scale.set(1.05, 1.05, 1.05);
      // Comb ridges so it reads as layered wax, not a smooth egg.
      for (const [y, s] of [[0.18, 1.05], [0.34, 0.95], [0.48, 0.78]]) {
        const band = part(geo.hiveBand, comb, 0, 0.46 + y, 0, fruit);
        band.rotation.x = Math.PI / 2;
        band.scale.set(s, s, 1);
      }
      // Entrance hole on the face.
      const mouth = part(geo.hiveMouth, mat('#2a1808'), 0, 0.76, 0.36, fruit);
      mouth.rotation.x = Math.PI / 2;
      // A couple of honey drips under the mouth.
      part(geo.hiveDrip, wax, 0.04, 0.66, 0.38, fruit).scale.set(0.7, 1.4, 0.7);
      part(geo.hiveDrip, wax, -0.05, 0.62, 0.36, fruit).scale.set(0.55, 1.1, 0.55);
      break;
    }
    case 'frost_lily': {
      const pm = mat('#eef6ff', { emissive: '#6ab8ff', ei: 0.5 });
      for (let i = 0; i < 3; i++) {
        const x = (rng() - 0.5) * 0.5;
        const z = (rng() - 0.5) * 0.5;
        part(geo.stem, mat('#4a7a6a'), x, 0.2, z, g);
        const p = part(geo.petal, pm, x, 0.44, z, fruit);
        p.rotation.x = Math.PI;
      }
      break;
    }
    case 'ember_pepper': {
      part(geo.leaf, mat('#3a4a2a'), 0, 0.25, 0, g).scale.set(2, 1, 2);
      const pm = mat('#ff4a1a', { emissive: '#ff3a00', ei: 0.9 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const p = part(geo.petal, pm, Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18, fruit);
        p.scale.set(0.6, 1.2, 0.6);
        p.rotation.x = Math.PI;
      }
      break;
    }
    case 'salt_crust': {
      for (let i = 0; i < 3; i++) {
        const c = part(geo.crust, mat('#f2efe6', { roughness: 0.5 }), (rng() - 0.5) * 0.7, 0.08, (rng() - 0.5) * 0.7, fruit);
        c.scale.set(1, 0.45, 1);
      }
      break;
    }
    case 'glowcap': {
      const cm = mat('#3affc8', { emissive: '#1aa880', ei: 1.1 });
      for (let i = 0; i < 4; i++) {
        const x = (rng() - 0.5) * 0.6;
        const z = (rng() - 0.5) * 0.6;
        const s = 0.6 + rng() * 0.6;
        part(geo.stem, mat('#d8d0b8'), x, 0.12 * s, z, g).scale.setScalar(s * 0.7);
        part(geo.cap, cm, x, 0.24 * s, z, fruit).scale.setScalar(s);
      }
      break;
    }
    case 'fallen_branch': {
      // a few dry branches lying in the litter, all taken when gathered
      const bm = mat('#7a5a3a');
      for (let i = 0; i < 4; i++) {
        const b = part(geo.branch, bm, (rng() - 0.5) * 0.6, 0.05, (rng() - 0.5) * 0.6, fruit);
        b.rotation.set(Math.PI / 2, rng() * Math.PI * 2, 0, 'YXZ');
        b.scale.set(1, 0.6 + rng() * 0.6, 1);
      }
      break;
    }
    case 'mendleaf': {
      const lm = mat('#6ad86a', { emissive: '#1a5a1a', ei: 0.4 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const l = part(geo.leaf, lm, Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12, fruit);
        l.rotation.z = Math.cos(a) * 0.6;
        l.rotation.x = -Math.sin(a) * 0.6;
      }
      break;
    }
  }
  return { group: g, fruit };
}

// Nodes are drawn as instanced batches (one per geometry+material+island) so a hundred
// bushes cost a handful of draw calls. A picked node hides its fruit by zero-scaling instances.
class Batcher {
  constructor() {
    this.groups = new Map(); // key -> { geo, mat, items: [{ m: Matrix4, ref }] }
  }
  add(geo, mat, matrix, ref, island) {
    const key = `${island}|${geo.uuid}|${mat.uuid}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { geo, mat, items: [] }));
    g.items.push({ m: matrix.clone(), ref });
  }
  build(scene) {
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.items.length);
      im.castShadow = true;
      im.receiveShadow = true;
      g.items.forEach((it, i) => {
        im.setMatrixAt(i, it.m);
        if (it.ref) it.ref.push({ im, i, m: it.m });
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      scene.add(im);
    }
  }
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function buildForage(world, exclusions) {
  const terrain = world.terrain;
  const nodes = [];
  const nrm = new THREE.Vector3();
  const batch = new Batcher();
  const excluded = (x, z) => excludedAt(exclusions, x, z, 3);
  for (const isl of ISLANDS) {
    const rng = seededRandom(isl.seed * 7919 + 101);
    for (const kind in FORAGE) {
      const def = FORAGE[kind];
      for (const region of islandBiomeRegions(isl)) {
        const n = Math.round((def.biomes[region.biome] || 0) * region.area);
        for (let i = 0; i < n; i++) {
          let spot = null;
          for (let t = 0; t < 40 && !spot; t++) {
            const [x, z] = islandScatter(isl, rng, region.zone);
            if (biomeOfPoint(isl, x, z) !== region.biome) continue;
            const h = terrain.heightAt(x, z);
            if (h < def.minH || h > def.maxH) continue;
            terrain.normalAt(x, z, nrm);
            if (nrm.y < 0.8 || excluded(x, z)) continue;
            if (world.colliders.groundAt(x, z, h + 3) > h + 0.3) continue; // under a roof / inside something
            spot = { x, z, h };
          }
          if (!spot) continue;
          const { group, fruit } = buildNodeMesh(kind, rng);
          group.position.set(spot.x, spot.h, spot.z);
          group.rotation.y = rng() * Math.PI * 2;
          group.updateMatrixWorld(true);
          const node = { kind, def, fruitParts: [], ready: true, readyAt: 0, pos: new THREE.Vector3(spot.x, spot.h + 0.6, spot.z) };
          group.traverse((o) => {
            if (!o.isMesh) return;
            let inFruit = false;
            for (let q = o.parent; q; q = q.parent) if (q === fruit) inFruit = true;
            batch.add(o.geometry, o.material, o.matrixWorld, inFruit ? node.fruitParts : null, isl.id);
          });
          nodes.push(node);
          world.addInteract({
            id: `forage_${nodes.length}`, kind: 'forage', pos: node.pos, radius: 2.3, label: def.label,
            enabled: () => world.time >= node.readyAt,
            use: (game) => gather(game, world, node),
          });
        }
      }
    }
  }
  batch.build(world.scene);
  // regrowth: show/hide fruit instances when a node's state flips
  world.animated.push(() => {
    for (const n of nodes) {
      const ready = world.time >= n.readyAt;
      if (n.ready === ready) continue;
      n.ready = ready;
      for (const f of n.fruitParts) {
        f.im.setMatrixAt(f.i, ready ? f.m : ZERO);
        f.im.instanceMatrix.needsUpdate = true;
      }
    }
  });
  world.forageNodes = nodes;
  return nodes;
}

function gather(game, world, node) {
  if (world.time < node.readyAt) return;
  const def = node.def;
  const [a, b] = def.count;
  let n = a + Math.floor(Math.random() * (b - a + 1));
  const p = G.player;
  if (p && p.mods.forager) n += 1;
  node.readyAt = world.time + def.respawn * (0.85 + Math.random() * 0.3);
  game.giveItem(def.item, n);
  G.audio.play('step', { pos: node.pos, pitch: 1.4, vol: 0.8 });
  const it = ITEMS[def.item];
  G.vfx.burst(node.pos.clone(), 'phys', 10, { color: def.item === 'salt' ? '#ffffff' : def.item === 'ember_pepper' ? '#ff6a2a' : def.item === 'stick' ? '#a07850' : '#9fe08a', speed: 2.5, up: 2 });
  if (p && p.model && p.model.anim && p.model.anim.playPose) p.model.anim.playPose('eat', 0.5);
  if (it && it.type === 'food' && !game.ch.flags.foragedOnce) {
    game.ch.flags.foragedOnce = true;
    G.ui.toast('Cook ingredients into meals at any campfire.', 'quest');
  }
}
