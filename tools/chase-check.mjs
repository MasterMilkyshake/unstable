// In-game navigation check: brigands chase the player through Saltreach's west gate (up the
// gatehouse stair) and round a house inside. Needs a running dev server.
//   CHASE_URL=http://localhost:5173/ node tools/chase-check.mjs [--control]
// --control swaps in the old straight-line steering, to see the stall navigation removes.
// Scenarios: "follow" (the player runs through the gate with a brigand on their heels) and
// "head start" (the player already stands behind the house when a brigand outside the walls
// sees them, then runs back out of the gate). Fails if a chasing brigand stalls for 1.5 s
// more than 4.5 m from the player, or never reaches them, or the console logs an error.
import { chromium } from 'playwright';

const URL = process.env.CHASE_URL || 'http://localhost:5173/';
const control = process.argv.includes('--control');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
let failed = false;
try {
  for (const headstart of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL, { timeout: 180000 });
    await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
    await page.evaluate(async ({ control, headstart }) => {
      const g = window.__unstable;
      const { RACES } = await import('/src/data/races.js');
      g.startGame(g.createCharacter({ name: 'Chase', race: RACES[0].id, look: {} }), false);
      const { G } = await import('/src/core/globals.js');
      const p = G.player;
      // just the player and one brigand: no spawner wakes (the town watch would join the fight)
      for (const a of G.actors) if (a !== p && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
      for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
      const ground = (x, z, y) => Math.max(g.world.terrain.heightAt(x, z), g.world.colliders.groundAt(x, z, y, 0.2));
      const route = headstart ? [[-45, 6], [-45, 6], [-45, 15], [-60, 15], [-66, 9], [-78, 8], [-92, 8]]
        : [[-95, 8], [-88, 8], [-76, 8], [-66, 9], [-61, 14.5], [-52, 15], [-45, 14], [-44, 6]];
      p.pos.set(route[0][0], ground(route[0][0], route[0][1], headstart ? 11 : 6) + 0.05, route[0][1]);
      p.vel.set(0, 0, 0);
      const [bx, bz] = headstart ? [-94, -2] : [-104, 2];
      const e = g.spawnEnemy('brigand', p.pos.clone().set(bx, ground(bx, bz, 6) + 0.1, bz));
      if (control) e.navTo = function (tx, tz, ty, speed, dt, face) { this.moveToward(tx, tz, speed, dt, face); };
      const C = (window.__chase = { e, log: [], i: 1, t: 0, go: false, reached: null, len: route.length });
      const update = g.updatePlaying.bind(g);
      g.updatePlaying = (dt) => {
        update(dt);
        p.hp = p.maxHp;
        p.iframes = Math.max(p.iframes || 0, 0.2);
        C.t += dt;
        if (!C.go && C.t > 1.5) {
          C.go = true;
          e.setAggro(p);
        }
        if (headstart && C.i === 1) {
          // wait behind the house until the brigand arrives (or 40 s pass)
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 3.6) {
            C.reached = C.t;
            C.i = 2;
          } else if (C.t > 40) C.i = route.length;
        } else if (C.go && C.i < route.length) {
          const [wx, wz] = route[C.i];
          const dx = wx - p.pos.x;
          const dz = wz - p.pos.z;
          const d = Math.hypot(dx, dz);
          if (d <= 4.6 * dt) C.i++;
          else {
            p.pos.x += (dx / d) * 4.6 * dt;
            p.pos.z += (dz / d) * 4.6 * dt;
          }
        }
        if (Math.round(C.t / dt) % 6 === 0) C.log.push([C.t, e.pos.x, e.pos.z, p.pos.x, p.pos.z, e.aggro && !e.atk && !e.stunned]);
      };
    }, { control, headstart });
    await page.waitForFunction(() => window.__chase.i >= window.__chase.len, null, { timeout: 180000 });
    await page.waitForTimeout(4000);
    const C = await page.evaluate(() => ({ log: window.__chase.log, reached: window.__chase.reached }));
    const L = C.log;
    let stall = null;
    for (let i = 0; i < L.length && !stall; i++) {
      const j = L.findIndex((r) => r[0] >= L[i][0] + 1.5);
      if (j < 0) break;
      const moved = Math.hypot(L[j][1] - L[i][1], L[j][2] - L[i][2]);
      const dist = Math.hypot(L[i][1] - L[i][3], L[i][2] - L[i][4]);
      if (L[i][5] && moved < 0.6 && dist > 4.5) stall = `stalled at ${L[i][1].toFixed(1)}, ${L[i][2].toFixed(1)} (t ${L[i][0].toFixed(1)} s, ${dist.toFixed(1)} m from the player)`;
    }
    const last = L[L.length - 1];
    const endDist = Math.hypot(last[1] - last[3], last[2] - last[4]);
    const ok = !stall && endDist < 4.5 && (!headstart || C.reached !== null) && !errors.length;
    failed ||= !ok;
    console.log(`${headstart ? 'head start' : 'follow'}${control ? ' (control: straight-line steering)' : ''}: ${ok ? 'PASS' : 'FAIL'}` +
      `${headstart ? `, reached the player behind the house ${C.reached === null ? 'never' : `at ${C.reached.toFixed(1)} s`}` : ''}` +
      `, ended ${endDist.toFixed(1)} m from the player${stall ? `, ${stall}` : ''}, console errors ${errors.length}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
