import test from 'node:test';
import assert from 'node:assert/strict';
import { CHRONICLE, INVESTIGATIONS, ATLAS } from '../src/data/chronicle.js';
import { LORE, LORE_BY_ID } from '../src/data/lore.js';
import { ITEMS } from '../src/data/items.js';
import { ISLANDS, REGIONS, NPCS, EXPLORATION_DISTRICTS, islandDist } from '../src/data/world.js';
import { hasEvidence, unlockedChapters, investigationState, recordInvestigation, discoveryChanges } from '../src/game/chronicle.js';
import { journalContent } from '../src/ui/journalContent.js';
import { worldDialogue } from '../src/data/testimonies.js';

const full = () => ({ lore: LORE.map((entry) => entry.id), investigations: [], regions: ATLAS.map((entry) => entry.id) });

test('all evidence, reward, region and prerequisite references resolve uniquely', () => {
  for (const list of [LORE, CHRONICLE, INVESTIGATIONS, ATLAS]) assert.equal(new Set(list.map((entry) => entry.id)).size, list.length);
  for (const entry of [...CHRONICLE, ...INVESTIGATIONS]) {
    for (const id of entry.evidence) assert.ok(LORE_BY_ID[id], `${entry.id}: missing ${id}`);
  }
  for (const entry of INVESTIGATIONS) {
    for (const [id, n] of entry.reward.items) { assert.ok(ITEMS[id], id); assert.ok(n > 0); }
    for (const id of entry.requires || []) assert.ok(INVESTIGATIONS.some((other) => other.id === id));
  }
  assert.deepEqual(new Set(ATLAS.map((entry) => entry.id)), new Set([...REGIONS, ...EXPLORATION_DISTRICTS].map((entry) => entry.id)));
  for (const source of LORE) assert.ok(ISLANDS.some((island) => islandDist(island, source.x, source.z) < 1.1), source.id);
});

test('a legacy character with no archive fields can read foundations without spoilers', () => {
  assert.equal(unlockedChapters({}).length, 3); // tide-born primer, death, and the chart of the Anchorage
  assert.equal(hasEvidence({}, []), true);
  for (const tab of ['chronicle', 'atlas', 'investigations', 'lore', 'bestiary', 'records']) assert.ok(journalContent({}, tab).length);
  assert.equal(investigationState({}, INVESTIGATIONS[0]).status, 'undiscovered');
  assert.equal(recordInvestigation({}, 'missing'), null);
});

test('partial evidence never unlocks a complete account and duplicate IDs do not add progress', () => {
  const entry = INVESTIGATIONS[0];
  const ch = { lore: [entry.evidence[0], entry.evidence[0]] };
  assert.equal(investigationState(ch, entry).found.length, 1);
  assert.equal(investigationState(ch, entry).status, 'in_progress');
  assert.equal(recordInvestigation(ch, entry.id), null);
  assert.ok(!journalContent(ch, 'investigations').includes(entry.conclusion));
});

test('sources found before a quest or in any order count, once per character across saves', () => {
  const ch = full();
  ch.lore.reverse();
  const entry = INVESTIGATIONS[0];
  assert.equal(investigationState(ch, entry).status, 'ready');
  assert.equal(recordInvestigation(ch, entry.id), entry);
  assert.equal(recordInvestigation(ch, entry.id), null);
  const loaded = JSON.parse(JSON.stringify(ch));
  assert.equal(investigationState(loaded, entry).status, 'recorded');
  assert.equal(recordInvestigation(loaded, entry.id), null);
  assert.equal(recordInvestigation(full(), entry.id), entry);
});

test('the final investigation requires seven recorded accounts and awards its title once', () => {
  const ch = full();
  const final = INVESTIGATIONS.at(-1);
  assert.equal(recordInvestigation(ch, final.id), null);
  for (const entry of INVESTIGATIONS.slice(0, -1)) assert.equal(recordInvestigation(ch, entry.id), entry);
  assert.equal(investigationState(ch, final).status, 'ready');
  assert.equal(recordInvestigation(ch, final.id), final);
  assert.deepEqual(ch.titles, [final.titleReward]);
  assert.equal(recordInvestigation(ch, final.id), null);
  assert.deepEqual(ch.titles, [final.titleReward]);
});

test('discovery notifications identify newly completed accounts rather than repeating old ones', () => {
  const entry = INVESTIGATIONS[0];
  const before = { lore: entry.evidence.slice(0, -1) };
  const after = { lore: entry.evidence };
  assert.deepEqual(discoveryChanges(before, after).ready.map((entry) => entry.id), [entry.id]);
  assert.equal(discoveryChanges(after, after).ready.length, 0);
  assert.ok(discoveryChanges({}, full()).chapters.length > 0);
});

test('search does not leak unrecovered prose, and recorded sources remain searchable', () => {
  assert.match(journalContent({}, 'lore', 'two blankets'), /No entries/);
  assert.match(journalContent(full(), 'lore', 'two blankets'), /The Blanket Register/);
  assert.match(journalContent({}, 'chronicle', 'royal dry docks'), /No entries/);
  assert.match(journalContent(full(), 'chronicle', 'royal dry docks'), /withheld bell/);
  assert.match(journalContent({}, 'investigations', 'bounty treats an archive'), /No entries/);
});

test('untrusted saved names and titles are escaped in journal HTML', () => {
  const html = journalContent({ titles: ['<img src=x onerror=alert(1)>'] }, 'records');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('NPC testimony changes with evidence and the completed archive', () => {
  const labels = (ch) => worldDialogue('maren', ch).options.map((option) => option.label);
  assert.ok(!labels({}).includes('Whose courage are you spending?'));
  assert.ok(labels({ lore: ['maren_confession'] }).includes('Whose courage are you spending?'));
  assert.ok(labels({ investigations: ['common_memory'] }).includes('Who will keep the archive now?'));
  for (const npc of NPCS) {
    const node = worldDialogue(npc.id, full());
    if (node) for (const option of node.options) assert.ok(option.label);
  }
  assert.equal(worldDialogue('nonexistent', {}), null);
});
