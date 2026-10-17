// The ledge-built world (docs/agent/WORLD_LIFE_PLAN.md): authored climbing lines up the
// world's faces, and the hidden stairs that keep the high tiers within reach of anyone who
// looks. Final world metres (+x west), not remapped. world/ledges.js builds them.
//
// A LINE climbs from `foot` toward `yaw` (radians, the direction faced while climbing, as
// Math.atan2(dx, dz)). The builder walks in from the foot to the face and up it to the shelf
// top, then stacks treads `d` metres deep, `w` wide, stepping back into the face: each lip a
// pale capstone with a moss edge, the catchable edge of ADR-007's latch. `pitches` are the
// heights of each riser, bottom first; the last is whatever is left to the shelf's top, so
// the face decides it. `chain` is the most latches any one pitch takes (tests/ledges.test.js
// holds each line to it): 1 up to 3.4 m, 3 at 4.6-5.0 m, 4 at 6.0-6.2 m, 5 at 7.0-7.2 m.
//
// A STAIR is a hidden way up for a three-latch climber: rough steps cut along the foot of the
// face from `foot` toward `yaw` to the top, with no capstones (it is walked, not climbed).
export const LEDGE_LINES = [
  // ---------------------------------------------------------------- the Wash and Saltreach
  // S1, the Barrow Steps: the first climb, from the strand west of the abbey up the Seamspire
  // spur's south face to the Oar Barrow and the Wash Prospect. Four short pitches.
  { id: 'barrow_steps', name: 'The Barrow Steps', foot: [-182, -287], yaw: 0, w: 2.8, pitches: [2.7, 2.7, 2.7, 2.7], chain: 1, leads: 'the Oar Barrow, its carving and chest, and the Wash Prospect' },
  // S2, the Seamspire Chimney: from the spur by the Barrow up the summit's east face. One
  // pitch wants two hops on time: a fresh climber can, with care.
  { id: 'seamspire_chimney', name: 'The Seamspire Chimney', foot: [-237, -276], yaw: 4.71, pitches: [3.0, 4.8], chain: 3, leads: 'the Seamspire summit and its cairn, over the Arch Mere and the Arches' },
  // S3, the Lampwright's Stair: from the Lamp Bluff up the east face of its crown, where the
  // city's first lamp was lit. The long pitch wants a fourth latch.
  { id: 'lampwright_stair', name: "The Lampwright's Stair", foot: [-93, 232], yaw: 4.71, pitches: [3.0, 6.1], chain: 4, leads: "the Lampwright's Crown: the first lamp's ruin, a rimefang den, a High chest" },
  // S4, the Kestrel Face: a shortcut up Kestrel Heights' last step to the beacon, for a climber
  // with five latches; everyone else takes the Kestrel Climb road.
  { id: 'kestrel_face', name: 'The Kestrel Face', foot: [-175.7, 403.7], yaw: 5.5, pitches: [3.0, 7.0], chain: 5, leads: 'the Kestrel Beacon, by the short way' },
  // ---------------------------------------------------------------- Thornwood, Meridian and the Ashen Spire
  // T1, the Thorn Crown steps: from the Redwake upland up the Crown's south-east corner.
  { id: 'thorn_crown_steps', name: 'The Thorn Crown Steps', foot: [1395.7, 63.7], yaw: 0.79, pitches: [4.7], chain: 3, leads: 'the Thorn Crown, down on the Hold\'s yard' },
  // T2, Widow's Teeth: Widow Ridge's south crag, from the ridge road's pass.
  { id: 'widow_teeth', name: "Widow's Teeth", foot: [1354.3, -465.7], yaw: 3.93, pitches: [3.1, 6.1], chain: 4, leads: "the south crag: a deserters' camp, a High chest, the bastion and the sea below" },
  // T3, the Basalt Stair: up a jointed column of the old lava on the Ashen Spire's ashfield.
  { id: 'basalt_stair', name: 'The Basalt Stair', foot: [686, -1062], yaw: 1.57, pitches: [3.0, 3.4, 4.9], chain: 3, leads: "a column's top with a chest, and the cone filling the view" },
  // T4, the Ember Circlet: from the cone's west summit shelf straight up the rim's sheer outer
  // face, a shortcut onto the crest the Attendants Road reaches only by the crater's inside.
  { id: 'ember_circlet', name: 'The Ember Circlet', foot: [281, -1215], yaw: 1.5708, pitches: [3.0, 3.0, 3.0, 3.0, 7.0], chain: 5, leads: 'the caldera\'s rim from outside, over the Colossus\'s floor' },
  // T5, the Lookout Steps: from the landing stone at the foot of the sea stack off the Westwold
  // up its landward face to the Redwake's lookout. A built face; reached by boat or a swim.
  { id: 'lookout_steps', name: 'The Lookout Steps', foot: [1838.4, 30], yaw: 1.5708, pitches: [3.0, 4.7, 3.2], chain: 3, structure: true, leads: "the Redwake's lookout on the sea stack off the Westwold: its crew and a Heights chest" },
  // ---------------------------------------------------------------- Frosthollow and the Hush
  // F0, the Vigil Steps: up into the White Hollow, the Frost Warden's floor, by short pitches.
  { id: 'vigil_steps', name: 'The Vigil Steps', foot: [-995, 1461], yaw: 0, pitches: [3.0, 3.0, 3.0, 3.0, 3.0], chain: 1, leads: "the White Hollow and the Warden's vigil" },
  // H2, the Chair Steps: from the Chair Fields up the moor's next step toward the Sounding House.
  { id: 'chair_steps', name: 'The Chair Steps', foot: [-1224.3, 1017.7], yaw: 0.79, pitches: [2.7], chain: 1, leads: 'the moor above the Chair Fields, the short way to the Sounding House' },
  // F2, the Hunters' Chimney: from the great shelf up the east face of its crown, where the
  // frost stalkers den. The long pitch wants a fourth latch.
  { id: 'hunters_chimney', name: "The Hunters' Chimney", foot: [-1147, 1531], yaw: 4.71, pitches: [3.0, 3.0, 3.0, 6.1], chain: 4, leads: "the great shelf's crown: a frost stalkers' den, a High chest, the White Hollow from above" },
  // F3, the Hatch Steps: from Rimejaw's meadow up the 7 m face of the shelf where the Bell Under
  // Ice's hatch is, by short pitches: the dungeon's door must be in anyone's reach.
  { id: 'hatch_steps', name: 'The Hatch Steps', foot: [-1320, 1757], yaw: 3.1416, pitches: [2.4, 2.3], chain: 1, leads: 'the shelf of the Bell Under Ice and its hatch' },
  // ---------------------------------------------------------------- the Verdance
  // V0, the Rootstair: up the roots to Kingsfall's shelf, where the Old King keeps his fall.
  { id: 'rootstair', name: 'The Rootstair', foot: [-36.2, 1271.8], yaw: 0.79, pitches: [3.2, 3.2, 3.2], chain: 1, leads: 'Kingsfall and the Old King' },
  // V1, the Gallery Face: from the jungle floor up the northern range to its first terrace, the
  // Mossbound's lookout over the canopy. The long pitch wants a fourth latch.
  { id: 'gallery_face', name: 'The Gallery Face', foot: [-30, 1590], yaw: 0, pitches: [3.0, 3.0, 3.0, 3.0, 6.1], chain: 4, leads: "the Root Gallery: the Mossbound's lookout, a High chest, the canopy below" },
  // ---------------------------------------------------------------- the islets
  // I2: up Gallows Rock from its beach to the empty cages, without the Enclave's own landing
  { id: 'gallows_steps', name: 'The Gallows Steps', foot: [418, -368], yaw: 0, pitches: [2.8, 2.6], chain: 1, leads: 'the cages and their notice' },
  // I1, the Kneeling Steps: up the west face of the Anchor's Fall's plinth from the islet's
  // grass, to the stone the statue kneels on and the salvagers' cache behind its heel. A built
  // face (`structure`): its heights are the plinth's, not the ground's.
  { id: 'kneeling_steps', name: 'The Kneeling Steps', foot: [-17, 720], yaw: 1.5708, pitches: [2.0], chain: 1, structure: true, leads: "the Anchor's plinth and the cache at the statue's heel" },
  // S6: from Saint Ebb's south strand to the light's ledge
  { id: 'ebb_steps', name: "Saint Ebb's Steps", foot: [-319.2, -645.2], yaw: 0.79, pitches: [2.5], chain: 1, leads: "the light's ledge and the keeper's chest" },
];
export const LEDGE_STAIRS = [
  // the Lampwright's Crown, from the bluff's south apron: the lamp-keepers' own scaffold
  { id: 'lampwright_scaffold', name: "The Lamp-keepers' Scaffold", kind: 'scaffold', foot: [-122, 146], yaw: 0, palette: 'salt' },
  // Widow's south crag, from the ridge's far side: the deserters' ladder-stage
  { id: 'widow_scaffold', name: "The Deserters' Stage", kind: 'scaffold', foot: [1324, -429], yaw: 3.14, palette: 'enclave' },
  // the great shelf's crown, from its north-east foot: the hunters' hoist
  { id: 'hunters_hoist', name: "The Hunters' Hoist", kind: 'scaffold', foot: [-1187, 1497], yaw: 0.79, palette: 'salt' },
  // the Root Gallery, from the jungle floor: the Mossbound's root ladder
  { id: 'root_ladder', name: 'The Root Ladder', kind: 'scaffold', foot: [-64, 1600], yaw: 0, palette: 'redwake' },
];

// The pitch bands, and the chain each holds a pitch to (WORLD_LIFE_PLAN.md).
export const PITCH = { 1: [1.4, 3.4], 3: [4.5, 5.1], 4: [5.9, 6.25], 5: [6.9, 7.25] };
