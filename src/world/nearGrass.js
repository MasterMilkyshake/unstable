// A single instanced patch on stable world cells. Updates only when crossing a
// cell; vegetation never follows the player's feet or appears on built floors.
import * as THREE from 'three';
import { hash3 } from './kit.js';
import { KIT_MATERIALS, PALETTES } from './style.js';
import { islandAtPoint, biomeOfPoint } from '../data/world.js';

const TUFT = new THREE.ConeGeometry(0.1, 0.28, 4);
TUFT.translate(0, 0.14, 0);
const MATRIX = new THREE.Matrix4();
const COLOR = new THREE.Color();
const GRASS = new Set(['meadow', 'beach', 'farmland', 'forest', 'emberwood', 'jungle']);

export function buildNearGrass(world, quality = 'high') {
  const material = KIT_MATERIALS.solid.clone();
  material.vertexColors = false;
  const mesh = new THREE.InstancedMesh(TUFT, material, 169);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  world.scene.add(mesh);
  world.nearGrass = { mesh, low: quality === 'low', x: NaN, z: NaN };
}

export function setNearGrassQuality(world, quality) {
  if (!world.nearGrass) buildNearGrass(world, quality);
  world.nearGrass.low = quality === 'low';
  world.nearGrass.mesh.visible = quality !== 'low';
}

export function updateNearGrass(world, camera, center) {
  const ng = world.nearGrass;
  if (!ng) return;
  ng.mesh.visible = !ng.low && center.x < 2800;
  if (!ng.mesh.visible) return;
  const cx = Math.floor(center.x / 2), cz = Math.floor(center.z / 2);
  if (cx === ng.x && cz === ng.z) return;
  ng.x = cx;
  ng.z = cz;
  let count = 0;
  for (let ix = cx - 6; ix <= cx + 6; ix++) for (let iz = cz - 6; iz <= cz + 6; iz++) {
    const x = ix * 2 + hash3(ix, 2, iz) * 1.7;
    const z = iz * 2 + hash3(ix, 3, iz) * 1.7;
    const island = islandAtPoint(x, z);
    if (!island || !GRASS.has(biomeOfPoint(island, x, z))) continue;
    const h = world.terrain.heightAt(x, z);
    if (h < 1.2 || world.colliders.groundAt(x, z, h + 4) > h + 0.1) continue;
    if (world.exclusions?.some(e => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
    const scale = 0.7 + hash3(ix, 4, iz) * 0.5;
    MATRIX.makeScale(scale, scale, scale);
    MATRIX.setPosition(x, h - 0.03, z);
    ng.mesh.setMatrixAt(count, MATRIX);
    ng.mesh.setColorAt(count, COLOR.set(PALETTES.ancient.moss));
    count++;
  }
  ng.mesh.count = count;
  ng.mesh.instanceMatrix.needsUpdate = true;
  if (ng.mesh.instanceColor) ng.mesh.instanceColor.needsUpdate = true;
}
