// Traits (Vitality / Erudition / Proficiency / Songchant) and trinket gear (head / neck / ring).
// State lives on the character: ch.traits, ch.trinkets [{uid,id}], ch.gear {slot: uid}.
import { G } from '../core/globals.js';
import { MOD_PROVIDERS, UPDATE_HOOKS, START_HOOKS, KILL_HOOKS, ACTIONS } from './hooks.js';
import { TRINKETS, TRINKET_SLOTS, TRINKET_DROPS, JEWELER_STOCK, JEWELER_CRAFTS, TRAITS, TRAIT_MAX, traitPoints } from '../data/trinkets.js';
import { ITEMS } from '../data/items.js';
import { RARITY_COLORS } from '../data/weapons.js';
import { ELEMENTS, meetsReqs, reqsText } from '../data/stats.js';
import { escapeHtml, uid } from '../core/util.js';
import { openPanel } from '../ui/panel.js';

const MOD_LABELS = {
  maxHp: (v) => `+${v} health`, maxHpPct: (v) => `+${pct(v)} health`, maxPosture: (v) => `+${v} posture`, maxEther: (v) => `+${v} ether`,
  physResist: (v) => `+${pct(v)} physical resist`, physDmg: (v) => `+${pct(v)} weapon damage`, mantraDmg: (v) => `+${pct(v)} mantra damage`,
  postureDmg: (v) => `+${pct(v)} posture damage`, critDmg: (v) => `+${pct(v)} critical damage`, speed: (v) => `+${pct(v)} speed`,
  dodgeCd: (v) => `-${pct(v)} dodge cooldown`, swimSpeed: (v) => `+${pct(v)} swim speed`, stealth: (v) => `${pct(v)} harder to notice`,
  sanityResist: (v) => `-${pct(v)} sanity drain`, heal: (v) => `+${pct(v)} healing`, burnDur: (v) => `+${pct(v)} burn duration`,
  chillPower: (v) => `+${pct(v)} chill`, shockDur: (v) => `+${pct(v)} shock duration`,
  fallResist: (v) => `-${pct(v)} fall damage`, lifesteal: (v) => `${pct(v)} lifesteal`, bleedDmg: (v) => `+${pct(v)} bleed damage`,
  parryWindow: (v) => `+${Math.round(v * 1000)}ms parry window`, silverGain: (v) => `+${pct(v)} silver`,
  discount: (v) => `-${pct(v)} prices`, etherRegen: (v) => `+${pct(v)} ether regen`, mantraCd: (v) => `-${pct(v)} mantra cooldown`,
  etherCost: (v) => `-${pct(v)} ether cost`,
};
function pct(v) {
  return `${Math.round(v * 100)}%`;
}
export function modsText(mods) {
  return Object.entries(mods || {})
    .map(([k, v]) => {
      if (k.startsWith('resist_')) return `+${pct(v)} ${ELEMENTS[k.slice(7)] ? ELEMENTS[k.slice(7)].name.toLowerCase() : k} resist`;
      return MOD_LABELS[k] ? MOD_LABELS[k](v) : `${k} ${v}`;
    })
    .join(', ');
}

function ensure(ch) {
  if (!ch.traits) ch.traits = { vitality: 0, erudition: 0, proficiency: 0, songchant: 0 };
  if (!ch.trinkets) ch.trinkets = [];
  if (!ch.gear) ch.gear = { head: null, neck: null, ring: null };
  return ch;
}
export function traitSpent(ch) {
  ensure(ch);
  return Object.values(ch.traits).reduce((a, b) => a + b, 0);
}
export function traitFree(ch) {
  return traitPoints(ch.level) - traitSpent(ch);
}
function equippedTrinkets(ch) {
  ensure(ch);
  const out = [];
  for (const slot in ch.gear) {
    const t = ch.trinkets.find((x) => x.uid === ch.gear[slot]);
    if (t && TRINKETS[t.id]) out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------- pips
// Trinkets that drop from foes roll random bonus lines ("pips"), Deepwoken-style.
const PIP_POOL = [
  { mod: 'maxHp', min: 5, max: 15, int: true },
  { mod: 'maxPosture', min: 4, max: 10, int: true },
  { mod: 'maxEther', min: 5, max: 15, int: true },
  { mod: 'physDmg', min: 0.02, max: 0.05 },
  { mod: 'mantraDmg', min: 0.02, max: 0.05 },
  { mod: 'speed', min: 0.01, max: 0.03 },
  { mod: 'physResist', min: 0.01, max: 0.03 },
  { mod: 'etherRegen', min: 0.04, max: 0.1 },
  { mod: 'heal', min: 0.03, max: 0.06 },
  { mod: 'sanityResist', min: 0.05, max: 0.12 },
  { mod: 'critDmg', min: 0.04, max: 0.1 },
  { mod: 'etherRegen', min: 0.04, max: 0.1 },
  { mod: 'postureDmg', min: 0.03, max: 0.07 },
];
export function rollPips(n) {
  const pool = PIP_POOL.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    let v = p.min + Math.random() * (p.max - p.min);
    v = p.int ? Math.round(v) : Math.round(v * 100) / 100;
    out.push({ mod: p.mod, v });
  }
  return out;
}
// Old saves may still carry a "tempo" pip; treat it as ether regen.
const pipKey = (mod) => (mod === 'tempo' ? 'etherRegen' : mod);
const pipMods = (t) => Object.fromEntries((t.pips || []).map((p) => [pipKey(p.mod), p.v]));
const QUALITY = ['', 'Fine', 'Exquisite'];
export function trinketName(t) {
  const n = (t.pips || []).length;
  return TRINKETS[t.id].name + (n ? ` (${QUALITY[Math.min(n, 2)]})` : '');
}

// ---------------------------------------------------------------- modifiers
MOD_PROVIDERS.push((player) => {
  const ch = player.ch;
  if (!ch) return null;
  ensure(ch);
  const m = {};
  for (const k in TRAITS) {
    const n = ch.traits[k] || 0;
    if (!n) continue;
    for (const key in TRAITS[k].per) m[key] = (m[key] || 0) + TRAITS[k].per[key] * n;
  }
  for (const t of equippedTrinkets(ch)) {
    const d = TRINKETS[t.id];
    for (const key in d.mods) m[key] = (m[key] || 0) + d.mods[key];
    for (const p of t.pips || []) {
      const key = pipKey(p.mod);
      m[key] = (m[key] || 0) + p.v;
    }
  }
  return m;
});

// ---------------------------------------------------------------- acquisition
export function giveTrinket(game, id, silent = false, pips = 0) {
  const ch = ensure(game.ch);
  if (!TRINKETS[id]) return null;
  const t = { uid: 't' + Date.now().toString(36) + uid(), id };
  if (pips > 0) t.pips = rollPips(pips);
  ch.trinkets.push(t);
  if (!silent) {
    G.ui.toast(`+ ${trinketName(t)} — wear it from Gear & Traits [K]`, 'loot');
    G.audio.play('chest', { vol: 0.5 });
  }
  return t;
}
ACTIONS.giveTrinket = (id) => giveTrinket(G.game, id);

KILL_HOOKS.push((game, e) => {
  const drops = TRINKET_DROPS[e.type];
  if (!drops) return;
  const ch = ensure(game.ch);
  for (const d of drops) {
    // bosses drop their unique trinket once per character
    if (d.chance >= 1 && ch.trinkets.some((t) => t.id === d.id)) continue;
    if (Math.random() < d.chance) {
      const r = Math.random();
      const pips = e.boss ? (r < 0.35 ? 2 : 1) : r < 0.15 ? 2 : r < 0.75 ? 1 : 0;
      giveTrinket(game, d.id, false, pips);
    }
  }
});

// ---------------------------------------------------------------- milestones
let lastLevel = 0;
START_HOOKS.push((game, ch, isNew) => {
  ensure(ch);
  lastLevel = ch.level;
  if (traitFree(ch) > 0) {
    setTimeout(() => {
      if (game.ch === ch && game.state === 'playing') G.ui.toast(isNew ? 'Choose your Traits: press [K]' : `You have ${traitFree(ch)} unspent trait point${traitFree(ch) > 1 ? 's' : ''} [K]`, 'quest');
    }, isNew ? 9000 : 3000);
  }
});
UPDATE_HOOKS.push((game) => {
  const ch = game.ch;
  if (!ch) return;
  if (ch.level !== lastLevel) {
    const before = traitPoints(lastLevel);
    lastLevel = ch.level;
    if (traitPoints(ch.level) > before) G.ui.toast('A new Trait point is available [K]', 'quest');
  }
});

// ---------------------------------------------------------------- panel
function trinketCard(ch, t, opts = {}) {
  const d = TRINKETS[t.id];
  const ok = meetsReqs(d.reqs, ch.attrs);
  const worn = ch.gear[d.slot] === t.uid;
  const pips = t.pips && t.pips.length ? `<div class="ds gold">✦ ${modsText(pipMods(t))}</div>` : '';
  return `<div class="shop-row"><div class="ico">${TRINKET_SLOTS[d.slot].icon}</div><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[d.rarity]}">${escapeHtml(trinketName(t))} <span class="pill">${TRINKET_SLOTS[d.slot].name}</span></div>
    <div class="ds">${modsText(d.mods)}${d.reqs ? ` · <span class="${ok ? '' : 'bad'}">req ${reqsText(d.reqs)}</span>` : ''}</div>${pips}<div class="ds"><i>${escapeHtml(d.desc)}</i></div></div>
    ${opts.noButtons ? '' : worn ? `<button class="btn small" data-unequip="${d.slot}">Remove</button>` : `<button class="btn small primary" data-wear="${t.uid}" ${ok ? '' : 'disabled title="Requirements not met"'}>Wear</button>`}</div>`;
}

export function openGearPanel(ui, tab = 'gear') {
  const game = ui.game;
  const ch = ensure(game.ch);
  const p = G.player;
  let state = { tab };
  const render = () => {
    const free = traitFree(ch);
    const tabs = `<div class="tabs-x"><button class="btn small ${state.tab === 'gear' ? 'primary' : ''}" data-tab="gear">Trinkets</button><button class="btn small ${state.tab === 'traits' ? 'primary' : ''}" data-tab="traits">Traits${free > 0 ? ` <span class="pill">${free}</span>` : ''}</button></div>`;
    let body = '';
    if (state.tab === 'traits') {
      body = `<p class="muted" style="margin-top:0">Traits are innate talents of body and spirit. You gain points at creation and at Power 5, 10, 15 and 20 (max ${TRAIT_MAX} each). They can be reassigned at the Shrine of Order.</p>
        <div class="pill" style="margin-bottom:10px">${free} point${free === 1 ? '' : 's'} to assign · ${traitSpent(ch)}/${traitPoints(ch.level)} spent</div>
        ${Object.entries(TRAITS).map(([k, t]) => {
          const n = ch.traits[k] || 0;
          return `<div class="trait-row"><div><div class="tn" style="color:${t.color}">${t.name}</div><div class="td">${t.desc}</div>${n ? `<div class="td good">Now: ${modsText(Object.fromEntries(Object.entries(t.per).map(([a, b]) => [a, +(b * n).toFixed(3)])))}</div>` : ''}</div>
            <div class="trait-pips">${Array.from({ length: TRAIT_MAX }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}<button class="btn small" data-trait="${k}" ${free > 0 && n < TRAIT_MAX ? '' : 'disabled'}>+</button></div></div>`;
        }).join('')}`;
    } else {
      const slots = Object.entries(TRINKET_SLOTS).map(([s, def]) => {
        const t = ch.trinkets.find((x) => x.uid === ch.gear[s]);
        const d = t && TRINKETS[t.id];
        return `<div class="gear-slot"><div class="sl">${def.icon} ${def.name.toUpperCase()}</div>${d ? `<div class="gn" style="color:${RARITY_COLORS[d.rarity]}">${escapeHtml(trinketName(t))}</div><div class="gd">${modsText(d.mods)}</div>${t.pips && t.pips.length ? `<div class="gd gold">✦ ${modsText(pipMods(t))}</div>` : ''}` : '<div class="gd" style="margin-top:8px">Empty</div>'}</div>`;
      }).join('');
      const owned = ch.trinkets.length ? ch.trinkets.map((t) => trinketCard(ch, t)).join('') : '<div class="muted">You own no trinkets. Corwin the jeweler in Saltreach sells them, and great foes sometimes carry them.</div>';
      body = `<div class="gear-slots">${slots}</div><h3>OWNED</h3><div class="shop-list scroll">${owned}</div>`;
    }
    return `<h2>GEAR &amp; TRAITS</h2>${tabs}${body}<div class="divider"></div><div class="row-flex"><span class="muted" style="font-size:13px"><kbd>K</kbd> to close</span><span class="space"></span><button class="btn" data-a="close">Close</button></div>`;
  };
  openPanel(ui, 'gear', {
    width: 760,
    render,
    onClick: (e, rerender) => {
      const tb = e.target.closest('[data-tab]');
      if (tb) state.tab = tb.dataset.tab;
      const tr = e.target.closest('[data-trait]');
      if (tr && traitFree(ch) > 0 && (ch.traits[tr.dataset.trait] || 0) < TRAIT_MAX) {
        ch.traits[tr.dataset.trait]++;
        p.recompute();
        G.audio.play('levelup', { vol: 0.4 });
        game.save();
      }
      const w = e.target.closest('[data-wear]');
      if (w) wearTrinket(game, w.dataset.wear);
      const u = e.target.closest('[data-unequip]');
      if (u) takeOffTrinket(game, u.dataset.unequip);
      rerender();
    },
  });
}
ACTIONS.openGear = (ui, tab) => openGearPanel(ui || G.ui, tab);

// ---------------------------------------------------------------- jeweler
export function openJeweler(ui) {
  const game = ui.game;
  const ch = ensure(game.ch);
  const p = G.player;
  let mode = 'buy';
  const price = (d) => Math.max(1, Math.round(d.price * p.derived.priceMul));
  const sellPrice = (d, t) => Math.max(1, Math.round((d.price || 300) * 0.4 * p.derived.sellMul * 2 * (1 + 0.5 * ((t && t.pips && t.pips.length) || 0))));
  const render = () => {
    let rows = '';
    if (mode === 'buy') {
      for (const id of JEWELER_STOCK) {
        const d = TRINKETS[id];
        const pr = price(d);
        const ok = meetsReqs(d.reqs, ch.attrs);
        rows += `<div class="shop-row"><div class="ico">${TRINKET_SLOTS[d.slot].icon}</div><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[d.rarity]}">${escapeHtml(d.name)} <span class="pill">${TRINKET_SLOTS[d.slot].name}</span></div><div class="ds">${modsText(d.mods)}${d.reqs ? ` · <span class="${ok ? '' : 'bad'}">req ${reqsText(d.reqs)}</span>` : ''}</div></div><div class="pr">${pr} silver</div><button class="btn small" data-buy="${id}" ${ch.silver < pr ? 'disabled' : ''}>Buy</button></div>`;
      }
      rows += '<h3>STARMETAL FORGE</h3>';
      for (const id of JEWELER_CRAFTS) {
        const d = TRINKETS[id];
        const owned = ch.trinkets.some((t) => t.id === id);
        const can = Object.entries(d.craft).every(([k, n]) => (ch.inventory.items[k] || 0) >= n);
        const needs = Object.entries(d.craft).map(([k, n]) => `<span class="${(ch.inventory.items[k] || 0) >= n ? 'good' : 'bad'}">${ITEMS[k].icon} ${ITEMS[k].name} ${ch.inventory.items[k] || 0}/${n}</span>`).join(' · ');
        rows += `<div class="shop-row"><div class="ico">${TRINKET_SLOTS[d.slot].icon}</div><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[d.rarity]}">${escapeHtml(d.name)} <span class="pill">${TRINKET_SLOTS[d.slot].name}</span></div><div class="ds">${modsText(d.mods)}</div><div class="ds">${needs}</div></div><button class="btn small" data-forge="${id}" ${can && !owned ? '' : 'disabled'}>${owned ? 'Owned' : 'Forge'}</button></div>`;
      }
    } else {
      for (const t of ch.trinkets) {
        const d = TRINKETS[t.id];
        if (Object.values(ch.gear).includes(t.uid)) continue;
        rows += `<div class="shop-row"><div class="ico">${TRINKET_SLOTS[d.slot].icon}</div><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[d.rarity]}">${escapeHtml(trinketName(t))}</div><div class="ds">${modsText(d.mods)}${t.pips && t.pips.length ? ` · <span class="gold">✦ ${modsText(pipMods(t))}</span>` : ''}</div></div><div class="pr">${sellPrice(d, t)} silver</div><button class="btn small" data-sell="${t.uid}">Sell</button></div>`;
      }
      if (!rows) rows = '<div class="muted">Nothing to sell. (Worn trinkets cannot be sold.)</div>';
    }
    return `<h2>CORWIN'S CURIOS</h2><div class="row-flex" style="margin-bottom:10px"><button class="btn small ${mode === 'buy' ? 'primary' : ''}" data-mode="buy">Buy</button><button class="btn small ${mode === 'sell' ? 'primary' : ''}" data-mode="sell">Sell</button><span class="space"></span><span style="font-family:var(--display)">${ch.silver} silver</span></div>
      <div class="shop-list scroll">${rows}</div><div class="divider"></div><div class="row-flex"><span class="muted" style="font-size:13px">Wear trinkets from Gear &amp; Traits <kbd>K</kbd>.</span><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`;
  };
  openPanel(ui, 'jeweler', {
    width: 780,
    render,
    onClick: (e, rerender) => {
      const m = e.target.closest('[data-mode]');
      if (m) mode = m.dataset.mode;
      const b = e.target.closest('[data-buy]');
      if (b) {
        const d = TRINKETS[b.dataset.buy];
        const pr = price(d);
        if (ch.silver >= pr) {
          ch.silver -= pr;
          giveTrinket(game, b.dataset.buy);
          G.audio.play('coin');
          game.save();
        }
      }
      const f = e.target.closest('[data-forge]');
      if (f) {
        const d = TRINKETS[f.dataset.forge];
        if (Object.entries(d.craft).every(([k, n]) => (ch.inventory.items[k] || 0) >= n)) {
          for (const [k, n] of Object.entries(d.craft)) game.takeItem(k, n);
          giveTrinket(game, f.dataset.forge);
          G.audio.play('steel', { pitch: 1.3 });
          game.save();
        }
      }
      const s = e.target.closest('[data-sell]');
      if (s) {
        const i = ch.trinkets.findIndex((x) => x.uid === s.dataset.sell);
        if (i >= 0 && !Object.values(ch.gear).includes(s.dataset.sell)) {
          ch.silver += sellPrice(TRINKETS[ch.trinkets[i].id], ch.trinkets[i]);
          ch.trinkets.splice(i, 1);
          G.audio.play('coin');
          game.save();
        }
      }
      rerender();
    },
  });
}
ACTIONS.openJeweler = (ui) => openJeweler(ui || G.ui);

// Buy a trinket with rift shards (used by the Hollow Man's dialogue).
ACTIONS.buyTrinketWithShards = (id) => {
  const game = G.game;
  const d = TRINKETS[id];
  const cost = d.shardPrice || 20;
  if ((game.ch.inventory.items.rift_shard || 0) < cost) return G.ui.toast(`You need ${cost} rift shards.`, 'bad');
  if (ensure(game.ch).trinkets.some((t) => t.id === id)) return G.ui.toast('You already own that.', 'bad');
  game.takeItem('rift_shard', cost);
  giveTrinket(game, id);
  game.save();
};

// ---------------------------------------------------------------- shared with the backpack
// What a trinket gives (its own lines, then its pips), and wearing or taking one off; the Gear
// panel and the backpack (ui/backpack.js) both go through these.
export function trinketLines(t) {
  const d = TRINKETS[t.id];
  return [modsText(d.mods), t.pips && t.pips.length ? `✦ ${modsText(pipMods(t))}` : ''].filter(Boolean);
}
export function wearTrinket(game, uid) {
  const ch = ensure(game.ch);
  const t = ch.trinkets.find((x) => x.uid === uid);
  if (!t || !meetsReqs(TRINKETS[t.id].reqs, ch.attrs)) return false;
  ch.gear[TRINKETS[t.id].slot] = t.uid;
  G.player.recompute();
  G.audio.play('steel', { vol: 0.4, pitch: 1.4 });
  game.save();
  return true;
}
export function takeOffTrinket(game, slot) {
  const ch = ensure(game.ch);
  if (!ch.gear[slot]) return false;
  ch.gear[slot] = null;
  G.player.recompute();
  game.save();
  return true;
}
