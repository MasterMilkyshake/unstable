// The big beasts: the sharko (a pale walker that roams open country in pairs) and the great
// owls (gloomowl, thunderwing, Old Hookbeak), rebuilt three times a man's height and solitary.
// Real Enemy AI and models on flat ground (tests/support/arena.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, ENEMIES, arena, player, enemy, step, pinRandom, DT } from './support/arena.js';

const { CreatureModel } = await import('../src/entities/creatures.js');
const { SPAWNERS } = await import('../src/data/world.js');
const { ROAMING_SPAWNERS } = await import('../src/data/roaming.js');
await import('../src/data/adventure.js'); // Old Hookbeak joins ENEMIES here

const MAN = 1.8; // a player's height
// How tall a creature stands, from its built and posed model.
function standing(type) {
  const s = ENEMIES[type];
  const m = new CreatureModel(s.model, { size: s.size || 1, palette: s.palette });
  m.update(DT, { speed: 0 });
  m.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m.root);
  m.dispose();
  return box.max.y - box.min.y;
}
// A seeded stand-in for Math.random, so a walk can be replayed.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test('a sharko and a gloomowl stand about three times a man, short of the Colossus', () => {
  for (const type of ['sharko', 'gloomowl', 'thunderwing']) {
    const h = standing(type);
    assert.ok(h > 2.5 * MAN && h < 3.4 * MAN, `${type} stands ${h.toFixed(2)} m`);
    // its body for hits and the camera is the size of what is drawn
    assert.ok(Math.abs(ENEMIES[type].height - h) < 0.8, `${type}: height ${ENEMIES[type].height} against a model of ${h.toFixed(2)} m`);
  }
  const mother = standing('hookbeak');
  assert.ok(mother > standing('gloomowl'), 'Old Hookbeak is bigger than her brood');
  assert.ok(mother < ENEMIES.cinder_colossus.height, `but not giant (${mother.toFixed(2)} m)`);
});

test('the thunderwing recolours every coloured part of the great owl', () => {
  const base = new CreatureModel('owl');
  const colours = new Set(base.mats.map((m) => '#' + m.color.getHexString()));
  const emissives = new Set(base.mats.map((m) => '#' + m.emissive.getHexString()));
  base.dispose();
  const pal = ENEMIES.thunderwing.palette;
  for (const from of Object.keys(pal)) assert.ok(colours.has(from) || emissives.has(from), `palette key ${from} names a colour the owl uses`);
  // only the bone (beak, shins) and the black talons are shared with the gloomowl
  const shared = [...colours].filter((c) => !pal[c]);
  assert.deepEqual(shared.sort(), ['#0e0d12', '#bdb6a2']);
});

test('owls nest alone: every owl camp holds one', () => {
  const owls = SPAWNERS.filter((s) => ENEMIES[s.type] && ENEMIES[s.type].model === 'owl');
  assert.ok(owls.length >= 6);
  for (const s of owls) assert.equal(s.count, 1, `${s.type} at ${s.x}, ${s.z}`);
  // and each one is worth what a pair was: two to three feathers every time
  for (const type of ['gloomowl', 'thunderwing']) {
    const f = ENEMIES[type].drops.find((d) => d.id === 'owl_feather');
    assert.equal(f.chance, 1);
    assert.ok(f.count[0] >= 2);
  }
});

test('sharkos roam in pairs across the open ground, all six packs in the world', () => {
  const packs = SPAWNERS.filter((s) => s.type === 'sharko');
  assert.equal(packs.length, ROAMING_SPAWNERS.length);
  assert.ok(packs.length >= 6);
  for (const s of packs) assert.equal(s.count, 2);
  // the final positions are not shifted again by the region placement
  for (const r of ROAMING_SPAWNERS) assert.ok(packs.some((s) => s.x === r.x && s.z === r.z));
});

test('a sharko pack ranges far from where it woke, and keeps together', (t) => {
  arena();
  pinRandom(t, seeded(7));
  const camp = { def: { type: 'sharko', x: 0, z: 0, count: 2, radius: 6 } };
  const pack = [enemy('sharko', 2, 0, { spawner: camp }), enemy('sharko', -2, 1, { spawner: camp })];
  let far = 0;
  let spread = 0;
  let walked = 0;
  const legs = new Set();
  step(150, () => {
    const [a, b] = pack;
    far = Math.max(far, Math.hypot(a.pos.x, a.pos.z), Math.hypot(b.pos.x, b.pos.z));
    spread = Math.max(spread, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
    walked += Math.hypot(a.vel.x, a.vel.z) * DT;
    if (camp.roam && camp.roam.to) legs.add(camp.roam.to.join());
  });
  const roam = ENEMIES.sharko.roam;
  assert.ok(far > 15, `it ranges past a camp's few steps (${far.toFixed(1)} m out)`);
  assert.ok(far < roam + 8, `but stays in its country (${far.toFixed(1)} m of ${roam})`);
  assert.ok(legs.size >= 3, `it sets off again and again (${legs.size} legs)`);
  assert.ok(walked > 60, `it walks (${walked.toFixed(0)} m)`);
  assert.ok(spread < 14, `the pair keeps within call of each other (${spread.toFixed(1)} m apart at most)`);
});

test('a lone roaming beast (no camp) ranges round its own home', (t) => {
  arena();
  pinRandom(t, seeded(3));
  const e = enemy('sharko', 0, 0);
  let far = 0;
  step(90, () => (far = Math.max(far, Math.hypot(e.pos.x, e.pos.z))));
  assert.ok(far > 12 && far < ENEMIES.sharko.roam + 8, `${far.toFixed(1)} m`);
});

// A player who stands and takes it, and counts what reached them.
function target() {
  arena();
  const p = player();
  p.hits = 0;
  const hp = () => p.hp;
  let last = hp();
  p.update = function (dt) {
    if (this.hp < last) this.hits++;
    this.hp = this.maxHp;
    last = this.hp;
    this.baseUpdate(dt);
    this.physics(dt);
  };
  return p;
}
function swing(e, p, id) {
  e.setAggro(p);
  e.ai.atkCd = 99; // only the blow under test
  e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
  const at = (ENEMIES[e.type].attacks || []).find((a) => a.id === id);
  e.startAttack(e.creatureDef(at));
  step(at.windup + (at.active || 0.1) + 0.3);
}

test('its blows land at its size: a rake from four metres, a charge from fourteen', () => {
  let p = target();
  swing(enemy('sharko', 0, 4.2), p, 'rake');
  assert.ok(p.hits >= 1, 'the rake reaches a foe four metres from its centre');
  p = target();
  swing(enemy('sharko', 0, 14), p, 'charge');
  assert.ok(p.hits >= 1, 'the charge runs the foe down');
  p = target();
  swing(enemy('gloomowl', 0, 3.4), p, 'peck');
  assert.ok(p.hits >= 1, 'the great owl pecks past its own breast');
});

test('nothing staggers a sharko, and nothing launches either beast', async () => {
  const { canLaunch } = await import('../src/combat/rules.js');
  arena();
  const e = enemy('sharko', 0, 3);
  const at = ENEMIES.sharko.attacks.find((a) => a.id === 'bite');
  e.startAttack(e.creatureDef(at));
  assert.equal(e.interrupt(0.5), false, 'a blow does not break its swing');
  assert.ok(e.atk, 'and the bite goes on');
  assert.equal(canLaunch(e), false);
  assert.equal(canLaunch(enemy('gloomowl', 4, 0)), false);
});
