import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCharacter, SAVE_VERSION } from '../src/core/migrate.js';
import { Save } from '../src/core/save.js';
import { migrateWorldPosition, WORLD_LAYOUT } from '../src/data/worldPlacement.js';
import { STRUCTURES } from '../src/data/world.js';

function legacyCharacter() {
  return {
    name: 'Traveler', race: 'ashkin', level: 12, silver: 430,
    lives: 0, maxLives: 3, dangerQuit: true,
    inventory: { items: { ember_of_life: 2, elixir: 1, bread: 4 } },
    hotbar: [{ type: 'weapon' }, { type: 'item', id: 'ember_of_life' }],
    lore: ['wash_note'], investigations: ['common_memory'],
    feats: { first_blood: 123 }, bossesDefeated: ['hollow_duke'],
  };
}

test('legacy characters retain remaining lives and pending combat-quit penalties', () => {
  const ch = legacyCharacter();
  migrateCharacter(ch);
  assert.equal(ch.lives, 0);
  assert.equal(ch.maxLives, 3);
  assert.equal(ch.dangerQuit, true);
  assert.equal(ch.level, 12);
  assert.equal(ch.silver, 430);
  assert.deepEqual(ch.lore, ['wash_note']);
  assert.deepEqual(ch.investigations, ['common_memory']);
  assert.deepEqual(ch.feats, { first_blood: 123 });
  assert.deepEqual(ch.bossesDefeated, ['hollow_duke']);
  assert.equal(ch.saveVersion, SAVE_VERSION);
});

test('life-restoring items and their hotbar bindings survive migration', () => {
  const ch = migrateCharacter(legacyCharacter());
  assert.deepEqual(ch.inventory.items, { ember_of_life: 2, elixir: 1, bread: 4 });
  assert.deepEqual(ch.hotbar[1], { type: 'item', id: 'ember_of_life' });
  const saved = JSON.stringify(ch);
  assert.equal(JSON.stringify(migrateCharacter(ch)), saved);
});

test('loading and saving a legacy character preserves it and its backup', (t) => {
  const storage = new Map([
    ['unstable.save.v1', JSON.stringify({ character: legacyCharacter() })],
    ['unstable.meta.v1', JSON.stringify({ remnants: 100, unlocks: { extra_life: 2 } })],
  ]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } });
  t.after(() => {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', previous);
  });
  assert.equal(Save.hasCharacter(), true);
  const data = Save.load();
  assert.equal(data.character.dangerQuit, true);
  assert.equal(Save.save(data), true);
  storage.delete('unstable.save.v1');
  assert.equal(Save.hasCharacter(), true);
  assert.equal(Save.load().character.inventory.items.ember_of_life, 2);
  assert.equal(Save.load().character.level, 12);
  assert.ok(storage.has('unstable.meta.v1'));
});

test('saves without life counters regain three lives without changing inventory', () => {
  const ch = legacyCharacter();
  delete ch.lives;
  delete ch.maxLives;
  delete ch.dangerQuit;
  ch.saveVersion = 3;
  ch.inventory.items = { elixir: 7 };
  migrateCharacter(ch);
  assert.equal(ch.lives, 3);
  assert.equal(ch.maxLives, 3);
  assert.deepEqual(ch.inventory.items, { elixir: 7 });
  assert.ok(!ch.dangerQuit);
});

test('existing extra maximum lives are retained without granting new upgrades', () => {
  const ch = legacyCharacter();
  ch.lives = 2;
  ch.maxLives = 5;
  migrateCharacter(ch);
  assert.equal(ch.lives, 2);
  assert.equal(ch.maxLives, 5);
});

test('a layout 3 character on the Hush follows it to Frosthollow’s shore, and no one else moves', () => {
  // Hush Landing's fire where layout 3 placed it, off the fen's east coast
  const ch = { worldLayout: 3, pos: { x: -1258, z: -332 }, spawn: { x: -1258, z: -332, id: 'cf_hush' },
    contracts: { held: [{ x: -909, z: 1312 }, { x: 0, z: -320 }, { x: -700, z: -330 }] } };
  assert.equal(migrateWorldPosition(ch), true);
  const fire = STRUCTURES.find(s => s.id === 'cf_hush');
  assert.deepEqual([ch.pos.x, ch.pos.z], [fire.x, fire.z]);
  assert.deepEqual([ch.spawn.x, ch.spawn.z], [fire.x, fire.z]);
  assert.deepEqual(ch.contracts.held.map(p => [p.x, p.z]), [[-909, 1312], [0, -320], [-700, -330]]);
  assert.equal(ch.worldLayout, WORLD_LAYOUT);
  assert.equal(migrateWorldPosition(ch), false);
});

test('a corrupted character is repaired field by field and still loads', () => {
  const ch = {
    name: 7, look: 'tall', level: 'high', xp: -5, points: NaN, silver: 'lots', lives: 'many', maxLives: 0,
    hunger: 400, water: -3, worldTime: 9, pos: { x: 'a', z: 2 }, spawn: [1, 2], yaw: 'north',
    inventory: { items: { bread: 'two', elixir: 3, apple: -1 }, weapons: 'none' }, quests: { awakening: 'done', writ: { state: 'active' } },
    mantras: { ember_bolt: true }, stats: 'none', flags: [], talents: {}, trinkets: 'x', gear: 3,
  };
  migrateCharacter(ch);
  assert.equal(ch.name, 'Nameless');
  assert.deepEqual(ch.look, {});
  assert.equal(ch.level, 1);
  assert.equal(ch.xp, 0);
  assert.equal(ch.points, 0);
  assert.equal(ch.silver, 0);
  assert.equal(ch.maxLives, 1);
  assert.equal(ch.lives, 1);
  assert.equal(ch.hunger, 100);
  assert.equal(ch.water, 0);
  assert.equal(ch.worldTime, 1);
  assert.equal(ch.pos, null);
  assert.equal(ch.spawn, null);
  assert.ok(!('yaw' in ch));
  assert.deepEqual(ch.inventory.items, { elixir: 3 });
  assert.deepEqual(ch.inventory.weapons, []);
  assert.deepEqual(Object.keys(ch.quests), ['writ']);
  assert.deepEqual(ch.mantras.ember_bolt, { stars: 0 });
  assert.equal(ch.stats.kills, 0);
  assert.deepEqual(ch.flags, {});
  assert.deepEqual(ch.talents, []);
  assert.deepEqual(ch.trinkets, []);
});
