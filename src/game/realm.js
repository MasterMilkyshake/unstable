// The realm: world-layout systems owned together — regional mist, save migration for the
// enlarged Anchorage, and the entry point for factions, the main story and the world map.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, ACTIONS } from './hooks.js';
import { WORLD_LAYOUT, migrateWorldPosition } from '../data/worldPlacement.js';
export { relocateLegacy } from '../data/worldPlacement.js';
import { islandAtPoint, regionAtPoint, DEFAULT_RESPAWN, STRUCTURES } from '../data/world.js';
import { damp } from '../core/util.js';
import { factionDialogueApi } from './factions.js';
import '../data/storyDialogue.js'; // storyline NPC dialogue
import '../ui/realm.css';

// ---------------------------------------------------------------- regional mist
// Each landmass keeps its own air: Saltreach's mint haze, the Hush's cold grey wall of fog.
const MIST = {
  sea: { color: '#b0ccc5', amt: 0.35, density: 1 },
  the_wash: { color: '#b9d3cc', amt: 0.35, density: 1 },
  saltreach: { color: '#a6c8bb', amt: 0.55, density: 0.82 },
  thornwood: { color: '#9cbca3', amt: 0.55, density: 0.75 },
  shimmerfen: { color: '#a5b298', amt: 0.62, density: 0.62 },
  frosthollow: { color: '#d6e0e8', amt: 0.6, density: 0.68 },
  ashen_spire: { color: '#aaa68f', amt: 0.52, density: 0.74 },
  verdance: { color: '#94c2a3', amt: 0.6, density: 0.66 },
  meridian: { color: '#a6aeb2', amt: 0.5, density: 0.82 },
  the_hush: { color: '#c0c7ce', amt: 0.85, density: 0.3 },
  anchor_rock: { color: '#acc9c2', amt: 0.45, density: 0.85 },
};
const mist = { color: new THREE.Color(MIST.sea.color), amt: 0, density: 1 };
const _target = new THREE.Color();
let mistT = 0;
let mistKey = 'sea';

UPDATE_HOOKS.push((game, dt) => {
  const sky = game.world.sky;
  sky.mist = mist;
  const p = game.player;
  if (!p) return;
  mistT -= dt;
  if (mistT <= 0) {
    mistT = 0.5;
    const hit = game.inRift ? null : islandAtPoint(p.pos.x, p.pos.z, 1.15);
    const region = hit ? regionAtPoint(p.pos.x, p.pos.z) : null;
    mistKey = region && MIST[region.id] ? region.id : hit && MIST[hit.island.id] ? hit.island.id : 'sea';
  }
  const m = MIST[mistKey];
  _target.set(m.color);
  const k = Math.min(1, dt * 0.6);
  mist.color.lerp(_target, k);
  mist.amt = damp(mist.amt, m.amt, 0.6, dt);
  mist.density = damp(mist.density, m.density, 0.6, dt);
});

// ---------------------------------------------------------------- layout migration
export function migrateLayout(ch) {
  const changed = migrateWorldPosition(ch);
  if (!ch.spawn) ch.spawn = { ...DEFAULT_RESPAWN };
  return changed;
}

ACTIONS.beforeStart = (game, ch, isNew) => {
  if (isNew) {
    ch.worldLayout = WORLD_LAYOUT;
    return;
  }
  const from = ch.worldLayout || 1;
  if (migrateLayout(ch) && ch.pos) {
    ch.pos.y = -100; // startGame lifts it onto the ground
    const news = from >= 3 ? 'The Hush lies against Frosthollow’s southern shore now.' : 'The Anchorage is larger than you remember.';
    setTimeout(() => G.ui && G.ui.toast(`The isles have shifted since you last slept. ${news}`, 'quest'), 3000);
  }
};

// ---------------------------------------------------------------- dialogue helpers
// Extra api for NPC dialogue functions: story flags, faction standing, fines.
const DIALOGUE_EXT = [
  (ui) => factionDialogueApi(ui.game),
  (ui) => {
    const ch = ui.game.ch;
    ch.flags ||= {};
    return {
      flag: (k) => !!ch.flags[k],
      setFlag: (k, v = true) => {
        ch.flags[k] = v;
        ui.game.quests.onFlag(k);
      },
      giveItem: (id, n = 1) => ui.game.giveItem(id, n),
      takeItem: (id, n = 1) => ui.game.takeItem(id, n),
      hasItem: (id, n = 1) => (ch.inventory.items[id] || 0) >= n,
      silver: () => ch.silver,
      bossDefeated: (id) => (ch.bossesDefeated || []).includes(id),
      get ending() {
        return ch.flags.ending || null;
      },
    };
  },
];
export function registerDialogueExt(fn) {
  DIALOGUE_EXT.push(fn);
}
ACTIONS.dialogueApi = (ui, npc) => Object.assign({}, ...DIALOGUE_EXT.map((f) => f(ui, npc)));
