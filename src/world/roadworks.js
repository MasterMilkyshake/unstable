// Roadworks: where a way is carried above the land or cut down into it, the cut and the
// fill are built, not left raw. A causeway gets retaining walls with a parapet on every side
// that drops away; a cutting gets dressed stone facing on its walls, coped, with a lamp on a
// bracket every so often. Both follow the same samples as the road (world/paths.js).
import { Mason } from './mason.js';
import { samplePath } from './paths.js';
import { ROADS } from '../data/roads.js';
import { familyFor } from './style.js';
import { islandAtPoint, NPCS, CHESTS, STRUCTURES } from '../data/world.js';
import { LORE } from '../data/lore.js';

const STEP = 3.0;
const FILL = 1.2; // a drop beside the shoulder worth walling
const CUT = 2.4; // a rise beside the shoulder worth facing

function paletteAt(x, z) {
  if (x > 1000 && z < -480 && z > -820) return 'enclave';
  const fam = familyFor(islandAtPoint(x, z)?.island.id, x);
  return fam === 'ancient_frost' ? 'frost' : fam === 'ancient_ash' ? 'cinder' : fam === 'ancient_thorn' ? 'redwake' : fam === 'ancient_fen' ? 'reed' : 'salt';
}

// The Signal Bridge's approaches are the bridge's own (world/meridianBridge.js).
const LEFT_TO_OTHERS = new Set(['meridian_bridge_east', 'meridian_bridge_west']);

export function buildRoadworks(world, exclusions, add, roads = ROADS) {
  const T = world.terrain;
  const built = [];
  // walls never close in on a record, a person, a chest or a fire
  const keep = [...LORE, ...NPCS, ...CHESTS, ...STRUCTURES.filter(s => s.id)].map(p => [p.x, p.z]);
  const crowded = (x, z, r) => keep.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < r * r);
  // where another way joins or crosses, the walls leave it open
  const ways = roads.map(r => ({ id: r.id, hw: r.width / 2 + 0.8, pts: samplePath(r, 1.5) }));
  const joined = (id, x, z) => ways.some(w => w.id !== id && w.pts.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < w.hw * w.hw));
  for (const road of roads) {
    if (LEFT_TO_OTHERS.has(road.id)) continue;
    const samples = samplePath(road, STEP);
    if (samples.length < 3) continue;
    const hw = road.cut ?? road.width / 2 + 1.6;
    const mid = samples[Math.floor(samples.length / 2)];
    const m = new Mason(world, { x: 0, z: 0, yaw: 0, y: 0, palette: paletteAt(mid.x, mid.z), tag: 'roadworks', name: `Roadworks: ${road.name || road.id}`, lights: 8 });
    let runs = 0, since = 0;
    const fill = road.fill ? buildFill(m, road, T, exclusions) : null;
    if (fill) runs++;
    // classify every sample on each side, then lay the wall between consecutive offset points
    // so its pieces share their ends; a pier stands at each joint and hides the mitre
    for (const side of [-1, 1]) {
      const pts = samples.map((p) => {
        const nl = Math.hypot(p.nx, p.nz) || 1, ox = p.nx / nl * side, oz = p.nz / nl * side;
        const h0 = T.heightAt(p.x, p.z);
        const g = Math.min(T.heightAt(p.x + ox * (hw + 0.6), p.z + oz * (hw + 0.6)), T.heightAt(p.x + ox * (hw + 1.6), p.z + oz * (hw + 1.6)));
        // where built ground carries on beside the road, the road keeps no wall of its own
        const filled = fill && inside(fill, p.x + ox * (hw + 0.6), p.z + oz * (hw + 0.6));
        const off0 = hw - 0.45, open = joined(road.id, p.x + ox * off0, p.z + oz * off0);
        const kind = h0 < 0.5 || filled || open ? null : g < h0 - FILL ? 'fill' : g > h0 + CUT ? 'cut' : null;
        const off = kind === 'cut' ? hw - 0.75 : hw - 0.45;
        return { x: p.x + ox * off, z: p.z + oz * off, ox, oz, h0, g, kind, cx: p.x, cz: p.z };
      });
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (!a.kind || a.kind !== b.kind) continue;
        const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.2 || crowded(x, z, 3)) continue;
        const ry = Math.atan2(b.x - a.x, b.z - a.z), h0 = Math.min(a.h0, b.h0), h1 = Math.max(a.h0, b.h0);
        since += len;
        if (a.kind === 'fill') {
          const base = Math.min(a.g, b.g) - 0.8;
          // a graded road's cut can be narrower than its walls: the shoulder between is built up,
          // laid between the two samples' own shoulder points so its pieces share their ends too
          const so = road.width / 2 + 0.2, sax = a.cx + a.ox * so, saz = a.cz + a.oz * so, sbx = b.cx + b.ox * so, sbz = b.cz + b.oz * so;
          const sx = (sax + sbx) / 2, sz = (saz + sbz) / 2;
          if (road.graded && T.heightAt(sx, sz) < (h0 + h1) / 2 - 0.3) {
            m.mass(sx, base, sz, 1.05, (h0 + h1) / 2 - base, Math.hypot(sbx - sax, sbz - saz) + 0.04, { ry: Math.atan2(sbx - sax, sbz - saz), c: 'stone2', c2: 'stone', course: 1.2 });
          }
          m.mass(x, base, z, 0.9, h1 - base, len + 0.04, { ry, c: 'stone', c2: 'stone2', course: 1.2 });
          m.block(x, h1 - 0.05, z, 0.7, 1.05, len + 0.04, 'stone2', { ry, walkable: false });
          m.trim(x, h1 + 1.0, z, 0.85, 0.12, len + 0.06, 'edge', { ry });
          // the pier at the joint ahead, rising a course over the parapet
          m.block(b.x, base, b.z, 1.2, h1 - base + 1.25, 1.2, 'stone', { ry, walkable: false });
          m.trim(b.x, h1 + 1.25, b.z, 1.4, 0.18, 1.4, 'edge', { ry });
        } else {
          const top = Math.min(Math.min(a.g, b.g), h0 + 14) + 0.3, step = Math.min(top - h0, 3.6);
          m.mass(x, h0 - 0.6, z, 1.5, step + 0.6, len + 0.04, { ry, c: 'stone2', c2: 'stone', course: 1.2 });
          m.trim(x, h0 + step, z, 1.6, 0.16, len + 0.06, 'edge', { ry });
          if (top > h0 + step + 0.3) {
            // set back along each sample's own normal, so round a bend the pieces meet end to end
            const uax = a.x + a.ox * 0.45, uaz = a.z + a.oz * 0.45, ubx = b.x + b.ox * 0.45, ubz = b.z + b.oz * 0.45;
            const ux = (uax + ubx) / 2, uz = (uaz + ubz) / 2, ulen = Math.hypot(ubx - uax, ubz - uaz), ury = Math.atan2(ubx - uax, ubz - uaz);
            m.mass(ux, h0 + step, uz, 0.6, top - h0 - step, ulen + 0.04, { ry: ury, c: 'stone', c2: 'stone2', course: 1.2 });
            m.trim(ux, top, uz, 0.9, 0.18, ulen + 0.06, 'edge', { ry: ury });
          }
          m.block(b.x - b.ox * 0.2, h0 - 0.6, b.z - b.oz * 0.2, 1.0, step + 1.2, 1.0, 'stone', { ry, walkable: false });
          if (since > 16 && side > 0) {
            since = 0;
            m.lantern(x - a.ox * 0.95, h0 + step - 0.9, z - a.oz * 0.95, { post: 0, intensity: 1, priority: 0.7 });
          }
        }
        runs++;
      }
    }
    if (runs) {
      add(m.build());
      built.push({ road: road.id, pieces: runs });
    }
  }
  world.roadworks = built;
  return built;
}

function edgeDistance(path, x, z) {
  let d = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return d;
}

function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[j];
    if ((az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az)) c = !c;
  }
  return c;
}

// Built ground on the inside of a bend (road.fill): the road from one end of the outline to the
// other closes it. The hollow inside is raised in coursed blocks, each paved level with the
// road beside it, so they step up with the grade; a parapet with a pier at every joint runs
// along each side of the outline that drops away. Returns the closed outline.
const CELL = 1.25;
function buildFill(m, road, T, exclusions) {
  const line = samplePath(road, 1);
  const near = ([x, z]) => {
    let best = 0, d = Infinity;
    line.forEach((p, i) => { const e = (p.x - x) ** 2 + (p.z - z) ** 2; if (e < d) { d = e; best = i; } });
    return best;
  };
  const out = road.fill, i0 = near(out[0]), i1 = near(out.at(-1));
  const back = (i0 <= i1 ? line.slice(i0, i1 + 1).reverse() : line.slice(i1, i0 + 1)).map(p => [p.x, p.z]);
  const poly = [...back, ...out];
  // a cell is paved at the road's grade where it stands nearest the road
  const grade = (x, z) => {
    let best = null, d = Infinity;
    for (const p of line) { const e = (p.x - x) ** 2 + (p.z - z) ** 2; if (e < d) { d = e; best = p; } }
    return { y: best.height, d: Math.sqrt(d) };
  };
  // the cells run along the outline's longest side, so its face is laid square to the courses
  let ax = 0, az = 0, ry = 0, longest = 0;
  for (let i = 1; i < out.length; i++) {
    const [px, pz] = out[i - 1], [qx, qz] = out[i], l = Math.hypot(qx - px, qz - pz);
    if (l > longest) { longest = l; ax = px; az = pz; ry = Math.atan2(qx - px, qz - pz); }
  }
  const ux = Math.sin(ry), uz = Math.cos(ry), vx = uz, vz = -ux;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, z] of poly) {
    const u = (x - ax) * ux + (z - az) * uz, v = (x - ax) * vx + (z - az) * vz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  for (let u = u0 + CELL / 2; u < u1; u += CELL) for (let v = v0 + CELL / 2; v < v1; v += CELL) {
    const x = ax + ux * u + vx * v, z = az + uz * u + vz * v;
    // a cell the outline only grazes is laid too, so the parapet on the edge has ground under it
    if (!inside(poly, x, z) && edgeDistance(out, x, z) > 0.65) continue;
    const { y } = grade(x, z);
    let lo = Infinity;
    for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lo = Math.min(lo, T.heightAt(x + (ux * du + vx * dv) * CELL / 2, z + (uz * du + vz * dv) * CELL / 2));
    if (lo > y - 0.05) continue; // the road's own cut, already at its grade
    // ground at grade under its middle: the bank is already there, and a cell laid into it
    // would only show its low corner through the grass
    if (T.heightAt(x, z) > y - 0.1) continue;
    m.mass(x, lo - 0.8, z, CELL + 0.02, y - lo + 0.8, CELL + 0.02, { ry, c: 'stone', c2: 'stone2', course: 1.2 });
    m.trim(x, y - 0.05, z, CELL - 0.06, 0.06, CELL - 0.06, 'stone2', { ry, grad: 0 });
  }
  // the parapet: pieces of at most 2.6 m along the outline, on the edge, where it drops away
  for (let i = 1; i < out.length; i++) {
    const [px, pz] = out[i - 1], [qx, qz] = out[i], len = Math.hypot(qx - px, qz - pz), n = Math.max(1, Math.ceil(len / 2.6));
    let nx = (qz - pz) / len, nz = -(qx - px) / len;
    if (inside(poly, (px + qx) / 2 + nx * 0.5, (pz + qz) / 2 + nz * 0.5)) { nx = -nx; nz = -nz; }
    const pry = Math.atan2(qx - px, qz - pz);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = px + (qx - px) * t - nx * 0.35, z = pz + (qz - pz) * t - nz * 0.35;
      const { y } = grade(x, z);
      if (T.heightAt(x + nx * 1.4, z + nz * 1.4) > y - FILL) continue;
      m.block(x, y - 0.05, z, 0.7, 1.05, len / n + 0.04, 'stone2', { ry: pry, walkable: false });
      m.trim(x, y + 1.0, z, 0.85, 0.12, len / n + 0.06, 'edge', { ry: pry });
      const ex = px + (qx - px) * (j + 1) / n - nx * 0.35, ez = pz + (qz - pz) * (j + 1) / n - nz * 0.35;
      m.block(ex, y - 0.05, ez, 1.2, 1.3, 1.2, 'stone', { ry: pry, walkable: false });
      m.trim(ex, y + 1.25, ez, 1.4, 0.18, 1.4, 'edge', { ry: pry });
      if (j === 0 && i === 1) {
        const sx = px - nx * 0.35, sz = pz - nz * 0.35;
        m.block(sx, y - 0.05, sz, 1.2, 1.3, 1.2, 'stone', { ry: pry, walkable: false });
        m.trim(sx, y + 1.25, sz, 1.4, 0.18, 1.4, 'edge', { ry: pry });
      }
    }
  }
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  exclusions?.push({ x: cx, z: cz, r: Math.max(u1 - u0, v1 - v0) / 2 + 2 });
  return poly;
}
