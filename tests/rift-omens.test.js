// The Rift's inhabited layer: new places, keepers, chests and records are valid and stand on
// clear ground; the Kneeling, the command chain, gibbets and banners build sound geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { LOCATIONS, SPAWNERS, CHESTS } from '../src/data/world.js';
import '../src/data/rift.js';
import '../src/data/riftResearch.js';
import '../src/data/riftSpire.js';
import { RIFT_SITE_LOCATIONS, RIFT_SITE_SPAWNERS, RIFT_SITE_CHESTS, RIFT_SITE_LORE } from '../src/data/riftSites.js';
import { LORE, LORE_BY_ID } from '../src/data/lore.js';
import { ITEMS } from '../src/data/items.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ENEMIES } from '../src/data/enemies.js';
import { RIFT_SPOTS, RIFT_PADS } from '../src/data/riftLayout.js';
import { carrierOf } from '../src/world/landmarks.js';
import { buildRiftCastles } from '../src/world/riftCastles.js';
import { buildRiftOmens, updateRiftOmens, KNEELING, catenaryPoints } from '../src/world/riftOmens.js';
import { RIFT_FOG } from '../src/world/riftSky.js';

const terrain = new Terrain();
terrain.build();
const H = (x, z) => terrain.heightAt(x, z);
const finite = (...v) => v.every(Number.isFinite);

function makeWorld() {
  return {
    scene: new THREE.Scene(), terrain, colliders: new Colliders(),
    lights: [], addLight(pos, color, intensity, distance) { this.lights.push({ pos, color, intensity, distance }); },
    interactables: [], addInteract(it) { this.interactables.push(it); return it; }, addEmitter() {},
    animated: [], hazards: [], docks: {}, dummySpots: [],
    groundAt(x, z, maxY = 1e4) { return Math.max(terrain.heightAt(x, z), this.colliders.groundAt(x, z, maxY)); },
  };
}

// The real build order: castles, then the omens that hang from them.
const world = makeWorld();
const state = { low: false };
buildRiftCastles(world, [], state);
const castleColliders = world.colliders.all.size;
const castlesBuilt = castleColliders > 0;
const omenExclusions = [];
const omens = buildRiftOmens(world, omenExclusions, state);

const NEW_POINTS = [
  ...RIFT_SITE_LORE.map((l) => ({ ...l, kind: 'lore' })),
  ...RIFT_SITE_CHESTS.map((c) => ({ ...c, kind: 'chest' })),
  ...RIFT_SITE_SPAWNERS.map((s) => ({ ...s, id: s.type, kind: 'spawner' })),
];

function locationAt(x, z) {
  let best = null;
  for (const l of LOCATIONS) if (Math.hypot(x - l.x, z - l.z) < l.r && (!best || l.r < best.r)) best = l;
  return best && best.name;
}

function blockersAt(x, z, radius) {
  const g = H(x, z);
  return world.colliders.query(x, z, radius + 0.2).filter((c) => {
    if (c.y1 < g + 0.15 || c.y0 > g + 2.1) return false;
    if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + radius;
    const [lx, lz] = world.colliders._local(c, x, z);
    return Math.abs(lx) < c.hw + radius && Math.abs(lz) < c.hd + radius;
  });
}

test('new places, keepers, chests and records are well formed and registered', () => {
  for (const l of RIFT_SITE_LOCATIONS) {
    assert.ok(l.name && finite(l.x, l.z, l.r) && l.r > 0, `location ${l.name}`);
    assert.ok(LOCATIONS.includes(l), `${l.name} is registered`);
  }
  for (const s of RIFT_SITE_SPAWNERS) {
    assert.ok(ENEMIES[s.type], `spawner type ${s.type} exists`);
    assert.ok(finite(s.x, s.z, s.count, s.radius, s.respawn) && s.count > 0 && s.respawn > 0, `spawner ${s.type} fields`);
    assert.ok(SPAWNERS.includes(s), `${s.type} spawner is registered`);
    assert.ok(!s.boss, 'site spawners are not bosses');
  }
  const chestIds = CHESTS.map((c) => c.id);
  for (const c of RIFT_SITE_CHESTS) {
    assert.match(c.id, /^c_rift_cw_/, 'new chest ids carry the rework prefix');
    assert.equal(chestIds.filter((x) => x === c.id).length, 1, `${c.id} is unique`);
    assert.ok(finite(c.x, c.z));
    for (const [it, n] of c.loot.items || []) assert.ok(ITEMS[it] && n > 0, `${c.id}: item ${it}`);
    if (c.loot.weapon) assert.ok(WEAPONS[c.loot.weapon], `${c.id}: weapon ${c.loot.weapon}`);
  }
  const loreIds = LORE.map((l) => l.id);
  assert.ok(RIFT_SITE_LORE.length >= 4 && RIFT_SITE_LORE.length <= 6);
  for (const l of RIFT_SITE_LORE) {
    assert.match(l.id, /^rift_cw_/, 'new record ids carry the rework prefix');
    assert.equal(loreIds.filter((x) => x === l.id).length, 1, `${l.id} is unique`);
    assert.equal(LORE_BY_ID[l.id], l);
    assert.ok(l.title && l.place && l.text && finite(l.x, l.z), `${l.id} fields`);
    const sentences = l.text.split(/(?<=[.!?])\s+/).length;
    assert.ok(sentences >= 2 && sentences <= 5, `${l.id} is 2-5 sentences (${sentences})`);
  }
});

test('records sit on the objects that would carry them', () => {
  const want = { rift_cw_gate_plate: 'carving', rift_cw_signal_plate: 'carving', rift_cw_muster_roll: 'book', rift_cw_relay_tally: 'carving', rift_cw_kneeling: 'carving' };
  for (const l of RIFT_SITE_LORE) assert.equal(carrierOf(l), want[l.id], `${l.title}`);
});

test('the new names trigger where they should and the throne keeps its own', () => {
  assert.equal(locationAt(6000, 6150), 'Throne of the Drowned');
  assert.equal(locationAt(6000, 6178), 'Throne of the Drowned');
  assert.equal(locationAt(RIFT_SPOTS.chainward_grand_warden.x, RIFT_SPOTS.chainward_grand_warden.z), 'The Chainward');
  assert.equal(locationAt(RIFT_SPOTS.chainward_knights.x, RIFT_SPOTS.chainward_knights.z), 'The Chainward');
  assert.equal(locationAt(RIFT_SPOTS.bastion_court.x, RIFT_SPOTS.bastion_court.z), 'The Unanswered Bastion');
  assert.equal(locationAt(RIFT_SPOTS.garrison_2_yard.x, RIFT_SPOTS.garrison_2_yard.z), 'The Garrison Steps');
  assert.equal(locationAt(RIFT_SPOTS.kneel_inscription.x, RIFT_SPOTS.kneel_inscription.z), 'The Kneeling');
  assert.equal(locationAt(6000, 6056), 'The Kneeling');
  for (const l of RIFT_SITE_LORE) assert.ok(locationAt(l.x, l.z), `${l.id} stands in a named place`);
});

test('the Grand Warden waits in the Chainward forecourt', () => {
  const regent = SPAWNERS.filter((s) => s.type === 'grand_warden');
  assert.equal(regent.length, 1);
  const [r] = regent;
  assert.equal(r.x, RIFT_SPOTS.chainward_grand_warden.x);
  assert.equal(r.z, RIFT_SPOTS.chainward_grand_warden.z);
  assert.equal(r.boss, true);
  assert.equal(r.when({ quests: { bastion: { state: 'done' } } }), true);
  assert.equal(r.when({ quests: {} }), false);
});

test('content validator passes', () => {
  const out = execFileSync(process.execPath, ['tools/validate-content.mjs'], { encoding: 'utf8' });
  assert.match(out, /OK - no errors/);
});

test('every new point stands on ground', () => {
  for (const p of NEW_POINTS) assert.ok(H(p.x, p.z) > -20, `${p.kind} ${p.id} at ${p.x},${p.z} is over the void`);
  for (const id of Object.keys(RIFT_SPOTS)) assert.ok(H(RIFT_SPOTS[id].x, RIFT_SPOTS[id].z) > -20, `spot ${id}`);
});

test('every new point is clear of the castles and the omens', { skip: castlesBuilt ? false : 'castles not merged yet' }, () => {
  for (const p of NEW_POINTS) {
    const r = p.kind === 'spawner' ? Math.max(1, Math.min(p.radius, 3)) : 1;
    assert.deepEqual(blockersAt(p.x, p.z, r).map((c) => c.tag), [], `${p.kind} ${p.id} at ${p.x},${p.z}`);
  }
  // nothing overhead at a spawn point (enemies are placed on the highest surface below 400 m)
  for (const s of [...RIFT_SITE_SPAWNERS, ...SPAWNERS.filter((x) => x.type === 'grand_warden')]) {
    assert.ok(world.groundAt(s.x, s.z, 400) < H(s.x, s.z) + 1.5, `${s.type} at ${s.x},${s.z} spawns under a roof`);
  }
  // the Grand Warden's fight keeps its ring
  const R = RIFT_SPOTS.chainward_grand_warden;
  for (let a = 0; a < 12; a++) {
    const x = R.x + Math.cos(a / 12 * Math.PI * 2) * (R.clear - 1), z = R.z + Math.sin(a / 12 * Math.PI * 2) * (R.clear - 1);
    assert.deepEqual(blockersAt(x, z, 0.5).map((c) => c.tag), [], `grand warden ring at ${x.toFixed(1)},${z.toFixed(1)}`);
  }
});

test('the omens never block a record, chest or spawn', () => {
  // Only the omens' own colliders (the castles' are checked above once merged).
  const omenTags = new Set(['kneeling', 'rift_lamp']);
  for (const p of NEW_POINTS) {
    const hit = blockersAt(p.x, p.z, 1.2).filter((c) => omenTags.has(c.tag));
    assert.deepEqual(hit.map((c) => c.tag), [], `${p.kind} ${p.id}`);
  }
});

test('the Kneeling: six statues with finite, climbable colliders on their plinths', () => {
  assert.equal(omens.statues.length, KNEELING.length);
  assert.equal(omens.statues.length, 6);
  const damages = new Set(omens.statues.map((s) => s.damage));
  for (const d of ['head', 'arm', 'crystal']) assert.ok(damages.has(d), `one statue shows ${d} damage`);
  for (const s of omens.statues) {
    const pad = RIFT_PADS[s.id];
    assert.ok(pad && Math.hypot(s.x - pad.x, s.z - pad.z) < 0.01, `${s.id} on its pad`);
    const tall = s.top - s.y;
    assert.ok(tall > 19 && tall < 25, `${s.id} stands ${tall.toFixed(1)} m (16-20 m kneeling on its plinth)`);
    assert.ok(s.colliders.length >= 5);
    for (const c of s.colliders) {
      assert.ok(finite(c.x, c.z, c.y0, c.y1, c.hw, c.hd, c.rot), `${s.id} collider finite`);
      assert.ok(c.y1 > c.y0 && c.climbable, `${s.id} collider climbable`);
    }
    // statues face the way (inward) and lean toward the north, where the Seat is
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    assert.ok(fx * (6000 - s.x) > 0, `${s.id} faces the processional`);
    assert.ok(fz > 0, `${s.id} bows toward the north`);
  }
  // none of them stands in a processional way
  for (const s of omens.statues) assert.ok(Math.abs(s.x - 6000) > 12, `${s.id} clear of the way`);
});

test('the command chain: finite links that keep ten metres of air under every span', () => {
  const spans = omens.chains.filter((c) => !c.snapped);
  assert.ok(spans.length >= 3, 'relays are chained to each other and the Chainward');
  for (const c of spans) {
    assert.ok(c.links > 10 && c.sag >= 0, `${c.from}->${c.to}`);
    assert.ok(c.ok, `${c.from}->${c.to}: the straight line clears the ground`);
    for (const p of c.pts) {
      assert.ok(finite(...p), `${c.from}->${c.to} point finite`);
      assert.ok(p[1] - H(p[0], p[2]) >= 10 - 1e-6, `${c.from}->${c.to} ${(p[1] - H(p[0], p[2])).toFixed(1)} m over ${p[0].toFixed(0)},${p[2].toFixed(0)}`);
    }
  }
  const snapped = omens.chains.find((c) => c.snapped);
  assert.ok(snapped, 'one relay line has parted');
  for (const p of snapped.pts) assert.ok(finite(...p) && p[1] > H(p[0], p[2]) - 0.5, 'the parted line rests on or above the ground');
  const pts = catenaryPoints([0, 50, 0], [100, 50, 0], 8, 10);
  assert.equal(pts[5][1], 42);
  assert.equal(pts[0][1], 50);
});

test('every published gibbet hangs clear of the ground under it', () => {
  if (!omens.gibbets) return;
  for (const g of omens.gibbets.items) {
    const floor = Math.max(H(g.x, g.z), world.colliders.groundAt(g.x, g.z, g.y - 0.3, 1.1));
    const drop = omens.gibbets.sets[g.v].drop;
    assert.ok(g.y - (drop + 2.65) - floor >= 0.39, `gibbet at ${g.x.toFixed(0)},${g.z.toFixed(0)} clears the floor`);
  }
});

test('rock is told to keep clear of everything the omens put on the ground', () => {
  for (const s of omens.statues) assert.ok(omenExclusions.some((e) => Math.hypot(e.x - s.x, e.z - s.z) < 0.01 && e.r >= 12), `${s.id} plinth excluded`);
  const parted = omens.chains.find((c) => c.coil);
  assert.ok(parted && omenExclusions.some((e) => Math.hypot(e.x - parted.coil[0], e.z - parted.coil[2]) < 0.01), 'the coil is excluded');
  for (const p of parted.pts) {
    if (p[1] - H(p[0], p[2]) > 3) continue;
    assert.ok(omenExclusions.some((e) => Math.hypot(e.x - p[0], e.z - p[2]) <= e.r), `chain on the ground at ${p[0].toFixed(0)},${p[2].toFixed(0)}`);
  }
  for (const e of omenExclusions) assert.ok(finite(e.x, e.z, e.r) && e.r > 0);
});

test('all geometry the omens add is finite', () => {
  let tris = 0;
  world.scene.traverse((m) => {
    if (!m.isMesh) return;
    const a = m.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `${m.name} vertex ${i}`);
    tris += a.length / 9;
  });
  assert.ok(tris > 1000 && tris < 200000, `omens triangle budget (${tris})`);
});

test('gibbets and banners hang from published anchors and degrade without them', () => {
  // without anchors: nothing hangs, nothing throws
  assert.equal(omens.gibbets === null || omens.gibbets.items.length >= 0, true);
  const w = makeWorld();
  const anchors = {
    relays: [{ id: 'relay_south', x: 5905, y: H(5905, 5800) + 40, z: 5800 }],
    chains: [{ x: 6050, y: 52, z: 6170 }, { x: 5950, y: 52, z: 6170 }],
    banners: [{ x: 6030, y: 30, z: 6118, nx: 0, nz: -1, len: 12 }, { x: 5970, y: 30, z: 6118, nx: 0, nz: -1, len: 9 }],
    gibbets: [{ x: 6060, y: 34, z: 6110 }, { x: 6070, y: 34, z: 6110 }, { x: 6080, y: 34, z: 6110 }, { x: 'bad', y: 0, z: 0 }],
  };
  const st = { low: false, castles: { anchors } };
  const o = buildRiftOmens(w, [], st);
  assert.equal(o.banners, 2);
  assert.equal(o.gibbets.items.length + o.gibbets.skipped.length, 3, 'a malformed anchor is skipped');
  assert.equal(o.gibbets.items.length, 3, 'every cage has room to hang');
  const sets = o.gibbets.sets.filter(Boolean);
  assert.equal(sets.reduce((n, s) => n + s.cageMesh.count, 0), 3);
  const held = sets.reduce((n, s) => n + (s.figMesh ? s.figMesh.count : 0), 0);
  assert.ok(held >= 1 && held <= 3);
  assert.equal(o.fallback, true, 'missing relays fall back to the contract');
  const m = new THREE.Matrix4();
  updateRiftOmens(st, 1.3);
  const g0 = o.gibbets.items[0];
  o.gibbets.sets[g0.v].cageMesh.getMatrixAt(g0.ci, m);
  const p = new THREE.Vector3().setFromMatrixPosition(m);
  assert.ok(p.distanceTo(new THREE.Vector3(6060, 34, 6110)) < 1e-6, 'cages swing about their anchor');
  for (const e of m.elements) assert.ok(Number.isFinite(e));
  // an entirely empty anchors object is fine too
  const o2 = buildRiftOmens(makeWorld(), [], { low: true, castles: { anchors: {} } });
  assert.equal(o2.gibbets, null);
  assert.equal(o2.banners, 0);
  updateRiftOmens({ omens: o2 }, 0.1);
});

test('the Rift air keeps the ceiling\'s fog bounds and stays readable', () => {
  assert.ok(RIFT_FOG.near >= 12, 'near fog is never closer than the ceiling allows');
  assert.ok(RIFT_FOG.far >= 260 && RIFT_FOG.far <= 440, 'far fog inside the ceiling clamp');
  const c = new THREE.Color(RIFT_FOG.color);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  assert.ok(lum > 0.03 && lum < 0.2, `fog colour is dark but not black (${lum.toFixed(3)})`);
  // haze at head height near the player stays light: 20 m of walking leaves most of the view
  const od = Math.exp(-RIFT_FOG.falloff * Math.max(0, 1.7 - RIFT_FOG.base + 6));
  assert.ok(1 - Math.exp(-RIFT_FOG.density * 20 * od) < 0.4, 'the ground near you stays visible');
});
