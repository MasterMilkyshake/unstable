# Environment art direction

What the world already is, and the standard new work must meet. Lore and cultures: docs/WORLD_BIBLE.md. The harbor/fortified-coast material kit: docs/ARCHITECTURE.md (despite its name, a visual-direction note).

## Identity

Blocky, terraced, stylized fantasy. Stepped cliffs and grass-capped stone shelves; heavy pale masonry, dark timber frames, desaturated plaster and wide slate eaves; warm lanterns against cool regional mist. Everything is procedural, with no external textures or models. Materials come from `world/buildingMaterials.js`, scaled to physical size.

## The user's standard

- Landmasses read as **continents**: broad joins, no pinched necks or narrow inlets, and biome seams that wander instead of running straight. No port right next to another port.
- **Landmarks are seen big and close** from early-game spots, framed like Elden Ring's first view of Limgrave, with the viewer slightly raised above lowland. The Hundred Arches from the Wash is the reference shot.
- Judge with the in-game map and first-person views, not only with tests. Prefer moving or framing a landmark over thinning fog or trees.

## Regional palettes (existing)

| Region | Read |
| --- | --- |
| Saltreach / the Wash | fortified harbor, pale stone, green-gray coastal haze, the Great Lantern Tree; Hightoll on its rock with the old high country's crags behind it, amber trees and the post's ruined chapel on the meadow below (Milestone 2) |
| Shimmerfen | marsh villages, mossy stone, reed roads |
| Thornwood / Meridian | Redwake forest, brigand timber; Enclave brick bastions, harbour moles, warships |
| Frosthollow / the Hush | pale masonry, snow, frozen fog-moor, the Ministry's stone halls |
| Ashen Spire | soot-dark stone, a bare cone ringed by woods, ash fall |
| The Verdance | canopy, moss |
| The Rift | a walled kingdom under the sea, chain to the surface, no fire anywhere; the Ferryman's beached boat and its one red lamp at the north-east lip |

## The ledge visual language (the ledge-built world, ADR-007)

A face is read from below before it is climbed. **Pale lips go up; dark faces don't.**

- **A climbable line** (data/ledges.js, world/ledges.js) is a stair of treads stepped back into the face, each riser of the region's own rock laid in two courses with a joint or two, each lip a **capstone**: a warm slab a shade paler than the rock, with a band standing proud of the riser and the region's moss hanging under it. In Frosthollow and the Hush the band is frost-rimed white; on the Ashen Spire, ash-grey; in the Verdance, root-green. One capstone is one catchable edge and one place to stand.
- **A face meant to be climbed by no one** is left plain: dark, jointed, without caps (the Old Crown, Hightoll's rock, the Westwold's range).
- **A hidden way up** (a scaffold: a timber tower with its stair wrapped round it and a plank bridge onto the top) is found by walking round a high place, not seen from the line's foot. The bridge leaves the stair's head, with planks beside the last flight so whoever turns early still has footing.
- **What the high tiers hold is marked from below:** a cairn and its pole, a torn banner over a camp's fire, the first lamp's ruin (data/ledgeSites.js TIER_MARKS), so a climber on the low ground knows there is something up there.
- **Enemies don't latch:** a camp stands where it can walk, the line arriving at the shelf's edge away from its middle; a high camp carries a ranged foe.

## Acceptance for a region

Recognizable silhouette from a distance; navigable terrain with no seams; working colliders (`tools/collider-check.mjs` clean, `--rift` for the Rift); lighting readable at noon and at night; ambient audio matches; at least one reason to go there (encounter, reward or story); every place with something in it reachable on foot by a fresh character; performance within QA_AND_BENCHMARKS.md targets; checked by map capture plus first-person shots.

How to check it (Milestone 2's scorecard in WORLD_DESIGN_PLAN.md used these):
- `tools/environment-review.mjs <out> [area]`: the area's views at noon and midnight with its map; per view the near-black tile share, the theme and ambient bed the player hears there, and the camps, chests, records and people within 120 m. Serve two builds and run it on both for a before/after.
- `tools/route-check.mjs [area]`: the walks through an area planned on the enemies' grid (a conservative test: it neither climbs nor takes steep trail steps).
- `tools/reach-check.mjs [target]`: whether a fresh Power 1 character gets to a place with real input, ledges included (ADR-007).
- Readability: near-black under 3% of a ground-level view at noon. Faces the sun misses on the surface go near-black today (WORLD_DESIGN_PLAN.md P6).
- From the Wash, Hightoll covers whatever stands straight behind it: frame new things beside a landmark, not behind it.
