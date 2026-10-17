// Hightoll: the castle at the north end of the Hundred Arches. The Compact raised it as the
// post on the northern service road where the viaduct came ashore on the high country; the
// Anchors later crowned it, walled its court and put a toll on the road. When the low country
// sank, the spans south of it fell and Hightoll was left on its rock above the fen, its Bridge
// Gate opening on nothing. It is the "post ahead" of the service plate on span eight.
// Registered into world.js's STRUCTURES / LOCATIONS / SPAWNERS / CHESTS like greatBridge.js.
//
// Laid in the Arches' own frame, continued past their last pier (data/greatBridge.js
// archPoint): local x crosses the line (+x toward the Wash), local z runs on up it (+z north,
// away from the Arches). The rock's top is the road's height, so the Bridge Gate stands
// level with where the deck would have arrived. +x is WEST in world coordinates.
import { archPoint, ARCH_LENGTH, ARCH_YAW, ARCH_BAY, GREAT_BRIDGE } from './greatBridge.js';

export const HIGHTOLL = {
  id: 'hightoll',
  name: 'Hightoll',
  // the frame's origin, metres up the Arches' line past the south abutment: the rock's south
  // face stands clear of the last pier's footing, so the pier keeps its feet in the fen
  along: ARCH_LENGTH + 60,
  yaw: ARCH_YAW,
  top: GREAT_BRIDGE.deck, // the court, the gates and every floor on the rock stand on this
};

// World (x, z) of a point in Hightoll's frame. Same transform as kit.siteFrame at the origin.
export function tollPoint(lx, lz = 0) {
  return archPoint(HIGHTOLL.along + lz, lx);
}
const r1 = (v) => Math.round(v * 10) / 10;
const at = (lx, lz) => tollPoint(lx, lz).map(r1);
export const HIGHTOLL_ORIGIN = at(0, 0);

// ---------------------------------------------------------------- the rock
// Hightoll Rock: a column of the old high country left standing when the low country went
// down. Its crown is dead level at the court's height (an exact shelf, like Fort Meridian's);
// every face falls sheer to the fen, and no road climbs it. Outline in the frame, then carried
// into the world.
export const ROCK_OUTLINE = [
  [-24, -40], [-10, -47], [10, -48], [26, -45], [44, -41], [55, -30],
  [58, -8], [56, 14], [52, 33], [40, 45], [20, 50], [0, 49], [-14, 46],
  [-26, 38], [-31, 22], [-33, 2], [-31, -22],
];
const outline = ROCK_OUTLINE.map(([x, z]) => at(x, z));
const xs = outline.map((p) => p[0]), zs = outline.map((p) => p[1]);
export const HIGHTOLL_ROCK = {
  name: 'Hightoll Rock',
  x: r1((Math.min(...xs) + Math.max(...xs)) / 2), z: r1((Math.min(...zs) + Math.max(...zs)) / 2),
  rx: r1((Math.max(...xs) - Math.min(...xs)) / 2 + 2), rz: r1((Math.max(...zs) - Math.min(...zs)) / 2 + 2),
  h: HIGHTOLL.top, outline,
};

// The Land Gate: the castle's north gate, onto the road that went down with the low country.
// The descent line leaves from a landing built out over the drop in front of it.
export const HIGHTOLL_LAND_GATE = { x: 4, z: 49 };

// ---------------------------------------------------------------- the carrier lines
// When the spans went, the garrison strung cable across the breaks to carry reports and bread
// by basket, pier to pier, the way the crack reports used to walk. Nobody climbs to Hightoll:
// a traveller walks the south road from the Arches' Foot and rides the lines on up the Arches,
// hanging from a trolley, and leaves by the line that runs down from the Land Gate to the Reed
// Road below the Downs. Each runs one way, from `a` to `b`. `floor` is the height the rider
// stands on at each end (null: the ground there); the rider hangs LINE_HANG under the cable and
// is lifted onto it at the start.
export const LINE_HANG = 2.3;
export const LINE_LIFT = 1.6;
const DECK = GREAT_BRIDGE.deck;
const onArches = (bays, side = 0) => archPoint(ARCH_BAY * bays, side).map(r1);
const PIER_HALF = GREAT_BRIDGE.pierW / 2;
const line = (id, name, a, aFloor, b, bFloor, o = {}) => ({
  id, name, speed: o.speed ?? 16, sag: o.sag ?? 0.02,
  a: { x: a[0], z: a[1], floor: aFloor }, b: { x: b[0], z: b[1], floor: bFloor },
});
// where the descent line comes down: on the Reed Road where it leaves the Downs for the fen
const REED_ROAD_LANDING = [-196, -2];
export const HIGHTOLL_LINES = [
  // over the first great break: from the end of the south road to the lone pier, and on over
  // the stumps to the north road
  line('line_first_break', 'the lone pier', archPoint(ARCH_BAY * 7 + PIER_HALF + 3.2, 0).map(r1), DECK, archPoint(ARCH_BAY * 8 + 2.6, -1).map(r1), DECK),
  line('line_lone_pier', 'the north road', archPoint(ARCH_BAY * 8 + 3.6, -1).map(r1), DECK, archPoint(ARCH_BAY * 10 - 2.6, 0).map(r1), DECK),
  // from the north road's last pier over the fallen spans to the Bridge Gate
  line('line_to_hightoll', 'Hightoll', archPoint(ARCH_BAY * 15 + 2.9, 0).map(r1), DECK, at(2.5, -50.2), HIGHTOLL.top),
  // and down from the Land Gate to the Reed Road
  line('line_land_gate', 'the Reed Road', at(HIGHTOLL_LAND_GATE.x, 53.2), HIGHTOLL.top, REED_ROAD_LANDING, null, { speed: 14, sag: 0.02 }),
];

// ---------------------------------------------------------------- what lives there
// Places in the frame. The Bridge Court is where the castellan keeps the gate. The fire burns
// on the road's last metres outside the Bridge Gate, where the line from the Arches comes in:
// the last carters' fire, somewhere to sit and eat before going through.
export const HIGHTOLL_HOME = [-1, -19];
const [campX, campZ] = at(-3.4, -50.6);
export const HIGHTOLL_STRUCTURES = [
  { type: 'campfire', id: 'cf_hightoll', x: campX, z: campZ, y: HIGHTOLL.top, name: 'Hightoll, the Bridge Gate' },
];

const loc = (name, lx, lz, r) => { const [x, z] = at(lx, lz); return { name, x, z, r }; };
export const HIGHTOLL_LOCATIONS = [
  loc('Hightoll', 12, 0, 62),
  loc('The Bridge Court', 0, -19, 21),
];

// The garrison still walks the Arches' north road between the lines, and holds the court before
// the Toll Gate; the castellan waits in the Bridge Court, facing the gate the relief would have
// come through.
const spawn = (type, lx, lz, o) => { const [x, z] = at(lx, lz); return { type, x, z, ...o }; };
const [roadX, roadZ] = onArches(12.4, 0);
export const HIGHTOLL_SPAWNERS = [
  { type: 'hightoll_sentry', x: roadX, z: roadZ, count: 2, radius: 4, respawn: 240 },
  spawn('hightoll_sentry', 4, 11, { count: 2, radius: 5, respawn: 240 }),
  spawn('castellan', ...HIGHTOLL_HOME, { count: 1, radius: 1, respawn: 0, boss: true }),
];

// The castellan's strongbox in the keep's hall, and the toll box by the Toll House door.
const chest = (id, lx, lz, loot) => { const [x, z] = at(lx, lz); return { id, x, z, y: HIGHTOLL.top, loot }; };
export const HIGHTOLL_CHESTS = [
  chest('c_hightoll_keep', 46, -15, { silver: [200, 280], items: [['mantra_spark', 1], ['elixir', 2], ['smithing_stone', 2]] }),
  chest('c_hightoll_toll_box', 14, 27.4, { silver: [120, 190], items: [['iron_draught', 1], ['salt', 3]] }),
];

// Written sources. The notice is pinned inside the Land Gate; the daybook lies on the
// castellan's lectern in the hall; the crack register is a bronze plaque in the Bridge Gate
// (world/hightoll.js cuts it and registers it, like the Arches' service plate).
const src = (id, title, lx, lz, text, o = {}) => { const [x, z] = at(lx, lz); return { id, title, place: 'Hightoll', x, z, y: HIGHTOLL.top, text, ...o }; };
export const HIGHTOLL_LORE = [
  src('hightoll_toll_notice', 'Toll Notice at the Land Gate', -2.4, 38.4,
    'BY WARRANT OF THE FIRST ANCHOR. Every cart crossing at Hightoll pays the bell: one silver, or its weight in salt. Regulator crews on service pass free on showing the Compact\'s token at the gate. Pasted over it, peeling: By the same warrant, regulator crews pay at half. Tokens no longer honoured. Someone has scored the paper twice with a cart-hook, carefully, through the word half.'),
  src('hightoll_daybook', 'The Castellan\'s Daybook', 40, -14,
    'First night. The Arches went at the second bell, from the sea end. By morning the road south ended in the air under our gate. I have ordered the gate kept and the bell rung at the hours, so the crews on the north road know the post stands. Third winter. Nothing from the south. The men ask whether relief will come by water. I tell them relief comes by the road; that is what the order says. Thirty-first winter. The north road is iced shut and the regulator does not answer. We are a toll on a road with no carts. I ring the bell at evening all the same. If anyone out there is reporting a crack, they will know where to bring it. The last entry is in the same hand, very upright: Relief is late. The post is kept. The men have stopped asking, and none of us sleeps now; I do not know when we stopped. When the relief comes I will hand over the seal and the hammer and walk south. — O.'),
];
// The garrison's notice on the first line's mast, at the end of the Arches' south road.
const [lineNoteX, lineNoteZ] = archPoint(ARCH_BAY * 7 + PIER_HALF + 1.9, -3.6).map(r1);
export const CARRIER_LINE_NOTICE = {
  id: 'arches_carrier_line', title: 'Notice on the Carrier Line', place: 'The Hundred Arches', x: lineNoteX, z: lineNoteZ, y: DECK,
  text: 'CARRIER LINE TO THE POST. Reports, bread and baskets only, pier to pier. The post does not answer for anything that falls. Under it, in a carter\'s hand: It holds a grown man. It held me. And under that, newer, in chalk that the rain has not yet taken: STILL HOLDS.',
};
export const HIGHTOLL_REGISTER = src('hightoll_crack_register', 'Crack Register, Bridge Gate Plaque', -8.5, -34.6,
  'CRACKS REPORTED TO THE POST. REPORT TO THE POST AHEAD, NEVER THE POST BEHIND. Below it a century of cuts, span and place and hand: east springer, hairline. North parapet, a hand wide. Pier cap, sounds hollow. The cart lane, worse. The cart lane, worse again. The last line is cut deeper than the rest: ALL SPANS SOUTH OF THE GATE, DOWN. RELIEF REQUESTED. Nothing has been cut beneath it.');

// Named cameras for ?vista= previews (merged into VISTA_SHOTS by world/hightoll.js).
const shot = (from, y, to, ly, time, title) => ({ x: from[0], y, z: from[1], lx: to[0], ly, lz: to[1], time, title });
export const HIGHTOLL_SHOTS = {
  hightoll_wash: shot([-4, -346], 15.6, at(14, 0), 84, 0.36, 'Hightoll · from the Wash, where the drowned wake'),
  hightoll_dusk: shot([-4, -346], 15.6, at(-40, -160), 52, 0.74, 'Hightoll and the Hundred Arches · dusk from the Wash'),
  hightoll_gate: shot(at(0, -12), HIGHTOLL.top + 2.2, at(0, -160), HIGHTOLL.top - 16, 0.42, 'The Bridge Court · through the Bridge Gate'),
  hightoll_line: shot(onArches(15, -1.5), DECK + 2.2, at(8, -10), HIGHTOLL.top + 26, 0.38, 'The carrier line from the north road to Hightoll'),
  hightoll_descent: shot(at(HIGHTOLL_LAND_GATE.x, 47), HIGHTOLL.top + 2.4, REED_ROAD_LANDING, 10, 0.42, 'The descent line · from the Land Gate to the Reed Road'),
  hightoll_air: shot(at(150, -120), 170, at(12, 0), HIGHTOLL.top + 20, 0.42, 'Hightoll · on its rock at the end of the Arches'),
};

// ---------------------------------------------------------------- the crags and the meadow
// Hightoll Rock is not the only piece of the old high country left standing. Behind the castle
// a broken mass of it still rises higher than the crown, so from the Wash the castle stands on
// a spur of it rather than on a lone column. The stone parts along upright joints, which is
// what fissures the faces: each crag is a cluster of standing columns, tallest at its middle
// (`peak`) and falling away to `base` at its edge, over an ellipse of radii `rx` (across the line)
// and `rz` (along it). They keep off the Reed Road, which runs round behind the rock, and off
// the descent line's corridor north of the Land Gate (local x -6..26), and off Hobb's fire at
// the crossroads behind the rock (-24, 75). None stands between the castle and the town or the
// harbour. From the Wash the castle itself covers everything straight behind it, so the horn,
// the needle and the north ridge stand off to its left there, across the Reed Road, and the
// shoulder to its right behind the Arches' end; the spur behind it is for the other sides.
export const HIGHTOLL_CRAGS = [
  { id: 'spur', x: -60, z: 8, rx: 17, rz: 32, peak: 102, base: 32, seed: 11 },
  { id: 'horn', x: -66, z: 152, rx: 21, rz: 26, peak: 124, base: 34, seed: 23 },
  { id: 'needle', x: -13, z: 100, rx: 6, rz: 9, peak: 106, base: 52, seed: 29 },
  { id: 'north_ridge', x: -104, z: 116, rx: 15, rz: 24, peak: 96, base: 30, seed: 31 },
  { id: 'shoulder', x: -64, z: -50, rx: 17, rz: 19, peak: 94, base: 30, seed: 37 },
  // the saddle: lower joints that tie the rock's east face to the spur
  { id: 'saddle', x: -41, z: 14, rx: 6, rz: 34, peak: 66, base: 40, seed: 41 },
];
// The rock's own faces split the same way: columns standing proud of the outline's faces that
// look toward the Wash and the town (outward normal's local x over `facing`), one every
// `step` metres, their heads well under the crown (`top`, a range).
export const ROCK_JOINTS = { facing: 0.3, step: 6.5, top: [40, 56], seed: 53 };
// Below the rock on the Wash side, the meadow the post's road crossed before the fen took it:
// amber-leaved trees, outcrops, and what is left of the post's chapel and its watchtower,
// roofless since the low country sank. Frame coordinates, as above.
// Nothing of it goes within `clear` metres of the Oar Barrow and the Wash Prospect on the
// Seamspire Rise (147, -40), which keep their own ground.
export const HIGHTOLL_MEADOW = {
  chapel: { x: 104, z: 64, ry: 0.55 },
  tower: { x: 126, z: 30, r: 3.6, h: 13 },
  ruins: [[84, -24, 0.3], [138, 18, 1.2], [98, 112, 2.1], [152, 82, 0.8], [66, 88, 2.6]],
  trees: { count: 34, x: [52, 168], z: [-70, 140], seed: 61, gold: 0.75 },
  outcrops: [[70, 40, 7], [98, -62, 9], [162, 122, 8], [40, 128, 9], [-104, -74, 10], [86, 150, 7]],
  clear: [[150, -40, 30]],
};
