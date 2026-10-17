// The backpack, Deepwoken's way: everything you carry as tiles (weapons, outfits, trinkets,
// supplies, materials, quest items, and the mantras you know), filtered and searched. The pane
// beside the grid shows the tile under the cursor, or the one selected, with what can be done
// with it. Drag a supply or a mantra onto the hotbar strip below (or select it and click a key)
// to put it on that key. Opened by the character menu's Backpack tab.
import { G } from '../core/globals.js';
import { ATTRS, ELEMENTS, meetsReqs, reqsText } from '../data/stats.js';
import { MANTRAS, MANTRA_TYPES } from '../data/mantras.js';
import * as Weapons from '../data/weapons.js';
import { OUTFITS, ITEMS } from '../data/items.js';
import { TRINKETS, TRINKET_SLOTS } from '../data/trinkets.js';
import { modsText, trinketName, trinketLines, wearTrinket, takeOffTrinket } from '../game/gear.js';
import { escapeHtml } from '../core/util.js';
import { fitLabels } from './fitText.js';

const { WEAPONS, WEAPON_CLASSES, ENCHANTS, RARITY_COLORS, weaponDisplayName } = Weapons;

export const CATS = [
  ['all', 'All'],
  ['weapons', 'Weapons'],
  ['gear', 'Gear'],
  ['supplies', 'Supplies'],
  ['materials', 'Materials'],
  ['mantras', 'Mantras'],
  ['quest', 'Quest'],
];
const ITEM_CAT = { food: 'supplies', drink: 'supplies', potion: 'supplies', tool: 'supplies', special: 'supplies', material: 'materials', quest: 'quest' };
const usableItem = (it) => !!it && !['material', 'quest'].includes(it.type);
// a tile's picture by weapon class, so a pack of weapons reads at a glance
const CLASS_ICON = { fist: '🥊', dagger: '🗡️', sword: '⚔️', rapier: '🤺', katana: '🗡️', spear: '🔱', greatsword: '⚔️', greataxe: '🪓', hammer: '🔨', scythe: '🌙', club: '🏏', lance: '🏹' };
const weaponIcon = (w) => CLASS_ICON[w.cls] || '🗡️';

// what the backpack remembers between openings: the filter, the search, the selected tile
export const view = { filter: 'all', q: '', sel: null, hover: null };

// ---------------------------------------------------------------- what you carry
// Every tile: { key, cat, icon, name, color, n, eq, hot, hotEntry }
export function entries(p, ch) {
  const out = [];
  const hotOf = (e) => (e ? ch.hotbar.findIndex((h, i) => i > 0 && h && h.type === e.type && h.id === e.id) : -1);
  const eqW = p.weaponItem && p.weaponItem() ? ch.equipped.weapon : null;
  for (const it of ch.inventory.weapons) {
    const w = WEAPONS[it.id];
    if (!w) continue;
    out.push({ key: `w:${it.uid}`, cat: 'weapons', icon: weaponIcon(w), name: weaponDisplayName(it), color: RARITY_COLORS[w.rarity], n: 1, eq: eqW === it.uid, hot: -1 });
  }
  for (const id of ch.inventory.outfits) {
    const o = OUTFITS[id];
    if (o) out.push({ key: `o:${id}`, cat: 'gear', icon: '🧥', name: o.name, color: RARITY_COLORS[o.rarity], n: 1, eq: ch.equipped.outfit === id, hot: -1 });
  }
  const worn = new Set(Object.values(ch.gear || {}));
  for (const t of ch.trinkets || []) {
    const d = TRINKETS[t.id];
    if (d) out.push({ key: `t:${t.uid}`, cat: 'gear', icon: (TRINKET_SLOTS[d.slot] || {}).icon || '💍', name: trinketName(t), color: RARITY_COLORS[d.rarity], n: 1, eq: worn.has(t.uid), hot: -1 });
  }
  for (const [id, n] of Object.entries(ch.inventory.items)) {
    const it = ITEMS[id];
    if (!it || !n) continue;
    const hotEntry = usableItem(it) ? { type: 'item', id } : null;
    out.push({ key: `i:${id}`, cat: ITEM_CAT[it.type] || 'supplies', icon: it.icon || '•', name: it.name, color: RARITY_COLORS.common, n, eq: false, hotEntry, hot: hotOf(hotEntry) });
  }
  for (const id of Object.keys(ch.mantras || {})) {
    const m = MANTRAS[id];
    if (!m) continue;
    const hotEntry = { type: 'mantra', id };
    out.push({ key: `m:${id}`, cat: 'mantras', icon: '✦', name: m.name, color: (ATTRS[m.el] || {}).color || (m.el === 'support' ? '#ffd27a' : '#e9e4d8'), n: 1, eq: false, hotEntry, hot: hotOf(hotEntry) });
  }
  return out;
}

export function visible(list, v = view) {
  const q = v.q.trim().toLowerCase();
  return list.filter((e) => (v.filter === 'all' || e.cat === v.filter) && (!q || e.name.toLowerCase().includes(q)));
}

// Put a supply or a mantra on hotbar key `slot` (1–9; 0 is the weapon), off any other key.
export function assign(ch, entry, slot) {
  if (!entry || !entry.hotEntry || !(slot >= 1 && slot <= 9)) return false;
  const e = entry.hotEntry;
  for (let i = 1; i < 10; i++) if (ch.hotbar[i] && ch.hotbar[i].type === e.type && ch.hotbar[i].id === e.id) ch.hotbar[i] = null;
  ch.hotbar[slot] = { ...e };
  return true;
}

// ---------------------------------------------------------------- drawing
const keyName = (i) => String((i + 1) % 10);

function tile(e) {
  return `<div class="bp-tile ${view.sel === e.key ? 'sel' : ''} ${e.eq ? 'eq' : ''}" data-bp="${e.key}" title="${escapeHtml(e.name)}" ${e.hotEntry ? 'draggable="true"' : ''} style="--r:${e.color}">
    <span class="bp-lbl">${escapeHtml(e.name)}</span>${e.n > 1 ? `<span class="bp-n">${e.n}</span>` : ''}${e.hot > 0 ? `<span class="bp-key">${keyName(e.hot)}</span>` : ''}${e.eq ? '<span class="bp-eq">E</span>' : ''}</div>`;
}

export function gridHtml(p, ch) {
  const list = visible(entries(p, ch));
  return list.length ? list.map(tile).join('') : `<div class="muted bp-empty">${view.q ? 'Nothing you carry by that name.' : 'Nothing of that kind.'}</div>`;
}

function weaponLines(ch, it) {
  const w = WEAPONS[it.id];
  const cls = WEAPON_CLASSES[w.cls];
  const en = it.enchant || w.enchant;
  const lines = [`${cls.label}, ${w.damage} damage, ${w.posture} posture${it.temper ? `, tempered +${it.temper}` : ''}`];
  if (en && ENCHANTS[en]) lines.push(`<span style="color:${ENCHANTS[en].color}">${ENCHANTS[en].name}</span>`);
  // the systems session's handling line, when that build has it
  const feel = typeof Weapons.weaponFeelText === 'function' ? Weapons.weaponFeelText(w) : '';
  if (feel) lines.push(`<span class="muted">${escapeHtml(feel)}</span>`);
  if (w.reqs) lines.push(`<span class="${meetsReqs(w.reqs, ch.attrs) ? 'muted' : 'bad'}">Requires ${reqsText(w.reqs)}</span>`);
  return { sub: `${cls.label}, ${w.rarity}`, desc: w.desc, lines };
}

function itemNumbers(it) {
  const n = [];
  if (it.hunger) n.push(`+${it.hunger} food`);
  if (it.water) n.push(`+${it.water} water`);
  if (it.heal) n.push(`+${it.heal} health`);
  if (it.healPct) n.push(`+${Math.round(it.healPct * 100)}% health`);
  if (it.hot) n.push(`${it.hot} health over time`);
  if (it.sanity) n.push(`+${it.sanity} sanity`);
  if (it.ether) n.push(`+${it.ether} ether`);
  if (it.sell) n.push(`sells for ${it.sell}`);
  return n.join(', ');
}

// The pane: what the tile is and what you can do with it.
export function detailHtml(p, ch, key = view.hover || view.sel) {
  const e = key && entries(p, ch).find((x) => x.key === key);
  if (!e) return wornHtml(p, ch);
  const [kind, id] = [e.key[0], e.key.slice(2)];
  let sub = '';
  let desc = '';
  let lines = [];
  let acts = '';
  if (kind === 'w') {
    const it = ch.inventory.weapons.find((x) => x.uid === id);
    ({ sub, desc, lines } = weaponLines(ch, it));
    const ok = meetsReqs(WEAPONS[it.id].reqs, ch.attrs);
    acts = e.eq ? '<button class="btn small" data-equip-w="">Unequip</button>' : `<button class="btn small primary" data-equip-w="${it.uid}" ${ok ? '' : 'disabled title="Requirements not met"'}>Equip</button>`;
  } else if (kind === 'o') {
    const o = OUTFITS[id];
    const res = Object.entries(o.resist).map(([k, v]) => `${ELEMENTS[k].name} ${Math.round(v * 100)}%`).join(', ');
    sub = `Outfit, ${o.rarity}`;
    desc = o.desc;
    lines = [`${Math.round(o.armor * 100)}% armor${res ? `, ${res}` : ''}`, o.mods ? modsText(o.mods) : '', o.reqs ? `<span class="${meetsReqs(o.reqs, ch.attrs) ? 'muted' : 'bad'}">Requires ${reqsText(o.reqs)}</span>` : ''].filter(Boolean);
    acts = e.eq ? '<span class="muted">Worn</span>' : `<button class="btn small primary" data-equip-o="${id}" ${meetsReqs(o.reqs, ch.attrs) ? '' : 'disabled title="Requirements not met"'}>Wear</button>`;
  } else if (kind === 't') {
    const t = ch.trinkets.find((x) => x.uid === id);
    const d = TRINKETS[t.id];
    sub = `${TRINKET_SLOTS[d.slot].name} trinket, ${d.rarity}`;
    desc = d.desc;
    lines = [...trinketLines(t), d.reqs ? `<span class="${meetsReqs(d.reqs, ch.attrs) ? 'muted' : 'bad'}">Requires ${reqsText(d.reqs)}</span>` : ''].filter(Boolean);
    acts = e.eq ? `<button class="btn small" data-bp-unwear="${d.slot}">Take off</button>` : `<button class="btn small primary" data-bp-wear="${t.uid}" ${meetsReqs(d.reqs, ch.attrs) ? '' : 'disabled title="Requirements not met"'}>Wear</button>`;
  } else if (kind === 'i') {
    const it = ITEMS[id];
    sub = it.type === 'quest' ? 'Quest item' : it.type === 'material' ? 'Material' : it.type[0].toUpperCase() + it.type.slice(1);
    desc = id === 'waterskin' ? `${it.desc} ${ch.waterCharges || 0} sips left.` : it.desc;
    lines = [itemNumbers(it)].filter(Boolean);
    if (usableItem(it)) acts = `<button class="btn small primary" data-use="${id}">Use</button>`;
  } else if (kind === 'm') {
    const m = MANTRAS[id];
    const el = ATTRS[m.el];
    sub = `${el ? el.name : m.el === 'support' ? 'Support' : 'Physical'}, ${MANTRA_TYPES[m.type]}`;
    desc = m.desc;
    lines = [[`${m.ether} ether`, m.hpCost ? `${Math.round(m.hpCost * 100)}% health` : null, `${m.cd} s cooldown`].filter(Boolean).join(', ')];
  }
  const keys = e.hotEntry
    ? `<div class="bp-keys"><span class="muted">Hotbar</span>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<button class="btn small ${e.hot === i ? 'primary' : ''}" data-bp-key="${i}">${keyName(i)}</button>`).join('')}${e.hot > 0 ? '<button class="btn small" data-bp-key="0" title="Take it off the hotbar">✕</button>' : ''}</div>`
    : '';
  return `<div class="bp-head"><div><div class="bp-name" style="color:${e.color}">${escapeHtml(e.name)}${e.n > 1 ? ` <span class="muted">×${e.n}</span>` : ''}</div><div class="bp-sub">${escapeHtml(sub)}</div></div></div>
    ${desc ? `<div class="bp-desc">${escapeHtml(desc)}</div>` : ''}${lines.map((l) => `<div class="bp-line">${l}</div>`).join('')}
    <div class="bp-acts">${acts}</div>${keys}`;
}

// With nothing selected, the pane shows what you have on.
function wornHtml(p, ch) {
  const it = p.weaponItem && p.weaponItem();
  const w = it && WEAPONS[it.id];
  const o = OUTFITS[ch.equipped.outfit];
  const rows = [['Weapon', w ? `<span style="color:${RARITY_COLORS[w.rarity]}">${escapeHtml(weaponDisplayName(it))}</span>` : '<span class="muted">Fists</span>'], ['Outfit', o ? `<span style="color:${RARITY_COLORS[o.rarity]}">${escapeHtml(o.name)}</span>` : '—']];
  for (const [slot, def] of Object.entries(TRINKET_SLOTS)) {
    const t = (ch.trinkets || []).find((x) => x.uid === (ch.gear || {})[slot]);
    rows.push([def.name, t ? `<span style="color:${RARITY_COLORS[TRINKETS[t.id].rarity]}">${escapeHtml(trinketName(t))}</span>` : '<span class="muted">Empty</span>']);
  }
  return `<div class="bp-sub">WORN</div><div class="stat-list bp-worn">${rows.map(([k, v]) => `<span class="k">${k}</span><span>${v}</span>`).join('')}</div>
    <div class="muted bp-hint">Point at a tile to see it; click to choose it. Drag supplies and mantras onto the hotbar below.</div>`;
}

function stripHtml(ch) {
  return [...Array(10).keys()].map((i) => {
    const h = ch.hotbar[i];
    let icon = '';
    let name = '';
    if (i === 0) {
      const it = G.player.weaponItem && G.player.weaponItem();
      icon = it && WEAPONS[it.id] ? weaponIcon(WEAPONS[it.id]) : '🥊';
      name = it ? weaponDisplayName(it) : 'Fists';
    } else if (h && h.type === 'item' && ITEMS[h.id]) {
      icon = ITEMS[h.id].icon || '•';
      name = ITEMS[h.id].name;
    } else if (h && h.type === 'mantra' && MANTRAS[h.id]) {
      icon = '✦';
      name = MANTRAS[h.id].name;
    }
    return `<div class="bp-slot ${i === 0 ? 'fixed' : ''} ${name ? 'full' : ''}" data-bp-slot="${i}" title="${escapeHtml(name || 'Empty')}"><span class="k">${keyName(i)}</span><span class="bp-lbl">${escapeHtml(name)}</span>${name && i > 0 ? `<span class="bp-x" data-bp-clear="${i}">×</span>` : ''}</div>`;
  }).join('');
}

export function renderBackpack(p, ch) {
  return `<div class="bp">
    <div class="row-flex bp-top"><h3 style="margin:0">BACKPACK</h3><input type="search" class="bp-search" data-bp-search placeholder="Search…" value="${escapeHtml(view.q)}"><span class="space"></span><span class="gold" style="font-family:var(--display)">${ch.silver} silver</span><button class="btn small" data-a="pouch" title="Leave things in a pouch on the ground for anyone to take">Leave a pouch here…</button></div>
    <div class="bp-cats">${CATS.map(([id, n]) => `<button class="btn small ${view.filter === id ? 'primary' : ''}" data-bp-cat="${id}">${n}</button>`).join('')}</div>
    <div class="bp-main"><div class="bp-grid">${gridHtml(p, ch)}</div><div class="bp-detail">${detailHtml(p, ch)}</div></div>
    <div class="bp-strip">${stripHtml(ch)}</div>
  </div>`;
}

// ---------------------------------------------------------------- input
// Clicks on the backpack's own controls; true when handled. Equip, wear and use buttons carry the
// character menu's data-equip-w / data-equip-o / data-use and are handled there.
export function backpackClick(ui, e, render) {
  const p = G.player;
  const ch = p.ch;
  const t = e.target;
  const cat = t.closest('[data-bp-cat]');
  if (cat) {
    view.filter = cat.dataset.bpCat;
    G.audio.play('ui');
    render();
    return true;
  }
  const clear = t.closest('[data-bp-clear]');
  if (clear) {
    ch.hotbar[Number(clear.dataset.bpClear)] = null;
    if (p.selected && !ch.hotbar[p.selected]) p.selected = 0;
    ui.refreshHotbar();
    render();
    return true;
  }
  const slot = t.closest('[data-bp-slot]');
  if (slot) {
    const i = Number(slot.dataset.bpSlot);
    const e2 = view.sel && entries(p, ch).find((x) => x.key === view.sel);
    if (e2 && e2.hotEntry) {
      if (assign(ch, e2, i)) {
        G.audio.play('ui', { pitch: 1.2 });
        ui.refreshHotbar();
        render();
      }
    } else {
      // nothing to place: choose what is on that key
      const on = entries(p, ch).find((x) => x.hot === i && i > 0);
      if (on) {
        view.sel = on.key;
        render();
      }
    }
    return true;
  }
  const key = t.closest('[data-bp-key]');
  if (key) {
    const e2 = entries(p, ch).find((x) => x.key === view.sel);
    const n = Number(key.dataset.bpKey);
    if (e2 && n === 0) {
      for (let i = 1; i < 10; i++) if (ch.hotbar[i] && e2.hotEntry && ch.hotbar[i].type === e2.hotEntry.type && ch.hotbar[i].id === e2.hotEntry.id) ch.hotbar[i] = null;
    } else assign(ch, e2, n);
    ui.refreshHotbar();
    render();
    return true;
  }
  const wear = t.closest('[data-bp-wear]');
  if (wear) {
    wearTrinket(G.game, wear.dataset.bpWear);
    render();
    return true;
  }
  const unwear = t.closest('[data-bp-unwear]');
  if (unwear) {
    takeOffTrinket(G.game, unwear.dataset.bpUnwear);
    render();
    return true;
  }
  const tl = t.closest('[data-bp]');
  if (tl) {
    view.sel = view.sel === tl.dataset.bp ? null : tl.dataset.bp;
    view.hover = null;
    G.audio.play('ui');
    render();
    return true;
  }
  return false;
}

// Drag and drop, hover, and the search box: bound once on the character menu's element.
export function bindBackpack(el) {
  const p = () => G.player;
  const redraw = (part) => {
    const box = el.querySelector(part === 'grid' ? '.bp-grid' : '.bp-detail');
    if (box) box.innerHTML = part === 'grid' ? gridHtml(p(), p().ch) : detailHtml(p(), p().ch);
    if (box && part === 'grid') fitLabels(box);
  };
  el.addEventListener('input', (e) => {
    if (!e.target.matches('[data-bp-search]')) return;
    view.q = e.target.value;
    redraw('grid');
  });
  el.addEventListener('mouseover', (e) => {
    const tl = e.target.closest && e.target.closest('.bp-tile');
    const key = tl ? tl.dataset.bp : null;
    if (key === view.hover) return;
    if (!key && !e.target.closest('.bp-detail') && view.hover) {
      view.hover = null;
      redraw('detail');
    } else if (key) {
      view.hover = key;
      redraw('detail');
    }
  });
  el.addEventListener('dragstart', (e) => {
    const tl = e.target.closest && e.target.closest('.bp-tile');
    if (!tl) return;
    e.dataTransfer.setData('text/plain', tl.dataset.bp);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', (e) => {
    const s = e.target.closest && e.target.closest('.bp-slot:not(.fixed)');
    if (!s) return;
    e.preventDefault();
    s.classList.add('over');
  });
  el.addEventListener('dragleave', (e) => {
    const s = e.target.closest && e.target.closest('.bp-slot');
    if (s) s.classList.remove('over');
  });
  el.addEventListener('drop', (e) => {
    const s = e.target.closest && e.target.closest('.bp-slot:not(.fixed)');
    if (!s) return;
    e.preventDefault();
    const ch = p().ch;
    const entry = entries(p(), ch).find((x) => x.key === e.dataTransfer.getData('text/plain'));
    if (assign(ch, entry, Number(s.dataset.bpSlot))) {
      G.audio.play('ui', { pitch: 1.2 });
      G.ui.refreshHotbar();
      const strip = el.querySelector('.bp-strip');
      if (strip) strip.innerHTML = stripHtml(ch);
      if (strip) fitLabels(strip);
      redraw('grid');
      redraw('detail');
    }
  });
}
