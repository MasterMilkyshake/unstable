// Detects enemy deaths each frame and fires KILL_HOOKS for kills the local player
// should be credited for (they dealt the blow, or were nearby).
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, KILL_HOOKS } from './hooks.js';

const seen = new WeakSet();

UPDATE_HOOKS.push((game) => {
  const p = game.player;
  if (!p) return;
  for (const a of G.actors) {
    if (!a.dead || a.team !== 'enemy' || seen.has(a)) continue;
    seen.add(a);
    if (a.dummy || a.illusion || !a.spec) continue;
    const credited = a.lastAttacker === p || a.killer === p || p.pos.distanceTo(a.pos) < 60;
    if (!credited) continue;
    for (const f of KILL_HOOKS) {
      try {
        f(game, a);
      } catch (e) {
        console.error('[kill hook]', e);
      }
    }
  }
});
