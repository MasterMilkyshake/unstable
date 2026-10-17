// Life at sea (docs/agent/WORLD_LIFE_PLAN.md, tasks 6 and 10), run by game/worldLife.js's
// director like the road events: a faction's supply sloop on a sea road, to be seen in (and its
// pier held while it unloads) or raided; a sloop that is not what it flies; a fishing boat beset
// by sharks; and a drift of wreckage that leads to a hull worth salvaging. Host-only, like every
// event: a guest sees the boats (game.boats is synced), the crews and sharks as proxies, and is
// paid through 'wevr'.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS, BOOT_HOOKS } from './hooks.js';
import { FACTIONS } from '../data/factions.js';
import { SEA_CONVOYS, FALSE_CONVOY, SEA_TROUBLE, LIFE_TIMING, CONVOY_LOOT } from '../data/factionLife.js';
import { KINDS, LIFE, reward, players, nearestPlayer, spawnSquad, alive, seatOf, coastState, applyReward } from './worldLife.js';
import { seaCourse, FerryPilot } from './travel.js';
import { waveHeight } from '../world/water.js';
import { lifeProp, releaseLifeProp } from '../world/lifeProps.js';
import { rand, randInt } from '../core/util.js';

const now = () => G.time || 0;
const deep = (x, z) => G.world.terrain.heightAt(x, z) < -6;
const nearestD = (game, x, z) => nearestPlayer(game, x, z).d;

// a boat of the event's, crewed by the event: its seats held, so no one else boards it
function crewBoat(game, type, pos, yaw) {
  const b = ACTIONS.spawnLifeBoat(type, pos, yaw);
  return b;
}
// the crew ride their seats: placed there each step, standing on the deck
function seatCrew(ev, boat) {
  for (const e of alive(ev)) {
    const sp = seatOf(boat, ev.members.indexOf(e) + 1);
    e.pos.copy(sp);
    e.vel.set(0, 0, 0);
    e.home.copy(sp);
  }
}
function dropCrew(ev) {
  for (const e of ev.members) {
    e.noGravity = true;
    e.onBoat = ev.boat;
  }
}
// a sailing pilot on a sea road that can run on without a destination
function pilotFor(boat, path, onArrive) {
  const pilot = new FerryPilot(boat, path, onArrive, { arrive: 14 });
  return { pilot, update: (b, dt) => pilot.update(b, dt) };
}
// a player near the sea: on a boat, swimming, or within a stone's throw of the shore
const bySea = (q) => q.actor.boat || q.actor.swimming || G.world.terrain.heightAt(q.actor.pos.x, q.actor.pos.z) < 3;

// ---------------------------------------------------------------- supply sloops
// Each sea road's course, charted once behind the menu (the sea's A* is too slow for a frame).
const COURSES = new Map();
export function chartCourses(world) {
  const docks = world.docks || {};
  for (const c of SEA_CONVOYS) {
    if (!docks[c.from] || !docks[c.to]) continue;
    const path = seaCourse(docks[c.from], docks[c.to]);
    if (path) COURSES.set(c.id, path);
  }
  return COURSES;
}
BOOT_HOOKS.push((game) => chartCourses(game.world));
export { COURSES };
// the hold's [E] keeps to the boat as it drifts
function followHold(ev) {
  if (ev.interact && ev.boat) ev.interact.pos.set(ev.boat.pos.x, ev.boat.pos.y + 1.2, ev.boat.pos.z);
}

KINDS.seaConvoy = {
  start(game) {
    const s = coastState(game.ch);
    const docks = game.world.docks;
    const cands = SEA_CONVOYS.filter((c) => COURSES.has(c.id)
      && !(c.faction === 'enclave' && s.ending === 'break') && !(c.faction === 'watch' && s.occupied)
      && (!c.story || (s.writArrived && !s.freed && !s.war)));
    const ps = players(game).filter(bySea);
    if (!ps.length) return null;
    // a road that passes within reach of someone at the water's edge
    for (const def of cands.sort(() => Math.random() - 0.5)) {
      const path = COURSES.get(def.id).map((p) => p.clone());
      const a = path[0];
      const near = ps.some((q) => path.some((p) => Math.hypot(p.x - q.actor.pos.x, p.z - q.actor.pos.z) < LIFE_TIMING.seaConvoy.near));
      if (!near) continue;
      // it casts off out of sight of anyone
      if (players(game).some((q) => Math.hypot(a.x - q.actor.pos.x, a.z - q.actor.pos.z) < 80)) continue;
      const ev = { def, path, members: [], foes: [], credit: new Map(), state: 'sailing', from: docks[def.from], to: docks[def.to] };
      const yaw = Math.atan2(path[1].x - a.x, path[1].z - a.z);
      ev.boat = crewBoat(game, 'sloop', a.clone(), yaw);
      if (!ev.boat) return null;
      ev.boat.autopilot = pilotFor(ev.boat, path, () => arrive(game, ev));
      ev.members = spawnSquad(game, def.crew, a.x, a.z, yaw, { ev });
      dropCrew(ev);
      seatCrew(ev, ev.boat);
      for (const q of ps) reward(game, q.actor, { toast: `${FACTIONS[def.faction].name} have a sloop at sea: ${def.name}.`, kind: 'quest' });
      G.audio?.play('lifeHorn', { pos: a, vol: 0.6 });
      return ev;
    }
    return null;
  },
  tick(game, ev, dt) {
    const boat = ev.boat, f = ev.def.faction;
    followHold(ev);
    if (ev.state === 'sailing') {
      seatCrew(ev, boat);
      // who sails with it
      for (const q of players(game)) {
        const d = Math.hypot(q.actor.pos.x - boat.pos.x, q.actor.pos.z - boat.pos.z);
        const r = ev.credit.get(q.actor) || { near: 0, total: 0, joined: false, raided: false };
        if (d < 120) r.joined = true;
        if (r.joined) { r.total += dt; if (d < 120) r.near += dt; }
        ev.credit.set(q.actor, r);
      }
      // its crew put down at sea: by whose hand?
      if (!alive(ev).length) {
        const raiders = players(game).filter((q) => ev.members.some((e) => e.lastAttacker === q.actor));
        ev.state = raiders.length ? 'raided' : 'lost';
        boat.autopilot = { update: (b, d) => { b.speed *= Math.max(0, 1 - d); b.move(d); } };
        for (const q of raiders) reward(game, q.actor, { wanted: [[f, 300]], rep: [[f, -12]], toast: 'The sloop is yours. So is the bounty on your head.', kind: 'bad', save: true });
        openHold(game, ev, ev.state === 'raided' ? 1 : 0.5, CONVOY_LOOT[f]);
        return false;
      }
      return nearestD(game, boat.pos.x, boat.pos.z) > 700;
    }
    if (ev.state === 'unloading') {
      seatCrew(ev, boat);
      ev.unloadT -= dt;
      const foes = ev.foes.filter((e) => !e.dead && G.actors.includes(e));
      if (ev.unloadT <= 0 || (ev.foes.length && !foes.length)) {
        ev.state = 'unloaded';
        if (alive(ev).length) {
          for (const [who, r] of ev.credit) {
            if (r.joined && r.total > 0 && r.near / r.total >= 0.6) reward(game, who, { rep: [[f, 6]], silver: 50 + 7 * (game.ch.level || 1), xp: 70 + 15 * (game.ch.level || 1), toast: `The sloop is unloaded. ${FACTIONS[f].name} thank you for seeing it in.`, stat: 'escorts', outcome: { kind: 'escort', faction: f }, save: true });
          }
        }
        ev.doneAt = now();
      }
      return false;
    }
    // raided, lost or unloaded: the boat waits a while, then is gone
    if (ev.state === 'unloaded' || ev.openedAt) return now() - (ev.openedAt || ev.doneAt) > 20 || nearestD(game, boat.pos.x, boat.pos.z) > 250;
    return nearestD(game, boat.pos.x, boat.pos.z) > 300 || now() - ev.t0 > 900;
  },
  end(game, ev) {
    if (ev.boat) ACTIONS.despawnLifeBoat?.(ev.boat);
  },
};
// in at the far dock: raiders wait on the pier if someone is near to see it, and the crew
// unload while they are held off
function arrive(game, ev) {
  if (ev.state !== 'sailing') return;
  ev.state = 'unloading';
  ev.unloadT = 25;
  const d = ev.to;
  if (nearestD(game, d.end.x, d.end.z) < 150 && Math.random() < 0.75) {
    const mid = d.start.clone().lerp(d.end, 0.4);
    ev.foes = spawnSquad(game, ev.def.raiders, mid.x, mid.z, Math.atan2(d.dir.x, d.dir.z), { scaleTo: Math.max(game.ch.level || 1, 4) });
    for (const [i, e] of ev.foes.entries()) e.setAggro?.(alive(ev)[i % Math.max(1, alive(ev).length)] || null);
    for (const q of players(game)) if (Math.hypot(q.actor.pos.x - d.end.x, q.actor.pos.z - d.end.z) < 200) reward(game, q.actor, { toast: 'Raiders on the pier, waiting for the sloop!', kind: 'bad' });
  }
}
// a boat's hold, opened from the deck
function openHold(game, ev, k, loot) {
  const b = ev.boat;
  const it = game.world.addInteract({
    id: 'life_hold_' + ev.id, kind: 'life_cart', pos: b.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), radius: 4,
    label: 'Break open the hold',
    enabled: () => !ev.openedAt,
    use: () => {
      ev.openedAt = now();
      const silver = Math.round((60 + 8 * (game.ch.level || 1)) * k);
      applyReward(game, { silver, items: (loot || []).map(([id, n]) => [id, Math.max(1, Math.round(n * k))]), toast: `The hold's stores: ${silver} silver and supplies.`, save: true });
      G.audio?.play('chest', { pos: b.pos });
    },
  });
  ev.interact = it;
  ev.follow = it; // kept on the drifting boat
}

// ---------------------------------------------------------------- the false sloop
KINDS.falseConvoy = {
  start(game) {
    const q = players(game).find((o) => o.actor.boat);
    if (!q) return null;
    // ahead of a sailor, on open water
    const a = (q.actor.boat.yaw || 0) + rand(-0.8, 0.8);
    const x = q.actor.pos.x + Math.sin(a) * 260, z = q.actor.pos.z + Math.cos(a) * 260;
    if (!deep(x, z)) return null;
    const ev = { members: [], state: 'posing', credit: new Map() };
    ev.boat = crewBoat(game, 'sloop', new THREE.Vector3(x, 0, z), a + Math.PI);
    ev.members = spawnSquad(game, FALSE_CONVOY.crew, x, z, a, { ev });
    dropCrew(ev);
    seatCrew(ev, ev.boat);
    reward(game, q.actor, { toast: `A sail: ${FALSE_CONVOY.name}, under the Watch's pennant.`, kind: 'quest' });
    return ev;
  },
  tick(game, ev, dt) {
    const boat = ev.boat;
    followHold(ev);
    const { q, d } = nearestPlayer(game, boat.pos.x, boat.pos.z);
    if (ev.state === 'posing') {
      // it sails for the nearest sailor, slowly, as a supply boat might hail one
      if (q) {
        const want = Math.atan2(q.actor.pos.x - boat.pos.x, q.actor.pos.z - boat.pos.z);
        let dy = want - boat.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        boat.steer(dt, d > 30 ? 0.55 : 0.1, Math.max(-1, Math.min(1, dy * 2)));
      }
      seatCrew(ev, boat);
      if (d < 40) {
        ev.state = 'unmasked';
        for (const e of alive(ev)) e.setAggro?.(q.actor);
        for (const o of players(game)) if (Math.hypot(o.actor.pos.x - boat.pos.x, o.actor.pos.z - boat.pos.z) < 120) reward(game, o.actor, { toast: 'The "Watch" sloop runs up a red rag: Redwake!', kind: 'bad' });
        G.audio?.play('lifeHail', { pos: boat.pos, vol: 0.9 });
      }
      return d > 600;
    }
    if (ev.state === 'unmasked') {
      boat.steer(dt, 0.2, 0);
      seatCrew(ev, boat);
      if (!alive(ev).length) {
        ev.state = 'taken';
        boat.autopilot = { update: (b, dd) => { b.speed *= Math.max(0, 1 - dd); b.move(dd); } };
        for (const o of players(game)) if (ev.members.some((e) => e.lastAttacker === o.actor)) reward(game, o.actor, { rep: [['watch', 4]], toast: 'The false sloop is taken. The Watch will hear of it.', save: true });
        openHold(game, ev, 1, FALSE_CONVOY.loot);
      }
      return d > 600;
    }
    return now() - (ev.openedAt || now() + 1e9) > 20 || d > 300 || now() - ev.t0 > 900;
  },
  end(game, ev) {
    if (ev.boat) ACTIONS.despawnLifeBoat?.(ev.boat);
  },
};

// ---------------------------------------------------------------- a fishing boat beset
KINDS.beset = {
  start(game) {
    const q = players(game).find((o) => o.actor.boat || o.actor.swimming);
    if (!q) return null;
    const a = rand(0, Math.PI * 2);
    const x = q.actor.pos.x + Math.sin(a) * 140, z = q.actor.pos.z + Math.cos(a) * 140;
    if (!deep(x, z)) return null;
    const ev = { members: [], foes: [], state: 'beset' };
    ev.boat = crewBoat(game, 'skiff', new THREE.Vector3(x, 0, z), rand(0, Math.PI * 2));
    ev.boat.autopilot = { update: (b, dd) => { b.speed = 0; b.yaw += dd * 0.05; b.syncMesh(); } };
    for (let i = 0; i < SEA_TROUBLE.beset.sharks; i++) {
      const t = (i / SEA_TROUBLE.beset.sharks) * Math.PI * 2;
      const e = game.spawnEnemy('gnashfin', new THREE.Vector3(x + Math.sin(t) * 8, -1.2, z + Math.cos(t) * 8), { scaleTo: Math.max(game.ch.level || 1, 3) });
      e.lifeEvent = ev;
      e.home.set(x, -1.2, z);
      ev.foes.push(e);
    }
    reward(game, q.actor, { toast: 'Shouting across the water: a fishing boat, and fins circling it.', kind: 'quest' });
    return ev;
  },
  tick(game, ev) {
    const boat = ev.boat;
    const d = nearestD(game, boat.pos.x, boat.pos.z);
    // a shark gone without being killed (the game cleared it) ends the encounter unpaid
    if (ev.state === 'beset' && ev.foes.some((e) => !e.dead && !G.actors.includes(e))) return true;
    if (ev.state === 'beset' && ev.foes.every((e) => e.dead)) {
      ev.state = 'saved';
      ev.doneAt = now();
      const silver = randInt(...SEA_TROUBLE.beset.silver);
      for (const o of players(game)) {
        if (!ev.foes.some((e) => e.lastAttacker === o.actor)) continue;
        reward(game, o.actor, { silver, rep: SEA_TROUBLE.beset.rep, xp: 50 + 10 * (game.ch.level || 1), toast: `The fishers haul their nets in and press ${silver} silver on you: all they had aboard.`, stat: 'rescues', save: true });
      }
    }
    if (ev.state === 'saved') return now() - ev.doneAt > 30 || d > 300;
    return d > 450 || now() - ev.t0 > 600;
  },
  end(game, ev) {
    for (const e of ev.foes || []) if (!e.dead) e.despawn = true;
    if (ev.boat) ACTIONS.despawnLifeBoat?.(ev.boat);
  },
};

// ---------------------------------------------------------------- a drift of wreckage
KINDS.drift = {
  start(game) {
    const q = players(game).find((o) => o.actor.boat);
    if (!q) return null;
    const b = q.actor.boat;
    // the trail starts ahead of the sailor and leads off to one side, to the hull
    const a = (b.yaw || 0) + rand(-0.5, 0.5);
    const sx = q.actor.pos.x + Math.sin(a) * 90, sz = q.actor.pos.z + Math.cos(a) * 90;
    const turn = a + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.1);
    const D = SEA_TROUBLE.drift;
    const pts = [];
    for (let i = 0; i <= D.pieces; i++) pts.push([sx + Math.sin(turn) * i * D.spacing, sz + Math.cos(turn) * i * D.spacing]);
    if (!pts.every(([x, z]) => deep(x, z))) return null;
    const [hx, hz] = pts[pts.length - 1];
    const ev = { members: [], props: [], state: 'drifting' };
    for (const [x, z] of pts.slice(0, -1)) ev.props.push(lifeProp('flotsam', x, 0, z, rand(0, Math.PI * 2)));
    ev.boat = crewBoat(game, 'skiff', new THREE.Vector3(hx, 0, hz), turn);
    ev.boat.autopilot = { update: (bb, dd) => { bb.speed = 0; bb.yaw += dd * 0.03; bb.syncMesh(); } };
    ev.hull = ev.boat;
    const it = game.world.addInteract({
      id: 'life_drift_' + LIFE.nextId, kind: 'life_cart', pos: new THREE.Vector3(hx, 1.2, hz), radius: 4,
      label: 'Salvage the drifting hull', enabled: () => !ev.openedAt,
      use: () => {
        ev.openedAt = now();
        const silver = randInt(...D.silver);
        applyReward(game, { silver, items: D.loot.filter(() => Math.random() < 0.7), toast: `Salvage: ${silver} silver and what the sea left in her.`, stat: 'salvage', save: true });
        G.audio?.play('chest', { pos: new THREE.Vector3(hx, 0, hz) });
      },
    });
    ev.interact = it;
    reward(game, q.actor, { toast: 'Timber on the water ahead: a trail of wreckage.', kind: 'quest' });
    return ev;
  },
  tick(game, ev) {
    // the wreckage rides the swell
    const t = G.time || 0;
    for (const p of ev.props) p.object.position.y = waveHeight(p.object.position.x, p.object.position.z, t) - 0.15;
    const d = nearestD(game, ev.hull.pos.x, ev.hull.pos.z);
    if (ev.openedAt) return now() - ev.openedAt > 25 || d > 300;
    return d > 700 || now() - ev.t0 > 900;
  },
  end(game, ev) {
    if (ev.boat) ACTIONS.despawnLifeBoat?.(ev.boat);
  },
};
for (const k of ['seaConvoy', 'falseConvoy', 'beset', 'drift']) KINDS[k].retry = 20;
