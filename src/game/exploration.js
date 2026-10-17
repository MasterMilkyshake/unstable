import { G } from '../core/globals.js';
import { UPDATE_HOOKS, START_HOOKS } from './hooks.js';
import { ATLAS } from '../data/chronicle.js';
import { regionAtPoint, districtAtPoint, LOCATIONS } from '../data/world.js';

let elapsed = 0;
START_HOOKS.push((game, ch) => {
  ch.regions ||= [];
  elapsed = 1;
});
UPDATE_HOOKS.push((game, dt) => {
  elapsed += dt;
  if (elapsed < 1 || !game.player || game.player.dead || game.transitioning) return;
  elapsed = 0;
  const { x, z } = game.player.pos;
  const island = regionAtPoint(x, z);
  const district = districtAtPoint(x, z);
  const id = district?.id || island?.id;
  if (!id || game.ch.regions.includes(id)) return;
  const entry = ATLAS.find((a) => a.id === id);
  if (!entry) return;
  game.ch.regions.push(id);
  G.ui.toast(`${entry.title}: field notes added to your Atlas [J]`, 'quest');
  game.save();
});

// ---- discovering named places: a banner, a little experience, and a name on the map
START_HOOKS.push((game, ch) => {
  ch.discovered ||= [];
});
let scanT = 0;
UPDATE_HOOKS.push((game, dt) => {
  scanT -= dt;
  if (scanT > 0 || !game.player || game.player.dead || game.transitioning) return;
  scanT = 0.75;
  const ch = game.ch;
  ch.discovered ||= [];
  const { x, z } = game.player.pos;
  for (const l of LOCATIONS) {
    if (l.r > 150 || ch.discovered.includes(l.name)) continue; // whole islands are not "discovered"
    if (Math.hypot(x - l.x, z - l.z) > Math.min(l.r, 60)) continue;
    ch.discovered.push(l.name);
    const xp = 30 + ch.level * 8;
    game.player.addXp(xp);
    G.ui.toast(`Discovered: ${l.name}  ·  +${xp} XP`, 'quest');
    G.audio.play('quest', { vol: 0.45 });
    game.save();
    break;
  }
});
