import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import * as THREE from 'three';

if (modules.registerHooks) {
  modules.registerHooks({ load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
  } });
} else {
  modules.register('data:text/javascript,' + encodeURIComponent(`
    export async function load(url, context, next) {
      return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
    }
  `), import.meta.url);
}
globalThis.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; } };
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { G } = await import('../src/core/globals.js');
const { Actor } = await import('../src/entities/actor.js');
const { Player } = await import('../src/entities/player.js');
const { Projectile, updateProjectiles } = await import('../src/entities/projectile.js');
const { Game } = await import('../src/game/game.js');
const { World } = await import('../src/world/world.js');
const { Colliders } = await import('../src/world/colliders.js');
const { MANTRAS } = await import('../src/data/mantras.js');
const { mantraPower, updateTimers, clearTimers } = await import('../src/combat/mantraRuntime.js');
const { applyHit } = await import('../src/combat/combat.js');
await import('../src/game/sparks.js'); // the altar's cost and cooldown modifiers (ACTIONS.mantraMods)

// Every mantra behaviour, cast for real (M-01): a Player casts from its hotbar through
// tryCast, and the world steps with Player.update, the foes' own update and physics, the
// projectiles and the mantra timers. Each test asserts what the cast did: damage and
// ailments on the targets, how far the caster moved, a buff's mods, a heal, a wall.
// Stars and spark modifiers are cast where they change the result.

const DT = 1 / 30;
// Effects are presentation only: any property, called or not, is a no-op.
const fx = new Proxy(function () {}, { get: () => fx, apply: () => fx });
let player, game, aim, logged;
const consoleError = console.error;

function scene() {
  clearTimers();
  G.vfx = fx;
  G.audio = fx;
  G.ui = fx;
  G.net = null;
  G.time = 100;
  G.actors = [];
  G.projectiles = [];
  G.scene = new THREE.Scene();
  const colliders = new Colliders();
  const world = {
    scene: G.scene, colliders, projectileBlockers: [], walls: [], hazards: [],
    terrain: { heightAt: () => 0, raycast: () => null },
    groundAt: (x, z, y = 400) => Math.max(0, colliders.groundAt(x, z, y, 0)),
    lendLight: () => new THREE.PointLight(),
    surfaceAt: () => 'grass',
    inRift: () => false,
  };
  world.spawnIceWall = World.prototype.spawnIceWall; // the real wall: mesh, collider, projectile blocker
  G.world = world;
  const keys = { down: new Set(), pressed: new Set(), mPressed: [false, false, false], mDown: [false, false, false] };
  G.input = new Proxy(keys, { get: (t, k) => (k in t ? t[k] : () => false) });
  game = Object.create(Game.prototype);
  Object.assign(game, { camYaw: 0, inRift: false, state: 'playing', ui: { isOpen: () => false, isPaused: () => false }, input: G.input });
  aim = { dir: new THREE.Vector3(0, 0, 1), point: null, target: null };
  game.getAim = () => aim;
  G.game = game;
  const ch = game.createCharacter({ name: 'Caster', race: 'ashkin', look: {} });
  Object.assign(ch.attrs, { ember: 20, rime: 20, storm: 20, gale: 20, umbra: 20, strength: 20, charisma: 20 });
  ch.armed = true;
  player = new Player(ch);
  player.grounded = true;
  G.player = player;
  G.actors.push(player);
}
beforeEach(() => {
  scene();
  logged = [];
  console.error = (...a) => logged.push(a.map(String).join(' '));
});
afterEach(() => {
  console.error = consoleError;
  assert.deepEqual(logged, [], 'nothing went wrong inside a timer or a behaviour');
});

// A target dummy that keeps a ledger of every blow it takes (damage over time is not a blow).
function foe(x, z, o = {}) {
  const a = new Actor({ team: 'enemy', hp: o.hp || 2000, posture: o.posture || 1000, level: 5, resist: o.resist });
  a.pos.set(x, o.y || 0, z);
  a.grounded = !o.y;
  a.yaw = o.yaw ?? Math.atan2(player.pos.x - x, player.pos.z - z); // facing the caster
  a.type = 'dummy';
  if (o.boss) a.boss = true;
  a.blows = [];
  a.onDamaged = (att, dmg, element, h) => a.blows.push({ att, dmg, element, h });
  G.actors.push(a);
  return a;
}
function step(seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    G.time += DT;
    player.update(DT);
    for (const a of G.actors) {
      if (a === player || a.dead) continue;
      a.baseUpdate(DT);
      a.physics(DT);
    }
    updateProjectiles(DT);
    updateTimers(DT);
  }
}
// Learn a mantra into hotbar slot 2 and cast it with a full ether pool. Returns the ether spent.
function cast(id, st = {}) {
  player.ch.mantras[id] = { stars: st.stars || 0, ...(st.mods ? { mods: st.mods } : {}) };
  player.ch.hotbar[1] = { type: 'mantra', id };
  player.cooldowns[id] = 0;
  player.ether = player.maxEther;
  const before = player.ether;
  player.tryCast(1);
  assert.equal(player.atk && player.atk.def.mantra, id, `${id} begins`);
  return before - player.ether;
}
// What one blow of a mantra deals before resistances.
function dmgOf(id, stars = 0, mul = 1) {
  const m = { id, ...MANTRAS[id] };
  return m.p.dmg * mantraPower(player, m, stars) * mul;
}
// One plain swing of the equipped weapon (fists) against a foe, for weapon-art ratios.
function jab(t) {
  player.combo = 0;
  player.comboTimer = 1;
  game.camYaw = Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
  player.startCombo();
  const mul = player.atk.def.dmgMul || 1;
  const before = t.blows.length;
  for (let i = 0; player.atk && i < 90; i++) step(DT);
  assert.equal(t.blows.length, before + 1, 'the jab lands');
  return t.blows.at(-1).dmg / mul;
}
const near = (a, b, tol = 0.02, what = '') => assert.ok(Math.abs(a - b) <= Math.abs(b) * tol + 1e-6, `${what} ${a.toFixed(3)} vs ${b.toFixed(3)}`);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const enemyShot = (from, at, dmg = 10) => {
  const owner = foe(from.x, from.z);
  const dir = at.clone().sub(from).normalize();
  return new Projectile(owner, { pos: from.clone(), vel: dir.multiplyScalar(30), radius: 0.4, hit: { dmg, posture: 0, element: 'phys', kind: 'proj' } });
};

test('every behaviour in the mantra table is cast by a test below', () => {
  const tested = ['projectile', 'multiProjectile', 'lanternSwarm', 'tidalWave', 'eruption', 'skyStrike', 'nova', 'spikesLine', 'vortex',
    'thornField', 'meteorShower', 'glacierRings', 'quake', 'knell', 'beam', 'chain', 'blink', 'teleportBehind', 'stealth', 'leap', 'dash',
    'airDash', 'grab', 'bash', 'melee', 'flurry', 'lunge', 'spin', 'slam', 'rush', 'buff', 'warcry', 'heal', 'resSanguine', 'mark', 'ward',
    'arcWard', 'wall'];
  const used = [...new Set(Object.values(MANTRAS).map((m) => m.behavior))].sort();
  assert.deepEqual(used, [...tested].sort());
});

// ------------------------------------------------------------------ projectiles

test('projectile (Ember Bolt): one bolt to the target that burns it; ether and cooldown as listed', () => {
  const t = foe(0, 10);
  aim.target = t;
  const spent = cast('ember_bolt');
  near(spent, MANTRAS.ember_bolt.ether * player.derived.etherCostMul, 1e-9, 'ether');
  near(player.cooldowns.ember_bolt, MANTRAS.ember_bolt.cd * player.derived.mantraCdMul, 1e-9, 'cooldown');
  step(1.2);
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('ember_bolt'), 0.01, 'damage');
  assert.equal(t.blows[0].element, 'ember');
  assert.ok(t.statuses.burn, 'alight');
  assert.equal(G.projectiles.length, 0, 'spent');
});

test('projectile stars and sparks: +15% damage and -8% cooldown a star; Potent, Twin, Thrifty and Swift', () => {
  const t = foe(0, 10);
  aim.target = t;
  cast('ember_bolt', { stars: 2 });
  near(player.cooldowns.ember_bolt, MANTRAS.ember_bolt.cd * player.derived.mantraCdMul * 0.84, 1e-9, 'two stars: 16% shorter');
  step(1.2);
  near(t.blows[0].dmg, dmgOf('ember_bolt') * 1.3, 0.01, 'two stars');

  scene();
  const u = foe(0, 10);
  aim.target = u;
  const spent = cast('ember_bolt', { stars: 3, mods: ['potent', 'twin', 'thrifty'] });
  near(spent, MANTRAS.ember_bolt.ether * player.derived.etherCostMul * 0.75, 1e-9, 'Thrifty: a quarter off');
  step(0.36);
  assert.equal(G.projectiles.length, 2, 'Twin: two bolts');
  step(1);
  assert.equal(u.blows.length, 2, 'both strike at 10 m');
  near(u.blows[0].dmg, dmgOf('ember_bolt') * 1.45 * 1.2, 0.01, 'three stars and Potent');

  scene();
  cast('ember_bolt', { mods: ['swift'] });
  near(player.cooldowns.ember_bolt, MANTRAS.ember_bolt.cd * player.derived.mantraCdMul * 0.85, 1e-9, 'Swift');
});

test('multiProjectile (Frost Shards): a fan of three, the middle one chills the foe ahead; Twin fans five, Lingering chills twice as hard', () => {
  const t = foe(0, 8);
  aim.target = t;
  cast('frost_shards');
  step(MANTRAS.frost_shards.cast + 0.05);
  assert.equal(G.projectiles.length, 3);
  step(1);
  assert.equal(t.blows.length, 1, 'only the middle shard at 8 m');
  near(t.blows[0].dmg, dmgOf('frost_shards'), 0.01);
  const plain = t.statuses.chill.stacks;
  assert.ok(plain > 0, 'chilled');

  scene();
  const u = foe(0, 8);
  aim.target = u;
  cast('frost_shards', { mods: ['twin', 'lingering'] });
  step(MANTRAS.frost_shards.cast + 0.05);
  assert.equal(G.projectiles.length, 5);
  step(1);
  near(u.statuses.chill.stacks, plain * 2, 0.01, 'Lingering');
});

test('lanternSwarm (Bell of the Lost Lanterns): eight lanterns hunt the target and blind it', () => {
  const t = foe(6, 12);
  aim.target = t;
  cast('bell_lantern');
  step(MANTRAS.bell_lantern.cast + 0.12 * 8);
  step(3);
  assert.equal(t.blows.length, 8, 'every lantern finds it');
  near(t.blows[0].dmg, dmgOf('bell_lantern'), 0.01);
  assert.ok(t.statuses.blind);
});

test('tidalWave (Bell of the Drowned Crown): the wave carries foes with it and strikes each once', () => {
  const t = foe(0, 6);
  const side = foe(3, 6);
  cast('bell_tide');
  step(MANTRAS.bell_tide.cast + 0.05);
  assert.equal(G.projectiles.length, MANTRAS.bell_tide.p.width);
  const z0 = t.pos.z;
  step(1.4);
  assert.equal(t.blows.length, 1, 'once, not once per stretch of the wave');
  assert.equal(side.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('bell_tide'), 0.01);
  assert.ok(t.pos.z > z0 + 1.5, `carried along (${(t.pos.z - z0).toFixed(1)} m)`);
  assert.ok(t.statuses.blind);
});

// ------------------------------------------------------------------ ground strikes

test('eruption (Pillar of Ash): nothing until the delay, then it burns and launches what stands there', () => {
  const t = foe(0, 12);
  const aside = foe(6, 12);
  aim.target = t;
  cast('ash_pillar');
  step(MANTRAS.ash_pillar.cast + MANTRAS.ash_pillar.p.delay - 0.1);
  assert.equal(t.blows.length, 0, 'the telegraph comes first');
  step(0.2);
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('ash_pillar'), 0.01);
  assert.ok(t.vel.y > 0 || t.pos.y > 0.5, 'launched');
  assert.ok(t.statuses.burn);
  assert.equal(aside.blows.length, 0, '6 m off is outside its 3.2 m');
});

test('skyStrike (Skyfall): a bolt on the aimed point after its delay, shocking inside the radius only', () => {
  const t = foe(2, 15);
  const out = foe(-5, 15);
  aim.target = null;
  aim.point = new THREE.Vector3(0, 0, 15);
  cast('skyfall');
  step(MANTRAS.skyfall.cast + MANTRAS.skyfall.p.delay + 0.1);
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('skyfall'), 0.01);
  assert.ok(t.statuses.shock);
  assert.equal(out.blows.length, 0);
});

test('nova (Searing Nova): a ring round the caster hurls near foes away; Far-Reaching widens it', () => {
  const t = foe(0, 3);
  const far = foe(0, 9);
  cast('searing_nova');
  step(MANTRAS.searing_nova.cast + 0.05);
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('searing_nova'), 0.01);
  step(0.6);
  assert.ok(flat(t.pos, player.pos) > 4.5, `hurled away (${flat(t.pos, player.pos).toFixed(1)} m)`);
  assert.equal(far.blows.length, 0, '9 m is outside 7.5 m');

  scene();
  const edge = foe(0, 8.5);
  cast('searing_nova', { mods: ['far'] });
  step(MANTRAS.searing_nova.cast + 0.05);
  assert.equal(edge.blows.length, 1, 'Far-Reaching: 9 m radius');
});

test('spikesLine (Frost Spikes): a line of spikes ahead strikes each foe in it once', () => {
  const a = foe(0, 5);
  const b = foe(0, 14);
  const off = foe(4, 6);
  cast('frost_spikes');
  step(MANTRAS.frost_spikes.cast + 0.6);
  assert.equal(a.blows.length, 1);
  assert.equal(b.blows.length, 1);
  assert.equal(off.blows.length, 0);
  near(a.blows[0].dmg, dmgOf('frost_spikes'), 0.01);
  assert.ok(a.statuses.chill && b.statuses.chill);
});

test('vortex (Cyclone): drags foes to its eye and cuts them each tick; Twin adds three ticks', () => {
  const t = foe(3.5, 14);
  aim.target = null;
  aim.point = new THREE.Vector3(0, 0, 14);
  cast('cyclone');
  const d0 = Math.hypot(t.pos.x, t.pos.z - 14);
  step(MANTRAS.cyclone.cast + 0.05 + (MANTRAS.cyclone.p.interval + DT) * (MANTRAS.cyclone.p.ticks - 1) + 0.1);
  assert.ok(Math.hypot(t.pos.x, t.pos.z - 14) < d0 - 1, 'pulled in');
  assert.equal(t.blows.length, MANTRAS.cyclone.p.ticks);
  near(t.blows[0].dmg, dmgOf('cyclone'), 0.01);

  scene();
  const u = foe(1, 14);
  aim.target = null;
  aim.point = new THREE.Vector3(0, 0, 14);
  cast('cyclone', { mods: ['twin'] });
  step(MANTRAS.cyclone.cast + 0.05 + (MANTRAS.cyclone.p.interval + DT) * (MANTRAS.cyclone.p.ticks + 3) + 0.2);
  assert.equal(u.blows.length, MANTRAS.cyclone.p.ticks + 3);
});

test('thornField (Bell of Witchwater): thorns keep erupting where it is aimed and bleed what stays', () => {
  const t = foe(0, 12);
  aim.target = t;
  cast('bell_reed');
  step(MANTRAS.bell_reed.cast + 0.5 + MANTRAS.bell_reed.p.interval * MANTRAS.bell_reed.p.ticks + 0.2);
  assert.equal(t.blows.length, MANTRAS.bell_reed.p.ticks);
  near(t.blows[0].dmg, dmgOf('bell_reed'), 0.01);
  assert.ok(t.statuses.bleed);
});

test('meteorShower (Bell of the Cinder Heart): the first stone falls on the target, the rest round it; Twin adds two', () => {
  const t = foe(0, 14);
  aim.target = t;
  let marks = 0;
  G.vfx = new Proxy(fx, { get: (o, k) => (k === 'telegraph' ? () => marks++ : fx) });
  cast('bell_cinder');
  const p = MANTRAS.bell_cinder.p;
  step(MANTRAS.bell_cinder.cast + p.interval * p.count + p.delay + 0.2);
  assert.equal(marks, p.count);
  assert.ok(t.blows.length >= 1, 'the first meteor lands on it');
  near(t.blows[0].dmg, dmgOf('bell_cinder'), 0.01);
  assert.ok(t.statuses.burn);

  scene();
  marks = 0;
  G.vfx = new Proxy(fx, { get: (o, k) => (k === 'telegraph' ? () => marks++ : fx) });
  aim.target = foe(0, 14);
  cast('bell_cinder', { mods: ['twin'] });
  step(MANTRAS.bell_cinder.cast + p.interval * (p.count + 2) + p.delay + 0.2);
  assert.equal(marks, p.count + 2);
});

test('glacierRings (Bell of the White Hollow): rings of ice to 9 m freeze each foe once', () => {
  const foes = [foe(0, 2), foe(5, 0), foe(0, -8)];
  const out = foe(12, 0);
  cast('bell_rime');
  step(MANTRAS.bell_rime.cast + 0.6);
  for (const t of foes) {
    assert.equal(t.blows.length, 1);
    assert.ok(t.statuses.freeze, 'frozen');
  }
  near(foes[0].blows[0].dmg, dmgOf('bell_rime'), 0.01);
  assert.equal(out.blows.length, 0);
});

test('quake (Bell of the Old King): three shockwaves, full damage on the first that catches a foe and half after', () => {
  const t = foe(0, 4, { hp: 5000 });
  cast('bell_king');
  step(MANTRAS.bell_king.cast + MANTRAS.bell_king.p.interval * 3 + 0.2);
  assert.ok(t.blows.length >= 1 && t.blows.length <= 3);
  near(t.blows[0].dmg, dmgOf('bell_king'), 0.01, 'first wave');
  for (const b of t.blows.slice(1)) near(b.dmg, dmgOf('bell_king') * 0.5, 0.01, 'later waves');
  assert.ok(t.vel.y > 0 || t.pos.y > 0.3 || flat(t.pos, player.pos) > 5, 'thrown');
});

test('knell (Bell of Hightoll): rings of sound strike each foe once and break a raised guard', () => {
  const guard = foe(0, 3, { posture: 30 });
  guard.blocking = true;
  const far = foe(8, 0);
  cast('bell_toll');
  step(MANTRAS.bell_toll.cast + MANTRAS.bell_toll.p.interval * 3 + 0.2);
  assert.ok(guard.guardBroken, 'guard broken');
  assert.equal(far.blows.length, 1, 'the third ring reaches 8 m');
  near(far.blows[0].dmg, dmgOf('bell_toll'), 0.01);
});

// ------------------------------------------------------------------ lines and leaps of light

test('beam (Volt Spear): strikes along its line at once and stops at a wall', () => {
  const t = foe(0, 20);
  const off = foe(3, 12);
  aim.target = t;
  cast('volt_spear');
  step(MANTRAS.volt_spear.cast + 0.05);
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('volt_spear'), 0.01);
  assert.ok(t.statuses.shock);
  assert.equal(off.blows.length, 0);

  scene();
  G.world.colliders.addBox({ x: 0, z: 10, w: 6, d: 1, y0: -1, y1: 5 });
  const hidden = foe(0, 20);
  aim.target = hidden;
  cast('volt_spear');
  step(MANTRAS.volt_spear.cast + 0.05);
  assert.equal(hidden.blows.length, 0, 'the wall takes it');
});

test('chain (Arc Chain): leaps foe to foe, weaker each jump, as many jumps as listed; Twin adds two', () => {
  const line = [8, 14, 20, 26, 32, 38].map((z) => foe(0, z));
  aim.target = line[0];
  cast('arc_chain');
  step(MANTRAS.arc_chain.cast + 0.05 + 0.1 * MANTRAS.arc_chain.p.jumps);
  assert.ok(line[MANTRAS.arc_chain.p.jumps].statuses.shock, 'shocked');
  step(0.6);
  const jumps = MANTRAS.arc_chain.p.jumps;
  for (let i = 0; i <= jumps; i++) {
    assert.equal(line[i].blows.length, 1, `link ${i}`);
    near(line[i].blows[0].dmg, dmgOf('arc_chain') * (1 - i * 0.12), 0.01, `link ${i}`);
    assert.deepEqual(line[i].blows[0].h.status, ['shock']);
  }
  assert.equal(line[jumps + 1].blows.length, 0, 'no further');

  scene();
  const more = [8, 14, 20, 26, 32, 38, 44, 50].map((z) => foe(0, z));
  aim.target = more[0];
  cast('arc_chain', { mods: ['twin'] });
  step(MANTRAS.arc_chain.cast + 0.1 * 9);
  assert.equal(more.filter((t) => t.blows.length).length, jumps + 3);
});

test('blink (Bolt Step): reappears ahead, shocking what it passes, short of a wall; Far-Reaching goes further', () => {
  const t = foe(0, 6);
  cast('bolt_step');
  step(MANTRAS.bolt_step.cast + 0.05);
  near(player.pos.z, MANTRAS.bolt_step.p.distance, 0.02, 'distance');
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('bolt_step'), 0.01);
  assert.ok(t.statuses.shock);

  scene();
  G.world.colliders.addBox({ x: 0, z: 9, w: 6, d: 1, y0: -1, y1: 5 });
  cast('bolt_step');
  step(MANTRAS.bolt_step.cast + 0.05);
  assert.ok(player.pos.z < 8.5 && player.pos.z > 6, `stops short of the wall (${player.pos.z.toFixed(2)})`);

  scene();
  cast('bolt_step', { mods: ['far'] });
  step(MANTRAS.bolt_step.cast + 0.05);
  near(player.pos.z, MANTRAS.bolt_step.p.distance * 1.3, 0.02, 'Far-Reaching');
});

test('teleportBehind (Shade Step): steps out behind the target facing it, and the next blow is empowered', () => {
  const t = foe(0, 10, { yaw: Math.PI }); // facing the caster
  aim.target = t;
  cast('shade_step');
  step(MANTRAS.shade_step.cast + 0.05);
  near(player.pos.z, 11.8, 0.01, 'behind it');
  assert.ok(Math.abs(Math.cos(player.yaw) + 1) < 1e-4, 'facing it');
  assert.equal(player.nextHitBonus, MANTRAS.shade_step.p.buff);
  step(0.5);
  const empowered = jab(t);
  const plain = jab(t);
  near(empowered / plain, 1 + MANTRAS.shade_step.p.buff, 0.01, 'the next blow, once');
});

test('stealth (Night Veil): near-invisible for its duration; the first strike from it hits harder and ends it', () => {
  cast('night_veil');
  step(MANTRAS.night_veil.cast + 0.05);
  assert.ok(player.stealth > 0 && player.buffs.some((b) => b.id === 'veil'));
  assert.equal(player.nextHitBonus, MANTRAS.night_veil.p.bonus);
  const t = foe(0, 1.4);
  step(0.5);
  const struck = jab(t);
  assert.equal(player.stealth, 0, 'the strike breaks the veil');
  near(struck / jab(t), 1 + MANTRAS.night_veil.p.bonus, 0.01);

  scene();
  cast('night_veil');
  step(MANTRAS.night_veil.p.duration + 1);
  assert.ok(player.stealth <= 0 && !player.buffs.some((b) => b.id === 'veil'), 'it wears off');
});

// ------------------------------------------------------------------ the caster's body

test('leap (Flare Leap): launches the caster high and a little forward, trailing flame', () => {
  cast('flare_leap');
  let top = 0;
  for (let t = 0; t < 2; t += DT) {
    step(DT);
    top = Math.max(top, player.pos.y);
  }
  const up = MANTRAS.flare_leap.p.up;
  assert.ok(top > (up * up) / (2 * 30) * 0.8, `peak ${top.toFixed(1)} m`);
  assert.ok(player.pos.z > 1, `forward ${player.pos.z.toFixed(1)} m`);
  assert.ok(player.grounded, 'and lands');
});

test('dash (Ice Skate): glides its distance with i-frames, chilling what it passes', () => {
  const t = foe(0.6, 6);
  cast('ice_skate');
  step(MANTRAS.ice_skate.cast + 0.1);
  assert.ok(player.iframes > 0, 'untouchable mid-dash');
  step(1.2);
  const d = MANTRAS.ice_skate.p.distance;
  assert.ok(player.pos.z > d * 0.85 && player.pos.z < d * 1.15, `${player.pos.z.toFixed(1)} m for ${d}`);
  assert.equal(t.blows.length, 1);
  near(t.blows[0].dmg, dmgOf('ice_skate'), 0.01);
  assert.ok(t.statuses.chill);

  // Swift Dash has no damage: it carries the caster past a foe without touching it
  scene();
  const passed = foe(0.6, 6);
  cast('swift_dash');
  step(1.5);
  assert.ok(player.pos.z > MANTRAS.swift_dash.p.distance * 0.85);
  assert.equal(passed.blows.length, 0, 'no blow');
  assert.ok(flat(passed.pos, { x: 0.6, z: 6 }) < 0.01, 'not shoved');
});

test('airDash (Gale Rend): castable in the air; cuts along the aim', () => {
  player.pos.set(0, 4, 0);
  player.grounded = false;
  const t = foe(0, 7, { y: 4 });
  t.noGravity = true;
  const plain = (() => {
    const u = foe(40, 0, { y: 4 });
    u.noGravity = true;
    return u;
  })();
  cast('gale_rend');
  step(MANTRAS.gale_rend.cast + 0.3);
  assert.ok(player.pos.z > 8, `${player.pos.z.toFixed(1)} m along the aim`);
  assert.equal(t.blows.length, 1);
  assert.equal(plain.blows.length, 0);
  assert.equal(t.blows[0].h.kind, 'melee');
});

test('grab (Cinder Grasp): lunges in, stops on the foe it seizes, and detonates on those beside it', () => {
  const t = foe(0, 5);
  const beside = foe(1.5, 6.5);
  cast('cinder_grasp');
  step(MANTRAS.cinder_grasp.cast + 0.5);
  assert.equal(t.blows.length, 1, 'seized once');
  near(t.blows[0].dmg, dmgOf('cinder_grasp'), 0.01);
  assert.ok(t.statuses.burn);
  assert.equal(beside.blows.length, 1, 'caught by the blast');
  near(beside.blows[0].dmg, dmgOf('cinder_grasp') * 0.6, 0.01);
  step(1);
  assert.ok(player.pos.z < 5.5, `stopped at the foe (${player.pos.z.toFixed(1)} m)`);
});

// ------------------------------------------------------------------ weapon arts

test('bash (Shoulder Bash): charges in, batters the guard and knocks back', () => {
  const t = foe(0, 4, { posture: 30 });
  t.blocking = true;
  cast('shoulder_bash');
  step(MANTRAS.shoulder_bash.cast + 0.6);
  assert.ok(t.guardBroken, `${MANTRAS.shoulder_bash.p.posture} posture breaks a 30 guard`);

  scene();
  const v = foe(0, 4);
  cast('shoulder_bash');
  step(MANTRAS.shoulder_bash.cast + 0.3);
  assert.equal(v.blows.length, 1);
  near(v.blows[0].dmg, dmgOf('shoulder_bash'), 0.01);
  step(0.5);
  assert.ok(v.pos.z > 4.5, 'knocked back');
});

test('melee (Heel Drop): cannot be parried; hits for 1.4 weapon blows', () => {
  const t = foe(0, 2);
  const swing = jab(t);
  t.parryT = 1;
  step(1);
  t.parryT = 5;
  t.blows.length = 0;
  cast('heel_drop');
  step(MANTRAS.heel_drop.cast + 0.3);
  assert.equal(t.blows.length, 1, 'through the parry');
  near(t.blows[0].dmg / swing, MANTRAS.heel_drop.p.wMul, 0.02);
});

test('weapon arts take stars and Potent like every other mantra', () => {
  const t = foe(0, 2);
  const swing = jab(t);
  step(1);
  t.blows.length = 0;
  cast('heel_drop', { stars: 2, mods: ['potent'] });
  step(MANTRAS.heel_drop.cast + 0.3);
  near(t.blows[0].dmg / swing, MANTRAS.heel_drop.p.wMul * 1.3 * 1.2, 0.02, 'two stars and Potent');
});

test('flurry (Rending Flurry): five cuts that bleed; Lingering bleeds twice as hard', () => {
  const t = foe(0, 1.6);
  cast('rending_flurry');
  step(MANTRAS.rending_flurry.cast + MANTRAS.rending_flurry.p.duration + 0.1);
  assert.equal(t.blows.length, MANTRAS.rending_flurry.p.hits);
  const plain = t.statuses.bleed.stacks;

  scene();
  const u = foe(0, 1.6);
  cast('rending_flurry', { mods: ['lingering'] });
  step(MANTRAS.rending_flurry.cast + MANTRAS.rending_flurry.p.duration + 0.1);
  near(u.statuses.bleed.stacks, plain * 2, 0.01, 'Lingering');
});

test('lunge (Piercing Lunge): closes the gap and goes through a raised guard', () => {
  const t = foe(0, 6);
  t.blocking = true;
  cast('piercing_lunge');
  step(MANTRAS.piercing_lunge.cast + 0.4);
  assert.equal(t.blows.length, 1, 'unblockable');
  assert.ok(player.pos.z > 3, 'closed in');
});

test('spin (Whirling Blade): every foe round the caster is cut three times; Twin adds a cut', () => {
  const ring = [foe(0, 2), foe(2, 0), foe(0, -2), foe(-2, 0)];
  cast('whirling_blade');
  step(MANTRAS.whirling_blade.cast + MANTRAS.whirling_blade.p.duration + 0.1);
  for (const t of ring) assert.equal(t.blows.length, MANTRAS.whirling_blade.p.hits);

  scene();
  const u = foe(0, 2);
  cast('whirling_blade', { mods: ['twin'] });
  step(MANTRAS.whirling_blade.cast + MANTRAS.whirling_blade.p.duration + 0.1);
  assert.equal(u.blows.length, MANTRAS.whirling_blade.p.hits + 1);
});

test('slam (Earthsplitter): the ground breaks ahead and throws up what stands in it', () => {
  const t = foe(0, 3);
  const far = foe(0, 9);
  cast('earthsplitter');
  step(MANTRAS.earthsplitter.cast + 0.1);
  assert.equal(t.blows.length, 1);
  assert.ok(t.vel.y > 0, 'launched');
  assert.equal(far.blows.length, 0);
});

test('rush (Mayhem Rush): blitzes in and strikes three times', () => {
  const t = foe(0, 4);
  cast('mayhem_rush');
  step(MANTRAS.mayhem_rush.cast + 0.6);
  assert.equal(t.blows.length, MANTRAS.mayhem_rush.p.hits);
});

// ------------------------------------------------------------------ the caster's state

test('buff (Bulwark Stance): +30% physical resistance and +40 posture for 6 s; Empowered makes it 30% stronger and longer', () => {
  const r0 = player.resist.phys;
  const p0 = player.maxPosture;
  cast('bulwark_stance');
  step(MANTRAS.bulwark_stance.cast + 0.05);
  near(player.resist.phys, r0 + 0.3, 1e-6, 'resist');
  assert.equal(player.maxPosture, p0 + 40);
  step(MANTRAS.bulwark_stance.p.duration);
  near(player.resist.phys, r0, 1e-6, 'and back');
  assert.equal(player.maxPosture, p0);

  scene();
  cast('bulwark_stance', { mods: ['empowered'] });
  step(MANTRAS.bulwark_stance.cast + 0.05);
  near(player.resist.phys, r0 + 0.39, 1e-6, 'Empowered');
  assert.equal(player.maxPosture, p0 + 52);
  step(MANTRAS.bulwark_stance.p.duration + 0.5);
  assert.ok(player.buffs.some((b) => b.id === 'bulwark_stance'), 'lasts 7.8 s');
});

test('buff (Bell of the Red Warlord and Rhythm): damage, speed and lifesteal; a wide parry window and cheap blocks', () => {
  const dmg0 = player.derived.physDmg;
  const speed0 = player.speedBase;
  cast('bell_red');
  step(MANTRAS.bell_red.cast + 0.05);
  near(player.derived.physDmg, dmg0 + 0.22, 1e-6);
  near(player.speedBase / speed0, (player.derived.moveMul) / (player.derived.moveMul - 0.1), 1e-6, 'speed');
  const t = foe(0, 3);
  player.hp = player.maxHp * 0.5;
  const hp = player.hp;
  applyHit(player, t, { dmg: 100, posture: 0, element: 'phys', kind: 'melee' });
  near(player.hp - hp, 100 * 0.04 * player.derived.healMul, 1e-6, 'lifesteal');

  scene();
  const w0 = player.derived.parryWindow;
  cast('res_rhythm');
  step(MANTRAS.res_rhythm.cast + 0.05);
  near(player.derived.parryWindow, w0 + 0.12, 1e-6);
  assert.equal(player.mods.blockPosture, 0.5);
});

test('warcry (War Cry, Battle Hymn): staggers foes in reach, emboldens the caster; the two songs stack', () => {
  const t = foe(0, 5);
  const boss = foe(5, 0, { boss: true });
  const far = foe(0, 15);
  const dmg0 = player.derived.physDmg;
  const mantra0 = player.derived.mantraDmg;
  cast('war_cry');
  step(MANTRAS.war_cry.cast + 0.05);
  assert.ok(t.stunned, 'staggered');
  near(t.posture, MANTRAS.war_cry.p.posture, 1e-6);
  assert.ok(!boss.stunned && boss.posture > 0, 'a great foe takes the posture but keeps its feet');
  assert.equal(far.posture, 0);
  near(player.derived.physDmg, dmg0 + 0.15, 1e-6);
  cast('battle_hymn');
  step(MANTRAS.battle_hymn.cast + 0.05);
  near(player.derived.physDmg, dmg0 + 0.25, 1e-6, 'both songs');
  near(player.derived.mantraDmg, mantra0 + 0.1, 1e-6);
});

test('heal (Rally): heals a fifth of health and shakes off bleeds and burns; Potent and Empowered heal more', () => {
  const heal = (mods) => {
    scene();
    player.refreshDanger(60); // no resting regeneration
    player.hp = player.maxHp * 0.3;
    const hp = player.hp;
    cast('rally', { mods });
    step(MANTRAS.rally.cast + 0.05);
    return (player.hp - hp) / (player.maxHp * player.derived.healMul);
  };
  near(heal(), MANTRAS.rally.p.pct, 1e-6, 'plain');
  near(heal(['potent']), MANTRAS.rally.p.pct * 1.2, 1e-6, 'Potent: +20% healing');
  near(heal(['empowered']), MANTRAS.rally.p.pct * 1.3, 1e-6, 'Empowered');

  scene();
  player.hp = player.maxHp * 0.5;
  player.applyStatus('bleed');
  player.applyStatus('burn');
  cast('rally');
  step(MANTRAS.rally.cast + 0.05);
  assert.ok(!player.statuses.bleed && !player.statuses.burn, 'cleansed');
});

test('heal (Inner Calm): restores sanity and lays a heal over time', () => {
  player.refreshDanger(60);
  player.ch.sanity = 20;
  cast('inner_calm');
  step(MANTRAS.inner_calm.cast + 0.05);
  const calm = player.ch.sanity - 20; // and a little natural recovery during the cast
  assert.ok(calm >= MANTRAS.inner_calm.p.sanity && calm < MANTRAS.inner_calm.p.sanity + 3, `+${calm.toFixed(1)} sanity`);
  near(player.buffMods().regen, (player.maxHp * MANTRAS.inner_calm.p.hot) / 8, 1e-6);
  player.hp = player.maxHp * 0.3;
  const hp = player.hp;
  step(4);
  near(player.hp - hp, (player.maxHp * MANTRAS.inner_calm.p.hot / 8) * 4 * player.derived.healMul, 0.05, 'over four seconds');
});

test('resSanguine (Sanguine): bleeds the caster for ether and readies the critical', () => {
  player.refreshDanger(60);
  player.critCd = 5;
  const hp = player.hp;
  cast('res_sanguine');
  player.ether = 10;
  step(MANTRAS.res_sanguine.cast + 0.05);
  near(hp - player.hp, player.maxHp * MANTRAS.res_sanguine.hpCost, 0.01, 'blood');
  const gained = player.ether - 10; // and the cast's moment of natural regeneration
  assert.ok(gained >= MANTRAS.res_sanguine.p.ether && gained < MANTRAS.res_sanguine.p.ether + 1, `+${gained.toFixed(1)} ether`);
  assert.equal(player.critCd, 0);
});

test('mark (Death Mark): the target takes 20% more from everything, then the mark fades; Empowered marks deeper', () => {
  const t = foe(0, 10);
  aim.target = t;
  cast('death_mark');
  step(MANTRAS.death_mark.cast + 0.05);
  const amp = MANTRAS.death_mark.p.amp * Math.min(1.5, Math.max(1, mantraPower(player, { id: 'death_mark', ...MANTRAS.death_mark })));
  near(t.dmgTakenMul, 1 + amp, 1e-6);
  applyHit(foe(0, 8), t, { dmg: 10, posture: 0, element: 'phys', kind: 'melee' });
  near(t.blows.at(-1).dmg, 10 * (1 + amp), 1e-6, 'any source');
  step(MANTRAS.death_mark.p.duration + 0.6);
  assert.equal(t.dmgTakenMul, 1, 'faded');

  scene();
  const u = foe(0, 10);
  aim.target = u;
  cast('death_mark', { mods: ['empowered'] });
  step(MANTRAS.death_mark.cast + 0.05);
  near(u.dmgTakenMul, 1 + amp * 1.3, 1e-6);
});

test('ward (Tempest Guard): winds push foes off the caster and turn arrows aside', () => {
  const t = foe(0, 1.5);
  cast('tempest_guard');
  step(MANTRAS.tempest_guard.cast + 0.05);
  assert.ok(player.wardT > 0);
  step(0.6);
  assert.ok(flat(t.pos, player.pos) > 2.5, `pushed off (${flat(t.pos, player.pos).toFixed(1)} m)`);
  const hp = player.hp;
  const shot = enemyShot(new THREE.Vector3(8, 1, 0), player.center());
  step(0.5);
  assert.equal(player.hp, hp, 'the arrow never lands');
  assert.ok(shot.dead);
});

test('arcWard (Arc Ward): parries every blow from any side, and sends projectiles back at their thrower', () => {
  cast('arc_ward');
  step(MANTRAS.arc_ward.cast + 0.45); // through the cast's recovery
  assert.ok(player.autoParryT > 0);
  const behind = foe(0, -1.5, { yaw: 0 });
  const hp = player.hp;
  assert.equal(applyHit(behind, player, { dmg: 20, posture: 10, element: 'phys', kind: 'melee' }), 'parried', 'from behind too');
  assert.equal(player.hp, hp);
  const archer = foe(6, 0);
  const shot = new Projectile(archer, { pos: new THREE.Vector3(5, 1, 0), vel: new THREE.Vector3(-30, 0, 0), radius: 0.4, hit: { dmg: 10, posture: 0, element: 'phys', kind: 'proj' } });
  step(0.4);
  assert.equal(player.hp, hp);
  assert.ok(shot.owner === player, 'reflected');
  assert.equal(archer.blows.length, 1, 'back into the archer');
});

test('wall (Rime Wall): raises a wall of ice ahead that stops bodies and enemy shots', () => {
  cast('rime_wall');
  step(MANTRAS.rime_wall.cast + 0.05);
  assert.equal(G.world.walls.length, 1);
  const w = G.world.walls[0];
  near(w.m.position.z, MANTRAS.rime_wall.p.dist, 0.01, 'ahead of the caster');
  const runner = foe(0, 7);
  runner.vel.set(0, 0, -6); // walking at the caster through the wall
  for (let i = 0; i < 30; i++) {
    runner.vel.set(0, 0, -6);
    step(DT);
  }
  assert.ok(runner.pos.z > MANTRAS.rime_wall.p.dist, `held at the wall (${runner.pos.z.toFixed(2)})`);
  const hp = player.hp;
  const shot = enemyShot(new THREE.Vector3(1, 1.2, 12), player.center());
  step(0.6);
  assert.ok(shot.dead);
  assert.equal(player.hp, hp, 'the ice takes it');
});
