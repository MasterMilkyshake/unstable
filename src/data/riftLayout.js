// The Rift's shared layout: the one place the terrain (world/riftRock.js, the 'rift' island in
// data/world.js), the castles (world/riftCastles.js) and the inhabited layer (world/riftOmens.js,
// data/riftSites.js) take their coordinates from. Leaf module: imports nothing.
//
// Compass: +z is north, +x is WEST. Heights are world y. `h: 'auto'` means the natural ground.
//
// What the Rift is (docs/WORLD_BIBLE.md): the keep where the Anchor dynasty's command chain
// ended, torn down into the passage of the dead with the land around it. Its architecture is
// that fortress-complex at full scale, built straight by the dynasty and then hurt by the Rift.
//   The Chainward          the walled throne mount: the keep's inner ward and the Duke's court.
//   The Unanswered Bastion the relay where the stations' calls came in and the relief answer
//                          never went out; cut off by a chasm, reached by one bridge.
//   The Garrison Steps     terraced barracks of the drowned knights, still keeping their watch.
//   The relay towers       signal towers that carried the chain's word between the stations.
//   The upended towers     keep towers that fell the wrong way up, spires buried in the floor.
//   The Kneeling           colossal honour-guard statues bowed along the two processional ways.

export const RIFT_CENTER = { x: 6000, z: 6000 };

// Ground shared by every site. The island keeps its radius (240) and grows lobes for the
// outer sites; the void stays open past them (the user wants open sides, never a cave wall).
// The roof's rock columns (riftCeiling.js COLUMNS) stand in the void at r 262–286; no lobe
// reaches them.
export const RIFT_LOBES = [
  { id: 'chainward_north', x: 6000, z: 6190, r: 70 },
  { id: 'bastion', x: 6255, z: 5965, r: 70 },
  { id: 'garrison', x: 5790, z: 6110, r: 60 },
  { id: 'relay_north', x: 6120, z: 6158, r: 28 },
  { id: 'relay_northeast', x: 5890, z: 6188, r: 30 },
  { id: 'relay_west', x: 6172, z: 6080, r: 22 },
  { id: 'relay_south', x: 5905, z: 5805, r: 28 },
];

// The void chasm that cuts the Bastion's lobe off from the basin, coast to coast. Both ends run
// out past the coast so the void is continuous. Width is the full gap between the two lips.
export const RIFT_CHASMS = [
  { id: 'sundering', width: 18, points: [[6170, 5818], [6178, 5848], [6190, 5900], [6196, 5962], [6192, 6020], [6212, 6075], [6234, 6100]] },
];

// Level ground the builders rely on. Terrain must deliver these exact heights inside `core`
// (fraction of r kept dead level, default 0.6) and blend out to r.
export const RIFT_PADS = {
  // The Chainward: a two-tier mesa. Lower ward ring at 17, upper ward at 24.
  chainward_lower: { x: 6000, z: 6168, rx: 72, rz: 64, h: 17, shape: 'ellipse', cliff: true },
  // The outer bailey at the ramp's head, where the Grand Warden waits; sheer-rimmed like the wards.
  // Listed before the upper ward: where cliff pads overlap, the later one wins.
  chainward_forecourt: { x: 6000, z: 6100, rx: 30, rz: 24, h: 17, shape: 'ellipse', cliff: true },
  chainward_upper: { x: 6000, z: 6172, rx: 60, rz: 50, h: 24, shape: 'ellipse', cliff: true },
  // The Bastion mesa and the two bridgeheads (deck from x 6176 to 6218 along z 5962).
  bastion_mesa: { x: 6258, z: 5962, rx: 40, rz: 48, h: 14, shape: 'ellipse', cliff: true },
  // The bridgeheads run out to the chasm's lips, so the abutments stand on sheer rock.
  bridge_east: { x: 6172, z: 5962, w: 32, d: 14, h: 12, shape: 'rect', cliff: true },
  bridge_west: { x: 6214, z: 5962, w: 22, d: 14, h: 14, shape: 'rect', cliff: true },
  // The Garrison Steps: three terraces climbing east (toward -x), each z 6085–6148.
  // Cut into the hillside: the terraces share their edges (x 5852–5824, 5824–5790, 5790–5750)
  // and each riser is sheer.
  garrison_1: { x: 5838, z: 6116, w: 28, d: 64, h: 11, shape: 'rect', cliff: true },
  garrison_2: { x: 5807, z: 6116, w: 34, d: 64, h: 16, shape: 'rect', cliff: true },
  garrison_3: { x: 5770, z: 6116, w: 40, d: 64, h: 21, shape: 'rect', cliff: true },
  // Tower footings.
  upended_a: { x: 6150, z: 5880, r: 12, h: 'auto' },
  upended_b: { x: 5830, z: 5965, r: 12, h: 'auto' },
  relay_north: { x: 6125, z: 6160, r: 12, h: 'auto' },
  relay_northeast: { x: 5885, z: 6195, r: 12, h: 'auto' },
  relay_west: { x: 6175, z: 6080, r: 12, h: 'auto' },
  relay_south: { x: 5905, z: 5800, r: 14, h: 'auto' },
  // Statue plinths (the Kneeling).
  kneel_sw1: { x: 6030, z: 5908, r: 7, h: 'auto' },
  kneel_sw2: { x: 6030, z: 5934, r: 7, h: 'auto' },
  kneel_se1: { x: 5970, z: 5908, r: 7, h: 'auto' },
  kneel_se2: { x: 5970, z: 5934, r: 7, h: 'auto' },
  kneel_nw: { x: 6018, z: 6056, r: 7, h: 'auto' },
  kneel_ne: { x: 5982, z: 6056, r: 7, h: 'auto' },
};

// Graded walking routes. Terrain keeps each walkable end to end (grade under 0.45, no void,
// no riser taller than 0.5 m) across `width`; castles and rock leave the corridor open (the
// castles' own gates and bridge decks carry the route where it passes through them).
// A point's third value pins the height there; elsewhere the route follows the ground.
export const RIFT_WAYS = [
  // The arrival way meets the foot of the Drowned Precincts' south stair (data/riftCity.js).
  { id: 'arrival', width: 7, points: [[6000, 5838, 6], [6000, 5880], [6000, 5922, 6]] },
  // It climbs the Drowned Precincts' processional stair (data/riftCity.js) to the forecourt.
  { id: 'chainward', width: 7, points: [[6000, 6010, 10.6], [6000, 6038, 17], [6000, 6076, 17], [6000, 6108, 17], [6000, 6128, 24], [6000, 6134, 24]] },
  // Out through the city's Bastion Gate and down to the bridgehead over the Sundering.
  { id: 'bastion', width: 6, points: [[6100, 5980, 10.6], [6118, 5979, 8.4], [6136, 5970, 7.6], [6150, 5963], [6166, 5962, 12]] },
  // From the Chainward's west postern stair, past the north and west relays and the Sealed
  // Wound, along the Sundering's lip to the same bridgehead: the keep's road to the Bastion.
  { id: 'chainward_bastion', width: 6, points: [[6096, 6146, 7.1], [6122, 6141], [6150, 6127], [6176, 6104], [6190, 6080], [6180, 6052], [6174, 6024], [6174, 5996, 7.1], [6168, 5986, 7.0], [6150, 5975, 7.2], [6136, 5970, 7.6]] },
  // Out of the Precincts' upper ward through the breach in their east curtain.
  { id: 'garrison', width: 6, points: [[5918, 6052, 17], [5884, 6052, 15.2], [5860, 6066, 12.5], [5847, 6074, 11.2], [5845, 6082, 11], [5845, 6094, 11]] },
];

// Where the castles stand and how they face. yaw follows kit.siteFrame: the gate side (local -z)
// points to world (-sin yaw, -cos yaw), so 0 = gate faces south, PI/2 = east (-x), -PI/2 = west.
export const RIFT_CASTLES = {
  chainward: { x: 6000, z: 6168, yaw: 0, gate: { x: 6000, z: 6116 }, keepClear: [{ x: 6000, z: 6150, w: 62, d: 46 }, { x: 6000, z: 6187, r: 6 }, { x: 6040, z: 6190, r: 7 }] },
  bastion: { x: 6258, z: 5962, yaw: Math.PI / 2, gate: { x: 6220, z: 5962 }, bridge: { ax: 6176, bx: 6218, z: 5962, deckA: 12, deckB: 14, width: 6 } },
  garrison: { x: 5800, z: 6116, yaw: -Math.PI / 2 },
  upended: [{ id: 'upended_a', x: 6150, z: 5880, yaw: 0.7 }, { id: 'upended_b', x: 5830, z: 5965, yaw: -1.1 }],
  // Relay towers: the beacon cradle's ring sits at ground + ringH; chains hang from it.
  relays: [
    { id: 'relay_north', x: 6125, z: 6160, ringH: 38 },
    { id: 'relay_northeast', x: 5885, z: 6195, ringH: 42 },
    { id: 'relay_west', x: 6175, z: 6080, ringH: 34 },
    { id: 'relay_south', x: 5905, z: 5800, ringH: 40 },
  ],
};

// Spots the castles must keep walkable and clear (no collider within 1 m, standing room 2.1 m)
// so the inhabited layer can put records, chests, NPCs and fights there.
export const RIFT_SPOTS = {
  chainward_grand_warden: { x: 6000, z: 6096, clear: 6 }, // the Grand Warden's fight in the forecourt
  chainward_gate_plate: { x: 6009, z: 6104 },
  chainward_chest: { x: 6050, z: 6134 },
  chainward_knights: { x: 6066, z: 6168, clear: 3 }, // lower ward ring, west side
  bastion_court: { x: 6260, z: 5962, clear: 6 },
  bastion_plate: { x: 6248, z: 5978 },
  bastion_chest: { x: 6272, z: 5944 },
  bridge_east_head: { x: 6160, z: 5962, clear: 3 },
  garrison_2_yard: { x: 5806, z: 6116, clear: 5 },
  garrison_3_yard: { x: 5768, z: 6118, clear: 5 },
  garrison_roll: { x: 5774, z: 6098 },
  garrison_chest: { x: 5758, z: 6140 },
  upended_b_chest: { x: 5822, z: 5958 },
  relay_south_tally: { x: 5911, z: 5793 },
  kneel_inscription: { x: 6022, z: 5921 },
};
