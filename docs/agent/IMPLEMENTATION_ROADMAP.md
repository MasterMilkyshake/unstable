# Implementation roadmap

**Current milestone:** 1, core stability: closed out. Its first five tasks merged with main's performance work (43034a4); the close-out (#14) confirmed the merge in game and added the mantra, frame-pacing, long-session and great-foe checks; the Rift rework the user asked for during it follows (below). Milestone 0, the audit and baseline, is done: see UNSTABLE_CODE_AUDIT.md.

Rule: fixes and tightening of existing systems go ahead; **new mechanics need the user's yes first** (see CLAUDE.md).

## Done

| Task | Where | Evidence |
| --- | --- | --- |
| Audit, baseline, durable docs | docs/agent/, CLAUDE.md | E-01, E-02, E-04 |
| Pure defense decision; parry rules shared by player and AI; 0.9 s missed-parry cooldown | combat/rules.js, combat.js, actor.js, enemy.js | E-03, E-05 |
| AI perception delay; feints can bait enemy parries | enemy.js `react` | combat-rules tests |
| Dodge/crit input buffer | player.js | E-03 |
| Mana charging removed; mantras cost ether only | mantras.js, player.js, UI, quests, migrate.js | E-03, E-05 |
| Mantra cast in hitstun no longer wastes ether | player.js `tryCast` | — |
| AI navigation (A-02): walk grid, line check, metered A*, stuck watch | entities/nav.js, enemy.js `navTo` | E-07 to E-10 |
| LAN host/join check (L-01), no defects found | tools/lan-check.mjs | E-11 |
| Rift arrival hitch: warm-up at boot, fixed point-light count, staggered spawns, cached compass width | merged as main's game/warmup.js and `World.lendLight`, plus game.js staggered spawns and ui.js | E-12, E-13, E-14, E-19 |
| Chain Citadel strongroom doors (W-02) | palaces.js | E-15 |
| Tests for statuses and running/aerial attacks (C-13, C-03) | tests/statuses, moving-attacks | E-16 |
| Integration with main's performance work (102c8f6): main's `Warmup` and `lendLight`, the branch's navigation, strongroom, tests, tools and staggered spawns | merge 43034a4 (#12, #13) | E-20 to E-22 |
| Spawn heights (W-04): enemies spawn on the surface nearest the terrain, dungeon spawners on their floors, wall archers `perch` | world/spawnSpot.js | spawning, city-terrain |
| Fixed point-light count everywhere (Q-01), the night watchman's lamp included | main's `World.lendLight` | E-19 |
| Merge confirmed in game: chase-check 3/3, lan-check 6/6 ×3, frame-bench against 102c8f6 | tools | E-20 to E-22 |
| Per-behaviour mantra tests (M-01): 43 tests, 11 defects fixed | tests/mantras.test.js, mantraRuntime.js, combat.js, projectile.js | E-23 |
| Frame hitches (Q-01): 0 shader programs compiled in play; the frame over 50 ms just after the world shows went from every run to 4 in 12 (E-31); pixel-identical | game/warmup.js, vfx.js, weather.js, ui.js, hooks.js | E-24 to E-26, E-31 |
| Great foes (A-03): all 12 checked in their arenas; the Grand Warden's chain lash fixed; the Enclave's garrison and the Vice Warden's Peacekeepers on his side | tools/boss-check.mjs, enemy.js `chooseAttack`, combat.js `hostile`, story.js | E-27, E-30 |
| Two-hour sessions on the merged and the fixed build | tools/long-session.mjs, docs/agent/data/ | E-28, E-29 |
| The Rift rework (the user's calls): the Abyssal Depths, the sealed pale gates and the Rift campfire removed; the Lanternless at the Landing That Never Came; the Ascent's lifts open from arrival, the walk to them cleared, full health on arrival; the spire guards back on their landings | data/rift.js, world.js, riftSpire.js, game/ascentLifts.js, world/riftscape.js, spawnSpot.js | E-32 to E-34 |
| The last early frame (Q-01): the warm-up waits for the GPU on a fence and keeps its batches within budget; no frame over 50 ms after the world shows in 12 runs (before: 4 in 12); pixel-identical | game/warmup.js, game.js, tests/warmup.test.js, ADR-006 | E-35 to E-38 |
| Long sessions (Q-02): closed by the user on 2026-10-16 ("already basically good"). The heap rise is mostly the navigation tile cache (11.8 KB a tile, about 8.5 MB of E-29's 10 MB), and nothing else grew in 30 min with the cache emptied | tools/long-session.mjs (region, nav-clear and allocation-sampling switches) | E-28, E-29, E-40 |
| Climbing by ledges (C-14, the user's call): catch an edge in the air, hang, leap; wall hops; a count that landing restores; climbing gear removed | player.js, stats.js, talents, trinkets, items, races, resonance, tests/latch.test.js, ADR-007 | E-39 |
| Milestone 2, the environment slice (W-07): the Wash to Saltreach, Thornwood and the Rift scored from captures at noon and midnight, the map and real-input checks (WORLD_DESIGN_PLAN.md); fixed the Wash's sound, "The Open Sea" on land, the Rift's crust on Thornwood's horizon and crowded map labels; six proposals for the user | game.js, data/world.js, exploration.js, riftCeiling.js, ui/interact.js, tools/environment-review, route-check, reach-check, collider-check --rift | E-60 to E-67, E-69, E-70 |
| Hightoll's crags and meadow (W-05, the user's ask): the old high country's crags behind and beside the castle, jointed faces, amber trees, outcrops, the ruined chapel and watchtower | data/hightoll.js, world/hightoll.js, tests/hightoll.test.js | E-68 |
| SY-01 The approved moves: flourish, uppercut and air chase, roll-cancel, a 140° guard, blind on enemies, boss summon retry (C-07, C-09, C-13) | combat/rules.js, player.js, actor.js, enemy.js, ADR-008 | E-100, E-105 |
| SY-02 Power gated by investment (P-02); points invested only sitting at a campfire, cards chosen anywhere, an inn's keeper only setting where you wake, as in Deepwoken (the user's calls); each attribute's next unlock | stats.js, player.js `invest`, `resting`, `pickTalent`, game.js `rest`, ui/charmenu.js, ADR-009 | E-101, E-113 |
| SY-03 Weapon handling (reach, speed, posture, chip, pierce, weight) and 28 weapon properties; the outlier band | data/weapons.js, combat/weaponTraits.js, tools/weapon-balance.mjs, ADR-010 | E-102, E-103 |
| SY-04 Talents (P-03): 45 reworked into behaviours (79 of 100 now), exclusions; Vows and Resonances each a build (P-04) | data/talents.js, vows.js, game/talentpowers.js, vowpowers.js, resonance.js, ADR-011 | talents, vows tests |
| SY-05 Group tactics and six archetypes; the Red Trail planner stall (A-02) | entities/tactics.js, enemy.js, nav.js, actor.js, ADR-012 | E-104, E-107 |
| SY-06 Movement physics: sub-stepped fast moves, falls from the top of the arc, speed kept in the air; E leaves a boat | actor.js, player.js, game.js `useInteractKey`, ADR-013 | E-107 |
| SY-07 Combat presentation: telegraphs that read without colour, guard sounds and reactions by class, weighted hit-stop, planted feet, contact pose | combat/vfx.js, core/audio.js, entities/rig.js, anims.js, ADR-014 | presentation tests, tools/presentation-sheet.mjs |
| SY-08 Everything new on LAN: hit keys, guest flags (`GUEST_MODS`), hold and roll-cancel events, enemy flourish and call; the CO-OP toasts | net/net.js, remotePlayer.js, tests/lan-systems.test.js | E-105 |
| SY-10 Campfires you make (the user's ask): three Sticks (from fallen branches) or one Firewood (general stores) lay a fire that burns five minutes, to sit, cook and invest by; none in the Rift; seen on LAN | game/camp.js, data/items.js, world/forage.js, data/npcs.js shops, ADR-015 | E-113 |
| SY-09 Balance: the Riftglass Dirk, the Meridian Lance, the two common heavies; Stonewall at Fortitude 30; Hearty Appetite at a walk; the great foes, pacing and town cost checked | data/weapons.js, enemies.js, talents.js | E-103, E-106, E-108, E-109 |

| RL-01 Save slots and legacy (D-02, S-02, the user's yes): three slots with backups; the Register of the Lost, Remembrance, one heirloom at the Wash | core/save.js, core/legacy.js, game/legacy.js, ui/screens.js, ADR-RL1 | E-201, E-210 |
| RL-02 Every quest, chapter, ending and faction path run in game; Hale's Watch path freed; travel text corrected | tools/quest-run.mjs, data/storyDialogue.js, data/chronicle.js | E-202 |
| RL-03 Every side system used in game; the Vowkeeper's confirmation in its panel | tools/systems-check.mjs, ui/interact.js | E-203, E-204 |
| RL-04 Economy review (no clear outlier) | tools/economy-report.mjs | E-205 |
| RL-05 Onboarding: tips, the Guide, one controls table (help, prompts, README = BIND) | game/tips.js, ui/guide.js, core/input.js, ADR-RL2 | E-206 |
| RL-06 Interface and accessibility; every panel at three sizes | ui/*, game/captions.js, ADR-RL3 | E-207, E-209 |
| RL-07 Robustness on the built bundle; saves repaired field by field | tools/release-tour.mjs, core/migrate.js, ADR-RL4 | E-208 |
| RL-08 LAN with slots, legacy and the death loop; the built bundle | tools/lan-check.mjs | E-210 |
| RL-09 Release: three.js chunk, boot time, README, CHANGELOG, world bible, checklist | vite.config.js, docs | E-211 |
| RL-10 Loot you choose (the user's ask): chests open into a panel, pouches left from the inventory that anyone can search, a surface death leaves part of what you carry where you fell (marked on the map), the Keepers' strongbox at every inn; LAN pouches owned by the host | game/loot.js, game/bank.js, core/contents.js, data/loot.js, ADR-RL5 | E-212 to E-214 |
| RL-11 A death in the Rift ends the character (the user's rule); banners show their main line only, facts move to toasts; the Rift's one lift in every text | game/game.js, ui/ui.js, README, Guide, tips, help, the Hollow Man | E-212, E-214 |
| RL-12 Standing rewards' content for the world-life session's logic: the officers' stores at Trusted, an outfit and a trinket at Honored, a unique trinket at Exalted | data/npcs.js SHOPS, data/items.js, data/trinkets.js, data/storyDialogue.js | tests/quests.test.js |
| RL-13 Every panel keeps its foot in view at 1280×720 (the map, shops, vows, cooking, the strongbox) | ui/style.css, tools/ui-check.mjs | E-215 |
| RL-14 Deepwoken's way, at the user's request: an attunement chosen at creation (+10, awakened, first mantra), the backpack (` key; tiles, filters, search, drag to the hotbar), investing at a campfire through agent/systems' rest API (cards anywhere; an inn only sets where you wake); fonts bundled; version 1.0.0 | data/origins.js, game/creation.js, ui/backpack.js, ui/interact.js, src/ui/fonts/, ADR-RL7 | creation (4), backpack (4); E-225 onward |

### World life (agent/world-life, 2026-10-16)

| Task | Where | Evidence |
| --- | --- | --- |
| WL-01 The Ascent around one lift, the cage holding its rider (the user's call) | world/ascentLifts.js, riftSpire.js; game/ascentLifts.js, riftSpire.js; data/riftSpire.js | E-300 to E-302 |
| WL-02 Ledge lines on every continent and two islets; four scaffolds that walk; the Hatch Steps to the Bell Under Ice; the Kneeling Steps; the Redwake's sea stack | data/ledges.js, ledgeSites.js; world/ledges.js, ziplines.js | E-309, E-310 |
| WL-03 Factions that move, run for every player on LAN; sea traffic; captives; the Enclave against the Redwake | game/worldLife.js, seaLife.js, rescue.js; data/factionLife.js | E-304 to E-307 |
| WL-04 Contract boards; rivalries; tier rewards | game/contracts.js, factions.js; world/contractBoards.js; data/contracts.js, factions.js | contracts, standing tests |
| WL-05 The chart's overlay and holder | game/chart.js | world-life chart test |
| WL-06 Sailing, the sea's weather | entities/boat.js; world/weather.js, water.js; game/travel.js | E-311, E-315 |
| WL-07 The place's sounds, world calls, great foes' themes | core/audio.js; game/soundscape.js | soundscape tests, E-315 |
| WL-08 The Rift's collider triage; Brigand Hold's longboat on its trestles | world/riftWalls.js, riftCity.js, architecture.js, riftSpire.js, seats.js | E-303 |
| WL-09 Inns' rest points for keepers (agent/systems' Game.rest) | world/vernacular.js, architecture.js | architecture test |

## Next, in order

0. **RL: the final integration** after agents 3 and 5 merge: every check on merged origin/main and its built bundle, RELEASE_CHECKLIST.md rewritten from it (agent/release, task 11).
1. **Balance, for the user**: the Cinder Colossus holds its ground at range; nothing else from the boss check.
2. **The environment proposals the user accepts** (WORLD_DESIGN_PLAN.md P1 to P6), each checked with tools/environment-review, reach-check and collider-check.

## Waiting on the user

- Environment (WORLD_DESIGN_PLAN.md): P1 a way up to the Redwake Watchfire (unreachable on foot), P2 a way up to the Oar Barrow and the Wash Prospect, P3 framing Brigand Hold from Rook's Landing, P4 dressing the Hold's yard, P5 a beacon at the Landing That Never Came, P6 a surface bounce light for faces the sun misses. And a look at Hightoll's crags, built at the user's ask.
- Height tiers (E-114): the Root Gallery holds the same L13–14 foes as the ground below (a spawner `level` can raise it); the Redwake Lookout holds L3–4 brigands (the Redwake archetypes would suit it after the merge).
- Systems (taste, agent/systems): the main chain plus its great foes falls short of three chapters' Power gates (Fracture 7 by about 900 XP, Iron Tide 12 by about 3,200, Bastion 13 by about 3,700), so Chapters II and III expect side play: keep, or lower those gates? The Hollowed Crownblade sits at the top of the band (+19.8% of the legendary mean): leave it as the Hollow Duke's prize? Deepwoken's per-attribute training items are not built (a new mechanic).
