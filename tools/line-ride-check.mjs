// Every carrier line ridden in the real game with real input: a fresh Power 1 character is set
// on the line's start floor beside its trolley, presses [E], and must be carried along the
// cable and set down on the far floor within the time the ride should take. For a line whose
// start stands on a station, the character first walks up the station's stair from its foot
// (held W, steered along the stair's corners, which the station reports). Enemies are kept away; nothing else is helped.
//
//   node tools/line-ride-check.mjs [line id ...]
//
// RIDE_URL overrides http://localhost:5173; CHROME_PATH picks Chrome. Exits 1 if a ride fails
// or the page logs an error.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const url = process.env.RIDE_URL || 'http://localhost:5173';
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
    g.startGame(g.createCharacter({ name: 'Rider', race: 'ashkin', look: { height: 1 } }), false);
    const { G } = await import('/src/core/globals.js');
    for (const s of g.spawners) s.def = { ...s.def, count: 0 };
    setInterval(() => { for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true; }, 200);
    g.player.invulnerable = true;
  });
  const ids = await page.evaluate(() => __unstable.world.carrierLines.map((l) => l.def.id));
  for (const id of ids.filter((i) => !only.length || only.some((p) => i.startsWith(p)))) {
    const r = await page.evaluate(async (id) => {
      const g = __unstable, w = g.world, p = g.player, I = g.input;
      const line = w.carrierLines.find((l) => l.def.id === id);
      const { curve } = line;
      const station = (w.lineStations || []).find((s) => s.def.id === line.def.a.station);
      // up the station's stair on foot: steer at each next tread above the feet
      let climbed = null;
      if (station) {
        const f = station.foot;
        p.pos.set(f.x, w.groundAt(f.x, f.z, f.y + 2) + 0.05, f.z);
        p.vel.set(0, 0, 0);
        climbed = await new Promise((resolve) => {
          let t = 0;
          const via = station.path.slice(1).map((q) => [q.x, q.z]);
          const update = g.updatePlaying.bind(g);
          g.updatePlaying = (dt) => {
            t += dt;
            // along the stair's own line, corner by corner
            while (via.length > 1 && Math.hypot(via[0][0] - p.pos.x, via[0][1] - p.pos.z) < 0.6) via.shift();
            const best = via[0];
            const onTop = Math.abs(p.pos.y - curve.floorA) < 0.3 && Math.hypot(p.pos.x - curve.a.x, p.pos.z - curve.a.z) < 3;
            if (onTop || t > 40) {
              I.down.delete('KeyW');
              g.updatePlaying = update;
              resolve({ ok: onTop, secs: +t.toFixed(1), y: +p.pos.y.toFixed(2) });
              return update(dt);
            }
            const [hx, hz] = best || [curve.a.x, curve.a.z];
            g.camYaw = Math.atan2(hx - p.pos.x, hz - p.pos.z);
            I.down.add('KeyW');
            update(dt);
          };
        });
        if (!climbed.ok) return { id, climbed };
      } else {
        p.pos.set(curve.a.x, curve.floorA + 0.05, curve.a.z);
      }
      // beside the trolley, press E
      p.pos.set(curve.a.x - curve.dir.x * 0.6, curve.floorA + 0.05, curve.a.z - curve.dir.z * 0.6);
      p.vel.set(0, 0, 0);
      await new Promise((r) => setTimeout(r, 300));
      return await new Promise((resolve) => {
        let t = 0, pressed = false, started = false, minFeet = Infinity;
        const update = g.updatePlaying.bind(g);
        g.updatePlaying = (dt) => {
          t += dt;
          if (!pressed) { I.pressed.add('KeyE'); pressed = true; }
          if (p.zip) {
            started = true;
            minFeet = Math.min(minFeet, p.pos.y - w.terrain.heightAt(p.pos.x, p.pos.z));
          }
          const landed = started && !p.zip && p.grounded;
          if (landed || t > curve.len / line.def.speed + 12) {
            g.updatePlaying = update;
            resolve({
              id, climbed, started, landed, secs: +t.toFixed(1),
              off: +Math.hypot(p.pos.x - curve.b.x, p.pos.z - curve.b.z).toFixed(2), dy: +(p.pos.y - curve.floorB).toFixed(2),
              clear: +minFeet.toFixed(2), len: +curve.len.toFixed(0), hp: Math.round(p.hp),
            });
            return update(dt);
          }
          update(dt);
        };
      });
    }, id);
    const ok = r.landed && r.off < 3 && Math.abs(r.dy) < 0.5;
    if (!ok) failed++;
    console.log(`${ok ? 'RODE' : 'FAILED'} ${id}: ${r.climbed ? `stair ${r.climbed.ok ? `climbed in ${r.climbed.secs} s` : `stuck at y ${r.climbed.y}`}, ` : ''}${r.started ? `ride ${r.len} m in ${r.secs} s, set down ${r.off} m from the landing (dy ${r.dy}), feet at least ${r.clear} m over the ground` : 'the ride never started'}`);
  }
} finally {
  await browser.close();
}
console.log(`${failed ? failed + ' failed' : 'all rode'}; console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
process.exitCode = failed || errors.length ? 1 : 0;
