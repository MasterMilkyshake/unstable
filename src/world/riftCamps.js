// The expeditions' camps on the Rift floor: who is down here now, and who did not come back.
//   Scholar's Landing  Cael's scholars under the Wash, where their cable comes down from the
//                      ravine: tents on plank floors, a work table under an awning, the winch
//   Quill's station    the survey: a theodolite over a cut marker, a staked line toward the
//                      Ascent, a plane table with the sheet pinned out
//   the Order's watch  Vesper's knights outside the city's east wall: a palisade, a watch
//                      stand, the Order's standard and a brazier at the gate
//   Year 57            the camp on the high plateau nobody came back to, and the ladders its
//                      party hung down the west face
//   the rope           shear legs over the sinkhole's lip, the line still paid out into the dark
//   the scout's mark   a cairn and a pennant, a lean-to, a cold ring of stones
// Every camp faces the path that comes to it (world/riftKingdom.js) through a gate of two posts
// and a lintel with its name-board, and keeps its lamps on posts: the light is where it is lit.
import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';
import { mergeStatic } from './merge.js';
import { seededRandom } from '../core/util.js';
import { RIFT_SITES, RIFT_PICKUPS } from '../data/riftResearch.js';
import { RIFT_PATHS } from './riftKingdom.js';
import { RAVINES, ceilingYAt } from './riftCeiling.js';
import { G } from '../core/globals.js';
import { act } from '../game/hooks.js';

// Canvas, timber and rope, all a little drowned; the lamps burn the basin's one warm colour.
const CAMP = {
  ...PALETTES.rift,
  canvas: '#6a5c4a', canvas2: '#5a4e40', rotten: '#43393a', wood: '#4c3c2e', wood2: '#3e3226', timber: '#30261e',
  rope: '#66553f', iron: '#3a3538', metal: '#3a3538', paper: '#a49b86', ash: '#262124', dark: '#1d1820',
  stone: '#4d4659', stone2: '#3f3a4b', edge: '#5f5872', cloth: '#4f3f52', brass: '#7a6a44', glow: '#e0a060',
};

// The end of whichever path comes nearest the camp: the camp's gate looks that way.
function facing(s) {
  let best = null, bd = Infinity;
  for (const p of RIFT_PATHS) {
    for (const q of [p.pts[0], p.pts[p.pts.length - 1]]) {
      const d = Math.hypot(q[0] - s.x, q[1] - s.z);
      if (d < bd) { bd = d; best = q; }
    }
  }
  return best && bd < 30 ? Math.atan2(best[0] - s.x, best[1] - s.z) : 0;
}

class Camp {
  constructor(world, s, low, name, yaw = facing(s)) {
    this.world = world;
    this.name = name;
    this.low = low;
    this.f = siteFrame(world, s.x, s.z, yaw);
    this.k = new Kit(CAMP, { detail: low ? 0 : 1 });
    this.rng = seededRandom(Math.round(s.x * 7 + s.z));
    this.extra = [];
  }
  ground(x, z) { return this.f.ground(x, z); }
  solid(x, z, w, d, y0, y1, rot = 0) { if (y1 > y0) this.f.solid(x, z, w, d, y0, y1, { rot }); }
  // world -> camp-local
  local(wx, wz) {
    const dx = wx - this.f.x, dz = wz - this.f.z, c = Math.cos(this.f.yaw), s = Math.sin(this.f.yaw);
    return [dx * c - dz * s, dx * s + dz * c];
  }
  light(p, i = 1.0, d = 12) {
    const [wx, wz] = this.f.at(p.x, p.z);
    this.world.addLight(new THREE.Vector3(wx, this.f.y + p.y, wz), '#e8a868', i, d, true, 0.7);
  }
  build() {
    const g = this.k.build(this.name);
    g.position.set(this.f.x, this.f.y, this.f.z);
    g.rotation.y = this.f.yaw;
    this.world.scene.add(g);
    for (const e of this.extra) this.world.scene.add(e);
    return [g, ...this.extra];
  }
}

// ------------------------------------------------------------------ pieces
// A wall tent on a plank floor: canvas over a ridge pole, the door at its +z end, guyed out.
function tent(c, x, z, ry, o = {}) {
  const k = c.k, w = o.w ?? 3.2, d = o.d ?? 4.2, h = o.h ?? 2.4, gy = c.ground(x, z);
  k.at({ x, y: gy, z, ry }, () => {
    k.slab(0, -0.4, 0, w + 0.5, 0.58, d + 0.5, 'wood2', { grad: 0.05 });
    if (o.collapsed) {
      // the ridge pole snapped: the canvas lies over what was under it
      k.at({ rz: 0.22, rx: -0.08 }, () => k.wedge(0, 0.18, 0, w * 1.15, h * 0.32, d * 1.05, 'rotten', { grad: 0.2 }));
      k.slab(-w * 0.2, 0.18, d / 2 + 0.6, 0.1, 0.1, 2.2, 'timber', { ry: 0.6, rz: 0.1 });
      k.slab(w * 0.3, 0.18, -d / 2 - 0.2, 0.1, 1.6, 0.1, 'timber', { rz: 0.5 });
      return;
    }
    k.wedge(0, 0.18, 0, w, h, d, o.c || 'canvas', { grad: 0.12 });
    k.slab(0, 0.18, d / 2 + 0.01, w * 0.3, h * 0.62, 0.04, 'dark', { grad: 0 });
    k.slab(0, 0.18 + h - 0.06, 0, 0.1, 0.12, d + 0.5, 'timber');
    for (const sz of [-1, 1]) k.slab(0, 0.18, sz * (d / 2 + 0.2), 0.1, h, 0.1, 'timber');
    if (!c.low) {
      for (const sx of [-1, 1]) for (const sz of [-0.3, 0.3]) {
        k.at({ x: sx * (w / 2 + 0.5), y: 0.18 + h * 0.25, z: sz * d, rz: sx * 0.9 }, () => k.slab(0, -0.04, 0, 0.03, 1.3, 0.03, 'rope'));
        k.slab(sx * (w / 2 + 0.95), -0.2, sz * d, 0.08, 0.35, 0.08, 'timber');
      }
    }
  });
  c.solid(x, z, w, d, gy - 0.5, gy + h * (o.collapsed ? 0.3 : 0.9), ry);
}

function crate(c, x, z, ry = 0, stack = 1) {
  const gy = c.ground(x, z);
  for (let i = 0; i < stack; i++) {
    c.k.at({ x, y: gy + i * 0.72, z, ry: ry + i * 0.3 }, () => {
      c.k.slab(0, 0, 0, 0.8, 0.72, 0.8, i % 2 ? 'wood2' : 'wood', { grad: 0.08 });
      c.k.slab(0, 0.3, 0, 0.84, 0.1, 0.84, 'timber');
    });
  }
  c.solid(x, z, 0.8, 0.8, gy - 0.2, gy + 0.72 * stack, ry);
}

function barrel(c, x, z) {
  const gy = c.ground(x, z);
  c.k.prism(x, gy, z, 0.42, 1.0, 'wood', { sides: 8, top: 0.92 });
  for (const y of [0.2, 0.75]) c.k.prism(x, gy + y, z, 0.44, 0.06, 'iron', { sides: 8, layer: 'metal' });
  c.solid(x, z, 0.8, 0.8, gy - 0.2, gy + 1.0);
}

// A trestle table: a top on two trestles, a sheet pinned out, an inkwell.
function table(c, x, z, ry, o = {}) {
  const gy = c.ground(x, z), w = o.w ?? 2.2, d = o.d ?? 1.0;
  c.k.at({ x, y: gy, z, ry }, () => {
    for (const sx of [-1, 1]) c.k.slab(sx * (w / 2 - 0.3), 0, 0, 0.12, 0.82, d - 0.1, 'timber');
    c.k.slab(0, 0.82, 0, w, 0.08, d, 'wood');
    c.k.slab(-0.2, 0.9, 0.05, w * 0.5, 0.01, d * 0.7, 'paper', { ry: 0.05 });
    if (o.ink !== false) c.k.slab(0.6, 0.9, -0.2, 0.1, 0.1, 0.1, 'dark');
  });
  c.solid(x, z, w, d, gy, gy + 0.9, ry);
}

// A lamp post, lit or long cold.
function lamp(c, x, z, lit = true, post = 2.4) {
  const gy = c.ground(x, z);
  const p = c.k.lantern(x, gy, z, { post, metal: 'iron', strength: lit ? 1.0 : 0, glow: lit ? 'glow' : 'ash', base: 'stone2' });
  if (lit) c.light({ x, y: gy + post + 0.4, z }, 1.0, 12);
  c.solid(x, z, 0.5, 0.5, gy - 0.2, gy + post);
  return p;
}

// The camp's gate on the path: two posts and a lintel, a name-board under it, a lamp hooked on.
function gate(c, z, w = 3.4, lit = true) {
  const k = c.k, gy = c.ground(0, z);
  for (const sx of [-1, 1]) {
    k.prism(sx * w / 2, gy - 0.6, z, 0.17, 3.9, 'timber', { sides: 6 });
    k.slab(sx * w / 2, gy - 0.1, z, 0.6, 0.25, 0.6, 'stone2');
    c.solid(sx * w / 2, z, 0.36, 0.36, gy - 0.6, gy + 3.3);
  }
  k.slab(0, gy + 3.1, z, w + 0.9, 0.22, 0.24, 'timber');
  for (const sx of [-1, 1]) k.at({ x: sx * (w / 2 - 0.45), y: gy + 2.75, z, rz: -sx * 0.78 }, () => k.slab(0, 0, 0, 0.1, 0.65, 0.1, 'timber'));
  k.slab(0, gy + 2.35, z, 1.5, 0.5, 0.06, 'wood');
  k.slab(0, gy + 2.6, z + 0.035, 1.1, 0.06, 0.01, 'paper');
  for (const sx of [-0.5, 0.5]) k.slab(sx, gy + 2.85, z, 0.03, 0.26, 0.03, 'rope');
  // the lamp hangs from the lintel's end
  k.slab(w / 2 + 0.3, gy + 2.7, z, 0.03, 0.42, 0.03, 'iron');
  k.lantern(w / 2 + 0.3, gy + 2.15, z, { post: 0, metal: 'iron', strength: lit ? 1.0 : 0, glow: lit ? 'glow' : 'ash' });
  if (lit) c.light({ x: w / 2 + 0.3, y: gy + 2.4, z }, 0.9, 11);
}

// A ring of stones round a fire, burning or long out.
function fireRing(c, x, z, lit) {
  const gy = c.ground(x, z), k = c.k;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    k.rock(x + Math.cos(a) * 0.95, gy + 0.1, z + Math.sin(a) * 0.95, 0.45, 0.32, 0.4, 'stone2', { ry: a });
  }
  for (let i = 0; i < 3; i++) k.slab(x, gy + 0.05, z, 0.14, 0.14, 1.1, lit ? 'timber' : 'ash', { ry: i * 1.05 });
  if (lit) {
    k.prism(x, gy + 0.1, z, 0.35, 0.3, 'glow', { sides: 5, layer: 'glow', strength: 0.9 });
    c.light({ x, y: gy + 0.8, z }, 1.2, 12);
  }
}

// A stake with a strip of flagging; the survey's and the scout's marks.
function stake(c, x, z, h = 1.4, flag = true, lean = 0) {
  const gy = c.ground(x, z);
  c.k.at({ x, y: gy - 0.3, z, rz: lean }, () => {
    c.k.slab(0, 0, 0, 0.07, h + 0.3, 0.07, 'timber');
    if (flag) c.k.slab(0.16, h + 0.05, 0, 0.32, 0.12, 0.01, 'cloth');
  });
}

// A thin straight member between two camp-local points (a cable, a cord, a ladder rail).
function rod(c, a, b, r, key) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const ry = Math.atan2(dx, dz), rx = Math.atan2(Math.hypot(dx, dz), dy);
  c.k.at({ x: a[0], y: a[1], z: a[2], ry }, () => c.k.at({ rx }, () => c.k.slab(0, 0, 0, r, L, r, key)));
}

// ------------------------------------------------------------------ the camps
function scholar(world, low) {
  const S = RIFT_SITES.scholar;
  const c = new Camp(world, S, low, 'rift_camp_scholar');
  const k = c.k;
  // keep clear of the camp's fire (props.js builds it from data/riftResearch.js)
  const [fx, fz] = c.local(S.x - 1.6, S.z - 2.2);
  gate(c, 9.5);
  tent(c, -4.6, 2.6, 0.12);
  tent(c, 4.8, 1.6, -0.1);
  tent(c, fx > 0 ? -3.6 : 3.6, -5.6, Math.PI / 2, { w: 2.8, d: 3.6, h: 2.1, c: 'canvas2' });
  // the work table under its awning, between the tents and the gate
  {
    const gy = c.ground(0, 4.6);
    for (const [sx, sz] of [[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]]) k.slab(sx, gy - 0.3, 4.6 + sz * 1.3, 0.12, sz < 0 ? 2.9 : 2.5, 0.12, 'timber');
    k.at({ y: gy + 2.4, z: 4.6, rx: 0.08 }, () => k.slab(0, 0, 0, 4.2, 0.06, 3.2, 'canvas2', { grad: 0.1 }));
    table(c, 0, 4.4, 0.05);
    crate(c, 1.6, 5.4, 0.3);
  }
  // the winch: an A-frame over a drum, its cable going up into the Wash's ravine
  const wash = RAVINES.find((r) => r.id === 'wash');
  const lip = wash ? wash.rift[0] : [S.x, S.z - 20];
  const [lx, lz] = c.local(lip[0], lip[1]);
  const L = Math.hypot(lx, lz) || 1;
  const wx = (lx / L) * 6.5, wz = (lz / L) * 6.5, wry = Math.atan2(lx, lz);
  const wy = c.ground(wx, wz);
  k.at({ x: wx, y: wy, z: wz, ry: wry + Math.PI / 2 }, () => {
    k.slab(0, -0.2, 0, 3.6, 0.35, 2.4, 'timber');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) k.at({ x: sx * 1.5, z: sz * 0.9, rx: -sz * 0.32 }, () => k.slab(0, 0, 0, 0.18, 3.6, 0.18, 'timber'));
      k.slab(sx * 1.5, 3.25, 0, 0.3, 0.3, 0.4, 'timber');
    }
    k.slab(0, 3.4, 0, 3.4, 0.22, 0.22, 'timber');
    k.prism(0, 1.15, 0, 0.5, 2.6, 'wood', { sides: 8, rz: Math.PI / 2 });
    k.prism(0, 1.15, 0, 0.53, 2.0, 'rope', { sides: 8, rz: Math.PI / 2 });
    for (const sx of [-1, 1]) k.slab(sx * 1.7, 1.15, 0, 0.1, 0.1, 0.9, 'iron', { layer: 'metal' });
    k.slab(1.75, 0.75, 0.4, 0.1, 0.8, 0.1, 'iron', { layer: 'metal' });
    k.prism(0, 3.55, 0, 0.3, 0.2, 'iron', { sides: 8, layer: 'metal', rx: Math.PI / 2 });
  });
  c.solid(wx, wz, 3.6, 2.4, wy - 0.3, wy + 3.6, wry + Math.PI / 2);
  for (const [dx, dz] of [[-1.6, 1.8], [1.4, 2.0]]) crate(c, wx + dx, wz + dz, 0.4, 2);
  barrel(c, wx - 2.4, wz - 0.6);
  // the cable: from the winch's head pulley straight up to the ravine's lip
  const top = ceilingYAt(world, lip[0], lip[1]) + 4 - c.f.y;
  const a = [wx, wy + 3.65, wz], b = [lx, top, lz];
  rod(c, a, b, 0.06, 'rope');
  // the basket they ride, halfway up and coming down
  const t = 0.18, bx = a[0] + (b[0] - a[0]) * t, by = a[1] + (b[1] - a[1]) * t, bz = a[2] + (b[2] - a[2]) * t;
  k.at({ x: bx, y: by - 2.4, z: bz }, () => {
    k.slab(0, 0, 0, 1.4, 0.12, 1.4, 'wood');
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.slab(sx * 0.65, 0.12, sz * 0.65, 0.08, 1.0, 0.08, 'timber');
    for (const sz of [-1, 1]) k.slab(0, 0.9, sz * 0.65, 1.4, 0.08, 0.06, 'timber');
    for (const sx of [-1, 1]) k.slab(sx * 0.65, 0.9, 0, 0.06, 0.08, 1.4, 'timber');
  });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(c, [bx + sx * 0.65, by - 1.3, bz + sz * 0.65], [bx, by, bz], 0.03, 'rope');
  lamp(c, -2.2, 7.8);
  lamp(c, wx * 0.5 + 1.2, wz * 0.5, true);
  crate(c, -6.8, -1.4, 0.2, 2);
  barrel(c, -6.6, 0.2);
  return c.build();
}

function survey(world, low) {
  const S = RIFT_SITES.survey;
  const c = new Camp(world, S, low, 'rift_camp_survey');
  const k = c.k;
  gate(c, 8.5);
  tent(c, 4.2, -2.6, -0.25);
  // the station: a cut stone marker with a brass plate, the theodolite on its tripod over it
  {
    const gy = c.ground(0, 1.2);
    k.prism(0, gy - 0.4, 1.2, 0.42, 1.0, 'stone', { sides: 4 });
    k.slab(0, gy + 0.6, 1.2, 0.36, 0.04, 0.36, 'brass', { layer: 'metal' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.at({ x: Math.cos(a) * 0.55, y: gy, z: 1.2 + Math.sin(a) * 0.55, ry: -a + Math.PI / 2, rx: 0.22 }, () => k.slab(0, 0, 0, 0.06, 1.55, 0.06, 'timber'));
    }
    k.slab(0, gy + 1.5, 1.2, 0.3, 0.14, 0.3, 'brass', { layer: 'metal' });
    k.prism(0, gy + 1.64, 1.2, 0.08, 0.5, 'iron', { sides: 6, layer: 'metal', rx: Math.PI / 2 - 0.1 });
    c.solid(0, 1.2, 0.9, 0.9, gy - 0.4, gy + 1.7);
  }
  // the staked line, run out toward the Ascent with a cord between the stakes
  const [ax, az] = c.local(6000, 5988);
  const L = Math.hypot(ax, az), ux = ax / L, uz = az / L;
  let prev = null;
  for (let i = 1; i <= 7; i++) {
    const x = ux * (2 + i * 3), z = uz * (2 + i * 3), gy = c.ground(x, z);
    stake(c, x, z, 1.2, true, (c.rng() - 0.5) * 0.08);
    if (prev) rod(c, [prev[0], prev[1], prev[2]], [x, gy + 0.9, z], 0.02, 'rope');
    prev = [x, gy + 0.9, z];
  }
  // the plane table with the sheet, a chain laid out on the ground, the kit boxes
  table(c, -3.0, 2.4, 0.4, { w: 1.6, d: 1.2 });
  {
    const gy = c.ground(-1.6, -1.6);
    for (let i = 0; i < 10; i++) k.slab(-3.4 + i * 0.4, gy + 0.02, -1.6 + Math.sin(i * 0.8) * 0.3, 0.32, 0.04, 0.08, 'iron', { layer: 'metal', ry: 0.2 });
  }
  crate(c, 5.6, 0.8, 0.5);
  crate(c, 6.0, 1.9, 0.1, 2);
  barrel(c, 2.4, -4.6);
  lamp(c, 1.8, 6.6);
  return c.build();
}

function order(world, low) {
  const S = RIFT_SITES.order;
  const c = new Camp(world, S, low, 'rift_camp_order');
  const k = c.k;
  // the palisade: sharpened stakes round the watch, open at the gate
  const R = 7.4;
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    if (Math.abs(x) < 1.9 && z > 0) continue;
    const gy = c.ground(x, z), h = 2.6 + c.rng() * 0.5;
    k.prism(x, gy - 0.5, z, 0.19, h + 0.5, 'timber', { sides: 5, ry: a });
    k.pyramid(x, gy + h, z, 0.19, 0.4, 'timber', { sides: 5 });
  }
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2 + 0.4, a1 = a0 + Math.PI / 2 - 0.3;
    for (const y of [0.9, 2.1]) {
      const [x0, z0, x1, z1] = [Math.sin(a0) * (R - 0.25), Math.cos(a0) * (R - 0.25), Math.sin(a1) * (R - 0.25), Math.cos(a1) * (R - 0.25)];
      const gy = c.ground((x0 + x1) / 2, (z0 + z1) / 2);
      if (Math.abs((x0 + x1) / 2) < 3 && (z0 + z1) / 2 > 0) continue;
      rod(c, [x0, gy + y, z0], [x1, gy + y, z1], 0.1, 'timber');
    }
  }
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
    const mx = Math.sin((a0 + a1) / 2) * R, mz = Math.cos((a0 + a1) / 2) * R;
    if (Math.abs(mx) < 1.9 && mz > 0) continue;
    const gy = c.ground(mx, mz);
    c.solid(mx, mz, 0.5, R * 0.42, gy - 0.5, gy + 2.6, (a0 + a1) / 2 + Math.PI / 2);
  }
  gate(c, R + 0.2, 3.4);
  // the watch stand: a platform on four posts, a ladder up its back, a rail round it
  {
    const x = -2.6, z = -2.8, gy = c.ground(x, z), h = 3.2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.slab(x + sx * 1.1, gy - 0.4, z + sz * 1.1, 0.22, h + 1.5, 0.22, 'timber');
    k.slab(x, gy + h, z, 2.8, 0.18, 2.8, 'wood');
    for (const s of [-1, 1]) {
      k.slab(x, gy + h + 1.0, z + s * 1.15, 2.6, 0.1, 0.1, 'timber');
      k.slab(x + s * 1.15, gy + h + 1.0, z, 0.1, 0.1, 2.6, 'timber');
    }
    for (const sx of [-0.35, 0.35]) k.at({ x: x + sx, y: gy, z: z - 1.6, rx: -0.16 }, () => k.slab(0, 0, 0, 0.08, h + 0.4, 0.08, 'timber'));
    for (let i = 1; i < 9; i++) k.slab(x, gy + i * 0.38, z - 1.6 - i * 0.06, 0.8, 0.06, 0.06, 'timber');
    c.solid(x, z, 2.8, 2.8, gy + h - 0.2, gy + h + 0.18);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.solid(x + sx * 1.1, z + sz * 1.1, 0.25, 0.25, gy - 0.4, gy + h);
    // the Order's standard on the stand
    k.slab(x + 1.1, gy + h, z + 1.1, 0.1, 4.2, 0.1, 'timber');
    k.banner(x + 1.1, gy + h + 1.4, z + 1.16, 1.1, 2.2, 'cloth', { rod: 'iron' });
  }
  tent(c, 3.0, -2.2, -Math.PI / 2, { w: 3.0, d: 4.0 });
  // a weapon rack and the brazier at the gate
  {
    const gy = c.ground(3.6, 3.0);
    for (const sx of [-0.9, 0.9]) k.slab(3.6 + sx, gy, 3.0, 0.1, 1.4, 0.1, 'timber');
    k.slab(3.6, gy + 1.25, 3.0, 2.0, 0.08, 0.12, 'timber');
    for (let i = 0; i < 4; i++) k.at({ x: 3.0 + i * 0.4, y: gy + 0.05, z: 3.1, rx: 0.18 }, () => k.slab(0, 0, 0, 0.05, 1.7, 0.05, 'iron', { layer: 'metal' }));
  }
  {
    const x = -2.4, z = R - 1.2, gy = c.ground(x, z);
    k.prism(x, gy, z, 0.25, 1.0, 'iron', { sides: 6, layer: 'metal' });
    k.prism(x, gy + 1.0, z, 0.55, 0.32, 'iron', { sides: 8, top: 1.25, layer: 'metal' });
    k.prism(x, gy + 1.15, z, 0.45, 0.28, 'glow', { sides: 6, layer: 'glow', strength: 0.9 });
    c.light({ x, y: gy + 1.7, z }, 1.2, 13);
    c.solid(x, z, 0.9, 0.9, gy - 0.2, gy + 1.3);
  }
  crate(c, -4.2, 2.4, 0.3, 2);
  barrel(c, 4.6, -5.0);
  return c.build();
}

function year57(world, low) {
  const S = RIFT_SITES.year57;
  // the camp looks west, to the edge its party went down
  const c = new Camp(world, S, low, 'rift_camp_year57', Math.PI / 2);
  const k = c.k;
  gate(c, 8.0, 3.2, false);
  tent(c, -3.6, 1.0, 0.5, { collapsed: true });
  tent(c, 3.2, -1.8, -0.4, { collapsed: true });
  fireRing(c, 0.2, 3.0, false);
  crate(c, -2.6, -3.4, 0.8);
  {
    const gy = c.ground(-1.2, -4.1);
    c.k.at({ x: -1.2, y: gy, z: -4.1, rz: 1.35, ry: 0.4 }, () => c.k.slab(0, 0, 0, 0.8, 0.72, 0.8, 'wood2'));
  }
  lamp(c, 1.4, -0.8, false, 1.8);
  for (let i = 0; i < 7; i++) {
    const x = -1.6 + i * 0.6 + c.rng() * 0.3, z = -1.4 + Math.sin(i * 1.7) * 1.2, gy = c.ground(x, z);
    k.slab(x, gy + 0.02, z, 0.28, 0.01, 0.2, 'paper', { ry: i * 0.7 });
  }
  // the hoist they left on the lip and the rope ladders down the west face, by the ledge
  const ladder = (wx0, y0, wx1, y1, wz) => {
    const [ax, az] = c.local(wx0, wz), [bx, bz] = c.local(wx1, wz);
    const ay = y0 - c.f.y, by = y1 - c.f.y;
    const ry = Math.atan2(bx - ax, bz - az);
    for (const s of [-0.35, 0.35]) {
      const ox = Math.cos(ry) * s, oz = -Math.sin(ry) * s;
      rod(c, [ax + ox, ay + 0.3, az + oz], [bx + ox, by, bz + oz], 0.05, 'rope');
    }
    const n = Math.round((y0 - y1) / 0.4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      k.slab(ax + (bx - ax) * t, ay + 0.3 + (by - ay - 0.3) * t, az + (bz - az) * t, 0.75, 0.05, 0.06, 'timber', { ry: ry + Math.PI / 2 });
    }
    c.world.colliders.addBox({ x: (wx0 + wx1) / 2, z: wz, w: Math.abs(wx1 - wx0) + 0.6, d: 0.9, y0: y1, y1: y0, climbable: true, walkable: false });
  };
  const T = world.terrain;
  const edge = (y) => {
    // the outermost point at this height along the line of the ladders
    for (let x = S.x + 6; x < S.x + 40; x += 0.5) if (T.heightAt(x, S.z + 4) < y - 2) return x - 0.6;
    return S.x + 13;
  };
  const z = S.z + 4, e1 = edge(39), y1 = T.heightAt(e1, z), foot1 = T.heightAt(e1 + 3.5, z);
  ladder(e1, y1, e1 + 3.0, foot1 + 0.2, z);
  const e2 = edge(foot1), foot2 = T.heightAt(e2 + 4, z);
  if (foot1 - foot2 > 3) ladder(e2, T.heightAt(e2, z), e2 + 3.4, foot2 + 0.2, z);
  {
    const [hx, hz] = c.local(e1 - 0.8, z), gy = c.ground(hx, hz);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.at({ x: hx + Math.cos(a) * 0.9, y: gy, z: hz + Math.sin(a) * 0.9, ry: -a + Math.PI / 2, rx: -0.3 }, () => k.slab(0, 0, 0, 0.14, 3.2, 0.14, 'timber'));
    }
    k.prism(hx, gy + 2.9, hz, 0.22, 0.16, 'iron', { sides: 8, layer: 'metal', rx: Math.PI / 2 });
  }
  return c.build();
}

function rope(world, low) {
  const S = RIFT_SITES.rope;
  const c = new Camp(world, S, low, 'rift_camp_rope');
  const k = c.k;
  const T = world.terrain;
  // find the sinkhole's lip south of the site, and stand the shear legs over it
  let lipZ = S.z - 4;
  for (let z = S.z; z > S.z - 20; z -= 0.5) if (T.heightAt(S.x, z) < -20) { lipZ = z + 0.5; break; }
  const [lx, lz] = c.local(S.x, lipZ);
  const L = Math.hypot(lx, lz) || 1, ux = lx / L, uz = lz / L, ry = Math.atan2(ux, uz);
  const gy = c.ground(lx - ux * 1.8, lz - uz * 1.8);
  k.at({ x: lx, y: gy, z: lz, ry }, () => {
    // the legs stand back from the lip and lean out over it, their heads lashed together
    for (const sx of [-1, 1]) k.at({ x: sx * 1.5, z: -1.8, rx: 0.48, rz: sx * 0.16 }, () => k.slab(0, -0.3, 0, 0.22, 6.5, 0.22, 'timber'));
    k.slab(0, 5.35, 1.0, 0.7, 0.35, 0.5, 'timber');
    k.prism(0, 5.3, 1.25, 0.3, 0.2, 'iron', { sides: 8, layer: 'metal', rx: Math.PI / 2 });
    // the line paid out into the dark
    k.slab(0, -30, 1.4, 0.06, 35.3, 0.06, 'rope');
    for (const sx of [-1, 1]) k.slab(sx * 1.5, -0.5, -1.8, 0.6, 0.65, 0.6, 'stone2');
  });
  // the line's other end runs back over the legs to a deadman: a log staked down behind them
  const dx = lx - ux * 9, dz = lz - uz * 9, dy = c.ground(dx, dz);
  rod(c, [lx + ux * 1.0, gy + 5.6, lz + uz * 1.0], [dx, dy + 0.35, dz], 0.06, 'rope');
  k.at({ x: dx, y: dy, z: dz, ry: ry + Math.PI / 2 }, () => {
    k.prism(0, 0.05, 0, 0.28, 2.6, 'timber', { sides: 6, rz: Math.PI / 2 });
    for (const sx of [-1.1, 1.1]) k.at({ x: sx, z: 0.4, rx: 0.3 }, () => k.slab(0, -0.4, 0, 0.12, 1.0, 0.12, 'timber'));
  });
  c.solid(dx, dz, 0.7, 2.8, dy - 0.3, dy + 0.6, ry);
  for (const sx of [-1, 1]) c.solid(lx - ux * 1.8 + uz * sx * 1.5, lz - uz * 1.8 - ux * sx * 1.5, 0.6, 0.6, gy - 0.5, gy + 0.2);
  // the coil, the dead lamp, their kit
  {
    const x = 2.2, z = 3.0, y = c.ground(x, z);
    for (let i = 0; i < 4; i++) k.prism(x, y + i * 0.12, z, 0.62 - i * 0.03, 0.11, 'rope', { sides: 10 });
  }
  lamp(c, -2.4, 1.6, false, 2.0);
  crate(c, -3.2, 3.6, 0.3);
  gate(c, 6.4, 3.0, false);
  return c.build();
}

function scout(world, low) {
  const S = RIFT_SITES.scout;
  const c = new Camp(world, S, low, 'rift_camp_scout');
  const k = c.k;
  // the cairn and its pennant
  {
    const gy = c.ground(0, 0);
    for (let i = 0; i < 5; i++) {
      const r = 1.0 - i * 0.17;
      for (let j = 0; j < 5 - i; j++) {
        const a = (j / (5 - i)) * Math.PI * 2 + i;
        k.rock(Math.cos(a) * r * 0.5, gy + 0.25 + i * 0.36, Math.sin(a) * r * 0.5, 0.6 - i * 0.06, 0.38, 0.5, i % 2 ? 'stone' : 'stone2', { ry: a });
      }
    }
    k.slab(0, gy + 1.4, 0, 0.09, 3.6, 0.09, 'timber');
    k.slab(0.42, gy + 4.4, 0, 0.8, 0.5, 0.02, 'cloth', { rz: -0.08 });
    c.solid(0, 0, 1.4, 1.4, gy - 0.2, gy + 1.9);
  }
  // a lean-to of canvas on two poles, the cold fire, the dropped pack
  {
    const x = -3.2, z = -1.6, gy = c.ground(x, z);
    for (const sx of [-1.2, 1.2]) k.slab(x + sx, gy - 0.2, z + 0.8, 0.1, 1.9, 0.1, 'timber');
    k.slab(x, gy + 1.6, z + 0.8, 2.7, 0.1, 0.1, 'timber');
    k.at({ x, y: gy + 0.8, z: z - 0.15, rx: -0.95 }, () => k.slab(0, 0, 0, 2.6, 0.05, 2.2, 'canvas2', { grad: 0.1 }));
    c.solid(x, z, 2.6, 2.0, gy - 0.2, gy + 1.5);
  }
  fireRing(c, -0.8, 2.6, false);
  {
    const gy = c.ground(1.8, -1.2);
    k.slab(1.8, gy, -1.2, 0.55, 0.65, 0.35, 'canvas2', { ry: 0.5, rz: 0.3 });
  }
  stake(c, 2.8, 2.6, 1.1, true, 0.2);
  return c.build();
}

// A lattice sample, a survey plate or a sealed dispatch, waiting where it was dropped.
function pickupProp(k, item) {
  if (item === 'lattice_sample') {
    k.crystal(0, 0.05, 0, 0.16, 0.7, '#b6a8d8', { layer: 'crystal', rz: 0.3 });
    k.slab(0, 0, 0, 0.5, 0.06, 0.4, 'stone2');
  } else if (item === 'survey_plate') {
    k.slab(0, 0.02, 0, 0.55, 0.05, 0.4, 'brass', { layer: 'metal', rz: 0.08 });
  } else {
    k.slab(0, 0.02, 0, 0.3, 0.06, 0.4, 'paper');
    k.slab(0, 0.08, 0, 0.1, 0.03, 0.1, 'cloth');
  }
}

export function buildRiftCamps(world, exclusions, state) {
  const low = !!state.low;
  const roots = [
    ...scholar(world, low), ...survey(world, low), ...order(world, low),
    ...year57(world, low), ...rope(world, low), ...scout(world, low),
  ];
  for (const g of roots) g.traverse((m) => { if (m.isMesh) m.castShadow = !low; });

  for (const pk of RIFT_PICKUPS) {
    const y = world.terrain.heightAt(pk.x, pk.z);
    const k = new Kit(CAMP, { detail: 1 });
    pickupProp(k, pk.item);
    const g = k.build('rift_pickup');
    g.position.set(pk.x, y, pk.z);
    g.userData.dynamic = true;
    world.scene.add(g);
    const it = world.addInteract({
      id: pk.id, kind: 'rift_pickup', pos: new THREE.Vector3(pk.x, y + 0.6, pk.z), radius: 2.2,
      label: `Take ${pk.label}`,
      enabled: () => !G.game?.ch?.flags?.[`took_${pk.id}`],
      use: () => act('takeRiftPickup', pk.id, pk.item),
    });
    state.pickups = state.pickups || [];
    state.pickups.push({ group: g, it, id: pk.id });
  }

  for (const [p, r] of [
    [RIFT_SITES.scholar, 13], [RIFT_SITES.survey, 11], [RIFT_SITES.order, 10],
    [RIFT_SITES.year57, 10], [RIFT_SITES.rope, 9], [RIFT_SITES.scout, 6],
  ]) exclusions.push({ x: p.x, z: p.z, r });

  mergeStatic(world.scene, roots);

}
