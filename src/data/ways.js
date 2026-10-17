// How routes show themselves (world/wayfinding.js). Outside the places people walk every
// day there is no painted road: the land, a cairn at a fork, a pole in the snow or a flight
// of steps cut into a climb says where people have gone before, and the rest is exploring.

// Ground worn by daily feet: lanes and flagstones show only inside these, fading out past
// their edge. Named after LOCATIONS (data/world.js) so they follow the settlement if it
// moves; `r` overrides a location whose named area is wider than its lived-in core.
export const SETTLEMENT_GROUNDS = [
  { name: 'The Wash', r: 34 },
  { name: 'Saltreach Town', r: 100 },
  { name: 'Saltreach Docks' },
  { name: 'Harbor Ward' },
  { name: 'East Bank' },
  { name: "Keepers' Terrace" },
  { name: "Sage's Rise" },
  { name: "Vowkeeper's Perch" },
  { name: 'Old Lighthouse' },
  { name: 'The Crucible' },
  { name: 'Millbrook' },
  { name: 'North Watch' },
  { name: 'Hollowbrook' },
  { name: 'Rook’s Landing' },
  { name: 'Brigand Hold', r: 40 },
  { name: 'Reedbank Village' },
  { name: "Moss's Landing" },
  { name: 'Frostwatch Village' },
  { name: "Hunter's Camp" },
  { name: 'Cinderstead' },
  { name: 'Cinder Camp' },
  { name: 'Canopy Landing' },
  { name: 'Vinewatch Camp' },
  { name: 'Fort Meridian' },
  { name: 'Meridian Ward' },
  { name: 'Meridian Docks' },
  { name: 'Hush Landing' },
  { name: 'The Sounding House' },
];

// Lanes fade to nothing over this many metres past a settlement's edge.
export const SETTLEMENT_FADE = 28;

// What marks a route out in the open, by road kind. `every` is the longest stretch (m) a
// traveller walks without a sign; forks, bends and climbs get one regardless.
//   cairn  - stacked fieldstones, the oldest way of saying "people came this way"
//   pole   - hunters' marker poles with a rag tied on, tall enough to stand out of drifts
//   basalt - stacked basalt with a scorched rag; ash buries anything lower
//   paving - surviving runs of the Compact's cut-stone road, broken and sunk
//   withy  - willow stakes driven into the fen to mark firm ground (Reed Covenant practice)
export const WAY_MARKS = {
  dirt: { mark: 'cairn', every: 125 },
  stone: { mark: 'paving', every: 70 },
  snow: { mark: 'pole', every: 38 },
  ash: { mark: 'basalt', every: 100 },
  marsh: { mark: 'withy', every: 32 },
};

// A climb steeper than this along a way gets steps cut into it (when the terrain does not
// already report its passes), held over at least `STEP_SPAN` metres.
export const STEP_GRADE = 0.3;
export const STEP_SPAN = 4;
