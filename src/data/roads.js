import { placePath } from './worldPlacement.js';
// Regional routes follow the land (world/landforms.js cuts a pass where one climbs a shelf).
// A `graded` route keeps its authored heights instead: true for all of it, or a number for
// its first metres, for ledge roads built along a rock to a gate. A `fill` is the outline of
// built ground on the inside of a bend, from the road's edge round the hollow the bend swings
// past and back to the road: world/roadworks.js raises it level with the road.
export const ROADS = [
  // From the Supply Road at the Lower Works foot down a walled switchback on the terrace face,
  // graded, then along the Ward's south side and down its street under the lanterns, and on
  // over the silted harbour to the port on the north coast, on the land.
  { id: 'meridian_dock_road', name: 'Meridian Dock Road', width: 4.5, cut: 5, kind: 'stone', graded: 56, points: [
    [657, -522, 8], [646, -520, 6.9], [634, -518, 5.6], [631, -511, 5], [640, -507.5, 4.5], [652, -508, 3.3],
    [666, -502, 2.6], [663, -493.5, 2.5], [650, -481.5, 2], [624, -466, 2.2], [621, -454, 2.4],
    [612, -420, 2.4], [602, -385, 2.4], [592, -350, 2.4], [585, -318, 2.4], [582, -302, 2.4],
  ] },
  // Meridian Harbour's quay street, from the Dock Road's foot along the back of the quay
  { id: 'meridian_quay_street', name: 'The Quay Street', width: 4.5, kind: 'stone', points: [
    [582, -305, 2.4], [560, -318, 2.2], [530, -332, 2.2], [500, -336, 2.2], [470, -332, 2.2], [455, -330, 2.2],
  ] },
  { id: 'meridian_supply_road', name: 'Meridian Supply Road', width: 4, kind: 'stone', graded: true, points: [
    [657, -522, 8], [650, -546, 12], [670, -564, 16], [690, -560, 16], [718, -556, 16],
  ], fill: [[652.6, -543], [657.5, -544.2], [666, -549], [667.4, -552.4], [662.6, -556.6]] },
  { id: 'reed_road', name: 'Reed Road', width: 4.2, kind: 'dirt', points: [
    [-98.5, 8, 4.5], [-145, -3, 6], [-195, 0, 9], [-270, -10, 12],
    [-330, -20, 11], [-405, -70, 9], [-462, -130, 5], [-501, -192, 3],
    [-512, -224, 3], [-516, -286, 3], [-481, -291, 3], [-459, -282, 2.8], [-455, -270, 2.5],
  ] },
  // Garrison Road climbs the Thornwood shelf through a broad, walled cutting, not a slot
  { id: 'garrison_road', name: 'Garrison Road', width: 4.5, cut: 7, kind: 'dirt', graded: 135, points: [
    [657, -522, 8], [673, -528, 8], [700, -528, 8], [720, -505, 8], [735, -477, 8], [760, -449, 8], [789, -428, 12],
    [854, -384, 15], [900, -315, 18], [938, -228, 18], [945, -145, 15],
    [925, -64, 12], [886, 18, 10], [853, 82, 8], [825, 164, 7],
    [801, 211, 6], [779, 237, 5], [775, 257, 5],
  ] },
  { id: 'meridian_heights_path', name: 'Signal Keepers Trail', width: 3.4, kind: 'dirt', graded: true, points: [
    [854, -384, 2.53], [904, -422, 2.6], [962, -449, 3.3], [986, -484, 3.7],
    [988, -530, 3.5], [962, -565, 4], [942, -584, 16], [934, -594, 16], [950, -615, 26],
    [960, -640, 38], [960, -660, 46], [946, -670, 46.7],
  ] },
  { id: 'meridian_bridge_east', name: 'Signal Bridge East Approach', width: 3.6, kind: 'stone', graded: true,
    points: [[960, -660, 46], [950, -660, 46], [944, -660, 46]] },
  { id: 'meridian_bridge_west', name: 'Signal Bridge West Approach', width: 3.6, kind: 'stone', graded: true,
    points: [[898, -660, 46], [881, -652, 46], [870, -638, 46]] },
  { id: 'white_pass', name: 'White Pass', width: 3.8, kind: 'snow', points: [
    [-603, 797, 6], [-612, 783, 6], [-640, 780, 6], [-653, 815, 8],
    [-664, 851, 12], [-683, 882, 17], [-703, 916, 22], [-721, 944, 29], [-727, 953, 30],
  ] },
  // Frostwatch to the Hush: round the head of the harbour bay and up onto the moor, to meet
  // the Sounding Way under the Ministry Stair (in Frosthollow's frame, data/coastlines.js)
  { id: 'rime_road', name: 'The Rime Road', width: 3.4, kind: 'snow', points: [
    [-640, 780, 6], [-670, 815, 2.4], [-700, 812, 4.2], [-740, 800, 3.6], [-775, 785, 3.3],
    [-800, 762, 3.5], [-830, 725, 11], [-842, 695, 11], [-852, 665, 11.2], [-860, 640, 12.7],
  ] },
  // ---- routes that tie each landmark to its landing (heights graded from the terrain)
  // the Ministry's paving lies under Frosthollow's snow now, and is poled like the White Pass
  { id: 'sounding_way', name: 'The Sounding Way', width: 3.6, kind: 'snow', points: [
    [-726, 358, 2.4], [-752, 362, 2.2], [-780, 368, 2.4], [-808, 377, 3],
    [-836, 388, 7.1], [-860, 397, 12.7], [-865.8, 398, 10.7],
  ] },
  { id: 'red_trail', name: 'The Red Trail', width: 3.6, kind: 'dirt', points: [
    [781, 274, 5], [794, 268, 5], [812, 264, 5], [835, 255, 10.4],
    [862, 248, 14.5], [890, 246, 14.4], [909, 252, 12.3],
  ] },
  { id: 'attendants_road', name: 'The Attendants Road', width: 3.6, kind: 'ash', points: [
    [688, 757, 5], [692, 775, 5.5], [700, 795, 5.9], [708, 815, 5.9],
    [716, 832, 5.2], [720, 843, 6.4], [732, 855, 20], [746, 868, 36],
  ] },
  // Meridian to Cinderstead overland: down off the Dock Road's causeway (`graded`, so the way
  // ramps from its height to the land) under the supply terrace, through the
  // Emberwood, up the lava steps past the slag wagon, down off the furnace's shelf between the
  // zealots' rock and the cone, and along the shore under its cliff (a slab bridge carries it
  // over the overflow, world/ruinscapes.js) into Cinderstead between the inn and the Ash
  // Store. Authored in Meridian's frame like every road out of the bastion, so its Cinderstead
  // end reads in that frame too (data/worldPlacement.js).
  { id: 'ember_road', name: 'The Ember Road', width: 3.8, kind: 'dirt', graded: 32, points: [
    [631, -511, 5], [631, -542, 2.6], [633, -580, 2.7], [624, -622, 3.1], [602, -664, 2.6],
    [568, -700, 2.9], [524, -732, 2.8], [474, -760, 5.4], [420, -785, 5.9], [364, -806, 3.2],
    [328, -842, 6.5], [292, -888, 6.5], [260, -938, 10.4], [230, -988, 10.5], [192, -1038, 10.6],
    [142, -1096, 12], [90, -1142, 11.6], [74, -1180, 12], [63, -1214, 11.8], [48, -1232, 3.2],
    [20, -1237, 2.6], [2, -1234, 2.4], [-22, -1232, 3], [-50, -1230, 2.7], [-78, -1228, 2],
    [-104, -1228, 2.4], [-124, -1226, 5], [-131, -1225, 5],
  ] },
  { id: 'canopy_path', name: 'Canopy Path', width: 3.2, kind: 'dirt', points: [
    [24, 902, 2.7], [36, 920, 3.8], [52, 940, 4.6], [68, 958, 6.9],
    [82, 972, 7.6],
  ] },
  // from the foot of the North Stair (data/architecture.js APPROACHES) through the Breadfields
  { id: 'north_road', name: 'The North Road', width: 4.2, kind: 'dirt', points: [
    [-1.5, 140.8, 3], [-9, 155, 3], [-14, 170, 4.6], [-24, 205, 4.7], [-30, 238, 5.1],
    [-24, 280, 4.2], [-16, 330, 11.9], [-10, 380, 12], [-6, 430, 7.6],
    [-2, 475, 7.8], [0, 508, 3],
  ] },
  { id: 'kestrel_climb', name: 'Kestrel Climb', width: 3.2, kind: 'dirt', points: [
    [-16, 330, 11.9], [-60, 350, 20], [-110, 375, 20], [-160, 402, 25.5],
    [-200, 425, 29.3],
  ] },
  { id: 'greywood_track', name: 'Greywood Track', width: 3.4, kind: 'dirt', points: [
    [-24, 280, 4.2], [40, 300, 6.9], [110, 322, 14.4], [170, 342, 14.4],
    [220, 358, 19.3],
  ] },
  { id: 'smugglers_path', name: 'Smugglers Path', width: 3, kind: 'dirt', points: [
    // from the Crucible's forecourt round the north end of its stands to the coast
    [99.8, 13.4, 5], [98.5, 26, 5], [104, 36, 4.6], [130, 37.5, 3.6], [170, 30, 8.6], [240, 70, 8.5], [310, 110, 8],
    [370, 145, 6.5], [405, 162, 3.3],
  ] },
];

for (const road of ROADS) {
  if (road.fill) road.fill = placePath([road.points[0], ...road.fill]).slice(1);
  road.points = placePath(road.points);
}
