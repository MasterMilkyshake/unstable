import * as THREE from 'three';

// Small, repeatable material maps, shared across every building and region.
// No canvas, downloads or per-building textures are needed at world creation.
const maps = new Map();
const materials = new Map();
const noise = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export function materialMap(kind) {
  if (maps.has(kind)) return maps.get(kind);
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let value = 238 + noise(x, y) * 14;
    if (kind === 'stone' || kind === 'slate') {
      const rowHeight = kind === 'stone' ? 32 : 16;
      const row = Math.floor(y / rowHeight);
      const xx = (x + (row % 2) * 32) % 64;
      const seam = y % rowHeight < 2 || xx < 2;
      value = seam ? 142 : 213 + noise(Math.floor((x + (row % 2) * 32) / 64), row) * 28 + noise(x, y) * 10;
    } else if (kind === 'wood') {
      const grain = Math.sin(x * 1.7 + Math.sin(y * Math.PI / 64) * 1.6);
      value = x % 32 < 2 ? 158 : 218 + grain * 12 + noise(x, y) * 15;
    } else if (kind === 'plaster') {
      value = 228 + noise(Math.floor(x / 4), Math.floor(y / 4)) * 14 + noise(x, y) * 10;
    } else if (kind === 'thatch') {
      // reed laid in courses: straws run across u, each course ends in a darker lip
      const course = Math.floor(y / 21);
      const lip = y % 21 > 17;
      const straw = noise(Math.floor(x / 2) + course * 7, course) * 34 + noise(x, y) * 12;
      value = (lip ? 150 : 196) + straw;
    }
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.name = `weathered_${kind}`;
  maps.set(kind, texture);
  return texture;
}

export function buildingMaterial(color, kind = 'stone') {
  const key = `${kind}:${color}`;
  if (!materials.has(key)) {
    const map = materialMap(kind);
    const material = new THREE.MeshStandardMaterial({
      color, map, bumpMap: map, bumpScale: kind === 'plaster' ? 0.035 : 0.085,
      roughness: kind === 'slate' ? 0.84 : 0.96, flatShading: true,
    });
    material.name = `${kind}_${color}`;
    materials.set(key, material);
  }
  return materials.get(key);
}

// Keep mortar courses and grain at a consistent physical scale on box faces.
export function sizeBoxUVs(geometry, w, h, d) {
  const uv = geometry.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) for (let v = 0; v < 4; v++) {
    const i = face * 4 + v;
    uv.setXY(i, uv.getX(i) * faces[face][0] / 4, uv.getY(i) * faces[face][1] / 4);
  }
  return geometry;
}
