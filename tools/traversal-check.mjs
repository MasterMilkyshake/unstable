// Traversal course (task 7 of the systems round): a fresh character crosses flat ground, slopes,
// a town gate, a doorway and an inn's stairs, a gatehouse stair and a narrow way round a house, a
// ledge, the sea and a rented boat, driven by held keys (W, Shift, Space, C, E) with the camera
// turned toward each waypoint. Waypoints come from the navigation planner on the real colliders,
// so doors and stairs are followed as built. Needs a dev server.
//   TRAVERSE_URL=http://localhost:5173/ node tools/traversal-check.mjs [leg ids...]
// A leg fails if the walker makes under 0.5 m of headway toward its next point for 2.5 s (stuck),
// takes damage it should not, ends short, or the console logs an error. Exits 1 on any failure.
import { chromium } from 'playwright';

const URL = process.env.TRAVERSE_URL || 'http://localhost:5173/';
const only = process.argv.slice(2);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = window.__unstable;
    g.input.requestLock = () => {};
    const { RACES } = await import('/src/data/races.js');
    const ch = g.createCharacter({ name: 'Wayfarer', race: RACES[0].id, look: {} });
    ch.armed = true;
    ch.silver = 500;
    ch.attrs.medium = 30;
    ch.inventory.weapons.push({ uid: 'k1', id: 'driftsteel_katana' });
    ch.equipped.weapon = 'k1';
    g.startGame(ch, false);
    const { G } = await import('/src/core/globals.js');
    const { navGrid, navBody } = await import('/src/entities/nav.js');
    for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
    for (const a of G.actors) if (a !== G.player && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
    const p = G.player;
    const I = g.input;
    const w = g.world;
    const T = (window.__trv = { G, g, p, I, w, t: 0, hooks: [], waits: [] });
    const update = g.updatePlaying.bind(g);
    g.updatePlaying = (dt) => {
      T.t += dt;
      for (const h of [...T.hooks]) h(dt);
      update(dt);
      for (let i = T.waits.length - 1; i >= 0; i--) if (T.waits[i].until()) T.waits.splice(i, 1)[0].res();
    };
    T.wait = (s) => new Promise((res) => {
      const end = T.t + s;
      T.waits.push({ until: () => T.t >= end, res });
    });
    T.waitFor = (fn, s) => new Promise((res) => {
      const end = T.t + s;
      T.waits.push({ until: () => fn() || T.t >= end, res });
    });
    T.ground = (x, z, y = 400) => Math.max(w.terrain.heightAt(x, z), w.colliders.groundAt(x, z, y, 0.21));
    T.place = (x, z, y) => {
      p.pos.set(x, y ?? T.ground(x, z) + 0.05, z);
      p.vel.set(0, 0, 0);
      p.push.set(0, 0, 0);
      p.fallStart = p.pos.y;
      p.swimming = false;
      p.climbing = false;
      if (p.boat) p.leaveBoat();
      I.down.clear();
    };
    // the planner's route from where the player stands to (x, z[, y])
    T.plan = (x, z, y = NaN) => {
      const grid = navGrid(w);
      const r = grid.findPath(p.pos.x, p.pos.z, p.pos.y, x, z, y, navBody({ radius: 0.42, height: 1.8 }), 60000);
      return r ? { complete: r.complete, pts: r.points.map((q) => [q[0], q[1], q[2]]) } : { complete: false, pts: [] };
    };
    // walk (or sprint) through points with W held and the camera turned to each; Space when
    // `jumpIf` says so. A point with a height counts as reached only at that height. Stuck for a
    // moment, it plans again from where it stands to `goal` (as a player would look for the way),
    // up to three times. Returns { ok, stuck, hpLost, end, replans }.
    T.follow = async (pts, o = {}) => {
      const hp0 = p.hp;
      let i = 0;
      let best = Infinity;
      let since = T.t;
      let stuck = null;
      let replans = 0;
      const reach = o.reach || 0.8;
      const at = (q) => Math.hypot(q[0] - p.pos.x, q[q.length - 1] - p.pos.z) < reach && (q.length < 3 || Math.abs(q[1] - p.pos.y) < 0.9);
      const hook = () => {
        while (i < pts.length && at(pts[i])) {
          i++;
          best = Infinity;
          since = T.t;
        }
        if (i >= pts.length) return;
        if (o.goal && T.t - since > 1.2 && replans < 3) {
          const r = T.plan(o.goal[0], o.goal[1], o.goal[2] ?? NaN);
          if (r.complete && r.pts.length) {
            pts = r.pts;
            i = 0;
            replans++;
            best = Infinity;
            since = T.t;
          }
        }
        const q = pts[i];
        const qx = q[0];
        const qz = q[q.length - 1];
        g.camYaw = Math.atan2(qx - p.pos.x, qz - p.pos.z);
        I.down.add('KeyW');
        if (o.sprint) I.down.add('ShiftLeft');
        if (o.jumpIf && o.jumpIf()) I.pressed.add('Space');
        const d = Math.hypot(qx - p.pos.x, qz - p.pos.z);
        if (d < best - 0.5) {
          best = d;
          since = T.t;
        } else if (T.t - since > 2.5 && !stuck) stuck = [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1));
      };
      T.hooks.push(hook);
      await T.waitFor(() => i >= pts.length || stuck, o.timeout || 60);
      T.hooks.splice(T.hooks.indexOf(hook), 1);
      I.down.delete('KeyW');
      I.down.delete('ShiftLeft');
      await T.wait(0.3);
      return { ok: i >= pts.length && !stuck, stuck, replans, hpLost: +(hp0 - p.hp).toFixed(1), end: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)) };
    };
  });
  await page.waitForTimeout(1000);

  const legs = [];
  const leg = (id, name, fn) => legs.push({ id, name, fn });

  leg('slope', 'the Wash camp up the bay\'s east shore (sprint, flat ground and slopes)', async () => {
    const T = window.__trv;
    T.place(-4, -346);
    const r = await T.follow([[0, -322], [-30, -280], [-34, -220]], { sprint: true, timeout: 40 });
    return { ...r, ok: r.ok && r.hpLost <= 0 };
  });

  leg('gate', 'on through the sea gate into Saltreach (a gate passage, town lanes)', async () => {
    const T = window.__trv;
    T.place(-30, -160);
    const route = [[4, -104], [0, -40], [0, 0]];
    const pts = [];
    for (const [x, z] of route) {
      const r = T.plan(x, z);
      if (!r.complete) return { ok: false, note: `no route to ${x}, ${z}` };
      pts.push(...r.pts);
      T.p.pos.set(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1], r.pts[r.pts.length - 1][2]);
    }
    T.place(-30, -160);
    const r = await T.follow(pts, { timeout: 60 });
    return { ...r, ok: r.ok && r.hpLost <= 0 };
  });

  leg('inn', 'through the Salted Anchor\'s door and up its stairs to the loft (a doorway, stairs)', async () => {
    const T = window.__trv;
    const inn = T.w.interiors.find((x) => x.type === 'inn' && x.name === 'The Salted Anchor') || T.w.interiors.find((x) => x.type === 'inn');
    const bed = T.w.interactables.find((x) => x.kind === 'bed' && /_bed$/.test(x.id) && Math.hypot(x.pos.x - inn.x, x.pos.z - inn.z) < 12);
    const out = inn.entrance.clone();
    T.place(out.x + (out.x - inn.x) * 0.6, out.z + (out.z - inn.z) * 0.6);
    // the stair rises along the inn's left wall (world/architecture.js furnishInterior): in at the
    // door, to its foot, straight up it, then to the loft's bed
    const c = Math.cos(inn.rot);
    const sn = Math.sin(inn.rot);
    const world = (lx, lz) => [inn.x + lx * c + lz * sn, inn.z - lx * sn + lz * c];
    const stairX = -inn.w / 2 + 1.45;
    const foot = world(stairX, inn.d / 2 - 0.65); // just before the bottom step, clear of the front wall
    const top = world(stairX, -inn.d / 2 + 1.0);
    const toFoot = T.plan(foot[0], foot[1], inn.floor);
    if (!toFoot.complete) return { ok: false, note: 'no way to the stair foot' };
    const r0 = await T.follow(toFoot.pts, { timeout: 30, reach: 0.4, goal: [foot[0], foot[1], inn.floor] });
    const r1 = await T.follow([[top[0], inn.loft, top[1]]], { timeout: 15, reach: 0.5 });
    const toBed = T.plan(bed.pos.x, bed.pos.z, inn.loft);
    const r = toBed.complete ? await T.follow(toBed.pts, { timeout: 20, reach: 0.5, goal: [bed.pos.x, bed.pos.z, inn.loft] }) : { ok: false };
    r.ok = r0.ok && r1.ok && r.ok;
    r.stuck = r0.stuck || r1.stuck || r.stuck;
    r.replans = (r0.replans || 0) + (r.replans || 0);
    const upstairs = T.p.pos.y > inn.loft - 0.3;
    return { ...r, ok: r.ok && upstairs && r.hpLost <= 0, note: `ended at y ${T.p.pos.y.toFixed(2)} (loft ${inn.loft.toFixed(2)}), ${r.replans} re-plans` };
  });

  leg('stair', 'the west gatehouse stair and the narrow way round a house', async () => {
    const T = window.__trv;
    const pts = [[-95, 8], [-88, 8], [-76, 8], [-66, 9], [-61, 14.5], [-52, 15], [-45, 14], [-44, 6]];
    T.place(pts[0][0], pts[0][1], T.ground(pts[0][0], pts[0][1], 8) + 0.05);
    const route = [];
    for (const [x, z] of pts.slice(1)) {
      const r = T.plan(x, z);
      if (!r.complete) return { ok: false, note: `no route to ${x}, ${z}` };
      route.push(...r.pts);
      const e = r.pts[r.pts.length - 1];
      T.p.pos.set(e[0], e[1], e[2]);
    }
    T.place(pts[0][0], pts[0][1], T.ground(pts[0][0], pts[0][1], 8) + 0.05);
    const r = await T.follow(route, { timeout: 50, reach: 0.6, goal: pts[pts.length - 1] });
    return { ...r, ok: r.ok && r.hpLost <= 0, note: `${r.replans} re-plans` };
  });

  leg('ledge', 'a ledge: jump, catch the edge, leap onto the top', async () => {
    const T = window.__trv;
    const { p, w, I, g } = T;
    // solid blocks near the town whose top stands 2.5-4 m over open, level ground in front of a
    // face; the game's own probe decides which edges are ledges, so try them in turn
    const spots = [];
    for (const c of w.colliders.query(0, 0, 600, [])) {
      if (c.kind !== 'box' || !c.walkable) continue;
      const th = w.terrain.heightAt(c.x, c.z);
      if (c.y1 - th < 2.5 || c.y1 - th > 4 || c.y0 > th + 0.3 || c.hw < 1.5 || c.hd < 1.5) continue;
      for (const [lx, lz] of [[0, -c.hd - 1.6], [0, c.hd + 1.6], [-c.hw - 1.6, 0], [c.hw + 1.6, 0]]) {
        const fx = c.x + lx * (c.cos ?? 1) + lz * (c.sin || 0);
        const fz = c.z - lx * (c.sin || 0) + lz * (c.cos ?? 1);
        const fth = w.terrain.heightAt(fx, fz);
        if (Math.abs(T.ground(fx, fz, fth + 1) - fth) > 0.3 || c.y1 - fth < 2.5 || c.y1 - fth > 4) continue;
        if (w.colliders.groundAt(fx, fz, fth + 3, 0.5) > fth + 0.3) continue;
        spots.push({ c, fx, fz, top: c.y1, yaw: Math.atan2(-lx * (c.cos ?? 1) - lz * (c.sin || 0), lx * (c.sin || 0) - lz * (c.cos ?? 1)) });
      }
    }
    if (!spots.length) return { ok: false, note: 'no wall found' };
    let tried = 0;
    for (const spot of spots.slice(0, 6)) {
      tried++;
      T.place(spot.fx, spot.fz);
      g.camYaw = spot.yaw;
      p.yaw = spot.yaw;
      I.down.add('KeyW');
      await T.wait(0.25);
      I.pressed.add('Space');
      await T.waitFor(() => p.climbing, 1.5);
      if (!p.climbing) {
        I.down.clear();
        continue;
      }
      I.pressed.add('Space');
      await T.waitFor(() => p.grounded && p.pos.y > spot.top - 0.1, 2);
      I.down.delete('KeyW');
      await T.wait(0.4);
      const onTop = p.grounded && Math.abs(p.pos.y - spot.top) < 0.15;
      return { ok: onTop, note: `caught the edge of the ${spot.c.tag || 'block'} at ${spot.c.x.toFixed(0)}, ${spot.c.z.toFixed(0)} (${tried} tried), on top ${onTop} (y ${p.pos.y.toFixed(2)} vs ${spot.top.toFixed(2)})` };
    }
    return { ok: false, note: `no catch at any of ${tried} walls` };
  });

  leg('water', 'into the sea off the Wash, a swim out and back, and out onto the beach', async () => {
    const T = window.__trv;
    const { p } = T;
    // the beach west of the camp, then the open water beyond it
    T.place(-4, -346);
    // the nearest deep water, and the planner's walk to the last dry ground before it
    let sea = null;
    for (let r = 10; r < 220 && !sea; r += 5) {
      for (let k = 0; k < 24 && !sea; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = -4 + Math.sin(a) * r;
        const z = -346 + Math.cos(a) * r;
        if (T.w.terrain.heightAt(x, z) < -3) sea = [x, z, a];
      }
    }
    if (!sea) return { ok: false, note: 'no sea found' };
    const shore = T.plan(sea[0], sea[1]);
    const end = shore.pts[shore.pts.length - 1];
    const walk = await T.follow(shore.pts, { timeout: 40, reach: 0.8, goal: [end[0], end[2]] });
    const home = [p.pos.x, p.pos.z];
    let swam = false;
    T.hooks.push(() => (swam ||= p.swimming));
    const out = await T.follow([[sea[0] + Math.sin(sea[2]) * 12, sea[1] + Math.cos(sea[2]) * 12]], { timeout: 30 });
    // back toward the camp, until the feet are on dry ground again
    let ashore = null;
    const dry = () => {
      if (!ashore && p.grounded && !p.swimming && T.t - (T.leftWater ?? -9) > 0.5) ashore = [p.pos.x, p.pos.y, p.pos.z];
      if (p.swimming) T.leftWater = T.t;
    };
    T.hooks.push(dry);
    const back = await T.follow([home, [-4, -346]], { timeout: 40 });
    T.hooks.splice(T.hooks.indexOf(dry), 1);
    return { ok: walk.ok && swam && out.ok && !!ashore && !back.stuck, stuck: walk.stuck || out.stuck || back.stuck, note: `swam ${swam}, back on dry ground ${ashore ? `at ${ashore.map((v) => v.toFixed(1)).join(', ')}` : 'never'}` };
  });

  leg('boat', 'rent a skiff at the Saltreach dock, walk to it, board, sail, and step off', async () => {
    const T = window.__trv;
    const { p, g, I, G } = T;
    const dock = T.w.docks.dock_salt;
    T.place(dock.end.x - dock.dir.x * 8, dock.end.z - dock.dir.z * 8, dock.end.y + 0.1);
    const { ACTIONS } = await import('/src/game/hooks.js');
    ACTIONS.rentBoat('dock_salt');
    const boat = g.boats[g.boats.length - 1];
    const r = await T.follow([[dock.end.x, dock.end.z]], { timeout: 20 });
    // to the dock's edge beside the boat, until the game offers to board it
    const offer = () => {
      const it = g.findInteractable();
      return it && it.kind === 'boat';
    };
    const hook = () => {
      if (offer()) return;
      g.camYaw = Math.atan2(boat.pos.x - p.pos.x, boat.pos.z - p.pos.z);
      I.down.add('KeyW');
    };
    T.hooks.push(hook);
    await T.waitFor(offer, 6);
    T.hooks.splice(T.hooks.indexOf(hook), 1);
    I.down.delete('KeyW');
    I.pressed.add('KeyE');
    await T.waitFor(() => p.boat === boat, 2);
    const boarded = p.boat === boat;
    const x0 = boat.pos.x;
    const z0 = boat.pos.z;
    I.down.add('KeyW');
    await T.wait(4);
    I.down.delete('KeyW');
    const sailed = Math.hypot(boat.pos.x - x0, boat.pos.z - z0);
    await T.wait(2);
    I.pressed.add('KeyE');
    await T.waitFor(() => !p.boat, 2);
    return { ok: r.ok && boarded && sailed > 3 && !p.boat, note: `boarded ${boarded}, sailed ${sailed.toFixed(1)} m, stepped off ${!p.boat}` };
  });

  leg('momentum', 'a sprint, a slide and a jump out of it carry their speed', async () => {
    const T = window.__trv;
    const { p, I, g } = T;
    // the flat strand by the Wash camp
    T.place(-4, -346);
    g.camYaw = 0;
    I.down.add('KeyW');
    I.down.add('ShiftLeft');
    await T.wait(1.2);
    const sprint = p.speed;
    I.pressed.add('KeyC');
    await T.wait(0.2);
    I.pressed.add('Space');
    let peak = 0;
    let landed = 0;
    await T.waitFor(() => !p.grounded, 0.3);
    T.hooks.push(() => (peak = Math.max(peak, p.speed)));
    await T.waitFor(() => p.grounded, 2);
    landed = p.speed;
    await T.wait(0.15);
    const after = p.speed;
    I.down.clear();
    return { ok: peak > sprint * 1.15 && after > sprint * 0.95, note: `sprint ${sprint.toFixed(1)}, airborne peak ${peak.toFixed(1)}, on landing ${landed.toFixed(1)}, 0.15 s later ${after.toFixed(1)} m/s` };
  });

  leg('lunge', 'a lunging critical stops at a wall instead of carrying through it', async () => {
    const T = window.__trv;
    const { p, I, g, w } = T;
    // a house wall in town: stand 1.6 m from its outside face and lunge into it (Iaido, 30 m/s)
    const house = w.interiors.find((x) => x.type === 'house' && Math.hypot(x.x, x.z) < 80);
    const c = house.entrance;
    // beside the door, facing the wall
    const nx = (c.x - house.x) / Math.hypot(c.x - house.x, c.z - house.z);
    const nz = (c.z - house.z) / Math.hypot(c.x - house.x, c.z - house.z);
    const sx = c.x + nz * 2.6 + nx * 0.6;
    const sz = c.z - nx * 2.6 + nz * 0.6;
    T.place(sx, sz);
    const yaw = Math.atan2(-nx, -nz);
    g.camYaw = yaw;
    p.yaw = yaw;
    p.critCd = 0;
    await T.wait(0.2);
    const before = (p.pos.x - house.x) * nx + (p.pos.z - house.z) * nz;
    I.pressed.add('KeyR');
    await T.wait(1.2);
    const after = (p.pos.x - house.x) * nx + (p.pos.z - house.z) * nz;
    const halfDepth = house.d / 2;
    return { ok: after > halfDepth - 0.1, note: `outside the wall before (${before.toFixed(2)} m from centre) and after (${after.toFixed(2)}; the wall's face is ${halfDepth} m)` };
  });

  leg('fall', 'falls fit the climbing: a hop off a wall low in a long fall breaks it', async () => {
    const T = window.__trv;
    const { p, I, w } = T;
    // drop 12 m beside a tall wall and hop off it near the ground
    let wall = null;
    for (const c of w.colliders.query(0, 0, 400, [])) {
      if (c.kind !== 'box' || c.rot || c.y1 - w.terrain.heightAt(c.x, c.z) < 14 || c.hw < 2) continue;
      const fx = c.x;
      const fz = c.z - c.hd - 0.6;
      const th = w.terrain.heightAt(fx, fz);
      if (Math.abs(T.ground(fx, fz, th + 2) - th) > 0.3 || w.colliders.groundAt(fx, fz, th + 16, 0.5) > th + 0.3) continue;
      wall = { fx, fz, th };
      break;
    }
    if (!wall) return { ok: false, note: 'no tall wall found' };
    T.place(wall.fx, wall.fz, wall.th + 12);
    p.grounded = false;
    p.fallStart = p.pos.y;
    p.yaw = 0;
    T.g.camYaw = 0;
    p.latches = 99; // no catches: only the hop
    p.latches = 0;
    const hp0 = p.hp;
    await T.waitFor(() => p.pos.y < wall.th + 1.3, 3);
    I.down.add('KeyW');
    I.pressed.add('Space');
    await T.waitFor(() => p.grounded, 3);
    I.down.delete('KeyW');
    await T.wait(0.2);
    return { ok: p.hp >= hp0 - 0.01, note: `lost ${(hp0 - p.hp).toFixed(1)} health` };
  });

  for (const l of legs) {
    if (only.length && !only.includes(l.id)) continue;
    const r = await page.evaluate(l.fn);
    const ok = r.ok;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${l.id}: ${l.name}${r.stuck ? `, stuck at ${r.stuck.join(', ')}` : ''}${r.hpLost > 0 ? `, lost ${r.hpLost} health` : ''}${r.note ? ` — ${r.note}` : ''}`);
  }
  console.log(`console errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
  if (errors.length) failed++;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
