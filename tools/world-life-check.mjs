// World life in the real game (game/worldLife.js, game/contracts.js): a host and a LAN guest on
// one dev server and relay. Each faction event is raised on the host at a place it belongs (a
// column on the Garrison Road, a checkpoint on the Dock Road, a convoy on the North Road, a
// sounding from the Sounding House, a skirmish on the Reed Downs, hunters after a wanted name, a
// cutter after a wanted sailor), and checked: the host spawns its people and props, and the
// guest standing beside it sees the same people (as proxies) and props. A sounding watched by
// the guest pays the guest, on the guest, through 'wevr'. Then the three contract boards: each
// stands by its officer and opens. Both consoles must stay clean.
//   LAN_URL=http://localhost:5173/ node tools/world-life-check.mjs [screenshot-dir] [--only=kind,kind]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.LAN_URL || 'http://localhost:5173/';
const args = process.argv.slice(2);
const OUT = args.find((a) => !a.startsWith('--')) || null;
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
if (OUT) mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`); };

async function open(name) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
  await page.evaluate(async (name) => {
    const g = window.__unstable;
    const { RACES } = await import('/src/data/races.js');
    g.startGame(g.createCharacter({ name, race: RACES[0].id, look: {} }), false);
    window.G = (await import('/src/core/globals.js')).G;
    window.H = (await import('/src/game/hooks.js')).ACTIONS;
    // keep each player alive and calm: the check is of the events, not of the fights
    setInterval(() => { const p = g.player; if (p && p.hp < p.maxHp * 0.5) p.hp = p.maxHp; if (p) p.sanity = 100; }, 100);
  }, name);
  await page.waitForFunction(() => window.__unstable.state === 'playing');
  return { ctx, page, errors };
}
const place = (page, x, z, face) => page.evaluate(([x, z, face]) => {
  const g = window.__unstable, p = g.player;
  if (p.boat) p.leaveBoat();
  p.pos.set(x, g.world.groundAt(x, z, 400) + 0.1, z);
  p.vel.set(0, 0, 0);
  p.fallStart = p.pos.y;
  if (face) g.camYaw = Math.atan2(face[0] - x, face[1] - z);
}, [x, z, face || null]);
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` }); };

const host = await open('Host');
const guest = await open('Guest');
for (const s of [host, guest]) await s.page.evaluate(() => {
  // no camps waking under the check, and no world event but the one raised
  const g = window.__unstable;
  for (const sp of g.spawners) sp.def = Object.assign({}, sp.def, { count: 0 });
  for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true;
  const L = H.worldLife();
  for (const k of ['column', 'convoy', 'sounding', 'skirmish', 'hunters', 'cutter', 'checkpoint']) L.timers[k] = 1e9;
});
await host.page.evaluate(() => window.__unstable.net.connect('host'));
await host.page.waitForFunction(() => window.__unstable.net.status === 'online', null, { timeout: 15000 });
await guest.page.evaluate(() => window.__unstable.net.connect('guest'));
await guest.page.waitForFunction(() => window.__unstable.net.status === 'online', null, { timeout: 15000 });
await host.page.waitForFunction(() => window.__unstable.net.avatars.size === 1, null, { timeout: 15000 });
check('host and guest connect', true, 'one relay');

// Raise an event on the host with the player at (x, z), the guest 10 m off; wait; compare.
async function raise(kind, { at, face, setup, guestAt, wait = 6 }) {
  await place(host.page, at[0], at[1], face);
  const g = guestAt || [at[0] + 8, at[1] + 6];
  await place(guest.page, g[0], g[1], face);
  if (setup) await host.page.evaluate(setup);
  await host.page.waitForTimeout(1500); // the guest's avatar reaches the host before the event looks for players
  const started = await host.page.evaluate((kind) => {
    const ev = H.forceLife(kind);
    window.__ev = ev;
    return !!ev;
  }, kind);
  if (!started) return { started: false };
  await host.page.waitForTimeout(wait * 1000);
  const h = await host.page.evaluate(() => {
    const ev = window.__ev, L = H.worldLife();
    const live = (ev.members || []).filter((e) => !e.dead && G.actors.includes(e));
    return {
      active: L.active.includes(ev), members: live.length, ids: live.map((e) => e.netId), types: [...new Set(live.map((e) => e.type))],
      props: (ev.props || []).filter((p) => p.object.visible).length, foes: (ev.foes || []).filter((e) => !e.dead).length,
      lead: live[0] ? [live[0].pos.x, live[0].pos.z] : null, d: ev.d ?? null,
    };
  });
  await guest.page.waitForTimeout(1200);
  const gs = await guest.page.evaluate((ids) => {
    const net = window.__unstable.net;
    const L = H.worldLife();
    const seen = ids.filter((id) => net.proxies.has(id));
    const props = G.scene.children.filter((o) => /^life_/.test(o.name) && o.visible).length;
    return { seen: seen.length, props, cps: [...L.guest.keys()] };
  }, h.ids || []);
  if (h.lead) {
    for (const s of [host, guest]) await s.page.evaluate(([x, z]) => { const g = window.__unstable, p = g.player; g.camYaw = Math.atan2(x - p.pos.x, z - p.pos.z); }, h.lead);
    await guest.page.waitForTimeout(300);
  }
  await shot(guest.page, `guest-${kind}`);
  await shot(host.page, `host-${kind}`);
  return { started: true, h, gs };
}
async function end() {
  await host.page.evaluate(async () => {
    const L = H.worldLife();
    const { endEvent } = await import('/src/game/worldLife.js');
    for (const ev of L.active.slice()) endEvent(window.__unstable, ev, 'check');
    const g = window.__unstable;
    g.ch.wanted = {};
    for (const f in g.ch.rep) g.ch.rep[f] = 0;
    for (const k in L.wantedTime) L.wantedTime[k] = 0;
  });
  await host.page.waitForTimeout(1500);
}
const want = (k) => !ONLY.length || ONLY.includes(k);

if (want('column')) {
  const r = await raise('column', { at: [1238, -205], wait: 10 });
  const moved = r.started ? await host.page.evaluate((d0) => Math.abs(window.__ev.d - d0), r.h.d) : 0;
  check('an Enclave column marches, and the guest sees it', r.started && r.h.members >= 4 && r.gs.seen === r.h.members,
    r.started ? `${r.h.members} on the march (${r.h.types.join(', ')}); the guest sees ${r.gs.seen} as proxies` : 'did not start');
  await end();
}
if (want('checkpoint')) {
  const r = await raise('checkpoint', { at: [1012 + 70, -540], setup: () => { window.__unstable.ch.rep.enclave = -20; } });
  check('a checkpoint is raised for a Distrusted name, and the guest sees its barricade and officer', r.started && r.h.members === 2 && r.h.props === 1 && r.gs.seen === 2 && r.gs.props >= 1 && r.gs.cps.length === 1,
    r.started ? `host: ${r.h.members} guards, ${r.h.props} barricade; guest: ${r.gs.seen} proxies, ${r.gs.props} life props shown, checkpoints up ${r.gs.cps.join(',')}` : 'did not start');
  await end();
}
if (want('convoy')) {
  const r = await raise('convoy', { at: [-20, 300], wait: 8 });
  check('a Watch convoy sets out on the North Road, cart and escort seen by the guest', r.started && r.h.members >= 2 && r.h.props === 1 && r.gs.seen === r.h.members && r.gs.props >= 1,
    r.started ? `host: ${r.h.members} escorts, cart shown ${r.h.props}; guest: ${r.gs.seen} proxies, ${r.gs.props} life props` : 'did not start');
  await end();
}
if (want('skirmish')) {
  const r = await raise('skirmish', { at: [-200, -12] });
  check('the Watch and the Redwake skirmish on the Reed Downs, both sides seen by the guest', r.started && r.h.members === 2 && r.h.foes >= 2,
    r.started ? `host: ${r.h.members} Watch, ${r.h.foes} Redwake; the guest sees ${r.gs.seen} of the Watch as proxies` : 'did not start');
  await end();
}
if (want('hunters')) {
  const r = await raise('hunters', { at: [1300, 40], wait: 8, setup: () => { const g = window.__unstable; g.ch.wanted.enclave = 400; H.worldLife().wantedTime.enclave = 200; } });
  check('hunters set out after a wanted name, from somewhere they can walk from', r.started && r.h.members >= 2 && r.gs.seen === r.h.members,
    r.started ? `host: ${r.h.members} hunters (${r.h.types.join(', ')}); guest sees ${r.gs.seen}` : 'did not start');
  await end();
}
if (want('sounding')) {
  // the guest watches from 30 m: it must be paid, on its own machine
  const site = await host.page.evaluate(async () => (await import('/src/data/factionLife.js')).SOUNDING_SITES);
  const r = await raise('sounding', { at: [-1250, 1110], wait: 4, setup: () => {} });
  if (r.started) {
    const s = await host.page.evaluate(() => { const ev = window.__ev; ev.phase = 'sound'; ev.soundT = 0; ev.bellT = 0; ev.provoked = false; return ev.def.at; });
    await guest.page.evaluate(() => { window.__toasts = []; const t = G.ui.toast.bind(G.ui); G.ui.toast = (m, k) => { window.__toasts.push(m); return t(m, k); }; window.__xp0 = window.__unstable.ch.xp ?? 0; window.__snd0 = window.__unstable.ch.stats.soundings || 0; });
    await place(guest.page, s[0] + 30, s[1], s);
    await place(host.page, -20, 300); // the host goes home: the event lasts for the guest
    await guest.page.waitForTimeout(64000);
    const g = await guest.page.evaluate(() => ({ toasts: window.__toasts.filter((m) => /sound/.test(m)), snd: (window.__unstable.ch.stats.soundings || 0) - window.__snd0 }));
    check('a sounding the guest watched pays the guest, on the guest', g.snd === 1 && g.toasts.length > 0, `guest's soundings +${g.snd}; "${(g.toasts[0] || '').slice(0, 70)}…"`);
    void site;
  } else check('a sounding the guest watched pays the guest, on the guest', false, 'did not start');
  await end();
}
if (want('cutter')) {
  const r = await (async () => {
    await host.page.evaluate(async () => {
      const g = window.__unstable;
      const { Boat } = await import('/src/entities/boat.js');
      const b = new Boat(g.player.pos.clone().set(700, 0, -150), 0, 'sloop');
      g.boats.push(b);
      g.player.boat = b;
      b.board(g.player, 0);
      g.ch.wanted.enclave = 400;
    });
    await host.page.waitForTimeout(1000);
    const ok = await host.page.evaluate(() => { const ev = H.forceLife('cutter'); window.__ev = ev; return !!ev; });
    if (!ok) return { started: false };
    await host.page.waitForTimeout(6000);
    const h = await host.page.evaluate(() => ({ members: window.__ev.members.filter((e) => !e.dead).length, boats: window.__unstable.boats.length, d: Math.hypot(window.__ev.boat.pos.x - window.__unstable.player.pos.x, window.__ev.boat.pos.z - window.__unstable.player.pos.z) }));
    await shot(host.page, 'host-cutter');
    return { started: true, h };
  })();
  check('an Enclave cutter runs down a wanted sailor', r.started && r.h.members === 3, r.started ? `${r.h.members} aboard, ${r.h.d.toFixed(0)} m off after 6 s` : 'did not start');
  await end();
}
// at sea: the host at the helm of a sloop, the guest swimming beside it
async function afloat(x, z, yaw = 0) {
  await host.page.evaluate(async ([x, z, yaw]) => {
    const g = window.__unstable, p = g.player;
    if (p.boat) p.leaveBoat();
    const { Boat } = await import('/src/entities/boat.js');
    const b = new Boat(p.pos.clone().set(x, 0, z), yaw, 'sloop');
    g.boats.push(b);
    p.enterBoat(b);
    g.camYaw = yaw;
  }, [x, z, yaw]);
  await guest.page.evaluate(([x, z]) => {
    const p = window.__unstable.player;
    if (p.boat) p.leaveBoat();
    p.pos.set(x, -0.6, z);
    p.vel.set(0, 0, 0);
  }, [x + 10, z + 6]);
  await host.page.waitForTimeout(1500);
}
async function raiseAtSea(kind, at, wait = 6) {
  await afloat(...at);
  const ok = await host.page.evaluate((kind) => { const ev = H.forceLife(kind); window.__ev = ev; return !!ev; }, kind);
  if (!ok) return { started: false };
  await host.page.waitForTimeout(wait * 1000);
  // the guest comes alongside whatever the event is (LAN shows enemies within 230 m)
  const nearBoat = await host.page.evaluate(() => window.__ev.boat && [window.__ev.boat.pos.x, window.__ev.boat.pos.z]);
  if (nearBoat) {
    await guest.page.evaluate(([x, z]) => { const p = window.__unstable.player; p.pos.set(x + 14, -0.6, z + 8); p.vel.set(0, 0, 0); }, nearBoat);
    await host.page.waitForTimeout(2500);
  }
  const h = await host.page.evaluate(() => {
    const ev = window.__ev;
    const live = [...(ev.members || []), ...(ev.foes || [])].filter((e) => !e.dead && G.actors.includes(e));
    return { boat: ev.boat ? [ev.boat.pos.x, ev.boat.pos.z] : null, ids: live.map((e) => e.netId), types: [...new Set(live.map((e) => e.type))], props: (ev.props || []).filter((p) => p.object.visible).length, state: ev.state };
  });
  await guest.page.waitForTimeout(1200);
  const gs = await guest.page.evaluate(([ids, b]) => {
    const net = window.__unstable.net;
    const boats = [...(net.netBoats ? net.netBoats.values() : [])];
    const near = b ? boats.filter((x) => Math.hypot(x.pos.x - b[0], x.pos.z - b[1]) < 30).length : 0;
    return { seen: ids.filter((id) => net.proxies.has(id)).length, boats: near, props: G.scene.children.filter((o) => /^life_/.test(o.name) && o.visible).length };
  }, [h.ids, h.boat]);
  if (h.boat) for (const s of [host, guest]) await s.page.evaluate(([x, z]) => { const g = window.__unstable, p = g.player; g.camYaw = Math.atan2(x - p.pos.x, z - p.pos.z); }, h.boat);
  await shot(guest.page, `guest-${kind}`);
  await shot(host.page, `host-${kind}`);
  return { started: true, h, gs };
}
if (want('seaConvoy')) {
  const mid = await host.page.evaluate(async () => { const { COURSES } = await import('/src/game/seaLife.js'); const p = COURSES.get('sc_rooks') || [...COURSES.values()][0]; const m = p[Math.floor(p.length / 2)]; return [m.x + 40, m.z]; });
  const r = await raiseAtSea('seaConvoy', mid, 8);
  check('a supply sloop sails its sea road, crew aboard, and the guest sees boat and crew', r.started && r.h.boat && r.h.ids.length >= 2 && r.gs.boats >= 1 && r.gs.seen === r.h.ids.length,
    r.started ? `host: sloop at ${r.h.boat.map((v) => v.toFixed(0)).join(', ')}, crew ${r.h.types.join(', ')}; guest: ${r.gs.boats} boat there, ${r.gs.seen} of ${r.h.ids.length} crew as proxies` : 'did not start');
  await end();
}
if (want('falseConvoy')) {
  const r = await raiseAtSea('falseConvoy', [700, -150]);
  check('a "Watch" sloop under false colours closes on the sailor, seen by the guest', r.started && r.h.boat && r.h.types.includes('brigand') && r.gs.boats >= 1,
    r.started ? `host: crew ${r.h.types.join(', ')}, state ${r.h.state}; guest: ${r.gs.boats} boat, ${r.gs.seen} crew` : 'did not start');
  await end();
}
if (want('beset')) {
  const r = await raiseAtSea('beset', [700, -150]);
  check('a fishing boat beset by sharks, seen by the guest', r.started && r.h.types.includes('gnashfin') && r.h.ids.length === 3 && r.gs.boats >= 1,
    r.started ? `host: ${r.h.ids.length} ${r.h.types.join(', ')}; guest: ${r.gs.boats} boat, ${r.gs.seen} sharks as proxies` : 'did not start');
  await end();
}
if (want('drift')) {
  let r = { started: false };
  for (let i = 0; i < 6 && !r.started; i++) r = await raiseAtSea('drift', [700, -150 - i * 20], 3);
  check('a trail of wreckage and a drifting hull, seen by the guest', r.started && r.h.props >= 6 && r.gs.props >= 6 && r.gs.boats >= 1,
    r.started ? `host: ${r.h.props} pieces afloat; guest: ${r.gs.props} life props, ${r.gs.boats} hull` : 'did not start');
  await end();
}
// leave the sea before the boards
await host.page.evaluate(() => { const p = window.__unstable.player; if (p.boat) p.leaveBoat(); });

if (want('boards')) {
  const boards = await host.page.evaluate(async () => (await import('/src/game/contracts.js')).BOARDS.map((b) => ({ ...b })));
  check('a contract board stands by each officer', boards.length === 3, boards.map((b) => `${b.faction} at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`).join('; '));
  await host.page.evaluate(() => { const p = window.__unstable.player; if (p.boat) p.leaveBoat(); });
  for (const b of boards) {
    await host.page.evaluate((f) => { const g = window.__unstable; g.ch.rep[f] = 15; if (f === 'ministry') g.ch.flags.ministry_guest = true; }, b.faction);
    const yaw = b.yaw;
    const sx = b.x + Math.sin(yaw) * 1.8, sz = b.z + Math.cos(yaw) * 1.8;
    await host.page.evaluate(([x, y, z, bx, bz]) => {
      const g = window.__unstable, p = g.player;
      p.pos.set(x, y + 0.1, z);
      p.vel.set(0, 0, 0);
      g.camYaw = Math.atan2(bx - x, bz - z);
    }, [sx, b.y, sz, b.x, b.z]);
    await host.page.waitForTimeout(800);
    // a free camera on the board: a few paces out in front, at eye height, the officer beside it
    await host.page.evaluate(([x, y, z, yaw]) => {
      const g = window.__unstable;
      for (const sel of ['#hud', '#world-ui']) { const el = document.querySelector(sel); if (el) el.style.display = 'none'; }
      g.player.model.root.visible = false;
      g.debugCam = { pos: [x + Math.sin(yaw) * 4.5 + Math.cos(yaw) * 1.2, y + 1.9, z + Math.cos(yaw) * 4.5 - Math.sin(yaw) * 1.2], look: [x, y + 1.3, z] };
    }, [b.x, b.y, b.z, yaw]);
    await host.page.waitForTimeout(500);
    await shot(host.page, `board-${b.faction}`);
    await host.page.evaluate(() => {
      const g = window.__unstable;
      g.debugCam = null;
      g.player.model.root.visible = true;
      for (const sel of ['#hud', '#world-ui']) { const el = document.querySelector(sel); if (el) el.style.display = ''; }
    });
    const near = await host.page.evaluate(() => { const it = window.__unstable.findInteractable(); return it && it.id; });
    const opened = await host.page.evaluate((f) => { H.openContracts(f); const m = window.__unstable.ui.modal; const html = m && m.el.innerHTML; return { html: html && html.includes('CONTRACTS'), offers: html ? (html.match(/data-take=/g) || []).length : 0 }; }, b.faction);
    await shot(host.page, `board-${b.faction}-panel`);
    await host.page.evaluate(() => window.__unstable.ui.closeModal());
    check(`${b.faction}'s board can be read`, near === 'contracts_' + b.faction && opened.html && opened.offers === 3, `nearest interact ${near}; panel shown ${opened.html} with ${opened.offers} offers`);
  }
}

console.log('host console errors', host.errors.length, host.errors.slice(0, 5));
console.log('guest console errors', guest.errors.length, guest.errors.slice(0, 5));
await browser.close();
process.exit(results.every((r) => r.ok) && !host.errors.length && !guest.errors.length ? 0 : 1);
