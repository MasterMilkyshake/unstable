// Long-session soak (docs/agent/QA_AND_BENCHMARKS.md): scripted play in one fresh browser,
// sampled every few minutes.
//   SOAK_URL=http://localhost:5173/ node tools/long-session.mjs [minutes] [sample minutes] [out.json]
// Vsync on (hitches are judged at the display's pace), 1600x900, quality high, and the sky left
// to run its 15-minute day, so two hours see eight nights. A bot plays in a loop, with real input
// (held keys, mouse presses, hotbar keys): it wanders between the Wash's and Saltreach's people,
// fights at a surface camp, sails a rented boat from one dock towards another, enters the Rift
// and fights there, then climbs out. It keeps the character alive (tops up HP below 40%, and
// sanity and ether), so a death never ends the run.
// Every sample: JS heap (used; after a forced GC as performance.memory and as V8's own used size),
// DOM nodes and listeners, frame-time
// percentiles and the frames over 50 ms since the last sample (with what the bot was doing then),
// actors, projectiles, boats, live particles and effects, GPU geometries, textures and programs,
// the load average, and console errors. The series is rewritten after every sample, so a crash
// keeps what came before.
// To tell a leak from a cache that fills (Q-02), three switches, each off by default:
//   SOAK_REGION=home    stay in the Wash and Saltreach: wander and fight at the camps nearby, no
//                       sailing and no Rift, so the navigation grid's tile cache stops growing
//   SOAK_CLEAR_NAV=1    empty that cache at every sample, between two forced GCs: the difference
//                       is the memory the tiles held
//   SOAK_HEAP_PROFILE=1 sample allocations (CDP HeapProfiler) from the first sample on, and record
//                       at each sample the allocation sites and files holding the most live memory
// For pacing (with SOAK_REGION=home): SOAK_FRESH=1 plays a new Power 1 character with the Bronze
// Sword instead of the Power 12 one, invests each point as it is earned, and records Power, the XP
// given and how often the bot had to top its health up. The bot is carried to each camp, so this
// is an upper bound on early XP per minute, not a player's pace.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';

const URL = process.env.SOAK_URL || 'http://localhost:5173/';
const minutes = Number(process.argv[2] || 120);
const every = Number(process.argv[3] || 5);
const OUT = process.argv[4] || `long-session-${new Date().toISOString().slice(0, 10)}.json`;
const phaseScale = Number(process.env.SOAK_PHASE_SCALE || 1); // < 1 to try the bot quickly
const region = process.env.SOAK_REGION || '';
const clearNav = process.env.SOAK_CLEAR_NAV === '1';
const heapProfile = process.env.SOAK_HEAP_PROFILE === '1';
const fresh = process.env.SOAK_FRESH === '1';
let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push({ at: Date.now(), msg: 'pageerror: ' + e.message }));
page.on('console', (m) => m.type() === 'error' && errors.push({ at: Date.now(), msg: m.text() }));
page.on('crash', () => errors.push({ at: Date.now(), msg: 'page crashed' }));
// the game reloads itself after a lost WebGL context (game.js): record it, since the bot's state goes with it
let booted = false;
page.on('framenavigated', (f) => booted && f === page.mainFrame() && errors.push({ at: Date.now(), msg: `page navigated (reloaded): ${f.url()}` }));
const cdp = await page.context().newCDPSession(page);

const out = {
  tool: 'tools/long-session.mjs', commit, url: URL, chrome: browser.version(), started: new Date().toISOString(),
  minutes, sampleMinutes: every, viewport: '1600x900', vsync: true, region, clearNav, heapProfile, fresh, samples: [], hitches: [], events: [], errors,
};
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 1));

const t0 = Date.now();
await page.goto(URL, { timeout: 180000 });
await page.waitForFunction(() => window.__unstable && window.__unstable.world, null, { timeout: 180000 });
out.bootS = (Date.now() - t0) / 1000;
booted = true;

await page.evaluate(async ({ phaseScale, region, fresh }) => {
  const g = window.__unstable;
  const { RACES } = await import('/src/data/races.js');
  const { G } = await import('/src/core/globals.js');
  const { findSeaPath } = await import('/src/game/travel.js');
  const { FERRY_ROUTES } = await import('/src/data/world.js');
  const { angleDiff } = await import('/src/core/util.js');
  const I = g.input;

  const S = (window.__soak = { phase: 'start', cycle: 0, simT: 0, phaseT: 0, frames: [], hitches: [], events: [], pause: false, skip: 0, kills: 0, killTypes: {}, casts: 0, sailedM: 0, xp: 0, topUps: 0 });
  const note = (what) => S.events.push({ t: +(performance.now() / 1000).toFixed(1), simT: +S.simT.toFixed(1), phase: S.phase, what });

  function newCharacter() {
    const ch = g.createCharacter({ name: 'Soak', race: RACES[0].id, look: {} });
    if (fresh) {
      // a new character's first hours: Power 1, the Bronze Sword the first quest gives, no mantras
      ch.armed = true;
      g.startGame(ch, false);
      g.giveWeapon('bronze_sword');
      g.player.equipWeapon(g.ch.inventory.weapons.at(-1).uid);
      return;
    }
    ch.level = 12;
    ch.silver = 500;
    ch.armed = true;
    for (const id of ['ember_bolt', 'frost_shards', 'gale_palm', 'flare_leap']) ch.mantras[id] = { stars: 0 };
    Object.assign(ch.attrs, { strength: 20, fortitude: 20, agility: 15, ember: 15, rime: 15, gale: 15 });
    g.startGame(ch, false);
    const p = g.player;
    g.giveWeapon('steel_longsword');
    p.equipWeapon(g.ch.inventory.weapons.at(-1).uid);
    ['ember_bolt', 'frost_shards', 'gale_palm'].forEach((id, i) => (g.ch.hotbar[i + 1] = { type: 'mantra', id }));
    p.recompute();
  }
  newCharacter();

  // Surface places: the people of the Wash and Saltreach; camps above the sea and out of the Rift.
  const surface = (x, z) => !g.world.inRift(x) && g.world.terrain.heightAt(x, z) > 0.5;
  const people = g.npcs.map((n) => [n.pos.x, n.pos.z]).filter(([x, z]) => surface(x, z) && Math.hypot(x, z + 150) < 450);
  // dry camps only: a swimming player cannot swing (mudlurkers and bog lurkers keep to the shallows)
  const camps = g.spawners.filter((s) => !s.def.boss && !s.rift && !/lurker/.test(s.def.type) && g.world.terrain.heightAt(s.def.x, s.def.z) > 2 &&
    surface(s.def.x, s.def.z) && g.world.groundAt(s.def.x, s.def.z, 400) < 120 && (region !== 'home' || Math.hypot(s.def.x, s.def.z + 150) < 900));
  S.camps = camps.length;
  const docks = FERRY_ROUTES.map((r) => r.id).filter((id) => g.world.docks[id]);
  const RIFT = { x: 6000, z: 5830 };
  let campI = 0;
  // A Rift walk the bot can make without falling into the Abyss: a goal within 40 m of the
  // spawn, with ground no more than 6 m below the start every 2 m along the line to it.
  const riftGoal = (p) => {
    const y0 = g.world.groundAt(RIFT.x, RIFT.z, 400);
    for (let i = 0; i < 30; i++) {
      const x = RIFT.x + (Math.random() - 0.5) * 80;
      const z = RIFT.z + (Math.random() - 0.5) * 80;
      const n = Math.ceil(Math.hypot(x - p.pos.x, z - p.pos.z) / 2);
      let ok = true;
      for (let k = 1; k <= n && ok; k++) ok = g.world.groundAt(p.pos.x + ((x - p.pos.x) * k) / n, p.pos.z + ((z - p.pos.z) * k) / n, p.pos.y + 4) > y0 - 6;
      if (ok) return [x, z];
    }
    return [RIFT.x, RIFT.z];
  };
  let dockI = 0;

  const place = (x, z, y) => {
    S.placedAt = performance.now(); // a hitch just after the bot's own teleport is the bot's, not play's
    const p = g.player;
    p.pos.set(x, g.world.groundAt(x, z, y ?? 400) + 0.2, z);
    p.vel.set(0, 0, 0);
    p.fallStart = p.pos.y;
  };
  const release = () => {
    for (const k of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft']) I.down.delete(k);
  };
  const face = (x, z) => {
    const p = g.player;
    g.camYaw = Math.atan2(x - p.pos.x, z - p.pos.z);
  };
  const nearestFoe = (r) => {
    const p = g.player;
    let best = null;
    let bd = r;
    for (const a of G.actors) {
      if (a.dead || a.knocked || a.team !== 'enemy' || a.illusion || a.dummy || a.type === 'training_dummy') continue;
      const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
      if (d < bd && Math.abs(a.pos.y - p.pos.y) < 15) {
        bd = d;
        best = a;
      }
    }
    return best;
  };

  // walking: toward a goal, jumping when blocked, teleporting there if still stuck
  const walker = { goal: null, last: null, stuckT: 0, checkT: 0 };
  function walk(dt, gx, gz, sprint = true) {
    const p = g.player;
    if (!walker.goal || walker.goal[0] !== gx || walker.goal[1] !== gz) {
      walker.goal = [gx, gz];
      walker.last = p.pos.clone();
      walker.stuckT = 0;
      walker.checkT = 0;
    }
    face(gx, gz);
    I.down.add('KeyW');
    if (sprint) I.down.add('ShiftLeft');
    else I.down.delete('ShiftLeft');
    walker.checkT += dt;
    if (walker.checkT > 2) {
      walker.checkT = 0;
      if (p.pos.distanceTo(walker.last) < 1) {
        walker.stuckT += 2;
        I.pressed.add('Space');
      } else walker.stuckT = 0;
      walker.last.copy(p.pos);
      if (walker.stuckT >= 8) {
        place(gx, gz, p.pos.y + 30);
        walker.stuckT = 0;
        note('unstuck: teleported to its goal');
      }
    }
    return Math.hypot(gx - p.pos.x, gz - p.pos.z);
  }

  // fighting: close in, swing, now and then cast; a foe the bot cannot reach in 6 s is
  // reached by teleport (a ledge or a pool the bot has no route to)
  let castT = 0;
  const chase = { foe: null, best: Infinity, t: 0 };
  function fight(dt, foe) {
    const p = g.player;
    const d = Math.hypot(foe.pos.x - p.pos.x, foe.pos.z - p.pos.z);
    face(foe.pos.x, foe.pos.z);
    castT -= dt;
    if (chase.foe !== foe) Object.assign(chase, { foe, best: d, t: 0 });
    if (d < chase.best - 0.5 || d <= 2.2) Object.assign(chase, { best: d, t: 0 });
    else if ((chase.t += dt) > 6) {
      place(foe.pos.x - 2 * Math.sin(g.camYaw), foe.pos.z - 2 * Math.cos(g.camYaw), foe.pos.y + 2);
      Object.assign(chase, { best: 2, t: 0 });
      note(`could not reach ${foe.type}: teleported beside it`);
    }
    if (d > 2.2) {
      I.down.add('KeyW');
      I.down[d > 8 ? 'add' : 'delete']('ShiftLeft');
      if (d < 18 && castT <= 0 && !p.atk) {
        I.pressed.add(['Digit2', 'Digit3', 'Digit4'][S.casts++ % 3]);
        castT = 4;
      }
    } else {
      release();
      if (!p.atk) I.mPressed[0] = true;
    }
  }

  // sailing: rent at one dock, steer for the next along a sea path
  const sail = { boat: null, path: null, i: 1, slowT: 0, from: null, to: null };
  function startSail() {
    const fromId = docks[dockI % docks.length];
    const toId = docks[(dockI + 1) % docks.length];
    dockI++;
    const dock = g.world.docks[fromId];
    place(dock.end.x, dock.end.z, dock.end.y + 3);
    g.ch.silver = Math.max(g.ch.silver, 100);
    g.rentBoat(fromId);
    const b = g.boats.filter((x) => !x.netProxy).at(-1);
    g.player.enterBoat(b);
    const path = findSeaPath(b.pos, g.world.docks[toId].end);
    Object.assign(sail, { boat: b, path, i: 1, slowT: 0, from: fromId, to: toId, lastPos: b.pos.clone() });
    note(`sail ${fromId} -> ${toId} (${path ? path.length : 0} waypoints)`);
  }
  function steer(dt) {
    const b = sail.boat;
    if (!b || !sail.path || g.player.boat !== b) return;
    const w = sail.path[Math.min(sail.i, sail.path.length - 1)];
    const dx = w.x - b.pos.x;
    const dz = w.z - b.pos.z;
    if (Math.hypot(dx, dz) < 14 && sail.i < sail.path.length - 1) sail.i++;
    const err = angleDiff(b.yaw, Math.atan2(dx, dz));
    I.down.add('KeyW');
    I.down.delete('KeyA');
    I.down.delete('KeyD');
    if (err > 0.12) I.down.add('KeyA');
    else if (err < -0.12) I.down.add('KeyD');
    sail.sailedM = (sail.sailedM || 0) + b.pos.distanceTo(sail.lastPos);
    sail.lastPos.copy(b.pos);
    if (Math.abs(b.speed) < 1) sail.slowT += dt;
    else sail.slowT = 0;
    if (sail.slowT > 6) {
      sail.slowT = 0;
      b.yaw += Math.PI * 0.4;
      const p = findSeaPath(b.pos, g.world.docks[sail.to].end);
      if (p) Object.assign(sail, { path: p, i: 1 });
      note('boat wedged: turned and re-planned');
    }
  }
  function endSail() {
    release();
    const p = g.player;
    if (p.boat) p.leaveBoat();
    S.sailedM += sail.sailedM || 0;
    sail.sailedM = 0;
    const r = FERRY_ROUTES.find((f) => f.id === sail.to);
    if (r) place(r.spawn.x, r.spawn.z);
    note(`left the boat after ${Math.round(S.sailedM)} m sailed in all`);
  }

  // phases of one cycle, in simulation seconds
  const PLAN = (region === 'home' ? [['wander', 150], ['fight', 180]] : [['wander', 150], ['fight', 180], ['sail', 180], ['rift', 180]]).map(([n, s]) => [n, s * phaseScale]);
  let pi = -1;
  let goal = null;
  let idleT = 0;
  function enter(name) {
    S.phase = name;
    S.phaseT = 0;
    goal = null;
    idleT = 0;
    release();
    if (name === 'wander') {
      const [x, z] = people[(S.cycle * 3) % people.length];
      place(x + 4, z + 4);
    } else if (name === 'fight') {
      const s = camps[campI++ % camps.length];
      place(s.def.x + 22, s.def.z);
      note(`camp ${s.def.type} at ${Math.round(s.def.x)}, ${Math.round(s.def.z)}`);
    } else if (name === 'sail') startSail();
    else if (name === 'rift') g.enterRift(false);
    note('phase ' + name);
  }
  function leave(name) {
    if (name === 'sail') endSail();
    if (name === 'rift' && g.inRift) g.exitRift(false);
  }

  // The bot acts before each step: the frame swallows key and mouse edges after its first
  // step, so a press made after the player's update would never be read.
  const update = g.updatePlaying.bind(g);
  g.updatePlaying = (dt) => {
    bot(dt);
    update(dt);
    const p = g.player;
    if (p && !p.dead && !p.knocked && p.hp < p.maxHp * 0.4) {
      p.hp = p.maxHp;
      S.topUps++;
    }
    // SOAK_FRESH: invest each point as it comes (Strength, Fortitude, Agility in turn), so Power rises.
    // Investing needs rest (Player.resting): the bot sits for the moment it takes, wherever it is.
    if (fresh && p && g.ch.points > 0 && !p.inDanger) {
      const sat = p.sitting;
      p.sitting = true;
      p.invest({ [['strength', 'fortitude', 'agility'][S.invested++ % 3]]: 1 });
      p.sitting = sat;
    }
  };
  S.invested = 0;
  // XP as the character is given it (kills, quests, discoveries), before its multiplier
  const addXp = g.player.addXp.bind(g.player);
  g.player.addXp = (n) => {
    S.xp += n;
    return addXp(n);
  };
  function bot(dt) {
    const p = g.player;
    if (!p || g.state !== 'playing') return;
    S.simT += dt;
    S.phaseT += dt;
    if (p.hp < p.maxHp * 0.4 && !p.dead) {
      p.hp = p.maxHp;
      S.topUps++;
    }
    if (p.knocked || p.dead) return;
    p.ether = p.maxEther;
    g.ch.sanity = p.maxSanity;
    if (g.transitioning) return release();
    if (pi < 0 || S.phaseT > PLAN[pi][1]) {
      if (pi >= 0) leave(PLAN[pi][0]);
      pi = (pi + 1) % PLAN.length;
      if (pi === 0 && S.simT > 1) S.cycle++;
      enter(PLAN[pi][0]);
      return;
    }
    const phase = PLAN[pi][0];
    if (phase === 'sail') return steer(dt);
    if (phase === 'rift' && !g.inRift) return;
    const foe = phase === 'wander' ? null : nearestFoe(phase === 'rift' ? 40 : 45);
    if (foe && !p.swimming) {
      idleT = 0;
      return fight(dt, foe);
    }
    if (phase === 'fight' && ((idleT += dt) > 25 || (p.swimming && idleT > 5))) {
      const s = camps[campI++ % camps.length];
      place(s.def.x + 22, s.def.z);
      note(`camp cleared or empty; next camp ${s.def.type}`);
      idleT = 0;
      return;
    }
    if (!goal || walk(dt, goal[0], goal[1]) < 3) {
      if (phase === 'wander') goal = people[Math.floor(Math.random() * people.length)];
      else if (phase === 'rift') goal = riftGoal(p);
      else goal = [p.pos.x + (Math.random() - 0.5) * 60, p.pos.z + (Math.random() - 0.5) * 60];
    }
  }

  // kills, deaths and wipes as events
  const kill = g.onEnemyKilled.bind(g);
  g.onEnemyKilled = (e, killer) => {
    if (killer === g.player) {
      S.kills++;
      S.killTypes[e.type] = (S.killTypes[e.type] || 0) + 1;
    }
    return kill(e, killer);
  };
  const death = g.onPlayerDeath.bind(g);
  g.onPlayerDeath = (src) => {
    note(`player died (${src && src.name})`);
    return death(src);
  };
  const wipe = g.wipe.bind(g);
  g.wipe = (cause) => {
    note('wiped: ' + cause);
    wipe(cause);
    setTimeout(newCharacter, 2000);
  };

  // every frame interval, with the frames over 50 ms named by what was going on
  let last = performance.now();
  const tick = (now) => {
    const dt = now - last;
    last = now;
    if (S.pause || S.skip > 0 || dt < 0) S.skip = Math.max(0, S.skip - 1);
    else {
      S.frames.push(dt);
      if (dt > 50) {
        S.hitches.push({
          t: +(now / 1000).toFixed(1), ms: +dt.toFixed(1), phase: S.phase, inRift: g.inRift, transitioning: !!g.transitioning, actors: G.actors.length,
          sinceTeleport: S.placedAt ? +((now - S.placedAt) / 1000).toFixed(1) : null,
        });
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, { phaseScale, region, fresh });
out.camps = await page.evaluate(() => window.__soak.camps);
console.log(`${out.camps} camps${region ? ' in region ' + region : ''}${clearNav ? ', navigation cache emptied at each sample' : ''}${heapProfile ? ', allocations sampled' : ''}`);

// Live sampled memory by allocation site and by file, largest first.
function heapTop(profile) {
  const sites = new Map();
  const files = new Map();
  const walk = (n) => {
    const f = n.callFrame;
    const file = f.url ? f.url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '') : '(native)';
    const site = `${f.functionName || '(anonymous)'} ${file}:${f.lineNumber + 1}`;
    if (n.selfSize) {
      sites.set(site, (sites.get(site) || 0) + n.selfSize);
      files.set(file, (files.get(file) || 0) + n.selfSize);
    }
    for (const c of n.children) walk(c);
  };
  walk(profile.head);
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, b]) => [name, +(b / 1048576).toFixed(2)]);
  return { sites: top(sites, 40), files: top(files, 25), totalMB: +([...files.values()].reduce((a, b) => a + b, 0) / 1048576).toFixed(2) };
}

async function sample(i) {
  await page.evaluate(() => (window.__soak.pause = true));
  let withTiles;
  if (clearNav) {
    await cdp.send('HeapProfiler.collectGarbage');
    withTiles = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  }
  const s = await page.evaluate(async (clearNav) => {
    const g = window.__unstable;
    const { G } = await import('/src/core/globals.js');
    const S = window.__soak;
    const ft = S.frames.splice(0).sort((a, b) => a - b);
    const q = (p) => (ft.length ? +ft[Math.min(ft.length - 1, Math.floor(ft.length * p))].toFixed(1) : null);
    const teams = {};
    for (const a of G.actors) teams[a.team] = (teams[a.team] || 0) + 1;
    const live = (sys) => {
      let n = 0;
      for (let k = 0; k < sys.cap; k++) if (sys.life[k] > 0) n++;
      return n;
    };
    const vfx = g.vfx;
    const mem = g.renderer.info.memory;
    const { navGrid } = await import('/src/entities/nav.js');
    const navTiles = navGrid(g.world).tiles.size; // a cache that grows with ground explored (capped at 4000)
    if (clearNav) navGrid(g.world).tiles.clear();
    return {
      phase: S.phase, cycle: S.cycle, simMin: +(S.simT / 60).toFixed(1), inRift: g.inRift, skyTime: +g.world.sky.time.toFixed(3), state: g.state,
      frames: ft.length, fps: ft.length ? +(1000 / (ft.reduce((a, b) => a + b, 0) / ft.length)).toFixed(1) : null,
      p50: q(0.5), p95: q(0.95), p99: q(0.99), max: ft.length ? +ft.at(-1).toFixed(1) : null, over50: ft.filter((x) => x > 50).length, over33: ft.filter((x) => x > 33.4).length,
      heapUsedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
      actors: G.actors.length, teams, projectiles: G.projectiles.length, boats: g.boats.length, spawnersAwake: g.spawners.filter((s) => s.alive.length).length,
      particles: live(vfx.add) + live(vfx.norm), effects: vfx.effects.length, trails: vfx.trails.size, numbers: vfx.numbers.length, emitters: vfx.emitters.length,
      sceneChildren: G.scene.children.length, geometries: mem.geometries, textures: mem.textures, programs: g.renderer.info.programs.length, navTiles,
      kills: S.kills, killTypes: S.killTypes, casts: S.casts, power: g.ch.level, earned: g.ch.earned, xpGiven: S.xp, topUps: S.topUps, sailedM: Math.round(S.sailedM), events: S.events.splice(0), hitches: S.hitches.splice(0),
    };
  }, clearNav);
  const dom = await cdp.send('Memory.getDOMCounters').catch(() => ({}));
  await cdp.send('HeapProfiler.collectGarbage');
  const v8 = await cdp.send('Runtime.getHeapUsage');
  let heap;
  if (heapProfile) {
    if (i === 0) {
      await cdp.send('HeapProfiler.enable');
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768 });
    }
    else heap = heapTop((await cdp.send('HeapProfiler.getSamplingProfile')).profile);
  }
  const liveMB = await page.evaluate(() => {
    window.__soak.skip = 3; // the forced GC's frame is the tool's, not the game's
    window.__soak.pause = false;
    return Math.round(performance.memory.usedJSHeapSize / 1048576);
  });
  const row = {
    i, minute: +((Date.now() - tStart) / 60000).toFixed(1), ...s, liveHeapMB: liveMB, v8UsedMB: Math.round(v8.usedSize / 1048576),
    ...(clearNav ? { v8WithTilesMB: +(withTiles / 1048576).toFixed(2), v8UsedExactMB: +(v8.usedSize / 1048576).toFixed(2), tilesKB: +((withTiles - v8.usedSize) / 1024).toFixed(1) } : {}),
    domNodes: dom.nodes, jsListeners: dom.jsEventListeners, load: +os.loadavg()[0].toFixed(1), errors: errors.length, ...(heap ? { heap } : {}),
  };
  out.hitches.push(...row.hitches.map((h) => ({ sample: i, ...h })));
  out.events.push(...row.events.map((e) => ({ sample: i, ...e })));
  delete row.hitches;
  delete row.events;
  out.samples.push(row);
  save();
  console.log(`[${row.minute} min] ${row.phase}${row.inRift ? ' (Rift)' : ''} sky ${row.skyTime}: heap ${row.heapUsedMB} MB, live ${row.liveHeapMB} MB, ` +
    `p50/p99/max ${row.p50}/${row.p99}/${row.max} ms, >50 ms ${row.over50}, actors ${row.actors}, projectiles ${row.projectiles}, particles ${row.particles}, ` +
    `DOM ${row.domNodes}, programs ${row.programs}, kills ${row.kills}, Power ${row.power} (+${row.earned}/15), XP given ${row.xpGiven}, top-ups ${row.topUps}, errors ${row.errors}, load ${row.load}, v8 ${row.v8UsedMB} MB, nav tiles ${row.navTiles}` +
    (clearNav ? ` (held ${row.tilesKB} KB)` : '') +
    (heap ? `, sampled live ${heap.totalMB} MB (top: ${heap.files.slice(0, 3).map(([f, mb]) => `${f.split('/').pop()} ${mb}`).join(', ')})` : ''));
}

const tStart = Date.now();
let i = 0;
try {
  await sample(i++);
  while (Date.now() - tStart < minutes * 60000) {
    const next = tStart + i * every * 60000;
    await page.waitForTimeout(Math.max(1000, Math.min(next, tStart + minutes * 60000) - Date.now()));
    await sample(i++);
  }
} catch (e) {
  errors.push({ at: Date.now(), msg: 'tool: ' + e.message });
} finally {
  out.ended = new Date().toISOString();
  save();
  await browser.close();
}
console.log(`samples ${out.samples.length}, hitches over 50 ms ${out.hitches.length}, console errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).map((e) => e.msg).join(' | ') : ''}`);
process.exit(errors.length ? 1 : 0);
