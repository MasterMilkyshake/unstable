// The Rift's fortification vocabulary, shared by the city's outer curtain, the citadel's ring
// and the walls that tie the outer fortresses in: one way of building a run, a tower and a
// gatehouse, so block size, course height, parapets and footings match wherever they meet.
//
// Every run ends inside the tower at each of its ends (towers are wider than the wall is
// thick), so no seam or slit is left between pieces; every piece stands on a footing that
// reaches below the lowest ground under it; every collider comes from the same call that
// built the masonry. Coordinates are local to a Wall frame (origin ox, oz; y is world height).
import * as THREE from 'three';
import { Kit, groundRange } from './kit.js';
import { SCALE, PALETTES } from './style.js';

// The drowned city's stone with its one accent: the warm amber of a kept lamp, never white.
export const CITY_PAL = { ...PALETTES.rift_city, glow: '#d39a56' };

const UP = Math.PI / 2;

export class WallFrame {
  constructor(world, ox, oz, palette, o = {}) {
    this.world = world;
    this.ox = ox;
    this.oz = oz;
    this.k = new Kit(palette, { detail: o.low ? 0 : 1 });
    this.tag = o.tag || 'rift_wall';
    this.name = o.name || 'rift_walls';
    this.ex = [];
    this.walks = [];
  }
  ground(x, z) {
    return this.world.terrain.heightAt(this.ox + x, this.oz + z);
  }
  lowest(x, z, w, d, ry = 0) {
    return groundRange(this.world.terrain, this.ox + x, this.oz + z, w, d, ry, 4)[0];
  }
  highest(x, z, w, d, ry = 0) {
    return groundRange(this.world.terrain, this.ox + x, this.oz + z, w, d, ry, 4)[1];
  }
  solid(x, z, w, d, y0, y1, rot = 0, o = {}) {
    if (!(y1 > y0)) return null;
    return this.world.colliders.addBox({ x: this.ox + x, z: this.oz + z, w, d, y0, y1, rot, climbable: o.climbable ?? true, walkable: o.walkable ?? true, tag: this.tag });
  }
  exclude(x, z, r) {
    this.ex.push({ x: this.ox + x, z: this.oz + z, r });
  }
  build() {
    const g = this.k.build(this.name);
    g.position.set(this.ox, 0, this.oz);
    this.world.scene.add(g);
    return g;
  }
}

// A curtain from A to B: coursed masonry on a footing, the battered skirt on the side the enemy
// came from (`out`: +1 = the run's local +x), a corbelled parapet with merlons over it, a low
// parapet on the walk's inner edge, slits on the outer face. `top` is the walk.
export function curtain(F, ax, az, bx, bz, o) {
  const k = F.k;
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.5) return null;
  const ry = Math.atan2(bx - ax, bz - az);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const t = o.t ?? 4, top = o.top, out = o.out ?? 1;
  const bw = o.batter ?? 1.4;
  const foot = Math.min(o.base ?? top - 10, F.lowest(mx, mz, t + bw * 2 + 1, len, ry)) - SCALE.footing;
  const skirtTop = Math.min(top - 3, (o.skirt ?? F.highest(mx + Math.cos(ry) * out * (t / 2 + 1), mz - Math.sin(ry) * out * (t / 2 + 1), 2, len, ry)) + 2.4);
  const fine = k.detail >= 1;
  const pTop = top + SCALE.parapet + 0.2;
  k.at({ x: mx, z: mz, ry }, () => {
    k.masonry(0, foot, 0, t, top - foot, len, { course: SCALE.course * 3 });
    // the battered skirt on the outside, down the full height of the footing
    if (skirtTop > foot + 0.5) k.ramp(out * (t / 2 + bw / 2), foot, 0, len, skirtTop - foot, bw, 'stone2', { ry: out * UP });
    if (fine && skirtTop > foot + 0.5) k.slab(out * (t / 2 + 0.12), skirtTop - 0.25, 0, 0.5, 0.35, len, 'edge');
    // a string course two-thirds up
    if (fine) k.slab(0, foot + (top - foot) * 0.68, 0, t + 0.36, 0.3, len, 'edge');
    // the walk, its outer parapet on corbels with merlons, and the low inner parapet
    k.slab(0, top - 0.3, 0, t + 0.5, 0.3, len, 'edge');
    if (fine) {
      const n = Math.max(2, Math.round(len / 1.6));
      for (let i = 0; i < n; i++) k.ramp(out * (t / 2 + 0.35), top - 1.6, -len / 2 + (len / n) * (i + 0.5), 0.55, 1.3, 0.7, 'edge', { rz: Math.PI, ry: out * UP + Math.PI });
    }
    k.slab(out * (t / 2), top, 0, 0.7, pTop - top, len, 'stone');
    if (fine) k.crenels(out * (t / 2), -len / 2 + 0.6, out * (t / 2), len / 2 - 0.6, pTop, 0.7, { c: 'stone', h: 1.0 });
    k.slab(-out * (t / 2 - 0.3), top, 0, 0.6, SCALE.parapet * 0.9, len, 'stone2');
    if (fine && o.slits !== false) {
      const n = Math.max(1, Math.floor(len / 7));
      for (let i = 0; i < n; i++) k.window(out * (t / 2 + 0.01), foot + (top - foot) * 0.45, -len / 2 + (len / n) * (i + 0.5), 0.42, 2.2, { ry: out * UP, pointed: true });
    }
  });
  F.solid(mx, mz, t, len, foot, top, ry);
  F.solid(mx + Math.cos(ry) * out * (t / 2), mz - Math.sin(ry) * out * (t / 2), 0.7, len, top, pTop, ry);
  F.solid(mx - Math.cos(ry) * out * (t / 2 - 0.3), mz + Math.sin(ry) * out * (t / 2 - 0.3), 0.6, len, top, top + SCALE.parapet * 0.9, ry);
  for (let u = -len / 2; u <= len / 2 + 0.01; u += 8) F.exclude(mx + Math.sin(ry) * u, mz + Math.cos(ry) * u, t / 2 + bw + 3);
  F.walks.push({ x: F.ox + mx, z: F.oz + mz, top });
  return { ry, len, mx, mz, foot, top, nx: Math.cos(ry) * out, nz: -Math.sin(ry) * out };
}

// A square tower on a battered footing, rising `rise` above the walls it joins, with a
// machicolated fighting platform and either merlons or a roof. Its slits and one lit window
// face outward (`face`, radians, the way its front looks).
export function tower(F, x, z, o) {
  const k = F.k;
  const w = o.w ?? 9, top = o.top, ry = o.ry ?? 0;
  const foot = Math.min(o.base ?? top - 12, F.lowest(x, z, w + 3, w + 3, ry)) - SCALE.footing;
  const fine = k.detail >= 1;
  // a battered base, except where the tower lines a gate passage and must stand plumb
  const batterTop = o.plain ? foot : Math.min(top - 4, (o.base ?? foot + 4) + 3);
  k.at({ x, z, ry }, () => {
    if (!o.plain) k.prism(0, foot, 0, ((w + 2.4) / 2) * Math.SQRT2, batterTop - foot, 'stone2', { sides: 4, top: w / (w + 2.4) });
    k.masonry(0, batterTop, 0, w, top - batterTop, w, { course: SCALE.course * 3 });
    if (fine) for (let y = batterTop + 6; y < top - 2; y += 7.2) k.slab(0, y, 0, w + 0.36, 0.3, w + 0.36, 'edge');
    // machicolated platform: corbels, the projecting floor, parapet and merlons
    const P = w + 1.4;
    if (fine) {
      for (let f = 0; f < 4; f++) {
        const a = f * UP;
        const n = Math.max(3, Math.round(w / 1.6));
        for (let i = 0; i < n; i++) {
          const u = -w / 2 + (w / n) * (i + 0.5);
          k.ramp(Math.sin(a) * (w / 2 + 0.35) + Math.cos(a) * u, top - 1.8, Math.cos(a) * (w / 2 + 0.35) - Math.sin(a) * u, 0.6, 1.5, 0.7, 'edge', { rz: Math.PI, ry: a + Math.PI });
        }
      }
    }
    k.slab(0, top - 0.4, 0, P, 0.4, P, 'edge');
    for (let f = 0; f < 4; f++) {
      const a = f * UP;
      const px = Math.sin(a) * (P / 2 - 0.35), pz = Math.cos(a) * (P / 2 - 0.35);
      k.at({ x: px, z: pz, ry: a }, () => {
        k.slab(0, top, 0, P, SCALE.parapet + 0.2, 0.7, 'stone');
        if (fine && !o.roof) k.crenels(-P / 2 + 0.6, 0, P / 2 - 0.6, 0, top + SCALE.parapet + 0.2, 0.7, { c: 'stone', h: 1.0 });
      });
    }
    if (o.roof === 'hip') k.roof('hip', 0, top + SCALE.parapet + 0.2, 0, w - 0.6, w - 0.6, o.roofH ?? w * 0.7, { c: 'roof', overhang: 0.2 });
    else if (o.roof === 'spire') {
      k.slab(0, top, 0, w - 1.2, 2.4, w - 1.2, 'stone2');
      k.pyramid(0, top + 2.4, 0, ((w - 1) / 2) * Math.SQRT2, o.roofH ?? w * 1.8, 'roof', { sides: 4 });
    }
    if (fine) {
      // slits on all four faces, a lit window on the face that looks out
      for (let f = 0; f < 4; f++) {
        const a = f * UP;
        for (let y = batterTop + 3; y < top - 4; y += 7.2) {
          const lit = o.lit && f === 0 && y + 7.2 >= top - 4;
          k.window(Math.sin(a) * (w / 2 + 0.01), y, Math.cos(a) * (w / 2 + 0.01), lit ? 0.8 : 0.42, lit ? 2.2 : 2.0, { ry: a, pointed: true, lit, strength: 0.6 });
        }
      }
    }
  });
  if (!o.plain) F.solid(x, z, w + 1.2, w + 1.2, foot, Math.min(batterTop, top), ry);
  F.solid(x, z, w, w, foot, top, ry);
  for (let f = 0; f < 4; f++) {
    const a = ry + f * UP;
    const P = w + 1.4;
    F.solid(x + Math.sin(a) * (P / 2 - 0.35), z + Math.cos(a) * (P / 2 - 0.35), P, 0.7, top, top + SCALE.parapet + 0.2, a);
  }
  F.exclude(x, z, w * 0.75 + 2);
  return { x, z, top, w, lit: o.lit ? { x: F.ox + x + Math.sin(ry) * (w / 2 + 0.8), y: top - 6, z: F.oz + z + Math.cos(ry) * (w / 2 + 0.8) } : null };
}

// A gatehouse through a curtain at (x, z), its outer face toward local -z (yaw as kit.siteFrame):
// two flanking towers, a vaulted passage with a pointed arch at each face, a portcullis, the
// machicolated box over the outer arch and lamps either side of the way in. `floor` is the
// passage's level (the ground it carries the road over).
export function gatehouse(F, x, z, yaw, o) {
  const k = F.k;
  const W = o.width ?? 8, D = o.depth ?? 12, TW = o.towers ?? 10;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  // The passage carries the way between whatever stands at its two ends (ground, a stair, a
  // graded road): level where they agree, a gentle ramp where they do not.
  const endY = (lz) => {
    const [wx, wz] = at(0, lz);
    const g = F.ground(wx, wz);
    return Math.max(g, F.world.colliders.groundAt(F.ox + wx, F.oz + wz, g + 1.2));
  };
  const yOut = o.floorOut ?? endY(-D / 2 - 0.6), yIn = o.floorIn ?? endY(D / 2 + 0.6);
  const floor = Math.max(yOut, yIn);
  const floorAt = (lz) => yOut + (yIn - yOut) * Math.min(1, Math.max(0, (lz + D / 2) / D));
  const top = o.top, ttop = o.towerTop ?? top + 6;
  const spring = floor + Math.max(4.2, W * 0.55);
  const apex = spring + W * 0.62;
  const fine = k.detail >= 1;
  const lights = [];
  const gateTag = F.tag + '_gate';
  // the flanking towers own the corners of the passage
  for (const sx of [-1, 1]) {
    const [tx, tz] = at(sx * (W / 2 + TW / 2), 0);
    tower(F, tx, tz, { w: TW, top: ttop, base: Math.min(yOut, yIn), ry: yaw + Math.PI, lit: sx > 0 && o.lit !== false, plain: true });
  }
  const foot = Math.min(yOut, yIn, F.lowest(x, z, W + 2, D, yaw)) - SCALE.footing;
  const slices = Math.max(2, Math.round(D / 1.2));
  k.at({ x, z, ry: yaw }, () => {
    // passage floor in flags following its slope, cheeks, and the vault over it
    for (let i = 0; i < slices; i++) {
      const lz = -D / 2 + (i + 0.5) * (D / slices), y = floorAt(lz);
      k.slab(0, foot, lz, W + 0.2, y - 0.1 - foot, D / slices + 0.02, 'stone2');
      k.slab(0, y - 0.1, lz, W - 0.2, 0.1, D / slices - 0.08, i % 2 ? 'stone' : 'edge', { grad: 0.05 });
    }
    for (const sx of [-1, 1]) k.slab(sx * (W / 2 + 0.05), Math.min(yOut, yIn), 0, 0.1, apex - Math.min(yOut, yIn), D, 'stone2');
    k.masonry(0, apex + 0.6, 0, W + 0.2, top - apex - 0.6, D, { course: SCALE.course * 3 });
    k.slab(0, apex + 0.3, 0, W, 0.3, D - 1, 'stone2');
    for (const lz of [-D / 2 + 0.8, D / 2 - 0.8]) {
      k.arch(0, spring, lz, W, { pointed: true, t: 1.0, depth: 1.6, spandrel: true, spandrelH: 0.4, c: 'edge', fill: 'stone', key: 'edge' });
      k.masonry(0, apex + 0.4, lz, W + 2.2, top - apex - 0.4, 1.6, { course: SCALE.course * 3 });
    }
    // the portcullis, raised: its teeth hang under the outer arch
    const pz = -D / 2 + 2.3;
    const n = Math.max(3, Math.round(W / 0.9));
    for (let i = 0; i < n; i++) {
      const px = -W / 2 + 0.45 + (i * (W - 0.9)) / (n - 1);
      k.prism(px, apex - 2.6, pz, 0.11, 2.6, 'metal', { sides: 4, layer: 'metal' });
      k.pyramid(px, apex - 3.1, pz, 0.15, 0.5, 'metal', { sides: 4, layer: 'metal', rx: Math.PI });
    }
    for (const yy of [apex - 2.0, apex - 0.8]) k.slab(0, yy, pz, W - 0.4, 0.16, 0.16, 'metal', { layer: 'metal' });
    // the box over the outer arch: corbels, a parapet and merlons on top of the block
    if (fine) for (let i = 0; i < Math.round(W / 1.3); i++) k.ramp(-W / 2 + 0.65 + i * 1.3, top - 2.6, -D / 2 - 0.45, 0.6, 1.6, 0.9, 'edge', { rz: Math.PI });
    k.slab(0, top - 1, -D / 2 - 0.45, W + 0.2, 1.0, 0.9, 'stone');
    k.slab(0, top - 0.3, 0, W + 0.4, 0.3, D, 'edge');
    for (const lz of [-D / 2 - 0.55, D / 2 - 0.35]) {
      k.slab(0, top, lz, W + 0.2, SCALE.parapet + 0.2, 0.7, 'stone');
      if (fine) k.crenels(-W / 2 + 0.6, lz, W / 2 - 0.6, lz, top + SCALE.parapet + 0.2, 0.7, { c: 'stone', h: 1.0 });
    }
    // lamps either side of the way in, on brackets from the towers' faces
    for (const sx of [-1, 1]) {
      const flame = k.lantern(sx * (W / 2 + 0.7), spring - 0.6, -D / 2 - 0.5, { post: 0, strength: 1.1 });
      k.slab(sx * (W / 2 + 0.7), spring - 0.1, -D / 2 - 0.2, 0.12, 0.12, 0.8, 'metal', { layer: 'metal' });
      lights.push(flame.clone().add(new THREE.Vector3(F.ox, 0, F.oz)));
    }
  });
  // colliders: the passage floor where it stands above the ground, the mass over the vault
  // following the arch soffit, the walk
  for (let i = 0; i < slices; i++) {
    const lz = -D / 2 + (i + 0.5) * (D / slices), y = floorAt(lz);
    const [px, pz] = at(0, lz);
    if (y - 0.02 > F.ground(px, pz)) F.world.colliders.addBox({ x: F.ox + px, z: F.oz + pz, w: W + 0.2, d: D / slices + 0.02, y0: foot, y1: y - 0.02, rot: yaw, climbable: true, walkable: true, tag: gateTag });
  }
  const rows = 16;
  for (let i = 0; i < rows; i++) {
    const u = -W / 2 + (i + 0.5) * (W / rows);
    const rr = W * 0.8, off = W / 2;
    const soffit = spring + Math.sqrt(Math.max(0, rr * rr - (Math.abs(u) + rr - off) ** 2));
    const [px, pz] = at(u, 0);
    F.world.colliders.addBox({ x: F.ox + px, z: F.oz + pz, w: W / rows, d: D, y0: Math.min(soffit, apex), y1: top, rot: yaw, climbable: true, walkable: true, tag: gateTag });
  }
  for (const lz of [-D / 2 - 0.55, D / 2 - 0.35]) {
    const [px, pz] = at(0, lz);
    F.world.colliders.addBox({ x: F.ox + px, z: F.oz + pz, w: W + 0.2, d: 0.7, y0: top, y1: top + SCALE.parapet + 0.2, rot: yaw, climbable: true, walkable: true, tag: gateTag });
  }
  // the band the front parapet stands on, out over the gate's face: it carries the parapet onto
  // the mass over the vault (without it the parapet hung 0.2 m clear of it)
  {
    const [px, pz] = at(0, -D / 2 - 0.45);
    F.world.colliders.addBox({ x: F.ox + px, z: F.oz + pz, w: W + 0.2, d: 0.9, y0: top - 1, y1: top, rot: yaw, climbable: true, walkable: true, tag: gateTag });
  }
  F.exclude(x, z, W + TW + 3);
  return { floor, top, lights, spring, apex };
}

// Walk a closed or open chain of nodes: a tower (or gatehouse) at every node and a curtain
// between each pair, trimmed into the towers at both ends. Each node may carry its own base
// and wall top; a run takes the higher of its two ends' tops so the walk never drops into a
// tower's merlons. `outward(mx, mz, nx, nz)` picks the outer side of a run.
export function circuit(F, nodes, o) {
  const placed = nodes.map((n) => ({ ...n }));
  const out = { towers: [], gates: [], runs: [], lights: [] };
  for (const n of placed) {
    if (n.kind === 'gate') {
      const g = gatehouse(F, n.x, n.z, n.yaw, { ...n.def, top: n.top, towerTop: n.top + 5, floor: n.floor });
      out.gates.push({ ...g, x: F.ox + n.x, z: F.oz + n.z });
      out.lights.push(...g.lights);
      n.half = (n.def.width ?? 8) / 2 + (n.def.towers ?? 10) - 1.2;
      n.alongYaw = n.yaw + Math.PI / 2;
    } else if (n.kind !== 'end') {
      const t = tower(F, n.x, n.z, { w: n.w ?? 9, top: n.top + (n.rise ?? 4), base: n.base, ry: n.ry ?? 0, roof: n.roof, lit: n.lit });
      out.towers.push(t);
      if (t.lit) out.lights.push(new THREE.Vector3(t.lit.x, t.lit.y, t.lit.z));
      n.half = (n.w ?? 9) / 2 - 1.2;
    } else n.half = 0;
  }
  for (let i = 0; i + 1 < placed.length; i++) {
    const a = placed[i], b = placed[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    // a gate's passage runs across the curtain: trim the run to its tower's outer face
    const ta = a.kind === 'gate' ? a.half : a.half, tb = b.kind === 'gate' ? b.half : b.half;
    const ax = a.x + ux * ta, az = a.z + uz * ta, bx = b.x - ux * tb, bz = b.z - uz * tb;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const ry = Math.atan2(bx - ax, bz - az);
    const nx = Math.cos(ry), nz = -Math.sin(ry);
    const side = o.outward(mx, mz, nx, nz);
    const top = o.runTop ? o.runTop(mx, mz) : Math.max(a.top, b.top);
    const base = Math.min(a.base ?? top - 12, b.base ?? top - 12);
    out.runs.push(curtain(F, ax, az, bx, bz, { t: o.t, top, out: side, base }));
  }
  return out;
}
