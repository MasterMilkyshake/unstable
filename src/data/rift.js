// Rift-only layout: named places, encounters, chests and carvings.
// Kept out of data/world.js so surface placement work can land without colliding.
import { LORE, LORE_BY_ID } from './lore.js';
import { LOCATIONS, SPAWNERS, CHESTS, STRUCTURES } from './world.js';
import { placeCatalog } from './worldPlacement.js';

export const RIFT_ORIGIN = { x: 6000, z: 6000 };

export const RIFT_LANDMARKS = {
  spawn: { x: 6000, z: 5830 },
  citadel: { x: 6000, z: 5988 },
  keep: { x: 5948, z: 6076 },
  lighthouse: { x: 6124, z: 5952 },
  saltreach: { x: 5888, z: 5912 },
  vow: { x: 6078, z: 6118 },
  dock: { x: 6012, z: 5864 },
  crystals: { x: 6096, z: 6034 },
  throne: { x: 6000, z: 6178 },
};

export const RIFT_LOCATIONS = [
  { name: 'The Inverted Citadel', x: 6000, z: 5988, r: 38 },
  { name: 'The Fallen Light', x: 6124, z: 5952, r: 26 },
  { name: 'Sunken Saltreach', x: 5888, z: 5912, r: 30 },
  { name: 'The Shattered Vow', x: 6078, z: 6118, r: 24 },
  { name: 'The Driftwood Shore', x: 6012, z: 5864, r: 22 },
  { name: 'The Crystal Veins', x: 6096, z: 6034, r: 24 },
  // The Ferryman's court on the island's north-east lip, under the north-east relay, with the
  // void beyond: the landing his crossings never reached. Its way up is the south ramp (x 5885–5894).
  { name: 'The Landing That Never Came', x: 5900, z: 6152, r: 34 },
];

// Where the Lanternless keeps his toll, and his boat lies beached in the dry channel below it.
export const FERRYMAN = { x: 5900, z: 6152, boat: { x: 5896, z: 6177, yaw: Math.PI / 2 - 0.12 } };

export const RIFT_SPAWNERS = [
  { type: 'riftling', x: 6124, z: 5952, count: 2, radius: 12, respawn: 100 },
  { type: 'hollow', x: 5888, z: 5912, count: 3, radius: 14, respawn: 90 },
  { type: 'abyssal_watcher', x: 6078, z: 6118, count: 1, radius: 6, respawn: 180 },
  // kept off the way from the arrival shelf to the Ascent's lifts, so a newcomer can walk out:
  // the shelf's hollows by the upended tower's rubble, and the lift landings' old guards east
  { type: 'hollow', x: 6144, z: 5856, count: 2, radius: 10, respawn: 90 },
  { type: 'hollow', x: 5816, z: 5896, count: 2, radius: 8, respawn: 140 },
  { type: 'riftling', x: 5800, z: 6004, count: 2, radius: 8, respawn: 150 },
  { type: 'riftling', x: 6096, z: 6034, count: 2, radius: 12, respawn: 100 },
  { type: 'drowned_knight', x: 6152, z: 5992, count: 1, radius: 8, respawn: 160 },
  { type: 'hollow', x: 5848, z: 6052, count: 2, radius: 10, respawn: 90 },
  { type: 'lanternless', x: FERRYMAN.x, z: FERRYMAN.z, count: 1, radius: 1, respawn: 0, boss: true },
];

export const RIFT_CHESTS = [
  { id: 'c_rift_light', x: 6132, z: 5960, loot: { silver: [0, 0], items: [['rift_shard', 4], ['sanity_draught', 1]] } },
  { id: 'c_rift_shrine', x: 6086, z: 6126, loot: { silver: [0, 0], items: [['mantra_spark', 1], ['sanity_draught', 2]] } },
  { id: 'c_rift_fallen', x: 5880, z: 5918, loot: { silver: [0, 0], weapon: 'rift_blade', items: [['rift_shard', 3]] } },
  // the Ferryman's takings, at the landing's corners
  { id: 'c_landing_east', x: 5876, z: 6160, loot: { silver: [0, 0], weapon: 'drowned_greatsword', items: [['rift_shard', 8], ['mantra_spark', 2]] } },
  { id: 'c_landing_west', x: 5924, z: 6142, loot: { silver: [0, 0], items: [['ember_of_life', 1], ['sanity_draught', 3], ['iron_draught', 2]] } },
];

export const RIFT_LORE = [
  {
    id: 'rift_fallen_light', title: 'The Fallen Light', place: 'The Fallen Light', x: 6116, z: 5944,
    text: 'Gull kept a lamp on the cliff so boats would not become graves. When the sky cracked the lamp came with the cliff. It still burns. It no longer warns anyone. It only proves that light can drown and keep shining.',
  },
  {
    id: 'rift_citadel_above', title: 'The Citadel Above', place: 'The Inverted Citadel', x: 6007.4, z: 5968.4,
    text: 'They built it to hold the chain. When the Duke let go, the citadel did not fall down. It fell up, into the sea\'s underside, and hung there like a thought you cannot finish. Do not look too long. It looks back more kindly than it should.',
  },
  {
    id: 'rift_what_fell', title: 'What Fell', place: 'Sunken Saltreach', x: 5896, z: 5904,
    text: 'A street. A well. The inn\'s east wall and three roofs. We did not sink; the island above us let go of a piece of itself. The plaster still remembers daylight. The people in the plaster do not.',
  },
  {
    id: 'rift_shattered_vow', title: 'The Shattered Vow', place: 'The Shattered Vow', x: 6070, z: 6110,
    text: 'An oath is a shape pressed into a soft soul. Down here the soul is not soft. It is glass. Every vow that fell with a body shattered into a prettier shard. Kneel if you must. Do not swear.',
  },
];

// The surface's generic pieces do not belong in the basin: its glowing obelisks stood where
// the city now has houses. The Rift builds its own monoliths (world/riftMysteries.js).
for (let i = STRUCTURES.length - 1; i >= 0; i--) {
  const s = STRUCTURES[i];
  if (s.x < 3000) continue;
  if (s.type === 'obelisk') STRUCTURES.splice(i, 1);
}

placeCatalog(RIFT_LOCATIONS);
placeCatalog(RIFT_SPAWNERS);
placeCatalog(RIFT_CHESTS);
placeCatalog(RIFT_LORE);

for (const l of RIFT_LOCATIONS) LOCATIONS.push(l);
for (const s of RIFT_SPAWNERS) SPAWNERS.push(s);
for (const c of RIFT_CHESTS) CHESTS.push(c);
for (const l of RIFT_LORE) {
  LORE.push(l);
  LORE_BY_ID[l.id] = l;
}
