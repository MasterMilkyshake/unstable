# Changelog

What changed for players, newest first.

## Unreleased

### Big beasts
- **Sharkos**: pale, hunched walkers three times a person's height that roam open country in pairs, in the meadows short of Shimmerfen, Thornwood's far uplands, Meridian's lowland, the woods under the Ashen Spire, Frosthollow's snow and the Verdance. Nothing staggers one. Parry its rakes, roll its kick (orange) and step aside from its charge (red); its roar breaks posture. Drops Sharko Teeth and meat.
- **The great owls, rebuilt**: gloomowls, thunderwings and Old Hookbeak are now hunched, near-black birds three times a person's height, with a pale heart-shaped face, lamp eyes, horn tufts and ragged wings they open wide to dive or screech. **They hunt alone**: every owl nest holds one, much stronger than before (gloomowl level 7, 480 health), and each drops two or three feathers. The Enclave's owl contract asks for the one.

## 1.0.0 — the finished game

The last development round, in three parts that ship together: combat, movement and progression (`agent/systems`); saves, content, onboarding, the interface and the release (`agent/release`); and the world's life (`agent/world-life`).

### Character creation
- **Choose an attunement** as a new soul washes ashore: +10 in it, awakened, and its first mantra known; or none, and Sage Ilvar awakens mana later.

### Campfires and the backpack
- **Invest at a campfire**, as in Deepwoken: points are invested while you sit by a fire, which says when points wait and opens a Power that is due at once. Talent and mantra cards are chosen anywhere. **Make camp anywhere**: three Sticks from fallen branches, or one Firewood from a general store, lay a fire that burns about five minutes (not in the Rift, in danger, in water or aboard). An innkeeper's room only sets where you wake; Old Wren's "Sit by the fire" seats you at hers.
- **The backpack** (`` ` ``, or the character menu's Backpack tab): everything you carry and the mantras you know as tiles, with filters, a search and a pane that shows what each is; drag supplies and mantras onto the hotbar strip.

### Saves, lives and legacy
- **Three save slots**, each with its own character, backup and lives. Continue, Load (name, race, Power, place, time played, lives) and New Game, which asks before replacing anyone. The old single save is slot 1. A danger-quit penalty or a wipe touches only its own slot; LAN brings the character from a slot.
- **The Register of the Lost**: every character whose last life is spent, with its Power, cause, playtime, kills, chapters and great foes. It earns **Remembrance** by its progress, spent at creation on another race reroll, Wren's Bundle or a kept Ember of Life.
- **Heirlooms**: a lost character leaves one weapon or trinket in the keepsake chest by Wren's fire, for the next new character in any slot to take once.
- Saves, settings and legacy recover from bad or missing values: a corrupted slot is repaired instead of crashing the game.
- **A death in the Rift ends the character.** Lives are spent only by quitting or reloading in danger.

### Loot, pouches and the strongbox
- **Chests** open into a panel: take one thing, a stack or everything; what you leave stays.
- **Pouches**: leave anything that isn't a quest item or worn in a pouch on the ground; anyone can take from it (in co-op too), and an empty pouch is gone.
- **Dying on the surface** leaves half your carried silver and some of your goods in a pouch where you fell; the map marks it. The **Keepers' strongbox** at every inn keeps things safe from death.

### Combat and progression
- **Power gated by investment**: experience earns investment points one at a time; investing the fifteenth since your last Power raises you, with a talent, a mantra and a full heal.
- New moves: **flourish** (a held swing), **uppercut** from a slide and the **air chase** after it, **roll-cancel** into a parry. Block and parry guard **140° in front**.
- **Weapon handling**: reach, speed, chip through a block, armour pierce and weight for every weapon; rare and named weapons carry a property of their own.
- **Blind** now blinds enemies: they see only a few metres and cannot parry or block. A boss whose summoning is interrupted tries again.
- Many talents now change how you fight; some exclude each other.

### The world
- **A ledge-built world**: shelves, ruins and walls shaped around catchable ledges, in height tiers, with a way up to every place that has something in it.
- More **carrier lines**, among them the Wash's rigging tower up to the Wash Prospect and lines to the Redwake Watchfire; haul lines draw you uphill.
- **Factions that move**: columns on the roads, checkpoints, bounty hunters for the long-wanted, the Enclave's cutters at sea, daily contract boards, and rewards at Trusted, Honored and Exalted. The story's choices change who holds the coast.
- **One way out of the Rift**: through the keep's gate hall and out its north door, a single stone lift carries you from the courtyard to the summit, where you step through the Wound.
- Brigand Hold seen from Rook's Landing, its yard dressed as a Redwake camp, and a beacon at the Landing That Never Came. An experimental bounce light for faces the sun misses, off by default.

### Learning the game
- **First-time tips**, once each, when a system first matters: a foe noticing you, a fight, a knocked foe, the new moves, ledges, carrier lines, boats, Power, hunger, the Rift, a lost life and the register, save slots, an heirloom, vows, resonances, Sparks, the Journal, world events, contracts, hunters, cutters and checkpoints.
- The Journal's **Guide** keeps every tip and explains every system. The help screen, every prompt and README's controls table are drawn from the game's own key bindings.

### Interface and accessibility
- **Interface Size** (85–130%), **Reduce flashing and shake**, **Sound cues** (directional captions for warning sounds), and **Tips** on or off.
- Quality **High**, **Medium** or **Low**, applied at once.
- Character creation fits a 1280×720 window; the slot list, boss bar, tip card and hotbar labels no longer overlap or clip; the Vowkeeper asks in its own panel; every purchase you can't make says why.

### Content fixes
- Captain Hale's Watch quests are offered beside his brigand work instead of only after it.
- Travel text no longer sends you to ferries (rent a boat and sail) or to rest at a fire in the Rift (none burns there).
- Legacy counts the twelve great foes, not dungeon keepers or field bosses.

## Earlier work

- **Milestone 2, the environment slice**: the Wash, Thornwood and the Rift scored from real captures; the Wash's own sound; region names instead of "The Open Sea" on land; Hightoll's crags and meadow.
- **Climbing by ledges** replaced free climbing and its grip meter; climbing gear was removed.
- **The Rift rework**: the Abyssal Depths, the sealed pale gates and the Rift's campfire removed; the Lanternless keeps the Landing That Never Came; the Ascent's lifts run from arrival and a surface death wakes in the Rift at full health.
- **Milestone 1, core stability**: enemies path around walls and through gates; the twelve great foes checked in their arenas; a shared parry and defense rule for players and enemies; no shader compiles in play and no frame over 50 ms after the world appears; LAN co-op checked end to end.
- **Hightoll** and its castellan at the end of the Hundred Arches; five attunements (Steelsing and Bloodhex retired); the isles joined into continents; mana charging removed (mantras cost ether only).
