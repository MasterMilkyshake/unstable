// The Hundred Arches: the Compact's viaduct for the northern service road, carried over
// the low country on the way to the northern regulator. The low country sank in the
// Fracture and became the fen; the spans that stood are still standing in it, where the fen
// meets the Wash. It is the first great thing the drowned see when they wake on the Wash:
// across the bay and the Arch Mere, striding out of the Fenwall's western spur.
// Registered into world.js's STRUCTURES / LOCATIONS / SPAWNERS / CHESTS like regions.js.
//
// Coordinates are final world metres (Shimmerfen has no layout offset; everything here
// stays at z <= 100 so placement never moves it onto the Hush). +z is north, +x is WEST.
// Everything the Arches own (the Foot's rock and its cut, the mere, the camp, the mist and
// the cameras) is placed in the bridge's own frame through archPoint, so it moves with it.

// The line runs from the south abutment (where the Arches' Foot hill rises out of the
// Fenwall's western spur) north-north-west over the Arch Mere to the last stumps under the
// Seamspire Rise. Pier i stands at t = i / bays along it.
export const GREAT_BRIDGE = {
  id: 'hundred_arches',
  name: 'The Hundred Arches',
  x0: -660,
  z0: -686,
  x1: -321,
  z1: -172,
  bays: 19,
  deck: 60, // world height of the road surface
  pierW: 8, // pier thickness along the line
  width: 13, // pier depth across the line, and the deck's width
};

const B = GREAT_BRIDGE;
const LEN = Math.hypot(B.x1 - B.x0, B.z1 - B.z0);
export const ARCH_YAW = Math.atan2(B.x1 - B.x0, B.z1 - B.z0);
export const ARCH_LENGTH = LEN;
export const ARCH_BAY = LEN / B.bays;
// `rot` for a landform or rise laid along the line (its rz runs with the road)
export const ARCH_ALONG_ROT = -ARCH_YAW;

// World (x, z) of a point `along` metres up the line from the south abutment and `side`
// metres across it (positive = the bridge frame's local +x). Same transform as siteFrame.
export function archPoint(along, side = 0) {
  const c = Math.cos(ARCH_YAW), s = Math.sin(ARCH_YAW);
  return [B.x0 + side * c + along * s, B.z0 - side * s + along * c];
}

// Height of each pier as a fraction of the deck (1 = carries the road), and what stands
// on it. Index 0 is the south abutment.
export const ARCH_PIERS = [
  { top: 'hill' }, // buried in the Arches' Foot: a few courses poking from the hillside
  { top: 'hill' },
  { top: 'hill' },
  { top: 1 },
  { top: 1, turrets: true },
  { top: 1, gatehouse: true }, // the wardens' post over the road
  { top: 1 },
  { top: 1 }, // the last pier of the south spans: the road ends past it
  { top: 1, lone: true, turrets: 'ruin' }, // stands alone between the two great breaks
  { top: 0.55 },
  { top: 1 },
  { top: 1 },
  { top: 1, turrets: true },
  { top: 1 },
  { top: 1 },
  { top: 1 },
  { top: 0.8 },
  { top: 0.5 },
  { top: 0.3 },
  { top: 0.14 },
];

// What is left of each bay (between pier i and i + 1).
//   approach the hillside climbs onto the deck; fallen courses dress the slope
//   whole   arch, spandrel and road
//   jut     the road reaches past the pier and breaks off; the arch is two springers
//   stub    springers on both piers, nothing between
//   fallen  nothing overhead; the arch lies in the water below
export const ARCH_BAYS = [
  'approach', 'approach', 'approach',
  'whole', 'whole', 'whole', 'whole',
  'jut', 'fallen', 'fallen',
  'whole', 'whole', 'whole', 'whole', 'whole',
  'stub', 'fallen', 'fallen', 'fallen',
];

const at = (along, side = 0) => archPoint(along, side).map((v) => Math.round(v * 10) / 10);
// Places along the line are given in bays, so they keep their spans when the line changes.
const bay = (n) => ARCH_BAY * n;

// The Arch Mere: the silted head of the bay under the standing spans, drowned to the knee,
// wider on the Wash's side so the colonnade and Reedbank keep dry feet.
export const ARCH_MERE = [
  { at: at(bay(6.2), 34), r: 59 },
  { at: at(bay(8.55), 30), r: 64 },
  { at: at(bay(10.65), 20), r: 46 },
];

// Silt and fallen courses heaped round every pier that stands in the mere, so a hull
// grounds on them instead of sailing through masonry. The hill and its crest and the piers
// on dry ground need none — a shoal there would punch a hole in the land.
// Spread into Shimmerfen's flats by world.js.
export const ARCH_SHOALS = Array.from({ length: B.bays + 1 }, (_, i) => i).filter((i) => {
  const [x, z] = archPoint(ARCH_BAY * i, 0);
  return i > 3 && ARCH_MERE.some(({ at: [mx, mz], r }) => Math.hypot(x - mx, z - mz) < r * 0.9);
}).map((i) => {
  const [x, z] = archPoint(ARCH_BAY * i, 0);
  return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r: 12, h: -0.35 };
});

// The service plate is set into the parapet where the south road ends.
// `along` is metres past pier 7's north face; side -1 is the local -x parapet.
export const ARCH_PLATE = { id: 'arches_service_plate', bay: 7, along: 3.4, side: -1 };

export const ARCHES_LORE = [
  {
    id: 'arches_service_plate',
    title: 'Inscription on the Service Plate',
    place: 'The Hundred Arches',
    text: 'NORTHERN SERVICE WAY. SPAN EIGHT OF ONE HUNDRED. Kept by the Compact for the regulator crews. Carts keep to the inland parapet, crews to the sea side. Report a crack to the post ahead, never the post behind. Scratched beneath it, later and shallower: The low country went under in one night and took eighty-one spans with it. We kept these for the salt carts until the thirty-first winter, when the road beyond the water froze and there was nowhere left to carry anything. Nobody reports the cracks now. There is no post ahead.',
  },
];

// The notice at the camp is a written source like any other; landmarks.js builds its post.
const [noticeX, noticeZ] = at(-4.4, 15);
export const ARCHES_NOTICE = {
  id: 'arches_covenant_notice',
  title: 'Covenant Notice at the Arches',
  place: "The Arches' Foot",
  x: noticeX,
  z: noticeZ,
  text: 'REED COVENANT. The Arches are not a road. The hill will carry you up; it will not carry you down any slower than the drop. The water under the north spans is channel water and the reeds there are channel reeds. Do not cut them, do not fish them, and do not sleep under the lone pier. It drops a stone every frost, and it has had a hundred frosts to choose one for you. — Warden Isel, for the western channels',
};

// The camp at the Foot, on the bay side of the cut. (The Foot's rock and its cut are authored
// in data/landforms.js, its hill and crown in data/world.js, in this same frame.)
export const ARCH_FOOT = {
  camp: at(-10.5, 26.3), // its level ground
  rise: at(63.1, 0.8), // the smooth hill the road climbs
  crown: at(89.4, 0.1), // locked to deck height so the walk steps onto the road
};
const [campX, campZ] = at(-12.3, 27.6);
export const ARCHES_STRUCTURES = [
  { type: 'campfire', id: 'cf_arches', x: campX, z: campZ, name: "The Arches' Foot" },
];

const loc = (name, along, side, r) => { const [x, z] = at(along, side); return { name, x, z, r }; };
export const ARCHES_LOCATIONS = [
  loc('The Hundred Arches', bay(4.9), 0, 70),
  loc("The Arches' Foot", -9.6, 20, 26),
  loc('The Arch Mere', bay(8.4), 30, 100),
];

// The mere is a lurker's larder; scuttlers pick over the rubble at the breaks.
const spawn = (type, along, side, o) => { const [x, z] = at(along, side); return { type, x, z, ...o }; };
export const ARCHES_SPAWNERS = [
  spawn('mudlurker', bay(6.2), 36, { count: 2, radius: 12, respawn: 90 }),
  spawn('bog_lurker', bay(8.3), 28, { count: 1, radius: 10, respawn: 150 }),
  spawn('mudlurker', bay(10.5), 22, { count: 3, radius: 14, respawn: 90 }),
  spawn('scuttler', bay(9.05), 12, { count: 2, radius: 10, respawn: 120 }),
];

// Whoever climbs the Arches' Foot and walks to the end of the road finds what the last
// carters left at the plate.
const [chestX, chestZ] = archPoint(ARCH_BAY * 7 + B.pierW / 2 + 2.2, 3.2);
export const ARCHES_CHESTS = [
  { id: 'c_arches_end', x: chestX, z: chestZ, y: B.deck, loot: { silver: [90, 160], items: [['mantra_spark', 1], ['iron_draught', 1], ['elixir', 1]] } },
];

// Soft height-fog shelves for the mere (pushed into VALLEY_FOG by world/greatBridge.js).
// Kept low so the haze hangs under the deck rather than bisecting walkers on the hill.
const fog = (along, side, r, y) => { const [x, z] = at(along, side); return { x, z, r, y }; };
export const ARCHES_FOG = [
  fog(bay(10.5), 20, 120, 1.8),
  fog(bay(7.7), 30, 130, 2.0),
  fog(bay(3.9), 20, 100, 1.6),
  fog(bay(9.1), 10, 100, 2.4),
  fog(bay(5.6), 30, 100, 2.2),
];

// Named cameras for ?vista= previews (merged into VISTA_SHOTS).
const shot = (from, y, to, ly, time, title) => ({ x: from[0], y, z: from[1], lx: to[0], ly, lz: to[1], time, title });
export const ARCHES_SHOTS = {
  arches_wash: shot([-4, -346], 15.6, at(bay(8.1)), 30, 0.36, 'The Hundred Arches, from the Wash, where the drowned wake'),
  arches_sunset: shot([-266, -276], 38, at(bay(8.1)), 28, 0.745, 'The Hundred Arches, sunset from the Seamspire Rise'),
  arches_mere: shot(at(bay(11.15), 34), 1.6, at(bay(5.3)), 34, 0.29, 'The Arch Mere, morning among the piers'),
  arches_deck: shot(at(ARCH_BAY * 7 - 6), B.deck + 2.3, at(LEN), B.deck - 12, 0.7, 'The Hundred Arches, the end of the road'),
  arches_reedbank: shot([-470, -300], 9, at(bay(7)), 34, 0.36, 'The Hundred Arches, from Reedbank'),
  arches_ramp: shot(at(-60, 10), 6, at(bay(3.2)), 40, 0.33, "The Arches' Foot, the hill onto the road"),
};
