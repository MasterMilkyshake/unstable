# Architecture decisions

## ADR-001: Preserve and improve; no rebuild

**Decision:** keep the current architecture and improve systems in place (the directive's Approach A/B), replacing a system only when a localized fix cannot work.

**Why:** the existing game works end to end: 188 passing tests, a clean content validator, no console errors, and a large authored world. A rewrite would throw away three domain passes of world work for no demonstrated gain.

**Revisit if:** world size forces streaming, which would replace the build-everything-at-boot model.

## ADR-002: Combat rules in one pure module

**Decision:** `src/combat/rules.js` holds the defense timings (`COMBAT`) and `resolveDefense()`, the pure decision of evaded, parried, blocked or hit. `combat.js applyHit` calls it, then applies effects. The player, enemies and LAN results all go through it.

**Values (Unstable's own tuning, not Pathfinder numbers):**
- Missed-parry cooldown: 0.9 s, up from 0.55 s. A parry that lands resets it to 0.
- Enemies use the same cooldown (`Actor.startParry`), so a feint that baits an enemy parry leaves it unable to parry the follow-up; it falls back on its guard.
- Enemy perception delay: 0.06 s (0.04 s for bosses) into a wind-up before reacting. Player M1 wind-ups are 0.14–0.36 s, so a longer delay would make light weapons unanswerable.
- Input buffer: a dodge or crit pressed up to 0.16 s early still fires.

**Tests:** tests/combat-rules.test.js.

## ADR-003: No mana charging; mantras cost ether

**Decision (user, 2026-10-15):** remove hold-G mana charging. Each mantra's old mana cost folds into its ether cost at half weight (Ember Bolt: 16 mana + 10 ether → 18 ether). `manaRate` modifiers became ether regeneration, ether cost or mantra cooldown effects. Sage Ilvar's trial is now "invest in an attunement". The save flag `manaUnlocked` is kept and still gates attunements. Migration passes the trial for saves that filled mana or already invested.

**Rejected alongside:** Vent and Tempo (see PATHFINDER_REFERENCE.md).

## ADR-004: Enemy navigation is a lazy walk grid with a metered A*, not a navmesh

**Decision:** `src/entities/nav.js` plans over a 0.4 m grid built in 6.4 m tiles on first use from `world.colliders` and the terrain. Each cell keeps its terrain height and the colliders within 1.1 m. Whether a body can step into a cell is decided from the height it comes from, with `Actor.physics`'s rules: colliders up to 0.55 m are stepped onto, terrain steeper than 1.3 m per metre is a wall, ground below the swim line is water, drops over 3.5 m are refused. So stairs, raised floors and bridges work without layers. An enemy walks straight while the straight line is walkable. Only when it is not does a weighted (×1.5), resumable A* run, under a budget of 1 ms of navigation per simulation step. The grid rebuilds when `Colliders.version` changes (frost walls, dungeon gates).

**Why:** the world is built at boot from tens of thousands of colliders across stacked levels. A navmesh would mean a bake step and a layered mesh for one feature. The grid needs neither, is exact where enemies actually go, and costs nothing where they don't. 0.4 m cells are the coarsest that keep a 1.0 m door passable: a cell centre always falls inside the opening, and thin walls still block.

**Limits:** flyers, swimmers and aquatic enemies steer straight. Bodies are planned with half their radius as clearance (physics slides the rest), and the stuck watch covers gaps the grid misjudges.

## ADR-005: A fixed point-light count, and shaders and geometry warmed behind the menu

**Decision:** three.js compiles one shader variant per count of visible point lights, so the scene keeps the same count from boot. Lights an actor carries (the local player's rim and fill, the night watchman's lamp) are lent by the world (`World.lendLight`): they stay in the scene, are carried to their holder before each render, and lie dark when it is hidden or gone. `game/warmup.js` compiles every material in the background and uploads the scene's geometry a few megabytes a frame, nearest first, with a scan every two seconds for what is added later. Spawners queue on waking and build at most `SPAWNS_PER_FRAME` (2) enemies a frame. The rules are written up in docs/ARCHITECTURE.md, "Keeping frames even".

**Why:** without it, entering the world recompiled 23 shaders, and arriving in the Rift compiled 8 and uploaded 60 MB in one frame (E-12 to E-14).

**History:** `agent/stability` first fixed this with its own `Game.warmRift()` and `world.playerLights`; main (102c8f6) fixed it more generally. The merge (43034a4) kept main's `Warmup` and `lendLight` and the branch's staggered spawns.

**Rule for new code:** don't add or hide point lights at runtime. Borrow one with `World.lendLight`.

## ADR-006: The warm-up waits for the GPU and keeps its batches within budget

**Decision:** `game/warmup.js` does nothing (no program checks, no batch) while the GPU is still behind with the last frame. `Warmup.endFrame`, called after each frame is drawn, places a fence (`fenceSync`) while work is pending. The next frame's `step` reads the fence's status (`getSyncParameter`, which does not wait) and goes ahead only once it has signaled, or after 8 frames regardless. A batch counts three.js's work per object as well as the bytes to upload. It closes before the next object would take it over the frame's budget (12 ms behind the menu, 2 ms in play); only an object bigger than any budget goes over, alone. Both rates are learned from what each batch took, each in proportion to its share of the estimate, with floors of 0.5 ms per MB and 5 µs an object.

**Why:** in WebGL under Chrome, a synchronous call (a program's first use reads its logs) or an upload larger than the transfer buffer waits until the GPU process has caught up, and while the GPU is behind, it can't. Just after the world appeared, the GPU was still busy with the first frames while the warm-up checked 528 programs and uploaded 342 MB in 0.35 s, and a third of runs had a frame of 67–117 ms (E-35, E-36). With the fence and the budgets, the warm-up takes about 0.8 s behind the menu and no run had a frame over 50 ms (E-36), with the same pixels (E-37).

**Rule for new code:** background GPU work (uploads, compiles, readbacks) waits on a fence, never on a synchronous query.

## ADR-007: Climbing by ledges, not up any wall

**Decision (user, 2026-10-16):** Deepwoken's latch jump replaces free wall climbing and its grip meter (`entities/player.js`):
- **Catch:** in the air, moving into a wall whose top edge is 1.2–2.3 m above the feet, the hands catch it and hang (`probeLedge`, `tryLatch`). This doesn't happen when the jump would clear the edge anyway, and an edge too low to hang from is pulled straight over.
- **From the hang:** jump leaps about 2.3 m straight up (forward held carries you onto the top), and the hands can catch the next edge up mid-leap. Back or dodge lets go, and a blow knocks you off.
- **Wall hop:** in the air against a wall with no edge in reach, jump hops about 1.1 m up it.
- **The count:** catches and hops share `derived.latches`, which landing restores: 3, plus 1 at Agility 35 and 70, plus the whole-number `latches` mod. Cat's Grace, Wall Runner, the Kithari's Nine Lives and the Updraft resonance give 1 each. Gear gives none, on the user's word.
- **What counts as a ledge:** the wall in front ends at the edge (just over it, nothing ahead within 0.6 m of the face) and a body fits on top (1.9 m of room at the edge and 0.5 m in). A terrain shelf counts where the ground beyond rises less than 0.6 m in 0.6 m.

**Why:** the user wants Deepwoken's movement. The free climb let any face be crawled up with a meter; ledges make routes the world's shapes decide.

**Consequences:** a sheer face with no ledge can't be climbed. The environment agent's reach check found the Oar Barrow and the Wash Prospect reachable only by a 13 m free climb, and the Redwake Watchfire upland not at all. A way up for them waits on the user. `climbing` now means hanging; the LAN flag and the rig's climb pose read it as before.


## ADR-RL1: Three save slots, and a legacy kept apart from them

**Decision (user-approved: save slots and legacy across wipes):** `core/save.js` keeps three character slots, each with its own rolling backup. Slot 1 is the old single save's key (`unstable.save.v1`), so an existing save simply is slot 1; slots 2 and 3 are `unstable.save.v1.slot2`/`.slot3`, and each backup is its key plus `.bak`. A slot's save is its main copy, or its backup when the main one is missing or unreadable; a wiped character's backup is never brought back. Calls without a slot number act on `Save.slot`, the slot being played; Continue takes the living character saved most recently. Settings (`unstable.settings.v1`) are shared and sanitized on load: each key has a default and a range or a set of allowed values, and a bad value falls back to its default.

Legacy lives in `unstable.legacy.v1` (`core/legacy.js`), which `Save.clearCharacter` never touches. A wipe records the character once (`ch.legacyId`), at the moment its save is cleared, so a reload on the death screen can neither lose it nor pay twice. Remembrance is `5 + 2·(Power−1) + 6·chapters finished + 8·great foes + 4·full hours (up to 6)` (data/legacy.js). The great foes are the bosses of the story and the open world, not a dungeon's keeper or a field boss. The heirloom choice waits in `pending` until the player picks, so a closed tab brings it back at the menu. One heirloom waits at a time; it can be claimed by a character created after it was left (`stats.started`), once. Remembrance buys at most three things, all at creation.

**Why:** slots and legacy are per-profile features that must not entangle: a wipe or a danger-quit penalty may touch only its own slot, and legacy must outlive every slot.

**Tests:** tests/save-slots.test.js, tests/legacy.test.js; tools/legacy-check.mjs in game; tools/lan-check.mjs with a guest.

## ADR-RL2: One controls table; tips that name keys from it

**Decision:** `core/input.js` holds `CONTROLS` beside `BIND`: every control as `{ keys, text }`, where keys are BIND actions, `hotbar` or mouse buttons, and `{action}` in a text names that action's key. The help screen draws it, README's table is written from it (`tools/controls-table.mjs`), and K, J and Z (Gear, Journal, Resonance) are bound there like every other key. First-time tips (`data/tips.js`, `game/tips.js`) and the Journal's Guide name keys only through `{action}` placeholders. A tip shows once per profile (`unstable.tips.v1`), never pauses, waits while a panel is open, and another system shows one with `ACTIONS.tip(id)`.

**Why:** the help screen, prompts and README had drifted from the bindings (an unused X binding, hard-coded R and Q in the HUD). With one table, a test can hold them all together.

**Tests:** tests/controls.test.js: every binding is in the table and the table names only bindings; README's table is the table; every bracketed key in any source prompt is a bound key; tips and Guide entries use placeholders and have no runtime fields left in the Guide.

## ADR-RL3: Interface scale by zoom, with viewport units divided by it

**Decision:** Settings → Interface Size sets `--ui-scale` on the root. `#hud` and `#screens` are zoomed by it, and every viewport-relative length in the UI's CSS and inline styles is written as `calc(N * var(--sh))` or `var(--sw)`, which are `1vh` and `1vw` divided by the scale. The canvas, the world-space bars and damage numbers are not zoomed.

**Why:** under CSS zoom a `90vh` limit grows with the zoom (842 px in a 720 px window at 1.3, measured), so panels would overflow; divided by the scale they fit at every size.

**Rule for new UI code:** write viewport-relative lengths with `var(--sh)`/`var(--sw)`, not `vh`/`vw`.

## ADR-RL4: A save is repaired before it is migrated

**Decision:** `core/migrate.js` repairs a character's stored fields before dropping unknown content: a value of the wrong type or out of range is reset to what a new character has, field by field (name, look, Power, points, silver, lives, hunger and water, positions, lists and maps, inventory counts, stats). A position that cannot be read wakes the character at its rest point. Still no SAVE_VERSION bumps and no refunds (the user's rule).

**Why:** the release tour found that a save with a missing `look` or wrong types loaded into a crash on Continue. A slot should never brick the game.

**Tests:** tests/save-migration.test.js; tools/release-tour.mjs's bad-value cases.

## ADR-RL5: Loot you choose, pouches anyone can take, a strongbox death can't touch

**Decision (the user's request, 2026-10-16, "like Deepwoken"):**
- **Chests** open into a panel (`game/loot.js`): take one thing, a whole stack or everything. The first opening rolls what is inside once (`ch.chestLoot[id]`); what is left stays for that character, and the chest is searchable until empty. A chest opened under the old take-all rule counts as emptied.
- **Pouches**: from the inventory, anything that may leave you (not quest items or the Registry papers, not the wielded weapon or worn trinkets) can be left at your feet as one pouch. Anyone can search it, and an empty pouch is gone. No item models: a pouch is a leather sack made of the keepsake chest's two materials (compiled at boot), with no light. A pouch never rests in deep water or over the Abyss.
- **Death**: a death on the surface leaves half your carried silver, up to four of your item stacks (a third of each, at least one), and by chance a spare weapon and a loose trinket in a pouch where you fell (`LOOT.death`). Nothing equipped, worn or banked. The map marks your lost pouch. A death in the Rift drops nothing: it ends the character, and what it carried is the heirloom choice.
- **The Keepers' strongbox** (`game/bank.js`): every inn's host keeps the same account. Silver without limit, 30 slots of stacks, weapons and trinkets; it can't be opened in the Rift; death never touches it. Kept with the character (`ch.bank`): a wipe loses it.
- **A death in the Rift ends the character** (the user's rule, relayed by the systems session the same day). Lives are spent only by quitting or reloading in danger; an Ember of Life restores one of those.
- **LAN**: the host owns the pouches, as it owns enemies, and keeps them in its world's save (`ch.pouches`). A guest asks to drop (`pdrop`) or take (`ptake`); the host decides, answers the asker (`pgive`), and tells everyone (`pset`, `pgone`). A joining guest asks for the list (`preq` → `plist`). Leaving a host's world brings your own pouches back. The messages reach `game/loot.js` through `G.netHandlers`, net.js's one generic dispatch line (shared with the world-life session's `wev`).

**Why:** the user wants Deepwoken's choose-what-you-take chests, dropped pouches and banks, and a death that costs what you carry.

**Notes from the first browser run (E-212, E-214):** loot.js wraps `ACTIONS.mapMarkers` in a boot hook, because markers.js is imported later and replaces it outright. "Take everything" takes from a local container in one go; only a guest's takes wait for the host.

**Tests:** tests/loot.test.js (containers, what may leave, the death share, the strongbox and its slots, a pouch's life, the host giving each thing once, the map's markers, resting places); tests/death.test.js (a Rift death drops nothing); tools/systems-check.mjs `loot`; tools/lan-check.mjs (a shared pouch).

## ADR-RL6: Banners show their main line only

**Decision (the user's rule, 2026-10-16):** big on-screen labels keep their title and drop the line under it. `ui.banner(title, sub)` ignores `sub`, so calls on any branch keep working; where the line carried a fact (a chapter's or quest's name, its silver, a bell's mantra, a vanquished foe's name, what to do in the Rift), the caller shows it as a toast. Death screens show their title only.

**Why:** the user wants the labels clean; the toasts keep what a player needs.

**Tests:** tools/ui-check.mjs's `rift-hud` and `death` states; quest-run and systems-check read toasts, not banners.

## ADR-RL7: An attunement at creation, a backpack, and growing at rest (Deepwoken's way)

**Decision (the user's request, 2026-10-16: "make the inventory and stats and stuff like deepwoken… you choose attunements in character creation… do whatever is nice"):**
- **Creation** offers None, Random or one of the five attunements (`data/origins.js`, `game/creation.js`). A chosen one starts at 10, its first mantra's requirement (Deepwoken gives +10), awakened, with that mantra known and on the first free hotbar key. The bonus is attributes, never points, so the Power gate (agent/systems) is untouched; the Shrine of Order keeps it like a race bonus (`ch.startAttune`). None keeps the old path: Sage Ilvar awakens mana at Power 2.
- **The backpack** (`ui/backpack.js`, the ` key or the character menu's Backpack tab): everything carried and the mantras known as tiles, with filters, a search, a pane for the tile under the cursor or the one chosen, and a hotbar strip to drag supplies and mantras onto. Trinkets are worn through `game/gear.js`'s `wearTrinket`/`takeOffTrinket`, shared with the Gear panel.
- **Investing at a campfire** (the user's correction, relayed by the systems session: "you can choose talents anywhere… the inn just sets your spawn point… if you talk to the inn keeper they will let you do it"): points are invested only while sitting at a fire (agent/systems: `Player.resting()`, `ACTIONS.readyToRise`, `ACTIONS.openRest`); talent and mantra cards are chosen anywhere; `Game.rest` only charges and sets where you wake. The campfire names points that wait and opens a Power that is due; Old Wren's "Sit by the fire" seats you at hers (a campfire never sets where you wake). It does nothing in a build without the rest API. An earlier version opened growth after a night in any bed (`ACTIONS.afterRest`); it is gone.

**Why:** Deepwoken's rhythm (invest at a fire, carry a backpack you drag from) is what the user asked for; each piece fits a system the game already had.

**Tests:** tests/creation.test.js, tests/backpack.test.js; in game: creation at 1280×720, the backpack's keys, hover, search, drag, wear (scratch checks, E-225 onward).

## ADR-008: The approved moves live in the shared combat rules

**Decision (user, 2026-10-16, "I actually want all of that"):** flourish, uppercut and air chase, roll-cancel, a directional guard, blind on enemies and boss summon retry. Every number is in `COMBAT` (combat/rules.js): `flourish`, `launch`, `rollCancel`, `guard`, `blind`, `summonRetry`.
- **Flourish:** an M1 held at the top of its wind-up while LMB stays down, up to 0.35 s, then released. Whoever drives a swing sets `atk.hold` each step and `Actor.updateAttack` waits. A foe that has seen the player flourish may wait for the top of the next swing before parrying (patience = skill × min(1, seen / 2)). Humanoid enemies flourish too (10%, bosses 20%), and a held swing can still be feinted.
- **Uppercut and air chase:** LMB in a slide lifts a light or medium foe (`canLaunch`: never a boss, a flyer, a swimmer or anything over 2.4 m), which cannot defend until it lands. Space within 0.6 s leaps after it for two air cuts and a slam (`Player.startAirString`).
- **Roll-cancel:** F in the first 60% of a roll ends its motion and i-frames for a block or parry at once; the dodge cooldown grows 0.6 s.
- **Guard:** block and parry cover 140° in front (`guardCovers`; Stonewall 180° while blocking); the rim costs 1.3× posture; a raised guard turns at most `COMBAT.ai.guardTurn`.
- **Blind:** a blinded enemy perceives only 3 m, can't parry, block, feint or flourish, and swings where it last saw its foe (bosses for half as long).
- **Summon retry:** a boss whose summon cast is cut short tries the same wave again 3 s later.

**Why:** the player and humanoid enemies resolve hits through the same rules (CLAUDE.md), so a move is a rule in one place that both sides obey and that LAN carries as data (hit keys, `hold` and `rollX` events).

**Tests:** tests/moves.test.js; in game tools/moves-check.mjs; on LAN tools/lan-check.mjs checks 6, 7, 10 and 11.

## ADR-009: Power is gated by investment

**Decision (user, 2026-10-16):** XP no longer raises Power by itself. Along today's curve (`xpForLevel`), XP earns one investment point per fifteenth of a Power's XP (`Player.earnPoints`). Power rises when the fifteenth point earned since the last Power is invested (`Player.invest`), bringing the talent and mantra picks and a full heal. The creation points and the Shrine of Order's refunds are spent first and never count; Power never goes down. XP past a full bar is banked (up to one Power) and flows on after the rise. Bad or missing `earned`, `invested` and `xpBank` values recover on load, and a save from before the gate gets the points its XP bar is due (no `SAVE_VERSION` bump).

**At a campfire (user, 2026-10-16, "whatever deepwoken does", then: "it's just your stats when you rest at campfire… you can choose talents anywhere… the inn just sets your spawn point"):** points are invested only while sitting at a campfire, alive, upright and out of danger (`Player.resting`); `Player.invest` refuses otherwise, so Power rises at a fire. The talent and mantra cards a rise brings are chosen anywhere (`pickTalent`, `pickMantra`). An inn's keeper sets where you wake for 10 silver and nothing else (`Game.rest`: no sleep, no night passing, no healing; not in danger or in the Rift). Agent 4's campfire panel reaches the menu through `ACTIONS.readyToRise()` and `ACTIONS.openRest(ui)`. Deepwoken's per-attribute training items are not built: a new mechanic, not asked for.

**Why:** Pathfinder's progression: a build grows by what you put into it, and the Power a character shows is what it has invested.

**Tests:** tests/progression.test.js.

## ADR-010: Weapon handling and one property per rare weapon

**Decision:** every weapon sets six handling values on top of its class (data/weapons.js): reach past the class's, swing speed, posture damage, chip through a block, armour pierce and weight. Weight over 4 slows the walk and the roll and lengthens the roll's cooldown (`WEIGHT`, `weightEffects`). Enemies' swings and blows use the same numbers (`Enemy.humanoidM1`, `buildHit`). Each of the 28 rare, epic and legendary weapons has one property (`WEAPON_TRAITS`, combat/weaponTraits.js), run in three places: where the hit is resolved (the host on LAN) for what reads or changes the target, on the wielder's side for stacks and swing shapes, and in the kill hooks for rewards. A property marked `foes: false` does nothing in an enemy's hands.

**Balance rule:** each weapon's M1 string damage per second at requirement-level attributes stays within 20% of its rarity's mean (bare fists aside), checked by tests/weapons.test.js from tools/weapon-balance.mjs. When a weapon an enemy wields is trimmed, change its damage, not its speed (the enemy's timing), and give the enemy's `dmgMul` the difference.

**Tests:** tests/weapons.test.js (each axis, enemy sharing, one test per property, the band); validate-content checks every value's range; tools/weapons-check.mjs in game.

## ADR-011: Talents change behaviour, and some exclude each other

**Decision:** 45 of the 66 talents that only added a number now change how something works (79 of the 100 talents outside the Vows). A behaviour is a flag in the talent's `flags`, read where the behaviour happens (combat.js, rules.js, actor.js, player.js, enemy.js, game/talentpowers.js). Talents that would stack into one degenerate build exclude each other with `excludes` (Evasive and Ghost Step, Rallying Spirit and Second Wind, Juggernaut and Colossus), and the card says "Not with …". Vows and Resonances each define a build (game/vowpowers.js, resonance.js).

**Rule:** the content validator fails a flag that no code reads. A flag the host reads from a LAN guest (its blows, or its avatar in enemy AI) goes in `GUEST_MODS` (net.js); tests/lan-systems.test.js fails if one is missing.

**Tests:** tests/talents.test.js (one per reworked talent and per exclusion), tests/vows.test.js, tests/lan-systems.test.js.

## ADR-012: Group tactics, and six archetypes from existing parts

**Decision:** enemies fight together by a few rules (entities/tactics.js, `TACTICS`). At most two melee foes press one target; the rest circle at 5.5 m. A presser gives its turn up after a full string when someone waits. A turn lapses after 4 s, and a lapsed turn rests 1.2 s before it is claimed again when someone else waits, so foes that can't reach or swing don't hold turns for good. The second presser comes in off the first one's line. An ordinary foe under 30% health falls back for 2.5 s and calls its side within 30 m. Ranged and support foes keep their band (`spec.keep`) and take no turns; monsters and bosses press as they like. Six archetypes are built from existing models, weapons and projectiles: the Redwake Harpooner, Bonesetter, Skirmisher and Breaker, and two large monsters with fixed patterns, the Shellback and the Cairn Hulk. Agent 5 places them.

**Why:** Deepwoken's crowds are dangerous by numbers, not by every foe swinging at once; turns keep a group readable and flanks keep it threatening.

**Tests:** tests/archetypes.test.js (one per archetype and group rule); tools/group-check.mjs in game; lan-check check 9 (the Bonesetter on a guest).

## ADR-013: Movement physics: fast moves in sub-steps, falls from the top of the arc, speed kept in the air

**Decision (entities/actor.js, player.js):** a fast move (a lunge, a dash, a roll) is resolved against the static colliders in steps of at most 0.3 m, so a 30 m/s Iaido can't carry through a thin wall. A fall is measured from the top of the arc it ends, so a wall hop, a leap or a catch starts a new one. In the air, steering keeps speed already won (a slide-jump), and landing at speed carries it 0.3 s before the walk or sprint takes over. A vault from a hang stops once the feet are on the top. Terrain rises are judged over the navigation grid's 0.4 m cell (`STEP_BASE`), so physics and the planner agree on what is a wall. E leaves a boat as the prompts say (`Game.useInteractKey`).

**Tests:** tests/traversal.test.js, tests/nav-fixes.test.js (each failed on origin/main 2abded8); tools/traversal-check.mjs (ten legs with held keys) and tools/walk-check.mjs in game.

## ADR-014: Combat presentation reports the rules, never decides them

**Decision:** telegraphs read without colour: an unparryable blow shows spikes round the head and shrieks to a high ping; an unblockable one shows chevrons pressing down and tolls low. Block, parry and guard-break sounds and reactions follow the striking weapon's class, and hit-stop and shake follow its weight. Settings' Reduce Flashing scales shake and flashes to a third. The rig's walk cycle runs at the cadence that keeps a planted foot still. A swing reaches its contact pose as the active phase begins (`CONTACT_LEAD`, 78% into the wind-up), and a held flourish waits at the top of the wind. Hanging and leaping have their own poses.

**Rule:** timing comes from the attack's phases in simulation time; the rig follows them and never the other way (CLAUDE.md). Banners show their title alone; an instruction or a name that went under one goes in a toast (ADR-RL6, agent/release).

**Tests:** tests/presentation.test.js; tools/presentation-sheet.mjs (the same moments on two builds side by side).

## ADR-015: Campfires you make, as in Deepwoken

**Decision (user, 2026-10-16: "making campfires and placing them anywhere… like in deepwoken because otherwise it'd be really hard to invest points"; they chose sticks from branches plus firewood from stores, burning about five minutes):** using three Sticks or one Firewood (`item.camp`, `Player.useItem`) lays a campfire 1.6 m ahead (game/camp.js). It is a campfire like the world's own: sit (and so invest your points), cook. It burns 300 s of play, then its seat, embers and light leave and whoever sat by it stands. One fire of your own at a time. None in the Rift (the user's rule), in danger, in water, aboard or off the ground. Made fires never set where you wake. Sticks come from fallen branches, a forage kind appended last in `FORAGE` (so every other kind's seeded scatter stays put); Firewood is sold at the four general stores. On LAN the others see your fire and may sit at it (a `camp` message through `G.netHandlers`).

**Rule:** a made fire lights through a `world.lightSources` entry that the fixed pool picks up, never a new point light (ADR-005), and removes everything it added when it goes out.

**Tests:** tests/camp.test.js; in game (E-113).

## ADR-WL1: The Rift has one lift (amends the Rift rework of 2026-10-15)

**Decision (user, 2026-10-16):** "I hope you are not removing the rift claims you and instead removing just the subtext below it; also I hope you only have 1 lift in the rift and if you die you wipe also when the labels come for that only have the main text and not the subtext". Asked how many lifts, the user chose "One lift".
- The Ascent has **one stone lift**, `ascent_lift` (`world/ascentLifts.js`), at the old base lift's spot on the keep's north wall (+z), where the walk from the arrival shelf already ended. It runs from the courtyard to the summit (about 111 m, 16 s at 7 m/s); its bridge comes onto the crown from +z, a few steps from the Wound. The middle and high lifts and their towers are gone, and nothing stops at the keep's roof, so its parapet and the Thin Stair's gallery are closed all round.
- It runs from arrival with no lever, gears or guardian (unchanged), and keeps one first-ride riftling ambush (there were three, one per lift). No other difficulty was added.
- **The cage holds its rider:** a Rift death now ends the character (Agent 4's branch), so the cage's side grilles are colliders that ride with it, and a drop bar closes its open front whenever it is off the courtyard stop. A rider is kept clear of both, so no collider ever rises through a body.
- Banners carry only their main text: `finishAscent` shows "THE WOUND OPENS" alone (Agent 4 drops the subtext in `ui.banner` for every call).
- The dead rope code (`SPIRE_ROPES`, `state.spireRopes`, `syncRopes`, `ACTIONS.rideAscentRope`) and the texts that spoke of ropes, a fire to wake at or a life lost in the Rift are gone.

**Why:** the user's call. One lift is also a clearer way out: a single landmark at the end of the walk instead of a chain of three cages and two landings.

**Consequences:** the climbing route up the spine's faces still exists, past the guarded Hanging Keep and Last Stair; its draughts on the Guarded Landing and the Thin Stair are now reached only by climbing. The lift tower rises past the keep's roof to about 125 m; it stands against the keep's parapet and beside the +z arcade hall and the +x+z corner tower.

## ADR-WL2: Factions that move are host-run events that answer to every player

**Decision:** the world's events (game/worldLife.js, game/seaLife.js; data/factionLife.js) are run by one director on the host: Enclave columns, checkpoints, road convoys, sounding parties, the Watch against the Redwake, hunters, cutters, sea convoys, a false convoy, a beset fishing boat and drifting wreckage. Each kind registers `start` (may it begin, and where), `tick` (true ends it) and optionally `end` (what it put in the world goes with it).
- **Every player counts, not only the host's:** an event lasts while anyone playing is near it (`nearestPlayer`), hails, warnings, wanted marks and pay go to whoever earned them (`reward`: applied locally, or sent to a guest as `wevr`), and hunters come for a wanted guest as well as the host.
- **A guest sees the events:** their enemies as the usual proxies, their props in a `wev` message each second, their boats through the boat sync; a guest's own standing decides whether a checkpoint stops them, on their machine.
- **Nothing is built in play:** props (carts, barricades, bundles, flotsam) and the events' boats are pooled at boot and lent out; the sea roads' courses are charted at boot (the sea's A* is too slow for a frame).
- **Squads march by moving their homes:** an idle guard walks to its home through `Enemy.navTo`, so a moving home is a march; the march waits only for members still closing on their places, never for one stalled (a guard on a bank above the road once held a convoy forever).
- **Their deeds reach the contract boards** through `ACTIONS.lifeOutcome` (an escort, a sounding watched, a checkpoint broken), on the guest's machine too.

**Why:** the plan's "factions that move" (approved by the user) in LAN's trusted, host-authoritative model: one place decides, everyone sees and is paid. **Consequences:** events start near the host (`start` reads the host's position for most kinds); a guest far from the host has none of their own. The cutter chases the host's boat only.

## ADR-WL3: Contract boards beside the officers

**Decision:** a physical board beside each faction's officer (game/contracts.js, world/contractBoards.js, data/contracts.js) posts `BOARD.offers` contracts a day of play (`BOARD.day` seconds), picked by a hash of the day, none held or done today; a character holds at most `BOARD.held`. Kinds: clear (kills of given types inside a ring, from KILL_HOOKS), escort, witness, war (from the world events' outcomes), recover (a bundle set down at a place, picked up with [E]) and supply (items handed over). Field work is paid at the board. `ch.lifeContracts` is repaired at every start: unknown ids, bad counts and bad flags are dropped or clamped, so a bad save still loads. The board is closed to the Distrusted, the wanted and the faction's enemies at war.

**Why:** "standing that matters" with work a player chooses, built on the world's own events rather than a new system. **Consequences:** each clear contract's ring is held by a test to contain a camp of its foes large enough for its count.

## ADR-WL4: Rivalries and the rewards of standing

**Decision:** a change of standing moves the faction's rivals the other way by a share (data/factions.js `RIVALS`: Enclave→Ministry −1/3, Enclave→Watch −1/4, Ministry→Enclave −1/3, Watch→Enclave −1/5, rounded; no chains), shown on the same toast. Honored and Exalted send their rewards once (flags `honored_<f>`, `exalted_<f>`), on the rise and at the start of play; the outfits, trinkets, the stores and their Trusted gate are agent/release's rows. A gift whose row is missing in a build is held back with its flag unspent.

**Why:** the user's approved "standing that matters". **Consequences:** story and quest rep changes through `ACTIONS.addRep` carry rivals' shares too.

## ADR-WL5: Sailing meets the world

**Decision:** entities/boat.js: the rudder needs way on (0.15 of full turn at rest, full at 5 m/s); the wind in the weather drives the sail (±15% before or into it); the hull meets the shore and anything built in the water (a probe at the bow through `Colliders.resolve`), and runs along it, losing the speed that points into it, instead of bouncing back; hulls keep apart; `landingSpot()` puts someone stepping off on dry ground beside the boat if any is within a few metres, never inside a collider (agent/systems' `Player.leaveBoat` calls it). The sea grid keeps 8 m clear of built works, and in a storm the sea runs higher (`SEA.swell`, the water shader's `uSwell` kept in step with `waveHeight`).

**Why:** the plan's sailing defects, each with a test (tests/boats.test.js, all six fail on the old boat). **Consequences:** a boat no longer passes through piers, moles or arches' piers; pilots of captained boats arrive within a settable radius (a bow meets the quay first).

## ADR-WL6: The place's own sounds

**Decision:** core/audio.js adds a place bed over the region's (surf, wind with height, a town's murmur, a hearth, crickets) and calls now and then (birds, gulls, frogs, a dog, a hammer, a far bell), fed by game/soundscape.js four times a second (`placeAt`: shore, height, town, fire, green, marsh, indoor). Indoors, the place, the region's bed and the rain go through a lowpass. Every great foe has fight music (a shared march for the Enclave's wardens, a `lair` theme for lair and dungeon masters), and the world's events have their calls, routed from `play()`'s default case so combat sounds (agent/systems') are untouched.

**Why:** the plan's world audio. **Consequences:** none on frames: a handful of always-running nodes; calls are short-lived nodes swept like every sound.
