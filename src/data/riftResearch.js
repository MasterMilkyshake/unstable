// Rift-only research content: expeditions, mysteries, lore, quests, NPCs.
// Pushes onto existing catalogs at import time so surface files stay untouched.
import { NPCS, LOCATIONS, SPAWNERS, CHESTS } from './world.js';
import { DIALOGUES, questHub } from './npcs.js';
import { QUESTS } from './quests.js';
import { ITEMS } from './items.js';
import { LORE, LORE_BY_ID, BESTIARY_NOTES } from './lore.js';
import { CHRONICLE, INVESTIGATIONS, INVESTIGATION_BY_ID, ATLAS } from './chronicle.js';
import { placeCatalog } from './worldPlacement.js';
import { G } from '../core/globals.js';

// Each site stands in open ground with room for its set piece (world/riftCamps.js and
// world/riftMysteries.js). The living camps sit under the cracks they came down; the sealed
// things lie out past the walls, where the kingdom left them.
export const RIFT_SITES = {
  scholar: { x: 5960, z: 5856 }, // under the Wash's east end, where Cael's cable comes down
  survey: { x: 6070, z: 5900 }, // Quill's station on the open floor west of the processional
  order: { x: 5870, z: 5990 }, // Vesper's watch outside the east wall, on the Garrison's road
  year57: { x: 6136, z: 6088 }, // the abandoned camp on the high plateau
  rope: { x: 6164, z: 6054 }, // the rope into the sinkhole, beside the Chainward–Bastion road
  scout: { x: 5812, z: 6068 }, // the overdue marker under the Garrison's south wall
  glyphs: { x: 6130, z: 5998 }, // the glyph circle before the Sealed Vault
  vault: { x: 6130, z: 6014 }, // the threshold of the door cut into the plateau's cliff
  fold: { x: 5904, z: 5872 }, // the Folded Court, out on the east floor
  prerift: { x: 5860, z: 5948 }, // the pre-Rift works below the city's east wall
  whisper: { x: 5842, z: 5906 }, // the gate that opens for the thin
  archive: { x: 5828, z: 5893 },
};

const S = RIFT_SITES;
const bye = { label: 'I will keep looking.' };

Object.assign(ITEMS, {
  lattice_sample: {
    name: 'Lattice Sample', type: 'quest', price: 0,
    desc: 'A core of Rift-stone that still ticks, slow as a buried clock. Cael wants three.',
    icon: '💠',
  },
  survey_plate: {
    name: 'Survey Plate', type: 'quest', price: 0,
    desc: 'A brass plate stamped with bearings. Quill can finish a map from two of them.',
    icon: '🧭',
  },
  order_dispatch: {
    name: 'Order Dispatch', type: 'quest', price: 0,
    desc: 'A sealed strip of drowned-blue wax. The scout who carried it did not come back.',
    icon: '📜',
  },
});

export const RIFT_RESEARCH_LORE = [
  {
    id: 'charter_of_descent', title: 'Charter of Descent', place: "Scholar's Landing",
    x: S.scholar.x + 2.2, z: S.scholar.z - 1.4, prop: 'book',
    text: 'We are not here to die more slowly. We are here to measure. The Keepers call this place a wound. The Order calls it a post. I call it a room the world built and then forgot it was standing in. Copy every mark. Name every camp. If the living stop coming down, the Rift will have no witnesses left but the Duke.',
  },
  {
    id: 'quill_fieldbook', title: "Quill's Fieldbook", place: 'Cartographer\'s Stake',
    x: S.survey.x - 1.6, z: S.survey.z + 1.8, prop: 'book',
    text: 'Bearings refuse to agree with themselves. A line I walked yesterday is shorter today, or I am. I plant stakes painted with lamp-soot and number them. If the ground moves, the numbers will confess. Year 113, third descent. The ceiling is the sea. I am mapping the underside of a country.',
  },
  {
    id: 'vesper_watch', title: "Vesper's Watch-Book", place: 'Order Watch',
    x: S.order.x + 1.8, z: S.order.z + 1.2, prop: 'letter',
    text: 'The drowned knights still hold a keep that has no king worth holding it for. My brief is not to relieve them. My brief is to count them, and to keep the scholars from walking into a relief that will never come. If you find this book in someone else\'s hands, I am overdue. Do not follow my last heading without a draught.',
  },
  {
    id: 'year57_log', title: 'Year 57 Expedition Log', place: 'The Lost Camp',
    x: S.year57.x - 2.0, z: S.year57.z + 1.6, prop: 'book',
    text: 'Day eleven. The Keep is a command station, not a castle. Day fourteen. We found a bell that was never allowed to ring. Day twenty. The surveyor swears the stairs go down and arrive above us. Day twenty-two. We are going to the place that only answers when the mind is thin. If we do not write again, tell Saltreach the Rift is not under the sea. The sea is under a roof we used to walk on.',
  },
  {
    id: 'rope_last', title: 'Last Page on the Rope', place: 'The Rope Descent',
    x: S.rope.x + 1.4, z: S.rope.z - 1.8, prop: 'letter',
    text: 'The pit is not a pit. The rope hangs into a room whose floor is the same as this one, seen from the other face. I can hear the Year 57 crew calling measurements to each other. They have been calling for fifty-six years. I am going to answer. I have tied the rope twice. If the knot is still here, I was wrong about the room.',
  },
  {
    id: 'scout_farewell', title: "A Scout's Farewell", place: 'Overdue Marker',
    x: S.scout.x + 0.8, z: S.scout.z - 1.2, prop: 'letter',
    text: 'Vesper: the west stair is a lie. The knights let me pass because I was carrying a relief they can no longer read. I am leaving the dispatch under the leaning stake. Do not send another pair. Send a scholar who can tell a door from a wound. I can hear the withheld bell in the stone. It is still waiting for permission.',
  },
  {
    id: 'lira_pages', title: "Lira's Remaining Pages", place: 'The Lost Camp',
    x: S.year57.x + 2.4, z: S.year57.z - 0.8, prop: 'book',
    text: 'I followed Year 57 and became Year 57. The others walked into a geometry that would not choose a single up. I stayed because someone has to keep the fire, even a dead one. If a living person is reading this: take my bearings to Cael. Tell Quill the eastern stakes have drifted two bodies toward the Wound. Tell Vesper her scout reached the west stair and chose to write instead of return.',
  },
  {
    id: 'hollow_fieldnote', title: 'Field Note: Hollows', place: "Scholar's Landing",
    x: S.scholar.x - 2.6, z: S.scholar.z + 2.0, prop: 'letter',
    text: 'Hollows are not demons. They are people the lattice finished remembering incorrectly: a gait, a hunger, no name. Each blow they land is the works asking whether you are still a person it can file. Do not waste pity in the moment. Waste it afterward, in the journal, where it cannot get you killed.',
  },
  {
    id: 'glyph_litany', title: 'Litany of the Four Marks', place: 'The Glyph Circle',
    x: S.glyphs.x, z: S.glyphs.z + 7.2, prop: 'carving',
    text: 'BREATH upon the living filter. BURDEN upon the paired regulators. BREAK when a crown refused to share the load. BELL that was withheld, and is withheld still. Trace them in the order the night happened, not the order a priest would prefer. The vault remembers sequence. It has forgotten mercy.',
  },
  {
    id: 'vault_warning', title: 'Sealed Inversion', place: 'The Sealed Vault',
    x: S.vault.x + 3.4, z: S.vault.z + 0.6, prop: 'carving',
    text: 'COMPACT STATION C-4. Access while the command chain is live. Access while the mind is unshaped is a fault, not a key — unless the works themselves have come unshaped. If you can read this, the seal is still performing a duty whose master has been dead for a century.',
  },
  {
    id: 'folded_stair', title: 'A Stair With Two Downs', place: 'The Folded Court',
    x: S.fold.x - 1.2, z: S.fold.z + 2.4, prop: 'carving',
    text: 'The masons cut a service stair through the lattice so a crew could walk from the dry docks to the keep without crossing the royal road. When the chain snapped, up and down traded places without informing the stair. You may climb it forever and arrive in the room you left. The trick is not to finish. The trick is to step off where the world disagrees with itself.',
  },
  {
    id: 'prerift_station', title: 'Station Plate, Undated', place: 'Pre-Rift Works',
    x: S.prerift.x + 1.6, z: S.prerift.z - 2.0, prop: 'carving',
    text: 'Let the north keep the cold, the furnace release the heat, the reeds spread the water, the roots carry what is slow. This chamber is a knuckle of that hand. It was built when the coast was one piece. The crown later wrote KING over CREW. The stone still says CREW underneath, if you scrape.',
  },
  {
    id: 'sample_tag', title: 'Sample Tag 14', place: 'The Folded Court',
    x: S.fold.x + 2.8, z: S.fold.z - 1.6, prop: 'letter',
    text: 'Specimen: lattice rib, still pulsing. Hypothesis: the Rift-stone is not rock. It is compressed instruction — the same pressure the mantras borrow, cooled into a wall. If the islands are shedding, they are shedding roof. We are standing in the attic of a machine.',
  },
  {
    id: 'vault_heart', title: 'The Name of the Room', place: 'The Sealed Vault',
    x: S.vault.x, z: S.vault.z - 2.8, prop: 'carving',
    text: 'INVERSION CHAMBER. When the chain is cut, this room becomes the sky of the works and the floor of the country. Do not mourn the islands as if they were born separate. They are rafters. The Rift is not a hell that opened. It is the inside of the Compact, looking up at the people who used to walk on its ceiling.',
  },
  {
    id: 'whisper_archive', title: 'Archive That Opens for the Thin', place: 'The Whisper Archive',
    x: S.archive.x, z: S.archive.z, prop: 'book',
    text: 'This door is keyed to an unshaped mind because an unshaped mind is what the lattice became. High sanity is a claim that the world is one piece. The works will not discuss their failure with a claimant. Come back when you can hear the withheld bell. Then read: the islands shattered because a king asked a shared machine to carry a private escape. Repair begins by measuring, not by crowning a replacement.',
  },
  {
    id: 'compact_underside', title: 'What the Shelf Remembered', place: 'The Whisper Archive',
    x: S.archive.x + 2.2, z: S.archive.z + 1.6, prop: 'carving',
    text: 'A history no crown can own, written where only the frayed can stand: the Rift is the lattice\'s underside. The Duke drinks a leak to stay a person. The knights hold a relief that was sealed from them. Year 57 learned this and could not climb out with it. You can. Take it to the camps. Let the living keep a copy. A wound that is mapped can be tended. A wound that is only feared will keep shedding islands until there is no roof left to fall.',
  },
];

export const RIFT_RESEARCH_QUESTS = {
  descent_charter: {
    name: 'Charter of Descent', giver: 'cael',
    desc: 'Scholar Cael is writing a living account of the Rift. Read the notes at the three occupied camps so the charter has more than one voice.',
    stages: [{
      text: 'Read the notes at Scholar\'s Landing, the Cartographer\'s Stake, and the Order Watch',
      objectives: [
        { type: 'lore', lore: 'charter_of_descent', text: 'Read the Charter of Descent' },
        { type: 'lore', lore: 'quill_fieldbook', text: "Read Quill's fieldbook" },
        { type: 'lore', lore: 'vesper_watch', text: "Read Vesper's watch-book" },
      ],
    }],
    rewards: { xp: 900, silver: 160, items: [['sanity_draught', 2]] },
    turnIn: 'cael',
  },
  lattice_work: {
    name: 'A Machine That Still Ticks', giver: 'cael',
    desc: 'Cael needs three lattice samples — Rift-stone that still pulses — to prove the ground is compacted instruction, not ordinary rock.',
    objectives: [{ type: 'collect', item: 'lattice_sample', count: 3, text: 'Collect Lattice Samples from marked caches' }],
    rewards: { xp: 1100, items: [['mantra_spark', 1], ['sanity_draught', 1]] },
    turnIn: 'cael', consume: true,
  },
  missing_maps: {
    name: 'Stakes That Moved', giver: 'quill',
    desc: 'Quill\'s earlier plates were left at the Year 57 camp and the rope descent. Without them the map cannot confess how the ground has drifted.',
    objectives: [{ type: 'collect', item: 'survey_plate', count: 2, text: 'Recover Survey Plates from failed camps' }],
    rewards: { xp: 800, silver: 140, items: [['sanity_draught', 1]] },
    turnIn: 'quill', consume: true,
  },
  find_lira: {
    name: 'The Surveyor Who Stayed', giver: 'quill',
    desc: 'Lira went east after Year 57\'s last heading and did not come back to the Stake. Quill wants her found alive enough to argue.',
    objectives: [{ type: 'talk', npc: 'lira', text: 'Find Lira at the Lost Camp' }],
    rewards: { xp: 700, items: [['elixir', 1], ['sanity_draught', 1]] },
    turnIn: 'quill',
  },
  scout_overdue: {
    name: 'Overdue on the West Stair', giver: 'vesper',
    desc: 'An Order scout carried a dispatch along the west stair and vanished. Vesper wants the letter and the farewell, not a hopeful silence.',
    stages: [{
      text: 'Recover the dispatch and read the farewell at the overdue marker',
      objectives: [
        { type: 'collect', item: 'order_dispatch', count: 1, text: 'Take the Order Dispatch' },
        { type: 'lore', lore: 'scout_farewell', text: "Read the scout's farewell" },
      ],
    }],
    rewards: { xp: 1000, silver: 180, items: [['iron_draught', 1]] },
    turnIn: 'vesper', consume: true,
  },
  unseal_the_vault: {
    name: 'Sequence the Night', giver: 'cael',
    desc: 'The sealed vault at Compact Station C-4 opens only if the four glyphs are traced in the order of the Fracture: Breath, Burden, Break, Bell.',
    objectives: [{ type: 'flag', flag: 'rift_vault_unsealed', text: 'Unseal the vault in the Glyph Circle' }],
    rewards: { xp: 1400, items: [['mantra_spark', 1], ['rift_shard', 4]] },
    turnIn: 'cael',
  },
  whisper_listen: {
    name: 'A Door for the Thin', giver: 'vesper',
    desc: 'Vesper has seen a gate east of the citadel that is not there when the mind is whole. She wants whatever it is keeping read, not worshipped.',
    objectives: [{ type: 'lore', lore: 'whisper_archive', text: 'Read the Whisper Archive (opens at low sanity)' }],
    rewards: { xp: 1600, items: [['sanity_draught', 2], ['ember_of_life', 1]] },
    turnIn: 'vesper',
  },
};

export const RIFT_RESEARCH_NPCS = [
  {
    id: 'cael', name: 'Scholar Cael', title: 'Keeper-Surveyor',
    x: S.scholar.x + 0.8, z: S.scholar.z + 0.4,
    look: { skin: '#c9b39b', hair: '#ebe4d8', outfit: { main: '#3a2a58', trim: '#d4b04a', pants: '#2a2040', boots: '#1a1420' }, beard: '#d8d0c4' },
  },
  {
    id: 'quill', name: 'Quill', title: 'Cartographer of the Wound',
    x: S.survey.x - 0.6, z: S.survey.z + 0.8,
    look: { skin: '#d8a880', hair: '#2a2a2a', outfit: { main: '#4a5a48', trim: '#c8a040', pants: '#2a3020', boots: '#1a1a14' }, bandana: '#c8a040' },
  },
  {
    id: 'vesper', name: 'Scout Vesper', title: 'Order of the Watch',
    x: S.order.x, z: S.order.z,
    look: { skin: '#b88a60', hair: '#3a2a1a', outfit: { main: '#4a3a58', trim: '#a274ff', pants: '#2a2038', boots: '#1a1420' }, armored: true },
  },
  {
    id: 'lira', name: 'Lira', title: 'Year 57\'s Remainder',
    x: S.year57.x + 1.1, z: S.year57.z + 0.2, sit: true,
    look: { skin: '#c8a888', hair: '#6a4a3a', outfit: { main: '#4a3a40', trim: '#8a6a50', pants: '#2a2020', boots: '#1a1410' } },
  },
  {
    id: 'vale', name: 'Archivist Vale', title: 'A Thin Voice',
    x: S.archive.x - 1.4, z: S.archive.z + 0.8,
    look: { skin: '#d8d0c8', hair: '#ffffff', outfit: { main: '#2a1a3a', trim: '#c48bff', pants: '#1a1028', boots: '#0a0814' }, hood: true, glowEyes: true, eyes: '#c48bff' },
    when: (ch) => {
      const max = G.player?.maxSanity || 100;
      return (ch.sanity ?? max) < max * 0.35;
    },
  },
];

DIALOGUES.cael = (api) => {
  const opts = questHub(api, [
    {
      id: 'descent_charter', offer: 'What are you writing?', title: 'Charter of Descent',
      pitch: 'A charter. Not a prayer. The Rift is being studied by people who still have names, and I will not let Year 57 be the last time we admitted that. Read the notes at my landing, at Quill\'s stake to the east, and at Vesper\'s watch to the west. Three voices. Then I can call it an account.',
      active: 'Three occupied camps. Three books. Mine is on the crate behind me. Quill numbers stakes. Vesper counts knights.',
      done: 'The three voices are in me now.',
    },
    {
      id: 'lattice_work', offer: 'What is the ground made of?', title: 'A Machine That Still Ticks',
      when: (a) => a.quest('descent_charter').state === 'done',
      pitch: 'Not rock. Instruction, cooled until you can stand on it. I have marked three caches: the crystal veins, the old Compact knuckle to the west, and the folded court under the citadel. Three samples. Try not to listen to them for too long.',
      active: (q) => `Three lattice samples. You carry ${q.progress || 0}. They tick in the pack.`,
      done: 'Three ribs of the machine.',
    },
    {
      id: 'unseal_the_vault', offer: 'There is a door that will not open.', title: 'Sequence the Night',
      when: (a) => a.quest('lattice_work').state === 'done',
      pitch: 'Station C-4. The glyphs around it are not decoration. They are a date. Breath, then Burden, then Break, then the Bell that never rang. Trace them in that order and the vault will remember it is a room. Bring me word when the seal admits you.',
      active: 'The circle west of the citadel. Breath. Burden. Break. Bell. The night of Year 0, in the order it happened.',
      done: 'The vault remembered.',
    },
  ]);
  opts.push(
    { label: 'Why camp in a place that eats names?', next: { text: 'Because the alternative is to let the Duke, the knights, and the fear write the only history. Saltreach was founded by people the sea returned. We can at least return the favor and remember the room they fell through.', options: [bye] } },
    bye,
  );
  return { text: 'Another witness. Good. The Rift has enough ghosts. It is short on people who still take notes.', options: opts };
};

DIALOGUES.quill = (api) => {
  const opts = questHub(api, [
    {
      id: 'missing_maps', offer: 'The stakes look lonely.', title: 'Stakes That Moved',
      pitch: 'They are. I left brass plates at the Year 57 camp — east, toward the vow-ruin — and at the rope pit north of the citadel. Two plates and I can prove the ground is crawling. One plate is just a story I tell myself.',
      active: (q) => `Two survey plates. You have ${q.progress || 0}. East camp, rope pit.`,
      done: 'Both plates. The map can confess.',
    },
    {
      id: 'find_lira', offer: 'Who else was surveying?', title: 'The Surveyor Who Stayed',
      when: (a) => a.quest('missing_maps').state === 'done',
      pitch: 'Lira. She could hold a bearing in her head during a sanity storm. She walked the Year 57 heading and did not walk back. If she is alive she will be sitting on their dead fire, arguing with a log. Bring me the argument.',
      active: 'East. The camp that learned too much and stayed to keep the fire anyway.',
      done: 'Lira is still a person. That is a better map than brass.',
    },
  ]);
  opts.push(
    { label: 'How do you map a place that moves?', next: { text: 'Badly, and on purpose. A wrong map that knows it is wrong is still a measurement. I number the lies. When two lies disagree, that disagreement is the truth.', options: [bye] } },
    bye,
  );
  return { text: 'Keep your feet on a numbered stake if you can. The unnumbered ground has opinions.', options: opts };
};

DIALOGUES.vesper = (api) => {
  const opts = questHub(api, [
    {
      id: 'scout_overdue', offer: 'You keep looking west.', title: 'Overdue on the West Stair',
      pitch: 'Because I sent someone that way. A dispatch for the drowned post — not relief, a count. They are overdue. The leaning marker west of the Ascent was our fallback. Bring me whatever they left, even if it is only a goodbye.',
      active: 'West of here, toward the west stair. A leaning stake. Do not add yourself to the count.',
      done: 'The dispatch and the goodbye. I will write both down.',
    },
    {
      id: 'whisper_listen', offer: 'Is there a gate that is not always there?', title: 'A Door for the Thin',
      when: (a) => a.quest('scout_overdue').state === 'done',
      pitch: 'East of the citadel. I have walked through empty air that later had a door in it, after a long night without draughts. I will not send a scout whose job is to stay whole. If you go thin on purpose, read what it is hiding and come back thick.',
      active: 'Let your sanity fall. The whisper-gate stands east of the hanging citadel. Read, then drink.',
      done: 'You came back with the archive and your name. That is the whole brief.',
    },
  ]);
  opts.push(
    { label: 'Who do you answer to?', next: { text: 'The Watch, on paper. The drowned knights, in practice — I count them so Hale does not have to learn their names the hard way. I do not relieve them. I refuse to pretend they are scenery.', options: [bye] } },
    bye,
  );
  return { text: 'Keep your draughts where you can reach them. I am not here to haul scholars out of their own curiosity.', options: opts };
};

DIALOGUES.lira = (api) => {
  const q = api.quest('find_lira');
  if (q.state === 'none' || q.state === 'active') {
    return {
      text: 'If you are a ghost, sit down. If you are living, sit down anyway. I have been keeping Year 57\'s fire with no wood and too much memory. Tell Quill the eastern stakes drifted. Tell Cael the Rift is a room. I am not ready to be a person in a camp that still has soup.',
      options: [
        { label: 'Quill sent me to find you.', next: { text: 'Of course they did. Quill numbers everything, including me. I will not walk back yet. The pages on that crate are the part of me that can travel. Read them. Then go be living somewhere with a numbered stake.', options: [bye] } },
        bye,
      ],
    };
  }
  return {
    text: 'You told them. I felt the air get slightly more like a place people share. I will come in when I can bear soup. Until then I am the remainder, and remainders are allowed to sit.',
    options: [
      { label: 'What did Year 57 actually find?', next: { text: 'That the sea is a ceiling. That the Keep is a switch. That a stair can have two downs. That a door will talk if you are not currently insisting the world is finished. They found a history and could not carry it up a rope. You can. That is the only difference I am interested in.', options: [bye] } },
      bye,
    ],
  };
};

DIALOGUES.vale = () => ({
  text: 'You are thin enough. Good. The archive only discusses failure with people who can hear it. Read the book. Read the carving behind it. Then leave before you decide you live here. I did not leave. That is why I can hold the door and cannot hold a name.',
  options: [
    { label: 'Who were you?', next: { text: 'A Morrow recorder attached to Year 57. I walked through this gate to file the underside. The gate kept the filing. If Cael is still writing charters, take him the conclusion: repair is measurement plus attendants. Crowns are optional and usually late.', options: [bye] } },
    bye,
  ],
});

const RESEARCH_CHRONICLE = [
  {
    id: 'rift_charter', category: 'Rift Research', title: 'A living wound, still staffed',
    subtitle: 'Why people from the overworld keep coming down', evidence: ['charter_of_descent'],
    paragraphs: [
      'The Rift is no longer only a place the dead arrive. Scholars, cartographers and Order scouts occupy it in shifts, the way a dangerous coast is occupied: tents, numbered stakes, lanterns, and a refusal to let fear be the only account.',
      'Their notes feed this Journal. Investigations under Rift Research track how much of the wound has been measured. The camps will sell you no comfort. They will sell you a sequence, a sample, and the name of someone who did not come back.',
    ],
  },
  {
    id: 'living_camps', category: 'Rift Research', title: 'Three fires that are still tended',
    subtitle: 'Landing, Stake, and Watch', evidence: ['charter_of_descent', 'quill_fieldbook', 'vesper_watch'],
    paragraphs: [
      'Scholar Cael writes at a landing west of the drowned dock, collecting voices so Year 57 is not the last expedition that admitted the Rift is a room. Quill plants soot-marked stakes and treats a moving map as a confession. Scout Vesper counts the drowned knights and keeps the researchers from walking into a relief that was sealed from its recipients.',
      'They disagree about almost everything except the work. That disagreement is the beginning of an accurate history.',
    ],
  },
  {
    id: 'failed_relief', category: 'Rift Research', title: 'The expedition that learned the ceiling',
    subtitle: 'Year 57, and the people who stayed', evidence: ['year57_log', 'rope_last', 'scout_farewell', 'lira_pages'],
    paragraphs: [
      'In Year 57 the last organized relief entered the Rift, mapped the Keep as a command station, found the withheld bell, and followed a stair that would not choose a single down. Their camps remain: a dead fire Lira still sits beside, a rope tied twice over a pit that is also a room, a scout\'s farewell under a leaning stake.',
      'They did not fail because they were foolish. They failed because the thing they learned was heavier than a rope. The living camps exist to carry that weight in pieces.',
    ],
  },
  {
    id: 'the_underside', category: 'Rift Research', title: 'The Rift is a ceiling seen from below',
    subtitle: 'Why the islands shattered', evidence: ['vault_heart', 'whisper_archive', 'compact_underside'],
    paragraphs: [
      'The Compact built a lattice under a connected coast. The islands were its high country — rafters, not separate creations. When the last Anchor withheld the emergency bell, the command chain snapped and the works inverted. What the living call the Rift is the interior of that machine, looking up at the people who used to walk on its roof.',
      'The Hollow Duke drinks the leak to remain a person. The drowned knights hold a station whose relief was sealed away. Mantras borrow the same pressure the walls are made of. Defeat interrupts a claim; it does not rebuild a crew. Repair begins where the camps already started: measure the wound, copy the account, and refuse to let a crown be the only memory of a shared machine.',
    ],
  },
];

const RESEARCH_INVESTIGATIONS = [
  {
    id: 'rift_research', title: 'Rift Research', tier: 'R: Occupied camps / failed descents',
    evidence: ['charter_of_descent', 'quill_fieldbook', 'vesper_watch', 'year57_log', 'rope_last', 'scout_farewell', 'lira_pages', 'hollow_fieldnote'],
    question: 'What are the living doing in a place that unmakes names?',
    conclusion: 'They are staffing a wound. Cael, Quill, Vesper and Lira treat the Rift as a site of work: notes, stakes, counts, and the recovery of Year 57\'s unfinished survey. The progress of this account is the research itself. A place that is measured can be tended. A place that is only fled will keep taking people.',
    reward: { xp: 800, silver: 180, items: [['sanity_draught', 2]] },
  },
  {
    id: 'impossible_rooms', title: 'Rooms that will not pick an up', tier: 'R: Glyphs, vault, folded court',
    evidence: ['glyph_litany', 'vault_warning', 'folded_stair', 'prerift_station', 'sample_tag'],
    question: 'Who built chambers that disobey ordinary space?',
    conclusion: 'Pre-Rift crews. Station C-4, the folded service stair and the western knuckle are Compact works that lost a single orientation when the chain broke. The glyphs are a date, not a prayer. The stone that ticks is instruction, cooled. Impossible geometry is a damaged tool, not a miracle.',
    reward: { xp: 1000, silver: 200, items: [['mantra_spark', 1]] },
  },
  {
    id: 'the_underside', title: 'What the shelf remembered', tier: 'R: The payoff',
    evidence: ['vault_heart', 'whisper_archive', 'compact_underside'],
    requires: ['rift_research', 'impossible_rooms'],
    question: 'What is the Rift, and why did the islands shatter?',
    conclusion: 'The Rift is the Compact lattice seen from underneath. The islands shattered because they were the roof of a shared machine asked to carry a private escape. Year 0 withheld a bell; the chain snapped; the works inverted. The Duke, the knights, and the camps are all standing in the same broken room. Recording this account is the first attendant shift in a century.',
    reward: { xp: 1800, silver: 280, items: [['ember_of_life', 1]] }, titleReward: 'Surveyor of the Wound',
  },
];

export const RIFT_RESEARCH_LOCATIONS = [
  { name: "Scholar's Landing", x: S.scholar.x, z: S.scholar.z, r: 16 },
  { name: "Cartographer's Stake", x: S.survey.x, z: S.survey.z, r: 14 },
  { name: 'Order Watch', x: S.order.x, z: S.order.z, r: 14 },
  { name: 'The Lost Camp', x: S.year57.x, z: S.year57.z, r: 16 },
  { name: 'The Rope Descent', x: S.rope.x, z: S.rope.z, r: 12 },
  { name: 'Overdue Marker', x: S.scout.x, z: S.scout.z, r: 10 },
  { name: 'The Glyph Circle', x: S.glyphs.x, z: S.glyphs.z, r: 16 },
  { name: 'The Sealed Vault', x: S.vault.x, z: S.vault.z, r: 12 },
  { name: 'The Folded Court', x: S.fold.x, z: S.fold.z, r: 16 },
  { name: 'Pre-Rift Works', x: S.prerift.x, z: S.prerift.z, r: 16 },
  { name: 'The Whisper Gate', x: S.whisper.x, z: S.whisper.z, r: 12 },
  { name: 'The Whisper Archive', x: S.archive.x, z: S.archive.z, r: 10 },
];

export const RIFT_RESEARCH_SPAWNERS = [
  { type: 'hollow', x: S.year57.x + 10, z: S.year57.z + 6, count: 2, radius: 10, respawn: 110 },
  { type: 'riftling', x: S.rope.x + 8, z: S.rope.z - 6, count: 1, radius: 8, respawn: 130 },
  { type: 'hollow', x: S.scout.x + 6, z: S.scout.z + 8, count: 2, radius: 8, respawn: 110 },
  { type: 'drowned_knight', x: S.prerift.x - 8, z: S.prerift.z + 6, count: 1, radius: 6, respawn: 180 },
  { type: 'riftling', x: S.fold.x + 10, z: S.fold.z + 4, count: 1, radius: 8, respawn: 140 },
];

export const RIFT_RESEARCH_CHESTS = [
  { id: 'c_rift_vault', x: S.vault.x, z: S.vault.z + 2.2, loot: { silver: [0, 0], items: [['rift_shard', 5], ['mantra_spark', 1], ['sanity_draught', 2]] } },
  { id: 'c_rift_lost', x: S.year57.x - 3.2, z: S.year57.z - 2.4, loot: { silver: [0, 0], items: [['sanity_draught', 2], ['rift_shard', 3]] } },
  { id: 'c_rift_archive', x: S.archive.x - 2.4, z: S.archive.z - 1.8, loot: { silver: [0, 0], items: [['ember_of_life', 1], ['sanity_draught', 1]] } },
];

export const RIFT_PICKUPS = [
  { id: 'pk_sample_crystal', item: 'lattice_sample', x: 6084, z: 6024, label: 'Lattice Sample' },
  { id: 'pk_sample_works', item: 'lattice_sample', x: S.prerift.x - 2.4, z: S.prerift.z + 1.8, label: 'Lattice Sample' },
  { id: 'pk_sample_fold', item: 'lattice_sample', x: S.fold.x + 3.2, z: S.fold.z + 1.2, label: 'Lattice Sample' },
  { id: 'pk_plate_57', item: 'survey_plate', x: S.year57.x + 3.4, z: S.year57.z + 2.2, label: 'Survey Plate' },
  { id: 'pk_plate_rope', item: 'survey_plate', x: S.rope.x - 2.2, z: S.rope.z + 1.6, label: 'Survey Plate' },
  { id: 'pk_dispatch', item: 'order_dispatch', x: S.scout.x - 1.2, z: S.scout.z + 1.4, label: 'Order Dispatch' },
];

export const RIFT_GLYPHS = [
  { id: 'breath', title: 'Breath', hint: 'the living filter', x: S.glyphs.x, z: S.glyphs.z - 6.2 },
  { id: 'burden', title: 'Burden', hint: 'the paired regulators', x: S.glyphs.x + 6.2, z: S.glyphs.z },
  { id: 'break', title: 'Break', hint: 'the night the chain snapped', x: S.glyphs.x, z: S.glyphs.z + 6.2 },
  { id: 'bell', title: 'Bell', hint: 'the signal withheld', x: S.glyphs.x - 6.2, z: S.glyphs.z },
];


const riftAtlas = ATLAS.find((a) => a.id === 'rift');
if (riftAtlas) {
  riftAtlas.life = 'The Hollow Man still trades fragments at the arrival shelf. The Ascent is the way home. Since Year 113, three living camps occupy the dark: Cael\'s scholars at the landing, Quill\'s stakes east toward the fallen light, and Vesper\'s Order watch counting the drowned. Abandoned canvas from Year 57 still holds journals. A progress of recovered notes lives in this Journal under Investigations.';
  riftAtlas.route = 'No fire burns below, and nowhere in the Rift sets where you wake. Read camp notes, then follow Quill east and Vesper west. The Glyph Circle and Station C-4 sit west of the citadel; the Folded Court east of it. A gate east of the hanging keep opens only when sanity is thin. Record Rift Research in the Journal when the sources agree.';
}

BESTIARY_NOTES.hollow = 'Husks of the Rift-drowned. Expedition note: not demons — people the lattice finished filing incorrectly. Each hit asks whether you still have a name.';
BESTIARY_NOTES.riftling = 'Floating eyes that fire homing void bolts. Cael tags them as loose surveyor\'s lamps: the works looking for a crew that clocked out in Year 0.';
BESTIARY_NOTES.drowned_knight = 'Knights of a sunken order. Vesper\'s count: they block because the brief was hold, and no living officer has countermanded it. Break the guard; do not expect them to understand relief.';
BESTIARY_NOTES.abyssal_watcher = 'Great Rift eyes. Year 57 called them unfinished windows — the lattice trying to see its own ceiling. Their gaze cannot be blocked and erodes the mind.';

placeCatalog(RIFT_RESEARCH_LORE);
placeCatalog(RIFT_RESEARCH_LOCATIONS);
placeCatalog(RIFT_RESEARCH_SPAWNERS);
placeCatalog(RIFT_RESEARCH_CHESTS);
placeCatalog(RIFT_RESEARCH_NPCS);
placeCatalog(RIFT_PICKUPS);
placeCatalog(RIFT_GLYPHS);

for (const l of RIFT_RESEARCH_LOCATIONS) LOCATIONS.push(l);
for (const s of RIFT_RESEARCH_SPAWNERS) SPAWNERS.push(s);
for (const c of RIFT_RESEARCH_CHESTS) CHESTS.push(c);
for (const n of RIFT_RESEARCH_NPCS) NPCS.push(n);
for (const l of RIFT_RESEARCH_LORE) {
  LORE.push(l);
  LORE_BY_ID[l.id] = l;
}
Object.assign(QUESTS, RIFT_RESEARCH_QUESTS);
for (const chapter of RESEARCH_CHRONICLE) CHRONICLE.push(chapter);
const capstone = INVESTIGATIONS.findIndex((e) => e.id === 'common_memory');
const at = capstone >= 0 ? capstone : INVESTIGATIONS.length;
INVESTIGATIONS.splice(at, 0, ...RESEARCH_INVESTIGATIONS);
for (const inv of RESEARCH_INVESTIGATIONS) INVESTIGATION_BY_ID[inv.id] = inv;
