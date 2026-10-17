// Built approaches: where a road meets a cliff, a stair carries it, never a plank ramp or a
// bare cut. Each is a solid masonry flight standing on its own ground, with cheek walls,
// parapets on every drop and a lamp at every landing (data/architecture.js APPROACHES).
//
//   straight   one flight down a terrace lip, from a gate's mouth to the road below
//   switchback flights stacked along a cliff, turning on landings, each lane a storey
//              below the one before, so the road descends a terrace face in a few metres
import { Mason, RISE, TREAD } from './mason.js';

// A parapet run on the open edge of a flight or landing (top follows the treads below it).
function openEdge(m, ax, az, bx, bz, ya, yb, o = {}) {
  const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / 0.9));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, y = ya + (yb - ya) * (t0 + t1) / 2;
    const x = ax + (bx - ax) * (t0 + t1) / 2, z = az + (bz - az) * (t0 + t1) / 2;
    m.block(x, y - 0.2, z, 0.5, 1.25, len / n + 0.01, o.c || 'stone2', { ry, walkable: false });
  }
  m.trim((ax + bx) / 2, Math.max(ya, yb) + 1.05, (az + bz) / 2, 0.62, 0.12, len, 'edge', { ry });
}

export function buildApproach(world, a, exclusions, add) {
  const m = new Mason(world, { x: a.x, z: a.z, yaw: a.yaw ?? 0, y: a.y, palette: a.palette || 'salt', tag: a.tag || 'approach', name: a.name, lights: 6 });
  if (a.kind === 'straight') {
    // local: +z down the flight from the top (y = 0) to the foot (a.drop below)
    const w = a.w ?? 5, n = Math.ceil(a.drop / RISE - 1e-6), run = a.run ?? TREAD;
    const L = n * run;
    // the flight is built from the foot up: the stair climbs toward -z
    m.stair(0, L, Math.PI, w, -a.drop, 0, { run, cheeks: 1.0, c: 'stone', cheekC: 'stone2' });
    // a short level apron at the top meets the lip, and one at the foot meets the road
    m.landing(0, -0.6, w + 1, 1.2, 0, { c: 'stone' });
    m.landing(0, L + 0.8, w, 1.6, -a.drop, { c: 'stone' });
    for (const sx of [-1, 1]) {
      m.block(sx * (w / 2 + 0.25), -a.drop, L + 0.8, 0.8, 1.6, 0.8, 'stone', { walkable: false });
      m.lantern(sx * (w / 2 + 0.25), -a.drop + 1.6, L + 0.8, { post: 1.0, light: sx > 0, intensity: 1 });
    }
    exclusions.push({ ...m.point(0, 0, L / 2), r: L / 2 + 4 });
    world.approaches ||= [];
    world.approaches.push({ id: a.id, top: m.point(0, 0, -0.6), foot: m.point(0, -a.drop, L + 1.2) });
    add(m.build());
    return;
  }
  if (a.kind === 'switchback' && a.drop === 'auto') {
    // measure the drop at the foot: lay the stair out once at a guess, read the ground there
    let drop = 16;
    for (let k = 0; k < 2; k++) {
      const N = Math.ceil(drop / RISE - 1e-6), fl = a.flights ?? 4, run = a.run ?? TREAD;
      let x = a.x0 ?? 3, dir = a.dir0 ?? 1;
      for (let f = 0; f < fl; f++) { x += dir * (Math.floor(N / fl) + (f < N % fl ? 1 : 0)) * run; dir = -dir; }
      const fz = (a.z0 ?? 0) + (a.lane ?? 3.6) * (fl - 0.5);
      drop = Math.max(2, -Math.min(m.ground(x - dir * 0.8, fz), m.ground(x + dir * 2, fz)));
    }
    a = { ...a, drop };
  }
  if (a.kind === 'switchback') {
    // local: lanes run along x, stacked toward +z away from the cliff; y = 0 at the top
    const lane = a.lane ?? 3.6, land = a.landing ?? 3.6;
    const N = Math.ceil(a.drop / RISE - 1e-6), rise = a.drop / N;
    const flights = a.flights ?? 4;
    const per = (i) => Math.floor(N / flights) + (i < N % flights ? 1 : 0);
    const x0 = a.x0 ?? 3; // where the first flight leaves the top landing
    let y = 0, x = x0, dir = a.dir0 ?? 1;
    const z0 = a.z0 ?? 0; // the cliff-side edge of the first lane
    // the top landing reaches from the gate's mouth over the first lane's strip
    const topW = a.topW ?? 6, topD = a.topD ?? 4, back = -dir; // the landing lies behind the first flight
    const edges = a.topEdges ?? ['far', 'end'];
    m.landing(x0 + back * topW / 2, z0 + (lane - topD) / 2, topW, topD + lane, 0, { c: 'stone' });
    if (edges.includes('far')) openEdge(m, x0 + back * topW, z0 + lane - 0.25, x0, z0 + lane - 0.25, 0, 0);
    if (edges.includes('end')) openEdge(m, x0 + back * (topW - 0.25), z0 - 0.5, x0 + back * (topW - 0.25), z0 + lane - 0.5, 0, 0);
    const steps = [];
    for (let f = 0; f < flights; f++) {
      const n = per(f), run = a.run ?? TREAD, L = n * run;
      const zc = z0 + lane * (f + 0.5);
      const xa = x, xb = x + dir * L;
      // the flight descends from xa to xb: built as a stair climbing from xb toward xa
      m.stair(xb, zc, dir > 0 ? -Math.PI / 2 : Math.PI / 2, lane, y - n * rise, y, { run, rise, c: 'stone' });
      steps.push({ xa, xb, y0: y, y1: y - n * rise, zc });
      y -= n * rise;
      // the turn: a landing spanning this lane and the next, beyond the flight's foot
      const lx = xb + dir * land / 2;
      const last = f === flights - 1;
      m.landing(lx, last ? zc : zc + lane / 2, land, last ? lane : lane * 2, y, { c: 'stone' });
      if (!last) {
        m.block(lx + dir * (land / 2 + 0.25), y - 0.2, zc + lane / 2, 0.5, 1.25, lane * 2, 'stone2', { walkable: false });
        m.lantern(lx + dir * (land / 2 + 0.25), y + 1.05, zc + lane * 0.5, { post: 0.9, light: f % 2 === 0, intensity: 1.2 });
      }
      x = xb; dir = -dir;
    }
    // parapets on each lane's open (outer) edge where the next lane drops away, cheek walls
    // on the cliff side of the first lane
    steps.forEach((st, f) => {
      const ze = st.zc + lane / 2 - 0.25; // on the lane's own mass, never over the next one
      const lastLane = f === steps.length - 1;
      // between this lane and the next, the next lane's flight runs the other way: guard the
      // stretch where the drop is more than a step (all of it but the turn landing)
      openEdge(m, st.xa, ze, st.xb, ze, st.y0, st.y1, {});
    });
    // the foot: an apron where the road begins, flanked by two lamp piers and a waystone
    const footX = x, footZ = z0 + lane * (flights - 0.5), fy = y;
    const dl = Math.sign(steps.at(-1).xb - steps.at(-1).xa); // the last flight's heading
    const ex = footX + dl * 1.6;
    m.landing(ex, footZ, 3.2, lane, fy, { c: 'stone' });
    for (const sz of [-1, 1]) {
      m.block(ex + dl * 1.3, fy, footZ + sz * (lane / 2 + 0.4), 0.8, 1.7, 0.8, 'stone', { walkable: false });
      m.lantern(ex + dl * 1.3, fy + 1.7, footZ + sz * (lane / 2 + 0.4), { post: 1.1, light: sz > 0, intensity: 1.3 });
    }
    exclusions.push({ ...m.point(x0 + 4, -8, z0 + lane * flights / 2), r: Math.max(16, lane * flights) });
    world.approaches ||= [];
    world.approaches.push({ id: a.id, top: m.point(x0 + back * topW / 2, 0, z0 - topD / 2), foot: m.point(ex + dl * 2.4, fy, footZ),
      route: [[x0 + back * topW / 2, z0 - topD + 0.4], [x0 + back * topW / 2, z0 + lane / 2], ...steps.flatMap((st, f) => [[st.xa, st.zc], [st.xb, st.zc], [st.xb + Math.sign(st.xb - st.xa) * land / 2, st.zc + (f < steps.length - 1 ? lane : 0)]]), [ex + dl * 2.6, footZ]].map(([px, pz]) => m.point(px, 0, pz)) });
    add(m.build());
  }
}
