// In-page harness for tools/quest-run.mjs: imported by the game page from the dev server
// (`/tools/quest-harness.js`), so it drives the very modules the game runs.
//
// It plays quests the way a player does, through the game's own paths: dialogue is opened with
// [E]'s interact and its buttons clicked; enemies are found at their placed spawners and struck
// down through combat's damage (credited to the player as any kill is); lore is read at its
// carrier; places are walked into; the Crown Sluice and the Ascent's wound change realm; the
// Crucible's trials are fought wave by wave. Shortcuts, each named in the report: the player is
// teleported between places (reachability is a separate check, on the enemies' walk grid), kept
// alive, and handed collect items once their sources are confirmed.
import { G } from '/src/core/globals.js';
import { QUESTS } from '/src/data/quests.js';
import { stageObjectives } from '/src/game/quests.js';
import { ENEMIES } from '/src/data/enemies.js';
import { ITEMS, OUTFITS } from '/src/data/items.js';
import { WEAPONS } from '/src/data/weapons.js';
import { NPCS, LOCATIONS } from '/src/data/world.js';
import { LORE_BY_ID } from '/src/data/lore.js';
import { SHOPS } from '/src/data/npcs.js';
import { damage } from '/src/combat/combat.js';
import { ACTIONS } from '/src/game/hooks.js';
import { focusQuest } from '/src/game/story.js';
import { navGrid, navBody } from '/src/entities/nav.js';
import * as FISHING from '/src/data/fishing.js';
import { RIFT_PICKUPS, RIFT_GLYPHS } from '/src/data/riftResearch.js';
import { ROADS } from '/src/data/roads.js';
import * as FACTIONS from '/src/data/factions.js';

const g = () => window.__unstable;
const ch = () => g().ch;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = [];
const note = (s) => log.push(s);

// ------------------------------------------------------------------ state
export function setup({ name = 'Questrunner', race = 'ashkin', level = 1 } = {}) {
  const game = g();
  game.input.requestLock = () => {};
  const c = game.createCharacter({ name, race, look: {} });
  c.armed = true;
  game.startGame(c, false);
  setLevel(level);
  const p = game.player;
  p.onLethal = () => (p.hp = p.maxHp); // the run is the content's to show, not the player's to lose
  game.ui.toast = ((t) => (m, k) => {
    toasts.push(String(m));
    return t(m, k);
  })(game.ui.toast.bind(game.ui));
  game.ui.banner = ((b) => (t, s, d) => {
    banners.push(`${t} | ${s || ''}`);
    return b(t, s, d);
  })(game.ui.banner.bind(game.ui));
  return true;
}
export const toasts = [];
export const banners = [];

export function setLevel(level) {
  const c = ch();
  c.level = level;
  c.points = 0;
  g().player.level = level;
  g().player.recompute();
}

export function snap() {
  return JSON.stringify(ch());
}
export function restore(s) {
  const game = g();
  const c = ch();
  const data = JSON.parse(s);
  for (const k of Object.keys(c)) delete c[k];
  Object.assign(c, data);
  game.world.resetChests();
  for (const id of c.chestsOpened || []) game.world.setChestOpened(id);
  game.ui.closeAll(true);
  game.player.recompute();
}

// ------------------------------------------------------------------ moving
export function realmOf(x) {
  return g().world.inRift(x);
}
export function tp(x, z, y = null) {
  const game = g();
  const p = game.player;
  if (p.boat) p.leaveBoat();
  const w = game.world;
  const top = y == null ? Math.max(w.terrain.heightAt(x, z), 0) + 60 : y + 3;
  p.pos.set(x, w.groundAt(x, z, top) + 0.1, z);
  p.vel.set(0, 0, 0);
  p.fallStart = p.pos.y;
  game.inRift = realmOf(x);
  game.areaName = null;
}
export function simulate(sec) {
  g().simulate(sec, 1 / 30);
}

// ------------------------------------------------------------------ dialogue
export const npcBy = (id) => g().npcs.find((n) => n.id === id);
function dialogueButtons() {
  const m = g().ui.modal;
  if (!m || m.id !== 'dialogue') return null;
  return [...m.el.querySelectorAll('.dl-opt')];
}
function dialogueText() {
  const m = g().ui.modal;
  return m && m.id === 'dialogue' ? m.el.querySelector('.dl-text').textContent : '';
}
export function talk(npcId, { move = true } = {}) {
  const game = g();
  const n = npcBy(npcId);
  if (!n) return { ok: false, why: `no NPC ${npcId} in the world` };
  if (n.hidden) return { ok: false, why: `${n.name} is hidden now` };
  if (move) tp(n.pos.x + 1.5, n.pos.z + 1.5, n.pos.y);
  game.ui.closeAll(true);
  game.interact({ kind: 'npc', npc: n, label: '' });
  const b = dialogueButtons();
  // the typed-out text: show it all
  const m = game.ui.modal;
  if (m && m.id === 'dialogue') m.el.querySelector('.dl-text').click();
  return { ok: !!b, labels: b ? b.map((x) => x.textContent.replace(/^\d+/, '')) : [], text: dialogueText(), npc: n };
}
function click(i) {
  const b = dialogueButtons();
  if (!b || !b[i]) return false;
  b[i].click();
  const m = g().ui.modal;
  if (m && m.id === 'dialogue') m.el.querySelector('.dl-text').click();
  return true;
}
// The labels a player sees down a path of clicks (for the report).
function walkPath(npcId, path) {
  const t = talk(npcId);
  if (!t.ok) return null;
  const labels = [];
  for (const i of path) {
    const b = dialogueButtons();
    if (!b || !b[i]) return null;
    labels.push(b[i].textContent.replace(/^\d+/, ''));
    click(i);
  }
  return labels;
}
// Breadth-first through an NPC's dialogue for a path of clicks after which goal() holds, each
// try from the same state. Returns { path, labels } or null. Leaves the state as goal left it.
export function searchDialogue(npcId, goal, { depth = 4, limit = 160, beforeFinal = null } = {}) {
  const root = snap();
  const queue = [[]];
  let tries = 0;
  while (queue.length && tries < limit) {
    const prefix = queue.shift();
    restore(root);
    const t = talk(npcId);
    if (!t.ok) return null;
    for (const i of prefix) click(i);
    const b = dialogueButtons();
    const n = b ? b.length : 0;
    for (let i = 0; i < n; i++) {
      tries++;
      restore(root);
      talk(npcId);
      for (const j of prefix) click(j);
      const path = [...prefix, i];
      click(i);
      if (goal()) {
        restore(root);
        if (beforeFinal) beforeFinal();
        const labels = walkPath(npcId, path);
        g().ui.closeAll(true);
        return goal() ? { path, labels } : null;
      }
      if (dialogueButtons() && path.length < depth) queue.push(path);
    }
  }
  restore(root);
  return null;
}
// Every line of an NPC's dialogue reachable from where things stand, for dead-end checks:
// a node with no way out other than closing is fine; a button that does nothing and leaves the
// same node up is a dead end.
export function dialogueTree(npcId, { depth = 4, limit = 220 } = {}) {
  const root = snap();
  const seen = new Map();
  const queue = [[]];
  let tries = 0;
  const dead = [];
  while (queue.length && tries < limit) {
    const prefix = queue.shift();
    restore(root);
    const t = talk(npcId, { move: tries === 0 });
    if (!t.ok) return { error: t.why };
    for (const i of prefix) click(i);
    const b = dialogueButtons();
    if (!b) continue;
    const text = dialogueText();
    const labels = b.map((x) => x.textContent.replace(/^\d+/, ''));
    seen.set(prefix.join('.'), { text, labels });
    for (let i = 0; i < labels.length; i++) {
      tries++;
      const path = [...prefix, i];
      restore(root);
      talk(npcId, { move: false });
      for (const j of prefix) click(j);
      const before = dialogueText();
      click(i);
      const after = dialogueButtons();
      if (after && dialogueText() === before && after.length === labels.length && path.length < 8) dead.push({ path, label: labels[i], text: before.slice(0, 80) });
      else if (after && path.length < depth) queue.push(path);
    }
  }
  restore(root);
  g().ui.closeAll(true);
  return { nodes: seen.size, dead, tries };
}

// ------------------------------------------------------------------ where things are
function spawnersOf(types) {
  types = [].concat(types);
  const c = ch();
  return g().spawners.filter((s) => types.includes(s.def.type) && (!s.def.when || s.def.when(c)));
}
function nearestSpawner(types) {
  const p = g().player.pos;
  let best = null;
  let bd = Infinity;
  for (const s of spawnersOf(types)) {
    const d = Math.hypot(s.def.x - p.x, s.def.z - p.z) + (realmOf(s.def.x) !== realmOf(p.x) ? 1e5 : 0);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
const loreIt = (id) => g().world.interactables.find((it) => it.id === 'lore_' + id);
const locBy = (name) => LOCATIONS.find((l) => l.name === name);

// Where a player would go for one objective right now (what the ◆ should point at).
export function objectivePoint(o) {
  const game = g();
  switch (o.type) {
    case 'talk': {
      const n = npcBy(o.npc);
      return n ? { x: n.pos.x, z: n.pos.z, what: n.name } : null;
    }
    case 'flag': {
      if (o.npc) {
        const n = npcBy(o.npc);
        return n ? { x: n.pos.x, z: n.pos.z, what: n.name } : null;
      }
      return o.x !== undefined ? { x: o.x, z: o.z, what: 'flag spot' } : null;
    }
    case 'kill':
    case 'boss': {
      const s = nearestSpawner(o.type === 'boss' ? o.boss : o.target);
      return s ? { x: s.def.x, z: s.def.z, what: `spawner ${s.def.type}`, r: s.def.radius } : null;
    }
    case 'lore': {
      const it = loreIt(o.lore);
      const l = LORE_BY_ID[o.lore];
      return it ? { x: it.pos.x, z: it.pos.z, what: `record ${o.lore}` } : l ? { x: l.x, z: l.z, what: `record ${o.lore} (no carrier)` } : null;
    }
    case 'reach':
      return o.x !== undefined ? { x: o.x, z: o.z, what: o.loc || 'place' } : null;
    default:
      return null;
  }
}

// What the compass ◆ points at, set to follow quest `id`, against where the step really is.
export function markerCheck(id) {
  const c = ch();
  c.trackedQuest = id;
  const m = ACTIONS.questMarker ? ACTIONS.questMarker() : null;
  const q = c.quests[id];
  const def = QUESTS[id];
  if (!q || !def) return { ok: false, why: 'not started' };
  let target = null;
  if (q.state === 'ready') {
    const n = npcBy(def.turnIn);
    target = n ? { x: n.pos.x, z: n.pos.z, what: `turn in to ${n.name}` } : null;
  } else {
    const objs = def.stages ? stageObjectives(def, q.stage) : def.objectives;
    for (let i = 0; i < objs.length && !target; i++) {
      if (def.stages && g().quests._objDone(id, objs[i], i)) continue;
      let o = objs[i];
      if (o.type === 'any') o = o.of.find((x) => objectivePoint(x)) || o;
      target = objectivePoint(o);
      if (!target && (o.type === 'realm' || o.type === 'collect' || o.type === 'level' || o.type === 'quest' || o.type === 'flag')) return { ok: true, marker: m, why: `no fixed place (${o.type})` };
    }
  }
  if (!target) return { ok: !m, marker: m, why: m ? 'marker with no target' : 'no target' };
  const here = g().player.pos;
  const cross = realmOf(target.x) !== realmOf(here.x);
  const at = { here: [Math.round(here.x), Math.round(here.z)], inRift: g().inRift };
  if (cross) {
    const want = realmOf(here.x) ? 'The Ascent' : 'The Crown Sluice';
    return { ok: !!m && m.label === want, marker: m, target, ...at, why: `other realm: expects ${want}` };
  }
  if (!m) return { ok: false, target, why: 'no marker' };
  const d = Math.hypot(m.x - target.x, m.z - target.z);
  return { ok: d < 12, d: Math.round(d * 10) / 10, target, marker: { x: Math.round(m.x), z: Math.round(m.z) } };
}

// Can a player walk from an access point (a named place, a dock, a camp fire or an NPC in the
// same realm, within the planner's reach) to the target? A conservative check: the enemies'
// grid neither climbs nor rides lines.
export function reachCheck(x, z, tol = 3) {
  const game = g();
  const w = game.world;
  const nav = navGrid(w);
  const body = navBody({ radius: 0.4, height: 1.8 });
  const rift = realmOf(x);
  const anchors = [];
  for (const l of LOCATIONS) if (realmOf(l.x) === rift) anchors.push([l.x, l.z, l.name]);
  for (const n of game.npcs) if (realmOf(n.pos.x) === rift) anchors.push([n.pos.x, n.pos.z, n.name]);
  for (const it of w.interactables) if ((it.kind === 'campfire' || it.kind === 'dock' || it.kind === 'well') && realmOf(it.pos.x) === rift) anchors.push([it.pos.x, it.pos.z, it.id]);
  for (const r of ROADS) r.points.forEach((pt, k) => k % 3 === 0 && realmOf(pt[0]) === rift && anchors.push([pt[0], pt[1], r.name || r.id]));
  // open water is reached by a rented boat
  const sea = w.terrain.heightAt(x, z) < -1 && w.colliders.groundAt(x, z, 2) < -0.5;
  if (sea && !rift) return { ok: true, how: 'by boat (open water)' };
  const ty = w.groundAt(x, z, Math.max(w.terrain.heightAt(x, z), 0) + 40);
  const near = anchors.map((a) => [...a, Math.hypot(a[0] - x, a[1] - z)]).filter((a) => a[3] > 4 && a[3] < 150).sort((a, b) => a[3] - b[3]).slice(0, 4);
  if (Math.hypot(game.player.pos.x - x, game.player.pos.z - z) < 4) return { ok: true, how: 'stands there' };
  if (!near.length) return { ok: null, how: 'no access point within 150 m' };
  let best = null;
  for (const a of near) {
    const ay = w.groundAt(a[0], a[1], Math.max(w.terrain.heightAt(a[0], a[1]), 0) + 40);
    const r = nav.findPath(a[0], a[1], ay, x, z, ty, body, 400000);
    const end = r && r.points.length ? r.points[r.points.length - 1] : null;
    const short = end ? Math.hypot(end[0] - x, end[2] - z) : Infinity;
    const res = { from: a[2], dist: Math.round(a[3]), complete: !!(r && r.complete), short: Math.round(short * 10) / 10 };
    if (res.complete || short < tol) return { ok: true, how: `walk from ${a[2]} (${res.dist} m)` };
    if (!best || short < best.short) best = res;
  }
  return { ok: false, how: `from ${best.from}: stops ${best.short} m short` };
}

// Every way the game hands out an item, from its tables (dialogue gifts and pickups count when
// the run itself sees them).
export function itemSources(id) {
  const out = [];
  for (const [t, e] of Object.entries(ENEMIES)) for (const d of e.drops || []) if (d.id === id) out.push(`drop: ${t} (${Math.round(d.chance * 100)}%)`);
  for (const c of g().world.chests) for (const [i] of c.def.loot?.items || []) if (i === id) out.push(`chest: ${c.def.id}`);
  for (const [s, shop] of Object.entries(SHOPS)) if ((shop.items || []).includes(id)) out.push(`shop: ${s}`);
  const fishText = JSON.stringify(FISHING);
  if (fishText.includes(`"${id}"`)) out.push('fishing');
  for (const it of g().world.interactables) if (it.item === id || it.gives === id || (it.loot && JSON.stringify(it.loot).includes(`"${id}"`))) out.push(`pickup: ${it.id}`);
  for (const pk of RIFT_PICKUPS) if (pk.item === id) out.push(`pickup: ${pk.id}`);
  const forage = g().world.forage;
  if (forage && JSON.stringify(forage.kinds || forage.defs || []).includes(`"${id}"`)) out.push('forage');
  for (const [k, it] of Object.entries(ITEMS)) if (it.recipe && JSON.stringify(it.recipe).includes(id) === false && k === id) out.push('recipe');
  if (ITEMS[id] && ITEMS[id].recipe) out.push('cooking/crafting');
  return out;
}

// ------------------------------------------------------------------ objective drivers
// A lethal blow from the player; a humanoid it knocks down is gripped, as [B] does.
export function fell(e) {
  const p = g().player;
  if (!e.knocked) damage(p, e, e.hp + e.maxHp * 2, 'phys', { kind: 'melee' });
  if (e.knocked && !e.dead) e.finish(p);
}
export async function killOf(types, count, label) {
  const game = g();
  types = [].concat(types);
  const s = nearestSpawner(types);
  if (!s) return { ok: false, why: `no spawner for ${types.join('/')} now` };
  tp(s.def.x + 6, s.def.z + 6, s.def.y);
  const p = game.player;
  let killed = 0;
  let natural = 0;
  const strike = () => {
    for (const e of G.actors) {
      if (killed >= count) break;
      if (e.dead || e.team === 'player' || !types.includes(e.type) || e.netProxy) continue;
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > 200) continue;
      fell(e);
      if (e.dead) killed++;
    }
  };
  for (let t = 0; t < 40 && killed < count; t++) {
    simulate(0.25);
    const before = killed;
    strike();
    natural += killed - before;
    if (s.alive.length === 0 && t > 8 && s.pending === 0) break;
  }
  // a camp holds fewer than the count: more of the same come, as its respawns would
  for (let i = 0; killed < count && i < count * 2; i++) {
    const e = game.spawnEnemy(types[0], p.pos.clone().add({ x: 4, y: 0.5, z: 2 }), {});
    simulate(0.1);
    fell(e);
    if (e.dead) killed++;
    simulate(0.1);
  }
  simulate(0.5);
  return { ok: killed >= count, natural, killed, at: [Math.round(s.def.x), Math.round(s.def.z)], why: killed >= count ? '' : `killed ${killed} of ${count}` };
}

export async function readLore(id) {
  const it = loreIt(id);
  if (!it) return { ok: false, why: `no carrier for record ${id}` };
  tp(it.pos.x + 1.2, it.pos.z + 1.2, it.pos.y - 1);
  g().interact(it);
  await sleep(50);
  g().ui.closeAll(true);
  return { ok: (ch().lore || []).includes(id), why: (ch().lore || []).includes(id) ? '' : 'read, but not recorded' };
}

export async function changeRealm(realm) {
  const game = g();
  if ((realm === 'rift') === game.inRift) return { ok: true, how: 'already there' };
  if (realm === 'rift') {
    const it = game.world.interactables.find((x) => x.kind === 'sluice');
    if (!it) return { ok: false, why: 'no Crown Sluice' };
    tp(it.pos.x, it.pos.z, it.pos.y - 1);
    game.interact(it);
    await sleep(2200);
    return { ok: game.inRift, how: 'the Crown Sluice', why: game.inRift ? '' : 'the sluice did not take me down' };
  }
  const it = game.world.interactables.find((x) => x.id === 'ascent_summit');
  if (!it) return { ok: false, why: 'no summit wound' };
  tp(it.pos.x, it.pos.z, it.pos.y - 1);
  game.interact(it);
  await sleep(2200);
  return { ok: !game.inRift, how: "the Ascent's wound", why: game.inRift ? 'the wound did not send me home' : '' };
}

export async function crucible(trialId) {
  const game = g();
  const a = game.world.arena;
  tp(a.x + Math.sin(a.gap) * (a.r + 4), a.z + Math.cos(a.gap) * (a.r + 4), a.y);
  ch().silver += 2000; // the fee
  ACTIONS.openCrucible(game.ui);
  const btn = [...document.querySelectorAll('[data-trial]')].find((b) => b.dataset.trial === trialId);
  if (!btn || btn.disabled) {
    game.ui.closeAll(true);
    return { ok: false, why: btn ? `${trialId} trial button disabled` : `no ${trialId} trial button` };
  }
  btn.click();
  await sleep(1500); // the fade into the ring
  for (let t = 0; t < 400; t++) {
    simulate(0.25);
    const run = ACTIONS.crucibleRun();
    if (!run) break;
    for (const e of run.alive) if (!e.dead) fell(e);
  }
  return { ok: !!ch().flags[`crucible_${trialId}`], why: ch().flags[`crucible_${trialId}`] ? '' : 'trial not cleared' };
}

export async function traceGlyphs() {
  const game = g();
  for (const { id } of RIFT_GLYPHS) {
    const it = game.world.interactables.find((x) => x.id === `glyph_${id}`);
    if (!it) return { ok: false, why: `no glyph ${id}` };
    tp(it.pos.x + 1, it.pos.z + 1, it.pos.y - 1);
    if (it.enabled && !it.enabled()) return { ok: false, why: `glyph ${id} not usable` };
    game.interact(it);
  }
  return { ok: !!ch().flags.rift_vault_unsealed };
}

async function investAttunement() {
  const game = g();
  const c = ch();
  c.manaUnlocked = true;
  c.points = Math.max(c.points, 1);
  // points are invested sitting at a campfire (the systems session's rule): sit at the nearest
  const p = game.player;
  const fire = game.world.interactables.filter((x) => x.kind === 'campfire' && realmOf(x.pos.x) === realmOf(p.pos.x)).sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z))[0];
  if (fire && p.resting && !p.resting()) {
    tp(fire.pos.x + 1.4, fire.pos.z, fire.pos.y);
    p.dangerT = 0;
    game.interact(fire);
    game.ui.closeAll(true);
  }
  game.ui.openCharMenu('attrs');
  const inc = document.querySelector('[data-inc="ember"]');
  if (!inc) {
    game.ui.closeAll(true);
    return { ok: false, why: 'no invest button for an attunement' };
  }
  inc.click();
  document.querySelector('[data-a="confirm"]')?.click();
  game.ui.closeAll(true);
  return { ok: !!c.flags.sageTrial };
}

let currentGoals = {};
// Satisfy one objective of quest `id` the way a player would.
export async function satisfy(id, o, i) {
  const game = g();
  const c = ch();
  if (game.quests._objDone(id, o, i)) return { ok: true, how: 'already done' };
  switch (o.type) {
    case 'kill':
      return killOf(o.target, Math.max(1, o.count - ((c.quests[id].sp || [])[i] || c.quests[id].progress || 0)));
    case 'boss':
      return killOf([o.boss], 1);
    case 'talk': {
      const t = talk(o.npc);
      game.ui.closeAll(true);
      const q = c.quests[id];
      const done = game.quests._objDone(id, o, i) || q.talked === true || q.state !== 'active' || (q.stage || 0) > 0;
      return { ok: t.ok && done, why: t.ok ? '' : t.why };
    }
    case 'lore':
      return readLore(o.lore);
    case 'reach': {
      if (o.x === undefined) return { ok: false, why: `unknown place ${o.loc}` };
      const l = locBy(o.loc);
      tp(o.x, o.z, null);
      simulate(1.2);
      return { ok: game.quests._objDone(id, o, i) || !!c.quests[id] && c.quests[id].stage > 0, how: l ? l.name : '' };
    }
    case 'realm':
      return changeRealm(o.realm);
    case 'level':
      setLevel(Math.max(c.level, o.level));
      game.quests.onFlag();
      return { ok: true, how: 'Power set' };
    case 'quest':
      return { ok: c.quests[o.quest]?.state === 'done', why: `needs ${o.quest} done` };
    case 'collect': {
      const have = c.inventory.items[o.item] || 0;
      if (have >= o.count) return { ok: true, how: 'already carried' };
      // a pickup in the world is taken where it lies
      const picks = RIFT_PICKUPS.filter((pk) => pk.item === o.item && !c.flags[`took_${pk.id}`]);
      for (const pk of picks) {
        if ((c.inventory.items[o.item] || 0) >= o.count) break;
        const it = game.world.interactables.find((x) => x.id === pk.id);
        if (!it) continue;
        tp(it.pos.x + 1, it.pos.z + 1, it.pos.y - 1);
        game.interact(it);
      }
      if ((c.inventory.items[o.item] || 0) >= o.count) return { ok: true, how: `taken from ${picks.map((x) => x.id).join(', ')}` };
      const src = itemSources(o.item);
      game.giveItem(o.item, o.count - (c.inventory.items[o.item] || 0), true);
      return { ok: src.length > 0, how: `given; sources: ${src.slice(0, 4).join(', ') || 'none found'}`, why: src.length ? '' : `no source for ${o.item}` };
    }
    case 'flag': {
      if (o.flag === 'sageTrial') return investAttunement();
      if (o.flag.startsWith('crucible_')) return crucible(o.flag.slice(9));
      if (o.flag === 'rift_ascent_conquered') {
        await changeRealm('rift');
        return changeRealm('surface').then((r) => ({ ...r, ok: !!c.flags.rift_ascent_conquered }));
      }
      if (o.flag === 'rift_vault_unsealed') return traceGlyphs();
      if (o.flag === 'ending_chosen') return { ok: false, why: 'the ending is chosen by the story run' };
      const who = o.npc || QUESTS[id].giver;
      const extra = currentGoals[o.flag];
      const r = searchDialogue(who, () => !!c.flags[o.flag] && (!extra || extra()));
      return { ok: !!r, how: r ? `${who}: ${r.labels.join(' → ')}` : '', why: r ? '' : `no dialogue at ${who} sets ${o.flag}` };
    }
    case 'any': {
      for (const x of o.of) {
        if (game.quests._objDone(id, x, i)) return { ok: true, how: `already (${x.type})` };
      }
      for (const x of o.of) {
        const r = await satisfy(id, x, i);
        if (r.ok) return r;
      }
      return { ok: false, why: 'no route of "any" worked' };
    }
    default:
      return { ok: false, why: `unknown objective ${o.type}` };
  }
}

// ------------------------------------------------------------------ rewards
export function wallet() {
  const c = ch();
  return {
    silver: c.silver,
    items: { ...c.inventory.items },
    weapons: c.inventory.weapons.map((w) => w.id),
    outfits: [...c.inventory.outfits],
    trinkets: (c.trinkets || []).map((t) => t.id),
    rep: { ...(c.rep || {}) },
    flags: { ...c.flags },
  };
}
let xpLog = null;
export function watchXp() {
  const p = g().player;
  xpLog = [];
  if (!p.__xpWrapped) {
    const add = p.addXp.bind(p);
    p.addXp = (n, ...r) => {
      if (xpLog) xpLog.push(n);
      return add(n, ...r);
    };
    p.__xpWrapped = true;
  }
}
export function rewardDiff(id, before) {
  const def = QUESTS[id];
  const r = def.rewards || {};
  const after = wallet();
  const issues = [];
  const xp = (xpLog || []).reduce((a, b) => a + b, 0);
  xpLog = null;
  const want = (n) => n || 0;
  if (after.silver - before.silver !== want(r.silver)) issues.push(`silver ${after.silver - before.silver} (listed ${want(r.silver)})`);
  if (Math.round(xp) !== want(r.xp)) issues.push(`xp ${Math.round(xp)} (listed ${want(r.xp)})`);
  // items: listed rewards in, consumed collect items out
  const expect = {};
  for (const [it, n] of r.items || []) expect[it] = (expect[it] || 0) + n;
  const objs = def.stages ? def.stages.flatMap((s) => s.objectives || [s]) : def.objectives;
  for (const o of objs) if (o.type === 'collect' && (o.consume ?? def.consume)) expect[o.item] = (expect[o.item] || 0) - o.count;
  const keys = new Set([...Object.keys(expect), ...Object.keys(before.items), ...Object.keys(after.items)]);
  for (const k of keys) {
    const d = (after.items[k] || 0) - (before.items[k] || 0);
    if (d !== (expect[k] || 0)) issues.push(`${k} ${d >= 0 ? '+' : ''}${d} (listed ${expect[k] || 0})`);
  }
  const newW = after.weapons.slice(before.weapons.length);
  if (newW.join() !== (r.weapons || []).join()) issues.push(`weapons [${newW}] (listed [${r.weapons || []}])`);
  // a faction's gift arrives when the quest's standing carries you to Honored or Exalted with it
  // (data/factions.js TIER_REWARDS; each sends once and sets honored_<f> / exalted_<f>)
  const giftO = [];
  const giftT = [];
  for (const [f, tiers] of Object.entries(FACTIONS.TIER_REWARDS || {})) {
    for (const [tier, give] of Object.entries(tiers)) {
      if (before.flags[`${tier}_${f}`] || !after.flags[`${tier}_${f}`]) continue;
      if (give.outfit) giftO.push(give.outfit);
      if (give.trinket) giftT.push(give.trinket);
    }
  }
  const newO = after.outfits.filter((o) => !before.outfits.includes(o));
  const wantO = [...(r.outfits || []), ...giftO].filter((o) => !before.outfits.includes(o));
  if (newO.slice().sort().join() !== wantO.slice().sort().join()) issues.push(`outfits [${newO}] (listed [${wantO}])`);
  const newT = after.trinkets.slice(before.trinkets.length);
  const wantT = [...(r.trinkets || []), ...giftT];
  if (newT.slice().sort().join() !== wantT.slice().sort().join()) issues.push(`trinkets [${newT}] (listed [${wantT}])`);
  // a listed change of standing moves its rivals by their share the other way (data/factions.js
  // RIVALS, when the build has them), rounded as game/factions.js addRep rounds it
  const expectRep = {};
  for (const [f, n] of Object.entries(r.rep || {})) {
    expectRep[f] = (expectRep[f] || 0) + n;
    for (const [g, k] of Object.entries((FACTIONS.RIVALS || {})[f] || {})) expectRep[g] = (expectRep[g] || 0) + Math.round(n * k);
  }
  for (const f of new Set([...Object.keys(expectRep), ...Object.keys(after.rep)])) {
    const d = (after.rep[f] || 0) - (before.rep[f] || 0);
    const w = expectRep[f] || 0;
    // standing is clamped at ±100
    if (d !== w && !(Math.abs((after.rep[f] || 0)) === 100)) issues.push(`rep ${f} ${d} (listed ${w})`);
  }
  for (const [k, v] of Object.entries(r.flags || {})) if (after.flags[k] !== v) issues.push(`flag ${k} not set`);
  return { ok: issues.length === 0, issues, got: { silver: after.silver - before.silver, xp: Math.round(xp) } };
}

// ------------------------------------------------------------------ one whole quest
// Start it from its giver, follow every stage (checking the ◆ before each), turn it in, and
// compare what it paid with its listed rewards.
export async function runQuest(id, { level = null, start = true, flagGoals = {} } = {}) {
  currentGoals = flagGoals;
  const game = g();
  const c = ch();
  const def = QUESTS[id];
  const out = { id, name: def.name, steps: [], markers: [], reach: [], start: null, turnIn: null, rewards: null, ok: true };
  const fail = (why) => {
    out.ok = false;
    out.why = out.why ? out.why + '; ' + why : why;
  };
  if (level) setLevel(Math.max(c.level, level));
  if (start && !c.quests[id]) {
    const giver = def.giver;
    const r = giver ? searchDialogue(giver, () => !!ch().quests[id]) : null;
    if (r) out.start = `${giver}: ${r.labels.join(' → ')}`;
    else if (def.main) {
      // the chain starts it when the chapter before is done and the Power is there
      simulate(1);
      await sleep(3800);
      simulate(0.6);
      out.start = ch().quests[id] ? 'by the story chain' : null;
    }
    if (!ch().quests[id]) {
      fail(`cannot be started${giver ? ` from ${giver}` : ''}`);
      return out;
    }
  }
  const q = () => ch().quests[id];
  for (let guard = 0; guard < 24 && q().state === 'active'; guard++) {
    const objs = def.stages ? stageObjectives(def, q().stage) : def.objectives;
    const stage = q().stage || 0;
    let progressed = false;
    for (let i = 0; i < objs.length; i++) {
      if (q().state !== 'active' || (q().stage || 0) !== stage) break;
      if (game.quests._objDone(id, objs[i], i)) continue;
      const mk = markerCheck(id);
      out.markers.push({ stage, i, ...mk });
      if (!mk.ok) fail(`marker at stage ${stage}.${i}: ${mk.why || ''} ${mk.d != null ? mk.d + ' m off' : ''}`);
      const pt = objectivePoint(objs[i].type === 'any' ? objs[i].of.find((x) => objectivePoint(x)) || objs[i] : objs[i]);
      if (pt) {
        const rc = reachCheck(pt.x, pt.z, Math.max(3, pt.r || 0));
        out.reach.push({ stage, i, what: pt.what, ...rc });
      }
      const r = await satisfy(id, objs[i], i);
      out.steps.push({ stage, i, type: objs[i].type, text: objs[i].text || '', ...r });
      if (!r.ok) {
        fail(`stage ${stage}.${i} (${objs[i].type}): ${r.why || 'not done'}`);
        return out;
      }
      progressed = true;
      game.quests.onFlag();
    }
    simulate(0.6);
    if (!progressed && q().state === 'active' && (q().stage || 0) === stage) {
      fail(`stuck at stage ${stage}`);
      return out;
    }
  }
  if (q().state === 'done') {
    out.turnIn = 'completed itself';
    return out;
  }
  if (q().state !== 'ready') {
    fail(`ended ${q().state}`);
    return out;
  }
  const mk = markerCheck(id);
  out.markers.push({ stage: 'turn-in', ...mk });
  if (!mk.ok) fail(`turn-in marker: ${mk.why || ''} ${mk.d != null ? mk.d + ' m off' : ''}`);
  const before = wallet();
  const r = searchDialogue(def.turnIn, () => ch().quests[id]?.state === 'done', { beforeFinal: watchXp });
  if (!r) {
    fail(`no way to turn in at ${def.turnIn}`);
    return out;
  }
  out.turnIn = `${def.turnIn}: ${r.labels.join(' → ')}`;
  out.rewards = rewardDiff(id, before);
  if (!out.rewards.ok) fail(`rewards: ${out.rewards.issues.join(', ')}`);
  return out;
}

export { QUESTS, focusQuest };

// ------------------------------------------------------------------ the main story
const lowPower = (def) => def.minLevel || Number(String(def.power || '1').split(/[–-]/)[0]) || 1;

async function waitStart(id, ms = 4500) {
  for (let t = 0; t < ms; t += 250) {
    if (ch().quests[id]) return true;
    simulate(0.25);
    await sleep(200);
  }
  return !!ch().quests[id];
}

// The Seat: choose one ending through its own panel.
export function chooseEnding(key) {
  const game = g();
  const it = game.world.interactables.find((x) => x.id === 'anchor_seat');
  if (!it) return { ok: false, why: "no Anchor's Seat" };
  if (it.enabled && !it.enabled()) return { ok: false, why: 'the Seat is not usable' };
  tp(it.pos.x + 2, it.pos.z + 2, it.pos.y - 1.5);
  game.interact(it);
  const b = document.querySelector(`#seat [data-end="${key}"]`);
  if (!b) return { ok: false, why: `no ${key} choice` };
  b.click();
  return { ok: ch().flags.ending === key && !!ch().flags.ending_chosen, title: (ch().titles || []).slice(-1)[0], rep: { ...ch().rep } };
}

// From a fresh character to the end: every chapter at its suggested Power, the faction paths
// where the story opens them, the register/refuse choice both ways, the three endings with
// Maren's reply to each, the final victory, the epilogue and the state after.
export async function storyRun({ mainline = 'refuse', endingKept = 'break' } = {}) {
  const game = g();
  const out = { chapters: [], factions: [], branches: {}, endings: {}, after: null };
  const chain = (await import('/src/data/story.js')).MAIN_CHAIN;
  const { ENDINGS } = await import('/src/data/story.js');
  const run = async (id, opts = {}) => {
    const def = QUESTS[id];
    if (def.main) setLevel(Math.max(ch().level, lowPower(def)));
    if (def.main && !ch().quests[id]) await waitStart(id);
    const r = await runQuest(id, opts);
    r.power = ch().level;
    if (def.main && !r.start) r.start = 'by the story chain';
    if (def.main) out.chapters.push(r);
    else out.factions.push(r);
    return r;
  };
  const side = async (id) => {
    // a faction quest at Power 20 would test nothing new, so it runs at the story's own Power
    const r = await runQuest(id);
    r.power = ch().level;
    out.factions.push(r);
    return r;
  };
  for (const id of chain) {
    if (id === 'writ') {
      // the register/refuse choice: both ways, then on with the main line
      const root = snap();
      setLevel(Math.max(ch().level, lowPower(QUESTS.writ)));
      await waitStart('writ');
      const fork = snap();
      for (const way of ['register', 'refuse']) {
        restore(fork);
        const goal = way === 'register' ? () => !!ch().flags.registryPapers : () => !!ch().flags.writ_refused;
        const before = { ...ch().rep };
        const maren = { text: '' };
        const r = await runQuest('writ', { flagGoals: { writ_answered: goal } });
        // what Maren said at the turn-in is the last dialogue text the run saw
        out.branches[way] = {
          ok: r.ok, why: r.why, papers: !!ch().inventory.items.registry_papers, registered: !!ch().flags.registryPapers, refused: !!ch().flags.writ_refused,
          rep: Object.fromEntries(Object.keys(ch().rep || {}).map((f) => [f, (ch().rep[f] || 0) - (before[f] || 0)])),
          envoyAfter: talk('envoy_crane').text.slice(0, 120),
        };
        g().ui.closeAll(true);
        if (way === 'register') {
          const e = await side('enclave_pirates');
          out.branches.register.enclavePath = e.ok ? 'PASS' : `FAIL: ${e.why}`;
        }
        if (way === mainline) out.chapters.push({ ...r, power: ch().level, branch: way });
        if (way === mainline) out.mainSnap = snap();
      }
      restore(out.mainSnap);
      delete out.mainSnap;
      void root;
      await side('watch_lamp');
      continue;
    }
    if (id === 'sovereign') {
      setLevel(Math.max(ch().level, lowPower(QUESTS.sovereign)));
      await waitStart('sovereign');
      // up to the Seat: everything but the choice
      const r = await runQuest('sovereign');
      const atSeat = snap();
      for (const key of Object.keys(ENDINGS)) {
        restore(atSeat);
        const c = chooseEnding(key);
        game.quests.onFlag('ending_chosen');
        simulate(0.6);
        const t = talk('maren');
        const reply = t.text;
        g().ui.closeAll(true);
        const before = wallet();
        const done = searchDialogue('maren', () => ch().quests.sovereign?.state === 'done', { beforeFinal: watchXp });
        const pay = done ? rewardDiff('sovereign', before) : null;
        await sleep(4200); // the victory screen follows the last chapter, and the epilogue's start after it
        const vic = game.ui.modal && game.ui.modal.id === 'victory' ? game.ui.modal.el.innerText : '';
        game.ui.closeAll(true);
        const titleOk = (ch().titles || []).includes(ENDINGS[key].titleReward);
        out.endings[key] = {
          ok: c.ok && !!done && titleOk && !!vic && vic.includes(ENDINGS[key].text.slice(0, 30)) && !!pay && pay.ok,
          rewards: pay,
          title: c.title, titleOk, rep: c.rep, maren: reply.slice(0, 160), victory: vic.replace(/\s+/g, ' ').slice(0, 200), why: c.why || (done ? (pay && !pay.ok ? 'rewards: ' + pay.issues.join(', ') : '') : 'no turn-in'),
        };
        if (key === endingKept) out.keptSnap = snap();
      }
      restore(out.keptSnap);
      delete out.keptSnap;
      r.start = r.start || 'by the story chain';
      r.ok = r.ok || /ending is chosen/.test(r.why || '');
      if (/ending is chosen/.test(r.why || '')) r.why = 'the Seat: see endings';
      r.power = ch().level;
      out.chapters.push(r);
      continue;
    }
    const r = await run(id);
    if (id === 'grey_letter') {
      await side('ministry_soundings');
      await side('ministry_bell');
    }
    if (id === 'iron_tide') await side('watch_scraps'); // the war with the Enclave opens it
    if (!r.ok) break;
  }
  // after the end
  simulate(1);
  const maren = talk('maren').text;
  g().ui.closeAll(true);
  const active = Object.entries(ch().quests).filter(([k, q]) => q.state !== 'done' && QUESTS[k] && QUESTS[k].main).map(([k]) => k);
  ch().trackedQuest = null;
  out.after = { focus: focusQuest(ch()), activeMain: active, marker: ACTIONS.questMarker ? ACTIONS.questMarker() : null, maren: maren.slice(0, 160), titles: ch().titles || [], ending: ch().flags.ending, playing: g().state === 'playing' };
  return out;
}
