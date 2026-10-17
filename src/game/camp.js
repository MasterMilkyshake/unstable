// Campfires you make (the user's call, 2026-10-16, as in Deepwoken): three Sticks or one Firewood
// lay a fire just ahead of you that burns CAMP.burn seconds of play, then goes out. It is a campfire
// like the world's own (ui/interact.js openCampfire): sit by it, cook at it, and invest your points
// while you sit (Player.resting). Its light is a source the world's fixed pool picks up, never a
// new point light (ADR-005). One fire of your own at a time; none in the Rift (the user's rule: no
// campfires there), in danger, in water, aboard, or off the ground. On LAN the others see it and
// may sit at it, through a 'camp' message.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { mat } from '../world/props.js';
import { SWIM_Y } from '../entities/actor.js';
import { ITEMS } from '../data/items.js';
import { UPDATE_HOOKS, START_HOOKS } from './hooks.js';

export const CAMP = {
  burn: 300, // seconds of play a made fire burns
  ahead: 1.6, // how far in front of you it is laid
  radius: 3.2, // reach of its Sit / Cook, as the world's campfires
  slope: 0.9, // the most the ground may rise or fall under it, in metres
  color: '#ff8a2a',
};

const fires = []; // { id, own, by, pos, group, light, emitter, it, t }
let seq = 0;

const GEO = {
  rock: new THREE.DodecahedronGeometry(1, 0),
  log: new THREE.CylinderGeometry(0.1, 0.1, 1.2, 5),
  flame: new THREE.ConeGeometry(0.35, 0.9, 6),
};

// The fire's look, as the world's campfires: a ring of stones, three logs, a flame.
function buildMesh(pos) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const stone = mat('#6a6560');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = new THREE.Mesh(GEO.rock, stone);
    r.position.set(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8);
    r.scale.set(0.25, 0.2, 0.25);
    g.add(r);
  }
  const wood = mat('#4a3020');
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(GEO.log, wood);
    log.position.set(0, 0.2, 0);
    log.rotation.set(Math.PI / 2 - 0.4, (i / 3) * Math.PI * 2, 0, 'YXZ');
    g.add(log);
  }
  const flame = new THREE.Mesh(GEO.flame, mat(CAMP.color, { emissive: CAMP.color, ei: 2.2 }));
  flame.position.set(0, 0.5, 0);
  g.add(flame);
  return g;
}

function light(pos, opts = {}) {
  const world = G.world;
  const id = opts.id || `camp_${++seq}`;
  const group = buildMesh(pos);
  world.scene.add(group);
  const src = { pos: pos.clone().add(new THREE.Vector3(0, 1.2, 0)), color: new THREE.Color(CAMP.color), intensity: 2.6, distance: 16, flicker: true, priority: 1, night: 1.6 };
  world.lightSources.push(src);
  const emitter = { kind: 'fire', pos: pos.clone().add(new THREE.Vector3(0, 0.4, 0)), rate: 18 };
  world.addEmitter(emitter);
  const it = world.addInteract({ id, kind: 'campfire', pos: pos.clone().add(new THREE.Vector3(0, 0.5, 0)), radius: CAMP.radius, label: 'Sit / Cook', name: opts.by ? `${opts.by}'s Campfire` : 'Your Campfire', made: true });
  const f = { id, own: !opts.by, by: opts.by || null, pos: pos.clone(), group, light: src, emitter, it, t: opts.t ?? CAMP.burn };
  fires.push(f);
  return f;
}

// Put a fire out: everything it added leaves the world, and whoever sat by it stands.
function douse(f, quiet = false) {
  const world = G.world;
  const i = fires.indexOf(f);
  if (i >= 0) fires.splice(i, 1);
  if (world) {
    world.scene.remove(f.group);
    f.light.intensity = 0; // the pool drops it at its next pass
    const li = world.lightSources.indexOf(f.light);
    if (li >= 0) world.lightSources.splice(li, 1);
    const ii = world.interactables.indexOf(f.it);
    if (ii >= 0) world.interactables.splice(ii, 1);
  }
  const emitters = G.vfx && Array.isArray(G.vfx.emitters) ? G.vfx.emitters : null;
  const ei = emitters ? emitters.indexOf(f.emitter) : -1;
  if (ei >= 0) emitters.splice(ei, 1);
  const p = G.player;
  if (p && p.sitting && Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z) <= CAMP.radius + 0.5) {
    p.sitting = false;
    if (!quiet && G.ui) G.ui.toast(f.own ? 'Your fire burns out.' : 'The fire burns out.');
  }
}

export function madeFires() {
  return fires;
}

// Every made fire out at once (a new or loaded character, and tests).
export function douseAll() {
  for (const f of fires.slice()) douse(f, true);
}

// Why a fire can't be laid here, or null. `at` is where it would go.
function refusal(game, p, at) {
  if (game.inRift || (G.world.inRift && G.world.inRift(p.pos.x))) return 'No fire will catch in the Rift.';
  if (p.inDanger) return 'Not while in danger.';
  if (p.dead || p.knocked) return 'Not now.';
  if (p.boat) return 'Not aboard a boat.';
  if (p.swimming || p.climbing || !p.grounded) return 'Find solid ground first.';
  if (at.y < SWIM_Y + 0.2) return 'The ground here is too wet for a fire.';
  if (Math.abs(at.y - p.pos.y) > CAMP.slope) return 'No level ground for a fire here.';
  return null;
}

// Lay a fire with `itemId` (its `camp` is how many it takes). Returns the fire, or null.
export function makeCamp(p, itemId) {
  const game = G.game;
  const it = ITEMS[itemId];
  const inv = p.ch.inventory.items;
  const need = (it && it.camp) || 0;
  if (!need) return null;
  if ((inv[itemId] || 0) < need) {
    G.ui.toast(`A fire takes ${need} ${it.name}; you have ${inv[itemId] || 0}.`, 'bad');
    return null;
  }
  const yaw = Number.isFinite(game.camYaw) ? game.camYaw : p.yaw;
  const x = p.pos.x + Math.sin(yaw) * CAMP.ahead;
  const z = p.pos.z + Math.cos(yaw) * CAMP.ahead;
  const at = new THREE.Vector3(x, G.world.groundAt(x, z, p.pos.y + 1.5), z);
  const why = refusal(game, p, at);
  if (why) {
    G.ui.toast(why, 'bad');
    return null;
  }
  inv[itemId] -= need;
  if (inv[itemId] <= 0) delete inv[itemId];
  for (const f of fires.filter((f) => f.own)) douse(f, true); // one fire of your own at a time
  const f = light(at);
  G.audio && G.audio.play('step', { pos: at, pitch: 0.7, vol: 0.9 });
  G.vfx && G.vfx.burst && G.vfx.burst(at.clone().add(new THREE.Vector3(0, 0.4, 0)), 'ember', 14, { speed: 2, up: 2 });
  G.ui.toast('You lay a fire. It will burn for about five minutes. [E] to sit.', 'good');
  G.ui.refreshHotbar && G.ui.refreshHotbar();
  if (G.net && G.net.localEvent) G.net.localEvent({ t: 'camp', x: +at.x.toFixed(2), y: +at.y.toFixed(2), z: +at.z.toFixed(2), by: p.ch.name });
  return f;
}

// Another player laid a fire: show it here too, for as long as it burns there.
function onNetCamp(m, net) {
  if (!G.world || !Number.isFinite(m.x)) return;
  const avatar = net && net.avatars && net.avatars.get(m.from);
  const by = (avatar && avatar.name) || m.by || 'A friend';
  for (const f of fires.filter((f) => f.by === by)) douse(f, true);
  light(new THREE.Vector3(m.x, m.y, m.z), { by });
}
G.netHandlers ||= {};
G.netHandlers.camp = onNetCamp;

// Fires burn down in play time.
UPDATE_HOOKS.push((game, dt) => {
  for (const f of fires.slice()) {
    f.t -= dt;
    if (f.t <= 0) douse(f);
    else if (f.t < 20) f.group.children[f.group.children.length - 1].scale.setScalar(0.4 + (0.6 * f.t) / 20); // the flame sinks at the end
  }
});

// A new or loaded character starts with no fires of its own burning.
START_HOOKS.push(() => douseAll());
