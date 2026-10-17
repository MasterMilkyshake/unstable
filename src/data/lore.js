import { placeCatalog } from './worldPlacement.js';
// Lore tablets scattered across the isles. Reading one records it in the Journal [J].

export const LORE = [
  {
    id: 'log_gulls_reach', title: "Log of the Gull's Reach", place: 'The Wash', x: 15, z: -362,
    text: 'Day nineteen. The sky split again last night, east to west, like a seam. The sea went flat and silver and then the whirlpools opened. Half the crew went over the side to stop the screaming. I am writing this so someone knows we did not run aground. We were pulled.',
  },
  {
    id: 'founding_stone', title: 'The Founding Stone', place: 'Saltreach', x: 7, z: 17,
    text: 'HERE THE TIDE-BORN BUILT ON WHAT THE SEA RETURNED. We came from the water without names and took new ones. We will keep the lamp lit and the gates watched, and we will not ask the sea what it wants.',
  },
  {
    id: 'docks_notice', title: 'Notice of the Missing', place: 'Saltreach Docks', x: 9, z: -127,
    text: 'Gone past the breakwater: the skiff Dorel, two aboard. The fishing boat Saltmarrow, five aboard. A swimmer, unnamed, seen diving toward the violet light. If you find them, do not follow them. Ring the bell.',
  },
  {
    id: 'sera_diary', title: "Sera Vane's Diary", place: 'Old Lighthouse', x: -124, z: 54,
    text: 'He said a true duelist only fights where the footing is honest. Stone. Wind. A long fall behind. I have found it. Let them climb the hill. Let one of them be good enough. I am so tired of being the best person on a cliff.',
  },
  {
    id: 'on_oaths', title: 'On Oaths', place: "Vowkeeper's Perch", x: 35, z: 111,
    text: 'An oath is a shape you press into your soul while it is still soft. The Galeblade, the Seer, the Arcwarder, the Silent, the Hollow; then Dawn, Abyss, Contract and Blades. Nine surviving schools, each learned at a cost. Each one closes doors and opens a single window. Choose the window you want to look through for the rest of your life.',
  },
  {
    id: 'kaelens_orders', title: "Kaelen's Orders", place: 'Brigand Hold', x: 952, z: 258,
    text: 'Ferries run on the tide. Hit them coming out of Saltreach, not going in - nobody fights hard for an empty boat. Leave the old man at the lighthouse alone. Anyone who touches the violet pools answers to me. We are thieves, not fools.',
  },
  {
    id: 'owl_ruin', title: 'Inscription in the Ruins', place: 'Owlroost Hollow', x: 837, z: 99,
    text: 'The carving is older than Saltreach. It shows a figure with a crown standing beneath the sea, holding the islands up on a long chain. Someone has scratched out its face, many times, with many different blades.',
  },
  {
    id: 'drowned_prayer', title: 'A Drowned Prayer', place: 'Sunken Shrine', x: -663, z: -373,
    text: 'Mother of reeds, keep the water still. Keep the lurkers fed on fish. Keep the green-eyed ones in the deep fen, and if they must come out, let them come for someone else.',
  },
  {
    id: 'witch_effigy', title: "Witch's Effigy", place: 'Witchwater', x: -687, z: -331,
    text: 'A doll of reeds and hair, staked over the water. Knotted into it: "The sky broke and the Rift breathed out. We breathe it back in. We are the lungs of the marsh. Do not stop us breathing."',
  },
  {
    id: 'hunters_tally', title: "Hunter's Tally", place: "Hunter's Camp", x: -587, z: 760,
    text: 'Rimefangs: forty-one. Lost to rimefangs: two. Lost to cold: three. Lost to the robed ones on the slope: four. Lost to the dark wolves that leave no tracks: Hagen. Just Hagen. I will not write his number.',
  },
  {
    id: 'cult_hymn', title: 'Hymn of the White', place: 'The Pale Slopes', x: -692, z: 918,
    text: 'Still the water, still the blood, still the breath and still the bud. The Warden keeps what the Warden holds. Nothing rots in the perfect cold.',
  },
  {
    id: 'wardens_vigil', title: "The Warden's Vigil", place: 'The White Hollow', x: -728, z: 946,
    text: 'It was set here to keep something frozen. Not the island - something under it. The ice is not its weapon. The ice is its work. It has forgotten that, the way a guard who stands long enough forgets the door behind him.',
  },
  {
    id: 'ignis_notes', title: "Ignis's Field Notes", place: 'Cinder Camp', x: 651, z: 750,
    text: 'Ember glass records pressure the way tree rings record seasons. Every sample shows the same thing: a pulse, slowing. The Colossus is not erupting. It is holding the eruption in. If it dies, I am not sure what happens to the mountain.',
  },
  {
    id: 'colossus_heart', title: 'Heat-Scarred Plaque', place: 'The Caldera', x: 760, z: 866,
    text: 'TO THE ONE WHO STANDS IN THE FIRE: YOU WILL NOT BE THANKED. YOU WILL NOT BE RELIEVED. BEAR IT ANYWAY. - placed by those who built you, who will be ash long before you are.',
  },
  {
    id: 'zealot_sermon', title: 'Zealot Sermon', place: 'Zealot Rise', x: 736, z: 952,
    text: 'The Colossus suffers so the mountain may sleep. We will suffer with it. Each brand is a promise: when it falls, we will be the fire that remains.',
  },
  {
    id: 'mossbound_totem', title: 'Mossbound Totem', place: 'Mossbound Hollow', x: 82, z: 990,
    text: 'Carved faces stacked one atop another, each wearing a mask. The lowest are worn smooth by centuries of rain. The highest is new, and its mouth has been carved open - screaming, or singing. The Mossbound do not say which.',
  },
  {
    id: 'kingsfall_stone', title: 'The Kingsfall Stone', place: 'Kingsfall', x: 18, z: 1068,
    text: 'The jungle tells it like this: the first king of the Verdance was not crowned. It simply sat down here, and the trees grew up around it to see what it would do. It is still sitting. The trees are still watching.',
  },
  {
    id: 'hollow_scratchings', title: "The Hollow Man's Scratchings", place: 'The Rift', x: 6015, z: 5846,
    text: 'One hundred and twelve. One hundred and thirteen. Every time I die here I wake a little less. Every time, I remember a little less of what I was trying to remember. I think it was a name. I think it was mine.',
  },
  {
    id: 'drowned_oath', title: 'Oath of the Drowned Order', place: 'The Drowned Keep', x: 5957, z: 6066,
    text: 'We will hold the gate until relieved. We will hold the gate until relieved. We will hold the gate until relieved. (The line is carved again and again, fresher each time, until the stone runs out.)',
  },
  {
    id: 'before_throne', title: 'Before the Throne', place: 'Throne of the Drowned', x: 6012, z: 6136,
    text: 'He was the chain in the old carving: the crowned one beneath the sea, holding the isles up. When the sky cracked he let go of the chain to catch himself. Now he sits, and drinks the fracture, and calls it a kingdom.',
  },
  {
    id: 'depths_first', title: 'Scratched at the Ramp', place: 'The Landing That Never Came', x: 5896, z: 6143,
    text: 'IF YOU ARE READING THIS YOU WENT TOO FAR. Go back up. The Duke was a king of the drowned. The thing at the end of this place is not a king. It is the boat.',
  },
  {
    id: 'lanternless_vigil', title: 'The Ferryman\'s Toll', place: 'The Landing That Never Came', x: 5914, z: 6160,
    text: 'Every soul that sinks is owed a crossing. Every crossing is owed a toll. He has collected for so long that the lanterns of the lost hang from him like fruit, and he no longer remembers which one was his own.',
  },
  {
    id: 'wren_register', title: "The Blanket Register", place: "The Wash", x: -9, z: -317,
    text: "Two blankets, one cup, one name chosen. Do not put the chosen name beside the description of the body. If the sea brings them back different, I will not be the one to tell them they are wrong. Today a survivor asked whether I was their father. I said no. I stayed until they slept. — Wren",
  },
  {
    id: 'saltreach_charter', title: "Harbor Charter, Amended", place: "Saltreach", x: -12, z: 22,
    text: "Year 9: a roof before a debt; a name before a number. Year 108 amendment: vessels may be retained against unpaid harbor dues. Three signatures appear below the amendment. Someone has underlined the first sentence so hard that the nib tore the parchment.",
  },
  {
    id: 'ilvar_primer', title: "A Vessel, Not a Well", place: "Sage’s Tower", x: 33, z: 40,
    text: "Mana passes through the world. Ether lets a living mind shape the passage. You are not creating fire from a word; you are teaching pressure where to leave. First lesson: breathe. Second: stop before you empty yourself. Third: the first two lessons still apply when someone calls you powerful. — Ilvar",
  },
  {
    id: 'kindred_register', title: "Twelve Hands on One Wall", place: "Saltreach", x: -23, z: 13,
    text: "Foundation crew: Ashkin, Hollowfang, Vahl, Morrow, Glimmerkin, Velani, Kithari, Stonebrood, Saberan, Lumenite, Starborn, Drakeling. Paid in bread, shelter, and the right to bring another household. The reverse lists injuries, borrowed tools, two marriages and an argument about mortar. No royal seal appears anywhere.",
  },
  {
    id: 'harbor_chronology', title: "The Harbor Years", place: "Saltreach Docks", x: -10, z: -112,
    text: "0: the break. 2: the lamp raised. 9: shelter rule cut in stone. 31: northern road lost. 57: relief ships departed, none returned. 76: reed wardens formed their Covenant. 83: Gull took the watch. 108: three ferry crews dispossessed. 112: seven crossings lost. 113: stop leaving space for a quiet year.",
  },
  {
    id: 'vowkeeper_record', title: "The Refusal That Remains", place: "Vowkeeper’s Perch", x: 49, z: 116,
    text: "A student asked why the Hollow swear to have no oath. Because a refusal can become a cage as surely as obedience, I told her. She asked whether that made freedom a lie. No. Only a thing you must practice. The shrine below can return your training. It cannot return the person who had not yet chosen.",
  },
  {
    id: 'redwake_ledger', title: "The Unpaid Crews", place: "Brigand Hold", x: 972.4, z: 225.6, floor: 0.75,
    text: "Saltmarrow crew: wages withheld, vessel retained. Dorel crew: wages withheld, vessel retained. Redwake crew: wages withheld, vessel retained. Kaelen has crossed out RETAINED and written STOLEN. On the next page: flour taken from the northbound ferry, six sacks. Passenger compensation: zero. Both pages are in his hand.",
  },
  {
    id: 'compact_record', title: "A Compact Without a Crown", place: "Owlroost Hollow", x: 844, z: 85,
    text: "Let the north keep the cold, the furnace release the heat, the reeds spread the water, and the roots carry what is slow. Let no station claim the labor of the others. The chain is a message, not a master. A later hand has added a crown above the text. An even later hand has tried to chip it off.",
  },
  {
    id: 'reed_testament', title: "Testament of a Reed Warden", place: "Sunken Shrine", x: -655, z: -383,
    text: "Moss thinks we foul his water. My sister thinks we should let him drink it without us for a week. I carried a basket of clean fish to his landing and left before sunrise. He threw it away. We have made ourselves so frightening that even our apology looks poisoned. Tomorrow I must replace the outlet under his nets.",
  },
  {
    id: 'warden_maintenance', title: "Northern Service Plate", place: "The White Hollow", x: -717, z: 953,
    text: "REGULATOR N: the walking shell may be replaced. The deep cold bed must not be breached. If command synchronization fails, remove the core and maintain the passive channels by hand. Minimum relief crew: twelve. Beneath the plate are twelve empty hooks, each labeled with a tool that is no longer here.",
  },
  {
    id: 'furnace_instructions', title: "Instructions for a Relief Crew", place: "The Caldera", x: 739, z: 859,
    text: "The shell stands in the fire because you cannot. Do not mistake endurance for consent. On removal of its core, the overflow galleries will carry the pressure for a time. Open and tend them. A regulator without attendants is only a delayed catastrophe. Someone has burned away the section headed WAGES AND REST.",
  },
  {
    id: 'root_covenant', title: "Names Lent to Wood", place: "Mossbound Hollow", x: 100, z: 975,
    text: "This mask held Ena, who taught us the western planting. This one held Sor, who came from a ship and stayed to mend roofs. When a mask rots, we carve another and speak the name into it together. When a stranger takes it, who will know what was carried away? We are not faceless beneath them. We are accompanied.",
  },
  {
    id: 'maren_confession', title: "Maren’s Unsent Letter", place: "Saltreach", x: 5, z: 44,
    text: "My grandmother copied the signal while the room filled with water: WITHHOLD RELEASE UNTIL CROWN VESSELS CLEAR. I kept it folded beneath the shelter register. I told myself the living needed a town more than the dead needed an answer. Now I send strangers after the cores and call that courage. If you find this, ask me whose courage I am spending.",
  },
  {
    id: 'relief_order', title: "Relief Signal, Undelivered", place: "The Drowned Keep", x: 5941, z: 6052,
    text: "TO ALL KEEP STATIONS: relief is granted. Leave the command chain. Take the families through the west stair. There will be no penalty for abandoning the post. The receiving bell was sealed by sovereign order before this signal arrived. A knight has worn a groove in the stone beneath the words he can no longer read.",
  },
  {
    id: 'ferryman_manifest', title: "The Manifest Without a Landing", place: "The Landing That Never Came", x: 5904, z: 6174,
    text: "Collected: a potter’s name, a child’s nickname, the word a husband used only at home. Destination: pending. Collected: a name rubbed out so hard that the page is transparent. Destination: pending. Collected: the ferryman’s own name. Destination: pending. At the bottom, in a different hand: a toll is not a right to keep us.",
  },
  {
    id: 'gull_lampbook', title: "Thirty Years of Oil", place: "Old Lighthouse", x: -107, z: 53,
    text: "Year 83: took the lamp. Year 91: replaced the lens. Year 102: Bess brought soup when my hands shook too much to trim the wick. Year 113: the duelist says this is honest ground. I asked what she thinks the light is for. She looked at the sea as though she had never seen a ship.",
  },
  {
    id: 'bess_book', title: "A Table Kept Open", place: "The Salted Anchor", x: -29, z: 19, prop: 'book',
    text: "If you cannot pay, mend a chair. If you cannot mend, wash a bowl. If you cannot stand, sit. Hale says this encourages idleness. Hale has never once paid for the soup he takes to the night watch. I write that here because affection should not be allowed to ruin the accounts. — Bess",
  },
  {
    id: 'deep_soundings', title: "A Sounding with No Bottom", place: "The Landing That Never Came", x: 5880, z: 6164,
    text: "We lowered a bell until the rope ended. We heard it above us. We lowered a lamp until the light failed. Something below asked us to put it back. There are places deeper than distance. Do not promise a map of them. — Last page of the Year 57 expedition survey",
  },
  // ---- the Enclave, the Ministry and the new reaches (storyline sources)
  {
    id: 'enclave_writ', title: 'The Writ of Reclamation', place: 'Saltreach Sea Gate', x: 7, z: -78,
    text: 'BY ORDER OF THE GRAND WARDEN OF THE ENCLAVE, heir of the Anchor and keeper of the crown fleet: the Anchorage is reclaimed. All harbors will fly the chain. All returned persons are to present themselves for entry in the Registry, that the drowned may be counted and the counted may be kept. Those who are entered will be protected. Those who are not will be presumed to belong to no one. — Captain Thessaly Crane, Envoy, for the Enclave.',
  },
  {
    id: 'grand_warden_log', title: "The Grand Warden's Log", place: 'The Chain Citadel', x: 795.2, z: -631.2, y: 47.8, floor: 1.8,
    text: 'One hundred and thirteen years at sea, and the crown came home to a coast that had learned to do without it. They called our ancestors cowards. They were not. The Anchor ordered the release withheld so the fleet could live; the fleet lived; the order was correct. Now I will finish what he could not hold. The seal goes with me through the Sluice. If the throne will not take a living Anchor, it will learn to. — A. Vell',
  },
  {
    id: 'ministry_soundings', title: 'Soundings, Year 113', place: 'The Quiet Archive', x: -976.6, z: 405.8,
    text: 'Passage depth beneath the Wash: falling. Returns per month: rising. Memory retained on return: falling. Pressure at the throne: rising since the crown fleet entered the outer sound. Conclusion: the chain is being pulled from above for the first time since Year 0. If the Grand Warden sits, the regulators answer to one will again. Recommendation, as in every year since 9 AF: close the passage. Dissent recorded (Clerk Wick): "And the returned?" No answer recorded.',
  },
  {
    id: 'registry_ledger', title: 'Registry of Returned Persons', place: 'Meridian Ward', x: 695, z: -518,
    text: 'Entry 4,112: female, Ashkin, no name given, assigned "Ash 4,112". Entry 4,113: male, Velani, gave name "Tomas", recorded as "Velani 4,113 (claims Tomas)". Entry 4,114: refused entry, released. Entry 4,115: refused entry, detained pending review. In the margin, in a different hand: "Wren on the Wash does not ask them anything but whether they are cold."',
  },
  {
    id: 'crown_sluice', title: 'Drydock Notice', place: 'The Crown Drydock', x: 814, z: -742,
    text: 'THE SLUICE IS NOT A HARBOR. Hands are not to swim, fish or dispose of refuse in the basin. The violet light is the passage. The Grand Warden has descended on crown business; no one is to follow. Shift crews will continue work on the Constant Crown until relieved.',
  },
  {
    id: 'anchor_plaque', title: "Inscription on the Anchor's Fall", place: "The Anchor's Fall", x: -8, z: 688,
    text: 'RAISED BY THE ANCHOR DYNASTY IN THANKS FOR THE BEARING OF THE COAST. Scratched beneath, much later: "He did not bear it. We did." And beneath that, newer still, in Keeper script: "Both of these are true. Neither is the whole story."',
  },
  {
    id: 'reed_last_lantern', title: 'Notice at the Last Lantern', place: 'Reedbank', x: -513.4, z: -263,
    text: 'THE LAST LANTERN. Lit at dusk by whoever keeps the landing. If you are going east into the channels, take a wick from the box and chalk your name on the slate. When you come back, put the wick back and wipe your name off yourself. Do not wipe anyone else\'s. — Warden Isel, for the eastern channels. Underneath, in another hand: Three names have been on the slate since the spring. We light it anyway.',
  },
  {
    id: 'gallows_notice', title: 'Notice on Gallows Rock', place: 'Gallows Rock', x: 432, z: -320,
    text: 'These cages hold no one today. Let the empty cages speak for the full ones of Year 108, when the harbor seized the ferries and the ferrymen became the Redwake. The Enclave did not build these. It only repaired them.',
  },
  {
    id: 'saint_ebb_log', title: "Saint Ebb's Lamp-Book", place: "Saint Ebb's Light", x: -326, z: -628,
    text: 'Compact signal tower, outer marker. Duty: keep the lamp, relay the relief signal from the Keep to the marsh channels. Last entry, 0 AF: "Signal from the Keep: RELEASE REQUESTED. Awaiting confirmation from the crown." There are no more entries. The lamp was relit in 61 AF by someone who did not sign their name.',
  },
  {
    id: 'gulls_wreck', title: "The Gull's Reach, Aft Cabin", place: "Wreck of the Gull's Reach", x: 152, z: -350,
    text: 'Passenger list, eleven names. Nine are crossed out with the same pen. Beside the tenth: "washed toward the Wash, may live." Beside the eleventh the ink has run so badly that the name cannot be read. You realize, with no way to prove it, that the eleventh line is the right length to be yours.',
  },
  {
    id: 'chair_names', title: 'Chairs of the Hush', place: 'The Chair Fields', x: -866, z: 248,
    text: 'Each chair stands for one who did not come back up. The Ministry carves no names: a name on a chair is a promise that the person is gone, and the Ministry has learned not to promise that. The chairs face the sea. If someone returns, their chair is turned around.',
  },
  {
    id: 'listening_stones', title: 'Carving on the Listening Stones', place: 'The Listening Stones', x: -1085, z: 413,
    text: 'Vahl listening stones, older than the Compact. Put your ear to the tallest and you can hear the shelf move beneath the sea, slow as breathing. The Ministry learned to measure here before it learned to keep secrets. Someone has chalked a tally on the fallen stone: the number of days it has been quiet. The count stops a year ago.',
  },
  {
    id: 'drowned_bell', title: 'The Drowned Bell', place: 'The Drowned Bell', x: -1226, z: 298,
    text: 'A Compact relief bell, cast to answer the Keep. Its clapper was chained when the crown withheld the release so that no station could sound it without orders. The chain has rusted through. On storm nights the bell rings on its own, and things in the surf turn toward the sound as if something below is still waiting for the answer.',
  },
];

LORE.push({
  id: 'meridian_signal_ledger', title: 'The Signal Keepers Ledger', place: 'Signal Keepers Camp',
  x: 945.2, z: -587.2, prop: 'letter',
  text: 'Three lamp crews sent uphill. Two weeks of oil issued. No wages received. The fort\'s new commander says the mountain watch belongs to the fort; the fort clerk says our names are not on his roll. Supplies now go up by cage from the lower yard. We still carry ours along the old trail. Leave the last lantern burning for the relief crew. Someone has added beneath it: if they come, tell them we waited.',
});

export const LORE_BY_ID = Object.fromEntries(LORE.map((l) => [l.id, l]));

// Short bestiary notes shown in the Journal once a creature has been slain.
export const BESTIARY_NOTES = {
  mudlurker: 'Shoreline ambushers. Their tongue lash reaches further than it looks.',
  brigand: 'Red-bandana raiders. They block and parry - feint them.',
  brigand_brute: 'Slow, heavy, hard to stagger. Dodge the greataxe and punish.',
  brigand_cutthroat: 'Quick knife-fighters who throw blades from range.',
  gloomowl: 'One to a nest, and big enough to fill it. Its screech cannot be blocked, and nothing stops its dive once the wings rise - roll as they come down.',
  sharko: 'Pale walkers that range the open ground in pairs. Nothing staggers one: parry the rakes, roll the kick, and step aside from the charge.',
  scuttler: 'Armored from the front. Strike from the side or behind.',
  rimefang: 'Pack wolves of Frosthollow. Their bite chills.',
  ash_golem: 'Fire-proof and nearly unstoppable. Ice cracks them.',
  cinder_imp: 'Flying fire-throwers. Close the gap fast.',
  gnashfin: 'Deep-water sharks. Their bite cannot be parried. Stay near shore.',
  hollow: 'Husks of the Rift-drowned. Each hit gnaws at your sanity.',
  riftling: 'Floating eyes that fire homing void bolts.',
  fen_witch: 'Reed-hooded casters of wind, shadow and frost. They dodge often.',
  witch_queen: 'Old Mother Reed. A spell-flinging duelist who dodges constantly and calls her daughters when wounded.',
  bog_lurker: 'The Bog Mother. Her tongue and belly-slam cannot be parried.',
  frost_cultist: 'Worshippers of the Warden\'s ice. Weak to fire.',
  frost_stalker: 'Dark wolves whose pounce glows red. Their bites bleed.',
  ash_zealot: 'Spear-wielding fire priests of the Spire.',
  cinder_crab: 'Lava-veined scuttlers. Their pincers burn.',
  thunderwing: 'Storm-touched owls that fling lightning.',
  drowned_knight: 'Knights of a sunken order. Break their guard - they block nearly everything.',
  abyssal_watcher: 'Great Rift eyes. Their gaze cannot be blocked and erodes the mind.',
  duelist: 'Sera Vane. A master of the parry. Her flash lunge cannot be parried.',
  jungle_ape: 'Rock-throwing apes of the Verdance canopy. Their leap shakes the ground.',
  jade_serpent: 'Fast jungle snakes. Their coil strike glows red; their spit blinds.',
  mossbound: 'Spear-warriors of the Verdance tribe, quick to dodge.',
  mossbound_shaman: 'Wind- and shadow-casters of the Mossbound. Close the distance quickly.',
  thresher: 'Bonegnaw. It burrows and erupts beneath you - keep moving when it vanishes.',
  primadon: 'The Old King. Its roar breaks guards and it calls its kin when wounded.',
  void_hound: 'Abyssal hounds. Their pounce cannot be parried; their howl breaks guards.',
  abyss_knight: 'Knights who sank further than the Drowned Order. Almost nothing staggers them.',
  lanternless: 'The Ferryman of the Abyss. Teleports, reaps, and calls hounds from the dark.',
  warlord: 'Kaelen the Red. He leaps and enrages when wounded.',
  frost_warden: 'Keeper of the White Hollow. Wields frost mantras.',
  cinder_colossus: 'The heart of the Ashen Spire. Its sweep cannot be parried.',
  hollow_duke: 'The Sovereign Beneath. Summons hollows as he weakens.',
  castellan: 'Odric, Castellan of Hightoll. His knell cannot be blocked: dodge through the ring. Throws stones at the cautious; calls his sentries as he weakens.',
  hightoll_sentry: 'The garrison of Hightoll, still at its posts. Heavy guard; they rarely parry.',
  watch_guard: 'The Saltreach Watch. They fight anything that threatens the town and anyone who strikes them first.',
  watch_pikeman: 'Watch pikemen hold gates and narrow streets. Get inside their reach.',
  peacekeeper: 'The Enclave\'s soldiers, sent wherever the returned wash up. They feint, block and parry; harmless to the registered until the Enclave goes to war.',
  peacekeeper_halberdier: 'Long reach, heavy guard. Bait the swing, then close in.',
  peacekeeper_arbalist: 'Crossbows from the walls. Their bolts can be parried.',
  enclave_captain: 'Officers of the Vice Warden\'s guard at Fort Meridian. Heavy armor that does not stagger.',
  ministry_soundsman: 'Grey-robed Ministry fencers who fight with shadow and wind.',
  ministry_silencer: 'The Ministry\'s quiet knives. Fast, evasive, rarely seen twice.',
  vice_warden: 'Varga Thorne, the Vice Warden. Leaps like a boarding plank, calls Peacekeepers when wounded.',
  grand_warden: 'Aurek Vell, the Grand Warden. His chain lash cannot be blocked; dodge it.',
};

placeCatalog(LORE);
