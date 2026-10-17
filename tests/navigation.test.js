import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import * as THREE from 'three';

if (modules.registerHooks) {
  modules.registerHooks({ load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
  } });
} else {
  modules.register('data:text/javascript,' + encodeURIComponent(`
    export async function load(url, context, next) {
      return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
    }
  `), import.meta.url);
}
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { G } = await import('../src/core/globals.js');
const { Actor } = await import('../src/entities/actor.js');
const { Enemy } = await import('../src/entities/enemy.js');
const { Colliders } = await import('../src/world/colliders.js');
const { navGrid, navBody, NAV_BUDGET, PathSearch } = await import('../src/entities/nav.js');

const noop = new Proxy({}, { get: () => () => {} });
let target;
function flatWorld(build) {
  const colliders = new Colliders();
  build(colliders);
  G.world = { terrain: { heightAt: () => 0 }, colliders, sky: { isNight: () => false } };
}
beforeEach(() => {
  G.vfx = noop;
  G.audio = noop;
  G.ui = noop;
  G.net = null;
  G.player = null;
  G.time = 100;
  G.actors = [];
  G.projectiles = [];
  G.scene = new THREE.Scene();
  target = new Actor({ team: 'player', hp: 200, posture: 100 });
  target.grounded = true;
  G.game = { playerActors: () => [target], inRift: false, bossActive: null, startBoss() {}, endBoss() {} };
});

// A brigand that has already seen the target; steps the simulation at 30 Hz.
function brigand(x, z) {
  const e = new Enemy('brigand', new THREE.Vector3(x, 0, z));
  e.grounded = true;
  e.ai.atkCd = 99; // keep it walking: this is about getting there, not the fight
  G.actors.push(e);
  return e;
}
function run(e, seconds, until) {
  for (let t = 0; t < seconds; t += 1 / 30) {
    G.time += 1 / 30;
    e.ai.atkCd = 99;
    e.update(1 / 30);
    if (until && until()) return t;
  }
  return Infinity;
}
const near = (e, x, z, r) => Math.hypot(e.pos.x - x, e.pos.z - z) < r;
// The old straight-line steering, for a control run.
function straightOnly(e) {
  e.navTo = function (tx, tz, ty, speed, dt, face) { this.moveToward(tx, tz, speed, dt, face); };
}

// A 24 m wall across z = 0, from x = -12 to 12.
const wall = (c) => c.addBox({ x: 0, z: 0, w: 24, d: 0.6, y0: -1, y1: 4, walkable: false });

test('an enemy walks around a wall standing between it and its target', () => {
  flatWorld(wall);
  target.pos.set(0, 0, 6);
  const control = brigand(0, -6);
  straightOnly(control);
  control.setAggro(target);
  run(control, 8);
  assert.ok(control.pos.z < 0, 'straight-line steering stalls at the wall (the defect this guards)');

  G.actors = [];
  const e = brigand(0, -6);
  e.setAggro(target);
  // a brigand holds off at about three metres, sword's reach
  const t = run(e, 15, () => e.pos.z > 0.5 && near(e, 0, 6, 3.4));
  assert.ok(t < 15, `reached the target round the wall end (stood at ${e.pos.x.toFixed(1)}, ${e.pos.z.toFixed(1)})`);
});

test('an enemy finds a 1 m doorway into a room around the far side', () => {
  // a 6 x 6 m room, walls 0.4 thick, its only door 1.0 m wide in the north wall (z = +3)
  flatWorld((c) => {
    const box = (x, z, w, d) => c.addBox({ x, z, w, d, y0: -1, y1: 3.2, walkable: false });
    box(0, -3, 6.4, 0.4);
    box(-3, 0, 0.4, 6.4);
    box(3, 0, 0.4, 6.4);
    box(-1.85, 3, 2.7, 0.4);
    box(1.85, 3, 2.7, 0.4);
  });
  target.pos.set(0, 0, -1.8);
  const e = brigand(0.5, -9);
  e.setAggro(target);
  const t = run(e, 20, () => e.pos.z < 2.2 && Math.abs(e.pos.x) < 2.7 && e.pos.z > -2.7 && near(e, 0, -1.8, 3.4));
  assert.ok(t < 20, `got into the room (stood at ${e.pos.x.toFixed(1)}, ${e.pos.z.toFixed(1)})`);
});

test('a leashed enemy gives up and walks home around the wall', () => {
  flatWorld(wall);
  target.pos.set(0, 0, 6);
  const e = brigand(0, -6);
  e.setAggro(target);
  run(e, 15, () => e.pos.z > 0.5 && near(e, 0, 6, 3.4));
  assert.ok(e.pos.z > 0.5, 'chased round the wall first');
  target.pos.set(0, 0, 200); // far past leash * 1.6
  run(e, 1);
  assert.equal(e.aggro, false);
  assert.equal(e.ai.state, 'return');
  const t = run(e, 15, () => near(e, 0, -6, 2));
  assert.ok(t < 15, `returned home (stood at ${e.pos.x.toFixed(1)}, ${e.pos.z.toFixed(1)})`);
});

test('the walk grid blocks walls and water, steps stairs, and refuses cliffs', () => {
  const colliders = new Colliders();
  colliders.addBox({ x: 0, z: 5, w: 10, d: 0.6, y0: -1, y1: 4, walkable: false }); // wall
  for (let i = 0; i < 6; i++) colliders.addBox({ x: 10, z: i * 0.45, w: 2, d: 0.45, y0: -1, y1: 0.3 * (i + 1) }); // stair
  const world = {
    colliders,
    // a 6 m cliff at x > 20, a sea at x < -20
    terrain: { heightAt: (x) => (x > 20 ? 6 : x < -20 ? -5 : 0) },
  };
  const grid = navGrid(world);
  const body = navBody({ radius: 0.42, height: 1.8 });
  assert.equal(grid.walkLine(0, 0, 0, 0, 10, body), false, 'wall');
  assert.equal(grid.walkLine(0, 0, 0, 8, 0, body), true, 'open ground');
  assert.equal(grid.walkLine(10, -1, 0, 10, 2.6, body), true, 'up the stair');
  assert.equal(grid.walkLine(0, 0, 0, 25, 0, body), false, 'cliff');
  assert.equal(grid.walkLine(0, 0, 0, -25, 0, body), false, 'water');
  const p = grid.findPath(0, 0, 0, 0, 10, 0, body);
  assert.ok(p && p.complete, 'a route round the wall');
  assert.ok(p.points.some(([x]) => Math.abs(x) > 5), 'the route goes past a wall end');
  // the grid rebuilds when colliders change
  const before = grid.built;
  colliders.addBox({ x: 0, z: -3, w: 2, d: 2, y0: -1, y1: 2, walkable: false });
  assert.equal(navGrid(world).walkLine(0, -5, 0, 0, -1, body), false, 'a new box blocks at once');
  assert.ok(navGrid(world).built > before);
});

test('navigation work is metered per simulation step and resumes on the next', () => {
  const colliders = new Colliders();
  colliders.addBox({ x: 0, z: 0, w: 60, d: 0.6, y0: -1, y1: 4, walkable: false });
  const world = { colliders, terrain: { heightAt: () => 0 } };
  const body = navBody({ radius: 0.42, height: 1.8 });
  const ms = NAV_BUDGET.ms;
  NAV_BUDGET.ms = 0; // only the guaranteed minimum: one tile and a few nodes a step
  try {
    let grid = navGrid(world, 1);
    const s = new PathSearch(grid, 0, -6, 0, 0, 6, 0, body);
    assert.equal(s.run(), false, 'a 30 m detour does not fit in one step');
    assert.equal(grid.built, 1, 'one tile a step');
    let steps = 1;
    while (!s.run() && steps < 5000) grid = navGrid(world, 1 + ++steps);
    assert.ok(s.result && s.result.complete, 'it finishes over later steps');
    assert.ok(steps > 10);
  } finally {
    NAV_BUDGET.ms = ms;
  }
});

test('a patrol point at another height is still reached, and an unreachable one is given up', () => {
  // a raised walk 3 m up reached by a stair, and a walled-off pen
  flatWorld((c) => {
    // ten 0.3 m risers on 0.45 m treads, the top tread flush with the walk at z = 3.9
    for (let i = 0; i < 10; i++) c.addBox({ x: 6, z: -0.6 + (i + 0.5) * 0.45, w: 2, d: 0.47, y0: -1, y1: 0.3 * (i + 1) });
    c.addBox({ x: 6, z: 6, w: 2, d: 4.2, y0: -1, y1: 3 });
    for (const [x, z, w, d] of [[-10, -3, 6.4, 0.4], [-10, 3, 6.4, 0.4], [-13, 0, 0.4, 6.4], [-7, 0, 0.4, 6.4]]) {
      c.addBox({ x, z, w, d, y0: -1, y1: 3, walkable: false });
    }
  });
  const grid = navGrid(G.world);
  const body = navBody({ radius: 0.42, height: 1.8 });
  const up = grid.findPath(0, 0, 0, 6, 7, NaN, body);
  assert.ok(up && up.complete && up.points.at(-1)[1] > 2.5, 'climbs the stair to a point with no stated height');
  const pen = grid.findPath(0, 0, 0, -10, 0, 0, body);
  assert.ok(pen && !pen.complete, 'the walled pen has no way in');
});

test('a guard posted to a landing holds its post; one with no post wanders', () => {
  // a 6 m landing 40 m up, nothing round it: a wander of a few metres steps off the edge
  flatWorld((c) => c.addBox({ x: 0, z: 0, w: 6, d: 6, y0: 39, y1: 40 }));
  G.game.playerActors = () => []; // no one to see: idle time
  const posted = new Enemy('brigand', new THREE.Vector3(0, 40, 0), { spawner: { def: { y: 40 } } });
  posted.grounded = true;
  const loose = new Enemy('brigand', new THREE.Vector3(30, 0, 0));
  loose.grounded = true;
  G.actors.push(posted, loose);
  let wandered = 0;
  for (let t = 0; t < 40; t += 1 / 30) {
    G.time += 1 / 30;
    for (const e of [posted, loose]) {
      e.update(1 / 30);
      e.physics(1 / 30);
    }
    wandered = Math.max(wandered, Math.hypot(loose.pos.x - 30, loose.pos.z));
  }
  assert.ok(posted.pos.y > 39.5, `still on its landing (y ${posted.pos.y.toFixed(1)})`);
  assert.ok(Math.hypot(posted.pos.x, posted.pos.z) < 1, 'at its post');
  assert.ok(wandered > 1, `an unposted brigand still wanders (${wandered.toFixed(1)} m)`);
});
