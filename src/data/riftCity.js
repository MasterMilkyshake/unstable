import { RIFT_CITADEL } from './riftCitadel.js';
import { RIFT_PADS } from './riftLayout.js';

// The Drowned Precincts: the city of the keep, laid out in rings as the dynasty built it.
//   the outer curtain   on the lip of the city's terraces, all the way round; its north runs
//                       close on the Chainward's barbican, so the throne mount is the city's
//                       northern fortress. Three gates: the Great South Gate on the approach
//                       from the arrival shelf, the Garrison Gate (east) and the Bastion Gate
//                       (west), each where an old road leaves.
//   the city            the Bell Ward (east) and the Chain Courts (west) on the middle terrace,
//                       the Processional Terrace above them; the Gate Plaza between the Great
//                       South Gate and the citadel.
//   the inner citadel   the Ascent's own ring (data/riftCitadel.js): its south front is the
//                       keep's face over the plaza, its north wall stands on the upper terrace's
//                       edge with the processional stair climbing to its gate.
// Coordinates are already in Rift space (+x is WEST, +z north). Ward shelves reach beneath the
// outer rows of homes and their door approaches.
export const RIFT_CITY_FLATS = [
  { x: 6000, z: 5994, rx: 122, rz: 122, core: 0.87, h: 6 },
  { x: 6000, z: 6010, rx: 112, rz: 72, core: 0.94, h: 10.6, cliffWidth: 0.65,
    front: [[5880, 5945], [5910, 5941], [5930, 5947], [5950, 5943], [5970, 5946],
      [5985, 5941], [6000, 5944], [6015, 5940], [6030, 5946], [6055, 5942], [6080, 5947], [6120, 5944]] },
  { x: 6000, z: 6072, rx: 112, rz: 44, core: 0.94, h: 17, cliffWidth: 0.65,
    front: [[5880, 6037], [5908, 6035], [5930, 6032], [5948, 6038], [5968, 6034],
      [5982, 6030], [6000, 6035], [6014, 6030], [6032, 6035], [6050, 6032], [6070, 6038], [6092, 6034], [6120, 6038]] },
];

// Shared stairs: the approach up to the Great South Gate, the processional stair inside the
// citadel to its north gate, and one stair in each ward from the middle terrace to the upper,
// set against the outer curtain.
export const RIFT_CITY_RAMPS = [
  { x: 6000, z: 5914, x2: 6000, z2: 5944, y: 6, y2: 10.6, w: 14, shoulder: 0.8 },
  { x: 6000, z: 6010, x2: 6000, z2: 6038, y: 10.6, y2: 17, w: 9, shoulder: 0.8 },
  { x: 5935, z: 6010, x2: 5935, z2: 6040, y: 10.6, y2: 17, w: 8, shoulder: 0.8 },
  { x: 6065, z: 6010, x2: 6065, z2: 6040, y: 10.6, y2: 17, w: 8, shoulder: 0.8 },
];

// Inside the Precincts the wards are the ground; 'auto' standing flats belong outside them.
export function inDrownedPrecincts(x, z) {
  return x > 5880 && x < 6112 && z > 5944 && z < 6104;
}

export const RIFT_CITY_LOCATIONS = [
  { name: 'The Drowned Precincts', x: 6000, z: 6020, r: 125 },
  { name: 'The Bell Ward', x: 5918, z: 5995, r: 30 },
  { name: 'The Chain Courts', x: 6080, z: 5995, r: 30 },
  { name: 'The Gate Plaza', x: 6000, z: 5961, r: 16 },
  { name: 'The Processional Terrace', x: 6000, z: 6058, r: 34 },
];

// ------------------------------------------------------------------ the outer curtain
// Centre lines of the runs between towers. The wall walk is level along a terrace and steps
// at a tower where the curtain climbs from the middle terrace to the upper one.
export const RIFT_CITY_WALL_T = 4;
export const RIFT_CITY_TOPS = { middle: 24, upper: 30.5 };
export const RIFT_CITY_STEP_Z = 6036;
const S = 5951, E = 5894, W = 6106, N = 6104, STEP_Z = RIFT_CITY_STEP_Z;
// [x, z, kind] — every node is a tower; 'gate' nodes are gatehouses (a passage between towers).
export const RIFT_CITY_CIRCUIT = [
  // the north-east run, from the Chainward's barbican round to the east side
  { x: 5971, z: N, kind: 'join' },
  { x: 5932, z: N, kind: 'tower' },
  { x: E, z: N, kind: 'corner' },
  { x: E, z: 6052, kind: 'gate', gate: 'garrison' },
  { x: E, z: 5994, kind: 'tower' },
  { x: E, z: S, kind: 'corner' },
  { x: 5947, z: S, kind: 'tower' },
  { x: 6000, z: S, kind: 'gate', gate: 'south' },
  { x: 6053, z: S, kind: 'tower' },
  { x: W, z: S, kind: 'corner' },
  { x: W, z: 5980, kind: 'gate', gate: 'bastion' },
  { x: W, z: 6012, kind: 'tower' },
  { x: W, z: STEP_Z, kind: 'tower', step: true },
  { x: W, z: N, kind: 'corner' },
  { x: 6068, z: N, kind: 'tower' },
  { x: 6029, z: N, kind: 'join' },
];
// The gates as [x, z, yaw] (kit.siteFrame: the gate side, local -z, faces outward).
export const RIFT_CITY_GATES = [
  [6000, S, 0],
  [E, 6052, Math.PI / 2],
  [W, 5980, -Math.PI / 2],
];
export const RIFT_CITY_GATE_DEFS = {
  south: { name: 'The Great South Gate', width: 9, depth: 14, towers: 11 },
  garrison: { name: 'The Garrison Gate', width: 7.5, depth: 11, towers: 9 },
  bastion: { name: 'The Bastion Gate', width: 7.5, depth: 11, towers: 9 },
};

// ------------------------------------------------------------------ streets
// The city's streets. Houses are placed around these; the test walks each end to end.
export const RIFT_CITY_LANES = [
  // the Gate Street along the plaza from ward to ward, inside the curtain's south run
  [5900, 5960, 6100, 5960, 6],
  // the ward streets to the citadel's side gates
  [5902, 6000, 5944, 6000, 6], [6056, 6000, 6102, 6000, 6],
  // each ward's lane from the Gate Street to its stair, and the Chain Courts' to the Bastion Gate
  [5935, 5960, 5935, 6008, 6], [6065, 5960, 6065, 6008, 6], [6094, 5980, 6114, 5980, 7],
  // the Processional Terrace: across the upper ward, and on north to the Chainward's gate
  [5898, 6052, 6102, 6052, 7], [6000, 6044, 6000, 6074, 8],
];

// Courts kept clear for the citadel, the plaza, landmarks and the places people stand.
const C = RIFT_CITADEL;
const COURTS = [
  // the citadel's ring and a few metres round it, and the plaza before it
  [C.x, C.z + (C.front + C.rear) / 2, C.halfWidth + 4, (C.rear - C.front) / 2 + 5],
  [C.x, (5951 + C.z + C.front) / 2, C.halfWidth, (C.z + C.front - 5951) / 2 + 2],
  // the drowned keep's yard and its braces
  [5950, 6074, 17, 12],
  // the belfry, the colonnade and the Crystal Veins
  [5912, 6026, 7, 7], [6080, 6024, 7, 6], [6096, 6034, 9, 9],
];
// The city lost its ground south of the curtain to the Kneeling's processional, and the
// Chainward's barbican stands on what were its northern rows.
const LOST = [
  [RIFT_PADS.chainward_forecourt.x, RIFT_PADS.chainward_forecourt.z, RIFT_PADS.chainward_forecourt.rx + 6, RIFT_PADS.chainward_forecourt.rz + 6],
];
const overlapsLane = (x, z, hx, hz) => RIFT_CITY_LANES.some(([ax, az, bx, bz, width]) =>
  x + hx > Math.min(ax, bx) - width / 2 - 1 && x - hx < Math.max(ax, bx) + width / 2 + 1 &&
  z + hz > Math.min(az, bz) - width / 2 - 1 && z - hz < Math.max(az, bz) + width / 2 + 1);
const overlapsRamp = (x, z, hx, hz) => RIFT_CITY_RAMPS.some((r) =>
  x + hx > Math.min(r.x, r.x2) - r.w / 2 - 1.5 && x - hx < Math.max(r.x, r.x2) + r.w / 2 + 1.5 &&
  z + hz > Math.min(r.z, r.z2) - 1.5 && z - hz < Math.max(r.z, r.z2) + 1.5);
// The curtain's runs and towers keep a strip clear inside them.
const nearCurtain = (x, z, hx, hz) => x - hx < E + RIFT_CITY_WALL_T / 2 + 2 || x + hx > W - RIFT_CITY_WALL_T / 2 - 2 ||
  z - hz < S + RIFT_CITY_WALL_T / 2 + 3 || z + hz > N - RIFT_CITY_WALL_T / 2 - 4;

// Close-set blocks, with two-to-four metre alleys between their rooflines, in rows across the
// wards. Rows step around terrace fronts rather than spanning the sheer shelf edges.
const HOUSES = [];
const ROWS = [5980, 6011, 6063, 6077, 6091];
const WARD_COLS = [5907, 5922, 6078, 6093];
const UPPER_COLS = [5907, 5922, 5937, 5952, 5967, 5981, 6019, 6033, 6048, 6063, 6078, 6093];
for (const [row, rowZ] of ROWS.entries()) {
  const upper = rowZ > 6040;
  for (const [col, cx] of (upper ? UPPER_COLS : WARD_COLS).entries()) {
    const west = cx > 6000;
    const yaw = (row % 2 ? Math.PI : 0) + (upper ? (west ? 0.1 : -0.1) : 0) + Math.sin(row + col) * 0.035;
    const x = cx + Math.sin(row * 2.1 + col * 0.7) * 0.8;
    const z = rowZ + Math.sin(col * 1.8 + row) * 0.5;
    const w = 11 + (row + col) % 3, d = 10;
    const hx = Math.abs(Math.cos(yaw)) * (w / 2 + 0.6) + Math.abs(Math.sin(yaw)) * (d / 2 + 0.6);
    const hz = Math.abs(Math.sin(yaw)) * (w / 2 + 0.6) + Math.abs(Math.cos(yaw)) * (d / 2 + 0.6);
    if (nearCurtain(x, z, hx, hz)) continue;
    if (COURTS.some(([px, pz, rx, rz]) => Math.abs(x - px) < rx + hx && Math.abs(z - pz) < rz + hz)) continue;
    if (LOST.some(([px, pz, rx, rz]) => Math.abs(x - px) < rx + hx && Math.abs(z - pz) < rz + hz)) continue;
    if (overlapsLane(x, z, hx, hz) || overlapsRamp(x, z, hx, hz)) continue;
    // never astride the riser between the terraces
    if (z - hz < 6040 && z + hz > 6028) continue;
    if (HOUSES.some((b) => Math.abs(x - b.x) < hx + b.hx + 0.3 && Math.abs(z - b.z) < hz + b.hz + 0.3)) continue;
    HOUSES.push({ x, z, yaw, w, d, hx, hz, floors: 3 + (row * 3 + col) % 3, roof: ['dome', 'gable', 'hip', 'gable'][(row + col * 3) % 4] });
  }
}
export const RIFT_CITY_HOUSES = HOUSES;
