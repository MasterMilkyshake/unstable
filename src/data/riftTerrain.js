// The Rift's floor between the sites: terrain only, spread into the 'rift' island in data/world.js.
// Sites, pads, ways and the Sundering chasm are the shared contract (data/riftLayout.js); this
// file is the ground around them. Leaf module: imports nothing.
//
// Compass: +z is north, +x is WEST.
//
// The keep went down with the land it stood on, and the land broke as it fell: the basin
// rises in shelves of drowned rock, climbs into crags toward its edge and breaks off sheer into
// the void, and where nothing was built the floor is torn by fissures and pushed up into mesas.
// Every feature here keeps 25 m from content (tests/rift-terrain.test.js).
export const RIFT_TERRAIN = {
  // Shelves: the floor steps in terraces this tall (terrain.js `terrace`).
  terrace: 3.5,
  // The floor climbs `h` into crags between normalised distances `from` and `to` (ridged noise
  // scales it between `base` and 1), then drops to the void between `drop[0]` and `drop[1]`.
  rim: { h: 15, from: 0.58, to: 0.88, base: 0.35, drop: [0.9, 0.99] },
  // Stepped mesas: three sheer tiers to `h` above the ground (terrain.js escarpments).
  shelves: [
    { id: 'shelf_south', x: 6080, z: 5826, rx: 26, rz: 16, h: 10 },
    { id: 'shelf_northwest', x: 6172, z: 6136, rx: 16, rz: 20, h: 10 },
    { id: 'shelf_southeast', x: 5846, z: 5842, rx: 20, rz: 24, h: 12 },
    // The Bastion's lobe heaves up toward its mesa, so the chasm is walled high on both sides.
    { id: 'bastion_rise', x: 6262, z: 5965, rx: 72, rz: 66, h: 6, skin: false },
  ],
  // Basalt organs: packed hexagonal columns (world/riftRock.js), `h` metres above the ground at
  // their centre, tallest toward `face` (radians from +x toward +z).
  organs: [
    { id: 'organ_south', x: 6082, z: 5828, r: 8, h: [3, 13], face: Math.PI / 2 },
    { id: 'organ_southeast', x: 5846, z: 5846, r: 9, h: [4, 17], face: -2.4 },
    { id: 'organ_northwest', x: 6174, z: 6138, r: 6, h: [3, 11], face: 0.6 },
    { id: 'organ_rim', x: 5818, z: 5812, r: 7, h: [2, 12], face: -2.2 },
  ],
  // Outer ground between the roof columns, so the open rim has places of its own.
  lobes: [
    { id: 'southeast_shelf', x: 5850, z: 5828, r: 52 },
  ],
  // Fissures: narrower tears in the open floor, pointed at both ends over `taper` metres.
  fissures: [
    { id: 'fissure_southeast', kind: 'fissure', width: 7, taper: 14, points: [[5812, 5888], [5826, 5862], [5850, 5830], [5868, 5800]] },
    // Sinkholes: round drops where the floor fell through, and one bite out of the south rim.
    { id: 'sinkhole_west', kind: 'sinkhole', width: 16, points: [[6160, 6040], [6161, 6041]] },
    { id: 'sinkhole_east', kind: 'sinkhole', width: 14, points: [[5806, 6030], [5807, 6031]] },
    { id: 'rim_bite_south', kind: 'sinkhole', width: 20, points: [[5960, 5780], [5961, 5781]] },
  ],
  // Pads (data/riftLayout.js) that must stand at one height: the Kneeling face each other across
  // their processional. `h` is 'mean' (of their natural heights), 'way' (the road between them)
  // or metres.
  levelled: [
    { pads: ['kneel_sw1', 'kneel_sw2', 'kneel_se1', 'kneel_se2'], h: 'mean' },
    { pads: ['kneel_nw', 'kneel_ne'], h: 'way' },
  ],
  // Standing room the shelves must not break: camps, posts and obelisks that predate them.
  standing: [
    { x: 6136, z: 6088, r: 17 }, { x: 6152, z: 5992, r: 8 }, { x: 5911, z: 5793, r: 6 },
    // the research sites (data/riftResearch.js) and their set pieces
    { x: 5960, z: 5856, r: 12 }, { x: 6070, z: 5900, r: 10 }, { x: 5870, z: 5990, r: 10 },
    { x: 6164, z: 6054, r: 7 }, { x: 5812, z: 6068, r: 7 }, { x: 6130, z: 5998, r: 11 },
    { x: 6130, z: 6013, r: 6 }, { x: 5904, z: 5872, r: 11 }, { x: 5860, z: 5948, r: 12 },
    { x: 5842, z: 5906, r: 7 }, { x: 5828, z: 5893, r: 7 },
  ],
};
