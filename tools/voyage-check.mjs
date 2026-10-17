// Every sea road sailed in the game (docs/agent/WORLD_LIFE_PLAN.md, task 6): a fresh character
// takes a sloop at one dock and sails it to another with real held keys (W, and A or D by the
// heading to the next mark of the course the sea's own planner charts), in the browser game,
// the simulation stepped at 30 Hz without drawing so the crossings take minutes, not hours.
// Reports each road: in or not, the time, stalls (under 1 m/s for 3 s), the closest the hull
// came to land, and console errors. The roads: each landing's sea roads (world/harbours.js
// SEA_ROADS), else its three nearest landings, each pair once.
//   VOYAGE_URL=http://localhost:5173/ node tools/voyage-check.mjs [dock id ...]
import { chromium } from 'playwright';

const URL = process.env.VOYAGE_URL || 'http://localhost:5173/';
const only = process.argv.slice(2);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
const roads = await page.evaluate(async (only) => {
  const g = window.__unstable;
  const { RACES } = await import('/src/data/races.js');
  g.input.requestLock = () => {};
  g.startGame(g.createCharacter({ name: 'Sailor', race: RACES[0].id, look: {} }), false);
  const { G } = await import('/src/core/globals.js');
  const { ACTIONS } = await import('/src/game/hooks.js');
  window.G = G;
  for (const s of g.spawners) s.def = { ...s.def, count: 0 };
  setInterval(() => { for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true; }, 300);
  const L = ACTIONS.worldLife && ACTIONS.worldLife();
  if (L) for (const k in L.timers) L.timers[k] = 1e9;
  if (L) for (const k of ['column', 'convoy', 'sounding', 'skirmish', 'hunters', 'cutter', 'checkpoint', 'seaConvoy', 'falseConvoy', 'beset', 'drift']) L.timers[k] = 1e9;
  g.player.invulnerable = true;
  const docks = g.world.docks;
  const SEA_ROADS = { dock_north: ['dock_hush', 'dock_anchor', 'dock_salt'], dock_anchor: ['dock_north', 'dock_salt'], dock_ebb: ['dock_salt'] };
  const ids = Object.keys(docks);
  const pairs = new Map();
  for (const a of ids) {
    const to = SEA_ROADS[a] || ids.filter((b) => b !== a).sort((p, q) => docks[a].end.distanceTo(docks[p].end) - docks[a].end.distanceTo(docks[q].end)).slice(0, 3);
    for (const b of to) if (docks[b]) pairs.set([a, b].sort().join('|'), [a, b]);
  }
  return [...pairs.values()].filter(([a, b]) => !only.length || only.includes(a) || only.includes(b));
}, only);
console.log(`${roads.length} sea roads`);
let failed = 0;
for (const [from, to] of roads) {
  const r = await page.evaluate(async ([from, to]) => {
    const g = window.__unstable, p = g.player, I = g.input;
    const { Boat } = await import('/src/entities/boat.js');
    const { seaCourse } = await import('/src/game/travel.js');
    const docks = g.world.docks;
    if (p.boat) p.leaveBoat();
    for (const b of g.boats.filter((b) => b.voyage)) { b.dispose(); g.boats.splice(g.boats.indexOf(b), 1); }
    const path = seaCourse(docks[from], docks[to]);
    if (!path) return { why: 'no course' };
    const a = path[0];
    const boat = new Boat(a, Math.atan2(path[1].x - a.x, path[1].z - a.z), 'sloop');
    boat.voyage = true;
    g.boats.push(boat);
    p.enterBoat(boat);
    let i = 1, t = 0, stall = 0, stalled = false, stalls = 0, land = Infinity, dist = 0, last = boat.pos.clone();
    const T = g.world.terrain;
    const DT = 1 / 30, LIMIT = 360;
    while (t < LIMIT) {
      for (let k = 0; k < 60 && t < LIMIT; k++) {
        t += DT;
        const w = path[i];
        const dx = w.x - boat.pos.x, dz = w.z - boat.pos.z;
        if (Math.hypot(dx, dz) < (i === path.length - 1 ? 16 : 18)) {
          if (i === path.length - 1) { I.down.clear(); return { in: true, t, stalls, land, dist, marks: path.length }; }
          i++;
          continue;
        }
        let err = Math.atan2(dx, dz) - boat.yaw;
        err = Math.atan2(Math.sin(err), Math.cos(err));
        I.down.clear();
        I.down.add('KeyW');
        if (err > 0.08) I.down.add('KeyA');
        else if (err < -0.08) I.down.add('KeyD');
        g.updatePlaying(DT);
        dist += boat.pos.distanceTo(last);
        last.copy(boat.pos);
        // how near the shore the hull's middle came (the ground under it, below the sea)
        land = Math.min(land, -T.heightAt(boat.pos.x, boat.pos.z));
        // a stall: under 1 m/s for 3 s, counted once until it gets under way again
        if (Math.abs(boat.speed) < 1) {
          stall += DT;
          if (stall >= 3 && !stalled) { stalls++; stalled = true; }
        } else { stall = 0; stalled = false; }
      }
      await new Promise((res) => setTimeout(res, 0));
    }
    I.down.clear();
    return { in: false, t, stalls, land, dist, marks: path.length, at: [boat.pos.x, boat.pos.z], next: i };
  }, [from, to]);
  const ok = !!r.in;
  if (!ok) failed++;
  console.log(`${ok ? 'IN ' : 'OUT'} ${from} -> ${to}: ${r.why || `${r.in ? 'in' : 'not in'} after ${r.t.toFixed(0)} s, ${r.dist.toFixed(0)} m over ${r.marks} marks, stalls ${r.stalls}, the sea under the hull never shallower than ${r.land.toFixed(1)} m${r.in ? '' : `; stopped at ${r.at.map((v) => v.toFixed(0)).join(', ')}, mark ${r.next}`}`}`);
}
console.log(`${roads.length - failed} of ${roads.length} roads sailed; console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
