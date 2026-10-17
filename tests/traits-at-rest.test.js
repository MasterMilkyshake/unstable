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
const { G } = await import('../src/core/globals.js');
const { ACTIONS } = await import('../src/game/hooks.js');
const { assignTrait, traitFree, traitsHtml } = await import('../src/game/gear.js');
const { TRAIT_MAX } = await import('../src/data/trinkets.js');
const { BIND, CONTROLS } = await import('../src/core/input.js');
const { HOTKEYS } = await import('../src/ui/hotkeys.js');
await import('../src/ui/charmenu.js');

// A character with trait points to spend, and a stand-in player that can be sat by a fire.
function traveler() {
  const ch = Game.prototype.createCharacter.call({}, { name: 'Sitter', race: 'ashkin', look: {} });
  ch.traits = { vitality: 0, erudition: 0, proficiency: 0, songchant: 0 };
  let recomputed = 0;
  const p = { ch, sitting: false, recompute: () => recomputed++, resting() { return this.sitting; } };
  return { ch, p, recomputed: () => recomputed };
}

test('traits are assigned only while resting at a campfire, like attribute points', () => {
  const { ch, p, recomputed } = traveler();
  const free = traitFree(ch);
  assert.ok(free > 0, 'a new character has trait points');
  assert.equal(assignTrait(p, 'vitality'), false, 'refused away from a fire');
  assert.equal(ch.traits.vitality, 0);
  p.sitting = true;
  assert.equal(assignTrait(p, 'vitality'), true, 'accepted by a fire');
  assert.equal(ch.traits.vitality, 1);
  assert.equal(traitFree(ch), free - 1);
  assert.equal(recomputed(), 1, 'the character is recomputed');
  assert.equal(assignTrait(p, 'not_a_trait'), false);
});

test('a trait stops at its cap and spending stops when the points run out', () => {
  const { ch, p } = traveler();
  p.sitting = true;
  ch.traits.erudition = TRAIT_MAX;
  assert.equal(assignTrait(p, 'erudition'), false, 'no point past the cap');
  while (traitFree(ch) > 0) assert.equal(assignTrait(p, 'vitality') || assignTrait(p, 'proficiency') || assignTrait(p, 'songchant'), true);
  assert.equal(assignTrait(p, 'songchant'), false, 'nothing left to assign');
});

test('the Attributes tab shows the traits, with + only when resting and points wait', () => {
  const { ch } = traveler();
  const away = traitsHtml(ch, false);
  const sat = traitsHtml(ch, true);
  for (const name of ['Vitality', 'Erudition', 'Proficiency', 'Songchant']) assert.ok(away.includes(name), name);
  assert.equal((away.match(/data-trait="[a-z]+" disabled/g) || []).length, 4, 'every + is off away from a fire');
  assert.equal((sat.match(/data-trait="[a-z]+" disabled/g) || []).length, 0, 'every + is on at a fire');
});

test('a campfire opens on waiting trait points as it does on attribute points', () => {
  const { ch } = traveler();
  ch.points = 0;
  ch.talentPicks = 0;
  ch.mantraPicks = 0;
  G.player = { ch };
  const r = ACTIONS.readyToRise();
  assert.equal(r.traits, traitFree(ch));
  assert.ok(r.traits > 0);
  G.player = null;
});

test('K opens nothing: the Gear & Traits panel and its key are gone', () => {
  assert.equal(BIND.gear, undefined);
  assert.ok(!Object.values(BIND).some((codes) => codes.includes('KeyK')), 'no action is bound to K');
  assert.equal(HOTKEYS.KeyK, undefined);
  assert.ok(!CONTROLS.some((row) => row.keys.includes('gear')));
  assert.equal(ACTIONS.openGear, undefined);
});
