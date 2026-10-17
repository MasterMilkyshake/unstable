// Ground navigation for walking AI: a coarse walkability grid built lazily from the world's
// colliders and terrain, a straight-line walk check, and a budgeted A* for when that line is
// blocked. Every rule mirrors Actor.physics and Colliders.resolve, so a route the planner
// accepts is one a body can walk: colliders up to STEP above the feet are stepped onto, terrain
// steeper than SLOPE is a wall, and ground below the swim line is water.
//
// Work is metered by time per simulation step, so a fresh area or a long detour spreads over
// several steps instead of hitching one frame.
import { SWIM_Y } from './actor.js';
import { hypot } from '../core/util.js';

const CELL = 0.4; // m; narrow enough that a 1.0 m door always has a cell centre in its opening
const TILE = 16; // cells per tile side
const TILE_M = CELL * TILE;
const REACH = 1.1; // colliders this close to a cell centre are recorded with it (max pad + NEAR)
const NEAR = 0.25; // closer than pad + NEAR to a wall costs extra, so routes keep off walls
const STEP = 0.55; // Colliders.resolve stepUp
const STEP_DIAG = 0.62; // a diagonal cell crosses two 0.3 m risers
const SLOPE = 1.3; // terrain rise per metre that still walks (physics turns back at 1.35)
const DROP = 3.5; // deepest ledge a walker steps off on purpose
const WET = SWIM_Y - 0.6; // Enemy.canStepTo: deeper ground is water
const LEVEL = 1.2; // nodes in one column closer than this in height are the same place
const GREED = 1.5; // weighted A*: routes up to this much longer than the best, found far sooner
const SPAN = 400; // cells a search may stray from its start on either axis
// nodes one search may expand in all before settling for a partial route. 9000 fell just short of
// the Red Trail's climb into Brigand Hold (9,351 from the trail, round the palisade to the gate);
// NAV_BUDGET still meters the work a step.
const SEARCH_MAX = 24000;
const MIN_EXPAND = 32; // a search always gets this many nodes a step, so it finishes on a slow machine

// Milliseconds of navigation work per simulation step, across every walker.
export const NAV_BUDGET = { ms: 1 };

const grids = new WeakMap();

// The grid for a world, rebuilt whenever its colliders change (frost walls, dungeon gates).
// `stamp` (simulation time) starts a fresh per-step budget when it changes; without one the
// budget is unlimited, for tools and tests.
export function navGrid(world, stamp) {
  let g = grids.get(world.colliders);
  if (!g) grids.set(world.colliders, (g = new NavGrid(world)));
  if (g.version !== world.colliders.version) g.reset();
  g.limited = stamp !== undefined;
  if (g.limited && stamp !== g.stamp) {
    g.stamp = stamp;
    g.spent = 0;
    g.tilesThisStep = 0;
  }
  return g;
}

// The body a route must fit: half the radius as clearance (physics slides the rest past
// corners and door jambs, as Colliders.groundAt pads by radius * 0.5).
export function navBody(actor) {
  return { pad: Math.min(0.8, Math.max(0.2, actor.radius * 0.5)), height: actor.height || 1.8 };
}

let near = false; // set by NavGrid.step: the last cell accepted lies close to a wall

class NavGrid {
  constructor(world) {
    this.world = world;
    this.tiles = new Map();
    this.version = world.colliders.version;
    this.built = 0; // tiles built so far
    this.starved = false; // a tile was needed but this step's budget was spent
    this.stamp = undefined;
    this.limited = false;
    this.spent = 0; // ms of this step's budget used
    this.tilesThisStep = 0;
    this.depth = 0;
    this.t0 = 0;
  }

  // Time accounting: begin/end bracket a piece of work (nested calls count once).
  begin() {
    if (this.depth++ === 0) this.t0 = performance.now();
  }
  end() {
    if (--this.depth === 0) this.spent += performance.now() - this.t0;
  }
  over() {
    return this.limited && this.spent + (this.depth ? performance.now() - this.t0 : 0) >= NAV_BUDGET.ms;
  }

  reset() {
    this.tiles.clear();
    this.version = this.world.colliders.version;
  }

  tile(tx, tz) {
    const key = tx * 65536 + tz;
    let t = this.tiles.get(key);
    if (!t) {
      // one tile a step always, so a slow machine still gets there
      if (this.tilesThisStep > 0 && this.over()) {
        this.starved = true;
        return null;
      }
      this.tilesThisStep++;
      if (this.tiles.size > 4000) this.tiles.clear();
      this.tiles.set(key, (t = this.buildTile(tx, tz)));
    }
    return t;
  }

  // Terrain height at every cell centre, and the colliders within REACH of it with their
  // footprint distance, so evaluating a cell is a short loop over a few boxes.
  buildTile(tx, tz) {
    const { terrain, colliders } = this.world;
    const x0 = tx * TILE_M;
    const z0 = tz * TILE_M;
    const th = new Float32Array(TILE * TILE);
    const refs = new Array(TILE * TILE).fill(null);
    for (let j = 0; j < TILE; j++) {
      for (let i = 0; i < TILE; i++) th[j * TILE + i] = terrain.heightAt(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL);
    }
    const half = TILE_M / 2;
    for (const c of colliders.query(x0 + half, z0 + half, half * Math.SQRT2 + REACH, [])) {
      const r = c.br + REACH;
      const i0 = Math.max(0, Math.floor((c.x - r - x0) / CELL));
      const i1 = Math.min(TILE - 1, Math.floor((c.x + r - x0) / CELL));
      const j0 = Math.max(0, Math.floor((c.z - r - z0) / CELL));
      const j1 = Math.min(TILE - 1, Math.floor((c.z + r - z0) / CELL));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = footprintDist(c, x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL);
          if (d > REACH) continue;
          const k = j * TILE + i;
          (refs[k] || (refs[k] = [])).push(c, d);
        }
      }
    }
    this.built++;
    return { th, refs };
  }

  // Ground height a body reaches stepping into cell (ix, iz) from height fromY over `len`
  // metres, or NaN when a wall, cliff, drop or water stops it (or its tile is not built yet:
  // see `starved`). Sets `near`.
  step(ix, iz, fromY, len, body) {
    const tx = Math.floor(ix / TILE);
    const tz = Math.floor(iz / TILE);
    const t = this.tile(tx, tz);
    if (!t) return NaN;
    const k = (iz - tz * TILE) * TILE + (ix - tx * TILE);
    const th = t.th[k];
    const refs = t.refs[k];
    const stepUp = len > CELL * 1.2 ? STEP_DIAG : STEP;
    let col = -Infinity;
    if (refs) {
      for (let n = 0; n < refs.length; n += 2) {
        const c = refs[n];
        if (c.walkable && refs[n + 1] <= body.pad && c.y1 <= fromY + stepUp && c.y1 > col) col = c.y1;
      }
    }
    if (th >= col && th - fromY > SLOPE * len + 0.05) return NaN;
    const ground = th > col ? th : col;
    if (ground < WET || ground < fromY - DROP) return NaN;
    near = false;
    if (refs) {
      const head = ground + body.height;
      for (let n = 0; n < refs.length; n += 2) {
        const c = refs[n];
        if (head <= c.y0 || ground >= c.y1 - 0.02) continue;
        if (c.walkable && c.y1 - ground <= STEP) continue;
        const d = refs[n + 1];
        if (d <= body.pad) return NaN;
        if (d <= body.pad + NEAR) near = true;
      }
    }
    return ground;
  }

  // Can a body walk straight from (ax, ay, az) to (bx, bz)? true, false, or null when this
  // step's tile budget ran out before the answer was known. Visits every cell the segment
  // crosses; where it crosses a cell corner both side cells must be open, so a thin wall lying
  // along that corner still blocks.
  walkLine(ax, az, ay, bx, bz, body) {
    this.begin();
    try {
      return this.walkLineInner(ax, az, ay, bx, bz, body);
    } finally {
      this.end();
    }
  }
  walkLineInner(ax, az, ay, bx, bz, body) {
    this.starved = false;
    const dx = bx - ax;
    const dz = bz - az;
    const len = hypot(dx, dz);
    let ix = Math.floor(ax / CELL);
    let iz = Math.floor(az / CELL);
    let y = ay;
    const n = Math.ceil(len / (CELL * 0.5));
    for (let s = 1; s <= n; s++) {
      const jx = Math.floor((ax + (dx * s) / n) / CELL);
      const jz = Math.floor((az + (dz * s) / n) / CELL);
      if (jx === ix && jz === iz) continue;
      if (jx !== ix && jz !== iz) {
        if (Number.isNaN(this.step(jx, iz, y, CELL, body)) || Number.isNaN(this.step(ix, jz, y, CELL, body))) return this.starved ? null : false;
      }
      const g = this.step(jx, jz, y, hypot(jx - ix, jz - iz) * CELL, body);
      if (Number.isNaN(g)) return this.starved ? null : false;
      y = g;
      ix = jx;
      iz = jz;
    }
    return true;
  }

  // A whole search at once (unlimited budget unless the grid was stamped).
  findPath(ax, az, ay, bx, bz, by, body, maxExpand = SEARCH_MAX) {
    const s = new PathSearch(this, ax, az, ay, bx, bz, by, body, maxExpand);
    return s.run() ? s.result : null;
  }
}

// A* over cells from (ax, ay, az) toward (bx, by, bz), resumable: run() spends what is left of
// the grid's per-step budget and returns true once `result` is set. `by` NaN accepts the goal
// cell at any height (a patrol point with no height of its own). The result is
// { points: [[x, y, z]...], complete, expanded } with straight runs merged, or null when
// nothing beyond the start is reachable. An incomplete route ends at the explored cell
// nearest the goal. `avoid` lists [x, z, r] discs to treat as walls (where a walker got stuck).
export class PathSearch {
  constructor(grid, ax, az, ay, bx, bz, by, body, maxExpand = SEARCH_MAX, avoid = null) {
    this.grid = grid;
    this.body = body;
    this.avoid = avoid && avoid.length ? avoid : null;
    this.by = by;
    this.gx = Math.floor(bx / CELL);
    this.gz = Math.floor(bz / CELL);
    this.sx = Math.floor(ax / CELL);
    this.sz = Math.floor(az / CELL);
    this.goal = [bx, bz];
    this.maxExpand = maxExpand;
    this.index = new Map();
    this.X = [];
    this.Z = [];
    this.Y = [];
    this.G = [];
    this.P = [];
    this.closed = [];
    this.heap = new Heap();
    this.expanded = 0;
    this.found = -1;
    this.best = 0;
    this.result = undefined;
    this.add(this.sx, this.sz, ay, 0, -1);
    this.bestH = this.h(this.sx, this.sz);
  }

  h(ix, iz) {
    const ddx = Math.abs(ix - this.gx);
    const ddz = Math.abs(iz - this.gz);
    return (Math.max(ddx, ddz) + 0.4142 * Math.min(ddx, ddz)) * CELL * GREED;
  }

  add(ix, iz, y, g, parent) {
    const ox = ix - this.sx + SPAN;
    const oz = iz - this.sz + SPAN;
    if (ox < 0 || oz < 0 || ox >= SPAN * 2 || oz >= SPAN * 2) return;
    if (this.avoid && parent >= 0) {
      const x = (ix + 0.5) * CELL;
      const z = (iz + 0.5) * CELL;
      for (const a of this.avoid) if (hypot(x - a[0], z - a[1]) < a[2]) return;
    }
    // a small-integer key: cell offset from the start, then height level
    const key = ((Math.round(y / LEVEL) & 255) * SPAN * 2 + ox) * SPAN * 2 + oz;
    let id = this.index.get(key);
    if (id === undefined) {
      id = this.X.length;
      this.index.set(key, id);
      this.X.push(ix);
      this.Z.push(iz);
      this.Y.push(y);
      this.G.push(g);
      this.P.push(parent);
      this.closed.push(false);
    } else if (this.closed[id] || g >= this.G[id]) return;
    else {
      this.G[id] = g;
      this.P[id] = parent;
      this.Y[id] = y;
    }
    this.heap.push(id, g + this.h(ix, iz));
  }

  run() {
    if (this.result !== undefined) return true;
    this.grid.begin();
    try {
      return this.runInner();
    } finally {
      this.grid.end();
    }
  }
  runInner() {
    const grid = this.grid;
    const { X, Z, Y, G, closed, heap, body } = this;
    const open = [false, false, false, false];
    const anyHeight = Number.isNaN(this.by);
    grid.starved = false;
    let n = 0;
    while (heap.size && this.expanded < this.maxExpand) {
      if (++n > MIN_EXPAND && (n & 15) === 0 && grid.over()) return false;
      const id = heap.pop();
      if (closed[id]) continue;
      const ix = X[id];
      const iz = Z[id];
      const y = Y[id];
      if (Math.abs(ix - this.gx) <= 1 && Math.abs(iz - this.gz) <= 1 && (anyHeight || Math.abs(y - this.by) < LEVEL * 1.5)) {
        this.found = id;
        break;
      }
      const g0 = G[id];
      for (let d = 0; d < 4; d++) {
        const g = grid.step(ix + DIRS[d][0], iz + DIRS[d][1], y, CELL, body);
        open[d] = !Number.isNaN(g);
        if (open[d]) this.add(ix + DIRS[d][0], iz + DIRS[d][1], g, g0 + CELL + (near ? 0.35 : 0) + Math.max(0, g - y) * 0.5, id);
      }
      for (let d = 4; d < 8; d++) {
        // no cutting a corner past a blocked side cell
        if (!open[DIAG_SIDES[d - 4][0]] || !open[DIAG_SIDES[d - 4][1]]) continue;
        const g = grid.step(ix + DIRS[d][0], iz + DIRS[d][1], y, CELL * Math.SQRT2, body);
        if (!Number.isNaN(g)) this.add(ix + DIRS[d][0], iz + DIRS[d][1], g, g0 + CELL * Math.SQRT2 + (near ? 0.35 : 0) + Math.max(0, g - y) * 0.5, id);
      }
      if (grid.starved) {
        // a neighbour's tile is not built yet: expand this node again next step
        heap.push(id, g0 + this.h(ix, iz));
        return false;
      }
      closed[id] = true;
      this.expanded++;
      const hh = this.h(ix, iz);
      if (hh < this.bestH) {
        this.bestH = hh;
        this.best = id;
      }
    }
    this.result = this.finish();
    return true;
  }

  finish() {
    const { X, Z, Y, P } = this;
    const end = this.found >= 0 ? this.found : this.best;
    if (end === 0 && this.found < 0) return null;
    const cells = [];
    for (let id = end; id > 0; id = P[id]) cells.push(id);
    cells.reverse();
    // merge straight runs into their end points
    const points = [];
    for (let n = 0; n < cells.length; n++) {
      const id = cells[n];
      const next = cells[n + 1];
      if (next !== undefined) {
        const prev = n > 0 ? cells[n - 1] : 0;
        if (X[id] - X[prev] === X[next] - X[id] && Z[id] - Z[prev] === Z[next] - Z[id]) continue;
      }
      points.push([(X[id] + 0.5) * CELL, Y[id], (Z[id] + 0.5) * CELL]);
    }
    return { points, complete: this.found >= 0, expanded: this.expanded };
  }
}

// Does the segment (ax, az)-(bx, bz) pass through any [x, z, r] disc?
export function crossesAvoid(ax, az, bx, bz, avoid) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  for (const a of avoid) {
    const t = Math.max(0, Math.min(1, ((a[0] - ax) * dx + (a[1] - az) * dz) / l2));
    if (hypot(ax + dx * t - a[0], az + dz * t - a[1]) < a[2]) return true;
  }
  return false;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIAG_SIDES = [[0, 2], [0, 3], [1, 2], [1, 3]];

function footprintDist(c, x, z) {
  if (c.kind === 'cyl') return Math.max(0, hypot(x - c.x, z - c.z) - c.r);
  const dx = x - c.x;
  const dz = z - c.z;
  const lx = dx * c.cos - dz * c.sin;
  const lz = dx * c.sin + dz * c.cos;
  return hypot(Math.max(0, Math.abs(lx) - c.hw), Math.max(0, Math.abs(lz) - c.hd));
}

// Binary min-heap of node ids by priority.
class Heap {
  constructor() {
    this.ids = [];
    this.pri = [];
  }
  get size() {
    return this.ids.length;
  }
  push(id, p) {
    const { ids, pri } = this;
    let i = ids.length;
    ids.push(id);
    pri.push(p);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (pri[up] <= p) break;
      ids[i] = ids[up];
      pri[i] = pri[up];
      i = up;
    }
    ids[i] = id;
    pri[i] = p;
  }
  pop() {
    const { ids, pri } = this;
    const top = ids[0];
    const lastId = ids.pop();
    const lastP = pri.pop();
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pri[c + 1] < pri[c]) c++;
        if (pri[c] >= lastP) break;
        ids[i] = ids[c];
        pri[i] = pri[c];
        i = c;
      }
      ids[i] = lastId;
      pri[i] = lastP;
    }
    return top;
  }
}
