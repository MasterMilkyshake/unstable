// Underground: the dungeons (world/dungeons.js) shut out the weather while you're inside them.
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, ACTIONS } from './hooks.js';
import { inDungeonBand } from '../data/dungeons.js';

UPDATE_HOOKS.push((game) => {
  const p = game.player;
  if (!p) return;
  const inside = inDungeonBand(p.pos.x, p.pos.z);
  if (inside !== !!game.inDungeon) {
    game.inDungeon = inside;
    // no rain, snow or lightning indoors; the surface weather resumes when you climb out
    if (ACTIONS.setWeather) ACTIONS.setWeather(inside ? 'clear' : null);
    if (inside && G.audio && G.audio.setWeather) G.audio.setWeather(0, 0);
  }
});
