// The new reaches of the Anchorage: Meridian (the Enclave's island), the Hush
// (the Ministry of Soundings), and the islets along the sea roads. Registered into
// world.js's STRUCTURES / LOCATIONS / FERRY_ROUTES. +z is north, +x is west.

export const REGION_STRUCTURES = [
  // ================================================================ Meridian
  // Fort Meridian: the Chain Citadel (the Enclave's palace) fills the bastion's south half
  // (data/architecture.js, world/palaces.js); the garrison town and parade ground lie north of it.
  { type: 'banner_pole', style: 'enclave', x: 776, z: -540, h: 11 },
  { type: 'banner_pole', style: 'enclave', x: 806, z: -540, h: 11 },
  { type: 'banner_pole', style: 'enclave', x: 742, z: -528, h: 9 },
  { type: 'banner_pole', style: 'enclave', x: 832, z: -558, h: 9 },
  { type: 'watchtower_t', name: 'Meridian Signal Tower', style: 'enclave', x: 663, z: -581, h: 18 },
  { type: 'watchtower_t', style: 'enclave', x: 860, z: -640, h: 16 },
  // Meridian Ward: the occupied harbor town between the docks and the fort
  { type: 'hall', name: 'The Registry of Returned Persons', style: 'enclave', x: 690, z: -506, rot: Math.PI * 0.82, w: 18, d: 10 },
  { type: 'house', x: 664, z: -476, rot: Math.PI * 0.8, w: 9, d: 8, style: 'enclave' },
  { type: 'house', x: 648, z: -495, rot: Math.PI * 0.75, w: 8, d: 8, style: 'enclave', low: true },
  { type: 'house', x: 676, z: -460, rot: Math.PI * 0.9, w: 8, d: 7, style: 'enclave' },
  { type: 'house', x: 706, z: -478, rot: Math.PI * 0.7, w: 9, d: 8, style: 'enclave' },
  { type: 'gallows', x: 716, z: -462, rot: 0.6 },
  { type: 'lantern_line', style: 'enclave', x: 660, z: -486, x2: 676, z2: -498, h: 5.5 },
  // Meridian Harbour, the Enclave's port on the north coast, where the old harbour silted
  // up. Two moles close a basin round the ferry landing: the west mole off Thornwood's shore
  // with the harbour light on its head, the east mole with a watch brazier, the mouth between
  // them on the ferry's line. A stone quay runs along the shore with two ship piers off it,
  // the Writ of Iron and the Patient Crown berthed at them; the harbour office, the bonded
  // store, the victualling house and the Peacekeepers' barracks stand behind the quay street.
  // Authored in Meridian's frame (`frame`: much of it lies west of where that frame begins).
  { type: 'harbour_wall', kind: 'mole', name: 'The West Mole', style: 'enclave', frame: 'meridian', x: 654, z: -202,
    path: [[654, -202], [600, -184], [562, -180]], w: 8, top: 2.6, sea: 1, head: 'light' },
  { type: 'harbour_wall', kind: 'mole', name: 'The East Mole', style: 'enclave', frame: 'meridian', x: 456, z: -326,
    path: [[456, -326], [458, -300], [464, -250], [488, -202]], w: 7, top: 2.6, sea: -1, head: 'beacon' },
  { type: 'harbour_wall', kind: 'quay', name: 'The Quay', style: 'enclave', frame: 'meridian', x: 566, z: -295,
    path: [[566, -295], [550, -308], [536, -316], [520, -318], [506, -326], [491, -323], [476, -320], [460, -313]], w: 8, top: 1.9, sea: 1 },
  { type: 'pier', style: 'enclave', frame: 'meridian', x: 545, z: -306, rot: -0.12, len: 48, w: 4.4 },
  { type: 'pier', style: 'enclave', frame: 'meridian', x: 505, z: -321, rot: -0.12, len: 52, w: 4.4 },
  { type: 'galleon', name: 'Writ of Iron', frame: 'meridian', x: 532.7, z: -279.3, rot: -0.12, len: 34 },
  { type: 'galleon', name: 'The Patient Crown', frame: 'meridian', x: 510.3, z: -290.1, rot: -0.12, len: 30 },
  { type: 'galleon', name: 'The Long Count', frame: 'meridian', x: 445, z: -142, rot: 0.6, len: 32 },
  { type: 'crane', style: 'enclave', x: 592, z: -300, y: 1.5, rot: 0.97 },
  { type: 'crane', style: 'enclave', frame: 'meridian', x: 550, z: -313, y: 1.9, rot: 0.1 },
  { type: 'crane', style: 'enclave', frame: 'meridian', x: 484, z: -326, y: 1.9, rot: -0.2 },
  { type: 'hall', name: 'The Harbour Office', style: 'enclave', frame: 'meridian', x: 546, z: -338, rot: -0.21, w: 20, d: 11 },
  { type: 'warehouse', name: 'The Bonded Store', style: 'enclave', frame: 'meridian', x: 510, z: -346, rot: -0.21, w: 20, d: 11 },
  { type: 'warehouse', name: 'The Victualling House', style: 'enclave', frame: 'meridian', x: 474, z: -347, rot: -0.21, w: 16, d: 10 },
  { type: 'barracks', name: "The Peacekeepers' Barracks", style: 'enclave', frame: 'meridian', x: 630, z: -338, rot: -0.21, w: 18, d: 10 },
  { type: 'watchtower_t', name: 'Harbour Watch', style: 'enclave', frame: 'meridian', x: 640, z: -218, h: 16 },
  { type: 'watchtower_t', style: 'enclave', frame: 'meridian', x: 452, z: -338, h: 14 },
  { type: 'banner_pole', style: 'enclave', frame: 'meridian', x: 558, z: -308, h: 10 },
  { type: 'banner_pole', style: 'enclave', frame: 'meridian', x: 530, z: -324, h: 10 },
  { type: 'banner_pole', style: 'enclave', frame: 'meridian', x: 500, z: -330, h: 10 },
  { type: 'banner_pole', style: 'enclave', frame: 'meridian', x: 472, z: -326, h: 10 },
  { type: 'crates', frame: 'meridian', x: 540, z: -320 }, { type: 'crates', frame: 'meridian', x: 500, z: -322 },
  // the harbour gate where the Dock Road comes down onto the quay street, the ropewalk behind
  // the stores, the chandlery by the office, and lamps strung along the street
  { type: 'gate_arch', name: 'The Harbour Gate', style: 'enclave', frame: 'meridian', x: 572, z: -311, rot: -2.1, w: 7.5, h: 7 },
  { type: 'warehouse', name: 'The Ropewalk', style: 'enclave', frame: 'meridian', x: 505, z: -368, rot: -0.21, w: 34, d: 7 },
  { type: 'house', name: 'The Chandlery', style: 'enclave', frame: 'meridian', x: 565, z: -342, rot: -0.21, w: 9, d: 8 },
  { type: 'lantern_line', style: 'enclave', frame: 'meridian', x: 556, z: -327, x2: 536, z2: -332, h: 5.5 },
  { type: 'lantern_line', style: 'enclave', frame: 'meridian', x: 516, z: -336, x2: 486, z2: -337, h: 5.5 },
  // the drydock, and below it on the shore the Crown Sluice: the sea gate the Grand Warden opened
  // to go down into the Rift (world/props.js), the surface's one door down for the living
  { type: 'drydock', x: 800, z: -752, rot: 0.25, len: 34 },
  { type: 'crown_sluice', id: 'crown_sluice', name: 'The Crown Sluice', x: 793.3, z: -781.9, rot: -2.909 },
  { type: 'watchtower_t', style: 'enclave', x: 780, z: -730, h: 14 },
  // The old signal crew's route climbs the mountain independently of the fort.
  { type: 'campfire', id: 'cf_signal_keepers', name: 'Signal Keepers Camp', x: 939.6, z: -583.4 },
  // the lamp crews' ledge on the trail (world/outposts.js): the flat is laid in two pieces so
  // the trail's last ramp comes up between them; the lantern line runs from the trail's foot
  // to the Signal Bridge's head
  { type: 'signal_camp', name: 'Signal Keepers Camp', x: 942, z: -584, road: 'meridian_heights_path',
    flats: [[-9, -0.5, -9, 2], [-0.5, 7, -9, -2]], fire: [-2.4, 0.6], openings: [[1.5, -2.2, 2.6], [-7.5, -9.2, 2.8]],
    store: [-6.6, -0.6, Math.PI / 2], shelter: [3.5, -7.4, 0, 5.4], ledger: [4.6, -4.0, Math.PI / 2], crates: [6.2, -4.6],
    lineFrom: [20, 19], lineTo: [18, -66] },
  { type: 'tent', x: 948, z: -584, rot: -Math.PI / 2, color: '#686b62' },
  { type: 'crates', x: 947, z: -578 },
  { type: 'watchtower_t', name: 'The Silent Signal', style: 'enclave', x: 955, z: -673, h: 16 },
  { type: 'banner_pole', style: 'enclave', x: 938, z: -673, h: 6 },

  // ================================================================ The Hush
  { type: 'dock', id: 'dock_hush', x: -716, z: 358, len: 26, rot: 0 },
  { type: 'campfire', id: 'cf_hush', x: -738, z: 368, name: 'Hush Landing' },
  { type: 'well', id: 'well_hush', x: -744, z: 352, spring: true },
  { type: 'house', name: 'The Waiting House', x: -752, z: 376, rot: -Math.PI / 2, w: 9, d: 8, style: 'hush', low: true },
  // the Sounding House on its summit table (world/seats.js): the precinct, the Quiet Gate
  // over the Ministry Stair and the Sounding Tower with the Sounder in its loft; round the
  // court the Office of Soundings, the Quiet Archive and the clerks' lodging
  { type: 'sounding_house', name: 'The Sounding House', style: 'hush', x: -964, z: 382 },
  { type: 'hall', name: 'The Quiet Archive', style: 'hush', x: -980, z: 408, rot: Math.PI, w: 18, d: 11 },
  { type: 'hall', name: 'The Office of Soundings', style: 'hush', x: -942, z: 407, rot: Math.PI, w: 14, d: 9 },
  { type: 'barracks', name: "The Clerks' Lodging", style: 'hush', x: -945, z: 361.5, rot: 0, w: 14, d: 9 },
  // the Ministry's field of empty chairs, facing the sea through the gap in the southern
  // range, and the Vahl ring its clerks first measured at (world/sites.js)
  { type: 'chair_fields', name: 'The Chair Fields', style: 'hush', x: -880, z: 262, rows: 6, cols: 10, x2: -820, z2: 130 },
  { type: 'listening_stones', name: 'The Listening Stones', x: -1085, z: 425, r: 10, n: 11, x2: -1285, z2: 425 },
  { type: 'stone_belfry', name: 'The Drowned Bell', x: -1236, z: 292, h: 8, w: 6, tilt: 0.22 },
  { type: 'lantern_line', style: 'hush', x: -762, z: 355, x2: -764, z2: 373, h: 5 },

  // ================================================================ islets
  { type: 'anchor_statue', name: "The Anchor's Fall", x: 0, z: 720, rot: Math.PI, scale: 6 },
  // the jetty where the North Watch ferry puts in, and Saint Ebb's landing toward Saltreach
  { type: 'dock', id: 'dock_anchor', x: 0, z: 678, len: 16, yaw: Math.PI },
  { type: 'dock', id: 'dock_ebb', x: -315, z: -600, len: 14, yaw: 0 },
  { type: 'campfire', id: 'cf_anchor', x: 14, z: 690, name: "Anchor's Rest" },
  { type: 'gallows', x: 426, z: -326, rot: 0.3 },
  { type: 'watchtower_t', name: 'Gallows Watch', style: 'enclave', x: 412, z: -338, h: 15 },
  { type: 'banner_pole', style: 'enclave', x: 430, z: -340, h: 9 },
  { type: 'lighthouse', name: "Saint Ebb's Light", x: -320, z: -620 },
  { type: 'campfire', id: 'cf_saint_ebb', x: -312, z: -630, name: "Saint Ebb's Light" },
  { type: 'ruins', x: -332, z: -610 },
  { type: 'wreck', name: "Wreck of the Gull's Reach", x: 160, z: -360, rot: 0.7, len: 28 },
];

export const REGION_LOCATIONS = [
  { name: 'Meridian', x: 790, z: -580, r: 300 },
  { name: 'Fort Meridian', x: 790, z: -556, r: 62 },
  { name: 'The Chain Citadel', x: 790, z: -627, r: 29 },
  // The Lower Works sit on the supply terrace (h 16) under the bastion (h 46). The lift and the
  // Iron Stair climb inside this circle, so above maxY the place is Fort Meridian (world.locationAt).
  { name: 'Meridian Lower Works', x: 697, z: -574, r: 38, maxY: 31, above: 'Fort Meridian' },
  { name: 'Signal Keepers Camp', x: 941, z: -584, r: 18 },
  { name: 'The Silent Signal', x: 948, z: -673, r: 24 },
  { name: 'Meridian Ward', x: 676, z: -484, r: 40 },
  { name: 'Meridian Docks', frame: 'meridian', x: 530, z: -280, r: 80 },
  { name: 'The Crown Drydock', x: 806, z: -770, r: 46 },
  { name: 'The Hush', x: -1030, z: 340, r: 340 },
  { name: 'Hush Landing', x: -734, z: 362, r: 30 },
  { name: 'The Sounding House', x: -960, z: 386, r: 46 },
  { name: 'The Chair Fields', x: -880, z: 262, r: 32 },
  { name: 'The Listening Stones', x: -1085, z: 425, r: 22 },
  { name: 'The Drowned Bell', x: -1236, z: 292, r: 24 },
  { name: "The Anchor's Fall", x: 0, z: 700, r: 60 },
  { name: 'Gallows Rock', x: 420, z: -330, r: 55 },
  { name: "Saint Ebb's Light", x: -320, z: -620, r: 50 },
  { name: "Wreck of the Gull's Reach", x: 160, z: -360, r: 46 },
];

export const REGION_FERRY_ROUTES = [{ id: 'dock_hush', name: 'The Hush', x: -690, z: 358, spawn: { x: -730, z: 360 } }];

// Garrisons and the creatures of the new reaches.
export const REGION_SPAWNERS = [
  // ---- story bosses
  { type: 'vice_warden', x: 790, z: -556, count: 1, radius: 0, respawn: 0, boss: true, when: (ch) => !!(ch.flags && ch.flags.war_enclave) || (ch.rep?.enclave ?? 0) <= -50 || ch.quests?.bastion?.state === 'active' },
  { type: 'grand_warden', x: 6000, z: 6096, count: 1, radius: 0, respawn: 0, boss: true, when: (ch) => (ch.bossesDefeated || []).includes('vice_warden') || ch.quests?.bastion?.state === 'done' },
  // ---- Meridian: the Enclave garrison
  { type: 'gloomowl', x: 977, z: -539, count: 1, radius: 7, respawn: 160 },
  { type: 'peacekeeper', x: 946, z: -662, count: 1, radius: 0, respawn: 180, face: 0 },
  { type: 'peacekeeper', x: 596, z: -316, count: 2, radius: 0, respawn: 180, face: -0.6 },
  // Peacekeepers on the quay and the west mole
  { type: 'peacekeeper', frame: 'meridian', x: 550, z: -318, count: 2, radius: 2, respawn: 180, patrol: [[550, -318], [506, -330], [468, -322], [506, -330]] },
  { type: 'peacekeeper', x: 600, z: -184, count: 1, radius: 0, respawn: 180, face: 0 },
  // and out along the Enclave's roads: the Garrison Road to Thornwood, the Ember Road south
  { type: 'peacekeeper', x: 854, z: -384, count: 2, radius: 3, respawn: 200, patrol: [[854, -384], [900, -315], [938, -228], [900, -315]] },
  { type: 'peacekeeper', x: 602, z: -664, count: 2, radius: 3, respawn: 200, patrol: [[602, -664], [568, -700], [524, -732], [568, -700]] },
  { type: 'peacekeeper', x: 660, z: -472, count: 2, radius: 3, respawn: 180, patrol: [[650, -470], [700, -468], [702, -505], [660, -506]] },
  { type: 'peacekeeper_halberdier', x: 746, z: -551, count: 1, radius: 0, respawn: 180, face: -Math.PI / 2 },
  { type: 'peacekeeper_halberdier', x: 713, z: -557, count: 1, radius: 0, respawn: 180, face: -Math.PI / 2 },
  // the fort itself is kept by the central ranks: a captain walks the parade ground
  { type: 'enclave_captain', x: 760, z: -530, count: 1, radius: 3, respawn: 300, patrol: [[760, -530], [822, -532], [824, -576], [762, -576]] },
  { type: 'peacekeeper_arbalist', x: 774, z: -578, count: 1, radius: 0, respawn: 180, face: Math.PI },
  { type: 'peacekeeper_arbalist', x: 808, z: -544, count: 1, radius: 0, respawn: 180, face: 0 },
  { type: 'enclave_captain', x: 790, z: -546, count: 1, radius: 0, respawn: 300, face: 0 },
  { type: 'peacekeeper', x: 796, z: -738, count: 2, radius: 4, respawn: 180, patrol: [[786, -732], [818, -760], [800, -778]] },
  { type: 'peacekeeper', x: 418, z: -324, count: 1, radius: 2, respawn: 200 },
  { type: 'peacekeeper_arbalist', x: 412, z: -340, count: 1, radius: 0, respawn: 200, face: Math.PI * 0.75 },
  { type: 'scuttler', x: 880, z: -440, count: 3, radius: 14, respawn: 120 },
  { type: 'gloomowl', x: 990, z: -660, count: 1, radius: 16, respawn: 180 },
  { type: 'mudlurker', x: 846, z: -790, count: 3, radius: 10, respawn: 90 },
  // ---- the Hush: the Ministry's quiet keepers, and what the fog brings ashore
  { type: 'ministry_soundsman', x: -732, z: 352, count: 1, radius: 0, respawn: 200, face: Math.PI / 2 },
  { type: 'ministry_soundsman', x: -950, z: 370, count: 2, radius: 3, respawn: 200, patrol: [[-950, 370], [-978, 370], [-978, 396], [-948, 396]] },
  { type: 'ministry_silencer', x: -986, z: 398, count: 1, radius: 0, respawn: 240, face: Math.PI / 2 },
  { type: 'ministry_soundsman', x: -880, z: 250, count: 1, radius: 2, respawn: 200, patrol: [[-892, 250], [-866, 250], [-866, 276], [-892, 276]] },
  { type: 'gloomowl', x: -1080, z: 430, count: 1, radius: 14, respawn: 180 },
  { type: 'riftling', x: -1220, z: 300, count: 3, radius: 12, respawn: 150 },
  { type: 'hollow', x: -1010, z: 300, count: 2, radius: 14, respawn: 150 },
  // ---- islets
  { type: 'mudlurker', x: -18, z: 694, count: 2, radius: 8, respawn: 120 },
  { type: 'scuttler', x: -336, z: -176, count: 2, radius: 8, respawn: 120 },
  { type: 'scuttler', x: -214, z: -436, count: 2, radius: 10, respawn: 120 },
];

// People of the new reaches and of the storyline.
export const REGION_NPCS = [
  {
    id: 'minister_quill', name: 'Minister Hesper Quill', title: 'Ministry of Soundings', x: -965.4, z: 377.4, interior: true, floor: 0.96,
    look: { skin: '#d8c8b8', hair: '#c8c8d0', outfit: { main: '#46465a', trim: '#c8ccdf', pants: '#2e2e3c', boots: '#1c1c24' }, hood: true },
  },
];

// Named waters: the Ministry's three deeps, and the Enclave's sluice.
REGION_LOCATIONS.push(
  { name: 'The Gallows Channel', x: 260, z: -250, r: 40 },
  { name: 'The Redwake Strait', x: 420, z: 600, r: 40 },
  { name: 'The Pale Sound', x: -470, z: 560, r: 40 },
  { name: 'The Crown Sluice', x: 794, z: -780, r: 24 },
);

// Rewards for whoever makes the crossing.
export const REGION_CHESTS = [
  { id: 'c_signal_keeper', x: 944, z: -678, loot: { silver: [60, 100], items: [['iron_draught', 1], ['writ_scrap', 2], ['bread', 2]] } },
  { id: 'c_anchor_fall', x: 22, z: 702, loot: { silver: [80, 140], items: [['mantra_spark', 1], ['rift_shard', 2]] } },
  { id: 'c_saint_ebb', x: -306, z: -614, loot: { silver: [60, 110], items: [['elixir', 2], ['waterskin', 1]] } },
  { id: 'c_gulls_reach', x: 170, z: -350, loot: { silver: [40, 90], items: [['sanity_draught', 1], ['bread', 3]] } },
  { id: 'c_drowned_bell', x: -1226, z: 284, loot: { silver: [70, 120], items: [['rift_shard', 3], ['sanity_draught', 2]] } },
  { id: 'c_listening_stones', x: -1080, z: 418, loot: { silver: [50, 90], items: [['ether_tonic', 1], ['mantra_spark', 1]] } },
  { id: 'c_crown_drydock', x: 816, z: -762, loot: { silver: [120, 200], items: [['iron_draught', 2], ['writ_scrap', 2]] } },
];
