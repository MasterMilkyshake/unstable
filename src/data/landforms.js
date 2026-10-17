// The shape of the surface isles (world/landforms.js), in final world metres: +z north,
// +x WEST. Heights are the level of each shelf's top above the sea.
//
// Why the land looks like this: in the Fracture the Anchorage shelf broke into fault blocks
// (docs/WORLD_BIBLE.md). The old high country stayed up as broad shelves with sheer walls,
// the coast between them sank into basins and meres, and here and there a column of shelf
// was left standing on its own. People built on what stayed dry: towns sit on the low
// shelves by the water, the Compact's works on the heights, and its roads climb the walls
// through cuts and ramps (passes are cut automatically where a way climbs a shelf).
//
// Shelves people use step 8-12 m: a wall a strong climber can take in one grip, or the way's
// cut. Ranges and columns are scenery, too sheer to climb: they frame valleys, close views
// and give the eye a skyline to steer by.
//
// Kinds (see world/landforms.js expand()): plateau, massif, basin, gorge, pillars, range, dry,
// and the soft ones: mound (a smooth rise of earth with no wall) and mounds (a scatter of them).
// Shared options: p (outline squareness), warp/jit (ragged edges), block (edge step, m),
// rot, margin (m kept clear of the coast), exact (a clean edge, for falls and cut faces),
// ramps: [{ yaw, w, way? }] (a walkable ramp down that side; yaw points downhill).

import { archPoint, ARCH_ALONG_ROT, ARCH_LENGTH, ARCH_MERE } from './greatBridge.js';

const shelf = (x, z, rx, rz, h, o = {}) => ({ kind: 'plateau', x, z, rx, rz, h, p: 8, warp: 0.07, jit: 0.08, block: 6, lumps: 8, ...o });
const knoll = (x, z, rx, rz, h, o = {}) => ({ kind: 'plateau', x, z, rx, rz, h, p: 5, warp: 0.06, jit: 0.06, block: 3, margin: 2, ...o });
const sink = (x, z, rx, rz, h = 'low', o = {}) => ({ kind: 'basin', x, z, rx, rz, h, p: 2.15, warp: 0.26, jit: 0.16, block: 3, ...o });
const mound = (x, z, rx, rz, h, o = {}) => ({ kind: 'mound', x, z, rx, rz, h, ...o });

// A clean fall line at (x, z) for a waterfall pouring along `rot` (data/vistas.js
// WATERFALLS convention): the shelf holds `top` behind the line and drops to `below`
// (a level, or 'low' for the lowland) in front of it, `w` metres wide.
// A region joined to another island's coast keeps the grain it was built with: the seeds and
// noise its landforms took as an island of its own (world/landforms.js expand()).
const grain = (seed, defs) => defs.map((def, i) => ({ seed: seed * 131 + i * 977, noise: seed, ...def }));

function lip(x, z, rot, top, below, w = 14, d = 10) {
  const ux = Math.sin(rot), uz = Math.cos(rot);
  const o = { p: 12, exact: true, rot: -rot, margin: 0 };
  return [
    { kind: 'plateau', x: x - ux * d / 2, z: z - uz * d / 2, rx: w / 2, rz: d / 2, h: top, ...o },
    { kind: 'basin', x: x + ux * d / 2, z: z + uz * d / 2, rx: w / 2, rz: d / 2, h: below, ...o },
  ];
}

export const LANDFORMS = {
  // ---------------------------------------------------------------- Saltreach & Shimmerfen
  saltreach: [
    // The town keeps its own terraces (data/saltreach.js). Behind it the old high country
    // stands in an amphitheatre around the Breadfields, split by the North Road's ravine:
    // the Lamp Bluff to the east, the Perch Bluff to the west, the Old Crown closing the north.
    shelf(-110, 175, 50, 78, 26, { lumps: 6 }), // Lamp Bluff
    shelf(-122, 195, 30, 50, 38, { lumps: 4, block: 4 }),
    shelf(100, 160, 56, 58, 26, { lumps: 6, ramps: [{ yaw: -1.75, w: 6 }] }), // Perch Bluff, a ramp down into the ravine
    knoll(42, 113, 15, 14, 24, { p: 8, block: 3, ramps: [{ yaw: 0.55, w: 5 }] }), // Vowkeeper's Perch
    // Kestrel Heights: the upland the beacon watches from, three great steps up from the valley.
    shelf(-215, 385, 125, 150, 16),
    shelf(-222, 415, 95, 105, 28),
    shelf(-212, 438, 52, 50, 40, { block: 4 }),
    // The Old Crown: the high country's north rim, sheer and never climbed, closing the
    // valley's view of the sea except where the North Road runs out through the saddle.
    { kind: 'range', points: [[-340, 470], [-250, 525], [-110, 545]], w: 40, base: 34, peak: 96 },
    { kind: 'range', points: [[110, 525], [230, 525], [340, 455]], w: 36, base: 30, peak: 84 },
    // The North Saddle the road crosses between the heights and Greywood.
    shelf(0, 400, 88, 72, 10),
    // Greywood: forested shelves stepping up to Hollowbrook.
    shelf(235, 390, 150, 130, 14),
    shelf(252, 378, 85, 78, 24),
    // The West Downs above the smugglers' coast.
    shelf(300, 120, 125, 120, 10, { lumps: 7 }),
    // The Reed Downs: the broken edge of the high country, stepping down to the sunken fen.
    shelf(-245, 115, 118, 112, 9),
    shelf(-262, 150, 60, 55, 17, { lumps: 5 }),
    // The Wash where the drowned wake: the dune rise steps down from the camp toward the
    // abbey and the bay in low shelves with stone risers, so the first look out over the
    // Arch Mere is from a ledge, not over a hump.
    shelf(-34, -346, 14, 42, 12.0, { lumps: 4, block: 3, warp: 0.05, jit: 0.05 }),
    shelf(-62, -350, 14, 46, 9.6, { lumps: 4, block: 3, warp: 0.05, jit: 0.05 }),
    shelf(-90, -352, 14, 44, 7.0, { lumps: 4, block: 3, warp: 0.05, jit: 0.05 }),
    shelf(-116, -350, 12, 36, 4.8, { lumps: 3, block: 3, warp: 0.05, jit: 0.05 }),
    // Seamspire Rise behind the abbey, its summit north of the abbey's line, and its north spur
    // over the Wash. South of the abbey the Rise has slumped to a low shoulder, so from the Wash
    // the eye runs over it and across the fen to the Hundred Arches on the skyline (the climb to
    // the summit opens the whole viaduct).
    shelf(-258, -272, 64, 48, 16),
    shelf(-266, -276, 32, 32, 28, { lumps: 4, block: 4 }),
    shelf(-205, -250, 48, 30, 16),
    mound(-284, -384, 72, 50, 4.5, { sharp: 1.3 }),
    ...lip(-150, 192, 4.19, 26, 'low'),
    ...lip(-144, -250, 1.31, 16, 'low'),

    // ---- Shimmerfen: the low country that sank, a trough dropped between the Saltreach high
    // country and the Fenwall, the coastal range that still stands along its south and east
    // shore. Nothing in the fen stands sheer: the peat settled into meres and tussocks
    // (world/landforms.js terms), and what rises out of it is earth heaped over old works.
    // The Fenward Steps: the Reed Downs' broken edge, slumped into long low swells.
    mound(-405, 60, 72, 112, 3.2, { sharp: 1.6 }),
    mound(-440, -40, 52, 62, 2.2, { sharp: 1.4 }),
    // The Fenwall: a skyline the Reed Road walks toward, sheer and unclimbed. A slumped step
    // of its own stone lies along its foot; the Arches' Foot, its western spur, is the one
    // gentle enough that the Compact's road came down it.
    shelf(-640, -650, 110, 60, 10, { lumps: 7 }),
    shelf(-640, -626, 124, 52, 5.5, { lumps: 7, block: 4 }),
    // (its western end is the Arches' Foot, below)
    { kind: 'range', points: [[-745, -709], [-790, -690], [-850, -615]], w: 46, base: 26, peak: 92 },
    { kind: 'range', points: [[-1000, -430], [-1014, -330], [-1008, -230], [-988, -120]], w: 28, base: 22, peak: 70 },
    { kind: 'range', points: [[-978, -60], [-962, 30]], w: 24, base: 20, peak: 48 },
    // The Arches' Foot: the Fenwall's western spur. The Compact cut its road up through the
    // spur to the bridge deck; the cut is the only way up, rock standing high on either side.
    // Laid in the bridge's frame (data/greatBridge.js archPoint: metres along the road, and
    // across it), so the spur stands wherever the Arches do.
    shelf(...archPoint(60.4, -31.2), 74, 82, 51, { lumps: 6, block: 4, rot: ARCH_ALONG_ROT }),
    shelf(...archPoint(41.2, -53.2), 44, 54, 69, { lumps: 4, block: 4, rot: ARCH_ALONG_ROT }),
    shelf(...archPoint(66.7, 42.8), 18, 50, 28, { lumps: 3, block: 4, rot: ARCH_ALONG_ROT }), // its bay-side shoulder
    { kind: 'gorge', points: [archPoint(-65, 5.6), archPoint(0, 0), archPoint(81.9, 3.5), archPoint(128, 5.4)], w: 30, h: 'low', p: 2, warp: 0.03, jit: 0.03, block: 3 },
    // Tussock islands where the old shelf's columns slumped and grassed over: low wooded
    // mounds that break the fen into meres and channels.
    { kind: 'mounds', x: -700, z: -330, rx: 150, rz: 210, n: 12, h: [1.4, 3.2], size: [16, 34],
      avoid: [...ARCH_MERE.map(({ at: [x, z], r }) => [x, z, r * 1.2]), [-716, -404, 44], [-700, -332, 52], [-670, -380, 42], [-600, -290, 30], [-548, -248, 30], [-560, -410, 40], [-650, -440, 26], [-480, -266, 60]] },
    // no meres under the Hundred Arches or on the Arches' Foot
    { kind: 'dry', points: [archPoint(-40, 3.2), archPoint(0), archPoint(ARCH_LENGTH), archPoint(ARCH_LENGTH + 20)], w: 46 },
    // Earth heaped over old works, and the Covenant built on it: each a gentle mound that
    // ramps up to its level crown (the flats in data/world.js keep the crowns' heights).
    mound(-698, -328, 54, 50, 4.6, { sharp: 1.15 }), // Witchwater
    mound(-670, -380, 44, 40, 4.1, { sharp: 1.15 }), // Reed Covenant Outlet
    mound(-548, -248, 30, 28, 4.6, { sharp: 1.7 }), // the collapsed tower
    mound(-560, -410, 42, 24, 3.6, { sharp: 1.8, rot: -1.1 }), // the colonnade
    mound(-650, -440, 24, 24, 4.6, { sharp: 1.7 }), // Fen Causeway View
  ],

  // ---------------------------------------------------------------- Thornwood, Meridian & the Ashen Spire
  thornwood: [
    // The Redwake upland: the drowned road's high country, carrying Brigand Hold.
    shelf(1440, 40, 205, 330, 12),
    shelf(1470, 0, 110, 120, 22), // the Thorn Crown
    shelf(1510, 330, 110, 90, 26), // the Redwake Fells
    // Owlroost Hollow: a hollow sunk into the upland's corner; the road dips through it.
    shelf(1262, -20, 75, 80, 12, { lumps: 5 }),
    sink(1232, -30, 42, 40, 'low', { rot: 0.35 }),
    sink(1214, -44, 16, 20, 'low', { p: 2, warp: 0.3, jit: 0.2, block: 2 }),
    sink(1250, -14, 14, 12, 'low', { p: 2, warp: 0.28, jit: 0.18, block: 2 }),
    ...lip(1274, -12, 4.71, 12, 'low'),
    // Widow Ridge: the spine the Garrison Road follows south to the bastion. At its south end
    // the road crosses a pass between two crags, and the bastion, the Heights and the sea open
    // below all at once.
    shelf(1335, -300, 92, 175, 18),
    shelf(1342, -446, 20, 30, 30, { lumps: 4, block: 3, p: 4 }),
    shelf(1262, -424, 18, 26, 28, { lumps: 4, block: 3, p: 4 }),
    // The Westwold: the long western shelf above the open sea, and the sheer coastal range
    // behind it that walls the forest in.
    shelf(1640, -60, 110, 250, 10),
    shelf(1665, -40, 60, 140, 18),
    { kind: 'range', points: [[1730, -340], [1772, -120], [1752, 80], [1700, 240]], w: 40, base: 32, peak: 110 },
    // Meridian: the Chain Citadel's rock and its supply terrace are the settlement's own
    // shelves (data/meridian.js). Behind them the Meridian Heights climb east in sheer steps,
    // the mountain the bastion was cut from.
    shelf(1278, -747, 82, 58, 30, { lumps: 6, block: 4 }),
    shelf(1286, -750, 72, 43, 38, { lumps: 5, block: 4 }),
    shelf(1284, -750, 69, 32, 46, { lumps: 4, block: 3 }),
    shelf(1330, -760, 80, 75, 30, { lumps: 6 }),
    shelf(1365, -775, 60, 55, 46, { lumps: 5, block: 4 }),
    // the west bridgehead: a ledge of the 46 m shoulder the span's abutment is set into
    shelf(1293, -780, 10, 9, 46, { p: 3, block: 2, lumps: 0, warp: 0.05, jit: 0.04, margin: 0 }),
    // Give the signal trail's cleft room to read as a ravine. The masonry
    // crossing spans its two banks; no road cut fills the space beneath it.
    { kind: 'gorge', points: [[1310, -708], [1317, -744], [1320, -780], [1328, -821]],
      w: 22, h: 16, p: 3, warp: 0.035, jit: 0.04, block: 2 },
    { kind: 'range', points: [[1390, -810], [1452, -722], [1475, -615]], w: 42, base: 56, peak: 112 },
    // The Ashen Spire: a stepped basalt cone, the southern furnace at the end of Meridian's coast. Its
    // caldera floor is sunk inside a high rim that the Ember Circlet's teeth stand on; the
    // Attendants Road climbs the flanks and enters the crater through a cut in the rim.
    shelf(380, -1180, 190, 170, 12),
    shelf(365, -1190, 130, 120, 22),
    shelf(352, -1196, 90, 84, 34, { block: 4 }),
    // The crater: a cone of welded cinder rising from the summit shelf to a broken rim and
    // falling back inside to the caldera floor (the flat in data/world.js keeps the floor
    // level at 36). Smooth, as a crater is; the Attendants Road is cut through its rim.
    { kind: 'crater', x: 340, z: -1200, floor: 34, crest: 47, outer: 68, h: 20, base: 2 },
    shelf(560, -1300, 70, 60, 15, { p: 4, lumps: 6 }), // the ash shelf the zealots hold
    // The ashfield: old lava that ran off the cone's western flank toward Meridian and cooled
    // in tongues, each a step lower than the one it broke from, with columns of jointed basalt
    // standing out of them. Lichen and heather have the older tongues; the woods have the rest.
    shelf(590, -1070, 125, 95, 10, { p: 2.6, lumps: 8, warp: 0.16 }),
    shelf(690, -1015, 100, 78, 7, { p: 2.4, lumps: 7, warp: 0.18, block: 4 }),
    { kind: 'pillars', x: 600, z: -1110, rx: 190, rz: 130, n: 6, h: [14, 24], size: [7, 12], margin: 6, block: 2,
      avoid: [[560, -1300, 40], [440, -980, 36], [340, -1200, 200], [261, -1326, 60]] },
    // The saddle: the woods between the lava fields and Meridian's lowland roll over the
    // last, buried flows, with no wall anywhere between the two coasts.
    mound(860, -935, 95, 70, 5.5, { sharp: 1.2, rot: 0.6 }),
    { kind: 'mounds', x: 800, z: -960, rx: 170, rz: 120, n: 10, h: [2.5, 7], size: [22, 44],
      avoid: [[690, -1015, 70], [1063, -701, 30], [1100, -720, 30]] },
    // Overflow channels: where the neglected galleries spill, lava has worn its beds down the
    // flanks to the sea (world/ruinscapes.js lays the flow in them).
    { kind: 'channel', points: [[340, -1108], [332, -1090], [346, -1072], [339, -1054], [340, -1034], [338, -1016]], w: 4.6, h: 1.0 },
    { kind: 'channel', points: [[382, -1300], [390, -1313], [392, -1332], [403, -1347], [406, -1367], [421, -1383], [424, -1406], [435, -1427]], w: 4.6, h: 1.0 },
  ],

  // ---------------------------------------------------------------- Frosthollow & the Hush
  // The northern regulator's mountain. The White Pass climbs its eastern flank through the
  // shelves to the White Hollow, a cirque walled on three sides where the Warden keeps the
  // regulator; above it the massif rises in sheer tiers no one climbs.
  frosthollow: [
    shelf(-1200, 1560, 260, 250, 12),
    shelf(-1215, 1565, 200, 190, 20),
    shelf(-1040, 1470, 48, 46, 30, { block: 4 }), // the White Hollow's floor
    { kind: 'range', points: [[-1102, 1452], [-1092, 1512], [-1046, 1536], [-996, 1522]], w: 13, base: 52, peak: 74, tiers: 2, summits: 2, block: 4 },
    { kind: 'range', points: [[-1390, 1430], [-1330, 1600], [-1200, 1700], [-1120, 1640]], w: 70, base: 44, peak: 132 },
    shelf(-1215, 1540, 70, 60, 40, { lumps: 5, block: 4 }),
    shelf(-955, 1575, 50, 48, 20), // the Stillkeep's shelf
    shelf(-930, 1820, 110, 100, 12), // the Pale Shelf on the eastern lobe
    shelf(-905, 1840, 55, 50, 22),
    // The ravine the aqueduct crosses, and the drowned hollow of the tarn.
    { kind: 'gorge', points: [[-1175, 1555], [-1120, 1620], [-1075, 1690]], w: 22, h: 12, p: 2, warp: 0.04, jit: 0.04, block: 4 },
    sink(-1265, 1545, 78, 74, 'low', { rot: 0.55 }),
    sink(-1305, 1520, 22, 28, 'low', { p: 2, warp: 0.28, jit: 0.18, block: 3 }),
    sink(-1235, 1585, 20, 16, 'low', { p: 2, warp: 0.26, jit: 0.16, block: 2 }),
    ...lip(-1046, 1530, Math.PI, 52, 30, 12, 8),
    // The east coast: moraine the ice dropped, drifted over, on a plain that steps down to
    // the sea in a low cliff with a reef of skerries off it.
    { kind: 'mounds', x: -1555, z: 1765, rx: 85, rz: 130, n: 10, h: [2.5, 6.5], size: [18, 36] },
    shelf(-1648, 1765, 40, 125, 6.5, { lumps: 7, margin: -5, block: 4 }),
    { kind: 'skerries', x: -1500, z: 1765, r: 185, n: 20, h: [1, 4.2], size: [3, 7.5], arc: [2.45, 3.85] },

    // ---- The Hush: a moor in steps up to the Sounding House on its summit table, cut off
    // in sheer sea cliffs to the south and east; the Sounding Way climbs from the landing
    // and the Ministry's flights finish it. Its north edge runs on into Frosthollow's snow.
    ...grain(61, [
      shelf(-1285, 1110, 245, 195, 11),
      shelf(-1280, 1118, 110, 100, 17),
      knoll(-1262, 1128, 38, 36, 34, { p: 7, block: 3, warp: 0.03, jit: 0.03 }),
      { kind: 'range', points: [[-1150, 895], [-1250, 865], [-1360, 895]], w: 26, base: 24, peak: 64, tiers: 3 },
      // Tarns: peat hollows on the moor holding still black water, skinned with ice at the
      // edges (world/ruinscapes.js fills them to just under their lowest rim).
      { kind: 'tarn', x: -1430, z: 1015, rx: 24, rz: 17, h: 2.8, rot: 0.4 },
      { kind: 'tarn', x: -1325, z: 988, rx: 19, rz: 13, h: 2.4, rot: -0.3 },
      { kind: 'tarn', x: -1394, z: 1090, rx: 15, rz: 11, h: 2.2, rot: 1.1 },
    ]),
  ],

  // ---------------------------------------------------------------- The Verdance
  // A jungle basin of rolling, root-bound hills around Kingsfall's table, with the old
  // rootworks' ridge closing it to the north.
  verdance: [
    knoll(-20, 1320, 46, 42, 16, { p: 6, block: 4, ramps: [{ yaw: Math.PI + 0.25, w: 6 }] }), // Kingsfall
    knoll(55, 1236, 46, 40, 10, { p: 5, block: 4 }), // the Mossbound terrace
    knoll(-110, 1220, 40, 36, 9, { p: 5, block: 4 }), // the Bone Pit's rim...
    sink(-110, 1220, 24, 22, 'low', { rot: -0.4 }), // ...and the pit
    sink(-98, 1232, 11, 13, 'low', { p: 2, warp: 0.3, jit: 0.2, block: 2 }),
    { kind: 'gorge', points: [[-110, 1220], [-118, 1172]], w: 12, h: 'low', p: 2, block: 3, warp: 0.04, jit: 0.04 },
    knoll(78, 1290, 42, 36, 12, { p: 5, block: 4 }), // the Needle's shelf
    // sand and earth slumped against the beach-facing feet of the rim and the terrace, so they
    // meet the shore in a slope rather than a wall
    mound(-100, 1190, 44, 20, 5.2, { sharp: 1.3 }),
    mound(-142, 1236, 18, 30, 4.6, { sharp: 1.3 }),
    mound(92, 1210, 30, 26, 5.6, { sharp: 1.3 }),
    ...lip(34, 1306, 5.76, 12, 'low'),
    { kind: 'range', points: [[-150, 1610], [-40, 1645], [80, 1600]], w: 30, base: 24, peak: 72, tiers: 3 },
    // The rootworks' old columns have long since slumped under the forest into rounded hills,
    // root-bound and grown over, so the canopy rolls instead of being pierced by blocks.
    { kind: 'mounds', x: 10, z: 1360, rx: 220, rz: 230, n: 13, h: [4, 11], size: [26, 50],
      avoid: [[-20, 1320, 60], [55, 1236, 55], [-110, 1220, 50], [82, 1308, 40], [-45, 1149, 60], [-87, 1418, 40], [-106, 1360, 22], [-90, 1300, 20], [-30, 1530, 36], [175, 1415, 32]] },
  ],

  // ---------------------------------------------------------------- the islets
  // Each islet: its rock broken into lumps that run into the sea on the weather side, and a
  // rim of skerries, the reef its ships have always feared. Coves are left where the
  // landings and the wreck are.
  gallows_rock: [
    shelf(420, -330, 30, 28, 9, { lumps: 6, block: 3, margin: -6, p: 5 }),
    { kind: 'skerries', x: 420, z: -330, r: 40, n: 14, h: [1.2, 4.5], size: [3, 7], avoid: [[426, -326, 6], [412, -338, 6], [430, -340, 4]] },
  ],
  saint_ebb: [
    shelf(-320, -620, 24, 22, 6, { lumps: 5, block: 3, margin: -6, p: 5 }),
    { kind: 'skerries', x: -320, z: -620, r: 33, n: 12, h: [1.0, 3.6], size: [2.5, 6], avoid: [[-312, -630, 6], [-332, -610, 12]] },
  ],
  anchor_rock: [
    { kind: 'skerries', x: 0, z: 700, r: 36, n: 14, h: [1.0, 3.4], size: [3, 7], avoid: [[0, 720, 14], [14, 690, 6]] },
  ],
  gulls_reach: [
    // the reef the Gull's Reach struck, still breaking the swell to seaward of the wreck
    { kind: 'skerries', x: 160, z: -360, r: 32, n: 10, h: [0.8, 2.6], size: [2.5, 5.5], arc: [-2.4, 0.6], avoid: [[160, -360, 16]] },
  ],
};

// ---------------------------------------------------------------- the Rift
// The isles below keep noise relief (world/terrain.js heightRaw): per-biome shelf step and
// feature scale, and the rock shoulders that frame their traversable country.
export const LANDFORM_PROFILES = {
  meadow: { shelf: 10, scale: 300 }, forest: { shelf: 12, scale: 340 }, emberwood: { shelf: 12, scale: 340 },
  highland: { shelf: 16, scale: 400 }, farmland: { shelf: 4, scale: 340 },
  snow: { shelf: 18, scale: 420 }, tundra: { shelf: 12, scale: 360 },
  volcanic: { shelf: 18, scale: 380 }, ashfield: { shelf: 12, scale: 340 },
  jungle: { shelf: 12, scale: 320 }, bastion: { shelf: 12, scale: 360 },
  hush: { shelf: 14, scale: 380 }, rift: { shelf: 12, scale: 320 },
  rock: { shelf: 4, scale: 180 },
  dunes: { shelf: 3, scale: 260 }, beach: { shelf: 0, scale: 240 },
  marsh: { shelf: 0, scale: 380 },
};
export const DEFAULT_LANDFORM = LANDFORM_PROFILES.meadow;
export const REGIONAL_BLUFFS = {
  rift: [{ x: 6118, z: 6080, rx: 42, rz: 56, h: 32 }],
};
