// Saltreach, the Lantern City: the layered harbor town around the Great Tree.
// Wards: the Lantern Ward (old town inside the walls, around the Great Tree plaza), the
// Keepers' Terrace (the broad upper residential ward and Lantern Citadel), Sage's Rise
// (Ilvar's observatory on the shared upper street), the Harbor Ward outside
// the sea gate, and the East Bank fishing houses on Lamp Bay.
// Coordinates: +z is north, +x is west. Terrace heights come from Saltreach's flats in world.js.

// Whole wards occupy shelves, with roads cutting long approaches through the risers.
export const KEEPERS_TERRACE = {
  x: 0, z: 80, rx: 82, rz: 48, core: 0.94, h: 19, cliffWidth: 0.65,
  front: [[-94, 32], [-76, 30], [-64, 34], [-52, 32], [-47, 28], [-39, 28],
    [-34, 32], [-22, 38], [-12, 36], [0, 30], [9, 33], [18, 36],
    [28, 29], [36, 27], [44, 30], [51, 34], [62, 32], [76, 36], [94, 30]],
};
// Occupied promontories above the shared upper street. Each has a flat crown,
// an irregular outline and a public stair; these are pieces of the town's terrain.
export const SALTREACH_SHELVES = [
  // The Keepers' Shelf: the Lantern Palace's podium, a square of rock eight metres over
  // the terrace, its face to the North Way and its back on the eastern cliff.
  { name: "Keepers' Shelf", x: -46, z: 72, rx: 30, rz: 31, h: 27,
    outline: [[-75.5, 41], [-18, 41], [-18, 103], [-75.5, 103]] },
  { name: "Sage's Rock", x: 45, z: 48, rx: 24, rz: 21, h: 26,
    outline: [[26, 35], [36, 30], [48, 33], [53, 38], [65, 37],
      [67, 50], [60, 60], [48, 65], [35, 62], [24, 53], [24, 43]] },
];
export const SALTREACH_TERRACES = [
  { x: 0, z: 35, rx: 94, rz: 47, core: 0.92, h: 10.5, cliffWidth: 0.55,
    front: [[-110, -12], [-80, -10], [-65, -14], [-54, -13], [-42, -10], [-32, -8],
      [-24, -12], [-14, -8], [-5, -11], [5, -15], [17, -11], [26, -9],
      [34, -15], [46, -13], [57, -15], [68, -10], [85, -12], [110, -8]] },
  KEEPERS_TERRACE,
  ...SALTREACH_SHELVES,
];
export const SALTREACH_RAMPS = [
  { x: -5, z: -32, x2: -5, z2: -6, y: 4.5, y2: 10.5, w: 13, shoulder: 0.8 },
  { x: 18, z: 24, x2: 18, z2: 52, y: 10.5, y2: 19, w: 10, shoulder: 0.8 },
  { x: 28, z: 64, x2: 28, z2: 43, y: 19, y2: 26, w: 5, shoulder: 0.8 },
];

export const SALTREACH_STRUCTURES = [
  // ---- the Lantern Palace on the Keepers' Shelf (world/palaces.js) is a landmark in
  // data/architecture.js; the North Way runs past its stair to the North Gate.
  // ---- the Great Tree plaza
  { type: 'great_tree', name: 'The Lantern Tree', x: 0, z: 5, r: 6.5, h: 29, crown: 1.3 },
  { type: 'pavilion', name: 'Altar Pavilion', x: 0, z: 52, w: 6.4, plinth: false },
  { type: 'pavilion', x: -26, z: -2, w: 5 },
  { type: 'lantern_line', x: -14, z: -28, x2: 4, z2: -28, h: 6 },
  { type: 'lantern_line', x: -7, z: -50, x2: 7, z2: -52, h: 6.2 },
  { type: 'lantern_line', x: -20, z: -8, x2: -20, z2: 8, h: 5.5 },
  { type: 'lantern_line', x: 19, z: -1, x2: 19, z2: 9, h: 5.5 },
  { type: 'lantern_line', x: -15, z: 22, x2: -5, z2: 30, h: 5.8 },
  { type: 'town_tree', x: 20, z: -24, h: 7 },
  { type: 'town_tree', x: -18, z: -24, h: 6.5 },
  { type: 'town_tree', x: 36, z: 4, h: 7.5 },
  { type: 'town_tree', x: -40, z: 8, h: 7 },
  { type: 'town_tree', x: -14, z: -60, h: 6 },
  { type: 'town_tree', x: 14, z: -61, h: 6.5 },
  { type: 'town_tree', x: 58, z: 49, h: 6, blossom: true },

  // A civic room under the tree: open approaches, planted seating at the edges.
  { type: 'civic_court', name: 'Lantern Court', x: 0, z: 5, r: 12.5 },
  { type: 'civic_seat', x: 11, z: 5, rot: -Math.PI / 2 },
  { type: 'civic_seat', x: -13, z: 7, rot: Math.PI / 2 },
  { type: 'civic_seat', x: 2, z: 18, rot: Math.PI, planter: false },
  { type: 'civic_seat', x: 46, z: 59, rot: Math.PI - 0.12 },
  // Sail standards make ward entrances visible above the slate roofline.
  ...[[-12, -57, 0.15], [12, -61, Math.PI + 0.15], [-17, 17, -0.12],
    [11, 20, Math.PI + 0.12], [-9, 62, 0.1], [25, 55, Math.PI - 0.1]]
    .map(([x, z, rot]) => ({ type: 'civic_standard', x, z, rot, h: 13, w: 3.6, color: '#dfd1aa' })),
  { type: 'civic_bunting', x: -10, z: -55, x2: 12, z2: -55, h: 8 },
  { type: 'civic_bunting', x: -18, z: 17, x2: 17, z2: 19, h: 8.5 },
  // Short balustrades follow the cliff lips, with broad breaks for shared stairs.
  ...[[-48, -7, -31, -5], [7, -8, 19, -6], [32, -10, 46, -8],
    [-62, 37, -48, 36], [-33, 36, -24, 41], [31, 37, 37, 34], [55, 41, 62, 40]]
    .map(([x, z, x2, z2]) => ({ type: 'civic_rail', x, z, x2, z2 })),
  // Small upper street fronts and a home overlooking the inn's side court.
  { type: 'house', name: "Chandler's House", x: 28, z: 76, rot: -Math.PI / 2 - 0.18, w: 9, d: 8 },
  { type: 'house', name: "Sailmaker's House", x: 46, z: 69, rot: Math.PI + 0.16, w: 9, d: 8, low: true },
  { type: 'house', x: -58, z: 24, rot: Math.PI / 2 - 0.14, w: 8, d: 7, low: true },

  // Broad flights connect the market, civic ward and upper residential terraces.
  ...SALTREACH_RAMPS.map(r => ({ type: 'stair', ...r })),
  { type: 'lantern_line', x: -4, z: 64, x2: 20, z2: 64, h: 5, posts: true },

  // ---- more houses in the old town (asymmetric annexes come from the building kit)
  { type: 'house', x: 40, z: -52, rot: -Math.PI / 2 + 0.06, w: 9, d: 8 },
  { type: 'house', x: -42, z: -52, rot: Math.PI / 2 - 0.05, w: 9, d: 8, low: true },
  { type: 'house', x: 12, z: -35, rot: 0.04, w: 8, d: 8 },
  { type: 'house', x: -40, z: 110, rot: Math.PI, w: 8, d: 8 },
  { type: 'house', x: -26, z: 110, rot: Math.PI - 0.1, w: 9, d: 8 },
  { type: 'house', x: 60, z: -20, rot: -Math.PI / 2 - 0.05, w: 8, d: 7, low: true },
  // The north-side residence is incorporated into the citadel's west range.

  // ---- Harbor Ward, outside the sea gate
  { type: 'warehouse', name: 'Salt Store', x: 24, z: -96, rot: -Math.PI / 2, w: 14, d: 9 },
  { type: 'warehouse', name: 'Net Loft', x: 27, z: -116, rot: -Math.PI / 2 + 0.05, w: 12, d: 8 },
  { type: 'pavilion', name: 'Fish Market', x: -18, z: -100, w: 6 },
  { type: 'house', name: "Harbor Master's House", x: -25, z: -84, rot: Math.PI / 2, w: 9, d: 8 },
  { type: 'crane', x: 3.6, z: -152, y: 1.5, rot: Math.PI / 2 },
  { type: 'lantern_line', x: -8, z: -104, x2: 8, z2: -104, h: 5.5 },
  { type: 'watchtower_t', name: 'Harbor Watch', x: -24, z: -132, h: 16 },
  // the Enclave envoy's warship at its own pier
  { type: 'pier', x: 34, z: -124, rot: 0.12, len: 40 },
  { type: 'galleon', name: "Warden's Due", x: 48, z: -184, rot: 0.15, len: 32 },

  // ---- East Bank on Lamp Bay
  { type: 'house', x: -100, z: 30, rot: Math.PI / 2 + 0.2, w: 8, d: 7, low: true },
  { type: 'house', x: -112, z: 12, rot: Math.PI / 2 - 0.15, w: 8, d: 8 },
  { type: 'house', x: -96, z: -8, rot: Math.PI / 2 + 0.1, w: 7, d: 7, low: true },
  { type: 'pier', x: -146, z: 40, rot: -Math.PI / 2, len: 18 },
  { type: 'town_tree', x: -108, z: 26, h: 6 },
];

// Paved squares (terrain flagstones)
export const SALTREACH_PAVED = [
  { x: 0, z: 4, r: 26 },
  { x: 0, z: 66, r: 40 },
  { x: 40, z: 48, r: 13 },
  { x: 0, z: -110, r: 20, color: '#9d9a8d' },
  { x: 0, z: -50, r: 12 },
];

// The Saltreach Watch: gate posts and patrols (team 'guard', see data/guards.js).
// face: the yaw a posted guard watches (0 = north, PI = south, PI/2 = west, -PI/2 = east).
export const SALTREACH_SPAWNERS = [
  { type: 'watch_guard', x: -7, z: -66, count: 1, radius: 0, respawn: 150, face: Math.PI },
  { type: 'watch_pikeman', x: 7, z: -66, count: 1, radius: 0, respawn: 150, face: Math.PI },
  { type: 'watch_guard', x: -72, z: 12, count: 1, radius: 0, respawn: 150, face: -Math.PI / 2 },
  { type: 'watch_guard', x: 72, z: 12, count: 1, radius: 0, respawn: 150, face: Math.PI / 2 },
  { type: 'watch_pikeman', x: 5, z: 113.5, count: 1, radius: 0, respawn: 150, face: 0 },
  { type: 'watch_guard', x: -5, z: 113.5, count: 1, radius: 0, respawn: 150, face: 0 },
  // the Lantern Palace's own wardens: the gate, the hall and the Keepers' Chair
  { type: 'watch_guard', x: -24.5, z: 68.6, count: 1, radius: 0, respawn: 150, face: Math.PI / 2 },
  { type: 'watch_pikeman', x: -24.5, z: 75.4, count: 1, radius: 0, respawn: 150, face: Math.PI / 2 },
  { type: 'watch_guard', x: -48, z: 66.2, count: 1, radius: 0, respawn: 150, face: Math.PI / 2 },
  { type: 'watch_guard', x: -48, z: 77.8, count: 1, radius: 0, respawn: 150, face: Math.PI / 2 },
  { type: 'watch_pikeman', x: -60, z: 66.5, count: 1, radius: 0, respawn: 150, face: Math.PI / 2 },
  { type: 'watch_guard', x: -33, z: 72, count: 1, radius: 2, respawn: 150, patrol: [[-33, 62], [-33, 82], [-36, 82], [-36, 62]] },
  { type: 'watch_guard', x: -12, z: -12, count: 2, radius: 3, respawn: 150, patrol: [[-12, -12], [13, -13], [15, 15], [-15, 17]] },
  { type: 'watch_guard', x: -4, z: 56, count: 1, radius: 1, respawn: 150, patrol: [[-6, 55], [22, 55], [24, 48], [-4, 48]] },
  { type: 'watch_pikeman', x: 0, z: -95, count: 1, radius: 2, respawn: 150, patrol: [[0, -88], [-2, -122], [18, -104], [-18, -100]] },
  { type: 'watch_pikeman', x: -36, z: -44, count: 1, radius: 0, respawn: 150, face: 0 },
];

// Storyline arrivals in the Lantern City.
export const SALTREACH_NPCS = [
  {
    id: 'north_ferry', name: 'Tamsin', title: 'North Watch Ferrywoman', x: 0.6, z: 537,
    look: { skin: '#c8a07a', hair: '#7a5a3a', outfit: { main: '#3a5060', trim: '#d8c89a', pants: '#2e3238', boots: '#1e1e22' } },
  },
  {
    id: 'envoy_crane', name: 'Captain Thessaly Crane', title: 'Envoy of the Enclave', x: 38, z: -128,
    look: { skin: '#e0c0a0', hair: '#1a1410', outfit: { main: '#22222a', trim: '#b8902e', pants: '#18181e', boots: '#101014' }, cape: '#8e1f24' },
    when: (ch) => !(ch.flags && ch.flags.harbor_freed),
  },
  {
    id: 'grey_clerk', name: 'The Grey Clerk', title: 'Ministry of Soundings', x: -8, z: 15,
    look: { skin: '#c8b8a8', hair: '#5a5a60', outfit: { main: '#5a5a66', trim: '#a8acc0', pants: '#3a3a44', boots: '#202026' }, hood: true },
    when: (ch) => ch.quests && (ch.quests.red_tooth?.state === 'done' || !!ch.quests.grey_letter),
  },
];
// The Enclave's harbor occupation during "Iron on the Water".
const occupied = (ch) => !!(ch.flags && ch.flags.harbor_occupied && !ch.flags.harbor_freed);
SALTREACH_SPAWNERS.push(
  { type: 'peacekeeper', x: 0, z: -108, count: 2, radius: 6, respawn: 60, when: occupied, patrol: [[0, -100], [-14, -118], [14, -118]] },
  { type: 'peacekeeper', x: 20, z: -120, count: 2, radius: 4, respawn: 60, when: occupied },
  { type: 'peacekeeper_halberdier', x: -6, z: -80, count: 1, radius: 0, respawn: 60, when: occupied, face: 0 },
  { type: 'peacekeeper_halberdier', x: 6, z: -80, count: 1, radius: 0, respawn: 60, when: occupied, face: 0 },
  { type: 'peacekeeper_arbalist', x: -22, z: -128, count: 2, radius: 3, respawn: 60, when: occupied },
);
// the Watch stands down from the sea gate while the Peacekeepers hold it
for (const s of SALTREACH_SPAWNERS) if (!s.when && s.z < -60) s.when = (ch) => !occupied(ch);

// Wards of the Lantern City (smallest radius wins for the area banner).
export const SALTREACH_LOCATIONS = [
  { name: 'The Lantern Tree', x: 0, z: 5, r: 24 },
  { name: "Keepers' Terrace", x: 8, z: 64, r: 38 },
  { name: 'The Lantern Palace', x: -46, z: 72, r: 33 },
  { name: 'The North Way', x: 4, z: 104, r: 22 },
  { name: "Sage's Rise", x: 40, z: 48, r: 15 },
  { name: 'Harbor Ward', x: 4, z: -104, r: 34 },
  { name: 'East Bank', x: -106, z: 14, r: 26 },
];

// ---- the rest of Saltreach Isle: hamlets and outposts along the North Road and the coast
SALTREACH_STRUCTURES.push(
  // Millbrook: the farm hamlet that grows the Lantern City's grain
  { type: 'house', name: 'Millbrook Farmhouse', x: -46, z: 230, rot: Math.PI / 2, w: 9, d: 8, low: true },
  { type: 'house', x: -47, z: 249, rot: Math.PI / 2 + 0.1, w: 8, d: 7, low: true },
  { type: 'house', x: -12, z: 226, rot: -Math.PI / 2, w: 9, d: 8 },
  { type: 'house', x: -13, z: 247, rot: -Math.PI / 2 - 0.08, w: 8, d: 8, low: true },
  { type: 'campfire', id: 'cf_millbrook', x: -30, z: 258, name: 'Millbrook' },
  { type: 'well', id: 'well_millbrook', x: -38, z: 240 },
  { type: 'lantern_line', x: -39, z: 238, x2: -19, z2: 238, h: 5 },
  { type: 'crates', x: -20, z: 258 },
  { type: 'town_tree', x: -44, z: 266, h: 7 },
  // North Watch: the Watch's post over the strait to Frosthollow and the Anchor's Fall, and the
  // quay where the North Road ends: the ferry crosses to the Hush and out to the Fall
  { type: 'watchtower_t', name: 'North Watch', x: 7, z: 513, h: 18 },
  { type: 'dock', id: 'dock_north', x: -4, z: 540, len: 40, yaw: 0 },
  { type: 'campfire', id: 'cf_north_watch', x: -6, z: 505, name: 'North Watch' },
  // Kestrel Beacon: a Compact relay tower on the highlands gone to the owls, kept again by the
  // Watch as a post over the Kestrel Climb: a walled yard, a keeper's lodge and a signal fire
  { type: 'lighthouse', name: 'Kestrel Beacon', x: -212, z: 433, rot: 2.16 },
  { type: 'beacon_post', name: 'Kestrel Beacon', x: -212, z: 433, rot: 2.16, yard: 13, lodge: [-7.0, -4.5, Math.PI / 2], fire: [6, -6] },
  { type: 'ruins', x: -198, z: 444 },
  // Hollowbrook: woodcutters who fell Greywood for the city's beams
  { type: 'house', name: "Woodcutters' Hall", x: 224, z: 350, rot: Math.PI, w: 10, d: 8 },
  { type: 'house', x: 246, z: 368, rot: -Math.PI / 2, w: 8, d: 7, low: true },
  { type: 'campfire', id: 'cf_hollowbrook', x: 232, z: 372, name: 'Hollowbrook' },
  { type: 'crates', x: 240, z: 352 },
  // Smugglers' Cove: a Redwake landing hidden in the west-coast inlet
  { type: 'pier', x: 420, z: 168, rot: Math.PI / 2 + 0.2, len: 20 },
  { type: 'tent', x: 404, z: 170, rot: 0.6 },
  { type: 'tent', x: 410, z: 156, rot: -0.4 },
  { type: 'campfire', id: 'cf_cove', x: 400, z: 162, name: null, hostile: true },
  { type: 'crates', x: 412, z: 176 },
  { type: 'banner', x: 398, z: 176 },
);
SALTREACH_SPAWNERS.push(
  { type: 'watch_pikeman', x: 2, z: 518, count: 1, radius: 0, respawn: 150, face: 0 },
  { type: 'gloomowl', x: -205, z: 440, count: 1, radius: 14, respawn: 160 },
  { type: 'brigand', x: 268, z: 398, count: 2, radius: 12, respawn: 120 },
  { type: 'brigand', x: 404, z: 166, count: 3, radius: 10, respawn: 120 },
  { type: 'brigand_cutthroat', x: 396, z: 150, count: 1, radius: 6, respawn: 150 },
  { type: 'rimefang', x: -170, z: 470, count: 2, radius: 14, respawn: 150 },
);
SALTREACH_LOCATIONS.push(
  { name: 'Millbrook', x: -30, z: 240, r: 34 },
  { name: 'North Watch', x: 0, z: 510, r: 26 },
  { name: 'North Watch Quay', x: -4, z: 538, r: 14 },
  { name: 'Kestrel Beacon', x: -208, z: 434, r: 28 },
  { name: 'Hollowbrook', x: 232, z: 360, r: 30 },
  { name: "Smugglers' Cove", x: 410, z: 164, r: 30 },
  { name: 'The Breadfields', x: -20, z: 235, r: 110 },
  { name: 'Kestrel Heights', x: -205, z: 385, r: 140 },
  { name: 'Greywood', x: 245, z: 405, r: 130 },
);
export const SALTREACH_CHESTS = [
  { id: 'c_kestrel', x: -207, z: 427, loot: { silver: [60, 110], items: [['owl_feather', 2], ['elixir', 1]] } },
  { id: 'c_cove', x: 414, z: 150, loot: { silver: [90, 150], items: [['mantra_spark', 1], ['bounty_token', 3]] } },
  { id: 'c_hollowbrook', x: 252, z: 356, loot: { silver: [30, 60], items: [['honeycomb', 2], ['bread', 2]] } },
];

// Linear fixtures carry their orientation explicitly through the placement system.
for (const s of SALTREACH_STRUCTURES) if (['civic_rail', 'civic_bunting'].includes(s.type)) {
  s.rot = Math.atan2(s.x2 - s.x, s.z2 - s.z);
}
