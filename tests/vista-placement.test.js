import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world/terrain.js';
import { Colliders } from '../src/world/colliders.js';
import { buildStructures } from '../src/world/props.js';
import { buildMonuments } from '../src/world/monuments.js';
import { buildRuinscapes, fallDrop } from '../src/world/ruinscapes.js';
import { LOCATIONS } from '../src/data/world.js';
import {
  MONUMENTS,
  AQUEDUCTS,
  COLONNADES,
  COLLAPSED_TOWERS,
  WATERFALLS,
  OVERLOOKS,
  AUTUMN_GROVES,
  VISTA_SHOTS,
  VISTA_LORE,
  VISTA_LOCATIONS,
} from '../src/data/vistas.js';

// The real terrain and the complete structure pass, so a vista piece that lands in the sea,
// in a house or on top of another ruin fails here rather than in someone's screenshot.
const world = {
  scene: new THREE.Scene(), terrain: new Terrain(), colliders: new Colliders(),
  animated: [], docks: {}, hazards: [], dummySpots: [], loreTablets: [], interactables: [],
  addLight() {}, addEmitter() {}, addInteract(entry) { this.interactables.push(entry); return entry; },
};
world.terrain.build();
const exclusions = buildStructures(world);
const H = (x, z) => world.terrain.heightAt(x, z);
const vistaNames = new Set(VISTA_LOCATIONS.map((l) => l.name));
const settlements = LOCATIONS.filter((l) => l.x < 3000 && l.r <= 80 && !vistaNames.has(l.name));

// Each check collects every problem before failing, so one run lists them all.
let problems = [];
const expect = (ok, msg) => { if (!ok) problems.push(msg); };
const report = () => { const p = problems; problems = []; assert.deepEqual(p, []); };
function dry(x, z, label) {
  const h = H(x, z);
  expect(h > 0.5, `${label} is in the water at ${x}, ${z} (h=${h.toFixed(2)})`);
}
function buildings(x, z, r) {
  return world.colliders.query(x, z, r).filter((c) => {
    if (!c.tag) return false;
    if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + r;
    const [lx, lz] = world.colliders._local(c, x, z);
    return Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r;
  }).map((c) => c.tag);
}
function clearSite(x, z, r, label, inTown = false) {
  dry(x, z, label);
  const tags = buildings(x, z, r);
  expect(!tags.length, `${label} stands in a building (${tags})`);
  const town = !inTown && settlements.find((l) => Math.hypot(l.x - x, l.z - z) < l.r + r * 0.5);
  expect(!town, `${label} stands inside ${town?.name}`);
}

// Every ruin as points along its footprint, so spacing checks see an aqueduct's whole run.
const ruins = [
  ...AQUEDUCTS.map((a) => ({ label: a.id, pts: [0, 0.5, 1].map((t) => [a.x0 + (a.x1 - a.x0) * t, a.z0 + (a.z1 - a.z0) * t]) })),
  ...COLONNADES.map((c, i) => ({ label: `colonnade ${i}`, pts: [[c.x, c.z]] })),
  ...COLLAPSED_TOWERS.map((t, i) => ({ label: `tower ${i}`, pts: [[t.x, t.z]] })),
  ...OVERLOOKS.map((o) => ({ label: o.name, pts: [[o.x, o.z]] })),
  ...WATERFALLS.map((w, i) => ({ label: `waterfall ${i}`, pts: [[w.x, w.z]] })),
];

test('monuments stand on their ground: dry, or drowned in a pool with a dry approach', () => {
  for (const m of MONUMENTS) {
    if (m.base != null) expect(H(m.x, m.z) < 0, `${m.name} is meant to stand in water`);
    else dry(m.x, m.z, m.name);
    clearSite(m.reach.x, m.reach.z, 1.5, `${m.name} carving`, true);
  }
  report();
});

test('ruins and overlooks stand clear of water, buildings, towns and each other', () => {
  for (const a of AQUEDUCTS) for (const t of [0, 0.5, 1]) clearSite(a.x0 + (a.x1 - a.x0) * t, a.z0 + (a.z1 - a.z0) * t, 3, a.id);
  for (const [i, c] of COLONNADES.entries()) clearSite(c.x, c.z, 6, `colonnade ${i}`);
  for (const [i, t] of COLLAPSED_TOWERS.entries()) clearSite(t.x, t.z, 4, `tower ${i}`);
  for (const o of OVERLOOKS) clearSite(o.x, o.z, 4, o.name);
  for (const g of AUTUMN_GROVES) dry(g.x, g.z, 'autumn grove');
  for (let i = 0; i < ruins.length; i++) for (let j = i + 1; j < ruins.length; j++) {
    let d = Infinity;
    for (const [ax, az] of ruins[i].pts) for (const [bx, bz] of ruins[j].pts) d = Math.min(d, Math.hypot(ax - bx, az - bz));
    expect(d >= 25, `${ruins[i].label} and ${ruins[j].label} are piled together (${d.toFixed(0)} m)`);
  }
  report();
});

test('waterfalls pour off real cliffs and overlooks frame a landmark you can see', () => {
  for (const [i, w] of WATERFALLS.entries()) {
    const { h, base } = fallDrop(world.terrain, w);
    expect(h >= 6, `waterfall ${i} hangs off a ${h.toFixed(1)} m drop`);
    expect(base > 0.3, `waterfall ${i} pours into the sea floor`);
  }
  for (const o of OVERLOOKS) {
    const m = MONUMENTS.find((mm) => Math.hypot(o.lookX - mm.x, o.lookZ - mm.z) < 5);
    expect(m, `${o.name} should look at a monument`);
    expect(!m || Math.hypot(o.x - m.x, o.z - m.z) < 320 || m.hangY, `${o.name} is too far to see ${m?.name} through the mist`);
  }
  report();
});

test('vista lore sits at its monument and vista cameras stay above ground', () => {
  for (const l of VISTA_LORE) {
    const m = MONUMENTS.find((mm) => mm.lore === l.id);
    assert.ok(m, `${l.id} belongs to a monument`);
    assert.ok(Math.hypot(l.x - m.reach.x, l.z - m.reach.z) < 4, `${l.id} is recorded away from its carving`);
  }
  for (const [id, shot] of Object.entries(VISTA_SHOTS)) {
    assert.ok(shot.y > H(shot.x, shot.z) - 1, `${id} camera is inside the terrain`);
    assert.ok(Number.isFinite(shot.lx + shot.ly + shot.lz), id);
  }
});

test('kit monuments and ruins build with finite colliders', () => {
  const marks = buildMonuments(world, exclusions);
  const before = world.animated.length;
  buildRuinscapes(world, exclusions);
  assert.equal(marks.length, MONUMENTS.length);
  assert.ok(world.animated.length > before, 'waterfalls animate');
  let boxes = 0;
  for (const c of world.colliders.all) {
    for (const key of ['x', 'z', 'y0', 'y1']) assert.ok(Number.isFinite(c[key]), `collider ${key} is not finite`);
    if (c.kind !== 'cyl') boxes += 1;
  }
  assert.ok(boxes > 20, 'ruins and monuments add walkable masonry');
  world.scene.traverse((o) => assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z), o.name || 'mesh'));
});
