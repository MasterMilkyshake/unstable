// Outfits (armor), consumables, materials and quest items.

export const OUTFITS = {
  rags: {
    name: "Wanderer's Rags", armor: 0.02, resist: {}, price: 0, reqs: null, rarity: 'common',
    desc: 'Salt-stiff cloth. Better than nothing, barely.',
    colors: { main: '#7a6a55', trim: '#4b3f31', pants: '#4a4036', boots: '#2e2620' },
  },
  traveler: {
    name: "Traveler's Coat", armor: 0.06, resist: { rime: 0.05 }, price: 90, reqs: null, rarity: 'common',
    desc: 'A sturdy coat lined with seal fur.',
    colors: { main: '#5a4a3a', trim: '#a0784a', pants: '#3a3a3a', boots: '#2a2018' },
  },
  leather: {
    name: 'Leather Armor', armor: 0.1, resist: {}, price: 190, reqs: { fortitude: 10 }, rarity: 'common',
    desc: 'Boiled leather plates over padded cloth.',
    colors: { main: '#6b4a2a', trim: '#3a2a1a', pants: '#4a3a2a', boots: '#2a1a10' }, mods: { maxPosture: 5 },
  },
  mystic: {
    name: "Mystic's Robe", armor: 0.04, resist: { ember: 0.05, rime: 0.05, storm: 0.05, gale: 0.05, umbra: 0.05, blood: 0.05 }, price: 420,
    reqs: { intelligence: 20 }, rarity: 'uncommon', desc: 'Embroidered with focusing sigils. Mana flows easier in it.',
    colors: { main: '#2a3a6a', trim: '#d4b04a', pants: '#1a2040', boots: '#1a1a2a' }, mods: { maxEther: 25, etherRegen: 0.08 },
  },
  scout: {
    name: "Scout's Garb", armor: 0.07, resist: { gale: 0.1 }, price: 360, reqs: { agility: 20 }, rarity: 'uncommon',
    desc: 'Light, close-fitting and quiet. Made for running.',
    colors: { main: '#3a4a3a', trim: '#7a8a5a', pants: '#2a3020', boots: '#1a1a14' }, mods: { speed: 0.05 },
  },
  guard_plate: {
    name: 'Saltreach Guard Plate', armor: 0.17, resist: {}, price: 560, reqs: { fortitude: 25 }, rarity: 'uncommon',
    desc: 'The blue and steel of the Saltreach Watch.',
    colors: { main: '#9aa3ad', trim: '#2a4a7a', pants: '#2a3a5a', boots: '#3a3a3a' }, mods: { maxPosture: 10 },
  },
  frosthide: {
    name: 'Frosthide Coat', armor: 0.1, resist: { rime: 0.35 }, price: 380, reqs: null, rarity: 'uncommon',
    desc: 'Rimefang pelts stitched with sinew. Warm as a hearth.',
    colors: { main: '#d8e4ee', trim: '#7a8a9a', pants: '#5a6a7a', boots: '#3a4a5a' },
  },
  brigand: {
    name: 'Brigand Leathers', armor: 0.09, resist: {}, price: 160, reqs: null, rarity: 'common',
    desc: 'Taken from a brigand. Smells of smoke and cheap ale.',
    colors: { main: '#7a2a20', trim: '#2a1a14', pants: '#3a2a20', boots: '#1a1410' }, mods: { physDmg: 0.03 },
  },
  cinderplate: {
    name: 'Cinderplate', armor: 0.2, resist: { ember: 0.4 }, price: 1100, reqs: { fortitude: 35 }, rarity: 'rare',
    desc: 'Plates cooled in a golem\'s slag. Still warm to the touch.',
    colors: { main: '#3a2a26', trim: '#ff7a2f', pants: '#2a1a16', boots: '#1a1210' }, mods: { maxPosture: 15 },
  },
  knight_plate: {
    name: "Knight's Plate", armor: 0.26, resist: {}, price: 1400, reqs: { fortitude: 45, strength: 20 }, rarity: 'rare',
    desc: 'Full plate from an order that no longer exists. Heavy.',
    colors: { main: '#c9cdd4', trim: '#d4b04a', pants: '#8a8f99', boots: '#5a5f69' }, mods: { maxPosture: 25, speed: -0.06 },
  },
  sailor: {
    name: "Sailor's Slops", armor: 0.05, resist: { gale: 0.05 }, price: 70, reqs: null, rarity: 'common',
    desc: 'Loose canvas and tarred wool. You swim like you were born to it.',
    colors: { main: '#2a4a6a', trim: '#e8e4dc', pants: '#3a3a40', boots: '#2a2018' }, mods: { swimSpeed: 0.2 },
  },
  fen_cloak: {
    name: 'Fenwalker Cloak', armor: 0.06, resist: { umbra: 0.1, gale: 0.1 }, price: 320, reqs: null, rarity: 'uncommon',
    desc: 'Moss-dyed and reed-woven. Things in the marsh look straight past you.',
    colors: { main: '#3a4a2a', trim: '#7a8a4a', pants: '#2a3020', boots: '#1a1a10' }, mods: { stealth: 0.15 },
  },
  owlfeather: {
    name: 'Owlfeather Mantle', armor: 0.07, resist: { gale: 0.2 }, price: 0, reqs: null, rarity: 'rare',
    desc: 'Stitched from gloomowl down. You fall like a leaf.',
    colors: { main: '#5a5058', trim: '#c8b8a0', pants: '#3a343a', boots: '#2a2428' }, mods: { fallResist: 0.6 },
  },
  duelist_coat: {
    name: "Duelist's Longcoat", armor: 0.1, resist: {}, price: 0, reqs: { agility: 15 }, rarity: 'rare',
    desc: 'Sera Vane\'s coat, cut for lunging. It still smells of lamp oil and salt.',
    colors: { main: '#5a1a2a', trim: '#d4b04a', pants: '#2a1a20', boots: '#1a1014' }, mods: { parryWindow: 0.02, speed: 0.03 },
  },
  cultist_robes: {
    name: 'White Cult Robes', armor: 0.07, resist: { rime: 0.25 }, price: 0, reqs: null, rarity: 'uncommon',
    desc: 'Bleached wool embroidered with frost-sigils. Cold flows through it like a current.',
    colors: { main: '#e8eef5', trim: '#5fa8d3', pants: '#9aaab8', boots: '#5a6a7a' }, mods: { mantraDmg: 0.05 },
  },
  zealot_vestments: {
    name: 'Zealot Vestments', armor: 0.08, resist: { ember: 0.25 }, price: 0, reqs: null, rarity: 'uncommon',
    desc: 'Ash-black cloth that never quite stops smoking.',
    colors: { main: '#2a1a16', trim: '#ff7a2f', pants: '#1a1210', boots: '#100a08' }, mods: { etherRegen: 0.1 },
  },
  drowned_plate: {
    name: 'Drowned Plate', armor: 0.22, resist: { umbra: 0.2 }, price: 0, reqs: { fortitude: 35 }, rarity: 'rare',
    desc: 'Barnacled plate from a knight who never surfaced. The whispers break against it.',
    colors: { main: '#4a5a6a', trim: '#a274ff', pants: '#2a323a', boots: '#1a1e24' }, mods: { maxPosture: 15, sanityResist: 0.15, speed: -0.04 },
  },
  mossbound_garb: {
    name: 'Mossbound Garb', armor: 0.09, resist: { gale: 0.12, blood: 0.12 }, price: 0, reqs: null, rarity: 'rare',
    desc: 'Bark plates and living moss. It breathes when you do.',
    colors: { main: '#3a5a2a', trim: '#c8a040', pants: '#2a2a18', boots: '#1a1a10' }, mods: { speed: 0.03, heal: 0.08 },
  },
  grovehide: {
    name: 'Grovehide Coat', armor: 0.14, resist: { gale: 0.1 }, price: 0, reqs: { fortitude: 20 }, rarity: 'rare',
    desc: 'Ape hide over a moss-padded lining. Turns a blade, breathes like linen.',
    colors: { main: '#2a2622', trim: '#6a8a3a', pants: '#2a2a1e', boots: '#1a1612' }, mods: { maxHp: 15, maxPosture: 8 },
  },
  riftwalker: {
    name: 'Riftwalker Robes', armor: 0.08, resist: { umbra: 0.3, ember: 0.08, rime: 0.08, storm: 0.08 }, price: 0, shardPrice: 18, reqs: null,
    rarity: 'rare', desc: 'Woven from something that is not quite cloth. The whispers grow quieter.',
    colors: { main: '#2a1a3a', trim: '#a274ff', pants: '#1a1028', boots: '#0a0814' }, mods: { sanityResist: 0.45 },
  },
  // ---- standing: given once by each faction when a character first stands Honored with it ----
  watch_greatcoat: {
    name: 'Watch Greatcoat', armor: 0.13, resist: { rime: 0.1, gale: 0.05 }, price: 0, reqs: null, rarity: 'rare',
    desc: 'Blue wool cut long for the harbor wind, brass at the throat. The Watch gives them to people it would trust with the lamp.',
    colors: { main: '#3e5274', trim: '#c9b27a', pants: '#2e3542', boots: '#1f1a16' }, mods: { maxHp: 10, maxPosture: 8 },
  },
  enclave_blacks: {
    name: 'Registry Blacks', armor: 0.16, resist: {}, price: 0, reqs: null, rarity: 'rare',
    desc: 'Black broadcloth over a mail shirt, the Registry\'s crimson cord at the collar. Counted folk step aside for it.',
    colors: { main: '#1f1f24', trim: '#b8303a', pants: '#18181c', boots: '#121214' }, mods: { maxPosture: 12, physDmg: 0.03 },
  },
  ministry_greys: {
    name: 'Soundings Greys', armor: 0.07, resist: { umbra: 0.15 }, price: 0, reqs: null, rarity: 'rare',
    desc: 'A clerk\'s grey robes, lined against the fog. The hem is weighted with sounding lead.',
    colors: { main: '#6e7078', trim: '#9aa0c8', pants: '#4a4c54', boots: '#2a2a30' }, mods: { sanityResist: 0.2, maxEther: 15 },
  },
};

// type: food | drink | tool | potion | material | quest | special
export const ITEMS = {
  bread: { name: 'Bread', type: 'food', hunger: 28, price: 6, desc: 'Dense sailor\'s loaf.', icon: '🍞' },
  apple: { name: 'Apple', type: 'food', hunger: 12, water: 6, price: 3, desc: 'Crisp and a little sour.', icon: '🍎' },
  fish_raw: { name: 'Raw Fish', type: 'food', hunger: 7, price: 2, cook: 'fish_cooked', desc: 'Cook it at a campfire.', icon: '🐟' },
  fish_cooked: { name: 'Grilled Fish', type: 'food', hunger: 30, heal: 8, price: 10, desc: 'Flaky and smoky.', icon: '🍢' },
  meat_raw: { name: 'Raw Meat', type: 'food', hunger: 9, price: 3, cook: 'steak', desc: 'Cook it at a campfire.', icon: '🥩' },
  steak: { name: 'Seared Steak', type: 'food', hunger: 42, heal: 14, price: 16, desc: 'Charred outside, rare within.', icon: '🍖' },
  mushroom: { name: 'Glowcap', type: 'food', hunger: 6, sanity: 8, price: 4, desc: 'Faintly luminous. Settles the mind.', icon: '🍄' },
  stew: { name: 'Hearty Stew', type: 'food', hunger: 60, water: 20, heal: 25, price: 28, desc: 'Fills the belly and mends the body.', icon: '🍲' },
  waterskin: { name: 'Waterskin', type: 'tool', charges: 4, water: 32, price: 15, desc: 'Refill it at wells, springs and rivers.', icon: '💧' },
  herb: { name: 'Mendleaf', type: 'potion', hot: 18, price: 10, desc: 'Chew to slowly close wounds.', icon: '🌿' },
  elixir: { name: 'Healing Elixir', type: 'potion', healPct: 0.45, price: 65, desc: 'Restores 45% of your health.', icon: '🧪' },
  ether_tonic: { name: 'Ether Tonic', type: 'potion', ether: 60, price: 40, desc: 'Restores 60 ether.', icon: '🔷' },
  sanity_draught: { name: 'Calming Draught', type: 'potion', sanity: 50, price: 45, desc: 'Silences the whispers for a while.', icon: '🫧' },
  mantra_spark: { name: 'Mantra Spark', type: 'material', price: 220, desc: 'A crystallized thought. Use at a Mantra Altar to empower a mantra.', icon: '✨' },
  rift_shard: { name: 'Rift Shard', type: 'material', price: 0, sell: 15, desc: 'A sliver of the world beneath the world.', icon: '🔮' },
  ember_glass: { name: 'Ember Glass', type: 'material', price: 0, sell: 20, desc: 'Molten glass from a golem\'s core.', icon: '🟠' },
  wolf_pelt: { name: 'Rimefang Pelt', type: 'material', price: 0, sell: 18, desc: 'Thick, frosted fur.', icon: '🐺' },
  owl_feather: { name: 'Gloomowl Feather', type: 'material', price: 0, sell: 12, desc: 'Soft as smoke.', icon: '🪶' },
  lost_satchel: { name: "Pell's Satchel", type: 'quest', price: 0, desc: 'A merchant\'s satchel, torn by talons.', icon: '👜' },
  fracture_core: { name: 'Fracture Core', type: 'quest', price: 0, desc: 'A pulsing heart of unstable power torn from a great foe.', icon: '💠' },
  ember_of_life: { name: 'Ember of Life', type: 'special', price: 0, desc: 'Consume to regain one lost life.', icon: '🔥' },
  bounty_token: { name: 'Brigand Token', type: 'material', price: 0, sell: 4, desc: 'Red cloth tied to every brigand\'s arm.', icon: '🟥' },

  // ---- fishing ----
  fishing_rod: { name: 'Fishing Rod', type: 'material', price: 40, sell: 12, desc: 'Ash pole, gut line, bone hook. Press E at docks and fishing spots to cast.', icon: '🎣' },
  eel: { name: 'Raw Eel', type: 'food', hunger: 8, price: 6, cook: 'smoked_eel', desc: 'Still twitching. Cook it at a campfire.', icon: '🐍' },
  smoked_eel: { name: 'Smoked Eel', type: 'food', hunger: 34, heal: 16, ether: 15, price: 18, desc: 'Rich and oily. Restores a little ether.', icon: '🍢' },
  glimmerfish: { name: 'Glimmerfish', type: 'food', hunger: 12, sanity: 25, price: 30, desc: 'A pale fish from the Rift\'s still pools. It glows in the mouth.', icon: '🐠' },
  pearl: { name: 'Pearl', type: 'material', price: 0, sell: 70, desc: 'A perfect pearl. Corwin pays well for these.', icon: '⚪' },
  sunken_coin: { name: 'Sunken Coin', type: 'material', price: 0, sell: 28, desc: 'Old Saltreach silver, crusted with barnacles.', icon: '🪙' },
  old_boot: { name: 'Old Boot', type: 'material', price: 0, sell: 1, desc: 'Not even your size.', icon: '🥾' },

  // ---- foraged ingredients ----
  berries: { name: 'Thornberries', type: 'food', hunger: 6, water: 6, price: 3, desc: 'Tart red berries from the Thornwood brambles.', icon: '🫐', ingredient: 'fruit' },
  honeycomb: { name: 'Honeycomb', type: 'food', hunger: 10, heal: 4, price: 8, desc: 'Wild honey, still in the comb.', icon: '🍯', ingredient: 'sweet' },
  frost_lily: { name: 'Frost Lily', type: 'food', hunger: 2, sanity: 6, price: 6, desc: 'A pale flower that only blooms in snow. Calming to chew.', icon: '🌼', ingredient: 'herb' },
  ember_pepper: { name: 'Ember Pepper', type: 'food', hunger: 3, price: 6, desc: 'Grows in volcanic ash. Eating one raw is a mistake.', icon: '🌶️', ingredient: 'spice' },
  salt: { name: 'Sea Salt', type: 'material', price: 2, sell: 1, desc: 'Scraped from tide pools. Every cook wants some.', icon: '🧂', ingredient: 'salt' },

  // ---- fuel: lay a campfire anywhere (game/camp.js): sit, cook and invest by it ----
  stick: { name: 'Sticks', type: 'tool', camp: 3, price: 2, sell: 1, desc: 'Dry branches gathered in the woods. Three make a campfire.', icon: '🥢' },
  firewood: { name: 'Firewood', type: 'tool', camp: 1, price: 12, sell: 4, desc: 'A split bundle bound with cord. Lay it anywhere for a campfire that burns a while.', icon: '🪵' },

  // ---- cooked meals (campfire recipes) ----
  fish_stew: { name: 'Fisherman\'s Stew', type: 'food', hunger: 55, water: 25, heal: 22, price: 30, desc: 'Fish, salt and patience.', icon: '🥣' },
  spiced_skewer: { name: 'Spiced Skewer', type: 'food', hunger: 40, heal: 12, price: 34, desc: 'Burns going down. +10% damage for 2 minutes.', icon: '🍢', buff: { id: 'spiced', t: 120, mods: { physDmg: 0.1, mantraDmg: 0.1 }, color: '#ff7a2f', name: 'Spiced' } },
  honey_cake: { name: 'Honey Cake', type: 'food', hunger: 35, ether: 40, price: 30, desc: 'Sticky and sweet. +25% ether regeneration for 2 minutes.', icon: '🍰', buff: { id: 'sugared', t: 120, mods: { etherRegen: 0.25 }, color: '#ffd27a', name: 'Sugared' } },
  lily_tea: { name: 'Frost Lily Tea', type: 'drink', water: 45, sanity: 30, price: 26, desc: 'Steeped lily petals. Slows sanity loss by 30% for 3 minutes.', icon: '🍵', buff: { id: 'serene', t: 180, mods: { sanityResist: 0.3 }, color: '#b98cff', name: 'Serene' } },
  hunters_feast: { name: "Hunter's Feast", type: 'food', hunger: 80, water: 15, heal: 40, price: 60, desc: 'Steak, berries and salt. +20 max health for 3 minutes.', icon: '🍗', buff: { id: 'well_fed', t: 180, mods: { maxHp: 20, maxPosture: 10 }, color: '#e0614f', name: 'Well Fed' } },
  berry_tart: { name: 'Thornberry Tart', type: 'food', hunger: 30, water: 10, heal: 10, price: 18, desc: 'Sweet, sour and filling. +5% speed for 2 minutes.', icon: '🥧', buff: { id: 'spry', t: 120, mods: { speed: 0.05 }, color: '#5fd38d', name: 'Spry' } },

  // ---- tonics ----
  cleansing_salts: { name: 'Cleansing Salts', type: 'potion', cleanse: true, price: 35, desc: 'Inhale sharply. Clears burns, bleeds, chill and blindness.', icon: '⚗️' },
  fireproof_salve: { name: 'Cinder Salve', type: 'potion', price: 55, desc: '+35% fire resistance for 90 seconds.', icon: '🧴', buff: { id: 'fireproof', t: 90, mods: { resist_ember: 0.35 }, color: '#ff7a2f', name: 'Fireproof' } },
  frost_salve: { name: 'Rime Salve', type: 'potion', price: 55, desc: '+35% ice resistance for 90 seconds.', icon: '🧴', buff: { id: 'insulated', t: 90, mods: { resist_rime: 0.35 }, color: '#8fd8ff', name: 'Insulated' } },
  iron_draught: { name: 'Iron Draught', type: 'potion', price: 90, desc: '+12% physical resistance and +25 posture for 60 seconds.', icon: '🛡️', buff: { id: 'ironclad', t: 60, mods: { physResist: 0.12, maxPosture: 25 }, color: '#c9d0dc', name: 'Ironclad' } },

  // ---- enemy materials ----
  witch_charm: { name: 'Fen Charm', type: 'material', price: 0, sell: 16, desc: 'Bones and reeds bound with hair. It twitches.', icon: '🪬' },
  cultist_sigil: { name: 'Frost Sigil', type: 'material', price: 0, sell: 22, desc: 'A disc of never-melting ice etched with a spiral.', icon: '❄️' },
  zealot_brand: { name: 'Zealot Brand', type: 'material', price: 0, sell: 24, desc: 'An iron brand, still hot. The zealots wear the scars proudly.', icon: '🔥' },
  drowned_crest: { name: 'Drowned Crest', type: 'material', price: 0, sell: 30, desc: 'The heraldry of an order that drowned with its keep.', icon: '🛡️' },
  stalker_fang: { name: 'Stalker Fang', type: 'material', price: 0, sell: 26, desc: 'Translucent, and colder than the snow it was found in.', icon: '🦷' },
  ember_shell: { name: 'Cinder Carapace', type: 'material', price: 0, sell: 20, desc: 'A crab shell veined with cooling lava.', icon: '🦀' },
  sharko_tooth: { name: 'Sharko Tooth', type: 'material', price: 0, sell: 34, desc: 'Long as a hand and serrated on both edges. It was one of a great many.', icon: '🦷' },
  ape_hide: { name: 'Ape Hide', type: 'material', price: 0, sell: 24, desc: 'Coarse black fur over leather-thick skin.', icon: '🦍' },
  serpent_scale: { name: 'Jade Scale', type: 'material', price: 0, sell: 22, desc: 'A green scale that flashes like glass in the sun.', icon: '🐍' },
  mossbound_mask: { name: 'Mossbound Mask', type: 'material', price: 0, sell: 20, desc: 'A carved wooden face, grown over with moss.', icon: '🎭' },
  thresher_tooth: { name: 'Thresher Tooth', type: 'material', price: 0, sell: 40, desc: 'As long as your forearm and twice as sharp.', icon: '🦷' },
  smithing_stone: { name: 'Smithing Stone', type: 'material', price: 45, sell: 12, desc: 'A dense, oily whetstone. Dorran uses them to temper weapons.', icon: '🪨' },
  star_shard: { name: 'Star Shard', type: 'material', price: 0, sell: 45, desc: 'Starmetal from a fallen star. Warm, light, and humming faintly. Corwin can forge it.', icon: '🌠' },
  crucible_mark: { name: 'Crucible Mark', type: 'material', price: 0, sell: 10, desc: 'A bronze token stamped with a fist. Pitmaster Vorn trades them for the good stuff.', icon: '🏅' },
  abyssal_lens: { name: 'Abyssal Lens', type: 'material', price: 0, sell: 45, desc: 'The hardened eye of a Watcher. Things move inside it.', icon: '👁️' },

  // ---- contract recoveries (data/contracts.js): carried back to the board's officer ----
  courier_satchel: { name: "Courier's Satchel", type: 'quest', quest: true, price: 0, desc: 'A Watch courier\'s satchel, the flap still buckled over the dispatches.', icon: '👜' },
  writ_case: { name: 'Writ Case', type: 'quest', quest: true, price: 0, desc: 'A lacquered tube with the Enclave\'s seal on its cap. The Registry wants it back unopened.', icon: '📜' },
  sounding_line: { name: 'Cut Sounding Line', type: 'quest', quest: true, price: 0, desc: 'A coil of knotted line and its lead weight. Every knot is a fathom someone counted.', icon: '🪢' },
};

// Campfire recipes: ingredients (item id -> count) -> result. Checked in order.
export const RECIPES = [
  { id: 'hunters_feast', needs: { steak: 1, berries: 2, salt: 1 } },
  { id: 'fish_stew', needs: { fish_cooked: 2, salt: 1 } },
  { id: 'spiced_skewer', needs: { steak: 1, ember_pepper: 1 } },
  { id: 'honey_cake', needs: { bread: 1, honeycomb: 1 } },
  { id: 'lily_tea', needs: { frost_lily: 2, waterskin_charge: 1 } },
  { id: 'berry_tart', needs: { berries: 3, bread: 1 } },
  { id: 'stew', needs: { meat_raw: 2, mushroom: 1, salt: 1 } },
];

export const STACKABLE = (id) => ITEMS[id] && ITEMS[id].type !== 'tool';
