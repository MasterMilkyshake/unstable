// LAN co-op check: a host and a guest (two browser contexts) on one server and relay. It runs on
// the dev server or on the built bundle (`npm run lan:prod`, or vite preview): only the page's
// own handles (window.__unstable, window.__G) are used.
//   LAN_URL=http://localhost:5173/ node tools/lan-check.mjs [screenshot-dir]
// Verifies: the guest joins through the menu (LAN Co-op → Join → a save slot → creation) and
// plays in that slot; both see the same brigand; the guest's hits are resolved by the host; the
// host enemy's hits on the guest resolve on the guest (and its HP reaches the host); a guest
// parry staggers the host's brigand; the guest's death loop runs on its own machine while
// connected (a surface death into the Rift, then a death in the Rift ending the character into
// the guest's own register, the host untouched), and a new character in the
// emptied slot rejoins; when the host leaves, the guest plays on alone with its own spawners. The
// guest is kept alive while fighting, faces the brigand, and holds its parry window open in the
// parry phase (the network path is what is under test, not the player's timing).
// The systems round's moves (checks 6-11): a guest uppercut launches the host's brigand and opens
// the guest's air chase; a guest flourish holds on the host's avatar; a weapon trait on a guest's
// blow (blind) is resolved by the host; a host Bonesetter's mending shows on the guest; a guest
// roll-cancel reaches the host; an enemy flourish on the host holds its replay on the guest.
import { chromium } from 'playwright';

const URL = process.env.LAN_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || null;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`); };

async function open(name, viaMenu = false) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__unstable && window.__unstable.world && window.__unstable.state === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    window.G = window.__G;
    window.__unstable.input.requestLock = () => {};
  });
  if (!viaMenu) {
    await page.evaluate((name) => {
      const g = window.__unstable;
      g.startGame(g.createCharacter({ name, race: 'ashkin', look: {} }), false);
    }, name);
    await page.waitForFunction(() => window.__unstable.state === 'playing');
  }
  return { ctx, page, errors };
}
// Join from the main menu, the way a player does: LAN Co-op → Join a Game → the slot list (an
// empty slot starts a new character) → Wake Up.
async function joinFromMenu(page, slot, name) {
  await page.click('#main-menu [data-a="lan"]');
  await page.waitForSelector('#lan [data-a="join"]');
  await page.click('#lan [data-a="join"]');
  await page.waitForSelector(`#slots [data-slot="${slot}"]`);
  await page.click(`#slots [data-slot="${slot}"]`);
  await page.waitForSelector('#creation #cr-name');
  await page.fill('#creation #cr-name', name);
  await page.click('#creation [data-a="begin"]');
  await page.waitForFunction(() => window.__unstable.state === 'playing' && window.__unstable.net.status === 'online', null, { timeout: 20000 });
}
const slotSave = (page, n) => page.evaluate((n) => {
  try {
    const v = JSON.parse(localStorage.getItem(n === 1 ? 'unstable.save.v1' : `unstable.save.v1.slot${n}`) || 'null');
    return v && v.character ? { name: v.character.name, lives: v.character.lives, savedAt: v.savedAt } : null;
  } catch (_) {
    return null;
  }
}, n);
const place = (page, x, z) => page.evaluate(([x, z]) => {
  const g = window.__unstable, p = g.player;
  p.pos.set(x, g.world.groundAt(x, z, 400) + 0.1, z);
  p.vel.set(0, 0, 0);
  p.fallStart = p.pos.y;
}, [x, z]);

const host = await open('Host');
// the guest's profile already holds a character in slot 1; it joins with a new one in slot 2
const guest = await open('Guest', true);
await guest.page.evaluate(() => {
  const g = window.__unstable;
  localStorage.setItem('unstable.save.v1', JSON.stringify({ version: 1, character: g.createCharacter({ name: 'Stay Home', race: 'ashkin', look: {} }), savedAt: 1 }));
  g.ui.showMainMenu();
});

// host: no spawner brigands of its own, only the test brigand
await host.page.evaluate(() => {
  const g = window.__unstable;
  for (const s of g.spawners) s.def = Object.assign({}, s.def, { count: 0 });
  for (const a of G.actors) if (a.team === 'enemy' || a.team === 'guard') a.despawn = true;
});
// the brigand camp east of Saltreach (placed spawner at 1345, 125; dry land)
await place(host.page, 1352, 140);
await host.page.evaluate(() => window.__unstable.net.connect('host'));
await host.page.waitForFunction(() => window.__unstable.net.status === 'online', null, { timeout: 15000 });
await joinFromMenu(guest.page, 2, 'Guest');
await place(guest.page, 1340, 136);
await host.page.waitForFunction(() => window.__unstable.net.avatars.size === 1, null, { timeout: 15000 });
await guest.page.waitForTimeout(1500);
const s1 = await slotSave(guest.page, 1);
const s2 = await slotSave(guest.page, 2);
check('the guest joins through the menu and plays in the slot it chose', s2 && s2.name === 'Guest' && s1 && s1.name === 'Stay Home' && s1.savedAt === 1,
  `slot 2: ${s2 && s2.name}; slot 1 untouched: ${s1 && s1.name} (saved at ${s1 && s1.savedAt})`);
await guest.page.waitForFunction(() => window.__unstable.net.avatars.size === 1, null, { timeout: 15000 });
const told = (page) => page.evaluate(() => [...document.querySelectorAll('.toast')].map((e) => e.textContent).find((t) => /hosting|joined/.test(t)) || '');
const toldHost = await told(host.page);
const toldGuest = await told(guest.page);
check('host and guest connect, and each is told so', /hosting/.test(toldHost) && /joined Host's world/.test(toldGuest),
  `host id ${await host.page.evaluate(() => window.__unstable.net.id)}, guest id ${await guest.page.evaluate(() => window.__unstable.net.id)}; host told "${toldHost}", guest told "${toldGuest}"`);

// instrument both sides
await host.page.evaluate(() => {
  const net = window.__unstable.net;
  window.__h = { guestHits: [], parried: [] };
  const og = net.onGuestHit.bind(net);
  net.onGuestHit = (m) => { const en = net.enemyById(m.e); const hp0 = en && en.hp; og(m); window.__h.guestHits.push({ hp0, hp1: en && en.hp }); };
});
await guest.page.evaluate(() => {
  const net = window.__unstable.net, p = window.__unstable.player;
  window.__g = { hitRes: [], hitYou: [], parryMode: false, swing: false };
  const ohr = net.onHitResult.bind(net);
  net.onHitResult = (m) => { window.__g.hitRes.push({ r: m.r, d: m.d }); ohr(m); };
  const ohy = net.onHitYou.bind(net);
  net.onHitYou = (m) => {
    const hp0 = p.hp, parryT = p.parryT;
    ohy(m);
    window.__g.hitYou.push({ hp0, hp1: p.hp, parryWindow: parryT > 0, parryCdAfter: p.parryCd });
  };
  // keep the guest alive; hold a parry window in parry mode; swing on a rhythm in swing mode
  setInterval(() => {
    if (p.hp < p.maxHp * 0.2) p.hp = p.maxHp;
    const pr = [...net.proxies.values()][0];
    if (pr && (window.__g.parryMode || window.__g.swing)) {
      // face the brigand (block and parry are frontal); step into fist range to swing
      const dx = pr.pos.x - p.pos.x, dz = pr.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      p.yaw = Math.atan2(dx, dz);
      window.__unstable.camYaw = p.yaw;
      if (window.__g.swing && d > 1.7) { const k = Math.min(0.12, d - 1.6) / d; p.pos.x += dx * k; p.pos.z += dz * k; }
    }
    if (window.__g.parryMode) { p.parryT = 0.3; p.parryCd = 0; if (pr && pr.netStunned) window.__g.sawStun = true; }
  }, 16);
  p.setArmed(true);
  setInterval(() => {
    if (!window.__g.swing) return;
    const pr = [...net.proxies.values()][0];
    if (!pr) return;
    window.__unstable.camYaw = Math.atan2(pr.pos.x - p.pos.x, pr.pos.z - p.pos.z);
    window.__unstable.input.mPressed[0] = true;
  }, 450);
});

// 1. both see the same brigand
const netId = await host.page.evaluate(() => {
  const g = window.__unstable;
  const e = g.spawnEnemy('brigand', g.player.pos.clone().set(1340, g.world.groundAt(1340, 146, 400) + 0.1, 146));
  window.__e = e;
  const og = e.getParried.bind(e);
  e.getParried = (by, h) => { og(by, h); window.__h.parried.push({ by: by && by.name, stunned: e.stunned, stunT: +e.stunT.toFixed(2) }); };
  return e.netId;
});
await guest.page.waitForFunction((id) => window.__unstable.net.proxies.has(id), netId, { timeout: 10000 });
await guest.page.waitForTimeout(1500);
const hostE = await host.page.evaluate(() => ({ type: window.__e.type, x: window.__e.pos.x, z: window.__e.pos.z, target: window.__e.target && window.__e.target.name }));
const guestE = await guest.page.evaluate((id) => { const pr = window.__unstable.net.proxies.get(id); return { type: pr.type, x: pr.pos.x, z: pr.pos.z, n: window.__unstable.net.proxies.size }; }, netId);
const gap = Math.hypot(hostE.x - guestE.x, hostE.z - guestE.z);
check('both see the same brigand', guestE.type === 'brigand' && guestE.n === 1 && gap < 1.5, `netId ${netId}; host ${hostE.x.toFixed(1)},${hostE.z.toFixed(1)} vs guest proxy ${guestE.x.toFixed(1)},${guestE.z.toFixed(1)} (${gap.toFixed(2)} m apart); host brigand targets ${hostE.target}`);
if (OUT) {
  await guest.page.screenshot({ path: `${OUT}/lan-guest.png` });
  await host.page.screenshot({ path: `${OUT}/lan-host.png` });
}

// 2. guest hits are resolved by the host
await guest.page.evaluate(() => (window.__g.swing = true));
await guest.page.waitForTimeout(7000);
await guest.page.evaluate(() => (window.__g.swing = false));
const hres = await guest.page.evaluate(() => window.__g.hitRes);
const hhits = await host.page.evaluate(() => window.__h.guestHits);
const landed = hhits.filter((h) => h.hp1 < h.hp0);
check('guest hits are resolved by the host', hhits.length > 0 && hres.length === hhits.length && landed.length > 0,
  `${hhits.length} guest hits reached the host, ${landed.length} took host HP (e.g. ${landed[0] ? `${landed[0].hp0.toFixed(0)} -> ${landed[0].hp1.toFixed(0)}` : '-'}); guest got ${hres.length} results: ${[...new Set(hres.map((r) => r.r))].join(', ')}`);

// 3. enemy hits on the guest resolve on the guest (no parry held)
const before3 = await guest.page.evaluate(() => window.__g.hitYou.length);
await guest.page.waitForTimeout(6000);
const hy = (await guest.page.evaluate(() => window.__g.hitYou)).slice(before3);
const hurt = hy.filter((h) => h.hp1 < h.hp0);
const guestHpNow = await guest.page.evaluate(() => Math.round(window.__unstable.player.hp));
await guest.page.waitForTimeout(250); // one player-state interval and then some
const hostAvatarHp = await host.page.evaluate(() => { const a = [...window.__unstable.net.avatars.values()][0]; return a && [a.hp, a.maxHp]; });
check('enemy hits on the guest resolve on the guest', hurt.length > 0, `${hy.length} host-enemy hits arrived as hitYou, ${hurt.length} cost the guest HP on the guest (e.g. ${hurt[0] ? `${hurt[0].hp0.toFixed(0)} -> ${hurt[0].hp1.toFixed(0)}` : '-'}); guest at ${guestHpNow} HP, host shows its avatar at ${hostAvatarHp && hostAvatarHp.map((v) => Math.round(v)).join('/')} HP`);

// 4. a guest parry staggers the enemy
await guest.page.evaluate(() => (window.__g.parryMode = true));
const before4 = await guest.page.evaluate(() => window.__g.hitYou.length);
await host.page.waitForFunction(() => window.__h.parried.length > 0, null, { timeout: 20000 }).catch(() => {});
await guest.page.waitForTimeout(300);
const parried = await host.page.evaluate(() => window.__h.parried);
const hy4 = (await guest.page.evaluate(() => window.__g.hitYou)).slice(before4);
const proxyStun = await guest.page.evaluate(() => !!window.__g.sawStun);
await guest.page.evaluate(() => (window.__g.parryMode = false));
check('a guest parry staggers the enemy', parried.length > 0 && parried[0].stunned, `guest held a parry window for ${hy4.length} incoming hits (HP unchanged on ${hy4.filter((h) => h.hp1 === h.hp0).length}); host brigand parried by ${parried[0] && parried[0].by}, stunned ${parried[0] && parried[0].stunned} for ${parried[0] && parried[0].stunT} s; the guest's proxy showed the stun: ${proxyStun}`);

// ---------------------------------------------------------------- the systems round's moves on LAN
// fresh foes for each check, spawned by the host beside the guest
const spawnNear = (type, dx, dz) => host.page.evaluate(([type, dx, dz]) => {
  const g = window.__unstable;
  const av = [...g.net.avatars.values()][0];
  const x = av.pos.x + dx;
  const z = av.pos.z + dz;
  const e = g.spawnEnemy(type, av.pos.clone().set(x, g.world.groundAt(x, z, 400) + 0.1, z));
  e.spec = { ...e.spec, defend: { parry: 0, block: 0, dodge: 0 } };
  e.setAggro(av);
  window.__quiet = window.__quiet || new Set();
  window.__quiet.add(e);
  if (!window.__quietHook) {
    window.__quietHook = setInterval(() => { for (const q of window.__quiet) if (!q.dead) q.ai.atkCd = 99; }, 16);
  }
  return e.netId;
}, [type, dx, dz]);
await host.page.evaluate(() => { for (const a of G.actors) if (a.team === 'enemy') a.despawn = true; });
await guest.page.evaluate(() => { window.__g.swing = false; window.__g.parryMode = false; const p = window.__unstable.player; p.hp = p.maxHp; });
await guest.page.waitForTimeout(800);

// 6. a guest's uppercut lifts the host's brigand, and the host's word opens the guest's air chase
const upId = await spawnNear('brigand', 0, 2.2);
await guest.page.waitForFunction((id) => window.__unstable.net.proxies.has(id), upId, { timeout: 10000 });
await guest.page.waitForTimeout(600);
await host.page.evaluate((id) => {
  const e = window.__unstable.net.enemyById(id);
  window.__up = { peak: 0, y0: e.pos.y, launched: false };
  const iv = setInterval(() => { window.__up.peak = Math.max(window.__up.peak, e.pos.y - window.__up.y0); window.__up.launched ||= !!e.launched; }, 16);
  setTimeout(() => clearInterval(iv), 4000);
}, upId);
const up = await guest.page.evaluate(async (id) => {
  const g = window.__unstable, p = g.player, pr = g.net.proxies.get(id);
  const face = () => { g.camYaw = p.yaw = Math.atan2(pr.pos.x - p.pos.x, pr.pos.z - p.pos.z); };
  face();
  // a slide straight at it, then LMB
  p.slideT = 0.5;
  p.slideDir = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  g.input.mPressed[0] = true;
  const upper = await new Promise((res) => setTimeout(() => res(!!(p.atk && p.atk.def.upper)), 60));
  const chase = await new Promise((res) => {
    const t0 = performance.now();
    const iv = setInterval(() => { if (p.chaseTarget === pr || performance.now() - t0 > 2500) { clearInterval(iv); res(p.chaseTarget === pr); } }, 16);
  });
  let peak = 0;
  const y0 = pr.pos.y;
  await new Promise((res) => { const t0 = performance.now(); const iv = setInterval(() => { peak = Math.max(peak, pr.pos.y - y0); if (performance.now() - t0 > 1500) { clearInterval(iv); res(); } }, 16); });
  return { upper, chase, proxyPeak: peak };
}, upId);
const upHost = await host.page.evaluate(() => window.__up);
check('a guest uppercut lifts the host\'s brigand and opens the guest\'s air chase', up.upper && upHost.launched && upHost.peak > 1 && up.chase && up.proxyPeak > 0.8,
  `uppercut ${up.upper}; on the host launched ${upHost.launched}, rose ${upHost.peak.toFixed(2)} m; the guest saw its proxy rise ${up.proxyPeak.toFixed(2)} m; air chase open on the guest ${up.chase}`);

// 7. a guest flourish holds the host's replay of its swing; letting go releases it
await host.page.evaluate(() => {
  const av = [...window.__unstable.net.avatars.values()][0];
  window.__fl = { held: 0, released: false };
  const iv = setInterval(() => {
    if (av.atk && av.atk.holding) window.__fl.held += 16;
    if (window.__fl.held > 0 && av.atk && av.atk.phase === 'active') window.__fl.released = true;
  }, 16);
  setTimeout(() => clearInterval(iv), 4000);
});
await guest.page.evaluate(async () => {
  const g = window.__unstable, p = g.player;
  p.cancelAttack();
  p.combo = 0;
  g.input.mPressed[0] = true;
  g.input.mDown[0] = true;
  await new Promise((r) => setTimeout(r, 500));
  g.input.mDown[0] = false;
});
await host.page.waitForTimeout(1200);
const fl = await host.page.evaluate(() => window.__fl);
check('a guest flourish holds on the host\'s avatar and releases with it', fl.held >= 100 && fl.released, `the host's avatar held the swing ~${fl.held} ms, then struck: ${fl.released}`);

// 8. a weapon trait resolved by the host: a guest with the Hollowed Crownblade blinds with a critical
await guest.page.evaluate(() => {
  const p = window.__unstable.player;
  window.__before8 = { weapon: p.ch.equipped.weapon, medium: p.ch.attrs.medium };
  p.ch.inventory.weapons.push({ uid: 'lan-crown', id: 'hollow_crown' });
  p.ch.attrs.medium = 40;
  p.equipWeapon('lan-crown');
});
await guest.page.waitForTimeout(400); // the new weapon's info reaches the host
const blindId = await spawnNear('brigand', 0, 2.4);
await guest.page.waitForFunction((id) => window.__unstable.net.proxies.has(id), blindId, { timeout: 10000 });
await guest.page.waitForTimeout(500);
const blind = await guest.page.evaluate(async (id) => {
  const g = window.__unstable, p = g.player, pr = g.net.proxies.get(id);
  p.cancelAttack();
  g.camYaw = p.yaw = Math.atan2(pr.pos.x - p.pos.x, pr.pos.z - p.pos.z);
  p.critCd = 0;
  g.input.pressed.add('KeyR');
  let seen = false;
  await new Promise((res) => { const t0 = performance.now(); const iv = setInterval(() => { seen ||= !!pr.statuses.blind; if (seen || performance.now() - t0 > 3000) { clearInterval(iv); res(); } }, 16); });
  return seen;
}, blindId);
const blindHost = await host.page.evaluate((id) => !!(window.__unstable.net.enemyById(id) || {}).statuses?.blind || window.__lastBlind, blindId);
// the guest puts the Crownblade away again, so the checks after this one see its own kit
await guest.page.evaluate(() => {
  const p = window.__unstable.player;
  p.cancelAttack();
  p.equipWeapon(window.__before8.weapon || null);
  p.ch.inventory.weapons = p.ch.inventory.weapons.filter((w) => w.uid !== 'lan-crown');
  p.ch.attrs.medium = window.__before8.medium;
  p.recompute();
});
check('a weapon trait on a guest\'s blow is resolved by the host', blind, `the guest's critical with the Hollowed Crownblade blinded the host's brigand; the guest's proxy shows it blind: ${blind} (host now: ${blindHost})`);

// 9. a host Bonesetter mends its side; the guest sees the cast and the health come back.
// The guest's critical from check 8 (a katana's lunge) must be over first, or it knocks the hurt one.
await guest.page.evaluate(async () => {
  const p = window.__unstable.player;
  for (let i = 0; i < 60 && p.atk; i++) await new Promise((r) => setTimeout(r, 50));
  p.cancelAttack();
});
await guest.page.waitForTimeout(300);
const hurtId = await spawnNear('brigand', 3, 6);
const boneId = await spawnNear('redwake_bonesetter', -3, 9);
await host.page.evaluate(([hurt, bone]) => {
  const g = window.__unstable;
  const h = g.net.enemyById(hurt);
  h.hp = h.maxHp * 0.3;
  const b = g.net.enemyById(bone);
  window.__quiet.delete(b); // the bonesetter acts, from now (the quiet hook may already have held it off)
  b.ai.atkCd = 0;
  window.__hurt = { log: [] };
  const who = (a) => a && (a.name || a.type || a.team || 'something');
  const lethal = h.onLethal.bind(h);
  h.onLethal = (src) => {
    window.__hurt.died = { by: who(src), last: who(h.lastAttacker), y: +h.pos.y.toFixed(1), ground: +g.world.groundAt(h.pos.x, h.pos.z, 400).toFixed(1), fled: !!h.ai.fled, statuses: Object.keys(h.statuses) };
    lethal(src);
  };
  let last = h.hp;
  const iv = setInterval(() => {
    if (h.hp !== last) window.__hurt.log.push(`${Math.round(last)}->${Math.round(h.hp)}${h.hp < last && h.lastAttacker ? ` (${who(h.lastAttacker)})` : ''}${h.ai.fled ? ' fled' : ''}`);
    last = h.hp;
  }, 50);
  setTimeout(() => clearInterval(iv), 10000);
}, [hurtId, boneId]);
await guest.page.waitForFunction(([a, b]) => window.__unstable.net.proxies.has(a) && window.__unstable.net.proxies.has(b), [hurtId, boneId], { timeout: 10000 });
const mend = await guest.page.evaluate(async ([hurt, bone]) => {
  const g = window.__unstable, h = g.net.proxies.get(hurt), b = g.net.proxies.get(bone);
  const hp0 = h.hp;
  let cast = false;
  await new Promise((res) => { const t0 = performance.now(); const iv = setInterval(() => { cast ||= !!(b.atk && b.atk.def.netKey && b.atk.def.netKey[0] === 'sup'); if ((cast && h.hp > hp0 + 5) || performance.now() - t0 > 9000) { clearInterval(iv); res(); } }, 16); });
  return { cast, hp0, hp1: h.hp };
}, [hurtId, boneId]);
const hurtHost = await host.page.evaluate(() => window.__hurt);
check('a host Bonesetter\'s mending shows on the guest', mend.cast && mend.hp1 > mend.hp0 + 5, `the guest's proxy cast: ${mend.cast}; the brigand's health on the guest ${Math.round(mend.hp0)} -> ${Math.round(mend.hp1)}${hurtHost.log.length ? `; on the host ${hurtHost.log.join(', ')}` : ''}${hurtHost.died ? `; died ${JSON.stringify(hurtHost.died)}` : ''}`);

// 10. a guest's roll cut short reaches the host's avatar
await host.page.evaluate(() => {
  const av = [...window.__unstable.net.avatars.values()][0];
  window.__rx = { rolled: false, cut: false };
  const iv = setInterval(() => {
    const r = av.model.anim.roll;
    if (r) window.__rx.rolled = true;
    if (window.__rx.rolled && !r && window.__rx.at && performance.now() - window.__rx.at < 300) window.__rx.cut = true;
  }, 8);
  setTimeout(() => clearInterval(iv), 3000);
});
await guest.page.evaluate(async () => {
  const g = window.__unstable, p = g.player;
  p.cancelAttack();
  p.dodgeCd = 0;
  g.input.down.add('KeyW');
  g.input.pressed.add('KeyQ');
  await new Promise((r) => setTimeout(r, 80));
  g.input.pressed.add('KeyF');
  g.input.down.delete('KeyW');
});
await host.page.evaluate(() => (window.__rx.at = performance.now()));
await host.page.waitForTimeout(600);
const rx = await host.page.evaluate(() => window.__rx);
check('a guest roll-cancel reaches the host\'s avatar', rx.rolled && rx.cut, `the avatar rolled ${rx.rolled}; its roll was cut short ${rx.cut}`);

// 11. an enemy's flourish on the host holds its replay on the guest
const flId = await spawnNear('brigand', 0, 2.6);
await guest.page.waitForFunction((id) => window.__unstable.net.proxies.has(id), flId, { timeout: 10000 });
await guest.page.evaluate((id) => {
  const pr = window.__unstable.net.proxies.get(id);
  window.__efl = { held: 0 };
  const iv = setInterval(() => { if (pr.atk && pr.atk.holding) window.__efl.held += 16; }, 16);
  setTimeout(() => clearInterval(iv), 3000);
}, flId);
await host.page.evaluate((id) => {
  const e = window.__unstable.net.enemyById(id);
  window.__quiet.delete(e);
  // its next M1 flourishes: the feint roll comes before the flourish roll, so rule it out
  e.spec = { ...e.spec, feintChance: 0, flourishChance: 1 };
  e.ai.atkCd = 0;
  window.__hfl = { held: 0 };
  const iv = setInterval(() => { if (e.atk && e.atk.holding) window.__hfl.held += 16; }, 16);
  setTimeout(() => clearInterval(iv), 3000);
}, flId);
await guest.page.waitForTimeout(2500);
const efl = await guest.page.evaluate(() => window.__efl);
const hfl = await host.page.evaluate(() => window.__hfl);
check('an enemy flourish on the host holds its swing on the guest', hfl.held >= 80 && efl.held >= 80, `the host's brigand held its swing ~${hfl.held} ms; the guest's proxy held it ~${efl.held} ms`);
await host.page.evaluate(() => { for (const a of G.actors) if (a.team === 'enemy') a.despawn = true; });

// 5. the guest's death loop, while connected: its own machine decides it
await guest.page.evaluate(() => {
  window.__defs = window.__unstable.spawners.map((s) => s.def);
  for (const s of window.__unstable.spawners) s.def = Object.assign({}, s.def, { count: 0 });
});
await host.page.evaluate(() => { if (window.__e && !window.__e.dead) window.__e.despawn = true; });
await guest.page.evaluate(() => window.__unstable.onPlayerDeath({ name: 'a test' }));
await guest.page.waitForFunction(() => window.__unstable.inRift && !window.__unstable.transitioning, null, { timeout: 15000 });
await guest.page.waitForTimeout(1200);
const rift = await guest.page.evaluate(() => ({ hp: window.__unstable.player.hp, max: window.__unstable.player.maxHp, lives: window.__unstable.ch.lives, net: window.__unstable.net.status }));
await host.page.waitForTimeout(600);
const seen = await host.page.evaluate(() => { const a = [...window.__unstable.net.avatars.values()][0]; return a && a.netPos ? a.netPos.x : a && a.pos.x; });
check("a guest's surface death wakes it in the Rift, whole, still connected", rift.hp === rift.max && rift.lives === 3 && rift.net === 'online' && seen > 3000, `HP ${Math.round(rift.hp)}/${Math.round(rift.max)}, lives ${rift.lives}, ${rift.net}; the host sees its avatar at x ${Math.round(seen)}`);
await guest.page.evaluate(() => window.__unstable.giveWeapon('bronze_sword'));
const hostLegacy0 = await host.page.evaluate(() => localStorage.getItem('unstable.legacy.v1'));
await guest.page.evaluate(() => window.__unstable.onPlayerDeath({ name: 'a drowned knight' }));
await guest.page.waitForSelector('#wipe .panel', { timeout: 15000 });
const wiped = await guest.page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem('unstable.legacy.v1') || '{}');
  return { lost: (l.lost || []).map((e) => e.name), cause: (l.lost || [])[0] && l.lost[0].cause, net: window.__unstable.net.status, pending: !!l.pending };
});
await host.page.waitForFunction(() => window.__unstable.net.avatars.size === 0, null, { timeout: 15000 }).catch(() => {});
const hostAfter = await host.page.evaluate(() => ({ avatars: window.__unstable.net.avatars.size, legacy: localStorage.getItem('unstable.legacy.v1') }));
const s2gone = await slotSave(guest.page, 2);
const s1kept = await slotSave(guest.page, 1);
check("a death in the Rift ends the guest: its slot into its own register; the host is untouched", wiped.lost.join() === 'Guest' && /drowned knight/.test(wiped.cause) && wiped.pending && !s2gone && s1kept && s1kept.name === 'Stay Home' && hostAfter.avatars === 0 && hostAfter.legacy === hostLegacy0,
  `guest register [${wiped.lost.join(', ')}] (${wiped.cause}), heirloom to choose ${wiped.pending}, slot 2 ${s2gone ? 'still there' : 'emptied'}, slot 1 ${s1kept && s1kept.name}, guest ${wiped.net}; host avatars ${hostAfter.avatars}, host legacy ${hostAfter.legacy === hostLegacy0 ? 'unchanged' : 'CHANGED'}`);
await guest.page.click('#wipe [data-pick="0"]');
await guest.page.click('#wipe [data-a="ok"]');
await joinFromMenu(guest.page, 2, 'Second Guest');
await host.page.waitForFunction(() => window.__unstable.net.avatars.size === 1, null, { timeout: 15000 }).catch(() => {});
const rejoin = await host.page.evaluate(() => [...window.__unstable.net.avatars.values()].map((a) => a.name));
const heir = await guest.page.evaluate(() => JSON.parse(localStorage.getItem('unstable.legacy.v1') || '{}').heirloom);
check('a new character in the emptied slot rejoins, with an heirloom waiting', rejoin.includes('Second Guest') && heir && heir.id === 'bronze_sword', `host sees [${rejoin.join(', ')}]; heirloom ${heir && heir.id} from ${heir && heir.from}`);
await place(guest.page, 1340, 136);

// a pouch is shared: the guest leaves one, the host takes from it, the guest takes the rest
await guest.page.evaluate(() => {
  const g = window.__unstable;
  g.ch.inventory.items.bread = 4;
  g.ui.openCharMenu('inventory');
});
await guest.page.click('#charmenu [data-a="pouch"]');
await guest.page.click('#droppouch [data-more="item:bread"]');
await guest.page.click('#droppouch [data-more="item:bread"]');
await guest.page.click('#droppouch [data-leave]');
// (the first guest's surface death has already left its lost pouch in the host's world)
const hostSees = await host.page.waitForFunction(() => (window.__unstable.ch.pouches || []).some((p) => p.by === 'Second Guest'), null, { timeout: 10000 }).then(() => true, () => false);
const hp = await host.page.evaluate(() => {
  const g = window.__unstable;
  const pouch = g.ch.pouches.find((p) => p.by === 'Second Guest');
  const it = pouch && g.world.interactables.find((x) => x.id === `pouch_${pouch.id}`);
  const lost = g.ch.pouches.find((p) => p.by === 'Guest' && p.kind === 'lost');
  return { id: pouch && pouch.id, by: pouch && pouch.by, bread: pouch && pouch.contents.items.bread, label: it && it.label, lost: lost ? `${lost.contents.silver} silver, ${Object.keys(lost.contents.items).length} goods` : 'none' };
});
await host.page.evaluate((id) => {
  const g = window.__unstable;
  const it = g.world.interactables.find((x) => x.id === `pouch_${id}`);
  if (it) g.interact(it);
}, hp.id);
const hostPanel = await host.page.waitForSelector('#loot [data-take="item:bread"][data-n="1"]', { timeout: 5000 }).then(() => 'open', () => 'not open');
if (OUT) await host.page.screenshot({ path: `${OUT}/lan-host-pouch.png` });
await host.page.click('#loot [data-take="item:bread"][data-n="1"]', { timeout: 2000 }).catch(() => {});
await host.page.waitForTimeout(300);
await host.page.evaluate(() => window.__unstable.ui.closeAll(true));
const hostGot = await host.page.evaluate(() => window.__unstable.ch.inventory.items.bread || 0);
await guest.page.waitForTimeout(600);
await guest.page.evaluate((id) => {
  const g = window.__unstable;
  const it = g.world.interactables.find((x) => x.id === `pouch_${id}`);
  if (it) g.interact(it);
}, hp.id);
const guestSeesOne = await guest.page.waitForSelector('#loot .loot-row', { timeout: 5000 }).then(() => guest.page.evaluate(() => document.querySelector('#loot .loot-row').textContent), () => '');
if (OUT) await guest.page.screenshot({ path: `${OUT}/lan-guest-pouch.png` });
const guestBread0 = await guest.page.evaluate(() => window.__unstable.ch.inventory.items.bread || 0);
await guest.page.click('#loot [data-take-all]').catch(() => {});
await guest.page.waitForTimeout(800);
const end = {
  guestBread: await guest.page.evaluate(() => window.__unstable.ch.inventory.items.bread || 0),
  hostPouch: await host.page.evaluate((id) => (window.__unstable.ch.pouches || []).some((p) => p.id === id), hp.id),
  hostIt: await host.page.evaluate((id) => window.__unstable.world.interactables.some((x) => x.id === `pouch_${id}`), hp.id),
  guestIt: await guest.page.evaluate((id) => window.__unstable.world.interactables.some((x) => x.id === `pouch_${id}`), hp.id),
};
check("a pouch is shared: the guest leaves it, the host takes from it, the guest takes the rest, it's gone for both",
  hostSees && hp.bread === 2 && /Second Guest's pouch/.test(hp.label || '') && hostPanel === 'open' && hostGot >= 1 && /Bread/.test(guestSeesOne) && /×1|Bread/.test(guestSeesOne) && end.guestBread === guestBread0 + 1 && !end.hostPouch && !end.hostIt && !end.guestIt,
  `host saw ${hp.by}'s pouch with ${hp.bread} bread ("${hp.label}", panel ${hostPanel}), took 1 (now ${hostGot}); the guest saw "${guestSeesOne.trim().replace(/\s+/g, ' ').slice(0, 30)}", took the rest (${guestBread0} → ${end.guestBread}); still there: host ${end.hostPouch || end.hostIt}, guest ${end.guestIt}; the first guest's lost pouch in the host's world: ${hp.lost}`);
await guest.page.evaluate(() => window.__unstable.spawners.forEach((s, i) => (s.def = window.__defs[i])));

// 6. the host leaves: the guest keeps playing alone
await host.ctx.close();
await guest.page.waitForFunction(() => window.__unstable.net.status === 'offline', null, { timeout: 15000 }).catch(() => {});
const after = await guest.page.evaluate(() => ({ status: window.__unstable.net.status, state: window.__unstable.state, proxies: window.__unstable.net.proxies.size, netProxies: G.actors.filter((a) => a.netProxy).length, avatars: window.__unstable.net.avatars.size }));
await guest.page.waitForTimeout(6000);
const local = await guest.page.evaluate(() => {
  const p = window.__unstable.player;
  const near = G.actors.filter((a) => a.team === 'enemy' && !a.netProxy && !a.dead && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 150);
  return { local: near.length, types: [...new Set(near.map((a) => a.type))], playing: window.__unstable.state, hp: Math.round(p.hp) };
});
check('host disconnect leaves the guest playing alone', after.status === 'offline' && after.proxies === 0 && after.netProxies === 0 && after.avatars === 0 && local.playing === 'playing' && local.local > 0,
  `guest net ${after.status}, state ${after.state}, proxies ${after.proxies}, avatars ${after.avatars}; 6 s later its own spawners have woken ${local.local} local enemies (${local.types.join(', ')}), still ${local.playing}`);
if (OUT) await guest.page.screenshot({ path: `${OUT}/lan-guest-alone.png` });

console.log('host console errors', host.errors.length, host.errors.slice(0, 5));
console.log('guest console errors', guest.errors.length, guest.errors.slice(0, 5));
await browser.close();
process.exit(results.every((r) => r.ok) && !host.errors.length && !guest.errors.length ? 0 : 1);
