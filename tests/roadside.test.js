import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/core/globals.js';
import '../src/data/adventure.js';
import { AMBUSHERS, TRAVELLERS, NIGHT_WANDERERS } from '../src/data/roadside.js';
import { ENEMIES } from '../src/data/enemies.js';
import { ITEMS } from '../src/data/items.js';
import { DIALOGUES } from '../src/data/npcs.js';
import { startAmbush, tickAmbush, startBeset, tickBeset, startWanderer, tickWanderer } from '../src/game/encounters.js';

test('every roadside party, traveller reward and night wanderer refers to real things', () => {
  for (const [region, t] of Object.entries(AMBUSHERS)) {
    for (const type of t.types) assert.ok(ENEMIES[type], `${region}: ${type}`);
    assert.ok(t.shout.length > 10);
  }
  for (const tr of TRAVELLERS) {
    for (const [item] of tr.reward) assert.ok(ITEMS[item], `${tr.id}: ${item}`);
    assert.ok(tr.cry && tr.thanks && tr.look);
  }
  for (const id of Object.keys(NIGHT_WANDERERS)) assert.equal(ENEMIES[id].model, 'humanoid');
});

// Node has no canvas: NPC name labels draw into this stand-in.
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };

const lent = new Map(); // light -> holder, as World.lendLight hands them out
// A small stand-in for the running game: one player on a road, enemies that can be killed.
function stubGame({ road = 5, night = false } = {}) {
  const scene = new THREE.Scene();
  G.scene = scene;
  G.actors = [];
  const toasts = [];
  G.ui = { toast: (m) => toasts.push(m) };
  G.player = { addSilver() {}, addXp() {} };
  const world = {
    terrain: { heightAt: () => 5, islandAt: () => ({ roadAt: () => ({ d: road }) }), islandFactor: () => ({ island: { cx: 0, cz: 0 } }) },
    islandAt: () => ({ id: 'thornwood' }), biomeAt: () => 'forest',
    groundAt: () => 5, colliders: { addCyl() {}, groundAt: () => -Infinity },
    sky: { isNight: () => night },
    lendLight: (holder, offset, color, distance, decay, intensity) => {
      const l = new THREE.PointLight(color, intensity, distance, decay);
      lent.set(l, holder);
      return l;
    },
  };
  G.world = world;
  const given = [];
  const game = {
    world, npcs: [], ch: { level: 9, stats: {} },
    player: { pos: new THREE.Vector3(0, 5, 0) },
    spawnEnemy(type, pos) {
      const e = { type, pos, dead: false, aggro: null, model: { root: new THREE.Group() }, setAggro(t) { this.aggro = t; } };
      G.actors.push(e);
      return e;
    },
    giveItem: (id, n) => given.push([id, n]), save() {},
  };
  const findSpot = (g, a, b) => new THREE.Vector3((a + b) / 2, 5, 0);
  return { game, findSpot, toasts, given };
}

test('an ambush only springs on the road, comes at you at once, and pays when broken', () => {
  const off = stubGame({ road: 40 });
  assert.equal(startAmbush(off.game, off.findSpot), null);
  const { game, findSpot, toasts } = stubGame();
  const ev = startAmbush(game, findSpot);
  assert.ok(ev.enemies.length >= 2 && ev.enemies.every((e) => e.aggro === game.player));
  assert.ok(toasts[0].includes('Brigands'));
  assert.equal(tickAmbush(game, ev), false);
  for (const e of ev.enemies) e.dead = true;
  assert.equal(tickAmbush(game, ev), true);
  assert.equal(game.ch.stats.ambushes, 1);
});

test('a beset traveller asks for help, thanks you once saved, and leaves cleanly', () => {
  const { game, findSpot, given } = stubGame();
  const ev = startBeset(game, findSpot, () => {});
  assert.equal(game.npcs.length, 1);
  assert.ok(DIALOGUES.evt_traveller({}).text === ev.traveller.cry, 'calls for help while beset');
  for (const e of ev.enemies) e.dead = true;
  tickBeset(game, ev);
  assert.ok(ev.saved);
  const node = DIALOGUES.evt_traveller({});
  node.options[0].do();
  assert.ok(ev.rewarded && given.length === ev.traveller.reward.length);
  assert.equal(DIALOGUES.evt_traveller({}).text, 'Safe roads to you.', 'only rewards once');
  ev.cleanup();
  assert.equal(game.npcs.length, 0);
  assert.equal(DIALOGUES.evt_traveller, undefined);
});

test('the Unrelieved Watchman walks only at night, carries a light, and is gone by day', () => {
  const day = stubGame({ night: false });
  assert.equal(startWanderer(day.game, day.findSpot), null);
  const night = stubGame({ night: true });
  const ev = startWanderer(night.game, night.findSpot);
  const e = ev.enemies[0];
  assert.equal(e.type, 'night_watchman');
  assert.ok(ev.lamp && ev.lamp.isPointLight && ev.lamp.intensity > 0 && lent.get(ev.lamp) === e.model.root, 'his lantern is lit, and he carries it');
  assert.ok(e.patrol && e.patrol.length === 4, 'he walks a round');
  night.game.world.sky.isNight = () => false;
  assert.equal(tickWanderer(night.game, ev), true);
  assert.ok(e.despawn, 'and at dawn he is not there');
});
