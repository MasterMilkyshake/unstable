// Layout for world-scale beauty: giant landmarks, ruins, overlooks and fog
// palettes. Kept out of data/world.js so settlement / encounter work can land
// without merge conflicts. registerVistaData() appends lore + location banners.
//
// Coordinates are final world metres (layout 3) and do not go through placeCatalog.
// tests/vista-placement.test.js keeps every piece on dry land, clear of buildings and
// towns, apart from its neighbours, and every waterfall on a real cliff.

import { LORE, LORE_BY_ID } from './lore.js';
import { LOCATIONS } from './world.js';
import { archPoint, ARCH_BAY } from './greatBridge.js';

// The Unmoored Keystone hangs over Saltreach so every surface isle can take
// a bearing from the same cracked shard. hangY is applied in the builder.
export const KEYSTONE = {
  id: 'keystone',
  name: 'The Unmoored Keystone',
  x: 8,
  z: 48,
  rot: 0.22,
  hangY: 138,
};

export const MONUMENTS = [
  {
    id: 'keystone',
    kind: 'keystone',
    name: 'The Unmoored Keystone',
    island: 'saltreach',
    x: KEYSTONE.x,
    z: KEYSTONE.z,
    rot: KEYSTONE.rot,
    hangY: KEYSTONE.hangY,
    exclude: 10,
    reach: { x: -36, z: 118 },
    lore: 'keystone_chain',
  },
  {
    id: 'seamspire',
    kind: 'cathedral',
    name: 'Seamspire Abbey',
    island: 'the_wash',
    x: -160,
    z: -320,
    rot: -Math.PI / 2,
    exclude: 26,
    reach: { x: -124, z: -320 },
    lore: 'seamspire_nave',
  },
  {
    id: 'widowneedles',
    kind: 'spires',
    name: 'The Widowneedles',
    island: 'thornwood',
    x: 1215,
    z: -122,
    rot: -Math.PI / 2,
    exclude: 24,
    reach: { x: 1237, z: -122 },
    lore: 'widow_spire',
  },
  {
    id: 'nave_below',
    kind: 'drowned_temple',
    name: 'The Nave Below',
    island: 'shimmerfen',
    x: -716,
    z: -404,
    rot: -2.05,
    base: 0.3,
    exclude: 26,
    reach: { x: -686, z: -394 },
    lore: 'nave_below',
  },
  {
    id: 'stillkeep',
    kind: 'ice_citadel',
    name: 'The Stillkeep',
    island: 'frosthollow',
    x: -952,
    z: 1568,
    rot: -0.3,
    exclude: 28,
    reach: { x: -938, z: 1542 },
    lore: 'stillkeep_gate',
  },
  {
    id: 'ember_circlet',
    kind: 'volcano_crown',
    name: 'The Ember Circlet',
    island: 'ashen_spire',
    x: 340,
    z: -1200,
    rot: 0,
    exclude: 40,
    reach: { x: 322, z: -1232 },
    lore: 'ember_circlet',
    rim: 34,
  },
  {
    id: 'green_needle',
    kind: 'verdant_spire',
    name: 'The Green Needle',
    island: 'verdance',
    x: 82,
    z: 1308,
    rot: -0.2,
    exclude: 20,
    reach: { x: 64, z: 1288 },
    lore: 'green_needle',
  },
];

export const VISTA_LORE = [
  {
    id: 'keystone_chain',
    title: 'The Last Link',
    place: 'The Unmoored Keystone',
    x: -34,
    z: 120,
    text: 'KEEPERS\' BEARING-STONE. Sight the Keystone through the notch. In Year 0 it hung over the lamp; in Year 113 it hangs a hand to the west, and lower than our grandparents marked. The Enclave calls it the crown\'s anchor-stone, held up by a Warden\'s will. The Ministry calls it this station\'s regulator housing, torn loose at the break and held aloft by the strain it still stores. The chain beneath it was the command line to the Keep. Whatever it is, it has not fallen. Mark it every year.',
  },
  {
    id: 'seamspire_nave',
    title: 'Bell-Rope of Seamspire',
    place: 'Seamspire Abbey',
    x: -124,
    z: -320,
    text: 'RUNG FOR THE RETURNED. Raised in Year 6 on the ridge that faces the seam, so that every soul the sea gave back would hear a bell before it heard a question. One stroke for each who came ashore. The rope was cut in Year 70, when the last abbess wrote that the sea had begun to ring back.',
  },
  {
    id: 'widow_spire',
    title: 'A Widow\'s Needle',
    place: 'The Widowneedles',
    x: 1237,
    z: -122,
    text: 'These needles were Compact signal posts before Saltreach had a name; they passed the Keep\'s word down the coast, lamp to lamp. After the break the widows of the first vanishing climbed them to watch for sails that did not come. Owls took the crowns. The stone still leans toward the sea, as if the next signal might come from there.',
  },
  {
    id: 'nave_below',
    title: 'Litany of the Nave Below',
    place: 'The Nave Below',
    x: -686,
    z: -394,
    text: 'Mother of reeds, we raised this nave on dry peat beside the channel gates. You wanted it closer. The floor is a pool now and the saints have minnows in their mouths. We will worship from the shrine on the bank. We will keep the gates turning. We will not pretend the water is a guest.',
  },
  {
    id: 'stillkeep_gate',
    title: 'Threshold of the Stillkeep',
    place: 'The Stillkeep',
    x: -938,
    z: 1542,
    text: 'NORTHERN REGULATOR, OUTER HOUSING. Poured, not built, so the walls would not crack as the strain went in. The strain has not stopped going in. The Warden walks the hollow below because it was told to keep this door, and no one has told it otherwise. If the ice sings, that is the regulator taking up more of the load. Do not answer it.',
  },
  {
    id: 'ember_circlet',
    title: 'The Circlet Oath',
    place: 'The Ember Circlet',
    x: 322,
    z: -1232,
    text: 'We set a crown of black stone around the furnace mouth so the mountain would have a rim to breathe against. Climb the rim. Look in. The Colossus tends the fire because no one ever told it to stop. If it falls, the circlet is only a fence around the heat.',
  },
  {
    id: 'green_needle',
    title: 'The Sitting-Place',
    place: 'The Green Needle',
    x: 64,
    z: 1288,
    text: 'Before the jungle, this was a mast of the rootworks: it drank the slow strain and gave it to the roots. The roots climbed it and kept it. We climb it to watch the Old King\'s ground, because the jungle\'s keeper has forgotten us and someone must remember it. Bring no blade up the steps. Bring no crown. The Old King never wore one.',
  },
];

export const VISTA_LOCATIONS = [
  { name: 'The Unmoored Keystone', x: KEYSTONE.x, z: KEYSTONE.z, r: 40 },
  { name: 'Seamspire Abbey', x: -160, z: -320, r: 28 },
  { name: 'The Widowneedles', x: 1215, z: -122, r: 30 },
  { name: 'The Nave Below', x: -716, z: -404, r: 32 },
  { name: 'The Stillkeep', x: -952, z: 1568, r: 32 },
  { name: 'The Ember Circlet', x: 340, z: -1200, r: 42 },
  { name: 'The Green Needle', x: 82, z: 1308, r: 26 },
];

// Broken Compact aqueducts, colonnades and signal towers, one or two per island and never
// piled on each other: wilderness only, clear of towns, camps and roads.
export const AQUEDUCTS = [
  { id: 'aq_salt_west', x0: 150, z0: 70, x1: 190, z1: 30, arches: 6, h: 13, broken: [3] },
  { id: 'aq_salt_north', x0: 48, z0: 428, x1: 86, z1: 484, arches: 5, h: 11, broken: [1] },
  { id: 'aq_thorn_vale', x0: 1330, z0: -160, x1: 1400, z1: -230, arches: 7, h: 12, broken: [2] },
  { id: 'aq_frost_ravine', x0: -1150, z0: 1600, x1: -1090, z1: 1640, arches: 6, h: 13, broken: [4] },
  { id: 'aq_verd_ridge', x0: -60, z0: 1440, x1: -115, z1: 1395, arches: 5, h: 11, broken: [1] },
  { id: 'aq_wash_west', x0: -58, z0: -304, x1: -28, z1: -278, arches: 4, h: 9, broken: [2, 3] },
];

export const COLONNADES = [
  { x: 118, z: 88, len: 28, rot: 0.6, fallen: 0.35 },
  { x: 1300, z: -260, len: 24, rot: -0.4, fallen: 0.4 },
  { x: -560, z: -410, len: 32, rot: 1.1, fallen: 0.25 },
  { x: -1196, z: 1386, len: 22, rot: 0.2, fallen: 0.3 },
  { x: -106, z: 1360, len: 20, rot: -0.8, fallen: 0.45 },
];

export const COLLAPSED_TOWERS = [
  { x: -92, z: -410, h: 16, lean: 0.28 },
  { x: -40, z: 540, h: 19, lean: 0.24 },
  { x: 1290, z: -340, h: 20, lean: 0.22 },
  { x: -548, z: -248, h: 14, lean: -0.3 },
  { x: -1180, z: 1500, h: 18, lean: 0.16 },
  { x: -90, z: 1300, h: 19, lean: -0.2 },
];

// Falls stand on real cliffs: x, z is the face, rot points downstream, and the builder
// takes the sheet's height from the drop it finds there.
export const WATERFALLS = [
  { x: -150, z: 192, w: 6, rot: 4.19, kind: 'clear' },
  { x: -144, z: -250, w: 5, rot: 1.31, kind: 'clear' },
  { x: 1274, z: -12, w: 5, rot: 4.71, kind: 'clear' }, // off the upland into Owlroost Hollow
  { x: -1046, z: 1530, w: 7, rot: Math.PI, kind: 'ice' }, // off the cirque wall into the White Hollow
  { x: 34, z: 1306, w: 6, rot: 5.76, kind: 'clear' },
];

// Prospect arches: two pillars and a lintel framing a landmark close enough to see.
export const OVERLOOKS = [
  { x: -176, z: -240, lookX: KEYSTONE.x, lookZ: KEYSTONE.z, name: 'Wash Prospect' },
  { x: 1215, z: 90, lookX: 1215, lookZ: -122, name: "Rook's Prospect" },
  { x: -650, z: -440, lookX: -716, lookZ: -404, name: 'Fen Causeway View' },
  { x: -930, z: 1520, lookX: -952, lookZ: 1568, name: 'Pale Approach' },
  { x: 290, z: -1300, lookX: 340, lookZ: -1200, name: 'Cinder Rim View' },
];

// Views kept open across country: no tall tree grows in the wedge from (x, z) toward the span
// between `toward`'s two points, from `near` to `far` metres out (world/props.js). From the
// Wash where the drowned wake, the eye runs east over the Seamspire Rise's slumped shoulder and
// the silted bay to the Hundred Arches striding out of the Fenwall (data/greatBridge.js).
export const SIGHTLINES = [
  { name: 'The Wash to the Hundred Arches', x: -4, z: -346, toward: [archPoint(-40), archPoint(ARCH_BAY * 14)], near: 24, far: 640, margin: 0.04 },
  // Act I's destination seen from where a boat puts in: Brigand Hold's Red Lookout and its gate
  // up the Red Trail from Rook's Landing's pier (P3)
  { name: "Rook's Landing's pier to Brigand Hold", x: 1122.9, z: 155.4, toward: [[1314, 127], [1321, 142]], near: 30, far: 215, margin: 0.035 },
];
export function inSightline(x, z) {
  for (const s of SIGHTLINES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.near || d > s.far) continue;
    const a = Math.atan2(x - s.x, z - s.z);
    const [a0, a1] = s.toward.map(([tx, tz]) => Math.atan2(tx - s.x, tz - s.z)).sort((p, q) => p - q);
    if (a > a0 - s.margin && a < a1 + s.margin) return true;
  }
  return false;
}

// The Ashen Spire's overflow: lava breaking from the mouths of the neglected overflow
// galleries at the foot of the cone and running down its worn channels (data/landforms.js
// `channel`, by index among the Ashen Spire's channels) to the sea, where it steams. `mouth`
// is the gallery the flow breaks from; it faces down the channel.
export const LAVA_FLOWS = [
  { channel: 0, mouth: { x: 340, z: -1111 }, w: 4.4 },
  { channel: 1, mouth: { x: 380, z: -1297 }, w: 4.4 },
];
// Plumes standing over the furnace: the caldera's own, and steam where the flows reach water.
export const PLUMES = [
  { x: 340, z: -1200, r: 5, h: 120, kind: 'smoke' },
];

// The Hush's sounding lines. The Vahl taught listening with cliff stones, and the Compact
// office that measured the shelf here set its stones in lines from the listening circle and
// the Sounding House out to the cliffs, one every chain (24 m), each notched with a tally for
// the soundings taken at it. They still stand; the Ministry still walks them.
export const SOUNDING_LINES = [
  { from: [-1394, 1148], to: [-1472, 940], every: 24 },
  { from: [-1260, 1068], to: [-1258, 932], every: 24 },
  { from: [-1378, 1182], to: [-1346, 1280], every: 24 },
];

// Redwake's turning trees and a few gold stands on Saltreach.
export const AUTUMN_GROVES = [
  { x: -30, z: 120, n: 18, r: 16 },
  { x: 140, z: 60, n: 14, r: 14 },
  { x: 1330, z: -60, n: 16, r: 15 },
  { x: 1400, z: -240, n: 12, r: 12 },
  { x: -108, z: -284, n: 10, r: 10 },
];

// Lowland mist pools (harbours, meres). `y` is the soft height-fog shelf; atmosphere.js
// boosts analytic height fog here instead of drawing hard mist discs.
export const VALLEY_FOG = [
  { x: 0, z: -80, r: 90, y: 1.6 },
  { x: -600, z: -330, r: 100, y: 1.8 },
  { x: -716, z: -404, r: 48, y: 1.4 },
  // the fen lies under a low mist that thickens toward the meres
  { x: -760, z: -250, r: 95, y: 1.6 },
  { x: -560, z: -420, r: 80, y: 1.5 },
  { x: -660, z: -520, r: 70, y: 1.5 },
  { x: 1625, z: 45, r: 60, y: 1.5 },
  { x: -1265, z: 1545, r: 55, y: 1.5 },
  { x: 20, z: 480, r: 70, y: 2.4 },
];

// Display-space grades (applied after tone mapping). Keep them gentle: the regional
// mist and the ground palettes carry each biome; the grade only nudges the mood.
export const BIOME_GRADE = {
  sea: { lift: [0, 0.005, 0.01], gain: [1, 1.01, 1.01], sat: 1.02, contrast: 1.03, temp: 0, tint: '#f2f8f6' },
  beach: { lift: [0.01, 0.008, 0], gain: [1.03, 1.01, 0.98], sat: 1.04, contrast: 1.03, temp: 0.06, tint: '#fff2dc' },
  meadow: { lift: [0, 0.008, 0.006], gain: [1.02, 1.02, 0.99], sat: 1.03, contrast: 1.04, temp: 0.03, tint: '#f4f2e0' },
  farmland: { lift: [0.008, 0.006, 0], gain: [1.03, 1.01, 0.97], sat: 1.04, contrast: 1.04, temp: 0.06, tint: '#f8eed4' },
  highland: { lift: [0, 0.006, 0.01], gain: [1, 1.01, 1.01], sat: 0.98, contrast: 1.05, temp: 0, tint: '#eef2ee' },
  rock: { lift: [0, 0.005, 0.01], gain: [1, 1, 1.01], sat: 0.96, contrast: 1.05, temp: -0.01, tint: '#eceeee' },
  forest: { lift: [0, 0.01, 0.004], gain: [1.01, 1.02, 0.97], sat: 1.0, contrast: 1.06, temp: 0.04, tint: '#eef0dc' },
  emberwood: { lift: [0.006, 0.008, 0.002], gain: [1.02, 1.01, 0.96], sat: 0.97, contrast: 1.06, temp: 0.06, tint: '#f0eadb' },
  bastion: { lift: [0, 0.004, 0.01], gain: [0.99, 1, 1.01], sat: 0.94, contrast: 1.05, temp: -0.02, tint: '#e8ecee' },
  marsh: { lift: [0, 0.014, 0.008], gain: [0.98, 1.01, 0.98], sat: 0.9, contrast: 1.03, temp: -0.02, tint: '#dfe8d4' },
  hush: { lift: [0.008, 0.012, 0.02], gain: [0.98, 0.995, 1.02], sat: 0.84, contrast: 1.03, temp: -0.08, tint: '#e6ecf2' },
  snow: { lift: [0.008, 0.012, 0.024], gain: [0.98, 1, 1.03], sat: 0.9, contrast: 1.05, temp: -0.1, tint: '#e8f0ff' },
  tundra: { lift: [0.006, 0.01, 0.02], gain: [0.99, 1, 1.02], sat: 0.9, contrast: 1.04, temp: -0.07, tint: '#ecf2f8' },
  volcanic: { lift: [0.012, 0.004, 0], gain: [1.03, 0.99, 0.95], sat: 0.92, contrast: 1.07, temp: 0.08, tint: '#f4dccc' },
  ashfield: { lift: [0.01, 0.004, 0], gain: [1.02, 0.99, 0.96], sat: 0.88, contrast: 1.05, temp: 0.05, tint: '#eedfd4' },
  jungle: { lift: [0, 0.01, 0.004], gain: [0.99, 1.02, 0.98], sat: 1.02, contrast: 1.05, temp: 0.02, tint: '#e6f0d8' },
};

export const TIME_GRADE = {
  night: { lift: [0, 0.006, 0.02], gain: [0.97, 0.99, 1.04], sat: 0.88, contrast: 1.03, temp: -0.08 },
  dawn: { lift: [0.01, 0.005, 0], gain: [1.03, 1, 0.97], sat: 1.04, contrast: 1.03, temp: 0.08 },
  day: { lift: [0, 0, 0], gain: [1, 1, 1], sat: 1.02, contrast: 1.03, temp: 0 },
  sunset: { lift: [0.012, 0, 0], gain: [1.05, 0.99, 0.94], sat: 1.06, contrast: 1.05, temp: 0.12 },
  dusk: { lift: [0.008, 0, 0.018], gain: [1, 0.96, 1.04], sat: 1.02, contrast: 1.04, temp: -0.02 },
};

// Named camera setups for screenshots / ?vista= preview. Positions sit on
// overlooks and look toward landmarks at a chosen hour.
export const VISTA_SHOTS = {
  wash_dusk: { x: 16, y: 14, z: -308, lx: -160, ly: 42, lz: -320, time: 0.78, title: 'Wash · purple dusk' },
  wash_sunset: { x: 14, y: 18, z: -248, lx: 8, ly: 152, lz: 48, time: 0.74, title: 'Wash · sunset toward the Keystone' },
  keystone_day: { x: 36, y: 154, z: -92, lx: 8, ly: 136, lz: 48, time: 0.42, title: 'Keystone · day' },
  keystone_sunset: { x: -28, y: 108, z: -110, lx: 8, ly: 134, lz: 48, time: 0.745, title: 'Keystone · god-ray sunset' },
  keystone_night: { x: 18, y: 72, z: 176, lx: 8, ly: 132, lz: 48, time: 0.9, title: 'Keystone · starry night' },
  seamspire: { x: -90, y: 22, z: -290, lx: -160, ly: 26, lz: -320, time: 0.36, title: 'Seamspire Abbey' },
  widowneedles: { x: 1150, y: 14, z: -60, lx: 1215, ly: 45, lz: -122, time: 0.74, title: 'The Widowneedles' },
  nave_below: { x: -650, y: 9, z: -440, lx: -716, ly: 4, lz: -404, time: 0.28, title: 'The Nave Below' },
  stillkeep: { x: -908, y: 28, z: 1512, lx: -952, ly: 68, lz: 1568, time: 0.28, title: 'The Stillkeep' },
  ember_circlet: { x: 228, y: 16, z: -1312, lx: 340, ly: 64, lz: -1200, time: 0.73, title: 'The Ember Circlet' },
  green_needle: { x: 118, y: 66, z: 1335, lx: 82, ly: 58, lz: 1308, time: 0.4, title: 'The Green Needle' },
  salt_vista: { x: 20, y: 16, z: -188, lx: 8, ly: 150, lz: 48, time: 0.77, title: 'Saltreach · dusk vista' },
};

let registered = false;
export function registerVistaData() {
  if (registered) return;
  registered = true;
  for (const l of VISTA_LORE) {
    if (LORE_BY_ID[l.id]) continue;
    LORE.push(l);
    LORE_BY_ID[l.id] = l;
  }
  for (const loc of VISTA_LOCATIONS) {
    if (!LOCATIONS.some((x) => x.name === loc.name && x.x === loc.x && x.z === loc.z)) LOCATIONS.push(loc);
  }
}
