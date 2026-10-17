# World design plan

## Structure (built)

The authored macro geography lives in `data/landforms.js` (continents), `data/world.js` (islands, locations, NPCs, chests) and `data/roads.js` (graded roads). Towns are composed set pieces built with `world/kit.js` and `world/mason.js`; procedural detail fills in vegetation, forage and wildlife. The whole world is built at boot.

- Continents: Saltreach + the Wash + Shimmerfen; Thornwood + Meridian (+ Ashen Spire on its east coast); Frosthollow + the Hush; the Verdance.
- Sea-road islets: the Anchor's Fall, Gallows Rock, Saint Ebb's Light, the wreck of the Gull's Reach.
- The Hundred Arches over the Wash, and **Hightoll** at their north end (3444b6d; crags and meadow added in Milestone 2 at the user's ask, below): a castle on a sheer 60 m rock, its court level with the Arches' road, seen on the left from the Wash spawn with the Arches running off to the right. Its castellan (Odric the Unrelieved, a great foe) keeps the Bridge Court. No road climbs the rock: **carrier lines** (zip lines) run from the end of the south road over both great breaks to the Bridge Gate, and from the Land Gate down to the Reed Road (`world/ziplines.js`, `game/ziplines.js`). Extend access with lines, not roads.
- Below: the Rift (sanity drain; the Ascent is the way home: one stone lift against the keep's north wall runs from arrival, from the courtyard to the summit and the Wound, and the walk from the arrival shelf to it is kept clear of camps). No campfires burn there. The Abyssal Depths and the two sealed pale gates were removed (2026-10-15, the user's call); the Lanternless keeps the Landing That Never Came on the Rift's north-east lip.
- Travel: no fast travel; rented boats (booked ferry passage was removed), roads between landings, carrier lines at Hightoll.

## Known problems

- Flyers, swimmers and aquatic enemies still steer in straight lines (walking enemies path with `Enemy.navTo`, A-02).
- Build-everything-at-boot: about 8.5 s to load since 102c8f6, and a 530–700 MB heap in play. Fine at today's size; streaming is needed before the world grows much more.
- Fixed and merged (43034a4): enemy navigation (A-02), the Chain Citadel strongroom doors (W-02), the Rift arrival hitch, and spawn heights (W-04: enemies spawn on the ground, not on rooftops).

## Milestone 2: the environment slice (2026-10-16)

Three areas scored against ENVIRONMENT_ART_DIRECTION.md's acceptance list from real captures at noon (sky time 0.5) and midnight (0.0), the in-game map, and checks that drive the real game. `tools/environment-review.mjs <out> [area]` reproduces every view on any build; `tools/route-check.mjs` plans the walks on the enemies' grid; `tools/reach-check.mjs` asks a fresh character's own controller; `tools/collider-check.mjs --rift` covers the Rift. Thornwood was picked as the dangerous region because it is Act I's destination (Kaelen and the Stolen Tooth): the first dangerous place a new player walks into after Saltreach. Evidence E-60 to E-70; screenshots on the `agent/environment-evidence` branch.

"Near-black" below is the share of 32 px tiles of a 1280×720 frame whose mean luma is under 0.03.

### The Wash to Saltreach

| Criterion | Score | What the captures and checks showed |
| --- | --- | --- |
| Silhouette | PASS | From the spawn Hightoll stands big and close on the left with the Arches running off to the right (the reference shot), and Saltreach's Keystone hangs over the town to the north. Now with crags beside Hightoll (below). |
| Terrain seams | PASS | No holes or cracks in 14 views. The black wedge beside Seamspire Abbey is a shelf's turf lip in shade (raycast: terrain, a 0.35 m band facing west), the designed shadow line. |
| Colliders, floaters | PASS | collider-check: 17,502 colliders, 0 floating, 0 gaps. Nothing seen floating. |
| Readability | PASS | Near-black at most 0.5% of a Wash view at midnight; the Lantern Tree under 2%. Hightoll's windows, the shelter's lamps and the Arches read at night. |
| Ambient audio | FIXED | The Wash, a district of the Saltreach coast, played the town's theme and its quiet town bed (gain 0.035) on the beach: its own `the_wash` theme and surf bed were looked up by region only. Now 14 of the 14 Wash views on the beach hear the Wash; the town keeps its own (E-62). |
| Reasons to go | PASS | Wren and the camp, 5 mudlurkers on the strand, the wreck log, the blanket register, a chest; the Gull's Reach wreck (log, chest) a short swim west; Seamspire Abbey's bell-rope carving; the Oar Barrow (carving, chest); Hightoll and its castellan in view. |
| Routes | PARTIAL | The walk up the bay's east shore through the sea gate to the Lantern Tree, and to the abbey, plan complete. The Oar Barrow and the Wash Prospect stand on the Seamspire Rise's top, which no walk reaches: with free climbing a fresh character made the 13 m face from 1 side in 4; with ledges (ADR-007, now main) see E-70. Proposal P2. |

Also fixed here: the HUD and the area banner said "The Open Sea" on dry land between named places (52% of all land cells); land now takes its region's name (E-63).

### Thornwood: Rook's Landing, the Red Trail, Brigand Hold, Owlroost, the Redwake Watchfire

| Criterion | Score | What the captures and checks showed |
| --- | --- | --- |
| Silhouette | PARTIAL | The Meridian heights' cliffs stand as a wall behind the Hold, and the pier's view of the village is good. Brigand Hold itself is not seen from the pier, the village or the trail: the pines hide it until its gate. Proposal P3. |
| Terrain seams | PASS | None seen in 13 views. |
| Colliders, floaters | PASS | Town structures clean (collider-check). Nothing seen floating. Fixed: the Rift's crust stood as a dark bar on the sea horizon from Thornwood's north shore (E-64). |
| Readability | PARTIAL | At night the Hold's gate lanterns, the trail's lamp and Owlroost's arches against the sky all read. In daylight the shaded walls of houses, tree-crown undersides and cliff overhangs go near-black: 28% of the Landing view at noon is one house wall in shade, the Watchfire's overhang 21% at noon and 45% at midnight. Proposal P6. |
| Ambient audio | PASS | Thornwood's theme and forest bed day and night; Kaelen's warlord theme near his yard. |
| Reasons to go | PASS | Kaelen and 8 brigand camps, 6 chests, 8 records, the inn's beds at Rook's Landing, Owlroost Hollow, the Widowneedles, the Tollkeeper (field boss), the sea-cave dungeon. |
| Routes | FAIL (one place) | A fresh character walks the Red Trail from the pier into the Hold in 11.3 s and on to Kaelen's yard; the Tollkeeper's Arch from 8 of 8 sides; Owlroost, the Widowneedles and the sea-cave plan complete. The **Redwake Watchfire** (camp, chest, record, tower) stands on an upland that no walk reaches or leaves, and every climb from the low ground topped out at 24.4–24.7 m under a 26 m brow. Proposal P1. |

### The Rift: the arrival shelf, the Ascent's lifts, the Landing That Never Came

| Criterion | Score | What the captures and checks showed |
| --- | --- | --- |
| Silhouette | PASS | From the arrival shelf the Ascent fills the view, framed by the Kneeling statues and the light shaft from the wound. |
| Terrain seams | PASS | None seen in 15 views; the map's two black slits are the floor's chasms. |
| Colliders, floaters | PARTIAL | First check of the Rift's colliders (`collider-check --rift`): 3,290 colliders, 24 floating groups, 1 gap, none on the escape walk's floor. Triage: the front parapets of 7 gatehouses stop 0.2 m short of their vaults (too narrow for a body); 5 chimney heads sit 0.5 m over their roof caps; the Bell Ward belfry's cap and the Chainward nave's middle merlons have nothing under them in collider terms; the upended towers' galleries and the Folded Court hang by design; two of the Ascent's outer ledges stand free; the one gap is between two record presses in the Ascent's archive (a false positive). None fixed: nothing blocks a route; listed for the world-life session. |
| Readability | PASS | The Rift has no day: mean luma 0.13 at both hours, dim violet throughout. Near-black under 9% except the base gate's passage (8%, readable navy with its stair lamps) and aerial views over the void. |
| Ambient audio | PASS | The Rift's theme and bed everywhere; the whispers come with low sanity. |
| Reasons to go | PASS | 14 chests, 38 records, research pickups and glyphs, the Hollow Man; the Lanternless at the Landing. |
| Routes | PASS | The arrival shelf to the base lift, and by the scholars' path and the east road through the long wall's postern to the Landing, plan complete. The escape itself was proven by tools/rift-escape-check.mjs in E-32 (not re-run here). The Landing reads weakly from that road: proposal P5. |

### Hightoll's crags and meadow (the user's ask, built)

Asked through the performance session: "a little mountain behind the castle that the Hundred Arches leads to", and that area looking like the user's Elden Ring reference (a castle crowning a jagged rock mass, taller crags behind and beside it, fissured faces, meadows with amber trees, a ruined chapel and tower). Built in world/hightoll.js from data/hightoll.js: six crags of standing columns (the old high country's stone parts on upright joints) falling away from peaks of 92–124 m, with talus at their feet; columns standing proud of the rock's own faces toward the Wash and the town; on the meadow below, 34 trees (three in four amber), outcrops, five ruined outbuildings, the post's roofless chapel and its broken watchtower. From the Wash the castle covers whatever stands straight behind it, so the horn, the needle and the north ridge rise to its left there and the shoulder to its right behind the Arches' end. One static kit, merged: 18,004 triangles, 374 column and talus colliders. Everything keeps off the Reed Road, the descent line's corridor, Hobb's fire, the Oar Barrow and every camp, chest and record near the rock (tests/hightoll.test.js), and the lines still run clear (E-68). Not frame-benched (see E-68).

### Proposals for the user (not built)

| # | What is weak | What I would change | Why |
| --- | --- | --- | --- |
| P1 | The Redwake Watchfire's upland cannot be reached on foot: its camp, chest, record and tower are cut off (Thornwood, FAIL above). | A carrier line from Brigand Hold's gatehouse up to the Watchfire (recommended). Or a Redwake rope stair on the brow facing the Hold, or the camp moved down to the Hold's side. | The user's way of extending access. The Watch Rota Notice is about fires signalling the Hold; a line between them suits sailors who rig. |
| P2 | The Oar Barrow and the Wash Prospect, the first raised viewpoint over the Wash, are on a rise top no walk reaches; free climbing made it from one side in four, ledges may not at all. | A short carrier line from the Wash camp's terrace up to the Prospect (recommended), or a stack of ledges up the abbey face (the world-life session's tools). | A first line ride beside the spawn teaches the lines before Hightoll, and opens the raised view the user's vista taste asks for. |
| P3 | Brigand Hold, Act I's destination, is unseen from Rook's Landing and the Red Trail. | A sightline wedge (data/vistas.js SIGHTLINES) from the pier over the trail to the Hold's gate, and a raised lookout on the gatehouse so its red banner shows over the pines. | Landmarks seen big and close from early spots; the first sight of the Hold should come from the pier. |
| P4 | The Hold's yard is a wide empty lawn round a notice post. | Redwake life: a beached longboat hull as the crew's hall, hammocks, a mess fire, rigging between the palisade's posts. Dressing only, no new enemies. | "Sailor habits survive inside a brigand camp" (WORLD_BIBLE). |
| P5 | The Landing That Never Came reads as a bare dark plain; the Ferryman's boat and its one red lamp barely show, even from the court. | A halo on the lamp (an emissive sprite, no new point light), framed from the long wall's postern so the lip has a beacon. | The epilogue's place should be found by looking, not by the map. |
| P6 | On the surface every face the sun misses goes near-black at noon (the hemisphere's ground colour is a dark `#4a4436`): shaded house walls, tree-crown undersides, overhangs. | A faint bounce light from below like the Rift's (world/rift.js), checked with tools/pixel-diff.mjs and frame-bench. | Readability without thinning fog or trees. A global look change, so the user's call. |

### For the world-life session (ledges and height tiers)

- The Seamspire Rise (the Oar Barrow, the Wash Prospect) and the Watchfire's upland are walking islands: P1 and P2 wait on the user.
- The Rift collider triage above.
- The enemies' planner cannot plan Rook's Landing to Brigand Hold's gate (it stalls at 1282.6, 11.7, 132.2 on the Red Trail's climb) though a player walks it; passed to the A-02 owner.

## World life session (2026-10-16)

**The Rift's collider triage, fixed** (E-303): the front parapets of the gatehouses stand on the band over their faces (a collider for it); the five chimney heads start on their roof caps; the Bell Ward belfry's cap stands on four corner posts; the Chainward nave's middle merlons start on their walls; the Ascent's ledges set against the spine reach back to it; the archive's two presses stand flush. `collider-check --rift`: 3 floating groups (the Folded Court and the two upended castles' galleries, by design), 0 gaps. The surface: 0 and 0, after carrying Brigand Hold's longboat roof on its trestles.

**The Ascent has one lift** (ADR-WL1): on the keep's north wall, 0.6 m off its face, from the courtyard to the summit.

**What each latch count reaches** (`tools/ledge-reach.mjs`, E-310; before the sea stack off the Westwold, whose line was then checked on its own, E-309):

| Landmass | Targets | On foot | By a line or lift | By ledges | Reached at 3 / 4 / 5 latches | Out of reach |
| --- | --- | --- | --- | --- | --- | --- |
| Saltreach & Shimmerfen | 157 | 136 | 14 | 7 | 157 / 157 / 157 | — |
| Thornwood, Meridian & the Ashen Spire | 113 | 99 | 6 | 8 | 112 / 112 / 112 | a gloomowl camp 96.7 m up the Meridian Heights (they fly down) |
| Frosthollow & the Hush | 61 | 41 | 0 | 20 | 61 / 61 / 61 | — |
| The Verdance | 32 | 24 | 0 | 8 | 32 / 32 / 32 | — |
| The Anchor's Fall | 4 | 3 | 0 | 1 | 4 / 4 / 4 | — |
| Gallows Rock | 3 | 0 | 0 | 3 | 3 / 3 / 3 | — |
| Saint Ebb's Light | 2 | 2 | 0 | 0 | 2 / 2 / 2 | — |
| Wreck of the Gull's Reach | 2 | 2 | 0 | 0 | 2 / 2 / 2 | — |
| The Rift | 120 | 111 | 5 | 4 | 116 / 116 / 116 | the Sealed Vault, its two carvings and chest (opened by tracing the glyphs) |

A high or crown tier's chest counts as reached at three latches because its hidden way up (a scaffold, a road or a line) walks there; the climbing lines themselves stop a three-latch climber where their chain says so (tests/ledges.test.js, E-309).

## Next

1. The user's decisions on P1 to P6; build the ones accepted, each checked with the tools above.
2. Any new region, landmark or encounter: agree it with the user first (vista and continent taste above), then check it against ENVIRONMENT_ART_DIRECTION.md's acceptance list.
3. Boss arenas: each great foe is checked in its real arena by tools/boss-check.mjs (A-03); fix arena problems it finds there.
