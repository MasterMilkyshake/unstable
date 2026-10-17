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
const { Player } = await import('../src/entities/player.js');
const { Game } = await import('../src/game/game.js');
const { RUNNING_ATTACK, AERIAL_ATTACK } = await import('../src/data/weapons.js');

// A fresh character with bare fists on flat open ground, facing +z.
const noop = new Proxy({}, { get: () => () => {} });
let player;
beforeEach(() => {
  G.vfx = noop;
  G.audio = noop;
  G.ui = noop;
  G.net = null;
  G.time = 100;
  G.actors = [];
  G.scene = new THREE.Scene();
  G.world = {
    terrain: { heightAt: () => 0 },
    colliders: { resolve: () => ({ hit: false }), groundAt: () => -Infinity, query: () => [] },
    lendLight: () => new THREE.PointLight(),
  };
  const game = Object.create(Game.prototype);
  game.camYaw = 0;
  game.inRift = false;
  G.game = game;
  player = new Player(game.createCharacter({ name: 'Runner', race: 'ashkin', look: {} }));
  player.grounded = true;
  G.player = player;
  G.actors.push(player);
});

function foe(x, z) {
  const a = new Actor({ team: 'enemy', hp: 1000, posture: 1000, level: 5 });
  a.pos.set(x, 0, z);
  a.yaw = Math.PI;
  G.actors.push(a);
  return a;
}
// Step the swing (and the body under it) until it is over.
function finish(p, cap = 3) {
  for (let t = 0; p.atk && t < cap; t += 1 / 30) {
    p.baseUpdate(1 / 30);
    p.physics(1 / 30);
  }
  assert.equal(p.atk, null, 'the attack ran its course');
}
const sprint = (p) => {
  p.sprinting = true;
  p.speed = 8;
};

test('a sprinting player opens with a running slash that lunges in and hits harder', () => {
  const reach = player.weaponClass().range;
  const far = foe(0, reach + 1.6); // past the first jab's reach
  player.startCombo();
  assert.notEqual(player.atk.def.anim, RUNNING_ATTACK.anim, 'standing still: the first jab');
  finish(player);
  assert.equal(far.hp, 1000, 'the jab falls short');
  assert.ok(player.pos.z < 0.6, `a jab barely steps (${player.pos.z.toFixed(2)} m)`);

  player.pos.set(0, 0, 0);
  player.vel.set(0, 0, 0);
  player.combo = 0;
  sprint(player);
  player.startCombo();
  assert.equal(player.atk.def.anim, RUNNING_ATTACK.anim);
  finish(player);
  assert.ok(player.pos.z > 1.2, `the slash carries the runner in (${player.pos.z.toFixed(2)} m)`);
  assert.ok(far.hp < 1000, 'and lands on the foe the jab could not reach');

  // against the same foe up close, the running slash hits 1.25x what the first jab does
  const near = () => foe(0, 1.2);
  const jabbed = near();
  player.pos.set(0, 0, 0);
  player.combo = 0;
  player.sprinting = false;
  player.speed = 0;
  player.startCombo();
  const jabMul = player.atk.def.dmgMul;
  finish(player);
  const jab = 1000 - jabbed.hp;
  jabbed.dead = true;
  const slashed = near();
  player.pos.set(0, 0, 0);
  player.combo = 0;
  sprint(player);
  player.startCombo();
  finish(player);
  const slash = 1000 - slashed.hp;
  assert.ok(jab > 0 && slash > 0);
  assert.ok(Math.abs(slash / jab - RUNNING_ATTACK.dmgMul / jabMul) < 0.02, `slash ${slash.toFixed(1)} vs jab ${jab.toFixed(1)}`);
});

test('mid-string or at a walk, a swing is the next in the string, not a running slash', () => {
  sprint(player);
  player.combo = 1;
  player.startCombo();
  assert.notEqual(player.atk.def.anim, RUNNING_ATTACK.anim);
  player.cancelAttack();
  player.combo = 0;
  player.speed = 6;
  player.startCombo();
  assert.notEqual(player.atk.def.anim, RUNNING_ATTACK.anim, 'not fast enough');
});

test('an attack in the air is a slam: it drives the player down and strikes all round where it lands', () => {
  player.pos.set(0, 3, 0);
  player.grounded = false;
  player.groundH = 0;
  player.vel.set(0, 0, 0);
  const behind = foe(0, -1.6);
  const beside = foe(1.8, 0);
  const away = foe(0, 4.5);
  player.startCombo();
  assert.equal(player.atk.def.anim, AERIAL_ATTACK.anim);
  let landedAt = null;
  for (let t = 0; player.atk && t < 3; t += 1 / 30) {
    player.baseUpdate(1 / 30);
    player.physics(1 / 30);
    if (landedAt === null && player.grounded) landedAt = t;
  }
  assert.ok(landedAt !== null && landedAt < AERIAL_ATTACK.windup + 0.3, `down fast (${landedAt?.toFixed(2)} s)`);
  assert.ok(behind.hp < 1000, 'the foe behind is caught');
  assert.ok(beside.hp < 1000, 'and the one beside');
  assert.equal(away.hp, 1000, 'not one 4.5 m off');

  // a hop under a metre is no slam
  player.pos.set(0, 0.8, 0);
  player.grounded = false;
  player.combo = 0;
  player.startCombo();
  assert.notEqual(player.atk.def.anim, AERIAL_ATTACK.anim);
});
