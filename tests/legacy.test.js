import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import { G } from '../src/core/globals.js';
import { Save, SLOT_COUNT } from '../src/core/save.js';
import { Legacy, remembranceFor, heirloomOptions, sanitizeLegacy, storyProgress } from '../src/core/legacy.js';
import { REMEMBRANCE, LEGACY_BOONS } from '../src/data/legacy.js';

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
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  } });
  globalThis.sessionStorage = { removeItem() {} };
  G.actors = [];
  for (let n = 1; n <= SLOT_COUNT; n++) Save.clearCharacter(n);
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
    if (isNew) Save.save({ version: 1, character: ch });
  };
  return game;
}
const character = (game, name) => game.createCharacter({ name, race: 'ashkin', look: {} });

// A character some way into the story: Power 10, the Prologue and Act I done, Act II under way,
// two great foes down, a little over two hours played.
function veteran(game, name = 'Veteran') {
  const ch = character(game, name);
  ch.level = 10;
  for (const id of ['awakening', 'first_light', 'writ', 'red_tooth']) ch.quests[id] = { state: 'done' };
  ch.quests.grey_letter = { state: 'active', stage: 1 };
  ch.bossesDefeated = ['warlord', 'duelist', 'not_a_boss', 'relay_keeper', 'tollkeeper']; // nor a dungeon's keeper nor a field boss
  ch.stats.playtime = 2 * 3600 + 120;
  ch.stats.kills = 140;
  ch.inventory.weapons = [
    { uid: 'w1', id: 'fists' },
    { uid: 'w2', id: 'bronze_sword', enchant: 'searing', temper: 2 },
  ];
  ch.trinkets = [{ uid: 't1', id: 'red_bandana', pips: [{ mod: 'maxHp', v: 4 }] }];
  return ch;
}

test('the great foes are the twelve', async () => {
  const { ENEMIES } = await import('../src/data/enemies.js');
  const game = makeGame();
  const ch = character(game, 'Slayer');
  ch.bossesDefeated = Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss);
  Legacy.record(ch, 'Lost', 1);
  assert.equal(Legacy.load().lost[0].foes.length, 12);
});

test('Remembrance scales with how far the character got', () => {
  const game = makeGame();
  const fresh = character(game, 'Fresh');
  assert.equal(remembranceFor(fresh), REMEMBRANCE.base);
  const v = veteran(game);
  const p = storyProgress(v);
  assert.deepEqual([p.reached, p.done], [5, 4]);
  assert.match(p.furthest, /^Act II · /);
  const r = REMEMBRANCE;
  assert.equal(remembranceFor(v), r.base + 9 * r.perPower + 4 * r.perChapter + 2 * r.perGreatFoe + 2 * r.perHour);
  v.stats.playtime = 40 * 3600;
  assert.equal(remembranceFor(v), r.base + 9 * r.perPower + 4 * r.perChapter + 2 * r.perGreatFoe + r.hourCap * r.perHour);
  assert.ok(remembranceFor(v) > remembranceFor(fresh));
});

test('a wipe records the character once in the register, and legacy survives clearing the save', () => {
  const game = makeGame();
  const v = veteran(game, 'Maera Coil');
  v.lives = 1;
  Save.save({ version: 1, character: v }, 2);
  assert.equal(game.continueGame(2), true);
  game.inRift = true;
  game.onPlayerDeath({ name: 'Drowned Knight' });
  // recorded before the death screen ends: a reload now can't lose it or pay twice
  let l = Legacy.load();
  assert.equal(l.lost.length, 1);
  const e = l.lost[0];
  assert.deepEqual(
    [e.name, e.race, e.level, e.cause, e.playtime, e.kills, e.chapters, e.slot],
    ['Maera Coil', 'ashkin', 10, 'Slain by Drowned Knight', 7320, 140, 5, 2],
  );
  assert.deepEqual(e.foes, ['Kaelen the Red', 'Sera Vane']);
  assert.equal(e.earned, remembranceFor(v));
  assert.equal(l.remembrance, e.earned);
  game.finishDeath(); // wipe(): the same character again
  l = Legacy.load();
  assert.equal(l.lost.length, 1);
  assert.equal(l.remembrance, e.earned);
  assert.equal(game.wipeInfo.entry.id, e.id);
  assert.equal(Save.hasCharacter(2), false);
  Save.clearCharacter(2);
  Save.clearCharacter(1);
  assert.ok(storage.has('unstable.legacy.v1'));
  assert.equal(Legacy.load().lost[0].name, 'Maera Coil');
});

test('fleeing in danger on the last life also goes into the register', () => {
  const game = makeGame();
  const ch = character(game, 'Runner');
  ch.lives = 1;
  ch.dangerQuit = true;
  Save.save({ version: 1, character: ch }, 3);
  assert.equal(game.continueGame(3), false);
  const l = Legacy.load();
  assert.equal(l.lost.length, 1);
  assert.equal(l.lost[0].cause, 'Fled from battle');
  assert.equal(l.lost[0].slot, 3);
  assert.equal(l.remembrance, REMEMBRANCE.base);
});

test('Remembrance is spent at creation: rerolls, boons, never past what is held', () => {
  const game = makeGame();
  Legacy.save({ ...Legacy.load(), remembrance: 40, earned: 40 });
  assert.equal(Legacy.spend(LEGACY_BOONS.reroll.cost), true);
  assert.equal(Legacy.load().remembrance, 40 - LEGACY_BOONS.reroll.cost);
  assert.equal(Legacy.spend(1000), false);
  assert.equal(Legacy.spend(0), false);
  assert.equal(Legacy.spend(-5), false);
  // 25 left: the bundle (20) is paid for, the ember (60) is not
  game.newGame({ name: 'Heir', race: 'ashkin', look: {}, boons: ['bundle', 'ember'] }, 1);
  const ch = game.ch;
  assert.equal(Legacy.load().remembrance, 5);
  assert.equal(ch.silver, 15 + LEGACY_BOONS.bundle.silver);
  assert.equal(ch.inventory.items.bread, 3 + 3);
  assert.equal(ch.inventory.items.waterskin, 2);
  assert.equal(ch.waterCharges, 8);
  assert.ok(!ch.inventory.items.ember_of_life);
  assert.deepEqual(ch.flags.boons, ['bundle']);
  // at most three things to buy
  assert.ok(Object.keys(LEGACY_BOONS).length <= 3);
});

test('the heirloom: chosen on the wipe screen, claimed once, and only by a character made after', () => {
  const game = makeGame();
  const older = character(game, 'Older');
  older.stats.started = Date.now() - 60_000;
  const v = veteran(game, 'Maera Coil');
  assert.deepEqual(heirloomOptions(v).map((o) => o.name), ['Bronze Sword +2', "Kaelen's Bandana"], 'bare fists are not an heirloom');
  Legacy.record(v, 'Lost in the Rift', 1);
  assert.equal(Legacy.load().pending.options.length, 2);
  assert.equal(Legacy.claimState(older).state, 'empty', 'nothing is left until it is chosen');
  const pick = Legacy.chooseHeirloom(0);
  assert.equal(pick.name, 'Bronze Sword +2');
  const l = Legacy.load();
  assert.equal(l.pending, null);
  assert.deepEqual([l.heirloom.kind, l.heirloom.id, l.heirloom.enchant, l.heirloom.temper, l.heirloom.from], ['weapon', 'bronze_sword', 'searing', 2, 'Maera Coil']);
  assert.equal(l.lost[0].heirloom, 'Bronze Sword +2');
  assert.equal(Legacy.claimState(older).state, 'older');
  assert.equal(Legacy.claim(older), null);
  const heir = character(game, 'Heir');
  heir.stats.started = Date.now() + 1;
  assert.equal(Legacy.claimState(heir).state, 'ready');
  const got = Legacy.claim(heir);
  assert.equal(got.id, 'bronze_sword');
  assert.equal(Legacy.claim(heir), null, 'claimed once');
  const other = character(game, 'Another');
  other.stats.started = Date.now() + 2;
  assert.equal(Legacy.claimState(other).state, 'empty');
  assert.equal(Legacy.load().lost[0].claimedBy, 'Heir');
});

test('choosing nothing leaves nothing, and a new choice replaces an unclaimed heirloom', () => {
  const game = makeGame();
  Legacy.record(veteran(game, 'First'), 'Lost', 1);
  Legacy.chooseHeirloom(1);
  assert.equal(Legacy.load().heirloom.id, 'red_bandana');
  assert.deepEqual(Legacy.load().heirloom.pips, [{ mod: 'maxHp', v: 4 }]);
  Legacy.record(veteran(game, 'Second'), 'Lost', 2);
  Legacy.chooseHeirloom(null);
  assert.equal(Legacy.load().heirloom.from, 'First', 'leaving nothing keeps what waits');
  Legacy.record(veteran(game, 'Third'), 'Lost', 3);
  Legacy.chooseHeirloom(0);
  assert.equal(Legacy.load().heirloom.from, 'Third');
  const fresh = character(game, 'Empty Hands');
  Legacy.record(fresh, 'Lost', 1);
  assert.equal(Legacy.load().pending, null, 'nothing to leave, nothing to choose');
});

test('corrupted or missing legacy values recover', () => {
  assert.deepEqual(Legacy.load(), sanitizeLegacy(null));
  storage.set('unstable.legacy.v1', '{oops');
  assert.equal(Legacy.load().remembrance, 0);
  storage.set('unstable.legacy.v1', JSON.stringify({
    remembrance: -40, earned: 'lots', lost: [null, 3, { name: 'Kept', level: 'x', foes: ['A', 2] }],
    heirloom: { kind: 'boat', id: 'skiff' }, pending: { entry: 7, options: [] },
  }));
  const l = Legacy.load();
  assert.equal(l.remembrance, 0);
  assert.equal(l.earned, 0);
  assert.equal(l.lost.length, 1);
  assert.equal(l.lost[0].name, 'Kept');
  assert.equal(l.lost[0].level, 1);
  assert.deepEqual(l.lost[0].foes, ['A']);
  assert.equal(l.heirloom, null);
  assert.equal(l.pending, null);
  storage.set('unstable.legacy.v1', JSON.stringify({ remembrance: 12.7, heirloom: { kind: 'weapon', id: 'bronze_sword', temper: 9, at: 5 } }));
  assert.equal(Legacy.load().remembrance, 12);
  assert.equal(Legacy.load().heirloom.temper, 3);
});
