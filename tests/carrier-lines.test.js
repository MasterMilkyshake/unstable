import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/core/globals.js';
import { ACTIONS } from '../src/game/hooks.js';
import '../src/game/ziplines.js';
import { LINE_HANG } from '../src/data/hightoll.js';
import { COAST_LINES, STATION } from '../src/data/carrierLines.js';
import { START_POS } from '../src/data/world.js';
import { buildWorld } from '../tools/reach/world.mjs';
import { ReachGrid, PROFILES, linkTravel } from '../tools/reach/graph.mjs';

// The coast's carrier lines (data/carrierLines.js) in the real world: the line from the Wash's
// rigging tower to the Wash Prospect (the first a new player rides) and the haul line up from
// Brigand Hold's lookout to the Redwake Watchfire and back.
const world = await buildWorld();
const lines = world.carrierLines.filter((l) => COAST_LINES.includes(l.def));
const ground = (x, z, maxY) => Math.max(world.terrain.heightAt(x, z), world.colliders.groundAt(x, z, maxY, 0.2));

test('every coast line is strung, from floor to floor, clear of ground and stone the whole way', () => {
  assert.equal(lines.length, COAST_LINES.length);
  for (const { def, curve, interaction } of lines) {
    assert.ok(Math.abs(ground(curve.a.x, curve.a.z, curve.floorA + 1) - curve.floorA) < 0.15, `${def.id} starts on its floor (${ground(curve.a.x, curve.a.z, curve.floorA + 1).toFixed(2)} against ${curve.floorA.toFixed(2)})`);
    assert.ok(Math.abs(ground(curve.b.x, curve.b.z, curve.floorB + 1) - curve.floorB) < 0.15, `${def.id} lands on its floor`);
    assert.ok(interaction && interaction.kind === 'zipline', `${def.id} can be ridden`);
    const p = new THREE.Vector3();
    let low = Infinity;
    for (let t = 0.02; t <= 0.98; t += 0.002) {
      curve.point(t, p);
      const feet = p.y - LINE_HANG;
      low = Math.min(low, feet - world.terrain.heightAt(p.x, p.z));
      assert.ok(world.terrain.heightAt(p.x, p.z) < feet - 0.3, `${def.id} drags the rider through the ground at t=${t.toFixed(3)}`);
      for (const c of world.colliders.query(p.x, p.z, 0.5, [])) {
        if (c.y1 <= feet + 0.05 || c.y0 >= p.y + 0.2) continue;
        const inside = c.kind === 'box'
          ? (([lx, lz]) => Math.abs(lx) <= c.hw + 0.3 && Math.abs(lz) <= c.hd + 0.3)(world.colliders._local(c, p.x, p.z))
          : Math.hypot(p.x - c.x, p.z - c.z) <= c.r + 0.3;
        // the line's own masts stand at its ends
        if (inside && (t < 0.04 || t > 0.96) && c.kind === 'cyl') continue;
        assert.ok(!inside, `${def.id} runs the rider into ${c.tag || 'something'} at t=${t.toFixed(3)} (${c.y0.toFixed(1)}-${c.y1.toFixed(1)}, feet ${feet.toFixed(1)})`);
      }
    }
    assert.ok(low > 0.3, `${def.id}: the rider's feet clear the ground by ${low.toFixed(2)} m at the least`);
  }
});

test('a ride on each coast line sets the rider down at its far end, a haul line slower than a run down', () => {
  const secs = {};
  for (const line of lines) {
    const p = { pos: new THREE.Vector3(line.curve.a.x, line.curve.floorA, line.curve.a.z), vel: new THREE.Vector3(), yaw: 0, fallStart: 0, zip: null, grounded: true };
    G.player = p;
    G.world = world;
    assert.ok(ACTIONS.rideLine(line.def.id), `${line.def.id} takes a rider`);
    let t = 0;
    while (p.zip && t < 90) {
      p.zip.step(p, 1 / 60);
      t += 1 / 60;
    }
    assert.equal(p.zip, null, `${line.def.id} ends`);
    assert.ok(Math.hypot(p.pos.x - line.curve.b.x, p.pos.z - line.curve.b.z) < 0.1 && Math.abs(p.pos.y - line.curve.floorB) < 0.2, `${line.def.id} sets the rider down on its landing`);
    secs[line.def.id] = t;
  }
  assert.ok(secs.line_watchfire > secs.line_watchfire_down, `up ${secs.line_watchfire.toFixed(1)} s, down ${secs.line_watchfire_down.toFixed(1)} s`);
});

test('each station\'s stair walks from the ground to its platform', () => {
  for (const st of world.lineStations) {
    const s = st.def;
    const grid = new ReachGrid(world, { x0: s.x - 30, x1: s.x + 30, z0: s.z - 30, z1: s.z + 30 });
    const foot = grid.nodeNear(st.foot.x, st.foot.y, st.foot.z, 1.5, 1.5);
    assert.ok(foot >= 0, `${s.id}: ground at the stair's foot`);
    const found = grid.search([foot], PROFILES[3], { climbs: false, lines: false });
    const top = grid.nodesNear(s.x, st.top, s.z, 1.2, 0.3);
    assert.ok(top.length && top.some((q) => found.need[q] === 0), `${s.id}: the platform at ${st.top.toFixed(1)} m is walked to from the stair's foot`);
  }
});

test('the Wash Prospect and the Redwake Watchfire are reached by line from the Wash at three latches', () => {
  // the Watchfire's upland and the Seamspire spur, each with its line's station and the
  // ground round the far end, walked and climbed with three latches
  const asks = [
    { name: 'the Wash Prospect', box: { x0: -260, x1: 60, z0: -400, z1: -200 }, start: [START_POS.x, START_POS.z], at: [-176, -240] },
    { name: 'the Watchfire chest', box: { x0: 1260, x1: 1560, z0: 60, z1: 320 }, start: [STATION.hold_lookout.x + 8, STATION.hold_lookout.z - 12], at: [1506.2, 252.2] },
  ];
  for (const a of asks) {
    const grid = new ReachGrid(world, a.box);
    linkTravel(grid, world);
    const s = grid.nodeNear(a.start[0], world.terrain.heightAt(...a.start), a.start[1], 3, 3);
    const with3 = grid.search([s], PROFILES[3]);
    const walked = grid.search([s], PROFILES[3], { lines: false });
    const near = grid.nodesNear(a.at[0], ground(a.at[0], a.at[1], 400), a.at[1], 3, 2.5);
    const need = (f) => near.reduce((m, q) => Math.min(m, f.need[q]), 255);
    assert.ok(need(with3) <= 3, `${a.name} is reached at three latches (needs ${need(with3)})`);
    const way = grid.route(with3, near.find((q) => with3.need[q] === need(with3)));
    assert.ok(way.steps.some((st) => st.kind === 'line'), `${a.name}: by the line (${JSON.stringify(way.steps.filter((st) => st.kind !== 'jump'))})`);
    if (a.name.includes('Watchfire')) assert.ok(need(walked) > 3, `without the line the Watchfire needs ${need(walked)} latches`);
  }
});
