// The world's sound, place by place (docs/agent/WORLD_LIFE_PLAN.md, task 7): a character stands
// at one spot in every region, at noon and at midnight, and the audio system is read back: the
// theme and ambient bed it chose, the place it heard (game/soundscape.js: shore, height, town,
// fire, green, marsh, indoors) and the level of each place layer, and the loudness of the whole
// mix (RMS on an analyser at the master bus, over 1.5 s). Then each world call is played and
// its level read. A log to listen against, not a listening: no one hears it here.
//   AUDIO_URL=http://localhost:5173/ node tools/audio-scene.mjs [out.json]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.AUDIO_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || null;
const SPOTS = [
  ['the Wash, the strand', -4, -346],
  ['Saltreach, the Lantern Tree', 0, 0],
  ['Saltreach, the Watch yard', -29, -38],
  ['Saltreach, inside the Salted Anchor', 'inn'],
  ["Shimmerfen, Moss's Landing", -448, -250],
  ["Hightoll, the Bridge Court", -278, -129, 61],
  ['Thornwood, the forest', 1440, 60],
  ['Meridian, the Ward', 1076, -604],
  ['the Ashen Spire, Cinderstead', 261, -1326],
  ['Frosthollow, the village', -909, 1312],
  ['the Hush, the landing', -1034, 1102],
  ['the Verdance, Canopy Landing', -45, 1149],
  ["the Anchor's Fall", 14, 690],
  ['at sea, off the Gallows', 700, -150, 'sea'],
  ['the Rift, the arrival shelf', 6000, 5832],
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
await page.evaluate(async () => {
  const g = window.__unstable;
  const { RACES } = await import('/src/data/races.js');
  g.input.requestLock = () => {};
  g.startGame(g.createCharacter({ name: 'Listener', race: RACES[0].id, look: {} }), false);
  const { G } = await import('/src/core/globals.js');
  window.G = G;
  for (const s of g.spawners) s.def = { ...s.def, count: 0 };
  setInterval(() => { for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true; }, 300);
  g.player.invulnerable = true;
  g.audio.init();
  const A = g.audio;
  const an = A.ctx.createAnalyser();
  an.fftSize = 2048;
  A.master.connect(an);
  const buf = new Float32Array(an.fftSize);
  window.__rms = async (ms) => {
    let sum = 0, n = 0, peak = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) { sum += v * v; n++; peak = Math.max(peak, Math.abs(v)); }
      await new Promise((r) => setTimeout(r, 50));
    }
    return { rms: Math.sqrt(sum / Math.max(1, n)), peak };
  };
});
const rows = [];
for (const [name, x, z, y] of SPOTS) {
  for (const time of [0.5, 0.0]) {
    const r = await page.evaluate(async ([x, z, y, time]) => {
      const g = window.__unstable, p = g.player;
      if (p.boat) p.leaveBoat();
      if (x === 'inn') {
        const inn = g.world.interiors.find((i) => i.name === 'The Salted Anchor');
        x = inn.x; z = inn.z; y = inn.floor + 0.1;
      }
      g.inRift = x > 3000;
      if (y === 'sea') {
        const { Boat } = await import('/src/entities/boat.js');
        const b = new Boat(p.pos.clone().set(x, 0, z), 0, 'sloop');
        g.boats.push(b);
        p.enterBoat(b);
      } else p.pos.set(x, g.world.groundAt(x, z, typeof y === 'number' ? y + 1 : 400) + 0.1, z);
      p.vel.set(0, 0, 0);
      g.world.sky.time = time;
      await new Promise((r) => setTimeout(r, 2500));
      const A = g.audio;
      const layers = {};
      for (const [k, l] of Object.entries(A.placeBed?.layers || {})) layers[k] = +l.g.gain.value.toFixed(4);
      const level = await window.__rms(1500);
      const out = { theme: A.themeId, place: Object.fromEntries(Object.entries(A.place || {}).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v])), layers, muffle: A.muffle ? Math.round(A.muffle.frequency.value) : null, rms: +level.rms.toFixed(4), peak: +level.peak.toFixed(3) };
      if (p.boat) { const b = p.boat; p.leaveBoat(); g.boats.splice(g.boats.indexOf(b), 1); b.dispose(); }
      return out;
    }, [x, z, y, time]);
    rows.push({ name, time: time === 0.5 ? 'noon' : 'midnight', ...r });
    const on = Object.entries(r.layers).filter(([, v]) => v > 0.001).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
    console.log(`${name}, ${time === 0.5 ? 'noon' : 'midnight'}: ${r.theme}; place layers ${on}${r.muffle && r.muffle < 5000 ? ', muffled' : ''}; mix RMS ${r.rms} (peak ${r.peak})`);
  }
}
// each world call, at the player
const calls = await page.evaluate(async () => {
  const g = window.__unstable, out = {};
  const base = await window.__rms(800);
  for (const name of ['lifeDrum', 'lifeHorn', 'lifeHail', 'lifeHunt']) {
    g.audio.play(name, { vol: 0.9 });
    out[name] = +(await window.__rms(1200)).peak.toFixed(3);
  }
  out.base = +base.peak.toFixed(3);
  return out;
});
console.log(`world calls, peak level (the bed alone peaked at ${calls.base}): ${['lifeDrum', 'lifeHorn', 'lifeHail', 'lifeHunt'].map((k) => `${k} ${calls[k]}`).join(', ')}`);
console.log(`console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ rows, calls, errors }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
