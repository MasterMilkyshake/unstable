// Every carrier line in the world (world/ziplines.js strings them, game/ziplines.js rides them):
// Hightoll's lines (data/hightoll.js) and the ones the coast's own people rigged since. Final
// world metres (+x west), not remapped.
//
// A line runs one way, from `a` to `b`; a way back is a second line. Its ends stand on the
// ground, on a floor given in metres, or on the top of a STATION (`station: id`): a timber
// tower or stage built for the line, whose top is the floor there. A line that climbs is a
// hauling line: the trolley is drawn up by the weight of a counterweight at the top (`haul`),
// slower than a run downhill.
import { HIGHTOLL_LINES } from './hightoll.js';

const line = (id, name, a, b, o = {}) => ({
  id, name, speed: o.speed ?? 14, sag: o.sag ?? 0.006, haul: !!o.haul,
  a: { x: a[0], z: a[1], floor: a[2] ?? null, station: a[3] ?? null },
  b: { x: b[0], z: b[1], floor: b[2] ?? null, station: b[3] ?? null },
});

// Timber stations: square towers with a stair up one side (a gangway) or round all four (a
// wrap, where there is no room for a gangway), and an open platform on top, or a low stage. `h` is the platform's height over the ground at its centre; `yaw` turns
// the stair's side; `banner` hangs a cloth from the top (the Redwake's red, seen over the pines
// from Rook's Landing's pier).
export const LINE_STATIONS = [
  // The Wash: the salvagers' rigging tower on the camp's terrace, built of ships' timber, from
  // which the first line runs to the Wash Prospect over the dunes (P2).
  { id: 'wash_rig', name: 'The Rigging Tower', x: 7, z: -334, h: 8.4, w: 3.8, yaw: 0, palette: 'salt', banner: '#d8c8a0' },
  // Brigand Hold: the crews' lookout behind the Red Gate's north tower, on the Red Trail's line
  // so that its banner shows over the pines from Rook's Landing's pier (data/vistas.js
  // SIGHTLINES keeps the trees out of that line), and the haul line up to the Watchfire on the
  // ridge (P1, P3). Its stair runs inside the stockade, north of the way in from the gate.
  { id: 'hold_lookout', name: 'The Red Lookout', x: 1322.5, z: 140, h: 9, w: 3.8, yaw: 0, palette: 'redwake', banner: '#a8281c', pole: 9, stair: 'wrap', brazier: true },
  // the Watchfire's landing stage, where the line from the Hold comes in and the one back leaves
  { id: 'watchfire_stage', name: 'The Watchfire Stage', x: 1490, z: 251, h: 3, w: 4.2, yaw: Math.PI, palette: 'redwake', stage: true },
];
export const STATION = Object.fromEntries(LINE_STATIONS.map((s) => [s.id, s]));

export const COAST_LINES = [
  // P2: from the rigging tower over the dunes and the fen's edge to the Wash Prospect
  line('line_wash_prospect', 'the Wash Prospect', [7, -334, null, 'wash_rig'], [-171, -246], { speed: 12, sag: 0.004 }),
  // P1: up from the Red Lookout to the Watchfire, and back down
  line('line_watchfire', 'the Redwake Watchfire', [1322.5, 140, null, 'hold_lookout'], [1490, 251, null, 'watchfire_stage'], { speed: 9, haul: true }),
  line('line_watchfire_down', 'Brigand Hold', [1490, 251, null, 'watchfire_stage'], [1322.5, 140, null, 'hold_lookout'], { speed: 14 }),
];

export const CARRIER_LINES = [...HIGHTOLL_LINES, ...COAST_LINES];

// The floor an end stands on: its station's top, its own floor, or the ground.
export function endFloor(end, groundAt) {
  if (end.station) {
    const s = STATION[end.station];
    return groundAt(s.x, s.z) + s.h;
  }
  return end.floor ?? groundAt(end.x, end.z);
}
