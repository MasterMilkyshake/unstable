// In-game check of the moves (task 1 of the systems round): flourish, uppercut and air chase,
// roll-cancel, directional block, blind on enemies and a boss's summon retry, each driven with
// the real input sets in the real game. Needs a running dev server.
//   MOVES_URL=http://localhost:5173/ node tools/moves-check.mjs [screenshot dir]
// Each scenario runs on open ground by the Wash spawn with spawners stopped and only its own
// foes. Fails if a scenario's check fails or the console logs an error.
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.MOVES_URL || 'http://localhost:5173/';
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
    const ch = g.createCharacter({ name: 'Mover', race: RACES[0].id, look: {} });
    ch.armed = true;
    ch.level = 8;
    ch.attrs.agility = 20;
    ch.inventory.weapons.push({ uid: 'mv1', id: 'steel_longsword' });
    ch.equipped.weapon = 'mv1';
    ch.attrs.medium = 20;
    g.startGame(ch, false);
    const { G } = await import('/src/core/globals.js');
    for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
    // the simulation drives the scenario: hooks run before each step, so key edges land
    const S = (window.__sys = { G, g, t: 0, hooks: [], waits: [] });
    const update = g.updatePlaying.bind(g);
    g.updatePlaying = (dt) => {
      if (window.__freeze) return; // held still while a screenshot is taken
      S.t += dt;
      for (const h of S.hooks) h(dt);
      update(dt);
      for (let i = S.waits.length - 1; i >= 0; i--) if (S.waits[i].until(S.t)) S.waits.splice(i, 1)[0].res();
    };
    // freeze the simulation and ask the driver for a screenshot (it unfreezes afterwards)
    S.shot = (name) => {
      window.__freeze = true;
      window.__shotNow = name;
    };
    S.wait = (secs) => new Promise((res) => {
      const end = S.t + secs;
      S.waits.push({ until: (t) => t >= end, res });
    });
    S.waitFor = (fn, secs = 5) => new Promise((res) => {
      const end = S.t + secs;
      S.waits.push({ until: (t) => fn() || t >= end, res });
    });
    S.clear = () => {
      for (const a of G.actors) if (a !== G.player && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
      const I = g.input;
      I.down.clear();
      S.hooks.length = 0;
      I.mDown[0] = false;
    };
    // a flat spot near the spawn
    const p = G.player;
    S.home = p.pos.clone();
    S.ground = (x, z, y = 200) => Math.max(g.world.terrain.heightAt(x, z), g.world.colliders.groundAt(x, z, y, 0.2));
    S.reset = () => {
      S.clear();
      p.pos.copy(S.home);
      p.vel.set(0, 0, 0);
      p.hp = p.maxHp;
      p.yaw = 0;
      g.camYaw = 0;
      g.camPitch = 0.25;
      p.dodgeCd = 0;
      p.parryCd = 0;
      p.critCd = 0;
    };
    S.foe = (type, dx, dz, o = {}) => {
      const x = p.pos.x + dx;
      const z = p.pos.z + dz;
      const e = g.spawnEnemy(type, p.pos.clone().set(x, S.ground(x, z, p.pos.y + 4) + 0.05, z));
      if (o.defend) e.spec = { ...e.spec, defend: o.defend };
      e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      if (o.aggro !== false) e.setAggro(p);
      return e;
    };
  });
  await page.waitForTimeout(1500);

  const shot = async (name) => {
    if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  const results = [];
  const run = async (name, fn) => {
    let done = false;
    const pending = page.evaluate(fn).finally(() => (done = true));
    while (!done) {
      const want = await page.evaluate(() => window.__shotNow || null);
      if (want) {
        await page.waitForTimeout(120); // a couple of frames of the frozen scene
        await shot(want);
        await page.evaluate(() => {
          window.__shotNow = null;
          window.__freeze = false;
        });
      } else await page.waitForTimeout(30);
    }
    const r = await pending;
    results.push([name, r]);
    console.log(`${name}: ${r.ok ? 'PASS' : 'FAIL'} ${r.note || ''}`);
    failed ||= !r.ok;
  };

  // ------------------------------------------------ flourish: held at the top, then struck
  await run('flourish', async () => {
    const S = window.__sys;
    const { G, g } = S;
    S.reset();
    const p = G.player;
    const e = S.foe('brigand', 0, 2.6, { defend: { parry: 0, block: 0, dodge: 0 } });
    S.hooks.push(() => (e.ai.atkCd = 99));
    await S.wait(0.3);
    g.input.mPressed[0] = true;
    g.input.mDown[0] = true;
    await S.waitFor(() => p.atk && p.atk.holding, 1);
    const held = !!(p.atk && p.atk.holding);
    S.shot('flourish-held');
    await S.wait(0.15);
    const hp0 = e.hp;
    g.input.mDown[0] = false;
    await S.wait(0.4);
    return { ok: held && e.hp < hp0, note: `held ${held}, then struck for ${(hp0 - e.hp).toFixed(1)}` };
  });

  // ------------------------------------------------ uppercut and air chase
  await run('uppercut + air chase', async () => {
    const S = window.__sys;
    const { G, g } = S;
    S.reset();
    const p = G.player;
    const I = g.input;
    const e = S.foe('brigand', 0, 12, { defend: { parry: 0, block: 0, dodge: 0 } });
    S.hooks.push(() => (e.ai.atkCd = 99));
    I.down.add('KeyW');
    I.down.add('ShiftLeft');
    await S.waitFor(() => p.speed > 8, 2);
    I.pressed.add('KeyC');
    await S.waitFor(() => p.slideT > 0, 0.5);
    const slid = p.slideT > 0;
    I.down.delete('KeyW');
    I.down.delete('ShiftLeft');
    // bring the brigand into the uppercut's reach
    e.pos.set(p.pos.x + Math.sin(p.yaw) * 2.2, p.pos.y, p.pos.z + Math.cos(p.yaw) * 2.2);
    g.camYaw = p.yaw;
    I.mPressed[0] = true;
    const y0 = e.pos.y;
    let peak = 0;
    S.hooks.push(() => (peak = Math.max(peak, e.pos.y - y0)));
    await S.waitFor(() => e.launched, 0.6);
    const launched = !!e.launched;
    I.pressed.add('Space');
    await S.waitFor(() => p.chase, 0.4);
    const chased = !!p.chase;
    await S.wait(0.2);
    S.shot('air-chase');
    let presses = 0;
    let last = null;
    let spiked = false;
    S.hooks.push(() => {
      if (e.spiked) spiked = true;
      if (presses < 3 && p.chase && (!p.atk || (p.atk.phase === 'recovery' && p.atk !== last))) {
        I.mPressed[0] = true;
        last = p.atk;
        presses++;
      }
    });
    await S.waitFor(() => !p.chase && p.grounded && e.grounded, 3);
    return {
      ok: slid && launched && chased && presses === 3 && spiked && peak > 1.2 && e.grounded,
      note: `slid ${slid}, launched ${launched} (peak ${peak.toFixed(2)} m), chased ${chased}, presses ${presses}, slam ${spiked}, foe down ${e.grounded}`,
    };
  });

  // ------------------------------------------------ roll-cancel
  await run('roll-cancel', async () => {
    const S = window.__sys;
    const { G, g } = S;
    S.reset();
    const p = G.player;
    const I = g.input;
    I.down.add('KeyW');
    I.pressed.add('KeyQ');
    await S.waitFor(() => p.dodgeT > 0, 0.3);
    const rolling = p.dodgeT > 0;
    await S.wait(0.08);
    I.down.delete('KeyW');
    I.pressed.add('KeyF');
    await S.wait(0.04);
    return { ok: rolling && p.dodgeT <= 0 && p.iframes <= 0 && p.isParrying(), note: `parry up ${p.isParrying()}, dodge cooldown ${p.dodgeCd.toFixed(2)} s` };
  });

  // ------------------------------------------------ directional block
  await run('directional block', async () => {
    const S = window.__sys;
    const { G, g } = S;
    S.reset();
    const p = G.player;
    const I = g.input;
    I.down.add('KeyF');
    await S.wait(0.3);
    const front = S.foe('brigand', 0, 2.4, { defend: { parry: 0, block: 0, dodge: 0 } });
    const side = S.foe('brigand', 2.4, 0, { defend: { parry: 0, block: 0, dodge: 0 } });
    for (const e of [front, side]) e.ai.atkCd = 99;
    S.hooks.push(() => {
      front.ai.atkCd = 99;
      side.ai.atkCd = 99;
    });
    const { applyHit } = await import('/src/combat/combat.js');
    const r1 = applyHit(front, p, front.buildHit(front.humanoidM1(0), p));
    p.iframes = 0;
    const r2 = applyHit(side, p, side.buildHit(side.humanoidM1(0), p));
    I.down.delete('KeyF');
    return { ok: r1 === 'blocked' && r2 === 'hit', note: `front ${r1}, side ${r2}` };
  });

  // ------------------------------------------------ blind on enemies
  await run('blind', async () => {
    const S = window.__sys;
    const { G } = S;
    S.reset();
    const p = G.player;
    const e = S.foe('brigand', 0, 6, { aggro: false });
    e.applyStatus('blind', 1, p);
    await S.wait(0.5);
    const unseen = !e.aggro;
    p.pos.z += 3.6; // walk up within 3 m
    await S.waitFor(() => e.aggro, 1);
    S.shot('blind-found');
    return { ok: unseen && e.aggro, note: `unseen at 6 m ${unseen}, found within 3 m ${e.aggro}` };
  });

  // ------------------------------------------------ boss summon retry
  await run('summon retry', async () => {
    const S = window.__sys;
    const { G } = S;
    S.reset();
    const p = G.player;
    const boss = S.foe('witch_queen', 0, 7);
    p.iframes = 99;
    S.hooks.push(() => (p.hp = p.maxHp));
    boss.hp = boss.maxHp * 0.6;
    const count = () => G.actors.filter((a) => a.type === 'fen_witch' && !a.dead).length;
    await S.waitFor(() => boss.atk && boss.atk.def.netKey && boss.atk.def.netKey[0] === 'summon', 8);
    const cast1 = !!(boss.atk && boss.atk.def.netKey[0] === 'summon');
    boss.poiseT = 0;
    boss.interrupt(0.5);
    await S.wait(0.5);
    const none = count() === 0;
    await S.waitFor(() => count() > 0, 8);
    const after = count();
    await S.wait(4);
    return { ok: cast1 && none && after === 2 && count() === 2 && boss.ai.summonsDone === 1, note: `cut short: ${none ? 'no wave' : 'wave!'}, retried: ${after} witches, after 4 s ${count()}` };
  });

  console.log(`console errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
  failed ||= errors.length > 0;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
