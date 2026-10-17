// The mason: one builder for a structure's stone, timber and light. Every block it lays is
// drawn by the kit (world/kit.js) and collided where it is drawn, so a palace, a house and a
// gatehouse are walked exactly as they look. Coordinates are structure-local metres around a
// site origin turned by yaw (world/kit.js siteFrame); y is relative to the site's datum.
//
// Rules it keeps for every caller:
//   - one palette per faction or region (BUILD_PALETTES), shared by walls, roofs and rooms;
//   - stairs never rise more than 0.3 m a step on treads of at least 0.3 m;
//   - footings reach below the lowest ground under them and step down a slope cell by cell;
//   - lights are budgeted per structure (the world lights only the nearest few at a time).
import * as THREE from 'three';
import { Kit, siteFrame } from './kit.js';
import { PALETTES, shade } from './style.js';

export const RISE = 0.3;
export const TREAD = 0.45;

const S = PALETTES;
// Building palettes: the style.js family of each faction or region, completed with the
// surfaces a building needs (floors, ceilings, furniture timber, brick, snow, thatch).
export const BUILD_PALETTES = {
  // The Compact's lantern-keepers: pale salt stone, slate eaves, warm lantern glass.
  salt: { ...S.salt, stone: '#cbc8bb', stone2: '#b9b6a9', edge: '#dcd9cd', dark: S.salt.timber, metal: '#45484b',
    glow: '#f6cf86', floor: '#a7a194', ceiling: '#d2c9b4', wood: '#6e5642', cushion: '#7c3a33', moss: '#6f7a52' },
  // The Enclave: grey dressed stone, red brick, black timber, crimson and brass.
  enclave: { ...S.enclave, stone: '#7c7e82', stone2: '#6c6e72', edge: '#94969a', brick: '#7a4a3d', brick2: '#6a3f34',
    dark: S.enclave.timber, metal: '#5b5751', glow: '#f2d08f', floor: '#625c56', ceiling: '#8c8174', wood: '#5a4436',
    cushion: '#8e1f24', brass: '#a8893f', moss: '#5c6650' },
  // Frostwatch and White Pass: log and fieldstone under steep shingle carrying snow.
  frost: { ...S.frost, stone: '#8b959d', stone2: '#77818a', edge: '#a8b1b8', timber: '#4d3d31', dark: '#3d3934', roof: '#4f463f',
    roof2: '#453d37', ridge: '#3a332e', snow: '#eef3f6', glow: '#ffcf8a', floor: '#6e5a46', ceiling: '#8a7660', wood: '#6e5a46',
    cushion: '#7a5a4a', metal: '#4a4d50', moss: '#7d8f8a' },
  // Canopy Landing, Vinewatch and the Verdance: timber raised on stilts among the roots.
  root: { ...S.root, edge: '#9a9f86', timber: '#5a4a32', dark: '#463a28', bark: '#5d4a36', glow: '#ead98c', floor: '#6b5a40', ceiling: '#7c6a4c',
    wood: '#6b5a40', cushion: '#6a7a3e', metal: '#4a4a3e', moss: '#56703a', thatch: '#7a8a4a' },
  // Cinderstead and the Ashen Spire: basalt under turfed longhouse gables, red-stained timber
  // as Thornwood stains its own, ember light.
  cinder: { ...S.cinder, stone: '#5b534e', stone2: '#4b4441', edge: '#7a6c62', dark: '#2a2321', slag: '#2e2a2c', glow: '#ffa057', ember: '#ff7a2f',
    floor: '#3f3835', ceiling: '#4a403b', wood: '#4a3a30', cushion: '#7a3a28', metal: '#3a3634', moss: '#4a5634', turf: '#4d5a34' },
  // Reedbank and Shimmerfen: reed walls on piles over boardwalks, steep thatch.
  reed: { ...S.reed, edge: '#8d9682', timber: '#5a4c36', dark: '#463d2e', thatch: '#8f8456', glow: '#cfe9b0', floor: '#6a5a40', ceiling: '#7a6c4c',
    wood: '#6a5a40', cushion: '#5a7a4a', metal: '#4a4a3e', moss: '#56703a' },
  // Thornwood and the Redwake: red-stained longhouses with steep timber gables.
  redwake: { ...S.redwake, edge: '#978e80', timber: '#6a2f27', dark: '#33261f', glow: '#f2c07e', floor: '#5a4636', ceiling: '#6a5040', wood: '#5a4636',
    cushion: '#8b3934', metal: '#4a4440', moss: '#5a6a38', thatch: '#6a4a36' },
  // The Ministry of Soundings: blue-grey pagodas under Frosthollow's snow, bells and pale cold lamps.
  hush: { ...S.hush, stone: '#868d98', stone2: '#737a86', edge: '#a3aab4', plaster: '#bcc1c8', plaster2: '#adb2ba', dark: S.hush.timber, glow: '#d8deff', floor: '#5c616a', ceiling: '#737882', wood: '#4c4f58',
    cushion: '#4a5066', metal: '#6c7480', bell: '#6c7480', moss: '#7d8784' },
};
// Palettes whose roofs carry snow unless a builder says otherwise: the Hush lies in Frosthollow's winter.
const SNOW_ROOFS = new Set(['hush']);

// Fittings every palette can name: brass and iron, embers, bell bronze, snow and turf.
const FITTINGS = { brass: '#a8893f', ember: '#ff7a2f', bell: '#7a6a3e', snow: '#eef3f6', turf: '#5a6a3a', moss: '#66763f', slag: '#2e2a2c',
  cushion: '#7a4a3a', wood: '#6a5440', floor: '#8a8070', ceiling: '#b8ad98', timber: '#3a2f28', plaster: '#d6d0bd', thatch: '#8f8456',
  sand: '#cdb98d', sand2: '#b9a477' };
for (const [k, p] of Object.entries(BUILD_PALETTES)) BUILD_PALETTES[k] = { ...FITTINGS, ...p };

// Hip roof soup: rectangle base in the unit cell, ridge along x of length `ridge` (0..1).
const hipCache = new Map();
function hipUnit(ridge) {
  const key = ridge.toFixed(3);
  let g = hipCache.get(key);
  if (g) return g;
  const o = [];
  const tri = (a, b, c) => o.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const a = [-0.5, -0.5, 0.5], b = [0.5, -0.5, 0.5], c = [0.5, -0.5, -0.5], d = [-0.5, -0.5, -0.5];
  const r0 = [-ridge / 2, 0.5, 0], r1 = [ridge / 2, 0.5, 0];
  quad(a, b, r1, r0); // +z slope
  quad(c, d, r0, r1); // -z slope
  tri(b, c, r1); // +x hip
  tri(d, a, r0); // -x hip
  quad(d, c, b, a); // soffit
  g = new Float32Array(o);
  hipCache.set(key, g);
  return g;
}

const rotate = (t, x, z) => [t.x + x * Math.cos(t.ry) + z * Math.sin(t.ry), t.z - x * Math.sin(t.ry) + z * Math.cos(t.ry)];

export class Mason {
  constructor(world, { x, z, yaw = 0, y = null, palette = 'salt', tag = null, name = 'masonry', detail = 1, lights = 6 }) {
    this.world = world;
    this.tag = tag;
    this.name = name;
    this.p = typeof palette === 'string' ? BUILD_PALETTES[palette] || PALETTES[palette] : palette;
    this.snowRoofs = SNOW_ROOFS.has(palette);
    this.k = new Kit(this.p, { detail });
    this.f = siteFrame(world, x, z, yaw, y ?? world.terrain.heightAt(x, z));
    this.yaw = yaw;
    this.T = [{ x: 0, z: 0, ry: 0 }];
    this.lightBudget = lights;
    this.g = new THREE.Group();
    this.g.name = name;
    this.g.position.set(x, this.f.y, z);
    this.g.rotation.y = yaw;
  }

  get y() { return this.f.y; }
  get t() { return this.T[this.T.length - 1]; }
  color(c) { return (this.p && this.p[c]) || c; }

  // ---------------------------------------------------------------- frames
  push(x, z, ry = 0) {
    this.k.push({ x, z, ry });
    const [fx, fz] = rotate(this.t, x, z);
    this.T.push({ x: fx, z: fz, ry: this.t.ry + ry });
    return this;
  }
  pop() {
    this.k.pop();
    if (this.T.length > 1) this.T.pop();
    return this;
  }
  at(x, z, ry, fn) {
    this.push(x, z, ry);
    fn(this);
    return this.pop();
  }
  // Site-local (x, z) of a point given in the current frame.
  site(x, z) { return rotate(this.t, x, z); }
  // World position of a point given in the current frame.
  point(x, y, z) {
    const [fx, fz] = this.site(x, z);
    const [wx, wz] = this.f.at(fx, fz);
    return new THREE.Vector3(wx, this.f.y + y, wz);
  }
  // Terrain under a point, relative to the datum.
  ground(x, z) {
    const [fx, fz] = this.site(x, z);
    return this.f.ground(fx, fz);
  }
  // Lowest terrain under a footprint (local w x d around x, z, turned by ry), relative to the datum.
  lowest(w, d, x = 0, z = 0, ry = 0) {
    const [fx, fz] = this.site(x, z);
    return this.f.lowest(w, d, fx, fz, this.t.ry + ry);
  }
  highest(w, d, x = 0, z = 0, ry = 0) {
    let hi = -Infinity;
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) {
      const lx = (i / 3 - 0.5) * w, lz = (j / 3 - 0.5) * d;
      hi = Math.max(hi, this.ground(x + lx * c + lz * s, z - lx * s + lz * c));
    }
    return hi;
  }

  // ---------------------------------------------------------------- collision
  solid(x, y, z, w, h, d, o = {}) {
    if (h <= 0.001) return null;
    const [fx, fz] = this.site(x, z);
    return this.f.solid(fx, fz, w, d, y, y + h, {
      tag: o.tag ?? this.tag, rot: this.t.ry + (o.ry || 0),
      walkable: o.walkable ?? true, climbable: o.climbable ?? true,
    });
  }
  pillar(x, y, z, r, h, o = {}) {
    const [fx, fz] = this.site(x, z);
    const [wx, wz] = this.f.at(fx, fz);
    return this.world.colliders.addCyl({ x: wx, z: wz, r, y0: this.f.y + y, y1: this.f.y + y + h, climbable: o.climbable ?? true, tag: o.tag ?? this.tag });
  }

  // ---------------------------------------------------------------- blocks
  // A base-standing block, drawn and collided (o.solid === false draws only).
  block(x, y, z, w, h, d, c = 'stone', o = {}) {
    if (h <= 0.001 || w <= 0.001 || d <= 0.001) return this;
    this.k.slab(x, y, z, w, h, d, c, o);
    if (o.solid !== false) this.solid(x, y, z, w, h, d, o);
    return this;
  }
  // Drawn only: trim, glazing, furniture details too small to stand in the way.
  trim(x, y, z, w, h, d, c = 'edge', o = {}) {
    if (h <= 0.001 || w <= 0.001 || d <= 0.001) return this;
    this.k.slab(x, y, z, w, h, d, c, o);
    return this;
  }
  // Coursed masonry: alternate courses step in a hair and shift tone.
  mass(x, y, z, w, h, d, o = {}) {
    if (h <= 0.001) return this;
    this.k.masonry(x, y, z, w, h, d, { c: o.c || 'stone', c2: o.c2 || 'stone2', course: o.course, ry: o.ry, inset: o.inset });
    if (o.solid !== false) this.solid(x, y, z, w, h, d, o);
    return this;
  }
  // A plinth from below the lowest ground under it up to `top`. On a slope every cell reaches
  // its own ground, so the base steps down with the land instead of hanging over it.
  footing(x, z, w, d, top, o = {}) {
    const c = o.c || 'stone2', ry = o.ry || 0;
    const lo = this.lowest(w, d, x, z, ry), hi = this.highest(w, d, x, z, ry);
    const sink = o.sink ?? 0.9;
    if (hi - lo < 0.35 || this.k.detail < 1) {
      this.block(x, Math.min(lo, top) - sink, z, w, top - Math.min(lo, top) + sink, d, c, { ry, solid: o.solid });
    } else {
      const cell = o.cell ?? 2.4;
      const nx = Math.max(1, Math.round(w / cell)), nz = Math.max(1, Math.round(d / cell));
      const cw = w / nx, cd = d / nz, cs = Math.cos(ry), sn = Math.sin(ry);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const u = -w / 2 + cw * (i + 0.5), v = -d / 2 + cd * (j + 0.5);
        const cx = x + u * cs + v * sn, cz = z - u * sn + v * cs;
        const g = Math.min(this.lowest(cw, cd, cx, cz, ry), top);
        this.k.slab(cx, g - sink, cz, cw, top - g + sink, cd, c, { ry });
      }
      if (o.solid !== false) this.solid(x, Math.min(lo, top) - sink, z, w, top - Math.min(lo, top) + sink, d, { ry });
    }
    if (o.cap !== false) this.trim(x, top - 0.28, z, w + 0.3, 0.28, d + 0.3, o.cap || 'edge', { ry });
    return this;
  }

  // ---------------------------------------------------------------- floors, ceilings
  floor(x, y, z, w, d, c = 'floor', o = {}) {
    const t = o.t ?? 0.3;
    this.k.slab(x, y - t, z, w, t, d, c, { ry: o.ry, grad: 0.05 });
    if (o.solid !== false) this.solid(x, y - t, z, w, t, d, { ry: o.ry, climbable: false });
    return this;
  }
  // A boarded ceiling whose underside is at y, carried on beams along `axis` ('x' or 'z').
  ceiling(x, y, z, w, d, o = {}) {
    const t = o.t ?? 0.25;
    this.k.slab(x, y, z, w, t, d, o.c || 'ceiling', { ry: o.ry, grad: 0 });
    if (o.solid !== false) this.solid(x, y, z, w, t, d, { ry: o.ry, climbable: false });
    const every = o.every ?? 2.2, along = o.axis === 'x';
    const span = along ? d : w, len = along ? w : d;
    const n = Math.max(1, Math.round(span / every));
    for (let i = 0; i < n; i++) {
      const u = -span / 2 + span * (i + 0.5) / n;
      if (along) this.trim(x, y - 0.32, z + u, len, 0.32, 0.26, o.beam || 'timber', { ry: o.ry });
      else this.trim(x + u, y - 0.32, z, 0.26, 0.32, len, o.beam || 'timber', { ry: o.ry });
    }
    return this;
  }

  // ---------------------------------------------------------------- walls
  // A wall from (ax, az) to (bx, bz) standing on y, h tall and t thick, with openings cut
  // clean through it: [{ u: centre (m from a), w, y: sill above the base (0 = door), h }].
  // style 'stone' courses it; 'plaster' frames it in timber; 'brick' lays brick with stone
  // dressings; 'log' stacks logs; 'reed' weaves reed panels between posts.
  wall(ax, az, bx, bz, y, h, o = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return this;
    const t = o.t ?? 0.6, ry = Math.atan2(bx - ax, bz - az);
    const style = o.style || 'stone';
    const ops = (o.openings || []).map(op => ({ ...op, y: op.y ?? 0, h: Math.min(op.h ?? 2.8, h - (op.y ?? 0) - 0.05) }))
      .filter(op => {
        const fits = op.u - op.w / 2 > -0.01 && op.u + op.w / 2 < len + 0.01;
        if (!fits && typeof process !== 'undefined' && process.env?.MASON_WARN) console.warn(`${this.name}: opening at ${op.u.toFixed(2)} (w ${op.w}) does not fit a ${len.toFixed(2)} m wall`);
        return fits;
      }).sort((p, q) => p.u - q.u);
    this.at((ax + bx) / 2, (az + bz) / 2, ry, (m) => {
      const piece = (z0, z1, y0, y1) => {
        if (z1 - z0 < 0.02 || y1 - y0 < 0.02) return;
        const zc = -len / 2 + (z0 + z1) / 2, ln = z1 - z0;
        if (style === 'stone') m.mass(0, y + y0, zc, t, y1 - y0, ln, { c: o.c || 'stone', c2: o.c2 || 'stone2', course: o.course, climbable: o.climbable });
        else m.block(0, y + y0, zc, t, y1 - y0, ln, o.c || (style === 'brick' ? 'brick' : style === 'log' ? 'timber' : style === 'reed' ? 'plaster' : 'plaster'), { climbable: o.climbable });
      };
      // cut every opening out of the wall: between breakpoints along it, the solid is
      // whatever no opening covers (a door and a window stacked over it both stay open)
      const cuts = [0, len];
      for (const op of ops) cuts.push(Math.max(0, op.u - op.w / 2), Math.min(len, op.u + op.w / 2));
      cuts.sort((p, q) => p - q);
      let run = null; // merge equal columns into one piece per vertical band
      const flush = () => { if (run) for (const [y0, y1] of run.bands) piece(run.z0, run.z1, y0, y1); run = null; };
      for (let i = 1; i < cuts.length; i++) {
        const z0 = cuts[i - 1], z1 = cuts[i];
        if (z1 - z0 < 0.02) continue;
        const mid = (z0 + z1) / 2;
        const holes = ops.filter(op => mid > op.u - op.w / 2 && mid < op.u + op.w / 2).map(op => [op.y, op.y + op.h]).sort((p, q) => p[0] - q[0]);
        const bands = [];
        let y0 = 0;
        for (const [a, b] of holes) { if (a > y0) bands.push([y0, a]); y0 = Math.max(y0, b); }
        if (y0 < h) bands.push([y0, h]);
        const key = JSON.stringify(bands);
        if (run && run.key === key && Math.abs(run.z1 - z0) < 1e-6) run.z1 = z1;
        else { flush(); run = { z0, z1, bands, key }; }
      }
      flush();
      // dressings and glazing
      for (const op of ops) {
        const zc = -len / 2 + op.u;
        if (op.y > 0.05 && !op.door) {
          // windows: a lit or dark pane set back in the reveal, a sill and a lintel stone
          if (op.glass !== false) {
            if (op.lit ?? o.lit) m.k.glowPanel(0, y + op.y + op.h / 2, zc, 0.06, op.h, op.w, 'glow', op.strength ?? 1.15);
            else m.trim(0, y + op.y, zc, 0.06, op.h, op.w, 'dark', { grad: 0 });
            m.solid(0, y + op.y, zc, t, op.h, op.w, { walkable: false });
          }
          for (const side of [-1, 1]) {
            m.trim(side * (t / 2 + 0.06), y + op.y - 0.16, zc, 0.12, 0.16, op.w + 0.3, o.dress || 'edge');
            m.trim(side * (t / 2 + 0.05), y + op.y + op.h, zc, 0.1, 0.22, op.w + 0.3, o.dress || 'edge');
          }
          if (op.mullion) m.trim(0, y + op.y, zc, t * 0.5, op.h, 0.12, o.dress || 'edge');
        } else if (o.jambs !== false) {
          // doors: dressed jambs and a lintel, proud of both faces
          for (const side of [-1, 1]) for (const e of [-1, 1]) m.trim(side * (t / 2 + 0.05), y + op.y, zc + e * (op.w / 2 + 0.12), 0.1, op.h, 0.24, o.dress || 'edge');
          for (const side of [-1, 1]) m.trim(side * (t / 2 + 0.05), y + op.y + op.h, zc, 0.1, 0.3, op.w + 0.5, o.dress || 'edge');
          if (op.y > 0.05) m.trim(0, y + op.y - 0.06, zc, t + 0.1, 0.08, op.w + 0.1, o.dress || 'edge');
        }
      }
      if (style === 'plaster' || style === 'log' || style === 'reed') {
        // timber frame on both faces: sole plate, wall plate, posts at the ends, beside every
        // opening and at most every 2.4 m between
        const frame = o.frame || 'timber';
        // a horizontal member along the wall stops at every opening it would cross (a rail or a
        // log course run straight across a doorway read as stripes over the door)
        const along = (fx, yy, hh, dx, mat, extra) => {
          const cut = [[-Infinity, 0]];
          for (const op of ops) if (yy - y < op.y + op.h && yy - y + hh > op.y) cut.push([op.u - op.w / 2, op.u + op.w / 2]);
          cut.push([len, Infinity]);
          cut.sort((p, q) => p[0] - q[0]);
          let u0 = 0;
          for (const [a, b] of cut) {
            if (a - u0 > 0.02) m.trim(fx, yy, -len / 2 + (u0 + Math.min(a, len)) / 2, dx, hh, Math.min(a, len) - u0, mat, extra);
            u0 = Math.max(u0, b);
          }
        };
        for (const side of [-1, 1]) {
          const fx = side * (t / 2 + 0.04);
          if (style !== 'log') {
            along(fx, y, 0.24, 0.1, frame);
            along(fx, y + h - 0.24, 0.24, 0.1, frame);
          }
          const posts = [0, len];
          for (const op of ops) posts.push(op.u - op.w / 2 - 0.08, op.u + op.w / 2 + 0.08);
          posts.sort((p, q) => p - q);
          const all = [];
          for (let i = 0; i < posts.length; i++) {
            all.push(posts[i]);
            if (i + 1 < posts.length) {
              const gap = posts[i + 1] - posts[i], n = Math.floor(gap / 2.4);
              for (let j = 1; j <= n; j++) all.push(posts[i] + gap * j / (n + 1));
            }
          }
          for (const u of all) {
            const inOpening = ops.some(op => u > op.u - op.w / 2 && u < op.u + op.w / 2);
            if (inOpening) continue;
            m.trim(fx, y, -len / 2 + Math.max(0.1, Math.min(len - 0.1, u)), 0.12, h, 0.2, frame);
          }
          if (style === 'log') for (let yy = 0.45; yy < h; yy += 0.45) along(fx, y + yy - 0.05, 0.08, 0.06, 'dark', { grad: 0 });
          if (o.midRail !== false && style === 'plaster' && h > 2.6) along(fx, y + Math.min(h - 0.5, 1.0), 0.16, 0.08, frame);
        }
      } else if (style === 'brick') {
        // stone dressings: quoins at the ends and a string course under the eaves
        for (const e of [-1, 1]) for (let yy = 0, i = 0; yy < h - 0.3; yy += 0.6, i++) {
          for (const side of [-1, 1]) m.trim(side * (t / 2 + 0.03), y + yy, e * (len / 2 - (i % 2 ? 0.35 : 0.5)), 0.06, 0.56, i % 2 ? 0.7 : 1.0, o.dress || 'stone');
        }
        for (const side of [-1, 1]) m.trim(side * (t / 2 + 0.05), y + h - 0.32, 0, 0.1, 0.32, len, o.dress || 'stone');
      }
    });
    return this;
  }
  // A closed rectangular room shell: four walls of one style around (x, z), w x d outside,
  // each side with its own openings ({ n, s, e, w }: arrays as for wall(); n is +z, e is +x).
  shell(x, z, w, d, y, h, o = {}) {
    const t = o.t ?? 0.6, hw = w / 2, hd = d / 2;
    const sides = o.openings || {};
    const map = (list, f) => (list || []).map(p => ({ ...p, u: f(p.u ?? 0) }));
    // north and south walls run the full outer width; east and west fit between them
    this.wall(x - hw, z + hd - t / 2, x + hw, z + hd - t / 2, y, h, { ...o, openings: map(sides.n, u => u + hw) });
    this.wall(x + hw, z - hd + t / 2, x - hw, z - hd + t / 2, y, h, { ...o, openings: map(sides.s, u => hw - u) });
    this.wall(x + hw - t / 2, z + hd - t, x + hw - t / 2, z - hd + t, y, h, { ...o, openings: map(sides.e, u => hd - t - u) });
    this.wall(x - hw + t / 2, z - hd + t, x - hw + t / 2, z + hd - t, y, h, { ...o, openings: map(sides.w, u => u + hd - t) });
    if (o.corners !== false && (o.style || 'stone') !== 'plaster' && (o.style || 'stone') !== 'reed') {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        for (let yy = 0, i = 0; yy < h - 0.2; yy += 0.6, i++) {
          const a = i % 2 ? [0.9, 0.5] : [0.5, 0.9];
          this.trim(x + sx * (hw - a[0] / 2 + 0.05), y + yy, z + sz * (hd - a[1] / 2 + 0.05), a[0], 0.56, a[1], o.quoin || 'edge');
        }
      }
    }
    return this;
  }

  // ---------------------------------------------------------------- stairs
  // A flight climbing from (x, z) at y0 to y1 along local heading ry (0 = +z). Risers are at
  // most 0.3 m on treads `run` deep (default 0.45). Every step stands on `base`, or reaches
  // the ground under it. Returns the head of the flight.
  stair(x, z, ry, w, y0, y1, o = {}) {
    const n = Math.max(1, Math.ceil((y1 - y0) / (o.rise ?? RISE) - 1e-6));
    const rise = (y1 - y0) / n, run = o.run ?? TREAD;
    const sx = Math.sin(ry), sz = Math.cos(ry);
    const c = o.c || 'stone';
    for (let i = 0; i < n; i++) {
      const top = y0 + rise * (i + 1), u = run * (i + 0.5);
      const cx = x + sx * u, cz = z + sz * u;
      const base = o.base ?? Math.min(top - rise - 0.3, this.lowest(w, run, cx, cz, ry) - 0.4);
      this.k.slab(cx, base, cz, w, top - base, run, i % 2 && o.c2 ? o.c2 : c, { ry });
      // colliders overlap a hair so no seam between treads drops a foot to the floor below
      this.solid(cx, base, cz, w, top - base, run + 0.04, { ry, climbable: false });
      if (o.nosing !== false && this.k.detail >= 1) this.trim(cx - sx * (run / 2 - 0.03), top - 0.06, cz - sz * (run / 2 - 0.03), w - 0.04, 0.07, 0.1, o.nose || 'edge', { ry });
      if (o.cheeks) {
        // stepped cheek walls rising with the flight, a parapet's height above the treads
        for (const side of [-1, 1]) {
          const ox = Math.cos(ry) * side * (w / 2 + 0.25), oz = -Math.sin(ry) * side * (w / 2 + 0.25);
          const ph = o.cheeks === true ? 1.0 : o.cheeks;
          this.k.slab(cx + ox, base, cz + oz, 0.5, top - base + ph, run, o.cheekC || 'stone2', { ry });
          this.solid(cx + ox, base, cz + oz, 0.5, top - base + ph, run, { ry, walkable: false });
          if (i % 2 === 0) this.trim(cx + ox, top + ph, cz + oz, 0.6, 0.12, run * 2, 'edge', { ry });
        }
      }
    }
    return { x: x + sx * run * n, z: z + sz * run * n, y: y1, len: run * n, n };
  }
  // A landing: a level platform at y on its own footing.
  landing(x, z, w, d, y, o = {}) {
    const base = o.base ?? Math.min(y - 0.6, this.lowest(w, d, x, z, o.ry || 0) - 0.4);
    this.k.slab(x, base, z, w, y - base, d, o.c || 'stone', { ry: o.ry });
    this.solid(x, base, z, w, y - base, d, { ry: o.ry, climbable: false });
    return this;
  }
  // A parapet run between two points at height y (its base), 1.05 m tall.
  parapet(ax, az, bx, bz, y, o = {}) {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const t = o.t ?? 0.45, h = o.h ?? 1.05;
    this.block((ax + bx) / 2, y, (az + bz) / 2, t, h, len, o.c || 'stone2', { ry, walkable: false });
    this.trim((ax + bx) / 2, y + h, (az + bz) / 2, t + 0.14, 0.12, len + 0.1, o.cap || 'edge', { ry });
    return this;
  }
  // Iron or timber railing (open, a collider keeps you on the gallery).
  rail(ax, az, bx, bz, y, o = {}) {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const c = o.c || 'timber', h = o.h ?? 1.0;
    this.trim((ax + bx) / 2, y + h - 0.1, (az + bz) / 2, 0.12, 0.12, len, c, { ry });
    this.trim((ax + bx) / 2, y + h * 0.45, (az + bz) / 2, 0.06, 0.06, len, c, { ry });
    const n = Math.max(1, Math.round(len / 1.4));
    for (let i = 0; i <= n; i++) this.trim(ax + (bx - ax) * i / n, y, az + (bz - az) * i / n, 0.12, h, 0.12, c, { ry });
    this.solid((ax + bx) / 2, y, (az + bz) / 2, 0.2, h, len, { ry, walkable: false });
    return this;
  }

  // ---------------------------------------------------------------- roofs
  // Hipped roof over w x d whose eaves stand at y. `flare` adds a broad, shallow slate skirt
  // under a steeper body (the Compact's eaves); `snow` lays a cap of snow over it.
  roof(x, y, z, w, d, rise, o = {}) {
    const ry = o.ry || 0, ov = o.overhang ?? 0.6;
    const W = w + ov * 2, D = d + ov * 2;
    // o.along forces the ridge's direction ('x' or 'z'); otherwise it runs the long way
    const long = o.along ? o.along === 'x' : W >= D;
    const ridge = Math.max(0, (Math.max(W, D) - Math.min(W, D)) / Math.max(W, D)) * (o.ridge ?? 1);
    const rot = ry + (long ? 0 : Math.PI / 2);
    const [LW, LD] = long ? [W, D] : [D, W];
    const c = o.c || 'roof';
    const snow = o.snow ?? this.snowRoofs;
    if (o.kind === 'gable') {
      this.k.wedge(x, y, z, LD, rise, LW, c, { ry: rot + Math.PI / 2 });
      this.trim(x, y + rise - 0.06, z, LW + 0.1, 0.24, 0.3, o.ridgeC || 'ridge', { ry: rot });
      // snow: the same wedge, smaller and lifted, so it lies parallel on both slopes
      if (snow) this.k.wedge(x, y + rise * 0.4 + 0.16, z, LD * 0.6, rise * 0.6, LW + 0.2, 'snow', { ry: rot + Math.PI / 2, grad: 0.05 });
      // gable ends: boards so the wedge's triangle reads as a built end
      for (const e of [-1, 1]) {
        const ex = x + Math.cos(rot) * e * (LW / 2 - 0.02), ez = z - Math.sin(rot) * e * (LW / 2 - 0.02);
        this.trim(ex, y + rise * 0.5 - 0.1, ez, 0.1, 0.2, LD * 0.55, o.board || 'timber', { ry: rot + Math.PI / 2 });
      }
    } else if (o.kind === 'pyramid') {
      this.k.pyramid(x, y, z, Math.max(W, D) / Math.SQRT2, rise, c, { sides: 4, ry });
    } else if (o.kind === 'cone') {
      this.k.pyramid(x, y, z, W / 2, rise, c, { sides: o.sides ?? 8, ry });
    } else {
      if (o.flare) {
        const fw = LW + o.flare * 2, fd = LD + o.flare * 2;
        this.k.emit(hipUnit(Math.max(0, (fw - fd) / fw)), this.k.local(x, y - 0.12 + rise * 0.18, z, fw, rise * 0.36, fd, { ry: rot }), o.c2 || c, { grad: 0.12 });
      }
      this.k.emit(hipUnit(ridge), this.k.local(x, y + rise / 2, z, LW, rise, LD, { ry: rot }), c, { grad: 0.18 });
      if (ridge > 0.02) this.trim(x, y + rise - 0.1, z, LW * ridge + 0.4, 0.26, 0.34, o.ridgeC || 'ridge', { ry: rot });
      else this.trim(x, y + rise - 0.12, z, 0.4, 0.5, 0.4, o.ridgeC || 'ridge', { ry: rot });
      if (snow) {
        this.k.emit(hipUnit(ridge), this.k.local(x, y + rise * 0.62 + 0.14, z, LW * 0.62, rise * 0.38, LD * 0.62, { ry: rot }), 'snow', { grad: 0.06 });
      }
    }
    // eave board: the roof stands on a timber plate, never floats over the walls
    this.trim(x, y - 0.2, z, W - ov * 0.8, 0.22, D - ov * 0.8, o.plate || 'dark', { ry });
    if (o.solid !== false) {
      // the plate it stands on, then three nested layers from the plate up to their own
      // heights, so the roof rests on its walls with no gap between the steps of its slopes
      // The plate runs out under the whole overhang, so the eaves stop the camera as they stop
      // a body; a gable's layers keep its full length along the ridge (its ends are walls, not
      // slopes) so its gable ends are solid to the camera too.
      this.solid(x, y - 0.2, z, W, 0.22, D, { ry });
      const gable = o.kind === 'gable';
      for (let i = 0; i < 3; i++) {
        const f = (i + 0.5) / 3, sw = Math.max(0.8, W * (1 - f * 0.85)), sd = Math.max(0.8, D * (1 - f * 0.85));
        this.solid(x, y - 0.2, z, gable && long ? W - ov * 0.8 : sw, rise * f * 0.8 + 0.3, gable && !long ? D - ov * 0.8 : sd, { ry });
      }
    }
    return this;
  }

  // ---------------------------------------------------------------- orders
  column(x, y, z, h, r = 0.42, o = {}) {
    this.k.column(x, y, z, h, r, { c: o.c || 'stone', trim: o.trim || 'edge', sides: o.sides ?? 8 });
    if (o.solid !== false) this.pillar(x, y, z, r * 1.15, h);
    return this;
  }
  pier(x, y, z, w, h, o = {}) {
    this.k.pier(x, y, z, w, h, { d: o.d ?? w, c: o.c || 'stone', c2: o.c2 || 'stone2', trim: o.trim || 'edge' });
    if (o.solid !== false) this.solid(x, y, z, w, h, o.d ?? w);
    return this;
  }
  // An arcade face along local x from x0 to x1 at z: n bays on piers `pierH` high, arches
  // springing from them, a solid band above to `top`. The spandrel is collided.
  arcade(x0, x1, z, y, n, pierH, top, o = {}) {
    const len = x1 - x0, pw = o.pier ?? 0.9, depth = o.depth ?? 0.8;
    const span = (len - pw * (n + 1)) / n;
    for (let i = 0; i <= n; i++) this.pier(x0 + pw / 2 + i * (span + pw), y, z, pw, pierH, { d: depth, c: o.c, c2: o.c2 });
    for (let i = 0; i < n; i++) {
      const cx = x0 + pw + i * (span + pw) + span / 2;
      this.k.arch(cx, y + pierH, z, span, { t: o.t ?? Math.max(0.35, span * 0.12), depth, pointed: o.pointed, sharp: o.sharp, spandrel: true, spandrelH: 0.1, c: o.archC || 'edge', fill: o.c || 'stone' });
      const crown = y + pierH + (o.pointed ? span * 0.65 : span / 2) + (o.t ?? Math.max(0.35, span * 0.12));
      // over the piers too: the band drawn above each pier is closed, not a slit between bays,
      // and the end bays cover their end piers whole so runs meeting at a corner close up
      const l = i === 0 ? pw : pw / 2, r = i === n - 1 ? pw : pw / 2;
      this.solid(cx + (r - l) / 2, y + pierH, z, span + l + r, Math.max(0.1, top - (y + pierH)), depth, { walkable: false });
      if (top > crown + 0.05) this.k.slab(cx, crown, z, span + 0.02, top - crown, depth * 0.98, o.c || 'stone');
    }
    for (let i = 0; i <= n; i++) {
      const px = x0 + pw / 2 + i * (span + pw);
      const crown = y + pierH + (o.pointed ? span * 0.65 : span / 2) + (o.t ?? Math.max(0.35, span * 0.12));
      if (top > y + pierH) this.k.slab(px, y + pierH, z, pw, Math.max(0.05, Math.min(top, crown) - y - pierH), depth, o.c || 'stone');
    }
    if (o.cornice !== false) this.trim((x0 + x1) / 2, top, z, len + 0.2, 0.25, depth + 0.3, 'edge');
    return this;
  }
  // A pointed or round doorway arch dressing a wall opening (visual only).
  doorArch(x, y, z, w, ry = 0, o = {}) {
    this.k.arch(x, y, z, w, { ry, t: o.t ?? 0.32, depth: o.depth ?? 0.3, pointed: o.pointed ?? true, sharp: o.sharp ?? 0.7, spandrel: o.spandrel ?? false, c: o.c || 'edge', key: o.key || 'edge' });
    return this;
  }

  // ---------------------------------------------------------------- light and life
  light(x, y, z, o = {}) {
    if (this.lightBudget <= 0 && !o.force) return this;
    this.lightBudget--;
    // intensities are given as a lamp's brightness; lights are physical (candela, inverse
    // square), so a room light needs several times the number to fill its room
    this.world.addLight?.(this.point(x, y, z), o.color || this.color('glow'), (o.intensity ?? 1) * (o.raw ? 1 : 6), o.distance ?? 12, o.flicker ?? false, o.priority ?? 1, o.night);
    return this;
  }
  lantern(x, y, z, o = {}) {
    this.k.lantern(x, y, z, { post: o.post ?? 0, glow: o.glow || 'glow', strength: o.strength, base: o.base, metal: o.metal });
    if (o.light !== false) this.light(x, y + (o.post ?? 0) + 0.36, z, { intensity: o.intensity ?? 0.8, distance: o.distance ?? 11, flicker: true, priority: o.priority ?? 0.6 });
    return this;
  }
  // A hanging lantern on a chain from a ceiling at `ceil`.
  hanging(x, ceil, z, drop = 1.2, o = {}) {
    this.trim(x, ceil - drop + 0.5, z, 0.05, drop - 0.5, 0.05, 'metal', { layer: 'metal' });
    return this.lantern(x, ceil - drop - 0.5, z, { ...o, post: 0 });
  }
  banner(x, y, z, w, h, c = 'cloth', ry = 0) {
    this.k.banner(x, y, z, w, h, c, { ry });
    return this;
  }
  window(x, y, z, w, h, ry, o = {}) {
    this.k.window(x, y, z, w, h, { ry, lit: o.lit, pointed: o.pointed, strength: o.strength ?? 1.1, trim: o.trim });
    return this;
  }
  glow(x, y, z, w, h, d, strength = 1.2, c = 'glow') {
    this.k.glowPanel(x, y, z, w, h, d, c, strength);
    return this;
  }

  // ---------------------------------------------------------------- records
  // Where weather stops: rain and snow are not drawn inside this volume (world/weather.js).
  shelter(x, z, w, d, y0, y1, ry = 0) {
    const [fx, fz] = this.site(x, z);
    const [wx, wz] = this.f.at(fx, fz);
    addShelter(this.world, wx, wz, w, d, this.yaw + this.t.ry + ry, this.f.y + y0, this.f.y + y1);
    return this;
  }

  build() {
    if (this.k.tris) this.g.add(this.k.build(this.name));
    return this.g;
  }
}

// A volume the weather keeps out of: w x d round (x, z) turned by rot, from y0 to y1 (world).
export function addShelter(world, x, z, w, d, rot, y0, y1) {
  (world.shelters ||= []).push({ x, z, hw: w / 2, hd: d / 2, cos: Math.cos(rot), sin: Math.sin(rot), y0, y1 });
}

// Shelters near a point (for weather occlusion), in world space.
export function shelterAt(world, x, y, z) {
  for (const s of world.shelters || []) {
    if (y < s.y0 || y > s.y1) continue;
    const dx = x - s.x, dz = z - s.z;
    const lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
    if (Math.abs(lx) <= s.hw && Math.abs(lz) <= s.hd) return s;
  }
  return null;
}

export { shade };
