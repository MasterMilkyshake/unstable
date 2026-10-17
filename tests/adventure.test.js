import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { buildAdventure } from '../src/world/adventure.js';
import { ADVENTURE_SITES, ADVENTURE_RECORDS, ADVENTURE_ENEMIES, ADVENTURE_SHOPS, compassWord } from '../src/data/adventure.js';
import { LANDFORMS } from '../src/data/landforms.js';
import { ENEMIES } from '../src/data/enemies.js';
import { DIALOGUES, SHOPS } from '../src/data/npcs.js';
import { CHESTS, NPCS, SPAWNERS, LOCATIONS } from '../src/data/world.js';
import { LORE } from '../src/data/lore.js';
import { carrierOf } from '../src/world/landmarks.js';

// The real surface and the full structure pass, then the points of adventure on top.
const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [],
  interactables: [], addLight() {}, addInteract(it) { this.interactables.push(it); }, addEmitter() {},
};
world.terrain.build();
const exclusions = buildStructures(world);
buildAdventure(world, exclusions);
const H = (x, z) => world.terrain.heightAt(x, z);

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}

test('every point of adventure settles on dry, level ground off the mountain ranges', () => {
  const ranges = Object.values(LANDFORMS).flat().filter((l) => l && l.kind === 'range' && l.points);
  for (const s of ADVENTURE_SITES) {
    assert.ok(!s.unsettled, `${s.id} found ground near its anchor`);
    const rough = s.lair === 'den' || s.lair === 'slag';
    assert.ok(s.range <= (rough ? 3.2 : 1.2), `${s.id} sits on level ground (${s.range.toFixed(2)} m across)`);
    if (s.lair !== 'skiff') assert.ok(s.sy > 1.5, `${s.id} is above the water`);
    for (const r of ranges) for (let i = 1; i < r.points.length; i++) {
      assert.ok(segDist(s.sx, s.sz, ...r.points[i - 1], ...r.points[i]) > r.w / 2 + s.size, `${s.id} is not on a range`);
    }
  }
});

test('sites keep their distance from towns, each other and the climbing ramps', () => {
  for (const s of ADVENTURE_SITES) {
    assert.ok(Math.hypot(s.sx, s.sz) > 100, `${s.id} is outside Saltreach town`);
    for (const o of ADVENTURE_SITES) if (o !== s) assert.ok(Math.hypot(s.sx - o.sx, s.sz - o.sz) > s.size + o.size, `${s.id} and ${o.id} don't overlap`);
    for (const p of world.terrain.passes || []) {
      assert.ok(segDist(s.sx, s.sz, p.ax, p.az, p.bx, p.bz) > (p.width || 6) / 2 + s.size, `${s.id} keeps off the ${p.way} ramp`);
    }
  }
});

test('every record moves with its site and stands somewhere you can reach', () => {
  for (const { site, record } of ADVENTURE_RECORDS) {
    const d = Math.hypot(record.x - site.sx, record.z - site.sz);
    assert.ok(d <= Math.max(site.size, 8) + 1, `${record.id || record.type || record.name} stays at ${site.id}`);
    if (record.name && record.r) continue; // a location circle
    const ground = H(record.x, record.z);
    assert.ok(ground > (site.lair === 'skiff' ? 0.3 : 1.2), `${record.id || record.type} is on dry ground`);
    const raised = world.colliders.groundAt(record.x, record.z, ground + 2.2);
    const blocked = world.colliders.query(record.x, record.z, 0.4).filter((c) => c.y1 > ground + 0.4 && c.y0 < ground + 1.8 && (c.kind === 'cyl'
      ? Math.hypot(record.x - c.x, record.z - c.z) < c.r + 0.4
      : (([lx, lz]) => Math.abs(lx) < c.hw + 0.4 && Math.abs(lz) < c.hd + 0.4)(world.colliders._local(c, record.x, record.z))));
    assert.ok(raised < ground + 0.6, `${record.id || record.type} is not on a roof`);
    assert.deepEqual(blocked.map((c) => c.tag), [], `${record.id || record.type} at ${site.id} is clear`);
  }
});

test('named foes, chests, traders and records are well formed and unique', () => {
  for (const [id, def] of Object.entries(ADVENTURE_ENEMIES)) {
    assert.ok(ENEMIES[id], `${id} is registered`);
    assert.ok(def.name && def.hp > 0 && def.level > 0, `${id} has stats`);
  }
  for (const s of ADVENTURE_SITES) for (const e of s.enemies || []) assert.ok(ENEMIES[e.type], `${s.id}: ${e.type}`);
  const ids = (list) => list.map((x) => x.id).filter(Boolean);
  for (const list of [CHESTS, NPCS, LORE]) {
    const seen = ids(list);
    assert.equal(new Set(seen).size, seen.length, 'ids are unique');
  }
  for (const id of Object.keys(ADVENTURE_SHOPS)) assert.ok(SHOPS[id], `${id} shop is registered`);
  // Records sit on things that would carry them; none is a free-standing tablet.
  for (const s of ADVENTURE_SITES) if (s.lore) assert.ok(['letter', 'notice', 'carving', 'book'].includes(carrierOf(LORE.find((l) => l.id === s.lore.id))));
  // Bosses only fight once; captains come back.
  for (const sp of SPAWNERS) if (ADVENTURE_ENEMIES[sp.type]?.boss) assert.ok(sp.boss && sp.respawn === 0, `${sp.type} is a one-time field boss`);
  for (const s of ADVENTURE_SITES) assert.ok(LOCATIONS.some((l) => l.adventure === s.id && l.name === s.name), `${s.id} has a place name`);
});

test('traders greet, trade, explain themselves and point the way to other places', () => {
  const opened = [];
  const api = { openShop: (id) => opened.push(id) };
  for (const s of ADVENTURE_SITES.filter((x) => x.npc)) {
    const node = DIALOGUES[s.npc.id](api);
    assert.ok(node.text.length > 20, `${s.npc.name} greets`);
    const trade = node.options.find((o) => o.do);
    trade.do(api);
    assert.equal(opened.at(-1), s.npc.shop);
    assert.ok(node.options.some((o) => /^Ask about the (north|south|east|west|north-east|north-west|south-east|south-west)\.$/.test(o.label)), `${s.npc.name} has a rumour`);
    assert.ok(node.options.some((o) => o.label === 'Why camp here?'));
  }
  // +z is north and +x is WEST.
  assert.equal(compassWord(0, 0, 0, 10), 'north');
  assert.equal(compassWord(0, 0, 10, 0), 'west');
  assert.equal(compassWord(0, 0, -10, 0), 'east');
  assert.equal(compassWord(0, 0, 0, -10), 'south');
});

test('every site is built with finite geometry and a visible smoke column where people burn fires', () => {
  const smokes = world.scene.children.filter((o) => o.name === 'adventure_smoke');
  assert.ok(smokes.length >= ADVENTURE_SITES.filter((s) => s.smoke).length);
  world.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    assert.ok(o.geometry.attributes.position.array.every(Number.isFinite), `${o.name} has finite vertices`);
  });
});
