import { placeCatalog } from '../data/worldPlacement.js';
// Small interactive landmarks: lore tablets and fishing spots.
import * as THREE from 'three';
import { LORE } from '../data/lore.js';
import { STRUCTURES } from '../data/world.js';
import { act } from '../game/hooks.js';
import { G } from '../core/globals.js';
import { mat } from './props.js';

// Extra fishing spots beyond dock ends: { x, z, pool } (pool picks the catch table)
export const FISHING_SPOTS = [
  { x: -22, z: -370, pool: 'shore' },
  { x: -112, z: 90, pool: 'shore' },
  { x: -550, z: -290, pool: 'marsh' },
  { x: -640, z: -270, pool: 'marsh' },
  { x: -860, z: 900, pool: 'cold' },
  { x: 890, z: 870, pool: 'ash' },
  { x: -95, z: 1040, pool: 'jungle' },
  { x: 5905, z: 5900, pool: 'rift' },
  { x: 6080, z: 6150, pool: 'rift' },
];

placeCatalog(FISHING_SPOTS);

// Written sources sit on whatever would really carry them: a book on a lectern, a notice
// pinned to a post, a letter left on a crate, words cut into stone. Nothing glows; the
// Journal's Sources list says where each one was left.
const CARRIER_RULES = [
  [/notice|orders|writ|charter|hymn|missing/i, 'notice'],
  [/letter|confession|testament|prayer|instructions|relief order|warning/i, 'letter'],
  [/inscription|stone|plaque|carving|vigil|totem|effigy|scratch|chairs|bell|tally|plate|covenant/i, 'carving'],
];
export function carrierOf(l) {
  if (l.prop) return l.prop;
  for (const [re, kind] of CARRIER_RULES) if (re.test(l.title)) return kind;
  return 'book';
}
const NEAR_STRUCTURE = new Set(['ruins', 'shrine_ruin', 'anchor_statue', 'stone_circle', 'listening_stones', 'bell_frame', 'lighthouse', 'throne', 'obelisk', 'ice_arena', 'wreck', 'chair_field', 'gallows']);

function carrierMesh(kind, l, rift) {
  const g = new THREE.Group();
  const wood = mat(rift ? '#3a3040' : '#5e4a36');
  const paper = mat('#d9ccae');
  if (kind === 'book') {
    // a lectern with an open book
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), wood);
    post.position.y = 0.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.6), wood);
    top.position.y = 1.05;
    top.rotation.x = -0.35;
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.44), paper);
    book.position.set(0, 1.12, 0.02);
    book.rotation.x = -0.35;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.5), wood);
    foot.position.y = 0.05;
    g.add(post, top, book, foot);
    return { g, h: 1.2, w: 0.7, d: 0.6 };
  }
  if (kind === 'notice') {
    // a post with a pinned, weathered sheet and a small rain hood
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), wood);
    post.position.y = 1.1;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.06), wood);
    board.position.set(0, 1.55, 0.1);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.02), paper);
    sheet.position.set(0, 1.55, 0.14);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.3), wood);
    hood.position.set(0, 1.95, 0.12);
    hood.rotation.x = 0.3;
    g.add(post, board, sheet, hood);
    return { g, h: 2.2, w: 0.9, d: 0.3 };
  }
  if (kind === 'letter') {
    // a crate with a folded letter weighted by a stone
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), mat('#7a6040'));
    crate.position.y = 0.35;
    const letter = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), paper);
    letter.position.set(0.05, 0.71, 0);
    letter.rotation.y = 0.4;
    const weight = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), mat('#77736a'));
    weight.position.set(0.12, 0.76, 0.04);
    g.add(crate, letter, weight);
    return { g, h: 0.8, w: 0.8, d: 0.8 };
  }
  // carving: a weathered boulder with one face dressed flat and cut with lines of text
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), mat(rift ? '#3a3046' : '#8a857a'));
  rock.scale.set(1.2, 1.0, 0.8);
  rock.position.y = 0.6;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.06), mat(rift ? '#4a405a' : '#9c978b'));
  face.position.set(0, 0.75, 0.6);
  face.rotation.x = -0.12;
  g.add(rock, face);
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.7 - (i % 2) * 0.15, 0.03, 0.02), mat('#5f5b52'));
    line.position.set(0, 0.98 - i * 0.14, 0.64 - i * 0.017);
    line.rotation.x = -0.12;
    g.add(line);
  }
  return { g, h: 1.3, w: 1.6, d: 1.2 };
}

export function buildLandmarks(world, exclusions) {
  const terrain = world.terrain;
  // ---- written sources
  world.loreTablets = [];
  const structures = STRUCTURES;
  for (const l of LORE) {
    const kind = carrierOf(l);
    const rift = l.x > 3000;
    const ground = terrain.heightAt(l.x, l.z);
    // records left on a raised floor (a dungeon's rooms) carry their own height
    const y = l.y ?? Math.max(ground, world.colliders.groundAt(l.x, l.z, ground + 0.6));
    // carvings beside a real ruin, statue or stone need no extra prop
    const host = kind === 'carving' && structures.find((st) => NEAR_STRUCTURE.has(st.type) && Math.hypot(st.x - l.x, st.z - l.z) < 14);
    let g = null;
    if (!host) {
      const c = carrierMesh(kind, l, rift);
      g = c.g;
      g.position.set(l.x, y, l.z);
      g.rotation.y = Math.atan2(-l.x % 7, 1) + l.z * 0.01;
      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      world.scene.add(g);
      world.colliders.addBox({ x: l.x, z: l.z, w: c.w, d: c.d, y0: y - 1, y1: y + c.h, rot: g.rotation.y });
      exclusions.push({ x: l.x, z: l.z, r: 2 });
    }
    const tab = { lore: l, group: g, kind };
    world.loreTablets.push(tab);
    const verb = kind === 'carving' ? 'Read the carving' : kind === 'notice' ? 'Read the notice' : kind === 'letter' ? 'Read the letter' : 'Read';
    tab.interaction = world.addInteract({
      id: 'lore_' + l.id, kind: 'lore', pos: new THREE.Vector3(l.x, y + 1, l.z), radius: host ? 4 : 2.6, label: `${verb}: ${l.title}`,
      use: (game) => act('readLore', l.id),
    });
    tab.verb = verb;
  }
  world.animated.push(() => {
    const read = new Set(G.game?.ch?.lore || []);
    for (const tab of world.loreTablets) {
      const recorded = read.has(tab.lore.id);
      if (recorded === tab.recorded) continue;
      tab.recorded = recorded;
      tab.interaction.label = recorded ? `Revisit: ${tab.lore.title}` : `${tab.verb}: ${tab.lore.title}`;
    }
  });

  // ---- fishing spots: dock ends + listed shores
  const spots = [];
  for (const id in world.docks) {
    const d = world.docks[id];
    spots.push({ x: d.end.x, z: d.end.z, pool: id === 'dock_frost' ? 'cold' : id === 'dock_ash' ? 'ash' : id === 'dock_verd' ? 'jungle' : 'shore', dock: true });
  }
  for (const s of FISHING_SPOTS) spots.push(s);
  world.fishingSpots = [];
  for (const s of spots) {
    const ground = terrain.heightAt(s.x, s.z);
    const pos = new THREE.Vector3(s.x, Math.max(ground, s.dock ? 0.9 : ground) + 0.6, s.z);
    // where the line goes in: the nearest water, a few meters out (no marker on it; the spot's
    // own prompt finds it)
    const wy = s.pool === 'rift' ? ground + 0.05 : -0.05;
    let wx = s.x;
    let wz = s.z;
    if (!s.dock && s.pool !== 'rift') {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = s.x + Math.cos(ang) * 6;
        const z = s.z + Math.sin(ang) * 6;
        if (terrain.heightAt(x, z) < -0.6) {
          wx = x;
          wz = z;
          break;
        }
      }
    } else if (s.dock) {
      const d = Object.values(world.docks).find((k) => k.end.x === s.x && k.end.z === s.z);
      if (d) {
        wx = s.x + d.dir.x * 3;
        wz = s.z + d.dir.z * 3;
      }
    }
    const spot = { pos, pool: s.pool, water: new THREE.Vector3(wx, wy, wz) };
    world.fishingSpots.push(spot);
    world.addInteract({ id: 'fish_' + world.fishingSpots.length, kind: 'fishing', pos, radius: s.dock ? 3.2 : 4, label: 'Fish', use: (game) => act('startFishing', spot) });
  }
}
