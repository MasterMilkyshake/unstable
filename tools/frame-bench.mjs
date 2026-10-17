// Frame-time bench (docs/agent/QA_AND_BENCHMARKS.md): the baseline places, Rift arrival, and
// every frame from the world's first showing through game start and a first fight.
//   BENCH_URL=http://localhost:5173/ node tools/frame-bench.mjs [places|arrival|all|start] [runs]
// System Chrome, ANGLE/Metal, vsync off, 1600x900, noon. Headless Chrome on a shared machine is
// noisy: compare builds in interleaved runs, not against old numbers.
//   places:  at each place, 5 s of frames after 3.5 s to settle: fps, p50/p95/p99/max, draw
//            calls, triangles, JS heap. The North Road and Widow Ridge are measured with a
//            convoy and a column on screen on a build with the world's life (game/worldLife.js;
//            on one without it, the place as it is); no other world event starts meanwhile.
//   arrival: a fresh browser per run (pages of one origin can share a renderer process, and
//            the last run's heap then lands its GC in the next); a character at the Wash
//            enters the Rift. Over the arrival
//            window (the arrival frame, one before, five after): the worst frame interval, the
//            worst main-thread work in one frame (simulation, UI, camera, effects, render
//            calls), shader programs compiled and vertex data uploaded.
//   start:   vsync on (a hitch is judged at the display's pace), a fresh browser per run. Every
//            frame from the moment the world is shown: 4 s of main menu, game start, 5 s of play,
//            then a first fight with one mantra of every behaviour cast at a brigand, one a
//            second. Reports the worst frame, the frames over 50 ms and what was happening, and
//            shader programs linked after the world was shown. Not part of `all`.
import { chromium } from 'playwright';

const URL = process.env.BENCH_URL || 'http://localhost:5173/';
const mode = process.argv[2] || 'all';
const runs = Number(process.argv[3] || 3);
const vsync = mode === 'start';
const launch = () => chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', ...(vsync ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit'])],
});
let browser = await launch();
const errors = [];

async function start() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
  const bootS = (Date.now() - t0) / 1000;
  await page.evaluate(async () => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    g.startGame(g.createCharacter({ name: 'Bench', race: RACES[0].id, look: {} }), false);
    const sky = g.world.sky;
    const update = sky.update.bind(sky);
    sky.update = (dt, ...rest) => {
      sky.time = 0.42;
      return update(0, ...rest);
    };
  });
  return { page, bootS };
}

try {
  if (mode === 'places' || mode === 'all') {
    const { page, bootS } = await start();
    console.log(`boot to world ${bootS.toFixed(1)} s`);
    const npc = (id) => page.evaluate((id) => {
      const n = window.__unstable.npcs.find((n) => (n.id || n.def?.id) === id);
      return n && [n.pos.x, n.pos.z];
    }, id);
    const places = [
      ['The Wash (spawn)', [-4, -346]],
      ["Sage's Rise, Saltreach (Ilvar)", await npc('ilvar')],
      ['Watch Barracks, Saltreach (Hale)', await npc('hale')],
      ['The Lantern Tree, Saltreach', [0, 0]],
      // facing the way each event comes, on every build: the convoy sets out from the town gate,
      // the column marches the Garrison Road on the ridge's east side
      ['The North Road, a Watch convoy', [-20, 300], 'convoy', [-1, 141]],
      ['Widow Ridge, an Enclave column', [1238, -205], 'column', [1330, -205]],
      ['Rift spawn', [6000, 5830]],
    ];
    // no world event starts on its own while the bench runs
    await page.evaluate(async () => {
      const { ACTIONS } = await import('/src/game/hooks.js');
      const L = ACTIONS.worldLife && ACTIONS.worldLife();
      if (L) for (const k of ['column', 'convoy', 'sounding', 'skirmish', 'hunters', 'cutter', 'checkpoint', 'seaConvoy', 'falseConvoy', 'beset', 'drift']) L.timers[k] = 1e9;
    });
    for (const [name, at, life, face] of places) {
      if (!at) {
        console.log(`${name}: not found`);
        continue;
      }
      await page.evaluate(([x, z]) => {
        const g = window.__unstable;
        const p = g.player;
        p.pos.set(x, g.world.groundAt(x, z, 400) + 0.2, z);
        p.vel.set(0, 0, 0);
        p.fallStart = p.pos.y;
        g.inRift = g.world.inRift(x);
      }, at);
      // a place with a facing is measured facing it; the rest keep the camera as it falls
      if (face) await page.evaluate(([x, z]) => { const g = window.__unstable; g.camYaw = Math.atan2(x - g.player.pos.x, z - g.player.pos.z); }, face);
      // the place's event, on screen
      // the place's event, raised until it stands in the view (within 50 degrees of the facing)
      const raised = life ? await page.evaluate(async (life) => {
        const g = window.__unstable;
        const { ACTIONS } = await import('/src/game/hooks.js');
        if (!ACTIONS.forceLife) return 'no world life';
        const L = ACTIONS.worldLife();
        const { endEvent } = await import('/src/game/worldLife.js');
        const clear = () => { for (const ev of L.active.slice()) endEvent(g, ev, 'bench'); };
        for (let i = 0; i < 12; i++) {
          clear();
          const ev = ACTIONS.forceLife(life);
          if (!ev) continue;
          const at = ev.cart ? ev.cart.object.position : ev.members[0].pos;
          let off = Math.atan2(at.x - g.player.pos.x, at.z - g.player.pos.z) - g.camYaw;
          off = Math.atan2(Math.sin(off), Math.cos(off));
          if (Math.abs(off) < 0.87) return `${life} of ${ev.members.length}, ${Math.round(Math.hypot(at.x - g.player.pos.x, at.z - g.player.pos.z))} m off`;
        }
        clear();
        return 'not in view';
      }, life) : null;
      if (raised) await page.waitForTimeout(2500);
      await page.waitForTimeout(3500);
      const r = await page.evaluate(() => new Promise((res) => {
        const g = window.__unstable;
        g.renderer.info.autoReset = false;
        const t = [];
        const calls = [];
        const tris = [];
        let last = performance.now();
        const end = last + 5000;
        const tick = (now) => {
          t.push(now - last);
          last = now;
          calls.push(g.renderer.info.render.calls);
          tris.push(g.renderer.info.render.triangles);
          g.renderer.info.reset();
          if (now < end) requestAnimationFrame(tick);
          else res({ t, calls, tris, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1 });
        };
        g.renderer.info.reset();
        requestAnimationFrame(tick);
      }));
      const ft = r.t.slice(5).sort((a, b) => a - b);
      const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
      const q = (p) => ft[Math.min(ft.length - 1, Math.floor(ft.length * p))].toFixed(1);
      const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
      if (life) await page.evaluate(async () => {
        const { ACTIONS } = await import('/src/game/hooks.js');
        if (!ACTIONS.worldLife) return;
        const { endEvent } = await import('/src/game/worldLife.js');
        for (const ev of ACTIONS.worldLife().active.slice()) endEvent(window.__unstable, ev, 'bench');
      });
      console.log(`${name}${raised ? ` [${raised}]` : ''}: ${(1000 / avg).toFixed(0)} fps, p50/p95/p99/max ${q(0.5)}/${q(0.95)}/${q(0.99)}/${ft.at(-1).toFixed(1)} ms, ~${med(r.calls)} draw calls, ${(med(r.tris) / 1e6).toFixed(1)} M tris, heap ${r.heap} MB`);
    }
    await page.close();
  }

  if (mode === 'arrival' || mode === 'all') {
    for (let run = 1; run <= runs; run++) {
      await browser.close();
      browser = await launch();
      const { page } = await start();
      await page.waitForTimeout(5000);
      const r = await page.evaluate(async () => {
        const g = window.__unstable;
        const R = g.renderer;
        const gl = R.getContext();
        let cur = null;
        const time = (obj, name) => {
          const f = obj[name].bind(obj);
          obj[name] = (...a) => {
            const t0 = performance.now();
            const v = f(...a);
            if (cur) cur.work += performance.now() - t0;
            return v;
          };
        };
        time(g, 'updatePlaying');
        time(g.composer, 'render');
        time(g.ui, 'update');
        time(g, 'updateCamera');
        time(g.vfx, 'update');
        const bufferData = gl.bufferData.bind(gl);
        gl.bufferData = (t, d, u) => {
          if (cur) cur.mb += (d && d.byteLength ? d.byteLength : 0) / 1048576;
          return bufferData(t, d, u);
        };
        const frames = [];
        let arrived = -1;
        await new Promise((res) => {
          let last = performance.now();
          const tick = (now) => {
            if (cur) {
              cur.dt = now - last;
              cur.programs = R.info.programs.length - cur.p0;
              frames.push(cur);
            }
            last = now;
            cur = { work: 0, mb: 0, p0: R.info.programs.length };
            if (frames.length === 30) g.enterRift(false);
            if (arrived < 0 && g.inRift) arrived = frames.length;
            // until a few frames past arrival (the fade takes longer than any fixed count on a fast build)
            if ((arrived < 0 || frames.length < arrived + 8) && frames.length < 3000) requestAnimationFrame(tick);
            else res();
          };
          requestAnimationFrame(tick);
        });
        // a frame's work shows in the next frame's interval: widen the window by one each side
        if (arrived < 0) return null;
        const w = frames.slice(arrived - 1, arrived + 6);
        const surface = frames.slice(5, 28).map((f) => f.dt).sort((a, b) => a - b);
        return {
          worstFrame: Math.max(...w.map((f) => f.dt)), worstWork: Math.max(...w.map((f) => f.work)),
          programs: w.reduce((s, f) => s + f.programs, 0), mb: w.reduce((s, f) => s + f.mb, 0), surfaceMedian: surface[surface.length >> 1],
        };
      });
      if (!r) {
        console.log(`arrival ${run}: never arrived`);
        errors.push('no arrival');
        await page.close();
        continue;
      }
      console.log(`arrival ${run}: worst frame ${r.worstFrame.toFixed(1)} ms, worst main-thread work ${r.worstWork.toFixed(1)} ms, ${r.programs} programs compiled, ${r.mb.toFixed(1)} MB uploaded (surface median frame ${r.surfaceMedian.toFixed(1)} ms)`);
      await page.close();
    }
  }

  if (mode === 'start') {
    for (let run = 1; run <= runs; run++) {
      await browser.close();
      browser = await launch();
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      // Recording starts before any game script. The world is shown once the game has drawn
      // its first frame (that frame draws everything in view for the first time, under the
      // fading loading screen); every frame after it counts.
      await page.addInitScript(() => {
        const S = (window.__start = { phase: 'loading', frames: [], links: [], t0: 0 });
        const link = WebGL2RenderingContext.prototype.linkProgram;
        WebGL2RenderingContext.prototype.linkProgram = function (p) {
          if (S.phase !== 'loading') S.links.push(S.phase);
          return link.call(this, p);
        };
        let last = 0;
        const tick = (now) => {
          const g = window.__unstable;
          if (S.phase === 'loading') {
            if (g && g.renderer && g.renderer.info.render.frame > 0) {
              S.phase = 'menu';
              S.t0 = now;
            }
          } else S.frames.push([now - last, S.phase, (now - S.t0) / 1000]);
          last = now;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(URL, { timeout: 180000 });
      await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
      await page.waitForTimeout(4000);
      await page.evaluate(async () => {
        const g = window.__unstable;
        const { RACES } = await import('/src/data/races.js');
        window.__start.phase = 'start';
        const ch = g.createCharacter({ name: 'Bench', race: RACES[0].id, look: {} });
        ch.armed = true;
        g.startGame(ch, false);
      });
      await page.waitForTimeout(5000);
      const ids = await page.evaluate(async () => {
        const g = window.__unstable;
        const { G } = await import('/src/core/globals.js');
        const { MANTRAS } = await import('/src/data/mantras.js');
        const p = g.player;
        for (const a of G.actors) if (a !== p && a.team === 'enemy') a.despawn = true;
        for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
        const x = p.pos.x;
        const z = p.pos.z + 8;
        const foe = (window.__foe = g.spawnEnemy('brigand', p.pos.clone().set(x, g.world.groundAt(x, z, p.pos.y + 5) + 0.1, z)));
        foe.maxHp = foe.hp = 1e6;
        const seen = new Set();
        return Object.keys(MANTRAS).filter((id) => !seen.has(MANTRAS[id].behavior) && seen.add(MANTRAS[id].behavior));
      });
      for (const id of ids) {
        await page.evaluate((id) => {
          const g = window.__unstable;
          const p = g.player;
          const f = window.__foe;
          window.__start.phase = 'cast ' + id;
          p.hp = p.maxHp;
          f.hp = f.maxHp;
          f.pos.set(p.pos.x, f.pos.y, p.pos.z + 8);
          g.camYaw = 0;
          p.ch.mantras[id] = { stars: 0 };
          p.ch.hotbar[1] = { type: 'mantra', id };
          p.cooldowns[id] = 0;
          p.ether = p.maxEther;
          g.input.pressed.add('Digit2');
        }, id);
        await page.waitForTimeout(1000);
      }
      const r = await page.evaluate(() => {
        const S = window.__start;
        const f = S.frames;
        const worst = f.reduce((a, b) => (b[0] > a[0] ? b : a), [0, '']);
        return { n: f.length, worst, over50: f.filter((x) => x[0] > 50), over33: f.filter((x) => x[0] > 34).length, links: S.links };
      });
      console.log(`start ${run}: ${r.n} frames from the world's first showing, worst ${r.worst[0].toFixed(1)} ms (${r.worst[1]}), ` +
        `${r.over50.length} over 50 ms${r.over50.length ? ' (' + r.over50.map((x) => `${x[0].toFixed(0)} ms ${x[1]} at ${x[2].toFixed(2)} s`).join(', ') + ')' : ''}, ` +
        `${r.over33} over 33 ms, ${r.links.length} programs linked after the world was shown${r.links.length ? ' (' + [...new Set(r.links)].join(', ') + ')' : ''}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`console errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
process.exit(errors.length ? 1 : 0);
