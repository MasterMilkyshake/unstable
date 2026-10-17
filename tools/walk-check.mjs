// An enemy walks a long way to a player who waits at the end, in the real world: the planner,
// the stuck watch and physics together (tools/route-check.mjs plans legs; this walks them).
//   WALK_URL=http://localhost:5173/ node tools/walk-check.mjs [route ids...] [--runs=3]
// A run fails if the walker stands still (under 1 m in 10 s) more than 6 m short of the
// player, does not arrive in time, or the console logs an error. Exits 1 on any failure.
import { chromium } from 'playwright';

const URL = process.env.WALK_URL || 'http://localhost:5173/';
const runsArg = process.argv.find((a) => a.startsWith('--runs='));
const RUNS = runsArg ? +runsArg.slice(7) : 3;
const ROUTES = [
  // the Red Trail: Rook's Landing's pier to Brigand Hold's gate, and on to Kaelen's yard
  { id: 'red-trail-gate', from: [1123, 155], to: [1348, 134], secs: 90 },
  { id: 'red-trail-yard', from: [1123, 155], to: [1400, 160], secs: 110 },
];
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const routes = only.length ? ROUTES.filter((r) => only.includes(r.id)) : ROUTES;
let failed = 0;
for (const r of routes) {
  for (let run = 1; run <= RUNS; run++) {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
    });
    const errors = [];
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(URL, { timeout: 180000 });
      await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
      const out = await page.evaluate(async ({ from, to, secs }) => {
        const g = __unstable, w = g.world, T = w.terrain;
        g.input.requestLock = () => {};
        g.startGame(g.createCharacter({ name: 'Walker', race: 'ashkin', look: { height: 1 } }), false);
        const { G } = await import('/src/core/globals.js');
        for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
        for (const a of G.actors) if (a !== G.player && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
        const p = G.player;
        const groundY = (x, z) => { const t = T.heightAt(x, z); return Math.max(t, w.colliders.groundAt(x, z, Math.max(t, 0) + 2.5, 0.21)); };
        p.pos.set(to[0], groundY(to[0], to[1]) + 0.05, to[1]);
        const e = g.spawnEnemy('brigand', p.pos.clone().set(from[0], groundY(from[0], from[1]) + 0.1, from[1]));
        e.spec = { ...e.spec, leash: 9999, aggro: 9999 };
        e.home.set(to[0], 0, to[1]);
        let t = 0;
        let mark = [0, e.pos.x, e.pos.z];
        let stall = null;
        const upd = g.updatePlaying.bind(g);
        g.updatePlaying = (dt) => {
          p.hp = p.maxHp;
          p.iframes = 1;
          e.setAggro(p);
          e.ai.atkCd = 99;
          upd(dt);
          t += dt;
          if (t - mark[0] > 10) {
            if (!stall && Math.hypot(e.pos.x - mark[1], e.pos.z - mark[2]) < 1 && Math.hypot(e.pos.x - to[0], e.pos.z - to[1]) > 6) stall = [mark[1], e.pos.y, mark[2]].map((v) => +v.toFixed(1));
            mark = [t, e.pos.x, e.pos.z];
          }
        };
        // read the result when the run ends: a brigand that has arrived goes on to circle the player
        return await new Promise((res) => {
          const iv = setInterval(() => {
            const left = Math.hypot(e.pos.x - to[0], e.pos.z - to[1]);
            if (stall || t > secs || left < 4) {
              clearInterval(iv);
              res({ t: +t.toFixed(1), left: +left.toFixed(1), arrived: left < 4, stall });
            }
          }, 100);
        });
      }, r);
      const ok = !out.stall && out.arrived && !errors.length;
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${r.id} run ${run}: ${out.arrived ? `arrived in ${out.t} s` : `${out.left} m short after ${out.t} s`}${out.stall ? `, stalled at ${out.stall.join(', ')}` : ''}, console errors ${errors.length}`);
    } finally {
      await browser.close();
    }
  }
}
process.exit(failed ? 1 : 0);
