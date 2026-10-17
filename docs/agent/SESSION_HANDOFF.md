# Session handoff

**Date:** 2026-10-15

**Branch/commit:** `agent/rift-rework` in the worktree `~/Downloads/unstable-rift`: one commit of Rift changes plus this record, on top of `agent/m1-closeout` (PR #14). Its PR goes against `agent/m1-closeout` and is retargeted to `main` once #14 merges.

**Current milestone:** 1, core stability: closed out in #14. The close-out's own handoff is this file at 5a39984, and its evidence is E-20 to E-31. This branch holds the Rift changes the user asked for during the close-out.

**Goal attempted:** the user's Rift decisions (2026-10-15):
- Remove the Abyssal Depths, and move what was good there into the Rift.
- Make sure a weaker player can get out of the Rift: the Ascent was too hard.
- Remove the two sealed gates on the Rift's sides.
- Allow no campfires in the Rift.

For the Ascent the user chose: lifts open from the start, the way to them cleared, and arrival at full health. They did not choose scaling Rift foes down to the player's Power.

**Completed:**
- **The Depths are gone:** the island and its landform, sky term, mood, motes, atlas, gates and `game/depths.js`.
- **The Lanternless** (the epilogue boss, Bell of the Lost Lanterns) now keeps "The Landing That Never Came" on the Rift's north-east lip (about 5900, 6152; +x is west in the Rift), reachable at any time. His four lore carvings, two chests and the Ferryman's beached boat are there too. The epilogue quest is "The Last Crossing", and the story, dialogue, chronicle and guide text follow.
- **The two sealed pale gates and the Rift campfire are removed.** The lore still says the pale gates closed, which is why the Ascent exists.
- **The way out:**
  - The Ascent's three lifts run from arrival, with no lever, gear puzzle or guardian first.
  - Three camps were moved off the walk from the arrival shelf to the base lift: the shelf's Hollows, and the spire's third- and fifth-landing guards. Those guards had been spawning on the keep floor across the route; they now camp east of the city.
  - A surface death now wakes in the Rift at full health.
- **Spire guards back on their landings:** since main's spawn-height fix, the landing guards had dropped to the keep floor. `spawnSpot` now takes a spawner's floor height (`y`), and a posted guard holds its post instead of wandering off the edge.
- **Old saves:** a save left where the Depths were steps back onto the arrival shelf (riftFooting).
- **New tool:** tools/rift-escape-check.mjs, in which a fresh Power 1 character walks out with real input.

**Files changed:** 57 files. In src/data: world, rift, riftSpire, riftResearch, lore, story, storyDialogue, npcs, chronicle, architecture, landforms, enemies. In src/game: game, story, quests, riftfall, riftFooting, riftSpire, ascentLifts, markers, systems; `game/depths.js` deleted. In src/world: riftscape, riftLandmarks, rift, riftSky, riftCeiling, riftFloor, ascentLifts, spawnSpot, sky, terrain, world, props, style, weather, biomeGround, etris, cliffs, architecture. Also src/ui/{worldmap, interact, guide}.js, src/core/audio.js and src/entities/{enemy, actor}.js. Tests: ascent-lifts, rift-footing, spawning, navigation, city-terrain. Tools: rift-review.mjs, rift-escape-check.mjs (new). Docs: README.md, docs/WORLD_BIBLE.md, and in docs/agent: WORLD_DESIGN_PLAN, ENVIRONMENT_ART_DIRECTION and the records below.

**Tests run and results:** `npm test` 273/273 on top of #14 (268, plus the lift, landing-guard and Depths-save tests). `node tools/validate-content.mjs` 0 errors, 0 warnings. `npm run build` OK.

**Browser validation:** see E-32 to E-34.

**Visual/environment validation:** tools/rift-review.mjs's landing views were saved and inspected: the Landing with its name banner, the beached boat on the lip, the court, the ramp, the east gate's old site (open ground) and the throne's back. No Depths or gate geometry is left in view.

**Performance evidence:** E-34, and E-31 for the early-frame runs shared with the close-out.

**LAN validation, if applicable:** not run on this branch. The lifts run the same on host and guest (no unlock state any more).

**Known defects:** none found on this branch. Still open from the close-out: Q-01's early frame (one 67–83 ms frame just after the world shows in 4 of 12 runs on a loaded machine, E-31), the heap rise and the soak hitches (Q-02).

**Unfinished work:** none.

**Next exact implementation task:** the user asked for #14, then this PR, to be merged when done. After that: Q-01's last early frame (IMPLEMENTATION_ROADMAP, Next 1), then the heap drift with a one-region soak on an idle machine (Q-02).

**Relevant feature IDs:** W-01, D-01, A-03, Q-01, Q-02.

**Uncommitted changes:** none.

**Important decisions:** the user's, above; recorded as memory "rift-escape-design". Content ids such as the lore piece `depths_first` were kept: no saves need preserving, and renaming them would only churn the data.

**Do not redo:** do not re-add the Depths, the sealed gates or a Rift campfire. Keep the walk from the arrival shelf to the base lift clear when placing Rift camps. Ask the user before adding difficulty to the escape. Do not add Vent, Tempo, mana charging or any new resource bar.

## Performance session

**Date:** 2026-10-16. **Branch:** `agent/perf` in `~/Downloads/unstable-perf`, from origin/main a4d5a52; its PR goes to `main`. The environment session (Milestone 2, `agent/environment`) ran alongside, and browser benchmarks were taken while it paused its runs.

**Completed:**
- **Q-01, the last early frame: done.** The warm-up waits for the GPU on a fence placed after each frame, and keeps its batches within the frame's budget, counting a cost for each object as well as bytes (ADR-006). The cause was broader than E-31's program checks: the warm-up crowded the first 0.35 s after the world appeared, and any synchronous call or large upload waited for a GPU still busy with the first frames (E-35). In 12 interleaved start runs at load 2–27, no frame went over 50 ms, against 4 of 12 on a4d5a52; 0 programs were compiled in play, and the pixels were identical (E-36, E-37).
- **Climbing by ledges (the user's call, C-14):** Deepwoken's latch jump replaces free climbing and its grip meter, and climbing gear is removed (ADR-007, E-39).
- **The soak tool tells a leak from a cache:** `tools/long-session.mjs` gained `SOAK_REGION=home`, `SOAK_CLEAR_NAV=1` and `SOAK_HEAP_PROFILE=1`.
- **Q-02, long sessions: closed by the user** on 2026-10-16 ("already basically good", relayed by the coordinating session), after the first soaks. A navigation tile holds 11.8 KB, so the tile cache explains about 8.5 MB of E-29's 10 MB rise. With the cache emptied, nothing grew in 30 min (E-40). The soaks were stopped at 30 min of a planned 120.

**Tests run and results:** `npm test` 286/286 (273, plus 5 warm-up tests and 8 latch tests). `node tools/validate-content.mjs` 0 errors, 0 warnings. `npm run build` OK. The figures after merging the latest main are in the PR.

**Browser validation:** E-36 (24 start runs), E-37 (pixel diff), E-39 (ledge latching on real walls, with screenshots looked at), E-40 (two soaks). 0 console errors from the game.

**Known defects, found and not fixed here:**
- The enemies' planner can't finish Rook's Landing to Brigand Hold's gate: it stalls at (1282.6, 11.7, 132.2) on the Red Trail's climb, which a player walks in 11 s. Reported by the environment session; not looked into.

**Unfinished work:** none. Not run, because the user closed Q-02: an hour-long soak with the cache emptied, and the hitch re-soak on an idle machine.

**Next exact implementation task:** none left from this session. If memory ever matters, the cache's ceiling (4,000 tiles, about 47 MB, then emptied all at once) could be lowered with a smaller cap or by dropping the oldest tiles.

**Waiting on the user:** a way up to the Oar Barrow and the Wash Prospect, which free climbing reached by a 13 m face that ledges can't, and to the Redwake Watchfire upland, unreachable either way. The environment session proposed carrier lines or paths and is building nothing until the user decides. The user also asked for a mountain behind Hightoll in the style of an Elden Ring reference image; this session passed that request to the environment session, which is building it.

**Important decisions:** the user's: climbing is by ledges, gear gives no climbing bonus, and latches come from Agility and the talents, race and resonance listed in ADR-007 (memory "ledge-latch-climbing").

**Do not redo:** don't bring back free climbing, a grip meter, or climbing bonuses on gear. Keep background GPU work behind a fence, not a synchronous query. Don't reopen Q-02 unless the user asks.

**Uncommitted changes:** none.

## Environment session

**Date:** 2026-10-16. **Branch:** `agent/environment` in `~/Downloads/unstable-env`, from origin/main a4d5a52, merged with 55c024b (#16) before the PR. Screenshots: the orphan branch `agent/environment-evidence`.

**Milestone:** 2, the environment vertical slice: audit, fix clear defects, propose composition changes.

**Completed:**
- The scorecard for the Wash to Saltreach, Thornwood (Act I's destination) and the Rift, from captures at noon and midnight, the map, and real-input checks (WORLD_DESIGN_PLAN.md).
- Fixed: the Wash's own theme and surf bed, which only the wreck islet ever played; "The Open Sea" on 52% of the land, now each region's name; the Rift's crust standing as a dark bar on Thornwood's sea horizon; map labels piling on each other.
- Built at the user's ask (passed on by the performance session): Hightoll's crags, jointed faces and the meadow below, with the ruined chapel, the watchtower and amber trees.
- New tools: environment-review, route-check, reach-check, and collider-check `--rift`.

**Tests run and results:** `npm test` 290/290 after the merge, including tests/environment.test.js (3) and the Hightoll clearance test. validate-content 0 errors, 0 warnings. Build OK. collider-check: town clean; `--rift` 24 floating groups and 1 gap, triaged.

**Browser validation:** E-61 to E-70. 0 console errors in every capture run.

**Known defects, not fixed (proposals, the user's call):**
- P1: the Redwake Watchfire's upland is unreachable on foot.
- P2: the Oar Barrow and the Wash Prospect, unreachable from below under ledges (E-70).
- P3 to P6: Brigand Hold unseen from Rook's Landing; the Hold's empty yard; the Landing That Never Came's weak beacon; surface faces the sun misses going near-black at noon.

**Unfinished work:** the reach checks under ledges for the Watchfire, the Hold and the Tollkeeper (stopped to close the session); a frame-bench of the crags against main; a line ride in game. The Rift escape check was not re-run.

**Next exact task:** the user's answers on P1 to P6 and on the crags' look, then build the accepted proposals and check them with the tools.

**For the world-life session:** the two walking islands (P1, P2) need a way up that ledges allow; the Rift collider triage list (WORLD_DESIGN_PLAN.md). For A-02: the enemies' planner stalls on the Red Trail at (1282.6, 11.7, 132.2).

**Do not redo:** don't move or thin the crags so they hide the castle from the town or the harbour, or crowd Hobb's fire, the Oar Barrow or the descent line (tests/hightoll.test.js). Keep the Rift's crust clipped from the surface rather than hidden (a hidden mesh misses the warm-up).

## Release session

**Date:** 2026-10-16. **Branch:** `agent/release` in `~/Downloads/unstable-release`, from origin/main 2abded8; its PR goes to `main`. Ran alongside `agent/systems` (Agent 3) and `agent/world-life` (Agent 5). Dev server :5241, preview :5242.

**Completed (tasks 1–10 of the release brief):**
- **Save slots** (S-02): three slots with their own backups; Continue, Load, New with an in-panel confirmation; danger-quit penalties and wipes per slot; a reload resumes its slot; LAN brings a character from a slot. The old save is slot 1 (ADR-RL1).
- **Legacy** (D-02): the Register of the Lost on the main menu, Remembrance by progress, one heirloom per wipe left in the keepsake chest by the Wash camp, claimed once by a newer character; Remembrance buys another reroll, Wren's Bundle or a kept Ember at creation (ADR-RL1).
- **Content runs**: tools/quest-run.mjs plays every quest, chapter, ending and faction path. Fixed Hale's hub (the Watch path was hidden behind Red Bandanas), nine "take a ferry" instructions, the Rift's "rest at the arrival fire", the help screen's Rift gates.
- **Side systems**: tools/systems-check.mjs uses every one. Fixed the Vowkeeper's `window.confirm`.
- **Economy**: tools/economy-report.mjs; no clear outlier, nothing changed.
- **Onboarding**: first-time tips, a rewritten Journal Guide, one controls table (CONTROLS) for the help screen, prompts and README, held to BIND by tests (ADR-RL2). tools/first-run.mjs at two sizes. Creation now fits 1280×720.
- **UI and accessibility**: Interface Size, Reduce flashing and shake, Sound cues, Tips, Medium quality; tools/ui-check.mjs at three sizes; the slot list, boss bar, tip card, hotbar and Guide fixes; disabled purchases say why (ADR-RL3).
- **Robustness**: tools/release-tour.mjs on the built bundle; saves repaired field by field (ADR-RL4).
- **LAN**: tools/lan-check.mjs runs on the built bundle and covers slots, legacy and the death loop with a guest.
- **Release**: three.js split into its own chunk (boot unchanged, E-211), README for players, CHANGELOG.md, the world bible, RELEASE_CHECKLIST.md (this branch's pass).

**Added after the first push, at the user's requests (2026-10-16):**
- **Loot you choose** (ADR-RL5): chests open into a panel; pouches dropped from the inventory that anyone can search and that vanish when empty; a death leaves half the carried silver and some goods in a pouch where you fell; the Keepers' strongbox at every inn keeps things safe from death. LAN: host-owned pouches over `G.netHandlers`.
- **A death in the Rift ends the character** (relayed by the systems session): lives are spent only by quitting in danger. Death screens show their title only. The knocked overlay and its struggle/give-in text are gone (the systems session's change).

**The successor session (2026-10-16, after cf93fdb):**
- **The loot system run in the browser for the first time** (E-212 to E-214), and fixed: the map never marked a lost pouch (markers.js replaced loot's wrapper; now wrapped at boot); "Take everything" yielded between takes (now at once for local containers); a death in the Rift, which ends the character, dropped part of what it carried and so took the heirloom choices with it (only a surface death drops now).
- **Banners show their main line only** (the user's rule; ADR-RL6): `ui.banner` ignores its second argument; facts move to toasts. The systems session did the same in its own files (bells.js is byte-identical on both branches).
- **The Rift's one lift** in every text (README, Guide, the rift tip, help, the Hollow Man, the chronicle's route, the bible's rules, the changelog), from the world-life session's checked sentence.
- **Standing rewards' content** for the world-life session's logic: three officer stores at Trusted (the dialogue option is ours), an outfit and a trinket at Honored, a unique trinket at Exalted (ids in the roadmap's RL-12; the grants and titles are agent/world-life's game/factions.js, guarded until these rows exist).
- **ui-check** opens the loot, leave-a-pouch and strongbox panels and fails any panel that must scroll to show its own foot; the map, shops, vows, cooking and the strongbox were fixed at 1280×720 (E-215).
- The Guide gained the systems session's 'Fighting a group' and 'Talents'; a weapon's own trait is now its "property". systems-check starts every group out of danger.
- **Results at e5debff:** `npm test` 322/322; validate-content 0 errors, 0 warnings (23 outfits, 40 trinkets); build OK (three 524.50 kB, game 1,722.28 kB). In the browser (E-212 to E-224, 0 console errors in every run): systems-check 115/117 (the two grid route flags), quest-run 63/63, legacy-check 23/23, first-run at two sizes, ui-check 73/73 at each of three sizes, release-tour 13/13 and lan-check 11/11 on the built bundle (lan-check 11/11 on the dev server too), the standing content in game.
- **Deepwoken's way (agent/release-deepwoken, stacked on agent/release, after the user's "make the inventory and stats and stuff like deepwoken… do whatever is nice"):** an attunement chosen at creation (+10, awakened, its first mantra), the backpack (` key; ui/backpack.js), the campfire opening growth through agent/systems' rest API (ADR-RL7; after the user's correction: points are invested only sitting at a fire, cards anywhere, an inn only sets where you wake); the user left the open decisions to us, so: version 1.0.0, Cinzel and EB Garamond bundled (OFL), the other taste values kept. Results at 9c2e30b: `npm test` 330/330; E-225 to E-229 all pass (systems-check's two grid flags are settled in E-226). Merging PR #18 was refused by a permission check (merge without review), so the user merges.
- **Merging:** with agent/world-life one docs conflict (ADRs appended at the end: keep both); with agent/systems two: interact.js's shop weapon row (keep its feel line and our `pr bad` class and "Not enough" title) and lan-check.mjs (its checks 6–9, then our death loop and shared pouch). Both owners were told.

**Tests run and results (first push):** `npm test` 312/312 (290, plus save-slots 8, legacy 8, controls 4, the Hale hub and corrupted-save tests). validate-content 0 errors, 0 warnings. Build OK: three 524 kB, game 1,697 kB (the large-chunk warning is expected).

**Browser validation:** E-201 to E-211. 0 console errors in every run.

**LAN validation:** lan-check 11/11 on the dev server and on the built bundle (E-210). Not tried on two physical machines.

**Performance:** boot only (E-211). No frame-bench on this branch: its frame-loop additions are the tip watcher (a check every 0.25 s that stops once every tip is seen) and a sound-cue wrapper on `audio.play`; frame-bench against 2abded8 is part of the final integration.

**Coordination done:** for Agent 5: the bounceLight setting and toggle, `ACTIONS.mapOverlay`/`mapHolder` map hooks, tip ids contracts/hunters/patrols/checkpoints (`ACTIONS.tip`) and their Guide text, the `lines` tip on world.lineStations. Agent 5 scales lightning and starfall flashes by `reduceFlashing`. For Agent 3: its move rows in CONTROLS and README, the Guide's move, handling, blind and summon text; Agent 3 edited order.js's respec (totalPoints) and added weapon-feel lines to charmenu.js and the shop row on its own branch; it will scale vfx shake and flashes by `reduceFlashing`.

**Known defects / open:** grid-route flags for Agent 5's reach tool: Lira at the Lost Camp, the Drowned Bell and its riftling spawner (Agent 5 checking), the Smugglers' Sea-Cave from the Watchfire side (P1, Agent 5 building lines), and the Bell Under Ice entrance from Rimejaw's Den (E-212; not flagged in E-203, no world change on this branch). After agent/world-life merges, its faction rivalries move a rival's standing by a share of every change, so quest-run's exact standing checks after the writ (Enclave +15, Watch +10/−10) will need the shares; the Honored and Exalted gifts are granted on that branch and are checked in task 11. Offline, the two Google fonts fall back to system serif.

**Waiting on the user:** the version number (proposed 1.0.0); whether to bundle Cinzel and EB Garamond (OFL) so offline play keeps its typefaces; the Remembrance prices and boons; no hammer under 45 stat points; the Rift's sanity pace.

**The final integration (task 11) is done (2026-10-17):** all six PRs of the round are on main (#18, #20, #19, #21, #22, #23). On main fbd13a7 with agent/final-integration (fixes to the release checks only, and a few texts): npm test 565/565, validate 0/0, build OK; release-tour 14/14, lan-check 17/17 (one earlier run 16/17, intermittent), first-run 24/24, legacy 23/23, quest-run 63/63, systems-check all but the two grid route flags the ledge-reach tool settled, ui-check 219/219, rift-escape 2/2, chase-check, boss-check (12/12 on c22b223, E-235; 11/12 then the Lanternless 2/2 alone on fbd13a7, E-238), frame-bench against 2abded8 (no frame over 50 ms at start; places 7–33% lower uncapped but all above 60 fps, p99 under 16.7 ms). RELEASE_CHECKLIST.md is rewritten from these runs (E-232 to E-238).

**Next exact task:** none required. Open: LAN on two physical machines; the Rift spawn's p99 (about 27 ms, older than this round); lan-check's enemy-flourish check and the Lanternless's approach in boss-check are each intermittent (one miss in a few runs; their owner, the systems session, has finished).

**Do not redo:** don't bring back a keybinding screen or the X binding; write viewport units in the UI as `var(--sh)`/`var(--sw)`; name keys in new prompts with `{action}` from BIND; don't store legacy in a slot's save.

**Uncommitted changes:** none after the session's last commit.

## Systems session

**Date:** 2026-10-16. **Branch:** `agent/systems` in `~/Downloads/unstable-systems`, from origin/main 2abded8 (Agent 3; the release session and the world-life session ran alongside). A second Agent 3 session took over at 7a92808 and finished tasks 9 to 11. Screenshots: the orphan branch `agent/systems-evidence`.

**Built** (ADR-008 to ADR-014; roadmap SY-01 to SY-09):
- **The approved moves:** flourish, uppercut and air chase, roll-cancel, a 140° guard (Stonewall 180°), blind on enemies, boss summon retry. Numbers in `COMBAT` (combat/rules.js); enemies flourish too.
- **Power gated by investment:** XP earns points one at a time; the fifteenth earned point invested raises Power. As in Deepwoken (the user's calls): points are invested only sitting at a campfire; the talent and mantra cards a rise brings are chosen anywhere; an inn's keeper sets where you wake for 10 silver and nothing else (no sleep, night or heal). A first version also counted an inn's bed as rest and held the cards to rest; the user corrected both. `ACTIONS.readyToRise()` and `ACTIONS.openRest(ui)` are for agent 4's campfire panel. Each attribute names the next talent, mantra or weapon it opens.
- **Campfires you make** (the user's ask, as in Deepwoken): three Sticks from fallen branches or one Firewood from a general store lay a fire that burns five minutes; sit by it to invest, cook there; none in the Rift; seen on LAN (ADR-015).
- **Weapons:** six handling axes per weapon, shared with enemies; one property for each of the 28 rare, epic and legendary weapons; every weapon within 20% of its rarity's mean (a test).
- **Talents:** 45 reworked into behaviours (79 of the 100 outside the Vows), exclusions on the cards; each Vow and Resonance a build of its own.
- **Enemies:** group tactics (turns, flanks, falling back, calling for help) and six archetypes; the Red Trail planner stall fixed.
- **Movement:** fast moves in sub-steps, falls from the top of the arc, speed kept in the air; E leaves a boat.
- **Presentation:** telegraphs that read without colour, guard sounds and reactions by class, weighted hit-stop, planted feet, the contact pose. Banners show their title alone; instructions (and a Bell's mantra) come as toasts.
- **LAN:** every new move, property, talent flag and archetype works for a guest; the guest's flags are one list (`GUEST_MODS`) with a test that reads the code for missing ones.
- **This session's fixes:** a lapsed turn rests before it is claimed again (two foes that never swung held both turns for good); a guest's Intimidate reaches the host; the two common heavies trimmed; the CO-OP toasts; tool races in lan-check and walk-check.

**Tests run and results:** `npm test` 453/453 (443 at 7a92808, plus the turn-lapse, LAN-flag, balance-band, Brute, banner, rest, next-unlock and boat-landing tests). One test was flaky from before this session: the flank test failed about 1 run in 40 by its rolls (twice in eight full-suite runs, once in 30 runs of 7a92808), and now rolls from three fixed seeds; 3 full runs since, at load 25–28, all pass. `node tools/validate-content.mjs` 0 errors, 0 warnings. The figures after merging the latest main are in the PR.

**Browser validation (all on agent/systems, 0 console errors in every run):** moves-check 6/6, group-check 6/6, weapons-check, traversal-check 10/10, chase-check 2/2, walk-check 6/6, lan-check 12/12 in six runs, boss-check 12/12, the rest flow and the banners read from the page (E-100 to E-108).

**Performance evidence:** E-109 (town CPU by file: the branch's systems cost nothing measurable a frame), E-110 (interleaved A/B with the other sessions paused: medians equal within 2 fps at every place; 0 frames over 50 ms in four start runs), E-111 (the first A/B, whose 3–6% town gap did not hold).

**Known defects:** page reloads after a lost WebGL context ended two long tool runs at load 60–78 (the game saves and reloads itself, game.js); not seen at ordinary load.

**Not verified:** two physical machines on LAN; a player (not a bot) through the first hours; agent 4's campfire panel calling `ACTIONS.openRest` and its backpack's Use on Sticks and Firewood on a merged build (agent/release-deepwoken); the inn beds without their "Rent a room" prompts on a merged build (dropped on agent/world-life; the keepers offer the room); `Boat.landingSpot` in game (agent 5's, on agent/world-life); the Redwake Lookout and Root Gallery suggestions (E-114), which are agent 5's to apply.

**For the user:** the Cinder Colossus fights mostly at range; the main chain plus its great foes falls short of three chapters' Power gates (Fracture 7 by about 900 XP, Iron Tide 12 by about 3,200, Bastion 13 by about 3,700), so Chapters II and III expect side play; the Hollowed Crownblade sits at the top of the band (+19.8%); Deepwoken's per-attribute training items are not built (a new mechanic).

**Merging:** all three open PRs together were trial-merged and checked (E-115: 555/555, the Rift escape 3/3, lan-check 17/17). agent/release (PR #18) and agent/release-deepwoken (PR #20, on #18) conflict with this branch in seven files, resolved in a local trial (E-112: 493/493, lan-check 17/17 twice): ui/charmenu.js (keep #20's inventory deletion; of the weapon imports keep only `WEAPONS`), ui/interact.js's shop weapon row (the feel line with #18's two changes), tools/lan-check.mjs (checks 6–11, then #18's check 5 and the pouch check, then "host disconnect"), and four docs (keep both sides; the roadmap's waiting list keeps only the systems taste line). game.js: the Rift death line is byte-identical on both; `useInteractKey` and the shortened `rest()` (spawn only) are this branch's.

**Do not redo:** don't bring back the knocked overlay, the struggle or the give-in, a death subtext, investing anywhere but at a campfire, holding the talent and mantra cards to rest, or sleep and healing at an inn (an inn only sets where you wake). Keep weapon trims to damage (not speed) when an enemy wields the weapon. A flag the host reads from a guest goes in `GUEST_MODS`.

**Uncommitted changes:** none.

## World life session

**Date:** 2026-10-16. **Branch:** `agent/world-life` in `~/Downloads/unstable-worldlife`, from origin/main 2abded8; its PR goes to `main`. Agents 3 (`agent/systems`, PR #19) and 4 (`agent/release`, PRs #18 and #20) worked alongside; the three together finish the game. This session took over a predecessor's branch: the ledge reach tool, P1 to P6, the first ledge lines and an unrun WIP of the world's life.

**The user's calls this session:** one lift in the Rift, quoted in ADR-WL1; banners with only their main text (Agent 4 drops the subtext for every banner); a Rift death ends the character (Agent 4); inns set your spawn through their keeper (Agent 3; this branch keeps each inn's wake point as a rest point [E] can't use).

**Completed** (IMPLEMENTATION_ROADMAP.md "World life", WORLD_LIFE_PLAN.md "Built", ADR-WL1 to WL6):
- **The Ascent's one lift**, from the courtyard to the summit on the keep's north wall, its cage holding its rider (grilles and a drop bar off the courtyard stop); the roof parapet and the Thin Stair closed; the rope code and every text of ropes, fires and lost lives gone.
- **Ledges and tiers:** 19 lines on every continent and three islets, among them the Hatch Steps to the Bell Under Ice (a 2-latch pitch before) and the Lookout Steps up a new sea stack off the Westwold, where a Redwake lookout keeps a crew and a chest; the four hidden scaffolds fixed so they walk to their tops.
- **Factions that move**, run by the host for every player: columns, checkpoints, road and sea convoys, a false sloop, a beset fishing boat, a drift of wreckage, soundings, the Watch's and the Enclave's fights with the Redwake, hunters (also for a wanted guest), cutters, captives freed and brought to the Watch.
- **Standing:** contract boards beside the three officers, rivalries on one toast, Honored and Exalted rewards (rows on #18).
- **The sea:** courses leave and enter port by a point past the pier's end; the rudder needs way on; hulls meet piers, moles and coasts and run along them; hulls keep apart; wind astern; a landing spot when stepping off (#19 calls it); squalls at sea and a storm swell.
- **Sound:** the place's own layers and calls, indoors muffled, the world's event calls, fight music for every great foe, and themes of their own for Meridian and the Hush (they had Thornwood's and Frosthollow's).
- **The chart's overlay** (who holds the coast, lines, climbs, landmarks) for #18's map hooks.
- **The Rift's collider triage**, and Brigand Hold's longboat roof carried on its trestles.

**Tests run and results:** `npm test` 345/345; validate-content 0 errors, 0 warnings; build OK. collider-check: surface 0 floating, 0 gaps; `--rift` 3 floating groups (by design), 0 gaps.

**Browser validation:** E-301 (rift-escape-check 3/3 out in 42–43 s, twice), E-302 (the lift's views), E-306 (world-life-check, host and guest, every event and the boards, clean consoles), E-309 (every line and scaffold climbed or walked), E-312 (P6 pixel-diff), E-313 and E-314 (frame-bench against main), E-315 (voyage-check 19/19 sea roads; audio-scene, every place and the world calls).

**Performance:** E-313 and E-314. Places without events within noise of main; a convoy or a column in view costs 10–12% fps and keeps p99 under 11.4 ms; the Rift spawn's ~27 ms p99 is main's too. Start: 4 of 4 runs with no frame over 50 ms (main 3 of 4); 0 programs linked after the world showed.

**Not run or not done:** task 5's scoring of the other regions (the review views for them are in tools/environment-review.mjs, unrun); a two-machine LAN run; chase-check and boss-check on this branch. No one has listened to the new sounds.

**Known limits:** the Root Gallery's spawners carry `level: 16`, which does nothing until #19's spawner levels merge (1012f7f); Agent 3 suggests the Redwake Lookout's crew become a redwake_harpooner and two redwake_skirmishers at level 7 once #19 is in. World events start near the host; a guest far from the host gets none of their own. The chart overlay and the standing rewards wait on #18. The Gull's Reach has no line, and the Anchor's statue is not climbed above its plinth.

**For the user:** P6 (Settings → graphics on #18) to judge; the four "ask the user" patterns (a siege of a capital, a great foe at sea, hull damage and repairs, naval guns); merge order #18, #19, #20, then this.

**Next exact task:** after the merges, Agent 4's final integration on merged main (Agent 3 re-runs rift-escape-check once the one lift is on main): rift-escape-check, chase-check, collider-check, frame-bench and lan-check on the merged build.

**Do not redo:** don't add Rift campfires, more lifts or difficulty to the escape; keep the walk to the lift clear. Don't build in play: life props and boats are pooled at boot, sea courses charted at boot. Serve a pinned worktree to frame-bench, never the one being edited (E-313).

**After the merge (agent/world-life-fixes, E-316):** the banners on the lookout, the summit cairns and the climbing camps had no rod colour in their kit, so every boot logged "Unknown color metal" ×5; each now takes its pole's colour, and tests/ledges.test.js fails on any unknown colour. The Redwake Lookout's crew is now a redwake_harpooner and two redwake_skirmishers at spawner level 7 (Agent 3's suggestion, now that #19 is on main); in game they stayed on the top and fought. Note for tools: the actors have no `invulnerable` flag, so tools that set it (audio-scene, voyage-check) protect the player only by despawning foes.

**Uncommitted changes:** none at the close.

## Beasts session

**Date:** 2026-10-16. **Branch:** `agent/beasts` in `~/Downloads/unstable-beasts`, from origin/main c22b223 (moved there from 7b53239 mid-session when #21 and #22 merged; one conflict in data/world.js, both appends kept). Dev server :5288 with its own cacheDir (`vite.beasts.config.js`, untracked).

**The user's asks:** a big mob like Deepwoken's Megalodaunt that spawns around; the owl redesigned like the Deep Owl; both big and scary but not giant ("about three times a person's height"); owls no longer in packs at that size, but stronger and alone.

**Completed:**
- **The sharko** (original name and lore; Pathfinder only as a reference): a pale, hunched, digitigrade walker with long clawed arms, a shark-like snout, a back fin and a finned tail, 5.5 m (model `sharko`, entities/creatures.js). Level 9, 560 HP, hyperarmor; rake, double rake, bite (bleed), kick (orange, knockback), charge (red, a low leap with its own reach `hitRange`), roar (posture). Drops `sharko_tooth` and meat. A bestiary note.
- **Roaming** (`spec.roam`, Enemy.roamIdle): instead of pacing ±7 m, a roamer walks legs of 20–34 s to dry points within `roam` m of its camp through `navTo`; a camp's pack shares each destination (kept on the spawner), each beast a few metres off it. A leg it cannot reach ends early.
- **Six packs of two** (data/roaming.js), in final world positions appended after placement like the high tiers: the meadows short of Shimmerfen (L8), Thornwood's far uplands (L8), Meridian's lowland (L11), the woods under the Ashen Spire (L11), Frosthollow's snow (L10), the Verdance's northern floor (L13). Chosen by probing the terrain for dry, gentle ground 40 m round, clear of buildings, 90 m from named places and 18 m off roads; tests/world-content checks all of that.
- **The great owl rebuilt** (model `owl`): near-black, hunched, long scaled legs, a pale heart-shaped face with lamp eyes under a frowning brow, horn tufts, a ragged mantle, wings that hang like a cloak and open face-forward in a fan with glints along the coverts, a tail fan. Gloomowl 4.6 m, thunderwing 5 m (a storm-navy and gold palette), Old Hookbeak 6 m.
- **Owls alone and stronger:** every owl camp holds one (world, regions, saltreach, ledgeSites); gloomowl level 7, 480 HP, 220 posture, longer reach, dive and screech with hyperarmor, 2–3 feathers a kill; thunderwing 720 HP; Old Hookbeak 1500 HP. The Enclave's `e_clear_owls` contract asks for one.
- **Draw calls:** both models merge their static parts per joint and material (`mergeParts`): owl 36 meshes (was 71 before merging; the old owl was about 15, two to a camp), sharko 33.
- **New tool:** tools/beast-check.mjs (QA_AND_BENCHMARKS.md).

**Tests run and results:** `npm test` 565/565 (tests/beasts.test.js new, 8 tests; tests/world-content.test.js +1); validate-content 0 errors, 0 warnings; build OK. The roaming test fails with `roam` off (the pair stays within 8 m and drifts 15 m apart).

**Browser validation:** E-317 (beast-check: 6/6 packs roam together on dry ground; both fights land blows; 0 console errors), E-318 (lan-check 17/17 twice, chase-check both scenarios), E-319 (beast-check again after the rename).

**Not run or not done:** frame-bench; a LAN guest watching a pack (proxies build the same models; untested); listening to the sharko's alert (it uses the existing `roar`). No new sounds were made.

**The user's calls at the close:** the beast is named the Sharko (it was the Gorgemaw until then; no save carries the old id); the level-8 pack in the meadows short of Shimmerfen stays ("anywhere can be anything"); commit and merge into main.

**Still to judge by feel:** the Sharko's numbers (560 HP, hyperarmor, pairs) and the owl's (480 HP, alone).

**Uncommitted changes:** none at the close; merged into main as PR #23.
