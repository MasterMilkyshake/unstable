# World life plan

The last development round's world work (agent/world-life): the ledge-built world with height as danger, every region to the environment standard, the sea, world audio, factions that move, standing that matters, and the further world patterns below. Written before building; the "Built" column of each table is filled in as the work lands. Original setting only: every name below is Unstable's own.

## The ledge rules this world is built on

Read from `entities/player.js` (`probeLedge`, `tryLatch`, `updateHang`, `wallHop`) and `data/stats.js` (`computeDerived`), and checked against the real controller by tests/ledge-reach.test.js:

- **A jump** from the ground rises 1.41 m. The hands catch an edge 1.2–2.3 m above the feet, so an edge up to about 3.6 m above the ground is caught from a standing jump (1 latch). An edge less than 2 m above the floor is pulled straight over.
- **A wall hop** (jump in the air against a wall with no edge in reach) adds about 1.07 m (Agility 0) to 1.3 m (Agility 70), and costs a latch.
- **A leap from a hang** rises about 2.3 m; with forward held it carries the body onto the top.
- **What counts as an edge:** the wall ends there (nothing within 0.6 m past the face at 0.3 and 1.2 m over the top) and a body fits on it (1.9 m of room 0.4 m and 0.9 m past the face). So **every catchable edge is a place to stand**, and standing restores the latches. There are no "hang-only" holds: a tier is gated by its tallest **pitch**, the sheer stretch between two places to stand, which takes one catch and as many hops as it is tall.
- **Stacked ledges need setbacks.** There is no ceiling collision: a body jumping up under an overhang is pushed sideways out of it. So a line of ledges is a stair of treads at least 1.0 m deep, each riser set back from the one below, not holds stacked straight up a face.

The tallest sheer pitch each build takes (tools/reach/graph.mjs `climbColumn`, binary search on a test wall; the controller agrees at 3.5–9.6 m in tests/ledge-reach.test.js):

| Build | Latches | Tallest pitch |
| --- | --- | --- |
| fresh, Agility 0–34 | 3 | 5.4–5.6 m |
| Agility 35–69, or Agility 0 with Cat's Grace / Wall Runner / Nine Lives / Updraft | 4 | 6.3–7.0 m |
| Agility 70, or Agility 35 with one latch talent | 5 | 7.3–8.2 m |
| Agility 70 with the Acrobat's double jump (Agility 40) | 5 | 9.2 m |

So the world's pitches are authored in four bands:

| Pitch | Chain (latches) | Who | Use |
| --- | --- | --- | --- |
| up to 3.4 m | 1 | anyone | steps, ruins, rooftops, shortcuts |
| 4.6–5.0 m | 3 | a fresh character who hops on time | the second tier: vantages, mid chests |
| 6.0–6.2 m | 4 | Agility 35 or a latch talent | the high tier: tougher camps, better chests |
| 7.0–7.2 m | 5 | Agility 70, or 35 and a talent | the crowns: the best chests, the big views |

High and crown tiers also keep a **hidden route** for a three-latch character: a carrier line, a cave or cleft stair, or a fort stair, found by looking.

**Visual language.** A catchable lip on an authored line wears a **capstone**: a pale, warm slab a shade lighter than the rock, its front edge softened with a moss strip (frost-rimed in Frosthollow and the Hush, ash-grey on the Ashen Spire, root-bound in the Verdance). Risers between treads are the region's own rock. A face meant to be **unclimbable** is left plain: dark, jointed, without caps (the Old Crown, Hightoll's rock, the Westwold's range). The rule reads at a glance from below: pale lips go up, dark faces don't. Recorded in ENVIRONMENT_ART_DIRECTION.md.

**Enemies don't latch.** Camps stand on ground they can walk, with the line arriving at the shelf's edge away from the camp's centre. High camps carry a ranged foe (an arbalist, an owl, a thrower) so that standing on a ledge above a fight is not a free win.

**The reach tool** (task 3): `node tools/ledge-reach.mjs` builds the real world headlessly and searches every landmass from the Wash (the Rift from its arrival shelf) for builds of 3, 4 and 5 latches; it reports every chest, written source, camp, great foe, landmark and asked point (`--at=x,y,z`, for quest targets) as reached on foot, by a line or lift, or by ledges, with the latches the route needs. tools/reach-check.mjs remains the in-game check with real input.

## Tiers and climbing lines, per landmass

Bands: **Shore** (walk), **Downs** (a road or a 1-latch step), **Heights** (a 3-latch pitch, or a road), **High** (a 4-latch pitch or a hidden route), **Crown** (a 5-latch pitch or a hidden route). Enemy levels and chest silver rise with the band. Heights are metres above the sea; coordinates are final world metres (+x west).

### Saltreach, the Wash, Shimmerfen and Hightoll

| Band | Where | Foes | Chests |
| --- | --- | --- | --- |
| Shore 0–8 | the Wash's beach and camp, the harbor, the fen | mudlurkers, scuttlers (1–4) | 10–70 |
| Downs 9–17 | the dune steps (12), the Seamspire spur with the Oar Barrow and the Wash Prospect (16), the Reed and West Downs, Greywood (14) | brigands, cutthroats, fen witches (3–8) | 30–110 |
| Heights 24–28 | the Seamspire summit (28), the Lamp and Perch Bluffs (26), Kestrel's middle shelf (28), Hollowbrook (24) | gloomowls, rimefang, the duelist (6–10) | 60–150 |
| High/Crown 38–60 | the Lamp Bluff's crown (38), the Kestrel Beacon (40), Hightoll (60) | rimefang, Hightoll's sentries, the castellan (8–15) | 120–280 |

| Line | From → to | Pitches (m) | Chain | Leads to | Hidden route |
| --- | --- | --- | --- | --- | --- |
| P2 the Prospect line | the Wash camp's terrace → the Wash Prospect (16) | carrier line | — | the first raised view over the Wash; the first line a new player rides | — |
| S1 the Barrow Steps | the Wash strand → the Oar Barrow spur (16) | 3.2 ×4 | 1 | the Barrow's carving and chest; the Prospect | — |
| S2 the Seamspire Chimney | the Oar Barrow (16) → the Seamspire summit (28) | 3.0, 4.8, 4.2 | 3 | a summit cairn over the Arch Mere and the Arches, a Heights chest | the P2 line + a walk over the spur |
| S3 the Lampwright's Stair | the Lamp Bluff (26) → its crown (38) | 3.2, 6.1, 2.7 | 4 | the old signal lamp's ruin: a rimefang den with an owl, a High chest, a record | a cleft stair on the bluff's sea side |
| S4 the Kestrel Face | Kestrel's middle shelf (28) → the beacon (40) | 7.1, 4.9 | 5 | a shortcut to the beacon and its chest | the Kestrel Climb road |
| S5 the Harbor Roofs | the harbor ward's crates → porch roofs → the town wall walk | 1.8, 2.9, 3.2 | 1 | a way over the wall into the market | the gates |
| S6 Saint Ebb's broken stair | the islet's rocks → the light's lamp room | 3.1, 4.7, 3.0 | 3 | the keeper's chest and log | — |

### Thornwood, Meridian and the Ashen Spire

| Band | Where | Foes | Chests |
| --- | --- | --- | --- |
| Shore 0–4 | Rook's Landing, the Westwold's foot, Meridian's docks and Ward | brigands, owls, scuttlers (3–6); the Enclave's posts (13) | 30–60 |
| Downs 12–18 | the Redwake upland and Brigand Hold (12), Owlroost (12), Widow Ridge (18), the ashfield tongues (7–15) | brigands and Kaelen (3–7), cinder imps (10) | 60–140 |
| Heights 22–34 | the Thorn Crown (22), the Redwake Fells and the Watchfire (26), Widow's crags (28–30), the cone's shelves (22–34) | brigands, owls (6), zealots, golems (11–12) | 80–140 |
| High/Crown 38–47 | the Meridian Heights (38–46), the basalt columns' tops (24), the caldera's rim (47) | Enclave posts (13–17), zealots, the Colossus (12–16) | 120–200 |

| Line | From → to | Pitches (m) | Chain | Leads to | Hidden route |
| --- | --- | --- | --- | --- | --- |
| P1 the Watchfire line | Brigand Hold's gatehouse → the Redwake Watchfire (26), and a line back down to the Red Trail | carrier lines | — | the Watchfire's camp, chest, record and tower (cut off today) | — |
| T1 the Thorn Crown steps | the Red Trail (12) → the Thorn Crown (22) | 3.0, 4.8, 2.2 | 3 | the crown's chest and a view down on the Hold's yard | the upland path round its north side |
| T2 Widow's Teeth | Widow Ridge (18) → the south crag (30) | 3.2, 6.0, 2.8 | 4 | a deserter's camp, a High chest, the first sight of the bastion and the sea | a cleft stair behind the crag |
| T3 the Basalt Stair | the ashfield (10) → the tallest column (24) | 3.0, 3.4, 4.9, 3.2 | 3 | a chest on the column top and the cone filling the view | — |
| T4 the Ember Circlet | the cone's summit shelf (34) → a tooth of the rim (47) | 3.1, 7.0, 2.9 | 5 | the zealots' reliquary on the rim, a Crown chest, the caldera from above | the Attendants Road's cut, then a cleft up the rim's inner face |

### Frosthollow and the Hush

| Band | Where | Foes | Chests |
| --- | --- | --- | --- |
| Shore 0–5 | Frostwatch, the Hunter's Camp, Hush Landing | rimefang, cultists (8–9); the Ministry's posts (14) | 50–100 |
| Downs 11–20 | the White Pass, the great shelf's foot (12–20), the Pale Shelf, the Chair Fields, the moor's steps | rimefang, stalkers (8–11), soundsmen (14) | 50–110 |
| Heights 30–34 | the White Hollow (30), the Sounding House (34) | the Frost Warden, stalkers, the silencer (11–15) | 60–110 |
| High/Crown 40+ | the great shelf's crown (40), the Hush's sea stacks | stalkers, thunderwings (11–13) | 110–180 |

| Line | From → to | Pitches (m) | Chain | Leads to | Hidden route |
| --- | --- | --- | --- | --- | --- |
| F1 the Icefall Steps | Frostwatch's shore → the shelf above the village (12) | 3.2 ×3 | 1 | a shortcut to the White Pass | the road |
| F2 the Hunter's Chimney | the great shelf (20) → its crown (40) | 3.2, 6.1, 3.0, 4.6, 3.1 | 4 | a frost stalkers' den with a thunderwing, a High chest, the Warden's hollow seen from above | the aqueduct's maintenance stair |
| H1 the Listening Stacks | the Hush's south strand → the tallest sea stack | 3.0, 4.8, 7.0 | 5 | a sounding platform: a Crown chest and the Ministry's own soundings (a record) | a carrier line the soundsmen strung from the cliff top |
| H2 the Chair Steps | the Chair Fields (11) → the moor's next step (17) | 3.0, 3.0 | 1 | a shortcut toward the Sounding House | the Sounding Way |

### The Verdance

| Band | Where | Foes | Chests |
| --- | --- | --- | --- |
| Shore 0–3 | Canopy Landing, the jungle floor | apes, serpents (12–13) | 70–120 |
| Downs 10–16 | Mossbound Hollow (10), Kingsfall (16) | Mossbound (13–14), the Thresher and the Old King (15–18) | 90–260 |
| High 24+ | the root crowns over the floor | apes (13) | 120–200 |

| Line | From → to | Pitches (m) | Chain | Leads to | Hidden route |
| --- | --- | --- | --- | --- | --- |
| V1 the Rootstair | the floor → a canopy platform on the great root (24) | 3.2, 3.0, 6.0, 3.0 | 4 | a Mossbound lookout: a High chest and a mask record | a vine-hung root ramp on the far side |

### The islets

| Line | Where | Pitches (m) | Chain | Leads to |
| --- | --- | --- | --- | --- |
| I1 the Kneeling Back | the Anchor's Fall: up the statue's back to its crown | 3.0, 4.7, 3.2 | 3 | the corrected plaque's last line, a chest |
| I2 the Cage Gantry | Gallows Rock: the rock to the empty cages | 3.2, 3.0 | 1 | the cage ledger (a record) |
| I3 the Foremast | the Gull's Reach: the wreck's hull to its crow's nest | 2.8, 3.1 | 1 | a spyglass view of the strait, a small chest |

### The Rift

The escape walk stays as it is (no difficulty added). Optional lines only, off the walk: none planned beyond fixing the collider triage (task 5).

## Every region to the standard (task 5)

ENVIRONMENT_ART_DIRECTION.md's acceptance list, scored per region in WORLD_DESIGN_PLAN.md from tools/environment-review.mjs captures at noon and midnight, the map, ledge-reach and collider-check. Regions: the Wash, Saltreach, Shimmerfen, Hightoll, Thornwood, Meridian, the Ashen Spire, Frosthollow, the Hush, the Verdance, the four islets and the Rift. The Rift triage (WORLD_DESIGN_PLAN.md) is fixed: the 7 gatehouse parapets, the 5 chimney heads, the Bell Ward belfry cap and the Chainward nave's merlons, the Ascent's two free-standing outer ledges, and the record-press gap.

## The sea (task 6)

- **Sailing feel** (entities/boat.js): acceleration that builds and coasts, turning that needs way on (no spinning in place), collision with shores, piers and moles (colliders, not only the terrain ahead), no sticking against a coast (slide along it instead of the −0.2 bounce), and other boats.
- **Boarding and leaving:** step off onto the pier or the beach beside the boat, never into a wall or deep water when land is near; board from the water by swimming up.
- **Weather at sea:** squalls more often over open water, a heavier swell and more spray in a storm, the sea's own wind bed.
- **Encounters:** wrecks with something in them (flotsam you can salvage, a drifting hull with a record), sea marks that lead to them (a trail of floating timber, a buoy), sharks in the deep (existing), and the faction traffic below (convoys and cutters). No fast travel.

## World audio and music (task 7)

`core/audio.js`'s ambience and music (mine; the combat sounds stay Agent 3's): a layered bed per place instead of one noise band: ocean surf by the shore and open water, wind with height, rain and storm, forest, marsh, snow, a town by day (voices, work) and by night (quieter, dogs, a bell), interiors (the bed muffled, a hearth), and the Rift. Stingers for world events (a column's drum, a convoy's horn, a cutter's hail, the hunters' horn, a checkpoint's challenge, a breach). Music that rises with combat heat and falls back over a few seconds; a theme for each great foe (the seven without one today) and the Rift's own.

## Factions that move (task 8)

All events are host-only (they spawn enemies). A guest sees the event's props through one new message (`wev`, host to guests), sees its enemies as the usual proxies, and has its own outcomes (standing, silver, wanted) applied to its own character by a second (`wevr`).

| Event | Trigger and cadence | Actors | Outcomes | Standing and silver | Story reactions |
| --- | --- | --- | --- | --- | --- |
| **Enclave column** | every 6–10 min of play on Meridian and Thornwood roads; on Saltreach's coast roads after the Writ arrives | a captain or halberdier, 2–3 Peacekeepers, an arbalist, marching two abreast between Fort Meridian and its posts (Meridian Ward, the docks, the Signal Keepers' camp, the Crown Drydock, Rook's Landing) by `Enemy.navTo` | they fight what they meet; if you are wanted by the Enclave or Hated, they turn off the road and come for you | helping them against a monster +2; killing one −15 and wanted (as a guard) | Writ refused: they stop you to question you; war: they attack on sight and march in fours; Break the Chain: no columns; Claim the Seat: they salute you |
| **Road checkpoint** | at four road points, raised while your Enclave standing is Distrusted or lower, or you are wanted; and at the Watch's two gates when Watch standing is Distrusted | a barricade, an officer, 2–3 Peacekeepers (or Watch) | pay the toll, show your Writ (registered at Act I), or refuse and fight; Honored are waved through | toll: the faction's fine base; papers: free; fight: wanted and −10 | refused Writ: papers aren't an option; war: no talking; Claim: no checkpoints |
| **Supply convoy, road** | every 8–12 min on Saltreach's North and Reed roads (the Watch) and Meridian's Dock and Garrison roads (the Enclave) | a cart and its mule, a driver, 2–3 escorts; raiders ambush it once on the way | escort: stay with it to the end (+6 standing, silver); it can be lost to raiders; raid: kill the escorts and loot the cart | escort +6 and 40 + 6×Power silver; raid: loot, −12, wanted 300 s | war: Enclave convoys carry munitions and two more escorts; Seal: Ministry carts on the Rime Road |
| **Supply convoy, sea road** | a sloop between docks every 10–15 min | the sloop, its crew; raiders waiting on the far pier | escort: sail with it and hold the pier while it unloads; raid: board it at the pier | as the road convoy | as above |
| **Sounding party** | in the Hush every 8 min | 2 soundsmen and a clerk walking from the Sounding House to a sounding site, then sounding there for a minute | follow unseen (25–60 m) to watch the sounding: a record and XP; come within 15 m and they warn you, then fight; Trusted are let watch | witness: a record, XP; drive them off: −10 | Seal the Passage: they sound in the open, on every coast; Break: they sound in secret |
| **Watch against brigands** | at three sites outside Saltreach every 6 min until Kaelen falls, then rarer | 2–3 Watch against 3 Redwake | help the Watch: their purse; help the brigands: theirs | Watch +4, or −8 and wanted | after Kaelen: stragglers; harbor occupied: the Watch against Peacekeepers instead |
| **Bounty hunters** | wanted for over 3 minutes in all, or Hated: every 4–6 min | 2–3 of the faction's own (a warrant officer and Peacekeepers; Watch takers; Ministry silencers) | they track you; they leave when your mark lapses or is paid, or when they lose you (250 m, the Rift, the open sea) | killing them: their purse and a longer mark | war: they come in fours |
| **Enclave cutter** | at sea while wanted by the Enclave, or at war: every 4 min | an Enclave cutter (a sloop with an arbalist and Peacekeepers aboard) | it hails: heave to and pay, or run; running, its arbalist shoots; it lands its marines where you come ashore | paying clears the mark; outrunning it extends it | war: no hail |
| **The coast reacts** | the Act choices and the ending | — | who holds the coast (the map's holder and the guards at the docks): before the war, the Watch and the Enclave share it; the harbor occupied: the Enclave; Break the Chain: the Watch and the towns; Seal the Passage: the Ministry; Claim the Seat: the Enclave, in your name | — | — |

## Standing that matters (task 9)

- **Tier rewards:** at Trusted the officer opens their own stock (Hale, Commander Rell, Minister Quill); at Honored a faction outfit and trinket come by courier and checkpoints wave you through; at Exalted a unique reward and a title. Shop, item and dialogue entries go through Agent 4.
- **Rivalries:** a change with one faction moves the others a little, shown on the same toast: the Enclave and the Ministry pull against each other (a third of the change, opposite), the Watch sits between (a quarter, opposite to the Enclave, a fifth with the Ministry).
- **The contract board** at each officer: three contracts that turn over each in-game day, built on the event framework: escort this convoy, break that camp, clear a checkpoint (the Watch's work against the Enclave), recover a sounding line, bring supplies. Paying silver and standing.

## Further world patterns (task 10)

Found by search (Deepwoken's own wiki pages refuse fetches; facts from search snippets: the Deepwoken Wiki's Ships & Sailing, The Aratel Sea, Factions & Groups, Job Boards, Luminants, Lower Erisia and Controls pages). Each is our own version, under our own names.

| Pattern in the reference | Our version | Call |
| --- | --- | --- |
| Faction-against-faction fights at fixed places, which the player can join | the Watch against brigands; the Enclave against the Redwake on the Garrison Road | build |
| A merchant ship at sea, and a false one that is an ambush | sea convoys; a "convoy" that is Redwake raiders flying the Watch's pennant | build |
| A damaged ship beset by a sea monster | a drifting fishing boat with sharks circling: drive them off from the water or the shore and the crew rewards you | build |
| Thunderstorms at sea | squalls over open water, with a heavier swell | build |
| A bandit tower on a rock at sea | a Redwake lookout on a sea stack off the Westwold, climbed by ledges | build |
| Repeatable faction jobs at boards, of the ruling faction only where one rules | the contract boards at the three officers | build |
| Hunted by a faction's enforcers at low standing | bounty hunters and cutters | build |
| Low standing shuts a faction's vendors | a faction's officer and its traders refuse to sell to the Hated | build (shop through Agent 4) |
| Rescuing a faction's captives raises standing | captives in a Redwake camp, freed and walked to the Watch | build |
| Wind and sails: faster with the wind behind | a boat runs up to 15% faster with the weather's wind astern, slower into it | build (sailing feel, existing wind) |
| Sea marks that tell a sailor where things are | floating timber and buoys toward wrecks | build |
| A rare great event: a siege of a capital, chests at its heart | a Redwake raid on Rook's Landing or an Enclave assault on a Watch post | ask the user (a large set piece) |
| A great sea monster that rises every few hours | a great foe at sea | ask the user (a new great foe; new enemies are Agent 3's) |
| Whirlpools and voids that wreck boats; hull health and repairs | boats that can be holed and repaired | ask the user (a new resource) |
| Ship cannons | naval guns | ask the user (a new combat layer); not recommended |
| Summon your ship anywhere | — | rejected: no fast travel |

## The world map (task 11)

The chart shows the tiers (crown and high sites marked), landmarks, the carrier lines (drawn), and who holds the coast (each region's holder in its colour, and in the cartouche). Markers go through `ACTIONS.mapMarkers` (game/realm.js); the lines and the holder's wash need a drawing hook in ui/worldmap.js, which is Agent 4's: asked of them.

## Order of work

1. This plan. 2. P1–P6. 3. The reach tool (done first, to write this plan). 4. Ledges and tiers, the Wash and Saltreach first, then Thornwood, Frosthollow and the Hush, the Verdance, the islets. 5. Every region scored and fixed. 6. The sea. 7. Audio. 8–10. Factions, standing, patterns. 11. The map. 12. The final checks.

## Built (2026-10-16)

What of this plan stands in the game, and what does not (evidence in EVIDENCE_LEDGER.md, E-300 on).

| Task | Built | Not built, or partly |
| --- | --- | --- |
| The ledge rules, the reach tool (3) | tools/ledge-reach.mjs and tests/ledge-reach.test.js; reach tables per landmass at 3, 4 and 5 latches | — |
| Ledges and tiers (4) | 17 lines on every continent and two islets (data/ledges.js): the Barrow Steps, the Seamspire Chimney, the Lampwright's Stair, the Kestrel Face; the Thorn Crown Steps, Widow's Teeth, the Basalt Stair, the Ember Circlet; the Vigil Steps, the Chair Steps, the Hunters' Chimney, the Hatch Steps (to the Bell Under Ice); the Rootstair, the Gallery Face; the Gallows Steps, Saint Ebb's Steps, the Kneeling Steps (the Anchor's plinth). Four hidden scaffolds to the High tiers. Every line climbed in game at the latches its chain names; every scaffold walked to its top | S5 (the Harbor Roofs), H1 (the Listening Stacks), F1 (the Icefall Steps), I3 (the Foremast): the Gull's Reach's wreck is a 2.5 m scramble a jump takes, with no line; the crown of the Anchor's statue is not climbed |
| Every region to the standard (5) | the Rift's collider triage fixed (gatehouse parapets, chimneys, the belfry's cap, the Chainward's merlons, the Ascent's ledges, the presses); the surface clean | see WORLD_DESIGN_PLAN.md for the regions' scores |
| The sea (6) | the rudder needs way on; hulls meet the shore, piers and moles and run along them; hulls keep apart; wind in the sail; a landing spot when stepping off; squalls likelier at sea and a heavier swell in a storm; sea convoys, a false one, a fishing boat beset by sharks, a drift of wreckage to a hull worth salvaging | a drifting hull with a written record (records are agent/release's content) |
| World audio (7) | a place bed (surf, wind with height, a town by day and night, crickets, a hearth, birds, gulls, frogs, a dog, a hammer, a far bell), indoors muffled; the world's event calls; fight music for every great foe | music for the Rift beyond its existing theme |
| Factions that move (8) | every event in the table, host-run and seen and paid on a guest; the coast follows the story | a sea convoy is raided at sea (its crew put down), not boarded at the pier |
| Standing that matters (9) | rivalries on one toast; Trusted stores, Honored outfit and trinket, Exalted trinket and title (rows on agent/release); contract boards beside the three officers | — |
| Further patterns (10) | faction fights at fixed places (the Watch, and the Enclave on the Garrison Road), a merchant ship and a false one, a beset boat, squalls, contract boards, hunters, captives freed and brought to the Watch, wind in the sail, sea marks | the Redwake lookout on a sea stack off the Westwold (a new landmark: for the user); the vendors' refusal of the Hated (agent/release's shops); the four "ask the user" rows stay asks |
| The map (11) | who holds the coast washed in their colour, the carrier lines, the climbs by tier, the landmarks, a legend; the holder's line in the cartouche | drawn once agent/release's map hooks (`ACTIONS.mapOverlay`, `mapHolder`) are merged |
