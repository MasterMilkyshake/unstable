import test, { beforeEach } from 'node:test';
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
globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { buildWorld } = await import('../tools/reach/world.mjs');

// Factions that move (game/worldLife.js) in the real world, headlessly: a real Player and real
// guards, who walk by Enemy.navTo; the events are started and stepped as the game does, and
// their outcomes checked: a column's march and its turn on a wanted name, each checkpoint
// branch, a convoy escorted, lost and raided, hunters coming and going, a cutter's hail, a
// sounding watched and one followed too close, a skirmish, and the story's hold on all of it.
const world = await buildWorld();
const { G } = await import('../src/core/globals.js');
const { Player } = await import('../src/entities/player.js');
const { Game } = await import('../src/game/game.js');
const { Input } = await import('../src/core/input.js');
const { Boat } = await import('../src/entities/boat.js');
const { UPDATE_HOOKS } = await import('../src/game/hooks.js');
const life = await import('../src/game/worldLife.js');
const { DIALOGUES } = await import('../src/data/npcs.js');
const { CHECKPOINTS } = await import('../src/data/factionLife.js');
const { ensureStanding } = await import('../src/game/factions.js');

const DT = 1 / 30;
const fx = new Proxy(function () {}, { get: () => fx, apply: () => fx });
let game, toasts, modal;

beforeEach(() => {
  toasts = [];
  modal = null;
  G.vfx = fx;
  G.audio = fx;
  G.ui = {
    toast: (m) => toasts.push(m), banner() {}, damageFlash() {},
    openModal: (id, html) => { modal = { id, html, el: { addEventListener() {} } }; return modal.el; },
    closeModal: () => { modal = null; },
  };
  G.net = null;
  G.time = 1000;
  G.actors = [];
  G.projectiles = [];
  G.scene = world.scene;
  G.world = world;
  const input = Object.assign(Object.create(Input.prototype), {
    down: new Set(), pressed: new Set(), released: new Set(), mPressed: [false, false, false], mDown: [false, false, false], mReleased: [false, false, false],
  });
  G.input = input;
  game = Object.create(Game.prototype);
  Object.assign(game, {
    world, camYaw: 0, inRift: false, inDungeon: false, state: 'playing', input, nextNetId: 1, npcs: [], boats: [],
    net: { isGuest: false, isHost: false, avatars: new Map() }, ui: G.ui, save() {}, giveItem(id, n) { this.ch.inventory.items[id] = (this.ch.inventory.items[id] || 0) + n; },
  });
  G.game = game;
  game.ch = ensureStanding(game.createCharacter({ name: 'Witness', race: 'ashkin', look: {} }));
  game.ch.silver = 500;
  game.player = new Player(game.ch);
  game.playerActors = () => [game.player];
  G.player = game.player;
  G.actors.push(game.player);
  for (const ev of life.LIFE.active.slice()) life.endEvent(game, ev);
  life.LIFE.cleared.clear();
  life.LIFE.wantedTime = {};
  life.LIFE.guestWanted = new WeakMap();
});

function place(x, z) {
  const p = game.player;
  p.pos.set(x, world.groundAt(x, z, world.terrain.heightAt(x, z) + 2) + 0.05, z);
  p.vel.set(0, 0, 0);
  p.grounded = true;
}
// the game's frame: every actor, the despawned gone, then the hooks (world life among them)
function run(seconds, each) {
  for (let t = 0; t < seconds; t += DT) {
    G.time += DT;
    if (each) each(t);
    for (const a of G.actors.slice()) if (a !== game.player && !a.dead) a.update(DT);
    for (const b of game.boats.slice()) if (b !== game.player.boat) b.update(DT);
    G.actors = G.actors.filter((a) => !a.despawn);
    for (const h of UPDATE_HOOKS) h(game, DT);
  }
}
// step only the world-life events (no new ones start)
function tickEvents(seconds, each) {
  const timers = { ...life.LIFE.timers };
  for (const k in life.LIFE.timers) life.LIFE.timers[k] = 1e9;
  for (const k of Object.keys(life.KINDS)) life.LIFE.timers[k] = 1e9;
  run(seconds, each);
  Object.assign(life.LIFE.timers, timers);
}
const talk = (cp) => DIALOGUES['life_' + cp.id]({});
const pick = (d, label) => d.options.find((o) => o.label.startsWith(label));

test('the coast follows the story: who holds it, from the Writ to the ending', () => {
  const ch = game.ch;
  assert.match(life.coastHolder(ch).line, /The Watch keeps Saltreach/);
  ch.flags.writ_answered = true;
  assert.match(life.coastHolder(ch).line, /the Enclave keeps Meridian/);
  ch.flags.harbor_occupied = true;
  assert.equal(life.coastHolder(ch).id, 'enclave');
  ch.flags.harbor_freed = true;
  ch.flags.war_enclave = true;
  assert.equal(life.coastHolder(ch).id, 'contested');
  for (const [ending, id] of [['break', 'watch'], ['seal', 'ministry'], ['claim', 'enclave']]) {
    ch.flags.ending = ending;
    assert.equal(life.coastHolder(ch).id, id, `${ending} gives the coast to ${id}`);
  }
});

test('an Enclave column marches its road past the player, and turns on a wanted name', () => {
  place(1238, -205); // beside the Garrison Road on Widow Ridge
  const col = life.startEvent(game, 'column', life.KINDS.column.start(game));
  assert.ok(col && col.members.length >= 4, 'a column of four or more');
  const d0 = col.d;
  tickEvents(25);
  assert.ok(Math.abs(col.d - d0) > 25, `it marched ${Math.abs(col.d - d0).toFixed(0)} m along the road in 25 s`);
  const lead = col.members.find((e) => !e.dead);
  assert.ok(Math.hypot(lead.pos.x - lead.home.x, lead.pos.z - lead.home.z) < 8, 'the leader keeps its place in the march');
  // now the player is wanted by the Enclave, close by
  game.ch.wanted.enclave = 200;
  place(lead.pos.x + 40, lead.pos.z);
  tickEvents(4);
  assert.ok(col.hunting, 'the column turned off the road for the wanted name');
  assert.ok(col.members.some((e) => !e.dead && Math.hypot(e.home.x - game.player.pos.x, e.home.z - game.player.pos.z) < 6), "the column's places are round the player");
  life.endEvent(game, col);
});

test('checkpoints: a toll, papers, a refusal, the Honored waved through, and a run marks the name', () => {
  const cp = CHECKPOINTS.find((c) => c.id === 'cp_dock');
  const at = (() => { const r = life.routeOf({ id: 'road:' + cp.road, roads: [[cp.road, 1]] }); const a = life.routeAt(r, life.routeNear(r, cp.at[0], cp.at[1]).d); return a; })();
  const ch = game.ch;
  ch.rep.enclave = -20;
  place(at.x + 70, at.z);
  const ev = life.KINDS.checkpoint.start(game);
  assert.ok(ev, 'a Distrusted name is stopped at the Dock Road');
  life.startEvent(game, 'checkpoint', ev);
  // the toll
  let d = talk(cp);
  assert.match(d.text, /^Halt\./);
  const silver = ch.silver;
  pick(d, 'Pay the toll').do();
  assert.ok(ch.silver < silver, 'the toll is paid');
  assert.match(talk(cp).text, /seen to/, 'and the tollman waves you on');
  // papers
  life.LIFE.cleared.clear();
  ch.flags.registryPapers = true;
  d = talk(cp);
  pick(d, 'Show your papers').do();
  assert.match(talk(cp).text, /seen to/, 'papers pass you');
  // a refusal
  life.LIFE.cleared.clear();
  ch.flags.registryPapers = false;
  const rep = ch.rep.enclave;
  pick(talk(cp), 'Refuse').do();
  assert.ok(ch.wanted.enclave > 0 && ch.rep.enclave === rep - 10, 'a refusal marks the name and costs standing');
  // the Honored are waved through, and no checkpoint stops them
  life.endEvent(game, ev);
  ch.wanted.enclave = 0;
  ch.rep.enclave = 45;
  assert.match(talk(cp).text, /Pass, friend/);
  assert.equal(life.KINDS.checkpoint.start(game), null, 'no checkpoint is raised for the Honored');
  // running it: Distrusted again, straight across the barricade's line
  ch.rep.enclave = -20;
  const ev2 = life.startEvent(game, 'checkpoint', life.KINDS.checkpoint.start(game));
  const ux = Math.sin(at.yaw), uz = Math.cos(at.yaw);
  place(at.x - ux * 20, at.z - uz * 20);
  tickEvents(0.5);
  place(at.x + ux * 20, at.z + uz * 20);
  tickEvents(0.5);
  assert.ok(ch.wanted.enclave > 0, 'running the checkpoint marks the name');
  assert.ok(toasts.some((m) => /You ran/.test(m)));
  life.endEvent(game, ev2);
});

// The North Road leaves Saltreach's north gate at z 141; a convoy sets out from out of sight
// behind a player (never within 70 m), so the player stands well up the road.
test('a convoy escorted to its end pays standing; one lost leaves its cart to salvage', () => {
  place(-20, 300);
  const ev = life.KINDS.convoy.start(game);
  assert.ok(ev, 'a Watch convoy sets out on the North Road');
  life.startEvent(game, 'convoy', ev);
  assert.equal(ev.def.faction, 'watch');
  ev.ambushAt = Infinity;
  // the cart waits for its escort to keep their places, so it goes no faster than they walk
  ev.speed = 6;
  const rep = game.ch.rep.watch, silver = game.ch.silver;
  // the player walks beside the cart all the way
  tickEvents(200, () => { if (ev.state !== 'moving') return; const c = ev.cart.object.position; place(c.x + 4, c.z); });
  assert.equal(ev.state, 'arrived', `the convoy reached ${ev.d.toFixed(0)} of ${ev.route.length.toFixed(0)} m`);
  assert.equal(game.ch.rep.watch, rep + 6, 'escort pays six standing');
  assert.ok(game.ch.silver > silver, 'and silver');
  // a second convoy whose escort falls to raiders, not to the player
  place(-20, 300);
  const ev2 = life.startEvent(game, 'convoy', life.KINDS.convoy.start(game));
  for (const e of ev2.members) { e.lastAttacker = null; e.hp = 0; e.dead = true; }
  tickEvents(0.2);
  assert.equal(ev2.state, 'lost');
  const before = game.ch.silver;
  game.interact(ev2.interact);
  assert.ok(game.ch.silver > before && !(game.ch.wanted.watch > 0), 'the salvage is the player\'s, at no cost');
  life.endEvent(game, ev2);
});

test('raiding a convoy: its loot, at the cost of standing and a wanted mark', () => {
  place(-20, 300);
  const ev = life.startEvent(game, 'convoy', life.KINDS.convoy.start(game));
  const rep = game.ch.rep.watch;
  for (const e of ev.members) { e.lastAttacker = game.player; e.hp = 0; e.dead = true; }
  tickEvents(0.2);
  assert.equal(ev.state, 'raided');
  assert.ok(game.ch.wanted.watch >= 300 - 1, 'the raider is wanted by the Watch');
  assert.equal(game.ch.rep.watch, rep - 12, 'and loses standing');
  const items = { ...game.ch.inventory.items };
  game.interact(ev.interact); // through the game's own [E], as a player opens it
  assert.ok(Object.keys(game.ch.inventory.items).some((k) => (game.ch.inventory.items[k] || 0) > (items[k] || 0)), "the cart's stores are taken");
  life.endEvent(game, ev);
});

test('hunters find a name wanted too long, and leave once the mark is paid', () => {
  place(1300, 40);
  game.ch.wanted.enclave = 400;
  life.LIFE.wantedTime.enclave = 200;
  const ev = life.startEvent(game, 'hunters', life.KINDS.hunters.start(game));
  assert.ok(ev && ev.faction === 'enclave', 'Enclave hunters set out');
  // they are placed where the grid finds them a walk to the player, a few steps later
  for (let t = 0; t < 5 && !ev.members.length; t += 0.5) tickEvents(0.5);
  assert.ok(ev.members.length, 'and are on their way');
  const lead = () => ev.members.find((e) => !e.dead);
  const d0 = Math.hypot(lead().pos.x - game.player.pos.x, lead().pos.z - game.player.pos.z);
  assert.ok(d0 > 80, `they start out of sight (${d0.toFixed(0)} m)`);
  tickEvents(20);
  const d1 = Math.hypot(lead().pos.x - game.player.pos.x, lead().pos.z - game.player.pos.z);
  assert.ok(d1 < d0 - 30, `they close in (${d0.toFixed(0)} m to ${d1.toFixed(0)} m)`);
  game.ch.wanted.enclave = 0;
  game.ch.rep.enclave = 0;
  tickEvents(1);
  assert.ok(ev.leaving, 'with the mark paid they turn back');
  assert.ok(toasts.some((m) => /lower their warrant/.test(m)));
});

test('an Enclave cutter runs down a wanted sailor and hails; paying sends it away', () => {
  const sea = [700, -150];
  const b = new Boat(new THREE.Vector3(sea[0], 0, sea[1]), 0, 'sloop');
  game.boats.push(b);
  game.player.boat = b;
  b.board(game.player, 0);
  game.player.pos.copy(b.pos);
  game.ch.wanted.enclave = 300;
  const ev = life.KINDS.cutter.start(game);
  assert.ok(ev && ev.boat.type === 'cutter', 'a cutter puts out');
  life.startEvent(game, 'cutter', ev);
  let hailedAt = null;
  tickEvents(20, (t) => { if (!hailedAt && ev.hailed) hailedAt = t; });
  assert.ok(hailedAt != null, `it came within hail (${hailedAt?.toFixed(1)} s)`);
  assert.ok(modal && /HAILS YOU/.test(modal.html), 'and hailed');
  assert.ok(ev.members.every((e) => e.dead || Math.hypot(e.pos.x - ev.boat.pos.x, e.pos.z - ev.boat.pos.z) < 6), 'its crew rides its deck');
  ev.paid = true;
  tickEvents(0.2);
  assert.ok(!life.LIFE.active.includes(ev), 'paid off, it is gone');
  assert.ok(!game.boats.includes(ev.boat));
  game.player.boat = null;
});

test('a sounding watched from a distance is rewarded; one followed too close draws the silencer', () => {
  place(-1240, 1110);
  game.ch.rep.ministry = 15;
  const ev = life.KINDS.sounding.start(game);
  assert.ok(ev, 'a party sets out from the Sounding House');
  life.startEvent(game, 'sounding', ev);
  ev.d = ev.length; // at the sounding place
  tickEvents(0.1);
  assert.equal(ev.phase, 'sound');
  const xp = game.ch.xp;
  place(ev.def.at[0] + 30, ev.def.at[1]);
  tickEvents(62, () => place(ev.def.at[0] + 30, ev.def.at[1]));
  assert.ok(game.ch.xp > xp && (game.ch.stats.soundings || 0) >= 1, 'the witness is rewarded');
  // untrusted, at their heels
  game.ch.rep.ministry = 0;
  place(-1240, 1110);
  const ev2 = life.startEvent(game, 'sounding', life.KINDS.sounding.start(game));
  tickEvents(6, () => { const e = ev2.members.find((m) => !m.dead); place(e.pos.x + 6, e.pos.z); });
  assert.ok(ev2.provoked && game.ch.wanted.ministry > 0, 'following too close marks the name');
  life.endEvent(game, ev2);
});

test('the Watch and the Redwake skirmish; helping the Watch is paid in standing', () => {
  place(-262, 60);
  const ev = life.KINDS.skirmish.start(game);
  assert.ok(ev, 'a skirmish on the Reed Downs');
  life.startEvent(game, 'skirmish', ev);
  const rep = game.ch.rep.watch;
  for (const e of ev.foes) { e.lastAttacker = game.player; e.hp = 0; e.dead = true; }
  tickEvents(0.2);
  assert.equal(game.ch.rep.watch, rep + 4);
});

test('the story holds the coast: no Enclave columns after the chain is broken, no skirmish in the occupation', () => {
  place(1238, -205);
  game.ch.flags.ending = 'break';
  assert.equal(life.KINDS.column.start(game), null);
  game.ch.flags.ending = null;
  game.ch.flags.harbor_occupied = true;
  place(-262, 60);
  assert.equal(life.KINDS.skirmish.start(game), null);
});

test('every item a convoy holds or a contract asks for exists', async () => {
  const { ITEMS } = await import('../src/data/items.js');
  const { CONVOY_LOOT } = await import('../src/data/factionLife.js');
  const { CONTRACTS } = await import('../src/data/contracts.js');
  for (const f in CONVOY_LOOT) for (const [id] of CONVOY_LOOT[f]) assert.ok(ITEMS[id], `${f} convoy loot ${id}`);
  for (const f in CONTRACTS) for (const c of CONTRACTS[f]) if (c.item) assert.ok(ITEMS[c.item], `${c.id} item ${c.item}`);
});

// A LAN friend, as the host sees them: a remote avatar whose standing arrives in netExt.fx, and
// a relay that records what the host sends.
function befriend(x, z, fx = {}) {
  const friend = { isRemote: true, peerId: 7, dead: false, yaw: 0, pos: new THREE.Vector3(x, world.groundAt(x, z, 400), z), netExt: { fx: { rep: { watch: 0, enclave: 0, ministry: 0 }, wanted: {}, war: {}, ...fx } } };
  const sent = [];
  game.net = G.net = { isHost: true, isGuest: false, avatars: new Map([[7, friend]]), send: (m) => sent.push(m) };
  game.playerActors = () => [game.player, friend];
  return { friend, sent };
}

test('a sounding a friend watches lasts while the friend is near, and pays the friend', () => {
  place(-1250, 1110);
  const ev = life.startEvent(game, 'sounding', life.KINDS.sounding.start(game));
  const at = ev.def.at;
  const { friend, sent } = befriend(at[0] + 30, at[1]);
  ev.phase = 'sound';
  ev.soundT = 0;
  ev.bellT = 0;
  place(-20, 300); // the host goes home, far out of the event's reach
  tickEvents(62);
  const paid = sent.filter((m) => m.t === 'wevr' && m.to === friend.peerId);
  assert.ok(paid.some((m) => m.r.outcome && m.r.outcome.kind === 'witness'), 'the friend is paid for the sounding, through wevr');
  assert.ok(!game.ch.stats.soundings, 'and the host, who left, is not');
  life.endEvent(game, ev);
});

test('hunters come for a friend whose name is marked, and tell the friend', () => {
  place(1300, 40);
  const { friend, sent } = befriend(1290, 30, { wanted: { enclave: 300 } });
  life.LIFE.guestWanted.set(friend, { enclave: 200 });
  const ev = life.startEvent(game, 'hunters', life.KINDS.hunters.start(game));
  assert.ok(ev && ev.quarry === friend, 'the friend is the quarry');
  for (let t = 0; t < 5 && !ev.members.length; t += 0.5) tickEvents(0.5);
  assert.ok(ev.members.length, 'they set out');
  assert.ok(sent.some((m) => m.t === 'wevr' && m.to === friend.peerId && /followed/.test(m.r.toast)), 'the friend is told');
  assert.ok(!toasts.some((m) => /followed/.test(m)), 'the host is not');
  friend.netExt.fx.wanted = {};
  tickEvents(1);
  assert.ok(ev.leaving, 'with the friend\'s mark gone they turn back');
  life.endEvent(game, ev);
});

test('the chart shows who holds the coast, the carrier lines and the high climbs', async () => {
  await import('../src/game/chart.js');
  const { ACTIONS } = await import('../src/game/hooks.js');
  const calls = { arc: 0, moveTo: 0, text: [] };
  const ctx = new Proxy({ canvas: { width: 800, height: 800 } }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return (s) => ({ width: s.length * 5 });
      return (...a) => { if (k === 'arc') calls.arc++; if (k === 'moveTo') calls.moveTo++; if (k === 'fillText') calls.text.push(a[0]); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  const toPx = (x, z) => [(2150 - x) / 4300 * 800, (2630 - z) / 4300 * 800];
  ACTIONS.mapOverlay(ctx, toPx, { rift: false }, () => true);
  assert.ok(calls.arc >= 3, 'the Watch, the Enclave and the Ministry each wash their region');
  assert.ok(calls.moveTo >= world.carrierLines.length, 'every carrier line is drawn');
  assert.ok(calls.text.includes('The Unmoored Keystone'), 'landmarks are named');
  assert.match(ACTIONS.mapHolder({ rift: false }), /The Watch keeps Saltreach/);
  game.ch.flags.harbor_occupied = true;
  assert.match(ACTIONS.mapHolder({ rift: false }), /Enclave holds Saltreach/);
  assert.equal(ACTIONS.mapHolder({ rift: true }), null, 'the Rift has no holder');
});

// ---------------------------------------------------------------- life at sea (game/seaLife.js)
const sea = await import('../src/game/seaLife.js');
sea.chartCourses(world);
function afloat(x, z, yaw = 0) {
  const b = new Boat(new THREE.Vector3(x, 0, z), yaw, 'sloop');
  game.boats.push(b);
  game.player.boat = b;
  b.board(game.player, 0);
  game.player.pos.copy(b.pos);
  return b;
}
function ashore() {
  const b = game.player.boat;
  if (b) { b.leave(game.player); game.boats.splice(game.boats.indexOf(b), 1); }
  game.player.boat = null;
}

test('the sea roads are charted, and a supply sloop sailed in and unloaded pays its escort', () => {
  assert.ok(sea.COURSES.size >= 2, `${sea.COURSES.size} sea roads charted`);
  // each road leaves its berth straight out past the pier's end, and comes in the same way
  for (const [id, p] of sea.COURSES) {
    assert.ok(Math.abs(p[0].distanceTo(p[1]) - 16) < 0.01 && Math.abs(p.at(-1).distanceTo(p.at(-2)) - 16) < 0.01, `${id} clears its piers`);
    for (const m of p.slice(1, -1)) assert.ok(game.world.terrain.heightAt(m.x, m.z) < 0, `${id}'s marks are all at sea`);
  }
  const [id, path] = [...sea.COURSES.entries()].find(([k]) => k === 'sc_rooks') || [...sea.COURSES.entries()][0];
  const mid = path[Math.floor(path.length / 2)];
  afloat(mid.x + 30, mid.z);
  const ev = life.KINDS.seaConvoy.start(game);
  assert.ok(ev, `a sloop casts off on ${id}`);
  life.startEvent(game, 'seaConvoy', ev);
  assert.ok(game.boats.includes(ev.boat) && ev.members.length >= 2, 'with its crew aboard');
  const f = ev.def.faction, rep = game.ch.rep[f];
  // the escort keeps alongside all the way, and holds the pier against whoever waits there
  tickEvents(240, () => {
    const b = ev.boat;
    game.player.boat.pos.set(b.pos.x + 12, 0, b.pos.z);
    game.player.pos.copy(game.player.boat.pos);
    for (const e of ev.foes || []) if (!e.dead) { e.hp = 0; e.dead = true; e.lastAttacker = game.player; }
    if (ev.state === 'sailing') for (const e of life.alive(ev)) assert.ok(Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z) < 6, 'the crew rides its deck');
  });
  assert.equal(ev.state, 'unloaded', `the sloop got in and unloaded (state ${ev.state})`);
  assert.equal(game.ch.rep[f], rep + 6, 'the escort is paid in standing');
  life.endEvent(game, ev);
  assert.ok(!game.boats.includes(ev.boat), 'and the sloop is gone when the event is');
  ashore();
});

test('a sloop raided at sea: its hold opened through the game\'s own [E], at a price', () => {
  const path = sea.COURSES.get('sc_north') || [...sea.COURSES.values()][0];
  const mid = path[Math.floor(path.length / 2)];
  afloat(mid.x + 30, mid.z);
  const ev = life.startEvent(game, 'seaConvoy', life.KINDS.seaConvoy.start(game));
  const f = ev.def.faction, rep = game.ch.rep[f];
  for (const e of ev.members) { e.lastAttacker = game.player; e.hp = 0; e.dead = true; }
  tickEvents(0.2);
  assert.equal(ev.state, 'raided');
  assert.ok(game.ch.wanted[f] > 0 && game.ch.rep[f] === rep - 12, 'marked and less trusted');
  const silver = game.ch.silver;
  game.interact(ev.interact);
  assert.ok(game.ch.silver > silver, 'the hold\'s stores are taken');
  life.endEvent(game, ev);
  ashore();
});

test('a "Watch" sloop that is Redwake: it comes alongside, unmasks, and its taking pays the Watch', () => {
  afloat(700, -150, 0);
  const ev = life.KINDS.falseConvoy.start(game);
  assert.ok(ev, 'a sail under the Watch\'s pennant');
  life.startEvent(game, 'falseConvoy', ev);
  tickEvents(40, () => { if (ev.state === 'unmasked') for (const e of ev.members) { e.lastAttacker = game.player; e.hp = 0; e.dead = true; } });
  assert.ok(toasts.some((m) => /red rag/.test(m)), 'it unmasked as it closed');
  assert.equal(ev.state, 'taken');
  const rep = game.ch.rep.watch;
  assert.ok(rep >= 4, 'the Watch hears of it');
  game.interact(ev.interact);
  assert.ok(ev.openedAt, 'and its hold is opened');
  life.endEvent(game, ev);
  ashore();
});

test('a fishing boat beset by sharks: drive them off and the fishers pay', () => {
  afloat(700, -150);
  const ev = life.KINDS.beset.start(game);
  assert.ok(ev && ev.foes.length === 3 && ev.foes.every((e) => e.type === 'gnashfin'), 'three sharks circle a skiff');
  life.startEvent(game, 'beset', ev);
  const silver = game.ch.silver;
  for (const e of ev.foes) { e.lastAttacker = game.player; e.hp = 0; e.dead = true; }
  tickEvents(0.2);
  assert.equal(ev.state, 'saved');
  assert.ok(game.ch.silver > silver, 'the fishers pay');
  life.endEvent(game, ev);
  ashore();
});

test('a trail of wreckage leads to a hull worth salvaging', () => {
  afloat(700, -150, 0);
  let ev = null;
  for (let i = 0; i < 20 && !ev; i++) ev = life.KINDS.drift.start(game);
  assert.ok(ev, 'a drift on open water');
  life.startEvent(game, 'drift', ev);
  assert.ok(ev.props.length >= 6, 'a trail of floating wreckage');
  const last = ev.props[ev.props.length - 1].object.position;
  assert.ok(Math.hypot(last.x - ev.hull.pos.x, last.z - ev.hull.pos.z) < 40, 'that ends at the hull');
  const silver = game.ch.silver;
  game.interact(ev.interact);
  assert.ok(game.ch.silver > silver, 'salvaged');
  life.endEvent(game, ev);
  ashore();
});

test('Watch hands held at a Redwake camp: cut loose, they follow their rescuer to a Watch post', async () => {
  const rescue = await import('../src/game/rescue.js');
  const { CAPTIVE_CAMPS, WATCH_POSTS } = await import('../src/data/factionLife.js');
  const camp = CAPTIVE_CAMPS[0];
  place(camp.at[0] + 130, camp.at[1]);
  const ev = life.startEvent(game, 'captives', life.KINDS.captives.start(game));
  assert.ok(ev && ev.def === camp && ev.state === 'bound', `bound at ${camp.name}`);
  place(camp.at[0] + 3, camp.at[1]);
  rescue.free(game, ev, game.player);
  assert.equal(ev.members.length, camp.count, 'cut loose');
  assert.ok(ev.members.every((e) => e.team === 'guard'), 'Watch hands again');
  // the rescuer walks off; they follow
  const d0 = Math.hypot(ev.members[0].pos.x - (camp.at[0] - 30), ev.members[0].pos.z - camp.at[1]);
  place(camp.at[0] - 30, camp.at[1]);
  tickEvents(15);
  const d1 = Math.hypot(ev.members[0].pos.x - game.player.pos.x, ev.members[0].pos.z - game.player.pos.z);
  assert.ok(d1 < d0 - 10, `they follow (${d0.toFixed(0)} m to ${d1.toFixed(0)} m)`);
  // at a Watch post with them close behind, the Watch pays
  const [px, pz] = WATCH_POSTS[0];
  const rep = game.ch.rep.watch;
  place(px, pz);
  for (const e of ev.members) e.pos.set(px + 4, world.groundAt(px + 4, pz, 400), pz);
  tickEvents(1.5);
  assert.equal(ev.state, 'home');
  assert.equal(game.ch.rep.watch, rep + 8, 'the rescue is paid in standing');
  tickEvents(4);
  assert.ok(!life.LIFE.active.includes(ev), 'and they go in');
  assert.equal(life.KINDS.captives.start(game), null, 'that camp holds no one else today');
});

test('the Enclave against the Redwake on the Garrison Road: Peacekeepers, the Enclave\'s purse, and none after the chain is broken', () => {
  place(1340, -70);
  const ev = life.KINDS.skirmish.start(game);
  assert.ok(ev && ev.def.id === 'sk_garrison', 'a skirmish on the Garrison Road');
  assert.ok(ev.members.every((e) => /^peacekeeper/.test(e.type)), 'Peacekeepers hold it');
  life.startEvent(game, 'skirmish', ev);
  const rep = game.ch.rep.enclave;
  for (const e of ev.foes) { e.lastAttacker = game.player; e.hp = 0; e.dead = true; }
  tickEvents(0.2);
  assert.equal(game.ch.rep.enclave, rep + 4);
  game.ch.flags.ending = 'break';
  assert.equal(life.KINDS.skirmish.start(game), null);
  game.ch.flags.ending = null;
});
