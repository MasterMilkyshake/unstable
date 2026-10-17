// Deterministic render comparison of two builds (docs/ARCHITECTURE.md, "Keeping frames even"):
// proves a performance change draws the same pixels.
//   node tools/pixel-diff.mjs http://localhost:A/ http://localhost:B/
// Give the same URL twice to check the harness is deterministic on one build.
// In each page, before any game script: Math.random is seeded per calling function (three.js
// draws uuids from it, so one extra object would otherwise shift every later number), keyed by
// function and file but not line, so an edit elsewhere in a file keeps the stream; rAF is held,
// and game.frame is driven with synthetic 60 Hz time; the sky is pinned at noon. Views: the menu
// orbit, a new character at the Wash, the Lantern Tree in Saltreach, the Rift spawn, and from
// above, a Searing Nova and an Ember Bolt cast at a brigand. Each view is read back from the canvas and compared pixel by
// pixel. Exits 1 if any pixel differs or a console error is logged. PIXEL_DIFF_OUT=<dir> also
// writes build A's views there as PNGs, to see what was compared. PIXEL_DIFF_A_SETTINGS and
// PIXEL_DIFF_B_SETTINGS (JSON) set game settings on one side before play, to compare an option
// on one build: '{"bounceLight":true}'.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const urls = process.argv.slice(2, 4);
if (urls.length !== 2) {
  console.log('usage: node tools/pixel-diff.mjs <url A> <url B>');
  process.exit(2);
}

const sideSettings = [process.env.PIXEL_DIFF_A_SETTINGS, process.env.PIXEL_DIFF_B_SETTINGS].map((v) => (v ? JSON.parse(v) : {}));
async function capture(url, settings = {}) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => {
    const streams = new Map();
    const seeded = (a) => () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const hash = (s) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      return h >>> 0;
    };
    Math.random = () => {
      const stack = new Error().stack.split('\n');
      let key = '?';
      for (let i = 2; i < stack.length; i++) {
        const f = stack[i];
        if (/core\/util\.js|\/deps\/|node_modules/.test(f)) continue; // rand helpers, three.js
        key = f.replace(/https?:\/\/[^/]+/, '').replace(/\?[^:)]*/, '').replace(/:\d+:\d+\)?\s*$/, '').trim();
        break;
      }
      let s = streams.get(key);
      if (!s) streams.set(key, (s = seeded(hash(key))));
      return s();
    };
    const pending = [];
    window.requestAnimationFrame = (cb) => pending.push(cb);
    window.cancelAnimationFrame = () => {};
    let t = 1000;
    window.__step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        t += 1000 / 60;
        for (const cb of pending.splice(0)) cb(t);
      }
      return t;
    };
  });
  await page.goto(url, { timeout: 180000 });
  await page.evaluate(() => window.__step(1)); // main.js waits a frame before it boots
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 300000, polling: 200 });
  await page.evaluate(() => {
    const g = window.__unstable;
    g.last = 1000;
    const sky = g.world.sky;
    const update = sky.update.bind(sky);
    sky.update = (dt, ...rest) => {
      sky.time = 0.42;
      return update(0, ...rest);
    };
  });
  const read = () =>
    page.evaluate(() => {
      const g = window.__unstable;
      const gl = g.renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      window.__step(1); // draw, then read back in the same task, before the canvas is presented
      g.renderer.setRenderTarget(null);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = '';
      for (let i = 0; i < px.length; i += 32768) s += String.fromCharCode(...px.subarray(i, i + 32768));
      return { w, h, data: btoa(s) };
    });
  const views = {};
  await page.evaluate(() => window.__step(240));
  views['menu orbit'] = await read();
  await page.evaluate(async (settings) => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    const { G } = await import('/src/core/globals.js');
    window.__G = G;
    Object.assign(G.settings || g.settings, settings);
    g.startGame(g.createCharacter({ name: 'Diff', race: RACES[0].id, look: {} }), false);
    for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
    window.__step(240);
  }, settings);
  views['the Wash'] = await read();
  const place = (x, z, inRift) =>
    page.evaluate(
      ([x, z, inRift]) => {
        const g = window.__unstable;
        const p = g.player;
        p.pos.set(x, g.world.groundAt(x, z, 400) + 0.2, z);
        p.vel.set(0, 0, 0);
        p.fallStart = p.pos.y;
        g.inRift = inRift;
        window.__step(240);
      },
      [x, z, inRift]
    );
  await place(0, 0, false);
  views['the Lantern Tree'] = await read();
  await place(6000, 5830, true);
  views['the Rift spawn'] = await read();
  // effects, seen from above: a Searing Nova's rings and burst, then an Ember Bolt in flight
  const cast = (id, frames) =>
    page.evaluate(
      ([id, frames]) => {
        const g = window.__unstable;
        const p = g.player;
        g.camYaw = 0;
        if (!window.__foe) {
          const z = p.pos.z + 9;
          window.__foe = g.spawnEnemy('brigand', p.pos.clone().set(p.pos.x, g.world.groundAt(p.pos.x, z, p.pos.y + 5) + 0.1, z));
        }
        g.debugCam = { pos: [p.pos.x - 7, p.pos.y + 9, p.pos.z - 4], look: [p.pos.x, p.pos.y, p.pos.z + 4] };
        p.ch.mantras[id] = { stars: 0 };
        p.ch.hotbar[1] = { type: 'mantra', id };
        p.cooldowns[id] = 0;
        p.ether = p.maxEther;
        p.tryCast(1);
        window.__step(frames);
      },
      [id, frames]
    );
  await place(-4, -346, false);
  await cast('searing_nova', 31); // its ring and burst, a few frames after the wind-up
  views['a Searing Nova'] = await read();
  await page.evaluate(() => window.__step(90));
  await cast('ember_bolt', 21);
  views['an Ember Bolt in flight'] = await read();
  await browser.close();
  return { views, errors };
}

const [a, b] = [await capture(urls[0], sideSettings[0]), await capture(urls[1], sideSettings[1])];
const out = process.env.PIXEL_DIFF_OUT;
if (out) {
  const req = createRequire(import.meta.url);
  const { PNG } = req(join(dirname(req.resolve('playwright-core')), 'lib/utilsBundle.js')); // the pngjs Playwright bundles
  mkdirSync(out, { recursive: true });
  for (const [name, v] of Object.entries(a.views)) {
    const png = new PNG({ width: v.w, height: v.h });
    const px = Buffer.from(v.data, 'base64');
    for (let y = 0; y < v.h; y++) px.copy(png.data, (v.h - 1 - y) * v.w * 4, y * v.w * 4, (y + 1) * v.w * 4); // GL rows run bottom up
    writeFileSync(`${out}/${name.replace(/\W+/g, '-')}.png`, PNG.sync.write(png));
  }
}
let failed = a.errors.length + b.errors.length > 0;
for (const name of Object.keys(a.views)) {
  const A = Buffer.from(a.views[name].data, 'base64');
  const B = Buffer.from(b.views[name].data, 'base64');
  let differ = 0;
  let worst = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    if (d) {
      differ++;
      worst = Math.max(worst, d);
    }
  }
  let lit = 0;
  for (let i = 0; i < A.length; i += 4) if (A[i] + A[i + 1] + A[i + 2] > 30) lit++;
  failed ||= differ > 0 || A.length !== B.length;
  console.log(`${name}: ${differ} of ${A.length / 4} pixels differ${differ ? ` (worst channel ${worst})` : ''}; ${((100 * lit) / (A.length / 4)).toFixed(0)}% of the frame lit`);
}
console.log(`console errors: ${a.errors.length} + ${b.errors.length}${a.errors.length + b.errors.length ? ' ' + [...a.errors, ...b.errors].slice(0, 4).join(' | ') : ''}`);
process.exit(failed ? 1 : 0);
