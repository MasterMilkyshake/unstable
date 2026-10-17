// Great-foe check (A-03): fight each boss in its real arena and check what the fight does.
//   BOSS_URL=http://localhost:5173/ node tools/boss-check.mjs [boss ids...] [--secs=N] [--json=out.json]
// One browser and one boot; a fresh character for each boss. The boss's own spawner wakes (its
// story gate met), every other spawner is stopped and other foes are cleared. The fight is a
// script, not a duel: the boss loses 1/SECS of its health a second (combat.damage, so its own
// death, rewards and hooks run as in play, while it keeps attacking), the player is kept alive and
// every 7 s stands somewhere new on the arena floor 3, 10, 16 or 24 m from the boss (ranged and
// leap specials need room), choosing spots near the boss's home. Checked, per boss:
//   - it aggroes when the player comes within its aggro range, and the boss bar shows;
//   - every special (or, for a creature, every attack) starts at least once, and each phase
//     special only below its health threshold; each summon wave at its threshold, all summoned;
//   - it reaches the player after each move (navigation), and never leashes out of its arena
//     (drops aggro, or strays past its leash from home);
//   - the kill: in bossesDefeated, the "FOE VANQUISHED" banner, its sure drops, its Bell;
//   - nothing but the script strikes it (its own summons or a garrison of its faction did once);
//   - no console errors.
// Mantra casts and the farthest it strayed are reported for the user's judgement, not failed.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.BOSS_URL || 'http://localhost:5173/';
const ALL = ['duelist', 'witch_queen', 'thresher', 'primadon', 'lanternless', 'warlord', 'frost_warden', 'cinder_colossus', 'castellan', 'hollow_duke', 'vice_warden', 'grand_warden'];
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const bosses = args.filter((a) => !a.startsWith('--'));
const list = bosses.length ? bosses : ALL;
const SECS = Number(opt('secs', 100));
const JSON_OUT = opt('json', null);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });

const results = [];
let failed = false;
for (const type of list) {
  errors = [];
  const setup = await page.evaluate(async ({ type, SECS }) => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    const { G } = await import('/src/core/globals.js');
    const { ENEMIES } = await import('/src/data/enemies.js');
    const { BELL_FOR_BOSS } = await import('/src/game/bells.js');
    const { damage } = await import('/src/combat/combat.js');
    const spec = ENEMIES[type];
    const ch = g.createCharacter({ name: 'Bossward', race: RACES[0].id, look: {} });
    Object.assign(ch, { level: 10, armed: true, silver: 0 }); // below Power 20, where kills stop giving XP
    ch.attrs.fortitude = 60;
    ch.flags.war_enclave = true; // the Vice Warden's chapter
    ch.quests.bastion = { state: 'done' }; // the Grand Warden's
    g.startGame(ch, false);
    const p = g.player;
    p.onLethal = () => (p.hp = p.maxHp); // the fight is the boss's to show, not the player's to lose
    // every spawner as built, then all but the boss's stopped (for this boss only)
    window.__defs ||= g.spawners.map((s) => s.def);
    g.spawners.forEach((s, i) => (s.def = window.__defs[i]));
    const sp = g.spawners.find((s) => s.def.type === type && s.def.boss);
    if (!sp) return { error: `no spawner for ${type}` };
    for (const s of g.spawners) if (s !== sp) s.def = Object.assign({}, s.def, { count: 0 });
    for (const a of G.actors) if (a !== p && (a.team === 'enemy' || a.team === 'guard') && !a.dummy) a.despawn = true;
    const home = { x: sp.def.x, z: sp.def.z };
    const groundAt = (x, z, y) => g.world.groundAt(x, z, y + 4);
    // wake the spawner from just outside aggro range, on ground near the home's height
    const homeY = groundAt(home.x, home.z, 400);
    const ring = (cx, cz, cy, d, prefer) => {
      let best = null;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const x = cx + Math.sin(a) * d;
        const z = cz + Math.cos(a) * d;
        const y = groundAt(x, z, cy);
        if (!(Math.abs(y - cy) < 3)) continue;
        const score = prefer ? Math.hypot(x - prefer.x, z - prefer.z) : 0;
        if (!best || score < best.score) best = { x, y, z, score };
      }
      return best;
    };
    const start = ring(home.x, home.z, homeY, spec.aggro + 8, null) || { x: home.x, y: homeY, z: home.z + spec.aggro + 8 };
    p.pos.set(start.x, start.y + 0.1, start.z);
    p.vel.set(0, 0, 0);
    p.fallStart = p.pos.y;
    g.inRift = g.world.inRift(start.x);
    const R = (window.__boss = {
      type, home, homeY, leash: spec.leash || 45, aggroRange: spec.aggro, t: 0, boss: null, aggroAt: null, bossBar: false,
      starts: [], summoned: 0, struckBy: {}, enragedAt: null, maxFromHome: 0, drops: [], reaches: [], moves: 0, dead: false, deathAt: null,
      banner: null, kill: null, rewards: null, phase: 'approach', moveT: 0, dmgT: 0, reachFrom: null, step: 0, bossLeftAggro: 0, window: null, windows: [],
    });
    const banner = g.ui.banner.bind(g.ui);
    g.ui.banner = (title, sub) => {
      if (/VANQUISHED/.test(title)) R.banner = `${title}: ${sub}`;
      return banner(title, sub);
    };
    const endBoss = g.endBoss.bind(g);
    g.endBoss = (e, killed) => {
      if (e === R.boss && !killed) R.bossLeftAggro++;
      return endBoss(e, killed);
    };
    const before = { xp: ch.xp, level: ch.level, silver: ch.silver, items: { ...ch.inventory.items }, weapons: ch.inventory.weapons.map((w) => w.id), mantras: Object.keys(ch.mantras) };
    const known = new Set(G.actors);
    const DIST = [3, 10, 16, 24];
    const update = g.updatePlaying.bind(g);
    g.updatePlaying = (dt) => {
      update(dt);
      R.t += dt;
      if (p.hp < p.maxHp * 0.6) p.hp = p.maxHp;
      if (!R.boss) {
        R.boss = G.actors.find((a) => a.type === type && !a.dead) || null;
        if (R.boss) {
          const b = R.boss;
          const struck = b.onDamaged ? b.onDamaged.bind(b) : null;
          b.onDamaged = (att, dmg, el, h) => {
            const by = att && (att.owner || att);
            if (by !== p) R.struckBy[by ? by.type || by.team : '?'] = (R.struckBy[by ? by.type || by.team : '?'] || 0) + 1;
            return struck && struck(att, dmg, el, h);
          };
          const sa = b.startAttack.bind(b);
          b.startAttack = (def) => {
            const key = def.netKey ? def.netKey.join(':') : def.anim || def.id || '?';
            R.starts.push([key, +(b.hp / b.maxHp).toFixed(3), +R.t.toFixed(1)]);
            return sa(def);
          };
        } else if (R.t > 30) {
          R.phase = 'nospawn';
          R.diag = { active: sp.active, pending: sp.pending, alive: sp.alive.length, player: [p.pos.x, p.pos.y, p.pos.z].map(Math.round), home: [home.x, homeY, home.z].map(Math.round) };
        }
        return;
      }
      const b = R.boss;
      for (const a of G.actors) {
        if (known.has(a)) continue;
        known.add(a);
        // a summon spawns within ±5 m of its boss; the same type further off is the world's own
        // (since agent/world-life, the Enclave's columns, checkpoints and sloops walk past Fort Meridian)
        if (spec.summons && a.type === spec.summons.type) {
          if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) <= 8) R.summoned++;
          else R.passersBy = (R.passersBy || 0) + 1;
        }
      }
      if (b.enraged && R.enragedAt === null) R.enragedAt = +(b.hp / b.maxHp).toFixed(3);
      if (b.dead) {
        if (!R.dead) {
          R.dead = true;
          R.deathAt = R.t;
        }
        return;
      }
      R.maxFromHome = Math.max(R.maxFromHome, Math.hypot(b.pos.x - b.home.x, b.pos.z - b.home.z));
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (R.phase === 'approach') {
        // walk in until it notices
        if (b.aggro) {
          R.aggroAt = +R.t.toFixed(1);
          R.aggroDist = +d.toFixed(1);
          R.bossBar = g.bossActive === b;
          R.phase = 'fight';
          R.moveT = 0;
        } else {
          const step = Math.min(d, 4 * dt);
          p.pos.x += ((b.pos.x - p.pos.x) / d) * step;
          p.pos.z += ((b.pos.z - p.pos.z) / d) * step;
          p.pos.y = groundAt(p.pos.x, p.pos.z, p.pos.y) + 0.05;
          if (R.t > 90) R.phase = 'never';
        }
        return;
      }
      if (R.phase !== 'fight') return;
      // the scripted wearing-down
      R.dmgT += dt;
      if (R.dmgT >= 1) {
        R.dmgT -= 1;
        damage(p, b, b.maxHp / SECS, 'phys', { kind: 'melee' });
      }
      // reaching the player after a move; how far it walked, and how much it attacked meanwhile
      const W = R.window;
      if (W) {
        W.moved += Math.hypot(b.pos.x - W.lx, b.pos.z - W.lz);
        W.lx = b.pos.x;
        W.lz = b.pos.z;
        W.dMin = Math.min(W.dMin, d);
        if (b.atk) W.busy += dt;
      }
      if (R.reachFrom !== null && d < b.radius + p.radius + 2.6) {
        R.reaches.push(+(R.t - R.reachFrom).toFixed(1));
        R.reachFrom = null;
        if (W) W.reached = +(R.t - W.t0).toFixed(1);
      }
      R.moveT += dt;
      if (R.moveT >= 7) {
        R.moveT = 0;
        if (R.reachFrom !== null) R.reaches.push(null); // never got there
        if (W) R.windows.push({ want: W.want, d0: +W.d0.toFixed(1), dMin: +W.dMin.toFixed(1), moved: +W.moved.toFixed(1), busy: +W.busy.toFixed(1), reached: W.reached });
        const want = DIST[R.moves++ % DIST.length];
        const spot = ring(b.pos.x, b.pos.z, b.pos.y, want, b.home);
        if (spot && Math.hypot(spot.x - b.home.x, spot.z - b.home.z) < R.leash) {
          p.pos.set(spot.x, spot.y + 0.1, spot.z);
          p.vel.set(0, 0, 0);
          p.fallStart = p.pos.y;
          R.reachFrom = want >= 10 ? R.t : null;
          const d0 = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
          R.window = want >= 10 ? { want, d0, dMin: d0, moved: 0, busy: 0, reached: null, t0: R.t, lx: b.pos.x, lz: b.pos.z } : null;
        } else R.window = null;
      }
      if (R.t > SECS * 2 + 60) R.phase = 'timeout';
    };
    R.before = before;
    R.spec = {
      specials: (spec.specials || []).map((s) => ({ id: s.id, hpBelow: s.hpBelow || null, once: !!s.once })),
      attacks: spec.weapon ? [] : (spec.attacks || []).map((a) => a.id),
      summons: spec.summons ? { type: spec.summons.type, count: spec.summons.count, atHp: spec.summons.atHp } : null,
      mantras: spec.mantras || [],
      drops: (spec.drops || []).filter((d) => d.chance >= 1).map((d) => ({ id: d.id, weapon: !!d.weapon, outfit: d.outfit || null })),
      bell: BELL_FOR_BOSS[type] || null,
      silver: spec.silver || [0, 0],
    };
    return { start, home, homeY, aggro: spec.aggro, leash: R.leash };
  }, { type, SECS });
  if (setup.error) {
    console.log(`${type}: FAIL ${setup.error}`);
    failed = true;
    continue;
  }
  await page.waitForFunction(() => {
    const R = window.__boss;
    return R.phase === 'never' || R.phase === 'nospawn' || R.phase === 'timeout' || (R.dead && R.t - R.deathAt > 4);
  }, null, { timeout: (SECS * 2 + 200) * 1000, polling: 500 });
  const R = await page.evaluate(() => {
    const g = window.__unstable;
    const R = window.__boss;
    const ch = g.ch;
    const after = { xp: ch.xp, level: ch.level, silver: ch.silver, items: ch.inventory.items, weapons: ch.inventory.weapons.map((w) => w.id), mantras: Object.keys(ch.mantras) };
    const out = { ...R, boss: null, after, defeated: (ch.bossesDefeated || []).includes(R.type) };
    g.updatePlaying = Object.getPrototypeOf(g).updatePlaying.bind(g);
    return JSON.parse(JSON.stringify(out));
  });
  // ---- judge
  const problems = [];
  const notes = [];
  if (R.phase === 'never') problems.push('never aggroed');
  if (R.phase === 'nospawn') problems.push(`never spawned (${JSON.stringify(R.diag)})`);
  if (R.phase === 'timeout') problems.push(`not dead after ${R.t.toFixed(0)} s`);
  for (const [by, n] of Object.entries(R.struckBy)) problems.push(`struck ${n} times by ${by}`);
  if (R.aggroAt !== null && !R.bossBar) problems.push('no boss bar on aggro');
  if (R.aggroAt !== null && R.aggroDist > R.aggroRange + 0.5) problems.push(`aggroed at ${R.aggroDist} m, past its ${R.aggroRange} m`);
  const started = (id) => R.starts.filter((s) => s[0] === `cre:${id}`);
  for (const s of R.spec.specials) {
    const st = started(s.id);
    if (!st.length) problems.push(`special ${s.id} never started`);
    else if (s.hpBelow && st.some((x) => x[1] > s.hpBelow + 0.011)) problems.push(`special ${s.id} started above ${s.hpBelow * 100}% (at ${(st[0][1] * 100).toFixed(0)}%)`);
    else if (s.once && st.length > 1) problems.push(`special ${s.id} (once) started ${st.length} times`);
  }
  for (const id of R.spec.attacks) if (!started(id).length) problems.push(`attack ${id} never started`);
  if (R.spec.summons) {
    const waves = R.starts.filter((s) => s[0] === 'summon');
    if (waves.length !== R.spec.summons.atHp.length) problems.push(`${waves.length} summon waves, expected ${R.spec.summons.atHp.length}`);
    waves.forEach((w, i) => {
      if (w[1] > R.spec.summons.atHp[i] + 0.011) problems.push(`summon wave ${i + 1} at ${(w[1] * 100).toFixed(0)}%, above ${R.spec.summons.atHp[i] * 100}%`);
    });
    const want = R.spec.summons.count * waves.length;
    if (R.summoned !== want) problems.push(`${R.summoned} ${R.spec.summons.type} summoned, expected ${want}`);
  }
  const failedReaches = R.reaches.filter((x) => x === null).length;
  const reachTimes = R.reaches.filter((x) => x !== null);
  // a miss is a stall when the boss neither walked half the gap nor spent the time attacking
  const stalls = R.windows.filter((w) => w.reached === null && w.moved < w.d0 * 0.5 && w.busy < 3);
  if (stalls.length) problems.push(`stalled after ${stalls.length} move(s): ${stalls.map((w) => `${w.d0} m away, walked ${w.moved} m, attacking ${w.busy} s`).join('; ')}`);
  const missed = R.windows.filter((w) => w.reached === null && !stalls.includes(w));
  if (R.passersBy) notes.push(`${R.passersBy} ${R.spec.summons.type} passed by, not summoned (counted apart)`);
  if (missed.length) notes.push(`kept its distance after ${missed.length} move(s): ${missed.map((w) => `${w.d0} m away, closest ${w.dMin} m, walked ${w.moved} m, attacking ${w.busy} s`).join('; ')}`);
  if (R.bossLeftAggro) problems.push(`dropped aggro ${R.bossLeftAggro} time(s) mid-fight`);
  if (R.maxFromHome > R.leash) problems.push(`strayed ${R.maxFromHome.toFixed(0)} m from home, past its ${R.leash} m leash`);
  if (R.dead) {
    if (!R.defeated) problems.push('not recorded in bossesDefeated');
    if (!R.banner) problems.push('no FOE VANQUISHED banner');
    if (!(R.after.xp !== R.before.xp || R.after.level !== R.before.level)) problems.push('no XP');
    if (R.spec.silver[1] > 0 && !(R.after.silver > R.before.silver)) problems.push('no silver');
    for (const d of R.spec.drops) {
      if (d.weapon && !(R.after.weapons.filter((w) => w === d.id).length > R.before.weapons.filter((w) => w === d.id).length)) problems.push(`no ${d.id} (weapon drop)`);
      else if (!d.weapon && !d.outfit && !((R.after.items[d.id] || 0) > (R.before.items[d.id] || 0))) problems.push(`no ${d.id} (sure drop)`);
    }
    if (R.spec.bell && !R.after.mantras.includes(R.spec.bell)) problems.push(`no Bell (${R.spec.bell})`);
  }
  if (errors.length) problems.push(`${errors.length} console error(s): ${errors.slice(0, 3).join(' | ')}`);
  const mantraCasts = R.starts.filter((s) => s[0].startsWith('mantra:')).map((s) => s[0].slice(7));
  for (const m of R.spec.mantras) if (!mantraCasts.includes(m)) notes.push(`mantra ${m} not cast`);
  const counts = {};
  for (const s of R.starts) counts[s[0]] = (counts[s[0]] || 0) + 1;
  const ok = problems.length === 0;
  failed ||= !ok;
  const line = `${type}: ${ok ? 'PASS' : 'FAIL'}` +
    `${R.aggroAt !== null ? `, aggro at ${R.aggroDist} m (range ${R.aggroRange})` : ''}` +
    `${R.dead ? `, dead after ${(R.deathAt - R.aggroAt).toFixed(0)} s of fight` : ''}` +
    `, specials ${R.spec.specials.map((s) => `${s.id}×${started(s.id).length}`).join(' ') || '-'}` +
    `${R.spec.attacks.length ? `, attacks ${R.spec.attacks.map((a) => `${a}×${started(a).length}`).join(' ')}` : ''}` +
    `${R.spec.summons ? `, summoned ${R.summoned}` : ''}${R.enragedAt !== null ? `, enraged at ${(R.enragedAt * 100).toFixed(0)}%` : ''}` +
    `, reached the player in ${reachTimes.length ? `${Math.min(...reachTimes)}-${Math.max(...reachTimes)} s` : '-'} (${failedReaches} misses of ${R.reaches.length})` +
    `, at most ${R.maxFromHome.toFixed(0)} m from home (leash ${R.leash})` +
    `${R.dead ? `, Bell ${R.spec.bell ? (R.after.mantras.includes(R.spec.bell) ? R.spec.bell : 'MISSING') : 'none'}` : ''}` +
    `, mantras cast ${mantraCasts.length ? [...new Set(mantraCasts)].join(' ') : '-'}` +
    `, console errors ${errors.length}` +
    `${problems.length ? `\n    problems: ${problems.join('; ')}` : ''}${notes.length ? `\n    notes: ${notes.join('; ')}` : ''}`;
  console.log(line);
  results.push({ type, ok, problems, notes, counts, windows: R.windows, aggroAt: R.aggroAt, aggroDist: R.aggroDist, fightS: R.dead ? +(R.deathAt - R.aggroAt).toFixed(1) : null, summoned: R.summoned, enragedAt: R.enragedAt, reaches: R.reaches, maxFromHome: +R.maxFromHome.toFixed(1), leash: R.leash, starts: R.starts, errors });
}
await browser.close();
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ url: URL, secs: SECS, results }, null, 1));
console.log(`${results.filter((r) => r.ok).length} of ${list.length} great foes pass`);
process.exit(failed ? 1 : 0);
