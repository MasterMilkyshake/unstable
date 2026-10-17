import test from 'node:test';
import assert from 'node:assert/strict';
import { ROADS } from '../src/data/roads.js';
import { CIVIC_ROADS } from '../src/data/architecture.js';
import { samplePath } from '../src/world/paths.js';
import { settledRuns, settlementWeight } from '../src/world/wayfinding.js';

// Charts ink a town's streets, never the way between towns: that is found on foot.
test('charts ink only the settled stretches of a route', () => {
  let open = 0;
  for (const road of ROADS) {
    const samples = samplePath(road);
    for (const run of settledRuns(samples)) {
      assert.ok(run.length > 1, `${road.id} has a one-point run`);
      for (const p of run) assert.ok(settlementWeight(p.x, p.z) >= 0.5, `${road.id} inks open country at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
    }
    open += samples.filter(p => settlementWeight(p.x, p.z) < 0.5).length;
  }
  assert.ok(open > 200, 'the overland ways mostly cross open country');
  // the harbor approach into Saltreach is a street, and still drawn
  assert.ok(settledRuns(samplePath(CIVIC_ROADS[1])).length > 0, 'town streets are still charted');
});
