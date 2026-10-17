// The Reed Covenant's way of building. The fen will not hold a stone ground floor, so fen
// houses stand on driven piles, each pile seated on a block of pale Compact ashlar hauled
// out of the fallen Arches. Walls are reed woven on a timber frame; roofs are steep, heavy
// thatch with no flare, laid in courses and bound at the ridge, the gable hung with the
// Covenant's reed effigy. Nothing here is tiered: the fen builds low and long.
//
// Called by detailBuilding() for the reed style; the room inside (floor at local y 0.12,
// stairs, loft, beds, rest points) is furnished by the same furnishInterior() as every
// other house, so an inn here works exactly like an inn anywhere else.
import * as THREE from 'three';
import { buildingMaterial } from './buildingMaterials.js';
import { FEN_STILT } from '../data/world.js';

const FEN = {
  ashlar: '#bdb9a6', ashlar2: '#a8a491', // the Arches' stone, salvaged
  pile: '#3f372b', timber: '#463d2e', plank: '#6a5a42',
  wattle: '#a89c70', wattle2: '#8f8560', weave: '#5e5538',
  thatch: '#a3935c', thatch2: '#8c7d4c', thatchDark: '#5f5536',
  // lamplight is warm: the fen outside is cold and green, the houses are where the fire is
  net: '#3a3a30', glow: '#f2c27a', cloth: '#6b8062', herb: '#5f8a3e', flower: '#c9a24a',
};

const hashXZ = (x, z, k = 0) => {
  const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

// A thick quad (a roof plane): p0..p3 counter-clockwise seen from outside, thickness t
// inward. u runs along p0 -> p1 (the ridge), v along p0 -> p3 (down the slope), so the thatch
// map's courses lie parallel to the ridge.
function slabGeometry(p0, p1, p2, p3, t, uScale = 3, vScale = 2) {
  const A = [p0, p1, p2, p3].map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().subVectors(A[1], A[0]).cross(new THREE.Vector3().subVectors(A[3], A[0])).normalize();
  const B = A.map((p) => p.clone().addScaledVector(n, -t));
  const pos = [], uv = [];
  const lu = A[0].distanceTo(A[1]) / uScale, lv = A[0].distanceTo(A[3]) / vScale;
  const quad = (a, b, c, d, ua, ub, uc, ud) => {
    for (const [p, q] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
      pos.push(p.x, p.y, p.z);
      uv.push(...q);
    }
  };
  quad(A[0], A[1], A[2], A[3], [0, 0], [lu, 0], [lu, lv], [0, lv]);
  quad(B[3], B[2], B[1], B[0], [0, lv], [lu, lv], [lu, 0], [0, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(A[j], A[i], B[i], B[j], [0, 0], [1, 0], [1, 0.15], [0, 0.15]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A triangle wall (a gable end), t thick along z.
function gableGeometry(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  return g;
}

// Steep gable thatch with its ridge along z. Eaves at local y `eave`, half-span `hw`
// (to the wall face), roof length `len` along z. Two courses of thatch, the upper one
// stepped out over the lower, a bound ridge, and stepped colliders down each slope.
export function thatchRoof(k, mats, x, eave, z, hw, len, o = {}) {
  const ov = o.overhang ?? 1.1;
  const pitch = o.pitch ?? 1.25;
  const run = hw + ov;
  const rise = run * pitch;
  const top = eave + rise - ov * pitch; // ridge height: the wall line sits ov in from the eave
  const lowY = top - rise; // the eave edge itself hangs below the wall top
  const L = len / 2 + (o.gableOverhang ?? 0.9);
  const t = o.thick ?? 0.55;
  for (const side of [-1, 1]) {
    const ex = x + side * run, rx = x;
    // lower course: eave to two thirds; upper course from a third, lifted proud of it
    const mid = 0.62, from = 0.36;
    const at = (f, lift = 0) => [ex + (rx - ex) * f, lowY + rise * f + lift, 0];
    const [ax, ay] = at(0), [bx, by] = at(mid);
    const [cx, cy] = at(from, 0.32), [dx, dy] = at(1.0, 0.3);
    const flip = side < 0; // keeps every slab's outer face pointing up and out
    const pts = (x0, y0, x1, y1) => (flip
      ? [[x0, y0, z + L], [x0, y0, z - L], [x1, y1, z - L], [x1, y1, z + L]]
      : [[x0, y0, z - L], [x0, y0, z + L], [x1, y1, z + L], [x1, y1, z - L]]);
    const lower = pts(bx, by, ax, ay).map(([px, py, pz]) => [px, py, pz]);
    // ridge-first ordering: u along the ridge, v down the slope
    k.shape(slabGeometry(lower[0], lower[1], lower[2], lower[3], t), mats.thatch2, 0, 0, 0);
    const upper = pts(dx, dy, cx, cy);
    k.shape(slabGeometry(upper[0], upper[1], upper[2], upper[3], t * 0.9), mats.thatch, 0, 0, 0);
    // the cut eave shows the thatch's depth as a dark band
    k.box(ex - side * 0.12, lowY - 0.05, z, 0.35, 0.32, L * 2, mats.thatchDark);
    // stepped colliders, so a climber can stand on the roof
    // ten narrow steps follow the slope closely, so none sags into the loft below it
    const steps = o.steps ?? 10;
    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps;
      const cxx = ex + (rx - ex) * f, cyy = lowY + rise * f;
      k.solid(cxx, cyy - 0.1, z, run / steps + 0.05, 0.2, L * 2);
    }
  }
  // bound ridge: a thick roll with binding hoops
  k.box(x, top + 0.38, z, 0.85, 0.6, L * 2 + 0.3, mats.thatchDark);
  const hoops = Math.max(2, Math.round(L / 1.6));
  for (let i = 0; i <= hoops; i++) k.box(x, top + 0.42, z - L + (i * 2 * L) / hoops, 0.95, 0.66, 0.16, mats.timber);
  return { top: top + 0.7, rise, run, lowY, L };
}

// The Covenant's reed effigy: a bound figure with outstretched arms and a ring for a head.
function effigy(k, mats, x, y, z, s = 1) {
  k.box(x, y, z, 0.22 * s, 1.6 * s, 0.22 * s, mats.thatch2);
  k.box(x, y + 0.35 * s, z, 1.3 * s, 0.18 * s, 0.18 * s, mats.thatch2);
  k.ring(x, y + 1.05 * s, z, 0.24 * s, 0.06 * s, mats.thatchDark);
  for (const dy of [-0.2, 0.25]) k.box(x, y + dy * s, z, 0.3 * s, 0.07 * s, 0.3 * s, mats.weave);
}

export function fenBuilding(world, g, s, opt, mat, { kit, furnishInterior }) {
  const palette = { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle };
  const k = kit(world, g, palette, mat, 'building_detail');
  const mats = {
    thatch: buildingMaterial(FEN.thatch, 'thatch'),
    thatch2: buildingMaterial(FEN.thatch2, 'thatch'),
    thatchDark: buildingMaterial(FEN.thatchDark, 'thatch'),
    timber: buildingMaterial(FEN.timber, 'wood'),
    pile: buildingMaterial(FEN.pile, 'wood'),
    plank: buildingMaterial(FEN.plank, 'wood'),
    wattle: buildingMaterial(FEN.wattle, 'plaster'),
    wattle2: buildingMaterial(FEN.wattle2, 'plaster'),
    weave: mat(FEN.weave),
    ashlar: buildingMaterial(FEN.ashlar, 'stone'),
    net: mat(FEN.net),
  };
  const w = s.w || 9, d = s.d || 8;
  const inn = s.type === 'inn';
  const rng = (i) => hashXZ(s.x, s.z, i);

  // Raise the floor on piles above the highest ground under the house and its veranda.
  const ground = (lx, lz) => {
    const p = k.position(lx, 0, lz);
    return world.terrain.heightAt(p.x, p.z) - g.position.y;
  };
  let hi = -Infinity;
  for (const [fx, fz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0]]) hi = Math.max(hi, ground(fx * (w + 1.6), fz * (d + 3.6) + 0.9));
  // over open water the floor still clears the swell
  g.position.y = Math.max(g.position.y + Math.max(0, hi) + FEN_STILT, 1.3);

  // Piles on salvaged ashlar pads, braced in pairs; the deck runs out to a front veranda.
  const porch = 1.9;
  const xs = [-w / 2 - 0.5, -w / 6, w / 6, w / 2 + 0.5];
  const zs = [-d / 2 - 0.4, 0, d / 2 + 0.2, d / 2 + porch - 0.2];
  let pi = 0;
  for (const px of xs) {
    for (const pz of zs) {
      const gy = ground(px, pz);
      const lean = (rng(pi++) - 0.5) * 0.18;
      k.box(px, gy + 0.18, pz, 0.95, 0.7, 0.95, mats.ashlar);
      k.beam([px + lean, gy + 0.4, pz], [px, -0.2, pz], 0.2, mats.pile, true);
    }
  }
  for (const side of [-1, 1]) {
    const px = side * (w / 2 + 0.5);
    for (let i = 0; i < zs.length - 1; i++) k.beam([px, ground(px, zs[i]) + 0.6, zs[i]], [px, -0.45, zs[i + 1]], 0.07, mats.timber);
  }
  // the deck: interior floor (top at the room floor, 0.12) and the veranda around the door
  k.box(0, -0.13, 0, w + 1.4, 0.5, d + 1.0, mats.plank, true);
  k.box(0, -0.13, d / 2 + porch / 2 + 0.35, w + 1.4, 0.5, porch + 0.3, mats.plank, true);
  for (let i = 0; i < Math.floor((w + 1.4) / 0.7); i++) k.box(-w / 2 - 0.35 + i * 0.7 + 0.35, 0.13, d / 2 + porch / 2 + 0.35, 0.05, 0.03, porch + 0.3, mats.timber);
  // The stair runs down off one end of the veranda, alongside the house, so the lane in
  // front of the door stays clear; a rail closes the veranda's front and other end.
  const sgn = rng(3) < 0.5 ? -1 : 1;
  const pz = d / 2 + porch / 2 + 0.35, rz = d / 2 + porch + 0.4, ex = w / 2 + 0.7;
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    k.box((ax + bx) / 2, 1.0, (az + bz) / 2, Math.abs(bx - ax) + 0.12, 0.1, Math.abs(bz - az) + 0.12, mats.timber);
    for (let i = 0; i <= Math.round(len / 1.1); i++) {
      const f = i / Math.max(1, Math.round(len / 1.1));
      k.box(ax + (bx - ax) * f, 0.55, az + (bz - az) * f, 0.12, 0.9, 0.12, mats.timber);
    }
    k.solid((ax + bx) / 2, 0.55, (az + bz) / 2, Math.abs(bx - ax) + 0.2, 1.1, Math.abs(bz - az) + 0.2);
  };
  rail(-ex, rz, ex, rz);
  rail(-sgn * ex, d / 2 + 0.5, -sgn * ex, rz);
  // steps down from the veranda to the fen, every step reaching the ground
  const stepTop = 0.12;
  const footGround = ground(sgn * (ex + 2), pz);
  const drop = stepTop - footGround;
  const n = Math.max(1, Math.min(10, Math.ceil(drop / 0.34)));
  for (let i = 0; i < n; i++) {
    const top = stepTop - ((i + 1) * drop) / n + 0.02;
    const x0 = sgn * (ex + 0.27 + i * 0.52);
    const bottom = ground(x0, pz) - 0.6;
    k.box(x0, (top + bottom) / 2, pz, 0.54, top - bottom, porch + 0.2, i % 2 ? mats.plank : mats.timber, true);
  }
  k.beam([sgn * ex, 1.0, rz], [sgn * (ex + n * 0.52), footGround + 0.95, rz], 0.06, mats.timber);

  // Walls: reed woven on a timber frame, a door in the gable end.
  // the inn's wall height is set by its loft stair: a climber's head must clear the thatch
  const eave = inn ? 5.5 : 3.5;
  const door = 2.4, t = 0.3;
  for (const side of [-1, 1]) {
    k.box(side * (w / 2 - t / 2), eave / 2, 0, t, eave, d, mats.wattle, true);
    k.box(side * (w + door) / 4, eave / 2, d / 2 - t / 2, (w - door) / 2, eave, t, mats.wattle, true);
  }
  k.box(0, eave / 2, -d / 2 + t / 2, w, eave, t, mats.wattle, true);
  k.box(0, (3.2 + eave) / 2, d / 2 - t / 2, door, eave - 3.2, t, mats.wattle, true);
  // the weave: horizontal bands of darker reed on every face, and the frame over it
  for (let yy = 0.55; yy < eave - 0.2; yy += 0.75) {
    for (const side of [-1, 1]) {
      k.box(side * (w / 2 + 0.01), yy, 0, 0.06, 0.16, d - 0.4, mats.wattle2);
      k.box(0, yy, side * (d / 2 + 0.01), w - 0.4, 0.16, 0.06, mats.wattle2);
    }
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(cx * (w / 2 + 0.02), eave / 2, cz * (d / 2 + 0.02), 0.42, eave + 0.2, 0.42, mats.timber);
  for (const side of [-1, 1]) {
    for (const z of [-d / 6, d / 6]) k.box(side * (w / 2 + 0.06), eave / 2, z, 0.26, eave, 0.26, mats.timber);
    k.box(side * (w / 2 + 0.05), eave - 0.1, 0, 0.32, 0.3, d + 0.4, mats.timber);
    k.box(0, eave - 0.1, side * (d / 2 + 0.05), w + 0.4, 0.3, 0.32, mats.timber);
    // shuttered openings, lamplit within
    for (const z of [-d / 3, d / 3 - 0.6]) {
      k.box(side * (w / 2 + 0.03), 1.9, z, 0.06, 1.2, 1.1, 'glow');
      k.box(side * (w / 2 + 0.12), 2.6, z, 0.14, 0.12, 1.5, mats.timber);
      k.beam([side * (w / 2 + 0.2), 2.55, z - 0.75], [side * (w / 2 + 0.8), 2.0, z - 0.75], 0.05, mats.timber);
    }
    if (inn) for (const z of [-d / 4, d / 4]) k.box(side * (w / 2 + 0.03), 4.5, z, 0.06, 0.9, 1.0, 'glow');
  }
  // door frame and the swung door
  for (const x of [-door / 2 - 0.12, door / 2 + 0.12]) k.box(x, 1.6, d / 2 + 0.05, 0.26, 3.3, 0.4, mats.timber);
  k.box(0, 3.25, d / 2 + 0.05, door + 0.7, 0.28, 0.45, mats.timber);
  k.box(door / 2 - 0.05, 1.5, d / 2 + 0.9, 0.12, 3, 1.75, mats.timber);

  // The roof, its gables, the effigy and (for the inn) a smoke hood of salvaged stone.
  const r = thatchRoof(k, mats, 0, eave, 0, w / 2, d, { pitch: inn ? 1.0 : 1.1 });
  for (const face of [-1, 1]) {
    const gz = face * (d / 2 - t / 2);
    const gm = k.shape(gableGeometry(w + 0.2, r.top - 0.7 - eave, t), mats.wattle2, 0, eave, gz);
    gm.castShadow = true;
    for (let yy = eave + 0.8; yy < r.top - 1.2; yy += 0.9) k.box(0, yy, gz + face * 0.17, Math.max(0.4, (w + 0.2) * (1 - (yy - eave) / (r.top - 0.7 - eave)) - 0.5), 0.12, 0.05, mats.weave);
    // crossed bargeboards above the ridge, the fen's mark on every house
    const by = r.top - 0.3, bz = face * (d / 2 + 0.95);
    k.beam([-1.6, by - 1.5, bz], [0.9, by + 1.0, bz], 0.11, mats.timber);
    k.beam([1.6, by - 1.5, bz], [-0.9, by + 1.0, bz], 0.11, mats.timber);
  }
  effigy(k, mats, 0, eave + 1.0, d / 2 + 0.25, inn ? 1.3 : 1);
  if (opt.chimney) {
    // the flue rises from the common-room hearth and breaks out through the low slope
    const cx = w / 2 - 0.65, cz = -d * 0.22, top = eave + 3.4;
    k.box(cx, (1.4 + top) / 2, cz, 1.15, top - 1.4, 1.15, mats.ashlar);
    k.box(cx, top + 0.15, cz, 1.5, 0.3, 1.5, mats.timber);
    world.addEmitter?.({ kind: 'smoke', pos: k.position(cx, top + 0.6, cz), rate: 3, spread: 0.3 });
  } else {
    // every fen house keeps a fire: its smoke finds the hooded vent at the back of the ridge
    k.box(0, r.top - 0.1, -d / 4, 1.3, 0.7, 1.1, mats.thatchDark);
    world.addEmitter?.({ kind: 'smoke', pos: k.position(0, r.top + 0.5, -d / 4), rate: 1.6, spread: 0.25 });
  }

  // A low thatch over the veranda: the porch is where the fen sits out of the rain.
  {
    const W2 = w / 2 + 0.8, zw = d / 2 + 0.05, ze = d / 2 + porch + 0.6, yTop = 3.6, yLow = 2.75;
    k.shape(slabGeometry([W2, yTop, zw], [-W2, yTop, zw], [-W2, yLow, ze], [W2, yLow, ze], 0.32), mats.thatch2, 0, 0, 0);
    k.box(0, yLow - 0.08, ze - 0.12, W2 * 2, 0.22, 0.26, mats.thatchDark);
    for (const x of [-(w / 2 + 0.55), -w / 4, w / 4, w / 2 + 0.55]) k.beam([x, 0.1, d / 2 + porch + 0.3], [x, yLow - 0.1, d / 2 + porch + 0.3], 0.09, mats.timber);
    // herb boxes along the rail, away from the stair end
    for (let i = 0; i < 2; i++) {
      const x = -sgn * (w / 2 - 0.4 - i * 1.4);
      k.box(x, 0.45, d / 2 + porch + 0.05, 1.0, 0.45, 0.42, mats.plank);
      k.box(x, 0.78, d / 2 + porch + 0.05, 0.85, 0.25, 0.32, mat(i ? FEN.flower : FEN.herb));
    }
  }

  // Fen life: nets drying on the long wall, eel traps and a reed stack on the veranda.
  const side = rng(9) < 0.5 ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    const z = -d / 3 + i * (d / 3);
    k.box(side * (w / 2 + 0.25), 2.4, z, 0.04, 2.2, 1.6, mats.net);
  }
  k.beam([side * (w / 2 + 0.35), 3.55, -d / 2], [side * (w / 2 + 0.35), 3.55, d / 2], 0.05, mats.timber);
  for (let i = 0; i < 2; i++) {
    const trap = k.shape(new THREE.CylinderGeometry(0.32, 0.24, 1.2, 7, 1, true), mats.weave, -side * (w / 2 - 0.4) + i * side * 0.8, 0.75, d / 2 + porch * 0.55);
    trap.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 5; i++) k.box(side * (w / 2 - 0.3 - i * 0.08), 1.1, d / 2 + 0.9 + i * 0.12, 0.14, 2.2, 0.14, mats.thatch2);
  k.lantern(-1.9, 2.6, d / 2 + 0.6);

  // The room inside works like every other house: same floor, stairs, loft and beds.
  furnishInterior(world, k, s, w, d, inn ? 11.5 : eave + 2.1, inn ? { loftLamp: [w * 0.12, d * 0.28] } : {});
}

// Moss's hut and other small fen shelters: the same piles and thatch at a fisher's scale.
export function fenHutRoof(k, mat, x, eave, z, hw, len) {
  const mats = {
    thatch: buildingMaterial(FEN.thatch, 'thatch'),
    thatch2: buildingMaterial(FEN.thatch2, 'thatch'),
    thatchDark: buildingMaterial(FEN.thatchDark, 'thatch'),
    timber: buildingMaterial(FEN.timber, 'wood'),
  };
  return thatchRoof(k, mats, x, eave, z, hw, len, { pitch: 1.35, overhang: 0.8, thick: 0.4 });
}

// ---------------------------------------------------------------- the fen village
// Boardwalks, net racks, effigy poles and stilt lookouts: what makes Reedbank a fen
// village rather than three houses on a lawn. Each is a STRUCTURES entry handled here.
function fenMats(mat) {
  return {
    thatch: buildingMaterial(FEN.thatch, 'thatch'),
    thatch2: buildingMaterial(FEN.thatch2, 'thatch'),
    thatchDark: buildingMaterial(FEN.thatchDark, 'thatch'),
    timber: buildingMaterial(FEN.timber, 'wood'),
    pile: buildingMaterial(FEN.pile, 'wood'),
    plank: buildingMaterial(FEN.plank, 'wood'),
    ashlar: buildingMaterial(FEN.ashlar, 'stone'),
    weave: mat(FEN.weave),
    net: mat(FEN.net),
    cloth: mat(FEN.cloth),
    fish: mat('#8a8a7a'),
  };
}

function featureGroup(world, s, add, x = s.x, z = s.z) {
  const g = new THREE.Group();
  g.position.set(x, world.terrain.heightAt(x, z), z);
  g.rotation.y = s.rot || 0;
  g.name = s.name || `fen ${s.type}`;
  add(g);
  return g;
}

// Planks on piles along a polyline, a hand's breadth above the water or the mud.
function boardwalk(world, s, add, mat, kit) {
  const g = new THREE.Group();
  g.name = s.name || 'fen boardwalk';
  add(g);
  const k = kit(world, g, { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle }, mat, 'fen_walk');
  const m = fenMats(mat);
  const w = s.w || 2.2;
  const deck = (x, z) => Math.max(world.terrain.heightAt(x, z), 0) + 0.5;
  const pts = s.points;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.4));
    for (let j = 0; j < n; j++) {
      const f0 = j / n, f1 = (j + 1) / n, fm = (f0 + f1) / 2;
      const x = ax + (bx - ax) * fm, z = az + (bz - az) * fm;
      const y = deck(ax + (bx - ax) * f0, az + (bz - az) * f0) * (1 - 0.5) + deck(ax + (bx - ax) * f1, az + (bz - az) * f1) * 0.5;
      const seg = len / n;
      const plank = k.box(x, y - 0.08, z, w, 0.16, seg + 0.04, j % 3 ? m.plank : m.timber);
      plank.rotation.y = yaw;
      world.colliders.addBox({ x, z, w, d: seg + 0.1, y0: y - 0.5, y1: y, rot: yaw, tag: 'fen_walk' });
      if (j % 2 === 0) {
        for (const side of [-1, 1]) {
          const px = x + Math.cos(yaw) * side * (w / 2 - 0.1), pz = z - Math.sin(yaw) * side * (w / 2 - 0.1);
          const gy = world.terrain.heightAt(px, pz);
          k.beam([px, gy - 0.6, pz], [px, y + (j % 4 === 0 ? 0.9 : -0.1), pz], 0.11, m.pile);
        }
      }
    }
    // lanterns hang from every other tall post on the landward side; the ends are lit
    for (let j = 0; j < n; j += 4) {
      if ((j / 4) % 2) continue;
      const f = (j + 0.5) / n;
      const x = ax + (bx - ax) * f - Math.cos(yaw) * (w / 2 - 0.1), z = az + (bz - az) * f + Math.sin(yaw) * (w / 2 - 0.1);
      const y = deck(x, z) + 0.9;
      k.beam([x, y, z], [x - Math.cos(yaw) * 0.6, y, z + Math.sin(yaw) * 0.6], 0.04, m.timber);
      k.lantern(x - Math.cos(yaw) * 0.6, y - 0.55, z + Math.sin(yaw) * 0.6, 0.0);
      if (i === 1 && j === 0) world.addLight(new THREE.Vector3(x, y - 0.5, z), FEN.glow, 0.9, 12, true, 0.7);
    }
    if (i === pts.length - 1) world.addLight(new THREE.Vector3(bx, deck(bx, bz) + 1.2, bz), FEN.glow, 0.9, 12, true, 0.7);
    // rope rail on the seaward side, slung between the tall posts
    const sx = Math.cos(yaw) * (w / 2 - 0.1), sz = -Math.sin(yaw) * (w / 2 - 0.1);
    k.beam([ax + sx, deck(ax, az) + 0.85, az + sz], [bx + sx, deck(bx, bz) + 0.85, bz + sz], 0.03, m.weave);
  }
}

// Two trestles and a pole, hung with nets and a string of drying fish.
function netRack(world, s, add, mat, kit) {
  const g = featureGroup(world, s, add);
  const k = kit(world, g, { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle }, mat, 'fen_rack');
  const m = fenMats(mat);
  const len = s.len || 5;
  for (const x of [-len / 2, len / 2]) {
    for (const z of [-0.7, 0.7]) k.beam([x, -0.3, z], [x, 2.6, 0], 0.08, m.timber);
    k.solid(x, 1.2, 0, 0.3, 2.4, 1.4);
  }
  k.beam([-len / 2 - 0.3, 2.55, 0], [len / 2 + 0.3, 2.55, 0], 0.07, m.timber);
  for (let i = 0; i < Math.floor(len / 1.3); i++) {
    const x = -len / 2 + 0.6 + i * 1.3;
    k.box(x, 1.6, 0, 1.1, 1.9 - (i % 2) * 0.4, 0.03, m.net);
  }
  for (let i = 0; i < 6; i++) k.box(-len / 2 + 0.5 + i * (len - 1) / 5, 2.2, 0.12, 0.12, 0.45, 0.06, m.fish);
}

// A Covenant marker: a tall pole with a reed figure, a crossbar of ribbons, stones at its foot.
function effigyPole(world, s, add, mat, kit) {
  const g = featureGroup(world, s, add);
  const k = kit(world, g, { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle }, mat, 'fen_pole');
  const m = fenMats(mat);
  const h = s.h || 5.5;
  k.beam([0, -0.5, 0], [0, h, 0], 0.13, m.timber, true);
  k.box(0, h - 1.6, 0, 1.8, 0.12, 0.12, m.timber);
  for (const x of [-0.8, -0.3, 0.3, 0.8]) k.box(x, h - 2.1, 0, 0.14, 0.9 + Math.abs(x) * 0.4, 0.03, m.cloth);
  effigy(k, m, 0, h - 0.6, 0.18, 0.9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(Math.cos(a) * 0.8, 0.15, Math.sin(a) * 0.8, 0.5, 0.4, 0.45, m.ashlar);
  }
}

// A lookout on four tall piles: braced legs, a ladder, a railed platform under a thatch cap.
function stiltLookout(world, s, add, mat, kit) {
  const g = featureGroup(world, s, add);
  const k = kit(world, g, { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle }, mat, 'fen_lookout');
  const m = fenMats(mat);
  const H = s.h || 8, half = 1.6;
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      k.box(x, 0.15, z, 0.9, 0.6, 0.9, m.ashlar);
      k.beam([x * 1.12, -0.4, z * 1.12], [x, H + 2.6, z], 0.16, m.pile, true);
    }
  }
  for (const [a, b] of [[[-half, 0.6, -half], [half, H - 0.6, -half]], [[half, 0.6, half], [-half, H - 0.6, half]], [[-half, 0.6, half], [-half, H - 0.6, -half]], [[half, 0.6, -half], [half, H - 0.6, half]]]) k.beam(a, b, 0.07, m.timber);
  k.box(0, H, 0, half * 2 + 1.2, 0.3, half * 2 + 1.2, m.plank, true);
  for (const side of [-1, 1]) {
    k.box(side * (half + 0.55), H + 0.65, 0, 0.1, 0.1, half * 2 + 1.2, m.timber);
    k.box(0, H + 0.65, side * (half + 0.55), half * 2 + 1.2, 0.1, 0.1, m.timber);
    k.solid(side * (half + 0.55), H + 0.6, 0, 0.2, 1.0, half * 2 + 1.2);
  }
  k.solid(0, H + 0.6, -(half + 0.55), half * 2 + 1.2, 1.0, 0.2);
  // ladder up the front, rungs every 0.4 m
  k.beam([-0.4, 0, half + 0.9], [-0.4, H + 0.2, half + 0.25], 0.06, m.timber);
  k.beam([0.4, 0, half + 0.9], [0.4, H + 0.2, half + 0.25], 0.06, m.timber);
  for (let y = 0.4; y < H; y += 0.4) {
    const z = half + 0.9 - (y / H) * 0.65;
    k.box(0, y, z, 0.9, 0.06, 0.06, m.timber);
  }
  k.solid(0, H / 2, half + 0.6, 1.0, H, 0.4);
  thatchRoof(k, m, 0, H + 2.6, 0, half + 0.2, half * 2 + 0.4, { pitch: 1.1, overhang: 0.7, thick: 0.35, gableOverhang: 0.5 });
  k.lantern(half - 0.2, H + 1.6, half - 0.2);
}

// The Last Lantern, at the fen-ward edge of Reedbank: a tall post with a hanging lamp the
// Covenant keeps lit for whoever is still out on the channels, a wick box, and the slate
// of names (its notice is a written source in data/lore.js, read from the post beside it).
function lastLantern(world, s, add, mat, kit) {
  const g = featureGroup(world, s, add);
  const k = kit(world, g, { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle }, mat, 'fen_lantern');
  const m = fenMats(mat);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.box(Math.cos(a) * 1.1, 0.2, Math.sin(a) * 1.1, 0.7, 0.5 + (i % 3) * 0.12, 0.6, m.ashlar);
  }
  k.beam([0, -0.6, 0], [0, 5.2, 0], 0.18, m.timber, true);
  k.beam([0, 4.9, 0], [0, 4.9, -1.9], 0.08, m.timber);
  k.beam([0, 3.9, 0], [0, 4.85, -1.2], 0.06, m.timber);
  k.lantern(0, 4.1, -1.8, 0.75);
  // wick box and the slate of names on the village side
  k.box(0, 1.2, 0.32, 0.7, 0.5, 0.42, m.plank);
  k.box(0, 1.47, 0.32, 0.76, 0.06, 0.48, m.timber);
  k.box(0, 2.3, 0.24, 0.9, 1.2, 0.08, mat('#3c3f3a'));
  for (let i = 0; i < 6; i++) k.box(-0.25 + (i % 2) * 0.3, 2.75 - Math.floor(i / 2) * 0.32, 0.29, 0.22, 0.03, 0.02, mat('#b9b6a8'));
  for (let i = 0; i < 3; i++) k.box(-0.25 + i * 0.25, 2.75 - i * 0.32, 0.3, 0.3, 0.025, 0.02, mat('#7a3a2a'));
}

// Logs drawn up around a fire: where the fen talks in the evening.
function fireSeats(world, s, add, mat, kit) {
  const g = featureGroup(world, s, add);
  const k = kit(world, g, { stone: FEN.ashlar2, edge: FEN.ashlar, dark: FEN.timber, metal: '#5a5446', roof: FEN.thatch, cloth: FEN.cloth, glow: FEN.glow, plaster: FEN.wattle }, mat, 'fen_seats');
  const m = fenMats(mat);
  const r = s.r || 2.9;
  for (let i = 0; i < 3; i++) {
    const a = (s.rot || 0) + (i / 3) * Math.PI * 2 + 0.4;
    const log = k.shape(new THREE.CylinderGeometry(0.28, 0.3, 2.2, 7), m.pile, Math.cos(a) * r, 0.24, Math.sin(a) * r);
    log.rotation.set(Math.PI / 2, -a, 0, 'YXZ'); // lying along the circle's tangent
  }
  // a pot hook over the fire
  for (const sx of [-0.9, 0.9]) k.beam([sx, -0.2, 0], [0, 1.7, 0], 0.05, m.timber);
  k.beam([0, 1.65, 0], [0, 1.1, 0], 0.02, 'metal');
  k.box(0, 0.95, 0, 0.5, 0.35, 0.5, mat('#2f2c28'));
}

export function buildFenFeature(world, s, add, mat, exclusions, kit) {
  switch (s.type) {
    case 'boardwalk':
      boardwalk(world, s, add, mat, kit);
      for (const [x, z] of s.points) exclusions.push({ x, z, r: (s.w || 2.2) + 1 });
      return true;
    case 'net_rack':
      netRack(world, s, add, mat, kit);
      exclusions.push({ x: s.x, z: s.z, r: (s.len || 5) * 0.6 + 1 });
      return true;
    case 'effigy_pole':
      effigyPole(world, s, add, mat, kit);
      exclusions.push({ x: s.x, z: s.z, r: 2 });
      return true;
    case 'stilt_lookout':
      stiltLookout(world, s, add, mat, kit);
      exclusions.push({ x: s.x, z: s.z, r: 5 });
      return true;
    case 'last_lantern':
      lastLantern(world, s, add, mat, kit);
      exclusions.push({ x: s.x, z: s.z, r: 3 });
      return true;
    case 'fire_seats':
      fireSeats(world, s, add, mat, kit);
      return true;
    default:
      return false;
  }
}
