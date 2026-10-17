// The walks a player takes through an area, planned on the real world (every collider the game
// builds, the Rift included) by the navigation grid enemies use, with a player-sized body:
// a leg that cannot be completed is a dead end or a blocker on that walk.
//
//   node tools/route-check.mjs [area or route-id prefix ...]
//
// ROUTE_URL overrides http://localhost:5173; CHROME_PATH picks Chrome. Waypoints are placed
// world coordinates (read from the running game, not src/data), each leg under the planner's
// 160 m reach. Prints each leg's planned length against the straight line and, for a leg that
// stops short, where it stopped. Exits 1 if any leg is incomplete.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const url = process.env.ROUTE_URL || 'http://localhost:5173';
const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined);
const only = process.argv.slice(2);

export const ROUTES = [
  // ---------------------------------------------------------------- the Wash to Saltreach
  { id: 'wash-to-town', area: 'wash', name: "the Wash's camp up the bay's east shore and through the sea gate to the Lantern Tree",
    pts: [[-4, -346], [0, -322], [-30, -280], [-34, -220], [-30, -160], [4, -104], [0, -40], [0, 0]] },
  { id: 'wash-abbey', area: 'wash', name: 'the Wash to Seamspire Abbey', pts: [[-4, -346], [-80, -340], [-150, -322]] },
  { id: 'wash-barrow', area: 'wash', name: 'the Wash to the Oar Barrow and the Wash Prospect', pts: [[-4, -346], [-100, -300], [-186, -238], [-176, -244]] },
  // ---------------------------------------------------------------- Thornwood
  { id: 'thorn-hold', area: 'thorn', name: "Rook's Landing pier along the Red Trail into Brigand Hold, to Kaelen's yard",
    pts: [[1123, 155], [1144, 144], [1187, 148], [1235, 135], [1300, 132], [1348, 134], [1400, 160]] },
  { id: 'thorn-owlroost', area: 'thorn', name: "Rook's Landing to Owlroost Hollow and the Widowneedles", pts: [[1187, 148], [1230, 60], [1240, -25], [1215, -110]] },
  { id: 'thorn-watchfire', area: 'thorn', name: 'Brigand Hold to the Redwake Watchfire', pts: [[1348, 134], [1430, 200], [1500, 248]] },
  { id: 'thorn-tollarch', area: 'thorn', name: "Owlroost Hollow to the Tollkeeper's Arch", pts: [[1240, -25], [1360, -150], [1515, -255]] },
  { id: 'thorn-seacave', area: 'thorn', name: 'Brigand Hold to the sea-cave', pts: [[1400, 160], [1500, 180], [1583, 196]] },
  // ---------------------------------------------------------------- the Rift
  { id: 'rift-lift', area: 'rift', name: 'the arrival shelf through the south gate to the base lift', pts: [[6000, 5832], [6000, 5900], [6000, 5961], [6008, 6010]] },
  { id: 'rift-landing', area: 'rift', name: "the arrival shelf by the scholars' path and the east road, through the long wall's postern to the Landing That Never Came",
    pts: [[6000, 5832], [5967, 5857], [5904, 5872], [5888, 5912], [5862, 5950], [5870, 5990], [5874, 6040], [5874, 6100], [5884, 6170], [5900, 6152]] },
];

const routes = only.length ? ROUTES.filter((r) => only.some((p) => r.area === p || r.id.startsWith(p))) : ROUTES;
const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
  await page.evaluate(() => {
    const g = __unstable;
    g.input.requestLock = () => {};
    g.startGame(g.createCharacter({ name: 'Walker', race: 'ashkin', look: { height: 1 } }), false);
  });
  for (const r of routes) {
    const legs = await page.evaluate(async (pts) => {
      const g = __unstable, w = g.world, T = w.terrain;
      const { navGrid, navBody } = await import('/src/entities/nav.js');
      const nav = navGrid(w); // no stamp: an unlimited budget
      const body = navBody({ radius: 0.4, height: 1.8 });
      // the walkable surface at a point: the ground, or a deck over water (a pier stands over the sea bed)
      const groundY = (x, z) => { const t = T.heightAt(x, z); return Math.max(t, w.colliders.groundAt(x, z, Math.max(t, 0) + 2.5, 0.21)); };
      const out = [];
      let y = groundY(...pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        const route = nav.findPath(ax, az, y, bx, bz, NaN, body, 60000);
        const p = route ? route.points : [];
        let len = 0, px = ax, pz = az;
        for (const q of p) { len += Math.hypot(q[0] - px, q[2] - pz); px = q[0]; pz = q[2]; }
        const end = p.length ? p[p.length - 1] : [ax, y, az];
        out.push({ from: [ax, az], to: [bx, bz], complete: !!(route && route.complete), straight: +Math.hypot(bx - ax, bz - az).toFixed(1),
          length: +len.toFixed(1), stopped: route && route.complete ? null : [end[0], end[1], end[2]].map((n) => +n.toFixed(1)),
          short: +Math.hypot(bx - end[0], bz - end[2]).toFixed(1) });
        y = end[1];
      }
      return out;
    }, r.pts);
    const ok = legs.every((l) => l.complete);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.name}`);
    for (const l of legs) {
      console.log(`  ${l.complete ? 'ok     ' : 'BLOCKED'} ${l.from.join(', ')} -> ${l.to.join(', ')}  ${l.length} m planned / ${l.straight} m straight${l.complete ? '' : `, stopped at ${l.stopped.join(', ')} (${l.short} m short)`}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`${routes.length - failed} of ${routes.length} routes complete; console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
process.exitCode = failed || errors.length ? 1 : 0;
