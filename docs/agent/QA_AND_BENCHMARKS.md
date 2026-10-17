# QA and benchmarks

## Benchmark machine

Apple M1 Pro, macOS, system Google Chrome 155 via Playwright (`headless`, `--use-angle=metal --ignore-gpu-blocklist --disable-gpu-vsync --disable-frame-rate-limit`), viewport 1600×900, quality `high`, noon (`sky.time = 0.42`). Headless Chrome on a machine other agents share is noisy, and absolute numbers move with the Chrome version and the load. **Compare builds in interleaved runs** (`tools/frame-bench.mjs` against two dev servers), never against an old table.

## Baseline (2026-10-15, paired)

`agent/foundation` (8b210af) against `agent/stability`, 3 interleaved runs each, load average 6–8. Each cell gives the range over the runs.

| Place | fps before | fps after | p99 ms before | p99 ms after | max ms before | max ms after | draw calls | triangles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The Wash (spawn) | 95–96 | 90–94 | 16–26 | 25–27 | 25–29 | 29–30 | ~883 | 3.6 M |
| Sage's Rise, Saltreach | 84–89 | 84–92 | 13–14 | 13–14 | 14–19 | 14–20 | ~926 | 4.1 M |
| Watch Barracks, Saltreach | 74–78 | 74–75 | 15–17 | 15–17 | 17–32 | 16–32 | ~1390 | 4.1 M |
| The Lantern Tree, Saltreach (1 run) | 75 | 75 | 27.5 | 15.8 | 33.7 | 16.3 | ~1157 | 4.1 M |
| Rift spawn (teleported) | 50–52 | 49–106 | 45–64 | 28–50 | 170–193 | 58–121 | ~735 | 1.7 M |

| Moment | Before | After |
| --- | --- | --- |
| Rift arrival (`enterRift`), worst frame in the window, 4 runs | 98.7–107.3 ms (8 programs compiled, 60.3 MB uploaded) | 16.8–19.8 ms (0, 0) |
| Rift arrival, worst main-thread work in one frame | 96.9–105.5 ms | 8.4–10.3 ms |
| Game start (menu to world), worst frame, 3 runs | 302–324 ms (23 programs recompiled) | 89–93 ms (0) |
| Boot to world | 18.4–19.8 s | 19.1–19.6 s |
| Enemy navigation CPU per simulation step (load average ~20) | — | mean 0.05–0.10 ms, p99 1.0–1.6 ms, max 5.5 ms |

The JS heap is 530–700 MB in play. No console errors at any place.

**Targets:** 60 fps on this tier with p99 under 16.7 ms in normal play; no frame over 50 ms after the world is shown, judged with vsync on. Met at game start and in a first fight since 45ec3ad (`frame-bench start`, below). The first night-watchman encounter no longer recompiles (main's `World.lendLight`).

## Milestone 1 close-out (2026-10-15)

**The merge (43034a4) against pre-merge main (102c8f6)**, `frame-bench all 1`, 3 interleaved runs each (ABBAAB), vsync off, load average 5–240 (a peer's spike in the last two runs). Ranges over the runs:

| Place | fps 102c8f6 | fps 43034a4 | p99 ms 102c8f6 | p99 ms 43034a4 | draw calls 102c8f6 | draw calls 43034a4 |
| --- | --- | --- | --- | --- | --- | --- |
| The Wash (spawn) | 162–180 | 162–181 | 6.9–7.9 | 6.9–7.7 | ~708–712 | ~710–712 |
| Sage's Rise | 120–138 | 123–139 | 8.6–10.0 | 8.4–9.9 | ~783–787 | ~783–785 |
| Watch Barracks | 103–117 | 104–116 | 9.8–11.1 | 10.0–12.2 | ~1154–1218 | ~1252–1275 |
| The Lantern Tree | 104–117 | 106–114 | 9.9–11.7 | 10.3–11.6 | ~989–995 | ~1096–1102 |
| Rift spawn (teleported) | 103–107 | 102–106 | 26.8–27.6 | 27.0–27.3 | ~611–633 | ~611–612 |

| Moment | 102c8f6 | 43034a4 |
| --- | --- | --- |
| Rift arrival, worst frame | 35.5–36.2 ms (5 runs) | 19.7–31.1 ms |
| Rift arrival, programs compiled / MB uploaded | 1 / 0.3 | 1 / 0.0–0.1 |
| Boot to world | 8.4–12.4 s | 8.4–8.8 s |

The merge draws more at the Barracks and the Lantern Tree because the spawn-height fix put the Watch in the streets (in view) instead of on rooftops; fps is within noise.

**World shown, game start and a first fight** (`frame-bench start`, vsync on, a fresh browser per run, 3 interleaved runs each):

| Build | Worst frame after the world was shown | Frames over 50 ms | Programs linked after the world was shown |
| --- | --- | --- | --- |
| 43034a4 | 66.7–83.4 ms (0.15 s in, the warm-up's first batch) | 1, 1, 1 | 46–52 (game start, nearly every first cast) |
| 45ec3ad (fixed) | 33.4, 33.4, 50.0 ms | 0, 0, 0 | 0 |
| 5a39984, later, the machine loaded (E-31) | 33.3, 33.4, 50.0, 66.6, 66.7, 533.3 ms | 0, 0, 0, 1, 1, 1 | 0 |
| The Rift branch, interleaved with it (E-31) | 33.3, 33.4, 33.4, 50.0, 66.7, 83.4 ms | 0, 0, 0, 0, 1, 1 | 0 |

The 67–83 ms frames come 0.07–0.30 s after the world shows: the warm-up's synchronous program checks wait on a busy GPU process (traced). The 533 ms frame came once, at a Gale Rend cast. Q-01 is open for these.

`tools/pixel-diff.mjs` 43034a4 against 45ec3ad: 0 of 1,440,000 pixels differ in each of six views (E-26).

**Great foes** (`tools/boss-check.mjs`, 100 s fights): all twelve pass on 99b7af7 (data/boss-check-99b7af7.json). In every fight:
- the boss aggroes at its range with the boss bar up;
- every special or creature attack fires, and phase specials only below their thresholds;
- every summon wave comes at its threshold;
- it reaches the player after each move (the colossus mostly fights at range) and never leaves its leash;
- nothing but the script strikes it;
- every kill records the boss, the banner, the sure drops and the Bell;
- 0 console errors.

Two defects were found and fixed: the Grand Warden's chain lash never fired before 1ac00be (E-27), and the Vice Warden's own Peacekeepers and Fort Meridian's garrison fought him before 99b7af7 (E-30).

**Long sessions** (`tools/long-session.mjs`, 2 h, vsync on, series in docs/agent/data/):

| Build | Console errors | Frame p50 / p99 | Frames over 50 ms | V8 heap after GC, 5 → 120 min | Kills, sailed |
| --- | --- | --- | --- | --- | --- |
| 43034a4 (E-28) | 0 | 16.7 / 16.8 ms in 24 of 25 samples | 30 (23 in one 47 s Rift burst) | 129 (20 min) → 144 MB, +0.14 MB/min | 83, 24,748 m |
| 1ac00be (E-29) | 0 | 16.7 / 16.8 ms in 24 of 24 | 6 (single frames, the worst 517 ms) | 130 → 140 MB, +0.09 MB/min | 74, 24,749 m |

Every hitch after start in both runs, the Rift burst included, coincided with another headless Chrome run of this session on the same machine. Run a soak on an otherwise idle machine before chasing them. The heap rise is not yet separated from the navigation grid's tile cache (126 → 848 tiles in E-29, capped at 4,000).

## Performance session (2026-10-16)

**Q-01, the last early frame** (`frame-bench start`, vsync on, a fresh browser per run, 12 + 12 runs interleaved ABBAAB, the other agent's browsers paused, E-36):

| Build | Load average | Runs with a frame over 50 ms | Worst frame after the world was shown | Programs linked after the world was shown |
| --- | --- | --- | --- | --- |
| a4d5a52 | 2.4–10.5 | 4 of 12 (67, 67, 117, 67 ms, 0.20–0.25 s in) | 33.3–116.6 ms, two more at 49.9 | 0 |
| fix (3c68c1a) | 2.1–27.4 | 0 of 12 | 33.2–33.4 ms in 11 runs; 50.0 ms once, at a cast, load 27 | 0 |

The cause (E-35): the warm-up did all its work in the first 0.35 s after the world showed (528 program checks, 342 MB of geometry in 3,669 objects) while the GPU was still busy with the first frames. A synchronous call or an upload larger than the transfer buffer then waited for the GPU process; single `bufferData` calls took 22 ms. Batches could also overshoot their budget by a whole town cell, or take some 2,000 small objects at once. The warm-up now waits on a fence and keeps batches within budget (ADR-006), and takes about 0.8 s behind the menu. `tools/pixel-diff.mjs`: 0 of 1,440,000 pixels differ in each of the six views (E-37).

**Q-02, heap drift** (two 30-minute soaks on a4d5a52, stopped early, E-40): a navigation tile holds 11.8 KB (measured by emptying the cache between two forced GCs), so the cache explains about 8.5 MB of E-29's 10 MB rise and tops out near 47 MB at its 4,000-tile cap. Roaming with the cache emptied at each sample, no allocation site grew from 10 to 30 min. The user then closed Q-02, so no hour-long run was made.

## How to run

1. Start a private vite on a spare port: a config that spreads `vite.config.js` with its own `port`, `root` and `cacheDir`, so it doesn't re-optimize deps under another server. Scripts import Playwright by absolute path (`<main tree>/node_modules/playwright/index.mjs`) or, inside the repo, as `playwright`, with `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'` (or `CHROME_PATH`).
2. Repo tools (each needs the dev server's URL):
   - `BENCH_URL=… node tools/frame-bench.mjs [places|arrival|all] [runs]`: the tables above, vsync off. For a before/after, serve both builds and alternate single runs.
   - `BENCH_URL=… node tools/frame-bench.mjs start [runs]`: vsync on, a fresh browser per run. Every frame from the world's first showing (after the game's first rendered frame) through 4 s of menu, game start, 5 s of play and a cast of one mantra of every behaviour; reports the worst frame, frames over 50 ms with what was happening, and shader programs linked after the world appeared. This is Q-01's acceptance. Not part of `all`.
   - `node tools/pixel-diff.mjs <url A> <url B>` (`PIXEL_DIFF_A_SETTINGS` / `PIXEL_DIFF_B_SETTINGS`, JSON, set game settings on one side, to compare an option on one build): a deterministic render comparison of two builds (Math.random seeded per calling function, rAF held, synthetic 60 Hz time, sky pinned): six views read back from the canvas and compared to the pixel. Run it on a performance change that touches rendering. Same URL twice checks the harness. `PIXEL_DIFF_OUT=<dir>` saves build A's views as PNGs.
   - `CHASE_URL=… node tools/chase-check.mjs [--control]`: brigands chase through Saltreach's west gate and round a house. `--control` uses the old straight-line steering.
   - `BEAST_URL=… node tools/beast-check.mjs [--secs=40] [--shots=dir] [--json=out.json] [--parts=packs,fights]`: every sharko pack roams together on dry ground for SECS seconds, then a sharko and a gloomowl fight a kept-alive player. `--shots` adds a lineup and portraits (at rest and in a wind-up) beside a player for scale (E-317).
   - `LAN_URL=… node tools/lan-check.mjs [screenshot-dir]`: host and guest on one relay; twelve checks (6–11: the systems round's moves, a weapon property, a Bonesetter and an enemy flourish across LAN).
   - The systems session's checks (agent/systems, each needs a dev server): `MOVES_URL=… node tools/moves-check.mjs [dir]` (the approved moves with real input), `GROUP_URL=… node tools/group-check.mjs [dir]` (group tactics and archetypes), `WEAPONS_URL=… node tools/weapons-check.mjs [ids]` (handling and properties as swung), `TRAVERSE_URL=… node tools/traversal-check.mjs [legs]` (ten legs with held keys), `WALK_URL=… node tools/walk-check.mjs [routes] [--runs=3]` (an enemy walks the Red Trail), `node tools/presentation-sheet.mjs` (the same combat moments on two builds). Static: `node tools/weapon-balance.mjs` (each weapon against its rarity's mean; tests/weapons.test.js holds the 20% band). For pacing: `SOAK_FRESH=1 SOAK_REGION=home tools/long-session.mjs` plays a new Power 1 character (an upper bound: the bot is carried to camps).
   - `BOSS_URL=… node tools/boss-check.mjs [boss ids] [--secs=100] [--json=out.json]`: each great foe in its real arena (A-03). See "Great foes" above. Any blow on the boss from someone other than the script fails the check (the Vice Warden's own Peacekeepers once fought him, E-30).
   - `RIFT_URL=… node tools/rift-escape-check.mjs [runs=3] [--secs=200]`: a fresh Power 1 character dies on the surface, lands in the Rift, and walks out with real input. It holds keys along the arrival way and through the keep by the pathfinder's own route, presses [E] on the Ascent's one lift (the courtyard to the summit) and on the summit wound, outruns whatever chases it, and is never healed. Fails if a run does not get out. A fresh browser per run.
   - `LAN_URL=… node tools/world-life-check.mjs [screenshot-dir] [--only=kind,…]`: the world's events on a host and a LAN guest (one relay): a column, a checkpoint, a road convoy, a skirmish, hunters, a sounding the guest watches (paid on the guest), a cutter; at sea a supply sloop, a false one, a beset boat and a drift of wreckage; then the three contract boards. Each: the host spawns its people and props, the guest sees the same as proxies, props and boats. Both consoles must be clean.
   - `VOYAGE_URL=… node tools/voyage-check.mjs [dock id …]`: every sea road sailed in the game with real held keys (W, and A or D by the heading to the next mark of the planner's course), the simulation stepped at 30 Hz without drawing; in or not, time, stalls, the shallowest water under the hull.
   - `LEDGE_URL=… node tools/ledge-line-check.mjs [id …]`: every climbing line climbed with real input at the latches its chain names (and stopped at three when longer), then every hidden scaffold walked up its own flights and over its bridge.
   - `node tools/ledge-reach.mjs [--latches=3,4,5] [--only=…] [--at=x,y,z] [--route=…] [--json=…]`: what each latch count reaches on every landmass (about 5 min, 1.7 GB at most).
   - `SOAK_URL=… node tools/long-session.mjs [minutes=120] [sample minutes=5] [out.json]`: scripted play in one fresh browser, vsync on (wander, fight at camps, sail a rented boat, the Rift), sampled every few minutes. `SOAK_PHASE_SCALE=0.3` shortens each phase to try the bot. To tell a leak from a filling cache (Q-02): `SOAK_REGION=home` keeps the bot in the Wash and Saltreach (no sailing, no Rift); `SOAK_CLEAR_NAV=1` empties the navigation tile cache at each sample, between two forced GCs, and records what the tiles held; `SOAK_HEAP_PROFILE=1` samples allocations (CDP) and records the sites and files holding the most live memory at each sample. Serve the build from its own worktree (pinned commit) so edits elsewhere cannot change what a two-hour run loads.
   - The release session's checks (dev server unless noted; each prints a PASS/FAIL table and exits 1 on a failure):
     - `QUEST_URL=… node tools/quest-run.mjs [side|story|all|<quest id>] [--json=out.json]`: every quest and chapter played through the game's own paths by tools/quest-harness.js (dialogue clicked, real kills at placed spawners, lore read at its carrier, the sluice and the wound, the Crucible's waves), the ◆ checked before every step, a grid route to each target, and the rewards compared with the listed ones; `story` adds both answers to the writ, every faction path, the three endings, Maren's replies and the victory screen.
     - `SYSTEMS_URL=… node tools/systems-check.mjs [group ...]`: every side system through its own panel (dungeons, crucible, fishing, cooking, foraging, forge, mantras, rest, exploration, dialogue, death).
     - `LEGACY_URL=… node tools/legacy-check.mjs [dir]`: save slots and legacy through the real menus from an empty profile.
     - `FIRST_URL=… node tools/first-run.mjs <dir> [1280x720 1920x1080]`: a new player's first run with real input, screenshotted, with the tips it shows.
     - `UI_URL=… node tools/ui-check.mjs <dir> [sizes]`: 52 panels and HUD states at each size, measured for overflow and clipped text; every setting changed through Settings and checked live.
     - `TOUR_URL=… node tools/release-tour.mjs [dir]` (**built bundle**, vite preview): every region, dungeon and menu by its key; no requests after load; a boot with the internet cut; bad stored values.
     - `BOOT_URL=… node tools/boot-time.mjs [runs] [label]` (built bundle): boot to the world shown and to the menu ready, fresh browser per run, median; interleave two builds by alternating single runs.
     - `node tools/economy-report.mjs`: income against prices, drops, Embers and Sparks, survival rates (static).
     - `tools/lan-check.mjs` runs on the built bundle too, and joins the guest through the menu into a save slot.
3. In your own page scripts: wait for `window.__unstable.world`, then `g.createCharacter(...)` and `g.startGame(ch, false)`. Despawn enemies through `(await import('/src/core/globals.js')).G.actors`, and stop spawners waking by setting each `s.def` count to 0 (the town watch otherwise joins fights). Set `renderer.info.autoReset = false` and reset it each rAF to count draw calls through the composer.
4. Input without pointer lock: hold keys with `g.input.down.add('KeyW')`, edge keys with `g.input.pressed.add('Space')`, attack with `g.input.mPressed[0] = true`. Swings face `g.camYaw`. A press made from inside a `g.updatePlaying` wrapper must come before the original update: the frame swallows key and mouse edges after its first simulation step, so a press made after the player's update is never read.
5. Placed coordinates: data positions are remapped at load (continents). Read placed spawners from `g.spawners[i].def` and buildings from `g.world.interiors`, not from `src/data`.

## Regression scenarios (automated in tests/ unless noted)

- Combat rules: defense order, telegraphs, facing, can't-defend states, parry cooldowns, AI perception, feint bait (combat-rules).
- Statuses: burn, chill to freeze, shock, bleed, blind, immunity, ailments only on landed blows (statuses). Running slash and aerial slam on a real Player (moving-attacks).
- The systems round (agent/systems): each approved move (moves), Power by investment, investing at a campfire, cards anywhere, an inn setting only where you wake (progression, death), campfires you make (camp), each weapon axis, property and the balance band (weapons), each reworked talent and exclusion (talents), what defines each Vow and Resonance (vows), each archetype and group rule (archetypes), the planner and movement fixes (nav-fixes, traversal), presentation (presentation), the flags a LAN guest must send (lan-systems), no knocked overlay or struggle (knocked).
- Mantras: every one of the 38 behaviours cast through `Player.tryCast` with the real `Player.update`, its effect asserted; stars and sparks where they change the result; a guard test fails if a behaviour has no test (mantras).
- Navigation: wall, 1 m doorway, leash and return home, grid rules, per-step meter (navigation); routes through Saltreach's gates (city-terrain). In game: tools/chase-check.mjs.
- Spawning: camps wake a few enemies per frame (spawning).
- Palaces: every recorded route walked, including the Chain Citadel strongroom (palaces).
- Save migration, death and lives, quests and story, world placement and colliders: existing test files. `tools/collider-check.mjs` for town colliders.
- Content: the validator rejects a boss special with neither range nor radius (it could never be chosen).
- Factions: one faction is one side. The Enclave's wardens, their summoned Peacekeepers and the Fort Meridian garrison never strike or target each other; other guards and monsters fight as before (guards).
- The Rift: one lift, from the courtyard to the summit, carries a newcomer with no lever, gears or guardian, and its cage keeps its rider in on the way up (ascent-lifts); its shaft, its summit sill, bridge and crown are clear and under foot (city-terrain); landing guards spawn on their landings and hold their posts (spawning, navigation); a save where the Depths were steps back onto the arrival shelf (rift-footing). In game: tools/rift-escape-check.mjs.
- In a browser, not in `npm test`: LAN (tools/lan-check.mjs), the Rift escape (tools/rift-escape-check.mjs), great foes (tools/boss-check.mjs), frame pacing from the world's first showing (tools/frame-bench.mjs start), render identity of a performance change (tools/pixel-diff.mjs), a two-hour session (tools/long-session.mjs).
- Save slots and legacy: slot isolation, per-slot backups, Continue and Load, overwrite confirmation, danger-quit and wipes per slot, settings recovery (save-slots); Remembrance by progress, record once, spending, the heirloom claimed once and only by a newer character, bad values (legacy); corrupted characters repaired (save-migration); Hale's two quest chains (quests).
- Controls: BIND, CONTROLS, README's table, bracketed keys in prompts, and tip and Guide placeholders agree (controls).
- **Not automated:** two physical machines on LAN; boat travel beyond the soak bot's crossings.
