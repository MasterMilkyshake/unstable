// Roaming packs: big beasts that range open country rather than keep a camp (an enemy's
// `roam`, entities/enemy.js roamIdle). Coordinates are FINAL world positions, added after
// data/world.js places its records. Each centre is dry, gentle ground well off the roads,
// away from towns and other camps, clear for the beast's roam round it (tests/world-content).
// A pack's `level` follows the country it ranges.
export const ROAMING_SPAWNERS = [
  { type: 'sharko', x: -525, z: -50, count: 2, radius: 6, respawn: 300, level: 8 }, // the meadows short of Shimmerfen
  { type: 'sharko', x: 1380, z: -290, count: 2, radius: 6, respawn: 300, level: 8 }, // Thornwood's far uplands
  { type: 'sharko', x: 870, z: -665, count: 2, radius: 6, respawn: 300, level: 11 }, // Meridian's lowland
  { type: 'sharko', x: 600, z: -830, count: 2, radius: 6, respawn: 300, level: 11 }, // the woods under the Ashen Spire
  { type: 'sharko', x: -1260, z: 1375, count: 2, radius: 6, respawn: 300, level: 10 }, // Frosthollow's open snow
  { type: 'sharko', x: -105, z: 1405, count: 2, radius: 6, respawn: 300, level: 13 }, // the Verdance's northern floor
];
