// Places, encounters, chests and written records for the Rift's castles (see riftLayout.js).
// Pushed into the shared catalogues the same way data/rift.js does.
//
// Every point here is a RIFT_SPOT the castles keep clear, or a point on a graded way. Ids are
// new and prefixed (c_rift_cw_*, rift_cw_*) so no existing save entry is touched. Records sit
// on what would carry them: the title picks the carrier (landmarks.js carrierOf), so plates,
// tallies and inscriptions are cut in stone and the muster roll is a book on a lectern.
import { LORE, LORE_BY_ID } from './lore.js';
import { LOCATIONS, SPAWNERS, CHESTS } from './world.js';
import { placeCatalog } from './worldPlacement.js';
import { RIFT_SPOTS as S, RIFT_CASTLES } from './riftLayout.js';

const at = (spot, extra = {}) => ({ x: S[spot].x, z: S[spot].z, ...extra });

// Names. locationAt picks the smallest circle that holds the player, so the Throne of the
// Drowned (6000,6150 r45) still names the throne inside the Chainward's wider ring.
export const RIFT_SITE_LOCATIONS = [
  { name: 'The Chainward', x: RIFT_CASTLES.chainward.x, z: RIFT_CASTLES.chainward.z, r: 78 },
  { name: 'The Unanswered Bastion', x: RIFT_CASTLES.bastion.x, z: RIFT_CASTLES.bastion.z, r: 56 },
  { name: 'The Garrison Steps', x: 5796, z: 6116, r: 54 },
  // The honour guard: four along the arrival processional, two at the Chainward ramp's foot.
  { name: 'The Kneeling', x: 6000, z: 5921, r: 30 },
  { name: 'The Kneeling', x: 6000, z: 6056, r: 24 },
];

// Who still keeps these places. Drowned knights hold the posts they were given; hollows drift
// to the bridgehead the way they drift to every crossing; a watcher hangs over the Bastion's
// court where the calls came in; riftlings follow the break along the ways.
export const RIFT_SITE_SPAWNERS = [
  at('chainward_knights', { type: 'drowned_knight', count: 2, radius: 2, respawn: 160, face: Math.PI }),
  at('garrison_2_yard', { type: 'drowned_knight', count: 2, radius: 3, respawn: 160, face: Math.PI / 2 }),
  at('garrison_3_yard', { type: 'drowned_knight', count: 1, radius: 2, respawn: 180, face: Math.PI / 2 }),
  at('bridge_east_head', { type: 'hollow', count: 2, radius: 2, respawn: 90 }),
  at('bastion_court', { type: 'abyssal_watcher', count: 1, radius: 2, respawn: 180 }),
  { type: 'riftling', x: 6100, z: 5964, count: 2, radius: 2.5, respawn: 100 },
  { type: 'riftling', x: 5872, z: 6056, count: 2, radius: 2.5, respawn: 100 },
];

export const RIFT_SITE_CHESTS = [
  { id: 'c_rift_cw_chainward', ...at('chainward_chest'), loot: { silver: [0, 0], items: [['rift_shard', 6], ['mantra_spark', 1], ['iron_draught', 2]] } },
  { id: 'c_rift_cw_bastion', ...at('bastion_chest'), loot: { silver: [0, 0], items: [['ember_of_life', 1], ['rift_shard', 4], ['sanity_draught', 2]] } },
  { id: 'c_rift_cw_garrison', ...at('garrison_chest'), loot: { silver: [0, 0], weapon: 'gravewarden_scythe', items: [['rift_shard', 4], ['iron_draught', 1]] } },
  { id: 'c_rift_cw_upended', ...at('upended_b_chest'), loot: { silver: [0, 0], items: [['rift_shard', 5], ['mantra_spark', 1], ['sanity_draught', 2]] } },
];

// Written records. Each is a working object: an oath plate at a gate, a signal board, a duty
// roll, a relay keeper's count, a mason's plinth. None explains the Fracture; together they
// show a request coming in, an answer held back, and the people still waiting on it.
export const RIFT_SITE_LORE = [
  {
    id: 'rift_cw_gate_plate', title: 'Gate Plate of the Chainward', place: 'The Chainward', ...at('chainward_gate_plate'),
    text: 'Cut in the dynasty\'s square capitals: WHAT THE STATIONS ASK, THE CHAIN CARRIES. WHAT THE CHAIN CARRIES, THE KEEP ANSWERS. A later chisel has struck through THE KEEP and cut THE ANCHOR above it, then struck through ANSWERS for DECIDES. The corrections are shallower than the oath, as if the mason was told to hurry.',
  },
  {
    id: 'rift_cw_signal_plate', title: 'Signal Plate of the Unanswered Bastion', place: 'The Unanswered Bastion', ...at('bastion_plate'),
    text: 'Four call-signs head the bronze plate: COLD, FURNACE, REED, ROOT. Under each the signalmen cut a stroke for every call for release on the last watch: eleven, fourteen, nine, twenty-two. The column headed SENT has no strokes at all. Its brass peg still sits in the hole marked HOLD.',
  },
  {
    id: 'rift_cw_muster_roll', title: 'Muster Roll of the Garrison Steps', place: 'The Garrison Steps', ...at('garrison_roll'),
    text: 'The third watch, in a clerk\'s even hand: Oda Fenn, Brannoc, Ysel of the lower stair, Corrin, Weir the younger, and forty more. After each name, a stroke for every watch stood. The ink stops a page from the back; the strokes do not. They run off the last page and down the lectern\'s edge, cut with a knife point, and the newest are still pale. No name is marked relieved.',
  },
  {
    id: 'rift_cw_relay_tally', title: 'Keeper\'s Tally at the South Relay', place: 'The South Relay', ...at('relay_south_tally'),
    text: 'The relay keeper cut two columns into the footing: words passed up the chain, words passed down. The up column fills the stone and climbs onto the next course. The down column stops on one line, with the reason beside it in the trade\'s shorthand: HELD AT SEAT. After that there are only hour-strokes, cut by someone still listening for the down bell.',
  },
  {
    id: 'rift_cw_kneeling', title: 'Inscription at the Kneeling', place: 'The Kneeling', ...at('kneel_inscription'),
    text: 'The plinth names the quarry and the masons\' lodge, then gives six panels for the names of the knights the statues show. The custom was to cut a knight\'s name when the watch was relieved, and not before. All six panels are smooth.',
  },
];

placeCatalog(RIFT_SITE_LOCATIONS);
placeCatalog(RIFT_SITE_SPAWNERS);
placeCatalog(RIFT_SITE_CHESTS);
placeCatalog(RIFT_SITE_LORE);

for (const l of RIFT_SITE_LOCATIONS) LOCATIONS.push(l);
for (const s of RIFT_SITE_SPAWNERS) SPAWNERS.push(s);
for (const c of RIFT_SITE_CHESTS) CHESTS.push(c);
for (const l of RIFT_SITE_LORE) {
  LORE.push(l);
  LORE_BY_ID[l.id] = l;
}
