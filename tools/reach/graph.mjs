// The ledge reach graph: where a character can stand, and what it takes to get there.
//
// The ground is sampled on a 0.5 m grid with every level a body can stand on in each cell (the
// terrain, and the top of every walkable collider with room above it). From each standing
// place the graph steps to its neighbours by the player's own rules (entities/actor.js
// physics): up a collider step of 0.55 m, up terrain no steeper than 1.35, down anything, with
// falls over SAFE_FALL refused; over gaps by a running jump; through water by swimming, which
// has no limit. Where a wall stops the walk, the climb up it is simulated frame by frame with
// the player's own probes (Player.probeLedge and Player.probeWall, ADR-007) and the real
// derived stats (data/stats.js computeDerived): the jump, a wall hop at each apex while
// latches last, the catch of an edge in reach, the hang, the leap from it and the next catch
// mid-leap. Each climb costs the latches it spent, and landing restores them, so a route's
// cost is the most latches any one climb on it needs (a minimax search). Carrier lines and
// lifts are edges of their own.
//
// The jump speeds and hang depth below mirror entities/player.js; tests/ledge-reach.test.js
// checks this model against the real controller on known walls, so a drift shows there.
import * as THREE from 'three';
import { G } from '../../src/core/globals.js';
import { Player } from '../../src/entities/player.js';
import { GRAVITY, SWIM_Y } from '../../src/entities/actor.js';
import { computeDerived } from '../../src/data/stats.js';

export const CELL = 0.5;
const BODY_R = 0.42;
const BODY_H = 1.8;
const STEP = 0.55; // a walkable collider this much above the feet is stepped onto
const SLOPE = 1.35; // terrain steeper than this is a wall (Actor.physics)
const DEEP = SWIM_Y - 0.5; // ground below this is swum over
const JUMP_V = 9.2; // Player.update: a jump from the ground
const SWIM_JUMP_V = 6.5; // and out of the water
const DOUBLE_V = 8.5; // the Acrobat's and Sky Dancer's second jump
const HANG = 1.95; // the feet hang this far below a caught edge
const VAULT = HANG + 0.05; // an edge closer than this above the floor is pulled straight over
export const SAFE_FALL = 20; // (fall - 9) x 6 HP: a fresh character survives this at full health
const DT = 1 / 30;
const MAX_L = 9; // the most latches any build reaches (3 + 2 from Agility + 4 from talents)
const REACH_CAP = 12.5; // no build catches an edge higher than this over a sheer face
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// A climbing build: how many latches, and the Agility that sets the hop and the leap.
export function profile(latches, agility, doubleJump = false) {
  const attrs = new Proxy({ agility }, { get: (o, k) => o[k] ?? 0 });
  const base = computeDerived(attrs, 1, {});
  const d = computeDerived(attrs, 1, { latches: latches - base.latches });
  return { latches: d.latches, hop: d.wallHop, leap: d.latchLeap, doubleJump, agility, key: `L${d.latches}A${agility}${doubleJump ? 'D' : ''}` };
}

// The builds the reach tables are made for. Three latches is a fresh character at the most
// Agility that still gives three (34), the most generous such build; four is Agility 35; five
// is Agility 70 with the Acrobat's double jump (Agility 40).
export const PROFILES = { 3: profile(3, 34), 4: profile(4, 35), 5: profile(5, 70, true) };

// ---------------------------------------------------------------- the climb, frame by frame
// A body against a wall, for the player's probes: its feet at `y`, facing `yaw`.
const body = { pos: new THREE.Vector3(), yaw: 0, radius: BODY_R, height: BODY_H, ledgeWallD: NaN };
const probeLedge = () => Player.prototype.probeLedge.call(body);
const probeWall = () => Player.prototype.probeWall.call(body);

// Climb from feet height `y0` at (x, z) facing `yaw`, already up against the wall. Returns every
// edge caught on the way up as { top, L } (latches spent so far), highest last. `v0` is the
// jump's speed (from the ground or out of the water). It spends at most `maxL` latches (two more
// than the build has, so a route a little out of reach still shows how far out), and stops once
// the feet are over `ceiling`, the highest level in front.
export function climbColumn(x, z, yaw, y0, prof, v0 = JUMP_V, floorY = y0, maxL = Math.min(MAX_L, prof.latches + 2), ceiling = Infinity) {
  body.pos.set(x, y0, z);
  body.yaw = yaw;
  const out = [];
  let y = y0, v = v0, latches = 0, apexDone = false, dj = prof.doubleJump, floor = floorY;
  for (let f = 0; f < 240; f++) {
    if (y > ceiling) break;
    // at the top of a rise, jump again: the double jump first (off the wall, on the way in),
    // else a hop up the wall while latches last
    if (v <= 0 && !apexDone) {
      apexDone = true;
      body.pos.y = y;
      if (dj) {
        dj = false;
        v = DOUBLE_V;
        apexDone = false;
      } else if (latches < maxL && probeWall()) {
        latches++;
        v = prof.hop;
        apexDone = false;
      }
    }
    // the hands catch an edge in reach, unless the rise carries the feet over it anyway
    if (latches < maxL && v >= -10) {
      body.pos.y = y;
      const top = probeLedge();
      if (top > -Infinity) {
        const apex = y + (v > 0 ? (v * v) / (2 * GRAVITY) : 0);
        if (apex <= top + 0.1) {
          latches++;
          out.push({ top, L: latches });
          if (top - floor < VAULT) return out; // pulled straight over
          // hang, then leap; the next edge up may be caught mid-leap
          y = top - HANG;
          v = prof.leap;
          floor = y;
          apexDone = false;
          continue;
        }
      }
    }
    v -= GRAVITY * DT;
    y += v * DT;
    if (v < 0 && y < floor) break;
  }
  return out;
}

// ---------------------------------------------------------------- the stand grid
// One grid per landmass. Cells hold their standing levels (nodes), lowest first.
export class ReachGrid {
  constructor(world, box, name = '') {
    this.world = world;
    this.name = name;
    this.x0 = Math.floor(box.x0 / CELL) * CELL;
    this.z0 = Math.floor(box.z0 / CELL) * CELL;
    this.nx = Math.ceil((box.x1 - this.x0) / CELL);
    this.nz = Math.ceil((box.z1 - this.z0) / CELL);
    this.build();
  }

  cx(i) { return this.x0 + (i + 0.5) * CELL; }
  cz(j) { return this.z0 + (j + 0.5) * CELL; }
  cellOf(x, z) {
    const i = Math.floor((x - this.x0) / CELL), j = Math.floor((z - this.z0) / CELL);
    return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i;
  }

  build() {
    const { nx, nz, world } = this;
    const T = world.terrain;
    const n = nx * nz;
    const terrain = (this.terrain = new Float32Array(n));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) terrain[j * nx + i] = T.heightAt(this.cx(i), this.cz(j));
    // colliders into the cells: exact footprints give tops and solids, footprints grown by the
    // body's radius give what keeps a body's centre out
    const solids = new Map(); // cell -> [y0, y1, walkable, ...]
    const blocks = new Map();
    const tops = new Map();
    const add = (m, k, ...v) => { let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(...v); };
    const inside = (c, x, z, grow) => {
      if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) <= c.r + grow;
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      return Math.abs(lx) <= c.hw + grow && Math.abs(lz) <= c.hd + grow;
    };
    for (const c of world.colliders.all) {
      if (!(c.y1 > c.y0)) continue;
      const r = c.br + BODY_R;
      const i0 = Math.max(0, Math.floor((c.x - r - this.x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((c.x + r - this.x0) / CELL));
      const j0 = Math.max(0, Math.floor((c.z - r - this.z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((c.z + r - this.z0) / CELL));
      if (i0 > i1 || j0 > j1) continue;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = this.cx(i), z = this.cz(j), k = j * nx + i;
          if (!inside(c, x, z, BODY_R)) continue;
          add(blocks, k, c.y0, c.y1, c.walkable ? 1 : 0);
          // a body stands on the highest walkable top within half its radius (Actor.physics,
          // Colliders.groundAt), so a stair's next step carries it before the one after blocks
          if (c.walkable && inside(c, x, z, BODY_R * 0.5)) add(tops, k, c.y1);
          if (inside(c, x, z, 0)) add(solids, k, c.y0, c.y1);
        }
      }
    }
    // the standing levels of each cell
    const start = (this.start = new Int32Array(n + 1));
    const ys = [];
    const flags = [];
    const free = (k, y) => {
      const s = solids.get(k);
      if (s) for (let q = 0; q < s.length; q += 2) if (s[q] < y + BODY_H - 0.05 && s[q + 1] > y + 0.05) return false;
      const b = blocks.get(k);
      if (b) for (let q = 0; q < b.length; q += 3) if (b[q] < y + BODY_H - 0.05 && b[q + 1] > y + (b[q + 2] ? STEP : 0.02)) return false;
      return true;
    };
    for (let k = 0; k < n; k++) {
      start[k] = ys.length;
      const t = terrain[k];
      const cand = [];
      if (t < DEEP) cand.push([SWIM_Y, 2]); // swum
      else cand.push([t, 1]); // the ground
      for (const y of tops.get(k) || []) if (y > t + 0.05 && y > SWIM_Y) cand.push([y, 0]);
      cand.sort((a, b) => a[0] - b[0]);
      let last = -Infinity;
      for (const [y, f] of cand) {
        if (y - last < 0.1) continue;
        if (!free(k, y)) continue;
        ys.push(y);
        flags.push(f);
        last = y;
      }
    }
    start[n] = ys.length;
    this.y = Float32Array.from(ys);
    this.flag = Uint8Array.from(flags); // 0 a collider top, 1 the terrain, 2 water
    this.cellOfNode = new Int32Array(ys.length);
    for (let k = 0; k < n; k++) for (let q = start[k]; q < start[k + 1]; q++) this.cellOfNode[q] = k;
    // blockers kept per cell for the walk's body test
    this.blocks = blocks;
    this.extra = new Map(); // node -> [[node, L], ...]: lines, lifts, the sea
    this.sims = 0;
    this.climbCache = new Map(); // profile key -> Map(node*8+dir -> [[node, L], ...])
  }

  get nodes() { return this.y.length; }

  // a body at feet height y moving into cell k: a wall there above the step?
  wallAt(k, y) {
    const b = this.blocks.get(k);
    if (b) for (let q = 0; q < b.length; q += 3) if (b[q] < y + BODY_H - 0.05 && b[q + 1] > y + (b[q + 2] ? STEP : 0.02)) return true;
    return false;
  }

  // the highest node in cell k at or below y
  below(k, y) {
    let best = -1;
    for (let q = this.start[k]; q < this.start[k + 1]; q++) if (this.y[q] <= y + 1e-4) best = q; else break;
    return best;
  }
  highest(k, lo, hi) {
    let best = -1;
    for (let q = this.start[k]; q < this.start[k + 1]; q++) if (this.y[q] > lo && this.y[q] <= hi) best = q;
    return best;
  }

  // The node a point stands on: within `across` metres and `up` metres of height.
  nodeNear(x, y, z, across = 1.5, up = 2.5) {
    let best = -1, bd = Infinity;
    const r = Math.ceil(across / CELL);
    const i0 = Math.floor((x - this.x0) / CELL), j0 = Math.floor((z - this.z0) / CELL);
    for (let j = j0 - r; j <= j0 + r; j++) {
      for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
        const k = j * this.nx + i;
        const dxz = Math.hypot(this.cx(i) - x, this.cz(j) - z);
        if (dxz > across) continue;
        for (let q = this.start[k]; q < this.start[k + 1]; q++) {
          const dy = Math.abs(this.y[q] - y);
          if (dy > up) continue;
          const d = dxz + dy * 0.5;
          if (d < bd) { bd = d; best = q; }
        }
      }
    }
    return best;
  }

  // Every node within `across` metres and `up` metres of height of a point.
  nodesNear(x, y, z, across = 3, up = 2.5) {
    const out = [];
    const r = Math.ceil(across / CELL);
    const i0 = Math.floor((x - this.x0) / CELL), j0 = Math.floor((z - this.z0) / CELL);
    for (let j = j0 - r; j <= j0 + r; j++) {
      for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
        if (Math.hypot(this.cx(i) - x, this.cz(j) - z) > across) continue;
        const k = j * this.nx + i;
        for (let q = this.start[k]; q < this.start[k + 1]; q++) if (Math.abs(this.y[q] - y) <= up) out.push(q);
      }
    }
    return out;
  }

  link(a, b, L = 0, kind = 'line') {
    if (a < 0 || b < 0) return;
    let e = this.extra.get(a);
    if (!e) this.extra.set(a, (e = []));
    e.push([b, L, kind]);
  }

  // Every way on from node q: [node, latches, kind].
  edges(q, prof, out) {
    out.length = 0;
    const k = this.cellOfNode[q];
    const y = this.y[q];
    const i = k % this.nx, j = (k / this.nx) | 0;
    const water = this.flag[q] === 2;
    for (let dIdx = 0; dIdx < 8; dIdx++) {
      const [di, dj] = DIRS[dIdx];
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= this.nx || jj >= this.nz) continue;
      const k2 = jj * this.nx + ii;
      const d = Math.hypot(di, dj) * CELL;
      // walk on: the highest level within a step. Stepping up, the feet ride onto the step as
      // soon as the body is over it, so the destination's own room is what counts; level or
      // down, the body must pass at the height it is at.
      const tUp = y + Math.max(STEP, SLOPE * d);
      let dest = -1;
      for (let r = this.start[k2]; r < this.start[k2 + 1]; r++) {
        if (this.y[r] <= y + (this.flag[r] === 1 ? Math.max(STEP, SLOPE * d) : STEP) + 1e-4) dest = r;
      }
      const terrainWall = this.terrain[k2] > tUp && (dest < 0 || this.y[dest] < this.terrain[k2] - 0.05);
      if (!terrainWall && dest >= 0 && !(this.y[dest] < y - 0.01 && this.wallAt(k2, y))) {
        if (y - this.y[dest] <= SAFE_FALL) {
          out.push([dest, 0, this.y[dest] < y - 0.6 ? 'drop' : water || this.flag[dest] === 2 ? 'swim' : 'walk']);
          // a drop: a running jump may clear the gap instead
          if (this.y[dest] < y - 1.0 && !water) this.gapJumps(q, i, j, di, dj, out);
        }
        continue;
      }
      // a wall: jump onto it, or climb it
      this.climbs(q, i, j, dIdx, prof, water, out);
    }
    const e = this.extra.get(q);
    if (e) for (const x of e) out.push(x);
    return out;
  }

  gapJumps(q, i, j, di, dj, out) {
    const y = this.y[q];
    const len = Math.hypot(di, dj);
    for (let s = 2; s * len * CELL <= 4.01; s++) {
      const ii = i + di * s, jj = j + dj * s;
      if (ii < 0 || jj < 0 || ii >= this.nx || jj >= this.nz) return;
      const k2 = jj * this.nx + ii;
      const dest = this.highest(k2, y - 6, y + 0.8);
      if (dest >= 0 && this.y[dest] > y - 6) {
        // everything between is lower than both ends
        const lo = Math.min(y, this.y[dest]);
        let clear = true;
        for (let t = 1; t < s && clear; t++) {
          const k3 = (j + dj * t) * this.nx + (i + di * t);
          if (this.wallAt(k3, lo - 0.4)) clear = false;
          if (this.highest(k3, lo - 0.6, Infinity) >= 0) clear = false;
        }
        if (clear && !this.wallAt(k2, this.y[dest])) {
          out.push([dest, 0, 'jump']);
          return;
        }
      }
    }
  }

  climbs(q, i, j, dIdx, prof, water, out) {
    const key = q * 8 + dIdx;
    let cache = this.climbCache.get(prof.key);
    if (!cache) this.climbCache.set(prof.key, (cache = new Map()));
    let res = cache.get(key);
    if (!res) {
      res = this.simulateClimb(q, i, j, dIdx, prof, water);
      cache.set(key, res);
    }
    for (const e of res) out.push(e);
  }

  simulateClimb(q, i, j, dIdx, prof, water) {
    const res = [];
    const y = this.y[q];
    const [di, dj] = DIRS[dIdx];
    const len = Math.hypot(di, dj);
    const ux = di / len, uz = dj / len;
    // what stands on top within a couple of metres: a low top is simply jumped onto, and a face
    // with nothing on it within a climb's reach is not tried
    let top = -1, low = Infinity;
    for (let s = 1; s * len * CELL <= 2.6; s++) {
      const ii = i + di * s, jj = j + dj * s;
      if (ii < 0 || jj < 0 || ii >= this.nx || jj >= this.nz) break;
      const k2 = jj * this.nx + ii;
      const t = this.highest(k2, y + STEP, y + 16);
      if (t >= 0 && (top < 0 || this.y[t] > this.y[top])) top = t;
      for (let r = this.start[k2]; r < this.start[k2 + 1]; r++) if (this.y[r] > y + STEP) { low = Math.min(low, this.y[r]); break; }
    }
    if (top < 0 || low - y > REACH_CAP) return res;
    this.sims++;
    if (this.y[top] - y <= 1.3 && !water) {
      res.push([top, 0, 'jump']);
      return res;
    }
    // up against the wall: walk the body in until it touches, then climb
    let x = this.cx(i), z = this.cz(j);
    const yaw = Math.atan2(ux, uz);
    const cl = this.world.colliders, T = this.world.terrain;
    const wd = cl.raycast(x, y + 1.1, z, ux, 0, uz, 2.5);
    if (wd < 2.5) {
      const go = Math.max(0, wd - BODY_R - 0.05);
      // the walk in must keep to this floor: over a dip, the climb starts from the dip's floor
      // (that node's own climb), not from here
      for (let s = 0.25; s <= go; s += 0.25) {
        const fl = Math.max(T.heightAt(x + ux * s, z + uz * s), cl.groundAt(x + ux * s, z + uz * s, y + 0.6, BODY_R));
        if (fl < y - 0.4) return res;
      }
      x += ux * go;
      z += uz * go;
    } else {
      // a terrain face: in until the ground ahead stands over the knees
      for (let s = 0; s < 25; s++) {
        if (T.heightAt(x + ux * (BODY_R + 0.5), z + uz * (BODY_R + 0.5)) > y + 1.3) break;
        x += ux * 0.1;
        z += uz * 0.1;
      }
    }
    const caught = climbColumn(x, z, yaw, y, prof, water ? SWIM_JUMP_V : JUMP_V, y, undefined, this.y[top] + 0.5);
    for (const { top: t, L } of caught) {
      const land = this.landing(x, z, ux, uz, t);
      if (land >= 0) res.push([land, L, 'climb']);
    }
    return res;
  }

  // Where a climb onto an edge at height t ends: the first level within the top's reach a
  // stride or two on, or, over a thin wall, the ground beyond.
  landing(x, z, ux, uz, t) {
    for (let s = 0.3; s <= 2.4; s += 0.25) {
      const k = this.cellOf(x + ux * s, z + uz * s);
      if (k < 0) return -1;
      const r = this.highest(k, t - 0.35, t + 0.6);
      if (r >= 0) return r;
    }
    const k = this.cellOf(x + ux * 2.4, z + uz * 2.4);
    if (k < 0) return -1;
    const r = this.below(k, t + 0.5);
    return r >= 0 && t - this.y[r] <= SAFE_FALL ? r : -1;
  }

  // The fewest latches a route to each node needs, from `seeds`: a search on the most latches
  // any one climb on the way spends. need[q] is 255 where nothing reaches.
  search(seeds, prof, { lines = true, climbs = true, maxL = Math.min(MAX_L, prof.latches + 2) } = {}) {
    const need = new Uint8Array(this.nodes).fill(255);
    const via = new Uint8Array(this.nodes); // how each node was first reached (KINDS below)
    const from = new Int32Array(this.nodes).fill(-1); // and from where
    const buckets = Array.from({ length: MAX_L + 1 }, () => []);
    for (const s of seeds) if (s >= 0) { need[s] = 0; buckets[0].push(s); }
    const edges = [];
    for (let lvl = 0; lvl <= maxL; lvl++) {
      const b = buckets[lvl];
      while (b.length) {
        const q = b.pop();
        if (need[q] !== lvl) continue;
        this.edges(q, prof, edges);
        for (const [r, L, kind] of edges) {
          if (L > maxL) continue;
          if (!climbs && kind === 'climb') continue;
          if (!lines && (kind === 'line' || kind === 'lift')) continue;
          const nl = Math.max(lvl, L);
          if (nl < need[r]) {
            need[r] = nl;
            via[r] = KINDS[kind] ?? 0;
            from[r] = q;
            buckets[nl].push(r);
          }
        }
      }
    }
    return { need, via, from };
  }

  pos(q) {
    const k = this.cellOfNode[q];
    return [this.cx(k % this.nx), this.y[q], this.cz((k / this.nx) | 0)];
  }

  // The way a search reached node q, from its seed: the climbs, lines and lifts on it, each
  // { kind, from: [x, y, z], to: [x, y, z] }, plus how far was walked or swum in between.
  route(found, q) {
    const steps = [];
    let walked = 0;
    for (let r = q; r >= 0 && found.from[r] >= 0; r = found.from[r]) {
      const kind = KIND_NAME[found.via[r]];
      const a = this.pos(found.from[r]), b = this.pos(r);
      if (kind === 'climb' || kind === 'line' || kind === 'lift' || kind === 'jump') steps.push({ kind, from: a.map((n) => +n.toFixed(2)), to: b.map((n) => +n.toFixed(2)), up: +(b[1] - a[1]).toFixed(2) });
      else walked += Math.hypot(b[0] - a[0], b[2] - a[2]);
    }
    return { steps: steps.reverse(), walked: Math.round(walked) };
  }
}

export const KINDS = { walk: 0, drop: 1, jump: 2, swim: 3, climb: 4, line: 5, lift: 6, sea: 7 };
const KIND_NAME = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [v, k]));

// ---------------------------------------------------------------- lines and lifts
// Carrier lines (world/ziplines.js) run one way, start to end. The Meridian lift runs both.
export function linkTravel(grid, world) {
  let n = 0;
  for (const line of world.carrierLines || []) {
    const { curve } = line;
    const a = grid.nodeNear(curve.a.x, curve.floorA, curve.a.z, 2.6, 1.5);
    const b = grid.nodeNear(curve.b.x, curve.floorB, curve.b.z, 2.6, 1.5);
    if (a >= 0 && b >= 0) { grid.link(a, b, 0, 'line'); n++; }
  }
  const m = world.meridianLift;
  if (m) {
    const lo = grid.nodeNear(m.x, m.y0, m.z, 2.5, 1.5), hi = grid.nodeNear(m.x + 7, m.y1, m.z, 3.5, 1.5);
    if (lo >= 0 && hi >= 0) { grid.link(lo, hi, 0, 'lift'); grid.link(hi, lo, 0, 'lift'); n++; }
  }
  // the Ascent's lifts: the pad between its two stops (the pad itself is built at the lower
  // stop, so the upper one is the landing beside where it arrives)
  for (const l of world.rift?.ascentLifts?.lifts || []) {
    const lo = grid.nodeNear(l.x, l.y0, l.z, 2.5, 1.0), hi = grid.nodeNear(l.x, l.y1, l.z, 5, 1.0);
    if (lo >= 0 && hi >= 0) { grid.link(lo, hi, 0, 'lift'); grid.link(hi, lo, 0, 'lift'); n++; }
  }
  for (const l of world.travelLinks || []) {
    const a = grid.nodeNear(l.a.x, l.a.y, l.a.z, 2.5, 2), b = grid.nodeNear(l.b.x, l.b.y, l.b.z, 2.5, 2);
    if (a >= 0 && b >= 0) { grid.link(a, b, 0, l.kind || 'lift'); if (l.both) grid.link(b, a, 0, l.kind || 'lift'); n++; }
  }
  return n;
}

// The water at a grid's border: the open sea, joined to every other landmass's.
export function seaNodes(grid) {
  const out = [];
  for (let j = 0; j < grid.nz; j++) {
    for (let i = 0; i < grid.nx; i++) {
      if (i > 2 && j > 2 && i < grid.nx - 3 && j < grid.nz - 3) continue;
      const k = j * grid.nx + i;
      for (let q = grid.start[k]; q < grid.start[k + 1]; q++) if (grid.flag[q] === 2) out.push(q);
    }
  }
  return out;
}
