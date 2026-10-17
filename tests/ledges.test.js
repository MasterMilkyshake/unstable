import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDGE_LINES, LEDGE_STAIRS, PITCH } from '../src/data/ledges.js';
import { buildWorld } from '../tools/reach/world.mjs';
import { ReachGrid, PROFILES } from '../tools/reach/graph.mjs';

// The ledge-built world's climbing lines (data/ledges.js, world/ledges.js) in the real world:
// each line's pitches keep to the band its chain names, and the player's own climb (the reach
// graph's frame-by-frame model, held to the controller by tests/ledge-reach.test.js) takes
// exactly that many latches from the line's foot to its top: a chain-4 line is out of reach
// at three latches, a chain-5 line at four. Each hidden stair is walked to its top.
// every colour the world names is one its kit knows (three.js warns of an unknown name)
const colourWarnings = [];
const warn = console.warn;
console.warn = (...a) => { if (String(a[0]).includes('Unknown color')) colourWarnings.push(a.join(' ')); else warn(...a); };
const world = await buildWorld();
console.warn = warn;

test('the world builds without an unknown colour', () => {
  assert.deepEqual(colourWarnings, []);
});

// a grid round one line only, so that the line is the only way up inside it
function lineGrid(l) {
  const xs = [l.start.x, ...l.treads.map((t) => t.x)], zs = [l.start.z, ...l.treads.map((t) => t.z)];
  const pad = (l.def.w ?? 2.6) / 2 + 2;
  return new ReachGrid(world, { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad });
}

test('every line is built where it was authored, from a foot on the ground to a shelf top', () => {
  assert.equal(world.ledgeLines.length, LEDGE_LINES.length);
  for (const l of world.ledgeLines) {
    assert.ok(l.top - l.g0 > 2, `${l.def.id}: a face of ${(l.top - l.g0).toFixed(1)} m`);
    assert.ok(l.pitches.every((p) => p > 0.5), `${l.def.id}: no riser under half a metre (${l.pitches.map((p) => p.toFixed(2))})`);
  }
});

test('each line\'s pitches keep to its chain\'s band', () => {
  for (const l of world.ledgeLines) {
    const chain = l.def.chain;
    const [lo, hi] = PITCH[chain];
    const tallest = Math.max(...l.pitches);
    assert.ok(tallest <= hi, `${l.def.id}: its tallest pitch ${tallest.toFixed(2)} m is over chain ${chain}'s ${hi} m`);
    if (chain > 1) assert.ok(tallest >= lo, `${l.def.id}: its tallest pitch ${tallest.toFixed(2)} m is under chain ${chain}'s ${lo} m`);
  }
});

test('the climb up each line takes the latches its chain names, and no fewer', () => {
  for (const l of world.ledgeLines) {
    const grid = lineGrid(l);
    const start = grid.nodeNear(l.start.x, l.start.y, l.start.z, 1.5, 1.5);
    assert.ok(start >= 0, `${l.def.id}: ground at its foot`);
    const top = l.treads[l.treads.length - 1];
    const near = grid.nodesNear(top.x, top.y, top.z, 2, 0.4);
    const need = (prof) => {
      const f = grid.search([start], prof);
      return near.reduce((m, q) => Math.min(m, f.need[q]), 255);
    };
    const chain = l.def.chain;
    const at3 = need(PROFILES[3]), at4 = need(PROFILES[4]), at5 = need(PROFILES[5]);
    if (chain <= 3) assert.ok(at3 <= 3, `${l.def.id} (chain ${chain}) is climbed at three latches (needs ${at3})`);
    if (chain === 1) assert.equal(at3, 1, `${l.def.id}: one latch a pitch`);
    if (chain === 4) {
      assert.ok(at3 > 3, `${l.def.id} (chain 4) stops a three-latch climber (needs ${at3})`);
      assert.ok(at4 <= 4, `${l.def.id} (chain 4) is climbed at four (needs ${at4})`);
    }
    if (chain === 5) {
      assert.ok(at4 > 4, `${l.def.id} (chain 5) stops a four-latch climber (needs ${at4})`);
      assert.ok(at5 <= 5, `${l.def.id} (chain 5) is climbed at five (needs ${at5})`);
    }
  }
});

test('each hidden stair is walked from its foot to its top', () => {
  assert.equal((world.ledgeStairs || []).length, LEDGE_STAIRS.length);
  for (const s of world.ledgeStairs) {
    // a scaffold's way up starts at its stair's foot; a cut stair at its own foot
    const [fx, fz] = s.foot ? [s.foot.x, s.foot.z] : s.def.foot;
    const xs = [fx, s.end.x], zs = [fz, s.end.z];
    const grid = new ReachGrid(world, { x0: Math.min(...xs) - 8, x1: Math.max(...xs) + 8, z0: Math.min(...zs) - 8, z1: Math.max(...zs) + 8 });
    const start = grid.nodeNear(fx, world.terrain.heightAt(fx, fz), fz, 2, 1.5);
    const f = grid.search([start], PROFILES[3], { climbs: false });
    const near = grid.nodesNear(s.end.x, s.top, s.end.z, 2.5, 0.6);
    assert.ok(near.some((q) => f.need[q] === 0), `${s.def.id}: its top at ${s.top} m is walked to`);
  }
});
