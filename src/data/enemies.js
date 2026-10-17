// Enemy archetypes. Humanoids fight with real weapon movesets (and can defend);
// creatures use the `attacks` list.
// attack.type: melee (default) | projectile | aoe | leap | multi | summon | mantra

export const ENEMIES = {
  training_dummy: {
    name: 'Training Dummy', model: 'dummy', level: 0, hp: 400, posture: 120, speed: 0, aggro: 0, xp: 0, silver: [0, 0],
    radius: 0.45, height: 1.9, dummy: true, attacks: [],
  },
  mudlurker: {
    name: 'Mudlurker', model: 'lurker', level: 1, hp: 50, posture: 40, speed: 4.2, aggro: 15, xp: 22, silver: [1, 3],
    radius: 0.6, height: 0.9, size: 0.9, meleePad: 0.55,
    drops: [{ id: 'fish_raw', chance: 0.35 }],
    attacks: [
      { id: 'bite', windup: 0.48, active: 0.14, recovery: 0.55, range: 1.9, arc: 70, dmg: 7, posture: 9, lunge: 7, weight: 3 },
      { id: 'tongue', windup: 0.6, active: 0.12, recovery: 0.6, range: 4.2, arc: 30, dmg: 6, posture: 6, weight: 1, cd: 3 },
    ],
  },
  brigand: {
    name: 'Brigand', model: 'humanoid', level: 3, hp: 105, posture: 70, speed: 5.3, aggro: 22, xp: 55, silver: [6, 14],
    weapon: 'bronze_sword', dmgMul: 0.85, critChance: 0.15, comboMax: 3,
    defend: { block: 0.22, parry: 0.12, dodge: 0.08 }, knockable: true,
    look: { skin: '#c8956a', hair: '#2a1a10', outfit: { main: '#7a2a20', trim: '#2a1a14', pants: '#3a2a20', boots: '#1a1410' }, bandana: '#a8281c' },
    drops: [{ id: 'bread', chance: 0.25 }, { id: 'bounty_token', chance: 1 }, { id: 'herb', chance: 0.15 }],
  },
  brigand_brute: {
    name: 'Brigand Brute', model: 'humanoid', level: 5, hp: 175, posture: 115, speed: 4.6, aggro: 20, xp: 95, silver: [10, 22],
    weapon: 'woodcutter_axe', dmgMul: 0.93, critChance: 0.2, comboMax: 2, scale: 1.12,
    defend: { block: 0.3, parry: 0.04, dodge: 0 }, knockable: true,
    look: { skin: '#a8754a', hair: '#1a1410', outfit: { main: '#5a2018', trim: '#1a1410', pants: '#2a2018', boots: '#141010' }, bandana: '#a8281c' },
    drops: [{ id: 'meat_raw', chance: 0.4 }, { id: 'bounty_token', chance: 1 }, { id: 'woodcutter_axe', chance: 0.05, weapon: true }],
  },
  brigand_cutthroat: {
    name: 'Brigand Cutthroat', model: 'humanoid', level: 4, hp: 80, posture: 55, speed: 5.6, aggro: 18, xp: 70, silver: [8, 16],
    weapon: 'rusty_dagger', dmgMul: 0.75, critChance: 0.12, comboMax: 3,
    defend: { block: 0.08, parry: 0.08, dodge: 0.18 }, knockable: true,
    look: { skin: '#d8a578', hair: '#3a2010', outfit: { main: '#3a2a2a', trim: '#7a2a20', pants: '#2a2020', boots: '#141010' }, bandana: '#a8281c' },
    ranged: { id: 'knife', windup: 0.6, recovery: 0.5, range: 16, minRange: 6, dmg: 6, posture: 4, cd: 6.5, proj: { speed: 30, color: '#cfd6df', size: 0.18, rod: true } },
    drops: [{ id: 'bounty_token', chance: 1 }, { id: 'rusty_dagger', chance: 0.06, weapon: true }],
  },
  // A gloomowl hunts alone: three times a man's height at the tufts, one to a nest (its camps
  // hold one), so it is built to be a fight on its own. Its dive and screech do not break off.
  gloomowl: {
    name: 'Gloomowl', model: 'owl', level: 7, hp: 480, posture: 220, speed: 6.6, aggro: 22, xp: 300, silver: [14, 30],
    radius: 1.25, height: 4.6, size: 1.25,
    drops: [{ id: 'owl_feather', chance: 1, count: [2, 3] }, { id: 'meat_raw', chance: 0.6, count: [1, 2] }],
    attacks: [
      { id: 'peck', windup: 0.42, active: 0.14, recovery: 0.45, range: 3.8, arc: 60, dmg: 16, posture: 14, weight: 3, lunge: 4 },
      { id: 'talon_dive', type: 'leap', windup: 0.8, active: 0.4, recovery: 0.7, range: 14, minRange: 6, arc: 80, dmg: 26, posture: 24, weight: 2, cd: 6, hitRange: 3.4, hyperarmor: true },
      { id: 'gust', type: 'projectile', windup: 0.55, recovery: 0.5, range: 18, minRange: 5, dmg: 12, posture: 18, weight: 1.5, cd: 4, proj: { speed: 26, color: '#c8d4e0', size: 0.9, knockback: 10, element: 'gale' } },
      { id: 'screech', type: 'aoe', windup: 0.75, active: 0.1, recovery: 0.7, radius: 7.5, dmg: 6, posture: 36, unblockable: true, weight: 1, cd: 10, sound: 'screech', hyperarmor: true },
    ],
  },
  // Sharkos came up out of the shallows after the break and stayed: pale walkers three
  // times a man's height that range the open ground in pairs (data/roaming.js). Nothing
  // staggers one; its rakes can be parried, its kick only rolled, its charge only sidestepped.
  sharko: {
    name: 'Sharko', model: 'sharko', level: 9, hp: 560, posture: 260, speed: 5.4, aggro: 24, leash: 80, xp: 420, silver: [8, 20],
    radius: 1.5, height: 5.5, size: 1, hyperarmor: true, roam: 40, alert: 'roar', resist: { rime: 0.2, ember: -0.15 },
    drops: [{ id: 'sharko_tooth', chance: 0.8, count: [1, 2] }, { id: 'meat_raw', chance: 1, count: [2, 3] }],
    attacks: [
      { id: 'rake', windup: 0.55, active: 0.18, recovery: 0.6, range: 4.4, arc: 110, dmg: 20, posture: 18, weight: 3, lunge: 5 },
      { id: 'double_rake', type: 'multi', hits: 2, gap: 0.32, windup: 0.62, active: 0.16, recovery: 0.75, range: 4.2, arc: 100, dmg: 16, posture: 16, weight: 2 },
      { id: 'bite', windup: 0.7, active: 0.16, recovery: 0.8, range: 4.6, arc: 50, dmg: 28, posture: 26, status: 'bleed', lunge: 8, weight: 1.5, cd: 4 },
      { id: 'kick', windup: 0.6, active: 0.14, recovery: 0.6, range: 3.8, arc: 80, dmg: 22, posture: 34, knockback: 14, unblockable: true, weight: 1.5, cd: 6 },
      { id: 'charge', type: 'leap', windup: 0.9, active: 0.85, recovery: 1.0, range: 18, minRange: 8, arc: 80, dmg: 30, posture: 32, unparryable: true, flyArc: 1.2, hitRange: 3.8, weight: 2, cd: 9 },
      { id: 'roar', type: 'aoe', windup: 0.9, active: 0.1, recovery: 0.7, radius: 9, dmg: 4, posture: 40, unblockable: true, weight: 0.7, cd: 16, sound: 'roar' },
    ],
  },
  scuttler: {
    name: 'Scuttler', model: 'crab', level: 4, hp: 150, posture: 150, speed: 4.0, aggro: 14, xp: 85, silver: [4, 12],
    radius: 0.9, height: 1.1, size: 1.1, frontArmor: 0.45,
    drops: [{ id: 'fish_raw', chance: 0.4 }, { id: 'meat_raw', chance: 0.3 }],
    attacks: [
      { id: 'pinch', windup: 0.42, active: 0.14, recovery: 0.45, range: 2.3, arc: 70, dmg: 11, posture: 12, weight: 3 },
      { id: 'double_pinch', type: 'multi', hits: 2, gap: 0.25, windup: 0.5, active: 0.12, recovery: 0.55, range: 2.3, arc: 70, dmg: 9, posture: 10, weight: 2 },
      { id: 'shell_spin', type: 'aoe', windup: 0.65, active: 0.4, recovery: 0.6, radius: 3.2, dmg: 14, posture: 18, weight: 1, cd: 6 },
    ],
  },
  rimefang: {
    name: 'Rimefang', model: 'wolf', level: 8, hp: 190, posture: 95, speed: 8.4, aggro: 24, xp: 170, silver: [6, 18],
    radius: 0.7, height: 1.3, size: 1.1, resist: { rime: 0.6, ember: -0.25 },
    drops: [{ id: 'wolf_pelt', chance: 0.7 }, { id: 'meat_raw', chance: 0.5 }],
    attacks: [
      { id: 'bite', windup: 0.38, active: 0.12, recovery: 0.42, range: 2.3, arc: 60, dmg: 15, posture: 12, status: 'chill', lunge: 5, weight: 3 },
      { id: 'pounce', type: 'leap', windup: 0.55, active: 0.35, recovery: 0.55, range: 10, minRange: 4, arc: 70, dmg: 20, posture: 20, weight: 2, cd: 4 },
      { id: 'frost_breath', type: 'projectile', windup: 0.7, recovery: 0.6, range: 12, minRange: 3, dmg: 10, posture: 6, weight: 1, cd: 7, proj: { speed: 22, color: '#bfefff', size: 0.6, status: 'chill', element: 'rime' } },
    ],
  },
  ash_golem: {
    name: 'Ashen Golem', model: 'golem', level: 11, hp: 520, posture: 270, speed: 3.4, aggro: 18, xp: 340, silver: [18, 40],
    radius: 1.1, height: 3.2, size: 1.55, resist: { ember: 0.7, rime: -0.2 }, hyperarmor: true,
    drops: [{ id: 'ember_glass', chance: 0.9 }],
    attacks: [
      { id: 'punch', windup: 0.6, active: 0.16, recovery: 0.6, range: 3.4, arc: 70, dmg: 22, posture: 22, weight: 3 },
      { id: 'slam', type: 'aoe', windup: 0.95, active: 0.1, recovery: 0.85, radius: 4.8, dmg: 30, posture: 35, weight: 2, cd: 5, launch: 6 },
      { id: 'rock_throw', type: 'projectile', windup: 0.9, recovery: 0.7, range: 26, minRange: 7, dmg: 24, posture: 25, weight: 1.5, cd: 5, proj: { speed: 24, color: '#5a4a40', size: 0.9, rock: true, gravity: 6 } },
    ],
  },
  cinder_imp: {
    name: 'Cinder Imp', model: 'imp', level: 10, hp: 110, posture: 50, speed: 6.2, aggro: 22, xp: 140, silver: [8, 20],
    radius: 0.55, height: 2.4, size: 0.9, flying: 0.7, resist: { ember: 0.8, rime: -0.3 },
    drops: [{ id: 'ember_glass', chance: 0.3 }],
    attacks: [
      { id: 'claw', windup: 0.35, active: 0.12, recovery: 0.4, range: 2.4, arc: 70, dmg: 10, posture: 8, weight: 1, lunge: 6 },
      { id: 'fireball', type: 'projectile', windup: 0.55, recovery: 0.5, range: 20, minRange: 3, dmg: 14, posture: 8, weight: 3, cd: 2.5, proj: { speed: 24, color: '#ff7a2f', size: 0.45, status: 'burn', element: 'ember' } },
    ],
  },
  gnashfin: {
    name: 'Gnashfin', model: 'shark', level: 12, hp: 320, posture: 200, speed: 10.5, aggro: 40, xp: 200, silver: [0, 0],
    radius: 1.2, height: 1.0, size: 1.5, aquatic: true,
    drops: [{ id: 'fish_raw', chance: 1, count: [2, 4] }],
    attacks: [{ id: 'bite', windup: 0.6, active: 0.18, recovery: 0.9, range: 3.0, arc: 60, dmg: 28, posture: 30, lunge: 10, weight: 1, unparryable: true }],
  },
  hollow: {
    name: 'Hollow', model: 'humanoid', level: 10, hp: 200, posture: 110, speed: 5.6, aggro: 22, xp: 160, silver: [0, 0],
    weapon: 'rift_blade', dmgMul: 1.05, critChance: 0.2, comboMax: 3, sanityHit: 5,
    defend: { block: 0.25, parry: 0.18, dodge: 0.12 }, knockable: false,
    look: { skin: '#2a2236', hair: '#0a0810', outfit: { main: '#1a1424', trim: '#4a2a6a', pants: '#120e1a', boots: '#08060c' }, eyes: '#c48bff', glowEyes: true },
    drops: [{ id: 'rift_shard', chance: 0.65, count: [1, 2] }],
  },
  riftling: {
    name: 'Riftling', model: 'eye', level: 10, hp: 120, posture: 60, speed: 4.5, aggro: 26, xp: 130, silver: [0, 0],
    radius: 0.7, height: 2.8, size: 1, flying: 0.9, sanityHit: 8, resist: { umbra: 0.8 },
    drops: [{ id: 'rift_shard', chance: 0.6, count: [1, 3] }],
    attacks: [
      { id: 'void_bolt', type: 'projectile', windup: 0.6, recovery: 0.6, range: 22, minRange: 2, dmg: 13, posture: 6, weight: 3, cd: 2, proj: { speed: 20, color: '#a274ff', size: 0.45, element: 'umbra', homing: 1.5, sanity: 8 } },
      { id: 'lash', windup: 0.4, active: 0.15, recovery: 0.5, range: 2.6, arc: 90, dmg: 10, posture: 8, weight: 1 },
    ],
  },
  hallucination: {
    name: '???', model: 'humanoid', level: 0, hp: 1, posture: 1, speed: 6.5, aggro: 60, xp: 0, silver: [0, 0],
    weapon: 'rift_blade', dmgMul: 0, comboMax: 2, illusion: true, defend: { block: 0, parry: 0, dodge: 0 },
    look: { skin: '#000000', hair: '#000000', outfit: { main: '#05030a', trim: '#2a1a40', pants: '#05030a', boots: '#000000' }, eyes: '#ffffff', glowEyes: true },
  },

  // ---------------- EXPANDED BESTIARY ----------------
  fen_witch: {
    name: 'Fen Witch', model: 'humanoid', level: 7, hp: 150, posture: 75, speed: 5.0, aggro: 22, xp: 140, silver: [8, 18],
    weapon: 'rusty_dagger', dmgMul: 0.9, critChance: 0.1, comboMax: 2,
    mantras: ['gale_palm', 'umbral_orb', 'frost_shards'], mantraChance: 0.55, mantraPower: 0.95,
    defend: { block: 0.08, parry: 0.1, dodge: 0.28 }, knockable: true,
    look: { skin: '#a8b088', hair: '#2a3a1a', outfit: { main: '#3a4a2a', trim: '#7a8a4a', pants: '#2a3020', boots: '#1a1a10' }, hood: true, eyes: '#b6ff9c', glowEyes: true },
    drops: [{ id: 'witch_charm', chance: 0.8 }, { id: 'herb', chance: 0.3 }, { id: 'sanity_draught', chance: 0.08 }, { outfit: 'fen_cloak', chance: 0.04 }],
  },
  bog_lurker: {
    name: 'Bog Mother', model: 'lurker', unique: true, level: 8, hp: 420, posture: 220, speed: 4.6, aggro: 18, xp: 320, silver: [20, 40],
    radius: 1.1, height: 1.5, size: 1.75, hyperarmor: true,
    palette: { '#5a6a3a': '#3a4428', '#9a9a6a': '#6a6a44', '#ffd23f': '#ff6a3a', '#d86a7a': '#8a3a4a' },
    drops: [{ id: 'fish_raw', chance: 1, count: [2, 4] }, { id: 'mushroom', chance: 0.6, count: [1, 2] }, { id: 'elixir', chance: 0.3 }],
    attacks: [
      { id: 'bite', windup: 0.6, active: 0.16, recovery: 0.7, range: 2.8, arc: 80, dmg: 18, posture: 20, lunge: 8, weight: 3 },
      { id: 'tongue', windup: 0.7, active: 0.14, recovery: 0.7, range: 6.5, arc: 30, dmg: 12, posture: 10, weight: 1.5, cd: 4, unparryable: true },
      { id: 'mud_spit', type: 'projectile', windup: 0.65, recovery: 0.6, range: 16, minRange: 5, dmg: 10, posture: 8, weight: 1.5, cd: 5, proj: { speed: 22, color: '#5a4a2a', size: 0.6, status: 'blind', gravity: 6 } },
      { id: 'belly_slam', type: 'aoe', windup: 0.9, active: 0.1, recovery: 0.8, radius: 4.2, dmg: 20, posture: 30, weight: 1, cd: 7, launch: 5 },
    ],
  },
  frost_cultist: {
    name: 'White Cultist', model: 'humanoid', level: 9, hp: 220, posture: 105, speed: 5.4, aggro: 24, xp: 210, silver: [12, 26],
    weapon: 'steel_longsword', dmgMul: 0.9, critChance: 0.2, comboMax: 3, resist: { rime: 0.5, ember: -0.15 },
    mantras: ['frost_shards', 'glacial_grip', 'ice_lance'], mantraChance: 0.35, mantraPower: 1.0,
    defend: { block: 0.25, parry: 0.15, dodge: 0.08 }, knockable: true,
    look: { skin: '#e8eef5', hair: '#ffffff', outfit: { main: '#e8eef5', trim: '#5fa8d3', pants: '#9aaab8', boots: '#5a6a7a' }, hood: true, eyes: '#8fd8ff', glowEyes: true },
    drops: [{ id: 'cultist_sigil', chance: 0.85 }, { id: 'frost_lily', chance: 0.3 }, { outfit: 'cultist_robes', chance: 0.05 }, { id: 'glacier_cleaver', chance: 0.02, weapon: true }],
  },
  frost_stalker: {
    name: 'Pale Stalker', model: 'wolf', level: 11, hp: 280, posture: 120, speed: 9.4, aggro: 20, xp: 260, silver: [8, 20],
    radius: 0.8, height: 1.5, size: 1.3, resist: { rime: 0.7, umbra: 0.3, ember: -0.2 },
    palette: { '#e8eef5': '#4a4e5e', '#9aaab8': '#2a2c38', '#8fd8ff': '#c48bff' },
    drops: [{ id: 'stalker_fang', chance: 0.7 }, { id: 'wolf_pelt', chance: 0.5 }, { id: 'meat_raw', chance: 0.5 }],
    attacks: [
      { id: 'bite', windup: 0.32, active: 0.12, recovery: 0.4, range: 2.4, arc: 60, dmg: 18, posture: 14, status: 'bleed', lunge: 6, weight: 3 },
      { id: 'pounce', type: 'leap', windup: 0.5, active: 0.35, recovery: 0.5, range: 12, minRange: 4, arc: 70, dmg: 24, posture: 22, weight: 2, cd: 4, unparryable: true },
      { id: 'howl', type: 'aoe', windup: 0.8, active: 0.1, recovery: 0.6, radius: 7, dmg: 4, posture: 34, unblockable: true, weight: 0.8, cd: 12, sound: 'roar' },
    ],
  },
  ash_zealot: {
    name: 'Ash Zealot', model: 'humanoid', level: 12, hp: 280, posture: 130, speed: 5.6, aggro: 24, xp: 300, silver: [16, 32],
    weapon: 'hunters_spear', dmgMul: 1.0, critChance: 0.22, comboMax: 3, resist: { ember: 0.6, rime: -0.2 },
    mantras: ['ember_bolt', 'cinder_grasp', 'flame_repulsion'], mantraChance: 0.4, mantraPower: 1.05,
    defend: { block: 0.22, parry: 0.15, dodge: 0.12 }, knockable: true,
    look: { skin: '#8a5a44', hair: '#1a1210', outfit: { main: '#2a1a16', trim: '#ff7a2f', pants: '#1a1210', boots: '#100a08' }, bandana: '#ff7a2f', eyes: '#ffb347', glowEyes: true },
    drops: [{ id: 'zealot_brand', chance: 0.85 }, { id: 'ember_pepper', chance: 0.4 }, { outfit: 'zealot_vestments', chance: 0.05 }],
  },
  cinder_crab: {
    name: 'Cinder Scuttler', model: 'crab', level: 10, hp: 240, posture: 220, speed: 4.2, aggro: 15, xp: 190, silver: [6, 16],
    radius: 1.0, height: 1.2, size: 1.3, frontArmor: 0.5, resist: { ember: 0.8, rime: -0.3 },
    palette: { '#b8502a': '#2a2220', '#7a301a': '#ff6a1a' },
    drops: [{ id: 'ember_shell', chance: 0.7 }, { id: 'meat_raw', chance: 0.3 }],
    attacks: [
      { id: 'pinch', windup: 0.42, active: 0.14, recovery: 0.45, range: 2.5, arc: 70, dmg: 15, posture: 14, status: 'burn', weight: 3 },
      { id: 'double_pinch', type: 'multi', hits: 2, gap: 0.25, windup: 0.5, active: 0.12, recovery: 0.55, range: 2.5, arc: 70, dmg: 12, posture: 12, weight: 2 },
      { id: 'shell_spin', type: 'aoe', windup: 0.65, active: 0.4, recovery: 0.6, radius: 3.6, dmg: 18, posture: 20, weight: 1, cd: 6, element: 'ember' },
    ],
  },
  thunderwing: {
    name: 'Thunderwing', model: 'owl', level: 13, hp: 720, posture: 270, speed: 7.0, aggro: 24, xp: 560, silver: [18, 36],
    radius: 1.35, height: 5.0, size: 1.35, resist: { storm: 0.8, gale: 0.3 },
    // storm-navy plumage, a pale gold breast, and lightning where the gloomowl's eyes are cold
    palette: {
      '#23202c': '#1f2644', '#17151d': '#161a30', '#5d5872': '#8a8a6a', '#6c6880': '#d8d4a0', '#a39fb0': '#c8c4a0',
      '#d6f6ff': '#fff6c0', '#8fe4ff': '#ffe14d', '#9fe6ff': '#ffe14d', '#5fc8f0': '#ffd21a',
    },
    drops: [{ id: 'owl_feather', chance: 1, count: [2, 3] }, { id: 'meat_raw', chance: 0.6, count: [1, 2] }],
    attacks: [
      { id: 'peck', windup: 0.38, active: 0.14, recovery: 0.42, range: 4.0, arc: 60, dmg: 20, posture: 16, weight: 3, lunge: 4 },
      { id: 'talon_dive', type: 'leap', windup: 0.75, active: 0.4, recovery: 0.65, range: 15, minRange: 6, arc: 80, dmg: 30, posture: 26, weight: 2, cd: 5, hitRange: 3.6, hyperarmor: true },
      { id: 'gust', type: 'projectile', windup: 0.5, recovery: 0.5, range: 20, minRange: 5, dmg: 16, posture: 12, weight: 2, cd: 3, proj: { speed: 34, color: '#ffe14d', size: 0.7, status: 'shock', element: 'storm' } },
      { id: 'screech', type: 'aoe', windup: 0.75, active: 0.1, recovery: 0.7, radius: 8, dmg: 10, posture: 36, unblockable: true, weight: 1, cd: 10, sound: 'screech', element: 'storm', hyperarmor: true },
    ],
  },
  drowned_knight: {
    name: 'Drowned Knight', model: 'humanoid', level: 14, hp: 460, posture: 220, speed: 5.0, aggro: 22, xp: 420, silver: [0, 0],
    weapon: 'iron_greatsword', dmgMul: 1.1, critChance: 0.25, comboMax: 3, scale: 1.18, sanityHit: 4, resist: { umbra: 0.5 },
    defend: { block: 0.4, parry: 0.15, dodge: 0.0 }, knockable: false, launchable: false, // plate under the water's weight
    look: { skin: '#3a4048', hair: '#0a0810', outfit: { main: '#4a5a6a', trim: '#a274ff', pants: '#2a323a', boots: '#1a1e24' }, helm: '#5a6a7a', armored: true, eyes: '#c48bff', glowEyes: true, cape: '#2a1a3a' },
    drops: [{ id: 'drowned_crest', chance: 0.8 }, { id: 'rift_shard', chance: 0.6, count: [1, 3] }, { id: 'drowned_greatsword', chance: 0.04, weapon: true }, { outfit: 'drowned_plate', chance: 0.05 }],
  },
  abyssal_watcher: {
    name: 'Abyssal Watcher', model: 'eye', level: 15, hp: 340, posture: 140, speed: 3.6, aggro: 30, xp: 380, silver: [0, 0],
    radius: 1.0, height: 3.6, size: 1.6, flying: 1.4, sanityHit: 10, resist: { umbra: 0.9, storm: -0.25 },
    palette: { '#1a1424': '#0a0610', '#a274ff': '#ff4a6a', '#8a4aff': '#ff2a4a' },
    drops: [{ id: 'abyssal_lens', chance: 0.7 }, { id: 'rift_shard', chance: 0.8, count: [2, 4] }],
    attacks: [
      { id: 'void_bolt', type: 'projectile', windup: 0.55, recovery: 0.5, range: 26, minRange: 2, dmg: 15, posture: 8, weight: 3, cd: 1.6, proj: { speed: 22, color: '#ff4a6a', size: 0.5, element: 'umbra', homing: 1.8, sanity: 10 } },
      { id: 'gaze', type: 'aoe', windup: 1.0, active: 0.1, recovery: 0.8, radius: 8, dmg: 12, posture: 20, unblockable: true, weight: 1, cd: 9, element: 'umbra', sound: 'whisper' },
      { id: 'lash', windup: 0.4, active: 0.15, recovery: 0.5, range: 3.2, arc: 100, dmg: 14, posture: 12, weight: 1 },
    ],
  },
  duelist: {
    name: 'Sera Vane', title: 'The Wandering Duelist', model: 'humanoid', boss: true, level: 6, hp: 720, posture: 210, speed: 6.0, aggro: 16, leash: 40,
    xp: 900, silver: [120, 180], weapon: 'kestrel_blade', dmgMul: 0.8, critChance: 0.3, comboMax: 4,
    defend: { block: 0.15, parry: 0.42, dodge: 0.22 }, knockable: false,
    look: { skin: '#e8c8a8', hair: '#1a1014', outfit: { main: '#5a1a2a', trim: '#d4b04a', pants: '#2a1a20', boots: '#1a1014' }, cape: '#5a1a2a' },
    specials: [
      { id: 'flash_lunge', type: 'leap', windup: 0.45, active: 0.3, recovery: 0.6, range: 13, minRange: 5, arc: 60, dmg: 20, posture: 18, unparryable: true, cd: 7, flyArc: 3 },
    ],
    drops: [{ id: 'kestrel_blade', chance: 1, weapon: true }, { id: 'mantra_spark', chance: 1 }, { id: 'elixir', chance: 1, count: [2, 2] }],
    outfitDrop: 'duelist_coat',
  },

  witch_queen: {
    name: 'Old Mother Reed', title: 'Witch-Queen of Shimmerfen', model: 'humanoid', boss: true, level: 10, hp: 1600, posture: 300, speed: 5.6, aggro: 24, leash: 50,
    xp: 2200, silver: [200, 280], weapon: 'witchthorn_rapier', dmgMul: 0.8, critChance: 0.25, comboMax: 3, scale: 1.2, sanityHit: 3,
    defend: { block: 0.1, parry: 0.25, dodge: 0.35 }, knockable: false, resist: { umbra: 0.4, gale: 0.4, ember: -0.2 },
    mantras: ['gale_palm', 'umbral_orb', 'frost_shards', 'frost_spikes', 'cyclone'], mantraChance: 0.5, mantraPower: 1.15,
    summons: { type: 'fen_witch', count: 2, atHp: [0.65, 0.3] },
    look: { skin: '#8a9a6a', hair: '#d8e0c8', outfit: { main: '#2a3a1a', trim: '#b6ff9c', pants: '#1a2414', boots: '#10140a' }, hood: true, eyes: '#b6ff9c', glowEyes: true, cape: '#2a3a1a', crown: '#6a8a3a' },
    specials: [
      { id: 'mire_step', type: 'leap', windup: 0.4, active: 0.3, recovery: 0.5, range: 12, minRange: 5, arc: 80, dmg: 18, posture: 18, cd: 7, flyArc: 2, unparryable: true },
    ],
    drops: [{ id: 'witchthorn_rapier', chance: 1, weapon: true }, { id: 'mantra_spark', chance: 1 }, { id: 'witch_charm', chance: 1, count: [3, 3] }],
  },

  // ---------------- THE VERDANCE ----------------
  jungle_ape: {
    name: 'Grove Ape', model: 'ape', level: 13, hp: 360, posture: 170, speed: 6.8, aggro: 20, xp: 300, silver: [10, 24],
    radius: 0.95, height: 2.2, size: 1.0, resist: { gale: 0.2 },
    drops: [{ id: 'ape_hide', chance: 0.7 }, { id: 'meat_raw', chance: 0.6, count: [1, 2] }, { id: 'berries', chance: 0.4, count: [1, 3] }],
    attacks: [
      { id: 'swipe', windup: 0.42, active: 0.16, recovery: 0.5, range: 2.9, arc: 110, dmg: 17, posture: 16, weight: 3, lunge: 5 },
      { id: 'double_slam', type: 'multi', hits: 2, gap: 0.3, windup: 0.6, active: 0.14, recovery: 0.6, range: 2.6, arc: 90, dmg: 14, posture: 18, weight: 2, sound: 'grunt' },
      { id: 'leap_smash', type: 'leap', windup: 0.6, active: 0.4, recovery: 0.7, range: 12, minRange: 5, arc: 90, dmg: 22, posture: 26, weight: 1.5, cd: 6, shockwave: 3 },
      { id: 'rock_throw', type: 'projectile', windup: 0.75, recovery: 0.6, range: 22, minRange: 7, dmg: 16, posture: 18, weight: 1, cd: 6, proj: { speed: 24, color: '#6a5a4a', size: 0.7, rock: true, gravity: 6 } },
    ],
  },
  jade_serpent: {
    name: 'Jade Serpent', model: 'snake', level: 12, hp: 230, posture: 100, speed: 6.6, aggro: 16, xp: 240, silver: [6, 16],
    radius: 0.6, height: 0.9, size: 1.3, resist: { blood: 0.3 },
    drops: [{ id: 'serpent_scale', chance: 0.75 }, { id: 'meat_raw', chance: 0.35 }],
    attacks: [
      { id: 'bite', windup: 0.34, active: 0.12, recovery: 0.45, range: 2.4, arc: 50, dmg: 15, posture: 10, status: 'bleed', lunge: 7, weight: 3, sound: 'hiss' },
      { id: 'coil_strike', type: 'leap', windup: 0.55, active: 0.3, recovery: 0.6, range: 9, minRange: 3, arc: 60, dmg: 20, posture: 16, weight: 2, cd: 5, flyArc: 3, unparryable: true, sound: 'hiss' },
      { id: 'spit', type: 'projectile', windup: 0.5, recovery: 0.5, range: 14, minRange: 4, dmg: 8, posture: 4, weight: 1.2, cd: 5, proj: { speed: 26, color: '#9fe04a', size: 0.35, status: 'blind' } },
    ],
  },
  mossbound: {
    name: 'Mossbound Warrior', model: 'humanoid', level: 13, hp: 300, posture: 140, speed: 5.9, aggro: 24, xp: 320, silver: [14, 30],
    weapon: 'mossbound_spear', dmgMul: 0.95, critChance: 0.22, comboMax: 3,
    mantras: ['gale_lunge', 'wind_carve'], mantraChance: 0.25, mantraPower: 1.0,
    defend: { block: 0.2, parry: 0.15, dodge: 0.22 }, knockable: true,
    look: { skin: '#6a4a30', hair: '#1a1410', outfit: { main: '#3a5a2a', trim: '#c8a040', pants: '#2a2a18', boots: '#1a1a10' }, bandana: '#2a6a2a', eyes: '#b6ff9c' },
    drops: [{ id: 'mossbound_mask', chance: 0.6 }, { id: 'honeycomb', chance: 0.25 }, { outfit: 'mossbound_garb', chance: 0.05 }, { id: 'mossbound_spear', chance: 0.03, weapon: true }],
  },
  mossbound_shaman: {
    name: 'Mossbound Shaman', model: 'humanoid', level: 14, hp: 240, posture: 100, speed: 5.2, aggro: 26, xp: 360, silver: [18, 34],
    weapon: 'serrated_shiv', dmgMul: 0.9, critChance: 0.1, comboMax: 2,
    mantras: ['shadow_seed', 'wind_carve', 'gale_palm', 'cyclone'], mantraChance: 0.6, mantraPower: 1.05,
    defend: { block: 0.05, parry: 0.1, dodge: 0.3 }, knockable: true,
    look: { skin: '#5a3a2a', hair: '#e8e0d0', outfit: { main: '#5a2a2a', trim: '#e0243f', pants: '#2a1a14', boots: '#1a1010' }, hood: true, eyes: '#ff6a6a', glowEyes: true },
    drops: [{ id: 'mossbound_mask', chance: 0.9 }, { id: 'elixir', chance: 0.2 }, { id: 'sanity_draught', chance: 0.1 }],
  },
  thresher: {
    name: 'Bonegnaw', title: 'Thresher of the Bone Pit', model: 'worm', boss: true, level: 15, hp: 2200, posture: 420, speed: 5.0, aggro: 22, leash: 50,
    xp: 2600, silver: [260, 360], radius: 1.4, height: 4.2, size: 1.6, hyperarmor: true, construct: false, resist: { phys: 0.1, umbra: 0.2 },
    attacks: [
      { id: 'lunge_bite', windup: 0.55, active: 0.18, recovery: 0.7, range: 5.2, arc: 70, dmg: 30, posture: 28, weight: 3, lunge: 4 },
      { id: 'tail_slam', type: 'aoe', windup: 0.85, active: 0.1, recovery: 0.9, radius: 5.5, dmg: 34, posture: 36, weight: 2, cd: 6, launch: 8 },
      { id: 'acid_spit', type: 'projectile', windup: 0.65, recovery: 0.6, range: 26, minRange: 6, dmg: 20, posture: 12, weight: 2, cd: 4, proj: { speed: 26, color: '#b8e04a', size: 0.7, status: 'blind', gravity: 5 } },
      { id: 'burrow_strike', type: 'leap', windup: 1.2, active: 0.35, recovery: 0.9, range: 24, minRange: 7, arc: 100, dmg: 34, posture: 34, weight: 2, cd: 8, unparryable: true, flyArc: 2, shockwave: 4.5 },
    ],
    drops: [{ id: 'thresher_fang', chance: 1, weapon: true }, { id: 'thresher_tooth', chance: 1, count: [2, 3] }, { id: 'mantra_spark', chance: 1 }],
  },
  primadon: {
    name: 'Primadon', title: 'Old King of the Verdance', model: 'ape', boss: true, level: 18, hp: 4600, posture: 600, speed: 6.4, aggro: 30, leash: 60,
    xp: 6200, silver: [600, 800], radius: 2.0, height: 5.6, size: 2.5, hyperarmor: true, resist: { gale: 0.3, phys: 0.08 },
    palette: { '#3a3028': '#2a2622', '#6a5040': '#4a3a30', '#8a7a68': '#b8b0a0', '#ffb000': '#ff4a1a', '#ff8a00': '#ff2a00' },
    attacks: [
      { id: 'swipe', windup: 0.6, active: 0.18, recovery: 0.6, range: 5.4, arc: 120, dmg: 32, posture: 28, weight: 3, lunge: 5 },
      { id: 'sweep', windup: 0.85, active: 0.25, recovery: 0.8, range: 6.2, arc: 220, dmg: 30, posture: 34, weight: 2, cd: 5, unparryable: true },
      { id: 'ground_pound', type: 'aoe', windup: 1.0, active: 0.1, recovery: 0.9, radius: 7.5, dmg: 40, posture: 40, weight: 2, cd: 7, launch: 9 },
      { id: 'leap_smash', type: 'leap', windup: 0.8, active: 0.5, recovery: 0.9, range: 22, minRange: 8, arc: 100, dmg: 38, posture: 40, weight: 2, cd: 7, shockwave: 6, unparryable: true },
      { id: 'boulder', type: 'projectile', windup: 1.0, recovery: 0.8, range: 34, minRange: 10, dmg: 30, posture: 30, weight: 1.5, cd: 6, proj: { speed: 26, color: '#5a4a3a', size: 1.5, rock: true, gravity: 5 } },
      { id: 'roar', type: 'aoe', windup: 0.9, active: 0.1, recovery: 0.6, radius: 10, dmg: 6, posture: 50, unblockable: true, weight: 1, cd: 14, sound: 'roar' },
    ],
    specials: [{ id: 'enrage', type: 'buff', windup: 1.2, recovery: 0.5, cd: 30, hpBelow: 0.5, once: true }],
    summons: { type: 'jungle_ape', count: 2, atHp: [0.5] },
    drops: [{ id: 'primal_knuckles', chance: 1, weapon: true }, { id: 'mantra_spark', chance: 1, count: [2, 2] }, { id: 'ape_hide', chance: 1, count: [3, 4] }],
  },

  // ---------------- THE DEEP DARK: the Ferryman, his hounds, the Crucible's knights ----------------
  void_hound: {
    name: 'Void Hound', model: 'wolf', level: 17, hp: 340, posture: 140, speed: 10.2, aggro: 26, xp: 420, silver: [0, 0],
    radius: 0.85, height: 1.6, size: 1.35, sanityHit: 6, resist: { umbra: 0.8, ember: -0.2 },
    palette: { '#e8eef5': '#1a1016', '#9aaab8': '#3a1a24', '#8fd8ff': '#ff2a4a', '#4ab0ff': '#ff2a4a' },
    drops: [{ id: 'rift_shard', chance: 0.7, count: [1, 3] }, { id: 'meat_raw', chance: 0.3 }],
    attacks: [
      { id: 'bite', windup: 0.3, active: 0.12, recovery: 0.38, range: 2.5, arc: 60, dmg: 22, posture: 16, status: 'bleed', lunge: 7, weight: 3 },
      { id: 'pounce', type: 'leap', windup: 0.45, active: 0.32, recovery: 0.5, range: 13, minRange: 4, arc: 70, dmg: 28, posture: 24, weight: 2, cd: 3.5, unparryable: true },
      { id: 'howl', type: 'aoe', windup: 0.7, active: 0.1, recovery: 0.6, radius: 8, dmg: 6, posture: 34, unblockable: true, weight: 0.8, cd: 12, sound: 'roar', element: 'umbra' },
    ],
  },
  abyss_knight: {
    name: 'Abyssal Knight', model: 'humanoid', level: 18, hp: 640, posture: 280, speed: 5.4, aggro: 24, xp: 640, silver: [0, 0],
    weapon: 'tidebreaker', dmgMul: 0.95, critChance: 0.28, comboMax: 3, scale: 1.25, sanityHit: 6, resist: { umbra: 0.6, phys: 0.08 },
    mantras: ['shadow_gun', 'void_eruption'], mantraChance: 0.2, mantraPower: 1.2,
    defend: { block: 0.4, parry: 0.2, dodge: 0.0 }, knockable: false, launchable: false,
    look: { skin: '#1a1016', hair: '#0a0608', outfit: { main: '#2a1a22', trim: '#ff2a4a', pants: '#140a10', boots: '#0a0608' }, helm: '#2a1a22', armored: true, eyes: '#ff3a5a', glowEyes: true, cape: '#3a0a14' },
    drops: [{ id: 'rift_shard', chance: 0.8, count: [2, 4] }, { id: 'drowned_crest', chance: 0.4 }, { id: 'mantra_spark', chance: 0.06 }],
  },
  lanternless: {
    name: 'The Lanternless', title: 'Ferryman of the Abyss', model: 'humanoid', boss: true, level: 20, hp: 7400, posture: 700, speed: 6.4, aggro: 30, leash: 70,
    xp: 12000, silver: [0, 0], weapon: 'lanternless_scythe', dmgMul: 0.85, critChance: 0.32, comboMax: 4, scale: 1.6, sanityHit: 10,
    defend: { block: 0.2, parry: 0.32, dodge: 0.15 }, knockable: false, resist: { umbra: 0.85, phys: 0.1 },
    mantras: ['shade_step', 'shadow_seed', 'darkfire_chain', 'void_eruption'], mantraChance: 0.35, mantraPower: 1.5,
    summons: { type: 'void_hound', count: 2, atHp: [0.6, 0.3] },
    look: { skin: '#0a0608', hair: '#000000', outfit: { main: '#120a0e', trim: '#ff2a4a', pants: '#0a0608', boots: '#050304' }, hood: true, eyes: '#ff3a5a', glowEyes: true, cape: '#1a060c' },
    specials: [
      { id: 'reap', type: 'leap', windup: 0.75, active: 0.45, recovery: 0.8, range: 20, minRange: 6, arc: 120, dmg: 34, posture: 36, unparryable: true, cd: 8, shockwave: 5 },
      { id: 'dread_cry', type: 'buff', windup: 1.2, recovery: 0.4, cd: 30, hpBelow: 0.5, once: true },
    ],
    drops: [{ id: 'lanternless_scythe', chance: 1, weapon: true }, { id: 'ember_of_life', chance: 1 }, { id: 'mantra_spark', chance: 1, count: [3, 3] }],
  },

  // ---------------- GROUP ARCHETYPES (systems round; placement in the world is agent 5's) ----------------
  // role: how it fights in a group (entities/tactics.js). ranged and support keep to their band
  // `keep` [near, far] metres from their target; skirmishers strike from a flank and fall back;
  // bruisers swing through blows; monsters follow their `pattern` of attacks in order.
  redwake_harpooner: {
    name: 'Redwake Harpooner', model: 'humanoid', role: 'ranged', level: 5, hp: 95, posture: 60, speed: 5.4, aggro: 26, xp: 75, silver: [6, 14],
    weapon: 'cutlass', dmgMul: 0.75, critChance: 0.05, comboMax: 2, keep: [8, 15],
    defend: { block: 0.05, parry: 0.05, dodge: 0.35 }, knockable: true,
    ranged: { id: 'harpoon', windup: 0.55, recovery: 0.45, range: 24, minRange: 3, dmg: 12, posture: 8, cd: 1.8, proj: { speed: 30, color: '#8a7a5a', size: 0.22, rod: true, gravity: 3 } },
    look: { skin: '#b8865c', hair: '#3a2a1a', outfit: { main: '#5a3a2a', trim: '#a8281c', pants: '#2a2018', boots: '#141010' }, bandana: '#a8281c' },
    drops: [{ id: 'bounty_token', chance: 1 }, { id: 'fish_raw', chance: 0.3 }],
  },
  redwake_bonesetter: {
    name: 'Redwake Bonesetter', model: 'humanoid', role: 'support', level: 6, hp: 110, posture: 70, speed: 5.0, aggro: 24, xp: 90, silver: [8, 16],
    weapon: 'rusty_dagger', dmgMul: 0.7, critChance: 0.05, comboMax: 2, keep: [6, 11],
    support: { heal: { pct: 0.3, range: 16, cd: 7, windup: 0.9 }, rally: { range: 12, duration: 8, cd: 15, windup: 0.8, dmg: 0.15 } },
    defend: { block: 0.05, parry: 0.05, dodge: 0.3 }, knockable: true,
    look: { skin: '#c8956a', hair: '#8a8478', beard: '#8a8478', outfit: { main: '#6a5a3a', trim: '#a8281c', pants: '#3a3226', boots: '#241c14' }, hood: true },
    drops: [{ id: 'bounty_token', chance: 1 }, { id: 'herb', chance: 0.6, count: [1, 2] }, { id: 'elixir', chance: 0.08 }],
  },
  redwake_skirmisher: {
    name: 'Redwake Skirmisher', model: 'humanoid', role: 'skirmisher', level: 5, hp: 90, posture: 55, speed: 7.2, aggro: 24, xp: 75, silver: [6, 14],
    weapon: 'serrated_shiv', dmgMul: 0.85, critChance: 0.15, comboMax: 2, feintChance: 0.18,
    defend: { block: 0.05, parry: 0.1, dodge: 0.45 }, knockable: true,
    look: { skin: '#d8a578', hair: '#1a1410', outfit: { main: '#2a2a2a', trim: '#a8281c', pants: '#1a1a1a', boots: '#100c0c' }, bandana: '#a8281c' },
    drops: [{ id: 'bounty_token', chance: 1 }, { id: 'serrated_shiv', chance: 0.04, weapon: true }],
  },
  redwake_breaker: {
    name: 'Redwake Breaker', model: 'humanoid', role: 'bruiser', level: 8, hp: 320, posture: 180, speed: 4.4, aggro: 20, xp: 160, silver: [14, 28],
    weapon: 'bonebreaker', dmgMul: 0.72, critChance: 0.2, comboMax: 2, scale: 1.3, swingHyper: true, launchable: false, feintChance: 0,
    defend: { block: 0.35, parry: 0, dodge: 0 }, knockable: true,
    specials: [{ id: 'shoulder_charge', type: 'leap', anim: 'bash', windup: 0.7, active: 0.35, recovery: 0.7, range: 10, minRange: 4, arc: 70, dmg: 18, posture: 30, unparryable: true, cd: 7, flyArc: 1 }],
    look: { skin: '#9a6a44', hair: '#1a1410', beard: '#3a2a1a', outfit: { main: '#4a2018', trim: '#a8281c', pants: '#2a1810', boots: '#140a08' }, bandana: '#a8281c', armored: true },
    drops: [{ id: 'bounty_token', chance: 1, count: [2, 2] }, { id: 'meat_raw', chance: 0.4 }, { id: 'smithing_stone', chance: 0.12 }],
  },
  // large monsters with readable patterns: each step of the pattern has its own telegraph and sound
  shellback: {
    name: 'Shellback', model: 'crab', role: 'monster', level: 9, hp: 900, posture: 420, speed: 3.2, aggro: 16, leash: 40, xp: 620, silver: [20, 40],
    radius: 2.0, height: 2.4, size: 2.4, frontArmor: 0.5, hyperarmor: true, launchable: false,
    palette: { '#b8502a': '#4a5a5a', '#7a301a': '#2a3a3a' },
    pattern: ['pinch', 'pinch', 'claw_slam', 'shell_spin'],
    drops: [{ id: 'fish_raw', chance: 1, count: [2, 3] }, { id: 'ember_shell', chance: 0.5 }, { id: 'smithing_stone', chance: 0.4 }],
    attacks: [
      { id: 'pinch', windup: 0.6, active: 0.14, recovery: 0.55, range: 4.2, arc: 80, dmg: 18, posture: 16, weight: 1, lunge: 2 },
      { id: 'claw_slam', type: 'aoe', windup: 1.15, active: 0.1, recovery: 0.9, radius: 5, dmg: 28, posture: 34, weight: 1, launch: 6, sound: 'hitHeavy' },
      { id: 'shell_spin', type: 'aoe', windup: 0.9, active: 0.4, recovery: 1.1, radius: 5.5, dmg: 20, posture: 24, unblockable: true, weight: 1 },
    ],
  },
  cairn_hulk: {
    name: 'Cairn Hulk', model: 'golem', role: 'monster', level: 12, hp: 1300, posture: 520, speed: 3.0, aggro: 18, leash: 45, xp: 900, silver: [30, 60],
    radius: 1.5, height: 4.2, size: 2.0, resist: { phys: 0.1, gale: 0.3, storm: -0.25 }, hyperarmor: true, launchable: false,
    palette: { '#5a4f48': '#55604a', '#3e3530': '#36402e', '#ff6a1a': '#b6ff9c', '#ff4a00': '#5aff3a' }, // moss on the stone, a green light in the seams
    pattern: ['punch', 'punch', 'stomp', 'cairn_throw'],
    drops: [{ id: 'smithing_stone', chance: 1, count: [1, 2] }, { id: 'mantra_spark', chance: 0.05 }],
    attacks: [
      { id: 'punch', windup: 0.7, active: 0.16, recovery: 0.6, range: 4.2, arc: 70, dmg: 24, posture: 22, weight: 1 },
      { id: 'stomp', type: 'aoe', windup: 1.2, active: 0.1, recovery: 1.0, radius: 6, dmg: 30, posture: 36, weight: 1, launch: 7 },
      { id: 'cairn_throw', type: 'projectile', windup: 1.0, recovery: 0.8, range: 28, minRange: 0, dmg: 24, posture: 24, weight: 1, proj: { speed: 22, color: '#6a7a5a', size: 1.0, rock: true, gravity: 6 } },
    ],
  },

  // ---------------- BOSSES ----------------
  warlord: {
    name: 'Kaelen the Red', title: 'Brigand Warlord', model: 'humanoid', boss: true, level: 7, hp: 950, posture: 270, speed: 5.4, aggro: 30, leash: 60,
    xp: 1400, silver: [240, 320], weapon: 'kaelens_ruin', dmgMul: 0.82, critChance: 0.3, comboMax: 3, scale: 1.25,
    defend: { block: 0.35, parry: 0.22, dodge: 0.05 }, knockable: false,
    look: { skin: '#b07a52', hair: '#a8281c', outfit: { main: '#8a1a14', trim: '#d4b04a', pants: '#2a1410', boots: '#140a08' }, bandana: '#d4b04a', beard: '#a8281c', cape: '#8a1a14' },
    specials: [
      { id: 'leap_slam', type: 'leap', windup: 0.7, active: 0.45, recovery: 0.7, range: 16, minRange: 6, arc: 80, dmg: 26, posture: 30, unparryable: true, cd: 8, shockwave: 4.5 },
      { id: 'war_cry', type: 'buff', windup: 1.0, recovery: 0.4, cd: 25, hpBelow: 0.5, once: true },
    ],
    drops: [{ id: 'fracture_core', chance: 1 }, { id: 'kaelens_ruin', chance: 1, weapon: true }, { id: 'stew', chance: 1, count: [2, 2] }],
  },
  frost_warden: {
    name: 'The Frost Warden', title: 'Keeper of the White Hollow', model: 'humanoid', boss: true, level: 13, hp: 1900, posture: 380, speed: 5.0, aggro: 32, leash: 60,
    xp: 3000, silver: [400, 520], weapon: 'frostfang', dmgMul: 0.95, critChance: 0.25, comboMax: 4, scale: 1.55,
    defend: { block: 0.3, parry: 0.3, dodge: 0.05 }, knockable: false, resist: { rime: 0.8, ember: -0.2 },
    mantras: ['frost_shards', 'frost_spikes', 'glacial_grip'], mantraChance: 0.35, mantraPower: 1.3,
    look: { skin: '#cfe3f2', hair: '#ffffff', outfit: { main: '#9fc6e2', trim: '#e8f4ff', pants: '#5a7a9a', boots: '#3a5a7a' }, eyes: '#8fd8ff', glowEyes: true, helm: '#dff3ff', armored: true },
    drops: [{ id: 'fracture_core', chance: 1 }, { id: 'frostfang', chance: 1, weapon: true }, { id: 'mantra_spark', chance: 1 }],
  },
  cinder_colossus: {
    name: 'Cinder Colossus', title: 'Heart of the Ashen Spire', model: 'golem', boss: true, level: 16, hp: 3400, posture: 650, speed: 3.2, aggro: 34, leash: 70,
    xp: 4800, silver: [600, 760], radius: 2.2, height: 7, size: 3.0, resist: { ember: 0.85, rime: -0.25 }, hyperarmor: true, lavaGlow: true,
    attacks: [
      { id: 'punch', windup: 0.75, active: 0.18, recovery: 0.7, range: 6, arc: 80, dmg: 34, posture: 30, weight: 3 },
      { id: 'sweep', windup: 0.9, active: 0.25, recovery: 0.8, range: 7, arc: 200, dmg: 30, posture: 35, weight: 2, cd: 5, unparryable: true },
      { id: 'slam', type: 'aoe', windup: 1.1, active: 0.1, recovery: 1.0, radius: 7.5, dmg: 42, posture: 40, weight: 2, cd: 7, launch: 9 },
      { id: 'magma', type: 'mantra', mantra: 'ash_pillar', windup: 0.8, recovery: 0.6, range: 30, weight: 2, cd: 6, repeat: 3 },
      { id: 'boulder', type: 'projectile', windup: 1.0, recovery: 0.8, range: 34, minRange: 9, dmg: 32, posture: 30, weight: 1.5, cd: 6, proj: { speed: 26, color: '#ff6a1a', size: 1.4, rock: true, gravity: 5, status: 'burn', element: 'ember' } },
    ],
    drops: [{ id: 'fracture_core', chance: 1 }, { id: 'cinderbrand', chance: 1, weapon: true }, { id: 'mantra_spark', chance: 1, count: [1, 2] }],
    outfitDrop: 'cinderplate',
  },
  // Hightoll (data/hightoll.js): the castle's garrison, still at its posts, and its castellan,
  // still keeping the Bridge Gate for a relief that never came over the bridge.
  hightoll_sentry: {
    name: 'Hightoll Sentry', model: 'humanoid', level: 13, hp: 380, posture: 190, speed: 4.8, aggro: 18, xp: 330, silver: [8, 18],
    weapon: 'hightoll_glaive', dmgMul: 0.95, critChance: 0.18, comboMax: 2, scale: 1.12, feintChance: 0.08,
    defend: { block: 0.45, parry: 0.12, dodge: 0 }, knockable: true, resist: { phys: 0.08, storm: -0.2 },
    look: { skin: '#4c4741', hair: '#8a8478', outfit: { main: '#5f6367', trim: '#b8902e', pants: '#383a3e', boots: '#24221f' }, helm: '#7d8186', armored: true, eyes: '#ffd27a', glowEyes: true, cape: '#6a2a26' },
    drops: [{ id: 'smithing_stone', chance: 0.25 }, { id: 'iron_draught', chance: 0.08 }, { id: 'hightoll_glaive', chance: 0.03, weapon: true }],
  },
  castellan: {
    name: 'Odric the Unrelieved', title: 'Castellan of Hightoll', model: 'humanoid', boss: true, level: 15, hp: 2900, posture: 540, speed: 5.2, aggro: 24, leash: 60,
    xp: 4400, silver: [480, 640], weapon: 'toll_hammer', dmgMul: 0.92, critChance: 0.3, comboMax: 3, scale: 2.05, feintChance: 0.2,
    defend: { block: 0.35, parry: 0.24, dodge: 0 }, knockable: false, resist: { phys: 0.12, umbra: 0.3, storm: -0.2 },
    look: { skin: '#57504a', hair: '#cfc8b8', beard: '#cfc8b8', outfit: { main: '#5a5e62', trim: '#c9a046', pants: '#34363a', boots: '#22201e' }, helm: '#787c80', armored: true, eyes: '#ffd27a', glowEyes: true, cape: '#7b2f2b' },
    specials: [
      // he strikes the court like the bell: a ring of sound you cannot block, only dodge
      { id: 'knell', type: 'aoe', anim: 'heavySlam', windup: 1.05, active: 0.1, recovery: 0.9, range: 7, radius: 8.5, dmg: 30, posture: 46, unblockable: true, cd: 10, sound: 'toll' },
      { id: 'toll_fall', type: 'leap', windup: 0.8, active: 0.5, recovery: 0.8, range: 18, minRange: 7, arc: 90, dmg: 34, posture: 38, unparryable: true, cd: 9, shockwave: 5.5 },
      { id: 'toll_stone', type: 'projectile', anim: 'castThrow', windup: 0.9, recovery: 0.7, range: 30, minRange: 10, dmg: 28, posture: 26, cd: 7, proj: { speed: 24, color: '#bdb7a2', size: 1.2, rock: true, gravity: 6 } },
      { id: 'last_toll', type: 'buff', windup: 1.4, recovery: 0.5, cd: 40, hpBelow: 0.5, once: true },
    ],
    summons: { type: 'hightoll_sentry', count: 2, atHp: [0.66, 0.33] },
    drops: [{ id: 'toll_hammer', chance: 1, weapon: true }, { id: 'mantra_spark', chance: 1, count: [1, 2] }, { id: 'iron_draught', chance: 1, count: [2, 2] }],
  },
  hollow_duke: {
    name: 'The Hollow Duke', title: 'Sovereign Beneath', model: 'humanoid', boss: true, level: 19, hp: 5200, posture: 520, speed: 6.0, aggro: 36, leash: 70,
    xp: 8000, silver: [0, 0], weapon: 'hollow_crown', dmgMul: 1.0, critChance: 0.3, comboMax: 4, scale: 1.45, sanityHit: 8,
    defend: { block: 0.25, parry: 0.35, dodge: 0.15 }, knockable: false, resist: { umbra: 0.85 },
    mantras: ['umbral_orb', 'void_eruption', 'shade_step'], mantraChance: 0.4, mantraPower: 1.4,
    summons: { type: 'hollow', count: 2, atHp: [0.66, 0.33] },
    look: { skin: '#1a1424', hair: '#0a0810', outfit: { main: '#120a1e', trim: '#a274ff', pants: '#0a0612', boots: '#05030a' }, eyes: '#e0c8ff', glowEyes: true, crown: '#a274ff', cape: '#1a0e2a' },
    drops: [{ id: 'hollow_crown', chance: 1, weapon: true }, { id: 'ember_of_life', chance: 1 }, { id: 'mantra_spark', chance: 1, count: [2, 2] }],
  },
};
