// Vegetation scattering (instanced) and hand-placed structures with colliders,
// interactables and light sources.
import * as THREE from 'three';
import { seededRandom, smoothstep, hypot } from '../core/util.js';
import { Noise2D } from '../core/noise.js';
import { inSightline } from '../data/vistas.js';
import { ISLANDS, STRUCTURES, islandBiomeRegions, islandScatter, biomeOfPoint, regionAtPoint } from '../data/world.js';
import { act } from '../game/hooks.js';
import { G } from '../core/globals.js';
import { mergeStatic } from './merge.js';
import { buildShelfFaces } from './shelfFaces.js';
import { buildArchitecture, buildCivicTower, detailHut, kit as civicKit } from './architecture.js';
import { buildFenFeature } from './fenArchitecture.js';
import { buildFeature } from './etris.js';
import { buildSettlementFixture } from './settlementFixtures.js';
import { buildCrucible, buildVowPerch, buildStall, buildLanternTree, buildTerraceStair, buildLamp, buildWell, buildStreet } from './civic.js';
import { buildSoundingHouse } from './seats.js';
import { buildChairFields, buildListeningStones, buildMothersMire } from './sites.js';
import { buildLightTower, buildBeaconPost, buildSignalCamp } from './outposts.js';
import { ROADS } from '../data/roads.js';
import { samplePath } from './paths.js';
import { buildVernacular } from './vernacular.js';
import { buildDock, buildShipPier, buildHarbourCrane, buildHarbourWall } from './harbours.js';
import { buildCitadel, buildCastle } from './citadel.js';
import { buildMeridianLift } from './meridianLift.js';
import { buildMeridianBridge } from './meridianBridge.js';
import { buildDressing } from './dressing.js';
import { surface, familyFor, PALETTES, shade, LIGHT_COLORS } from './style.js';
import { Kit, groundRange } from './kit.js';
import { excludedAt } from './exclusionIndex.js';

export const mat = surface;

function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const addM = (g, m) => { g.add(m); return m; };
const C = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);

// ------------------------------------------------------------------ vegetation
const GEO = {
  trunk: (() => { const g = C(0.16, 0.26, 1, 6); g.translate(0, 0.5, 0); return g; })(),
  canopy: new THREE.IcosahedronGeometry(1, 0),
  crown: new THREE.CylinderGeometry(0.78, 1, 1, 5),
  cone: (() => { const g = new THREE.ConeGeometry(1, 1, 7); g.translate(0, 0.5, 0); return g; })(),
  rock: new THREE.DodecahedronGeometry(1, 0),
  crystal: (() => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.35, 1, 0.35); g.translate(0, 0.8, 0); return g; })(),
  basalt: (() => { const g = C(1, 1, 1, 6); g.translate(0, 0.5, 0); return g; })(),
  leaf: (() => { const g = new THREE.ConeGeometry(0.5, 2.6, 4); g.rotateX(Math.PI / 2); g.scale(1, 0.15, 1); g.translate(0, 0, 1.3); return g; })(),
  reed: (() => { const g = new THREE.ConeGeometry(0.05, 1, 3); g.translate(0, 0.5, 0); return g; })(),
  cap: (() => { const g = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2); return g; })(),
  flower: B(0.14, 0.14, 0.14),
  tuft: (() => { const g = new THREE.ConeGeometry(0.18, 0.55, 3); g.translate(0, 0.27, 0); return g; })(),
  // moss and fronds hanging under a canopy: base at y = 0, tip 1 m below
  frond: (() => { const g = new THREE.ConeGeometry(0.22, 1, 3, 1, true); g.rotateX(Math.PI); g.translate(0, -0.5, 0); return g; })(),
  pad: (() => { const g = new THREE.CylinderGeometry(1, 1, 0.05, 7); g.translate(0, 0.025, 0); return g; })(),
};

// Instances are split into square cells, one InstancedMesh each, so the camera and the
// small shadow frustum can cull them and cells past the fog can drop out entirely. A single
// island-wide mesh can never be culled: it drew every tree on the island into every pass.
const VEG_CELL = 192;
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _col = new THREE.Color();

class Bucket {
  constructor(geo, material) {
    this.geo = geo;
    this.mat = material;
    this.items = [];
  }
  add(pos, rotY, scale, color, tilt = null) {
    this.items.push({ pos: pos.clone(), rotY, scale: scale.clone ? scale.clone() : new THREE.Vector3(scale, scale, scale), color, tilt });
  }
  // maxDist: beyond it a cell is hidden even inside the fog (tufts and flowers).
  build(scene, chunks, { shadow = true, maxDist = Infinity } = {}) {
    const cells = new Map();
    for (const it of this.items) {
      const key = `${Math.floor(it.pos.x / VEG_CELL)},${Math.floor(it.pos.z / VEG_CELL)}`;
      let cell = cells.get(key);
      if (!cell) cells.set(key, (cell = []));
      cell.push(it);
    }
    for (const items of cells.values()) {
      const im = new THREE.InstancedMesh(this.geo, this.mat, items.length);
      items.forEach((it, i) => {
        _e.set(it.tilt ? it.tilt.x : 0, it.rotY, it.tilt ? it.tilt.z : 0, 'YXZ');
        _q.setFromEuler(_e);
        _m4.compose(it.pos, _q, it.scale);
        im.setMatrixAt(i, _m4);
        im.setColorAt(i, _col.set(it.color));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = shadow;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
      chunks.push(fogCullable(im, maxDist));
    }
  }
}

// Small things only near the player; trees until the fog has swallowed them. Grass,
// flowers and reeds are too thin to cast a shadow worth a draw call.
// Trees that would stand across a kept view (data/vistas.js SIGHTLINES); bushes and grass stay.
const TALL_KINDS = new Set(['palm', 'broad', 'pine', 'snowpine', 'greattree', 'jtree', 'young', 'dead', 'charred', 'twisted', 'mangrove', 'cypress', 'willow']);
const DETAIL_DIST = { tuft: 150, flower: 170, reed: 190, pad: 200, cap: 220, glowcap: 260, bush: 320, rock: 420, ember: 320 };
const NO_SHADOW = new Set(['tuft', 'flower', 'reed', 'pad', 'frond']);

// Anything whose bounds lie wholly past the fog's far plane renders as flat fog colour, so
// it is not drawn. Fog is by view depth, not distance, hence the test along the view axis;
// maxDist additionally drops ground clutter early. Objects must be static, at the scene
// root, with world-space bounds: terrain, vegetation cells, cliffs, merged buildings.
const _fwd = new THREE.Vector3();
const _sphere = new THREE.Sphere();
export function fogCullable(o, maxDist = Infinity) {
  o.updateMatrixWorld();
  if (o.isInstancedMesh) _sphere.copy(o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere));
  else _sphere.copy(o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).applyMatrix4(o.matrixWorld);
  o.userData.cull = { x: _sphere.center.x, y: _sphere.center.y, z: _sphere.center.z, r: _sphere.radius, maxDist };
  return o;
}
// Each list's bounds are packed into one typed array the first time it is culled (and again if
// it grows): the test runs over every cell of the map every frame.
const _packs = new WeakMap();
function packCull(list) {
  let pack = _packs.get(list);
  if (!pack || pack.n !== list.length) {
    const d = new Float64Array(list.length * 5);
    list.forEach((o, i) => {
      const c = o.userData.cull;
      d[i * 5] = c.x; d[i * 5 + 1] = c.y; d[i * 5 + 2] = c.z; d[i * 5 + 3] = c.r; d[i * 5 + 4] = c.maxDist;
    });
    _packs.set(list, (pack = { n: list.length, d }));
  }
  return pack.d;
}
export function cullPastFog(list, camera, fogFar) {
  const p = camera.position;
  camera.getWorldDirection(_fwd);
  const px = p.x, py = p.y, pz = p.z, fx = _fwd.x, fy = _fwd.y, fz = _fwd.z;
  const d = packCull(list);
  for (let i = 0, k = 0; i < list.length; i++, k += 5) {
    const dx = d[k] - px, dy = d[k + 1] - py, dz = d[k + 2] - pz, r = d[k + 3], maxDist = d[k + 4];
    // with no distance limit the second test always passes: skip its square root
    list[i].visible = dx * fx + dy * fy + dz * fz - r < fogFar && (maxDist === Infinity || hypot(dx, dz) - r < maxDist);
  }
}

// The Hush's wind comes in off the open sea to the east; everything that grows there leans
// along this heading (radians, the yaw the tilt bends toward).
const HUSH_WIND = 1.35;

const VEG_SETS = {
  beach: { palm: 16, bush: 26, rock: 14, tuft: 60 },
  // The Wash: marram clumps and sea-grass over the whole plain, thrift in the hollows, a few
  // wind-cut bushes, and bleached driftwood the tide left on the strand.
  dunes: { rock: 40, flower: 160, tuft: 2400, sedge: 700, bush: 46, palm: 3, driftwood: 34 },
  meadow: { broad: 150, pine: 60, young: 40, bush: 160, rock: 70, flower: 380, tuft: 500, greattree: 3 },
  // Thornwood: pine and broadleaf of every age, a floor of fern, fallen trunks in the glades.
  forest: { pine: 520, broad: 230, young: 150, bush: 260, fern: 300, log: 75, rock: 90, mushroom: 60, tuft: 400, greattree: 6 },
  // Swamp cypress in the water, willows on the tussocks, snags, lilies on the meres, logs.
  marsh: { cypress: 90, willow: 55, dead: 55, mangrove: 30, reed: 700, sedge: 260, lily: 320, log: 55, glowcap: 60, rock: 30, tuft: 300 },
  // No crystal spikes in the snow: Frosthollow's ice is in its walls and waterfalls.
  snow: { snowpine: 380, rock: 130, dead: 40 },
  volcanic: { charred: 90, basalt: 220, ember: 130, rock: 110 },
  // The Ashen Spire's woods: Thornwood's pines regrown on the ash, with the snags of the old
  // burn still standing among them, bracken and fern under them and basalt breaking through.
  emberwood: { pine: 440, young: 120, broad: 50, charred: 60, fern: 280, bush: 150, log: 60, basalt: 10, rock: 80, mushroom: 40, tuft: 300, greattree: 2 },
  // Crystal only grows where a landmark explains it (gates, the vow, the veins); the floor
  // is drowned ground: stones, a few dead trees and glowcaps in the damp.
  rift: { twisted: 28, rock: 110, glowcap: 36 },
  jungle: { jtree: 240, palm: 50, broad: 60, fern: 340, bush: 220, flower: 180, log: 50, rock: 70, mushroom: 50, tuft: 300, greattree: 9 },
  farmland: { broad: 45, bush: 50, flower: 260, tuft: 500, rock: 15 },
  highland: { pine: 170, young: 60, rock: 200, bush: 70, tuft: 320, dead: 18, log: 10, greattree: 1 },
  tundra: { snowpine: 160, rock: 110, dead: 40 },
  ashfield: { charred: 60, basalt: 140, rock: 90, ember: 30, heather: 140, tuft: 180, young: 30, pine: 20 },
  bastion: { pine: 90, broad: 50, young: 30, rock: 140, bush: 110, tuft: 320, flower: 60, greattree: 2 },
  // A wind-scoured winter moor: rimed heather and sedge bent one way, a few dead thorns
  // leaning with them, and stunted pines where Frosthollow's woods reach down to it.
  hush: { dead: 40, rock: 170, heather: 260, tuft: 520, bush: 30, glowcap: 12, snowpine: 36 },
  rock: { rock: 40, tuft: 50, bush: 8 },
};
// Counts above are per classic 175m island; each island scales them by its area and
// scatters each zone's own set inside that zone (data/world.js islandBiomeRegions).

// Woods, not orchards. A slow noise field per island says where woodland stands: trees take
// a spot by its density there, so they gather into woods with edges, glades and open ground
// between, instead of an even scatter over every shelf. [open below, wooded above] per biome.
const WOODED = {
  forest: [-0.34, -0.06], emberwood: [-0.3, -0.04], jungle: [-0.42, -0.16], meadow: [0.04, 0.3], farmland: [0.14, 0.38], highland: [0.0, 0.26],
  bastion: [0.02, 0.28], snow: [-0.16, 0.12], tundra: [0.0, 0.3], marsh: [-0.24, 0.06], dunes: [0.22, 0.42],
  hush: [0.2, 0.5],
};

export function buildVegetation(scene, terrain, colliders, exclusions) {
  const chunks = [];
  const white = '#ffffff';
  const makeBuckets = () => ({
    trunk: new Bucket(GEO.trunk, mat(white)),
    canopy: new Bucket(GEO.canopy, mat(white)),
    crown: new Bucket(GEO.crown, mat(white)),
    cone: new Bucket(GEO.cone, mat(white)),
    rock: new Bucket(GEO.rock, mat(white)),
    crystal: new Bucket(GEO.crystal, mat(white, { emissive: '#4a2a8a', ei: 0.9, roughness: 0.3 })),
    basalt: new Bucket(GEO.basalt, mat(white)),
    leaf: new Bucket(GEO.leaf, mat(white, { double: true })),
    frond: new Bucket(GEO.frond, mat(white, { double: true })),
    pad: new Bucket(GEO.pad, mat(white)),
    reed: new Bucket(GEO.reed, mat(white)),
    cap: new Bucket(GEO.cap, mat(white)),
    glowcap: new Bucket(GEO.cap, mat(white, { emissive: '#3affc8', ei: 0.8 })),
    ember: new Bucket(GEO.rock, mat(white, { emissive: '#ff4a10', ei: 0.7 })),
    flower: new Bucket(GEO.flower, mat(white)),
    tuft: new Bucket(GEO.tuft, mat(white)),
  });
  const v = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const excluded = (x, z, pad = 0) => excludedAt(exclusions, x, z, pad);

  for (const isl of ISLANDS) {
    const rng = seededRandom(isl.seed * 977 + 13);
    const buckets = makeBuckets();
    const woods = new Noise2D(isl.seed * 31 + 7);
    for (const region of islandBiomeRegions(isl)) {
    const biome = region.biome;
    const set = VEG_SETS[biome] || {};
    const R = isl.radius;
    const range = WOODED[biome];
    const woodAt = (x, z) => (range ? smoothstep(range[0], range[1], woods.fbm(x * 0.0062 + 41, z * 0.0062 - 13, 3) + 0.12 * woods.noise(x * 0.03, z * 0.03)) : 1);
    // what each kind wants of the wood: trees its heart, bushes and saplings its edge
    const inWood = (d) => d, atEdge = (d) => 0.2 + 0.8 * (1 - Math.abs(2 * d - 1)), inGlade = (d) => 0.25 + 0.75 * (1 - d);
    let density = 1;
    let tallKind = false;
    const pick = (minH, maxH, maxSlope, pad = 2, tries = 30, want = null) => {
      for (let t = 0; t < (want ? tries * 2 : tries); t++) {
        const [x, z] = islandScatter(isl, rng, region.zone);
        if (biomeOfPoint(isl, x, z) !== biome) continue;
        const d = woodAt(x, z);
        if (want && rng() > want(d)) continue;
        const h = terrain.heightAt(x, z);
        if (h < minH || h > maxH) continue;
        terrain.normalAt(x, z, nrm);
        if (nrm.y < maxSlope) continue;
        if (excluded(x, z, pad)) continue;
        if (tallKind && inSightline(x, z)) continue;
        density = d;
        return v.set(x, h, z);
      }
      return null;
    };
    const jitterColor = (hex, amt = 0.08) => {
      const c = new THREE.Color(hex);
      const f = 1 - amt + rng() * amt * 2;
      return c.multiplyScalar(f);
    };
    const addTree = (p, trunkH, trunkR, collide = true) => {
      if (collide) colliders.addCyl({ x: p.x, z: p.z, r: trunkR * 1.1, y0: p.y - 1, y1: p.y + trunkH });
    };

    for (const kind in set) {
      tallKind = TALL_KINDS.has(kind);
      const count = Math.round(set[kind] * region.area);
      for (let i = 0; i < count; i++) {
        let p;
        switch (kind) {
          case 'palm': {
            p = pick(1.0, 4, 0.8, 3);
            if (!p) break;
            const h = 5 + rng() * 3;
            const tiltX = (rng() - 0.5) * 0.35;
            const tiltZ = (rng() - 0.5) * 0.35;
            buckets.trunk.add(p, 0, new THREE.Vector3(1, h, 1), jitterColor('#8a6a48'), { x: tiltX, z: tiltZ });
            const top = p.clone().add(new THREE.Vector3(Math.sin(tiltZ) * -h, h, Math.sin(tiltX) * h));
            for (let k = 0; k < 6; k++) buckets.leaf.add(top, (k / 6) * Math.PI * 2 + rng(), 1 + rng() * 0.3, jitterColor('#4f9a3a'), { x: 0.45, z: 0 });
            addTree(p, h, 0.25);
            break;
          }
          case 'broad': {
            p = pick(1.8, 60, 0.82, 3, 30, inWood);
            if (!p) break;
            // trees grow taller in the heart of a wood than at its edge
            const grow = 0.7 + 0.45 * density + rng() * 0.25;
            const h = (5 + rng() * 4) * grow;
            const s = (3 + rng() * 1.8) * (0.8 + 0.3 * grow);
            buckets.trunk.add(p, rng() * 6, new THREE.Vector3(1.4, h, 1.4), jitterColor('#6b4e32'));
            const greens = biome === 'forest' || biome === 'jungle' || biome === 'emberwood' ? ['#455f3d', '#3c563b', '#516c47'] : ['#657b4b', '#728351', '#5d7145', '#7b8856'];
            const g = greens[Math.floor(rng() * greens.length)];
            buckets.crown.add(p.clone().add(new THREE.Vector3(0, h, 0)), rng() * 6, new THREE.Vector3(s, s * 0.64, s), jitterColor(g));
            buckets.crown.add(p.clone().add(new THREE.Vector3(s * 0.2, h + s * 0.55, -s * 0.1)), rng() * 6, new THREE.Vector3(s * 0.73, s * 0.55, s * 0.73), jitterColor(g));
            addTree(p, h, 0.35);
            break;
          }
          case 'pine':
          case 'snowpine': {
            p = pick(1.8, 80, 0.75, 3, 30, inWood);
            if (!p) break;
            const h = (6 + rng() * 6) * (0.7 + 0.5 * density + rng() * 0.25) * (rng() < 0.06 * density ? 1.45 : 1) * (biome === 'hush' ? 0.6 : 1);
            const w = h * 0.3;
            buckets.trunk.add(p, 0, new THREE.Vector3(1.2, h * 0.35, 1.2), jitterColor('#5a4030'));
            const green = kind === 'snowpine' ? '#3a5a4a' : biome === 'forest' ? '#2f5a2c' : biome === 'emberwood' ? '#2b4c2e' : '#3f6a38';
            for (let k = 0; k < 3; k++) {
              const y = h * (0.22 + k * 0.22);
              const s = w * (1 - k * 0.25);
              buckets.cone.add(p.clone().add(new THREE.Vector3(0, y, 0)), rng() * 6, new THREE.Vector3(s, h * 0.38, s), jitterColor(green));
              if (kind === 'snowpine') buckets.cone.add(p.clone().add(new THREE.Vector3(0, y + h * 0.16, 0)), rng() * 6, new THREE.Vector3(s * 0.62, h * 0.22, s * 0.62), jitterColor('#f2f6fa', 0.03));
            }
            addTree(p, h * 0.4, 0.3);
            break;
          }
          case 'greattree': {
            // an old giant: buttress roots, a massive trunk and a layered cloud of canopy
            p = pick(2.2, 60, 0.85, 7, 60, inWood);
            if (!p) break;
            const h = 15 + rng() * 10;
            const tr = 6 + rng() * 3;
            const bark = jitterColor(biome === 'jungle' ? '#5a4836' : '#6e5a44');
            buckets.trunk.add(p, rng() * 6, new THREE.Vector3(tr, h, tr), bark, { x: (rng() - 0.5) * 0.08, z: (rng() - 0.5) * 0.08 });
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2 + rng() * 0.5;
              buckets.trunk.add(p.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, -0.4, Math.sin(a) * 0.9)), a, new THREE.Vector3(2.6, 3.4, 2.6), bark, { x: 0.95, z: 0 });
            }
            const greens = biome === 'jungle' ? ['#2c6a32', '#357a38', '#24602c'] : biome === 'highland' ? ['#56703e', '#4a6438'] : ['#3f7a3c', '#4a8a44', '#376c34', '#5a9446'];
            const layers = 4 + Math.floor(rng() * 3);
            for (let k = 0; k < layers; k++) {
              const s = 11 + rng() * 6 - k * 1.2;
              const a = rng() * Math.PI * 2;
              const off = k === 0 ? 0 : 2 + rng() * 4;
              buckets.canopy.add(p.clone().add(new THREE.Vector3(Math.cos(a) * off, h - 3 + k * 1.9, Math.sin(a) * off)), rng() * 6, new THREE.Vector3(s, s * 0.42, s), jitterColor(greens[k % greens.length], 0.06));
            }
            colliders.addCyl({ x: p.x, z: p.z, r: tr * 0.2, y0: p.y - 1, y1: p.y + h, climbable: true });
            break;
          }
          case 'jtree': {
            p = pick(1.8, 60, 0.8, 3, 30, inWood);
            if (!p) break;
            const h = (8 + rng() * 7) * (0.75 + 0.4 * density + rng() * 0.2);
            buckets.trunk.add(p, rng() * 6, new THREE.Vector3(1.6, h, 1.6), jitterColor('#5a4632'), { x: (rng() - 0.5) * 0.12, z: (rng() - 0.5) * 0.12 });
            const g = ['#2a6e2c', '#357a32', '#24602a', '#3f8a3a'][Math.floor(rng() * 4)];
            const s = 3.2 + rng() * 2;
            buckets.canopy.add(p.clone().add(new THREE.Vector3(0, h + s * 0.25, 0)), rng() * 6, new THREE.Vector3(s * 1.3, s * 0.55, s * 1.3), jitterColor(g));
            for (let k = 0; k < 2; k++) {
              const a = rng() * Math.PI * 2;
              buckets.canopy.add(p.clone().add(new THREE.Vector3(Math.cos(a) * s * 0.7, h - 1 - k * 1.5, Math.sin(a) * s * 0.7)), rng() * 6, new THREE.Vector3(s * 0.7, s * 0.4, s * 0.7), jitterColor(g));
            }
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2 + rng();
              buckets.trunk.add(p.clone().add(new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5)), a, new THREE.Vector3(0.6, 1.4, 0.6), '#4a3a28', { x: 0.6, z: 0 });
            }
            addTree(p, h, 0.45);
            break;
          }
          case 'fern': {
            p = pick(1.4, 55, 0.75, 1, 30, inWood);
            if (!p) break;
            const s = (0.35 + rng() * 0.35) * (biome === 'forest' || biome === 'emberwood' ? 1.25 : 1);
            const c = jitterColor(biome === 'forest' ? '#46713a' : biome === 'emberwood' ? (rng() < 0.4 ? '#7a5e34' : '#55693a') : '#3f8a34', 0.15);
            for (let k = 0; k < 6; k++) buckets.leaf.add(p.clone().add(new THREE.Vector3(0, 0.1, 0)), (k / 6) * Math.PI * 2 + rng() * 0.4, s, c, { x: -0.5 - rng() * 0.3, z: 0 });
            break;
          }
          case 'young': {
            // saplings and young pines where a wood gives onto open ground
            p = pick(1.8, 80, 0.75, 2, 30, inGlade);
            if (!p) break;
            const h = 2.2 + rng() * 2.6;
            buckets.trunk.add(p, 0, new THREE.Vector3(0.7, h * 0.3, 0.7), jitterColor('#5a4030'));
            for (let k = 0; k < 2; k++) buckets.cone.add(p.clone().add(new THREE.Vector3(0, h * (0.2 + k * 0.3), 0)), rng() * 6, new THREE.Vector3(h * 0.32 * (1 - k * 0.3), h * 0.5, h * 0.32 * (1 - k * 0.3)), jitterColor(biome === 'forest' || biome === 'emberwood' ? '#365f30' : '#46713c'));
            break;
          }
          case 'bush': {
            p = pick(1.4, 60, 0.75, 1.5, 30, atEdge);
            if (!p) break;
            const s = 0.6 + rng() * 0.8;
            const leaf = biome === 'forest' || biome === 'emberwood' ? '#3a6a30' : biome === 'jungle' ? '#2f6e30' : biome === 'hush' ? '#5c6b64' : '#5a9a40';
            buckets.canopy.add(p.clone().add(new THREE.Vector3(0, s * 0.4, 0)), rng() * 6, new THREE.Vector3(s * 1.3, s, s * 1.3), jitterColor(leaf));
            break;
          }
          case 'rock': {
            p = pick(-2, 90, 0.4, 2);
            if (!p) break;
            const s = 0.5 + rng() * rng() * 3.2;
            const base = { snow: '#8a949f', hush: '#7d848d', volcanic: '#2a2422', ashfield: '#3a3432', emberwood: '#4e4a45', rift: '#2a2236', marsh: '#5a5848', jungle: '#6a6a58' }[biome] || '#8a857c';
            buckets.rock.add(p.clone().add(new THREE.Vector3(0, s * 0.3, 0)), rng() * 6, new THREE.Vector3(s, s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.4)), jitterColor(base));
            if (s > 1.4) colliders.addCyl({ x: p.x, z: p.z, r: s * 0.8, y0: p.y - 1, y1: p.y + s * 0.8, climbable: true });
            break;
          }
          case 'flower': {
            p = pick(2, 40, 0.85, 1);
            if (!p) break;
            const cols = ['#ff5a6a', '#ffd23f', '#ffffff', '#b07aff', '#ff9ad5', '#6ab0ff'];
            const c = cols[Math.floor(rng() * cols.length)];
            for (let k = 0; k < 4; k++) buckets.flower.add(p.clone().add(new THREE.Vector3((rng() - 0.5) * 1.5, 0.1, (rng() - 0.5) * 1.5)), rng() * 6, 1, c);
            break;
          }
          case 'tuft': {
            p = pick(1.5, 50, 0.8, 1);
            if (!p) break;
            const gcol = { dunes: '#95a062', beach: '#9ac46a', meadow: '#6aa84a', forest: '#3f7a34', emberwood: '#4f6a34', ashfield: '#7a7a62', marsh: '#7a8a4a', jungle: '#3a8a3a', hush: '#a6aaa2', snow: '#9aa48a', tundra: '#8f9870' }[biome] || '#6aa84a';
            // on the Hush every blade leans the same way, away from the sea wind
            const bent = biome === 'hush' ? { x: 0.42 + rng() * 0.2, z: 0 } : null;
            for (let k = 0; k < 3; k++) buckets.tuft.add(p.clone().add(new THREE.Vector3((rng() - 0.5) * 0.8, 0, (rng() - 0.5) * 0.8)), bent ? HUSH_WIND + (rng() - 0.5) * 0.3 : rng() * 6, 0.8 + rng() * 0.6, jitterColor(gcol, 0.12), bent);
            break;
          }
          case 'heather': {
            // low cushions of heather, rimed grey, the old flowers gone dark violet in the frost
            p = pick(2, 60, 0.8, 1);
            if (!p) break;
            const n = 2 + Math.floor(rng() * 4);
            for (let k = 0; k < n; k++) {
              const s = 0.35 + rng() * 0.45;
              // on the cooled lava it is ling and lichen, browner, with only a little in flower;
              // elsewhere (the Hush) the old flowers go dark violet in the frost
              const c = biome === 'ashfield' ? jitterColor(rng() < 0.15 ? '#6e5a68' : rng() < 0.6 ? '#5f6452' : '#6a5e4c', 0.1)
                : jitterColor(rng() < 0.35 ? '#6e5a7c' : rng() < 0.6 ? '#9894a0' : '#626a64', 0.1);
              buckets.canopy.add(p.clone().add(new THREE.Vector3((rng() - 0.5) * 2.2, s * 0.25, (rng() - 0.5) * 2.2)), rng() * 6, new THREE.Vector3(s * 1.5, s * 0.6, s * 1.3), c);
            }
            break;
          }
          case 'mushroom':
          case 'glowcap': {
            p = pick(biome === 'rift' ? 0 : 1.2, 60, 0.7, 1);
            if (!p) break;
            const s = 0.25 + rng() * 0.35;
            buckets.trunk.add(p, 0, new THREE.Vector3(0.5 * s * 2, s * 1.2, 0.5 * s * 2), '#e8e0d0');
            const b = kind === 'glowcap' ? buckets.glowcap : buckets.cap;
            b.add(p.clone().add(new THREE.Vector3(0, s * 1.2, 0)), 0, new THREE.Vector3(s, s * 0.7, s), kind === 'glowcap' ? '#7affd8' : '#b8402a');
            break;
          }
          case 'dead':
          case 'charred':
          case 'twisted': {
            p = pick(biome === 'marsh' ? -0.8 : 1.5, 80, 0.75, 2);
            if (!p) break;
            const h = (biome === 'hush' ? 2.6 : 4) + rng() * (biome === 'hush' ? 2.4 : 4);
            const c = kind === 'charred' ? '#1e1816' : kind === 'twisted' ? '#2a2034' : biome === 'hush' ? '#4a4650' : '#5a5040';
            // the Hush's thorns grow bent away from the sea wind
            const lean = biome === 'hush' ? { x: 0.3 + rng() * 0.2, z: (rng() - 0.5) * 0.1 } : { x: (rng() - 0.5) * 0.2, z: (rng() - 0.5) * 0.2 };
            const yaw = biome === 'hush' ? HUSH_WIND : rng() * 6;
            buckets.trunk.add(p, yaw, new THREE.Vector3(1, h, 1), jitterColor(c), lean);
            // branches spring from the trunk itself, wherever its lean has carried it
            const axis = new THREE.Vector3(0, 1, 0).applyEuler(_e.set(lean.x, yaw, lean.z, 'YXZ'));
            for (let k = 0; k < 3; k++) {
              const y = h * (0.45 + rng() * 0.45);
              buckets.trunk.add(p.clone().addScaledVector(axis, y), rng() * 6, new THREE.Vector3(0.5, h * 0.4, 0.5), jitterColor(c), { x: 0.9 + rng() * 0.4, z: 0 });
            }
            addTree(p, h, 0.25);
            break;
          }
          case 'mangrove': {
            p = pick(-1.2, 3, 0.7, 2);
            if (!p) break;
            const h = 3 + rng() * 2;
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2 + rng();
              buckets.trunk.add(p.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, -0.3, Math.sin(a) * 0.8)), a, new THREE.Vector3(0.45, 1.6, 0.45), '#5a4a32', { x: 0.5, z: 0 });
            }
            buckets.trunk.add(p.clone().add(new THREE.Vector3(0, 0.8, 0)), 0, new THREE.Vector3(1.1, h, 1.1), jitterColor('#5a4a32'));
            buckets.canopy.add(p.clone().add(new THREE.Vector3(0, h + 1.2, 0)), rng() * 6, new THREE.Vector3(3.2, 1.2, 3.2), jitterColor('#4a6a34'));
            addTree(p, h, 0.3);
            break;
          }
          case 'cypress': {
            // swamp cypress: a flared, buttressed foot standing in the shallows, a tall bole
            // and flat, layered crowns hung with grey moss
            p = pick(-0.7, 4, 0.72, 3);
            if (!p) break;
            const h = 9 + rng() * 8;
            const bark = jitterColor('#4c3f30');
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2 + rng() * 0.6;
              buckets.trunk.add(p.clone().add(new THREE.Vector3(Math.cos(a) * 0.55, -0.4, Math.sin(a) * 0.55)), a, new THREE.Vector3(1.3, 2.2 + rng(), 1.3), bark, { x: 0.5 + rng() * 0.2, z: 0 });
            }
            buckets.trunk.add(p, rng() * 6, new THREE.Vector3(2.1, h, 2.1), bark, { x: (rng() - 0.5) * 0.06, z: (rng() - 0.5) * 0.06 });
            const greens = ['#3d5634', '#46603a', '#354d30'];
            const tiers = 2 + Math.floor(rng() * 2);
            for (let k = 0; k < tiers; k++) {
              const s = (4.2 - k * 1.0) * (0.85 + rng() * 0.3);
              const a = rng() * Math.PI * 2, off = k === 0 ? 0 : 0.8 + rng() * 1.2;
              const top = p.clone().add(new THREE.Vector3(Math.cos(a) * off, h * (0.8 + k * 0.06), Math.sin(a) * off));
              buckets.canopy.add(top, rng() * 6, new THREE.Vector3(s, s * 0.5, s * (0.85 + rng() * 0.3)), jitterColor(greens[k % 3], 0.06));
              for (let m = 0; m < 5; m++) {
                const b = rng() * Math.PI * 2, rr = s * (0.5 + rng() * 0.4);
                buckets.frond.add(top.clone().add(new THREE.Vector3(Math.cos(b) * rr, -s * 0.12, Math.sin(b) * rr)), b, new THREE.Vector3(0.7, 1.8 + rng() * 2.6, 0.18), jitterColor('#8d9878', 0.08));
              }
            }
            addTree(p, h, 0.45);
            break;
          }
          case 'willow': {
            // fen willow: a short leaning trunk under a dome of fronds that reach the water
            p = pick(0.2, 4.5, 0.75, 3);
            if (!p) break;
            const h = 3 + rng() * 1.8;
            const lean = { x: (rng() - 0.5) * 0.3, z: (rng() - 0.5) * 0.3 };
            buckets.trunk.add(p, rng() * 6, new THREE.Vector3(1.8, h, 1.8), jitterColor('#5a4a36'), lean);
            const s = 3.4 + rng() * 1.6;
            const top = p.clone().add(new THREE.Vector3(Math.sin(lean.z) * -h, h + s * 0.25, Math.sin(lean.x) * h));
            const g = jitterColor(['#6a8746', '#78924e', '#5f7c40'][Math.floor(rng() * 3)], 0.05);
            buckets.canopy.add(top, rng() * 6, new THREE.Vector3(s, s * 0.6, s), g);
            for (let m = 0; m < 16; m++) {
              const b = (m / 16) * Math.PI * 2 + rng() * 0.25, rr = s * (0.78 + rng() * 0.14);
              buckets.frond.add(top.clone().add(new THREE.Vector3(Math.cos(b) * rr, -s * 0.08, Math.sin(b) * rr)), b, new THREE.Vector3(1.1, Math.max(1.2, top.y - p.y - 0.5) * (0.55 + rng() * 0.4), 0.22), g.clone().multiplyScalar(0.92 + rng() * 0.14), { x: 0.05, z: 0 });
            }
            addTree(p, h, 0.35);
            break;
          }
          case 'lily': {
            // lily pads on still water near a mere's edge, now and then a pale flower
            p = pick(-1.0, -0.12, 0, 0.5);
            if (!p) break;
            const n = 3 + Math.floor(rng() * 5);
            for (let k = 0; k < n; k++) {
              const s = 0.35 + rng() * 0.45;
              const q = new THREE.Vector3(p.x + (rng() - 0.5) * 3.2, 0.03, p.z + (rng() - 0.5) * 3.2);
              buckets.pad.add(q, rng() * 6, new THREE.Vector3(s, 1, s), jitterColor(rng() < 0.5 ? '#4e7a3a' : '#5f8a44', 0.1));
              if (rng() < 0.12) buckets.flower.add(q.clone().setY(0.12), rng() * 6, 1.3, rng() < 0.5 ? '#f2eee4' : '#e8b8c8');
            }
            break;
          }
          case 'log': {
            // a fallen trunk, half sunk and mossed, its root plate turned up at one end
            p = biome === 'marsh' ? pick(0.2, 4, 0.82, 2) : pick(1.6, 60, 0.85, 2, 30, inWood);
            if (!p) break;
            const len = 4 + rng() * 6, r = 1.1 + rng() * 0.7, yaw = rng() * Math.PI * 2;
            buckets.trunk.add(p.clone().add(new THREE.Vector3(0, 0.22 * r, 0)), yaw, new THREE.Vector3(r * 1.6, len, r * 1.6), jitterColor(biome === 'marsh' ? '#4d4a36' : '#5a4632', 0.1), { x: Math.PI / 2 - 0.04, z: 0 });
            buckets.rock.add(p.clone().add(new THREE.Vector3(0, 0.45, 0)), yaw, new THREE.Vector3(0.5 * r, 0.7 * r, 0.25 * r), jitterColor('#4a3c2c'));
            break;
          }
          case 'driftwood': {
            // bleached timber thrown up on the strand, half buried, a stub of root or branch
            p = pick(0.25, 1.7, 0.85, 1.5);
            if (!p) break;
            const len = 2 + rng() * 4, r = 0.45 + rng() * 0.4, yaw = rng() * Math.PI * 2;
            buckets.trunk.add(p.clone().add(new THREE.Vector3(0, 0.12 * r, 0)), yaw, new THREE.Vector3(r * 1.4, len, r * 1.4), jitterColor('#9d927f', 0.1), { x: Math.PI / 2 - 0.05, z: (rng() - 0.5) * 0.2 });
            if (rng() < 0.6) buckets.trunk.add(p.clone().add(new THREE.Vector3(0, 0.25, 0)), yaw + 1.2, new THREE.Vector3(r * 0.6, len * 0.35, r * 0.6), jitterColor('#8c8270', 0.1), { x: 1.1, z: 0 });
            break;
          }
          case 'sedge': {
            // tussock sedge crowning the hummocks
            p = pick(1.2, 5, 0.75, 1);
            if (!p) break;
            const c = jitterColor(rng() < 0.6 ? '#8a8a52' : '#6f7a46', 0.12);
            const big = biome === 'dunes' ? 1.35 : 1; // marram stands taller than fen sedge
            for (let k = 0; k < 7; k++) buckets.reed.add(p.clone().add(new THREE.Vector3((rng() - 0.5) * 0.9 * big, 0, (rng() - 0.5) * 0.9 * big)), 0, new THREE.Vector3(1.6 * big, (0.7 + rng() * 0.6) * big, 1.6 * big), c, { x: (rng() - 0.5) * 0.7, z: (rng() - 0.5) * 0.7 });
            break;
          }
          case 'reed': {
            p = pick(-1.0, 1.6, 0.6, 1);
            if (!p) break;
            for (let k = 0; k < 5; k++) buckets.reed.add(p.clone().add(new THREE.Vector3((rng() - 0.5) * 1.2, 0, (rng() - 0.5) * 1.2)), 0, new THREE.Vector3(1, 1.2 + rng() * 1.2, 1), jitterColor('#7a8a4a', 0.15), { x: (rng() - 0.5) * 0.3, z: (rng() - 0.5) * 0.3 });
            break;
          }
          case 'basalt': {
            p = pick(1.2, 90, 0.55, 2);
            if (!p) break;
            const s = 0.6 + rng() * 1.2;
            const h = 1 + rng() * 5;
            for (let k = 0; k < 3; k++) buckets.basalt.add(p.clone().add(new THREE.Vector3((rng() - 0.5) * s * 2, -0.3, (rng() - 0.5) * s * 2)), rng(), new THREE.Vector3(s * 0.6, h * (0.6 + rng() * 0.6), s * 0.6), jitterColor(biome === 'emberwood' ? '#3a3b33' : '#2a2422'));
            colliders.addCyl({ x: p.x, z: p.z, r: s * 1.1, y0: p.y - 1, y1: p.y + h * 0.9, climbable: true });
            break;
          }
          case 'ember': {
            p = pick(1.2, 90, 0.5, 1);
            if (!p) break;
            const s = 0.3 + rng() * 0.6;
            buckets.ember.add(p.clone().add(new THREE.Vector3(0, s * 0.2, 0)), rng() * 6, s, '#3a2a26');
            break;
          }
        }
      }
    }
    }
    for (const k in buckets) buckets[k].build(scene, chunks, { shadow: !NO_SHADOW.has(k), maxDist: DETAIL_DIST[k] });
  }
  return chunks;
}


// ------------------------------------------------------------------ structures
export function buildStructures(world) {
  const { scene, terrain, colliders } = world;
  const groundY = (x, z) => terrain.heightAt(x, z);
  const exclusions = [];

  const roots = [];
  const add = (obj) => {
    scene.add(obj);
    roots.push(obj);
    return obj;
  };

  for (const s of STRUCTURES) {
    const y = groundY(s.x, s.z);
    switch (s.type) {
      case 'castle': {
        const g = new THREE.Group(); g.name = s.name;
        g.position.set(s.x, y, s.z); g.rotation.y = s.rot || 0;
        buildCastle(world, s, g); add(g);
        exclusions.push({ x: s.x, z: s.z, r: 33 });
        break;
      }
      // every dwelling is built the way its region builds (world/vernacular.js)
      case 'inn':
      case 'smithy':
      case 'barracks':
      case 'house':
      case 'hall':
      case 'warehouse':
        buildVernacular(world, s, add, exclusions);
        break;
      case 'tower': {
        // The Sage's observatory is the smaller stone companion to the civic keep.
        const g = new THREE.Group();
        g.name = "Ilvar's Observatory";
        g.position.set(s.x, y, s.z); g.rotation.y = s.rot || 0;
        buildCitadel(world, { ...s, id: 'sage_tower', w: 13, d: 12, h: 30, passage: 4.5 }, g);
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat('#8fd8ff', { emissive: '#8fd8ff', ei: 1.8 }));
        orb.position.set(0, 41.5, 0); orb.userData.dynamic = true; g.add(orb);
        world.animated.push(t => { orb.rotation.y = t * 0.6; orb.position.y = 41.5 + Math.sin(t * 1.3) * 0.2; });
        world.addLight(new THREE.Vector3(s.x, y + 41.5, s.z), '#8fd8ff', 1.6, 26);
        add(g);
        exclusions.push({ x: s.x, z: s.z, r: s.r * 1.6 + 5 });
        break;
      }
      case 'stall':
        buildStall(world, s, add, exclusions);
        break;
      case 'well':
        buildWell(world, s, add, exclusions);
        break;
      case 'campfire': {
        // a fire on a built floor (a bridge's road, a court) gives its own height
        const y = Number.isFinite(s.y) ? s.y : groundY(s.x, s.z);
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          addM(g, mesh(GEO.rock, mat('#6a6560'), Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8)).scale.set(0.25, 0.2, 0.25);
        }
        for (let i = 0; i < 3; i++) {
          const log = mesh(C(0.1, 0.1, 1.2, 5), mat('#4a3020'), 0, 0.2, 0);
          log.rotation.set(Math.PI / 2 - 0.4, (i / 3) * Math.PI * 2, 0, 'YXZ');
          g.add(log);
        }
        const fireCol = s.rift ? '#a274ff' : '#ff8a2a';
        g.add(mesh(new THREE.ConeGeometry(0.35, 0.9, 6), mat(fireCol, { emissive: fireCol, ei: 2.2 }), 0, 0.5, 0, false));
        add(g);
        world.addLight(new THREE.Vector3(s.x, y + 1.2, s.z), fireCol, 2.6, 16, true);
        world.addEmitter({ kind: s.rift ? 'riftfire' : 'fire', pos: new THREE.Vector3(s.x, y + 0.4, s.z), rate: 18 });
        if (!s.hostile) world.addInteract({ id: s.id, kind: 'campfire', pos: new THREE.Vector3(s.x, y + 0.5, s.z), radius: 3.2, label: 'Sit / Cook', name: s.name || 'Campfire' });
        exclusions.push({ x: s.x, z: s.z, r: 4 });
        break;
      }
      case 'dock': {
        // every ferry landing is a small harbour (world/harbours.js)
        const isl = terrain.islandFactor(s.x, s.z).island;
        const portCenter = s.id === 'dock_meridian' ? { cx: 760, cz: -560 } : isl;
        buildDock(world, { ...s, yawResolved: s.yaw ?? Math.atan2(s.x - portCenter.cx, s.z - portCenter.cz) }, exclusions, add);
        exclusions.push({ x: s.x, z: s.z, r: 5 });
        break;
      }
      case 'pier':
        buildShipPier(world, s, add, exclusions);
        break;
      case 'harbour_wall':
        buildHarbourWall(world, s, add, exclusions);
        break;
      case 'crane':
        buildHarbourCrane(world, s, add);
        break;
      case 'shipwreck': {
        const g = new THREE.Group();
        g.position.set(s.x, y - 0.6, s.z);
        g.rotation.set(0.25, s.rot || 0, 0.35);
        const wood = mat('#5a4430');
        for (let i = 0; i < 6; i++) {
          const rib = mesh(B(0.3, 3.2, 0.3), wood, -3 + i * 1.3, 1.2, 0);
          rib.rotation.z = 0.2;
          g.add(rib);
        }
        g.add(mesh(B(8, 0.4, 2.6), wood, 0, 0.1, 0));
        g.add(mesh(B(7, 1.6, 0.25), wood, 0, 0.9, 1.3));
        const mast = mesh(C(0.15, 0.2, 6, 6), wood, 1, 3, 0);
        mast.rotation.z = 0.6;
        g.add(mast);
        add(g);
        colliders.addBox({ x: s.x, z: s.z, w: 8, d: 3, y0: y - 2, y1: y + 0.8, rot: s.rot || 0 });
        break;
      }
      case 'crates': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        const wood = mat('#8a6a40');
        g.add(mesh(B(1, 1, 1), wood, 0, 0.5, 0));
        addM(g, mesh(B(1, 1, 1), wood, 1.1, 0.5, 0.2)).rotation.y = 0.3;
        addM(g, mesh(B(0.9, 0.9, 0.9), wood, 0.5, 1.45, 0.1)).rotation.y = 0.7;
        g.add(mesh(C(0.45, 0.45, 1.1, 8), mat('#6a4a2a'), -1, 0.55, 0.6));
        add(g);
        colliders.addBox({ x: s.x + 0.5, z: s.z + 0.1, w: 2.2, d: 1.2, y0: y - 1, y1: y + 1, climbable: true });
        break;
      }
      case 'order_shrine': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.add(mesh(B(4.4, 0.4, 4.4), mat('#2a2a30'), 0, 0.2, 0));
        g.add(mesh(B(3.2, 0.3, 3.2), mat('#3a3a42'), 0, 0.55, 0));
        for (const sx of [-1, 1]) {
          g.add(mesh(B(0.5, 3.4, 0.5), mat('#1e1e24'), sx * 1.6, 2.1, -1.2));
          g.add(mesh(B(0.7, 0.3, 0.7), mat('#d8d4c8'), sx * 1.6, 3.9, -1.2));
        }
        g.add(mesh(B(3.9, 0.3, 0.5), mat('#1e1e24'), 0, 4.1, -1.2));
        const cube = mesh(B(0.9, 0.9, 0.9), mat('#0e0e12', { emissive: '#e8e4dc', ei: 0.12, metalness: 0.4, roughness: 0.2 }), 0, 2.2, 0, false);
        g.add(cube);
        const ring = mesh(new THREE.TorusGeometry(0.95, 0.04, 6, 24), mat('#e8e4dc', { emissive: '#ffffff', ei: 0.8 }), 0, 2.2, 0, false);
        g.add(ring);
        cube.userData.dynamic = ring.userData.dynamic = true;
        world.animated.push((t) => {
          cube.rotation.set(t * 0.3, t * 0.45, t * 0.2);
          cube.position.y = 2.2 + Math.sin(t * 0.9) * 0.12;
          ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.5) * 0.3, t * 0.6, 0);
          ring.position.y = cube.position.y;
        });
        add(g);
        colliders.addBox({ x: s.x, z: s.z, w: 4.4, d: 4.4, y0: y - 1, y1: y + 0.7 });
        world.addLight(new THREE.Vector3(s.x, y + 2.4, s.z), '#e8e4dc', 1.0, 9);
        world.addInteract({ id: s.id, kind: 'order', pos: new THREE.Vector3(s.x, y + 1, s.z), radius: 3.4, label: 'Kneel at the Shrine of Order', use: (game) => act('openOrder', game.ui) });
        exclusions.push({ x: s.x, z: s.z, r: 4 });
        break;
      }
      case 'altar': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.add(mesh(C(2.2, 2.6, 0.5, 8), mat('#a8a49a'), 0, 0.25, 0));
        g.add(mesh(C(0.6, 0.8, 1.4, 8), mat('#8a867c'), 0, 1.2, 0));
        const crystal = mesh(new THREE.OctahedronGeometry(0.45, 0), mat('#c8a8ff', { emissive: '#a274ff', ei: 1.6 }), 0, 2.6, 0, false);
        crystal.userData.dynamic = true;
        g.add(crystal);
        world.animated.push((t) => {
          crystal.rotation.y = t * 0.8;
          crystal.position.y = 2.6 + Math.sin(t * 1.6) * 0.15;
        });
        add(g);
        colliders.addCyl({ x: s.x, z: s.z, r: 0.8, y0: y - 1, y1: y + 1.9 });
        world.addLight(new THREE.Vector3(s.x, y + 2.6, s.z), '#a274ff', 1.4, 10);
        world.addInteract({ id: s.id, kind: 'altar', pos: new THREE.Vector3(s.x, y + 1, s.z), radius: 3.2, label: 'Empower Mantra' });
        exclusions.push({ x: s.x, z: s.z, r: 4 });
        break;
      }
      case 'board': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.rotation.y = s.rot || 0;
        for (const sx of [-1, 1]) g.add(mesh(B(0.15, 2.4, 0.15), mat('#5a4030'), sx, 1.2, 0));
        g.add(mesh(B(2.4, 1.4, 0.1), mat('#7a5a3a'), 0, 1.6, 0));
        for (let i = 0; i < 4; i++) g.add(mesh(B(0.45, 0.55, 0.02), mat('#efe4c8'), -0.75 + i * 0.5, 1.6 + (i % 2) * 0.15, 0.07, false));
        add(g);
        world.addInteract({ id: s.id, kind: 'board', pos: new THREE.Vector3(s.x, y + 1, s.z), radius: 2.8, label: 'Read Notices' });
        break;
      }
      case 'bell': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        for (const sx of [-1.2, 1.2]) g.add(mesh(B(0.3, 4, 0.3), mat('#5a4030'), sx, 2, 0));
        g.add(mesh(B(2.8, 0.3, 0.3), mat('#5a4030'), 0, 4, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.75, 1.1, 10, 1, true), mat('#b8903a', { metalness: 0.7, roughness: 0.35, double: true }), 0, 3.25, 0));
        add(g);
        world.addInteract({ id: 'bell', kind: 'bell', pos: new THREE.Vector3(s.x, y + 1, s.z), radius: 2.8, label: 'Ring Bell' });
        break;
      }
      case 'lamp':
        buildLamp(world, s, add, exclusions);
        break;
      case 'street':
        buildStreet(world, s, add, exclusions);
        break;
      case 'shrine':
        buildVowPerch(world, s, add, exclusions);
        break;
      case 'lighthouse':
        buildLightTower(world, s, exclusions, add);
        break;
      case 'beacon_post':
        buildBeaconPost(world, s, exclusions, add);
        break;
      case 'signal_camp':
        buildSignalCamp(world, s, exclusions, add, samplePath(ROADS.find(r => r.id === s.road), 9));
        break;
      case 'fence': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.rotation.y = s.rot || 0;
        for (let i = 0; i <= s.len; i += 2) g.add(mesh(B(0.18, 1.3, 0.18), mat('#6a4a2a'), i - s.len / 2, 0.65, 0));
        for (const hy of [0.5, 1.05]) g.add(mesh(B(s.len, 0.1, 0.08), mat('#7a5a3a'), 0, hy, 0));
        add(g);
        colliders.addBox({ x: s.x, z: s.z, w: s.len, d: 0.3, y0: y - 1, y1: y + 1.2, rot: s.rot || 0 });
        break;
      }
      case 'palisade': {
        // A stockade grown from the ground: ellipse + angular wobble, not a compass ring.
        const gaps = s.gaps || [-1.53, 0.93];
        const g = new THREE.Group();
        const log = mat('#5a4030');
        const aspect = s.aspect ?? 1.38;
        const rx = s.rx ?? s.r * aspect;
        const rz = s.rz ?? s.r / aspect;
        const rot = s.rot || 0;
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const perim = Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)));
        const n = Math.max(24, Math.floor(perim / 0.8));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const yaw = Math.atan2(Math.cos(a), Math.sin(a));
          let inGap = false;
          for (const gy of gaps) if (Math.abs(Math.atan2(Math.sin(yaw - gy), Math.cos(yaw - gy))) < 0.12) inGap = true;
          if (inGap) continue;
          // Pull the wall in and out so the hold reads as cleared timber, not a drawn circle.
          const wob = 1 + 0.16 * Math.sin(a * 2 + 0.85) + 0.11 * Math.sin(a * 3 - 1.2) + 0.07 * Math.sin(a * 5 + 2.1);
          let lx = Math.cos(a) * rx * wob, lz = Math.sin(a) * rz * wob;
          if (rot) { const t = lx * cosR - lz * sinR; lz = lx * sinR + lz * cosR; lx = t; }
          const px = s.x + lx, pz = s.z + lz;
          const py = groundY(px, pz);
          const hh = 4.2 + ((i * 37) % 7) * 0.12;
          const m = mesh(C(0.3, 0.36, hh + 1.5, 6), log, px, py + hh / 2 - 0.5, pz);
          g.add(m);
          const tip = mesh(new THREE.ConeGeometry(0.3, 0.7, 6), log, px, py + hh + 0.6, pz);
          g.add(tip);
          if (i % 2 === 0) colliders.addCyl({ x: px, z: pz, r: 0.62, y0: py - 2, y1: py + hh, climbable: true });
        }
        add(g);
        break;
      }
      case 'tent': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.rotation.y = s.rot || 0;
        const tent = mesh(new THREE.ConeGeometry(2.6, 3, 4), mat(s.color || '#8a5a3a'), 0, 1.5, 0);
        tent.rotation.y = Math.PI / 4;
        g.add(tent);
        g.add(mesh(B(0.9, 1.4, 0.1), mat('#2a1a10'), 0, 0.7, 1.6, false));
        add(g);
        colliders.addCyl({ x: s.x, z: s.z, r: 1.7, y0: y - 1, y1: y + 2.5 });
        exclusions.push({ x: s.x, z: s.z, r: 4 });
        break;
      }
      case 'banner': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.add(mesh(C(0.08, 0.1, 6, 6), mat('#3a2a1a'), 0, 3, 0));
        const cloth = mesh(B(0.05, 2.2, 1.3), mat('#a8281c', { double: true }), 0, 4.6, 0.7);
        cloth.userData.dynamic = true;
        g.add(cloth);
        world.animated.push((t) => (cloth.rotation.y = Math.sin(t * 2 + s.x) * 0.25));
        add(g);
        break;
      }
      case 'ruins': {
        // The footings of an older station: a broken ring of coursed piers, each on its own
        // ground with a footing below the lowest of it, none standing in the water; an owl
        // has nested on the tallest.
        const region = regionAtPoint(s.x, s.z);
        const k = new Kit(familyFor(region?.id, s.x));
        const piers = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const lx = Math.cos(a) * 9, lz = Math.sin(a) * 9;
          const gy = groundY(s.x + lx, s.z + lz);
          if (gy < 0.8) continue;
          const [lo] = groundRange(terrain, s.x + lx, s.z + lz, 1.8, 1.8);
          const h = 2 + ((i * 53) % 5);
          k.footing(lx, lz, 1.7, 1.7, gy - y + 0.3, lo - y, 'stone2');
          k.pier(lx, gy - y + 0.3, lz, 1.2, h, { c: 'stone', c2: 'stone2' });
          colliders.addBox({ x: s.x + lx, z: s.z + lz, w: 1.4, d: 1.4, y0: lo - 1, y1: gy + 0.3 + h, climbable: true });
          piers.push({ lx, lz, top: gy - y + 0.3 + h });
        }
        const tall = piers.sort((a, b) => b.top - a.top)[0];
        if (tall) {
          // fallen timber and roof slate heaped into a nest
          for (let j = 0; j < 7; j++) {
            const b = (j / 7) * Math.PI * 2;
            k.slab(tall.lx + Math.cos(b) * 0.45, tall.top, tall.lz + Math.sin(b) * 0.45, 0.16, 0.18, 1.3, 'earth', { ry: b + 1.2, rz: 0.25 });
          }
        }
        const g = k.build('Station footings');
        g.position.set(s.x, y, s.z);
        add(g);
        exclusions.push({ x: s.x, z: s.z, r: 11 });
        break;
      }
      case 'hut':
        // a one-room hut on stilts: reed in the fen, root timber in the jungle
        buildVernacular(world, { ...s, type: 'hut', w: 4.6, d: 4.4, style: s.x < 0 && s.z < 0 ? 'reed' : 'root' }, add, exclusions);
        break;
      case 'shrine_ruin': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.add(mesh(C(7, 7.4, 0.5, 12), mat('#6a7a6a'), 0, 0.1, 0));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const h = 3 + (i % 3) * 1.5;
          const p = mesh(C(0.5, 0.55, h, 8), mat('#7a8a7a'), Math.cos(a) * 6, h / 2, Math.sin(a) * 6);
          p.rotation.z = ((i % 4) - 1.5) * 0.08;
          g.add(p);
          colliders.addCyl({ x: s.x + Math.cos(a) * 6, z: s.z + Math.sin(a) * 6, r: 0.55, y0: y - 1, y1: y + h });
        }
        add(g);
        exclusions.push({ x: s.x, z: s.z, r: 9 });
        break;
      }
      case 'ice_arena': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        const ice = mat('#cfefff', { emissive: '#3a7aa8', ei: 0.35, roughness: 0.2 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const h = 5 + (i % 3) * 2.5;
          const p = mesh(new THREE.CylinderGeometry(0.2, 1.2, h, 5), ice, Math.cos(a) * s.r, h / 2 - 0.5, Math.sin(a) * s.r);
          g.add(p);
          colliders.addCyl({ x: s.x + Math.cos(a) * s.r, z: s.z + Math.sin(a) * s.r, r: 1.0, y0: y - 1, y1: y + h });
        }
        g.add(mesh(new THREE.CircleGeometry(s.r * 0.8, 24).rotateX(-Math.PI / 2), mat('#dff3ff', { roughness: 0.15, metalness: 0.1 }), 0, 0.06, 0, false));
        add(g);
        exclusions.push({ x: s.x, z: s.z, r: s.r + 4 });
        break;
      }
      case 'lava': {
        const lava = mesh(new THREE.CircleGeometry(s.r, 20).rotateX(-Math.PI / 2), mat('#ff5a10', { emissive: '#ff4a00', ei: 2.2 }), s.x, y + 0.08, s.z, false);
        add(lava);
        world.animated.push((t) => (lava.material.emissiveIntensity = 1.8 + Math.sin(t * 2) * 0.4));
        world.hazards.push({ x: s.x, z: s.z, r: s.r, y: y, dps: 25, element: 'ember', status: 'burn' });
        world.addLight(new THREE.Vector3(s.x, y + 2, s.z), '#ff5a1a', 3, 30, true);
        world.addEmitter({ kind: 'fire', pos: new THREE.Vector3(s.x, y + 0.2, s.z), rate: 25, spread: s.r });
        break;
      }
      case 'rift_gate': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        const stone = mat('#2a2236');
        for (const sx of [-2.6, 2.6]) g.add(mesh(B(1, 7, 1), stone, sx, 3.5, 0));
        g.add(mesh(B(6.4, 1, 1.2), stone, 0, 7.3, 0));
        const portal = mesh(new THREE.PlaneGeometry(4.2, 6.4), mat('#e8d8ff', { emissive: '#c8a8ff', ei: 1.8, transparent: true, opacity: 0.75, double: true, depthWrite: false }), 0, 3.4, 0, false);
        g.add(portal);
        world.animated.push((t) => (portal.material.opacity = 0.55 + Math.sin(t * 3) * 0.2));
        // face toward the rift center
        g.rotation.y = s.face ?? Math.atan2(6000 - s.x, 6000 - s.z);
        add(g);
        world.addLight(new THREE.Vector3(s.x, y + 3.5, s.z), '#d8c0ff', 2.5, 22);
        world.addInteract({ id: s.id, kind: 'rift_gate', pos: new THREE.Vector3(s.x, y + 1, s.z), radius: 3.5, label: 'Return to the Surface' });
        world.addEmitter({ kind: 'riftmote', pos: new THREE.Vector3(s.x, y + 3, s.z), rate: 12, spread: 2 });
        break;
      }
      case 'arena':
        buildCrucible(world, s, add, exclusions);
        break;
      case 'crown_sluice': {
        // The drydock's sea gate, set in the shore below Meridian's slip. Its leaf hangs raised
        // under the windlass, and the water in its throat runs down into the passage the Grand Warden
        // took. Local +z faces the sea; heights are world heights (the waterline is 0).
        const g = new THREE.Group();
        g.name = s.name || 'The Crown Sluice';
        g.position.set(s.x, 0, s.z);
        g.rotation.y = s.rot || 0;
        const stone = mat('#707276'), stone2 = mat('#56585d'), timber = mat('#29292d'), iron = mat('#3c3e42', { metalness: 0.6, roughness: 0.5 });
        const foot = -3.5;
        const cs = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y);
        const local = (lx, lz) => ({ x: s.x + lx * cs + lz * sn, z: s.z - lx * sn + lz * cs });
        for (const sx of [-1, 1]) {
          g.add(mesh(B(1.8, 8 - foot, 4.2), stone, sx * 3.4, (8 + foot) / 2, 0));
          g.add(mesh(B(2.2, 0.4, 4.6), stone2, sx * 3.4, 8.2, 0));
          // the cheeks run on back into the bank as low walls either side of the apron
          g.add(mesh(B(1.8, 2.6 - foot, 5.4), stone, sx * 3.4, (2.6 + foot) / 2, -4.8));
          g.add(mesh(B(0.14, 1.9, 0.14), iron, sx * 1.9, 7.4, -0.35));
          const c = local(sx * 3.4, 0);
          colliders.addBox({ x: c.x, z: c.z, w: 1.8, d: 4.2, y0: foot, y1: 8.4, rot: g.rotation.y });
        }
        g.add(mesh(B(8.6, 1.2, 1.6), stone2, 0, 7.4, 0));
        const drum = mesh(C(0.55, 0.55, 5.2, 10), timber, 0, 8.7, -0.7);
        drum.rotation.z = Math.PI / 2;
        g.add(drum);
        // the leaf, raised clear of the water and banded in iron
        g.add(mesh(B(5, 3, 0.45), timber, 0, 5.1, 0.2));
        for (const yy of [4.0, 5.1, 6.2]) g.add(mesh(B(5.1, 0.18, 0.55), iron, 0, yy, 0.22));
        // the throat: dark water where the sea should be shallow, faintly lit from below
        const throat = mesh(new THREE.PlaneGeometry(4.9, 10).rotateX(-Math.PI / 2), mat('#0b0812', { emissive: '#3c2470', ei: 0.55, transparent: true, opacity: 0.92, depthWrite: false }), 0, 0.08, 3.4, false);
        throat.renderOrder = 2;
        g.add(throat);
        // the apron one stands on to work the windlass
        const stand = local(0, -4.8);
        const apronY = Math.max(groundY(stand.x, stand.z), 0.6);
        g.add(mesh(B(8.4, apronY - foot, 4.4), stone2, 0, (apronY + foot) / 2, -4.8));
        add(g);
        colliders.addBox({ x: stand.x, z: stand.z, w: 8.4, d: 4.4, y0: foot, y1: apronY, rot: g.rotation.y });
        const glow = local(0, 3.4);
        world.addLight(new THREE.Vector3(glow.x, 0.6, glow.z), '#7a4aff', 1.8, 18);
        world.addInteract({ id: s.id || 'crown_sluice', kind: 'sluice', pos: new THREE.Vector3(stand.x, apronY + 1, stand.z), radius: 4, label: 'Go down through the Crown Sluice', use: () => act('enterSluice') });
        exclusions.push({ x: s.x, z: s.z, r: 10 });
        break;
      }
      case 'throne': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.rotation.y = Math.PI;
        const stone = mat('#1e1828');
        g.add(mesh(B(8, 1.2, 6), stone, 0, 0.6, 0));
        g.add(mesh(B(3, 1.2, 2.4), stone, 0, 1.8, 0));
        g.add(mesh(B(3, 6, 0.6), stone, 0, 4.2, -1.1));
        for (const sx of [-1.4, 1.4]) g.add(mesh(new THREE.ConeGeometry(0.3, 2, 5), mat('#a274ff', { emissive: '#7a4aff', ei: 1.4 }), sx, 7.8, -1.1, false));
        add(g);
        colliders.addBox({ x: s.x, z: s.z, w: 8, d: 6, y0: y - 1, y1: y + 1.2 });
        break;
      }
      case 'obelisk': {
        const g = new THREE.Group();
        g.position.set(s.x, y, s.z);
        g.add(mesh(B(1.6, 9, 1.6), mat('#1a1424'), 0, 4.3, 0));
        for (let i = 0; i < 4; i++) g.add(mesh(B(1.65, 0.12, 1.65), mat('#a274ff', { emissive: '#8a5aff', ei: 1.6 }), 0, 1.5 + i * 2, 0, false));
        add(g);
        colliders.addBox({ x: s.x, z: s.z, w: 1.6, d: 1.6, y0: y - 1, y1: y + 8.8 });
        world.addLight(new THREE.Vector3(s.x, y + 5, s.z), '#8a5aff', 1.2, 14);
        break;
      }
      case 'sounding_tower':
      case 'stone_hall':
      case 'stone_gate':
      case 'stone_belfry':
        buildHushStone(world, s, add, exclusions);
        break;
      case 'dummy':
        world.dummySpots.push(new THREE.Vector3(s.x, y, s.z));
        break;
      case 'great_tree':
        buildLanternTree(world, s, add, exclusions);
        break;
      case 'sounding_house':
        buildSoundingHouse(world, s, add, exclusions);
        break;
      case 'chair_fields':
        buildChairFields(world, s, add, exclusions);
        break;
      case 'listening_stones':
        buildListeningStones(world, s, add, exclusions);
        break;
      case 'mothers_mire':
        buildMothersMire(world, s, add, exclusions);
        break;
      case 'stair':
        buildTerraceStair(world, s, add, exclusions);
        break;
      default:
        // fen village pieces (world/fenArchitecture.js), else world/etris.js civic features
        if (!buildSettlementFixture(world, s, add, exclusions) && !buildFenFeature(world, s, add, mat, exclusions, civicKit)) buildFeature(world, s, add, mat, exclusions);
        break;
    }
  }

  buildArchitecture(world, exclusions, add, mat);
  buildMeridianLift(world, exclusions, add);
  buildMeridianBridge(world, exclusions, add);
  buildShelfFaces(world, exclusions, add);
  buildDressing(world, exclusions, add, mat);

  // Flattened areas are kept clear of trees.
  for (const isl of ISLANDS) for (const f of isl.flats || []) exclusions.push({ x: f.x, z: f.z, r: f.r * 0.75 });
  const stats = mergeStatic(scene, roots);
  world.mergeStats = stats;
  return exclusions;
}

// ------------------------------------------------------------------ the Hush in stone
// The Ministry of Soundings builds in the Hush's own grey stone and slate (PALETTES.hush, read
// the way style.js reads every settlement palette for the kit): plain coursed masonry, dark
// unlit windows by day, a lantern only where a door needs one.
function hushKit() {
  const p = PALETTES.hush;
  return { stone: p.stone, stone2: p.stone2, edge: p.plaster2, dark: p.timber, roof: p.roof, metal: shade(p.stone2, -0.2), glow: p.lantern, cloth: p.cloth, earth: '#55565c', moss: '#8a9290' };
}

function buildHushStone(world, s, add, exclusions) {
  const { terrain, colliders } = world;
  const rot = s.rot || 0;
  const y = terrain.heightAt(s.x, s.z);
  const k = new Kit(hushKit());
  const lights = [];
  if (s.type === 'sounding_tower') {
    // The Sounding House: a square tower whose upper stage opens in tall louvred slots, a
    // bronze listening horn turned to each quarter of the sea, under a slate hip.
    const w = s.w || 9, w2 = w - 1.2, h1 = 13, h2 = 9;
    const [lo] = groundRange(terrain, s.x, s.z, w + 2, w + 2, rot);
    k.footing(0, 0, w + 1.2, w + 1.2, 0.4, lo - y);
    k.masonry(0, 0.4, 0, w, h1, w, { c: 'stone', c2: 'stone2' });
    k.slab(0, 0.4 + h1 - 0.35, 0, w + 0.45, 0.4, w + 0.45, 'edge');
    k.slab(0, 0.4, w / 2 + 0.03, 1.8, 2.8, 0.12, 'dark', { grad: 0 });
    k.slab(0, 3.2, w / 2 + 0.12, 2.6, 0.45, 0.4, 'edge');
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      k.window(Math.sin(a) * (w / 2 + 0.01), 7.2, Math.cos(a) * (w / 2 + 0.01), 0.7, 1.6, { ry: a });
    }
    const y2 = 0.4 + h1;
    k.masonry(0, y2, 0, w2, h2, w2, { c: 'stone', c2: 'stone2' });
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      k.at({ x: Math.sin(a) * (w2 / 2 + 0.02), y: y2 + 1.6, z: Math.cos(a) * (w2 / 2 + 0.02), ry: a }, (kk) => {
        kk.block(0, 2.8, 0, 1.7, 5.6, 0.1, 'dark', { grad: 0 });
        if (kk.detail >= 1) for (let j = 0; j < 7; j++) kk.slab(0, 0.35 + j * 0.76, 0.1, 1.8, 0.12, 0.22, 'edge', { rx: -0.5 });
        kk.slab(0, 5.6, 0.12, 2.3, 0.32, 0.32, 'edge');
        kk.slab(0, -0.32, 0.12, 2.3, 0.32, 0.4, 'edge');
      });
      k.at({ x: Math.sin(a + 0.6) * (w2 / 2 + 0.15), y: y2 + 0.7, z: Math.cos(a + 0.6) * (w2 / 2 + 0.15), ry: a, rx: Math.PI / 2 - 0.2 }, (kk) => kk.prism(0, 0, 0, 0.2, 1.9, 'metal', { sides: 8, top: 3.6, layer: 'metal' }));
    }
    const y3 = y2 + h2;
    k.cornice(0, y3 - 0.48, 0, w2, w2);
    k.roof('hip', 0, y3, 0, w2, w2, 4.8, { c: 'roof', overhang: 0.6 });
    k.prism(0, y3 + 4.5, 0, 0.1, 3.2, 'metal', { sides: 4, layer: 'metal' });
    lights.push(k.lantern(1.7, 0.4, w / 2 + 0.9, { post: 2.6 }));
    colliders.addBox({ x: s.x, z: s.z, w: w + 0.4, d: w + 0.4, y0: lo - 1, y1: y + y3, rot });
    exclusions.push({ x: s.x, z: s.z, r: w * 0.8 + 4 });
  } else if (s.type === 'stone_hall') {
    // A Ministry hall: buttressed grey stone under a steep slate roof, narrow dark windows,
    // one door under a lintel, a chimney for the clerks' stove.
    const w = s.w || 16, d = s.d || 10, h = s.h || 7, hw = w / 2, hd = d / 2;
    const [lo, hi] = groundRange(terrain, s.x, s.z, w + 2, d + 2, rot);
    const fl = hi - y + 0.3;
    k.footing(0, 0, w + 1, d + 1, fl, lo - y);
    const o = { t: 0.9, buttress: 4, windows: true, windowEvery: 3.6, windowY: 3, cornice: true, c: 'stone', c2: 'stone2', plinth: false };
    k.wall(-hw, -hd, hw, -hd, fl, h, o);
    k.wall(hw, -hd, hw, hd, fl, h, { ...o, buttress: 0 });
    k.wall(-hw, hd, -hw, -hd, fl, h, { ...o, buttress: 0 });
    k.wall(hw, hd, 1.5, hd, fl, h, o);
    k.wall(-1.5, hd, -hw, hd, fl, h, o);
    k.masonry(0, fl + 3.1, hd, 3.0, h - 3.1, 0.9, { c: 'stone', c2: 'stone2' });
    k.slab(0, fl + 2.9, hd + 0.1, 3.4, 0.4, 1.1, 'edge');
    k.slab(0, fl, hd - 0.1, 2.2, 2.9, 0.12, 'dark', { grad: 0 });
    k.roof('gable', 0, fl + h, 0, d, w, h * 0.65, { c: 'roof', ry: Math.PI / 2, overhang: 0.6 });
    k.masonry(hw * 0.55, fl + h, -hd * 0.35, 1.2, h * 0.8, 1.2, { c: 'stone2' });
    lights.push(k.lantern(2.4, fl, hd + 1.1, { post: 2.6 }));
    colliders.addBox({ x: s.x, z: s.z, w: w + 0.4, d: d + 0.4, y0: lo - 1, y1: y + fl + h, rot });
    exclusions.push({ x: s.x, z: s.z, r: Math.max(w, d) * 0.7 + 4 });
  } else if (s.type === 'stone_belfry') {
    // a bell hung between two coursed piers under a slate cap; `tilt` for one the ground has
    // let go of
    const w = s.w || 7, h = s.h || 9;
    for (const sx of [-1, 1]) {
      k.footing(sx * w / 2, 0, 2.0, 2.0, 0.3, -1.2);
      k.pier(sx * w / 2, 0.3, 0, 1.4, h - 0.3, { c: 'stone', c2: 'stone2' });
      const [cx, cz] = [s.x + Math.cos(rot) * sx * w / 2, s.z - Math.sin(rot) * sx * w / 2];
      colliders.addCyl({ x: cx, z: cz, r: 0.9, y0: y - 1, y1: y + h });
    }
    k.slab(0, h, 0, w + 1.8, 0.8, 1.4, 'stone2');
    k.roof('gable', 0, h + 0.8, 0, 1.6, w + 1.8, 1.0, { c: 'roof', ry: Math.PI / 2, overhang: 0.3 });
    k.slab(0, h - 0.5, 0, 0.3, 0.5, 0.3, 'metal', { layer: 'metal' });
    k.prism(0, h - 3.8, 0, 1.55, 3.3, 'metal', { sides: 10, top: 0.42, layer: 'metal' });
    k.prism(0, h - 3.9, 0, 1.62, 0.25, 'metal', { sides: 10, layer: 'metal' });
  } else {
    // the precinct's gate: two piers and a plain arch, no doors to shut
    const w = s.w || 7, h = s.h || 7.5;
    for (const sx of [-1, 1]) {
      k.footing(sx * (w / 2 + 0.8), 0, 2.2, 2.2, 0.3, Math.min(0, terrain.heightAt(s.x, s.z) - y) - 0.4);
      k.pier(sx * (w / 2 + 0.8), 0.3, 0, 1.6, h - 0.3, { c: 'stone', c2: 'stone2' });
      const [cx, cz] = [s.x + Math.cos(rot) * sx * (w / 2 + 0.8), s.z - Math.sin(rot) * sx * (w / 2 + 0.8)];
      colliders.addBox({ x: cx, z: cz, w: 1.8, d: 1.8, y0: y - 1, y1: y + h, rot });
    }
    k.arch(0, h - (w + 1.6) / 2 + 0.2, 0, w + 1.6, { t: 0.8, depth: 1.6, c: 'edge', spandrel: true, fill: 'stone' });
    k.slab(0, h + 0.4, 0, w + 4.2, 0.5, 2.0, 'edge');
  }
  const g = k.build(s.name || s.type);
  g.position.set(s.x, y, s.z);
  g.rotation.set(0, rot, s.tilt || 0, 'YXZ');
  add(g);
  g.updateMatrixWorld(true);
  for (const p of lights) world.addLight(p.clone().applyMatrix4(g.matrixWorld), LIGHT_COLORS.lantern, 1.0, 11, true);
}

export function makeBoatMesh(hull = '#6a4a30', sail = '#e8e0d0', withSail = false) {
  const g = new THREE.Group();
  const wood = mat(hull);
  const bottom = mesh(B(1.6, 0.5, 5), wood, 0, 0, 0);
  g.add(bottom);
  for (const sx of [-1, 1]) {
    const side = mesh(B(0.18, 0.8, 5.2), wood, sx * 0.85, 0.35, 0);
    side.rotation.z = sx * -0.2;
    g.add(side);
  }
  const bow = mesh(new THREE.ConeGeometry(0.9, 1.6, 4), wood, 0, 0.2, 3.2);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  g.add(bow);
  g.add(mesh(B(1.5, 0.12, 0.4), mat('#8a6a48'), 0, 0.4, -0.6));
  if (withSail) {
    g.add(mesh(C(0.07, 0.09, 4.6, 6), mat('#4a3a28'), 0, 2.4, 0.6));
    const s = mesh(new THREE.PlaneGeometry(2.4, 3), mat(sail, { double: true }), 0, 2.8, 0.7);
    g.add(s);
    g.userData.sail = s;
  }
  return g;
}

export { smoothstep };
