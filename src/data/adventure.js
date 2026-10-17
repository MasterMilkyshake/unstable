// Points of adventure between the towns: the overworld's camps, wrecks, fires and lairs.
// Each one exists because someone lived, worked, fled, fought or died there (WORLD_BIBLE.md),
// and each gives the player something: a fight, a cache, a record, a trader, a rumour.
//   camp     people holding ground: tents, a fire with smoke you can see for miles, a cache
//   caravan  a cart that never arrived, its cargo and whoever is picking it over
//   fire     a friendly traveller resting off the road, who trades and knows things
//   lair     a named beast or person that holds a place: a field boss with a reward
//   rest     the remains of someone's last night: a pack, a letter, a little to carry on
//   memorial a place made for the dead, quiet, with what the living left there
//
// Coordinates are FINAL world positions (no placeCatalog). Each site gives an anchor and a
// search radius; world/adventure.js settles it on the nearest dry, gentle ground off the
// roads when the world is built, then moves every record below with it. Local offsets
// (dx, dz) are metres from the settled centre, turned with the site.
import { LOCATIONS, SPAWNERS, CHESTS, NPCS } from './world.js';
import { LORE, LORE_BY_ID } from './lore.js';
import { ENEMIES } from './enemies.js';
import { SHOPS, DIALOGUES } from './npcs.js';

// ---------------------------------------------------------------- named foes
// Captains and field bosses, built on the archetypes they belong to.
const E = ENEMIES;
export const ADVENTURE_ENEMIES = {
  redwake_mate: {
    ...E.brigand, name: 'Mate Corra Vey', title: 'Redwake Landing Party', level: 6, hp: 330, posture: 140, xp: 260, silver: [40, 60],
    weapon: 'cutlass', critChance: 0.22, comboMax: 4, scale: 1.08,
    defend: { block: 0.3, parry: 0.22, dodge: 0.1 },
    look: { ...E.brigand.look, outfit: { main: '#8a2a20', trim: '#d4b04a', pants: '#2a1a14', boots: '#140a08' }, cape: '#6a1a14' },
    drops: [{ id: 'bounty_token', chance: 1, count: [2, 2] }, { id: 'cutlass', chance: 0.2, weapon: true }, { id: 'stew', chance: 0.6 }],
  },
  hookbeak: {
    ...E.gloomowl, name: 'Old Hookbeak', title: 'Mother of the Kestrel Eyrie', boss: true, level: 10, aggro: 30, leash: 50,
    hp: 1500, posture: 360, xp: 1500, silver: [160, 220], size: 1.6, radius: 1.65, height: 6.0,
    drops: [{ id: 'owl_feather', chance: 1, count: [4, 4] }, { outfit: 'owlfeather', chance: 1 }, { id: 'mantra_spark', chance: 1 }],
  },
  tollkeeper: {
    ...E.brigand_brute, name: 'The Tollkeeper', title: 'Holder of the Upland Arch', boss: true, level: 9, hp: 1250, posture: 330, aggro: 26, leash: 50,
    xp: 1700, silver: [260, 340], weapon: 'bonebreaker', dmgMul: 0.9, critChance: 0.25, scale: 1.5, knockable: false,
    defend: { block: 0.4, parry: 0.05, dodge: 0 },
    look: { ...E.brigand_brute.look, outfit: { main: '#4a3a2a', trim: '#8a7a4a', pants: '#2a2018', boots: '#141010' }, cape: '#3a2a1a' },
    specials: [{ id: 'toll_slam', type: 'leap', windup: 0.8, active: 0.45, recovery: 0.8, range: 14, minRange: 5, arc: 80, dmg: 24, posture: 30, unparryable: true, cd: 9, shockwave: 4 }],
    drops: [{ id: 'bonebreaker', chance: 1, weapon: true }, { id: 'smithing_stone', chance: 1, count: [2, 2] }],
  },
  deserter: {
    ...E.brigand, name: 'Deserter', level: 7, hp: 170, posture: 95, xp: 120, silver: [12, 24], weapon: 'watch_pike',
    look: { skin: '#c8a07a', hair: '#3a3028', outfit: { main: '#4a5a6a', trim: '#8a8a7a', pants: '#2e3640', boots: '#1a1e24' }, helm: '#6a7078' },
    drops: [{ id: 'bread', chance: 0.3 }, { id: 'iron_draught', chance: 0.12 }],
  },
  deserter_sergeant: {
    ...E.brigand_brute, name: 'Sergeant Hask', title: 'Who Walked Off the Writ of Iron', level: 9, hp: 420, posture: 170, xp: 380, silver: [50, 80],
    weapon: 'steel_longsword', scale: 1.12,
    look: { skin: '#b08a68', hair: '#2a2420', outfit: { main: '#3e4c5a', trim: '#c8b06a', pants: '#2a323a', boots: '#161a1e' }, helm: '#7a8088', armored: true },
    drops: [{ id: 'iron_draught', chance: 1 }, { id: 'steel_longsword', chance: 0.25, weapon: true }],
  },
  rimejaw: {
    ...E.rimefang, name: 'Old Rimejaw', title: 'Leader of the Pale Pack', boss: true, level: 12, hp: 1500, posture: 360, aggro: 30, leash: 55,
    xp: 2200, silver: [120, 180], size: 1.65, radius: 1.1, height: 2.0,
    drops: [{ id: 'wolf_pelt', chance: 1, count: [3, 3] }, { id: 'stalker_fang', chance: 1, count: [2, 2] }, { id: 'glacier_cleaver', chance: 1, weapon: true }],
  },
  cult_preserver: {
    ...E.frost_cultist, name: 'Preserver Ilse', title: 'Who Keeps the Pilgrims Still', level: 11, hp: 520, posture: 190, xp: 520, silver: [40, 70], scale: 1.1,
    mantraChance: 0.5, mantraPower: 1.15,
    drops: [{ id: 'cultist_sigil', chance: 1 }, { outfit: 'cultist_robes', chance: 0.3 }, { id: 'frost_salve', chance: 1 }],
  },
  kiln_mother: {
    ...E.cinder_crab, name: 'The Kiln-Mother', title: 'Who Grew Fat on the Slag', boss: true, level: 14, hp: 2100, posture: 520, aggro: 22, leash: 45,
    xp: 2800, silver: [200, 280], size: 2.3, radius: 1.8, height: 2.2,
    drops: [{ id: 'ember_shell', chance: 1, count: [3, 3] }, { id: 'magma_maul', chance: 1, weapon: true }, { id: 'smithing_stone', chance: 1, count: [2, 2] }],
  },
};
for (const [id, def] of Object.entries(ADVENTURE_ENEMIES)) if (!ENEMIES[id]) ENEMIES[id] = def;

// ---------------------------------------------------------------- the sites
const looks = {
  hobb: { skin: '#c49a74', hair: '#8a7a6a', beard: '#8a7a6a', outfit: { main: '#6a5a3a', trim: '#a8884a', pants: '#3a3226', boots: '#241c14' } },
  wynn: { skin: '#a8805e', hair: '#1e1a16', outfit: { main: '#3a3530', trim: '#5a4a3a', pants: '#2a2622', boots: '#1a1714' }, apron: true },
  sigrun: { skin: '#e2c4a8', hair: '#d8c8a0', outfit: { main: '#8a7a68', trim: '#e8e0d0', pants: '#4a4238', boots: '#2a241e' } },
  odile: { skin: '#9a7458', hair: '#2a1e18', outfit: { main: '#4a5a3a', trim: '#b8a868', pants: '#3a3a2a', boots: '#2a2418' } },
};

export const ADVENTURE_SITES = [
  // ======================================================== Saltreach and its fields
  {
    id: 'redwake_landing', kind: 'camp', faction: 'redwake', name: 'Redwake Landing Camp', x: 220, z: 180, r: 50, size: 15,
    why: 'A Redwake crew rows over from Thornwood by the smugglers\' path and camps above the cove to hit the Keepers\' tithe carts.',
    tents: 3, smoke: true, banner: '#a8281c',
    enemies: [{ type: 'brigand', count: 2, radius: 6, respawn: 300 }, { type: 'brigand_cutthroat', count: 1, radius: 5, respawn: 300 }, { type: 'redwake_mate', count: 1, radius: 1, respawn: 900, dx: 0, dz: 3 }],
    chest: { id: 'c_adv_redwake_landing', dx: -4, dz: 4, loot: { silver: [70, 100], items: [['stew', 2], ['smithing_stone', 1], ['elixir', 1]] } },
    lore: { id: 'adv_redwake_raid_orders', dx: 3, dz: -4, title: 'Raid Orders, Landing Party',
      text: 'Hit the tithe carts on the north road, not the ferry stores. The ferry families eat from those, and half of them crewed for us before the seizures. Take the grain, leave the carters their boots and their mules. If a Watchman draws, let him walk home. We are not the harbor. — K.' },
  },
  {
    id: 'tithe_cart', kind: 'caravan', name: 'The Overturned Tithe Cart', x: 40, z: 382, r: 34, size: 10, nearRoad: true,
    why: 'The Keepers\' shelter tithe goes north up this road; this cart went over in the ditch and the raiders found it first.',
    enemies: [{ type: 'brigand', count: 1, radius: 2, respawn: 360, dx: 4.5, dz: -3 }, { type: 'brigand_brute', count: 1, radius: 2, respawn: 360, dx: -4.5, dz: -2.5 }],
    chest: { id: 'c_adv_tithe_cart', dx: 2.5, dz: -1, loot: { silver: [30, 50], items: [['bread', 3], ['salt', 2], ['honey_cake', 1]] } },
    lore: { id: 'adv_tithe_manifest', dx: -3, dz: 2, title: 'Tithe Manifest, Breadfields',
      text: 'Shelter tithe under the ninth-year rule, carried north for the Kestrel granary: fourteen sacks of wheat, two of barley, one crock of honey from the Millbrook hives, salt from the pans. Carter: Ennis. Received by: — . The line for the granary\'s mark is empty.', prop: 'letter' },
  },
  {
    id: 'kestrel_eyrie', kind: 'lair', lair: 'tower', name: 'The Kestrel Eyrie', x: -185, z: 252, r: 44, size: 13,
    why: 'The Keepers\' old watch tower on the heights, abandoned when the ships stopped coming. Gloomowls nest in high empty places; the oldest of them nests here.',
    enemies: [{ type: 'hookbeak', count: 1, radius: 1, respawn: 0, boss: true, dx: 6, dz: 0 }],
    chest: { id: 'c_adv_kestrel_eyrie', dx: -1.5, dz: -2.5, loot: { silver: [40, 60], items: [['mantra_spark', 1], ['owl_feather', 2], ['elixir', 1]] } },
    lore: { id: 'adv_kestrel_watch_stone', dx: 3, dz: 3.5, title: 'Watch Stone of the Kestrel Tower',
      text: 'Cut tallies by the year: sails sighted, sails hailed, sails home. The early years fill the stone. Then the columns shorten. The last full line reads: NO SAILS. LAMP KEPT. Under it someone has cut a small owl, very carefully, as if it were a tally too.' },
  },
  {
    id: 'oar_barrow', kind: 'memorial', name: 'The Oar Barrow', x: -195, z: -225, r: 46, size: 12,
    why: 'The Wash\'s salvagers buried what the sea gave back here, above the tide, and planted an oar for every crew the sea kept.',
    chest: { id: 'c_adv_oar_barrow', dx: 0, dz: -7.2, loot: { silver: [20, 40], items: [['pearl', 1], ['sunken_coin', 2]] } },
    lore: { id: 'adv_oar_barrow', dx: 3.6, dz: -6.6, title: 'Carving at the Oar Barrow',
      text: 'Each oar is a crew the sea kept. We plant them blade-up, so anyone the tide brings back can see that a boat came looking. Leave coin under the stone if you have it. Take coin from under the stone if you need it. Either way, say a name.' },
  },
  {
    id: 'drovers_rest', kind: 'rest', name: 'The Drover\'s Rest', x: -420, z: 100, r: 44, size: 7,
    why: 'A drover bound for the reed villages slept here off the Reed Road and never woke.',
    chest: { id: 'c_adv_drovers_rest', dx: 1.6, dz: 0.6, loot: { silver: [20, 32], items: [['waterskin', 1], ['bread', 2], ['herb', 2]] } },
    lore: { id: 'adv_drovers_letter', dx: -1.2, dz: 1.4, title: 'Letter to Saltreach, Unsent',
      text: 'Nell — the reed folk paid in fish again, good fish, and a warden walked me past the bad channel without being asked. Tell Ma I was wrong about them. Two more days to the stilts and back. I will be home for the lamp-relighting. Keep my chair. — Dafydd' },
  },
  {
    id: 'hobb_fire', kind: 'fire', name: 'Hobb\'s Crossroads Fire', x: -270, z: -48, r: 36, size: 8,
    why: 'Hobb works the Reed Road between Saltreach and the fen, and camps where the road forks so nobody passes him by.',
    npc: { id: 'adv_hobb', name: 'Hobb', title: 'Pedlar', dx: 0, dz: -1.8, look: looks.hobb, sit: true, shop: 'adv_hobb', rumours: ['redwake_landing', 'tithe_cart', 'kestrel_eyrie', 'drovers_rest', 'oar_barrow'],
      greet: 'Sit, sit. The road\'s long either way and my kettle\'s the only warm thing between here and the stilts.' },
    mule: true,
  },

  // ======================================================== Thornwood and the upland road
  {
    id: 'redwake_watchfire', kind: 'camp', faction: 'redwake', name: 'Redwake Watchfire', x: 1500, z: 232, r: 54, size: 14,
    why: 'A Redwake lookout on the ridge above the Garrison Road, where the crews watch for the Enclave\'s lamps.',
    tents: 2, smoke: true, banner: '#a8281c', tower: true,
    enemies: [{ type: 'brigand', count: 2, radius: 6, respawn: 300 }, { type: 'brigand_cutthroat', count: 2, radius: 6, respawn: 300 }],
    chest: { id: 'c_adv_redwake_watchfire', dx: 3.5, dz: 3.5, loot: { silver: [60, 90], items: [['spiced_skewer', 2], ['iron_draught', 1], ['smithing_stone', 1]] } },
    lore: { id: 'adv_redwake_watch_rota', dx: -3.5, dz: -2.5, title: 'Watch Rota Notice, Redwake',
      text: 'First watch: Pell, Garrow. Second: Ysa, the boy. Third: Tam. If the Enclave\'s lamps show on the Garrison Road, light the SECOND fire, not the first — the first means a boat is coming in, and the Hold will send the wrong people. Nobody sleeps at the fire. Nobody.' },
  },
  {
    id: 'tollkeeper', kind: 'lair', lair: 'arch', name: 'The Tollkeeper\'s Arch', x: 1500, z: -262, r: 52, size: 14,
    why: 'The Compact kept a toll arch on the upland road for cart traffic. The road drowned; a man who calls himself the Tollkeeper still collects.',
    enemies: [{ type: 'tollkeeper', count: 1, radius: 1, respawn: 0, boss: true, dx: 0, dz: -5 }],
    chest: { id: 'c_adv_tollbox', dx: 4.5, dz: 2.5, loot: { silver: [120, 180], items: [['bounty_token', 3], ['sunken_coin', 3]] } },
    lore: { id: 'adv_toll_plate', dx: -4.2, dz: 1.2, title: 'Toll Plate of the Upland Arch',
      text: 'BY ORDER OF THE COMPACT. A loaded cart, two coins. An empty cart, one. A family on foot, nothing. A crew going to its station, nothing, and water at the arch. Across the whole plate, cut deep and badly: BY ORDER OF THE TOLLKEEPER. EVERYONE PAYS.' },
  },
  {
    id: 'charcoal_clearing', kind: 'fire', name: 'Charcoal Burners\' Clearing', x: 1420, z: -420, r: 50, size: 12,
    why: 'Thornwood\'s charcoal feeds Meridian\'s forges. Wynn\'s family has burned this clearing for three generations and sells to whoever pays.',
    npc: { id: 'adv_wynn', name: 'Wynn', title: 'Charcoal Burner', dx: 2.5, dz: -1, look: looks.wynn, shop: 'adv_wynn', rumours: ['tollkeeper', 'redwake_watchfire', 'deserters_hollow', 'gibbet_crossroads'],
      greet: 'Mind the mounds, they\'re hotter than they look. You after charcoal or after trouble? I sell one and hear about the other.' },
    kilns: 3, smoke: true,
  },
  {
    id: 'gibbet_crossroads', kind: 'memorial', lair: 'gibbets', name: 'Gibbet Crossroads', x: 1358, z: -300, r: 34, size: 9, nearRoad: true,
    why: 'Where the Garrison Road meets the old forest track, the Enclave hangs its notices and, when it catches them, Redwake crews.',
    chest: { id: 'c_adv_gibbet_cache', dx: -4, dz: 3.5, loot: { silver: [40, 70], items: [['bounty_token', 2], ['iron_draught', 1], ['bread', 2]] } },
    lore: { id: 'adv_wanted_writ', dx: 2.6, dz: -0.6, title: 'Wanted Notice, by Writ of the Chain',
      text: 'WANTED, by writ of the Grand Warden of the Enclave: the crews of the Redwake, for theft of Enclave stores, harbouring of the uncounted, and the burning of the Thornwood post. A reward of forty silver a head, paid at the Registry. Registered persons may claim. Unregistered persons who claim will be registered.' },
  },
  {
    id: 'deserters_hollow', kind: 'camp', faction: 'deserters', name: 'Deserters\' Hollow', x: 1500, z: -585, r: 54, size: 14,
    why: 'Peacekeepers who walked off the Writ of Iron rather than count the returned like cargo. They trust nobody now, least of all strangers.',
    tents: 3, smoke: true, banner: '#4a5a6a',
    enemies: [{ type: 'deserter', count: 3, radius: 6, respawn: 300 }, { type: 'deserter_sergeant', count: 1, radius: 1, respawn: 900, dx: 0, dz: 3 }],
    chest: { id: 'c_adv_deserters', dx: -4, dz: -3, loot: { silver: [70, 110], items: [['iron_draught', 2], ['elixir', 1]], weapon: 'watch_pike' } },
    lore: { id: 'adv_deserters_letter', dx: 4, dz: 2.5, title: 'A Deserter\'s Letter',
      text: 'They had us write the returned into the Registry with a hold number, like cargo. A woman asked what her number was for. The clerk said: for when you are needed. I put my coat on the rail that night and walked into the trees with eleven others. If this finds my brother on the Writ: there is room here.' },
  },

  // ======================================================== Frosthollow
  {
    id: 'rimejaw_den', kind: 'lair', lair: 'den', name: 'Rimejaw\'s Den', x: -1222, z: 1735, r: 110, size: 13,
    why: 'Rimefang packs follow the spreading freeze. The oldest leads from a den in the white, among the bones of what the pack has learned to hunt.',
    enemies: [{ type: 'rimejaw', count: 1, radius: 1, respawn: 0, boss: true, dx: 0, dz: 3 }, { type: 'rimefang', count: 2, radius: 7, respawn: 600 }],
    chest: { id: 'c_adv_rimejaw', dx: -3.5, dz: -3, loot: { silver: [40, 70], items: [['frost_salve', 2], ['steak', 2]] } },
  },
  {
    id: 'pilgrims_rest', kind: 'camp', faction: 'cult', name: 'The Pilgrims\' Rest', x: -1140, z: 1655, r: 110, size: 15,
    why: 'White Cult pilgrims walking to the Warden stop here. The ones who go no further are kept, upright, in the ice.',
    tents: 2, effigies: 4, banner: '#e8eef4',
    enemies: [{ type: 'frost_cultist', count: 3, radius: 6, respawn: 300 }, { type: 'cult_preserver', count: 1, radius: 1, respawn: 900, dx: 0, dz: 2 }],
    chest: { id: 'c_adv_pilgrims', dx: 4, dz: -3, loot: { silver: [60, 90], items: [['frost_lily', 2], ['ether_tonic', 1], ['frost_salve', 1]] } },
    lore: { id: 'adv_white_promise', dx: -3.5, dz: 3, title: 'Notice of the Promise',
      text: 'PILGRIM. Rest here. Nothing you love need change again. The Warden holds the cold so that what is kept stays kept. Those too tired to walk on may stay with us; the Preservers will see to them. Do not wake the ones who stay. They did not ask to be woken.' },
  },
  {
    id: 'sigrun_lodge', kind: 'fire', name: 'Sigrun\'s Trapline Lodge', x: -1380, z: 1505, r: 110, size: 10,
    why: 'Hunters mend and trade out here at the edge of the freeze. Sigrun runs her lines farther out every winter, because the winters do.',
    npc: { id: 'adv_sigrun', name: 'Sigrun', title: 'Trapper', dx: 0, dz: -2, look: looks.sigrun, shop: 'adv_sigrun', rumours: ['rimejaw_den', 'pilgrims_rest', 'bell_hatch'],
      greet: 'Shut the cold out behind you — there\'s no door, but try. Pelts, salve, meat. Or a warning, free, if you\'re walking north.' },
    lean: true, smoke: true,
  },
  {
    id: 'bell_hatch', kind: 'memorial', lair: 'hatch', name: 'The Bell Under Ice', x: -1300, z: 1640, r: 110, size: 9,
    why: 'A Compact service hatch, half-buried in the snow, with a signal bell still hung over it. On some nights it rings from below.',
    chest: { id: 'c_adv_bell_hatch', dx: 3, dz: -2, loot: { silver: [30, 60], items: [['star_shard', 1], ['frost_salve', 1]] } },
    lore: { id: 'adv_service_hatch_plate', dx: -2.4, dz: 1.8, title: 'Service Hatch Plate',
      text: 'NORTHERN REGULATOR — RELAY HATCH 4. Crews enter in pairs. Ring once going down, twice coming up, three times for help. Never ring an answer you did not receive. The plate\'s bolts have been forced. The frost on the hatch is thinner on the inside edge.' },
  },

  // ======================================================== Ashen Spire
  {
    id: 'witnesses_vigil', kind: 'camp', faction: 'zealots', name: 'The Witnesses\' Vigil', x: 590, z: -1180, r: 52, size: 14,
    why: 'Cinder zealots keep a vigil on the ash ridge where the furnace\'s heat can be felt through the ground, and feed the braziers with what they take from travellers.',
    braziers: 3, smoke: true, banner: '#7a3a28',
    enemies: [{ type: 'ash_zealot', count: 3, radius: 6, respawn: 300 }, { type: 'cinder_imp', count: 2, radius: 8, respawn: 300 }],
    chest: { id: 'c_adv_vigil', dx: 4, dz: 3, loot: { silver: [70, 110], items: [['fireproof_salve', 2], ['ember_glass', 1], ['ether_tonic', 1]] } },
    lore: { id: 'adv_vigil_hymn', dx: -4, dz: -2.5, title: 'Hymn Notice of the Vigil',
      text: 'The furnace does not sleep, so we do not sleep. The furnace does not rest, so we do not rest. What the furnace is given, it keeps. Underneath, in a smaller and much older hand, a line half scraped away: — the furnace is a MACHINE and wants ATTENDING, not —' },
  },
  {
    id: 'slag_wagon', kind: 'caravan', name: 'The Slag Wagon', x: 670, z: -1100, r: 44, size: 10,
    why: 'Ore carts once ran to the furnace galleries on a rota. The rota stopped; this cart stopped with it, and cinder scuttlers came for the warm slag.',
    enemies: [{ type: 'cinder_crab', count: 2, radius: 3, respawn: 420, dx: 0, dz: -6 }],
    chest: { id: 'c_adv_slag_wagon', dx: 2.5, dz: -1.2, loot: { silver: [40, 70], items: [['smithing_stone', 2], ['ember_glass', 2]] } },
    lore: { id: 'adv_furnace_docket', dx: -3, dz: 1.5, title: 'Furnace Delivery Docket',
      text: 'Southern works, overflow gallery 2. Ore: six loads. Crew present: twelve of twelve. — Ore: six loads. Crew present: nine of twelve. — Ore: four loads. Crew present: five of twelve. — Ore: two loads. Crew present: — . The last docket is signed by the carter alone.', prop: 'letter' },
  },
  {
    id: 'kiln_mother', kind: 'lair', lair: 'slag', name: 'The Slag Pits', x: 542, z: -1265, r: 50, size: 14,
    why: 'Where the galleries dumped their slag, the warmth drew scuttlers, and one has grown enormous on it.',
    enemies: [{ type: 'kiln_mother', count: 1, radius: 1, respawn: 0, boss: true, dx: 0, dz: 0 }],
    chest: { id: 'c_adv_slag_pits', dx: 6, dz: 4, loot: { silver: [60, 90], items: [['ember_shell', 1], ['crucible_mark', 1]] } },
  },

  // ======================================================== The Verdance
  {
    id: 'mask_bearer', kind: 'rest', name: 'The Mask-Bearer\'s Rest', x: -20, z: 1500, r: 46, size: 8,
    why: 'A Mossbound bearer was carrying a name to new wood when the apes found the camp. The half-carved mask is still in the pack.',
    enemies: [{ type: 'jungle_ape', count: 2, radius: 8, respawn: 420 }],
    chest: { id: 'c_adv_mask_bearer', dx: 1.5, dz: 1, loot: { silver: [20, 40], items: [['mossbound_mask', 1], ['berries', 2], ['herb', 2]] } },
    lore: { id: 'adv_mask_bearers_letter', dx: -1.5, dz: 1.2, title: 'Mask-Bearer\'s Letter',
      text: 'To the household at the third root: I am carrying Ilun\'s name to the new cedar as you asked. The old mask split in the rain; I have its pieces wrapped, and the new face is roughed out but the eyes are not cut. I will not cut the eyes alone. Wait for me. It is bad luck to finish a face without the family watching.' },
  },
  {
    id: 'surveyors_camp', kind: 'fire', name: 'The Surveyors\' Camp', x: 140, z: 1340, r: 46, size: 10,
    why: 'Ama\'s settlers send surveyors to mark land they could farm. The Mossbound mark the same land as theirs. Odile is trying to draw a map both can live with.',
    npc: { id: 'adv_odile', name: 'Odile', title: 'Surveyor', dx: 1.5, dz: -1.5, look: looks.odile, shop: 'adv_odile', rumours: ['mask_bearer', 'surveyors_camp'],
      greet: 'Careful where you step — that string is a boundary, or will be, if anyone agrees to it. You\'re not with either side? Good. Sit.' },
    lean: true, smoke: true,
  },

  // ======================================================== The Hush
  {
    id: 'sounders_skiff', kind: 'rest', lair: 'skiff', name: 'The Sounder\'s Skiff', x: -1410, z: 1295, r: 110, size: 9,
    why: 'A Ministry boat ran aground in the fog, its sounding line still paid out across the sand. Its sounder walked inland and did not come back for it.',
    chest: { id: 'c_adv_sounders_skiff', dx: 2.5, dz: 0.5, loot: { silver: [30, 50], items: [['ether_tonic', 1], ['sanity_draught', 1], ['salt', 2]] } },
    lore: { id: 'adv_grey_clerk_orders', dx: -2, dz: 1.5, title: 'Orders from the Grey Clerk',
      text: 'Take soundings at the eastern strand at every slack tide for nine days. Record depth, interval, and any voice. Do not answer any voice. Do not record a voice as a person. If a voice gives a name, record the name in the margin only, in pencil, so that it may be removed.' },
  },
];

// ---------------------------------------------------------------- traders
export const ADVENTURE_SHOPS = {
  adv_hobb: { name: 'Hobb\'s Pack', items: ['bread', 'waterskin', 'salt', 'herb', 'honey_cake', 'elixir', 'cleansing_salts', 'smithing_stone'], outfits: ['traveler'] },
  adv_wynn: { name: 'Wynn\'s Stack', items: ['meat_raw', 'steak', 'spiced_skewer', 'fireproof_salve', 'iron_draught', 'smithing_stone'], weapons: ['woodcutter_axe', 'farmhand_scythe'] },
  adv_sigrun: { name: 'Sigrun\'s Pelts', items: ['steak', 'hunters_feast', 'frost_salve', 'frost_lily', 'waterskin', 'elixir'], outfits: ['frosthide', 'scout'] },
  adv_odile: { name: 'Odile\'s Stores', items: ['berries', 'honeycomb', 'herb', 'elixir', 'cleansing_salts', 'lily_tea'], outfits: ['scout'] },
};
for (const [id, s] of Object.entries(ADVENTURE_SHOPS)) if (!SHOPS[id]) SHOPS[id] = s;

// Compass word from one point to another (+z north, +x WEST).
export function compassWord(fx, fz, tx, tz) {
  const dx = tx - fx, dz = tz - fz;
  const a = Math.atan2(-dx, dz); // 0 = north, +PI/2 = east
  const words = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return words[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

// What each place sounds like from someone who has walked past it.
const RUMOUR = {
  redwake_landing: 'There\'s smoke over the cove most nights. Redwake, rowed over from Thornwood. They take the Keepers\' grain and leave the ferry stores alone, which is more manners than the Watch shows.',
  tithe_cart: 'A tithe cart went in the ditch on the north road. Nobody\'s come for it. Somebody will.',
  kestrel_eyrie: 'Don\'t climb to the old watch tower on the heights. The owl that nests there is older than the lamp, and it doesn\'t like company.',
  drovers_rest: 'A drover used to pass every ten days, regular as tide. He hasn\'t, the last two times. He slept off the road toward the fen, usually.',
  oar_barrow: 'There\'s a barrow above the Wash with oars stood in it. Coin under the capstone. Take what you need, but say a name.',
  redwake_watchfire: 'The Redwake keep a fire on the ridge above the Garrison Road. Two fires means the Enclave. One means a boat. No fires means run.',
  tollkeeper: 'Up the old road there\'s an arch, and a big man who says everyone pays. Carters go the long way round now. The ones who didn\'t, didn\'t.',
  deserters_hollow: 'Peacekeepers walked off the Writ of Iron. They live in a hollow down toward Meridian and they don\'t take visitors kindly.',
  gibbet_crossroads: 'The Enclave hangs its notices at the crossroads on the Garrison Road. Sometimes it hangs people. Redwake hide things under the cairn there, I hear, right under the Writ\'s nose.',
  rimejaw_den: 'The pale pack has a leader. Grey on the muzzle, big as a pony. If you hear him howl, you\'re already in his ground.',
  pilgrims_rest: 'The White pilgrims rest at a camp of tents and ice. Some of the pilgrims there aren\'t resting. They\'re kept.',
  bell_hatch: 'There\'s an old hatch in the snow with a bell over it. Some nights it rings, and the wind\'s wrong for it.',
  mask_bearer: 'A mask-bearer went missing on the forest track. The Mossbound are asking. Quietly, for now.',
  surveyors_camp: 'Ama\'s people are stringing lines through the trees. The Mossbound cut them. Odile ties them back up and keeps talking to both. Brave or daft.',
};

// how far off a rumoured place lies, in a traveller's words
function farWord(d) {
  return d < 260 ? 'close by' : d < 700 ? 'a fair walk' : 'far off';
}

function rumourOptions(api, npc, site) {
  const picks = [];
  for (const id of npc.rumours) {
    const t = ADVENTURE_SITES.find((s) => s.id === id);
    if (!t || t === site || !RUMOUR[id]) continue;
    picks.push({ id, dir: compassWord(site.x, site.z, t.x, t.z), d: Math.hypot(t.x - site.x, t.z - site.z) });
    if (picks.length >= 3) break;
  }
  // two rumours the same way read alike ("Ask about the north-west." twice): say how far, and
  // nearest first if that still doesn't tell them apart
  const sameDir = (p) => picks.filter((q) => q.dir === p.dir);
  const firstAt = (p) => picks.findIndex((q) => q.dir === p.dir);
  picks.sort((a, b) => firstAt(a) - firstAt(b) || (a.dir === b.dir ? a.d - b.d : 0));
  return picks.map((p) => {
    let label = `Ask about the ${p.dir}.`;
    const same = sameDir(p);
    if (same.length > 1) {
      const bands = same.map((q) => farWord(q.d));
      if (new Set(bands).size === bands.length) label = `Ask about the ${p.dir} (${farWord(p.d)}).`;
      else {
        const rank = same.slice().sort((a, b) => a.d - b.d).indexOf(p);
        const words = same.length === 2 ? ['nearer', 'farther'] : ['nearest', 'middle', 'farthest'];
        label = `Ask about the ${p.dir} (${words[rank]}).`;
      }
    }
    return { label, next: { text: RUMOUR[p.id], options: [{ label: 'Anything else?', next: () => dialogueFor(site)(api) }, { label: 'Farewell.' }] } };
  });
}

function dialogueFor(site) {
  const npc = site.npc;
  return (api) => ({
    text: npc.greet,
    options: [
      { label: 'Let me see what you have.', do: (a) => a.openShop(npc.shop) },
      ...rumourOptions(api, npc, site),
      { label: 'Why camp here?', next: { text: site.why, options: [{ label: 'Anything else?', next: () => dialogueFor(site)(api) }, { label: 'Farewell.' }] } },
      { label: 'Farewell.' },
    ],
  });
}

// ---------------------------------------------------------------- catalogue records
// Each record keeps its local offset so the world build can move it with its site.
export const ADVENTURE_RECORDS = [];
function rec(site, record, dx = 0, dz = 0) {
  record.x = site.x + dx;
  record.z = site.z + dz;
  ADVENTURE_RECORDS.push({ site, record, dx, dz });
  return record;
}

for (const site of ADVENTURE_SITES) {
  LOCATIONS.push(rec(site, { name: site.name, r: Math.max(28, site.size * 2.4), adventure: site.id }));
  for (const e of site.enemies || []) {
    const s = { type: e.type, count: e.count, radius: e.radius, respawn: e.respawn };
    if (e.boss) s.boss = true;
    SPAWNERS.push(rec(site, s, e.dx || 0, e.dz || 0));
  }
  if (site.chest) CHESTS.push(rec(site, { id: site.chest.id, loot: site.chest.loot }, site.chest.dx, site.chest.dz));
  if (site.lore) {
    const l = rec(site, { id: site.lore.id, title: site.lore.title, place: site.name, text: site.lore.text, ...(site.lore.prop ? { prop: site.lore.prop } : {}) }, site.lore.dx, site.lore.dz);
    LORE.push(l);
    LORE_BY_ID[l.id] = l;
  }
  if (site.npc) {
    const n = site.npc;
    NPCS.push(rec(site, { id: n.id, name: n.name, title: n.title, look: n.look, sit: !!n.sit, adventure: site.id }, n.dx, n.dz));
    if (!DIALOGUES[n.id]) DIALOGUES[n.id] = dialogueFor(site);
  }
}
