// Ground palettes only. Sky, fog and landmark lighting live elsewhere.
// Each palette: sand (shore), grass and grass2 (the cover, mixed by noise), rock and high
// (walls and peaks), under (seabed, scree), and the ground's own detail: soil where the
// cover is worn through, moss in the damp, wear where it is bleached, blown or trodden.
export const BIOME_COLORS = {
  // The Wash: sea-grass and straw over sand, never the lawn green of the beach palette.
  dunes: { sand: '#d9c89a', grass: '#7a9156', grass2: '#97985e', rock: '#8f887a', high: '#a39d90', under: '#c8b57e', soil: '#b5a274', moss: '#6b8250', wear: '#e3d5a8' },
  beach: { sand: '#ebd59a', grass: '#8fc456', grass2: '#6eaa46', rock: '#8e877b', high: '#a39d90', under: '#c8b57e', soil: '#c9b483', moss: '#7ea850', wear: '#efdcaa' },
  meadow: { sand: '#c8bb96', grass: '#7a965c', grass2: '#5c7c4a', rock: '#85887e', high: '#a9aaa0', under: '#a39c83', soil: '#7a6a4c', moss: '#4f6e3e', wear: '#a39a6e' },
  // The Ashen Spire's woods: Thornwood's pine and fern grown back on old ash, over black
  // volcanic soil, bracken rusting in the glades and dark sand on the shore.
  emberwood: { sand: '#7f776a', grass: '#3d5a33', grass2: '#4b5531', rock: '#47433e', high: '#615c54', under: '#5e574c', soil: '#2c2420', moss: '#38542e', wear: '#5f5040' },
  forest: { sand: '#b8ac86', grass: '#45663a', grass2: '#334e32', rock: '#6f7469', high: '#8a9180', under: '#99957c', soil: '#4a3e2c', moss: '#3a5a30', wear: '#6b5a3a' },
  marsh: { sand: '#86885a', grass: '#5e7a48', grass2: '#4a6840', rock: '#5f5a4a', high: '#7a7a5a', under: '#454832', soil: '#4a4630', moss: '#56703e', wear: '#7d7a52' },
  // Snow is never flat white: blue in its hollows, drifted bright on the crests, rock showing.
  snow: { sand: '#c4ccd4', grass: '#e7edf4', grass2: '#cfdbea', rock: '#6e7c8c', high: '#f6f8fb', under: '#7d8d9b', soil: '#7d8792', moss: '#f5f8fc', wear: '#bccadb' },
  // The furnace's ground: pale ash over black basalt, cinder in the hollows.
  volcanic: { sand: '#6a625c', grass: '#8a847e', grass2: '#726c67', rock: '#2a2624', high: '#3b3533', under: '#2a2624', soil: '#3a3532', moss: '#5c5753', wear: '#a39c94' },
  jungle: { sand: '#bbae83', grass: '#3e7240', grass2: '#2c5a38', rock: '#6a6b58', high: '#4a6a40', under: '#7a7152', soil: '#5a4a30', moss: '#2f6234', wear: '#6b6a3a' },
  farmland: { sand: '#c9bd94', grass: '#a8b058', grass2: '#c8ae52', rock: '#8d887a', high: '#a9a497', under: '#a39c83', soil: '#8a7550', moss: '#8a9a4e', wear: '#c9b878' },
  highland: { sand: '#b4ab90', grass: '#72824e', grass2: '#8a7a4c', rock: '#7b7a74', high: '#c0beb4', under: '#958f7a', soil: '#6e6044', moss: '#5d7044', wear: '#9a8c62' },
  tundra: { sand: '#b8b4a4', grass: '#b9c4b6', grass2: '#97a698', rock: '#7a8078', high: '#e8ece8', under: '#8a9088', soil: '#7e7a68', moss: '#8d9a6e', wear: '#d6dcd7' },
  // Old lava half grown over: grey-green lichen and heather on the cooled tongues.
  ashfield: { sand: '#5f5853', grass: '#6c6e60', grass2: '#5e5a50', rock: '#2a2624', high: '#38332f', under: '#2a2624', soil: '#2f2b29', moss: '#58644a', wear: '#8e877c' },
  bastion: { sand: '#b7ae94', grass: '#6a8a52', grass2: '#587448', rock: '#8a8a84', high: '#a8a89e', under: '#908878', soil: '#6e6650', moss: '#4f6a40', wear: '#9a9478' },
  // The Hush: a winter moor at Frosthollow's edge. Rime silvers the sedge, old snow lies in
  // the hollows, the heather shows through dark and the shingle is the colour of the fog.
  hush: { sand: '#848c96', grass: '#626e86', grass2: '#56646c', rock: '#5e6878', high: '#dde6f2', under: '#4c535e', soil: '#40424e', moss: '#54486a', wear: '#93a0b4' },
  // The islets: grey sea-rock under a thin grey-green turf, sand only in the coves.
  rock: { sand: '#b3a68a', grass: '#7b8266', grass2: '#676c58', rock: '#66635e', high: '#8a8883', under: '#5e5a52', soil: '#6a6152', moss: '#7d8a5a', wear: '#a7a08c' },
  // Drowned ground: slate and silt with a violet cast from the light, not painted lavender.
  rift: { sand: '#3a3444', grass: '#433a52', grass2: '#363044', rock: '#2a2530', high: '#5d5270', under: '#120e18' },
};
