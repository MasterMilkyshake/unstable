import test from 'node:test';
import assert from 'node:assert/strict';
import { Quests } from '../src/game/quests.js';
import { G } from '../src/core/globals.js';
import { QUESTS } from '../src/data/quests.js';
import { MAIN_CHAIN } from '../src/data/story.js';

function setup(quests = {}, extra = {}) {
  const ch = { quests, flags: {}, bossesDefeated: [], lore: [], level: 20, inventory: { items: {} }, ...extra };
  const game = { ch, npcs: [], inRift: false, save() {}, takeItem(id, n) { ch.inventory.items[id] -= n; }, giveItem() {}, giveWeapon() {}, giveOutfit() {} };
  G.audio = { play() {} };
  G.ui = { toast() {}, refreshQuests() {}, banner() {} };
  G.player = { pos: { x: 0, z: 0 }, addSilver() {}, addXp() {} };
  return { ch, quests: new Quests(game) };
}

test('the main chain is complete, ordered and every chapter links to the next', () => {
  for (let i = 0; i < MAIN_CHAIN.length; i++) {
    const def = QUESTS[MAIN_CHAIN[i]];
    assert.ok(def && def.main, MAIN_CHAIN[i]);
    if (i < MAIN_CHAIN.length - 1) assert.equal(def.next, MAIN_CHAIN[i + 1], `${MAIN_CHAIN[i]} chains on`);
  }
});

test('the Writ advances step by step through talk, reading and the envoy\'s answer', () => {
  const { ch, quests } = setup({ writ: { state: 'active', stage: 0 } });
  quests.onTalk('hale');
  assert.equal(ch.quests.writ.stage, 1);
  ch.lore.push('enclave_writ');
  quests.onFlag();
  assert.equal(ch.quests.writ.stage, 2);
  ch.flags.writ_answered = true;
  quests.onFlag();
  assert.equal(ch.quests.writ.state, 'ready', 'turning in to Maren is the last step');
});

test('a guardian killed before the chapter makes its travel step moot, but nothing else is skipped', () => {
  const { ch, quests } = setup({ red_tooth: { state: 'active', stage: 0 } });
  ch.bossesDefeated.push('warlord');
  ch.inventory.items.fracture_core = 1;
  assert.equal(quests.get('red_tooth').stage, 0, 'talking to Hale is never skipped');
  quests.onTalk('hale');
  assert.equal(ch.quests.red_tooth.state, 'ready', 'Brigand Hold need not be revisited');
});

test('a veteran who delivered the cores long ago can still finish the Stolen Tooth', () => {
  const { ch, quests } = setup({ red_tooth: { state: 'active', stage: 3 }, fracture: { state: 'done' } }, { bossesDefeated: ['warlord'] });
  assert.equal(quests.get('red_tooth').state, 'ready');
  assert.equal(ch.inventory.items.fracture_core, undefined);
});

test('reach objectives need the player to actually arrive', () => {
  const { ch, quests } = setup({ first_light: { state: 'active', stage: 0 } });
  const o = QUESTS.first_light.stages[0];
  quests.onPosition({ x: o.x + 500, z: o.z });
  assert.equal(ch.quests.first_light.state, 'active');
  if (Number.isFinite(o.x)) {
    quests.onPosition({ x: o.x, z: o.z });
    assert.equal(ch.quests.first_light.state, 'ready');
  }
});

test('a stale ready state is re-verified before rewards are paid', () => {
  const { ch, quests } = setup({ red_tooth: { state: 'ready', stage: 3 } });
  quests.complete('red_tooth');
  assert.equal(ch.quests.red_tooth.state, 'active');
});
