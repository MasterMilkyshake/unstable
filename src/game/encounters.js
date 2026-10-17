// Surface camps and wildlife: wash-ups and hunting parties; ambushes on the roads, travellers
// in trouble, and the lantern that walks the night roads.
// Wired from game/events.js so breach/starfall stay on their original loop.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { randInt } from '../core/util.js';
import { AMBUSHERS, TRAVELLERS } from '../data/roadside.js';
import { NPC } from '../entities/npc.js';
import { DIALOGUES } from '../data/npcs.js';

const PATROL_TYPES = {
  forest: ['brigand', 'brigand_cutthroat'],
  meadow: ['mudlurker', 'scuttler'],
  marsh: ['mudlurker', 'scuttler'],
  snow: ['rimefang', 'frost_cultist'],
  volcanic: ['cinder_imp', 'ash_zealot'],
  ashfield: ['cinder_imp', 'ash_zealot'],
  emberwood: ['ash_zealot', 'cinder_crab'],
  jungle: ['jungle_ape', 'jade_serpent'],
};

export function startWashup(game, findSpot, endEvent) {
  const pos = findSpot(game, 25, 70);
  if (!pos) return null;
  const ev = { kind: 'washup', pos, objs: [], enemies: [], t: 280, interacts: [] };
  const crate = new THREE.Group();
  crate.position.copy(pos);
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4a28', flatShading: true });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), wood);
  box.position.y = 0.4;
  crate.add(box);
  G.scene.add(crate);
  ev.objs.push(crate);
  const n = randInt(2, 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = pos.x + Math.cos(a) * 4;
    const z = pos.z + Math.sin(a) * 4;
    const p = new THREE.Vector3(x, game.world.groundAt(x, z, pos.y + 6) + 0.1, z);
    ev.enemies.push(game.spawnEnemy('mudlurker', p));
  }
  const it = {
    id: 'washup', kind: 'washup', pos: pos.clone().add(new THREE.Vector3(0, 0.6, 0)), radius: 3.2, label: 'Salvage the wash-up',
    use: () => {
      if (ev.enemies.some((e) => !e.dead && G.actors.includes(e))) return G.ui.toast('Drive off the scavengers first.', 'bad');
      game.giveItem('bread', randInt(1, 2));
      if (Math.random() < 0.5) game.giveItem('herb', randInt(1, 2));
      G.player.addSilver(12 + game.ch.level * 3);
      G.audio.play('chest', { pos });
      game.ch.stats.washups = (game.ch.stats.washups || 0) + 1;
      endEvent(game, true);
      game.save();
    },
  };
  game.world.addInteract(it);
  ev.interacts.push(it);
  G.ui.toast('Something has washed up nearby.', 'quest');
  return ev;
}

export function startPatrol(game, findSpot) {
  const pos = findSpot(game, 50, 110);
  if (!pos) return null;
  const biome = game.world.biomeAt(pos.x, pos.z) || 'meadow';
  const types = PATROL_TYPES[biome] || PATROL_TYPES.meadow;
  const ev = { kind: 'patrol', pos, objs: [], enemies: [], t: 260 };
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6), new THREE.MeshStandardMaterial({ color: '#4a3a28', flatShading: true }));
  pole.position.copy(pos).add(new THREE.Vector3(0, 2.2, 0));
  G.scene.add(pole);
  ev.objs.push(pole);
  const n = randInt(2, 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = pos.x + Math.cos(a) * 3.5;
    const z = pos.z + Math.sin(a) * 3.5;
    const p = new THREE.Vector3(x, game.world.groundAt(x, z, pos.y + 6) + 0.1, z);
    const type = types[Math.floor(Math.random() * types.length)];
    const e = game.spawnEnemy(type, p);
    e.home = pos.clone();
    ev.enemies.push(e);
  }
  G.ui.toast('A hunting party is moving through the hills.', 'quest');
  return ev;
}

export function tickPatrol(game, ev) {
  ev.enemies = ev.enemies.filter((e) => G.actors.includes(e));
  if (ev.enemies.length && ev.enemies.every((e) => e.dead)) {
    G.player.addSilver(20 + game.ch.level * 4);
    G.player.addXp(40 + game.ch.level * 12);
    G.ui.toast('The hunting party is broken.', 'good');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- roadside happenings

function regionKey(game, x, z) {
  const isl = game.world.islandAt(x, z);
  const biome = game.world.biomeAt(x, z);
  if (biome === 'marsh') return 'marsh';
  return isl && AMBUSHERS[isl.id] ? isl.id : 'saltreach';
}

function roadDistance(game, x, z) {
  const isl = game.world.terrain.islandAt(x, z);
  return isl && isl.roadAt ? isl.roadAt(x, z).d : Infinity;
}

// Raiders who know the road wait where it bends and come out when you're in the open.
export function startAmbush(game, findSpot) {
  const p = game.player;
  if (roadDistance(game, p.pos.x, p.pos.z) > 14) return null;
  const pos = findSpot(game, 16, 28);
  if (!pos) return null;
  const table = AMBUSHERS[regionKey(game, p.pos.x, p.pos.z)];
  const ev = { kind: 'ambush', pos, objs: [], enemies: [], t: 160 };
  const n = Math.min(table.types.length, game.ch.level >= 8 ? 3 : 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = pos.x + Math.cos(a) * 3, z = pos.z + Math.sin(a) * 3;
    const e = game.spawnEnemy(table.types[i], new THREE.Vector3(x, game.world.groundAt(x, z, pos.y + 6) + 0.1, z));
    e.setAggro(p);
    ev.enemies.push(e);
  }
  G.ui.toast(table.shout, 'bad');
  return ev;
}

export function tickAmbush(game, ev) {
  ev.enemies = ev.enemies.filter((e) => G.actors.includes(e));
  if (ev.enemies.length && ev.enemies.every((e) => e.dead)) {
    const silver = 30 + game.ch.level * 6;
    G.player.addSilver(silver);
    G.player.addXp(50 + game.ch.level * 14);
    G.ui.toast(`The ambush is broken. Their purse: ${silver} silver.`, 'good');
    game.ch.stats.ambushes = (game.ch.stats.ambushes || 0) + 1;
    return true;
  }
  return false;
}

// Someone on the road is calling for help. Clear what's on them before it's too late, then
// go back and speak to them.
export function startBeset(game, findSpot, endEvent) {
  const pos = findSpot(game, 40, 80);
  if (!pos) return null;
  const tr = TRAVELLERS[Math.floor(Math.random() * TRAVELLERS.length)];
  const biome = game.world.biomeAt(pos.x, pos.z) || 'meadow';
  const types = PATROL_TYPES[biome] || PATROL_TYPES.meadow;
  const id = 'evt_traveller';
  // they turn toward you as you come: you're the help they were shouting for
  const yaw = Math.atan2(game.player.pos.x - pos.x, game.player.pos.z - pos.z);
  const npc = new NPC({ id, name: tr.name, title: tr.title, x: pos.x, z: pos.z, yaw, look: tr.look, when: () => true });
  game.npcs.push(npc);
  const ev = { kind: 'beset', pos, objs: [], enemies: [], t: 100, npc, traveller: tr, saved: false, rewarded: false };
  const n = game.ch.level >= 8 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.5;
    const x = pos.x + Math.cos(a) * 4, z = pos.z + Math.sin(a) * 4;
    const e = game.spawnEnemy(types[i % types.length], new THREE.Vector3(x, game.world.groundAt(x, z, pos.y + 6) + 0.1, z));
    e.home = pos.clone();
    ev.enemies.push(e);
  }
  DIALOGUES[id] = (api) => {
    if (!ev.saved) return { text: tr.cry, options: [{ label: 'Hold on.' }] };
    if (ev.rewarded) return { text: 'Safe roads to you.', options: [{ label: 'And you.' }] };
    return {
      text: tr.thanks,
      options: [{ label: 'Thank you.', do: () => {
        ev.rewarded = true;
        for (const [item, count] of tr.reward) game.giveItem(item, count);
        G.player.addXp(40 + game.ch.level * 10);
        game.ch.stats.rescues = (game.ch.stats.rescues || 0) + 1;
        game.save();
        ev.t = Math.min(ev.t, 12);
      } }],
    };
  };
  G.ui.toast(`Someone is shouting nearby: "${tr.cry}"`, 'quest');
  ev.cleanup = () => {
    const i = game.npcs.indexOf(npc);
    if (i >= 0) game.npcs.splice(i, 1);
    if (npc.rig && npc.rig.root.parent) npc.rig.root.parent.remove(npc.rig.root);
    if (DIALOGUES[id]) delete DIALOGUES[id];
  };
  void endEvent;
  return ev;
}

export function tickBeset(game, ev) {
  ev.enemies = ev.enemies.filter((e) => G.actors.includes(e));
  if (!ev.saved && ev.enemies.length && ev.enemies.every((e) => e.dead)) {
    ev.saved = true;
    ev.t = Math.max(ev.t, 90);
    G.ui.toast(`${ev.traveller.name} is alive. Go and speak to them.`, 'good');
  }
  if (!ev.saved && ev.t < 30 && !ev.warned) {
    ev.warned = true;
    G.ui.toast('The shouting is getting weaker.', 'bad');
  }
  return false;
}

// After dark, on some roads, a lantern moves where no one should be walking.
export function startWanderer(game, findSpot) {
  if (!game.world.sky.isNight()) return null;
  const pos = findSpot(game, 70, 130);
  if (!pos) return null;
  const e = game.spawnEnemy('night_watchman', pos.clone().add(new THREE.Vector3(0, 0.1, 0)));
  // lent by the world, which keeps the scene's light count fixed (see World.lendLight)
  const lamp = e.model && e.model.root ? game.world.lendLight(e.model.root, new THREE.Vector3(0.6, 1.6, 0.4), '#ffcf7a', 20, 1.5, 4) : null;
  const route = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    route.push([pos.x + Math.cos(a) * 26, pos.z + Math.sin(a) * 26]);
  }
  e.patrol = route;
  const ev = { kind: 'wanderer', pos, objs: [], enemies: [e], t: 420, lamp };
  G.ui.toast('A lantern is moving along the road. Nobody lights those lamps any more.', 'quest');
  return ev;
}

export function tickWanderer(game, ev) {
  ev.enemies = ev.enemies.filter((x) => G.actors.includes(x));
  const e = ev.enemies[0];
  if (e && e.dead) {
    G.ui.toast('The lantern goes out.', 'good');
    game.ch.stats.watchmen = (game.ch.stats.watchmen || 0) + 1;
    return true;
  }
  // at dawn he is simply not there any more
  if (!game.world.sky.isNight() && e && !e.aggro) {
    e.despawn = true;
    return true;
  }
  return false;
}
