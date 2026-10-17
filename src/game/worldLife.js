// Factions that move (docs/agent/WORLD_LIFE_PLAN.md, task 8; data/factionLife.js): Enclave
// columns between Fort Meridian and its posts, checkpoints on the roads, supply convoys to
// escort or raid, the Ministry's sounding parties in the Hush, the Watch against the Redwake
// outside Saltreach, hunters on a wanted name, and cutters on a wanted sailor. The coast
// reacts to the story: the Writ, the harbor's occupation and the war, and the ending at the
// Anchor's Seat decide who marches and who holds the coast.
//
// The events are the host's (they spawn enemies, which guests see as the usual proxies). Their
// props and people reach a guest in a 'wev' message each second; an outcome that falls to a
// guest (standing, silver, a wanted mark) goes to that guest in a 'wevr' and is applied there.
// Squads march by moving each member's home along the route ahead of it: an idle guard walks
// to its home through Enemy.navTo (entities/enemy.js guardIdle), so a moving home is a march at
// a guard's walking pace, and a fight stops it where it stands.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, START_HOOKS, BOOT_HOOKS, ACTIONS } from './hooks.js';
import { Boat } from '../entities/boat.js';
import { ROADS } from '../data/roads.js';
import { FACTIONS, tierOf } from '../data/factions.js';
import { addRep, markWanted, atWar, fineFor, payFine, ensureStanding } from './factions.js';
import {
  COLUMN_ROUTES, COLUMN_RANKS, CHECKPOINTS, CHECKPOINT_GUARDS, CONVOY_ROUTES, CONVOY_ESCORTS, CONVOY_LOOT,
  SOUNDING_HOUSE, SOUNDING_SITES, SKIRMISH_SITES, SKIRMISH_SIDES, HUNTERS, LIFE_TIMING,
} from '../data/factionLife.js';
import { NPC } from '../entities/npc.js';
import { navGrid, navBody, PathSearch } from '../entities/nav.js';
import { DIALOGUES } from '../data/npcs.js';
import { rand, randInt } from '../core/util.js';
import { buildLifeProps, lifeProp, releaseLifeProp } from '../world/lifeProps.js';

// ---------------------------------------------------------------- the story's coast
// Where the story stands, from the character's flags and quests.
export function coastState(ch) {
  const f = (ch && ch.flags) || {}, q = (ch && ch.quests) || {};
  return {
    writArrived: !!q.writ || !!f.writ_answered,
    writ: f.registryPapers ? 'registered' : f.writ_refused ? 'refused' : null,
    occupied: !!f.harbor_occupied && !f.harbor_freed,
    war: !!f.war_enclave,
    freed: !!f.harbor_freed,
    kaelenDown: !!(ch && (ch.bossesDefeated || []).includes('warlord')),
    ending: f.ending || null,
  };
}

// Who holds the coast now: the map's colour and the line in its cartouche.
export function coastHolder(ch) {
  const s = coastState(ch);
  if (s.ending === 'break') return { id: 'watch', color: FACTIONS.watch.color, line: 'The coast is held by the Watch and the towns' };
  if (s.ending === 'seal') return { id: 'ministry', color: FACTIONS.ministry.color, line: 'The coast is held by the Ministry of Soundings' };
  if (s.ending === 'claim') return { id: 'enclave', color: FACTIONS.enclave.color, line: 'The coast is held by the Enclave, in your name' };
  if (s.occupied) return { id: 'enclave', color: FACTIONS.enclave.color, line: 'The Enclave holds Saltreach harbor' };
  if (s.war) return { id: 'contested', color: '#a07050', line: 'The coast is contested: the Watch and the Enclave at war' };
  if (s.writArrived) return { id: 'shared', color: '#8a8ea0', line: 'The Watch keeps Saltreach; the Enclave keeps Meridian' };
  return { id: 'watch', color: FACTIONS.watch.color, line: 'The Watch keeps Saltreach' };
}

// ---------------------------------------------------------------- routes
// A route's points every few metres along its roads, with the distance along it.
const _routes = new Map();
export function routeOf(def) {
  if (_routes.has(def.id)) return _routes.get(def.id);
  const pts = [];
  for (const [id, dir] of def.roads) {
    const road = ROADS.find((r) => r.id === id);
    if (!road) continue;
    const p = dir < 0 ? road.points.slice().reverse() : road.points;
    for (const q of p) if (!pts.length || Math.hypot(q[0] - pts[pts.length - 1][0], q[1] - pts[pts.length - 1][1]) > 0.5) pts.push([q[0], q[1]]);
  }
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const route = { def, pts, s, length: s[s.length - 1] };
  _routes.set(def.id, route);
  return route;
}
// The point `d` metres along a route, and the way it runs there.
export function routeAt(route, d, out = {}) {
  const { pts, s } = route;
  d = Math.max(0, Math.min(route.length, d));
  let i = 1;
  while (i < s.length - 1 && s[i] < d) i++;
  const t = (d - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1]);
  const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
  out.x = ax + (bx - ax) * t;
  out.z = az + (bz - az) * t;
  out.yaw = Math.atan2(bx - ax, bz - az);
  return out;
}
// How far along a route a point lies, and how far off it.
export function routeNear(route, x, z) {
  let best = { d: 0, off: Infinity };
  const { pts, s } = route;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const off = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (off < best.off) best = { d: s[i - 1] + Math.sqrt(L2) * t, off };
  }
  return best;
}

// ---------------------------------------------------------------- squads
const ground = (x, z, y = 400) => G.world.groundAt(x, z, y);
// Members walk two abreast behind the leader: their places round a point heading `yaw`.
function slot(i, n, wide = 1.1, deep = 2.4) {
  if (i === 0) return [0, 0];
  const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
  return [side * wide, -row * deep];
}
function placeSquad(ev, x, z, yaw, y) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  ev.members.forEach((e, i) => {
    if (e.dead) return;
    const [lx, lz] = ev.slots ? ev.slots[i] : slot(i, ev.members.length);
    const hx = x + lx * c + lz * s, hz = z - lx * s + lz * c;
    e.home.set(hx, ground(hx, hz, (y ?? e.pos.y) + 3), hz);
  });
}
function spawnSquad(game, types, x, z, yaw, opts = {}) {
  const out = [];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  types.forEach((type, i) => {
    const [lx, lz] = opts.slots ? opts.slots[i] : slot(i, types.length);
    const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
    const e = game.spawnEnemy(type, new THREE.Vector3(px, ground(px, pz) + 0.1, pz), { scaleTo: opts.scaleTo, face: yaw });
    e.lifeEvent = opts.ev || null;
    out.push(e);
  });
  return out;
}
const alive = (ev) => ev.members.filter((e) => !e.dead && G.actors.includes(e));
const anyAggro = (ev) => alive(ev).some((e) => e.aggro);
// Near their places: the march goes on only while the squad keeps up. A member stalled short of
// its place (on a bank above the road, behind a wall the grid can't round) is not waited for:
// its place moves on along the road and it follows when it can. One still closing in is.
function together(ev) {
  const t = now();
  const keep = (ev.keep ||= new Map());
  return alive(ev).every((e) => {
    const d = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
    if (d < 5) {
      keep.delete(e);
      return true;
    }
    const k = keep.get(e);
    if (!k || d < k.d - 0.5) {
      keep.set(e, { d, t });
      return false;
    }
    return t - k.t > 3;
  });
}
function dismiss(ev) {
  for (const e of ev.members || []) if (!e.dead) e.despawn = true;
  for (const e of ev.foes || []) if (!e.dead) e.despawn = true;
}

// Everyone playing: ourselves and LAN friends, with their standing (a friend's arrives through
// game.netExt as `fx`).
function players(game) {
  return game.playerActors().map((a) => ({ actor: a, local: a === game.player, st: a === game.player ? game.ch : a.netExt?.fx || null }));
}
// The player nearest a point, and how far: an event lasts while anyone playing is near it, and
// what it says or marks goes to whoever earned it.
function nearestPlayer(game, x, z) {
  let q = null, d = Infinity;
  for (const o of players(game)) {
    const k = Math.hypot(o.actor.pos.x - x, o.actor.pos.z - z);
    if (k < d) { d = k; q = o; }
  }
  return { q, d };
}
const nearestD = (game, x, z) => nearestPlayer(game, x, z).d;
const repOf = (st, f) => (st && st.rep ? st.rep[f] ?? 0 : 0);
const wantedBy = (st, f) => !!(st && st.wanted && st.wanted[f] > 0);
const hostileTo = (st, f) => wantedBy(st, f) || repOf(st, f) <= -50 || !!(st && (st.war?.[f] || st.flags?.[`war_${f}`]));

// An outcome for one player: applied here for ourselves, sent to a friend for theirs.
function reward(game, who, r) {
  if (who === game.player) return applyReward(game, r);
  if (G.net && G.net.isHost && who.peerId != null) G.net.send({ t: 'wevr', to: who.peerId, r });
}
function applyReward(game, r) {
  const ch = game.ch;
  if (!ch) return;
  for (const [f, n] of r.rep || []) addRep(ch, f, n);
  for (const [f, secs] of r.wanted || []) markWanted(ch, f, secs);
  if (r.silver) G.player.addSilver(r.silver);
  if (r.xp) G.player.addXp(r.xp);
  for (const [id, n] of r.items || []) game.giveItem(id, n);
  if (r.toast) G.ui.toast(r.toast, r.kind || 'good');
  if (r.stat) ch.stats[r.stat] = (ch.stats[r.stat] || 0) + 1;
  // what the deed was, for the contract boards (game/contracts.js)
  if (r.outcome) ACTIONS.lifeOutcome?.(r.outcome);
  if (r.save) game.save();
}

// ---------------------------------------------------------------- the director
export const LIFE = { active: [], timers: {}, nextId: 1, wantedTime: {}, guestWanted: new WeakMap(), cleared: new Map(), guest: new Map() };
const KINDS = {};
const now = () => G.time || 0;

function nearest(defs, route, x, z, pick) {
  let best = null, bd = Infinity;
  for (const d of defs) {
    if (pick && !pick(d)) continue;
    const r = route ? routeNear(routeOf(d), x, z).off : Math.hypot(d.at[0] - x, d.at[1] - z);
    if (r < bd) { bd = r; best = d; }
  }
  return best ? { def: best, dist: bd } : null;
}

function startEvent(game, kind, ev) {
  ev.id = LIFE.nextId++;
  ev.kind = kind;
  ev.t0 = now();
  LIFE.active.push(ev);
  return ev;
}
function endEvent(game, ev, why = '') {
  const i = LIFE.active.indexOf(ev);
  if (i >= 0) LIFE.active.splice(i, 1);
  dismiss(ev);
  // what a kind put in the world of its own (a boat at sea) goes with it
  try { KINDS[ev.kind]?.end?.(game, ev); } catch (e) { console.error('[world life] end', ev.kind, e); }
  for (const p of ev.props || []) releaseLifeProp(p);
  if (ev.interact) {
    const j = game.world.interactables.indexOf(ev.interact);
    if (j >= 0) game.world.interactables.splice(j, 1);
  }
  if (ev.onEnd) ev.onEnd(why);
}

UPDATE_HOOKS.push((game, dt) => {
  const p = game.player;
  if (!p || !game.ch || game.state !== 'playing') return;
  ensureStanding(game.ch);
  // how long each faction has had our name
  for (const f in FACTIONS) LIFE.wantedTime[f] = wantedBy(game.ch, f) ? (LIFE.wantedTime[f] || 0) + dt : 0;
  if (game.net && game.net.isGuest) return guestTick(game, dt);
  // and how long each faction has had each friend's (the host sends the hunters)
  for (const q of players(game)) {
    if (q.local) continue;
    const w = LIFE.guestWanted.get(q.actor) || {};
    for (const f in FACTIONS) w[f] = wantedBy(q.st, f) ? (w[f] || 0) + dt : 0;
    LIFE.guestWanted.set(q.actor, w);
  }
  for (const ev of LIFE.active.slice()) {
    try {
      if (KINDS[ev.kind].tick(game, ev, dt)) endEvent(game, ev, 'done');
    } catch (e) {
      console.error('[world life]', ev.kind, e);
      endEvent(game, ev, 'error');
    }
  }
  if (game.inRift || game.inDungeon) return;
  for (const kind of Object.keys(KINDS)) {
    const k = KINDS[kind];
    LIFE.timers[kind] = (LIFE.timers[kind] ?? rand(30, 90)) - dt;
    if (LIFE.timers[kind] > 0) continue;
    LIFE.timers[kind] = k.retry ?? 15;
    if (LIFE.active.filter((e) => e.kind === kind).length >= (k.max ?? 1)) continue;
    const ev = k.start(game);
    if (ev) {
      startEvent(game, kind, ev);
      const every = LIFE_TIMING[kind]?.every;
      LIFE.timers[kind] = every ? rand(every[0], every[1]) : k.retry ?? 15;
    }
  }
  if (game.net && game.net.isHost && game.net.avatars.size) sendState(game, dt);
});

// the props are built behind the menu, so the warm-up uploads them with the world
BOOT_HOOKS.push((game) => buildLifeProps(game.world));

START_HOOKS.push((game) => {
  for (const ev of LIFE.active.slice()) endEvent(game, ev, 'restart');
  LIFE.timers = {};
  LIFE.wantedTime = {};
  LIFE.cleared.clear();
  buildLifeProps(game.world);
  ensureOfficers(game);
});

// ---------------------------------------------------------------- columns
KINDS.column = {
  start(game) {
    const ch = game.ch, s = coastState(ch), p = game.player;
    if (s.ending === 'break') return null;
    const near = nearest(COLUMN_ROUTES, true, p.pos.x, p.pos.z, (d) => !d.story || (s.writArrived && !s.freed) || s.war);
    if (!near || near.dist > LIFE_TIMING.column.near) return null;
    const route = routeOf(near.def);
    // from out of sight up the road, so it marches past where the player is
    const at = routeNear(route, p.pos.x, p.pos.z).d;
    const fwd = Math.random() < 0.5 || at < 140;
    const d0 = fwd ? Math.max(0, at - rand(120, 170)) : Math.min(route.length, at + rand(120, 170));
    const a = routeAt(route, d0);
    if (Math.hypot(a.x - p.pos.x, a.z - p.pos.z) < 80) return null;
    const ranks = s.war ? COLUMN_RANKS.war : COLUMN_RANKS.peace;
    const ev = { route, d: d0, dir: fwd ? 1 : -1, speed: 2.3, members: [], heard: false };
    ev.members = spawnSquad(game, ranks, a.x, a.z, a.yaw + (fwd ? 0 : Math.PI), { ev });
    return ev;
  },
  tick(game, ev, dt) {
    const live = alive(ev);
    if (!live.length) return true;
    const lead = live[0];
    const far = nearestD(game, lead.pos.x, lead.pos.z);
    if (far > 460) return true;
    // a wanted or hated name close by: the column turns off the road for it
    const quarry = players(game).find((q) => hostileTo(q.st, 'enclave') && Math.hypot(q.actor.pos.x - lead.pos.x, q.actor.pos.z - lead.pos.z) < 130);
    if (quarry) {
      if (!ev.hunting) reward(game, quarry.actor, { toast: 'The column breaks step and turns toward you.', kind: 'bad' });
      ev.hunting = true;
      const q = quarry.actor.pos;
      placeSquad(ev, q.x, q.z, Math.atan2(q.x - lead.pos.x, q.z - lead.pos.z));
      return false;
    }
    if (ev.hunting) ev.hunting = false;
    if (!ev.heard && far < 90) {
      ev.heard = true;
      G.audio?.play('lifeDrum', { pos: lead.pos, vol: 0.8 });
      ACTIONS.tip?.('checkpoints');
    }
    if (!anyAggro(ev) && together(ev)) ev.d += ev.dir * ev.speed * dt;
    const a = routeAt(ev.route, ev.d);
    placeSquad(ev, a.x, a.z, a.yaw + (ev.dir < 0 ? Math.PI : 0));
    // at the road's end the column goes in at its post
    return (ev.d <= 0 || ev.d >= ev.route.length) && far > 60;
  },
};

// ---------------------------------------------------------------- checkpoints
// The officers stand at their posts from the start, shown only while their checkpoint is up.
function ensureOfficers(game) {
  if (game._lifeOfficers) return;
  game._lifeOfficers = true;
  for (const cp of CHECKPOINTS) {
    const at = checkpointAt(cp);
    const look = cp.faction === 'watch'
      ? { skin: '#c8956a', hair: '#3a2a1a', outfit: { main: '#9aa3ad', trim: '#2a4a7a', pants: '#2a3a5a', boots: '#2a2a2e' }, armored: true, helm: '#8a929c' }
      : { skin: '#d8b090', hair: '#1a1410', outfit: { main: '#26262c', trim: '#8e1f24', pants: '#1c1c22', boots: '#121216' }, armored: true };
    const id = 'life_' + cp.id;
    const npc = new NPC({
      id, name: cp.faction === 'watch' ? 'Watch Sergeant' : 'Enclave Tollman', title: cp.name, x: at.ox, z: at.oz, yaw: at.yaw + Math.PI / 2, look,
      when: () => LIFE.active.some((e) => e.kind === 'checkpoint' && e.def === cp) || LIFE.guest.has('cp:' + cp.id),
    });
    game.npcs.push(npc);
  }
}
for (const cp of CHECKPOINTS) DIALOGUES['life_' + cp.id] = (api) => checkpointTalk(G.game, cp, api);
// where a checkpoint stands on its road: the barricade across it and the officer at its side
function checkpointAt(cp) {
  const route = routeOf({ id: 'road:' + cp.road, roads: [[cp.road, 1]] });
  const d = routeNear(route, cp.at[0], cp.at[1]).d;
  const a = routeAt(route, d);
  const c = Math.cos(a.yaw), s = Math.sin(a.yaw);
  return { route, d, x: a.x, z: a.z, yaw: a.yaw, ox: a.x + c * 3.2, oz: a.z - s * 3.2 };
}
// who is stopped at a checkpoint: low standing or a wanted name; at Saltreach after the Writ,
// whoever refused it; never the Honored
function stops(cp, st) {
  const f = cp.faction, rep = repOf(st, f);
  if (st?.war?.[f] || st?.flags?.[`war_${f}`]) return true;
  if (rep >= 40) return false;
  if (wantedBy(st, f) || rep <= -10) return true;
  if (f === 'enclave' && st?.flags?.writ_refused && cp.story === 'writ') return true;
  return false;
}
function checkpointToll(game, cp) {
  return Math.round(FACTIONS[cp.faction].fineBase * 0.5 + (game.ch.level || 1) * 3);
}
function clear(cp, secs = 600) {
  LIFE.cleared.set(cp.id, now() + secs);
}
const cleared = (cp) => (LIFE.cleared.get(cp.id) || 0) > now();
function checkpointTalk(game, cp, api) {
  const ch = game.ch, f = cp.faction, fac = FACTIONS[f];
  const bye = { label: 'Leave.' };
  if (cleared(cp)) return { text: 'You have been seen to. Go on.', options: [bye] };
  if (repOf(ch, f) >= 40) return { text: `${fac.short[0].toUpperCase() + fac.short.slice(1)} know you. Pass, friend.`, options: [{ label: 'Thank you.', do: () => clear(cp) }] };
  if (atWar(ch, f)) return { text: 'No words for you. Take them.', options: [{ label: 'Then fight.', do: () => provoke(game, cp) }] };
  const toll = checkpointToll(game, cp);
  const opts = [];
  if (wantedBy(ch, f)) {
    const fine = fineFor(ch, f);
    opts.push({ label: `Pay your fine (${fine} silver).`, do: () => { if (payFine(ch, f)) clear(cp); else G.ui.toast('You cannot pay that.', 'bad'); } });
  } else {
    opts.push({ label: `Pay the toll (${toll} silver).`, do: () => {
      if (ch.silver < toll) return G.ui.toast('You cannot pay the toll.', 'bad');
      ch.silver -= toll;
      G.audio?.play('coin');
      clear(cp);
      G.ui.toast(`You pay ${toll} silver and are waved on.`, 'good');
    } });
    if (f === 'enclave' && ch.flags?.registryPapers) opts.push({ label: 'Show your papers.', do: () => { clear(cp); G.ui.toast('The tollman reads your name in the Registry and waves you on.', 'good'); } });
  }
  opts.push({ label: 'Refuse.', do: () => provoke(game, cp) });
  opts.push(bye);
  const why = wantedBy(ch, f) ? 'Your name is on our list.' : f === 'enclave' && ch.flags?.writ_refused ? 'Unregistered. That costs on this road.' : 'Your name is not well spoken of here.';
  return { text: `Halt. ${why} ${wantedBy(ch, f) ? 'Settle it, or turn back.' : 'The toll, or turn back.'}`, options: opts };
}
function provoke(game, cp) {
  markWanted(game.ch, cp.faction, 180);
  addRep(game.ch, cp.faction, -10);
  G.ui.toast(`You refused ${FACTIONS[cp.faction].short} at ${cp.name}.`, 'bad');
}
KINDS.checkpoint = {
  max: 2,
  retry: 4,
  start(game) {
    const p = game.player, s = coastState(game.ch);
    if (s.ending === 'claim' || s.ending === 'break') return null;
    for (const cp of CHECKPOINTS) {
      if (LIFE.active.some((e) => e.kind === 'checkpoint' && e.def === cp)) continue;
      if (cp.story === 'writ' && !(s.writArrived && !s.freed && !s.war)) continue;
      const at = checkpointAt(cp);
      const d = Math.hypot(at.x - p.pos.x, at.z - p.pos.z);
      if (d > LIFE_TIMING.checkpoint.near || d < 45) continue;
      if (!players(game).some((q) => stops(cp, q.st))) continue;
      const ev = { def: cp, at, members: [], props: [], sides: new Map() };
      const types = CHECKPOINT_GUARDS[cp.faction];
      const c = Math.cos(at.yaw), sn = Math.sin(at.yaw);
      ev.slots = [[-3.2, 1.5], [3.2, 1.5]];
      ev.members = spawnSquad(game, types, at.x, at.z, at.yaw, { slots: ev.slots, ev });
      for (const e of ev.members) e.postYaw = at.yaw + Math.PI;
      ev.props.push(lifeProp(cp.faction === 'watch' ? 'barricade_watch' : 'barricade_enclave', at.x, ground(at.x, at.z), at.z, at.yaw + Math.PI / 2));
      void c; void sn;
      return ev;
    }
    return null;
  },
  tick(game, ev, dt) {
    const p = game.player, { at, def } = ev;
    const d = nearestD(game, at.x, at.z);
    // its guard put down: the checkpoint is broken, to the credit of whoever struck them
    if (!ev.broken && ev.members.length && !alive(ev).length) {
      ev.broken = true;
      const who = new Set(ev.members.map((e) => e.lastAttacker).filter((a) => a && (a === game.player || a.isRemote)));
      for (const a of who) reward(game, a, { toast: `${def.name[0].toUpperCase() + def.name.slice(1)} is broken.`, kind: 'quest', outcome: { kind: 'checkpoint', cp: def.id }, save: true });
      ev.t0 = Math.min(ev.t0, now() - 690); // the barricade stands a little longer, then is gone
    }
    ev.far = d > 260 ? (ev.far || 0) + dt : 0;
    if (ev.far > 20 || now() - ev.t0 > 720) return true;
    placeSquad(ev, at.x, at.z, at.yaw);
    // running the checkpoint: across the barricade's line without being seen to
    checkRun(game, ev, def, at);
    // each player it stops is hailed once as they come up (a friend's toll is paid on their own
    // machine, at the officer they see there)
    ev.hailed ||= new Set();
    for (const q of players(game)) {
      if (ev.hailed.has(q.actor) || Math.hypot(at.x - q.actor.pos.x, at.z - q.actor.pos.z) > 26 || !stops(def, q.st) || (q.local && cleared(def))) continue;
      ev.hailed.add(q.actor);
      if (q.local) {
        G.audio?.play('lifeHail', { pos: new THREE.Vector3(at.x, p.pos.y, at.z), vol: 0.9 });
        ACTIONS.tip?.('checkpoints');
      }
      reward(game, q.actor, { toast: `Halt! ${FACTIONS[def.faction].name} stop you at ${def.name}.`, kind: 'bad' });
    }
    return false;
  },
};
function checkRun(game, ev, def, at) {
  const p = game.player;
  const along = (p.pos.x - at.x) * Math.sin(at.yaw) + (p.pos.z - at.z) * Math.cos(at.yaw);
  const across = Math.abs((p.pos.x - at.x) * Math.cos(at.yaw) - (p.pos.z - at.z) * Math.sin(at.yaw));
  if (Math.abs(along) > 40 || across > 14) { ev.side = null; return; }
  const side = Math.sign(along) || 1;
  if (ev.side == null) ev.side = Math.abs(along) > 6 ? side : null;
  else if (side !== ev.side && Math.abs(along) > 5 && stops(def, game.ch) && !cleared(def) && !ev.ran) {
    ev.ran = true;
    markWanted(game.ch, def.faction, 180);
    G.ui.toast(`You ran ${def.name}. ${FACTIONS[def.faction].name} mark your name.`, 'bad');
  }
}

// ---------------------------------------------------------------- supply convoys
KINDS.convoy = {
  start(game) {
    const p = game.player, s = coastState(game.ch);
    const near = nearest(CONVOY_ROUTES, true, p.pos.x, p.pos.z, (d) => !(d.faction === 'enclave' && s.ending === 'break') && !(d.faction === 'watch' && s.occupied));
    if (!near || near.dist > LIFE_TIMING.convoy.near) return null;
    const route = routeOf(near.def);
    const at = routeNear(route, p.pos.x, p.pos.z).d;
    const d0 = Math.max(0, at - rand(110, 150));
    if (route.length - d0 < 120) return null;
    const a = routeAt(route, d0);
    if (Math.hypot(a.x - p.pos.x, a.z - p.pos.z) < 70) return null;
    const f = near.def.faction;
    const escorts = s.war && f === 'enclave' ? [...CONVOY_ESCORTS[f], 'peacekeeper', 'peacekeeper'] : CONVOY_ESCORTS[f];
    const ev = { def: near.def, route, d: d0, speed: 2.1, members: [], props: [], foes: [], credit: new Map(), ambushAt: rand(0.35, 0.6) * route.length, state: 'moving' };
    ev.slots = escorts.map((_, i) => [i % 2 ? 1.6 : -1.6, (i < 2 ? 3 : -3.5) - Math.floor(i / 4) * 2]);
    ev.members = spawnSquad(game, escorts, a.x, a.z, a.yaw, { slots: ev.slots, ev });
    ev.cart = lifeProp('cart', a.x, ground(a.x, a.z), a.z, a.yaw);
    ev.props.push(ev.cart);
    G.ui.toast(`${FACTIONS[f].name} have a convoy on ${near.def.name.includes('for') ? 'the road' : 'the road'}: ${near.def.name}.`, 'quest');
    G.audio?.play('lifeHorn', { pos: new THREE.Vector3(a.x, p.pos.y, a.z), vol: 0.7 });
    return ev;
  },
  tick(game, ev, dt) {
    const p = game.player, f = ev.def.faction;
    const cart = ev.cart.object;
    const live = alive(ev);
    const c = cart.position;
    // who keeps with it, and for how long
    for (const q of players(game)) {
      const near = Math.hypot(q.actor.pos.x - c.x, q.actor.pos.z - c.z) < 45;
      const r = ev.credit.get(q.actor) || { near: 0, total: 0, joined: false, fought: false, raided: false };
      if (near) r.joined = true;
      if (r.joined && ev.state === 'moving') { r.total += dt; if (near) r.near += dt; }
      ev.credit.set(q.actor, r);
    }
    for (const e of ev.members) {
      if (!e.dead || e._lifeCounted) continue;
      e._lifeCounted = true;
      const who = e.lastAttacker;
      if (who && (who === game.player || who.isRemote)) {
        const r = ev.credit.get(who) || { near: 0, total: 0, joined: true, fought: false, raided: false };
        r.raided = true;
        ev.credit.set(who, r);
      }
    }
    if (ev.state === 'moving') {
      if (!live.length) {
        // the escorts are down: by whose hand?
        const raiders = [...ev.credit.entries()].filter(([, r]) => r.raided);
        ev.state = raiders.length ? 'raided' : 'lost';
        if (ev.state === 'raided') for (const [who] of raiders) reward(game, who, { wanted: [[f, 300]], rep: [[f, -12]], toast: 'The convoy is yours. So is the bounty on your head.', kind: 'bad', save: true });
        else G.ui.toast('The convoy is lost.', 'bad');
        openCart(game, ev);
        return false;
      }
      // the ambush, once, where the road is lonely
      if (!ev.ambushed && ev.d >= ev.ambushAt && nearestD(game, c.x, c.z) < 90) {
        ev.ambushed = true;
        const a = routeAt(ev.route, ev.d + 24);
        ev.foes = spawnSquad(game, ev.def.raiders, a.x, a.z, a.yaw + Math.PI, { scaleTo: Math.max(game.ch.level, 4) });
        ev.foes.forEach((e, i) => e.setAggro(live[i % live.length]));
        G.ui.toast('Raiders on the road ahead of the convoy!', 'bad');
      }
      if (!anyAggro(ev) && together(ev) && !ev.foes.some((e) => !e.dead && G.actors.includes(e))) ev.d += ev.speed * dt;
      const a = routeAt(ev.route, ev.d);
      placeSquad(ev, a.x, a.z, a.yaw);
      c.set(a.x, ground(a.x, a.z, c.y + 2), a.z);
      ev.cart.object.rotation.y = a.yaw;
      ev.cart.dirty = true;
      if (ev.d >= ev.route.length - 2) {
        ev.state = 'arrived';
        for (const [who, r] of ev.credit) {
          if (r.joined && r.total > 0 && r.near / r.total >= 0.6 && !r.raided) reward(game, who, { rep: [[f, 6]], silver: 40 + 6 * (game.ch.level || 1), xp: 60 + 15 * (game.ch.level || 1), toast: `The convoy is in. ${FACTIONS[f].name} thank you for the escort.`, stat: 'escorts', outcome: { kind: 'escort', faction: f }, save: true });
        }
        return true;
      }
      if (nearestD(game, c.x, c.z) > 480) return true;
      return false;
    }
    // raided or lost: the cart waits to be opened, then is gone
    return now() - (ev.openedAt || ev.t0 + 1e9) > 4 || nearestD(game, c.x, c.z) > 300 || now() - ev.t0 > 900;
  },
};
// mark a player as having struck the convoy's escort (game.js funnels guard hits through
// ACTIONS.onHitGuard; a friend's hits are resolved here on the host with the friend as attacker)
const prevHitGuard = ACTIONS.onHitGuard;
ACTIONS.onHitGuard = (guard, attacker) => {
  if (prevHitGuard) prevHitGuard(guard, attacker);
  const ev = guard.lifeEvent;
  if (ev && ev.kind === 'convoy' && ev.credit) {
    const r = ev.credit.get(attacker) || { near: 0, total: 0, joined: true, fought: false, raided: false };
    r.raided = true;
    ev.credit.set(attacker, r);
  }
};
function openCart(game, ev) {
  const f = ev.def.faction, c = ev.cart.object.position;
  const it = game.world.addInteract({
    // its own kind: the game's 'chest' kind opens a placed chest, not this
    id: 'life_cart_' + ev.id, kind: 'life_cart', pos: c.clone().add(new THREE.Vector3(0, 0.8, 0)), radius: 3,
    label: ev.state === 'raided' ? 'Break open the cart' : 'Salvage the cart',
    enabled: () => !ev.openedAt,
    use: () => {
      ev.openedAt = now();
      const k = ev.state === 'raided' ? 1 : 0.5;
      const silver = Math.round((60 + 8 * (game.ch.level || 1)) * k);
      const items = CONVOY_LOOT[f].map(([id, n]) => [id, Math.max(1, Math.round(n * k))]);
      applyReward(game, { silver, items, toast: `The cart's stores: ${silver} silver and supplies.`, save: true });
      G.audio?.play('chest', { pos: c });
    },
  });
  ev.interact = it;
}

// ---------------------------------------------------------------- the Ministry's soundings
KINDS.sounding = {
  start(game) {
    const p = game.player, s = coastState(game.ch);
    const site = SOUNDING_SITES[randInt(0, SOUNDING_SITES.length - 1)];
    const [hx, hz] = SOUNDING_HOUSE;
    // the party is seen setting out from the Sounding House, or met on the moor
    const dFromHouse = Math.hypot(p.pos.x - hx, p.pos.z - hz), dSite = Math.hypot(p.pos.x - site.at[0], p.pos.z - site.at[1]);
    if (Math.min(dFromHouse, dSite) > LIFE_TIMING.sounding.near) return null;
    const yaw = Math.atan2(site.at[0] - hx, site.at[1] - hz);
    const ev = { def: site, from: [hx, hz], d: 0, length: Math.hypot(site.at[0] - hx, site.at[1] - hz), yaw, speed: 2.0, members: [], phase: 'walk', watch: new Map(), open: s.ending === 'seal' };
    ev.members = spawnSquad(game, ['ministry_soundsman', 'ministry_soundsman', 'ministry_silencer'], hx + Math.sin(yaw) * 6, hz + Math.cos(yaw) * 6, yaw, { ev });
    return ev;
  },
  tick(game, ev, dt) {
    const live = alive(ev);
    if (!live.length) return true;
    const lead = live[0];
    const { q: close, d: dP } = nearestPlayer(game, lead.pos.x, lead.pos.z);
    if (dP > 420) return true;
    const trusted = (q) => repOf(q.st, 'ministry') >= 10 || ev.open;
    if (ev.phase === 'walk') {
      // they do not want to be followed: whoever comes too close is warned, then marked
      if (close && !trusted(close) && dP < 18) {
        if (!ev.warned) { ev.warned = true; reward(game, close.actor, { toast: 'A soundsman turns: "This is not for you. Turn back."', kind: 'bad' }); }
        ev.close = (ev.close || 0) + dt;
        if (ev.close > 4 && !ev.provoked) {
          ev.provoked = true;
          reward(game, close.actor, { wanted: [['ministry', 120]], toast: 'The soundsmen draw on you.', kind: 'bad' });
        }
      }
      if (!anyAggro(ev) && together(ev)) ev.d += ev.speed * dt;
      const t = Math.min(1, (ev.d + 6) / ev.length);
      const x = ev.from[0] + (ev.def.at[0] - ev.from[0]) * t, z = ev.from[1] + (ev.def.at[1] - ev.from[1]) * t;
      placeSquad(ev, x, z, ev.yaw);
      if (t >= 1) { ev.phase = 'sound'; ev.soundT = 0; ev.bellT = 0; }
      return false;
    }
    // sounding: a minute of the line going down and the bell answering
    ev.soundT += dt;
    ev.bellT -= dt;
    const at = new THREE.Vector3(ev.def.at[0], ground(...ev.def.at), ev.def.at[1]);
    if (ev.bellT <= 0) {
      ev.bellT = 10;
      G.audio?.play('bell', { pos: at, vol: 0.9, pitch: 0.7 });
      G.vfx?.ring?.(at, 'umbra', 6, 0.8, { color: '#b8bce8' });
    }
    for (const q of players(game)) {
      const d = Math.hypot(q.actor.pos.x - at.x, q.actor.pos.z - at.z);
      const r = ev.watch.get(q.actor) || 0;
      ev.watch.set(q.actor, r + (d < 60 && (d > 16 || trusted(q)) ? dt : 0));
    }
    if (ev.soundT >= 60) {
      for (const [who, secs] of ev.watch) {
        if (secs < 40 || ev.provoked) continue;
        const st = who === game.player ? game.ch : who.netExt?.fx;
        reward(game, who, {
          xp: 120 + 30 * (game.ch.level || 1), stat: 'soundings', save: true, outcome: { kind: 'witness', faction: 'ministry' },
          rep: repOf(st, 'ministry') >= 10 ? [['ministry', 4]] : [],
          toast: `You watched the Ministry sound ${ev.def.name}: the line paid out, the bell answered from below, and they wrote down how long it took.`,
        });
      }
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- the Watch against the Redwake
KINDS.skirmish = {
  start(game) {
    const p = game.player, s = coastState(game.ch);
    // the Watch has no men to spare while the harbor is occupied; the Enclave none on the roads
    // after the chain is broken
    const near = nearest(SKIRMISH_SITES, false, p.pos.x, p.pos.z, (d) => ((d.side || 'watch') === 'watch' ? !s.occupied : s.ending !== 'break'));
    if (!near || near.dist > LIFE_TIMING.skirmish.near || near.dist < 50) return null;
    if (s.kaelenDown && Math.random() < 0.5) return null;
    const [x, z] = near.def.at;
    const side = near.def.side || 'watch';
    const yaw = Math.atan2(p.pos.x - x, p.pos.z - z);
    const ev = { def: near.def, side, members: [], foes: [], credit: new Map() };
    ev.members = spawnSquad(game, SKIRMISH_SIDES[side], x - Math.sin(yaw) * 5, z - Math.cos(yaw) * 5, yaw, { ev });
    ev.foes = spawnSquad(game, s.kaelenDown ? ['brigand', 'brigand_cutthroat'] : ['brigand', 'brigand_cutthroat', 'brigand_brute'], x + Math.sin(yaw) * 5, z + Math.cos(yaw) * 5, yaw + Math.PI, { scaleTo: Math.max(game.ch.level, 4) });
    ev.foes.forEach((e, i) => e.setAggro(ev.members[i % ev.members.length]));
    for (const q of players(game)) if (Math.hypot(q.actor.pos.x - x, q.actor.pos.z - z) < 260) reward(game, q.actor, { toast: `Steel on ${near.def.name}: ${FACTIONS[side].short} and the Redwake are at it.`, kind: 'quest' });
    return ev;
  },
  tick(game, ev) {
    const watch = alive(ev), foes = ev.foes.filter((e) => !e.dead && G.actors.includes(e));
    const [x, z] = ev.def.at;
    if (nearestD(game, x, z) > 360) return true;
    // the winners pay whoever fought on their side
    const struck = (list, q) => list.some((e) => e.lastAttacker === q.actor);
    if (!foes.length && !ev.done) {
      ev.done = true;
      const side = ev.side || 'watch';
      for (const q of players(game)) if (struck(ev.foes, q)) reward(game, q.actor, { rep: [[side, 4]], silver: 15 + 3 * (game.ch.level || 1), toast: `The Redwake are broken. ${FACTIONS[side].name} press their purse on you.`, save: true });
      return true;
    }
    if (!watch.length && !ev.done) {
      ev.done = true;
      for (const q of players(game)) if (struck(ev.members, q)) reward(game, q.actor, { silver: 25 + 4 * (game.ch.level || 1), toast: 'The Redwake share their take with you.', kind: 'bad', save: true });
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- hunters
// Hunters set out from behind the player, out of sight, and only from a place they can walk to
// the player from: the places are tried in turn while the grid searches a route from each,
// within the navigation budget of each step, before anyone is spawned.
const HUNT_FROM = 110;
const HUNT_BODY = navBody({ radius: 0.42, height: 1.8 });
function scoutHunters(game, ev) {
  const p = ev.quarry, sc = ev.scout;
  const grid = navGrid(game.world, G.time);
  if (!sc.search) {
    while (sc.tries.length && !sc.search) {
      const a = sc.tries.shift();
      const x = p.pos.x + Math.sin(a) * HUNT_FROM, z = p.pos.z + Math.cos(a) * HUNT_FROM;
      if (game.world.terrain.heightAt(x, z) < 0.5) continue;
      sc.at = [x, z, a];
      sc.search = new PathSearch(grid, x, z, ground(x, z), p.pos.x, p.pos.z, p.pos.y, HUNT_BODY);
    }
    if (!sc.search) {
      // nowhere to come from: the hunt waits a little and tries again
      LIFE.timers.hunters = 20;
      return true;
    }
  }
  if (!sc.search.run()) return false;
  const r = sc.search.result;
  sc.search = null;
  if (!r || !r.complete) return false;
  const [x, z, a] = sc.at;
  ev.scout = null;
  const war = coastState(game.ch).war && ev.faction === 'enclave';
  const types = war ? [...HUNTERS[ev.faction].types, 'peacekeeper'] : HUNTERS[ev.faction].types;
  ev.members = spawnSquad(game, types, x, z, a + Math.PI, { ev });
  reward(game, ev.quarry, { toast: `You are being followed: ${HUNTERS[ev.faction].name} carry your warrant.`, kind: 'bad' });
  if (ev.quarry === game.player) {
    G.audio?.play('lifeHunt', { vol: 0.8 });
    ACTIONS.tip?.('hunters');
  }
  return false;
}
KINDS.hunters = {
  // after the first player, ourselves first, whose name has been marked too long or is hated
  start(game) {
    for (const q of players(game)) {
      if (q.local ? q.actor.boat || game.inRift : q.actor.pos.x > 3000) continue;
      const wt = q.local ? LIFE.wantedTime : LIFE.guestWanted.get(q.actor) || {};
      const f = Object.keys(HUNTERS).find((k) => (wt[k] || 0) > LIFE_TIMING.hunters.after || repOf(q.st, k) <= -50);
      if (!f) continue;
      // from behind, out of sight: straight back first, then wider either side
      // the way they face: the camera's for ourselves, the avatar's for a friend
      const yaw = q.local ? game.camYaw : q.actor.yaw ?? 0;
      const back = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
      const tries = [0, 0.7, -0.7, 1.4, -1.4].map((o) => back + o + rand(-0.25, 0.25));
      return { faction: f, quarry: q.actor, members: [], trackT: 0, scout: { tries, search: null } };
    }
    return null;
  },
  tick(game, ev, dt) {
    const q = players(game).find((o) => o.actor === ev.quarry);
    if (!q) return true; // the quarry has left the game
    const p = q.actor, f = ev.faction;
    const away = q.local ? game.inRift || !!p.boat : p.pos.x > 3000;
    if (ev.scout) return away ? true : scoutHunters(game, ev);
    const live = alive(ev);
    if (!live.length) return true;
    const lead = live[0];
    const d = Math.hypot(lead.pos.x - p.pos.x, lead.pos.z - p.pos.z);
    if (!ev.leaving && !(wantedBy(q.st, f) || repOf(q.st, f) <= -50)) {
      ev.leaving = now();
      reward(game, p, { toast: 'The hunters lower their warrant and turn back.' });
    }
    if (!ev.leaving && (d > 280 || away && d > 120)) {
      ev.leaving = now();
      reward(game, p, { toast: "You've lost the hunters." });
    }
    if (ev.leaving) {
      const away = Math.atan2(lead.pos.x - p.pos.x, lead.pos.z - p.pos.z);
      placeSquad(ev, lead.pos.x + Math.sin(away) * 30, lead.pos.z + Math.cos(away) * 30, away);
      return now() - ev.leaving > 15 && d > 50;
    }
    ev.trackT -= dt;
    if (ev.trackT <= 0) {
      ev.trackT = 2;
      placeSquad(ev, p.pos.x, p.pos.z, Math.atan2(p.pos.x - lead.pos.x, p.pos.z - lead.pos.z));
    }
    return false;
  },
};

// ---------------------------------------------------------------- Enclave cutters
KINDS.cutter = {
  start(game) {
    const p = game.player, b = p.boat, s = coastState(game.ch);
    if (!b || b.driver !== p || b.autopilot || s.ending === 'break' || s.ending === 'claim') return null;
    if (!(wantedBy(game.ch, 'enclave') || s.war)) return null;
    const a = b.yaw + Math.PI + rand(-0.9, 0.9);
    const x = b.pos.x + Math.sin(a) * 170, z = b.pos.z + Math.cos(a) * 170;
    if (game.world.terrain.heightAt(x, z) > -3) return null;
    const boat = ACTIONS.spawnLifeBoat?.('cutter', new THREE.Vector3(x, 0, z), a + Math.PI);
    if (!boat) return null;
    const ev = { boat, members: [], hailed: false, far: 0, landed: false };
    ev.members = spawnSquad(game, ['peacekeeper_arbalist', 'peacekeeper', 'peacekeeper'], x, z, a, { ev });
    for (const e of ev.members) { e.noGravity = true; e.onBoat = boat; }
    G.ui.toast('An Enclave cutter has the wind of you.', 'bad');
    G.audio?.play('lifeHail', { vol: 0.6 });
    ACTIONS.tip?.('patrols');
    return ev;
  },
  tick(game, ev, dt) {
    const p = game.player, boat = ev.boat;
    const live = alive(ev);
    // the marines go ashore after a sailor who lands
    if (!ev.landed && !p.boat && game.world.terrain.heightAt(p.pos.x, p.pos.z) > 0 && Math.hypot(boat.pos.x - p.pos.x, boat.pos.z - p.pos.z) < 140) {
      ev.landed = true;
      for (const e of live) {
        e.noGravity = false;
        e.onBoat = null;
        const a = Math.random() * Math.PI * 2;
        e.pos.set(p.pos.x + Math.sin(a) * 22, ground(p.pos.x + Math.sin(a) * 22, p.pos.z + Math.cos(a) * 22) + 0.2, p.pos.z + Math.cos(a) * 22);
        e.home.copy(p.pos);
      }
      G.ui.toast("The cutter's marines wade ashore after you.", 'bad');
      ev.kind = 'hunters';
      ev.faction = 'enclave';
      ev.trackT = 0;
      ACTIONS.despawnLifeBoat?.(boat);
      return false;
    }
    // pursue: steer for the sailor's boat
    const target = p.boat ? p.boat.pos : p.pos;
    const want = Math.atan2(target.x - boat.pos.x, target.z - boat.pos.z);
    let dy = want - boat.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    boat.steer(dt, 1, Math.max(-1, Math.min(1, dy * 2)), Math.abs(dy) < 0.4);
    for (const e of live) {
      const sp = seatOf(boat, ev.members.indexOf(e) + 1);
      e.pos.copy(sp);
      e.vel.set(0, 0, 0);
      e.home.copy(sp);
    }
    const d = Math.hypot(target.x - boat.pos.x, target.z - boat.pos.z);
    if (!ev.hailed && d < 50) {
      ev.hailed = true;
      hail(game, ev);
    }
    ev.far = d > 260 ? ev.far + dt : 0;
    if (ev.far > 8 || ev.paid || !live.length) {
      if (ev.far > 8) G.ui.toast('The cutter turns back.', 'good');
      ACTIONS.despawnLifeBoat?.(boat);
      return true;
    }
    return false;
  },
};
// where a crewman stands on a boat's deck: its seat `i`
const _seat = new THREE.Vector3();
function seatOf(boat, i) {
  const seats = boat.def.seats, [lx, lz] = seats[i % seats.length];
  const c = Math.cos(boat.yaw), s = Math.sin(boat.yaw);
  return _seat.set(boat.pos.x + lx * c + lz * s, boat.pos.y + 0.75, boat.pos.z - lx * s + lz * c);
}
// a faction's boat at sea, steered by the event that owns it (its autopilot only keeps the
// mesh on the water); kept in game.boats, so a guest sees it as the host's boat
// The faction's and the sea's boats, built behind the menu and lent out (a boat built in play
// would upload its meshes in a frame): hidden here until an event takes one.
const BOAT_POOL = { sloop: 3, skiff: 3, cutter: 1 };
const boatPool = new Map();
BOOT_HOOKS.push(() => {
  if (boatPool.size || !G.scene) return;
  for (const [type, n] of Object.entries(BOAT_POOL)) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const b = new Boat(new THREE.Vector3(0, 0, 0), 0, type);
      b.pooled = true;
      b.mesh.visible = false;
      list.push(b);
    }
    boatPool.set(type, list);
  }
});
// a faction's boat at sea, steered by the event that owns it (its autopilot only keeps the
// mesh on the water); kept in game.boats, so a guest sees it as the host's boat
ACTIONS.spawnLifeBoat = (type, pos, yaw) => {
  const game = G.game;
  if (!game) return null;
  let b = boatPool.get(type)?.pop();
  if (b) {
    b.pos.set(pos.x, 0, pos.z);
    b.yaw = yaw;
    b.speed = 0;
    b.mesh.visible = true;
  } else b = new Boat(pos, yaw, type);
  b.autopilot = { update: (boat) => boat.syncMesh() };
  // its crew hold every seat: no one boards a faction's boat (and a guest sees them as captains)
  for (let i = 0; i < b.occupants.length; i++) b.occupants[i] = { isCaptain: true };
  game.boats.push(b);
  b.syncMesh();
  return b;
};
ACTIONS.despawnLifeBoat = (b) => {
  const game = G.game;
  if (!game || !b) return;
  const i = game.boats.indexOf(b);
  if (i >= 0) game.boats.splice(i, 1);
  if (!b.pooled) return b.dispose();
  b.mesh.visible = false;
  b.autopilot = null;
  b.occupants.fill(null);
  boatPool.get(b.type)?.push(b);
};

function hail(game, ev) {
  const ch = game.ch;
  G.audio?.play('lifeHail', { vol: 1 });
  if (!wantedBy(ch, 'enclave')) return G.ui.toast('"Strike your sail, in the Anchor\'s name!" They mean to sink you.', 'bad');
  const fine = fineFor(ch, 'enclave');
  const el = G.ui.openModal('cutter', `<div class="panel" style="width:480px"><h2>AN ENCLAVE CUTTER HAILS YOU</h2>
    <p style="font-style:italic">"Heave to! Your name is on the Registry's list. Pay what you owe the Enclave, or we take it out of your hull."</p>
    <button class="btn wide" data-a="pay">Heave to and pay the fine (${fine} silver)</button>
    <button class="btn wide" data-a="run">Run for it</button></div>`, { pauses: true });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'pay') {
      if (payFine(ch, 'enclave')) ev.paid = true;
      else G.ui.toast('You cannot pay that. Run.', 'bad');
      G.ui.closeModal();
    } else if (a === 'run') {
      G.ui.closeModal();
      G.ui.toast('The cutter crowds on sail. Its arbalist takes aim.', 'bad');
    }
  });
}

// ---------------------------------------------------------------- LAN: a guest sees the host's events
let sendT = 0;
function sendState(game, dt) {
  sendT -= dt;
  if (sendT > 0) return;
  sendT = 1;
  const list = [];
  for (const ev of LIFE.active) {
    const props = (ev.props || []).map((p) => [p.kind, +p.object.position.x.toFixed(2), +p.object.position.y.toFixed(2), +p.object.position.z.toFixed(2), +p.object.rotation.y.toFixed(3)]);
    list.push({ id: ev.id, kind: ev.kind, cp: ev.kind === 'checkpoint' ? ev.def.id : null, cap: ev.kind === 'captives' && ev.state === 'bound' ? ev.def.id : null, props, cart: ev.interact && !ev.openedAt ? 1 : 0 });
  }
  G.net.send({ t: 'wev', list });
}
const guestProps = new Map();
function guestTick(game) {
  // a checkpoint the host has up stops a guest by the guest's own standing
  for (const ev of LIFE.guestEvents || []) {
    if (!ev.cp) continue;
    const cp = CHECKPOINTS.find((c) => c.id === ev.cp);
    if (cp) checkRun(game, (ev.state ||= {}), cp, checkpointAt(cp));
  }
}
(G.netHandlers ||= {}).wev = (m, net) => {
  if (!net.isGuest || m.from !== net.hostId) return;
  LIFE.guest.clear();
  const seen = new Set();
  for (const ev of m.list || []) {
    if (ev.cp) LIFE.guest.set('cp:' + ev.cp, true);
    if (ev.cap) LIFE.guest.set('cap:' + ev.cap, true);
    ev.props.forEach((row, i) => {
      const key = ev.id + ':' + i;
      seen.add(key);
      let p = guestProps.get(key);
      if (!p) { p = lifeProp(row[0], row[1], row[2], row[3], row[4]); guestProps.set(key, p); }
      p.object.position.set(row[1], row[2], row[3]);
      p.object.rotation.y = row[4];
    });
  }
  for (const [key, p] of guestProps) if (!seen.has(key)) { releaseLifeProp(p); guestProps.delete(key); }
  LIFE.guestEvents = (m.list || []).map((ev) => ({ ...ev, state: (LIFE.guestEvents || []).find((g) => g.id === ev.id)?.state }));
};
G.netHandlers.wevr = (m, net) => {
  if (m.from !== net.hostId || !G.game) return;
  applyReward(G.game, m.r || {});
};

// ---------------------------------------------------------------- for tools, tests and the map
ACTIONS.worldLife = () => LIFE;
ACTIONS.forceLife = (kind) => {
  const game = G.game, k = KINDS[kind];
  if (!game || !k) return null;
  const ev = k.start(game);
  return ev ? startEvent(game, kind, ev) : null;
};
ACTIONS.coastHolder = () => G.game && G.game.ch && coastHolder(G.game.ch);
export { KINDS, startEvent, endEvent, applyReward, reward, players, nearestPlayer, spawnSquad, alive, seatOf, repOf, wantedBy };
