// Set pieces out on the land, each laid by one mason in its own palette and recorded with
// its rooms and the routes a walker takes through it (world.seats), like the faction seats:
//
//   the Chair Fields       the Ministry's field on the Hush moor: one empty chair for each
//                          person who did not come back up, in rows on shallow terraces that
//                          step down toward the sea, and the clerk's stand that keeps the count
//   the Listening Stones   the Vahl ring older than the Compact, raised on its dais, with the
//                          tallest stone the ear is put to, the fallen stone with the chalk
//                          tally, and the Ministry's sounding horn and measuring post
//   Mother's Mire          the broken Compact outfall in central Shimmerfen whose warm
//                          discharge the Bog Mother breeds in, its pools stepping down to her
//                          wallow, and the Reed Covenant's hide and feeding stage that keep her
//                          to the mire
//
// Each faces its record's (x2, z2): local +z points there, so placement carries it with the
// site. Lore, chests and boss grounds are kept clear (tests/architecture.test.js).
import { Mason, BUILD_PALETTES } from './mason.js';
import * as F from './furnishing.js';
import { LORE } from '../data/lore.js';
import { CHESTS } from '../data/world.js';

const facing = (s) => (Number.isFinite(s.x2) ? Math.atan2(s.x2 - s.x, s.z2 - s.z) : s.rot || 0);
const hash = (a, b, k = 0) => {
  const h = Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453;
  return h - Math.floor(h);
};
const record = (world, id, name, rooms, routes) => (world.seats ||= []).push({ id, name, rooms, routes });

// ---------------------------------------------------------------- the Chair Fields
// Local frame: +z toward the sea, the field centred on the record. Each terrace carries two
// rows; an aisle runs down the middle from the clerk's stand at the landward head to the kerb.
export function buildChairFields(world, s, add, exclusions) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: facing(s), palette: 'hush', tag: 'chair_fields', name: s.name, lights: 4 });
  const rooms = [], routes = [];
  const rows = s.rows || 6, cols = s.cols || 10, pitch = 2.3, rowD = 2.8, aisle = 3.2;
  const tiers = Math.ceil(rows / 2), tierD = rowD * 2 + 0.6, W = cols * pitch + aisle + 1.6, D = tiers * tierD;
  const z0 = -D / 2;
  // the terraces: the seaward one paved just over the moor, each landward one a riser higher
  const low = m.highest(W, tierD, 0, D / 2 - tierD / 2) + 0.15;
  const top = (t) => low + (tiers - 1 - t) * 0.3;
  for (let t = 0; t < tiers; t++) m.footing(0, z0 + tierD * (t + 0.5), W, tierD, top(t), { c: 'stone2', cap: 'edge', sink: 0.6 });
  const colX = (c) => {
    const half = cols / 2;
    return c < half ? -aisle / 2 - pitch / 2 - (half - 1 - c) * pitch : aisle / 2 + pitch / 2 + (c - half) * pitch;
  };
  // the chairs: plain timber on a stone foot, all facing the sea; a few turned to the land
  const turned = [];
  for (let r = 0; r < rows; r++) {
    const t = Math.floor(r / 2), z = z0 + tierD * (t + 0.5) + (r % 2 ? rowD / 2 : -rowD / 2), y = top(t);
    for (let c = 0; c < cols; c++) {
      const x = colX(c), back = hash(r, c, s.x) < 0.05;
      m.trim(x, y, z, 0.7, 0.1, 0.7, 'stone');
      F.chair(m, x, y + 0.1, z, { ry: back ? Math.PI : 0, c: 'wood' });
      m.solid(x, y, z, 0.6, 1.05, 0.6, { walkable: false });
      if (back) turned.push(m.point(x, y, z));
    }
  }
  rooms.push({ name: 'The Rows', use: 'one empty chair for every person who did not come back up, all of them facing the sea', at: m.point(0, top(1), 0) });
  if (turned.length) rooms.push({ name: 'The Turned Chairs', use: 'the few chairs turned to face the land, each for someone the sea gave back', at: turned[0] });
  // the seaward kerb and the lamps at the field's corners
  m.trim(0, low - 0.1, D / 2 - 0.2, W, 0.4, 0.4, 'edge');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.lanternStand(m, sx * (W / 2 - 0.5), top(sz < 0 ? 0 : tiers - 1), sz * (D / 2 - 0.5), { post: 2.0, light: sz < 0 && sx > 0, intensity: 1.0 });
  // the clerk's stand: a roofed booth on its own step at the landward head of the aisle,
  // the count kept on a board, a bell rung when a chair is turned
  const SZ = z0 - 2.4, sy = top(0);
  m.footing(0, SZ, 5.2, 4.2, sy + 0.3, { c: 'stone', cap: 'edge', sink: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.block(sx * 2.1, sy + 0.3, SZ + sz * 1.6, 0.26, 2.6, 0.26, 'timber', { walkable: false });
  m.roof(0, sy + 2.9, SZ, 5.0, 4.0, 1.3, { flare: 0.5, overhang: 0.5, c: 'roof' });
  F.table(m, 0, sy + 0.3, SZ - 0.6, 1.6, 0.7, { h: 1.0 });
  m.trim(0.2, sy + 1.3, SZ - 0.6, 0.6, 0.05, 0.42, 'plaster', { ry: 0.15 });
  // the count, chalked on a board between the back posts: strokes in fives, no names
  m.block(0, sy + 0.9, SZ - 1.6, 4.2, 1.3, 0.1, 'wood', { walkable: false });
  for (let i = 0; i < 24; i++) m.trim(-1.25 + (i % 12) * 0.22, sy + 1.05 + Math.floor(i / 12) * 0.5, SZ - 1.54, 0.04, 0.34, 0.02, 'plaster');
  F.bell(m, 3.7, m.ground(3.7, SZ), SZ, { h: 2.4, s: 0.45, ry: Math.PI / 2 });
  m.hanging(0, sy + 2.9, SZ + 0.3, 0.8, { intensity: 1.2, distance: 10 });
  m.shelter(0, SZ, 5.0, 4.0, sy, sy + 2.9);
  rooms.push({ name: "The Clerk's Stand", use: 'where a Ministry clerk keeps the count with no names, and turns a chair when someone comes back', at: m.point(0, sy + 0.3, SZ) });
  routes.push({ id: 'the aisle from the stand to the sea', y0: 0, points: [[0, SZ + 0.8], [0, z0 + 0.5], [0, D / 2 - 1.2]].map(([x, z]) => m.point(x, 0, z)) });
  exclusions.push({ x: s.x, z: s.z, r: Math.hypot(W, D) / 2 + 3 });
  record(world, 'chair_fields', s.name, rooms, routes);
  add(m.build());
}

// ---------------------------------------------------------------- the Listening Stones
// Local frame: +z toward the sea, the ring centred on the record. The tallest stone stands on
// the seaward side of the ring; the fallen one lies beside the carving (data/lore.js
// listening_stones), which stays clear to read.
const VAHL = { vahl: '#7d7a72', vahl2: '#6a675f', lichen: '#7d8a5a', chalk: '#e8e4d8', brass: '#a8893f' };
export function buildListeningStones(world, s, add, exclusions) {
  const m = new Mason(world, { x: s.x, z: s.z, yaw: facing(s), palette: { ...BUILD_PALETTES.hush, ...VAHL }, tag: 'listening_stones', name: s.name, lights: 3 });
  const rooms = [], routes = [];
  const n = s.n || 11, R = s.r || 10;
  // the dais: two shallow rings of fitted stone, level with the highest of the moor under them
  // on a slope it is sunk into the uphill side rather than stood proud of the downhill one
  const low = m.lowest(R * 2 + 6, R * 2 + 6), lo = low - 0.6, d0 = Math.min(m.highest(R * 2 + 6, R * 2 + 6) + 0.15, low + 0.45), d1 = d0 + 0.3;
  // the outer ring stops under its coping, so the two tops never share a plane and flicker
  m.k.prism(0, lo, 0, R + 3, d0 - 0.06 - lo, 'vahl2', { sides: 18 });
  m.k.prism(0, d0 - 0.06, 0, R + 3.05, 0.06, 'edge', { sides: 18 });
  m.pillar(0, lo, 0, R + 2.6, d0 - lo);
  m.k.prism(0, d0, 0, R + 1.6, 0.3, 'vahl', { sides: 18 });
  m.pillar(0, d0, 0, R + 1.3, 0.3);
  // what must stay open: the carving and the chest, in the ring's own frame
  const yaw = facing(s), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const open = [...LORE, ...CHESTS].filter(p => Math.hypot(p.x - s.x, p.z - s.z) < R + 6)
    .map(p => [(p.x - s.x) * cy - (p.z - s.z) * sy, (p.x - s.x) * sy + (p.z - s.z) * cy]);
  const clear = (x, z, r) => open.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > r);
  // the stones: dressed Vahl monoliths in three tapering courses, leaning a little, turned to
  // the centre; the tallest seaward with the ear's hollow worn into its inner face
  let fallen = null;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R;
    const tall = i === 0, h = tall ? 8.2 : 4.0 + hash(i, s.x) * 2.8;
    if (!clear(x, z, 2.4)) {
      // the stone that stood here lies on the dais beside the carving, clear of it to read
      for (const f of [0.82, 0.7, 1.12]) for (const da of [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36]) {
        const fx = Math.sin(a + da) * R * f, fz = Math.cos(a + da) * R * f;
        if (!fallen && clear(fx, fz, 3.3)) fallen = { x: fx, z: fz, a: a + da, h };
      }
      continue;
    }
    const w = tall ? 1.9 : 1.45, d = tall ? 1.1 : 0.85, lean = (hash(i, 7) - 0.5) * 0.06;
    m.k.at({ x, y: d1, z, ry: a + Math.PI, rx: lean }, (k) => {
      for (let j = 0; j < 3; j++) {
        const f = 1 - j * 0.14;
        k.slab(0, (h / 3) * j - (j ? 0 : 0.6), 0, w * f, h / 3 + (j ? 0.02 : 0.6), d * f, j % 2 ? 'vahl2' : 'vahl');
      }
      k.wedge(0, h, 0, w * 0.6, 0.55, d * 0.6, 'vahl2', { ry: Math.PI / 2 });
      if (hash(i, 3) < 0.6) k.slab(w * 0.2, h * 0.15, d * 0.51, w * 0.4, h * 0.3, 0.03, 'lichen', { grad: 0 });
      if (tall) {
        // the hollow on the inner face (local +z, turned to the centre)
        k.slab(0, 1.35, d / 2 + 0.01, 0.55, 0.62, 0.04, 'dark', { grad: 0 });
        k.slab(0, 1.25, d / 2 + 0.02, 0.75, 0.08, 0.06, 'edge');
      }
    });
    m.solid(x, d1, z, w, h, d, { ry: a, walkable: false });
    if (tall) {
      // the kneeling step before the hollow
      m.block(x * 0.84, d1, z * 0.84, 1.3, 0.22, 0.6, 'vahl2', { ry: a, climbable: false });
      rooms.push({ name: 'The Tallest Stone', use: 'where an ear put to the hollow hears the shelf move beneath the sea, slow as breathing', at: m.point(x * 0.84, d1, z * 0.84) });
    }
  }
  if (fallen) {
    const { x, z, a } = fallen;
    m.block(x, d1 - 0.3, z, 4.6, 1.0, 1.3, 'vahl', { ry: a + Math.PI / 2, climbable: true });
    m.trim(x, d1 + 0.7, z, 4.7, 0.06, 1.35, 'vahl2', { ry: a + Math.PI / 2 });
    // the chalk tally on its upper face, in fives
    for (let t = 0; t < 22; t++) {
      const u = -1.6 + Math.floor(t / 5) * 0.62 + (t % 5) * 0.1;
      if (t % 5 === 4) m.k.at({ x, y: d1 + 0.76, z, ry: a + Math.PI / 2 }, (k) => k.slab(u - 0.2, 0, 0, 0.5, 0.01, 0.04, 'chalk', { ry: 0.9, grad: 0 }));
      else m.k.at({ x, y: d1 + 0.76, z, ry: a + Math.PI / 2 }, (k) => k.slab(u, 0, 0, 0.03, 0.01, 0.34, 'chalk', { grad: 0 }));
    }
    rooms.push({ name: 'The Fallen Stone', use: 'the stone that lies where it fell, with a chalked tally of the days the shelf was quiet', at: m.point(x, d1, z) });
  }
  // the Ministry's sounding horn, set into a flat stone at the centre and turned to the sea
  m.k.prism(0, d1, 0, 1.3, 0.45, 'vahl2', { sides: 8 });
  m.pillar(0, d1, 0, 1.25, 0.45);
  m.k.prism(0, d1 + 0.45, 0, 0.07, 1.0, 'metal', { sides: 6, layer: 'metal' });
  m.k.at({ x: 0, y: d1 + 1.3, z: 0.15, rx: 1.15 }, (k) => k.prism(0, 0, 0, 0.12, 0.9, 'brass', { sides: 8, top: 3.2, layer: 'metal' }));
  rooms.push({ name: 'The Ring', use: 'the Vahl stones where the Compact first learned to measure the shelf, and the Ministry after it', at: m.point(0, d1, -R * 0.5) });
  // the measuring post: a lean-to on the landward side with the instrument table and its lamp
  const PZ = -(R + 5.5), py = m.highest(4.4, 3.2, 0, PZ) + 0.2;
  m.footing(0, PZ, 4.4, 3.2, py, { c: 'stone2', cap: 'edge', sink: 0.6 });
  for (const sx of [-1, 1]) {
    m.block(sx * 1.9, py, PZ + 1.3, 0.24, 2.3, 0.24, 'timber', { walkable: false });
    m.block(sx * 1.9, py, PZ - 1.3, 0.24, 2.9, 0.24, 'timber', { walkable: false });
  }
  m.block(0, py, PZ - 1.45, 4.0, 2.7, 0.14, 'timber', { walkable: false });
  m.k.at({ x: 0, y: py + 2.6, z: PZ, rx: -0.22 }, (k) => k.slab(0, 0, 0, 4.6, 0.14, 3.6, 'roof'));
  F.chartTable(m, 0, py, PZ - 0.2, 2.4, 1.2);
  m.hanging(-1.2, py + 2.5, PZ, 0.6, { intensity: 1.0, distance: 9 });
  m.shelter(0, PZ, 4.2, 3.0, py, py + 2.6);
  rooms.push({ name: "The Ministry's Post", use: 'a clerk\'s lean-to where the readings taken at the horn are written up', at: m.point(0, py, PZ) });
  routes.push({ id: 'from the post to the tallest stone', y0: 0, points: [[0, PZ + 1.0], [0, -(R + 1.0)], [-2.4, 0], [0, R * 0.84 - 1.1]].map(([x, z]) => m.point(x, 0, z)) });
  exclusions.push({ x: s.x, z: s.z, r: R + 9 });
  record(world, 'listening_stones', s.name, rooms, routes);
  add(m.build());
}

// ---------------------------------------------------------------- Mother's Mire
// Local frame: +z toward the outfall, the origin at the Bog Mother's wallow; y is the fen's
// water. Everything stands outside the ring she fights in.
const ARENA = 15;
export function buildMothersMire(world, s, add, exclusions) {
  const yaw = facing(s);
  const m = new Mason(world, { x: s.x, z: s.z, yaw, y: 0, palette: 'ancient_fen', tag: 'mothers_mire', name: s.name, lights: 5 });
  const reed = new Mason(world, { x: s.x, z: s.z, yaw, y: 0, palette: 'reed', tag: 'mothers_mire', name: "the Covenant's hide", lights: 2 });
  const rooms = [], routes = [];
  // ---- the outfall: a culvert headwall half sunk in the peat, its arch broken, still running
  const HZ = 31, HW = 5.2, top = 3.4;
  const hlo = m.lowest(HW * 2 + 3, 3, 0, HZ) - 0.8;
  m.mass(0, hlo, HZ, HW * 2, top - hlo, 1.4, { climbable: false });
  m.mass(0, hlo, HZ + 2.2, HW * 2, Math.max(0.5, m.highest(HW * 2, 3, 0, HZ + 2.2) - hlo), 3.0, { c: 'stone2', c2: 'stone', climbable: false });
  for (const sx of [-1, 1]) m.k.buttress(sx * (HW + 0.3), hlo, HZ, top - hlo + 0.2, { w: 1.3, depth: 2.2, ry: sx * Math.PI / 2, stages: 2 });
  // the parapet along its head, broken out over the mouth
  m.parapet(-HW, HZ - 0.4, -1.6, HZ - 0.4, top, { t: 0.5, h: 0.8 });
  m.parapet(2.3, HZ - 0.4, HW, HZ - 0.4, top, { t: 0.5, h: 0.55 });
  const span = 2.6, spring = 0.9;
  m.trim(0, -0.2, HZ - 0.72, span - 0.1, spring + span / 2 + 0.2, 0.06, 'dark', { grad: 0 });
  m.k.arch(0, spring, HZ - 0.75, span, { t: 0.45, depth: 0.5, c: 'edge', key: 'edge' });
  // the sluice gate rusted half open in the mouth, and the warm run pouring past it
  for (const sx of [-1, 1]) m.trim(sx * (span / 2 - 0.1), -0.3, HZ - 0.85, 0.12, spring + span / 2, 0.12, 'metal', { layer: 'metal' });
  m.trim(0, spring + 0.5, HZ - 0.85, span - 0.2, 0.9, 0.08, 'metal', { layer: 'metal' });
  m.k.glowPanel(0, 0.32, HZ - 1.4, span - 0.4, 0.06, 1.6, 'glow', 0.8);
  m.light(0, 1.4, HZ - 1.8, { color: '#9fe6c0', intensity: 1.6, distance: 14, priority: 0.8 });
  for (let i = 0; i < 6; i++) m.k.rock(-1.5 + i * 0.7 + hash(i, 2) * 0.3, -0.2, HZ - 2.2 - hash(i, 5) * 1.6, 0.7, 0.5, 0.6, i % 2 ? 'stone' : 'stone2', { ry: i });
  world.addEmitter?.({ kind: 'smoke', pos: m.point(0, 0.6, HZ - 2.0), rate: 1.2, spread: 0.6 });
  rooms.push({ name: 'The Broken Outfall', use: "the Compact's discharge, still running warm into the fen, where the Bog Mother breeds", at: m.point(0, top, HZ - 0.4) });
  // ---- the warm pools: kerbed basins stepping down from the outfall toward the wallow, each
  // one's lower kerb the next one's upper
  const pools = [[0, 25.5, 7, 4.6, 0.55], [0.8, 21.5, 8, 4.6, 0.3], [-0.6, 17.7, 9, 4.2, 0.05]];
  pools.forEach(([x, z, w, d, water], i) => {
    const g = m.lowest(w, d, x, z);
    // the floor wades shin-deep in warm water; the kerb stones stand round it, one fallen out
    m.footing(x, z, w - 1.0, d - 1.0, water - 0.45, { c: 'stone2', cap: false, sink: 0.4 });
    m.k.glowPanel(x, water - 0.02, z, w - 1.0, 0.04, d - 1.0, 'glow', 0.55 - i * 0.12);
    const kerb = (ax, az, bx, bz, gap) => {
      const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      const pieces = Math.max(1, Math.round(len / 1.6));
      for (let j = 0; j < pieces; j++) {
        if (j === gap) continue;
        const t = (j + 0.5) / pieces, kx = ax + (bx - ax) * t, kz = az + (bz - az) * t;
        m.block(kx, Math.min(g, water) - 0.6, kz, 0.6, water + 0.3 - Math.min(g, water) + 0.6, len / pieces + 0.04, 'stone', { ry, climbable: false });
      }
    };
    const hw = w / 2 - 0.3, hd = d / 2 - 0.3;
    kerb(x - hw, z + hd, x + hw, z + hd, i === 0 ? -1 : 2);
    kerb(x + hw, z - hd, x - hw, z - hd, Math.floor(w / 3.2));
    kerb(x - hw, z - hd + 0.3, x - hw, z + hd - 0.3, -1);
    kerb(x + hw, z - hd + 0.3, x + hw, z + hd - 0.3, i);
  });
  rooms.push({ name: 'The Warm Pools', use: 'the stepped basins the discharge fills, warm enough that the lurkers spawn in them through the winter', at: m.point(0, 0.3, 20.2) });
  // ---- the Covenant's hide: a reed hut on piles out in the south-west water, facing the pools
  {
    const HX = -21, HZ2 = -2, deck = 2.6, hw = 2.2, hd = 2.0;
    reed.at(HX, HZ2, Math.PI * 0.42, (q) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const g = q.ground(sx * hw, sz * hd);
        q.block(sx * hw, Math.min(g, 0) - 1.2, sz * hd, 0.3, deck - Math.min(g, 0) + 1.2, 0.3, 'timber', { walkable: false });
      }
      q.floor(0, deck, 0, hw * 2 + 0.6, hd * 2 + 1.6, 'floor', { t: 0.25 });
      q.shell(0, -0.3, hw * 2, hd * 2 - 0.6, deck, 2.3, { t: 0.3, style: 'reed', openings: { n: [{ u: 0, w: 1.1, h: 2.0 }], e: [{ u: 0, y: 1.0, w: 1.2, h: 0.6, lit: true }] } });
      q.ceiling(0, deck + 2.05, -0.3, hw * 2 - 0.6, hd * 2 - 1.2, { axis: 'x', every: 1.2 });
      q.roof(0, deck + 2.3, -0.3, hw * 2, hd * 2 - 0.6, 1.7, { kind: 'gable', along: 'z', overhang: 0.5, c: 'thatch' });
      q.rail(-hw - 0.2, hd + 0.7, -0.7, hd + 0.7, deck);
      q.rail(0.7, hd + 0.7, hw + 0.2, hd + 0.7, deck);
      // the ladder down to the water on the near side
      const g = q.ground(0, hd + 1.6);
      for (let r = Math.max(g, -0.6) + 0.3; r < deck; r += 0.35) q.trim(0, r, hd + 1.15, 0.9, 0.06, 0.08, 'timber');
      for (const sx of [-1, 1]) q.block(sx * 0.45, Math.min(g, 0) - 0.6, hd + 1.15, 0.08, deck - Math.min(g, 0) + 1.6, 0.08, 'timber', { walkable: false });
      F.bed(q, -hw + 0.85, deck, -0.6, { ry: Math.PI / 2, w: 0.9, len: 1.8, sheet: 'thatch', blanket: 'cloth' });
      F.crate(q, hw - 0.6, deck, -1.1, 0.6, { c: 'wood' });
      q.trim(hw - 0.35, deck + 0.9, 0.2, 0.08, 0.9, 0.9, 'cloth');
      q.lantern(0.9, deck + 1.9, hd + 0.4, { post: 0, intensity: 0.8 });
      q.shelter(0, -0.3, hw * 2, hd * 2 - 0.6, deck, deck + 2.3);
      rooms.push({ name: 'The Covenant Hide', use: 'where the Reed Covenant keeps watch on the Bog Mother and writes down where she wallows', at: q.point(0, deck, 0) });
      routes.push({ id: 'up the ladder into the hide', y0: deck, points: [[0, hd + 0.6], [0, 0.8], [0, -0.8]].map(([x, z]) => q.point(x, 0, z)) });
    });
  }
  // ---- the feeding stage: a plank platform on the pools' east edge with the fish racks
  {
    const FX = 15.5, FZ = 12;
    reed.at(FX, FZ, -Math.PI * 0.35, (q) => {
      const deck = Math.max(q.highest(4.4, 3.2), 0.2) + 0.5;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) q.block(sx * 2.0, Math.min(q.ground(sx * 2, sz * 1.4), 0) - 1, sz * 1.4, 0.24, deck - Math.min(q.ground(sx * 2, sz * 1.4), 0) + 1, 0.24, 'timber', { walkable: false });
      q.floor(0, deck, 0, 4.4, 3.2, 'floor', { t: 0.2 });
      for (const sx of [-1, 1]) q.block(sx * 1.6, deck, -1.2, 0.12, 1.9, 0.12, 'timber', { walkable: false });
      q.trim(0, deck + 1.8, -1.2, 3.5, 0.08, 0.08, 'timber');
      for (let i = 0; i < 7; i++) {
        q.trim(-1.35 + i * 0.45, deck + 1.35, -1.2, 0.03, 0.42, 0.03, 'timber');
        q.trim(-1.35 + i * 0.45, deck + 1.05, -1.2, 0.16, 0.36, 0.05, i % 2 ? '#8a9a9a' : '#9aa8a2', { grad: 0 });
      }
      F.barrel(q, 1.4, deck, 0.6);
      q.trim(-1.0, deck, 0.7, 0.9, 0.35, 0.6, 'wood');
      rooms.push({ name: 'The Feeding Stage', use: 'where the Covenant leaves her fish so she keeps to the mire, as the old prayer asks', at: q.point(0, deck, 0) });
    });
  }
  // ---- the effigies the Covenant set round the rim, faces to the wallow
  for (const a of [1.9, 2.75, 3.6, 4.45]) {
    const x = Math.sin(a) * 21.5, z = Math.cos(a) * 21.5, g = m.ground(x, z);
    reed.at(x, z, a + Math.PI, (q) => {
      q.block(0, Math.min(g, 0) - 0.8, 0, 0.16, 3.0 - Math.min(g, 0) + 0.8, 0.16, 'timber', { walkable: false });
      for (let j = 0; j < 9; j++) q.k.prism((j % 3 - 1) * 0.12, g + 0.8, (Math.floor(j / 3) - 1) * 0.1, 0.06, 1.5 + (j % 2) * 0.2, 'thatch', { sides: 4, top: 0.5 });
      q.trim(0, g + 1.9, 0, 0.6, 0.08, 0.1, 'timber');
      q.trim(0, g + 2.2, 0.05, 0.36, 0.42, 0.3, 'cloth');
      q.k.pyramid(0, g + 2.62, 0.05, 0.22, 0.34, 'thatch', { sides: 4 });
    });
  }
  exclusions.push({ x: s.x, z: s.z, r: ARENA });
  for (const [x, z, r] of [[0, HZ, 8], [0, 21, 7], [-21, -2, 4], [15.5, 12, 4]]) exclusions.push({ x: m.point(x, 0, z).x, z: m.point(x, 0, z).z, r });
  record(world, 'mothers_mire', s.name, rooms, routes);
  add(m.build());
  add(reed.build());
}
