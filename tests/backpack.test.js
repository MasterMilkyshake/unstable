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
globalThis.document = { addEventListener() {}, getElementById() { return null; } };
globalThis.window = { addEventListener() {} };
const { Game } = await import('../src/game/game.js');
const bp = await import('../src/ui/backpack.js');

function carrier() {
  const ch = Game.prototype.createCharacter.call({}, { name: 'Packer', race: 'ashkin', look: {} });
  ch.inventory.weapons.push({ uid: 'w1', id: 'bronze_sword', enchant: null });
  ch.inventory.items = { bread: 3, elixir: 2, smithing_stone: 4, lost_satchel: 1 };
  ch.inventory.outfits.push('traveler');
  ch.trinkets = [{ uid: 't1', id: 'sailors_cap' }];
  ch.gear = { head: 't1', neck: null, ring: null };
  ch.mantras = { ember_bolt: { stars: 0 } };
  ch.equipped.weapon = 'w1';
  const p = { ch, weaponItem: () => ch.inventory.weapons[0] };
  return { ch, p };
}

test('the backpack holds everything carried, each in its kind, and the mantras known', () => {
  const { ch, p } = carrier();
  const all = bp.entries(p, ch);
  const cat = (k) => all.find((e) => e.key === k).cat;
  assert.equal(cat('w:w1'), 'weapons');
  assert.equal(cat('o:traveler'), 'gear');
  assert.equal(cat('t:t1'), 'gear');
  assert.equal(cat('i:bread'), 'supplies');
  assert.equal(cat('i:smithing_stone'), 'materials');
  assert.equal(cat('i:lost_satchel'), 'quest');
  assert.equal(cat('m:ember_bolt'), 'mantras');
  assert.ok(all.find((e) => e.key === 'w:w1').eq, 'the wielded weapon is marked');
  assert.ok(all.find((e) => e.key === 't:t1').eq, 'a worn trinket is marked');
  assert.equal(all.find((e) => e.key === 'i:bread').n, 3);
  assert.equal(all.find((e) => e.key === 'i:bread').hot, 9, 'bread starts on key 0');
});

test('filters and the search narrow the tiles', () => {
  const { ch, p } = carrier();
  const all = bp.entries(p, ch);
  assert.deepEqual(bp.visible(all, { filter: 'supplies', q: '' }).map((e) => e.key).sort(), ['i:bread', 'i:elixir', 'i:waterskin'].filter((k) => all.some((e) => e.key === k)).sort());
  assert.deepEqual(bp.visible(all, { filter: 'all', q: 'ELIX' }).map((e) => e.key), ['i:elixir']);
  assert.equal(bp.visible(all, { filter: 'weapons', q: 'nothing' }).length, 0);
});

test('only supplies and mantras go on the hotbar, on one key at a time', () => {
  const { ch, p } = carrier();
  const all = bp.entries(p, ch);
  const by = (k) => all.find((e) => e.key === k);
  assert.equal(bp.assign(ch, by('w:w1'), 3), false, 'a weapon has key 1 already');
  assert.equal(bp.assign(ch, by('i:smithing_stone'), 3), false, 'a material is not used from the hotbar');
  assert.equal(bp.assign(ch, by('i:elixir'), 0), false, 'key 1 is the weapon');
  assert.ok(bp.assign(ch, by('i:elixir'), 3));
  assert.ok(bp.assign(ch, by('i:elixir'), 5));
  assert.deepEqual([ch.hotbar[3], ch.hotbar[5]], [null, { type: 'item', id: 'elixir' }], 'moved, not copied');
  assert.ok(bp.assign(ch, by('m:ember_bolt'), 2));
  assert.deepEqual(ch.hotbar[2], { type: 'mantra', id: 'ember_bolt' });
});

test('sitting by a fire names points that wait and opens a Power that is due; cards wait anywhere', async () => {
  const { growthAtRest } = await import('../src/ui/interact.js');
  const { ACTIONS } = await import('../src/game/hooks.js');
  const toasts = [];
  const opened = [];
  const ui = { toast: (t) => toasts.push(t) };
  const prev = [ACTIONS.readyToRise, ACTIONS.openRest];
  try {
    ACTIONS.readyToRise = undefined;
    assert.equal(growthAtRest(ui), false, 'a build without the rest API does nothing');
    ACTIONS.openRest = (u) => opened.push(u) && true;
    let waits = { points: 0, talentPicks: 1, mantraPicks: 1, rise: false };
    ACTIONS.readyToRise = () => waits;
    assert.equal(growthAtRest(ui), false, 'cards alone are no reason to sit: they are chosen anywhere');
    waits = { points: 3, talentPicks: 0, mantraPicks: 0, rise: false };
    assert.equal(growthAtRest(ui), true);
    assert.equal(opened.length, 0, 'points waiting are only named');
    assert.match(toasts[0], /Tab.*invest/);
    waits = { points: 0, talentPicks: 0, mantraPicks: 0, rise: true };
    growthAtRest(ui);
    assert.equal(opened.length, 1, 'a Power that waits opens at once');
    assert.equal(ACTIONS.afterRest, undefined, 'an inn only sets where you wake: no hook after it');
  } finally {
    [ACTIONS.readyToRise, ACTIONS.openRest] = prev;
  }
});
