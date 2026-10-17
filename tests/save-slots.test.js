import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import { G } from '../src/core/globals.js';
import { Save, SLOT_COUNT } from '../src/core/save.js';

// Game's real new/continue/wipe flow without a renderer or browser styles.
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
const { slotAction } = await import('../src/ui/screens.js');

let storage;
beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  } });
  globalThis.sessionStorage = { removeItem() {} };
  G.actors = [];
  for (let n = 1; n <= SLOT_COUNT; n++) Save.clearCharacter(n); // also restarts each slot's backup clock
  Save.use(1);
});

function makeGame() {
  const game = Object.create(Game.prototype);
  game.state = 'menu';
  game.inRift = true;
  game.world = { sky: { time: 0.3 } };
  game.net = { disconnect() {} };
  game.audio = { play() {}, setMood() {} };
  game.input = { exitLock() {} };
  game.ui = {
    deathScreen(title, sub, ms, then) { game.finishDeath = then; },
    showWipe(info) { game.wipeInfo = info; },
    toast() {}, hideHUD() {}, closeAll() {}, showMainMenu() {},
  };
  game.startGame = (ch, isNew) => {
    game.ch = ch;
    game.state = 'playing';
    game.player = { dead: false, inDanger: false, snapshot() {} };
    if (isNew) Save.save({ version: 1, character: ch }); // as the real startGame does
  };
  return game;
}
const character = (game, name) => game.createCharacter({ name, race: 'ashkin', look: {} });

test('three slots, and the single save from before slots is slot 1', () => {
  assert.equal(SLOT_COUNT, 3);
  const game = makeGame();
  storage.set('unstable.save.v1', JSON.stringify({ character: character(game, 'Old Hand') }));
  assert.equal(Save.hasCharacter(1), true);
  assert.equal(Save.summary(1).name, 'Old Hand');
  assert.deepEqual(Save.slots().map((s) => s && s.name), ['Old Hand', null, null]);
  assert.equal(Save.firstEmptySlot(), 2);
  assert.equal(game.continueGame(), true);
  assert.equal(Save.slot, 1);
  assert.equal(game.ch.name, 'Old Hand');
});

test('slots are isolated: saving, loading and clearing one leaves the others alone', () => {
  const game = makeGame();
  for (const [n, name] of [[1, 'Ash'], [2, 'Brine'], [3, 'Cinder']]) Save.save({ version: 1, character: character(game, name) }, n);
  assert.deepEqual(Save.slots().map((s) => s.name), ['Ash', 'Brine', 'Cinder']);
  const two = Save.load(2);
  two.character.level = 9;
  Save.save(two, 2);
  assert.equal(Save.load(1).character.level, 1);
  assert.equal(Save.load(2).character.level, 9);
  Save.clearCharacter(2);
  assert.equal(Save.hasCharacter(2), false);
  assert.equal(Save.load(1).character.name, 'Ash');
  assert.equal(Save.load(3).character.name, 'Cinder');
  assert.equal(Save.firstEmptySlot(), 2);
  // saving without a slot number goes to the slot being played
  Save.use(3);
  const three = Save.load();
  three.character.silver = 777;
  Save.save(three);
  assert.equal(Save.load(3).character.silver, 777);
  assert.equal(Save.load(1).character.silver, 15);
});

test('each slot keeps its own rolling backup, and a broken save falls back on its own', () => {
  const game = makeGame();
  Save.save({ version: 1, character: character(game, 'Ash') }, 1);
  Save.save({ version: 1, character: character(game, 'Ash') }, 1); // backs up the first
  Save.save({ version: 1, character: character(game, 'Brine') }, 2);
  Save.save({ version: 1, character: character(game, 'Brine') }, 2);
  assert.ok(storage.has('unstable.save.v1.bak'));
  assert.ok(storage.has('unstable.save.v1.slot2.bak'));
  assert.ok(!storage.has('unstable.save.v1.slot3.bak'));
  storage.set('unstable.save.v1.slot2', '{not json');
  assert.equal(Save.hasCharacter(2), true);
  assert.equal(Save.load(2).character.name, 'Brine');
  assert.equal(Save.summary(2).name, 'Brine');
  storage.delete('unstable.save.v1.slot2.bak');
  assert.equal(Save.hasCharacter(2), false);
  assert.equal(Save.load(2), null);
  assert.equal(Save.load(1).character.name, 'Ash');
  // a wiped save never comes back from its backup
  const wiped = character(game, 'Ash');
  wiped.wiped = true;
  storage.set('unstable.save.v1', JSON.stringify({ character: wiped }));
  assert.equal(Save.hasCharacter(1), false);
  assert.equal(Save.summary(1), null);
});

test('Continue goes to the slot played last; the list shows name, race, Power, place, playtime and lives', () => {
  const game = makeGame();
  const a = character(game, 'Ash');
  const b = character(game, 'Brine');
  Object.assign(b, { level: 7, lives: 2, place: 'Rook’s Landing' });
  b.stats.playtime = 7980;
  Save.save({ version: 1, character: a }, 1);
  const t = Date.now;
  Date.now = () => t() + 5000;
  try {
    Save.save({ version: 1, character: b }, 3);
  } finally {
    Date.now = t;
  }
  assert.equal(Save.lastSlot(), 3);
  const s = Save.summary(3);
  assert.deepEqual([s.name, s.race, s.level, s.place, s.playtime, s.lives, s.maxLives], ['Brine', 'ashkin', 7, 'Rook’s Landing', 7980, 2, 3]);
  assert.equal(game.continueGame(), true);
  assert.equal(game.ch.name, 'Brine');
  assert.equal(Save.slot, 3);
});

test('a new game in a filled slot asks first; starting one replaces only that slot', () => {
  assert.equal(slotAction('new', true), 'confirm');
  assert.equal(slotAction('new', false), 'begin');
  assert.equal(slotAction('load', true), 'continue');
  assert.equal(slotAction('load', false), 'none');
  assert.equal(slotAction('lan', true), 'continue');
  assert.equal(slotAction('lan', false), 'begin');
  const game = makeGame();
  Save.save({ version: 1, character: character(game, 'Ash') }, 1);
  Save.save({ version: 1, character: character(game, 'Brine') }, 2);
  Save.save({ version: 1, character: character(game, 'Brine') }, 2);
  game.newGame({ name: 'Drift', race: 'ashkin', look: {} }, 2);
  assert.equal(Save.slot, 2);
  assert.equal(game.ch.name, 'Drift');
  assert.equal(Save.load(2).character.name, 'Drift');
  assert.ok(!storage.has('unstable.save.v1.slot2.bak'), 'the old character left no backup behind');
  assert.equal(Save.load(1).character.name, 'Ash');
  // with no slot named, a new character takes the first empty one
  game.newGame({ name: 'Eddy', race: 'ashkin', look: {} });
  assert.equal(Save.slot, 3);
});

test('the danger-quit penalty is charged only to its own slot', () => {
  const game = makeGame();
  const a = character(game, 'Ash');
  const b = character(game, 'Brine');
  b.dangerQuit = true;
  Save.save({ version: 1, character: a }, 1);
  Save.save({ version: 1, character: b }, 2);
  assert.equal(game.continueGame(1), true);
  assert.equal(game.ch.lives, 3);
  assert.equal(Save.load(2).character.dangerQuit, true);
  assert.equal(Save.summary(2).dangerQuit, true);
  assert.equal(game.continueGame(2), true);
  assert.equal(game.ch.lives, 2);
  assert.equal(Save.load(2).character.dangerQuit, false);
  assert.equal(Save.load(1).character.lives, 3);
});

test('a wipe empties only its own slot and its backup', () => {
  const game = makeGame();
  Save.save({ version: 1, character: character(game, 'Ash') }, 1);
  Save.save({ version: 1, character: character(game, 'Ash') }, 1);
  const b = character(game, 'Brine');
  b.lives = 1;
  Save.save({ version: 1, character: b }, 2);
  Save.save({ version: 1, character: b }, 2);
  assert.equal(game.continueGame(2), true);
  game.inRift = true;
  game.onPlayerDeath({ name: 'Hollow' });
  assert.equal(Save.hasCharacter(2), false, 'gone before the death screen ends');
  assert.ok(!storage.has('unstable.save.v1.slot2.bak'));
  game.finishDeath();
  assert.equal(game.wipeInfo.cause, 'Slain by Hollow');
  assert.equal(game.state, 'menu');
  assert.equal(Save.load(1).character.name, 'Ash');
  assert.ok(storage.has('unstable.save.v1.bak'));
});

test('settings are shared by every slot and recover from bad values', () => {
  assert.deepEqual(Save.loadSettings(), Save.defaultSettings());
  storage.set('unstable.settings.v1', '{broken');
  assert.deepEqual(Save.loadSettings(), Save.defaultSettings());
  storage.set('unstable.settings.v1', JSON.stringify([1, 2]));
  assert.deepEqual(Save.loadSettings(), Save.defaultSettings());
  assert.equal(Save.loadSettings().bounceLight, false, 'the experimental bounce light starts off');
  storage.set('unstable.settings.v1', JSON.stringify({ fov: 400, master: -3, sensitivity: 'fast', quality: 'ultra', shadows: 'yes', music: 0.2, invertY: true, junk: 1, bounceLight: 'on' }));
  const s = Save.loadSettings();
  assert.equal(s.fov, 100);
  assert.equal(s.master, 0);
  assert.equal(s.sensitivity, 1);
  assert.equal(s.quality, 'high');
  assert.equal(s.shadows, true);
  assert.equal(s.music, 0.2);
  assert.equal(s.invertY, true);
  assert.ok(!('junk' in s));
  assert.equal(s.bounceLight, false);
});
