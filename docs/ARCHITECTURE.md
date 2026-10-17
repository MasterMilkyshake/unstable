# Fortified coast visual direction

Saltreach now uses a fortified harbor composition inspired by Deepwoken: heavy pale masonry, dark timber framing, desaturated plaster, wide slate eaves, tiered towers, sheltered lanes and warm lanterns. The settlement is framed by stepped coastal bluffs and tall, angular tree crowns. Daylight and distance haze use a muted green-gray coastal palette.

The old Tidebound Archive presentation is replaced by the Wayfarer’s Journal, which opens to the Atlas. Existing evidence, rewards and saved discoveries remain available. The central record hall is now presented as the Watch House; architecture is organized around shelter, trade and fortification.

## Building kit and materials

`src/world/buildingMaterials.js` creates shared, deterministic stone-course, wood-grain, plaster and slate maps. Texture scale follows physical box dimensions. Material maps work in both the browser and Node without canvas or network assets.

Harbor houses use masonry ground floors, projecting plaster upper floors, timber brackets, shuttered windows, shallow porch roofs and hipped roofs with changing pitch. Smaller houses fill the inner perimeter while preserving gate approaches. The Sage’s Tower has stacked square galleries and broad eaves. Regional landmarks share the material kit while retaining their local palettes: mossy stone in the marsh, pale masonry in the north, soot-dark stone at the furnace and cold stone in the drowned ruins.

## Walls and circulation

`TOWN_WALLS` defines four chains of solid curtain walls with coping, walkable ramparts, crenellations, buttresses and arrow slits. Four watchtowers anchor the corners. The sea gate, two side posterns and northern gate leave four routes through town. Wall foundations extend into sampled terrain.

`CIVIC_ROADS` defines curved routes through the existing shops and interaction points. `samplePath` in `src/world/paths.js` supplies centripetal spline samples, variable widths and direction vectors. The rendered earth lanes conform to the terrain, taper at their ends and have rough verges. Irregular flagstones lie in the earth with gaps and worn shoulders. Vegetation exclusions use the same samples. There is no continuous rectangular tile grid.

Coastal escarpments use the same surface for movement, vegetation and visible ground. The North Road starts at Saltreach's northern gate and descends through the terrace edge into the ravine, continuing to Millbrook without a cliff interrupting the route.

## Validation

Architecture tests build the real terrain and complete structure pass. They check NPCs, records, ferry arrivals, interactions, boss clearances, overhead spawn hazards, all four gates, solid walls, supported ramparts, lane centers, vegetation exclusions, finite mesh vertices and a bounded static batching budget. Browser previews check the harbor approach, market lane, inn and settlement overview.

The supplied Deepwoken map informs the geography: large connected regions, sheltered ports, narrow sea passages, smaller navigation islets and inland routes between settlements.

## Connected geography and settlements

Saltreach, the Wash and Shimmerfen share a single terrain mesh. Reed Road leaves the western postern, follows the coastal neck and reaches Reedbank behind its fishing harbor. Thornwood and Meridian share another mesh, joined by Garrison Road through the wooded uplands. Original region IDs remain discoverable independently through `REGIONS`; existing quests and region discoveries retain their IDs.

Frosthollow has a harbor village at Frostwatch, the White Hearth inn, a graded road through White Pass Watch, and taller cliff shelves framing the northern fortress. The Hush shares its mesh, joined across its old north shore with a harbour bay between Frostwatch and Hush Landing and a sheltered bay to the east; the Rime Road runs from the White Pass round the bay to the Sounding Way. A joined region keeps its own placement offset (`joinCoasts` places its pieces itself) and its landforms keep the seeds and noise they had as an island (`grain()` in data/landforms.js), so the Hush's moor, tarns and summit stand as authored. Its own biome zones replace the ones grown from its lobes, so the moor's palette stops at the snow line instead of spreading over Frostwatch.

Seven inns have enterable common rooms, counters, hosts, lit sleeping lofts, beds and usable stairs. Renting a room costs ten silver and stores a floor-height respawn anchor. Commander Hale stands at the Saltreach barracks drill yard; Captain Rell stands in Meridian’s muster square. Meridian also has curtain walls, watchtowers, a forge, market and the Brass Compass inn. Rook’s Landing, Reedbank, Frostwatch, Cinderstead and Canopy Landing each have homes and a local inn.

Meridian's upper fort is entered by the counterweight lift from the walled Lower Works. The former road gate is sealed; Dock Road and Garrison Road connect below the fortress. The rock behind the fort joins the Meridian Heights through broad, overlapping shelves. A separate Signal Keepers Trail branches from Garrison Road, climbing to a crew camp and the Silent Signal watch post. Its ledger, patrol, wildlife and supply chest give the mountain a purpose beyond the skyline; the mountain route does not open another entrance into the fort.

An open ravine separates the two mountain shoulders. The Signal Bridge spans it with an Enclave stone arch, a six-metre-wide deck, solid parapets and lanterns. Its two approach roads grade only the banks; the gorge stays open below the physical bridge. The climbing trail follows the eastern slope to meet the crossing and watch post.

The Rift Ascent retains its climb, landings and lift shafts inside a broader castle. Roofed halls meet the curtain and corner bastions, angled corners shape the bailey, and all five court gates share the curtain's wall-walk elevation. The outer Drowned Precincts gates and walls also share a single elevation across the terraces.

`src/data/roads.js` stores elevation profiles for overland routes. The same spline drives the graded terrain, road mesh and vegetation clearance. Terrain road lookups use spatial cells. Dock headings preserve their original regional approach after the coast mergers. The map renders local biomes, coastline rings, terrain relief, roads and settlement symbols, with fewer overlapping labels.

Tests cover dry overland connections, slopes, pier ends, indoor floor and stair support, and room rental/respawn behavior. `npm test` passes 35 tests; content validation reports no errors or warnings. The production build succeeds with Vite’s existing large-chunk warning. Browser previews render without console errors.

Previews: [world map](previews/world-map.png), [Saltreach](previews/saltreach.png), [inn interior](previews/inn.png), [White Pass](previews/white-pass.png), [Meridian](previews/meridian.png).

## Keeping frames even

A frame should never compile a shader, upload a mesh, force a layout or collect much garbage. A few rules keep it so:

- **The light count is fixed once the world is built.** three.js compiles the number of lights into every lit shader, so a light joining or leaving the scene recompiles every material on screen, a stall of seconds. Lights an actor carries are lent by the world (`World.lendLight`, the player's rim and fill, a watchman's lantern): they stay in the scene, are carried to their holder before each render, and lie dark when it is hidden or gone.
- **Objects move only through position, rotation, quaternion and scale.** `core/sceneMatrices.js` recomposes a matrix only when those change, and the renderer's walk skips hidden subtrees (a skipped child is updated the frame it shows). Writing `.matrix` or `.matrixWorld` directly is not picked up.
- **Shaders and geometry are warmed behind the menu.** `game/warmup.js` compiles every material in the background and uploads the scene's geometry a few megabytes a frame, nearest first; a scan every two seconds (and at game start) catches what is added later. It works only once the GPU has caught up with the last frame (a fence, read without waiting), and no batch goes over the frame's budget unless one object is bigger than it: a synchronous call or a large upload made while the GPU is behind waits for it (ADR-006). Instanced shadow casters get depth materials of their own so the shared one never switches program.
- **Static batches are static.** `world/merge.js` bakes hand-placed meshes into per-cell batches, including the lore carriers and chest bodies. Anything that later moves, is shown or hidden, or changes material must be flagged `userData.dynamic` or kept out of the merge (the records and chest only a thinned mind sees are, `data/thinMind.js`).
- **The HUD writes only what changed.** `ui/ui.js` goes through `setStyle`, `setText` and `setClass`, and reads the compass width once per resize: an unchanged DOM write still dirties style and layout, and a layout read in the frame loop forces it.
- **Frame-loop code does not allocate.** Use `hypot` from `core/util.js` (Math.hypot to the bit, without the array V8 allocates for its arguments), scratch vectors and the colliders' scratch lists; the render lists sort with comparators that return -1/0/1.

The water's reflection renders from a scene listing only the top-level objects that hold something on the reflection layer, plus the lights and their targets, so the mirror's walk skips everything it would not draw.
