// Travel by sea. There is no fast travel and no booked ferry passage: rent a boat at a
// dock and sail it yourself. Sea paths (A* over a water grid) remain for tools and any
// captained boats that still need a route.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS, UPDATE_HOOKS, START_HOOKS } from './hooks.js';
import { Boat } from '../entities/boat.js';
import { HumanoidRig } from '../entities/rig.js';
import { BOATS, RENTABLE } from '../data/boats.js';
import { islandBounds } from '../data/coastlines.js';
import { FERRY_ROUTES, ISLANDS } from '../data/world.js';
import { angleDiff, clamp, damp, escapeHtml } from '../core/util.js';
import { openPanel } from '../ui/panel.js';

// ---------------------------------------------------------------- water grid + A*
let grid = null;
function buildGrid() {
  const surface = ISLANDS.filter((i) => i.cx < 3000);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const i of surface) {
    const b = islandBounds(i, 260);
    minX = Math.min(minX, b.x0); maxX = Math.max(maxX, b.x1);
    minZ = Math.min(minZ, b.z0); maxZ = Math.max(maxZ, b.z1);
  }
  const cell = 14;
  const w = Math.ceil((maxX - minX) / cell);
  const h = Math.ceil((maxZ - minZ) / cell);
  const water = new Uint8Array(w * h);
  const t = G.world.terrain;
  const deep = (x, z) => t.heightAt(x, z) < -2.6;
  // and nothing built standing in the water there: a pier, a mole, a sea wall, an arch's pier
  // (a hull meets those, entities/boat.js)
  const cols = G.world.colliders;
  const near = [];
  const built = (x, z, pad) => {
    if (!cols) return false;
    for (const c of cols.query(x, z, pad + 4, near)) {
      if (c.y1 < -1.5 || c.y0 > 1.5) continue;
      if (c.kind === 'box') {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) <= c.hw + pad && Math.abs(lz) <= c.hd + pad) return true;
      } else if (Math.hypot(x - c.x, z - c.z) <= c.r + pad) return true;
    }
    return false;
  };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = minX + (i + 0.5) * cell;
      const z = minZ + (j + 0.5) * cell;
      water[j * w + i] = deep(x, z) && deep(x + 6, z) && deep(x - 6, z) && deep(x, z + 6) && deep(x, z - 6) && !built(x, z, cell / 2 + 1) ? 1 : 0;
    }
  }
  grid = { minX, minZ, cell, w, h, water, deep };
  return grid;
}
const toCell = (g, x, z) => [Math.floor((x - g.minX) / g.cell), Math.floor((z - g.minZ) / g.cell)];
const cellCenter = (g, i, j) => new THREE.Vector3(g.minX + (i + 0.5) * g.cell, 0, g.minZ + (j + 0.5) * g.cell);

function nearestWater(g, x, z) {
  const [ci, cj] = toCell(g, x, z);
  for (let r = 0; r < 12; r++) {
    let best = null;
    let bd = Infinity;
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= g.w || j >= g.h || !g.water[j * g.w + i]) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function lineClear(g, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(d / 6);
  for (let k = 1; k < n; k++) {
    const x = a.x + ((b.x - a.x) * k) / n;
    const z = a.z + ((b.z - a.z) * k) / n;
    if (!g.deep(x, z)) return false;
    // through open cells only: the grid knows what stands in the water
    const [i, j] = toCell(g, x, z);
    if (i < 0 || j < 0 || i >= g.w || j >= g.h || !g.water[j * g.w + i]) return false;
  }
  return true;
}

export function findSeaPath(from, to) {
  const g = grid || buildGrid();
  const s = nearestWater(g, from.x, from.z);
  const e = nearestWater(g, to.x, to.z);
  if (!s || !e) return null;
  const W = g.w;
  const start = s[1] * W + s[0];
  const goal = e[1] * W + e[0];
  const gs = new Float32Array(W * g.h).fill(Infinity);
  const came = new Int32Array(W * g.h).fill(-1);
  const closed = new Uint8Array(W * g.h);
  const heap = [];
  const push = (n, f) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top[1];
  };
  const hx = e[0];
  const hz = e[1];
  gs[start] = 0;
  push(start, 0);
  const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false;
  while (heap.length) {
    const n = pop();
    if (n === goal) {
      found = true;
      break;
    }
    if (closed[n]) continue;
    closed[n] = 1;
    const ni = n % W;
    const nj = (n / W) | 0;
    for (const [di, dj, c] of N) {
      const i = ni + di;
      const j = nj + dj;
      if (i < 0 || j < 0 || i >= W || j >= g.h) continue;
      const k = j * W + i;
      if (!g.water[k] || closed[k]) continue;
      const ng = gs[n] + c;
      if (ng < gs[k]) {
        gs[k] = ng;
        came[k] = n;
        push(k, ng + Math.hypot(i - hx, j - hz));
      }
    }
  }
  if (!found) return null;
  const raw = [];
  for (let n = goal; n !== -1; n = came[n]) raw.push(cellCenter(g, n % W, (n / W) | 0));
  raw.reverse();
  // string-pull: keep only the points needed for clear straight runs
  const out = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !lineClear(g, raw[i], raw[j])) j--;
    out.push(raw[j]);
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------- captained crossings
export function dockBerth(dock, side = 1) {
  // a point alongside the dock's end, on open water
  const perp = new THREE.Vector3(dock.dir.z, 0, -dock.dir.x).multiplyScalar(side * 3.6);
  return dock.end.clone().add(perp).setY(0);
}

// A course from one dock to another: out from the berth to a point 16 m past the pier's end,
// the sea's own planner between those two points, and in the same way at the far dock (a course
// straight from a berth to the nearest open cell could cross the pier it lies by).
export function seaCourse(fromDock, toDock) {
  const a = dockBerth(fromDock, 1), b = dockBerth(toDock, 1);
  const a2 = a.clone().addScaledVector(fromDock.dir, 16), b2 = b.clone().addScaledVector(toDock.dir, 16);
  const p = findSeaPath(a2, b2);
  if (!p) return null;
  return [a, a2, ...p.slice(1), b2, b];
}

export class FerryPilot {
  // arrive: how near the last point counts as there (a boat's bow meets the quay first)
  constructor(boat, route, onArrive, { arrive = 4 } = {}) {
    this.arrive = arrive;
    this.route = route;
    this.i = 1;
    this.onArrive = onArrive;
    this.stuckT = 0;
    this.done = false;
    this.berthT = 0;
  }
  update(boat, dt) {
    if (this.done) {
      boat.speed = damp(boat.speed, 0, 2, dt);
      boat.move(dt);
      return;
    }
    const target = this.route[this.i];
    const last = this.i === this.route.length - 1;
    const dx = target.x - boat.pos.x;
    const dz = target.z - boat.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < (last ? this.arrive : 18)) {
      if (last) {
        this.done = true;
        this.onArrive && this.onArrive(boat);
        return;
      }
      this.i++;
      return;
    }
    const turnErr = angleDiff(boat.yaw, Math.atan2(dx, dz));
    const turn = clamp(turnErr * 2.2, -1, 1);
    let throttle = clamp(1.1 - Math.abs(turnErr) * 0.6, 0.25, 1);
    if (last) throttle = Math.min(throttle, clamp(dist / 40, 0.2, 1));
    boat.steer(dt, throttle, turn);
    // unstick: if wedged against a shore, reverse a little and re-plan
    if (Math.abs(boat.speed) < 1.2) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 3) {
      this.stuckT = 0;
      boat.yaw += Math.PI * 0.35;
      const goal = this.route[this.route.length - 1];
      const p = findSeaPath(boat.pos, goal);
      if (p) {
        // the new course still ends where this one was going (a short course is the goal alone)
        this.route = [boat.pos.clone(), ...p.slice(1)];
        if (Math.hypot(this.route[this.route.length - 1].x - goal.x, this.route[this.route.length - 1].z - goal.z) > 4) this.route.push(goal);
        this.i = 1;
      }
    }
  }
}

let crossing = null; // { boat, captain, rig, to, t }

function makeCaptain() {
  const rig = new HumanoidRig({ skin: '#c89870', hair: '#4a4a4a', beard: '#5a5a5a', outfit: { main: '#2a4a5a', trim: '#e8d4a0', pants: '#2a2a2a', boots: '#1a1a1a' } });
  G.scene.add(rig.root);
  return { isCaptain: true, name: 'Captain', rig };
}

function endCrossing(despawnDelay = 18) {
  const c = crossing;
  if (!c) return;
  crossing = null;
  c.leaving = despawnDelay;
  departing.push(c);
}
const departing = [];

// Booked ferry passage was removed — docks only rent boats you sail yourself.
ACTIONS.openFerry = (ui = G.ui, dockId) => ACTIONS.openBoatyard(ui, dockId);

export function startCrossing(game, fromId, toId) {
  const from = game.world.docks[fromId];
  const to = game.world.docks[toId];
  const p = game.player;
  if (!from || !to || !p) return false;
  if (crossing) endCrossing(0);
  const start = dockBerth(from, 1);
  const goal = dockBerth(to, 1);
  const path = findSeaPath(start, goal);
  if (!path) {
    G.ui.toast('The captain studies the charts and shakes his head. No safe way there today.', 'bad');
    return false;
  }
  path[0] = start;
  path.push(goal);
  const boat = new Boat(start, from.yaw, 'ferry');
  const captain = makeCaptain();
  boat.board(captain, 0);
  const route = FERRY_ROUTES.find((r) => r.id === toId);
  boat.autopilot = new FerryPilot(boat, path, (b) => arrive(game, b, toId));
  game.boats.push(boat);
  if (p.boat) p.leaveBoat();
  p.enterBoat(boat);
  crossing = { boat, captain, to: toId, name: route ? route.name : 'port' };
  G.ui.toast(`The ferry casts off for ${crossing.name}. [E] to leave the boat.`, 'quest');
  G.audio.play('bell', { pitch: 1.4, vol: 0.5 });
  return true;
}

function arrive(game, boat, toId) {
  const p = game.player;
  const dock = game.world.docks[toId];
  // where passengers step off (LAN friends aboard are placed here too)
  boat.dockPos = dock.end.clone().add(new THREE.Vector3(0, 0.1, 0)).addScaledVector(dock.dir, -1.5);
  G.audio.play('bell', { pitch: 1.4, vol: 0.5 });
  if (p && p.boat === boat) {
    p.leaveBoat();
    // step off onto the end of the dock
    p.pos.copy(boat.dockPos);
    p.vel.set(0, 0, 0);
    p.fallStart = p.pos.y;
    G.ui.toast(`You arrive at ${crossing ? crossing.name : 'port'}.`, 'good');
    game.save();
  }
  endCrossing(14);
}

// ---------------------------------------------------------------- boatyard (rent your own)
ACTIONS.openBoatyard = (ui = G.ui, dockId) => {
  const game = ui.game;
  const p = game.player;
  const price = (t) => Math.round(BOATS[t].rent * p.derived.priceMul);
  openPanel(ui, 'boatyard', {
    width: 640,
    render: () => `<h2>BOATYARD</h2>
      <p class="muted" style="text-align:center;margin-top:0">A rented boat waits at the end of the dock. Renting another returns the last one. Friends can board as passengers [E].</p>
      <div class="shop-list">${RENTABLE.map((t) => {
        const b = BOATS[t];
        return `<div class="shop-row"><div style="flex:1"><div class="nm">${b.name}</div><div class="ds">${escapeHtml(b.desc)}</div><div class="ds">${b.seats.length} seats · ${b.speed}-${b.boost} knots</div></div><div class="pr">${price(t)} silver</div><button class="btn small primary" data-rent="${t}" ${game.ch.silver < price(t) ? 'disabled' : ''}>Rent</button></div>`;
      }).join('')}</div><div class="divider"></div><div class="row-flex"><span class="muted" style="font-size:13px">W/S throttle · A/D steer · Shift for speed · E to disembark</span><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`,
    onClick: (e) => {
      const b = e.target.closest('[data-rent]');
      if (!b) return;
      if (ACTIONS.rentBoat(dockId, b.dataset.rent)) ui.closeModal();
    },
  });
  return true;
};

ACTIONS.rentBoat = (dockId, type = 'skiff') => {
  const game = G.game;
  const ch = game.ch;
  const dock = game.world.docks[dockId];
  const cost = Math.round(BOATS[type].rent * game.player.derived.priceMul);
  if (!dock || ch.silver < cost) {
    G.ui.toast('Not enough silver.', 'bad');
    return false;
  }
  ch.silver -= cost;
  // return the previous rental (never a ferry or someone else's boat)
  for (let i = game.boats.length - 1; i >= 0; i--) {
    const b = game.boats[i];
    if (!b.rented || b.netProxy) continue;
    if (b.occupants.some((o) => o && o !== game.player && o.isRemote)) continue; // friends aboard: leave it be
    if (game.player.boat === b) game.player.leaveBoat();
    b.dispose();
    game.boats.splice(i, 1);
  }
  const pos = dockBerth(dock, 1);
  const boat = new Boat(pos, dock.yaw, type);
  boat.rented = true;
  boat.owner = 'local';
  game.boats.push(boat);
  G.audio.play('coin');
  G.ui.toast(`Your ${BOATS[type].name.toLowerCase()} is moored at the end of the dock.`, 'good');
  return true;
};

// ---------------------------------------------------------------- per-frame
UPDATE_HOOKS.push((game, dt) => {
  if (crossing) {
    const c = crossing;
    const sp = c.boat.seatPos(c.captain);
    c.captain.rig.root.position.copy(sp);
    c.captain.rig.root.rotation.y = c.boat.yaw;
    c.captain.rig.update(dt, { sit: true, grounded: true, weaponOut: false });
    // the player jumped ship: the ferry turns back and leaves
    if (game.player && game.player.boat !== c.boat) {
      G.ui.toast('The ferry sails on without you.', '');
      endCrossing(10);
    }
  }
  for (let i = departing.length - 1; i >= 0; i--) {
    const c = departing[i];
    c.leaving -= dt;
    c.captain.rig.root.position.copy(c.boat.seatPos(c.captain));
    c.captain.rig.root.rotation.y = c.boat.yaw;
    c.captain.rig.update(dt, { sit: true, grounded: true, weaponOut: false });
    if (c.leaving <= 0 || c.boat.passengers().length === 0 && c.leaving < 8) {
      if (c.boat.passengers().some((o) => o === game.player)) continue;
      G.scene.remove(c.captain.rig.root);
      if (c.captain.rig.dispose) c.captain.rig.dispose();
      const k = game.boats.indexOf(c.boat);
      if (k >= 0) game.boats.splice(k, 1);
      c.boat.dispose();
      departing.splice(i, 1);
    }
  }
});

START_HOOKS.push(() => {
  // crossings never persist across loads
  if (crossing) {
    G.scene.remove(crossing.captain.rig.root);
    crossing = null;
  }
  for (const c of departing) G.scene.remove(c.captain.rig.root);
  departing.length = 0;
  grid = null;
});

ACTIONS.crossingState = () => crossing && { to: crossing.to, i: crossing.boat.autopilot && crossing.boat.autopilot.i, n: crossing.boat.autopilot && crossing.boat.autopilot.route.length, pos: crossing.boat.pos.clone() };
ACTIONS.findSeaPath = findSeaPath;
