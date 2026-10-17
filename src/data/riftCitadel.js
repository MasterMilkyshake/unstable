// The inner citadel: the Ascent's own ring inside the Precincts (data/riftCity.js).
// Its south front is the keep's face over the Gate Plaza (the keep is the citadel's gatehouse:
// its south gate opens on the plaza); its east and west curtains stand on the middle terrace
// with a gate each onto the ward streets, and its north curtain stands on the upper terrace's
// edge, where the processional stair climbs inside it to the north gate. Offsets are from
// (x, z); the wall walk is one level all the way round.
export const RIFT_CITADEL = { x: 6000, z: 5988, halfWidth: 54, front: -16, rear: 54, wallHeight: 24, wallT: 4 };
export const RIFT_CITADEL_GATES = [
  { id: 'east', x: -54, z: 12, yaw: Math.PI / 2, width: 9 },
  { id: 'west', x: 54, z: 12, yaw: Math.PI / 2, width: 9 },
  { id: 'north', x: 0, z: 54, yaw: 0, width: 10 },
];
