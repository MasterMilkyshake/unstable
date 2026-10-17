// Shrine of Order: refund every invested attribute point and trait point, for a price.
// Gear whose requirements are no longer met is unequipped.
import { G } from '../core/globals.js';
import { ACTIONS } from './hooks.js';
import { RACE_BY_ID } from '../data/races.js';
import { WEAPONS } from '../data/weapons.js';
import { OUTFITS } from '../data/items.js';
import { TRINKETS } from '../data/trinkets.js';
import { newAttrs, meetsReqs, totalPoints } from '../data/stats.js';
import { openPanel } from '../ui/panel.js';
import { START_ATTUNEMENT } from '../data/origins.js';

export function respecCost(ch) {
  return 60 + ch.level * 25;
}

export function respec(game) {
  const ch = game.ch;
  const p = G.player;
  const attrs = newAttrs();
  const race = RACE_BY_ID[ch.race];
  for (const k in race.bonus) attrs[k] += race.bonus[k];
  if (ch.startAttune in attrs) attrs[ch.startAttune] += START_ATTUNEMENT.bonus; // creation's gift stays, like the race's
  ch.attrs = attrs;
  ch.points = totalPoints(ch); // the points earned toward the next Power come back too
  if (ch.traits) for (const k in ch.traits) ch.traits[k] = 0;
  // unequip what no longer fits
  const w = p.weaponItem();
  if (w && !meetsReqs(WEAPONS[w.id].reqs, ch.attrs)) p.equipWeapon(null);
  if (!meetsReqs((OUTFITS[ch.equipped.outfit] || {}).reqs, ch.attrs)) p.equipOutfit('rags', true);
  if (ch.gear) {
    for (const slot in ch.gear) {
      const t = (ch.trinkets || []).find((x) => x.uid === ch.gear[slot]);
      if (t && !meetsReqs(TRINKETS[t.id].reqs, ch.attrs)) ch.gear[slot] = null;
    }
  }
  p.recompute();
  p.refreshWeapon();
}

export function openOrderShrine(ui) {
  const game = ui.game;
  const ch = game.ch;
  const render = () => {
    const cost = Math.round(respecCost(ch) * G.player.derived.priceMul);
    const invested = Object.values(ch.attrs).reduce((a, b) => a + b, 0);
    return `<h2>SHRINE OF ORDER</h2>
      <p style="text-align:center;font-style:italic">A cube of black stone turns slowly above the altar, perfectly balanced. Kneel, and the shape you have made of yourself is undone.</p>
      <div class="card" style="margin:10px 0"><div class="cd2">All attribute investment is refunded (<b class="gold">${ch.points + invested - raceBonusTotal(ch)}</b> points to spend again) and your Trait points return to you.
      Talents, mantras, your Vow and your Power remain. Equipment you can no longer use is unequipped.</div></div>
      <div class="row-flex"><span class="muted">Offering: <b class="gold">${cost} silver</b> (you have ${ch.silver})</span><span class="space"></span><button class="btn" data-a="close">Leave</button><button class="btn primary" data-a="kneel" ${ch.silver < cost ? 'disabled' : ''}>Kneel</button></div>`;
  };
  openPanel(ui, 'order', {
    width: 600,
    render,
    onClick: (e, rerender) => {
      if (!e.target.closest('[data-a="kneel"]')) return;
      const cost = Math.round(respecCost(ch) * G.player.derived.priceMul);
      if (ch.silver < cost) return;
      if (G.player.inDanger) return ui.toast('The shrine will not answer while you are in danger.', 'bad');
      ch.silver -= cost;
      respec(game);
      G.audio.play('bell', { vol: 0.6 });
      G.vfx.burst(G.player.center(), 'support', 60, { color: '#e8e4dc', speed: 6, up: 4 });
      G.vfx.ring(G.player.pos, 'support', 4, 0.8, { color: '#e8e4dc' });
      ui.closeModal();
      ui.banner('UNMADE');
      ui.toast('Your attributes are yours to shape again [Tab].', 'good');
      game.save();
    },
  });
}

function raceBonusTotal(ch) {
  const r = RACE_BY_ID[ch.race];
  return Object.values(r.bonus).reduce((a, b) => a + b, 0);
}

ACTIONS.openOrder = (ui) => openOrderShrine(ui || G.ui);
