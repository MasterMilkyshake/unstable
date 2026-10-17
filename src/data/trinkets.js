// Trinkets: accessory gear worn in three slots (head, neck, ring). Each grants a modifier bag.
// Sources: Corwin the jeweler (Saltreach), the Hollow Man, chests and enemy drops (TRINKET_DROPS).

export const TRINKET_SLOTS = {
  head: { name: 'Head', icon: '⛑️' },
  neck: { name: 'Neck', icon: '📿' },
  ring: { name: 'Ring', icon: '💍' },
};

export const TRINKETS = {
  // ---- head ----
  sailors_cap: { name: "Sailor's Cap", slot: 'head', rarity: 'common', price: 60, mods: { swimSpeed: 0.1, maxHp: 5 }, desc: 'Salt-stained wool. Smells of rope.' },
  iron_helm: { name: 'Iron Half-Helm', slot: 'head', rarity: 'uncommon', price: 260, reqs: { fortitude: 15 }, mods: { physResist: 0.03, maxPosture: 8 }, desc: 'Dented, but it has turned a blade or two.' },
  scholars_circlet: { name: "Scholar's Circlet", slot: 'head', rarity: 'uncommon', price: 300, reqs: { intelligence: 15 }, mods: { mantraDmg: 0.04, maxEther: 10 }, desc: 'A copper band etched with focusing glyphs.' },
  hunters_hood: { name: "Hunter's Hood", slot: 'head', rarity: 'uncommon', price: 240, reqs: { agility: 10 }, mods: { stealth: 0.15, speed: 0.02 }, desc: 'Deep-cowled and dyed the colour of nothing in particular.' },
  red_bandana: { name: "Kaelen's Bandana", slot: 'head', rarity: 'rare', price: 0, mods: { physDmg: 0.05, critDmg: 0.08 }, desc: 'The Warlord\'s colours. Brigands still flinch at the sight of it.' },
  rime_crown: { name: 'Rime Crown', slot: 'head', rarity: 'rare', price: 0, mods: { resist_rime: 0.2, mantraDmg: 0.06, maxPosture: 10 }, desc: 'A circlet of the Warden\'s ice. It does not melt on a warm brow.' },
  drowned_visor: { name: 'Drowned Visor', slot: 'head', rarity: 'rare', price: 0, mods: { physResist: 0.05, sanityResist: 0.15 }, desc: 'Barnacled steel. Behind it, the whispers sound very far away.' },
  bonegnaw_helm: { name: 'Bonegnaw Helm', slot: 'head', rarity: 'rare', price: 0, mods: { physResist: 0.04, maxHp: 15, maxPosture: 10 }, desc: 'A Thresher\'s skull-plate, hollowed out. Smells of the pit.' },
  crucible_helm: { name: 'Crucible Helm', slot: 'head', rarity: 'rare', price: 0, mods: { maxHp: 20, maxPosture: 12, physResist: 0.03 }, desc: 'A pit-fighter\'s helm, dented by a hundred bouts.' },
  starfall_circlet: { name: 'Starfall Circlet', slot: 'head', rarity: 'epic', price: 0, craft: { star_shard: 6, pearl: 1 }, mods: { mantraDmg: 0.06, etherRegen: 0.15, maxEther: 15 }, desc: 'Starmetal drawn into a thin band. Your thoughts come quicker in it.' },
  reed_crown: { name: 'Crown of Reeds', slot: 'head', rarity: 'rare', price: 0, mods: { mantraDmg: 0.06, resist_umbra: 0.15, stealth: 0.1 }, desc: 'Woven from fen reeds that never wither. The marsh still bows to it.' },
  pearl_circlet: { name: 'Pearl Circlet', slot: 'head', rarity: 'rare', price: 0, mods: { maxEther: 15, heal: 0.06, sanityResist: 0.1 }, desc: 'Three sea-pearls on a silver band. Calm as still water.' },
  castellan_seal: { name: "Castellan's Seal", slot: 'ring', rarity: 'rare', price: 0, mods: { maxPosture: 20, physResist: 0.06, postureDmg: 0.06 }, desc: 'The post\'s seal ring, worn smooth on the inside. It was meant to be handed on at the relief.' },
  hollow_circlet: { name: 'Circlet of the Hollow Duke', slot: 'head', rarity: 'legendary', price: 0, mods: { mantraDmg: 0.08, physDmg: 0.05, sanityResist: 0.3 }, desc: 'A sovereign\'s crown, cooled and shrunk to a circlet. It still expects obedience.' },

  // ---- neck ----
  shell_necklace: { name: 'Shell Necklace', slot: 'neck', rarity: 'common', price: 50, mods: { heal: 0.05 }, desc: 'Strung by a child on the beach. Lucky, supposedly.' },
  ember_pendant: { name: 'Ember Pendant', slot: 'neck', rarity: 'uncommon', price: 280, mods: { resist_ember: 0.15, burnDur: 0.2 }, desc: 'A sliver of ember glass on a chain. Warm against the chest.' },
  frost_amulet: { name: 'Frost Amulet', slot: 'neck', rarity: 'uncommon', price: 280, mods: { resist_rime: 0.15, chillPower: 0.15 }, desc: 'A frost lily sealed in clear ice.' },
  storm_torc: { name: 'Storm Torc', slot: 'neck', rarity: 'uncommon', price: 0, mods: { resist_storm: 0.15, shockDur: 0.2 }, desc: 'Twisted copper that hums before a storm.' },
  owl_talisman: { name: 'Owl Talisman', slot: 'neck', rarity: 'uncommon', price: 220, mods: { fallResist: 0.3 }, desc: 'A carved owl skull. Brings a soft landing.' },
  blood_locket: { name: 'Blood Locket', slot: 'neck', rarity: 'rare', price: 0, mods: { lifesteal: 0.02, bleedDmg: 0.15 }, desc: 'It is warm. It is always warm.' },
  colossus_heart: { name: "Colossus's Heartstone", slot: 'neck', rarity: 'rare', price: 0, mods: { maxHp: 30, resist_ember: 0.15 }, desc: 'A pulsing chip of the Colossus\'s core. It beats slower than yours.' },
  vane_locket: { name: "Vane's Locket", slot: 'neck', rarity: 'rare', price: 0, mods: { parryWindow: 0.02, heal: 0.08 }, desc: 'Sera Vane\'s locket. Inside, a portrait of someone who taught her to parry.' },

  serpent_choker: { name: 'Jade Choker', slot: 'neck', rarity: 'rare', price: 0, mods: { bleedDmg: 0.15, dodgeCd: 0.05 }, desc: 'Woven from jade serpent scales. It tightens when you are in danger.' },

  lantern_of_the_lost: { name: 'Lantern of the Lost', slot: 'neck', rarity: 'legendary', price: 0, mods: { maxHp: 30, physDmg: 0.08, mantraDmg: 0.08, sanityResist: 0.3 }, desc: 'A tiny lantern on a chain. The flame inside is somebody. It is grateful.' },

  // ---- ring ----
  copper_band: { name: 'Copper Band', slot: 'ring', rarity: 'common', price: 40, mods: { maxEther: 10 }, desc: 'Plain and green at the edges.' },
  silver_ring: { name: "Merchant's Ring", slot: 'ring', rarity: 'uncommon', price: 250, mods: { silverGain: 0.1, discount: 0.04 }, desc: 'Merchants recognise one of their own.' },
  ring_of_vigor: { name: 'Ring of Vigor', slot: 'ring', rarity: 'uncommon', price: 320, mods: { maxHp: 15, etherRegen: 0.05 }, desc: 'Set with a dull red stone that warms in the sun.' },
  brute_ring: { name: "Brute's Knuckle-Ring", slot: 'ring', rarity: 'uncommon', price: 340, reqs: { strength: 15 }, mods: { postureDmg: 0.1, physDmg: 0.03 }, desc: 'More knuckleduster than jewelry.' },
  ring_of_haste: { name: 'Ring of Haste', slot: 'ring', rarity: 'rare', price: 0, mods: { speed: 0.04, dodgeCd: 0.06 }, desc: 'A feather of gale-glass set in silver.' },
  ring_of_focus: { name: 'Ring of Focus', slot: 'ring', rarity: 'rare', price: 720, reqs: { intelligence: 25 }, mods: { etherCost: 0.1 }, desc: 'A sage\'s ring. The stone drinks distraction.' },
  kings_band: { name: "Old King's Band", slot: 'ring', rarity: 'legendary', price: 0, mods: { physDmg: 0.06, postureDmg: 0.12, maxHp: 20 }, desc: 'A ring big enough for your wrist. The Primadon wore it on one finger.' },
  champions_sigil: { name: "Champion's Sigil", slot: 'ring', rarity: 'rare', price: 0, mods: { physDmg: 0.05, mantraDmg: 0.05, etherRegen: 0.1 }, desc: 'A signet given to Crucible champions. It is heavier than it looks.' },
  starmetal_band: { name: 'Starmetal Band', slot: 'ring', rarity: 'epic', price: 0, craft: { star_shard: 5, sunken_coin: 2 }, mods: { physDmg: 0.04, speed: 0.03, dodgeCd: 0.05 }, desc: 'A ring of starmetal. It always feels like it is about to move.' },
  void_ring: { name: 'Voidbound Ring', slot: 'ring', rarity: 'rare', price: 0, shardPrice: 20, mods: { resist_umbra: 0.2, sanityResist: 0.2, mantraDmg: 0.03 }, desc: 'Black iron that weighs nothing at all.' },
  // ---- standing: Honored (given once by the faction), Exalted (its highest thanks) ----
  watch_lamp_badge: { name: 'Lamp Badge', slot: 'neck', rarity: 'rare', price: 0, mods: { maxHp: 15, physResist: 0.03 }, desc: 'A brass lamp on a blue ribbon. Watchmen salute it before they read the name.' },
  enclave_chain_link: { name: 'Registry Link', slot: 'ring', rarity: 'rare', price: 0, mods: { postureDmg: 0.06, critDmg: 0.06 }, desc: 'One link of the Registry\'s ceremonial chain, closed into a ring. It marks you counted, and then some.' },
  ministry_tuning_fork: { name: 'Listening Fork', slot: 'neck', rarity: 'rare', price: 0, mods: { sanityResist: 0.15, mantraDmg: 0.04 }, desc: 'A Ministry tuning fork on a cord. Strike it and the whispers fall out of tune.' },
  first_lamp_signet: { name: 'Signet of the First Lamp', slot: 'ring', rarity: 'epic', price: 0, mods: { maxHp: 25, maxPosture: 15, physResist: 0.04 }, desc: 'The Watch\'s oldest seal, from before the Fracture. Hale keeps a copy; this is the one that was carried.' },
  crown_fleet_pin: { name: 'Crown Fleet Pin', slot: 'neck', rarity: 'epic', price: 0, mods: { physDmg: 0.06, postureDmg: 0.06, maxPosture: 10 }, desc: 'Worn by the captains who brought the fleet home. Few were given; fewer were earned.' },
  listening_stone: { name: 'Listening Stone', slot: 'head', rarity: 'epic', price: 0, mods: { sanityResist: 0.3, mantraDmg: 0.06, maxEther: 15 }, desc: 'A grey pebble bored through and bound at the brow. Close your eyes and you hear the passage breathing.' },
};

// enemy type -> [{ id, chance }]
export const TRINKET_DROPS = {
  warlord: [{ id: 'red_bandana', chance: 1 }],
  frost_warden: [{ id: 'rime_crown', chance: 1 }],
  cinder_colossus: [{ id: 'colossus_heart', chance: 1 }],
  hollow_duke: [{ id: 'hollow_circlet', chance: 1 }],
  duelist: [{ id: 'vane_locket', chance: 1 }],
  drowned_knight: [{ id: 'drowned_visor', chance: 0.04 }],
  thunderwing: [{ id: 'storm_torc', chance: 0.12 }],
  fen_witch: [{ id: 'blood_locket', chance: 0.03 }],
  frost_stalker: [{ id: 'ring_of_haste', chance: 0.04 }],
  abyssal_watcher: [{ id: 'void_ring', chance: 0.05 }],
  bog_lurker: [{ id: 'shell_necklace', chance: 0.3 }],
  primadon: [{ id: 'kings_band', chance: 1 }],
  witch_queen: [{ id: 'reed_crown', chance: 1 }],
  lanternless: [{ id: 'lantern_of_the_lost', chance: 1 }],
  abyss_knight: [{ id: 'drowned_visor', chance: 0.03 }],
  void_hound: [{ id: 'ring_of_haste', chance: 0.02 }],
  jade_serpent: [{ id: 'serpent_choker', chance: 0.04 }],
  thresher: [{ id: 'bonegnaw_helm', chance: 1 }],
  castellan: [{ id: 'castellan_seal', chance: 1 }],
};

// Corwin forges these from materials instead of selling them.
export const JEWELER_CRAFTS = ['starfall_circlet', 'starmetal_band'];

export const JEWELER_STOCK = ['sailors_cap', 'shell_necklace', 'copper_band', 'iron_helm', 'scholars_circlet', 'hunters_hood', 'owl_talisman', 'silver_ring', 'ring_of_vigor', 'brute_ring', 'ember_pendant', 'frost_amulet', 'ring_of_focus'];

// Traits: 2 points at creation, +1 at Power 5, 10, 15 and 20. Max 3 per trait.
export const TRAITS = {
  vitality: { name: 'Vitality', color: '#e0614f', per: { maxHpPct: 0.04, maxPosture: 4 }, desc: '+4% max health and +4 posture per point.' },
  erudition: { name: 'Erudition', color: '#5aa7ff', per: { mantraDmg: 0.04, maxEther: 8, mantraCd: 0.015 }, desc: '+4% mantra damage, +8 ether and 1.5% shorter mantra cooldowns per point.' },
  proficiency: { name: 'Proficiency', color: '#d9a441', per: { physDmg: 0.03, postureDmg: 0.03 }, desc: '+3% weapon damage and +3% posture damage per point.' },
  songchant: { name: 'Songchant', color: '#ff8fc8', per: { heal: 0.05, etherRegen: 0.1 }, desc: '+5% healing received and +10% ether regeneration per point.' },
};
export const TRAIT_MAX = 3;
export function traitPoints(level) {
  return 2 + Math.floor(level / 5);
}
