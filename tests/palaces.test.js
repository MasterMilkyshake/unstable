import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { NPCS, LOCATIONS } from '../src/data/world.js';
import { ROADS } from '../src/data/roads.js';
import { SETTLEMENT_ROADS } from '../src/data/architecture.js';
import { samplePath } from '../src/world/paths.js';

// The faction seats on the real terrain with everything around them, walked by their colliders.
const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [], interactables: [],
  addLight() {}, addInteract(it) { this.interactables.push(it); }, addEmitter() {},
};
world.terrain.build();
buildStructures(world);

// Walk a polyline at a 0.15 m pace: never blocked, never a step over 0.55 m, never a fall.
function walk(route) {
  let y = route.y0;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15);
    for (let j = 1; j <= n; j++) {
      const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n;
      const g = Math.max(world.terrain.heightAt(x, z), world.colliders.groundAt(x, z, y + 0.55));
      assert.ok(g > y - 0.6, `${route.id}: the floor gives way at ${x.toFixed(1)}, ${z.toFixed(1)} (${y.toFixed(2)} -> ${g.toFixed(2)})`);
      const actor = new THREE.Vector3(x, g + 0.02, z);
      world.colliders.resolve(actor, 0.4, 1.8);
      assert.ok(Math.hypot(actor.x - x, actor.z - z) < 0.06, `${route.id}: blocked at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      y = g;
    }
  }
  return y;
}

test('the Lantern Palace is walked from the North Way to its lantern, room by room', () => {
  const palace = world.palaces.find(p => p.name === 'The Lantern Palace');
  assert.ok(palace.routes.length >= 7);
  for (const route of palace.routes) walk(route);
  const crown = palace.routes.find(r => r.id.includes('crown'));
  const top = walk(crown);
  assert.ok(top > crown.y0 + 30, 'the crown stair climbs to the lantern gallery');
});

test('every palace room has a use, and the Keeper sits in her chair', () => {
  const palace = world.palaces.find(p => p.name === 'The Lantern Palace');
  for (const room of palace.rooms) assert.ok(room.use && room.use.length > 12, `${room.name} has a purpose`);
  for (const name of ['Lantern Gate', 'Lantern Court', 'The Great Hall', "The Keepers' Chair", 'The Lantern Crown']) {
    assert.ok(palace.rooms.some(r => r.name === name), name);
  }
  const maren = NPCS.find(n => n.id === 'maren');
  const chair = palace.rooms.find(r => r.name === "The Keepers' Chair");
  assert.ok(Math.hypot(maren.x - chair.at.x, maren.z - chair.at.z) < 7, 'Elder Maren keeps the Keepers’ Chair');
});

test('the Chain Citadel is walked from the parade ground to its beacon, barracks and terraces', () => {
  const palace = world.palaces.find(p => p.name === 'The Chain Citadel');
  assert.ok(palace.routes.length >= 5);
  for (const route of palace.routes) walk(route);
  const crown = palace.routes.find(r => r.id.includes('beacon'));
  assert.ok(walk(crown) > crown.y0 + 26, 'the crown stair climbs to the beacon');
  for (const name of ['The Chain Gate', 'Quarterdeck Yard', "The Vice Warden's Hall", 'War and Chart Room', 'The Signal Crown', "Captains' Barracks"]) {
    assert.ok(palace.rooms.some(r => r.name === name), name);
  }
});

test('the Iron Stair climbs from the Lower Works to the West Gate beside the lift', () => {
  const stair = world.approaches.find(a => a.id === 'iron_stair');
  // walk it upward: from its foot on the Lower Works to the head of the stair and the deck
  const route = [...stair.route].reverse();
  const end = walk({ id: 'Iron Stair', y0: world.terrain.heightAt(route[0].x, route[0].z), points: route });
  assert.ok(end > 45, `the stair reaches the bastion (${end.toFixed(1)})`);
  const lift = world.meridianLift;
  walk({ id: 'stair head to the West Gate', y0: end, points: [route.at(-1), { x: lift.x + 8, z: lift.z - 4 }, { x: lift.x + 8, z: lift.z }, { x: lift.x + 22, z: lift.z }] });
});

test('the Meridian Dock Road is walked from the docks through the Ward and the Lower Works to the West Gate', () => {
  const along = (id) => samplePath(ROADS.find(r => r.id === id), 0.5).map(p => ({ x: p.x, z: p.z }));
  // the Dock Road is authored downhill from the Supply Road; walk it up from the landing
  const dock = along('meridian_dock_road').reverse(), supply = along('meridian_supply_road');
  const yard = SETTLEMENT_ROADS.find(r => r.points.at(-1)[0] > 1116 && r.points.at(-1)[1] < -700).points.map(([x, z]) => ({ x, z }));
  const gap = supply.map(p => Math.hypot(p.x - yard[0].x, p.z - yard[0].z)), into = gap.indexOf(Math.min(...gap));
  assert.ok(gap[into] < 2.5, 'the Supply Road passes the Lower Works yard');
  const stair = [...world.approaches.find(a => a.id === 'iron_stair').route].reverse();
  const route = [...dock, ...supply.slice(1, into + 1), ...yard, ...stair];
  const top = walk({ id: 'Meridian Dock Road', y0: world.terrain.heightAt(route[0].x, route[0].z), points: route });
  assert.ok(top > 45, `the route reaches the bastion (${top.toFixed(1)})`);
  const near = (name, f = 0.6) => {
    const l = LOCATIONS.find(l => l.name === name);
    return route.some(p => Math.hypot(p.x - l.x, p.z - l.z) < l.r * f);
  };
  assert.ok(near('Meridian Ward'), 'the road runs through the Ward, not past it');
  assert.ok(near('Meridian Lower Works'), 'the road runs through the Lower Works');
  assert.ok(near('Meridian Docks', 1), 'the road starts at the docks');
});

test('the Sounding House is climbed from the Sounding Way to the Minister and the Listening Room gallery', () => {
  const seat = world.seats.find(s => s.id === 'sounding_house');
  assert.ok(seat, 'the Sounding House records its routes');
  for (const room of seat.rooms) assert.ok(room.use && room.use.length > 12, `${room.name} has a purpose`);
  // the lower flight and the shelf lane, then every flight of the Ministry Stair
  const stair = world.approaches.find(a => a.id === 'ministry_stair');
  const lane = [[-1164.5, 1138], [-1180.5, 1138], [-1186, 1136], [-1189, 1118], [-1196, 1104], [-1203, 1104], [-1204.4, 1108.8]].map(([x, z]) => ({ x, z }));
  const y = walk({ id: 'the Hush shelf', y0: world.terrain.heightAt(-1164.5, 1138), points: [...lane, ...[...stair.route].reverse()] });
  assert.ok(y > 33.5, 'the Ministry Stair reaches the summit table');
  for (const route of seat.routes) walk({ ...route, y0: route.points[0].y + route.y0 });
  const quill = NPCS.find(n => n.id === 'minister_quill');
  const hall = seat.rooms.find(r => r.name === 'The Hall of Soundings');
  assert.ok(Math.hypot(quill.x - hall.at.x, quill.z - hall.at.z) < 6.5, 'the Minister keeps the Hall of Soundings');
});

test('Brigand Hold is entered at the Red Gate and its Shiphouse walked to the high seat', () => {
  const seat = world.seats.find(s => s.id === 'brigand_hold');
  assert.ok(seat, 'the hold records its routes');
  for (const room of seat.rooms) assert.ok(room.use && room.use.length > 12, `${room.name} has a purpose`);
  for (const route of seat.routes) walk({ ...route, y0: route.y0 ? route.points[0].y + route.y0 : world.terrain.heightAt(route.points[0].x, route.points[0].z) });
  const road = ROADS.find(r => r.id === 'red_trail'), end = road.points.at(-1);
  const gate = seat.rooms.find(r => r.name === 'The Red Gate').at;
  assert.ok(Math.hypot(end[0] - gate.x, end[1] - gate.z) < 12, 'the Red Trail ends at the Red Gate');
});
