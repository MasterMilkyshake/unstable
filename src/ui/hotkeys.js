// Extra hotkeys for content-session panels. Each key toggles its panel while playing.
import { G } from '../core/globals.js';
import { ACTIONS } from '../game/hooks.js';
import { BIND } from '../core/input.js';

// code -> { modal id, action name, label }; the keys come from BIND
export const HOTKEYS = {};
for (const code of BIND.journal) HOTKEYS[code] = { id: 'journal', action: 'openJournal', label: 'Journal' };
for (const code of BIND.backpack) HOTKEYS[code] = { id: 'charmenu', action: 'openBackpack', label: 'Backpack' };
ACTIONS.openBackpack = (ui = G.ui) => ui.openCharMenu('inventory');

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const hk = HOTKEYS[e.code];
  if (!hk) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const game = G.game;
  if (!game || game.state !== 'playing' || !game.player || game.player.dead) return;
  const ui = G.ui;
  if (ui.modal) {
    if (ui.modal.id === hk.id) ui.closeModal();
    return;
  }
  if (ACTIONS[hk.action]) ACTIONS[hk.action](ui);
});
