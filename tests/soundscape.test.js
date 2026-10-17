import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWorld } from '../tools/reach/world.mjs';

// The world's sound (docs/agent/WORLD_LIFE_PLAN.md, task 7): where the player stands decides
// the place's own layers (game/soundscape.js), and the audio system plays them, the world's
// event calls and a theme for every great foe without an error (core/audio.js), driven here
// through a stand-in for the browser's AudioContext.
const world = await buildWorld();
const { placeAt } = await import('../src/game/soundscape.js');
const { AudioSys } = await import('../src/core/audio.js');
const { ENEMIES } = await import('../src/data/enemies.js');
const { G } = await import('../src/core/globals.js');

const at = (x, z, y) => placeAt(world, new THREE.Vector3(x, y ?? world.groundAt(x, z, 400), z));

test('the place is heard where it is: the strand, a town, indoors, the forest, the heights, at sea', () => {
  const strand = at(30, -384);
  assert.ok(strand.shore > 0.5, `the Wash's strand hears the surf (${strand.shore.toFixed(2)})`);
  const barracks = world.interiors.filter((i) => Math.hypot(i.x - -30, i.z - -32) < 60);
  assert.ok(barracks.length >= 6, 'Saltreach has houses round the Watch yard');
  const yard = at(-29, -38);
  assert.ok(yard.town > 0.8 && yard.shore < 0.3, `the Watch yard is a town (${yard.town.toFixed(2)}), out of the surf`);
  const inn = world.interiors.find((i) => i.name === 'The Salted Anchor');
  assert.ok(inn, 'the Salted Anchor stands');
  const inside = at(inn.x, inn.z, world.groundAt(inn.x, inn.z, world.terrain.heightAt(inn.x, inn.z) + 2.5));
  assert.equal(inside.indoor, true, 'inside the inn the world outside is muffled');
  assert.equal(yard.indoor, false, 'and not in the open yard');
  const wood = at(1240, 60);
  assert.ok(world.biomeAt(1240, 60) === 'forest' ? wood.green === 1 : wood.green >= 0, 'Thornwood is green');
  const sea = placeAt(world, new THREE.Vector3(700, 0, -150), { afloat: true });
  assert.equal(sea.shore, 1, 'afloat, the sea all round');
  const high = at(-118, 202);
  assert.ok(high.height > 0.1 && high.height > strand.height, `the wind rises with height (${high.height.toFixed(2)} on the Lampwright's Crown)`);
});

// ---------------------------------------------------------------- a stand-in AudioContext
const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
let made = 0;
const node = (extra = {}) => { made++; return { connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), ...extra }; };
class FakeContext {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); this.state = 'running'; }
  createGain() { return node(); }
  createBiquadFilter() { return node({ type: 'lowpass' }); }
  createOscillator() { return node({ type: 'sine' }); }
  createBufferSource() { return node({ buffer: null, loop: false }); }
  createConvolver() { return node({ buffer: null }); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() {}
}

test('the audio plays the place, the world\'s calls and every great foe\'s theme without a fault', () => {
  globalThis.window ||= {};
  window.AudioContext = FakeContext;
  const a = new AudioSys();
  a.init();
  assert.ok(a.ready && a.placeBed && a.muffle, 'the place bed and the muffle are built');
  a.setScene({ island: 'saltreach', region: 'saltreach', biome: 'meadow', inRift: false, night: true, combatHeat: 0, boss: null, sanity: 1 });
  for (const place of [{ shore: 1 }, { town: 1 }, { green: 1 }, { marsh: 1 }, { fire: 1, indoor: true }, { height: 1 }]) {
    a.setPlace(place);
    for (let i = 0; i < 120; i++) { a.ctx.currentTime += 1 / 30; a.update(1 / 30); }
  }
  a.setScene({ night: false });
  for (let i = 0; i < 400; i++) { a.ctx.currentTime += 1 / 30; a.update(1 / 30); }
  const before = made;
  for (const name of ['lifeDrum', 'lifeHorn', 'lifeHail', 'lifeHunt']) a.play(name, { vol: 0.8 });
  assert.ok(made - before > 12, 'the world\'s calls are voiced');
  // every great foe has music of its own kind, never the sea's
  const foes = Object.entries(ENEMIES).filter(([, e]) => e.boss).map(([id]) => id).concat(['vice_warden', 'grand_warden']);
  for (const id of foes) {
    const th = AudioSys.resolveTheme('boss:' + id);
    assert.ok(th.tempo < 1 && th.perc > 0, `${id} has a fight's theme`);
  }
  assert.notDeepEqual(AudioSys.resolveTheme('boss:duelist').scale, AudioSys.resolveTheme('boss:warlord').scale, 'Sera Vane is not Kaelen');
  assert.deepEqual(AudioSys.resolveTheme('boss:vice_warden').scale, AudioSys.resolveTheme('boss:grand_warden').scale, 'the wardens share a march');
  a.setScene({ boss: 'hookbeak', combatHeat: 1 });
  assert.equal(a._themeId(), 'boss:hookbeak', 'a lair\'s master gets the fight music too');
  delete window.AudioContext;
  G.audio = null;
});

test('every great region has music of its own', () => {
  const a = new AudioSys();
  a.mode = 'play';
  // the eight lands with towns; the outlying rocks take their biome's music or the sea's
  for (const id of ['saltreach', 'thornwood', 'shimmerfen', 'frosthollow', 'ashen_spire', 'verdance', 'meridian', 'the_hush']) {
    a.scene = { island: id, region: id, biome: 'meadow', inRift: false, night: false, boss: null };
    assert.equal(a._themeId(), id + ':day', `${id} plays its own theme`);
  }
});
