// Static collision: oriented boxes (rotation about Y) and vertical cylinders,
// stored in a uniform spatial hash.
import { hypot } from '../core/util.js';

export class Colliders {
  constructor(cell = 24) {
    this.cell = cell;
    this.grid = new Map();
    this.stamp = 0;
    this.all = new Set();
    this.version = 0; // bumped on every add/remove, so cached navigation grids know to rebuild
  }

  _key(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }

  _insert(c) {
    const r = c.br;
    const x0 = Math.floor((c.x - r) / this.cell);
    const x1 = Math.floor((c.x + r) / this.cell);
    const z0 = Math.floor((c.z - r) / this.cell);
    const z1 = Math.floor((c.z + r) / this.cell);
    c.cells = [];
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this._key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(c);
        c.cells.push(k);
      }
    }
    c._stamp = -1;
    this.all.add(c);
    this.version++;
    return c;
  }

  addBox({ x, z, w, d, y0, y1, rot = 0, climbable = true, tag = null, walkable = true }) {
    return this._insert({
      kind: 'box', x, z, hw: w / 2, hd: d / 2, y0, y1, rot,
      cos: Math.cos(rot), sin: Math.sin(rot), br: Math.hypot(w / 2, d / 2), climbable, tag, walkable,
    });
  }

  addCyl({ x, z, r, y0, y1, climbable = false, tag = null }) {
    return this._insert({ kind: 'cyl', x, z, r, y0, y1, br: r, climbable, tag, walkable: true });
  }

  remove(c) {
    if (!c || !c.cells) return;
    for (const k of c.cells) {
      const arr = this.grid.get(k);
      if (!arr) continue;
      const i = arr.indexOf(c);
      if (i >= 0) arr.splice(i, 1);
    }
    c.cells = null;
    this.all.delete(c);
    this.version++;
  }

  query(x, z, r, out = []) {
    out.length = this._gather(x, z, r, out);
    return out;
  }

  // The colliders near (x, z) into `buf`, returning how many. The frame loop's queries share
  // scratch lists that are never shortened, so they keep their storage between calls.
  _gather(x, z, r, buf) {
    let n = 0;
    this.stamp++;
    const x0 = Math.floor((x - r) / this.cell);
    const x1 = Math.floor((x + r) / this.cell);
    const z0 = Math.floor((z - r) / this.cell);
    const z1 = Math.floor((z + r) / this.cell);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const arr = this.grid.get(this._key(ix, iz));
        if (!arr) continue;
        for (const c of arr) {
          if (c._stamp === this.stamp) continue;
          c._stamp = this.stamp;
          buf[n++] = c;
        }
      }
    }
    return n;
  }

  _local(c, px, pz) {
    const dx = px - c.x;
    const dz = pz - c.z;
    return [dx * c.cos - dz * c.sin, dx * c.sin + dz * c.cos];
  }
  _world(c, lx, lz) {
    // local direction -> world direction
    return [lx * c.cos + lz * c.sin, -lx * c.sin + lz * c.cos];
  }

  // Highest walkable top under point (x,z) not higher than maxY.
  groundAt(x, z, maxY, radius = 0) {
    let best = -Infinity;
    const n = this._gather(x, z, radius + 0.1, _q);
    for (let i = 0; i < n; i++) {
      const c = _q[i];
      if (!c.walkable || c.y1 > maxY) continue;
      if (c.kind === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) <= c.hw + radius * 0.5 && Math.abs(lz) <= c.hd + radius * 0.5) best = Math.max(best, c.y1);
      } else {
        if (hypot(x - c.x, z - c.z) <= c.r + radius * 0.5) best = Math.max(best, c.y1);
      }
    }
    return best;
  }

  // Highest top of anything standing over (x, z), or -Infinity: what covers that column.
  topAt(x, z) {
    let best = -Infinity;
    const n = this._gather(x, z, 0.05, _q);
    for (let i = 0; i < n; i++) {
      const c = _q[i];
      if (c.y1 <= best) continue;
      if (c.kind === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) best = c.y1;
      } else if (hypot(x - c.x, z - c.z) <= c.r) best = c.y1;
    }
    return best;
  }

  // Ceiling: lowest bottom above headY at (x,z)
  ceilingAt(x, z, footY, headY) {
    let best = Infinity;
    const n = this._gather(x, z, 0.1, _q);
    for (let i = 0; i < n; i++) {
      const c = _q[i];
      if (c.y0 < footY + 0.3 || c.y0 > headY + 0.5) continue;
      if (c.kind === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) best = Math.min(best, c.y0);
      }
    }
    return best;
  }

  // Push a vertical capsule (circle in XZ spanning [footY, footY+height]) out of colliders.
  // Returns info about the most significant wall contact.
  resolve(pos, radius, height, stepUp = 0.55) {
    const info = { hit: false, nx: 0, nz: 0, climbable: false, top: 0 };
    const footY = pos.y;
    const headY = pos.y + height;
    const n = this._gather(pos.x, pos.z, radius + 0.5, _q2);
    for (let i = 0; i < n; i++) {
      const c = _q2[i];
      if (headY <= c.y0 || footY >= c.y1 - 0.02) continue;
      if (c.y1 - footY <= stepUp && c.walkable) continue; // step onto it instead
      if (c.kind === 'box') {
        const ox = pos.x - c.x, oz = pos.z - c.z;
        const lx = ox * c.cos - oz * c.sin, lz = ox * c.sin + oz * c.cos;
        const cx = Math.max(-c.hw, Math.min(c.hw, lx));
        const cz = Math.max(-c.hd, Math.min(c.hd, lz));
        let ddx = lx - cx;
        let ddz = lz - cz;
        let d = hypot(ddx, ddz);
        let push;
        if (d > 1e-5) {
          if (d >= radius) continue;
          push = radius - d;
          ddx /= d;
          ddz /= d;
        } else {
          // center inside: exit along the nearest face
          const ex = c.hw - Math.abs(lx);
          const ez = c.hd - Math.abs(lz);
          if (ex < ez) {
            ddx = Math.sign(lx) || 1;
            ddz = 0;
            push = ex + radius;
          } else {
            ddx = 0;
            ddz = Math.sign(lz) || 1;
            push = ez + radius;
          }
        }
        const wx = ddx * c.cos + ddz * c.sin, wz = -ddx * c.sin + ddz * c.cos;
        pos.x += wx * push;
        pos.z += wz * push;
        info.hit = true;
        info.nx = wx;
        info.nz = wz;
        info.climbable = info.climbable || c.climbable;
        info.top = Math.max(info.top, c.y1);
      } else {
        let dx = pos.x - c.x;
        let dz = pos.z - c.z;
        let d = hypot(dx, dz);
        const minD = radius + c.r;
        if (d >= minD) continue;
        if (d < 1e-5) {
          dx = 1;
          dz = 0;
          d = 1;
        }
        const push = minD - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
        info.hit = true;
        info.nx = dx / d;
        info.nz = dz / d;
        info.climbable = info.climbable || c.climbable;
        info.top = Math.max(info.top, c.y1);
      }
    }
    return info;
  }

  // Is there a collider occupying this point?
  pointInside(x, y, z) {
    const n = this._gather(x, z, 0.1, _q);
    for (let i = 0; i < n; i++) {
      const c = _q[i];
      if (y < c.y0 || y > c.y1) continue;
      if (c.kind === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) return c;
      } else if (hypot(x - c.x, z - c.z) <= c.r) return c;
    }
    return null;
  }

  // Ray vs colliders. Returns distance to the nearest hit or Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    const mx = ox + dx * maxDist * 0.5;
    const mz = oz + dz * maxDist * 0.5;
    const n = this._gather(mx, mz, maxDist * 0.5 + 1, _q);
    for (let i = 0; i < n; i++) {
      const c = _q[i];
      let t;
      if (c.kind === 'box') {
        const rx = ox - c.x, rz = oz - c.z;
        const lox = rx * c.cos - rz * c.sin, loz = rx * c.sin + rz * c.cos;
        const ldx = dx * c.cos - dz * c.sin;
        const ldz = dx * c.sin + dz * c.cos;
        t = slab(lox, oy, loz, ldx, dy, ldz, -c.hw, c.y0, -c.hd, c.hw, c.y1, c.hd);
      } else {
        t = slab(ox - c.x, oy, oz - c.z, dx, dy, dz, -c.r, c.y0, -c.r, c.r, c.y1, c.r);
      }
      if (t >= 0 && t < best) best = t;
    }
    return best;
  }
}

const _q = [];
const _q2 = [];

// Ray against an axis-aligned box: entry distance, 0 from inside, -1 for a miss. One axis at
// a time, x then y then z, in plain numbers (it runs for every collider a ray passes).
function slab(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let t1, t2, t;
  if (Math.abs(dx) < 1e-8) {
    if (ox < minx || ox > maxx) return -1;
  } else {
    t1 = (minx - ox) / dx;
    t2 = (maxx - ox) / dx;
    if (t1 > t2) { t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-8) {
    if (oy < miny || oy > maxy) return -1;
  } else {
    t1 = (miny - oy) / dy;
    t2 = (maxy - oy) / dy;
    if (t1 > t2) { t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-8) {
    if (oz < minz || oz > maxz) return -1;
  } else {
    t1 = (minz - oz) / dz;
    t2 = (maxz - oz) / dz;
    if (t1 > t2) { t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : 0;
}
