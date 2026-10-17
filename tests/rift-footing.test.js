import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { riftFooting } from '../src/game/riftFooting.js';
import { RIFT_SPAWN } from '../src/data/world.js';

function game(x, y, z, { ground = 5, inside = false } = {}) {
  return {
    inRift: true,
    player: { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(1, -3, 0) },
    world: {
      terrain: { heightAt: (px, pz) => (px === RIFT_SPAWN.x && pz === RIFT_SPAWN.z ? 6 : ground) },
      colliders: { pointInside: () => (inside ? {} : null) },
      groundAt: () => 6,
    },
  };
}

test('an old Rift save over the void is stepped back onto the arrival shelf', () => {
  const g = game(6196, 4, 5962, { ground: -260 });
  assert.equal(riftFooting(g), true);
  assert.equal(g.player.pos.x, RIFT_SPAWN.x);
  assert.equal(g.player.pos.z, RIFT_SPAWN.z);
  assert.ok(g.player.pos.y > 5);
  assert.equal(g.player.vel.length(), 0);
});

test('an old Rift save inside a new wall is stepped out too', () => {
  const g = game(6000, 18, 6120, { inside: true });
  assert.equal(riftFooting(g), true);
  assert.equal(g.player.pos.x, RIFT_SPAWN.x);
});

test('a save on solid open ground, or on the surface, is left where it is', () => {
  const g = game(6050, 10, 5950);
  assert.equal(riftFooting(g), false);
  assert.equal(g.player.pos.x, 6050);
  const surface = game(0, 5, 0, { ground: -260 });
  surface.inRift = false;
  assert.equal(riftFooting(surface), false);
});

test('a save where the Abyssal Depths were is stepped back onto the arrival shelf', () => {
  const g = game(7000, 5, 7000, { ground: -260 });
  assert.equal(riftFooting(g), true);
  assert.equal(g.player.pos.x, RIFT_SPAWN.x);
});
