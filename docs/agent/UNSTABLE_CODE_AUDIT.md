# Unstable code audit

Audited 2026-10-15 at main `382fa1d` (193 commits, about 60k lines of JS). Traced from source and checked in the running game; anything not checked is marked **unverified**. Facts updated (not re-audited) at `43034a4`, after the attunement trim (fef677f), Hightoll (3444b6d), main's performance work (102c8f6) and Milestone 1 (#12, #13).

## Baseline

| Check | Result |
| --- | --- |
| `npm test` | 179/179 at 382fa1d; 222/222 at 43034a4; 265 with tests/mantras.test.js (M-01) |
| `npm run build` | succeeds; one 2.15 MB chunk (717 kB gzip), large-chunk warning |
| `node tools/validate-content.mjs` | 0 errors, 0 warnings at 43034a4: 46 weapons, 12 classes, 78 mantras, 109 talents, 61 enemies, 57 quests, 65 items, 20 outfits, 34 trinkets, 9 vows, 10 islands, 186 spawners (at 382fa1d: 44 weapons, 90 mantras, 115 talents, 59 enemies, 33 trinkets, 183 spawners) |
| Browser start (new character, Wash) | no console errors; 60 fps vsync-capped on an Apple M1 Pro |
| Frame time, vsync off | 95–137 fps; p99 under 15 ms in towns. See QA_AND_BENCHMARKS.md |

## Execution traces

**Input to outcome.** `core/input.js` keeps key and mouse edge sets (bindings in `BIND`; no rebinding UI). `Player.update` reads them while `controlsEnabled()` and calls `startCombo`, `startCrit`, `dodge`, `startParry`, `feint` or `tryCast`. `Actor.startAttack` runs windup, active and recovery phases on simulation `dt`. Each active tick, `meleeSweep` runs `meleeTargets`, which checks range, arc, vertical reach and body padding, then calls `applyHit`. `resolveDefense` (combat/rules.js) decides evaded, parried, blocked or hit. combat.js then applies posture, damage, resistances, statuses, knockback, interrupt and guard break, and triggers vfx, audio, hitstop and damage numbers. The loop runs fixed 1/30 s slices, at most 0.25 s per frame, and hitstop scales `dt` by 0.06.

**World.** `World.build()` runs once at boot: terrain (continents in `data/landforms.js`), water, sky, structures (towns built from the `kit`/`mason` builders), adventure sites, landmarks, the Great Bridge (the Hundred Arches), Hightoll at the Arches' north end, the Rift, dungeons, cliffs, vegetation, near grass, forage and wildlife. Static geometry is merged; far props are culled at fog distance. There is no streaming. Boot to world took about 19 s at the audit and about 8.5 s after main's warm-up work (102c8f6); the JS heap reads 530–700 MB in play, most of it collectable (about 540 MB stays after a forced GC by `performance.memory`, about 125 MB by V8's own used size).

**Hightoll and the carrier lines** (3444b6d). A castle on a dead-level 60 m rock past the Arches' last pier (`data/hightoll.js`, `world/hightoll.js`). No road climbs the rock: carrier lines (zip lines, `world/ziplines.js`) run from the end of the south road over both great breaks to the Bridge Gate, and down from the Land Gate to the Reed Road. The rider hangs from a trolley (`player.zip`, `game/ziplines.js`). Odric the Unrelieved, the castellan, keeps the Bridge Court: toll hammer, a leap, a thrown toll-stone and an unblockable knell; two sentries answer at 66% and 33% HP; he drops the Toll Hammer, his seal and the Bell of Hightoll (`game/hightoll.js`). Covered by tests/hightoll.test.js (placement, sheer rock, line clearance, a ride, open routes to the castellan, registered rewards).

**Progression.** A character is created with 12 points plus race bonuses. XP comes from kills, discoveries and quests. `addXp` raises Power automatically when XP reaches `110·L^1.42`, granting 15 points, one talent pick and one mantra pick. Points are spent manually in the character menu (cap 100 per attribute, 120 across attunements). There are five attunements: Emberweave, Rimebind, Stormcall, Galesong and Umbracast. Steelsing and Bloodhex were retired (fef677f) with their 13 mantras, 6 talents and the 4 behaviours only they used; 'blood' stays as the bleed damage and resistance element. Talents are offered from the pool your stats qualify for, and derived stats come from `computeDerived`. **Gap vs. reference:** Power rises on XP alone; Pathfinder ties Power to investment.

**Death.** At 0 HP the player is knocked for 12 s: struggle with Space, give in with R, and nearby enemies can grip-execute. Death on the surface sends you to the Rift with no life lost. Death in the Rift costs a life and wakes you at your last bed or inn. At 0 lives the character is wiped and its save and backup are deleted. Quitting in danger costs a life on the next load, and an Ember of Life restores one. **Nothing carries over across a wipe** (no legacy or account unlocks).

**LAN.** The relay only routes JSON. The host's browser owns enemies and spawners; each player owns their own character. A guest's hit on a host enemy goes to the host as `hit`, and the result comes back as `hitRes`. A host enemy's hit on a guest is forwarded as `hitYou` and resolved on the guest's machine. Player state is sent on an interval, and boats are owned by whoever sails them. **Unverified this session:** a real two-browser host/join run.

## System status

| System | State | Notes |
| --- | --- | --- |
| Melee core | working | 12 classes with M1 strings, crits, running and aerial attacks, feints, hyperarmor, red/orange telegraphs |
| Parry/block/posture | working, tightened | see ARCHITECTURE_DECISIONS ADR-002. Block is a frontal arc, not directional |
| Dodge | working | 0.27 s i-frames, cancels wind-up and recovery; now buffered |
| Missing combat actions | — | no flourish, uppercut, air chase or roll-cancel |
| Mantras | working | 38 behaviours across 78 mantras; ether cost only (mana charging removed). Every behaviour is cast headlessly in tests/mantras.test.js (M-01) |
| Talents | partial | 109 total: 38 carry behavioural flags, 71 are pure number mods |
| Enemy AI | working | probabilistic parry/block/dodge, feints, combo limits, at most 2 attackers on one target. Navigation (2026-10-15, ADR-004): walk grid, straight-line check, metered A*, stuck watch; flyers and swimmers steer straight. Poise counter: 3 interrupts in a row grant 1.3 s of poise. Blind has no effect on enemy AI |
| Bosses | working | 12 great foes with specials, summons, phases by HP: duelist, witch_queen, thresher, primadon, lanternless, warlord, frost_warden, cinder_colossus, castellan and hollow_duke in data/enemies.js; vice_warden and grand_warden in data/story.js |
| Traversal | working | climbing, swimming, rented boats, and the carrier lines at Hightoll (`player.zip`) |
| Saves | working | one character slot plus a rolling backup; migration on every load; versioned (`SAVE_VERSION` 6) |
| Settings | partial | quality, shadows, FOV, audio, sensitivity; no keybinding UI |
| Audio | working | fully procedural; regional music beds, combat heat, boss themes |
| World | extensive | three domain passes (towns, terrain, Rift); see WORLD_DESIGN_PLAN.md |

## Defects found

- **Fixed:** a mantra cast in hitstun spent ether and cooldown, then was cancelled on the next frame (`Player.tryCast` had no stun check).
- **Fixed (2026-10-15):** Chain Citadel strongroom ground doors opened onto a 1.8 m podium face. Sills now at podium height, with a landing and stair inside.
- **Fixed (2026-10-15):** a ~100 ms frame on arriving in the Rift. Causes: 60 MB of geometry and 8 shaders on first sight, a 50 ms wait on one shader's first use, 15 enemies built in one tick, a forced layout in `ui.update` every frame. Main's `game/warmup.js` and the staggered spawns cover it on the merged build. See ADR-005.
- **Fixed (2026-10-15):** entering the world recompiled 23 shaders, because the player's two lights changed the point-light count (game start frame ~310 ms, now ~90 ms).
- **Fixed (2026-10-15):** enemies could not path round walls, gates or buildings (A-02).
- **Fixed (merge 43034a4):** spawners put enemies on the highest walkable top within 400 m, so a Saltreach Watch guard spawned on a 145–165 m structure. `world/spawnSpot.js` now spawns on the surface nearest the terrain, keeps dungeon spawners on their floors, and lets wall archers `perch`.
- **Fixed (102c8f6, merged):** the night-watchman encounter added a point light at runtime; the world now lends his lamp a pooled light (`World.lendLight`).
- **Open, design question:** blind does nothing to enemies' AI.
- **Doc drift:** docs/ARCHITECTURE.md describes visual direction, not runtime architecture.

## Architecture limits

- Everything is built at boot. Memory and boot time grow with every region added; streaming would be needed for a much larger world.
- `G` is a global service locator. It keeps imports simple, but tests must stub `G.vfx`, `G.audio` and `G.ui`.
- AI navigation plans on a lazily built walk grid (ADR-004). It plans in 2.5D from collider heights, so a route the grid allows but physics refuses is caught only by the stuck watch.
- Shader variants depend on the point-light count: keep it fixed (ADR-005).
