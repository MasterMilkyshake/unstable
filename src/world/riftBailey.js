// The inner citadel's ring (data/riftCitadel.js): towers at its four corners, a gatehouse on
// each ward street and one at the head of the processional stair, and the south runs closing on
// the keep's corner piers, so the keep itself is the citadel's gate onto the plaza.
import { WallFrame, circuit, CITY_PAL } from './riftWalls.js';
import { RIFT_CITADEL, RIFT_CITADEL_GATES } from '../data/riftCitadel.js';

export function buildRiftBailey(world, exclusions, low) {
  const C = RIFT_CITADEL;
  const ground = world.terrain.heightAt(C.x, C.z);
  const crown = ground + C.wallHeight;
  const F = new WallFrame(world, C.x, C.z, CITY_PAL, { tag: 'rift_citadel', name: 'Rift citadel ring', low });
  const w = C.halfWidth, f = C.front, r = C.rear;
  const gate = (id) => RIFT_CITADEL_GATES.find((g) => g.id === id);
  const node = (x, z, kind, o = {}) => ({ x, z, kind, top: crown, base: world.terrain.heightAt(C.x + x, C.z + z), ...o });
  const gateNode = (g, outYaw) => node(g.x, g.z, 'gate', { yaw: outYaw, def: { width: g.width, depth: 8, towers: 8 }, floor: world.terrain.heightAt(C.x + g.x, C.z + g.z) });
  const nodes = [
    // the keep's south-east corner pier: the run ends inside it
    node(-12.4, f, 'end'),
    node(-w, f, 'tower', { w: 10, rise: 6, roof: 'hip', lit: true }),
    gateNode(gate('east'), Math.PI / 2),
    node(-w, r, 'tower', { w: 10, rise: 6, roof: 'spire', roofH: 14 }),
    gateNode(gate('north'), Math.PI),
    node(w, r, 'tower', { w: 10, rise: 6, roof: 'spire', roofH: 14 }),
    gateNode(gate('west'), -Math.PI / 2),
    node(w, f, 'tower', { w: 10, rise: 6, roof: 'hip', lit: true }),
    node(12.4, f, 'end'),
  ];
  const out = circuit(F, nodes, {
    t: C.wallT,
    // the outer side of every run looks away from the keep
    outward: (mx, mz, nx, nz) => (nx * mx + nz * (mz - (f + r) / 2) > 0 ? 1 : -1),
  });
  const group = F.build();
  group.name = 'Rift citadel ring';
  exclusions.push(...F.ex);
  for (const p of out.lights) world.addLight(p, '#ffc27a', 1.1, 16, true, 0.7);
  world.riftBailey = group;
  world.riftCitadelWalls = {
    walks: F.walks,
    gates: out.gates.map((g) => ({ x: g.x, z: g.z, top: crown + 0.5 })),
  };
  // the walks report the walk level, the gates their roof: both at the crown
  for (const wk of world.riftCitadelWalls.walks) wk.top = crown + 0.5;
}
