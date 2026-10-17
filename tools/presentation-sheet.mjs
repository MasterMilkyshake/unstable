// Before/after contact sheet for combat presentation (task 8 of the systems round): the same
// moments captured on two builds, side by side. Needs two dev servers (or one, for a single row).
//   node tools/presentation-sheet.mjs <out.png> <url A> [url B]
// Moments: a red (unparryable) and an orange (unblockable) wind-up, hanging from a ledge, a blow
// on a raised guard, a parried blow, and a swing at the instant the rules strike. Each is set up by
// simulation (keys and AI), frozen, framed with the debug camera, and captured. 0 console errors.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [out, ...urls] = process.argv.slice(2);

if (!out || !urls.length) {
  console.error('usage: node tools/presentation-sheet.mjs <out.png> <url A> [url B]');
  process.exit(2);
}
const MOMENTS = ['red', 'orange', 'hang', 'blocked', 'parried', 'contact'];
const W = 480;
const H = 300;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const rows = [];
let errorsAll = 0;
try {
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width: W * 2, height: H * 2 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url, { timeout: 180000 });
    await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
    await page.addStyleTag({ content: '#click-resume, .toast, #toasts, #banner { display: none !important; }' });
    await page.evaluate(async () => {
      const g = window.__unstable;
      g.input.requestLock = () => {};
      const { RACES } = await import('/src/data/races.js');
      const ch = g.createCharacter({ name: 'Model', race: RACES[0].id, look: {} });
      ch.armed = true;
      ch.attrs.medium = 20;
      ch.inventory.weapons.push({ uid: 's1', id: 'steel_longsword' });
      ch.equipped.weapon = 's1';
      g.startGame(ch, false);
      const { G } = await import('/src/core/globals.js');
      for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
      for (const a of G.actors) if (a !== G.player && (a.team === 'enemy' || a.team === 'guard')) a.despawn = true;
      g.world.sky.update = ((up) => function (dt, ...rest) { this.time = 0.42; return up.call(this, 0, ...rest); })(g.world.sky.update);
      const P = (window.__ps = { G, g, t: 0, hooks: [], frozen: false });
      const update = g.updatePlaying.bind(g);
      g.updatePlaying = (dt) => {
        if (P.frozen) return;
        P.t += dt;
        for (const h of [...P.hooks]) h(dt);
        update(dt);
      };
      P.after = (s) => new Promise((res) => {
        const end = P.t + s;
        const h = () => {
          if (P.t >= end) {
            P.hooks.splice(P.hooks.indexOf(h), 1);
            res();
          }
        };
        P.hooks.push(h);
      });
      P.until = (fn, s = 3) => new Promise((res) => {
        const end = P.t + s;
        const h = () => {
          if (fn() || P.t >= end) {
            P.hooks.splice(P.hooks.indexOf(h), 1);
            res();
          }
        };
        P.hooks.push(h);
      });
      P.home = G.player.pos.clone();
      P.reset = () => {
        P.frozen = false;
        P.hooks.length = 0;
        for (const a of G.actors) if (a !== G.player && a.team === 'enemy') a.despawn = true;
        const p = G.player;
        p.pos.copy(P.home);
        p.vel.set(0, 0, 0);
        p.yaw = 0;
        g.camYaw = 0;
        p.climbing = false;
        p.noGravity = false;
        p.cancelAttack();
        if (p.knocked) p.rise(1);
        p.hp = p.maxHp;
        p.posture = 0;
        p.stunT = 0;
        p.guardBroken = false;
        p.fallStart = p.pos.y;
        p.parryCd = 0;
        g.input.down.clear();
        g.debugCam = null;
      };
      P.ground = (x, z) => Math.max(g.world.terrain.heightAt(x, z), g.world.colliders.groundAt(x, z, P.home.y + 6, 0.2));
      P.foe = (dx, dz) => {
        const p = G.player;
        const e = g.spawnEnemy('brigand', p.pos.clone().set(p.pos.x + dx, P.ground(p.pos.x + dx, p.pos.z + dz) + 0.05, p.pos.z + dz));
        e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
        e.spec = { ...e.spec, defend: { parry: 0, block: 0, dodge: 0 } };
        e.setAggro(p);
        P.hooks.push(() => (e.ai.atkCd = 99));
        return e;
      };
      // frame two points: the camera off to the side, slightly raised
      P.frame = (a, b, side = 3.2, up = 1.2) => {
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        g.debugCam = { pos: [mx + (-dz / l) * side, a.y + 1.2 + up, mz + (dx / l) * side], look: [mx, a.y + 1.1, mz] };
      };
    });
    await page.waitForTimeout(1500);
    const shots = [];
    for (const m of MOMENTS) {
      await page.evaluate(async (m) => {
        const P = window.__ps;
        const { G, g } = P;
        P.reset();
        const p = G.player;
        await P.after(0.2);
        if (m === 'red' || m === 'orange') {
          const e = P.foe(0, 2.6);
          await P.after(0.1);
          e.startAttack({ anim: 'heavySlam', windup: 0.9, active: 0.12, recovery: 0.3, dmg: 1, unparryable: m === 'red', unblockable: m === 'orange' });
          await P.after(0.25);
          // the attacker head and shoulders, with room above for its mark
          const dir = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
          g.debugCam = { pos: [e.pos.x - Math.sin(dir) * 3.6 + Math.cos(dir) * 1.2, e.pos.y + 2.2, e.pos.z - Math.cos(dir) * 3.6 - Math.sin(dir) * 1.2], look: [e.pos.x, e.pos.y + 2.0, e.pos.z] };
        } else if (m === 'hang') {
          // the nearest catchable edge: a wall 2.5-4 m high in front of open ground
          const w = g.world;
          let spot = null;
          for (const c of w.colliders.query(p.pos.x, p.pos.z, 600, [])) {
            if (c.kind !== 'box' || !c.walkable) continue;
            const th = w.terrain.heightAt(c.x, c.z);
            if (c.y1 - th < 2.6 || c.y1 - th > 4 || c.y0 > th + 0.3 || c.hw < 1.5 || c.hd < 1.5) continue;
            const lz = -c.hd - 1.4;
            const fx = c.x + lz * (c.sin || 0);
            const fz = c.z + lz * (c.cos ?? 1);
            if (Math.abs(P.ground(fx, fz) - w.terrain.heightAt(fx, fz)) > 0.3) continue;
            spot = { fx, fz, yaw: Math.atan2(c.x - fx, c.z - fz) };
            break;
          }
          p.pos.set(spot.fx, P.ground(spot.fx, spot.fz) + 0.05, spot.fz);
          p.yaw = spot.yaw;
          g.camYaw = spot.yaw;
          g.input.down.add('KeyW');
          await P.after(0.25);
          g.input.pressed.add('Space');
          await P.until(() => p.climbing, 1.5);
          await P.after(0.6);
          g.input.down.clear();
          const back = { x: p.pos.x - Math.sin(p.yaw) * 4, y: p.pos.y, z: p.pos.z - Math.cos(p.yaw) * 4 };
          g.debugCam = { pos: [back.x + Math.cos(p.yaw) * 2.2, p.pos.y + 1.5, back.z - Math.sin(p.yaw) * 2.2], look: [p.pos.x, p.pos.y + 1.6, p.pos.z] };
        } else if (m === 'blocked') {
          g.input.down.add('KeyF');
          const e = P.foe(0, 2.4);
          await P.after(0.3);
          const { applyHit } = await import('/src/combat/combat.js');
          applyHit(e, p, Object.assign(e.buildHit(e.humanoidM1(0), p), { from: e.pos.clone(), heavy: true }));
          await P.after(0.07);
          P.frame(p.pos, e.pos);
        } else if (m === 'parried') {
          const e = P.foe(0, 2.4);
          await P.after(0.1);
          e.startAttack(e.humanoidM1(0));
          await P.until(() => e.atk && e.atk.t > e.atk.def.windup - 0.12, 2);
          g.input.pressed.add('KeyF');
          await P.until(() => !e.atk || e.stunT > 0, 1);
          await P.after(0.12);
          P.frame(p.pos, e.pos);
        } else if (m === 'contact') {
          const e = P.foe(0, 2.2);
          await P.after(0.1);
          g.input.mPressed[0] = true;
          await P.until(() => p.atk && p.atk.phase === 'active', 1);
          P.frame(p.pos, e.pos, 2.8, 0.4);
        }
        P.frozen = true;
      }, m);
      await page.waitForTimeout(250);
      shots.push((await page.screenshot({ clip: { x: W / 2, y: H / 2, width: W, height: H } })).toString('base64'));
      await page.evaluate(() => (window.__ps.frozen = false));
    }
    rows.push({ url, shots, errors: errors.length });
    errorsAll += errors.length;
    console.log(`${url}: ${shots.length} moments, console errors ${errors.length}${errors.length ? ' ' + errors.slice(0, 2).join(' | ') : ''}`);
    await page.close();
  }
  // compose the sheet in a canvas
  const sheet = await browser.newPage({ viewport: { width: 200 + MOMENTS.length * (W / 2 + 8), height: 60 + rows.length * (H / 2 + 30) } });
  await sheet.setContent('<body style="margin:0;background:#16151a"><canvas id=c></canvas></body>');
  const png = await sheet.evaluate(async ({ rows, MOMENTS, W, H }) => {
    const cw = W / 2;
    const chh = H / 2;
    const c = document.getElementById('c');
    c.width = 200 + MOMENTS.length * (cw + 8);
    c.height = 40 + rows.length * (chh + 30);
    const x = c.getContext('2d');
    x.fillStyle = '#16151a';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#e8e2d0';
    x.font = '15px sans-serif';
    MOMENTS.forEach((m, i) => x.fillText(m, 200 + i * (cw + 8) + 4, 24));
    for (let r = 0; r < rows.length; r++) {
      x.fillText(rows[r].url.replace(/^https?:\/\//, ''), 8, 40 + r * (chh + 30) + chh / 2);
      for (let i = 0; i < rows[r].shots.length; i++) {
        const img = new Image();
        img.src = 'data:image/png;base64,' + rows[r].shots[i];
        await img.decode();
        x.drawImage(img, 200 + i * (cw + 8), 36 + r * (chh + 30), cw, chh);
      }
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { rows, MOMENTS, W, H });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(png, 'base64'));
  // and each moment full size, beside the sheet
  const dir = out.replace(/\.png$/, '');
  fs.mkdirSync(dir, { recursive: true });
  rows.forEach((r, ri) => r.shots.forEach((s, i) => fs.writeFileSync(`${dir}/${ri ? 'b' : 'a'}-${MOMENTS[i]}.png`, Buffer.from(s, 'base64'))));
  console.log(`sheet: ${out}`);
} finally {
  await browser.close();
}
process.exit(errorsAll ? 1 : 0);
