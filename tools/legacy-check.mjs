// Save slots and legacy in the real game, through the real menus, from an empty profile:
// New → a slot → creation → play → quit → Continue and Load → New on a filled slot asks before
// replacing it → a character spends its last life in the Rift → the wipe screen (its record,
// the Remembrance earned, the heirloom pick) → the Register of the Lost → a new character buys a
// reroll and a boon with Remembrance → walks to the keepsake chest at the Wash and claims the
// heirloom with [E], once.
//   LEGACY_URL=http://localhost:5173/ node tools/legacy-check.mjs [screenshot-dir]
// Prints one PASS/FAIL line per check and the console errors; exits 1 on any failure.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.LEGACY_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || null;
if (OUT) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const shot = async (name) => OUT && page.screenshot({ path: `${OUT}/${name}.png` });
const text = (sel) => page.locator(sel).first().innerText().catch(() => '');
const has = (sel) => page.locator(sel).count().then((n) => n > 0);
const state = () => page.evaluate(() => window.__unstable.state);
const until = (fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });

await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world && window.__unstable.state === 'menu', null, { timeout: 180000 });
await page.evaluate(() => {
  const g = window.__unstable;
  g.world.sky.update = ((u) => function (...a) {
    this.time = 0.42;
    return u.apply(this, a);
  })(g.world.sky.update);
  const toast = g.ui.toast.bind(g.ui);
  window.__toasts = [];
  g.ui.toast = (m, k) => (window.__toasts.push(m), toast(m, k));
});
await page.waitForTimeout(1500);

// ---- an empty profile: no Continue, no Load, no register
await shot('01-menu-empty');
check('empty profile: New Game only', !(await has('#main-menu [data-a="continue"]')) && !(await has('#main-menu [data-a="load"]')) && !(await has('#main-menu [data-a="register"]')) && (await has('#main-menu [data-a="new"]')));

// ---- New → slot II → creation → wake
await page.click('#main-menu [data-a="new"]');
await page.waitForSelector('#slots .slot-row');
await shot('02-slots-new-empty');
check('slot list shows three empty slots', (await page.locator('#slots .slot-row.empty').count()) === 3);
await page.click('#slots [data-slot="2"]');
await page.waitForSelector('#creation #cr-name');
check('creation names its slot', (await text('#creation')).includes('Slot 2'));
check('no Remembrance offered before anyone is lost', !(await text('#creation')).includes('REMEMBRANCE'));
await page.fill('#creation #cr-name', 'Ilse Marrow');
await page.click('#creation [data-a="begin"]');
await until(() => window.__unstable.state === 'playing');
let info = await page.evaluate(async () => {
  const { Save } = await import('/src/core/save.js');
  return { slot: Save.slot, s2: Save.summary(2), s1: Save.summary(1), name: window.__unstable.ch.name };
});
check('the new character plays in slot 2', info.slot === 2 && info.s2 && info.s2.name === 'Ilse Marrow' && !info.s1, JSON.stringify(info.s2 && { name: info.s2.name, place: info.s2.place }));
await page.waitForTimeout(2500);
await page.evaluate(() => window.__unstable.quitToMenu());
await until(() => window.__unstable.state === 'menu');
await page.waitForTimeout(300);
await shot('03-menu-continue');
const contText = await text('#main-menu [data-a="continue"]');
check('Continue names the last character played', contText.includes('Ilse Marrow') && contText.includes('Power 1'), contText.replace(/\n/g, ' '));

// ---- Load → the slot list → continue slot 2
await page.click('#main-menu [data-a="load"]');
await page.waitForSelector('#slots .slot-row');
await shot('04-slots-load');
const row = await text('#slots .slot-row:nth-of-type(2)');
check('the slot row shows name, race, Power, place, playtime and lives', /Ilse Marrow/.test(row) && /Power 1/.test(row) && /played/.test(row) && /3 of 3 lives/.test(row) && /The Wash|Saltreach/.test(row), row.replace(/\n/g, ' | '));
await page.click('#slots [data-slot="2"]');
await until(() => window.__unstable.state === 'playing');
check('Load continues the chosen slot', (await page.evaluate(() => window.__unstable.ch.name)) === 'Ilse Marrow');
await page.evaluate(() => window.__unstable.quitToMenu());
await until(() => window.__unstable.state === 'menu');

// ---- New on the filled slot asks first; Keep leaves it alone
await page.click('#main-menu [data-a="new"]');
await page.waitForSelector('#slots .slot-row');
await page.click('#slots [data-slot="2"]');
await page.waitForSelector('#slots .slot-confirm');
await shot('05-slots-confirm-replace');
check('New on a filled slot asks before replacing it', (await text('#slots .slot-confirm')).includes('Ilse Marrow'));
await page.click('#slots [data-a="keep"]');
check('Keep cancels the replace', !(await has('#slots .slot-confirm')) && (await page.evaluate(async () => (await import('/src/core/save.js')).Save.hasCharacter(2))));
await page.click('#slots [data-a="back"]');

// ---- a character spends its last life in the Rift
await page.click('#main-menu [data-a="continue"]');
await until(() => window.__unstable.state === 'playing');
await page.evaluate(async () => {
  const g = window.__unstable;
  const { ACTIONS } = await import('/src/game/hooks.js');
  const ch = g.ch;
  ch.level = 8;
  ch.stats.kills = 61;
  ch.stats.playtime = 3 * 3600 + 600;
  for (const id of ['awakening', 'first_light', 'writ']) ch.quests[id] = { state: 'done', stage: 0, progress: [] };
  ch.quests.red_tooth = { state: 'active', stage: 0, progress: [] };
  ch.bossesDefeated.push('duelist');
  g.giveWeapon('bronze_sword', 'searing').temper = 2;
  ACTIONS.giveTrinket('shell_necklace');
  ch.lives = 1;
  g.enterRift(false);
});
await until(() => window.__unstable.inRift, null, 10000);
await page.waitForTimeout(800);
await page.evaluate(() => window.__unstable.onPlayerDeath({ name: 'a Rift Hollow' }));
const recorded = await page.evaluate(async () => {
  const { Legacy } = await import('/src/core/legacy.js');
  const { Save } = await import('/src/core/save.js');
  const l = Legacy.load();
  return { lost: l.lost.length, rem: l.remembrance, pending: l.pending && l.pending.options.map((o) => o.name), slot2: Save.hasCharacter(2) };
});
check('the last life spent: recorded at once, the slot emptied', recorded.lost === 1 && recorded.rem > 0 && !recorded.slot2, JSON.stringify(recorded));
await page.waitForSelector('#wipe .panel', { timeout: 15000 });
await page.waitForTimeout(400);
await shot('06-wipe');
const wipe = await text('#wipe');
check('the wipe screen shows the record and the Remembrance earned', /Ilse Marrow/.test(wipe) && /Power 8/.test(wipe) && /Slain by a Rift Hollow/.test(wipe) && /61/.test(wipe) && /Sera Vane/.test(wipe) && /Remembrance/.test(wipe) && /3 h 10 min/.test(wipe), wipe.split('\n').slice(0, 12).join(' | '));
check('Return waits for an heirloom choice', await page.locator('#wipe [data-a="ok"][disabled]').count() === 1);
await page.click('#wipe [data-pick="0"]');
await shot('07-wipe-heirloom-picked');
await page.click('#wipe [data-a="ok"]');
await page.waitForSelector('#main-menu [data-a="register"]');
const heir = await page.evaluate(async () => (await import('/src/core/legacy.js')).Legacy.load().heirloom);
check('the chosen heirloom waits', heir && heir.id === 'bronze_sword' && heir.temper === 2 && heir.enchant === 'searing', JSON.stringify(heir));
await shot('08-menu-register');

// ---- the Register of the Lost
await page.click('#main-menu [data-a="register"]');
await page.waitForSelector('#register .lost-row');
await shot('09-register');
const reg = await text('#register');
check('the register lists the lost character', /Ilse Marrow/.test(reg) && /Slain by a Rift Hollow/.test(reg) && /Bronze Sword \+2/.test(reg) && /keepsake chest/.test(reg), reg.split('\n').slice(0, 10).join(' | '));
await page.click('#register [data-a="back"]');

// ---- a new character spends Remembrance at creation
await page.click('#main-menu [data-a="new"]');
await page.waitForSelector('#slots .slot-row');
await page.click('#slots [data-slot="1"]');
await page.waitForSelector('#creation #cr-name');
await shot('10-creation-remembrance');
const before = await page.evaluate(async () => (await import('/src/core/legacy.js')).Legacy.load().remembrance);
const rerollsBefore = (await text('#creation [data-a="reroll"]')).match(/\((\d+) left\)/)[1];
await page.click('#creation [data-a="buyreroll"]');
const rerollsAfter = (await text('#creation [data-a="reroll"]')).match(/\((\d+) left\)/)[1];
const afterReroll = await page.evaluate(async () => (await import('/src/core/legacy.js')).Legacy.load().remembrance);
check('Another Tide buys a reroll', Number(rerollsAfter) === Number(rerollsBefore) + 1 && afterReroll === before - 15, `${before} → ${afterReroll}, rerolls ${rerollsBefore} → ${rerollsAfter}`);
await page.click('#creation [data-boon="bundle"]');
await page.fill('#creation #cr-name', 'Tobin Vey');
await page.click('#creation [data-a="begin"]');
await until(() => window.__unstable.state === 'playing');
const heirCh = await page.evaluate(async () => ({ silver: window.__unstable.ch.silver, rem: (await import('/src/core/legacy.js')).Legacy.load().remembrance, slot: (await import('/src/core/save.js')).Save.slot }));
check("Wren's Bundle is paid for and given", heirCh.silver === 55 && heirCh.rem === afterReroll - 20 && heirCh.slot === 1, JSON.stringify(heirCh));

// ---- the keepsake chest at the Wash, opened with [E]
await page.waitForTimeout(1500);
const chestAt = await page.evaluate(() => {
  const g = window.__unstable;
  const it = g.world.interactables.find((x) => x.id === 'keepsake_chest');
  const p = g.player;
  p.pos.set(it.pos.x + 1.6, it.pos.y, it.pos.z + 0.4);
  p.pos.y = g.world.groundAt(p.pos.x, p.pos.z, it.pos.y + 3);
  g.camYaw = Math.atan2(-(it.pos.x - p.pos.x), -(it.pos.z - p.pos.z));
  return { x: it.pos.x, y: it.pos.y, z: it.pos.z };
});
await page.waitForTimeout(800);
const prompt = await page.evaluate(() => (document.querySelector('#prompt') || {}).innerText || '');
await page.evaluate(() => {
  const g = window.__unstable;
  g.debugCam = { pos: [g.player.pos.x + 3.2, g.player.pos.y + 2.2, g.player.pos.z + 2.6], look: [g.player.pos.x - 1.4, g.player.pos.y + 0.2, g.player.pos.z - 0.6] };
});
await page.waitForTimeout(500);
await shot('11-keepsake-chest-closed');
await page.evaluate(() => window.__unstable.input.pressed.add('KeyE'));
await page.waitForSelector('#loot .loot-row', { timeout: 5000 }).catch(() => {});
await shot('12-keepsake-chest-panel');
await page.click('#loot [data-take-all]').catch(() => {});
await page.waitForTimeout(1500);
await shot('13-keepsake-chest-open');
const got = await page.evaluate(async () => {
  const ch = window.__unstable.ch;
  const w = ch.inventory.weapons.find((x) => x.id === 'bronze_sword');
  return { w, left: (await import('/src/core/legacy.js')).Legacy.load().heirloom, toasts: window.__toasts.slice(-3) };
});
check('[E] at the keepsake chest claims the heirloom whole', got.w && got.w.temper === 2 && got.w.enchant === 'searing' && !got.left, JSON.stringify({ at: chestAt, prompt, w: got.w }));
await page.evaluate(() => window.__unstable.input.pressed.add('KeyE'));
await page.waitForTimeout(600);
const again = await page.evaluate(() => ({ n: window.__unstable.ch.inventory.weapons.filter((x) => x.id === 'bronze_sword').length, toast: window.__toasts[window.__toasts.length - 1] }));
check('a second [E] finds it empty', again.n === 1 && /empty/i.test(again.toast || ''), again.toast);

// ---- a reload mid-game resumes the same slot
await page.evaluate(() => (window.__unstable.debugCam = null));
await page.reload({ timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.state === 'playing', null, { timeout: 180000 });
const resumed = await page.evaluate(async () => ({ name: window.__unstable.ch.name, slot: (await import('/src/core/save.js')).Save.slot }));
check('a reload resumes the slot being played', resumed.name === 'Tobin Vey' && resumed.slot === 1, JSON.stringify(resumed));

// ---- a reload on the wipe screen brings the heirloom choice back
await page.evaluate(() => {
  const g = window.__unstable;
  g.ch.lives = 1;
  g.giveWeapon('bronze_sword');
  g.enterRift(false);
});
await until(() => window.__unstable.inRift, null, 10000);
await page.waitForTimeout(800);
await page.evaluate(() => window.__unstable.onPlayerDeath(null));
await page.waitForSelector('#wipe .panel', { timeout: 15000 });
await page.reload({ timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.state === 'menu', null, { timeout: 180000 });
await page.waitForSelector('#wipe .panel', { timeout: 15000 });
const again2 = await text('#wipe');
check('a reload on the wipe screen brings back the unfinished choice', /Tobin Vey/.test(again2) && /LEAVE AN HEIRLOOM/i.test(again2), again2.split('\n').slice(0, 4).join(' | '));
await page.click('#wipe [data-pick="-1"]');
await page.click('#wipe [data-a="ok"]');
const after2 = await page.evaluate(async () => {
  const { Legacy } = await import('/src/core/legacy.js');
  const { Save } = await import('/src/core/save.js');
  const l = Legacy.load();
  return { lost: l.lost.length, pending: l.pending, heirloom: l.heirloom, slots: Save.slots().map((x) => x && x.name) };
});
check('leaving nothing: two in the register, nothing waiting, every slot empty', after2.lost === 2 && !after2.pending && !after2.heirloom && after2.slots.every((x) => !x), JSON.stringify(after2));
await shot('14-menu-after-two');

const own = errors.filter((e) => !/ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(e));
check('no console errors or warnings', own.length === 0, own.slice(0, 5).join(' || '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
