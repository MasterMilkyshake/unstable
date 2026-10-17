// Dungeons: places under the Anchorage that people built, abandoned or broke into, entered
// from a hatch, a stairwell or a cave mouth on the surface (world/dungeons.js).
//
// The interiors are built far to the south of the map and high in the air (DUNGEON_BAND), each
// in its own cell, closed on every side; going down a hatch moves you there and climbing out
// brings you back. Rooms are laid on a grid of `cell` metres: x, z, w, d in cells (+z north,
// +x WEST), `level` in floors of FLOOR metres. A `ramp` room climbs along its length from its
// own level at the low end to `to` at the far end. Links join rooms that share an edge.
import { LOCATIONS, SPAWNERS, CHESTS } from './world.js';
import { LORE, LORE_BY_ID } from './lore.js';
import { ENEMIES } from './enemies.js';

export const DUNGEON_BAND = { z: -5200, below: -4800 }; // everything south of `below` is underground
export const FLOOR = 4;
export const inDungeonBand = (x, z) => x < 3000 && z < DUNGEON_BAND.below;

const E = ENEMIES;
export const DUNGEON_ENEMIES = {
  relay_keeper: {
    ...E.frost_cultist, name: 'The Last Relay-Keeper', title: 'Who Will Not Ring an Unreceived Answer', boss: true, level: 13, hp: 1700, posture: 380,
    aggro: 26, leash: 40, xp: 2600, silver: [220, 300], scale: 1.35, weapon: 'glacier_cleaver', mantraChance: 0.45, mantraPower: 1.25,
    look: { skin: '#cfe3f2', hair: '#e8f4ff', outfit: { main: '#5d7286', trim: '#bfe8ff', pants: '#3e4a55', boots: '#2a3440' }, helm: '#a9b4ba', armored: true, eyes: '#8fd8ff', glowEyes: true, cape: '#3e4a55' },
    drops: [{ id: 'glacier_cleaver', chance: 1, weapon: true }, { id: 'frost_salve', chance: 1, count: [2, 2] }, { id: 'mantra_spark', chance: 1 }],
  },
  gallery_foreman: {
    ...E.ash_golem, name: 'The Gallery Foreman', title: 'Twelve Crew in One Body', boss: true, level: 15, hp: 2600, posture: 600, aggro: 22, leash: 40,
    xp: 3200, silver: [260, 340], size: 2.3, radius: 1.6, height: 4.6,
    drops: [{ id: 'ember_gauntlets', chance: 1, weapon: true }, { id: 'smithing_stone', chance: 1, count: [3, 3] }, { id: 'crucible_mark', chance: 1 }],
  },
  quartermaster_rusk: {
    ...E.brigand_brute, name: 'Quartermaster Rusk', title: 'Keeper of the Redwake Stores', boss: true, level: 10, hp: 1300, posture: 320, aggro: 24, leash: 35,
    xp: 1900, silver: [320, 420], weapon: 'wavecutter_kris', scale: 1.3, comboMax: 4, critChance: 0.25, knockable: false,
    defend: { block: 0.3, parry: 0.2, dodge: 0.05 },
    look: { ...E.brigand_brute.look, outfit: { main: '#3a2a20', trim: '#c8a040', pants: '#2a1a14', boots: '#140a08' }, cape: '#7a2a20', beard: '#2a1a10' },
    drops: [{ id: 'wavecutter_kris', chance: 1, weapon: true }, { id: 'sunken_coin', chance: 1, count: [4, 4] }, { id: 'pearl', chance: 1, count: [2, 2] }],
  },
};
for (const [id, def] of Object.entries(DUNGEON_ENEMIES)) if (!ENEMIES[id]) ENEMIES[id] = def;

export const DUNGEONS = [
  {
    id: 'bell_under_ice', name: 'The Bell Under Ice', theme: 'ice',
    why: 'Relay Hatch 4 of the northern regulator: a Compact service station where signals passed from station to station. The cold took it with the crew still at their posts.',
    entrance: { kind: 'hatch', site: 'bell_hatch', dx: 0, dz: 0, label: 'Climb down through the hatch' },
    origin: { x: -1200, y: 300, z: -5200 }, cell: 10,
    rooms: [
      { id: 'shaft', x: 0, z: 0, w: 1, d: 1, level: 0, h: 9, start: true },
      { id: 'passage', x: 0, z: 1, w: 1, d: 2, level: 0, h: 6 },
      { id: 'relay_hall', x: -1, z: 3, w: 3, d: 2, level: 0, h: 10, pillars: true },
      { id: 'log_room', x: 2, z: 3, w: 1, d: 1, level: 0, h: 6 },
      { id: 'stair', x: 0, z: 5, w: 1, d: 2, level: 0, to: -1, ramp: 'z', h: 8 },
      { id: 'cistern', x: -1, z: 7, w: 3, d: 2, level: -1, h: 10, pillars: true },
      { id: 'brake_room', x: 2, z: 7, w: 1, d: 1, level: -1, h: 6 },
      { id: 'bell_chamber', x: -1, z: 9, w: 3, d: 3, level: -1, h: 14, arena: true },
    ],
    links: [['shaft', 'passage'], ['passage', 'relay_hall'], ['relay_hall', 'log_room'], ['relay_hall', 'stair'], ['stair', 'cistern'], ['cistern', 'brake_room'],
      ['cistern', 'bell_chamber', { gate: 'bell_gate' }]],
    levers: [{ gate: 'bell_gate', room: 'brake_room', dx: 2.5, dz: 0, label: 'Release the brake on the bell gate' }],
    enemies: [
      { type: 'frost_cultist', room: 'relay_hall', count: 2, dx: 0, dz: 2 },
      { type: 'frost_stalker', room: 'relay_hall', count: 1, dx: 6, dz: -3 },
      { type: 'frost_stalker', room: 'cistern', count: 2, dx: -4, dz: 0 },
      { type: 'frost_cultist', room: 'cistern', count: 1, dx: 6, dz: 3 },
      { type: 'relay_keeper', room: 'bell_chamber', count: 1, dx: 0, dz: 4, boss: true },
    ],
    chests: [
      { id: 'c_dg_bell_log', room: 'log_room', dx: 0, dz: 2.5, loot: { silver: [40, 70], items: [['frost_salve', 2], ['ether_tonic', 1]] } },
      { id: 'c_dg_bell_chamber', room: 'bell_chamber', dx: 0, dz: 11, loot: { silver: [120, 180], items: [['star_shard', 2], ['mantra_spark', 1], ['elixir', 2]] } },
    ],
    lore: [
      { id: 'dg_relay_log', room: 'log_room', dx: -2.5, dz: -2, title: 'Relay Log, Hatch 4',
        text: 'Signal received from the Keep, third watch: RELEASE — in the old cipher, the one the Keep stopped using two seasons ago. Our board reads the new cipher only. Logged as unreceived. Per the rule we do not ring an answer we did not receive. Asked the Keep to repeat. No repeat. Asked again. The cold is in the board now.' },
      { id: 'dg_bell_plate', room: 'bell_chamber', dx: 6, dz: 10, title: 'Plate on the Great Bell',
        text: 'RING ONCE GOING DOWN. TWICE COMING UP. THRICE FOR HELP. Below, cut later and very neatly, a tally of thrice-rings — rows of them — and beside each row the same word: UNANSWERED.' },
    ],
  },
  {
    id: 'overflow_galleries', name: 'The Overflow Galleries', theme: 'furnace',
    why: 'Where the southern furnace bled off its heat: galleries a crew of twelve was meant to tend. The crew stopped coming; the galleries did not stop running.',
    entrance: { kind: 'cave', x: 400, z: -1140, r: 110, label: 'Enter the overflow galleries' },
    origin: { x: -600, y: 300, z: -5200 }, cell: 10,
    rooms: [
      { id: 'mouth', x: 0, z: 0, w: 1, d: 1, level: 0, h: 8, start: true },
      { id: 'gallery', x: 0, z: 1, w: 1, d: 3, level: 0, h: 7 },
      { id: 'crossing', x: -1, z: 4, w: 3, d: 1, level: 0, h: 9, lava: true },
      { id: 'pump_hall', x: -1, z: 5, w: 3, d: 2, level: 0, h: 11, pillars: true },
      { id: 'tool_room', x: 2, z: 5, w: 1, d: 1, level: 0, h: 6 },
      { id: 'descent', x: 0, z: 7, w: 1, d: 2, level: 0, to: -1, ramp: 'z', h: 8 },
      { id: 'furnace_floor', x: -2, z: 9, w: 5, d: 3, level: -1, h: 14, arena: true, lava: true },
      { id: 'slag_store', x: 3, z: 9, w: 1, d: 1, level: -1, h: 6 },
    ],
    links: [['mouth', 'gallery'], ['gallery', 'crossing'], ['crossing', 'pump_hall'], ['pump_hall', 'tool_room'], ['pump_hall', 'descent'], ['descent', 'furnace_floor'],
      ['furnace_floor', 'slag_store', { gate: 'slag_gate' }]],
    levers: [{ gate: 'slag_gate', room: 'furnace_floor', dx: -18, dz: 11, label: 'Throw the old sluice lever' }],
    enemies: [
      { type: 'cinder_imp', room: 'crossing', count: 2, dx: 0, dz: 0 },
      { type: 'ash_golem', room: 'pump_hall', count: 1, dx: -6, dz: 0 },
      { type: 'cinder_crab', room: 'pump_hall', count: 2, dx: 6, dz: 3 },
      { type: 'gallery_foreman', room: 'furnace_floor', count: 1, dx: 0, dz: 3, boss: true },
    ],
    chests: [
      { id: 'c_dg_gallery_tools', room: 'tool_room', dx: 0, dz: 2.5, loot: { silver: [50, 80], items: [['fireproof_salve', 2], ['smithing_stone', 1]] } },
      { id: 'c_dg_gallery_slag', room: 'slag_store', dx: 0, dz: 0, loot: { silver: [140, 200], items: [['ember_glass', 3], ['mantra_spark', 1], ['iron_draught', 2]] } },
    ],
    lore: [
      { id: 'dg_service_instructions', room: 'tool_room', dx: -2.5, dz: -2, title: 'Service Instructions, Overflow Gallery 2',
        text: 'CREW OF TWELVE. Two at the pumps, two at the sluice, four on the bleed valves, two on the slag line, one runner, one foreman. No one works the galleries alone. If the bleed valves cannot be held, OPEN THE SLUICE AND LEAVE. Twelve hooks for twelve tools. The hooks on this wall are all empty.' },
    ],
  },
  {
    id: 'smugglers_cave', name: 'The Smugglers\' Sea-Cave', theme: 'cave',
    why: 'The Redwake crews hide what they take from the harbor in a sea-cave under the Thornwood cliffs, where the Watch\'s boats can\'t follow.',
    entrance: { kind: 'cave', x: 1560, z: 160, r: 120, label: 'Enter the sea-cave' },
    origin: { x: 0, y: 300, z: -5200 }, cell: 10,
    rooms: [
      { id: 'mouth', x: 0, z: 0, w: 1, d: 1, level: 0, h: 8, start: true },
      { id: 'tunnel', x: 0, z: 1, w: 1, d: 2, level: 0, h: 6 },
      { id: 'landing', x: -1, z: 3, w: 3, d: 2, level: 0, h: 9, water: true },
      { id: 'ledger_nook', x: 2, z: 3, w: 1, d: 1, level: 0, h: 5 },
      { id: 'drop', x: 0, z: 5, w: 1, d: 2, level: 0, to: -1, ramp: 'z', h: 7 },
      { id: 'grotto', x: -2, z: 7, w: 5, d: 3, level: -1, h: 12, arena: true, water: true },
    ],
    links: [['mouth', 'tunnel'], ['tunnel', 'landing'], ['landing', 'ledger_nook'], ['landing', 'drop'], ['drop', 'grotto']],
    levers: [],
    enemies: [
      { type: 'brigand', room: 'landing', count: 2, dx: -4, dz: 2 },
      { type: 'brigand_cutthroat', room: 'landing', count: 1, dx: 6, dz: -2 },
      { type: 'quartermaster_rusk', room: 'grotto', count: 1, dx: 0, dz: 4, boss: true },
    ],
    chests: [
      { id: 'c_dg_cave_ledger', room: 'ledger_nook', dx: 0, dz: 2, loot: { silver: [60, 90], items: [['bounty_token', 2], ['stew', 2]] } },
      { id: 'c_dg_cave_hoard', room: 'grotto', dx: 18, dz: 11, loot: { silver: [180, 260], items: [['pearl', 2], ['sunken_coin', 4], ['elixir', 2]], weapon: 'cutlass' } },
    ],
    lore: [
      { id: 'dg_quartermasters_ledger', room: 'ledger_nook', dx: -2, dz: -1.5, title: 'The Quartermaster\'s Ledger',
        text: 'Taken from harbor stores, by Kaelen\'s order: rope, sixty fathom; tar, nine pots; oars, four; flour, eleven sacks. Owed back, by the same order, when the boats are ours again: the same, and the wages of the three ferry crews the seizures put ashore. Two columns. Only the first one is filling up.' },
    ],
  },
];

// ---------------------------------------------------------------- geometry helpers (shared)
export function roomRect(dg, room) {
  const c = dg.cell;
  // +x is west: cells count westward from the origin, so x0 is the room's east edge
  return { x0: dg.origin.x + room.x * c, z0: dg.origin.z + room.z * c, x1: dg.origin.x + (room.x + room.w) * c, z1: dg.origin.z + (room.z + room.d) * c };
}
export function roomFloor(dg, room, t = 0.5) {
  const a = dg.origin.y + room.level * FLOOR;
  if (room.to == null) return a;
  return a + (room.to - room.level) * FLOOR * t;
}
export function roomPoint(dg, room, dx = 0, dz = 0) {
  const r = roomRect(dg, room);
  const x = (r.x0 + r.x1) / 2 + dx, z = (r.z0 + r.z1) / 2 + dz;
  const t = room.ramp === 'z' ? (z - r.z0) / (r.z1 - r.z0) : room.ramp === 'x' ? (x - r.x0) / (r.x1 - r.x0) : 0.5;
  return { x, z, y: roomFloor(dg, room, t) };
}
export const roomById = (dg, id) => dg.rooms.find((r) => r.id === id);

// ---------------------------------------------------------------- catalogue records
for (const dg of DUNGEONS) {
  const start = dg.rooms.find((r) => r.start);
  const s = roomRect(dg, start);
  LOCATIONS.push({ name: dg.name, x: dg.origin.x + 15, z: dg.origin.z + 60, r: 140, dungeon: dg.id });
  for (const e of dg.enemies) {
    const p = roomPoint(dg, roomById(dg, e.room), e.dx, e.dz);
    const sp = { type: e.type, x: p.x, z: p.z, count: e.count, radius: e.boss ? 1 : 2.5, respawn: e.boss ? 0 : 300, dungeon: dg.id };
    if (e.boss) sp.boss = true;
    SPAWNERS.push(sp);
  }
  for (const c of dg.chests) {
    const p = roomPoint(dg, roomById(dg, c.room), c.dx, c.dz);
    CHESTS.push({ id: c.id, x: p.x, y: p.y, z: p.z, loot: c.loot, dungeon: dg.id });
  }
  for (const l of dg.lore) {
    const p = roomPoint(dg, roomById(dg, l.room), l.dx, l.dz);
    const rec = { id: l.id, title: l.title, place: dg.name, text: l.text, x: p.x, y: p.y, z: p.z, dungeon: dg.id };
    LORE.push(rec);
    LORE_BY_ID[rec.id] = rec;
  }
  dg.start = { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 - 1, y: roomFloor(dg, start) };
}
