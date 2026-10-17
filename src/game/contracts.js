// The contract boards (docs/agent/WORLD_LIFE_PLAN.md, task 9; data/contracts.js): a board
// beside each faction's officer posts three contracts, turned over each day of play. Take up to
// BOARD.held; do the work in the world, where the world's own events count it (a camp cleared,
// a convoy seen in, a sounding watched, a checkpoint broken, a lost thing found); then bring
// the supplies or the thing found to the board, and collect your pay there.
//
// The contracts a character holds live in ch.lifeContracts, checked and repaired at the start
// of play (a save with bad values still loads). Each player keeps their own on LAN: a guest's
// share of a convoy or a sounding reaches them through game/worldLife.js's 'wevr'.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS, START_HOOKS, BOOT_HOOKS, KILL_HOOKS } from './hooks.js';
import { CONTRACTS, BOARD } from '../data/contracts.js';
import { FACTIONS, tierOf } from '../data/factions.js';
import { ITEMS } from '../data/items.js';
import { addRep, atWar, ensureStanding } from './factions.js';
import { openPanel } from '../ui/panel.js';
import { boardSpot, buildContractBoards } from '../world/contractBoards.js';
import { lifeProp, releaseLifeProp } from '../world/lifeProps.js';

export const CONTRACT = {};
for (const [f, list] of Object.entries(CONTRACTS)) for (const c of list) CONTRACT[c.id] = { ...c, f };

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const count = (c) => (c.kind === 'clear' ? c.count : c.kind === 'supply' ? c.count : 1);

// ---------------------------------------------------------------- state
// ch.lifeContracts = { held: [{ id, n, ready, got }], done: { id: day } }, repaired in place.
export function contractState(ch) {
  let s = ch.lifeContracts;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
  const seen = new Set();
  s.held = (Array.isArray(s.held) ? s.held : []).filter((h) => {
    if (!h || typeof h !== 'object' || !CONTRACT[h.id] || seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  }).slice(0, BOARD.held).map((h) => {
    const c = CONTRACT[h.id];
    const n = Number.isFinite(h.n) ? Math.max(0, Math.min(count(c), Math.floor(h.n))) : 0;
    return { id: h.id, n, ready: h.ready === true, got: h.got === true };
  });
  const done = {};
  if (s.done && typeof s.done === 'object') for (const [id, d] of Object.entries(s.done)) if (CONTRACT[id] && Number.isFinite(d)) done[id] = d;
  s.done = done;
  ch.lifeContracts = s;
  return s;
}

export const dayOf = (ch) => Math.floor((ch?.stats?.playtime || 0) / BOARD.day);

// A board is open to anyone in good enough standing with its faction, not marked by it and not
// at war with it.
export function boardClosed(ch, f) {
  ensureStanding(ch);
  if (atWar(ch, f)) return `${FACTIONS[f].name} post no work for an enemy.`;
  if ((ch.wanted[f] || 0) > 0) return 'Your name is on their list. Settle it before you look for their work.';
  if (ch.rep[f] < -9) return `${FACTIONS[f].name} have no work for one they ${tierOf(ch.rep[f]).name === 'Hated' ? 'hate' : 'distrust'}.`;
  return null;
}

function available(ch, c) {
  if (c.kind === 'war') return c.f !== 'enclave' && atWar(ch, 'enclave');
  return true;
}

// The day's offers on a faction's board: the same three all day, none already held or already
// done today. Picked by a hash of the day, so a reload shows the same board.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function offersFor(ch, f) {
  const s = contractState(ch), day = dayOf(ch);
  return CONTRACTS[f]
    .map((c) => CONTRACT[c.id])
    .filter((c) => available(ch, c) && !s.held.some((h) => h.id === c.id) && s.done[c.id] !== day)
    .sort((a, b) => hash(`${day}:${a.id}`) - hash(`${day}:${b.id}`))
    .slice(0, BOARD.offers);
}

// ---------------------------------------------------------------- taking and paying
export function takeContract(game, id) {
  const ch = game.ch, s = contractState(ch), c = CONTRACT[id];
  if (!c || s.held.some((h) => h.id === id)) return false;
  if (s.held.length >= BOARD.held) {
    G.ui?.toast(`You can hold ${BOARD.held} contracts at once.`, 'bad');
    return false;
  }
  if (boardClosed(ch, c.f) || !offersFor(ch, c.f).some((o) => o.id === id)) return false;
  s.held.push({ id, n: 0, ready: false, got: false });
  G.ui?.toast(`Contract taken: ${c.title}.`, 'quest');
  syncDrops(game);
  return true;
}

export function dropContract(game, id) {
  const s = contractState(game.ch);
  s.held = s.held.filter((h) => h.id !== id);
  syncDrops(game);
}

const have = (ch, item) => ch.inventory?.items?.[item] || 0;

// What handing a held contract in at its board needs, or null if it can't be yet.
export function handInReady(ch, h) {
  const c = CONTRACT[h.id];
  if (c.kind === 'supply') return have(ch, c.item) >= c.count;
  if (c.kind === 'recover') return have(ch, c.item) >= 1;
  return h.ready;
}

export function handIn(game, id) {
  const ch = game.ch, s = contractState(ch);
  const h = s.held.find((q) => q.id === id), c = CONTRACT[id];
  if (!h || !handInReady(ch, h)) return false;
  if (c.kind === 'supply' || c.kind === 'recover') {
    const items = ch.inventory.items;
    items[c.item] -= c.kind === 'supply' ? c.count : 1;
    if (items[c.item] <= 0) delete items[c.item];
  }
  s.held = s.held.filter((q) => q.id !== id);
  s.done[id] = dayOf(ch);
  const xp = 40 + 10 * (ch.level || 1);
  G.player?.addSilver?.(c.silver);
  G.player?.addXp?.(xp);
  addRep(ch, c.f, c.rep);
  ch.stats.contracts = (ch.stats.contracts || 0) + 1;
  G.ui?.toast(`${c.title}: paid ${c.silver} silver.`, 'good');
  G.audio?.play('coin');
  syncDrops(game);
  game.save?.();
  return true;
}

function ready(game, h, c) {
  if (h.ready) return;
  h.ready = true;
  G.ui?.toast(`Contract done: ${c.title}. Collect your pay at ${FACTIONS[c.f].short}'s board.`, 'quest');
  game.save?.();
}

// ---------------------------------------------------------------- the work, counted
KILL_HOOKS.push((game, e) => {
  const ch = game.ch;
  if (!ch || !ch.lifeContracts) return;
  for (const h of contractState(ch).held) {
    const c = CONTRACT[h.id];
    if (c.kind !== 'clear' || h.ready || !c.types.includes(e.type)) continue;
    if (Math.hypot(e.pos.x - c.at[0], e.pos.z - c.at[1]) > c.r) continue;
    h.n = Math.min(c.count, h.n + 1);
    if (h.n >= c.count) ready(game, h, c);
    else G.ui?.toast(`${c.title}: ${h.n} of ${c.count}.`);
  }
});

// game/worldLife.js reports the deeds its events saw: a convoy escorted in, a sounding watched,
// a checkpoint's guard put down.
ACTIONS.lifeOutcome = (o) => {
  const game = G.game, ch = game?.ch;
  if (!ch || !o) return;
  for (const h of contractState(ch).held) {
    const c = CONTRACT[h.id];
    if ((o.kind === 'escort' && c.kind === 'escort' && c.f === o.faction)
      || (o.kind === 'witness' && c.kind === 'witness')
      || (o.kind === 'checkpoint' && c.kind === 'war' && c.checkpoint === o.cp)) ready(game, h, c);
  }
};

// ---------------------------------------------------------------- things to recover
// A held recovery that hasn't been picked up lies where it was lost: a bundle in the grass.
const drops = new Map(); // contract id -> { prop, interact }
function syncDrops(game) {
  const ch = game.ch, world = game.world;
  if (!world) return;
  const want = new Set(ch ? contractState(ch).held.filter((h) => CONTRACT[h.id].kind === 'recover' && !h.got && have(ch, CONTRACT[h.id].item) < 1).map((h) => h.id) : []);
  for (const [id, d] of drops) {
    if (want.has(id)) continue;
    releaseLifeProp(d.prop);
    const i = world.interactables.indexOf(d.interact);
    if (i >= 0) world.interactables.splice(i, 1);
    drops.delete(id);
  }
  for (const id of want) {
    if (drops.has(id)) continue;
    const c = CONTRACT[id];
    const [x, z] = c.at;
    const y = world.groundAt(x, z, world.terrain.heightAt(x, z) + 3);
    const prop = lifeProp('bundle', x, y, z, hash(id) % 6);
    const interact = world.addInteract({
      id: 'contract_' + id, kind: 'contract_item', pos: new THREE.Vector3(x, y + 0.5, z), radius: 2.2,
      label: `Pick up the ${ITEMS[c.item]?.name || c.item}`,
      use: () => {
        const h = contractState(game.ch).held.find((q) => q.id === id);
        if (!h) return;
        h.got = true;
        game.giveItem(c.item, 1);
        G.audio?.play('chest', { pos: new THREE.Vector3(x, y, z), vol: 0.5 });
        G.ui?.toast(`${c.title}: bring it to ${FACTIONS[c.f].short}'s board.`, 'quest');
        syncDrops(game);
      },
    });
    drops.set(id, { prop, interact });
  }
}

// ---------------------------------------------------------------- the boards
export const BOARDS = []; // [{ faction, x, y, z, yaw }]
BOOT_HOOKS.push((game) => {
  BOARDS.length = 0;
  for (const [f, def] of Object.entries(FACTIONS)) {
    const officer = (game.npcs || []).find((n) => n.def?.id === def.officer || n.id === def.officer);
    if (!officer) continue;
    const spot = boardSpot(game.world, officer);
    if (!spot) continue;
    BOARDS.push({ faction: f, color: def.color, ...spot });
    game.world.addInteract({
      id: 'contracts_' + f, kind: 'contract_board', pos: new THREE.Vector3(spot.x, spot.y + 1.2, spot.z), radius: 2.4,
      label: `Read ${FACTIONS[f].short}'s contract board`,
      use: () => ACTIONS.openContracts(f),
    });
  }
  buildContractBoards(game.world, BOARDS);
});

START_HOOKS.push((game) => {
  if (game.ch) contractState(game.ch);
  syncDrops(game);
});

function progressText(ch, h) {
  const c = CONTRACT[h.id];
  if (h.ready) return 'Done: collect your pay.';
  if (c.kind === 'clear') return `${h.n} of ${c.count} put down.`;
  if (c.kind === 'supply') return `You carry ${Math.min(have(ch, c.item), c.count)} of ${c.count} ${ITEMS[c.item]?.name || c.item}.`;
  if (c.kind === 'recover') return have(ch, c.item) ? 'You have it: hand it over.' : 'Not found yet.';
  if (c.kind === 'escort') return 'Walk with one of their convoys until it is in.';
  if (c.kind === 'witness') return 'Watch a sounding from start to end, at a distance.';
  if (c.kind === 'war') return 'Its guard still stands.';
  return '';
}

ACTIONS.openContracts = (f) => {
  const game = G.game, ch = game?.ch;
  if (!ch || !FACTIONS[f]) return;
  const fac = FACTIONS[f];
  openPanel(G.ui, 'contracts', {
    width: 660,
    render: () => {
      const s = contractState(ch), closed = boardClosed(ch, f);
      const left = BOARD.day - ((ch.stats.playtime || 0) % BOARD.day);
      const offers = closed ? [] : offersFor(ch, f);
      const held = s.held.map((h) => [h, CONTRACT[h.id]]);
      const row = (c, right) => `<div class="shop-row"><div class="ico" style="color:${fac.color}">✦</div><div style="flex:1"><div class="nm">${esc(c.title)}</div>
        <div class="ds">${esc(c.text)}</div><div class="ds">${c.silver} silver · +${c.rep} standing${c.f !== f ? ` with ${FACTIONS[c.f].short}` : ''}</div></div>${right}</div>`;
      return `<h2>${esc(fac.name.toUpperCase())} · CONTRACTS</h2>
        <p class="muted" style="text-align:center;margin-top:0">Your standing: <b style="color:${tierOf(ch.rep[f]).color}">${tierOf(ch.rep[f]).name}</b>. New postings in ${Math.ceil(left / 60)} min. You may hold ${BOARD.held}.</p>
        ${closed ? `<p class="muted" style="text-align:center">${esc(closed)}</p>` : `<div class="shop-list">${offers.length ? offers.map((c) => row(c, `<button class="btn small primary" data-take="${c.id}" ${s.held.length >= BOARD.held ? 'disabled' : ''}>Take</button>`)).join('') : '<p class="muted" style="text-align:center">Nothing more posted today.</p>'}</div>`}
        ${held.length ? `<div class="divider"></div><h3>Yours</h3><div class="shop-list">${held.map(([h, c]) => row(c, `<div class="ds" style="width:150px">${esc(progressText(ch, h))}</div>${c.f === f && handInReady(ch, h) ? `<button class="btn small primary" data-in="${c.id}">${h.ready ? 'Collect' : 'Hand over'}</button>` : `<button class="btn small" data-drop="${c.id}">Give up</button>`}`)).join('')}</div>` : ''}
        <div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`;
    },
    onClick: (e, rerender) => {
      const t = e.target.closest('[data-take],[data-in],[data-drop]');
      if (!t) return;
      if (t.dataset.take) takeContract(game, t.dataset.take);
      else if (t.dataset.in) handIn(game, t.dataset.in);
      else if (t.dataset.drop) dropContract(game, t.dataset.drop);
      rerender();
    },
  });
};

// Held work on the map: where to clear, where a lost thing lies, and the boards. Wrapped at boot,
// after game/markers.js has set the base list (it is imported after this module).
let markersWrapped = false;
BOOT_HOOKS.push(() => {
  if (markersWrapped) return;
  markersWrapped = true;
  const prev = ACTIONS.mapMarkers;
  ACTIONS.mapMarkers = (region) => contractMarkers(prev ? prev(region) : []);
});
function contractMarkers(out) {
  const ch = G.game?.ch;
  for (const h of ch && ch.lifeContracts ? contractState(ch).held : []) {
    const c = CONTRACT[h.id];
    if (!c.at || h.ready || (c.kind === 'recover' && h.got)) continue;
    out.push({ x: c.at[0], z: c.at[1], icon: '✦', label: c.title, color: FACTIONS[c.f].color, size: 14 });
  }
  for (const b of BOARDS) out.push({ x: b.x, z: b.z, icon: '▤', label: `${FACTIONS[b.faction].short}'s contract board`, color: FACTIONS[b.faction].color, size: 12 });
  return out;
}
