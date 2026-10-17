// Every panel of the interface at each window size, screenshotted and measured: the panel
// inside the window, no text running past its box or clipped by a hidden overflow, nothing
// of the HUD off screen. Then every setting changed through the Settings screen and checked to
// take effect at once (and to be saved), the three qualities included, and the interface size
// at its largest re-measured.
//   UI_URL=http://localhost:5173/ node tools/ui-check.mjs <screenshot dir> [1280x720 1920x1080 2560x1440]
// A fresh browser per size. Exits 1 on any failure; the screenshots are for looking at.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.UI_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || 'ui-check';
const sizes = process.argv.slice(3).length ? process.argv.slice(3) : ['1280x720', '1920x1080', '2560x1440'];
let failed = false;

// What each check opens, from where. `menu` ones run from the main menu, the rest in play.
const PANELS = [
  { id: 'main-menu', menu: true, open: () => window.__unstable.ui.showMainMenu(), sel: '#main-menu .menu-btns' },
  { id: 'slots', menu: true, open: () => window.__unstable.ui.openSlots('load'), sel: '#slots .panel' },
  { id: 'slots-confirm', menu: true, open: () => { window.__unstable.ui.openSlots('new'); document.querySelector('#slots [data-slot="1"]').click(); }, sel: '#slots .panel' },
  { id: 'register', menu: true, open: () => window.__unstable.ui.openRegister(), sel: '#register .panel' },
  { id: 'creation', menu: true, open: () => window.__unstable.ui.showCreation(3), sel: '#creation .panel' },
  { id: 'wipe', menu: true, open: () => window.__unstable.ui.showWipe(null), sel: '#wipe .panel' },
  { id: 'lan-menu', menu: true, open: () => window.__unstable.ui.openLan(true), sel: '#lan .panel' },
  { id: 'settings', menu: true, open: () => window.__unstable.ui.game && import('/src/ui/screens.js').then((m) => m.openSettings(window.__unstable.ui, null)), sel: '#settings .panel' },
  { id: 'help', menu: true, open: () => import('/src/ui/screens.js').then((m) => m.openHelp(window.__unstable.ui, null)), sel: '#help .panel' },
  { id: 'hud', open: () => null, sel: '#hud' },
  { id: 'hud-boss', open: () => { const g = window.__unstable; const e = g.spawnEnemy('duelist', g.player.pos.clone().add({ x: 6, y: 0, z: 6 }), {}); g.startBoss(e); }, sel: '#hud' },
  { id: 'pause', open: () => window.__unstable.ui.openPause(), sel: '#pause .panel' },
  ...['attrs', 'talents', 'mantras', 'inventory', 'quests', 'vow'].map((t) => ({ id: `character-${t}`, open: new Function(`window.__unstable.ui.openCharMenu('${t}')`), sel: '#charmenu .panel' })),
  ...['traits', 'gear'].map((t) => ({ id: `gear-${t}`, open: new Function(`return import('/src/game/hooks.js').then((h) => h.ACTIONS.openGear(window.__unstable.ui, '${t}'))`), sel: '#gear .panel' })),
  ...['story', 'standing', 'chronicle', 'atlas', 'investigations', 'lore', 'bestiary', 'records', 'guide'].map((t) => ({ id: `journal-${t}`, open: new Function(`return import('/src/game/hooks.js').then((h) => h.ACTIONS.openJournal(window.__unstable.ui, '${t}'))`), sel: '#journal .panel' })),
  { id: 'map', open: () => window.__unstable.ui.openMap(), sel: '#map .panel' },
  { id: 'shop-dorran', open: () => window.__unstable.ui.openShop('dorran'), sel: '#shop .panel, .screen .panel' },
  { id: 'shop-pell', open: () => window.__unstable.ui.openShop('pell'), sel: '.screen .panel' },
  { id: 'dialogue', open: () => { const g = window.__unstable; const n = g.npcs.find((x) => x.id === 'maren'); g.interact({ kind: 'npc', npc: n }); }, sel: '#dialogue .panel' },
  { id: 'temper', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openTemper(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'enchant', open: () => import('/src/ui/interact.js').then((m) => m.openEnchant(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'jeweler', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openJeweler(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'altar', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openAltar(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'vows', open: () => window.__unstable.ui.openVows(), sel: '#vows .panel' },
  { id: 'resonances', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openResonances(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'crucible', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openCrucible(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'mark-shop', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openMarkShop(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'boatyard', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openBoatyard(window.__unstable.ui, Object.keys(window.__unstable.world.docks)[0])), sel: '.screen .panel' },
  { id: 'cooking', open: () => import('/src/game/crafting.js').then((m) => m.openCookMenu(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'order-shrine', open: () => import('/src/game/hooks.js').then((h) => h.ACTIONS.openOrder(window.__unstable.ui)), sel: '.screen .panel' },
  { id: 'lan-play', open: () => window.__unstable.ui.openLan(false), sel: '#lan .panel' },
  { id: 'seat', open: () => { const g = window.__unstable; g.ch.bossesDefeated.push('hollow_duke'); const it = g.world.interactables.find((x) => x.id === 'anchor_seat'); it && it.use(g); }, sel: '#seat .panel' },
  { id: 'victory', open: () => window.__unstable.ui.showVictory(), sel: '#victory .panel' },
  // the loot panels, full, with the longest names: a lost pouch, leaving a pouch, the strongbox
  { id: 'loot', open: () => import('/src/game/loot.js').then((m) => m.openLoot(window.__unstable, { id: 'ui-check', title: 'WHAT YOU LOST', note: 'Left where you fell.', contents: () => ({ silver: 12345, items: { owl_feather: 3, fish_stew: 2, sanity_draught: 4, berry_tart: 1, cleansing_salts: 6, bread: 9 }, weapons: [{ uid: 'u1', id: 'woodcutter_axe', enchant: null }, { uid: 'u2', id: 'hollow_crown', enchant: null }], trinkets: [{ uid: 't1', id: 'hollow_circlet' }] }), take: () => true })), sel: '#loot .panel' },
  { id: 'droppouch', open: () => { const g = window.__unstable; g.ch.silver = 12345; Object.assign(g.ch.inventory.items, { owl_feather: 3, fish_stew: 2, sanity_draught: 4, berry_tart: 1, cleansing_salts: 6, bread: 9 }); g.giveWeapon('woodcutter_axe'); g.giveWeapon('hollow_crown'); return import('/src/game/hooks.js').then((h) => h.ACTIONS.openDropPanel(g.ui)); }, sel: '#droppouch .panel' },
  { id: 'bank', open: () => { const g = window.__unstable; g.ch.bank = { silver: 98765, items: { owl_feather: 2, cleansing_salts: 3, fish_stew: 1 }, weapons: [{ uid: 'b1', id: 'lanternless_scythe', enchant: null }], trinkets: [{ uid: 'b2', id: 'colossus_heart' }] }; return import('/src/game/hooks.js').then((h) => h.ACTIONS.openBank(g.ui)); }, sel: '#bank .panel' },
  { id: 'death', open: () => window.__unstable.ui.deathScreen('THE RIFT CLAIMS YOU', '', 60000, null), sel: '#death' },
  { id: 'rift-hud', rift: true, open: () => window.__unstable.ui.banner('THE RIFT'), sel: '#hud' },
];

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
  const report = (name, ok, detail = '') => {
    if (!ok) failed = true;
    console.log(`${size}  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world && window.__unstable.state === 'menu', null, { timeout: 180000 });
  // a profile with something in it: two slots, a register, an heirloom waiting, a pending wipe
  await page.evaluate(async () => {
    const g = window.__unstable;
    const { Save } = await import('/src/core/save.js');
    const { Legacy } = await import('/src/core/legacy.js');
    const a = g.createCharacter({ name: 'Ilse Marrow-Tidewright', race: 'ashkin', look: {} });
    Object.assign(a, { level: 14, place: "The Hundred Arches' South Road" });
    a.stats.playtime = 26000;
    Save.save({ version: 1, character: a }, 1);
    const b = g.createCharacter({ name: 'Tobin Vey', race: 'kithari', look: {} });
    b.dangerQuit = true;
    Save.save({ version: 1, character: b }, 2);
    for (const [name, cause] of [['Maera Coil', 'Slain by the Grand Warden in the Drowned Keep'], ['Odo Fenn', 'Claimed by the Abyss'], ['Wil Ashby', 'Fled from battle']]) {
      const c = g.createCharacter({ name, race: 'ashkin', look: {} });
      c.level = 9;
      c.bossesDefeated = ['warlord', 'duelist', 'witch_queen', 'frost_warden'];
      c.inventory.weapons = [{ uid: 'w1', id: 'steel_longsword', temper: 2 }, { uid: 'w2', id: 'driftsteel_katana' }];
      c.trinkets = [{ uid: 't1', id: 'red_bandana' }];
      Legacy.record(c, cause, 3);
    }
  });
  const measure = (sel) => page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { missing: true };
    const vw = innerWidth;
    const vh = innerHeight;
    const r = root.getBoundingClientRect();
    const issues = [];
    if (sel !== '#hud' && (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)) issues.push(`panel ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} past the window`);
    const all = root.querySelectorAll('*');
    let clipped = 0;
    const samples = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.hidden')) continue;
      const er = el.getBoundingClientRect();
      if (!er.width || !er.height) continue;
      // HUD: nothing off screen
      if (sel === '#hud' && (er.right > vw + 1 || er.bottom > vh + 1 || er.left < -1)) {
        if (el.id || el.className) samples.push(`off screen: ${el.id || el.className}`);
        continue;
      }
      // text clipped by a box that hides its overflow (an intended ellipsis is noted, not failed)
      const ox = cs.overflowX;
      if ((ox === 'hidden' || ox === 'clip') && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0) {
        if (cs.textOverflow === 'ellipsis') continue;
        clipped++;
        if (samples.length < 4) samples.push(`clipped: ${(el.textContent || '').trim().slice(0, 40)}`);
      }
      // a single word or button wider than its own box
      if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 2) {
        clipped++;
        if (samples.length < 4) samples.push(`button overflows: ${el.textContent.trim().slice(0, 30)}`);
      }
    }
    // the panel itself scrolls sideways
    if (sel !== '#hud' && root.scrollWidth > root.clientWidth + 2 && getComputedStyle(root).overflowX !== 'visible') issues.push('scrolls sideways');
    // the panel itself must scroll to show its foot (its buttons): its lists should scroll instead
    if (sel !== '#hud' && root.scrollHeight > root.clientHeight + 2 && getComputedStyle(root).overflowY !== 'visible') issues.push(`scrolls ${root.scrollHeight - root.clientHeight} px to reach its foot`);
    return { issues: [...issues, ...samples], clipped };
  }, sel);

  let inPlay = false;
  for (const P of PANELS) {
    if (!P.menu && !inPlay) {
      await page.evaluate(async () => {
        const g = window.__unstable;
        g.ui.closeAll(true);
        g.input.requestLock = () => {};
        const c = g.createCharacter({ name: 'Ilse Marrow-Tidewright', race: 'ashkin', look: {} });
        Object.assign(c, { level: 16, silver: 4321, vow: 'blades', manaUnlocked: true, armed: true });
        const { MANTRAS } = await import('/src/data/mantras.js');
        c.mantras = { ember_bolt: { stars: 2, mods: ['potent'] }, [Object.keys(MANTRAS).find((k) => k !== 'ember_bolt' && !MANTRAS[k].bell)]: { stars: 0 } };
        c.inventory.items = { ...c.inventory.items, mantra_spark: 3, smithing_stone: 6, star_shard: 2, elixir: 4, crucible_mark: 30, meat_raw: 3, fishing_rod: 1 };
        c.quests = { awakening: { state: 'done' }, first_light: { state: 'done' }, writ: { state: 'active', stage: 1, sp: [] }, bounty: { state: 'active', progress: 2 } };
        g.startGame(c, false);
        g.giveWeapon('steel_longsword', 'searing').temper = 1;
        c.equipped.weapon = c.inventory.weapons[0].uid;
        g.player.recompute();
        // a passing foe must not end the run (a death screen closes whatever panel is open)
        g.player.onLethal = () => (g.player.hp = g.player.maxHp);
        for (const sp of g.spawners) sp.def = { ...sp.def, count: 0 };
        for (const a of window.__G.actors) if (a.team === 'enemy') a.despawn = true;
      });
      await page.waitForTimeout(2500);
      inPlay = true;
    }
    if (P.rift) {
      await page.evaluate(() => window.__unstable.enterRift(false));
      await page.waitForTimeout(2500);
    }
    await page.evaluate(() => window.__unstable.ui.closeAll(true));
    try {
      await page.evaluate(P.open);
    } catch (e) {
      report(P.id, false, 'could not open: ' + e.message.split('\n')[0]);
      continue;
    }
    await page.waitForTimeout(P.id.startsWith('hud') || P.id === 'rift-hud' ? 900 : 450);
    await page.screenshot({ path: `${dir}/${P.id}.png` });
    const m = await measure(P.sel);
    if (m.missing) report(P.id, false, `nothing at ${P.sel}`);
    else report(P.id, m.issues.length === 0, m.issues.join(' | '));
  }

  // ---------------------------------------------------------------- settings apply live
  await page.evaluate(() => window.__unstable.ui.closeAll(true));
  await page.evaluate(() => import('/src/ui/screens.js').then((m) => m.openSettings(window.__unstable.ui, null)));
  const setRange = (k, v) => page.evaluate(([k, v]) => {
    const el = document.querySelector(`#settings [data-k="${k}"]`);
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [k, v]);
  const setCheck = (k, v) => page.evaluate(([k, v]) => {
    const el = document.querySelector(`#settings [data-c="${k}"]`);
    el.checked = v;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [k, v]);
  const state = () => page.evaluate(() => {
    const g = window.__unstable;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('unstable.settings.v1') || '{}');
    } catch (_) {}
    return {
      fov: g.camera.fov, view: g.world.sky.viewDistance, shadows: g.world.sky.sun.castShadow, ratio: g.renderer.getPixelRatio(),
      bloom: g.bloom.enabled, zoom: getComputedStyle(document.getElementById('hud')).zoom, vol: { ...g.audio.vol }, s: { ...g.settings }, saved,
    };
  });
  const live = [];
  await setRange('fov', 90);
  let s = await state();
  live.push(['Field of View', s.fov === 90 && s.saved.fov === 90]);
  await setRange('viewDistance', 0.7);
  s = await state();
  live.push(['View Distance', Math.abs(s.view - 0.7) < 1e-6 && s.saved.viewDistance === 0.7]);
  for (const [k, n] of [['master', 'Master Volume'], ['sfx', 'Effects Volume'], ['music', 'Music Volume']]) {
    await setRange(k, 0.3);
    s = await state();
    live.push([n, s.vol[k] === 0.3 && s.saved[k] === 0.3]);
  }
  for (const [k, n, v] of [['sensitivity', 'Mouse Sensitivity', 2], ['cameraShake', 'Camera Shake', 0.5], ['uiScale', 'Interface Size', 1.3]]) {
    await setRange(k, v);
    s = await state();
    live.push([n, s.s[k] === v && s.saved[k] === v && (k !== 'uiScale' || Number(s.zoom) === 1.3)]);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/settings-at-130.png` });
  const big = await measure('#settings .panel');
  live.push(['the Settings panel at 130% fits', big.issues.length === 0, big.issues.join(' | ')]);
  await page.evaluate(() => { window.__unstable.ui.closeAll(true); window.__unstable.ui.openCharMenu('attrs'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/character-at-130.png` });
  const bigC = await measure('#charmenu .panel');
  live.push(['the character menu at 130% fits', bigC.issues.length === 0, bigC.issues.join(' | ')]);
  await page.evaluate(() => { window.__unstable.ui.closeAll(true); return import('/src/ui/screens.js').then((m) => m.openSettings(window.__unstable.ui, null)); });
  await setRange('uiScale', 1);
  for (const [k, n] of [['shadows', 'Shadows'], ['damageNumbers', 'Damage numbers'], ['invertY', 'Invert Y'], ['bounceLight', 'Bounce light'], ['reduceFlashing', 'Reduce flashing and shake'], ['soundCues', 'Sound cues'], ['tips', 'Tips']]) {
    const before = (await state()).s[k];
    await setCheck(k, !before);
    s = await state();
    let ok = s.s[k] === !before && s.saved[k] === !before;
    if (k === 'shadows') ok = ok && s.shadows === !before;
    if (k === 'reduceFlashing' && !before) ok = ok && s.s.cameraShake <= 0.3;
    live.push([n, ok]);
  }
  for (const q of ['low', 'medium', 'high']) {
    await page.evaluate((q) => document.querySelector(`#settings [data-q="${q}"]`).click(), q);
    await page.waitForTimeout(400);
    s = await state();
    const want = { low: [1, false], medium: [1.25, true], high: [1.5, true] }[q];
    const dpr = await page.evaluate(() => devicePixelRatio);
    live.push([`quality ${q}`, s.s.quality === q && s.saved.quality === q && s.ratio === Math.min(dpr, want[0]) && s.bloom === want[1], `pixel ratio ${s.ratio}, bloom ${s.bloom}`]);
  }
  for (const [n, ok, d] of live) report(`setting applies at once: ${n}`, ok, d || '');
  const own = errors.filter((e) => !/ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(e));
  report('no console errors or warnings', own.length === 0, own.slice(0, 4).join(' || '));
  await browser.close();
}
process.exit(failed ? 1 : 0);
