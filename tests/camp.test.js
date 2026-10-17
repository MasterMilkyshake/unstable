// Campfires you make (game/camp.js, the user's call, 2026-10-16, as in Deepwoken): three Sticks or
// one Firewood lay a fire ahead of you; sitting by it is where points are invested; it burns five
// minutes of play; never in the Rift, in danger, in water or aboard; a friend's fire shows on LAN.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, arena, player } from './support/arena.js';

const { CAMP, madeFires, douseAll } = await import('../src/game/camp.js');
const { runUpdateHooks } = await import('../src/game/hooks.js');
const { ITEMS } = await import('../src/data/items.js');
const { SHOPS } = await import('../src/data/npcs.js');
const { FORAGE } = await import('../src/world/forage.js');
const { START_POINTS } = await import('../src/data/stats.js');

// A character on flat ground with `items`, facing +z, the world able to take a fire.
function camper(items = {}) {
  const ctx = arena();
  Object.assign(G.world, {
    lightSources: [],
    interactables: [],
    addInteract(it) {
      this.interactables.push(it);
      return it;
    },
    addEmitter() {},
  });
  ctx.game.camYaw = 0;
  ctx.game.inRift = false;
  const toasts = [];
  G.ui = new Proxy({}, { get: (_, k) => (k === 'toast' ? (m) => toasts.push(m) : () => {}) });
  const p = player();
  p.grounded = true;
  Object.assign(p.ch.inventory.items, items);
  douseAll(); // none left from another test
  return Object.assign(ctx, { p, toasts });
}
const fireSeats = () => G.world.interactables.filter((i) => i.kind === 'campfire');

test('three Sticks or one Firewood lay a campfire just ahead; sitting by it, points are invested', () => {
  const { p } = camper({ stick: 3 });
  p.useItem('stick');
  assert.equal(madeFires().length, 1);
  assert.equal(p.ch.inventory.items.stick, undefined, 'the three sticks are spent');
  const [seat] = fireSeats();
  assert.ok(Math.abs(seat.pos.z - CAMP.ahead) < 1e-6 && Math.abs(seat.pos.x) < 1e-6, 'laid just ahead');
  assert.equal(seat.label, 'Sit / Cook');
  assert.equal(G.world.lightSources.length, 1, 'a light source for the pool, not a new point light');
  // sitting by it (ui/interact.js openCampfire sets this) is a rest
  assert.equal(p.invest({ strength: 1 }), -1);
  p.sitting = true;
  assert.equal(p.invest({ strength: 1 }), 0);
  assert.equal(p.ch.points, START_POINTS - 1);
  // one Firewood does it too; a second fire of your own puts out the first
  const { p: q } = camper({ firewood: 2 });
  q.useItem('firewood');
  q.useItem('firewood');
  assert.equal(madeFires().length, 1);
  assert.equal(q.ch.inventory.items.firewood, undefined);
  assert.equal(fireSeats().length, 1);
});

test('too few sticks lay no fire, and nothing is spent', () => {
  const { p, toasts } = camper({ stick: 2 });
  p.useItem('stick');
  assert.equal(madeFires().length, 0);
  assert.equal(p.ch.inventory.items.stick, 2);
  assert.ok(toasts.some((m) => /takes 3 Sticks/.test(m)), toasts.join(' / '));
});

test('a made fire burns five minutes of play, then its light, embers and seat go, and whoever sat by it stands', () => {
  const { p, game, toasts } = camper({ firewood: 1 });
  p.useItem('firewood');
  p.sitting = true;
  for (let t = 0; t < CAMP.burn - 1; t += 1) runUpdateHooks(game, 1);
  assert.equal(madeFires().length, 1, 'still burning a second before the end');
  runUpdateHooks(game, 2);
  assert.equal(madeFires().length, 0);
  assert.equal(fireSeats().length, 0);
  assert.equal(G.world.lightSources.length, 0);
  assert.equal(p.sitting, false);
  assert.ok(toasts.includes('Your fire burns out.'));
});

test('no fire in the Rift, in danger, in water, aboard or in the air; nothing is spent', () => {
  const cases = [
    ['in the Rift', (p, game) => (game.inRift = true), /Rift/],
    ['in danger', (p) => (p.dangerT = 5), /danger/],
    ['swimming', (p) => (p.swimming = true), /solid ground/],
    ['aboard', (p) => (p.boat = {}), /boat/],
    ['in the air', (p) => (p.grounded = false), /solid ground/],
  ];
  for (const [name, set, says] of cases) {
    const { p, game, toasts } = camper({ firewood: 1 });
    set(p, game);
    p.useItem('firewood');
    assert.equal(madeFires().length, 0, name);
    assert.equal(p.ch.inventory.items.firewood, 1, name);
    assert.ok(toasts.some((m) => says.test(m)), `${name}: ${toasts.join(' / ')}`);
  }
});

test('on LAN a friend\'s fire shows here too, and anyone may sit by it', () => {
  camper();
  G.netHandlers.camp({ t: 'camp', x: 4, y: 0, z: 2, by: 'Wren', from: 9 }, { avatars: new Map() });
  assert.equal(madeFires().length, 1);
  const [seat] = fireSeats();
  assert.equal(seat.name, "Wren's Campfire");
  assert.equal(seat.kind, 'campfire');
});

test('Sticks come from fallen branches in the woods, and Firewood from the general stores', () => {
  assert.equal(ITEMS.stick.camp, 3);
  assert.equal(ITEMS.firewood.camp, 1);
  assert.equal(FORAGE.fallen_branch.item, 'stick');
  assert.ok(Object.keys(FORAGE).at(-1) === 'fallen_branch', 'last, so the older kinds keep their scatter');
  for (const shop of ['pell', 'brynja', 'moss', 'ama']) assert.ok(SHOPS[shop].items.includes('firewood'), shop);
});
