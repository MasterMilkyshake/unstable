// Before/after evidence for terrain, biomes, coasts, vegetation, sky and vistas.
// Run the baseline build on BASELINE_URL (default :5174) and this tree on REVIEW_URL
// (default :5173), then: node tools/terrain-review.mjs [out dir] [id filter] [before|after|both]
// Camera heights given as '+n' are metres above the ground under the camera (or the look
// point), so a player-height shot stays at eye height when the land under it changes.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

const out = process.argv[2] || 'docs/terrain-evidence';
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
const which = process.argv[4] || 'both';
await mkdir(out, { recursive: true });

const NOON = 0.5, SUNSET = 0.74, NIGHT = 0.9;
const ALL = [NOON, SUNSET, NIGHT];
const TIME_NAME = { [NOON]: 'noon', [SUNSET]: 'sunset', [NIGHT]: 'night' };
// id, where the player stands (drives biome, mist and weather), camera, look point, hours.
export const SHOTS = [
  // ---- Saltreach, the Wash and the countryside
  { id: 'wash-ground', at: [-4, -346], pos: [-4, '+1.7', -346], look: [-40, '+3', -280], times: ALL },
  { id: 'wash-air', at: [-4, -346], pos: [120, 110, -440], look: [-30, 0, -300], times: ALL },
  { id: 'wash-dunes', at: [30, -300], pos: [30, '+1.7', -300], look: [60, '+1', -360], times: [NOON] },
  { id: 'salt-fields-ground', at: [-20, 180], pos: [-20, '+1.7', 180], look: [-110, 30, 190], times: ALL },
  { id: 'salt-air', at: [0, 100], pos: [150, 200, -60], look: [-60, 20, 250], times: ALL },
  { id: 'salt-bluff-base', at: [-80, 92], pos: [-80, '+1.7', 92], look: [-110, 14, 120], times: [NOON] },
  { id: 'kestrel-ground', at: [-60, 350], pos: [-60, '+1.7', 350], look: [-215, 30, 420], times: ALL },
  { id: 'kestrel-air', at: [-60, 350], pos: [60, 160, 260], look: [-200, 20, 420], times: [NOON] },
  { id: 'saddle-ground', at: [-10, 380], pos: [-10, '+1.7', 380], look: [10, '+6', 470], times: [NOON] },
  { id: 'countryside-air', at: [150, 250], pos: [300, 140, 120], look: [150, 10, 330], times: [NOON] },
  { id: 'keystone-close', at: [0, 0], pos: [36, 154, -92], look: [8, 136, 48], times: [NOON, SUNSET] },
  { id: 'keystone-town', at: [-10, 20], pos: [-10, '+1.7', 20], look: [8, 140, 48], times: [NOON] },
  { id: 'keystone-skyline', at: [-30, -230], pos: [-30, '+1.7', -230], look: [8, 110, 48], times: [NOON, SUNSET] },
  { id: 'trans-wash-plains', at: [-40, -215], pos: [-40, '+1.7', -215], look: [0, '+1', -300], times: [NOON] },
  { id: 'trans-salt-fen', at: [-390, -70], pos: [-390, '+1.7', -70], look: [-480, '+2', -160], times: [NOON] },
  // ---- Shimmerfen
  { id: 'fen-ground', at: [-628, -358], pos: [-628, '+1.7', -358], look: [-700, '+4', -332], times: ALL },
  { id: 'fen-ground2', at: [-560, -300], pos: [-560, '+1.7', -300], look: [-700, '+3', -380], times: [NOON] },
  { id: 'fen-air', at: [-650, -350], pos: [-480, 140, -200], look: [-700, 0, -420], times: ALL },
  { id: 'fen-fenwall', at: [-860, -520], pos: [-860, '+1.7', -520], look: [-950, 30, -470], times: [NOON] },
  { id: 'fen-stilts', at: [-690, -390], pos: [-690, 6, -390], look: [-716, 0, -404], times: [NOON] },
  { id: 'fen-posts', at: [-330, -600], pos: [-318, 6, -585], look: [-334, 0, -601], times: [NOON] },
  { id: 'fen-arches-foot', at: [-582, -662], pos: [-592, '+2.5', -674], look: [-566, 30, -590], times: [NOON] },
  { id: 'wash-arches', at: [-4, -346], pos: [-4, '+1.7', -346], look: [-470, 22, -440], times: [NOON, SUNSET] },
  // ---- Thornwood and Meridian
  { id: 'thorn-ground', at: [1380, 100], pos: [1380, '+1.7', 100], look: [1450, '+5', 160], times: ALL },
  { id: 'thorn-forest', at: [1450, 200], pos: [1450, '+1.7', 200], look: [1500, '+3', 260], times: [NOON] },
  { id: 'thorn-air', at: [1300, 60], pos: [1150, 200, -150], look: [1450, 20, 100], times: ALL },
  { id: 'trans-thorn-meridian', at: [1338, -348], pos: [1338, '+1.7', -348], look: [1300, 30, -620], times: [NOON] },
  { id: 'trans-thorn-pass', at: [1300, -440], pos: [1302, '+1.7', -436], look: [1190, 20, -650], times: [NOON, SUNSET] },
  { id: 'meridian-ground', at: [1300, -440], pos: [1300, '+1.7', -440], look: [1330, 40, -700], times: ALL },
  { id: 'meridian-air', at: [1160, -680], pos: [1150, 220, -480], look: [1320, 30, -760], times: ALL },
  { id: 'meridian-bridge', at: [1290, -760], pos: [1273, 70, -706], look: [1321, 35, -780], times: [NOON] },
  { id: 'meridian-bridge-gorge', at: [1320, -755], pos: [1320, '+1.7', -752], look: [1321, 40, -781], times: [NOON] },
  { id: 'meridian-bridge-crossing', at: [1291, -780], pos: [1291, 49, -780], look: [1351, 47, -780], times: [NOON] },
  // ---- Frosthollow
  { id: 'frost-ground', at: [-908, 1512], pos: [-908, '+1.7', 1512], look: [-952, 20, 1568], times: ALL },
  { id: 'frost-range', at: [-1100, 1450], pos: [-1100, '+1.7', 1450], look: [-1300, 80, 1600], times: [NOON] },
  { id: 'frost-air', at: [-1000, 1400], pos: [-800, 220, 1250], look: [-1150, 30, 1550], times: ALL },
  { id: 'frost-east', at: [-1500, 1700], pos: [-1700, 60, 1700], look: [-1450, 10, 1700], times: [NOON] },
  { id: 'frost-west', at: [-900, 1300], pos: [-760, 50, 1350], look: [-950, 10, 1400], times: [NOON] },
  { id: 'trans-snow-tundra', at: [-900, 1260], pos: [-900, '+1.7', 1260], look: [-1050, '+5', 1450], times: [NOON] },
  // ---- Ashen Spire
  { id: 'ashen-ground', at: [295, -1295], pos: [295, '+1.7', -1295], look: [340, 50, -1200], times: ALL },
  { id: 'ashen-field', at: [590, -1140], pos: [590, '+1.7', -1140], look: [810, 22, -960], times: [NOON] },
  { id: 'ashen-lava', at: [402, -1320], pos: [404, '+2.2', -1324], look: [382, 6, -1298], times: [NOON, NIGHT] },
  { id: 'ashen-air', at: [340, -1200], pos: [140, 230, -1400], look: [390, 30, -1150], times: ALL },
  { id: 'ashen-caldera', at: [340, -1200], pos: [270, 120, -1270], look: [340, 40, -1200], times: [NOON] },
  // ---- the join: Meridian's lowland, the Emberwood saddle and the lava steps
  { id: 'ember-saddle', at: [900, -900], pos: [900, '+1.7', -900], look: [700, 18, -1020], times: [NOON, SUNSET] },
  { id: 'ember-join-air', at: [900, -900], pos: [1180, 260, -620], look: [560, 10, -1120], times: [NOON] },
  { id: 'ember-from-meridian', at: [1030, -700], pos: [1030, '+1.7', -700], look: [600, 30, -1100], times: [NOON] },
  { id: 'ember-bridge', at: [404, -1352], pos: [418, '+1.8', -1358], look: [392, '+1', -1350], times: [NOON, NIGHT] },
  { id: 'cinderstead', at: [261, -1326], pos: [300, '+2', -1345], look: [250, '+3', -1328], times: [NOON, SUNSET] },
  // ---- The Verdance
  { id: 'verd-ground', at: [0, 1180], pos: [0, '+1.7', 1180], look: [-20, 20, 1320], times: ALL },
  { id: 'verd-air', at: [-30, 1240], pos: [200, 200, 1050], look: [-20, 20, 1300], times: ALL },
  { id: 'verd-beach', at: [-60, 1120], pos: [-150, 60, 1060], look: [-80, 5, 1150], times: [NOON] },
  // ---- The Hush
  { id: 'hush-ground', at: [-1130, 1140], pos: [-1130, '+1.7', 1140], look: [-1260, 30, 1120], times: ALL },
  { id: 'hush-moor', at: [-1340, 1190], pos: [-1340, '+1.7', 1190], look: [-1430, '+4', 1110], times: [NOON] },
  { id: 'hush-air', at: [-1200, 1100], pos: [-1030, 200, 1290], look: [-1280, 20, 1090], times: ALL },
  { id: 'hush-pagoda', at: [-1240, 1130], pos: [-1232, 44, 1102], look: [-1262, 40, 1122], times: [NOON] },
  { id: 'hush-hall', at: [-1270, 1140], pos: [-1260, 42, 1170], look: [-1285, 38, 1150], times: [NOON] },
  { id: 'hush-stair', at: [-1200, 1140], pos: [-1190, 22, 1144], look: [-1220, 26, 1132], times: [NOON] },
  { id: 'hush-probe', at: [-1180, 1240], pos: [-1080, 80, 1320], look: [-1180, 0, 1220], times: [NOON] },
  // ---- the islets and the open sea
  { id: 'islet-anchor', at: [0, 700], pos: [60, 40, 640], look: [0, 0, 700], times: [NOON] },
  { id: 'islet-gallows', at: [420, -330], pos: [360, 40, -280], look: [420, 5, -330], times: [NOON] },
  { id: 'islet-ebb', at: [-320, -620], pos: [-260, 35, -570], look: [-320, 3, -620], times: [NOON] },
  { id: 'islet-gulls', at: [160, -360], pos: [205, 30, -310], look: [160, 0, -360], times: [NOON] },
  { id: 'sea-horizon', at: [0, -500], pos: [0, 260, -520], look: [0, 180, -2500], times: [NOON, SUNSET] },
  { id: 'coast-surf', at: [0, -400], pos: [6, '+1.7', -404], look: [-10, 0, -470], times: [NOON, SUNSET] },
];

// Uncapped frames for the timing pass; otherwise both builds sit on the vsync line.
const flags = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(process.env.METRICS ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: flags });
const errors = [], shots = [], metrics = [];
const runs = [['before', process.env.BASELINE_URL || 'http://localhost:5174'], ['after', process.env.REVIEW_URL || 'http://localhost:5173']].filter(([v]) => which === 'both' || which === v);
// A fresh page per island: the weather cycle and its blizzard roll start clear on load, and
// the capture holds it there, so a pair differs only in what changed in the code.
async function boot(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__unstable, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = __unstable;
    g.input.requestLock = () => {};
    g.settings.master = 0;
    g.applySettings();
    g.__originalSky = g.world.sky.update.bind(g.world.sky);
    g.world.sky.update = (dt, ...args) => { g.world.sky.time = g.__reviewTime ?? 0.5; g.__originalSky(dt, ...args); };
    const render = g.renderer.render.bind(g.renderer);
    g.renderer.render = (scene, camera) => { render(scene, camera); if (scene === g.scene) { g.__sceneDraws = g.renderer.info.render.calls; g.__sceneTris = g.renderer.info.render.triangles; } };
    const ch = g.createCharacter({ name: 'Surveyor', race: 'ashkin', look: { height: 1 } });
    ch.pos = { x: -4, z: -346, y: g.world.terrain.heightAt(-4, -346) };
    g.startGame(ch, false);
    g.spawners.length = 0;
    const { ACTIONS } = await import('/src/game/hooks.js');
    ACTIONS.setWeather?.('clear');
    document.querySelector('#hud').style.display = 'none';
    document.querySelector('#world-ui').style.display = 'none';
  });
}
const groupOf = (id) => id.split('-')[0];
try {
  for (const [version, url] of runs) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push({ version, type: 'page', message: e.message }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push({ version, type: 'console', message: m.text() }); });
    let group = null, lastAt = null;
    for (const v of SHOTS) {
      if (filter && !filter.test(v.id)) continue;
      if (groupOf(v.id) !== group) {
        group = groupOf(v.id);
        await boot(page, url);
        lastAt = null;
      }
      const moved = !lastAt || Math.hypot(v.at[0] - lastAt[0], v.at[1] - lastAt[1]) > 60;
      lastAt = v.at;
      await page.evaluate((v) => {
        const g = __unstable, T = g.world.terrain;
        const yOf = (p) => (typeof p[1] === 'string' ? T.heightAt(p[0], p[2]) + parseFloat(p[1]) : p[1]);
        const p = g.player;
        p.pos.set(v.at[0], g.world.groundAt(v.at[0], v.at[1]) + 0.05, v.at[1]);
        p.vel?.set?.(0, 0, 0);
        p.iframes = 1e6;
        if (p.model?.root) p.model.root.visible = false;
        for (const a of [...(window.__G?.actors || [])]) if (a !== p && a.removeFromScene) a.removeFromScene();
        g.debugCam = { pos: [v.pos[0], yOf(v.pos), v.pos[2]], look: [v.look[0], yOf(v.look), v.look[2]] };
      }, v);
      await page.waitForTimeout(moved ? 3500 : 400);
      for (const t of v.times) {
        await page.evaluate((t) => { __unstable.__reviewTime = t; __unstable.player.model.root.visible = false; }, t);
        await page.waitForTimeout(900);
        const file = `${version}-${v.id}-${TIME_NAME[t]}.jpg`;
        await page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 85 });
        shots.push({ version, id: v.id, time: TIME_NAME[t], file });
        console.log(version, v.id, TIME_NAME[t]);
      }
      if (process.env.METRICS && ['wash-ground', 'salt-air', 'salt-fields-ground', 'fen-ground', 'thorn-forest', 'frost-ground', 'frost-air', 'hush-ground'].includes(v.id)) {
        for (const quality of ['high', 'low']) {
          await page.evaluate((q) => { const g = __unstable; g.settings.quality = q; g.applySettings(); __unstable.__reviewTime = 0.5; }, quality);
          await page.waitForTimeout(600);
          const m = await page.evaluate(() => new Promise((resolve) => {
            const times = [], draws = [], tris = []; let last = performance.now();
            function frame(now) { times.push(now - last); last = now; draws.push(__unstable.__sceneDraws); tris.push(__unstable.__sceneTris); if (times.length < 240) requestAnimationFrame(frame); else { times.sort((a, b) => a - b); draws.sort((a, b) => a - b); tris.sort((a, b) => a - b); resolve({ medianMs: +times[120].toFixed(2), p95Ms: +times[228].toFixed(2), sceneDraws: draws[120], sceneTris: tris[120] }); } }
            requestAnimationFrame(frame);
          }));
          metrics.push({ version, area: v.id, quality, ...m });
          console.log(version, v.id, quality, JSON.stringify(m));
        }
        await page.evaluate(() => { const g = __unstable; g.settings.quality = 'high'; g.applySettings(); });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${out}/capture-${which}.json`, JSON.stringify({ hardware: os.cpus()[0]?.model, platform: os.platform(), viewport: '1280x720 @ 1x', metrics, errors, shots }, null, 2) + '\n');
console.log('errors', errors.length, JSON.stringify(errors.slice(0, 10)));
if (errors.length) process.exitCode = 1;
