// Houses, inns, smithies and barracks in the way each region builds. The shell, the floors,
// the stair and the rooms come from one plan; the walls, roof and dressings from the
// region's own vernacular, in its one palette (world/mason.js BUILD_PALETTES):
//
//   salt       the Compact's towns: salt-stone ground floors, jettied plaster upper storeys,
//              flared slate hips
//   farm       the Compact's hamlets: one storey of fieldstone under a steep slate gable
//   enclave  Meridian: red brick with grey quoins and string courses, low slate hips
//   frost      Frostwatch and White Pass: logs on a fieldstone sill, steep snow-loaded gables,
//              a smoking chimney
//   root       Canopy Landing, Vinewatch and the Verdance: timber on stilts among the roots
//   cinder     Cinderstead and the Ashen Spire: thick basalt under Thornwood's steep gables,
//              turfed, with red-stained timber and ember-lit slits
//   reed       Reedbank and Shimmerfen: reed walls on piles, verandas over the water, thatch
//   redwake    Thornwood and Rook's Landing: red-stained longhouses with horned gables
//   hush       the Ministry's Hush: grey stone and plaster under two tiers of grey eaves
//
// Local frame: the door faces +z; y is relative to the ground at the centre; F is the floor.
// Contracts other systems rely on: the front door path (x = 0) is clear from outside to the
// room; an inn's stair climbs the -x wall front to back to its sleeping loft; its host stands
// at z = -d/2 + 1 behind the counter; its rest point is at (0, F, 1).
import * as THREE from 'three';
import { Mason, BUILD_PALETTES, RISE } from './mason.js';
import * as F from './furnishing.js';
import { FEN_STILT, ROOT_STILT } from '../data/world.js';

const hash = (x, z, k = 0) => {
  const h = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return h - Math.floor(h);
};

// Which way a building is built, from its style or palette and where it stands.
export function vernacularOf(s) {
  const key = s.style || s.palette;
  if (key === 'enclave') return 'enclave';
  if (key === 'redwake') return 'redwake';
  if (key === 'reed') return 'reed';
  if (key === 'frost') return 'frost';
  if (key === 'cinder') return 'cinder';
  if (key === 'root') return 'root';
  if (key === 'hush') return 'hush';
  // the Compact's hamlets beyond the walls
  if (s.z > 150 && s.z < 420 && s.x > -120 && s.x < 300) return s.x > 150 ? 'wood' : 'farm';
  return 'salt';
}

const PAL = { salt: 'salt', farm: 'salt', wood: 'salt', enclave: 'enclave', frost: 'frost', root: 'root', cinder: 'cinder', reed: 'reed', redwake: 'redwake', hush: 'hush' };
const STYLE = { salt: 'stone', farm: 'stone', wood: 'log', enclave: 'brick', frost: 'log', root: 'plaster', cinder: 'stone', reed: 'reed', redwake: 'log', hush: 'stone' };

export function buildVernacular(world, s, add, exclusions) {
  const V = vernacularOf(s);
  const yaw = s.rot || 0;
  const w = s.w || 9, d = s.d || 8;
  const type = s.type;
  const inn = type === 'inn', smithy = type === 'smithy', barracks = type === 'barracks';
  const hall = type === 'hall', store = type === 'warehouse', hut = type === 'hut';
  const m = new Mason(world, { x: s.x, z: s.z, yaw, palette: PAL[V], tag: type, name: s.name || `${V} ${type}`, lights: 5 });
  const stilts = V === 'reed' ? FEN_STILT : V === 'root' ? ROOT_STILT : 0;
  // level the floor with the uphill side (or raise it on piles above the highest ground)
  const hi = m.highest(w + 1.4, d + 1.4);
  const Fy = stilts ? Math.max(hi, 0) + stilts : Math.max(0, hi) + 0.25;
  const floorT = 0.35; // finished floor thickness; plinth stops under it so tops do not z-fight

  const t = V === 'cinder' ? 0.6 : V === 'enclave' || V === 'salt' || V === 'hush' || V === 'farm' ? 0.6 : 0.5;
  const twoStorey = inn || (barracks && d >= 9) || (type === 'house' && !s.low && d >= 8 && V !== 'cinder' && V !== 'farm' && V !== 'wood');
  const H1 = inn ? 3.7 : smithy ? 4.4 : hall ? 6.2 : store ? 5.4 : hut ? 2.8 : V === 'cinder' ? 3.2 : 3.5;
  // a longhouse's upper room is its roof space: a knee wall, then the rafters
  const loftInRoof = V === 'redwake' || V === 'cinder';
  const H2 = loftInRoof ? 1.1 : 3.0;
  const H = twoStorey ? H1 + H2 : H1;
  const doorW = inn || hall ? 2.2 : smithy ? 2.6 : store ? 3.2 : hut ? 1.2 : 1.6, doorH = smithy ? 3.0 : store ? 3.6 : inn || hall ? 2.8 : hut ? 2.2 : 2.6;
  // where the fire is: the chimney stands over it, on the wall it backs onto
  const hx0 = w / 2 - t, bz0 = -d / 2 + t;
  const hearthAt = inn ? [hx0 - 0.35, -d * 0.12, -Math.PI / 2] : smithy ? [-w * 0.18, bz0 + 0.85, 0] : barracks || store || hall || hut ? null
    : [twoStorey ? Math.min(hx0 - 1.4, w * 0.18) : 0, bz0 + 0.35, 0];
  const flue = !hearthAt ? null : inn ? [w / 2 - 0.5, -d * 0.12] : [hearthAt[0], -d / 2 + 0.5];
  const ctx = { V, s, w, d, t, Fy, H1, H2, H, twoStorey, inn, smithy, barracks, hall, store, hut, loftInRoof, doorW, doorH, yaw, hearthAt, flue };

  // ---- the ground under it: a stepped plinth, or piles and a deck
  if (stilts) {
    const deckD = V === 'reed' ? d + 3.2 : d + 2.4, deckZ = (deckD - d) / 2;
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) {
      if (sx === 0 && sz === 0) continue;
      const px = sx * (w / 2 + 0.2), pz = deckZ + sz * (deckD / 2 - 0.2);
      const g = m.ground(px, pz);
      m.block(px, Math.min(g, Fy) - 1.2, pz, 0.36, Fy - Math.min(g, Fy) + 1.2, 0.36, 'timber', { walkable: false });
      if (sz !== 0 && sx !== 0) m.trim(px * 0.5, (g + Fy) / 2 - 0.1, pz, Math.abs(px) * 1.05, 0.16, 0.16, 'timber', { rz: sx * Math.atan2(Fy - g, Math.abs(px)) * 0.8 });
    }
    m.floor(0, Fy, deckZ, w + 0.8, deckD, 'floor', { t: 0.3 });
    // rails round the deck, open at the front where the steps come up
    const rx = w / 2 + 0.3, rz0 = deckZ - deckD / 2 + 0.1, rz1 = deckZ + deckD / 2 - 0.1;
    m.rail(-rx, rz0, -rx, rz1, Fy); m.rail(rx, rz0, rx, rz1, Fy);
    m.rail(-rx, rz1, -1.1, rz1, Fy); m.rail(1.1, rz1, rx, rz1, Fy);
    const foot = m.ground(0, rz1 + Fy / RISE * 0.42 + 0.5);
    m.stair(0, rz1 + Math.ceil((Fy - foot) / RISE) * 0.42, Math.PI, 1.6, foot, Fy, { run: 0.42, c: 'timber', nose: 'dark', nosing: false });
  } else {
    // plinth tops under the boards; a coplanar footing+floor pair z-fights (Saltreach houses)
    m.footing(0, 0, w + 0.5, d + 0.5, Fy - floorT, { c: V === 'enclave' ? 'stone2' : 'stone2', cap: 'edge', sink: 0.8 });
    // steps up to the door where the ground falls away in front of it
    const g = m.ground(0, d / 2 + 1.2);
    if (g < Fy - 0.35) m.stair(0, d / 2 + 0.25 + Math.ceil((Fy - g) / RISE) * 0.45, Math.PI, Math.max(2.2, doorW + 0.6), g, Fy, { run: 0.45, cheeks: false });
    m.floor(0, Fy, 0, w - 0.05, d - 0.05, 'floor', { t: floorT });
  }

  // ---- openings: the door in the front, windows spaced round each storey
  const winW = V === 'cinder' ? 0.45 : V === 'enclave' ? 1.0 : 1.1, winH = V === 'cinder' ? 0.9 : V === 'enclave' ? 1.7 : 1.3;
  const sill = V === 'cinder' ? 1.5 : 1.0;
  const spread = (len, every, skip = []) => {
    const n = Math.max(1, Math.floor((len - 1.2) / every));
    const out = [];
    for (let i = 0; i < n; i++) { const u = -len / 2 + len * (i + 0.5) / n; if (!skip.some(([a, b]) => u > a && u < b)) out.push(u); }
    return out;
  };
  const lit = (i) => hash(s.x + i, s.z, 2) < 0.7;
  const ground = {
    n: [{ u: 0, w: doorW, h: doorH }, ...spread(w, 2.6, [[-doorW / 2 - 0.9, doorW / 2 + 0.9]]).map((u, i) => ({ u, w: winW, y: sill, h: winH, lit: lit(i) }))],
    s: spread(w, 3.0).map((u, i) => ({ u, w: winW, y: sill, h: winH, lit: lit(i + 3) })),
    e: spread(d, 3.0).map((u, i) => ({ u, w: winW, y: sill, h: winH, lit: lit(i + 6) })),
    w: inn || twoStorey ? [] : spread(d, 3.0).map((u, i) => ({ u, w: winW, y: sill, h: winH, lit: lit(i + 9) })),
  };
  if (smithy) ground.e = [{ u: 0, w: 2.2, y: 1.0, h: 2.0, glass: false, lit: false, door: true }];
  if (hall) for (const k of ['e', 'w']) ground[k] = spread(d, 2.8).map((u, i) => ({ u, w: 1.0, y: 3.4, h: 2.0, lit: lit(i + 30) }));
  if (store) { ground.e = spread(d, 4).map(u => ({ u, w: 0.5, y: 3.6, h: 1.0 })); ground.w = ground.e.map(o => ({ ...o })); ground.s = []; }
  if (hut) { ground.s = []; ground.e = [{ u: 0, w: 0.8, y: 1.1, h: 0.8, lit: true }]; ground.w = []; }
  const upper = {
    n: spread(w, 2.4).map((u, i) => ({ u, w: winW, y: 0.8, h: winH, lit: lit(i + 12) })),
    s: spread(w, 3.0).map((u, i) => ({ u, w: winW, y: 0.8, h: winH, lit: lit(i + 15) })),
    e: spread(d, 3.0).map((u, i) => ({ u, w: winW, y: 0.8, h: winH, lit: lit(i + 18) })),
    w: spread(d, 3.2).map((u, i) => ({ u, w: winW, y: 0.9, h: winH * 0.8, lit: lit(i + 21) })),
  };

  // ---- walls
  const style = STYLE[V];
  if (V === 'salt' || V === 'hush') {
    // a stone ground storey, a plaster-and-timber storey over it
    m.shell(0, 0, w, d, Fy, H1, { t, openings: ground, style: 'stone', lit: true });
    if (twoStorey) {
      m.trim(0, Fy + H1 - 0.28, 0, w + 0.3, 0.28, d + 0.3, 'edge');
      m.shell(0, 0, w, d, Fy + H1, H2, { t: 0.4, openings: upper, style: 'plaster', lit: true, frame: 'timber' });
    }
  } else if (V === 'frost') {
    // logs to the eaves on the fieldstone plinth
    m.shell(0, 0, w, d, Fy, H, { t, openings: mergeStoreys(ground, twoStorey ? upper : null, H1), style: 'log', lit: true, frame: 'timber' });
  } else {
    m.shell(0, 0, w, d, Fy, H, { t, openings: mergeStoreys(ground, twoStorey && !loftInRoof ? upper : null, H1), style, lit: true, frame: 'timber',
      dress: V === 'enclave' ? 'stone' : undefined, c2: V === 'cinder' ? 'edge' : undefined, course: V === 'cinder' ? 0.9 : undefined });
  }
  // the door leaf, swung open inside, and its frame
  m.trim(doorW / 2 - 0.08, Fy, d / 2 - t - 0.75, 0.08, doorH - 0.1, 1.4, 'dark', { ry: 0.2 });
  if (V === 'salt' || V === 'hush') m.doorArch(0, Fy + doorH, d / 2 + 0.06, doorW + 0.2, 0, { t: 0.28, depth: 0.22, pointed: false });

  // ---- inside: ceilings and an upper floor round the stair well
  const inner = { x0: -w / 2 + t, x1: w / 2 - t, z0: -d / 2 + t, z1: d / 2 - t };
  const stairX = -w / 2 + t + 0.75, wellX = -w / 2 + t + 1.55;
  const zStart = inner.z1 - 0.6, zEnd = inner.z0 + 1.6;
  const L1 = Fy + H1;
  if (twoStorey) {
    // the flight up the -x wall, a landing at its head against the back wall
    const loftT = 0.3;
    const n = Math.ceil(H1 / RISE - 1e-6), run = (zStart - zEnd) / n;
    m.stair(stairX, zStart, Math.PI, 1.5, Fy, L1, { run, base: Fy, c: 'wood', nose: 'dark', nosing: run > 0.35 });
    // landing stops under the loft boards (same trick as the ground plinth) so the well seam does not z-fight
    m.landing(stairX, (inner.z0 + zEnd) / 2, 1.5, zEnd - inner.z0, L1 - loftT, { base: L1 - loftT - 0.3, c: 'wood' });
    m.floor(stairX, L1, (inner.z0 + zEnd) / 2, 1.5, zEnd - inner.z0, 'wood', { t: loftT });
    m.floor((wellX + inner.x1) / 2, L1, 0, inner.x1 - wellX, inner.z1 - inner.z0, 'wood', { t: loftT });
    // ceiling hangs clear under the loft slab (was coplanar with the floor's underside)
    m.ceiling((wellX + inner.x1) / 2, L1 - loftT - 0.05, 0, inner.x1 - wellX, inner.z1 - inner.z0, { axis: 'x', every: 1.6, solid: false });
    m.rail(wellX, zEnd + 0.05, wellX, inner.z1 - 0.05, L1, { c: 'timber' });
    if (!loftInRoof) m.ceiling(0, Fy + H - 0.25, 0, inner.x1 - inner.x0, inner.z1 - inner.z0, { axis: 'x', every: 1.8 });
    else attic(m, ctx, inner);
  } else {
    m.ceiling(0, Fy + H - 0.25, 0, inner.x1 - inner.x0, inner.z1 - inner.z0, { axis: 'x', every: 1.6 });
  }
  m.shelter(0, 0, w, d, Fy - 0.2, Fy + H + (loftInRoof ? 6 : 0.6));

  // ---- the roof, and what each country puts on it
  roofFor(m, ctx);

  // ---- the rooms
  furnish(world, m, ctx, { inner, stairX, wellX, zEnd, L1 });

  // ---- records: the interior for tests and weather, the inn's rest point
  world.interiors ||= [];
  const pos = (x, y, z) => m.point(x, y, z);
  world.interiors.push({ type, name: s.name || type, vernacular: V, x: s.x, z: s.z, w, d, rot: yaw, wall: t, stairX,
    floor: m.y + Fy, entrance: pos(0, Fy, d / 2 + 1), center: pos(0, Fy, 1), loft: twoStorey ? m.y + L1 : null });
  if (inn) {
    // where a guest of the inn wakes: the inn's keeper sets it (Game.rest); [E] does nothing here
    const id = s.restId || `inn_${s.x}_${s.z}`;
    const at = pos(0, Fy + 0.2, 1);
    (world.restPoints ||= {})[id] = at;
    world.addInteract?.({ id, kind: 'rest_point', pos: at, radius: 0, name: s.name || 'The Salted Anchor', enabled: () => false });
  }
  exclusions?.push({ x: s.x, z: s.z, r: Math.max(w, d) * 0.8 + 2 });
  const g = m.build();
  if (hut) g.name = 'hut';
  add(g);
  return { group: g, floor: m.y + Fy, top: m.y + Fy + H };
}

// A loft in the roof space (longhouses and slag houses) is ceiled under the rafters: boards up
// each slope from the knee walls to a collar ceiling, and across a gable end, so the room is
// closed from inside although the roof is drawn to be seen from outside. The slopes are the
// ones roofFor lays: [rise, half-span, flat ridge half-length] across each axis, or null where
// the end is a gable.
const COLLAR = 1.4; // the collar ceiling over the knee walls: 2.5 m clear over the loft floor
function attic(m, c, inner) {
  const { V, w, d, Fy, H } = c, knee = Fy + H;
  let sx = null, sz = null;
  if (V === 'redwake') sx = [w * 0.78, w / 2 + 0.6, 0];
  else {
    const W = w + 1.2, D = d + 1.2, rise = Math.min(w, d) * 0.34;
    if (W >= D) { sz = [rise, D / 2, 0]; sx = [rise, W / 2, (W - D) / 2]; } else { sx = [rise, W / 2, 0]; sz = [rise, D / 2, (D - W) / 2]; }
  }
  // height of the roof's underside over the knee at u along a sloping axis, and where it falls to h
  const under = ([rise, half, flat], u) => 0.25 + rise * (1 - Math.max(0, u - flat) / (half - flat)) - 0.15;
  const reach = ([rise, half, flat], h) => flat + (half - flat) * (1 - (h + 0.15 - 0.25) / rise);
  const xw = inner.x1, zw = inner.z1;
  const xc = sx ? Math.min(xw, reach(sx, COLLAR)) : xw, zc = sz ? Math.min(zw, reach(sz, COLLAR)) : zw;
  m.ceiling(0, knee + COLLAR, 0, xc * 2, zc * 2, { axis: 'x', every: 1.6, c: 'ceiling', solid: false });
  // what a body meets: the collar across the whole room, carried on linings up from the walls
  m.solid(0, knee + COLLAR, 0, xw * 2, 0.25, zw * 2, { climbable: false });
  for (const e of [-1, 1]) {
    m.solid(e * (xw - 0.05), knee, 0, 0.1, COLLAR, zw * 2, { walkable: false });
    m.solid(0, knee, e * (zw - 0.05), xw * 2, COLLAR, 0.1, { walkable: false });
  }
  for (const e of [-1, 1]) {
    // the ends and sides: a board from the knee up to where the roof's underside starts,
    // then a board up the slope to the collar ceiling
    for (const [axis, slope, uw, uc, span] of [['x', sx, xw, xc, zw * 2], ['z', sz, zw, zc, xw * 2]]) {
      const hw = slope ? Math.min(COLLAR, under(slope, uw)) : COLLAR;
      const px = axis === 'x' ? e * (uw - 0.03) : 0, pz = axis === 'z' ? e * (uw - 0.03) : 0;
      m.trim(px, knee, pz, axis === 'x' ? 0.06 : span, hw, axis === 'x' ? span : 0.06, 'ceiling');
      if (!slope || hw >= COLLAR - 0.01) continue;
      const du = uc - uw, dy = COLLAR - hw, L = Math.hypot(du, dy), mu = e * (uw + uc) / 2, my = knee + (hw + COLLAR) / 2;
      if (axis === 'x') m.trim(mu, my, 0, L, 0.06, span, 'ceiling', { rz: Math.atan2(dy, e * du) });
      else m.trim(0, my, mu, span, 0.06, L, 'ceiling', { rx: Math.atan2(-dy, e * du) });
    }
  }
}

// One set of openings for a wall that rises through both storeys (logs, brick, wattle).
function mergeStoreys(ground, upper, H1) {
  if (!upper) return ground;
  const out = {};
  for (const k of ['n', 's', 'e', 'w']) out[k] = [...(ground[k] || []), ...(upper[k] || []).map(o => ({ ...o, y: o.y + H1 }))];
  return out;
}

// ---------------------------------------------------------------- roofs
function roofFor(m, c) {
  const { V, w, d, Fy, H, twoStorey, inn, smithy, s } = c;
  const top = Fy + H;
  const chimney = (x, z, h = 3, cc = 'stone') => {
    m.block(x, top - 0.6, z, 1.0, h, 1.0, cc, { walkable: false });
    m.trim(x, top - 0.6 + h, z, 1.25, 0.25, 1.25, 'edge');
    if (V === 'frost' || smithy || inn || V === 'cinder') m.world.addEmitter?.({ kind: 'smoke', pos: m.point(x, top - 0.4 + h, z), rate: 3 });
  };
  m.trim(0, top, 0, w + 0.3, 0.25, d + 0.3, V === 'enclave' || V === 'salt' || V === 'hush' ? 'edge' : 'timber');
  const base = top + 0.25;
  if (V === 'salt') {
    m.roof(0, base, 0, w + 0.2, d + 0.2, Math.min(w, d) * (inn ? 0.5 : 0.56), { flare: 0.75, overhang: 0.7, c: 'roof', c2: 'roof2' });
    if (c.flue) chimney(c.flue[0], c.flue[1], 2.6 + Math.min(w, d) * 0.45);
    if (twoStorey || inn) {
      // a dormer lantern on the front slope: the Compact keeps a lamp in every house
      const dz = d * 0.18;
      m.block(0, base + 0.2, dz, 1.4, 1.5, 1.2, 'plaster', { walkable: false });
      m.glow(0, base + 0.95, dz + 0.61, 0.8, 0.8, 0.04, 1.2);
      m.roof(0, base + 1.7, dz, 1.4, 1.2, 0.9, { kind: 'gable', overhang: 0.25, ry: Math.PI / 2 });
    }
  } else if (V === 'farm' || V === 'wood') {
    m.roof(0, base, 0, w, d, d * 0.62, { kind: 'gable', along: 'x', overhang: 0.55, c: 'roof' });
    if (c.flue) chimney(c.flue[0], c.flue[1], d * 0.62 + 0.8);
  } else if (V === 'enclave') {
    m.trim(0, top, 0, w + 0.5, 0.35, d + 0.5, 'stone');
    m.roof(0, base + 0.1, 0, w + 0.2, d + 0.2, Math.min(w, d) * 0.36, { overhang: 0.45, c: 'roof' });
    if (c.flue) chimney(c.flue[0], c.flue[1], 1.8 + Math.min(w, d) * 0.36, 'brick');
    chimney(-(w / 2 - 0.9), -d * 0.1, 1.6 + Math.min(w, d) * 0.36, 'brick');
  } else if (V === 'frost') {
    // a steep gable, ridge front to back so the snow slides off the sides, not the door
    m.roof(0, base, 0, w, d, w * 0.85, { kind: 'gable', along: 'z', overhang: 0.7, c: 'roof', snow: true });
    if (c.flue) chimney(c.flue[0], c.flue[1], w * 0.85 + 1.0);
    // the porch: a short roof on two posts over the door, logs stacked under it
    for (const sx of [-1, 1]) {
      const g = Math.min(m.ground(sx * 1.4, d / 2 + 1.4), Fy) - 0.4;
      m.block(sx * 1.4, g, d / 2 + 1.4, 0.24, Fy + 2.6 - g, 0.24, 'timber', { walkable: false });
    }
    m.roof(0, Fy + 2.6, d / 2 + 0.9, 3.4, 1.4, 0.9, { kind: 'gable', along: 'x', overhang: 0.2, c: 'roof', snow: true });
    for (let i = 0; i < 4; i++) m.k.prism(w / 2 + 0.55, Fy + 0.15 + i * 0.3, -d / 4 + (i % 2) * 0.1, 0.14, d / 2, 'timber', { sides: 6, rx: Math.PI / 2 });
  } else if (V === 'root') {
    m.roof(0, base, 0, w + 0.6, d + 0.6, Math.min(w, d) * 0.62, { overhang: 1.1, c: 'roof', c2: 'roof2', flare: 0.4 });
    m.trim(0, base + Math.min(w, d) * 0.62 + 0.2, 0, 0.5, 0.8, 0.5, 'moss');
    for (const sx of [-1, 1]) m.hanging(sx * (w / 2 + 0.5), base - 0.3, d / 2 + 0.6, 0.6, { light: sx > 0, intensity: 0.8 });
  } else if (V === 'cinder') {
    // the Thornwood longhouse's steep gable, turfed over against the ash wind, on timber
    // stained red as the Redwake stain theirs, with a slag cap along the ridge
    const rise = w * 0.62;
    m.roof(0, base, 0, w + 0.2, d + 0.2, rise, { kind: 'gable', along: 'z', overhang: 0.5, c: 'turf', ridgeC: 'slag', solid: !c.loftInRoof });
    if (c.flue) chimney(c.flue[0], c.flue[1], rise * 0.5 + 0.8, 'stone2');
    // a slab porch on timber posts over the door, an ember lamp under it
    for (const sx of [-1, 1]) m.block(sx * (c.doorW / 2 + 0.9), Fy, d / 2 + 1.3, 0.26, 2.7, 0.26, 'timber', { walkable: false });
    m.block(0, Fy + 2.7, d / 2 + 0.75, c.doorW + 2.6, 0.22, 1.6, 'slag', { walkable: false });
    m.trim(0, Fy + c.doorH, d / 2 + 0.05, c.doorW + 0.8, 0.4, 0.2, 'edge');
    m.lantern(c.doorW / 2 + 0.6, Fy + 2.0, d / 2 + 0.3, { post: 0, glow: 'ember', intensity: 0.8 });
  } else if (V === 'reed') {
    m.roof(0, base, 0, w, d + 0.4, w * 0.75, { kind: 'gable', along: 'z', overhang: 0.9, c: 'thatch' });
    m.trim(0, base + w * 0.75 - 0.1, 0, 0.4, 0.4, d + 2.2, 'dark');
    // the veranda's lean-to over the deck in front
    for (const sx of [-1, 1]) m.block(sx * (w / 2 - 0.3), Fy, d / 2 + 1.4, 0.2, 2.5, 0.2, 'timber', { walkable: false });
    m.roof(0, Fy + 2.5, d / 2 + 0.9, w, 1.6, 0.6, { kind: 'gable', along: 'x', overhang: 0.2, c: 'thatch' });
  } else if (V === 'redwake') {
    // the long steep roof runs front to back; carved horns cross at both gable peaks
    const rise = w * 0.78;
    m.roof(0, base, 0, w, d, rise, { kind: 'gable', along: 'z', overhang: 0.6, c: 'roof', solid: !c.loftInRoof });
    for (const e of [-1, 1]) {
      const z = e * (d / 2 + 0.65);
      for (const sx of [-1, 1]) m.trim(sx * 0.35, base + rise - 0.3, z, 0.16, 1.4, 0.16, 'timber', { rz: sx * 0.45 });
      m.trim(0, base + rise * 0.35, z, w * 0.55, 0.16, 0.1, 'accent');
    }
    if (c.flue) chimney(c.flue[0], c.flue[1], rise * 0.5 + 0.8, 'stone');
  } else if (V === 'hush') {
    // two tiers of grey eaves, a bell at the lower tier's corner
    m.roof(0, base, 0, w + 0.6, d + 0.6, 0.9, { flare: 0.9, overhang: 0.9, c: 'roof2' });
    m.block(0, base + 0.6, 0, w * 0.55, 1.6, d * 0.55, 'plaster', { walkable: false });
    m.roof(0, base + 2.2, 0, w * 0.55, d * 0.55, Math.min(w, d) * 0.4, { flare: 0.6, overhang: 0.7, c: 'roof' });
    // a sounding bell hung from the eave's corner on a short chain
    m.trim(w / 2 + 0.55, base - 0.95, d / 2 + 0.55, 0.05, 0.7, 0.05, 'metal', { layer: 'metal' });
    m.k.prism(w / 2 + 0.55, base - 1.55, d / 2 + 0.55, 0.32, 0.55, 'bell', { sides: 10, top: 0.45, layer: 'metal' });
    m.lantern(-w / 2 - 0.2, Fy + 2.1, d / 2 + 0.25, { post: 0, intensity: 0.7 });
  }
  if (smithy && c.flue && V !== 'salt' && V !== 'enclave' && V !== 'redwake' && V !== 'farm' && V !== 'wood' && V !== 'cinder') chimney(c.flue[0], c.flue[1], 3.6, 'stone');
}

// ---------------------------------------------------------------- rooms
function furnish(world, m, c, k) {
  const { V, s, w, d, Fy, inn, smithy, barracks, twoStorey, H1, H } = c;
  const { inner, wellX, L1 } = k;
  const hx = inner.x1, bz = inner.z0;
  if (inn) {
    // the common room: the counter across the back with the host behind it, the hearth
    // on the right-hand wall, tables in the front room clear of the door and the stair
    const cw = Math.min(hx - wellX - 1.2, w * 0.5);
    F.counter(m, wellX + 0.6 + cw / 2, Fy, bz + 1.75, cw, { goodsC: 'glow' });
    // the host's shelves stand to one side of the spot where the host stands
    F.shelves(m, Math.min(hx - 1.2, 2.0), Fy, bz + 0.25, 1.8, 2.2, { goods: ['glow', 'metal', 'cushion', 'edge'] });
    F.hearth(m, c.hearthAt[0], Fy, c.hearthAt[1], { ry: c.hearthAt[2], w: 1.6, h: 2.5 });
    const tx = Math.min(hx - 1.6, w * 0.26);
    F.table(m, tx, Fy, d * 0.24, 1.6, 1.0, { cloth: 'cloth' });
    F.bench(m, tx, Fy, d * 0.24 - 0.85, 1.4); F.bench(m, tx, Fy, d * 0.24 + 0.85, 1.4, { ry: Math.PI });
    if (w >= 12) {
      F.table(m, -1.9, Fy, d * 0.24, 1.0, 1.0); F.chair(m, -1.9, Fy, d * 0.24 - 0.75); F.chair(m, -1.9, Fy, d * 0.24 + 0.75, { ry: Math.PI });
    }
    F.barrel(m, hx - 0.6, Fy, bz + 0.6); F.barrel(m, hx - 1.45, Fy, bz + 0.55);
    F.rug(m, tx, Fy, d * 0.24, 2.6, 2.2, { c: 'cushion', c2: 'cloth' });
    m.hanging(1.2, L1 - 0.3, -0.4, 0.8, { light: false });
    m.light(0.5, Fy + 2.4, 0, { intensity: 4.5, distance: 13, priority: 1.9 });
    // the rooms upstairs: beds along the right and back walls, a chest at each
    for (const [x, z, ry] of [[hx - 1.15, -d * 0.22, -Math.PI / 2], [hx - 1.15, d * 0.2, -Math.PI / 2], [(wellX + hx) / 2 - 0.6, bz + 1.15, 0]]) {
      F.bed(m, x, L1, z, { ry, w: 1.2, len: 2.1 });
    }
    F.crate(m, hx - 0.5, L1, 0, 0.6, { c: 'wood' });
    m.hanging((wellX + hx) / 2, Fy + H - 0.25, 0.4, 0.6, { light: false });
    m.light((wellX + hx) / 2, L1 + 2, 0, { intensity: 3, distance: 9, priority: 1.6 });
    // a sign over the door
    m.trim(0, Fy + c.doorH + 0.5, d / 2 + 0.25, 2.2, 0.8, 0.1, 'wood');
    m.trim(0, Fy + c.doorH + 0.75, d / 2 + 0.31, 1.4, 0.3, 0.04, 'glow');
  } else if (smithy) {
    // the forge and its hood on the back wall, the anvil and quench before it, racks of work
    F.forge(m, c.hearthAt[0], Fy, c.hearthAt[1], { ry: 0, flue: H - 3 + 0.4 });
    F.rack(m, hx - 0.3, Fy, 0.4, Math.min(3, d - 2.5), { ry: -Math.PI / 2 });
    F.table(m, -hx + 1.0, Fy, 0.6, 1.0, 2.4, { h: 0.9 });
    for (let i = 0; i < 3; i++) m.trim(-hx + 1.0, Fy + 0.9, -0.2 + i * 0.6, 0.5, 0.06, 0.12, 'metal', { layer: 'metal' });
    for (let i = 0; i < 5; i++) m.k.rock(hx - 1.0 - (i % 3) * 0.4, Fy + 0.12, bz + 0.6 + Math.floor(i / 3) * 0.4, 0.5, 0.3, 0.45, 'slag');
    m.light(0, Fy + 2.6, 0.5, { intensity: 3, distance: 11, priority: 1.6 });
  } else if (barracks) {
    // bunks down both long walls, an arms rack at the end, the mess table toward the back
    // (kept off the doorway so it does not read as floating over the street when the door is open)
    const rows = Math.max(1, Math.floor((d - 3) / 2.4));
    for (let i = 0; i < rows; i++) {
      const z = bz + 1.4 + i * 2.4;
      if (z > d / 2 - 2) continue;
      F.bunk(m, hx - 1.15, Fy, z, { ry: -Math.PI / 2 });
    }
    F.rack(m, (wellX + hx) / 2, Fy, bz + 0.3, Math.min(3, hx - wellX - 1), {});
    const tx = (wellX + hx) / 2 - 0.4, tz = -d * 0.18;
    F.table(m, tx, Fy, tz, 2.4, 1.2, { cloth: 'cloth' });
    for (const dx of [-0.7, 0, 0.7]) m.trim(tx + dx, Fy + 0.82, tz, 0.16, 0.2, 0.16, 'metal', { layer: 'metal' });
    F.bench(m, tx - 0.95, Fy, tz, 2.2, { ry: Math.PI / 2 });
    F.bench(m, tx + 0.95, Fy, tz, 2.2, { ry: -Math.PI / 2 });
    if (twoStorey) for (let i = 0; i < rows; i++) F.bunk(m, hx - 1.15, L1, bz + 1.4 + i * 2.4, { ry: -Math.PI / 2 });
    m.light(0.6, Fy + 2.4, 0, { intensity: 4, distance: 12, priority: 1.8 });
    if (twoStorey) m.light((wellX + hx) / 2, L1 + 2, 0, { intensity: 2.5, distance: 9, priority: 1.5 });
  } else if (c.hall) {
    // a civic hall: what it keeps decides how it is furnished
    const n = (s.name || '').toLowerCase();
    if (n.includes('registry') || n.includes('office')) {
      F.counter(m, 0, Fy, bz + 2.2, Math.min(w - 4, 8), { goodsC: 'plaster' });
      for (let i = 0; i < 3; i++) F.shelves(m, -w / 2 + 2.4 + i * 2.6, Fy, bz + 0.25, 2.2, 2.8, { goods: ['plaster', 'edge', 'cushion'] });
      for (let i = 0; i < Math.floor((d - 5) / 2); i++) for (const sx of [-1, 1]) F.bench(m, sx * w * 0.22, Fy, bz + 4.4 + i * 2, w * 0.3, { back: true, ry: Math.PI });
    } else {
      for (let i = 0; i < Math.floor((w - 3) / 2.4); i++) F.shelves(m, -w / 2 + 2 + i * 2.4, Fy, -0.5, 2.0, 3.2, { ry: Math.PI / 2, goods: ['plaster', 'edge', 'cushion', 'cloth'] });
      F.table(m, 0, Fy, d / 2 - 2.6, 2.4, 1.0);
    }
    m.hanging(0, Fy + H - 0.25, 0, 1.4, { light: false });
    m.light(0, Fy + 3, 0, { intensity: 4.5, distance: 14, priority: 1.8 });
  } else if (c.store) {
    // a store: what it keeps decides its layout; every store keeps its tally desk by the door,
    // its aisle from the door to the back, and its hoist over the door
    const n = (s.name || '').toLowerCase(), fz = inner.z1, side = (hx - 0.6);
    const stacks = (sx, z0, z1, every = 1.1) => {
      for (let i = 0, z = z0; z <= z1; i++, z += every) {
        if (i % 3 === 2) { F.barrel(m, sx * side, Fy, z); continue; }
        F.crate(m, sx * side, Fy, z, 0.95);
        F.crate(m, sx * side, Fy + 0.95, z, 0.75, { ry: 0.2 * sx });
        if (i % 3 === 0) F.crate(m, sx * side, Fy + 1.7, z, 0.55, { ry: -0.15 });
      }
    };
    const sacks = (x, z) => {
      m.block(x, Fy, z, 1.6, 0.14, 1.2, 'wood');
      for (let l = 0; l < 2; l++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) m.trim(x + (a - 0.5) * 0.74, Fy + 0.14 + l * 0.32, z + (b - 0.5) * 0.52, 0.7, 0.32, 0.48, l ? 'sand2' : 'sand', { ry: (a + b + l) * 0.08 });
      m.solid(x, Fy, z, 1.6, 0.8, 1.2, { walkable: false });
    };
    if (n.includes('cooper')) {
      // finished casks down one wall, the cooper's bench with staves and hoops on the other,
      // a fire basket to bend the staves and the stave rack against the back
      for (const dx of [0.55, 1.4]) for (let z = bz + 0.7; z < fz - 1.6; z += 0.85) F.barrel(m, -(hx - dx), Fy, z);
      F.table(m, hx - 0.75, Fy, bz + 2.2, 0.9, 2.6, { h: 0.85 });
      for (let i = 0; i < 5; i++) m.trim(hx - 0.8, Fy + 0.85, bz + 1.3 + i * 0.4, 0.1, 0.04, 0.9, 'wood', { ry: 1.4 });
      for (let i = 0; i < 2; i++) m.k.prism(hx - 0.7, Fy + 0.85 + i * 0.05, bz + 3.0, 0.4, 0.04, 'metal', { sides: 10, layer: 'metal' });
      F.chair(m, hx - 1.6, Fy, bz + 2.2, { ry: Math.PI / 2 });
      F.brazier(m, hx * 0.35, Fy, bz + 1.5, { h: 0.5, intensity: 2, distance: 8 });
      for (let i = 0; i < 9; i++) m.trim(-hx * 0.3 + i * 0.22, Fy, bz + 0.18, 0.12, 1.8, 0.05, 'wood', { rx: -0.12 });
    } else if (n.includes('ordnance')) {
      // arms racks down both walls, crates of shot either side of the aisle, powder at the back
      for (const sx of [-1, 1]) for (let z = bz + 1.6; z < fz - 2.4; z += 3.0) F.rack(m, sx * (hx - 0.3), Fy, z, 2.4, { ry: -sx * Math.PI / 2 });
      for (const sx of [-1, 1]) for (let z = bz + 1.4; z < fz - 2.8; z += 1.2) { F.crate(m, sx * 1.9, Fy, z, 0.9, { c: 'wood' }); F.crate(m, sx * 1.9, Fy + 0.9, z, 0.7, { c: 'wood' }); }
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { F.barrel(m, sx * (hx - 0.6 - i * 0.85), Fy, bz + 0.6); m.trim(sx * (hx - 0.6 - i * 0.85), Fy + 0.42, bz + 0.6, 0.8, 0.08, 0.8, 'cushion'); }
    } else if (n.includes('sail')) {
      // the cutting table across the back with a sail spread on it, benches, bolts of canvas on
      // shelves, coils of rope, and a sail hung from the beams to dry
      const tw = Math.min(2 * hx - 2.6, 7);
      F.table(m, 0, Fy, bz + 1.8, tw, 1.6, { h: 0.85 });
      m.trim(0, Fy + 0.85, bz + 1.8, tw - 0.3, 0.015, 1.5, 'plaster', { grad: 0 });
      for (const dz of [-1.05, 1.05]) F.bench(m, 0, Fy, bz + 1.8 + dz, tw - 1.0);
      F.shelves(m, -(hx - 0.25), Fy, 0.4, 2.4, 2.2, { ry: Math.PI / 2, goods: ['plaster', 'cloth', 'plaster', 'edge'] });
      for (const [x, z] of [[hx - 0.7, fz - 2.2], [hx - 0.7, fz - 3.2]]) for (let l = 0; l < 3; l++) m.k.prism(x, Fy + l * 0.22, z, 0.42 - l * 0.04, 0.22, '#a08a60', { sides: 10 });
      m.trim(hx - 0.6, Fy + 1.4, 0.2, 0.04, c.H1 - 1.6, 3.2, 'plaster', { rz: 0.06 });
    } else {
      // goods stacked two and three high down both walls, sacks on pallets either side of the
      // aisle, the back wall shelved
      stacks(-1, bz + 0.8, fz - 2.6); stacks(1, bz + 0.8, fz - 2.6);
      for (const sx of [-1, 1]) sacks(sx * Math.max(1.6, hx * 0.42), bz + 2.0);
      const nb = Math.max(1, Math.floor((2 * hx - 1.2) / 2.5));
      for (let i = 0; i < nb; i++) F.shelves(m, -hx + 0.6 + (2 * hx - 1.2) * (i + 0.5) / nb, Fy, bz + 0.25, 2.2, 2.6, { goods: ['sand', 'wood', 'cloth', 'edge'] });
    }
    // the tally desk inside the door, the clerk's back to the wall
    F.table(m, hx - 1.05, Fy, fz - 1.4, 0.8, 1.3);
    m.trim(hx - 1.05, Fy + 0.82, fz - 1.4, 0.45, 0.03, 0.32, 'plaster', { ry: 0.2 });
    F.chair(m, hx - 0.4, Fy, fz - 1.4, { ry: -Math.PI / 2 });
    m.trim(0, Fy + c.doorH + 0.7, d / 2 + 0.9, 0.3, 0.3, 2.2, 'timber');
    m.trim(0, Fy + c.doorH - 0.3, d / 2 + 1.8, 0.05, 1.0, 0.05, 'metal', { layer: 'metal' });
    m.light(0, Fy + 3, 0, { intensity: 3.5, distance: 14, priority: 1.6 });
  } else if (c.hut) {
    // one room: the bed along one wall, a table and stool, a shelf (or the arms of a guard
    // post) on the back wall, a cask in the corner
    F.bed(m, inner.x0 + 0.75, Fy, -0.4, { ry: Math.PI / 2, w: 1.0, len: 1.9 });
    F.barrel(m, hx - 0.5, Fy, bz + 0.5);
    F.table(m, hx - 0.5, Fy, 0.55, 0.7, 0.9, { h: 0.75 });
    F.chair(m, hx - 1.15, Fy, 0.55, { ry: Math.PI / 2 });
    if (V === 'frost') F.rack(m, -0.2, Fy, bz + 0.25, 1.2);
    else F.shelves(m, -0.2, Fy, bz + 0.25, 1.1, 1.5, { goods: ['wood', 'cloth', 'edge'] });
    m.light(0, Fy + 2.0, 0, { intensity: 1.8, distance: 6, priority: 1.4 });
  } else {
    // a home: the hearth on the back wall, a bed, a table, a chest and shelves
    F.hearth(m, c.hearthAt[0], Fy, c.hearthAt[1], { ry: 0, w: 1.4, h: Math.min(2.4, H1 - 0.8), intensity: 1.4 });
    F.table(m, hx - 1.1, Fy, d * 0.12, 1.0, 1.4); F.chair(m, hx - 1.95, Fy, d * 0.12, { ry: Math.PI / 2 });
    F.shelves(m, hx - 0.25, Fy, -d * 0.22, Math.min(1.8, d * 0.3), 1.9, { ry: -Math.PI / 2, goods: V === 'cinder' ? ['slag', 'metal', 'ember'] : ['cushion', 'edge', 'cloth', 'wood'] });
    if (twoStorey) {
      F.bed(m, hx - 1.15, L1, -d * 0.2, { ry: -Math.PI / 2 });
      F.crate(m, hx - 0.5, L1, d * 0.12, 0.6, { c: 'wood' });
      m.light((wellX + hx) / 2, L1 + 1.9, 0, { intensity: 2.2, distance: 8, priority: 1.4 });
    } else {
      F.bed(m, inner.x0 + 1.15, Fy, -d * 0.18, { ry: Math.PI / 2 });
    }
    F.rug(m, 0, Fy, -0.2, Math.min(2.4, w * 0.3), Math.min(1.8, d * 0.25), { c: 'cushion', c2: 'cloth' });
    m.light(0, Fy + 2.2, -0.3, { intensity: 2.8, distance: 9, priority: 1.6 });
  }
}
