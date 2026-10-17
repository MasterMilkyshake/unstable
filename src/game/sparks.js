// Mantra Altar with modifiers: each Mantra Spark adds a star (+15% power, -8% cooldown) and
// lets you pick one modifier for that mantra. Modifiers are unique per mantra, up to three.
import { G } from '../core/globals.js';
import { ACTIONS } from './hooks.js';
import { MANTRAS, MAX_STARS } from '../data/mantras.js';
import { ATTRS } from '../data/stats.js';
import { escapeHtml } from '../core/util.js';
import { openPanel } from '../ui/panel.js';

export const MODIFIERS = {
  potent: { name: 'Potent', desc: '+20% damage and healing.', ok: (m) => !!(m.p.dmg || m.p.wMul || m.p.dps || m.p.dmgPerStack || m.behavior === 'heal') },
  swift: { name: 'Swift', desc: 'Cooldown 15% shorter.', ok: () => true },
  thrifty: { name: 'Thrifty', desc: 'Costs 25% less ether.', ok: () => true },
  far: { name: 'Far-Reaching', desc: 'Range, speed and area +20-30%.', ok: (m) => ['range', 'distance', 'length', 'speed', 'radius', 'rings'].some((k) => m.p[k]) },
  twin: { name: 'Twin', desc: 'One more projectile, jump, hit or wave.', ok: (m) => m.behavior === 'projectile' || ['count', 'jumps', 'ticks', 'waves', 'hits'].some((k) => m.p[k]) || m.behavior === 'tidalWave' },
  lingering: { name: 'Lingering', desc: 'Its ailment builds twice as strongly.', ok: (m) => !!m.p.status },
  empowered: { name: 'Empowered', desc: 'Buffs, heals and marks are 30% stronger and longer.', ok: (m) => ['duration', 'pct', 'hot', 'mods', 'amp', 'buff'].some((k) => m.p[k] !== undefined) },
};

export function allowedMods(id, st) {
  const m = MANTRAS[id];
  return Object.keys(MODIFIERS).filter((k) => MODIFIERS[k].ok(m) && !(st.mods || []).includes(k));
}

// cost / cooldown multipliers read by Player.tryCast
ACTIONS.mantraMods = (player, id) => {
  const st = player.ch && player.ch.mantras && player.ch.mantras[id];
  if (!st || !st.mods) return null;
  return { etherMul: st.mods.includes('thrifty') ? 0.75 : 1, cdMul: st.mods.includes('swift') ? 0.85 : 1 };
};

ACTIONS.openAltar = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  const state = { pick: null };
  openPanel(ui, 'altar', {
    width: 760,
    render: () => {
      const sparks = ch.inventory.items.mantra_spark || 0;
      const ids = Object.keys(ch.mantras);
      const rows = ids.map((id) => {
        const m = MANTRAS[id];
        if (!m) return '';
        const st = ch.mantras[id];
        const el = ATTRS[m.el];
        const color = el ? el.color : m.el === 'support' ? '#ffd27a' : '#e9e4d8';
        const mods = (st.mods || []).map((k) => `<span class="pill">${MODIFIERS[k].name}</span>`).join(' ');
        const full = st.stars >= MAX_STARS;
        let picker = '';
        if (state.pick === id && !full) {
          const opts = allowedMods(id, st);
          picker = `<div class="row-flex" style="flex-wrap:wrap;gap:6px;margin-top:8px">${opts.map((k) => `<button class="btn small" data-mod="${k}" title="${escapeHtml(MODIFIERS[k].desc)}">${MODIFIERS[k].name}<span class="muted" style="font-size:11px;display:block;text-transform:none;letter-spacing:0">${escapeHtml(MODIFIERS[k].desc)}</span></button>`).join('')}<button class="btn small" data-mod="">Star only</button></div>`;
        }
        return `<div class="shop-row" style="flex-wrap:wrap"><div style="flex:1;min-width:300px"><div class="nm" style="color:${color}">${escapeHtml(m.name)} <span class="stars" style="color:#ffd27a">${'★'.repeat(st.stars)}${'☆'.repeat(MAX_STARS - st.stars)}</span> ${mods}</div><div class="ds">${escapeHtml(m.desc)}</div></div>
          <button class="btn small ${state.pick === id ? 'primary' : ''}" data-emp="${id}" ${sparks < 1 || full ? 'disabled' : ''}>${full ? 'Max' : state.pick === id ? 'Choose…' : 'Empower'}</button>${picker ? `<div style="flex-basis:100%">${picker}</div>` : ''}</div>`;
      }).join('') || '<div class="muted">You know no mantras.</div>';
      return `<h2>MANTRA ALTAR</h2>
        <p class="muted" style="text-align:center;margin-top:0">Offer a Mantra Spark to add a star (+15% power, 8% shorter cooldown) and shape the mantra with a modifier. Each modifier can be chosen once per mantra. You hold <b class="gold">${sparks}</b> spark${sparks === 1 ? '' : 's'}.</p>
        <div class="shop-list scroll">${rows}</div><div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`;
    },
    onClick: (e, rerender) => {
      const emp = e.target.closest('[data-emp]');
      if (emp) {
        state.pick = state.pick === emp.dataset.emp ? null : emp.dataset.emp;
        return rerender();
      }
      const md = e.target.closest('[data-mod]');
      if (md && state.pick) {
        const id = state.pick;
        const st = ch.mantras[id];
        if (st.stars >= MAX_STARS || !game.takeItem('mantra_spark', 1)) return;
        st.stars++;
        if (md.dataset.mod) {
          st.mods ||= [];
          st.mods.push(md.dataset.mod);
        }
        state.pick = null;
        G.audio.play('levelup');
        G.vfx.burst(G.player.center(), 'support', 40, { color: '#c8a8ff', speed: 5 });
        ui.toast(`${MANTRAS[id].name} grows stronger${md.dataset.mod ? ` - ${MODIFIERS[md.dataset.mod].name}` : ''}.`, 'good');
        game.save();
        rerender();
      }
    },
  });
  return true;
};
