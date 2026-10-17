// Boot time of a build: a fresh browser per run, from navigation to the world first drawn behind
// the menu, and to the menu ready (the loading screen gone). Prints each run and the median.
//   BOOT_URL=http://localhost:4173/ node tools/boot-time.mjs [runs=5] [label]
// Run it in a quiet window (no other headless browsers), and record the load average it prints.
import { chromium } from 'playwright';
import { loadavg } from 'node:os';

const URL = process.env.BOOT_URL || 'http://localhost:4173/';
const runs = Number(process.argv[2] || 5);
const label = process.argv[3] || URL;
const shown = [];
const ready = [];
const bytes = [];
for (let i = 0; i < runs; i++) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  let js = 0;
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', async (r) => {
    if (/\.js(\?|$)/.test(r.url())) js += Number(r.headers()['content-length'] || 0);
  });
  const load = loadavg()[0];
  const t0 = Date.now();
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.renderer && window.__unstable.renderer.info.render.frame > 0, null, { timeout: 180000, polling: 50 });
  const t1 = Date.now();
  await page.waitForFunction(() => !document.getElementById('loading') && window.__unstable.state === 'menu', null, { timeout: 60000, polling: 50 });
  const t2 = Date.now();
  shown.push((t1 - t0) / 1000);
  ready.push((t2 - t0) / 1000);
  bytes.push(js);
  console.log(`${label} run ${i + 1}: world shown ${((t1 - t0) / 1000).toFixed(2)} s, menu ready ${((t2 - t0) / 1000).toFixed(2)} s, load ${load.toFixed(1)}, js ${(js / 1024).toFixed(0)} kB, console errors ${errors.length}`);
  await browser.close();
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`${label} median: world shown ${med(shown).toFixed(2)} s, menu ready ${med(ready).toFixed(2)} s (runs ${shown.map((x) => x.toFixed(2)).join(', ')})`);
