import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import * as THREE from 'three';

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
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { G } = await import('../src/core/globals.js');
const { Actor } = await import('../src/entities/actor.js');
const { Enemy } = await import('../src/entities/enemy.js');
const { Colliders } = await import('../src/world/colliders.js');
const { hostile } = await import('../src/combat/combat.js');
await import('../src/data/guards.js');
await import('../src/data/story.js');

const noop = new Proxy({}, { get: () => () => {} });
beforeEach(() => {
  G.vfx = noop;
  G.audio = noop;
  G.ui = noop;
  G.net = null;
  G.player = null;
  G.time = 100;
  G.actors = [];
  G.projectiles = [];
  G.scene = new THREE.Scene();
  G.world = { terrain: { heightAt: () => 0 }, colliders: new Colliders(), sky: { isNight: () => false } };
  const far = new Actor({ team: 'player', hp: 200, posture: 100 });
  far.pos.set(400, 0, 400);
  G.game = { playerActors: () => [far], inRift: false, bossActive: null, startBoss() {}, endBoss() {}, spawnEnemy: () => null };
});
function spawn(type, x, z) {
  const e = new Enemy(type, new THREE.Vector3(x, 0, z));
  e.grounded = true;
  G.actors.push(e);
  return e;
}

test('one faction is one side: the Enclave garrison and its wardens never count each other as foes', () => {
  const warden = spawn('vice_warden', 0, 0);
  const grand = spawn('grand_warden', 0, 6);
  const keeper = spawn('peacekeeper', 3, 0);
  const watch = spawn('watch_guard', -3, 0);
  const brigand = spawn('brigand', 0, -6);
  for (const [a, b] of [[keeper, warden], [warden, keeper], [keeper, grand]]) assert.equal(hostile(a, b), false, `${a.type} against ${b.type}`);
  assert.equal(hostile({ owner: warden, team: warden.team }, keeper), false, "the warden's bolt passes the garrison");
  // other factions and monsters are as before
  assert.equal(hostile(watch, warden), true);
  assert.equal(hostile(keeper, brigand), true);
  assert.equal(hostile(warden, watch), true);
});

test('a Peacekeeper beside the Vice Warden takes the monster, never the warden', () => {
  const warden = spawn('vice_warden', 0, 0);
  const keeper = spawn('peacekeeper', 3, 0);
  assert.ok(keeper.pickGuardTarget() === null, 'a lone warden is no target for his garrison');
  const brigand = spawn('brigand', 3, 12);
  assert.ok(keeper.pickGuardTarget() === brigand);
  assert.ok(warden.pickTarget() !== keeper);
});

test('the Fort Meridian garrison stands with the Vice Warden for ten seconds without a blow between them', () => {
  const warden = spawn('vice_warden', 0, 0);
  const keepers = [spawn('peacekeeper', 3, 0), spawn('enclave_captain', -3, 0), spawn('peacekeeper_arbalist', 0, 12)];
  for (let t = 0; t < 10; t += 1 / 30) {
    G.time += 1 / 30;
    for (const a of G.actors) a.update(1 / 30);
  }
  assert.equal(warden.hp, warden.maxHp);
  for (const k of keepers) {
    assert.equal(k.hp, k.maxHp, k.type);
    assert.ok(k.target !== warden, `${k.type} turned on the warden`);
  }
});
