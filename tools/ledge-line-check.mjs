// Every authored climbing line (data/ledges.js) climbed in the real game with real input: a
// fresh Power 1 character stands at the line's foot facing the face, holds W, jumps when it
// stalls against a riser, presses jump again at the top of each rise (a hop up the wall) and,
// hanging from an edge, leaps with W held. That is as well as a player can play the ledges
// (ADR-007). Each line is tried at three latches (the fresh character), and, for lines whose
// chain is longer, at the latches the chain names: a short line is climbed by the fresh
// character, a long one stops it and is climbed with the latches it needs. Then each hidden way
// up (a scaffold) is walked to its top along its stair's own flights, then over its bridge.
//
//   node tools/ledge-line-check.mjs [line id ...]
//
// LEDGE_URL overrides http://localhost:5173; CHROME_PATH picks Chrome. Exits 1 if a line is not
// climbed at its chain, or a long line is climbed at three, or the page logs an error.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const url = process.env.LEDGE_URL || 'http://localhost:5173';
const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined);
const only = process.argv.slice(2);

const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|fonts\.g/.test(m.text())) errors.push(m.text()); });
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
    setInterval(() => { for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true; }, 200);
    g.player.invulnerable = true;
  });
  const lines = await page.evaluate(() => __unstable.world.ledgeLines.map((l) => ({ id: l.def.id, chain: l.def.chain })));
  for (const { id, chain } of lines.filter((l) => !only.length || only.some((p) => l.id.startsWith(p)))) {
    const tries = chain > 3 ? [3, chain] : [3];
    for (const latches of tries) {
      const attempt = () => page.evaluate(async ([id, latches]) => {
        const g = __unstable, w = g.world, p = g.player, I = g.input;
        const l = w.ledgeLines.find((x) => x.def.id === id);
        const top = l.treads[l.treads.length - 1];
        const base = p.derived.latches;
        p.derived.latches = latches;
        // nothing left over from the last line: no foe about, no cooldown, no stagger
        const { G } = await import('/src/core/globals.js');
        for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true;
        p.pos.set(l.start.x, w.groundAt(l.start.x, l.start.z, l.start.y + 2) + 0.05, l.start.z);
        p.vel.set(0, 0, 0);
        p.climbing = false;
        p.latches = 0;
        p.latchCd = 0;
        p.vaultT = 0;
        p.stunT = 0;
        p.hp = p.maxHp;
        g.camYaw = l.def.yaw;
        await new Promise((r) => setTimeout(r, 200));
        const res = await new Promise((resolve) => {
          let t = 0, lastVy = 0, still = 0, hangT = 0, best = p.pos.y, most = 0, last = [p.pos.x, p.pos.z];
          const update = g.updatePlaying.bind(g);
          g.updatePlaying = (dt) => {
            t += dt;
            g.camYaw = l.def.yaw;
            I.down.add('KeyW');
            const moved = Math.hypot(p.pos.x - last[0], p.pos.z - last[1]);
            last = [p.pos.x, p.pos.z];
            still = p.grounded && moved < 0.02 ? still + dt : 0;
            if (p.grounded && still > 0.15) { I.pressed.add('Space'); still = 0; }
            if (!p.grounded && !p.climbing && lastVy > 0 && p.vel.y <= 0) I.pressed.add('Space');
            if (p.climbing && (hangT += dt) > 0.12) { I.pressed.add('Space'); hangT = 0; }
            if (!p.climbing) hangT = 0;
            lastVy = p.vel.y;
            most = Math.max(most, p.latches);
            if (p.grounded) best = Math.max(best, p.pos.y);
            const there = p.grounded && Math.abs(p.pos.y - top.y) < 0.3;
            if (there || t > 30) {
              I.down.delete('KeyW');
              g.updatePlaying = update;
              resolve({ there, secs: +t.toFixed(1), best: +best.toFixed(2), top: +top.y.toFixed(2), most });
              return update(dt);
            }
            update(dt);
          };
        });
        p.derived.latches = base;
        return res;
      }, [id, latches]);
      const expect = latches >= chain;
      // a second attempt where the first fell short of what it should do (a stray blow
      // knocks a climber off): both are reported
      let r = await attempt(), retried = null;
      if (r.there !== expect) {
        retried = r;
        r = await attempt();
      }
      const ok = r.there === expect;
      if (!ok) failed++;
      console.log(`${ok ? 'OK' : 'FAILED'} ${id} (chain ${chain}) at ${latches} latches: ${r.there ? `climbed to ${r.top} m in ${r.secs} s, at most ${r.most} latches in one go` : `stopped at ${r.best} m of ${r.top} m after ${r.secs} s`}${expect ? '' : ' (as it should be)'}${retried ? ` (second attempt; the first ${retried.there ? 'climbed' : `stopped at ${retried.best} m`})` : ''}`);
    }
  }
  // the hidden ways up (data/ledges.js LEDGE_STAIRS): walked, not climbed, by a fresh character
  // holding W from the stair's foot to its top
  const stairs = await page.evaluate(() => (__unstable.world.ledgeStairs || []).map((s) => s.def.id));
  for (const id of stairs.filter((x) => !only.length || only.some((p) => x.startsWith(p)))) {
    const r = await page.evaluate(async (id) => {
      const g = __unstable, w = g.world, p = g.player, I = g.input;
      const { navGrid, navBody } = await import('/src/entities/nav.js');
      const s = w.ledgeStairs.find((x) => x.def.id === id);
      const [fx, fz] = s.foot ? [s.foot.x, s.foot.z] : s.def.foot;
      p.derived.latches = 3;
      p.pos.set(fx, w.groundAt(fx, fz, w.terrain.heightAt(fx, fz) + 2) + 0.05, fz);
      p.vel.set(0, 0, 0);
      p.climbing = false;
      p.hp = p.maxHp;
      // a scaffold's own way up: its stair's flights corner to corner, to the stair's head, then
      // out over the bridge (the planner's routes hug a stair's open edge, away from the tower)
      let hops;
      const path = s.station && s.station.path;
      if (path && path.length > 3) hops = [...path.slice(0, path.length - 2).map((q) => [q.x, q.z]), [s.end.x, s.end.z]];
      else {
        const route = navGrid(w).findPath(p.pos.x, p.pos.z, p.pos.y, s.end.x, s.end.z, s.top, navBody(p), 200000);
        if (!route || !route.complete) return { there: false, why: 'no planned route', top: s.top };
        hops = route.points.map((q) => [q[0], q[2]]);
      }
      return await new Promise((resolve) => {
        let t = 0, best = p.pos.y, last = [p.pos.x, p.pos.z], still = 0;
        const update = g.updatePlaying.bind(g);
        g.updatePlaying = (dt) => {
          t += dt;
          while (hops.length > 1 && Math.hypot(hops[0][0] - p.pos.x, hops[0][1] - p.pos.z) < 0.4) hops.shift();
          g.camYaw = Math.atan2(hops[0][0] - p.pos.x, hops[0][1] - p.pos.z);
          I.down.add('KeyW');
          const moved = Math.hypot(p.pos.x - last[0], p.pos.z - last[1]);
          last = [p.pos.x, p.pos.z];
          still = p.grounded && moved < 0.02 ? still + dt : 0;
          if (still > 0.4) { I.pressed.add('Space'); still = 0; }
          if (p.grounded) best = Math.max(best, p.pos.y);
          const there = p.grounded && Math.abs(p.pos.y - s.top) < 0.6 && Math.hypot(p.pos.x - s.end.x, p.pos.z - s.end.z) < 2.5;
          if (there || t > 60) {
            I.down.delete('KeyW');
            g.updatePlaying = update;
            resolve({ there, secs: +t.toFixed(1), best: +best.toFixed(2), top: +s.top.toFixed(2), at: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)), end: [s.end.x, s.end.z].map((v) => +v.toFixed(1)), left: hops.length, endGround: +w.groundAt(s.end.x, s.end.z, s.top + 2).toFixed(2) });
            return update(dt);
          }
          update(dt);
        };
      });
    }, id);
    if (!r.there) failed++;
    console.log(`${r.there ? 'OK' : 'FAILED'} ${id} (hidden way up) walked at 3 latches: ${r.there ? `reached its top at ${r.top} m in ${r.secs} s` : `${r.why || `stopped at ${r.best} m of ${r.top} m after ${r.secs} s`}`}${process.env.LEDGE_DEBUG ? ' ' + JSON.stringify(r) : ''}`);
  }
} finally {
  await browser.close();
}
console.log(`${failed ? failed + ' failed' : 'every line as its chain says'}; console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
process.exitCode = failed || errors.length ? 1 : 0;
