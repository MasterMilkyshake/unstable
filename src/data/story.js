// THE UNSTABLE TIDE — the story threads of the Anchorage. There is no main quest: each thread is
// offered by the people involved (Wren, Maren, Hale, Crane, the Grey Clerk, Quill, the Hollow Man)
// and can be taken up, left or finished in any order. Nothing in the world waits on them.
//
// A century ago the last First Anchor withheld the emergency release so the crown ships could
// escape; the regulators broke, the coast sank and the Rift opened. Those crown ships became
// the Enclave. Now they are back, led by a Grand Warden who means to take the Anchor's
// seat in the Rift and make the broken chain answer to him. The Ministry of Soundings, keepers
// of the old Compact's measurements, would rather close the passage altogether. Saltreach only
// wants to keep its lamp lit. The tide-born walk between all three.
//
// Quests here use stages (game/quests.js). Markers are resolved at runtime from NPC ids,
// spawner types, lore ids and location names (game/story.js), so they follow the world layout.
import { ENEMIES } from './enemies.js';

const ENCLAVE_BOSS_LOOK = { skin: '#c9a888', hair: '#2a2420', beard: '#2a2420', outfit: { main: '#22222a', trim: '#b8902e', pants: '#18181e', boots: '#101014' }, armored: true, helm: '#3a3c42', cape: '#8e1f24' };

export const STORY_BOSSES = {
  vice_warden: {
    name: 'Varga Thorne', title: 'Vice Warden of Fort Meridian', model: 'humanoid', boss: true, level: 17, hp: 3300, posture: 560, speed: 5.6, aggro: 26, leash: 55,
    faction: 'enclave', // the garrison and his summoned Peacekeepers fight beside him, not him
    xp: 5400, silver: [500, 700], weapon: 'iron_greatsword', dmgMul: 1.05, critChance: 0.3, comboMax: 4, scale: 1.32, feintChance: 0.22,
    defend: { block: 0.4, parry: 0.22, dodge: 0.05 }, knockable: false,
    look: ENCLAVE_BOSS_LOOK,
    specials: [
      { id: 'boarding_leap', type: 'leap', windup: 0.75, active: 0.45, recovery: 0.75, range: 16, minRange: 6, arc: 80, dmg: 34, posture: 36, unparryable: true, cd: 9, shockwave: 5 },
      { id: 'iron_resolve', type: 'buff', windup: 1.0, recovery: 0.5, cd: 30, hpBelow: 0.5, once: true },
    ],
    summons: { type: 'peacekeeper', count: 2, atHp: [0.6, 0.3] },
    drops: [{ id: 'mantra_spark', chance: 1, count: [1, 2] }, { id: 'iron_draught', chance: 1, count: [2, 2] }, { id: 'chain_seal', chance: 1 }],
  },
  grand_warden: {
    name: 'Aurek Vell', title: 'Grand Warden of the Enclave', model: 'humanoid', boss: true, level: 19, hp: 4600, posture: 640, speed: 5.8, aggro: 30, leash: 70, faction: 'enclave',
    xp: 8000, silver: [0, 0], weapon: 'drowned_greatsword', dmgMul: 1.12, critChance: 0.32, comboMax: 4, scale: 1.4, sanityHit: 4, resist: { umbra: 0.4 },
    mantras: ['umbral_orb', 'ice_lance'], mantraChance: 0.3, mantraPower: 1.25,
    defend: { block: 0.38, parry: 0.28, dodge: 0.08 }, knockable: false,
    look: { ...ENCLAVE_BOSS_LOOK, outfit: { main: '#1a1622', trim: '#d4b04a', pants: '#120e18', boots: '#0a080e' }, crown: '#ffd27a', eyes: '#c48bff', glowEyes: true, cape: '#3a1a5a' },
    specials: [
      { id: 'chain_lash', type: 'aoe', windup: 0.9, active: 0.15, recovery: 0.8, radius: 7, dmg: 30, posture: 40, unblockable: true, cd: 8 },
      { id: 'sovereign_fall', type: 'leap', windup: 0.8, active: 0.45, recovery: 0.8, range: 18, minRange: 6, arc: 80, dmg: 38, posture: 40, unparryable: true, cd: 10, shockwave: 6 },
      { id: 'claim', type: 'buff', windup: 1.2, recovery: 0.6, cd: 40, hpBelow: 0.45, once: true },
    ],
    summons: { type: 'drowned_knight', count: 2, atHp: [0.5] },
    drops: [{ id: 'mantra_spark', chance: 1, count: [2, 2] }, { id: 'ember_of_life', chance: 1 }],
  },
};
Object.assign(ENEMIES, STORY_BOSSES);

// ---------------------------------------------------------------- the threads
// act: grouping for the journal's Story tab; power: the suggested Power shown there.
export const STORY_QUESTS = {
  // ======================== PROLOGUE — SALT IN THE LUNGS
  awakening: {
    act: 'prologue', power: '1',
    name: 'Washed Ashore', giver: 'wren', turnIn: 'wren',
    desc: 'Old Wren found you half-drowned on the Wash. Prove you can still fight by clearing the mudlurkers from the shore.',
    objectives: [{ type: 'kill', target: ['mudlurker'], count: 3, text: 'Slay mudlurkers on The Wash' }],
    rewards: { xp: 90, silver: 25, weapons: ['bronze_sword'], items: [['bread', 2]] },
  },
  first_light: {
    act: 'prologue', power: '1–2',
    name: 'The Keeper of Saltreach', giver: 'wren', turnIn: 'maren',
    desc: 'Wren says Elder Maren of Saltreach knows more about the tide-born than anyone. Walk the coast trail north to the Lantern City.',
    stages: [
      { type: 'reach', loc: 'Saltreach Town', r: 70, text: 'Follow the coast trail north to Saltreach' },
    ],
    rewards: { xp: 80 },
  },

  // ======================== ACT I — THE LAMP AND THE WRIT
  writ: {
    act: 'one', power: '2–5',
    name: 'The Writ of Reclamation', giver: 'maren', turnIn: 'maren',
    desc: 'A black-hulled warship flying a chain banner anchored off Saltreach at dawn, and its envoy has nailed a writ to the Sea Gate. Maren wants to know what the Enclave is before she answers it.',
    stages: [
      { type: 'talk', npc: 'hale', text: 'Ask Captain Hale about the black ship in the harbor' },
      { type: 'lore', lore: 'enclave_writ', text: 'Read the Writ nailed to the Sea Gate' },
      { type: 'flag', flag: 'writ_answered', npc: 'envoy_crane', text: 'Hear out Captain Crane at the Enclave pier' },
    ],
    rewards: { xp: 240, silver: 60, rep: { watch: 5 } },
  },
  red_tooth: {
    act: 'one', power: '4–8',
    name: 'The Stolen Tooth', giver: 'maren', turnIn: 'maren',
    desc: 'Kaelen the Red carries a fragment of the old command chain, a "tooth" torn from a regulator. The Enclave wants it. Maren wants it first, and Captain Hale wants the Redwake raids ended.',
    stages: [
      { type: 'talk', npc: 'hale', text: 'Learn what the Watch knows of Kaelen the Red' },
      { type: 'reach', loc: 'Brigand Hold', r: 70, text: 'Find Brigand Hold in the forests of Thornwood' },
      { type: 'boss', boss: 'warlord', text: 'Defeat Kaelen the Red' },
      { type: 'any', of: [{ type: 'collect', item: 'fracture_core', count: 1 }, { type: 'quest', quest: 'fracture' }], text: 'Recover the command fragment Kaelen carried' },
    ],
    rewards: { xp: 650, silver: 160, rep: { watch: 10 } },
  },

  // ======================== ACT II — THREE SIGNATURES
  grey_letter: {
    act: 'two', power: '6–10',
    name: 'A Letter Sealed in Grey', giver: 'grey_clerk', turnIn: 'minister_quill',
    desc: 'A clerk in grey waits under the Lantern Tree in Saltreach with a sealed letter. The Ministry of Soundings, in the fog on the Hush to the north-east, wants to talk to a tide-born about the command chain under the sea.',
    stages: [
      { type: 'talk', npc: 'grey_clerk', text: 'Meet the clerk in grey beneath the Lantern Tree' },
      { type: 'reach', loc: 'Hush Landing', r: 40, text: 'Sail to Hush Landing' },
      { type: 'reach', loc: 'The Sounding House', r: 30, text: 'Climb through the fog to the Sounding House' },
      { type: 'talk', npc: 'minister_quill', text: 'Hear the Minister of Soundings' },
      { type: 'lore', lore: 'ministry_soundings', text: 'Read the soundings kept in the Quiet Archive' },
    ],
    rewards: { xp: 800, items: [['sanity_draught', 2]], rep: { ministry: 15 } },
  },
  fracture: {
    act: 'two', power: '8–16',
    name: 'The Three Signatures', giver: 'maren', turnIn: 'maren',
    requiredBosses: ['warlord', 'frost_warden', 'cinder_colossus'],
    desc: 'Command, cold and heat: three signatures to trace the broken chain. Kaelen\'s fragment is one. The Frost Warden in the White Hollow and the Cinder Colossus in the Caldera hold the others, each still guarding works nobody came back to tend.',
    stages: [
      {
        text: 'Silence the two remaining guardians',
        objectives: [
          { type: 'boss', boss: 'frost_warden', text: 'The Frost Warden (White Hollow, Frosthollow)' },
          { type: 'boss', boss: 'cinder_colossus', text: 'The Cinder Colossus (the Caldera, Ashen Spire)' },
          { type: 'boss', boss: 'warlord', text: 'Kaelen the Red (Brigand Hold, Thornwood)' },
        ],
      },
      { type: 'collect', item: 'fracture_core', count: 3, consume: true, text: 'Carry three Fracture Cores' },
    ],
    rewards: { xp: 2500, silver: 500, items: [['ember_of_life', 1]] },
  },

  // ======================== ACT III — IRON ON THE WATER
  iron_tide: {
    act: 'three', power: '13–16',
    name: 'Iron on the Water', giver: 'maren', turnIn: 'maren',
    desc: 'Captain Crane came for the cores with Peacekeepers at her back. The Enclave holds Saltreach harbor, and Maren has hidden the cores somewhere even Hale does not know.',
    stages: [
      { type: 'talk', npc: 'maren', text: 'Maren has news from the harbor', onEnter: (game) => { game.ch.flags.harbor_occupied = true; } },
      { type: 'talk', npc: 'hale', text: 'Rally Captain Hale at the Watch yard' },
      {
        type: 'kill', target: ['peacekeeper', 'peacekeeper_halberdier', 'peacekeeper_arbalist'], count: 8, text: 'Break the Enclave\'s hold on the harbor',
        onEnter: (game) => { game.ch.flags.war_enclave = true; },
        onDone: (game) => { game.ch.flags.harbor_freed = true; },
      },
    ],
    rewards: { xp: 3200, silver: 420, rep: { watch: 20 }, flags: { harbor_freed: true } },
  },
  bastion: {
    act: 'three', power: '14–18',
    name: 'The Bastion of the Chain', giver: 'maren', turnIn: 'maren',
    desc: 'Crane said the Grand Warden would take the Anchor\'s seat himself. Maren believes her. Fort Meridian is where the Enclave keeps its Vice Warden, its Registry and its iron, and where the Grand Warden came ashore.',
    stages: [
      { type: 'reach', loc: 'Fort Meridian', r: 55, text: 'Sail to Meridian and breach Fort Meridian' },
      { type: 'boss', boss: 'vice_warden', text: 'Defeat Varga Thorne, the Vice Warden' },
      { type: 'lore', lore: 'grand_warden_log', text: 'Search the Chain Citadel for the Grand Warden' },
      { type: 'reach', loc: 'The Crown Drydock', r: 40, text: 'Follow the Grand Warden to the Crown Sluice' },
    ],
    autoComplete: true,
    rewards: { xp: 4200, silver: 600 },
  },

  // ======================== ACT IV — THE SOVEREIGN BENEATH
  sovereign: {
    act: 'four', power: '16–20',
    name: 'The Sovereign Beneath', giver: 'maren', turnIn: 'maren', final: true,
    desc: 'The Grand Warden dived through the Crown Sluice with the Anchor\'s seal. Below the sea the Hollow Duke still grips the command chain. Whoever holds the throne holds what is left of the coast.',
    stages: [
      { type: 'realm', realm: 'rift', text: 'Go down through the Crown Sluice into the Rift' },
      { type: 'reach', loc: 'The Drowned Keep', r: 45, text: 'Cross the Rift to the Drowned Keep' },
      { type: 'boss', boss: 'grand_warden', text: 'Stop the Grand Warden before he reaches the throne' },
      { type: 'boss', boss: 'hollow_duke', text: 'Face the Hollow Duke on the Throne of the Drowned' },
      { type: 'flag', flag: 'ending_chosen', at: 'throne', text: 'Decide the fate of the Anchor\'s Seat' },
    ],
    rewards: { xp: 6000, silver: 1000 },
  },

  // ======================== EPILOGUE — THE LAST CROSSING
  into_the_abyss: {
    act: 'epilogue', power: '18–20',
    name: 'The Last Crossing', giver: 'hollow_man', turnIn: 'hollow_man',
    desc: 'The Hollow Man says the one who ferried every drowned soul down here, his own included, still keeps his landing on the Rift\'s north-east lip. Nobody who went to look has come back.',
    objectives: [{ type: 'kill', target: ['lanternless'], count: 1, text: 'Find the Ferryman at the Landing That Never Came and defeat the Lanternless' }],
    rewards: { xp: 9000, items: [['mantra_spark', 2], ['sanity_draught', 3]] },
  },

  // ======================== FACTION PATHS
  watch_lamp: {
    path: 'watch', name: 'Lamp and Gate', giver: 'hale', turnIn: 'hale',
    desc: 'The Watch is stretched thin. Hale wants the mudlurkers and scuttlers that creep up the coast road thinned before the night ferries come in.',
    objectives: [{ type: 'kill', target: ['mudlurker', 'scuttler'], count: 8, text: 'Clear creatures from the Saltreach coast' }],
    rewards: { xp: 260, silver: 70, rep: { watch: 10 } },
  },
  watch_scraps: {
    path: 'watch', name: 'Proof of Passage', giver: 'hale', turnIn: 'hale',
    desc: 'Every Peacekeeper carries a scrap of the writ that sent them. Hale wants to know which ships they came from and how many there are.',
    objectives: [{ type: 'collect', item: 'writ_scrap', count: 5, text: 'Take Writ Scraps from Peacekeepers' }],
    consume: true,
    rewards: { xp: 1400, silver: 260, rep: { watch: 15 }, outfits: ['guard_plate'] },
  },
  enclave_pirates: {
    path: 'enclave', name: 'Pirate Hunter', giver: 'meridian_captain', turnIn: 'meridian_captain',
    desc: 'Commander Rell will pay registered folk to clear Redwake crews from the Thornwood coast. The Enclave calls it keeping the peace. The Redwake call it the second seizure.',
    objectives: [{ type: 'kill', target: ['brigand', 'brigand_brute', 'brigand_cutthroat'], count: 8, text: 'Defeat Redwake brigands on Thornwood' }],
    rewards: { xp: 900, silver: 240, rep: { enclave: 15, watch: -5 } },
  },
  ministry_soundings: {
    path: 'ministry', name: 'Soundings', giver: 'minister_quill', turnIn: 'minister_quill',
    desc: 'The Ministry measures the passage where it runs closest under the sea. Quill wants fresh soundings taken over three deeps, which means sailing out where the water goes glassy and cold.',
    stages: [
      {
        text: 'Take soundings over three deeps',
        objectives: [
          { type: 'reach', loc: 'The Gallows Channel', r: 40, text: 'The Gallows Channel' },
          { type: 'reach', loc: 'The Redwake Strait', r: 40, text: 'The Redwake Strait' },
          { type: 'reach', loc: 'The Pale Sound', r: 40, text: 'The Pale Sound' },
        ],
      },
    ],
    rewards: { xp: 1600, items: [['mantra_spark', 1]], rep: { ministry: 15 } },
  },
  ministry_bell: {
    path: 'ministry', name: 'The Drowned Bell', giver: 'minister_quill', turnIn: 'minister_quill',
    desc: 'On the far shore of the Hush a Compact bell lies tilted in the surf. It has started ringing again, and riftlings come ashore when it does.',
    stages: [
      { type: 'reach', loc: 'The Drowned Bell', r: 30, text: 'Find the Drowned Bell on the Hush\'s far shore' },
      { type: 'kill', target: ['riftling'], count: 4, text: 'Drive back the riftlings drawn to the bell' },
    ],
    rewards: { xp: 1800, silver: 200, rep: { ministry: 10 }, items: [['sanity_draught', 2]] },
  },
};

// Journal grouping for the threads (no order is implied: any thread can be taken up at any time).
export const ACTS = [
  { id: 'prologue', title: 'Prologue', subtitle: 'Salt in the Lungs' },
  { id: 'one', title: 'Act I', subtitle: 'The Lamp and the Writ' },
  { id: 'two', title: 'Act II', subtitle: 'Three Signatures' },
  { id: 'three', title: 'Act III', subtitle: 'Iron on the Water' },
  { id: 'four', title: 'Act IV', subtitle: 'The Sovereign Beneath' },
  { id: 'epilogue', title: 'Epilogue', subtitle: 'The Last Crossing' },
];
// The story threads, in the order the journal lists them (name kept for old saves and tools).
export const MAIN_CHAIN = ['awakening', 'first_light', 'writ', 'red_tooth', 'grey_letter', 'fracture', 'iron_tide', 'bastion', 'sovereign', 'into_the_abyss'];

// The Anchor's Seat: what the player does with the claim once the Duke falls.
export const ENDINGS = {
  break: {
    title: 'Break the Chain', titleReward: 'Breaker of the Chain',
    choice: 'Shatter the seat. No one holds the coast again.',
    text: 'You bring the seat down. The claim that held a century of pressure to one throne splinters, and for the first time since the Fracture the load runs back into the old works: cold into the north, heat into the furnace, slow strain into the roots. The tides quiet. Nothing is restored. Everything will need tending, by many hands, and that is the point.',
  },
  seal: {
    title: 'Seal the Passage', titleReward: 'Sealbearer',
    choice: 'Let the Ministry close the passage beneath the throne.',
    text: 'You ring the Ministry\'s sounding through the throne room and the passage answers by closing, a little. The sea draws back from the Sluice. Fewer will wash up on the Wash; fewer will return at all. Quill writes it down exactly. Somewhere, a name that might have come back will not, and the Ministry will never know whose.',
  },
  claim: {
    title: 'Claim the Seat', titleReward: 'Anchor-Claimed',
    choice: 'Sit. Hold the chain yourself.',
    text: 'You sit. The chain finds you the way it found the Duke: every strained regulator, every drowning village, every ship, pulling at once. You can hold it. You are holding it. The Enclave will kneel, or pretend to. Maren will not. In a hundred years someone will wash up on the Wash and ask who you were.',
  },
};
