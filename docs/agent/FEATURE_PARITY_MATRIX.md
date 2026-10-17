# Feature and quality matrix

Statuses: COMPLETE, PARTIAL, DEFECTIVE, MISSING, BLOCKED, UNKNOWN, OUT_OF_SCOPE, REJECTED (the user decided against it). COMPLETE means it works in the running game and has a test. Evidence IDs refer to EVIDENCE_LEDGER.md.

| ID | Feature | Status | Source | Tests / evidence | Next |
| --- | --- | --- | --- | --- | --- |
| C-01 | M1 strings, per-class combos, buffered chaining | COMPLETE | player.js `startCombo` | combat-feel, E-03 | — |
| C-02 | Critical attacks, guard-break crit window | COMPLETE | player.js `startCrit` | E-03 | — |
| C-03 | Running and aerial attacks | COMPLETE | player.js `startCombo` | moving-attacks, E-16 | — |
| C-04 | Feints (RMB, F during wind-up), enemy feints | COMPLETE | actor.js `feint`, enemy.js | combat-rules | — |
| C-05 | Parry: window, 0.9 s miss cooldown, reset on success | COMPLETE | rules.js, actor.js `startParry` | combat-rules, E-03 | tune in play |
| C-06 | Block, posture, guard break | COMPLETE | combat.js | combat-rules | — |
| C-07 | Directional block: block and parry cover 140° in front (Stonewall 180°), the rim costs 1.3× posture, a raised guard turns at a capped rate | COMPLETE | rules.js `guardCovers`, `guardPostureMul` (SY-01, ADR-008) | moves, moves-check, E-100 | — |
| C-08 | Dodge i-frames, cancels, input buffer | COMPLETE | player.js `dodge` | E-03 | — |
| C-09 | Flourish, uppercut, air chase, roll-cancel (the user approved them on 2026-10-16) | COMPLETE | rules.js `COMBAT.flourish`, `launch`, `rollCancel`; player.js; enemies flourish too (SY-01, ADR-008) | moves, moves-check, lan-check 6, 7, 10, 11, E-100, E-105 | — |
| C-10 | Vent, Tempo | REJECTED | — | ADR-003 | do not add |
| C-11 | Mana charging | REJECTED (removed) | — | combat-rules | — |
| C-12 | Hyperarmor, unparryable/unblockable telegraphs | COMPLETE | actor.js, enemy.js | combat-rules | — |
| C-13 | Statuses: burn, chill/freeze, shock, bleed, blind | COMPLETE | actor.js `applyStatus`; a blinded enemy sees 3 m, can't parry, block, feint or flourish, swings where it last saw you (`COMBAT.blind`) | statuses, moves, moves-check, lan-check 8, E-16, E-100 | — |
| C-14 | Climbing by ledges (Deepwoken's latch jump): catch, hang, leap, wall hops; no climbing gear | COMPLETE | player.js `probeLedge`, `tryLatch`, `updateHang`, `wallHop`; stats.js `latches` | latch, E-39, ADR-007 | the user to decide a way up to the Oar Barrow, the Wash Prospect and the Redwake upland |
| M-01 | Mantras (38 behaviours, 78 mantras), ether cost, stars and sparks | COMPLETE | mantraRuntime.js | mantras (43 tests, every behaviour cast through `Player.tryCast`), E-03, E-23 | 11 defects fixed (5b7397c) |
| P-01 | Power 1–20, 15 points per Power | COMPLETE | stats.js, player.js `addXp` | progression tests | — |
| P-02 | Power gated by investment (Pathfinder), invested sitting at a campfire as in Deepwoken; cards chosen anywhere | COMPLETE | player.js `earnPoints`, `invest`, `resting`, ui/charmenu.js (SY-02, ADR-009) | progression (12), E-101, E-108, E-113 | agent 4's campfire panel (`ACTIONS.openRest`); the inn beds' prompts (agent 5) |
| P-03 | Talents with behavioral effects | COMPLETE | talents.js: 79 of the 100 outside the Vows change behaviour; 21 are plain stat picks; exclusions on the cards (SY-04, ADR-011) | talents (one per reworked talent and exclusion), validate-content (every flag read) | — |
| P-04 | Vows, Resonances, Bells, traits | COMPLETE | game/vowpowers.js, resonance.js: each of the 14 a build of its own (SY-04) | vows (what defines each), story tests; a Bell's banner and toast in game (E-101) | — |
| A-01 | Humanoid AI defense on shared rules | COMPLETE | enemy.js `react` | combat-rules, E-03 | — |
| A-02 | AI navigation / pathfinding | COMPLETE | nav.js, enemy.js `navTo`; the Red Trail stall fixed (pier decks, a 0.4 m terrain rise, a running search kept, unreachable marks expire) | navigation, city-terrain, nav-fixes, chase-check, walk-check, E-07 to E-10, E-107 | flyers and swimmers still steer straight |
| A-03 | Bosses with phases (12 great foes, the castellan included) | COMPLETE | enemies.js and story.js specials, summons; an interrupted summon cast tries again 3 s later (`COMBAT.summonRetry`) | tools/boss-check.mjs (all 12 pass on agent/systems), moves, guards, hightoll, E-27, E-30, E-106 | the Cinder Colossus mostly fights at range (a taste question for the user) |
| D-01 | Knock, grip, Rift on surface death, lives, wipe | COMPLETE | game.js, player.js, ascentLifts.js | death, ascent-lifts tests; tools/rift-escape-check.mjs, E-32 | a surface death wakes in the Rift at full health; the Ascent's lifts run from arrival |
| D-02 | Legacy across wipes: the Register of the Lost, Remembrance, one heirloom | COMPLETE | core/legacy.js, data/legacy.js, game/legacy.js, ui/screens.js | legacy (8), legacy-check, lan-check, E-201, E-210, ADR-RL1 | — |
| S-01 | Save migration, backup | COMPLETE | save.js, migrate.js | save-migration | — |
| S-02 | Three character slots, each with its own backup | COMPLETE | core/save.js, game.js new/continue/wipe, ui/screens.js | save-slots (8), legacy-check, lan-check, E-201, E-210, ADR-RL1 | — |
| L-01 | LAN host/join, shared enemies | COMPLETE | net.js, lanRelay.js | tools/lan-check.mjs, E-11, E-21 (merged build) | two physical machines not tried |
| U-01 | Keybinding UI | REJECTED | — | — | the user: no keybinding screen (2026-10-16) |
| W-01 | Continents, towns, the Rift | PARTIAL | world/* | domain tests, E-02, E-32, E-60 to E-70 | Milestone 2 scorecard (WORLD_DESIGN_PLAN.md): the Wash to Saltreach and the Rift pass but for one route each way up; Thornwood fails one route (the Redwake Watchfire) and is partial on silhouette and daylight shade; proposals P1 to P6 wait on the user |
| W-02 | Chain Citadel strongroom doors | COMPLETE | palaces.js | palaces routes, collider-check, E-15 | — |
| W-03 | World streaming | MISSING | — | E-04 | only if the world must grow |
| W-04 | Spawn heights | COMPLETE | world/spawnSpot.js, `perch` on wall archers | spawning, city-terrain | — |
| W-05 | Hightoll, the castellan's castle, its carrier lines, and the crags and meadow round it | COMPLETE (lines unridden in play) | data/hightoll.js, world/hightoll.js, world/ziplines.js, game/ziplines.js | hightoll (11, the crags' clearances included), E-68 | ride a line in game; the user to look at the crags |
| W-06 | Five attunements (Steelsing and Bloodhex retired; 'blood' kept as the bleed element) | COMPLETE | data/stats.js, mantras.js, talents.js | validate-content | — |
| W-07 | Environment acceptance: captures, routes, reach and colliders per area | PARTIAL | tools/environment-review.mjs, route-check.mjs, reach-check.mjs, collider-check.mjs --rift | E-60 to E-70 | three areas scored; the other regions not yet |
| Q-01 | Frame pacing on arrival and load | COMPLETE | game/warmup.js (waits for the GPU on a fence; batches within budget), `World.lendLight`, staggered spawns, weather built at boot, kept effect programs, a veiled HUD | warmup, frame-bench start, pixel-diff, E-12 to E-14, E-19, E-24 to E-26, E-31, E-35 to E-38 | — (0 shader programs compiled in play; no frame over 50 ms after the world shows in 12 runs at load 2–27, against 4 of 12 before) |
| Q-02 | Long-session stability (2 h) | COMPLETE (closed by the user) | — | tools/long-session.mjs (region, nav-clear and allocation-sampling switches), E-28, E-29, E-40 | — (closed on 2026-10-16: "already basically good"; 0 errors in every run; the heap rise looks like the nav tile cache, 11.8 KB a tile and about 8.5 MB of E-29's 10 MB, and nothing else grew in 30 min with the cache emptied (E-40)) |
| SY-03 | Weapon handling (six axes) and one property per rare, epic or legendary weapon; every weapon within 20% of its rarity's mean | COMPLETE | data/weapons.js, combat/weaponTraits.js, tools/weapon-balance.mjs (ADR-010) | weapons (39), validate-content, weapons-check, lan-check 8, E-102, E-103 | — |
| SY-05 | Group tactics (turns, flanks, falling back, calling for help) and six archetypes | COMPLETE | entities/tactics.js, enemy.js (ADR-012) | archetypes (10), group-check, lan-check 9, E-104, E-105 | placement on the height tiers (agent 5) |
| SY-06 | Movement physics: sub-stepped fast moves, falls from the top of the arc, air carry; E leaves a boat | COMPLETE | actor.js, player.js, game.js `useInteractKey` (ADR-013) | traversal, nav-fixes, traversal-check (10 legs), E-107 | — |
| SY-07 | Combat presentation: telegraphs without colour, class sounds and reactions, weighted hit-stop, planted feet, contact pose | COMPLETE | combat/vfx.js, core/audio.js, entities/rig.js (ADR-014) | presentation, presentation-sheet | — |
| SY-08 | The systems round on LAN: every new move, property, talent flag and archetype for a guest | COMPLETE | net/net.js (`GUEST_MODS`, hit keys, hold, rollX, enemy hold and call) | lan-systems, lan-check (12 checks), E-105 | two physical machines not tried |
| SY-10 | Campfires you make: Sticks from fallen branches or Firewood from stores; five minutes; sit, cook, invest; none in the Rift; on LAN | COMPLETE | game/camp.js (ADR-015) | camp (6), E-113 | the backpack's Use for 'tool' items (agent 4) |
| WL-01 | The Ascent's one lift, its cage holding its rider (the user's call) | COMPLETE | world/ascentLifts.js, game/ascentLifts.js, world/riftSpire.js | ascent-lifts, city-terrain, rift-escape-check, E-300 to E-302 | — |
| WL-02 | Ledge lines and height tiers: 19 lines, 4 hidden scaffolds, a sea stack | COMPLETE | data/ledges.js, ledgeSites.js, world/ledges.js | ledges, ledge-line-check, E-309, E-310 | the Gull's Reach has no line (a 2.5 m scramble) |
| WL-03 | Factions that move: columns, checkpoints, convoys, soundings, skirmishes, hunters, cutters; at sea, sloops, a false one, a beset boat, a drift; captives | COMPLETE | game/worldLife.js, seaLife.js, rescue.js, data/factionLife.js | world-life (22), world-life-check, E-304 to E-307 | events start near the host |
| WL-04 | Contract boards beside the three officers | COMPLETE | game/contracts.js, world/contractBoards.js, data/contracts.js | contracts (7), world-life-check boards | — |
| WL-05 | Standing: rivalries, Trusted stores, Honored and Exalted rewards | COMPLETE (rows on agent/release) | game/factions.js, data/factions.js | standing (4) | the grants wait on #18's rows |
| WL-06 | The chart: who holds the coast, carrier lines, climbs by tier, landmarks | PARTIAL | game/chart.js | world-life chart test | drawn once #18's map hooks merge |
| WL-07 | Sailing: rudder with way on, hulls meet piers and coasts, wind, landing spot, squalls and swell | COMPLETE | entities/boat.js, world/weather.js, water.js, game/travel.js | boats (6), world-life (sea roads clear their piers), voyage-check 19/19 (E-315) | — |
| WL-08 | World audio: place layers, world calls, every great foe's theme | COMPLETE (not listened to) | core/audio.js, game/soundscape.js | soundscape (3, incl. a theme for each great region), audio-scene log (E-315) | a person to listen |
| WL-09 | The Rift's collider triage | COMPLETE | riftWalls.js, riftCity.js, architecture.js, riftSpire.js | collider-check --rift, E-303 | — |
| WL-10 | P6, the surface bounce light, off by default | COMPLETE (toggle on #18) | world/rift.js | pixel-diff, E-312 | the user to judge it |
| X-01 | Public multiplayer, PvP, accounts | OUT_OF_SCOPE | — | — | — |
| RL-01 | Every quest and chapter run in game: start, targets, ◆, routes, rewards; the endings; the faction paths | COMPLETE | tools/quest-run.mjs, tools/quest-harness.js | E-202 | grid route flags for the reach tool |
| RL-02 | Every side system used in game (dungeons, Crucible, crafting, fishing, inns, boats, sources, chests, Atlas, dialogue, death loop) | COMPLETE | tools/systems-check.mjs | E-203, E-204 | — |
| RL-03 | Onboarding: first-time tips, the Journal's Guide, one controls table for help, prompts and README | COMPLETE | game/tips.js, data/tips.js, ui/guide.js, core/input.js CONTROLS | controls (4), first-run, E-206, ADR-RL2 | — |
| RL-04 | Interface and accessibility: interface size, reduced flashing and shake, sound cues, tips, Medium quality; every panel at three sizes | COMPLETE | ui/*, game/captions.js, core/save.js | ui-check, E-207, E-209, ADR-RL3 | combat and weather flashes scaled by their owners |
| RL-05 | Robustness: built-bundle tour, offline, bad stored values repaired | COMPLETE | tools/release-tour.mjs, core/migrate.js repair | save-migration, E-208, ADR-RL4 | fonts fall back offline |
| RL-06 | Economy review | COMPLETE (no outlier found) | tools/economy-report.mjs | E-205 | taste questions for the user |
| RL-07 | Release: build split, boot time, checklist, README, CHANGELOG, docs | PARTIAL | vite.config.js, docs/agent/RELEASE_CHECKLIST.md | E-211 | final integration after the three merges |
| RL-08 | Loot you choose: chest panel, pouches anyone can search, a surface death's lost pouch, the Keepers' strongbox; host-owned pouches in LAN | COMPLETE | game/loot.js, game/bank.js, core/contents.js, data/loot.js, ADR-RL5 | loot (8), death, E-212 to E-214 | the death share and 30 slots are taste questions for the user |
| RL-09 | Standing rewards: Trusted stores, Honored outfit and trinket, Exalted trinket and title | PARTIAL | data/npcs.js, items.js, trinkets.js, storyDialogue.js (content and the stores' gate); game/factions.js on agent/world-life (the grants) | quests (stores gate) | the grants live on agent/world-life |
| RL-10 | Attunement at creation (None / Random / five), Deepwoken's +10 and first mantra | COMPLETE | data/origins.js, game/creation.js, ui/screens.js | creation (4), in game | — |
| RL-11 | A Deepwoken-style backpack: tiles, filters, search, detail pane, drag to the hotbar | COMPLETE | ui/backpack.js, ui/charmenu.js, game/gear.js | backpack (4), in game | — |
| RL-12 | Invest at a campfire: the fire names points that wait and opens a Power that is due | PARTIAL | ui/interact.js here; the rest gate is agent/systems' | backpack (rest hook) | live once agent/systems merges |
