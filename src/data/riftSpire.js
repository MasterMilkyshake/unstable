// The Ascent: the only living way out of the Rift. Data only — world and
// runtime live in world/riftSpire.js and game/riftSpire.js.
import { LOCATIONS, SPAWNERS } from './world.js';
import { DIALOGUES, questHub } from './npcs.js';
import './riftResearch.js';
import { QUESTS } from './quests.js';
import { LORE, LORE_BY_ID } from './lore.js';
import { CHRONICLE, INVESTIGATIONS, INVESTIGATION_BY_ID, ATLAS } from './chronicle.js';
import { placeCatalog } from './worldPlacement.js';
import { RIFT_LANDMARKS } from './rift.js';

export const SPIRE = {
  x: RIFT_LANDMARKS.citadel.x,
  z: RIFT_LANDMARKS.citadel.z,
  half: 3.6,
  radius: 28,
  summitH: 112,
};

const CX = SPIRE.x;
const CZ = SPIRE.z;
const H = SPIRE.half;

// Platforms sit on the cardinals so stacked floors do not steal each other's groundAt.
export const SPIRE_TIERS = [
  { id: 'base', h: 0.35, x: CX, z: CZ, r: 18, label: 'The Ascent' },
  { id: 't1', h: 16, x: CX, z: CZ - H - 5.1, r: 7, climb: 'n', label: 'First Stair' },
  { id: 't2', h: 32, x: CX + H + 5.1, z: CZ, r: 7, climb: 'e', label: 'Second Stair' },
  { id: 't3', h: 48, x: CX, z: CZ + H + 5.1, r: 7, climb: 's', label: 'The Guarded Landing' },
  { id: 't4', h: 64, x: CX - H - 5.4, z: CZ, r: 8, climb: 'w', label: 'The Hanging Keep' },
  { id: 't5', h: 80, x: CX, z: CZ - H - 5.4, r: 7, climb: 'n', label: 'The Thin Stair' },
  { id: 't6', h: 96, x: CX + H + 5.1, z: CZ, r: 7, climb: 'e', label: 'The Last Stair' },
  { id: 'summit', h: 112, x: CX, z: CZ, r: 9, label: 'The Summit' },
];

export const SPIRE_TIER = Object.fromEntries(SPIRE_TIERS.map((t) => [t.id, t]));

export const SPIRE_LORE = [
  {
    id: 'ascent_charter', title: 'The Only Door', place: 'The Ascent',
    x: CX - 7.4, z: CZ - 19.6, prop: 'carving',
    text: 'The pale gates were tears we framed so a soul could climb back through. The lattice has forgotten they were doors. If you are reading this you are standing on the replacement: a spine we raised from the floor toward the sea, and against its keep a lift that carries the living to the top. Ride it. The summit is still a wound; step through. Die down here and you do not wake. That is the whole rule.',
  },
  {
    id: 'ascent_year57', title: "A Climber's Page", place: 'Second Stair',
    x: SPIRE_TIER.t2.x + 1.6, z: SPIRE_TIER.t2.z - 1.2, prop: 'letter',
    text: 'Year 57 tried a rope into a room that was also a pit. We are building a stair the works will accept — ledges the grip can rest on, landings a name can hold. If your hands give out, that is the design confessing its height, not your failure. Sit. Breathe. Climb the next face. The hanging keep is not the top.',
  },
  {
    id: 'ascent_keep', title: 'Keep That Learned to Be a Stair', place: 'The Hanging Keep',
    x: SPIRE_TIER.t4.x - 1.4, z: SPIRE_TIER.t4.z + 2.0, prop: 'carving',
    text: 'They built this citadel to hold the chain. When the Duke let go it fell up and hung, a command station with no crew. We ran a spine through its belly so the living could use a keep that would not come down. The knights on this landing still think they are guarding a throne. They are guarding a landing. Pass them or put them down. Do not swear anything here.',
  },
  {
    id: 'ascent_thin_air', title: 'The Air Gets Honest', place: 'The Last Stair',
    x: SPIRE_TIER.t6.x - 1.8, z: SPIRE_TIER.t6.z + 1.4, prop: 'letter',
    text: 'You are close enough to the underside of the sea that the mind starts agreeing with the lattice. That pressure is not a curse laid on the climb. It is the room remembering it used to be a ceiling. Drink if you brought a draught. The last face is shorter than the fear. The summit is a door that only opens for people who finish.',
  },
  {
    id: 'ascent_summit', title: 'A Door That Faces Down', place: 'The Summit',
    x: CX + 4.2, z: CZ - 3.6, prop: 'carving',
    text: 'Stand in the wound. The water overhead is the floor of the country you fell from. Step through and you are a person in air again. The lift will be waiting in the courtyard the next time the Rift takes you. If you came here to leave, leave. If you came here to measure, copy this and take it to Cael. A mapped wound can be tended.',
  },
];

export const SPIRE_QUESTS = {
  the_only_door: {
    name: 'The Only Door', giver: 'cael',
    desc: 'The pale gates have closed. Cael wants you up the Ascent: a stone lift against the hanging keep carries the living to its summit, and the wound there is the only living way home.',
    objectives: [{ type: 'flag', flag: 'rift_ascent_conquered', text: 'Reach the summit of the Ascent and step through the wound' }],
    rewards: { xp: 1600, silver: 220, items: [['sanity_draught', 2], ['rift_shard', 3]] },
    turnIn: 'cael',
  },
};

const SPIRE_CHRONICLE = [
  {
    id: 'the_ascent', category: 'Rift Research', title: 'A stair through a hanging keep',
    subtitle: 'Why the pale gates closed, and what replaced them', evidence: ['ascent_charter'],
    paragraphs: [
      'The east and west wounds were framed as doors. The lattice has forgotten that courtesy. The living way home is now a single climb: a spine raised from the Rift floor through the inverted citadel, toward the sea that hangs as a ceiling.',
      'The restorers hung one stone lift against the keep, from the courtyard to the summit, and it still runs for anyone who reaches its cage. The spine\'s faces are the long way round, past guarded landings, and the mind thins as you near the underside. No fire burns down here and a death in the Rift is final: escaping alive means reaching the wound.',
    ],
  },
];

const SPIRE_INVESTIGATION = {
  id: 'the_ascent', title: 'The Ascent', tier: 'R · The only door',
  evidence: ['ascent_charter', 'ascent_year57', 'ascent_keep', 'ascent_thin_air', 'ascent_summit'],
  question: 'If the pale gates closed, how do the living leave the Rift?',
  conclusion: 'They rise. The hanging citadel is a command station run through with a spine, and against its keep the restorers hung a stone lift that carries the living from the courtyard to a summit wound that still opens onto the surface. Notes on the spine\'s landings are a survey of the old climb. The old east and west tears do not open.',
  reward: { xp: 900, silver: 160, items: [['sanity_draught', 2]] },
};

export const SPIRE_LOCATIONS = [
  { name: 'First Stair', x: SPIRE_TIER.t1.x, z: SPIRE_TIER.t1.z, r: 9 },
  { name: 'The Guarded Landing', x: SPIRE_TIER.t3.x, z: SPIRE_TIER.t3.z, r: 9 },
  { name: 'The Hanging Keep', x: SPIRE_TIER.t4.x, z: SPIRE_TIER.t4.z, r: 10 },
  { name: 'The Last Stair', x: SPIRE_TIER.t6.x, z: SPIRE_TIER.t6.z, r: 9 },
  { name: 'The Summit', x: CX, z: CZ, r: 12 },
];

// The spire stands on the Precincts' middle terrace (data/riftCity.js, h 10.6); a landing's floor
// is that plus its tier height, and its guards stand on it (`y`), not on the keep floor under it.
export const SPIRE_GROUND = 10.6;
// Guards keep two landings on the climbing route, the Hanging Keep and the Last Stair. The lift
// runs from the courtyard to the summit past every landing, and a newcomer must be able to ride
// out (the user's call, 2026-10-15); the Guarded Landing's and the Thin Stair's old guards keep
// watch elsewhere in the Rift (data/rift.js).
export const SPIRE_SPAWNERS = [
  { type: 'drowned_knight', x: SPIRE_TIER.t4.x - 1.6, z: SPIRE_TIER.t4.z, y: SPIRE_GROUND + SPIRE_TIER.t4.h, count: 1, radius: 2.4, respawn: 200 },
  { type: 'hollow', x: SPIRE_TIER.t6.x + 1.4, z: SPIRE_TIER.t6.z, y: SPIRE_GROUND + SPIRE_TIER.t6.h, count: 1, radius: 2.6, respawn: 160 },
];

placeCatalog(SPIRE_LORE);
placeCatalog(SPIRE_LOCATIONS);
placeCatalog(SPIRE_SPAWNERS);

for (const l of SPIRE_LOCATIONS) LOCATIONS.push(l);
for (const s of SPIRE_SPAWNERS) SPAWNERS.push(s);
for (const l of SPIRE_LORE) {
  LORE.push(l);
  LORE_BY_ID[l.id] = l;
}
Object.assign(QUESTS, SPIRE_QUESTS);

const citadel = LOCATIONS.find((l) => l.name === 'The Inverted Citadel');
if (citadel) {
  citadel.name = 'The Ascent';
  citadel.r = 44;
}

const riftAtlas = ATLAS.find((a) => a.id === 'rift');
if (riftAtlas) {
  riftAtlas.life = 'The Hollow Man still trades fragments at the arrival shelf. The pale gates have closed; the Ascent, the spine rising out of the keep at the heart of the Drowned Precincts, is the only living way home. Since Year 113, three living camps occupy the dark: Cael\'s scholars under the Wash where their cable comes down, Quill\'s survey stakes west of the processional, and Vesper\'s Order watch outside the city\'s east wall. Abandoned canvas from Year 57 still holds journals on the high plateau. A progress of recovered notes lives in this Journal under Investigations.';
  riftAtlas.route = 'Walk the processional between the Kneeling to the Great South Gate; the Ascent stands at the head of the Gate Plaza beyond it. Go through the keep\'s gate hall and out its north door: a stone lift against the keep\'s north wall carries you from the courtyard to the summit, and the Wound there is the way out. The Bastion Gate leads west to the bridge over the Sundering, the Garrison Gate east to the knights\' terraces, the processional stair north through the citadel to the Chainward. The Glyph Circle and the Sealed Vault lie west under the high plateau; the Folded Court and the Pre-Rift Works east, below the walls. A gate east of the city opens only when sanity is thin.';
}

CHRONICLE.push(SPIRE_CHRONICLE[0]);
const capstone = INVESTIGATIONS.findIndex((e) => e.id === 'common_memory');
INVESTIGATIONS.splice(capstone >= 0 ? capstone : INVESTIGATIONS.length, 0, SPIRE_INVESTIGATION);
INVESTIGATION_BY_ID[SPIRE_INVESTIGATION.id] = SPIRE_INVESTIGATION;

const origCael = DIALOGUES.cael;
DIALOGUES.cael = (api) => {
  const node = origCael(api);
  const extra = questHub(api, [{
    id: 'the_only_door', offer: 'How do the living leave?', title: 'The Only Door',
    pitch: 'The pale gates closed. The tears we framed have forgotten they were doors. The hanging keep is the way now — a spine from this floor to the sea\'s underside, and a stone lift on its north wall that still runs. Ride it to the summit and step through the wound. Die down here and you do not wake. That is the whole rule.',
    active: 'The citadel. Through the gate hall and out the north door: the lift waits in the courtyard against the wall. Do not trust the old east and west wounds.',
    done: 'You came back with air in you. If the Rift takes you again, the lift will still be waiting in the courtyard.',
  }]);
  if (Array.isArray(node.options) && extra.length) node.options.unshift(...extra);
  return node;
};

