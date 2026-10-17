// Movement polish (task 7): a lunge stops at a thin wall; a fall is measured from the top of the
// arc it ends, so a hop off a wall low in a long drop breaks it; a slide-jump keeps its speed in
// the air and carries it a moment on landing; a vault onto a narrow wall's top stops on it.
// A real Player through the real Input's key sets on flat ground (tests/support/arena.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, Actor, arena, player, step, DT } from './support/arena.js';

test('a lunge at 30 m/s stops at a 0.3 m wall instead of passing through it', () => {
  const { colliders } = arena();
  colliders.addBox({ x: 0, z: 2, w: 6, d: 0.3, y0: 0, y1: 3, walkable: false });
  const a = new Actor({ team: 'enemy', hp: 100 });
  a.grounded = true;
  a.vel.set(0, 0, 30);
  for (let i = 0; i < 8; i++) a.physics(DT);
  assert.ok(a.pos.z < 2 - 0.15, `stopped in front (z ${a.pos.z.toFixed(2)})`);

  // a katana's Iaido Flash (a 30 m/s lunge) at the same wall
  arena().colliders.addBox({ x: 0, z: 2, w: 6, d: 0.3, y0: 0, y1: 3, walkable: false });
  const p = player({ weapon: 'driftsteel_katana' });
  p.startCrit();
  assert.ok(p.atk.def.lunge >= 30);
  step(1.2);
  assert.ok(p.pos.z < 2, `the swordsman stayed on this side (z ${p.pos.z.toFixed(2)})`);
});

test('a long fall hurts; a hop off a wall low in it breaks the fall', () => {
  const fall = (hop) => {
    const { colliders, input } = arena();
    colliders.addBox({ x: 0, z: 1.2, w: 8, d: 0.6, y0: 0, y1: 20, walkable: false });
    const p = player();
    p.pos.set(0, 12, 0);
    p.grounded = false;
    p.fallStart = 12;
    p.yaw = 0;
    G.game.camYaw = 0;
    const hp = p.hp;
    let hopped = false;
    step(3, () => {
      if (hop && !hopped && p.pos.y < 1.3) {
        input.down.add('KeyW');
        input.pressed.add('Space');
        hopped = true;
      }
      if (p.grounded && p.pos.y < 0.1 && (hopped || !hop)) return false;
    });
    step(0.2);
    return hp - p.hp;
  };
  assert.ok(fall(false) > 10, 'twelve metres hurt');
  assert.equal(fall(true), 0, 'the hop broke the fall');
});

test('a slide-jump keeps its speed through the air and carries it a moment on landing', () => {
  const { input } = arena();
  const p = player();
  input.down.add('KeyW');
  input.down.add('ShiftLeft');
  step(1.2);
  const sprint = p.speed;
  input.pressed.add('KeyC');
  step(0.2);
  input.pressed.add('Space');
  step(DT);
  const off = p.speed;
  step(0.3);
  assert.ok(p.speed > off * 0.95 && p.speed > sprint * 1.2, `in the air ${p.speed.toFixed(1)} m/s (sprint ${sprint.toFixed(1)}, off the slide ${off.toFixed(1)})`);
  let landed = false;
  step(1.5, () => {
    if (p.grounded) landed = true;
    if (landed) return false;
  });
  step(0.15);
  assert.ok(p.speed > sprint * 0.97, `0.15 s after landing ${p.speed.toFixed(1)} m/s`);
  step(0.6);
  assert.ok(Math.abs(p.speed - sprint) < 0.6, 'and settles back to a sprint');
});

test('a vault onto a narrow wall\'s top stops on it, not over its far side', () => {
  const { colliders, input } = arena();
  colliders.addBox({ x: 0, z: 1.4, w: 8, d: 0.8, y0: 0, y1: 3.2 }); // 0.8 m thick
  const p = player();
  input.down.add('KeyW');
  step(0.3);
  input.pressed.add('Space');
  step(0.8, () => {
    if (p.climbing) return false;
  });
  assert.ok(p.climbing, 'hanging from the edge');
  input.pressed.add('Space');
  // let go of W the moment the feet are on the top: the vault itself must not carry on
  step(1, () => {
    if (p.grounded && p.pos.y > 3) {
      input.down.delete('KeyW');
      return false;
    }
  });
  step(0.6);
  assert.ok(Math.abs(p.pos.y - 3.2) < 0.05 && p.grounded, `standing on the top (y ${p.pos.y.toFixed(2)}, z ${p.pos.z.toFixed(2)})`);
});

test('E leaves a boat, as the prompts say (the game no longer spends the key on interactables)', () => {
  const { input, game } = arena();
  const p = player();
  game.world = G.world;
  G.world.interactables = [];
  game.npcs = [];
  game.boats = [];
  let left = false;
  const boat = { pos: p.pos.clone(), yaw: 0, seatPos: () => p.pos.clone(), leave: () => (left = true), driver: p, drive() {} };
  p.boat = boat;
  input.pressed.add('KeyE');
  game.useInteractKey();
  p.update(DT);
  assert.ok(left && p.boat === null, 'off the boat');
});

test('leaving a boat steps onto the dry spot the boat finds beside it (a pier, a beach), else over the side', () => {
  arena();
  const p = player();
  const pier = new p.pos.constructor(3, 1.2, 0.5);
  const at = (landingSpot) => {
    const boat = { pos: new p.pos.constructor(0, 0, 0), yaw: 0, leave() {}, ...(landingSpot ? { landingSpot } : {}) };
    p.boat = boat;
    p.leaveBoat();
    return p.pos.clone();
  };
  assert.ok(at(() => pier.clone()).distanceTo(pier) < 1e-9, 'onto the pier');
  const side = at(() => null);
  assert.ok(Math.abs(side.x - 2.2) < 1e-9 && Math.abs(side.z) < 1e-9, 'no dry spot: 2.2 m to starboard, as before');
  const old = at(null);
  assert.ok(old.distanceTo(side) < 1e-9, 'a boat without landingSpot: the same');
});
