// Loot you choose: chests open into a panel where you take what you want (what you leave stays,
// for this character), and anything you carry that may leave you can be dropped as a pouch on
// the ground that anyone can search; a pouch with nothing left in it is gone. Dying leaves part
// of what you carry in a pouch where you fell (data/loot.js). No item models: a pouch is a pouch.
//
// In LAN co-op the host owns the pouches, as it owns enemies: a guest asks the host to drop or to
// take, the host decides and tells everyone (messages pdrop, ptake, pgive, pset, pgone, preq,
// plist through G.netHandlers). Pouches of the world you play in are saved with that world's
// character (ch.pouches); a guest sees the host's.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS, BOOT_HOOKS, START_HOOKS, UPDATE_HOOKS } from './hooks.js';
import { LOOT, paid } from '../data/loot.js';
import { RARITY_COLORS } from '../data/weapons.js';
import { emptyContents, cleanContents, contentsEmpty, entriesOf, takeEntry, addContents, carried, takeFromInventory, deathShare, newUid } from '../core/contents.js';
import { openPanel } from '../ui/panel.js';
import { escapeHtml, rand } from '../core/util.js';
import { mat } from '../world/props.js';

// ---------------------------------------------------------------- giving
export function grant(game, got) {
  const ch = game.ch;
  const p = game.player;
  if (got.silver) {
    p.addSilver(got.silver);
    game.ui.toast(`+ ${got.silver} silver`, 'silver');
  }
  for (const [id, n] of Object.entries(got.items)) game.giveItem(id, n);
  for (const e of entriesOf({ silver: 0, items: {}, weapons: got.weapons, trinkets: got.trinkets })) game.ui.toast(`+ ${e.name}`, 'loot');
  ch.inventory.weapons.push(...got.weapons);
  (ch.trinkets ||= []).push(...got.trinkets);
  game.ui.refreshHotbar();
  p.recompute && p.recompute();
}

// ---------------------------------------------------------------- the loot panel
// source: { id, title, note, contents(), take(key, n) -> Promise|bool }. Rows to take one at a
// time, a stack whole, or everything; it redraws when the container changes (another player
// took something).
let openSource = null;
let panelRef = null;
export function openLoot(game, source) {
  openSource = source;
  const ui = game.ui;
  const render = () => {
    const c = source.contents();
    const rows = entriesOf(c).map((e) => `<div class="shop-row loot-row"><div style="flex:1"><div class="nm" ${e.rarity ? `style="color:${RARITY_COLORS[e.rarity]}"` : ''}>${escapeHtml(e.name)}${e.n > 1 && e.kind !== 'silver' ? ` <span class="muted">×${e.n}</span>` : ''}${e.kind === 'silver' ? ` <span class="gold">${e.n}</span>` : ''}</div>${e.desc ? `<div class="ds">${escapeHtml(e.desc)}</div>` : ''}</div>
      ${e.n > 1 && e.kind === 'item' ? `<button class="btn small" data-take="${e.key}" data-n="1">Take 1</button>` : ''}<button class="btn small primary" data-take="${e.key}">Take${e.n > 1 && e.kind === 'item' ? ' all' : ''}</button></div>`).join('');
    return `<h2>${escapeHtml(source.title)}</h2>${source.note ? `<p class="muted" style="text-align:center;margin-top:0">${source.note}</p>` : ''}
      <div class="shop-list scroll">${rows || '<div class="muted" style="text-align:center">Nothing is left.</div>'}</div>
      <div class="divider"></div><div class="row-flex"><span class="muted" style="font-size:13px">Take what you want; what you leave stays.</span><span class="space"></span><button class="btn" data-a="close">Leave it</button><button class="btn primary" data-take-all="1" ${rows ? '' : 'disabled'}>Take everything</button></div>`;
  };
  const panel = openPanel(ui, 'loot', {
    width: 620,
    render,
    onClose: () => {
      if (openSource === source) openSource = null;
    },
    onClick: async (e, rerender) => {
      const b = e.target.closest('[data-take],[data-take-all]');
      if (!b) return;
      G.audio.play('ui');
      // a local container answers at once; a guest waits for the host on each take
      const take = (key, n) => {
        const r = source.take(key, n);
        return r && r.then ? r : null;
      };
      if (b.dataset.takeAll) {
        for (const en of entriesOf(source.contents())) {
          const wait = take(en.key);
          if (wait) await wait;
        }
      } else {
        const wait = take(b.dataset.take, b.dataset.n ? Number(b.dataset.n) : undefined);
        if (wait) await wait;
      }
      if (contentsEmpty(source.contents())) return ui.closeModal();
      rerender();
    },
  });
  panelRef = panel;
  if (ACTIONS.tip) ACTIONS.tip('loot');
  return panel;
}
function redrawIf(id) {
  if (openSource && openSource.id === id && panelRef && panelRef.isOpen()) {
    if (contentsEmpty(openSource.contents())) G.ui.closeModal();
    else panelRef.rerender();
  }
}

// ---------------------------------------------------------------- chests
const chestLeft = (ch, id) => !!(ch && ch.chestLoot && ch.chestLoot[id] && !contentsEmpty(ch.chestLoot[id]));

ACTIONS.openChestLoot = (chest) => {
  const game = G.game;
  const ch = game.ch;
  const id = chest.def.id;
  ch.chestLoot ||= {};
  if (!chest.opened) {
    // the first opening rolls what is inside, once; it stays as you left it
    const loot = chest.def.loot || {};
    const c = emptyContents();
    if (loot.silver) c.silver = paid(rand(loot.silver[0], loot.silver[1]) * game.player.derived.silverMul, 'chest');
    for (const [it, n] of loot.items || []) c.items[it] = (c.items[it] || 0) + n;
    if (loot.weapon) c.weapons.push({ uid: newUid('w'), id: loot.weapon, enchant: null });
    ch.chestLoot[id] = cleanContents(c);
    game.world.setChestOpened(id, true);
    if (!ch.chestsOpened.includes(id)) ch.chestsOpened.push(id);
    game.audio.play('chest', { pos: chest.mesh.position });
    game.vfx.burst(chest.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 'phys', 30, { color: '#ffd27a', speed: 5, up: 3 });
    game.save();
  }
  if (!chestLeft(ch, id)) {
    delete ch.chestLoot[id];
    game.ui.toast('The chest is empty.');
    return;
  }
  openLoot(game, {
    id: `chest:${id}`,
    title: 'CHEST',
    contents: () => ch.chestLoot[id] || emptyContents(),
    take: (key, n) => {
      const c = ch.chestLoot[id];
      const got = c && takeEntry(c, key, n);
      if (!got) return false;
      grant(game, got);
      if (contentsEmpty(c)) delete ch.chestLoot[id];
      game.save();
      return true;
    },
  });
};

// A chest stays searchable while something is left in it: the world's own check (unopened) is
// widened before any other system wraps it.
BOOT_HOOKS.push((game) => {
  for (const it of game.world.interactables) {
    if (it.kind !== 'chest' || !it.chest) continue;
    const chest = it.chest;
    it.enabled = () => !chest.opened || chestLeft(G.game && G.game.ch, chest.def.id);
    Object.defineProperty(it, 'label', { configurable: true, get: () => (chest.opened ? 'Search Chest' : 'Open Chest') });
  }
});

// ---------------------------------------------------------------- pouches in the world
const shown = new Map(); // id -> { data, group, it }
const remote = new Map(); // the host's pouches, while we are its guest
let pouchGeo = null;
let wasGuest = false;

BOOT_HOOKS.push(() => {
  // a leather sack with a pale cord: the keepsake chest's materials, compiled at boot
  const body = new THREE.IcosahedronGeometry(0.24, 1);
  body.scale(1, 0.72, 1);
  body.translate(0, 0.17, 0);
  const neck = new THREE.CylinderGeometry(0.06, 0.1, 0.12, 8);
  neck.translate(0, 0.38, 0);
  const cord = new THREE.TorusGeometry(0.075, 0.018, 5, 12);
  cord.rotateX(Math.PI / 2);
  cord.translate(0, 0.35, 0);
  pouchGeo = { body, neck, cord, leather: mat('#4e3a2a'), pale: mat('#d8d0bc') };
});

const isGuest = () => !!(G.net && G.net.isGuest && G.net.status === 'online');
const visible = () => (isGuest() ? [...remote.values()] : (G.game && G.game.ch && G.game.ch.pouches) || []);
const pouchById = (id) => (isGuest() ? remote.get(id) : ((G.game && G.game.ch && G.game.ch.pouches) || []).find((p) => p.id === id));

function showPouch(data) {
  const game = G.game;
  if (!game || !pouchGeo) return;
  const cur = shown.get(data.id);
  if (cur) {
    cur.data = data;
    return;
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(pouchGeo.body, pouchGeo.leather), new THREE.Mesh(pouchGeo.neck, pouchGeo.leather), new THREE.Mesh(pouchGeo.cord, pouchGeo.pale));
  for (const m of g.children) m.castShadow = true;
  g.position.set(data.x, data.y, data.z);
  g.rotation.y = (data.x * 7.31 + data.z * 3.17) % (Math.PI * 2);
  g.userData.dynamic = true;
  game.scene.add(g);
  const entry = { data, group: g, it: null };
  entry.it = game.world.addInteract({
    id: `pouch_${data.id}`, kind: 'pouch', pos: new THREE.Vector3(data.x, data.y + 0.4, data.z), radius: LOOT.pouchReach,
    get label() {
      const d = entry.data;
      return d.kind === 'lost' ? (d.by === (G.game.ch && G.game.ch.name) ? 'Search your lost pouch' : `Search what ${d.by} lost`) : `Search ${d.by ? d.by + "'s" : 'the'} pouch`;
    },
    use: () => openPouch(data.id),
  });
  shown.set(data.id, entry);
}
function hidePouch(id) {
  const e = shown.get(id);
  if (!e) return;
  G.game.scene.remove(e.group);
  const list = G.game.world.interactables;
  const i = list.indexOf(e.it);
  if (i >= 0) list.splice(i, 1);
  shown.delete(id);
}
function syncPouches() {
  const want = new Set(visible().map((p) => p.id));
  for (const id of [...shown.keys()]) if (!want.has(id)) hidePouch(id);
  for (const p of visible()) showPouch(p);
}

function openPouch(id) {
  const game = G.game;
  const d = pouchById(id);
  if (!d || contentsEmpty(d.contents)) return game.ui.toast('Nothing is left in it.');
  const mine = d.by === game.ch.name;
  openLoot(game, {
    id: `pouch:${id}`,
    title: d.kind === 'lost' ? (mine ? 'WHAT YOU LOST' : `WHAT ${String(d.by || 'someone').toUpperCase()} LOST`) : 'POUCH',
    note: d.kind === 'lost' && mine ? 'Left where you fell.' : d.by && !mine ? `Left by ${escapeHtml(d.by)}.` : '',
    contents: () => (pouchById(id) || {}).contents || emptyContents(),
    take: (key, n) => takePouch(id, key, n),
  });
}

// ---------------------------------------------------------------- dropping and taking (the authority)
function save() {
  G.game && G.game.save();
}
function broadcast(msg) {
  if (G.net && G.net.isHost) G.net.send(msg);
}
// Make a pouch in the world we own (single player, or as host).
function placePouch(data) {
  const ch = G.game.ch;
  ch.pouches ||= [];
  const p = { id: newUid('p'), x: data.x, y: data.y, z: data.z, contents: cleanContents(data.contents), by: data.by || '', kind: data.kind === 'lost' ? 'lost' : 'pouch', at: Date.now() };
  if (contentsEmpty(p.contents)) return null;
  ch.pouches.push(p);
  showPouch(p);
  broadcast({ t: 'pset', p });
  save();
  return p;
}
function takeOwned(id, key, n) {
  const ch = G.game.ch;
  const list = ch.pouches || [];
  const p = list.find((x) => x.id === id);
  const got = p && takeEntry(p.contents, key, n);
  if (!got) return null;
  if (contentsEmpty(p.contents)) {
    list.splice(list.indexOf(p), 1);
    hidePouch(id);
    broadcast({ t: 'pgone', id });
  } else broadcast({ t: 'pset', p });
  save();
  redrawIf(`pouch:${id}`);
  return got;
}

// Where a pouch would come to rest at a point, or null over deep water or the Abyss.
export function restingPlace(world, x, y, z) {
  const ground = world.groundAt(x, z, y + 1.5);
  if (!Number.isFinite(ground) || ground < y - 30) return null; // nothing under you: the Abyss
  if (!world.inRift(x) && ground < -1.2) return null; // the sea floor: it sinks
  return { x, y: ground, z };
}

// Drop contents at the player's feet as a pouch.
export function dropPouch(contents, kind = 'pouch') {
  const game = G.game;
  const p = game.player;
  const at = restingPlace(game.world, p.pos.x, p.pos.y, p.pos.z);
  if (!at) return { lost: true };
  const data = { ...at, contents, by: game.ch.name, kind };
  if (isGuest()) {
    G.net.send({ t: 'pdrop', to: G.net.hostId, p: data });
    return { sent: true };
  }
  return { pouch: placePouch(data) };
}

async function takePouch(id, key, n) {
  const game = G.game;
  if (!isGuest()) {
    const got = takeOwned(id, key, n);
    if (got) grant(game, got);
    return !!got;
  }
  // ask the host, and wait for its answer (or give up after a moment)
  const ask = (pendingTake = { id, key, done: null });
  const reply = new Promise((resolve) => (ask.done = resolve));
  G.net.send({ t: 'ptake', to: G.net.hostId, id, key, n: n ?? null });
  const got = await Promise.race([reply, new Promise((r) => setTimeout(() => r(null), 2500))]);
  if (pendingTake === ask) pendingTake = null;
  if (got) grant(game, got);
  return !!got;
}
let pendingTake = null;

// ---------------------------------------------------------------- the network
const H = (G.netHandlers ||= {});
H.pdrop = (m, net) => {
  if (!net.isHost || !G.game || !G.game.ch || !m.p) return;
  placePouch({ ...m.p, x: +m.p.x, y: +m.p.y, z: +m.p.z });
};
H.ptake = (m, net) => {
  if (!net.isHost || !G.game || !G.game.ch) return;
  const got = takeOwned(m.id, m.key, m.n == null ? Infinity : m.n);
  net.send({ t: 'pgive', to: m.from, id: m.id, got: got || null });
};
H.preq = (m, net) => {
  if (!net.isHost || !G.game || !G.game.ch) return;
  net.send({ t: 'plist', to: m.from, list: G.game.ch.pouches || [] });
};
H.pgive = (m, net) => {
  if (m.from !== net.hostId || !pendingTake || pendingTake.id !== m.id) return;
  pendingTake.done(m.got ? cleanContents(m.got) : null);
};
H.pset = (m, net) => {
  if (m.from !== net.hostId || !m.p) return;
  remote.set(m.p.id, { ...m.p, contents: cleanContents(m.p.contents) });
  if (isGuest()) {
    showPouch(remote.get(m.p.id));
    redrawIf(`pouch:${m.p.id}`);
  }
};
H.pgone = (m, net) => {
  if (m.from !== net.hostId) return;
  remote.delete(m.id);
  if (isGuest()) {
    hidePouch(m.id);
    redrawIf(`pouch:${m.id}`);
  }
};
H.plist = (m, net) => {
  if (m.from !== net.hostId) return;
  remote.clear();
  for (const p of m.list || []) if (p && p.id) remote.set(p.id, { ...p, contents: cleanContents(p.contents) });
  syncPouches();
};

// Joining someone's world swaps their pouches in; leaving brings our own back.
UPDATE_HOOKS.push(() => {
  const g = isGuest();
  if (g === wasGuest) return;
  wasGuest = g;
  remote.clear();
  if (g) G.net.send({ t: 'preq', to: G.net.hostId });
  syncPouches();
});

START_HOOKS.push((game, ch) => {
  ch.pouches = (Array.isArray(ch.pouches) ? ch.pouches : []).filter((p) => p && p.id && Number.isFinite(p.x) && Number.isFinite(p.z)).map((p) => ({ ...p, y: Number.isFinite(p.y) ? p.y : game.world.groundAt(p.x, p.z, 400), contents: cleanContents(p.contents) })).filter((p) => !contentsEmpty(p.contents));
  remote.clear();
  wasGuest = false;
  syncPouches();
});

// ---------------------------------------------------------------- dying
// What you carry in part stays where you fell (data/loot.js LOOT.death).
ACTIONS.dropOnDeath = (game = G.game) => {
  const ch = game && game.ch;
  const p = game && game.player;
  if (!ch || !p || !p.pos || !game.world || !game.world.groundAt) return null;
  const at = restingPlace(game.world, p.pos.x, p.pos.y, p.pos.z);
  const { contents } = takeFromInventory(ch, deathShare(ch));
  if (contentsEmpty(contents)) return null;
  game.ui.refreshHotbar();
  if (!at) {
    game.ui.toast(game.world.inRift(p.pos.x) ? 'What you dropped fell into the dark.' : 'The sea takes what you dropped.', 'bad');
    return { lost: contents };
  }
  const r = dropPouch(contents, 'lost');
  if (ACTIONS.tip) ACTIONS.tip('lostPouch');
  game.ui.toast(`Some of what you carried lies where you fell (${entriesOf(contents).length} thing${entriesOf(contents).length === 1 ? '' : 's'}).`, 'bad');
  return r;
};

// ---------------------------------------------------------------- the drop panel
// From the inventory: pick what to leave, and leave it as one pouch at your feet.
ACTIONS.openDropPanel = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  const picks = new Map(); // key -> n
  const render = () => {
    const rows = carried(ch).map((e) => {
      const n = picks.get(e.key) || 0;
      const qty = e.kind === 'item' || e.kind === 'silver';
      return `<div class="shop-row loot-row ${e.keep ? 'kept' : ''}"><div style="flex:1"><div class="nm" ${e.rarity ? `style="color:${RARITY_COLORS[e.rarity]}"` : ''}>${escapeHtml(e.name)} <span class="muted">${e.kind === 'silver' ? e.n : e.n > 1 ? '×' + e.n : ''}</span></div>${e.keep ? `<div class="ds">${escapeHtml(e.keep)}</div>` : ''}</div>
        ${e.keep ? '' : qty ? `<button class="btn small" data-less="${e.key}" ${n ? '' : 'disabled'}>−</button><span class="loot-n">${n}</span><button class="btn small" data-more="${e.key}" ${n < e.n ? '' : 'disabled'}>+</button><button class="btn small" data-all="${e.key}">All</button>` : `<button class="btn small ${n ? 'primary' : ''}" data-pick="${e.key}">${n ? '✓ Leave it' : 'Leave it'}</button>`}</div>`;
    }).join('');
    const total = [...picks.values()].filter(Boolean).length;
    return `<h2>LEAVE A POUCH</h2><p class="muted" style="text-align:center;margin-top:0">What you choose goes into a pouch at your feet. Anyone who finds it can take from it; when it's empty it's gone.</p>
      <div class="shop-list scroll">${rows || '<div class="muted">You carry nothing you could leave.</div>'}</div>
      <div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Keep it all</button><button class="btn primary" data-leave="1" ${total ? '' : 'disabled title="Choose something to leave"'}>Leave the pouch${total ? ` (${total})` : ''}</button></div>`;
  };
  const amount = (key) => (carried(ch).find((e) => e.key === key) || { n: 0 }).n;
  openPanel(ui, 'droppouch', {
    width: 620,
    render,
    onClick: (e, rerender) => {
      const t = e.target.closest('[data-less],[data-more],[data-all],[data-pick],[data-leave]');
      if (!t) return;
      G.audio.play('ui');
      const k = t.dataset.less || t.dataset.more || t.dataset.all || t.dataset.pick;
      if (t.dataset.less) picks.set(k, Math.max(0, (picks.get(k) || 0) - (k === 'silver' ? 10 : 1)));
      if (t.dataset.more) picks.set(k, Math.min(amount(k), (picks.get(k) || 0) + (k === 'silver' ? 10 : 1)));
      if (t.dataset.all) picks.set(k, amount(k));
      if (t.dataset.pick) picks.set(k, picks.get(k) ? 0 : 1);
      if (t.dataset.leave) {
        if (game.player.boat) return ui.toast('Step off the boat first.', 'bad');
        const at = restingPlace(game.world, game.player.pos.x, game.player.pos.y, game.player.pos.z);
        if (!at) return ui.toast("It would sink. Leave it on dry ground.", 'bad');
        const list = [...picks.entries()].filter(([, n]) => n > 0).map(([key, n]) => ({ key, n }));
        const { contents, refused } = takeFromInventory(ch, list);
        if (refused.length) ui.toast(refused[0], 'bad');
        if (contentsEmpty(contents)) return;
        dropPouch(contents, 'pouch');
        ui.refreshHotbar();
        game.player.recompute && game.player.recompute();
        G.audio.play('chest', { vol: 0.4 });
        ui.toast('You leave a pouch on the ground.', 'good');
        ui.closeModal();
        return;
      }
      rerender();
    },
  });
};

// ---------------------------------------------------------------- the map
// Wrapped at boot, once every system has set its own: markers.js is imported after this file and
// replaces ACTIONS.mapMarkers outright.
let markersWrapped = false;
BOOT_HOOKS.push(() => {
  if (markersWrapped) return;
  markersWrapped = true;
  const prevMarkers = ACTIONS.mapMarkers;
  ACTIONS.mapMarkers = (region) => {
    const out = prevMarkers ? prevMarkers(region) || [] : [];
    const ch = G.game && G.game.ch;
    if (!ch) return out;
    for (const p of visible()) {
      if (p.by !== ch.name) continue;
      if (!!(region && region.rift) !== (p.x > 3000)) continue;
      out.push({ x: p.x, z: p.z, icon: p.kind === 'lost' ? '✕' : '◍', color: p.kind === 'lost' ? '#e07a5a' : '#d6c496', label: p.kind === 'lost' ? 'What you lost' : 'Your pouch', size: 12 });
    }
    return out;
  };
});

export { syncPouches as _syncPouches, shown as _shownPouches, remote as _remotePouches, takeOwned as _takeOwned, placePouch as _placePouch };
void addContents;
