// Translation of authored regions into the wider sailing world. Within each
// region distances are unchanged, so buildings, encounters and roads stay aligned.
export const WORLD_LAYOUT = 5;
// The Hush lay off the fen's east coast in layout 3. Since layout 4 it lies against
// Frosthollow's south shore, one continent with it (data/world.js joinCoasts).
const HUSH = [-300, 740], HUSH_LAYOUT_3 = [-520, -700];
const inHush = (x, z) => x < -650 && z > 100 && z <= 650;
export function regionOffset(x, z) {
  if (x > 3000 || z > 3000) return [0, 0];
  if (z > 650) {
    if (x > 500) return [-420, -2080]; // Ashen Spire, on Meridian's east coast
    if (x < -450) return [-300, 500]; // Frosthollow
    if (z > 800) return [-50, 240]; // Verdance
  }
  if (x > 560) return [400, -120]; // Thornwood and Meridian share one continent
  if (inHush(x, z)) return HUSH;
  return [0, 0];
}
// A record can name the frame it was authored in (`frame`), when it stands outside the area
// regionOffset gives that frame: Meridian's port lies on ground the old harbour gave up.
export const FRAMES = { meridian: [400, -120] };
export function placedPoint(x, z) {
  const [dx, dz] = regionOffset(x, z);
  return [x + dx, z + dz];
}

const placed = new WeakSet();
export function placeRecord(record, offset = null) {
  if (!record || placed.has(record)) return;
  placed.add(record);
  const x = record.x ?? record.cx, z = record.z ?? record.cz;
  const [dx, dz] = offset || (record.frame ? FRAMES[record.frame] : regionOffset(x, z));
  for (const [kx, kz] of [['x', 'z'], ['cx', 'cz'], ['x2', 'z2']]) {
    if (Number.isFinite(record[kx]) && Number.isFinite(record[kz])) {
      record[kx] += dx; record[kz] += dz;
    }
  }
  for (const key of ['flats', 'zones', 'lobes', 'bays', 'escarpments', 'rises', 'paved', 'ramps', 'detailPatches']) {
    for (const child of record[key] || []) placeRecord(child, [dx, dz]);
  }
  if (record.spawn) placeRecord(record.spawn, [dx, dz]);
  if (record.front) record.front = record.front.map(([px, pz]) => [px + dx, pz + dz]);
  if (record.outline) record.outline = record.outline.map(([px, pz]) => [px + dx, pz + dz]);
  // a spawner's patrol and a harbour wall's line are authored in the same frame as the record
  if (record.patrol) record.patrol = record.patrol.map(([px, pz]) => [px + dx, pz + dz]);
  if (record.path) record.path = record.path.map(([px, pz]) => [px + dx, pz + dz]);
}
export function placeCatalog(records) { for (const r of records) placeRecord(r); }
export function placePath(points) {
  const [dx, dz] = regionOffset(...points[0]);
  return points.map(([x, z, ...rest]) => [x + dx, z + dz, ...rest]);
}

// The original small-island layout predates layout 2. Keep its migration step
// before applying the wider layout, so both generations of saves still load.
const LEGACY_REGIONS = [
  { c: [0, -430], r: 80, d: [0, 100] }, { c: [0, 0], r: 175, d: [0, 0] },
  { c: [540, -270], r: 210, d: [360, 450] }, { c: [-520, -290], r: 195, d: [-80, -40] },
  { c: [-440, 470], r: 205, d: [-260, 430] }, { c: [470, 480], r: 195, d: [290, 400] },
  { c: [20, 480], r: 150, d: [0, 520] },
];
export function relocateLegacy(x, z) {
  if (x > 3000) return [x, z];
  let best = null, distance = 1.7;
  for (const r of LEGACY_REGIONS) {
    const d = Math.hypot(x - r.c[0], z - r.c[1]) / r.r;
    if (d < distance) { distance = d; best = r; }
  }
  return best ? [x + best.d[0], z + best.d[1]] : [x, z];
}

// A layout 3 position on or off the Hush moves with it to Frosthollow's shore.
export function followHush(x, z) {
  if (x > 3000 || !inHush(x - HUSH_LAYOUT_3[0], z - HUSH_LAYOUT_3[1])) return [x, z];
  return [x + HUSH[0] - HUSH_LAYOUT_3[0], z + HUSH[1] - HUSH_LAYOUT_3[1]];
}

// Layout 4 moved the Ashen Spire from the open sea north of Thornwood to Meridian's east
// coast, by this much in world metres. Final-world data (data/landforms.js, vistas.js,
// adventure.js, dungeons.js) moved with it.
export const ASHEN_SPIRE_MOVE = [-910, -2200];
export function relocateAshenSpire(x, z) {
  if (x < 1000 || x > 2100 || z < 640 || z > 1600) return [x, z];
  return [x + ASHEN_SPIRE_MOVE[0], z + ASHEN_SPIRE_MOVE[1]];
}

// Existing characters follow their region once, without resetting progression.
export function migrateWorldPosition(character) {
  const from = character.worldLayout || 1;
  if (from >= WORLD_LAYOUT) return false;
  for (const p of [character.pos, character.spawn, ...(character.contracts?.held || [])]) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    if (from < 2) [p.x, p.z] = relocateLegacy(p.x, p.z);
    if (from < 3) [p.x, p.z] = placedPoint(p.x, p.z);
    // layout 4: Hush → Frosthollow; layout 5: Ashen Spire → Meridian's east coast.
    // Both helpers are idempotent for positions already moved.
    if (from < 5) {
      [p.x, p.z] = followHush(p.x, p.z);
      [p.x, p.z] = relocateAshenSpire(p.x, p.z);
    }
  }
  character.worldLayout = WORLD_LAYOUT;
  return true;
}
