// Can a fresh character get to a place on its own feet? From up to eight points on a ring round
// the target, a Power 1 character steers straight at it with real input (W and sprint held,
// a jump whenever it stalls, which catches a ledge or hops a wall, and a leap from every hang;
// through a trail's waypoints when
// the target lists them), with enemies kept away and no
// damage taken. tools/route-check.mjs plans with the enemies' walking grid; this asks the
// player's own controller, which also climbs by ledges (ADR-007) and takes slopes the grid
// refuses.
//
//   node tools/reach-check.mjs [target id ...]
//
// REACH_URL overrides http://localhost:5173; CHROME_PATH picks Chrome. Reached means within
// 3 m across and 2.5 m in height of the target. Exits 1 if a target is reached from no side.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const url = process.env.REACH_URL || 'http://localhost:5173';
const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined);
const only = process.argv.slice(2);

// placed world positions (an interactable at the place: its chest or its record)
export const TARGETS = [
  { id: 'oar-barrow', name: 'the Oar Barrow above the Wash (its chest)', at: [-185.2, 16.9, -238.8], ring: 34 },
  { id: 'redwake-watchfire', name: 'the Redwake Watchfire (its chest)', at: [1506.2, 27.2, 252.2], ring: 34 },
  // the upland the Watchfire stands on, from the lower ground east of it (toward the Hold)
  { id: 'redwake-ridge-east', name: "the Watchfire's upland, its east brow", at: [1424, 26, 272], from: [[1396, 250], [1398, 272], [1400, 300], [1405, 230], [1440, 222]] },
  // Act I's way in: up the Red Trail from Rook's Landing to Brigand Hold's gate, and to the yard
  { id: 'brigand-hold-gate', name: "Brigand Hold's gate, up the Red Trail from Rook's Landing", at: [1302, 12, 132], from: [[1194, 148]],
    via: [[1212, 144], [1235, 135], [1262, 128], [1290, 126]] },
  { id: 'brigand-hold-yard', name: "Kaelen's yard inside Brigand Hold, from the gate", at: [1348, 13, 134], from: [[1302, 132]] },
  { id: 'tollkeepers-arch', name: "the Tollkeeper's Arch (its toll plate)", at: [1522.1, 4.2, -261.4], ring: 34 },
];
const SECS = 25;

const targets = only.length ? TARGETS.filter((t) => only.some((p) => t.id.startsWith(p))) : TARGETS;
const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = __unstable;
    g.input.requestLock = () => {};
    g.settings.master = 0;
    g.applySettings();
    g.startGame(g.createCharacter({ name: 'Climber', race: 'ashkin', look: { height: 1 } }), false);
    const { G } = await import('/src/core/globals.js');
    for (const s of g.spawners) s.def = { ...s.def, count: 0 };
    setInterval(() => { for (const a of G.actors) if (a.team === 'enemy') a.despawn = true; }, 200);
    g.player.invulnerable = true;
  });
  for (const t of targets) {
    const tries = await page.evaluate(async ([t, SECS]) => {
      const g = __unstable, w = g.world, T = w.terrain, p = g.player, I = g.input;
      const out = [];
      const starts = t.from || [...Array(8)].map((_, k) => [t.at[0] + Math.sin((k / 8) * Math.PI * 2) * t.ring, t.at[2] + Math.cos((k / 8) * Math.PI * 2) * t.ring]);
      for (let k = 0; k < starts.length; k++) {
        const [sx, sz] = starts[k];
        const sy = T.heightAt(sx, sz);
        if (sy < 0.2) { out.push({ dir: k, skipped: 'water' }); continue; }
        p.pos.set(sx, w.groundAt(sx, sz, sy + 1) + 0.1, sz);
        p.vel.set(0, 0, 0);
        p.climbStamina = 3;
        const r = await new Promise((resolve) => {
          const E = { t: 0, best: Infinity, top: p.pos.y, climbed: false, last: null, stillT: 0, via: (t.via || []).map((q) => [...q]) };
          const update = g.updatePlaying.bind(g);
          g.updatePlaying = (dt) => {
            E.t += dt;
            const dx = t.at[0] - p.pos.x, dz = t.at[2] - p.pos.z, across = Math.hypot(dx, dz), up = Math.abs(t.at[1] - p.pos.y);
            E.best = Math.min(E.best, across + Math.max(0, up - 2.5));
            E.top = Math.max(E.top, p.pos.y);
            E.climbed ||= p.climbing;
            if ((across < 3 && up < 2.5) || E.t > SECS) {
              I.down.delete('KeyW'); I.down.delete('ShiftLeft');
              g.updatePlaying = update;
              resolve({ reached: across < 3 && up < 2.5, secs: +E.t.toFixed(1), best: +E.best.toFixed(1), top: +E.top.toFixed(1), climbed: E.climbed });
              return update(dt);
            }
            // through the target's waypoints first, if it has any (a trail to follow)
            while (E.via.length && Math.hypot(E.via[0][0] - p.pos.x, E.via[0][1] - p.pos.z) < 2.5) E.via.shift();
            const [hx, hz] = E.via.length ? E.via[0] : [t.at[0], t.at[2]];
            g.camYaw = Math.atan2(hx - p.pos.x, hz - p.pos.z);
            I.down.add('KeyW');
            if (!p.climbing) I.down.add('ShiftLeft'); else I.down.delete('ShiftLeft');
            // stalled for half a second: jump (a jump at a wall starts a climb)
            if (E.last && Math.hypot(p.pos.x - E.last[0], p.pos.z - E.last[1]) < 0.15 * dt * 60 * 0.5) E.stillT += dt; else E.stillT = 0;
            E.last = [p.pos.x, p.pos.z];
            if (E.stillT > 0.5 && !p.climbing) { I.pressed.add('Space'); E.stillT = 0; }
            // hanging from a ledge (ADR-007): leap up from it after a moment
            if (p.climbing && (E.hangT = (E.hangT || 0) + dt) > 0.4) { I.pressed.add('Space'); E.hangT = 0; }
            update(dt);
          };
        });
        out.push({ dir: k, from: [sx, sy, sz].map((n) => +n.toFixed(1)), ...r });
      }
      return out;
    }, [t, SECS]);
    const reached = tries.filter((r) => r.reached);
    if (!reached.length) failed++;
    console.log(`${reached.length ? 'REACHED' : 'NOT REACHED'} ${t.id}: ${t.name} at ${t.at.join(', ')}; from ${reached.length} of ${tries.filter((r) => !r.skipped).length} sides`);
    for (const r of tries) {
      if (r.skipped) { console.log(`  side ${r.dir}: start in the ${r.skipped}`); continue; }
      console.log(`  side ${r.dir} from ${r.from.join(', ')}: ${r.reached ? `there in ${r.secs} s` : `${r.best} m off after ${r.secs} s`}, highest y ${r.top}${r.climbed ? ', climbed' : ''}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`${targets.length - failed} of ${targets.length} places reached; console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
process.exitCode = failed || errors.length ? 1 : 0;
