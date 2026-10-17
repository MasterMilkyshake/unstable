// World events: every few minutes on the surface something happens near the player.
//   breach   - a violet Rift Breach tears open; Rift creatures guard it. Clear them for a cache.
//   starfall - a star falls nearby, leaving starmetal to harvest.
//   washup / patrol - camps and wildlife from game/encounters.js
//   ambush / beset / wanderer - raiders on the road, a traveller in trouble, the night lantern
// Events are host-only in LAN co-op (they spawn enemies).
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, START_HOOKS, ACTIONS } from './hooks.js';
import { rand, randInt } from '../core/util.js';
import { startWashup, startPatrol, tickPatrol, startAmbush, tickAmbush, startBeset, tickBeset, startWanderer, tickWanderer } from './encounters.js';
import './worldLife.js'; // factions that move: columns, checkpoints, convoys, soundings, hunters, cutters
import './seaLife.js'; // supply sloops, a false one, a fishing boat beset, a drift of wreckage
import './rescue.js'; // Watch hands held at Redwake camps, freed and brought to a Watch post
import './contracts.js'; // the officers' contract boards
import './chart.js'; // who holds the coast, the carrier lines and the climbs, drawn on the chart
import './soundscape.js'; // where the player stands, for the place's own sounds

let nextT = 200;
let active = null; // { kind, pos, objs:[], enemies:[], t, done }

const SAFE_ZONES = [
  { x: 0, z: 0, r: 85 }, // Saltreach town
  { x: 0, z: -325, r: 40 }, // The Wash camp
];

function findSpot(game, minD, maxD) {
  const p = game.player;
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = rand(minD, maxD);
    const x = p.pos.x + Math.cos(a) * d;
    const z = p.pos.z + Math.sin(a) * d;
    const h = game.world.terrain.heightAt(x, z);
    if (h < 2 || h > 45) continue;
    const n = game.world.terrain.normalAt(x, z, new THREE.Vector3());
    if (n.y < 0.82) continue;
    if (SAFE_ZONES.some((s) => Math.hypot(x - s.x, z - s.z) < s.r)) continue;
    if (game.world.colliders.groundAt(x, z, h + 4) > h + 0.4) continue;
    return new THREE.Vector3(x, h, z);
  }
  return null;
}

function beacon(color, height = 140) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 2.4, height, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  m.position.y = height / 2;
  g.add(m);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.6, height, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  core.position.y = height / 2;
  g.add(core);
  g.userData.beam = m;
  return g;
}

function disposeObj(o) {
  G.scene.remove(o);
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  });
}

function endEvent(game, success) {
  const ev = active;
  if (!ev) return;
  active = null;
  for (const o of ev.objs) disposeObj(o);
  for (const it of ev.interacts || []) {
    const i = game.world.interactables.indexOf(it);
    if (i >= 0) game.world.interactables.splice(i, 1);
  }
  for (const e of ev.enemies || []) if (!e.dead) e.despawn = true;
  if (ev.cleanup) ev.cleanup();
  if (ev.kind === 'breach' && !success) G.ui.toast('The Rift Breach seals itself.', '');
  if (ev.kind === 'beset' && !ev.saved) G.ui.toast('The shouting has stopped.', '');
  // something happens every few minutes of travel, not every quarter hour
  nextT = rand(110, 210);
}

// ---------------------------------------------------------------- breach
const BREACH_FOES = [
  { lvl: 0, types: ['hollow', 'riftling'] },
  { lvl: 10, types: ['hollow', 'riftling', 'drowned_knight'] },
  { lvl: 15, types: ['drowned_knight', 'abyssal_watcher', 'void_hound'] },
];

function startBreach(game) {
  const pos = findSpot(game, 60, 120);
  if (!pos) return false;
  const lvl = game.ch.level;
  const tier = [...BREACH_FOES].reverse().find((t) => lvl >= t.lvl);
  const ev = { kind: 'breach', pos, objs: [], enemies: [], t: 300, cleared: false };
  const b = beacon('#a274ff');
  b.position.copy(pos);
  G.scene.add(b);
  ev.objs.push(b);
  const rift = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.25, 8, 28),
    new THREE.MeshBasicMaterial({ color: '#d8b8ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  rift.position.copy(pos).add(new THREE.Vector3(0, 3, 0));
  G.scene.add(rift);
  ev.objs.push(rift);
  ev.ring = rift;
  const n = randInt(3, lvl >= 10 ? 5 : 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = pos.x + Math.cos(a) * 5;
    const z = pos.z + Math.sin(a) * 5;
    const p = new THREE.Vector3(x, game.world.groundAt(x, z, pos.y + 6) + 0.1, z);
    const type = tier.types[Math.floor(Math.random() * tier.types.length)];
    const e = game.spawnEnemy(type, p, { scaleTo: Math.max(lvl, 6) });
    e.breach = true;
    e.home = pos.clone();
    ev.enemies.push(e);
  }
  active = ev;
  G.audio.play('portal', { pos, vol: 0.8 });
  G.ui.toast('A Rift Breach tears open nearby. Look for the violet light.', 'quest');
  return true;
}

function breachReward(game, ev) {
  const lvl = game.ch.level;
  const silver = 40 + lvl * 9;
  G.player.addSilver(silver);
  game.giveItem('rift_shard', randInt(2, 4));
  if (Math.random() < 0.25) game.giveItem('mantra_spark', 1);
  if (Math.random() < 0.3) game.giveItem(['elixir', 'sanity_draught', 'iron_draught', 'ether_tonic'][randInt(0, 3)], 1);
  G.player.addXp(80 + lvl * 30);
  G.ui.banner('BREACH SEALED');
  G.ui.toast(`+${silver} silver · the Rift's leavings are yours`, 'good');
  G.audio.play('bell', { vol: 0.6 });
  G.vfx.burst(ev.pos.clone().add(new THREE.Vector3(0, 2, 0)), 'umbra', 60, { speed: 9, up: 6 });
  game.ch.stats.breaches = (game.ch.stats.breaches || 0) + 1;
  game.save();
}

// ---------------------------------------------------------------- starfall
function startStarfall(game) {
  const pos = findSpot(game, 40, 100);
  if (!pos) return false;
  const ev = { kind: 'starfall', pos, objs: [], t: 360, phase: 'falling', fall: 2.6, interacts: [] };
  const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }));
  const from = pos.clone().add(new THREE.Vector3(rand(-60, 60), 160, rand(-60, 60)));
  star.position.copy(from);
  G.scene.add(star);
  ev.objs.push(star);
  ev.star = star;
  ev.from = from;
  active = ev;
  G.ui.toast('A star is falling!', 'quest');
  G.audio.play('star', { vol: 0.9 });
  return true;
}

function landStar(game, ev) {
  ev.phase = 'landed';
  disposeObj(ev.star);
  ev.objs.splice(ev.objs.indexOf(ev.star), 1);
  const p = ev.pos;
  G.vfx.ring(p, 'phys', 7, 0.6, { color: '#fff4c8' });
  G.vfx.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), 'storm', 80, { speed: 12, up: 8, color: '#fff4c8' });
  G.vfx.flashLight(p.clone().add(new THREE.Vector3(0, 3, 0)), '#fff4c8', 14 * (G.settings?.reduceFlashing ? 0.25 : 1), 0.6, 40);
  if (game.player.pos.distanceTo(p) < 70) G.vfx.addShake(0.5);
  G.audio.play('hitHeavy', { pos: p, pitch: 0.4 });
  // crater of starmetal
  const g = new THREE.Group();
  g.position.copy(p);
  const glow = new THREE.MeshStandardMaterial({ color: '#fff0b8', emissive: '#ffd27a', emissiveIntensity: 1.6, flatShading: true });
  const rock = new THREE.MeshStandardMaterial({ color: '#3a3430', flatShading: true });
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.4, 10), rock);
  crater.position.y = 0.1;
  g.add(crater);
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + Math.random() * 0.4, 0), glow);
    const a = (i / 6) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.9, 0.5 + Math.random() * 0.5, Math.sin(a) * 0.9);
    c.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(c);
  }
  G.scene.add(g);
  ev.objs.push(g);
  const it = {
    id: 'starfall', kind: 'starfall', pos: p.clone().add(new THREE.Vector3(0, 1, 0)), radius: 4, label: 'Harvest Starmetal',
    use: () => {
      const n = randInt(2, 4);
      game.giveItem('star_shard', n);
      if (Math.random() < 0.3) game.giveItem('mantra_spark', 1);
      G.player.addXp(50 + game.ch.level * 15);
      G.audio.play('chest', { pos: p });
      game.ch.stats.starfalls = (game.ch.stats.starfalls || 0) + 1;
      endEvent(game, true);
      game.save();
    },
  };
  game.world.addInteract(it);
  ev.interacts.push(it);
}

// ---------------------------------------------------------------- loop
START_HOOKS.push((game) => {
  if (active) endEvent(game, false);
  nextT = rand(90, 150);
});

UPDATE_HOOKS.push((game, dt) => {
  const p = game.player;
  if (!p || p.dead) return;
  const ev = active;
  if (ev) {
    ev.t -= dt;
    if (ev.kind === 'breach') {
      ev.ring.rotation.y += dt * 1.5;
      ev.ring.rotation.x = Math.sin(G.time) * 0.3;
      ev.enemies = ev.enemies.filter((e) => G.actors.includes(e));
      if (ev.enemies.length && ev.enemies.every((e) => e.dead)) {
        breachReward(game, ev);
        return endEvent(game, true);
      }
      if (!ev.enemies.length && !ev.rewarded) return endEvent(game, false); // despawned (left the area)
    } else if (ev.kind === 'patrol' && tickPatrol(game, ev)) {
      return endEvent(game, true);
    } else if (ev.kind === 'ambush' && tickAmbush(game, ev)) {
      return endEvent(game, true);
    } else if (ev.kind === 'beset') {
      tickBeset(game, ev);
      if (ev.rewarded && ev.t <= 0) return endEvent(game, true);
    } else if (ev.kind === 'wanderer' && tickWanderer(game, ev)) {
      return endEvent(game, true);
    } else if (ev.kind === 'starfall' && ev.phase === 'falling') {
      ev.fall -= dt;
      const k = 1 - Math.max(0, ev.fall) / 2.6;
      ev.star.position.lerpVectors(ev.from, ev.pos, k * k);
      if (Math.random() < 0.9) G.vfx.trailPuff(ev.star.position, 'storm', 1.2, 2);
      if (ev.fall <= 0) landStar(game, ev);
    }
    for (const o of ev.objs) if (o.userData.beam) o.userData.beam.material.opacity = 0.25 + Math.sin(G.time * 2) * 0.1;
    if (ev.t <= 0 || Math.hypot(p.pos.x - ev.pos.x, p.pos.z - ev.pos.z) > 320 || game.inRift) endEvent(game, false);
    return;
  }
  if (game.inRift || game.inDungeon || game.ch.level < 3 || p.boat) return;
  if (game.net && game.net.isGuest) return;
  nextT -= dt;
  if (nextT > 0) return;
  nextT = 30; // retry soon if no spot found
  if (p.inDanger || p.swimming) return;
  // What happens depends on where you are and when: the night has its own road.
  const night = game.world.sky.isNight();
  const table = [
    ['ambush', 0.22], ['beset', 0.18], ['wanderer', night ? 0.3 : 0],
    ['breach', 0.12], ['starfall', night ? 0.16 : 0.08], ['washup', 0.1], ['patrol', 0.15],
  ];
  const total = table.reduce((a, [, w]) => a + w, 0);
  let roll = Math.random() * total, kind = 'patrol';
  for (const [k, w] of table) {
    if ((roll -= w) <= 0) { kind = k; break; }
  }
  const ok = startKind(game, kind);
  if (!ok) nextT = 20;
});

function startKind(game, kind) {
  if (kind === 'breach') return startBreach(game);
  if (kind === 'starfall') return startStarfall(game);
  const starters = {
    washup: () => startWashup(game, findSpot, endEvent),
    patrol: () => startPatrol(game, findSpot),
    ambush: () => startAmbush(game, findSpot),
    beset: () => startBeset(game, findSpot, endEvent),
    wanderer: () => startWanderer(game, findSpot),
  };
  const next = starters[kind] && starters[kind]();
  if (next) active = next;
  return !!next;
}

ACTIONS.forceEvent = (kind) => {
  const game = G.game;
  if (active) endEvent(game, false);
  if (['ambush', 'beset', 'wanderer'].includes(kind)) return startKind(game, kind);
  if (kind === 'starfall') return startStarfall(game);
  if (kind === 'washup') {
    const ev = startWashup(game, findSpot, endEvent);
    if (ev) active = ev;
    return !!ev;
  }
  if (kind === 'patrol') {
    const ev = startPatrol(game, findSpot);
    if (ev) active = ev;
    return !!ev;
  }
  return startBreach(game);
};
ACTIONS.eventState = () => active;
