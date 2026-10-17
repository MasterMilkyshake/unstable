import { shelfDistance } from './shelfOutline.js';
// Split terrain triangles at the foot and lip of each rock stratum. A narrow
// cliff must cross the grid along a contour, not alternate between grid corners.
export const CLIFF_STRATA = [
  { scale: 1, ox: 0, oz: 0, rise: 0.68 },
  { scale: 0.78, ox: -0.12, oz: 0.08, rise: 0.22 },
  { scale: 0.57, ox: 0.09, oz: 0.17, rise: 0.10 },
];
export const CLIFF_FOOT = 1.02;
export const CLIFF_LIP = 0.985;

export function cliffEdge(noise, cliff, stratum, x, z) {
  const notch = noise.noise(x / 54 + 7, z / 61 - 9) * 0.13;
  return Math.max(
    Math.abs(x - cliff.x - cliff.rx * stratum.ox) / (cliff.rx * stratum.scale),
    Math.abs(z - cliff.z - cliff.rz * stratum.oz) / (cliff.rz * stratum.scale),
  ) + notch;
}

// Both halves reuse the same crossing, including when the adjacent cell visits
// this edge in reverse. Linear interpolation keeps adjoining polygons watertight.
export function splitContour(polygon, field, level) {
  const values = polygon.map(p => field(p[0], p[1]) - level);
  if (!values.some(v => v < -1e-9) || !values.some(v => v > 1e-9)) return [polygon];
  const low = [], high = [];
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length, a = polygon[i], b = polygon[j];
    const va = values[i], vb = values[j];
    if (va <= 1e-9) low.push(a);
    if (va >= -1e-9) high.push(a);
    if ((va < -1e-9 && vb > 1e-9) || (va > 1e-9 && vb < -1e-9)) {
      // Root solve the slowly curved outline, rather than moving it to a cell corner.
      let lo = 0, hi = 1;
      for (let k = 0; k < 24; k++) {
        const t = (lo + hi) / 2;
        const v = field(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) - level;
        if ((v < 0) === (va < 0)) lo = t; else hi = t;
      }
      const t = (lo + hi) / 2;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      low.push(p); high.push(p);
    }
  }
  return [low, high].filter(p => p.length >= 3);
}

export function contourCell(x, z, width, depth, cliffs, noise, terraceFields = [], shelves = []) {
  let polygons = [[[x, z], [x, z + depth], [x + width, z]],
    [[x, z + depth], [x + width, z + depth], [x + width, z]]];
  let changed = false;
  const cut = (field, level) => {
    polygons = polygons.flatMap(p => {
      const pieces = splitContour(p, field, level);
      if (pieces.length > 1) changed = true;
      return pieces;
    });
  };
  for (const cliff of cliffs) {
    if (x > cliff.x + cliff.rx * 1.2 || x + width < cliff.x - cliff.rx * 1.2
      || z > cliff.z + cliff.rz * 1.2 || z + depth < cliff.z - cliff.rz * 1.2) continue;
    for (const stratum of CLIFF_STRATA) {
      const field = (px, pz) => cliffEdge(noise, cliff, stratum, px, pz);
      for (const level of [CLIFF_FOOT, CLIFF_LIP]) cut(field, level);
    }
  }
  for (const shelf of shelves) {
    if (x > shelf.x + shelf.rx + 1 || x + width < shelf.x - shelf.rx - 1 ||
      z > shelf.z + shelf.rz + 1 || z + depth < shelf.z - shelf.rz - 1) continue;
    const field = (px, pz) => shelfDistance(shelf.outline, px, pz);
    for (const level of [-0.35, 0.35]) cut(field, level);
  }
  // Natural shelf bands have the same grid problem as authored bluffs.
  for (const field of terraceFields) {
    const values = [[x, z], [x + width, z], [x, z + depth], [x + width, z + depth]].map(p => field(...p));
    const low = Math.min(...values), high = Math.max(...values);
    for (let k = Math.max(0, Math.floor(low)); k <= Math.floor(high); k++) {
      for (const level of [k + 0.92, k + 1]) if (level > low && level < high) cut(field, level);
    }
  }
  return changed ? polygons : null;
}

export function triangleHeight(triangles, x, z) {
  for (const [a, b, c] of triangles) {
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
    if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001) return a[1] * u + b[1] * v + c[1] * (1 - u - v);
  }
  return null;
}
