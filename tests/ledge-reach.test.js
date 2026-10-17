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
const { Player } = await import('../src/entities/player.js');
const { Game } = await import('../src/game/game.js');
const { Input } = await import('../src/core/input.js');
const { Colliders } = await import('../src/world/colliders.js');
const { climbColumn, ReachGrid, PROFILES } = await import('../tools/reach/graph.mjs');

// The ledge reach tool (tools/reach/graph.mjs) against the real controller: on flat ground, a
// real Player climbs known walls with real input, the best a player can do (a hop at each
// apex, a leap from each hang with forward held), and the tool must call each wall the same.
const DT = 1 / 30;
const fx = new Proxy(function () {}, { get: () => fx, apply: () => fx });
let player, input, colliders;

beforeEach(() => {
  G.vfx = fx;
  G.audio = fx;
  G.ui = fx;
  G.net = null;
  G.time = 100;
  G.actors = [];
  G.projectiles = [];
  G.scene = new THREE.Scene();
  colliders = new Colliders();
  G.world = {
    scene: G.scene, colliders, projectileBlockers: [], walls: [], hazards: [],
    terrain: { heightAt: () => 0, raycast: () => null },
    groundAt: (x, z, y = 400) => Math.max(0, colliders.groundAt(x, z, y, 0)),
    lendLight: () => new THREE.PointLight(),
    surfaceAt: () => 'stone',
    inRift: () => false,
  };
  input = Object.assign(Object.create(Input.prototype), {
    down: new Set(), pressed: new Set(), released: new Set(), mPressed: [false, false, false], mDown: [false, false, false], mReleased: [false, false, false],
  });
  G.input = input;
  const game = Object.create(Game.prototype);
  Object.assign(game, { camYaw: 0, inRift: false, state: 'playing', ui: { isOpen: () => false, isPaused: () => false }, input });
  G.game = game;
  player = new Player(game.createCharacter({ name: 'Climber', race: 'ashkin', look: {} }));
  player.grounded = true;
  G.player = player;
  G.actors.push(player);
});

// a sheer wall across the path, its face 1 m ahead (z = 1), `h` metres high and 3 m deep
const wall = (h) => colliders.addBox({ x: 0, z: 2.5, w: 8, d: 3, y0: 0, y1: h });

// The real controller, played well: the build's latches, hop and leap; a jump, a press at
// every apex (a hop up the wall, or the double jump), and from a hang a leap with forward held.
// A build with the double jump starts back from the wall so that its first press is the double
// jump, not a hop. Returns the highest floor the feet stood on.
function realClimb(prof) {
  Object.assign(player.derived, { latches: prof.latches, wallHop: prof.hop, latchLeap: prof.leap });
  player.mods.doubleJump = prof.doubleJump;
  player.pos.set(0, 0, prof.doubleJump ? -3.0 : 0.5);
  input.down.add('KeyW');
  step(0.2);
  input.pressed.add('Space');
  let lastVy = 0, hangT = 0, best = 0;
  for (let t = 0; t < 8; t += DT) {
    G.time += DT;
    if (!player.climbing && !player.grounded && lastVy > 0 && player.vel.y <= 0) input.pressed.add('Space');
    if (player.climbing && (hangT += DT) > 0.1) {
      input.pressed.add('Space');
      hangT = 0;
    }
    lastVy = player.vel.y;
    player.update(DT);
    input.endFrame();
    if (player.grounded) best = Math.max(best, player.pos.y);
  }
  input.down.delete('KeyW');
  return best;
}
function step(seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    G.time += DT;
    player.update(DT);
    input.endFrame();
  }
}

// The tool's call: the most latches its model of the climb spends to catch the top (null when
// no edge is caught at the top within the build's latches).
function toolClimb(h, prof) {
  const caught = climbColumn(0, 1 - player.radius - 0.05, 0, 0, prof);
  const top = caught.find((c) => Math.abs(c.top - h) < 0.01);
  return top && top.L <= prof.latches ? top.L : null;
}

const HEIGHTS = [3.5, 4.6, 5.5, 6.3, 7.0, 7.8, 8.6, 9.6];

for (const n of [3, 4, 5]) {
  test(`sheer walls at ${n} latches: the tool calls every wall as the real controller climbs it`, () => {
    const prof = PROFILES[n];
    const rows = [];
    for (const h of HEIGHTS) {
      colliders = new Colliders();
      G.world.colliders = colliders;
      G.world.groundAt = (x, z, y = 400) => Math.max(0, colliders.groundAt(x, z, y, 0));
      wall(h);
      const tool = toolClimb(h, prof);
      player.pos.set(0, 0, 0.5);
      player.vel.set(0, 0, 0);
      player.climbing = false;
      player.latches = 0;
      player.grounded = true;
      const real = realClimb(prof);
      rows.push([h, tool, +real.toFixed(2)]);
      assert.equal(tool !== null, Math.abs(real - h) < 0.05, `a ${h} m wall at ${prof.key}: the tool says ${tool === null ? 'no' : `yes, ${tool} latches`}, the controller stood at ${real.toFixed(2)} m`);
    }
    // the tallest sheer wall the build takes, for the record
    const tallest = Math.max(...rows.filter((r) => r[1] !== null).map((r) => r[0]));
    assert.ok(tallest >= 3.5, `${prof.key} climbs a ${tallest} m wall`);
  });
}

test('the tallest sheer walls, by build: three latches stop short of a 6.3 m face that four and five take', () => {
  const take = (prof, h) => {
    colliders = new Colliders();
    G.world.colliders = colliders;
    wall(h);
    return toolClimb(h, prof);
  };
  assert.ok(take(PROFILES[3], 5.5) !== null, 'three latches take 5.5 m');
  assert.equal(take(PROFILES[3], 6.3), null, 'but not 6.3 m');
  assert.ok(take(PROFILES[4], 6.3) !== null, 'four take 6.3 m');
  assert.equal(take(PROFILES[4], 7.8), null, 'but not 7.8 m');
  assert.ok(take(PROFILES[5], 7.8) !== null, 'five take 7.8 m');
});

test('a line of shelves: each landing restores the latches, so the graph needs one latch for 3 m steps, and four for a 6.3 m pitch', () => {
  // three 3 m risers with 1.4 m treads, then a 6.3 m pitch to the top
  colliders.addBox({ x: 0, z: 1.7, w: 4, d: 1.4, y0: 0, y1: 3 });
  colliders.addBox({ x: 0, z: 3.1, w: 4, d: 1.4, y0: 0, y1: 6 });
  colliders.addBox({ x: 0, z: 4.5, w: 4, d: 1.4, y0: 0, y1: 9 });
  colliders.addBox({ x: 0, z: 8.2, w: 4, d: 6, y0: 0, y1: 15.3 });
  const grid = new ReachGrid(G.world, { x0: -6, x1: 6, z0: -4, z1: 12 });
  const start = grid.nodeNear(0, 0, -1, 1, 0.5);
  const at = (y, z) => grid.nodeNear(0, y, z, 0.8, 0.2);
  for (const n of [3, 4, 5]) {
    const found = grid.search([start], PROFILES[n]);
    assert.equal(found.need[at(3, 1.7)], 1, `the first shelf takes one latch (${n})`);
    assert.equal(found.need[at(9, 4.5)], 1, `the third, from the second, still one (${n})`);
    const top = found.need[at(15.3, 7)];
    if (n === 3) assert.ok(top > 3, `the 6.3 m pitch is out of reach at three latches (needs ${top})`);
    else assert.ok(top <= n, `the top is reached at ${n} latches (needs ${top})`);
    if (n === 4) {
      const { steps } = grid.route(found, at(15.3, 7));
      const climbs = steps.filter((s) => s.kind === 'climb');
      assert.ok(climbs.every((c) => Math.abs(c.up - 3) < 0.05 || Math.abs(c.up - 6.3) < 0.05), `every climb is a 3 m shelf or the 6.3 m pitch (${JSON.stringify(climbs)})`);
      assert.equal(climbs.filter((c) => Math.abs(c.up - 6.3) < 0.05).length, 1, 'the pitch is climbed once, last');
    }
  }
});
