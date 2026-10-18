// Water is never ground (task: "you can just keep jumping on water"): in swim-deep water a press
// gives one small stroke up and the next waits, a jump pressed on the way down is spent on the
// splash, and where the feet reach the bed the jump is the ordinary one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, arena, player, step, DT } from './support/arena.js';

const { SWIM_Y } = await import('../src/entities/actor.js');
const { SWIM_STROKE } = await import('../src/entities/player.js');

function inSea(depth) {
  arena();
  G.world.terrain.heightAt = () => -depth;
  G.world.groundAt = () => -depth;
  const p = player();
  return p;
}

test('holding or mashing Jump in deep water never chains into jumps along the surface', () => {
  const p = inSea(6);
  p.pos.set(0, SWIM_Y, 0);
  p.grounded = false;
  p.swimming = true;
  let top = -Infinity, strokes = 0, wasSwimming = true;
  step(6, (t) => {
    if (Math.round(t / DT) % 2 === 0) G.input.pressed.add('Space');
    top = Math.max(top, p.pos.y);
    if (wasSwimming && !p.swimming && p.vel.y > 0) strokes++;
    wasSwimming = p.swimming;
  });
  assert.ok(top - SWIM_Y < 0.6, `rose ${(top - SWIM_Y).toFixed(2)} m over the surface at most`);
  assert.ok(strokes <= Math.ceil(6 / SWIM_STROKE.wait), `${strokes} strokes in 6 s`);
  assert.ok(p.swimming, 'still swimming');
});

test('a jump pressed just before splashing down is not carried into the water', () => {
  const p = inSea(6);
  p.pos.set(0, SWIM_Y + 0.25, 0);
  p.grounded = false;
  p.swimming = false;
  p.vel.y = -6;
  G.input.pressed.add('Space'); // in the air, before the splash: buffered, waiting for ground
  step(DT);
  let rose = false;
  step(0.5, () => { if (p.vel.y > 1) rose = true; });
  assert.ok(p.swimming, 'in the water');
  assert.ok(!rose, 'the buffered press did not fire on the water');
});

test('wading where the feet touch the bed still jumps as on land', () => {
  const p = inSea(0.4);
  p.pos.set(0, -0.4, 0);
  p.grounded = true;
  p.groundH = -0.4;
  step(DT);
  G.input.pressed.add('Space');
  step(DT);
  assert.ok(!p.swimming, 'wading, not swimming');
  assert.ok(p.vel.y > 7, `an ordinary jump (${p.vel.y.toFixed(1)} m/s)`);
});
