// Builds the dungeons of data/dungeons.js: their rooms far to the south of the map, and the
// hatches, stairwells and cave mouths on the surface that lead down to them. Inside, the sky is
// shut out: the light is the dungeon's own torches and fires, and the air is close and dark.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Kit } from './kit.js';
import { mergeStatic } from './merge.js';
import { seededRandom, hashString, clamp } from '../core/util.js';
import { DUNGEONS, FLOOR, roomRect, roomFloor, roomPoint, roomById, inDungeonBand } from '../data/dungeons.js';
import { ADVENTURE_SITES } from '../data/adventure.js';
import { LANDFORMS } from '../data/landforms.js';

const THEMES = {
  ice: { stone: '#7d8a94', stone2: '#66737d', edge: '#a9b6be', dark: '#20262c', metal: '#6c7a84', glow: '#bfe8ff', crystal: '#b8ecff', cloth: '#4a5a6a', wood: '#5a5048', wood2: '#4a4038', floor: '#5c6870', floor2: '#53606a', accent: '#d8f0ff', fire: '#9fd8ff' },
  furnace: { stone: '#7a6a5e', stone2: '#66584e', edge: '#9a8676', dark: '#1a1614', metal: '#6a5646', glow: '#ff9a4a', crystal: '#ffb070', cloth: '#5a3a28', wood: '#5a4632', wood2: '#4a3a2a', floor: '#6a5a50', floor2: '#5e5046', accent: '#ff6a1a', fire: '#ff8a3a' },
  cave: { stone: '#5e5a52', stone2: '#4e4a44', edge: '#7a746a', dark: '#1c1a18', metal: '#4e5258', glow: '#ffc58a', crystal: '#8fe3d0', cloth: '#7a3a30', wood: '#6a5238', wood2: '#56432f', floor: '#4c4842', floor2: '#44403a', accent: '#3a6a8a', fire: '#ffb35a' },
};
const WALL = 1.2;
const DOOR_W = 4.4;

function floorAt(dg, room, x, z) {
  const r = roomRect(dg, room);
  const t = room.ramp === 'z' ? (z - r.z0) / (r.z1 - r.z0) : room.ramp === 'x' ? (x - r.x0) / (r.x1 - r.x0) : 0.5;
  return roomFloor(dg, room, clamp(t, 0, 1));
}

function linkOpenings(dg) {
  // For each link, the shared edge and the opening's centre on it.
  const out = [];
  for (const [a, b, opt = {}] of dg.links) {
    const ra = roomRect(dg, roomById(dg, a)), rb = roomRect(dg, roomById(dg, b));
    let edge = null;
    if (Math.abs(ra.z1 - rb.z0) < 0.01 || Math.abs(rb.z1 - ra.z0) < 0.01) {
      const z = Math.abs(ra.z1 - rb.z0) < 0.01 ? ra.z1 : ra.z0;
      const x0 = Math.max(ra.x0, rb.x0), x1 = Math.min(ra.x1, rb.x1);
      edge = { axis: 'z', at: z, c: (x0 + x1) / 2 };
    } else {
      const x = Math.abs(ra.x1 - rb.x0) < 0.01 ? ra.x1 : ra.x0;
      const z0 = Math.max(ra.z0, rb.z0), z1 = Math.min(ra.z1, rb.z1);
      edge = { axis: 'x', at: x, c: (z0 + z1) / 2 };
    }
    // the doorway's sill is the higher of the two floors where they meet
    const [ox, oz] = edge.axis === 'z' ? [edge.c, edge.at] : [edge.at, edge.c];
    const sill = Math.max(floorAt(dg, roomById(dg, a), ox, oz), floorAt(dg, roomById(dg, b), ox, oz));
    out.push({ a, b, ...edge, sill, gate: opt.gate || null });
  }
  return out;
}

// One wall run along a room edge, with gaps where links open; colliders follow the masonry.
function wallRun(k, world, axis, at, from, to, y0, h, gaps, inward, pal, low) {
  const cuts = gaps.filter((g) => g.c > from && g.c < to).sort((a, b) => a.c - b.c);
  let s = from;
  const segs = [];
  for (const g of cuts) {
    segs.push([s, g.c - DOOR_W / 2]);
    s = g.c + DOOR_W / 2;
  }
  segs.push([s, to]);
  const off = inward * WALL / 2;
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue;
    const mid = (a + b) / 2, len = b - a;
    const cx = axis === 'z' ? mid : at + off, cz = axis === 'z' ? at + off : mid;
    const w = axis === 'z' ? len : WALL, d = axis === 'z' ? WALL : len;
    if (low) k.slab(cx, y0, cz, w, h, d, 'stone');
    else k.masonry(cx, y0, cz, w, h, d, { c: 'stone', c2: 'stone2', course: 1.2 });
    world.colliders.addBox({ x: cx, z: cz, w, d, y0: y0 - 1, y1: y0 + h, tag: 'dungeon', walkable: false });
  }
  // lintels over the openings
  for (const g of cuts) {
    const cx = axis === 'z' ? g.c : at + off, cz = axis === 'z' ? at + off : g.c;
    const lintel = g.sill + 3.8, wallTop = y0 + h;
    if (wallTop - lintel < 0.2) continue;
    k.slab(cx, lintel, cz, axis === 'z' ? DOOR_W + 0.4 : WALL + 0.2, wallTop - lintel, axis === 'z' ? WALL + 0.2 : DOOR_W + 0.4, 'edge');
    world.colliders.addBox({ x: cx, z: cz, w: axis === 'z' ? DOOR_W : WALL, d: axis === 'z' ? WALL : DOOR_W, y0: lintel, y1: wallTop, tag: 'dungeon', walkable: false });
  }
}

function buildRoom(world, dg, room, openings, k, rng, low, lights) {
  const r = roomRect(dg, room);
  const y0 = roomFloor(dg, room, 0), y1 = roomFloor(dg, room, 1);
  const base = Math.min(y0, y1);
  const top = Math.max(y0, y1) + room.h;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, W = r.x1 - r.x0, D = r.z1 - r.z0;
  // floor: flat, or a stair climbing the ramp axis
  if (room.to == null) {
    k.slab(cx, base - 1.2, cz, W, 1.2, D, 'floor');
    world.colliders.addBox({ x: cx, z: cz, w: W, d: D, y0: base - 1.2, y1: base, tag: 'dungeon_floor' });
    if (!low) for (let i = 0; i < Math.floor(W / 2.5) * Math.floor(D / 2.5); i += 3) {
      const fx = r.x0 + 1.25 + (i % Math.floor(W / 2.5)) * 2.5, fz = r.z0 + 1.25 + Math.floor(i / Math.floor(W / 2.5)) * 2.5;
      k.slab(fx, base - 0.02, fz, 2.4, 0.04, 2.4, 'floor2');
    }
  } else {
    const along = room.ramp === 'z' ? D : W;
    const n = Math.round(along / 0.6);
    const rise = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const yy = y0 + rise * (i + 0.5) + (rise > 0 ? rise / 2 : -rise / 2) * 0;
      const top_ = y0 + rise * (i + (rise > 0 ? 1 : 0));
      const sx = room.ramp === 'z' ? cx : r.x0 + (t0 + t1) / 2 * W;
      const sz = room.ramp === 'z' ? r.z0 + (t0 + t1) / 2 * D : cz;
      const sw = room.ramp === 'z' ? W : along / n + 0.02, sd = room.ramp === 'z' ? along / n + 0.02 : D;
      const bottom = Math.min(y0, y1) - 1.2;
      k.slab(sx, bottom, sz, sw, top_ - bottom, sd, i % 2 ? 'floor' : 'floor2');
      world.colliders.addBox({ x: sx, z: sz, w: sw, d: sd, y0: bottom, y1: top_, tag: 'dungeon_floor' });
      void yy;
    }
  }
  // ceiling: never walkable, so nothing spawns on the roof
  k.slab(cx, top, cz, W + WALL, 1.4, D + WALL, 'stone2');
  world.colliders.addBox({ x: cx, z: cz, w: W + WALL, d: D + WALL, y0: top, y1: top + 1.4, tag: 'dungeon', walkable: false });
  // walls with their openings
  const mine = openings.filter((o) => o.a === room.id || o.b === room.id);
  const gapsOn = (axis, at) => mine.filter((o) => o.axis === axis && Math.abs(o.at - at) < 0.01).map((o) => ({ c: o.c, sill: o.sill }));
  const wallH = top - base + 1.2;
  const wb = base - 1.2;
  wallRun(k, world, 'z', r.z0, r.x0, r.x1, wb, wallH, gapsOn('z', r.z0), 1, null, low);
  wallRun(k, world, 'z', r.z1, r.x0, r.x1, wb, wallH, gapsOn('z', r.z1), -1, null, low);
  wallRun(k, world, 'x', r.x0, r.z0, r.z1, wb, wallH, gapsOn('x', r.x0), 1, null, low);
  wallRun(k, world, 'x', r.x1, r.z0, r.z1, wb, wallH, gapsOn('x', r.x1), -1, null, low);
  // halls carry their roofs on piers
  if (room.pillars || room.arena) {
    const nx = Math.max(1, Math.round(W / 10)), nz = Math.max(1, Math.round(D / 10));
    for (let i = 1; i < nx; i++) for (let j = 0; j <= nz; j += Math.max(1, nz)) {
      for (const zz of [r.z0 + 4, r.z1 - 4]) {
        const px = r.x0 + (W / nx) * i;
        k.pier(px, base, zz, 1.8, room.h, { d: 1.8 });
        world.colliders.addBox({ x: px, z: zz, w: 1.8, d: 1.8, y0: base - 1, y1: base + room.h, tag: 'dungeon', walkable: false });
      }
      void j;
    }
  }
  // light: a fire basket in each corner of halls, one sconce in small rooms
  const fires = room.w * room.d >= 3 ? [[r.x0 + 2, r.z0 + 2], [r.x1 - 2, r.z1 - 2]] : [[cx + W / 2 - 1.4, cz + D / 2 - 1.4]];
  for (const [fx, fz] of fires) {
    const fy = roomFloor(dg, room, room.ramp === 'z' ? (fz - r.z0) / D : 0.5);
    k.prism(fx, fy, fz, 0.18, 1.4, 'metal', { sides: 4, layer: 'metal' });
    k.prism(fx, fy + 1.4, fz, 0.55, 0.4, 'metal', { sides: 6, top: 1.3, layer: 'metal' });
    k.glowPanel(fx, fy + 1.7, fz, 0.6, 0.3, 0.6, 'fire', 1.6);
    lights.push(new THREE.Vector3(fx, fy + 2.2, fz));
  }
  return { r, base, top };
}

function decorate(world, dg, room, info, k, rng, low) {
  const { r, base } = info;
  const W = r.x1 - r.x0, D = r.z1 - r.z0;
  const rand = (a, b) => a + rng() * (b - a);
  const spot = () => [rand(r.x0 + 2, r.x1 - 2), rand(r.z0 + 2, r.z1 - 2)];
  if (dg.theme === 'ice') {
    for (let i = 0; i < (low ? 3 : 7); i++) {
      const [x, z] = spot();
      k.crystal(x, base, z, rand(0.3, 0.7), rand(1.2, 3.4), 'crystal', { rz: rand(-0.3, 0.3) });
    }
    // conduits along the walls: the relay's signal lines, iced over
    if (!low) k.slab((r.x0 + r.x1) / 2, base + room.h - 1.6, r.z0 + 1.0, W - 2, 0.4, 0.4, 'metal', { layer: 'metal' });
    if (room.arena) {
      // the great bell hangs over the chamber
      const bx = (r.x0 + r.x1) / 2, bz = r.z0 + D * 0.65;
      k.slab(bx, base + room.h - 1.2, bz, 0.3, 1.2, 0.3, 'metal', { layer: 'metal' });
      k.prism(bx, base + room.h - 5.4, bz, 2.6, 4.2, 'metal', { sides: 10, top: 0.5, layer: 'metal' });
    }
  } else if (dg.theme === 'furnace') {
    if (room.lava) {
      // a channel of melt across the room, bridged where the way crosses
      const lz = room.arena ? r.z0 + D * 0.7 : (r.z0 + r.z1) / 2;
      for (const [a, b] of [[r.x0, (r.x0 + r.x1) / 2 - 3], [(r.x0 + r.x1) / 2 + 3, r.x1]]) {
        if (b - a < 1) continue;
        k.glowPanel((a + b) / 2, base - 0.05, lz, b - a, 0.1, 2.6, 'accent', 1.5);
        world.hazards.push({ x: (a + b) / 2, z: lz, r: Math.min((b - a) / 2, 1.6), y: base, dps: 20, element: 'ember', status: 'burn' });
      }
    }
    if (!low) for (let i = 0; i < 2; i++) k.prism(r.x0 + 1.4 + i * (W - 2.8), base, r.z0 + 1.4, 0.5, room.h - 1, 'metal', { sides: 6, layer: 'metal' });
    if (room.id === 'tool_room') for (let i = 0; i < 12; i++) k.slab(r.x0 + 1.5 + i * 0.6, base + 2.2, r.z1 - 0.7, 0.08, 0.25, 0.3, 'metal', { layer: 'metal' });
  } else if (dg.theme === 'cave') {
    if (room.water) k.glowPanel((r.x0 + r.x1) / 2, base + 0.02, r.z1 - 3, W - 4, 0.06, 4, 'accent', 0.7);
    for (let i = 0; i < (low ? 2 : 5); i++) {
      const [x, z] = spot();
      k.rock(x, base + 0.3, z, rand(1.2, 2.6), rand(0.8, 1.6), rand(1.0, 2.2), 'stone2', { ry: rand(0, 3) });
    }
    if (room.id === 'landing' || room.arena) for (let i = 0; i < 4; i++) k.slab(r.x0 + 2 + i * 1.1, base, r.z0 + 2, 1.0, 1.0, 1.0, i % 2 ? 'wood' : 'wood2');
  }
}

// ---------------------------------------------------------------- the way down, on the surface
const RANGES = Object.values(LANDFORMS).flat().filter((l) => l && l.kind === 'range' && l.points);
function nearRange(x, z, pad) {
  for (const r of RANGES) for (let i = 1; i < r.points.length; i++) {
    const [ax, az] = r.points[i - 1], [bx, bz] = r.points[i];
    const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
    if (Math.hypot(x - ax - vx * t, z - az - vz * t) < r.w / 2 + pad) return true;
  }
  return false;
}

// A cave mouth wants the foot of a shelf wall: ground that is level and dry in front, and
// rises sheer (6 m in 3 m) behind. Returns { x, z, y, yaw } with yaw facing out of the wall.
export function findCaveMouth(world, anchor) {
  const H = (x, z) => world.terrain.heightAt(x, z);
  const passes = world.terrain.passes || [];
  let best = null;
  for (let ring = 0; ring <= anchor.r; ring += 4) {
    const n = ring === 0 ? 1 : Math.max(8, Math.round((ring * Math.PI * 2) / 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = anchor.x + Math.cos(a) * ring, z = anchor.z + Math.sin(a) * ring;
      const h = H(x, z);
      if (h < 1.8) continue;
      if (nearRange(x, z, 6)) continue;
      if (passes.some((p) => Math.hypot(x - (p.ax + p.bx) / 2, z - (p.az + p.bz) / 2) < 20)) continue;
      for (let k = 0; k < 16; k++) {
        const yaw = (k / 16) * Math.PI * 2;
        const bx = -Math.sin(yaw), bz = -Math.cos(yaw); // behind the mouth
        if (H(x + bx * 3, z + bz * 3) - h < 6) continue;
        // level, dry apron in front and to the sides
        let ok = true;
        for (const [fx, fz] of [[0, 3], [0, 6], [-2.5, 3], [2.5, 3], [-2.5, 0.5], [2.5, 0.5]]) {
          const px = x + Math.cos(yaw) * fx + Math.sin(yaw) * fz, pz = z - Math.sin(yaw) * fx + Math.cos(yaw) * fz;
          if (Math.abs(H(px, pz) - h) > 0.8) ok = false;
        }
        if (!ok) continue;
        if (world.colliders.groundAt(x, z, h + 20) > h + 0.4) continue;
        if ((world.exclusions || []).some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 5)) continue;
        const cost = ring * 0.1;
        if (!best || cost < best.cost) best = { x, z, y: h, yaw, cost };
      }
    }
    if (best) break;
  }
  return best;
}

function buildCaveMouth(world, at, pal, low) {
  const k = new Kit(pal, { detail: low ? 0 : 1 });
  // jambs and a heavy lintel set into the wall, with the dark of the tunnel behind
  for (const sx of [-1, 1]) k.masonry(sx * 2.6, -0.5, -0.6, 1.4, 5.2, 1.6, { c: 'stone', c2: 'stone2', course: 1 });
  k.slab(0, 4.7, -0.6, 6.8, 1.2, 1.8, 'edge');
  // the tunnel's dark: unlit, so no lamp or sun ever shows a back wall in it
  k.glowPanel(0, 2.25, -1.4, 3.8, 4.9, 0.3, '#040303', 1);
  k.slab(0, -0.05, 0.6, 4.4, 0.1, 2.4, 'floor2');
  for (let i = 0; i < 4; i++) k.rock((i - 1.5) * 2.2, 5.6, -1.4, 2.2, 1.4, 2, 'stone2', { ry: i });
  const flame = k.lantern(2.9, 0, 1.2, { post: 2.4, metal: 'metal' });
  const g = k.build('dungeon_mouth');
  g.position.set(at.x, at.y, at.z);
  g.rotation.y = at.yaw;
  world.scene.add(g);
  const c = Math.cos(at.yaw), s = Math.sin(at.yaw);
  const to = (lx, lz) => [at.x + lx * c + lz * s, at.z - lx * s + lz * c];
  for (const sx of [-1, 1]) {
    const [wx, wz] = to(sx * 2.6, -0.6);
    world.colliders.addBox({ x: wx, z: wz, w: 1.4, d: 1.6, y0: at.y - 1, y1: at.y + 4.7, rot: at.yaw, tag: 'dungeon_mouth' });
  }
  const [bx, bz] = to(0, -1.6);
  world.colliders.addBox({ x: bx, z: bz, w: 3.8, d: 0.4, y0: at.y - 1, y1: at.y + 4.7, rot: at.yaw, tag: 'dungeon_mouth' });
  world.addLight(flame.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), at.yaw).add(new THREE.Vector3(at.x, at.y, at.z)), '#ffb35a', 1.0, 12, true, 0.9);
  const [dx, dz] = to(0, 0.6);
  return { group: g, door: new THREE.Vector3(dx, at.y + 1, dz) };
}

function buildStairwell(world, at, pal, low) {
  // where there's no wall to cut into: a stone-lined stair going down into the ground
  const k = new Kit(pal, { detail: low ? 0 : 1 });
  k.slab(0, -0.4, 0, 6.4, 0.5, 8.4, 'edge');
  for (const sx of [-1, 1]) k.masonry(sx * 2.8, 0, 0, 0.8, 1.1, 8, { c: 'stone', c2: 'stone2' });
  k.masonry(0, 0, -3.8, 6.4, 1.1, 0.8, { c: 'stone', c2: 'stone2' });
  k.glowPanel(0, 0.06, 0.5, 4.6, 0.04, 6.6, '#040303', 1);
  for (let i = 0; i < 6; i++) k.slab(0, 0.06 - i * 0.02, 3.2 - i * 1.0, 4.4, 0.06, 0.4, 'stone2');
  const g = k.build('dungeon_stairwell');
  g.position.set(at.x, at.y, at.z);
  g.rotation.y = at.yaw;
  world.scene.add(g);
  return { group: g, door: new THREE.Vector3(at.x, at.y + 1, at.z) };
}

// ---------------------------------------------------------------- moving between worlds
function travel(game, pos, yaw, after) {
  if (game.transitioning || !game.player) return;
  game.transitioning = true;
  const p = game.player;
  game.ui.fade(() => {
    game.transitioning = false;
    if (game.player !== p || game.state !== 'playing') return;
    if (p.boat) p.leaveBoat();
    p.pos.copy(pos);
    if (p.vel) p.vel.set(0, 0, 0);
    p.fallStart = pos.y;
    p.yaw = yaw;
    game.camYaw = yaw;
    game.areaName = null;
    if (after) after();
    game.save();
  });
}

export function buildDungeons(world, exclusions) {
  const low = !!(G.settings && G.settings.quality === 'low');
  const roots = [];
  world.dungeons = [];
  for (const dg of DUNGEONS) {
    const pal = THEMES[dg.theme];
    const rng = seededRandom(hashString(dg.id));
    const k = new Kit(pal, { detail: low ? 0 : 1, shadow: false });
    const openings = linkOpenings(dg);
    const lights = [];
    const infos = {};
    for (const room of dg.rooms) infos[room.id] = buildRoom(world, dg, room, openings, k, rng, low, lights);
    for (const room of dg.rooms) decorate(world, dg, room, infos[room.id], k, rng, low);
    const g = k.build('dungeon_' + dg.id);
    world.scene.add(g);
    roots.push(g);
    for (const l of lights) {
      world.addLight(l, pal.fire, 2.2, 22, true, 1.4);
      world.addEmitter({ kind: 'fire', pos: l.clone().add(new THREE.Vector3(0, -0.4, 0)), rate: 8 });
    }

    // gates on gated links: a portcullis that a lever raises for good
    const gates = {};
    for (const o of openings.filter((x) => x.gate)) {
      const ra = roomById(dg, o.a);
      const y = roomFloor(dg, ra, 0);
      const gk = new Kit(pal);
      for (let i = 0; i < 6; i++) gk.slab(-DOOR_W / 2 + 0.4 + i * 0.72, 0, 0, 0.14, 3.6, 0.14, 'metal', { layer: 'metal' });
      for (const yy of [0.8, 2.2, 3.4]) gk.slab(0, yy, 0, DOOR_W, 0.14, 0.16, 'metal', { layer: 'metal' });
      const mesh = gk.build('dungeon_gate');
      mesh.position.set(o.axis === 'z' ? o.c : o.at, y, o.axis === 'z' ? o.at : o.c);
      mesh.rotation.y = o.axis === 'z' ? 0 : Math.PI / 2;
      mesh.userData.dynamic = true;
      world.scene.add(mesh);
      const col = world.colliders.addBox({ x: mesh.position.x, z: mesh.position.z, w: o.axis === 'z' ? DOOR_W : 0.6, d: o.axis === 'z' ? 0.6 : DOOR_W, y0: y - 0.5, y1: y + 3.6, tag: 'dungeon_gate', walkable: false });
      gates[o.gate] = { mesh, col, y, open: false, t: 0 };
    }
    const flagOf = (gate) => `dg_${dg.id}_${gate}`;
    const openGate = (gate, instant) => {
      const gt = gates[gate];
      if (!gt || gt.open) return;
      gt.open = true;
      world.colliders.remove(gt.col);
      if (instant) gt.mesh.position.y = gt.y + 3.4;
      else G.audio && G.audio.play('chest', { pos: gt.mesh.position });
    };
    for (const lv of dg.levers) {
      const room = roomById(dg, lv.room);
      const p = roomPoint(dg, room, lv.dx, lv.dz);
      const lk = new Kit(pal);
      lk.slab(0, 0, 0, 0.7, 1.0, 0.5, 'stone2');
      lk.slab(0, 1.0, 0, 0.16, 0.9, 0.16, 'metal', { layer: 'metal', rx: -0.5 });
      const lm = lk.build('dungeon_lever');
      lm.position.set(p.x, p.y, p.z);
      world.scene.add(lm);
      world.colliders.addBox({ x: p.x, z: p.z, w: 0.7, d: 0.5, y0: p.y - 0.5, y1: p.y + 1.0, tag: 'dungeon_lever' });
      world.addInteract({
        id: `lever_${dg.id}_${lv.gate}`, kind: 'lever', pos: new THREE.Vector3(p.x, p.y + 1, p.z), radius: 2.6, label: lv.label,
        enabled: () => !gates[lv.gate]?.open,
        use: () => {
          const ch = G.game && G.game.ch;
          if (ch) (ch.flags ||= {})[flagOf(lv.gate)] = true;
          openGate(lv.gate, false);
          G.ui && G.ui.toast('Somewhere ahead, iron grinds upward.', 'good');
          G.game && G.game.save();
        },
      });
    }

    // the way back up, at the foot of the start room
    const start = dg.start;
    const entry = { dungeon: dg, start, gates, openGate, flagOf };
    world.addInteract({
      id: `exit_${dg.id}`, kind: 'dungeon_exit', pos: new THREE.Vector3(start.x, start.y + 1, start.z - 2.5), radius: 2.8, label: 'Climb back to the surface',
      use: () => entry.surface && travel(G.game, entry.surface.out, entry.surface.yaw + Math.PI),
    });
    const ladder = new Kit(pal);
    for (const sx of [-0.5, 0.5]) ladder.slab(sx, 0, 0, 0.12, 8, 0.12, 'wood2');
    for (let i = 0; i < 12; i++) ladder.slab(0, 0.5 + i * 0.65, 0, 1.1, 0.1, 0.12, 'wood');
    const lg = ladder.build('dungeon_ladder');
    lg.position.set(start.x, start.y, start.z - 4.2);
    world.scene.add(lg);
    roots.push(lg);
    world.dungeons.push(entry);
  }
  mergeStatic(world.scene, roots);
  placeEntrances(world, exclusions, low);
  wrapSky(world);
  return world.dungeons;
}

// Entrances are placed after the adventure sites have settled (a hatch belongs to one).
function placeEntrances(world, exclusions, low) {
  for (const entry of world.dungeons) {
    const dg = entry.dungeon;
    const pal = THEMES[dg.theme];
    const e = dg.entrance;
    let at = null, door = null;
    if (e.kind === 'hatch') {
      const site = ADVENTURE_SITES.find((s) => s.id === e.site);
      if (site && site.sx != null) {
        at = { x: site.sx, z: site.sz, y: site.sy, yaw: site.yaw };
        door = new THREE.Vector3(site.sx, site.sy + 0.8, site.sz);
      }
    } else if (e.kind === 'cave') {
      at = findCaveMouth(world, e);
      if (at) door = buildCaveMouth(world, at, pal, low).door;
    }
    if (!at) {
      // no wall to cut into near the anchor: a stairwell on level ground instead
      const x = e.x ?? 0, z = e.z ?? 0;
      at = { x, z, y: world.terrain.heightAt(x, z), yaw: 0 };
      door = buildStairwell(world, at, pal, low).door;
    }
    exclusions.push({ x: at.x, z: at.z, r: 6, dungeon: dg.id });
    const c = Math.cos(at.yaw), s = Math.sin(at.yaw);
    const out = new THREE.Vector3(at.x + s * 4, 0, at.z + c * 4);
    out.y = world.groundAt(out.x, out.z, at.y + 3) + 0.1;
    entry.surface = { at, door, out, yaw: at.yaw };
    world.addInteract({
      id: `enter_${dg.id}`, kind: 'dungeon_entrance', pos: door, radius: 3.2, label: e.label,
      use: () => {
        const st = entry.start;
        travel(G.game, new THREE.Vector3(st.x, st.y + 0.2, st.z), 0, () => {
          // gates the character has already raised stay raised
          const ch = G.game.ch;
          for (const gate of Object.keys(entry.gates)) if (ch.flags && ch.flags[entry.flagOf(gate)]) entry.openGate(gate, true);
          G.ui.banner(dg.name.toUpperCase());
        });
      },
    });
  }
}

// Inside, the sky is shut out: no sun, a dim stone-cold fill from above and warmth thrown up off
// the floor, close dusky air, and the torches doing the rest.
const DARK = new THREE.Color('#17161b');
const SKY_FILL = new THREE.Color('#8f9bb0');
const FLOOR_FILL = new THREE.Color('#3a2c22');
function wrapSky(world) {
  const sky = world.sky;
  if (!sky || sky._dungeonWrapped) return;
  sky._dungeonWrapped = true;
  const orig = sky.update.bind(sky);
  let k = 0;
  sky.update = (dt, center, camera, inRift) => {
    orig(dt, center, camera, inRift);
    const inside = !!(center && inDungeonBand(center.x, center.z));
    k = clamp(k + (inside ? dt : -dt) * 2.5, 0, 1);
    if (k <= 0) return;
    // the rooms cast no shadow, so a weak cold key from above reads as the stone's own pallor
    sky.sun.intensity = sky.sun.intensity * (1 - k) + 0.6 * k;
    sky.sun.color.lerp(SKY_FILL, k);
    sky.hemi.intensity = sky.hemi.intensity * (1 - k) + 1.25 * k;
    sky.hemi.color.lerp(SKY_FILL, k);
    sky.hemi.groundColor.lerp(FLOOR_FILL, k);
    if (sky.fill) sky.fill.intensity = sky.fill.intensity * (1 - k) + 0.18 * k;
    const fog = world.scene.fog;
    if (fog) {
      fog.color.lerp(DARK, k);
      fog.near = fog.near * (1 - k) + 12 * k;
      fog.far = fog.far * (1 - k) + 130 * k;
    }
  };
}

export function inDungeon(pos) {
  return !!pos && inDungeonBand(pos.x, pos.z);
}
void FLOOR;
