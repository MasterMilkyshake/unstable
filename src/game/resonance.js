// Resonances (Deepwoken "Murmurs"): at Power 15 the Vowkeeper attunes you to one resonance -
// a passive bonus plus an active ability on [Z] with its own cooldown.
import { G } from '../core/globals.js';
import { ACTIONS, MOD_PROVIDERS, UPDATE_HOOKS } from './hooks.js';
import { MANTRAS } from '../data/mantras.js';
import { makeCastDef } from '../combat/mantraRuntime.js';
import { escapeHtml } from '../core/util.js';
import { BIND } from '../core/input.js';
import { openPanel } from '../ui/panel.js';

export const RESONANCES = {
  ardour: { name: 'Ardour', mantra: 'res_ardour', color: '#ff8a3a', passive: { speed: 0.05, runAtk: 0.1, ardourBurn: true }, passiveText: '+5% speed; running attacks deal 10% more and set foes alight.' },
  tacet: { name: 'Tacet', mantra: 'res_tacet', color: '#a274ff', passive: { stealth: 0.2, tacet: true }, passiveText: 'Enemies notice you from 20% closer, and your blows on a foe whose eyes are on someone else deal 15% more.' },
  rhythm: { name: 'Rhythm', mantra: 'res_rhythm', color: '#ffe9a3', passive: { etherRegen: 0.12, parryWindow: 0.01, rhythm: true }, passiveText: '+12% ether regen, parry window +10ms, and each parry that lands restores 8 ether.' },
  sanguine: { name: 'Sanguine', mantra: 'res_sanguine', color: '#e0243f', passive: { lifesteal: 0.015, sanguine: true }, passiveText: 'Heal for 1.5% of all damage dealt, three times as much from a bleeding foe.' },
  updraft: { name: 'Updraft', mantra: 'res_updraft', color: '#a6ffd2', passive: { fallResist: 0.6, latches: 1, updraftChase: true }, passiveText: 'Fall damage reduced, one more ledge catch or wall hop, and twice as long to leap after a foe you launch.' },
};
export const RESONANCE_POWER = 15;
const RETUNE_COST = 500;

function state(ch) {
  return ch.resonance || null;
}

MOD_PROVIDERS.push((player) => {
  const r = player.ch && state(player.ch);
  return r && RESONANCES[r.id] ? RESONANCES[r.id].passive : null;
});

export function useResonance(game) {
  const p = game.player;
  const ch = game.ch;
  const r = state(ch);
  if (!p || !r || !RESONANCES[r.id]) return;
  if (!game.controlsEnabled() || p.dead || p.knocked || p.stunned || p.atk || p.swimming || p.climbing || p.gripT > 0) return;
  if (r.cd > 0) return G.ui.toast(`${RESONANCES[r.id].name} is recovering (${Math.ceil(r.cd)}s).`);
  const id = RESONANCES[r.id].mantra;
  const m = MANTRAS[id];
  if (m.hpCost) {
    if (p.hp <= p.maxHp * m.hpCost + 1) return G.ui.toast('You have too little blood to spare.', 'bad');
    p.hp -= p.maxHp * m.hpCost;
  }
  r.cd = m.cd;
  const def = makeCastDef(p, id, () => game.getAim(30));
  p.beginAttack(def);
  G.audio.play('cast', { pitch: 0.8, vol: 0.7 });
  if (m.type === 'support' || m.type === 'combat') p.refreshDanger(6);
}

window.addEventListener('keydown', (e) => {
  if (!BIND.resonance.includes(e.code) || e.repeat) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  const game = G.game;
  if (game && game.state === 'playing' && game.ch) useResonance(game);
});

// cooldown + HUD readout
let hud = null;
let hudT = 0;
UPDATE_HOOKS.push((game, dt) => {
  const r = game.ch && state(game.ch);
  if (r && r.cd > 0) r.cd = Math.max(0, r.cd - dt);
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.2;
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'x-res';
    hud.style.cssText = 'position:absolute;left:50%;bottom:104px;transform:translateX(-50%);font-family:var(--display);font-size:11px;letter-spacing:0.08em;pointer-events:none;text-shadow:0 1px 3px #000,0 0 2px #000;z-index:4';
    document.body.appendChild(hud);
  }
  const hudEl = document.getElementById('hud');
  const visible = r && RESONANCES[r.id] && game.state === 'playing' && !G.ui.modal && !(hudEl && hudEl.classList.contains('hidden'));
  hud.style.display = visible ? '' : 'none';
  if (visible) {
    const def = RESONANCES[r.id];
    hud.innerHTML = r.cd > 0 ? `<span style="color:#8a8478">Z · ${def.name.toUpperCase()} ${Math.ceil(r.cd)}s</span>` : `<span style="color:${def.color}">Z · ${def.name.toUpperCase()}</span>`;
  }
});

ACTIONS.openResonances = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  const cur = state(ch);
  const render = () => `<h2>RESONANCE</h2>
    <p style="text-align:center;font-style:italic;margin-top:0">"Beneath the oath there is a second voice. It has always been singing. Choose which note is yours."</p>
    ${cur ? `<p class="muted" style="text-align:center">You resonate with <b style="color:${RESONANCES[cur.id].color}">${RESONANCES[cur.id].name}</b>. Changing it costs ${RETUNE_COST} silver.</p>` : ''}
    <div class="shop-list scroll">${Object.entries(RESONANCES).map(([k, r]) => {
      const m = MANTRAS[r.mantra];
      const mine = cur && cur.id === k;
      return `<div class="shop-row"><div style="flex:1"><div class="nm" style="color:${r.color}">${r.name}${mine ? ' <span class="pill">attuned</span>' : ''}</div><div class="ds"><b>[Z]</b> ${escapeHtml(m.desc.replace(/^Resonance\. /, ''))} <span class="muted">(${m.cd}s)</span></div><div class="ds">Passive: ${escapeHtml(r.passiveText)}</div></div>
        <button class="btn small ${mine ? '' : 'primary'}" data-res="${k}" ${mine || (cur && ch.silver < RETUNE_COST) ? 'disabled' : ''}>${mine ? 'Attuned' : cur ? 'Retune' : 'Attune'}</button></div>`;
    }).join('')}</div><div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`;
  openPanel(ui, 'resonance', {
    width: 720,
    render,
    onClick: (e) => {
      const b = e.target.closest('[data-res]');
      if (!b) return;
      if (cur) {
        if (ch.silver < RETUNE_COST) return;
        ch.silver -= RETUNE_COST;
      }
      ch.resonance = { id: b.dataset.res, cd: 0 };
      G.player.recompute();
      ui.closeModal();
      ui.banner(RESONANCES[b.dataset.res].name.toUpperCase());
      ui.toast('A second voice joins your own. Press [Z] to let it sing.', 'good');
      G.audio.play('bell', { pitch: 1.2 });
      game.save();
    },
  });
};
ACTIONS.useResonance = () => useResonance(G.game);
