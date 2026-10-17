// Weapon classes (movesets) and individual weapons.
// Timings are in seconds. dmgMul/postureMul multiply the weapon's base values.

export const WEAPON_CLASSES = {
  fist: {
    label: 'Fist', type: 'light', range: 2.4, arc: 80, windup: 0.15, active: 0.1, recovery: 0.15,
    combo: ['jabR', 'jabL', 'hookR', 'kickR'], comboDmg: [1, 1, 1.1, 1.3], postureMul: 0.8, sound: 'swing', pitch: 1.5,
    crit: { name: 'Rising Upper', anim: 'uppercut', windup: 0.34, active: 0.14, recovery: 0.42, dmgMul: 1.8, postureMul: 2.4, launch: 8, cd: 5 },
  },
  dagger: {
    label: 'Dagger', type: 'light', range: 2.7, arc: 80, windup: 0.14, active: 0.1, recovery: 0.16,
    combo: ['stabR', 'slashR', 'slashL', 'stabR'], comboDmg: [1, 1, 1, 1.25], postureMul: 0.7, sound: 'swing', pitch: 1.3,
    crit: { name: 'Viper Flurry', anim: 'flurry', windup: 0.24, active: 0.5, hits: 4, recovery: 0.32, dmgMul: 0.65, postureMul: 0.6, lunge: 6, cd: 6 },
  },
  sword: {
    label: 'Sword', type: 'medium', range: 3.3, arc: 110, windup: 0.2, active: 0.12, recovery: 0.21,
    combo: ['slashR', 'slashL', 'slashDown', 'thrust'], comboDmg: [1, 1, 1.05, 1.2], postureMul: 1, sound: 'swing', pitch: 1,
    crit: { name: 'Crescent Cleave', anim: 'spinSlash', windup: 0.36, active: 0.2, recovery: 0.42, dmgMul: 1.7, postureMul: 1.8, arc: 360, range: 3.7, cd: 6 },
  },
  rapier: {
    label: 'Rapier', type: 'light', range: 3.7, arc: 45, windup: 0.16, active: 0.1, recovery: 0.19,
    combo: ['thrust', 'thrust', 'slashR', 'thrust'], comboDmg: [1, 1, 1, 1.3], postureMul: 0.8, sound: 'swing', pitch: 1.4,
    crit: { name: 'Needle Lunge', anim: 'lunge', windup: 0.42, active: 0.2, recovery: 0.38, lunge: 18, dmgMul: 2.0, postureMul: 1.2, unparryable: true, cd: 7 },
  },
  katana: {
    label: 'Katana', type: 'medium', range: 3.4, arc: 110, windup: 0.19, active: 0.12, recovery: 0.21,
    combo: ['slashR', 'slashL', 'slashUp', 'slashDown'], comboDmg: [1, 1, 1.05, 1.2], postureMul: 0.9, sound: 'swing', pitch: 1.15,
    crit: { name: 'Iaido Flash', anim: 'iaido', windup: 0.5, active: 0.16, recovery: 0.42, lunge: 30, dmgMul: 2.2, postureMul: 1.4, unparryable: true, cd: 8 },
  },
  spear: {
    label: 'Spear', type: 'medium', range: 4.4, arc: 55, windup: 0.22, active: 0.13, recovery: 0.24,
    combo: ['thrust', 'thrust', 'sweepR', 'thrust'], comboDmg: [1, 1, 1.1, 1.2], postureMul: 1, sound: 'swing', pitch: 0.9,
    crit: { name: 'Impaling Drive', anim: 'impale', windup: 0.44, active: 0.18, recovery: 0.44, range: 5.8, dmgMul: 1.9, postureMul: 2.2, lunge: 12, cd: 7 },
  },
  greatsword: {
    label: 'Greatsword', type: 'heavy', range: 3.9, arc: 140, windup: 0.32, active: 0.16, recovery: 0.33,
    combo: ['heavyR', 'heavyL', 'heavyDown'], comboDmg: [1, 1, 1.25], postureMul: 1.4, sound: 'swingHeavy', pitch: 1,
    crit: { name: 'Sky Splitter', anim: 'heavySlam', windup: 0.6, active: 0.18, recovery: 0.58, dmgMul: 2.2, postureMul: 2.6, shockwave: 4, hyperarmor: true, cd: 8 },
  },
  greataxe: {
    label: 'Greataxe', type: 'heavy', range: 3.7, arc: 150, windup: 0.33, active: 0.16, recovery: 0.34,
    combo: ['heavyR', 'heavyL', 'heavyDown'], comboDmg: [1, 1.05, 1.3], postureMul: 1.3, sound: 'swingHeavy', pitch: 0.9,
    crit: { name: "Reaver's Whirl", anim: 'whirlwind', windup: 0.32, active: 0.8, hits: 3, recovery: 0.48, dmgMul: 0.95, postureMul: 0.9, arc: 360, hyperarmor: true, cd: 8 },
  },
  hammer: {
    label: 'Maul', type: 'heavy', range: 3.5, arc: 120, windup: 0.36, active: 0.16, recovery: 0.37,
    combo: ['heavyDown', 'heavyR', 'heavyDown'], comboDmg: [1, 1, 1.3], postureMul: 1.7, sound: 'swingHeavy', pitch: 0.75,
    crit: { name: 'Earthshaker', anim: 'heavySlam', windup: 0.64, active: 0.18, recovery: 0.6, dmgMul: 2.0, postureMul: 3.2, shockwave: 5, unblockable: true, hyperarmor: true, cd: 9 },
  },
};

// ---- expanded classes ----
Object.assign(WEAPON_CLASSES, {
  scythe: {
    label: 'Scythe', type: 'heavy', range: 4.6, arc: 170, windup: 0.3, active: 0.18, recovery: 0.32,
    combo: ['heavyR', 'heavyL', 'sweepR', 'heavyDown'], comboDmg: [1, 1, 1.05, 1.25], postureMul: 1.1, sound: 'swingHeavy', pitch: 0.85,
    crit: { name: 'Grim Harvest', anim: 'whirlwind', windup: 0.35, active: 0.7, hits: 2, recovery: 0.45, dmgMul: 1.25, postureMul: 1.1, arc: 360, range: 5, lunge: 4, hyperarmor: true, cd: 8 },
  },
  club: {
    label: 'Club', type: 'medium', range: 3.0, arc: 110, windup: 0.22, active: 0.13, recovery: 0.26,
    combo: ['heavyR', 'slashL', 'heavyDown'], comboDmg: [1, 1.05, 1.2], postureMul: 1.35, sound: 'swingHeavy', pitch: 1.1,
    crit: { name: 'Skullcracker', anim: 'heavySlam', windup: 0.45, active: 0.16, recovery: 0.5, dmgMul: 1.8, postureMul: 3.2, shockwave: 2.5, cd: 7 },
  },
  lance: {
    label: 'Lance', type: 'heavy', range: 5.0, arc: 40, windup: 0.28, active: 0.15, recovery: 0.3,
    combo: ['thrust', 'thrust', 'impale'], comboDmg: [1, 1.1, 1.3], postureMul: 1.2, sound: 'swingHeavy', pitch: 1.05,
    crit: { name: 'Gallant Charge', anim: 'lunge', windup: 0.5, active: 0.3, recovery: 0.5, lunge: 24, dmgMul: 2.3, postureMul: 2.0, range: 3, hyperarmor: true, unparryable: true, cd: 9 },
  },
});

export const RUNNING_ATTACK = { anim: 'runSlash', windup: 0.18, active: 0.14, recovery: 0.32, lunge: 11, dmgMul: 1.25, postureMul: 1.3 };
export const AERIAL_ATTACK = { anim: 'aerialSlam', windup: 0.16, active: 0.5, recovery: 0.3, dmgMul: 1.35, postureMul: 1.6, aerial: true };

export const ENCHANTS = {
  searing: { name: 'Searing', color: '#ff7a2f', desc: 'Hits have a 30% chance to burn.', status: 'burn', chance: 0.3 },
  frozen: { name: 'Frozen', color: '#8fd8ff', desc: 'Hits chill the target.', status: 'chill', chance: 0.5 },
  thundering: { name: 'Thundering', color: '#ffe14d', desc: 'Hits have a 15% chance to shock.', status: 'shock', chance: 0.15 },
  cruel: { name: 'Cruel', color: '#e0243f', desc: 'Hits have a 35% chance to cause bleeding.', status: 'bleed', chance: 0.35 },
  hungering: { name: 'Hungering', color: '#c03050', desc: 'Heal 6% of damage dealt.', lifesteal: 0.06 },
  swift: { name: 'Swift', color: '#a6ffd2', desc: 'Swings 8% faster.', speed: 0.08 },
  weighty: { name: 'Weighty', color: '#c9a27a', desc: '+25% posture damage.', posture: 0.25 },
  riftborn: { name: 'Riftborn', color: '#a274ff', desc: '+10% damage. Hits may blind.', dmg: 0.1, status: 'blind', chance: 0.12 },
};

export const RARITY_COLORS = {
  common: '#c9c4b8',
  uncommon: '#6fd17a',
  rare: '#5aa7ff',
  epic: '#c07bff',
  legendary: '#ffb547',
};

// mesh: visual parameters consumed by entities/weaponMesh.js
export const WEAPONS = {
  fists: {
    name: 'Fists', cls: 'fist', bare: true, damage: 7, posture: 7, scaling: { light: 0.6, strength: 0.4 }, reqs: null,
    reach: 0, speed: 1.0, chip: 0, pen: 0, weight: 0.5,
    rarity: 'common', price: 0, desc: 'Bare knuckles. Fast and honest.', mesh: { kind: 'fist', color: '#8a7a6a' },
  },
  rusty_dagger: {
    name: 'Rusted Dagger', cls: 'dagger', damage: 9, posture: 6, scaling: { light: 0.9, agility: 0.2 }, reqs: null,
    reach: -0.1, speed: 1.0, chip: 0, pen: 0.15, weight: 1.0,
    rarity: 'common', price: 30, desc: 'Pitted and dull, but it still finds gaps in armor.',
    mesh: { kind: 'dagger', blade: '#8a6f5a', guard: '#5a4a3a', handle: '#3a2a20', length: 0.42 },
  },
  bronze_sword: {
    name: 'Bronze Sword', cls: 'sword', damage: 11, posture: 9, scaling: { medium: 0.9, strength: 0.3 }, reqs: null,
    reach: -0.1, speed: 1.0, chip: 0.03, pen: 0, weight: 3.0,
    rarity: 'common', price: 45, desc: 'A sailor\'s sidearm, green at the edges.',
    mesh: { kind: 'sword', blade: '#c08a4a', guard: '#7a5a2a', handle: '#3a2a20', length: 0.95 },
  },
  hunters_spear: {
    name: "Hunter's Spear", cls: 'spear', damage: 13, posture: 9, scaling: { medium: 0.9, agility: 0.2 }, reqs: { medium: 10 },
    reach: 0, speed: 1.0, chip: 0.02, pen: 0.1, weight: 3.0,
    rarity: 'common', price: 140, desc: 'Ash-wood shaft, iron head. Keeps beasts at a distance.',
    mesh: { kind: 'spear', blade: '#b9bfc8', guard: '#4a3a2a', handle: '#6b4e32', length: 2.1 },
  },
  iron_knuckles: {
    name: 'Iron Knuckles', cls: 'fist', damage: 10, posture: 9, scaling: { light: 0.8, strength: 0.5 }, reqs: { light: 10 },
    reach: 0, speed: 0.97, chip: 0.05, pen: 0.1, weight: 1.5,
    rarity: 'common', price: 130, desc: 'Banded iron over leather. Every jab lands like a hammer.',
    mesh: { kind: 'fist', color: '#8f949c' },
  },
  steel_longsword: {
    name: 'Steel Longsword', cls: 'sword', damage: 16, posture: 12, scaling: { medium: 1.0, strength: 0.35 }, reqs: { medium: 20 },
    reach: 0.2, speed: 0.98, chip: 0.05, pen: 0.1, weight: 3.5,
    rarity: 'uncommon', price: 280, desc: 'Saltreach steel - reliable, balanced, unremarkable in the best way.',
    mesh: { kind: 'sword', blade: '#d6dbe3', guard: '#8a8f99', handle: '#2a2a30', length: 1.05 },
  },
  duelist_rapier: {
    name: "Duelist's Rapier", cls: 'rapier', damage: 14, posture: 8, scaling: { light: 1.0, agility: 0.35 }, reqs: { light: 20 },
    reach: 0.1, speed: 1.04, chip: 0, pen: 0.2, weight: 1.6,
    rarity: 'uncommon', price: 320, desc: 'A thin, singing blade made for those who never stand still.',
    mesh: { kind: 'rapier', blade: '#e6ebf2', guard: '#d4b04a', handle: '#3a2030', length: 1.1 },
  },
  wavecutter_kris: {
    name: 'Wavecutter Kris', cls: 'dagger', damage: 14, posture: 8, scaling: { light: 1.1, agility: 0.3 }, reqs: { light: 25 },
    reach: 0.1, speed: 1.0, chip: 0.04, pen: 0.1, weight: 1.4, trait: 'undertow',
    rarity: 'rare', price: 420, enchant: 'cruel', desc: 'A wavy blade from the fen tribes. Wounds it opens do not close.',
    mesh: { kind: 'dagger', blade: '#9fd3d0', guard: '#2a5a5a', handle: '#1a2a2a', length: 0.5, wavy: true },
  },
  driftsteel_katana: {
    name: 'Driftsteel Katana', cls: 'katana', damage: 18, posture: 11, scaling: { medium: 1.1, agility: 0.25 }, reqs: { medium: 30 },
    reach: 0, speed: 1.04, chip: 0.04, pen: 0.1, weight: 2.8, trait: 'ebb',
    rarity: 'rare', price: 640, desc: 'Folded from salvaged ship-iron. Cuts like a tide going out.',
    mesh: { kind: 'katana', blade: '#e9eef5', guard: '#2a2a2a', handle: '#5a1a1a', length: 1.05 },
  },
  iron_greatsword: {
    name: 'Iron Greatsword', cls: 'greatsword', damage: 23, posture: 18, scaling: { heavy: 1.0, strength: 0.4 }, reqs: { heavy: 15 },
    reach: 0, speed: 1.0, chip: 0.12, pen: 0.05, weight: 9.0,
    rarity: 'uncommon', price: 380, desc: 'More slab than sword. Swing it and let the world sort itself out.',
    mesh: { kind: 'greatsword', blade: '#a9aeb6', guard: '#4a4a52', handle: '#2a2018', length: 1.6 },
  },
  woodcutter_axe: {
    name: "Woodcutter's Greataxe", cls: 'greataxe', damage: 19, posture: 17, scaling: { heavy: 1.0, strength: 0.4 }, reqs: { heavy: 10 },
    reach: -0.1, speed: 1.02, chip: 0.14, pen: 0.15, weight: 8.0,
    rarity: 'common', price: 240, desc: 'Meant for trees. Works on brigands.',
    mesh: { kind: 'greataxe', blade: '#9da2a8', guard: '#4a3a2a', handle: '#6b4e32', length: 1.5 },
  },
  bonebreaker: {
    name: 'Bonebreaker Maul', cls: 'hammer', damage: 27, posture: 24, scaling: { heavy: 1.0, strength: 0.55 }, reqs: { heavy: 30, strength: 15 },
    reach: 0, speed: 1.0, chip: 0.2, pen: 0.25, weight: 11.0, trait: 'shatterhead',
    rarity: 'rare', price: 700, enchant: 'weighty', desc: 'A stone head bound to an iron haft. Guards fold beneath it.',
    mesh: { kind: 'hammer', blade: '#7d7a76', guard: '#3a3a3a', handle: '#4a3a2a', length: 1.5 },
  },
  cutlass: {
    name: "Sailor's Cutlass", cls: 'sword', damage: 12, posture: 9, scaling: { medium: 0.9, agility: 0.25 }, reqs: { medium: 5 },
    reach: -0.2, speed: 1.06, chip: 0.02, pen: 0.05, weight: 2.5,
    rarity: 'common', price: 90, desc: 'A curved boarding blade. Every deckhand in Saltreach owns one.',
    mesh: { kind: 'sword', blade: '#cfd3d8', guard: '#b08a3a', handle: '#2a1a14', length: 0.9 },
  },
  serrated_shiv: {
    name: 'Serrated Shiv', cls: 'dagger', damage: 12, posture: 7, scaling: { light: 1.0, agility: 0.25 }, reqs: { light: 15 },
    reach: 0, speed: 1.04, chip: 0.02, pen: 0.05, weight: 1.2,
    rarity: 'uncommon', price: 230, desc: 'Teeth filed into the edge. It snags on the way out.',
    mesh: { kind: 'dagger', blade: '#b8b2a8', guard: '#3a3030', handle: '#2a1a1a', length: 0.46, wavy: true },
  },
  watch_pike: {
    name: 'Watch Pike', cls: 'spear', damage: 17, posture: 13, scaling: { medium: 1.0, strength: 0.25 }, reqs: { medium: 20 },
    reach: 0.4, speed: 0.95, chip: 0.04, pen: 0.12, weight: 4.5,
    rarity: 'uncommon', price: 340, desc: 'Standard issue for the Saltreach Watch. Long enough to keep trouble at arm\'s length.',
    mesh: { kind: 'spear', blade: '#d6dbe3', guard: '#2a4a7a', handle: '#4a3a2a', length: 2.25 },
  },
  hightoll_glaive: {
    name: 'Hightoll Glaive', cls: 'spear', damage: 19, posture: 14, scaling: { medium: 1.0, strength: 0.3 }, reqs: { medium: 25 },
    reach: 0.3, speed: 0.94, chip: 0.1, pen: 0.08, weight: 5.0, trait: 'sentry',
    rarity: 'rare', price: 620, desc: 'A sentry\'s glaive from the post at the end of the Arches. The edge is kept; the shaft has been rewrapped more times than anyone counted.',
    mesh: { kind: 'spear', blade: '#c9c3ad', guard: '#8c7340', handle: '#3a2c20', length: 2.35 },
  },
  ember_gauntlets: {
    name: 'Ember Gauntlets', cls: 'fist', damage: 15, posture: 14, scaling: { light: 0.9, strength: 0.45, ember: 0.2 }, reqs: { light: 25 },
    reach: 0.1, speed: 0.95, chip: 0.08, pen: 0.05, weight: 2.5, trait: 'kindling',
    rarity: 'rare', price: 620, enchant: 'searing', desc: 'Iron fists packed with smouldering coal. They never cool.',
    mesh: { kind: 'fist', color: '#5a2a1a', glow: '#ff7a2f' },
  },
  moonveil_katana: {
    name: 'Moonveil', cls: 'katana', damage: 20, posture: 11, scaling: { medium: 1.1, agility: 0.3 }, reqs: { medium: 30 },
    reach: 0.2, speed: 1.0, chip: 0.05, pen: 0.12, weight: 3.0, trait: 'moonlit',
    rarity: 'rare', price: 760, desc: 'Forged under a moon that no longer rises. The blade remembers it.',
    mesh: { kind: 'katana', blade: '#dfe8ff', guard: '#3a4a7a', handle: '#1a1a3a', length: 1.1, glow: '#9fb8ff' },
  },
  stormneedle: {
    name: 'Stormneedle', cls: 'rapier', damage: 17, posture: 9, scaling: { light: 1.05, agility: 0.35, storm: 0.15 }, reqs: { light: 30 },
    reach: 0.2, speed: 1.0, chip: 0.05, pen: 0.15, weight: 2.0, trait: 'static',
    rarity: 'rare', price: 820, enchant: 'thundering', desc: 'A copper-wound rapier that crackles when drawn.',
    mesh: { kind: 'rapier', blade: '#f2e6a6', guard: '#b8783a', handle: '#2a2030', length: 1.15, glow: '#ffe14d' },
  },
  tidebreaker: {
    name: 'Tidebreaker', cls: 'greatsword', damage: 27, posture: 21, scaling: { heavy: 1.05, strength: 0.4 }, reqs: { heavy: 30 },
    reach: 0.1, speed: 0.94, chip: 0.15, pen: 0.08, weight: 10.5, trait: 'breakwater',
    rarity: 'rare', price: 880, desc: 'Cut from a drowned ship\'s keel-plate. Heavy as an anchor, twice as stubborn.',
    mesh: { kind: 'greatsword', blade: '#8fb8b0', guard: '#2a4a4a', handle: '#1a2a2a', length: 1.7 },
  },
  glacier_cleaver: {
    name: 'Glacier Cleaver', cls: 'greataxe', damage: 26, posture: 19, scaling: { heavy: 1.05, strength: 0.4, rime: 0.15 }, reqs: { heavy: 30 },
    reach: 0.1, speed: 0.96, chip: 0.16, pen: 0.18, weight: 9.0, trait: 'rime_bite',
    rarity: 'rare', price: 900, enchant: 'frozen', desc: 'The White Cult\'s executioner\'s axe. Frost creeps up the haft.',
    mesh: { kind: 'greataxe', blade: '#cfefff', guard: '#5a7a9a', handle: '#2a3a4a', length: 1.6, glow: '#8fd8ff' },
  },
  kestrel_blade: {
    name: 'Kestrel', cls: 'sword', damage: 22, posture: 14, scaling: { medium: 1.1, agility: 0.3 }, reqs: { medium: 30 },
    reach: 0.1, speed: 1.08, chip: 0.04, pen: 0.12, weight: 2.2, trait: 'kestrel',
    rarity: 'epic', price: 1300, enchant: 'swift', desc: 'Sera Vane\'s blade. Light enough to feel like it is swinging you.',
    mesh: { kind: 'sword', blade: '#eef2f8', guard: '#d4b04a', handle: '#5a1a2a', length: 1.05, glow: '#fff2c0' },
  },
  riftglass_dirk: {
    name: 'Riftglass Dirk', cls: 'dagger', damage: 18, posture: 10, scaling: { light: 1.15, agility: 0.3, umbra: 0.2 }, reqs: { light: 35 },
    reach: 0.15, speed: 1.0, chip: 0.06, pen: 0.25, weight: 0.8, trait: 'thin_air',
    rarity: 'epic', price: 1500, enchant: 'riftborn', desc: 'Knapped from crystallized Rift. It cuts things that are not entirely there.',
    mesh: { kind: 'dagger', blade: '#b89aff', guard: '#2a1a3a', handle: '#0a0812', length: 0.55, glow: '#a274ff' },
  },
  drowned_greatsword: {
    name: 'Drowned Oath', cls: 'greatsword', damage: 30, posture: 23, scaling: { heavy: 1.1, strength: 0.4 }, reqs: { heavy: 35 },
    reach: 0.2, speed: 0.97, chip: 0.14, pen: 0.12, weight: 10.0, trait: 'oathbound',
    rarity: 'epic', price: 1600, enchant: 'hungering', desc: 'The sword of a knight who swore to hold the line beneath the sea. He is still holding it.',
    mesh: { kind: 'greatsword', blade: '#4a5a6a', guard: '#a274ff', handle: '#1a1a24', length: 1.75, glow: '#6a4aaa' },
  },
  magma_maul: {
    name: 'Magmaheart Maul', cls: 'hammer', damage: 31, posture: 27, scaling: { heavy: 1.1, strength: 0.5, ember: 0.2 }, reqs: { heavy: 40, strength: 20 },
    reach: 0.1, speed: 0.95, chip: 0.22, pen: 0.2, weight: 12.0, trait: 'molten',
    rarity: 'epic', price: 1800, enchant: 'searing', desc: 'A hammerhead of cooling magma bound in iron. It glows hotter with every swing.',
    mesh: { kind: 'hammer', blade: '#3a2420', guard: '#ff6a1a', handle: '#2a1a14', length: 1.55, glow: '#ff6a1a' },
  },
  mossbound_spear: {
    name: 'Mossbound Spear', cls: 'spear', damage: 21, posture: 15, scaling: { medium: 1.05, agility: 0.25, gale: 0.1 }, reqs: { medium: 30 },
    reach: 0.1, speed: 1.05, chip: 0.03, pen: 0.15, weight: 2.6, trait: 'rootgrip',
    rarity: 'rare', price: 840, desc: 'Ironwood and obsidian, wrapped in living moss. It is never quite dry.',
    mesh: { kind: 'spear', blade: '#2a2a30', guard: '#3a6a2a', handle: '#4a3a22', length: 2.3 },
  },
  thresher_fang: {
    name: 'Thresher Fang', cls: 'dagger', damage: 22, posture: 11, scaling: { light: 1.15, agility: 0.3, strength: 0.15 }, reqs: { light: 35 },
    reach: 0.2, speed: 0.96, chip: 0.1, pen: 0.2, weight: 2.0, trait: 'gnaw',
    rarity: 'legendary', price: 2400, enchant: 'cruel', desc: 'A tooth from Bonegnaw\'s maw, hilted in its own bone. It wants to keep chewing.',
    mesh: { kind: 'dagger', blade: '#e8e0c8', guard: '#6a5a48', handle: '#3a2a1a', length: 0.6, wavy: true },
  },
  primal_knuckles: {
    name: "Old King's Fists", cls: 'fist', damage: 26, posture: 26, scaling: { light: 0.9, strength: 0.7 }, reqs: { light: 35, strength: 25 },
    reach: 0.2, speed: 0.88, chip: 0.15, pen: 0.2, weight: 4.0, trait: 'old_king',
    rarity: 'legendary', price: 3000, enchant: 'weighty', desc: 'Iron-banded stone knuckles prised from the Primadon. Every blow lands like a falling tree.',
    mesh: { kind: 'fist', color: '#4a4440', glow: '#ff6a2a' },
  },
  lanternless_scythe: {
    name: 'Lanternless Reaper', cls: 'scythe', damage: 36, posture: 26, scaling: { heavy: 1.15, strength: 0.4, umbra: 0.3 }, reqs: { heavy: 45 },
    reach: 0.3, speed: 0.97, chip: 0.12, pen: 0.2, weight: 7.0, trait: 'toll_of_souls',
    rarity: 'legendary', price: 4200, enchant: 'riftborn', desc: 'The Ferryman\'s blade. It was made to cut the rope between a soul and its body.',
    mesh: { kind: 'scythe', blade: '#1a0a10', guard: '#ff2a4a', handle: '#0a0608', length: 2.1, glow: '#ff2a4a' },
  },
  champions_gladius: {
    name: "Champion's Gladius", cls: 'sword', damage: 24, posture: 16, scaling: { medium: 1.1, strength: 0.3, agility: 0.15 }, reqs: { medium: 35 },
    reach: -0.25, speed: 1.04, chip: 0.1, pen: 0.15, weight: 3.8, trait: 'crowd',
    rarity: 'epic', price: 2000, enchant: 'weighty', desc: 'Awarded to those who survive the Crucible\'s champion trial. The crowd still cheers when you draw it.',
    mesh: { kind: 'sword', blade: '#e8d8a8', guard: '#a8281c', handle: '#3a1a14', length: 0.95, glow: '#ffd27a' },
  },
  witchthorn_rapier: {
    name: 'Witchthorn', cls: 'rapier', damage: 19, posture: 10, scaling: { light: 1.1, agility: 0.3, umbra: 0.15 }, reqs: { light: 25 },
    reach: 0.3, speed: 0.96, chip: 0.08, pen: 0.25, weight: 1.8, trait: 'bramble',
    rarity: 'epic', price: 1400, enchant: 'cruel', desc: 'A thorn from the Witch-Queen\'s bramble-throne, grown straight and sharpened. It drinks.',
    mesh: { kind: 'rapier', blade: '#4a6a2a', guard: '#b6ff9c', handle: '#1a2414', length: 1.15, glow: '#b6ff9c' },
  },
  farmhand_scythe: {
    name: "Farmhand's Scythe", cls: 'scythe', damage: 19, posture: 14, scaling: { heavy: 0.95, strength: 0.3 }, reqs: { heavy: 10 },
    reach: -0.2, speed: 1.04, chip: 0.08, pen: 0.05, weight: 5.0,
    rarity: 'common', price: 210, desc: 'Meant for wheat. The brigands found out it works on more than wheat.',
    mesh: { kind: 'scythe', blade: '#a8acb2', guard: '#4a3a2a', handle: '#7a5a3a', length: 1.9 },
  },
  gravewarden_scythe: {
    name: 'Gravewarden', cls: 'scythe', damage: 27, posture: 19, scaling: { heavy: 1.05, strength: 0.3, umbra: 0.15 }, reqs: { heavy: 30 },
    reach: 0.1, speed: 1.0, chip: 0.1, pen: 0.12, weight: 6.0, trait: 'grave_toll',
    rarity: 'rare', price: 900, desc: 'Carried by those who tended the drowned dead. The blade is cold even in the sun.',
    mesh: { kind: 'scythe', blade: '#4a4a5a', guard: '#a274ff', handle: '#1a1420', length: 2.0, glow: '#7a5aaa' },
  },
  oak_club: {
    name: 'Oak Cudgel', cls: 'club', damage: 12, posture: 13, scaling: { medium: 0.85, strength: 0.4 }, reqs: null,
    reach: 0, speed: 1.0, chip: 0.1, pen: 0, weight: 4.0,
    rarity: 'common', price: 60, desc: 'A knotted length of oak. Simple, honest, and very hard.',
    mesh: { kind: 'club', blade: '#6a4a2a', guard: '#4a3a2a', handle: '#5a3a22', length: 0.8 },
  },
  spiked_mace: {
    name: 'Spiked Mace', cls: 'club', damage: 16, posture: 17, scaling: { medium: 0.95, strength: 0.4 }, reqs: { medium: 15, strength: 10 },
    reach: 0.1, speed: 0.96, chip: 0.14, pen: 0.15, weight: 5.0,
    rarity: 'uncommon', price: 300, desc: 'Iron flanges on a steel haft. Shields dent; arms go numb.',
    mesh: { kind: 'club', blade: '#7a7e86', guard: '#3a3a40', handle: '#2a2018', length: 0.85, spikes: true },
  },
  warden_mace: {
    name: "Warden's Mace", cls: 'club', damage: 21, posture: 21, scaling: { medium: 1.0, strength: 0.45 }, reqs: { medium: 30, strength: 20 },
    reach: 0.15, speed: 0.97, chip: 0.16, pen: 0.12, weight: 5.5, trait: 'discipline',
    rarity: 'rare', price: 840, enchant: 'weighty', desc: 'The Saltreach Watch keeps three of these. Now it keeps two.',
    mesh: { kind: 'club', blade: '#7a828c', guard: '#2a4a7a', handle: '#1a1a20', length: 0.9, spikes: true },
  },
  tourney_lance: {
    name: 'Tourney Lance', cls: 'lance', damage: 22, posture: 16, scaling: { heavy: 0.95, agility: 0.2 }, reqs: { heavy: 20 },
    reach: 0, speed: 1.0, chip: 0.06, pen: 0.1, weight: 7.0,
    rarity: 'uncommon', price: 420, desc: 'Painted in a house\'s colours that nobody living remembers.',
    mesh: { kind: 'lance', blade: '#a8a49a', guard: '#a8281c', handle: '#c8b888', length: 2.5 },
  },
  meridian_lance: {
    name: 'Meridian Lance', cls: 'lance', damage: 26, posture: 20, scaling: { heavy: 1.05, agility: 0.25 }, reqs: { heavy: 35 },
    reach: 0.3, speed: 0.98, chip: 0.08, pen: 0.2, weight: 6.5, trait: 'charge',
    rarity: 'rare', price: 1000, enchant: 'swift', desc: 'A cavalry lance from an order of riders who outlived their horses.',
    mesh: { kind: 'lance', blade: '#9aa6b4', guard: '#d4b04a', handle: '#2a3a5a', length: 2.7 },
  },
  // ---- Legendary / boss drops ----
  toll_hammer: {
    name: 'The Toll Hammer', cls: 'hammer', damage: 30, posture: 28, scaling: { heavy: 1.1, strength: 0.5 }, reqs: { heavy: 35, strength: 15 },
    reach: 0.2, speed: 0.97, chip: 0.25, pen: 0.15, weight: 11.5, trait: 'last_toll',
    rarity: 'epic', price: 1600, enchant: 'weighty', desc: 'Hightoll\'s bell was rung with it for every cart that crossed. The castellan went on ringing it after the carts stopped.',
    mesh: { kind: 'hammer', blade: '#8c7340', guard: '#3a3632', handle: '#3a2c20', length: 1.6 },
  },
  kaelens_ruin: {
    name: "Kaelen's Ruin", cls: 'greataxe', damage: 30, posture: 21, scaling: { heavy: 1.1, strength: 0.45 }, reqs: { heavy: 25 },
    reach: 0.15, speed: 1.0, chip: 0.18, pen: 0.22, weight: 9.5, trait: 'notch',
    rarity: 'epic', price: 1200, enchant: 'cruel', desc: 'The Brigand Warlord\'s axe. Notched once for every captain it felled.',
    mesh: { kind: 'greataxe', blade: '#a83a2a', guard: '#2a1a1a', handle: '#3a2a1a', length: 1.65, glow: '#ff3a1a' },
  },
  frostfang: {
    name: 'Frostfang', cls: 'sword', damage: 24, posture: 15, scaling: { medium: 1.15, intelligence: 0.2, rime: 0.3 }, reqs: { medium: 35 },
    reach: 0.3, speed: 0.97, chip: 0.08, pen: 0.1, weight: 4.2, trait: 'heart_ice',
    rarity: 'legendary', price: 2400, enchant: 'frozen', desc: 'Carved from the Warden\'s heart-ice. It never thaws.',
    mesh: { kind: 'sword', blade: '#bfefff', guard: '#5fa8d3', handle: '#1a3a5a', length: 1.15, glow: '#8fd8ff' },
  },
  cinderbrand: {
    name: 'Cinderbrand', cls: 'greatsword', damage: 33, posture: 24, scaling: { heavy: 1.15, strength: 0.4, ember: 0.3 }, reqs: { heavy: 40 },
    reach: 0.25, speed: 1.02, chip: 0.13, pen: 0.15, weight: 9.5, trait: 'core_fire',
    rarity: 'legendary', price: 2800, enchant: 'searing', desc: 'Its edge still holds the Colossus\'s core-fire.',
    mesh: { kind: 'greatsword', blade: '#3a2a26', guard: '#ff7a2f', handle: '#2a1a14', length: 1.75, glow: '#ff6a1a' },
  },
  stormpiercer: {
    name: 'Stormpiercer', cls: 'spear', damage: 24, posture: 16, scaling: { medium: 1.1, agility: 0.2, storm: 0.3 }, reqs: { medium: 35 },
    reach: 0.5, speed: 1.0, chip: 0.06, pen: 0.2, weight: 3.4, trait: 'lightning_rod',
    rarity: 'legendary', price: 2600, enchant: 'thundering', desc: 'A spear that once pinned lightning to a mountain.',
    mesh: { kind: 'spear', blade: '#fff2a6', guard: '#c9a23a', handle: '#2a2a3a', length: 2.3, glow: '#ffe14d' },
  },
  hollow_crown: {
    name: 'Hollowed Crownblade', cls: 'katana', damage: 30, posture: 16, scaling: { medium: 1.2, agility: 0.25, umbra: 0.3 }, reqs: { medium: 40 },
    reach: 0.3, speed: 0.97, chip: 0.1, pen: 0.18, weight: 3.6, trait: 'hollow_gaze',
    rarity: 'legendary', price: 3200, enchant: 'riftborn', desc: 'The Hollow Duke\'s blade. It hums with the voices of the drowned.',
    mesh: { kind: 'katana', blade: '#1a1028', guard: '#a274ff', handle: '#0a0a12', length: 1.15, glow: '#a274ff' },
  },
  rift_blade: {
    name: 'Rift-Eaten Blade', cls: 'sword', damage: 15, posture: 12, scaling: { medium: 1.0, strength: 0.3 }, reqs: { medium: 15 },
    reach: 0.1, speed: 0.96, chip: 0.06, pen: 0.08, weight: 4.0,
    rarity: 'uncommon', price: 200, desc: 'A sword left too long in the Rift. Pitted with violet rust.',
    mesh: { kind: 'sword', blade: '#4a3a5a', guard: '#2a1a3a', handle: '#1a1a1a', length: 1.0, glow: '#6a3aaa' },
  },
  golem_fist: {
    name: 'Golem Fists', cls: 'fist', damage: 18, posture: 20, scaling: { strength: 0.6 }, reqs: null,
    reach: 0.3, speed: 0.85, chip: 0.2, pen: 0.1, weight: 6.0,
    rarity: 'common', price: 0, desc: '', mesh: { kind: 'fist', color: '#4a4440' }, hidden: true,
  },
};

// ---- handling: what sets one weapon apart from another of its class ----
// reach: metres added to the class's reach. speed: swing speed (wind-up, strike and recovery).
// chip: share of the damage that gets through a block. pen: share of the target's physical armour
// it ignores. weight: slows the wielder's walk and roll (WEIGHT). Shared by enemy weapons.
// Rare and named weapons carry one trait (WEAPON_TRAITS; the behaviour is combat/weaponTraits.js).
export const WEIGHT = {
  light: 4, // no penalty at or under this
  move: 0.006, // walking speed lost per unit of weight over it (gained per unit under it)
  roll: 0.01, // roll distance lost per unit over it
  rollCd: 0.02, // seconds added to the roll's cooldown per unit over it
};

export function weaponFeel(w) {
  return {
    reach: w && Number.isFinite(w.reach) ? w.reach : 0,
    speed: w && w.speed > 0 ? w.speed : 1,
    chip: w && Number.isFinite(w.chip) ? w.chip : 0,
    pen: w && Number.isFinite(w.pen) ? w.pen : 0,
    weight: w && Number.isFinite(w.weight) ? w.weight : 3,
    posture: w ? w.posture : 0,
    trait: (w && WEAPON_TRAITS[w.trait]) || null,
  };
}

// Multipliers for the wielder's walk and roll from the weapon's weight.
export function weightEffects(weight) {
  const over = weight - WEIGHT.light;
  return {
    move: 1 - over * WEIGHT.move,
    roll: over > 0 ? 1 - over * WEIGHT.roll : 1,
    rollCd: over > 0 ? over * WEIGHT.rollCd : 0,
  };
}

// The one special trait of a rare or named weapon. `foes: false` traits do nothing in an enemy's hands.
export const WEAPON_TRAITS = {
  undertow: { name: 'Undertow', desc: 'Hits on a bleeding foe open one more bleed stack.' },
  ebb: { name: 'Ebb and Flow', desc: 'The first swing within a second of a roll comes 20% faster.', foes: false },
  shatterhead: { name: 'Shatterhead', desc: 'A guard broken by it stays broken half a second longer.' },
  sentry: { name: "Sentry's Sweep", desc: 'The last swing of a string sweeps 40° wider and reaches 0.5 m further.', foes: false },
  kindling: { name: 'Kindling', desc: 'Every fourth hit in a row sets the foe alight.' },
  moonlit: { name: 'Moonlit Edge', desc: 'At night it deals 12% more damage.' },
  static: { name: 'Static Build', desc: 'Hits on a shocked foe deal 25% more damage.' },
  breakwater: { name: 'Breakwater', desc: 'Blocking with it takes 30% less posture.' },
  rime_bite: { name: 'Rime Bite', desc: 'Chilled or frozen foes take 15% more damage from it.' },
  kestrel: { name: "Kestrel's Feint", desc: 'Feints with it are ready again twice as fast.', foes: false },
  thin_air: { name: 'Thin Air', desc: 'Blows from behind deal 40% more damage.' },
  oathbound: { name: 'Oathbound', desc: 'Below 40% health, its swings cannot be interrupted.', foes: false },
  molten: { name: 'Molten Core', desc: 'Hits on a burning foe also burst for 6 fire damage.' },
  rootgrip: { name: 'Rootgrip', desc: 'Running attacks with it hold the foe in place for 0.7 s.', foes: false },
  gnaw: { name: 'Gnaw', desc: 'Each hit in a row on the same foe deals 5% more, up to 25%.', foes: false },
  old_king: { name: "Old King's Weight", desc: 'A guard broken by it is knocked off its feet.' },
  toll_of_souls: { name: 'Toll of Souls', desc: 'Each kill restores 10 ether and 6 sanity.', foes: false },
  crowd: { name: "Crowd's Favour", desc: 'Each hit you land without being struck adds 3% damage, up to 15%.', foes: false },
  bramble: { name: 'Bramble', desc: 'Parrying with it makes the attacker bleed.' },
  grave_toll: { name: 'Grave Toll', desc: 'Each kill restores 8 ether and 4% health.', foes: false },
  discipline: { name: "Watch's Discipline", desc: 'A blow parried with it costs the attacker 50% more posture.' },
  charge: { name: 'Charge', desc: 'Running attacks with it deal 30% more damage.', foes: false },
  last_toll: { name: 'Last Toll', desc: 'The last swing of a string rings out in a 2.5 m shockwave.', foes: false },
  notch: { name: "Captain's Notch", desc: 'Each kill quickens you by 15% for 3 s.', foes: false },
  heart_ice: { name: 'Heart-Ice', desc: 'Critical attacks freeze a chilled foe outright.', foes: false },
  core_fire: { name: 'Core-Fire', desc: 'Critical attacks erupt in a 3 m burst of fire.' },
  lightning_rod: { name: 'Lightning Rod', desc: 'Critical attacks arc to two more foes nearby.' },
  hollow_gaze: { name: 'Hollowed Gaze', desc: 'Critical attacks blind the foe.' },
};

// One line for a weapon's tooltip: how it handles, and its trait.
export function weaponFeelText(w) {
  const f = weaponFeel(w);
  const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1);
  const parts = [`reach ${sign(f.reach)} m`, `speed ${Math.round(f.speed * 100)}%`, `chip ${Math.round(f.chip * 100)}%`, `pierce ${Math.round(f.pen * 100)}%`, `weight ${f.weight}`];
  return parts.join(', ') + (f.trait ? `, ${f.trait.name}: ${f.trait.desc}` : '');
}

export function weaponDisplayName(item) {
  const w = WEAPONS[item.id];
  if (!w) return item.id;
  const en = item.enchant || w.enchant;
  const t = item.temper ? ` +${item.temper}` : '';
  if (en && !w.enchant && ENCHANTS[en]) return `${ENCHANTS[en].name} ${w.name}${t}`;
  return w.name + t;
}
