// Weapon tempering at Dorran's forge: +1..+3 per weapon, paid in silver, Smithing Stones
// and Star Shards. The equipped weapon's temper adds damage and posture damage.
import { G } from '../core/globals.js';
import { ACTIONS, MOD_PROVIDERS, KILL_HOOKS } from './hooks.js';
import { WEAPONS, WEAPON_CLASSES, RARITY_COLORS, weaponDisplayName } from '../data/weapons.js';
import { ITEMS } from '../data/items.js';
import { escapeHtml } from '../core/util.js';
import { openPanel } from '../ui/panel.js';

export const TEMPER_MAX = 3;
const TIERS = [
  null,
  { silver: 120, needs: { smithing_stone: 2 } },
  { silver: 320, needs: { smithing_stone: 4, star_shard: 1 } },
  { silver: 700, needs: { smithing_stone: 6, star_shard: 3 } },
];
const RARITY_MUL = { common: 1, uncommon: 1.3, rare: 1.7, epic: 2.2, legendary: 3 };
const PER = { physDmg: 0.07, postureDmg: 0.05 };

export function temperCost(item) {
  const next = (item.temper || 0) + 1;
  const t = TIERS[next];
  if (!t) return null;
  return { tier: next, silver: Math.round(t.silver * (RARITY_MUL[WEAPONS[item.id].rarity] || 1)), needs: t.needs };
}

MOD_PROVIDERS.push((player) => {
  const it = player.weaponItem && player.weaponItem();
  const n = it ? it.temper || 0 : 0;
  if (!n) return null;
  return { physDmg: PER.physDmg * n, postureDmg: PER.postureDmg * n };
});

// Smithing stones: a small chance from any foe, a handful from great foes.
KILL_HOOKS.push((game, e) => {
  if (e.boss) game.giveItem('smithing_stone', 2 + Math.floor(Math.random() * 2));
  else if (Math.random() < 0.06 + e.level * 0.004) game.giveItem('smithing_stone', 1);
});

ACTIONS.openTemper = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  const p = G.player;
  const can = (c) => ch.silver >= c.silver && Object.entries(c.needs).every(([k, n]) => (ch.inventory.items[k] || 0) >= n);
  openPanel(ui, 'temper', {
    width: 760,
    render: () => {
      const rows = ch.inventory.weapons.map((it) => {
        const w = WEAPONS[it.id];
        if (!w || w.hidden) return '';
        const t = it.temper || 0;
        const c = temperCost(it);
        const eq = ch.equipped.weapon === it.uid;
        const pips = Array.from({ length: TEMPER_MAX }, (_, i) => `<i class="${i < t ? 'on' : ''}"></i>`).join('');
        let cost = '<span class="muted">Fully tempered</span>';
        if (c) {
          const needs = Object.entries(c.needs).map(([k, n]) => `<span class="${(ch.inventory.items[k] || 0) >= n ? 'good' : 'bad'}">${ITEMS[k].name} ${ch.inventory.items[k] || 0}/${n}</span>`).join(', ');
          cost = `<span class="${ch.silver >= c.silver ? 'good' : 'bad'}">${c.silver} silver</span>, ${needs}`;
        }
        return `<div class="shop-row"><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[w.rarity]}">${escapeHtml(weaponDisplayName(it))}${eq ? ' <span class="pill">equipped</span>' : ''}</div>
          <div class="ds">${WEAPON_CLASSES[w.cls].label}, +${Math.round(PER.physDmg * t * 100)}% damage, +${Math.round(PER.postureDmg * t * 100)}% posture</div><div class="ds">${cost}</div></div>
          <div class="trait-pips" style="margin-right:8px">${pips}</div><button class="btn small primary" data-temper="${it.uid}" ${c && can(c) ? '' : 'disabled'}>Temper</button></div>`;
      }).join('') || '<div class="muted">You carry no weapons worth tempering.</div>';
      return `<h2>TEMPERING</h2><p class="muted" style="text-align:center;margin-top:0">"Every fold drives the weakness out. Three folds is all good steel can take." Each temper adds 7% damage and 5% posture damage while the weapon is wielded.</p>
        <div class="shop-list scroll">${rows}</div><div class="divider"></div>
        <div class="row-flex"><span class="muted" style="font-size:13px">Smithing Stones drop from foes and are sold here. Star Shards come from fallen stars.</span><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`;
    },
    onClick: (e, rerender) => {
      const b = e.target.closest('[data-temper]');
      if (!b) return;
      const it = ch.inventory.weapons.find((w) => w.uid === b.dataset.temper);
      const c = it && temperCost(it);
      if (!c || !can(c)) return;
      ch.silver -= c.silver;
      for (const [k, n] of Object.entries(c.needs)) game.takeItem(k, n);
      it.temper = c.tier;
      p.recompute();
      G.audio.play('steel', { pitch: 0.9 });
      G.audio.play('hitHeavy', { pitch: 1.3, vol: 0.5 });
      G.vfx.sparks(p.center(), null, '#ffb84a', 30);
      ui.toast(`${weaponDisplayName(it)} - the steel holds.`, 'good');
      game.save();
      rerender();
    },
  });
};
