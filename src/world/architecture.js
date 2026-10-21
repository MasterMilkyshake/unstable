// Procedural civic architecture. Shared materials are batched with the original
// structures; the kit registers physical columns, lintels and accessible decks.
import * as THREE from 'three';
import { tide, styleFor, STYLES } from './etris.js';
import { STRUCTURES, NPCS } from '../data/world.js';
import { ROADS } from '../data/roads.js';
import { ARCHITECTURE, ARCHITECTURE_PALETTES, CIVIC_ROADS, SETTLEMENT_ROADS, INNER_WARDS, SALTREACH_RING, SALTREACH_GATES, WALL_RISE, APPROACHES } from '../data/architecture.js';
import { buildingMaterial, sizeBoxUVs } from './buildingMaterials.js';
import { fenBuilding, fenHutRoof } from './fenArchitecture.js';
import { samplePath } from './paths.js';
import { buildRampart } from './fortifications.js';
import { buildSeaGate, buildGatehouse } from './seaGate.js';
import { buildWayfinding, settlementWeight } from './wayfinding.js';
import { buildCitadel, buildCastle } from './citadel.js';
import { buildInnerWard } from './innerWards.js';
import { buildLanternPalace, buildEnclavePalace } from './palaces.js';
import { buildBrigandHold, buildReedOutlet } from './seats.js';
import { buildPassWatch } from './outposts.js';
import { buildApproach } from './approaches.js';
import { buildRoadworks } from './roadworks.js';
import { MERIDIAN_RING, MERIDIAN_LOWER_RING, MERIDIAN_GATES, MERIDIAN_APPROACHES } from '../data/architecture.js';
import { seededRandom, smoothstep } from '../core/util.js';

const UP = new THREE.Vector3(0, 1, 0);

export function kit(world, group, palette, mat, tag) {
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key,
    ['stone', 'edge', 'dark', 'roof', 'plaster'].includes(key)
      ? buildingMaterial(color, key === 'dark' ? 'wood' : key === 'roof' ? 'slate' : key === 'plaster' ? 'plaster' : 'stone')
      : mat(color, key === 'glow' ? { emissive: color, ei: 0.28 } : key === 'metal' ? { metalness: 0.35, roughness: 0.8 } : {})]));
  const yaw = group.rotation.y;
  const position = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(UP, yaw).add(group.position);
  function solid(x, y, z, w, h, d) {
    const p = position(x, y, z);
    world.colliders.addBox({ x: p.x, z: p.z, w, d, y0: p.y - h / 2, y1: p.y + h / 2, rot: yaw, tag });
  }
  function shape(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, materials[material] || material);
    mesh.position.set(x, y, z);
    mesh.castShadow = material !== 'glow';
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function box(x, y, z, w, h, d, material = 'stone', collision = false) {
    const mesh = shape(sizeBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d), material, x, y, z);
    if (collision) solid(x, y, z, w, h, d);
    return mesh;
  }
  function beam(a, b, width = 0.25, material = 'dark', collision = false) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const p = start.clone().add(end).multiplyScalar(0.5);
    const mesh = shape(new THREE.CylinderGeometry(width, width, delta.length(), 6), material, p.x, p.y, p.z);
    mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
    if (collision) solid(p.x, p.y, p.z, Math.abs(b[0] - a[0]) + width * 2, Math.abs(b[1] - a[1]) + width * 2, Math.abs(b[2] - a[2]) + width * 2);
    return mesh;
  }
  function post(x, z, h, width = 1.6, base = 0) {
    const p = position(x, 0, z);
    const bottom = Math.min(base - 1.5, world.terrain.heightAt(p.x, p.z) - group.position.y - 1);
    box(x, (h + base + bottom) / 2, z, width, h + base - bottom, width, 'stone', true);
    box(x, base + 0.3, z, width + 0.55, 0.6, width + 0.55, 'edge');
    box(x, base + h - 0.35, z, width + 0.6, 0.7, width + 0.6, 'edge');
    box(x, base + h * 0.6, z, width + 0.14, 0.25, width + 0.14, 'edge');
    if (width >= 3) {
      for (const side of [-1, 1]) {
        for (const dx of [-width * 0.4, width * 0.4]) box(x + dx, base + h / 2, z + side * width / 2, 0.28, h, 0.3, 'edge');
        for (let yy = 2; yy < h - 1; yy += 2) {
          box(x, base + yy, z + side * (width / 2 + 0.015), width, 0.045, 0.05, 'dark');
          box(x + side * (width / 2 + 0.015), base + yy, z, 0.05, 0.045, width, 'dark');
        }
      }
    }
  }
  // Pointed arch built from two curved shoulders, with a genuine open passage.
  function arch(x, z, width, spring, rise, material = 'edge', base = 0) {
    post(x - width / 2, z, spring, 1.25, base);
    post(x + width / 2, z, spring, 1.25, base);
    // Shoulders stop just shy of the apex so the cylinder tips do not wad into the
    // opening; the keystone bridges that last gap. Tip too low left a sky hole under
    // the lintel; tip at 1.0 made the dark blob.
    const tip = 0.9;
    const point = (side, t) => [x + side * width / 2 * (1 - t * t), base + spring + rise * t, z];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) beam(point(side, (i / 7) * tip), point(side, ((i + 1) / 7) * tip), 0.42, material, true);
    }
    const crown = base + spring + rise;
    const tipY = base + spring + rise * tip;
    // Keystone from the shoulder tips up into the crown, seated under the walk.
    const kh = Math.max(0.7, crown - tipY + 0.5);
    box(x, tipY + kh / 2, z, Math.min(1.4, width * 0.12), kh, 1.05, material);
    // the crown is closed between the shoulder tips, a little below them
    const gapW = width * (1 - tip * tip) + 0.5;
    solid(x, tipY + (kh - 0.6) / 2, z, Math.max(Math.min(1.4, width * 0.12), gapW), kh + 0.6, 1.05);
    // Spandrel bed: fills the haunches so the lintel does not float over open sky.
    box(x, crown + 0.35, z, width * 0.72, 0.7, 1.0, material, true);
    for (const side of [-1, 1]) {
      box(x + side * width * 0.28, crown + 0.05, z, width * 0.22, 0.85, 1.0, material);
      // collided from the shoulder up, so the haunch rests on the arch ring
      solid(x + side * width * 0.28, (tipY - 0.5 + crown + 0.475) / 2, z, width * 0.22, crown + 0.975 - tipY, 1.0);
    }
  }
  function lantern(x, y, z, hanging = 0) {
    if (hanging) beam([x, y + 0.5, z], [x, y + hanging, z], 0.045, 'metal');
    box(x, y, z, 0.48, 0.8, 0.48, 'glow');
    for (const hy of [-0.46, 0.46]) box(x, y + hy, z, 0.7, 0.13, 0.7, 'dark');
    for (const dx of [-0.27, 0.27]) for (const dz of [-0.27, 0.27]) box(x + dx, y, z + dz, 0.055, 0.85, 0.055, 'metal');
    world.addLight(position(x, y, z), palette.glow, 0.8, 11, false, 0.6);
  }
  function banner(x, y, z, h = 4) {
    box(x, y, z, 1.65, h, 0.09, 'cloth');
    box(x, y + h / 2, z, 2, 0.16, 0.2, 'metal');
    box(x, y, z + 0.065, 0.12, h * 0.62, 0.05, 'edge');
    box(x, y - h * 0.12, z + 0.07, 0.72, 0.12, 0.05, 'edge');
  }
  function roof(x, y, z, w, d, rise, material = 'roof') {
    // A hipped silhouette with flared eaves and a short ridge. Each ring has
    // its own pitch, so the lower roof sweeps outward instead of a tall prism.
    const rings = [[w, d, 0.16], [w * 0.79, d * 0.85, rise * 0.19],
      [w * 0.36, d * 0.66, rise * 0.78], [0.12, d * 0.52, rise]];
    const vertices = [], uvs = [], indices = [];
    for (let r = 0; r < rings.length - 1; r++) {
      const corners = ([rw, rd, yy]) => [[-rw / 2, yy, -rd / 2], [rw / 2, yy, -rd / 2], [rw / 2, yy, rd / 2], [-rw / 2, yy, rd / 2]];
      const lo = corners(rings[r]), hi = corners(rings[r + 1]);
      for (let side = 0; side < 4; side++) {
        const j = (side + 1) % 4, first = vertices.length / 3;
        for (const v of [lo[side], hi[side], hi[j], lo[j]]) {
          vertices.push(...v);
          uvs.push((side % 2 ? v[2] : v[0]) / 4, Math.hypot(v[1], side % 2 ? v[0] : v[2]) / 4);
        }
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    const m = shape(geo, material, x, y, z);
    box(x, y, z, w, 0.24, d, 'dark', true);
    box(x, y + rise, z, 0.36, 0.28, d * 0.56, 'dark');
    for (let r = 0; r < rings.length - 1; r++) {
      const [rw, rd, yy] = rings[r];
      // Dark horizontal tile lips emphasize the wide, tiered roof silhouette.
      for (const side of [-1, 1]) {
        box(x + side * rw / 2, y + yy, z, 0.12, 0.12, rd, 'roof');
        box(x, y + yy, z + side * rd / 2, rw, 0.12, 0.12, 'roof');
      }
      // the slope's steps, each from the eave plate up to its own height, so they rest on it
      const next = rings[r + 1];
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 4, top = yy + (next[2] - yy) * t + 0.08;
        solid(x, y + (top - 0.12) / 2, z, rw + (next[0] - rw) * t, top + 0.12, rd + (next[1] - rd) * t);
      }
    }
    return m;
  }
  function ring(x, y, z, r, tube = 0.15, material = 'metal', flat = false) {
    const m = shape(new THREE.TorusGeometry(r, tube, 5, 24), material, x, y, z);
    if (flat) m.rotation.x = Math.PI / 2;
    return m;
  }
  return { box, beam, post, arch, lantern, banner, roof, ring, shape, solid, position, materials };
}

// Stone ground floors, projecting plaster stories, shutters and broad slate roofs.
export function detailBuilding(world, g, s, opt, mat) {
  // Regional building materials (world/etris.js STYLES) over the enterable shell.
  const st = styleFor(s);
  // The Reed Covenant builds its own way: piles, woven reed and steep thatch.
  if (st === STYLES.reed) return fenBuilding(world, g, s, opt, mat, { kit, furnishInterior });
  const p = { stone: st.stone2, edge: st.stone, dark: st.timber, metal: '#71664d', roof: st.roof, cloth: st.cloth, glow: st.glass, plaster: st.plaster };
  const k = kit(world, g, p, mat, 'building_detail');
  const tk = tide(world, g, st, mat, 'building_detail');
  const w = s.w || 9, d = s.d || 8, h = opt.h;
  // Level the floor with the uphill side; a stone plinth and steps meet the slope.
  const [lo, hi] = tk.groundRange(0, 0, w + 1.4, d + 1.4);
  const lift = Math.max(0, hi) + 0.25;
  g.position.y += lift;
  tk.box(0, (lo - lift - 1.5) / 2, 0, w + 1.1, lift - lo + 1.5, d + 1.1, 'stone', true);
  tk.box(0, -0.06, 0, w + 1.4, 0.24, d + 1.4, 'stone2');
  const doorGround = tk.ground(0, d / 2 + 1.6);
  if (doorGround < -0.55) {
    const n = Math.min(12, Math.ceil(-doorGround / 0.38));
    for (let i = 0; i < n; i++) {
      const top = -((i + 1) * -doorGround) / n + 0.05;
      tk.box(0, (top + doorGround - 0.6) / 2, d / 2 + 0.95 + i * 0.5, 2.8, top - doorGround + 0.6, 0.5, 'stone', true);
    }
  }
  addAnnex(world, tk, s, w, d, h, st);
  const base = 3.5, upperW = w + 0.7, upperD = d + 0.7;
  // Actual hollow shell: the entrance has a 2.4m opening and the rooms are
  // enclosed only by perimeter walls, never a solid building-sized collider.
  const door = 2.4, thickness = 0.38;
  k.box(0, -0.13, 0, w, 0.5, d, buildingMaterial('#78634d', 'wood'), true);
  for (const side of [-1, 1]) {
    k.box(side * (w / 2 - thickness / 2), base / 2, 0, thickness, base, d, 'stone', true);
    k.box(side * (upperW / 2 - thickness / 2), (base + h) / 2, 0, thickness, h - base, upperD, 'plaster', true);
    k.box(side * (w + door) / 4, 1.6, d / 2 - thickness / 2, (w - door) / 2, 3.2, thickness, 'stone', true);
  }
  k.box(0, base / 2, -d / 2 + thickness / 2, w, base, thickness, 'stone', true);
  k.box(0, 3.35, d / 2 - thickness / 2, w, 0.3, thickness, 'stone', true);
  for (const side of [-1, 1]) k.box(0, (base + h) / 2, side * (upperD / 2 - thickness / 2), upperW, h - base, thickness, 'plaster', true);
  for (const yy of [base, h]) {
    for (const side of [-1, 1]) {
      k.box(0, yy, side * upperD / 2, upperW + 0.22, 0.24, 0.28, 'dark');
      k.box(side * upperW / 2, yy, 0, 0.28, 0.24, upperD, 'dark');
    }
  }
  const floors = h > 10 ? 3 : 2;
  for (let level = 1; level < floors; level++) {
    const yy = base + (h - base) * level / (floors - 1);
    for (const side of [-1, 1]) k.box(0, yy, side * upperD / 2, upperW + 0.16, 0.2, 0.22, 'dark');
  }
  for (const face of [-1, 1]) {
    const z = face * (upperD / 2 + 0.03);
    for (const x of [-upperW / 2 + 0.16, upperW / 2 - 0.16]) k.box(x, (base + h) / 2, z, 0.34, h - base, 0.24, 'dark');
    for (let level = 0; level < floors; level++) {
      const yy = level === 0 ? 1.9 : base + 1.65 + (level - 1) * 3.1;
      for (const x of [-w * 0.29, w * 0.29]) {
        k.box(x, yy, z, 1.5, 1.95, 0.22, 'dark');
        k.box(x, yy, z + face * 0.13, 1.08, 1.52, 0.04, level === 0 ? 'dark' : 'glow');
        k.box(x, yy, z + face * 0.18, 0.13, 1.65, 0.1, 'dark');
        for (const dy of [-0.3, 0.3]) k.box(x, yy + dy, z + face * 0.18, 1.2, 0.1, 0.1, 'dark');
        k.box(x, yy - 1.03, z, 1.85, 0.2, 0.6, 'edge');
        for (const side of [-1, 1]) {
          k.box(x + side * 1.02, yy, z, 0.48, 1.85, 0.17, 'roof');
          for (const dy of [-0.55, 0.55]) k.box(x + side * 1.02, yy + dy, z + face * 0.12, 0.52, 0.12, 0.1, 'dark');
        }
      }
    }
    // Brackets under the projecting upper floor.
    for (let x = -w / 2 + 0.7; x < w / 2; x += 1.8) {
      k.beam([x, base - 0.7, face * d / 2], [x, base, face * (d / 2 + 0.6)], 0.13, 'dark');
    }
  }
  for (const side of [-1, 1]) {
    for (const z of [-d * 0.3, 0, d * 0.3]) {
      k.box(side * (upperW / 2 + 0.02), (base + h) / 2, z, 0.18, h - base, 0.25, 'dark');
    }
    for (const yy of [base + 1.8, ...(floors === 3 ? [base + 4.9] : [])]) {
      k.box(side * (upperW / 2 + 0.08), yy, 0, 0.18, 1.7, 1.45, 'dark');
      k.box(side * (upperW / 2 + 0.19), yy, 0, 0.05, 1.35, 1.1, 'glow');
      k.box(side * (upperW / 2 + 0.23), yy, 0, 0.07, 1.5, 0.12, 'dark');
    }
  }
  // A swung-open timber door sits beside the clear opening.
  k.box(1.36, 1.5, d / 2 + 0.95, 0.14, 3, 1.85, 'dark');
  for (const x of [-1.4, 1.4]) k.box(x, 1.5, d / 2 + 0.12, 0.32, 3, 0.38, 'edge');
  k.box(0, 3.15, d / 2 + 0.15, 3.1, 0.25, 0.45, 'edge');
  k.box(1.45, 1.3, d / 2 + 1.6, 0.1, 0.25, 0.12, 'metal');
  const frost = st === STYLES.frost;
  const military = st === STYLES.enclave;
  const mainRise = Math.min(w, d) * (military ? 0.32 : s.type === 'inn' ? 0.5 : 0.58);
  tk.roof(0, h + 0.1, 0, w + 0.9, d + 0.9, mainRise, { eave: military ? 0.65 : 1.3, curl: military ? 0.12 : 1.0, snow: frost });
  tk.roof(0, 3.3, d / 2 + 0.95, w * 0.55, 1.4, 0.65, { eave: 0.6, curl: 0.55, key: 'roof2' });
  if (s.type === 'inn' || (s.type === 'barracks' && st === STYLES.enclave)) {
    // a lantern loft rising through the ridge
    const ty = h + 0.1 + mainRise * 0.55;
    tk.storey(0, ty, 0, w * 0.38, d * 0.38, 2.8, { blank: 0.3 });
    tk.roof(0, ty + 2.8, 0, w * 0.38, d * 0.38, Math.min(w, d) * 0.28, { eave: 0.9, curl: 0.85, snow: frost });
  }
  if (s.type === 'inn' || s.type === 'barracks') {
    k.box(0, 6.5, d / 2 + 0.75, w * 0.7, 0.28, 1.65, 'dark', true);
    k.box(0, 7.65, d / 2 + 1.5, w * 0.7, 0.15, 0.15, 'dark');
    for (let i = -4; i <= 4; i++) k.box(i * w * 0.078, 7.08, d / 2 + 1.5, 0.12, 1.15, 0.12, 'dark');
    k.banner(w * 0.42, h - 2, d / 2 + 0.6, 3);
  }
  k.lantern(-1.65, 2.8, d / 2 + 0.6);
  furnishInterior(world, k, s, w, d, h);
  if (opt.chimney) {
    k.box(w * 0.26, h + 1.5, -d * 0.2, 1.15, 5, 1.15, 'stone');
    k.box(w * 0.26, h + 4, -d * 0.2, 1.55, 0.35, 1.55, 'edge');
  }
}

// Asymmetric additions: a side wing, a corner lookout or a rear lean-to, only where the street
// leaves room (no structure or NPC within the footprint).
function addAnnex(world, tk, s, w, d, h, st) {
  const v = Math.floor(hashXZ(s.x, s.z) * 4);
  if (v === 3 || s.noAnnex) return;
  const side = hashXZ(s.z, s.x) < 0.5 ? -1 : 1;
  const free = (lx, lz, r) => {
    const c = tk.wp(lx, 0, lz);
    for (const o of STRUCTURES) if (o !== s && o.x !== undefined && Math.hypot(o.x - c.x, o.z - c.z) < r + Math.max(o.w || 0, o.d || 0, o.r || 0) * 0.5 + 1.5) return false;
    for (const n of NPCS) if (Math.hypot(n.x - c.x, n.z - c.z) < r + 1.2) return false;
    return true;
  };
  if (v === 0) {
    const ww = Math.max(3.6, w * 0.45);
    const wd = d * 0.7;
    const wx = side * (w / 2 + 0.35 + ww / 2);
    if (!free(wx, -d * 0.1, Math.max(ww, wd) * 0.6)) return;
    const [wlo] = tk.groundRange(wx, -d * 0.1, ww, wd);
    const wf = -1.1;
    tk.box(wx, (wf + wlo - 1.5) / 2, -d * 0.1, ww + 0.8, wf - wlo + 1.5, wd + 0.8, 'stone', true);
    tk.storey(wx, wf, -d * 0.1, ww, wd, h * 0.62, {});
    tk.roof(wx, wf + h * 0.62, -d * 0.1, ww, wd, Math.min(ww, wd) * 0.55, { eave: 1, curl: 0.8, snow: st === STYLES.frost });
  } else if (v === 1) {
    // corner lookout: a slim two-stage tower at a back corner
    const tx = side * (w / 2 + 2.1);
    const tz = -d / 2 + 1.2;
    if (!free(tx, tz, 3)) return;
    const [tlo] = tk.groundRange(tx, tz, 3.4, 3.4);
    tk.box(tx, (tlo - 1.5) / 2, tz, 3.8, -tlo + 1.5, 3.8, 'stone', true);
    tk.storey(tx, 0, tz, 3.4, 3.4, h + 1.8, { blank: 0.5 });
    tk.roof(tx, h + 1.8, tz, 3.4, 3.4, 2.4, { eave: 0.9, curl: 1.0, snow: st === STYLES.frost });
    tk.storey(tx, h + 2.6, tz, 2, 2, 1.8, { blank: 0.2 });
    tk.roof(tx, h + 4.4, tz, 2, 2, 1.6, { eave: 0.7, curl: 0.9 });
  } else {
    if (!free(0, -d / 2 - 1.6, 3)) return;
    tk.box(0, 1.2, -d / 2 - 1.5, w * 0.6, 2.4, 2.6, 'plaster2', true);
    tk.roof(0, 2.4, -d / 2 - 1.5, w * 0.6, 2.6, 0.9, { eave: 0.7, curl: 0.35, key: 'roof2' });
  }
}
const hashXZ = (x, z) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function furnishInterior(world, k, s, w, d, h, o = {}) {
  const { box, lantern, beam, position } = k;
  const inn = s.type === 'inn', barracks = s.type === 'barracks', smithy = s.type === 'smithy';
  const loft = inn || barracks;
  const floor = loft ? 4.3 : Math.min(4, h - 2.4);
  const floorWood = buildingMaterial('#78634d', 'wood');
  const table = (x, z, width = 2, depth = 1.1) => {
    box(x, 1, z, width, 0.2, depth, 'dark', true);
    for (const dx of [-width * 0.4, width * 0.4]) for (const dz of [-depth * 0.35, depth * 0.35]) box(x + dx, 0.5, z + dz, 0.13, 1, 0.13, 'dark');
    box(x, 1.15, z, 0.38, 0.08, 0.35, 'edge');
  };
  const bed = (x, z, y) => {
    box(x, y + 0.35, z, 1.6, 0.45, 2.6, 'dark', true);
    box(x, y + 0.63, z, 1.45, 0.14, 2.4, 'cloth');
    box(x, y + 0.76, z - 0.8, 1.1, 0.18, 0.52, 'edge');
    box(x, y + 0.8, z - 1.25, 1.7, 1.1, 0.15, 'dark');
  };
  if (loft) {
    // Stairs rise along the left wall; their opening continues through the loft.
    const stairX = -w / 2 + 1.45, startZ = d / 2 - 0.9, run = d - 2;
    box(1.25, floor, 0, w - 2.9, 0.22, d - 0.5, floorWood, true);
    const steps = Math.ceil(floor / 0.24);
    for (let i = 0; i < steps; i++) {
      const top = 0.12 + (floor - 0.01) * (i + 1) / steps;
      box(stairX, top / 2, startZ - run * (i + 0.5) / steps, 1.95, top, run / steps + 0.03, floorWood, true);
    }
    box(stairX, floor, -d / 2 + 0.72, 2.4, 0.22, 1.15, 'dark', true);
    for (const z of [-d / 2 + 2, 0, d / 2 - 1]) box(-w / 2 + 2.55, floor + 0.7, z, 0.12, 1.3, 0.12, 'dark', true);
    box(-w / 2 + 2.55, floor + 1.3, 0.7, 0.13, 0.13, d - 2.5, 'dark');
    for (const x of [-w * 0.17, w * 0.25]) bed(x, -d * 0.19, floor + 0.12);
    // A partition separates the sleeping bays while leaving a front landing.
    box(w * 0.035, floor + 1.35, -d * 0.22, 0.18, 2.6, d * 0.48, 'plaster', true);
    // the loft lamp hangs where the roof leaves headroom (a steep fen thatch leaves less)
    const [lx, lz] = o.loftLamp || [w * 0.3, d * 0.28];
    lantern(lx, floor + 2.6, lz);
    world.addLight(position(lx, floor + 2.5, lz), '#efcc91', 7, 13, false, 1.3);
  } else {
    box(0, floor, 0, w - 0.4, 0.2, d - 0.4, 'dark', true);
  }
  if (inn) {
    box(0, 0.65, -d / 2 + 2, w * 0.56, 1.3, 0.75, 'dark', true);
    box(0, 1.36, -d / 2 + 2, w * 0.6, 0.15, 1, 'edge');
    for (let i = -2; i <= 2; i++) box(i * 0.65, 1.58, -d / 2 + 2, 0.18, 0.28, 0.18, 'metal');
    table(w * 0.24, d * 0.12, 2.6, 1.4);
    for (const z of [-0.9, 0.9]) box(w * 0.24, 0.5, d * 0.12 + z, 2.4, 0.25, 0.45, 'dark', true);
    // An inset hearth, mantle and chimney are readable from the common room.
    box(w / 2 - 0.65, 0.7, -d * 0.22, 0.8, 1.4, 1.8, 'stone', true);
    box(w / 2 - 1.08, 0.55, -d * 0.22, 0.08, 0.5, 1, 'glow');
    box(w / 2 - 0.7, 1.5, -d * 0.22, 1.2, 0.25, 2.1, 'edge');
    // Where a guest of the inn wakes: the inn's keeper sets it (Game.rest); [E] does nothing here.
    const id = s.restId || `inn_${s.x}_${s.z}`;
    const at = position(0, 0.2, 1);
    (world.restPoints ||= {})[id] = at;
    world.addInteract({ id, kind: 'rest_point', pos: at, radius: 0, name: s.name || 'The Salted Anchor', enabled: () => false });
  } else if (barracks) {
    table(0, -d * 0.23, 4, 2.1);
    box(0, 1.13, -d * 0.23, 3.3, 0.025, 1.5, 'cloth');
    for (const x of [-1, 0, 1]) box(x, 1.25, -d * 0.23, 0.16, 0.23, 0.16, 'metal');
    for (let i = 0; i < 5; i++) beam([w / 2 - 0.7, 0.2, -2 + i * 0.8], [w / 2 - 0.7, 2.8, -2 + i * 0.8], 0.065, 'metal');
    box(w / 2 - 0.7, 1.1, 0, 0.35, 0.22, 4.5, 'dark');
  } else if (smithy) {
    table(-w * 0.25, -d * 0.2, 2.8, 1.2);
    box(w * 0.27, 0.55, -d * 0.23, 1.8, 1.1, 1.5, 'stone', true);
    box(w * 0.27, 1.16, -d * 0.23, 1.3, 0.15, 1, 'glow');
    for (let i = 0; i < 4; i++) box(-w * 0.25 + i * 0.5, 1.2, -d * 0.2, 0.3, 0.12, 0.5, 'metal');
  } else {
    bed(-w * 0.24, -d * 0.24, 0.12);
    table(w * 0.23, -d * 0.18, 1.7, 1);
  }
  lantern(0, 2.7, 0, 0.6);
  world.addLight(position(0, 2.6, 0), '#efc080', inn ? 10 : 7, 15, false, 1.5);
  world.interiors ||= [];
  world.interiors.push({ type: s.type, name: s.name || s.type, x: s.x, z: s.z, w, d, rot: s.rot || 0,
    floor: position(0, 0.12, 0).y, entrance: position(0, 0.12, d / 2 + 1), center: position(0, 0.12, 1),
    loft: loft ? position(0, floor + 0.12, 0).y : null });
}

export function buildCivicTower(world, s, mat, lighthouse = false) {
  const g = new THREE.Group();
  g.name = lighthouse ? 'Old Lighthouse' : 'Sage’s Tower';
  g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
  const k = kit(world, g, ARCHITECTURE_PALETTES.harbor, mat, lighthouse ? 'lighthouse' : 'sage_tower');
  if (!lighthouse) {
    k.box(0, 4, 0, 9.4, 12, 9.4, 'stone', true);
    for (const [base, width] of [[10, 8.6], [18.5, 7.4], [26, 5.8]]) {
      k.box(0, base + 2.5, 0, width, 5, width, 'dark', true);
      for (const side of [-1, 1]) {
        k.box(0, base + 2.5, side * (width / 2 + 0.04), width - 0.8, 4.2, 0.12, 'stone');
        k.box(side * (width / 2 + 0.04), base + 2.5, 0, 0.12, 4.2, width - 0.8, 'stone');
        for (const offset of [-width * 0.23, width * 0.23]) {
          k.box(offset, base + 2.6, side * (width / 2 + 0.13), 0.85, 2.2, 0.1, 'dark');
          k.box(offset, base + 2.6, side * (width / 2 + 0.2), 0.5, 1.8, 0.04, 'glow');
          k.box(side * (width / 2 + 0.13), base + 2.6, offset, 0.1, 2.2, 0.85, 'dark');
          k.box(side * (width / 2 + 0.2), base + 2.6, offset, 0.04, 1.8, 0.5, 'glow');
        }
      }
      k.roof(0, base + 5.1, 0, width + 2.6, width + 2.6, 2.7);
    }
    for (const side of [-1, 1]) k.banner(side * 2.8, 7, -4.8, 4);
    return g;
  }
  const radius = lighthouse ? 3.2 : s.r, h = lighthouse ? 32 : 34;
  k.shape(new THREE.CylinderGeometry(radius * 0.78, radius, h + 2, 12), 'stone', 0, h / 2 - 1, 0);
  world.colliders.addCyl({ x: s.x, z: s.z, r: radius, y0: g.position.y - 2, y1: g.position.y + h, climbable: true });
  for (const yy of [1, h * 0.3, h * 0.6, h - 1]) {
    const r = radius * (1 - yy / h * 0.22) + 0.15;
    k.shape(new THREE.CylinderGeometry(r, r, 0.55, 12), 'edge', 0, yy, 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, x = Math.sin(a), z = Math.cos(a);
    k.post(x * radius * 0.88, z * radius * 0.88, lighthouse ? 8 : 14, 0.75);
    for (const yy of [7, 15, 23]) {
      const r = radius * (1 - yy / h * 0.22);
      const frame = k.box(x * r, yy, z * r, 0.85, 2.6, 0.2, 'dark'); frame.rotation.y = a;
      const glass = k.box(x * (r + 0.13), yy, z * (r + 0.13), 0.5, 2.1, 0.05, 'glow'); glass.rotation.y = a;
    }
  }
  k.shape(new THREE.CylinderGeometry(radius + 0.8, radius + 0.5, 0.5, 12), 'edge', 0, h, 0);
  world.colliders.addCyl({ x: s.x, z: s.z, r: radius + 0.8, y0: g.position.y + h - 0.25, y1: g.position.y + h + 0.25, climbable: true });
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x = Math.sin(a), z = Math.cos(a);
    k.box(x * (radius + 0.6), h + 0.8, z * (radius + 0.6), 0.13, 1.4, 0.13, 'metal');
    if (i % 2 === 0) k.box(x * radius * 0.7, h + 2, z * radius * 0.7, 0.23, 3.7, 0.23, 'dark');
  }
  k.ring(0, h + 1.4, 0, radius + 0.6, 0.09, 'metal', true);
  if (lighthouse) {
    k.shape(new THREE.CylinderGeometry(1.35, 1.35, 2.8, 12), 'glow', 0, h + 1.9, 0);
    for (const yy of [h + 0.9, h + 1.9, h + 2.9]) k.ring(0, yy, 0, 1.45, 0.07, 'metal', true);
    world.addLight(k.position(0, h + 2, 0), '#ffe0a0', 4, 65);
  } else {
    k.ring(0, h + 2, 0, 2.3, 0.13, 'metal');
    const crossed = k.ring(0, h + 2, 0, 1.9, 0.1, 'metal'); crossed.rotation.y = Math.PI / 2;
    k.shape(new THREE.OctahedronGeometry(0.6), 'glow', 0, h + 2, 0);
  }
  k.shape(new THREE.ConeGeometry(radius + 0.3, lighthouse ? 4 : 8, 12), 'roof', 0, h + (lighthouse ? 5.6 : 7.6), 0);
  k.beam([0, h + 8, 0], [0, h + 13, 0], 0.12, 'metal');
  return g;
}

export function detailHut(world, g, s, mat) {
  const marsh = s.x < 0;
  const k = kit(world, g, ARCHITECTURE_PALETTES[marsh ? 'reed' : 'root'], mat, 'hut_detail');
  // Raised timber frame and thin wall panels — never a solid fallback box.
  const wallY = 3.15, wallH = 2.55, t = 0.14;
  k.box(0, wallY, -2.18, 4.15, wallH, t, 'plaster', true);
  for (const side of [-1, 1]) {
    k.box(side * 2.18, wallY, -0.15, t, wallH, 4.05, 'plaster', true);
    for (let i = 0; i < 8; i++) k.box(-1.95 + i * 0.55, 3.1, side * 2.24, 0.08, 2.3, 0.08, 'dark');
    k.beam([side * 2, -0.8, -2], [side * 2, 1.8, 2], 0.12, 'dark');
    k.box(side * 1.55, 3.4, 2.29, 0.7, 0.9, 0.08, 'glow');
    k.box(side * 2.6, 1.95, 0, 0.18, 0.2, 5.7, 'edge');
  }
  k.box(-1.55, wallY, 2.18, 1.15, wallH, t, 'plaster', true);
  k.box(1.55, wallY, 2.18, 1.15, wallH, t, 'plaster', true);
  k.box(0, 4.22, 2.18, 4.15, 0.4, t, 'plaster', true);
  k.box(0, 3.05, 2.27, 1.1, 2.2, 0.08, 'dark');
  if (marsh) fenHutRoof(k, mat, 0, 4.42, 0, 2.2, 4.4);
  else k.roof(0, 6.2, 0, 6.8, 6.8, 3.1);
  k.box(0, 4.5, 2.5, 3.2, 0.18, 1, 'roof');
  k.lantern(-2, 3.8, 2.55);
  for (let i = 0; i < 5; i++) {
    const h = (i + 1) * 0.39;
    k.box(0, h / 2, 4.75 - i * 0.48, 1.6, h, 0.55, 'dark', true);
  }
  if (marsh) {
    k.beam([-2, 5, 2.8], [2, 5, 2.8], 0.07, 'dark');
    for (let i = 0; i < 6; i++) k.beam([-1.8 + i * 0.7, 5, 2.8], [-1.8 + i * 0.7, 4.5, 2.8], 0.025, 'metal');
  } else {
    for (const x of [-1, 1]) {
      const mask = k.shape(new THREE.IcosahedronGeometry(0.35), 'edge', x, 5.1, 2.4);
      mask.scale.set(0.7, 1.4, 0.3);
      for (const dx of [-0.09, 0.09]) k.box(x + dx, 5.15, 2.52, 0.07, 0.07, 0.04, 'dark');
    }
  }
}

function buildRoads(world, exclusions, add, mat) {
  const g = new THREE.Group();
  g.name = 'Saltreach — worn lanes and scattered flagstones';
  const rng = seededRandom(3187);
  const stones = ['#898779', '#929081', '#807f70'].map(c => buildingMaterial(c, 'plaster'));
  const earth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const occupied = new Set();
  const roads = [...CIVIC_ROADS, ...SETTLEMENT_ROADS, ...ROADS];
  world.pathSamples = roads.map(r => samplePath(r));
  for (const [roadIndex, samples] of world.pathSamples.entries()) {
    const regional = roads[roadIndex].id;
    const snow = roads[roadIndex].kind === 'snow';
    const pos = [], colors = [], indices = [];
    const columns = 8;
    let rows = 0, joined = false;
    samples.forEach((p, row) => {
      // Lanes are worn by daily feet, so they belong to settlements. Past a settlement's
      // edge the lane breaks into patches and gives out; the open country is read from the
      // land and the waymarks (world/wayfinding.js), not from a painted line.
      const s = settlementWeight(p.x, p.z);
      const patch = 0.5 + 0.5 * Math.sin(p.distance * 0.31 + roadIndex) * Math.sin(p.distance * 0.083 + 1.7);
      let worn = smoothstep(0.05, 0.55, s) * (s > 0.7 ? 1 : smoothstep(0.25, 0.6, patch + s * 0.6));
      // the ways between towns are trodden all the way: a narrower, broken-edged track
      if (regional) worn = Math.max(worn, 0.62 + 0.2 * patch);
      // Trees stay off the line wherever people walk, which leaves a natural gap to follow.
      exclusions.push({ x: p.x, z: p.z, r: worn > 0 ? p.width / 2 + 0.8 : Math.max(1.2, p.width / 2 - 0.2) });
      if (worn < 0.04) { joined = false; return; }
      const edge = (0.3 * Math.sin(p.distance * 1.1) + 0.18 * Math.sin(p.distance * 2.7)) * worn;
      // Rounded ends fade into the destination instead of a square pavement cap.
      const tip = Math.min(1, Math.sqrt(Math.min(row + 0.1, samples.length - row - 0.9) / 2));
      const half = p.width / 2 * tip * worn;
      for (let col = 0; col <= columns; col++) {
        const u = (col / columns * 2 - 1) * (half + edge);
        const x = p.x + p.nx * u, z = p.z + p.nz * u;
        pos.push(x, world.terrain.heightAt(x, z) + 0.035, z);
        const verge = Math.pow(Math.abs(col / columns * 2 - 1), 5);
        // town lanes are cobbled streets; the open ways are earth (snow, ash or old paving)
        const kind = roads[roadIndex].kind;
        const street = !regional && s > 0.6;
        const tread = snow ? '#a5acac' : kind === 'ash' ? '#4a423e' : kind === 'stone' ? '#8a877d' : street ? '#8c8a82' : '#89816a';
        const color = new THREE.Color(tread).lerp(new THREE.Color(snow ? '#d5dfe3' : street ? '#7b7a72' : '#73805e'), verge * 0.9);
        if (street && (col + rows) % 2) color.multiplyScalar(0.93);
        color.multiplyScalar(0.96 + rng() * 0.08);
        colors.push(color.r, color.g, color.b);
        if (joined && col) {
          const c = rows * (columns + 1) + col, a = c - columns - 2;
          indices.push(a, a + 1, c, a, c, c - 1);
        }
      }
      rows++;
      joined = true;
      // Flagstones on broader lanes only, and only in town. Narrow footpaths keep the
      // packed-earth strip so they do not read as floating pancake stones.
      if (p.width >= 2.6 && s > 0.6) for (let col = 0; col < Math.ceil(p.width / 1.15); col++) {
        if (rng() < (regional ? 0.86 : 0.18)) continue;
        const offset = (rng() * 2 - 1) * half * 0.96;
        const x = p.x + p.nx * offset + (rng() - 0.5) * 0.7;
        const z = p.z + p.nz * offset + (rng() - 0.5) * 0.7;
        const key = `${Math.round(x * 1.1)},${Math.round(z * 1.1)}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        const vertices = [x, world.terrain.heightAt(x, z) + 0.04, z], faces = [];
        const radius = 0.28 + rng() * 0.22, angle = rng() * Math.PI;
        for (let j = 0; j < 6; j++) {
          const a = angle - j / 6 * Math.PI * 2, r = radius * (0.8 + rng() * 0.35);
          const xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r * 0.78;
          vertices.push(xx, world.terrain.heightAt(xx, zz) + 0.04, zz);
          faces.push(0, j + 1, (j + 1) % 6 + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(vertices.flatMap((_, i) => i % 3 === 0 ? [vertices[i] / 4, vertices[i + 2] / 4] : []), 2));
        geo.setIndex(faces); geo.computeVertexNormals();
        const stone = new THREE.Mesh(geo, stones[Math.floor(rng() * stones.length)]);
        stone.receiveShadow = true; g.add(stone);
      }
    });
    if (!indices.length) continue; // a way wholly out in the open draws no lane at all
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    const lane = new THREE.Mesh(geo, earth); lane.receiveShadow = true;
    // Keep vertex colors through static batching, which otherwise strips them.
    lane.userData.dynamic = true;
    g.add(lane);
  }
  add(g);
}

function buildFortifications(world, exclusions, add, mat) {
  world.fortifications = [];
  world.innerWards = [];
  world.gates = [];
  for (const ward of INNER_WARDS) add(buildInnerWard(world, ward, exclusions));
  for (const ring of [SALTREACH_RING, MERIDIAN_RING, MERIDIAN_LOWER_RING]) for (const g of buildRampart(world, ring, exclusions)) add(g);
  for (const gate of [...SALTREACH_GATES, ...MERIDIAN_GATES]) {
    const g = new THREE.Group();
    g.name = gate.name;
    g.position.set(gate.x, world.terrain.heightAt(gate.x, gate.z), gate.z);
    g.rotation.y = gate.rot;
    const enclave = MERIDIAN_GATES.includes(gate);
    const built = buildGatehouse(world, { td: 9.2, tw: 8, ...gate, palette: enclave ? 'enclave' : 'salt', tag: 'town_gate', walk: WALL_RISE,
      lookout: enclave ? false : undefined, beacon: enclave }, g);
    world.gates.push({ ...gate, ...built });
    exclusions.push({ x: gate.x, z: gate.z, r: 16 });
    add(g);
  }
  for (const a of [...APPROACHES, ...MERIDIAN_APPROACHES]) buildApproach(world, a, exclusions, add);
}

export function buildArchitecture(world, exclusions, add, mat) {
  buildRoads(world, exclusions, add, mat);
  buildFortifications(world, exclusions, add, mat);
  world.architecture = [];
  for (const s of ARCHITECTURE) {
    const g = new THREE.Group();
    g.name = s.name;
    g.rotation.y = s.rot || 0;
    g.position.set(s.x, world.terrain.heightAt(s.x, s.z), s.z);
    const k = kit(world, g, ARCHITECTURE_PALETTES[s.palette], mat, s.id);
    const { box, beam, post, arch, lantern, banner, roof, ring } = k;
    let clearance = 18;
    if (s.kind === 'pass') {
      buildPassWatch(world, s, exclusions, add);
      clearance = 14;
    } else if (s.kind === 'yard') {
      const groundAt = (lx, lz) => {
        const p = k.position(lx, 0, lz);
        return world.terrain.heightAt(p.x, p.z) - g.position.y;
      };
      const ground = new THREE.Mesh(new THREE.CircleGeometry(8.5, 18).rotateX(-Math.PI / 2), mat('#8a8167'));
      ground.position.y = 0.035; ground.receiveShadow = true; g.add(ground);
      for (const x of [-7, 7]) {
        post(x, -6, 6, 0.35);
        banner(x, 4, -5.7, 3);
      }
      // muster table in front of the barracks: four legs to the ground under it (it was a
      // 20 cm slab centred at y=1.1 with no legs, hanging a metre over the yard)
      const tx = 5, tz = 4, tw = 3.5, td = 1.9, topH = 0.18, legH = 0.7;
      const fy = Math.max(0, groundAt(tx, tz));
      box(tx, fy + legH + topH / 2, tz, tw, topH, td, 'dark');
      for (const dx of [-tw / 2 + 0.18, tw / 2 - 0.18]) for (const dz of [-td / 2 + 0.18, td / 2 - 0.18]) {
        box(tx + dx, fy + legH / 2, tz + dz, 0.14, legH, 0.14, 'dark');
      }
      k.solid(tx, fy + (legH + topH) / 2, tz, tw, legH + topH, td);
      box(tx, fy + legH + topH + 0.013, tz, 2.8, 0.025, 1.4, 'cloth');
      for (const x of [tx - 1, tx, tx + 1]) box(x, fy + legH + topH + 0.16, tz, 0.14, 0.22, 0.14, 'metal');
      for (const z of [-1.5, 0, 1.5]) beam([-7, 0.1, z], [-7, 3, z], 0.09, 'metal');
      box(-7, 1.1, 0, 0.35, 0.25, 4.3, 'dark');
      k.solid(-7, 0.62, 0, 0.35, 1.24, 4.3);
      clearance = 10;
    } else if (s.kind === 'gate') {
      world.gates.push({ id: s.id, ...buildSeaGate(world, { ...s, walk: WALL_RISE, spring: 5.4 }, g) });
      clearance = 23;
    } else if (s.kind === 'lantern_palace') {
      buildLanternPalace(world, { id: s.id, x: s.x, z: s.z, yaw: s.rot || 0, y: s.shelf, terrace: s.terrace }, exclusions, add);
      clearance = 34;
    } else if (s.kind === 'reed_outlet') {
      buildReedOutlet(world, s, exclusions, add);
      clearance = 24;
    } else if (s.kind === 'brigand_hold') {
      buildBrigandHold(world, s, exclusions, add);
      clearance = 60;
    } else if (s.kind === 'enclave_palace') {
      buildEnclavePalace(world, { id: s.id, x: s.x, z: s.z, yaw: s.rot || 0, y: s.rock }, exclusions, add);
      clearance = 46;
    } else if (s.kind === 'citadel' || s.kind === 'castle') {
      (s.kind === 'castle' ? buildCastle : buildCitadel)(world, s, g);
      clearance = Math.max(s.w, s.d) / 2 + 4;
    } else if (s.kind === 'hall') {
      // An open watch lodge with heavy timber framing and tiered eaves.
      for (const z of [-7, 0, 7]) {
        for (const side of [-1, 1]) post(side * 7, z, 9, 0.9);
        box(0, 8.8, z, 15, 0.7, 0.7, 'dark', true);
        for (const side of [-1, 1]) beam([side * 7, 6.5, z], [side * 4.5, 8.8, z], 0.25, 'dark');
      }
      roof(0, 9.4, 0, 20, 20, 4.6);
      roof(0, 13.7, 0, 8, 12, 2.8);
      for (const side of [-1, 1]) {
        beam([side * 7, 9, -8], [side * 7, 9, 8], 0.45, 'dark', true);
        box(side * 7, 10, 0, 0.55, 2, 16, 'dark', true);
        for (const z of [-7, 7]) banner(side * 7, 7, z - 0.8, 4.5);
        lantern(side * 5, 6, -7, 3);
        // Shelves/benches sit at the edges, leaving the long center aisle clear.
        box(side * 5.7, 0.6, 0, 1.5, 1.2, 8, 'dark', true);
        for (let i = 0; i < 6; i++) box(side * 5.7, 1.4, -3 + i * 1.2, 0.8, 0.45, 0.7, 'edge');
      }
      if (s.palette === 'redwake') {
        // Reused spars and hull ribs identify dispossessed ferry crews.
        for (let i = 0; i < 5; i++) {
          const z = -6 + i * 3;
          beam([-6, 10, z], [0, 14.7, z], 0.23, 'dark');
          beam([6, 10, z], [0, 14.7, z], 0.23, 'dark');
        }
      } else {
        // Shelter bell, not a royal or religious crest.
        k.shape(new THREE.CylinderGeometry(0.4, 1, 1.5, 10, 1, true), 'metal', 0, 12, -7);
        beam([0, 12.8, -7], [0, 15, -7], 0.08, 'metal');
      }
    } else if (s.kind === 'shelter') {
      // Lived-in salvage pavilion: plank floor, bunks, workbench and hanging nets. The deck is
      // laid level with the highest ground under it on a footing down to the lowest, and
      // everything in it stands on the deck (it was laid at the centre's height, so on the
      // Wash's slope the deck sank into the bank on one side and the workbench, legless,
      // hung a metre over the grass on the other).
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
        const p = k.position(-5.2 + i * 2.6, 0, -4.1 + j * 2.05);
        const gy = world.terrain.heightAt(p.x, p.z) - g.position.y;
        lo = Math.min(lo, gy);
        hi = Math.max(hi, gy);
      }
      const fy = Math.max(0, hi);
      if (fy - lo > 0.05) box(0, (fy + lo - 0.4) / 2, 0, 10.2, fy - lo + 0.4, 8.0, 'stone', true);
      box(0, fy + 0.08, 0, 10.4, 0.16, 8.2, 'dark', true);
      for (const x of [-5, 5]) for (const z of [-4, 4]) post(x, z, 5 + fy, 0.45);
      for (const side of [-1, 1]) beam([side * 5, fy + 4.6, -4], [side * 5, fy + 4.6, 4], 0.16, 'dark');
      roof(0, fy + 5, 0, 12, 10, 2.7);
      for (let i = 0; i < 4; i++) {
        box(-3 + i * 2, fy + 0.28, -1.4, 1.25, 0.35, 2.6, 'dark');
        box(-3 + i * 2, fy + 0.48, -1.7, 1.15, 0.12, 1.9, 'cloth');
      }
      // the workbench, on four legs to the deck
      box(-3.6, fy + 0.7, 2.4, 2.6, 0.18, 1.2, 'dark');
      for (const dx of [-1.15, 1.15]) for (const dz of [-0.45, 0.45]) box(-3.6 + dx, fy + 0.16 + 0.225, 2.4 + dz, 0.14, 0.45, 0.14, 'dark');
      k.solid(-3.6, fy + 0.4, 2.4, 2.6, 0.8, 1.2);
      for (let i = 0; i < 3; i++) box(-4.4 + i * 0.7, fy + 0.95, 2.4, 0.45, 0.28, 0.55, 'edge');
      box(3.6, fy + 0.45, 2.2, 1.1, 0.9, 1.1, 'dark', true);
      box(3.5, fy + 1.15, 2.1, 0.95, 0.5, 0.95, 'edge');
      beam([-4.4, fy + 4.4, 3.2], [4.4, fy + 4.4, 3.2], 0.07, 'dark');
      for (let i = 0; i < 7; i++) beam([-3.6 + i * 1.2, fy + 4.4, 3.2], [-3.6 + i * 1.2, fy + 3.5, 3.2], 0.03, 'metal');
      lantern(4, fy + 3.5, 3, 1.5);
      lantern(-4, fy + 3.4, -3, 1.2);
      clearance = 11;
    } else if (s.kind === 'arcade') {
      for (let i = 0; i < 3; i++) arch((i - 1) * 12, 0, 10.75, 9 + (i === 1 ? 2 : 0), 5);
      for (const x of [-12, 12]) box(x, 15, 0, 11, 1.2, 3.5, 'stone', true);
      clearance = 25;
    } else if (s.kind === 'outlet') {
      arch(0, -9, 15, 9, 7);
      for (const side of [-1, 1]) {
        post(side * 10, 4, 13, 2);
        beam([side * 7.5, 9, -9], [side * 10, 13, 4], 0.55, 'edge', true);
        // Gate wheels and green channels reveal an ancient working outlet.
        ring(side * 10, 5, 4.9, 2, 0.25);
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          beam([side * 10, 5, 4.9], [side * 10 + Math.cos(a) * 1.9, 5 + Math.sin(a) * 1.9, 4.9], 0.09, 'metal');
        }
        box(side * 10, 0.12, 0, 0.65, 0.16, 18, 'glow');
        lantern(side * 7.5, 6, -8, 3);
      }
      clearance = 19;
    } else if (s.kind === 'regulator' || s.kind === 'furnace') {
      const hot = s.kind === 'furnace';
      const terrace = (x, z) => Math.max(0, world.terrain.heightAt(s.x + x, s.z + z) - g.position.y);
      // Two service towers behind the arena frame the boss without occupying it.
      for (const side of [-1, 1]) {
        const x = side * 23, z = 15, height = hot ? 32 : 29;
        const base = terrace(x, z);
        post(x, z, height, 5, base);
        for (const yy of [5, 13, 21]) {
          box(x, base + yy, z - 2.6, 2.4, 4, 0.2, 'dark');
          for (const dx of [-0.65, 0, 0.65]) box(x + dx, base + yy, z - 2.75, 0.18, 3.5, 0.12, 'glow');
        }
        if (hot) {
          ring(x, base + height + 0.5, z, 2.7, 0.35, 'metal', true);
          box(x, base + height, z, 3.7, 0.2, 3.7, 'glow');
        } else roof(x, base + height, z, 7, 7, 6);
        arch(side * 17, -14, 8, 8, 5, 'edge', terrace(side * 17, -14));
        beam([x, base + 18, z], [side * 12, terrace(side * 12, 24) + 10, 24], 0.65, 'metal', true);
      }
      const rear = terrace(0, 26);
      arch(0, 26, 24, 16, 12, 'edge', rear);
      for (const side of [-1, 1]) {
        // Surviving service wings connect the tall stacks to the rear gallery.
        const base = terrace(side * 18, 24);
        box(side * 18, (base + 11) / 2, 24, 7, base + 13, 6, 'stone', true);
        box(side * 18, base + 12, 24, 7.7, 0.5, 6.7, 'edge', true);
        roof(side * 18, base + 12.3, 24, 8, 7, hot ? 2 : 4);
        for (const dx of [-2, 0, 2]) {
          box(side * 18 + dx, base + 7.5, 20.94, 1.1, 3, 0.15, 'dark');
          box(side * 18 + dx, base + 7.5, 20.84, 0.42, 2.5, 0.06, 'glow');
        }
      }
      for (const x of [-8, -4, 0, 4, 8]) {
        box(x, rear + 1.1, 26, 2.8, 2.2, 2.2, 'dark', true);
        box(x, rear + 1.4, 24.85, 1.7, 0.4, 0.08, 'glow');
      }
      if (!hot) {
        // The plate specifies twelve attendants; their tool hooks are empty.
        for (let i = 0; i < 12; i++) {
          box(-5.5 + i, rear + 5, 25.3, 0.09, 0.8, 0.2, 'metal');
          box(-5.5 + i, rear + 4.6, 25.1, 0.09, 0.09, 0.5, 'metal');
        }
      }
      clearance = 36;
    } else if (s.kind === 'roots') {
      // A living archive: paired roots shelter replaceable wooden name masks.
      for (const side of [-1, 1]) {
        beam([side * 14, -2, -9], [side * 10, 10, -9], 1.15, 'dark', true);
        beam([side * 10, 10, -9], [side * 5, 18, -9], 0.8, 'dark', true);
        beam([side * 5, 18, -9], [0, 21, -9], 0.55, 'dark', true);
        beam([side * 10, 9, -9], [side * 16, 0, -3], 0.55, 'dark', true);
      }
      for (let i = 0; i < 7; i++) {
        const x = -6 + i * 2, yy = 12 + (3 - Math.abs(i - 3)) * 0.6;
        beam([x, yy + 2, -9], [x, yy, -9], 0.04, 'metal');
        const mask = k.shape(new THREE.IcosahedronGeometry(0.7, 0), 'edge', x, yy, -9);
        mask.scale.set(0.75, 1.3, 0.3);
        for (const dx of [-0.2, 0.2]) box(x + dx, yy + 0.13, -9.24, 0.14, 0.1, 0.06, 'dark');
      }
      for (const side of [-1, 1]) lantern(side * 7, 8, -9, 3);
      clearance = 22;
    } else if (s.kind === 'keep') {
      for (const side of [-1, 1]) {
        box(side * 17, 11, 8, 7, 26, 9, 'stone', true);
        box(side * 17, 24, 8, 8, 1, 10, 'edge', true);
        for (const dx of [-3, 0, 3]) box(side * 17 + dx, 25.5, 3.5, 1.4, 2.2, 1.6, 'stone', true);
        banner(side * 17, 15, 3.4, 8);
        beam([side * 17, 19, 8], [side * 26, -1, 8], 1.3, 'dark', true);
      }
      arch(0, 8, 25, 15, 11);
      // A visibly sealed receiving bell embodies the undelivered relief signal.
      k.shape(new THREE.CylinderGeometry(0.5, 1.5, 2.2, 10, 1, true), 'metal', 0, 19, 8);
      for (const side of [-1, 1]) beam([side * 2, 17.5, 6.5], [-side * 2, 21, 6.5], 0.22, 'dark');
      clearance = 32;
    } else if (s.kind === 'nave') {
      for (const z of [-19, 0, 19]) {
        arch(0, z, 42, 19, 13);
        for (const side of [-1, 1]) {
          beam([side * 21, 18, z], [side * 29, -1, z], 0.95, 'dark', true);
          post(side * 29, z, 9, 1.8);
          banner(side * 21, 12, z - 1, 7);
        }
      }
      for (const side of [-1, 1]) beam([side * 21, 19, -21], [side * 21, 19, 21], 0.6, 'stone', true);
      // Broken side walls make this the remains of a hall, with open crossings
      // between the wall bays and an unobstructed central fighting floor.
      for (const side of [-1, 1]) for (const z of [-9.5, 9.5]) {
        box(side * 21, 5, z, 1.6, 12, 12, 'stone', true);
        box(side * 21, 11, z, 2.2, 0.5, 12.5, 'edge', true);
        for (let i = -1; i <= 1; i++) {
          const zz = z + i * 3.5;
          box(side * 21, 12.2, zz, 1.6, i === 0 ? 4 : 1.5, 1.6, 'stone', true);
          for (const face of [-1, 1]) {
            box(side * 21 + face * 0.84, 6.8, zz, 0.12, 4.8, 1.6, 'dark');
            box(side * 21 + face * 0.92, 7, zz, 0.06, 3.8, 0.36, 'metal');
          }
        }
      }
      // The command chain breaks above the court; it never holds up an island.
      for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
        const link = ring(side * (4 + i * 1.7), 23 + i * 0.5, 19, 0.9, 0.16);
        link.rotation.y = i % 2 ? Math.PI / 2 : 0;
        link.scale.y = 1.35;
      }
      clearance = 37;
    }
    add(g);
    exclusions.push({ x: s.x, z: s.z, r: clearance });
    world.architecture.push({ ...s, group: g });
  }
  // Cuttings and causeways are built where the ways climb through or over the land.
  buildRoadworks(world, exclusions, add);
  // Last, so waymarks keep clear of every wall, gate and civic building placed above.
  buildWayfinding(world, exclusions, add);
}
