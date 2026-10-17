// The Red Trail planner stall (task 6): walkers stalled between Rook's Landing and Brigand Hold,
// though a player walks it. Four causes, each with a test: walkers froze on a pier over water;
// physics judged a sharp 0.35 m road verge over one step and called it a wall where the grid
// (judging over a cell) had routed them; the stuck watch threw away a search still running; and it
// kept renewing an "unreachable" mark, so a cut-off walker never searched again. Also the search
// cap: 9,000 nodes fell just short of the climb into the Hold (9,351).
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, Actor, arena, enemy, DT } from './support/arena.js';

const { NAV_BUDGET } = await import('../src/entities/nav.js');

function chaser(x, z, y = 0) {
  const e = enemy('brigand', x, z, { y });
  e.ai.atkCd = 99;
  return e;
}
function walk(e, tx, tz, secs, ty = NaN) {
  for (let t = 0; t < secs; t += DT) {
    G.time += DT;
    e.navTo(tx, tz, ty, 5.3, DT);
    e.physics(DT);
    if (Math.hypot(e.pos.x - tx, e.pos.z - tz) < 1) return t;
  }
  return Infinity;
}

test('a walker on a pier over the sea walks along it (the deck bears it, not the sea bed)', () => {
  const { colliders } = arena();
  G.world.terrain.heightAt = () => -6; // open water under the pier
  colliders.addBox({ x: 0, z: 10, w: 3, d: 24, y0: -6, y1: 1, walkable: true });
  const e = chaser(0, 0, 1);
  const t = walk(e, 0, 18, 8);
  assert.ok(t < 8, `walked the pier (stood at z ${e.pos.z.toFixed(1)})`);
  assert.ok(e.pos.y > 0.9, 'on the deck');
  assert.equal(e.canStepTo(4, 10), false, 'but not off its side into the water');
});

test('a sharp 0.35 m lip on gentle ground is stepped over; a 0.6 m face is a wall', () => {
  arena();
  const lip = (h) => (x, z) => (z > 3 ? h : 0) + z * 0.02;
  G.world.terrain.heightAt = lip(0.35);
  const e = chaser(0, 0);
  assert.ok(walk(e, 0, 6, 4) < 4, `over the lip (stopped at z ${e.pos.z.toFixed(2)})`);
  arena();
  G.world.terrain.heightAt = lip(0.6);
  const f = chaser(0, 0);
  for (let t = 0; t < 2; t += DT) {
    f.moveToward(0, 6, 5.3, DT);
    f.physics(DT);
  }
  assert.ok(f.pos.z < 3.1, `the face holds (z ${f.pos.z.toFixed(2)})`);
});

test('a walker waits for a route being planned instead of pushing into the wall, so a slow search finishes', (t) => {
  const { colliders } = arena();
  colliders.addBox({ x: 0, z: 0, w: 30, d: 0.6, y0: -1, y1: 4, walkable: false });
  const ms = NAV_BUDGET.ms;
  NAV_BUDGET.ms = 0; // a starved step: the minimum nodes a step, so the search takes many steps
  t.after(() => (NAV_BUDGET.ms = ms));
  const e = chaser(0, -4);
  let pushedWhilePlanning = 0;
  let searchedFor = 0;
  let arrived = Infinity;
  for (let s = 0; s < 30; s += DT) {
    G.time += DT;
    e.navTo(0, 6, NaN, 5.3, DT);
    if (e.nav.search && !e.nav.path) {
      searchedFor += DT;
      if (Math.hypot(e.vel.x, e.vel.z) > 1) pushedWhilePlanning++;
    }
    e.physics(DT);
    if (Math.hypot(e.pos.x, e.pos.z - 6) < 1.2) {
      arrived = s;
      break;
    }
  }
  assert.ok(searchedFor > 0.8, `a search longer than the stuck watch's 0.8 s (${searchedFor.toFixed(2)} s)`);
  assert.equal(pushedWhilePlanning, 0, 'no pushing into the wall while it plans');
  assert.ok(arrived < 30, 'and the walker gets round');
});

test('an unreachable mark is set once and expires: the stuck watch no longer renews it', () => {
  arena();
  const e = chaser(0, 0);
  e.navTo(10, 0, NaN, 5.3, DT); // creates its nav state
  const nav = e.nav;
  nav.stuck = 3;
  for (let i = 0; i < 5; i++) {
    G.time += 0.9;
    nav.watchT = 0.9;
    nav.wx = e.pos.x;
    nav.wz = e.pos.z;
    e.navWatch(nav, 5.3, 0.9 / 30, 10, 0);
  }
  assert.equal(nav.failed.length, 1, 'marked once');
  const until = nav.failed[0][2];
  assert.ok(until - G.time < 8 - 2, 'not pushed back by later stuck checks');
  G.time = until + 0.1;
  assert.equal(e.navUnreachable(10, 0), false, 'and it lapses');
});
