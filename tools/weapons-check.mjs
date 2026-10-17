// In-game check of weapon handling and traits (task 3 of the systems round): three weapons of
// different classes swung at brigands by the Wash spawn with real input. Needs a dev server.
//   WEAPONS_URL=http://localhost:5173/ node tools/weapons-check.mjs [weapon ids...]
// For each weapon: its reach and wind-up as swung, the walk speed and roll cooldown its weight
// leaves, the chip a blocking brigand takes, and its trait where the scene can show it.
import { chromium } from 'playwright';

const URL = process.env.WEAPONS_URL || 'http://localhost:5173/';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['cutlass', 'magma_maul', 'stormpiercer'];
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
  const rows = await page.evaluate(async (ids) => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    const { WEAPONS, WEAPON_CLASSES, weaponFeelText } = await import('/src/data/weapons.js');
    const ch = g.createCharacter({ name: 'Smith', race: RACES[0].id, look: {} });
    ch.armed = true;
    ch.level = 12;
    Object.assign(ch.attrs, { heavy: 45, medium: 45, light: 45, strength: 25 });
    ids.forEach((id, i) => ch.inventory.weapons.push({ uid: 'w' + i, id }));
    g.startGame(ch, false);
    const { G } = await import('/src/core/globals.js');
    for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
    for (const a of G.actors) if (a !== G.player && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
    const p = G.player;
    let t = 0;
    const hooks = [];
    const waits = [];
    const update = g.updatePlaying.bind(g);
    g.updatePlaying = (dt) => {
      t += dt;
      for (const h of hooks) h();
      update(dt);
      for (let i = waits.length - 1; i >= 0; i--) if (waits[i].until()) waits.splice(i, 1)[0].res();
    };
    const wait = (s) => new Promise((res) => {
      const end = t + s;
      waits.push({ until: () => t >= end, res });
    });
    const ground = (x, z) => Math.max(g.world.terrain.heightAt(x, z), g.world.colliders.groundAt(x, z, p.pos.y + 4, 0.2));
    const foe = (dx, dz) => {
      const x = p.pos.x + dx;
      const z = p.pos.z + dz;
      const e = g.spawnEnemy('brigand', p.pos.clone().set(x, ground(x, z) + 0.05, z));
      e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      e.setAggro(p);
      e.spec = { ...e.spec, defend: { parry: 0, block: 0, dodge: 0 } };
      hooks.push(() => (e.ai.atkCd = 99));
      return e;
    };
    const home = p.pos.clone();
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const w = WEAPONS[id];
      p.equipWeapon('w' + i);
      p.pos.copy(home);
      p.yaw = 0;
      g.camYaw = 0;
      p.critCd = 0;
      hooks.length = 0;
      await wait(0.3);
      const row = { id, feel: weaponFeelText(w), walk: +p.speedBase.toFixed(2), rollCd: +p.derived.dodgeCd.toFixed(2) };
      // a blocking brigand in front: one M1 with real input
      const e = foe(0, 2.4);
      e.blocking = true;
      hooks.push(() => (e.blocking = true));
      g.input.mPressed[0] = true;
      await wait(0.05);
      row.range = +p.atk.def.range.toFixed(2);
      row.windup = +p.atk.def.windup.toFixed(3);
      row.classRange = WEAPON_CLASSES[w.cls].range;
      const hp0 = e.hp;
      await wait(0.8);
      row.chip = +(hp0 - e.hp).toFixed(2);
      e.despawn = true;
      // the trait, where the scene can show it
      if (w.trait === 'lightning_rod') {
        const a = foe(0, 2.4);
        const b = foe(2.5, 4);
        const c = foe(-2.5, 4);
        p.critCd = 0;
        g.input.pressed.add('KeyR');
        await wait(1.2);
        row.trait = `crit arced to ${[b, c].filter((x) => x.hp < x.maxHp).length} of 2 foes beside the one struck (${a.hp < a.maxHp ? 'struck' : 'missed'})`;
        row.traitOk = a.hp < a.maxHp && [b, c].every((x) => x.hp < x.maxHp);
      } else if (w.trait === 'molten') {
        const a = foe(0, 2.4);
        await wait(0.2);
        a.applyStatus('burn', 1, p);
        const h0 = a.hp;
        g.input.mPressed[0] = true;
        await wait(0.9);
        row.trait = `a burning brigand lost ${(h0 - a.hp).toFixed(1)}`;
        row.traitOk = h0 - a.hp > 6;
      } else row.traitOk = true;
      for (const a of G.actors) if (a.team === 'enemy') a.despawn = true;
      out.push(row);
    }
    return out;
  }, ids);
  for (const r of rows) {
    const ok = r.traitOk && r.windup > 0;
    console.log(`${r.id}: range ${r.range} m (class ${r.classRange}), wind-up ${r.windup} s, walk ${r.walk} m/s, roll cooldown ${r.rollCd} s, chip through a block ${r.chip}${r.trait ? `, ${r.trait}` : ''}\n  tooltip: ${r.feel}`);
    failed ||= !ok;
  }
  const walks = rows.map((r) => r.walk);
  if (new Set(walks).size !== walks.length) failed = true;
  console.log(`console errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
  failed ||= errors.length > 0;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
