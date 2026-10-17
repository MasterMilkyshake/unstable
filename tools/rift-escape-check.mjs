// Can a newcomer leave the Rift? A fresh Power 1 character dies on the surface, falls into the
// Rift, and walks out the way a player who knows it would, with real input: held keys along the
// arrival way, up the approach ramp, through the Great South Gate and the Gate Plaza, through the
// keep by the route the game's own pathfinder finds (from the plaza: a search reaches 160 m),
// then [E] on the Ascent's one lift (the courtyard to the summit) and on the summit wound. It runs past whatever
// chases it rather than fighting (a Power 1 fight in the Rift is lost), and is never healed.
//   RIFT_URL=http://localhost:5173/ node tools/rift-escape-check.mjs [runs=3] [--secs=200]
// Each run: a fresh browser; out or not, the time, deaths, lowest health, sanity at the end,
// which enemies turned on it, console errors. Fails if any run does not get out.
import { chromium } from 'playwright';

const URL = process.env.RIFT_URL || 'http://localhost:5173/';
const args = process.argv.slice(2);
const runs = Number(args.find((a) => !a.startsWith('--')) || 3);
const SECS = Number((args.find((a) => a.startsWith('--secs=')) || '--secs=200').split('=')[1]);

let failed = false;
for (let run = 1; run <= runs; run++) {
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
  await page.evaluate(async (SECS) => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    const { G } = await import('/src/core/globals.js');
    const { navGrid, navBody } = await import('/src/entities/nav.js');
    const { liftDeckRoutes } = await import('/src/world/ascentLifts.js');
    const ch = g.createCharacter({ name: 'Newcomer', race: RACES[0].id, look: {} });
    ch.armed = true;
    g.startGame(ch, false);
    const p = g.player;
    const I = g.input;
    const E = (window.__escape = { t: 0, landed: false, out: false, done: false, deaths: 0, minHp: 1, foes: [], stalled: null });
    const death = g.onPlayerDeath.bind(g);
    g.onPlayerDeath = (src) => {
      E.deaths++;
      return death(src);
    };
    const exit = g.exitRift.bind(g);
    g.exitRift = (fromDeath) => {
      if (!fromDeath) E.out = true;
      return exit(fromDeath);
    };
    g.enterRift(true); // a surface death's way down
    const lift = g.world.rift.ascentLifts.lifts.find((l) => l.def.id === 'ascent_lift');
    const wound = g.world.interactables.find((it) => it.id === 'ascent_summit');
    const steps = [];
    // how close counts as there: tight in the keep's narrow passages, looser on the landings' decks
    // `plan`: on the landings, the pathfinder routes each short hop (a straight line from the cage
    // catches on the door frames)
    const walk = (x, z, name, near = 1.2, plan = false) => steps.push({ kind: 'walk', x, z, name, near, plan });
    for (const [x, z] of [[6000, 5880], [6000, 5914], [6000, 5944], [6000, 5961]]) walk(x, z, 'the way in');
    // through the keep, by the pathfinder's route from the plaza to the lift's open front
    const door = [lift.x, lift.z + 4]; // the cage is boarded from the courtyard, 4 m out
    const route = navGrid(g.world).findPath(6000, 5961, g.world.groundAt(6000, 5961, 30), door[0], door[1], lift.y0, navBody(p), 200000);
    if (!route || !route.complete) {
      E.stalled = 'no route through the keep';
      E.done = true;
    }
    for (const q of route ? route.points : []) walk(q[0], q[2], 'the keep', 0.6);
    walk(lift.x, lift.z, 'onto the lift', 0.8);
    steps.push({ kind: 'ride', lift });
    for (const [x, z] of liftDeckRoutes(lift.def).to.slice(1)) walk(x, z, 'off the lift', 1.2, true);
    walk(wound.pos.x, wound.pos.z, 'to the wound', 2.5);
    steps.push({ kind: 'use' });
    let si = 0;
    let checkT = 0;
    let last = null;
    let still = 0;
    const update = g.updatePlaying.bind(g);
    g.updatePlaying = (dt) => {
      E.t += dt;
      const st = steps[si];
      if (E.out || E.done || g.transitioning || !g.inRift) {
        I.down.delete('KeyW');
        return update(dt);
      }
      if (E.t > SECS || E.deaths) {
        E.done = true;
        E.stalled ||= E.deaths ? 'died' : `stalled at ${st ? st.name || st.kind : '?'}`;
        return update(dt);
      }
      if (!E.landed) {
        E.landed = p.grounded;
        return update(dt);
      }
      E.minHp = Math.min(E.minHp, p.hp / p.maxHp);
      for (const a of G.actors) {
        if (a.team === 'enemy' && a.aggro && a.target === p && !a.illusion && !E.foes.includes(a.type)) E.foes.push(a.type);
      }
      if (st.kind === 'walk') {
        if (st.plan && !st.hops) {
          const r = navGrid(g.world).findPath(p.pos.x, p.pos.z, p.pos.y, st.x, st.z, NaN, navBody(p), 60000);
          st.hops = r ? r.points.map((q) => [q[0], q[2]]) : [];
        }
        while (st.hops && st.hops.length && Math.hypot(st.hops[0][0] - p.pos.x, st.hops[0][1] - p.pos.z) < 0.5) st.hops.shift();
        const [hx, hz] = st.hops && st.hops.length ? st.hops[0] : [st.x, st.z];
        g.camYaw = Math.atan2(hx - p.pos.x, hz - p.pos.z);
        I.down.add('KeyW');
        I.down.add('ShiftLeft');
        if (Math.hypot(st.x - p.pos.x, st.z - p.pos.z) < st.near) si++;
        // a jump over whatever the feet caught on
        if ((checkT += dt) > 2) {
          checkT = 0;
          if (last && Math.hypot(p.pos.x - last[0], p.pos.z - last[1]) < 0.5) I.pressed.add('Space');
          last = [p.pos.x, p.pos.z];
        }
      } else if (st.kind === 'ride') {
        I.down.delete('KeyW');
        if (!st.pressed) {
          if (g.findInteractable() === st.lift.ride) {
            I.pressed.add('KeyE');
            st.pressed = true;
          } else if ((still += dt) > 3) {
            E.stalled = `no ride at ${st.lift.def.id}`;
            E.done = true;
          }
        } else if (!st.lift.moving && Math.abs(st.lift.y - st.lift.y1) < 0.1) {
          si++;
          still = 0;
        }
      } else if (st.kind === 'use' && g.findInteractable() === wound) {
        I.pressed.add('KeyE');
        si++;
      }
      update(dt);
    };
  }, SECS);
  await page.waitForFunction(() => window.__escape.out || window.__escape.done, null, { timeout: (SECS + 90) * 1000, polling: 500 });
  const r = await page.evaluate(() => ({ ...window.__escape, sanity: Math.round(window.__unstable.ch.sanity) }));
  const ok = r.out && !errors.length;
  failed ||= !ok;
  console.log(`run ${run}: ${r.out ? `OUT after ${r.t.toFixed(0)} s` : `NOT OUT (${r.stalled})`}, deaths ${r.deaths}, lowest health ${Math.round(r.minHp * 100)}%, ` +
    `sanity ${r.sanity}, turned on it: ${r.foes.length ? r.foes.join(', ') : 'nothing'}, console errors ${errors.length}${errors.length ? ' ' + errors.slice(0, 2).join(' | ') : ''}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
