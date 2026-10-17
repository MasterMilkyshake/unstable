// A new player's first run, scripted with real input and screenshotted: the main menu → a slot →
// character creation → waking on the Wash → walking to Old Wren and taking her task → raising
// the fists and the first fight on the strand → Wren's turn-in → the walk up the bay and through
// the sea gate to Saltreach → Maren → Sage Ilvar. Along the way it records every first-time tip
// that shows, the toasts, and the console.
//   FIRST_URL=http://localhost:5173/ node tools/first-run.mjs <screenshot dir> [1280x720 1920x1080 ...]
// A fresh browser per size. The bot holds W and Shift toward each waypoint (planned by the
// enemies' grid), presses [E] at people, clicks dialogue, and in a fight faces the nearest foe
// and clicks to attack; if health falls under a quarter it is topped up, and the report says so.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.FIRST_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || 'first-run';
const sizes = process.argv.slice(3).length ? process.argv.slice(3) : ['1280x720', '1920x1080'];
let failed = false;

for (const size of sizes) {
  const [W, H] = size.split('x').map(Number);
  const dir = `${OUT}/${size}`;
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
  const steps = [];
  const step = (name, ok, detail = '') => {
    steps.push({ name, ok });
    if (!ok) failed = true;
    console.log(`${size}  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };
  let n = 0;
  const shot = (name) => page.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-${name}.png` });
  const wait = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world && window.__unstable.state === 'menu', null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = window.__unstable;
    const { G } = await import('/src/core/globals.js');
    const { navGrid, navBody } = await import('/src/entities/nav.js');
    g.world.sky.update = ((u) => function (...a) {
      if (this.time > 0.6 || this.time < 0.25) this.time = 0.32; // keep it a readable morning
      return u.apply(this, a);
    })(g.world.sky.update);
    const log = (window.__log = { tips: [], toasts: [], healed: 0, kills: 0 });
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = (m, k) => (log.toasts.push(String(m)), toast(m, k));
    const bot = (window.__bot = { mode: 'idle', hops: null, near: 1.2 });
    const I = g.input;
    let lastPos = null;
    let stuckT = 0;
    let swingT = 0;
    g.updatePlaying = ((update) => (dt) => {
      const p = g.player;
      const tip = document.querySelector('#tip.on .tip-t');
      if (tip && !log.tips.includes(tip.textContent)) log.tips.push(tip.textContent);
      if (!p || g.ui.isOpen()) return update(dt);
      if (p.hp < p.maxHp * 0.25 && !p.knocked) {
        p.hp = p.maxHp;
        log.healed++;
      }
      I.down.delete('KeyW');
      I.down.delete('ShiftLeft');
      if (bot.mode === 'walk') {
        if (!bot.hops) {
          const r = navGrid(g.world).findPath(p.pos.x, p.pos.z, p.pos.y, bot.x, bot.z, NaN, navBody(p), 120000);
          bot.hops = r ? r.points.map((q) => [q[0], q[2]]) : [];
        }
        while (bot.hops.length && Math.hypot(bot.hops[0][0] - p.pos.x, bot.hops[0][1] - p.pos.z) < 0.7) bot.hops.shift();
        const [hx, hz] = bot.hops.length ? bot.hops[0] : [bot.x, bot.z];
        if (Math.hypot(bot.x - p.pos.x, bot.z - p.pos.z) < bot.near) bot.mode = 'idle';
        else {
          g.camYaw = Math.atan2(hx - p.pos.x, hz - p.pos.z);
          I.down.add('KeyW');
          if (bot.sprint) I.down.add('ShiftLeft');
          if ((stuckT += dt) > 1.5) {
            stuckT = 0;
            if (lastPos && Math.hypot(p.pos.x - lastPos[0], p.pos.z - lastPos[1]) < 0.4) I.pressed.add('Space');
            lastPos = [p.pos.x, p.pos.z];
          }
        }
      } else if (bot.mode === 'fight') {
        let foe = null;
        let bd = 60;
        for (const a of G.actors) {
          if (a.dead || a.team !== 'enemy' || !bot.types.includes(a.type)) continue;
          const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
          if (d < bd) {
            bd = d;
            foe = a;
          }
        }
        if (foe) {
          g.camYaw = Math.atan2(foe.pos.x - p.pos.x, foe.pos.z - p.pos.z);
          if (foe.knocked && bd < 2.5) I.pressed.add('KeyB');
          else if (bd > 1.9) I.down.add('KeyW');
          else if ((swingT -= dt) <= 0) {
            swingT = 0.32;
            I.mPressed[0] = true;
          }
        }
      }
      update(dt);
    })(g.updatePlaying.bind(g));
    G.actors.__watch = true;
  });
  const walk = async (x, z, near = 1.6, sprint = true) => {
    await page.evaluate(([x, z, near, sprint]) => Object.assign(window.__bot, { mode: 'walk', x, z, near, sprint, hops: null }), [x, z, near, sprint]);
    return wait(() => window.__bot.mode === 'idle', null, 120000);
  };
  const where = () => page.evaluate(() => {
    const p = window.__unstable.player.pos;
    return `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
  });
  const npcAt = (id) => page.evaluate((id) => {
    const n = window.__unstable.npcs.find((x) => x.id === id);
    return n ? [n.pos.x, n.pos.z] : null;
  }, id);
  const pressE = () => page.evaluate(() => window.__unstable.input.pressed.add('KeyE'));
  const say = async (re) => {
    const ok = await wait(() => document.querySelector('#dialogue .dl-opt'), null, 5000);
    if (!ok) return null;
    const btn = page.locator('#dialogue .dl-opt').filter({ hasText: re }).first();
    if (!(await btn.count())) return null;
    const label = await btn.innerText();
    await btn.click();
    await page.waitForTimeout(250);
    return label;
  };
  const talkTo = async (id, label) => {
    const at = await npcAt(id);
    if (!at) return step(`${label}: in the world`, false);
    await walk(at[0], at[1], 2.2, false);
    await pressE();
    const open = await wait(() => window.__unstable.ui.modal && window.__unstable.ui.modal.id === 'dialogue', null, 4000);
    return open;
  };

  // ---------------------------------------------------------------- the menu and creation
  await page.waitForTimeout(1500);
  await shot('main-menu');
  await page.click('#main-menu [data-a="new"]');
  await page.waitForSelector('#slots .slot-row');
  await shot('slots');
  await page.click('#slots [data-slot="1"]');
  await page.waitForSelector('#creation #cr-name');
  await shot('creation');
  const fits = await page.evaluate(() => {
    const p = document.querySelector('#creation .panel').getBoundingClientRect();
    const b = document.querySelector('#creation [data-a="begin"]').getBoundingClientRect();
    return { panel: p.bottom <= innerHeight + 1 && p.right <= innerWidth + 1, begin: b.bottom <= innerHeight };
  });
  step('creation fits the window, Wake Up in view without scrolling', fits.panel && fits.begin, JSON.stringify(fits));
  await page.click('#creation [data-a="begin"]');
  step('waking on the Wash', await wait(() => window.__unstable.state === 'playing'), await where());
  await page.waitForTimeout(2600);
  await shot('the-wash-wakes');

  // ---------------------------------------------------------------- Old Wren
  const met = await talkTo('wren', 'Old Wren');
  step('walking to Old Wren and [E]', met, await where());
  await shot('wren');
  const l1 = await say(/Where am I/);
  const l2 = await say(/I can fight/);
  await shot('wren-offer');
  const l3 = await say(/I will do it/);
  step("taking Wren's task", !!(l1 && l2 && l3) && (await page.evaluate(() => !!window.__unstable.ch.quests.awakening)), [l1, l2, l3].join(' → '));
  await page.waitForTimeout(1200);

  // ---------------------------------------------------------------- the first fight
  const camp = await page.evaluate(() => {
    const s = window.__unstable.spawners.filter((x) => x.def.type === 'mudlurker').sort((a, b) => Math.hypot(a.def.x, a.def.z + 330) - Math.hypot(b.def.x, b.def.z + 330))[0];
    return [s.def.x, s.def.z];
  });
  await walk(camp[0] + 8, camp[1] + 8, 3, false);
  await page.waitForTimeout(1500);
  await shot('fists-down');
  await page.evaluate(() => window.__unstable.input.pressed.add('Digit1'));
  await page.waitForTimeout(600);
  const armed = await page.evaluate(() => window.__unstable.ch.armed);
  step('[1] raises the fists', armed);
  await page.evaluate(() => Object.assign(window.__bot, { mode: 'fight', types: ['mudlurker'] }));
  let shotFight = false;
  const fought = await (async () => {
    for (let t = 0; t < 120; t++) {
      await page.waitForTimeout(500);
      if (!shotFight && t === 6) {
        await shot('first-fight');
        shotFight = true;
      }
      const st = await page.evaluate(() => window.__unstable.ch.quests.awakening && window.__unstable.ch.quests.awakening.state);
      if (st === 'ready') return true;
    }
    return false;
  })();
  await page.evaluate(() => (window.__bot.mode = 'idle'));
  const kills = await page.evaluate(() => window.__unstable.ch.stats.kills);
  step('the first fight: three mudlurkers', fought, `${kills} kills, ${await page.evaluate(() => window.__log.healed)} top-ups`);
  await page.waitForTimeout(1500);
  await shot('after-the-fight');
  await talkTo('wren', 'Old Wren');
  const t1 = await say(/Here/);
  await page.waitForTimeout(800);
  step("Wren's turn-in pays the bronze sword", !!t1 && (await page.evaluate(() => window.__unstable.ch.inventory.weapons.some((w) => w.id === 'bronze_sword'))));
  await shot('wren-turn-in');
  // Wren then sends you to Saltreach
  for (const re of [/Saltreach|Where now|What now|keeper|Keeper/i, /I will|on my way|go/i]) await say(re);
  await page.evaluate(() => window.__unstable.ui.closeAll());
  await page.waitForTimeout(500);
  const fl = await page.evaluate(() => window.__unstable.ch.quests.first_light && window.__unstable.ch.quests.first_light.state);
  step('Wren sends you on to Saltreach', !!fl, fl || 'not started');

  // ---------------------------------------------------------------- to Saltreach
  const route = [[0, -322], [-30, -280], [-34, -220], [-30, -160], [4, -104], [0, -40], [0, 0]];
  let reached = true;
  for (const [x, z] of route) {
    if (!(await walk(x, z, 3))) {
      reached = false;
      break;
    }
    if (z === -160) await shot('up-the-bay');
  }
  step('walking up the bay and through the sea gate to Saltreach', reached, await where());
  await page.waitForTimeout(1500);
  await shot('saltreach');
  const metMaren = await talkTo('maren', 'Maren');
  const m1 = await say(/Something is wrong/);
  await shot('maren');
  const m2 = await say(/find out|I'll/);
  await page.evaluate(() => window.__unstable.ui.closeAll());
  step('Maren takes the first chapter and gives the writ', metMaren && !!m1 && (await page.evaluate(() => !!window.__unstable.ch.quests.writ)), [m1, m2].join(' → '));

  // ---------------------------------------------------------------- Sage Ilvar
  const metIlvar = await talkTo('ilvar', 'Ilvar');
  step('walking to Sage Ilvar on Sage\'s Rise', metIlvar, await where());
  const ilvarText = await page.evaluate(() => (document.querySelector('#dialogue .dl-text') || {}).textContent || '');
  await page.evaluate(() => document.querySelector('#dialogue .dl-text') && document.querySelector('#dialogue .dl-text').click());
  await page.waitForTimeout(300);
  await shot('ilvar');
  await page.evaluate(() => window.__unstable.ui.closeAll());

  const log = await page.evaluate(() => window.__log);
  console.log(`${size}  tips shown: ${log.tips.join(' · ') || 'none'}`);
  console.log(`${size}  Ilvar: ${ilvarText.slice(0, 140)}`);
  const own = errors.filter((e) => !/ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(e));
  step('no console errors or warnings', own.length === 0, own.slice(0, 4).join(' || '));
  await browser.close();
}
process.exit(failed ? 1 : 0);
