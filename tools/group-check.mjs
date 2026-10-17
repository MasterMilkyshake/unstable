// In-game group fight (task 6 of the systems round): a Redwake band (two brigands, a breaker, a
// skirmisher, a harpooner and a bonesetter) against the player on the open ground by the Wash
// spawn, then a Shellback. The player stands its ground, swings when foes are close, and cannot
// die. Needs a dev server.
//   GROUP_URL=http://localhost:5173/ node tools/group-check.mjs [screenshot dir]
// Checks: never more than two melee foes swinging at once; the harpooner keeps back and throws;
// the bonesetter mends someone; a brigand brought low falls back and calls; the Shellback keeps
// its pattern; no console errors.
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.GROUP_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    const ch = g.createCharacter({ name: 'Holdfast', race: RACES[0].id, look: {} });
    ch.armed = true;
    ch.level = 8;
    ch.inventory.weapons.push({ uid: 'g1', id: 'steel_longsword' });
    ch.equipped.weapon = 'g1';
    ch.attrs.medium = 20;
    g.startGame(ch, false);
    const { G } = await import('/src/core/globals.js');
    for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
    for (const a of G.actors) if (a !== G.player && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
    const S = (window.__grp = { G, g, t: 0, waits: [], hooks: [] });
    const update = g.updatePlaying.bind(g);
    g.updatePlaying = (dt) => {
      if (window.__freeze) return;
      S.t += dt;
      for (const h of S.hooks) h(dt);
      update(dt);
      for (let i = S.waits.length - 1; i >= 0; i--) if (S.t >= S.waits[i].end) S.waits.splice(i, 1)[0].res();
    };
    S.wait = (s) => new Promise((res) => S.waits.push({ end: S.t + s, res }));
  });
  await page.waitForTimeout(1200);
  const band = await page.evaluate(async () => {
    const S = window.__grp;
    const { G, g } = S;
    const p = G.player;
    const ground = (x, z) => Math.max(g.world.terrain.heightAt(x, z), g.world.colliders.groundAt(x, z, p.pos.y + 4, 0.2));
    const spawn = (type, dx, dz) => {
      const x = p.pos.x + dx;
      const z = p.pos.z + dz;
      const e = g.spawnEnemy(type, p.pos.clone().set(x, ground(x, z) + 0.05, z));
      e.setAggro(p);
      return e;
    };
    const band = {
      brigands: [spawn('brigand', 0, 7), spawn('brigand', 4, 6)],
      breaker: spawn('redwake_breaker', -4, 6),
      skirmisher: spawn('redwake_skirmisher', 6, 2),
      harpooner: spawn('redwake_harpooner', 0, 16),
      bonesetter: spawn('redwake_bonesetter', -3, 14),
    };
    const all = [...band.brigands, band.breaker, band.skirmisher, band.harpooner, band.bonesetter];
    const melee = [...band.brigands, band.breaker, band.skirmisher];
    const R = (window.__res = { maxSwing: 0, thrown: 0, mended: 0, harpMin: Infinity, fled: false, called: false, hits: 0 });
    for (const pr of G.projectiles) pr.seen = true;
    const hp = new Map(all.map((a) => [a, a.hp]));
    S.hooks.push(() => {
      p.hp = p.maxHp;
      // the player turns to the nearest foe and swings when one is close
      let near = null;
      let nd = 3.4;
      for (const a of melee) {
        const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
        if (!a.dead && d < nd) {
          nd = d;
          near = a;
        }
      }
      if (near && !p.atk) {
        g.camYaw = Math.atan2(near.pos.x - p.pos.x, near.pos.z - p.pos.z);
        g.input.mPressed[0] = true;
      }
      R.maxSwing = Math.max(R.maxSwing, melee.filter((a) => !a.dead && a.atk && a.atk.phase !== 'recovery').length);
      for (const pr of G.projectiles) if (!pr.seen && pr.owner === band.harpooner) {
        pr.seen = true;
        R.thrown++;
      }
      if (S.t > 3 && !band.harpooner.dead) R.harpMin = Math.min(R.harpMin, Math.hypot(band.harpooner.pos.x - p.pos.x, band.harpooner.pos.z - p.pos.z));
      for (const a of all) {
        if (!a.dead && a.hp > hp.get(a) + 5) R.mended++;
        hp.set(a, a.hp);
      }
    });
    return Object.keys(band);
  });
  // the fight
  await page.evaluate(() => window.__grp.wait(8));
  if (OUT) {
    await page.evaluate(() => (window.__freeze = true));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/group-fight.png` });
    await page.evaluate(() => (window.__freeze = false));
  }
  const res = await page.evaluate(async () => {
    const S = window.__grp;
    const { G } = S;
    const p = G.player;
    // bring a brigand low: it should fall back and call
    const b = G.actors.find((a) => a.type === 'brigand' && !a.dead);
    const far = (() => {
      const x = p.pos.x + 24;
      const z = p.pos.z - 10;
      const e = S.g.spawnEnemy('brigand', p.pos.clone().set(x, p.pos.y + 0.1, z));
      return e;
    })();
    await S.wait(0.5);
    const unaware = !far.aggro;
    if (b) b.hp = b.maxHp * 0.25;
    const d0 = b ? Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) : 0;
    await S.wait(1.5);
    const R = window.__res;
    R.fled = !!(b && b.ai.fled && Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) > d0);
    R.called = unaware && far.aggro;
    await S.wait(4);
    // then a Shellback, alone
    for (const a of G.actors) if (a !== p && a.team === 'enemy') a.despawn = true;
    await S.wait(0.3);
    const m = S.g.spawnEnemy('shellback', p.pos.clone().set(p.pos.x, p.pos.y + 0.1, p.pos.z + 4));
    m.setAggro(p);
    const seen = [];
    S.hooks.push(() => {
      if (m.atk && m.atk !== m._last) {
        m._last = m.atk;
        seen.push(m.atk.def.netKey[1]);
      }
    });
    await S.wait(14);
    R.pattern = seen;
    R.patternOk = seen.length >= 4 && seen.every((id, i) => id === m.spec.pattern[i % m.spec.pattern.length]);
    return R;
  });
  const checks = [
    ['at most two melee swinging at once', res.maxSwing <= 2, `max ${res.maxSwing}`],
    ['the harpooner keeps back and throws', res.harpMin > 5 && res.thrown >= 2, `closest ${res.harpMin.toFixed(1)} m, ${res.thrown} thrown`],
    ['the bonesetter mends', res.mended >= 1, `${res.mended} mendings`],
    ['a brigand brought low falls back', res.fled, ''],
    ['and its call reaches 26 m', res.called, ''],
    ['the Shellback keeps its pattern', res.patternOk, res.pattern.join(' ')],
  ];
  for (const [name, ok, note] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` (${note})` : ''}`);
    failed ||= !ok;
  }
  console.log(`console errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
  failed ||= errors.length > 0;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
