// What the high tiers hold (docs/agent/WORLD_LIFE_PLAN.md): tougher camps, better chests, and a
// mark seen from below, so a climber on the low ground knows what waits above. Final world
// metres (+x west): data/world.js appends these after its own catalogue is placed, so they
// are not moved. The climbing lines and hidden stairs that reach them are data/ledges.js.
import './worldFoes.js';

export const TIER_CHESTS = [
  // the Lampwright's Crown, over Saltreach: High
  { id: 'c_lamp_crown', x: -118, z: 202, loot: { silver: [130, 210], items: [['mantra_spark', 1], ['elixir', 1], ['iron_draught', 1]] } },
  // the Seamspire summit's cairn: Heights
  { id: 'c_seamspire_cairn', x: -262, z: -268, loot: { silver: [70, 120], items: [['sanity_draught', 1], ['honeycomb', 2]] } },
  // Widow's south crag, in the deserters' camp: High
  { id: 'c_widow_crag', x: 1338, z: -452, loot: { silver: [120, 200], items: [['mantra_spark', 1], ['iron_draught', 2]] } },
  // the basalt column's top on the ashfield: Heights
  { id: 'c_basalt_column', x: 700, z: -1062, loot: { silver: [80, 130], items: [['fireproof_salve', 2], ['ember_pepper', 2]] } },
  // the great shelf's crown in Frosthollow: High
  { id: 'c_frost_crown', x: -1196, z: 1536, loot: { silver: [130, 200], items: [['frost_salve', 2], ['mantra_spark', 1], ['ether_tonic', 1]] } },
  // the Anchor's plinth, at the statue's heel: Downs
  { id: 'c_anchor_plinth', x: -6, z: 735, y: 5.62, loot: { silver: [40, 80], items: [['iron_draught', 1], ['bread', 2]] } },
  // the Redwake's lookout on the sea stack off the Westwold: Heights
  { id: 'c_westwold_stack', x: 1847, z: 33, y: 16, loot: { silver: [80, 130], items: [['iron_draught', 1], ['smithing_stone', 1], ['bread', 2]] } },
  // the Root Gallery on the Verdance's northern range: High
  { id: 'c_root_gallery', x: -44, z: 1610, loot: { silver: [140, 220], items: [['mantra_spark', 1], ['hunters_feast', 1], ['elixir', 1]] } },
];

export const TIER_SPAWNERS = [
  { type: 'rimefang', x: -126, z: 186, count: 2, radius: 6, respawn: 300 },
  { type: 'gloomowl', x: -112, z: 214, count: 1, radius: 4, respawn: 300 },
  { type: 'gloomowl', x: -270, z: -280, count: 1, radius: 5, respawn: 300 },
  { type: 'crag_deserter', x: 1342, z: -444, count: 2, radius: 5, respawn: 300 },
  { type: 'crag_deserter_arbalist', x: 1346, z: -434, count: 1, radius: 3, respawn: 300 },
  { type: 'frost_stalker', x: -1205, z: 1540, count: 2, radius: 6, respawn: 300 },
  { type: 'thunderwing', x: -1215, z: 1525, count: 1, radius: 5, respawn: 300 },
  // a High tier holds harder foes than the floor below (`level`: agent/systems' spawner level)
  { type: 'mossbound', x: -36, z: 1610, count: 2, radius: 5, respawn: 300, level: 16 },
  { type: 'mossbound_shaman', x: -52, z: 1611, count: 1, radius: 3, respawn: 300, level: 16 },
  // the Redwake's lookout on its sea stack: posted on its top (`y`), a harpooner and two skirmishers
  { type: 'redwake_harpooner', x: 1845, z: 28, y: 16, count: 1, radius: 2, respawn: 300, level: 7 },
  { type: 'redwake_skirmisher', x: 1843, z: 32, y: 16, count: 2, radius: 2, respawn: 300, level: 7 },
];

// Marks seen from below: `kind` lamp (the first lamp's ruined tower and its cold fire basket),
// cairn (a stone heap and its pole), camp (a torn banner on a pole and a fire with smoke).
export const TIER_MARKS = [
  { id: 'mark_lamp', kind: 'lamp', x: -101, z: 178, name: 'The First Lamp' },
  { id: 'mark_seamspire', kind: 'cairn', x: -258, z: -262, name: 'The Seamspire Cairn' },
  { id: 'mark_widow', kind: 'camp', x: 1342, z: -466, name: "The Deserters' Camp", banner: '#5a2622' },
  { id: 'mark_frost_crown', kind: 'cairn', x: -1160, z: 1532, name: "The Hunters' Cairn" },
  { id: 'mark_root_gallery', kind: 'camp', x: -26, z: 1608, name: "The Mossbound's Lookout", banner: '#5c7a3a' },
];

export const TIER_LOCATIONS = [
  { name: "The Lampwright's Crown", x: -120, z: 195, r: 24 },
  { name: 'The Seamspire Summit', x: -264, z: -272, r: 22 },
  { name: "Widow's Teeth", x: 1342, z: -446, r: 22 },
  { name: 'The Basalt Stair', x: 698, z: -1062, r: 10 },
  { name: 'The Frost Crown', x: -1210, z: 1540, r: 30 },
  { name: 'The Root Gallery', x: -44, z: 1610, r: 20 },
  { name: 'The Redwake Lookout', x: 1845, z: 30, r: 14 },
];

// Sea stacks (world/ledges.js buildSeaStack): jointed columns of the coast's stone in the sea, a
// landing stone at the landward foot (`yaw` turns the landward side to local +z), a lookout on
// the flat top.
export const SEA_STACKS = [
  // off the Westwold's sheer coast, where the Redwake watch the sea lane past Thornwood
  { id: 'westwold_stack', name: 'The Redwake Lookout', x: 1845, z: 30, top: 16, yaw: -1.5708 },
];
