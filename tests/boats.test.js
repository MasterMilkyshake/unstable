import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWorld } from '../tools/reach/world.mjs';

// Sailing in the real world, headlessly (entities/boat.js): one test per handling defect found
// in docs/agent/WORLD_LIFE_PLAN.md's sea task. A boat turned on the spot at rest; it bounced
// back off a coast instead of running along it; it sailed through piers and moles (only the
// terrain ahead stopped it); hulls passed through each other; the wind did nothing; and someone
// stepping off was put down 2.2 m to starboard whatever was there.
const world = await buildWorld();
const { G } = await import('../src/core/globals.js');
const { Boat } = await import('../src/entities/boat.js');
const { ACTIONS } = await import('../src/game/hooks.js');
const { SWIM_Y } = await import('../src/entities/actor.js');

const DT = 1 / 30;
G.world = world;
G.scene = world.scene;
let wind = null;
ACTIONS.wind = () => wind;
beforeEach(() => {
  G.time = 0;
  G.game = { boats: [] };
  G.vfx = null;
  wind = null;
});
function boat(x, z, yaw, type = 'sloop') {
  const b = new Boat(new THREE.Vector3(x, 0, z), yaw, type);
  G.game.boats.push(b);
  return b;
}
function sail(b, secs, throttle, turn = 0, each) {
  for (let t = 0; t < secs; t += DT) {
    G.time += DT;
    b.steer(DT, throttle, turn);
    if (each) each(t);
  }
}
const deep = (x, z) => world.terrain.heightAt(x, z) < -6;
// a point of open water: deep all round for `r` metres
function openWater(x, z, r = 60) {
  for (let a = 0; a < 16; a++) if (!deep(x + Math.sin(a) * r, z + Math.cos(a) * r)) return false;
  return deep(x, z);
}

test('a rudder needs way on: a boat at rest hardly turns, one under way turns well', () => {
  assert.ok(openWater(700, -150), 'the test water is open');
  const b = boat(700, -150, 0);
  sail(b, 1, 0, 1);
  assert.ok(Math.abs(b.yaw) < 0.2, `at rest it turned ${b.yaw.toFixed(2)} rad in a second`);
  sail(b, 8, 1);
  const y0 = b.yaw;
  sail(b, 1, 1, 1);
  assert.ok(b.yaw - y0 > 0.6, `under way it turned ${(b.yaw - y0).toFixed(2)} rad in a second`);
});

test('a boat sailed into a coast runs along it, never backs off it or goes aground', () => {
  // from open water, find the way to the nearest shore
  const [x0, z0] = [700, -150];
  let best = null;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
    for (let r = 10; r < 400; r += 5) {
      if (world.terrain.heightAt(x0 + Math.sin(a) * r, z0 + Math.cos(a) * r) > -0.8) {
        if (!best || r < best.r) best = { a, r };
        break;
      }
    }
  }
  assert.ok(best, 'a shore within 400 m');
  // start 40 m off it, heading in at 45 degrees
  const sx = x0 + Math.sin(best.a) * (best.r - 40), sz = z0 + Math.cos(best.a) * (best.r - 40);
  const b = boat(sx, sz, best.a + Math.PI / 4);
  let back = 0, aground = 0, touched = null;
  sail(b, 25, 1, 0, () => {
    if (b.speed < -0.01) back++;
    if (world.terrain.heightAt(b.pos.x, b.pos.z) > -0.5) aground++;
    if (!touched && b.contact(b.pos.x + Math.sin(b.yaw) * (b.def.length * 0.5 + 1), b.pos.z + Math.cos(b.yaw) * (b.def.length * 0.5 + 1))) touched = b.pos.clone();
  });
  assert.ok(touched, 'it reached the shore');
  assert.equal(back, 0, 'it never bounced back');
  assert.equal(aground, 0, 'its middle never stood on land');
  assert.ok(b.pos.distanceTo(touched) > 15, `it ran ${b.pos.distanceTo(touched).toFixed(1)} m along the shore after meeting it`);
});

test('a pier stops a hull: sailed at its side, the boat never passes through it', () => {
  // a pier whose middle stands in deep enough water that the terrain alone would let a boat by
  let pick = null;
  for (const [id, d] of Object.entries(world.docks)) {
    const mid = d.start.clone().lerp(d.end, 0.5);
    const perp = new THREE.Vector3(d.dir.z, 0, -d.dir.x);
    let ok = true;
    for (let s = -25; s <= 25; s += 2.5) if (world.terrain.heightAt(mid.x + perp.x * s, mid.z + perp.z * s) > -1.2) ok = false;
    if (ok) { pick = { id, d, mid, perp }; break; }
  }
  assert.ok(pick, 'a pier standing in open water');
  const { mid, perp } = pick;
  const b = boat(mid.x + perp.x * 25, mid.z + perp.z * 25, Math.atan2(-perp.x, -perp.z), 'skiff');
  let closest = Infinity;
  sail(b, 10, 1, 0, () => {
    const side = (b.pos.x - mid.x) * perp.x + (b.pos.z - mid.z) * perp.z;
    closest = Math.min(closest, side);
  });
  assert.ok(closest > 1.6, `the hull's middle came to ${closest.toFixed(2)} m of the pier's centre line (its planking is 1.6 m either side)`);
});

test('hulls keep apart', () => {
  const a = boat(700, -170, 0), b = boat(700, -130, Math.PI);
  let min = Infinity;
  for (let t = 0; t < 6; t += DT) {
    G.time += DT;
    a.steer(DT, 1, 0);
    b.steer(DT, 1, 0);
    min = Math.min(min, a.pos.distanceTo(b.pos));
  }
  assert.ok(min > (a.def.length + b.def.length) * 0.3 * 0.7, `the two sloops came within ${min.toFixed(2)} m`);
});

test('the wind in the sail: faster running before it, slower beating into it', () => {
  wind = new THREE.Vector3(5, 0, 0);
  const run = boat(700, -150, Math.PI / 2), beat = boat(700, -300, -Math.PI / 2);
  sail(run, 12, 1);
  sail(beat, 12, 1);
  const max = run.def.speed;
  assert.ok(Math.abs(run.speed - max * 1.15) < 0.4, `before the wind ${run.speed.toFixed(2)} m/s against ${max}`);
  assert.ok(Math.abs(beat.speed - max * 0.85) < 0.4, `into the wind ${beat.speed.toFixed(2)} m/s`);
});

test('stepping off: onto the pier beside a moored boat, into open water at sea, never into a wall', () => {
  const [id, d] = Object.entries(world.docks)[0];
  const perp = new THREE.Vector3(d.dir.z, 0, -d.dir.x);
  const moored = boat(d.end.x + perp.x * 3.6, d.end.z + perp.z * 3.6, d.yaw, 'skiff');
  const spot = moored.landingSpot();
  assert.ok(spot && spot.y > SWIM_Y + 0.2, `beside the pier at ${id} the spot is dry (y ${spot && spot.y.toFixed(2)})`);
  const probe = spot.clone().setY(spot.y + 0.05), before = probe.clone();
  world.colliders.resolve(probe, 0.4, 1.8);
  assert.ok(probe.distanceTo(before) < 0.06, 'and nothing stands in it');
  const atSea = boat(700, -150, 0);
  const wet = atSea.landingSpot();
  assert.ok(wet && Math.abs(wet.y - SWIM_Y) < 1e-6, 'at sea, the water');
});
