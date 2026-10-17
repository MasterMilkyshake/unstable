import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import { G } from '../src/core/globals.js';
import { Save } from '../src/core/save.js';

// Exercise Game's real lifecycle without a renderer or browser styles.
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
const { Game } = await import('../src/game/game.js');

let storage;
beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } });
  globalThis.sessionStorage = { removeItem() {} };
  G.actors = [];
});

function setup() {
  const game = Object.create(Game.prototype);
  game.ch = game.createCharacter({ name: 'Traveler', race: 'ashkin', look: {} });
  game.state = 'playing';
  game.inRift = true;
  game.player = { dead: false, inDanger: false, snapshot() {} };
  game.world = { sky: { time: 0.3 } };
  game.net = { disconnect() {} };
  game.audio = { play() {}, setMood() {} };
  game.input = { exitLock() {} };
  game.ui = {
    deathScreen(title, sub, ms, then) { game.finishDeath = then; },
    showWipe(info) { game.wipeInfo = info; },
    toast() {}, hideHUD() {}, closeAll() {}, showMainMenu() {},
  };
  game.startGame = (ch) => { game.ch = ch; game.starts = (game.starts || 0) + 1; };
  game.enterRift = () => { game.inRift = true; };
  game.exitRift = () => { game.inRift = false; };
  storage.set('unstable.save.v1', JSON.stringify({ character: game.ch }));
  storage.set('unstable.save.v1.bak', JSON.stringify({ character: game.ch }));
  return game;
}

test('new characters start with three lives; surface death does not spend one', () => {
  const game = setup();
  assert.equal(game.ch.lives, 3);
  assert.equal(game.ch.maxLives, 3);
  game.inRift = false;
  game.onPlayerDeath();
  game.finishDeath();
  assert.equal(game.inRift, true);
  assert.equal(game.ch.lives, 3);
});

test('a death in the Rift ends the character at once, with lives to spare, before the animation ends', () => {
  const game = setup();
  assert.equal(game.ch.lives, 3);
  game.inRift = true;
  game.onPlayerDeath({ name: 'Hollow' });
  // gone before the death screen ends: a reload now can't bring it back
  assert.equal(Save.hasCharacter(), false);
  assert.ok(!storage.has('unstable.save.v1.bak'));
  assert.equal(game.ch.lives, 3, 'no life is spent: the character ends');
  game.finishDeath();
  assert.equal(game.ch, null);
  assert.equal(game.state, 'menu');
  assert.equal(game.wipeInfo.cause, 'Slain by Hollow');
  assert.equal(game.wipeInfo.entry.cause, 'Slain by Hollow', 'the lost character is in the register of the lost');
});

test('only a death the character survives leaves a pouch; a Rift death keeps all for the heirloom', async () => {
  const { ACTIONS } = await import('../src/game/hooks.js');
  const prev = ACTIONS.dropOnDeath;
  const drops = [];
  ACTIONS.dropOnDeath = (g) => drops.push(g.inRift);
  try {
    const game = setup();
    game.inRift = false;
    game.onPlayerDeath({ name: 'a brigand' });
    assert.deepEqual(drops, [false], 'a surface death drops part of what you carry');
    const rift = setup();
    rift.ch.inventory.weapons.push({ uid: 'w1', id: 'bronze_sword', enchant: null });
    rift.onPlayerDeath({ name: 'Hollow' });
    assert.deepEqual(drops, [false], 'a death in the Rift drops nothing');
    const pending = JSON.parse(storage.get('unstable.legacy.v1')).pending;
    assert.ok(pending && pending.options.some((o) => o.id === 'bronze_sword'), 'the carried weapon can be the heirloom');
  } finally {
    ACTIONS.dropOnDeath = prev;
  }
});

test('combat reload charges one life exactly once', () => {
  const game = setup();
  game.player.inDanger = true;
  game.save(true);
  assert.equal(Save.load().character.dangerQuit, true);
  assert.equal(game.continueGame(), true);
  assert.equal(game.ch.lives, 2);
  assert.equal(Save.load().character.dangerQuit, false);
  assert.equal(game.continueGame(), true);
  assert.equal(game.ch.lives, 2);
});

test('quitting combat on the last life ends the character before play can resume', () => {
  const game = setup();
  game.ch.lives = 1;
  game.player.inDanger = true;
  game.quitToMenu();
  assert.equal(Save.load().character.dangerQuit, true);
  assert.equal(game.continueGame(), false);
  assert.equal(game.starts || 0, 0);
  assert.equal(Save.hasCharacter(), false);
  assert.ok(!storage.has('unstable.save.v1.bak'));
  assert.equal(game.wipeInfo.cause, 'Fled from battle');
});

test('safe quitting and ordinary in-session saves do not charge a life', () => {
  const game = setup();
  game.save(true);
  game.continueGame();
  assert.equal(game.ch.lives, 3);
  game.player.inDanger = true;
  game.save();
  assert.equal(Save.load().character.dangerQuit, false);
});


test('renting an inn room sets where you wake, and nothing else; return lands below the roof', () => {
  const game = setup();
  game.inRift = false;
  game.ch.silver = 30;
  const floor = { x: -29, y: 4.92, z: 20 };
  game.player = {
    inDanger: false, hp: 1, maxHp: 100, ether: 1, maxEther: 50, maxSanity: 80,
    posture: 20, pos: { x: -28, y: 9.1, z: 21 },
    revive(pos) { this.returned = pos; },
  };
  game.world.interactables = [{ id: 'inn_salt', pos: floor }];
  game.world.terrain = { heightAt: () => 4.5 };
  game.world.groundAt = (x, z, ceiling) => ceiling < 9 ? 4.92 : 18;
  game.ui.fade = () => assert.fail('no sleep: renting a room does not fade out');
  game.input.requestLock = () => {};
  game.save = () => {};
  const sanity = game.ch.sanity;
  game.rest('inn_salt', 10);
  assert.equal(game.ch.silver, 20);
  assert.deepEqual(game.ch.spawn, { id: 'inn_salt', ...floor });
  // no sleep, no healing (the user's call, 2026-10-16)
  assert.equal(game.player.hp, 1);
  assert.equal(game.player.ether, 1);
  assert.equal(game.ch.sanity, sanity);
  assert.equal(game.player.posture, 20);
  // nothing in the Rift holds you, and no silver goes for it
  game.inRift = true;
  game.rest('inn_salt', 10);
  assert.equal(game.ch.silver, 20);
  game.ui.fade = (fn) => fn(); // leaving the Rift does fade
  Game.prototype.exitRift.call(game, true);
  assert.equal(game.player.returned.x, floor.x);
  assert.equal(game.player.returned.z, floor.z);
  assert.ok(Math.abs(game.player.returned.y - 5.12) < 0.001, 'return lands on the room floor, below the loft and roof');
  assert.equal(game.inRift, false);
});
