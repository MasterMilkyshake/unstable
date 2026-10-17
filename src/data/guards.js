// Faction guards and soldiers. Registered into ENEMIES at import (world.js imports this file).
// team 'guard' + faction: they patrol or hold posts, fight monsters near them, and only turn on a
// player who strikes them, is wanted, is hated, or is at war with their faction (game/factions.js).
import { ENEMIES } from './enemies.js';
import { ITEMS } from './items.js';

const WATCH_LOOK = { skin: '#c8956a', hair: '#3a2a1a', outfit: { main: '#9aa3ad', trim: '#2a4a7a', pants: '#2a3a5a', boots: '#2a2a2e' }, armored: true, helm: '#8a929c', cape: '#2a4a7a' };
const ENCLAVE_LOOK = { skin: '#d8b090', hair: '#1a1410', outfit: { main: '#26262c', trim: '#8e1f24', pants: '#1c1c22', boots: '#121216' }, armored: true, helm: '#4a4c52', cape: '#8e1f24' };
const MINISTRY_LOOK = { skin: '#c8b8a8', hair: '#5a5a60', outfit: { main: '#5a5a66', trim: '#a8acc0', pants: '#3a3a44', boots: '#202026' }, hood: true, eyes: '#c8d0ff', glowEyes: true };

export const GUARD_ENEMIES = {
  // ---- Saltreach Watch
  watch_guard: {
    name: 'Watch Guard', model: 'humanoid', level: 8, hp: 240, posture: 150, speed: 5.4, aggro: 18, xp: 80, silver: [4, 10],
    team: 'guard', faction: 'watch', weapon: 'steel_longsword', dmgMul: 0.9, critChance: 0.15, comboMax: 3,
    defend: { block: 0.4, parry: 0.15, dodge: 0.04 }, knockable: true, leash: 60,
    look: WATCH_LOOK,
    drops: [{ id: 'bread', chance: 0.3 }],
  },
  watch_pikeman: {
    name: 'Watch Pikeman', model: 'humanoid', level: 10, hp: 270, posture: 170, speed: 5.0, aggro: 20, xp: 100, silver: [6, 12],
    team: 'guard', faction: 'watch', weapon: 'watch_pike', dmgMul: 0.9, critChance: 0.2, comboMax: 2,
    defend: { block: 0.35, parry: 0.1, dodge: 0.02 }, knockable: true, leash: 60,
    look: { ...WATCH_LOOK, cape: null },
    drops: [{ id: 'waterskin', chance: 0.1 }],
  },
  // ---- the Enclave: Peacekeepers in the field, its captains at Fort Meridian
  peacekeeper: {
    name: 'Peacekeeper', model: 'humanoid', level: 13, hp: 330, posture: 180, speed: 5.6, aggro: 20, xp: 230, silver: [10, 22],
    team: 'guard', faction: 'enclave', weapon: 'cutlass', dmgMul: 1.0, critChance: 0.2, comboMax: 3, feintChance: 0.18,
    defend: { block: 0.38, parry: 0.2, dodge: 0.06 }, knockable: true, leash: 70,
    look: ENCLAVE_LOOK,
    drops: [{ id: 'iron_draught', chance: 0.06 }, { id: 'writ_scrap', chance: 0.5 }],
  },
  peacekeeper_halberdier: {
    name: 'Peacekeeper Halberdier', model: 'humanoid', level: 14, hp: 360, posture: 200, speed: 5.0, aggro: 22, xp: 260, silver: [12, 24],
    team: 'guard', faction: 'enclave', weapon: 'watch_pike', dmgMul: 1.05, critChance: 0.25, comboMax: 2,
    defend: { block: 0.42, parry: 0.1, dodge: 0.02 }, knockable: true, leash: 70,
    look: { ...ENCLAVE_LOOK, cape: null },
    drops: [{ id: 'writ_scrap', chance: 0.5 }],
  },
  peacekeeper_arbalist: {
    name: 'Peacekeeper Arbalist', model: 'humanoid', level: 13, hp: 260, posture: 140, speed: 5.4, aggro: 30, xp: 240, silver: [10, 22],
    team: 'guard', faction: 'enclave', weapon: 'duelist_rapier', dmgMul: 0.9, critChance: 0.15, comboMax: 2,
    defend: { block: 0.15, parry: 0.15, dodge: 0.25 }, knockable: true, leash: 70,
    perch: true, // spawns on the wall walk over its post, not in the street below (world/spawnSpot.js)
    ranged: { id: 'bolt', windup: 0.7, recovery: 0.5, range: 28, minRange: 5, dmg: 16, posture: 10, cd: 3.2, proj: { speed: 42, color: '#3a3a40', size: 0.16, rod: true } },
    look: { ...ENCLAVE_LOOK, helm: null, hood: true },
    drops: [{ id: 'writ_scrap', chance: 0.5 }],
  },
  enclave_captain: {
    name: 'Enclave Captain', title: 'Of the Vice Warden\'s guard', model: 'humanoid', level: 17, hp: 640, posture: 300, speed: 5.0, aggro: 22, xp: 520, silver: [24, 48],
    team: 'guard', faction: 'enclave', weapon: 'iron_greatsword', dmgMul: 1.15, critChance: 0.3, comboMax: 3, scale: 1.14,
    defend: { block: 0.45, parry: 0.12, dodge: 0 }, knockable: false, leash: 60,
    look: { ...ENCLAVE_LOOK, helm: '#2c2e34', armored: true, eyes: '#ff7a6a', glowEyes: true },
    drops: [{ id: 'writ_scrap', chance: 1 }, { id: 'mantra_spark', chance: 0.15 }],
  },
  // ---- the Ministry of Soundings
  ministry_soundsman: {
    name: 'Ministry Soundsman', model: 'humanoid', level: 14, hp: 280, posture: 150, speed: 5.6, aggro: 18, xp: 250, silver: [12, 24],
    team: 'guard', faction: 'ministry', weapon: 'duelist_rapier', dmgMul: 0.95, critChance: 0.2, comboMax: 3,
    mantras: ['umbral_orb', 'gale_palm'], mantraChance: 0.35, mantraPower: 1.0,
    defend: { block: 0.2, parry: 0.25, dodge: 0.2 }, knockable: true, leash: 60,
    look: MINISTRY_LOOK,
    drops: [{ id: 'sanity_draught', chance: 0.15 }],
  },
  ministry_silencer: {
    name: 'Ministry Silencer', model: 'humanoid', level: 15, hp: 240, posture: 120, speed: 6.4, aggro: 16, xp: 280, silver: [14, 28],
    team: 'guard', faction: 'ministry', weapon: 'serrated_shiv', dmgMul: 1.0, critChance: 0.3, comboMax: 4,
    defend: { block: 0.05, parry: 0.2, dodge: 0.4 }, knockable: true, leash: 60,
    look: { ...MINISTRY_LOOK, outfit: { main: '#2e2e36', trim: '#8a8ea8', pants: '#22222a', boots: '#18181c' } },
    drops: [{ id: 'cleansing_salts', chance: 0.2 }],
  },
};

Object.assign(ENEMIES, GUARD_ENEMIES);

export const REALM_ITEMS = {
  writ_scrap: { name: 'Writ Scrap', type: 'material', price: 0, sell: 6, icon: '📜', desc: 'A torn page of an Enclave writ, stamped with the chain seal. The Watch pays for proof of where the Peacekeepers have been.' },
  registry_papers: { name: 'Registry Papers', type: 'quest', price: 0, icon: '🪪', desc: 'Your name, entered in the Enclave’s Registry of Returned Persons. Peacekeepers let papered folk pass; the Citadel opens to them.' },
  grey_letter: { name: 'A Letter Sealed in Grey', type: 'quest', price: 0, icon: '✉️', desc: 'Grey wax, no crest. Inside, in a careful clerk’s hand: “The bell in the Hush rings for you. Come and listen.”' },
  chain_seal: { name: 'The Chain Seal', type: 'quest', price: 0, icon: '⛓️', desc: 'An iron seal cast from the Anchor’s own die. It claims the command chain for whoever carries it.' },
};
for (const id in REALM_ITEMS) ITEMS[id] ||= REALM_ITEMS[id];
