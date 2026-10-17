// Campfire cooking: raw -> cooked, plus ingredient recipes that make buff meals.
// Opened when you sit at a campfire with raw food (interact.openCampfire).
import { G } from '../core/globals.js';
import { ITEMS, RECIPES } from '../data/items.js';
import { escapeHtml } from '../core/util.js';
import { openPanel } from '../ui/panel.js';

// Pseudo-ingredients that are not inventory items.
const PSEUDO = {
  waterskin_charge: { name: 'Water (waterskin charge)', icon: '💧', have: (ch) => ch.waterCharges || 0, take: (ch, n) => (ch.waterCharges -= n) },
};

function have(ch, id) {
  return PSEUDO[id] ? PSEUDO[id].have(ch) : ch.inventory.items[id] || 0;
}

export function canCook(ch, r) {
  for (const id in r.needs) if (have(ch, id) < r.needs[id]) return false;
  return true;
}

export function cookRecipe(game, r) {
  const ch = game.ch;
  if (!canCook(ch, r)) return false;
  for (const id in r.needs) {
    if (PSEUDO[id]) PSEUDO[id].take(ch, r.needs[id]);
    else game.takeItem(id, r.needs[id]);
  }
  game.giveItem(r.id, r.count || 1, true);
  ch.stats.mealsCooked = (ch.stats.mealsCooked || 0) + 1;
  return true;
}

function rawCount(ch) {
  let n = 0;
  for (const id in ch.inventory.items) if (ITEMS[id] && ITEMS[id].cook) n += ch.inventory.items[id];
  return n;
}

export function openCookMenu(ui) {
  const game = ui.game;
  const ch = game.ch;
  const render = () => {
    const raw = rawCount(ch);
    const rows = RECIPES.map((r) => {
      const it = ITEMS[r.id];
      const ok = canCook(ch, r);
      const needs = Object.entries(r.needs)
        .map(([id, n]) => {
          const def = PSEUDO[id] || ITEMS[id];
          const got = have(ch, id);
          return `<span class="${got >= n ? 'good' : 'bad'}">${escapeHtml(def.name)} ${got}/${n}</span>`;
        })
        .join(', ');
      return `<div class="shop-row"><div style="flex:1"><div class="nm">${escapeHtml(it.name)}</div><div class="ds">${escapeHtml(it.desc)}</div><div class="ds">${needs}</div></div><button class="btn small" data-cook="${r.id}" ${ok ? '' : 'disabled'}>Cook</button></div>`;
    }).join('');
    return `<h2>COOKING</h2>
      <div class="shop-row"><div style="flex:1"><div class="nm">Grill raw food</div><div class="ds">Cook every raw fish and cut of meat you carry (${raw}).</div></div><button class="btn small primary" data-a="raw" ${raw ? '' : 'disabled'}>Cook all</button></div>
      <h3>RECIPES</h3><div class="shop-list scroll">${rows}</div>
      <div class="divider"></div><div class="row-flex"><span class="muted" style="font-size:13px">Meals grant a lasting buff. Ingredients: forage bushes, hives, lilies and peppers, or buy from grocers.</span><span class="space"></span><button class="btn" data-a="close">Done</button></div>`;
  };
  openPanel(ui, 'cooking', {
    width: 720,
    render,
    onClick: (e, rerender) => {
      const c = e.target.closest('[data-cook]');
      if (c) {
        const r = RECIPES.find((x) => x.id === c.dataset.cook);
        if (r && cookRecipe(game, r)) {
          G.audio.play('ember', { vol: 0.5 });
          ui.toast(`Cooked ${ITEMS[r.id].name}.`, 'good');
          game.save();
        }
      }
      if (e.target.closest('[data-a="raw"]')) game.cook();
      rerender();
    },
  });
}
