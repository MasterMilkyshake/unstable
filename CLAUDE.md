# Unstable — agent notes

Browser 3D hardcore action RPG: JavaScript, Three.js 0.170, Vite 6, Node. No external assets; terrain, models, music and sound are generated at runtime. Original setting and lore (docs/WORLD_BIBLE.md); Deepwoken Pathfinder is a design-quality reference, never a source of copied content.

## Scope

- **Single-player first.** The game must run fully offline. Single-player correctness never depends on LAN code.
- **LAN co-op is secondary**: trusted host-authoritative relay (`server/lanRelay.js`, `src/net/`). Fix its defects; do not grow it into public multiplayer.
- **Out of scope** unless asked: public servers, matchmaking, ranked PvP, accounts, cloud saves, anti-cheat.
- **Keep the game lean.** Do not add a mechanic just because Pathfinder has one. The user rejected Vent and Tempo and had mana charging removed (mantras cost ether only, `G` is unbound). Ask before adding any new resource or mechanic layer.

## Commands

```bash
npm test                          # node --test, ~25 s, all must pass
npm run build                     # vite production bundle (large-chunk warning is expected)
node tools/validate-content.mjs   # cross-checks every data table
npm run dev                       # vite on :5173, no HMR
```

In-game checks need a dev server: `tools/chase-check.mjs` (enemy navigation), `tools/lan-check.mjs` (host and guest), `tools/frame-bench.mjs` (frame times; compare builds in interleaved runs). See docs/agent/QA_AND_BENCHMARKS.md.

When another agent may share this tree, work in your own `git worktree` with your own vite port and a private `cacheDir` (see docs/agent/QA_AND_BENCHMARKS.md for the headless capture setup).

## Code map

- `src/game/game.js`: lifecycle, fixed-step loop (1/30 s slices), death/Rift transitions, spawners. `src/game/*`: quests, story, factions, systems hooked in through `game/hooks.js`.
- `src/entities/actor.js`: shared combat body (attack phases, parry/block windows, posture, statuses, physics). `player.js` (controller), `enemy.js` (AI), `remotePlayer.js` (LAN avatar).
- `src/combat/rules.js`: combat timings and the pure defense decision. `combat.js`: hit effects. `mantraRuntime.js`: mantra behaviors.
- `src/data/*`: content tables (weapons, mantras, talents, enemies, quests, world layout).
- `src/world/*`: world built once at boot (terrain, towns, Rift, vegetation, colliders).
- `src/core/save.js` + `migrate.js`: one localStorage slot plus a rolling backup; every load migrates.

## Invariants

- Gameplay timing comes from simulation time (`dt`), never from animation playback.
- Player and humanoid enemies resolve hits through the same `applyHit` / `resolveDefense` rules.
- Saves must keep loading, but no player saves need preserving right now. When content is removed or renamed, don't write migration refunds or bump `SAVE_VERSION`: `core/migrate.js` already drops unknown ids (weapons, items, talents, mantras, quests, trinkets) on load, and that is enough.
- Effects (vfx, audio, UI) must not decide outcomes; they report them.
- Keep the scene's point-light count fixed: a new or hidden point light recompiles every lit shader (ADR-005).
- Walking AI moves through `Enemy.navTo` (entities/nav.js); `moveToward` is for short steps like strafing.

## Verification

A build passing is not proof. For gameplay changes: add or extend a headless test, run the full suite, then exercise the change in the real game (Playwright with system Chrome) and check the console. Never report a test or measurement that was not run. Record results in docs/agent/SESSION_HANDOFF.md.

## Docs

docs/agent/: SESSION_HANDOFF (start here), IMPLEMENTATION_ROADMAP, FEATURE_PARITY_MATRIX, UNSTABLE_CODE_AUDIT, ARCHITECTURE_DECISIONS, PATHFINDER_REFERENCE, QA_AND_BENCHMARKS, EVIDENCE_LEDGER, ENVIRONMENT_ART_DIRECTION, WORLD_DESIGN_PLAN.
