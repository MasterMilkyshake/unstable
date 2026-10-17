// Bells: rare mantras granted by great foes (Deepwoken-style). Slaying a boss whose bell you
// do not own teaches it immediately and slots it into a free hotbar key.
import { G } from '../core/globals.js';
import { KILL_HOOKS, ACTIONS } from './hooks.js';
import { MANTRAS } from '../data/mantras.js';

export const BELL_FOR_BOSS = {};
for (const id in MANTRAS) if (MANTRAS[id].bell) BELL_FOR_BOSS[MANTRAS[id].bell] = id;

export function grantBell(game, id) {
  const ch = game.ch;
  if (!MANTRAS[id] || ch.mantras[id]) return false;
  ch.mantras[id] = { stars: 0 };
  const free = ch.hotbar.findIndex((x, i) => i > 0 && i < 8 && !x);
  if (free > 0) ch.hotbar[free] = { type: 'mantra', id };
  G.ui.refreshHotbar();
  setTimeout(() => {
    G.audio.play('bell', { pitch: 0.8 });
    // the banner shows its title alone; which mantra, and where it went, is the toast's
    G.ui.banner('A BELL TOLLS');
    G.ui.toast(`${MANTRAS[id].name}${free > 0 ? `: slot ${(free + 1) % 10}` : ': assign it in [Tab]'}`, 'good');
  }, 2600);
  G.player && G.vfx.burst(G.player.center(), 'support', 60, { color: '#ffe9a3', speed: 6, up: 5 });
  game.save();
  return true;
}

KILL_HOOKS.push((game, e) => {
  const id = BELL_FOR_BOSS[e.type];
  if (id) grantBell(game, id);
});

ACTIONS.grantBell = (id) => grantBell(G.game, id);
