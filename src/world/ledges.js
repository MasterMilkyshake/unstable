// The ledge-built world's climbing lines and hidden stairs (data/ledges.js). A line is a stair
// of treads built onto a face, each riser a pitch to be caught and climbed (ADR-007), each lip
// a pale capstone with a moss edge, so a climbable line reads from below as pale lips going up
// a dark face; a face meant to be climbed by no one is left plain. A hidden stair is rough
// steps cut along a face's foot, for whoever looks for the way round.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { BIOME_COLORS } from './biomeGround.js';
import { LEDGE_LINES, LEDGE_STAIRS } from '../data/ledges.js';
import { TIER_MARKS, SEA_STACKS } from '../data/ledgeSites.js';
import { buildStation } from './ziplines.js';

const CAP = '#e3d6b8'; // the capstone's warm pale, mixed into each region's high stone
const _c = new THREE.Color(), _d = new THREE.Color();
const mix = (a, b, t) => '#' + _c.set(a).lerp(_d.set(b), t).getHexString();

// The colours a line takes from the ground it stands on.
function styleAt(world, x, z) {
  const biome = world.biomeAt?.(x, z) || 'meadow';
  const col = BIOME_COLORS[biome] || BIOME_COLORS.meadow;
  const frost = biome === 'snow' || biome === 'tundra' || biome === 'hush';
  const ash = biome === 'volcanic' || biome === 'ashfield';
  return {
    // laid stone, a shade warmer and lighter than the sheer face it is built against
    rock: mix(col.rock, col.high, 0.35), rock2: mix(mix(col.rock, col.under || col.rock, 0.35), col.high, 0.25),
    cap: frost ? mix(col.high, '#ffffff', 0.4) : mix(col.high, CAP, ash ? 0.25 : 0.55),
    band: frost ? '#f6f9fc' : ash ? mix(col.high, '#efe4cc', 0.6) : mix(col.high, '#f2e8d0', 0.85),
    lip: frost ? '#eef3f8' : ash ? (col.wear || '#8e877c') : col.moss,
  };
}

// The face in front of a foot: walk in along `yaw` past any talus to the first place the ground
// jumps more than 2.5 m within a metre, then read the shelf's top a little beyond. Returns the
// face's distance from the foot, the ground at its foot and its top.
export function findFace(world, def) {
  const T = world.terrain, ux = Math.sin(def.yaw), uz = Math.cos(def.yaw);
  const [fx, fz] = def.foot;
  // a line up a built face (a plinth, a wall) reads its heights from what stands there
  const at = def.structure ? (x, z) => Math.max(T.heightAt(x, z), world.groundAt(x, z, 400)) : (x, z) => T.heightAt(x, z);
  const h = (s) => at(fx + ux * s, fz + uz * s);
  let f = 0;
  for (; f < 60; f += 0.2) if (h(f + 1) - h(f) > 2.5) break;
  f += 0.5;
  // the climb starts from the ground at the authored foot; the builder lays a landing over any
  // dip between it and the first tread, so the first riser is the height it was given
  const g0 = def.ground ?? h(0);
  let top = def.top ?? -Infinity;
  if (def.top == null) for (let s = 1.5; s <= 4; s += 0.5) top = Math.max(top, at(fx + ux * (f + s), fz + uz * (f + s)));
  return { f, g0, top, ux, uz };
}

// The risers of a line, bottom first: its own pitches, then what is left to the top. A little
// left over joins the last riser; a little too much comes off it.
export function linePitches(def, g0, top) {
  const own = (def.pitches || []).slice();
  let left = top - g0 - own.reduce((a, b) => a + b, 0);
  while (own.length && left < 0.6) {
    const last = own.pop();
    left += last;
  }
  return left > 0.05 ? [...own, left] : own;
}

export function buildLedgeLine(world, k, def, exclusions) {
  const { f, g0, top, ux, uz } = findFace(world, def);
  const pitches = linePitches(def, g0, top);
  const n = pitches.length, D = def.d ?? 1.3, W = def.w ?? 2.6;
  const st = styleAt(world, def.foot[0], def.foot[1]);
  const [fx, fz] = def.foot;
  const at = (s) => [fx + ux * s, fz + uz * s];
  const treads = [];
  // a level landing over any dip between the foot and the first riser
  const front0 = f - (n - 1) * D;
  let low = Infinity;
  for (let s = 0; s <= front0; s += 0.25) low = Math.min(low, world.terrain.heightAt(...at(s)));
  if (low < g0 - 0.3 && front0 > 0.5) {
    const [lx, lz] = at(front0 / 2);
    k.at({ x: lx, y: 0, z: lz, ry: def.yaw }, (q) => {
      q.slab(0, low - 0.6, 0, W + 0.6, g0 - low + 0.6 - 0.16, front0 + 0.1, st.rock2);
      q.slab(0, g0 - 0.16, 0, W + 0.7, 0.16, front0 + 0.2, st.cap);
    });
    world.colliders.addBox({ x: lx, z: lz, w: W + 0.6, d: front0 + 0.1, y0: low - 0.6, y1: g0, rot: def.yaw, tag: 'ledge_line' });
  }
  let y = g0;
  for (let i = 0; i < n; i++) {
    y += pitches[i];
    const last = i === n - 1;
    // each tread stands proud of the one above by D; the last lies over the face's own edge
    const front = f - (n - 1 - i) * D + (last ? 0 : 0);
    const back = last ? f + 1.6 : f + 0.8;
    const [cx, cz] = at((front + back) / 2);
    const depth = back - front;
    const base = Math.min(world.terrain.heightAt(...at(front)), world.terrain.heightAt(...at(back - 0.1)), g0) - 0.6;
    const yTop = last ? Math.max(y, top) + 0.04 : y;
    // the riser in the region's rock, two courses of it, and the capstone over its lip
    k.at({ x: cx, y: 0, z: cz, ry: def.yaw }, (q) => {
      const h = yTop - 0.22 - base;
      q.slab(0, base, 0, W, h * 0.55, depth, st.rock2);
      q.slab(0, base + h * 0.55, 0.04, W - 0.04, h * 0.45, depth - 0.08, st.rock);
      // the capstone: its top for whoever stands on it, and a pale band standing proud of the
      // riser for whoever looks up from below, the region's moss (or frost, or ash) hanging
      // under it: the mark of an edge that can be caught
      q.slab(0, yTop - 0.18, -0.06, W + 0.14, 0.18, depth + 0.12, st.cap);
      q.at({ x: 0, y: yTop - 0.34, z: -depth / 2 - 0.02, rx: 0.7 }, (b) => b.slab(0, -0.32, 0, W + 0.24, 0.64, 0.18, st.band));
      q.slab(0, yTop - 0.95, -depth / 2 - 0.04, W - 0.16, 0.32, 0.08, st.lip);
      for (const sx of [-1, 1]) q.slab(sx * (W / 2 - 0.35), yTop - 1.3, -depth / 2 - 0.035, 0.32, 0.36, 0.07, st.lip);
      // a few of the old courses' joints down the riser, so a line reads as laid stone
      for (let j = 1; j < Math.floor(h / 1.4); j++) q.slab(0, yTop - 0.22 - j * 1.4, -depth / 2 - 0.01, W - 0.1, 0.05, 0.04, st.rock2);
    });
    world.colliders.addBox({ x: cx, z: cz, w: W, d: depth, y0: base, y1: yTop, rot: def.yaw, tag: 'ledge_line' });
    treads.push({ x: cx, z: cz, y: yTop, front, pitch: pitches[i] });
    exclusions.push({ x: cx, z: cz, r: Math.max(W, depth) * 0.7 + 1.5 });
  }
  // the ground in front of the first riser stays clear for the run-up, and the climber starts
  // there, on the foot's level
  const [sx, sz] = at(Math.max(0, front0 - 1.2));
  exclusions.push({ x: sx, z: sz, r: 3 });
  return { def, g0, top, face: f, pitches, treads, start: new THREE.Vector3(sx, Math.max(g0, world.terrain.heightAt(sx, sz)), sz) };
}

// A hidden scaffold: a timber tower with its stair wrapped round it, stood back from the face
// in front of it, and a plank bridge from its platform onto the top. The way up for anyone who
// walks round to look for it.
export function buildScaffold(world, def, exclusions) {
  const { f, top, ux, uz } = findFace(world, { ...def, pitches: [] });
  const [fx, fz] = def.foot;
  const T = world.terrain;
  // the tower's centre back from the face until the ground all round its stair (a circle of
  // 5.6 m) is clear of the rock above and of any drop below
  let back = Math.max(0, 4.6 - f);
  for (; back < 16; back += 0.5) {
    const cx = fx - ux * back, cz = fz - uz * back, g = T.heightAt(cx, cz);
    let ok = true;
    for (let a = 0; a < 16 && ok; a++) for (const r of [3.4, 4.6, 5.6]) {
      const h = T.heightAt(cx + Math.sin(a * Math.PI / 8) * r, cz + Math.cos(a * Math.PI / 8) * r);
      if (h > g + 2.2 || h < g - 3) ok = false;
    }
    if (ok) break;
  }
  const x = fx - ux * back, z = fz - uz * back;
  const ground = T.heightAt(x, z);
  // The tower stands square to the compass (its treads lie along the axes; a stair turned
  // aslant is too fine a thing for the reach tools' half-metre grid). Its stair winds round it,
  // a flight up each face in turn (world/ziplines.js wrapStair, mirrored here to learn where it
  // ends): the tower is turned so that the last flight is the one looking at the cliff, and
  // the bridge runs out from the stair's head over nothing.
  const W = 3.4, half = W / 2, o = half + 0.85, sw = 1.3, RUN = 0.42, RISE = 0.3, H = top - ground;
  let lo = 0;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) lo = Math.min(lo, T.heightAt(x + (i / 2) * half, z + (j / 2) * half) - ground);
  const corners = [[o, -o], [o, o], [-o, o], [-o, -o]];
  let y = lo, side = 0, head = null;
  while (y < H - 1e-6 && side < 40) {
    const [ax, az] = corners[side % 4], [bx, bz] = corners[(side + 1) % 4];
    const n = Math.min(Math.floor((2 * o - sw) / RUN), Math.ceil((H - y) / RISE - 1e-6));
    y = Math.min(H, y + n * RISE);
    const u = sw / 2 + RUN * (n - 0.5);
    head = { side: side % 4, lx: ax + Math.sign(bx - ax) * u, lz: az + Math.sign(bz - az) * u };
    side++;
  }
  const normals = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const [nx, nz] = normals[head.side];
  let yaw = 0, best = -2;
  for (const cand of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const c = Math.cos(cand), sn = Math.sin(cand);
    const d = (nx * c + nz * sn) * ux + (-nx * sn + nz * c) * uz;
    if (d > best + 1e-6) { best = d; yaw = cand; }
  }
  const st = buildStation(world, { id: def.id, name: def.name, x, z, h: H, w: W, yaw, palette: def.palette || 'redwake', stair: 'wrap' }, exclusions);
  // the bridge: from the stair's head, square off the cliff, onto the top
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const hx = x + head.lx * c + head.lz * sn, hz = z - head.lx * sn + head.lz * c;
  const L = (fx + ux * f - hx) * ux + (fz + uz * f - hz) * uz + 1.4;
  const BW = 2.0;
  const bx = hx + ux * (L / 2), bz = hz + uz * (L / 2);
  const k = new Kit({ wood: '#5a4636', timber: '#6a4a36' }, { detail: 1 });
  k.at({ x: bx, y: 0, z: bz, ry: def.yaw }, (q) => {
    q.slab(0, top - 0.28, 0, BW, 0.28, L, '#5a4636');
    for (const s2 of [-1, 1]) q.slab(s2 * (BW / 2 - 0.05), top - 0.5, 0, 0.14, 0.22, L, '#3e3026');
  });
  world.colliders.addBox({ x: bx, z: bz, w: BW, d: L, y0: top - 0.28, y1: top, rot: def.yaw, tag: 'ledge_stair' });
  // An apron of planks beside the last flight's outer edge, level with the bridge: whoever turns
  // off the last treads for the bridge early still has planks under them (a walker cutting
  // that corner stepped into the 0.2 m between the treads and the bridge, and fell). It lies
  // beside the treads, not over them, so they keep their headroom.
  const path = st.path || [];
  const from = path[path.length - 4];
  if (from) {
    let sx2 = from.x - hx, sz2 = from.z - hz;
    const sl = Math.hypot(sx2, sz2) || 1;
    sx2 /= sl;
    sz2 /= sl;
    const SW = 1.3, AD = 1.4, AW = 2.2;
    // 0.3 m clear of the treads' edge, so a body on the lower treads doesn't touch it; a body
    // over the slot still stands on one side or the other
    const ax = hx + ux * (SW / 2 + 0.3 + AD / 2) + sx2 * (AW / 2), az = hz + uz * (SW / 2 + 0.3 + AD / 2) + sz2 * (AW / 2);
    k.at({ x: ax, y: 0, z: az, ry: def.yaw }, (q) => q.slab(0, top - 0.28, 0, AW, 0.28, AD, '#5a4636'));
    world.colliders.addBox({ x: ax, z: az, w: AW, d: AD, y0: top - 0.28, y1: top, rot: def.yaw, tag: 'ledge_stair' });
  }
  world.scene.add(k.build('scaffold_bridge'));
  exclusions.push({ x: bx, z: bz, r: L / 2 + 1 });
  // the way up ends on the top, a step past the bridge's far end along its own line
  return { def, g0: ground, top, n: 0, foot: st.foot, end: new THREE.Vector3(hx + ux * (L + 0.6), top, hz + uz * (L + 0.6)), station: st };
}

// A hidden stair: rough steps along `yaw` from the foot, each 0.3 m up, until the top.
export function buildLedgeStair(world, k, def, exclusions) {
  if (def.kind === 'scaffold') return buildScaffold(world, def, exclusions);
  const T = world.terrain, ux = Math.sin(def.yaw), uz = Math.cos(def.yaw);
  const [fx, fz] = def.foot;
  const g0 = T.heightAt(fx, fz), top = def.top;
  const W = def.w ?? 1.6, RUN = def.run ?? 0.5, RISE = (top - g0) / Math.ceil((top - g0) / 0.3);
  const n = Math.round((top - g0) / RISE);
  const st = styleAt(world, fx, fz);
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * RUN, x = fx + ux * s, z = fz + uz * s, y = g0 + RISE * (i + 1);
    const base = Math.min(y - RISE - 0.4, T.heightAt(x, z) - 0.4);
    k.at({ x, y: 0, z, ry: def.yaw + (i % 3 - 1) * 0.03 }, (q) => q.slab((i % 2) * 0.06 - 0.03, base, 0, W, y - base, RUN + 0.06, i % 2 ? st.rock : st.rock2));
    world.colliders.addBox({ x, z, w: W, d: RUN + 0.04, y0: base, y1: y, rot: def.yaw, tag: 'ledge_stair' });
    if (i % 4 === 0) exclusions.push({ x, z, r: W + 1 });
  }
  const [ex, ez] = [fx + ux * (n * RUN + 1), fz + uz * (n * RUN + 1)];
  exclusions.push({ x: ex, z: ez, r: 3 });
  return { def, g0, top, n, end: new THREE.Vector3(ex, top, ez) };
}

// The marks of the high tiers (data/ledgeSites.js), stood at their edges so that they are seen
// from the ground below.
export function buildTierMark(world, k, def, exclusions) {
  const y = world.terrain.heightAt(def.x, def.z);
  const st = styleAt(world, def.x, def.z);
  k.at({ x: def.x, y, z: def.z, ry: def.ry || 0 }, (q) => {
    if (def.kind === 'lamp') {
      // the city's first lamp: a squat round tower, its top fallen in, the iron basket cold
      q.prism(0, -0.6, 0, 1.7, 2.6, st.rock2, { sides: 10 });
      q.prism(0, 2.0, 0, 1.45, 3.2, st.rock, { sides: 10 });
      q.slab(0.7, 5.2, 0.2, 1.4, 1.3, 1.0, st.rock, { ry: 0.4 });
      q.slab(-0.6, 5.2, -0.4, 1.0, 0.8, 1.2, st.rock2, { ry: -0.3 });
      q.prism(0, 6.4, 0.4, 0.14, 1.6, '#3a3634', { sides: 6 });
      q.prism(0, 7.9, 0.4, 0.7, 0.55, '#2e2a28', { sides: 8 });
      q.slab(0, 4.95, 0, 3.0, 0.22, 3.0, st.cap);
      world.colliders.addCyl({ x: def.x, z: def.z, r: 1.6, y0: y - 0.6, y1: y + 5.2 });
    } else if (def.kind === 'cairn') {
      // stones heaped by everyone who made the summit, and the pole they tie a strip to
      for (let i = 0; i < 6; i++) q.slab(Math.sin(i * 2.1) * 0.2, i * 0.42, Math.cos(i * 2.7) * 0.2, 1.6 - i * 0.2, 0.46, 1.4 - i * 0.18, i % 2 ? st.rock : st.cap, { ry: i * 0.7 });
      q.prism(0, 2.4, 0, 0.07, 2.6, '#4d3b2b', { sides: 6 });
      q.banner(0.32, 3.9, 0, 0.6, 0.9, '#c8b890', { rod: '#4d3b2b' });
      world.colliders.addCyl({ x: def.x, z: def.z, r: 0.8, y0: y - 0.3, y1: y + 2.4 });
    } else if (def.kind === 'camp') {
      // a pole with a torn banner at the edge, a fire, two lean-tos of sailcloth
      q.prism(0, -0.4, 0, 0.12, 7.4, '#3e3026', { sides: 6 });
      q.banner(0.62, 4.6, 0, 1.2, 2.4, def.banner || '#5a2622', { rod: '#3e3026' });
      for (let i = 0; i < 6; i++) q.slab(Math.sin(i) * 0.6 - 3, 0, Math.cos(i) * 0.6 + 4, 0.3, 0.2, 0.3, st.rock2, { ry: i });
      q.slab(-3, 0.05, 4, 0.7, 0.12, 0.7, '#ff9a4a', { layer: 'glow', strength: 1.4 });
      for (const [x, z, ry] of [[-6.5, 6.5, 0.5], [0.5, 8.5, -0.4]]) {
        q.at({ x, y: 0, z, ry, rz: 0.55 }, (t) => t.slab(0, 0, 0, 0.06, 2.6, 3.2, '#9a8c70'));
        q.slab(x + 0.9, 0, z, 0.12, 2.2, 0.12, '#4d3b2b', { ry });
      }
      world.colliders.addCyl({ x: def.x, z: def.z, r: 0.2, y0: y - 0.4, y1: y + 7 });
      world.addEmitter?.({ kind: 'fire', pos: new THREE.Vector3(def.x - 3, y + 0.3, def.z + 4), rate: 10 });
      world.addLight?.(new THREE.Vector3(def.x - 3, y + 1.4, def.z + 4), '#ff9a4a', 2.4, 14, true, 1.2);
    }
  });
  exclusions.push({ x: def.x, z: def.z, r: def.kind === 'camp' ? 10 : 4 });
  return { def, y };
}

// A sea stack (data/ledgeSites.js SEA_STACKS): the coast's stone standing in the sea in jointed
// columns, as Hightoll's crags stand, the middle ones carrying a flat top and the outer ones
// falling away, one standing off on its own; a landing stone at its landward foot (local +z)
// where a boat or a swimmer comes in; on its top a lookout's timber stage and pole. Built
// before the climbing lines, which read its landward face as a built face (`structure`).
const STACK_COLUMNS = [
  // [lx, lz, radius, head below the top]
  [0, 0.4, 3.3, 0], [-3.6, 0.6, 2.8, 0], [3.5, 0.2, 2.9, 0], [-1.6, -3.8, 3.0, 0], [2.2, -3.6, 2.8, 0.4],
  [-5.6, -3.2, 2.2, 5], [5.8, -2.6, 2.3, 3.5], [0.4, -7.0, 2.4, 6.5], [-4.8, -6.8, 1.8, 9], [6.4, 2.6, 1.6, 8], [-6.6, 2.2, 1.7, 10.5],
];
export function buildSeaStack(world, k, def, exclusions) {
  const { x, z, top, yaw = 0 } = def;
  const T = world.terrain;
  const st = styleAt(world, x - Math.sin(yaw) * 60, z - Math.cos(yaw) * 60);
  const tones = [st.rock, st.rock2, mix(st.rock, st.rock2, 0.5), mix(st.rock2, '#5e5a50', 0.25)];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const box = (lx, lz, bw, bd, y0, y1) => {
    const [bx, bz] = at(lx, lz);
    world.colliders.addBox({ x: bx, z: bz, w: bw, d: bd, y0, y1, rot: yaw, climbable: true, walkable: true, tag: 'sea_stack' });
  };
  let n = Math.round(x * 7 + z * 13);
  const rnd = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  k.at({ x, y: 0, z, ry: yaw }, (q) => {
    STACK_COLUMNS.forEach(([lx, lz, r, below], i) => {
      const [wx, wz] = at(lx, lz);
      const y0 = Math.min(T.heightAt(wx, wz), -1) - 2, head = top - below;
      q.prism(lx, y0, lz, r, head - y0, tones[i % tones.length], { sides: 5 + (i % 2), top: 0.86, ry: rnd() * 6.28, grad: 0.24 });
      // a split head on an outer column
      if (below > 2 && rnd() < 0.6) q.prism(lx + (rnd() - 0.5) * r * 0.5, head - 0.5, lz + (rnd() - 0.5) * r * 0.5, r * 0.45, 1.5 + rnd() * 3, tones[(i + 1) % tones.length], { sides: 5, top: 0.4, ry: rnd() * 6.28 });
    });
    // the top the middle columns carry, levelled with a skin of turf where the gulls left it
    q.slab(0, top - 0.35, -1.6, 9.6, 0.35, 8.2, tones[1]);
    q.prism(-2.4, top - 0.05, -3.2, 2.2, 0.12, '#6a7a44', { sides: 6, top: 0.9, grad: 0 });
    // the landing stone, low at its landward foot
    q.prism(0, -3, 6.6, 3.4, 4.5, tones[3], { sides: 6, top: 0.8, ry: 0.3 });
    // the lookout: a timber stage on four legs at the seaward edge, a pole with the Redwake's red
    for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) q.slab(sx, top, -4.2 + sz, 0.24, 3.4, 0.24, '#4d3b2b');
    q.slab(0, top + 3.4, -4.2, 3.6, 0.22, 3.6, '#5a4636');
    q.slab(0, top + 3.62, -5.9, 3.6, 0.9, 0.12, '#4d3b2b');
    q.prism(1.5, top + 3.6, -2.7, 0.1, 4.2, '#3e3026', { sides: 6 });
    q.banner(2.05, top + 6.4, -2.7, 1.1, 1.8, '#a8281c', { rod: '#3e3026' });
  });
  // colliders: each column as the square inside it, the top, the landing stone, the stage
  for (const [lx, lz, r, below] of STACK_COLUMNS) {
    const [wx, wz] = at(lx, lz);
    box(lx, lz, r * 1.35, r * 1.35, Math.min(T.heightAt(wx, wz), -1) - 2, top - below);
  }
  box(0, -1.6, 9.6, 8.2, top - 0.35, top);
  box(0, 6.6, 4.6, 4.6, -3, 1.5);
  for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) box(sx, -4.2 + sz, 0.24, 0.24, top, top + 3.4);
  box(0, -4.2, 3.6, 3.6, top + 3.4, top + 3.62);
  exclusions.push({ x, z, r: 12 });
  return { def, top, landing: at(0, 6.6) };
}

export function buildLedges(world, exclusions = [], lines = LEDGE_LINES, stairs = LEDGE_STAIRS, marks = TIER_MARKS) {
  const k = new Kit({ stone: '#8a877e' }, { detail: 1 });
  world.seaStacks = SEA_STACKS.map((def) => buildSeaStack(world, k, def, exclusions));
  world.ledgeLines = lines.map((def) => buildLedgeLine(world, k, def, exclusions));
  world.ledgeStairs = stairs.map((def) => buildLedgeStair(world, k, def, exclusions));
  world.tierMarks = marks.map((def) => buildTierMark(world, k, def, exclusions));
  if (k.tris) world.scene.add(k.build('ledge_lines'));
  return world.ledgeLines;
}
