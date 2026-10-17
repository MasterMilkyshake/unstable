// Character menu: attributes investment, talents, mantras + hotbar, the backpack (ui/backpack.js), quests, vow.
import { G } from '../core/globals.js';
import { ATTRS, BASE_ATTRS, WEAPON_ATTRS, ATTUNE_ATTRS, RESIST_ELEMENTS, ATTR_CAP, ATTUNE_TOTAL_CAP, MAX_LEVEL, POINTS_PER_LEVEL, meetsReqs, reqsText, ELEMENTS } from '../data/stats.js';
import { TALENTS, TALENT_CATS, talentExcluded } from '../data/talents.js';
import { MANTRAS, MANTRA_TYPES, MAX_STARS } from '../data/mantras.js';
import { WEAPONS } from '../data/weapons.js';
import { VOWS } from '../data/vows.js';
import { RACE_BY_ID } from '../data/races.js';
import { QUESTS } from '../data/quests.js';
import { renderBackpack, backpackClick, bindBackpack } from './backpack.js';
import { shuffle, escapeHtml } from '../core/util.js';
import { ACTIONS } from '../game/hooks.js';
import { traitFree, traitsHtml, assignTrait } from '../game/gear.js';

const TABS = [
  ['attrs', 'Attributes'],
  ['talents', 'Talents'],
  ['mantras', 'Mantras'],
  ['inventory', 'Backpack'],
  ['quests', 'Quests'],
];

let state = { tab: 'attrs', pending: {} };

export function open(ui, tab) {
  if (tab) state.tab = tab;
  else {
    const ch = G.player.ch;
    if (ch.points > 0 || traitFree(ch) > 0) state.tab = 'attrs';
    else if (ch.talentPicks > 0) state.tab = 'talents';
    else if (ch.mantraPicks > 0 && eligibleMantras(ch).length) state.tab = 'mantras';
  }
  state.pending = {};
  const el = ui.openModal('charmenu', `<div class="panel"><div class="tabs"></div><div class="tab-body"></div></div>`, { noX: true });
  const render = () => renderAll(ui, el);
  el.addEventListener('click', (e) => onClick(ui, el, e, render));
  bindBackpack(el);
  render();
}

// Points and trait points are invested only while resting at a campfire (Player.resting), as in
// Deepwoken; away from one the Attributes tab shows everything and holds the points. Talent and mantra cards are chosen anywhere.
const REST_NOTE = 'Rest at a campfire to invest your points.';
const restNote = (p) => (p.resting() ? '' : `<div class="muted rest-note" style="margin:0 0 10px">${REST_NOTE}</div>`);

// What waits for the next rest at a campfire (agent 4's campfire panel).
ACTIONS.readyToRise = () => {
  const ch = G.player && G.player.ch;
  if (!ch) return null;
  return { points: ch.points, traits: traitFree(ch), talentPicks: ch.talentPicks, mantraPicks: ch.mantraPicks, rise: (ch.earned || 0) >= POINTS_PER_LEVEL && ch.level < MAX_LEVEL };
};
// At a campfire (the player already sitting by it), open the menu on whatever waits: points, then
// talent, then mantra cards. Returns false if nothing waits or the player is not resting at a fire.
ACTIONS.openRest = (ui) => {
  const p = G.player;
  const r = ACTIONS.readyToRise();
  if (!p || !r || !p.resting()) return false;
  const tab = r.points > 0 || r.traits > 0 ? 'attrs' : r.talentPicks > 0 ? 'talents' : r.mantraPicks > 0 && eligibleMantras(p.ch).length ? 'mantras' : null;
  if (!tab) return false;
  open(ui, tab);
  return true;
};

// The next thing an attribute opens, as Deepwoken's stat menu points the way: the lowest requirement
// above `value` among the talents, mantras and weapons whose other requirements `attrs` already meets
// (Power aside), with up to two names. Presentation only.
export function nextUnlock(k, value, ch, attrs) {
  const ctx = { level: MAX_LEVEL, vow: ch.vow };
  let best = null;
  const consider = (reqs, name) => {
    if (!reqs || typeof reqs[k] !== 'number' || reqs[k] <= value) return;
    if (!meetsReqs({ ...reqs, [k]: 0 }, attrs, ctx)) return;
    if (!best || reqs[k] < best.at) best = { at: reqs[k], names: [name] };
    else if (reqs[k] === best.at && best.names.length < 2 && !best.names.includes(name)) best.names.push(name);
  };
  for (const id in TALENTS) {
    const t = TALENTS[id];
    if (!t.vow && !ch.talents.includes(id) && !talentExcluded(id, ch.talents)) consider(t.reqs, t.name);
  }
  for (const id in MANTRAS) if (!MANTRAS[id].vow && !ch.mantras[id]) consider(MANTRAS[id].reqs, MANTRAS[id].name);
  for (const id in WEAPONS) if (!WEAPONS[id].hidden) consider(WEAPONS[id].reqs, WEAPONS[id].name);
  return best;
}

function eligibleTalents(ch, p) {
  return Object.keys(TALENTS).filter((id) => {
    const t = TALENTS[id];
    if (t.vow || ch.talents.includes(id) || talentExcluded(id, ch.talents)) return false;
    return meetsReqs(t.reqs, ch.attrs, { level: ch.level, vow: ch.vow });
  });
}
function eligibleMantras(ch) {
  return Object.keys(MANTRAS).filter((id) => {
    const m = MANTRAS[id];
    if (m.vow || ch.mantras[id]) return false;
    if (ATTUNE_ATTRS.includes(m.el) && !ch.manaUnlocked) return false;
    return meetsReqs(m.reqs, ch.attrs, { level: ch.level, vow: ch.vow });
  });
}

function renderAll(ui, el) {
  const p = G.player;
  const ch = p.ch;
  const badges = {
    attrs: ch.points + traitFree(ch),
    talents: ch.talentPicks,
    mantras: eligibleMantras(ch).length ? ch.mantraPicks : 0,
  };
  const tabs = [...TABS];
  if (ch.vow) tabs.push(['vow', 'Vow']);
  el.querySelector('.tabs').innerHTML = tabs.map(([id, n]) => `<div class="tab ${state.tab === id ? 'on' : ''}" data-tab="${id}">${n.toUpperCase()}${badges[id] ? `<span class="badge">${badges[id]}</span>` : ''}</div>`).join('') + `<div class="tab" data-close="1" style="flex:0 0 60px">✕</div>`;
  const body = el.querySelector('.tab-body');
  const fn = { attrs: renderAttrs, talents: renderTalents, mantras: renderMantras, inventory: renderBackpack, quests: renderQuests, vow: renderVow }[state.tab];
  body.innerHTML = fn ? fn(p, ch) : '';
}

// ------------------------------------------------------------ attributes
function pendingTotal() {
  return Object.values(state.pending).reduce((a, b) => a + b, 0);
}

function renderAttrs(p, ch) {
  const left = ch.points - pendingTotal();
  const attuneTotal = ATTUNE_ATTRS.reduce((a, k) => a + ch.attrs[k] + (state.pending[k] || 0), 0);
  const withPending = { ...ch.attrs };
  for (const k in state.pending) withPending[k] = (withPending[k] || 0) + state.pending[k];
  const row = (k) => {
    const a = ATTRS[k];
    const pend = state.pending[k] || 0;
    const v = ch.attrs[k];
    const locked = a.cat === 'attune' && !ch.manaUnlocked;
    const canAdd = left > 0 && p.resting() && v + pend < ATTR_CAP && !locked && !(a.cat === 'attune' && attuneTotal >= ATTUNE_TOTAL_CAP);
    const next = locked ? null : nextUnlock(k, v + pend, ch, withPending);
    const hint = next ? `<span class="next-unlock" style="display:block;font-family:var(--serif);font-size:12px;letter-spacing:0;opacity:.6">${next.at}: ${escapeHtml(next.names.join(', '))}</span>` : '';
    return `<div class="attr" title="${escapeHtml(a.desc)}${locked ? ' (Requires mana training from Sage Ilvar)' : ''}">
      <span class="pip" style="background:${a.color}"></span>
      <span class="an" style="${locked ? 'opacity:.4' : ''}">${a.name}${hint}</span>
      <span class="av">${v + pend}</span><span class="ap">${pend ? '+' + pend : ''}</span>
      <button class="btn small" data-dec="${k}" ${pend ? '' : 'disabled'}>−</button>
      <button class="btn small" data-inc="${k}" ${canAdd ? '' : 'disabled'}>+</button>
    </div>`;
  };
  const d = p.derived;
  const res = (el) => Math.round((p.resist[el] || 0) * 100) + '%';
  const race = RACE_BY_ID[ch.race];
  return `${ch.points > 0 || traitFree(ch) > 0 ? restNote(p) : ''}
    <div class="row-flex" style="margin-bottom:12px">
      <div><span style="font-family:var(--display);font-size:22px;color:var(--gold-2)">${escapeHtml(ch.name)}</span>
      <span class="muted"> · ${race.name} · Power ${ch.level}${ch.vow ? ' · ' + VOWS[ch.vow].name : ''}</span></div>
      <span class="space"></span>
      ${powerProgress(ch)}
      <span style="font-family:var(--display)">INVESTMENT POINTS: <span class="gold" style="font-size:20px">${left}</span></span>
      <button class="btn small" data-a="reset" ${pendingTotal() ? '' : 'disabled'}>Reset</button>
      <button class="btn primary small" data-a="confirm" ${pendingTotal() ? '' : 'disabled'}>Confirm</button>
    </div>
    <div class="attr-grid">
      <div class="attr-col"><h3>BASE</h3>${BASE_ATTRS.map(row).join('')}<h3>WEAPON</h3>${WEAPON_ATTRS.map(row).join('')}</div>
      <div class="attr-col"><h3>ATTUNEMENT ${ch.manaUnlocked ? `<span class="muted">(${attuneTotal}/${ATTUNE_TOTAL_CAP})</span>` : '<span class="muted">— locked</span>'}</h3>${ATTUNE_ATTRS.map(row).join('')}
        ${ch.manaUnlocked ? '' : '<div class="muted" style="font-size:14px;margin-top:6px">Speak with Sage Ilvar in Saltreach (Power 2) to awaken your attunement.</div>'}
        ${traitsHtml(ch, p.resting())}
      </div>
      <div class="attr-col"><h3>DERIVED</h3>
        <div class="stat-list">
          <span class="k">Health</span><span>${p.maxHp}</span>
          <span class="k">Posture</span><span>${p.maxPosture}</span>
          <span class="k">Ether</span><span>${p.maxEther} <span class="muted">(+${d.etherRegen.toFixed(1)}/s)</span></span>
          <span class="k">Sanity</span><span>${p.maxSanity}</span>
          <span class="k">Move speed</span><span>${Math.round(d.moveMul * 100)}%</span>
          <span class="k">Dodge cooldown</span><span>${d.dodgeCd.toFixed(2)}s</span>
          <span class="k">Parry window</span><span>${Math.round(d.parryWindow * 1000)}ms</span>
          <span class="k">Mantra power</span><span>${Math.round(d.mantraDmg * 100)}%</span>
          <span class="k">Physical damage</span><span>${Math.round(d.physDmg * 100)}%</span>
          <span class="k">Prices</span><span>${Math.round(d.priceMul * 100)}%</span>
        </div>
        <h3>RESISTANCES</h3>
        <div class="stat-list">
          <span class="k">Physical</span><span>${res('phys')}</span>
          ${RESIST_ELEMENTS.map((e) => `<span class="k" style="color:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span><span>${res(e)}</span>`).join('')}
        </div>
        <h3>RACIAL</h3><div style="font-size:14px"><span class="gold">${race.passive.name}.</span> ${race.passive.desc}</div>
      </div>
    </div>`;
}

// Power is gated by investment (Player.invest): show how far the next Power is, counting what
// the pending points would add. Points from creation or the Shrine's refund are spent first.
function powerProgress(ch) {
  if (ch.level >= MAX_LEVEL) return `<span class="muted power-progress" style="margin-right:14px">Power ${MAX_LEVEL}: the height of your strength</span>`;
  const earned = ch.earned || 0;
  const invested = ch.invested || 0;
  const counting = Math.min(ch.points, earned - invested);
  const other = ch.points - counting;
  const adds = Math.max(0, Math.min(counting, pendingTotal() - other));
  const title = 'XP earns points one at a time; investing the 15th point earned since your last Power raises it. Points from creation or a Shrine of Order refund are spent first and do not count.';
  return `<span class="muted power-progress" style="margin-right:14px" title="${escapeHtml(title)}">invested <b class="gold">${invested + adds}/${POINTS_PER_LEVEL}</b> toward Power ${ch.level + 1}${earned < POINTS_PER_LEVEL ? ` <span style="opacity:.7">(${earned} earned)</span>` : ''}</span>`;
}

// ------------------------------------------------------------ talents
function talentCard(id, extra = '', cls = '') {
  const t = TALENTS[id];
  const ex = [...(t.excludes || []), ...Object.keys(TALENTS).filter((o) => (TALENTS[o].excludes || []).includes(id) && !(t.excludes || []).includes(o))];
  return `<div class="card ${cls}" ${extra}><div class="cc">${t.cat.toUpperCase()}</div><div class="cn">${t.name}</div><div class="cd2">${t.desc}</div>${t.reqs ? `<div class="req">Requires ${reqsText(t.reqs)}</div>` : ''}${ex.length ? `<div class="req">Not with ${ex.map((o) => TALENTS[o].name).join(', ')}</div>` : ''}</div>`;
}

function renderTalents(p, ch) {
  let pick = '';
  if (ch.talentPicks > 0) {
    if (!ch.talentOffer || !ch.talentOffer.length || ch.talentOffer.some((id) => ch.talents.includes(id))) {
      const pool = shuffle(eligibleTalents(ch, p));
      ch.talentOffer = pool.slice(0, 3 + (p.mods.extraCard || 0));
    }
    pick = ch.talentOffer.length
      ? `<h3>CHOOSE A TALENT <span class="muted">(${ch.talentPicks} pick${ch.talentPicks > 1 ? 's' : ''} remaining)</span></h3><div class="card-grid">${ch.talentOffer.map((id) => talentCard(id, `data-pick-talent="${id}"`, 'pick')).join('')}</div><div class="divider"></div>`
      : `<div class="muted">No talents are available to you yet — invest more points. Your picks are saved.</div><div class="divider"></div>`;
  }
  const owned = ch.talents.length ? `<div class="card-grid">${ch.talents.map((id) => talentCard(id)).join('')}</div>` : '<div class="muted">You have no talents yet. You earn a talent pick each time your Power grows.</div>';
  const all = TALENT_CATS.filter((c) => c !== 'Vow')
    .map((cat) => {
      const ids = Object.keys(TALENTS).filter((id) => TALENTS[id].cat === cat && !ch.talents.includes(id));
      if (!ids.length) return '';
      return `<h3>${cat.toUpperCase()}</h3><div class="card-grid">${ids.map((id) => talentCard(id, '', meetsReqs(TALENTS[id].reqs, ch.attrs, { level: ch.level }) ? '' : 'locked')).join('')}</div>`;
    })
    .join('');
  return `${pick}<h3>YOUR TALENTS</h3>${owned}<div class="divider"></div><details><summary style="font-family:var(--display);cursor:pointer;color:var(--gold)">ALL TALENTS</summary>${all}</details>`;
}

// ------------------------------------------------------------ mantras
function mantraCard(ch, id, opts = {}) {
  const m = MANTRAS[id];
  const st = ch.mantras[id];
  const el = ATTRS[m.el] ? ATTRS[m.el] : null;
  const color = el ? el.color : m.el === 'support' ? '#ffd27a' : '#e9e4d8';
  const elName = el ? el.name : m.el === 'support' ? 'Support' : 'Physical';
  const costs = [`${m.ether} ether`, m.hpCost ? `${Math.round(m.hpCost * 100)}% HP` : null, `${m.cd}s cd`].filter(Boolean).join(' · ');
  let slots = '';
  if (opts.assign) {
    const cur = ch.hotbar.findIndex((e) => e && e.type === 'mantra' && e.id === id);
    slots = `<div class="slotsel">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<button class="btn ${cur === i ? 'on' : ''}" data-assign="${id}" data-slot="${i}">${(i + 1) % 10}</button>`).join('')}${cur > 0 ? `<button class="btn" data-unassign="${id}">✕</button>` : ''}</div>`;
  }
  return `<div class="card ${opts.cls || ''}" ${opts.attr || ''} style="border-left:3px solid ${color}">
    <div class="cc" style="color:${color}">${elName.toUpperCase()} · ${MANTRA_TYPES[m.type].toUpperCase()}</div>
    <div class="cn">${m.name} ${st ? `<span class="stars">${'★'.repeat(st.stars)}${'☆'.repeat(MAX_STARS - st.stars)}</span>` : ''}</div>
    <div class="cd2">${m.desc}</div>
    <div class="req">${costs}</div>
    ${opts.showReq ? `<div class="req">Requires ${reqsText(m.reqs)}</div>` : ''}
    ${slots}
  </div>`;
}

function renderMantras(p, ch) {
  let pick = '';
  const elig = eligibleMantras(ch);
  if (ch.mantraPicks > 0 && elig.length) {
    if (!ch.mantraOffer || !ch.mantraOffer.length || ch.mantraOffer.some((id) => ch.mantras[id] || !elig.includes(id))) ch.mantraOffer = shuffle([...elig]).slice(0, 3);
    pick = `<h3>LEARN A MANTRA <span class="muted">(${ch.mantraPicks} pick${ch.mantraPicks > 1 ? 's' : ''})</span></h3><div class="card-grid">${ch.mantraOffer.map((id) => mantraCard(ch, id, { cls: 'pick', attr: `data-pick-mantra="${id}"`, showReq: true })).join('')}</div><div class="divider"></div>`;
  } else if (ch.mantraPicks > 0) {
    pick = `<div class="muted" style="margin-bottom:10px">You have ${ch.mantraPicks} mantra pick${ch.mantraPicks > 1 ? 's' : ''} saved, but no mantras you qualify for. Invest in attunements (after mana training), Strength, Agility, weapons or Charisma.</div>`;
  }
  const owned = Object.keys(ch.mantras);
  const ownedHtml = owned.length
    ? `<div class="card-grid">${owned.map((id) => mantraCard(ch, id, { assign: true })).join('')}</div>`
    : '<div class="muted">You know no mantras yet.</div>';
  const locked = Object.keys(MANTRAS).filter((id) => !ch.mantras[id] && !MANTRAS[id].vow);
  return `${pick}<h3>KNOWN MANTRAS <span class="muted">— assign to hotbar keys 2–0, then press the key to cast</span></h3>${ownedHtml}
    <div class="divider"></div><details><summary style="font-family:var(--display);cursor:pointer;color:var(--gold)">ALL MANTRAS</summary><div class="card-grid" style="margin-top:10px">${locked.map((id) => mantraCard(ch, id, { cls: meetsReqs(MANTRAS[id].reqs, ch.attrs, { level: ch.level }) ? '' : 'locked', showReq: true })).join('')}</div></details>`;
}

function renderQuests(p, ch) {
  const ids = Object.keys(ch.quests);
  if (!ids.length) return '<div class="muted">No quests yet. Talk to people.</div>';
  const act = ids.filter((id) => ch.quests[id].state !== 'done');
  const done = ids.filter((id) => ch.quests[id].state === 'done');
  const q = G.game.quests.active();
  return `<h3>ACTIVE</h3>${act.length ? q.map((x) => `<div class="card" style="margin-bottom:10px"><div class="cn">${x.name}</div><div class="cd2">${x.desc}</div><div class="req ${x.ready ? 'good' : ''}">${x.text}</div></div>`).join('') : '<div class="muted">None.</div>'}
    <h3>COMPLETED</h3>${done.map((id) => `<div class="muted">✓ ${QUESTS[id].name}</div>`).join('') || '<div class="muted">None.</div>'}`;
}

function renderVow(p, ch) {
  const v = VOWS[ch.vow];
  return `<div class="card vow-card" style="border-color:${v.color}"><div class="cn" style="color:${v.color};font-size:22px">${v.name}</div><div class="lore">${v.lore}</div><ul class="perks">${v.perks.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
}

// ------------------------------------------------------------ events
function onClick(ui, el, e, render) {
  const p = G.player;
  const ch = p.ch;
  if (e.target.closest('[data-a="pouch"]')) return ui.openDropPanel();
  const t = e.target;
  if (t.closest('[data-close]')) return ui.closeModal();
  const tab = t.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    G.audio.play('ui');
    return render();
  }
  if (state.tab === 'inventory' && backpackClick(ui, e, render)) return;
  const inc = t.closest('[data-inc]');
  if (inc) {
    const k = inc.dataset.inc;
    const n = e.shiftKey ? 5 : 1;
    for (let i = 0; i < n; i++) {
      if (ch.points - pendingTotal() <= 0) break;
      if (ch.attrs[k] + (state.pending[k] || 0) >= ATTR_CAP) break;
      state.pending[k] = (state.pending[k] || 0) + 1;
    }
    G.audio.play('ui', { pitch: 1.3 });
    return render();
  }
  const tr = t.closest('[data-trait]');
  if (tr) {
    if (!assignTrait(p, tr.dataset.trait)) {
      if (!p.resting()) ui.toast(REST_NOTE, 'bad');
      return render();
    }
    G.audio.play('levelup', { vol: 0.4 });
    G.game.save();
    return render();
  }
  const dec = t.closest('[data-dec]');
  if (dec) {
    const k = dec.dataset.dec;
    state.pending[k] = Math.max(0, (state.pending[k] || 0) - (e.shiftKey ? 5 : 1));
    if (!state.pending[k]) delete state.pending[k];
    return render();
  }
  const a = t.closest('[data-a]');
  if (a && a.dataset.a === 'reset') {
    state.pending = {};
    return render();
  }
  if (a && a.dataset.a === 'confirm') {
    const before = eligibleMantras(ch).length;
    const level = ch.level;
    if (p.invest(state.pending) < 0) { // may raise Power (player.js); refused away from rest
      ui.toast(REST_NOTE, 'bad');
      return render();
    }
    state.pending = {};
    if (ch.level > level && ch.talentPicks > 0) state.tab = 'talents'; // the rise: its cards, right here
    // Sage Ilvar's trial: give the awakened mana a shape
    if (!ch.flags.sageTrial && ATTUNE_ATTRS.some((k) => ch.attrs[k] > 0)) {
      ch.flags.sageTrial = true;
      G.game.quests.onFlag('sageTrial');
    }
    G.audio.play('levelup', { vol: 0.5 });
    if (eligibleMantras(ch).length > before && ch.mantraPicks > 0) ui.toast('New mantras are available to learn.', 'good');
    ch.talentOffer = null;
    G.game.save();
    return render();
  }
  const pt = t.closest('[data-pick-talent]');
  if (pt && p.pickTalent(pt.dataset.pickTalent)) {
    G.audio.play('talent');
    ui.toast(`Talent learned: ${TALENTS[pt.dataset.pickTalent].name}`, 'good');
    G.game.save();
    return render();
  }
  const pm = t.closest('[data-pick-mantra]');
  if (pm && p.pickMantra(pm.dataset.pickMantra)) {
    const id = pm.dataset.pickMantra;
    const free = ch.hotbar.findIndex((x, i) => i > 0 && i < 8 && !x);
    if (free > 0) ch.hotbar[free] = { type: 'mantra', id };
    G.audio.play('talent');
    ui.toast(`Mantra learned: ${MANTRAS[id].name}${free > 0 ? ` (slot ${(free + 1) % 10})` : ''}`, 'good');
    ui.refreshHotbar();
    G.game.save();
    return render();
  }
  const as = t.closest('[data-assign]');
  if (as) {
    const id = as.dataset.assign;
    const slot = Number(as.dataset.slot);
    for (let i = 1; i < 10; i++) if (ch.hotbar[i] && ch.hotbar[i].type === 'mantra' && ch.hotbar[i].id === id) ch.hotbar[i] = null;
    ch.hotbar[slot] = { type: 'mantra', id };
    ui.refreshHotbar();
    return render();
  }
  const un = t.closest('[data-unassign]');
  if (un) {
    for (let i = 1; i < 10; i++) if (ch.hotbar[i] && ch.hotbar[i].id === un.dataset.unassign) ch.hotbar[i] = null;
    if (p.selected && !ch.hotbar[p.selected]) p.selected = 0;
    ui.refreshHotbar();
    return render();
  }
  const ew = t.closest('[data-equip-w]');
  if (ew) {
    p.equipWeapon(ew.dataset.equipW || null);
    ui.refreshHotbar();
    return render();
  }
  const eo = t.closest('[data-equip-o]');
  if (eo) {
    p.equipOutfit(eo.dataset.equipO);
    return render();
  }
  const use = t.closest('[data-use]');
  if (use) {
    p.useItem(use.dataset.use);
    return render();
  }
}
