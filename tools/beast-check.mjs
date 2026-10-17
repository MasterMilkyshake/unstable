// Beast check: the roaming sharko packs and the great owls, in the real world.
//   BEAST_URL=http://localhost:5173/ node tools/beast-check.mjs [--secs=40] [--shots=dir] [--json=out.json]
//     [--parts=packs,fights] (default both; with --shots the lineup and portraits come first)
// One browser and one boot. For each sharko pack (data/roaming.js), every other spawner is
// stopped, other foes are cleared and the player is parked out of its way, 115 m off. Checked:
//   - the pack wakes with both beasts;
//   - over SECS seconds each one walks (a path over 8 m), the two keep within 14 m of each
//     other (their call radius), every sample stands on dry land at the ground's height, and
//     neither strays past roam + 8 m from the centre or turns on the player.
// Then a fight with a sharko (on its own ground) and a gloomowl (at its nest): the player is
// kept alive and stood 3, 10, 16 or 20 m off every 6 s. Checked: it aggroes, its blows land.
// Which of its attacks started is reported, not failed. No console errors throughout.
// --shots=dir writes a lineup (gloomowl, thunderwing, Old Hookbeak and a sharko beside a
// player, at rest and in a wind-up), each pack where it roams, and each fight.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.BEAST_URL || 'http://localhost:5173/';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const SECS = Number(opt('secs', 40));
const SHOTS = opt('shots', null);
const JSON_OUT = opt('json', null);
const PARTS = opt('parts', 'packs,fights').split(',');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });

await page.evaluate(async ({ SECS }) => {
  const g = window.__unstable;
  const { RACES } = await import('/src/data/races.js');
  const { G } = await import('/src/core/globals.js');
  const { ENEMIES } = await import('/src/data/enemies.js');
  const { SWIM_Y } = await import('/src/entities/actor.js');
  const ch = g.createCharacter({ name: 'Beastward', race: RACES[0].id, look: {} });
  Object.assign(ch, { level: 10, armed: true });
  ch.attrs.fortitude = 60;
  g.startGame(ch, false);
  const p = g.player;
  p.onLethal = () => (p.hp = p.maxHp);
  g.world.sky.update = ((orig) => (dt, ...rest) => {
    g.world.sky.time = 0.42; // noon, so the shots compare
    orig(dt, ...rest);
  })(g.world.sky.update.bind(g.world.sky));
  const defs = g.spawners.map((s) => s.def);
  const groundAt = (x, z, y = 400) => g.world.groundAt(x, z, y + 4);
  const dry = (x, z) => g.world.terrain.heightAt(x, z) > SWIM_Y + 0.6;
  const only = (keep) => {
    g.spawners.forEach((s, i) => (s.def = s === keep ? defs[i] : Object.assign({}, defs[i], { count: 0 })));
    for (const a of G.actors) if (a !== p && (a.team === 'enemy' || a.team === 'guard') && !a.dummy) a.despawn = true;
  };
  const stand = (x, z) => {
    const y = groundAt(x, z);
    p.pos.set(x, y + 0.1, z);
    p.vel.set(0, 0, 0);
    p.fallStart = p.pos.y;
  };
  // a dry spot at distance d from (cx, cz), nearest `prefer` if given
  const ring = (cx, cz, d, prefer) => {
    let best = null;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x = cx + Math.sin(a) * d;
      const z = cz + Math.cos(a) * d;
      if (!dry(x, z) || groundAt(x, z) < 1) continue;
      const score = prefer ? Math.hypot(x - prefer.x, z - prefer.z) : 0;
      if (!best || score < best.score) best = { x, z, score };
    }
    return best;
  };
  const packs = g.spawners.filter((s) => s.def.type === 'sharko');
  const shootAt = (mid, from, up = 7) => {
    const dx = from.x - mid.x, dz = from.z - mid.z, d = Math.hypot(dx, dz) || 1;
    const cx = mid.x + (dx / d) * 24, cz = mid.z + (dz / d) * 24;
    g.debugCam = { pos: [cx, Math.max(groundAt(cx, cz) + 3, mid.y + up), cz], look: [mid.x, mid.y + 2.5, mid.z] };
  };

  const update = g.updatePlaying.bind(g);
  g.updatePlaying = (dt) => {
    update(dt);
    const R = window.__beast;
    if (!R || R.done) return;
    R.t += dt;
    if (p.hp < p.maxHp * 0.6) p.hp = p.maxHp;
    if (R.mode === 'roam') {
      // nothing else on the field while a pack is watched (the world's events still run)
      for (const a of G.actors) if (a.team === 'enemy' && a.type !== 'sharko' && !a.despawn) a.despawn = true;
      const pair = R.sp.alive.filter((e) => !e.dead);
      if (R.wokeAt === null) {
        if (pair.length === 2) R.wokeAt = R.t;
        else if (R.t > 20) R.done = 'never woke';
        return;
      }
      if (pair.length < 2) {
        R.done = 'lost one';
        return;
      }
      R.sampleT += dt;
      if (R.sampleT < 0.5) return;
      R.sampleT = 0;
      pair.forEach((e, i) => {
        const last = R.last[i];
        if (last) R.path[i] += Math.hypot(e.pos.x - last[0], e.pos.z - last[1]);
        R.last[i] = [e.pos.x, e.pos.z];
        if (!dry(e.pos.x, e.pos.z)) R.wet++;
        const gy = groundAt(e.pos.x, e.pos.z, e.pos.y);
        if (Math.abs(e.pos.y - gy) > 1.2) R.offGround++;
        R.far = Math.max(R.far, Math.hypot(e.pos.x - R.cx, e.pos.z - R.cz));
        if (e.aggro) R.aggro = true;
      });
      R.spread = Math.max(R.spread, Math.hypot(pair[0].pos.x - pair[1].pos.x, pair[0].pos.z - pair[1].pos.z));
      R.samples++;
      if (R.t - R.wokeAt >= SECS) R.done = 'ok';
    } else if (R.mode === 'fight') {
      const e = R.e;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      R.minD = Math.min(R.minD, d);
      if (e.aggro && R.aggroAt === null) R.aggroAt = +R.t.toFixed(1);
      R.moveT += dt;
      if (R.moveT >= 6) {
        R.moveT = 0;
        const spot = ring(e.pos.x, e.pos.z, [3, 10, 16, 20][R.moves++ % 4], e.home);
        if (spot) stand(spot.x, spot.z);
      }
      if (e.dead || R.t >= SECS) R.done = 'ok';
    }
  };

  window.__beastApi = {
    packs: () => packs.map((s) => [s.def.x, s.def.z, s.def.level]),
    roam(i) {
      const sp = packs[i];
      only(sp);
      for (const e of sp.alive) e.despawn = true;
      Object.assign(sp, { alive: [], active: false, pending: 0, roam: null });
      const spot = ring(sp.def.x, sp.def.z, 115) || { x: sp.def.x, z: sp.def.z + 115 };
      stand(spot.x, spot.z);
      g.debugCam = null;
      window.__beast = { mode: 'roam', sp, cx: sp.def.x, cz: sp.def.z, t: 0, wokeAt: null, sampleT: 0, last: [], path: [0, 0], wet: 0, offGround: 0, far: 0, spread: 0, samples: 0, aggro: false, done: false };
    },
    roamResult() {
      const R = window.__beast;
      return { centre: [R.cx, R.cz], level: R.sp.def.level, done: R.done, samples: R.samples, path: R.path.map((v) => +v.toFixed(1)), spread: +R.spread.toFixed(1), far: +R.far.toFixed(1), wet: R.wet, offGround: R.offGround, aggro: R.aggro };
    },
    shootPack() {
      const pair = window.__beast.sp.alive.filter((e) => !e.dead);
      if (!pair.length) return false;
      const mid = pair[0].pos.clone().add(pair[pair.length - 1].pos).multiplyScalar(0.5);
      shootAt(mid, { x: mid.x + 1, z: mid.z + 0.6 });
      return true;
    },
    fight(type) {
      only(null);
      // the sharko on its own ground (Meridian's lowland); the owl at its first nest
      const home = type === 'sharko' ? packs[2].def : defs.find((d) => d.type === type);
      const at = ring(home.x, home.z, 4) || { x: home.x, z: home.z };
      stand(at.x, at.z);
      const from = ring(at.x, at.z, 14) || { x: at.x, z: at.z + 14 };
      const e = g.spawnEnemy(type, p.pos.clone().set(from.x, groundAt(from.x, from.z) + 0.1, from.z));
      const R = (window.__beast = { mode: 'fight', type, e, t: 0, starts: {}, hits: {}, minD: Infinity, aggroAt: null, moveT: 0, moves: 0, done: false });
      // a blow it landed, by kind (melee, aoe, a projectile); a bleed's ticks are not blows
      p.onDamaged = ((orig) => function (att, dmg, el, h) {
        const by = att && (att.owner || att);
        if (by === e && h && h.kind) R.hits[h.kind] = (R.hits[h.kind] || 0) + 1;
        return orig.call(this, att, dmg, el, h);
      })(p.__onDamaged ||= p.onDamaged);
      const sa = e.startAttack.bind(e);
      e.startAttack = (def) => {
        const id = def.netKey ? def.netKey[1] : def.id;
        R.starts[id] = (R.starts[id] || 0) + 1;
        return sa(def);
      };
      g.debugCam = null;
    },
    fightResult() {
      const R = window.__beast;
      return { type: R.type, done: R.done, aggroAt: R.aggroAt, hits: R.hits, minD: +R.minD.toFixed(1), starts: R.starts, attacks: (ENEMIES[R.type].attacks || []).map((a) => a.id) };
    },
    shootFight() {
      const R = window.__beast;
      const mid = R.e.pos.clone().add(p.pos).multiplyScalar(0.5);
      shootAt(mid, { x: mid.x + (R.e.pos.z - p.pos.z), z: mid.z - (R.e.pos.x - p.pos.x) }, 5);
    },
    // a row of the big beasts on open meadow (the first pack's ground), at rest or held in a
    // wind-up, with the player standing in the row for scale
    lineup(pose) {
      const c = packs[0].def;
      const cam = { x: c.x, z: c.z + 20 }; // from the north: the sun's side
      this.pose(['gloomowl', 'thunderwing', 'hookbeak', 'sharko'].map((type, i) => [type, c.x + 11.25 - i * 7.5, c.z]), pose, cam, [c.x - 17, c.z]);
      const y = groundAt(c.x, c.z);
      g.debugCam = { pos: [cam.x - 2, Math.max(groundAt(cam.x, cam.z) + 2, y + 2), cam.z], look: [c.x - 3, y + 2.6, c.z] };
    },
    // one beast from three-quarters front, the player beside it
    portrait(type, pose) {
      const c = packs[0].def;
      const cam = { x: c.x + 10, z: c.z + 6 };
      this.pose([[type, c.x, c.z]], pose, cam, [c.x - 3.4, c.z + 1]);
      const y = groundAt(c.x, c.z);
      const h = ENEMIES[type].height;
      g.debugCam = { pos: [cam.x, Math.max(groundAt(cam.x, cam.z) + 1.8, y + 1.8), cam.z], look: [c.x - 0.8, y + h * 0.45, c.z] };
    },
    pose(rows, pose, cam, [px, pz]) {
      only(null);
      window.__beast = null;
      const holds = { gloomowl: 'talon_dive', thunderwing: 'screech', hookbeak: 'gust', sharko: 'roar' };
      window.__lineup?.forEach((e) => (e.despawn = true));
      window.__lineup = rows.map(([type, x, z]) => {
        const e = g.spawnEnemy(type, p.pos.clone().set(x, groundAt(x, z) + 0.05, z));
        e.yaw = Math.atan2(cam.x - x, cam.z - z);
        const at = (ENEMIES[type].attacks || []).find((a) => a.id === holds[type]);
        e.update = function (dt) {
          if (pose && at) this.model.act = { name: at.id, t: (at.windup || 0.5) * 0.92, w: at.windup || 0.5, a: at.active || 0.1, r: at.recovery || 0.5 };
          this.syncModel(dt, { speed: 0, grounded: true });
        };
        return e;
      });
      stand(px, pz);
      p.yaw = Math.atan2(cam.x - px, cam.z - pz);
    },
  };
  void SECS;
}, { SECS });
await page.waitForFunction(() => window.__unstable.renderer.info.render.frame > 0, null, { timeout: 120000 });

const out = { packs: [], fights: [], errors };
let failed = false;
const fail = (why) => {
  failed = true;
  console.log(`  FAIL ${why}`);
};

if (SHOTS) {
  for (const pose of [false, true]) {
    await page.evaluate((pose) => window.__beastApi.lineup(pose), pose);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/lineup${pose ? '-windup' : ''}.png` });
    for (const type of ['gloomowl', 'thunderwing', 'sharko']) {
      await page.evaluate(([type, pose]) => window.__beastApi.portrait(type, pose), [type, pose]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${SHOTS}/${type}${pose ? '-windup' : ''}.png` });
    }
  }
}

const packs = PARTS.includes('packs') ? await page.evaluate(() => window.__beastApi.packs()) : [];
for (let i = 0; i < packs.length; i++) {
  await page.evaluate((i) => window.__beastApi.roam(i), i);
  await page.waitForFunction(() => window.__beast && window.__beast.done, null, { timeout: (SECS + 90) * 1000 });
  const r = await page.evaluate(() => window.__beastApi.roamResult());
  out.packs.push(r);
  console.log(`pack ${i} at ${r.centre.join(', ')} (L${r.level}): ${r.done}; walked ${r.path.join(' / ')} m, apart <= ${r.spread} m, out <= ${r.far} m, ${r.samples} samples`);
  if (r.done !== 'ok') fail(`pack ${i}: ${r.done}`);
  else {
    if (r.path.some((v) => v < 8)) fail(`pack ${i}: a beast barely moved`);
    if (r.spread >= 14) fail(`pack ${i}: the pair strung out to ${r.spread} m`);
    if (r.far > 48) fail(`pack ${i}: strayed ${r.far} m from its centre`);
    if (r.wet) fail(`pack ${i}: ${r.wet} samples in the water`);
    if (r.offGround) fail(`pack ${i}: ${r.offGround} samples off the ground`);
    if (r.aggro) fail(`pack ${i}: turned on the parked player`);
  }
  if (SHOTS && (await page.evaluate(() => window.__beastApi.shootPack()))) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/pack-${i}.png` });
  }
}

for (const type of PARTS.includes('fights') ? ['sharko', 'gloomowl'] : []) {
  await page.evaluate((type) => window.__beastApi.fight(type), type);
  if (SHOTS) {
    await page.waitForFunction(() => window.__beast.aggroAt !== null && window.__beast.t > 9, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => window.__beastApi.shootFight());
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/fight-${type}.png` });
  }
  await page.waitForFunction(() => window.__beast && window.__beast.done, null, { timeout: (SECS + 90) * 1000 });
  const r = await page.evaluate(() => window.__beastApi.fightResult());
  out.fights.push(r);
  const unused = r.attacks.filter((a) => !r.starts[a]);
  console.log(`fight ${type}: aggro at ${r.aggroAt} s, blows landed ${JSON.stringify(r.hits)}, closest ${r.minD} m; attacks ${JSON.stringify(r.starts)}${unused.length ? `; not seen: ${unused.join(', ')}` : ''}`);
  if (r.aggroAt === null) fail(`${type}: never aggroed`);
  if (!Object.keys(r.hits).length) fail(`${type}: no blow landed`);
}

if (errors.length) fail(`console errors:\n    ${[...new Set(errors)].slice(0, 10).join('\n    ')}`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));
console.log(failed ? 'FAILED' : 'OK - the packs roam and the beasts fight');
await browser.close();
process.exit(failed ? 1 : 0);
