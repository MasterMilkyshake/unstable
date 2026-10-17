// Every quest and story chapter, run in the real game (tools/quest-harness.js does the playing):
// started from its giver's dialogue (or by the story chain), each objective's target found at
// its placed position and checked for a walking route, the ◆ checked before every step, the
// quest finished and turned in, and what it paid compared with its listed rewards.
//
//   QUEST_URL=http://localhost:5173/ node tools/quest-run.mjs [side|story|factions|all|<quest id> ...] [--json=out.json]
//
// side: every quest outside the main chain and the faction paths, each from a fresh Power 20
// character with the giver's other quests marked done (a hub offers its first unfinished quest). story: the main
// chain from the Prologue to the epilogue at each chapter's suggested Power, the three Anchor's
// Seat endings with Maren's reply to each, the final victory, the epilogue and the state after.
// factions: the register/refuse choice and each faction's path. Prints a pass/fail table;
// exits 1 on any failure.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.QUEST_URL || 'http://localhost:5173/';
const args = process.argv.slice(2);
const json = (args.find((a) => a.startsWith('--json=')) || '').slice(7) || null;
const modes = args.filter((a) => !a.startsWith('--'));
const want = modes.length ? modes : ['all'];

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
});

const rows = [];
const report = (r) => {
  rows.push(r);
  const mk = (r.markers || []).filter((m) => !m.ok).length;
  const rc = (r.reach || []).filter((x) => x.ok === false).length;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} ${String(r.name || '').padEnd(30).slice(0, 30)} ${r.ok ? '' : r.why}${mk ? ` [${mk} marker]` : ''}${rc ? ` [${rc} route]` : ''}`);
};

// ---------------------------------------------------------------- side quests
async function side(ids) {
  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      const H = window.__qh;
      H.restore(window.__qbase);
      const g = window.__unstable;
      const ch = g.ch;
      const def = H.QUESTS[id];
      H.setLevel(20);
      // a hub offers its first unfinished quest: the giver's others are done
      for (const [k, d] of Object.entries(H.QUESTS)) if (k !== id && !d.main && d.giver === def.giver) ch.quests[k] = { state: 'done', progress: 0, stage: 0, sp: [] };
      // some offers wait on the story: done up to the chapter the quest belongs after
      for (const k of def.after || []) ch.quests[k] = { state: 'done', progress: 0, stage: 0, sp: [] };
      try {
        return await H.runQuest(id);
      } catch (e) {
        return { id, name: def.name, ok: false, why: 'harness error: ' + e.message };
      }
    }, id);
    report(r);
  }
}

const all = await page.evaluate(() => Object.entries(window.__qh.QUESTS).map(([id, d]) => ({ id, main: !!d.main })));
// the faction paths open with the story (the writ answered, the grey letter, the war), so the
// story run plays them where they open
const FACTION_PATHS = ['watch_lamp', 'watch_scraps', 'enclave_pirates', 'ministry_soundings', 'ministry_bell'];
const sideIds = all.filter((q) => !q.main && !FACTION_PATHS.includes(q.id)).map((q) => q.id);
if (want.includes('all') || want.includes('side')) await side(sideIds);
const named = want.filter((w) => all.some((q) => q.id === w));
if (named.length) await side(named);

// ---------------------------------------------------------------- the story
if (want.includes('all') || want.includes('story') || want.includes('factions')) {
  const st = await page.evaluate(async () => {
    const H = window.__qh;
    H.restore(window.__qbase);
    try {
      return await H.storyRun();
    } catch (e) {
      return { error: e.message + ' ' + e.stack };
    }
  });
  if (st.error) {
    console.log('FAIL  story run: ' + st.error);
    rows.push({ id: 'story', ok: false, why: st.error });
  } else {
    console.log('\n-- the main story');
    for (const r of st.chapters) report({ ...r, name: `${r.name} (Power ${r.power}${r.branch ? ', ' + r.branch : ''})` });
    console.log('\n-- the register/refuse choice');
    for (const [way, b] of Object.entries(st.branches)) {
      const ok = b.ok && (way === 'register' ? b.registered && b.papers && !b.refused : b.refused && !b.registered);
      report({ id: `writ:${way}`, name: `rep ${JSON.stringify(b.rep)}`, ok: ok && (way !== 'register' || b.enclavePath === 'PASS'), why: `${b.why || ''} ${way === 'register' ? 'enclave path ' + b.enclavePath : ''}`, markers: [], reach: [] });
    }
    console.log('\n-- the faction paths');
    for (const r of st.factions) report({ ...r, name: `${r.name} (Power ${r.power})` });
    console.log("\n-- the Anchor's Seat");
    for (const [k, e] of Object.entries(st.endings)) {
      report({ id: `ending:${k}`, name: e.title || '', ok: e.ok, why: e.why || (e.titleOk ? '' : 'no title') + (e.victory ? '' : ' no victory screen'), markers: [], reach: [] });
      console.log(`      Maren: ${e.maren}`);
      console.log(`      victory: ${e.victory}`);
    }
    const a = st.after;
    const afterOk = a && !a.focus && !a.activeMain.length && !a.marker && a.playing;
    report({ id: 'after the end', name: `ending ${a && a.ending}, titles ${a && a.titles.join(', ')}`, ok: afterOk, why: afterOk ? '' : JSON.stringify(a), markers: [], reach: [] });
    if (a) console.log(`      Maren after: ${a.maren}`);
    rows.storyDetail = st;
  }
}

const own = errors.filter((e) => !/ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(e));
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} pass; console errors/warnings: ${own.length}`);
for (const e of own.slice(0, 12)) console.log('  ' + e);
if (json) writeFileSync(json, JSON.stringify({ rows, story: rows.storyDetail || null, errors: own }, null, 1));
await browser.close();
process.exit(rows.every((r) => r.ok) && !own.length ? 0 : 1);
