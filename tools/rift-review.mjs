// Rift review captures: a fixed manifest of debug-camera views (arrival, ceiling,
// edges, the Ascent from every side, floor and lift, every castle, relays, camps and the
// Ferryman's landing), each saved as a JPEG with a count of pure-black bloom tiles.
//
//   npm run dev            (in another shell)
//   node tools/rift-review.mjs <out dir> [id-prefix ...]
//
// REVIEW_URL overrides http://localhost:5173. CHROME_PATH picks a Chrome binary; without it the
// installed Google Chrome is tried, then Playwright's own Chromium. A y value may be a number
// (world height), {g: dy} (terrain + dy at that x, z) or {a: dy} (the Ascent's ground + dy).
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const out = process.argv[2] || 'docs/rift-evidence/after';
const only = process.argv.slice(3);
const url = process.env.REVIEW_URL || 'http://localhost:5173';
const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined);

const g = (dy) => ({ g: dy });
const a = (dy) => ({ a: dy });
const A = { x: 6000, z: 5988 };
// The Ascent's landings: position and the way out from the shaft.
const T = {
  t1: [6000, 16, 5979.3, 0, -1], t2: [6008.7, 32, 5988, 1, 0], t3: [6000, 48, 5996.7, 0, 1],
  t4: [5991, 64, 5988, -1, 0], t5: [6000, 80, 5979, 0, -1], t6: [6008.7, 96, 5988, 1, 0],
};

export const VIEWS = [
  // ---------------------------------------------------------------- arrival, ceiling, light
  { id: 'a1-arrival', pos: [6000, 9, 5823], look: [6000, 35, 5988] },
  { id: 'a2-arrival-wide', pos: [6012, g(14), 5800], look: [5990, 40, 5960] },
  { id: 'a3-arrival-beam', pos: [6030, g(3), 5850], look: [6000, 60, 5830] },
  { id: 'c1-up', pos: [6000, g(2), 5880], look: [6003, 140, 5905] },
  { id: 'c2-graze', pos: [5880, 70, 5880], look: [6120, 100, 6060] },
  { id: 'c3-ceiling-mid', pos: [6080, 60, 5900], look: [5940, 110, 6050] },
  { id: 'c4-high-look', pos: [6150, 90, 5850], look: [5880, 95, 6120] },
  { id: 'c5-high-out', pos: [5900, 110, 6100], look: [5700, 110, 6300] },
  { id: 'c6-columns', pos: [6140, 40, 5990], look: [6248, 40, 6100] },
  { id: 'c7-column-close', pos: [5800, 30, 6230], look: [5760, 60, 6330] },
  { id: 'o1-wash', pos: [6025, g(2), 5860], look: [6000, 130, 5830] },
  { id: 'o2-harbor', pos: [6050, g(2), 5935], look: [6014, 110, 5900] },
  { id: 'o3-gulls', pos: [6060, g(4), 5860], look: [6088, 100, 5802] },
  { id: 'o4-vale', pos: [6000, g(3), 6058], look: [5986, 110, 6100] },
  { id: 'w1-walk-north', pos: [6000, g(1.7), 5850], look: [6000, g(1.6), 5900] },
  { id: 'w2-walk-wash', pos: [6000, g(1.7), 5870], look: [6000, 8, 5835] },
  { id: 'w3-walk-harbor', pos: [6046, g(1.7), 5922], look: [6020, 8, 5895] },
  { id: 'w4-walk-ascent', pos: [6000, g(1.7), 5940], look: [6000, 14, 5988] },
  // ---------------------------------------------------------------- floor and edges
  { id: 'f1-basin-east', pos: [6060, g(6), 5870], look: [5880, 10, 5960] },
  { id: 'f2-basin-west', pos: [5940, g(6), 5870], look: [6140, 10, 5980] },
  { id: 'f3-basin-low', pos: [6120, g(2), 5900], look: [6060, 6, 5940] },
  { id: 'e1-edge-south', pos: [6000, 22, 5790], look: [6000, -10, 5600] },
  { id: 'e2-edge-east', pos: [5790, 25, 6000], look: [5560, -20, 6000] },
  { id: 'e3-edge-west', pos: [6215, 25, 5860], look: [6420, -15, 5780] },
  { id: 'e4-under', pos: [6000, -70, 5640], look: [6000, -10, 5900] },
  { id: 'e5-rim-out', pos: [5880, 18, 5810], look: [5700, 0, 5700] },
  // ---------------------------------------------------------------- the Ascent
  { id: 's1-ascent-s', pos: [6000, 20, 5895], look: [6000, 55, 5988] },
  { id: 's2-ascent-n', pos: [6000, 40, 6062], look: [6000, 55, 5988] },
  { id: 's3-ascent-e', pos: [5868, 38, 5988], look: [6000, 55, 5988] },
  { id: 's4-ascent-w', pos: [6134, 38, 5988], look: [6000, 55, 5988] },
  { id: 's5-ascent-ne', pos: [5925, 70, 6065], look: [6000, 70, 5988] },
  { id: 's6-ascent-sw', pos: [6080, 70, 5910], look: [6000, 70, 5988] },
  { id: 's7-ascent-aerial', pos: [6070, 118, 5915], look: [6000, 60, 5988] },
  { id: 's8-ascent-base-gate', pos: [6000, a(3), 5940], look: [6000, a(8), 5975] },
  { id: 's9-ascent-shaft-up', pos: [6002, a(114), 5990], look: [6000, 220, 5994] },
  { id: 's10-ascent-summit', pos: [6012, a(118), 5976], look: [6000, a(112), 5988] },
  { id: 's11-ascent-h66', pos: [5955, a(66), 5960], look: [5995, a(66), 5988] },
  { id: '38-ascent-lift-h80', pos: [6040, a(80), 5965], look: [6008, a(80), 5985] },
  ...Object.entries(T).flatMap(([id, [x, h, z, ox, oz]]) => [
    { id: `t-${id}-on`, pos: [x - ox * 1.5, a(h + 1.7), z - oz * 1.5], look: [x + ox * 60, a(h - 4), z + oz * 60] },
    { id: `t-${id}-at`, pos: [x + ox * 22 + oz * 10, a(h + 6), z + oz * 22 + ox * 10], look: [x, a(h + 1), z] },
  ]),
  // the one lift (ADR-WL1): its tower on the keep's +z wall, from the courtyard to the summit
  { id: 'lift1-base', pos: [6020, a(8), 6025], look: [6008, a(20), 6005.6] },
  { id: 'lift2-base-low', pos: [6014, a(1.7), 6022], look: [6008, a(6), 6005.6] },
  { id: 'lift3-whole', pos: [6045, a(60), 6060], look: [6008, a(62), 6005] },
  { id: 'lift4-roof-fp', pos: [6003, a(49.7), 5994], look: [6008, a(64), 6004] },
  { id: 'lift5-hall-gable', pos: [5992, a(64), 6012], look: [6008, a(63), 6001] },
  { id: 'lift6-corner-roof', pos: [6024, a(66), 6016], look: [6011, a(63), 6002.6] },
  { id: 'lift7-summit-bridge', pos: [6003, a(113.7), 5994], look: [6008, a(112), 6004] },
  { id: 'lift8-top', pos: [6030, a(130), 6030], look: [6008, a(118), 6005] },
  // the Bell Ward's belfry, its cap on corner posts
  { id: 'bw1-belfry', pos: [5926, g(16), 6046], look: [5912, g(15), 6026] },
  // ---------------------------------------------------------------- the Chainward
  { id: 'cw1-front', pos: [6000, 40, 6056], look: [6000, 32, 6120] },
  { id: 'cw2-band', pos: [6000, 30, 6078], look: [6000, 31, 6115] },
  { id: 'cw3-north', pos: [6010, 45, 6290], look: [6000, 30, 6168] },
  { id: 'cw4-east', pos: [5880, 45, 6168], look: [6000, 30, 6168] },
  { id: 'cw5-west', pos: [6120, 45, 6168], look: [6000, 30, 6168] },
  { id: 'cw6-aerial', pos: [6000, 112, 6040], look: [6000, 20, 6168] },
  { id: 'cw7-inside', pos: [6025, 26, 6140], look: [5975, 30, 6195] },
  { id: 'cw8-forecourt', pos: [6012, 19, 6084], look: [5995, 22, 6110] },
  { id: 'cw9-lower-ward', pos: [6064, 19.5, 6150], look: [6052, 20, 6200] },
  { id: 'cw10-stairs', pos: [6000, 12, 6015], look: [6000, 22, 6080] },
  // ---------------------------------------------------------------- the Bastion and bridge
  { id: 'ba1-bridge-e', pos: [6150, 20, 5962], look: [6258, 25, 5962] },
  { id: 'ba2-west', pos: [6365, 45, 5962], look: [6258, 20, 5962] },
  { id: 'ba3-north', pos: [6258, 45, 6065], look: [6258, 20, 5962] },
  { id: 'ba4-south', pos: [6258, 45, 5858], look: [6258, 20, 5962] },
  { id: 'ba5-aerial', pos: [6190, 88, 5880], look: [6258, 15, 5962] },
  { id: 'ba6-inside', pos: [6268, 17, 5948], look: [6250, 22, 5978] },
  { id: 'ba7-bridge-side', pos: [6196, 6, 5905], look: [6196, 4, 5962] },
  { id: 'ba8-mesa-base', pos: [6300, -10, 5880], look: [6260, 5, 5960] },
  // ---------------------------------------------------------------- the Garrison
  { id: 'ga1-west', pos: [5905, 25, 6116], look: [5800, 22, 6116] },
  { id: 'ga2-east', pos: [5690, 45, 6116], look: [5800, 20, 6116] },
  { id: 'ga3-north', pos: [5800, 45, 6222], look: [5800, 20, 6116] },
  { id: 'ga4-south', pos: [5800, 45, 6010], look: [5800, 20, 6116] },
  { id: 'ga5-aerial', pos: [5870, 100, 6050], look: [5800, 15, 6116] },
  { id: 'ga6-inside', pos: [5812, 18, 6116], look: [5770, 23, 6100] },
  { id: 'ga7-arcade', pos: [5838, 13, 6095], look: [5838, 17, 6120] },
  // ---------------------------------------------------------------- relays, upended, gates
  { id: 'r1-relay-north', pos: [6100, g(9), 6112], look: [6125, g(20), 6160] },
  { id: 'r2-relay-ne', pos: [5920, g(8), 6150], look: [5885, g(20), 6195] },
  { id: 'r3-relay-west', pos: [6140, g(8), 6045], look: [6175, g(18), 6080] },
  { id: 'r4-relay-south', pos: [5935, g(8), 5840], look: [5905, g(18), 5800] },
  { id: 'u1-upended-a', pos: [6115, g(6), 5850], look: [6150, g(12), 5880] },
  { id: 'u2-upended-b', pos: [5865, g(6), 5935], look: [5830, g(12), 5965] },
  { id: 'v1-veins-approach', pos: [6084, g(2), 6054], look: [6096, 15, 6034] },
  // ---------------------------------------------------------------- research sites
  // each build's own site positions (data/riftResearch.js), seen from the way the path comes in
  ...['scholar', 'survey', 'order', 'year57', 'rope', 'scout', 'glyphs', 'vault', 'fold', 'prerift', 'whisper', 'archive']
    .map((id) => ({ id: `rs-${id}`, site: id, sanity: id === 'whisper' || id === 'archive' ? 0.2 : 1 })),
  // ---------------------------------------------------------------- the kingdom plan
  { id: 'k1-plan-aerial', pos: [6000, 92, 5790], look: [6000, 0, 6050] },
  { id: 'k2-plan-east', pos: [5800, 88, 5900], look: [6000, 0, 6060] },
  { id: 'k6-south-gate', pos: [6000, g(2), 5903], look: [6000, 16, 5951] },
  { id: 'k7-garrison-gate', pos: [5858, g(3), 6052], look: [5894, 22, 6046] },
  { id: 'k8-bastion-gate', pos: [6142, g(3), 5976], look: [6106, 17, 5980] },
  { id: 'k9-citadel-north-gate', pos: [6000, g(2), 6064], look: [6000, 24, 6038] },
  { id: 'k10-plaza', pos: [6042, g(1.7), 5957], look: [5960, 16, 5967] },
  { id: 'k3-city-street', pos: [6000, g(1.7), 5955], look: [6000, g(4), 6000] },
  { id: 'k4-city-wall-e', pos: [5860, g(6), 5990], look: [5884, g(10), 6020] },
  { id: 'k5-city-wall-w', pos: [6135, g(6), 5990], look: [6108, g(10), 6030] },
  { id: 'dg1-deep-gate', pos: [6022, g(3), 6178], look: [6040, g(3), 6190] },
  { id: 'dg2-deep-gate-close', pos: [6031, g(1.7), 6184], look: [6041, g(1.5), 6191] },
  // ---------------------------------------------------------------- wall seams the sweep found
  { id: 'sm1-city-chainward', pos: [6070, 34, 6066], look: [6040, 18, 6102] },
  { id: 'sm2-bastion-front', pos: [6258, 20, 5962], look: [6276, 14, 5962] },
  { id: 'sm3-chainward-north', pos: [6019, 16, 6262], look: [6019, 10, 6241] },
  { id: 'sm4-garrison-t1', pos: [5842, 17, 6096], look: [5828, 12, 6104] },
  { id: 'sm5-bastion-base', pos: [6345, 16, 5930], look: [6292, 6, 5962] },
  // ---------------------------------------------------------------- the Ferryman's landing
  { id: 'l-landing-ramp', pos: [5890, g(1.8), 6118], look: [5900, 8, 6152] },
  { id: 'l-landing-court', pos: [5922, g(2.2), 6136], look: [5880, 6, 6168] },
  { id: 'l-landing-boat', pos: [5884, g(2), 6158], look: [5896, 3, 6177] },
  { id: 'l-landing-aerial', pos: [5900, 60, 6080], look: [5900, 0, 6160] },
];

const views = only.length ? VIEWS.filter((v) => only.some((p) => v.id.startsWith(p))) : VIEWS;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], shots = [], metrics = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push({ type: 'page', message: e.message }));
  page.on('console', (m) => { if (m.type() === 'error') errors.push({ type: 'console', message: m.text() }); });
  await page.goto(url);
  await page.waitForFunction(() => window.__unstable, null, { timeout: 180000 });
  const gpu = await page.evaluate(() => {
    const g = __unstable;
    g.input.requestLock = () => {};
    g.settings.master = 0;
    g.settings.quality = 'high';
    g.applySettings();
    g.world.sky.update = ((orig) => (dt, ...rest) => { g.world.sky.time = 0.42; orig(dt, ...rest); })(g.world.sky.update.bind(g.world.sky));
    const gl = g.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  console.log('GPU:', gpu);
  let started = false;
  for (const v of views) {
    if (v.site) {
      // frame the site from the end of the path that reaches it, if this build has paths
      Object.assign(v, await page.evaluate(async (id) => {
        const s = (await import('/src/data/riftResearch.js')).RIFT_SITES[id];
        let dx = 0.55, dz = -0.83;
        try {
          const { RIFT_PATHS } = await import('/src/world/riftKingdom.js');
          let best = null, bd = 1e9;
          for (const p of RIFT_PATHS) for (const q of [p.pts[0], p.pts[p.pts.length - 1]]) {
            const d = Math.hypot(q[0] - s.x, q[1] - s.z);
            if (d < bd) { bd = d; best = q; }
          }
          if (best && bd > 1) { dx = (best[0] - s.x) / bd; dz = (best[1] - s.z) / bd; }
        } catch (e) { /* older builds have no paths */ }
        const d = id === 'vault' || id === 'glyphs' ? 22 : 17;
        return { pos: [s.x + dx * d, { g: 5.5 }, s.z + dz * d], look: [s.x, { g: 1.5 }, s.z] };
      }, v.site));
    }
    await page.evaluate(([v, first]) => {
      const g = __unstable;
      const px = 6000, pz = 5830;
      if (first) {
        const ch = g.createCharacter({ name: 'Wayfarer', race: 'ashkin', look: { height: 1 } });
        ch.pos = { x: px, z: pz, y: g.world.terrain.heightAt(px, pz) };
        ch.inRift = true;
        g.startGame(ch, false);
        document.querySelector('#hud').style.display = 'none';
        document.querySelector('#world-ui').style.display = 'none';
        // an audit of the place, not of who wanders through it: keep enemies out of the frame
        import('/src/core/globals.js').then(({ G }) => setInterval(() => {
          for (const a of G.actors || []) if (a !== g.player && a.model && a.model.root) a.model.root.visible = false;
        }, 50));
      }
      const p = g.player;
      p.pos.set(px, g.world.groundAt(px, pz, 200) + 0.2, pz);
      p.vel.set(0, 0, 0);
      g.inRift = true;
      p.invulnerable = true;
      if (p.maxSanity) g.ch.sanity = p.maxSanity * (v.sanity ?? 1);
      const ground = g.world.rift?.spire?.ground ?? g.world.terrain.heightAt(6000, 5988);
      const res = (arr) => {
        const [x, y, z] = arr;
        if (typeof y === 'number') return [x, y, z];
        if ('g' in y) return [x, g.world.terrain.heightAt(x, z) + y.g, z];
        return [x, ground + y.a, z];
      };
      g.debugCam = { pos: res(v.pos), look: res(v.look) };
    }, [v, !started]);
    started = true;
    await page.waitForTimeout(700);
    const file = `${v.id}.jpg`;
    const buf = await page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 });
    // Pure-black 16 px tiles: UnrealBloom spreads a NaN pixel into a black square.
    const black = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      const at = [];
      for (let ty = 0; ty + 16 <= c.height; ty += 16) for (let tx = 0; tx + 16 <= c.width; tx += 16) {
        let all = true;
        for (let y = ty; y < ty + 16 && all; y += 2) for (let xx = tx; xx < tx + 16; xx += 2) {
          const i = (y * c.width + xx) * 4;
          if (d[i] > 4 || d[i + 1] > 4 || d[i + 2] > 4) { all = false; break; }
        }
        if (all) { n++; if (at.length < 6) at.push(`${tx},${ty}`); }
      }
      return { n, at };
    }, buf.toString('base64'));
    shots.push({ id: v.id, file, black: black.n });
    console.log(v.id, black.n ? `BLACK TILES ${black.n} at ${black.at.join(' ')}` : '');
  }
  // Render cost (vsync caps rAF, so frames are forced and finished on the GPU one at a time)
  // at the arrival, under the Ascent and in front of the Chainward, on both settings.
  for (const [id, pos, look] of [['arrival', [6000, 9, 5823], [6000, 35, 5988]], ['ascent', [6045, 95, 5910], [6000, 75, 5988]], ['chainward', [6000, 30, 6040], [6000, 32, 6120]], ['basin', [6080, 60, 5900], [5940, 40, 6050]]]) {
    for (const quality of ['low', 'high']) {
      const m = await page.evaluate(([pos, look, quality]) => new Promise((resolve) => {
        const g = __unstable;
        g.settings.quality = quality; g.applySettings();
        g.debugCam = { pos, look };
        setTimeout(() => {
          const gl = g.renderer.getContext();
          const times = [];
          let calls = 0, tris = 0;
          for (let i = 0; i < 40; i++) {
            const t0 = performance.now();
            if (quality === 'low') g.renderer.render(g.scene, g.camera);
            else g.composer.render();
            gl.finish();
            times.push(performance.now() - t0);
            if (quality === 'low') { calls = g.renderer.info.render.calls; tris = g.renderer.info.render.triangles; }
          }
          times.sort((a, b) => a - b);
          resolve({ medianMs: +times[20].toFixed(2), p90Ms: +times[36].toFixed(2), calls, tris });
        }, 500);
      }), [pos, look, quality]);
      metrics.push({ id, quality, ...m });
    }
  }
  await context.close();
} finally {
  await browser.close();
}
await writeFile(`${out}/capture.json`, JSON.stringify({ url, metrics, errors, shots }, null, 2) + '\n');
console.log(JSON.stringify(metrics));
if (errors.length) console.log('errors:', errors.slice(0, 10));
