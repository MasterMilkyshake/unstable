# Unstable

A hardcore soulslike RPG of shattered islands, built in the browser with Three.js, playable solo or in LAN co-op. It's inspired by various games: parry-and-posture combat, attunement mantras, talent cards, oaths, climbing by ledges, hunger and thirst, a sanity-draining world beneath the sea, limited lives, and permadeath with a legacy that outlives it. Names, lore and content are original to Unstable.

Everything (terrain, characters, creatures, weapons, effects, music and sound) is generated procedurally at runtime. There are no external assets.

## Running it

```bash
npm install
npm run dev        # opens http://localhost:5173
```

For a production build: `npm run build`, then `npm run preview`. The output in `dist/` is a static site you can host anywhere.

Click the game window to capture the mouse. Press `Esc` to release it and pause.

## LAN co-op

Play in the same world with friends on your network (up to 4 players).

1. The host starts the game with `npm run lan`. The terminal prints an address like `http://192.168.1.20:5173`, and in-game the **LAN Co-op** screen shows it with a Copy button.
2. The host opens **LAN Co-op** → **Host a Game**.
3. Each friend opens that address in their browser on the same network, then **LAN Co-op** → **Join a Game**. Friends need nothing installed.

How it works:
- **The host's game owns the world**: enemies, bosses, guards and spawners.
- **Each player owns their own character**: movement, parries, dodges, HP, inventory, quests, lives and saves stay on that player's machine.
- **Kills give every nearby player their own XP, loot and quest progress.**
- **Boats are shared**: you can board a friend's boat as a passenger, including ferries.
- **The world never pauses in co-op**, even with menus open.
- If the host leaves, everyone else continues in their own world.

Each player needs their own browser profile or computer, because saves live in the browser.

**If your friend can't connect:** many campus, office and hotel networks block devices from talking to each other ("client isolation"). Use a phone hotspot, which both laptops join, or a tunnel: install `cloudflared` (`brew install cloudflared`), run `npm run tunnel` alongside the game, and send your friend the `https://….trycloudflare.com` link it prints. Anyone with that link can open the game while the tunnel runs, so stop it with Ctrl+C when you're done.

## Controls

| Key | Action |
| --- | --- |
| `W` + `A` + `S` + `D` | Move. |
| `Shift` | Hold while moving to sprint. |
| `Space` | Jump. Jump into a ledge to catch it; from the hang, `Space` leaps up (`W`: onto it, `S` or `Q`: let go). In the air against a wall, `Space` hops up it. |
| `C` | Slide while sprinting. Jump out of a slide to keep its momentum. |
| `LMB` | Attack (chains into a combo). |
| `LMB hold` | Flourish: hold an attack at the top of its wind-up (up to 0.35 s), let go to strike. A held swing can still be feinted. |
| `C` + `LMB` | Uppercut: attack during a slide to launch a light or medium foe (never a boss or a large creature). |
| `Space` + `LMB` | Air chase: within 0.6 s of a launch, jump to leap after the foe; attack in the air for two cuts and a closing slam. |
| `R` | Critical attack. Each weapon class has its own, on a cooldown. |
| `RMB` | Feint: cancel your attack's wind-up. |
| `F` | Hold to block. Tap it just before a hit lands to parry. Block and parry cover 140° in front: blows from the side or behind land, and a blow on the guard's rim costs more posture. |
| `Q` | Dodge with brief invulnerability. It can cancel a wind-up and puts out fire. |
| `Q` + `F` | Roll-cancel: block early in a roll (first 60%) to end it and parry at once; the next roll waits 0.6 s longer. |
| `1–0` | `1` raises or lowers your weapon (a new character wakes with its fists down); `2`–`0` cast a mantra or use an item. |
| `B` | Grip (execute) a knocked enemy. |
| `E` | Interact or talk. |
| `Tab` | Character: attributes and investment, talents, mantras, the backpack (everything you carry; drag supplies and mantras onto the hotbar), quests. |
| `M` | Map. |
| `J` | Journal: the story, standing, the Atlas, sources, investigations, the Guide. |
| `Z` | Resonance ability (from Power 15, once attuned at the Vowkeeper). |
| `Esc` | Pause, and release the mouse. |

Keys can't be rebound. **How to Play** in the menu lists the same controls.

## What's in it

**Characters**
- 12 races, randomly rolled at creation with 2 rerolls (Remembrance from lost characters buys more). Each has stat bonuses, a passive and physical features (horns, ears, tails, tusks, crystals, glowing marks).
- An attunement chosen at creation, as in Deepwoken: it starts at 10, awakened, with its first mantra known. Or none, and Sage Ilvar awakens mana later.
- 14 attributes in three groups:
  - Base: Strength, Fortitude, Agility, Intelligence, Willpower, Charisma.
  - Weapon: Heavy, Medium, Light.
  - Attunements: Emberweave, Rimebind, Stormcall, Galesong, Umbracast.
- Power 1–20, gated by investment, as in Deepwoken: experience earns investment points one at a time; you invest them while sitting at a campfire (any town's, or one you lay from Sticks or Firewood), and the fifteenth since your last Power raises you to the next, with a full heal and a talent card and a mantra card to choose anywhere. An innkeeper's room sets where you wake.
- 109 talent cards, including Vow talents, drawn from what your stats qualify for; many change how you fight, and some exclude each other.
- A **backpack** (in the character menu, `Tab`) in Deepwoken's manner: everything you carry, and the mantras you know, as tiles with filters and search; drag supplies and mantras onto the hotbar.
- 9 Vows (oaths), sworn at the Vowkeeper's Perch at Power 5. Each grants unique talents and a mantra.

**Combat**
- 12 weapon classes, each with its own M1 combo and critical attack: fists, dagger, sword, rapier, katana, spear, club, greatsword, greataxe, maul, scythe and lance.
- Running attacks, aerial slams, feints and dodge-cancels; flourishes (a held swing), uppercuts from a slide and air chases after them, and roll-cancels into a parry.
- Posture and guard breaks, parries that stagger, and enemy poise. Block and parry guard 140° in front: blows from the side or behind land.
- Hyperarmor, plus red (unparryable) and orange (unblockable) telegraphs.
- Ailments: burn, chill → freeze, shock, bleed stacks and blind (a blinded enemy sees only a few metres and cannot parry or block).
- 78 mantras across the five attunements, plus physical arts, mobility, support and vow mantras, 8 Bells taken from great foes, and 5 Resonances.
- 44 weapons, each with its own handling (reach, speed, chip through a block, armour pierce, weight; rare and named ones carry a property of their own), 8 enchantments (reforged at the blacksmith), 23 outfits with armor and elemental resistances, and 40 trinkets.

**World**
- Large connected landmasses with many sub-regions, built in a blocky, terraced style: stepped cliffs and grass-capped stone shelves, timber-and-plaster towns with flared roofs, and a regional mist on every island.
  - **Saltreach and Shimmerfen** (centre and east): the Lantern City — a walled harbor around the Great Lantern Tree, the raised Keepers' Terrace, Sage's Rise and its pagoda, the Harbor Ward and East Bank — plus the Millbrook farms, Kestrel Heights and its beacon, Greywood and Hollowbrook, North Watch, Smugglers' Cove, the Wash, and the Reed Road to Shimmerfen's marsh villages. Beyond the fen stand the Hundred Arches, and on its rock at their north end Hightoll, the castle whose Bridge Gate opens on a sixty-metre drop.
  - **Thornwood and Meridian** (west, one continent): Redwake forest and Brigand Hold; Fort Meridian, the Enclave's walled bastion with the Chain Citadel and the Registry ward; Meridian Harbour with its moles, quay and warships; and the Crown Drydock with its sluice into the Rift.
  - **Frosthollow and the Hush** (north-east, one continent): Frostwatch, White Pass and the White Hollow; on its southern shore the Hush, the Ministry's frozen fog-moor, with the Sounding House, the Quiet Archive, the Chair Fields, the Listening Stones and the Drowned Bell. The Rime Road joins Frostwatch to the Sounding Way.
  - **Ashen Spire** (north-west): Cinderstead, the Attendants' Road and the Caldera.
  - **The Verdance** (north): Canopy Landing, Mossbound Hollow and Kingsfall.
  - Islets on the sea roads: the Anchor's Fall (a colossal kneeling statue), Gallows Rock, Saint Ebb's Light and the wreck of the Gull's Reach.
- Roads link every landing to the places people actually go. Discovering a named place earns experience and adds it to the map.
- Seven enterable inns with hosts, furnished common rooms, upstairs beds and working stairs; a room rented from the host sets where you wake. Every region builds with its own materials.
- The Rift: a sanity-draining world beneath the sea. When it takes you, you sink out of the water overhead and fall into it, whole. The void under the islands is the Abyss — not an ocean; fall in and you die. The Hollow Duke's great chain rises from his throne into the sea, and the Ascent is the way home: walk up from the arrival shelf through the Great South Gate into the keep, through its gate hall and out its north door; a single stone lift against the keep's north wall carries you from the courtyard to the summit, where you step through the Wound to leave the Rift. No fire burns in the Rift.
- The Landing That Never Came: on the Rift's north-east lip, past the Garrison Steps, the Lanternless keeps his toll beside his beached boat.
- No fast travel. Rent a skiff, sloop or longship at a dock and sail yourself. Friends can board as passengers.
- Carrier lines: cable strung where no road climbs. Hightoll's garrison lines cross the Hundred Arches' breaks to the Bridge Gate and run down from the Land Gate to the Reed Road; others climb from the Wash camp to the Wash Prospect and to places like the Redwake Watchfire. Haul lines draw you uphill.
- Day/night cycle and weather: rain and thunderstorms, snow and blizzards, ash fall on the Spire, and motes and drips in the Rift. Also swimming and deep-sea predators.
- Climbing by ledges: jump into an edge to catch it, hang, and leap to the next; in the air against a wall, hop up it. The world rises in tiers of shelves and ledges, and every place with something in it has a way up. Campfires (sit and cook), wells and chests.
- Three dungeons under the coast: the Bell Under Ice, the Overflow Galleries and the Smugglers' Sea-Cave, each with its rooms, levers, keeper and hoard.
- Enemy types with distinct AI, from mudlurkers and brigands that block, parry and dodge to owls, crabs, wolves, golems, imps, sharks and Rift horrors.
- 12 great foes: Sera Vane, Old Mother Reed, Kaelen the Red, Bonegnaw, the Frost Warden, Odric the Unrelieved (the castellan of Hightoll, whose bell tolls when he gives up his guard), the Cinder Colossus, the Primadon, Varga Thorne the Vice Warden, Aurek Vell the Grand Warden, the Hollow Duke and the Lanternless.

**The Unstable Tide (main story)**
- A full storyline in six parts, from waking on the Wash to the throne beneath the sea: *Prologue — Salt in the Lungs*, *Act I — The Lamp and the Writ*, *Act II — Three Signatures*, *Act III — Iron on the Water*, *Act IV — The Sovereign Beneath*, and the *Epilogue — Beneath the Bottom*.
- Every step has a ◆ marker on the compass and the map, including the way into or out of the Rift when the next step is in the other realm. Chapters wait until you reach their suggested Power.
- Choices that matter: register your name with the Enclave or refuse; at the Anchor's Seat, break the chain, let the Ministry seal the passage, or claim the seat yourself. Each ending has its own title and its own reaction from Maren.

**Factions and guards**
- The Saltreach Watch, the Enclave (the crown fleet that fled the Fracture, now back to reclaim the coast under its Grand Warden, with Peacekeepers on every road) and the Ministry of Soundings (keepers of the old Compact's measurements, who would close the passage of the dead).
- Guards patrol towns and hold gates and posts. They fight monsters near them, and they only turn on you if you strike them, if you're wanted, if their faction hates you, or if you're at war with it. Restricted grounds (the Chain Citadel, the Quiet Archive) warn you before they treat you as an intruder.
- Standing runs from Hated to Exalted. Striking a guard marks you as wanted (shown on the HUD); pay a fine to the faction's officer to clear it. Each faction has its own quest path and a board of contracts that turns over every day. Trusted opens an officer's stock, Honored a faction's outfit and trinket, Exalted something no one else carries and a title.
- The factions move: columns march the roads between forts, checkpoints stop those of low standing, hunters come after anyone wanted too long, and the Enclave's cutters chase the wanted at sea. What you answer to the Writ and choose at the Anchor's Seat changes who holds the coast.

**Survival and death**
- Hunger and water drain over time. Sanity drains in the Rift; at low sanity you hallucinate.
- When your health hits 0 you are *knocked* for about twelve seconds. If nothing is hunting you, you rise on your own after a few seconds; otherwise you bleed out, and nearby enemies can execute you.
- Dying on the surface drags you into the Rift, at full health: climb the Ascent home. **A death in the Rift ends the character for good** (see *Saves, lives and legacy*). An innkeeper's room sets where you wake; campfires never do.
- Characters begin with 3 lives, spent only by quitting or reloading while in **danger**; losing the last also ends the character. An Ember of Life restores one lost life, up to your maximum.

**Progression & activities**
- **Traits** (Vitality, Erudition, Proficiency, Songchant): points at creation and every 5 Power, assigned like attribute points while sitting by a campfire (the Attributes tab).
- **Trinkets** in three slots (head, neck, ring). Corwin sells and forges them; great foes carry unique ones. Dropped trinkets can roll bonus "pips".
- **Mantra Sparks:** each spark at the altar adds a star and a modifier: Potent, Swift, Thrifty, Far-Reaching, Twin, Lingering or Empowered.
- **Bells:** slaying a great foe teaches you its rare, attunement-free mantra.
- **Resonances:** at Power 15 a sworn character can attune to Ardour, Tacet, Rhythm, Sanguine or Updraft at the Vowkeeper. Each gives a passive and an ability on [Z].
- **Tempering:** Dorran tempers weapons to +3 with Smithing Stones and Star Shards.
- **Shrine of Order:** refunds every attribute and trait point for silver.
- **The Crucible:** a wave arena east of Saltreach with four trials. Falling there never costs a life, and Crucible Marks buy unique prizes.
- **Foraging, cooking and fishing:** gather berries, honey, lilies, peppers, salt and herbs, cook buff meals at campfires, and fish docks and shores with a timing minigame.
- **World events:** Rift Breaches open with guardians to clear, and stars fall and leave starmetal to harvest.

## Saves, lives and legacy

- **Three save slots**, each with its own character, rolling backup and lives. **Continue** picks up the slot played last, **Load** lists every slot (name, race, Power, place, time played, lives), and **New Game** asks before it replaces anyone. Settings are shared by every slot.
- A penalty for quitting in danger, or a wipe, touches only its own slot. In LAN co-op you bring the character from a slot.
- When a character dies in the Rift, or spends its last life, it goes into the **Register of the Lost** (on the main menu): its name, race, Power, cause, playtime, kills, chapters reached and great foes slain. It earns **Remembrance** by how far it got. On the wipe screen it can leave one **heirloom**, a weapon or a trinket, in the keepsake chest by Wren's fire on the Wash, for the next new character in any slot to take once.
- **Chests** show what is inside: take what you want, one thing, a stack or everything; what you leave stays. From the inventory you can leave anything that isn't a quest item or worn in a **pouch** on the ground; anyone can take from it, and an empty pouch is gone.
- **Dying on the surface** leaves part of what you carry where you fell: half your silver, some of your goods, perhaps a spare weapon or a loose trinket. Go back for it before someone else does. Every inn's host keeps the **Keepers' strongbox**, one account for the whole coast; what is in it is safe when you die.
- Remembrance is spent at character creation, on at most three things: another race reroll, *Wren's Bundle* (silver, bread and a waterskin), or *a Kept Ember* (an Ember of Life).

## Wayfarer’s Journal

Press **J** to open the Wayfarer’s Journal. Its sections connect the story, exploration, history and character progress:

- **Story:** every act and chapter of the main storyline, with status, the steps so far, suggested Power and a **Track** button that points the compass at that quest. Faction paths are listed below the chapters.
- **Standing:** your reputation with the Watch, the Enclave and the Ministry, from Hated to Exalted, and whether you are wanted or at war.
- **Chronicle:** 24 accounts of the Fracture, the shape of the Anchorage, magic, death, the kindreds, the Vows and the factions. Foundations are readable immediately; deeper accounts require recovered evidence.
- **Atlas:** fourteen regional dossiers unlock on arrival, with history, daily life, threats and travel leads.
- **Investigations:** fifteen evidence trails with one-time XP, silver and supply rewards. Complete the seven original regional investigations and assemble the final account to earn **Witness of the Unstable Tide**.
- **Sources:** 116 written records across the surface and the Rift. Each sits where it would really be found: a book on a lectern, a notice pinned to a post, a letter left on a crate, or words carved into stone. Read them with **E**.
- **Bestiary and Records:** combat observations, discovery totals and earned titles.
- **Guide:** every first-time tip and a short entry for each system.

Search covers only visible/recovered text. Missing sources show location leads. Reading order is unrestricted, and records found before opening an investigation count. The journal is saved with the active character; it does not transfer across a wipe. Many people offer **Ask about the world** conversations, with new responses as evidence is recovered.

Saves from earlier versions still load: removed content is dropped, and a save with bad or missing values is repaired rather than refused.

Read the [complete world bible](docs/WORLD_BIBLE.md) for author-facing canon, chronology, cultures, character voices, everyday life, mysteries, and clearly marked future story proposals. It contains spoilers.

## Settings and accessibility

- Mouse sensitivity, field of view, invert Y, camera shake; master, effects and music volume; view distance, shadows and damage numbers.
- Quality **High** (bloom, light shafts, water reflections), **Medium** (the same at a lower resolution, no reflections) or **Low** (no post-processing).
- **Interface Size** (85–130%) scales the HUD and every menu; **Reduce flashing and shake** dims screen flashes and holds shake low; **Sound cues** caption warning sounds with their direction; **Tips** explain each system the first time it matters (the Journal's Guide keeps them all).
- **Precise depth** (on by default) uses a logarithmic depth buffer so distant walls and roofs don't flicker into each other; it costs a few percent of frame time. It applies on reload; `?logdepth=0` or `?logdepth=1` in the URL overrides it for one page load.
- Every other setting applies at once; all are kept for every slot. Keys can't be rebound.

## Validation

```bash
npm test                          # unit and headless tests
npm run build                     # production bundle
node tools/validate-content.mjs   # cross-checks every data table (ids, behaviors, models, drops, rewards)
```

Checks that drive the real game in Chrome (each takes the server's URL in an environment variable; see `docs/agent/QA_AND_BENCHMARKS.md`): `tools/quest-run.mjs` (every quest and chapter, the endings, the faction paths), `tools/systems-check.mjs` (dungeons, the Crucible, crafting, fishing, inns, boats, sources, chests, the Atlas, the death loop), `tools/legacy-check.mjs` (save slots and legacy through the menus), `tools/first-run.mjs` (a new player's first hour, screenshotted), `tools/ui-check.mjs` (every panel at three window sizes, every setting live), `tools/release-tour.mjs` (the built bundle: every region and menu, offline, bad stored values), `tools/lan-check.mjs`, `tools/rift-escape-check.mjs`, `tools/boss-check.mjs`, `tools/chase-check.mjs` and `tools/frame-bench.mjs`.

## Project layout

```
src/
  core/      input, procedural audio, noise, saves, shared globals
  data/      races, stats, weapons, items, mantras, talents, vows, enemies, NPCs, quests, world layout
  world/     terrain, water, sky/day-night, colliders, vegetation and structures
  entities/  actor base, player, enemy AI, NPCs, boats, projectiles, rig + animation, creature models
  combat/    hit resolution, mantra behaviors, particles and effects
  game/      game loop, camera, spawning, death/Rift flow, quests, and self-contained systems
             (traits, gear, travel, arena, events…) registered via game/hooks.js from game/systems.js
  ui/        HUD, menus, character screen, dialogue, shops, map
```

Most content is plain data in `src/data/`. You can add a weapon, mantra, talent, enemy or quest there without touching engine code.

## Notes

- Progress saves to `localStorage`: three character slots (each with a rolling backup), the settings, the Register of the Lost and its Remembrance, and which tips you've seen.
- The game runs offline and asks nothing of the network. Its two typefaces, Cinzel and EB Garamond, are bundled under the SIL Open Font License 1.1 (`src/ui/fonts/`, with their licences).
- Debug handles are exposed on `window` for the browser console: `__unstable` is the game and `__G` is the shared globals. For example, `__unstable.player.addXp(5000)` grants experience, and `__unstable.simulate(seconds)` steps the game logic without rendering.
- LAN co-op is available through the built-in relay (`npm run lan`). Public matchmaking, competitive PvP and guild systems are not included.
