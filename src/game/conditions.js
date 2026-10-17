// Conditional stat refresh: systems register functions that describe the current situation
// (day/night, in the Rift, low health...). When any description changes, the player's stats
// are recomputed so MOD_PROVIDERS that depend on the situation take effect.
import { UPDATE_HOOKS } from './hooks.js';

const CONDITIONS = []; // { fn(game) -> string, onChange?(game, now, before) }

export function registerCondition(fn, onChange) {
  CONDITIONS.push({ fn, onChange, last: '' });
}

let t = 0;
UPDATE_HOOKS.push((game, dt) => {
  t -= dt;
  if (t > 0 || !game.player || !game.ch) return;
  t = 0.25;
  let changed = false;
  for (const c of CONDITIONS) {
    let k = '';
    try {
      k = c.fn(game) || '';
    } catch (e) {
      console.error('[condition]', e);
    }
    if (k !== c.last) {
      const before = c.last;
      c.last = k;
      changed = true;
      if (c.onChange && before) c.onChange(game, k, before);
    }
  }
  if (changed) game.player.recompute();
});

export function isDay(game) {
  return !game.inRift && !game.world.sky.isNight();
}
