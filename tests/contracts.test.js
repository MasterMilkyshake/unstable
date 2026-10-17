import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import * as THREE from 'three';

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
globalThis.document ||= { addEventListener() {}, querySelector() { return null; }, createElement() { return { getContext() { return null; }, style: {} }; } };
globalThis.window ||= { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

// The contract boards (game/contracts.js) in the real world, headlessly: a board stands beside
// each officer; offers turn over each day; a camp cleared, a convoy seen in, a sounding watched
// and a checkpoint broken are counted from the world's own kills and events; supplies and lost
// things are handed over at the board; a save's bad contract state is repaired.
const { buildWorld } = await import('../tools/reach/world.mjs');
const world = await buildWorld();
const { G } = await import('../src/core/globals.js');
const { Game } = await import('../src/game/game.js');
const { Player } = await import('../src/entities/player.js');
const { NPCS, SPAWNERS } = await import('../src/data/world.js');
const { REGION_NPCS } = await import('../src/data/regions.js');
const { BOOT_HOOKS, START_HOOKS, KILL_HOOKS, ACTIONS } = await import('../src/game/hooks.js');
const { FACTIONS } = await import('../src/data/factions.js');
const { CONTRACTS, BOARD } = await import('../src/data/contracts.js');
const { ensureStanding } = await import('../src/game/factions.js');
const C = await import('../src/game/contracts.js');

let game, toasts;
const officers = [...NPCS, ...REGION_NPCS].filter((d) => Object.values(FACTIONS).some((f) => f.officer === d.id));
G.world = world;
G.scene = world.scene;
G.vfx = new Proxy(function () {}, { get: () => G.vfx, apply: () => G.vfx });
// the officers where NPC stands them (entities/npc.js), without its rig and name tag
const npcs = officers.map((def) => {
  const floor = world.terrain.heightAt(def.x, def.z) + (def.floor || 0);
  const isl = world.terrain.islandFactor(def.x, def.z).island;
  const yaw = def.yaw ?? Math.atan2(isl.cx - def.x, isl.cz - def.z);
  return { id: def.id, def, yaw, pos: new THREE.Vector3(def.x, world.groundAt(def.x, def.z, floor + 0.6), def.z) };
});
{
  // the game's boot: its NPCs stand, then the boot hooks build what play needs
  const boot = Object.assign(Object.create(Game.prototype), { world, npcs });
  for (const h of BOOT_HOOKS) h(boot);
}

beforeEach(() => {
  toasts = [];
  G.ui = { toast: (m) => toasts.push(m), banner() {}, openModal: () => ({ addEventListener() {}, querySelector() { return null; } }), closeModal() {} };
  G.audio = null;
  G.actors = [];
  game = Object.assign(Object.create(Game.prototype), {
    world, npcs, state: 'playing', save() {}, ui: G.ui,
    giveItem(id, n) { this.ch.inventory.items[id] = (this.ch.inventory.items[id] || 0) + n; },
  });
  G.game = game;
  game.ch = ensureStanding(game.createCharacter({ name: 'Hand', race: 'ashkin', look: {} }));
  game.player = new Player(game.ch);
  G.player = game.player;
  for (const h of START_HOOKS) { try { h(game, game.ch); } catch (e) { /* hooks for systems not set up here */ } }
});

test('a board stands beside each officer, on level ground and in nobody\'s way', () => {
  assert.equal(C.BOARDS.length, Object.keys(FACTIONS).length);
  for (const b of C.BOARDS) {
    const off = npcs.find((n) => n.id === FACTIONS[b.faction].officer);
    const d = Math.hypot(b.x - off.pos.x, b.z - off.pos.z);
    assert.ok(d > 1.5 && d < 4, `${b.faction}'s board ${d.toFixed(1)} m from its officer`);
    assert.ok(Math.abs(b.y - off.pos.y) < 0.4, `${b.faction}'s board on the officer's floor`);
    assert.ok(world.interactables.some((it) => it.id === 'contracts_' + b.faction), 'it can be read');
  }
});

test('every clear contract has a camp of its foes, big enough, inside its ring; every lost thing lies on land', () => {
  for (const list of Object.values(CONTRACTS)) for (const c of list) {
    if (c.kind === 'clear') {
      const n = SPAWNERS.filter((s) => c.types.includes(s.type) && Math.hypot(s.x - c.at[0], s.z - c.at[1]) <= c.r).reduce((a, s) => a + s.count, 0);
      assert.ok(n >= c.count, `${c.id}: ${n} of its foes within ${c.r} m, ${c.count} asked`);
    }
    if (c.kind === 'recover') assert.ok(world.terrain.heightAt(...c.at) > 0.5, `${c.id} on land`);
  }
});

test('three offers a board, the same all day, new the next; war work only at war', () => {
  const ch = game.ch;
  ch.stats.playtime = 10;
  const a = C.offersFor(ch, 'watch').map((c) => c.id);
  assert.equal(a.length, BOARD.offers);
  assert.ok(!a.includes('w_war_checkpoint'), 'no war work in peace');
  assert.deepEqual(C.offersFor(ch, 'watch').map((c) => c.id), a, 'the same offers all day');
  let changed = false;
  for (let d = 1; d < 6 && !changed; d++) {
    ch.stats.playtime = 10 + d * BOARD.day;
    changed = C.offersFor(ch, 'watch').map((c) => c.id).join() !== a.join();
  }
  assert.ok(changed, 'the board turns over');
  ch.flags.war_enclave = true;
  const all = new Set();
  for (let d = 0; d < 40; d++) { ch.stats.playtime = d * BOARD.day; for (const c of C.offersFor(ch, 'watch')) all.add(c.id); }
  assert.ok(all.has('w_war_checkpoint'), 'the Watch posts war work at war');
  assert.match(C.boardClosed(ch, 'enclave'), /enemy/, 'and the Enclave posts none for its enemy');
  ch.flags.war_enclave = false;
  ch.rep.ministry = -20;
  assert.ok(C.boardClosed(ch, 'ministry'), 'the Distrusted are turned away');
});

// take a contract whatever today's board shows
function takeAny(id) {
  const ch = game.ch;
  for (let d = 0; d < 60; d++) {
    ch.stats.playtime = d * BOARD.day + 1;
    if (C.offersFor(ch, C.CONTRACT[id].f).some((c) => c.id === id)) return C.takeContract(game, id);
  }
  return false;
}

test('clearing a camp: kills inside its ring count, others don\'t; paid at the board', () => {
  const ch = game.ch;
  assert.ok(takeAny('w_clear_wash'));
  const c = C.CONTRACT.w_clear_wash;
  const kill = (type, x, z) => { for (const h of KILL_HOOKS) h(game, { type, pos: new THREE.Vector3(x, 0, z) }); };
  kill('mudlurker', c.at[0] + 300, c.at[1]);
  kill('brigand', c.at[0], c.at[1]);
  assert.equal(C.contractState(ch).held[0].n, 0, 'far kills and other foes are not counted');
  for (let i = 0; i < c.count; i++) kill('mudlurker', c.at[0] + 5, c.at[1] - 3);
  assert.ok(C.contractState(ch).held[0].ready, 'the camp is cleared');
  const silver = ch.silver, rep = ch.rep.watch;
  assert.ok(C.handIn(game, 'w_clear_wash'));
  assert.equal(ch.silver, silver + c.silver);
  assert.equal(ch.rep.watch, rep + c.rep);
  assert.equal(C.contractState(ch).held.length, 0);
  assert.ok(!C.offersFor(ch, 'watch').some((o) => o.id === 'w_clear_wash'), 'not offered again the same day');
});

test('holding is limited; supplies and lost things are handed over at the board', () => {
  const ch = game.ch;
  assert.ok(takeAny('w_supply_bread'));
  assert.ok(takeAny('w_recover_satchel'));
  assert.equal(C.takeContract(game, 'w_clear_cove'), false, `no more than ${BOARD.held}`);
  assert.equal(C.handIn(game, 'w_supply_bread'), false, 'not without the bread');
  const bread = ch.inventory.items.bread || 0;
  game.giveItem('bread', 4);
  assert.ok(C.handIn(game, 'w_supply_bread'));
  assert.equal(ch.inventory.items.bread || 0, bread, 'the bread is handed over');
  // the satchel lies where it was lost
  const c = C.CONTRACT.w_recover_satchel;
  const it = world.interactables.find((q) => q.id === 'contract_w_recover_satchel');
  assert.ok(it && Math.hypot(it.pos.x - c.at[0], it.pos.z - c.at[1]) < 0.1, 'a bundle at its place');
  assert.ok(Math.abs(it.pos.y - 0.5 - world.groundAt(c.at[0], c.at[1], 400)) < 0.6, 'on the ground');
  game.interact(it); // the game's own [E]
  assert.equal(ch.inventory.items.courier_satchel, 1);
  assert.ok(!world.interactables.includes(it), 'picked up');
  assert.ok(C.handIn(game, 'w_recover_satchel'));
  assert.ok(!ch.inventory.items.courier_satchel);
});

test('the world\'s events count: a convoy seen in, a sounding watched, a checkpoint broken', () => {
  const ch = game.ch;
  assert.ok(takeAny('e_escort_docks'));
  ACTIONS.lifeOutcome({ kind: 'escort', faction: 'watch' });
  assert.ok(!C.contractState(ch).held[0].ready, 'another faction\'s convoy is not this one');
  ACTIONS.lifeOutcome({ kind: 'escort', faction: 'enclave' });
  assert.ok(C.contractState(ch).held[0].ready);
  C.dropContract(game, 'e_escort_docks');
  assert.ok(takeAny('m_witness'));
  ACTIONS.lifeOutcome({ kind: 'witness', faction: 'ministry' });
  assert.ok(C.contractState(ch).held.find((h) => h.id === 'm_witness').ready);
  C.dropContract(game, 'm_witness');
  ch.flags.war_enclave = true;
  assert.ok(takeAny('w_war_checkpoint'));
  ACTIONS.lifeOutcome({ kind: 'checkpoint', cp: 'cp_dock' });
  assert.ok(!C.contractState(ch).held[0].ready, 'the wrong checkpoint');
  ACTIONS.lifeOutcome({ kind: 'checkpoint', cp: C.CONTRACT.w_war_checkpoint.checkpoint });
  assert.ok(C.contractState(ch).held[0].ready);
});

test('a save\'s contract state is repaired, whatever it holds', () => {
  const ch = game.ch;
  for (const bad of [null, 7, 'x', [], { held: 'no' }, { held: [null, { id: 'gone' }, { id: 'w_clear_wash', n: 'lots' }, { id: 'w_clear_wash' }, { id: 'w_clear_cove', n: 99, ready: 'yes' }, { id: 'm_witness' }], done: { gone: 3, w_clear_wash: 'x', m_witness: 2 } }]) {
    ch.lifeContracts = bad;
    const s = C.contractState(ch);
    assert.ok(Array.isArray(s.held) && s.held.length <= BOARD.held);
    for (const h of s.held) {
      assert.ok(C.CONTRACT[h.id]);
      assert.ok(Number.isInteger(h.n) && h.n >= 0);
      assert.equal(typeof h.ready, 'boolean');
    }
    for (const [id, d] of Object.entries(s.done)) assert.ok(C.CONTRACT[id] && Number.isFinite(d));
  }
  const s = C.contractState(ch);
  assert.deepEqual(s.held.map((h) => [h.id, h.n, h.ready]), [['w_clear_wash', 0, false], ['w_clear_cove', C.CONTRACT.w_clear_cove.count, false]]);
  assert.deepEqual(s.done, { m_witness: 2 });
});
