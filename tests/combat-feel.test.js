import test from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';

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
const { meleeTargets } = await import('../src/combat/combat.js');
const { Actor } = await import('../src/entities/actor.js');
const { Game } = await import('../src/game/game.js');

function actor(o) {
  return Object.assign({
    dead: false, knocked: false, radius: 0.4, height: 1.8, team: 'enemy',
    pos: { x: 0, y: 0, z: 0 }, flying: false, aquatic: false, boss: false,
  }, o);
}

test('melee hits a foe in front and a long body past the collision radius', () => {
  const att = actor({ team: 'player', yaw: 0, pos: { x: 0, y: 0, z: 0 } });
  const inFront = actor({ pos: { x: 0, y: 0, z: 2 } });
  const behind = actor({ pos: { x: 0, y: 0, z: -2 } });
  // Center is past range + radius; the body pad is what makes the swing connect.
  const longBody = actor({ radius: 0.6, meleePad: 0.55, pos: { x: 0, y: 0, z: 3.3 } });
  const sameWithoutPad = actor({ radius: 0.6, pos: { x: 0, y: 0, z: 3.3 } });
  G.actors = [att, inFront, behind, longBody];
  const hit = meleeTargets(att, 2.4, 80);
  assert.ok(hit.includes(inFront));
  assert.ok(!hit.includes(behind));
  assert.ok(hit.includes(longBody));
  G.actors = [att, sameWithoutPad];
  assert.ok(!meleeTargets(att, 2.4, 80).includes(sameWithoutPad));
});

test('a swing sweeps on the frame the windup becomes active', () => {
  const a = Object.create(Actor.prototype);
  a.yaw = 0;
  a.pos = { x: 0, y: 0, z: 0 };
  a.target = null;
  a.vel = { x: 0, z: 0 };
  a.radius = 0.4;
  a.atk = {
    def: { windup: 0.1, active: 0.12, recovery: 0.2, type: 'melee' },
    t: 0.1, phase: 'windup', hitSet: new Set(), hitIdx: 0,
  };
  let sweeps = 0;
  a.meleeSweep = () => { sweeps++; };
  a.onActiveStart = () => {};
  a.updateAttack(0.016);
  assert.equal(a.atk.phase, 'active');
  assert.equal(sweeps, 1);
});

test('a long body is pushed out even when the collision circles still fit', () => {
  const game = Object.create(Game.prototype);
  const player = actor({ team: 'player', radius: 0.42, pos: { x: 0, y: 0, z: 0 } });
  const lurker = actor({ radius: 0.6, meleePad: 0.55, pos: { x: 1.2, y: 0, z: 0 } });
  assert.ok(1.2 + 1e-6 >= player.radius + lurker.radius);
  game.player = player;
  G.actors = [player, lurker];
  game.separateActors(0.016);
  const d = Math.hypot(player.pos.x - lurker.pos.x, player.pos.z - lurker.pos.z);
  assert.ok(d >= player.radius + lurker.radius + lurker.meleePad - 1e-6);
  assert.ok(Math.abs(player.pos.x) < Math.abs(lurker.pos.x - 1.2));
});

test('actors pressed together separate in one step, and the player yields less', () => {
  const game = Object.create(Game.prototype);
  const player = actor({ team: 'player', radius: 0.4, pos: { x: 0, y: 0, z: 0 } });
  const enemy = actor({ radius: 0.6, pos: { x: 0.2, y: 0, z: 0 } });
  game.player = player;
  G.actors = [player, enemy];
  game.separateActors(0.001);
  const d = Math.hypot(player.pos.x - enemy.pos.x, player.pos.z - enemy.pos.z);
  assert.ok(d >= player.radius + enemy.radius - 1e-6);
  assert.ok(Math.abs(player.pos.x) < Math.abs(enemy.pos.x - 0.2));
});
