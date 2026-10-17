// The Keepers' strongbox: every inn's host keeps the coast's ledger of what lodgers leave in
// their care, so one account answers at any inn. What is in it is safe from death (game/loot.js
// takes only what you carry). It holds silver without limit and LOOT.bankSlots stacks,
// weapons and trinkets. Kept with the character (ch.bank); a wipe loses it.
import { G } from '../core/globals.js';
import { ACTIONS, START_HOOKS } from './hooks.js';
import { LOOT } from '../data/loot.js';
import { RARITY_COLORS } from '../data/weapons.js';
import { cleanContents, entriesOf, takeEntry, addContents, carried, takeFromInventory, slotsUsed, contentsEmpty } from '../core/contents.js';
import { openPanel } from '../ui/panel.js';
import { escapeHtml } from '../core/util.js';
import { grant } from './loot.js';

START_HOOKS.push((game, ch) => {
  ch.bank = cleanContents(ch.bank);
});

// Would this deposit need a new slot the strongbox doesn't have?
function wouldFit(bank, key) {
  if (key === 'silver') return true;
  if (key.startsWith('item:') && bank.items[key.slice(5)]) return true;
  return slotsUsed(bank) < LOOT.bankSlots;
}

export function deposit(ch, key, n) {
  ch.bank = ch.bank || cleanContents(null);
  if (!wouldFit(ch.bank, key)) return { error: `The strongbox is full (${LOOT.bankSlots} slots).` };
  const { contents, refused } = takeFromInventory(ch, [{ key, n }]);
  if (refused.length) return { error: refused[0] };
  if (contentsEmpty(contents)) return { error: 'Nothing to deposit.' };
  addContents(ch.bank, contents);
  return { ok: true };
}
export function withdraw(game, key, n) {
  const got = takeEntry(game.ch.bank, key, n);
  if (!got) return { error: 'It is not in the strongbox.' };
  grant(game, got);
  return { ok: true };
}

ACTIONS.openBank = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  if (game.inRift) return ui.toast('No Keeper keeps a ledger down here.', 'bad');
  ch.bank = cleanContents(ch.bank);
  const silverStep = (have) => Math.max(1, Math.min(have, 50));
  const row = (e, side) => {
    const qty = e.kind === 'item' || e.kind === 'silver';
    const one = e.kind === 'silver' ? silverStep(e.n) : 1;
    const act = side === 'carried' ? 'dep' : 'wd';
    const verb = side === 'carried' ? 'Deposit' : 'Take out';
    const btns = e.keep ? `<span class="muted" style="font-size:12px">${escapeHtml(e.keep)}</span>`
      : qty && e.n > one ? `<button class="btn small" data-${act}="${e.key}" data-n="${one}">${e.kind === 'silver' ? one : 1}</button><button class="btn small primary" data-${act}="${e.key}">All</button>`
        : `<button class="btn small primary" data-${act}="${e.key}">${verb}</button>`;
    return `<div class="shop-row loot-row ${e.keep ? 'kept' : ''}"><div style="flex:1;min-width:0"><div class="nm" ${e.rarity ? `style="color:${RARITY_COLORS[e.rarity]}"` : ''}>${escapeHtml(e.name)} <span class="muted">${e.kind === 'silver' ? e.n : e.n > 1 ? '×' + e.n : ''}</span></div></div>${btns}</div>`;
  };
  const render = () => {
    const mine = carried(ch);
    const banked = entriesOf(ch.bank);
    return `<h2>THE KEEPERS' STRONGBOX</h2><p class="muted" style="text-align:center;margin-top:0">"Whatever you leave with us waits at any inn on the coast. The sea can take you; it can't take this." What is in the strongbox is safe when you die.</p>
      <div class="bank-cols">
        <div><h3>YOU CARRY</h3><div class="shop-list scroll">${mine.map((e) => row(e, 'carried')).join('') || '<div class="muted">Nothing.</div>'}</div></div>
        <div><h3>IN THE STRONGBOX <span class="muted" style="font-size:12px">${slotsUsed(ch.bank)}/${LOOT.bankSlots}</span></h3><div class="shop-list scroll">${banked.map((e) => row(e, 'bank')).join('') || '<div class="muted">Empty.</div>'}</div></div>
      </div>
      <div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Done</button></div>`;
  };
  openPanel(ui, 'bank', {
    width: 900,
    render,
    onClick: (e, rerender) => {
      const b = e.target.closest('[data-dep],[data-wd]');
      if (!b) return;
      const n = b.dataset.n ? Number(b.dataset.n) : undefined;
      const r = b.dataset.dep ? deposit(ch, b.dataset.dep, n) : withdraw(game, b.dataset.wd, n);
      if (r.error) ui.toast(r.error, 'bad');
      else G.audio.play(b.dataset.dep ? 'coin' : 'ui', { vol: 0.5 });
      ui.refreshHotbar();
      game.player.recompute && game.player.recompute();
      game.save();
      rerender();
    },
  });
  if (ACTIONS.tip) ACTIONS.tip('bank');
};
