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
const { TALENTS } = await import('../src/data/talents.js');
const { TRINKETS } = await import('../src/data/trinkets.js');
const { OUTFITS, ITEMS } = await import('../src/data/items.js');

// Climbing by ledges, Deepwoken's way (player.js): a real Player, the real Input's key sets and
// a real wall of colliders on flat ground. The player stands at the origin facing +z, the wall's
// face 1 m ahead.
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

// a wall across the path, 1 m ahead, `h` metres high and 3 m deep
const wall = (h) => colliders.addBox({ x: 0, z: 2.5, w: 8, d: 3, y0: 0, y1: h });
function step(seconds, each) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    G.time += DT;
    if (each) each();
    player.update(DT);
    input.endFrame();
  }
}
const press = (code) => input.pressed.add(code);

test('jumping into a wall below its edge catches the ledge and hangs; jump with forward held climbs onto it', () => {
  wall(3.2);
  input.down.add('KeyW');
  step(0.4); // walk up to the wall
  press('Space');
  let caught = null;
  step(1, () => {
    if (!caught && player.climbing) caught = player.pos.y;
  });
  assert.ok(caught !== null, 'the hands caught the edge');
  assert.ok(player.climbing, 'still hanging a second later');
  assert.ok(Math.abs(player.pos.y - (3.2 - 1.95)) < 0.01, `hangs with the feet 1.95 m below the edge (${player.pos.y.toFixed(2)})`);
  assert.equal(player.latches, 1);
  press('Space');
  let onTop = false;
  step(1.2, () => {
    if (player.grounded && Math.abs(player.pos.y - 3.2) < 0.05 && player.pos.z > 1.2) {
      onTop = true;
      input.down.delete('KeyW');
    }
  });
  assert.ok(onTop, `stood on top (${player.pos.y.toFixed(2)}, z ${player.pos.z.toFixed(2)})`);
  assert.equal(player.climbing, false);
  assert.equal(player.latches, 0, 'landing restores the latches');
});

test('ledge to ledge: from one hang, a leap with forward held catches the next edge up, then climbs onto it', () => {
  // a 1.2 m shelf at 3.2 m in front of a wall whose top is 5.6 m
  colliders.addBox({ x: 0, z: 1.6, w: 8, d: 1.2, y0: 0, y1: 3.2 });
  colliders.addBox({ x: 0, z: 3.6, w: 8, d: 2.8, y0: 0, y1: 5.6 });
  input.down.add('KeyW');
  step(0.4);
  press('Space');
  step(1);
  assert.ok(player.climbing && player.hangY === 3.2, 'hanging from the shelf');
  press('Space');
  // the feet brush the shelf's edge on the way up (a frame on the ground), but never stop on it
  let run = 0;
  let longest = 0;
  step(1.5, () => {
    run = player.grounded ? run + 1 : 0;
    longest = Math.max(longest, run);
    if (player.climbing && player.hangY > 5) input.down.delete('KeyW');
  });
  assert.ok(longest <= 2, `never stood on the shelf (${longest} frames on it in a row)`);
  assert.ok(player.climbing && Math.abs(player.hangY - 5.6) < 0.01, `hanging from the upper edge (${player.hangY})`);
  assert.ok(Math.abs(player.pos.z - (2.2 - player.radius - 0.05)) < 0.02, `up against the upper wall (z ${player.pos.z.toFixed(2)})`);
  input.down.add('KeyW');
  press('Space');
  let onTop = false;
  step(1.2, () => {
    if (player.grounded && Math.abs(player.pos.y - 5.6) < 0.05) {
      onTop = true;
      input.down.delete('KeyW');
    }
  });
  assert.ok(onTop, `stood on the top (${player.pos.y.toFixed(2)})`);
});

test('a sheer wall: a hop up it per jump, as many as the latches allow, then nothing until landing', () => {
  wall(30);
  const n = player.derived.latches;
  assert.equal(n, 3 + Math.floor(player.ch.attrs.agility / 35), 'three, and one more for every 35 Agility');
  input.down.add('KeyW');
  step(0.4);
  press('Space');
  step(0.2);
  const spent = [];
  let peak = 0;
  for (let i = 0; i < n + 2; i++) {
    press('Space');
    step(0.2, () => (peak = Math.max(peak, player.pos.y)));
    spent.push(player.latches);
  }
  assert.deepEqual(spent, [...Array.from({ length: n }, (_, i) => i + 1), n, n], `${n} hops, then none`);
  assert.ok(peak > 1.41 + 1, `the hops carried the feet ${peak.toFixed(2)} m up, over a jump's 1.41`);
  assert.equal(player.climbing, false, 'no ledge to catch on a sheer face');
  step(3);
  assert.ok(player.grounded);
  assert.equal(player.latches, 0);
});

test('a wall a little higher than a jump is pulled over, not hung from', () => {
  wall(1.7);
  input.down.add('KeyW');
  step(0.4);
  press('Space');
  let hung = false;
  let onTop = false;
  step(1.5, () => {
    hung ||= player.climbing;
    if (player.grounded && Math.abs(player.pos.y - 1.7) < 0.05) {
      onTop = true;
      input.down.delete('KeyW');
    }
  });
  assert.equal(hung, false, 'never hung: the feet would have touched the ground');
  assert.ok(onTop, `got on top (${player.pos.y.toFixed(2)})`);
});

test('back lets go, and a blow knocks you off', () => {
  wall(3.2);
  input.down.add('KeyW');
  step(0.4);
  press('Space');
  step(1);
  assert.ok(player.climbing);
  input.down.delete('KeyW');
  input.down.add('KeyS');
  step(DT);
  assert.equal(player.climbing, false, 'back lets go');
  input.down.delete('KeyS');
  step(2);
  assert.ok(player.grounded && player.pos.y < 0.01, 'dropped to the ground');

  input.down.add('KeyW');
  press('Space');
  step(1);
  assert.ok(player.climbing, 'caught it again');
  player.stunT = 0.6; // a blow's stun
  step(DT);
  assert.equal(player.climbing, false, 'a blow knocks you off');
});

test('Agility, the agility talents, the Kithari and Updraft add latches; gear does not', () => {
  const ch = player.ch;
  ch.attrs.agility = 70;
  player.recompute();
  assert.equal(player.derived.latches, 5);
  ch.talents = ['cats_grace', 'wall_runner'];
  player.recompute();
  assert.equal(player.derived.latches, 7);
  assert.equal(TALENTS.cats_grace.mods.latches, 1);
  assert.equal(TALENTS.wall_runner.mods.latches, 1);
  const gear = [...Object.values(TRINKETS), ...Object.values(OUTFITS), ...Object.values(ITEMS)];
  assert.deepEqual(gear.filter((g) => g.mods && ('climb' in g.mods || 'latches' in g.mods)).map((g) => g.name), [], 'no gear changes climbing');
});

test('an edge with no room above it for a body is no ledge', () => {
  wall(3.2);
  colliders.addBox({ x: 0, z: 2.5, w: 8, d: 3, y0: 3.2 + 1.7, y1: 8 }); // a storey 1.7 m over the edge
  input.down.add('KeyW');
  step(0.4);
  press('Space');
  let hung = false;
  step(1, () => (hung ||= player.climbing));
  assert.equal(hung, false);
});

test("a thin wall's top is caught, not the floor of the room behind it", () => {
  colliders.addBox({ x: 0, z: 1.15, w: 8, d: 0.3, y0: 0, y1: 6 }); // a 6 m house front, 0.3 m thick
  colliders.addBox({ x: 0, z: 3, w: 8, d: 3.4, y0: 3.0, y1: 3.2 }); // the upper floor inside, at 3.2 m
  input.down.add('KeyW');
  step(0.4);
  press('Space');
  let hung = false;
  step(1, () => (hung ||= player.climbing));
  assert.equal(hung, false, 'no hold on a floor behind the wall');
});

test('a diagonal approach hangs square to the wall, up against it, not askew off its edge', () => {
  wall(3.2);
  G.game.camYaw = 0.7; // 40 degrees off the wall's normal
  input.down.add('KeyW');
  step(0.5);
  press('Space');
  step(1);
  assert.ok(player.climbing, 'caught the edge');
  assert.ok(Math.abs(angleDiffLocal(player.yaw, 0)) < 0.02, `faces the wall square on (yaw ${player.yaw.toFixed(3)})`);
  assert.ok(Math.abs(player.pos.z - (1 - player.radius - 0.05)) < 0.02, `up against the face (z ${player.pos.z.toFixed(2)})`);
  input.down.delete('KeyW');
  step(1);
  assert.ok(player.climbing, 'the hang holds without forward held');
});

test('a jump pressed just after walking off an edge still jumps (coyote time)', () => {
  colliders.addBox({ x: 0, z: -5, w: 8, d: 10, y0: 0, y1: 1 }); // a platform ending at z 0
  player.pos.set(0, 1, -1);
  input.down.add('KeyW');
  let off = -1, jumped = false;
  step(1.2, () => {
    if (off < 0 && !player.grounded && player.pos.z > 0) off = 0;
    else if (off >= 0) off++;
    if (off === 1) press('Space'); // two frames (0.07 s) after the feet left the edge
    if (off > 1 && player.vel.y > 5) jumped = true;
  });
  assert.ok(jumped, 'the late press jumped');
});

test('a jump pressed just before landing jumps on touching down', () => {
  player.pos.set(0, 2, -3);
  player.grounded = false;
  let pressed = false, landed = -1, jumpedAfter = -1, frame = 0;
  step(1.5, () => {
    frame++;
    if (!pressed && player.vel.y < 0 && player.pos.y < 0.45) { press('Space'); pressed = true; }
    if (pressed && landed < 0 && player.grounded) landed = frame;
    if (landed >= 0 && jumpedAfter < 0 && player.vel.y > 5) jumpedAfter = frame - landed;
  });
  assert.ok(pressed && landed >= 0, 'fell and landed');
  assert.ok(jumpedAfter >= 0 && jumpedAfter <= 2, `jumped on landing (${jumpedAfter} frames after)`);
});

function angleDiffLocal(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
