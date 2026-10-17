import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import { G } from '../src/core/globals.js';

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
globalThis.document = { addEventListener() {} };
globalThis.window = { addEventListener() {} };
const { Spawner, SPAWNS_PER_FRAME } = await import('../src/game/game.js');
const { spawnSpot } = await import('../src/world/spawnSpot.js');
const { Colliders } = await import('../src/world/colliders.js');

let game;
beforeEach(() => {
  G.world = { terrain: { heightAt: () => 0 }, colliders: new Colliders() };
  game = {
    ch: { bossesDefeated: [] },
    spawnBudget: 0,
    built: 0,
    spawnEnemy(type, pos) {
      this.built++;
      return { type, pos, aggro: false };
    },
  };
});
const camp = (x, count) => new Spawner({ type: 'hollow', x, z: 0, count, radius: 4, respawn: 60 }, game);
// One rendered frame of `steps` fixed simulation steps, the player at the origin.
function frame(spawners, steps = 1) {
  game.spawnBudget = SPAWNS_PER_FRAME;
  for (let i = 0; i < steps; i++) for (const s of spawners) s.update(1 / 30, [{ x: 0, z: 0 }]);
}

test('waking camps queue their enemies and build a few a frame, not all at once', () => {
  const camps = [camp(20, 5), camp(-30, 6), camp(60, 4)];
  frame(camps);
  assert.equal(game.built, SPAWNS_PER_FRAME, 'fifteen enemies wake, two are built this frame');
  assert.deepEqual(camps.map((s) => s.alive.length + s.pending), [5, 6, 4], 'the rest are queued');
  frame(camps, 6); // a long frame catching up six steps still builds no more
  assert.equal(game.built, SPAWNS_PER_FRAME * 2);
  for (let i = 0; i < 20; i++) frame(camps);
  assert.deepEqual(camps.map((s) => s.alive.length), [5, 6, 4], 'every camp ends at its count');
  assert.ok(camps.every((s) => s.pending === 0));
  for (let i = 0; i < 10; i++) frame(camps);
  assert.equal(game.built, 15, 'and no respawn doubles them up');
});

test('a camp left behind before it finished waking forgets its queue', () => {
  const s = camp(20, 5);
  frame([s]);
  assert.equal(s.pending, 4);
  game.spawnBudget = SPAWNS_PER_FRAME;
  s.update(1 / 30, [{ x: 400, z: 0 }]);
  assert.equal(s.active, false);
  assert.equal(s.pending, 0);
});

test('an enemy spawns on the floor at the foot of a tower, not on its top', () => {
  const colliders = new Colliders();
  const land = { terrain: { heightAt: () => 19 }, colliders };
  colliders.addBox({ x: 0, z: 0, w: 20, d: 20, y0: 145, y1: 165.4 }); // something tall overhead
  assert.deepEqual(spawnSpot(land, 0, 0), [0, 19, 0], 'the street under it');
  colliders.addBox({ x: 40, z: 0, w: 4, d: 4, y0: 18.5, y1: 19.3 }); // a low plinth: stood on
  assert.deepEqual(spawnSpot(land, 40, 0), [40, 19.3, 0]);
  colliders.addBox({ x: 60, z: 0, w: 6, d: 6, y0: 19.5, y1: 20 }); // a deck at head height: no room under it
  assert.deepEqual(spawnSpot(land, 60, 0), [60, 20, 0]);
});

test('a spawn point inside a wall steps out to the open ground beside it', () => {
  const colliders = new Colliders();
  const land = { terrain: { heightAt: () => 27 }, colliders };
  colliders.addBox({ x: 0, z: 0, w: 2.2, d: 8, y0: 26, y1: 37.7 }); // a solid pier of a hall
  const [x, y, z] = spawnSpot(land, 0, 0);
  assert.equal(y, 27, 'on the ground, not the roof');
  assert.ok(Math.abs(x) > 1.1 && Math.abs(x) <= 3, `beside the pier (${x.toFixed(1)}, ${z.toFixed(1)})`);
});

test('a wall archer still spawns on the wall walk over its post', () => {
  const colliders = new Colliders();
  const land = { terrain: { heightAt: () => 2 }, colliders };
  colliders.addBox({ x: 0, z: 0, w: 3, d: 30, y0: 1, y1: 9 }); // a curtain wall, walked on top
  assert.deepEqual(spawnSpot(land, 0, 0, true), [0, 9, 0]);
  assert.notEqual(spawnSpot(land, 0, 0)[1], 9, 'anyone else steps down off it');
});

test('over the sea an enemy still spawns on the highest floor (dungeons, decks)', () => {
  const colliders = new Colliders();
  const sea = { terrain: { heightAt: () => -18 }, colliders };
  colliders.addBox({ x: 0, z: 0, w: 20, d: 20, y0: 290, y1: 296 });
  colliders.addBox({ x: 0, z: 0, w: 8, d: 8, y0: 299.5, y1: 300 });
  assert.deepEqual(spawnSpot(sea, 0, 0), [0, 300, 0]);
});

test('a guard posted to a landing spawns on that landing, not on the floor under it or the top over it', () => {
  const colliders = new Colliders();
  const land = { terrain: { heightAt: () => 10.6 }, colliders };
  // a stack of landings over one spot, as the Ascent's tiers stand over the keep floor
  for (const h of [48, 64, 80, 112]) colliders.addBox({ x: 0, z: 0, w: 14, d: 14, y0: 10.6 + h - 1, y1: 10.6 + h });
  assert.equal(spawnSpot(land, 0, 0)[1], 10.6, 'unposted: the floor');
  assert.equal(spawnSpot(land, 0, 0, false, 10.6 + 64)[1], 10.6 + 64, 'posted: its own landing');
  assert.equal(spawnSpot(land, 0, 0, false, 10.6 + 96)[1], 10.6 + 80, 'between landings: the one below its height');
});

test('the Ascent posts its guards to their landings', async () => {
  const { SPIRE_SPAWNERS, SPIRE_GROUND, SPIRE_TIERS } = await import('../src/data/riftSpire.js');
  assert.ok(SPIRE_SPAWNERS.length > 0);
  for (const s of SPIRE_SPAWNERS) {
    // landings stack on the same cardinals (the Second and the Last Stair): match place and height
    const tier = SPIRE_TIERS.find((t) => Math.hypot(t.x - s.x, t.z - s.z) <= t.r && t.id !== 'base' && t.id !== 'summit' && s.y === SPIRE_GROUND + t.h);
    assert.ok(tier, `${s.type} at ${s.x.toFixed(1)}, ${s.z.toFixed(1)} is posted to a landing (y ${s.y})`);
  }
});

test('a camp may raise its foes to its own level (a high tier\'s `level`); without one they keep their own', () => {
  const opts = [];
  game.spawnEnemy = (type, pos, o) => (opts.push(o), { type, pos, aggro: false });
  new Spawner({ type: 'brigand', x: 0, z: 0, count: 1, radius: 2, respawn: 60, level: 9 }, game).spawn();
  new Spawner({ type: 'brigand', x: 0, z: 0, count: 1, radius: 2, respawn: 60 }, game).spawn();
  assert.deepEqual(opts.map((o) => o.scaleTo), [9, 0]);
});
