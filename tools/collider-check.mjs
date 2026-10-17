// node tools/collider-check.mjs [--all] [--rift] [--json out.json] [--near x,z]
//
// Builds the structures headlessly (the same pass the tests walk) and checks their colliders:
//
//   floating   a group of colliders that touch each other but none of which reaches the
//              ground: something a walker can land on, or bump into, hanging in the air
//   wall gap   a slit between the facing ends of two wall pieces of the same kind of work (both
//              tagged) that nothing else plugs, so light shows through or a body squeezes. From
//              5 cm up to 0.9 m: a walker is 0.84 m across, so anything wider is a passage
//
// Each collider is put down to the module that laid it (from the call stack) and the nearest
// named place. Findings in the town structures (TOWN below) fail the run; everything else is
// listed with --all. --rift checks the Rift instead (the kingdom, the Ascent, the castles and
// the Landing That Never Came) and lists every finding without failing: the Rift has pieces
// that hang on purpose (the upended towers' galleries, the Folded Court). Colliders with no
// height (the Whisper Archive before the mind thins) and the Ascent lift's deck and cage
// walls, which ride its shaft, are left out. Triage: docs/agent/WORLD_DESIGN_PLAN.md.
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { buildGreatBridge } from '../src/world/greatBridge.js';
import { buildRiftscape } from '../src/world/riftscape.js';
import { buildRift } from '../src/world/rift.js';
import { LOCATIONS } from '../src/data/world.js';

const TOWN = new Set(['vernacular.js', 'civic.js', 'palaces.js', 'seats.js', 'sites.js', 'fortifications.js', 'outposts.js', 'harbours.js',
  'approaches.js', 'roadworks.js', 'seaGate.js', 'meridianLift.js', 'meridianBridge.js', 'innerWards.js', 'architecture.js',
  'settlementFixtures.js', 'wayfinding.js', 'greatBridge.js', 'etris.js', 'fenArchitecture.js', 'props.js', 'furnishing.js']);
const args = process.argv.slice(2), all = args.includes('--all'), rift = args.includes('--rift'), jsonAt = args[args.indexOf('--json') + 1];

Error.stackTraceLimit = 60;
// who laid each collider: the first frame in src/world that is not the collider plumbing
const PLUMBING = /\/(colliders|kit|mason|merge)\.js/;
const insert = Colliders.prototype._insert;
Colliders.prototype._insert = function (c) {
  // a module's own collider helper (a kit's solid or box) passes the blame on to its caller
  const frames = new Error().stack.split('\n').filter(l => l.includes('/src/world/') && !PLUMBING.test(l))
    .map(l => l.match(/at (?:([\w.$]+) )?\(?.*\/src\/world\/([\w.]+\.js):(\d+)/)).filter(Boolean);
  let i = 0;
  while (frames[i + 1] && /^(solid|box|beam|post|addBox|block|slab)$/.test(frames[i][1] || '') && frames[i + 1][2] === frames[i][2]) i++;
  const f = frames[i];
  c.src = f ? f[2] : 'unknown';
  c.line = f ? +f[3] : 0;
  return insert.call(this, c);
};

const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(), animated: [], docks: {}, hazards: [],
  dummySpots: [], interactables: [], loreTablets: [], addLight() {}, addInteract(it) { this.interactables.push(it); return it; }, addEmitter() {},
  sky: { update() {} }, lightSources: [], projectileBlockers: [], chests: [], walls: [], lendLight() { return null; },
};
world.terrain.build();
const exclusions = buildStructures(world);
buildGreatBridge(world, []);
if (rift) {
  buildRiftscape(world, exclusions);
  buildRift(world, exclusions);
}
// the surface and the Rift (x > 3000) are checked apart
const inArea = (c) => (c.x > 3000) === rift && c.y1 > c.y0 && !/^ascent_lift(_cage)?$/.test(c.tag || '');
const T = world.terrain, C = world.colliders, list = [...C.all].filter(inArea);

// ---------------------------------------------------------------- footprints
const corners = (c) => {
  if (c.kind === 'cyl') return null;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const lx = a * c.hw, lz = b * c.hd;
    return [c.x + lx * c.cos + lz * c.sin, c.z - lx * c.sin + lz * c.cos];
  });
};
// distance from a point to a collider's footprint (0 inside)
const pointDist = (c, x, z) => {
  if (c.kind === 'cyl') return Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
  const [lx, lz] = C._local(c, x, z);
  return Math.hypot(Math.max(0, Math.abs(lx) - c.hw), Math.max(0, Math.abs(lz) - c.hd));
};
// gap between two footprints, and the pair of points it is measured between
function gap(a, b) {
  let best = { d: Infinity };
  const probe = (p, q) => {
    const pts = corners(p);
    if (!pts) {
      // a cylinder: its centre's distance to the other, less the radius
      const d = pointDist(q, p.x, p.z) - p.r;
      if (d < best.d) best = { d, at: [p.x, p.z] };
      return;
    }
    for (const [x, z] of pts) { const d = pointDist(q, x, z); if (d < best.d) best = { d, at: [x, z] }; }
    // and the footprint's centre, so a box inside another counts as touching
    const d = pointDist(q, p.x, p.z);
    if (d < best.d) best = { d, at: [p.x, p.z] };
  };
  probe(a, b); probe(b, a);
  // edge crossings of two boxes: their footprints overlap even if no corner is inside
  if (best.d > 0 && a.kind === 'box' && b.kind === 'box') {
    const A = corners(a), B = corners(b);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (cross(A[i], A[(i + 1) % 4], B[j], B[(j + 1) % 4])) return { d: 0, at: A[i] };
  }
  return best;
}
function cross([ax, az], [bx, bz], [cx, cz], [dx, dz]) {
  const o = (px, pz, qx, qz, rx, rz) => Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
  return o(ax, az, bx, bz, cx, cz) !== o(ax, az, bx, bz, dx, dz) && o(cx, cz, dx, dz, ax, az) !== o(cx, cz, dx, dz, bx, bz);
}
const near = (x, z) => {
  let best = null, d = Infinity;
  for (const l of LOCATIONS) { const e = Math.hypot(l.x - x, l.z - z) - l.r; if (e < d && l.r < 120) { d = e; best = l; } }
  return best ? best.name : '';
};
const where = (c) => `${c.src}:${c.line} ${c.tag || ''} at ${c.x.toFixed(1)}, ${c.y0.toFixed(1)}..${c.y1.toFixed(1)}, ${c.z.toFixed(1)}`;

// ---------------------------------------------------------------- floating groups
// grounded: its bottom is at or under the ground somewhere under it
const TOUCH = 0.25; // a drawn eave plate or sill this thick bridges what it does not collide
const grounded = (c) => {
  const pts = corners(c) || [[c.x + c.r * 0.7, c.z], [c.x - c.r * 0.7, c.z], [c.x, c.z + c.r * 0.7], [c.x, c.z - c.r * 0.7]];
  // standing in the ground, or afloat: a hull or float at the water over the sea bed
  return [[c.x, c.z], ...pts].some(([x, z]) => { const h = T.heightAt(x, z); return c.y0 <= h + TOUCH || (h < 0 && c.y0 <= 0.5); });
};
const supported = new Set(list.filter(grounded)), queue = [...supported];
while (queue.length) {
  const a = queue.pop();
  for (const b of C.query(a.x, a.z, a.br + 0.2, [])) {
    if (supported.has(b) || !inArea(b)) continue;
    if (b.y0 > a.y1 + TOUCH || a.y0 > b.y1 + TOUCH) continue;
    if (gap(a, b).d > 0.05) continue;
    supported.add(b);
    queue.push(b);
  }
}
const floating = [];
{
  const seen = new Set();
  for (const c of list) {
    if (supported.has(c) || seen.has(c)) continue;
    // gather the floating group it belongs to
    const group = [c], q = [c];
    seen.add(c);
    while (q.length) {
      const a = q.pop();
      for (const b of C.query(a.x, a.z, a.br + 0.2, [])) {
        if (seen.has(b) || supported.has(b) || !inArea(b)) continue;
        if (b.y0 > a.y1 + TOUCH || a.y0 > b.y1 + TOUCH || gap(a, b).d > 0.05) continue;
        seen.add(b); group.push(b); q.push(b);
      }
    }
    const lo = Math.min(...group.map(g => g.y0)), ground = Math.max(...group.map(g => T.heightAt(g.x, g.z)));
    floating.push({ kind: 'floating', town: !rift && group.some(g => TOWN.has(g.src)), src: c.src, line: c.line, tag: c.tag, n: group.length,
      x: c.x, z: c.z, y0: lo, over: +(lo - ground).toFixed(2), place: near(c.x, c.z), what: where(c) });
  }
}

// ---------------------------------------------------------------- gaps in wall runs
// a wall piece: a box at least 1.4 m tall and at most 1.6 m thick
const wall = (c) => c.kind === 'box' && c.src !== 'furnishing.js' && c.y1 - c.y0 >= 1.4 && Math.min(c.hw, c.hd) * 2 <= 1.6 && Math.max(c.hw, c.hd) * 2 >= 0.6;
const walls = list.filter(wall), gaps = [], pairs = new Set();
for (const a of walls) {
  for (const b of C.query(a.x, a.z, a.br + 1.2, [])) {
    // an untagged piece (a ruin, a rock) beside a building is not one wall run with it
    if (a === b || !wall(b) || !inArea(b) || !a.tag || !b.tag) continue;
    const key = a.x < b.x || (a.x === b.x && a.z < b.z) ? `${a.x},${a.z},${b.x},${b.z}` : `${b.x},${b.z},${a.x},${a.z}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    const y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y1, b.y1);
    if (y1 - y0 < 1.0) continue;
    const g = gap(a, b);
    if (!(g.d > 0.05 && g.d < 0.9)) continue;
    // the slit faces their ends, not their long sides (a doubled wall is not a gap)
    const atEnd = (c, [x, z]) => {
      const [lx, lz] = C._local(c, x, z), long = c.hw >= c.hd ? Math.abs(lx) - c.hw : Math.abs(lz) - c.hd;
      return long > -0.35;
    };
    const [px, pz] = g.at, [qx, qz] = [px, pz];
    if (!atEnd(a, g.at) || !atEnd(b, g.at)) continue;
    // plugged: something stands in the slit at mid height
    const mid = [qx, qz], ym = (y0 + y1) / 2;
    const plugged = C.query(mid[0], mid[1], 1.2, []).some(c => c !== a && c !== b && ym >= c.y0 && ym <= c.y1 && pointDist(c, mid[0], mid[1]) < g.d * 0.6 + 0.05);
    if (plugged) continue;
    gaps.push({ kind: 'wall gap', town: !rift && (TOWN.has(a.src) || TOWN.has(b.src)), src: a.src, line: a.line, tag: a.tag, width: +g.d.toFixed(2),
      x: px, z: pz, y0, y1, place: near(px, pz), what: `${where(a)}  |  ${where(b)}` });
  }
}

// --near x,z: every collider within 3 m of a point, with who laid it (for chasing a finding)
const at = args.indexOf('--near');
if (at >= 0) {
  const [x, z] = args[at + 1].split(',').map(Number);
  for (const c of C.query(x, z, 3, [])) {
    if (pointDist(c, x, z) > 3) continue;
    const size = c.kind === 'box' ? `${(c.hw * 2).toFixed(2)} x ${(c.hd * 2).toFixed(2)} rot ${c.rot.toFixed(2)}` : `r ${c.r.toFixed(2)}`;
    console.log(`  ${c.src}:${c.line}`.padEnd(30), `${c.kind} ${size}`.padEnd(30), `at ${c.x.toFixed(2)}, ${c.z.toFixed(2)}  y ${c.y0.toFixed(2)}..${c.y1.toFixed(2)}  ground ${T.heightAt(c.x, c.z).toFixed(2)}`, c.walkable ? '' : 'nowalk');
  }
}

// ---------------------------------------------------------------- report
const found = [...floating, ...gaps];
const shown = all || rift ? found : found.filter(f => f.town);
const bySrc = {};
for (const f of found) (bySrc[`${f.town ? 'town' : 'other'} ${f.src}`] ||= { floating: 0, 'wall gap': 0 })[f.kind]++;
console.log(`${list.length} colliders checked: ${floating.length} floating groups, ${gaps.length} wall gaps`);
for (const [k, v] of Object.entries(bySrc).sort()) console.log(`  ${k.padEnd(34)} floating ${v.floating}  wall gaps ${v['wall gap']}`);
for (const f of shown) {
  const head = f.kind === 'floating' ? `floating ${f.n} collider${f.n > 1 ? 's' : ''}, ${f.over} m over the ground` : `wall gap ${f.width} m wide`;
  console.log(`${f.town ? 'TOWN ' : '     '}${head.padEnd(40)} ${f.place.padEnd(26)} ${f.what}`);
}
if (jsonAt && args.includes('--json')) writeFileSync(jsonAt, JSON.stringify(found, null, 1));
const town = found.filter(f => f.town).length;
console.log(town ? `${town} finding${town > 1 ? 's' : ''} in town structures` : 'town structures are clean');
process.exitCode = town ? 1 : 0;
