// Furniture and fittings, laid by a Mason (world/mason.js) in the building's own palette:
// what makes a room read as a hall, an inn, a smithy or a barracks. Every piece stands on
// the floor it is given (y), faces local +z when ry = 0, and is collided only where a body
// would meet it (tables, counters, beds, hearths), never as an invisible wall.

// Small offsets from (x, z) along a heading.
const off = (x, z, ry, u, v) => [x + u * Math.cos(ry) + v * Math.sin(ry), z - u * Math.sin(ry) + v * Math.cos(ry)];

export function table(m, x, y, z, w = 2, d = 1, o = {}) {
  const ry = o.ry || 0, h = o.h ?? 0.82;
  m.block(x, y + h - 0.08, z, w, 0.08, d, o.c || 'wood', { ry, climbable: false });
  m.solid(x, y, z, w - 0.2, h - 0.08, d - 0.2, { ry, walkable: false });
  // legs are drawn as blocks (not trim) so they stay readable against the floor and do not
  // vanish into coplanar footing/floor fights when the camera looks in from the street
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [lx, lz] = off(x, z, ry, sx * (w / 2 - 0.14), sz * (d / 2 - 0.14));
    m.block(lx, y, lz, 0.14, h - 0.08, 0.14, o.leg || 'dark', { ry, climbable: false, solid: false });
  }
  if (o.cloth) m.trim(x, y + h, z, w * 0.78, 0.015, d * 0.78, o.cloth, { ry, grad: 0 });
  return m;
}

export function bench(m, x, y, z, len = 2, o = {}) {
  const ry = o.ry || 0;
  m.trim(x, y + 0.4, z, len, 0.07, 0.38, o.c || 'wood', { ry });
  m.solid(x, y, z, len, 0.47, 0.38, { ry, climbable: false });
  for (const e of [-1, 1]) {
    const [lx, lz] = off(x, z, ry, e * (len / 2 - 0.15), 0);
    m.trim(lx, y, lz, 0.08, 0.4, 0.32, 'dark', { ry });
  }
  if (o.back) {
    const [bx, bz] = off(x, z, ry, 0, -0.17);
    m.trim(bx, y + 0.47, bz, len, 0.5, 0.06, o.c || 'wood', { ry });
  }
  return m;
}

export function chair(m, x, y, z, o = {}) {
  const ry = o.ry || 0;
  m.trim(x, y + 0.42, z, 0.48, 0.06, 0.46, o.c || 'wood', { ry });
  const [bx, bz] = off(x, z, ry, 0, -0.21);
  m.trim(bx, y + 0.48, bz, 0.48, 0.55, 0.05, o.c || 'wood', { ry });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [lx, lz] = off(x, z, ry, sx * 0.2, sz * 0.19);
    m.trim(lx, y, lz, 0.05, 0.42, 0.05, 'dark', { ry });
  }
  return m;
}

// A seat of office: stepped dais, a high-backed chair and the faction's device over it.
export function throne(m, x, y, z, o = {}) {
  const ry = o.ry || 0, steps = o.steps ?? 3, w = o.w ?? 5;
  for (let i = 0; i < steps; i++) {
    const [sx, sz] = off(x, z, ry, 0, -i * 0.45);
    m.block(sx, y, sz, w - i * 0.8, 0.3 * (i + 1), 3 - i * 0.45, i % 2 ? 'stone2' : 'stone', { ry, climbable: false });
  }
  const top = y + 0.3 * steps;
  const [cx, cz] = off(x, z, ry, 0, -0.4);
  m.block(cx, top, cz, 1.3, 0.55, 1.0, o.c || 'stone', { ry, walkable: false });
  m.trim(cx, top + 0.55, cz, 1.2, 0.1, 0.9, o.cushion || 'cushion', { ry });
  for (const sx of [-1, 1]) {
    const [ax, az] = off(cx, cz, ry, sx * 0.62, 0.05);
    m.trim(ax, top + 0.55, az, 0.16, 0.45, 0.9, o.c || 'stone', { ry });
  }
  const [bx, bz] = off(cx, cz, ry, 0, -0.5);
  m.block(bx, top, bz, 1.3, o.back ?? 2.8, 0.25, o.c || 'stone', { ry, walkable: false });
  m.trim(bx, top + (o.back ?? 2.8), bz, 1.5, 0.18, 0.35, 'edge', { ry });
  if (o.device) o.device(m, bx, top + (o.back ?? 2.8) + 0.18, bz, ry);
  return top;
}

// A brazier on a stone foot: the warm light of a hall.
export function brazier(m, x, y, z, o = {}) {
  m.k.prism(x, y, z, 0.42, 0.25, 'stone2', { sides: 8 });
  m.k.prism(x, y + 0.25, z, 0.16, o.h ?? 0.75, 'metal', { sides: 6, layer: 'metal' });
  m.k.prism(x, y + 0.25 + (o.h ?? 0.75), z, 0.42, 0.25, 'metal', { sides: 8, top: 1.35, layer: 'metal' });
  m.glow(x, y + 0.5 + (o.h ?? 0.75) + 0.08, z, 0.6, 0.18, 0.6, 1.5, o.glow || 'glow');
  m.pillar(x, y - 1.2, z, 0.45, 1.2 + 1.25 + (o.h ?? 0.75) - 0.75);
  if (o.light !== false) m.light(x, y + 1.6, z, { color: o.color || '#ffb567', intensity: o.intensity ?? 4, distance: o.distance ?? 12, flicker: true, priority: o.priority ?? 1.8 });
  return m;
}

// A fireplace against a wall (its back to local -z): hearth stone, fire, mantel, breast.
export function hearth(m, x, y, z, o = {}) {
  const ry = o.ry || 0, w = o.w ?? 2.2, h = o.h ?? 3;
  const [bx, bz] = off(x, z, ry, 0, -0.35);
  m.block(bx, y, bz, w + 0.8, h, 0.7, o.c || 'stone', { ry, walkable: false });
  for (const sx of [-1, 1]) {
    const [jx, jz] = off(x, z, ry, sx * (w / 2 + 0.1), 0.2);
    m.block(jx, y, jz, 0.45, 1.3, 0.55, o.c || 'stone', { ry, walkable: false });
  }
  const [mx, mz] = off(x, z, ry, 0, 0.22);
  m.trim(mx, y + 1.3, mz, w + 0.9, 0.22, 0.75, 'edge', { ry });
  const [fx, fz] = off(x, z, ry, 0, 0.12);
  m.trim(fx, y, fz, w - 0.2, 0.08, 0.6, 'stone2', { ry });
  m.glow(fx, y + 0.3, fz, w * 0.5, 0.4, 0.3, 0.95, o.glow || 'glow');
  for (let i = 0; i < 3; i++) {
    const [lx, lz] = off(fx, fz, ry, (i - 1) * 0.35, 0.05);
    m.trim(lx, y + 0.08, lz, 0.14, 0.14, 0.55, 'dark', { ry: ry + (i - 1) * 0.5 });
  }
  // The light stands out in the room, not inside the firebox: a point light a hand's breadth
  // from the jambs and mantel burns them (and the floor before them) to white.
  const [qx, qz] = off(x, z, ry, 0, 0.75);
  if (o.light !== false) m.light(qx, y + 1.1, qz, { color: '#ffb567', intensity: o.intensity ?? 1.8, distance: o.distance ?? 11, flicker: true, priority: o.priority ?? 1.8, night: 0.9 });
  return m;
}

export function bed(m, x, y, z, o = {}) {
  const ry = o.ry || 0, w = o.w ?? 1.3, len = o.len ?? 2.2;
  m.block(x, y, z, w, 0.45, len, o.frame || 'wood', { ry, climbable: false });
  m.trim(x, y + 0.45, z, w - 0.1, 0.16, len - 0.1, o.sheet || 'plaster', { ry });
  const [px, pz] = off(x, z, ry, 0, -len / 2 + 0.35);
  m.trim(px, y + 0.6, pz, w - 0.3, 0.14, 0.45, 'edge', { ry });
  const [cx, cz] = off(x, z, ry, 0, 0.25);
  m.trim(cx, y + 0.6, cz, w - 0.05, 0.06, len * 0.6, o.blanket || 'cushion', { ry });
  const [hx, hz] = off(x, z, ry, 0, -len / 2 + 0.05);
  m.trim(hx, y, hz, w + 0.1, 1.1, 0.1, o.frame || 'wood', { ry });
  return m;
}

export function bunk(m, x, y, z, o = {}) {
  const ry = o.ry || 0;
  bed(m, x, y, z, { ...o, ry });
  // the posts carry the upper berth
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [lx, lz] = off(x, z, ry, sx * 0.62, sz * 1.05);
    m.block(lx, y, lz, 0.1, 2.2, 0.1, 'dark', { ry, walkable: false });
  }
  m.block(x, y + 1.25, z, 1.3, 0.12, 2.2, o.frame || 'wood', { ry, climbable: false });
  m.trim(x, y + 1.37, z, 1.2, 0.14, 2.1, o.sheet || 'plaster', { ry });
  const [cx, cz] = off(x, z, ry, 0, 0.25);
  m.trim(cx, y + 1.5, cz, 1.25, 0.05, 1.3, o.blanket || 'cushion', { ry });
  return m;
}

// Shelves against a wall (back to local -z), stocked with books, jars or bolts of cloth.
export function shelves(m, x, y, z, w = 2, h = 2.4, o = {}) {
  const ry = o.ry || 0, d = 0.45;
  const [bx, bz] = off(x, z, ry, 0, -d / 2 + 0.03);
  m.block(bx, y, bz, w, h, 0.06, o.c || 'wood', { ry, walkable: false });
  for (const e of [-1, 1]) {
    const [sx, sz] = off(x, z, ry, e * (w / 2 - 0.03), 0);
    m.trim(sx, y, sz, 0.06, h, d, o.c || 'wood', { ry });
  }
  m.solid(x, y, z, w, h, d, { ry, walkable: false });
  const rows = Math.max(2, Math.floor(h / 0.55));
  const goods = o.goods || ['cushion', 'cloth', 'edge', 'accent', 'timber'];
  for (let r = 0; r <= rows; r++) {
    const yy = y + 0.12 + r * (h - 0.2) / rows;
    m.trim(x, yy - 0.04, z, w - 0.08, 0.04, d - 0.04, o.c || 'wood', { ry });
    if (r === rows) continue;
    let u = -w / 2 + 0.12, i = 0;
    while (u < w / 2 - 0.2) {
      const bw = 0.06 + ((r * 7 + i * 3) % 5) * 0.025, bh = 0.24 + ((r + i * 5) % 4) * 0.05;
      const [gx, gz] = off(x, z, ry, u + bw / 2, 0);
      if ((r * 3 + i) % 9 !== 0) m.trim(gx, yy, gz, bw, bh, 0.26, goods[(r + i) % goods.length], { ry });
      u += bw + 0.015; i++;
    }
  }
  return m;
}

// Spears and blades on a timber rack (back to local -z).
export function rack(m, x, y, z, w = 2, o = {}) {
  const ry = o.ry || 0;
  for (const e of [-1, 1]) {
    const [px, pz] = off(x, z, ry, e * (w / 2), 0);
    m.trim(px, y, pz, 0.1, 2, 0.1, 'dark', { ry });
  }
  for (const yy of [0.4, 1.8]) m.trim(x, y + yy, z, w, 0.08, 0.12, 'wood', { ry });
  const n = Math.max(2, Math.round(w / 0.35));
  for (let i = 0; i < n; i++) {
    const [sx, sz] = off(x, z, ry, -w / 2 + 0.2 + i * (w - 0.4) / (n - 1), 0.08);
    const spear = i % 3 !== 1;
    m.trim(sx, y + 0.1, sz, 0.04, spear ? 2.2 : 1.2, 0.04, spear ? 'wood' : 'metal', { ry, layer: spear ? 'solid' : 'metal' });
    if (spear) m.k.pyramid(sx, y + 2.3, sz, 0.06, 0.25, 'metal', { sides: 4, layer: 'metal' });
  }
  m.solid(x, y, z, w, 2, 0.4, { ry, walkable: false });
  return m;
}

export function barrel(m, x, y, z, o = {}) {
  m.k.prism(x, y, z, 0.38, 0.9, o.c || 'wood', { sides: 8 });
  for (const yy of [0.15, 0.7]) m.k.prism(x, y + yy, z, 0.4, 0.06, 'metal', { sides: 8, layer: 'metal' });
  m.pillar(x, y, z, 0.38, 0.9);
  return m;
}
export function crate(m, x, y, z, s = 0.8, o = {}) {
  m.block(x, y, z, s, s, s, o.c || 'wood', { ry: o.ry || 0 });
  m.trim(x, y + s * 0.45, z, s + 0.02, 0.08, s + 0.02, 'dark', { ry: o.ry || 0 });
  return m;
}

// A counter (bar or shop) with its working side at local -z.
export function counter(m, x, y, z, w = 3, o = {}) {
  const ry = o.ry || 0;
  m.block(x, y, z, w, 1.0, 0.7, o.c || 'wood', { ry, walkable: false });
  m.trim(x, y + 1.0, z, w + 0.12, 0.08, 0.82, o.top || 'edge', { ry });
  m.trim(x, y + 0.08, z, w - 0.1, 0.12, 0.74, 'dark', { ry });
  if (o.goods !== false) {
    for (let i = 0; i < Math.floor(w / 0.6); i++) {
      const [gx, gz] = off(x, z, ry, -w / 2 + 0.35 + i * 0.6, 0);
      if (i % 3 === 0) m.k.prism(gx, y + 1.08, gz, 0.09, 0.28, 'metal', { sides: 6, layer: 'metal' });
      else if (i % 3 === 1) m.trim(gx, y + 1.08, gz, 0.3, 0.16, 0.22, o.goodsC || 'cushion', { ry });
    }
  }
  return m;
}

// An anvil and a forge with its hood and chimney (forge mouth toward local +z).
export function forge(m, x, y, z, o = {}) {
  const ry = o.ry || 0;
  m.block(x, y, z, 1.8, 0.95, 1.4, 'stone2', { ry, walkable: false });
  const [fx, fz] = off(x, z, ry, 0, 0.1);
  m.glow(fx, y + 1.0, fz, 1.1, 0.16, 0.8, 1.6, 'ember');
  for (const sx of [-1, 1]) {
    const [hx, hz] = off(x, z, ry, sx * 0.85, -0.2);
    m.trim(hx, y + 0.95, hz, 0.2, 1.2, 0.9, 'stone', { ry });
  }
  const [hx, hz] = off(x, z, ry, 0, -0.2);
  m.k.prism(hx, y + 2.15, hz, 1.25, 0.9, 'stone', { sides: 4, top: 0.45, ry: ry + Math.PI / 4 });
  m.block(hx, y + 3.0, hz, 0.8, o.flue ?? 3.5, 0.8, 'stone', { ry, walkable: false });
  if (o.light !== false) m.light(fx, y + 1.4, fz, { color: '#ff7a2f', intensity: 5, distance: 10, flicker: true, priority: 1.9 });
  const [ax, az] = off(x, z, ry, 1.6, 1.4);
  m.block(ax, y, az, 0.4, 0.55, 0.4, 'dark', { ry, walkable: false });
  m.trim(ax, y + 0.55, az, 0.32, 0.28, 0.75, 'metal', { ry, layer: 'metal' });
  m.k.prism(ax, y + 0.6, az + 0.0, 0.05, 0.28, 'metal', { sides: 4, layer: 'metal' });
  const [tx, tz] = off(x, z, ry, -1.6, 1.2);
  m.k.prism(tx, y, tz, 0.4, 0.55, 'wood', { sides: 8 });
  m.trim(tx, y + 0.55, tz, 0.7, 0.03, 0.7, '#3a5a7a', { ry, grad: 0 });
  return m;
}

export function rug(m, x, y, z, w, d, o = {}) {
  m.trim(x, y + 0.005, z, w, 0.025, d, o.c || 'cushion', { ry: o.ry || 0, grad: 0 });
  m.trim(x, y + 0.007, z, w - 0.3, 0.025, d - 0.3, o.c2 || 'cloth', { ry: o.ry || 0, grad: 0 });
  return m;
}

// A standing lantern of the Compact: a stone foot, an iron shaft and a lit cage.
export function lanternStand(m, x, y, z, o = {}) {
  m.k.prism(x, y, z, 0.38, 0.35, 'stone2', { sides: 8 });
  m.lantern(x, y + 0.35, z, { post: o.post ?? 2.2, light: o.light ?? false, intensity: o.intensity ?? 1.2, priority: o.priority ?? 0.9 });
  m.pillar(x, y - 0.6, z, 0.3, (o.post ?? 2.2) + 1.4);
  return m;
}

// A chart table: maps weighted with instruments, a lamp on the corner.
export function chartTable(m, x, y, z, w = 3, d = 1.8, o = {}) {
  table(m, x, y, z, w, d, { ...o, h: 0.9 });
  const ry = o.ry || 0;
  m.trim(x, y + 0.9, z, w - 0.3, 0.012, d - 0.25, '#d8cfae', { ry, grad: 0 });
  for (let i = 0; i < 4; i++) {
    const [px, pz] = off(x, z, ry, (i - 1.5) * w * 0.22, (i % 2 ? 0.3 : -0.25));
    m.trim(px, y + 0.912, pz, 0.6, 0.006, 0.45, i % 2 ? '#c8bfa0' : '#e2dbc0', { ry: ry + (i - 1.5) * 0.12, grad: 0 });
  }
  const [lx, lz] = off(x, z, ry, w / 2 - 0.3, d / 2 - 0.3);
  m.lantern(lx, y + 0.9, lz, { post: 0, light: false });
  const [bx, bz] = off(x, z, ry, -w * 0.2, 0);
  m.k.prism(bx, y + 0.92, bz, 0.18, 0.18, 'brass', { sides: 8, layer: 'metal' });
  return m;
}

// A bell hung from a beam on two posts.
export function bell(m, x, y, z, o = {}) {
  const ry = o.ry || 0, h = o.h ?? 2.6, s = o.s ?? 0.6;
  for (const e of [-1, 1]) {
    const [px, pz] = off(x, z, ry, e * s * 1.4, 0);
    m.block(px, y, pz, 0.22, h, 0.22, 'timber', { ry, walkable: false });
  }
  m.trim(x, y + h, z, s * 3.2, 0.22, 0.26, 'timber', { ry });
  m.k.prism(x, y + h - s * 1.6, z, s * 0.95, s * 1.3, o.c || 'bell', { sides: 10, top: 0.45, layer: 'metal' });
  m.k.prism(x, y + h - 0.3, z, s * 0.35, 0.3, o.c || 'bell', { sides: 8, layer: 'metal' });
  return m;
}

// A tree for a court or garden: a timber-dark trunk and stacked crowns of leaf, in a stone
// planter when it grows on paving.
export function tree(m, x, y, z, o = {}) {
  const h = o.h ?? 4.2, leaf = o.blossom ? ['#c9a3a8', '#d8b4b4', '#e2c4c0'] : ['#5f7f42', '#6d8f4b', '#7d9d55'];
  let base = y;
  if (o.planter) {
    m.block(x, y, z, 1.9, 0.6, 1.9, 'stone2', { walkable: false });
    m.trim(x, y + 0.6, z, 2.05, 0.12, 2.05, 'edge');
    m.trim(x, y + 0.55, z, 1.6, 0.1, 1.6, '#4f4433', { grad: 0 });
    base = y + 0.6;
  }
  m.k.prism(x, base, z, 0.2, h * 0.55, '#4d3d2e', { sides: 6, top: 0.7 });
  m.pillar(x, y, z, 0.3, h * 0.55);
  for (const [r, yy, i] of [[1.7, 0.42, 0], [1.35, 0.62, 1], [0.85, 0.8, 2]]) {
    m.k.prism(x, base + h * yy, z, r * (o.s ?? 1), h * 0.24, leaf[i], { sides: 7, top: 0.62, ry: i * 0.7 + x });
    m.k.prism(x, base + h * yy - 0.3, z, r * 0.8 * (o.s ?? 1), 0.32, leaf[i], { sides: 7, top: 1.25, rx: Math.PI, ry: i * 0.7 + x });
  }
  return m;
}
