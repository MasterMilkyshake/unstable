# Release checklist

**The final integration (task 11), on merged main**: origin/main fbd13a7 (PRs #18, #20, #19, #21, #22 and #23), with agent/final-integration's fixes to the release checks and a few texts. Every line below was run on that tree, its dev server or its built bundle, on 2026-10-16/17 (E-236 to E-238; the same list on c22b223 before #23 is E-233 to E-235).

Status: PASS, FAIL, NOT RUN, or LIMIT (a known limitation, listed for the user).

## Build and data

| Check | Status | How, and evidence |
| --- | --- | --- |
| `npm test` | PASS | 565/565 (E-236) |
| `node tools/validate-content.mjs` | PASS | 0 errors, 0 warnings: 46 weapons, 12 classes, 78 mantras, 109 talents, 70 enemies, 57 quests, 71 items, 23 outfits, 40 trinkets, 9 vows, 9 islands, 197 spawners (E-236) |
| `npm run build` | PASS | three.js 524.50 kB, game 1,894.47 kB, three font files; the large-chunk warning is expected (E-236) |

## The single-player loop

| Check | Status | How, and evidence |
| --- | --- | --- |
| Menu → slot → creation → the Wash → Wren → first fight → Saltreach → Maren → Ilvar, with the first tips | PASS | tools/first-run.mjs, real input, 1280×720 and 1920×1080: 24/24 (E-236) |
| Every quest starts, every objective's target exists, finishes, pays exactly its rewards (with rivals' shares and a faction's gift when a tier is reached) | PASS | tools/quest-run.mjs `all`: 63/63 (E-236) |
| The main story at each chapter's suggested Power; both writ answers; the faction paths; the three endings, Maren's replies, the victory screen, the state after | PASS | quest-run's story run, within the 63 (E-236) |
| A surface death → the Rift, whole; a death in the Rift ends the character and records it | PASS | systems-check `death` 3/3 (E-236); tests/death.test.js |
| The one-lift way out of the Rift for a fresh Power 1 character | PASS | tools/rift-escape-check.mjs: 2/2 out after 42 s, 0 deaths (E-236) |
| Danger-quit costs a life once, in its own slot; an Ember restores one; the last life ends the character | PASS | tests/death, save-slots |

## Creation, the backpack, growing at a fire

| Check | Status | How, and evidence |
| --- | --- | --- |
| Creation offers None, Random or an attunement; a chosen one starts at 10, awakened, its first mantra on key 2; creation fits 1280×720 | PASS | scratch creation check: Emberweave 10, Ember Bolt on key 2 (E-236); tests/creation.test.js |
| The backpack: the ` key, tiles by kind, filters, search, the pane, drag to the hotbar, wear from it | PASS | scratch backpack check 10/10 (E-236); tests/backpack.test.js |
| Points are invested only sitting at a campfire; cards are chosen anywhere; three Sticks lay a fire you sit at; an innkeeper's room only sets where you wake | PASS | scratch rest check 6/6; systems-check `inns` 2/2 (7 keepers) (E-236) |
| Old Wren's "Sit by the fire" seats you at hers without moving where you wake | PASS | scratch fire check 4/4 (E-236) |

## Save slots and legacy

| Check | Status | How, and evidence |
| --- | --- | --- |
| Three slots, each with its own backup; settings shared; the old save is slot 1 | PASS | tests/save-slots.test.js |
| Continue, Load, New (asks before replacing); a reload resumes the slot; Register of the Lost, Remembrance, an heirloom claimed once at the Wash | PASS | tools/legacy-check.mjs 23/23 (E-236); tests/legacy.test.js |

## Loot, standing and the side systems

| Check | Status | How, and evidence |
| --- | --- | --- |
| Chests into a panel; pouches anyone can search; a surface death's lost pouch on the map; the strongbox | PASS | systems-check `loot` 7/7 (E-236); tests/loot.test.js |
| The officers' stores at Trusted; Honored and Exalted gifts once | PASS | systems-check `shops` 14/14 (the three stores among them); quest-run saw the Watch's Exalted signet and the Ministry's Honored outfit and fork arrive (E-236) |
| Dungeons, the Crucible, fishing, cooking, foraging (8 kinds, 983 nodes), the forge and jeweler, the altar, the Shrine, vows, resonances, bells, boats from all 10 docks | PASS | systems-check, every group (E-236) |
| Every written source, investigation, chest and Atlas entry; no dialogue dead ends | PASS | systems-check (E-236) |
| Walking routes to every target | PASS (one climb) | the grid planner (no climbing, no lines) still flags the Bell Under Ice hatch and the Sea-Cave from the Watchfire; the world-life session's ledge-reach tool settles both: the hatch by "The Hatch Steps", the cave from the shore (E-226, E-236) |
| Enemies chase round corners and through gates | PASS | tools/chase-check.mjs: follow and head start (E-236) |
| Each great foe in its arena: aggro, the fight, leash, specials, summon waves | PASS (one intermittent stall) | tools/boss-check.mjs: 12/12 on c22b223 (E-235); on fbd13a7 11/12 in the full run, the Lanternless stalling once on one move, then 2/2 alone (E-238); the Vice Warden's summons counted apart from the Enclave's passing columns |

## Interface, accessibility, robustness

| Check | Status | How, and evidence |
| --- | --- | --- |
| Every panel at 1280×720, 1920×1080, 2560×1440: no overflow, no clipped text, its foot in view | PASS | tools/ui-check.mjs 219/219 (73 a size: 52 panels and HUD states, 20 settings, the console) (E-236) |
| Every setting applies at once; quality Low, Medium, High; interface size, reduced flashing, sound cues, tips, bounce light | PASS | ui-check (E-236) |
| Help screen, prompts, README's controls = BIND | PASS | tests/controls.test.js |
| Built bundle: every region and menu (the backpack's key too), no error toasts, 0 console errors or warnings | PASS | tools/release-tour.mjs on vite preview: 14/14 (E-236) |
| No request leaves the machine, even at load; boots and plays offline in its own typefaces | PASS | release-tour (E-236) |
| Corrupted, wrong-typed or missing save, settings and legacy recover | PASS | release-tour's four bad-value cases (E-236); tests/save-migration |

## LAN

| Check | Status | How, and evidence |
| --- | --- | --- |
| Host and guest on the built bundle: a shared enemy, hits both ways, parry, the moves (uppercut, air chase, flourish, a weapon's property, a mender, roll-cancel), a guest's death loop ending in the register, a shared pouch, the host leaving | PASS | tools/lan-check.mjs on the bundle: 17/17, 0 console errors on host and guest; one earlier run 16/17, its check 11 (an enemy flourish held on the guest) seeing no flourish in its window, then 17/17 (E-236) |

## Performance

| Check | Status | How, and evidence |
| --- | --- | --- |
| No frame over 50 ms from the world's first showing through game start and a first fight (Q-01), against 2abded8 | PASS | frame-bench start, 3 + 3 interleaved, vsync on: 0 over 50 ms and 0 over 33 ms on both, worst 33.4 ms, no shader linked after the world showed (E-237) |
| 60 fps with p99 under 16.7 ms at the baseline places | PASS (Rift spawn LIMIT) | frame-bench places, 2 + 2 interleaved, vsync off: main's surface places 104–165 fps, p99 8.4–12.2 ms; 7–33% under 2abded8 (more draws: convoys, columns, the round's content); the Rift spawn's p99 is about 27 ms on both builds (E-237) |

## Known limitations

- LAN has not been tried on two physical machines; every LAN check runs two browsers on one machine.
- The tools that drive the game through `/src` modules (quest-run, systems-check, legacy-check, ui-check, boss-check, chase-check, rift-escape-check) need a dev server; on the built bundle the release tour and lan-check run.
- The grid planner neither climbs nor rides lines; the world-life session's ledge-reach tool is the authority on routes.
- Uncapped frame rates at the baseline places are 7–33% lower than before this round (more on screen); every surface place still holds the 60 fps / 16.7 ms p99 target. The Rift spawn's p99 (about 27 ms) predates the round.
