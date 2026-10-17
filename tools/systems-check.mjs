// Every side system in the real game, each used through its own panel or interactable
// (tools/systems-harness.js does the using): the dungeons room by room, the Crucible's trials
// and its Marks shop, fishing, cooking, foraging, the shops, tempering, enchanting, the
// jeweler's buying and forging, the altar, the Shrine of Order, vows, resonances, bells, inns,
// boats, every written source, investigation, chest and Atlas entry, dialogue dead ends, and the
// death loop with the Ember of Life. The Rift escape itself is tools/rift-escape-check.mjs.
//
//   SYSTEMS_URL=http://localhost:5173/ node tools/systems-check.mjs [group ...] [--json=out.json]
//
// groups: loot dungeons crucible fishing cooking foraging forge mantras rest exploration dialogue death.
// Prints a pass/fail table; exits 1 on any failure.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.SYSTEMS_URL || 'http://localhost:5173/';
const args = process.argv.slice(2);
const json = (args.find((a) => a.startsWith('--json=')) || '').slice(7) || null;
const GROUPS = { loot: 'lootSystem', dungeons: 'dungeons', crucible: 'crucibleAll', fishing: 'fishing', cooking: 'cooking', foraging: 'foraging', forge: 'forge', mantras: 'mantraSystems', rest: 'restAndBoats', exploration: 'exploration', dialogue: 'dialogues', death: 'deathLoop' };
const want = args.filter((a) => !a.startsWith('--'));
const groups = want.length ? want : Object.keys(GROUPS);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world && window.__unstable.state === 'menu', null, { timeout: 180000 });
await page.evaluate(async () => {
  window.__qh = await import('/tools/quest-harness.js');
  window.__qh.setup({ level: 1 });
  window.__qbase = window.__qh.snap();
  window.__sh = await import('/tools/systems-harness.js');
});
let printed = 0;
for (const grp of groups) {
  const fn = GROUPS[grp];
  if (!fn) {
    console.log(`unknown group ${grp}`);
    continue;
  }
  const err = await page.evaluate(async (fn) => {
    try {
      await window.__sh[fn]();
      return null;
    } catch (e) {
      return e.message + '\n' + e.stack;
    }
  }, fn);
  const rows = await page.evaluate(() => window.__sh.rows);
  for (const r of rows.slice(printed)) console.log(`${r.ok === true ? 'PASS' : r.ok === null ? '----' : 'FAIL'}  ${r.group.padEnd(30).slice(0, 30)} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  printed = rows.length;
  if (err) {
    console.log(`FAIL  ${grp}: harness error ${err}`);
    await page.evaluate((m) => window.__sh.rows.push({ group: m, name: 'harness error', ok: false, detail: '' }), grp);
    printed++;
  }
}
const rows = await page.evaluate(() => window.__sh.rows);
const own = errors.filter((e) => !/ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(e));
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} pass; console errors/warnings: ${own.length}`);
for (const e of own.slice(0, 12)) console.log('  ' + e);
if (json) writeFileSync(json, JSON.stringify({ rows, errors: own }, null, 1));
await browser.close();
process.exit(rows.every((r) => r.ok !== false) && !own.length ? 0 : 1);
