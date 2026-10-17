// World layout: islands, named locations, structures, NPC placements,
// enemy spawners, chests, rest points and portals.

import { SALTREACH_STRUCTURES, SALTREACH_PAVED, SALTREACH_SPAWNERS, SALTREACH_NPCS, SALTREACH_LOCATIONS, SALTREACH_CHESTS, SALTREACH_TERRACES, SALTREACH_RAMPS } from './saltreach.js';
import { REGION_STRUCTURES, REGION_LOCATIONS, REGION_FERRY_ROUTES, REGION_SPAWNERS, REGION_NPCS, REGION_CHESTS } from './regions.js';
import { ARCHES_STRUCTURES, ARCHES_LOCATIONS, ARCHES_SPAWNERS, ARCHES_CHESTS, ARCH_SHOALS, ARCH_FOOT, ARCH_MERE, ARCH_ALONG_ROT, GREAT_BRIDGE, archPoint } from './greatBridge.js';
import { HIGHTOLL_ROCK, HIGHTOLL_STRUCTURES, HIGHTOLL_LOCATIONS, HIGHTOLL_SPAWNERS, HIGHTOLL_CHESTS } from './hightoll.js';
import { COASTLINES, coastDistance, coastArea, islandBounds } from './coastlines.js';
import { placeCatalog, regionOffset } from './worldPlacement.js';
import { TIER_CHESTS, TIER_SPAWNERS, TIER_LOCATIONS } from './ledgeSites.js';
import { REGIONAL_BLUFFS } from './landforms.js';
import { RIFT_CITY_FLATS, RIFT_CITY_RAMPS, RIFT_CITY_LOCATIONS, inDrownedPrecincts } from './riftCity.js';
import { MERIDIAN_SHELVES, MERIDIAN_STRUCTURES } from './meridian.js';
import './guards.js'; // faction guard types and items
import { RIFT_LOBES, RIFT_PADS, RIFT_WAYS, RIFT_CHASMS } from './riftLayout.js';
import { RIFT_TERRAIN } from './riftTerrain.js';
import { ROAMING_SPAWNERS } from './roaming.js';
import { hypot } from '../core/util.js';

export const SEA_FLOOR = -18;
export const RIFT_ORIGIN = { x: 6000, z: 6000 };

// Each island keeps its original circle (cx, cz, radius) as the core lobe; `lobes` grow the
// landmass outward, `bays` carve water into it, `zones` give sub-regions their own biome and
// relief (h: height multiplier, sink: lowers ground into a lake). Flats with `h: 'auto'` level
// to the natural ground height at their center. See world/terrain.js.
export const ISLANDS = [
  {
    id: 'saltreach', name: 'Saltreach Coast', cx: 0, cz: 0, radius: 175, maxH: 34, biome: 'meadow', seed: 3, coastAmp: 0.1,
    paved: SALTREACH_PAVED,
    ramps: SALTREACH_RAMPS,
    detailPatches: [{ x: -86, z: -44, x2: 86, z2: 108, subdivisions: 4 }],
    lobes: [{ x: 0, z: -330, r: 92 }, { x: -45, z: -280, r: 88 }, { x: -65, z: -205, r: 85 }, { x: -50, z: -135, r: 78 }, { x: 0, z: 250, r: 330 }, { x: 290, z: 140, r: 170 }, { x: -230, z: 330, r: 180 }, { x: 230, z: 400, r: 170 }],
    bays: [{ x: 25, z: -181, r: 60 }, { x: -247, z: 104, r: 48 }, { x: 478, z: 172, r: 38 }],
    // The bluffs, uplands and shelves are authored in data/landforms.js.
    zones: [
      // The Wash: dune grassland behind the strand, rolling in low shelves with stone risers.
      { x: 0, z: -330, r: 135, biome: 'dunes', h: 0.3, terrace: 2.4 },
      { x: -60, z: -205, r: 110, biome: 'meadow', h: 0.22 },
      { x: -20, z: 235, r: 115, biome: 'farmland', h: 0.35 },
      { x: -205, z: 385, r: 175, biome: 'highland', h: 1.45 },
      { x: 245, z: 405, r: 150, biome: 'forest', h: 1.1 },
    ],
    flats: [
      // Wash camp terrace: smaller core so it reads as worn ground, not a floating slab. It
      // takes the height of the Wash's rise (below) where it stands.
      { x: 0, z: -325, r: 28, h: 'auto', core: 0.36 },
      { x: -65, z: -235, r: 30, h: 5 },
      // the drowned wake on the rise's crown: level ground to stand on and look out from
      { x: -4, z: -346, r: 14, h: 'auto', core: 0.5 },
      // Seamspire Abbey's ground, level under its plinth (world/monuments.js)
      { x: -160, z: -320, r: 34, h: 'auto', core: 0.75 },
      { x: -58, z: -179, r: 30, h: 5 },
      { x: 0, z: 0, r: 112, core: 0.9, h: 4.5 },
      ...SALTREACH_TERRACES,
      { x: 0, z: -118, r: 30, h: 2.4 },
      { x: 42, z: 113, r: 12, h: 24, core: 0.8 }, // the Perch's crown
      { x: -118, z: 62, r: 16, h: 6 },
      { x: 110, z: 8, r: 30, h: 5 },
      { x: -30, z: 238, r: 42, h: 'auto' },
      { x: -210, z: 430, r: 18, h: 'auto' },
      { x: 232, z: 362, r: 32, h: 'auto' },
      { x: 0, z: 515, r: 16, h: 'auto' },
      { x: 414, z: 166, r: 18, h: 3 },
      { x: -8, z: 142, r: 14, h: 'auto' },
    ],
  },
  {
    id: 'thornwood', name: 'Thornwood', cx: 900, cz: 180, radius: 210, maxH: 40, biome: 'forest', seed: 7, coastAmp: 0.12,
    lobes: [{ x: 1130, z: 240, r: 230 }, { x: 1080, z: 400, r: 160 }, { x: 1000, z: -60, r: 200 }],
    zones: [
      { x: 1105, z: 435, r: 150, biome: 'highland', h: 1.6 },
      // Thorn pool: elongated tarn, not a compass circle (shore warps in terrain.zoneWeights).
      { x: 1225, z: 165, r: 62, biome: 'forest', sink: 1, aspect: 1.28 },
    ],
    flats: [
      { x: 789, z: 269, r: 45, h: 5 },
      { x: 755, z: 258, r: 24, h: 2.4 },
      { x: 950, z: 240, r: 48, h: 12 },
      { x: 1000, z: 280, r: 26, h: 12 },
      { x: 830, z: 90, r: 30, h: 'auto' },
      { x: 1050, z: 90, r: 36, h: 'auto' },
      { x: 1150, z: 300, r: 22, h: 'auto' },
      { x: 1100, z: 475, r: 20, h: 'auto' },
    ],
  },
  {
    id: 'shimmerfen', name: 'Shimmerfen', cx: -600, cz: -330, radius: 195, maxH: 9, biome: 'marsh', seed: 19, coastAmp: 0.12,
    lobes: [{ x: -830, z: -360, r: 220 }, { x: -650, z: -570, r: 190 }, { x: -780, z: -130, r: 170 }],
    flats: [
      { x: -481, z: -267, r: 43, h: 3 },
      { x: -448, z: -250, r: 24, h: 1.8 },
      { x: -670, z: -380, r: 18, h: 5.5, core: 0.8 }, // the Outlet's knoll (data/landforms.js)
      { x: -698, z: -328, r: 22, h: 6, core: 0.8 }, // Witchwater's knoll
      { x: -830, z: -330, r: 42, h: 1.6 },
      { x: -760, z: -150, r: 20, h: 'auto' },
      { x: -700, z: -560, r: 26, h: 1.4 },
      // reed islets in the Arch Mere, clear of the line under the spans
      ...[[186, 58, 12, 1.1], [228, 62, 10, 1.0], [268, 50, 9, 0.9]].map(([along, side, r, h]) => {
        const [x, z] = archPoint(along, side);
        return { x, z, r, h };
      }),
      // the camp at the Arches' Foot
      { x: ARCH_FOOT.camp[0], z: ARCH_FOOT.camp[1], r: 15, h: 'auto' },
      ...ARCH_SHOALS,
    ],
    zones: [
      // the channel pool that drowned the Nave Below (data/vistas.js)
      { x: -716, z: -404, r: 34, biome: 'marsh', sink: 1 },
      // The Arch Mere: the low country under the Hundred Arches, drowned to the knee
      // (data/greatBridge.js). Kept clear of the south approach so the Arches' Foot hill
      // can rise onto the deck.
      ...ARCH_MERE.map(({ at: [x, z], r }) => ({ x, z, r, biome: 'marsh', sink: 1, depth: 0.9, aspect: 1.05 })),
    ],
  },
  {
    id: 'frosthollow', name: 'Frosthollow', cx: -700, cz: 900, radius: 205, maxH: 52, biome: 'snow', seed: 23, coastAmp: 0.12,
    lobes: [{ x: -900, z: 1100, r: 260 }, { x: -950, z: 820, r: 200 }, { x: -680, z: 1150, r: 200 }],
    zones: [
      { x: -640, z: 800, r: 125, biome: 'tundra', h: 0.6 },
      { x: -930, z: 1150, r: 190, biome: 'snow', h: 1.6 },
      { x: -965, z: 1045, r: 58, biome: 'snow', sink: 1, aspect: 1.22 },
    ],
    flats: [
      { x: -608, z: 809, r: 50, h: 6 },
      { x: -578, z: 770, r: 24, h: 3 },
      { x: -740, z: 970, r: 34, h: 30 },
      { x: -900, z: 880, r: 36, h: 'auto' },
      { x: -810, z: 1010, r: 14, h: 'auto' },
    ],
  },
  {
    // The furnace at the end of Meridian's coast. Its woods (emberwood) grew back on the ash of
    // old eruptions and run on into Meridian's; the cone above them is still bare ash, and the
    // lava fields on its western flank are only half grown over. The woods ring the cone and
    // the fields rather than covering them (`ground`, joinCoasts below), so every system that
    // reads a biome agrees where the ash begins.
    id: 'ashen_spire', name: 'Ashen Spire', cx: 760, cz: 880, radius: 195, maxH: 68, biome: 'emberwood', seed: 31, coastAmp: 0.12,
    // the last lobe is the Emberwood, the wooded saddle that joins it to Meridian
    lobes: [{ x: 960, z: 1000, r: 220 }, { x: 820, z: 1130, r: 190 }, { x: 980, z: 760, r: 170 }, { x: 1210, z: 1110, r: 170 }],
    zones: [
      { x: 762, z: 882, r: 230, biome: 'volcanic' },
      { x: 1075, z: 1040, r: 175, biome: 'ashfield' },
    ],
    // the north shore, the Emberwood saddle, the south shore, Cinderstead's point, the north-east bay
    ground: [
      { x: 840, z: 1150, r: 190, biome: 'emberwood' },
      { x: 1250, z: 1120, r: 200, biome: 'emberwood' },
      { x: 960, z: 750, r: 170, biome: 'emberwood' },
      { x: 650, z: 750, r: 140, biome: 'emberwood' },
      { x: 710, z: 1040, r: 105, biome: 'emberwood' },
    ],
    flats: [
      { x: 679, z: 749, r: 45, h: 5 },
      { x: 642, z: 762, r: 24, h: 3 },
      { x: 760, z: 880, r: 34, h: 36 },
      { x: 985, z: 770, r: 30, h: 'auto' },
      { x: 860, z: 1100, r: 26, h: 'auto' },
    ],
  },
  {
    id: 'verdance', name: 'The Verdance', cx: 20, cz: 1000, radius: 150, maxH: 40, biome: 'jungle', seed: 47, coastAmp: 0.12,
    lobes: [{ x: 20, z: 1230, r: 230 }, { x: -170, z: 1110, r: 170 }, { x: 220, z: 1120, r: 180 }],
    flats: [
      { x: 10, z: 912, r: 44, h: 5 },
      { x: 22, z: 888, r: 24, h: 2.6 },
      { x: 95, z: 990, r: 26, h: 10 },
      { x: 30, z: 1080, r: 34, h: 16 },
      { x: -60, z: 980, r: 22, h: 1.6 },
      { x: 20, z: 1290, r: 30, h: 'auto' },
      { x: 225, z: 1175, r: 26, h: 'auto' },
    ],
  },
  {
    id: 'meridian', name: 'Meridian', cx: 760, cz: -560, radius: 240, maxH: 36, biome: 'bastion', seed: 53, coastAmp: 0.1,
    detailPatches: [{ x: 640, z: -735, x2: 990, z2: -480, subdivisions: 4 }],
    lobes: [{ x: 960, z: -650, r: 180 }],
    bays: [{ x: 832, z: -808, r: 48 }],
    zones: [{ x: 985, z: -640, r: 150, biome: 'highland', h: 1.4 }],
    flats: [
      ...MERIDIAN_SHELVES,
      { x: 942, z: -584, r: 13, core: 0.85, h: 16 },
      { x: 580, z: -292, r: 26, h: 2.4 }, // the port's quay
      { x: 680, z: -488, r: 34, h: 'auto' },
      { x: 818, z: -748, r: 30, h: 2.2 },
      // the Signal Bridge's two bridgeheads, held level just under its deck (46.2)
      { x: 897, z: -660, r: 11, h: 46, core: 0.88 },
      { x: 943, z: -660, r: 12, h: 46, core: 0.88 },
    ],
  },
  {
    // radius spans the outline (it runs far to the east of the landing's centre)
    id: 'the_hush', name: 'The Hush', cx: -900, cz: 360, radius: 330, maxH: 50, biome: 'hush', seed: 61, coastAmp: 0.12,
    // the Sounding Way's flights climb through this cut in the summit's rock
    ramps: [{ x: -884, z: 402, x2: -932, z2: 392, w: 5, y: 17, y2: 34 }],
    lobes: [{ x: -1090, z: 300, r: 180 }, { x: -960, z: 520, r: 150 }],
    flats: [
      { x: -960, z: 380, r: 46, h: 34 },
      { x: -980, z: 408, r: 14, h: 34, core: 0.8 }, // the Quiet Archive, level with the court
      { x: -726, z: 358, r: 22, h: 2.4 },
      { x: -880, z: 262, r: 30, h: 'auto' },
      { x: -1085, z: 425, r: 18, h: 'auto' },
    ],
  },
  // The islets are knuckles of rock, not discs: lobed outlines whose shore wanders on a short
  // grain (`coastDetail`), rimmed with skerries (data/landforms.js).
  { id: 'anchor_rock', res: 1.4, name: "The Anchor's Fall", cx: 0, cz: 700, radius: 38, maxH: 5, biome: 'rock', seed: 71, coastAmp: 0.14, coastDetail: 0.9,
    lobes: [{ x: 24, z: 712, r: 20 }, { x: -20, z: 686, r: 18 }, { x: -6, z: 730, r: 14 }], flats: [{ x: 0, z: 700, r: 22, h: 2 }] },
  { id: 'gallows_rock', res: 1.4, name: 'Gallows Rock', cx: 420, cz: -330, radius: 42, maxH: 14, biome: 'rock', seed: 73, coastAmp: 0.14, coastDetail: 0.9,
    lobes: [{ x: 448, z: -318, r: 20 }, { x: 398, z: -354, r: 18 }], flats: [{ x: 420, z: -330, r: 16, h: 9 }] },
  { id: 'saint_ebb', res: 1.4, name: "Saint Ebb's Light", cx: -320, cz: -620, radius: 36, maxH: 10, biome: 'rock', seed: 79, coastAmp: 0.14, coastDetail: 0.9,
    lobes: [{ x: -296, z: -630, r: 16 }, { x: -340, z: -602, r: 15 }], flats: [{ x: -320, z: -620, r: 14, h: 6 }] },
  { id: 'gulls_reach', res: 1.4, name: "Wreck of the Gull's Reach", cx: 160, cz: -360, radius: 34, maxH: 2.5, biome: 'beach', seed: 83, coastAmp: 0.14, coastDetail: 0.8,
    lobes: [{ x: 186, z: -374, r: 14 }, { x: 138, z: -346, r: 16 }] },
  {
    id: 'rift', name: 'The Rift', cx: 6000, cz: 6000, radius: 240, maxH: 26, biome: 'rift', seed: 66,
    detailPatches: [{ x: 5890, z: 5920, x2: 6110, z2: 6060, subdivisions: 3 }],
    ramps: RIFT_CITY_RAMPS,
    // The keep's ground (data/riftLayout.js): lobes for the outer sites, the castles' pads, the
    // processional ways and the chasm that cuts the Bastion off. See world/terrain.js.
    lobes: [...RIFT_LOBES, ...RIFT_TERRAIN.lobes].map(({ x, z, r }) => ({ x, z, r })),
    // The floor between the sites (data/riftTerrain.js): shelves, rim crags, mesas, fissures.
    terrace: RIFT_TERRAIN.terrace,
    rim: RIFT_TERRAIN.rim,
    escarpments: RIFT_TERRAIN.shelves.map(({ x, z, rx, rz, h }) => ({ x, z, rx, rz, h })),
    levelled: RIFT_TERRAIN.levelled,
    pads: Object.entries(RIFT_PADS).map(([id, p]) => ({ id, ...p })),
    ways: RIFT_WAYS,
    chasms: [...RIFT_CHASMS, ...RIFT_TERRAIN.fissures],
    flats: [
      { x: 6000, z: 5830, r: 26, h: 6 },
      ...RIFT_CITY_FLATS,
      // the Crystal Veins keep their basin at the middle ward's level, cut into the upper riser
      { x: 6096, z: 6032, r: 10, h: 10.6, core: 0.7 },
      // the Ascent's plaza; level at the old centre height so every tier keeps its height
      { x: 6000, z: 5988, r: 40, h: 10.6, core: 0.62 },
      { x: 6160, z: 6000, r: 14, h: 8 },
      { x: 5840, z: 6060, r: 14, h: 8 },
      // standing room for places that predate the castles (the Precincts' wards level their own)
      ...[
        { x: 5908, z: 5968, r: 13, h: 'auto', core: 0.7 },
        { x: 5960, z: 5960, r: 9, h: 'auto' },
        { x: 5848, z: 6052, r: 8, h: 'auto' },
        { x: 6060, z: 6052, r: 8, h: 'auto' },
        { x: 6090, z: 6090, r: 7, h: 'auto' },
        { x: 6022, z: 5921, r: 6, h: 'auto' },
        // the Shattered Vow, in the low court between the Precincts' upper ward and the crags
        { x: 6080, z: 6122, r: 14, h: 7.1, core: 0.8 },
        ...RIFT_TERRAIN.standing.map(({ x, z, r }) => ({ x, z, r, h: 'auto', core: 0.7 })),
      ].filter((f) => !inDrownedPrecincts(f.x, f.z)),
    ],
  },
];

for (const island of ISLANDS) {
  if (REGIONAL_BLUFFS[island.id]) island.escarpments = REGIONAL_BLUFFS[island.id];
}

// Regions remain distinct for discovery and lore even when they share a coast.
export const REGIONS = structuredClone(ISLANDS);
// Ground the coasts gained since the regions were drawn (data/coastlines.js): Meridian's
// silted harbour and its port, and the Ashen Spire's woods north to the Ember Head. Only the
// regions take these, so the land's biomes stay as they were grown.
REGIONS.find(r => r.id === 'meridian').lobes.push({ x: 540, z: -400, r: 150 });
REGIONS.find(r => r.id === 'ashen_spire').lobes.push({ x: 1010, z: 1500, r: 210 });
// A region joins its root's landmass. Its records are authored in its own frame; world
// placement moves the joined island by the root's offset, so a region placed apart from its
// root (data/worldPlacement.js) is first carried into the root's frame. Optional `zones`
// replace the biome ground grown from its lobes (the Hush's moor on Frosthollow).
function joinCoasts(rootId, regionId, { zones } = {}) {
  const root = ISLANDS.find(i => i.id === rootId);
  const region = ISLANDS.find(i => i.id === regionId);
  const [rx, rz] = regionOffset(root.cx, root.cz), [gx, gz] = regionOffset(region.cx, region.cz);
  const dx = gx - rx, dz = gz - rz;
  // shared records (Meridian's shelves) must stay the same objects, so only copy to move
  const shift = (points) => points && points.map(([px, pz]) => [px + dx, pz + dz]);
  const carry = (records = []) => !dx && !dz ? records : records.map(r => ({ ...r, x: r.x + dx, z: r.z + dz,
    ...(Number.isFinite(r.x2) ? { x2: r.x2 + dx, z2: r.z2 + dz } : {}),
    ...(r.outline ? { outline: shift(r.outline) } : {}), ...(r.front ? { front: shift(r.front) } : {}) }));
  const lobes = carry([{ x: region.cx, z: region.cz, r: region.radius }, ...(region.lobes || [])]);
  root.lobes.push(...lobes);
  root.bays = [...(root.bays || []), ...carry(region.bays)];
  root.flats.push(...carry(region.flats));
  const scale = region.maxH / root.maxH;
  // the region's own ground: over its lobes, unless it says where (`ground`) or the join
  // supplies `zones` (authored like the region's own, without biome — we fill that in)
  const ground = zones
    ? carry(zones).map(z => ({ biome: region.biome, ...z, h: (z.h ?? 1) * scale }))
    : region.ground ? carry(region.ground).map(z => ({ ...z, h: scale }))
    : lobes.map(l => ({ ...l, r: l.r * 1.7, biome: region.biome, h: scale }));
  const own = carry(region.zones).map(z => ({ ...z, h: (z.h ?? 1) * scale }));
  root.zones.push(...ground, ...own);
  root.escarpments = [...(root.escarpments || []), ...carry(region.escarpments)];
  root.rises = [...(root.rises || []), ...carry(region.rises)];
  root.ramps = [...(root.ramps || []), ...carry(region.ramps)];
  root.detailPatches = [...(root.detailPatches || []), ...carry(region.detailPatches)];
  ISLANDS.splice(ISLANDS.indexOf(region), 1);
}
joinCoasts('saltreach', 'shimmerfen');
joinCoasts('thornwood', 'meridian');
joinCoasts('thornwood', 'ashen_spire');
// The Hush's moor runs up into Frosthollow's snow over its old north shore: furthest along the
// sheltered east coast, least by the harbour, through a band of tundra rather than at a line.
joinCoasts('frosthollow', 'the_hush', { zones: [
  { x: -820, z: 320, r: 240 },
  { x: -1000, z: 340, r: 250 },
  { x: -1180, z: 360, r: 230 },
  { x: -880, z: 200, r: 200 },
  { x: -1090, z: 220, r: 210 },
  { x: -1290, z: 440, r: 170 },
  { x: -1260, z: 590, r: 180 },
  { x: -1030, z: 500, r: 140 },
] });
// placed after the moor so it only takes the moor's ragged edge (Frosthollow's frame)
ISLANDS.find(i => i.id === 'frosthollow').zones.push(
  { x: -750, z: 740, r: 90, biome: 'tundra', h: 0.7 },
  { x: -880, z: 810, r: 110, biome: 'tundra', h: 0.8 },
  { x: -1100, z: 880, r: 120, biome: 'tundra', h: 0.8 },
  { x: -1300, z: 970, r: 120, biome: 'tundra', h: 0.7 },
);
for (const island of ISLANDS) {
  if (!COASTLINES[island.id]) continue;
  island.outline = COASTLINES[island.id];
  island.coastAmp = 0.025;
}
ISLANDS.find(i => i.id === 'saltreach').name = 'Saltreach & Shimmerfen';
const thornCoast = ISLANDS.find(i => i.id === 'thornwood');
thornCoast.name = 'Thornwood, Meridian & the Ashen Spire';
// The continent keeps the 3.5 m grid Thornwood and Meridian were built on, instead of
// coarsening to fit the default cell budget (world/terrain.js).
thornCoast.maxCells = 310000;
ISLANDS.find(i => i.id === 'frosthollow').name = 'Frosthollow & the Hush';
// Inlets are part of the coast rather than round holes cut into the land.
for (const island of ISLANDS) if (island.outline) island.bays = [];
const saltCoast = ISLANDS.find(i => i.id === 'saltreach');


saltCoast.rises = [
  ...(saltCoast.rises || []),
  // The Wash: the dunes the drowned wake on, heaped into a rise behind the strand, so the first
  // thing seen from the camp is the bay, the Arch Mere and the Hundred Arches below. It falls
  // to the strand on the sea sides and dies out before the abbey's steps.
  { x: -8, z: -334, rx: 100, rz: 60, h: 12, sharp: 0.85 },
  // The Arches' Foot: a sudden green hill that climbs the fallen south spans onto the road,
  // so the approach is land meeting the deck rather than a stone ramp on stilts. The north
  // face drops off quickly so the standing spans still rise from the Arch Mere.
  // its length grows with the deck's height, so the climb keeps the same grade
  { x: ARCH_FOOT.rise[0], z: ARCH_FOOT.rise[1], rx: 64 * GREAT_BRIDGE.deck / 60, rz: 126 * GREAT_BRIDGE.deck / 60, h: GREAT_BRIDGE.deck, sharp: 1.35, rot: ARCH_ALONG_ROT },
];
// Lock the crown to deck height so the walk steps onto the road without a lip.
saltCoast.flats.push({ x: ARCH_FOOT.crown[0], z: ARCH_FOOT.crown[1], r: 12, h: GREAT_BRIDGE.deck, core: 0.45 });
// Hightoll Rock: the castle's crown, dead level at the court's height (data/hightoll.js).
saltCoast.flats.push(HIGHTOLL_ROCK);

export function regionAtPoint(x, z) {
  let result = null, distance = 0.94;
  for (const region of REGIONS) {
    const d = islandDist(region, x, z);
    if (d < distance) { result = region; distance = d; }
  }
  return result;
}
// A district inside a region keeps its own Atlas page, music and ambience (the Wash, on the
// Saltreach coast); elsewhere the region sets the mood.
export function districtAtPoint(x, z) {
  return EXPLORATION_DISTRICTS.find(d => hypot(x - d.x, z - d.z) < d.r) || null;
}
export function moodRegionAt(x, z) {
  return districtAtPoint(x, z) || regionAtPoint(x, z);
}
// What dry ground outside every named location is called: the surface region nearest it by
// its own size, so the land between named places never reads as the open sea.
export function landNameAt(x, z) {
  let best = null, bd = Infinity;
  for (const region of REGIONS) {
    if (region.cx > 3000) continue;
    const d = islandDist(region, x, z);
    if (d < bd) { best = region; bd = d; }
  }
  return best ? best.name : null;
}

export const BIOME_MOOD = {
  beach: 'calm', meadow: 'calm', forest: 'wild', emberwood: 'wild', marsh: 'wild', snow: 'cold', volcanic: 'ash', rift: 'rift', jungle: 'wild',
  farmland: 'calm', highland: 'wild', tundra: 'cold', ashfield: 'ash', bastion: 'cold', hush: 'cold', rock: 'calm',
};

// Normalized distance from an island's landmass: < ~0.88 is land, 1 is open water.
// Smooth union of the core circle and its lobes, pushed outward inside bays.
export function islandDist(isl, x, z) {
  if (isl.outline) return Math.max(0.05, 0.88 + coastDistance(isl.outline, x, z) / 180);
  let d = hypot(x - isl.cx, z - isl.cz) / isl.radius;
  for (const l of isl.lobes || []) {
    const dl = hypot(x - l.x, z - l.z) / l.r;
    const k = 0.12;
    const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (dl - d)) / k));
    d = dl * (1 - h) + d * h - k * h * (1 - h); // smooth min
  }
  for (const b of isl.bays || []) {
    const t = hypot(x - b.x, z - b.z) / b.r;
    if (t < 1.05) {
      const w = Math.min(1, Math.max(0, (1.05 - t) / 0.5));
      d = Math.max(d, 0.8 + 0.5 * w * w * (3 - 2 * w));
    }
  }
  return d;
}

// The surface island whose landmass contains (x, z), with its normalized distance.
export function islandAtPoint(x, z, maxD = 1.25) {
  let best = null;
  let bd = maxD;
  for (const i of ISLANDS) {
    if (i.cx > 3000 !== x > 3000) continue;
    const d = islandDist(i, x, z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best ? { island: best, d: bd } : null;
}

export const EXPLORATION_DISTRICTS = [{ id: 'the_wash', x: 0, z: -330, r: 110 }];

// Named sub-areas (smallest containing radius wins for the banner).
export const LOCATIONS = [
  ...RIFT_CITY_LOCATIONS,
  { name: 'The Wash', x: 0, z: -330, r: 110 },
  { name: 'Saltreach', x: 0, z: 0, r: 210 },
  { name: 'Watch Barracks', x: -36, z: -32, r: 17 },
  { name: 'The Salted Anchor', x: -30, z: 20, r: 11 },
  { name: 'Rook’s Landing', x: 787, z: 268, r: 36 },
  { name: 'Reedbank Village', x: -480, z: -266, r: 38 },
  { name: 'White Pass', x: -683, z: 882, r: 28 },
  { name: 'Frostwatch Village', x: -609, z: 812, r: 40 },
  { name: 'Cinderstead', x: 681, z: 754, r: 34 },
  { name: 'Canopy Landing', x: 5, z: 909, r: 32 },
  { name: 'Meridian Garrison', x: 790, z: -554, r: 64 },
  { name: 'Saltreach Town', x: 0, z: 0, r: 72 },
  { name: 'Saltreach Docks', x: 0, z: -135, r: 40 },
  { name: "Vowkeeper's Perch", x: 42, z: 112, r: 20 },
  { name: 'Old Lighthouse', x: -118, z: 62, r: 22 },
  { name: 'The Crucible', x: 120, z: 8, r: 28 },
  { name: 'Thornwood', x: 900, z: 180, r: 250 },
  { name: 'Brigand Hold', x: 960, z: 250, r: 70 },
  { name: 'Owlroost Hollow', x: 830, z: 90, r: 45 },
  { name: 'Shimmerfen', x: -600, z: -330, r: 235 },
  { name: "Moss's Landing", x: -448, z: -250, r: 30 },
  { name: 'Sunken Shrine', x: -670, z: -380, r: 28 },
  { name: 'Frosthollow', x: -700, z: 900, r: 245 },
  { name: "Hunter's Camp", x: -578, z: 770, r: 30 },
  { name: 'The White Hollow', x: -740, z: 970, r: 40 },
  { name: 'Ashen Spire', x: 760, z: 880, r: 235 },
  { name: 'Cinder Camp', x: 642, z: 762, r: 30 },
  { name: 'The Caldera', x: 760, z: 880, r: 38 },
  { name: 'Witchwater', x: -680, z: -325, r: 48 },
  { name: "Mother's Mire", x: -600, z: -290, r: 24 },
  { name: 'The Pale Slopes', x: -715, z: 900, r: 62 },
  { name: 'Zealot Rise', x: 730, z: 960, r: 34 },
  { name: 'The Emberwood', x: 1190, z: 1080, r: 160 },
  { name: 'The Verdance', x: 20, z: 1000, r: 200 },
  { name: 'Vinewatch Camp', x: 22, z: 886, r: 28 },
  { name: 'Mossbound Hollow', x: 95, z: 990, r: 34 },
  { name: 'Kingsfall', x: 30, z: 1080, r: 38 },
  { name: 'The Bone Pit', x: -60, z: 980, r: 26 },
  { name: 'The Rift', x: 6000, z: 6000, r: 400 },
  { name: 'The Drowned Keep', x: 5950, z: 6075, r: 40 },
  { name: 'Throne of the Drowned', x: 6000, z: 6150, r: 45 },
  ...REGION_LOCATIONS,
  ...SALTREACH_LOCATIONS,
  ...ARCHES_LOCATIONS,
  ...HIGHTOLL_LOCATIONS,
];

// Structures: positions are absolute; y is computed from terrain.
export const STRUCTURES = [
  // ---- The Wash ----
  { type: 'shipwreck', x: 22, z: -370, rot: 0.6 },
  { type: 'campfire', id: 'cf_wash', x: 0, z: -320, name: 'The Wash' },
  { type: 'well', id: 'well_wash', x: -8, z: -328 },
  { type: 'dummy', x: 13.5, z: -336 }, // clear of the Rigging Tower's stair (x 9.1 to 10.6, z -345 to -334), which it stood under
  { type: 'crates', x: -8, z: -312 },
  // ---- Saltreach Town ----
  { type: 'well', id: 'well_salt', x: -11, z: 2 },
  { type: 'inn', name: 'The Salted Anchor', restId: 'inn_salt', x: -30, z: 20, rot: Math.PI / 2, w: 16, d: 11 },
  { type: 'smithy', x: 30, z: 18, rot: -Math.PI / 2, w: 12, d: 10 },
  { type: 'stall', x: -14, z: -14, rot: 0 },
  { type: 'stall', x: 14, z: -14, rot: 0 },
  { type: 'tower', x: 40, z: 49, r: 6, h: 22, rot: Math.PI },
  { type: 'barracks', x: -40, z: -26, rot: Math.PI / 2, w: 14, d: 10 },
  { type: 'house', x: 30, z: -32, rot: -Math.PI / 2, w: 10, d: 9 },
  { type: 'house', x: 15, z: 90, rot: -Math.PI / 2, w: 9, d: 8 },
  { type: 'house', x: -52, z: 6, rot: Math.PI / 2, w: 8, d: 8 },
  { type: 'house', x: 54, z: -6, rot: -Math.PI / 2, w: 9, d: 8 },
  { type: 'house', x: 16, z: 104, rot: -Math.PI / 2, w: 8, d: 9 },
  { type: 'house', x: 52, z: 22, rot: -Math.PI / 2, w: 8, d: 7 },
  // Smaller homes crowd the inside of the fortifications, leaving the market,
  // trainers and the four gate approaches clear.
  { type: 'house', x: -22, z: -51, rot: Math.PI / 2 + 0.12, w: 9, d: 8, low: true },
  { type: 'house', x: 19, z: -49, rot: -Math.PI / 2 - 0.08, w: 8, d: 8, low: true },
  { type: 'house', x: -58, z: -22, rot: Math.PI / 2, w: 9, d: 8 },
  { type: 'house', x: 40, z: 89, rot: Math.PI, w: 10, d: 8, low: true },
  { type: 'house', x: -10, z: 108, rot: Math.PI / 2, w: 9, d: 9 },
  { type: 'house', x: 59, z: 43, rot: -Math.PI / 2, w: 9, d: 8, low: true },
  { type: 'house', x: 56, z: -36, rot: -Math.PI / 2 - 0.1, w: 9, d: 8 },
  { type: 'altar', id: 'mantra_altar', x: 0, z: 52 },
  { type: 'board', id: 'notice', x: 8, z: -2, rot: 0 },
  { type: 'order_shrine', id: 'order_shrine', x: -6, z: 42 },
  { type: 'arena', id: 'crucible', x: 120, z: 8, r: 18, gapYaw: -Math.PI / 2 },
  { type: 'stall', x: 24, z: -8, rot: 0 },
  { type: 'dummy', x: -27, z: -40 },
  { type: 'dummy', x: -23, z: -44 },
  { type: 'dummy', x: -18, z: -40 },
  { type: 'bell', x: -6, z: 26 },
  { type: 'lamp', x: 10, z: 12 }, { type: 'lamp', x: -10, z: 12 }, { type: 'lamp', x: 10, z: -20 }, { type: 'lamp', x: -10, z: -20 },
  { type: 'lamp', x: 0, z: -60 }, { type: 'lamp', x: 0, z: -90 },
  { type: 'dock', id: 'dock_salt', x: 0, z: -132, len: 46, rot: 0 },
  // the Vowkeeper's Perch: a revetted podium over the knoll by the north wall, between the
  // wall towers at (27,121) and (57,118), its stair down to the North Way at z 112
  { type: 'shrine', name: "Vowkeeper's Perch", x: 42, z: 107, top: 24,
    podium: { x0: 27.5, x1: 56.5, z0: 97.5, z1: 119.2 }, eastEnd: 116.2, westEnd: 113.2, stair: 112 },
  { type: 'lighthouse', name: 'Old Lighthouse', x: -120, z: 64, lit: true },
  { type: 'crates', x: 6, z: -118 },
  { type: 'crates', x: -7, z: -112 },
  { type: 'fence', x: -15, z: -40, len: 10, rot: Math.PI / 2 },
  // ---- Thornwood ----
  { type: 'dock', id: 'dock_thorn', x: 744, z: 264, len: 26, rot: -Math.PI / 2 - 0.45 },
  { type: 'campfire', id: 'cf_thorn', x: 760, z: 254, name: 'Thornwood Landing' },
  { type: 'well', id: 'well_thorn', x: 766, z: 262 },
  // Brigand Hold: elongated stockade turned off the road axis, not a round fence.
  // the stockade, its gates, the Retained Shiphouse and the crews' tents are one landmark
  // (data/architecture.js redwake_hall); the Sail Loft stands by the hall's stern
  { type: 'warehouse', name: 'The Sail Loft', x: 994, z: 230, rot: -Math.PI / 2, w: 12, d: 8, palette: 'redwake' },
  { type: 'campfire', id: 'cf_brigand', x: 958, z: 246, name: null, hostile: true },
  { type: 'banner', x: 1000, z: 280 }, { type: 'banner', x: 988, z: 290 },
  { type: 'ruins', x: 830, z: 90 },
  // ---- Shimmerfen ----
  // Moss's hut faces the landing fire. The fen keeps no port: its outlet silted up, and
  // Saltreach's harbour is an hour's walk down the Reed Road
  { type: 'hut', x: -457, z: -254, rot: 1.9 },
  { type: 'campfire', id: 'cf_fen', x: -444, z: -258, name: "Moss's Landing" },
  // the Sunken Shrine is part of the Covenant's outlet (data/architecture.js reed_outlet);
  // a warden keeps a hut on the knoll's south shoulder
  { type: 'hut', x: -656, z: -393, rot: 0 },
  { type: 'ruins', x: -700, z: -332 },
  { type: 'banner', x: -686, z: -316 }, { type: 'banner', x: -712, z: -340 },
  // the Bog Mother's wallow below the broken outfall whose warm discharge she breeds in, the
  // Covenant's hide and feeding stage round it (world/sites.js); faces the outfall
  { type: 'mothers_mire', name: "Mother's Mire", x: -600, z: -290, x2: -621, z2: -266 },
  // ---- Frosthollow ----
  { type: 'dock', id: 'dock_frost', x: -566, z: 760, len: 24, rot: Math.PI / 2 - 0.8 },
  { type: 'tent', x: -586, z: 774, rot: 1.2, color: '#d8e4ee' },
  { type: 'campfire', id: 'cf_frost', x: -578, z: 766, name: "Hunter's Camp" },
  { type: 'well', id: 'well_frost', x: -572, z: 776, spring: true },
  { type: 'ice_arena', x: -740, z: 970, r: 26 },
  // ---- Ashen Spire ----
  { type: 'dock', id: 'dock_ash', x: 630, z: 752, len: 24, rot: -Math.PI / 2 + 0.78 },
  { type: 'tent', x: 650, z: 770, rot: -0.8, color: '#5a4a40' },
  { type: 'campfire', id: 'cf_ash', x: 642, z: 760, name: 'Cinder Camp' },
  { type: 'well', id: 'well_ash', x: 636, z: 768, spring: true },
  { type: 'lava', x: 760, z: 880, r: 9 },
  // ---- The Verdance ----
  { type: 'dock', id: 'dock_verd', x: 18, z: 872, len: 26, rot: 0 },
  { type: 'campfire', id: 'cf_verd', x: 24, z: 888, name: 'Vinewatch Camp' },
  { type: 'well', id: 'well_verd', x: 32, z: 892, spring: true },
  { type: 'tent', x: 12, z: 894, rot: 0.6, color: '#4a6a3a' },
  { type: 'tent', x: 34, z: 900, rot: -0.5, color: '#5a5a3a' },
  { type: 'hut', x: 86, z: 982, rot: 0.4 },
  { type: 'hut', x: 104, z: 998, rot: -2.2 },
  { type: 'hut', x: 90, z: 1004, rot: 2.8 },
  { type: 'campfire', id: 'cf_moss', x: 96, z: 990, name: null, hostile: true },
  { type: 'banner', x: 110, z: 982 }, { type: 'banner', x: 80, z: 996 },
  { type: 'ruins', x: 30, z: 1080 },
  { type: 'ruins', x: -60, z: 980 },
  // ---- Regional settlements: inhabited ports, each with shelter and work ----
  { type: 'inn', name: 'The Rookery', restId: 'inn_thorn', x: 788, z: 257, rot: -Math.PI / 2, w: 13, d: 10, palette: 'redwake' },
  { type: 'house', x: 781, z: 281, rot: Math.PI, w: 10, d: 8, palette: 'redwake' },
  { type: 'house', x: 805, z: 278, rot: -Math.PI / 2, w: 10, d: 8, palette: 'redwake' },
  { type: 'crates', x: 793, z: 273 },
  { type: 'stall', x: 773, z: 269, rot: Math.PI / 2, palette: 'redwake' },
  { type: 'inn', name: 'The Reed Lantern', restId: 'inn_fen', x: -482, z: -272, rot: Math.PI / 2, w: 10, d: 8.5, palette: 'reed' },
  { type: 'house', x: -478, z: -248, rot: Math.PI, w: 9, d: 8, palette: 'reed', low: true },
  { type: 'house', x: -501, z: -261, rot: Math.PI / 2, w: 9, d: 8, palette: 'reed', low: true },
  { type: 'stall', x: -465, z: -264, rot: Math.PI / 2, palette: 'reed' },
  { type: 'crates', x: -466, z: -279 },
  // Reedbank grows along the waterline: fen houses on piles, a boardwalk from the landing to
  // the fisher's house in the shallows, racks for the nets and the Covenant's effigy poles
  // where the Reed Road enters and leaves (world/fenArchitecture.js).
  { type: 'house', x: -462, z: -239, rot: Math.PI, w: 8, d: 7, palette: 'reed', low: true },
  { type: 'house', x: -490, z: -241, rot: Math.PI, w: 9, d: 7, palette: 'reed', low: true },
  { type: 'house', x: -448, z: -281, rot: -Math.PI / 2, w: 8, d: 7, palette: 'reed', low: true },
  { type: 'house', x: -436, z: -293, rot: -Math.PI / 2, w: 7, d: 6, palette: 'reed', low: true },
  { type: 'boardwalk', points: [[-437, -252], [-436, -266], [-438, -279], [-437, -289]], w: 2.2 },
  { type: 'net_rack', x: -470, z: -233, rot: 0.3, len: 5 },
  { type: 'net_rack', x: -449, z: -268, rot: Math.PI / 2, len: 4 },
  { type: 'effigy_pole', x: -505, z: -236 },
  { type: 'effigy_pole', x: -470, z: -302 },
  { type: 'stilt_lookout', x: -508, z: -284, rot: -Math.PI / 2, h: 8 },
  // the haven's edge: logs round the landing fire, and the lantern kept lit for whoever is
  // still out in the fen (its notice is in data/lore.js)
  { type: 'fire_seats', x: -444, z: -258 },
  { type: 'last_lantern', name: 'The Last Lantern', x: -516, z: -264, rot: Math.PI / 2 },
  { type: 'inn', name: 'The White Hearth', restId: 'inn_frost', x: -605, z: 818, rot: Math.PI, w: 14, d: 11, palette: 'frost' },
  { type: 'house', x: -625, z: 801, rot: Math.PI / 2, w: 10, d: 8, palette: 'frost' },
  { type: 'house', x: -584, z: 812, rot: -Math.PI / 2, w: 9, d: 8, palette: 'frost' },
  { type: 'smithy', x: -629, z: 827, rot: Math.PI / 2, w: 10, d: 9, palette: 'frost' },
  { type: 'stall', x: -595, z: 801, rot: Math.PI, palette: 'frost' },
  // Cinderstead: one kerbed street from the Cinder Camp landing to the square where the
  // Attendants Road leaves for the furnace, every house facing it
  { type: 'street', x: 668, z: 752, palette: 'cinder', points: [[-16, 0.5], [0, 0], [16, 0], [20, 4.5]], w: 4.4 },
  { type: 'inn', name: 'The Cinder Rest', restId: 'inn_ash', x: 679, z: 744, rot: 0, w: 12, d: 10, palette: 'cinder' },
  { type: 'house', name: "Slag Carter's House", x: 664.5, z: 745, rot: 0, w: 9, d: 8, palette: 'cinder', low: true },
  { type: 'warehouse', name: 'The Ash Store', x: 697, z: 745, rot: 0, w: 10, d: 8, palette: 'cinder' },
  { type: 'house', x: 675, z: 760, rot: Math.PI, w: 10, d: 8, palette: 'cinder', low: true },
  { type: 'house', name: "Pumice Cutter's House", x: 662, z: 759.5, rot: Math.PI, w: 9, d: 8, palette: 'cinder', low: true },
  { type: 'smithy', x: 701, z: 760, rot: Math.PI, w: 12, d: 10, palette: 'cinder' },
  { type: 'well', id: 'well_cinderstead', x: 688.5, z: 748.4, palette: 'cinder' },
  ...[[655, 749.5], [668.3, 755.3], [671, 749.2], [683, 755.4], [693.2, 755.6]].map(([x, z]) => ({ type: 'lamp', x, z, palette: 'cinder' })),
  { type: 'crates', x: 700.5, z: 750.2 },
  { type: 'inn', name: 'The Canopy House', restId: 'inn_verd', x: 2, z: 912, rot: Math.PI, w: 13, d: 10, palette: 'root' },
  { type: 'house', x: -16, z: 896, rot: Math.PI / 2, w: 10, d: 8, palette: 'root', low: true },
  { type: 'house', x: 24, z: 923, rot: Math.PI, w: 9, d: 8, palette: 'root' },
  { type: 'stall', x: 17, z: 906, rot: 0, palette: 'root' },
  // Meridian's second major town: a garrison, inn, smith and harbor warehouses.
  // the port stands on the north coast, where the old harbour silted up; the Dock Road runs
  // down to it from the fort gate through the Ward
  { type: 'dock', id: 'dock_meridian', x: 580, z: -292, len: 30, yaw: -0.49 },
  { type: 'campfire', id: 'cf_meridian', x: 590, z: -312, name: 'Meridian Landing' },
  // the garrison's barracks are the Chain Citadel's wings (world/palaces.js)
  // Meridian Ward: brick terraces close under the curtain, the parade ground left open
  { type: 'inn', name: 'The Brass Compass', restId: 'inn_meridian', x: 762, z: -552, rot: Math.PI / 2, w: 16, d: 11, palette: 'enclave' },
  { type: 'smithy', x: 810, z: -550, rot: -Math.PI / 2, w: 12, d: 10, palette: 'enclave' },
  ...[[750.5, 9], [761, 10, true], [771.5, 9], [782, 10], [792.5, 9, true], [803, 10], [813.5, 9], [823.5, 9, true]]
    .map(([x, w, low]) => ({ type: 'house', x, z: -516, rot: Math.PI, w, d: 8, palette: 'enclave', low: !!low })),
  ...[[-527, false], [-538, true], [-549, false]].map(([z, low]) => ({ type: 'house', x: 834, z, rot: -Math.PI / 2, w: 9, d: 8, palette: 'enclave', low })),
  { type: 'house', x: 748, z: -530, rot: Math.PI / 2, w: 9, d: 8, palette: 'enclave' },
  // the Lower Works: the hoistmen's row under the north wall and the cooperage by the west wall
  ...[690, 699, 708].map((x) => ({ type: 'house', x, z: -551, rot: Math.PI, w: 8, d: 7, palette: 'enclave', low: true })),
  { type: 'warehouse', name: 'The Cooperage', x: 668, z: -590, rot: Math.PI / 2, w: 10, d: 7, palette: 'enclave' },
  { type: 'stall', x: 782, z: -547, rot: 0, palette: 'enclave' },
  { type: 'well', id: 'well_meridian', x: 789, z: -541 },
  { type: 'dummy', x: 785, z: -568 }, { type: 'dummy', x: 793, z: -568 },
  { type: 'crates', x: 598, z: -304 },
  // ---- Rift ----
  { type: 'throne', x: 6000, z: 6178 },
  { type: 'obelisk', x: 5960, z: 5900 }, { type: 'obelisk', x: 6060, z: 5940 }, { type: 'obelisk', x: 5920, z: 6080 }, { type: 'obelisk', x: 6090, z: 6090 },
  // ---- Saltreach, the Lantern City (data/saltreach.js)
  ...SALTREACH_STRUCTURES,
  // ---- Meridian, the Hush and the islets (data/regions.js)
  ...REGION_STRUCTURES,
  ...MERIDIAN_STRUCTURES,
  // ---- the Hundred Arches (data/greatBridge.js)
  ...ARCHES_STRUCTURES,
  ...HIGHTOLL_STRUCTURES,
];

export const FERRY_ROUTES = [
  { id: 'dock_salt', name: 'Saltreach', x: 0, z: -150, spawn: { x: 0, z: -116 } },
  { id: 'dock_meridian', name: 'Meridian', x: 566, z: -272, spawn: { x: 588, z: -308 } },
  { id: 'dock_thorn', name: 'Thornwood', x: 730, z: 275, spawn: { x: 758, z: 260 } },
  { id: 'dock_frost', name: 'Frosthollow', x: -552, z: 746, spawn: { x: -576, z: 768 } },
  { id: 'dock_ash', name: 'Ashen Spire', x: 616, z: 738, spawn: { x: 640, z: 760 } },
  { id: 'dock_verd', name: 'The Verdance', x: 18, z: 850, spawn: { x: 22, z: 884 } },
  ...REGION_FERRY_ROUTES,
];

// NPCs (dialogue keys refer to data/npcs.js)
export const NPCS = [
  { id: 'wren', name: 'Old Wren', title: 'Beachcomber', x: 5, z: -316, look: { skin: '#c9a07a', hair: '#e8e4dc', outfit: { main: '#5a6a5a', trim: '#3a4a3a', pants: '#3a3a30', boots: '#2a2018' }, beard: '#e8e4dc' } },
  { id: 'maren', name: 'Elder Maren', title: 'Keeper of Saltreach', x: -61.6, z: 69.6, interior: true, floor: 1.8, yaw: Math.PI / 2, look: { skin: '#e0c0a0', hair: '#cfcfd8', outfit: { main: '#3a2a5a', trim: '#d4b04a', pants: '#2a2040', boots: '#1a1420' } } },
  { id: 'dorran', name: 'Dorran', title: 'Blacksmith', x: 24, z: 12, look: { skin: '#a87850', hair: '#1a1410', outfit: { main: '#4a3a2a', trim: '#2a2018', pants: '#2a2a2a', boots: '#1a1410' }, beard: '#1a1410', apron: true } },
  // the market's sellers stand behind their own stalls' counters (world.js STRUCTURES 'stall'), facing the street
  { id: 'ysolde', name: 'Ysolde', title: 'Tailor', x: 14, z: -14.15, yaw: 0, look: { skin: '#f0d0b8', hair: '#a8281c', outfit: { main: '#9a3a3a', trim: '#e8d4a0', pants: '#3a2a3a', boots: '#2a1a1a' } } },
  { id: 'pell', name: 'Pell', title: 'Grocer', x: -14, z: -14.15, yaw: 0, look: { skin: '#d8a880', hair: '#6a4a2a', outfit: { main: '#3a6a9a', trim: '#e8e4dc', pants: '#3a3a3a', boots: '#2a2018' } } },
  { id: 'bess', name: 'Bess', title: 'Innkeeper', x: -34.5, z: 20, interior: true, yaw: Math.PI / 2, look: { skin: '#e8c0a0', hair: '#d4a040', outfit: { main: '#7a5a3a', trim: '#e8e4dc', pants: '#4a3a2a', boots: '#2a2018' }, apron: true } },
  { id: 'ilvar', name: 'Sage Ilvar', title: 'Attunement Trainer', x: 41, z: 37, look: { skin: '#c9b39b', hair: '#ebe4d8', outfit: { main: '#2a3a6a', trim: '#8fd8ff', pants: '#1a2040', boots: '#1a1a2a' }, horns: 'curled', beard: '#ebe4d8' } },
  { id: 'hale', name: 'Captain Hale', title: 'Commander of the Watch', x: -30, z: -32, yaw: Math.PI / 2, look: { skin: '#b88a60', hair: '#3a2a1a', outfit: { main: '#9aa3ad', trim: '#2a4a7a', pants: '#2a3a5a', boots: '#3a3a3a' }, armored: true } },
  { id: 'oskar', name: 'Oskar', title: 'Ferryman', x: 5, z: -124, look: { skin: '#c89870', hair: '#5a5a5a', outfit: { main: '#2a4a5a', trim: '#e8d4a0', pants: '#2a2a2a', boots: '#1a1a1a' }, beard: '#5a5a5a' } },
  { id: 'vowkeeper', name: 'The Vowkeeper', title: 'Witness of Oaths', x: 44.2, z: 109, interior: true, floor: 1.05, look: { skin: '#d8d0c8', hair: '#ffffff', outfit: { main: '#e8e4dc', trim: '#d4b04a', pants: '#c8c4bc', boots: '#8a8070' }, hood: true, glowEyes: true, eyes: '#ffe9a3' } },
  { id: 'moss', name: 'Moss', title: 'Fen Fisher', x: -452, z: -248, look: { skin: '#a88a68', hair: '#4a5a3a', outfit: { main: '#4a5a3a', trim: '#8a7a5a', pants: '#3a3a2a', boots: '#2a2a1a' } } },
  { id: 'brynja', name: 'Brynja', title: 'Rimefang Hunter', x: -582, z: 762, look: { skin: '#f0e0d0', hair: '#f0e8c0', outfit: { main: '#d8e4ee', trim: '#7a8a9a', pants: '#5a6a7a', boots: '#3a4a5a' } } },
  { id: 'ignis', name: 'Scholar Ignis', title: 'Volcanologist', x: 646, z: 756, look: { skin: '#8a6a54', hair: '#2a1a10', outfit: { main: '#5a4a40', trim: '#ff7a2f', pants: '#3a2a20', boots: '#1a1410' } } },
  { id: 'thorn_ferry', name: 'Rook', title: 'Ferryman', x: 764, z: 250, look: { skin: '#d8a880', hair: '#2a2a2a', outfit: { main: '#2a4a5a', trim: '#e8d4a0', pants: '#2a2a2a', boots: '#1a1a1a' } } },
  { id: 'vorn', name: 'Vorn', title: 'Pitmaster of the Crucible', x: 99.2, z: 12.6, look: { skin: '#a87850', hair: '#2a1a10', outfit: { main: '#6a2a1a', trim: '#d4b04a', pants: '#2a1a14', boots: '#1a1010' }, beard: '#2a1a10', armored: true } },
  { id: 'corwin', name: 'Corwin', title: 'Jeweler', x: 24, z: -8.15, yaw: 0, look: { skin: '#e8c8a8', hair: '#3a2a1a', outfit: { main: '#5a3a7a', trim: '#d4b04a', pants: '#2a2030', boots: '#1a1418' } } },
  { id: 'gull', name: 'Gull', title: 'Lighthouse Keeper', x: -100, z: 70, look: { skin: '#d8b090', hair: '#9a9a9a', outfit: { main: '#3a4a5a', trim: '#d4b04a', pants: '#2a2a30', boots: '#1a1a1a' }, beard: '#bababa' } },
  { id: 'ama', name: 'Ama', title: 'Verdance Guide', x: 28, z: 880, look: { skin: '#8a5a3a', hair: '#1a1410', outfit: { main: '#4a6a3a', trim: '#c8a040', pants: '#3a3020', boots: '#2a2018' }, bandana: '#c8a040' } },
  { id: 'hollow_man', name: 'The Hollow Man', title: '???', x: 5992, z: 5842, look: { skin: '#3a3048', hair: '#0a0810', outfit: { main: '#1a1424', trim: '#a274ff', pants: '#120e1a', boots: '#08060c' }, hood: true, glowEyes: true, eyes: '#c48bff' } },
  { id: 'hush_ferry', name: 'Brother Wick', title: 'Ministry Boatman', x: -722, z: 350, look: { skin: '#c8b8a8', hair: '#6a6a70', outfit: { main: '#5a5a66', trim: '#a8acc0', pants: '#3a3a44', boots: '#202026' }, hood: true } },
  // ---- storyline arrivals (data/saltreach.js, data/regions.js)
  ...SALTREACH_NPCS,
  ...REGION_NPCS,
];

// Fen houses (reed palette) stand on piles: their floors are this far above the highest
// ground under them (world/fenArchitecture.js).
export const FEN_STILT = 1.5;
// Canopy Landing and the Verdance build on taller stilts, clear of the jungle floor.
export const ROOT_STILT = 2.2;

// Hosts stand behind their own inn counters. Derive placement from the same
// rotated footprint as the interior, so they cannot drift into a wall or roof.
export const SETTLEMENT_HOSTS = [
  { id: 'rookery_host', name: 'Nella', restId: 'inn_thorn', shop: 'pell' },
  { id: 'reed_host', name: 'Oren', restId: 'inn_fen', shop: 'moss' },
  { id: 'frost_host', name: 'Edda', restId: 'inn_frost', shop: 'brynja' },
  { id: 'cinder_host', name: 'Hessa', restId: 'inn_ash', shop: 'ignis' },
  { id: 'canopy_host', name: 'Tavi', restId: 'inn_verd', shop: 'ama' },
  { id: 'meridian_host', name: 'Cora', restId: 'inn_meridian', shop: 'pell' },
];
for (const host of SETTLEMENT_HOSTS) {
  const inn = STRUCTURES.find(s => s.restId === host.restId);
  const z = -inn.d / 2 + 1, rot = inn.rot || 0;
  NPCS.push({ id: host.id, name: host.name, title: inn.name, interior: true, floor: inn.palette === 'reed' ? FEN_STILT + 0.5 : inn.palette === 'root' ? ROOT_STILT + 0.5 : 0,
    x: inn.x + Math.sin(rot) * z, z: inn.z + Math.cos(rot) * z, yaw: rot,
    look: { skin: '#be9778', hair: '#443c30', outfit: { main: '#77745b', trim: '#c0b791', pants: '#514b3d', boots: '#302b24' }, apron: true } });
}
NPCS.push(
  { id: 'meridian_ferry', name: 'Merek', title: 'Meridian Ferryman', x: 584, z: -306, look: { skin: '#ba9370', hair: '#514a40', outfit: { main: '#485755', trim: '#b8ae85', pants: '#383d36', boots: '#242724' } } },
  { id: 'meridian_captain', name: 'Commander Rell', title: 'Fort Meridian Command', x: 702, z: -494, yaw: 0.6, look: { skin: '#c3a084', hair: '#3b352f', armored: true, outfit: { main: '#72786c', trim: '#a69766', pants: '#454b42', boots: '#2c302a' } } },
  { id: 'meridian_smith', name: 'Torren', title: 'Garrison Smith', x: 800, z: -551, yaw: -Math.PI / 2, look: { skin: '#ad805e', hair: '#342e28', apron: true, outfit: { main: '#77604c', trim: '#ab9976', pants: '#423b32', boots: '#292822' } } },
);

// Ferry NPCs at outer islands share the 'ferry' dialogue.
export const FERRY_NPCS = { north_ferry: 'dock_north', hush_ferry: 'dock_hush', meridian_ferry: 'dock_meridian', oskar: 'dock_salt', thorn_ferry: 'dock_thorn', brynja: 'dock_frost', ignis: 'dock_ash', ama: 'dock_verd' };

export const SPAWNERS = [
  // The Wash
  { type: 'mudlurker', x: 30, z: -384, count: 3, radius: 10, respawn: 40 },
  { type: 'mudlurker', x: -40, z: -412, count: 2, radius: 10, respawn: 40 },
  // Saltreach outskirts
  { type: 'mudlurker', x: 120, z: -60, count: 3, radius: 14, respawn: 60 },
  { type: 'mudlurker', x: -100, z: -90, count: 3, radius: 14, respawn: 60 },
  { type: 'scuttler', x: 130, z: 70, count: 2, radius: 12, respawn: 90 },
  // Thornwood
  { type: 'brigand', x: 830, z: 220, count: 2, radius: 10, respawn: 90 },
  { type: 'brigand', x: 945, z: 245, count: 3, radius: 14, respawn: 120 },
  { type: 'brigand_brute', x: 965, z: 235, count: 1, radius: 8, respawn: 150 },
  { type: 'brigand_cutthroat', x: 932, z: 270, count: 2, radius: 10, respawn: 120 },
  { type: 'brigand', x: 880, z: 310, count: 2, radius: 12, respawn: 120 },
  { type: 'gloomowl', x: 830, z: 85, count: 1, radius: 16, respawn: 150 },
  { type: 'gloomowl', x: 1000, z: 90, count: 1, radius: 10, respawn: 180 },
  { type: 'warlord', x: 1000, z: 280, count: 1, radius: 1, respawn: 0, boss: true },
  // Shimmerfen
  { type: 'mudlurker', x: -510, z: -300, count: 4, radius: 18, respawn: 60 },
  { type: 'mudlurker', x: -600, z: -240, count: 4, radius: 18, respawn: 60 },
  { type: 'scuttler', x: -550, z: -370, count: 3, radius: 16, respawn: 90 },
  { type: 'scuttler', x: -680, z: -300, count: 2, radius: 14, respawn: 90 },
  { type: 'brigand_cutthroat', x: -665, z: -375, count: 2, radius: 10, respawn: 120 },
  // Frosthollow
  { type: 'rimefang', x: -640, z: 850, count: 3, radius: 14, respawn: 120 },
  { type: 'rimefang', x: -730, z: 830, count: 3, radius: 16, respawn: 120 },
  { type: 'rimefang', x: -800, z: 900, count: 2, radius: 12, respawn: 120 },
  { type: 'frost_warden', x: -740, z: 978, count: 1, radius: 1, respawn: 0, boss: true },
  // Ashen Spire
  { type: 'ash_golem', x: 700, z: 820, count: 2, radius: 14, respawn: 150 },
  { type: 'cinder_imp', x: 810, z: 800, count: 3, radius: 14, respawn: 120 },
  { type: 'ash_golem', x: 690, z: 940, count: 2, radius: 14, respawn: 150 },
  { type: 'cinder_imp', x: 830, z: 960, count: 2, radius: 12, respawn: 120 },
  { type: 'cinder_colossus', x: 760, z: 888, count: 1, radius: 1, respawn: 0, boss: true },
  // Rift
  { type: 'hollow', x: 5960, z: 5960, count: 3, radius: 18, respawn: 90 },
  { type: 'hollow', x: 6080, z: 6040, count: 3, radius: 18, respawn: 90 },
  { type: 'riftling', x: 6040, z: 5920, count: 2, radius: 16, respawn: 90 },
  { type: 'riftling', x: 5900, z: 6020, count: 2, radius: 16, respawn: 90 },
  { type: 'hollow_duke', x: 6000, z: 6160, count: 1, radius: 1, respawn: 0, boss: true },
  // ---- expanded bestiary ----
  { type: 'duelist', x: -110, z: 52, count: 1, radius: 1, respawn: 0, boss: true },
  { type: 'fen_witch', x: -640, z: -340, count: 2, radius: 12, respawn: 150 },
  { type: 'witch_queen', x: -700, z: -330, count: 1, radius: 1, respawn: 0, boss: true },
  { type: 'fen_witch', x: -720, z: -300, count: 2, radius: 10, respawn: 150 },
  { type: 'bog_lurker', x: -600, z: -290, count: 1, radius: 4, respawn: 420 },
  { type: 'frost_cultist', x: -680, z: 930, count: 2, radius: 10, respawn: 150 },
  { type: 'frost_cultist', x: -780, z: 810, count: 2, radius: 12, respawn: 150 },
  { type: 'frost_stalker', x: -820, z: 990, count: 2, radius: 10, respawn: 180 },
  { type: 'frost_stalker', x: -640, z: 990, count: 1, radius: 8, respawn: 180 },
  { type: 'thunderwing', x: -760, z: 880, count: 1, radius: 8, respawn: 220 },
  { type: 'ash_zealot', x: 740, z: 800, count: 2, radius: 10, respawn: 150 },
  { type: 'ash_zealot', x: 720, z: 960, count: 2, radius: 10, respawn: 150 },
  { type: 'cinder_crab', x: 850, z: 780, count: 2, radius: 12, respawn: 120 },
  { type: 'cinder_crab', x: 890, z: 880, count: 2, radius: 12, respawn: 120 },
  // The Verdance
  { type: 'jungle_ape', x: -20, z: 1040, count: 3, radius: 14, respawn: 160 },
  { type: 'jungle_ape', x: 70, z: 940, count: 2, radius: 12, respawn: 160 },
  { type: 'jade_serpent', x: -40, z: 920, count: 2, radius: 12, respawn: 140 },
  { type: 'jade_serpent', x: 85, z: 1065, count: 2, radius: 12, respawn: 140 },
  { type: 'mossbound', x: 95, z: 990, count: 3, radius: 12, respawn: 150 },
  { type: 'mossbound_shaman', x: 100, z: 996, count: 1, radius: 4, respawn: 180 },
  { type: 'thresher', x: -60, z: 980, count: 1, radius: 1, respawn: 0, boss: true },
  { type: 'primadon', x: 30, z: 1086, count: 1, radius: 1, respawn: 0, boss: true },
  { type: 'drowned_knight', x: 5940, z: 6080, count: 2, radius: 12, respawn: 150 },
  { type: 'drowned_knight', x: 6060, z: 5900, count: 1, radius: 8, respawn: 150 },
  { type: 'abyssal_watcher', x: 6138, z: 6082, count: 1, radius: 6, respawn: 180 },
  { type: 'abyssal_watcher', x: 5900, z: 5900, count: 1, radius: 6, respawn: 180 },
  // ---- faction guards and the new reaches (data/saltreach.js, data/regions.js)
  ...SALTREACH_SPAWNERS,
  ...REGION_SPAWNERS,
  ...ARCHES_SPAWNERS,
  ...HIGHTOLL_SPAWNERS,
];

export const CHESTS = [
  { id: 'c_wash', x: 26, z: -374, loot: { silver: [10, 20], items: [['bread', 2], ['herb', 1]] } },
  { id: 'c_lighthouse', x: -116, z: 68, loot: { silver: [40, 70], items: [['elixir', 1], ['waterskin', 1]] } },
  { id: 'c_brigand', x: 1012, z: 272, loot: { silver: [80, 140], items: [['mantra_spark', 1], ['stew', 2]] } },
  { id: 'c_owl', x: 840, z: 78, loot: { silver: [30, 60], items: [['lost_satchel', 1], ['elixir', 1]] } },
  { id: 'c_fen', x: -676, z: -386, loot: { silver: [60, 100], weapon: 'wavecutter_kris', items: [['sanity_draught', 1]] } },
  { id: 'c_frost', x: -820, z: 850, loot: { silver: [60, 110], items: [['elixir', 2], ['ether_tonic', 1]] } },
  { id: 'c_ash', x: 850, z: 820, loot: { silver: [80, 140], weapon: 'stormpiercer', items: [['mantra_spark', 1]] } },
  { id: 'c_witch_queen', x: -708, z: -322, loot: { silver: [120, 200], items: [['mantra_spark', 1], ['sanity_draught', 2], ['cleansing_salts', 2]] } },
  { id: 'c_witch', x: -646, z: -346, loot: { silver: [40, 80], items: [['cleansing_salts', 2], ['herb', 2], ['witch_charm', 1]] } },
  { id: 'c_cult', x: -786, z: 816, loot: { silver: [60, 100], weapon: 'moonveil_katana', items: [['frost_salve', 2], ['frost_lily', 3]] } },
  { id: 'c_thunder', x: -765, z: 885, loot: { silver: [50, 90], weapon: 'stormneedle', items: [['iron_draught', 1]] } },
  { id: 'c_zealot', x: 726, z: 966, loot: { silver: [80, 140], weapon: 'ember_gauntlets', items: [['fireproof_salve', 2], ['ember_pepper', 3]] } },
  { id: 'c_thorn_peak', x: 980, z: 128, loot: { silver: [50, 90], items: [['honeycomb', 3], ['berries', 4], ['iron_draught', 1]] } },
  { id: 'c_drowned', x: 5946, z: 6086, loot: { silver: [0, 0], weapon: 'tidebreaker', items: [['rift_shard', 4], ['sanity_draught', 1]] } },
  { id: 'c_verd_moss', x: 108, z: 986, loot: { silver: [90, 150], weapon: 'mossbound_spear', items: [['honeycomb', 2], ['elixir', 1]] } },
  { id: 'c_verd_pit', x: -66, z: 972, loot: { silver: [70, 120], items: [['iron_draught', 2], ['mantra_spark', 1]] } },
  { id: 'c_verd_king', x: 44, z: 1098, loot: { silver: [150, 260], items: [['mantra_spark', 1], ['hunters_feast', 2]] } },
  { id: 'c_rift', x: 6100, z: 5880, loot: { silver: [0, 0], items: [['rift_shard', 6], ['mantra_spark', 1], ['sanity_draught', 2]] } },
  ...SALTREACH_CHESTS,
  ...REGION_CHESTS,
  ...ARCHES_CHESTS,
  ...HIGHTOLL_CHESTS,
];

export const START_POS = { x: -4, z: -346 };
export const RIFT_SPAWN = { x: 6000, z: 5830 };
export const DEFAULT_RESPAWN = { x: 0, z: -320, id: 'cf_wash' };

// ---- landmass sampling for scattered content (vegetation, forage)
const REF_AREA = Math.PI * 175 * 175;
const lobesOf = (isl) => [{ x: isl.cx, z: isl.cz, r: isl.radius }, ...(isl.lobes || [])];

// Island area relative to a classic 175m island (lobes overlap a little; close enough for density).
export function islandAreaFactor(isl) {
  if (isl.outline) return coastArea(isl.outline) / REF_AREA;
  return lobesOf(isl).reduce((a, l) => a + Math.PI * l.r * l.r, 0) / REF_AREA;
}

// Biome regions of an island with their relative areas: the base biome plus each zone.
export function islandBiomeRegions(isl) {
  if (isl.outline) {
    const zones = (isl.zones || []).filter(z => !z.sink);
    const b = islandBounds(isl), counts = new Array(zones.length + 1).fill(0);
    for (let ix = 0; ix < 40; ix++) for (let iz = 0; iz < 40; iz++) {
      const x = b.x0 + (ix + 0.5) / 40 * (b.x1 - b.x0);
      const z = b.z0 + (iz + 0.5) / 40 * (b.z1 - b.z0);
      if (coastDistance(isl.outline, x, z) >= 0) continue;
      const index = zones.findIndex(zn => hypot(x - zn.x, z - zn.z) < zn.r * 0.7);
      counts[index + 1]++;
    }
    const scale = islandAreaFactor(isl) / Math.max(1, counts.reduce((a, b) => a + b, 0));
    return [{ biome: isl.biome, zone: null, area: counts[0] * scale },
      ...zones.map((zone, i) => ({ biome: zone.biome, zone, area: counts[i + 1] * scale }))].filter(r => r.area > 0);
  }
  const total = islandAreaFactor(isl);
  const zones = (isl.zones || []).filter((z) => !z.sink).map((z) => ({ biome: z.biome, zone: z, area: (Math.PI * (z.r * 0.7) ** 2) / REF_AREA }));
  const used = zones.reduce((a, z) => a + z.area, 0);
  return [{ biome: isl.biome, zone: null, area: Math.max(0.2, total - used) }, ...zones];
}

// The biome governing a point: a zone owns its core outright and shares its rim with what
// lies around it in a blocky dither (4 m cells), so meadow gives way to fen, forest or snow
// over a hundred metres rather than at a line. Deterministic, so every system agrees.
export function biomeOfPoint(isl, x, z) {
  for (const zn of isl.zones || []) {
    if (zn.sink) continue;
    const t = hypot(x - zn.x, z - zn.z) / zn.r;
    if (t >= 0.95) continue;
    const w = t <= 0.5 ? 1 : 1 - (t - 0.5) / 0.45;
    if (w >= 1 || ditherCell(x, z, isl.seed) < w * w * (3 - 2 * w)) return zn.biome;
  }
  return isl.biome;
}
function ditherCell(x, z, seed) {
  let h = Math.imul(Math.floor(x / 4), 374761393) + Math.imul(Math.floor(z / 4), 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// An outlined island's bounds, kept per outline: islandScatter draws from them on every call.
const scatterBounds = new WeakMap();
function boundsOf(isl) {
  let b = scatterBounds.get(isl);
  if (!b || b.outline !== isl.outline) scatterBounds.set(isl, (b = { outline: isl.outline, box: islandBounds(isl) }));
  return b.box;
}

// A uniformly random point inside the island's lobes (or inside one zone's core).
export function islandScatter(isl, rng, zone = null) {
  if (zone) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * zone.r * 0.92;
    return [zone.x + Math.cos(a) * r, zone.z + Math.sin(a) * r];
  }
  if (isl.outline) {
    const b = boundsOf(isl);
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = b.x0 + rng() * (b.x1 - b.x0), z = b.z0 + rng() * (b.z1 - b.z0);
      if (coastDistance(isl.outline, x, z) < -3) return [x, z];
    }
    return [isl.cx, isl.cz];
  }
  const lobes = lobesOf(isl);
  let pick = rng() * lobes.reduce((a, l) => a + l.r * l.r, 0);
  let l = lobes[0];
  for (const c of lobes) {
    pick -= c.r * c.r;
    if (pick <= 0) {
      l = c;
      break;
    }
  }
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * l.r * 0.98;
  return [l.x + Math.cos(a) * r, l.z + Math.sin(a) * r];
}

// Resolve each region into world space after all authored content is assembled.
// Explicit headings preserve the dock approach when a merged coast changes center.
for (const dock of STRUCTURES.filter(s => s.type === 'dock')) {
  const regionId = { dock_salt: 'saltreach', dock_thorn: 'thornwood', dock_meridian: 'meridian', dock_frost: 'frosthollow', dock_ash: 'ashen_spire', dock_verd: 'verdance', dock_hush: 'the_hush' }[dock.id];
  const home = REGIONS.find(r => r.id === regionId);
  if (home && dock.yaw == null) dock.yaw = Math.atan2(dock.x - home.cx, dock.z - home.cz);
}
for (const s of STRUCTURES) {
  if (s.x > 600 && s.x < 880 && s.z < -430 && s.z > -800) {
    s.style = 'enclave';
    s.noAnnex = true;
  }
}
for (const catalog of [ISLANDS, REGIONS, STRUCTURES, NPCS, LOCATIONS, SPAWNERS, CHESTS, FERRY_ROUTES, EXPLORATION_DISTRICTS]) placeCatalog(catalog);
// the ledge-built world's high tiers, already in final world metres (data/ledgeSites.js)
CHESTS.push(...TIER_CHESTS);
SPAWNERS.push(...TIER_SPAWNERS);
LOCATIONS.push(...TIER_LOCATIONS);
// the roaming packs are authored in final positions too (data/roaming.js)
SPAWNERS.push(...ROAMING_SPAWNERS);
