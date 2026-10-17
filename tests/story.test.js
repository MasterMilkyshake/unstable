import test from 'node:test';
import assert from 'node:assert/strict';
import { Quests } from '../src/game/quests.js';
import { G } from '../src/core/globals.js';
import { QUESTS } from '../src/data/quests.js';
import { MAIN_CHAIN } from '../src/data/story.js';
import { NPCS, SPAWNERS } from '../src/data/world.js';
import { atWar } from '../src/game/factions.js';
import { focusQuest, migrateThreads } from '../src/game/story.js';

function setup(quests = {}, extra = {}) {
  const ch = { quests, flags: {}, bossesDefeated: [], lore: [], level: 20, inventory: { items: {} }, ...extra };
  const game = { ch, npcs: [], inRift: false, save() {}, takeItem(id, n) { ch.inventory.items[id] -= n; }, giveItem() {}, giveWeapon() {}, giveOutfit() {} };
  G.audio = { play() {} };
  G.ui = { toast() {}, refreshQuests() {}, banner() {} };
  G.player = { pos: { x: 0, z: 0 }, addSilver() {}, addXp() {} };
  return { ch, quests: new Quests(game) };
}

test('the story threads are optional: no chain, no level gates, nothing starts itself', () => {
  for (const id of MAIN_CHAIN) {
    const def = QUESTS[id];
    assert.ok(def, id);
    assert.ok(!def.main && !def.next && !def.minLevel, `${id} is an ordinary quest`);
  }
  const { ch, quests } = setup({ awakening: { state: 'ready', progress: 3 } });
  quests.complete('awakening');
  assert.equal(ch.quests.awakening.state, 'done');
  assert.equal(ch.quests.first_light, undefined, 'finishing one thread starts no other');
});

test('the compass follows only the quest you track, and taking one up tracks it', () => {
  const { ch, quests } = setup({ writ: { state: 'active', stage: 0 } });
  assert.equal(focusQuest(ch), null, 'no main story to fall back on');
  quests.start('bounty');
  assert.equal(ch.trackedQuest, 'bounty');
  quests.start('pelts');
  assert.equal(ch.trackedQuest, 'bounty', 'an active tracked quest is not taken over');
  ch.quests.bounty.state = 'done';
  assert.equal(focusQuest(ch), null);
});

test('an old mid-story save keeps its compass on the chapter it was following', () => {
  const ch = { quests: { awakening: { state: 'done' }, first_light: { state: 'done' }, writ: { state: 'done' }, red_tooth: { state: 'active', stage: 2 } }, flags: {} };
  migrateThreads(ch);
  assert.equal(ch.trackedQuest, 'red_tooth');
  assert.equal(focusQuest(ch), 'red_tooth');
  ch.trackedQuest = null;
  migrateThreads(ch);
  assert.equal(ch.trackedQuest, null, 'migrates once; untracking afterwards sticks');
  const tracked = { quests: { writ: { state: 'active' }, bounty: { state: 'active' } }, flags: {}, trackedQuest: 'bounty' };
  migrateThreads(tracked);
  assert.equal(tracked.trackedQuest, 'bounty', 'a quest the player tracked stays tracked');
});

test('world gates open by standing and great foes, not chapters', () => {
  const vice = SPAWNERS.find((s) => s.type === 'vice_warden');
  const grand = SPAWNERS.find((s) => s.type === 'grand_warden');
  const base = { quests: {}, flags: {}, rep: {}, bossesDefeated: [] };
  assert.equal(vice.when(base), false, 'the Vice Warden keeps to his fort while the Enclave is at peace with you');
  assert.equal(vice.when({ ...base, rep: { enclave: -60 } }), true, 'Hated by the Enclave: he comes out');
  assert.equal(grand.when(base), false);
  assert.equal(grand.when({ ...base, bossesDefeated: ['vice_warden'] }), true, 'with the Vice Warden dead the Grand Warden is below');
  assert.equal(atWar({ flags: {}, rep: { enclave: -60 } }, 'enclave'), true);
  assert.equal(atWar({ flags: {}, rep: { enclave: 0 } }, 'enclave'), false);
  const clerk = NPCS.find((n) => n.id === 'grey_clerk');
  assert.ok(clerk && !clerk.when, 'the Grey Clerk is in Saltreach from the start');
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
