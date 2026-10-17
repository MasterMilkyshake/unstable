// The release's robustness check, on the BUILT bundle (vite preview), with only what a player
// has: the page, its keys and the debug handle window.__unstable.
//   - a tour: a new character from the menu, then every region and dungeon in turn (moved there),
//     each held a few seconds with every menu opened and closed by its key; the Rift, its Ascent
//     and the Landing; quit to the menu and continue;
//   - no network request after the game has loaded, and the game booting with the internet cut;
//   - corrupted, wrong-typed and missing saves, settings and legacy, each booting to a working menu;
//   - zero console errors or warnings, and no error toast, in all of it.
//   TOUR_URL=http://localhost:4173/ node tools/release-tour.mjs [screenshot dir]
// Exits 1 on any failure.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.TOUR_URL || 'http://localhost:4173/';
const OUT = process.argv[2] || null;
if (OUT) mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let failed = false;
const report = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// placed world positions, one or two per region (+x is west)
const PLACES = [
  ['the Wash', 0, -330], ['Saltreach', 0, 0], ["Sage's Rise", 40, 48], ['the Crucible', 120, 8], ['Reedbank', -480, -266], ['Witchwater', -680, -325],
  ['the Hundred Arches', -573, -553], ['Hightoll', -278, -128], ["Saint Ebb's Light", -320, -620], ["the Gull's Reach", 160, -360], ['Gallows Rock', 420, -330],
  ["Rook's Landing", 1123, 155], ['Brigand Hold', 1360, 130], ['Owlroost Hollow', 1230, -30], ['Fort Meridian', 1190, -676], ['the Crown Drydock', 1206, -890],
  ['Cinderstead', 261, -1326], ['the Caldera', 340, -1200], ["the Anchor's Fall", 0, 700], ['Canopy Landing', -45, 1149], ['Kingsfall', -20, 1320],
  ['Frostwatch', -909, 1312], ['the White Hollow', -1040, 1470], ['Hush Landing', -1034, 1102], ['the Sounding House', -1260, 1126],
];
const RIFT = [['the arrival shelf', 6000, 5840], ['the Gate Plaza', 6000, 5961], ['the Drowned Keep', 5950, 6075], ['the Landing That Never Came', 5900, 6152]];

async function open(opts = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (opts.storage) await context.addInitScript((s) => { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, opts.storage);
  if (opts.offline) await context.route((u) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), (r) => r.abort('internetdisconnected'));
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  let loaded = false;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
  page.on('request', (r) => requests.push({ url: r.url(), after: loaded }));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world && window.__unstable.state === 'menu' && window.__unstable.renderer.info.render.frame > 0, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  loaded = true;
  return { browser, page, errors, requests };
}
const key = (page, code) => page.evaluate((code) => {
  // the game listens on window
  const opts = { code, key: code, bubbles: true };
  window.dispatchEvent(new KeyboardEvent('keydown', opts));
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', opts)), 30);
}, code);

// ---------------------------------------------------------------- the tour
{
  const { browser, page, errors, requests } = await open();
  await page.evaluate(() => {
    const g = window.__unstable;
    g.input.requestLock = () => {};
    window.__badToasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = (m, k) => {
      if (/went wrong|error|failed/i.test(String(m))) window.__badToasts.push(String(m));
      return toast(m, k);
    };
  });
  await page.click('#main-menu [data-a="new"]');
  await page.waitForSelector('#slots [data-slot="1"]');
  await page.click('#slots [data-slot="1"]');
  await page.waitForSelector('#creation [data-a="begin"]');
  await page.click('#creation [data-a="begin"]');
  await page.waitForFunction(() => window.__unstable.state === 'playing', null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__unstable;
    const p = g.player;
    p.onLethal = () => (p.hp = p.maxHp); // a tour, not a fight
    g.ch.armed = true;
  });
  const menus = async () => {
    for (const code of ['Tab', 'Backquote', 'KeyM', 'KeyJ']) {
      await key(page, code);
      await page.waitForTimeout(350);
      const opened = await page.evaluate(() => window.__unstable.ui.modal && window.__unstable.ui.modal.id);
      if (!opened) return `${code} opened nothing`;
      await page.evaluate(() => window.__unstable.ui.closeModal());
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.__unstable.ui.openPause());
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => window.__unstable.ui.modal && window.__unstable.ui.modal.id === 'pause');
    await page.evaluate(() => window.__unstable.ui.closeModal());
    return paused ? '' : 'Esc opened no pause';
  };
  const visit = async (name, x, z) => {
    await page.evaluate(([x, z]) => {
      const g = window.__unstable;
      const p = g.player;
      const w = g.world;
      p.pos.set(x, w.groundAt(x, z, Math.max(w.terrain.heightAt(x, z), 0) + 80) + 0.2, z);
      p.vel.set(0, 0, 0);
      p.fallStart = p.pos.y;
      g.inRift = w.inRift(x);
      for (const a of window.__G.actors) if (a.team === 'enemy') a.despawn = true;
    }, [x, z]);
    await page.waitForTimeout(3000);
    const bad = await menus();
    if (OUT) await page.screenshot({ path: `${OUT}/${name.replace(/[^a-z0-9]+/gi, '-')}.png` });
    return bad;
  };
  const before = errors.length;
  const tourBad = [];
  for (const [n, x, z] of PLACES) {
    const bad = await visit(n, x, z);
    if (bad) tourBad.push(`${n}: ${bad}`);
  }
  report(`surface tour: ${PLACES.length} places, every menu by its key`, tourBad.length === 0 && errors.length === before, [...tourBad, ...errors.slice(before, before + 3)].join(' | '));
  // the dungeons, entered by their own doors
  const dg = await page.evaluate(async () => {
    const g = window.__unstable;
    const out = [];
    for (const it of g.world.interactables.filter((x) => x.kind === 'dungeon_entrance')) {
      g.player.pos.set(it.pos.x + 1, it.pos.y, it.pos.z + 1);
      g.interact(it);
      await new Promise((r) => setTimeout(r, 2600));
      out.push([it.id, g.inDungeon || g.player.pos.z < -4800]);
      const exit = g.world.interactables.find((x) => x.id === it.id.replace('enter_', 'exit_'));
      if (exit) {
        g.player.pos.set(exit.pos.x, exit.pos.y, exit.pos.z);
        g.interact(exit);
        await new Promise((r) => setTimeout(r, 2600));
      }
    }
    return out;
  });
  report(`dungeons: in by the door and out (${dg.length})`, dg.length >= 3 && dg.every((d) => d[1]), dg.map((d) => d.join(' ')).join(', '));
  // the Rift: a surface death's way down, then its places
  const before2 = errors.length;
  await page.evaluate(() => window.__unstable.enterRift(true));
  await page.waitForTimeout(3500);
  const riftBad = [];
  for (const [n, x, z] of RIFT) {
    const bad = await visit(n, x, z);
    if (bad) riftBad.push(`${n}: ${bad}`);
  }
  report(`the Rift: ${RIFT.length} places`, riftBad.length === 0 && errors.length === before2, [...riftBad, ...errors.slice(before2, before2 + 3)].join(' | '));
  // home by the summit wound, then save, quit and continue
  const home = await page.evaluate(async () => {
    const g = window.__unstable;
    const it = g.world.interactables.find((x) => x.id === 'ascent_summit');
    g.player.pos.set(it.pos.x, it.pos.y, it.pos.z);
    g.interact(it);
    await new Promise((r) => setTimeout(r, 2600));
    return !g.inRift;
  });
  report('home through the summit wound', home);
  await page.evaluate(() => window.__unstable.quitToMenu());
  await page.waitForTimeout(800);
  await page.click('#main-menu [data-a="continue"]');
  const back = await page.waitForFunction(() => window.__unstable.state === 'playing', null, { timeout: 20000 }).then(() => true, () => false);
  report('quit to the menu and continue', back);
  const toasts = await page.evaluate(() => window.__badToasts);
  report('no error toasts', toasts.length === 0, toasts.slice(0, 3).join(' | '));
  const after = requests.filter((r) => r.after && !/^(data|blob):/.test(r.url));
  report('no network requests after loading', after.length === 0, after.slice(0, 4).map((r) => r.url).join(', '));
  const external = [...new Set(requests.filter((r) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(r.url) && !/^(data|blob):/.test(r.url)).map((r) => new globalThis.URL(r.url).host))];
  report('no request leaves this machine, even at load (the fonts are bundled)', external.length === 0, external.join(', '));
  report('zero console errors or warnings on the tour', errors.length === 0, errors.slice(0, 4).join(' || '));
  await browser.close();
}

// ---------------------------------------------------------------- with the internet cut
{
  const { browser, page, errors } = await open({ offline: true });
  const ok = await page.evaluate(async () => {
    const g = window.__unstable;
    g.input.requestLock = () => {};
    g.startGame(g.createCharacter({ name: 'Offline', race: 'ashkin', look: {} }), true);
    await new Promise((r) => setTimeout(r, 3000));
    await document.fonts.ready;
    const faces = ['16px Cinzel', '16px "EB Garamond"', 'italic 16px "EB Garamond"'].map((f) => document.fonts.check(f) && [...document.fonts].some((ff) => ff.status === 'loaded' && f.includes(ff.family.replace(/"/g, ''))));
    return { playing: g.state === 'playing' && g.renderer.info.render.frame > 0, faces };
  });
  report('boots and plays with the internet cut, in its own typefaces', ok.playing && ok.faces.every(Boolean) && errors.length === 0, `faces loaded ${ok.faces.join('/')}; ${errors.slice(0, 3).join(' | ')}`);
  await browser.close();
}

// ---------------------------------------------------------------- bad stored values
const good = JSON.stringify({ character: { name: 'Kept', race: 'ashkin', level: 3, lives: 2, maxLives: 3, inventory: { items: { bread: 2 }, weapons: [], outfits: ['rags'] }, stats: { kills: 4, playtime: 300 } }, savedAt: 5 });
const CASES = [
  ['garbage in every key', { 'unstable.save.v1': '{not json', 'unstable.save.v1.bak': 'nope', 'unstable.save.v1.slot2': '[]', 'unstable.settings.v1': '}{', 'unstable.legacy.v1': 'undefined', 'unstable.tips.v1': '{"a":1}' }, 0],
  ['wrong types everywhere', { 'unstable.save.v1': JSON.stringify({ character: 'x' }), 'unstable.save.v1.slot3': JSON.stringify({ character: { name: 7, level: 'high', lives: 'many', inventory: null, stats: 'none', quests: 5 } }), 'unstable.settings.v1': JSON.stringify({ fov: 'wide', quality: 9, uiScale: -4, master: null, tips: 'yes' }), 'unstable.legacy.v1': JSON.stringify({ remembrance: 'lots', lost: {}, heirloom: 3, pending: [] }) }, 1],
  ['a broken save with a good backup', { 'unstable.save.v1': '{"character":', 'unstable.save.v1.bak': good }, 1],
  ['nothing stored at all', {}, 0],
];
for (const [name, storage, slots] of CASES) {
  const { browser, page, errors } = await open({ storage });
  const st = await page.evaluate(async () => {
    const g = window.__unstable;
    const rows = [...document.querySelectorAll('#main-menu .menu-btns .btn')].map((b) => b.dataset.a);
    const s = g.settings;
    let played = false;
    if (rows.includes('continue')) {
      document.querySelector('#main-menu [data-a="continue"]').click();
      await new Promise((r) => setTimeout(r, 2500));
      played = g.state === 'playing';
      if (played) g.quitToMenu();
    }
    return { rows, played, settingsOk: typeof s.fov === 'number' && ['high', 'medium', 'low'].includes(s.quality) && s.uiScale >= 0.85 && s.uiScale <= 1.3 && typeof s.tips === 'boolean' };
  });
  const filled = st.rows.filter((r) => r === 'continue').length;
  const own = errors.filter((e) => !/\[save\] migrated character/.test(e));
  report(`bad values: ${name}`, st.rows.includes('new') && st.settingsOk && (slots ? st.played : true) && own.length === 0, `menu [${st.rows.join(', ')}], continue played ${st.played}, ${errors.length - own.length} migration note(s); ${own.slice(0, 3).join(' | ')}`);
  void filled;
  await browser.close();
}
process.exit(failed ? 1 : 0);
