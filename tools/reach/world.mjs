// The real world, built headlessly for the reach tools: the same World.build() the game runs
// at boot, so every collider, carrier line and lift is the game's own.
import * as THREE from 'three';

globalThis.document ??= { addEventListener() {}, querySelector() { return null; }, createElement() { return { getContext() { return null; }, style: {} }; } };
globalThis.window ??= { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { G } = await import('../../src/core/globals.js');
const { World } = await import('../../src/world/world.js');

export async function buildWorld() {
  G.vfx ??= { emitters: [] };
  const world = new World(new THREE.Scene());
  world.build();
  G.world = world;
  return world;
}
