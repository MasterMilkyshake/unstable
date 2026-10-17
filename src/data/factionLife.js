// Factions that move (docs/agent/WORLD_LIFE_PLAN.md, task 8): the routes their columns and
// convoys march, the places they stop travellers, sound the deeps and skirmish, and who comes
// after a wanted name. game/worldLife.js runs them. Roads are named by their data/roads.js id
// (placed points); everything else is in final world metres (+x west).

// A route is a chain of roads, each walked forward (1) or back (-1).
export const COLUMN_ROUTES = [
  // Fort Meridian's Lower Works to its posts
  { id: 'fort_rooks', name: "the Garrison Road to Rook's Landing", roads: [['garrison_road', 1]], region: 'thornwood' },
  { id: 'fort_docks', name: 'the Dock Road to the harbour', roads: [['meridian_dock_road', 1]], region: 'meridian' },
  { id: 'fort_signal', name: "the Signal Keepers' Trail", roads: [['meridian_heights_path', 1]], region: 'meridian' },
  { id: 'fort_cinder', name: 'the Ember Road to Cinderstead', roads: [['ember_road', 1]], region: 'ashen_spire' },
  // after the Writ, the Enclave's pier at Saltreach to the roads inland
  { id: 'salt_north', name: 'the North Road', roads: [['north_road', 1]], region: 'saltreach', story: 'writ' },
  { id: 'salt_reed', name: 'the Reed Road', roads: [['reed_road', 1]], region: 'saltreach', story: 'writ' },
];

// Who marches: the usual column, and the wartime one.
export const COLUMN_RANKS = {
  peace: ['peacekeeper_halberdier', 'peacekeeper', 'peacekeeper', 'peacekeeper_arbalist'],
  war: ['enclave_captain', 'peacekeeper_halberdier', 'peacekeeper', 'peacekeeper', 'peacekeeper', 'peacekeeper_arbalist'],
};

// Checkpoints on the roads: where they stand (`at`, on the road), the way the road runs there
// (`yaw`, travel direction), whose they are, and who they stop.
export const CHECKPOINTS = [
  { id: 'cp_garrison', name: 'the Garrison Road checkpoint', faction: 'enclave', road: 'garrison_road', at: [1338, -460] },
  { id: 'cp_dock', name: 'the Dock Road checkpoint', faction: 'enclave', road: 'meridian_dock_road', at: [1012, -540] },
  { id: 'cp_ember', name: 'the Ember Road checkpoint', faction: 'enclave', road: 'ember_road', at: [924, -852] },
  { id: 'cp_salt_north', name: 'the North Road checkpoint', faction: 'enclave', road: 'north_road', at: [-24, 205], story: 'writ' },
  { id: 'cp_watch_reed', name: 'the Reed Road watch post', faction: 'watch', road: 'reed_road', at: [-195, 0] },
  { id: 'cp_watch_north', name: 'the North Road watch post', faction: 'watch', road: 'north_road', at: [-30, 238] },
];
export const CHECKPOINT_GUARDS = { enclave: ['peacekeeper', 'peacekeeper_halberdier'], watch: ['watch_guard', 'watch_pikeman'] };

// Supply convoys by road: whose, the route, and who waits to rob it on the way.
export const CONVOY_ROUTES = [
  { id: 'cv_north_watch', name: 'provisions for the North Watch', faction: 'watch', roads: [['north_road', 1]], raiders: ['brigand', 'brigand_cutthroat', 'brigand'] },
  { id: 'cv_reedbank', name: 'stores for Reedbank', faction: 'watch', roads: [['reed_road', 1]], raiders: ['fen_witch', 'brigand_cutthroat'] },
  { id: 'cv_fort_docks', name: "the harbour's cargo for the fort", faction: 'enclave', roads: [['meridian_dock_road', -1]], raiders: ['brigand_brute', 'brigand_cutthroat', 'brigand'] },
  { id: 'cv_fort_rooks', name: "the garrison's stores for Rook's Landing", faction: 'enclave', roads: [['garrison_road', 1]], raiders: ['brigand_brute', 'brigand_cutthroat', 'brigand'] },
];
export const CONVOY_ESCORTS = { watch: ['watch_guard', 'watch_pikeman'], enclave: ['peacekeeper', 'peacekeeper', 'peacekeeper_arbalist'] };
export const CONVOY_LOOT = {
  watch: [['bread', 3], ['stew', 1], ['waterskin', 1], ['iron_draught', 1]],
  enclave: [['iron_draught', 2], ['writ_scrap', 2], ['smithing_stone', 1]],
};

// The Ministry's sounding parties in the Hush: from the Sounding House to a sounding place.
export const SOUNDING_HOUSE = [-1260, 1126];
export const SOUNDING_SITES = [
  { id: 'stones', name: 'the Listening Stones', at: [-1385, 1165] },
  { id: 'chairs', name: 'the Chair Fields', at: [-1180, 1002] },
  { id: 'bell', name: 'the Drowned Bell', at: [-1530, 1040] },
];

// Where a faction meets the Redwake: the Watch outside Saltreach, and the Enclave on the Garrison
// Road between Widow Ridge and Rook's Landing. `side` names the faction (the Watch if none).
export const SKIRMISH_SITES = [
  { id: 'sk_downs', name: 'the Reed Downs', at: [-262, -12] },
  { id: 'sk_breadfields', name: 'the Breadfields', at: [-20, 262] },
  { id: 'sk_smugglers', name: "the smugglers' path", at: [236, 66] },
  { id: 'sk_garrison', name: 'the Garrison Road', at: [1270, -70], side: 'enclave' },
];
// Who fights for each side.
export const SKIRMISH_SIDES = { watch: ['watch_guard', 'watch_pikeman'], enclave: ['peacekeeper', 'peacekeeper_halberdier'] };

// Who comes after a name a faction has marked.
export const HUNTERS = {
  enclave: { name: 'Warrant-men of the Enclave', types: ['peacekeeper', 'peacekeeper_arbalist', 'peacekeeper'] },
  watch: { name: 'bounty-takers of the Watch', types: ['watch_guard', 'watch_pikeman'] },
  ministry: { name: 'the Ministry\'s silencers', types: ['ministry_silencer', 'ministry_silencer'] },
};

// Watch hands held at Redwake camps (game/worldLife.js 'captives'): cut them loose and bring them
// to a Watch post. `at` is the camp's stake, by its brigands (data/world.js spawners).
export const CAPTIVE_CAMPS = [
  { id: 'cap_greywood', name: 'the Greywood camp', at: [262, 404], count: 2 },
  { id: 'cap_cove', name: "the smugglers' cove", at: [398, 172], count: 2 },
];
// Where the Watch takes them in: its posts on the North and Reed Roads, and the barracks yard.
export const WATCH_POSTS = [[-30, 238], [-195, 0], [-29, -38]];

// Supply sloops on the sea roads (game/seaLife.js): whose, from which dock to which, its crew, and
// who waits on the far pier. `story: 'writ'` sails only after the Writ, until the war.
export const SEA_CONVOYS = [
  { id: 'sc_north', name: 'the Watch sloop for the North Landing', faction: 'watch', from: 'dock_salt', to: 'dock_north', crew: ['watch_guard', 'watch_pikeman'], raiders: ['brigand', 'brigand_cutthroat'] },
  { id: 'sc_rooks', name: "the Enclave's cargo for Rook's Landing", faction: 'enclave', from: 'dock_meridian', to: 'dock_thorn', crew: ['peacekeeper', 'peacekeeper_arbalist'], raiders: ['brigand', 'brigand_brute', 'brigand_cutthroat'] },
  { id: 'sc_writ', name: "the Enclave's sloop for Saltreach", faction: 'enclave', from: 'dock_meridian', to: 'dock_salt', crew: ['peacekeeper', 'peacekeeper'], raiders: ['brigand', 'brigand_cutthroat'], story: 'writ' },
];
// A sloop that is not what it flies: Redwake raiders under the Watch's pennant.
export const FALSE_CONVOY = { name: 'a Watch supply sloop', crew: ['brigand', 'brigand_cutthroat', 'brigand'], loot: [['bread', 2], ['iron_draught', 1], ['smithing_stone', 1]] };
// A fishing boat beset by sharks, and a drift of wreckage that leads to a hull worth salvaging.
export const SEA_TROUBLE = {
  beset: { sharks: 3, silver: [30, 60], rep: [['watch', 2]] },
  drift: { pieces: 7, spacing: 26, loot: [['rift_shard', 1], ['iron_draught', 1], ['smithing_stone', 1]], silver: [40, 90] },
};

// Event cadence (seconds of play between tries, and how near the player must be).
export const LIFE_TIMING = {
  column: { every: [360, 600], near: 320 },
  checkpoint: { near: 120 },
  convoy: { every: [480, 720], near: 260 },
  sounding: { every: [420, 540], near: 260 },
  skirmish: { every: [300, 420], near: 220 },
  hunters: { every: [240, 360], after: 180 },
  cutter: { every: [900, 1500] }, // only while the Enclave wants you; at most one per crossing
  seaConvoy: { every: [600, 900], near: 420 },
  falseConvoy: { every: [2400, 3600], near: 360, chance: 0.35 }, // a rare Redwake ambush at sea; at most one per crossing
  beset: { every: [700, 1100] },
  drift: { every: [600, 1000] },
  captives: { every: [400, 700], near: 220, day: 900 },
};
