import test from 'node:test';
import assert from 'node:assert/strict';
import { Quests } from '../src/game/quests.js';
import { G } from '../src/core/globals.js';

function setup({ bosses = [], cores = 3, state = 'active' } = {}) {
  const ch = { quests: { fracture: { state, progress: 0 } }, flags: {}, bossesDefeated: bosses, inventory: { items: { fracture_core: cores } } };
  const rewards = { silver: 0, xp: 0, saves: 0, items: [] };
  const game = { ch, npcs: [], save() { rewards.saves++; }, takeItem(id, n) { ch.inventory.items[id] -= n; }, giveItem(id, n) { rewards.items.push([id, n]); } };
  G.audio = { play() {} };
  G.ui = { toast() {}, refreshQuests() {}, banner() {} };
  G.player = { addSilver(n) { rewards.silver += n; }, addXp(n) { rewards.xp += n; } };
  return { ch, rewards, quests: new Quests(game) };
}

test('three generic cores do not replace the three distinct guardians', () => {
  const { quests } = setup({ bosses: ['warlord'] });
  assert.equal(quests.get('fracture').state, 'active');
  const text = quests.active()[0].text;
  assert.match(text, /Frost Warden/);
  assert.match(text, /Cinder Colossus/);
  assert.ok(!text.includes('Kaelen'));
});

test('guardian history from before acceptance counts and completion consumes cores once', () => {
  const { quests, rewards, ch } = setup({ bosses: ['warlord', 'frost_warden', 'cinder_colossus'] });
  assert.equal(quests.get('fracture').state, 'ready');
  quests.complete('fracture');
  quests.complete('fracture');
  assert.equal(ch.quests.fracture.state, 'done');
  assert.equal(ch.inventory.items.fracture_core, 0);
  assert.equal(rewards.xp, 2500);
  assert.equal(rewards.silver, 500);
  assert.deepEqual(rewards.items, [['ember_of_life', 1]]);
});

test('a stale ready state cannot redeem missing cores or missing boss history', () => {
  for (const opts of [{ bosses: ['warlord'], state: 'ready' }, { bosses: ['warlord', 'frost_warden', 'cinder_colossus'], cores: 2, state: 'ready' }]) {
    const { quests, rewards, ch } = setup(opts);
    quests.complete('fracture');
    assert.equal(ch.quests.fracture.state, 'active');
    assert.equal(rewards.xp, 0);
    assert.equal(rewards.silver, 0);
  }
});

test('completed legacy quests are never reopened by the added requirements', () => {
  const { quests } = setup({ cores: 0, state: 'done' });
  assert.equal(quests.get('fracture').state, 'done');
});

test("Hale offers the Watch's own path beside the brigand work, not only after it", async () => {
  const { DIALOGUES } = await import('../src/data/npcs.js');
  await import('../src/data/storyDialogue.js');
  const quests = { writ: { state: 'done' } };
  const api = {
    quest: (id) => quests[id] || { state: 'none', progress: 0 },
    atWar: () => false, wanted: () => false, rep: () => 0, fine: () => 0, flag: () => false,
  };
  const labels = () => DIALOGUES.hale(api).options.map((o) => o.label);
  assert.ok(labels().includes('Any work for a blade?'));
  assert.ok(labels().includes('The Watch looks stretched.'), 'the Watch path is offered before Red Bandanas is taken');
  quests.writ.state = 'active';
  assert.ok(!labels().includes('The Watch looks stretched.'), 'and not before the writ is answered');
});

test('each officer opens its faction\'s stores to the Trusted, not to the wanted or before', async () => {
  const { DIALOGUES, SHOPS } = await import('../src/data/npcs.js');
  await import('../src/data/storyDialogue.js');
  const rep = { watch: 0, enclave: 0, ministry: 0 };
  let wanted = false;
  const opened = [];
  const api = {
    quest: (id) => ({ state: id === 'grey_letter' ? 'done' : 'none', progress: 0 }),
    atWar: () => false, wanted: () => wanted, rep: (f) => rep[f], fine: () => 0, flag: (k) => k === 'registryPapers', setFlag() {},
    openShop: (id) => opened.push(id),
  };
  for (const [npc, f, shop] of [['hale', 'watch', 'watch_stores'], ['meridian_captain', 'enclave', 'enclave_stores'], ['minister_quill', 'ministry', 'ministry_stores']]) {
    assert.ok(SHOPS[shop], `${shop} exists`);
    const stores = () => DIALOGUES[npc](api).options.find((o) => o.label === 'Show me the stores.');
    rep[f] = 9;
    assert.ok(!stores(), `${npc}: not below Trusted`);
    rep[f] = 10;
    stores().do(api);
    assert.equal(opened[opened.length - 1], shop, `${npc}: Trusted opens ${shop}`);
    wanted = true;
    assert.ok(!stores(), `${npc}: not while wanted`);
    wanted = false;
  }
});
