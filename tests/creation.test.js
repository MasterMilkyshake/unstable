import test from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import { G } from '../src/core/globals.js';
import { START_ATTUNEMENT } from '../src/data/origins.js';
import { ATTUNE_ATTRS } from '../src/data/stats.js';
import { MANTRAS } from '../src/data/mantras.js';
import { applyStartingAttunement, resolveAttunement } from '../src/game/creation.js';

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
globalThis.document = { addEventListener() {}, getElementById() { return null; } };
globalThis.window = { addEventListener() {} };
const { Game } = await import('../src/game/game.js');
const { respec } = await import('../src/game/order.js');
const fresh = (race = 'ashkin') => Game.prototype.createCharacter.call({}, { name: 'Tide', race, look: {} });

test('each attunement\'s first mantra is the one its bonus qualifies for', () => {
  for (const a of ATTUNE_ATTRS) {
    const m = MANTRAS[START_ATTUNEMENT.mantra[a]];
    assert.ok(m, `${a} has a starter mantra`);
    assert.equal(m.el, a);
    for (const [k, v] of Object.entries(m.reqs || {})) assert.ok(k === a && v <= START_ATTUNEMENT.bonus, `${m.name} needs ${k} ${v}`);
  }
});

test('choosing an attunement at creation: the bonus, mana awakened, its first mantra on the hotbar', () => {
  const ch = fresh();
  const before = ch.attrs.rime;
  assert.equal(applyStartingAttunement(ch, 'rime'), 'rime');
  assert.equal(ch.attrs.rime, before + START_ATTUNEMENT.bonus);
  assert.equal(ch.manaUnlocked, true);
  assert.equal(ch.startAttune, 'rime');
  assert.ok(ch.mantras.frost_shards);
  assert.deepEqual(ch.hotbar[1], { type: 'mantra', id: 'frost_shards' }, 'on the first free key after the weapon');
  assert.equal(ch.points, fresh().points, 'given as attributes, not points: creation points stay as they were');
});

test('None leaves mana for Sage Ilvar; Random picks one of the five', () => {
  const ch = fresh();
  assert.equal(applyStartingAttunement(ch, 'none'), null);
  assert.equal(ch.manaUnlocked, false);
  assert.deepEqual(ch.mantras, {});
  assert.equal(resolveAttunement('random', () => 0), ATTUNE_ATTRS[0]);
  assert.equal(resolveAttunement('random', () => 0.999), ATTUNE_ATTRS[ATTUNE_ATTRS.length - 1]);
  assert.equal(resolveAttunement('steel'), null, 'a retired attunement is no choice');
});

test('the Shrine of Order keeps creation\'s attunement like a race bonus', () => {
  const ch = fresh();
  applyStartingAttunement(ch, 'storm');
  ch.attrs.storm += 7;
  ch.attrs.strength += 5;
  const game = { ch };
  G.player = { weaponItem: () => null, equipWeapon() {}, equipOutfit() {}, recompute() {}, refreshWeapon() {} };
  respec(game);
  assert.equal(ch.attrs.storm, START_ATTUNEMENT.bonus);
  G.player = null;
});
