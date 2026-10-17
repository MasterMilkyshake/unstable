// Foes the world's own life brings (agent/world-life): registered into ENEMIES at import, as
// data/guards.js does. Deserters hold the high places the Enclave's discipline never reached.
// (data/adventure.js has its own `deserter`, a lowland one; these are the crags'.)
import { ENEMIES } from './enemies.js';

// the Enclave's black and red, worn through and patched, the chain badge cut off
const DESERTER_LOOK = { skin: '#c9a283', hair: '#2a2018', outfit: { main: '#3a3532', trim: '#6e2a26', pants: '#2c2826', boots: '#1e1a18' }, armored: true, helm: null, cape: '#5a2622' };

export const WORLD_FOES = {
  crag_deserter: {
    name: 'Enclave Deserter', model: 'humanoid', level: 11, hp: 300, posture: 165, speed: 5.6, aggro: 20, xp: 200, silver: [12, 24],
    weapon: 'cutlass', dmgMul: 1.0, critChance: 0.2, comboMax: 3, feintChance: 0.15,
    defend: { block: 0.32, parry: 0.18, dodge: 0.08 }, knockable: true, leash: 40,
    look: DESERTER_LOOK,
    drops: [{ id: 'writ_scrap', chance: 0.35 }, { id: 'iron_draught', chance: 0.08 }],
  },
  crag_deserter_arbalist: {
    name: 'Deserter Arbalist', model: 'humanoid', level: 11, hp: 230, posture: 130, speed: 5.4, aggro: 30, xp: 210, silver: [12, 24],
    weapon: 'duelist_rapier', dmgMul: 0.9, critChance: 0.15, comboMax: 2,
    defend: { block: 0.12, parry: 0.15, dodge: 0.25 }, knockable: true, leash: 40,
    role: 'ranged', keep: [10, 20], // group AI (agent/systems): stays back behind the swords
    ranged: { id: 'bolt', windup: 0.7, recovery: 0.5, range: 28, minRange: 5, dmg: 15, posture: 10, cd: 3.4, proj: { speed: 42, color: '#3a3a40', size: 0.16, rod: true } },
    look: { ...DESERTER_LOOK, hood: true },
    drops: [{ id: 'writ_scrap', chance: 0.35 }],
  },
};

Object.assign(ENEMIES, WORLD_FOES);
