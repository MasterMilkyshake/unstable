import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildLandmarks, carrierOf } from '../src/world/landmarks.js';
import { Colliders } from '../src/world/colliders.js';
import { G } from '../src/core/globals.js';
import { LORE } from '../src/data/lore.js';

const makeWorld = () => ({
  terrain: { heightAt: () => 3 }, scene: new THREE.Scene(), colliders: new Colliders(),
  animated: [], docks: {}, interactables: [],
  addInteract(entry) { this.interactables.push(entry); return entry; },
});

test('every written source has an interaction, and recorded ones read as revisits', () => {
  const world = makeWorld();
  buildLandmarks(world, []);
  assert.equal(world.loreTablets.length, LORE.length);
  const [first, second] = world.loreTablets;
  G.game = { ch: { lore: [first.lore.id] } };
  world.animated[0](0);
  assert.match(first.interaction.label, /^Revisit:/);
  assert.match(second.interaction.label, /^Read/);
  G.game = { ch: {} };
  world.animated[0](0);
  assert.match(first.interaction.label, /^Read/);
});

test('sources sit on carriers that suit them, and nothing glows', () => {
  assert.equal(carrierOf({ title: 'Notice of the Missing' }), 'notice');
  assert.equal(carrierOf({ title: "Log of the Gull's Reach" }), 'book');
  assert.equal(carrierOf({ title: 'Inscription in the Ruins' }), 'carving');
  const world = makeWorld();
  buildLandmarks(world, []);
  for (const tab of world.loreTablets) {
    if (!tab.group) continue;
    tab.group.traverse((o) => {
      if (o.isMesh) assert.equal(o.material.emissive.getHex(), 0, `${tab.lore.id} should not glow`);
    });
  }
});
