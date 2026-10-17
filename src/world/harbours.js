// Harbours. A ferry landing is a small harbour, not a plank in the sea: a timber pier on
// piles, a stone quay where it meets the shore, the ferry post where the ferryman keeps his
// bell and his board of sea-roads, a store for the boats' gear, and lamps along the way out.
// Piers for ships and the harbour cranes are built the same way, on piles to the seabed.
//
// Local frame: the pier runs along +z from the dock's root out to sea; the boats berth on
// its +x side (game/travel.js dockBerth), so the rail and the lamps keep to -x.
import * as THREE from 'three';
import { Mason } from './mason.js';
import * as F from './furnishing.js';
import { STRUCTURES, NPCS } from '../data/world.js';

const DOCK_PALETTE = { dock_salt: 'salt', dock_thorn: 'redwake', dock_frost: 'frost', dock_ash: 'cinder',
  dock_verd: 'root', dock_meridian: 'enclave', dock_hush: 'hush', dock_north: 'salt', dock_anchor: 'salt', dock_ebb: 'salt' };
// Where each landing's sea-roads lead, for the arms of its ferry post.
const SEA_ROADS = {
  dock_north: ['dock_hush', 'dock_anchor', 'dock_salt'],
  dock_anchor: ['dock_north', 'dock_salt'],
  dock_ebb: ['dock_salt'],
};

const DECK = 1.5;

function pierDeck(m, len, w, o = {}) {
  // planks in short lengths across stringers, piles in pairs every 4 m, braced
  for (let z = 0; z < len; z += 1.2) {
    const l = Math.min(1.16, len - z);
    m.trim(0, DECK - 0.18, z + l / 2, w, 0.16, l, (Math.floor(z / 1.2) % 3 === 1) ? 'timber' : 'wood', { grad: 0.04 });
  }
  for (const sx of [-1, 1]) m.trim(sx * (w / 2 - 0.15), DECK - 0.5, len / 2, 0.24, 0.32, len, 'timber');
  for (let z = 0.4; z <= len; z += 4) for (const sx of [-1, 1]) {
    const p = m.point(sx * (w / 2 - 0.1), 0, z);
    const floor = Math.min(m.world.terrain.heightAt(p.x, p.z), DECK - 1) - 1.5;
    m.trim(sx * (w / 2 - 0.1), floor, z, 0.32, DECK - 0.2 - floor, 0.32, 'timber');
    if (z + 4 <= len && DECK - floor > 2) m.trim(sx * (w / 2 - 0.1), (floor + DECK) / 2 - 0.4, z + 2, 0.12, 0.12, 4.2, 'dark', { rx: Math.atan2(DECK - floor - 1, 4) * sx * 0.5 });
  }
  // the deck is walkable its whole length; it never sinks into the sea
  for (let z = 0; z < len; z += 2) m.solid(0, DECK - 3, Math.min(len - 1, z + 1), w, 3, 2.1, { climbable: false });
}

export function buildDock(world, s, exclusions, add) {
  const len = s.len, w = 3.2;
  const yaw = s.yawResolved;
  const m = new Mason(world, { x: s.x, z: s.z, yaw, y: 0, palette: DOCK_PALETTE[s.id] || 'salt', tag: 'dock', name: `Harbour: ${s.id}`, lights: 4 });
  pierDeck(m, len, w);
  // the rail on the landward side, lamps on it every dozen metres, a lamp at the head
  m.rail(-w / 2 + 0.05, 1.5, -w / 2 + 0.05, len - 0.4, DECK, { c: 'timber' });
  for (let z = 10; z < len - 3; z += 12) m.lantern(-w / 2 - 0.05, DECK, z, { post: 2.4, light: false, intensity: 0.8 });
  m.lantern(-w / 2 - 0.05, DECK, len - 1, { post: 2.6, intensity: 1.2, priority: 0.8 });
  // the head: a mooring dolphin of bundled piles and bollards on the berth side
  for (const [dx, dz] of [[w / 2 + 0.5, len - 0.5], [w / 2 + 0.9, len - 0.9], [w / 2 + 0.5, len - 1.3]]) {
    const p = m.point(dx, 0, dz), floor = Math.min(world.terrain.heightAt(p.x, p.z), 0) - 1.5;
    m.trim(dx, floor, dz, 0.36, DECK + 0.7 - floor, 0.36, 'timber');
  }
  for (let z = 4; z < len; z += 9) m.k.prism(w / 2 - 0.3, DECK, z, 0.16, 0.5, 'dark', { sides: 6 });

  // the quay at the root: a stone platform set into the shore, steps where the shore is low
  // its top meets the shore at the pier's root; it runs inland only as far as the shore stays
  // below it, so the quay is set into the beach and never buried by it
  const qw = 10;
  const qTop = Math.max(DECK + 0.1, m.ground(0, -0.5) + 0.15);
  let qd = 2.5;
  while (qd < 7 && m.highest(qw, 0.6, 0, -qd - 0.3) < qTop + 0.2) qd += 0.5;
  m.footing(0, -qd / 2, qw, qd, qTop, { c: 'stone2', cap: 'edge' });
  m.floor(0, qTop + 0.01, -qd / 2, qw - 0.4, qd - 0.4, 'stone', { t: 0.2 });
  if (qTop - DECK > 0.35) m.stair(0, 0.2 + Math.ceil((qTop - DECK) / 0.3) * 0.45, Math.PI, w - 0.2, DECK, qTop, { run: 0.45, base: DECK - 1 });
  for (const sx of [-1, 1]) m.k.prism(sx * (qw / 2 - 0.6), qTop, -0.4, 0.22, 0.6, 'dark', { sides: 6 });
  const back = m.ground(0, -qd - 1.2);
  if (back < qTop - 0.4) m.stair(0, -qd - Math.ceil((qTop - back) / 0.3) * 0.45, 0, 2.4, back, qTop, { run: 0.45 });

  // the ferry post: a booth with a counter toward the pier, the bell and the board of roads
  // the booth stands on the side of the quay away from the ferryman, who waits by the pier
  const ferryman = NPCS.find(n => Math.hypot(n.x - s.x, n.z - s.z) < 16);
  const away = (lx) => { if (!ferryman) return Infinity; const [px, pz] = m.f.at(lx, -4.6); return Math.hypot(px - ferryman.x, pz - ferryman.z); };
  const bx = away(-3.4) >= away(3.4) ? -3.4 : 3.4;
  const by = qTop;
  const bz = -Math.max(1.3, qd - 1.3);
  m.block(bx, by, bz, 2.6, 2.6, 2.2, 'timber', { walkable: false });
  m.glow(bx, by + 1.5, bz + 1.12, 1.2, 0.7, 0.04, 1.1);
  m.trim(bx, by + 1.0, bz + 1.3, 1.9, 0.08, 0.5, 'wood');
  m.roof(bx, by + 2.6, bz, 2.6, 2.2, 1.0, { kind: 'gable', along: 'x', overhang: 0.35 });
  m.trim(bx + 1.5, by + 2.1, bz + 1.0, 0.7, 0.1, 0.1, 'metal', { layer: 'metal' });
  m.k.prism(bx + 1.8, by + 1.45, bz + 1.0, 0.22, 0.45, 'bell', { sides: 8, top: 0.45, layer: 'metal' });
  m.lantern(bx - 1.5, by + 1.7, bz + 1.05, { post: 0, intensity: 1.0, priority: 0.9 });
  // the signpost: one arm for each sea-road this landing serves
  const sx0 = -bx * 0.6, sz0 = -1.2;
  m.block(sx0, by, sz0, 0.18, 3.0, 0.18, 'timber', { walkable: false });
  const roads = SEA_ROADS[s.id] || STRUCTURES.filter(o => o.type === 'dock' && o.id !== s.id).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z)).slice(0, 3).map(o => o.id);
  roads.forEach((id, i) => {
    const to = STRUCTURES.find(o => o.type === 'dock' && o.id === id) || ANCHOR;
    const head = Math.atan2(to.x - s.x, to.z - s.z) - yaw;
    m.at(sx0, sz0, head, (mm) => {
      mm.trim(0, by + 2.5 - i * 0.42, 0.55, 0.06, 0.26, 1.1, 'wood');
      mm.trim(0, by + 2.5 - i * 0.42, 1.18, 0.06, 0.18, 0.2, 'wood', { rx: 0.0 });
    });
  });
  // the store: a small shed for oars, nets and cordage, crates stacked by it
  const ssx = -bx;
  m.block(ssx, by, bz, 3.0, 2.4, 2.2, 'plaster', { walkable: false });
  m.roof(ssx, by + 2.4, bz, 3.0, 2.2, 0.9, { kind: 'gable', along: 'x', overhang: 0.3 });
  m.trim(ssx, by, bz + 1.12, 1.0, 1.9, 0.06, 'dark', { grad: 0 });
  F.crate(m, ssx + Math.sign(ssx) * 1.9, by, bz - 0.4, 0.8); F.crate(m, ssx + Math.sign(ssx) * 1.9, by + 0.8, bz - 0.4, 0.6); F.barrel(m, ssx + Math.sign(ssx) * 1.9, by, bz + 0.7);
  exclusions.push({ ...m.point(0, 0, -qd / 2), r: 8 }, { ...m.point(0, 0, len / 2), r: Math.max(5, len / 2) });

  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const start = new THREE.Vector3(s.x, DECK, s.z);
  const end = start.clone().addScaledVector(dir, len - 2);
  world.docks[s.id] = { start, end, yaw, dir, quay: m.point(0, qTop, -qd / 2) };
  add(m.build());
}

// The Anchor's Fall has no ferryman; its jetty is the far end of the North Watch crossing.
const ANCHOR = { x: 0, z: 700 };

// A ship's pier: wider, railed both sides, bollards for the warps.
export function buildShipPier(world, s, add, exclusions) {
  const len = s.len || 24, w = s.w || 3.6;
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, y: 0, palette: s.style === 'enclave' ? 'enclave' : s.x > 300 && s.z > 100 ? 'redwake' : 'salt', tag: 'pier', name: 'Pier', lights: 2 });
  pierDeck(m, len, w);
  for (const sx of [-1, 1]) m.rail(sx * (w / 2 - 0.05), 1, sx * (w / 2 - 0.05), len - 0.3, DECK, { c: 'timber' });
  for (let z = 5; z < len; z += 7) m.k.prism(w / 2 - 0.35, DECK, z, 0.16, 0.5, 'dark', { sides: 6 });
  m.lantern(w / 2 + 0.05, DECK, len - 1, { post: 2.4, intensity: 1, priority: 0.7 });
  F.crate(m, -w / 2 + 0.7, DECK, len * 0.3, 0.8); F.crate(m, -w / 2 + 0.7, DECK, len * 0.3 + 0.9, 0.8); F.barrel(m, -w / 2 + 0.7, DECK, len * 0.3 + 1.9);
  exclusions?.push({ ...m.point(0, 0, len / 2), r: len / 2 });
  add(m.build());
}

// A harbour crane: a timber post and jib turning on a stone foot, a treadwheel hoist, its
// rope and hook. Over water it stands on its own platform of piles.
export function buildHarbourCrane(world, s, add) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: s.rot || 0, y: 0, palette: s.style === 'enclave' ? 'enclave' : 'salt', tag: 'crane', name: 'Harbour crane', lights: 0 });
  const ground = world.terrain.heightAt(s.x, s.z);
  const base = Math.max(DECK, ground + 0.2);
  if (ground < base - 0.3) {
    // a pile platform from the seabed, decked at the pier's height
    m.trim(0, base - 0.25, 0, 3.6, 0.25, 3.6, 'wood');
    m.solid(0, base - 3, 0, 3.6, 3, 3.6, { climbable: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = m.point(sx * 1.6, 0, sz * 1.6), floor = Math.min(world.terrain.heightAt(p.x, p.z), base - 1) - 1.5;
      m.trim(sx * 1.6, floor, sz * 1.6, 0.34, base - floor - 0.25, 0.34, 'timber');
    }
  } else m.footing(0, 0, 3.4, 3.4, base, { c: 'stone2' });
  m.block(0, base, 0, 1.6, 0.5, 1.6, 'stone', { walkable: false });
  m.block(0, base + 0.5, 0, 0.55, 8.5, 0.55, 'timber', { walkable: false });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m.trim(dx * 0.7, base + 0.5, dz * 0.7, 0.18, 3, 0.18, 'timber', { rz: -dx * 0.25, rx: dz * 0.25 });
  // the jib, tied back to the post head, the hook hanging over the berth
  m.trim(0, base + 8.6, 2.6, 0.32, 0.32, 6.0, 'timber', { rx: -0.25 });
  m.trim(0, base + 7.8, 0.9, 0.08, 0.08, 2.2, 'dark', { rx: 0.6 });
  m.trim(0, base + 6.2, 5.3, 0.05, 3.4, 0.05, 'dark');
  m.trim(0, base + 5.7, 5.3, 0.4, 0.5, 0.3, 'metal', { layer: 'metal' });
  // the treadwheel beside the post
  m.k.prism(-1.4, base + 0.5, 0, 1.3, 0.5, 'wood', { sides: 12, rz: Math.PI / 2 });
  m.trim(-1.4, base + 0.5, 0, 0.6, 2.6, 0.2, 'timber');
  add(m.build());
}

// A harbour wall: a stone quay along the shore or a mole out into the sea, coursed from the
// seabed up to its walk at `top`. `path` runs along the wall's centre; `sea` says which side
// the open water is on: +1 is each run's local +x as Mason turns it (world (cos ry, -sin ry)
// for a run heading ry), -1 the other side. A mole keeps a parapet on that side and berths on the other; a quay keeps its sea
// edge clear for berthing. Bollards stand along the berth, lamps along the landward edge,
// and the last point can carry a harbour light (`head: 'light'`) or a watch brazier ('beacon').
export function buildHarbourWall(world, s, add, exclusions) {
  const path = s.path, w = s.w ?? 7, top = s.top ?? 2.6, mole = s.kind === 'mole', sea = s.sea ?? 1;
  const [ox, oz] = path[0];
  const m = new Mason(world, { x: ox, z: oz, yaw: 0, y: 0, palette: s.style === 'enclave' ? 'enclave' : 'salt', tag: 'harbour_wall', name: s.name || 'Harbour wall', lights: 6 });
  const berth = mole ? -sea : sea;
  let run = 0, nextLamp = 6;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1][0] - ox, az = path[i - 1][1] - oz, bx = path[i][0] - ox, bz = path[i][1] - oz;
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    m.at((ax + bx) / 2, (az + bz) / 2, ry, (q) => {
      q.footing(0, 0, w, len + 0.8, top, { c: 'stone2', cap: 'edge', cell: 3 });
      q.floor(0, top + 0.02, 0, w - 0.5, len + 0.6, 'stone', { t: 0.12, solid: false });
      if (mole) q.parapet(sea * (w / 2 - 0.25), -len / 2, sea * (w / 2 - 0.25), len / 2, top, { h: 1.1 });
      for (let z = -len / 2 + 3; z < len / 2 - 1; z += 7) q.k.prism(berth * (w / 2 - 0.45), top, z, 0.2, 0.55, 'dark', { sides: 6 });
      // lamps on the landward edge (a mole's lamps stand by its parapet)
      const lampX = mole ? sea * (w / 2 - 0.9) : -sea * (w / 2 - 0.5);
      while (nextLamp < run + len) {
        q.lantern(lampX, top, nextLamp - run - len / 2, { post: 3.2, intensity: 0.9, priority: 0.6 });
        nextLamp += 18;
      }
      // a stair down to the water at the middle of every long berth
      if (len > 30) q.block(berth * (w / 2 + 0.6), -1.2, 0, 1.2, top - 0.6 + 1.2, 3.2, 'stone', { climbable: true });
    });
    run += len;
    for (let t = 0; t <= len; t += 10) exclusions.push({ x: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t / len, z: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t / len, r: w / 2 + 3 });
  }
  const [hx, hz] = [path[path.length - 1][0] - ox, path[path.length - 1][1] - oz];
  const pz = path[path.length - 2], hry = Math.atan2(hx - (pz[0] - ox), hz - (pz[1] - oz));
  m.at(hx, hz, hry, (q) => {
    // the head: a round platform wider than the wall
    q.footing(0, 0, w + 4, w + 4, top, { c: 'stone2', cap: 'edge', cell: 3 });
    if (s.head === 'light') {
      // the harbour light: a stone drum in three stages, a lantern room and its cap
      const R = 2.6, H = s.lightH ?? 14;
      let y = top, r = R;
      for (let k = 0; k < 3; k++) {
        const h = H / 3, r1 = r * 0.92;
        q.k.prism(0, y, 0, r, h, k % 2 ? 'stone2' : 'stone', { sides: 10, top: r1 / r });
        q.k.prism(0, y + h - 0.3, 0, r1 + 0.16, 0.3, 'edge', { sides: 10 });
        y += h; r = r1;
      }
      q.pillar(0, top, 0, R, H, { climbable: true });
      q.k.prism(0, y, 0, r + 0.9, 0.3, 'edge', { sides: 10 });
      q.k.prism(0, y + 0.3, 0, r * 0.62, 2.0, 'glow', { sides: 8, layer: 'glow', strength: 1.6 });
      q.light(0, y + 1.3, 0, { intensity: 4, distance: 40, priority: 0.8 });
      q.k.pyramid(0, y + 2.3, 0, r * 0.62 + 0.5, 1.8, 'roof', { sides: 8 });
      q.banner(0, top + H * 0.55, -R - 0.05, 1.4, 3.2, 'cloth', Math.PI);
    } else if (s.head === 'beacon') {
      q.block(0, top, 0, 1.6, 1.4, 1.6, 'stone', { walkable: false });
      q.k.prism(0, top + 1.4, 0, 0.9, 0.5, 'metal', { sides: 8, top: 1.3, layer: 'metal' });
      q.k.prism(0, top + 1.75, 0, 0.6, 0.6, 'glow', { sides: 6, layer: 'glow', strength: 1.4 });
      q.light(0, top + 2.4, 0, { intensity: 2.5, distance: 24, priority: 0.7, color: '#ff9a4a' });
    }
  });
  exclusions.push({ x: path[path.length - 1][0], z: path[path.length - 1][1], r: w / 2 + 6 });
  add(m.build());
}
