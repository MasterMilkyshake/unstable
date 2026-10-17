// Milestone 2's environment pass (docs/agent/WORLD_DESIGN_PLAN.md, scorecard): defects found in
// the start area, Thornwood and the Rift, each held here so it stays fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Terrain } from '../src/world/terrain.js';
import { AudioSys } from '../src/core/audio.js';
import { LOCATIONS, START_POS, moodRegionAt, landNameAt } from '../src/data/world.js';

let terrain = null;
const T = () => {
  if (!terrain) { terrain = new Terrain(); terrain.build(); }
  return terrain;
};
const locationAt = (x, z) => {
  let best = null;
  for (const l of LOCATIONS) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < l.r && (!best || l.r < best.r)) best = l;
  }
  return best;
};
// what AudioSys plays for a player standing at (x, z), fed the way game.js feeds it
function heard(x, z, night = false) {
  const audio = new AudioSys();
  const region = moodRegionAt(x, z);
  audio.setScene({ island: 'saltreach', region: region && region.id, biome: 'meadow', inRift: false, night, combatHeat: 0, boss: null, sanity: 1 });
  const theme = audio._themeId();
  return { theme, ambient: theme.split(':')[0] };
}

test('the Wash sounds like the shore the drowned wake on, and Saltreach like the town', () => {
  // the Wash is a district of the Saltreach coast (its own Atlas page); its shore theme and
  // surf bed were never heard there, because only the region was looked up
  assert.deepEqual(heard(START_POS.x, START_POS.z), { theme: 'the_wash:day', ambient: 'the_wash' });
  assert.deepEqual(heard(0, -320, true), { theme: 'the_wash:night', ambient: 'the_wash' });
  assert.deepEqual(heard(0, 0), { theme: 'saltreach:day', ambient: 'saltreach' });
  assert.deepEqual(heard(-40, -150), { theme: 'saltreach:day', ambient: 'saltreach' });
});

test('land between named places is called after its region, never the open sea', () => {
  // between the Wash and Seamspire Abbey, on the dune shelves
  assert.equal(locationAt(-110, -334), null);
  assert.equal(landNameAt(-110, -334), 'Saltreach Coast');
  assert.equal(landNameAt(1216, -200), 'Thornwood');
  // every dry cell of the surface outside a named location gets a region's name
  const t = T(), names = new Map();
  let unnamed = 0;
  for (let x = -1800; x <= 1900; x += 24) for (let z = -1700; z <= 1900; z += 24) {
    if (t.heightAt(x, z) < 0.5 || locationAt(x, z)) continue;
    const name = landNameAt(x, z);
    if (!name || /open sea/i.test(name)) unnamed++;
    names.set(name, (names.get(name) || 0) + 1);
  }
  assert.equal(unnamed, 0);
  assert.ok(names.size >= 8, `region names used: ${[...names.keys()].join(', ')}`);
});

test('the Rift\'s crust is never drawn from the surface, and is drawn from the Rift', async () => {
  // its corner reaches inside the far plane of Thornwood's north shore, where its dark back
  // faces stood on the sea horizon as a floating bar
  const THREE = await import('three');
  const { Colliders } = await import('../src/world/colliders.js');
  const { buildRiftCeiling } = await import('../src/world/riftCeiling.js');
  const { inRiftView } = await import('../src/world/rift.js');
  const world = { scene: new THREE.Scene(), terrain: T(), colliders: new Colliders(), animated: [], docks: {}, interactables: [],
    addLight() {}, addInteract(it) { return it; }, addEmitter() {} };
  const { mat } = buildRiftCeiling(world, [], { low: true });
  const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  mat.onBeforeCompile(shader);
  const gate = shader.vertexShader.match(/if \(cameraPosition\.x < ([\d.]+)\) gl_Position = vec4\(0\.0, 0\.0, 2\.0, 1\.0\);/);
  assert.ok(gate, 'the crust is put outside the clip volume for a camera on the surface');
  const edge = parseFloat(gate[1]);
  // the same line the Rift's sky draws between the surface and the Rift
  assert.equal(inRiftView({ x: edge + 1 }), true);
  assert.equal(inRiftView({ x: edge - 1 }), false);
  // the north shore of Thornwood, where it showed, and the arrival shelf, where it is the sky
  assert.ok(1520 < edge && 6000 > edge);
});
