import { Kit, siteFrame } from './kit.js';
import { PALETTES } from './style.js';

// A narrow site can still carry a substantial skyline: a deep gate hall supports
// progressively recessed masonry, with a projecting crown and inhabited galleries.
// The street continues through the ground floor on its existing terrain datum.
export function buildCitadel(world, s, group) {
  const military = s.variant === 'garrison';
  const p = PALETTES[military ? 'enclave' : 'salt'];
  const k = new Kit({ ...p, edge: p.stone, dark: p.timber, glow: p.glass, metal: p.ridge });
  const frame = siteFrame(world, s.x, s.z, s.rot || 0, group.position.y);
  const w = s.w, d = s.d, h = s.h, passage = s.passage || 9;
  const slab = (x, y, z, width, height, depth, color = 'stone', collision = true) => {
    k.slab(x, y, z, width, height, depth, color);
    if (collision) frame.solid(x, z, width, depth, y, y + height, { tag: s.id });
  };
  const masonry = (x, y, z, width, height, depth, color = 'stone') => {
    slab(x, y, z, width, height, depth, color);
    // Fine, staggered mortar joints give the larger surfaces a readable scale.
    for (let row = 1; row * 1.8 < height; row++) {
      const yy = y + row * 1.8;
      for (let face = 0; face < 4; face++) {
        const yaw = face * Math.PI / 2, span = face % 2 ? depth : width;
        const distance = (face % 2 ? width : depth) / 2 + 0.012;
        k.at({ x: x + Math.sin(yaw) * distance, z: z + Math.cos(yaw) * distance, ry: yaw }, kit => {
          kit.slab(0, yy, 0, span, 0.025, 0.015, p.stone2, { grad: 0, jitter: 0 });
          for (let xx = -span / 2 + 1.7 + (row % 2) * 1.5; xx < span / 2 - 0.3; xx += 3.2) {
            kit.slab(xx, yy - 1.8, 0, 0.025, 1.8, 0.015, p.stone2, { grad: 0, jitter: 0 });
          }
        });
      }
    }
  };
  const battlements = (x, y, z, width, depth) => {
    slab(x, y - 0.7, z, width + 0.8, 0.35, depth + 0.8, 'stone2');
    slab(x, y - 0.35, z, width + 1.4, 0.35, depth + 1.4, 'edge');
    for (const side of [-1, 1]) {
      slab(x, y, z + side * depth / 2, width + 0.7, 0.8, 0.65, 'stone2');
      slab(x + side * width / 2, y, z, 0.65, 0.8, depth, 'stone2');
      const nx = Math.ceil(width / 2.3), nz = Math.ceil(depth / 2.3);
      for (let i = 0; i <= nx; i++) slab(x - width / 2 + width * i / nx, y + 0.8, z + side * depth / 2, 0.95, 1.05, 0.8, 'edge');
      for (let i = 1; i < nz; i++) slab(x + side * width / 2, y + 0.8, z - depth / 2 + depth * i / nz, 0.8, 1.05, 0.95, 'edge');
    }
  };
  const windows = (y, width, depth, rows) => {
    for (let row = 0; row < rows; row++) for (let face = 0; face < 4; face++) {
      const yaw = face * Math.PI / 2, span = face % 2 ? depth : width;
      const distance = (face % 2 ? width : depth) / 2 + 0.025;
      for (const offset of [-span * 0.29, 0, span * 0.29]) {
        const x = Math.sin(yaw) * distance + Math.cos(yaw) * offset;
        const z = Math.cos(yaw) * distance - Math.sin(yaw) * offset;
        k.window(x, y + row * 5.4, z, 0.75, 2.2, { ry: yaw, pointed: true, lit: (row + face) % 3 === 0, strength: 0.45 });
      }
    }
  };

  // Two grounded wings leave the public passage open, including the road's
  // full width. Separate footings never bridge the opening at ground level.
  const wing = (w - passage) / 2;
  for (const side of [-1, 1]) {
    const x = side * (passage + wing) / 2;
    const bottom = Math.min(-1.5, frame.lowest(wing + 0.7, d + 0.7, x) - 1);
    masonry(x, bottom, 0, wing, 10 - bottom, d);
    slab(x, bottom, 0, wing + 0.6, 1.2, d + 0.6, 'edge');
    for (const face of [-1, 1]) {
      slab(side * (w / 2 - 0.5), bottom, face * d / 2, 1.25, 14 - bottom, 1.1, 'edge');
      k.lantern(side * (passage / 2 + 0.8), 3.4, face * (d / 2 + 0.5), { post: 0 });
      k.window(x, 6.8, face * (d / 2 + 0.025), 0.5, 1.8, { ry: face < 0 ? Math.PI : 0, pointed: true });
    }
  }
  masonry(0, 10, 0, w, 4, d);
  for (const face of [-1, 1]) {
    k.arch(0, 5.5, face * (d / 2 + 0.08), passage, { rise: 3.8, t: 0.65, depth: 0.5, spandrel: true });
    for (const side of [-1, 1]) slab(side * (passage / 2 + 0.32), 0, face * (d / 2 + 0.08), 0.65, 5.5, 0.55, 'edge');
    // Collision follows the curved soffit, leaving generous headroom throughout.
    for (let i = 0; i < 18; i++) {
      const x = -passage / 2 + (i + 0.5) * passage / 18;
      const top = 5.5 + 3.8 * Math.sqrt(1 - (x / (passage / 2)) ** 2);
      frame.solid(x, face * d / 2, passage / 18, 0.6, top, 10.5, { tag: s.id });
    }
  }
  battlements(0, 14, 0, w + 0.4, d + 0.4);

  const middleW = w - 2.4, middleD = d - 2.4, shoulder = h * 0.65;
  masonry(0, 14, 0, middleW, shoulder - 14, middleD);
  windows(16, middleW, middleD, Math.max(1, Math.floor((shoulder - 16) / 5.4)));
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    slab(x * (middleW / 2 - 0.3), 14, z * (middleD / 2 - 0.3), 0.8, shoulder - 14, 0.8, 'edge');
  }
  battlements(0, shoulder, 0, middleW + 1, middleD + 1);
  const upperW = w - 5, upperD = d - 5;
  masonry(0, shoulder, 0, upperW, h - shoulder, upperD);
  windows(shoulder + 2, upperW, upperD, Math.max(1, Math.floor((h - shoulder - 3) / 5.4)));

  // Overhanging crown, supported by closely spaced stone corbels.
  for (const face of [-1, 1]) for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) {
    slab(x * upperW, h - 1.5, face * (upperD / 2 + 0.4), 0.65, 1.4, 1.5, 'stone2');
    slab(face * (upperW / 2 + 0.4), h - 1.5, x * upperD, 1.5, 1.4, 0.65, 'stone2');
  }
  slab(0, h - 0.3, 0, upperW + 3, 0.6, upperD + 3, 'edge');
  battlements(0, h + 0.3, 0, upperW + 2.6, upperD + 2.6);
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    const x = side * (upperW / 2 + 0.3), z = face * (upperD / 2 + 0.3);
    slab(x, h + 0.3, z, 2.6, 3, 2.6, 'stone2');
    battlements(x, h + 3.3, z, 2.9, 2.9);
  }

  // A stepped lantern crown relates to the town's roof lanterns; the garrison
  // variant has a broad, low command room instead of Saltreach's taller lantern.
  const crownH = military ? 3.5 : 5.5;
  slab(0, h + 0.3, 0, 5.8, crownH, 5.2, 'stone2');
  for (let face = 0; face < 4; face++) {
    const yaw = face * Math.PI / 2;
    k.window(Math.sin(yaw) * 2.93, h + 1.2, Math.cos(yaw) * 2.63, 1.5, crownH - 1.5, { ry: yaw, lit: true, strength: 0.45 });
  }
  battlements(0, h + crownH + 0.3, 0, 6.2, 5.6);
  if (!military) {
    slab(0, h + crownH + 0.3, 0, 3, 2.6, 2.6, 'stone2');
    battlements(0, h + crownH + 2.9, 0, 3.4, 3);
  }

  // Timber maintenance galleries break up the stone mass on two faces, with
  // visible diagonal braces and rails rather than an all-over scaffold texture.
  for (const [side, y] of [[-1, 21], [1, shoulder + 4]]) {
    const width = y < shoulder ? middleW : upperW;
    const x = side * (width / 2 + 1.1), depth = 6.4;
    slab(x, y, 0, 2.5, 0.25, depth, 'dark');
    for (const z of [-2.8, 0, 2.8]) {
      slab(x + side, y, z, 0.16, 3.5, 0.16, 'dark', false);
      // Diagonal supports lie in the x/y plane.
      k.block(x, y - 1, z, 0.18, 2.9, 0.18, 'dark', { rz: -side * Math.PI / 4 });
    }
    for (const rail of [1.2, 3.5]) slab(x + side, y + rail, 0, 0.18, 0.15, depth, 'dark', false);
    slab(x + side, y + 0.25, 0, 0.18, 1.1, depth, 'dark', true);
    k.roof('hip', x, y + 3.5, 0, 2.9, depth + 0.5, 0.8, { c: 'roof' });
  }
  for (const face of [-1, 1]) for (const side of [-1, 1]) {
    const x = side * upperW * 0.29;
    k.banner(x, h - 10, face * (upperD / 2 + 0.2), military ? 1.7 : 1.4, 7, military ? p.cloth : p.accent, { ry: face < 0 ? Math.PI : 0 });
  }
  group.add(k.build('citadel_masonry'));
}

// Ranges and a gate court give the keep a castle footprint. The central route
// stays open so the court connects to the town and, in Meridian, the Grand Warden's log.
export function buildCastle(world, s, group) {
  buildCitadel(world, { ...s, id: s.id || 'chain_citadel' }, group);
  const military = s.variant === 'garrison', p = PALETTES[military ? 'enclave' : 'salt'];
  const k = new Kit({ ...p, edge: p.stone, dark: p.timber, glow: p.glass, metal: p.ridge });
  const f = siteFrame(world, s.x, s.z, s.rot || 0, group.position.y);
  const slab = (x, y, z, w, h, d, c = 'stone2') => {
    k.slab(x, y, z, w, h, d, c);
    f.solid(x, z, w, d, y, y + h, { tag: s.id || 'chain_citadel' });
  };
  const range = (x, z, w, d, h) => {
    const bottom = Math.min(-1, f.lowest(w, d, x, z) - 1);
    slab(x, bottom, z, w, h - bottom, d);
    slab(x, h, z, w + 0.6, 0.4, d + 0.6, 'edge');
    for (const side of [-1, 1]) {
      for (let zz = -d / 2 + 2; zz < d / 2; zz += 4) {
        for (const yy of [4, 10]) k.window(x + side * (w / 2 + 0.02), yy, z + zz, 0.7, 2, { ry: side * Math.PI / 2, pointed: true });
        slab(x + side * w / 2, bottom, z + zz, 0.65, h - bottom, 0.9, 'stone');
      }
      slab(x + side * w / 2, h + 0.4, z, 0.5, 0.75, d, 'stone');
      for (let zz = -d / 2; zz <= d / 2; zz += 2) slab(x + side * w / 2, h + 1.15, z + zz, 0.7, 0.9, 0.8, 'edge');
    }
    if (w > 5) {
      // A long slate ridge above the range's battlements gives the castle the
      // broad, inhabited silhouette of a hall, rather than another tower.
      k.roof('hip', x, h + 0.4, z, w - 1.4, d - 2, 3.6, { c: p.roof, overhang: 0.1 });
      for (let zz = -d / 2 + 3; zz < d / 2; zz += 6) slab(x, h + 1, z + zz, 1.1, 4, 1.1, 'stone');
    }
  };
  if (military) {
    for (const side of [-1, 1]) {
      range(side * 19, 5, 12, 32, 17);
      range(side * 13, -8, 6, 6, 15);
      // Front towers anchor the ranges to the gate court.
      range(side * 20, 23, 9, 9, 22);
      slab(side * 10.5, -1, 24, 9, 15, 4);
      k.banner(side * 10.5, 7, 26.1, 2, 5, p.cloth);
    }
    k.arch(0, 6.8, 24, 12, { rise: 4.2, depth: 4, t: 0.8, spandrel: true });
    slab(0, 12.4, 24, 33, 1.6, 4);
    for (let x = -15; x <= 15; x += 2.5) slab(x, 14, 24, 1.1, 1.2, 4.5, 'edge');
    // The rear curtain meets the enclosing fort wall at the cliff lip.
    slab(0, -1, -20, 50, 15, 4);
    slab(0, 14, -20, 51, 0.4, 4.6, 'edge');
    for (let x = -24; x <= 24; x += 2.4) slab(x, 14.4, -20, 1.1, 1.2, 4.6, 'stone');
  } else {
    // Broad residential wings enclose the north court and meet the town's
    // northern curtain. Its existing gate remains the courtyard exit.
    for (const side of [-1, 1]) {
      range(side * 15, 12, 10, 20, 14);
      range(side * 15, 19, 10, 9, 18);
    }
  }
  group.add(k.build('castle_ranges'));
}
