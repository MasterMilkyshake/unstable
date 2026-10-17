// A headless arena for systems tests: a real Player driven through the real Input's key sets,
// real Enemy AI and real colliders on flat ground at y 0. Effects (vfx, audio, UI) are no-ops.
// Not a test file itself (node --test only runs *.test.js).
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
globalThis.document ??= { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, createElement() { return { style: {}, appendChild() {} }; }, body: { appendChild() {} } };
globalThis.window ??= { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

export const { G } = await import('../../src/core/globals.js');
export const { Actor } = await import('../../src/entities/actor.js');
export const { Player } = await import('../../src/entities/player.js');
export const { Enemy } = await import('../../src/entities/enemy.js');
export const { Game } = await import('../../src/game/game.js');
export const { Input } = await import('../../src/core/input.js');
export const { Colliders } = await import('../../src/world/colliders.js');
export const { updateTimers } = await import('../../src/combat/mantraRuntime.js');
export const { updateProjectiles } = await import('../../src/entities/projectile.js');
export const { ENEMIES } = await import('../../src/data/enemies.js');
export { THREE };

export const DT = 1 / 30;
export const fx = new Proxy(function () {}, { get: () => fx, apply: () => fx });

// A fresh world; returns { input, colliders, game }. Pass `night` for a night sky.
export function arena(o = {}) {
  G.vfx = fx;
  G.audio = fx;
  G.ui = fx;
  G.net = null;
  G.time = 100;
  G.actors = [];
  G.projectiles = [];
  G.scene = new THREE.Scene();
  const colliders = new Colliders();
  G.world = {
    scene: G.scene, colliders, projectileBlockers: [], walls: [], hazards: [],
    terrain: { heightAt: () => 0, raycast: () => null },
    groundAt: (x, z, y = 400) => Math.max(0, colliders.groundAt(x, z, y, 0)),
    lendLight: () => new THREE.PointLight(),
    surfaceAt: () => 'stone',
    inRift: () => false,
    sky: { isNight: () => !!o.night, time: 0.42 },
  };
  const input = Object.assign(Object.create(Input.prototype), {
    down: new Set(), pressed: new Set(), released: new Set(), mPressed: [false, false, false], mDown: [false, false, false], mReleased: [false, false, false],
  });
  G.input = input;
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    camYaw: 0, inRift: false, state: 'playing', input, bossActive: null, nextNetId: 1, boats: [],
    ui: { isOpen: () => false, isPaused: () => false, toast() {}, banner() {} },
    net: { avatars: new Map(), isGuest: false, isHost: false, update() {} },
    startBoss() {}, endBoss() {}, onEnemyKilled() {}, save() {},
  });
  game.spawnEnemy = (type, pos, opts) => enemy(type, pos.x, pos.z, opts);
  G.game = game;
  return { input, colliders, game };
}

// A fresh character (bare fists unless `weapon` names one), standing at the origin facing +z.
export function player(o = {}) {
  const ch = G.game.createCharacter({ name: o.name || 'Tester', race: o.race || 'ashkin', look: {} });
  ch.armed = true;
  if (o.attrs) Object.assign(ch.attrs, o.attrs);
  if (o.level) ch.level = o.level;
  if (o.weapon) {
    ch.inventory.weapons.push({ uid: 'w1', id: o.weapon });
    ch.equipped.weapon = 'w1';
  }
  const p = new Player(ch);
  p.grounded = true;
  p.groundH = 0;
  G.player = p;
  G.game.player = p;
  G.game.ch = ch;
  G.actors.push(p);
  return p;
}

export function enemy(type, x, z, o = {}) {
  const e = new Enemy(type, new THREE.Vector3(x, o.y || 0, z), o);
  e.grounded = true;
  e.groundH = o.y || 0;
  G.actors.push(e);
  return e;
}

// Step the simulation: the player (if any), every other actor, timers and projectiles.
// `each` runs before every step (set keys there); key edges clear after each step.
export function step(seconds, each) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    G.time += DT;
    if (each && each(t) === false) return t;
    if (G.player && G.actors.includes(G.player)) G.player.update(DT);
    for (const a of [...G.actors]) {
      if (a === G.player || a.dead) continue;
      if (a.update) a.update(DT);
      else {
        a.baseUpdate(DT);
        a.physics(DT);
      }
    }
    updateProjectiles(DT);
    updateTimers(DT);
    G.input.endFrame();
  }
  return seconds;
}

// Pin Math.random for one test (the AI rolls its choices).
export function pinRandom(t, v) {
  const real = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  t.after(() => (Math.random = real));
}
