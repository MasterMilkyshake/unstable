// Static-mesh batching: bakes hand-placed structure meshes into merged meshes per map cell.
// Plain materials (no texture, no glow) are folded together: their colours are baked into
// vertex colours so a whole cell of masonry, timber and roof tiles of the same surface type
// draws in one call. Textured and emissive materials keep a bucket each.
// Meshes (or ancestors) flagged userData.dynamic, transparent materials and mirrored
// transforms are left untouched.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _p = new THREE.Vector3();
const KEEP = ['position', 'normal', 'uv'];
const KEEP_COLORED = [...KEEP, 'color'];
const sharedPlain = new Map();

// A plain material: standard, untextured, not glowing, not vertex-coloured already.
function plainKey(m) {
  if (!m.isMeshStandardMaterial || m.map || m.vertexColors || m.normalMap || m.alphaMap) return null;
  if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) > 0.001) return null;
  const r = Math.round(m.roughness * 10) / 10;
  const mt = Math.round(m.metalness * 10) / 10;
  return `${r}|${mt}|${m.flatShading ? 1 : 0}|${m.side}`;
}
function sharedMaterial(key, m) {
  let s = sharedPlain.get(key);
  if (!s) {
    s = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, flatShading: m.flatShading, side: m.side });
    sharedPlain.set(key, s);
  }
  return s;
}

export function mergeStatic(scene, roots, cellSize = 320) {
  const buckets = new Map();
  const merged = [];
  for (const r of roots) r.updateMatrixWorld(true);
  for (const root of roots) {
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
      for (let q = o; q; q = q.parent) if (q.userData && q.userData.dynamic) return;
      const m = o.material;
      if (!m || Array.isArray(m) || m.transparent) return;
      if (o.matrixWorld.determinant() < 0) return;
      o.getWorldPosition(_p);
      const cell = `${Math.floor(_p.x / cellSize)},${Math.floor(_p.z / cellSize)}`;
      const pk = plainKey(m);
      const key = pk ? `${cell}|plain|${pk}|${o.castShadow ? 1 : 0}` : `${cell}|${m.uuid}|${o.castShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: pk ? sharedMaterial(pk, m) : m, plain: !!pk, castShadow: o.castShadow, geos: [], meshes: [] }));
      b.meshes.push(o);
    });
  }
  let removed = 0;
  for (const b of buckets.values()) {
    // a lone plain mesh still joins the shared material (it costs nothing extra)
    if (b.meshes.length < 2 && !b.plain) continue;
    const keep = !b.plain && b.material.vertexColors ? KEEP_COLORED : KEEP;
    for (const o of b.meshes) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!keep.includes(a)) g.deleteAttribute(a);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (b.plain) {
        const c = o.material.color;
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          col[i * 3] = c.r;
          col[i * 3 + 1] = c.g;
          col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      }
      g.morphAttributes = {};
      g.applyMatrix4(o.matrixWorld);
      b.geos.push(g);
    }
    const geo = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.castShadow;
    mesh.receiveShadow = true;
    mesh.name = 'merged_static';
    scene.add(mesh);
    merged.push(mesh);
    for (const o of b.meshes) {
      o.parent.remove(o);
      removed++;
    }
  }
  return { merged: merged.length, removed };
}
