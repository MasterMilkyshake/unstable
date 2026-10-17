import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import { G } from '../src/core/globals.js';
import { emptyContents, cleanContents, contentsEmpty, entriesOf, takeEntry, takeFromInventory, deathShare, slotsUsed } from '../src/core/contents.js';
import { LOOT } from '../src/data/loot.js';

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
const loot = await import('../src/game/loot.js');
const { deposit, withdraw } = await import('../src/game/bank.js');
const { BOOT_HOOKS, ACTIONS } = await import('../src/game/hooks.js');

function character() {
  const ch = Game.prototype.createCharacter.call({}, { name: 'Carrier', race: 'ashkin', look: {} });
  ch.silver = 200;
  ch.inventory.items = { bread: 6, elixir: 3, lost_satchel: 1, registry_papers: 1, waterskin: 2 };
  ch.waterCharges = 8;
  ch.inventory.weapons = [{ uid: 'w1', id: 'bronze_sword' }, { uid: 'w2', id: 'steel_longsword', temper: 2 }];
  ch.equipped.weapon = 'w1';
  ch.trinkets = [{ uid: 't1', id: 'red_bandana' }, { uid: 't2', id: 'sailors_cap' }];
  ch.gear = { head: 't1' };
  return ch;
}

// a world with nothing in it but what the loot system adds
function stubGame(ch) {
  const added = [];
  const game = {
    ch,
    scene: { add: (g) => added.push(g), remove: (g) => added.splice(added.indexOf(g), 1) },
    world: { interactables: [], addInteract(it) { this.interactables.push(it); return it; }, groundAt: () => 4, inRift: (x) => x > 3000, terrain: { heightAt: () => 4 } },
    player: { pos: { x: 10, y: 4, z: 10 }, derived: { silverMul: 1 }, addSilver(n) { ch.silver += n; }, recompute() {} },
    ui: { toast() {}, refreshHotbar() {}, banner() {} },
    audio: { play() {} },
    save() { this.saves = (this.saves || 0) + 1; },
    giveItem(id, n) { ch.inventory.items[id] = (ch.inventory.items[id] || 0) + n; },
  };
  game.added = added;
  return game;
}
beforeEach(() => {
  G.net = null;
  G.audio = { play() {} };
  G.ui = { toast() {} };
});
for (const f of BOOT_HOOKS) {
  // only the loot system's own boot work (the pouch's mesh parts); the chest patch needs a world
  if (/pouchGeo|IcosahedronGeometry|markersWrapped/.test(String(f))) f({});
}

test('contents: take one, take a stack, take silver, and unknown ids are dropped', () => {
  const c = cleanContents({ silver: 30, items: { bread: 4, not_an_item: 2 }, weapons: [{ uid: 'a', id: 'bronze_sword' }, { id: 'nope' }], trinkets: [{ id: 'sailors_cap' }] });
  assert.deepEqual(Object.keys(c.items), ['bread']);
  assert.equal(c.weapons.length, 1);
  assert.equal(c.trinkets.length, 1);
  assert.ok(c.trinkets[0].uid);
  assert.deepEqual(takeEntry(c, 'item:bread', 1).items, { bread: 1 });
  assert.equal(c.items.bread, 3);
  assert.deepEqual(takeEntry(c, 'item:bread').items, { bread: 3 });
  assert.ok(!('bread' in c.items));
  assert.equal(takeEntry(c, 'item:bread'), null);
  assert.equal(takeEntry(c, 'silver', 10).silver, 10);
  assert.equal(c.silver, 20);
  assert.equal(takeEntry(c, 'weapon:a').weapons[0].id, 'bronze_sword');
  assert.equal(entriesOf(c).map((e) => e.kind).join(), 'silver,trinket');
  takeEntry(c, 'silver');
  takeEntry(c, `trinket:${c.trinkets[0].uid}`);
  assert.ok(contentsEmpty(c));
});

test('leaving things refuses quest items, kept papers, the wielded weapon and worn trinkets', () => {
  const ch = character();
  const { contents, refused } = takeFromInventory(ch, [
    { key: 'item:lost_satchel' }, { key: 'item:registry_papers' }, { key: 'weapon:w1' }, { key: 'trinket:t1' },
    { key: 'item:bread', n: 99 }, { key: 'weapon:w2' }, { key: 'trinket:t2' }, { key: 'silver', n: 50 }, { key: 'item:waterskin', n: 1 },
  ]);
  assert.equal(refused.length, 4);
  assert.deepEqual(contents.items, { bread: 6, waterskin: 1 });
  assert.equal(contents.weapons[0].temper, 2, 'a weapon leaves whole');
  assert.equal(contents.trinkets[0].id, 'sailors_cap');
  assert.equal(contents.silver, 50);
  assert.equal(ch.silver, 150);
  assert.ok(!ch.inventory.items.bread);
  assert.equal(ch.waterCharges, 4, 'the waterskin left takes its sips with it');
  assert.equal(ch.inventory.weapons.length, 1);
  assert.equal(ch.trinkets.length, 1);
});

test('dying leaves half the silver and part of the goods, never what is worn, wielded or banked', () => {
  const ch = character();
  ch.bank = cleanContents({ silver: 500, items: { elixir: 9 } });
  let s = 1;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const picks = deathShare(ch, rand);
  const { contents } = takeFromInventory(ch, picks);
  assert.equal(contents.silver, 100);
  assert.ok(Object.keys(contents.items).length <= LOOT.death.maxStacks);
  assert.ok(!contents.items.lost_satchel && !contents.items.registry_papers);
  assert.ok(!contents.weapons.some((w) => w.uid === 'w1'));
  assert.ok(!contents.trinkets.some((t) => t.uid === 't1'));
  for (const [id, n] of Object.entries(contents.items)) assert.ok(n >= 1 && n <= 6, `${id} ${n}`);
  assert.equal(ch.bank.silver, 500);
  assert.equal(ch.bank.items.elixir, 9);
  assert.ok(ch.inventory.weapons.some((w) => w.uid === 'w1'));
});

test('the strongbox: deposit, take out, its slots, and what must stay', () => {
  const ch = character();
  ch.bank = null;
  assert.equal(deposit(ch, 'silver', 120).ok, true);
  assert.equal(ch.silver, 80);
  assert.equal(deposit(ch, 'item:elixir').ok, true);
  assert.ok(deposit(ch, 'item:lost_satchel').error);
  assert.ok(deposit(ch, 'weapon:w1').error);
  assert.equal(slotsUsed(ch.bank), 1);
  const game = stubGame(ch);
  assert.equal(withdraw(game, 'item:elixir', 1).ok, true);
  assert.equal(ch.inventory.items.elixir, 1);
  assert.equal(ch.bank.items.elixir, 2);
  assert.ok(withdraw(game, 'item:bread').error);
  // full: a new kind of thing has no room, more of a banked stack does
  for (let i = slotsUsed(ch.bank); i < LOOT.bankSlots; i++) ch.bank.trinkets.push({ uid: 'x' + i, id: 'sailors_cap' });
  ch.inventory.items.bread = 2;
  assert.match(deposit(ch, 'item:bread').error, /full/);
  ch.inventory.items.elixir = 1;
  assert.equal(deposit(ch, 'item:elixir').ok, true);
});

test('a pouch: placed in the world, searched in part, gone when empty', () => {
  const ch = character();
  const game = stubGame(ch);
  G.game = game;
  ch.pouches = [];
  const p = loot._placePouch({ x: 10, y: 4, z: 10, contents: { silver: 40, items: { bread: 2 } }, by: 'Carrier', kind: 'pouch' });
  assert.equal(ch.pouches.length, 1);
  assert.equal(loot._shownPouches.size, 1);
  const it = game.world.interactables.find((x) => x.kind === 'pouch');
  assert.equal(it.label, "Search Carrier's pouch");
  assert.deepEqual(loot._takeOwned(p.id, 'item:bread', 1).items, { bread: 1 });
  assert.equal(ch.pouches[0].contents.items.bread, 1);
  loot._takeOwned(p.id, 'item:bread');
  loot._takeOwned(p.id, 'silver');
  assert.equal(ch.pouches.length, 0, 'an empty pouch is gone');
  assert.equal(loot._shownPouches.size, 0);
  assert.ok(!game.world.interactables.some((x) => x.kind === 'pouch'));
  assert.equal(game.added.length, 0);
  assert.equal(loot._takeOwned(p.id, 'silver'), null);
  G.game = null;
});

test('LAN: the host makes a guest\'s pouch, tells everyone, and gives each thing once', () => {
  const ch = character();
  const game = stubGame(ch);
  G.game = game;
  ch.pouches = [];
  const sent = [];
  const net = { isHost: true, isGuest: false, status: 'online', hostId: 1, send: (m) => sent.push(m) };
  G.net = net;
  G.netHandlers.pdrop({ t: 'pdrop', from: 2, p: { x: 5, y: 4, z: 5, contents: { items: { elixir: 2 } }, by: 'Guest', kind: 'pouch' } }, net);
  assert.equal(ch.pouches.length, 1, 'kept in the host\'s world');
  assert.equal(sent.find((m) => m.t === 'pset').p.by, 'Guest');
  const id = ch.pouches[0].id;
  G.netHandlers.ptake({ t: 'ptake', from: 3, id, key: 'item:elixir', n: null }, net);
  G.netHandlers.ptake({ t: 'ptake', from: 2, id, key: 'item:elixir', n: null }, net);
  const gives = sent.filter((m) => m.t === 'pgive');
  assert.deepEqual(gives.map((m) => [m.to, !!m.got]), [[3, true], [2, false]], 'the first asker gets it, the second nothing');
  assert.ok(sent.some((m) => m.t === 'pgone' && m.id === id));
  assert.equal(ch.pouches.length, 0);
  // a guest's ask for the list
  G.netHandlers.preq({ t: 'preq', from: 2 }, net);
  assert.deepEqual(sent[sent.length - 1], { t: 'plist', to: 2, list: [] });
  G.net = null;
  G.game = null;
});

test('the map marks your own pouches, after every system has set its markers', () => {
  // markers.js is imported after loot.js and replaces ACTIONS.mapMarkers; loot wraps it at boot
  const ch = character();
  const game = stubGame(ch);
  G.game = game;
  ch.pouches = [];
  loot._placePouch({ x: 10, y: 4, z: 10, contents: { silver: 40 }, by: 'Carrier', kind: 'lost' });
  loot._placePouch({ x: 12, y: 4, z: 10, contents: { silver: 5 }, by: 'Someone', kind: 'pouch' });
  loot._placePouch({ x: 6000, y: 4, z: 10, contents: { silver: 5 }, by: 'Carrier', kind: 'pouch' });
  const surface = ACTIONS.mapMarkers({ rift: false }).filter((m) => /lost|pouch/i.test(m.label || ''));
  assert.deepEqual(surface.map((m) => m.label), ['What you lost'], 'only your own, on this side');
  assert.deepEqual(ACTIONS.mapMarkers({ rift: true }).filter((m) => /pouch/i.test(m.label || '')).map((m) => m.x), [6000]);
  for (const p of [...ch.pouches]) loot._takeOwned(p.id, 'silver');
  G.game = null;
});

test('a pouch never rests in deep water or over the Abyss', () => {
  const world = { groundAt: (x, z, top) => (x > 3000 ? -500 : x < 0 ? -3 : 4), inRift: (x) => x > 3000 };
  assert.deepEqual(loot.restingPlace(world, 10, 4, 10), { x: 10, y: 4, z: 10 });
  assert.equal(loot.restingPlace(world, -10, 0, 10), null, 'the sea floor');
  assert.equal(loot.restingPlace(world, 6000, 40, 6000), null, 'the Abyss');
  void ACTIONS;
});
