import { placeCatalog, placePath } from './worldPlacement.js';
// Fortified coastal settlements: pale masonry, dark timber and broad slate eaves.
// Keep encounter centers open; walls and ruins frame the routes through them.
export const ARCHITECTURE = [
  { id: 'wash_shelter', kind: 'shelter', region: 'the_wash', x: -16, z: -314, rot: 0.12, palette: 'harbor', name: 'Salvagers’ Shelter' },
  { id: 'harbor_gate', kind: 'gate', region: 'saltreach', x: 0, z: -72, palette: 'harbor', name: 'Saltreach Sea Gate' },
  { id: 'compact_hall', kind: 'lantern_palace', region: 'saltreach', x: -46, z: 72, rot: Math.PI / 2, shelf: 27, terrace: 19, palette: 'harbor', name: 'The Lantern Palace' },
  { id: 'meridian_keep', kind: 'enclave_palace', region: 'meridian', x: 791, z: -615, rot: 0, rock: 46, palette: 'enclave', name: 'The Chain Citadel' },
  { id: 'watch_yard', kind: 'yard', region: 'saltreach', x: -25, z: -37, palette: 'harbor', name: 'Watch Muster Yard' },
  // Brigand Hold (world/seats.js): the Redwake's stockade round the Retained Shiphouse, its
  // Red Gate where the Red Trail arrives and a postern behind Kaelen's back court
  { id: 'redwake_hall', kind: 'brigand_hold', region: 'thornwood', x: 960, z: 250, palette: 'redwake', name: 'Brigand Hold',
    wall: [[-48, -16], [-36, -38], [-12, -50], [18, -48], [40, -36], [68, -14], [76, 18], [66, 50], [38, 64], [6, 56], [-22, 40], [-42, 18]],
    gate: [11, 12], postern: [6, 3], stage: [6, 49, 0], hall: [2, -22, -Math.PI / 2],
    tents: [[-20, 12, 0.3], [-8, 26, -0.4], [12, 42, 2.6]] },
  { id: 'compact_viaduct', kind: 'arcade', region: 'thornwood', x: 830, z: 103, palette: 'ruin', name: 'Compact Service Arcade' },
  // the Reed Covenant's outlet and the Sunken Shrine on their knoll (world/seats.js)
  { id: 'reed_outlet', kind: 'reed_outlet', region: 'shimmerfen', x: -670, z: -378, palette: 'reed', name: 'Reed Covenant Outlet' },
  { id: 'hunter_lodge', kind: 'shelter', region: 'frosthollow', x: -597, z: 783, palette: 'frost', name: 'Northern Relief Shelter' },
  // the frost gate across the White Pass road and its guard post uphill of it (world/outposts.js)
  { id: 'white_pass_gate', kind: 'pass', region: 'frosthollow', x: -683, z: 882, rot: -0.53, palette: 'frost', name: 'White Pass Watch', post: [-7.5, 7.5, Math.PI / 2] },
  { id: 'north_regulator', kind: 'regulator', region: 'frosthollow', x: -740, z: 970, palette: 'frost', name: 'Northern Regulator' },
  { id: 'east_furnace', kind: 'furnace', region: 'ashen_spire', x: 760, z: 880, palette: 'cinder', name: 'Southern Overflow Works' },
  { id: 'attendant_shelter', kind: 'shelter', region: 'ashen_spire', x: 660, z: 781, palette: 'cinder', name: 'Attendants’ Rest' },
  { id: 'root_archive', kind: 'roots', region: 'verdance', x: 95, z: 990, palette: 'root', name: 'The Names Carried' },
  { id: 'drowned_keep', kind: 'keep', region: 'rift', x: 5950, z: 6075, palette: 'drowned', name: 'The Drowned Keep' },
  { id: 'command_nave', kind: 'nave', region: 'rift', x: 6000, z: 6150, palette: 'drowned', name: 'The Broken Command' },
];

// Surviving paved routes. They follow terrain and clear vegetation locally.
export const CIVIC_ROADS = [
  { points: [[-3, -314], [-28, -294], [-50, -270], [-65, -235], [-62, -201], [-56, -176], [-45, -151], [-31, -122], [-6, -99]], width: 3.8 },
  { points: [[0, -128], [-3, -114], [-6, -99], [-3, -85], [0, -72], [3, -56], [1, -40], [-3, -24]], width: 6.2 },
  // up the market stair to the plaza, round the Lantern Tree's plinth and on to the civic stair
  { points: [[-3, -24], [-5, -12], [-4, -5], [5.8, -4.2], [9.4, 1.5], [9.4, 9], [6.4, 16], [8, 22], [15, 21.6], [18, 22.6], [18, 24], [18, 40], [18, 52], [8, 58], [1, 62], [0, 70]], width: 5.2 },
  { points: [[-32, -26], [-23, -23], [-14, -33.8], [-5, -35], [4, -34.4], [6, -25], [15, -25], [23, -32]], width: 3.6 },
  { points: [[-87.4, 8], [-79, 8], [-66, 14], [-58, 19], [-47, 19], [-42, 12], [-30, 10], [-23, 11], [-17, 12], [-6, 12], [9, 16], [23, 18]], width: 3.8 },
  { points: [[-23, 21], [-17, 24], [-8, 23], [3, 23.6], [8, 22]], width: 3.5 },
  // One upper arrival square branches to the residences, shrine and observatory.
  { points: [[18, 56], [8, 56], [6, 46], [-3, 44]], width: 3.5 },
  // the palace approach: under the shelf face to the feet of the double stair
  { points: [[8, 58], [-2, 57.6], [-8, 52], [-15.4, 50.3]], width: 4.2 },
  { points: [[6, 86], [-6, 90], [-10, 94], [-15.4, 93.8]], width: 4.2 },
  { points: [[18, 56], [19, 66], [28, 68], [28, 60], [28, 43], [34, 38], [50, 38]], width: 3.5 },
  { points: [[23, 18], [21, 9], [32, 9], [40, 12], [51, 12], [63, 12], [78, 8], [84.8, 8]], width: 4.2 },
  { points: [[95.4, 8], [99, 8]], width: 4.2 },
  // the North Way: the axis of the upper town, from the square to the North Gate
  { points: [[1, 62], [4, 72], [6, 86], [4, 100], [1, 110], [0, 116]], width: 5 },
  // up to the Vowkeeper's Perch: off the North Way to the foot of the Perch stair
  { points: [[2.6, 106], [9, 111], [16.4, 112]], width: 3.2 },
  { points: [[-3, -314], [-9, -314]], width: 2.8 },
  // Wash footpaths: up from the strand where the sea gives people back, and east over the
  // dunes to the abbey that rang for them.
  { points: [[-4, -345], [-6, -338], [-4, -331], [-2, -327]], width: 2.0 },
  { points: [[-10, -328], [-22, -333], [-36, -333], [-62, -330], [-88, -325], [-112, -320]], width: 2.0 },
];

export const SETTLEMENT_ROADS = [
  // Brigand Hold: in at the Red Gate, across the gate court to the Shiphouse's bow door
  { points: [[912, 251.5], [924, 249], [934, 240], [941.5, 228]], width: 3.4 },
  // the Hush: from the head of the lower flight over the shelf to the foot of the Ministry Stair
  { points: [[-880.5, 398], [-886, 396], [-889, 378], [-896, 364], [-903, 364], [-904.4, 368.8]], width: 3.2 },
  { points: [[758, 260], [767, 262], [769, 276], [781, 274]], width: 3 },
  { points: [[767, 262], [775, 257], [781, 257]], width: 3 },
  { points: [[-448, -262], [-455, -270], [-470.5, -271.5]], width: 2.8 },
  { points: [[-470, -266], [-472, -260], [-475, -257.5]], width: 2.8 },
  { points: [[-578, 778], [-584, 790], [-603, 797], [-605, 806]], width: 3.5 },
  { points: [[-603, 797], [-616, 803], [-617, 816], [-617, 824]], width: 3 },
  { points: [[642, 760], [652, 752.5], [668, 752], [684, 752], [688, 756.5]], width: 4.0 },
  { points: [[24, 888], [17, 900], [2, 900.2]], width: 3.2 },
  { points: [[17, 900], [12, 909], [24, 911.6]], width: 2.8 },
  { points: [[754, -534], [780, -534], [775, -549], [778, -561], [790, -576]], width: 4.5 },
  { points: [[775, -549], [792, -555], [802, -550]], width: 3.5 },
  { points: [[744, -556], [749, -542], [754, -534], [780, -534]], width: 4 },
  { points: [[699, -560], [711, -560], [718, -556]], width: 4.5 },
  // the Lower Works yard to the foot of the Iron Stair
  { points: [[696, -561], [697, -575], [709, -582], [716.4, -584]], width: 3.5 },
  // the parade ground to the Chain Gate of the Chain Citadel
  { points: [[790, -576], [791, -582.5]], width: 4 },
];

// The Saltreach ring. Curtain spans run between towers at every vertex and butt into the
// gatehouses and the Lantern Palace, whose outer range is the curtain along the eastern
// cliff. The wall walk stands WALL_RISE above the town-side ground and steps with it.
export const WALL_RISE = 9.5;
export const SALTREACH_GATES = [
  // the sea gate is the harbor_gate landmark (world/seaGate.js); these share its design
  { id: 'west_gate', name: 'Reed Gate', x: -82, z: 8, rot: Math.PI / 2, pw: 2.8, spring: 4.6, tx: 11 },
  { id: 'east_gate', name: 'Crucible Gate', x: 80, z: 8, rot: -Math.PI / 2, pw: 2.8, spring: 4.6, tx: 11 },
  { id: 'north_gate', name: 'North Gate', x: 0, z: 121, rot: Math.PI, pw: 3.0, spring: 5.0, tx: 11 },
];
export const SALTREACH_RING = {
  id: 'saltreach_ring', name: 'Saltreach curtain wall', palette: 'salt', tag: 'town_wall', rise: WALL_RISE,
  center: [0, 26], tower: { R: 4.6, roof: 'cone' },
  chains: [
    // the harbor wall either side of the sea gate (its towers stand at x = +-11); a tower
    // stands on every terrace front the curtain climbs, so no span ramps over a cliff
    { points: [[-11, -72], [-53, -66], [-73, -36], [-78.5, -11.5], [-82, -3]], start: 'abut', end: 'abut' },
    { points: [[11, -72], [53, -66], [74, -36], [77.5, -11.5], [80, -3]], start: 'abut', end: 'abut' },
    // north of the Reed Gate the curtain climbs the Keepers' Terrace to the palace's south tower
    { points: [[-82, 19], [-76.5, 31], [-72, 41.6]], start: 'abut', end: 'abut' },
    // behind the palace to the North Gate on the terrace lip
    { points: [[-72, 102.4], [-66, 116], [-46, 122.5], [-11, 121]], start: 'abut', end: 'abut' },
    // the north wall over the Vowkeeper's knoll and down the western cliff to the Crucible Gate
    { points: [[11, 121], [27, 121], [42, 121], [57, 118], [74, 92], [74, 62], [76, 36], [80, 19]], start: 'abut', end: 'abut',
      stairs: [{ span: 6, at: 4, dir: -1 }] },
  ],
};
export const TOWN_WALLS = SALTREACH_RING.chains.map(c => c.points);
// Where a gate opens onto a cliff, a built stair carries the road down (world/approaches.js).
export const APPROACHES = [
  // the North Stair: four flights down the Keepers' Terrace lip into the Breadfields
  { id: 'north_stair', name: 'The North Stair', kind: 'switchback', x: 0, z: 125, yaw: 0, y: 19, drop: 'auto',
    flights: 4, x0: 3, z0: 3.2, topW: 6, topD: 3.2, lane: 3.6, landing: 3.6 },
  // the side gates' stairs down the civic terrace's lip to the Reed Road and the Crucible
  { id: 'reed_gate_stair', name: 'Reed Gate Stair', kind: 'straight', x: -88.3, z: 8, yaw: -Math.PI / 2, y: 10.5, drop: 6, w: 5 },
  { id: 'crucible_gate_stair', name: 'Crucible Gate Stair', kind: 'straight', x: 85.7, z: 8, yaw: Math.PI / 2, y: 10.5, drop: 5.5, w: 5 },
];
// Meridian (authored in its region's coordinates and placed below). The bastion ring stands
// on the rock with a tower at every vertex; the Chain Citadel's rear range is its south
// curtain. The West Gate takes the lift and the Iron Stair, the Signal Gate the trail
// over the Signal Bridge; the Lower Works keep their own ring on their shelf.
export const MERIDIAN_GATES = [
  { id: 'meridian_west_gate', name: 'Meridian West Gate', x: 738, z: -556, rot: Math.PI / 2, pw: 2.6, spring: 4.6, tx: 10, tw: 6, td: 8.4 },
  { id: 'meridian_signal_gate', name: 'The Signal Gate', x: 843, z: -572, rot: -Math.PI / 2, pw: 2.6, spring: 4.6, tx: 10, tw: 6, td: 8.4 },
  { id: 'meridian_lower_gate', name: 'Lower Works Gate', x: 664, z: -561, rot: 2.07, pw: 2.4, spring: 4.4, tx: 8, tw: 5.4, td: 8 },
];
export const MERIDIAN_RING = {
  id: 'meridian_ring', name: 'Meridian curtain wall', palette: 'enclave', tag: 'town_wall', rise: WALL_RISE,
  center: [791, -585], tower: { R: 5.0, roof: 'flat' },
  chains: [
    { points: [[738, -546], [737, -520], [755, -503], [829, -503], [844, -530], [843, -562]], start: 'abut', end: 'abut' },
    // the ring's walk ends against the Chain Citadel's rear towers: the palace keeps its own walks
    { points: [[843, -582], [840, -604], [836, -626], [829.1, -639.9]], start: 'abut', end: 'abut' },
    { points: [[738, -566], [740, -589], [737, -611], [746, -633], [752.1, -640.4]], start: 'abut', end: 'abut' },
  ],
};
export const MERIDIAN_LOWER_RING = {
  id: 'meridian_lower_ring', name: 'Lower Works wall', palette: 'enclave', tag: 'town_wall', rise: WALL_RISE,
  center: [692, -574], tower: { R: 4.4, roof: 'flat' },
  chains: [
    { points: [[660.2, -568], [662, -608], [699, -607.5], [718.5, -597], [724, -584]], start: 'abut', end: 'abut' },
    { points: [[667.8, -554], [678, -545], [704, -543], [720.5, -549]], start: 'abut', end: 'abut' },
  ],
};
for (const ring of [MERIDIAN_RING, MERIDIAN_LOWER_RING]) {
  ring.center = placePath([ring.center])[0];
  for (const c of ring.chains) c.points = placePath(c.points);
}
placeCatalog(MERIDIAN_GATES);
export const MERIDIAN_WALLS = MERIDIAN_RING.chains.map(c => c.points);
export const MERIDIAN_LOWER_WALLS = MERIDIAN_LOWER_RING.chains.map(c => c.points);
export const MERIDIAN_LOWER_GATE = [MERIDIAN_GATES[2].x, MERIDIAN_GATES[2].z, MERIDIAN_GATES[2].rot];
// the Iron Stair: five flights up the gorge between the Lower Works and the bastion,
// landing on the lift's upper deck at the West Gate
export const MERIDIAN_APPROACHES = [
  { id: 'iron_stair', name: 'The Iron Stair', kind: 'switchback', x: 732.6, z: -570, yaw: -Math.PI / 2, y: 46, drop: 30,
    flights: 5, dir0: -1, x0: 0, z0: 0, topW: 9, topD: 0.4, lane: 3.6, landing: 3.6, palette: 'enclave', topEdges: ['far'] },
];
placeCatalog(MERIDIAN_APPROACHES);

// Inner wards follow the land, bowing around houses and opening at the shared
// approaches. Meridian's inner curtain ties directly into its command keep.
export const INNER_WARDS = [
  { id: 'keepers_ward', name: "Keepers' Ward", palette: 'salt', height: 4.5,
    walls: [
      [[-76, 31], [-65, 32], [-51, 29], [-40, 31], [-30, 34], [-19, 35], [-8, 34], [2, 34], [11, 36]],
      [[25, 36], [31, 33], [38, 30], [48, 31], [55, 34], [65, 32], [76, 31]],
    ], gates: [{ x: 18, z: 36, span: 11.2, rot: 0 }] },
];
for (const ward of INNER_WARDS) {
  ward.walls = ward.walls.map(placePath);
  placeCatalog(ward.gates);
}

// Civic kit palettes come from the shared visual language (world/style.js).
export { KIT_PALETTES as ARCHITECTURE_PALETTES } from '../world/style.js';

export const POSTERN_GATES = [...SALTREACH_GATES, ...MERIDIAN_GATES].map(g => [g.x, g.z, g.rot]);
placeCatalog(ARCHITECTURE);
for (const road of [...CIVIC_ROADS, ...SETTLEMENT_ROADS]) road.points = placePath(road.points);
